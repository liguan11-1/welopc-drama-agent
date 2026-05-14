import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeMidboard, composeProject, planCompose, planMidboard } from "../src/compose.mjs";
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
    bgm_tracks: [{ asset_id: "main_bgm", asset_path: "assets/audio/bgm.mp3", start_sec: 0, volume: 0.55 }],
    sfx_tracks: [{ cue_id: "E01_S002_task_badge", asset_path: "assets/audio/sfx/E01_S002_task_badge.mp3", start_sec: 5, volume: 0.9 }],
  });

  const result = composeProject({ projectDir, execute: false });

  assert.equal(result.audio_tracks.length, 2);
  assert.equal(result.audio_tracks.find((track) => track.kind === "bgm").input_path, bgmFile);
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

test("compose trims generated clips to target shot durations and ignores provider audio", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "白骨精不想再演反派了", outDir: projectDir });
  const shotsFile = path.join(projectDir, "shots.jsonl");
  const shots = fs.readFileSync(shotsFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  shots[0].duration_sec = 2.8;
  shots[0].time_range = "0-2.8s";
  writeJsonl(shotsFile, shots);

  const clipsDir = path.join(projectDir, "outputs", "clips");
  fs.mkdirSync(clipsDir, { recursive: true });
  const videos = {};
  for (const shot of shots) {
    const clip = path.join(clipsDir, `${shot.shot_id}.mp4`);
    fs.writeFileSync(clip, Buffer.from(`clip-${shot.shot_id}`));
    videos[`${shot.shot_id}_video_v01`] = {
      status: "succeeded",
      output_path: clip,
      provider_duration_sec: 5,
      target_duration_sec: shot.duration_sec,
    };
  }
  writeJson(path.join(projectDir, "render_state.json"), { videos });

  const result = composeProject({ projectDir, execute: false });
  const command = result.command.join(" ");

  assert.equal(result.clip_plan[0].target_duration_sec, 2.8);
  assert.equal(result.source_audio_policy, "ignore_provider_audio");
  assert.match(command, /trim=duration=2\.8/);
  assert.match(command, /concat=n=9:v=1:a=0/);
  assert.match(command, /-map \[vout\]/);
  assert.match(command, / -an /);
  assert.doesNotMatch(command, /-c copy/);
  assert.doesNotMatch(command, /0:a/);
});

test("midboard compose uses packed clips, trims provider output, and keeps subtitles in range", async () => {
  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "welopc-drama-")), "project");
  await createProjectFromTopic({ topic: "packed midboard", outDir: projectDir });
  writeJsonl(path.join(projectDir, "video_node_packing_plan.jsonl"), [
    {
      pack_id: "E01_PACK_001",
      provider_duration_sec: 5,
      target_duration_sec: 4.9,
      shot_ids: ["E01_S001", "E01_S002", "E01_S003"],
    },
    {
      pack_id: "E01_PACK_002",
      provider_duration_sec: 5,
      target_duration_sec: 3.5,
      shot_ids: ["E01_S004", "E01_S005"],
    },
  ]);
  const clipsDir = path.join(projectDir, "outputs", "clips");
  fs.mkdirSync(clipsDir, { recursive: true });
  const packOne = path.join(clipsDir, "E01_PACK_001.mp4");
  const packTwo = path.join(clipsDir, "E01_PACK_002.mp4");
  fs.writeFileSync(packOne, Buffer.from("pack-one"));
  fs.writeFileSync(packTwo, Buffer.from("pack-two"));
  writeJson(path.join(projectDir, "render_state.json"), {
    videos: {
      E01_PACK_001_video_v01: {
        status: "succeeded",
        output_kind: "packed_video_node",
        pack_id: "E01_PACK_001",
        output_path: packOne,
        provider_duration_sec: 5,
        target_duration_sec: 4.9,
      },
      E01_PACK_002_video_v01: {
        status: "succeeded",
        output_kind: "packed_video_node",
        pack_id: "E01_PACK_002",
        output_path: packTwo,
        provider_duration_sec: 5,
        target_duration_sec: 3.5,
      },
    },
  });
  writeJsonl(path.join(projectDir, "subtitle_timeline.jsonl"), [
    { subtitle_id: "in_range", start_sec: 1, end_sec: 2, text: "inside" },
    { subtitle_id: "out_of_range", start_sec: 9, end_sec: 10, text: "outside" },
  ]);

  const result = composeMidboard({
    projectDir,
    packIds: ["E01_PACK_001", "E01_PACK_002"],
    execute: false,
  });
  const subtitleBody = fs.readFileSync(result.subtitle_file, "utf8");
  const command = result.command.join(" ");

  assert.equal(result.dry_run, true);
  assert.ok(result.output_path.endsWith(path.join("outputs", "final", "midboard.mp4")));
  assert.equal(result.clip_plan.length, 2);
  assert.equal(result.clip_plan[0].pack_id, "E01_PACK_001");
  assert.equal(result.duration_sec, 8.4);
  assert.match(command, /trim=duration=4\.9/);
  assert.match(command, /concat=n=2:v=1:a=0/);
  assert.match(subtitleBody, /inside/);
  assert.doesNotMatch(subtitleBody, /outside/);

  const plan = planMidboard({ projectDir, packIds: ["E01_PACK_001"] });
  assert.equal(plan.duration_sec, 4.9);
});
