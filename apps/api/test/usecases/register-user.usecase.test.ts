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
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './uploads',
  SQS_QUEUE_URL: 'http://localhost:4566/000000000000/pets-registration',
  SQS_REGION: 'us-east-1',
};

describe('POST /api/identity/register', () => {
  // Scoped to exactly the emails each test creates (tracked in `createdEmails`)
  // rather than a broad `contains: '@example.com'` match — this suite runs
  // concurrently with other test files (e.g. auth.test.ts) against the same
  // lost_pets_test database, and a broad delete would race-delete fixtures
  // another file's test is still using.
  const createdEmails: string[] = [];

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails.splice(0) } } });
  });

  it('registers a new user and returns the safe user shape (201)', async () => {
    const app = buildApp(testEnv);
    const email = `${randomUUID()}@example.com`;
    createdEmails.push(email);

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

    await app.close();
  });

  it('returns 409 when the email is already registered', async () => {
    const app = buildApp(testEnv);
    const email = `${randomUUID()}@example.com`;
    createdEmails.push(email);
    await prisma.user.create({ data: { email, passwordHash: 'x', name: 'Existing' } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/register',
      payload: { email, password: 'correct horse battery', name: 'Jane Doe' },
    });

    expect(response.statusCode).toBe(409);

    await app.close();
  });

  it('returns 400 for an invalid body (bad email, short password)', async () => {
    const app = buildApp(testEnv);

    const response = await app.inject({
      method: 'POST',
      url: '/api/identity/register',
      payload: { email: 'not-an-email', password: 'short', name: '' },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
