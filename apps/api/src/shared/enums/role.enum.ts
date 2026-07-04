import { Role } from '@prisma/client';
import { z } from 'zod';

// Reaproveita o enum já declarado em schema.prisma (fonte da verdade, pois é
// uma coluna persistida) em vez de duplicar os mesmos valores aqui. Este é o
// único arquivo fora do repository que importa de @prisma/client — a exceção
// consciente documentada na skill `enum`, escopada só a tipos de enum.
// Qualquer schema/DTO que precisar do papel do usuário importa `Role` e
// `RoleSchema` daqui, nunca direto de @prisma/client.
export { Role };
export const RoleSchema = z.nativeEnum(Role);
