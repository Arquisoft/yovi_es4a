import { describe, it, expect, vi, beforeEach } from 'vitest';
import User from '../users-model.js';

describe('Socket Handler', () => {
  let io;
  let socketHost;
  let socketGuest;
  let connectionCallback;
  let findOneMock;
  let findByIdAndUpdateMock;

  const createSocketMock = (id) => ({
    id,
    on: vi.fn(function (event, cb) {
      this.handlers[event] = cb;
    }),
    handlers: {},
    join: vi.fn(),
    leave: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    findOneMock = vi.spyOn(User, 'findOne');
    findByIdAndUpdateMock = vi.spyOn(User, 'findByIdAndUpdate');

    io = {
      on: vi.fn((event, cb) => {
        if (event === 'connection') connectionCallback = cb;
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    socketHost = createSocketMock('host-123');
    socketGuest = createSocketMock('guest-456');
  });

  const setup = async () => {
    const imported = await import('../socket-handler.js');
    const setupSocketHandler = imported.default || imported;
    setupSocketHandler(io);
  };

  it('debería registrar el evento connection', async () => {
    await setup();
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('debería crear una sala (createRoom)', async () => {
    await setup();
    connectionCallback(socketHost);

    const callback = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      callback
    );

    expect(socketHost.join).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({
      success: true,
      code: expect.any(String),
    });
  });

  it('debería crear una sala why_not_hvh', async () => {
    await setup();
    connectionCallback(socketHost);

    const callback = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'why_not_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      callback
    );

    expect(socketHost.join).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({
      success: true,
      code: expect.any(String),
    });
  });

  it('debería unirse a una sala (joinRoom)', async () => {
    await setup();
    connectionCallback(socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    connectionCallback(socketGuest);
    const cbJoin = vi.fn();
    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      cbJoin
    );

    expect(cbJoin).toHaveBeenCalledWith({
      success: true,
      roomConfig: { size: 11, mode: 'classic_hvh' },
    });

    const socketOther = createSocketMock('other-999');
    connectionCallback(socketOther);
    const cbJoin2 = vi.fn();
    socketOther.handlers['joinRoom']({ code: 'INVALID', username: 'otro' }, cbJoin2);
    expect(cbJoin2).toHaveBeenCalledWith({ error: 'Sala no encontrada.' });

    const socketThird = createSocketMock('third-789');
    connectionCallback(socketThird);
    const cbJoin4 = vi.fn();
    socketThird.handlers['joinRoom']({ code, username: 'thirdUser' }, cbJoin4);
    expect(cbJoin4).toHaveBeenCalledWith({ error: 'La sala está llena.' });

    const cbJoin3 = vi.fn();
    socketHost.handlers['joinRoom']({ code, username: 'hostUser' }, cbJoin3);
    expect(cbJoin3).toHaveBeenCalledWith({ error: 'La sala está llena.' });
  });

  it('debería enviar mensaje (sendMessage)', async () => {
    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['sendMessage']({ code, text: 'Hola' });
    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenLastCalledWith(
      'chatMessage',
      expect.objectContaining({ text: 'Hola', sender: 'player0' })
    );

    socketGuest.handlers['sendMessage']({ code, text: 'Hey' });
    expect(io.emit).toHaveBeenLastCalledWith(
      'chatMessage',
      expect.objectContaining({ text: 'Hey', sender: 'player1' })
    );
  });

  it('debería iniciar partida (startGame)', async () => {
    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['startGame']({
      code,
      gameId: 'g1',
      hostClientId: 'c1',
      extra: {},
    });

    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenCalledWith('gameStarted', {
      gameId: 'g1',
      hostClientId: 'c1',
      config: { size: 11, mode: 'classic_hvh' },
      extra: {},
      players: {
        player0: {
          username: 'hostUser',
          profilePicture: 'host.png',
        },
        player1: {
          username: 'guestUser',
          profilePicture: 'guest.png',
        },
      },
    });
  });

  it('debería jugar un movimiento (playMove)', async () => {
    await setup();
    connectionCallback(socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['playMove']({ code, cellId: 7 });
    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith('enemyMove', { cellId: 7 });
  });

  it('debería procesar finishGame sin errores', async () => {
    findOneMock
      .mockResolvedValueOnce({
        _id: 'u1',
        username: 'hostUser',
        stats: { currentWinStreak: 2 },
        gameHistory: [],
      })
      .mockResolvedValueOnce({
        _id: 'u2',
        username: 'guestUser',
        stats: { currentWinStreak: 5 },
        gameHistory: [],
      });

    findByIdAndUpdateMock.mockResolvedValue({});

    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['startGame']({
      code,
      gameId: 'game-1',
      hostClientId: 'client-1',
      extra: {},
    });

    socketHost.handlers['playMove']({ code, cellId: 3 });
    socketGuest.handlers['playMove']({ code, cellId: 4 });

    await expect(
      socketHost.handlers['finishGame']({ code, winner: 'player0' })
    ).resolves.toBeUndefined();

    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(
      1,
      'u1',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesWon': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 3,
        },
      }),
      expect.any(Object)
    );

    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(
      2,
      'u2',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesLost': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 0,
        },
      }),
      expect.any(Object)
    );
  }, 100000);

  it('debería procesar finishGame en why_not_hvh con el ganador ya invertido', async () => {
    findOneMock
      .mockResolvedValueOnce({
        _id: 'u1',
        username: 'hostUser',
        stats: { currentWinStreak: 2 },
        gameHistory: [],
      })
      .mockResolvedValueOnce({
        _id: 'u2',
        username: 'guestUser',
        stats: { currentWinStreak: 5 },
        gameHistory: [],
      });

    findByIdAndUpdateMock.mockResolvedValue({});

    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'why_not_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['startGame']({
      code,
      gameId: 'game-why-not',
      hostClientId: 'client-1',
      extra: {},
    });

    socketHost.handlers['playMove']({ code, cellId: 3 });
    socketGuest.handlers['playMove']({ code, cellId: 4 });

    await expect(
      socketHost.handlers['finishGame']({ code, winner: 'player1' })
    ).resolves.toBeUndefined();

    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(
      1,
      'u1',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesLost': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 0,
        },
      }),
      expect.any(Object)
    );

    expect(findByIdAndUpdateMock).toHaveBeenNthCalledWith(
      2,
      'u2',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesWon': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 6,
        },
      }),
      expect.any(Object)
    );
  }, 100000);

  it('debería abandonar sala proactivamente (leaveRoom)', async () => {
    await setup();
    connectionCallback(socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    await socketHost.handlers['leaveRoom']({ code });

    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith(
      'playerDisconnected',
      'El rival ha abandonado la sala.'
    );
    expect(socketHost.leave).toHaveBeenCalledWith(code);
  });

  it('debería guardar solo abandoned para el host si abandona la sala', async () => {
    findOneMock.mockResolvedValueOnce({
      _id: 'u1',
      username: 'hostUser',
      stats: { currentWinStreak: 4 },
      gameHistory: [],
    });
    findByIdAndUpdateMock.mockResolvedValue({});

    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['startGame']({
      code,
      gameId: 'game-2',
      hostClientId: 'client-1',
      extra: {},
    });

    socketHost.handlers['playMove']({ code, cellId: 3 });

    await socketHost.handlers['leaveRoom']({ code });

    expect(findOneMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith(
      { username: 'hostUser' },
      { username: 1, stats: 1, gameHistory: 1, _id: 1 }
    );

    expect(findByIdAndUpdateMock).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdateMock).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesAbandoned': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 0,
        },
      }),
      expect.any(Object)
    );
  }, 1000000);

  it('debería desconectar (disconnect) desde host', async () => {
    await setup();
    connectionCallback(socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    await socketHost.handlers['disconnect']();

    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith(
      'playerDisconnected',
      'El rival se ha desconectado de la partida.'
    );
  });

  it('debería guardar solo abandoned para el guest si se desconecta', async () => {
    findOneMock.mockResolvedValueOnce({
      _id: 'u2',
      username: 'guestUser',
      stats: { currentWinStreak: 6 },
      gameHistory: [],
    });
    findByIdAndUpdateMock.mockResolvedValue({});

    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom'](
      {
        size: 11,
        mode: 'classic_hvh',
        username: 'hostUser',
        profilePicture: 'host.png',
      },
      cbCreate
    );
    const code = cbCreate.mock.calls[0][0].code;

    socketGuest.handlers['joinRoom'](
      { code, username: 'guestUser', profilePicture: 'guest.png' },
      vi.fn()
    );

    socketHost.handlers['startGame']({
      code,
      gameId: 'game-3',
      hostClientId: 'client-1',
      extra: {},
    });

    socketGuest.handlers['playMove']({ code, cellId: 8 });

    await socketGuest.handlers['disconnect']();

    expect(findOneMock).toHaveBeenCalledTimes(1);
    expect(findOneMock).toHaveBeenCalledWith(
      { username: 'guestUser' },
      { username: 1, stats: 1, gameHistory: 1, _id: 1 }
    );

    expect(findByIdAndUpdateMock).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdateMock).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        $inc: expect.objectContaining({
          'stats.gamesPlayed': 1,
          'stats.gamesAbandoned': 1,
          'stats.totalMoves': 1,
        }),
        $set: {
          'stats.currentWinStreak': 0,
        },
      }),
      expect.any(Object)
    );
  }, 100000);
});