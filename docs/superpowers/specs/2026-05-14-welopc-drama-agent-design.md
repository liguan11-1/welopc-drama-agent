# WelOPC 短剧 Agent 设计文档

## 摘要

`welopc-drama-agent` 是一个独立的 WelOPC 场景包，用于 AI 短剧和漫剧生产。它把主题、梗概、剧本或小说片段转成完整生产包，经过人工审核后，再进入视频生成和最终合成。

第一版面向内部 / 自用场景，优先做 CLI。这样后续可以接入 WelOPC 场景包，也方便在服务器、定时任务或低峰期自动跑批。Web 工作区只作为审阅和运营层，不承载核心业务逻辑。

## 目标

- 同时支持“主题创作”和“剧本改编”。
- 在消耗视频生成费用前，先生成可审核的完整生产包。
- 支持 45-60 秒短剧的分批渲染。
- 保持项目状态可恢复，失败或未完成任务可以继续执行。
- 把 BGM、音效、旁白作为可选但一等的模块。
- 先保证本地单人工作流可用，暂不引入登录、付费、多用户隔离等 SaaS 能力。

## 非目标

- 第一版不做公开 SaaS 账号系统。
- 第一版不做支付、额度、团队权限系统。
- 核心视频链路不强依赖 BGM 生成 API。
- 生产包未审核前，不默认允许直接整片付费渲染。

## 产品形态

当前优先暴露 CLI 命令，后续再接入 WelOPC 场景包入口。

```powershell
welopc-drama-agent new --topic "白骨精不想再演反派了" --out .\projects\baigujing
welopc-drama-agent import --script .\story.md --out .\projects\story
welopc-drama-agent web --project .\projects\baigujing
welopc-drama-agent approve --project .\projects\baigujing
welopc-drama-agent render --project .\projects\baigujing --batch 3 --resolution 480p
welopc-drama-agent bgm --project .\projects\baigujing --provider manual --file .\bgm.mp3
welopc-drama-agent compose --project .\projects\baigujing
```

未来 WelOPC 别名可以收敛为：

```powershell
welopc drama new --topic "白骨精不想再演反派了"
welopc drama render --project .\projects\baigujing --continue
welopc drama status --project .\projects\baigujing --poll
```

Web 工作区负责展示故事、角色、场景、分镜、图片提示词、视频提示词、渲染队列、音频方案和输出状态。

## 架构

```text
CLI 层
  new / import / web / approve / render / bgm / compose

核心 Agent 层
  StoryAgent：故事结构
  CharacterAgent：角色设定
  SceneAgent：场景设定
  DirectorAgent：分镜和运镜
  PromptAgent：生图和视频提示词
  AudioAgent：BGM、音效、旁白
  QueueAgent：渲染队列
  QCAgent：审核清单

项目层
  读取和写入稳定的本地项目目录。

渲染层
  图片提供方：内置分镜图、图片 API、后续适配器。
  视频提供方：优先 Seedance API，可选即梦 CLI 兜底。
  音频提供方：先支持本地音频文件，后续可接 BGM API。
  合成提供方：ffmpeg。

Web 层
  本地项目看板和审阅界面。
```

CLI 和 Web 工作区都读取同一套项目文件。这样核心流程可移植，Web UI 也可以替换。

## 项目目录

每个短剧项目都是一个结构化目录：

```text
project/
  manifest.json
  style_pack.json
  story_bible.md
  characters.json
  scenes.json
  props.json
  episode_outline.md
  shots.jsonl
  image_prompts.jsonl
  video_prompts.jsonl
  audio_plan.md
  bgm_prompts.jsonl
  sfx_prompts.jsonl
  voiceover_script.md
  render_queue.jsonl
  review_checklist.md
  approval.json
  render_state.json
  assets/
    keyframes/
    audio/
  outputs/
    clips/
    audio/
    final.mp4
  index.html
```

`approval.json` 是“规划”和“付费渲染”之间的门禁。默认情况下，视频渲染命令必须在生产包审批后才允许继续，除非用户显式使用强制参数。

## 工作流

### 1. 输入

用户可以从主题或已有剧本开始。

主题模式会把一句话扩展成 logline、核心冲突、反转、集内节拍和结尾钩子。

剧本模式会解析输入材料，提取主线，压缩成短剧结构，并保留重要人物和剧情约束。

### 2. 生产包

核心 Agent 层生成：

- 故事设定
- 角色设定
- 场景设定
- 道具列表
- 集内大纲
- 分镜列表
- 图片提示词
- 视频提示词
- 音频方案
- 渲染队列
- 审核清单

生产包同时面向人和机器：Markdown 用于审阅，JSON / JSONL 用于自动化。

### 3. 审核

Web 工作区展示生产包。用户至少检查：

- 故事方向
- 角色一致性
- 视觉风格
- 分镜顺序和时长
- 提示词质量
- 预估渲染成本
- 音频方案

用户可以通过 CLI 或 Web 审批生产包。审批会在 `approval.json` 中记录时间戳和已审批生产包哈希。

### 4. 渲染

渲染按批次执行，默认每批三个镜头。默认首轮策略：

- 生成或复用关键帧
- 提交 Seedance 图生视频任务
- 轮询任务状态
- 下载完成片段
- 失败后停止扩散，不无限重试
- 从 `render_state.json` 继续任务

内部低成本测试默认使用 `480p`。当风格和运镜验证通过后，再切到 `720p`。

### 5. 音频

音频是可选模块，但按一等模块设计。

默认模式：

- `AudioAgent` 生成 `audio_plan.md`、`bgm_prompts.jsonl`、`sfx_prompts.jsonl` 和 `voiceover_script.md`。
- 用户可以把本地 BGM 放入或导入到 `assets/audio/bgm.mp3`。
- `compose` 通过 ffmpeg 把 BGM 混入最终视频。

可选 BGM API 模式：

```powershell
welopc-drama-agent bgm --project .\projects\baigujing --provider minimax
```

适配器会生成 `outputs/audio/bgm.mp3`，并把状态写入 `render_state.json`。可选提供方包括 Minimax、Mureka、Suno、Udio 或后续其他 API，但 MVP 不依赖它们。

### 6. 合成

`compose` 使用 ffmpeg 拼接视频片段，并可选混入 BGM。

命令必须检查：

- 所有必需片段都存在
- 片段顺序和 `shots.jsonl` 一致
- 输出尺寸适合 H.264
- 只有请求混音时才要求 BGM 存在
- 最终输出写入 `outputs/final.mp4`

## 成本和失败控制

- 默认审批前不允许渲染。
- 批次大小默认三个镜头。
- 第一轮内部测试使用 `480p`。
- 失败任务记录错误信息和重试次数。
- 自动重试最多一次。
- 两次失败后进入人工检查。
- `status --poll` 可以复用已有任务 ID，不重复提交。
- `render --continue` 只提交缺失或已允许重试的任务。

## 可复用资产

第一版实现应复用当前工作区已有资产：

- `docs/one_click_manga_automation_blueprint.md`
- `prompts/manga_one_click_master_prompt.md`
- `prompts/style_d_dark_myth_manga.json`
- `scripts/create_manga_demo_baigujing.js`
- `scripts/render_manga_project.js`
- `demo/manga-agent-demo/baigujing-kpi/`
- `production_board.json`
- `visual_production_report.md`

白骨精短剧项目应成为第一个样例包和回归测试夹具。

## MVP 验收标准

MVP 完成时应满足：

1. 主题可以生成完整项目目录。
2. 剧本文件可以生成完整项目目录。
3. 项目包含故事、角色、场景、分镜、提示词、音频方案、渲染队列和审核清单。
4. 本地 Web 工作区可以展示生产包并支持审批。
5. 审批前渲染会被拒绝。
6. 审批后可以按批提交视频任务。
7. 状态轮询可以恢复任务并下载片段。
8. 合成可以生成 `outputs/final.mp4`。
9. 存在本地 BGM 时，可以混入最终视频。
10. 失败状态可记录、可恢复，不需要重建项目。

## 第一阶段实现范围

提供方适配器保持可插拔，但第一阶段使用最小集合：

- Seedance 视频 API
- 内置分镜关键帧生成器
- 本地 BGM 导入
- ffmpeg 合成

其他图片、视频和 BGM 提供方可以在项目格式稳定后继续添加。
