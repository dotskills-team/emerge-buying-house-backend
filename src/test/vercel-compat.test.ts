import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Vercel's function loader cannot require() an ES module, although Node 24 itself can. A
 * CommonJS package that requires an ESM-only dependency (sanitize-html 2.17.6+ with htmlparser2
 * 12 did) works locally and in tests but crashes every request on Vercel with ERR_REQUIRE_ESM.
 * Loading each dependency with that Node feature switched off catches it before deploying.
 */
describe('Vercel compatibility', () => {
  const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>;
  };

  for (const name of Object.keys(dependencies)) {
    it(`loads ${name} without require(esm)`, () => {
      const run = spawnSync(
        process.execPath,
        [
          '--no-experimental-require-module',
          '--input-type=module',
          '-e',
          `await import(${JSON.stringify(name)});`,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(run.status, 0, run.stderr.split('\n').slice(0, 3).join('\n'));
    });
  }
});
