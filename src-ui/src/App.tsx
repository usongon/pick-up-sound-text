import { useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  ConfigProvider,
  Layout,
  Menu,
  Tag,
  Tooltip,
  theme as antdTheme,
} from "antd";
import {
  FileTextOutlined,
  AudioOutlined,
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { version } from "../package.json";
import { BackendContext, getBackend } from "./lib/backend";
import { darkTheme, lightTheme } from "./theme";
import FilePage from "./views/FilePage";
import RealtimePage from "./views/RealtimePage";
import SettingsPage from "./views/SettingsPage";
import { LogoMark } from "./components/Logo";
import "./styles.css";

type ViewKey = "file" | "realtime" | "settings";

const MENU_ITEMS = [
  { key: "file", icon: <FileTextOutlined />, label: "文件转字幕" },
  { key: "realtime", icon: <AudioOutlined />, label: "实时字幕" },
  { key: "settings", icon: <SettingOutlined />, label: "设置" },
];

export default function App() {
  const [view, setView] = useState<ViewKey>("file");
  const [dark, setDark] = useState(false);
  const backend = useMemo(() => getBackend(), []);
  const { token } = antdTheme.useToken();

  const barBorder = `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`;

  return (
    <ConfigProvider theme={dark ? darkTheme : lightTheme}>
      <BackendContext.Provider value={backend}>
        <AntdApp>
          <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* macOS Overlay：红绿灯悬浮于此条左端，其余区域可拖拽窗口 */}
            <div
              className="titlebar"
              data-tauri-drag-region
              style={{
                background: dark ? "#0d1014" : token.colorBgContainer,
                borderBottom: barBorder,
              }}
            >
              <div className="titlebar-drag" data-tauri-drag-region />
              <Tooltip title={dark ? "切换到浅色" : "切换到深色"}>
                <Button
                  type="text"
                  size="small"
                  aria-label="切换深色模式"
                  icon={dark ? <SunOutlined /> : <MoonOutlined />}
                  onClick={() => setDark((d) => !d)}
                />
              </Tooltip>
            </div>

            <div className="main-row">
              <Layout.Sider width={200} theme="dark" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
                <div className="brand">
                  <LogoMark size={30} />
                  <div>
                    <div className="brand-name">拾言</div>
                    <div className="brand-tagline">把声音变成字幕</div>
                  </div>
                </div>
                <div className="sider-group-label">工作区</div>
                <Menu
                  theme="dark"
                  mode="inline"
                  selectedKeys={[view]}
                  items={MENU_ITEMS}
                  onClick={(e) => setView(e.key as ViewKey)}
                  style={{ flex: 1 }}
                />
                <div
                  style={{
                    padding: "10px 14px",
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  v{version}
                </div>
              </Layout.Sider>

              <div className="pane">
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
            </div>

            <div
              className="statusbar"
              style={{
                background: dark ? "#0d1014" : token.colorBgContainer,
                borderTop: barBorder,
                color: token.colorTextTertiary,
              }}
            >
              <span>{MENU_ITEMS.find((m) => m.key === view)?.label}</span>
              <div className="statusbar-right">
                {backend.mocked && (
                  <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: "18px" }}>
                    浏览器演示模式 · 模拟数据
                  </Tag>
                )}
              </div>
            </div>
          </div>
        </AntdApp>
      </BackendContext.Provider>
    </ConfigProvider>
  );
}

