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

function normalizeAudioTrack(track, kind) {
  const inputPath = track.input_path || track.asset_path || track.output_path;
  if (!inputPath || !fs.existsSync(inputPath)) return null;
  return {
    kind,
    id: track.cue_id || track.asset_id || track.shot_id || inputPath,
    input_path: inputPath,
    delay_ms: Math.round(Number(track.delay_ms ?? (Number(track.start_sec || 0) * 1000))),
    volume: Number(track.volume ?? 1),
  };
}

function resolveSoundMixTracks(projectDir) {
  const stateFile = path.join(projectDir, "outputs", "audio", "mix_plan.json");
  const tracks = [];
  if (fs.existsSync(stateFile)) {
    const state = readJson(stateFile);
    for (const item of state.bgm_tracks || []) {
      const track = normalizeAudioTrack(item, "bgm");
      if (track) tracks.push(track);
    }
    for (const item of state.sfx_tracks || []) {
      const track = normalizeAudioTrack(item, "sfx");
      if (track) tracks.push(track);
    }
  }

  const defaultBgm = path.join(projectDir, "assets", "audio", "bgm.mp3");
  if (fs.existsSync(defaultBgm) && !tracks.some((track) => path.resolve(track.input_path) === path.resolve(defaultBgm))) {
    tracks.unshift({ kind: "bgm", id: "main_bgm", input_path: defaultBgm, delay_ms: 0, volume: 0.45 });
  }
  return tracks;
}

function buildAudioCommand({ concatList, output, audioTracks }) {
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

  for (const track of audioTracks) {
    command.push("-i", track.input_path);
  }

  if (audioTracks.length === 0) {
    command.push("-c", "copy", output);
    return command;
  }

  const delayedLabels = audioTracks.map((track, index) => {
    const label = `audio${index}`;
    const inputIndex = index + 1;
    return {
      label,
      filter: `[${inputIndex}:a]adelay=${track.delay_ms}|${track.delay_ms},volume=${track.volume}[${label}]`,
    };
  });
  const mixInputs = delayedLabels.map((item) => `[${item.label}]`).join("");
  const filter = `${delayedLabels.map((item) => item.filter).join(";")};${mixInputs}amix=inputs=${audioTracks.length}:normalize=0[aout]`;
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
  const audioTracks = [...resolveSoundMixTracks(projectDir), ...voiceTracks.map((track) => ({
    kind: "voice",
    id: track.shot_id,
    input_path: track.input_path,
    delay_ms: track.delay_ms,
    volume: 1,
  }))];
  const outputDir = path.join(projectDir, "outputs");
  const finalDir = path.join(outputDir, "final");
  ensureDir(finalDir);
  const concatList = path.join(finalDir, "concat_list.txt");
  const output = path.join(finalDir, "final.mp4");
  writeText(concatList, `${clips.map(quoteConcatPath).join("\n")}\n`);
  const command = buildAudioCommand({ concatList, output, audioTracks });
  return { clips, voice_tracks: voiceTracks, audio_tracks: audioTracks, concat_list: concatList, output_path: output, command };
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
