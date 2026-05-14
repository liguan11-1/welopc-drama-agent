import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { importManualBgm } from "../src/audio.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { renderWebWorkspace } from "../src/web-workspace.mjs";

test("web workspace shows Chinese story, shots, queue, approval, and audio plan", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const htmlFile = renderWebWorkspace(projectDir);
  const html = fs.readFileSync(htmlFile, "utf8");

  assert.match(html, /白骨精不想再演反派了/);
  assert.match(html, /E01_S001/);
  assert.match(html, /渲染队列/);
  assert.match(html, /审批状态/);
  assert.match(html, /音频方案/);
});

test("manual BGM import copies audio into project assets", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-"));
  const projectDir = path.join(root, "project");
  const bgmFile = path.join(root, "bgm.mp3");
  fs.writeFileSync(bgmFile, Buffer.from("fake mp3"));
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const result = importManualBgm({ projectDir, file: bgmFile });

  assert.equal(result.output_path, path.join(projectDir, "assets", "audio", "bgm.mp3"));
  assert.equal(fs.readFileSync(result.output_path, "utf8"), "fake mp3");
});
