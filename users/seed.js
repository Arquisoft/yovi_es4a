const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGO_URI = 'mongodb://localhost:27017/yovi';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomId() {
  return 'game-' + Math.random().toString(36).slice(2, 10);
}

const AVATARS = [
  'seniora.png','disco.png','rubia.png','elvis.png',
];

const MODES = ['classic_hvb','classic_hvh','tabu_hvh','holey_hvh','fortune_dice_hvh','poly_hvh'];

// Generamos 50 nombres genéricos para paginación
const USERS = Array.from({ length: 50 }).map((_, i) => ({
  username: `Player_${i + 1}_${Math.random().toString(36).slice(2, 6)}`,
  avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
  recent: Math.random(), // 0 to 1 ratio of recent games
  total: 5 + Math.floor(Math.random() * 60),
  winRatio: 0.3 + Math.random() * 0.6 // between 0.3 and 0.9 winrate
}));

// Algunos usuarios hardcodeados estrella para asegurar que el podio se gane con claridad
USERS.push(
  { username: 'CampeonSupremo', avatar: 'elvis.png', recent: 0.9, total: 100, winRatio: 0.95 },
  { username: 'LuchadorDiario', avatar: 'disco.png', recent: 1, total: 150, winRatio: 0.5 },
  { username: 'ElEstratega', avatar: 'seniora.png', recent: 0.8, total: 80, winRatio: 0.85 }
);

function buildGames(username, total, recentRatio, winRatio) {
  const games = [];
  for (let i = 0; i < total; i++) {
    const isRecent = Math.random() < recentRatio;
    const daysBack = isRecent ? Math.floor(Math.random() * 6) : 8 + Math.floor(Math.random() * 90);
    
    const roll = Math.random();
    let result;
    if (roll < winRatio) {
      result = 'won';
    } else if (roll < winRatio + 0.15) {
      result = 'abandoned';
    } else {
      result = 'lost';
    }
    
    games.push({
      gameId: randomId(),
      mode: MODES[Math.floor(Math.random() * MODES.length)],
      result,
      boardSize: [6,8,10][Math.floor(Math.random()*3)],
      totalMoves: 10 + Math.floor(Math.random() * 120),
      opponent: 'cpu',
      startedBy: username,
      finishedAt: daysAgo(daysBack).toISOString(), // Usando string para mongo si se define en Schema
    });
  }
  return games;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✅ Conectado a MongoDB');
  
  const db = client.db('yovi');
  const Users = db.collection('users');

  const password = await bcrypt.hash('Demo1234!', 10);

  let inserted = 0;

  for (const u of USERS) {
    const existing = await Users.findOne({ username: u.username });
    if (existing) continue;

    const games = buildGames(u.username, u.total, u.recent, u.winRatio);

    const gamesWon       = games.filter(g => g.result === 'won').length;
    const gamesLost      = games.filter(g => g.result === 'lost').length;
    const gamesAbandoned = games.filter(g => g.result === 'abandoned').length;
    const totalMoves     = games.reduce((acc, g) => acc + g.totalMoves, 0);

    const winRate = games.length > 0 ? Math.round((gamesWon / games.length) * 100) : 0;

    await Users.insertOne({
      username:          u.username,
      email:             `${u.username.toLowerCase()}@demo.yovi.es`,
      password,
      profilePicture:    u.avatar,
      createdAt:         new Date(),
      isVerified:        true,
      stats: { gamesPlayed: games.length, gamesWon, gamesLost, gamesAbandoned, totalMoves, winRate },
      gameHistory:       games.map(g => ({ ...g, finishedAt: new Date(g.finishedAt) })), // Castear string a Date
    });

    inserted++;
  }

  await client.close();
  console.log(`\n🎉 Seed completado. ${inserted} usuarios insertados con historial. ¡Refresca el ranking en el navegador!`);
}

main().catch((err) => { console.error('❌ Error:', err.message); process.exit(1); });
