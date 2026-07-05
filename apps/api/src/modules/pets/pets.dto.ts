import type { z } from 'zod';
import type {
  createPetListingInputSchema,
  createPetListingSchema,
  petListingSchema,
  petPhotoInputSchema,
  petPhotoSchema,
} from './pets.schema.js';

// Dado vindo do usecase de criação de anúncio, sem as fotos já processadas
// (upload/thumbnail/storage acontece antes do repository ser chamado — ver
// PLAN.md fase 2, escopo de uma task futura).
export type CreatePetListingInputDto = z.infer<typeof createPetListingInputSchema>;

// Shape de uma foto já processada, pronta para ser persistida.
export type PetPhotoInputDto = z.infer<typeof petPhotoInputSchema>;

// Dado que o repository recebe para persistir um `PetListing` + suas
// `PetPhoto[]` numa única transação.
export type CreatePetListingDto = z.infer<typeof createPetListingSchema>;

// Shape de uma foto como persistida/retornada pelo repository.
export type PetPhotoDto = z.infer<typeof petPhotoSchema>;

// Shape seguro de um anúncio para retorno da API — inclui suas fotos.
export type PetListingDto = z.infer<typeof petListingSchema>;
