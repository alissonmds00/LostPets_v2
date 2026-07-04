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

// POST /register request body.
export const registerUserBodySchema = z.object({
  email: z.string().email().describe('Endereço de e-mail do usuário, precisa ser único'),
  password: z.string().min(8).describe('Senha em texto plano, com no mínimo 8 caracteres'),
  name: z.string().min(1).describe('Nome completo do usuário'),
});

// Safe user shape for API responses — never includes `passwordHash`. This is
// the general-purpose "safe user" projection (register's response, and
// anywhere else a route needs to serialize a user).
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
});

// What the repository needs to create a `User` row — already-hashed
// password, never the plain-text one (hashing happens in the service, not
// here). Not a request/response body schema, but still derived via Zod per
// the dto skill (every DTO is z.infer of a schema, never hand-written).
export const createUserSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().min(1),
});

// Full user row as the repository reads it, including `passwordHash` — this
// is the internal shape used by IdentityRepository.findByEmail so the service
// can verify a login attempt's password. Never returned to a route/client as
// is; the service/usecase strip `passwordHash` before building a response.
export const userWithPasswordSchema = z.object({
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
