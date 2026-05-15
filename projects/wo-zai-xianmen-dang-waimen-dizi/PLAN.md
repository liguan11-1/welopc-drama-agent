# 《我在仙门当外门弟子》制作计划

## 2026-05-15 更新：源文校准与第一集重做

- 原始 `.docx` 已抽取为 `D:/Agent/agent infra/.tmp/novel_extract.txt`，确认正文为 24 章仙门成长小说。
- 新增 `SOURCE_AUDIT.md`：记录章节地图、第一集源文事实、旧分镜偏差和后续执行规则。
- 新增 `E01_REWRITE_PLAN.md`：第一集改为只覆盖原文第一章，结尾落在“林溪离开平溪村”，不再把测灵异常当作切黑悬念。
- 已重写 `shots.jsonl`、`video_prompts.jsonl`、`video_node_packing_plan.jsonl`、`voiceover_script.md` 和 `subtitle_timeline.jsonl`。旧中板全部降级为样片/草稿。
- 新规则：任何人物、道具、剧情事实进入分镜前，必须能回指到 `SOURCE_AUDIT.md` 或原文章节；不能把补戏直接写成正片事实。

## 2026-05-15 更新：视频节点与声音规则

- 第一集不再沿用旧 37 个短分镜和旧 17 个 Seedance 节点。新版已经按 `E01_REWRITE_PLAN.md` 重写为 35 镜和 15 个 5 秒节点。
- 每个新版 `visual_beats` 都要有独立参考图，参考图由 Codex image-gen 生成并人工审核。适配器支持多图时传 `reference_frames[]` 全量图片；如果只能传首帧，则必须把其他节拍图写入请求元数据和 prompt，并记录降级。
- Seedance 2.0 Fast 仍按 5 秒节点生成，成片阶段按 `visual_beats` 和 `shots.jsonl` 的目标切点裁切，不能因为最低 5 秒而拉长正片节奏。
- 视频模型允许生成或理解音效作为画面运动参考，但模型音频不进入最终成片。最终混音只使用后期 BGM、环境声、SFX 和人物配音。
- `video_node_packing_plan.jsonl` 和 `qa_rules.json` 已纳入审批包，任何改动都会让 `preflight` 显示审批过期，付费渲染前必须重新 `approve`。

## 目标

把小说现有 24 章改造成一套可 CLI 化执行的短剧 Agent 项目：用户以后只需要输入主题或剧本，Agent 自动拆出角色、图像参考、分镜、运镜、视频提示词、提词、BGM、SFX、配音策略和继续任务队列。

## 第一季规划

- 集数：24 集。
- 每集：60-90 秒，30-40 镜，优先采用短切、多景别、高信息密度节奏。
- 主线：林溪从平溪村离开，进入霄怀派外门，在日常任务与后山异变中发现宗门内部有隐秘操控。
- 第一季终点：方若生虫化事件结束，幕后黑手未揭露，留下第二季钩子。

## 第一集：平溪村云舟

第一集只改编原文第一章，不再提前制造宗门阴谋。目标是完成“林溪盼仙门、云舟抵达、测出三灵根、离别平溪村”四个动作，结尾落在林溪朝温庚然和伙伴喊“大家等我回来”后躲进船内哭。

新版详表见 `E01_REWRITE_PLAN.md`，核心口径如下：

- 目标时长：约 75 秒。
- 目标镜头：约 35 镜。
- 视频节点：约 15 个 5 秒节点，每个节点 2-3 个视觉节拍。
- 对白：保留林溪、温庚然、女修、男修的关键原文台词。
- 非对白字幕：只补“第五十八次看天”“五年一次仙门选拔”“前面孩子都未亮镜”“金水木三灵根”“第一次离开家”等必要信息。
- 旧版 37 镜、旧版 17 个视频节点、旧中板均只保留为接口和成本参考，不进入新版付费渲染。

## 人物一致性策略

- 林溪：8 岁左右，瘦小，双辫，衣着朴素，前期手持卷起的树叶筒；不要成人化，不要仙女化。
- 温庚然：灰发灰须，旧袍，安然堂老人和村长；第一集不要提前演成隐藏强者。
- 霄怀派女修：有礼貌、业务熟练、动作干净，拂尘接引；不要演成反派或冷酷审判者。
- 铜镜：纯金镜框、繁杂符文、上下红宝石，这是第一集最重要的道具识别点。
- 画面统一：写实国风仙侠，村落温暖自然光，云舟出现后转为低悬压迫和灵力结界。

## 已完成资产

- `assets/reference_images/style/visual_bible_contact_sheet.png`
- `assets/reference_images/characters/lin_xi.png`
- `assets/reference_images/characters/wen_gengran.png`
- `assets/reference_images/scenes/pingxi_courtyard.png`
- `assets/reference_images/video_refs/E01_S011.png`
- `outputs/clips/E01_S011.mp4`：Seedance 5 秒输出档测试片段，合成时按 2.8 秒目标镜头裁切。

## 接下来继续做

1. 按 `imagegen_prompts.jsonl` 重新生成或筛选清晰参考图，不再使用草图化安全参考图进入正片链路。
2. 对新版 35 镜做人工 QA：源文锚点、人物年龄、道具是否正确、女修是否被反派化。
3. 跑 `preflight`，确认旧审批失效、新参考图齐全。
4. 重新 `approve` 后，再执行第一批最小付费测试，不直接批量烧额度。
5. 合成时忽略视频模型原声，只使用后期 BGM、SFX、环境声和人物配音。
6. 合成首版 MP4 后做四项 QA：人物脸是否跳变、剧情是否贴源文、镜头是否过长、字幕是否遮挡主体。

## 生产队列规则

这次新增的队列不是为了增加复杂度，而是为了避免“首帧没筛好就烧视频额度”。短剧工业化的关键是先积累可筛选资产池：图片资源、图片生成、人物场景融合、光影测试、多机位图和 QA 标签都应该先于付费视频。

新增文件：

- `PRODUCTION_BOARD.md`：可视化生产分区和当前差距。
- `workflow_board.json`：分区、输入输出、状态和成本保护。
- `subtitle_timeline.jsonl`：非对白信息字幕时间线，不进 TTS，用于合成字幕轨。
- `audio_layer_design.md`：视频原声、BGM、SFX、人物配音、字幕和最终剪辑的层级规则。
- `experiments.jsonl`：实验任务总队列。
- `character_prompts.jsonl`：人物一致性补图。
- `moodboard_prompts.jsonl`：场景和光影。
- `fusion_prompts.jsonl`：人物+场景融合。
- `multicam_prompts.jsonl`：关键镜头九宫格多机位。
- `qa_rules.json`：审核标签和 Seedance 前置门禁。

优先级最高的 5 个实验：

1. `EXP_CHAR_LIN_XI_ACTION_SHEET`
2. `EXP_CHAR_XIAO_HUAI_ENVOY`
3. `EXP_SCENE_VILLAGE_SQUARE_MOODBOARD`
4. `EXP_FUSION_E01_S016_LIN_XI_QUEUE`
5. `EXP_MULTICAM_E01_S011_SKY_BOAT`
