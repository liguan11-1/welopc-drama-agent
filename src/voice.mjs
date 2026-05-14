import fs from "node:fs";
import path from "node:path";
import { ensureDir, readJson, readJsonl, writeJson } from "./files.mjs";
import {
  createVolcengineTtsConfig,
  downloadVolcengineTtsAudio,
  queryVolcengineTtsTask,
  submitVolcengineTtsTask,
} from "./providers/volcengine-tts.mjs";

function voiceStatePath(projectDir) {
  return path.join(projectDir, "outputs", "audio", "voice_state.json");
}

function loadVoiceState(projectDir) {
  const file = voiceStatePath(projectDir);
  if (!fs.existsSync(file)) return { provider: "volcengine_tts", voices: {}, updated_at: null };
  return readJson(file);
}

function saveVoiceState(projectDir, state) {
  state.updated_at = new Date().toISOString();
  writeJson(voiceStatePath(projectDir), state);
}

function statusFromTaskStatus(taskStatus) {
  if (taskStatus === 1 || taskStatus === "succeeded" || taskStatus === "success") return "succeeded";
  if (taskStatus === 2 || taskStatus === "failed" || taskStatus === "fail") return "failed";
  return "submitted";
}

function audioUrlFromResponse(body) {
  return body.audio_url || body.url || body.data?.audio_url || body.data?.url || body.result?.audio_url || body.result?.url;
}

export function buildVoiceTasks({ projectDir, env } = {}) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const config = createVolcengineTtsConfig({ env });
  return shots
    .filter((shot) => String(shot.dialogue_or_caption || "").trim())
    .map((shot) => {
      const characterId = shot.characters?.[0] || "protagonist";
      return {
        task_id: `${shot.shot_id}_voice_v01`,
        shot_id: shot.shot_id,
        character_id: characterId,
        text: String(shot.dialogue_or_caption).trim(),
        voice_type: config.voiceTypes[characterId] || config.defaultVoiceType,
        format: config.format,
        output_path: path.join(projectDir, "assets", "audio", "voice", `${shot.shot_id}.${config.format}`),
      };
    });
}

export async function submitVoiceBatch({
  projectDir,
  batch = 3,
  execute = false,
  force = false,
  env,
  fetchImpl,
} = {}) {
  const tasks = buildVoiceTasks({ projectDir, env });
  const state = loadVoiceState(projectDir);
  state.voices ||= {};
  const selected = tasks
    .filter((task) => force || !state.voices[task.task_id]?.provider_task_id)
    .slice(0, Number(batch || 3));
  const submitted = [];

  if (!execute) {
    return {
      dry_run: true,
      selected: selected.map((task) => task.task_id),
      submitted,
      state_file: voiceStatePath(projectDir),
    };
  }

  const config = createVolcengineTtsConfig({ env });
  for (const task of selected) {
    const result = await submitVolcengineTtsTask({
      text: task.text,
      voiceType: task.voice_type,
      config,
      fetchImpl,
    });
    state.voices[task.task_id] = {
      status: "submitted",
      provider: "volcengine_tts",
      provider_task_id: result.provider_task_id,
      shot_id: task.shot_id,
      character_id: task.character_id,
      voice_type: task.voice_type,
      text: task.text,
      output_path: task.output_path,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    submitted.push(task.task_id);
  }

  saveVoiceState(projectDir, state);
  return {
    dry_run: false,
    selected: selected.map((task) => task.task_id),
    submitted,
    state_file: voiceStatePath(projectDir),
  };
}

export async function refreshVoiceStatuses({
  projectDir,
  env,
  fetchImpl,
  poll = false,
  pollAttempts = 1,
  pollIntervalSec = 20,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const state = loadVoiceState(projectDir);
  state.voices ||= {};
  const config = createVolcengineTtsConfig({ env });
  const checked = [];
  const attempts = poll ? Math.max(1, Number(pollAttempts || 1)) : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const [taskId, record] of Object.entries(state.voices)) {
      if (record.provider !== "volcengine_tts" || !record.provider_task_id) continue;
      if (record.status === "succeeded" && record.output_path && fs.existsSync(record.output_path)) continue;
      if (record.status === "failed") continue;

      const body = await queryVolcengineTtsTask({
        providerTaskId: record.provider_task_id,
        config,
        fetchImpl,
      });
      record.status = statusFromTaskStatus(body.task_status ?? body.status);
      record.updated_at = new Date().toISOString();

      const audioUrl = audioUrlFromResponse(body);
      if (record.status === "succeeded" && audioUrl) {
        ensureDir(path.dirname(record.output_path));
        await downloadVolcengineTtsAudio({ url: audioUrl, outputPath: record.output_path, fetchImpl });
        record.output_url = audioUrl;
      }

      checked.push({
        task_id: taskId,
        provider_task_id: record.provider_task_id,
        status: record.status,
      });
    }

    saveVoiceState(projectDir, state);
    const unfinished = Object.values(state.voices).some((record) => (
      record.provider === "volcengine_tts"
      && record.provider_task_id
      && record.status !== "succeeded"
      && record.status !== "failed"
    ));
    if (!poll || !unfinished || attempt === attempts) break;
    await sleep(Number(pollIntervalSec || 20) * 1000);
  }

  return {
    checked,
    state_file: voiceStatePath(projectDir),
  };
}
