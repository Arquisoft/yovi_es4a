import { useState } from 'react';
import './App.css';
import yoviLogo from './assets/yoviLogo2.svg';

import RegisterForm from './RegisterForm';
import Home from './Home';
import Board from './Board';

type View = 'register' | 'home' | 'board';

function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [view, setView] = useState<View>('register');

  const handleUserRegistered = (registeredUsername: string) => {
    setUsername(registeredUsername);
    setView('home');
  };

  const handleStartGame = () => {
    setView('board');
  };

  const handleExitBoard = () => {
    setView('home');
  };

  return (
    <div className="App">
      <div>
        <a href="https://github.com/Arquisoft/yovi_es4a" target="_blank" rel="noreferrer">
          <img src={yoviLogo} className="logo yovi" alt="YOVI logo" />
        </a>
      </div>

      <h1>Welcome to YOVI</h1>

      {view === 'register' && (
        <RegisterForm onUserRegistered={handleUserRegistered} />
      )}

      {view === 'home' && username && (
        <Home username={username} onPlay={handleStartGame} />
      )}

      {view === 'board' && username && (
        <Board username={username} size={7} onExit={handleExitBoard} />
      )}
    </div>
  );
}

export default App;
