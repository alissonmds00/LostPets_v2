import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
import type { Env } from '../infra/config/env.js';

// LocalStack (dev) e o SQS real (prod) falam o mesmo protocolo pelo mesmo
// cliente do SDK — só o endpoint muda — então isso permanece uma única
// classe concreta, seguindo o padrão default da skill `gateway`.
export class PetsRegistrationQueueGatewayService {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private consumer: Consumer | null = null;

  constructor(env: Env) {
    this.client = new SQSClient({
      region: env.SQS_REGION,
      // LocalStack ignores credential values but still requires the SDK to
      // present some — without this, request signing throws
      // CredentialsProviderError before the request ever reaches LocalStack.
      // Real SQS in prod (no SQS_ENDPOINT) keeps using the SDK's default
      // provider chain (IAM role, env vars, etc.) instead.
      ...(env.SQS_ENDPOINT
        ? { endpoint: env.SQS_ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }
        : {}),
    });
    this.queueUrl = env.SQS_QUEUE_URL;
  }

  async enqueue(messageBody: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: messageBody }),
    );
  }

  // Resolver handleMessage deleta a mensagem (default do sqs-consumer);
  // lançar erro deixa na fila pra reentrega. onError cobre falha no nível da
  // fila (ex: um poll que falhou), não rejeição de handleMessage.
  startConsuming(handleMessage: (body: string) => Promise<void>, onError: (error: unknown) => void): void {
    this.consumer = Consumer.create({
      queueUrl: this.queueUrl,
      sqs: this.client,
      handleMessage: async (message) => {
        await handleMessage(message.Body ?? '');
        return message;
      },
    });
    this.consumer.on('error', onError);
    this.consumer.start();
  }

  stopConsuming(): void {
    this.consumer?.stop();
    this.consumer = null;
  }
}
