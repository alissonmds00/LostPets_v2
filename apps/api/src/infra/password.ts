import argon2 from 'argon2';

// Lives in infra/, not modules/identity/: password hashing is technical
// plumbing (argon2 wrapping) with no business meaning of its own, exactly
// like the Prisma client or env loading that already live here — it doesn't
// become "identity's" just because identity is its only caller today. See
// the infra-placement skill for the general criterion.
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
