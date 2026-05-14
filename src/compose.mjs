import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureDir, readJson, readJsonl, writeJson, writeText } from "./files.mjs";

function quoteConcatPath(file) {
  return `file '${path.resolve(file).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

function resolveClipPlan(projectDir) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const stateFile = path.join(projectDir, "render_state.json");
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { videos: {} };
  const clipPlan = [];
  const missing = [];

  for (const shot of shots) {
    const taskId = `${shot.shot_id}_video_v01`;
    const record = state.videos?.[taskId] || {};
    const clipPath = record.output_path || path.join(projectDir, "outputs", "clips", `${shot.shot_id}.mp4`);
    if (clipPath && fs.existsSync(clipPath)) {
      clipPlan.push({
        shot_id: shot.shot_id,
        task_id: taskId,
        input_path: clipPath,
        target_duration_sec: Number(shot.duration_sec || record.target_duration_sec || 5),
        provider_duration_sec: record.provider_duration_sec || null,
        time_range: shot.time_range,
      });
    } else {
      missing.push(taskId);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Cannot compose: missing clips for ${missing.join(", ")}`);
  }
  return clipPlan;
}

function startMsFromTimeRange(timeRange) {
  const match = String(timeRange || "").match(/^(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 1000) : 0;
}

function endMsForShot(shot) {
  const explicitEnd = String(shot.time_range || "").match(/-(\d+(?:\.\d+)?)s?$/);
  if (explicitEnd) return Math.round(Number(explicitEnd[1]) * 1000);
  return startMsFromTimeRange(shot.time_range) + Math.round(Number(shot.duration_sec || 0) * 1000);
}

function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hour = Math.floor(totalMin / 60);
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function normalizeSubtitle(row, index) {
  const startSec = Number(row.start_sec ?? 0);
  const endSec = Number(row.end_sec ?? (startSec + Number(row.duration_sec || 0)));
  const text = String(row.text || row.subtitle_text || row.dialogue_or_caption || "").trim();
  if (!text) return null;
  return {
    subtitle_id: row.subtitle_id || `subtitle_${String(index + 1).padStart(3, "0")}`,
    source: row.source || "subtitle_timeline",
    type: row.type || "information",
    start_sec: startSec,
    end_sec: endSec,
    duration_sec: Math.max(0, Number((endSec - startSec).toFixed(3))),
    anchor_shots: row.anchor_shots || (row.shot_id ? [row.shot_id] : []),
    text,
    display: row.display || "bottom_center_safe",
    voice_strategy: row.voice_strategy || "no_tts",
    priority: Number(row.priority || index + 1),
  };
}

function resolveSubtitleTracks(projectDir) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const dialogueTracks = shots
    .filter((shot) => String(shot.dialogue_or_caption || "").trim())
    .map((shot, index) => normalizeSubtitle({
      subtitle_id: `${shot.shot_id}_caption`,
      source: "shots",
      type: "dialogue_or_caption",
      start_sec: startMsFromTimeRange(shot.time_range) / 1000,
      end_sec: endMsForShot(shot) / 1000,
      shot_id: shot.shot_id,
      text: shot.dialogue_or_caption,
      display: "bottom_center_safe",
      voice_strategy: "match_voice_or_subtitle_only",
      priority: index + 1,
    }, index));

  const timelineFile = path.join(projectDir, "subtitle_timeline.jsonl");
  const informationTracks = fs.existsSync(timelineFile)
    ? readJsonl(timelineFile).map((row, index) => normalizeSubtitle(row, dialogueTracks.length + index))
    : [];

  return [...dialogueTracks, ...informationTracks]
    .filter(Boolean)
    .sort((a, b) => a.start_sec - b.start_sec || a.end_sec - b.end_sec || a.priority - b.priority);
}

function writeSubtitleSrt(finalDir, subtitleTracks) {
  if (subtitleTracks.length === 0) return null;
  const subtitleFile = path.join(finalDir, "subtitles.srt");
  const body = subtitleTracks
    .map((track, index) => [
      String(index + 1),
      `${formatSrtTime(track.start_sec)} --> ${formatSrtTime(track.end_sec)}`,
      track.text,
      "",
    ].join("\n"))
    .join("\n");
  writeText(subtitleFile, body);
  return subtitleFile;
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

function escapeSubtitleFilterPath(file) {
  return path.resolve(file).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function formatFilterNumber(value) {
  return Number(value || 0).toFixed(3).replace(/\.?0+$/, "");
}

function buildAudioLayerPlan(audioTracks) {
  const baseLayers = [
    {
      layer_id: "L0_video",
      source: "generated_video_clips",
      policy: "visual_only_ignore_provider_audio",
      mix_role: "picture_lock",
      priority: 0,
    },
    {
      layer_id: "L5_subtitles",
      source: "shots.jsonl + subtitle_timeline.jsonl",
      policy: "visual_text_only",
      mix_role: "caption_information",
      priority: 90,
    },
  ];
  const audioLayers = audioTracks.map((track) => ({
    layer_id: `A_${track.kind}_${track.id}`,
    source: track.input_path,
    kind: track.kind,
    delay_ms: track.delay_ms,
    volume: track.volume,
    mix_role: track.kind === "voice" ? "foreground_dialogue" : track.kind === "bgm" ? "music_bed" : "sound_effect",
    priority: track.kind === "voice" ? 100 : track.kind === "sfx" ? 70 : 30,
  }));
  return [...baseLayers, ...audioLayers];
}

function buildComposeCommand({ clipPlan, output, audioTracks, subtitleFile }) {
  const command = ["ffmpeg", "-y"];

  for (const clip of clipPlan) {
    command.push("-i", clip.input_path);
  }

  for (const track of audioTracks) {
    command.push("-i", track.input_path);
  }

  const videoFilters = clipPlan.map((clip, index) => (
    `[${index}:v:0]trim=duration=${formatFilterNumber(clip.target_duration_sec)},setpts=PTS-STARTPTS[v${index}]`
  ));
  videoFilters.push(`${clipPlan.map((_, index) => `[v${index}]`).join("")}concat=n=${clipPlan.length}:v=1:a=0[vbase]`);
  videoFilters.push(subtitleFile
    ? `[vbase]subtitles='${escapeSubtitleFilterPath(subtitleFile)}'[vout]`
    : "[vbase]null[vout]");

  const delayedLabels = audioTracks.map((track, index) => {
    const label = `audio${index}`;
    const inputIndex = clipPlan.length + index;
    return {
      label,
      filter: `[${inputIndex}:a]adelay=${track.delay_ms}|${track.delay_ms},volume=${track.volume}[${label}]`,
    };
  });
  const audioFilters = delayedLabels.map((item) => item.filter);
  if (audioTracks.length > 0) {
    const mixInputs = delayedLabels.map((item) => `[${item.label}]`).join("");
    audioFilters.push(`${mixInputs}amix=inputs=${audioTracks.length}:normalize=0[aout]`);
  }

  command.push(
    "-filter_complex",
    [...videoFilters, ...audioFilters].join(";"),
    "-map",
    "[vout]",
  );
  if (audioTracks.length > 0) {
    command.push("-map", "[aout]", "-c:v", "libx264", "-c:a", "aac", "-shortest", output);
  } else {
    command.push("-an", "-c:v", "libx264", output);
  }
  return command;
}

export function planCompose({ projectDir }) {
  const clipPlan = resolveClipPlan(projectDir);
  const clips = clipPlan.map((clip) => clip.input_path);
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
  const subtitleTracks = resolveSubtitleTracks(projectDir);
  const subtitleFile = writeSubtitleSrt(finalDir, subtitleTracks);
  writeText(concatList, `${clips.map(quoteConcatPath).join("\n")}\n`);
  const command = buildComposeCommand({ clipPlan, output, audioTracks, subtitleFile });
  return {
    clips,
    clip_plan: clipPlan,
    voice_tracks: voiceTracks,
    audio_tracks: audioTracks,
    audio_layer_plan: buildAudioLayerPlan(audioTracks),
    source_audio_policy: "ignore_provider_audio",
    subtitle_tracks: subtitleTracks,
    subtitle_file: subtitleFile,
    concat_list: concatList,
    output_path: output,
    command,
  };
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
