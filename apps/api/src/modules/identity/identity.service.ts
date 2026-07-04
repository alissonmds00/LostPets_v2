import { UnauthorizedError } from '../../infra/errors/app-error.js';
import { verifyPassword } from '../../infra/password.js';
import { IdentityRepository } from './identity.repository.js';
import type { LoginBodyDto, LoginResultDto } from './identity.dto.js';

// Session TTL: 7 days. No prior decision existed for this — a reasonable
// default for a session cookie, not an architecturally significant choice;
// noted for reconsideration later if needed.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class IdentityService {
  private readonly repository = new IdentityRepository();

  // One service per module (see the `service` skill) — register's logic
  // will land here too, as another method on this same class.
  async login(credentials: LoginBodyDto): Promise<LoginResultDto> {
    const user = await this.repository.findByEmail(credentials.email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const passwordMatches = await verifyPassword(user.passwordHash, credentials.password);
    if (!passwordMatches) throw new UnauthorizedError('Invalid credentials');

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
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
