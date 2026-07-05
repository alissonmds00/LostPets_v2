import type { AuthenticatedUserDto, GetMeResultDto } from './identity.dto.js';

// Lives in usecases/ per the usecase skill: every route goes through a
// usecase, even one this simple — no route -> straight response shortcut.
// Doesn't call any service: `requireAuth` (infra/auth.ts) already resolved
// and attached `request.user` before this usecase runs, so there's nothing
// left to fetch. The usecase's job here is just formatting the already-
// authenticated user into the route's response DTO, not pulling data itself.
export async function getMeUsecase(user: AuthenticatedUserDto): Promise<GetMeResultDto> {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
