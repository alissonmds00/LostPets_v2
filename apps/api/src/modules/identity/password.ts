import argon2 from 'argon2';

// Kept local to the identity module (not shared/) — no other module needs
// password hashing yet; this can move to shared/ later if that changes (YAGNI).
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
