import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { updatePetUsecase } from '../../../src/modules/pets/update-pet.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type {
  PetListingDto,
  UpdatePetListingInputDto,
} from '../../../src/modules/pets/pets.dto.js';

describe('updatePetUsecase', () => {
  it('delegates straight to petsService.updateListing with the given input', async () => {
    const listing = { id: randomUUID() } as PetListingDto;
    const petsService: Pick<PetsService, 'updateListing'> = {
      updateListing: vi.fn().mockResolvedValue(listing),
    };
    const input: UpdatePetListingInputDto = {
      id: listing.id,
      requesterId: randomUUID(),
      requesterRole: 'USER',
      title: 'Novo título',
    };

    const result = await updatePetUsecase(petsService as PetsService, input);

    expect(result).toBe(listing);
    expect(petsService.updateListing).toHaveBeenCalledWith(input);
  });
});
