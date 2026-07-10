import type { PetsService } from '../../modules/pets/pets.service.js';
import type { MessagingService } from '../../modules/messaging/messaging.service.js';
import type { CreateMessageDto, MessageDto } from '../../modules/messaging/messaging.dto.js';
import { ForbiddenError } from '../../infra/errors/app-error.js';

// Orquestra `pets` + `messaging` — mora em shared/usecases/ (não dentro de
// um módulo só) porque cruza fronteira de módulo, ver skill usecase. Regra:
// só é possível trocar mensagem sobre um anúncio se um dos dois lados
// (remetente ou destinatário) for o dono do anúncio — não dá pra dois
// usuários quaisquer conversarem "em nome" de um anúncio de terceiros.
// `petsService.getListing` já lança NotFoundError se o anúncio não existir
// ou estiver soft-deletado, propagada sem tratamento especial aqui.
export async function sendMessageUsecase(
  petsService: PetsService,
  messagingService: MessagingService,
  input: CreateMessageDto,
): Promise<MessageDto> {
  const listing = await petsService.getListing(input.listingId);
  if (input.senderId !== listing.ownerId && input.receiverId !== listing.ownerId) {
    throw new ForbiddenError('Só é possível trocar mensagens com o dono do anúncio');
  }
  return messagingService.sendMessage(input);
}
