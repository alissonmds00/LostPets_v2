import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../shared/config/env.js';

// Gateway: encapsula o sistema externo de armazenamento (disco local em dev,
// S3 em produção) atrás de uma classe única — sem interface nem driver
// trocável, a escolha de qual usar é interna, decidida por STORAGE_DRIVER.
export class StorageGateway {
  private readonly s3?: { client: S3Client; bucket: string };

  constructor(private readonly env: Env) {
    if (env.STORAGE_DRIVER === 's3') {
      if (!env.S3_BUCKET || !env.S3_REGION) {
        throw new Error('S3_BUCKET and S3_REGION are required when STORAGE_DRIVER=s3');
      }
      this.s3 = { client: new S3Client({ region: env.S3_REGION }), bucket: env.S3_BUCKET };
    }
  }

  async save(key: string, data: Buffer, contentType: string): Promise<string> {
    if (this.s3) {
      await this.s3.client.send(
        new PutObjectCommand({ Bucket: this.s3.bucket, Key: key, Body: data, ContentType: contentType }),
      );
      return key;
    }
    const filePath = join(this.env.STORAGE_LOCAL_DIR, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  }

  async getUrl(key: string): Promise<string> {
    if (this.s3) {
      return getSignedUrl(this.s3.client, new GetObjectCommand({ Bucket: this.s3.bucket, Key: key }), {
        expiresIn: 3600,
      });
    }
    // Em dev a API serve /uploads estaticamente; ver app.ts.
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.client.send(new DeleteObjectCommand({ Bucket: this.s3.bucket, Key: key }));
      return;
    }
    await rm(join(this.env.STORAGE_LOCAL_DIR, key), { force: true });
  }

  /** Exposto só para a rota estática dev-only em app.ts. */
  async read(key: string): Promise<Buffer> {
    return readFile(join(this.env.STORAGE_LOCAL_DIR, key));
  }
}
