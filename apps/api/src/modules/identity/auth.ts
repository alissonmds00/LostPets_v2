import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../../shared/config/env.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/app-error.js';
import { IdentityRepository } from './identity.repository.js';
import type { AuthenticatedUserDto } from './identity.dto.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUserDto;
  }

  interface FastifyInstance {
    requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireRole(role: AuthenticatedUserDto['role']): (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

// Registered from app.ts (not nested inside identityModule's own
// app.register(...) call) so the decorators it adds land on the root Fastify
// instance and are visible to every module registered as a sibling — pets,
// messaging, moderation all need requireAuth/requireRole once their routes
// exist, not just identity's own routes. Wrapping with fastify-plugin (`fp`)
// reinforces that even if this ever gets nested: fp opts the plugin out of
// Fastify's default encapsulation, so its decorators still attach to the
// parent scope instead of being trapped in a child context.
//
// register/login/logout/me routes are NOT built here — this only wires the
// reusable requireAuth/requireRole hooks so those routes (built in later
// tasks) can use them.
export const authPlugin = fp(
  async (app, opts: { env: Env }) => {
    const repository = new IdentityRepository();
    const cookieName = opts.env.SESSION_COOKIE_NAME;

    app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
      const raw = request.cookies[cookieName];
      if (!raw) throw new UnauthorizedError();

      const unsigned = request.unsignCookie(raw);
      if (!unsigned.valid || !unsigned.value) throw new UnauthorizedError();

      const session = await repository.findValidById(unsigned.value);
      if (!session) throw new UnauthorizedError();

      request.user = session.user;
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
