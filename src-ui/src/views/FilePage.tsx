import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Progress,
  Select,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  InboxOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { BackendContext } from "../lib/backend";
import { basename } from "../lib/types";
import type { PipelineStateName, ProgressInfo } from "../lib/types";

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

  const pollRef = useRef<number | null>(null);

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
          if (p) selectFile(p);
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

  const taskRunning =
    task !== null && (task.progress.state === "processing" || task.progress.state === "idle");

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
      message.success(`已导出：${path}`);
      setTask((t) =>
        t ? { ...t, progress: { ...t.progress, state: "exported" } } : t,
      );
    } catch (e) {
      message.error(`导出失败：${e}`);
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

  return (
    <div className="page" aria-hidden={!active}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        文件转字幕
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        拖入视频文件，自动转写并翻译为双语字幕，支持 SRT / VTT 导出。
      </Typography.Paragraph>

      {!file ? (
        <div
          className="dropzone"
          role="button"
          tabIndex={0}
          aria-label="选择或拖入视频文件"
          onClick={onPickFile}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onPickFile();
          }}
          style={{
            borderColor: dragOver
              ? token.colorPrimary
              : token.colorBorderSecondary,
            borderWidth: 2,
            borderStyle: "dashed",
            background: dragOver ? token.colorPrimaryBg : token.colorBgContainer,
            transform: dragOver ? "scale(1.008)" : undefined,
            boxShadow: dragOver
              ? `0 0 0 6px ${token.colorPrimaryBg}`
              : token.boxShadowTertiary,
          }}
        >
          <div className="dropzone-icon">
            <InboxOutlined style={{ fontSize: 34, color: "#fff" }} />
          </div>
          <div className="dropzone-title" style={{ color: token.colorText }}>
            {dragOver ? "松开即可选择" : "拖入视频文件"}
          </div>
          <div
            className="dropzone-sub"
            style={{ color: token.colorTextTertiary }}
          >
            或点击此处选择 · 支持 mp4 / mkv / avi / mov
          </div>
        </div>
      ) : (
        <div
          className="file-chip"
          style={{
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
          }}
        >
          <div
            className="file-chip-icon"
            style={{ background: token.colorPrimaryBg }}
          >
            <VideoCameraOutlined
              style={{ fontSize: 24, color: token.colorPrimary }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ fontSize: 15 }}>
              {file.name}
            </Typography.Text>
            <div
              style={{
                fontSize: 12,
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
            icon={<ReloadOutlined />}
            onClick={onPickFile}
            disabled={taskRunning}
          >
            重新选择
          </Button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginTop: 18,
        }}
      >
        <Select
          value={language}
          onChange={setLanguage}
          options={LANGUAGES}
          style={{ width: 160 }}
          aria-label="视频语言"
          disabled={taskRunning}
        />
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          loading={starting}
          disabled={!file || taskRunning}
          onClick={onStart}
        >
          {task && done ? "重新处理" : "开始转字幕"}
        </Button>
      </div>

      {task && (
        <Card
          style={{ marginTop: 22 }}
          styles={{
            body: { padding: "20px 24px" },
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <VideoCameraOutlined
              style={{ fontSize: 18, color: token.colorPrimary }}
            />
            <Typography.Text strong ellipsis style={{ flex: 1 }}>
              {task.fileName}
            </Typography.Text>
            {status && <Tag color={status.color}>{status.label}</Tag>}
          </div>
          <Progress
            percent={pct}
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
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {task.progress.state === "failed" ? (
              <Typography.Text type="danger">
                失败：{task.progress.error ?? "未知错误"}
              </Typography.Text>
            ) : task.progress.state === "processing" ? (
              <Typography.Text type="secondary">
                正在转写与翻译… {pct}%
              </Typography.Text>
            ) : task.progress.state === "idle" ? (
              <Typography.Text type="secondary">
                正在准备…
              </Typography.Text>
            ) : (
              <Typography.Text type="success">
                转写完成，可导出字幕文件
              </Typography.Text>
            )}
          </div>
          {done && (
            <div className="task-card-actions">
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
        </Card>
      )}
    </div>
  );
}
