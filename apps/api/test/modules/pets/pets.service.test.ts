import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { PetsRepository } from '../../../src/modules/pets/pets.repository.js';
import { PetsService } from '../../../src/modules/pets/pets.service.js';
import { InvalidPetPhotoError } from '../../../src/modules/pets/pets.errors.js';
import type { PetListingDto } from '../../../src/modules/pets/pets.dto.js';
import type { StorageGateway } from '../../../src/gateways/storage.gateway.service.js';
import type { PetsRegistrationQueueGatewayService } from '../../../src/gateways/pets-registration-queue.gateway.service.js';
import { ForbiddenError, NotFoundError } from '../../../src/infra/errors/app-error.js';

async function makeJpegBuffer(width = 20, height = 20): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .toBuffer();
}

describe('PetsService', () => {
  // Repository mockado (ver skill testing, revisada em 2026-07-04): o
  // service é testado isolado do Postgres, injetando um repository falso
  // pelo mesmo constructor usado em produção (ver skill
  // dependency-injection). Só o repository é mockado — é o único
  // colaborador do service neste bloco.
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
        species: 'DOG',
        latitude: -19.916681,
        longitude: -43.934493,
        city: 'Belo Horizonte',
        ownerId,
        photos: [
          {
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
          },
        ],
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
      species: 'DOG',
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
        species: 'DOG',
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

  function makeListing(overrides: Partial<PetListingDto> = {}): PetListingDto {
    const createdAt = new Date();
    return {
      id: randomUUID(),
      type: 'LOST',
      title: 'Cachorro perdido',
      description: 'Golden retriever, atende por Rex',
      species: 'DOG',
      latitude: -23.55052,
      longitude: -46.633308,
      city: 'São Paulo',
      status: 'ACTIVE',
      ownerId: randomUUID(),
      createdAt,
      updatedAt: createdAt,
      photos: [],
      ...overrides,
    };
  }

  describe('listListings', () => {
    it('delegates filters to the repository and wraps the result with pagination info', async () => {
      const listing = makeListing();
      const repositoryMock = {
        findMany: vi.fn().mockResolvedValue({ data: [listing], total: 1 }),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      const filters = { status: 'ACTIVE' as const, offset: 0, limit: 20 };
      const result = await service.listListings(filters);

      expect(repositoryMock.findMany).toHaveBeenCalledWith(filters);
      expect(result).toEqual({ data: [listing], pagination: { total: 1, offset: 0, limit: 20 } });
    });
  });

  describe('getListing', () => {
    it('delegates to the repository', async () => {
      const listing = makeListing();
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      const result = await service.getListing(listing.id);

      expect(result).toBe(listing);
      expect(repositoryMock.getById).toHaveBeenCalledWith(listing.id);
    });

    it('propagates NotFoundError from the repository', async () => {
      const repositoryMock = {
        getById: vi.fn().mockRejectedValue(new NotFoundError('Anúncio')),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      await expect(service.getListing(randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateListing', () => {
    it('updates when the requester owns the listing', async () => {
      const ownerId = randomUUID();
      const listing = makeListing({ ownerId });
      const updated = { ...listing, title: 'Novo título' };
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
        update: vi.fn().mockResolvedValue(updated),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      const result = await service.updateListing({
        id: listing.id,
        requesterId: ownerId,
        requesterRole: 'USER',
        title: 'Novo título',
      });

      expect(result).toBe(updated);
      expect(repositoryMock.update).toHaveBeenCalledWith(listing.id, { title: 'Novo título' });
    });

    it('throws ForbiddenError when the requester does not own the listing (even if ADMIN)', async () => {
      const listing = makeListing({ ownerId: randomUUID() });
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
        update: vi.fn(),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      await expect(
        service.updateListing({
          id: listing.id,
          requesterId: randomUUID(),
          requesterRole: 'ADMIN',
          title: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repositoryMock.update).not.toHaveBeenCalled();
    });

    it('propagates NotFoundError from the repository without calling update', async () => {
      const repositoryMock = {
        getById: vi.fn().mockRejectedValue(new NotFoundError('Anúncio')),
        update: vi.fn(),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      await expect(
        service.updateListing({
          id: randomUUID(),
          requesterId: randomUUID(),
          requesterRole: 'USER',
          title: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteListing', () => {
    it('soft-deletes when the requester owns the listing', async () => {
      const ownerId = randomUUID();
      const listing = makeListing({ ownerId });
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
        softDelete: vi.fn().mockResolvedValue(undefined),
      } as unknown as PetsRepository;
      const storageGatewayMock = { delete: vi.fn() } as unknown as StorageGateway;
      const service = new PetsService(
        repositoryMock,
        storageGatewayMock,
        {} as PetsRegistrationQueueGatewayService,
      );

      await service.deleteListing({ id: listing.id, requesterId: ownerId, requesterRole: 'USER' });

      expect(repositoryMock.softDelete).toHaveBeenCalledWith(listing.id);
      // Fotos permanecem no storage após soft-delete (decisão do usuário) —
      // nenhuma chamada ao storage gateway.
      expect(storageGatewayMock.delete).not.toHaveBeenCalled();
    });

    it('soft-deletes when the requester is ADMIN, even without owning the listing', async () => {
      const listing = makeListing({ ownerId: randomUUID() });
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
        softDelete: vi.fn().mockResolvedValue(undefined),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      await service.deleteListing({
        id: listing.id,
        requesterId: randomUUID(),
        requesterRole: 'ADMIN',
      });

      expect(repositoryMock.softDelete).toHaveBeenCalledWith(listing.id);
    });

    it('throws ForbiddenError for a non-owner, non-admin requester', async () => {
      const listing = makeListing({ ownerId: randomUUID() });
      const repositoryMock = {
        getById: vi.fn().mockResolvedValue(listing),
        softDelete: vi.fn(),
      } as unknown as PetsRepository;
      const service = new PetsService(
        repositoryMock,
        {} as StorageGateway,
        {} as PetsRegistrationQueueGatewayService,
      );

      await expect(
        service.deleteListing({ id: listing.id, requesterId: randomUUID(), requesterRole: 'USER' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(repositoryMock.softDelete).not.toHaveBeenCalled();
    });
  });
});
