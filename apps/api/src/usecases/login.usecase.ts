import { IdentityService } from '../modules/identity/identity.service.js';
import type { LoginBodyDto, LoginResultDto } from '../modules/identity/identity.dto.js';

// Lives in usecases/ (outside modules/), per the usecase skill: every route
// goes through a usecase, even a single-module flow like this one — no
// route -> service shortcut. Login only needs identity's service today, but
// staying consistent with the rest of the project (and leaving room for this
// to later touch a second module, e.g. an audit log) is the point of the
// rule, not an exception for "simple" cases.
const identityService = new IdentityService();

export async function loginUsecase(body: LoginBodyDto): Promise<LoginResultDto> {
  return identityService.login(body);
}
