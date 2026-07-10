import { z } from 'zod';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from '../../infra/config/env.js';
import { getMeUsecase } from './get-me.usecase.js';
import { loginUsecase } from './login.usecase.js';
import { logoutUsecase } from './logout.usecase.js';
import { registerUserUsecase } from './register-user.usecase.js';
import {
  loginBodySchema,
  loginResponseSchema,
  meResponseSchema,
  registerUserBodySchema,
  userResponseSchema,
} from './identity.schema.js';

export async function identityPlugin(
  app: FastifyInstance,
  opts: FastifyPluginOptions & { env: Env },
): Promise<void> {
  const cookieName = opts.env.SESSION_COOKIE_NAME;
  const isProduction = opts.env.NODE_ENV === 'production';

  app.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    {
      // Limite dedicado além do rate-limit global (registrado com
      // `global: false` em app.ts) — registro é um endpoint sensível e
      // sujeito a abuso (enumeração de e-mail, spam de cadastro), então tem
      // um orçamento mais apertado que rotas em geral.
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
      // Limite dedicado além do global em app.ts — login é alvo de tentativa
      // de adivinhação de credenciais, então tem um limite mais apertado.
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

      // Precisa bater com como requireAuth desassina esse mesmo cookie em
      // infra/auth.ts: assinado, httpOnly e escopado pro app inteiro pra
      // qualquer rota de qualquer módulo conseguir lê-lo.
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
      // Exige sessão válida (skill auth-middleware) — logout precisa de
      // `request.sessionId`, anexado por requireAuth, pra saber qual sessão
      // deletar.
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
      // request.sessionId sempre está setado aqui: requireAuth lança
      // UnauthorizedError antes do handler rodar se não resolver uma sessão
      // válida.
      await logoutUsecase(app.identityService, request.sessionId!);

      reply.clearCookie(cookieName, { path: '/' });
      reply.status(204).send(null);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/me',
    {
      // requireAuth já lança UnauthorizedError (401) quando o cookie está
      // ausente/inválido ou a sessão não existe/expirou — esta rota não
      // reverifica isso (skill auth-middleware).
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
      // request.user está garantidamente setado aqui: requireAuth rodou como
      // preHandler e teria lançado erro antes de chegar neste handler.
      const user = await getMeUsecase(request.user!);
      reply.send(user);
    },
  );
}
