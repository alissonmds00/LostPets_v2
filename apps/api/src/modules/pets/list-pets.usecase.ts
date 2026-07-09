import type { PetsService } from './pets.service.js';
import type { ListPetsQueryDto, PetListingListDto } from './pets.dto.js';

// Single-module operation (só orquestra o service de pets) — mesmo assim
// passa por usecase, ver skill usecase.
export async function listPetsUsecase(
  petsService: PetsService,
  filters: ListPetsQueryDto,
): Promise<PetListingListDto> {
  return petsService.listListings(filters);
}
