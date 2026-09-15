import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export const ACCENT = "#f59e0b";
export const BG = "#0b1120";
export const PANEL = "#111827";
export const ELEVATED = "#1a2438";
export const HAIRLINE = "rgba(255,255,255,0.07)";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';
export const MONO_FAMILY =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

// Studio Dark：暗色单主题、等宽数字、发丝线分割、琥珀橙唯一强调色
export const studioTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: ACCENT,
    colorInfo: ACCENT,
    colorLink: "#fbbf24",
    colorBgBase: BG,
    colorBgLayout: BG,
    colorBgContainer: PANEL,
    colorBgElevated: ELEVATED,
    colorText: "#e7ecf3",
    colorTextSecondary: "#94a3b8",
    colorTextTertiary: "#64748b",
    colorBorder: "rgba(255,255,255,0.14)",
    colorBorderSecondary: HAIRLINE,
    colorSuccess: "#34d399",
    colorError: "#f87171",
    colorWarning: ACCENT,
    borderRadius: 6,
    fontSize: 12,
    controlHeight: 28,
    fontFamily: FONT_FAMILY,
  },
  components: {
    Segmented: {
      trackBg: "#0d1526",
      itemSelectedBg: ACCENT,
      itemSelectedColor: "#0b1120",
      itemColor: "#94a3b8",
      itemHoverColor: "#e7ecf3",
      borderRadius: 6,
      borderRadiusSM: 5,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Form: {
      labelColor: "#94a3b8",
      labelFontSize: 12,
      verticalLabelPadding: "0 0 4px",
    },
    Input: {
      activeShadow: "0 0 0 2px rgba(245, 158, 11, 0.18)",
    },
    Progress: {
      remainingColor: "rgba(255,255,255,0.09)",
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Divider: {
      colorSplit: HAIRLINE,
    },
  },
};
