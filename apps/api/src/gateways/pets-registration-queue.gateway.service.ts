import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { Env } from '../shared/config/env.js';

// LocalStack (dev) and real SQS (prod) speak the same protocol through the
// same SDK client — only the endpoint changes — so this stays a single
// concrete class, following the gateway default (see skill `gateway`).
export class PetsRegistrationQueueGateway {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

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
}
