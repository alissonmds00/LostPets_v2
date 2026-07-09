import { prisma } from '../../infra/db/prisma.js';
import { NotFoundError } from '../../infra/errors/app-error.js';
import type { CreateReportInputDto, ReportDto } from './moderation.dto.js';
import type { ReportStatus } from './moderation.enum.js';

export class ModerationRepository {
  async create(data: CreateReportInputDto): Promise<ReportDto> {
    return prisma.report.create({ data });
  }

  // Fila de revisão do admin — só PENDING, sem filtro/paginação por enquanto
  // (decidido com o usuário em 2026-07-09, ver skill moderation).
  async findAllPending(): Promise<ReportDto[]> {
    return prisma.report.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  }

  async getById(id: string): Promise<ReportDto> {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundError('Denúncia');
    return report;
  }

  async updateStatus(id: string, status: ReportStatus): Promise<ReportDto> {
    return prisma.report.update({ where: { id }, data: { status } });
  }
}
