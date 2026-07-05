import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { submitPetListingUsecase } from '../../usecases/submit-pet-listing.usecase.js';
import { submitPetListingBodySchema, submitPetListingResponseSchema } from './pets.schema.js';
import type { RawPetPhotoUploadDto } from './pets.dto.js';

// Campos de texto esperados no multipart, além dos arquivos de foto — mesmo
// nome usado em submitPetListingBodySchema.
const TEXT_FIELDS = ['type', 'title', 'description', 'species', 'latitude', 'longitude', 'city'] as const;

export async function petsModule(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
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
}
