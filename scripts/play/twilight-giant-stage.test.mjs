import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOriginalRoots, assertOriginals, assertPublicOnly, auditPublic, outcome, terminal, PREFIX_COUNT, SOURCE_REVISION, chooseAction, parseOptions, portableSourcePath, sealRow, snapshotReasons, SOURCE, stable, stateHash, verifyCommandChain, verifyRow } from './twilight-giant-stage.mjs';

// Pure helpers only: no dist import, original archive, build, session or action.
test('canonical hashes retain meaning and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
});

test('command, private/public and RNG chains keep revision separate from count', () => {
  const old = { type: 'OLD' }, command = { type: 'TWILIGHT_GIANT', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'TWILIGHT_GIANT_ACTION', commandCount: 2, newCount: 1, intent: command,
    commandSha256: stateHash(command), previousRowSha256: prefix.rowSha256, before: initial, after: next,
    publicAction: { enabled: true, preferredAction: true, command: command.command } };
  const row = sealRow(payload), check = rows => verifyCommandChain(rows, { prefixCommands: [old], initial });
  assert.deepEqual(check([prefix, row]), { commandCount: 2, newCount: 1, rowSha256: row.rowSha256, anchor: next });
  assert.throws(() => check([prefix, row, row]));
  assert.throws(() => check([prefix, sealRow({ ...payload, commandCount: 3 })]));
  assert.throws(() => check([prefix, sealRow({ ...payload, after: { ...next, revision: 2 } })]));
  assert.throws(() => check([prefix, sealRow({ ...payload, before: { ...initial, publicStateSha256: stateHash('tampered') } })]));
  assert.throws(() => check([prefix, sealRow({ ...payload, after: { ...next, random: { ...random, cursor: 4 } } })]));
  assert.throws(() => verifyRow({ ...row, intent: { type: 'OTHER' } }));
});

test('key snapshots cover initial, 16-action intervals, promotion consumption and terminal', () => {
  const replace = { type: 'TWILIGHT_GIANT', command: { type: 'CONSUME', compoundId: 'same-bottle', confirmed: true } };
  const rest = { type: 'TWILIGHT_GIANT', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: replace }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: replace, terminal: true }), ['periodic', 'after-consume', 'terminal']);
});

test('only the exact enabled public preferred action can be selected', () => {
  const preferred = { id: 'rest', label: 'Rest', cost: '1 action', enabled: true, preferredAction: true, reason: null, command: { type: 'REST' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, twilightGiant: { guidanceKnown: true, actions: [preferred] } };
  assert.deepEqual(chooseAction(view).intent, { type: 'TWILIGHT_GIANT', command: { type: 'REST' } });
  for (const actions of [[], [{ ...preferred, enabled: false, reason: 'No action point' }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, twilightGiant: { ...view.twilightGiant, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, twilightGiant: { ...view.twilightGiant, guidanceKnown: false } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(PREFIX_COUNT + 1, 288); assert.equal(SOURCE_REVISION + 1, 730);
});

test('explicit source/output and zero/one/N boundaries allow no policy overrides', () => {
  assert.equal(portableSourcePath('/tmp/original', `/tmp/original/${SOURCE}`), SOURCE);
  assert.equal(portableSourcePath('/tmp/restored', SOURCE), SOURCE);
  assert.throws(() => portableSourcePath('/tmp/restored', `/tmp/original/${SOURCE}`));
  assert.throws(() => portableSourcePath('/tmp/restored', 'different-natural.json'));
  for (const n of [0, 1, 32]) {
    const options = parseOptions(['--source=input.json', '--out', 'capture', `--max-new-actions=${n}`, '--resume'], '/tmp/example');
    assert.equal(options.maxNewActions, n); assert.equal(options.resume, true); assert.equal(options.source, '/tmp/example/input.json');
  }
  assert.throws(() => parseOptions(['--out', 'capture']));
  assert.throws(() => parseOptions(['--source', 'input', '--out', 'capture', '--seed', 'override']));
  assert.throws(() => parseOptions(['--source', 'input', '--out', 'capture', '--max-new-actions=-1']));
});


test('whole public scan keeps only exact physical references and ordinary modifier labels', () => {
  const publicView = { divineHand: { life: { site: { guard: { actorId: null } } } },
    glory: { life: { site: { guard: { actorId: 'GL2-CELIA' } }, currentAttempt: { actorId: 'GL2-EVAN',
      actorMoves: [{ actorId: 'GL2-CELIA' }], playerMoves: [{ actorId: 'PLAYER' }], siteAtClose: { guard: { actorId: null } } } } }, lastCheck: { modifiers: [{ source: 'Paid preparation', value: 10 }] } };
  assert.doesNotThrow(() => assertPublicOnly(publicView));
  for (const bad of [{ other: { actorId: null } }, { source: { private: true } }, { source: { actorId: 'GL2-CELIA' } }, { nextRoll: 1 },
    { glory: { life: { currentAttempt: { playerMoves: [{ actorId: null }] } } } },
    { divineHand: { life: { site: { guard: { actorId: 'PLAYER' } } } } },
    { divineHand: { life: { site: { guard: { actorId: 'secret' } } } } }]) assert.throws(() => assertPublicOnly(bad));
  const privateState = { random: { seed: 'private-seed' }, twilightGiant: { source: { actorId: 'private-person', historyDigest: 'private-digest',
    originals: { site: { guard: { actorId: 'GL2-CELIA' } } } } } };
  assert.throws(() => auditPublic(publicView, { random: privateState.random, twilightGiant: { source: { actorId: 'GL2-CELIA' } } }));
  assert.doesNotThrow(() => auditPublic(publicView, privateState));
  for (const secret of ['private-seed', 'private-person', 'private-digest']) assert.throws(() => auditPublic({ lines: [secret] }, privateState));
});

test('actual exported source roots stay frozen; only the live promotion body gains exact capped stats', () => {
  const original = { runId: 'same', random: { seed: 'same-seed', cursor: 481 }, revision: 729,
    originalA: { spent: 2 }, world: { unchanged: true }, combatHistory: [],
    character: { name: 'Same person', coreStats: { physique: 499, perception: 500, will: 26, knowledge: 23 } },
    progression: { sequence: 1, mastery: { old: 7 } } };
  const before = { ...structuredClone(original), twilightGiant: { guidanceKnown: true, source: { character: structuredClone(original.character) }, promotionWeek: null } };
  const next = structuredClone(before); next.revision++; next.week = 179; next.status = 'ACTIVE';
  const keys = ['originalA'], consume = { type: 'TWILIGHT_GIANT', command: { type: 'CONSUME' } };
  assert.doesNotThrow(() => assertOriginals(next, original, before, keys, consume));
  next.progression.sequence = 0; next.twilightGiant.promotionWeek = next.week;
  next.character.coreStats = { physique: 500, perception: 500, will: 27, knowledge: 24 };
  assert.doesNotThrow(() => assertOriginals(next, original, before, keys, consume));
  for (const mutate of [s => s.originalA.spent++, s => s.world.unchanged = false,
    s => s.character.name = 'Replacement', s => s.character.coreStats.will++,
    s => s.twilightGiant.source.character.coreStats.will++, s => s.progression.mastery.old++]) {
    const bad = structuredClone(next); mutate(bad); assert.throws(() => assertOriginalRoots(bad, original, keys));
  }
  assert.throws(() => assertOriginals(next, original, before, keys, { type: 'TWILIGHT_GIANT', command: { type: 'REST' } }));
});

test('reported ordinary bridge exit is terminal without inventing a city-return action', () => {
  const state = { status: 'ACTIVE', progression: { sequence: 0 }, week: 180, health: 90, mind: 90, spirituality: 90,
    twilightGiant: { promotionWeek: 179, frame: { location: 'GL2-REPAIR-ROOM' },
      epilogue: { status: 'RESOLVED', reported: true, position: -2, workers: [{ position: -2 }, { position: -2 }], giant: { applied: false }, twilight: { applied: true } } } };
  const view = { twilightGiant: { actions: [{ enabled: true, command: { type: 'RETURN_ON_FOOT' } }] } };
  assert.equal(terminal(state, view).stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(outcome(state).returnedHome, false); assert.equal(outcome(state).ordinaryExit, true);
  assert.equal(outcome(state).giantApplied, false);
  const recommended = { twilightGiant: { actions: [{ enabled: true, preferredAction: true, command: { type: 'REPORT' } }] } };
  assert.equal(terminal(state, recommended), null);
  const stillInside = structuredClone(state); stillInside.twilightGiant.epilogue.workers[0].position = 2;
  assert.equal(terminal(stillInside, view), null);
  const unreported = structuredClone(state); unreported.twilightGiant.epilogue.reported = false;
  assert.equal(terminal(unreported, view), null);
  assert.equal(terminal({ ...state, status: 'DEAD' }, recommended).stage, 'NATURAL_DEATH');
});
