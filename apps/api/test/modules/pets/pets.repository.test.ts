import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { prisma } from '../../../src/infra/db/prisma.js';
import { PetsRepository } from '../../../src/modules/pets/pets.repository.js';

vi.mock('../../../src/infra/db/prisma.js', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('PetsRepository', () => {
  const repository = new PetsRepository();
  const ownerId = randomUUID();

  beforeEach(() => {
    mockReset(prismaMock);
    // O repository chama `prisma.$transaction((tx) => ...)` passando um
    // callback — o mock simula o Prisma real invocando esse callback com o
    // próprio client mockado no lugar do `tx`, já que a interface de `tx` é a
    // mesma de `prisma` dentro de uma transação.
    prismaMock.$transaction.mockImplementation((callback: unknown) =>
      (callback as (tx: DeepMockProxy<PrismaClient>) => unknown)(prismaMock),
    );
  });

  describe('create', () => {
    it('creates a pet listing with its photos in a single transaction', async () => {
      const createdAt = new Date();
      prismaMock.petListing.create.mockResolvedValue({
        id: randomUUID(),
        type: 'LOST',
        title: 'Cachorro perdido no bairro Centro',
        description: 'Golden retriever, atende por Rex',
        species: 'cachorro',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [
          {
            id: randomUUID(),
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
            listingId: randomUUID(),
          },
          {
            id: randomUUID(),
            storageKey: 'listings/1/photo-2.jpg',
            url: 'https://example.com/photo-2.jpg',
            order: 1,
            listingId: randomUUID(),
          },
        ],
      } as never);

      const listing = await repository.create({
        type: 'LOST',
        title: 'Cachorro perdido no bairro Centro',
        description: 'Golden retriever, atende por Rex',
        species: 'cachorro',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        ownerId,
        photos: [
          { storageKey: 'listings/1/photo-1.jpg', url: 'https://example.com/photo-1.jpg', order: 0 },
          { storageKey: 'listings/1/photo-2.jpg', url: 'https://example.com/photo-2.jpg', order: 1 },
        ],
      });

      expect(listing.id).toBeTruthy();
      expect(listing.type).toBe('LOST');
      expect(listing.title).toBe('Cachorro perdido no bairro Centro');
      expect(listing.species).toBe('cachorro');
      expect(listing.city).toBe('São Paulo');
      expect(listing.status).toBe('ACTIVE');
      expect(listing.ownerId).toBe(ownerId);
      expect(listing.photos).toHaveLength(2);
      expect(listing.photos.map((p) => p.storageKey).sort()).toEqual([
        'listings/1/photo-1.jpg',
        'listings/1/photo-2.jpg',
      ]);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.petListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'LOST',
            title: 'Cachorro perdido no bairro Centro',
            ownerId,
            photos: {
              create: [
                { storageKey: 'listings/1/photo-1.jpg', url: 'https://example.com/photo-1.jpg', order: 0 },
                { storageKey: 'listings/1/photo-2.jpg', url: 'https://example.com/photo-2.jpg', order: 1 },
              ],
            },
          }),
          include: { photos: true },
        }),
      );
    });

    it('creates a pet listing with no photos', async () => {
      const createdAt = new Date();
      prismaMock.petListing.create.mockResolvedValue({
        id: randomUUID(),
        type: 'FOUND',
        title: 'Gato encontrado',
        description: 'Gato preto e branco, sem coleira',
        species: 'gato',
        latitude: -22.906847,
        longitude: -43.172897,
        city: 'Rio de Janeiro',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [],
      } as never);

      const listing = await repository.create({
        type: 'FOUND',
        title: 'Gato encontrado',
        description: 'Gato preto e branco, sem coleira',
        species: 'gato',
        latitude: -22.906847,
        longitude: -43.172897,
        city: 'Rio de Janeiro',
        ownerId,
        photos: [],
      });

      expect(listing.photos).toHaveLength(0);
    });
  });
});
