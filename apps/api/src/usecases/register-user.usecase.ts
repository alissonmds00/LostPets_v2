import { IdentityService } from '../modules/identity/identity.service.js';
import type { RegisterUserInputDto, UserDto } from '../modules/identity/identity.dto.js';

// Single-module operation today (only orchestrates identity's own service),
// but every route still goes through a usecase per the usecase skill — no
// route -> service shortcut, even for simple single-module flows.
export class RegisterUserUsecase {
  private readonly identityService = new IdentityService();

  async execute(input: RegisterUserInputDto): Promise<UserDto> {
    return this.identityService.registerUser(input);
  }
}
