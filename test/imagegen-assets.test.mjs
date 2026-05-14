import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { readJson, readJsonl } from "../src/files.mjs";
import { writeImageReferencePackage } from "../src/imagegen-assets.mjs";

function tempProject(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), name);
}

test("imagegen package creates Codex prompts for characters, cameras, storyboards, and video reference frames", async () => {
  const projectDir = tempProject("imagegen-project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const result = writeImageReferencePackage({ projectDir });
  const manifest = readJson(path.join(projectDir, "imagegen_manifest.json"));
  const prompts = readJsonl(path.join(projectDir, "imagegen_prompts.jsonl"));
  const types = new Set(prompts.map((row) => row.asset_type));

  assert.equal(manifest.provider, "codex_imagegen");
  assert.equal(manifest.mode, "built_in_tool");
  assert.ok(types.has("character_reference"));
  assert.ok(types.has("camera_reference"));
  assert.ok(types.has("storyboard_panel"));
  assert.ok(types.has("video_reference_frame"));
  assert.ok(result.prompt_count >= 20);
  assert.ok(fs.existsSync(path.join(projectDir, "assets", "reference_images", "README.md")));
});

test("project generation includes the Codex imagegen reference package", async () => {
  const projectDir = tempProject("generated-imagegen-project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const prompts = readJsonl(path.join(projectDir, "imagegen_prompts.jsonl"));
  const videoFrame = prompts.find((row) => row.asset_type === "video_reference_frame");

  assert.ok(videoFrame);
  assert.match(videoFrame.prompt, /Codex/);
  assert.equal(videoFrame.provider, "codex_imagegen");
  assert.ok(videoFrame.target_path.endsWith(path.join("assets", "reference_images", "video_refs", `${videoFrame.shot_id}.png`)));
});
