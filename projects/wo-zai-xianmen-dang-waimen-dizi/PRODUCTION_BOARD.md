# 短剧视觉生产看板

这个看板参考一套外部视觉生产画布的结构：不要把短剧生产理解成“写完 prompt 直接出视频”，而是把它拆成可试错、可筛选、可回写状态的节点系统。

## 参考画布复盘

参考画布的核心数据：

- 节点总数：942。
- 连接数：224。
- 图片资源节点：662。
- 图片生成节点：115。
- 分组：61。
- 文本设定节点：53。
- 视频生成节点：32。
- 音频资源节点：11。

这说明真正的成本和质量控制在视频生成之前：人物、场景、光影、构图、融合、九宫格分镜和问题标注先形成资产池，视频只是后端执行节点。

## 当前项目差距

当前《我在仙门当外门弟子》已经有 22 镜分镜、角色设定、首帧提示词、BGM/SFX 方案和 E01_S011 云舟参考图，但还缺三层：

1. **实验层**：缺少 moodboard、光影测试、人物+场景融合、多机位试错。
2. **看板层**：缺少分组、状态、依赖和审核记录。
3. **问题回写层**：缺少“光不对”“衣服飞得没逻辑”“人物跳脸”这种人工筛选标签。

## 生产分区

| 分区 | 目标 | 输入 | 输出 | 状态 |
| --- | --- | --- | --- | --- |
| 内容设定 | 锁定故事、人物关系、第一集节奏 | 小说解析、`story_bible.md` | `shots.jsonl`、`voiceover_script.md` | done |
| 人物一致性 | 锁定林溪、温庚然、女修、村民 | `characters.json`、已生成角色图 | `characters/*.png`、三视图/表情表 | partial |
| 场景 moodboard | 锁定平溪村、安然堂、村口、云舟甲板 | `scenes.json`、已有院子图 | `moodboards/*.png` | pending |
| 光影调性 | 测试村落暖光、云舟阴影、甲板冷光 | style pack、场景图 | `lighting_tests/*.png` | pending |
| 人物+场景融合 | 测试角色是否能稳定进入真实场景 | 角色图 + 场景图 | `fusion_tests/*.png` | pending |
| 多机位九宫格 | 为关键镜头探索不同景别和镜头位置 | 关键首帧/融合图 | `multicam/*.png` | pending |
| 视频首帧 | 生成 Seedance 可用首帧 | 通过审核的实验图 | `video_refs/<shot_id>.png` | partial |
| Seedance 测试 | 验证图生视频运动稳定性 | `video_refs` | `outputs/clips/*.mp4` | pending |
| 音频设计 | BGM、SFX、可选配音 | `audio_plan.md` | `assets/audio/*`、`mix_plan.json` | partial |
| QA 回写 | 把失败原因写回队列 | 人工审核 | `qa_rules.json`、`experiments.jsonl.review` | pending |

## 推荐执行顺序

1. 先补三类人物一致性图：林溪三视图、温庚然三视图、霄怀派女修设定。
2. 再补三类场景 moodboard：安然堂院子、村口空地、云舟甲板。
3. 对三个关键镜头做九宫格多机位：E01_S010 瞳孔倒影、E01_S011 云舟压境、E01_S021 林溪升空。
4. 对三个融合镜头做人物+场景实验：E01_S002 林溪院中、E01_S016 林溪排队、E01_S021 林溪升空。
5. 人工筛选通过后，只把通过图放入 `assets/reference_images/video_refs/`。
6. 先提交 E01_S011 单镜给 Seedance，再根据结果决定是否批量提交。

## 审核标签

- `face_drift`：人物脸变了。
- `costume_drift`：衣服、蓝腰带、小布袋或灰袍不一致。
- `scene_drift`：场景不再像平溪村或安然堂。
- `too_scifi`：云舟变成科幻飞船。
- `over_fantasy`：前半段村落过度仙侠化。
- `bad_hands`：手、脚、拂尘或草鞋变形。
- `motion_overload`：单镜动作过多，不适合图生视频。
- `lighting_mismatch`：人物和场景光线不一致。
- `usable_for_seedance`：可作为付费视频首帧。
