import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from './config/env.js';
import { ForbiddenError, UnauthorizedError } from './errors/app-error.js';
import type { AuthenticatedUserDto } from '../modules/identity/identity.dto.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUserDto;
    // Id of the session validated by requireAuth. request.user only carries
    // the authenticated user's own data (see AuthenticatedUserDto), not which
    // session authenticated it — logout needs the session id itself (to
    // delete that exact row via IdentityRepository.deleteById), so it's
    // attached here as its own field rather than folded into `user`.
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

// Lives in infra/ (not modules/identity/), even though it depends on
// IdentityRepository for its session lookup: this is cross-cutting request
// middleware, needed by every domain module that has authenticated routes
// (pets, messaging, moderation), not identity-exclusive business logic. It's
// not owned by the module whose data it happens to query — see the
// auth-middleware skill for the full reasoning.
//
// Registered from app.ts (not nested inside identityModule's own
// app.register(...) call) so the decorators it adds land on the root Fastify
// instance and are visible to every module registered as a sibling. Wrapping
// with fastify-plugin (`fp`) reinforces that even if this ever gets nested:
// fp opts the plugin out of Fastify's default encapsulation, so its
// decorators still attach to the parent scope instead of being trapped in a
// child context.
//
// register/login/logout/me routes are NOT built here — this only wires the
// reusable requireAuth/requireRole hooks so those routes (built in later
// tasks) can use them.
export const authPlugin = fp(
  async (app, opts: { env: Env }) => {
    // Uses the single IdentityRepository instance decorated onto the root
    // instance in app.ts (dependency injection via Fastify's native decorate
    // mechanism) instead of instantiating its own — see the
    // dependency-injection skill.
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
