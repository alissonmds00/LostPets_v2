import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import type { Env } from '../../../src/infra/config/env.js';
import type { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { MessagingService } from '../../../src/modules/messaging/messaging.service.js';
import type { SessionWithUserDto } from '../../../src/modules/identity/identity.dto.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';
import type { MessageDto } from '../../../src/modules/messaging/messaging.dto.js';

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

function makeListing(overrides: Partial<PetListingDto> = {}): PetListingDto {
  const createdAt = new Date();
  return {
    id: randomUUID(),
    type: 'LOST',
    title: 'Cachorro perdido',
    description: 'd',
    species: 'cachorro',
    latitude: -23.5,
    longitude: -46.6,
    city: 'São Paulo',
    status: 'ACTIVE',
    ownerId: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    photos: [],
    ...overrides,
  };
}

function buildTestApp(
  petsService: Partial<PetsService>,
  messagingService: Partial<MessagingService>,
) {
  const sessions = new Map<string, SessionWithUserDto>();
  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
  };

  const app = buildApp(testEnv, {
    identityRepository: identityRepository as IdentityRepository,
    petsService: petsService as PetsService,
    messagingService: messagingService as MessagingService,
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

describe('GET /api/messaging/ws/:listingId/:receiverId', () => {
  it('rejects the upgrade without an authenticated session', async () => {
    const { app } = buildTestApp({}, {});
    await app.ready();

    await expect(
      app.injectWS(`/api/messaging/ws/${randomUUID()}/${randomUUID()}`),
    ).rejects.toBeTruthy();

    await app.close();
  });

  it('accepts the upgrade with a valid session and persists an incoming message via the send-message usecase', async () => {
    const listing = makeListing();
    const petsService = { getListing: vi.fn().mockResolvedValue(listing) };
    const message = { id: randomUUID() } as MessageDto;
    const messagingService = { sendMessage: vi.fn().mockResolvedValue(message) };
    const { app, seedValidSession } = buildTestApp(petsService, messagingService);
    await app.ready();

    const senderId = randomUUID();
    const { sessionId } = seedValidSession(senderId);
    const signed = app.signCookie(sessionId);

    const ws = await app.injectWS(`/api/messaging/ws/${listing.id}/${listing.ownerId}`, {
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    ws.send(JSON.stringify({ body: 'Ainda está disponível?' }));
    // Não há resposta síncrona no socket pra esperar — aguarda o handler
    // assíncrono do frame processar antes de checar o mock.
    await vi.waitFor(() => expect(messagingService.sendMessage).toHaveBeenCalledTimes(1));

    expect(messagingService.sendMessage).toHaveBeenCalledWith({
      listingId: listing.id,
      senderId,
      receiverId: listing.ownerId,
      body: 'Ainda está disponível?',
    });

    ws.terminate();
    await app.close();
  });
});

describe('GET /api/messaging/:listingId', () => {
  it('returns 401 without an authenticated session', async () => {
    const messagingService = { getHistory: vi.fn() };
    const { app } = buildTestApp({}, messagingService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: `/api/messaging/${randomUUID()}` });

    expect(response.statusCode).toBe(401);
    expect(messagingService.getHistory).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 with the paginated history, scoped to the authenticated requester', async () => {
    const listingId = randomUUID();
    const messagingService = {
      getHistory: vi
        .fn()
        .mockResolvedValue({ data: [], pagination: { total: 0, offset: 0, limit: 20 } }),
    };
    const { app, seedValidSession } = buildTestApp({}, messagingService);
    await app.ready();

    const userId = randomUUID();
    const { sessionId } = seedValidSession(userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/messaging/${listingId}`,
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], pagination: { total: 0, offset: 0, limit: 20 } });
    expect(messagingService.getHistory).toHaveBeenCalledWith(listingId, userId, {
      offset: 0,
      limit: 20,
    });

    await app.close();
  });
});
