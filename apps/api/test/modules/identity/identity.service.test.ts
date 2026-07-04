import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import * as passwordModule from '../../../src/infra/password.js';
import { hashPassword, verifyPassword } from '../../../src/infra/password.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { IdentityService } from '../../../src/modules/identity/identity.service.js';
import { ConflictError, UnauthorizedError } from '../../../src/infra/errors/app-error.js';

describe('IdentityService', () => {
  // Repository injected via constructor (see the dependency-injection
  // skill) — still the real repository/Postgres, per the testing skill's
  // "no mocking a collaborator" rule for service tests.
  const repository = new IdentityRepository();
  const service = new IdentityService(repository, 7);
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

  describe('login', () => {
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

    // Timing-attack mitigation (see SECURITY-AUDIT.md, section 4, item 1):
    // verifyPassword (argon2, CPU-expensive) must run on both the
    // "email doesn't exist" path and the "wrong password" path, so the two
    // failure paths cost the same CPU time and don't leak whether an email
    // is registered via response latency. We spy on verifyPassword (infra,
    // not a domain collaborator) purely to observe that it's invoked on
    // both paths — a real Date.now()-based timing test would be flaky.
    it('calls verifyPassword even when the email does not exist, to equalize timing with the wrong-password path', async () => {
      const verifySpy = vi.spyOn(passwordModule, 'verifyPassword');

      await expect(
        service.login({ email: `${randomUUID()}@example.com`, password: plainPassword }),
      ).rejects.toThrow(UnauthorizedError);

      expect(verifySpy).toHaveBeenCalled();

      verifySpy.mockRestore();
    });
  });

  describe('logout', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.com`,
          passwordHash: 'irrelevant-for-this-test',
          name: 'Test User',
        },
      });
      userId = user.id;
    });

    afterEach(async () => {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    });

    it('deletes the session identified by sessionId', async () => {
      const session = await repository.create(userId, new Date(Date.now() + 60_000));

      await service.logout(session.id);

      const found = await repository.findValidById(session.id);
      expect(found).toBeNull();
    });

    it('does not throw when the session does not exist', async () => {
      await expect(service.logout(randomUUID())).resolves.not.toThrow();
    });
  });
});
