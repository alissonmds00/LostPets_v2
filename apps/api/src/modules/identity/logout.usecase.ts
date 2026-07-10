import type { IdentityService } from './identity.service.js';

// Passa por usecase mesmo sendo um fluxo de um módulo só (skill usecase).
// Função pura recebendo o service já decorado como parâmetro, nunca
// instanciando seu próprio `new IdentityService()` (skill
// dependency-injection). Não toca em request/reply diretamente — a rota lê
// `request.sessionId` (anexado por requireAuth) e repassa aqui; manuseio de
// cookie fica na rota.
export async function logoutUsecase(
  identityService: IdentityService,
  sessionId: string,
): Promise<void> {
  await identityService.logout(sessionId);
}
