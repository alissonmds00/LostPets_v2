import type { PetsService } from './pets.service.js';
import type { SubmitListingForRegistrationInputDto } from './pets.dto.js';

// Single-module operation today (only orchestrates pets' own service), but
// every route still goes through a usecase per the usecase skill — no
// route -> service shortcut, even for simple single-module flows. Plain
// function taking the already-instantiated service as a parameter (not a
// class needing `new`) — per the dependency-injection skill, usecases never
// instantiate their own service; the route reads it from `app.petsService`
// (decorated once in app.ts) and passes it in here, matching the shape used
// by registerUserUsecase in identity.
export async function submitPetListingUsecase(
  petsService: PetsService,
  input: SubmitListingForRegistrationInputDto,
): Promise<void> {
  return petsService.submitListingForRegistration(input);
}
