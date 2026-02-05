interface HomeProps {
  username: string;
  onPlay: () => void;
}

const Home: React.FC<HomeProps> = ({ username, onPlay }) => {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1>Bienvenido {username}</h1>
      </div>
      <button onClick={onPlay} className="menu-button">
        Jugar
      </button>
    </div>
  );
};

export default Home;