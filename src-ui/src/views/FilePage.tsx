import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Progress,
  Select,
  Steps,
  Tag,
  Typography,
  message as staticMessage,
  theme as antdTheme,
} from "antd";
import {
  InboxOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
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

const STATUS_META: Record<PipelineStateName, { label: string; color: string }> =
  {
    idle: { label: "准备中", color: "default" },
    processing: { label: "处理中", color: "processing" },
    completed: { label: "已完成", color: "success" },
    exported: { label: "已导出", color: "success" },
    failed: { label: "失败", color: "error" },
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
  const status = task ? STATUS_META[task.progress.state] : null;
  const done =
    task !== null &&
    (task.progress.state === "completed" || task.progress.state === "exported");

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
    <div className="workspace" aria-hidden={!active}>
      {!file ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            className="dropzone-frame"
            role="button"
            tabIndex={0}
            aria-label="选择或拖入视频文件"
            onClick={onPickFile}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onPickFile();
            }}
            style={{
              flex: recentTasks.length > 0 ? "none" : 1,
              minHeight: recentTasks.length > 0 ? 200 : undefined,
              border: `2px dashed ${dragOver ? token.colorPrimary : token.colorBorderSecondary}`,
              background: dragOver ? token.colorPrimaryBg : "transparent",
            }}
          >
            <div style={{ textAlign: "center", userSelect: "none" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
                  boxShadow: "0 8px 24px rgba(13, 148, 136, 0.32)",
                }}
              >
                <InboxOutlined style={{ fontSize: 26, color: "#fff" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: token.colorText }}>
                {dragOver ? "松开即可选择" : "拖入视频文件"}
              </div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 6 }}>
                或点击此处选择 · 支持 mp4 / mkv / avi / mov
              </div>
            </div>
          </div>

          {recentTasks.length > 0 && (
            <div style={{ marginTop: 20, flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: token.colorTextTertiary,
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ClockCircleOutlined />
                最近处理
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recentTasks.map((rt) => (
                  <div
                    key={rt.task_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectFile(rt.video_path)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") selectFile(rt.video_path);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = token.colorFillQuaternary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <VideoCameraOutlined
                      style={{ fontSize: 14, color: token.colorPrimary, flex: "none" }}
                    />
                    <Typography.Text
                      ellipsis
                      style={{ fontSize: 13, flex: 1, minWidth: 0 }}
                    >
                      {rt.file_name}
                    </Typography.Text>
                    <Typography.Text
                      style={{ fontSize: 11, flex: "none", color: token.colorTextTertiary }}
                    >
                      {formatRelativeTime(rt.modified_at)}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="workspace-toolbar">
            <div
              className="file-chip"
              style={{ background: token.colorFillQuaternary }}
            >
              <div
                className="file-chip-icon"
                style={{ background: token.colorPrimaryBg }}
              >
                <VideoCameraOutlined
                  style={{ fontSize: 17, color: token.colorPrimary }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ fontSize: 13, maxWidth: 320 }}>
                  {file.name}
                </Typography.Text>
                <div
                  style={{
                    fontSize: 11,
                    color: token.colorTextTertiary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 320,
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
              />
            </div>
            <div style={{ marginLeft: "auto" }} />
            <Select
              size="small"
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
              style={{ width: 110 }}
              aria-label="视频语言"
              disabled={taskRunning}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              size="small"
              loading={starting}
              disabled={taskRunning}
              onClick={onStart}
            >
              {task && done ? "重新处理" : "开始"}
            </Button>
          </div>

          {task && (
            <div className="workspace-body">
              <div className="task-area">
                <Steps
                  size="small"
                  current={stepIndex}
                  status={task.progress.state === "failed" ? "error" : undefined}
                  items={[
                    { title: "准备" },
                    { title: "转写" },
                    { title: "翻译" },
                    { title: "完成" },
                  ]}
                  style={{ marginBottom: 20 }}
                />
                <div className="task-meta-row">
                  {status && <Tag color={status.color} style={{ marginInlineEnd: 0 }}>{status.label}</Tag>}
                  <Typography.Text
                    type="secondary"
                    ellipsis
                    style={{ fontSize: 12, flex: 1 }}
                  >
                    {task.fileName}
                  </Typography.Text>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {done ? (
                    <CheckCircleFilled
                      style={{ fontSize: 40, color: token.colorSuccess }}
                    />
                  ) : (
                    <div className="task-percent" style={{ color: token.colorText }}>
                      {pct}
                      <span style={{ fontSize: 20, color: token.colorTextTertiary }}>%</span>
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={pct}
                      showInfo={false}
                      status={
                        task.progress.state === "failed"
                          ? "exception"
                          : done
                            ? "success"
                            : "active"
                      }
                      strokeColor={
                        task.progress.state === "failed" ? undefined : token.colorPrimary
                      }
                    />
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      {task.progress.state === "failed" ? (
                        <Typography.Text type="danger" style={{ fontSize: 12 }}>
                          {task.progress.error ?? "未知错误"}
                        </Typography.Text>
                      ) : task.progress.state === "processing" ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          正在转写与翻译…
                        </Typography.Text>
                      ) : task.progress.state === "idle" ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          正在准备…
                        </Typography.Text>
                      ) : (
                        <Typography.Text type="success" style={{ fontSize: 12 }}>
                          转写完成，可导出字幕文件
                        </Typography.Text>
                      )}
                    </div>
                  </div>
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
