import { describe, it, expect } from 'vitest';
import { socket } from '../api/socket';

describe('Socket API', () => {
  it('debería exportar una instancia de socket con autoConnect en false', () => {
    expect(socket).toBeDefined();
    // socket.io-client might have io.Manager properties
    expect(socket.io.opts.autoConnect).toBe(false);
    expect(socket.io.opts.path).toBe('/api/users/socket.io');
  });
});
