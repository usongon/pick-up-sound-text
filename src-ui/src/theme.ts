import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export const PRIMARY = "#6366f1";
export const PRIMARY_SOFT = "#eef2ff";
export const GRADIENT = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';

// 小清新亮色主题：白面板 + 柔和阴影 + indigo→violet 渐变强调
export const freshTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: PRIMARY,
    colorInfo: PRIMARY,
    colorLink: "#6366f1",
    colorBgLayout: "#f6f7fb",
    colorBgContainer: "#ffffff",
    colorText: "#1f2937",
    colorTextSecondary: "#6b7280",
    colorTextTertiary: "#9ca3af",
    colorBorder: "#e5e7eb",
    colorBorderSecondary: "#eef0f4",
    colorSuccess: "#10b981",
    colorError: "#ef4444",
    colorWarning: "#f59e0b",
    borderRadius: 10,
    fontSize: 13,
    controlHeight: 32,
    fontFamily: FONT_FAMILY,
    boxShadow: "0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)",
    boxShadowSecondary: "0 6px 24px rgba(17, 24, 39, 0.10)",
  },
  components: {
    Segmented: {
      itemSelectedBg: PRIMARY,
      itemSelectedColor: "#ffffff",
      trackBg: "#eef0f6",
      itemColor: "#6b7280",
      itemHoverColor: "#1f2937",
      borderRadius: 8,
      borderRadiusSM: 7,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: "0 4px 12px rgba(99, 102, 241, 0.30)",
      defaultShadow: "none",
      dangerShadow: "none",
      controlHeight: 32,
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: "0 1px 3px rgba(17, 24, 39, 0.06)",
    },
    Form: {
      labelColor: "#374151",
      labelFontSize: 13,
      verticalLabelPadding: "0 0 6px",
    },
    Input: {
      activeShadow: "0 0 0 3px rgba(99, 102, 241, 0.12)",
    },
    Drawer: {
      colorBgElevated: "#ffffff",
    },
    Progress: {
      remainingColor: "#eceef5",
    },
    Steps: {
      colorPrimary: PRIMARY,
    },
    Divider: {
      colorSplit: "#eef0f4",
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};
