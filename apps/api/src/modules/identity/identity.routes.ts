import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from '../../infra/config/env.js';
import { loginUsecase } from '../../usecases/login.usecase.js';
import { registerUserUsecase } from '../../usecases/register-user.usecase.js';
import {
  loginBodySchema,
  loginResponseSchema,
  registerUserBodySchema,
  userResponseSchema,
} from './identity.schema.js';

// Session infra (password hashing, session repository, requireAuth/requireRole
// decorators — see auth.ts) is already built. logout/me are separate tasks
// built on top of this, see PLAN.md phase 1.
export async function identityModule(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { env: Env },
): Promise<void> {
  const cookieName = opts.env.SESSION_COOKIE_NAME;
  const isProduction = opts.env.NODE_ENV === 'production';

  app.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    {
      // Dedicated per-route limit on top of the global rate-limit plugin
      // (registered with `global: false` in app.ts) — registration is a
      // sensitive, abuse-prone endpoint (account/email enumeration, spam
      // signups), so it gets a tighter budget than routes in general.
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
      schema: {
        summary: 'Registra um novo usuário',
        description:
          'Valida o corpo da requisição, garante que o e-mail ainda não está em uso, faz hash da senha e cria o usuário. Retorna 409 se o e-mail já estiver cadastrado.',
        tags: ['identity'],
        body: registerUserBodySchema,
        response: { 201: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await registerUserUsecase(app.identityService, request.body);
      reply.status(201).send(user);
    },
  );

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
