import type { Env } from '../infra/config/env.js';
import { LocalStorageGatewayService } from './local-storage.gateway.service.js';
import { S3StorageGatewayService } from './s3-storage.gateway.service.js';

export type StorageGateway = LocalStorageGatewayService | S3StorageGatewayService;

// Sem interface declarada: as duas classes só precisam bater a forma usada
// aqui (save/getUrl/delete), o TypeScript já aceita isso estruturalmente.
export function createStorageGateway(env: Env): StorageGateway {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET || !env.S3_REGION) {
      throw new Error('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
    }
    return new S3StorageGatewayService(env.S3_BUCKET, env.S3_REGION);
  }
  return new LocalStorageGatewayService(env);
}
