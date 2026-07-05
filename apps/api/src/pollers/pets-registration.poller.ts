import type { FastifyBaseLogger } from 'fastify';
import { createPetListingSchema } from '../modules/pets/pets.schema.js';
import type { PetsRegistrationQueueGatewayService } from '../gateways/pets-registration-queue.gateway.service.js';
import type { PetsService } from '../modules/pets/pets.service.js';

// Background consumer for the pets-registration SQS queue, running inside
// apps/api's own process (no separate apps/worker — decided consciously, see
// PLAN.md/ARCHITECTURE.md "Pontos em aberto"). Not a route, not a module's
// business logic — infra for async processing, hence its own top-level
// src/pollers/ directory.
export function startPetsRegistrationPoller(
  queueGateway: PetsRegistrationQueueGatewayService,
  petsService: PetsService,
  logger: FastifyBaseLogger,
): { stop: () => void } {
  let stopped = false;

  // A continuous `while` loop, not `setInterval`: receiveMessages() itself
  // long-polls (WaitTimeSeconds) and blocks until there's a message or it
  // times out, so there's no busy-loop to guard against here.
  async function loop() {
    while (!stopped) {
      let messages: { receiptHandle: string; body: string }[];
      try {
        messages = await queueGateway.receiveMessages();
      } catch (error) {
        logger.error(error, 'Failed to receive messages from the pets-registration queue');
        continue;
      }

      for (const message of messages) {
        if (stopped) break;
        await processMessage(message);
      }
    }
  }

  async function processMessage(message: { receiptHandle: string; body: string }) {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(message.body);
    } catch (error) {
      logger.error(
        { error, receiptHandle: message.receiptHandle },
        'Discarding pets-registration message with malformed JSON body',
      );
      return;
    }

    const result = createPetListingSchema.safeParse(parsedBody);
    if (!result.success) {
      logger.error(
        { error: result.error, receiptHandle: message.receiptHandle },
        'Discarding pets-registration message that failed schema validation',
      );
      return;
    }

    try {
      await petsService.registerListing(result.data);
    } catch (error) {
      logger.error(
        { error, receiptHandle: message.receiptHandle },
        'Failed to register pet listing from queue message; leaving it for redelivery',
      );
      return;
    }

    await queueGateway.deleteMessage(message.receiptHandle);
  }

  void loop();

  return {
    stop: () => {
      stopped = true;
    },
  };
}
