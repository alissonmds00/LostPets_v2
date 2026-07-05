import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { startPetsRegistrationPoller } from '../../src/pollers/pets-registration.poller.js';
import type { PetsRegistrationQueueGatewayService } from '../../src/gateways/pets-registration-queue.gateway.service.js';
import type { PetsService } from '../../src/modules/pets/pets.service.js';
import type { PetListingDto } from '../../src/modules/pets/pets.dto.js';

// Poller test (see the testing skill): both collaborators — the queue
// gateway and the service — are mocked, so this never touches a real queue
// or a real service call. `stop()` is always invoked at the end of each test
// so the background loop doesn't keep running past the test.

const buildLoggerMock = () =>
  ({
    error: vi.fn(),
    info: vi.fn(),
  }) as unknown as import('fastify').FastifyBaseLogger;

const buildQueueGatewayMock = (): PetsRegistrationQueueGatewayService =>
  ({
    receiveMessages: vi.fn(),
    deleteMessage: vi.fn(),
  }) as unknown as PetsRegistrationQueueGatewayService;

const buildPetsServiceMock = (): PetsService =>
  ({
    registerListing: vi.fn(),
  }) as unknown as PetsService;

// Small helper to wait for a number of microtask/macrotask ticks so the
// poller's internal async loop has a chance to run before we assert.
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

// After the first controlled response, resolve with a long-pending promise
// instead of `[]` — mirrors real long-polling (blocks until a message shows
// up or the wait times out) and keeps the loop from spinning as fast as
// possible during the test, which was exhausting memory.
const hang = () => new Promise<never>(() => {});

const validInput = {
  type: 'DONATION' as const,
  title: 'Filhotes para adoção',
  description: 'Ninhada de 4 filhotes, 2 meses',
  species: 'cachorro',
  latitude: -19.916681,
  longitude: -43.934493,
  city: 'Belo Horizonte',
  ownerId: randomUUID(),
  photos: [],
};

describe('startPetsRegistrationPoller', () => {
  it('processes a valid message: calls registerListing and deletes the message', async () => {
    const queueGateway = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    const createdListing = { id: randomUUID() } as PetListingDto;
    vi.mocked(petsService.registerListing).mockResolvedValue(createdListing);
    vi.mocked(queueGateway.receiveMessages)
      .mockResolvedValueOnce([{ receiptHandle: 'rh-1', body: JSON.stringify(validInput) }])
      .mockImplementation(hang);

    const poller = startPetsRegistrationPoller(queueGateway, petsService, logger);
    await flush();
    poller.stop();
    await flush();

    expect(petsService.registerListing).toHaveBeenCalledWith(validInput);
    expect(queueGateway.deleteMessage).toHaveBeenCalledWith('rh-1');
  });

  it('never calls registerListing or deleteMessage for malformed JSON', async () => {
    const queueGateway = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    vi.mocked(queueGateway.receiveMessages)
      .mockResolvedValueOnce([{ receiptHandle: 'rh-1', body: 'not json' }])
      .mockImplementation(hang);

    const poller = startPetsRegistrationPoller(queueGateway, petsService, logger);
    await flush();
    poller.stop();
    await flush();

    expect(petsService.registerListing).not.toHaveBeenCalled();
    expect(queueGateway.deleteMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('never calls registerListing or deleteMessage when the schema is invalid', async () => {
    const queueGateway = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    const invalidInput = { ...validInput, type: 'NOT_A_TYPE' };
    vi.mocked(queueGateway.receiveMessages)
      .mockResolvedValueOnce([{ receiptHandle: 'rh-1', body: JSON.stringify(invalidInput) }])
      .mockImplementation(hang);

    const poller = startPetsRegistrationPoller(queueGateway, petsService, logger);
    await flush();
    poller.stop();
    await flush();

    expect(petsService.registerListing).not.toHaveBeenCalled();
    expect(queueGateway.deleteMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('does not delete the message when registerListing throws', async () => {
    const queueGateway = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    vi.mocked(petsService.registerListing).mockRejectedValue(new Error('db down'));
    vi.mocked(queueGateway.receiveMessages)
      .mockResolvedValueOnce([{ receiptHandle: 'rh-1', body: JSON.stringify(validInput) }])
      .mockImplementation(hang);

    const poller = startPetsRegistrationPoller(queueGateway, petsService, logger);
    await flush();
    poller.stop();
    await flush();

    expect(petsService.registerListing).toHaveBeenCalledWith(validInput);
    expect(queueGateway.deleteMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
