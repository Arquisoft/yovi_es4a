import { ConfigProvider } from 'antd'; // Importamos el proveedor de configuración
import illustrationTheme from './theme/illustrationTheme'; // Importamos el tema personalizado

import './App.css'
// Nota: Asegúrate de que las rutas de importación sean correctas según tu estructura de carpetas actual
import GameHvB from './GameHvB'; 
import RegisterForm from './RegisterForm';
import yoviLogo from './assets/yovi-logo.svg'

function App() {
  return (
    // Envolvemos tu aplicación original con el ConfigProvider
    <ConfigProvider theme={illustrationTheme}>
      <div className="App">
        <div>
          <a href="https://github.com/Arquisoft/yovi_es4a" target="_blank" rel="noreferrer">
            <img src={yoviLogo} className="logo yovi" alt="Yovi logo" />
          </a>
        </div>

        <h2>Welcome to YOVI</h2>
        <RegisterForm />
        <GameHvB />
      </div>
    </ConfigProvider>
  );
}

export default App;