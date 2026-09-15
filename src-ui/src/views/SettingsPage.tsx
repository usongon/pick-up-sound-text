import { useContext, useEffect, useState } from "react";
import {
  App as AntdApp,
  Button,
  Divider,
  Form,
  Input,
  Select,
  theme as antdTheme,
} from "antd";
import {
  SoundOutlined,
  TranslationOutlined,
  CloudServerOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { BackendContext } from "../lib/backend";
import { defaultConfig } from "../lib/types";
import type { AppConfig } from "../lib/types";
import { version as APP_VERSION } from "../../package.json";

const TRANSLATE_PROVIDERS = [
  { value: "openai", label: "OpenAI", model: "gpt-3.5-turbo" },
  { value: "dashscope", label: "百炼（DashScope）", model: "qwen-turbo" },
  { value: "deepseek", label: "DeepSeek", model: "deepseek-chat" },
  { value: "kimi", label: "Kimi", model: "moonshot-v1-8k" },
];

const TARGET_LANGUAGES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" },
  { value: "ja", label: "日文" },
  { value: "ko", label: "韩文" },
];

type SectionKey = "asr" | "translate" | "oss";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "asr", label: "语音识别", icon: <SoundOutlined /> },
  { key: "translate", label: "翻译", icon: <TranslationOutlined /> },
  { key: "oss", label: "对象存储", icon: <CloudServerOutlined /> },
];

interface FormValues {
  asr: {
    provider: string;
    file_model: string;
    realtime_model: string;
    api_key: string;
    workspace_id: string;
  };
  translate: {
    provider: string;
    model: string;
    api_key: string;
    target_lang: string;
  };
  oss: {
    endpoint: string;
    bucket: string;
    access_key_id: string;
    access_key_secret: string;
    path_prefix: string;
  };
}

const EMPTY_FORM: FormValues = {
  asr: {
    provider: "dashscope",
    file_model: defaultConfig().asr.file_model,
    realtime_model: defaultConfig().asr.realtime_model,
    api_key: "",
    workspace_id: "",
  },
  translate: {
    provider: "openai",
    model: "gpt-3.5-turbo",
    api_key: "",
    target_lang: "zh",
  },
  oss: {
    endpoint: "",
    bucket: "",
    access_key_id: "",
    access_key_secret: "",
    path_prefix: "",
  },
};

function toConfig(v: FormValues, opts: { withOss: boolean }): AppConfig {
  const ossEmpty =
    !v.oss.endpoint.trim() &&
    !v.oss.bucket.trim() &&
    !v.oss.access_key_id.trim() &&
    !v.oss.access_key_secret.trim();
  return {
    asr: {
      provider: v.asr.provider,
      file_model: v.asr.file_model,
      realtime_model: v.asr.realtime_model,
      api_key: v.asr.api_key,
      workspace_id: v.asr.workspace_id.trim() || null,
    },
    translate: { ...v.translate },
    oss:
      opts.withOss && !ossEmpty
        ? {
            endpoint: v.oss.endpoint.trim(),
            bucket: v.oss.bucket.trim(),
            access_key_id: v.oss.access_key_id.trim(),
            access_key_secret: v.oss.access_key_secret.trim(),
            path_prefix: v.oss.path_prefix.trim() || null,
          }
        : null,
  };
}

export default function SettingsPage({ active }: { active: boolean }) {
  const backend = useContext(BackendContext);
  const { message } = AntdApp.useApp();
  const { token } = antdTheme.useToken();
  const [form] = Form.useForm<FormValues>();
  const [section, setSection] = useState<SectionKey>("asr");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingAsr, setTestingAsr] = useState(false);
  const [testingTranslate, setTestingTranslate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const config = await backend.getConfig();
      form.setFieldsValue({
        asr: {
          ...config.asr,
          workspace_id: config.asr.workspace_id ?? "",
        },
        translate: { ...config.translate },
        oss: config.oss
          ? { ...config.oss, path_prefix: config.oss.path_prefix ?? "" }
          : EMPTY_FORM.oss,
      });
    } catch (e) {
      message.error(`加载配置失败：${e}`);
      form.setFieldsValue(EMPTY_FORM);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onProviderChange = (provider: string) => {
    const preset = TRANSLATE_PROVIDERS.find((p) => p.value === provider);
    if (preset) form.setFieldValue(["translate", "model"], preset.model);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await backend.saveConfig(toConfig(form.getFieldsValue(true) as FormValues, { withOss: true }));
      message.success("配置已保存");
    } catch (e) {
      message.error(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  };

  const onTestAsr = async () => {
    setTestingAsr(true);
    try {
      const result = await backend.testAsrConnection(
        toConfig(form.getFieldsValue(true) as FormValues, { withOss: true }),
      );
      message.success(result);
    } catch (e) {
      message.error(`${e}`);
    } finally {
      setTestingAsr(false);
    }
  };

  const onTestTranslate = async () => {
    setTestingTranslate(true);
    try {
      const result = await backend.testTranslateConnection(
        toConfig(form.getFieldsValue(true) as FormValues, { withOss: false }),
      );
      message.success(result);
    } catch (e) {
      message.error(`${e}`);
    } finally {
      setTestingTranslate(false);
    }
  };

  const fieldStyle = { marginBottom: 12 };

  return (
    <div className="settings-row view" aria-hidden={!active}>
      <div className="settings-nav">
        {SECTIONS.map((s) => (
          <div
            key={s.key}
            className={`settings-nav-item ${section === s.key ? "on" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setSection(s.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setSection(s.key);
            }}
          >
            <span style={{ fontSize: 12, display: "flex" }}>{s.icon}</span>
            {s.label}
          </div>
        ))}
        <div style={{ marginTop: "auto", padding: "0 10px" }}>
          <span className="mono" style={{ fontSize: 10, color: token.colorTextTertiary }}>
            v{APP_VERSION}
          </span>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        className="settings-form"
        initialValues={EMPTY_FORM}
        disabled={loading}
      >
        <div className="settings-form-inner">
          {section === "asr" && (
            <>
              <div className="section-label mono">语音识别 · 百炼</div>
              <Form.Item name={["asr", "provider"]} label="渠道" style={fieldStyle}>
                <Select options={[{ value: "dashscope", label: "百炼（DashScope）" }]} />
              </Form.Item>
              <Form.Item
                name={["asr", "file_model"]}
                label="文件转写模型"
                style={fieldStyle}
                rules={[{ required: true, message: "请填写文件转写模型" }]}
              >
                <Input allowClear className="mono" />
              </Form.Item>
              <Form.Item
                name={["asr", "realtime_model"]}
                label="实时识别模型"
                style={fieldStyle}
                rules={[{ required: true, message: "请填写实时识别模型" }]}
              >
                <Input allowClear className="mono" />
              </Form.Item>
              <Form.Item
                name={["asr", "api_key"]}
                label="百炼 API Key"
                style={fieldStyle}
                rules={[{ required: true, message: "请填写百炼 API Key" }]}
              >
                <Input.Password placeholder="输入百炼 API Key" />
              </Form.Item>
              <Form.Item
                name={["asr", "workspace_id"]}
                label="业务空间 Workspace ID"
                style={fieldStyle}
                extra="北京区域必填，在百炼控制台右上角获取"
              >
                <Input placeholder="例如 llm-xxxxxxxxxxxx" allowClear className="mono" />
              </Form.Item>
              <Divider style={{ margin: "4px 0 14px" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button loading={testingAsr} onClick={onTestAsr} icon={<ApiOutlined />}>
                  测试连通性
                </Button>
                <Button type="primary" loading={saving} onClick={onSave}>
                  保存
                </Button>
              </div>
            </>
          )}

          {section === "translate" && (
            <>
              <div className="section-label mono">翻译</div>
              <Form.Item name={["translate", "provider"]} label="渠道" style={fieldStyle}>
                <Select
                  options={TRANSLATE_PROVIDERS.map(({ value, label }) => ({ value, label }))}
                  onChange={onProviderChange}
                />
              </Form.Item>
              <Form.Item name={["translate", "model"]} label="模型" style={fieldStyle}>
                <Input allowClear className="mono" />
              </Form.Item>
              <Form.Item
                name={["translate", "api_key"]}
                label="API Key"
                style={fieldStyle}
                rules={[{ required: true, message: "请填写翻译 API Key" }]}
              >
                <Input.Password placeholder="输入翻译 API Key" />
              </Form.Item>
              <Form.Item name={["translate", "target_lang"]} label="目标语言" style={fieldStyle}>
                <Select options={TARGET_LANGUAGES} />
              </Form.Item>
              <Divider style={{ margin: "4px 0 14px" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button loading={testingTranslate} onClick={onTestTranslate} icon={<ApiOutlined />}>
                  测试连通性
                </Button>
                <Button type="primary" loading={saving} onClick={onSave}>
                  保存
                </Button>
              </div>
            </>
          )}

          {section === "oss" && (
            <>
              <div className="section-label mono">对象存储 OSS</div>
              <Form.Item name={["oss", "endpoint"]} label="Endpoint" style={fieldStyle}>
                <Input placeholder="例如 oss-cn-beijing.aliyuncs.com" allowClear className="mono" />
              </Form.Item>
              <Form.Item name={["oss", "bucket"]} label="Bucket 名称" style={fieldStyle}>
                <Input placeholder="例如 my-audio-bucket" allowClear className="mono" />
              </Form.Item>
              <Form.Item name={["oss", "access_key_id"]} label="Access Key ID" style={fieldStyle}>
                <Input.Password placeholder="输入 OSS Access Key ID" />
              </Form.Item>
              <Form.Item
                name={["oss", "access_key_secret"]}
                label="Access Key Secret"
                style={fieldStyle}
              >
                <Input.Password placeholder="输入 OSS Access Key Secret" />
              </Form.Item>
              <Form.Item
                name={["oss", "path_prefix"]}
                label="路径前缀（可选）"
                style={fieldStyle}
                extra="文件转写需要 OSS 托管音频，处理完成后自动删除"
              >
                <Input placeholder="例如 shiyane-temp/" allowClear className="mono" />
              </Form.Item>
              <Divider style={{ margin: "4px 0 14px" }} />
              <Button type="primary" loading={saving} onClick={onSave}>
                保存
              </Button>
            </>
          )}
        </div>
      </Form>
    </div>
  );
}
