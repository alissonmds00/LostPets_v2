import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Env } from './infra/config/env.js';
import { formatErrorResponse } from './infra/exception-handler.js';
import { authPlugin } from './infra/auth.js';
import { identityModule } from './modules/identity/identity.routes.js';
import { IdentityRepository } from './modules/identity/identity.repository.js';
import { IdentityService } from './modules/identity/identity.service.js';
import { petsModule } from './modules/pets/pets.routes.js';
import { PetsRepository } from './modules/pets/pets.repository.js';
import { PetsService } from './modules/pets/pets.service.js';
import { createStorageGateway } from './gateways/storage.gateway.service.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';

// Module augmentation for the decorators added below — same technique used
// in infra/auth.ts for requireAuth/requireRole.
declare module 'fastify' {
  interface FastifyInstance {
    identityRepository: IdentityRepository;
    identityService: IdentityService;
    petsRepository: PetsRepository;
    petsService: PetsService;
  }
}

// Access log for every request (method/url/status/duration/request-id), on top
// of Fastify's built-in "incoming request"/"request completed" hooks. Explicit
// serializers pin this down to just those fields — Fastify's default req
// serializer already excludes headers, but this makes it explicit so no one
// later adds `headers` back and leaks the session cookie into the logs.
const requestLogSerializers = {
  req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
  res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
};

// Test-only escape hatch (see the testing skill's 2026-07-04 revision):
// production always calls buildApp(env) with no overrides, so the branches
// below fall through to instantiating the real repository/service. Tests
// pass a mocked service and/or repository instead, so app.inject() exercises
// the HTTP contract (validation, status codes, cookies) without touching
// Postgres. Add a field here per module as more services/repositories exist
// that a test needs to substitute — today only identity has both.
export function buildApp(
  env: Env,
  overrides?: {
    identityService?: IdentityService;
    identityRepository?: IdentityRepository;
    petsService?: PetsService;
    petsRepository?: PetsRepository;
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

  // Swagger UI exposes the full API shape (routes, schemas) and is only useful
  // for exercising endpoints during development, so it's kept out of production.
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

  // Dependency injection via Fastify's native decorate mechanism (chosen over
  // @fastify/awilix to avoid introducing a new container/cradle concept when
  // decorate already solves the coupling problem — see the
  // dependency-injection skill). Instantiated exactly once here and decorated
  // onto the root instance, *before* registering any plugin/module that needs
  // them: decorators added directly on the root instance (not inside a nested
  // .register() call) are automatically inherited by every child context
  // registered afterward, no fastify-plugin wrapping needed for this
  // direction (unlike authPlugin below, whose decorators need to bubble *up*
  // to the parent instead of down to children).
  // requireAuth/requireRole (authPlugin below) always read
  // app.identityRepository directly — even when a test overrides
  // identityService only, the real repository is still built here so
  // requireAuth keeps working for any route it guards in that test.
  const identityRepository = overrides?.identityRepository ?? new IdentityRepository();
  app.decorate('identityRepository', identityRepository);
  app.decorate(
    'identityService',
    overrides?.identityService ?? new IdentityService(identityRepository, env.SESSION_TTL_DAYS),
  );

  // Same pattern as identity above: instantiated once here (storage/queue
  // gateways included — only the service calls a gateway, see the gateway
  // skill) and decorated onto the root instance before any module that
  // depends on them is registered. Unlike identity's requireAuth (which
  // always needs the real identityRepository even when identityService is
  // mocked), nothing else in the app depends on the real petsRepository when
  // petsService is overridden in a test, so this is simpler: each override
  // only affects its own decorator.
  const petsRepository = overrides?.petsRepository ?? new PetsRepository();
  app.decorate('petsRepository', petsRepository);
  app.decorate(
    'petsService',
    overrides?.petsService ??
      new PetsService(petsRepository, createStorageGateway(env), new PetsRegistrationQueueGatewayService(env)),
  );

  // Registered at root (not nested inside identityModule's own
  // app.register(...) below) so requireAuth/requireRole are visible to every
  // module registered as a sibling here — pets/messaging/moderation routes
  // need them too, not just identity's own routes. See infra/auth.ts for the
  // Fastify-encapsulation reasoning and why this lives in infra/ rather than
  // modules/identity despite depending on IdentityRepository.
  app.register(authPlugin, { env });

  // Each module owns its own routes/service/repository and only reaches into
  // its own Prisma models. Cross-module calls go through another module's
  // exported service, never straight into its tables.
  app.register(identityModule, { prefix: '/api/identity', env });
  app.register(petsModule, { prefix: '/api/pets' });
  // messaging and moderation modules are registered here as they're built —
  // see PLAN.md for build order and scope.

  return app;
}
