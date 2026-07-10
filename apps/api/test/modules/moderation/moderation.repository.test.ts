import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { prisma } from '../../../src/infra/db/prisma.js';
import { ModerationRepository } from '../../../src/modules/moderation/moderation.repository.js';
import { NotFoundError } from '../../../src/infra/errors/app-error.js';

vi.mock('../../../src/infra/db/prisma.js', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('ModerationRepository', () => {
  const repository = new ModerationRepository();
  const reporterId = randomUUID();
  const listingId = randomUUID();

  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe('create', () => {
    it('persists a report and returns it', async () => {
      const createdAt = new Date();
      prismaMock.report.create.mockResolvedValue({
        id: randomUUID(),
        reporterId,
        listingId,
        reason: 'Anúncio falso',
        status: 'PENDING',
        createdAt,
      } as never);

      const report = await repository.create({ reporterId, listingId, reason: 'Anúncio falso' });

      expect(report.status).toBe('PENDING');
      expect(prismaMock.report.create).toHaveBeenCalledWith({
        data: { reporterId, listingId, reason: 'Anúncio falso' },
      });
    });
  });

  describe('findAllPending', () => {
    it('returns only PENDING reports, oldest first', async () => {
      const createdAt = new Date();
      const report = {
        id: randomUUID(),
        reporterId,
        listingId,
        reason: 'x',
        status: 'PENDING',
        createdAt,
      };
      prismaMock.report.findMany.mockResolvedValue([report] as never);

      const reports = await repository.findAllPending();

      expect(reports).toHaveLength(1);
      expect(prismaMock.report.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getById', () => {
    it('returns the report when found', async () => {
      const id = randomUUID();
      const createdAt = new Date();
      prismaMock.report.findUnique.mockResolvedValue({
        id,
        reporterId,
        listingId,
        reason: 'x',
        status: 'PENDING',
        createdAt,
      } as never);

      const report = await repository.getById(id);

      expect(report.id).toBe(id);
      expect(prismaMock.report.findUnique).toHaveBeenCalledWith({ where: { id } });
    });

    it('throws NotFoundError when the report does not exist', async () => {
      prismaMock.report.findUnique.mockResolvedValue(null);

      await expect(repository.getById(randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateStatus', () => {
    it('updates the status and returns the updated report', async () => {
      const id = randomUUID();
      const createdAt = new Date();
      prismaMock.report.update.mockResolvedValue({
        id,
        reporterId,
        listingId,
        reason: 'x',
        status: 'DISMISSED',
        createdAt,
      } as never);

      const report = await repository.updateStatus(id, 'DISMISSED');

      expect(report.status).toBe('DISMISSED');
      expect(prismaMock.report.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: 'DISMISSED' },
      });
    });
  });
});
