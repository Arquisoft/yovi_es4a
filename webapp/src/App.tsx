import './App.css'
import GameHvB from './GameHvB';
import RegisterForm from './RegisterForm';
import yoviLogo from './assets/yovi-logo.svg'

function App() {
  return (
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
  );
}

export default App;