import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/shared/config/env.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/lost_pets_test?schema=public',
  SESSION_COOKIE_NAME: 'lost_pets_sid',
  SESSION_COOKIE_SECRET: 'a'.repeat(32),
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './uploads',
};

describe('GET /health', () => {
  it('returns ok without touching the database', async () => {
    const app = buildApp(testEnv);
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
