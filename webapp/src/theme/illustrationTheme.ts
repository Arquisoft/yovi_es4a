import type { ThemeConfig } from "antd";

export const illustrationTheme: ThemeConfig = {
  token: {
    // Colores base
    colorPrimary: "#52c41a",
    colorInfo: "#1677ff",
    colorError: "#ff4d4f",
    colorWarning: "#faad14",

    // Bordes y radios (look cartoon)
    borderRadius: 14,
    lineWidth: 2,
    colorBorder: "#1f1f1f",
    colorBorderSecondary: "#1f1f1f",

    // Tipografía
    fontSize: 16,
    fontFamily: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`,

    // Sombras más “duras”
    boxShadow:
      "0 6px 0 rgba(0,0,0,0.85), 0 10px 20px rgba(0,0,0,0.12)",
    boxShadowSecondary:
      "0 4px 0 rgba(0,0,0,0.85), 0 10px 18px rgba(0,0,0,0.10)",
  },

  components: {
    Button: {
      borderRadius: 14,
      controlHeight: 44,
      lineWidth: 2,
      defaultShadow:
        "0 6px 0 rgba(0,0,0,0.85), 0 10px 20px rgba(0,0,0,0.12)",
      primaryShadow:
        "0 6px 0 rgba(0,0,0,0.85), 0 10px 20px rgba(0,0,0,0.12)",
    },

    Card: {
      borderRadiusLG: 18,
      lineWidth: 2,
      colorBorderSecondary: "#1f1f1f",
      boxShadowTertiary:
        "0 6px 0 rgba(0,0,0,0.85), 0 14px 28px rgba(0,0,0,0.10)",
    },

    Input: {
      controlHeight: 44,
      borderRadius: 14,
      lineWidth: 2,
      colorBorder: "#1f1f1f",
      activeShadow: "0 0 0 3px rgba(82,196,26,0.25)",
    },

    InputNumber: {
      controlHeight: 44,
      borderRadius: 14,
      lineWidth: 2,
      colorBorder: "#1f1f1f",
    },

    Select: {
      controlHeight: 44,
      borderRadius: 14,
      lineWidth: 2,
      colorBorder: "#1f1f1f",
    },

    Modal: {
      borderRadiusLG: 18,
      lineWidth: 2,
      colorBorder: "#1f1f1f",
    },

    Slider: {
      railSize: 10,
      handleSize: 18,
      handleSizeHover: 20,
    },

    Steps: {
      iconSize: 36,
      controlHeight: 44,
    },
  },
};
