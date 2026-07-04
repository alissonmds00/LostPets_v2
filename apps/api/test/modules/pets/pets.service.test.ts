import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { PetsRepository } from '../../../src/modules/pets/pets.repository.js';
import { PetsService } from '../../../src/modules/pets/pets.service.js';

describe('PetsService', () => {
  // Repository injected via constructor (see the dependency-injection
  // skill) — still the real repository/Postgres, per the testing skill's
  // "no mocking a collaborator" rule for service tests.
  const repository = new PetsRepository();
  const service = new PetsService(repository);
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

  describe('registerListing', () => {
    it('delegates to the repository and returns the created listing with its photos', async () => {
      const listing = await service.registerListing({
        type: 'DONATION',
        title: 'Filhotes para adoção',
        description: 'Ninhada de 4 filhotes, 2 meses',
        species: 'cachorro',
        latitude: -19.916681,
        longitude: -43.934493,
        city: 'Belo Horizonte',
        ownerId,
        photos: [{ storageKey: 'listings/1/photo-1.jpg', url: 'https://example.com/photo-1.jpg', order: 0 }],
      });

      expect(listing.id).toBeTruthy();
      expect(listing.type).toBe('DONATION');
      expect(listing.status).toBe('ACTIVE');
      expect(listing.ownerId).toBe(ownerId);
      expect(listing.photos).toHaveLength(1);

      const stored = await prisma.petListing.findUnique({ where: { id: listing.id } });
      expect(stored).not.toBeNull();
    });
  });
});
