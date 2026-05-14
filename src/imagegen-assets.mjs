import fs from "node:fs";
import path from "node:path";
import { ensureDir, readJson, readJsonl, writeJson, writeJsonl, writeText } from "./files.mjs";

const PROVIDER = "codex_imagegen";
const MODE = "built_in_tool";
const REFERENCE_ROOT = path.join("assets", "reference_images");

function targetPath(...parts) {
  return path.join(REFERENCE_ROOT, ...parts);
}

function promptBlock(lines) {
  return lines.filter(Boolean).join("\n");
}

function byId(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function characterPrompt({ manifest, style, character }) {
  return promptBlock([
    "Use case: illustration-story",
    "Asset type: Codex character reference sheet for a short drama production pipeline.",
    `Primary request: Generate a consistent character reference for ${character.name} in project "${manifest.title}".`,
    `Role: ${character.role}`,
    `Appearance DNA: ${character.appearance_dna}`,
    `Visual style: ${style.look}`,
    "Composition: vertical 9:16 reference image, full body plus close-up face detail, cinematic dark-myth manga drama look.",
    "Production constraints: stable face, stable costume, no subtitles, no watermark, no UI, no random face changes.",
    `Avoid: ${style.negative}`,
  ]);
}

function cameraPrompt({ manifest, style, shot, scene }) {
  return promptBlock([
    "Use case: illustration-story",
    "Asset type: Codex camera/lens reference image for one shot.",
    `Primary request: Generate a lens and camera composition reference for ${shot.shot_id} in project "${manifest.title}".`,
    `Scene: ${scene?.name || shot.scene_id} - ${scene?.visual || ""}`,
    `Shot size: ${shot.shot_size}`,
    `Camera motion: ${shot.camera_motion}`,
    `Visual action: ${shot.visual_action}`,
    `Visual style: ${style.look}`,
    "Composition: vertical 9:16, strong readable blocking, no text labels, no watermark.",
    `Avoid: ${style.negative}`,
  ]);
}

function storyboardPrompt({ manifest, style, shot, scene }) {
  return promptBlock([
    "Use case: illustration-story",
    "Asset type: Codex storyboard panel for short drama previsualization.",
    `Primary request: Generate a clean storyboard panel for ${shot.shot_id} in project "${manifest.title}".`,
    `Beat: ${shot.beat}`,
    `Scene: ${scene?.name || shot.scene_id}`,
    `Action: ${shot.visual_action}`,
    `Camera: ${shot.shot_size}, ${shot.camera_motion}`,
    `Caption/dialogue intent: ${shot.dialogue_or_caption}`,
    `Visual style: ${style.look}`,
    "Composition: vertical 9:16 storyboard-quality image, cinematic but still easy to inspect.",
    "No embedded text, no subtitles, no watermark.",
    `Avoid: ${style.negative}`,
  ]);
}

function videoReferencePrompt({ manifest, style, shot, scene, characters }) {
  const shotCharacters = (shot.characters || [])
    .map((characterId) => characters.get(characterId))
    .filter(Boolean)
    .map((character) => `${character.name}: ${character.appearance_dna}`)
    .join(" | ");

  return promptBlock([
    "Use case: illustration-story",
    "Asset type: Codex video first-frame reference for Seedance image-to-video.",
    `Primary request: Generate the exact first frame reference image for ${shot.shot_id} in project "${manifest.title}".`,
    `Scene: ${scene?.name || shot.scene_id} - ${scene?.visual || ""}`,
    `Characters: ${shotCharacters}`,
    `Shot size and camera: ${shot.shot_size}, ${shot.camera_motion}`,
    `On-screen action: ${shot.visual_action}`,
    `Visual style: ${style.look}`,
    "Composition: vertical 9:16, final-video quality, stable character identity, cinematic lighting, clear subject silhouette.",
    "This image will be saved as the Seedance first frame. Do not add subtitles, UI, logos, watermarks, or text.",
    `Avoid: ${style.negative}`,
  ]);
}

function buildImagegenPrompts({ manifest, style, characters, scenes, shots }) {
  const scenesById = byId(scenes, "scene_id");
  const charactersById = byId(characters, "character_id");

  const characterRows = characters.map((character, index) => ({
    asset_id: `character_${character.character_id}_reference`,
    asset_type: "character_reference",
    provider: PROVIDER,
    mode: MODE,
    character_id: character.character_id,
    target_path: targetPath("characters", `${character.character_id}.png`),
    prompt: characterPrompt({ manifest, style, character }),
    negative_prompt: style.negative,
    priority: index + 1,
    use_for: ["character_consistency", "video_reference_frame"],
  }));

  const cameraRows = shots.map((shot, index) => ({
    asset_id: `${shot.shot_id}_camera_reference`,
    asset_type: "camera_reference",
    provider: PROVIDER,
    mode: MODE,
    shot_id: shot.shot_id,
    target_path: targetPath("cameras", `${shot.shot_id}.png`),
    prompt: cameraPrompt({ manifest, style, shot, scene: scenesById.get(shot.scene_id) }),
    negative_prompt: style.negative,
    priority: 20 + index,
    use_for: ["shot_blocking", "camera_motion"],
  }));

  const storyboardRows = shots.map((shot, index) => ({
    asset_id: `${shot.shot_id}_storyboard_panel`,
    asset_type: "storyboard_panel",
    provider: PROVIDER,
    mode: MODE,
    shot_id: shot.shot_id,
    target_path: targetPath("storyboards", `${shot.shot_id}.png`),
    prompt: storyboardPrompt({ manifest, style, shot, scene: scenesById.get(shot.scene_id) }),
    negative_prompt: style.negative,
    priority: 40 + index,
    use_for: ["story_review", "shot_continuity"],
  }));

  const videoReferenceRows = shots.map((shot, index) => ({
    asset_id: `${shot.shot_id}_video_reference_frame`,
    asset_type: "video_reference_frame",
    provider: PROVIDER,
    mode: MODE,
    shot_id: shot.shot_id,
    target_path: targetPath("video_refs", `${shot.shot_id}.png`),
    prompt: videoReferencePrompt({
      manifest,
      style,
      shot,
      scene: scenesById.get(shot.scene_id),
      characters: charactersById,
    }),
    negative_prompt: style.negative,
    priority: 60 + index,
    use_for: ["seedance_first_frame", "final_video_consistency"],
  }));

  return [...characterRows, ...cameraRows, ...storyboardRows, ...videoReferenceRows];
}

function writeReferenceReadme(projectDir) {
  writeText(path.join(projectDir, REFERENCE_ROOT, "README.md"), `# Codex 生图参考资产

这个目录用于存放 Codex 内置 imagegen 生成的短剧视觉参考图。

推荐顺序：

1. 先生成 \`characters/*.png\`，锁定人物脸、服装和气质。
2. 再生成 \`cameras/*.png\` 和 \`storyboards/*.png\`，检查镜头与分镜是否成立。
3. 最后生成 \`video_refs/<shot_id>.png\`，作为 Seedance 图生视频首帧参考。

提示词来源：项目根目录的 \`imagegen_prompts.jsonl\`。

保存要求：

- 每条提示词的生成结果保存到它自己的 \`target_path\`。
- 不要在图里放字幕、水印、UI 或说明文字。
- \`video_refs\` 目录里的图片会被 \`render --execute\` 优先作为 Seedance 首帧。
`);
}

export function writeImageReferencePackage({ projectDir }) {
  const manifest = readJson(path.join(projectDir, "manifest.json"));
  const style = readJson(path.join(projectDir, "style_pack.json"));
  const characters = readJson(path.join(projectDir, "characters.json"));
  const scenes = readJson(path.join(projectDir, "scenes.json"));
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const prompts = buildImagegenPrompts({ manifest, style, characters, scenes, shots });

  for (const dir of ["characters", "cameras", "storyboards", "video_refs"]) {
    ensureDir(path.join(projectDir, REFERENCE_ROOT, dir));
  }

  const imagegenManifest = {
    provider: PROVIDER,
    mode: MODE,
    purpose: "用 Codex 内置 imagegen 生成人物、镜头、分镜和视频首帧参考图",
    prompt_file: "imagegen_prompts.jsonl",
    reference_root: REFERENCE_ROOT,
    required_before_paid_video: [targetPath("video_refs", "<shot_id>.png")],
    counts: {
      characters: characters.length,
      cameras: shots.length,
      storyboards: shots.length,
      video_reference_frames: shots.length,
      total: prompts.length,
    },
  };

  writeJson(path.join(projectDir, "imagegen_manifest.json"), imagegenManifest);
  writeJsonl(path.join(projectDir, "imagegen_prompts.jsonl"), prompts);
  writeText(path.join(projectDir, "imagegen_workflow.md"), `# Codex 生图工作流

1. 执行 \`welopc-drama-agent images --project <项目目录>\` 刷新提示词。
2. 在 Codex 会话中按 \`imagegen_prompts.jsonl\` 调用内置 imagegen。
3. 把生成图保存到每条记录的 \`target_path\`。
4. 审核 \`assets/reference_images/video_refs/*.png\` 后再执行 \`render --execute\`。

低成本策略：先只生成第一条或前三条 \`video_reference_frame\`，确认人物和风格稳定后再批量继续。
`);
  writeReferenceReadme(projectDir);

  return {
    provider: PROVIDER,
    mode: MODE,
    prompt_count: prompts.length,
    prompt_file: path.join(projectDir, "imagegen_prompts.jsonl"),
    manifest_file: path.join(projectDir, "imagegen_manifest.json"),
    reference_root: path.join(projectDir, REFERENCE_ROOT),
  };
}

export function videoReferenceAssetId(shotId) {
  return `${shotId}_video_reference_frame`;
}

export function expectedVideoReferencePath(projectDir, shotId) {
  return path.join(projectDir, REFERENCE_ROOT, "video_refs", `${shotId}.png`);
}

export function resolveShotReferenceImage(projectDir, shotId) {
  const candidates = [
    expectedVideoReferencePath(projectDir, shotId),
    path.join(projectDir, "assets", "keyframes", `${shotId}.png`),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}
