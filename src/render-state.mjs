import fs from "node:fs";
import path from "node:path";
import { assertApproved } from "./approval.mjs";
import { ensureDir, readJson, readJsonl, writeJson } from "./files.mjs";
import {
  createSeedanceConfig,
  downloadSeedanceFile,
  querySeedanceVideoTask,
  submitSeedanceVideoTask,
} from "./providers/seedance.mjs";

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgaGAAAAK0AKGKCx1bAAAAAElFTkSuQmCC";

function loadState(projectDir) {
  const file = path.join(projectDir, "render_state.json");
  if (!fs.existsSync(file)) return { images: {}, videos: {}, updated_at: null };
  return readJson(file);
}

function saveState(projectDir, state) {
  state.updated_at = new Date().toISOString();
  writeJson(path.join(projectDir, "render_state.json"), state);
}

function writeKeyframe(projectDir, shotId) {
  const file = path.join(projectDir, "assets", "keyframes", `${shotId}.png`);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, Buffer.from(TINY_PNG, "base64"));
  return file;
}

function shotIdFromTaskId(taskId) {
  return String(taskId).replace(/_video_v\d+$/, "");
}

export async function renderBatch({
  projectDir,
  batch = 3,
  resolution = "480p",
  force = false,
  execute = false,
  env,
  fetchImpl,
}) {
  assertApproved(projectDir);
  const videoPrompts = readJsonl(path.join(projectDir, "video_prompts.jsonl"));
  const state = loadState(projectDir);
  state.images ||= {};
  state.videos ||= {};
  const selected = videoPrompts
    .filter((item) => force || !state.videos[item.task_id]?.provider_task_id)
    .slice(0, Number(batch || 3));
  const generatedKeyframes = [];
  const submitted = [];
  const seedanceConfig = execute ? createSeedanceConfig({ env }) : null;

  for (const item of selected) {
    const keyframePath = writeKeyframe(projectDir, item.shot_id);
    state.images[`${item.shot_id}_keyframe`] = {
      status: "succeeded",
      provider: "builtin_storyboard",
      output_path: keyframePath,
      updated_at: new Date().toISOString(),
    };
    if (execute) {
      const result = await submitSeedanceVideoTask({
        prompt: item.prompt,
        keyframePath,
        durationSec: item.duration_sec,
        model: item.model_hint,
        resolution,
        config: seedanceConfig,
        fetchImpl,
      });
      state.videos[item.task_id] = {
        status: "submitted",
        provider: "seedance",
        provider_task_id: result.provider_task_id,
        model: result.model,
        resolution: result.resolution,
        ratio: result.ratio,
        keyframe_path: keyframePath,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      submitted.push(item.task_id);
    } else {
      state.videos[item.task_id] = {
        status: "ready_for_seedance",
        provider: "seedance",
        resolution,
        keyframe_path: keyframePath,
        updated_at: new Date().toISOString(),
      };
    }
    generatedKeyframes.push(keyframePath);
  }

  saveState(projectDir, state);
  return {
    selected: selected.map((item) => item.task_id),
    submitted,
    generated_keyframes: generatedKeyframes,
    state_file: path.join(projectDir, "render_state.json"),
  };
}

export async function refreshSeedanceStatuses({
  projectDir,
  env,
  fetchImpl,
  poll = false,
  pollAttempts = 1,
  pollIntervalSec = 30,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const state = loadState(projectDir);
  state.videos ||= {};
  const videoPrompts = readJsonl(path.join(projectDir, "video_prompts.jsonl"));
  const shotByTaskId = new Map(videoPrompts.map((item) => [item.task_id, item.shot_id]));
  const config = createSeedanceConfig({ env });
  const checked = [];
  const attempts = poll ? Math.max(1, Number(pollAttempts || 1)) : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const [taskId, record] of Object.entries(state.videos)) {
      if (!["seedance", "ark"].includes(record.provider) || !record.provider_task_id) continue;
      if (record.status === "succeeded" && record.output_path && fs.existsSync(record.output_path)) continue;
      if (record.status === "failed") continue;

      const body = await querySeedanceVideoTask({
        providerTaskId: record.provider_task_id,
        config,
        fetchImpl,
      });
      record.status = body.status || record.status;
      record.updated_at = new Date().toISOString();

      const videoUrl = body.content?.video_url;
      if (record.status === "succeeded" && videoUrl) {
        const shotId = shotByTaskId.get(taskId) || shotIdFromTaskId(taskId);
        const outputPath = path.join(projectDir, "outputs", "clips", `${shotId}.mp4`);
        await downloadSeedanceFile({ url: videoUrl, outputPath, fetchImpl });
        record.output_url = videoUrl;
        record.output_path = outputPath;
        record.last_frame_url = body.content?.last_frame_url || null;
      }

      checked.push({
        task_id: taskId,
        provider_task_id: record.provider_task_id,
        status: record.status,
      });
    }

    saveState(projectDir, state);
    const unfinished = Object.values(state.videos).some((record) => (
      ["seedance", "ark"].includes(record.provider)
      && record.provider_task_id
      && record.status !== "succeeded"
      && record.status !== "failed"
    ));
    if (!poll || !unfinished || attempt === attempts) break;
    await sleep(Number(pollIntervalSec || 30) * 1000);
  }

  return {
    checked,
    state_file: path.join(projectDir, "render_state.json"),
  };
}
