import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/db/prisma.js';
import { NotFoundError } from '../../infra/errors/app-error.js';
import type {
  ListPetsQueryDto,
  CreatePetListingDto,
  PetListingDto,
  PetPhotoDto,
  UpdatePetBodyDto,
} from './pets.dto.js';

// Shape de uma linha de pet_listings como o SQL bruto de findManyByRadius
// devolve — mesmos campos de PetListingDto, mas sem `photos` (SQL bruto não
// resolve a relation) e com o campo calculado `distance`.
type PetListingRadiusRow = Omit<PetListingDto, 'photos'> & { distance: number };

export class PetsRepository {
  // Persiste o `PetListing` e suas `PetPhoto[]` numa única transação — é o
  // método que o service (e, por trás dele, o futuro worker consumidor da
  // fila de cadastro) chama para persistir de fato um anúncio já validado,
  // com as fotos já processadas (upload/thumbnail/storage feitos antes
  // disso, fora do escopo desta task).
  async create(data: CreatePetListingDto): Promise<PetListingDto> {
    return prisma.$transaction((tx) =>
      tx.petListing.create({
        data: {
          type: data.type,
          title: data.title,
          description: data.description,
          species: data.species,
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          ownerId: data.ownerId,
          photos: {
            create: data.photos.map((photo) => ({
              storageKey: photo.storageKey,
              url: photo.url,
              order: photo.order,
            })),
          },
        },
        include: { photos: true },
      }),
    );
  }

  // GET /api/pets. Sem busca por raio, o Prisma query builder já cobre tudo
  // (where/skip/take); com raio, delega pra findManyByRadius — a fórmula de
  // distância não é expressável no query builder, então essa é a única query
  // raw deste repository (ver a própria findManyByRadius para o porquê disso
  // ser seguro contra SQL injection).
  async findMany(filters: ListPetsQueryDto): Promise<{ data: PetListingDto[]; total: number }> {
    const { lat, lng, radiusKm } = filters;
    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      return this.findManyByRadius({ ...filters, lat, lng, radiusKm });
    }
    return this.findManyByFilters(filters);
  }

  private async findManyByFilters(
    filters: ListPetsQueryDto,
  ): Promise<{ data: PetListingDto[]; total: number }> {
    const where: Prisma.PetListingWhereInput = {
      deletedAt: null,
      status: filters.status,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.species ? { species: filters.species } : {}),
      ...(filters.city ? { city: filters.city } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.petListing.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: { photos: true },
      }),
      prisma.petListing.count({ where }),
    ]);

    return { data, total };
  }

  // Busca por raio: fórmula de Haversine em SQL bruto (`Prisma.sql`), porque
  // distância geográfica não é expressável no query builder do Prisma — a
  // única query raw deste repository. Nomes de coluna e a fórmula em si ficam
  // fixos no template (nunca interpolados como valor); só lat/lng/radiusKm e
  // os valores de filtro entram via placeholder parametrizado do
  // `Prisma.sql`, o que evita SQL injection. `"deletedAt" IS NULL` é
  // reaplicado manualmente aqui porque SQL bruto não herda o filtro do query
  // builder (diferente de findManyByFilters acima).
  private async findManyByRadius(
    filters: Omit<ListPetsQueryDto, 'lat' | 'lng' | 'radiusKm'> & {
      lat: number;
      lng: number;
      radiusKm: number;
    },
  ): Promise<{ data: PetListingDto[]; total: number }> {
    const { type, species, city, status, lat, lng, radiusKm, offset, limit } = filters;

    const conditions = [
      Prisma.sql`"deletedAt" IS NULL`,
      Prisma.sql`status = ${status}::"PetListingStatus"`,
    ];
    if (type) conditions.push(Prisma.sql`type = ${type}::"PetListingType"`);
    if (species) conditions.push(Prisma.sql`species = ${species}`);
    if (city) conditions.push(Prisma.sql`city = ${city}`);
    const whereSql = Prisma.join(conditions, ' AND ');

    // Distância em km entre (lat, lng) e cada linha — `least(1, ...)` protege
    // contra erro de arredondamento levando o argumento de `acos` levemente
    // acima de 1 (o que faria `acos` retornar NaN) pra pontos muito próximos.
    const distanceSql = Prisma.sql`(6371 * acos(least(1, cos(radians(${lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(latitude)))))`;

    const rows = await prisma.$queryRaw<PetListingRadiusRow[]>(Prisma.sql`
      SELECT id, type, title, description, species, latitude, longitude, city, status,
        "ownerId", "createdAt", "updatedAt", ${distanceSql} AS distance
      FROM pet_listings
      WHERE ${whereSql} AND ${distanceSql} <= ${radiusKm}
      ORDER BY distance ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM pet_listings
      WHERE ${whereSql} AND ${distanceSql} <= ${radiusKm}
    `);
    const total = totalRows[0]?.total ?? 0n;
    // Nota: total vem de uma segunda query, não de uma window function junto
    // da primeira — uma pequena janela de inconsistência entre as duas é
    // aceita conscientemente aqui, dado o volume de dados deste projeto;
    // revisar se isso virar um problema real.

    if (rows.length === 0) return { data: [], total: Number(total) };

    const photos = await prisma.petPhoto.findMany({
      where: { listingId: { in: rows.map((row) => row.id) } },
    });
    const photosByListing = new Map<string, PetPhotoDto[]>();
    for (const photo of photos) {
      const list = photosByListing.get(photo.listingId) ?? [];
      list.push(photo);
      photosByListing.set(photo.listingId, list);
    }

    const data = rows.map(({ distance: _distance, ...row }) => ({
      ...row,
      photos: photosByListing.get(row.id) ?? [],
    }));

    return { data, total: Number(total) };
  }

  async getById(id: string): Promise<PetListingDto> {
    const listing = await prisma.petListing.findFirst({
      where: { id, deletedAt: null },
      include: { photos: true },
    });
    if (!listing) throw new NotFoundError('Anúncio');
    return listing;
  }

  async update(id: string, data: UpdatePetBodyDto): Promise<PetListingDto> {
    return prisma.petListing.update({
      where: { id },
      // Monta o objeto só com as chaves de fato presentes — `data` (vindo de
      // um schema Zod com campos `.optional()`) tipa ausência como `T |
      // undefined`, e o `exactOptionalPropertyTypes` do tsconfig distingue
      // isso de "chave ausente", que é o que o Prisma espera pra update
      // parcial.
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.species !== undefined ? { species: data.species } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { photos: true },
    });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.petListing.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
