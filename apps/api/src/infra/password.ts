import { randomUUID } from 'node:crypto';
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

// Timing-attack mitigation for /login (see SECURITY-AUDIT.md, section 4,
// item 1): when a user isn't found, IdentityService.login still needs to
// pay the same argon2 CPU cost as the "wrong password" path, so the two
// failure responses take the same amount of time and don't leak whether
// an email is registered. Computed lazily and cached in memory so the hash
// (and its CPU cost) is generated once per process, not once per request.
let dummyPasswordHashPromise: Promise<string> | undefined;

export function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = argon2.hash(randomUUID());
  }
  return dummyPasswordHashPromise;
}
