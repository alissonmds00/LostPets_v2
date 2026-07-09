import type { FastifyBaseLogger } from 'fastify';
import { createPetListingSchema } from './pets.schema.js';
import type { PetsRegistrationQueueGatewayService } from '../../gateways/pets-registration-queue.gateway.service.js';
import type { PetsService } from './pets.service.js';

// Background consumer for the pets-registration SQS queue, running inside
// apps/api's own process (no separate apps/worker — see PLAN.md/
// ARCHITECTURE.md "Pontos em aberto"). Lives inside the pets module, not
// infra/, because the parsing/validation below is pets-specific business
// logic (see skill infra-placement) — only the SQS mechanics themselves are
// generic technical plumbing, and those stay wrapped inside the gateway.
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
