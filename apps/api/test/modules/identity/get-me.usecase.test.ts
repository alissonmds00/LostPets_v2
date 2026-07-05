import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import type { Env } from '../../../src/infra/config/env.js';
import type { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import type { SessionWithUserDto } from '../../../src/modules/identity/identity.dto.js';

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

// GET /me's only preHandler is requireAuth, and getMeUsecase itself never
// calls identityService (see src/usecases/get-me.usecase.ts — it just
// formats request.user, already attached by requireAuth). So only
// identityRepository needs mocking here — requireAuth is the sole
// collaborator these tests exercise (see the testing skill's 2026-07-04
// revision).
function buildTestApp(findValidById: IdentityRepository['findValidById']) {
  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(findValidById),
  };
  return buildApp(testEnv, { identityRepository: identityRepository as IdentityRepository });
}

describe('GET /api/identity/me', () => {
  it('returns 401 with no session cookie', async () => {
    const app = buildTestApp(async () => null);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/identity/me' });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 401 with an invalid/unsigned cookie value', async () => {
    const app = buildTestApp(async () => null);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: 'not-a-real-signed-value' },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 401 for an expired session', async () => {
    // Mirrors IdentityRepository.findValidById's own contract: an expired
    // session is treated as not found (null), not returned and checked for
    // expiry elsewhere — see identity.repository.ts.
    const app = buildTestApp(async () => null);
    await app.ready();

    const signed = app.signCookie(randomUUID());

    const response = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 200 and the authenticated user (safe shape) with a valid session cookie', async () => {
    const email = `${randomUUID()}@example.com`;
    const userId = randomUUID();
    const sessionId = randomUUID();
    const session: SessionWithUserDto = {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: { id: userId, email, name: 'Jane Doe', role: 'USER' },
    };
    const app = buildTestApp(async (id) => (id === sessionId ? session : null));
    await app.ready();

    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({ id: userId, email, name: 'Jane Doe', role: 'USER' });
    expect(body).not.toHaveProperty('passwordHash');

    await app.close();
  });
});
