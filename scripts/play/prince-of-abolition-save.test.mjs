import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHash } from './prince-of-abolition-stage.mjs';
import { assertPrinceFreezeCompatibility, assertPrinceInputEvidence, assertPrinceResumeManifest } from './prince-of-abolition-save.mjs';
const row = (file, digit) => ({ file, bytes: 10, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: compactHash(files) });
function example() {
  const before = freeze([row('src/domain/entropy-duke/types.ts', 'a'), row('src/domain/slice/index.ts', 'c')]);
  const after = freeze([row('src/domain/entropy-duke/types.ts', 'b'), row('src/domain/slice/index.ts', 'c')]);
  const revision = { kind: 'PRINCE205_REVIEWED_INITIALIZATION_DEPENDENCY', captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256, changes: [{ before: before.files[0], after: after.files[0] }] };
  return { before, after, revision };
}
test('accepts identical capture or exactly reviewed dependency bytes while retaining separate hashes', () => {
  const { before, after, revision } = example();
  assert.deepEqual(assertPrinceFreezeCompatibility(before, before, null).changedFiles, []);
  assert.deepEqual(assertPrinceFreezeCompatibility(before, after, revision), { captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256, changedFiles: ['src/domain/entropy-duke/types.ts'] });
});
test('rejects changed original input bytes, sizes and capture freeze hashes', () => {
  const expected = { bytes: 10, sha256: 'a'.repeat(64) };
  assertPrinceInputEvidence({ ...expected }, expected, 'original.json');
  assert.throws(() => assertPrinceInputEvidence({ ...expected, sha256: 'b'.repeat(64) }, expected, 'original.json'));
  assert.throws(() => assertPrinceInputEvidence({ ...expected, bytes: 11 }, expected, 'original.json'));
  const { before, after, revision } = example();
  assert.throws(() => assertPrinceFreezeCompatibility({ ...before, sha256: 'c'.repeat(64) }, after, revision));
});
test('rejects unreviewed bytes, missing files and nondependency source changes', () => {
  const { before, after, revision } = example();
  assert.throws(() => assertPrinceFreezeCompatibility(before, after, null));
  const drift = freeze([{ ...after.files[0], sha256: 'd'.repeat(64) }, after.files[1]]);
  assert.throws(() => assertPrinceFreezeCompatibility(before, drift, revision));
  assert.throws(() => assertPrinceFreezeCompatibility(before, freeze(after.files.slice(0, 1)), revision));
  const mechanics = freeze([before.files[0], row('src/domain/slice/index.ts', 'e')]);
  const forged = { ...revision, runtimeFreezeSha256: mechanics.sha256, changes: [{ before: before.files[1], after: mechanics.files[1] }] };
  assert.throws(() => assertPrinceFreezeCompatibility(before, mechanics, forged));
});
test('resume rejects any current-runtime or review-hash drift', () => {
  const manifest = { captureFreezeSha256: 'a'.repeat(64), runtimeFreezeSha256: 'b'.repeat(64), reviewSha256: 'c'.repeat(64), verifierSha256: 'd'.repeat(64) };
  assertPrinceResumeManifest({ ...manifest }, manifest);
  for (const key of Object.keys(manifest)) assert.throws(() => assertPrinceResumeManifest(manifest, { ...manifest, [key]: 'e'.repeat(64) }));
});
