import type { PetsService } from './pets.service.js';
import type { PetListingDto, UpdatePetListingInputDto } from './pets.dto.js';

export async function updatePetUsecase(
  petsService: PetsService,
  input: UpdatePetListingInputDto,
): Promise<PetListingDto> {
  return petsService.updateListing(input);
}
