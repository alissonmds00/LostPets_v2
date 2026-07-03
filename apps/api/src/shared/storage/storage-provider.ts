// Contract every storage driver must satisfy. The rest of the app (e.g. the
// `pets` module handling photo uploads) depends only on this interface, never
// on a concrete driver — swapping local disk for S3 is an env var change.
export interface StorageProvider {
  /** Saves a file and returns the key it was stored under. */
  save(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Returns a URL the client can use to fetch the file. */
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
