import { describe, expect, it, vi } from 'vitest';
import { listPendingReportsUsecase } from '../../../src/modules/moderation/list-pending-reports.usecase.js';
import type { ModerationService } from '../../../src/modules/moderation/moderation.service.js';
import type { ReportDto } from '../../../src/modules/moderation/moderation.dto.js';

describe('listPendingReportsUsecase', () => {
  it('delegates straight to moderationService.listPendingReports', async () => {
    const reports = [] as ReportDto[];
    const moderationService: Pick<ModerationService, 'listPendingReports'> = {
      listPendingReports: vi.fn().mockResolvedValue(reports),
    };

    const result = await listPendingReportsUsecase(moderationService as ModerationService);

    expect(result).toBe(reports);
    expect(moderationService.listPendingReports).toHaveBeenCalled();
  });
});
