import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { StorageProvider } from './storage-provider.js';

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly baseDir: string) {}

  async save(key: string, data: Buffer): Promise<string> {
    const filePath = join(this.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  }

  async getUrl(key: string): Promise<string> {
    // In dev the API serves /uploads statically; see app.ts.
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.baseDir, key), { force: true });
  }

  /** Exposed for the dev-only static file route in app.ts. */
  async read(key: string): Promise<Buffer> {
    return readFile(join(this.baseDir, key));
  }
}
