import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from '../../infra/config/env.js';
import { loginUsecase } from '../../usecases/login.usecase.js';
import { loginBodySchema, loginResponseSchema } from './identity.schema.js';

// Session infra (password hashing, session repository, requireAuth/requireRole
// decorators — see auth.ts) is already built. register/logout/me are separate
// tasks built on top of this, see PLAN.md phase 1.
export async function identityModule(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { env: Env },
): Promise<void> {
  const cookieName = opts.env.SESSION_COOKIE_NAME;
  const isProduction = opts.env.NODE_ENV === 'production';

  app.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      // Dedicated rate limit on top of the global one in app.ts — login is a
      // credential-guessing target, so it gets a tighter per-route limit.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        summary: 'Autentica um usuário',
        description:
          'Valida email/senha, cria uma sessão e seta um cookie httpOnly assinado com o id da sessão. Retorna 401 para credenciais inválidas (email inexistente ou senha errada), sem indicar qual delas falhou.',
        tags: ['identity'],
        body: loginBodySchema,
        response: { 200: loginResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await loginUsecase(app.identityService, request.body);

      // Matches how requireAuth unsigns this same cookie in infra/auth.ts:
      // signed, httpOnly, and scoped to the whole app so every module's
      // routes can read it.
      reply.cookie(cookieName, result.session.id, {
        signed: true,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: isProduction,
        expires: result.session.expiresAt,
      });

      return reply.send({ user: result.user });
    },
  );
}
