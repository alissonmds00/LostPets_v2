import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { startPetsRegistrationConsumer } from '../../../src/modules/pets/pets-registration.consumer.js';
import type { PetsRegistrationQueueGatewayService } from '../../../src/gateways/pets-registration-queue.gateway.service.js';
import type { PetsService } from '../../../src/modules/pets/pets.service.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';

// Consumer test (see the testing skill): both collaborators — the queue
// gateway and the service — are mocked, so this never touches a real queue,
// sqs-consumer, or a real service call. The gateway mock captures the
// handler passed to startConsuming so tests can invoke it directly, the same
// way sqs-consumer would when a message arrives.

const buildLoggerMock = () =>
  ({
    error: vi.fn(),
    info: vi.fn(),
  }) as unknown as import('fastify').FastifyBaseLogger;

const buildQueueGatewayMock = () => {
  let capturedHandler: ((body: string) => Promise<void>) | undefined;
  const gateway = {
    startConsuming: vi.fn((handleMessage: (body: string) => Promise<void>) => {
      capturedHandler = handleMessage;
    }),
    stopConsuming: vi.fn(),
  } as unknown as PetsRegistrationQueueGatewayService;

  return { gateway, getHandler: () => capturedHandler as (body: string) => Promise<void> };
};

const buildPetsServiceMock = (): PetsService =>
  ({
    registerListing: vi.fn(),
  }) as unknown as PetsService;

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

describe('startPetsRegistrationConsumer', () => {
  it('registers a handler with the queue gateway and processes a valid message', async () => {
    const { gateway, getHandler } = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();
    const createdListing = { id: randomUUID() } as PetListingDto;
    vi.mocked(petsService.registerListing).mockResolvedValue(createdListing);

    startPetsRegistrationConsumer(gateway, petsService, logger);
    await expect(getHandler()(JSON.stringify(validInput))).resolves.toBeUndefined();

    expect(petsService.registerListing).toHaveBeenCalledWith(validInput);
  });

  it('throws for malformed JSON, leaving the message for redelivery', async () => {
    const { gateway, getHandler } = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    startPetsRegistrationConsumer(gateway, petsService, logger);
    await expect(getHandler()('not json')).rejects.toBeDefined();

    expect(petsService.registerListing).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws when the schema is invalid, leaving the message for redelivery', async () => {
    const { gateway, getHandler } = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();
    const invalidInput = { ...validInput, type: 'NOT_A_TYPE' };

    startPetsRegistrationConsumer(gateway, petsService, logger);
    await expect(getHandler()(JSON.stringify(invalidInput))).rejects.toBeDefined();

    expect(petsService.registerListing).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('propagates the error when registerListing fails, leaving the message for redelivery', async () => {
    const { gateway, getHandler } = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();
    vi.mocked(petsService.registerListing).mockRejectedValue(new Error('db down'));

    startPetsRegistrationConsumer(gateway, petsService, logger);
    await expect(getHandler()(JSON.stringify(validInput))).rejects.toThrow('db down');

    expect(logger.error).toHaveBeenCalled();
  });

  it('stop() delegates to queueGateway.stopConsuming', () => {
    const { gateway } = buildQueueGatewayMock();
    const petsService = buildPetsServiceMock();
    const logger = buildLoggerMock();

    const consumer = startPetsRegistrationConsumer(gateway, petsService, logger);
    consumer.stop();

    expect(gateway.stopConsuming).toHaveBeenCalledTimes(1);
  });
});
