import type { z } from 'zod';
import type {
  registerUserBodySchema,
  sessionWithUserSchema,
  userResponseSchema,
} from './identity.schema.js';

export type SessionWithUserDto = z.infer<typeof sessionWithUserSchema>;

// The subset of a session's user that's safe to attach to `request.user` —
// never includes `passwordHash`.
export type AuthenticatedUserDto = SessionWithUserDto['user'];

// POST /register request body.
export type RegisterUserInputDto = z.infer<typeof registerUserBodySchema>;

// Safe user shape for API responses — never includes `passwordHash`.
export type UserDto = z.infer<typeof userResponseSchema>;

// What the repository needs to create a `User` row — already-hashed password,
// never the plain-text one (hashing happens in the service, not here).
export type CreateUserDto = {
  email: string;
  passwordHash: string;
  name: string;
};
