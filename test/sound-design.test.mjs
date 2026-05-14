import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { readJson, readJsonl } from "../src/files.mjs";
import { writeSoundDesignPackage } from "../src/sound-design.mjs";

test("project generation includes subtitle-only sound design package", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");

  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });

  const soundRows = readJsonl(path.join(projectDir, "sound_design.jsonl"));
  const ambienceRows = readJsonl(path.join(projectDir, "ambience_prompts.jsonl"));
  const sfxRows = readJsonl(path.join(projectDir, "sfx_prompts.jsonl"));
  const mixPlan = readJson(path.join(projectDir, "outputs", "audio", "mix_plan.json"));

  assert.equal(soundRows.length, 9);
  assert.equal(soundRows[0].voice_strategy, "subtitle_only");
  assert.ok(soundRows[0].character_motifs.length > 0);
  assert.ok(soundRows[0].sfx_cues.length > 0);
  assert.equal(ambienceRows.length, 9);
  assert.ok(sfxRows.length >= 9);
  assert.equal(mixPlan.voice_tracks.length, 0);
  assert.ok(mixPlan.sfx_tracks.length >= 9);
});

test("sound command package can be regenerated without TTS fields", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "唐僧不想取经了", outDir: projectDir });
  fs.rmSync(path.join(projectDir, "sound_design.jsonl"));

  const result = writeSoundDesignPackage({ projectDir });
  const soundRows = readJsonl(result.sound_design);

  assert.equal(soundRows.length, 9);
  assert.equal(soundRows.some((row) => row.voice_type), false);
  assert.equal(soundRows.every((row) => row.dialogue_delivery === "字幕呈现，不生成角色语音"), true);
});
