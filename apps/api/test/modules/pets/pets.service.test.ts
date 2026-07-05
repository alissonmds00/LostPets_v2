import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PetsRepository } from '../../../src/modules/pets/pets.repository.js';
import { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';

describe('PetsService', () => {
  // Repository mocked (see the testing skill, revised 2026-07-04): the
  // service is tested isolated from Postgres, injecting a fake repository
  // through the same constructor used in production (see the
  // dependency-injection skill). Only the repository is mocked — it's the
  // service's sole collaborator.
  const buildRepositoryMock = (): PetsRepository =>
    ({
      create: vi.fn(),
    }) as unknown as PetsRepository;

  describe('registerListing', () => {
    it('delegates to the repository and returns the created listing with its photos', async () => {
      const ownerId = randomUUID();
      const input = {
        type: 'DONATION' as const,
        title: 'Filhotes para adoção',
        description: 'Ninhada de 4 filhotes, 2 meses',
        species: 'cachorro',
        latitude: -19.916681,
        longitude: -43.934493,
        city: 'Belo Horizonte',
        ownerId,
        photos: [{ storageKey: 'listings/1/photo-1.jpg', url: 'https://example.com/photo-1.jpg', order: 0 }],
      };
      const listingId = randomUUID();
      const createdListing: PetListingDto = {
        id: listingId,
        type: 'DONATION',
        title: input.title,
        description: input.description,
        species: input.species,
        latitude: input.latitude,
        longitude: input.longitude,
        city: input.city,
        status: 'ACTIVE',
        ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [
          {
            id: randomUUID(),
            listingId,
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
            createdAt: new Date(),
          },
        ],
      };

      const repositoryMock = buildRepositoryMock();
      vi.mocked(repositoryMock.create).mockResolvedValue(createdListing);

      const service = new PetsService(repositoryMock);

      const listing = await service.registerListing(input);

      expect(listing).toBe(createdListing);
      expect(repositoryMock.create).toHaveBeenCalledWith(input);
    });
  });
});
