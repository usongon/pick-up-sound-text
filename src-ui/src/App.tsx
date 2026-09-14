import { useMemo, useState } from "react";
import { App as AntdApp, ConfigProvider, Layout, Menu, Switch, Tag } from "antd";
import {
  FileTextOutlined,
  AudioOutlined,
  SettingOutlined,
  MoonOutlined,
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

  return (
    <ConfigProvider theme={dark ? darkTheme : lightTheme}>
      <BackendContext.Provider value={backend}>
        <AntdApp>
          <Layout style={{ height: "100vh" }}>
            <Layout.Sider width={232} theme="dark">
              <div className="brand">
                <LogoMark size={40} />
                <div>
                  <div className="brand-name">拾言</div>
                  <div className="brand-tagline">把声音变成字幕</div>
                </div>
              </div>
              <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[view]}
                items={MENU_ITEMS}
                onClick={(e) => setView(e.key as ViewKey)}
              />
              <div className="sider-footer">
                <div className="theme-row">
                  <span>
                    <MoonOutlined style={{ marginRight: 6 }} />
                    深色模式
                  </span>
                  <Switch
                    size="small"
                    checked={dark}
                    onChange={setDark}
                    aria-label="切换深色模式"
                  />
                </div>
                <div className="version-row">Shiyane v{version}</div>
              </div>
            </Layout.Sider>
            <Layout>
              <Layout.Content style={{ overflowY: "auto", height: "100%" }}>
                {/* 三个视图常驻挂载，保留状态；拖拽监听不因切页而丢失 */}
                <div style={{ display: view === "file" ? "block" : "none" }}>
                  <FilePage active={view === "file"} />
                </div>
                <div style={{ display: view === "realtime" ? "block" : "none" }}>
                  <RealtimePage active={view === "realtime"} />
                </div>
                <div style={{ display: view === "settings" ? "block" : "none" }}>
                  <SettingsPage active={view === "settings"} />
                </div>
              </Layout.Content>
            </Layout>
          </Layout>
          {backend.mocked && (
            <div className="mock-badge">
              <Tag color="warning">浏览器演示模式 · 模拟数据</Tag>
            </div>
          )}
        </AntdApp>
      </BackendContext.Provider>
    </ConfigProvider>
  );
}
