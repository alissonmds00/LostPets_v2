import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { prisma } from '../../../src/infra/db/prisma.js';
import { MessagingRepository } from '../../../src/modules/messaging/messaging.repository.js';

vi.mock('../../../src/infra/db/prisma.js', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('MessagingRepository', () => {
  const repository = new MessagingRepository();
  const listingId = randomUUID();
  const senderId = randomUUID();
  const receiverId = randomUUID();

  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe('create', () => {
    it('persists a message and returns it', async () => {
      const createdAt = new Date();
      prismaMock.message.create.mockResolvedValue({
        id: randomUUID(),
        listingId,
        senderId,
        receiverId,
        body: 'Oi, ainda está disponível?',
        createdAt,
        readAt: null,
      } as never);

      const message = await repository.create({
        listingId,
        senderId,
        receiverId,
        body: 'Oi, ainda está disponível?',
      });

      expect(message.body).toBe('Oi, ainda está disponível?');
      expect(message.readAt).toBeNull();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: { listingId, senderId, receiverId, body: 'Oi, ainda está disponível?' },
      });
    });
  });

  describe('markDelivered', () => {
    it('sets readAt on the message', async () => {
      const id = randomUUID();
      const createdAt = new Date();
      prismaMock.message.update.mockResolvedValue({
        id,
        listingId,
        senderId,
        receiverId,
        body: 'oi',
        createdAt,
        readAt: new Date(),
      } as never);

      const message = await repository.markDelivered(id);

      expect(message.readAt).not.toBeNull();
      expect(prismaMock.message.update).toHaveBeenCalledWith({
        where: { id },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('findHistoryByListingId', () => {
    it('returns messages where the participant is sender or receiver, paginated', async () => {
      const createdAt = new Date();
      const message = {
        id: randomUUID(),
        listingId,
        senderId,
        receiverId,
        body: 'oi',
        createdAt,
        readAt: null,
      };
      prismaMock.message.findMany.mockResolvedValue([message] as never);
      prismaMock.message.count.mockResolvedValue(1);

      const result = await repository.findHistoryByListingId(listingId, senderId, {
        offset: 0,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      const expectedWhere = { listingId, OR: [{ senderId }, { receiverId: senderId }] };
      expect(prismaMock.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'asc' },
        }),
      );
      expect(prismaMock.message.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });
  });
});
