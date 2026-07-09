import type { PetsService } from './pets.service.js';
import type { DeletePetListingInputDto } from './pets.dto.js';

export async function deletePetUsecase(
  petsService: PetsService,
  input: DeletePetListingInputDto,
): Promise<void> {
  return petsService.deleteListing(input);
}
