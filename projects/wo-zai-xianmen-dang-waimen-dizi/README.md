# 《我在仙门当外门弟子》短剧 Agent 项目

这是基于用户提供小说《摸鱼日记4.27.docx》现有内容拆出的专业级短剧生产包。文件名更像临时稿名，正式短剧建议用《我在仙门当外门弟子》：更贴合“村中孤女入仙门、外门成长、宗门悬疑”的主体，也比“摸鱼日记”更利于短剧封面和平台分发。

## 当前做到哪儿了

- 已解析小说素材：约 6.18 万字、24 章，核心人物和第一季主线已梳理。
- 已确定产品形态：竖屏 9:16，第一季 24 集，单集 60-90 秒，第一集按 70 秒、22 个镜头设计。
- 已完成第一集生产包：人物、场景、道具、分镜、视频提示词、BGM/SFX/声音设计、配音策略和后续执行计划。
- 已生成 5 张 Codex 生图参考图：林溪、温庚然、平溪村院子、云舟到来、整体视觉圣经。
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

## 建议工作流

1. 先审 `story_bible.md`、`PLAN.md` 和 `shots.jsonl`，确认第一集 22 镜节奏。
2. 用 Codex imagegen 按 `imagegen_prompts.jsonl` 继续补齐 `assets/reference_images/video_refs/E01_S001.png` 到 `E01_S022.png`。
3. 每次只选 3-5 张首帧做人眼审核，避免人物一致性跑偏。
4. 确认首帧后执行本地审批：

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

5. 第一轮只提交 1 个 Seedance 镜头测试画风和运动稳定性：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\wo-zai-xianmen-dang-waimen-dizi --batch 1 --resolution 480p --execute
```

6. 成功后轮询下载：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\wo-zai-xianmen-dang-waimen-dizi --poll
```

7. 视频片段稳定后，再导入 BGM、生成或导入 SFX/配音，最后合成：

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\wo-zai-xianmen-dang-waimen-dizi --provider manual --file .\bgm.mp3
node .\bin\welopc-drama-agent.js compose --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```

## 成本控制

- 视频先用 `480p`，单次 `--batch 1`，确认模型和画风后再批量。
- 不使用 `--allow-placeholder` 提交付费任务，必须先有真实 Codex 首帧。
- 先做第 11 镜“云舟压境”和第 21 镜“林溪升空”两个关键镜头质量测试，再扩展到全片。
- BGM/SFX 优先手工导入或低成本生成；人物配音默认保留为可选项，先用字幕、呼吸、环境声和音色动机完成情绪表达。

