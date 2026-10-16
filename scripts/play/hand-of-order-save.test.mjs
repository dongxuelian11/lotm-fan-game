import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHash, stable } from './hand-of-order-stage.mjs';
import { assertHandOfOrderFreezeCompatibility, assertHandOfOrderInputEvidence, assertHandOfOrderResumeManifest } from './hand-of-order-save.mjs';

// Synthetic byte evidence only: no producer, gameplay, SQLite database or capture writes.
const row = (file, digit) => ({ file, bytes: 10, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: compactHash(files) });
const proof = (before, after) => ({
  kind: 'HAND_OF_ORDER206_REVIEWED_UI_DRAWER_REVISION', captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256,
  changes: before.files.flatMap((old, i) => stable(old) === stable(after.files[i]) ? [] : [{ before: old, after: after.files[i] }]),
});
function example() {
  const before = freeze([
    row('src/domain/slice/index.ts', 'c'), row('src/renderer/SliceApp.tsx', 'a'),
    row('dist/domain/slice/index.js', 'd'), row('scripts/play/hand-of-order-stage.mjs', 'e'), row('scripts/play/hand-of-order-save.mjs', 'f'),
  ]);
  const after = freeze(before.files.map(r => r.file === 'src/renderer/SliceApp.tsx' ? { ...r, bytes: 11, sha256: 'b'.repeat(64) }
    : r.file === 'scripts/play/hand-of-order-save.mjs' ? { ...r, bytes: 12, sha256: '9'.repeat(64) } : r));
  return { before, after, revision: proof(before, after) };
}

test('accepts identity without an exception and the exact reviewed two-file revision', () => {
  const { before, after, revision } = example();
  assert.deepEqual(assertHandOfOrderFreezeCompatibility(before, before), {
    captureFreezeSha256: before.sha256, runtimeFreezeSha256: before.sha256, changedFiles: [],
  });
  assert.deepEqual(assertHandOfOrderFreezeCompatibility(before, after, revision), {
    captureFreezeSha256: before.sha256, runtimeFreezeSha256: after.sha256,
    changedFiles: ['src/renderer/SliceApp.tsx', 'scripts/play/hand-of-order-save.mjs'],
  });
});

test('rejects missing/wrong review kind and mismatched capture or entire-runtime hashes', () => {
  const { before, after, revision } = example();
  assert.throws(() => assertHandOfOrderFreezeCompatibility(before, after));
  for (const delta of [
    { kind: 'PRINCE205_REVIEWED_INITIALIZATION_DEPENDENCY' },
    { captureFreezeSha256: '0'.repeat(64) }, { runtimeFreezeSha256: '0'.repeat(64) },
    { changes: [] }, { changes: [...revision.changes].reverse() },
  ]) assert.throws(() => assertHandOfOrderFreezeCompatibility(before, after, { ...revision, ...delta }));
  assert.throws(() => assertHandOfOrderFreezeCompatibility(before, before, { ...proof(before, before), kind: 'WRONG' }));
});

test('rejects changed before/after sizes or hashes and later drift in either approved file', () => {
  const { before, after, revision } = example();
  for (const index of [0, 1]) {
    for (const side of ['before', 'after']) for (const delta of [{ bytes: 999 }, { sha256: '0'.repeat(64) }]) {
      const changed = structuredClone(revision); Object.assign(changed.changes[index][side], delta);
      assert.throws(() => assertHandOfOrderFreezeCompatibility(before, after, changed));
    }
  }
  for (const file of ['src/renderer/SliceApp.tsx', 'scripts/play/hand-of-order-save.mjs']) {
    const drift = freeze(after.files.map(r => r.file === file ? { ...r, sha256: '0'.repeat(64) } : r));
    assert.throws(() => assertHandOfOrderFreezeCompatibility(before, drift, revision));
  }
  assert.throws(() => assertHandOfOrderFreezeCompatibility({ ...before, sha256: '0'.repeat(64) }, after, revision));
  assert.throws(() => assertHandOfOrderFreezeCompatibility(before, { ...after, sha256: '0'.repeat(64) }, revision));
});

test('rejects an extra mechanics, compiled-dependency or producer change even with a matching proof', () => {
  const { before, after } = example();
  for (const file of ['src/domain/slice/index.ts', 'dist/domain/slice/index.js', 'scripts/play/hand-of-order-stage.mjs']) {
    const drift = freeze(after.files.map(r => r.file === file ? { ...r, sha256: '0'.repeat(64) } : r));
    assert.throws(() => assertHandOfOrderFreezeCompatibility(before, drift, proof(before, drift)));
  }
});

test('rejects only one approved change, added/missing files and reordered inventory', () => {
  const { before, after, revision } = example();
  for (const file of ['src/renderer/SliceApp.tsx', 'scripts/play/hand-of-order-save.mjs']) {
    const partial = freeze(before.files.map(r => r.file === file ? after.files.find(f => f.file === file) : r));
    assert.throws(() => assertHandOfOrderFreezeCompatibility(before, partial, proof(before, partial)));
  }
  for (const files of [after.files.slice(1), [...after.files, row('src/extra.ts', '1')], [...after.files].reverse()]) {
    assert.throws(() => assertHandOfOrderFreezeCompatibility(before, freeze(files), revision));
  }
});

test('rejects any changed immutable capture/source/revision input bytes or size', () => {
  const expected = { bytes: 10, sha256: 'a'.repeat(64) };
  for (const path of ['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'capture-integrity.json', 'source-prefix.json', 'original-death-source.json', 'boundary.json', 'source.json', 'hand-of-order-ui-revision.json']) {
    assertHandOfOrderInputEvidence({ ...expected }, expected, path);
    assert.throws(() => assertHandOfOrderInputEvidence({ ...expected, bytes: 11 }, expected, path));
    assert.throws(() => assertHandOfOrderInputEvidence({ ...expected, sha256: 'b'.repeat(64) }, expected, path));
  }
});

test('resume binds the full runtime, verifier and revision-inclusive input digest', () => {
  const manifest = {
    captureFreezeSha256: 'a'.repeat(64), runtimeFreezeSha256: 'b'.repeat(64), freezeSha256: 'b'.repeat(64),
    fullInputEvidenceSha256: 'c'.repeat(64), verifierSha256: 'd'.repeat(64), producerSha256: 'e'.repeat(64),
    sourceSha256: 'f'.repeat(64), sourcePrefixSha256: '1'.repeat(64), predecessorSha256: '2'.repeat(64), originalDeathSourceSha256: '3'.repeat(64),
    changedFiles: ['src/renderer/SliceApp.tsx', 'scripts/play/hand-of-order-save.mjs'],
  };
  assertHandOfOrderResumeManifest(structuredClone(manifest), manifest);
  for (const key of Object.keys(manifest).filter(key => key !== 'changedFiles')) {
    assert.throws(() => assertHandOfOrderResumeManifest(manifest, { ...manifest, [key]: '0'.repeat(64) }));
  }
  assert.throws(() => assertHandOfOrderResumeManifest(manifest, { ...manifest, changedFiles: [] }));
  assert.throws(() => assertHandOfOrderResumeManifest(manifest, { ...manifest, extra: true }));
});
