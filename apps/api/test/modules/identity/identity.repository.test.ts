import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/infra/db/prisma.js';
import { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';

describe('IdentityRepository', () => {
  const repository = new IdentityRepository();
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    userEmail = `${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: userEmail,
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

  describe('findByEmail', () => {
    it('returns the user when a user with that email exists', async () => {
      const found = await repository.findByEmail(userEmail);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(userId);
      expect(found?.email).toBe(userEmail);
    });

    it('returns null when no user with that email exists', async () => {
      const found = await repository.findByEmail(`${randomUUID()}@example.com`);

      expect(found).toBeNull();
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
