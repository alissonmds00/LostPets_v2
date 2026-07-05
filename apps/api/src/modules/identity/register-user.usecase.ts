import type { IdentityService } from './identity.service.js';
import type { RegisterUserInputDto, UserDto } from './identity.dto.js';

// Single-module operation today (only orchestrates identity's own service),
// but every route still goes through a usecase per the usecase skill — no
// route -> service shortcut, even for simple single-module flows. Plain
// function taking the already-instantiated service as a parameter (not a
// class needing `new`) — per the dependency-injection skill, usecases never
// instantiate their own service; the route reads it from `app.identityService`
// (decorated once in app.ts) and passes it in here, matching the shape used
// by loginUsecase in the identity-login branch.
export async function registerUserUsecase(
  identityService: IdentityService,
  input: RegisterUserInputDto,
): Promise<UserDto> {
  return identityService.registerUser(input);
}
