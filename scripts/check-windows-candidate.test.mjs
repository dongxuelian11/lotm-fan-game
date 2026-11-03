import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safePath, requireWindows } from './check-windows-candidate.mjs';
const script = fileURLToPath(new URL('./check-windows-candidate.mjs', import.meta.url));
test('manifest paths reject traversal, absolute paths and Windows drive paths', () => {
  for (const value of ['', '../x', '/x', 'a/../b', 'a//b', './a', 'C:/x', 'a\\b', 'a\0b']) assert.equal(safePath(value), false, value);
  assert.equal(safePath('resources/app/dist/main/main.js'), true);
});
test('platform gate cannot imply Linux execution is Windows evidence', () => {
  assert.throws(() => requireWindows('linux'), /NOT_RUN/);
  assert.doesNotThrow(() => requireWindows('win32'));
});
test('missing arguments fail without creating an evidence directory', () => {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /Usage:/); assert.equal(run.stdout, '');
});
test('non-Windows execution refuses nonexistent input before file access', { skip: process.platform === 'win32' }, () => {
  const run = spawnSync(process.execPath, [script, 'missing-directory', 'missing.zip'], { encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /Windows execution NOT_RUN/); assert.equal(run.stdout, '');
});
test('static mode rejects missing archive, rather than reporting Windows success', () => {
  const run = spawnSync(process.execPath, [script, '--verify-only', 'missing-directory', 'missing.zip'], { encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /ENOENT/); assert.equal(run.stdout, '');
});

test('incorrect archive is rejected before any extracted payload is read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lotm-check-negative-'));
  try {
    const zip = join(dir, 'wrong.zip'); writeFileSync(zip, 'not the published archive');
    const run = spawnSync(process.execPath, [script, '--verify-only', 'missing-directory', zip], { encoding: 'utf8' });
    assert.equal(run.status, 1); assert.match(run.stderr, /Not the fixed published ZIP/); assert.equal(run.stdout, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
