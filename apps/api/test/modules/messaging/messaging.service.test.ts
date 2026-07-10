import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MessagingService } from '../../../src/modules/messaging/messaging.service.js';
import { MessagingConnectionRegistry } from '../../../src/modules/messaging/messaging-connection.registry.js';
import type { MessagingRepository } from '../../../src/modules/messaging/messaging.repository.js';
import type { MessageDto } from '../../../src/modules/messaging/messaging.dto.js';

function makeMessage(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: randomUUID(),
    listingId: randomUUID(),
    senderId: randomUUID(),
    receiverId: randomUUID(),
    body: 'oi',
    createdAt: new Date(),
    readAt: null,
    ...overrides,
  };
}

describe('MessagingService', () => {
  describe('sendMessage', () => {
    it('persists the message and returns it as-is when the receiver has no open socket', async () => {
      const message = makeMessage();
      const repositoryMock = {
        create: vi.fn().mockResolvedValue(message),
        markDelivered: vi.fn(),
      } as unknown as MessagingRepository;
      // Registry real (não mockado) — é um colaborador simples o suficiente
      // (Map em memória) que testar contra a implementação real é mais
      // direto que mockar, e nenhuma infra externa está envolvida.
      const registry = new MessagingConnectionRegistry();
      const service = new MessagingService(repositoryMock, registry);

      const result = await service.sendMessage({
        listingId: message.listingId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
      });

      expect(result).toBe(message);
      expect(repositoryMock.markDelivered).not.toHaveBeenCalled();
    });

    it('sends the message to every open socket of the receiver and marks it delivered', async () => {
      const message = makeMessage();
      const delivered = { ...message, readAt: new Date() };
      const repositoryMock = {
        create: vi.fn().mockResolvedValue(message),
        markDelivered: vi.fn().mockResolvedValue(delivered),
      } as unknown as MessagingRepository;
      const registry = new MessagingConnectionRegistry();
      const socketA = { send: vi.fn() };
      const socketB = { send: vi.fn() };
      registry.register(message.receiverId, socketA as never);
      registry.register(message.receiverId, socketB as never);
      const service = new MessagingService(repositoryMock, registry);

      const result = await service.sendMessage({
        listingId: message.listingId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
      });

      expect(result).toBe(delivered);
      expect(socketA.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(socketB.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(repositoryMock.markDelivered).toHaveBeenCalledWith(message.id);
    });

    it('does not deliver to sockets registered for other users', async () => {
      const message = makeMessage();
      const repositoryMock = {
        create: vi.fn().mockResolvedValue(message),
        markDelivered: vi.fn(),
      } as unknown as MessagingRepository;
      const registry = new MessagingConnectionRegistry();
      const otherUserSocket = { send: vi.fn() };
      registry.register(randomUUID(), otherUserSocket as never);
      const service = new MessagingService(repositoryMock, registry);

      await service.sendMessage({
        listingId: message.listingId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
      });

      expect(otherUserSocket.send).not.toHaveBeenCalled();
      expect(repositoryMock.markDelivered).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('delegates to the repository and wraps the result with pagination info', async () => {
      const message = makeMessage();
      const repositoryMock = {
        findHistoryByListingId: vi.fn().mockResolvedValue({ data: [message], total: 1 }),
      } as unknown as MessagingRepository;
      const service = new MessagingService(repositoryMock, new MessagingConnectionRegistry());

      const result = await service.getHistory(message.listingId, message.senderId, {
        offset: 0,
        limit: 20,
      });

      expect(repositoryMock.findHistoryByListingId).toHaveBeenCalledWith(
        message.listingId,
        message.senderId,
        {
          offset: 0,
          limit: 20,
        },
      );
      expect(result).toEqual({ data: [message], pagination: { total: 1, offset: 0, limit: 20 } });
    });
  });
});
