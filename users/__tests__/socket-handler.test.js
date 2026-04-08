import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Socket Handler', () => {
  let io;
  let socketHost;
  let socketGuest;
  let connectionCallback;

  const createSocketMock = (id) => ({
    id,
    on: vi.fn(function(event, cb) {
      this.handlers[event] = cb;
    }),
    handlers: {},
    join: vi.fn(),
    leave: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn()
  });

  beforeEach(async () => {
    vi.resetModules();
    // socket-handler.js has a global 'rooms' object. 
    // We need to clear require cache to ensure it's empty for each test.
    const path = require.resolve('../socket-handler.js');
    delete require.cache[path];

    io = {
      on: vi.fn((event, cb) => {
        if (event === 'connection') connectionCallback = cb;
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn()
    };

    socketHost = createSocketMock('host-123');
    socketGuest = createSocketMock('guest-456');
  });

  const setup = async () => {
    const setupSocketHandler = (await import('../socket-handler.js')).default;
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
    socketHost.handlers['createRoom']({ variant: 'base' }, callback);

    expect(socketHost.join).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ success: true, code: expect.any(String) });
  });

  it('debería unirse a una sala (joinRoom)', async () => {
    await setup();
    connectionCallback(socketHost);
    
    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({ variant: 'base' }, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    // Caso 1: Unirse con éxito
    connectionCallback(socketGuest);
    const cbJoin = vi.fn();
    socketGuest.handlers['joinRoom'](code, cbJoin);
    expect(cbJoin).toHaveBeenCalledWith({ success: true, roomConfig: { variant: 'base' } });

    // Caso 2: Sala no encontrada
    const socketOther = createSocketMock('other-999');
    connectionCallback(socketOther);
    const cbJoin2 = vi.fn();
    socketOther.handlers['joinRoom']('INVALID', cbJoin2);
    expect(cbJoin2).toHaveBeenCalledWith({ error: 'Sala no encontrada.' });

    // Caso 3: Sala llena (un tercero intenta entrar, el guest ya está dentro)
    // Se comprueba ANTES que el creador porque en el código live el check de guest está antes que el de host
    const socketThird = createSocketMock('third-789');
    connectionCallback(socketThird);
    const cbJoin4 = vi.fn();
    socketThird.handlers['joinRoom'](code, cbJoin4);
    expect(cbJoin4).toHaveBeenCalledWith({ error: 'La sala está llena.' });

    // Caso 4: Ya eres el creador (mismo socket id)
    // Se comprueba DESPUÉS de vaciar la sala (pero aquí la sala sigue llena con el guest original)
    const cbJoin3 = vi.fn();
    socketHost.handlers['joinRoom'](code, cbJoin3);
    // Si la sala está llena, devolverá "La sala está llena" antes que "Ya eres el creador"
    expect(cbJoin3).toHaveBeenCalledWith({ error: 'La sala está llena.' });
  });

  it('debería enviar mensaje (sendMessage)', async () => {
    await setup();
    connectionCallback(socketHost);
    connectionCallback(socketGuest);

    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    // Entrar guest para que el rol se asigne
    socketGuest.handlers['joinRoom'](code, vi.fn());

    // Host envía
    socketHost.handlers['sendMessage']({ code, text: 'Hola' });
    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenLastCalledWith('chatMessage', expect.objectContaining({ text: 'Hola', sender: 'player0' }));

    // Guest envía
    socketGuest.handlers['sendMessage']({ code, text: 'Hey' });
    expect(io.emit).toHaveBeenLastCalledWith('chatMessage', expect.objectContaining({ text: 'Hey', sender: 'player1' }));
  });

  it('debería iniciar partida (startGame)', async () => {
    await setup();
    connectionCallback(socketHost);
    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({ variant: 'base' }, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['startGame']({ code, gameId: 'g1', hostClientId: 'c1', extra: {} });
    expect(io.to).toHaveBeenCalledWith(code);
    expect(io.emit).toHaveBeenCalledWith('gameStarted', { gameId: 'g1', hostClientId: 'c1', config: { variant: 'base' }, extra: {} });
  });

  it('debería jugar un movimiento (playMove)', async () => {
    await setup();
    connectionCallback(socketHost);
    socketHost.handlers['playMove']({ code: 'ABC', cellId: '1-1' });
    expect(socketHost.to).toHaveBeenCalledWith('ABC');
    expect(socketHost.emit).toHaveBeenCalledWith('enemyMove', { cellId: '1-1' });
  });

  it('debería abandonar sala proactivamente (leaveRoom)', async () => {
    await setup();
    connectionCallback(socketHost);
    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['leaveRoom'](code);
    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith('playerDisconnected', 'El rival ha abandonado la sala.');
    expect(socketHost.leave).toHaveBeenCalledWith(code);
  });

  it('debería desconectar (disconnect) desde host', async () => {
    await setup();
    connectionCallback(socketHost);
    const cbCreate = vi.fn();
    socketHost.handlers['createRoom']({}, cbCreate);
    const code = cbCreate.mock.calls[0][0].code;

    socketHost.handlers['disconnect']();
    expect(socketHost.to).toHaveBeenCalledWith(code);
    expect(socketHost.emit).toHaveBeenCalledWith('playerDisconnected', 'El rival se ha desconectado de la partida.');
  });
});
