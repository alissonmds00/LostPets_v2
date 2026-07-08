import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { petsRoutes } from './pets.routes.js';
import { PetsRepository } from './pets.repository.js';
import { PetsService } from './pets.service.js';
import { createStorageGateway } from '../../gateways/storage.gateway.service.js';
import { PetsRegistrationQueueGatewayService } from '../../gateways/pets-registration-queue.gateway.service.js';
import type { Env } from '../../infra/config/env.js';

// Module augmentation for the decorators created below — kept next to where
// they're actually decorated, per the module skill (step 6).
declare module 'fastify' {
  interface FastifyInstance {
    petsRepository: PetsRepository;
    petsService: PetsService;
  }
}

// Test-only escape hatch (see the testing skill) — same shape as identity's.
type PetsModuleOptions = FastifyPluginOptions & {
  env: Env;
  overrides?: {
    petsService?: PetsService;
    petsRepository?: PetsRepository;
  };
};

// Owns pets' repository/service/gateways wiring (dependency-injection skill)
// and its own routes (petsRoutes, pets.routes.ts) — the module skill's
// "<módulo>.module.ts" convention.
//
// WRAPPED with fastify-plugin (fp) — deviates from what was originally
// speced for this module ("nada fora de pets depende de petsRepository/
// petsService hoje"). That was true for sibling *plugins*, but missed
// server.ts: it holds the ROOT app instance returned by buildApp and reads
// app.petsService directly (after app.listen()) to start the pets
// registration poller. That read is not inside any register() callback, so
// it needs petsService on the ROOT instance, exactly like authPlugin needs
// app.identityRepository on the root to read it as a sibling. Verified
// empirically: without fp here, app.petsService was undefined on the
// instance returned by buildApp (only present on this module's own child
// context), which would have silently broken the poller at startup — not
// caught by the route-level test suite, which only exercises requests
// through this module's own subtree. See the module skill's fp guidance;
// this is the same "decorator needs to be visible outside this module's
// own encapsulation boundary" case, just triggered by a root-level script
// read instead of a sibling plugin. Flagging this as a gap in the module
// skill's current wording (it only names the sibling-plugin case) rather
// than updating the skill unilaterally.
export const petsModule = fp(
  async (app: FastifyInstance, opts: PetsModuleOptions): Promise<void> => {
    const petsRepository = opts.overrides?.petsRepository ?? new PetsRepository();
    app.decorate('petsRepository', petsRepository);
    app.decorate(
      'petsService',
      opts.overrides?.petsService ??
        new PetsService(
          petsRepository,
          createStorageGateway(opts.env),
          new PetsRegistrationQueueGatewayService(opts.env),
        ),
    );

    await app.register(petsRoutes, { prefix: '/api/pets' });
  },
  { name: 'pets-module' },
);
