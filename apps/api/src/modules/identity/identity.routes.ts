import type { FastifyInstance } from 'fastify';

// Session infra (password hashing, session repository, requireAuth/requireRole
// decorators — see auth.ts) is already built. Routes themselves — register,
// login, logout, me — are separate tasks built on top of this, see PLAN.md
// phase 1.
export async function identityModule(_app: FastifyInstance): Promise<void> {}
