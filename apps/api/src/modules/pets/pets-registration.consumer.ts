import type { FastifyBaseLogger } from 'fastify';
import { createPetListingSchema } from './pets.schema.js';
import type { PetsRegistrationQueueGatewayService } from '../../gateways/pets-registration-queue.gateway.service.js';
import type { PetsService } from './pets.service.js';

// Consumidor em background da fila SQS pets-registration, rodando dentro do
// próprio processo do apps/api (sem apps/worker separado — ver PLAN.md/
// ARCHITECTURE.md "Pontos em aberto"). Fica dentro do módulo pets, não em
// infra/, porque o parsing/validação abaixo é lógica de negócio específica
// de pets (ver skill infra-placement) — só a mecânica do SQS em si é
// plumbing técnico genérico, e essa fica encapsulada dentro do gateway.
export function startPetsRegistrationConsumer(
  queueGateway: PetsRegistrationQueueGatewayService,
  petsService: PetsService,
  logger: FastifyBaseLogger,
): { stop: () => void } {
  queueGateway.startConsuming(
    async (body) => {
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch (error) {
        logger.error({ error }, 'Discarding pets-registration message with malformed JSON body');
        throw error;
      }

      const result = createPetListingSchema.safeParse(parsedBody);
      if (!result.success) {
        logger.error(
          { error: result.error },
          'Discarding pets-registration message that failed schema validation',
        );
        throw result.error;
      }

      try {
        await petsService.registerListing(result.data);
      } catch (error) {
        logger.error(
          { error },
          'Failed to register pet listing from queue message; leaving it for redelivery',
        );
        throw error;
      }
    },
    (error) => {
      logger.error(error, 'Failed to receive messages from the pets-registration queue');
    },
  );

  return {
    stop: () => queueGateway.stopConsuming(),
  };
}
