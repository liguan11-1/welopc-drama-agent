import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadLocalEnv } from "../env.mjs";
import { ensureDir } from "../files.mjs";

export const DEFAULT_VOLCENGINE_TTS_BASE_URL = "https://openspeech.bytedance.com/api/v1";
export const DEFAULT_VOLCENGINE_TTS_RESOURCE_ID = "volc.tts_async.default";

function numberValue(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonResponse(response) {
  return response.json ? response.json() : Promise.resolve({});
}

async function assertOk(response, context) {
  if (response.ok) return;
  let body = "";
  try {
    body = response.text ? await response.text() : JSON.stringify(await parseJsonResponse(response));
  } catch {
    body = "";
  }
  throw new Error(`${context} failed: HTTP ${response.status}${body ? ` ${body}` : ""}`);
}

export function createVolcengineTtsConfig({ env, cwd = process.cwd() } = {}) {
  const resolvedEnv = env || loadLocalEnv({ cwd }).env;
  const appid = resolvedEnv.VOLCENGINE_TTS_APPID || resolvedEnv.TTS_APPID;
  const accessToken = resolvedEnv.VOLCENGINE_TTS_ACCESS_TOKEN || resolvedEnv.TTS_ACCESS_TOKEN;
  if (!appid) throw new Error("VOLCENGINE_TTS_APPID is missing. Put it in .env.local or set it in the shell.");
  if (!accessToken) throw new Error("VOLCENGINE_TTS_ACCESS_TOKEN is missing. Put it in .env.local or set it in the shell.");

  return {
    appid,
    accessToken,
    baseUrl: resolvedEnv.VOLCENGINE_TTS_BASE_URL || DEFAULT_VOLCENGINE_TTS_BASE_URL,
    resourceId: resolvedEnv.VOLCENGINE_TTS_RESOURCE_ID || DEFAULT_VOLCENGINE_TTS_RESOURCE_ID,
    defaultVoiceType: resolvedEnv.VOLCENGINE_TTS_DEFAULT_VOICE_TYPE || "BV001_streaming",
    voiceTypes: {
      protagonist: resolvedEnv.VOLCENGINE_TTS_PROTAGONIST_VOICE_TYPE || resolvedEnv.VOLCENGINE_TTS_DEFAULT_VOICE_TYPE || "BV001_streaming",
      executor: resolvedEnv.VOLCENGINE_TTS_EXECUTOR_VOICE_TYPE || resolvedEnv.VOLCENGINE_TTS_DEFAULT_VOICE_TYPE || "BV001_streaming",
    },
    format: resolvedEnv.VOLCENGINE_TTS_FORMAT || "mp3",
    sampleRate: numberValue(resolvedEnv.VOLCENGINE_TTS_SAMPLE_RATE, 24000),
    speed: numberValue(resolvedEnv.VOLCENGINE_TTS_SPEED, 1),
    volume: numberValue(resolvedEnv.VOLCENGINE_TTS_VOLUME, 1),
    pitch: numberValue(resolvedEnv.VOLCENGINE_TTS_PITCH, 1),
  };
}

function ttsHeaders(config) {
  return {
    "Content-Type": "application/json",
    "Resource-Id": config.resourceId,
    Authorization: `Bearer; ${config.accessToken}`,
  };
}

export async function submitVolcengineTtsTask({
  text,
  voiceType,
  reqid = randomUUID(),
  config,
  env,
  cwd,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const resolvedConfig = config || createVolcengineTtsConfig({ env, cwd });
  const body = {
    appid: resolvedConfig.appid,
    reqid,
    text,
    format: resolvedConfig.format,
    voice_type: voiceType || resolvedConfig.defaultVoiceType,
    sample_rate: resolvedConfig.sampleRate,
    speed: resolvedConfig.speed,
    volume: resolvedConfig.volume,
    pitch: resolvedConfig.pitch,
  };

  const response = await fetchImpl(`${resolvedConfig.baseUrl.replace(/\/$/, "")}/tts_async/submit`, {
    method: "POST",
    headers: ttsHeaders(resolvedConfig),
    body: JSON.stringify(body),
  });
  await assertOk(response, "Volcengine TTS submit");
  const responseBody = await parseJsonResponse(response);
  const taskId = responseBody.task_id || responseBody.id;
  if (!taskId) throw new Error(`Volcengine TTS did not return a task id: ${JSON.stringify(responseBody)}`);
  return {
    provider_task_id: taskId,
    status: responseBody.task_status ?? responseBody.status ?? "submitted",
    text_length: responseBody.text_length ?? text.length,
  };
}

export async function queryVolcengineTtsTask({
  providerTaskId,
  config,
  env,
  cwd,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const resolvedConfig = config || createVolcengineTtsConfig({ env, cwd });
  const query = new URLSearchParams({
    appid: resolvedConfig.appid,
    task_id: providerTaskId,
  });
  const response = await fetchImpl(`${resolvedConfig.baseUrl.replace(/\/$/, "")}/tts_async/query?${query.toString()}`, {
    method: "GET",
    headers: {
      "Resource-Id": resolvedConfig.resourceId,
      Authorization: `Bearer; ${resolvedConfig.accessToken}`,
    },
  });
  await assertOk(response, "Volcengine TTS query");
  return parseJsonResponse(response);
}

export async function downloadVolcengineTtsAudio({
  url,
  outputPath,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const response = await fetchImpl(url);
  await assertOk(response, "Volcengine TTS audio download");
  const bytes = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, bytes);
  return outputPath;
}
