import { Tag, Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";

export default function RealtimePage({ active }: { active: boolean }) {
  return (
    <div className="page" aria-hidden={!active}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        实时字幕
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        面向直播与会议场景的实时语音转写。
      </Typography.Paragraph>

      <div className="coming-soon">
        <div className="coming-soon-icon">
          <AudioOutlined style={{ fontSize: 44, color: "#fff" }} />
        </div>
        <Typography.Title level={5} style={{ margin: 0 }}>
          实时字幕即将推出
        </Typography.Title>
        <Typography.Text type="secondary">
          将基于百炼实时识别模型，边说话边出字幕，敬请期待。
        </Typography.Text>
        <Tag color="processing" style={{ marginTop: 10 }}>
          开发中
        </Tag>
      </div>
    </div>
  );
}
