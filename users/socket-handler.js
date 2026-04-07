const { v4: uuidv4 } = require('uuid');

const rooms = {};

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

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    // Crear sala
    socket.on('createRoom', (config, callback) => {
      const code = generateCode();
      rooms[code] = {
        code,
        host: socket.id,
        guest: null,
        config: config || {},
        gameId: null,
        status: 'waiting'
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
    socket.on('joinRoom', (code, callback) => {
      code = (code || '').toUpperCase();
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
      room.status = 'playing';
      socket.join(code);
      
      if (typeof callback === 'function') callback({ success: true, roomConfig: room.config });
      
      // Notificar al host que el jugador se unió para que cree la partida en gamey
      socket.to(room.host).emit('playerJoined', { guestId: socket.id });
    });

    // Host comunica que la partida ha sido creada con gamey
    socket.on('startGame', ({ code, gameId, hostClientId }) => {
      const room = rooms[code];
      if (room && room.host === socket.id) {
        room.gameId = gameId;
        io.to(code).emit('gameStarted', { gameId, hostClientId, config: room.config });
      }
    });

    // Un jugador hizo un movimiento válido en su turno
    socket.on('playMove', ({ code, cellId }) => {
      // Retransmitimos a la sala (excepto al emisor)
      socket.to(code).emit('enemyMove', { cellId });
    });

    // Abandonar la sala proactivamente
    socket.on('leaveRoom', (code) => {
      const room = rooms[code];
      if (room) {
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
    socket.on('disconnect', () => {
      for (const [code, room] of Object.entries(rooms)) {
        if (room.host === socket.id || room.guest === socket.id) {
          socket.to(code).emit('playerDisconnected', 'El rival se ha desconectado de la partida.');
          delete rooms[code];
        }
      }
    });

  });
};
