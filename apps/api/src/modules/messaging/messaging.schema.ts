import { z } from 'zod';

export const messageSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  body: z.string(),
  createdAt: z.date(),
  readAt: z.date().nullable(),
});

// Mesmo shape usado pelo usecase cross-module `sendMessageUsecase` (ver
// shared/usecases), que já resolveu listingId/senderId/receiverId antes de
// chegar aqui — por isso não há validação extra desses campos aqui.
export const createMessageSchema = z.object({
  listingId: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  body: z.string().min(1).describe('Conteúdo da mensagem'),
});

// O primeiro contato só é aceito se um dos dois lados for o dono do anúncio
// (ver shared/usecases/send-message.usecase.ts).
export const wsConnectionParamsSchema = z.object({
  listingId: z.string().uuid(),
  receiverId: z.string().uuid(),
});

// Corpo de cada frame recebido no socket (JSON) — não é um schema de rota
// HTTP (WS não valida frame a frame via Fastify), parseado manualmente no
// handler da conexão.
export const wsIncomingMessageBodySchema = z.object({
  body: z.string().min(1),
});

export const getMessageHistoryParamsSchema = z.object({
  listingId: z.string().uuid(),
});

// Mesma convenção de paginação offset/limit (default 20, máximo 100) já
// usada em GET /api/pets.
export const getMessageHistoryQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const messageHistoryResponseSchema = z.object({
  data: z.array(messageSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  }),
});
