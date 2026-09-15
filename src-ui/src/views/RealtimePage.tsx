import { Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";
import { theme as antdTheme } from "antd";

export default function RealtimePage({ active }: { active: boolean }) {
  const { token } = antdTheme.useToken();
  return (
    <div className="view" aria-hidden={!active}>
      <div className="coming">
        <div className="coming-icon">
          <AudioOutlined style={{ fontSize: 24, color: token.colorPrimary }} />
        </div>
        <Typography.Text strong style={{ fontSize: 13 }}>
          实时字幕
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
          边说话边出字幕 · 基于百炼实时识别
        </Typography.Text>
        <span
          className="mono"
          style={{ fontSize: 10, color: token.colorTextTertiary, letterSpacing: 2, marginTop: 6 }}
        >
          IN DEVELOPMENT
        </span>
      </div>
    </div>
  );
}
