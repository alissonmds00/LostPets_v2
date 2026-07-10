import type { ModerationService } from '../../modules/moderation/moderation.service.js';
import type { PetsService } from '../../modules/pets/pets.service.js';
import type { ReportDto, ResolveReportInputDto } from '../../modules/moderation/moderation.dto.js';

// Orquestra `moderation` + `pets` — mora em shared/usecases/ (não dentro de
// um módulo só) porque cruza fronteira de módulo, ver skill usecase.
// `ModerationService` nunca chama `PetsService` direto; é este usecase que
// decide, depois de resolver a denúncia, se também remove o anúncio.
//
// Reusa o `DELETE /api/pets/:id` já existente (`PetsService.deleteListing`,
// soft delete via `deletedAt`) em vez de um método `deactivateListing`
// separado — decisão do usuário em 2026-07-09: como a rota de resolve exige
// `requireRole('ADMIN')`, `requesterRole: 'ADMIN'` sempre passa na checagem
// dono-ou-admin de `deleteListing`, então não há necessidade de um segundo
// mecanismo de remoção (`status: CANCELLED`) só pra moderação.
export async function resolveReportUsecase(
  moderationService: ModerationService,
  petsService: PetsService,
  input: ResolveReportInputDto,
): Promise<ReportDto> {
  const report = await moderationService.resolveReport(input.reportId, input.outcome);

  if (input.outcome === 'REVIEWED_REMOVED') {
    await petsService.deleteListing({
      id: report.listingId,
      requesterId: input.requesterId,
      requesterRole: input.requesterRole,
    });
  }

  return report;
}
