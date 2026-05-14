# WelOPC 短剧 Agent 实施计划

> 面向后续开发者：如果继续执行本计划，需要按 Superpowers 规则使用 `superpowers:test-driven-development`、`superpowers:verification-before-completion`，涉及推送时使用 GitHub 发布流程。

## 目标

先交付一个可安装、可测试、CLI 优先的 `welopc-drama-agent` 包，覆盖项目生成、审批门禁、本地 Web 审阅、BGM 导入和 ffmpeg 合成计划。

## 技术架构

- Node.js ESM 包。
- 暴露 `welopc-drama-agent` 和 `welopc-drama` 两个 bin 命令。
- 核心模块负责生成和校验项目文件。
- CLI 命令只编排核心模块。
- Web 工作区从同一套项目文件生成静态 HTML。
- 测试使用 Node 内置 `node:test`。
- 合成依赖 ffmpeg。

## 当前状态

第一阶段 CLI 骨架已完成并推送：

- 已完成 CLI help、`new`、`import`、`approve`、`render`、`web`、`bgm`、`compose`。
- 已完成确定性 9 镜头、45 秒项目生成。
- 已完成审批门禁和生产包哈希。
- 已完成本地关键帧占位生成和 `render_state.json`。
- 已完成静态 Web 预览页。
- 已完成本地 BGM 导入。
- 已完成 ffmpeg dry-run 合成计划。

尚未完成：

- Seedance 真实任务提交。
- 任务状态轮询。
- 视频片段下载。
- BGM API 生成。
- 完整 Web 控制台。
- WelOPC 场景包安装入口。

## 任务 1：包和 CLI 骨架

涉及文件：

- `package.json`
- `bin/welopc-drama-agent.js`
- `src/cli.mjs`
- `test/cli.test.mjs`

完成标准：

- `node .\bin\welopc-drama-agent.js --help` 可以输出帮助。
- 帮助里包含核心命令和 WelOPC 别名。
- `npm test` 中 CLI 测试通过。

状态：已完成。

## 任务 2：项目生成

涉及文件：

- `src/project-generator.mjs`
- `src/files.mjs`
- `src/cli.mjs`
- `test/project-generator.test.mjs`

完成标准：

- 主题模式可以创建完整项目目录。
- 剧本模式可以创建完整项目目录。
- 默认生成 9 个分镜、总时长 45 秒。
- 项目至少包含 `manifest.json`、`story_bible.md`、`characters.json`、`scenes.json`、`shots.jsonl`、`video_prompts.jsonl`、`audio_plan.md`、`render_queue.jsonl`、`index.html`。

状态：已完成。

## 任务 3：审批门禁和渲染准备

涉及文件：

- `src/approval.mjs`
- `src/render-state.mjs`
- `src/cli.mjs`
- `test/approval.test.mjs`

完成标准：

- 未审批项目不能执行渲染准备。
- `approve` 会写入 `approval.json`。
- `approval.json` 包含审批时间和生产包哈希。
- 生产包变更后审批失效。
- `render` 会生成本地关键帧，并更新 `render_state.json`。

状态：已完成。

## 任务 4：Web 工作区和音频

涉及文件：

- `src/web-workspace.mjs`
- `src/audio.mjs`
- `src/cli.mjs`
- `test/web-audio.test.mjs`

完成标准：

- `web` 可以重新生成项目内的 `index.html`。
- 页面展示故事、分镜、审批状态、渲染队列和音频方案。
- `bgm --provider manual --file bgm.mp3` 会把文件复制到 `assets/audio/bgm.mp3`。
- 音频导入状态写入 `outputs/audio/bgm_state.json`。

状态：已完成。

## 任务 5：合成命令

涉及文件：

- `src/compose.mjs`
- `src/cli.mjs`
- `test/compose.test.mjs`

完成标准：

- 缺少视频片段时，`compose` 明确拒绝。
- 视频片段齐全时，生成 ffmpeg concat list。
- 默认只生成 dry-run 计划。
- 只有传入 `--execute` 时才执行 ffmpeg。

状态：已完成。

## 任务 6：中文文档

涉及文件：

- `README.md`
- `docs/superpowers/specs/2026-05-14-welopc-drama-agent-design.md`
- `docs/superpowers/plans/2026-05-14-welopc-drama-agent-implementation.md`
- CLI 生成的 `audio_plan.md`
- CLI 生成的 `review_checklist.md`
- Web 工作区栏目文案

完成标准：

- 面向用户和后续开发者的文档统一为中文。
- CLI 生成的项目文档标题为中文。
- Web 预览页栏目为中文。
- 测试同步覆盖中文栏目。

状态：已完成。

## 下一阶段建议

下一阶段应先接 Seedance 真实视频任务，但仍保留费用保护：

1. 新增 `src/providers/seedance.mjs`，通过注入 `fetch` 做单元测试。
2. `render` 默认只准备任务，只有显式 `--execute` 才提交付费请求。
3. 新增 `status --poll`，支持轮询、下载、断点续跑。
4. 所有真实请求必须读取本地环境变量，不把 key 写入项目文件。
5. README 中补充 Seedance 开通、模型 ID、费用保护和失败恢复说明。

## 验证命令

```powershell
npm test
```
