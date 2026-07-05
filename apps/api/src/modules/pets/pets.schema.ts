import { z } from 'zod';
import { PetListingStatusSchema, PetListingTypeSchema } from './pets.enum.js';

// Dado vindo do usecase de criação de anúncio — ainda sem as fotos
// processadas (upload/thumbnail/storage é escopo de uma task futura, ver
// PLAN.md fase 2). `ownerId` já resolvido (usuário autenticado).
export const createPetListingInputSchema = z.object({
  type: PetListingTypeSchema.describe('Tipo do anúncio: perdido, achado ou doação'),
  title: z.string().min(1).describe('Título do anúncio'),
  description: z.string().min(1).describe('Descrição do anúncio'),
  species: z.string().min(1).describe('Espécie do pet, texto livre (ex: cachorro, gato)'),
  latitude: z.number().describe('Latitude do local do anúncio'),
  longitude: z.number().describe('Longitude do local do anúncio'),
  city: z.string().min(1).describe('Cidade do anúncio'),
  ownerId: z.string().uuid().describe('Id do usuário dono do anúncio'),
});

// Shape de uma foto já processada (upload/thumbnail/storage feitos), pronta
// para ser persistida junto do anúncio pelo repository.
export const petPhotoInputSchema = z.object({
  storageKey: z.string().min(1).describe('Chave/path da foto no storage gateway'),
  url: z.string().min(1).describe('URL pública da foto'),
  order: z.number().int().nonnegative().describe('Ordem de exibição da foto'),
});

// Foto ainda crua, extraída do multipart pela rota (buffer + content-type),
// antes de validação/thumbnail/storage — é o que o service de submissão
// recebe para processar. Não é um schema de wire (nunca trafega como JSON,
// buffer não é serializável), mas segue a mesma convenção de derivar todo DTO
// de um schema Zod (ver skill dto), inclusive para shapes internas.
export const rawPetPhotoUploadSchema = z.object({
  buffer: z.instanceof(Buffer),
  contentType: z.string().min(1),
});

// Input completo do service PetsService.submitListingForRegistration: os
// campos de texto já validados (mesmo shape do input de criação, com
// `ownerId` resolvido da sessão) + as fotos ainda cruas.
export const submitListingForRegistrationInputSchema = createPetListingInputSchema.extend({
  photos: z.array(rawPetPhotoUploadSchema),
});

// Dado que o repository recebe para persistir um `PetListing` + suas
// `PetPhoto[]` numa única transação — é o que o futuro worker consumidor da
// fila monta depois de processar o upload das fotos.
export const createPetListingSchema = createPetListingInputSchema.extend({
  photos: z.array(petPhotoInputSchema).describe('Fotos já processadas do anúncio'),
});

// Campos de texto do POST /api/pets — mesmo shape de createPetListingInputSchema
// sem `ownerId`, já que o dono vem da sessão autenticada (request.user.id),
// nunca do corpo da requisição.
export const submitPetListingBodySchema = createPetListingInputSchema.omit({ ownerId: true });

// Resposta da rota de submissão: o anúncio ainda não foi persistido (desenho
// enqueue-then-persist, ver PLAN.md fase 2 — quem persiste de fato é o
// poller/worker consumidor da fila, tarefa separada), então não há um
// PetListingDto completo pra devolver aqui. Corpo mínimo confirmando que a
// submissão foi aceita e publicada na fila.
export const submitPetListingResponseSchema = z.object({
  received: z.boolean(),
});

// Shape de uma foto como persistida/retornada pelo repository.
export const petPhotoSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  storageKey: z.string(),
  url: z.string(),
  order: z.number().int(),
  createdAt: z.date(),
});

// Shape seguro de um anúncio para retorno da API — inclui suas fotos.
export const petListingSchema = z.object({
  id: z.string().uuid(),
  type: PetListingTypeSchema,
  title: z.string(),
  description: z.string(),
  species: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  city: z.string(),
  status: PetListingStatusSchema,
  ownerId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  photos: z.array(petPhotoSchema),
});
