import { ReportStatus } from '@prisma/client';
import { z } from 'zod';

// Reaproveita o enum já declarado em schema.prisma (fonte da verdade, pois é
// uma coluna persistida) — mesma convenção de pets.enum.ts/role.enum.ts (a
// exceção consciente documentada na skill `enum`, escopada só a tipos de
// enum). Qualquer schema/DTO que precisar do status de uma denúncia importa
// daqui, nunca direto de @prisma/client.
export { ReportStatus };
export const ReportStatusSchema = z.nativeEnum(ReportStatus);
