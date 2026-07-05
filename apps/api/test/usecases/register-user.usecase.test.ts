import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/infra/config/env.js';
import { ConflictError } from '../../src/infra/errors/app-error.js';
import type { IdentityService } from '../../src/modules/identity/identity.service.js';

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

// Route under test (POST /register) never goes through requireAuth, so only
// identityService needs mocking here — no real repository/Postgres involved
// (see the testing skill's 2026-07-04 revision).
function buildTestApp(identityService: Pick<IdentityService, 'registerUser'>) {
  return buildApp(testEnv, { identityService: identityService as IdentityService });
}

describe('POST /api/identity/register', () => {
  it('registers a new user and returns the safe user shape (201)', async () => {
    const email = `${randomUUID()}@example.com`;
    const createdUser = {
      id: randomUUID(),
      email,
      name: 'Jane Doe',
      role: 'USER' as const,
      createdAt: new Date(),
    };
    const identityService = { registerUser: vi.fn().mockResolvedValue(createdUser) };
    const app = buildTestApp(identityService);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/register',
      payload: { email, password: 'correct horse battery', name: 'Jane Doe' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ email, name: 'Jane Doe', role: 'USER' });
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(identityService.registerUser).toHaveBeenCalledWith({
      email,
      password: 'correct horse battery',
      name: 'Jane Doe',
    });

    await app.close();
  });

  it('returns 409 when the email is already registered', async () => {
    const email = `${randomUUID()}@example.com`;
    const identityService = {
      registerUser: vi.fn().mockRejectedValue(new ConflictError('E-mail já cadastrado')),
    };
    const app = buildTestApp(identityService);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/register',
      payload: { email, password: 'correct horse battery', name: 'Jane Doe' },
    });

    expect(response.statusCode).toBe(409);

    await app.close();
  });

  it('returns 400 for an invalid body (bad email, short password)', async () => {
    const identityService = { registerUser: vi.fn() };
    const app = buildTestApp(identityService);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/register',
      payload: { email: 'not-an-email', password: 'short', name: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(identityService.registerUser).not.toHaveBeenCalled();

    await app.close();
  });
});
