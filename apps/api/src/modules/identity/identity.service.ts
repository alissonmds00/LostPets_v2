import { UnauthorizedError } from '../../infra/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../infra/password.js';
import type { IdentityRepository } from './identity.repository.js';
import type {
  LoginBodyDto,
  LoginResultDto,
  RegisterUserInputDto,
  UserDto,
} from './identity.dto.js';

export class IdentityService {
  // Repository injected via constructor — the single instance is built once
  // in app.ts and decorated onto the root Fastify instance (see the
  // dependency-injection skill); the service never instantiates its own.
  constructor(
    private readonly repository: IdentityRepository,
    private readonly sessionTtlDays: number,
  ) {}

  async registerUser(input: RegisterUserInputDto): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return this.repository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });
  }

  async login(credentials: LoginBodyDto): Promise<LoginResultDto> {
    const user = await this.repository.findByEmail(credentials.email);
    if (!user) throw new UnauthorizedError('Credenciais inválidas');

    const passwordMatches = await verifyPassword(user.passwordHash, credentials.password);
    if (!passwordMatches) throw new UnauthorizedError('Credenciais inválidas');

    const expiresAt = new Date(Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000);
    const session = await this.repository.create(user.id, expiresAt);

    // Built from the already-looked-up `user` (UserDto, from findByEmail)
    // rather than `session.user` — same safe shape requireAuth attaches to
    // `request.user`, but this way `passwordHash` is never even referenced
    // as if it were part of that shape.
    return {
      session,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
