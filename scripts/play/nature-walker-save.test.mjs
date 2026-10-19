import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHash, assertNoPrivateFields, inspectDisplayInterruption } from './nature-walker-stage.mjs';
import { assertNatureWalkerFreezeCompatibility, assertNatureWalkerInputEvidence, assertNatureWalkerResumeManifest } from './nature-walker-save.mjs';

// Synthetic byte evidence only. No producer, runtime/dist import, game replay,
// SQLite database, capture rewrite or inspected-file mutation is performed.
const row = (file, digit) => ({ file, bytes: 10, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: compactHash(files) });
const original = () => freeze([
  row('package.json', '1'), row('src/domain/slice/index.ts', '2'), row('src/renderer/SliceApp.tsx', '3'),
  row('dist/domain/nature-walker/index.js', '4'), row('scripts/play/nature-walker-stage.mjs', '5'), row('scripts/play/nature-walker-save.mjs', '6'),
]);

test('initial207 accepts only the identical complete source/runtime/UI/producer/verifier freeze', () => {
  const before = original();
  assert.deepEqual(assertNatureWalkerFreezeCompatibility(before, structuredClone(before)), {
    captureFreezeSha256: before.sha256, runtimeFreezeSha256: before.sha256, changedFiles: [],
  });
  for (const old of before.files) for (const delta of [{ bytes: 11 }, { sha256: '0'.repeat(64) }]) {
    const changed = freeze(before.files.map(r => r.file === old.file ? { ...r, ...delta } : r));
    assert.throws(() => assertNatureWalkerFreezeCompatibility(before, changed));
  }
});

test('rejects forged hashes, missing/extra rows, reordered inputs and any two-file UI exception', () => {
  const before = original();
  assert.throws(() => assertNatureWalkerFreezeCompatibility({ ...before, sha256: '0'.repeat(64) }, before));
  assert.throws(() => assertNatureWalkerFreezeCompatibility(before, { ...before, sha256: '0'.repeat(64) }));
  for (const files of [before.files.slice(1), [...before.files, row('src/extra.ts', '7')], [...before.files].reverse()]) {
    assert.throws(() => assertNatureWalkerFreezeCompatibility(before, freeze(files)));
  }
  const revised = freeze(before.files.map(r => ['src/renderer/SliceApp.tsx', 'scripts/play/nature-walker-save.mjs'].includes(r.file) ? { ...r, sha256: '9'.repeat(64) } : r));
  assert.throws(() => assertNatureWalkerFreezeCompatibility(before, revised, {
    kind: 'HAND_OF_ORDER206_REVIEWED_UI_DRAWER_REVISION', captureFreezeSha256: before.sha256, runtimeFreezeSha256: revised.sha256,
    changes: before.files.flatMap((r, i) => r.sha256 === revised.files[i].sha256 ? [] : [{ before: r, after: revised.files[i] }]),
  }));
});

test('rejects immutable capture/source evidence with changed byte count, digest or shape', () => {
  const expected = { bytes: 10, sha256: 'a'.repeat(64) };
  for (const path of ['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'capture-integrity.json', 'source-prefix.json', 'boundary.json', 'barren-matriarch-source.json', 'coffin-bearer-source.json']) {
    assertNatureWalkerInputEvidence({ ...expected }, expected, path);
    for (const delta of [{ bytes: 11 }, { sha256: 'b'.repeat(64) }, { extra: true }]) assert.throws(() => assertNatureWalkerInputEvidence({ ...expected, ...delta }, expected, path));
  }
});

test('resume remains bound to the exact complete capture, source, verifier and runtime manifest', () => {
  const manifest = {
    captureFreezeSha256: 'a'.repeat(64), runtimeFreezeSha256: 'a'.repeat(64), freezeSha256: 'a'.repeat(64),
    fullInputEvidenceSha256: 'b'.repeat(64), verifierSha256: 'c'.repeat(64), producerSha256: 'd'.repeat(64),
    sourceSha256: 'e'.repeat(64), sourcePrefixSha256: 'f'.repeat(64), predecessorSha256: '1'.repeat(64), changedFiles: [],
  };
  assertNatureWalkerResumeManifest(structuredClone(manifest), manifest);
  for (const key of Object.keys(manifest).filter(key => key !== 'changedFiles')) assert.throws(() => assertNatureWalkerResumeManifest(manifest, { ...manifest, [key]: '0'.repeat(64) }));
  assert.throws(() => assertNatureWalkerResumeManifest(manifest, { ...manifest, changedFiles: ['src/renderer/SliceApp.tsx'] }));
  assert.throws(() => assertNatureWalkerResumeManifest(manifest, { ...manifest, extra: true }));
  const { predecessorSha256, ...missing } = manifest; assert.throws(() => assertNatureWalkerResumeManifest(manifest, missing));
});

// Eight exact-path regressions for the public preparation price versus the
// unrelated encounter paid-cost summary. No private/RNG allowlist is relaxed.
test('public preparation price remains an ordinary nonnegative integer', () => {
  assertNoPrivateFields({ prices: { preparation: 180 } });
  for (const value of [-1, 0.5, NaN, Infinity, '180', null]) assert.throws(() => assertNoPrivateFields({ prices: { preparation: value } }));
});
test('public encounter preparation can be absent', () => { assertNoPrivateFields({ encounter: { preparation: null } }); });
test('public encounter preparation exposes exactly four paid-cost fields', () => {
  assertNoPrivateFields({ encounter: { preparation: { week: 225, pricePaid: 30, mindPaid: 2, actionsPaid: 0 } } });
});
test('a raw preparation object cannot masquerade as the public price', () => {
  assert.throws(() => assertNoPrivateFields({ prices: { preparation: { week: 225, pricePaid: 30, mindPaid: 2, actionsPaid: 0 } } }));
});
test('an encounter preparation cannot leak an extra private source or RNG field', () => {
  for (const field of ['seed', 'cursor', 'random', 'source', 'sourceHistory', 'preparationRoll']) assert.throws(() => assertNoPrivateFields({ encounter: { preparation: { week: 225, pricePaid: 30, mindPaid: 2, actionsPaid: 0, [field]: 'private' } } }));
});
test('preparation at every other path is rejected even when null or summary-shaped', () => {
  assert.throws(() => assertNoPrivateFields({ preparation: null }));
  assert.throws(() => assertNoPrivateFields({ nested: { prices: { preparation: 180 } } }));
  assert.throws(() => assertNoPrivateFields({ nested: { encounter: { preparation: null } } }));
});
test('combat-only projections never admit either preparation representation', () => {
  assert.throws(() => assertNoPrivateFields({ prices: { preparation: 180 } }, [], true));
  assert.throws(() => assertNoPrivateFields({ encounter: { preparation: null } }, [], true));
});
test('public modifier source labels remain visible while actual private fields remain denied', () => {
  assertNoPrivateFields({ check: { modifiers: [{ source: '公开修正', value: 0 }] } }, [], true);
  for (const field of ['seed', 'cursor', 'random', 'randomSeed', 'randomCursorBefore', 'randomCursorAfter', 'sourceHistory', 'sourceScene', 'journal', 'acquisitionJournal', 'mechanicalPreparation', 'originals', '__privateCaptureProbe']) assert.throws(() => assertNoPrivateFields({ nested: { [field]: 'private' } }));
  assert.throws(() => assertNoPrivateFields({ source: {} }, [], true));
});

// A published completed955 capture is not the reviewed interrupted946 manifest.
// Reject before considering runtime/frozen changes; no private output is required.
test('refuses to resume an unreviewed manifest, including the completed public capture', () => {
  assert.throws(() => inspectDisplayInterruption('tests/fixtures/nature-walker-v02070', original()), /Not the reviewed display interruption/);
});
