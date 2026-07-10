import type { PetsService } from './pets.service.js';
import type { SubmitListingForRegistrationInputDto } from './pets.dto.js';

// Operação single-module (só orquestra o service de pets), mas passa por
// usecase mesmo assim — toda rota segue esse padrão, ver skill usecase.
// Função plain recebendo o service já instanciado (não uma classe com
// `new`) — por convenção da skill dependency-injection, usecases nunca
// instanciam o próprio service.
export async function submitPetListingUsecase(
  petsService: PetsService,
  input: SubmitListingForRegistrationInputDto,
): Promise<void> {
  return petsService.submitListingForRegistration(input);
}
