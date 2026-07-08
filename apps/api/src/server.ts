import { buildApp } from './app.js';
import { loadEnv } from './infra/config/env.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';
import { startPetsRegistrationPoller } from './pollers/pets-registration.poller.js';

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    // The pets-registration queue consumer runs as a background poller
    // inside this same process (no separate apps/worker — see
    // ARCHITECTURE.md "Pontos em aberto"), started only after the HTTP
    // server is confirmed up. Reuses app.petsService (decorated in
    // buildApp, already wired with repository + storage + queue gateways)
    // instead of constructing a separate instance — only a fresh
    // queueGateway is needed here, since the poller consumes messages
    // directly and PetsService doesn't expose the one it was built with.
    const queueGateway = new PetsRegistrationQueueGatewayService(env);

    startPetsRegistrationPoller(queueGateway, app.petsService, app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
