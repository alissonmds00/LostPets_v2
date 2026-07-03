import type { FastifyInstance } from 'fastify';

// Scaffolding only — see PLAN.md, phase 1 (identity), for what belongs here:
// register/login/logout routes, session cookie issuance, password hashing,
// current-user route, role checks.
export async function identityModule(app: FastifyInstance): Promise<void> {
  app.get('/ping', async () => ({ module: 'identity', status: 'not implemented yet' }));
}
