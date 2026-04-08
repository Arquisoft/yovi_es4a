import { describe, it, expect, vi, beforeEach } from 'vitest';
import setupSocketHandler from '../socket-handler.js';

describe('Socket Handler', () => {
  let io;
  let socketHost;
  let socketGuest;
  let handlers = {};

  beforeEach(() => {
    vi.resetModules();
    handlers = {};

    io = {
      on: vi.fn((event, cb) => {
        handlers[event] = cb;
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };

    const createSocketMock = (id) => {
      const socket = {
        id,
        on: vi.fn((event, cb) => {
          socket.handlers[event] = cb;
        }),
        handlers: {},
        join: vi.fn(),
        leave: vi.fn(),
        to: vi.fn().mockReturnThis(),
        emit: vi.fn()
      };
      return socket;
    };

    socketHost = createSocketMock('host-123');
    socketGuest = createSocketMock('guest-456');
  });

  it('debería registrar el evento connection', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('debería crear una sala (createRoom)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    const callback = vi.fn();
    socketHost.handlers['createRoom']({ variant: 'base' }, callback);

    expect(socketHost.join).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ success: true, code: expect.any(String) });
    
    const code = callback.mock.calls[0][0].code;
    const callback2 = vi.fn();
    socketHost.handlers['createRoom']({}, callback2);
    expect(callback2).toHaveBeenCalled();
  });

  it('debería unirse a una sala (joinRoom)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);
    handlers['connection'](socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({ variant: 'base' }, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    const cbJoin = vi.fn();
    socketGuest.handlers['joinRoom'](code, cbJoin);

    expect(cbJoin).toHaveBeenCalledWith({ success: true, roomConfig: { variant: 'base' } });
    expect(socketGuest.join).toHaveBeenCalledWith(code);
    expect(socketGuest.to).toHaveBeenCalledWith('host-123');
    expect(socketGuest.emit).toHaveBeenCalledWith('playerJoined', { guestId: 'guest-456' });

    const cbJoin2 = vi.fn();
    socketGuest.handlers['joinRoom']('INVALID', cbJoin2);
    expect(cbJoin2).toHaveBeenCalledWith({ error: 'Sala no encontrada.' });

    const cbJoin3 = vi.fn();
    socketHost.handlers['joinRoom'](code, cbJoin3);
    expect(cbJoin3).toHaveBeenCalledWith({ error: 'Ya eres el creador de esta sala.' });

    const socketThird = {
      id: 'third-789',
      on: vi.fn((event, cb) => {
        socketThird.handlers[event] = cb;
      }),
      handlers: {},
      join: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };
    handlers['connection'](socketThird);
    const cbJoin4 = vi.fn();
    socketThird.handlers['joinRoom'](code, cbJoin4);
    expect(cbJoin4).toHaveBeenCalledWith({ error: 'La sala está llena.' });
  });

  it('debería iniciar partida (startGame)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({ variant: 'base' }, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['startGame']({ code, gameId: 'g1', hostClientId: 'c1', extra: {} });
    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenCalledWith('gameStarted', { gameId: 'g1', hostClientId: 'c1', config: { variant: 'base' }, extra: {} });
  });

  it('debería jugar un movimiento (playMove)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    socketHost.handlers['playMove']({ code: 'ABC', cellId: '1-1' });
    expect(socketHost.to).toHaveBeenCalledWith('ABC');
    expect(socketHost.emit).toHaveBeenCalledWith('enemyMove', { cellId: '1-1' });
  });

  it('debería enviar mensaje (sendMessage)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['sendMessage']({ code, text: 'Hola' });
    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenCalledWith('chatMessage', expect.objectContaining({ text: 'Hola', sender: 'player0' }));

    const socketGuest2 = { id: 'guest-msg', on: vi.fn(), handlers: {}, to: vi.fn().mockReturnThis(), emit: vi.fn() };
    handlers['connection'](socketGuest2);
    socketGuest2.handlers = socketHost.handlers;
    socketGuest2.handlers['sendMessage']({ code, text: 'Hey' });
    expect(io.emit).toHaveBeenCalledWith('chatMessage', expect.objectContaining({ text: 'Hey', sender: 'player1' }));
  });

  it('debería abandonar sala proactivamente (leaveRoom)', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['leaveRoom'](code);
    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith('playerDisconnected', 'El rival ha abandonado la sala.');
    expect(socketHost.leave).toHaveBeenCalledWith(code);
  });

  it('debería desconectar (disconnect) desde host', async () => {
    const freshSetup = (await import('../socket-handler.js')).default;
    freshSetup(io);
    handlers['connection'](socketHost);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['disconnect']();
    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith('playerDisconnected', 'El rival se ha desconectado de la partida.');
  });
});
