import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { PetsRepository } from './pets.repository.js';
import { InvalidPetPhotoError } from './pets.errors.js';
import type {
  CreatePetListingDto,
  DeletePetListingInputDto,
  ListPetsQueryDto,
  PetListingDto,
  PetListingListDto,
  PetPhotoInputDto,
  SubmitListingForRegistrationInputDto,
  UpdatePetListingInputDto,
} from './pets.dto.js';
import type { StorageGateway } from '../../gateways/storage.gateway.service.js';
import type { PetsRegistrationQueueGatewayService } from '../../gateways/pets-registration-queue.gateway.service.js';
import { ForbiddenError } from '../../infra/errors/app-error.js';
import { Role } from '../../shared/enums/role.enum.js';

// Tipos de imagem aceitos para foto de anúncio — qualquer outro é rejeitado
// com InvalidPetPhotoError. Rejeitar em vez de tentar converter mantém a
// regra simples e explícita (YAGNI: sem suporte a formatos exóticos agora).
const ALLOWED_PHOTO_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Limite por foto, escolhido como um valor razoável para foto de celular sem
// abrir uma env var nova para isso (YAGNI — não há necessidade real de tornar
// isso configurável ainda).
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

// Thumbnail: largura máxima mantendo aspect ratio (sharp não aumenta a
// imagem além do tamanho original por padrão, então uma foto menor que isso
// simplesmente não é ampliada).
const THUMBNAIL_MAX_WIDTH = 800;

export class PetsService {
  // Repository/gateways injected via constructor — instances built once in
  // app.ts and decorated onto the root Fastify instance (see the
  // dependency-injection skill); the service never instantiates its own.
  constructor(
    private readonly repository: PetsRepository,
    private readonly storageGateway: StorageGateway,
    private readonly queueGateway: PetsRegistrationQueueGatewayService,
  ) {}

  // Delegates straight to the repository — this is the method the worker
  // consumer (separate task) calls after pulling a registration off the
  // queue, to actually persist the listing. No business rule beyond
  // persistence here (validation/processing already happened before
  // enqueueing, in submitListingForRegistration below).
  async registerListing(input: CreatePetListingDto): Promise<PetListingDto> {
    return this.repository.create(input);
  }

  // Rota POST /api/pets chama isto através do usecase. Segue o desenho
  // enqueue-then-persist (ver PLAN.md fase 2): valida e processa as fotos,
  // monta o CreatePetListingDto completo, e publica na fila — nunca chama o
  // repository (quem persiste de fato é registerListing, chamado pelo
  // worker/poller consumidor da fila, tarefa separada).
  async submitListingForRegistration(input: SubmitListingForRegistrationInputDto): Promise<void> {
    const { photos: rawPhotos, ...listingInput } = input;

    const processedPhotos: PetPhotoInputDto[] = [];
    for (const [index, photo] of rawPhotos.entries()) {
      this.assertValidPhoto(photo);

      const thumbnail = await sharp(photo.buffer)
        .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
        .toBuffer();

      const storageKey = `listings/${listingInput.ownerId}/${randomUUID()}`;
      const savedKey = await this.storageGateway.save(storageKey, thumbnail, photo.contentType);
      const url = await this.storageGateway.getUrl(savedKey);

      processedPhotos.push({ storageKey: savedKey, url, order: index });
    }

    const createPetListingDto: CreatePetListingDto = {
      ...listingInput,
      photos: processedPhotos,
    };

    await this.queueGateway.enqueue(JSON.stringify(createPetListingDto));
  }

  // GET /api/pets — sem regra de negócio além de delegar ao repository e
  // montar o envelope de paginação (o repository já devolve total/data).
  async listListings(filters: ListPetsQueryDto): Promise<PetListingListDto> {
    const { data, total } = await this.repository.findMany(filters);
    return { data, pagination: { total, offset: filters.offset, limit: filters.limit } };
  }

  // GET /api/pets/:id — repository já lança NotFoundError se não existir ou
  // estiver soft-deletado, nada a checar aqui.
  async getListing(id: string): Promise<PetListingDto> {
    return this.repository.getById(id);
  }

  // PATCH /api/pets/:id — só o dono pode editar (nem admin, diferente de
  // delete: editar o texto de um anúncio alheio não é uma ação de moderação).
  async updateListing(input: UpdatePetListingInputDto): Promise<PetListingDto> {
    const { id, requesterId, title, description, species, status } = input;
    const listing = await this.repository.getById(id);
    if (listing.ownerId !== requesterId) throw new ForbiddenError();
    return this.repository.update(id, { title, description, species, status });
  }

  // DELETE /api/pets/:id — dono OU admin (admin cobre o caso de moderação
  // remover um anúncio de outra pessoa). Soft delete via `deletedAt`; as
  // fotos permanecem no storage (decisão do usuário — preserva evidência
  // pra revisão de moderação de um anúncio já removido).
  async deleteListing(input: DeletePetListingInputDto): Promise<void> {
    const { id, requesterId, requesterRole } = input;
    const listing = await this.repository.getById(id);
    if (listing.ownerId !== requesterId && requesterRole !== Role.ADMIN) throw new ForbiddenError();
    await this.repository.softDelete(id);
  }

  private assertValidPhoto(photo: { buffer: Buffer; contentType: string }): void {
    if (!ALLOWED_PHOTO_CONTENT_TYPES.has(photo.contentType)) {
      throw new InvalidPetPhotoError(
        `Tipo de arquivo não suportado: ${photo.contentType}. Envie uma foto jpeg, png ou webp.`,
      );
    }
    if (photo.buffer.byteLength > MAX_PHOTO_SIZE_BYTES) {
      throw new InvalidPetPhotoError(
        `Foto excede o tamanho máximo permitido de ${MAX_PHOTO_SIZE_BYTES / (1024 * 1024)}MB.`,
      );
    }
  }
}
