import { z } from 'zod';
import { ReportStatusSchema } from './moderation.enum.js';
import { RoleSchema } from '../../shared/enums/role.enum.js';

// reporterId vem da sessão autenticada, nunca do corpo — mesma convenção de
// ownerId em pets.
export const createReportBodySchema = z.object({
  listingId: z.string().uuid().describe('Id do anúncio denunciado'),
  reason: z.string().min(1).describe('Motivo da denúncia'),
});

export const createReportInputSchema = createReportBodySchema.extend({
  reporterId: z.string().uuid(),
});

export const reportSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  listingId: z.string().uuid(),
  reason: z.string(),
  status: ReportStatusSchema,
  createdAt: z.date(),
});

export const listReportsResponseSchema = z.object({
  data: z.array(reportSchema),
});

export const resolveReportParamsSchema = z.object({
  id: z.string().uuid(),
});

// Três desfechos possíveis pra uma denúncia PENDING — não dois campos
// separados (status + remove): um único campo evita combinação inválida tipo
// "DISMISSED" + remover o anúncio. REVIEWED_KEPT/REVIEWED_REMOVED colapsam
// pro mesmo `Report.status` (REVIEWED) — a diferença é só se o anúncio
// também é removido, ver shared/usecases/resolve-report.usecase.ts.
export const resolveReportOutcomeSchema = z.enum([
  'DISMISSED',
  'REVIEWED_KEPT',
  'REVIEWED_REMOVED',
]);

export const resolveReportBodySchema = z.object({
  outcome: resolveReportOutcomeSchema.describe(
    'DISMISSED: denúncia considerada inválida. REVIEWED_KEPT: denúncia revisada, anúncio mantido. REVIEWED_REMOVED: denúncia revisada, anúncio removido.',
  ),
});

// Precisa do id real da denúncia pra reusar PetsService.deleteListing quando
// outcome for REVIEWED_REMOVED (ver shared/usecases/resolve-report.usecase.ts).
export const resolveReportInputSchema = resolveReportBodySchema.extend({
  reportId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: RoleSchema,
});
