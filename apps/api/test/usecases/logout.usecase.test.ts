import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/infra/config/env.js';
import type { IdentityRepository } from '../../src/modules/identity/identity.repository.js';
import type { IdentityService } from '../../src/modules/identity/identity.service.js';
import type { SessionWithUserDto } from '../../src/modules/identity/identity.dto.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/lost_pets_test?schema=public',
  SESSION_COOKIE_NAME: 'lost_pets_sid',
  SESSION_COOKIE_SECRET: 'a'.repeat(32),
  SESSION_TTL_DAYS: 7,
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './uploads',
  SQS_QUEUE_URL: 'http://localhost:4566/000000000000/pets-registration',
  SQS_REGION: 'us-east-1',
};

// POST /logout has requireAuth as its own preHandler, so every test in this
// file exercises requireAuth — which reads app.identityRepository directly
// (see infra/auth.ts), not identityService. identityRepository is mocked
// with an in-memory session store so deleteById (called by identityService's
// mocked logout below) actually makes findValidById stop returning it
// afterward — that's what the third test needs to observe. identityService
// is mocked too, delegating logout to that same store, so the assertions
// don't depend on Postgres for either collaborator (see the testing skill's
// 2026-07-04 revision).
function buildTestApp(userId: string) {
  const sessions = new Map<string, SessionWithUserDto>();

  const identityRepository: Pick<IdentityRepository, 'findValidById' | 'deleteById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
    deleteById: vi.fn(async (sessionId: string) => {
      sessions.delete(sessionId);
    }),
  };

  const identityService: Pick<IdentityService, 'logout'> = {
    logout: vi.fn(async (sessionId: string) => {
      await identityRepository.deleteById(sessionId);
    }),
  };

  const app = buildApp(testEnv, {
    identityRepository: identityRepository as IdentityRepository,
    identityService: identityService as IdentityService,
  });

  app.get(
    '/__test/protected',
    { preHandler: (req, reply) => app.requireAuth(req, reply) },
    () => ({ ok: true }),
  );

  function seedSession(sessionId: string, expiresAt: Date) {
    sessions.set(sessionId, {
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date(),
      user: { id: userId, email: `${randomUUID()}@example.com`, name: 'Test User', role: 'USER' },
    });
  }

  return { app, identityRepository, identityService, seedSession };
}

describe('POST /api/identity/logout', () => {
  let userId: string;

  beforeEach(() => {
    userId = randomUUID();
  });

  it('returns 204, deletes the session, and clears the cookie', async () => {
    const { app, identityRepository, seedSession } = buildTestApp(userId);
    await app.ready();

    const sessionId = randomUUID();
    seedSession(sessionId, new Date(Date.now() + 60_000));
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(204);
    expect(identityRepository.deleteById).toHaveBeenCalledWith(sessionId);

    const stored = await identityRepository.findValidById(sessionId);
    expect(stored).toBeNull();

    const setCookie = response.cookies.find((c) => c.name === testEnv.SESSION_COOKIE_NAME);
    expect(setCookie).toBeDefined();
    // Cleared cookie: empty value and already-expired Max-Age/Expires, same
    // shape @fastify/cookie's reply.clearCookie() produces.
    expect(setCookie?.value).toBe('');

    await app.close();
  });

  it('returns 401 when there is no session cookie', async () => {
    const { app } = buildTestApp(userId);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('a session cookie no longer works against a protected route after logout', async () => {
    const { app, seedSession } = buildTestApp(userId);
    await app.ready();

    const sessionId = randomUUID();
    seedSession(sessionId, new Date(Date.now() + 60_000));
    const signed = app.signCookie(sessionId);

    await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(protectedResponse.statusCode).toBe(401);

    await app.close();
  });
});
