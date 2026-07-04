import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { PetsRepository } from '../../../src/modules/pets/pets.repository.js';

describe('PetsRepository', () => {
  const repository = new PetsRepository();
  let ownerId: string;

  beforeEach(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        name: 'Test Owner',
      },
    });
    ownerId = owner.id;
  });

  afterEach(async () => {
    await prisma.petPhoto.deleteMany({ where: { listing: { ownerId } } });
    await prisma.petListing.deleteMany({ where: { ownerId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  describe('create', () => {
    it('creates a pet listing with its photos in a single transaction', async () => {
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

      const persisted = await prisma.petListing.findUnique({
        where: { id: listing.id },
        include: { photos: true },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.photos).toHaveLength(2);
    });

    it('creates a pet listing with no photos', async () => {
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
