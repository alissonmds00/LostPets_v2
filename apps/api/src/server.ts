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

    const consumer = startPetsRegistrationConsumer(queueGateway, app.petsService, app.log);

    // AWS ECS/Fargate (see ARCHITECTURE.md) sends SIGTERM to the container
    // before stopping/replacing it during a deploy; SIGINT covers local
    // Ctrl+C. Registered here (not at module scope) because the handler
    // needs `consumer` in closure — it's only available once the consumer
    // has actually started. Without this, the default Node behavior on
    // SIGTERM kills the process immediately: in-flight HTTP requests get cut
    // off, the Postgres connection never closes cleanly, and a queue message
    // being processed mid-flight can be interrupted uncleanly.
    const shutdown = async (signal: NodeJS.Signals) => {
      app.log.info({ signal }, 'Received shutdown signal, closing gracefully');
      // Stop pulling new messages off the queue first, then let in-flight
      // work finish: app.close() waits for in-flight requests and triggers
      // the onClose hook (see app.ts), which disconnects Prisma.
      consumer.stop();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
