import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getMessageHistoryUsecase } from '../../../src/modules/messaging/get-message-history.usecase.js';
import type { MessagingService } from '../../../src/modules/messaging/messaging.service.js';
import type { MessageHistoryDto } from '../../../src/modules/messaging/messaging.dto.js';

describe('getMessageHistoryUsecase', () => {
  it('delegates straight to messagingService.getHistory with the given args', async () => {
    const result: MessageHistoryDto = { data: [], pagination: { total: 0, offset: 0, limit: 20 } };
    const messagingService: Pick<MessagingService, 'getHistory'> = {
      getHistory: vi.fn().mockResolvedValue(result),
    };
    const listingId = randomUUID();
    const participantId = randomUUID();

    const history = await getMessageHistoryUsecase(
      messagingService as MessagingService,
      listingId,
      participantId,
      {
        offset: 0,
        limit: 20,
      },
    );

    expect(history).toBe(result);
    expect(messagingService.getHistory).toHaveBeenCalledWith(listingId, participantId, {
      offset: 0,
      limit: 20,
    });
  });
});
