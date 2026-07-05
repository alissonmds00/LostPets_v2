import { PetListingStatus, PetListingType } from '@prisma/client';
import { z } from 'zod';

// Reaproveita os enums já declarados em schema.prisma (fonte da verdade, pois
// são colunas persistidas) em vez de duplicar os mesmos valores aqui. Este é
// o único arquivo do módulo `pets` que importa de @prisma/client — a exceção
// consciente documentada na skill `enum`, escopada só a tipos de enum.
// Qualquer schema/DTO que precisar do tipo ou status de um anúncio importa
// daqui, nunca direto de @prisma/client.
export { PetListingType, PetListingStatus };
export const PetListingTypeSchema = z.nativeEnum(PetListingType);
export const PetListingStatusSchema = z.nativeEnum(PetListingStatus);
