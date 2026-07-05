import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { submitPetListingUsecase } from '../../../src/modules/pets/submit-pet-listing.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { SubmitListingForRegistrationInputDto } from '../../../src/modules/pets/pets.dto.js';

describe('submitPetListingUsecase', () => {
  it('delegates straight to petsService.submitListingForRegistration with the given input', async () => {
    const petsService: Pick<PetsService, 'submitListingForRegistration'> = {
      submitListingForRegistration: vi.fn().mockResolvedValue(undefined),
    };
    const input: SubmitListingForRegistrationInputDto = {
      type: 'FOUND',
      title: 'Gato encontrado',
      description: 'Gato preto e branco, sem coleira',
      species: 'gato',
      latitude: -22.906847,
      longitude: -43.172897,
      city: 'Rio de Janeiro',
      ownerId: randomUUID(),
      photos: [],
    };

    await submitPetListingUsecase(petsService as PetsService, input);

    expect(petsService.submitListingForRegistration).toHaveBeenCalledWith(input);
  });
});
