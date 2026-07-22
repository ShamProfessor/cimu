# Cimu 开发与维护文档

> 此文档面向维护者、贡献者和排障人员。正常用户应安装 Skill 后直接在 Agent 对话中描述目标；不要让用户按本页命令操作。

## 1. 适用场景

使用 Cimu（词幕）将本地音频和歌词制作成可审阅、可复跑的歌词视觉 MV。最稳定的输入是 **音频 + 已确认时间码的 LRC/SRT/ASS**；仅有纯文本时，请先在本地时间轴编辑器完成逐句校时。

默认交付为 1920×1080、30fps、H.264/AAC 的 16:9 母版。若需要 9:16，请在需求中明确提出，并将其视为一次独立的安全区审阅。

## 2. 前置条件

在 skill 根目录执行：

```bash
node scripts/check-runtime.mjs
```

必须通过以下检查：Node.js 20+、FFmpeg、FFprobe、Google Chrome 或 Chromium。若 Chrome 不在自动发现路径中，设置其可执行文件：

```bash
export LYRIC_MV_CHROME_PATH="/absolute/path/to/Google Chrome"
```

请始终使用绝对路径。音频可为 MP3、M4A 或 AAC；歌词可为 LRC、SRT、ASS 或 UTF-8 纯文本。不要把源歌词文件直接作为编辑器导出的目标，以免失去原始版本。

## 3. 最快路径：已有时间码歌词

### 第一步：生成标准时间轴

```bash
node scripts/build-lyric-timeline.mjs \
  --lrc "/absolute/path/song.lrc" \
  --duration 210 \
  --out "/absolute/path/work/song.timeline.json"
```

将 `--lrc` 改为 `--srt` 或 `--ass` 即可处理相应格式。`--duration` 应为本次交付的目标范围时长；若只制作歌曲中的一个片段，请在时间轴构建和交付命令中使用相同的 `--start` 与 `--duration`。

### 第二步：检查时间轴

```bash
node scripts/validate-lyric-timeline.mjs \
  --timeline "/absolute/path/work/song.timeline.json" \
  --out "/absolute/path/work/song.timeline-validation.json"
```

只有校验报告通过时才进入渲染。发现错词、错拍、重叠或断行问题，请修改审核后的副本并再次校验；不要以“视频看起来能播放”作为时间正确的判断。

### 第三步：一键生成交付包

```bash
node scripts/run-delivery.mjs \
  --audio "/absolute/path/song.mp3" \
  --timeline "/absolute/path/work/song.timeline.json" \
  --out "/absolute/path/delivery/song-master" \
  --visual-profile code-collision
```

不传 `--visual-profile` 时系统会基于歌曲画像选择确定性路线。常用可选参数：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| `--start` | 原音频中的起始秒数 | `--start 18.93` |
| `--duration` | 渲染范围秒数 | `--duration 30` |
| `--width` / `--height` | 输出尺寸 | `--width 1920 --height 1080` |
| `--fps` | 帧率 | `--fps 30` |
| `--genre` | 显式指定歌曲类型提示 | `--genre folk` |
| `--visual-profile` | 覆盖自动视觉路由 | `--visual-profile folk-city-walk` |

除非交付需求明确要求，请不要把主母版改为 9:16。

## 4. 只有纯文本时：先完成审阅校时

启动本地编辑器：

```bash
node scripts/serve-timeline-editor.mjs
```

在浏览器打开终端打印的 `http://127.0.0.1:4173/`，然后：

1. 导入或粘贴纯文本歌词，并选择本地音频。
2. 逐句设置开始和结束时间，确认每一句的实际演唱内容。
3. 处理编辑器中的重叠、越界、空文本和可读停留警告。
4. 标记为已审核并导出新的 `.reviewed.json`。
5. 用 `validate-lyric-timeline.mjs` 再检查一次，再运行 `run-delivery.mjs`。

刷新页面后编辑器会恢复本地歌词草稿，但浏览器不会恢复用户选择的音频文件；请重新选择音频。纯文本自动分配的时间与在线 ASR 输出均只是草稿，不可直接交付。

## 5. 交付包说明

`--out` 指向的目录会成为一个歌曲片段的完整交付单元。至少检查以下文件：

```text
master-16x9.mp4             最终横版成片
delivery-validation.json    编码、时长、尺寸与黑边检查结果
delivery-manifest.json      成片与侧车文件关联清单
timeline-validation.json    歌词时间轴校验结果
audio.json                  音频画像
song-profile.json           歌曲与视觉路由证据
direction.json              句子角色和重要度建议
style-plan.json             固定 seed 的字体、效果、背景方案
job.json                    本次渲染的参数快照
```

请将这些文件与 MP4 一起归档。再次修改文案、时间、profile 或效果时，从这些 JSON 侧车定位相应层，再重新渲染；不要只保存导出的视频文件。

## 6. 人工创意控制

默认自动路线会将 WebGL 舞台用于全部 profile，并保持歌词在清晰的一条阅读通道内。要进行刻意调整，请遵循下列优先级：

1. 在时间轴中设置明确的字体、背景或效果计划；
2. 使用 `references/manual-overrides.md` 的格式创建有记录的人工覆盖；
3. 仅在需要实验或回退时以 `--template` 指定 Canvas 模板；
4. 重新生成并审阅 `style-plan.json`，确认覆盖确实被保留。

请阅读 `references/style-resolution.md` 理解确定性选择规则，阅读 `references/creative-direction.md` 理解 hero、hook、punchline 的建议语义。人工覆盖应服务于歌曲表达，不应用于把每一句都做成高强度特效。

## 7. 成片验收清单

在交付前运行：

```bash
node scripts/release-check.mjs
```

在源项目中检查随仓库发布的 20 秒参考成片时运行：

```bash
node scripts/release-check.mjs --with-goldens
```

自动检查通过后，仍需要在最终分辨率人工观看并确认：

- 开场、密集歌词、hook/hero、转场和结尾均没有错词或错拍；
- 文字没有被裁切、模糊、强光、封面/背景或二级文字遮挡；
- 字幕保持完整句子的阅读顺序和足够的停留时间；
- 横版空间被用于构图和留白，不是竖版模板的强行拉伸；
- 成片是 H.264 视频 + AAC 音频，时长和目标片段一致；
- `delivery-validation.json` 与 `timeline-validation.json` 均为 passed。

9:16 版本还需单独检查平台安全区、断行和手势/标题区域的遮挡。

## 8. 常见问题

| 症状 | 原因 | 处理方式 |
| --- | --- | --- |
| `check-runtime` 找不到 Chrome | 路径不在自动发现范围 | 设置 `LYRIC_MV_CHROME_PATH` 后重试 |
| 时间轴验证失败 | 草稿未审阅、行重叠、越界或最终组停留不足 | 在编辑器/审核稿中修正，再执行验证 |
| 纯文本可渲染但无法交付 | `draft-no-alignment` 被正确阻断 | 逐句校时并标记审核，或导入可靠 LRC/SRT/ASS |
| 输出出现黑边或黑缝 | 背景/尺寸/渲染异常 | 检查 `delivery-validation.json`，使用默认 WebGL 路线重新渲染 |
| 样式每次变化 | 侧车文件没有被保留或手工覆盖未落盘 | 保留并复用 `style-plan.json`、timeline 和 override |
| 音频重新加载后编辑器失去文件 | 浏览器安全限制 | 刷新后重新选择本地音频，草稿内容会保留 |

## 9. 推荐工作目录

为每个歌曲范围创建独立目录，例如：

```text
project/
  source/                 原始音频、原始 LRC/SRT/ASS，只读保留
  work/                   reviewed timeline 与人工覆盖
  delivery/song-range/    本次可交付 MP4 与全部 JSON 侧车
```

这种结构让原始素材、可编辑审阅稿与最终交付物互不覆盖，也使重跑与问题追溯保持清晰。

## 10. 延伸阅读

- `technical-architecture-zh-CN.md`：运行时、数据层、渲染层与扩展边界。
- `input-contract.md`：时间轴、job 与交付门禁的精确 JSON 合同。
- `timeline-editor.md`：本地时间轴编辑器的详细行为。
- `manual-overrides.md`：有意偏离自动方案时的记录格式。
- `online-asr.md`：可选 ASR sidecar 的接入边界与审阅规则。
