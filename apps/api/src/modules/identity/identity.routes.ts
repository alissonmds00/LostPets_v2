import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerUserBodySchema, userResponseSchema } from './identity.schema.js';
import { RegisterUserUsecase } from '../../usecases/register-user.usecase.js';

// Session infra (password hashing, session repository, requireAuth/requireRole
// decorators — see auth.ts) is already built. login/logout/me are separate
// tasks built on top of this, see PLAN.md phase 1.
export async function identityModule(app: FastifyInstance): Promise<void> {
  const registerUserUsecase = new RegisterUserUsecase();

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
      const user = await registerUserUsecase.execute(request.body);
      reply.status(201).send(user);
    },
  );
}
