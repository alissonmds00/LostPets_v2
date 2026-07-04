import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
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

// Module augmentation for the decorators added below — same technique used
// in infra/auth.ts for requireAuth/requireRole.
declare module 'fastify' {
  interface FastifyInstance {
    identityRepository: IdentityRepository;
    // identityService will be decorated here the same way once
    // identity.service.ts exists (register/login are still separate, open
    // PRs at the time this was written).
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

export function buildApp(env: Env) {
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
  const identityRepository = new IdentityRepository();
  app.decorate('identityRepository', identityRepository);
  // identityService will be instantiated (with identityRepository injected
  // into its constructor) and decorated here the same way once
  // identity.service.ts exists.

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
  // pets, messaging and moderation modules are registered here as they're
  // built — see PLAN.md for build order and scope.

  return app;
}
