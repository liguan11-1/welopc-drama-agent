import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeProject, planCompose } from "../src/compose.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { writeJson } from "../src/files.mjs";

test("compose refuses when required clips are missing", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  assert.throws(() => planCompose({ projectDir }), /missing clips/i);
});

test("compose dry run writes an ffmpeg concat list when clips exist", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  const clipsDir = path.join(projectDir, "outputs", "clips");
  fs.mkdirSync(clipsDir, { recursive: true });
  const videos = {};
  for (let index = 1; index <= 9; index += 1) {
    const shotId = `E01_S${String(index).padStart(3, "0")}`;
    const clip = path.join(clipsDir, `${shotId}.mp4`);
    fs.writeFileSync(clip, Buffer.from(`clip-${index}`));
    videos[`${shotId}_video_v01`] = { status: "succeeded", output_path: clip };
  }
  writeJson(path.join(projectDir, "render_state.json"), { videos });

  const result = composeProject({ projectDir, execute: false });
  const concatList = fs.readFileSync(result.concat_list, "utf8");

  assert.match(concatList, /E01_S001\.mp4/);
  assert.match(result.command.join(" "), /ffmpeg/);
  assert.equal(result.dry_run, true);
});
