import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicOnly, chooseAction, outcome, terminal, parseOptions, portableSourcePath, sealRow, snapshotReasons, SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, PREFIX_COUNT, SOURCE_REVISION, stable, stateHash, verifyCommandChain, verifyRow } from './black-emperor-stage.mjs';

// Pure helpers only: no dist import, original archive, build, session or action.
test('the Prince source has 924 archived commands and an independent revision925', () => {
  assert.equal(SOURCE, 'tests/fixtures/prince-of-abolition-v02050/natural.json');
  assert.equal(SOURCE_SHA256, '116e7060455dbde907758f92af3fb20f6de8f0e15b248f44bb895d4a78e03dfa');
  assert.equal(SOURCE_STATE_SHA256, '29884ce25f4e53df01bf56aa812174c18bf278313ce6f2176b0313a7325c3124');
  assert.equal(PREFIX_COUNT, 924); assert.equal(SOURCE_REVISION, 925);
});

test('canonical hashes retain meaning and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
});

test('command, private/public and RNG chains keep revision separate from count', () => {
  const old = { type: 'OLD' }, command = { type: 'BLACK_EMPEROR', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, week: 222, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'BLACK_EMPEROR_ACTION', commandCount: 2, newCount: 1, intent: command,
    commandSha256: stateHash(command), previousRowSha256: prefix.rowSha256, before: initial, after: next, elapsedWeeks: 0,
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

test('key snapshots cover initial, 16-action intervals, consumption and terminal', () => {
  const replace = { type: 'BLACK_EMPEROR', command: { type: 'CONSUME', compoundId:'test-compound',confirmed:true } };
  const rest = { type: 'BLACK_EMPEROR', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: replace }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: replace, terminal: true }), ['periodic', 'after-consume', 'terminal']);
});

test('only the exact enabled public preferred action can be selected', () => {
  const preferred = { id: 'rest', label: 'Rest', cost: '1 action', enabled: true, preferredAction: true, reason: null, command: { type: 'REST' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, blackEmperor: { guidanceKnown: true, actions: [preferred] } };
  assert.deepEqual(chooseAction(view).intent, { type: 'BLACK_EMPEROR', command: { type: 'REST' } });
  for (const actions of [[], [{ ...preferred, enabled: false, reason: 'No action point' }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, blackEmperor: { ...view.blackEmperor, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, status: 'DEAD' }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, blackEmperor: { ...view.blackEmperor, guidanceKnown: false } }).stop, 'PUBLIC_ACTION_BLOCKED');
  const guidance = { ...preferred, command: { type: 'LEARN_GUIDANCE' }, cost: '1 action, 20 pennies' };
  assert.deepEqual(chooseAction({ ...view, blackEmperor: { guidanceKnown: false, actions: [guidance] } }).intent,
    { type: 'BLACK_EMPEROR', command: { type: 'LEARN_GUIDANCE' } });
  const recovery = { ...preferred, command: { type: 'RECOVER_REMAINS', compoundId: 'actual-failed-compound' } };
  assert.deepEqual(chooseAction({ ...view, blackEmperor: { ...view.blackEmperor, actions: [recovery] } }).intent.command, recovery.command);
  assert.deepEqual(chooseAction({ ...view, random: { seed: 'ignored', cursor: 999 }, futureRoll: 1 }).intent, chooseAction(view).intent);
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

// Actual old bodily movement IDs are public, while authority actor IDs stay private.
test('allows published physical roles but rejects Prince private movement and window identities', () => {
  const view = actorId => ({ mercurySnake: { life: { ledger: [{ moves: [{ actorId, from: 'START', to: 'A', metres: 4 }] }] } } });
  for (const id of ['PLAYER', 'GUIDE', 'CW3-VERA', 'CW3-CART', 'CW3-PARCEL']) assert.doesNotThrow(() => assertPublicOnly(view(id)));
  for (const id of ['UNKNOWN', 'PRIVATE-AUTHORITY', null]) assert.throws(() => assertPublicOnly(view(id)));
  assert.throws(() => assertPublicOnly({ actorId: 'CW3-VERA' }));
  assert.throws(() => assertPublicOnly({ blackEmperor: { actions: [{ command: { actorId: 'CW3-VERA' } }] } }));
  assert.throws(() => assertPublicOnly({ ...view('CW3-VERA'), randomCursor: 306 }));
  assert.throws(() => assertPublicOnly({ blackEmperor: { source: { actorId: 'private-player' } } }));
  assert.throws(() => assertPublicOnly({ blackEmperor: { nextRoll: 70 } }));
  assert.throws(() => assertPublicOnly({ blackEmperor: { privateSite: 'secret-coordinates' } }));
  // Mirrors projectPrinceOfAbolitionLife's explicit public field selection.
  // The underlying state movement/window/flight actorId is intentionally absent.
  const prince = { princeOfAbolition: { life: {
    playerLocation: 'ANNEX', playerTravelMetres: 4,
    pending: { abilityId: 'black-emperor.s1.directed-amplification', remainingSeconds: 20 },
    flight: { objectId: 'FM3-PRACTICE-BALL', from: '新起点', to: '新接球垫', positionMetres: 2, remainingSeconds: 2, maintenanceSeconds: 0 },
    ledger: [{ week: 216, label: '实际步行', actions: 0, pennies: 0, spirituality: 0, mind: 0, seconds: 4, outcome: null }],
  } } };
  assert.doesNotThrow(() => assertPublicOnly(prince));
  for (const actorId of ['PLAYER', 'GUIDE', 'FM3-DARIAN', 'private-original-player', null]) {
    for (const field of ['pending', 'flight']) {
      const leaking = structuredClone(prince); leaking.princeOfAbolition.life[field].actorId = actorId;
      assert.throws(() => assertPublicOnly(leaking), `Prince ${field}.actorId is not a public field`);
    }
    const leaking = structuredClone(prince);
    leaking.princeOfAbolition.life.ledger[0].moves = [{ actorId, from: 'OUTSIDE', to: 'ANNEX', metres: 4, seconds: 4, itemIds: [] }];
    assert.throws(() => assertPublicOnly(leaking), 'Prince ledger does not publish private movement records');
  }
});


test('one real construction command can legitimately settle multiple weeks', () => {
  const intent = { type: 'BLACK_EMPEROR', command: { type: 'NEXT_CONSTRUCTION', cityId: 'example-city' } };
  const random = { seed: 'pure-helper-example', cursor: 8 };
  const before = { revision: 925, week: 222, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const after = { ...before, revision: 926, week: 225, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'BLACK_EMPEROR_ACTION', commandCount: 1, newCount: 1, intent,
    commandSha256: stateHash(intent), previousRowSha256: null, before, after, elapsedWeeks: 3,
    publicAction: { enabled: true, preferredAction: true, command: intent.command } };
  const check = row => verifyCommandChain([row], { prefixCommands: [], initial: before });
  assert.equal(check(sealRow(payload)).anchor.week, 225);
  assert.throws(() => check(sealRow({ ...payload, elapsedWeeks: 1 })));
  assert.throws(() => check(sealRow({ ...payload, elapsedWeeks: -3 })));
  assert.throws(() => check(sealRow({ ...payload, after: { ...after, revision: 928 } })));
});

test('failed promotion remains recoverable and completed facility alone closes the route', () => {
  const failed = { id: 'same-failed-compound', status: 'FAILED_EXPOSED', consumedEventId: 'actual-failure' };
  const state = { status: 'ACTIVE', progression: { sequence: 1 }, week: 260, health: 60, mind: 50, spirituality: 70,
    blackEmperor: { materials: { compounds: [failed] }, scene: { phase: 'REALM', status: 'ACTIVE',
      playerPosition: 'OUTSIDE', exit: { door: 'CLOSED' }, returnReportEventId: null,
      constructionReceipts: [{ weeks: 3 }, { weeks: 3 }] } } };
  const view = { blackEmperor: { actions: [] } };
  assert.equal(terminal(state, view), null);
  assert.deepEqual(outcome(state).compoundOutcomes, [failed]);
  assert.equal(outcome(state).constructionWeeks, 6);
  assert.equal(outcome(state).constructionBatches, 2);
  const completed = structuredClone(state);
  completed.progression.sequence = 0; completed.blackEmperor.scene.phase = 'PRACTICE';
  completed.blackEmperor.scene.status = 'COMPLETED'; completed.blackEmperor.scene.returnReportEventId = 'real-report';
  assert.equal(terminal(completed, view).stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(terminal(completed, { blackEmperor: { actions: [{ preferredAction: true }] } }), null);
  const aborted = structuredClone(state); aborted.blackEmperor.scene.status = 'ABORTED';
  assert.equal(terminal(aborted, view).stage, 'NATURAL_ORDINARY_EXIT');
  aborted.blackEmperor.scene.exit.door = 'OPEN'; assert.equal(terminal(aborted, view), null);
  assert.equal(terminal({ ...state, status: 'DEAD' }, view).stage, 'NATURAL_DEATH');
});
