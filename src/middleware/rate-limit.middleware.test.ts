import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import express from 'express';
import { errorHandler } from './error.middleware.js';
import { createLimiter } from './rate-limit.middleware.js';

describe('rate limiter', () => {
  it('returns the standard 429 error envelope and counts per email', async () => {
    const app = express();
    app.use(express.json());
    app.post(
      '/login',
      createLimiter({ windowMs: 60_000, limit: 2, byEmail: true, message: 'Slow down.' }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    app.use(errorHandler);
    const server = app.listen(0);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/login`;
    const post = (email: string) =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

    try {
      assert.equal((await post('a@example.com')).status, 200);
      assert.equal((await post('A@example.com ')).status, 200); // same key after normalising
      const limited = await post('a@example.com');
      assert.equal(limited.status, 429);
      assert.deepEqual(await limited.json(), {
        success: false,
        message: 'Slow down.',
        code: 'RATE_LIMITED',
      });
      assert.equal((await post('b@example.com')).status, 200); // another email is unaffected
    } finally {
      server.close();
    }
  });
});
