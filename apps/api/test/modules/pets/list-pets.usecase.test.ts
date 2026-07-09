import { describe, expect, it, vi } from 'vitest';
import { listPetsUsecase } from '../../../src/modules/pets/list-pets.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { ListPetsQueryDto, PetListingListDto } from '../../../src/modules/pets/pets.dto.js';

describe('listPetsUsecase', () => {
  it('delegates straight to petsService.listListings with the given filters', async () => {
    const result: PetListingListDto = { data: [], pagination: { total: 0, offset: 0, limit: 20 } };
    const petsService: Pick<PetsService, 'listListings'> = {
      listListings: vi.fn().mockResolvedValue(result),
    };
    const filters: ListPetsQueryDto = { status: 'ACTIVE', offset: 0, limit: 20 };

    const listResult = await listPetsUsecase(petsService as PetsService, filters);

    expect(listResult).toBe(result);
    expect(petsService.listListings).toHaveBeenCalledWith(filters);
  });
});
