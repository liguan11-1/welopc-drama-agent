# 《我在仙门当外门弟子》短剧 Agent 项目

这是基于用户提供小说《摸鱼日记4.27.docx》现有内容拆出的专业级短剧生产包。文件名更像临时稿名，正式短剧建议用《我在仙门当外门弟子》：更贴合“村中孤女入仙门、外门成长、宗门悬疑”的主体，也比“摸鱼日记”更利于短剧封面和平台分发。

## 当前做到哪儿了

- 已解析小说素材：约 6.18 万字、24 章，核心人物和第一季主线已梳理。
- 已确定产品形态：竖屏 9:16，第一季 24 集，单集 60-90 秒，第一集按 70 秒、22 个镜头设计。
- 已完成第一集生产包：人物、场景、道具、分镜、视频提示词、BGM/SFX/声音设计、配音策略和后续执行计划。
- 已生成 5 张 Codex 生图参考图：林溪、温庚然、平溪村院子、云舟到来、整体视觉圣经。
- 已按参考画布案例补充工业化实验层：生产看板、实验队列、多机位九宫格、人物场景融合、moodboard、光影测试和 QA 标签。
- 未提交 Seedance 付费视频任务：目前只是准备素材和计划，避免在首帧未完全确认时消耗额度。

## 当前项目文件

- `manifest.json`：项目元信息和状态。
- `story_bible.md`：小说拆解、第一季结构和人物关系。
- `PLAN.md`：从现在继续做视频、BGM、配音、合成的执行计划。
- `characters.json` / `scenes.json` / `props.json`：角色、场景、道具设定。
- `shots.jsonl`：第一集 22 个镜头，含时长、运镜、画面、台词和声音提示。
- `video_prompts.jsonl`：Seedance 图生视频任务提示词。
- `image_prompts.jsonl`：Codex 生图首帧提示词。
- `audio_plan.md` / `voice_cast.json` / `bgm_prompts.jsonl` / `sfx_prompts.jsonl`：BGM、SFX、声音动机和可选人物配音策略。
- `assets/reference_images/`：Codex 已生成参考图和后续视频首帧落点。
- `PRODUCTION_BOARD.md`：参考外部生产画布后的可视化生产分区。
- `workflow_board.json`：机器可读的生产看板，记录分区、输入、输出、状态。
- `experiments.jsonl`：实验节点队列，先试错再进入付费视频。
- `character_prompts.jsonl`：人物一致性补图提示词。
- `moodboard_prompts.jsonl`：场景 moodboard 和光影测试提示词。
- `fusion_prompts.jsonl`：人物+场景融合测试提示词。
- `multicam_prompts.jsonl`：关键镜头 3x3 九宫格多机位提示词。
- `qa_rules.json`：审核标签和进入 Seedance 前的必检规则。

## 参考画布带来的调整

之前分析的参考画布显示，它不是“一次 prompt 出片”，而是 942 个节点组成的生产看板：图片资源 662 个、图片生成 115 个、分组 61 个、文本设定 53 个，视频生成只有 32 个。也就是说，视频之前的大量试错和筛选才是关键。

因此本项目现在改成三段式：

1. **资产实验**：人物三视图、表情动作、场景 moodboard、光影调性、人物+场景融合、多机位九宫格。
2. **人工筛选**：用 `qa_rules.json` 给每张图打标签，只把 `usable_for_seedance` 的结果写入 `video_refs`。
3. **付费执行**：Seedance 只吃审核通过的首帧，先单镜，再批量。

## 建议工作流

1. 先审 `story_bible.md`、`PLAN.md` 和 `shots.jsonl`，确认第一集 22 镜节奏。
2. 按 `experiments.jsonl` 的优先级先跑图片实验，不直接批量出视频首帧。
3. 先补人物和场景：`character_prompts.jsonl`、`moodboard_prompts.jsonl`。
4. 再跑融合和多机位：`fusion_prompts.jsonl`、`multicam_prompts.jsonl`。
5. 每次只选 3-5 张图做人眼审核，按 `qa_rules.json` 标注问题。
6. 只有通过审核的图，才复制到 `assets/reference_images/video_refs/<shot_id>.png`。
7. 确认首帧后执行本地审批：

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

8. 第一轮只提交 E01_S011 一个 Seedance 镜头测试画风和运动稳定性：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\wo-zai-xianmen-dang-waimen-dizi --batch 1 --resolution 480p --execute
```

9. 成功后轮询下载：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\wo-zai-xianmen-dang-waimen-dizi --poll
```

10. 视频片段稳定后，再导入 BGM、生成或导入 SFX/配音，最后合成：

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\wo-zai-xianmen-dang-waimen-dizi --provider manual --file .\bgm.mp3
node .\bin\welopc-drama-agent.js compose --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

## 成本控制

- 视频先用 `480p`，单次 `--batch 1`，确认模型和画风后再批量。
- 不使用 `--allow-placeholder` 提交付费任务，必须先有真实 Codex 首帧。
- 先做第 11 镜“云舟压境”和第 21 镜“林溪升空”两个关键镜头质量测试，再扩展到全片。
- BGM/SFX 优先手工导入或低成本生成；人物配音默认保留为可选项，先用字幕、呼吸、环境声和音色动机完成情绪表达。
