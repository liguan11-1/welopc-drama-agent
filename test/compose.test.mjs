import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeProject, planCompose } from "../src/compose.mjs";
import { createProjectFromTopic } from "../src/project-generator.mjs";
import { writeJson, writeJsonl } from "../src/files.mjs";

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

test("compose plan includes downloaded voice tracks with shot delays", async () => {
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

  const voiceFile = path.join(projectDir, "assets", "audio", "voice", "E01_S002.mp3");
  fs.mkdirSync(path.dirname(voiceFile), { recursive: true });
  fs.writeFileSync(voiceFile, Buffer.from("voice"));
  writeJson(path.join(projectDir, "outputs", "audio", "voice_state.json"), {
    voices: {
      E01_S002_voice_v01: {
        status: "succeeded",
        shot_id: "E01_S002",
        output_path: voiceFile,
      },
    },
  });

  const result = composeProject({ projectDir, execute: false });

  assert.equal(result.voice_tracks.length, 1);
  assert.equal(result.voice_tracks[0].delay_ms, 5000);
  assert.match(result.command.join(" "), /adelay=5000/);
  assert.match(result.command.join(" "), /-filter_complex/);
});

test("compose plan includes BGM and local SFX tracks from sound mix plan", async () => {
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

  const bgmFile = path.join(projectDir, "assets", "audio", "bgm.mp3");
  const sfxFile = path.join(projectDir, "assets", "audio", "sfx", "E01_S002_task_badge.mp3");
  fs.mkdirSync(path.dirname(sfxFile), { recursive: true });
  fs.writeFileSync(bgmFile, Buffer.from("bgm"));
  fs.writeFileSync(sfxFile, Buffer.from("sfx"));
  writeJson(path.join(projectDir, "outputs", "audio", "mix_plan.json"), {
    voice_tracks: [],
    bgm_tracks: [{ asset_id: "main_bgm", asset_path: bgmFile, start_sec: 0, volume: 0.55 }],
    sfx_tracks: [{ cue_id: "E01_S002_task_badge", asset_path: sfxFile, start_sec: 5, volume: 0.9 }],
  });

  const result = composeProject({ projectDir, execute: false });

  assert.equal(result.audio_tracks.length, 2);
  assert.equal(result.audio_tracks.find((track) => track.kind === "sfx").delay_ms, 5000);
  assert.match(result.command.join(" "), /amix=inputs=2/);
  assert.match(result.command.join(" "), /volume=0.55/);
  assert.match(result.command.join(" "), /adelay=5000/);
});

test("compose plan writes dialogue and information subtitles", async () => {
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
  writeJsonl(path.join(projectDir, "subtitle_timeline.jsonl"), [
    {
      subtitle_id: "E01_ND001",
      type: "non_dialogue_information",
      start_sec: 1,
      end_sec: 2.5,
      text: "她每天都在等天上的影子",
      voice_strategy: "no_tts",
    },
  ]);

  const result = composeProject({ projectDir, execute: false });
  const subtitleBody = fs.readFileSync(result.subtitle_file, "utf8");

  assert.ok(result.subtitle_tracks.some((track) => track.type === "dialogue_or_caption"));
  assert.ok(result.subtitle_tracks.some((track) => track.type === "non_dialogue_information"));
  assert.match(subtitleBody, /她每天都在等天上的影子/);
  assert.match(subtitleBody, /今天，我又被安排好了。/);
  assert.match(subtitleBody, /00:00:01,000 --> 00:00:02,500/);
  assert.match(result.command.join(" "), /subtitles='/);
});
