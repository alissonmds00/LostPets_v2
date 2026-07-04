import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import { ConflictError } from '../../../src/infra/errors/app-error.js';

describe('IdentityRepository', () => {
  const repository = new IdentityRepository();
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

  describe('createUser', () => {
    it('creates a user and returns the safe (no passwordHash) shape', async () => {
      const email = `${randomUUID()}@example.com`;

      const user = await repository.createUser({
        email,
        passwordHash: 'hashed-value',
        name: 'New User',
      });

      expect(user.email).toBe(email);
      expect(user.name).toBe('New User');
      expect(user.role).toBe('USER');
      expect(user).not.toHaveProperty('passwordHash');

      await prisma.user.deleteMany({ where: { email } });
    });

    it('throws ConflictError when the email is already registered', async () => {
      const email = `${randomUUID()}@example.com`;
      await repository.createUser({ email, passwordHash: 'hashed-value', name: 'First User' });

      await expect(
        repository.createUser({ email, passwordHash: 'other-hash', name: 'Second User' }),
      ).rejects.toThrow(ConflictError);

      await prisma.user.deleteMany({ where: { email } });
    });
  });

  describe('create', () => {
    it('creates a session for the given user', async () => {
      const expiresAt = new Date(Date.now() + 60_000);

      const session = await repository.create(userId, expiresAt);

      expect(session.userId).toBe(userId);
      expect(session.expiresAt).toEqual(expiresAt);
    });
  });

  describe('findValidById', () => {
    it('returns the session with its user when not expired', async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const created = await repository.create(userId, expiresAt);

      const found = await repository.findValidById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.user.id).toBe(userId);
    });

    it('returns null when the session is expired', async () => {
      const expiresAt = new Date(Date.now() - 60_000);
      const created = await repository.create(userId, expiresAt);

      const found = await repository.findValidById(created.id);

      expect(found).toBeNull();
    });

    it('returns null when the session does not exist', async () => {
      const found = await repository.findValidById(randomUUID());

      expect(found).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deletes the session', async () => {
      const created = await repository.create(userId, new Date(Date.now() + 60_000));

      await repository.deleteById(created.id);

      const found = await repository.findValidById(created.id);
      expect(found).toBeNull();
    });

    it('does not throw when the session does not exist', async () => {
      await expect(repository.deleteById(randomUUID())).resolves.not.toThrow();
    });
  });
});
