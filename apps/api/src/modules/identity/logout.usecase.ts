import type { IdentityService } from './identity.service.js';

// Lives in usecases/ (outside modules/), per the usecase skill — every route
// goes through a usecase, even a single-module flow like this one, matching
// the same shape as loginUsecase/registerUserUsecase.
//
// Plain function taking the already-decorated service as a parameter, never
// instantiating its own `new IdentityService()` — see the
// dependency-injection skill. The route reads `request.sessionId` (attached
// by requireAuth, see infra/auth.ts) and passes it in here; the usecase
// doesn't touch the request/reply itself, same separation used by the other
// identity usecases (cookie handling stays in the route).
export async function logoutUsecase(
  identityService: IdentityService,
  sessionId: string,
): Promise<void> {
  await identityService.logout(sessionId);
}
