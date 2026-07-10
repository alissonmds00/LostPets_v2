import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import type { Env } from '../../../src/infra/config/env.js';
import type { IdentityRepository } from '../../../src/modules/identity/identity.repository.js';
import type { ModerationService } from '../../../src/modules/moderation/moderation.service.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { SessionWithUserDto } from '../../../src/modules/identity/identity.dto.js';
import type { ReportDto } from '../../../src/modules/moderation/moderation.dto.js';

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

function makeReport(overrides: Partial<ReportDto> = {}): ReportDto {
  return {
    id: randomUUID(),
    reporterId: randomUUID(),
    listingId: randomUUID(),
    reason: 'Anúncio falso',
    status: 'PENDING',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildTestApp(
  moderationService: Partial<ModerationService>,
  petsService: Partial<PetsService> = {},
) {
  const sessions = new Map<string, SessionWithUserDto>();
  const identityRepository: Pick<IdentityRepository, 'findValidById'> = {
    findValidById: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null),
  };

  const app = buildApp(testEnv, {
    identityRepository: identityRepository as IdentityRepository,
    moderationService: moderationService as ModerationService,
    petsService: petsService as PetsService,
  });

  function seedValidSession(
    userId: string,
    role: 'USER' | 'ADMIN' = 'USER',
  ): { sessionId: string } {
    const sessionId = randomUUID();
    sessions.set(sessionId, {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      user: { id: userId, email: `${randomUUID()}@example.com`, name: 'Test User', role },
    });
    return { sessionId };
  }

  return { app, seedValidSession };
}

describe('POST /api/moderation/reports', () => {
  it('returns 401 without an authenticated session', async () => {
    const moderationService = { createReport: vi.fn() };
    const { app } = buildTestApp(moderationService);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/moderation/reports',
      payload: { listingId: randomUUID(), reason: 'x' },
    });

    expect(response.statusCode).toBe(401);
    expect(moderationService.createReport).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 201 and forwards reporterId from the session, never from the body', async () => {
    const report = makeReport();
    const moderationService = { createReport: vi.fn().mockResolvedValue(report) };
    const { app, seedValidSession } = buildTestApp(moderationService);
    await app.ready();

    const userId = randomUUID();
    const { sessionId } = seedValidSession(userId);
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: '/api/moderation/reports',
      payload: { listingId: report.listingId, reason: report.reason },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(201);
    expect(moderationService.createReport).toHaveBeenCalledWith({
      listingId: report.listingId,
      reason: report.reason,
      reporterId: userId,
    });

    await app.close();
  });
});

describe('GET /api/moderation/reports', () => {
  it('returns 401 without an authenticated session', async () => {
    const moderationService = { listPendingReports: vi.fn() };
    const { app } = buildTestApp(moderationService);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/api/moderation/reports' });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('returns 403 for a non-admin user', async () => {
    const moderationService = { listPendingReports: vi.fn() };
    const { app, seedValidSession } = buildTestApp(moderationService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID(), 'USER');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/api/moderation/reports',
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(403);
    expect(moderationService.listPendingReports).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 with the pending reports for an admin', async () => {
    const reports = [makeReport()];
    const moderationService = { listPendingReports: vi.fn().mockResolvedValue(reports) };
    const { app, seedValidSession } = buildTestApp(moderationService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID(), 'ADMIN');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'GET',
      url: '/api/moderation/reports',
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);

    await app.close();
  });
});

describe('POST /api/moderation/reports/:id/resolve', () => {
  it('returns 403 for a non-admin user', async () => {
    const moderationService = { resolveReport: vi.fn() };
    const { app, seedValidSession } = buildTestApp(moderationService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID(), 'USER');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/moderation/reports/${randomUUID()}/resolve`,
      payload: { outcome: 'DISMISSED' },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(403);
    expect(moderationService.resolveReport).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 200 and, for REVIEWED_REMOVED, also calls petsService.deleteListing as the admin requester', async () => {
    const report = makeReport({ status: 'REVIEWED' });
    const moderationService = { resolveReport: vi.fn().mockResolvedValue(report) };
    const petsService = { deleteListing: vi.fn().mockResolvedValue(undefined) };
    const { app, seedValidSession } = buildTestApp(moderationService, petsService);
    await app.ready();

    const adminId = randomUUID();
    const { sessionId } = seedValidSession(adminId, 'ADMIN');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/moderation/reports/${report.id}/resolve`,
      payload: { outcome: 'REVIEWED_REMOVED' },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(200);
    expect(moderationService.resolveReport).toHaveBeenCalledWith(report.id, 'REVIEWED_REMOVED');
    expect(petsService.deleteListing).toHaveBeenCalledWith({
      id: report.listingId,
      requesterId: adminId,
      requesterRole: 'ADMIN',
    });

    await app.close();
  });

  it('returns 409 when the service throws ReportAlreadyResolvedError', async () => {
    const { ReportAlreadyResolvedError } =
      await import('../../../src/modules/moderation/moderation.errors.js');
    const moderationService = {
      resolveReport: vi.fn().mockRejectedValue(new ReportAlreadyResolvedError()),
    };
    const petsService = { deleteListing: vi.fn() };
    const { app, seedValidSession } = buildTestApp(moderationService, petsService);
    await app.ready();

    const { sessionId } = seedValidSession(randomUUID(), 'ADMIN');
    const signed = app.signCookie(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/moderation/reports/${randomUUID()}/resolve`,
      payload: { outcome: 'DISMISSED' },
      headers: { cookie: `${testEnv.SESSION_COOKIE_NAME}=${signed}` },
    });

    expect(response.statusCode).toBe(409);
    expect(petsService.deleteListing).not.toHaveBeenCalled();

    await app.close();
  });
});
