import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Env } from '../shared/config/env.js';

export class LocalStorageGatewayService {
  constructor(private readonly env: Env) {}

  async save(key: string, data: Buffer, _contentType: string): Promise<string> {
    const filePath = join(this.env.STORAGE_LOCAL_DIR, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  }

  async getUrl(key: string): Promise<string> {
    // Em dev a API serve /uploads estaticamente; ver app.ts.
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.env.STORAGE_LOCAL_DIR, key), { force: true });
  }

  /** Exposto só para a rota estática dev-only em app.ts. */
  async read(key: string): Promise<Buffer> {
    return readFile(join(this.env.STORAGE_LOCAL_DIR, key));
  }
}
