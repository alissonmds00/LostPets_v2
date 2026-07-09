import { buildApp } from './app.js';
import { loadEnv } from './infra/config/env.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';
import { startPetsRegistrationConsumer } from './modules/pets/pets-registration.consumer.js';

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    // The pets-registration queue consumer runs as a background sqs-consumer
    // instance inside this same process (no separate apps/worker — see
    // ARCHITECTURE.md "Pontos em aberto"), started only after the HTTP
    // server is confirmed up. Reuses app.petsService (decorated in
    // buildApp, already wired with repository + storage + queue gateways)
    // instead of constructing a separate instance — only a fresh
    // queueGateway is needed here, since the consumer processes messages
    // directly and PetsService doesn't expose the one it was built with.
    const queueGateway = new PetsRegistrationQueueGatewayService(env);

    startPetsRegistrationConsumer(queueGateway, app.petsService, app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
