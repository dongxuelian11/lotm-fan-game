import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FORMAT, SOURCE_FORMAT, SOURCE_BYTES, HOME, PREDECESSOR_ROOTS, FROZEN_ROOTS, verifySourceArchive, assertOriginals, outcome, terminal, assertPublicOnly, chooseAction, parseOptions, portableSourcePath, sealRow, snapshotReasons, SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, PREFIX_COUNT, SOURCE_REVISION, stable, stateHash, verifyCommandChain, verifyRow } from './mother-stage.mjs';

// Pure helpers and one read-only pinned-archive audit: no dist import, build, session or action.
test('the Nature Walker source has 955 archived commands and an independent revision956', () => {
  assert.equal(SOURCE, 'tests/fixtures/nature-walker-v02070/natural.json');
  assert.equal(SOURCE_SHA256, '620cd1a94fd3a4c89abf6359c8126a564383bee51dc6fdfbd2442e4cca67916c');
  assert.equal(SOURCE_STATE_SHA256, '80e22b5ff3073288904d6ffbfc7f422ae27e9f5c363c33f4de4842bb3fdd4271');
  assert.equal(PREFIX_COUNT, 955); assert.equal(SOURCE_REVISION, 956);
  assert.equal(FORMAT, 'NEW229_ACTUAL955_COMPACT_OWNED_V1'); assert.equal(SOURCE_FORMAT, 'FULL_NATURAL_ARCHIVE');
  assert.equal(SOURCE_BYTES, 9853856); assert.equal(HOME, 'MO229-GREENHOUSE');
});

test('canonical hashes retain meaning and reject non-JSON values', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
});

test('command, private/public and RNG chains keep revision separate from count', () => {
  const old = { type: 'OLD' }, command = { type: 'MOTHER', command: { type: 'REST' } };
  const random = { seed: 'pure-helper-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const next = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'MOTHER_ACTION', commandCount: 2, newCount: 1, intent: command,
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
  const replace = { type: 'MOTHER', command: { type: 'CONSUME', compoundId:'test-compound',confirmed:true } };
  const rest = { type: 'MOTHER', command: { type: 'REST' } };
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: rest }), []);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: rest }), ['periodic']);
  assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: replace }), ['before-consume']);
  assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: replace, terminal: true }), ['periodic', 'after-consume', 'terminal']);
});

test('only the exact enabled public preferred action can be selected', () => {
  const preferred = { id: 'rest', label: 'Rest', cost: '1 action', enabled: true, preferredAction: true, reason: null, command: { type: 'REST' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, mother: { guidanceKnown: true, actions: [preferred] } };
  assert.deepEqual(chooseAction(view).intent, { type: 'MOTHER', command: { type: 'REST' } });
  for (const actions of [[], [{ ...preferred, enabled: false, reason: 'No action point' }], [preferred, { ...preferred, id: 'second' }]])
    assert.equal(chooseAction({ ...view, mother: { ...view.mother, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'inherited' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, status: 'DEAD' }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, mother: { ...view.mother, guidanceKnown: false } }).stop, 'PUBLIC_ACTION_BLOCKED');
  const guidance = { ...preferred, command: { type: 'LEARN_GUIDANCE' }, cost: '1 action, 20 pennies' };
  assert.deepEqual(chooseAction({ ...view, mother: { guidanceKnown: false, actions: [guidance] } }).intent,
    { type: 'MOTHER', command: { type: 'LEARN_GUIDANCE' } });
  const recovery = { ...preferred, command: { type: 'RECOVER_REMAINS', compoundId: 'actual-failed-compound' } };
  assert.deepEqual(chooseAction({ ...view, mother: { ...view.mother, actions: [recovery] } }).intent.command, recovery.command);
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

// The inherited blank guard markers are public nulls, not identity wildcards.
test('private actor IDs and future RNG stay forbidden on every other public path', () => {
  for (const root of ['divineHand', 'glory']) assert.doesNotThrow(() => assertPublicOnly({ [root]: { life: { site: { guard: { actorId: null } } } } }));
  for (const id of ['PLAYER', 'CB3-ADA', 'CB3-LENA', 'PRIVATE-AUTHORITY', null]) {
    assert.throws(() => assertPublicOnly({ actorId: id }));
    assert.throws(() => assertPublicOnly({ mother: { actions: [{ command: { actorId: id } }] } }));
    assert.throws(() => assertPublicOnly({ mercurySnake: { life: { ledger: [{ moves: [{ actorId: id }] }] } } }));
  }
  assert.throws(() => assertPublicOnly({ divineHand: { life: { site: { guard: { actorId: 'CB3-ADA' } } } } }));
  assert.throws(() => assertPublicOnly({ mother: { source: { actorId: 'private-player' } } }));
  for (const key of ['random', 'randomCursor', 'nextRoll', 'historyDigest']) assert.throws(() => assertPublicOnly({ mother: { [key]: 70 } }));
  assert.doesNotThrow(() => assertPublicOnly({ mother: { sections: [{ lines: ['艾达和莉娜在温室外。'] }] } }));
});

test('the full natural final preserves its actual nested originals and exact old mastery', () => {
  const bytes = readFileSync(new URL(`../../${SOURCE}`, import.meta.url));
  assert.equal(bytes.length, SOURCE_BYTES);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), SOURCE_SHA256);
  const archive = JSON.parse(bytes), original = verifySourceArchive(archive);
  assert.equal(original, archive.final);
  assert.notEqual(original, archive.prefixFinal);
  assert.deepEqual(Object.keys(original.natureWalker.sourceHistory), PREDECESSOR_ROOTS);
  assert.deepEqual(FROZEN_ROOTS, [...PREDECESSOR_ROOTS, 'natureWalker', 'world', 'combatHistory', 'character']);
  assert.notEqual(original.natureWalker.life.rootPad.integrity, original.natureWalker.life.source.originals.rootPad.integrity);
  const next = { ...original, revision: original.revision + 1, progression: structuredClone(original.progression) };
  assert.doesNotThrow(() => assertOriginals(next, original, original));
  next.progression.mastery['mother.s2.root-buffer']++;
  assert.throws(() => assertOriginals(next, original, original), /Old mastery changed/);
  next.progression = original.progression;
  next.natureWalker = { ...original.natureWalker, life: { ...original.natureWalker.life, rootPad: { ...original.natureWalker.life.rootPad, integrity: 50 } } };
  assert.throws(() => assertOriginals(next, original, original), /Inherited root changed/);
  assert.throws(() => verifySourceArchive({ ...archive, final: archive.prefixFinal }));
  assert.throws(() => verifySourceArchive({ ...archive, commands: archive.commands.slice(1) }));
});

test('public clinic recovery is selected unchanged with no private fallback', () => {
  const clinic = { label: '普通处置当前重伤', enabled: true, preferredAction: true, command: { type: 'CLINIC' } };
  const view = { status: 'ACTIVE', activeEvent: null, combat: null, mother: { guidanceKnown: true, actions: [clinic] } };
  const selected = chooseAction(view);
  assert.deepEqual(selected.intent, { type: 'MOTHER', command: { type: 'CLINIC' } });
  selected.intent.command.type = 'REST';
  assert.equal(clinic.command.type, 'CLINIC');
  assert.equal(chooseAction({ ...view, mother: { guidanceKnown: true, actions: [{ ...clinic, enabled: false }] } }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('ordinary greenhouse closure uses the open route and actual returned original plants', () => {
  const plant = (id, originalHolder) => ({ id, originalHolder, holder: originalHolder, location: 'OUTSIDE', returnedEventId: `${id}:returned` });
  const state = { status: 'ACTIVE', progression: { sequence: 0 }, week: 250, health: 70, mind: 60, spirituality: 80,
    mother: { frame: { location: HOME }, scene: { playerPosition: 'OUTSIDE', status: 'COMPLETED', greenhouse: { exitOpen: true },
      plants: [plant('CB3-LIVE-1', 'RECIPIENT'), plant('CB3-LIVE-2', 'OWNER')], returnReportEventId: 'actual-report', maintenanceApplied: false, branchApplied: true } } };
  const view = { mother: { actions: [] } };
  assert.equal(terminal(state, view).stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(outcome(state).maintenanceApplied, false); assert.equal(outcome(state).branchApplied, true);
  assert.equal(terminal(state, { mother: { actions: [{ preferredAction: true }] } }), null);
  for (const changed of [
    { ...state.mother.scene, plants: state.mother.scene.plants.slice(0, 1) },
    { ...state.mother.scene, greenhouse: { exitOpen: false } },
    { ...state.mother.scene, playerPosition: 'GREENHOUSE' },
    { ...state.mother.scene, returnReportEventId: null },
  ]) assert.equal(terminal({ ...state, mother: { ...state.mother, scene: changed } }, view), null);
  assert.equal(terminal({ ...state, status: 'DEAD' }, view).stage, 'NATURAL_DEATH');
});
