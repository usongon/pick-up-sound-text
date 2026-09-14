# 拾言 (Lexecho)

视频转字幕工具：拖入视频文件，自动提取音频、语音识别、翻译，导出 SRT/VTT 字幕文件。

[English](README.md)

## 功能

1. **拖入视频文件**（支持 mp4、mkv、avi、mov 等格式）
2. **选择视频语言**（或自动识别）
3. **自动提取音频** — 通过 ffmpeg，按 10 分钟分段、5 秒重叠切割
4. **语音识别** — 使用[百炼 DashScope](https://dashscope.aliyuncs.com) paraformer-realtime-v2（WebSocket 流式）
5. **翻译** — 支持任何 OpenAI 兼容 API（OpenAI、DeepSeek、Kimi、百炼等）
6. **导出字幕** — SRT 或 VTT 格式，系统保存对话框

## 特性

- **文件转字幕流水线** — 拖拽上传、实时进度条、断点续传
- **BYOK（自带密钥）** — API Key 本地加密存储（AES-256-GCM + Argon2），不会发送到任何第三方
- **分段处理** — 10 分钟一段，重叠部分自动去重，长视频不会超 token 限制
- **断点续传** — 崩溃后重新处理同一文件，自动从上次进度继续
- **跨平台** — macOS、Windows、Linux（基于 Tauri 2.0）

## 前置要求

需要安装 **ffmpeg** 和 **ffprobe**：

```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows
# 从 https://ffmpeg.org/download.html 下载
```

## 从源码构建

```bash
# 安装 Rust（2024 edition）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli

# 克隆并构建
git clone https://github.com/usongon/pick-up-sound-text.git
cd pick-up-sound-text
cargo tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 开发模式

```bash
cargo tauri dev
```

## 配置说明

打开应用的**设置**页：

| 字段 | 说明 |
|------|------|
| **ASR 渠道** | 百炼（DashScope） |
| **ASR 模型** | `paraformer-realtime-v2`（默认值，可修改） |
| **ASR API Key** | 你的百炼 API Key |
| **翻译渠道** | OpenAI / 百炼 / DeepSeek / Kimi |
| **翻译模型** | 根据渠道自动填充，可修改 |
| **翻译 API Key** | 你的翻译 API Key |
| **目标语言** | 中文 / 英文 / 日文 / 韩文 |

API Key 加密存储在 `~/Library/Application Support/pick-up-sound-text/config.json`（0600 权限）。

## 架构

```
src/
├── asr/          # ASR 抽象 + 百炼 WebSocket 客户端
├── audio/        # 音频源抽象 + 文件音频源（ffmpeg）
├── translate/    # 翻译抽象 + OpenAI 兼容 HTTP 客户端
├── pipeline/     # 流水线：音频 → ASR → 翻译 → 字幕条目
├── subtitle/     # 字幕条目、SRT/VTT 生成
├── checkpoint/   # JSONL 断点续传
├── config/       # 配置管理 + 加密密钥存储
└── commands/     # Tauri 命令（前端 ↔ 后端）
```

## 技术栈

- **后端**：Rust 2024、Tauri 2.0、tokio、reqwest、tokio-tungstenite
- **前端**：原生 HTML/CSS/JS（无框架）
- **ASR**：百炼 paraformer-realtime-v2（WebSocket 双工）
- **翻译**：OpenAI 兼容 Chat Completions API
- **音频**：ffmpeg（PCM 16kHz 单声道 s16le）

## 许可证

MIT
