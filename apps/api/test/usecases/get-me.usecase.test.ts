import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/infra/config/env.js';
import { prisma } from '../../src/infra/db/prisma.js';

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

describe('GET /api/identity/me', () => {
  let userId: string;

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('returns 401 with no session cookie', async () => {
    const app = buildApp(testEnv);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/identity/me' });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 401 with an invalid/unsigned cookie value', async () => {
    const app = buildApp(testEnv);
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
    const app = buildApp(testEnv);
    await app.ready();

    const user = await prisma.user.create({
      data: { email: `${randomUUID()}@example.com`, passwordHash: 'x', name: 'Expired User' },
    });
    userId = user.id;
    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() - 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/identity/me',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 200 and the authenticated user (safe shape) with a valid session cookie', async () => {
    const app = buildApp(testEnv);
    await app.ready();

    const email = `${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: 'x', name: 'Jane Doe' },
    });
    userId = user.id;
    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

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
