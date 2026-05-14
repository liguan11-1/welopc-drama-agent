# 《我在仙门当外门弟子》短剧 Agent 项目

这是基于用户提供小说《摸鱼日记4.27.docx》现有内容拆出的专业级短剧生产包。文件名更像临时稿名，正式短剧建议用《我在仙门当外门弟子》：更贴合“村中孤女入仙门、外门成长、宗门悬疑”的主体，也比“摸鱼日记”更利于短剧封面和平台分发。

## 当前做到哪儿了

- 已解析小说素材：约 6.18 万字、24 章，核心人物和第一季主线已梳理。
- 已确定产品形态：竖屏 9:16，第一季 24 集，单集 60-90 秒。
- 已完成第一集高密度生产包：70 秒、37 镜，平均约 1.89 秒一镜，保留 E01_S011 作为低成本 Seedance 单镜测试点。
- 已补强人物信息：林溪长期看天、泥墙云舟痕迹、小布袋旧竹片、村童议论、温庚然压住不能出手的动作、女修流程化接引。
- 已完成视频提示词、首帧提示词、BGM/SFX/声音设计、配音策略和继续任务队列。
- 已补充第一集 6 条非对白信息字幕：只提升画面信息密度，不新增对白，也不进入 TTS。
- 已生成 5 张 Codex 生图参考图：林溪、温庚然、平溪村院子、云舟到来、整体视觉圣经。
- 已补充工业化实验层：生产看板、实验队列、多机位九宫格、人物场景融合、moodboard、光影测试和 QA 标签。
- 未提交 Seedance 付费视频任务：目前只是准备素材和计划，避免在首帧未完全确认时消耗额度。

## 当前项目文件

- `manifest.json`：项目元信息和状态。
- `story_bible.md`：小说拆解、第一季结构和人物关系。
- `PLAN.md`：从现在继续做视频、BGM、配音、合成的执行计划。
- `characters.json` / `scenes.json` / `props.json`：角色、场景、道具设定。
- `shots.jsonl`：第一集 37 个短切镜头，含时长、运镜、画面、台词和声音提示。
- `subtitle_timeline.jsonl`：第一集非对白信息字幕时间线，标记 `no_tts`，供后续合成字幕轨使用。
- `video_prompts.jsonl`：Seedance 图生视频任务提示词，首条为 `E01_S011_video_v01`。
- `image_prompts.jsonl`：Codex 生图首帧提示词。
- `audio_plan.md` / `voice_cast.json` / `bgm_prompts.jsonl` / `sfx_prompts.jsonl`：BGM、SFX、声音动机和可选人物配音策略。
- `audio_layer_design.md`：声音层级、视频原声处理规则和最终剪辑流程。
- `assets/reference_images/`：Codex 已生成参考图和后续视频首帧落点。
- `PRODUCTION_BOARD.md`：可视化生产分区和资产实验规则。
- `workflow_board.json`：机器可读的生产看板，记录分区、输入、输出、状态和成本保护。
- `experiments.jsonl`：实验节点队列，先试错再进入付费视频。
- `character_prompts.jsonl`：人物一致性补图提示词。
- `moodboard_prompts.jsonl`：场景 moodboard 和光影测试提示词。
- `fusion_prompts.jsonl`：人物+场景融合测试提示词。
- `multicam_prompts.jsonl`：关键镜头 3x3 九宫格多机位提示词。
- `qa_rules.json`：审核标签和进入 Seedance 前的必检规则。

## 生产规则

有效短剧视频不是“一次 prompt 出片”。生产上先把人物、场景、光影、构图、融合、多机位和问题标签形成资产池，再把通过审核的首帧交给视频模型。视频节点如果做成 10-15 秒，也应在提示词里拆成 10-18 个内部视觉节拍；换算到成片观感，单个视觉点通常约 0.8-1.5 秒。

因此本项目现在按三段式执行：

1. **资产实验**：人物三视图、表情动作、场景 moodboard、光影调性、人物+场景融合、多机位九宫格。
2. **人工筛选**：用 `qa_rules.json` 给每张图打标签，只把 `usable_for_seedance` 的结果写入 `video_refs`。
3. **付费执行**：Seedance 只吃审核通过的首帧，先单镜，再批量。

## 建议工作流

1. 先审 `story_bible.md`、`PLAN.md` 和 `shots.jsonl`，确认第一集 37 镜短切节奏。
2. 按 `experiments.jsonl` 的优先级先跑图片实验，不直接批量出视频首帧。
3. 先补人物和场景：`character_prompts.jsonl`、`moodboard_prompts.jsonl`。
4. 再跑融合和多机位：`fusion_prompts.jsonl`、`multicam_prompts.jsonl`。
5. 每次只选 3-5 张图做人眼审核，按 `qa_rules.json` 标注问题。
6. 只有通过审核的图，才复制到 `assets/reference_images/video_refs/<shot_id>.png`。
7. 付费视频前先跑预检，确认审批、首帧、字幕和音频计划状态：

```powershell
node .\bin\welopc-drama-agent.js preflight --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

8. 确认首帧后执行本地审批：

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

9. 第一轮只提交 E01_S011 一个 Seedance 镜头测试画风和运动稳定性：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\wo-zai-xianmen-dang-waimen-dizi --batch 1 --resolution 480p --execute
```

10. 成功后轮询下载：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\wo-zai-xianmen-dang-waimen-dizi --poll
```

11. 视频片段稳定后，再导入 BGM、生成或导入 SFX/配音，最后合成：

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\wo-zai-xianmen-dang-waimen-dizi --provider manual --file .\bgm.mp3
node .\bin\welopc-drama-agent.js compose --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

`compose` 会把 `shots.jsonl` 的对白字幕和 `subtitle_timeline.jsonl` 的非对白信息字幕合并写入 `outputs/final/subtitles.srt`，再作为字幕轨进入最终 MP4 合成。

合成时 Seedance 视频只作为画面轨使用。若源视频带音轨，`compose` 会忽略源音频；最终声音只来自后期 BGM、SFX、环境声和人物配音。Seedance 2.0 输出按 5 秒档生成，合成阶段按 `shots.jsonl` 的目标时长裁切。

## 成本控制

- 视频先用 `480p`，单次 `--batch 1`，确认模型和画风后再批量。
- 不使用 `--allow-placeholder` 提交付费任务，必须先有真实 Codex 首帧。
- `preflight` 若显示 `approval.status` 不是 `current`，必须先重新 `approve`，不直接执行付费渲染。
- 先做第 11 镜“云舟压境”质量测试，再扩展到第 21 镜“拂尘牵引”和第 28 镜“林溪升空”。
- BGM/SFX 优先手工导入或低成本生成；人物配音默认保留为可选项，先用字幕、呼吸、环境声和音色动机完成情绪表达。
- 非对白信息字幕只补关键关系，不解释世界观，不替代镜头表演；字幕轨确认后再进入首版 MP4 合成。
