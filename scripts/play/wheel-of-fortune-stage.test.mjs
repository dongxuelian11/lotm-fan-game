import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicOnly, chooseAction, parseOptions, portableSourcePath, sealRow, snapshotReasons, SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, PREFIX_COUNT, SOURCE_REVISION, stable, stateHash, verifyCommandChain, verifyRow } from './wheel-of-fortune-stage.mjs';

// Pure helpers only: no dist import, original archive, build, session or action.
test('the Mercury source has 841 archived commands and an independent revision842', () => {
  assert.equal(SOURCE, 'tests/fixtures/mercury-snake-v02040/natural.json');
  assert.equal(SOURCE_SHA256, '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574');
  assert.equal(SOURCE_STATE_SHA256, 'd26118eb1a46c04dada97dffaf7ea4094eafaf00d4830b80a8caac2a6f8d50fa');
  assert.equal(PREFIX_COUNT, 841); assert.equal(SOURCE_REVISION, 842);
});

test('canonical hashes retain meaning and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
});

test('command, private/public and RNG chains keep revision separate from count', () => {
  const old = { type: 'OLD' }, command = { type: 'WHEEL_OF_FORTUNE', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'WHEEL_OF_FORTUNE_ACTION', commandCount: 2, newCount: 1, intent: command,
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

test('key snapshots cover initial, 16-action intervals, consumption and terminal', () => {
  const replace = { type: 'WHEEL_OF_FORTUNE', command: { type: 'CONSUME', compoundId:'test-compound',confirmed:true } };
  const rest = { type: 'WHEEL_OF_FORTUNE', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: replace }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: replace, terminal: true }), ['periodic', 'after-consume', 'terminal']);
});

test('only the exact enabled public preferred action can be selected', () => {
  const preferred = { id: 'rest', label: 'Rest', cost: '1 action', enabled: true, preferredAction: true, reason: null, command: { type: 'REST' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, wheelOfFortune: { guidanceKnown: true, actions: [preferred] } };
  assert.deepEqual(chooseAction(view).intent, { type: 'WHEEL_OF_FORTUNE', command: { type: 'REST' } });
  for (const actions of [[], [{ ...preferred, enabled: false, reason: 'No action point' }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, wheelOfFortune: { ...view.wheelOfFortune, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, status: 'DEAD' }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, wheelOfFortune: { ...view.wheelOfFortune, guidanceKnown: false } }).stop, 'PUBLIC_ACTION_BLOCKED');
  const guidance = { ...preferred, command: { type: 'LEARN_GUIDANCE' }, cost: '1 action, 20 pennies' };
  assert.deepEqual(chooseAction({ ...view, wheelOfFortune: { guidanceKnown: false, actions: [guidance] } }).intent,
    { type: 'WHEEL_OF_FORTUNE', command: { type: 'LEARN_GUIDANCE' } });
  const recovery = { ...preferred, command: { type: 'RECOVER_REMAINS', compoundId: 'actual-failed-compound' } };
  assert.deepEqual(chooseAction({ ...view, wheelOfFortune: { ...view.wheelOfFortune, actions: [recovery] } }).intent.command, recovery.command);
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
test('accepts only Mercury physical movement roles on their exact inherited ledger path', () => {
  const view = actorId => ({ mercurySnake: { life: { ledger: [{ moves: [{ actorId, from: 'START', to: 'A', metres: 4 }] }] } } });
  for (const id of ['PLAYER', 'GUIDE', 'CW3-VERA', 'CW3-CART', 'CW3-PARCEL']) assert.doesNotThrow(() => assertPublicOnly(view(id)));
  for (const id of ['UNKNOWN', 'PRIVATE-AUTHORITY', null]) assert.throws(() => assertPublicOnly(view(id)));
  assert.throws(() => assertPublicOnly({ actorId: 'CW3-VERA' }));
  assert.throws(() => assertPublicOnly({ wheelOfFortune: { actions: [{ command: { actorId: 'CW3-VERA' } }] } }));
  assert.throws(() => assertPublicOnly({ ...view('CW3-VERA'), randomCursor: 306 }));
  assert.throws(() => assertPublicOnly({ wheelOfFortune: { source: { actorId: 'private-player' } } }));
  assert.throws(() => assertPublicOnly({ wheelOfFortune: { nextRoll: 70 } }));
});
