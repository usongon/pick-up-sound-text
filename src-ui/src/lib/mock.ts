import type { AppConfig, ProgressInfo } from "./types";
import type { Backend, DragHandlers } from "./backend";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let config: AppConfig = {
  asr: {
    provider: "dashscope",
    api_key: "sk-demo-xxxxxxxxxxxxxxxx",
    workspace_id: "llm-demoxxxxxxxx",
    file_model: "qwen-audio-3.0-asr-flash-filetrans",
    realtime_model: "qwen-audio-3.0-asr-flash",
  },
  translate: {
    provider: "openai",
    model: "gpt-3.5-turbo",
    api_key: "sk-demo-xxxxxxxxxxxxxxxx",
    target_lang: "zh",
  },
  oss: {
    endpoint: "oss-cn-beijing.aliyuncs.com",
    bucket: "shiyane-demo-bucket",
    access_key_id: "LTAI-demo",
    access_key_secret: "demo-secret",
    path_prefix: "shiyane-temp/",
  },
};

let progress: ProgressInfo = { state: "idle", progress: 0, error: null };
let timer: number | null = null;

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export const mockBackend: Backend = {
  mocked: true,
  async getConfig() {
    await delay(250);
    return structuredClone(config);
  },
  async saveConfig(c) {
    await delay(350);
    config = structuredClone(c);
  },
  async startFileProcessing(_videoPath, _sourceLanguage) {
    await delay(400);
    stopTimer();
    progress = { state: "processing", progress: 0.02, error: null };
    // 模拟：慢速推进 → 快速推进 → 完成，用于浏览器演示全流程
    timer = window.setInterval(() => {
      if (progress.state !== "processing") {
        stopTimer();
        return;
      }
      const step = progress.progress < 0.15 ? 0.008 : 0.03 + Math.random() * 0.02;
      const next = Math.min(1, progress.progress + step);
      progress =
        next >= 1
          ? { state: "completed", progress: 1, error: null }
          : { state: "processing", progress: next, error: null };
    }, 400);
    return "demo-task";
  },
  async getProcessingProgress() {
    return { ...progress };
  },
  async exportSubtitle(format) {
    await delay(700);
    return `/Users/demo/Downloads/output.${format}`;
  },
  async testAsrConnection() {
    await delay(900);
    return "ASR 配置验证通过（演示模式）";
  },
  async testTranslateConnection() {
    await delay(900);
    return "翻译连接成功（演示模式）";
  },
  async pickVideoFile() {
    await delay(350);
    return "/Users/demo/Movies/tears_of_steel_1080p.mp4";
  },
  async onDragEvent(handlers: DragHandlers) {
    // 浏览器内收不到 Tauri 系统级拖拽事件；暴露到 window 上便于 devtools 手动模拟
    (window as unknown as Record<string, unknown>).__mockDrag = handlers;
    return () => {
      delete (window as unknown as Record<string, unknown>).__mockDrag;
    };
  },
};
