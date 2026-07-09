import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Consumer } from 'sqs-consumer';
import type { Env } from '../infra/config/env.js';

// LocalStack (dev) and real SQS (prod) speak the same protocol through the
// same SDK client — only the endpoint changes — so this stays a single
// concrete class, following the gateway default (see skill `gateway`).
export class PetsRegistrationQueueGatewayService {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private consumer: Consumer | null = null;

  constructor(env: Env) {
    this.client = new SQSClient({
      region: env.SQS_REGION,
      ...(env.SQS_ENDPOINT ? { endpoint: env.SQS_ENDPOINT } : {}),
    });
    this.queueUrl = env.SQS_QUEUE_URL;
  }

  async enqueue(messageBody: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: messageBody }),
    );
  }

  // The only method that talks to SQS for the receive side — callers never
  // see the SQSClient or the SQS message shape, only the raw body string.
  // Resolving handleMessage deletes the message (sqs-consumer default);
  // throwing leaves it in the queue for redelivery. onError covers
  // queue-level failures (e.g. a failed poll), not handleMessage rejections.
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
