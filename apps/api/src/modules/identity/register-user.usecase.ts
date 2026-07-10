import type { IdentityService } from './identity.service.js';
import type { RegisterUserInputDto, UserDto } from './identity.dto.js';

// Passa por usecase mesmo orquestrando só o service de identity (skill
// usecase: sem atalho rota -> service). Função pura recebendo o service já
// instanciado como parâmetro — usecases nunca instanciam seu próprio service
// (skill dependency-injection); a rota lê de `app.identityService` (decorado
// uma vez em app.ts) e repassa aqui.
export async function registerUserUsecase(
  identityService: IdentityService,
  input: RegisterUserInputDto,
): Promise<UserDto> {
  return identityService.registerUser(input);
}
