import type { Env } from '../shared/config/env.js';
import { LocalStorageGateway } from './local-storage.gateway.js';
import { S3StorageGateway } from './s3-storage.gateway.js';

export type StorageGateway = LocalStorageGateway | S3StorageGateway;

// Escolhe o gateway concreto por STORAGE_DRIVER — dev usa disco local, prod usa S3.
// Sem interface declarada: as duas classes só precisam bater a forma usada aqui
// (save/getUrl/delete), o TypeScript já aceita isso estruturalmente.
export function createStorageGateway(env: Env): StorageGateway {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET || !env.S3_REGION) {
      throw new Error('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
    }
    return new S3StorageGateway(env.S3_BUCKET, env.S3_REGION);
  }
  return new LocalStorageGateway(env);
}
