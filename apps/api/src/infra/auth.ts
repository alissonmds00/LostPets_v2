import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from './config/env.js';
import { ForbiddenError, UnauthorizedError } from './errors/app-error.js';
import type { AuthenticatedUserDto } from '../modules/identity/identity.dto.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUserDto;
    // request.user só carrega os dados do usuário (AuthenticatedUserDto), não
    // qual sessão autenticou — logout precisa do id da sessão em si (pra
    // deletar a linha exata via IdentityRepository.deleteById), por isso fica
    // num campo próprio em vez de dentro de `user`.
    sessionId?: string;
  }

  interface FastifyInstance {
    requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireRole(role: AuthenticatedUserDto['role']): (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

// Fica em infra/ (não em modules/identity/) mesmo dependendo de
// IdentityRepository: é middleware transversal, usado por todo módulo com
// rotas autenticadas (pets, messaging, moderation), não regra de negócio
// exclusiva de identity — não pertence ao módulo só porque consulta os dados
// dele. Ver skill auth-middleware.
//
// Registrado a partir de app.ts (não aninhado dentro do próprio
// app.register(...) de identityPlugin) pra que os decorators adicionados
// caiam na instância raiz do Fastify e fiquem visíveis pra todo módulo
// registrado como irmão. O wrapper fastify-plugin (`fp`) garante isso mesmo
// que este plugin passe a ser aninhado no futuro: `fp` tira o plugin do
// encapsulamento padrão do Fastify, então os decorators continuam anexados
// ao escopo pai em vez de ficarem presos num contexto filho.
export const authPlugin = fp(
  async (app, opts: { env: Env }) => {
    // Usa a instância única de IdentityRepository decorada na instância raiz
    // em app.ts (injeção de dependência via decorate nativo do Fastify) em
    // vez de instanciar a sua própria — ver skill dependency-injection.
    const repository = app.identityRepository;
    const cookieName = opts.env.SESSION_COOKIE_NAME;

    app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
      const raw = request.cookies[cookieName];
      if (!raw) throw new UnauthorizedError();

      const unsigned = request.unsignCookie(raw);
      if (!unsigned.valid || !unsigned.value) throw new UnauthorizedError();

      const session = await repository.findValidById(unsigned.value);
      if (!session) throw new UnauthorizedError();

      request.user = session.user;
      request.sessionId = session.id;
    });

    app.decorate('requireRole', (role: AuthenticatedUserDto['role']) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        await app.requireAuth(request, reply);
        if (request.user?.role !== role) throw new ForbiddenError();
      };
    });
  },
  { name: 'auth-plugin' },
);
