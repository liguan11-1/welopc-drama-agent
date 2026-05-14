import path from "node:path";
import { ensureDir, readJson, readJsonl, writeJson, writeJsonl, writeText } from "./files.mjs";

const DEFAULT_CHARACTER_MOTIFS = {
  protagonist: ["低频呼吸", "瓷面具摩擦", "细碎骨裂", "冷风尾音"],
  executor: ["锁链轻响", "压迫性脚步", "金属低鸣", "远处棍风"],
};

const DEFAULT_AMBIENCE = {
  backstage: "封闭后台空间，低频风压，远处经卷翻页，空气里有轻微电流失真。",
  scripted_field: "潮湿外景，低风、泥水、树枝摩擦，偶发经文光噪。",
  queue_hall: "巨大队列大厅，空旷混响，低频机械运转，远处任务提示音。",
};

function startSecFromTimeRange(timeRange) {
  const match = String(timeRange || "").match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function motifsForCharacters(characters = []) {
  return characters.flatMap((characterId) => DEFAULT_CHARACTER_MOTIFS[characterId] || ["轻微衣料摩擦", "压低的呼吸"]);
}

function sfxCueForShot(shot) {
  const lower = `${shot.beat} ${shot.visual_action}`.toLowerCase();
  if (lower.includes("任务") || lower.includes("badge")) return "task_badge";
  if (lower.includes("锁") || lower.includes("chain")) return "chain_release";
  if (lower.includes("经") || lower.includes("scroll")) return "dispatch_scroll";
  if (lower.includes("停") || lower.includes("freeze")) return "time_freeze";
  return "dramatic_hit";
}

function buildRows({ projectDir }) {
  const shots = readJsonl(path.join(projectDir, "shots.jsonl"));
  const characters = readJson(path.join(projectDir, "characters.json"));
  const characterNames = new Map(characters.map((item) => [item.character_id, item.name]));

  const soundRows = shots.map((shot) => {
    const cueKind = sfxCueForShot(shot);
    const cueId = `${shot.shot_id}_${cueKind}`;
    const startSec = startSecFromTimeRange(shot.time_range);
    return {
      shot_id: shot.shot_id,
      time_range: shot.time_range,
      start_sec: startSec,
      duration_sec: Number(shot.duration_sec || 5),
      voice_strategy: "subtitle_only",
      dialogue_delivery: "字幕呈现，不生成角色语音",
      subtitle_text: shot.dialogue_or_caption,
      character_motifs: motifsForCharacters(shot.characters).map((motif) => ({
        motif,
        characters: shot.characters.map((characterId) => characterNames.get(characterId) || characterId),
      })),
      ambience: DEFAULT_AMBIENCE[shot.scene_id] || "低频环境声，保留画面空间感。",
      sfx_cues: [
        {
          cue_id: cueId,
          cue_kind: cueKind,
          start_sec: startSec + Math.min(1.2, Number(shot.duration_sec || 5) * 0.25),
          volume: cueKind === "dramatic_hit" ? 0.85 : 0.75,
          description: `${shot.beat}：${shot.visual_action}`,
          asset_path: path.join(projectDir, "assets", "audio", "sfx", `${cueId}.mp3`),
        },
      ],
      mix_notes: "BGM 托底，SFX 点题，人物用非语言音色动机表达，不使用 TTS。",
    };
  });

  const ambienceRows = soundRows.map((row) => ({
    shot_id: row.shot_id,
    prompt: row.ambience,
    duration_sec: row.duration_sec,
    volume: 0.35,
  }));

  const sfxRows = soundRows.flatMap((row) => row.sfx_cues.map((cue) => ({
    cue_id: cue.cue_id,
    shot_id: row.shot_id,
    prompt: `${cue.description}。声音设计：${cue.cue_kind}，短促、有质感、不要人声台词。`,
    start_sec: cue.start_sec,
    duration_sec: 1.2,
    volume: cue.volume,
    asset_path: cue.asset_path,
  })));

  const mixPlan = {
    strategy: "sound_design_first",
    voice_tracks: [],
    bgm_tracks: [
      {
        asset_id: "main_bgm",
        asset_path: path.join(projectDir, "assets", "audio", "bgm.mp3"),
        start_sec: 0,
        volume: 0.45,
        optional: true,
      },
    ],
    ambience_tracks: ambienceRows,
    sfx_tracks: sfxRows,
  };

  return { soundRows, ambienceRows, sfxRows, mixPlan };
}

export function writeSoundDesignPackage({ projectDir }) {
  ensureDir(path.join(projectDir, "assets", "audio", "sfx"));
  ensureDir(path.join(projectDir, "outputs", "audio"));
  const { soundRows, ambienceRows, sfxRows, mixPlan } = buildRows({ projectDir });

  const soundDesignFile = path.join(projectDir, "sound_design.jsonl");
  const ambienceFile = path.join(projectDir, "ambience_prompts.jsonl");
  const sfxFile = path.join(projectDir, "sfx_prompts.jsonl");
  const mixPlanFile = path.join(projectDir, "outputs", "audio", "mix_plan.json");

  writeJsonl(soundDesignFile, soundRows);
  writeJsonl(ambienceFile, ambienceRows);
  writeJsonl(sfxFile, sfxRows);
  writeJson(mixPlanFile, mixPlan);
  writeText(path.join(projectDir, "audio_plan.md"), `# 音频方案\n\n默认策略：声音设计优先，不生成角色 TTS。\n\nBGM：低沉环境氛围、暗金宗教感、逐步增加鼓点。\n\n环境声：按分镜空间生成低频、风声、经卷、队列大厅混响。\n\nSFX：任务牌、锁链、经卷、时间冻结、动作冲击等声音点题。\n\n人物：通过呼吸、面具、骨裂、锁链、脚步等非语言音色动机表达，台词以字幕呈现。\n`);

  return {
    sound_design: soundDesignFile,
    ambience_prompts: ambienceFile,
    sfx_prompts: sfxFile,
    mix_plan: mixPlanFile,
  };
}
