import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { approveProject, assertApproved } from "../src/approval.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { renderBatch } from "../src/render-state.mjs";
import { readJson } from "../src/files.mjs";

test("rendering refuses before approval", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "唐僧不想取经了", outDir: projectDir });

  assert.throws(() => assertApproved(projectDir), /not approved/i);
  await assert.rejects(() => renderBatch({ projectDir, batch: 3, resolution: "480p" }), /not approved/i);
});

test("approval creates approval metadata and unlocks local render batch", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "唐僧不想取经了", outDir: projectDir });

  const approval = approveProject(projectDir);
  const stored = readJson(path.join(projectDir, "approval.json"));

  assert.equal(stored.package_hash, approval.package_hash);
  assert.doesNotThrow(() => assertApproved(projectDir));

  const result = await renderBatch({ projectDir, batch: 2, resolution: "480p" });
  assert.equal(result.generated_keyframes.length, 2);
  assert.ok(fs.existsSync(path.join(projectDir, "render_state.json")));
});

test("approval becomes stale when subtitle timeline changes", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "唐僧不想取经了", outDir: projectDir });
  fs.writeFileSync(
    path.join(projectDir, "subtitle_timeline.jsonl"),
    `${JSON.stringify({ subtitle_id: "E01_ND001", start_sec: 0, end_sec: 2, text: "第一版字幕" })}\n`,
    "utf8",
  );
  approveProject(projectDir);

  fs.writeFileSync(
    path.join(projectDir, "subtitle_timeline.jsonl"),
    `${JSON.stringify({ subtitle_id: "E01_ND001", start_sec: 0, end_sec: 2, text: "第二版字幕" })}\n`,
    "utf8",
  );

  assert.throws(() => assertApproved(projectDir), /stale/i);
});
