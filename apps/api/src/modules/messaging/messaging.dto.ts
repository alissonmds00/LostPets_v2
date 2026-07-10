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

export type MessageDto = z.infer<typeof messageSchema>;
export type CreateMessageDto = z.infer<typeof createMessageSchema>;
export type WsConnectionParamsDto = z.infer<typeof wsConnectionParamsSchema>;
export type WsIncomingMessageBodyDto = z.infer<typeof wsIncomingMessageBodySchema>;
export type GetMessageHistoryParamsDto = z.infer<typeof getMessageHistoryParamsSchema>;
export type GetMessageHistoryQueryDto = z.infer<typeof getMessageHistoryQuerySchema>;
export type MessageHistoryDto = z.infer<typeof messageHistoryResponseSchema>;
