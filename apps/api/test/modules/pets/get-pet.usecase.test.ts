import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getPetUsecase } from '../../../src/modules/pets/get-pet.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';

describe('getPetUsecase', () => {
  it('delegates straight to petsService.getListing with the given id', async () => {
    const listing = { id: randomUUID() } as PetListingDto;
    const petsService: Pick<PetsService, 'getListing'> = {
      getListing: vi.fn().mockResolvedValue(listing),
    };

    const result = await getPetUsecase(petsService as PetsService, listing.id);

    expect(result).toBe(listing);
    expect(petsService.getListing).toHaveBeenCalledWith(listing.id);
  });
});
