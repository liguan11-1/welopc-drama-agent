import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureDir, readJson, readJsonl, writeJson, writeText } from "./files.mjs";

function quoteConcatPath(file) {
  return `file '${path.resolve(file).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

function resolveClips(projectDir) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const stateFile = path.join(projectDir, "render_state.json");
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { videos: {} };
  const clips = [];
  const missing = [];

  for (const shot of shots) {
    const taskId = `${shot.shot_id}_video_v01`;
    const clip = state.videos?.[taskId]?.output_path || path.join(projectDir, "outputs", "clips", `${shot.shot_id}.mp4`);
    if (clip && fs.existsSync(clip)) {
      clips.push(clip);
    } else {
      missing.push(taskId);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Cannot compose: missing clips for ${missing.join(", ")}`);
  }
  return clips;
}

export function planCompose({ projectDir }) {
  const clips = resolveClips(projectDir);
  const outputDir = path.join(projectDir, "outputs");
  const finalDir = path.join(outputDir, "final");
  ensureDir(finalDir);
  const concatList = path.join(finalDir, "concat_list.txt");
  const output = path.join(finalDir, "final.mp4");
  writeText(concatList, `${clips.map(quoteConcatPath).join("\n")}\n`);
  const command = [
    "ffmpeg",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatList,
    "-c",
    "copy",
    output,
  ];
  return { clips, concat_list: concatList, output_path: output, command };
}

export function composeProject({ projectDir, execute = false }) {
  const plan = planCompose({ projectDir });
  if (!execute) {
    writeJson(path.join(projectDir, "outputs", "final", "compose_plan.json"), plan);
    return { ...plan, dry_run: true };
  }
  const result = spawnSync(plan.command[0], plan.command.slice(1), { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffmpeg failed");
  }
  return { ...plan, dry_run: false };
}
