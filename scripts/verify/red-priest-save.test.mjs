import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { argumentsForSave, assertFreeze, assertProducerOnlyFreezeChange, assertOriginalLedgerPrefix, assertContinuationPolicy, assertAuthorityContinuationPolicy, assertContinuationOrder, assertLogisticsPolicy, restoreBeforeLogistics, assertLogisticsReplayRows, assertLogisticsFreeze, assertRestorationPolicy, restoreBeforeRestoration, assertRestorationFreeze, assertRestorationReplayRows, assertPublicChain, assertResumeManifest, selectBoundaries, stateHash } from './red-priest-save.mjs';

// Small pure helper tests only: no producer, game/dist, source fixture, SQLite,
// filesystem writes, synthetic play, or natural-death claim.
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const row = (file, digit) => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, sha256: hash(files) });

test('freeze binds all exact ordered rows without runtime exceptions', () => {
  const original = freeze([row('src/a.ts', 'a'), row('dist/a.js', 'b'), row('$natural-producer', 'c')]);
  assertFreeze(original, structuredClone(original));
  for (const changed of [freeze([...original.files].reverse()), freeze(original.files.slice(1)), freeze([...original.files, row('extra', 'd')]),
    freeze(original.files.map(r => ({ ...r, bytes: 6 }))), { ...original, sha256: '0'.repeat(64) }, freeze([...original.files, original.files[0]])])
    assert.throws(() => assertFreeze(original, changed));
});

test('resume binds complete input hashes, runtime, source, verifier and selection', () => {
  const manifest = { source: row('natural.json', 'a'), verifier: row('verifier', 'b'), inputs: [row('checkpoint.json', 'c')], freeze: freeze([row('dist', 'd')]), selected: [{ commandCount: 796, names: ['guidance'] }] };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
  assert.throws(() => assertResumeManifest(manifest, { ...manifest, extra: true }));
});

function sample() {
  const commands = [{ type: 'LEARN_GUIDANCE' }, { type: 'MATERIAL', command: { type: 'RECOVER' } },
    { type: 'TRAVEL', to: 'actual-destination' }, { type: 'CAMPAIGN', command: { type: 'BATTLE', nodeId: 'actual-node' } },
    { type: 'CAMPAIGN', command: { type: 'BATTLE', nodeId: 'actual-node' } },
    { type: 'CONSUME', compoundId: 'actual-compound', confirmed: true }];
  const rows = commands.map((command, i) => ({ commandCount: 796 + i, revision: 797 + i, intent: { type: 'RED_PRIEST', command } }));
  const journal = rows.slice(1).map(r => ({ revision: r.revision, command: r.intent.command }));
  journal[2].campaignHost = { receipt: { kind: 'BATTLE', result: 'FAILURE' } };
  journal[3].campaignHost = { receipt: { kind: 'BATTLE', result: 'GREAT_SUCCESS' } };
  journal[4].materialReceipt = { consumption: { outcome: 'FAILURE', compoundId: 'actual-compound' } };
  return { rows, journal };
}

test('actual unique indices merge multiple boundary names and retain both battle outcomes', () => {
  const { rows, journal } = sample(), { selected, coverage } = selectBoundaries(rows, journal);
  assert.equal(selected.length, 6); assert.equal(new Set(selected.map(r => r.commandCount)).size, 6);
  assert.deepEqual(selected[3].names, ['command:CAMPAIGN:BATTLE', 'battle:failure']);
  assert.deepEqual(selected[4].names, ['battle:success']);
  assert.deepEqual(selected[5].names, ['command:CONSUME', 'consume:FAILURE', 'final-actual-transition']);
  assert.equal(coverage['command:CAMPAIGN:BATTLE'], 2); assert.equal(coverage['consume:SUCCESS'], undefined);
});

test('every material and epilogue command kind present gets a real representative', () => {
  const commands = [{ type: 'LEARN_GUIDANCE' }, ...['A', 'B', 'A'].map(type => ({ type: 'MATERIAL', command: { type } })),
    { type: 'EPILOGUE', command: { type: 'REPORT' } }];
  const rows = commands.map((command, i) => ({ commandCount: 796 + i, revision: 797 + i, intent: { type: 'RED_PRIEST', command } }));
  const journal = rows.slice(1).map(r => ({ revision: r.revision, command: r.intent.command }));
  const result = selectBoundaries(rows, journal); assert.equal(result.selected.length, 4);
  assert.deepEqual(result.selected.map(r => r.commandCount), [796, 797, 798, 800]);
  assert.equal(result.coverage['command:MATERIAL:A'], 2);
});

test('cannot fabricate journal boundaries, outcomes or consumption identity', () => {
  const a = sample(); a.journal[0].command = { type: 'REST' }; assert.throws(() => selectBoundaries(a.rows, a.journal));
  const b = sample(); b.journal[2].campaignHost.receipt.result = 'INVENTED'; assert.throws(() => selectBoundaries(b.rows, b.journal));
  const c = sample(); c.journal[4].materialReceipt.consumption.compoundId = 'different'; assert.throws(() => selectBoundaries(c.rows, c.journal));
  const d = sample(); d.journal.push(d.journal[0]); assert.throws(() => selectBoundaries(d.rows, d.journal));
  assert.throws(() => selectBoundaries([], []));
});

test('stable state hashes are order independent but preserve all values', () => {
  assert.equal(stateHash({ b: [2, 1], a: { y: 2, x: 1 } }), stateHash({ a: { x: 1, y: 2 }, b: [2, 1] }));
  assert.notEqual(stateHash({ b: [1, 2] }), stateHash({ b: [2, 1] }));
});

test('CLI requires exact explicit stale PID and rejects ambiguous or duplicate routes', () => {
  assert.deepEqual(argumentsForSave(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(argumentsForSave(['--resume-directory', 'prior', '--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--remove-stale-lock-pid', '0'], ['--remove-stale-lock-pid', 'NaN'], ['--resume-directory', 'x', '--output-directory', 'y'], ['--preflight', '--preflight'], ['--source-directory'], ['--unknown', 'x']])
    assert.throws(() => argumentsForSave(args));
});


test('continuation changes only producer bytes, never source, product or compiled rules', () => {
  const before = freeze([row('src/rules.ts', 'a'), row('dist/rules.js', 'b'), row('$natural-producer', 'c')]);
  const after = freeze([before.files[0], before.files[1], row('$natural-producer', 'd')]);
  assertProducerOnlyFreezeChange(before, after);
  for (const changed of [before, freeze([row('src/rules.ts', 'e'), ...after.files.slice(1)]), freeze([...after.files].reverse()),
    freeze([...after.files, row('dist/extra.js', 'f')]), freeze(after.files.slice(1))])
    assert.throws(() => assertProducerOnlyFreezeChange(before, changed));
});

test('continuation retains original complete ledger bytes exactly once as prefix', () => {
  const original = Buffer.from('{"commandCount":796}\n{"commandCount":797}\n');
  assertOriginalLedgerPrefix(Buffer.concat([original, Buffer.from('{"commandCount":798}\n')]), original);
  assert.throws(() => assertOriginalLedgerPrefix(Buffer.from('{"commandCount":796}\n'), original));
  assert.throws(() => assertOriginalLedgerPrefix(Buffer.from(' '+original.toString()), original));
  assert.throws(() => assertOriginalLedgerPrefix(original, original.subarray(0, -1)));
});


test('continuation permits only approved material cap six to twelve without other policy changes', () => {
  const before = { id: 'same', attemptsPerMaterialOperation: 6, maximumNewCommands: 900, noReroll: true };
  const after = { ...before, attemptsPerMaterialOperation: 12 }; assertContinuationPolicy(before, after);
  for (const changed of [{ ...after, attemptsPerMaterialOperation: 13 }, { ...after, maximumNewCommands: 1800 }, { ...after, noReroll: false }, { ...after, extra: true }])
    assert.throws(() => assertContinuationPolicy(before, changed));
});


test('authority continuation changes only cumulative authority five to twelve', () => {
  const before = { id: 'same', attemptsPerMaterialOperation: 12, authorityAttemptsPerPolity: 5, maximumNewCommands: 900, noReroll: true };
  const after = { ...before, authorityAttemptsPerPolity: 12 }; assertAuthorityContinuationPolicy(before, after);
  for (const changed of [{ ...after, authorityAttemptsPerPolity: 13 }, { ...after, attemptsPerMaterialOperation: 6 }, { ...after, maximumNewCommands: 1800 }, { ...after, noReroll: false }])
    assert.throws(() => assertAuthorityContinuationPolicy(before, changed));
  assert.throws(() => assertAuthorityContinuationPolicy({ ...before, authorityAttemptsPerPolity: 6 }, after));
});

test('only exact836,915,941,974 observations are permitted in their fixed ancestor order', () => {
  assertContinuationOrder(836); assertContinuationOrder(915); assertContinuationOrder(941); assertContinuationOrder(974); assertContinuationOrder(836, 836); assertContinuationOrder(915, 915);
  for (const count of [795, 837, 914, 916, 973, 975, null, '915']) assert.throws(() => assertContinuationOrder(count));
  assert.throws(() => assertContinuationOrder(915, 836)); assert.throws(() => assertContinuationOrder(941, 915));
});

test('all120 prior915 ledger rows are retained without a changed or truncated prefix', () => {
  const original = Buffer.from(Array.from({ length: 120 }, (_, i) => JSON.stringify({ commandCount: 796 + i })).join('\n')+'\n');
  assertOriginalLedgerPrefix(Buffer.concat([original, Buffer.from('{"commandCount":916}\n')]), original);
  assert.throws(() => assertOriginalLedgerPrefix(Buffer.from(original.toString().replace('"commandCount":900', '"commandCount":901')), original));
  assert.throws(() => assertOriginalLedgerPrefix(original.subarray(0, original.length - 1), original));
});


test('logistics policy adds only the explicit recovery flag without resetting limits', () => {
  const before = { attemptsPerMaterialOperation: 12, authorityAttemptsPerPolity: 12, battleAttemptsPerNode: 4, armisticeAttempts: 5 };
  assertLogisticsPolicy(before, { ...before, logisticsRecovery: true });
  for (const after of [{ ...before, logisticsRecovery: false }, { ...before, logisticsRecovery: true, battleAttemptsPerNode: 5 }, { ...before, logisticsRecovery: true, extra: true }])
    assert.throws(() => assertLogisticsPolicy(before, after));
});

const returnAction = () => ({ command: { type: 'CAMPAIGN', command: { type: 'RETURN_TO_HEADQUARTERS' } }, label: '沿原路回总部整备', enabled: true });
test('old-public restoration removes only one exact appended return action without mutation', () => {
  const old = { title: 'public', actions: [{ command: { type: 'REST' }, label: 'rest', enabled: true }] };
  const next = { ...old, actions: [...old.actions, returnAction()] };
  assert.deepEqual(restoreBeforeLogistics(next), old); assert.equal(next.actions.length, 2);
  assert.deepEqual(restoreBeforeLogistics(old), old);
  for (const actions of [[returnAction(), ...old.actions], [...next.actions, returnAction()], [...old.actions, { ...returnAction(), label: 'other' }]])
    assert.throws(() => restoreBeforeLogistics({ ...old, actions }));
  const changed = { ...next, title: 'changed old field' }; assert.notEqual(stateHash(restoreBeforeLogistics(changed)), stateHash(old));
});

function logisticsRows() {
  const rows = Array.from({ length: 146 }, (_, i) => ({ commandCount: 796 + i, afterStateSha256: stateHash(i), publicAfterSha256: stateHash({ old: i }), randomAfter: { seed: 'fixed', cursor: i } }));
  const proof = { continuedPublicSha256: stateHash({ new: 145 }), replay: { commands: 146, first: 796, last: 941, allPrivateAndRngEqual: true,
    publicDifference: 'Only appended RETURN_TO_HEADQUARTERS action', addedProjectionChecks: 18,
    rows: rows.map((r, i) => ({ commandCount: r.commandCount, stateSha256: r.afterStateSha256, capturedPublicSha256: r.publicAfterSha256, publicSha256: stateHash({ new: i }), random: r.randomAfter })) } };
  return { rows, proof };
}
test('941 proof binds all146 exact private, RNG and captured/current public hashes', () => {
  const { rows, proof } = logisticsRows(); assertLogisticsReplayRows(proof, rows);
  for (const field of ['stateSha256', 'capturedPublicSha256', 'commandCount', 'random']) {
    const changed = structuredClone(proof); changed.replay.rows[81][field] = null; assert.throws(() => assertLogisticsReplayRows(changed, rows));
  }
  const short = structuredClone(proof); short.replay.rows.pop(); assert.throws(() => assertLogisticsReplayRows(short, rows));
  const outcome = structuredClone(proof); outcome.replay.allPrivateAndRngEqual = false; assert.throws(() => assertLogisticsReplayRows(outcome, rows));
});

test('941 freeze admits exactly six reviewed runtime files plus producer, never broad exclusions', () => {
  const paths = ['src/domain/red-priest/campaign.ts', 'src/domain/red-priest/index.ts', 'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
  const changes = paths.map(file => ({ file, before: { bytes: 5, sha256: 'a'.repeat(64) }, after: { bytes: 6, sha256: 'b'.repeat(64) } }));
  const before = freeze([...changes.map(c => ({ file: c.file, ...c.before })), row('$natural-producer', 'c'), row('src/untouched.ts', 'd')]);
  const after = freeze([...changes.map(c => ({ file: c.file, ...c.after })), row('$natural-producer', 'e'), row('src/untouched.ts', 'd')]);
  assertLogisticsFreeze(before, after, changes);
  assert.throws(() => assertLogisticsFreeze(before, freeze([...after.files.slice(0, -1), row('src/untouched.ts', 'f')]), changes));
  assert.throws(() => assertLogisticsFreeze(before, after, changes.slice(1)));
  assert.throws(() => assertLogisticsFreeze(before, after, [...changes].reverse()));
  const wrong = structuredClone(changes); wrong[0].after.bytes++; assert.throws(() => assertLogisticsFreeze(before, after, wrong));
});


test('974 policy adds only explicit recovery flags and exact verified-personnel exit', () => {
  const before = { logisticsRecovery: true, attemptsPerMaterialOperation: 12, authorityAttemptsPerPolity: 12, battleAttemptsPerNode: 4, armisticeAttempts: 5 };
  const after = { ...before, fieldArmyRecovery: true, finiteSupplyRecovery: true, postwarFootReturn: true, verifiedPersonnelExit: '现有人员已经不足以完成剩余目标。继续交战不能补回损失，可以真实停战或保护撤离。' }; assertRestorationPolicy(before, after);
  for (const changed of [{ ...after, fieldArmyRecovery: false }, { ...after, finiteSupplyRecovery: false }, { ...after, postwarFootReturn: false }, { ...after, verifiedPersonnelExit: 'any warning' }, { ...after, battleAttemptsPerNode: 5 }, { ...after, extra: true }])
    assert.throws(() => assertRestorationPolicy(before, changed));
});

test('974 freeze binds exactly twelve approved source, runtime and renderer files', () => {
  const paths = ['src/domain/red-priest/campaign.ts', 'src/domain/red-priest/engine.ts', 'src/domain/red-priest/index.ts', 'src/domain/red-priest/types.ts', 'src/renderer/RedPriestPanel.tsx', 'src/renderer/SliceApp.tsx', 'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/engine.js', 'dist/domain/red-priest/engine.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
  const changes = paths.map(file => ({ file, before: { bytes: 5, sha256: 'a'.repeat(64) }, after: { bytes: 6, sha256: 'b'.repeat(64) } }));
  const before = freeze([...changes.map(c => ({ file: c.file, ...c.before })), row('$natural-producer', 'c'), row('src/untouched.ts', 'd')]);
  const after = freeze([...changes.map(c => ({ file: c.file, ...c.after })), row('$natural-producer', 'e'), row('src/untouched.ts', 'd')]);
  assertRestorationFreeze(before, after, changes);
  assert.throws(() => assertRestorationFreeze(before, freeze([...after.files.slice(0, -1), row('src/untouched.ts', 'f')]), changes));
  for (const bad of [changes.slice(0, 6), [...changes].reverse(), changes.map((c, i) => i === 6 ? { ...c, before: { ...c.before, bytes: 8 } } : c)])
    assert.throws(() => assertRestorationFreeze(before, after, bad));
  assert.throws(() => assertLogisticsFreeze(before, after, changes));
});

test('974 proof binds all179 private/RNG hashes and both historical public eras without gaps', () => {
  const rows = Array.from({ length: 179 }, (_, i) => ({ commandCount: 796 + i, afterStateSha256: stateHash(i), publicAfterSha256: stateHash({ era: i < 146 ? 'original' : 'return', i }), randomAfter: { seed: 'fixed', cursor: i } }));
  const proof = { continuedPublicSha256: stateHash({ new: 178 }), originalPublicSha256: rows.at(-1).publicAfterSha256, replay: { commands: 179, first: 796, last: 974, allPrivateAndRngEqual: true,
    publicDifference: 'Only appended recovery actions and campaign-readiness section; historical RETURN_TO_HEADQUARTERS projection preserved', addedProjectionChecks: 382,
    rows: rows.map((r, i) => ({ commandCount: r.commandCount, priorRuntimePublicSha256: i < 146 ? stateHash({ return: i }) : r.publicAfterSha256, stateSha256: r.afterStateSha256, capturedPublicSha256: r.publicAfterSha256, publicSha256: stateHash({ new: i }), random: r.randomAfter })) } };
  assertRestorationReplayRows(proof, rows);
  for (const index of [0, 145, 146, 178]) for (const field of ['stateSha256', 'capturedPublicSha256', 'priorRuntimePublicSha256', 'commandCount', 'random']) {
    const changed = structuredClone(proof); changed.replay.rows[index][field] = null; assert.throws(() => assertRestorationReplayRows(changed, rows));
  }
  for (const changed of [{ ...proof, replay: { ...proof.replay, rows: proof.replay.rows.slice(1) } }, { ...proof, replay: { ...proof.replay, addedProjectionChecks: 0 } }])
    assert.throws(() => assertRestorationReplayRows(changed, rows));
});

test('public chain rejects undeclared seams and any change outside the exact941 seam', () => {
  const old = '86f1b384408032f77881fd95db91a22c36079cdd45fce3c57901047e4cda09f0', next = 'c87ae3523ad27e645baf837a845579f7a223eb9b2c0c428562e0b0c6be9db5db';
  const previous = { publicAfterSha256: old }, row = { commandCount: 942, publicBeforeSha256: next };
  const lineage = { original: { commandCount: 941 }, runtimeTransition: { commandCount: 941, proofSha256: '3dbc170abff8c7310dd384677469a19d9f9e217a0653dfe8d6a78a18587b4b66', originalPublicSha256: old, continuedPublicSha256: next } };
  assertPublicChain(previous, row, lineage);
  assert.throws(() => assertPublicChain(previous, row));
  assert.throws(() => assertPublicChain(previous, { ...row, commandCount: 943 }, lineage));
  assert.throws(() => assertPublicChain(previous, { ...row, publicBeforeSha256: stateHash('unapproved') }, lineage));
  assert.throws(() => assertPublicChain(previous, row, { ...lineage, runtimeTransition: { ...lineage.runtimeTransition, proofSha256: stateHash('unapproved') } }));
});


test('974 restoration removes only exact ordered recovery suffix and public readiness section', () => {
  const old = { actions: [returnAction()], sections: [{ id: 'existing', title: 'existing', lines: ['retained'] }] };
  const rest = { command: { type: 'CAMPAIGN', command: { type: 'REST_FIELD_ARMIES' } }, label: '让总部原军休整', enabled: true };
  const supply = { command: { type: 'CAMPAIGN', command: { type: 'SUPPLY_ONLY', polityId: 'loen' } }, label: '运输鲁恩原库存补给', enabled: false };
  const section = { id: 'campaign-readiness', title: '胜算与有限兵员', lines: ['public current readiness'] };
  const next = { actions: [...old.actions, rest, supply], sections: [...old.sections, section] };
  assert.deepEqual(restoreBeforeRestoration(next), old); assert.equal(next.actions.length, 3); assert.equal(next.sections.length, 2);
  const foot = { command: { type: 'RETURN_ON_FOOT' }, label: '停战后沿原路步行返总部', enabled: true };
  assert.deepEqual(restoreBeforeRestoration({ actions: [...old.actions, foot], sections: old.sections }), old);
  for (const actions of [[rest, ...old.actions], [...old.actions, supply, rest], [...next.actions, supply], [...old.actions, { ...rest, label: 'other' }], [...old.actions, { ...supply, command: { type: 'CAMPAIGN', command: { type: 'SUPPLY_ONLY', polityId: 'unapproved' } } }]])
    assert.throws(() => restoreBeforeRestoration({ ...next, actions }));
  assert.throws(() => restoreBeforeRestoration({ ...next, sections: [...next.sections, section] }));
  assert.throws(() => restoreBeforeRestoration({ ...next, sections: [{ ...section, extra: 'private' }] }));
  const changed = { ...next, sections: [{ ...old.sections[0], lines: ['changed existing data'] }, section] };
  assert.notEqual(stateHash(restoreBeforeRestoration(changed)), stateHash(old));
});


test('974 inherited941 and new974 public seams are independently fixed and cannot move', () => {
  const inheritedRuntimeTransition = { commandCount: 941, proofSha256: '3dbc170abff8c7310dd384677469a19d9f9e217a0653dfe8d6a78a18587b4b66',
    originalPublicSha256: '86f1b384408032f77881fd95db91a22c36079cdd45fce3c57901047e4cda09f0', continuedPublicSha256: 'c87ae3523ad27e645baf837a845579f7a223eb9b2c0c428562e0b0c6be9db5db' };
  const runtimeTransition = { commandCount: 974, proofSha256: 'c5fa12707cde98bba0a775475d274c369f68267fe5d2991e5a04acaabb3ad201',
    originalPublicSha256: '89b59e830d4ca6bdfee64c6edc990fa8ea032b0ae553c313880679ef5ee7f3c4', continuedPublicSha256: '2b45e65b382e3aaf98e945347ea752294cdc3a26899f867272388f96d5c3b205' };
  const lineage = { original: { commandCount: 974 }, inheritedRuntimeTransition, runtimeTransition };
  for (const seam of [inheritedRuntimeTransition, runtimeTransition]) {
    const before = { publicAfterSha256: seam.originalPublicSha256 }, after = { commandCount: seam.commandCount + 1, publicBeforeSha256: seam.continuedPublicSha256 };
    assertPublicChain(before, after, lineage);
    assert.throws(() => assertPublicChain(before, { ...after, commandCount: after.commandCount + 1 }, lineage));
    assert.throws(() => assertPublicChain(before, { ...after, publicBeforeSha256: stateHash('drift') }, lineage));
  }
  const before = { publicAfterSha256: runtimeTransition.originalPublicSha256 }, after = { commandCount: 975, publicBeforeSha256: runtimeTransition.continuedPublicSha256 };
  assert.throws(() => assertPublicChain(before, after, { ...lineage, runtimeTransition: { ...runtimeTransition, proofSha256: inheritedRuntimeTransition.proofSha256 } }));
});

import { assertPlannedForkPrefix, assertPlannedForkReference, assertPlannedRows, assertPlannedFreezeSeparation } from './red-priest-save.mjs';
function plannedSample() {
  const seed = 'hunter-rebuild-first', source = 'tests/fixtures/conqueror-v01870/natural.json';
  const original = { commands: Array.from({ length: 795 }, (_, i) => ({ type: 'historical', i })), creation: { name: 'original' }, seed, initial: { original: true }, final: { random: { seed, cursor: 376 }, runId: 'original-run' } };
  const state = { revision: 919, runId: original.final.runId, status: 'ACTIVE', random: { seed, cursor: 423 }, redPriest: { campaign: { phase: 'CRISIS', warStarted: null, declaration: null } } };
  const historical = Array.from({ length: 188 }, (_, i) => {
    const intent = { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'REQUEST_AUTHORITY', polityId: `${i}` } } };
    return { commandCount: 796 + i, revision: 797 + i, intent, commandSha256: hash(intent), beforeStateSha256: stateHash(i === 123 ? state : { historicalState: i }),
      afterStateSha256: stateHash(i === 122 ? state : { historicalState: i + 1 }), publicBeforeSha256: stateHash({ historicalPublic: i }), publicAfterSha256: stateHash({ historicalPublic: i + 1 }),
      randomBefore: { seed, cursor: 376 + Math.floor(47 * i / 123) }, randomAfter: { seed, cursor: 376 + Math.floor(47 * (i + 1) / 123) } };
  });
  const root = { format: 'RED_PRIEST_EXACT_PREDECLARATION918_BRANCH_ROOT_V1', source, sourceSha256: '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973', prefixSha256: hash(original.commands), commandCount: 918,
    commands: historical.slice(0, 123).map(r => r.intent), rows: historical.slice(0, 123), initialStateSha256: historical[0].beforeStateSha256, finalStateSha256: stateHash(state), publicStateSha256: historical[122].publicAfterSha256, state, random: state.random };
  const initialPublicSha256 = stateHash({ current: 'exact opt-in action' });
  const commands = [{ type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } } }, { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'SCOUT', nodeId: 'actual' } } }];
  const final = { ...state, revision: 921, random: { seed, cursor: 424 } };
  const rows = commands.map((intent, i) => ({ commandCount: 919 + i, revision: 920 + i, intent, commandSha256: hash(intent), beforeStateSha256: i ? stateHash({ intermediate: true }) : root.finalStateSha256,
    afterStateSha256: i ? stateHash(final) : stateHash({ intermediate: true }), publicBeforeSha256: i ? stateHash({ planning: true }) : initialPublicSha256,
    publicAfterSha256: stateHash(i ? { finalPublic: true } : { planning: true }), randomBefore: { seed, cursor: 423 }, randomAfter: { seed, cursor: 423 + i } }));
  const cp = { format: 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1', source, sourceSha256: root.sourceSha256, prefixCount: 918, prefixSha256: hash([...original.commands, ...root.commands]), initialStateSha256: root.finalStateSha256, initialPublicStateSha256: initialPublicSha256,
    pending: null, terminal: { stage: 'ACTUAL_TEST_OUTCOME', reason: 'pure helper fixture' }, rows, commands, commandCount: 920, finalStateSha256: stateHash(final), publicStateSha256: rows.at(-1).publicAfterSha256, state: final, policyDefinition: { finite: true }, fork: { root: 'test-only' } };
  const capture = { prefixCount: 918, pendingIntent: null, ...cp.terminal, creation: original.creation, seed, initial: original.initial, commands: [...original.commands, ...root.commands, ...commands], final, policy: cp.policyDefinition, fork: cp.fork };
  return { original, historical, root, cp, capture, rows, initialPublicSha256 };
}
const assertPrefix = x => assertPlannedForkPrefix(x.root, x.original, x.historical);
const assertTail = x => assertPlannedRows(x.root, x.original, x.cp, x.capture, x.rows, x.initialPublicSha256);

test('planned fork retains exactly original795 and original796–918, never the later974 branch', () => {
  assertPrefix(plannedSample());
  for (const mutate of [x => x.root.source = 'other-source', x => x.root.sourceSha256 = 'a'.repeat(64), x => x.root.prefixSha256 = 'a'.repeat(64), x => x.root.commandCount = 974,
    x => x.root.commands.pop(), x => x.root.commands.push(x.root.commands[0]), x => x.root.rows.pop(), x => x.root.rows.push(x.historical[123]),
    x => x.root.commands[50] = { type: 'substituted' }, x => x.original.commands[400].i = -1,
    x => x.root.state.redPriest.campaign.planning = { enabled: true }, x => x.root.state.redPriest.campaign.warStarted = true]) {
    const x = plannedSample(); mutate(x); assert.throws(() => assertPrefix(x));
  }
});

test('planned historical prefix rejects RNG drift even if row source is altered together', () => {
  for (const mutate of [x => x.root.rows[40].randomAfter.seed = 'rerolled', x => x.root.rows[40].randomAfter.cursor++, x => x.root.random.seed = 'rerolled',
    x => x.root.rows[40].commandCount++, x => x.root.rows[40].commandSha256 = 'a'.repeat(64), x => x.root.rows[40].publicAfterSha256 = 'a'.repeat(64)]) {
    const x = plannedSample(); mutate(x); assert.throws(() => assertPrefix(x));
  }
});

test('planned branch is exact new tail with explicit public activation and one full retained prefix', () => {
  assertTail(plannedSample());
  for (const mutate of [x => x.cp.source = 'other-source', x => x.cp.sourceSha256 = 'a'.repeat(64), x => x.cp.prefixSha256 = 'a'.repeat(64), x => x.cp.prefixCount = 795,
    x => x.capture.commands.pop(), x => x.capture.commands.push(x.capture.commands[0]), x => x.cp.commands.pop(), x => x.rows.push(x.rows[0]),
    x => x.capture.commands[917] = { type: 'substituted' }, x => x.cp.lineage = { original: { commandCount: 974 } }, x => x.capture.prefixFinal = x.root.state,
    x => x.rows[0].intent.command.command.type = 'DECLARE', x => x.cp.initialStateSha256 = 'a'.repeat(64), x => x.rows[0].publicBeforeSha256 = x.root.publicStateSha256]) {
    const x = plannedSample(); mutate(x); assert.throws(() => assertTail(x));
  }
});

test('planned branch rejects seed/cursor drift, missing terminal evidence and false final state', () => {
  for (const mutate of [x => x.rows[0].randomBefore.seed = 'rerolled', x => x.rows[1].randomAfter.seed = 'rerolled', x => x.rows[1].randomBefore.cursor++,
    x => x.rows[1].randomAfter.cursor = 422, x => x.cp.pending = {}, x => x.cp.terminal = null, x => x.cp.state.revision++,
    x => x.rows[1].afterStateSha256 = 'a'.repeat(64), x => x.rows[1].publicBeforeSha256 = 'a'.repeat(64)]) {
    const x = plannedSample(); mutate(x); assert.throws(() => assertTail(x));
  }
});

test('planned fork proof reference is exact and cannot be redirected to974 or another file', () => {
  const reviewed = { rootFile: 'original-918-checkpoint.json', rootSha256: 'a'.repeat(64), proofFile: 'reconstruction-proof.json', proofSha256: 'b'.repeat(64), runtimeProofFile: 'runtime-transition.json', runtimeProofSha256: 'c'.repeat(64) };
  assertPlannedForkReference(structuredClone(reviewed), reviewed);
  for (const key of Object.keys(reviewed)) assert.throws(() => assertPlannedForkReference({ ...reviewed, [key]: 'different' }, reviewed));
  assert.throws(() => assertPlannedForkReference({ ...reviewed, continuationOf974: true }, reviewed));
});

test('planned runtime proof cannot reuse or exchange historical and current freeze identities', () => {
  const historical = freeze([row('runtime', 'a')]), current = freeze([row('runtime', 'b')]);
  const proof = { originalRuntimeFreezeSha256: historical.sha256, newRuntimeFreezeSha256: current.sha256 };
  assertPlannedFreezeSeparation(historical, current, proof);
  assert.throws(() => assertPlannedFreezeSeparation(current, historical, proof));
  assert.throws(() => assertPlannedFreezeSeparation(historical, historical, { ...proof, newRuntimeFreezeSha256: historical.sha256 }));
  assert.throws(() => assertPlannedFreezeSeparation(historical, current, { ...proof, originalRuntimeFreezeSha256: current.sha256 }));
});

import { restoreBeforePlanning } from './red-priest-save.mjs';
test('planning normalization removes only the exact last opt-in action and no old public fields', () => {
  const old = { title: 'original title', actions: [{ id: 'red-priest-action-1', command: { type: 'REST' }, label: '原休养' }], sections: [{ id: 'original', lines: ['unchanged'] }] };
  const action = { id: 'red-priest-action-2', command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } }, label: '启用本场战争筹备',
    cost: '不花行动、时间或费用；须在签发发动命令前选择，之后每次侦察和保护性准备照实支付，不能补写过去战果', enabled: true, reason: null };
  const view = { ...old, actions: [...old.actions, action] };
  assert.deepEqual(restoreBeforePlanning(view), old); assert.deepEqual(restoreBeforePlanning(old), old); assert.equal(view.actions.length, 2);
  for (const mutate of [x => x.actions.reverse(), x => x.actions.push({ ...action, id: 'red-priest-action-3' }), x => x.actions.at(-1).label = 'changed',
    x => x.actions.at(-1).preferredAction = true, x => x.actions.at(-1).cost = 'free bonuses', x => x.actions.at(-1).id = 'different',
    x => x.actions.at(-1).reason = 'still enabled', x => { x.actions.at(-1).enabled = false; }]) {
    const changed = structuredClone(view); mutate(changed); assert.throws(() => restoreBeforePlanning(changed));
  }
  assert.notEqual(stateHash(restoreBeforePlanning({ ...view, title: 'changed old title' })), stateHash(old));
  assert.notEqual(stateHash(restoreBeforePlanning({ ...view, sections: [...old.sections, { id: 'unapproved' }] })), stateHash(old));
});

import { assertPlanningReplayRows } from './red-priest-save.mjs';
function planningEquivalenceSample() {
  const rows = Array.from({ length: 188 }, (_, i) => ({ commandCount: 796 + i, beforeStateSha256: stateHash({ state: i }), afterStateSha256: stateHash({ state: i + 1 }),
    randomBefore: { seed: 'original', cursor: i }, randomAfter: { seed: 'original', cursor: i + 1 }, publicBeforeSha256: stateHash({ capturedBefore: i }), publicAfterSha256: stateHash({ capturedAfter: i }) }));
  const restoration = { replay: { rows: rows.slice(0, 179).map((r, i) => ({ publicSha256: stateHash({ recoveryPublic: i }) })) } };
  const priorAfter = i => i < 179 ? restoration.replay.rows[i].publicSha256 : rows[i].publicAfterSha256;
  const proof = { replay: { commands: 188, first: 796, last: 983, allPrivateAndRngEqual: true, allExistingPublicFieldsEqual: true, allowedPublicChanges: ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION'],
    rows: rows.map((r, i) => ({ commandCount: r.commandCount, beforeStateSha256: r.beforeStateSha256, stateSha256: r.afterStateSha256, randomBefore: r.randomBefore, random: r.randomAfter,
      capturedPublicBeforeSha256: r.publicBeforeSha256, capturedPublicSha256: r.publicAfterSha256, priorRuntimePublicBeforeSha256: i ? priorAfter(i - 1) : r.publicBeforeSha256,
      priorRuntimePublicSha256: priorAfter(i), publicBeforeSha256: stateHash({ planningPublic: i }), publicSha256: stateHash({ planningPublic: i + 1 }), privateAndRngEqual: true, allExistingPublicFieldsEqual: true })) } };
  return { rows, restoration, proof };
}
test('planning equivalence binds all188 original private/RNG rows and both archived public eras', () => {
  const good = planningEquivalenceSample(); assertPlanningReplayRows(good.proof, good.rows, good.restoration);
  for (const mutate of [x => x.proof.replay.rows.pop(), x => x.proof.replay.rows.push(x.proof.replay.rows[0]), x => x.proof.replay.allPrivateAndRngEqual = false,
    x => x.proof.replay.allowedPublicChanges.push('OTHER_OLD_FIELD'), x => x.proof.replay.rows[40].stateSha256 = 'a'.repeat(64),
    x => x.proof.replay.rows[40].random = { seed: 'changed', cursor: 41 }, x => x.proof.replay.rows[40].commandCount++,
    x => x.proof.replay.rows[147].priorRuntimePublicSha256 = x.rows[147].publicAfterSha256,
    x => x.proof.replay.rows[179].priorRuntimePublicSha256 = x.proof.replay.rows[178].priorRuntimePublicSha256,
    x => x.proof.replay.rows[120].capturedPublicSha256 = 'a'.repeat(64), x => x.proof.replay.rows[120].publicBeforeSha256 = 'a'.repeat(64),
    x => x.proof.replay.rows[120].allExistingPublicFieldsEqual = false]) {
    const x = planningEquivalenceSample(); mutate(x); assert.throws(() => assertPlanningReplayRows(x.proof, x.rows, x.restoration));
  }
});

test('actual prepared-battle outcomes and distinct selected plans are SQLite boundary candidates', () => {
  const commands = [{ type: 'ENABLE_PLANNING' }, { type: 'RECONNOITRE', nodeId: 'actual' },
    { type: 'SELECT_BATTLE_PLAN', nodeId: 'actual', stance: 'COORDINATED', extraSupplies: true },
    { type: 'SELECT_BATTLE_PLAN', nodeId: 'actual', stance: 'PROTECTIVE', extraSupplies: false },
    { type: 'PREPARED_BATTLE', nodeId: 'actual' }, { type: 'PREPARED_BATTLE', nodeId: 'actual' }];
  const rows = commands.map((command, i) => ({ commandCount: 919 + i, revision: 920 + i, intent: { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command } } }));
  const journal = rows.map(row => ({ revision: row.revision, command: row.intent.command }));
  journal[4].campaignHost = { receipt: { kind: 'BATTLE', result: 'FAILURE' } }; journal[5].campaignHost = { receipt: { kind: 'BATTLE', result: 'SUCCESS' } };
  const selected = selectBoundaries(rows, journal); assert.equal(selected.selected.length, 6);
  assert.equal(selected.coverage['plan:COORDINATED:extra-supplies'], 1); assert.equal(selected.coverage['plan:PROTECTIVE:ordinary-supplies'], 1);
  assert.equal(selected.coverage['battle:failure'], 1); assert.equal(selected.coverage['battle:success'], 1);
});

test('planned CLI is explicit and does not redirect the legacy verifier accidentally', () => {
  assert.deepEqual(argumentsForSave(['--planned-fork', '--fork-directory', 'root', '--archive-directory', 'old', '--planning-equivalence-proof', 'proof', '--planning-equivalence-sha256', 'a'.repeat(64), '--preflight']),
    { plannedFork: true, forkDirectory: 'root', archiveDirectory: 'old', planningEquivalenceProof: 'proof', planningEquivalenceSha256: 'a'.repeat(64), preflight: true });
  assert.throws(() => argumentsForSave(['--fork-directory', 'root'])); assert.throws(() => argumentsForSave(['--planned-fork', '--planned-fork']));
});

import { completedRedPriestSqliteCase } from './red-priest-save.mjs';
test('original983 withdrawal SQLite completion never aliases planned-branch command983', () => {
  const planned = { commandCount: 983, names: ['planned'] }, original983 = { commandCount: 983, names: ['original983:actual-protective-withdrawal'] };
  const index = { results: [planned], original983 };
  assert.equal(completedRedPriestSqliteCase(index, { commandCount: 983 }, true), planned);
  assert.equal(completedRedPriestSqliteCase(index, { commandCount: 983, case: 'original983-withdrawal' }, true), original983);
  assert.equal(completedRedPriestSqliteCase({ results: [planned] }, { commandCount: 983, case: 'original983-withdrawal' }, true), undefined);
  assert.throws(() => completedRedPriestSqliteCase(index, { commandCount: 983, case: 'original983-withdrawal' }, false));
  assert.throws(() => completedRedPriestSqliteCase(index, { commandCount: 982, case: 'original983-withdrawal' }, true));
  assert.throws(() => completedRedPriestSqliteCase(index, { commandCount: 983, case: 'other' }, true));
});

import { assertArtifactLocations, assertPlannedContinuation } from './red-priest-save.mjs';
test('portable artifact map keeps old absolute provenance names opaque and accepts only safe physical locations', () => {
  const entry = { kind: 'ARTIFACT', name: '/old/machine/output/proof.json', bytes: 5, sha256: 'a'.repeat(64), path: 'proofs/proof.json' };
  const map = { format: 'RED_PRIEST_PLANNED_VERIFIER_ARTIFACT_MAP_V1', entries: [entry, { ...entry, kind: 'FROZEN_RUNTIME', name: '$natural-producer', path: 'historical-sources/producer.mjs' }] };
  assertArtifactLocations(map);
  for (const path of ['/absolute', '../escape', 'nested/../../escape', './file', 'nested//file', 'nested/./file', 'C:/escape', 'nested\\file', '', 'a\0b'])
    assert.throws(() => assertArtifactLocations({ ...map, entries: [{ ...entry, path }] }));
  for (const mutate of [x => x.entries.push({ ...entry }), x => x.entries[0].kind = 'UNKNOWN', x => x.entries[0].sha256 = 'bad', x => x.entries[0].bytes = -1,
    x => x.entries[0].extra = true, x => x.entries[1].name = '../not-a-frozen-file', x => x.extra = true]) {
    const changed = structuredClone(map); mutate(changed); assert.throws(() => assertArtifactLocations(changed));
  }
});
function armisticeContinuationSample() {
  const prior = { commandCount: 1017, rows: Array.from({ length: 99 }, (_, i) => ({ commandCount: 919 + i, exact: i })),
    commands: Array.from({ length: 99 }, (_, i) => ({ command: i })), policyDefinition: { id: 'same', armisticeAttempts: 5, noReroll: true },
    policy: { phase: 'WAR', attempts: { negotiations: 5 } }, terminal: { stage: 'FINITE_CAMPAIGN_REVIEW_REQUIRED', reason: 'observed refusal' },
    fork: { original: '918' }, finalStateSha256: stateHash('1017'), publicStateSha256: stateHash('public1017'), state: { random: { seed: 'original', cursor: 434 } },
    initialStateSha256: stateHash('918'), initialPublicStateSha256: stateHash('public918') };
  const cp = { ...prior, commandCount: 1018, rows: [...prior.rows, { commandCount: 1018, beforeStateSha256: prior.finalStateSha256, publicBeforeSha256: prior.publicStateSha256, randomBefore: prior.state.random }],
    commands: [...prior.commands, { command: 'new' }], policyDefinition: { ...prior.policyDefinition, armisticeAttempts: 20 }, freezeSha256: 'a'.repeat(64) };
  const proof = { format: 'RED_PRIEST1017_ARMISTICE_OBSERVATION_CONTINUATION_V1', originalPolicyDefinition: prior.policyDefinition, continuedPolicyDefinition: cp.policyDefinition,
    originalPolicyState: prior.policy, originalTerminal: prior.terminal, priorFork: prior.fork, onlyAllowedFreezeChange: ['$natural-producer'], newFreezeSha256: cp.freezeSha256,
    originalRowsSha256: hash(prior.rows), originalCommandsSha256: hash(prior.commands) };
  return { proof, prior, cp };
}
test('1017 continuation changes only five-to-twenty cap and preserves every99 original rows and RNG seam', () => {
  const good = armisticeContinuationSample(); assertPlannedContinuation(good.proof, good.prior, good.cp);
  for (const mutate of [x => x.cp.rows[40] = { changed: true }, x => x.cp.commands[40] = { changed: true }, x => x.cp.rows.pop(),
    x => x.cp.policyDefinition.noReroll = false, x => x.cp.policyDefinition.armisticeAttempts = 21, x => x.proof.originalPolicyState = {},
    x => x.proof.originalRowsSha256 = 'b'.repeat(64), x => x.proof.onlyAllowedFreezeChange.push('src/rules.ts'), x => x.cp.rows[99].randomBefore = { seed: 'other', cursor: 434 },
    x => x.cp.rows[99].commandCount++, x => x.cp.rows[99].beforeStateSha256 = 'b'.repeat(64), x => x.proof.priorFork = { original: '974' },
    x => x.cp.initialStateSha256 = 'b'.repeat(64), x => x.prior.continuation = { nested: true }]) {
    const x = armisticeContinuationSample(); mutate(x); assert.throws(() => assertPlannedContinuation(x.proof, x.prior, x.cp));
  }
});


test('accepted and refused armistices and both exact continuation boundaries are actual SQLite candidates', () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ commandCount: 1016 + i, revision: 1017 + i,
    intent: { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'SEEK_ARMISTICE' } } } }));
  const journal = rows.map((row, i) => ({ revision: row.revision, command: row.intent.command, campaignHost: { receipt: { kind: 'ARMISTICE', result: i === 3 ? 'SUCCESS' : 'FAILURE' } } }));
  const result = selectBoundaries(rows, journal, [1017]);
  assert.deepEqual(result.selected.map(row => row.commandCount), [1016, 1017, 1018, 1019, 1020]);
  assert.equal(result.coverage['armistice:refused'], 4); assert.equal(result.coverage['armistice:accepted'], 1);
  assert.deepEqual(result.selected[1].names, ['continuation:1017:last-original']);
  assert.deepEqual(result.selected[2].names, ['continuation:1017:first-new']);
  for (const seams of [[1015], [1020], [1017, 1017], [1018, 1017], ['1017']]) assert.throws(() => selectBoundaries(rows, journal, seams));
  const changed = structuredClone(journal); changed[0].campaignHost.receipt.kind = 'BATTLE'; assert.throws(() => selectBoundaries(rows, changed));
});


import { assertStabilityReplayRows } from './red-priest-save.mjs';
function stabilityReplaySample() {
  const rows = Array.from({ length: 219 }, (_, i) => ({ commandCount: 919 + i, commandSha256: stateHash({ command: i }), beforeStateSha256: stateHash({ state: i }), afterStateSha256: stateHash({ state: i + 1 }),
    randomBefore: { seed: 'original', cursor: i }, randomAfter: { seed: 'original', cursor: i + 1 }, publicBeforeSha256: stateHash({ oldPublic: i }), publicAfterSha256: stateHash({ oldPublic: i + 1 }) }));
  const allowed = ['EXACT_TEST_APPEND'];
  const proof = { format: 'RED_PRIEST1137_STABILITY_TRANSITION_V1', replay: { commands: 219, first: 919, last: 1137, allPrivateAndRngEqual: true, allExistingPublicFieldsEqual: true, allowedPublicChanges: allowed,
    rows: rows.map((r, i) => ({ commandCount: r.commandCount, commandSha256: r.commandSha256, beforeStateSha256: r.beforeStateSha256, stateSha256: r.afterStateSha256, randomBefore: r.randomBefore, random: r.randomAfter,
      capturedPublicBeforeSha256: r.publicBeforeSha256, capturedPublicSha256: r.publicAfterSha256, publicBeforeSha256: stateHash({ newPublic: i }), publicSha256: stateHash({ newPublic: i + 1 }), privateAndRngEqual: true, allExistingPublicFieldsEqual: true })) } };
  return { rows, proof, allowed };
}
test('1137 proof retains all219 old commands/private/RNG and both exact public boundaries', () => {
  const good = stabilityReplaySample(); assertStabilityReplayRows(good.proof, good.rows, good.allowed);
  for (const mutate of [x => x.proof.replay.rows.pop(), x => x.proof.replay.rows.push(x.proof.replay.rows[0]), x => x.proof.replay.rows.reverse(),
    x => x.proof.replay.allowedPublicChanges.push('OTHER_FIELDS'), x => x.proof.replay.rows[20].commandSha256 = 'a'.repeat(64),
    x => x.proof.replay.rows[20].beforeStateSha256 = 'a'.repeat(64), x => x.proof.replay.rows[20].stateSha256 = 'a'.repeat(64),
    x => x.proof.replay.rows[20].random = { seed: 'other', cursor: 21 }, x => x.proof.replay.rows[20].randomBefore = { seed: 'original', cursor: 30 },
    x => x.proof.replay.rows[20].capturedPublicBeforeSha256 = 'a'.repeat(64), x => x.proof.replay.rows[20].capturedPublicSha256 = 'a'.repeat(64),
    x => x.proof.replay.rows[20].publicBeforeSha256 = 'a'.repeat(64), x => x.proof.replay.rows[20].allExistingPublicFieldsEqual = false]) {
    const x = stabilityReplaySample(); x.proof.replay.allowedPublicChanges = [...x.allowed]; mutate(x); assert.throws(() => assertStabilityReplayRows(x.proof, x.rows, x.allowed));
  }
});

import { assertStabilityContinuation } from './red-priest-save.mjs';
function stabilityContinuationSample() {
  const prior = { commandCount: 1137, rows: Array.from({ length: 219 }, (_, i) => ({ commandCount: 919 + i, exact: i })),
    commands: Array.from({ length: 219 }, (_, i) => ({ command: i })), policyDefinition: { id: 'old', armisticeAttempts: 20, noReroll: true },
    policy: { phase: 'POSTWAR', attempts: { old: 12 } }, terminal: { stage: 'FINITE_MATERIAL_ATTEMPTS', reason: 'observed exhaustion' },
    fork: { original: 918 }, continuation: { originalCommandCount: 1017 }, finalStateSha256: stateHash('1137'), publicStateSha256: stateHash('public1137'),
    state: { random: { seed: 'original', cursor: 477 } }, initialStateSha256: stateHash('918'), initialPublicStateSha256: stateHash('public918') };
  const reviewedPolicy = { ...prior.policyDefinition, id: 'new', preparation: 'PAID_SAME_BOTTLE' };
  const cp = { ...prior, commandCount: 1138, rows: [...prior.rows, { commandCount: 1138, beforeStateSha256: prior.finalStateSha256, publicBeforeSha256: prior.publicStateSha256, randomBefore: prior.state.random }],
    commands: [...prior.commands, { command: 'actual new' }], policyDefinition: reviewedPolicy, freezeSha256: 'a'.repeat(64) };
  const proof = { format: 'RED_PRIEST1137_STABILITY_CONTINUATION_V1', originalPolicyDefinition: prior.policyDefinition, continuedPolicyDefinition: reviewedPolicy,
    originalPolicyState: prior.policy, originalTerminal: prior.terminal, priorFork: prior.fork, priorContinuation: prior.continuation, newFreezeSha256: cp.freezeSha256,
    originalRowsSha256: hash(prior.rows), originalCommandsSha256: hash(prior.commands) };
  return { prior, cp, proof, reviewedPolicy };
}
test('1137 continuation retains exact219 prefix,1017 proof and918 fork, with unchanged private/RNG boundary', () => {
  const good = stabilityContinuationSample(); assertStabilityContinuation(good.proof, good.prior, good.cp, good.reviewedPolicy, good.prior.publicStateSha256);
  for (const mutate of [x => x.cp.rows[0] = { rewritten: true }, x => x.cp.commands.splice(100, 1), x => x.cp.rows.pop(),
    x => x.cp.fork = { original: 974 }, x => x.cp.continuation = { originalCommandCount: 1137 }, x => x.proof.originalPolicyState = { attempts: {} },
    x => x.cp.policyDefinition = { ...x.reviewedPolicy, noReroll: false }, x => x.cp.rows[219].randomBefore = { seed: 'changed', cursor: 477 },
    x => x.cp.rows[219].beforeStateSha256 = 'b'.repeat(64), x => x.cp.rows[219].publicBeforeSha256 = 'b'.repeat(64),
    x => x.cp.rows[219].commandCount++, x => x.cp.initialStateSha256 = 'b'.repeat(64), x => x.proof.priorContinuation = null,
    x => x.proof.originalCommandsSha256 = 'b'.repeat(64), x => x.prior.stabilityContinuation = { nested: true }]) {
    const x = stabilityContinuationSample(); mutate(x); assert.throws(() => assertStabilityContinuation(x.proof, x.prior, x.cp, x.reviewedPolicy, x.prior.publicStateSha256));
  }
});

import { assertStabilityPolicy, stabilityMaterialCycle } from './red-priest-save.mjs';
test('future stability policy changes only the reviewed paid-preparation and real-consumption cycle fields', () => {
  const before = { id: 'RED_PRIEST_PREDECLARE918_COORDINATED_FULL_PREPARATION_V1', maximumNewCommands: 900, attemptsPerMaterialOperation: 12, noReroll: true };
  const after = { ...before, id: 'RED_PRIEST1137_STABLE_POSTWAR_CONTINUATION_V1', materialAttemptScope: 'SINCE_LAST_ACTUAL_CONSUMPTION', promotionPreparation: 'REQUIRE_SAME_COMPOUND_PAID_STABILITY', minimumMindBeforeStability: 78, preparedEpilogue: true };
  assertStabilityPolicy(before, after);
  for (const extra of [{ attemptsPerMaterialOperation: 13 }, { noReroll: false }, { minimumMindBeforeStability: 0 }, { fabricatedRefund: true }]) assert.throws(() => assertStabilityPolicy(before, { ...after, ...extra }));
  const wrap = command => ({ type: 'RED_PRIEST', command }), material = { type: 'MATERIAL', command: { type: 'TRANSFER_CUSTODY', itemId: 'original' } };
  const commands = Array.from({ length: 219 }, () => wrap({ type: 'WORK' }));
  commands[195] = wrap({ type: 'CONSUME', compoundId: 'old-real-bottle' });
  for (const i of [200, 202, 204]) commands[i] = wrap(material);
  const originalBytes = JSON.stringify(commands), cycle = stabilityMaterialCycle(commands);
  assert.deepEqual(cycle, { startedAfterCommand: 1114, attempts: { [JSON.stringify(material)]: 3 } });
  const twelve = [...commands, ...Array.from({ length: 9 }, () => wrap(material))]; assert.equal(stabilityMaterialCycle(twelve).attempts[JSON.stringify(material)], 12);
  assert.throws(() => stabilityMaterialCycle([...twelve, wrap(material)]));
  assert.deepEqual(stabilityMaterialCycle([...twelve, wrap({ type: 'CONSUME', compoundId: 'next-real-bottle' }), wrap(material)]),
    { startedAfterCommand: 1147, attempts: { [JSON.stringify(material)]: 1 } });
  assert.equal(JSON.stringify(commands), originalBytes);
});

// Independent first-bottle branch helper tests are added with the final producer contract.
import { assertIndependentStabilityBranch } from './red-priest-save.mjs';
test('independent first-bottle branch begins at918 and never relabels1222 as a continuation', () => {
  const historySha256 = 'a'.repeat(64), originalRoot = { finalStateSha256: 'b'.repeat(64) };
  const failurePolicy = { id: 'RED_PRIEST1137_STABLE_POSTWAR_CONTINUATION_V1', minimumMindBeforeStability: 78, attemptsPerMaterialOperation: 12 };
  const cp = { independentBranch: { proofFile: 'history-manifest.json', proofSha256: historySha256, rootCommandCount: 918, priorFailureCommandCount: 1222 },
    initialStateSha256: originalRoot.finalStateSha256, prefixCount: 918, policyDefinition: { ...failurePolicy, id: 'RED_PRIEST918_STABILITY_FROM_FIRST_COMPOUND_V1' },
    commands: [{ type: 'RED_PRIEST', command: { type: 'WORK' } }], policy: { materialCycle: { startedAfterCommand: 918, attempts: {} } } };
  const capture = { provenance: { kind: 'EXACT_ORIGINAL_PREDECLARE918_STABILITY_FIRST_BRANCH', independentBranch: cp.independentBranch } };
  assertIndependentStabilityBranch(cp, capture, originalRoot, failurePolicy, historySha256);
  for (const mutate of [x => x.cp.continuation = { originalCommandCount: 1017 }, x => x.cp.stabilityContinuation = { originalCommandCount: 1137 },
    x => x.cp.independentBranch.rootCommandCount = 1222, x => x.cp.independentBranch.priorFailureCommandCount = 1137,
    x => x.cp.initialStateSha256 = 'c'.repeat(64), x => x.cp.policyDefinition.minimumMindBeforeStability = 0,
    x => x.cp.policy.materialCycle.startedAfterCommand = 1222, x => x.capture.provenance.kind = 'EXACT_ORIGINAL_PREDECLARE918_PLANNED_BRANCH']) {
    const x = structuredClone({ cp, capture }); mutate(x); assert.throws(() => assertIndependentStabilityBranch(x.cp, x.capture, originalRoot, failurePolicy, historySha256));
  }
  const tooMany = { ...cp, commands: Array.from({ length: 13 }, () => ({ type: 'RED_PRIEST', command: { type: 'MATERIAL', command: { type: 'TRANSFER_CUSTODY', itemId: 'original' } } })) };
  assert.throws(() => assertIndependentStabilityBranch(tooMany, capture, originalRoot, failurePolicy, historySha256));
});

import { assertIndependentCaptureFiles } from './red-priest-save.mjs';
test('independent918 has exactly seven inputs with no omitted proof or copied continuation', () => {
  const names = ['checkpoint.json', 'commands.ndjson', 'freeze.json', 'history-manifest.json', 'natural.json', 'runtime-transition.json', 'summary.json'];
  assertIndependentCaptureFiles(names);
  for (const mutated of [names.slice(1), [...names, 'continuation.json'].sort(), [...names, 'stability-continuation.json'].sort(), [...names, 'prior-observation'].sort(), [...names, names[0]].sort(), [...names].reverse()]) assert.throws(() => assertIndependentCaptureFiles(mutated));
});


import { assertStoryFreeze, assertStoryReplayRows, assertStoryPublicBoundary } from './red-priest-save.mjs';
test('story runtime transition changes exactly three projection files and never producer or private mechanics', () => {
  const files = ['src/domain/red-priest/index.ts', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
  const before = freeze([...files.map(file => row(file, 'a')), row('src/domain/red-priest/engine.ts', 'b'), row('$natural-producer', 'c')]);
  const after = freeze(before.files.map(x => files.includes(x.file) ? { ...x, sha256: 'd'.repeat(64) } : x));
  const changes = files.map(file => ({ file, before: { bytes: 5, sha256: 'a'.repeat(64) }, after: { bytes: 5, sha256: 'd'.repeat(64) } }));
  assertStoryFreeze(before, after, changes);
  for (const file of ['src/domain/red-priest/engine.ts', '$natural-producer']) assert.throws(() => assertStoryFreeze(before, freeze(after.files.map(x => x.file === file ? { ...x, sha256: 'e'.repeat(64) } : x)), changes));
  assert.throws(() => assertStoryFreeze(before, after, changes.slice(1)));
  assert.throws(() => assertStoryFreeze(before, after, [...changes].reverse()));
  assert.throws(() => assertStoryFreeze(before, freeze(after.files.slice(1)), changes));
});
function storyReplaySample() {
  const rows = [], checks = [], random = { seed: 'fixed', cursor: 423 };
  for (let count = 919; count <= 1051; count++) {
    const row = { commandCount: count, commandSha256: hash(['command', count]), beforeStateSha256: hash(['state', count - 1]), afterStateSha256: hash(['state', count]), randomBefore: random, randomAfter: random, publicBeforeSha256: hash(['old', count - 1]), publicAfterSha256: hash(['old', count]) };
    rows.push(row); checks.push({ commandCount: count, commandSha256: row.commandSha256, beforeStateSha256: row.beforeStateSha256, stateSha256: row.afterStateSha256, randomBefore: random, random,
      capturedPublicBeforeSha256: row.publicBeforeSha256, capturedPublicSha256: row.publicAfterSha256,
      publicBeforeSha256: count >= 1048 ? hash(['current', count - 1]) : row.publicBeforeSha256, publicSha256: count >= 1047 ? hash(['current', count]) : row.publicAfterSha256,
      originalStoryBefore: `original${count - 1}`, originalStoryAfter: `original${count}`, currentStoryBefore: count >= 1048 ? `actual${count - 1}` : `original${count - 1}`, currentStoryAfter: count >= 1047 ? `actual${count}` : `original${count}`,
      privateAndRngEqual: true, allOtherPublicFieldsEqual: true });
  }
  return { rows, proof: { format: 'RED_PRIEST1051_STORY_TRANSITION_V1', allowedPublicChanges: ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT'], replay: { commands: 133, first: 919, last: 1051, allPrivateAndRngEqual: true, allOtherPublicFieldsEqual: true, rows: checks } } };
}
test('story proof retains every133 private and RNG boundary with exactly five affected epilogue frames', () => {
  const good = storyReplaySample(); assertStoryReplayRows(good.proof, good.rows);
  for (const mutate of [x => x.proof.replay.rows.pop(), x => x.proof.replay.rows.push(x.proof.replay.rows[0]), x => x.proof.replay.rows[0].random = { seed: 'drift', cursor: 423 },
    x => x.proof.replay.rows[0].commandSha256 = 'b'.repeat(64), x => x.proof.replay.rows[0].beforeStateSha256 = 'c'.repeat(64), x => x.proof.replay.rows[5].publicBeforeSha256 = 'd'.repeat(64),
    x => x.proof.replay.rows[0].currentStoryAfter = 'unauthorized early edit', x => x.proof.replay.rows.at(-1).currentStoryAfter = x.proof.replay.rows.at(-1).originalStoryAfter,
    x => x.proof.replay.rows[12].allOtherPublicFieldsEqual = false, x => x.proof.allowedPublicChanges.push('ANY_TEXT')]) {
    const x = storyReplaySample(); mutate(x); assert.throws(() => assertStoryReplayRows(x.proof, x.rows));
  }
});
test('live story comparison restores complete captured public hash by replacing only the exact root story', () => {
  const old = { story: 'original three waiting', sections: [{ text: 'one evacuated, two sheltered' }], actions: [{ cost: 'actual cost' }], resources: { cash: 0 } };
  const current = { ...old, story: 'one evacuated, two sheltered; report filed' };
  const check = { originalStoryBefore: old.story, currentStoryBefore: current.story, capturedPublicBeforeSha256: stateHash(old), publicBeforeSha256: stateHash(current),
    originalStoryAfter: old.story, currentStoryAfter: current.story, capturedPublicSha256: stateHash(old), publicSha256: stateHash(current) };
  for (const side of ['before', 'after']) assertStoryPublicBoundary(current, check, side);
  for (const mutate of [x => x.story = old.story, x => x.resources.cash = 1, x => x.sections[0].text = 'false patient count', x => x.actions[0].cost = 'free', x => x.extra = true]) {
    const x = structuredClone(current); mutate(x); assert.throws(() => assertStoryPublicBoundary(x, check, 'after'));
  }
  const forged = { ...current, resources: { cash: 1 } }, wrongProof = { ...check, publicSha256: stateHash(forged) };
  assert.throws(() => assertStoryPublicBoundary(forged, wrongProof, 'after'));
});
test('story proof CLI requires its reviewed hash and separate current runtime freeze together', () => {
  const args = ['--planned-fork', '--story-equivalence-proof', 'proof.json', '--story-equivalence-sha256', 'a'.repeat(64), '--runtime-freeze-sha256', 'b'.repeat(64)];
  assert.equal(argumentsForSave(args).runtimeFreezeSha256, 'b'.repeat(64));
  for (const remove of [1, 3, 5]) assert.throws(() => argumentsForSave(args.filter((_, i) => i !== remove && i !== remove + 1)));
  assert.throws(() => argumentsForSave(args.slice(1)));
});

import { assertRedPriestProjectionPair, assertPlannedInitialProjection } from './red-priest-save.mjs';
test('authored capture and complete player-facing chapter are distinct exact projections', () => {
  const authored = { abilities: [{ description: '具体判定为G。' }], resources: { cash: 12 }, actions: [{ id: 'G-action', cost: '12便士', enabled: true, command: { type: 'G-command' } }] };
  const format = (value, name) => { assert.equal(name, 'original name'); const copy = structuredClone(value); copy.redPriest.abilities[0].description = '具体判定以当前说明为准。'; return copy; };
  const player = format({ redPriest: authored }, 'original name'); assert.notEqual(stateHash(authored), stateHash(player.redPriest));
  assertRedPriestProjectionPair(authored, player, 'original name', format);
  for (const mutate of [x => x.redPriest.resources.cash++, x => x.redPriest.actions[0].cost = '免费', x => x.redPriest.actions[0].command.type = 'other', x => x.redPriest.actions[0].enabled = false, x => x.redPriest.abilities[0].description = authored.abilities[0].description]) {
    const x = structuredClone(player); mutate(x); assert.throws(() => assertRedPriestProjectionPair(authored, x, 'original name', format));
  }
  assert.throws(() => assertRedPriestProjectionPair(structuredClone(authored), player, 'original name', value => { value.redPriest.abilities[0].description = player.redPriest.abilities[0].description; return value; }));
});
test('initial918 seam uses owned row919 hash before checking exact ENABLE removal and display-copy relation', () => {
  const original = { story: 'exact original', abilities: [{ description: '具体判定为G。' }], actions: [] };
  const authored = { ...original, actions: [{ command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } }, id: 'red-priest-action-1', label: '启用本场战争筹备',
    cost: '不花行动、时间或费用；须在签发发动命令前选择，之后每次侦察和保护性准备照实支付，不能补写过去战果', enabled: true, reason: null }] };
  const format = value => { const copy = structuredClone(value); copy.redPriest.abilities[0].description = '具体判定以当前说明为准。'; return copy; };
  const global = format({ redPriest: authored });
  assertPlannedInitialProjection(authored, global, stateHash(original), stateHash(authored), '', format);
  assert.throws(() => assertPlannedInitialProjection(global.redPriest, global, stateHash(original), stateHash(authored), '', format));
  assert.throws(() => assertPlannedInitialProjection(authored, global, stateHash(original), stateHash(global.redPriest), '', format));
  const wrong = structuredClone(authored); wrong.actions[0].cost = 'free future preparation';
  assert.throws(() => assertPlannedInitialProjection(wrong, format({ redPriest: wrong }), stateHash(original), stateHash(wrong), '', format));
});

import { assertFinalUiReplayRows, assertFinalUiPublicBoundary } from './red-priest-save.mjs';
const travelSample = (count, id = 'red-priest-action-2') => [1022, 1023, 1024].includes(count) ? { id, command: { type: 'TRAVEL', to: 'eastern-stores' }, label: '前往东南粮仓地',
  cost: '1行动；沿已行经大陆路线逐周结算旅费、生活费与旧还款', enabled: count === 1024, reason: count === 1024 ? null : '实际行动、费用或灵性不足。' } : null;
function finalUiReplaySample() {
  const prior = storyReplaySample(), proof = structuredClone(prior.proof);
  proof.format = 'RED_PRIEST1051_FINAL_UI_TRANSITION_V1'; proof.allowedPublicChanges = ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT', 'APPENDED_S1_HEADQUARTERS_ORIGINAL_GARRISON_TRAVEL_ACTION'];
  proof.replay.appendedTravelChecks = 3; proof.replay.exactPlayerTextRelation = true;
  for (const row of proof.replay.rows) {
    const n = row.commandCount; row.priorRuntimePublicBeforeSha256 = row.publicBeforeSha256; row.priorRuntimePublicSha256 = row.publicSha256;
    row.appendedTravelBefore = travelSample(n - 1); row.appendedTravelAfter = travelSample(n);
    if (row.appendedTravelBefore) row.publicBeforeSha256 = hash(['travel', n - 1]); if (row.appendedTravelAfter) row.publicSha256 = hash(['travel', n]);
    row.publicSliceBeforeSha256 = hash(['global', n - 1]); row.publicSliceSha256 = hash(['global', n]);
    row.playerChapterBeforeSha256 = hash(['player', n - 1]); row.playerChapterSha256 = hash(['player', n]); row.exactPlayerTextRelation = true;
  }
  return { proof, rows: prior.rows, priorStory: prior.proof };
}
test('final UI proof permits exactly three reviewed travel frames while retaining every sealed story hash', () => {
  const good = finalUiReplaySample(); assertFinalUiReplayRows(good.proof, good.rows, good.priorStory);
  for (const mutate of [x => x.proof.replay.rows[103].appendedTravelAfter = null, x => x.proof.replay.rows[0].appendedTravelAfter = travelSample(1022),
    x => x.proof.replay.rows[103].appendedTravelAfter.cost = 'free', x => x.proof.replay.rows[103].appendedTravelAfter.command.to = 'other',
    x => x.proof.replay.rows[103].appendedTravelAfter.enabled = true, x => x.proof.replay.rows[103].appendedTravelAfter.preferredAction = true,
    x => x.proof.replay.rows[105].appendedTravelAfter.reason = 'blocked', x => x.proof.replay.rows[105].priorRuntimePublicSha256 = 'f'.repeat(64),
    x => x.proof.replay.rows[1].publicSliceBeforeSha256 = 'f'.repeat(64), x => x.proof.replay.rows[1].random = { seed: 'changed', cursor: 423 },
    x => x.proof.replay.rows.pop(), x => x.proof.allowedPublicChanges.push('ANY_ACTION')]) {
    const x = finalUiReplaySample(); mutate(x); assert.throws(() => assertFinalUiReplayRows(x.proof, x.rows, x.priorStory));
  }
});
test('live final UI gate removes only the exact trailing travel action and binds the complete global projection', () => {
  const prior = { story: 'unchanged story', resources: { cash: 0 }, actions: [{ id: 'red-priest-action-1', command: { type: 'WORK' }, label: 'work', cost: '1行动', enabled: true, reason: null }] };
  const current = { ...prior, actions: [...prior.actions, travelSample(1022)] }, global = { redPriest: current, otherChapter: { unchanged: true } }, globalBefore = { ...global, redPriest: prior };
  const check = { commandCount: 1022, appendedTravelBefore: null, appendedTravelAfter: travelSample(1022),
    publicBeforeSha256: stateHash(prior), publicSha256: stateHash(current), priorRuntimePublicBeforeSha256: stateHash(prior), priorRuntimePublicSha256: stateHash(prior),
    capturedPublicBeforeSha256: stateHash(prior), capturedPublicSha256: stateHash(prior), originalStoryBefore: prior.story, originalStoryAfter: prior.story, currentStoryBefore: prior.story, currentStoryAfter: prior.story,
    publicSliceBeforeSha256: stateHash(globalBefore), publicSliceSha256: stateHash(global), playerChapterBeforeSha256: stateHash(prior), playerChapterSha256: stateHash(current) };
  assertFinalUiPublicBoundary(prior, globalBefore, check, 'before'); assertFinalUiPublicBoundary(current, global, check, 'after');
  for (const mutate of [x => x.actions.pop(), x => x.actions.push(travelSample(1022)), x => x.actions.reverse(), x => x.actions.at(-1).cost = 'free', x => x.resources.cash = 10]) {
    const view = structuredClone(current); mutate(view); const player = { ...global, redPriest: view };
    const forged = { ...check, publicSha256: stateHash(view), publicSliceSha256: stateHash(player), playerChapterSha256: stateHash(view) };
    assert.throws(() => assertFinalUiPublicBoundary(view, player, forged, 'after'));
  }
  assert.throws(() => assertFinalUiPublicBoundary(current, { ...global, otherChapter: { unchanged: false } }, check, 'after'));
  assert.throws(() => assertFinalUiPublicBoundary(current, global, { ...check, appendedTravelAfter: null }, 'after'));
});
test('final UI CLI keeps both old story proof and the new reviewed UI proof mandatory', () => {
  const args = ['--planned-fork', '--story-equivalence-proof', 'story.json', '--story-equivalence-sha256', 'a'.repeat(64), '--runtime-freeze-sha256', 'b'.repeat(64), '--final-ui-equivalence-proof', 'ui.json', '--final-ui-equivalence-sha256', 'c'.repeat(64)];
  assert.equal(argumentsForSave(args).finalUiEquivalenceProof, 'ui.json');
  for (const remove of [1, 3, 5, 7, 9]) assert.throws(() => argumentsForSave(args.filter((_, i) => i !== remove && i !== remove + 1)));
});
