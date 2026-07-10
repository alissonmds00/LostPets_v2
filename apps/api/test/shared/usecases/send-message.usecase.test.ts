import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { sendMessageUsecase } from '../../../src/shared/usecases/send-message.usecase.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { MessagingService } from '../../../src/modules/messaging/messaging.service.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';
import type { MessageDto } from '../../../src/modules/messaging/messaging.dto.js';
import { ForbiddenError, NotFoundError } from '../../../src/infra/errors/app-error.js';

function makeListing(overrides: Partial<PetListingDto> = {}): PetListingDto {
  const createdAt = new Date();
  return {
    id: randomUUID(),
    type: 'LOST',
    title: 'Cachorro perdido',
    description: 'd',
    species: 'cachorro',
    latitude: -23.5,
    longitude: -46.6,
    city: 'São Paulo',
    status: 'ACTIVE',
    ownerId: randomUUID(),
    createdAt,
    updatedAt: createdAt,
    photos: [],
    ...overrides,
  };
}

describe('sendMessageUsecase', () => {
  it('sends the message when a non-owner messages the listing owner', async () => {
    const listing = makeListing();
    const message = {} as MessageDto;
    const petsService = {
      getListing: vi.fn().mockResolvedValue(listing),
    } as unknown as PetsService;
    const messagingService = {
      sendMessage: vi.fn().mockResolvedValue(message),
    } as unknown as MessagingService;
    const senderId = randomUUID();

    const result = await sendMessageUsecase(petsService, messagingService, {
      listingId: listing.id,
      senderId,
      receiverId: listing.ownerId,
      body: 'Ainda está disponível?',
    });

    expect(result).toBe(message);
    expect(messagingService.sendMessage).toHaveBeenCalledWith({
      listingId: listing.id,
      senderId,
      receiverId: listing.ownerId,
      body: 'Ainda está disponível?',
    });
  });

  it('sends the message when the listing owner replies to an existing thread', async () => {
    const listing = makeListing();
    const message = {} as MessageDto;
    const petsService = {
      getListing: vi.fn().mockResolvedValue(listing),
    } as unknown as PetsService;
    const messagingService = {
      sendMessage: vi.fn().mockResolvedValue(message),
    } as unknown as MessagingService;
    const otherPartyId = randomUUID();

    const result = await sendMessageUsecase(petsService, messagingService, {
      listingId: listing.id,
      senderId: listing.ownerId,
      receiverId: otherPartyId,
      body: 'Sim, ainda está!',
    });

    expect(result).toBe(message);
    expect(messagingService.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('throws ForbiddenError when neither sender nor receiver is the listing owner', async () => {
    const listing = makeListing();
    const petsService = {
      getListing: vi.fn().mockResolvedValue(listing),
    } as unknown as PetsService;
    const messagingService = { sendMessage: vi.fn() } as unknown as MessagingService;

    await expect(
      sendMessageUsecase(petsService, messagingService, {
        listingId: listing.id,
        senderId: randomUUID(),
        receiverId: randomUUID(),
        body: 'oi',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(messagingService.sendMessage).not.toHaveBeenCalled();
  });

  it('propagates NotFoundError from petsService without calling messagingService', async () => {
    const petsService = {
      getListing: vi.fn().mockRejectedValue(new NotFoundError('Anúncio')),
    } as unknown as PetsService;
    const messagingService = { sendMessage: vi.fn() } as unknown as MessagingService;

    await expect(
      sendMessageUsecase(petsService, messagingService, {
        listingId: randomUUID(),
        senderId: randomUUID(),
        receiverId: randomUUID(),
        body: 'oi',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(messagingService.sendMessage).not.toHaveBeenCalled();
  });
});
