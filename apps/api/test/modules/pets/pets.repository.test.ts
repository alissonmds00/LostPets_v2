import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { PetsRepository } from '../../../src/modules/pets/pets.repository.js';
import { NotFoundError } from '../../../src/infra/errors/app-error.js';

const prismaMock = mockDeep<PrismaClient>();

describe('PetsRepository', () => {
  const repository = new PetsRepository(prismaMock);
  const ownerId = randomUUID();

  beforeEach(() => {
    mockReset(prismaMock);
    // O repository chama `prisma.$transaction((tx) => ...)` passando um
    // callback — o mock simula o Prisma real invocando esse callback com o
    // próprio client mockado no lugar do `tx`, já que a interface de `tx` é a
    // mesma de `prisma` dentro de uma transação.
    prismaMock.$transaction.mockImplementation((callback: unknown) =>
      (callback as (tx: DeepMockProxy<PrismaClient>) => unknown)(prismaMock),
    );
  });

  describe('create', () => {
    it('creates a pet listing with its photos in a single transaction', async () => {
      const createdAt = new Date();
      prismaMock.petListing.create.mockResolvedValue({
        id: randomUUID(),
        type: 'LOST',
        title: 'Cachorro perdido no bairro Centro',
        description: 'Golden retriever, atende por Rex',
        species: 'DOG',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [
          {
            id: randomUUID(),
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
            listingId: randomUUID(),
          },
          {
            id: randomUUID(),
            storageKey: 'listings/1/photo-2.jpg',
            url: 'https://example.com/photo-2.jpg',
            order: 1,
            listingId: randomUUID(),
          },
        ],
      } as never);

      const listing = await repository.create({
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
            storageKey: 'listings/1/photo-1.jpg',
            url: 'https://example.com/photo-1.jpg',
            order: 0,
          },
          {
            storageKey: 'listings/1/photo-2.jpg',
            url: 'https://example.com/photo-2.jpg',
            order: 1,
          },
        ],
      });

      expect(listing.id).toBeTruthy();
      expect(listing.type).toBe('LOST');
      expect(listing.title).toBe('Cachorro perdido no bairro Centro');
      expect(listing.species).toBe('DOG');
      expect(listing.city).toBe('São Paulo');
      expect(listing.status).toBe('ACTIVE');
      expect(listing.ownerId).toBe(ownerId);
      expect(listing.photos).toHaveLength(2);
      expect(listing.photos.map((p) => p.storageKey).sort()).toEqual([
        'listings/1/photo-1.jpg',
        'listings/1/photo-2.jpg',
      ]);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.petListing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'LOST',
            title: 'Cachorro perdido no bairro Centro',
            ownerId,
            photos: {
              create: [
                {
                  storageKey: 'listings/1/photo-1.jpg',
                  url: 'https://example.com/photo-1.jpg',
                  order: 0,
                },
                {
                  storageKey: 'listings/1/photo-2.jpg',
                  url: 'https://example.com/photo-2.jpg',
                  order: 1,
                },
              ],
            },
          }),
          include: { photos: true },
        }),
      );
    });

    it('creates a pet listing with no photos', async () => {
      const createdAt = new Date();
      prismaMock.petListing.create.mockResolvedValue({
        id: randomUUID(),
        type: 'FOUND',
        title: 'Gato encontrado',
        description: 'Gato preto e branco, sem coleira',
        species: 'CAT',
        latitude: -22.906847,
        longitude: -43.172897,
        city: 'Rio de Janeiro',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [],
      } as never);

      const listing = await repository.create({
        type: 'FOUND',
        title: 'Gato encontrado',
        description: 'Gato preto e branco, sem coleira',
        species: 'CAT',
        latitude: -22.906847,
        longitude: -43.172897,
        city: 'Rio de Janeiro',
        ownerId,
        photos: [],
      });

      expect(listing.photos).toHaveLength(0);
    });
  });

  describe('findMany', () => {
    const baseFilters = { offset: 0, limit: 20, status: 'ACTIVE' as const };
    const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => {
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
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [],
        ...overrides,
      };
    };

    it('applies deletedAt/status/type/species/city filters and pagination through the query builder when no radius is given', async () => {
      const row = makeRow();
      prismaMock.petListing.findMany.mockResolvedValue([row] as never);
      prismaMock.petListing.count.mockResolvedValue(1);

      const result = await repository.findMany({
        ...baseFilters,
        type: 'LOST',
        species: 'DOG',
        city: 'São Paulo',
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(prismaMock.petListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            type: 'LOST',
            species: 'DOG',
            city: 'São Paulo',
          },
          skip: 0,
          take: 20,
          include: { photos: true },
        }),
      );
      expect(prismaMock.petListing.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            type: 'LOST',
            species: 'DOG',
            city: 'São Paulo',
          },
        }),
      );
    });

    it('omits optional filters from the where clause when not provided', async () => {
      prismaMock.petListing.findMany.mockResolvedValue([] as never);
      prismaMock.petListing.count.mockResolvedValue(0);

      await repository.findMany(baseFilters);

      expect(prismaMock.petListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, status: 'ACTIVE' } }),
      );
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('runs a raw Haversine-distance query when lat/lng/radiusKm are given, still applying deletedAt/status/type filters by hand', async () => {
      const row = makeRow();
      prismaMock.$queryRaw
        .mockResolvedValueOnce([{ ...row, distance: 1.2 }] as never)
        .mockResolvedValueOnce([{ total: 1 }] as never);
      prismaMock.petPhoto.findMany.mockResolvedValue([] as never);

      const result = await repository.findMany({
        ...baseFilters,
        type: 'LOST',
        lat: -23.5,
        lng: -46.6,
        radiusKm: 10,
      });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(row.id);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      const [dataQueryArg] = vi.mocked(prismaMock.$queryRaw).mock.calls[0];
      const dataQuery = dataQueryArg as unknown as { sql: string; values: unknown[] };
      // A fórmula/nomes de coluna ficam fixos no template (nunca interpolados
      // como valor) — só lat/lng/radiusKm/status/type entram como parâmetro
      // (`.values`), o que é o que evita SQL injection nesta query.
      expect(dataQuery.sql.toLowerCase()).toContain('acos');
      expect(dataQuery.sql.toLowerCase()).toContain('deletedat');
      expect(dataQuery.values).toEqual(
        expect.arrayContaining([-23.5, -46.6, 10, 'ACTIVE', 'LOST']),
      );

      expect(prismaMock.petPhoto.findMany).toHaveBeenCalledWith({
        where: { listingId: { in: [row.id] } },
      });
    });

    it('returns an empty list without querying photos when the radius search matches nothing', async () => {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ total: 0 }] as never);

      const result = await repository.findMany({
        ...baseFilters,
        lat: -23.5,
        lng: -46.6,
        radiusKm: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(prismaMock.petPhoto.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the listing when found and not soft-deleted', async () => {
      const id = randomUUID();
      const createdAt = new Date();
      prismaMock.petListing.findFirst.mockResolvedValue({
        id,
        type: 'LOST',
        title: 'Cachorro perdido',
        description: 'Golden retriever, atende por Rex',
        species: 'DOG',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [],
      } as never);

      const listing = await repository.getById(id);

      expect(listing.id).toBe(id);
      expect(prismaMock.petListing.findFirst).toHaveBeenCalledWith({
        where: { id, deletedAt: null },
        include: { photos: true },
      });
    });

    it('throws NotFoundError when the listing does not exist or was soft-deleted', async () => {
      prismaMock.petListing.findFirst.mockResolvedValue(null);

      await expect(repository.getById(randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates only the given fields and returns the updated listing', async () => {
      const id = randomUUID();
      const createdAt = new Date();
      prismaMock.petListing.update.mockResolvedValue({
        id,
        type: 'LOST',
        title: 'Novo título',
        description: 'Golden retriever, atende por Rex',
        species: 'DOG',
        latitude: -23.55052,
        longitude: -46.633308,
        city: 'São Paulo',
        status: 'ACTIVE',
        ownerId,
        createdAt,
        updatedAt: createdAt,
        photos: [],
      } as never);

      const listing = await repository.update(id, { title: 'Novo título' });

      expect(listing.title).toBe('Novo título');
      expect(prismaMock.petListing.update).toHaveBeenCalledWith({
        where: { id },
        data: { title: 'Novo título' },
        include: { photos: true },
      });
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt on the listing', async () => {
      const id = randomUUID();
      prismaMock.petListing.update.mockResolvedValue({} as never);

      await repository.softDelete(id);

      expect(prismaMock.petListing.update).toHaveBeenCalledWith({
        where: { id },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
