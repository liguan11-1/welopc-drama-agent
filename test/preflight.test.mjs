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
