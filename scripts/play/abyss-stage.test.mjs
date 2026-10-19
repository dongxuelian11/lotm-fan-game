import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseAction, parseOptions, portableSourcePath, sealRow, snapshotReasons, SOURCE, stable, stateHash, verifyCommandChain, verifyRow } from './abyss-stage.mjs';

// Pure helpers only: no dist import, original archive, build, session or action.
test('canonical hashes retain meaning and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
});

test('command, private/public and RNG chains keep revision separate from count', () => {
  const old = { type: 'OLD' }, command = { type: 'ABYSS', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'ABYSS_ACTION', commandCount: 2, newCount: 1, intent: command,
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
  const replace = { type: 'ABYSS', command: { type: 'CONSUME', compoundId:'test-compound',confirmed:true } };
  const rest = { type: 'ABYSS', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: replace }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: replace, terminal: true }), ['periodic', 'after-consume', 'terminal']);
});

test('only the exact enabled public preferred action can be selected', () => {
  const preferred = { id: 'rest', label: 'Rest', cost: '1 action', enabled: true, preferredAction: true, reason: null, command: { type: 'REST' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, abyss: { guidanceKnown: true, actions: [preferred] } };
  assert.deepEqual(chooseAction(view).intent, { type: 'ABYSS', command: { type: 'REST' } });
  for (const actions of [[], [{ ...preferred, enabled: false, reason: 'No action point' }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, abyss: { ...view.abyss, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
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
