import type { AuthenticatedUserDto, GetMeResultDto } from './identity.dto.js';

// Passa por usecase mesmo sendo simples, seguindo a skill de usecase (toda
// rota passa por um). Não chama nenhum service: `requireAuth` (infra/auth.ts)
// já resolveu e anexou `request.user` antes deste usecase rodar, então não há
// nada a buscar — o papel aqui é só formatar o usuário já autenticado no DTO
// de resposta.
export async function getMeUsecase(user: AuthenticatedUserDto): Promise<GetMeResultDto> {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
