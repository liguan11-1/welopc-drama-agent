import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approveProject } from "../src/approval.mjs";
import { readJson, writeJson } from "../src/files.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { renderBatch, renderPackedBatch, refreshSeedanceStatuses } from "../src/render-state.mjs";

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgaGAAAAK0AKGKCx1bAAAAAElFTkSuQmCC";

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
    allowPlaceholder: true,
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

test("render --execute refuses paid video submission when Codex video reference is missing", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  approveProject(projectDir);

  let calledProvider = false;
  const fetchImpl = async () => {
    calledProvider = true;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "seedance-task-1", status: "queued" }),
    };
  };

  await assert.rejects(
    () => renderBatch({
      projectDir,
      batch: 1,
      resolution: "480p",
      execute: true,
      env: { ARK_API_KEY: "secret-key" },
      fetchImpl,
    }),
    /Codex video reference image is required/,
  );
  assert.equal(calledProvider, false);
});

test("render --execute refuses local dry-run placeholder keyframes unless explicitly allowed", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "placeholder cost guard", outDir: projectDir });
  approveProject(projectDir);

  await renderBatch({ projectDir, batch: 1, resolution: "480p" });
  assert.ok(fs.existsSync(path.join(projectDir, "assets", "keyframes", "E01_S001.png")));

  let calledProvider = false;
  const fetchImpl = async () => {
    calledProvider = true;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "seedance-task-1", status: "queued" }),
    };
  };

  await assert.rejects(
    () => renderBatch({
      projectDir,
      batch: 1,
      resolution: "480p",
      execute: true,
      force: true,
      env: { ARK_API_KEY: "secret-key" },
      fetchImpl,
    }),
    /Codex video reference image is required/,
  );
  assert.equal(calledProvider, false);
});

test("render --execute uses Codex video reference image when available", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  approveProject(projectDir);

  const referenceImage = path.join(projectDir, "assets", "reference_images", "video_refs", "E01_S001.png");
  fs.mkdirSync(path.dirname(referenceImage), { recursive: true });
  fs.writeFileSync(referenceImage, Buffer.from(TINY_PNG, "base64"));

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

  assert.equal(record.keyframe_path, referenceImage);
  assert.equal(state.images.E01_S001_video_reference_frame.provider, "codex_imagegen");
  assert.equal(state.images.E01_S001_video_reference_frame.output_path, referenceImage);
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
  assert.equal(record.output_url, undefined);
  assert.equal(record.last_frame_url, undefined);
  assert.equal(JSON.stringify(state).includes("X-Tos-Signature"), false);
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

test("renderPackedBatch submits one ready packed node with ordered references", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "packed node", outDir: projectDir });
  const refsDir = path.join(projectDir, "assets", "reference_images", "video_refs");
  fs.mkdirSync(refsDir, { recursive: true });
  for (const shotId of ["E01_S001", "E01_S002"]) {
    fs.writeFileSync(path.join(refsDir, `${shotId}.png`), Buffer.from(TINY_PNG, "base64"));
  }
  const packingFile = path.join(projectDir, "video_node_packing_plan.jsonl");
  fs.writeFileSync(packingFile, `${JSON.stringify({
    pack_id: "E01_PACK_001",
    provider: "seedance",
    model: "doubao-seedance-2-0-fast-260128",
    provider_duration_sec: 5,
    target_duration_sec: 3.3,
    shot_ids: ["E01_S001", "E01_S002"],
    reference_frames: [
      "assets/reference_images/video_refs/E01_S001.png",
      "assets/reference_images/video_refs/E01_S002.png",
    ],
    visual_beats: [
      { shot_id: "E01_S001", start_sec: 0, end_sec: 1.6, beat: "look up", camera_motion: "locked", visual_action: "sky" },
      { shot_id: "E01_S002", start_sec: 1.6, end_sec: 3.3, beat: "draw", camera_motion: "push", visual_action: "wall marks" },
    ],
  })}\n`);
  approveProject(projectDir);

  let capturedBody;
  const fetchImpl = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "seedance-packed-task-1", status: "queued" }),
    };
  };

  const result = await renderPackedBatch({
    projectDir,
    batch: 1,
    resolution: "480p",
    execute: true,
    env: { ARK_API_KEY: "secret-key" },
    fetchImpl,
  });
  const state = readJson(path.join(projectDir, "render_state.json"));
  const record = state.videos.E01_PACK_001_video_v01;
  const imageInputs = capturedBody.content.filter((item) => item.type === "image_url");

  assert.deepEqual(result.selected_packs, ["E01_PACK_001"]);
  assert.deepEqual(result.submitted, ["E01_PACK_001_video_v01"]);
  assert.equal(record.pack_id, "E01_PACK_001");
  assert.equal(record.output_kind, "packed_video_node");
  assert.equal(record.target_duration_sec, 3.3);
  assert.equal(record.provider_duration_sec, 5);
  assert.equal(record.provider_task_id, "seedance-packed-task-1");
  assert.equal(record.reference_frame_paths.length, 2);
  assert.equal(imageInputs.length, 2);
  assert.equal(JSON.stringify(state).includes("secret-key"), false);
});

test("refreshSeedanceStatuses downloads packed node clips by pack id", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "packed status", outDir: projectDir });
  const taskId = "E01_PACK_001_video_v01";
  writeJson(path.join(projectDir, "render_state.json"), {
    images: {},
    videos: {
      [taskId]: {
        status: "submitted",
        provider: "seedance",
        output_kind: "packed_video_node",
        pack_id: "E01_PACK_001",
        provider_task_id: "seedance-packed-task-1",
      },
    },
  });

  const fetchImpl = async (url) => {
    if (String(url).includes("/contents/generations/tasks/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "seedance-packed-task-1",
          status: "succeeded",
          content: { video_url: "https://example.test/packed.mp4" },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from("packed mp4 bytes").buffer,
    };
  };

  await refreshSeedanceStatuses({
    projectDir,
    env: { ARK_API_KEY: "secret-key" },
    fetchImpl,
  });

  const state = readJson(path.join(projectDir, "render_state.json"));
  const record = state.videos[taskId];
  assert.equal(record.status, "succeeded");
  assert.ok(record.output_path.endsWith(path.join("outputs", "clips", "E01_PACK_001.mp4")));
  assert.ok(fs.existsSync(record.output_path));
});
