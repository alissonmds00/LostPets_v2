import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('POST /api/identity/logout', () => {
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

  it('returns 204, deletes the session, and clears the cookie', async () => {
    const app = buildApp(testEnv);
    await app.ready();

    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(204);

    const stored = await prisma.session.findUnique({ where: { id: session.id } });
    expect(stored).toBeNull();

    const setCookie = response.cookies.find((c) => c.name === testEnv.SESSION_COOKIE_NAME);
    expect(setCookie).toBeDefined();
    // Cleared cookie: empty value and already-expired Max-Age/Expires, same
    // shape @fastify/cookie's reply.clearCookie() produces.
    expect(setCookie?.value).toBe('');

    await app.close();
  });

  it('returns 401 when there is no session cookie', async () => {
    const app = buildApp(testEnv);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('a session cookie no longer works against a protected route after logout', async () => {
    const app = buildApp(testEnv);
    app.get(
      '/__test/protected',
      { preHandler: (req, reply) => app.requireAuth(req, reply) },
      () => ({ ok: true }),
    );
    await app.ready();

    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

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
