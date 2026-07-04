import type { IdentityService } from '../modules/identity/identity.service.js';
import type { LoginBodyDto, LoginResultDto } from '../modules/identity/identity.dto.js';

// Lives in usecases/ (outside modules/), per the usecase skill: every route
// goes through a usecase, even a single-module flow like this one — no
// route -> service shortcut. Login only needs identity's service today, but
// staying consistent with the rest of the project (and leaving room for this
// to later touch a second module, e.g. an audit log) is the point of the
// rule, not an exception for "simple" cases.
//
// Plain function taking the already-decorated service as a parameter, never
// instantiating its own `new IdentityService()` — the single instance lives
// on the root Fastify instance (app.identityService), built once in app.ts
// and passed in by the route. See the dependency-injection skill.
export async function loginUsecase(
  identityService: IdentityService,
  body: LoginBodyDto,
): Promise<LoginResultDto> {
  return identityService.login(body);
}
