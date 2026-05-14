import fs from "node:fs";
import path from "node:path";
import { assertApproved } from "./approval.mjs";
import { ensureDir, readJson, readJsonl, writeJson } from "./files.mjs";
import {
  expectedVideoReferencePath,
  resolveShotReferenceImage,
  videoReferenceAssetId,
} from "./imagegen-assets.mjs";
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

function resolveKeyframeForShot(projectDir, shotId, state, { execute = false, allowPlaceholder = false } = {}) {
  const referenceImage = resolveShotReferenceImage(projectDir, shotId);
  if (referenceImage) {
    const isCodexReference = referenceImage.includes(path.join("assets", "reference_images", "video_refs"));
    if (execute && !allowPlaceholder && !isCodexReference) {
      throw new Error(`Codex video reference image is required before paid Seedance submission for ${shotId}: ${expectedVideoReferencePath(projectDir, shotId)}. Run "welopc-drama-agent images --project <project>" and generate/save the video_reference_frame first, or pass --allow-placeholder for an intentional low-quality test.`);
    }
    const assetId = isCodexReference ? videoReferenceAssetId(shotId) : `${shotId}_keyframe`;
    state.images[assetId] = {
      status: "succeeded",
      provider: isCodexReference ? "codex_imagegen" : "local_keyframe",
      output_path: referenceImage,
      updated_at: new Date().toISOString(),
    };
    return referenceImage;
  }

  if (execute && !allowPlaceholder) {
    throw new Error(`Codex video reference image is required before paid Seedance submission for ${shotId}: ${expectedVideoReferencePath(projectDir, shotId)}. Run "welopc-drama-agent images --project <project>" and generate/save the video_reference_frame first, or pass --allow-placeholder for an intentional low-quality test.`);
  }

  const keyframePath = writeKeyframe(projectDir, shotId);
  state.images[`${shotId}_keyframe`] = {
    status: "succeeded",
    provider: "local_placeholder",
    output_path: keyframePath,
    updated_at: new Date().toISOString(),
  };
  return keyframePath;
}

function shotIdFromTaskId(taskId) {
  return String(taskId).replace(/_video_v\d+$/, "");
}

function packedTaskId(packId) {
  return `${packId}_video_v01`;
}

function resolveProjectPath(projectDir, file) {
  if (!file) return null;
  return path.isAbsolute(file) ? file : path.join(projectDir, file);
}

function loadPackingPlan(projectDir) {
  const file = path.join(projectDir, "video_node_packing_plan.jsonl");
  if (!fs.existsSync(file)) return [];
  return readJsonl(file);
}

function resolvePackedReferenceFrames(projectDir, pack, referenceDir) {
  return (pack.reference_frames || []).map((file) => {
    if (referenceDir) {
      return path.join(resolveProjectPath(projectDir, referenceDir), path.basename(file));
    }
    return resolveProjectPath(projectDir, file);
  });
}

function packedNodeIsReady(projectDir, pack, referenceDir) {
  const frames = resolvePackedReferenceFrames(projectDir, pack, referenceDir);
  return frames.length > 0 && frames.every((file) => fs.existsSync(file));
}

function buildPackedVideoPrompt(pack) {
  const beatLines = (pack.visual_beats || []).map((beat, index) => (
    `${index + 1}. ${beat.start_sec ?? 0}-${beat.end_sec ?? ""}s ${beat.shot_id || ""}: ${beat.beat || ""}; camera: ${beat.camera_motion || ""}; action: ${beat.visual_action || ""}`
  ));
  return [
    "Generate one vertical cinematic short-drama video node.",
    `Use the supplied ${pack.reference_frames?.length || 1} images as ordered visual beat references inside this single 5-second provider clip.`,
    "The first image is the opening visual target; the following images guide the next motion beats in order.",
    "Keep character identity, clothing, props, courtyard geography, lens language, and color continuity consistent across the whole node.",
    "No subtitles, no UI text, no logo, no watermark. Generated audio is only a timing reference and will be ignored in final editing.",
    `Target visible action length for final edit: ${pack.target_duration_sec || 5}s. Provider duration: ${pack.provider_duration_sec || 5}s.`,
    "Visual beats:",
    ...beatLines,
  ].join("\n");
}

export async function renderBatch({
  projectDir,
  batch = 3,
  resolution = "480p",
  force = false,
  execute = false,
  allowPlaceholder = false,
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
    const keyframePath = resolveKeyframeForShot(projectDir, item.shot_id, state, { execute, allowPlaceholder });
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
        provider_duration_sec: result.duration,
        target_duration_sec: item.duration_sec,
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

export async function renderPackedBatch({
  projectDir,
  batch = 3,
  resolution = "480p",
  referenceDir,
  force = false,
  execute = false,
  env,
  fetchImpl,
}) {
  assertApproved(projectDir);
  const packingPlan = loadPackingPlan(projectDir);
  const state = loadState(projectDir);
  state.images ||= {};
  state.videos ||= {};
  const selected = packingPlan
    .filter((pack) => packedNodeIsReady(projectDir, pack, referenceDir))
    .filter((pack) => force || !state.videos[packedTaskId(pack.pack_id)]?.provider_task_id)
    .slice(0, Number(batch || 3));
  const skippedMissingReferences = packingPlan
    .filter((pack) => !packedNodeIsReady(projectDir, pack, referenceDir))
    .map((pack) => pack.pack_id);
  const submitted = [];
  const seedanceConfig = execute ? createSeedanceConfig({ env }) : null;

  for (const pack of selected) {
    const taskId = packedTaskId(pack.pack_id);
    const referenceFramePaths = resolvePackedReferenceFrames(projectDir, pack, referenceDir);
    const prompt = buildPackedVideoPrompt(pack);
    if (execute) {
      const result = await submitSeedanceVideoTask({
        prompt,
        keyframePath: referenceFramePaths[0],
        referenceImagePaths: referenceFramePaths,
        durationSec: pack.provider_duration_sec || pack.target_duration_sec || 5,
        model: pack.model,
        resolution,
        config: seedanceConfig,
        fetchImpl,
      });
      state.videos[taskId] = {
        status: "submitted",
        provider: "seedance",
        output_kind: "packed_video_node",
        provider_task_id: result.provider_task_id,
        pack_id: pack.pack_id,
        shot_ids: pack.shot_ids || [],
        model: result.model,
        resolution: result.resolution,
        ratio: result.ratio,
        provider_duration_sec: result.duration,
        target_duration_sec: Number(pack.target_duration_sec || result.duration || 5),
        keyframe_path: referenceFramePaths[0],
        reference_frame_paths: referenceFramePaths,
        reference_dir: referenceDir ? resolveProjectPath(projectDir, referenceDir) : undefined,
        reference_image_count: referenceFramePaths.length,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      submitted.push(taskId);
    } else {
      state.videos[taskId] = {
        status: "ready_for_seedance",
        provider: "seedance",
        output_kind: "packed_video_node",
        pack_id: pack.pack_id,
        shot_ids: pack.shot_ids || [],
        resolution,
        provider_duration_sec: Number(pack.provider_duration_sec || 5),
        target_duration_sec: Number(pack.target_duration_sec || 5),
        keyframe_path: referenceFramePaths[0],
        reference_frame_paths: referenceFramePaths,
        reference_dir: referenceDir ? resolveProjectPath(projectDir, referenceDir) : undefined,
        reference_image_count: referenceFramePaths.length,
        updated_at: new Date().toISOString(),
      };
    }
  }

  saveState(projectDir, state);
  return {
    selected: selected.map((pack) => packedTaskId(pack.pack_id)),
    selected_packs: selected.map((pack) => pack.pack_id),
    submitted,
    skipped_missing_references: skippedMissingReferences,
    reference_dir: referenceDir ? resolveProjectPath(projectDir, referenceDir) : null,
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
        const outputStem = record.pack_id || shotByTaskId.get(taskId) || shotIdFromTaskId(taskId);
        const outputPath = path.join(projectDir, "outputs", "clips", `${outputStem}.mp4`);
        await downloadSeedanceFile({ url: videoUrl, outputPath, fetchImpl });
        record.output_path = outputPath;
        record.downloaded_at = new Date().toISOString();
        delete record.output_url;
        delete record.last_frame_url;
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
