import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createReportUsecase } from '../../../src/modules/moderation/create-report.usecase.js';
import type { ModerationService } from '../../../src/modules/moderation/moderation.service.js';
import type {
  CreateReportInputDto,
  ReportDto,
} from '../../../src/modules/moderation/moderation.dto.js';

describe('createReportUsecase', () => {
  it('delegates straight to moderationService.createReport with the given input', async () => {
    const report = {} as ReportDto;
    const moderationService: Pick<ModerationService, 'createReport'> = {
      createReport: vi.fn().mockResolvedValue(report),
    };
    const input: CreateReportInputDto = {
      reporterId: randomUUID(),
      listingId: randomUUID(),
      reason: 'x',
    };

    const result = await createReportUsecase(moderationService as ModerationService, input);

    expect(result).toBe(report);
    expect(moderationService.createReport).toHaveBeenCalledWith(input);
  });
});
