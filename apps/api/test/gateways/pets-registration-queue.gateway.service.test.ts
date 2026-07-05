import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Env } from '../../src/infra/config/env.js';

// Gateway test (see the testing/gateway skills): no automated test touches a
// real external system (LocalStack included) — the AWS SDK client itself is
// mocked, so this only verifies the gateway translates correctly between the
// domain shape and the SQS SDK calls.
const sendMock = vi.fn();

vi.mock('@aws-sdk/client-sqs', () => {
  class SQSClient {
    send = sendMock;
  }
  class ReceiveMessageCommand {
    constructor(public input: unknown) {}
  }
  class DeleteMessageCommand {
    constructor(public input: unknown) {}
  }
  class SendMessageCommand {
    constructor(public input: unknown) {}
  }
  return { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand };
});

const { PetsRegistrationQueueGatewayService } = await import(
  '../../src/gateways/pets-registration-queue.gateway.service.js'
);
const { ReceiveMessageCommand, DeleteMessageCommand } = await import('@aws-sdk/client-sqs');

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/lost_pets_test?schema=public',
  SESSION_COOKIE_NAME: 'lost_pets_sid',
  SESSION_COOKIE_SECRET: 'a'.repeat(32),
  SESSION_TTL_DAYS: 7,
  CORS_ORIGIN: 'http://localhost:5173',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: './uploads',
  SQS_QUEUE_URL: 'http://localhost:4566/000000000000/pets-registration',
  SQS_REGION: 'us-east-1',
};

describe('PetsRegistrationQueueGatewayService', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  describe('receiveMessages', () => {
    it('translates SQS messages into { receiptHandle, body } using long polling', async () => {
      sendMock.mockResolvedValue({
        Messages: [
          { ReceiptHandle: 'rh-1', Body: '{"foo":"bar"}' },
          { ReceiptHandle: 'rh-2', Body: '{"baz":"qux"}' },
        ],
      });

      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      const messages = await gateway.receiveMessages();

      expect(messages).toEqual([
        { receiptHandle: 'rh-1', body: '{"foo":"bar"}' },
        { receiptHandle: 'rh-2', body: '{"baz":"qux"}' },
      ]);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(ReceiveMessageCommand);
      expect(command.input).toEqual(
        expect.objectContaining({
          QueueUrl: testEnv.SQS_QUEUE_URL,
          MaxNumberOfMessages: expect.any(Number),
          WaitTimeSeconds: expect.any(Number),
        }),
      );
    });

    it('returns an empty array when SQS returns no messages', async () => {
      sendMock.mockResolvedValue({});

      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      const messages = await gateway.receiveMessages();

      expect(messages).toEqual([]);
    });
  });

  describe('deleteMessage', () => {
    it('deletes a message by receipt handle', async () => {
      sendMock.mockResolvedValue({});

      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      await gateway.deleteMessage('rh-1');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteMessageCommand);
      expect(command.input).toEqual({
        QueueUrl: testEnv.SQS_QUEUE_URL,
        ReceiptHandle: 'rh-1',
      });
    });
  });
});
