# 5 秒视频节点打包规则

## 目的

Seedance 2.0 Fast 当前按 5 秒视频节点计费和生成，第一集原始拆法是 37 个 1.5-2.8 秒短分镜。如果每个分镜单独提交，会把大量额度浪费在模型最低时长上。新的策略是把连续短分镜打包成 5 秒以内的视频节点，并在一个节点里明确传入多个视觉节拍和对应参考图。

按本地价格快照估算，480p 5 秒 `doubao-seedance-2-0-fast-260128` 约 1.86 元/个。37 个分镜逐条提交约 68.82 元；当前 17 个打包节点约 31.62 元。已经完成的 `E01_S011` 单镜测试按一次 5 秒节点估算约 1.86 元，实际以火山方舟账单为准。

## 打包原则

1. 每个 `pack_id` 最终提交给视频模型时仍是一个 5 秒节点，`provider_duration_sec` 固定为 5。
2. `target_duration_sec` 必须小于等于 5.0，建议小于等于 4.8，留 0.2 秒给模型尾帧稳定和后期裁切。
3. 每个 `visual_beats[]` 都必须有自己的 `image_ref`，也就是需要先用 Codex image-gen 生成并人工审核对应视频参考图。
4. 如果视频模型适配器支持多图输入，必须把 `reference_frames[]` 全部传入。若当前适配器只能传单张首帧，也要把所有节拍图写入请求包元数据和 prompt，并在执行日志里标记降级。
5. 一个节点内只合并连续剧情动作，不跨场景、不跨大光线变化、不跨人物服装状态变化。
6. 强动作镜头、面部特写和关键转场可以单独成包，不强行塞满 5 秒。
7. 成片仍按 `shots.jsonl` 的分镜节拍切点剪回去，不能因为 5 秒节点而把正片节奏拖慢。

## 两秒停留率规则

每个 5 秒节点必须在开头 0-2 秒提供一个明确停留理由。停留理由不一定是大特效，可以是：

- 林溪用树叶筒看天的儿童脸部特写。
- 温庚然从懒散假寐突然坐直。
- 云舟阴影压进安然堂院子。
- 金框铜镜的红宝石和符文第一次亮起。
- 三色灵光依次点亮林溪。
- 离别时桂花糕、拉勾、躲进船内哭的动作细节。

打包节点新增或维护以下语义字段：

- `retention_hook`：本节点前 2 秒抓住观众的视觉钩子。
- `style_prompt`：本节点的场景美术、材质、科幻仙侠边界。
- `motion_prompt`：完整 5 秒运动提示词，明确各 `visual_beats` 的衔接。

如果一个节点只有“人物站着说话”，必须补入手部动作、道具、视线、光影变化或环境反应，否则标记为 `low_two_second_hook`。

## 请求包字段

每个打包节点至少包含：

- `pack_id`
- `shot_ids`
- `provider_duration_sec`
- `target_duration_sec`
- `reference_frames`
- `visual_beats[].shot_id`
- `visual_beats[].start_sec`
- `visual_beats[].end_sec`
- `visual_beats[].image_ref`
- `visual_beats[].beat`
- `visual_beats[].camera_motion`
- `visual_beats[].visual_action`
- `sound_policy`

`video_node_packing_plan.jsonl` 是第一集的当前拆包表。后续 CLI 化时，渲染器应该优先读取这个文件生成付费视频任务，而不是直接按 `shots.jsonl` 逐镜头提交。

## 音效策略

允许视频模型在生成阶段理解“风声、撞击、灵光”等音效意图，也可以在供应商支持时开启模型音效作为运动参考。但模型生成的音频不进入最终成片。

最终成片只使用后期可控音轨：

- BGM
- 环境声
- 人工或 API 生成的 SFX
- 人物配音

如果模型音频里有可参考的音效，只能转写成 `sfx_prompts.jsonl` 或 `outputs/audio/mix_plan.json` 的后期音效 cue，不能直接拿源视频音轨混进最终 MP4。

## QA 门禁

打包视频节点进入付费渲染前必须通过：

- 所有 `reference_frames` 文件存在。
- 所有视觉节拍已人工审核，且没有 `face_drift`、`costume_drift`、`scene_drift`、`motion_overload`。
- 节点内所有 `visual_beats` 时间连续且不超过 `target_duration_sec`。
- `sound_policy` 必须是 `model_sfx_reference_only_final_audio_from_post_layers`。
- 审批包必须为 current；`video_node_packing_plan.jsonl` 或 `qa_rules.json` 改动后必须重新 `approve`。
