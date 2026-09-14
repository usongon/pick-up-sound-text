import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

export const BRAND_COLOR = "#0d9488";
export const SIDER_BG = "#0f141a";

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif';

const menuTokens = {
  darkItemBg: SIDER_BG,
  darkItemSelectedBg: BRAND_COLOR,
  darkItemHoverBg: "rgba(255,255,255,0.08)",
  darkItemColor: "rgba(255,255,255,0.62)",
  darkItemSelectedColor: "#ffffff",
  itemBorderRadius: 8,
  itemMarginInline: 10,
  iconSize: 16,
};

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    colorInfo: BRAND_COLOR,
    colorLink: BRAND_COLOR,
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    colorBgLayout: "#f6f7f9",
  },
  components: {
    Layout: {
      siderBg: SIDER_BG,
      bodyBg: "#f6f7f9",
    },
    Menu: menuTokens,
    Card: {
      borderRadiusLG: 14,
    },
    Button: {
      controlHeightLG: 44,
      fontWeight: 500,
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#2dd4bf",
    colorInfo: "#2dd4bf",
    colorLink: "#2dd4bf",
    borderRadius: 10,
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
      borderRadiusLG: 14,
    },
    Button: {
      controlHeightLG: 44,
      fontWeight: 500,
    },
  },
};
