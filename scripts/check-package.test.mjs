import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const project = fileURLToPath(new URL('..', import.meta.url));
const checker = fileURLToPath(new URL('./check-package.mjs', import.meta.url));

function check(cwd) {
  return spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8' });
}

test('the published package works for JavaScript and TypeScript consumers', () => {
  const result = check(project);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const [name, mutate, expected] of [
  ['a broken exports target', (directory) => {
    const manifestPath = join(directory, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.exports['.'].import = './dist/missing.js';
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }, /Published export \. \(import\) points to missing file: dist\/missing\.js/],
  ['a missing transitive JavaScript file', (directory) => {
    rmSync(join(directory, 'dist/regions/region2.js'));
  }, /ERR_MODULE_NOT_FOUND[\s\S]*dist\/regions\/region2\.js/],
  ['a missing transitive declaration file', (directory) => {
    rmSync(join(directory, 'dist/types.d.ts'));
  }, /TS7016:[\s\S]*types\.js/],
]) {
  test(`rejects ${name}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'iapws-package-regression-'));
    try {
      cpSync(join(project, 'dist'), join(directory, 'dist'), { recursive: true });
      cpSync(join(project, 'package.json'), join(directory, 'package.json'));
      mutate(directory);
      const result = check(directory);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
