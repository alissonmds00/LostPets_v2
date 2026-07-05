import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { PetsRepository } from '../../../src/modules/pets/pets.repository.js';
import { PetsService } from '../../../src/modules/pets/pets.service.js';
import { InvalidPetPhotoError } from '../../../src/modules/pets/pets.errors.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';
import type { StorageGateway } from '../../../src/gateways/storage.gateway.service.js';
import type { PetsRegistrationQueueGatewayService } from '../../../src/gateways/pets-registration-queue.gateway.service.js';

async function makeJpegBuffer(width = 20, height = 20): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .toBuffer();
}

describe('PetsService', () => {
  // Repository mocked (see the testing skill, revised 2026-07-04): the
  // service is tested isolated from Postgres, injecting a fake repository
  // through the same constructor used in production (see the
  // dependency-injection skill). Only the repository is mocked — it's the
  // service's sole collaborator.
  const buildRepositoryMock = (): PetsRepository =>
    ({
      create: vi.fn(),
    }) as unknown as PetsRepository;

  describe('registerListing', () => {
    it('delegates to the repository and returns the created listing with its photos', async () => {
      const ownerId = randomUUID();
      const input = {
        type: 'DONATION' as const,
        title: 'Filhotes para adoção',
        description: 'Ninhada de 4 filhotes, 2 meses',
        species: 'cachorro',
        latitude: -19.916681,
        longitude: -43.934493,
        city: 'Belo Horizonte',
        ownerId,
        photos: [{ storageKey: 'listings/1/photo-1.jpg', url: 'https://example.com/photo-1.jpg', order: 0 }],
      };
      const listingId = randomUUID();
      const createdListing: PetListingDto = {
        id: listingId,
        type: 'DONATION',
        title: input.title,
        description: input.description,
        species: input.species,
        latitude: input.latitude,
        longitude: input.longitude,
        city: input.city,
        status: 'ACTIVE',
        ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
        photos: [
          {
            id: randomUUID(),
            listingId,
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
            createdAt: new Date(),
          },
        ],
      };

      const repositoryMock = buildRepositoryMock();
      vi.mocked(repositoryMock.create).mockResolvedValue(createdListing);

      // registerListing só depende do repository — storage/queue não entram
      // nesse método (é o que o futuro worker chama pra persistir de fato).
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      const listing = await service.registerListing(input);

      expect(listing).toBe(createdListing);
      expect(repositoryMock.create).toHaveBeenCalledWith(input);
    });
  });

  describe('submitListingForRegistration', () => {
    // repository/storageGateway/queueGateway são os três colaboradores do
    // service (ver skill testing) — nenhum é real neste teste.
    const buildCollaboratorMocks = () => ({
      repositoryMock: { create: vi.fn() } as unknown as PetsRepository,
      storageGatewayMock: {
        save: vi.fn().mockResolvedValue('listings/generated-key.jpg'),
        getUrl: vi.fn().mockResolvedValue('https://cdn.example.com/listings/generated-key.jpg'),
      } as unknown as StorageGateway,
      queueGatewayMock: {
        enqueue: vi.fn().mockResolvedValue(undefined),
      } as unknown as PetsRegistrationQueueGatewayService,
    });

    const baseInput = (ownerId: string, photos: { buffer: Buffer; contentType: string }[]) => ({
      type: 'LOST' as const,
      title: 'Cachorro perdido no bairro Centro',
      description: 'Golden retriever, atende por Rex',
      species: 'cachorro',
      latitude: -23.55052,
      longitude: -46.633308,
      city: 'São Paulo',
      ownerId,
      photos,
    });

    it('generates a thumbnail for each photo, saves it via the storage gateway, and publishes the built DTO to the queue', async () => {
      const { repositoryMock, storageGatewayMock, queueGatewayMock } = buildCollaboratorMocks();
      const service = new PetsService(repositoryMock, storageGatewayMock, queueGatewayMock);
      const ownerId = randomUUID();
      const photoBuffer = await makeJpegBuffer();

      await service.submitListingForRegistration(
        baseInput(ownerId, [{ buffer: photoBuffer, contentType: 'image/jpeg' }]),
      );

      expect(storageGatewayMock.save).toHaveBeenCalledTimes(1);
      const [, savedBuffer, savedContentType] = vi.mocked(storageGatewayMock.save).mock.calls[0];
      // O que é salvo é a thumbnail já processada, não o buffer original —
      // uma imagem 20x20 redimensionada para largura máxima 800px continua
      // pequena, mas o buffer salvo não é byte-a-byte igual ao original (foi
      // reprocessado pelo sharp).
      expect(savedBuffer).toBeInstanceOf(Buffer);
      expect(savedContentType).toBe('image/jpeg');

      expect(storageGatewayMock.getUrl).toHaveBeenCalledTimes(1);
      expect(queueGatewayMock.enqueue).toHaveBeenCalledTimes(1);

      const [publishedMessage] = vi.mocked(queueGatewayMock.enqueue).mock.calls[0];
      const publishedDto = JSON.parse(publishedMessage as string);
      expect(publishedDto).toMatchObject({
        type: 'LOST',
        title: 'Cachorro perdido no bairro Centro',
        description: 'Golden retriever, atende por Rex',
        species: 'cachorro',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        ownerId,
        photos: [
          {
            storageKey: 'listings/generated-key.jpg',
            url: 'https://cdn.example.com/listings/generated-key.jpg',
            order: 0,
          },
        ],
      });

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    it('assigns a sequential order to multiple photos', async () => {
      const { repositoryMock, storageGatewayMock, queueGatewayMock } = buildCollaboratorMocks();
      const service = new PetsService(repositoryMock, storageGatewayMock, queueGatewayMock);
      const ownerId = randomUUID();
      const photoA = await makeJpegBuffer();
      const photoB = await makeJpegBuffer();

      await service.submitListingForRegistration(
        baseInput(ownerId, [
          { buffer: photoA, contentType: 'image/jpeg' },
          { buffer: photoB, contentType: 'image/png' },
        ]),
      );

      const [publishedMessage] = vi.mocked(queueGatewayMock.enqueue).mock.calls[0];
      const publishedDto = JSON.parse(publishedMessage as string);
      expect(publishedDto.photos.map((p: { order: number }) => p.order)).toEqual([0, 1]);
      expect(storageGatewayMock.save).toHaveBeenCalledTimes(2);
    });

    it('submits a listing with no photos', async () => {
      const { repositoryMock, storageGatewayMock, queueGatewayMock } = buildCollaboratorMocks();
      const service = new PetsService(repositoryMock, storageGatewayMock, queueGatewayMock);
      const ownerId = randomUUID();

      await service.submitListingForRegistration(baseInput(ownerId, []));

      expect(storageGatewayMock.save).not.toHaveBeenCalled();
      const [publishedMessage] = vi.mocked(queueGatewayMock.enqueue).mock.calls[0];
      expect(JSON.parse(publishedMessage as string).photos).toEqual([]);
    });

    it('rejects a photo with an unsupported content type without calling storage or queue', async () => {
      const { repositoryMock, storageGatewayMock, queueGatewayMock } = buildCollaboratorMocks();
      const service = new PetsService(repositoryMock, storageGatewayMock, queueGatewayMock);
      const ownerId = randomUUID();
      const photoBuffer = await makeJpegBuffer();

      await expect(
        service.submitListingForRegistration(
          baseInput(ownerId, [{ buffer: photoBuffer, contentType: 'image/gif' }]),
        ),
      ).rejects.toBeInstanceOf(InvalidPetPhotoError);

      expect(storageGatewayMock.save).not.toHaveBeenCalled();
      expect(queueGatewayMock.enqueue).not.toHaveBeenCalled();
      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    it('rejects a photo larger than the size limit without calling storage or queue', async () => {
      const { repositoryMock, storageGatewayMock, queueGatewayMock } = buildCollaboratorMocks();
      const service = new PetsService(repositoryMock, storageGatewayMock, queueGatewayMock);
      const ownerId = randomUUID();
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);

      await expect(
        service.submitListingForRegistration(
          baseInput(ownerId, [{ buffer: oversizedBuffer, contentType: 'image/jpeg' }]),
        ),
      ).rejects.toBeInstanceOf(InvalidPetPhotoError);

      expect(storageGatewayMock.save).not.toHaveBeenCalled();
      expect(queueGatewayMock.enqueue).not.toHaveBeenCalled();
    });
  });
});
