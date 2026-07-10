import { Prisma, type PrismaClient } from '@prisma/client';
import { ConflictError } from '../../infra/errors/app-error.js';
import type {
  CreateUserDto,
  SessionWithUserDto,
  UserDto,
  UserWithPasswordDto,
} from './identity.dto.js';

export class IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Não faz lookup prévio de unicidade de e-mail (check-then-act, gera race
  // condition sob concorrência) — confia na constraint unique do banco e
  // traduz o P2002 do Prisma em ConflictError, seguindo a mesma convenção de
  // tradução de erro da skill de repository.
  async createUser(user: CreateUserDto): Promise<UserDto> {
    try {
      return await this.prisma.user.create({
        data: { email: user.email, passwordHash: user.passwordHash, name: user.name },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('E-mail já cadastrado');
      }
      throw error;
    }
  }

  // Tentativa de login com e-mail inexistente é um resultado válido, não um
  // erro — por isso findX (null), não getX (NotFoundError).
  async findByEmail(email: string): Promise<UserWithPasswordDto | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(userId: string, expiresAt: Date): Promise<SessionWithUserDto> {
    return this.prisma.session.create({
      data: { userId, expiresAt },
      include: { user: true },
    });
  }

  // Sessão expirada é tratada como inexistente para quem verifica se pode
  // autenticar com esse id (requireAuth) — por isso findX (null), não getX
  // (NotFoundError).
  async findValidById(sessionId: string): Promise<SessionWithUserDto | null> {
    return this.prisma.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
