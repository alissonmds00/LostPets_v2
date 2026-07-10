import { UnauthorizedError } from '../../infra/errors/app-error.js';
import { getDummyPasswordHash, hashPassword, verifyPassword } from '../../infra/password.js';
import type { IdentityRepository } from './identity.repository.js';
import type {
  LoginBodyDto,
  LoginResultDto,
  RegisterUserInputDto,
  UserDto,
} from './identity.dto.js';

export class IdentityService {
  // Repository injetado via construtor — a instância única é montada uma vez
  // em app.ts (skill dependency-injection); o service nunca instancia a sua.
  constructor(
    private readonly repository: IdentityRepository,
    private readonly sessionTtlDays: number,
  ) {}

  async registerUser(input: RegisterUserInputDto): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return this.repository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });
  }

  async login(credentials: LoginBodyDto): Promise<LoginResultDto> {
    const user = await this.repository.findByEmail(credentials.email);
    if (!user) {
      // Paga o mesmo custo de CPU do argon2 que o caminho de "senha errada"
      // abaixo, pra que as duas respostas de falha levem o mesmo tempo — do
      // contrário a latência vaza se o e-mail está cadastrado, mesmo com a
      // mesma mensagem de erro nos dois casos. Ver SECURITY-AUDIT.md, seção
      // 4, item 1.
      await verifyPassword(await getDummyPasswordHash(), credentials.password);
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const passwordMatches = await verifyPassword(user.passwordHash, credentials.password);
    if (!passwordMatches) throw new UnauthorizedError('Credenciais inválidas');

    const expiresAt = new Date(Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000);
    const session = await this.repository.create(user.id, expiresAt);

    // Montado a partir do `user` já buscado (findByEmail), não de
    // `session.user` — assim `passwordHash` nunca chega a ser referenciado
    // como se fizesse parte do shape retornado.
    return {
      session,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // Idempotente por design: deleteById é um no-op (não um erro) quando a
  // sessão já não existe — deslogar duas vezes, ou deslogar com uma sessão
  // já expirada/removida, deve continuar retornando sucesso em vez de um
  // erro espúrio pro cliente.
  async logout(sessionId: string): Promise<void> {
    await this.repository.deleteById(sessionId);
  }
}
