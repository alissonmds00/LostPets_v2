import { z } from 'zod';

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

export const registerUserBodySchema = z.object({
  email: z.string().email().describe('Endereço de e-mail do usuário, precisa ser único'),
  password: z.string().min(8).describe('Senha em texto plano, com no mínimo 8 caracteres'),
  name: z.string().min(1).describe('Nome completo do usuário'),
});

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
});

// Não é schema de request/response, mas ainda deriva de Zod (skill `dto`:
// todo DTO é z.infer de um schema, nunca escrito à mão). Espera a senha já
// hasheada — hashing acontece no service, não aqui.
export const createUserSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().min(1),
});

// Shape interno usado por IdentityRepository.findByEmail pra verificar a
// senha de um login. Nunca é retornado como está pra uma rota/cliente — o
// service/usecase removem `passwordHash` antes de montar a resposta.
export const userWithPasswordSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string(),
  role: z.enum(['USER', 'ADMIN']),
});

export const loginBodySchema = z.object({
  email: z.string().email().describe("User's email address"),
  password: z.string().min(1).describe("User's plaintext password"),
});

// Mesmo shape que requireAuth anexa em `request.user`.
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['USER', 'ADMIN']),
  }),
});

// Não é um schema de wire em si — composto pelos shapes de sessão e de
// usuário seguro acima. Ainda deriva de Zod (skill `dto`), mesmo sendo um
// shape interno.
export const loginResultSchema = z.object({
  session: sessionWithUserSchema.pick({ id: true, userId: true, expiresAt: true, createdAt: true }),
  user: sessionWithUserSchema.shape.user,
});

// Reaproveita deliberadamente o shape `{ id, email, name, role }` de
// `sessionWithUserSchema.shape.user` (== AuthenticatedUserDto, o que
// requireAuth anexa a `request.user`), em vez de `userResponseSchema` (que
// tem `createdAt` a mais): requireAuth nunca busca `createdAt`, e `/me` só
// precisa ecoar o usuário já autenticado, sem reconsultar o repository por um
// campo que ninguém pediu. Se algum dia precisar de `createdAt` aqui também,
// isso é uma mudança de schema deliberada (com uma consulta extra ao
// repository), não um shape que essa rota já tinha por acaso.
export const meResponseSchema = sessionWithUserSchema.shape.user;
