import type { PetsService } from './pets.service.js';
import type { PetListingDto } from './pets.dto.js';

export async function getPetUsecase(petsService: PetsService, id: string): Promise<PetListingDto> {
  return petsService.getListing(id);
}
