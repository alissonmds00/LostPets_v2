import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/db/prisma.js';
import { ConflictError } from '../../infra/errors/app-error.js';
import type { CreateUserDto, SessionWithUserDto, UserDto } from './identity.dto.js';

export class IdentityRepository {
  // Doesn't pre-check email uniqueness with a separate lookup (findByEmail then
  // create) — that's a check-then-act race under concurrent requests. Instead
  // this relies on the DB's own unique constraint and translates Prisma's
  // P2002 (unique violation) into a ConflictError, same as the repository
  // skill's not-found translation convention.
  async createUser(user: CreateUserDto): Promise<UserDto> {
    try {
      return await prisma.user.create({
        data: { email: user.email, passwordHash: user.passwordHash, name: user.name },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Email already registered');
      }
      throw error;
    }
  }

  async create(userId: string, expiresAt: Date): Promise<SessionWithUserDto> {
    return prisma.session.create({
      data: { userId, expiresAt },
      include: { user: true },
    });
  }

  // "Valid" means it exists and is not expired — expired sessions are treated
  // the same as missing ones for anyone checking whether they can authenticate
  // with this session id (requireAuth), so this stays a findX (null), not a
  // getX (NotFoundError).
  async findValidById(sessionId: string): Promise<SessionWithUserDto | null> {
    return prisma.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  async deleteById(sessionId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
