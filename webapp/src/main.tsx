import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "antd/dist/reset.css";
import { ConfigProvider, App as AntdApp } from "antd";
import { illustrationTheme } from "./theme/illustrationTheme";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={illustrationTheme}>
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
