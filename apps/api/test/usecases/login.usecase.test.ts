import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Env } from '../../src/infra/config/env.js';
import { prisma } from '../../src/infra/db/prisma.js';
import { hashPassword } from '../../src/infra/password.js';

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

describe('POST /api/identity/login', () => {
  let userId: string;
  let userEmail: string;
  const plainPassword = 'correct-horse-battery-staple';

  beforeEach(async () => {
    userEmail = `${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await hashPassword(plainPassword),
        name: 'Test User',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('returns 200, the safe user, and sets a signed session cookie on valid credentials', async () => {
    const app = buildApp(testEnv);
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
    const session = await prisma.session.findUnique({ where: { id: String(unsigned.value) } });
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(userId);

    await app.close();
  });

  it('returns 401 and does not set a cookie when the password is wrong', async () => {
    const app = buildApp(testEnv);
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
    const app = buildApp(testEnv);
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
    const app = buildApp(testEnv);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: { email: 'not-an-email', password: '' },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('logs in with a session cookie that requireAuth then accepts', async () => {
    const app = buildApp(testEnv);
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
