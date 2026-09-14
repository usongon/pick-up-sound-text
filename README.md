# Lexecho (拾言)

A cross-platform desktop app that turns video files into translated subtitles. Drop a video, pick the language, get an SRT/VTT file.

[中文文档](README.zh-CN.md)

## What it does

1. **Drop a video file** (mp4, mkv, avi, mov, ...)
2. **Select the source language** (or auto-detect)
3. **Audio is extracted** via ffmpeg, split into 10-minute segments with 5s overlap
4. **Speech recognition** via [DashScope](https://dashscope.aliyuncs.com) paraformer-realtime-v2 (WebSocket streaming)
5. **Translation** via any OpenAI-compatible API (OpenAI, DeepSeek, Kimi, DashScope, ...)
6. **Export** as SRT or VTT with system save dialog

## Features

- **File-to-subtitle pipeline** — drag & drop, progress bar, checkpoint/resume
- **BYOK** — your API keys are encrypted locally (AES-256-GCM + Argon2), never sent anywhere except the respective API
- **Segmented processing** — 10-min chunks with overlap dedup, so long videos don't hit token limits
- **Checkpoint resume** — if the app crashes, re-processing the same file picks up where it left off
- **Cross-platform** — macOS, Windows, Linux (via Tauri 2.0)

## Prerequisites

- [ffmpeg](https://ffmpeg.org/) and ffprobe must be installed and on `PATH`
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`
  - Windows: download from https://ffmpeg.org/download.html

## Build from source

```bash
# Install Rust (2024 edition)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# Clone and build
git clone https://github.com/usongon/pick-up-sound-text.git
cd pick-up-sound-text
cargo tauri build
```

The built app is in `src-tauri/target/release/bundle/`.

## Development

```bash
cargo tauri dev
```

## Configuration

Open the **Settings** tab in the app:

| Field | Description |
|-------|-------------|
| **ASR Provider** | DashScope (Alibaba Cloud) |
| **ASR Model** | `paraformer-realtime-v2` (default, editable) |
| **ASR API Key** | Your DashScope API key |
| **Translate Provider** | OpenAI / DashScope / DeepSeek / Kimi |
| **Translate Model** | Auto-filled per provider, editable |
| **Translate API Key** | Your translation API key |
| **Target Language** | zh / en / ja / ko |

API keys are stored encrypted at `~/Library/Application Support/pick-up-sound-text/config.json` (0600 permissions).

## Architecture

```
src/
├── asr/          # ASR provider trait + DashScope WebSocket client
├── audio/        # AudioSource trait + FileAudioSource (ffmpeg)
├── translate/    # Translate provider trait + OpenAI-compatible HTTP client
├── pipeline/     # FilePipeline: orchestrates audio → ASR → translate → entries
├── subtitle/     # SubtitleEntry, SRT/VTT generation
├── checkpoint/   # JSONL checkpoint for resume
├── config/       # AppConfig + encrypted keystore
└── commands/     # Tauri commands (frontend ↔ backend)
```

## Tech stack

- **Backend**: Rust 2024, Tauri 2.0, tokio, reqwest, tokio-tungstenite
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **ASR**: DashScope paraformer-realtime-v2 (WebSocket duplex)
- **Translation**: OpenAI-compatible Chat Completions API
- **Audio**: ffmpeg (PCM 16kHz mono s16le)

## License

MIT
