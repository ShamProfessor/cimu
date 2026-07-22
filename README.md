# Cimu（词幕）

> 直接对 Agent 说一句话，把本地音频和歌词做成可审阅的歌词 MV。

Cimu 是一个可安装的 Agent Skill：Agent 会处理歌词时间轴、视觉路线、渲染和交付校验；用户不需要运行 Node、FFmpeg 或 JSON 命令。

## 安装

安装到当前 Agent 的全局 Skill 目录：

```bash
npx skills add https://github.com/ShamProfessor/cimu --skill cimu -g
```

这条命令不绑定任何特定 Agent：安装器会交互选择本机可用的目标。仓库不需要发布为 npm 包：`npx skills` 安装的是本仓库中 `skills/cimu` 的 Skill 定义和随附资源。

## 怎么用

安装后，在对话中直接说：

```text
用 cimu 把这个 MP3 和 LRC 做成 30 秒、16:9 的歌词 MV。
```

也可以这样说：

```text
用 cimu 做一条 9:16 的歌词视频；我只有音频和纯文本歌词。
```

```text
用 cimu 检查这份 LRC 的时间轴问题，修好后渲染完整横版 MV。
```

Agent 会先确认音频、歌词、目标片段和画幅；有 LRC/SRT/ASS 时自动处理时间码，只有纯文本时会启动本地校时编辑器并引导你完成必要的人审。最终会交付 MP4 和校验报告。

## 运行条件

Cimu 在本机执行渲染，需要 Node.js 20+、FFmpeg/FFprobe 与 Google Chrome 或 Chromium。首次使用时直接让 Agent 检查环境；缺少组件时，它会说明需要安装的项目，而不是要求你猜命令。

## 兼容性

Skill 的核心是标准 `SKILL.md` 文件和本地资源，不依赖任何特定 Agent 的私有命令或元数据。它可用于能够读取 Agent Skills、访问本地文件并运行 Node/FFmpeg 的 Agent；不同 Agent 的安装目录和文件授权提示由各自客户端处理。

## 开发与维护

脚本参数、时间轴合同、回归校验和发布检查仅供维护者使用，见 [开发文档](docs/DEVELOPMENT.md)。普通使用不需要打开这份文档。

## 许可证

源代码与文档采用 [MIT License](LICENSE)。字体及其附带许可文件保留在各自目录中，并按其原始许可适用。
