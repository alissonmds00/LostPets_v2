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
import { identityModule } from './modules/identity/identity.module.js';
import type { IdentityRepository } from './modules/identity/identity.repository.js';
import type { IdentityService } from './modules/identity/identity.service.js';
import { petsModule } from './modules/pets/pets.module.js';
import type { PetsRepository } from './modules/pets/pets.repository.js';
import type { PetsService } from './modules/pets/pets.service.js';

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

  // Each module owns its own repository/service/gateway wiring (dependency
  // injection) *and* its own routes now — app.ts is just the orchestrator
  // that mounts Fastify, registers truly global plugins (cors/cookie/rate
  // limit/swagger/authPlugin), and registers each module's `.module.ts` (see
  // the module skill). `overrides` still exists for tests (see the testing
  // skill) — it's just forwarded to each module's registration options
  // instead of being used directly here to `new X()`.
  //
  // Registration ORDER matters here, which it didn't before this module
  // split: Fastify/avvio boots siblings registered on the same instance in
  // series, each fully resolved before the next starts.
  //   1. identityModule first: it decorates identityRepository (bubbled to
  //      root via fp — see identity.module.ts) before anything else runs.
  //   2. authPlugin next: its setup function reads app.identityRepository
  //      exactly once, synchronously, when IT runs (not per-request) — see
  //      infra/auth.ts — so identityRepository must already exist by then.
  //      authPlugin itself is fp-wrapped so requireAuth/requireRole bubble
  //      to root too, visible to every module registered afterward.
  //   3. petsModule last: its routes reference app.requireAuth as a
  //      preHandler, which needs authPlugin to already have decorated it.
  // (identityModule's own /me route cannot rely on requireAuth existing yet
  // when ITS routes are registered — step 1 runs before step 2 — so it
  // reads app.requireAuth lazily inside a closure instead of eagerly; see
  // identity.routes.ts.)
  // `overrides` is forwarded as-is (not rebuilt field-by-field) — each
  // module's own options type only declares the fields it cares about, and
  // passing the same object through a variable (rather than a fresh object
  // literal) is structurally fine even though it also carries the other
  // module's fields. The `overrides ? { ...} : { ... }` split (rather than
  // always including `overrides`) is needed because `overrides` itself is
  // `X | undefined` here (buildApp's param is optional) — under
  // `exactOptionalPropertyTypes`, an optional property must be *absent*
  // when there's no value, not present-with-`undefined`.
  app.register(identityModule, overrides ? { env, overrides } : { env });

  // Registered at root (not nested inside identityModule's own
  // app.register(...) above) so requireAuth/requireRole are visible to every
  // module registered as a sibling here — pets/messaging/moderation routes
  // need them too, not just identity's own routes. See infra/auth.ts for the
  // Fastify-encapsulation reasoning and why this lives in infra/ rather than
  // modules/identity despite depending on IdentityRepository.
  app.register(authPlugin, { env });

  app.register(petsModule, overrides ? { env, overrides } : { env });
  // messaging and moderation modules are registered here as they're built —
  // see PLAN.md for build order and scope.

  return app;
}
