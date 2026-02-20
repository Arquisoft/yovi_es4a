import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

export const illustrationTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,

  token: {
    // Acorde al tablero
    colorPrimary: "#28BBF5",
    colorInfo: "#28BBF5",
    colorWarning: "#FF7B00",

    // Opcionales (coherentes y calmados)
    colorSuccess: "#2FBF7C",
    colorError: "#D55B5B",

    // Fondos claros y cómodos
    colorBgBase: "#F6F3EE",
    colorBgContainer: "#FFFDFA",
    colorBgElevated: "#FFFFFF",

    // Texto
    colorTextBase: "#1F2A30",
    colorTextSecondary: "rgba(31,42,48,.68)",

    // Paneles
    borderRadius: 16,
    lineWidth: 1,
    colorBorder: "rgba(31,42,48,.14)",

    // Tipografía
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Inter, Arial, "Noto Sans"',
    fontSize: 15,

    motionDurationMid: "0.16s",
  },

  components: {
    Card: {
      borderRadiusLG: 18,
      paddingLG: 18,
      headerBg: "transparent",
      colorBorderSecondary: "rgba(31,42,48,.12)",
    },

    Button: {
      borderRadius: 14,
      controlHeight: 40,
      controlHeightLG: 44,
      fontWeight: 650,
      // Sombra suave (nada glow)
      defaultShadow: "0 10px 26px rgba(17,24,39,.10)",
      primaryShadow: "0 12px 30px rgba(17,24,39,.14)",
    },

    Modal: {
      borderRadiusLG: 18,
      headerBg: "transparent",
      contentBg: "#FFFDFA",
      titleColor: "#1F2A30",
    },

    Input: { borderRadius: 14, controlHeight: 40 },
    InputNumber: { borderRadius: 14, controlHeight: 40 },
    Select: { borderRadius: 14, controlHeight: 40 },

    Divider: {
      colorSplit: "rgba(31,42,48,.12)",
      colorText: "rgba(31,42,48,.70)",
    },

    Alert: { borderRadiusLG: 14 },
  },
};