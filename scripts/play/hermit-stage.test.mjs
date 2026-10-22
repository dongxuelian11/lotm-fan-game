import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOriginalRoots, assertOriginals, assertPublicOnly, auditPublic, chooseAction, FROZEN_SOURCE_KEYS,
  outcome, parseOptions, portableSourcePath, PREFIX_COUNT, sealRow, snapshotReasons,
  SOURCE, SOURCE_REVISION, stable, stateHash, terminal, verifyCommandChain, verifyRow,
} from './hermit-stage.mjs';

// Pure helpers only: importing this file never imports dist, runs the game,
// builds, reads the large source archives, or executes an actual action.
test('canonical hashes preserve ordered JSON and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  for (const value of [undefined, NaN, Infinity, { bad: undefined }, new Date(0)]) assert.throws(() => stateHash(value));
});

test('compact command/private/public/RNG chain keeps revision separate from count', () => {
  const old = { type: 'ACTION', action: 'REST' }, intent = { type: 'HERMIT', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'HERMIT_ACTION', commandCount: 2, newCount: 1, intent,
    commandSha256: stateHash(intent), previousRowSha256: prefix.rowSha256, before: initial, after: next,
    publicAction: { enabled: true, preferredAction: true, command: intent.command } };
  const row = sealRow(payload), check = rows => verifyCommandChain(rows, { prefixCommands: [old], initial });
  assert.deepEqual(check([prefix, row]), { commandCount: 2, newCount: 1, rowSha256: row.rowSha256, anchor: next });
  assert.throws(() => check([])); assert.throws(() => check([prefix, row, row]));
  for (const changes of [
    { commandCount: 3 }, { newCount: 2 }, { previousRowSha256: null },
    { after: { ...next, revision: 2 } },
    { before: { ...initial, publicStateSha256: stateHash('tampered') } },
    { after: { ...next, random: { ...random, cursor: 4 }, randomSha256: stateHash({ ...random, cursor: 4 }) } },
    { after: { ...next, random: { ...random, seed: 'replacement' }, randomSha256: stateHash({ ...random, seed: 'replacement' }) } },
    { publicAction: { ...payload.publicAction, enabled: false } },
    { publicAction: { ...payload.publicAction, preferredAction: false } },
    { publicAction: { ...payload.publicAction, command: { type: 'WORK' } } },
  ]) assert.throws(() => check([prefix, sealRow({ ...payload, ...changes })]));
  assert.throws(() => verifyRow({ ...row, intent: { type: 'OTHER' } }));
});

test('sparse key snapshots cover initial, every16, consume before/after and terminal', () => {
  const consume = { type: 'HERMIT', command: { type: 'CONSUME', compoundId: 'same-bottle', confirmed: true } };
  const rest = { type: 'HERMIT', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: consume }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: consume, terminal: true }), ['periodic', 'after-consume', 'terminal']);
  assert.deepEqual(snapshotReasons({ newCount: 17, terminal: true }), ['terminal']);
});

test('only the exact enabled public preferred action is selected', () => {
  const preferred = { id: 'cross', label: 'Cross', cost: '3 seconds', enabled: true, preferredAction: true, reason: null,
    command: { type: 'CROSS', actorId: 'HM222-MIRA', segment: 'A' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, hermit: { guidanceKnown: true, actions: [preferred] } };
  const choice = chooseAction(view);
  assert.deepEqual(choice.intent, { type: 'HERMIT', command: preferred.command });
  choice.intent.command.actorId = 'HM222-NILES'; assert.equal(preferred.command.actorId, 'HM222-MIRA');
  for (const actions of [[], [{ ...preferred, enabled: false }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, hermit: { ...view.hermit, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  for (const blocking of [{ activeEvent: { id: 'inherited' } }, { combat: { id: 'inherited' } }])
    assert.equal(chooseAction({ ...view, ...blocking }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, hermit: { ...view.hermit, guidanceKnown: false } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, hermit: { guidanceKnown: false, actions: [{ ...preferred, command: { type: 'LEARN_GUIDANCE' } }] } }).intent.command.type, 'LEARN_GUIDANCE');
  assert.equal(chooseAction({ ...view, status: 'DEAD' }).stop, 'NATURAL_TERMINAL');
  assert.equal(PREFIX_COUNT + 1, 828); assert.equal(SOURCE_REVISION + 1, 829);
});

test('explicit canonical source/output and 0/1/N limits admit no policy or RNG overrides', () => {
  assert.equal(portableSourcePath('/tmp/original', `/tmp/original/${SOURCE}`), SOURCE);
  assert.equal(portableSourcePath('/tmp/restored', SOURCE), SOURCE);
  for (const source of [`/tmp/original/${SOURCE}`, '../outside.json', 'different-natural.json'])
    assert.throws(() => portableSourcePath('/tmp/restored', source));
  for (const n of [0, 1, 32, 1000]) {
    const options = parseOptions(['--source=input.json', '--out', 'capture', `--max-new-actions=${n}`, '--resume'], '/tmp/example');
    assert.equal(options.maxNewActions, n); assert.equal(options.resume, true); assert.equal(options.source, '/tmp/example/input.json');
  }
  const base = ['--source', 'input', '--out', 'capture'];
  assert.throws(() => parseOptions(['--out', 'capture']));
  for (const flag of ['--seed', '--roll', '--strategy', '--outcome']) assert.throws(() => parseOptions([...base, flag, 'override']));
  for (const extra of [['--max-new-actions=-1'], ['--max-new-actions=1.5'], ['--max-new-actions=9007199254740992'], ['--resume=true'], ['--out', 'second']])
    assert.throws(() => parseOptions([...base, ...extra]));
});

test('whole-public scan allows only exact physical movement and command paths', () => {
  const movement = { actorId: 'PM3-IRIS' };
  const publicView = {
    hermit: { actions: ['PLAYER', 'HM222-MIRA', 'HM222-NILES'].map(actorId => ({ command: { type: 'CROSS', actorId, segment: 'A' } })) },
    divineHand: { life: { site: { guard: { actorId: null } } } }, glory: { life: { site: { guard: { actorId: null } } } },
    sage: { life: { site: { actorMoves: [movement] }, cases: [{ attempts: [{ playerMoves: [{ actorId: 'PLAYER' }], siteAtClose: { actorMoves: [movement] } }] }] },
      encounter: { startSite: { actorMoves: [movement] } } },
    knowledgeEmperor: { life: { ledger: [{ moves: [{ actorId: 'PLAYER' }, movement], siteBefore: { actorMoves: [movement] } }] } },
    lastCombatRound: { sageOutcome: { siteAfter: { actorMoves: [movement] } } },
    combatHistory: [{ sageOutcome: { siteAfter: { actorMoves: [movement] } } }],
    lastCheck: { modifiers: [{ source: 'Paid preparation', value: 10 }] },
    writer: { life: { practice: { record: { reportDigest: null } } } },
  };
  assert.doesNotThrow(() => assertPublicOnly(publicView));
  for (const bad of [
    { actorId: 'PLAYER' }, { other: { actorId: null } }, { source: { actorId: 'HM222-MIRA' } },
    { hermit: { actions: [{ command: { actorId: 'private-person' } }] } },
    { hermit: { actions: [{ command: { actorId: 'PM3-IRIS' } }] } },
    { hermit: { actions: [{ command: { actorId: null } }] } },
    { sage: { life: { site: { actorMoves: [{ actorId: 'HM222-MIRA' }] } } } },
    { divineHand: { life: { site: { guard: { actorId: 'PLAYER' } } } } },
    { writer: { life: { practice: { record: { reportDigest: 'private-digest' } } } } },
    { other: { reportDigest: null } }, { nextRoll: 1 }, { random: { seed: 'anything' } }, { unknownDigest: 'anything' },
  ]) assert.throws(() => assertPublicOnly(bad));
  const privateState = { random: { seed: 'private-seed' }, hermit: { source: { actorId: 'private-person', historyDigest: 'private-digest',
    originals: { site: { actorMoves: [movement] } } }, scene: { moves: [{ actorId: 'PLAYER' }] } } };
  assert.doesNotThrow(() => auditPublic(publicView, privateState));
  const ownerReceipt = structuredClone(privateState);
  ownerReceipt.hermit.scene.receipts = [{ actorId: 'OWNER' }];
  assert.doesNotThrow(() => auditPublic({ holder: 'OWNER' }, ownerReceipt));
  ownerReceipt.hermit.source.actorId = 'OWNER';
  assert.throws(() => auditPublic({ holder: 'OWNER' }, ownerReceipt));
  for (const secret of ['private-seed', 'private-person', 'private-digest']) assert.throws(() => auditPublic({ lines: [secret] }, privateState));
  assert.throws(() => auditPublic(publicView, { random: privateState.random, hermit: { source: { actorId: 'HM222-MIRA' } } }));
});

test('all nine inherited roots, world, combat history and both characters stay identical at promotion', () => {
  assert.equal(FROZEN_SOURCE_KEYS.length, 9);
  const original = { ...Object.fromEntries(FROZEN_SOURCE_KEYS.map(key => [key, { unchanged: true }])),
    runId: 'same', random: { seed: 'same-seed', cursor: 346 }, revision: 828, world: { unchanged: true }, combatHistory: [],
    character: { name: 'Same person', coreStats: { physique: 29, perception: 26, will: 27, knowledge: 25 } },
    progression: { sequence: 1, mastery: { old: 7 } } };
  const before = { ...structuredClone(original), hermit: { guidanceKnown: true, source: { character: structuredClone(original.character) }, promotionWeek: null } };
  const next = structuredClone(before); next.revision++; next.week = 198; next.status = 'ACTIVE';
  const consume = { type: 'HERMIT', command: { type: 'CONSUME' } };
  assert.doesNotThrow(() => assertOriginals(next, original, before, FROZEN_SOURCE_KEYS, consume));
  next.progression.sequence = 0; next.hermit.promotionWeek = next.week;
  assert.doesNotThrow(() => assertOriginals(next, original, before, FROZEN_SOURCE_KEYS, consume));
  for (const mutate of [
    ...FROZEN_SOURCE_KEYS.map(key => s => { s[key].unchanged = false; }),
    s => { s.world.unchanged = false; }, s => s.combatHistory.push({}), s => { s.character.name = 'Replacement'; },
    s => s.character.coreStats.will++, s => s.hermit.source.character.coreStats.will++, s => s.progression.mastery.old++,
  ]) { const bad = structuredClone(next); mutate(bad); assert.throws(() => assertOriginalRoots(bad, original, FROZEN_SOURCE_KEYS)); }
  assert.throws(() => assertOriginals(next, original, before, FROZEN_SOURCE_KEYS, { type: 'HERMIT', command: { type: 'REST' } }));
});

test('actual return report or death stops even when another action remains publicly preferred', () => {
  const state = { status: 'ACTIVE', progression: { sequence: 0 }, week: 198, health: 90, mind: 90, spirituality: 90,
    hermit: { promotionWeek: 197, frame: { location: 'HM222-ARCHIVE-OUTSIDE' }, scene: {
      phase: 'PRACTICE', status: 'COMPLETED', preparationReportEventId: 'preparation', returnReportEventId: 'actual-report',
      playerPosition: 'OUTSIDE', owner: { position: 'OUTSIDE' }, workers: [{ position: 'OUTSIDE' }, { position: 'OUTSIDE' }],
      body: 'SOLID', window: null, contact: false, custody: { holder: 'OWNER', position: 'OUTSIDE', returnEventId: 'actual-return' },
      informationCompleted: true, transferCompleted: false, manualCopyCompleted: true,
    } } };
  const view = { hermit: { actions: [{ enabled: true, preferredAction: true, command: { type: 'REST' } }] } };
  assert.equal(terminal(state, view).stage, 'NATURAL_S0_RETURN_REPORTED');
  assert.equal(outcome(state).returnedHome, true); assert.equal(outcome(state).ordinaryExit, true); assert.equal(outcome(state).originalReturned, true);
  assert.equal(outcome(state).transferApplied, false); assert.equal(outcome(state).ordinaryCopyCompleted, true);
  const aborted = structuredClone(state); aborted.hermit.scene.status = 'ABORTED'; aborted.hermit.scene.informationCompleted = false;
  assert.equal(terminal(aborted, view).stage, 'NATURAL_S0_RETURN_REPORTED'); assert.equal(outcome(aborted).informationApplied, false);
  const unreported = structuredClone(state); unreported.hermit.scene.returnReportEventId = null;
  assert.equal(terminal(unreported, view), null);
  assert.equal(terminal({ ...state, status: 'DEAD' }, view).stage, 'NATURAL_DEATH');
});
