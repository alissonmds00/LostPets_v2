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

// Safe user shape for API responses — never includes `passwordHash`.
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
});
