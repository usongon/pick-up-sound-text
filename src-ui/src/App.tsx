import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, ConfigProvider, Segmented } from "antd";
import { BackendContext, getBackend } from "./lib/backend";
import { studioTheme } from "./theme";
import type { AppConfig } from "./lib/types";
import FilePage from "./views/FilePage";
import RealtimePage from "./views/RealtimePage";
import SettingsPage from "./views/SettingsPage";
import "./styles.css";

type ViewKey = "file" | "realtime" | "settings";

const SEG_OPTIONS = [
  { value: "file", label: "转字幕" },
  { value: "realtime", label: "实时" },
  { value: "settings", label: "设置" },
];

const VIEW_STATUS: Record<ViewKey, string> = {
  file: "文件转字幕",
  realtime: "实时字幕",
  settings: "设置",
};

export default function App() {
  const [view, setView] = useState<ViewKey>("file");
  const backend = useMemo(() => getBackend(), []);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    backend
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [backend]);

  const cfgItems = [
    { key: "ASR", ok: !!config && config.asr.api_key.length > 0 },
    { key: "翻译", ok: !!config && config.translate.api_key.length > 0 },
    { key: "OSS", ok: !!config && config.oss !== null },
  ];

  return (
    <ConfigProvider theme={studioTheme}>
      <BackendContext.Provider value={backend}>
        <AntdApp>
          <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* 工具栏式标题栏：左让位红绿灯，中分段控制器（不可拖拽），两侧可拖拽移动窗口 */}
            <div className="titlebar">
              <div className="titlebar-zone titlebar-left" data-tauri-drag-region />
              <Segmented
                value={view}
                onChange={(v) => setView(v as ViewKey)}
                options={SEG_OPTIONS}
                aria-label="导航"
              />
              <div className="titlebar-zone titlebar-right" data-tauri-drag-region>
                {backend.mocked && (
                  <span className="mock-pill mono">
                    <i />
                    DEMO
                  </span>
                )}
              </div>
            </div>

            <div className="app-body">
              {/* 三个视图常驻挂载，保留状态；拖拽监听不因切页而丢失 */}
              <div style={{ display: view === "file" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                <FilePage active={view === "file"} />
              </div>
              <div style={{ display: view === "realtime" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                <RealtimePage active={view === "realtime"} />
              </div>
              <div style={{ display: view === "settings" ? "flex" : "none", flex: 1, minHeight: 0 }}>
                <SettingsPage active={view === "settings"} />
              </div>
            </div>

            <div className="statusbar mono">
              <span>{VIEW_STATUS[view]}</span>
              <div className="statusbar-right">
                {cfgItems.map((c) => (
                  <span
                    key={c.key}
                    className={`cfg-dot mono ${c.ok ? "on" : ""}`}
                    role="button"
                    tabIndex={0}
                    title={c.ok ? `${c.key} 已配置` : `${c.key} 未配置`}
                    onClick={() => setView("settings")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setView("settings");
                    }}
                  >
                    <i />
                    {c.key}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AntdApp>
      </BackendContext.Provider>
    </ConfigProvider>
  );
}
