import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { IdentityService } from '../../../src/modules/identity/identity.service.js';
import { verifyPassword } from '../../../src/infra/password.js';
import { ConflictError } from '../../../src/infra/errors/app-error.js';

describe('IdentityService', () => {
  // Real repository (against real Postgres), constructor-injected per the
  // dependency-injection skill — the service never instantiates its own
  // repository.
  const service = new IdentityService(new IdentityRepository());
  // Scoped to exactly the emails each test creates rather than a broad
  // `contains: '@example.com'` match — this suite runs concurrently with
  // other test files (e.g. identity.repository.test.ts) against the same
  // database via the shared prisma singleton, and a broad delete would
  // race-delete fixtures another file's test is still using.
  const createdEmails: string[] = [];

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails.splice(0) } } });
  });

  describe('registerUser', () => {
    it('creates a user with the password hashed, never returning the plain password or hash', async () => {
      const email = `${randomUUID()}@example.com`;
      createdEmails.push(email);

      const user = await service.registerUser({
        email,
        password: 'correct horse battery',
        name: 'Jane',
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe('Jane');
      expect(user.role).toBe('USER');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');

      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).not.toBe('correct horse battery');
      await expect(verifyPassword(stored.passwordHash, 'correct horse battery')).resolves.toBe(
        true,
      );
    });

    it('throws ConflictError when the email is already registered', async () => {
      const email = `${randomUUID()}@example.com`;
      createdEmails.push(email);
      await service.registerUser({ email, password: 'correct horse battery', name: 'Jane' });

      await expect(
        service.registerUser({ email, password: 'another password', name: 'Jane Two' }),
      ).rejects.toThrow(ConflictError);
    });
  });
});
