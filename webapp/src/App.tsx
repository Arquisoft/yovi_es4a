import { useState } from 'react';
import './App.css'
import yoviLogo from './assets/yoviLogo2.svg'
import RegisterForm from './RegisterForm';
import Home from './Home';
import GameBoard from './GameBoard';
function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleUserRegistered = (registeredUsername: string) => {
    setUsername(registeredUsername);
  };

  const handleStartGame = () => {
    setIsPlaying(true);
  };

  return (
    <div className="App">
      {username ? (
        isPlaying ? (
          <GameBoard username={username} size={7} onExit={() => setIsPlaying(false)} />
        ) : (
          <Home username={username} onPlay={handleStartGame} />
        )
      ) : (
        <>
          <div>
            <a href="https://github.com/Arquisoft/yovi_es4a" target="_blank" rel="noreferrer">
              <img src={yoviLogo} className="logo yovi" alt="YOVI logo" />
            </a>
          </div>
          <h1>Welcome to YOVI</h1>
          <RegisterForm onUserRegistered={handleUserRegistered} />
        </>
      )}
    </div>
  );
}

export default App;