import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildVoiceTasks,
  refreshVoiceStatuses,
  submitVoiceBatch,
} from "../src/voice.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { readJson } from "../src/files.mjs";

test("buildVoiceTasks creates one TTS task per voiced shot", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const tasks = buildVoiceTasks({
    projectDir,
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "token-1",
      VOLCENGINE_TTS_PROTAGONIST_VOICE_TYPE: "BV002_streaming",
    },
  });

  assert.equal(tasks.length, 9);
  assert.equal(tasks[0].task_id, "E01_S001_voice_v01");
  assert.equal(tasks[0].character_id, "protagonist");
  assert.equal(tasks[0].voice_type, "BV002_streaming");
  assert.ok(tasks[0].text.length > 0);
});

test("submitVoiceBatch dry run does not call provider", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  let called = false;

  const result = await submitVoiceBatch({
    projectDir,
    batch: 2,
    execute: false,
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "token-1",
    },
    fetchImpl: async () => {
      called = true;
    },
  });

  assert.equal(called, false);
  assert.equal(result.selected.length, 2);
  assert.equal(result.submitted.length, 0);
});

test("submitVoiceBatch executes Volcengine TTS and keeps token out of state", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const result = await submitVoiceBatch({
    projectDir,
    batch: 1,
    execute: true,
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "secret-token",
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ task_id: "tts-task-1", task_status: 0, text_length: 6 }),
    }),
  });

  const state = readJson(path.join(projectDir, "outputs", "audio", "voice_state.json"));
  const record = state.voices[result.selected[0]];

  assert.equal(result.submitted.length, 1);
  assert.equal(record.status, "submitted");
  assert.equal(record.provider_task_id, "tts-task-1");
  assert.equal(JSON.stringify(state).includes("secret-token"), false);
});

test("refreshVoiceStatuses downloads completed voice clips", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  await submitVoiceBatch({
    projectDir,
    batch: 1,
    execute: true,
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "secret-token",
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ task_id: "tts-task-1", task_status: 0, text_length: 6 }),
    }),
  });

  const result = await refreshVoiceStatuses({
    projectDir,
    env: {
      VOLCENGINE_TTS_APPID: "appid-1",
      VOLCENGINE_TTS_ACCESS_TOKEN: "secret-token",
    },
    fetchImpl: async (url) => {
      if (String(url).includes("tts_async/query")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ task_id: "tts-task-1", task_status: 1, audio_url: "https://example.test/voice.mp3" }),
        };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("voice bytes").buffer,
      };
    },
  });

  const state = readJson(path.join(projectDir, "outputs", "audio", "voice_state.json"));
  const record = state.voices[result.checked[0].task_id];

  assert.equal(record.status, "succeeded");
  assert.ok(record.output_path.endsWith(path.join("assets", "audio", "voice", "E01_S001.mp3")));
  assert.ok(fs.existsSync(record.output_path));
});
