import type { ModerationService } from './moderation.service.js';
import type { CreateReportInputDto, ReportDto } from './moderation.dto.js';

export async function createReportUsecase(
  moderationService: ModerationService,
  input: CreateReportInputDto,
): Promise<ReportDto> {
  return moderationService.createReport(input);
}
