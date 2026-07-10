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

  // Doesn't pre-check email uniqueness with a separate lookup (findByEmail then
  // create) — that's a check-then-act race under concurrent requests. Instead
  // this relies on the DB's own unique constraint and translates Prisma's
  // P2002 (unique violation) into a ConflictError, same as the repository
  // skill's not-found translation convention.
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

  // A login attempt against a nonexistent email is a valid outcome, not an
  // error — findX (null), not getX (NotFoundError). Includes `passwordHash`
  // since the service needs it to verify the login attempt.
  async findByEmail(email: string): Promise<UserWithPasswordDto | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(userId: string, expiresAt: Date): Promise<SessionWithUserDto> {
    return this.prisma.session.create({
      data: { userId, expiresAt },
      include: { user: true },
    });
  }

  // "Valid" means it exists and is not expired — expired sessions are treated
  // the same as missing ones for anyone checking whether they can authenticate
  // with this session id (requireAuth), so this stays a findX (null), not a
  // getX (NotFoundError).
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
