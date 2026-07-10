import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default('lost_pets_sid'),
  SESSION_COOKIE_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().min(1),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  SQS_QUEUE_URL: z.string().min(1),
  SQS_REGION: z.string().min(1),
  // Só é setado em dev, apontando pro LocalStack; ausente em prod pra que o
  // AWS SDK caia no endpoint regional real do SQS.
  SQS_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Falha rápido no boot com mensagem clara em vez de deixar configuração
// faltante virar falha de runtime aleatória mais tarde.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
