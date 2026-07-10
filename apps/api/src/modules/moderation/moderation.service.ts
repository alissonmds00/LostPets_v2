import type { ModerationRepository } from './moderation.repository.js';
import { ReportAlreadyResolvedError } from './moderation.errors.js';
import type { CreateReportInputDto, ReportDto, ResolveReportOutcomeDto } from './moderation.dto.js';

export class ModerationService {
  constructor(private readonly repository: ModerationRepository) {}

  async createReport(input: CreateReportInputDto): Promise<ReportDto> {
    return this.repository.create(input);
  }

  async listPendingReports(): Promise<ReportDto[]> {
    return this.repository.findAllPending();
  }

  // Só mexe no próprio Report (status) — nunca chama PetsService/PetsRepository
  // direto (regra dura de fronteira de módulo). Remover o anúncio quando
  // outcome for REVIEWED_REMOVED é responsabilidade do usecase cross-module
  // (shared/usecases/resolve-report.usecase.ts), não deste service.
  async resolveReport(id: string, outcome: ResolveReportOutcomeDto): Promise<ReportDto> {
    const report = await this.repository.getById(id);
    if (report.status !== 'PENDING') throw new ReportAlreadyResolvedError();

    const status = outcome === 'DISMISSED' ? 'DISMISSED' : 'REVIEWED';
    return this.repository.updateStatus(id, status);
  }
}
