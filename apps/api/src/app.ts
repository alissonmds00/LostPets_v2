import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './infra/config/env.js';
import { formatErrorResponse } from './infra/exception-handler.js';
import { authPlugin } from './infra/auth.js';
import { prisma } from './infra/db/prisma.js';
import { identityPlugin } from './modules/identity/identity.routes.js';
import { IdentityRepository } from './modules/identity/identity.repository.js';
import { IdentityService } from './modules/identity/identity.service.js';
import { petsPlugin } from './modules/pets/pets.routes.js';
import { PetsRepository } from './modules/pets/pets.repository.js';
import { PetsService } from './modules/pets/pets.service.js';
import { moderationPlugin } from './modules/moderation/moderation.routes.js';
import { ModerationRepository } from './modules/moderation/moderation.repository.js';
import { ModerationService } from './modules/moderation/moderation.service.js';
import { messagingPlugin } from './modules/messaging/messaging.routes.js';
import { MessagingRepository } from './modules/messaging/messaging.repository.js';
import { MessagingService } from './modules/messaging/messaging.service.js';
import { messagingConnectionRegistry } from './modules/messaging/messaging-connection.registry.js';
import { createStorageGateway } from './gateways/storage.gateway.service.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    identityRepository: IdentityRepository;
    identityService: IdentityService;
    petsRepository: PetsRepository;
    petsService: PetsService;
    moderationRepository: ModerationRepository;
    moderationService: ModerationService;
    messagingRepository: MessagingRepository;
    messagingService: MessagingService;
  }
}

// Serializers explícitos pra esses campos: o padrão do Fastify já exclui
// headers, mas isso evita que alguém adicione 'headers' de volta e vaze o
// cookie de sessão no log.
const requestLogSerializers = {
  req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
  res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
};

// Escape hatch só pra teste (ver skill testing, revisão 2026-07-04): produção
// sempre chama buildApp(env) sem overrides, então os branches abaixo caem na
// instanciação do repository/service real. Testes passam um service e/ou
// repository mockado, pra que app.inject() exercite o contrato HTTP
// (validação, status codes, cookies) sem tocar no Postgres. Adicione um campo
// aqui por módulo conforme mais services/repositories precisem ser
// substituíveis em teste — hoje só identity tem os dois.
export function buildApp(
  env: Env,
  overrides?: {
    identityService?: IdentityService;
    identityRepository?: IdentityRepository;
    petsService?: PetsService;
    petsRepository?: PetsRepository;
    moderationService?: ModerationService;
    moderationRepository?: ModerationRepository;
    messagingService?: MessagingService;
    messagingRepository?: MessagingRepository;
  },
) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? { level: 'silent' as const }
        : env.NODE_ENV === 'development'
          ? {
              level: 'info' as const,
              transport: { target: 'pino-pretty' },
              serializers: requestLogSerializers,
            }
          : { level: 'info' as const, serializers: requestLogSerializers },
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = formatErrorResponse(error);
    if (statusCode >= 500) request.log.error(error);
    reply.status(statusCode).send(body);
  });

  app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  app.register(cookie, { secret: env.SESSION_COOKIE_SECRET });
  app.register(rateLimit, { global: false });
  // Necessário pra POST /api/pets aceitar upload de foto via multipart/form-data.
  app.register(multipart);
  // Necessário pra rota WS de messaging (@fastify/websocket decora
  // app.injectWS pra teste e habilita `{ websocket: true }` em rotas).
  app.register(websocket);

  // Só é útil pra exercitar endpoints durante desenvolvimento, então fica
  // fora de produção.
  if (env.NODE_ENV !== 'production') {
    app.register(swagger, {
      openapi: {
        info: { title: 'Lost Pets API', version: '1.0.0' },
      },
      transform: jsonSchemaTransform,
    });
    app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.get('/health', async () => ({ status: 'ok' }));

  // Prisma é decorado primeiro, mesmo mecanismo de DI dos demais
  // services/repositories abaixo (skill dependency-injection) — antes era a
  // única exceção, importado como singleton solto direto em cada repository
  // em vez de passar por app.decorate. O singleton em si continua em
  // infra/db/prisma.ts sem mudança; só o ciclo de vida agora está atrelado a
  // esta instância Fastify: decorado aqui, injetado no construtor de cada
  // repository abaixo, e desconectado via hook onClose no shutdown (ver
  // server.ts pro que dispara isso de fato).
  app.decorate('prisma', prisma);
  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });

  // DI via decorate nativo do Fastify (escolhido em vez de @fastify/awilix
  // pra não introduzir um conceito novo de container/cradle quando decorate
  // já resolve o acoplamento — skill dependency-injection). Instanciado uma
  // única vez aqui e decorado na instância raiz *antes* de registrar
  // qualquer plugin/módulo que precise deles: decorators adicionados
  // direto na raiz (fora de um .register() aninhado) são herdados
  // automaticamente por todo contexto filho registrado depois, sem precisar
  // de fastify-plugin nessa direção (diferente do authPlugin abaixo, cujos
  // decorators precisam subir *pro* pai em vez de descer pros filhos).
  // requireAuth/requireRole (authPlugin abaixo) sempre leem
  // app.identityRepository direto — mesmo quando um teste sobrescreve só
  // identityService, o repository real continua sendo construído aqui pra
  // requireAuth continuar funcionando em qualquer rota que ele proteja nesse
  // teste.
  const identityRepository = overrides?.identityRepository ?? new IdentityRepository(prisma);
  app.decorate('identityRepository', identityRepository);
  app.decorate(
    'identityService',
    overrides?.identityService ?? new IdentityService(identityRepository, env.SESSION_TTL_DAYS),
  );

  // Mesmo padrão de identity acima (gateways de storage/queue inclusos — só o
  // service chama um gateway, ver skill gateway). Diferente do requireAuth de
  // identity (que sempre precisa do identityRepository real mesmo com
  // identityService mockado), nada mais no app depende do petsRepository real
  // quando petsService é sobrescrito em teste, então aqui é mais simples: cada
  // override afeta só o próprio decorator.
  const petsRepository = overrides?.petsRepository ?? new PetsRepository(prisma);
  app.decorate('petsRepository', petsRepository);
  app.decorate(
    'petsService',
    overrides?.petsService ??
      new PetsService(
        petsRepository,
        createStorageGateway(env),
        new PetsRegistrationQueueGatewayService(env),
      ),
  );

  // Mesmo padrão acima.
  const moderationRepository = overrides?.moderationRepository ?? new ModerationRepository();
  app.decorate('moderationRepository', moderationRepository);
  app.decorate(
    'moderationService',
    overrides?.moderationService ?? new ModerationService(moderationRepository),
  );

  // Mesmo padrão acima. `messagingConnectionRegistry` é o singleton
  // module-local (não decorado em `app`, ver messaging-connection.registry.ts)
  // injetado no construtor do service real — não passa pelas overrides de
  // teste porque é um Map em memória, não uma infra externa a mockar.
  const messagingRepository = overrides?.messagingRepository ?? new MessagingRepository();
  app.decorate('messagingRepository', messagingRepository);
  app.decorate(
    'messagingService',
    overrides?.messagingService ??
      new MessagingService(messagingRepository, messagingConnectionRegistry),
  );

  // Registrado na raiz (não aninhado dentro do próprio app.register(...) de
  // identityPlugin abaixo) pra requireAuth/requireRole ficarem visíveis pra
  // todo módulo registrado como irmão aqui — pets/messaging/moderation também
  // precisam deles, não só as rotas de identity. Ver infra/auth.ts pro
  // raciocínio de encapsulamento do Fastify.
  app.register(authPlugin, { env });

  // Cada módulo é dono das próprias rotas/service/repository e só acessa os
  // próprios models do Prisma. Chamada entre módulos passa pelo service
  // exportado do outro módulo, nunca direto nas tabelas dele.
  app.register(identityPlugin, { prefix: '/api/identity', env });
  app.register(petsPlugin, { prefix: '/api/pets' });
  app.register(moderationPlugin, { prefix: '/api/moderation' });
  app.register(messagingPlugin, { prefix: '/api/messaging' });

  return app;
}
