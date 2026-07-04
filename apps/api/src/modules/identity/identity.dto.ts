import type { z } from 'zod';
import type {
  loginBodySchema,
  loginResponseSchema,
  loginResultSchema,
  sessionWithUserSchema,
  userSchema,
} from './identity.schema.js';

export type SessionWithUserDto = z.infer<typeof sessionWithUserSchema>;

// The subset of a session's user that's safe to attach to `request.user` —
// never includes `passwordHash`.
export type AuthenticatedUserDto = SessionWithUserDto['user'];

// Full user row, including `passwordHash` — internal to
// repository/service, never returned as-is to a route or client.
export type UserDto = z.infer<typeof userSchema>;

export type LoginBodyDto = z.infer<typeof loginBodySchema>;
export type LoginResponseDto = z.infer<typeof loginResponseSchema>;

// Internal result of IdentityService.login — not a wire schema itself (no
// route serializes this exact shape directly), derived from loginResultSchema
// like every other DTO in this project (see the `dto` skill: no hand-written
// interfaces, even for internal shapes). The usecase reads `session` to set
// the cookie and `user` to build the LoginResponseDto.
export type LoginResultDto = z.infer<typeof loginResultSchema>;
