import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHash } from './mercury-snake-stage.mjs';
import { assertMercuryFreezeCompatibility, assertMercuryInputEvidence, assertMercuryResumeManifest } from './mercury-snake-save.mjs';
const row = (file, digit) => ({ file, bytes: 10, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: compactHash(files) });
function example() {
  const before = freeze([row('src/domain/mercury-snake/life.ts', 'a'), row('src/domain/slice/index.ts', 'c')]);
  const after = freeze([row('src/domain/mercury-snake/life.ts', 'b'), row('src/domain/slice/index.ts', 'c')]);
  const revision = { kind: 'MERCURY204_REVIEWED_PUBLIC_PROJECTION', captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256, changes: [{ before: before.files[0], after: after.files[0] }] };
  return { before, after, revision };
}
test('accepts identical capture or exactly reviewed display bytes while retaining separate hashes', () => {
  const { before, after, revision } = example();
  assert.deepEqual(assertMercuryFreezeCompatibility(before, before, null).changedFiles, []);
  assert.deepEqual(assertMercuryFreezeCompatibility(before, after, revision), { captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256, changedFiles: ['src/domain/mercury-snake/life.ts'] });
});
test('rejects changed original input bytes, sizes and capture freeze hashes', () => {
  const expected = { bytes: 10, sha256: 'a'.repeat(64) };
  assertMercuryInputEvidence({ ...expected }, expected, 'original.json');
  assert.throws(() => assertMercuryInputEvidence({ ...expected, sha256: 'b'.repeat(64) }, expected, 'original.json'));
  assert.throws(() => assertMercuryInputEvidence({ ...expected, bytes: 11 }, expected, 'original.json'));
  const { before, after, revision } = example();
  assert.throws(() => assertMercuryFreezeCompatibility({ ...before, sha256: 'c'.repeat(64) }, after, revision));
});
test('rejects unreviewed bytes, missing files and nonprojection source changes', () => {
  const { before, after, revision } = example();
  assert.throws(() => assertMercuryFreezeCompatibility(before, after, null));
  const drift = freeze([{ ...after.files[0], sha256: 'd'.repeat(64) }, after.files[1]]);
  assert.throws(() => assertMercuryFreezeCompatibility(before, drift, revision));
  assert.throws(() => assertMercuryFreezeCompatibility(before, freeze(after.files.slice(0, 1)), revision));
  const mechanics = freeze([before.files[0], row('src/domain/slice/index.ts', 'e')]);
  const forged = { ...revision, runtimeFreezeSha256: mechanics.sha256, changes: [{ before: before.files[1], after: mechanics.files[1] }] };
  assert.throws(() => assertMercuryFreezeCompatibility(before, mechanics, forged));
});
test('resume rejects any current-runtime or review-hash drift', () => {
  const manifest = { captureFreezeSha256: 'a'.repeat(64), runtimeFreezeSha256: 'b'.repeat(64), reviewSha256: 'c'.repeat(64), verifierSha256: 'd'.repeat(64) };
  assertMercuryResumeManifest({ ...manifest }, manifest);
  for (const key of Object.keys(manifest)) assert.throws(() => assertMercuryResumeManifest(manifest, { ...manifest, [key]: 'e'.repeat(64) }));
});
