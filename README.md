# Cimu（词幕）

> 把歌词做成画面。

Cimu 是一个本地优先、可审阅、可复现的歌词视觉 MV Skill。它将音频与 LRC、SRT、ASS 或纯文本歌词转换为经过时间轴和成片校验的 H.264/AAC MV 交付包。

## 能力

- 将 LRC、SRT、ASS 归一化为可审阅歌词时间轴；纯文本可在本地编辑器中逐句校时。
- 根据音频画像和歌词语义选择确定性视觉路线，并将字体、背景、动效方案落盘。
- 使用本地 Chrome、原生 WebGL/Canvas 与 FFmpeg 生成 16:9 H.264/AAC 成片。
- 输出时间轴、音频画像、歌曲画像、方向、样式方案及验证报告，支持完整复跑。

## 安装到 Codex

在 Codex 中使用 Skill Installer，指定本仓库中的 skill 目录：

```text
$skill-installer install https://github.com/ShamProfessor/cimu/tree/main/skill/cimu
```

或克隆本仓库后，将 `skill/cimu` 复制到 `~/.codex/skills/cimu`，并重启 Codex。

## 环境

- Node.js 20+
- FFmpeg 与 FFprobe
- Google Chrome 或 Chromium

```bash
node skill/cimu/scripts/check-runtime.mjs
```

若 Chrome 未被自动发现，设置 `LYRIC_MV_CHROME_PATH` 为浏览器可执行文件的绝对路径。

## 快速开始

```bash
node skill/cimu/scripts/build-lyric-timeline.mjs \
  --lrc "/absolute/path/song.lrc" \
  --duration 30 \
  --out "/absolute/path/work/song.timeline.json"

node skill/cimu/scripts/validate-lyric-timeline.mjs \
  --timeline "/absolute/path/work/song.timeline.json"

node skill/cimu/scripts/run-delivery.mjs \
  --audio "/absolute/path/song.mp3" \
  --timeline "/absolute/path/work/song.timeline.json" \
  --out "/absolute/path/delivery" \
  --visual-profile code-collision
```

只有纯文本时，先运行 `node skill/cimu/scripts/serve-timeline-editor.mjs`，在本地编辑器中完成逐句校时、审阅并导出 `.reviewed.json`。

## 示例与验证

仓库中的 `examples/dont-touch-my-code/` 是 Cimu 的原创音频与 LRC 示例。运行基础自检：

```bash
node test/timeline-editor-core.test.mjs
node skill/cimu/scripts/release-check.mjs
```

详细操作见 [中文使用指南](skill/cimu/references/user-guide-zh-CN.md)，实现边界见 [中文技术架构](skill/cimu/references/technical-architecture-zh-CN.md)。

## 目录

```text
skill/cimu/       可直接安装的 Codex Skill
test/             核心时间轴测试与固定夹具
examples/         可公开分发的原创示例音频与歌词
```

## 许可证

源代码与文档采用 [MIT License](LICENSE)。字体及其附带许可文件保留在各自目录中，并按其原始许可适用。
