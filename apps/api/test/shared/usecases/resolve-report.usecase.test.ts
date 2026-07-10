import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { resolveReportUsecase } from '../../../src/shared/usecases/resolve-report.usecase.js';
import type { ModerationService } from '../../../src/modules/moderation/moderation.service.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { ReportDto } from '../../../src/modules/moderation/moderation.dto.js';

function makeReport(overrides: Partial<ReportDto> = {}): ReportDto {
  return {
    id: randomUUID(),
    reporterId: randomUUID(),
    listingId: randomUUID(),
    reason: 'x',
    status: 'REVIEWED',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('resolveReportUsecase', () => {
  const adminId = randomUUID();

  it('resolves the report and does not touch pets for outcome DISMISSED', async () => {
    const report = makeReport({ status: 'DISMISSED' });
    const moderationService = {
      resolveReport: vi.fn().mockResolvedValue(report),
    } as unknown as ModerationService;
    const petsService = { deleteListing: vi.fn() } as unknown as PetsService;

    const result = await resolveReportUsecase(moderationService, petsService, {
      reportId: report.id,
      outcome: 'DISMISSED',
      requesterId: adminId,
      requesterRole: 'ADMIN',
    });

    expect(result).toBe(report);
    expect(moderationService.resolveReport).toHaveBeenCalledWith(report.id, 'DISMISSED');
    expect(petsService.deleteListing).not.toHaveBeenCalled();
  });

  it('resolves the report and does not touch pets for outcome REVIEWED_KEPT', async () => {
    const report = makeReport({ status: 'REVIEWED' });
    const moderationService = {
      resolveReport: vi.fn().mockResolvedValue(report),
    } as unknown as ModerationService;
    const petsService = { deleteListing: vi.fn() } as unknown as PetsService;

    await resolveReportUsecase(moderationService, petsService, {
      reportId: report.id,
      outcome: 'REVIEWED_KEPT',
      requesterId: adminId,
      requesterRole: 'ADMIN',
    });

    expect(petsService.deleteListing).not.toHaveBeenCalled();
  });

  it('resolves the report and also soft-deletes the listing for outcome REVIEWED_REMOVED, reusing PetsService.deleteListing as an admin', async () => {
    const report = makeReport({ status: 'REVIEWED' });
    const moderationService = {
      resolveReport: vi.fn().mockResolvedValue(report),
    } as unknown as ModerationService;
    const petsService = {
      deleteListing: vi.fn().mockResolvedValue(undefined),
    } as unknown as PetsService;

    const result = await resolveReportUsecase(moderationService, petsService, {
      reportId: report.id,
      outcome: 'REVIEWED_REMOVED',
      requesterId: adminId,
      requesterRole: 'ADMIN',
    });

    expect(result).toBe(report);
    expect(petsService.deleteListing).toHaveBeenCalledWith({
      id: report.listingId,
      requesterId: adminId,
      requesterRole: 'ADMIN',
    });
  });

  it('propagates ReportAlreadyResolvedError from moderationService without calling pets', async () => {
    const { ReportAlreadyResolvedError } =
      await import('../../../src/modules/moderation/moderation.errors.js');
    const moderationService = {
      resolveReport: vi.fn().mockRejectedValue(new ReportAlreadyResolvedError()),
    } as unknown as ModerationService;
    const petsService = { deleteListing: vi.fn() } as unknown as PetsService;

    await expect(
      resolveReportUsecase(moderationService, petsService, {
        reportId: randomUUID(),
        outcome: 'REVIEWED_REMOVED',
        requesterId: adminId,
        requesterRole: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(ReportAlreadyResolvedError);
    expect(petsService.deleteListing).not.toHaveBeenCalled();
  });
});
