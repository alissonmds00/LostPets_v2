import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MessagingConnectionRegistry } from '../../../src/modules/messaging/messaging-connection.registry.js';

// Puramente unitário — sem Fastify nem socket real, um objeto qualquer serve
// de "socket" pro Map interno (ver messaging skill / testing skill: nenhuma
// infra real neste teste).
describe('MessagingConnectionRegistry', () => {
  it('returns an empty set for a user with no registered sockets', () => {
    const registry = new MessagingConnectionRegistry();

    expect(registry.getSockets(randomUUID()).size).toBe(0);
  });

  it('registers a socket for a user and returns it', () => {
    const registry = new MessagingConnectionRegistry();
    const userId = randomUUID();
    const socket = {};

    registry.register(userId, socket as never);

    expect(registry.getSockets(userId)).toEqual(new Set([socket]));
  });

  it('supports multiple sockets for the same user (multiple tabs/devices)', () => {
    const registry = new MessagingConnectionRegistry();
    const userId = randomUUID();
    const socketA = {};
    const socketB = {};

    registry.register(userId, socketA as never);
    registry.register(userId, socketB as never);

    expect(registry.getSockets(userId)).toEqual(new Set([socketA, socketB]));
  });

  it('unregisters a specific socket without affecting the user other sockets', () => {
    const registry = new MessagingConnectionRegistry();
    const userId = randomUUID();
    const socketA = {};
    const socketB = {};
    registry.register(userId, socketA as never);
    registry.register(userId, socketB as never);

    registry.unregister(userId, socketA as never);

    expect(registry.getSockets(userId)).toEqual(new Set([socketB]));
  });

  it('is a no-op unregistering a socket that was never registered', () => {
    const registry = new MessagingConnectionRegistry();
    const userId = randomUUID();

    expect(() => registry.unregister(userId, {} as never)).not.toThrow();
    expect(registry.getSockets(userId).size).toBe(0);
  });
});
