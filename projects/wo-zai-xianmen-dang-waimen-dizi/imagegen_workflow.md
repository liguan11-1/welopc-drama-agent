# Codex 生图工作流

1. 执行 `welopc-drama-agent images --project <项目目录>` 刷新提示词。
2. 在 Codex 会话中按 `imagegen_prompts.jsonl` 调用内置 imagegen。
3. 把生成图保存到每条记录的 `target_path`。
4. 审核 `assets/reference_images/video_refs/*.png` 后再执行 `render --execute`。

低成本策略：先只生成第一条或前三条 `video_reference_frame`，确认人物和风格稳定后再批量继续。
