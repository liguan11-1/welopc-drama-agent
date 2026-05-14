import test from "node:test";
import assert from "node:assert/strict";
import {
  createVolcengineTtsConfig,
  queryVolcengineTtsTask,
  submitVolcengineTtsTask,
} from "../src/providers/volcengine-tts.mjs";

test("createVolcengineTtsConfig reads appid token and voice defaults", () => {
  const config = createVolcengineTtsConfig({
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "token-1",
      VOLCENGINE_TTS_DEFAULT_VOICE_TYPE: "BV001_streaming",
      VOLCENGINE_TTS_PROTAGONIST_VOICE_TYPE: "BV002_streaming",
    },
  });

  assert.equal(config.appid, "appid-1");
  assert.equal(config.accessToken, "token-1");
  assert.equal(config.resourceId, "volc.tts_async.default");
  assert.equal(config.defaultVoiceType, "BV001_streaming");
  assert.equal(config.voiceTypes.protagonist, "BV002_streaming");
});

test("submitVolcengineTtsTask sends async TTS request with bearer token", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ task_id: "tts-task-1", task_status: 0, text_length: 4 }),
    };
  };

  const result = await submitVolcengineTtsTask({
    text: "这次，我不演了。",
    voiceType: "BV002_streaming",
    reqid: "12345678-1234-4234-8234-123456789012",
    config: createVolcengineTtsConfig({
      env: {
        VOLCENGINE_TTS_APPID: "appid-1",
        VOLCENGINE_TTS_ACCESS_TOKEN: "token-1",
      },
    }),
    fetchImpl,
  });

  assert.equal(result.provider_task_id, "tts-task-1");
  assert.equal(captured.url, "https://openspeech.bytedance.com/api/v1/tts_async/submit");
  assert.equal(captured.options.headers["Resource-Id"], "volc.tts_async.default");
  assert.equal(captured.options.headers.Authorization, "Bearer; token-1");
  assert.equal(captured.body.appid, "appid-1");
  assert.equal(captured.body.reqid, "12345678-1234-4234-8234-123456789012");
  assert.equal(captured.body.format, "mp3");
  assert.equal(captured.body.voice_type, "BV002_streaming");
});

test("queryVolcengineTtsTask calls async query endpoint", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ task_id: "tts-task-1", task_status: 1, audio_url: "https://example.test/a.mp3" }),
    };
  };

  const result = await queryVolcengineTtsTask({
    providerTaskId: "tts-task-1",
    config: createVolcengineTtsConfig({
      env: {
        VOLCENGINE_TTS_APPID: "appid-1",
        VOLCENGINE_TTS_ACCESS_TOKEN: "token-1",
      },
    }),
    fetchImpl,
  });

  assert.equal(result.task_status, 1);
  assert.match(captured.url, /tts_async\/query\?appid=appid-1&task_id=tts-task-1/);
  assert.equal(captured.options.headers.Authorization, "Bearer; token-1");
});
