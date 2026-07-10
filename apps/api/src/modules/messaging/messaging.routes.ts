import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { messagingConnectionRegistry } from './messaging-connection.registry.js';
import { sendMessageUsecase } from '../../shared/usecases/send-message.usecase.js';
import { getMessageHistoryUsecase } from './get-message-history.usecase.js';
import {
  getMessageHistoryParamsSchema,
  getMessageHistoryQuerySchema,
  messageHistoryResponseSchema,
  wsConnectionParamsSchema,
  wsIncomingMessageBodySchema,
} from './messaging.schema.js';

export async function messagingPlugin(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.get(
    '/ws/:listingId/:receiverId',
    {
      // Mesmo requireAuth de qualquer rota autenticada — roda como
      // preHandler *antes* do upgrade pro protocolo WS (hooks normais do
      // Fastify, ver skill messaging), então uma sessão inválida nunca chega
      // a abrir o socket, só recebe 401 na resposta HTTP do upgrade.
      preHandler: app.requireAuth,
      websocket: true,
      schema: {
        summary: 'Conecta ao chat de um anúncio via WebSocket',
        description:
          'receiverId é quem o remetente (sessão autenticada) quer contatar sobre o anúncio. A primeira mensagem só é aceita se um dos dois lados for o dono do anúncio — ver shared/usecases/send-message.usecase.ts.',
        tags: ['messaging'],
        params: wsConnectionParamsSchema,
      },
    },
    (socket, request) => {
      const { listingId, receiverId } = request.params as { listingId: string; receiverId: string };
      const senderId = request.user!.id;

      messagingConnectionRegistry.register(senderId, socket);

      socket.on('message', (raw: Buffer) => {
        void (async () => {
          try {
            const parsed = wsIncomingMessageBodySchema.parse(JSON.parse(raw.toString()));
            await sendMessageUsecase(app.petsService, app.messagingService, {
              listingId,
              senderId,
              receiverId,
              body: parsed.body,
            });
          } catch (err) {
            request.log.warn({ err }, 'failed to process incoming messaging ws frame');
          }
        })();
      });

      socket.on('close', () => {
        messagingConnectionRegistry.unregister(senderId, socket);
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:listingId',
    {
      preHandler: app.requireAuth,
      schema: {
        summary: 'Histórico de mensagens de um anúncio',
        description:
          'Paginado (offset/limit, default 20, máximo 100). Retorna só mensagens em que o requisitante é remetente ou destinatário — nunca todas as mensagens do anúncio.',
        tags: ['messaging'],
        params: getMessageHistoryParamsSchema,
        querystring: getMessageHistoryQuerySchema,
        response: { 200: messageHistoryResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await getMessageHistoryUsecase(
        app.messagingService,
        request.params.listingId,
        request.user!.id,
        request.query,
      );
      reply.send(result);
    },
  );
}
