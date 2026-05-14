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

function startMsFromTimeRange(timeRange) {
  const match = String(timeRange || "").match(/^(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 1000) : 0;
}

function resolveVoiceTracks(projectDir) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const shotStartMs = new Map(shots.map((shot) => [shot.shot_id, startMsFromTimeRange(shot.time_range)]));
  const stateFile = path.join(projectDir, "outputs", "audio", "voice_state.json");
  if (!fs.existsSync(stateFile)) return [];
  const state = readJson(stateFile);
  return Object.values(state.voices || {})
    .filter((record) => record.status === "succeeded" && record.output_path && fs.existsSync(record.output_path))
    .map((record) => ({
      shot_id: record.shot_id,
      input_path: record.output_path,
      delay_ms: shotStartMs.get(record.shot_id) || 0,
    }))
    .sort((a, b) => a.delay_ms - b.delay_ms || a.shot_id.localeCompare(b.shot_id));
}

function buildAudioCommand({ concatList, output, voiceTracks }) {
  const command = [
    "ffmpeg",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatList,
  ];

  for (const track of voiceTracks) {
    command.push("-i", track.input_path);
  }

  if (voiceTracks.length === 0) {
    command.push("-c", "copy", output);
    return command;
  }

  const delayedLabels = voiceTracks.map((track, index) => {
    const label = `voice${index}`;
    const inputIndex = index + 1;
    return {
      label,
      filter: `[${inputIndex}:a]adelay=${track.delay_ms}|${track.delay_ms}[${label}]`,
    };
  });
  const mixInputs = delayedLabels.map((item) => `[${item.label}]`).join("");
  const filter = `${delayedLabels.map((item) => item.filter).join(";")};${mixInputs}amix=inputs=${voiceTracks.length}:normalize=0[aout]`;
  command.push(
    "-filter_complex",
    filter,
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    output,
  );
  return command;
}

export function planCompose({ projectDir }) {
  const clips = resolveClips(projectDir);
  const voiceTracks = resolveVoiceTracks(projectDir);
  const outputDir = path.join(projectDir, "outputs");
  const finalDir = path.join(outputDir, "final");
  ensureDir(finalDir);
  const concatList = path.join(finalDir, "concat_list.txt");
  const output = path.join(finalDir, "final.mp4");
  writeText(concatList, `${clips.map(quoteConcatPath).join("\n")}\n`);
  const command = buildAudioCommand({ concatList, output, voiceTracks });
  return { clips, voice_tracks: voiceTracks, concat_list: concatList, output_path: output, command };
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
