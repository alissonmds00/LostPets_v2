import { z } from 'zod';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { submitPetListingUsecase } from './submit-pet-listing.usecase.js';
import { listPetsUsecase } from './list-pets.usecase.js';
import { getPetUsecase } from './get-pet.usecase.js';
import { updatePetUsecase } from './update-pet.usecase.js';
import { deletePetUsecase } from './delete-pet.usecase.js';
import {
  getPetParamsSchema,
  listPetsQuerySchema,
  petListingListResponseSchema,
  petListingSchema,
  submitPetListingBodySchema,
  submitPetListingResponseSchema,
  updatePetBodySchema,
} from './pets.schema.js';
import type { RawPetPhotoUploadDto } from './pets.dto.js';

// Campos de texto esperados no multipart, além dos arquivos de foto — mesmo
// nome usado em submitPetListingBodySchema.
const TEXT_FIELDS = [
  'type',
  'title',
  'description',
  'species',
  'latitude',
  'longitude',
  'city',
] as const;

export async function petsPlugin(app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      // ownerId vem da sessão autenticada (request.user.id), nunca do body —
      // ver auth-middleware skill.
      preHandler: app.requireAuth,
      schema: {
        summary: 'Submete um novo anúncio de pet para cadastro',
        description:
          'Aceita multipart/form-data com os campos de texto do anúncio e uma ou mais fotos. Valida os dados, processa as fotos (gera thumbnail) e publica o cadastro numa fila — não persiste diretamente no Postgres (desenho enqueue-then-persist, ver PLAN.md fase 2). Um consumidor separado da fila persiste o anúncio depois. Responde 202 confirmando que a submissão foi aceita.',
        tags: ['pets'],
        consumes: ['multipart/form-data'],
        response: { 202: submitPetListingResponseSchema },
      },
    },
    async (request, reply) => {
      const textValues: Record<string, string> = {};
      const photos: RawPetPhotoUploadDto[] = [];

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          photos.push({ buffer, contentType: part.mimetype });
        } else {
          textValues[part.fieldname] = String(part.value);
        }
      }

      const rawBody: Record<string, unknown> = {};
      for (const field of TEXT_FIELDS) {
        if (field === 'latitude' || field === 'longitude') {
          rawBody[field] = textValues[field] !== undefined ? Number(textValues[field]) : undefined;
        } else {
          rawBody[field] = textValues[field];
        }
      }

      const body = submitPetListingBodySchema.parse(rawBody);

      await submitPetListingUsecase(app.petsService, {
        ...body,
        ownerId: request.user!.id,
        photos,
      });

      reply.status(202).send({ received: true });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      // Rota pública — ver anúncios abertos não exige sessão.
      schema: {
        summary: 'Lista anúncios de pets',
        description:
          'Lista paginada (offset/limit, default 20, máximo 100). Sem filtro de status, retorna só anúncios ACTIVE. Aceita filtros por type/species/city e busca por raio (lat, lng, radiusKm — os três juntos ou nenhum, 400 caso contrário).',
        tags: ['pets'],
        querystring: listPetsQuerySchema,
        response: { 200: petListingListResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await listPetsUsecase(app.petsService, request.query);
      reply.send(result);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        summary: 'Busca um anúncio de pet pelo id',
        description: 'Retorna 404 se o anúncio não existir ou tiver sido removido (soft delete).',
        tags: ['pets'],
        params: getPetParamsSchema,
        response: { 200: petListingSchema },
      },
    },
    async (request, reply) => {
      const listing = await getPetUsecase(app.petsService, request.params.id);
      reply.send(listing);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/:id',
    {
      // Só o dono pode editar — ver PetsService.updateListing. requesterId
      // vem da sessão (request.user.id), nunca do body.
      preHandler: app.requireAuth,
      schema: {
        summary: 'Atualiza um anúncio de pet',
        description:
          'Só o dono do anúncio pode editar. Retorna 403 se o requisitante não for o dono, 404 se não existir.',
        tags: ['pets'],
        params: getPetParamsSchema,
        body: updatePetBodySchema,
        response: { 200: petListingSchema },
      },
    },
    async (request, reply) => {
      const listing = await updatePetUsecase(app.petsService, {
        id: request.params.id,
        requesterId: request.user!.id,
        requesterRole: request.user!.role,
        ...request.body,
      });
      reply.send(listing);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      // Dono ou admin — ver PetsService.deleteListing.
      preHandler: app.requireAuth,
      schema: {
        summary: 'Remove (soft delete) um anúncio de pet',
        description:
          'O dono do anúncio ou um admin podem remover. Fotos permanecem no storage. Retorna 403 se o requisitante não for dono nem admin, 404 se não existir.',
        tags: ['pets'],
        params: getPetParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await deletePetUsecase(app.petsService, {
        id: request.params.id,
        requesterId: request.user!.id,
        requesterRole: request.user!.role,
      });
      reply.status(204).send(null);
    },
  );
}
