import test from 'node:test';
import assert from 'node:assert/strict';
import { argumentsForEquivalence, assertCaptureShape, assertProof, assertRecordedTransition, assertRuntimeFreeze, budget, compactHash, completeRows, recordedPublicEvidence, stable, stateHash } from './fool-runtime-equivalence.mjs';

// Pure protocol tests only: no production imports, fixture reads, game replay,
// SQLite, builds, timers, or filesystem writes.
const H = 'a'.repeat(64), SEED = 'seer-rebuild-first';
const states = () => Array.from({ length: 216 }, (_, index) => ({ index, commandCount: 1868 + index, stateSha256: stateHash(['state', index]), ...(index < 44 ? { publicSha256: stateHash(['public', index]) } : {}) }));
function proofFixture(mode = 'public', length = 216) {
  const original = states();
  return { original, proof: { format: 'FOOL208_OWNED_RUNTIME_EQUIVALENCE_V1', manifestSha256: H, mode,
    rows: original.slice(0, length).map((state, index) => {
      const recorded = recordedPublicEvidence(index, original), publicHash = recorded?.sha256 ?? stateHash(['current-public', index]);
      return { index, commandCount: state.commandCount, stateSha256: state.stateSha256, budgetSha256: stateHash(['budget', index]), random: { seed: SEED, cursor: 932 + index }, eventSha256: index < 2 ? null : stateHash(['event', index]),
        public: mode === 'private' ? null : { strictSha256: publicHash, sessionSha256: index === 0 ? null : publicHash, recorded } };
    }) } };
}
const validArgs = mode => ['--mode', mode, '--runtime-freeze-file', '/reviewed/final.json', '--runtime-freeze-sha256', H, '--verifier-sha256', H];

test('canonical full-state hashing is key-order independent but arrays remain ordered', () => {
  assert.equal(stable({ b: [2, 1], a: '原' }), '{"a":"原","b":[2,1]}');
  assert.equal(stateHash({ b: [2, 1], a: '原' }), stateHash({ a: '原', b: [2, 1] }));
  assert.notEqual(stateHash([1, 2]), stateHash([2, 1]));
  assert.notEqual(compactHash({ a: 1, b: 2 }), compactHash({ b: 2, a: 1 }));
});

test('freeze checks exact ordering, contents, inventory and supplied digest', () => {
  const rows = [{ file: 'src/a.ts', bytes: 3, sha256: H }, { file: 'dist/a.js', bytes: 4, sha256: 'b'.repeat(64) }];
  const freeze = { sha256: compactHash(rows), files: rows };
  assertRuntimeFreeze(freeze, freeze.sha256, structuredClone(rows));
  for (const edited of [rows.slice(1), [...rows].reverse(), [...rows, { file: 'extra.js', bytes: 1, sha256: H }], rows.map((row, i) => i ? row : { ...row, bytes: 4 }), rows.map((row, i) => i ? row : { ...row, sha256: 'c'.repeat(64) })]) {
    assert.throws(() => assertRuntimeFreeze(freeze, freeze.sha256, edited));
  }
  assert.throws(() => assertRuntimeFreeze(freeze, H, rows));
  const duplicated = [...rows, rows[0]];
  assert.throws(() => assertRuntimeFreeze({ sha256: compactHash(duplicated), files: duplicated }, compactHash(duplicated), duplicated));
  assert.throws(() => assertRuntimeFreeze({ ...freeze, extra: true }, freeze.sha256, rows));
});

test('explicit mode and final-runtime/verifier pins are mandatory; resume is externally hash-pinned', () => {
  for (const mode of ['private', 'public']) assert.equal(argumentsForEquivalence(validArgs(mode)).mode, mode);
  const resumed = argumentsForEquivalence([...validArgs('public'), '--resume-directory', '/audit/run', '--resume-proof-sha256', H]);
  assert.equal(resumed.resumeProofSha256, H);
  for (const args of [[], validArgs('other'), validArgs('public').slice(0, -2), [...validArgs('private'), '--mode', 'public'], [...validArgs('public'), '--unknown', 'x'], [...validArgs('public'), '--resume-directory', '/audit/run'], [...validArgs('public'), '--resume-proof-sha256', H], [...validArgs('public'), '--output-directory', '/audit/new', '--resume-directory', '/audit/run', '--resume-proof-sha256', H], [...validArgs('public'), '--output-directory'], [...validArgs('public'), '--output-directory', '--resume-directory']]) {
    assert.throws(() => argumentsForEquivalence(args));
  }
});

test('truncated or blank-line JSONL cannot count as completed evidence', () => {
  assert.deepEqual(completeRows('{"index":0}\n{"index":1}\n'), [{ index: 0 }, { index: 1 }]);
  for (const text of ['', '{}', '{}\n\n', '\n', '{}\n{']) assert.throws(() => completeRows(text));
});

test('historical public coverage remains 44 plus two separately identified baselines', () => {
  const original = states(), evidence = original.map((_, index) => recordedPublicEvidence(index, original));
  assert.equal(evidence.filter(row => row?.kind === 'ORIGINAL_RECONSTRUCTED_44').length, 44);
  assert.equal(evidence.filter(Boolean).length, 46);
  assert.equal(evidence[44], null); assert.equal(evidence[67], null);
  assert.equal(evidence[68].kind, 'SEPARATE_PAUSED_1936_BASELINE');
  assert.equal(evidence[215].kind, 'SEPARATE_TERMINAL_2083_BASELINE');
  assert.equal(evidence.filter(row => row === null).length, 170);
});

test('public proof requires all current strict/session pairs and authentic historical kinds', () => {
  const f = proofFixture(); assertProof(f.proof, H, 'public', f.original);
  for (const change of [
    p => { p.manifestSha256 = 'b'.repeat(64); }, p => { p.mode = 'private'; }, p => { p.extra = true; },
    p => { p.rows[4].stateSha256 = H; }, p => { p.rows[4].index++; }, p => { p.rows[4].commandCount++; },
    p => { p.rows[4].random.seed = 'another-seed'; }, p => { p.rows[4].random.cursor = -1; },
    p => { p.rows[4].eventSha256 = null; }, p => { p.rows[1].eventSha256 = H; },
    p => { p.rows[4].public.sessionSha256 = H; }, p => { p.rows[0].public.sessionSha256 = p.rows[0].public.strictSha256; },
    p => { p.rows[44].public.recorded = { kind: 'ORIGINAL_RECONSTRUCTED_44', sha256: p.rows[44].public.strictSha256 }; },
    p => { p.rows[68].public.recorded.kind = 'ORIGINAL_RECONSTRUCTED_44'; },
    p => { p.rows[215].public.strictSha256 = H; p.rows[215].public.sessionSha256 = H; },
    p => { p.rows.reverse(); }, p => { p.rows.push(structuredClone(p.rows.at(-1))); },
  ]) {
    const changed = structuredClone(f.proof); change(changed); assert.throws(() => assertProof(changed, H, 'public', f.original));
  }
});

test('private proof and a partial resume never claim unperformed public comparisons', () => {
  const f = proofFixture('private'); assertProof(f.proof, H, 'private', f.original);
  f.proof.rows[10].public = { strictSha256: H, sessionSha256: H, recorded: null };
  assert.throws(() => assertProof(f.proof, H, 'private', f.original));
  for (const length of [0, 1, 44, 69, 215]) {
    const partial = proofFixture('public', length); assertProof(partial.proof, H, 'public', partial.original);
    assert.equal(partial.proof.rows.length, length);
  }
});

function transitionFixture() {
  const before = { runId: 'original', revision: 1870, week: 1, date: { year: 1 }, status: 'ACTIVE', progression: { sequence: 1 }, health: 90, mind: 95, spirituality: 100, cash: 10, actionsRemaining: 3, seer: { pollution: 0 }, random: { seed: SEED, cursor: 932 }, fool: { frame: { nowSecond: 60, location: 'base' }, journal: [] } };
  const after = structuredClone(before); after.revision++; after.cash = 11; after.random.cursor = 933;
  const intent = { type: 'FOOL', command: { type: 'RECEPTION_WORK' } };
  const event = { id: 'actual-event', revision: after.revision, command: intent.command, before: { random: before.random }, after: { random: after.random }, randomReceipts: [{ kind: 'CHECK', cursorBefore: 932, cursorAfter: 933, check: { roll: 29 } }], hostProof: { id: 'original-proof' } };
  after.fool.journal.push(structuredClone(event));
  const row = { intent, before: budget(before), after: budget(after), journalEventId: event.id };
  // A deliberately tiny deterministic stand-in exercises audit logic only.
  class Stream { constructor(seed, cursor) { assert.equal(seed, SEED); this.cursor = cursor; } nextInt(min, max) { assert.equal(min, 1); assert.equal(max, 100); this.cursor++; return 29; } }
  return { runtime: { DeterministicActionRandomStream: Stream }, before, after, row, event };
}
test('transition evidence compares entire events, resource budgets, revisions and every RNG receipt', () => {
  const f = transitionFixture(); assert.equal(assertRecordedTransition(f.runtime, f.before, f.after, f.row, f.event), stateHash(f.event));
  for (const change of [
    f => { f.after.cash++; }, f => { f.after.random.cursor++; }, f => { f.after.random.seed = 'other'; },
    f => { f.after.revision++; }, f => { f.after.runId = 'replacement'; }, f => { f.before.status = 'DEAD'; },
    f => { f.after.fool.journal[0].hostProof.id = 'forged'; }, f => { f.row.journalEventId = 'other'; },
    f => { f.after.fool.journal[0].randomReceipts[0].check.roll++; f.event = structuredClone(f.after.fool.journal[0]); },
    f => { f.after.fool.journal[0].randomReceipts[0].cursorAfter++; f.event = structuredClone(f.after.fool.journal[0]); },
    f => { f.after.fool.journal[0].randomReceipts = []; f.event = structuredClone(f.after.fool.journal[0]); },
  ]) {
    const changed = transitionFixture(); change(changed);
    assert.throws(() => assertRecordedTransition(changed.runtime, changed.before, changed.after, changed.row, changed.event));
  }
});

test('guidance carries no RNG draw, no command receipt and no fabricated journal event', () => {
  const f = transitionFixture(); f.row.intent = { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } };
  f.after.random = structuredClone(f.before.random); f.after.fool.journal = []; f.row.after = budget(f.after); f.row.journalEventId = null;
  assert.equal(assertRecordedTransition(f.runtime, f.before, f.after, f.row, null), null);
  assert.throws(() => assertRecordedTransition(f.runtime, f.before, f.after, f.row, f.event));
  f.after.random.cursor++; f.row.after = budget(f.after);
  assert.throws(() => assertRecordedTransition(f.runtime, f.before, f.after, f.row, null));
});

test('capture shape refuses shortened tails and mismatched state counts before replay', () => {
  assert.throws(() => assertCaptureShape([], [], []));
  assert.throws(() => assertCaptureShape(states(), [], Array(2083).fill({ type: 'FOOL' })));
  assert.throws(() => assertCaptureShape(states().slice(0, -1), Array(215).fill({}), Array(2083).fill({ type: 'FOOL' })));
});


test('redaction mode requires an externally pinned final proof and exact audit-helper bytes', () => {
  const args = [...validArgs('redaction'), '--final-runtime-proof', '/bundle/final-runtime-proof.json', '--final-runtime-proof-sha256', H, '--public-audit-verifier-sha256', H];
  assert.equal(argumentsForEquivalence(args).mode, 'redaction');
  for (const edited of [validArgs('redaction'), args.slice(0, -2), args.slice(0, -4), [...validArgs('public'), '--final-runtime-proof', '/bundle/x'], [...args, '--public-audit-verifier-sha256', H]]) assert.throws(() => argumentsForEquivalence(edited));
});

test('redaction proof preserves all prior private and public hashes while claiming only three strict reruns', () => {
  const f = proofFixture(), prior = structuredClone(f.proof), proof = structuredClone(f.proof); proof.mode = 'redaction';
  for (const [index, row] of proof.rows.entries()) {
    const current = stateHash(['safe', index]);
    row.public = { currentSha256: current, sessionSha256: index ? current : null, strictSha256: [0, 1, 215].includes(index) ? current : null,
      legacySha256: prior.rows[index].public.strictSha256, recorded: recordedPublicEvidence(index, f.original) };
  }
  assertProof(proof, H, 'redaction', f.original, prior);
  assert.equal(proof.rows.filter(row => row.public.strictSha256).length, 3);
  assert.equal(proof.rows.filter(row => row.public.sessionSha256).length, 215);
  assert.throws(() => assertProof(proof, H, 'redaction', f.original));
  for (const change of [
    p => { p.rows[44].public.strictSha256 = p.rows[44].public.currentSha256; },
    p => { p.rows[1].public.strictSha256 = null; }, p => { p.rows[215].public.strictSha256 = null; },
    p => { p.rows[1].public.sessionSha256 = null; }, p => { p.rows[0].public.sessionSha256 = H; },
    p => { p.rows[44].public.legacySha256 = H; }, p => { p.rows[0].public.legacySha256 = H; },
    p => { p.rows[44].budgetSha256 = H; }, p => { p.rows[44].random.cursor++; }, p => { p.rows[44].eventSha256 = H; },
    p => { p.rows[44].public.recorded = { kind: 'ORIGINAL_RECONSTRUCTED_44', sha256: H }; },
    p => { p.rows[0].public.extra = true; }, p => { p.rows.reverse(); },
  ]) { const edited = structuredClone(proof); change(edited); assert.throws(() => assertProof(edited, H, 'redaction', f.original, prior)); }
});
