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
