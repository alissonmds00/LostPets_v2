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
  return sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
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
function buildTestApp(petsService: Partial<PetsService>) {
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

function makeListing(
  overrides: Partial<import('../../../src/modules/pets/pets.dto.js').PetListingDto> = {},
) {
  const createdAt = new Date();
  return {
    id: randomUUID(),
    type: 'LOST' as const,
    title: 'Cachorro perdido',
    description: 'Golden retriever, atende por Rex',
    species: 'cachorro',
    latitude: -23.55052,
    longitude: -46.633308,
    city: 'São Paulo',
    status: 'ACTIVE' as const,
    ownerId: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    photos: [],
    ...overrides,
  };
}

describe('GET /api/pets', () => {
  it('returns 200 with the paginated list from the service, no auth required', async () => {
    const listing = makeListing();
    const petsService = {
      listListings: vi
        .fn()
        .mockResolvedValue({ data: [listing], pagination: { total: 1, offset: 0, limit: 20 } }),
    };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/pets' });

    expect(response.statusCode).toBe(200);
    expect(response.json().pagination).toEqual({ total: 1, offset: 0, limit: 20 });
    expect(response.json().data).toHaveLength(1);
    // Sem filtro explícito, status default ACTIVE e paginação default (0/20)
    // chegam no service já resolvidos pelo Zod.
    expect(petsService.listListings).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', offset: 0, limit: 20 }),
    );

    await app.close();
  });

  it('returns 400 when only some of lat/lng/radiusKm are given', async () => {
    const petsService = { listListings: vi.fn() };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/pets?lat=-23.5&lng=-46.6' });

    expect(response.statusCode).toBe(400);
    expect(petsService.listListings).not.toHaveBeenCalled();

    await app.close();
  });

  it('passes lat/lng/radiusKm through when all three are given together', async () => {
    const petsService = {
      listListings: vi
        .fn()
        .mockResolvedValue({ data: [], pagination: { total: 0, offset: 0, limit: 20 } }),
    };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/pets?lat=-23.5&lng=-46.6&radiusKm=10',
    });

    expect(response.statusCode).toBe(200);
    expect(petsService.listListings).toHaveBeenCalledWith(
      expect.objectContaining({ lat: -23.5, lng: -46.6, radiusKm: 10 }),
    );

    await app.close();
  });
});

describe('GET /api/pets/:id', () => {
  it('returns 200 with the listing, no auth required', async () => {
    const listing = makeListing();
    const petsService = { getListing: vi.fn().mockResolvedValue(listing) };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: `/api/pets/${listing.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(listing.id);
    expect(petsService.getListing).toHaveBeenCalledWith(listing.id);

    await app.close();
  });

  it('returns 404 when the service throws NotFoundError', async () => {
    const { NotFoundError } = await import('../../../src/infra/errors/app-error.js');
    const petsService = { getListing: vi.fn().mockRejectedValue(new NotFoundError('Anúncio')) };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: `/api/pets/${randomUUID()}` });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});

describe('PATCH /api/pets/:id', () => {
  it('returns 401 without an authenticated session', async () => {
    const petsService = { updateListing: vi.fn() };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/pets/${randomUUID()}`,
      payload: { title: 'Novo título' },
    });

    expect(response.statusCode).toBe(401);
    expect(petsService.updateListing).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 and forwards requesterId/requesterRole from the session, never from the body', async () => {
    const listing = makeListing();
    const petsService = {
      updateListing: vi.fn().mockResolvedValue({ ...listing, title: 'Novo título' }),
    };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const userId = randomUUID();
    const { sessionId } = seedValidSession(userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/pets/${listing.id}`,
      payload: { title: 'Novo título' },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Novo título');
    expect(petsService.updateListing).toHaveBeenCalledWith({
      id: listing.id,
      requesterId: userId,
      requesterRole: 'USER',
      title: 'Novo título',
    });

    await app.close();
  });

  it('returns 403 when the service throws ForbiddenError', async () => {
    const { ForbiddenError } = await import('../../../src/infra/errors/app-error.js');
    const petsService = { updateListing: vi.fn().mockRejectedValue(new ForbiddenError()) };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID());
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/pets/${randomUUID()}`,
      payload: { title: 'x' },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });
});

describe('DELETE /api/pets/:id', () => {
  it('returns 401 without an authenticated session', async () => {
    const petsService = { deleteListing: vi.fn() };
    const { app } = buildTestApp(petsService);
    await app.ready();

    const response = await app.inject({ method: 'DELETE', url: `/api/pets/${randomUUID()}` });

    expect(response.statusCode).toBe(401);
    expect(petsService.deleteListing).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 204 and forwards requesterId/requesterRole from the session', async () => {
    const listingId = randomUUID();
    const petsService = { deleteListing: vi.fn().mockResolvedValue(undefined) };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const userId = randomUUID();
    const { sessionId } = seedValidSession(userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pets/${listingId}`,
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(204);
    expect(petsService.deleteListing).toHaveBeenCalledWith({
      id: listingId,
      requesterId: userId,
      requesterRole: 'USER',
    });

    await app.close();
  });

  it('returns 403 when the service throws ForbiddenError (not the owner, not an admin)', async () => {
    const { ForbiddenError } = await import('../../../src/infra/errors/app-error.js');
    const petsService = { deleteListing: vi.fn().mockRejectedValue(new ForbiddenError()) };
    const { app, seedValidSession } = buildTestApp(petsService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID());
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pets/${randomUUID()}`,
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });
});
