import { prisma } from '../../infra/db/prisma.js';
import type { CreatePetListingDto, PetListingDto } from './pets.dto.js';

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
}
