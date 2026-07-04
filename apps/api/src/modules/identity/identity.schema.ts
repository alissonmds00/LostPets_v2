import { z } from 'zod';

// Shape of a session row as the repository returns it, joined with its owning
// user (needed by requireAuth to attach `request.user`). No request body schema
// here yet — register/login/logout/me routes (and their body schemas) are
// built in later tasks on top of this session infra.
export const sessionWithUserSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  expiresAt: z.date(),
  createdAt: z.date(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['USER', 'ADMIN']),
  }),
});

// Full user row as the repository reads it, including `passwordHash` — this
// is the internal shape used by IdentityRepository.findByEmail so the service
// can verify a login attempt's password. Never returned to a route/client as
// is; the service/usecase strip `passwordHash` before building a response.
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
});

// Request body for POST /api/identity/login.
export const loginBodySchema = z.object({
  email: z.string().email().describe("User's email address"),
  password: z.string().min(1).describe("User's plaintext password"),
});

// Response body for a successful login — the safe user projection (no
// `passwordHash`), same shape as what requireAuth attaches to `request.user`.
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['USER', 'ADMIN']),
  }),
});

// Internal result of IdentityService.login — not a wire schema itself (no
// route serializes this exact shape directly), composed from the session and
// safe-user shapes above. The usecase reads `session` to set the cookie and
// `user` to build the login response. Every DTO derives from a Zod schema
// (see the `dto` skill), even internal/non-wire shapes like this one.
export const loginResultSchema = z.object({
  session: sessionWithUserSchema.pick({ id: true, userId: true, expiresAt: true, createdAt: true }),
  user: sessionWithUserSchema.shape.user,
});
