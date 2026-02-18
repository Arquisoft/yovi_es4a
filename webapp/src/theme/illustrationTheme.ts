import type { ThemeConfig } from 'antd';
/*
 * Estilo de tema "Illustración", basado en diseño moderno de juego redondeado.
 */
const illustrationTheme: ThemeConfig = {
  token: {
    colorPrimary: '#efcfa1',
    colorInfo: '#f09594',
    
    borderRadius: 16, 
    
    fontSize: 16,
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Button: {
      controlHeight: 48,
      borderRadius: 24,
      fontWeight: 600,
      defaultShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
      primaryShadow: '0 4px 14px rgba(114, 46, 209, 0.4)',
    },
    Card: {
      borderRadiusLG: 24,
      boxShadowTertiary: '0 12px 24px rgba(0,0,0,0.06)',
    },
    Input: {
      controlHeight: 48,
      colorBgContainer: '#f7f7f9',
      //borderWidth: 0,
    }
  }
};

export default illustrationTheme;