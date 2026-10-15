import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret passphrase');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(await verifyPassword('s3cret passphrase', hash), true);
    assert.equal(await verifyPassword('S3cret passphrase', hash), false);
  });

  it('uses a unique salt per hash and never stores the plain password', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    assert.notEqual(a, b);
    assert.ok(!a.includes('same'));
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    assert.equal(await verifyPassword('x', ''), false);
    assert.equal(await verifyPassword('x', 'plaintext'), false);
    assert.equal(await verifyPassword('x', 'scrypt$1$2$3$bad$bad'), false);
  });
});