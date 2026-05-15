# Codex 生图参考资产

这个目录用于存放 Codex 内置 image-gen 生成的短剧视觉参考图。

## 当前状态

2026-05-15 已将旧版 E01 参考图从 `video_refs/` 移到本地归档目录：

- `assets/reference_images/video_refs_old_unlocked_20260515/`

原因：旧参考图对应未完成源文锁定的旧分镜，不能继续作为新版《平溪村云舟》的 Seedance 首帧。

## 新版生成顺序

1. 先生成 `characters/*.png`，锁定人物脸、服装和气质。
2. 再生成关键场景和道具图：安然堂院子、低悬云舟、铜镜测灵器、行囊桂花糕、云舟船舷。
3. 最后按 `imagegen_prompts.jsonl` 生成 `video_refs/<shot_id>.png`，作为 Seedance 图生视频首帧参考。

## 保存要求

- 每条提示词的生成结果保存到它自己的 `target_path`。
- 不要在图里放字幕、水印、UI 或说明文字。
- `video_refs/` 目录里的图片会被 `render --execute` 优先作为 Seedance 首帧，所以只允许放通过 QA 的新版清晰图。
