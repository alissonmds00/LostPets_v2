import { buildApp } from './app.js';
import { loadEnv } from './infra/config/env.js';
import { PetsRegistrationQueueGatewayService } from './gateways/pets-registration-queue.gateway.service.js';
import { startPetsRegistrationConsumer } from './modules/pets/pets-registration.consumer.js';

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    // O consumer da fila de registro de pets roda como uma instância
    // sqs-consumer em background dentro deste mesmo processo (sem
    // apps/worker separado — ver ARCHITECTURE.md "Pontos em aberto"),
    // iniciado só depois que o servidor HTTP está confirmadamente no ar.
    // Reaproveita app.petsService (decorado em buildApp, já com repository +
    // storage + queue gateways) em vez de construir uma instância separada —
    // só é preciso um queueGateway novo aqui, já que o consumer processa
    // mensagens direto e PetsService não expõe o que foi usado pra montá-lo.
    const queueGateway = new PetsRegistrationQueueGatewayService(env);

    const consumer = startPetsRegistrationConsumer(queueGateway, app.petsService, app.log);

    // AWS ECS/Fargate (ver ARCHITECTURE.md) manda SIGTERM pro container antes
    // de parar/substituí-lo durante um deploy; SIGINT cobre Ctrl+C local.
    // Registrado aqui (não no escopo do módulo) porque o handler precisa de
    // `consumer` no closure — só disponível depois que o consumer de fato
    // iniciou. Sem isso, o comportamento padrão do Node em SIGTERM mata o
    // processo na hora: requisições HTTP em andamento são cortadas, a conexão
    // com o Postgres nunca fecha direito, e uma mensagem da fila em
    // processamento pode ser interrompida de forma suja.
    const shutdown = async (signal: NodeJS.Signals) => {
      app.log.info({ signal }, 'Received shutdown signal, closing gracefully');
      // Para de puxar mensagens novas da fila primeiro, depois deixa o
      // trabalho em andamento terminar: app.close() espera as requisições em
      // andamento e dispara o hook onClose (ver app.ts), que desconecta o
      // Prisma.
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
