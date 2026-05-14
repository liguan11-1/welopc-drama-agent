# WelOPC 短剧 Agent

`welopc-drama-agent` 是一个 CLI 优先的 WelOPC 场景包，用于把主题或剧本拆解成可执行的 AI 短剧 / 漫剧生产项目。

当前主流程是：生成项目、生成 Codex 生图参考包、审核审批、提交 Seedance 视频、生成声音设计、导入 BGM/SFX、本地合成。人物台词默认以字幕呈现，不默认生成 TTS。

## 安装

```powershell
npm install
```

## 创建项目

从一个主题开始：

```powershell
node .\bin\welopc-drama-agent.js new --topic "白骨精不想再演反派了" --out .\projects\baigujing
```

从已有剧本导入：

```powershell
node .\bin\welopc-drama-agent.js import --script .\story.md --out .\projects\story
```

生成后项目目录会包含故事设定、角色设定、分镜、视频提示词、Codex 生图提示词、声音设计、渲染队列和本地预览页。

## 审核与审批

先打开项目里的 `index.html` 检查故事、角色、分镜、提示词、渲染队列和音频方案。

确认后再执行审批：

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\baigujing
```

审批会生成 `approval.json`。如果之后修改生产包，需要重新审批。

## Codex 生图参考图

项目创建后会自动生成 Codex 生图资产包：

- `imagegen_manifest.json`：生图资产包摘要
- `imagegen_prompts.jsonl`：人物、镜头、分镜、视频首帧参考图提示词
- `imagegen_workflow.md`：低成本生成顺序
- `assets/reference_images/`：生成图落盘目录

也可以手动刷新：

```powershell
node .\bin\welopc-drama-agent.js images --project .\projects\baigujing
```

推荐顺序：

1. 先生成 `character_reference`，保存到 `assets/reference_images/characters/`。
2. 再生成 `camera_reference` 和 `storyboard_panel`，检查镜头与分镜。
3. 最后生成 `video_reference_frame`，保存到 `assets/reference_images/video_refs/<shot_id>.png`。

`render --execute` 会优先把 `video_refs/<shot_id>.png` 作为 Seedance 图生视频首帧。为了控制额度，第一轮建议只生成 `E01_S001` 的视频参考图并提交一镜。

## Seedance 视频

复制 `.env.example` 为 `.env.local`，只在本地填写真实 key：

```powershell
Copy-Item .env.example .env.local
```

至少需要：

```dotenv
ARK_API_KEY=你的火山方舟 API Key
ARK_VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_VIDEO_MODEL=doubao-seedance-2-0-fast-260128
VIDEO_RESOLUTION=480p
VIDEO_RATIO=9:16
VIDEO_GENERATE_AUDIO=false
```

默认 `render` 只准备本地关键帧和状态文件，不消耗额度：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 3 --resolution 480p
```

只有加 `--execute` 才会提交真实 Seedance 任务。默认会要求对应 `assets/reference_images/video_refs/<shot_id>.png` 已由 Codex 生图生成，避免用占位图消耗视频额度：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 1 --resolution 480p --execute
```

如果你明确要做一次低质量链路测试，可以显式允许占位图：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 1 --resolution 480p --execute --allow-placeholder
```

轮询并下载视频片段：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\baigujing --poll
```

## 声音设计

默认音频策略是声音设计优先，不生成角色 TTS。角色台词保留为字幕 / 分镜文本，人物情绪通过声音动机表达。

重新生成声音设计包：

```powershell
node .\bin\welopc-drama-agent.js sound --project .\projects\baigujing
```

该命令会生成：

- `sound_design.jsonl`：每个分镜的声音设计
- `ambience_prompts.jsonl`：环境声提示词
- `sfx_prompts.jsonl`：动作音效提示词
- `outputs/audio/mix_plan.json`：BGM / SFX 混音计划

你可以把真实音频素材放到：

```text
assets/audio/bgm.mp3
assets/audio/sfx/<cue_id>.mp3
```

`compose` 会自动读取 `mix_plan.json`，按分镜时间点用 `adelay` 混入本地 BGM/SFX。

## 导入 BGM

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\baigujing --provider manual --file .\bgm.mp3
```

文件会复制到 `assets/audio/bgm.mp3`。

## 合成

当视频片段已经存在后，生成 ffmpeg 合成计划：

```powershell
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing
```

确认素材齐全后执行：

```powershell
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing --execute
```

## 可选 TTS

TTS 已作为可选插件保留，但不属于默认主流程。需要人物真配音时，再配置火山豆包语音合成：

```dotenv
VOLCENGINE_TTS_APPID=你的语音合成 AppID
VOLCENGINE_TTS_ACCESS_TOKEN=你的语音合成 Access Token
```

```powershell
node .\bin\welopc-drama-agent.js voice --project .\projects\baigujing --provider volcengine --batch 3 --execute
node .\bin\welopc-drama-agent.js voice-status --project .\projects\baigujing --poll
```

## 测试

```powershell
npm test
```

## 当前边界

- 已完成：CLI 项目生成、Codex 生图参考包、审批门禁、Seedance 视频提交/轮询/下载、声音设计包、BGM/SFX 混音计划、本地 BGM 导入、可选 TTS、静态 Web 预览。
- 未完成：自动生成真实 SFX/BGM 音频、细粒度失败重试、完整 Web 控制台、WelOPC 场景包安装入口。
