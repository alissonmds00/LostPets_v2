import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ModerationService } from '../../../src/modules/moderation/moderation.service.js';
import { ReportAlreadyResolvedError } from '../../../src/modules/moderation/moderation.errors.js';
import type { ModerationRepository } from '../../../src/modules/moderation/moderation.repository.js';
import type { ReportDto } from '../../../src/modules/moderation/moderation.dto.js';

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

describe('ModerationService', () => {
  describe('createReport', () => {
    it('delegates to the repository', async () => {
      const report = makeReport();
      const repositoryMock = {
        create: vi.fn().mockResolvedValue(report),
      } as unknown as ModerationRepository;
      const service = new ModerationService(repositoryMock);

      const input = {
        reporterId: report.reporterId,
        listingId: report.listingId,
        reason: report.reason,
      };
      const result = await service.createReport(input);

      expect(result).toBe(report);
      expect(repositoryMock.create).toHaveBeenCalledWith(input);
    });
  });

  describe('listPendingReports', () => {
    it('delegates to the repository', async () => {
      const reports = [makeReport()];
      const repositoryMock = {
        findAllPending: vi.fn().mockResolvedValue(reports),
      } as unknown as ModerationRepository;
      const service = new ModerationService(repositoryMock);

      const result = await service.listPendingReports();

      expect(result).toBe(reports);
    });
  });

  describe('resolveReport', () => {
    it('sets status to DISMISSED for outcome DISMISSED', async () => {
      const report = makeReport({ status: 'PENDING' });
      const dismissed = { ...report, status: 'DISMISSED' as const };
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(report),
        updateStatus: vi.fn().mockResolvedValue(dismissed),
      } as unknown as ModerationRepository;
      const service = new ModerationService(repositoryMock);

      const result = await service.resolveReport(report.id, 'DISMISSED');

      expect(result).toBe(dismissed);
      expect(repositoryMock.updateStatus).toHaveBeenCalledWith(report.id, 'DISMISSED');
    });

    it.each(['REVIEWED_KEPT', 'REVIEWED_REMOVED'] as const)(
      'sets status to REVIEWED for outcome %s (removal itself is the cross-module usecase’s job, not this service)',
      async (outcome) => {
        const report = makeReport({ status: 'PENDING' });
        const reviewed = { ...report, status: 'REVIEWED' as const };
        const repositoryMock = {
          getById: vi.fn().mockResolvedValue(report),
          updateStatus: vi.fn().mockResolvedValue(reviewed),
        } as unknown as ModerationRepository;
        const service = new ModerationService(repositoryMock);

        const result = await service.resolveReport(report.id, outcome);

        expect(result).toBe(reviewed);
        expect(repositoryMock.updateStatus).toHaveBeenCalledWith(report.id, 'REVIEWED');
      },
    );

    it('throws ReportAlreadyResolvedError when the report is not PENDING', async () => {
      const report = makeReport({ status: 'DISMISSED' });
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(report),
        updateStatus: vi.fn(),
      } as unknown as ModerationRepository;
      const service = new ModerationService(repositoryMock);

      await expect(service.resolveReport(report.id, 'DISMISSED')).rejects.toBeInstanceOf(
        ReportAlreadyResolvedError,
      );
      expect(repositoryMock.updateStatus).not.toHaveBeenCalled();
    });
  });
});
