import { z } from 'zod';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from '../../infra/config/env.js';
import { getMeUsecase } from '../../usecases/get-me.usecase.js';
import { loginUsecase } from '../../usecases/login.usecase.js';
import { logoutUsecase } from '../../usecases/logout.usecase.js';
import { registerUserUsecase } from '../../usecases/register-user.usecase.js';
import {
  loginBodySchema,
  loginResponseSchema,
  meResponseSchema,
  registerUserBodySchema,
  userResponseSchema,
} from './identity.schema.js';

// Session infra (password hashing, session repository, requireAuth/requireRole
// decorators — see auth.ts) is already built. register/login/logout/me are
// all in place now, see PLAN.md phase 1.
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

  app.withTypeProvider<ZodTypeProvider>().post(
    '/logout',
    {
      // Requires a valid session (see the auth-middleware skill) — logout
      // needs `request.sessionId`, attached by requireAuth alongside
      // `request.user`, to know exactly which session row to delete.
      preHandler: (request, reply) => app.requireAuth(request, reply),
      schema: {
        summary: 'Encerra a sessão do usuário autenticado',
        description:
          'Apaga a sessão correspondente ao cookie enviado e limpa o cookie. Retorna 401 se não houver sessão válida.',
        tags: ['identity'],
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      // request.sessionId is always set here: requireAuth (preHandler above)
      // throws UnauthorizedError before the handler runs if it couldn't
      // resolve a valid session, so this route body only ever executes with
      // a session id already attached.
      await logoutUsecase(app.identityService, request.sessionId!);

      reply.clearCookie(cookieName, { path: '/' });
      reply.status(204).send(null);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      // requireAuth already throws UnauthorizedError (401) itself when the
      // cookie is missing/invalid or the session doesn't exist/is expired —
      // this route doesn't re-check that, see the auth-middleware skill.
      preHandler: app.requireAuth,
      schema: {
        summary: 'Retorna o usuário autenticado',
        description:
          'Lê a sessão a partir do cookie httpOnly assinado e retorna o usuário autenticado. Retorna 401 se não houver sessão válida.',
        tags: ['identity'],
        response: { 200: meResponseSchema },
      },
    },
    async (request, reply) => {
      // request.user is guaranteed set here: requireAuth ran as preHandler
      // and would have thrown before reaching this handler otherwise.
      const user = await getMeUsecase(request.user!);
      reply.send(user);
    },
  );
}
