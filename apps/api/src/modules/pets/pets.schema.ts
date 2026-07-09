import { z } from 'zod';
import { PetListingStatus, PetListingStatusSchema, PetListingTypeSchema } from './pets.enum.js';
import { RoleSchema } from '../../shared/enums/role.enum.js';

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

// ---------------------------------------------------------------------------
// list/detail/update/delete (PLAN.md fase 2, continuação de submit/registerListing)
// ---------------------------------------------------------------------------

// Query de GET /api/pets. Paginação offset/limit (default 20, máx 100),
// filtros por type/species/city, e busca por raio (lat/lng/radiusKm) — os
// três precisam vir juntos ou nenhum, ver o `.refine` abaixo (decidido com o
// usuário: uma busca por raio parcial é erro 400, não um filtro ignorado em
// silêncio). Sem filtro de status explícito, só anúncios ACTIVE voltam —
// decisão do usuário, combina com o caso de uso público de "ver anúncios
// abertos"; passar `status` explicitamente busca outro status.
export const listPetsQuerySchema = z
  .object({
    type: PetListingTypeSchema.optional().describe('Filtra por tipo do anúncio'),
    species: z.string().min(1).optional().describe('Filtra por espécie (texto livre)'),
    city: z.string().min(1).optional().describe('Filtra por cidade'),
    status: PetListingStatusSchema.optional()
      .default(PetListingStatus.ACTIVE)
      .describe('Filtra por status; sem esse parâmetro, só retorna anúncios ACTIVE'),
    lat: z.coerce.number().optional().describe('Latitude do centro da busca por raio'),
    lng: z.coerce.number().optional().describe('Longitude do centro da busca por raio'),
    radiusKm: z.coerce.number().positive().optional().describe('Raio da busca, em km'),
    offset: z.coerce.number().int().nonnegative().default(0).describe('Deslocamento da paginação'),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .default(20)
      .describe('Tamanho da página (máximo 100)'),
  })
  .refine(
    (query) => {
      const providedCount = [query.lat, query.lng, query.radiusKm].filter(
        (v) => v !== undefined,
      ).length;
      return providedCount === 0 || providedCount === 3;
    },
    {
      message: 'lat, lng e radiusKm devem ser informados juntos, ou nenhum dos três',
      path: ['radiusKm'],
    },
  );

export const petListingListResponseSchema = z.object({
  data: z.array(petListingSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  }),
});

export const getPetParamsSchema = z.object({
  id: z.string().uuid(),
});

// Body de PATCH /api/pets/:id — sem type/latitude/longitude/city: o local e o
// tipo do anúncio não são editáveis depois de criado (recriar é a operação
// esperada se algum desses estiver errado), só o texto e o status.
export const updatePetBodySchema = z.object({
  title: z.string().min(1).optional().describe('Novo título do anúncio'),
  description: z.string().min(1).optional().describe('Nova descrição do anúncio'),
  species: z.string().min(1).optional().describe('Nova espécie do pet'),
  status: PetListingStatusSchema.optional().describe('Novo status do anúncio'),
});

// Input completo do service PetsService.updateListing — body validado +
// quem está pedindo a alteração (pra checar posse) — ver skill dto: até
// shapes internas derivam de um schema Zod.
export const updatePetListingInputSchema = updatePetBodySchema.extend({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: RoleSchema,
});

// Input completo do service PetsService.deleteListing — mesmo raciocínio.
export const deletePetListingInputSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterRole: RoleSchema,
});
