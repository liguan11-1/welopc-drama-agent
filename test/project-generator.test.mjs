import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProjectFromScript, createProjectFromTopic } from "../src/project-generator.mjs";
import { readJson, readJsonl } from "../src/files.mjs";

function tempProject(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), name);
}

test("topic mode creates a complete drama project", async () => {
  const projectDir = tempProject("topic-project");

  await createProjectFromTopic({
    topic: "白骨精不想再演反派了",
    outDir: projectDir,
  });

  const manifest = readJson(path.join(projectDir, "manifest.json"));
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const videoPrompts = readJsonl(path.join(projectDir, "video_prompts.jsonl"));

  assert.equal(manifest.input_mode, "topic");
  assert.equal(manifest.topic, "白骨精不想再演反派了");
  assert.equal(shots.length, 9);
  assert.equal(videoPrompts.length, 9);
  assert.ok(fs.existsSync(path.join(projectDir, "story_bible.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "audio_plan.md")));
  assert.ok(fs.existsSync(path.join(projectDir, "render_queue.jsonl")));
  assert.ok(fs.existsSync(path.join(projectDir, "index.html")));
});

test("script mode preserves source script constraints", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-"));
  const scriptFile = path.join(root, "story.md");
  const projectDir = path.join(root, "script-project");
  fs.writeFileSync(scriptFile, "主角发现自己每天重复同一场失败戏，最后决定改写结局。", "utf8");

  await createProjectFromScript({
    scriptFile,
    outDir: projectDir,
  });

  const manifest = readJson(path.join(projectDir, "manifest.json"));
  const story = fs.readFileSync(path.join(projectDir, "story_bible.md"), "utf8");

  assert.equal(manifest.input_mode, "script");
  assert.match(story, /重复同一场失败戏/);
});
