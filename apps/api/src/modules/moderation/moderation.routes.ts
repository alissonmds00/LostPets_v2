import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createReportUsecase } from './create-report.usecase.js';
import { listPendingReportsUsecase } from './list-pending-reports.usecase.js';
import { resolveReportUsecase } from '../../shared/usecases/resolve-report.usecase.js';
import {
  createReportBodySchema,
  listReportsResponseSchema,
  reportSchema,
  resolveReportBodySchema,
  resolveReportParamsSchema,
} from './moderation.schema.js';

export async function moderationPlugin(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/reports',
    {
      // reporterId vem da sessão autenticada, nunca do body — mesma
      // convenção de ownerId em pets.
      preHandler: app.requireAuth,
      schema: {
        summary: 'Denuncia um anúncio',
        description:
          'Usuário autenticado denuncia um anúncio. Múltiplas denúncias do mesmo usuário pro mesmo anúncio são permitidas.',
        tags: ['moderation'],
        body: createReportBodySchema,
        response: { 201: reportSchema },
      },
    },
    async (request, reply) => {
      const report = await createReportUsecase(app.moderationService, {
        ...request.body,
        reporterId: request.user!.id,
      });
      reply.status(201).send(report);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/reports',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        summary: 'Lista a fila de revisão de denúncias',
        description: 'Só admin. Retorna só denúncias PENDING, sem filtro de status por enquanto.',
        tags: ['moderation'],
        response: { 200: listReportsResponseSchema },
      },
    },
    async (_request, reply) => {
      const data = await listPendingReportsUsecase(app.moderationService);
      reply.send({ data });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/reports/:id/resolve',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        summary: 'Resolve uma denúncia',
        description:
          'Só admin. outcome DISMISSED marca como inválida; REVIEWED_KEPT revisa e mantém o anúncio; REVIEWED_REMOVED revisa e remove o anúncio (reusa o DELETE /api/pets/:id existente). Retorna 409 se a denúncia já não estiver PENDING.',
        tags: ['moderation'],
        params: resolveReportParamsSchema,
        body: resolveReportBodySchema,
        response: { 200: reportSchema },
      },
    },
    async (request, reply) => {
      const report = await resolveReportUsecase(app.moderationService, app.petsService, {
        reportId: request.params.id,
        outcome: request.body.outcome,
        requesterId: request.user!.id,
        requesterRole: request.user!.role,
      });
      reply.send(report);
    },
  );
}
