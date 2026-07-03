import type { Env } from '../config/env.js';
import { LocalStorageProvider } from './local-storage-provider.js';
import { S3StorageProvider } from './s3-storage-provider.js';
import type { StorageProvider } from './storage-provider.js';

export type { StorageProvider } from './storage-provider.js';

export function createStorageProvider(env: Env): StorageProvider {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET || !env.S3_REGION) {
      throw new Error('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
    }
    return new S3StorageProvider(env.S3_BUCKET, env.S3_REGION);
  }
  return new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
}
