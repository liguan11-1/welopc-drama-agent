# WelOPC 短剧 Agent

`welopc-drama-agent` 是一个 CLI 优先的 WelOPC 场景包，用于把主题或剧本拆解成可执行的 AI 短剧 / 漫剧生产项目。

当前阶段先围绕 CLI 跑通本地工作流：生成项目、人工审核、审批解锁、准备分批渲染、导入本地 BGM，并为后续 Seedance 视频任务和 ffmpeg 合成保留状态文件。

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

生成后项目目录会包含：

- `manifest.json`：项目元信息
- `story_bible.md`：故事设定
- `characters.json`：角色设定
- `scenes.json`：场景设定
- `shots.jsonl`：分镜列表
- `image_prompts.jsonl`：关键帧 / 生图提示词
- `video_prompts.jsonl`：视频生成提示词
- `audio_plan.md`：音频方案
- `render_queue.jsonl`：渲染队列
- `review_checklist.md`：审核清单
- `index.html`：本地可视化预览页

## 审核与审批

先打开项目里的 `index.html` 检查故事、角色、分镜、提示词、渲染队列和音频方案。

确认后再执行审批：

```powershell
node .\bin\welopc-drama-agent.js approve --project .\projects\baigujing
```

审批会生成 `approval.json`，里面记录审批时间和当前生产包哈希。后续如果修改了生产包，需要重新审批。

## 准备渲染批次

默认情况下，`render` 只生成本地分镜关键帧占位图，并更新 `render_state.json`，把镜头标记为等待 Seedance 提交。

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 3 --resolution 480p
```

建议首轮内部测试使用 `480p` 和 `--batch 3`，先验证风格和运镜，再扩大批次或提高分辨率。

## 配置 Seedance Key

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

`.env.local` 已被 `.gitignore` 忽略，不会提交到仓库。

## 提交 Seedance 视频任务

只有显式传入 `--execute` 才会提交真实 Seedance 任务并消耗额度。建议第一条先跑一镜：

```powershell
node .\bin\welopc-drama-agent.js render --project .\projects\baigujing --batch 1 --resolution 480p --execute
```

提交成功后，`render_state.json` 会记录 `provider_task_id`，不会记录 API key。

查询和下载完成的视频片段：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\baigujing --poll
```

`--poll` 默认最多轮询 60 次，每 20 秒一次。需要更短试跑时可以加：

```powershell
node .\bin\welopc-drama-agent.js status --project .\projects\baigujing --poll --poll-attempts 3 --poll-interval-sec 10
```

完成片段会写入 `outputs/clips/`，并回填到 `render_state.json`。

## 生成 Web 预览页

```powershell
node .\bin\welopc-drama-agent.js web --project .\projects\baigujing
```

该命令会重新生成项目下的 `index.html`。目前它是静态审阅页，不是完整 Web 控制台。

## 导入 BGM

当前先支持手动导入本地音频文件：

```powershell
node .\bin\welopc-drama-agent.js bgm --project .\projects\baigujing --provider manual --file .\bgm.mp3
```

文件会复制到 `assets/audio/bgm.mp3`，状态写入 `outputs/audio/bgm_state.json`。后续可以再接入 BGM API。

## 合成计划

当所有视频片段已经存在于 `render_state.json` 指向的位置后，可以生成 ffmpeg 合成计划：

```powershell
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing
```

默认只写入 dry-run 计划，不直接执行 ffmpeg。确认素材齐全后可加 `--execute`：

```powershell
node .\bin\welopc-drama-agent.js compose --project .\projects\baigujing --execute
```

## 测试

```powershell
npm test
```

## 当前边界

- 已完成：CLI 项目生成、审批门禁、本地分镜关键帧准备、Seedance 任务提交、状态查询与视频下载、静态 Web 预览、本地 BGM 导入、合成计划。
- 未完成：更细的失败重试策略、BGM API、完整 Web 控制台、WelOPC 场景包安装入口。
