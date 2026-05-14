import fs from "node:fs";
import path from "node:path";
import { assertApproved } from "./approval.mjs";
import { ensureDir, readJson, readJsonl, writeJson } from "./files.mjs";

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

export async function renderBatch({ projectDir, batch = 3, resolution = "480p", force = false }) {
  assertApproved(projectDir);
  const videoPrompts = readJsonl(path.join(projectDir, "video_prompts.jsonl"));
  const state = loadState(projectDir);
  const selected = videoPrompts
    .filter((item) => force || !state.videos[item.task_id]?.provider_task_id)
    .slice(0, Number(batch || 3));
  const generatedKeyframes = [];

  for (const item of selected) {
    const keyframePath = writeKeyframe(projectDir, item.shot_id);
    state.images[`${item.shot_id}_keyframe`] = {
      status: "succeeded",
      provider: "builtin_storyboard",
      output_path: keyframePath,
      updated_at: new Date().toISOString(),
    };
    state.videos[item.task_id] = {
      status: "ready_for_seedance",
      provider: "seedance",
      resolution,
      keyframe_path: keyframePath,
      updated_at: new Date().toISOString(),
    };
    generatedKeyframes.push(keyframePath);
  }

  saveState(projectDir, state);
  return {
    selected: selected.map((item) => item.task_id),
    generated_keyframes: generatedKeyframes,
    state_file: path.join(projectDir, "render_state.json"),
  };
}
