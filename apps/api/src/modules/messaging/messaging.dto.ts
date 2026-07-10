import type { z } from 'zod';
import type {
  createMessageSchema,
  getMessageHistoryParamsSchema,
  getMessageHistoryQuerySchema,
  messageHistoryResponseSchema,
  messageSchema,
  wsConnectionParamsSchema,
  wsIncomingMessageBodySchema,
} from './messaging.schema.js';

// Shape de uma mensagem persistida/retornada.
export type MessageDto = z.infer<typeof messageSchema>;

// Input completo pra criar uma mensagem — mesmo shape usado pelo usecase
// cross-module `sendMessageUsecase` (shared/usecases).
export type CreateMessageDto = z.infer<typeof createMessageSchema>;

// Params da rota WS: listingId + receiverId (quem o remetente quer contatar).
export type WsConnectionParamsDto = z.infer<typeof wsConnectionParamsSchema>;

// Corpo de cada frame recebido no socket.
export type WsIncomingMessageBodyDto = z.infer<typeof wsIncomingMessageBodySchema>;

// Params/query de GET /api/messaging/:listingId.
export type GetMessageHistoryParamsDto = z.infer<typeof getMessageHistoryParamsSchema>;
export type GetMessageHistoryQueryDto = z.infer<typeof getMessageHistoryQuerySchema>;

// Resposta paginada do histórico.
export type MessageHistoryDto = z.infer<typeof messageHistoryResponseSchema>;
