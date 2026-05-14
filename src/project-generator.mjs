import fs from "node:fs";
import path from "node:path";
import { ensureDir, slugify, writeJson, writeJsonl, writeText } from "./files.mjs";
import { writeImageReferencePackage } from "./imagegen-assets.mjs";
import { writeSoundDesignPackage } from "./sound-design.mjs";
import { renderWebWorkspace } from "./web-workspace.mjs";

const DEFAULT_STYLE = {
  style_id: "dark_myth_manga_drama",
  ratio: "9:16",
  look: "暗黑神话漫剧，高反差低照度，冷灰蓝环境光，暗金命运感",
  negative: "不要随机换脸，不要横屏，不要字幕水印，不要过度血腥，不要现代感过重",
};

const BEATS = [
  ["E01_S001", "反常识钩子", "主角在重复命运里醒来，发现今日剧情已经被排好。", "slow push in", "低声旁白：今天，我又被安排好了。"],
  ["E01_S002", "身份反转", "后台任务牌亮起，主角意识到自己只是流程里的角色。", "static wide shot", "他们叫我角色，其实我只是任务。"],
  ["E01_S003", "剧本显形", "场景里出现走位标记和结局提示。", "side tracking", "连我该站哪一步，都有人写好了。"],
  ["E01_S004", "冲突升级", "执行者出现，动作悬停，双方都被系统控制。", "rapid cuts then freeze", "我不是输给了他，我是输给了流程。"],
  ["E01_S005", "命运停顿", "关键动作停在半空，系统开始卡顿。", "low angle slow push", "他也在等一个允许落下的指令。"],
  ["E01_S006", "情绪爆点", "主角撕掉任务牌，拒绝继续表演。", "handheld close-up", "这次，我不演了。"],
  ["E01_S007", "系统反应", "天空任务卷出现空白格，印章盖不下去。", "tilt up", "队列第一次空了一格。"],
  ["E01_S008", "真相揭示", "所有角色都站在队列里等待下一条命令。", "lateral dolly", "原来不止我一个人在排班。"],
  ["E01_S009", "结尾钩子", "主角回头，另一个角色的锁链松开。", "pull back to wide", "如果我不演了，故事还会继续吗？"],
];

function buildProject({ inputMode, topic, sourceText, outDir }) {
  const resolvedTopic = topic || sourceText.slice(0, 36) || "未命名短剧";
  const projectId = `drama_${slugify(resolvedTopic).slice(0, 32)}`;
  const title = resolvedTopic.length > 18 ? `${resolvedTopic.slice(0, 18)}...` : resolvedTopic;

  const manifest = {
    project_id: projectId,
    title,
    topic: resolvedTopic,
    input_mode: inputMode,
    format: "short_drama",
    duration_sec: 45,
    ratio: "9:16",
    status: "planned",
    created_at: new Date().toISOString(),
  };

  const characters = [
    {
      character_id: "protagonist",
      name: "主角",
      role: "觉醒者",
      appearance_dna: "清瘦骨相，眼神疲惫但清醒，服装带任务牌或命运标记",
      voice: "低声、克制、短句，情绪从麻木转向反抗",
      negative_rules: ["不要随机换脸", "不要过度夸张表情", "不要喜剧化"],
    },
    {
      character_id: "executor",
      name: "执行者",
      role: "被系统安排的对手",
      appearance_dna: "逆光剪影，动作强但迟疑，身上有锁链或任务标记",
      voice: "沉默、压抑、短促",
      negative_rules: ["不要抢主角视角", "不要纯反派化"],
    },
  ];

  const scenes = [
    { scene_id: "backstage", name: "命运后台", visual: "神话空间和后台派单系统混合，暗金经文和冷色雾气交织" },
    { scene_id: "scripted_field", name: "被写好的场景", visual: "地面有走位痕迹，空中有经文和任务队列" },
    { scene_id: "queue_hall", name: "系统队列大厅", visual: "所有角色排队等待下一条剧情指令" },
  ];

  const props = [
    { prop_id: "task_badge", name: "任务牌", function: "把命运转成可视化工作流" },
    { prop_id: "dispatch_scroll", name: "派单经卷", function: "显示系统规则和任务队列" },
    { prop_id: "broken_mask", name: "裂面具", function: "角色拒绝表演的视觉锚点" },
  ];

  const shots = BEATS.map(([shotId, beat, visualAction, cameraMotion, dialogue], index) => ({
    shot_id: shotId,
    time_range: `${index * 5}-${index * 5 + 5}s`,
    duration_sec: 5,
    beat,
    scene_id: index < 2 ? "backstage" : index < 6 ? "scripted_field" : "queue_hall",
    characters: index === 0 ? ["protagonist"] : ["protagonist", "executor"],
    shot_size: index % 3 === 0 ? "close-up" : index % 3 === 1 ? "wide shot" : "medium shot",
    camera_motion: cameraMotion,
    visual_action: visualAction,
    dialogue_or_caption: dialogue,
    transition: index === 8 ? "cut to black" : "hard cut",
  }));

  const imagePrompts = shots.map((shot, index) => ({
    asset_id: `${shot.shot_id}_keyframe`,
    shot_id: shot.shot_id,
    type: "keyframe",
    prompt: `${DEFAULT_STYLE.look}。主题：${resolvedTopic}。镜头：${shot.shot_size}，${shot.camera_motion}。画面：${shot.visual_action}。角色一致，任务牌、裂面具、派单经卷作为视觉锚点。`,
    negative_prompt: DEFAULT_STYLE.negative,
    ratio: "9:16",
    priority: index + 1,
  }));

  const videoPrompts = shots.map((shot) => ({
    task_id: `${shot.shot_id}_video_v01`,
    shot_id: shot.shot_id,
    mode: "image_to_video",
    model_hint: "doubao-seedance-2-0-fast-260128",
    duration_sec: shot.duration_sec,
    prompt: `参考 ${shot.shot_id} 关键帧，保持角色脸、服装、任务牌、场景和光影一致。运镜：${shot.camera_motion}。主体动作：${shot.visual_action}。画面需要短剧冲击力和连续动作，不要突然换场。`,
    negative_prompt: DEFAULT_STYLE.negative,
    dependencies: [`${shot.shot_id}_video_reference_frame`],
  }));

  const renderQueue = [
    ...imagePrompts.map((item) => ({
      task_id: `${item.asset_id}_image_task`,
      task_type: "image_reference_generate",
      provider: "codex_imagegen",
      model: "codex-built-in-imagegen",
      dependencies: [],
      priority: item.priority,
    })),
    ...videoPrompts.map((item, index) => ({
      task_id: item.task_id,
      task_type: "image_to_video",
      provider: "seedance",
      model: item.model_hint,
      dependencies: item.dependencies,
      priority: 20 + index,
      poll_interval_sec: 120,
      on_success: "download_result_and_continue",
      on_fail: "retry_once_then_manual_review",
    })),
  ];

  return { manifest, characters, scenes, props, shots, imagePrompts, videoPrompts, renderQueue, sourceText };
}

function writeProject(projectDir, project) {
  ensureDir(projectDir);
  ensureDir(path.join(projectDir, "assets", "keyframes"));
  ensureDir(path.join(projectDir, "assets", "reference_images"));
  ensureDir(path.join(projectDir, "assets", "audio"));
  ensureDir(path.join(projectDir, "outputs", "clips"));
  ensureDir(path.join(projectDir, "outputs", "audio"));

  writeJson(path.join(projectDir, "manifest.json"), project.manifest);
  writeJson(path.join(projectDir, "style_pack.json"), DEFAULT_STYLE);
  writeJson(path.join(projectDir, "characters.json"), project.characters);
  writeJson(path.join(projectDir, "scenes.json"), project.scenes);
  writeJson(path.join(projectDir, "props.json"), project.props);
  writeJsonl(path.join(projectDir, "shots.jsonl"), project.shots);
  writeJsonl(path.join(projectDir, "image_prompts.jsonl"), project.imagePrompts);
  writeJsonl(path.join(projectDir, "video_prompts.jsonl"), project.videoPrompts);
  writeJsonl(path.join(projectDir, "render_queue.jsonl"), project.renderQueue);
  writeText(path.join(projectDir, "story_bible.md"), `# ${project.manifest.title}\n\n主题：${project.manifest.topic}\n\n原始素材：${project.sourceText || project.manifest.topic}\n\n核心冲突：主角发现自己不是自然失败，而是被系统化剧情安排。\n\n结尾钩子：如果主角拒绝继续扮演，故事系统会如何修复自己？\n`);
  writeText(path.join(projectDir, "episode_outline.md"), project.shots.map((shot) => `- ${shot.shot_id} ${shot.beat}: ${shot.visual_action}`).join("\n") + "\n");
  writeText(path.join(projectDir, "audio_plan.md"), `# 音频方案\n\nBGM：低沉环境氛围、暗金宗教感、逐步增加鼓点。\n\n音效：任务牌亮起、经文翻动、脚步、远处低频冲击。\n\n旁白：短句、低声、克制，不使用过度解释。\n`);
  writeText(path.join(projectDir, "bgm_prompts.jsonl"), `${JSON.stringify({ prompt: "dark myth short drama BGM, low percussion, ritual bell, tense build-up", duration_sec: 45 })}\n`);
  writeText(path.join(projectDir, "sfx_prompts.jsonl"), `${JSON.stringify({ cue: "task_badge_light", description: "metallic notification with ritual bell tail" })}\n`);
  writeText(path.join(projectDir, "voiceover_script.md"), project.shots.map((shot) => `${shot.shot_id}: ${shot.dialogue_or_caption}`).join("\n") + "\n");
  writeText(path.join(projectDir, "review_checklist.md"), "# 审核清单\n\n- 角色一致\n- 分镜顺序成立\n- Prompt 可执行\n- 成本可控\n- 音频方案匹配节奏\n");
  writeImageReferencePackage({ projectDir });
  writeSoundDesignPackage({ projectDir });
  renderWebWorkspace(projectDir);
}

export async function createProjectFromTopic({ topic, outDir }) {
  if (!topic) throw new Error("--topic is required");
  const projectDir = outDir || path.join("projects", slugify(topic));
  const project = buildProject({ inputMode: "topic", topic, sourceText: topic, outDir: projectDir });
  writeProject(projectDir, project);
  return { project_dir: projectDir, manifest: project.manifest };
}

export async function createProjectFromScript({ scriptFile, outDir }) {
  if (!scriptFile) throw new Error("--script is required");
  const sourceText = fs.readFileSync(scriptFile, "utf8");
  const topic = sourceText.slice(0, 28);
  const projectDir = outDir || path.join("projects", slugify(topic));
  const project = buildProject({ inputMode: "script", topic, sourceText, outDir: projectDir });
  project.manifest.source_script = path.resolve(scriptFile);
  writeProject(projectDir, project);
  return { project_dir: projectDir, manifest: project.manifest };
}
