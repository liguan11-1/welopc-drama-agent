import fs from "node:fs";
import path from "node:path";
import { hashProductionPackage } from "./approval.mjs";
import { readJson, readJsonl } from "./files.mjs";
import { expectedVideoReferencePath, resolveShotReferenceImage } from "./imagegen-assets.mjs";

function readOptionalJson(file, fallback) {
  return fs.existsSync(file) ? readJson(file) : fallback;
}

function commandFor(projectDir, command, args = "") {
  const suffix = args ? ` ${args}` : "";
  return `node .\\bin\\welopc-drama-agent.js ${command} --project "${projectDir}"${suffix}`;
}

function approvalStatus(projectDir) {
  const approvalFile = path.join(projectDir, "approval.json");
  const currentHash = hashProductionPackage(projectDir);
  if (!fs.existsSync(approvalFile)) {
    return { status: "missing", approved: false, current_hash: currentHash };
  }

  const approval = readJson(approvalFile);
  if (!approval.approved) {
    return { status: "not_approved", approved: false, approved_at: approval.approved_at || null, current_hash: currentHash };
  }

  const status = approval.package_hash === currentHash ? "current" : "stale";
  return {
    status,
    approved: status === "current",
    approved_at: approval.approved_at || null,
    approved_hash: approval.package_hash || null,
    current_hash: currentHash,
  };
}

function subtitleStatus(projectDir, shots) {
  const timelineFile = path.join(projectDir, "subtitle_timeline.jsonl");
  const informationRows = fs.existsSync(timelineFile) ? readJsonl(timelineFile) : [];
  const dialogueRows = shots.filter((shot) => String(shot.dialogue_or_caption || "").trim());
  const subtitleFile = path.join(projectDir, "outputs", "final", "subtitles.srt");
  return {
    dialogue_count: dialogueRows.length,
    non_dialogue_count: informationRows.length,
    timeline_file: fs.existsSync(timelineFile) ? timelineFile : null,
    srt_file: fs.existsSync(subtitleFile) ? subtitleFile : null,
  };
}

function audioStatus(projectDir) {
  const bgmFile = path.join(projectDir, "assets", "audio", "bgm.mp3");
  const mixPlanFile = path.join(projectDir, "outputs", "audio", "mix_plan.json");
  const voiceStateFile = path.join(projectDir, "outputs", "audio", "voice_state.json");
  const voiceState = readOptionalJson(voiceStateFile, { voices: {} });
  return {
    bgm_exists: fs.existsSync(bgmFile),
    bgm_file: fs.existsSync(bgmFile) ? bgmFile : null,
    mix_plan_exists: fs.existsSync(mixPlanFile),
    mix_plan_file: fs.existsSync(mixPlanFile) ? mixPlanFile : null,
    voice_count: Object.keys(voiceState.voices || {}).length,
  };
}

function videoStatus(projectDir, videoPrompts) {
  const state = readOptionalJson(path.join(projectDir, "render_state.json"), { videos: {} });
  const readyForSeedance = [];
  const missingReference = [];
  const submitted = [];
  const succeeded = [];
  const failed = [];

  for (const prompt of videoPrompts) {
    const record = state.videos?.[prompt.task_id];
    if (record?.status === "succeeded") {
      succeeded.push({
        task_id: prompt.task_id,
        shot_id: prompt.shot_id,
        output_path: record.output_path || null,
      });
      continue;
    }
    if (record?.status === "failed") {
      failed.push({ task_id: prompt.task_id, shot_id: prompt.shot_id });
      continue;
    }
    if (record?.provider_task_id) {
      submitted.push({
        task_id: prompt.task_id,
        shot_id: prompt.shot_id,
        status: record.status || "submitted",
        provider_task_id: record.provider_task_id,
      });
      continue;
    }

    const referenceImage = resolveShotReferenceImage(projectDir, prompt.shot_id);
    if (referenceImage && referenceImage.includes(path.join("assets", "reference_images", "video_refs"))) {
      readyForSeedance.push({
        task_id: prompt.task_id,
        shot_id: prompt.shot_id,
        duration_sec: prompt.duration_sec,
        reference_image: referenceImage,
      });
    } else {
      missingReference.push({
        task_id: prompt.task_id,
        shot_id: prompt.shot_id,
        expected_reference_image: expectedVideoReferencePath(projectDir, prompt.shot_id),
      });
    }
  }

  return {
    total: videoPrompts.length,
    ready_for_seedance: readyForSeedance,
    missing_reference: missingReference,
    submitted,
    succeeded,
    failed,
  };
}

function packedVideoStatus(projectDir) {
  const planFile = path.join(projectDir, "video_node_packing_plan.jsonl");
  if (!fs.existsSync(planFile)) {
    return {
      enabled: false,
      plan_file: null,
      total: 0,
      ready_for_seedance: [],
      missing_reference: [],
      duration_overflow: [],
    };
  }

  const packs = readJsonl(planFile);
  const readyForSeedance = [];
  const missingReference = [];
  const durationOverflow = [];

  for (const pack of packs) {
    const beats = Array.isArray(pack.visual_beats) ? pack.visual_beats : [];
    const missing = [];
    for (const beat of beats) {
      if (!beat.image_ref) {
        missing.push({ shot_id: beat.shot_id || null, image_ref: null });
        continue;
      }
      const referencePath = path.resolve(projectDir, beat.image_ref);
      if (!fs.existsSync(referencePath)) {
        missing.push({
          shot_id: beat.shot_id || null,
          image_ref: beat.image_ref,
          expected_reference_image: referencePath,
        });
      }
    }

    if (Number(pack.target_duration_sec || 0) > 5) {
      durationOverflow.push({
        pack_id: pack.pack_id,
        target_duration_sec: pack.target_duration_sec,
      });
    }

    if (beats.length > 0 && missing.length === 0 && Number(pack.target_duration_sec || 0) <= 5) {
      readyForSeedance.push({
        pack_id: pack.pack_id,
        shot_ids: pack.shot_ids || beats.map((beat) => beat.shot_id).filter(Boolean),
        target_duration_sec: pack.target_duration_sec,
        provider_duration_sec: pack.provider_duration_sec || 5,
        reference_frames: beats.map((beat) => path.resolve(projectDir, beat.image_ref)),
      });
    } else if (missing.length > 0) {
      missingReference.push({
        pack_id: pack.pack_id,
        shot_ids: pack.shot_ids || beats.map((beat) => beat.shot_id).filter(Boolean),
        missing,
      });
    }
  }

  return {
    enabled: true,
    plan_file: planFile,
    total: packs.length,
    ready_for_seedance: readyForSeedance,
    missing_reference: missingReference,
    duration_overflow: durationOverflow,
  };
}

function nextAction({ projectDir, approval, video, packedVideo, audio }) {
  if (approval.status !== "current") {
    return {
      action: "approve",
      reason: approval.status === "stale" ? "制作包已变更，付费视频前需要重新审批。" : "项目还没有有效审批。",
      command: commandFor(projectDir, "approve"),
    };
  }

  if (video.submitted.length > 0) {
    return {
      action: "poll_status",
      reason: "已有 Seedance 任务提交，先轮询并下载结果。",
      command: commandFor(projectDir, "status", "--poll"),
    };
  }

  if (packedVideo?.enabled && packedVideo.missing_reference.length > 0) {
    return {
      action: "generate_reference_images",
      reason: "打包视频节点还缺 visual beat 参考图，先继续生成并人工审核 Codex 参考图。",
      command: commandFor(projectDir, "images"),
    };
  }

  if (video.ready_for_seedance.length > 0) {
    const first = video.ready_for_seedance[0];
    return {
      action: "render_paid_test",
      reason: `${first.task_id} 已有真实 Codex 首帧，可先跑单镜低成本视频测试。`,
      task_id: first.task_id,
      command: commandFor(projectDir, "render", "--batch 1 --resolution 480p --execute"),
    };
  }

  if (video.succeeded.length === video.total && video.total > 0) {
    if (!audio.mix_plan_exists || !audio.bgm_exists) {
      return {
        action: "prepare_audio",
        reason: "视频片段已齐，合成前需要确认 BGM/SFX 混音资产。",
        command: commandFor(projectDir, "sound"),
      };
    }
    return {
      action: "compose",
      reason: "视频、字幕和音频计划已具备，可以生成合成计划或执行合成。",
      command: commandFor(projectDir, "compose"),
    };
  }

  return {
    action: "generate_reference_images",
    reason: "还缺视频首帧，先继续生成并人工审核 Codex 参考图。",
    command: commandFor(projectDir, "images"),
  };
}

export function preflightProject({ projectDir }) {
  const resolvedProjectDir = path.resolve(projectDir);
  const manifest = readOptionalJson(path.join(resolvedProjectDir, "manifest.json"), {});
  const shots = readJsonl(path.join(resolvedProjectDir, "shots.jsonl"));
  const videoPrompts = readJsonl(path.join(resolvedProjectDir, "video_prompts.jsonl"));
  const approval = approvalStatus(resolvedProjectDir);
  const video = videoStatus(resolvedProjectDir, videoPrompts);
  const packedVideo = packedVideoStatus(resolvedProjectDir);
  const audio = audioStatus(resolvedProjectDir);
  const subtitles = subtitleStatus(resolvedProjectDir, shots);
  const costGuard = {
    can_submit_paid_video: approval.status === "current" && !packedVideo.enabled && video.ready_for_seedance.length > 0,
    can_submit_paid_packed_video: approval.status === "current" && packedVideo.ready_for_seedance.length > 0,
    requires_real_codex_reference: true,
    allow_placeholder_default: false,
  };

  return {
    project: {
      project_dir: resolvedProjectDir,
      project_id: manifest.project_id || null,
      title: manifest.title || null,
      episode_id: manifest.episode_id || null,
      episode_title: manifest.episode_title || null,
    },
    approval,
    video,
    packed_video: packedVideo,
    subtitles,
    audio,
    cost_guard: costGuard,
    next_action: nextAction({ projectDir: resolvedProjectDir, approval, video, packedVideo, audio }),
  };
}
