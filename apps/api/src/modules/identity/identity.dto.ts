import type { z } from 'zod';
import type {
  createUserSchema,
  loginBodySchema,
  loginResponseSchema,
  loginResultSchema,
  meResponseSchema,
  registerUserBodySchema,
  sessionWithUserSchema,
  userResponseSchema,
  userWithPasswordSchema,
} from './identity.schema.js';

export type SessionWithUserDto = z.infer<typeof sessionWithUserSchema>;

export type AuthenticatedUserDto = SessionWithUserDto['user'];

export type RegisterUserInputDto = z.infer<typeof registerUserBodySchema>;

export type UserDto = z.infer<typeof userResponseSchema>;

// Hashing acontece no service, não aqui — este DTO já espera a senha
// convertida em `passwordHash`, nunca em texto plano.
export type CreateUserDto = z.infer<typeof createUserSchema>;

// Inclui `passwordHash`; nunca deve ser retornado como está pra uma rota ou
// cliente.
export type UserWithPasswordDto = z.infer<typeof userWithPasswordSchema>;

export type LoginBodyDto = z.infer<typeof loginBodySchema>;
export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

// Não é um schema de wire em si — deriva de loginResultSchema como todo DTO
// deste projeto (skill `dto`: nenhuma interface escrita à mão, nem pra shapes
// internos).
export type LoginResultDto = z.infer<typeof loginResultSchema>;

// Mesmo shape de AuthenticatedUserDto, não de UserDto (ver meResponseSchema
// pelo motivo).
export type GetMeResultDto = z.infer<typeof meResponseSchema>;
