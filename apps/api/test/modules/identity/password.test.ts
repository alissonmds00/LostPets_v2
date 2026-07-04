import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/modules/identity/password.js';

describe('hashPassword / verifyPassword', () => {
  it('hashes a plain password into something different from the original', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toBe('correct horse battery staple');
    expect(typeof hash).toBe('string');
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('correct horse battery staple');

    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });
});
