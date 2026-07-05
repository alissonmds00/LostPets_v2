import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/infra/config/env.js';
import { UnauthorizedError } from '../../src/infra/errors/app-error.js';
import type { IdentityRepository } from '../../src/modules/identity/identity.repository.js';
import type { IdentityService } from '../../src/modules/identity/identity.service.js';
import type { LoginResultDto, SessionWithUserDto } from '../../src/modules/identity/identity.dto.js';

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

// POST /login itself only goes through identityService (no requireAuth
// preHandler), but the last test in this file logs in and then hits a
// requireAuth-protected route with the resulting cookie — requireAuth reads
// app.identityRepository directly (see infra/auth.ts), never identityService.
// So identityService.login and identityRepository.findValidById are mocked
// together here, sharing the same in-memory session store: when the mocked
// login "creates" a session, requireAuth's mocked repository lookup can
// actually find it afterward — see the testing skill's 2026-07-04 revision.
function buildTestApp(userId: string, userEmail: string, plainPassword: string) {
  const sessions = new Map<string, SessionWithUserDto>();
  const safeUser = { id: userId, email: userEmail, name: 'Test User', role: 'USER' as const };

  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
  };

  const identityService: Pick<IdentityService, 'login'> = {
    login: vi.fn(async ({ email, password }): Promise<LoginResultDto> => {
      if (email !== userEmail || password !== plainPassword) {
        throw new UnauthorizedError('Credenciais inválidas');
      }
      const sessionId = randomUUID();
      const session: SessionWithUserDto = {
        id: sessionId,
        userId,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        user: safeUser,
      };
      sessions.set(sessionId, session);
      return {
        session: { id: session.id, userId: session.userId, expiresAt: session.expiresAt, createdAt: session.createdAt },
        user: safeUser,
      };
    }),
  };

  const app = buildApp(testEnv, {
    identityService: identityService as IdentityService,
    identityRepository: identityRepository as IdentityRepository,
  });

  return { app, identityService };
}

describe('POST /api/identity/login', () => {
  let userId: string;
  let userEmail: string;
  const plainPassword = 'correct-horse-battery-staple';

  beforeEach(() => {
    userId = randomUUID();
    userEmail = `${randomUUID()}@example.com`;
  });

  it('returns 200, the safe user, and sets a signed session cookie on valid credentials', async () => {
    const { app } = buildTestApp(userId, userEmail, plainPassword);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: userEmail, password: plainPassword },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(userEmail);
    expect(body.user).not.toHaveProperty('passwordHash');

    const setCookie = response.cookies.find((c) => c.name === testEnv.SESSION_COOKIE_NAME);
    expect(setCookie).toBeDefined();
    expect(setCookie?.httpOnly).toBe(true);

    // The cookie must be valid for requireAuth to accept it later.
    const unsigned = app.unsignCookie(String(setCookie?.value));
    expect(unsigned.valid).toBe(true);

    await app.close();
  });

  it('returns 401 and does not set a cookie when the password is wrong', async () => {
    const { app } = buildTestApp(userId, userEmail, plainPassword);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: userEmail, password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(response.cookies.find((c) => c.name === testEnv.SESSION_COOKIE_NAME)).toBeUndefined();

    await app.close();
  });

  it('returns 401 when the email does not exist', async () => {
    const { app } = buildTestApp(userId, userEmail, plainPassword);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: `${randomUUID()}@example.com`, password: plainPassword },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 400 when the body is invalid', async () => {
    const { app, identityService } = buildTestApp(userId, userEmail, plainPassword);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: 'not-an-email', password: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(identityService.login).not.toHaveBeenCalled();

    await app.close();
  });

  it('logs in with a session cookie that requireAuth then accepts', async () => {
    const { app } = buildTestApp(userId, userEmail, plainPassword);
    app.get(
      '/__test/protected',
      { preHandler: (req, reply) => app.requireAuth(req, reply) },
      () => ({ ok: true }),
    );
    await app.ready();

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: userEmail, password: plainPassword },
    });
    const setCookie = loginResponse.cookies.find((c) => c.name === testEnv.SESSION_COOKIE_NAME);

    const protectedResponse = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: String(setCookie?.value) },
    });

    expect(protectedResponse.statusCode).toBe(200);

    await app.close();
  });
});
