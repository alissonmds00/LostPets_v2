import type { z } from 'zod';
import type { sessionWithUserSchema } from './identity.schema.js';

export type SessionWithUserDto = z.infer<typeof sessionWithUserSchema>;

// The subset of a session's user that's safe to attach to `request.user` —
// never includes `passwordHash`.
export type AuthenticatedUserDto = SessionWithUserDto['user'];
