import type { Prisma } from '@prisma/client';
import { prisma } from '../../infra/db/prisma.js';
import type { CreateMessageDto, MessageDto } from './messaging.dto.js';

export class MessagingRepository {
  async create(data: CreateMessageDto): Promise<MessageDto> {
    return prisma.message.create({ data });
  }

  // Chamado só depois de confirmar que a mensagem foi entregue a um socket
  // aberto do destinatário — ver MessagingService.sendMessage. `readAt` aqui
  // é delivery receipt, não "usuário abriu a conversa".
  async markDelivered(id: string): Promise<MessageDto> {
    return prisma.message.update({ where: { id }, data: { readAt: new Date() } });
  }

  // Histórico de um anúncio, restrito às mensagens em que `participantId` é
  // remetente ou destinatário — nunca todas as mensagens do anúncio (isso
  // vazaria conversas de outros participantes; decidido com o usuário em
  // 2026-07-09 que a rota fica em GET /:listingId sem otherUserId, então esse
  // filtro por participante é o que garante privacidade).
  async findHistoryByListingId(
    listingId: string,
    participantId: string,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: MessageDto[]; total: number }> {
    const where: Prisma.MessageWhereInput = {
      listingId,
      OR: [{ senderId: participantId }, { receiverId: participantId }],
    };

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.message.count({ where }),
    ]);

    return { data, total };
  }
}
