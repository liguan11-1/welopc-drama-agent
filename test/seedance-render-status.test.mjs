import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approveProject } from "../src/approval.mjs";
import { readJson, writeJson } from "../src/files.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { renderBatch, refreshSeedanceStatuses } from "../src/render-state.mjs";

test("render --execute submits one approved shot and keeps key out of state", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  approveProject(projectDir);

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "seedance-task-1", status: "queued" }),
  });

  const result = await renderBatch({
    projectDir,
    batch: 1,
    resolution: "480p",
    execute: true,
    env: { ARK_API_KEY: "secret-key" },
    fetchImpl,
  });

  const state = readJson(path.join(projectDir, "render_state.json"));
  const record = state.videos[result.selected[0]];

  assert.equal(result.submitted.length, 1);
  assert.equal(record.status, "submitted");
  assert.equal(record.provider_task_id, "seedance-task-1");
  assert.equal(JSON.stringify(state).includes("secret-key"), false);
});

test("refreshSeedanceStatuses downloads succeeded clips", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  const taskId = "E01_S001_video_v01";
  writeJson(path.join(projectDir, "render_state.json"), {
    images: {},
    videos: {
      [taskId]: {
        status: "submitted",
        provider: "seedance",
        provider_task_id: "seedance-task-1",
      },
    },
  });

  const fetchImpl = async (url) => {
    if (String(url).includes("/contents/generations/tasks/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "seedance-task-1",
          status: "succeeded",
          content: { video_url: "https://example.test/video.mp4" },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from("mp4 bytes").buffer,
    };
  };

  const result = await refreshSeedanceStatuses({
    projectDir,
    env: { ARK_API_KEY: "secret-key" },
    fetchImpl,
  });

  const state = readJson(path.join(projectDir, "render_state.json"));
  const record = state.videos[taskId];

  assert.equal(result.checked.length, 1);
  assert.equal(record.status, "succeeded");
  assert.ok(record.output_path.endsWith(path.join("outputs", "clips", "E01_S001.mp4")));
  assert.ok(fs.existsSync(record.output_path));
});

test("refreshSeedanceStatuses polls until a submitted task succeeds", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  const taskId = "E01_S001_video_v01";
  writeJson(path.join(projectDir, "render_state.json"), {
    images: {},
    videos: {
      [taskId]: {
        status: "submitted",
        provider: "seedance",
        provider_task_id: "seedance-task-1",
      },
    },
  });

  let queryCount = 0;
  const fetchImpl = async (url) => {
    if (String(url).includes("/contents/generations/tasks/")) {
      queryCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => queryCount === 1
          ? { id: "seedance-task-1", status: "running" }
          : { id: "seedance-task-1", status: "succeeded", content: { video_url: "https://example.test/video.mp4" } },
      };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from("mp4 bytes").buffer,
    };
  };

  await refreshSeedanceStatuses({
    projectDir,
    env: { ARK_API_KEY: "secret-key" },
    fetchImpl,
    poll: true,
    pollAttempts: 2,
    sleep: async () => {},
  });

  const state = readJson(path.join(projectDir, "render_state.json"));
  assert.equal(queryCount, 2);
  assert.equal(state.videos[taskId].status, "succeeded");
});
