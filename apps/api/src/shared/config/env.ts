import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default('lost_pets_sid'),
  SESSION_COOKIE_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().min(1),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  SQS_QUEUE_URL: z.string().min(1),
  SQS_REGION: z.string().min(1),
  // Only set in dev, pointing at LocalStack; absent in prod so the AWS SDK
  // falls back to the real regional SQS endpoint.
  SQS_ENDPOINT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Fails fast on boot with a clear message instead of surfacing missing-config
// errors later as random runtime failures.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
