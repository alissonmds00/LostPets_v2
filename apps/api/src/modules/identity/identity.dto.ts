import type { z } from 'zod';
import type {
  createUserSchema,
  loginBodySchema,
  loginResponseSchema,
  loginResultSchema,
  registerUserBodySchema,
  sessionWithUserSchema,
  userResponseSchema,
  userWithPasswordSchema,
} from './identity.schema.js';

export type SessionWithUserDto = z.infer<typeof sessionWithUserSchema>;

// The subset of a session's user that's safe to attach to `request.user` —
// never includes `passwordHash`.
export type AuthenticatedUserDto = SessionWithUserDto['user'];

// POST /register request body.
export type RegisterUserInputDto = z.infer<typeof registerUserBodySchema>;

// Safe user shape for API responses — never includes `passwordHash`. General-
// purpose "safe user" projection (register's response, and anywhere else a
// route needs to serialize a user).
export type UserDto = z.infer<typeof userResponseSchema>;

// What the repository needs to create a `User` row — already-hashed password,
// never the plain-text one (hashing happens in the service, not here).
export type CreateUserDto = z.infer<typeof createUserSchema>;

// Full user row, including `passwordHash` — internal to
// repository/service (IdentityRepository.findByEmail, used to verify a login
// attempt), never returned as-is to a route or client.
export type UserWithPasswordDto = z.infer<typeof userWithPasswordSchema>;

export type LoginBodyDto = z.infer<typeof loginBodySchema>;
export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

// Internal result of IdentityService.login — not a wire schema itself (no
// route serializes this exact shape directly), derived from loginResultSchema
// like every other DTO in this project (see the `dto` skill: no hand-written
// interfaces, even for internal shapes). The usecase reads `session` to set
// the cookie and `user` to build the LoginResponseDto.
export type LoginResultDto = z.infer<typeof loginResultSchema>;
