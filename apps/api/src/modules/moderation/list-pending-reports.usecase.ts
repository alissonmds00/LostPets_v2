import type { ModerationService } from './moderation.service.js';
import type { ReportDto } from './moderation.dto.js';

export async function listPendingReportsUsecase(
  moderationService: ModerationService,
): Promise<ReportDto[]> {
  return moderationService.listPendingReports();
}
