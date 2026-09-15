import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export const BRAND_COLOR = "#0d9488";
export const SIDER_BG = "#0f141a";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';

// 桌面软件密度：13px 字、30px 控件、8px 圆角
const density = {
  fontSize: 13,
  controlHeight: 30,
  borderRadius: 8,
};

const menuTokens = {
  darkItemBg: SIDER_BG,
  darkItemSelectedBg: BRAND_COLOR,
  darkItemHoverBg: "rgba(255,255,255,0.08)",
  darkItemColor: "rgba(255,255,255,0.62)",
  darkItemSelectedColor: "#ffffff",
  itemBorderRadius: 7,
  itemMarginInline: 8,
  itemHeight: 36,
  iconSize: 15,
  fontSize: 13,
};

export const lightTheme: ThemeConfig = {
  token: {
    ...density,
    colorPrimary: BRAND_COLOR,
    colorInfo: BRAND_COLOR,
    colorLink: BRAND_COLOR,
    fontFamily: FONT_FAMILY,
    colorBgLayout: "#f6f7f8",
  },
  components: {
    Layout: {
      siderBg: SIDER_BG,
      bodyBg: "#f6f7f8",
    },
    Menu: menuTokens,
    Card: {
      borderRadiusLG: 10,
    },
    Button: {
      fontWeight: 500,
    },
    Form: {
      labelFontSize: 13,
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...density,
    colorPrimary: "#2dd4bf",
    colorInfo: "#2dd4bf",
    colorLink: "#2dd4bf",
    fontFamily: FONT_FAMILY,
    colorBgLayout: "#0b0e12",
  },
  components: {
    Layout: {
      siderBg: SIDER_BG,
      bodyBg: "#0b0e12",
    },
    Menu: menuTokens,
    Card: {
      borderRadiusLG: 10,
    },
    Button: {
      fontWeight: 500,
    },
    Form: {
      labelFontSize: 13,
    },
  },
};
