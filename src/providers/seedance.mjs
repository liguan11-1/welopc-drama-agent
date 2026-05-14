import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "../files.mjs";
import { loadLocalEnv } from "../env.mjs";

export const DEFAULT_SEEDANCE_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const DEFAULT_SEEDANCE_MODEL = "doubao-seedance-2-0-fast-260128";
export const SEEDANCE_IMAGE_TO_VIDEO_DURATION_SEC = 5;

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
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

function imageDataUrl(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

function normalizeImageToVideoDuration() {
  return SEEDANCE_IMAGE_TO_VIDEO_DURATION_SEC;
}

export function createSeedanceConfig({ env, cwd = process.cwd() } = {}) {
  const resolvedEnv = env || loadLocalEnv({ cwd }).env;
  const apiKey = resolvedEnv.ARK_API_KEY || resolvedEnv.VOLCENGINE_ARK_API_KEY;
  if (!apiKey) {
    throw new Error("ARK_API_KEY is missing. Put it in .env.local or set it in the shell.");
  }

  return {
    apiKey,
    baseUrl: resolvedEnv.ARK_VIDEO_BASE_URL || DEFAULT_SEEDANCE_BASE_URL,
    model: resolvedEnv.ARK_VIDEO_MODEL || resolvedEnv.SEEDANCE_MODEL || DEFAULT_SEEDANCE_MODEL,
    resolution: resolvedEnv.VIDEO_RESOLUTION || "480p",
    ratio: resolvedEnv.VIDEO_RATIO || "9:16",
    generateAudio: boolValue(resolvedEnv.VIDEO_GENERATE_AUDIO, false),
  };
}

export function buildSeedanceRequest({
  prompt,
  keyframePath,
  durationSec = 5,
  config,
  model,
  resolution,
  ratio,
  generateAudio,
}) {
  const content = [{ type: "text", text: prompt }];
  if (keyframePath) {
    content.push({
      type: "image_url",
      image_url: {
        url: imageDataUrl(keyframePath),
        role: "first_frame",
      },
    });
  }

  return {
    model: model || config.model,
    content,
    resolution: resolution || config.resolution,
    ratio: ratio || config.ratio,
    duration: normalizeImageToVideoDuration(durationSec),
    generate_audio: generateAudio ?? config.generateAudio,
    watermark: false,
    return_last_frame: true,
  };
}

export async function submitSeedanceVideoTask({
  prompt,
  keyframePath,
  durationSec = 5,
  model,
  resolution,
  ratio,
  config,
  env,
  cwd,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const resolvedConfig = config || createSeedanceConfig({ env, cwd });
  const request = buildSeedanceRequest({
    prompt,
    keyframePath,
    durationSec,
    config: resolvedConfig,
    model,
    resolution,
    ratio,
  });
  const response = await fetchImpl(`${resolvedConfig.baseUrl.replace(/\/$/, "")}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  await assertOk(response, "Seedance task submit");
  const body = await parseJsonResponse(response);
  if (!body.id) throw new Error(`Seedance did not return a task id: ${JSON.stringify(body)}`);
  return {
    provider_task_id: body.id,
    status: body.status || "submitted",
    model: request.model,
    resolution: request.resolution,
    ratio: request.ratio,
    duration: request.duration,
  };
}

export async function querySeedanceVideoTask({
  providerTaskId,
  config,
  env,
  cwd,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const resolvedConfig = config || createSeedanceConfig({ env, cwd });
  const response = await fetchImpl(`${resolvedConfig.baseUrl.replace(/\/$/, "")}/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${resolvedConfig.apiKey}` },
  });
  await assertOk(response, "Seedance task query");
  return parseJsonResponse(response);
}

export async function downloadSeedanceFile({
  url,
  outputPath,
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) throw new Error("fetch is not available in this Node.js runtime.");
  const response = await fetchImpl(url);
  await assertOk(response, "Seedance file download");
  const bytes = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, bytes);
  return outputPath;
}
