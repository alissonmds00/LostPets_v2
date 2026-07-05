import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import type { Env } from '../infra/config/env.js';

// Shape the consumer (poller) works with — just the two fields it needs to
// process a message and later delete it, translated from the SQS SDK's own
// response shape (`Messages[].{ReceiptHandle,Body}`).
export type PetsRegistrationQueueMessageDto = { receiptHandle: string; body: string };

// LocalStack (dev) and real SQS (prod) speak the same protocol through the
// same SDK client — only the endpoint changes — so this stays a single
// concrete class, following the gateway default (see skill `gateway`).
export class PetsRegistrationQueueGatewayService {
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

  // Long polling (WaitTimeSeconds) so the poller's loop blocks here instead of
  // busy-looping against SQS while the queue is empty.
  async receiveMessages(): Promise<PetsRegistrationQueueMessageDto[]> {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      }),
    );

    return (result.Messages ?? []).map((message) => ({
      receiptHandle: message.ReceiptHandle as string,
      body: message.Body as string,
    }));
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }),
    );
  }
}
