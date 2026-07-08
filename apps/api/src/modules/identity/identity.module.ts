import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Env } from '../../infra/config/env.js';
import { identityRoutes } from './identity.routes.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

// Module augmentation for the decorators created below — kept next to where
// they're actually decorated, per the module skill (step 6): app.ts no
// longer instantiates anything identity-specific, so this is the natural
// home for the type declaration too.
declare module 'fastify' {
  interface FastifyInstance {
    identityRepository: IdentityRepository;
    identityService: IdentityService;
  }
}

// Test-only escape hatch (see the testing skill): production always calls
// buildApp(env) with no overrides, so these fall through to instantiating
// the real repository/service. Tests pass a mocked service and/or
// repository instead. Moved here from app.ts (see the module skill,
// 2026-07-05 revision) — buildApp just forwards whatever it received to
// this module's registration options.
type IdentityModuleOptions = FastifyPluginOptions & {
  env: Env;
  overrides?: {
    identityService?: IdentityService;
    identityRepository?: IdentityRepository;
  };
};

// Owns identity's repository/service wiring (dependency-injection skill) and
// its own routes (identityRoutes, identity.routes.ts) — the module skill's
// "<módulo>.module.ts" convention.
//
// Wrapped with fastify-plugin (fp): infra/auth.ts's requireAuth/requireRole
// are registered as a SIBLING of this module (from app.ts, not nested inside
// it) and read app.identityRepository directly. Without fp, decorating
// identityRepository here would only be visible to this module's own
// subtree (Fastify's default plugin encapsulation creates a new child
// context per register() call) — invisible to authPlugin's sibling context.
// fp skips that new-context creation, so app.decorate(...) below applies
// directly to the parent (root) instance instead, which authPlugin (and any
// other sibling registered afterwards) inherits normally. See the module
// skill for the full reasoning, and dependency-injection for why the
// instantiation itself lives here now.
//
// The nested app.register(identityRoutes, { prefix, env }) below still gets
// its own encapsulated child context as usual (identityRoutes isn't
// fp-wrapped) — fp only affects the identityModule plugin function itself,
// not further nested registrations inside it. That child inherits
// identityRepository/identityService/requireAuth from the root via the
// normal (downward) prototype chain, same as any other child context.
export const identityModule = fp(
  async (app: FastifyInstance, opts: IdentityModuleOptions): Promise<void> => {
    const identityRepository = opts.overrides?.identityRepository ?? new IdentityRepository();
    app.decorate('identityRepository', identityRepository);
    app.decorate(
      'identityService',
      opts.overrides?.identityService ??
        new IdentityService(identityRepository, opts.env.SESSION_TTL_DAYS),
    );

    await app.register(identityRoutes, { prefix: '/api/identity', env: opts.env });
  },
  { name: 'identity-module' },
);
