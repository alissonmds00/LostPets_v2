import type { PetsRepository } from './pets.repository.js';
import type { CreatePetListingDto, PetListingDto } from './pets.dto.js';

export class PetsService {
  // Repository injected via constructor — the single instance is built once
  // in app.ts and decorated onto the root Fastify instance (see the
  // dependency-injection skill); the service never instantiates its own.
  constructor(private readonly repository: PetsRepository) {}

  // Delegates straight to the repository for now — this is the method the
  // future worker consumer calls after pulling a registration off the
  // queue, to actually persist the listing. No business rule beyond
  // persistence yet (validation already happened before enqueueing); that's
  // scoped to the create-endpoint task building on top of this scaffold.
  async registerListing(input: CreatePetListingDto): Promise<PetListingDto> {
    return this.repository.create(input);
  }
}
