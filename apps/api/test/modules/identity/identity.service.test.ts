import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { hashPassword } from '../../../src/infra/password.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { IdentityService } from '../../../src/modules/identity/identity.service.js';
import { UnauthorizedError } from '../../../src/infra/errors/app-error.js';

describe('IdentityService', () => {
  // Repository injected via constructor (see the dependency-injection
  // skill) — still the real repository/Postgres, per the testing skill's
  // "no mocking a collaborator" rule for service tests.
  const repository = new IdentityRepository();
  const service = new IdentityService(repository, 7);
  let userId: string;
  let userEmail: string;
  const plainPassword = 'correct-horse-battery-staple';

  beforeEach(async () => {
    userEmail = `${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await hashPassword(plainPassword),
        name: 'Test User',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  describe('login', () => {
    it('creates a session and returns the safe user when credentials are correct', async () => {
      const result = await service.login({ email: userEmail, password: plainPassword });

      expect(result.session.userId).toBe(userId);
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe(userEmail);
      expect(result.user).not.toHaveProperty('passwordHash');

      const stored = await prisma.session.findUnique({ where: { id: result.session.id } });
      expect(stored).not.toBeNull();
    });

    it('throws UnauthorizedError when the email does not exist', async () => {
      await expect(
        service.login({ email: `${randomUUID()}@example.com`, password: plainPassword }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when the password is wrong', async () => {
      await expect(service.login({ email: userEmail, password: 'wrong-password' })).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('does not create a session when credentials are invalid', async () => {
      const before = await prisma.session.count({ where: { userId } });

      await expect(service.login({ email: userEmail, password: 'wrong-password' })).rejects.toThrow();

      const after = await prisma.session.count({ where: { userId } });
      expect(after).toBe(before);
    });
  });
});
