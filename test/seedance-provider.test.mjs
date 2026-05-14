import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSeedanceConfig,
  submitSeedanceVideoTask,
} from "../src/providers/seedance.mjs";

test("createSeedanceConfig reads key and video defaults from env", () => {
  const config = createSeedanceConfig({
    env: {
      ARK_API_KEY: "test-key",
      ARK_VIDEO_MODEL: "doubao-seedance-2-0-fast-260128",
      VIDEO_RESOLUTION: "480p",
      VIDEO_RATIO: "9:16",
      VIDEO_GENERATE_AUDIO: "false",
    },
  });

  assert.equal(config.apiKey, "test-key");
  assert.equal(config.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(config.resolution, "480p");
  assert.equal(config.ratio, "9:16");
  assert.equal(config.generateAudio, false);
});

test("submitSeedanceVideoTask sends bearer auth and image-to-video request", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "welopc-seedance-"));
  const keyframe = path.join(root, "keyframe.png");
  fs.writeFileSync(keyframe, Buffer.from("png bytes"));
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "task-123", status: "queued" }),
    };
  };

  const result = await submitSeedanceVideoTask({
    prompt: "保持角色一致，慢速推进",
    keyframePath: keyframe,
    durationSec: 5,
    config: createSeedanceConfig({ env: { ARK_API_KEY: "secret-key" } }),
    fetchImpl,
  });

  assert.equal(result.provider_task_id, "task-123");
  assert.equal(captured.url, "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks");
  assert.equal(captured.options.headers.Authorization, "Bearer secret-key");
  assert.equal(captured.body.model, "doubao-seedance-2-0-fast-260128");
  assert.equal(captured.body.resolution, "480p");
  assert.equal(captured.body.ratio, "9:16");
  assert.equal(captured.body.duration, 5);
  assert.equal(captured.body.generate_audio, false);
  assert.equal(captured.body.content[0].type, "text");
  assert.equal(captured.body.content[1].image_url.role, "first_frame");
  assert.match(captured.body.content[1].image_url.url, /^data:image\/png;base64,/);
});
