# 《我在仙门当外门弟子》短剧 Agent 项目

这是基于小说素材拆出的专业级短剧生产包。文件名《摸鱼日记4.27.docx》更像临时稿名，当前短剧项目统一使用《我在仙门当外门弟子》：主线是村中少女林溪被霄怀派云舟接走，从外门日常进入宗门悬疑。

## 当前状态

- 2026-05-15 已完成源文复核：原始 `.docx` 为 24 章仙门成长小说，旧中板只能作为接口连通样片，不再作为正片或剧情依据。
- 已新增 `SOURCE_AUDIT.md` 和 `E01_REWRITE_PLAN.md`，并已把 `shots.jsonl`、`video_prompts.jsonl`、`video_node_packing_plan.jsonl`、配音和字幕切到新版源文锁定方案。
- 旧版分镜、旧视频节点和旧中板已经从执行链路中剥离，只保留为接口连通和成本参考。
- 第一季方向已确定：竖屏 9:16，第一季 24 集，单集 60-90 秒。
- 第一集已改为《平溪村云舟》：只改编原文第一章，75 秒、35 镜、15 个 5 秒视频节点，结尾落在林溪离开平溪村。
- 已有 Codex image-gen 参考图：林溪、温庚然、平溪村院子、E01_S011 云舟参考图、整体视觉圣经。
- 已完成一次 Seedance 付费测试：`E01_S011` 生成 5 秒视频，文件为 `outputs/clips/E01_S011.mp4`；本地估算成本约 1.86 元，真实费用以火山方舟账单为准。该视频只证明接口可用，画面质量和剧情均不进入新版审核。
- 已加入非对白信息字幕：5 条，只提高信息密度，不进入 TTS，也不替代人物对白。
- 已明确音频策略：视频模型原声不进入最终成片，最终混音只使用后期 BGM、环境声、SFX 和人物配音。

## 核心更新

当前核心更新是“源文锁定优先”。旧版 37 镜和 17 个视频节点保留为技术草稿，但不能继续付费渲染。新版第一集已经按 `E01_REWRITE_PLAN.md` 重写：

- 已按原文第一章重写 35 个短分镜。
- 已把短分镜打包成 15 个 5 秒候选视频节点。
- 每个视频节点包含 2-3 个 `visual_beats`。
- 每个 `visual_beats` 都要有独立参考图 `image_ref`。
- 适配器支持多图时必须把 `reference_frames[]` 全部传给视频模型。
- 如果当前适配器只能传首帧，必须把其余节拍图写入请求元数据和 prompt，并记录降级。
- 成片剪辑时仍按短分镜切点裁切，不让 5 秒最低时长拖慢节奏。

成本估算：按本地价格快照，480p 5 秒 `doubao-seedance-2-0-fast-260128` 约 1.86 元/个。旧 37 镜逐条提交约 68.82 元；旧 17 个打包节点约 31.62 元。新版 15 个节点预计视频模型基础成本约 27.90 元，真实费用以火山方舟账单为准。

## 关键文件

- `PLAN.md`：第一集剧情、分镜、下一步执行计划。
- `SOURCE_AUDIT.md`：原文审计、章节地图、第一集事实边界。
- `E01_REWRITE_PLAN.md`：新版第一集剧情、镜头和声音重写方案。
- `shots.jsonl`：新版 75 秒、35 个源文锁定短分镜。
- `video_node_packing_plan.jsonl`：新版 15 个 5 秒视频节点打包表。
- `video_node_packing_rules.md`：5 秒节点打包、参考图、成本和音效规则。
- `qa_rules.json`：人工审核标签、Seedance 前置门禁、打包节点门禁。
- `workflow_board.json`：机器可读生产看板。
- `audio_plan.md`：BGM、SFX、人物声音和字幕策略。
- `audio_layer_design.md`：最终剪辑层级、模型原声处理和后期混音规则。
- `subtitle_timeline.jsonl`：非对白信息字幕时间线。
- `render_queue.jsonl`：待执行任务队列。
- `assets/reference_images/`：Codex image-gen 生成的参考图资产。
- `outputs/clips/E01_S011.mp4`：已成功下载的 Seedance 测试片段。

## 执行规则

1. 先补人物、场景、融合图和多机位图，不直接批量烧视频额度。
2. 按 `video_node_packing_plan.jsonl` 的 `visual_beats` 补参考图，而不是只按单镜头补图。
3. 参考图必须按 `qa_rules.json` 人工审核，通过后才能进入 `assets/reference_images/video_refs/`。
4. `video_node_packing_plan.jsonl`、`qa_rules.json`、`shots.jsonl`、音频方案或字幕方案变化后，都必须重新 `approve`。
5. 付费执行前先跑 `preflight`，确认审批、参考图、音频和字幕状态。
6. 视频模型可理解音效，但模型音频只作参考；最终混音不使用源视频音轨。

## 常用命令

```powershell
node .\bin\welopc-drama-agent.js preflight --project .\projects\wo-zai-xianmen-dang-waimen-dizi
node .\bin\welopc-drama-agent.js approve --project .\projects\wo-zai-xianmen-dang-waimen-dizi
node .\bin\welopc-drama-agent.js render --project .\projects\wo-zai-xianmen-dang-waimen-dizi --batch 1 --resolution 480p --execute
node .\bin\welopc-drama-agent.js status --project .\projects\wo-zai-xianmen-dang-waimen-dizi --poll
node .\bin\welopc-drama-agent.js compose --project .\projects\wo-zai-xianmen-dang-waimen-dizi
```
