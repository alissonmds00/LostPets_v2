import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { deletePetUsecase } from '../../../src/modules/pets/delete-pet.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { DeletePetListingInputDto } from '../../../src/modules/pets/pets.dto.js';

describe('deletePetUsecase', () => {
  it('delegates straight to petsService.deleteListing with the given input', async () => {
    const petsService: Pick<PetsService, 'deleteListing'> = {
      deleteListing: vi.fn().mockResolvedValue(undefined),
    };
    const input: DeletePetListingInputDto = {
      id: randomUUID(),
      requesterId: randomUUID(),
      requesterRole: 'ADMIN',
    };

    await deletePetUsecase(petsService as PetsService, input);

    expect(petsService.deleteListing).toHaveBeenCalledWith(input);
  });
});
