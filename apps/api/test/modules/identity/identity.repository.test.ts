import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { prisma } from '../../../src/infra/db/prisma.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { ConflictError } from '../../../src/infra/errors/app-error.js';

vi.mock('../../../src/infra/db/prisma.js', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('IdentityRepository', () => {
  const repository = new IdentityRepository();
  const userId = randomUUID();
  const userEmail = `${randomUUID()}@example.com`;
  const createdAt = new Date();

  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe('createUser', () => {
    it('creates a user and returns the safe (no passwordHash) shape', async () => {
      const email = `${randomUUID()}@example.com`;
      prismaMock.user.create.mockResolvedValue({
        id: userId,
        email,
        name: 'New User',
        role: 'USER',
        createdAt,
      } as never);

      const user = await repository.createUser({
        email,
        passwordHash: 'hashed-value',
        name: 'New User',
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe('New User');
      expect(user.role).toBe('USER');
      expect(user).not.toHaveProperty('passwordHash');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: { email, passwordHash: 'hashed-value', name: 'New User' },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    });

    it('throws ConflictError when the email is already registered', async () => {
      const email = `${randomUUID()}@example.com`;
      prismaMock.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        repository.createUser({ email, passwordHash: 'other-hash', name: 'Second User' }),
      ).rejects.toThrow(ConflictError);
    });

    it('propagates any other error from prisma.user.create as-is', async () => {
      const email = `${randomUUID()}@example.com`;
      const unexpectedError = new Error('connection lost');
      prismaMock.user.create.mockRejectedValue(unexpectedError);

      await expect(
        repository.createUser({ email, passwordHash: 'hash', name: 'Someone' }),
      ).rejects.toThrow(unexpectedError);
    });
  });

  describe('findByEmail', () => {
    it('returns the user when a user with that email exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        email: userEmail,
        passwordHash: 'irrelevant-for-this-test',
        name: 'Test User',
        role: 'USER',
      } as never);

      const found = await repository.findByEmail(userEmail);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(userId);
      expect(found?.email).toBe(userEmail);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: userEmail } });
    });

    it('returns null when no user with that email exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const found = await repository.findByEmail(`${randomUUID()}@example.com`);

      expect(found).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a session for the given user', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const sessionId = randomUUID();
      prismaMock.session.create.mockResolvedValue({
        id: sessionId,
        userId,
        expiresAt,
        createdAt,
        user: { id: userId, email: userEmail, name: 'Test User', role: 'USER' },
      } as never);

      const session = await repository.create(userId, expiresAt);

      expect(session.userId).toBe(userId);
      expect(session.expiresAt).toEqual(expiresAt);
      expect(prismaMock.session.create).toHaveBeenCalledWith({
        data: { userId, expiresAt },
        include: { user: true },
      });
    });
  });

  describe('findValidById', () => {
    it('returns the session with its user when not expired', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const sessionId = randomUUID();
      prismaMock.session.findFirst.mockResolvedValue({
        id: sessionId,
        userId,
        expiresAt,
        createdAt,
        user: { id: userId, email: userEmail, name: 'Test User', role: 'USER' },
      } as never);

      const found = await repository.findValidById(sessionId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(sessionId);
      expect(found?.user.id).toBe(userId);
      expect(prismaMock.session.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, expiresAt: { gt: expect.any(Date) } },
        include: { user: true },
      });
    });

    it('returns null when the session is expired', async () => {
      prismaMock.session.findFirst.mockResolvedValue(null);

      const found = await repository.findValidById(randomUUID());

      expect(found).toBeNull();
    });

    it('returns null when the session does not exist', async () => {
      prismaMock.session.findFirst.mockResolvedValue(null);

      const found = await repository.findValidById(randomUUID());

      expect(found).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deletes the session', async () => {
      const sessionId = randomUUID();
      prismaMock.session.deleteMany.mockResolvedValue({ count: 1 });

      await repository.deleteById(sessionId);

      expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({ where: { id: sessionId } });
    });

    it('does not throw when the session does not exist', async () => {
      prismaMock.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(repository.deleteById(randomUUID())).resolves.not.toThrow();
    });
  });
});
