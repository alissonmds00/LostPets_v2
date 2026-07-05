import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as passwordModule from '../../../src/infra/password.js';
import { verifyPassword } from '../../../src/infra/password.js';
import type { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { IdentityService } from '../../../src/modules/identity/identity.service.js';
import { ConflictError, UnauthorizedError } from '../../../src/infra/errors/app-error.js';
import type { SessionWithUserDto, UserWithPasswordDto } from '../../../src/modules/identity/identity.dto.js';

describe('IdentityService', () => {
  // Repository mocked (see the testing skill's 2026-07-04 revision): the
  // service is tested in isolation from Postgres, exercising only its own
  // business logic (what it decides, what it throws, what arguments it
  // passes the repository). Only the methods IdentityService actually calls
  // (createUser, findByEmail, create, deleteById) need stubs — findValidById
  // is used elsewhere (e.g. requireAuth), not by this service.
  let repositoryMock: Pick<IdentityRepository, 'createUser' | 'findByEmail' | 'create' | 'deleteById'>;
  let service: IdentityService;

  beforeEach(() => {
    repositoryMock = {
      createUser: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      deleteById: vi.fn(),
    };
    // Same constructor used in production (see the dependency-injection
    // skill) — only what's passed as the repository changes.
    service = new IdentityService(repositoryMock as IdentityRepository, 7);
  });

  describe('registerUser', () => {
    it('hashes the password before calling repository.createUser, and returns what the repository returns', async () => {
      const email = `${randomUUID()}@example.com`;
      const createdUser = { id: randomUUID(), email, name: 'Jane', role: 'USER' as const };
      (repositoryMock.createUser as ReturnType<typeof vi.fn>).mockResolvedValue(createdUser);

      const user = await service.registerUser({ email, password: 'correct horse battery', name: 'Jane' });

      expect(user).toEqual(createdUser);
      expect(repositoryMock.createUser).toHaveBeenCalledTimes(1);
      const [callArg] = (repositoryMock.createUser as ReturnType<typeof vi.fn>).mock.calls[0] as [
        { email: string; passwordHash: string; name: string },
      ];
      expect(callArg.email).toBe(email);
      expect(callArg.name).toBe('Jane');
      // Verifies hashing happened before the repository call, without
      // reversing the hash — just confirming it's not the plain password,
      // and that it's a real argon2 verifiable hash.
      expect(callArg.passwordHash).not.toBe('correct horse battery');
      await expect(verifyPassword(callArg.passwordHash, 'correct horse battery')).resolves.toBe(true);
    });

    it('propagates ConflictError thrown by repository.createUser on duplicate email', async () => {
      const email = `${randomUUID()}@example.com`;
      (repositoryMock.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ConflictError('E-mail já cadastrado'),
      );

      await expect(
        service.registerUser({ email, password: 'correct horse battery', name: 'Jane' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    const plainPassword = 'correct-horse-battery-staple';
    let userId: string;
    let userEmail: string;
    let storedUser: UserWithPasswordDto;

    beforeEach(async () => {
      userId = randomUUID();
      userEmail = `${randomUUID()}@example.com`;
      storedUser = {
        id: userId,
        email: userEmail,
        name: 'Test User',
        role: 'USER',
        passwordHash: await passwordModule.hashPassword(plainPassword),
      };
    });

    it('creates a session and returns the safe user when credentials are correct', async () => {
      (repositoryMock.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(storedUser);
      const session: SessionWithUserDto = {
        id: randomUUID(),
        userId,
        expiresAt: new Date(Date.now() + 60_000),
        user: storedUser,
      };
      (repositoryMock.create as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.login({ email: userEmail, password: plainPassword });

      expect(repositoryMock.findByEmail).toHaveBeenCalledWith(userEmail);
      expect(repositoryMock.create).toHaveBeenCalledWith(userId, expect.any(Date));
      expect(result.session).toEqual(session);
      expect(result.user).toEqual({ id: userId, email: userEmail, name: 'Test User', role: 'USER' });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws UnauthorizedError when the email does not exist', async () => {
      (repositoryMock.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.login({ email: `${randomUUID()}@example.com`, password: plainPassword }),
      ).rejects.toThrow(UnauthorizedError);

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when the password is wrong', async () => {
      (repositoryMock.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(storedUser);

      await expect(
        service.login({ email: userEmail, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedError);

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    // Timing-attack mitigation (see SECURITY-AUDIT.md, section 4, item 1):
    // verifyPassword (argon2, CPU-expensive) must run on both the
    // "email doesn't exist" path and the "wrong password" path, so the two
    // failure responses take the same amount of time and don't leak whether
    // an email is registered via response latency. We spy on verifyPassword
    // and getDummyPasswordHash (infra, not the repository) purely to observe
    // they're invoked on the not-found path.
    it('calls verifyPassword and getDummyPasswordHash even when the email does not exist, to equalize timing with the wrong-password path', async () => {
      (repositoryMock.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const verifySpy = vi.spyOn(passwordModule, 'verifyPassword');
      const dummyHashSpy = vi.spyOn(passwordModule, 'getDummyPasswordHash');

      await expect(
        service.login({ email: `${randomUUID()}@example.com`, password: plainPassword }),
      ).rejects.toThrow(UnauthorizedError);

      expect(dummyHashSpy).toHaveBeenCalled();
      expect(verifySpy).toHaveBeenCalled();

      verifySpy.mockRestore();
      dummyHashSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('delegates to repository.deleteById with the given sessionId', async () => {
      const sessionId = randomUUID();
      (repositoryMock.deleteById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.logout(sessionId);

      expect(repositoryMock.deleteById).toHaveBeenCalledWith(sessionId);
    });

    it('does not throw when repository.deleteById resolves as a no-op (session already gone)', async () => {
      (repositoryMock.deleteById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(service.logout(randomUUID())).resolves.not.toThrow();
    });
  });
});
