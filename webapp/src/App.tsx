import { useState } from 'react'
import './App.css'
import GameHvB from './GameHvB'
import yoviLogo from './assets/yovi-logo.svg'
import { Button, Typography, Space } from 'antd'
import { illustrationTheme } from "./theme/illustrationTheme";
import { ConfigProvider } from "antd";

const { Title } = Typography

function App() {
  const [showGame, setShowGame] = useState(false)

  if (showGame) {
    return (
      //<ConfigProvider theme={illustrationTheme}>
        <div className="App">
          <GameHvB />
        </div>
      //</ConfigProvider>
    )
  }

  return (
    //<ConfigProvider theme={illustrationTheme}>
      <div className="App home">
        <Space direction="vertical" size="large" align="center">
          <a
            href="https://github.com/Arquisoft/yovi_es4a"
            target="_blank"
            rel="noreferrer"
          >
            <img src={yoviLogo} className="logo yovi" alt="Yovi logo" />
          </a>

          <Title level={2} style={{ margin: 0 }}>
            Welcome to YOVI
          </Title>

          <Button type="primary" size="large" onClick={() => setShowGame(true)}>
            Jugar
          </Button>
        </Space>
      </div>
    //</ConfigProvider>
  )
}

export default App
