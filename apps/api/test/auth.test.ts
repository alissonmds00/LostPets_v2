import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/infra/config/env.js';
import type { IdentityRepository } from '../src/modules/identity/identity.repository.js';
import type { SessionWithUserDto } from '../src/modules/identity/identity.dto.js';

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

// Exercises requireAuth/requireRole via a throwaway route registered only in
// this test. requireAuth's only collaborator is identityRepository (see
// infra/auth.ts — it calls repository.findValidById directly, never
// identityService), so an in-memory session store standing in for
// identityRepository is enough here — no Postgres involved (see the testing
// skill's 2026-07-04 revision).
//
// Awaits app.ready() before returning: @fastify/cookie's signCookie/
// unsignCookie decorators (and requireAuth/requireRole from authPlugin) are
// only attached once Fastify finishes booting all registered plugins, so
// calling app.signCookie(...) right after buildApp() (before boot completes)
// throws "not a function".
async function buildTestApp() {
  const sessions = new Map<string, SessionWithUserDto>();

  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
  };

  const app = buildApp(testEnv, { identityRepository: identityRepository as IdentityRepository });
  app.get(
    '/__test/protected',
    { preHandler: (req, reply) => app.requireAuth(req, reply) },
    (req) => ({ ok: true, sessionId: req.sessionId }),
  );
  app.get(
    '/__test/admin-only',
    { preHandler: (req, reply) => app.requireRole('ADMIN')(req, reply) },
    () => ({ ok: true }),
  );
  await app.ready();

  function seedValidSession(sessionId: string, userId: string, role: 'USER' | 'ADMIN' = 'USER') {
    sessions.set(sessionId, {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: { id: userId, email: `${randomUUID()}@example.com`, name: 'Test User', role },
    });
  }

  return { app, seedValidSession };
}

describe('requireAuth / requireRole', () => {
  it('returns 401 with no session cookie', async () => {
    const { app } = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/__test/protected' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 401 with an invalid/unsigned cookie value', async () => {
    const { app } = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: 'not-a-real-signed-value' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('attaches request.user and allows access with a valid session cookie', async () => {
    const { app, seedValidSession } = await buildTestApp();
    const userId = randomUUID();
    const sessionId = randomUUID();
    seedValidSession(sessionId, userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('attaches request.sessionId with the id of the validated session', async () => {
    const { app, seedValidSession } = await buildTestApp();
    const userId = randomUUID();
    const sessionId = randomUUID();
    seedValidSession(sessionId, userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().sessionId).toBe(sessionId);
    await app.close();
  });

  it('returns 401 for an expired session', async () => {
    // Mirrors IdentityRepository.findValidById's own contract: an expired
    // session is treated the same as a missing one (null), so the mock
    // simply doesn't seed anything for this sessionId — see
    // identity.repository.ts.
    const { app } = await buildTestApp();
    const signed = app.signCookie(randomUUID());

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 when requireRole does not match the user role', async () => {
    const { app, seedValidSession } = await buildTestApp();
    const userId = randomUUID();
    const sessionId = randomUUID();
    seedValidSession(sessionId, userId, 'USER');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/admin-only',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('returns 200 when requireRole matches the user role', async () => {
    const { app, seedValidSession } = await buildTestApp();
    const adminId = randomUUID();
    const sessionId = randomUUID();
    seedValidSession(sessionId, adminId, 'ADMIN');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/admin-only',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
