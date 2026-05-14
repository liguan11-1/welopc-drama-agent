# Codex 生图参考资产

这个目录用于存放 Codex 内置 imagegen 生成的短剧视觉参考图。

推荐顺序：

1. 先生成 `characters/*.png`，锁定人物脸、服装和气质。
2. 再生成 `cameras/*.png` 和 `storyboards/*.png`，检查镜头与分镜是否成立。
3. 最后生成 `video_refs/<shot_id>.png`，作为 Seedance 图生视频首帧参考。

提示词来源：项目根目录的 `imagegen_prompts.jsonl`。

保存要求：

- 每条提示词的生成结果保存到它自己的 `target_path`。
- 不要在图里放字幕、水印、UI 或说明文字。
- `video_refs` 目录里的图片会被 `render --execute` 优先作为 Seedance 首帧。
