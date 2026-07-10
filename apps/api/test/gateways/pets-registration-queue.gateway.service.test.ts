import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Env } from '../../src/infra/config/env.js';

// Teste de gateway (skills testing/gateway): nenhum teste automatizado toca
// um sistema externo real (LocalStack incluso) — tanto o cliente do AWS SDK
// quanto o sqs-consumer são mockados, então isto só verifica se o gateway
// traduz corretamente entre a forma de domínio e as chamadas do SDK do
// SQS/sqs-consumer.
const sendMock = vi.fn();
const startMock = vi.fn();
const stopMock = vi.fn();
const onMock = vi.fn();
const createMock = vi.fn();

vi.mock('@aws-sdk/client-sqs', () => {
  class SQSClient {
    send = sendMock;
  }
  class SendMessageCommand {
    constructor(public input: unknown) {}
  }
  return { SQSClient, SendMessageCommand };
});

vi.mock('sqs-consumer', () => ({
  Consumer: {
    create: (options: unknown) => {
      createMock(options);
      return { on: onMock, start: startMock, stop: stopMock };
    },
  },
}));

const { PetsRegistrationQueueGatewayService } = await import(
  '../../src/gateways/pets-registration-queue.gateway.service.js'
);
const { SendMessageCommand } = await import('@aws-sdk/client-sqs');

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
    startMock.mockReset();
    stopMock.mockReset();
    onMock.mockReset();
    createMock.mockReset();
  });

  describe('enqueue', () => {
    it('sends the message body to the configured queue', async () => {
      sendMock.mockResolvedValue({});

      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      await gateway.enqueue('{"foo":"bar"}');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendMessageCommand);
      expect(command.input).toEqual({
        QueueUrl: testEnv.SQS_QUEUE_URL,
        MessageBody: '{"foo":"bar"}',
      });
    });
  });

  describe('startConsuming', () => {
    it('creates a sqs-consumer bound to the configured queue/client and starts it', () => {
      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      gateway.startConsuming(vi.fn(), vi.fn());

      expect(createMock).toHaveBeenCalledTimes(1);
      const options = createMock.mock.calls[0][0] as { queueUrl: string; sqs: unknown };
      expect(options.queueUrl).toBe(testEnv.SQS_QUEUE_URL);
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    it('invokes handleMessage with the raw SQS message body', async () => {
      const handleMessage = vi.fn().mockResolvedValue(undefined);
      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      gateway.startConsuming(handleMessage, vi.fn());

      const options = createMock.mock.calls[0][0] as {
        handleMessage: (message: { Body?: string }) => Promise<void>;
      };
      await options.handleMessage({ Body: '{"foo":"bar"}' });

      expect(handleMessage).toHaveBeenCalledWith('{"foo":"bar"}');
    });

    it('wires the sqs-consumer error event to onError', () => {
      const onError = vi.fn();
      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      gateway.startConsuming(vi.fn(), onError);

      expect(onMock).toHaveBeenCalledWith('error', onError);
    });
  });

  describe('stopConsuming', () => {
    it('stops the underlying sqs-consumer', () => {
      const gateway = new PetsRegistrationQueueGatewayService(testEnv);
      gateway.startConsuming(vi.fn(), vi.fn());
      gateway.stopConsuming();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });
});
