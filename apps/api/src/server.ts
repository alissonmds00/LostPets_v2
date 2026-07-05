import { buildApp } from './app.js';
import { loadEnv } from './infra/config/env.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';
import { PetsRepository } from './modules/pets/pets.repository.js';
import { PetsService } from './modules/pets/pets.service.js';
import { startPetsRegistrationPoller } from './pollers/pets-registration.poller.js';

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    // The pets-registration queue consumer runs as a background poller
    // inside this same process (no separate apps/worker — see
    // ARCHITECTURE.md "Pontos em aberto"), started only after the HTTP
    // server is confirmed up. petsRepository/petsService aren't decorated
    // on the Fastify app yet (that's pending in a parallel task), so they're
    // built directly here — the poller only needs the service, not the full
    // app instance.
    const petsRepository = new PetsRepository();
    const petsService = new PetsService(petsRepository);
    const queueGateway = new PetsRegistrationQueueGatewayService(env);

    startPetsRegistrationPoller(queueGateway, petsService, app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
