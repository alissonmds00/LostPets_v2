import { prisma } from '../../shared/db/prisma.js';
import type { SessionWithUserDto } from './identity.dto.js';

export class IdentityRepository {
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
