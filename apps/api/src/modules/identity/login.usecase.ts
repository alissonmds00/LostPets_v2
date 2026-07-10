import type { IdentityService } from './identity.service.js';
import type { LoginBodyDto, LoginResultDto } from './identity.dto.js';

// Passa por usecase mesmo sendo um fluxo de um módulo só (skill usecase: toda
// rota passa por um, sem atalho rota -> service). Função pura recebendo o
// service já decorado como parâmetro, nunca instanciando seu próprio
// `new IdentityService()` — a instância única vive em app.identityService,
// montada uma vez em app.ts (skill dependency-injection).
export async function loginUsecase(
  identityService: IdentityService,
  body: LoginBodyDto,
): Promise<LoginResultDto> {
  return identityService.login(body);
}
