import { z } from 'zod';
import { ReportStatusSchema } from './moderation.enum.js';
import { RoleSchema } from '../../shared/enums/role.enum.js';

// Body de POST /api/moderation/reports — reporterId vem da sessão
// autenticada (request.user.id), nunca do corpo, mesma convenção de
// ownerId em pets.
export const createReportBodySchema = z.object({
  listingId: z.string().uuid().describe('Id do anúncio denunciado'),
  reason: z.string().min(1).describe('Motivo da denúncia'),
});

// Input completo do service — body validado + reporterId já resolvido.
export const createReportInputSchema = createReportBodySchema.extend({
  reporterId: z.string().uuid(),
});

// Shape de uma denúncia como persistida/retornada.
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

// Input completo do usecase cross-module resolve-report — id da denúncia +
// outcome (body) + quem está resolvendo (sempre um admin, ver
// requireRole('ADMIN') na rota; precisa do id real pra reusar
// PetsService.deleteListing quando outcome for REVIEWED_REMOVED).
export const resolveReportInputSchema = resolveReportBodySchema.extend({
  reportId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: RoleSchema,
});
