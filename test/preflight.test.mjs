import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approveProject } from "../src/approval.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { preflightProject } from "../src/preflight.mjs";

test("preflight blocks paid rendering when approval is stale", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  approveProject(projectDir);
  fs.appendFileSync(path.join(projectDir, "audio_plan.md"), "\n新增字幕策略。\n", "utf8");

  const report = preflightProject({ projectDir });

  assert.equal(report.approval.status, "stale");
  assert.equal(report.cost_guard.can_submit_paid_video, false);
  assert.equal(report.next_action.action, "approve");
  assert.match(report.next_action.command, /approve --project/);
});

test("preflight recommends the first ready Seedance test when approved", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  const videoRef = path.join(projectDir, "assets", "reference_images", "video_refs", "E01_S001.png");
  fs.mkdirSync(path.dirname(videoRef), { recursive: true });
  fs.writeFileSync(videoRef, Buffer.from("png"));
  approveProject(projectDir);

  const report = preflightProject({ projectDir });

  assert.equal(report.approval.status, "current");
  assert.equal(report.cost_guard.can_submit_paid_video, true);
  assert.equal(report.video.ready_for_seedance[0].task_id, "E01_S001_video_v01");
  assert.equal(report.next_action.action, "render_paid_test");
  assert.match(report.next_action.command, /render --project/);
  assert.match(report.next_action.command, /--batch 1/);
  assert.match(report.next_action.command, /--execute/);
});

test("preflight reports missing references for packed video nodes", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "packed video refs", outDir: projectDir });
  fs.writeFileSync(
    path.join(projectDir, "video_node_packing_plan.jsonl"),
    `${JSON.stringify({
      pack_id: "E01_PACK_001",
      target_duration_sec: 3.2,
      visual_beats: [
        { shot_id: "E01_S001", image_ref: "assets/reference_images/video_refs/E01_S001.png" },
        { shot_id: "E01_S002", image_ref: "assets/reference_images/video_refs/E01_S002.png" },
      ],
    })}\n`,
    "utf8",
  );
  const videoRef = path.join(projectDir, "assets", "reference_images", "video_refs", "E01_S001.png");
  fs.mkdirSync(path.dirname(videoRef), { recursive: true });
  fs.writeFileSync(videoRef, Buffer.from("png"));
  approveProject(projectDir);

  const report = preflightProject({ projectDir });

  assert.equal(report.packed_video.total, 1);
  assert.equal(report.packed_video.ready_for_seedance.length, 0);
  assert.equal(report.packed_video.missing_reference[0].pack_id, "E01_PACK_001");
  assert.equal(report.packed_video.missing_reference[0].missing[0].shot_id, "E01_S002");
  assert.equal(report.next_action.action, "generate_reference_images");
});
