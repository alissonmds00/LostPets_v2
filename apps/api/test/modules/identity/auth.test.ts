import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import type { Env } from '../../../src/shared/config/env.js';
import { prisma } from '../../../src/shared/db/prisma.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/lost_pets_test?schema=public',
  SESSION_COOKIE_NAME: 'lost_pets_sid',
  SESSION_COOKIE_SECRET: 'a'.repeat(32),
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './uploads',
  SQS_QUEUE_URL: 'http://localhost:4566/000000000000/pets-registration',
  SQS_REGION: 'us-east-1',
};

// Exercises requireAuth/requireRole via a throwaway route registered only in
// this test — register/login/logout/me (the real routes that will use these
// decorators) are separate tasks built on top of this session infra.
//
// Awaits app.ready() before returning: @fastify/cookie's signCookie/
// unsignCookie decorators (and requireAuth/requireRole from authPlugin) are
// only attached once Fastify finishes booting all registered plugins, so
// calling app.signCookie(...) right after buildApp() (before boot completes)
// throws "not a function".
async function buildTestApp() {
  const app = buildApp(testEnv);
  app.get('/__test/protected', { preHandler: (req, reply) => app.requireAuth(req, reply) }, () => ({
    ok: true,
  }));
  app.get(
    '/__test/admin-only',
    { preHandler: (req, reply) => app.requireRole('ADMIN')(req, reply) },
    () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

describe('requireAuth / requireRole', () => {
  let userId: string;
  let adminId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `${randomUUID()}@example.com`, passwordHash: 'x', name: 'User' },
    });
    userId = user.id;

    const admin = await prisma.user.create({
      data: { email: `${randomUUID()}@example.com`, passwordHash: 'x', name: 'Admin', role: 'ADMIN' },
    });
    adminId = admin.id;
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [userId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
  });

  it('returns 401 with no session cookie', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/__test/protected' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 401 with an invalid/unsigned cookie value', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: 'not-a-real-signed-value' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('attaches request.user and allows access with a valid session cookie', async () => {
    const app = await buildTestApp();
    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('returns 401 for an expired session', async () => {
    const app = await buildTestApp();
    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() - 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/protected',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 when requireRole does not match the user role', async () => {
    const app = await buildTestApp();
    const session = await prisma.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/admin-only',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('returns 200 when requireRole matches the user role', async () => {
    const app = await buildTestApp();
    const session = await prisma.session.create({
      data: { userId: adminId, expiresAt: new Date(Date.now() + 60_000) },
    });
    const signed = app.signCookie(session.id);

    const response = await app.inject({
      method: 'GET',
      url: '/__test/admin-only',
      cookies: { [testEnv.SESSION_COOKIE_NAME]: signed },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});
