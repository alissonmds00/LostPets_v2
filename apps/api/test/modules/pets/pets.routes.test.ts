import { randomUUID } from 'node:crypto';
import FormData from 'form-data';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import type { Env } from '../../../src/infra/config/env.js';
import type { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
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

async function makeJpegBuffer(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .toBuffer();
}

function buildMultipartPayload(fields: Record<string, string>, photoBuffer?: Buffer) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  if (photoBuffer) {
    form.append('photo', photoBuffer, { filename: 'pet.jpg', contentType: 'image/jpeg' });
  }
  return form;
}

// requireAuth (preHandler) needs a real identityRepository-shaped session
// lookup — same pattern as auth.test.ts — plus a mocked petsService (this
// route's own collaborator). Neither Postgres nor the storage/queue gateways
// are touched (see the testing skill's 2026-07-04 revision).
function buildTestApp(petsService: Pick<PetsService, 'submitListingForRegistration'>) {
  const sessions = new Map<string, SessionWithUserDto>();
  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
  };

  const app = buildApp(testEnv, {
    identityRepository: identityRepository as IdentityRepository,
    petsService: petsService as PetsService,
  });

  function seedValidSession(userId: string): { sessionId: string } {
    const sessionId = randomUUID();
    sessions.set(sessionId, {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: { id: userId, email: `${randomUUID()}@example.com`, name: 'Test User', role: 'USER' },
    });
    return { sessionId };
  }

  return { app, seedValidSession };
}

describe('POST /api/pets', () => {
  it('returns 401 without an authenticated session', async () => {
    const petsService = { submitListingForRegistration: vi.fn() };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const form = buildMultipartPayload({
      type: 'LOST',
      title: 'Cachorro perdido',
      description: 'Golden retriever, atende por Rex',
      species: 'cachorro',
      latitude: '-23.55052',
      longitude: '-46.633308',
      city: 'São Paulo',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pets',
      payload: form,
      headers: form.getHeaders(),
    });

    expect(response.statusCode).toBe(401);
    expect(petsService.submitListingForRegistration).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 202 and calls the usecase/service with ownerId from the session (never from the body)', async () => {
    const petsService = { submitListingForRegistration: vi.fn().mockResolvedValue(undefined) };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const userId = randomUUID();
    const { sessionId } = seedValidSession(userId);
    const signed = app.signCookie(sessionId);
    const photoBuffer = await makeJpegBuffer();

    const form = buildMultipartPayload(
      {
        type: 'LOST',
        title: 'Cachorro perdido no bairro Centro',
        description: 'Golden retriever, atende por Rex',
        species: 'cachorro',
        latitude: '-23.55052',
        longitude: '-46.633308',
        city: 'São Paulo',
      },
      photoBuffer,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/pets',
      payload: form,
      headers: { ...form.getHeaders(), cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ received: true });

    expect(petsService.submitListingForRegistration).toHaveBeenCalledTimes(1);
    const [submittedInput] = vi.mocked(petsService.submitListingForRegistration).mock.calls[0];
    expect(submittedInput).toMatchObject({
      type: 'LOST',
      title: 'Cachorro perdido no bairro Centro',
      description: 'Golden retriever, atende por Rex',
      species: 'cachorro',
      latitude: -23.55052,
      longitude: -46.633308,
      city: 'São Paulo',
      ownerId: userId,
    });
    expect(submittedInput.photos).toHaveLength(1);
    expect(submittedInput.photos[0].contentType).toBe('image/jpeg');
    expect(submittedInput.photos[0].buffer).toBeInstanceOf(Buffer);

    await app.close();
  });

  it('returns 400 for invalid text fields (e.g. missing title)', async () => {
    const petsService = { submitListingForRegistration: vi.fn() };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID());
    const signed = app.signCookie(sessionId);

    const form = buildMultipartPayload({
      type: 'LOST',
      title: '',
      description: 'Golden retriever, atende por Rex',
      species: 'cachorro',
      latitude: '-23.55052',
      longitude: '-46.633308',
      city: 'São Paulo',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pets',
      payload: form,
      headers: { ...form.getHeaders(), cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(400);
    expect(petsService.submitListingForRegistration).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 422 when the service rejects an invalid photo (propagated from PetsService)', async () => {
    const { InvalidPetPhotoError } = await import('../../../src/modules/pets/pets.errors.js');
    const petsService = {
      submitListingForRegistration: vi
        .fn()
        .mockRejectedValue(new InvalidPetPhotoError('Tipo de arquivo não suportado')),
    };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID());
    const signed = app.signCookie(sessionId);
    const photoBuffer = await makeJpegBuffer();

    const form = buildMultipartPayload(
      {
        type: 'LOST',
        title: 'Cachorro perdido',
        description: 'Golden retriever, atende por Rex',
        species: 'cachorro',
        latitude: '-23.55052',
        longitude: '-46.633308',
        city: 'São Paulo',
      },
      photoBuffer,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/pets',
      payload: form,
      headers: { ...form.getHeaders(), cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(422);

    await app.close();
  });
});
