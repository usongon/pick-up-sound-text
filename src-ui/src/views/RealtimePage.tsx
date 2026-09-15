import { Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";

export default function RealtimePage({ active }: { active: boolean }) {
  return (
    <div className="view" aria-hidden={!active}>
      <div className="coming">
        <div className="coming-icon">
          <AudioOutlined style={{ fontSize: 32, color: "#fff" }} />
        </div>
        <Typography.Text strong style={{ fontSize: 15 }}>
          实时字幕
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          边说话边出字幕 · 基于百炼实时识别
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, marginTop: 8 }}
        >
          功能开发中，敬请期待
        </Typography.Text>
      </div>
    </div>
  );
}
