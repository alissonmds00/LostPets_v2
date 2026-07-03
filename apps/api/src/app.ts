import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Env } from './shared/config/env.js';
import { formatErrorResponse } from './shared/errors/error-handler.js';
import { identityModule } from './modules/identity/index.js';

export function buildApp(env: Env) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? { level: 'silent' as const }
        : env.NODE_ENV === 'development'
          ? { level: 'info' as const, transport: { target: 'pino-pretty' } }
          : { level: 'info' as const },
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

  app.get('/health', async () => ({ status: 'ok' }));

  // Each module owns its own routes/service/repository and only reaches into
  // its own Prisma models. Cross-module calls go through another module's
  // exported service, never straight into its tables.
  app.register(identityModule, { prefix: '/api/identity' });
  // pets, messaging and moderation modules are registered here as they're
  // built — see PLAN.md for build order and scope.

  return app;
}
