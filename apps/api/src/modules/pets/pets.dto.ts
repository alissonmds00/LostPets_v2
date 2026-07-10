import type { z } from 'zod';
import type {
  createPetListingInputSchema,
  createPetListingSchema,
  deletePetListingInputSchema,
  getPetParamsSchema,
  listPetsQuerySchema,
  petListingListResponseSchema,
  petListingSchema,
  petPhotoInputSchema,
  petPhotoSchema,
  rawPetPhotoUploadSchema,
  submitListingForRegistrationInputSchema,
  submitPetListingBodySchema,
  submitPetListingResponseSchema,
  updatePetBodySchema,
  updatePetListingInputSchema,
} from './pets.schema.js';

export type CreatePetListingInputDto = z.infer<typeof createPetListingInputSchema>;

export type PetPhotoInputDto = z.infer<typeof petPhotoInputSchema>;

export type CreatePetListingDto = z.infer<typeof createPetListingSchema>;

export type PetPhotoDto = z.infer<typeof petPhotoSchema>;

export type PetListingDto = z.infer<typeof petListingSchema>;

export type RawPetPhotoUploadDto = z.infer<typeof rawPetPhotoUploadSchema>;

export type SubmitListingForRegistrationInputDto = z.infer<
  typeof submitListingForRegistrationInputSchema
>;

export type SubmitPetListingBodyDto = z.infer<typeof submitPetListingBodySchema>;

export type SubmitPetListingResponseDto = z.infer<typeof submitPetListingResponseSchema>;

export type ListPetsQueryDto = z.infer<typeof listPetsQuerySchema>;

export type PetListingListDto = z.infer<typeof petListingListResponseSchema>;

export type GetPetParamsDto = z.infer<typeof getPetParamsSchema>;

export type UpdatePetBodyDto = z.infer<typeof updatePetBodySchema>;

export type UpdatePetListingInputDto = z.infer<typeof updatePetListingInputSchema>;

export type DeletePetListingInputDto = z.infer<typeof deletePetListingInputSchema>;
