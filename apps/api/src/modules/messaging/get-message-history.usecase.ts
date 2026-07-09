import type { MessagingService } from './messaging.service.js';
import type { GetMessageHistoryQueryDto, MessageHistoryDto } from './messaging.dto.js';

// Single-module (só orquestra messagingService) — mesmo assim passa por
// usecase, ver skill usecase.
export async function getMessageHistoryUsecase(
  messagingService: MessagingService,
  listingId: string,
  participantId: string,
  pagination: GetMessageHistoryQueryDto,
): Promise<MessageHistoryDto> {
  return messagingService.getHistory(listingId, participantId, pagination);
}
