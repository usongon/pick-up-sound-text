import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Progress,
  Select,
  Typography,
  message as staticMessage,
  theme as antdTheme,
} from "antd";
import {
  ArrowDownOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import { BackendContext } from "../lib/backend";
import { basename } from "../lib/types";
import type { PipelineStateName, ProgressInfo, RecentTask } from "../lib/types";

const LANGUAGES = [
  { value: "auto", label: "自动识别" },
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" },
  { value: "ja", label: "日文" },
  { value: "ko", label: "韩文" },
];

const STEP_NAMES = ["提取", "转写", "翻译", "完成"];

const STATE_LABEL: Record<PipelineStateName, string> = {
  idle: "准备中",
  processing: "处理中",
  completed: "已完成",
  exported: "已导出",
  failed: "失败",
};

interface Task {
  id: string;
  fileName: string;
  progress: ProgressInfo;
}

export default function FilePage({ active }: { active: boolean }) {
  const backend = useContext(BackendContext);
  const { message } = AntdApp.useApp();
  const { token } = antdTheme.useToken();

  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [language, setLanguage] = useState("auto");
  const [dragOver, setDragOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [exporting, setExporting] = useState<"srt" | "vtt" | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);

  const pollRef = useRef<number | null>(null);
  const taskRunningRef = useRef(false);

  const taskRunning =
    task !== null && (task.progress.state === "processing" || task.progress.state === "idle");
  taskRunningRef.current = taskRunning;

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const info = await backend.getProcessingProgress();
        setTask((t) => (t ? { ...t, progress: info } : t));
        if (info.state !== "processing" && info.state !== "idle") {
          stopPolling();
        }
      } catch (e) {
        console.error("进度查询失败:", e);
      }
    }, 1000);
  }, [backend, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (!active || file) return;
    backend
      .listRecentTasks()
      .then(setRecentTasks)
      .catch(() => setRecentTasks([]));
  }, [active, file, backend]);

  const selectFile = useCallback((path: string) => {
    setFile({ path, name: basename(path) });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    backend
      .onDragEvent({
        onEnter: () => setDragOver(true),
        onLeave: () => setDragOver(false),
        onDrop: (paths) => {
          setDragOver(false);
          const p = paths[0];
          if (!p) return;
          if (taskRunningRef.current) {
            // 拖拽回调在 React 事件体系之外，App.useApp 的 message 在此上下文不渲染，需走静态 API
            staticMessage.warning("任务处理中，请等待完成后再更换文件");
            return;
          }
          selectFile(p);
        },
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((e) => console.error("拖拽监听注册失败:", e));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [backend, selectFile]);

  const onPickFile = async () => {
    try {
      const path = await backend.pickVideoFile();
      if (path) selectFile(path);
    } catch (e) {
      message.error(`打开文件对话框失败：${e}`);
    }
  };

  const onStart = async () => {
    if (!file || taskRunning) return;
    setStarting(true);
    try {
      const id = await backend.startFileProcessing(file.path, language);
      setTask({
        id,
        fileName: file.name,
        progress: { state: "idle", progress: 0, error: null },
      });
      startPolling();
    } catch (e) {
      message.error(`启动处理失败：${e}`);
    } finally {
      setStarting(false);
    }
  };

  const onExport = async (format: "srt" | "vtt") => {
    setExporting(format);
    try {
      const path = await backend.exportSubtitle(format);
      message.success({ content: `已导出：${path}`, duration: 8 });
      setTask((t) =>
        t ? { ...t, progress: { ...t.progress, state: "exported" } } : t,
      );
    } catch (e) {
      if (`${e}`.includes("Save cancelled")) {
        message.info("已取消保存");
      } else {
        message.error(`导出失败：${e}`);
      }
    } finally {
      setExporting(null);
    }
  };

  const pct =
    task === null ? 0 : Math.max(0, Math.min(100, Math.round(task.progress.progress * 100)));
  const done =
    task !== null &&
    (task.progress.state === "completed" || task.progress.state === "exported");
  const failed = task !== null && task.progress.state === "failed";

  const stepIndex = !task
    ? -1
    : task.progress.state === "idle"
      ? 0
      : task.progress.state === "processing"
        ? pct < 50
          ? 1
          : 2
        : 3;

  const formatRelativeTime = (ts: number): string => {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  return (
    <div className="view" aria-hidden={!active}>
      {!file ? (
        <>
          <div
            className={`drop-strip ${dragOver ? "over" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="选择或拖入视频文件"
            onClick={onPickFile}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onPickFile();
            }}
          >
            <div className="drop-icon">
              <ArrowDownOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {dragOver ? "松开即可选择" : "拖入视频文件"}
              </div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 3 }}>
                或点击此处选择
              </div>
            </div>
            <div className="drop-formats mono">
              {["MP4", "MKV", "AVI", "MOV"].map((f) => (
                <span key={f} className="fmt">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {recentTasks.length > 0 && (
            <div className="recent">
              <div className="recent-label mono">最近</div>
              {recentTasks.map((rt) => (
                <div
                  key={rt.task_id}
                  className="recent-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => selectFile(rt.video_path)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectFile(rt.video_path);
                  }}
                >
                  <VideoCameraOutlined
                    style={{ fontSize: 12, color: token.colorTextTertiary, flex: "none" }}
                  />
                  <span className="recent-name">{rt.file_name}</span>
                  <span className="recent-time mono">{formatRelativeTime(rt.modified_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="file-header">
            <VideoCameraOutlined
              style={{ fontSize: 15, color: token.colorPrimary, flex: "none" }}
            />
            <div className="file-title">
              <Typography.Text strong ellipsis style={{ fontSize: 13, display: "block" }}>
                {file.name}
              </Typography.Text>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: token.colorTextTertiary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.path}
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={onPickFile}
              disabled={taskRunning}
              aria-label="重新选择文件"
            />
            <Select
              size="small"
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
              style={{ width: 100 }}
              aria-label="视频语言"
              disabled={taskRunning}
            />
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={starting}
              disabled={taskRunning}
              onClick={onStart}
            >
              {task && done ? "重新处理" : "开始"}
            </Button>
          </div>

          {task && (
            <div className="task-panel">
              <div className="task-inner">
                <div className="steps-mono mono">
                  {STEP_NAMES.map((s, i) => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span className={i === stepIndex ? "on" : i < stepIndex ? "done" : ""}>
                        {i < stepIndex ? "✓ " : ""}
                        {s}
                      </span>
                      {i < STEP_NAMES.length - 1 && <span className="sep">·</span>}
                    </span>
                  ))}
                </div>

                <div className="pct-row">
                  {done ? (
                    <CheckCircleFilled
                      style={{ fontSize: 38, color: token.colorSuccess, alignSelf: "center" }}
                    />
                  ) : (
                    <>
                      <span className="pct mono">{pct}</span>
                      <span className="pct-sign mono">%</span>
                    </>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: failed ? token.colorError : token.colorTextTertiary,
                      letterSpacing: 1,
                    }}
                    className="mono"
                  >
                    {STATE_LABEL[task.progress.state].toUpperCase()}
                  </span>
                </div>

                <Progress
                  percent={pct}
                  showInfo={false}
                  size={["100%", 3]}
                  status={failed ? "exception" : done ? "success" : "active"}
                  strokeColor={failed ? undefined : token.colorPrimary}
                />
                <div className="task-status-line">
                  {failed ? (
                    <Typography.Text type="danger" style={{ fontSize: 11.5 }}>
                      {task.progress.error ?? "未知错误"}
                    </Typography.Text>
                  ) : task.progress.state === "processing" ? (
                    "正在转写与翻译…"
                  ) : task.progress.state === "idle" ? (
                    "正在准备…"
                  ) : done ? (
                    "转写完成，可导出字幕文件"
                  ) : null}
                </div>

                {done && (
                  <div className="task-actions">
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      loading={exporting === "srt"}
                      onClick={() => onExport("srt")}
                    >
                      导出 SRT
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                      loading={exporting === "vtt"}
                      onClick={() => onExport("vtt")}
                    >
                      导出 VTT
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
