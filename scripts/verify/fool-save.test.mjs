import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { posix, resolve, win32 } from 'node:path';
import { FOOL_PUBLIC_REDACTION, assertFoolPublicRedactionEvidence, assertFoolPublicRedactionRow, restoreFoolLegacyPublicProjection, foolCaptureInputMembers, assertFoolFinalRuntimeDifference, assertFoolFinalRuntimeProof, assertFoolFinalRuntimeOptions, advanceFoolAuditState, assertFoolTransitionFreeze, assertFoolRuntimeTransition, assertFoolTransitionEndpoint, argumentsForSave, assertFoolCaptureProvenance, assertFoolOriginalLedgerPrefix, assertFoolOriginalResumeProvenance, assertFoolCapturedReplayState, assertFoolFreezeCompatibility, assertFoolInputEvidence, assertFoolResumeManifest, describeFoolBoundaries, assertFoolPublicProjection } from './fool-save.mjs';

// Pure small-object regressions only. No producer import, game/dist import,
// natural run, source fixture read, SQLite, filesystem mutation, or build.
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const row = (file, digit) => ({ file, bytes: 10, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: hash(files) });
const original = () => freeze([row('src/domain/fool/index.ts', '1'), row('dist/domain/fool/index.js', '2'), row('$natural-runner', '3')]);

test('immutable capture evidence requires exact hash, byte count and shape', () => {
  const expected = { bytes: 10, sha256: 'a'.repeat(64) };
  assertFoolInputEvidence(structuredClone(expected), expected, 'natural.json');
  for (const change of [{ bytes: 11 }, { sha256: 'b'.repeat(64) }, { extra: true }]) assert.throws(() => assertFoolInputEvidence({ ...expected, ...change }, expected));
});

test('freeze accepts the complete identical ordered source/compiled/runner bytes', () => {
  const a = original(); assertFoolFreezeCompatibility(a, structuredClone(a));
  for (const r of a.files) for (const delta of [{ bytes: 11 }, { sha256: 'f'.repeat(64) }]) {
    const changed = freeze(a.files.map(x => x.file === r.file ? { ...x, ...delta } : x));
    assert.throws(() => assertFoolFreezeCompatibility(a, changed));
  }
});

test('freeze rejects added/missing/reordered files and a forged digest', () => {
  const a = original();
  for (const files of [[...a.files, row('dist/extra.js', '4')], a.files.slice(1), [...a.files].reverse()]) assert.throws(() => assertFoolFreezeCompatibility(a, freeze(files)));
  assert.throws(() => assertFoolFreezeCompatibility({ ...a, sha256: '0'.repeat(64) }, a));
  assert.throws(() => assertFoolFreezeCompatibility(a, { ...a, sha256: '0'.repeat(64) }));
  assert.throws(() => assertFoolFreezeCompatibility(a, freeze([...a.files, a.files[0]])));
});

test('resume rejects changed runtime, inputs, producer, verifier or extra metadata', () => {
  const manifest = { runtimeFreezeSha256: 'a'.repeat(64), captureFreezeSha256: 'b'.repeat(64), verifierSha256: 'c'.repeat(64), producerSha256: 'd'.repeat(64), inputs: [{ file: 'natural.json', ...row('unused', 'e') }], transitionPlan: [{ commandCount: 1869, names: ['a'], endpointOnly: false }] };
  assertFoolResumeManifest(structuredClone(manifest), manifest);
  for (const key of ['runtimeFreezeSha256', 'captureFreezeSha256', 'verifierSha256', 'producerSha256']) assert.throws(() => assertFoolResumeManifest(manifest, { ...manifest, [key]: '0'.repeat(64) }));
  assert.throws(() => assertFoolResumeManifest(manifest, { ...manifest, inputs: [] }));
  assert.throws(() => assertFoolResumeManifest(manifest, { ...manifest, extra: true }));
});

function boundaryInput() {
  const prefix = 1868, commands = Array.from({ length: prefix }, () => ({ type: 'HISTORICAL_PLACEHOLDER' }));
  const intent = { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } }; commands.push(intent);
  const base = count => ({ phase: 'TEST', commandCount: count, commandIndex0: count - 1, revision: count + 1, stateSha256: (count === prefix ? 'a' : 'b').repeat(64),
    budget: {}, replayFrom: { file: 'natural.json', key: 'prefixFinal', sourceCommandCount: prefix, migrateToSchema: 205 }, inclusiveTailRange0: [prefix, count - 1] });
  const committed = { ...base(prefix + 1), beforeCommandCount: prefix, beforeStateSha256: 'a'.repeat(64), intent, intentCommitted: true };
  const pending = { ...base(prefix + 1), beforeCommandCount: prefix + 1, beforeStateSha256: 'b'.repeat(64), intent: { type: 'FOOL', command: { type: 'RECEPTION_WORK' } }, intentCommitted: false };
  return { prefix, commands, index: { boundaries: { 'original-full1868-migrated-start': base(prefix), 'actual-guidance': committed, 'before-a-future-action': structuredClone(committed), 'pending-current-state': pending } } };
}

test('same actual commandCount aliases deduplicate; original and pending marks are not transactions', () => {
  const { index, commands, prefix } = boundaryInput(), result = describeFoolBoundaries(index, commands, prefix);
  assert.equal(result.named.length, 4); assert.equal(result.transitions.size, 1);
  assert.deepEqual(result.transitions.get(1869).names, ['actual-guidance', 'before-a-future-action']);
  assert.equal(result.named[0].kind, 'ORIGINAL_SNAPSHOT_NO_TRANSACTION');
  assert.equal(result.named[3].kind, 'CURRENT_SNAPSHOT_PENDING_INTENT_NOT_COMMITTED');
});

test('aliases cannot disagree about hashes, and pending cannot pretend to be a committed before/after', () => {
  const a = boundaryInput(); a.index.boundaries['before-a-future-action'].stateSha256 = 'f'.repeat(64);
  assert.throws(() => describeFoolBoundaries(a.index, a.commands, a.prefix));
  const b = boundaryInput(); b.index.boundaries['pending-current-state'].beforeCommandCount = 1868;
  assert.throws(() => describeFoolBoundaries(b.index, b.commands, b.prefix));
  const c = boundaryInput(); c.index.boundaries['pending-current-state'].intentCommitted = 'false';
  assert.throws(() => describeFoolBoundaries(c.index, c.commands, c.prefix));
});

// The public validator delegates intent validity to the real runtime in an
// actual audit. This tiny strict callback recognizes only this legitimate
// intent so structural helper tests never load game code or broaden validation.
const runtime = { validateFoolCommand: c => !!c && Object.keys(c).length === 1 && c.type === 'LEARN_GUIDANCE' };
const seed = 'private-stream-original';
function projection(name = '测试角色') {
  return { character: { name }, lastCheck: { ability: 'will', baseAbility: 40, modifiers: [{ source: '公开修正', value: 0.5 }], effectiveAbility: 40.5, difficulty: 20, chance: 70, roll: 50, tier: 'SUCCESS' },
    natureWalker: { prices: { preparation: 180 } },
    fool: { title: '当前筹备', guidanceKnown: false, promoted: false, story: `${name}在接待处。`, nextStep: '核对原遗产。', risk: '费用会如实扣除。',
      resources: { health: 90.5, mind: 88.25, spirituality: 106.75, cash: '25便士', actionsRemaining: 3 },
      abilities: [{ id: 'ability-1', label: '已有能力', mastery: 2.5, description: '当前掌握。' }],
      actions: [{ id: 'guidance', label: '核对遗产', cost: '不花行动', enabled: true, reason: null, command: { type: 'LEARN_GUIDANCE' }, preferredAction: true }],
      sections: [{ id: 'requirements', title: '条件', lines: ['确认原物与当前位置。'] }], insideCase: false } };
}

test('legal public modifier.source, prices.preparation and fractional resources remain accepted', () => {
  const p = projection(); assert.equal(assertFoolPublicProjection(runtime, p, seed), p);
  for (const field of ['health', 'mind', 'spirituality']) for (const value of [-1, NaN, Infinity, null, '1']) {
    const q = projection(); q.fool.resources[field] = value; assert.throws(() => assertFoolPublicProjection(runtime, q, seed));
  }
  const q = projection(); q.fool.resources.actionsRemaining = 1.5; assert.throws(() => assertFoolPublicProjection(runtime, q, seed));
});

test('private seed/truth fields or the actual stream value cannot enter public data', () => {
  for (const field of ['seed', 'cursor', 'random', 'truth', 'worldDigest', 'randomReceipts']) {
    const p = projection(); p.fool.resources[field] = 'private'; assert.throws(() => assertFoolPublicProjection(runtime, p, seed));
  }
  const q = projection(); q.fool.story = `泄漏内容${seed}`; assert.throws(() => assertFoolPublicProjection(runtime, q, seed));
  const r = projection(); r.lastCheck.modifiers[0].truth = 'private'; assert.throws(() => assertFoolPublicProjection(runtime, r, seed));
  const s = projection(); s.fool.source = {}; assert.throws(() => assertFoolPublicProjection(runtime, s, seed));
  const t = projection(); t.fool.actions[0].command = { type: 'LEARN_GUIDANCE', outcome: 'SUCCESS' }; assert.throws(() => assertFoolPublicProjection(runtime, t, seed));
});

test('actual custom names containing marker words are preserved without hiding independent leakage', () => {
  for (const name of ['seed', 'cursor', 'receipt', 'digest', 'SHIELD_MAIN', 'seed cursor receipt digest SHIELD_MAIN']) assertFoolPublicProjection(runtime, projection(name), seed);
  const p = projection('seed cursor'); p.fool.story += ' 独立字段 digest'; assert.throws(() => assertFoolPublicProjection(runtime, p, seed));
  const q = projection('private'); q.fool.story += ` ${seed}`; assert.throws(() => assertFoolPublicProjection(runtime, q, seed), 'A short name cannot conceal the full raw stream value');
  assertFoolPublicProjection(runtime, projection(seed), seed); // A fully matching user-entered name is already public.
});

// Minimal synthetic 43-row / 44-state evidence. These fingerprints are test
// inputs only; verifyFoolCapture uses the reviewed immutable real fingerprints.
function reconstructedEvidence() {
  const context = { prefixCount: 1868, freezeSha256: 'f'.repeat(64), commandCount: 1912, source: 'source.json', sourceSha256: '9'.repeat(64), seed: 'test-original-stream' };
  const originalFreeze = freeze([row('source.json', '9'), row('$natural-runner', '8')]);
  const states = Array.from({ length: 44 }, (_, index) => ({ index, commandCount: 1868 + index, stateSha256: hash(['private', index]), publicSha256: hash(['public', index]),
    random: { seed: context.seed, cursor: 932 + index }, budget: { revision: 1869 + index, cursor: 932 + index, cash: 25, actions: 3 } }));
  const rows = states.slice(1).map((state, i) => ({ commandCount: state.commandCount, phase: 'TEST', intent: { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } },
    publicControl: { id: 'test', label: '公开原物', cost: '0', enabled: true }, before: states[i].budget, after: state.budget, journalEventId: null }));
  const jsonl = rows => rows.map(row => JSON.stringify(row) + '\n').join('');
  const evidence = text => ({ bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
  const texts = { 'terminated-commands.jsonl': jsonl(rows), 'freeze-before-natural.json': JSON.stringify(originalFreeze), 'baseline/states.jsonl': jsonl(states) };
  const interruption = { kind: 'EXPLICIT_MANUAL_INTERRUPTION_PARTIAL_CAPTURE', originalProcessTerminated: true, completePrivateStatePersisted: false,
    lastCompleteCommandCount: 1911, newCompleteCommandRows: 43, partialNextAction: 'UNKNOWN_NO_COMPLETED_LEDGER_ROW; not counted or claimed completed',
    freezeSha256: originalFreeze.sha256, finalRecordedBudget: states.at(-1).budget,
    files: Object.fromEntries(['terminated-commands.jsonl', 'freeze-before-natural.json'].map(name => [name, evidence(texts[name])])) };
  const summary = { kind: 'RECONSTRUCTED_FROM_EXACT_COMPLETED_PARTIAL_LEDGER_NOT_ORIGINAL_FULL_STATE_CAPTURE', mode: 'baseline', passed: true,
    newCommands: 43, final: states.at(-1).budget, stateSha256: states.at(-1).stateSha256, publicSha256: states.at(-1).publicSha256,
    ledgerHash: evidence(texts['terminated-commands.jsonl']).sha256, freeze: originalFreeze.sha256, originalCapturedFullState: false,
    allOriginalRecordedBudgetsControlsCursorsVerified: true, optimizedStateByStateEquivalent: false };
  texts['interruption.json'] = JSON.stringify(interruption); texts['baseline/summary.json'] = JSON.stringify(summary);
  const expectedEvidence = Object.fromEntries(Object.entries(texts).map(([file, text]) => [file, evidence(text)]));
  const provenance = { kind: 'EXACT_FINITE_STRATEGY_RECONSTRUCTION_OF_ORIGINAL_INTERRUPTED_PREFIX',
    originalCapture: { interruptionFile: 'output/qa-0208/manual-pause-1851/interruption.json', interruptionSha256: expectedEvidence['interruption.json'].sha256,
      originalCaptureFreezeSha256: originalFreeze.sha256, originalCapturedFullState: false, completedNewCommands: 43, lastCompleteCommandCount: 1911,
      ledgerFile: 'output/qa-0208/manual-pause-1851/terminated-commands.jsonl', ledgerSha256: expectedEvidence['terminated-commands.jsonl'].sha256, partialNextAction: interruption.partialNextAction },
    reconstruction: { kind: summary.kind, originalFrozenRuntimeBaselineStatesFile: 'output/qa-0208/manual-pause-1851/baseline/states.jsonl',
      baselineStatesSha256: expectedEvidence['baseline/states.jsonl'].sha256, baselineFinalStateSha256: summary.stateSha256, baselineFreezeSha256: originalFreeze.sha256,
      originalBoundarySnapshotsCaptured: false, boundaryHashesMeaning: 'REGENERATED_BY_EXACT_STRATEGY_FROM_FULL_STATE_EQUIVALENT_RECONSTRUCTION' },
    currentRuntimeFreezeSha256: context.freezeSha256, continuation: 'SAME_FINITE_STRATEGY_WITH_REPLAY_RESTORED_COUNTERS', replayEffects: 'IN_MEMORY_ONLY_NO_DUPLICATE_AUDIT_ROWS',
    verifiedCompletedRows: 43, verifiedStates: 44 };
  return { texts, expectedEvidence, context, provenance, rows, states };
}
const validateOriginal = f => assertFoolOriginalResumeProvenance(f.provenance, f.texts, f.expectedEvidence, f.context);

test('exact direct-original lineage keeps the original freeze separate from the current strict freeze', () => {
  const f = reconstructedEvidence(), result = validateOriginal(f);
  assert.deepEqual(result.provenance, f.provenance); assert.equal(result.rows.length, 43); assert.equal(result.states.length, 44);
  assert.notEqual(result.provenance.originalCapture.originalCaptureFreezeSha256, f.context.freezeSha256);
  assert.equal(result.provenance.originalCapture.originalCapturedFullState, false);
  const base = { kind: 'BASE', freezeSha256: f.context.freezeSha256 };
  assertFoolCaptureProvenance({ ...base, resumeProvenance: result.provenance }, base, result.provenance);
  assertFoolCaptureProvenance({ ...base, resumeProvenance: null }, base, null);
  for (const invalid of [base, { ...base, resumeProvenance: {} }, { ...base, resumeProvenance: null, extra: true }]) assert.throws(() => assertFoolCaptureProvenance(invalid, base, null));
});

test('each required original evidence byte/hash/size is pinned; no tar or full-state snapshot is needed', () => {
  for (const name of Object.keys(reconstructedEvidence().texts)) {
    const changedBytes = reconstructedEvidence(); changedBytes.texts[name] += ' '; assert.throws(() => validateOriginal(changedBytes), name);
    const changedDigest = reconstructedEvidence(); changedDigest.expectedEvidence[name].sha256 = '0'.repeat(64); assert.throws(() => validateOriginal(changedDigest), name);
    const changedSize = reconstructedEvidence(); changedSize.expectedEvidence[name].bytes++; assert.throws(() => validateOriginal(changedSize), name);
    const missing = reconstructedEvidence(); delete missing.texts[name]; assert.throws(() => validateOriginal(missing), name);
  }
  const extra = reconstructedEvidence(); extra.texts['frozen-original-runtime.tar.gz'] = 'not required'; assert.throws(() => validateOriginal(extra));
});

test('resume flags, counts, paths, private/public baseline digests and runtime binding are exact', () => {
  const corruptions = [
    f => { f.provenance.verifiedCompletedRows = 42; }, f => { f.provenance.verifiedStates = 43; },
    f => { f.provenance.currentRuntimeFreezeSha256 = f.provenance.originalCapture.originalCaptureFreezeSha256; },
    f => { f.context.freezeSha256 = '0'.repeat(64); }, f => { f.context.commandCount = 1910; },
    f => { f.provenance.originalCapture.originalCapturedFullState = true; },
    f => { f.provenance.originalCapture.interruptionSha256 = '0'.repeat(64); },
    f => { f.provenance.originalCapture.originalCaptureFreezeSha256 = '0'.repeat(64); },
    f => { f.provenance.originalCapture.ledgerSha256 = '0'.repeat(64); },
    f => { f.provenance.originalCapture.lastCompleteCommandCount++; },
    f => { f.provenance.originalCapture.ledgerFile = 'other/terminated-commands.jsonl'; },
    f => { f.provenance.originalCapture.interruptionFile = 'output/qa-0208/manual-pause-1851/other.json'; },
    f => { f.provenance.reconstruction.originalFrozenRuntimeBaselineStatesFile = 'other/states.jsonl'; },
    f => { f.provenance.reconstruction.baselineStatesSha256 = '0'.repeat(64); },
    f => { f.provenance.reconstruction.baselineFinalStateSha256 = '0'.repeat(64); },
    f => { f.provenance.reconstruction.baselineFreezeSha256 = '0'.repeat(64); },
    f => { f.provenance.reconstruction.originalBoundarySnapshotsCaptured = true; },
    f => { f.provenance.continuation = 'RESET_STRATEGY_COUNTERS'; },
    f => { f.provenance.replayEffects = 'REAPPLY_ORIGINAL_COMMANDS'; },
    f => { f.provenance.resumedCheckpoint = { sha256: 'a'.repeat(64) }; },
    f => { f.provenance.reconstruction.extra = true; },
  ];
  for (const corrupt of corruptions) { const f = reconstructedEvidence(); corrupt(f); assert.throws(() => validateOriginal(f)); }
});

test('original ledger must be an exact complete byte prefix, not a parsed equivalent', () => {
  const f = reconstructedEvidence(), original = Buffer.from(f.texts['terminated-commands.jsonl']);
  assertFoolOriginalLedgerPrefix(Buffer.concat([original, Buffer.from('{"new":true}\n')]), original);
  assert.throws(() => assertFoolOriginalLedgerPrefix(Buffer.from(' ' + original.toString()), original));
  assert.throws(() => assertFoolOriginalLedgerPrefix(Buffer.from(original.toString().replace('公开原物', '公开替代')), original));
  assert.throws(() => assertFoolOriginalLedgerPrefix(original.subarray(0, -1), original));
  assert.throws(() => assertFoolOriginalLedgerPrefix(original, original.subarray(0, -1)));
  const formatted = Buffer.from(f.rows.map(row => JSON.stringify(row, null, 1) + '\n').join(''));
  assert.throws(() => assertFoolOriginalLedgerPrefix(formatted, original));
});

test('all 44 reconstructed states compare private/public hashes, exact budgets and RNG to actual replay', () => {
  for (const actual of reconstructedEvidence().states) {
    const captured = { index: actual.index, commandCount: actual.commandCount, stateSha256: actual.stateSha256, publicSha256: actual.publicSha256 };
    assertFoolCapturedReplayState(captured, structuredClone(actual), actual);
    for (const key of ['index', 'commandCount', 'stateSha256', 'publicSha256']) {
      const changed = { ...captured, [key]: typeof captured[key] === 'number' ? captured[key] + 1 : '0'.repeat(64) };
      assert.throws(() => assertFoolCapturedReplayState(changed, actual, actual));
    }
    for (const key of ['stateSha256', 'publicSha256', 'budget', 'random']) {
      const changed = { ...actual, [key]: typeof actual[key] === 'string' ? '0'.repeat(64) : { ...actual[key], extra: true } };
      assert.throws(() => assertFoolCapturedReplayState(captured, changed, actual));
    }
  }
});

test('all later produced state rows also bind exact order, count and private hash without invented public evidence', () => {
  const actual = { index: 44, commandCount: 1912, stateSha256: 'a'.repeat(64), publicSha256: 'b'.repeat(64), random: {}, budget: {} };
  const captured = { index: 44, commandCount: 1912, stateSha256: 'a'.repeat(64) };
  assertFoolCapturedReplayState(captured, null, actual);
  for (const change of [{ index: 43 }, { commandCount: 1913 }, { stateSha256: '0'.repeat(64) }, { publicSha256: actual.publicSha256 }, { extra: true }]) assert.throws(() => assertFoolCapturedReplayState({ ...captured, ...change }, null, actual));
});

test('audit resume manifest binds original evidence and original-vs-current freeze without weakening prior bindings', () => {
  const f = reconstructedEvidence(), manifest = { runtimeFreezeSha256: f.context.freezeSha256, verifierSha256: 'a'.repeat(64), producerSha256: 'b'.repeat(64),
    inputs: ['capture'], originalResumeInputs: f.expectedEvidence, resumeProvenance: f.provenance };
  assertFoolResumeManifest(structuredClone(manifest), manifest);
  const changedEvidence = structuredClone(manifest); changedEvidence.originalResumeInputs['baseline/states.jsonl'].sha256 = '0'.repeat(64);
  assert.throws(() => assertFoolResumeManifest(changedEvidence, manifest));
  const changedLineage = structuredClone(manifest); changedLineage.resumeProvenance.originalCapture.originalCaptureFreezeSha256 = f.context.freezeSha256;
  assert.throws(() => assertFoolResumeManifest(changedLineage, manifest));
});

test('resealing synthetic evidence cannot bypass required baseline fields, counts or honest reconstruction flags', () => {
  const edits = [
    f => { const states = f.states; delete states[10].publicSha256; f.texts['baseline/states.jsonl'] = states.map(s => JSON.stringify(s) + '\n').join(''); },
    f => { f.states[10].commandCount++; f.texts['baseline/states.jsonl'] = f.states.map(s => JSON.stringify(s) + '\n').join(''); },
    f => { f.texts['baseline/states.jsonl'] = f.texts['baseline/states.jsonl'].trimEnd(); },
    f => { f.texts['baseline/states.jsonl'] += '\n'; },
    f => { f.texts['baseline/states.jsonl'] = f.states.slice(1).map(s => JSON.stringify(s) + '\n').join(''); },
    f => { const s = JSON.parse(f.texts['baseline/summary.json']); s.originalCapturedFullState = true; f.texts['baseline/summary.json'] = JSON.stringify(s); },
    f => { const s = JSON.parse(f.texts['baseline/summary.json']); s.optimizedStateByStateEquivalent = true; f.texts['baseline/summary.json'] = JSON.stringify(s); },
    f => { const s = JSON.parse(f.texts['baseline/summary.json']); s.extra = true; f.texts['baseline/summary.json'] = JSON.stringify(s); },
    f => { const s = JSON.parse(f.texts['interruption.json']); s.completePrivateStatePersisted = true; f.texts['interruption.json'] = JSON.stringify(s); },
    f => { const s = JSON.parse(f.texts['interruption.json']); s.newCompleteCommandRows++; f.texts['interruption.json'] = JSON.stringify(s); },
  ];
  for (const edit of edits) {
    const f = reconstructedEvidence(); edit(f);
    f.expectedEvidence = Object.fromEntries(Object.entries(f.texts).map(([name, text]) => [name, { bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }]));
    f.provenance.originalCapture.interruptionSha256 = f.expectedEvidence['interruption.json'].sha256;
    f.provenance.reconstruction.baselineStatesSha256 = f.expectedEvidence['baseline/states.jsonl'].sha256;
    assert.throws(() => validateOriginal(f));
  }
});


test('recorded provenance is exact POSIX text on every platform and cannot redirect evidence reads', () => {
  const f = reconstructedEvidence(), root = 'output/qa-0208/manual-pause-1851';
  assert.equal(f.provenance.originalCapture.interruptionFile, posix.join(root, 'interruption.json'));
  validateOriginal(f);
  const paths = [
    win32.join(root, 'interruption.json'), 'C:\\private\\interruption.json',
    '/output/qa-0208/manual-pause-1851/interruption.json', 'output/qa-0208/manual-pause-1851/../other/interruption.json',
    'output/qa-0208/manual-pause-1851/./interruption.json', '../output/qa-0208/manual-pause-1851/interruption.json',
    'output/qa-0208/manual-pause-1851//interruption.json', 'output/qa-0208/manual-pause-1851/%2e%2e/interruption.json',
    'output/qa-0208/manual-pause-1851/interruption.json\0',
  ];
  for (const path of paths) {
    const changed = reconstructedEvidence(); changed.provenance.originalCapture.interruptionFile = path;
    assert.throws(() => validateOriginal(changed), path);
  }
  const ledger = reconstructedEvidence(); ledger.provenance.originalCapture.ledgerFile = win32.join(root, 'terminated-commands.jsonl');
  assert.throws(() => validateOriginal(ledger));
  const baseline = reconstructedEvidence(); baseline.provenance.reconstruction.originalFrozenRuntimeBaselineStatesFile = win32.join(root, 'baseline', 'states.jsonl');
  assert.throws(() => validateOriginal(baseline));
});

const transitionPaths = ['$natural-runner', 'dist/domain/fool/engine.js', 'dist/domain/fool/engine.js.map', 'dist/domain/fool/materials.js', 'dist/domain/fool/materials.js.map', 'dist/domain/slice/index.js', 'dist/domain/slice/index.js.map', 'src/domain/fool/engine.ts', 'src/domain/fool/materials.ts', 'src/domain/slice/index.ts'];
function transitionEvidence() {
  const original = reconstructedEvidence();
  const beforeFiles = [row('package.json', '0'), ...transitionPaths.map((file, i) => row(file, (i + 1).toString(16)))];
  const oldFreeze = freeze(beforeFiles), newFreeze = freeze(beforeFiles.map(r => transitionPaths.includes(r.file) ? { ...r, bytes: 11, sha256: 'f'.repeat(64) } : r));
  const oldProvenance = { ...original.provenance, currentRuntimeFreezeSha256: oldFreeze.sha256 };
  const states = Array.from({ length: 69 }, (_, index) => ({ index, commandCount: 1868 + index, stateSha256: hash(['state', index]), ...(index < 44 ? { publicSha256: hash(['public', index]) } : {}) }));
  const rows = Array.from({ length: 68 }, (_, i) => ({ commandCount: 1869 + i, phase: 'PAID_SAME_ORIGINAL_MATERIALS', intent: { type: 'FOOL', command: { type: 'RECEPTION_WORK' } },
    publicControl: { id: 'work', label: '公开原物', cost: '1', enabled: true }, before: { revision: 1869 + i }, after: { revision: 1870 + i }, journalEventId: `event-${i}` }));
  const commands = [...Array.from({ length: 1868 }, () => ({ type: 'SOURCE' })), ...rows.map(row => row.intent)];
  const ledgerText = rows.map(row => JSON.stringify(row) + '\n').join('');
  const rawEvidence = rawText => ({ bytes: Buffer.byteLength(rawText), sha256: createHash('sha256').update(rawText).digest('hex') });
  const control = { format: 'FOOL208_DURABLE_ACTION_BOUNDARY_V1', resumable: true, reason: 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY',
    source: original.context.source, sourceSha256: original.context.sourceSha256, sourceCommandsSha256: 'b'.repeat(64), strategy: { id: 'ORIGINAL_FINITE' },
    currentRuntimeFreezeSha256: oldFreeze.sha256, resumeProvenance: oldProvenance, commandCount: 1936, phase: rows.at(-1).phase,
    ledgerSha256: rawEvidence(ledgerText).sha256, boundaries: { original: { commandCount: 1868, stateSha256: states[0].stateSha256 } }, observations: [],
    receptionActions: 52, materialAttempts: [['first', 1], ['second', 1]], beforeLastCommandCount: 1935, beforeLastStateSha256: states.at(-2).stateSha256,
    lastIntent: rows.at(-1).intent, pendingIntent: null, finalStateSha256: states.at(-1).stateSha256,
    continuationMeaning: 'INSIDE_GO_AFTER_COMMIT_BEFORE_CALLER_CONTINUES; REPLAY_THE_STRATEGY_TO_RESTORE_ALL_LOCALS',
    commandsSha256: hash(commands), commandRowsSha256: hash(rows), stateRowsSha256: hash(states) };
  const approved = { file: 'output/play/fool-02080-3SBoW5/checkpoint.json', bytes: 1234, sha256: 'c'.repeat(64), controlSha256: hash(control), oldFreezeSha256: oldFreeze.sha256,
    finalStateSha256: control.finalStateSha256, finalPublicSha256: 'd'.repeat(64), publicEvidenceFile: 'output/qa-0208/canonical-pause-1937/benchmark-before.json' };
  const priorPublic = { mode: 'before', freeze: oldFreeze.sha256, checkpoint: approved.sha256, initial: approved.finalStateSha256,
    public: approved.finalPublicSha256, random: { seed: original.context.seed, cursor: 934 } };
  const rawText = JSON.stringify(priorPublic, null, 2); approved.publicEvidence = rawEvidence(rawText);
  const manifest = { format: 'FOOL208_PINNED_RUNTIME_TRANSITION_V1', kind: 'CANONICAL_MATERIAL_REPLAY_AND_PREVIEW_AUDIT_WITH_SAME_ROOT_HISTORY_REUSE_ONLY',
    checkpoint: { file: approved.file, bytes: approved.bytes, sha256: approved.sha256, control, finalPublicSha256: approved.finalPublicSha256,
      finalPublicEvidence: { kind: 'COMPUTED_FROM_EXACT_PAUSED_PRIVATE_STATE_WITH_FROZEN_PREVIOUS_RUNTIME', file: approved.publicEvidenceFile, ...approved.publicEvidence, rawText } },
    oldFreeze, newFreeze, changedFiles: assertFoolTransitionFreeze(oldFreeze, newFreeze, structuredClone(newFreeze)) };
  const context = { manifestSha256: hash(manifest), currentFreeze: structuredClone(newFreeze), originalProvenance: oldProvenance,
    source: control.source, sourceSha256: control.sourceSha256, sourceCommandsSha256: control.sourceCommandsSha256, strategy: control.strategy,
    commands, states, ledgerBytes: Buffer.from(ledgerText), boundaries: structuredClone(control.boundaries) };
  const provenance = { ...oldProvenance, currentRuntimeFreezeSha256: newFreeze.sha256, verifiedCompletedRows: 68, verifiedStates: 69,
    runtimeTransition: { kind: 'EXACT_PAUSED_CHECKPOINT_REPLAY_WITH_APPROVED_RUNTIME_TRANSITION', manifestFile: 'output/qa-0208/canonical-pause-1937/runtime-transition.json', manifestSha256: context.manifestSha256,
      checkpointFile: approved.file, checkpointSha256: approved.sha256, previousRuntimeFreezeSha256: oldFreeze.sha256, currentRuntimeFreezeSha256: newFreeze.sha256,
      commandCount: 1936, finalStateSha256: approved.finalStateSha256 } };
  return { manifest, context, approved, provenance, rows, states };
}
const validateTransition = f => assertFoolRuntimeTransition(f.manifest, f.provenance, f.context, f.approved);

test('one pinned transition accepts 68 original rows, 69 private states, first44 public and a separate old endpoint public', () => {
  const f = transitionEvidence(), result = validateTransition(f);
  assert.deepEqual(result.provenance, f.provenance); assert.equal(result.provenance.verifiedCompletedRows, 68); assert.equal(result.provenance.verifiedStates, 69);
  assert.equal(result.provenance.originalCapture.completedNewCommands, 43); assert.equal(result.provenance.originalCapture.lastCompleteCommandCount, 1911);
  assert.equal(f.states.filter(s => Object.hasOwn(s, 'publicSha256')).length, 44);
  assertFoolTransitionEndpoint(result, 1936, f.approved.finalStateSha256, f.approved.finalPublicSha256, result.priorPublic.random);
});

test('transition permits exactly the ten reviewed file differences while current capture freeze stays fully exact', () => {
  const f = transitionEvidence(), { oldFreeze, newFreeze } = f.manifest;
  assert.equal(assertFoolTransitionFreeze(oldFreeze, newFreeze, f.context.currentFreeze).length, 10);
  const extra = freeze(newFreeze.files.map(r => r.file === 'package.json' ? { ...r, bytes: r.bytes + 1 } : r));
  assert.throws(() => assertFoolTransitionFreeze(oldFreeze, extra, extra));
  const missing = freeze(newFreeze.files.map(r => r.file === transitionPaths[0] ? oldFreeze.files.find(b => b.file === r.file) : r));
  assert.throws(() => assertFoolTransitionFreeze(oldFreeze, missing, missing));
  for (const altered of [freeze(newFreeze.files.slice(1)), freeze([...newFreeze.files].reverse()), freeze([...newFreeze.files, row('new.js', 'e')])]) assert.throws(() => assertFoolTransitionFreeze(oldFreeze, altered, altered));
  for (const path of transitionPaths) {
    const changedCurrent = freeze(newFreeze.files.map(r => r.file === path ? { ...r, bytes: 12 } : r));
    assert.throws(() => assertFoolTransitionFreeze(oldFreeze, newFreeze, changedCurrent), path);
  }
  const forged = { ...oldFreeze, sha256: '0'.repeat(64) }; assert.throws(() => assertFoolTransitionFreeze(forged, newFreeze, newFreeze));
});

test('transition rejects extra/missing provenance, generic checkpoint lineage, changed hashes/counts/paths and incomplete verification', () => {
  const edits = [
    f => { f.provenance.resumedCheckpoint = {}; }, f => { delete f.provenance.runtimeTransition; },
    f => { f.provenance.verifiedCompletedRows = 67; }, f => { f.provenance.verifiedStates = 68; },
    f => { f.provenance.currentRuntimeFreezeSha256 = f.approved.oldFreezeSha256; },
    f => { f.provenance.runtimeTransition.commandCount = 1935; },
    f => { f.provenance.runtimeTransition.manifestSha256 = '0'.repeat(64); },
    f => { f.provenance.runtimeTransition.checkpointSha256 = '0'.repeat(64); },
    f => { f.provenance.runtimeTransition.previousRuntimeFreezeSha256 = '0'.repeat(64); },
    f => { f.provenance.runtimeTransition.finalStateSha256 = '0'.repeat(64); },
    f => { f.provenance.runtimeTransition.manifestFile = win32.join('output/qa-0208/canonical-pause-1937', 'runtime-transition.json'); },
    f => { f.provenance.runtimeTransition.manifestFile = '../runtime-transition.json'; },
    f => { f.provenance.runtimeTransition.checkpointFile = 'other/checkpoint.json'; },
    f => { f.provenance.runtimeTransition.extra = true; }, f => { f.manifest.extra = true; },
    f => { f.manifest.checkpoint.sha256 = '0'.repeat(64); }, f => { f.manifest.checkpoint.bytes++; },
    f => { f.manifest.checkpoint.file = 'C:\\other\\checkpoint.json'; },
    f => { f.manifest.changedFiles[0].before.bytes++; }, f => { f.manifest.changedFiles.reverse(); },
  ];
  for (const edit of edits) { const f = transitionEvidence(); edit(f); assert.throws(() => validateTransition(f)); }
});

test('every original paused control value is pinned, including counters, observations, named boundaries and pending status', () => {
  const fields = ['receptionActions', 'materialAttempts', 'boundaries', 'observations', 'phase', 'lastIntent', 'beforeLastCommandCount', 'beforeLastStateSha256', 'pendingIntent', 'strategy', 'resumeProvenance', 'commandsSha256', 'commandRowsSha256', 'stateRowsSha256', 'ledgerSha256'];
  for (const field of fields) { const f = transitionEvidence(); f.manifest.checkpoint.control[field] = 'changed'; assert.throws(() => validateTransition(f), field); }
  const extra = transitionEvidence(); extra.manifest.checkpoint.control.extra = true; assert.throws(() => validateTransition(extra));
  const missing = transitionEvidence(); delete missing.manifest.checkpoint.control.commandsSha256; assert.throws(() => validateTransition(missing));
});

test('final capture must preserve all paused68 exact ledger bytes and intents and all paused69 state records', () => {
  const edits = [
    f => { f.context.ledgerBytes = Buffer.from(' ' + f.context.ledgerBytes.toString()); },
    f => { f.context.ledgerBytes = Buffer.from(f.context.ledgerBytes.toString().replace('公开原物', '公开替代')); },
    f => { f.context.ledgerBytes = f.context.ledgerBytes.subarray(0, -1); },
    f => { f.context.commands[1900] = { type: 'OTHER' }; },
    f => { f.context.commands = f.context.commands.slice(0, 1935); },
    f => { f.context.states[50].stateSha256 = '0'.repeat(64); },
    f => { f.context.states[43].publicSha256 = '0'.repeat(64); },
    f => { f.context.states[44].publicSha256 = '0'.repeat(64); },
    f => { f.context.states = f.context.states.slice(0, 68); },
    f => { f.context.boundaries.original.stateSha256 = '0'.repeat(64); },
  ];
  for (const edit of edits) { const f = transitionEvidence(); edit(f); assert.throws(() => validateTransition(f)); }
  const extended = transitionEvidence(); extended.context.commands.push({ type: 'NEW' }); extended.context.ledgerBytes = Buffer.concat([extended.context.ledgerBytes, Buffer.from('{"new":true}\n')]);
  extended.context.states.push({ index: 69, commandCount: 1937, stateSha256: '1'.repeat(64) }); validateTransition(extended);
});

test('resealed synthetic checkpoint cannot invent original public hashes for later25 or change paused positions', () => {
  const edits = [
    f => { f.context.states[44].publicSha256 = '0'.repeat(64); },
    f => { f.context.states[68].publicSha256 = f.approved.finalPublicSha256; },
    f => { f.context.states[50].index++; },
    f => { f.context.states[60].commandCount++; },
    f => { delete f.context.states[43].publicSha256; },
  ];
  for (const edit of edits) {
    const f = transitionEvidence(); edit(f); f.manifest.checkpoint.control.stateRowsSha256 = hash(f.context.states);
    f.approved.controlSha256 = hash(f.manifest.checkpoint.control); assert.throws(() => validateTransition(f));
  }
});

test('separate old endpoint public evidence is exact raw bytes and bound to the old runtime and checkpoint', () => {
  const edits = [
    f => { f.manifest.checkpoint.finalPublicSha256 = '0'.repeat(64); },
    f => { f.manifest.checkpoint.finalPublicEvidence.rawText += '\n'; },
    f => { f.manifest.checkpoint.finalPublicEvidence.sha256 = '0'.repeat(64); },
    f => { f.manifest.checkpoint.finalPublicEvidence.bytes++; },
    f => { f.manifest.checkpoint.finalPublicEvidence.file = 'other/benchmark-before.json'; },
    f => { f.manifest.checkpoint.finalPublicEvidence.kind = 'ORIGINAL_PUBLIC_STATE_CAPTURE'; },
  ];
  for (const edit of edits) { const f = transitionEvidence(); edit(f); assert.throws(() => validateTransition(f)); }
  const f = transitionEvidence(), result = validateTransition(f);
  assert.throws(() => assertFoolTransitionEndpoint(result, 1936, '0'.repeat(64), f.approved.finalPublicSha256, result.priorPublic.random));
  assert.throws(() => assertFoolTransitionEndpoint(result, 1936, f.approved.finalStateSha256, '0'.repeat(64), result.priorPublic.random));
  assert.throws(() => assertFoolTransitionEndpoint(result, 1936, f.approved.finalStateSha256, f.approved.finalPublicSha256, { ...result.priorPublic.random, cursor: 935 }));
});

test('transition manifest bytes, location and lineage become exact immutable audit-resume inputs', () => {
  const f = transitionEvidence(), evidence = { path: '/private/runtime-transition.json', bytes: 100, sha256: f.context.manifestSha256 };
  const saved = { verifierSha256: 'a'.repeat(64), runtimeFreezeSha256: f.context.currentFreeze.sha256, runtimeTransitionInput: evidence, resumeProvenance: f.provenance };
  assertFoolResumeManifest(structuredClone(saved), saved);
  for (const edit of [{ sha256: '0'.repeat(64) }, { bytes: 101 }, { path: '/other/runtime-transition.json' }]) assert.throws(() => assertFoolResumeManifest({ ...saved, runtimeTransitionInput: { ...evidence, ...edit } }, saved));
  const args = argumentsForSave(['--runtime-transition-file', '/private/runtime-transition.json', '--runtime-transition-sha256', f.context.manifestSha256]);
  assert.deepEqual(args, { runtimeTransitionFile: evidence.path, runtimeTransitionSha256: f.context.manifestSha256 });
  assert.throws(() => argumentsForSave(['--runtime-transition-sha256', f.context.manifestSha256, '--runtime-transition-sha256', f.context.manifestSha256]));
});


test('previous seven-file transition and previous kind cannot authorize the final material/preview changes', () => {
  const f = transitionEvidence(), { oldFreeze, newFreeze } = f.manifest;
  const materialPaths = ['dist/domain/fool/materials.js', 'dist/domain/fool/materials.js.map', 'src/domain/fool/materials.ts'];
  const previousSeven = freeze(newFreeze.files.map(r => materialPaths.includes(r.file) ? oldFreeze.files.find(b => b.file === r.file) : r));
  assert.throws(() => assertFoolTransitionFreeze(oldFreeze, previousSeven, previousSeven));
  for (const materialPath of materialPaths) {
    const incomplete = freeze(newFreeze.files.map(r => r.file === materialPath ? oldFreeze.files.find(b => b.file === r.file) : r));
    assert.throws(() => assertFoolTransitionFreeze(oldFreeze, incomplete, incomplete), materialPath);
  }
  f.manifest.kind = 'CANONICAL_ORIGIN_AND_SAME_ROOT_PUBLIC_HISTORY_REUSE_ONLY';
  assert.throws(() => validateTransition(f));
});


function finalRuntimeEvidence() {
  const captured = freeze([row('src/domain/fool/index.ts', '1'), row('dist/domain/fool/index.js', '2'), row('$natural-runner', '3'), row('package.json', '4')]);
  const current = freeze([row('src/domain/fool/index.ts', '5'), row('src/domain/fool/owned-session.ts', '6'), row('dist/domain/fool/index.js', '7'), row('dist/domain/fool/owned-session.js', '8'), row('$natural-runner', '9'), row('package.json', '4')]);
  const captureInputs = [{ file: 'natural.json', bytes: 100, sha256: 'a'.repeat(64) }, { file: 'resume-original/baseline/states.jsonl', bytes: 20, sha256: 'b'.repeat(64) }];
  const approved = { captureFreezeSha256: captured.sha256, captureInputs: structuredClone(captureInputs) };
  const proof = { format: 'FOOL208_CAPTURE_TO_FINAL_RUNTIME_V1', kind: 'POST_TERMINAL_PRIVATE_OWNED_SESSION_AND_TRANSACTION_INTEGRATION_ONLY', captureFreezeSha256: captured.sha256,
    captureInputs: structuredClone(captureInputs), finalRuntimeFreeze: current, changedFiles: assertFoolFinalRuntimeDifference(captured, current) };
  return { captured, current, captureInputs, approved, proof };
}
const verifyFinal = f => assertFoolFinalRuntimeProof(f.proof, f.captured, f.current, f.captureInputs, f.approved);

test('reviewed final runtime is separate from immutable capture and exact original inputs', () => {
  const f = finalRuntimeEvidence(), copy = structuredClone(f.captured), result = verifyFinal(f);
  assert.equal(result.captureFreezeSha256, f.captured.sha256); assert.equal(result.runtimeFreezeSha256, f.current.sha256);
  assert.notEqual(result.runtimeFreezeSha256, result.captureFreezeSha256); assert.deepEqual(f.captured, copy);
  assert.equal(result.changedFiles.filter(r => r.before === null).length, 2);
  assert.throws(() => assertFoolFreezeCompatibility(f.captured, f.current), 'Old exact-equality helper is never relaxed');
  assert.throws(() => assertFoolFinalRuntimeProof(f.proof, f.captured, f.current, f.captureInputs), 'Synthetic proof cannot replace actual pinned twelve-file evidence');
});

test('final-runtime delta allows only reviewed source and matching compiled paths; additions are narrower', () => {
  const changes = ['domain/fool/engine', 'domain/fool/index', 'domain/fool/fog', 'domain/fool/materials', 'domain/fool/fate', 'domain/fool/fate-host', 'domain/fool/escape', 'domain/fool/escape-host',
    'domain/slice/index', 'domain/slice/validation', 'application/slice-application', 'persistence/slice-store', 'simulation/slice-browser-bridge'];
  for (const stem of changes) for (const file of [`src/${stem}.ts`, `dist/${stem}.js`, `dist/${stem}.js.map`]) {
    const before = freeze([row(file, '1')]), after = freeze([row(file, '2')]); assert.equal(assertFoolFinalRuntimeDifference(before, after).length, 1);
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([]), after), `Existing-path allowlist cannot authorize new file ${file}`);
  }
  for (const stem of ['domain/fool/owned-session', 'application/slice-owned-runtime']) for (const file of [`src/${stem}.ts`, `dist/${stem}.js`, `dist/${stem}.js.map`]) {
    assert.deepEqual(assertFoolFinalRuntimeDifference(freeze([]), freeze([row(file, '2')])), [{ file, before: null, after: { bytes: 10, sha256: '2'.repeat(64) } }]);
  }
  for (const file of ['package.json', 'package-lock.json', 'src/domain/fool/types.ts', 'src/domain/fool/source.ts', 'src/domain/slice/migration.ts', 'src/domain/slice/types.ts', 'src/content/new.ts', 'src/renderer/FoolPanel.tsx', 'dist/domain/fool/other.js', 'dist/domain/fool/owned-session.d.ts']) {
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([row(file, '1')]), freeze([row(file, '2')])));
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([]), freeze([row(file, '2')])));
  }
});

test('final-runtime proof rejects resealed arbitrary drift, removals, reorder and non-POSIX paths', () => {
  const edits = [
    f => { f.current = freeze(f.current.files.map(r => r.file === 'package.json' ? { ...r, sha256: 'f'.repeat(64) } : r)); },
    f => { f.current = freeze(f.current.files.filter(r => r.file !== 'package.json')); },
    f => { f.current = freeze([...f.current.files].reverse()); },
    f => { f.current = freeze([...f.current.files, row('src/domain/fool/arbitrary.ts', 'f')]); },
  ];
  for (const edit of edits) { const f = finalRuntimeEvidence(); edit(f); f.proof.finalRuntimeFreeze = f.current; assert.throws(() => verifyFinal(f)); }
  for (const file of ['C:\\src\\domain\\fool\\owned-session.ts', 'src\\domain\\fool\\owned-session.ts', '../src/domain/fool/owned-session.ts', '/src/domain/fool/owned-session.ts', 'src/domain/fool/./owned-session.ts', 'src/domain/fool/owned-session.ts\0']) {
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([]), freeze([row(file, '1')])));
  }
});

test('final proof rejects every missing, changed, extra, reordered input or unreviewed delta value', () => {
  const edits = [
    f => { f.proof.kind = 'ALLOW_ANY_RUNTIME'; }, f => { f.proof.format = 'OTHER'; }, f => { f.proof.extra = true; },
    f => { f.proof.captureFreezeSha256 = f.current.sha256; }, f => { f.proof.finalRuntimeFreeze = f.captured; },
    f => { f.proof.changedFiles.pop(); }, f => { f.proof.changedFiles.reverse(); }, f => { f.proof.changedFiles[0].after.bytes++; },
    f => { f.proof.changedFiles[0].before = null; }, f => { f.proof.captureInputs[0].sha256 = 'f'.repeat(64); },
    f => { f.proof.captureInputs[0].bytes++; }, f => { f.proof.captureInputs[0].extra = true; },
    f => { f.proof.captureInputs.pop(); }, f => { f.proof.captureInputs.reverse(); },
    f => { f.captureInputs[0].sha256 = 'f'.repeat(64); }, f => { f.captureInputs[0].bytes++; },
    f => { f.captureInputs.push({ file: 'unexpected.json', bytes: 0, sha256: '0'.repeat(64) }); },
  ];
  for (const edit of edits) { const f = finalRuntimeEvidence(); edit(f); assert.throws(() => verifyFinal(f)); }
  const unchanged = finalRuntimeEvidence(); unchanged.proof.finalRuntimeFreeze = unchanged.current = unchanged.captured; unchanged.proof.changedFiles = [];
  assert.throws(() => verifyFinal(unchanged));
});

test('final proof CLI requires all three independently reviewed options and binds exact resume identity', () => {
  assert.equal(assertFoolFinalRuntimeOptions({}), false);
  const options = { finalRuntimeProof: '/private/final-runtime.json', finalRuntimeProofSha256: 'a'.repeat(64), runtimeFreezeSha256: 'b'.repeat(64) };
  assert.equal(assertFoolFinalRuntimeOptions(options), true);
  for (const key of Object.keys(options)) { const missing = { ...options }; delete missing[key]; assert.throws(() => assertFoolFinalRuntimeOptions(missing)); }
  for (const key of ['finalRuntimeProofSha256', 'runtimeFreezeSha256']) assert.throws(() => assertFoolFinalRuntimeOptions({ ...options, [key]: 'unreviewed' }));
  assert.deepEqual(argumentsForSave(['--final-runtime-proof', options.finalRuntimeProof, '--final-runtime-proof-sha256', options.finalRuntimeProofSha256, '--runtime-freeze-sha256', options.runtimeFreezeSha256]), options);
  assert.throws(() => argumentsForSave(['--runtime-freeze-sha256', options.runtimeFreezeSha256]));
  const saved = { captureFreezeSha256: 'c'.repeat(64), runtimeFreezeSha256: options.runtimeFreezeSha256, finalRuntimeProofInput: { path: options.finalRuntimeProof, bytes: 42, sha256: options.finalRuntimeProofSha256 }, producerSha256: 'd'.repeat(64), verifierSha256: 'e'.repeat(64) };
  assertFoolResumeManifest(structuredClone(saved), saved);
  for (const change of [{ path: '/different/proof.json' }, { bytes: 43 }, { sha256: 'f'.repeat(64) }]) assert.throws(() => assertFoolResumeManifest({ ...saved, finalRuntimeProofInput: { ...saved.finalRuntimeProofInput, ...change } }, saved));
});

function fakeOwnedRuntime() {
  const calls = [], before = { runId: 'test', revision: 1, status: 'ACTIVE', fool: { guidanceKnown: false } };
  const identity = s => ({ runId: s.runId, revision: s.revision, status: s.status });
  let current, next;
  const draft = {}, session = {
    inspect: () => identity(current), project: () => { calls.push('project'); return { revision: current.revision }; },
    prepare: (intent, revision) => { calls.push('prepare'); assert.equal(revision, current.revision); next = { ...current, revision: revision + 1 }; return draft; },
    snapshotDraft: d => { assert.equal(d, draft); calls.push('snapshot'); return structuredClone(next); },
    projectDraft: d => { assert.equal(d, draft); calls.push('projectDraft'); return { revision: next.revision }; },
    inspectDraft: d => { assert.equal(d, draft); return identity(next); },
    commit: d => { assert.equal(d, draft); calls.push('commit'); current = next; },
    discard: d => { assert.equal(d, draft); calls.push('discard'); next = null; },
  };
  const runtime = {
    applySliceIntent: s => { calls.push('strict-apply'); return { ...s, revision: s.revision + 1, fool: { guidanceKnown: true } }; },
    assertValidSliceState: s => { calls.push('strict-assert'); assert.equal(s.fool.guidanceKnown, true); },
    projectSliceState: s => { calls.push('strict-project'); return { revision: s.revision }; },
    openFoolRuntimeSession: s => { calls.push('strict-open'); current = structuredClone(s); return session; },
  };
  return { calls, before, session, runtime };
}

test('sequential owned audit retains strict guidance/open then uses real prepare, draft projection and commit', () => {
  const f = fakeOwnedRuntime(), intent = { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } };
  const first = advanceFoolAuditState(f.runtime, f.before, intent, null, true);
  assert.deepEqual(f.calls, ['strict-apply', 'strict-assert', 'strict-open', 'project']); assert.equal(first.session, f.session);
  f.calls.length = 0; const second = advanceFoolAuditState(f.runtime, first.state, intent, first.session, true);
  assert.deepEqual(f.calls, ['prepare', 'snapshot', 'projectDraft', 'commit']); assert.equal(second.state.revision, 3); assert.equal(first.state.revision, 2);
  assert.deepEqual(second.projection, { revision: 3 });
  assert.throws(() => advanceFoolAuditState(f.runtime, first.state, intent, first.session, true), 'Stale state cannot advance current session');
  assert.throws(() => advanceFoolAuditState(f.runtime, second.state, intent, first.session, false), 'No session path without separately reviewed runtime proof');
});

test('strict old-runtime route never opens a session; strict ingress or draft projection failures cannot commit', () => {
  const f = fakeOwnedRuntime(), intent = { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } };
  const plain = advanceFoolAuditState(f.runtime, f.before, intent, null, false);
  assert.equal(plain.session, null); assert.deepEqual(f.calls, ['strict-apply', 'strict-assert', 'strict-project']);
  f.runtime.assertValidSliceState = () => { throw Error('strict ingress invalid'); };
  assert.throws(() => advanceFoolAuditState(f.runtime, f.before, intent, null, true)); assert(!f.calls.includes('strict-open'));
  const g = fakeOwnedRuntime(), first = advanceFoolAuditState(g.runtime, g.before, intent, null, true); g.calls.length = 0;
  g.session.projectDraft = () => { throw Error('projection failed'); };
  assert.throws(() => advanceFoolAuditState(g.runtime, first.state, intent, g.session, true));
  assert.deepEqual(g.calls, ['prepare', 'snapshot', 'discard']); assert.equal(g.session.inspect().revision, first.state.revision);
});


test('only the exact independently authenticated bundled final-runtime proof is separate from original inputs', () => {
  const root = resolve('fixture'), original = ['natural.json', 'commands.jsonl', 'states.jsonl', 'boundaries.index.json', 'report.json', 'freeze.json', 'runtime-transition.json', 'resume-original'];
  const bundled = [...original, 'final-runtime-proof.json'], proof = { path: resolve(root, 'final-runtime-proof.json'), bytes: 739126, sha256: 'a'.repeat(64) };
  assert.deepEqual(foolCaptureInputMembers(root, bundled, proof), original.filter(file => file !== 'resume-original'));
  assert.deepEqual(foolCaptureInputMembers(root, original, { ...proof, path: resolve('private', 'reviewed.json') }), original.filter(file => file !== 'resume-original'));
  assert.deepEqual(foolCaptureInputMembers(root, original, null), original.filter(file => file !== 'resume-original'));
  assert.throws(() => foolCaptureInputMembers(root, bundled, null), 'Unrequested same-name file cannot escape the original capture inventory');
  for (const path of [resolve('elsewhere', 'final-runtime-proof.json'), resolve(root, 'runtime-transition.json'), 'final-runtime-proof.json']) {
    assert.throws(() => foolCaptureInputMembers(root, bundled, { ...proof, path }), 'The CLI must identify the exact bundled file');
  }
  for (const change of [{ bytes: -1 }, { sha256: 'unreviewed' }]) assert.throws(() => foolCaptureInputMembers(root, bundled, { ...proof, ...change }));
  for (const extra of ['extra.json', 'other-proof.json', 'FINAL-runtime-proof.json', 'another/final-runtime-proof.json']) {
    assert.throws(() => foolCaptureInputMembers(root, [...bundled, extra], proof));
    assert.throws(() => foolCaptureInputMembers(root, [...original, extra], proof));
  }
  assert.throws(() => foolCaptureInputMembers(root, bundled.filter(file => file !== 'states.jsonl'), proof));
  assert.throws(() => foolCaptureInputMembers(root, [...bundled, 'final-runtime-proof.json'], proof));
});


// Audit-only compatibility fixture. It represents the fixed, already-ended S1
// history layout without importing, validating or running the game runtime.
function redactionFixture() {
  const state = { runId: 'small-object-run', character: { name: '测试角色' }, random: { seed: 'synthetic-private-stream' }, combat: null,
    attendantMysteries: { encounter: { terminal: { historyIndex: 76 } } },
    combatHistory: Array.from({ length: 74 }, (_, index) => ({ round: index + 1, consequence: `Earlier public result ${index}` })) };
  const projectPlayerText = (value, name) => {
    if (typeof value === 'string') return value.replaceAll('{{player}}', name);
    if (Array.isArray(value)) return value.map(item => projectPlayerText(item, name));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, projectPlayerText(child, name)]));
  };
  for (let index = 0; index < 3; index++) {
    const round = index + 1, cursor = 100 + index * 10;
    const action = (order, actor) => ({ order, actor, label: '{{player}}的公开行动', sourceId: `visible-source-${order}`, paidCost: order,
      randomCursorBefore: cursor + order, randomCursorAfter: cursor + order + 1, playerHealthAfter: 90 - index,
      check: { modifiers: [{ source: '公开修正', value: 0.5 }] } });
    // Use a realistic legacy ordering with private fields interleaved. The
    // production state fingerprint canonicalizes object keys before hashing.
    const attendantMysteriesOutcome = { enemyHealth: 70 - index, targetId: 'AM1-ELIAS-VALE', round,
      source: { runId: state.runId, randomSeed: state.random.seed, revision: 1864 + index, round, description: '{{player}}的历史来源' },
      stance: 'BALANCED', continuing: index < 2, playerHealthAfter: 90 - index, rootAfter: { description: '{{player}}所见的公开现场' },
      elapsedSeconds: 60, randomCursorAfter: cursor + 8,
      playerActions: [action(1, 'PLAYER'), action(2, 'PLAYER')], enemyActions: [action(3, 'ENEMY')], expiredPending: [] };
    state.combatHistory.push({ round, stance: 'BALANCED', winner: 'PLAYER', consequence: `S1 public result ${round}`, attendantMysteriesOutcome });
  }
  state.lastCombatRound = structuredClone(state.combatHistory[76]);
  const legacyRound = raw => ({ ...structuredClone(raw), ...(raw.attendantMysteriesOutcome
    ? projectPlayerText({ attendantMysteriesOutcome: raw.attendantMysteriesOutcome }, state.character.name) : {}) });
  const legacy = { ...projection(state.character.name), combat: null, lastCombatRound: legacyRound(state.lastCombatRound),
    combatHistory: state.combatHistory.map(legacyRound), publicNotice: { text: 'Keep this current field intact.' } };
  const current = structuredClone(legacy);
  for (const round of [current.lastCombatRound, ...current.combatHistory.slice(74)]) {
    const outcome = round.attendantMysteriesOutcome;
    delete outcome.source; delete outcome.randomCursorAfter;
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) { delete action.randomCursorBefore; delete action.randomCursorAfter; }
  }
  return { state, current, legacy, projectPlayerText };
}
const restoreRedaction = f => restoreFoolLegacyPublicProjection(f.state, f.current, f.projectPlayerText);
const canonicalRedactionValue = value => Array.isArray(value) ? value.map(canonicalRedactionValue)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalRedactionValue(value[key])])) : value;
const canonicalRedactionHash = value => hash(canonicalRedactionValue(value));
const redactionOutcomes = p => [p.lastCombatRound.attendantMysteriesOutcome, ...p.combatHistory.slice(74).map(round => round.attendantMysteriesOutcome)];
const deeplyFreeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deeplyFreeze(child); Object.freeze(value); }
  return value;
};

test('redaction compatibility restores only the exact removed S1 fields for the canonical historical hash', () => {
  const f = redactionFixture(), restored = restoreRedaction(f);
  assert.deepEqual(restored, f.legacy);
  assert.equal(canonicalRedactionHash(restored), canonicalRedactionHash(f.legacy), 'The restored projection must reproduce the full canonical historical hash');
  assert.notEqual(canonicalRedactionHash(restored), canonicalRedactionHash(f.current));
  assert.deepEqual(restored.combatHistory.slice(0, 74), f.current.combatHistory.slice(0, 74));
  assert.deepEqual(restored.publicNotice, f.current.publicNotice);
  for (const [index, outcome] of redactionOutcomes(restored).entries()) {
    const publicOutcome = redactionOutcomes(f.current)[index];
    assert.deepEqual(Object.keys(outcome).filter(key => !Object.hasOwn(publicOutcome, key)), ['source', 'randomCursorAfter']);
    for (const side of ['playerActions', 'enemyActions']) for (const [i, action] of outcome[side].entries()) {
      assert.deepEqual(Object.keys(action).filter(key => !Object.hasOwn(publicOutcome[side][i], key)), ['randomCursorBefore', 'randomCursorAfter']);
      assert.equal(action.sourceId, publicOutcome[side][i].sourceId, 'Visible source identifiers remain ordinary public data');
      assert.deepEqual(action.check, publicOutcome[side][i].check);
    }
  }
});

test('redaction compatibility applies the same display adapter and never mutates either input', () => {
  const f = redactionFixture(), beforeState = structuredClone(f.state), beforeCurrent = structuredClone(f.current), calls = [];
  const adapt = f.projectPlayerText;
  f.projectPlayerText = (value, name) => { calls.push({ keys: Object.keys(value), name }); return adapt(value, name); };
  deeplyFreeze(f.state); deeplyFreeze(f.current);
  const restored = restoreRedaction(f);
  assert.deepEqual(f.state, beforeState); assert.deepEqual(f.current, beforeCurrent);
  assert.deepEqual(restored, f.legacy);
  assert(calls.length > 0);
  assert(calls.every(call => call.name === f.state.character.name && call.keys.length === 1 && call.keys[0] === 'attendantMysteriesOutcome'));
  for (const outcome of redactionOutcomes(restored)) {
    assert.equal(outcome.source.description, `${f.state.character.name}的历史来源`);
    assert.equal(outcome.rootAfter.description, `${f.state.character.name}所见的公开现场`);
    assert.equal(outcome.playerActions[0].label, `${f.state.character.name}的公开行动`);
  }
  restored.lastCombatRound.attendantMysteriesOutcome.source.description = 'Changed returned private compatibility object';
  restored.combatHistory[0].consequence = 'Changed returned ordinary history';
  restored.publicNotice.text = 'Changed returned public object';
  assert.deepEqual(f.state, beforeState); assert.deepEqual(f.current, beforeCurrent);
});

test('redaction compatibility rejects changed, missing or extra ordinary outcome fields at every restored location', () => {
  const edits = [
    outcome => { outcome.playerHealthAfter--; }, outcome => { delete outcome.stance; },
    outcome => { outcome.extraPublicField = true; }, outcome => { outcome.rootAfter.description = 'Different public scene'; },
    outcome => { outcome.expiredPending.push({ unexpected: true }); },
  ];
  for (let location = 0; location < 4; location++) for (const edit of edits) {
    const f = redactionFixture(); edit(redactionOutcomes(f.current)[location]);
    assert.throws(() => restoreRedaction(f), `Public outcome corruption at location ${location} must not be overwritten`);
  }
});

test('redaction compatibility rejects changed, missing, extra or reordered ordinary actions on both sides', () => {
  const edits = [
    action => { action.paidCost++; }, action => { delete action.label; }, action => { action.extraPublicField = true; },
    action => { action.sourceId = 'Different public source'; }, action => { action.check.modifiers[0].source = 'Different public modifier'; },
  ];
  for (let location = 0; location < 4; location++) for (const side of ['playerActions', 'enemyActions']) for (const edit of edits) {
    const f = redactionFixture(); edit(redactionOutcomes(f.current)[location][side][0]);
    assert.throws(() => restoreRedaction(f), `${side} ordinary data at location ${location} must not be overwritten`);
  }
  for (let location = 0; location < 4; location++) for (const edit of [
    outcome => { outcome.playerActions.reverse(); }, outcome => { outcome.enemyActions = []; },
    outcome => { outcome.playerActions.push(structuredClone(outcome.playerActions[0])); },
  ]) {
    const f = redactionFixture(); edit(redactionOutcomes(f.current)[location]); assert.throws(() => restoreRedaction(f));
  }
});

test('redaction compatibility rejects a current projection that still carries any removed field', () => {
  const edits = [
    (outcome, raw) => { outcome.source = structuredClone(raw.source); },
    (outcome, raw) => { outcome.randomCursorAfter = raw.randomCursorAfter; },
    outcome => { outcome.source = undefined; }, outcome => { outcome.randomCursorAfter = undefined; },
  ];
  for (const side of ['playerActions', 'enemyActions']) for (const key of ['randomCursorBefore', 'randomCursorAfter']) {
    edits.push((outcome, raw) => { outcome[side][0][key] = raw[side][0][key]; });
    edits.push(outcome => { outcome[side][0][key] = undefined; });
  }
  for (let location = 0; location < 4; location++) for (const edit of edits) {
    const f = redactionFixture(); edit(redactionOutcomes(f.current)[location], redactionOutcomes(f.legacy)[location]);
    assert.throws(() => restoreRedaction(f), `Existing private field at location ${location} cannot be silently scrubbed`);
  }
});

test('redaction compatibility is restricted to the fixed ended S1 history layout and source identity', () => {
  const edits = [
    f => { f.state.combat = {}; }, f => { f.current.combat = {}; },
    f => { delete f.state.combat; }, f => { delete f.current.combat; },
    f => { f.state.combatHistory.pop(); }, f => { f.current.combatHistory.pop(); },
    f => { f.state.combatHistory.push({ round: 78 }); }, f => { f.current.combatHistory.push({ round: 78 }); },
    f => { f.state.attendantMysteries.encounter.terminal.historyIndex = 75; },
    f => { f.state.attendantMysteries.encounter.terminal = null; },
    f => { f.state.lastCombatRound = structuredClone(f.state.combatHistory[75]); },
    f => { f.current.lastCombatRound = structuredClone(f.current.combatHistory[75]); },
    f => { f.state.combatHistory[73].attendantMysteriesOutcome = structuredClone(f.state.combatHistory[74].attendantMysteriesOutcome); },
    f => { f.current.combatHistory[73].attendantMysteriesOutcome = structuredClone(f.current.combatHistory[74].attendantMysteriesOutcome); },
  ];
  for (const historyIndex of [74, 75, 76]) {
    edits.push(f => { delete f.state.combatHistory[historyIndex].attendantMysteriesOutcome; });
    edits.push(f => { delete f.current.combatHistory[historyIndex].attendantMysteriesOutcome; });
    edits.push(f => { f.state.combatHistory[historyIndex].round++; });
    edits.push(f => { f.current.combatHistory[historyIndex].round++; });
    for (const [key, value] of [['runId', 'different-run'], ['randomSeed', 'different-seed'], ['revision', 0], ['round', 10]]) {
      edits.push(f => { f.state.combatHistory[historyIndex].attendantMysteriesOutcome.source[key] = value; });
    }
    edits.push(f => { f.state.combatHistory[historyIndex].attendantMysteriesOutcome.targetId = 'different-target'; });
    edits.push(f => { f.state.combatHistory[historyIndex].attendantMysteriesOutcome.round = 10; });
  }
  for (const edit of edits) { const f = redactionFixture(); edit(f); assert.throws(() => restoreRedaction(f)); }
});

test('redaction compatibility preserves unrelated current differences so the historical full hash still rejects them', () => {
  for (const edit of [
    f => { f.current.publicNotice.text = 'Different current notice'; },
    f => { f.current.combatHistory[10].consequence = 'Different earlier public result'; },
    f => { f.current.fool.resources.health--; },
  ]) {
    const f = redactionFixture(); edit(f); const restored = restoreRedaction(f);
    assert.deepEqual(restored.publicNotice, f.current.publicNotice);
    assert.deepEqual(restored.combatHistory[10], f.current.combatHistory[10]);
    assert.deepEqual(restored.fool, f.current.fool);
    assert.notEqual(canonicalRedactionHash(restored), canonicalRedactionHash(f.legacy), 'Only the removed S1 fields may be adapted for the old proof');
  }
  const leaked = redactionFixture(); leaked.current.publicNotice.randomCursorAfter = 42;
  const restored = restoreRedaction(leaked);
  assert.equal(restored.publicNotice.randomCursorAfter, 42, 'The compatibility helper must not broadly sanitize other locations');
  assert.throws(() => assertFoolPublicProjection(runtime, leaked.current, leaked.state.random.seed), 'The public validator independently rejects unrelated leakage');
});


test('only the explicit redaction delta adds S1 combat and public slice type paths', () => {
  for (const stem of ['domain/attendant-mysteries/combat', 'domain/slice/types']) for (const file of [`src/${stem}.ts`, `dist/${stem}.js`, `dist/${stem}.js.map`]) {
    const before = freeze([row(file, '1')]), after = freeze([row(file, '2')]);
    assert.throws(() => assertFoolFinalRuntimeDifference(before, after));
    assert.equal(assertFoolFinalRuntimeDifference(before, after, true).length, 1);
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([]), after, true), 'This is not permission to add other files');
  }
  for (const file of ['src/domain/attendant-mysteries/encounter.ts', 'dist/domain/attendant-mysteries/encounter.js', 'src/shared/player-text.ts', 'src/domain/slice/migration.ts', 'package-lock.json']) {
    assert.throws(() => assertFoolFinalRuntimeDifference(freeze([row(file, '1')]), freeze([row(file, '2')]), true));
  }
  const f = finalRuntimeEvidence(); f.proof.kind = 'POST_TERMINAL_PRIVATE_OWNED_SESSION_TRANSACTION_AND_ATTENDANT_PUBLIC_REDACTION';
  assert.throws(() => verifyFinal(f), 'New kind cannot omit exact old completed public evidence');
  f.proof.publicRedaction = {}; assert.throws(() => verifyFinal(f));
});

test('old public proof evidence cannot be substituted, shortened or self-resealed', () => {
  const evidence = { format: FOOL_PUBLIC_REDACTION.format, previousRuntimeFreezeSha256: FOOL_PUBLIC_REDACTION.previousRuntimeFreezeSha256,
    priorPublicProof: { bytes: FOOL_PUBLIC_REDACTION.priorProofBytes, sha256: FOOL_PUBLIC_REDACTION.priorProofSha256, rawText: ' '.repeat(FOOL_PUBLIC_REDACTION.priorProofBytes) } };
  assert.throws(() => assertFoolPublicRedactionEvidence(evidence));
  for (const edit of [e => { e.format = 'SKIP_PUBLIC'; }, e => { e.previousRuntimeFreezeSha256 = 'a'.repeat(64); }, e => { e.priorPublicProof.bytes--; },
    e => { e.priorPublicProof.rawText += '\n'; }, e => { e.priorPublicProof.sha256 = createHash('sha256').update(e.priorPublicProof.rawText).digest('hex'); }, e => { e.extra = true; }]) {
    const changed = structuredClone(evidence); edit(changed); assert.throws(() => assertFoolPublicRedactionEvidence(changed));
  }
});

test('restored hash comparison binds the same exact prior private state, budget, RNG and event', () => {
  const old = { stateSha256: 'a'.repeat(64), budgetSha256: 'b'.repeat(64), random: { seed: 'original', cursor: 12 }, eventSha256: 'c'.repeat(64), public: { strictSha256: 'd'.repeat(64) } };
  const prior = { rows: Array.from({ length: 216 }, () => structuredClone(old)) };
  const actual = { stateSha256: old.stateSha256, budgetSha256: old.budgetSha256, random: structuredClone(old.random), eventSha256: old.eventSha256, legacyPublicSha256: old.public.strictSha256 };
  assert.equal(assertFoolPublicRedactionRow(prior, 4, actual), old.public.strictSha256);
  for (const field of ['stateSha256', 'budgetSha256', 'eventSha256', 'legacyPublicSha256']) assert.throws(() => assertFoolPublicRedactionRow(prior, 4, { ...actual, [field]: 'e'.repeat(64) }));
  assert.throws(() => assertFoolPublicRedactionRow(prior, 4, { ...actual, random: { ...actual.random, cursor: 13 } }));
  for (const index of [-1, 216, 1.5]) assert.throws(() => assertFoolPublicRedactionRow(prior, index, actual));
  assert.throws(() => assertFoolPublicRedactionRow({ rows: prior.rows.slice(1) }, 4, actual));
  assert.throws(() => assertFoolPublicRedactionRow(prior, 4, { ...actual, currentPublicSha256: actual.legacyPublicSha256 }));
});
