import { hashPassword } from '../../infra/password.js';
import type { IdentityRepository } from './identity.repository.js';
import type { RegisterUserInputDto, UserDto } from './identity.dto.js';

export class IdentityService {
  constructor(private readonly repository: IdentityRepository) {}

  async registerUser(input: RegisterUserInputDto): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return this.repository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });
  }
}
