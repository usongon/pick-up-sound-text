import { Tag, Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";

export default function RealtimePage({ active }: { active: boolean }) {
  return (
    <div className="workspace" aria-hidden={!active}>
      <div className="workspace-body">
        <div className="coming-soon" style={{ width: "100%" }}>
          <div className="coming-soon-icon">
            <AudioOutlined style={{ fontSize: 38, color: "#fff" }} />
          </div>
          <Typography.Text strong style={{ fontSize: 15 }}>
            实时字幕即将推出
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            将基于百炼实时识别模型，边说话边出字幕，敬请期待。
          </Typography.Text>
          <Tag color="processing" style={{ marginTop: 8 }}>
            开发中
          </Tag>
        </div>
      </div>
    </div>
  );
}
