import type { MessagingRepository } from './messaging.repository.js';
import type { MessagingConnectionRegistry } from './messaging-connection.registry.js';
import type {
  CreateMessageDto,
  GetMessageHistoryQueryDto,
  MessageDto,
  MessageHistoryDto,
} from './messaging.dto.js';

export class MessagingService {
  constructor(
    private readonly repository: MessagingRepository,
    private readonly connectionRegistry: MessagingConnectionRegistry,
  ) {}

  // `readAt` aqui é delivery receipt (ver MessagingRepository.markDelivered),
  // não confirmação de que o destinatário abriu a conversa.
  async sendMessage(input: CreateMessageDto): Promise<MessageDto> {
    const message = await this.repository.create(input);
    const receiverSockets = this.connectionRegistry.getSockets(input.receiverId);
    if (receiverSockets.size === 0) return message;

    const payload = JSON.stringify(message);
    for (const socket of receiverSockets) socket.send(payload);

    return this.repository.markDelivered(message.id);
  }

  async getHistory(
    listingId: string,
    participantId: string,
    pagination: GetMessageHistoryQueryDto,
  ): Promise<MessageHistoryDto> {
    const { data, total } = await this.repository.findHistoryByListingId(
      listingId,
      participantId,
      pagination,
    );
    return { data, pagination: { total, offset: pagination.offset, limit: pagination.limit } };
  }
}
