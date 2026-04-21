const { v4: uuidv4 } = require('uuid');
const User = require('./users-model');

const rooms = {};
const ALLOWED_MODES = new Set([
  'classic_hvb',
  'classic_hvh',
  'tabu_hvh',
  'holey_hvh',
  'fortune_dice_hvh',
  'poly_hvh',
  'why_not_hvh',
]);

// Genera un código de 5 caracteres (mayúsculas y números)
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for(let i=0; i<5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while(rooms[code]);
  return code;
}

function normalizeUsername(username) {
  if (typeof username !== 'string')
    return null;

  const trimmed = username.trim();
  return trimmed ? trimmed : null;
}

function normalizeProfilePicture(profilePicture) {
  if (typeof profilePicture !== 'string')
    return null;

  const trimmed = profilePicture.trim();
  return trimmed ? trimmed : null;
}

async function saveGameForUser(username, game) {
  if (!username)
    return;

  const user = await User.findOne(
    { username },
    { username: 1, stats: 1, gameHistory: 1, _id: 1 }
  );

  if (!user)
    return;

  const alreadyExists = Array.isArray(user.gameHistory)
    && user.gameHistory.some((savedGame) => savedGame.gameId === game.gameId);

  if (alreadyExists)
    return;

  const inc = {
    "stats.gamesPlayed": 1,
    "stats.totalMoves": game.totalMoves,
  };

  const currentWinStreak = user.stats?.currentWinStreak || 0;
  let nextWinStreak = 0;

  if (game.result === "won") {
    inc["stats.gamesWon"] = 1;
    nextWinStreak = currentWinStreak + 1;
  }
  else if (game.result === "lost") {
    inc["stats.gamesLost"] = 1;
    nextWinStreak = 0;
  }
  else if (game.result === "abandoned") {
    inc["stats.gamesAbandoned"] = 1;
    nextWinStreak = 0;
  }
  else if (game.result === "draw") {
    inc["stats.gamesDrawn"] = 1;
    nextWinStreak = 0;
  }

  await User.findByIdAndUpdate(
    user._id,
    {
      $inc: inc,
      $set: {
        "stats.currentWinStreak": nextWinStreak,
      },
      $push: {
        gameHistory: {
          $each: [{
            ...game,
            finishedAt: new Date(),
          }],
          $position: 0,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

async function persistRoomHistory(room, { hostResult, guestResult }) {
  if (!room || room.historySaved)
    return;

  const mode = room.config?.mode;
  const boardSize = Number(room.config?.size);

  if (!room.gameId || !ALLOWED_MODES.has(mode) || !Number.isFinite(boardSize) || boardSize <= 0)
    return;

  room.historySaved = true;

  try {
    const saves = [];

    if (hostResult) {
      saves.push(
        saveGameForUser(room.hostUsername, {
          gameId: room.gameId,
          mode,
          result: hostResult,
          boardSize,
          totalMoves: room.hostMoves || 0,
          opponent: room.guestUsername || "Jugador online",
          startedBy: "player0",
        })
      );
    }

    if (guestResult) {
      saves.push(
        saveGameForUser(room.guestUsername, {
          gameId: room.gameId,
          mode,
          result: guestResult,
          boardSize,
          totalMoves: room.guestMoves || 0,
          opponent: room.hostUsername || "Jugador online",
          startedBy: "player0",
        })
      );
    }

    await Promise.all(saves);
  } catch (err) {
    room.historySaved = false;
    console.error('Error guardando historial multiplayer:', err);
  }
}

module.exports = function setupSocketHandler(io) {
  io.on('connection', (socket) => {
    
    // Crear sala
    socket.on('createRoom', (payload, callback) => {
      const code = generateCode();
      const config = payload || {};

      rooms[code] = {
        code,
        host: socket.id,
        guest: null,
        hostUsername: normalizeUsername(config.username),
        guestUsername: null,
        hostProfilePicture: normalizeProfilePicture(config.profilePicture),
        guestProfilePicture: null,
        config: {
          size: config.size,
          mode: config.mode,
        },
        gameId: null,
        status: 'waiting',
        hostMoves: 0,
        guestMoves: 0,
        historySaved: false,
      };
      
      // Limpiar salas antiguas del host si había alguna
      for (const [c, r] of Object.entries(rooms)) {
        if (r.host === socket.id && c !== code) {
          delete rooms[c];
        }
      }

      socket.join(code);
      if (typeof callback === 'function') callback({ success: true, code });
    });

    // Unirse a sala
    socket.on('joinRoom', (payload, callback) => {
      const code = typeof payload === 'string'
        ? payload.toUpperCase()
        : (payload?.code || '').toUpperCase();

      const username = typeof payload === 'string'
        ? null
        : normalizeUsername(payload?.username);

      const profilePicture = typeof payload === 'string'
        ? null
        : normalizeProfilePicture(payload?.profilePicture);

      const room = rooms[code];
      
      if (!room) {
        if (typeof callback === 'function') callback({ error: 'Sala no encontrada.' });
        return;
      }
      if (room.guest) {
        if (typeof callback === 'function') callback({ error: 'La sala está llena.' });
        return;
      }
      if (room.host === socket.id) {
        if (typeof callback === 'function') callback({ error: 'Ya eres el creador de esta sala.' });
        return;
      }

      room.guest = socket.id;
      room.guestUsername = username;
      room.guestProfilePicture = profilePicture;
      room.status = 'playing';
      socket.join(code);
      
      if (typeof callback === 'function') callback({ success: true, roomConfig: room.config });
      
      // Notificar al host que el jugador se unió para que cree la partida en gamey
      socket.to(room.host).emit('playerJoined', { guestId: socket.id });
    });

    // Host comunica que la partida ha sido creada con gamey
    socket.on('startGame', ({ code, gameId, hostClientId, extra }) => {
      const room = rooms[code];
      if (room && room.host === socket.id) {
        room.gameId = gameId;
        io.to(code).emit('gameStarted', {
          gameId,
          hostClientId,
          config: room.config,
          extra,
          players: {
            player0: {
              username: room.hostUsername,
              profilePicture: room.hostProfilePicture,
            },
            player1: {
              username: room.guestUsername,
              profilePicture: room.guestProfilePicture,
            },
          },
        });
      }
    });

    // Un jugador hizo un movimiento válido en su turno
    socket.on('playMove', ({ code, cellId }) => {
      const room = rooms[code];
      if (!room)
        return;

      if (socket.id === room.host)
        room.hostMoves += 1;
      else if (socket.id === room.guest)
        room.guestMoves += 1;

      // Retransmitimos a la sala (excepto al emisor)
      socket.to(code).emit('enemyMove', { cellId });
    });

    // Fin normal de partida
    socket.on('finishGame', async ({ code, winner }) => {
      const room = rooms[code];
      if (!room || room.historySaved)
        return;

      if (winner === 'player0') {
        await persistRoomHistory(room, {
          hostResult: 'won',
          guestResult: 'lost',
        });
      }
      else if (winner === 'player1') {
        await persistRoomHistory(room, {
          hostResult: 'lost',
          guestResult: 'won',
        });
      }
      else if (winner == null) {
        await persistRoomHistory(room, {
          hostResult: 'draw',
          guestResult: 'draw',
        });
      }
    });

    // Abandonar la sala proactivamente
    socket.on('leaveRoom', async (payload) => {
      const code = typeof payload === 'string' ? payload : payload?.code;
      const room = rooms[code];

      if (room) {
        if (!room.historySaved && room.gameId) {
          if (socket.id === room.host) {
            await persistRoomHistory(room, {
              hostResult: 'abandoned',
              guestResult: null,
            });
          }
          else if (socket.id === room.guest) {
            await persistRoomHistory(room, {
              hostResult: null,
              guestResult: 'abandoned',
            });
          }
        }

        socket.to(code).emit('playerDisconnected', 'El rival ha abandonado la sala.');
        delete rooms[code];
      }

      socket.leave(code);
    });

    // Chat de texto
    socket.on('sendMessage', ({ code, text }) => {
      const room = rooms[code];
      if (room) {
        // Determinamos el rol del emisor
        const sender = socket.id === room.host ? 'player0' : 'player1';
        io.to(code).emit('chatMessage', { 
          text, 
          sender, 
          timestamp: Date.now() 
        });
      }
    });

    // Desconexión (cerrar navegador, pérdida de red)
    socket.on('disconnect', async () => {
      for (const [code, room] of Object.entries(rooms)) {
        if (room.host === socket.id || room.guest === socket.id) {
          if (!room.historySaved && room.gameId) {
            if (room.host === socket.id) {
              await persistRoomHistory(room, {
                hostResult: 'abandoned',
                guestResult: null,
              });
            }
            else {
              await persistRoomHistory(room, {
                hostResult: null,
                guestResult: 'abandoned',
              });
            }
          }

          socket.to(code).emit('playerDisconnected', 'El rival se ha desconectado de la partida.');
          delete rooms[code];
        }
      }
    });

  });
};
