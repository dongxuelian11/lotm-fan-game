import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOriginalRoots, assertOriginals, assertPublicOnly, auditPublic, chooseAction, freezePredecessors, FROZEN_SOURCE_KEYS,
  outcome, parseOptions, portableSourcePath, PREFIX_COUNT, sealRow, shouldPauseAtBoundary, snapshotReasons, SOURCE, SOURCE_REVISION,
  stable, stateHash, terminal, unwrapSource, verifyCommandChain, verifyRow } from './hanged-man-stage.mjs';

// Pure helpers only. No dist import, original fixture load, build, game or session.
const action = (type, fields = {}) => ({ id: type, label: type, cost: 'Actual cost', enabled: true,
  preferredAction: true, reason: null, command: { type }, ...fields });
const publicView = (overrides = {}) => ({ status: 'ACTIVE', activeEvent: null, combat: null,
  progression: { pathwayId: 'hanged-man', sequence: 2 }, week: 178, health: 100, mind: 100,
  spirituality: 120, cash: 330, actionsRemaining: 2, pollution: 0, wagePaid: true,
  canAct: true, actionBlockedReason: null, hangedMan: { guidanceKnown: false, actions: [] },
  darkAngel: { insideCase: false, preparedWeek: null, actions: [], life: { reflected: false, preferredActionId: null, actions: [] } },
  ...overrides });
const bottleAction = (type, n, fields = {}) => action(type, { id: `${type}-${n}`, command: { type, bottleId: n <= 3 ? `dark-angel-potion-${n}` : `dark-angel-recovery-${n - 3}` }, ...fields });
const withAngel = (view, changes) => ({ ...view, darkAngel: { ...view.darkAngel, ...changes } });

test('canonical encoding and exact source wrapper never substitute beforeLast or archive final', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
  const final = { revision: 724, status: 'ACTIVE', progression: { pathwayId: 'hanged-man', sequence: 2 } };
  const wrapper = { commandCount: 723, beforeLast: { revision: 723 }, lastIntent: { type: 'DARK_ANGEL', command: { type: 'CONSUME', bottleId: 'dark-angel-potion-3', confirmed: true } }, final };
  assert.equal(unwrapSource(wrapper), final);
  for (const bad of [final, { ...wrapper, commandCount: 824 }, { ...wrapper, final: wrapper.beforeLast },
    { ...wrapper, final: { ...final, status: 'DEAD' } }, { ...wrapper, final: { ...final, progression: { pathwayId: 'hanged-man', sequence: 1 } } }])
    assert.throws(() => unwrapSource(bad));
  assert.equal(PREFIX_COUNT + 1, 724); assert.equal(SOURCE_REVISION + 1, 725);
});

test('public resource policy purifies first then pays latest same-original recovery and real labour', () => {
  const clean = publicView();
  assert.deepEqual(chooseAction({ ...clean, pollution: 30, wagePaid: false }).intent, { type: 'ACTION', action: 'REST' });
  const requests = [1, 2, 3].map(n => bottleAction('REQUEST_RECOVERY_V1', n));
  assert.deepEqual(chooseAction(withAngel(clean, { actions: requests })).intent, { type: 'DARK_ANGEL', command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'dark-angel-potion-3' } });
  const retryAction = action('REQUEST_RECOVERY_V1', { command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'dark-angel-recovery-1' } });
  const retry = withAngel(clean, { actions: [...requests.slice(0, 2), retryAction] });
  assert.equal(chooseAction(retry).intent.command.bottleId, 'dark-angel-recovery-1');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: false }).intent.action, 'WORK');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: true }).intent.action, 'REST');
  const pending = withAngel(clean, { actions: [bottleAction('RECOVER_CHARACTERISTIC_V1', 3, { enabled: false, reason: 'Wait one real week' })] });
  assert.equal(chooseAction(pending).intent.action, 'REST');
  const labour = withAngel(clean, { actions: [bottleAction('POTION_WORK', 4), bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(labour).intent.command.type, 'POTION_WORK');
  assert.equal(chooseAction({ ...labour, actionsRemaining: 0 }).intent.action, 'REST');
  const buy = withAngel(clean, { actions: [bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(buy).intent.command.type, 'BUY_POTION');
  assert.equal(chooseAction({ ...buy, cash: 100 }).intent.action, 'REST');
  const held = withAngel({ ...clean, cash: 240 }, { actions: [bottleAction('CONSUME', 4), action('PREPARE_PROMOTION')] });
  assert.equal(chooseAction(held).intent.command.type, 'PREPARE_PROMOTION');
  assert.equal(chooseAction({ ...held, cash: 239 }).intent.action, 'REST');
  assert.equal(chooseAction(withAngel(clean, { actions: [bottleAction('RECOVER_CHARACTERISTIC_V1', 3)] })).intent.command.type, 'RECOVER_CHARACTERISTIC_V1');
  assert.equal(chooseAction(withAngel(clean, { actions: [action('REQUEST_SUPPLY')] })).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('prepared dose gets actual paid same-bottle support before consumption, never an unfunded fallback', () => {
  const consume = bottleAction('CONSUME', 4, { command: { type: 'CONSUME', bottleId: 'dark-angel-recovery-1', confirmed: true } });
  const support = bottleAction('STABILIZE_PROMOTION', 4);
  const prepared = withAngel(publicView({ canAct: false }), { insideCase: true, preparedWeek: 178, actions: [consume, support] });
  const chosen = chooseAction(prepared);
  assert.equal(chosen.intent.command.type, 'STABILIZE_PROMOTION');
  const after = withAngel(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Already supported' }] });
  assert.equal(chooseAction(after, chosen.intent).intent.command.type, 'CONSUME');
  assert.equal(chooseAction(after).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(withAngel(prepared, { preparedWeek: 177 }), chosen.intent).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(after, { type: 'DARK_ANGEL', command: { type: 'STABILIZE_PROMOTION', bottleId: 'dark-angel-potion-3' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(withAngel(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Insufficient actual cash' }] })).stop, 'PUBLIC_ACTION_BLOCKED');
  const unrelatedScene = withAngel(prepared, { preparedWeek: null, actions: [bottleAction('REQUEST_RECOVERY_V1', 4)] });
  assert.equal(chooseAction(unrelatedScene).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...unrelatedScene, pollution: 50 }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('real S1 preferred life and reflection precede guidance; locked scenes cannot be bypassed', () => {
  const lifeAction = action('OBSERVE');
  const life = withAngel(publicView({ progression: { pathwayId: 'hanged-man', sequence: 1 } }),
    { life: { reflected: false, preferredActionId: lifeAction.id, actions: [lifeAction] } });
  assert.equal(chooseAction(life).intent.type, 'DARK_ANGEL');
  assert.equal(chooseAction(life).intent.command.type, 'OBSERVE');
  const noAp = withAngel({ ...life, actionsRemaining: 0 }, { life: { reflected: false, preferredActionId: null, actions: [] } });
  assert.equal(chooseAction(noAp).intent.action, 'REST');
  assert.equal(chooseAction(withAngel(noAp, { insideCase: true })).stop, 'PUBLIC_ACTION_BLOCKED');
  const reflected = withAngel({ ...life, hangedMan: { guidanceKnown: false, actions: [action('LEARN_GUIDANCE')] } },
    { life: { reflected: true, preferredActionId: null, actions: [] } });
  assert.equal(chooseAction(reflected).intent.type, 'HANGED_MAN');
  assert.equal(chooseAction(reflected).intent.command.type, 'LEARN_GUIDANCE');
});

test('owned S0 selects exactly one enabled public preferred action and death stops absolutely', () => {
  const rest = action('REST'), view = publicView({ hangedMan: { guidanceKnown: true, actions: [rest] } });
  assert.deepEqual(chooseAction(view).intent, { type: 'HANGED_MAN', command: { type: 'REST' } });
  for (const actions of [[], [{ ...rest, enabled: false }], [rest, { ...rest, id: 'second' }]])
    assert.equal(chooseAction({ ...view, hangedMan: { ...view.hangedMan, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  for (const status of ['DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING']) assert.equal(chooseAction({ ...view, status }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'actual' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'actual' } }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('compact command/private/public/RNG chains bind prelude controls and preserve count versus revision', () => {
  const old = { type: 'OLD' }, intent = { type: 'ACTION', action: 'REST' }, random = { seed: 'pure-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const after = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'HANGED_MAN_CONTINUATION_ACTION', commandCount: 2, newCount: 1, intent,
    commandSha256: stateHash(intent), previousRowSha256: prefix.rowSha256, before: initial, after,
    publicAction: { enabled: true, kind: 'ORDINARY_RESOURCE', action: 'REST' } };
  const row = sealRow(payload), check = rows => verifyCommandChain(rows, { prefixCommands: [old], initial });
  assert.deepEqual(check([prefix, row]), { commandCount: 2, newCount: 1, rowSha256: row.rowSha256, anchor: after });
  for (const changes of [{ commandCount: 3 }, { after: { ...after, revision: 2 } },
    { before: { ...initial, publicStateSha256: stateHash('tampered') } },
    { after: { ...after, random: { ...random, cursor: 4 }, randomSha256: stateHash({ ...random, cursor: 4 }) } },
    { publicAction: { ...payload.publicAction, action: 'WORK' } }]) assert.throws(() => check([prefix, sealRow({ ...payload, ...changes })]));
  assert.throws(() => check([prefix, row, row])); assert.throws(() => verifyRow({ ...row, intent: { type: 'OTHER' } }));
  const consume = { type: 'HANGED_MAN', command: { type: 'CONSUME', compoundId: 'same', confirmed: true } };
  const s0 = { ...payload, intent: consume, commandSha256: stateHash(consume), publicAction: { enabled: true, preferredAction: true, selectionRule: 'EXACT_PUBLIC_PREFERRED', command: consume.command } };
  assert.doesNotThrow(() => check([prefix, sealRow(s0)]));
  assert.throws(() => check([prefix, sealRow({ ...s0, publicAction: { ...s0.publicAction, preferredAction: false } })]));
});

test('snapshots are sparse but retain both S1 and S0 consumption boundaries', () => {
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: { type: 'ACTION', action: 'REST' } }), []);
  for (const type of ['DARK_ANGEL', 'HANGED_MAN']) {
    const intent = { type, command: { type: 'CONSUME', confirmed: true } };
    assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: intent }), ['before-consume']);
    assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: intent, terminal: true }), ['periodic', 'after-consume', 'terminal']);
  }
});

test('explicit zero/one/N pause options offer no seed, cursor or outcome policy override', () => {
  assert.equal(portableSourcePath('/tmp/repo', `/tmp/repo/${SOURCE}`), SOURCE);
  assert.throws(() => portableSourcePath('/tmp/repo', '/tmp/other/source.json'));
  assert.throws(() => portableSourcePath('/tmp/repo', 'tests/fixtures/dark-angel-v02010/natural.json'));
  for (const n of [0, 1, 32]) assert.equal(parseOptions(['--source', SOURCE, '--out=capture', `--max-new-actions=${n}`, '--resume'], '/tmp/repo').maxNewActions, n);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 0 }), true);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 1, maxNewActions: 1 }), true);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 1 }), false);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 10, pauseRequested: true }), true);
  assert.equal(shouldPauseAtBoundary({ pending: { intent: 'durable-intent' }, completed: 0, maxNewActions: 1 }), false);
  for (const suffix of [['--seed', 'override'], ['--max-new-actions=-1'], ['--resume', '--resume'], ['--strategy', 'other']])
    assert.throws(() => parseOptions(['--source', SOURCE, '--out=capture', ...suffix]));
});

test('prelude preserves original eight roots and receipts; completed S1 freezes only at real S0 guidance', () => {
  assert.equal(FROZEN_SOURCE_KEYS.length, 9);
  assert.deepEqual(FROZEN_SOURCE_KEYS.slice(0, 2), ['secretSupplicant', 'listener']);
  const original = { runId: 'same', random: { seed: 'same', cursor: 5 }, revision: 40, status: 'ACTIVE', week: 4,
    originalA: { actual: 1 }, world: { actual: 2 }, combatHistory: [],
    character: { name: 'Same person', coreStats: { physique: 499, perception: 500, will: 25, knowledge: 25 } },
    progression: { sequence: 2, mastery: { old: 8 } },
    darkAngel: { sourceHistory: { original: true }, sourceScene: { original: true }, bottles: [{ id: '1' }, { id: '2' }, { id: '3' }], acquisitionJournal: [{ original: true }], life: { journal: [] } } };
  const keys = ['originalA', 'darkAngel'];
  const before = { ...structuredClone(original), hangedMan: { guidanceKnown: false, source: null } };
  const s1 = structuredClone(before); s1.revision++; s1.progression.sequence = 1; s1.darkAngel.promotionWeek = 4;
  s1.character.coreStats = { physique: 500, perception: 500, will: 26, knowledge: 26 };
  s1.darkAngel.life.journal.push({ actual: 'S1' });
  assert.doesNotThrow(() => assertOriginals(s1, original, before, keys, { type: 'DARK_ANGEL', command: { type: 'CONSUME' } }, null));
  const handoff = structuredClone(s1); handoff.hangedMan = { guidanceKnown: true, source: { revision: 41, character: structuredClone(s1.character) } };
  const frozen = freezePredecessors(handoff, keys);
  assert.doesNotThrow(() => assertOriginalRoots(handoff, original, keys, frozen));
  for (const mutate of [s => s.originalA.actual++, s => s.darkAngel.life.journal.push({ edited: true }), s => s.darkAngel.bottles[0].id = 'rewritten', s => s.character.name = 'Replacement', s => s.progression.mastery.old++]) {
    const bad = structuredClone(handoff); mutate(bad); assert.throws(() => assertOriginalRoots(bad, original, keys, frozen));
  }
  assert.throws(() => assertOriginalRoots(handoff, original, keys));
  assert.throws(() => assertOriginalRoots(before, original, keys, frozen));
  const s0 = structuredClone(handoff); s0.revision++; s0.progression.sequence = 0; s0.hangedMan.promotionWeek = s0.week;
  assert.doesNotThrow(() => assertOriginals(s0, original, handoff, keys, { type: 'HANGED_MAN', command: { type: 'CONSUME' } }, frozen));
  s0.character.coreStats.will++; assert.throws(() => assertOriginalRoots(s0, original, keys, frozen));
  const independent = structuredClone(before); independent.darkAngel.bottles.push({ id: 'dark-angel-potion-4' });
  assert.throws(() => assertOriginalRoots(independent, original, keys));
  const same = structuredClone(before); same.darkAngel.bottles.push({ id: 'dark-angel-recovery-1', recovery: { originalBottleId: 'dark-angel-potion-3' } });
  assert.doesNotThrow(() => assertOriginalRoots(same, original, keys));
});

test('whole-public audit admits only exact physical paths and rejects admission secrets', () => {
  const view = {
    hangedMan: { actions: ['PLAYER', 'HM223-VERA', 'HM223-EDWIN'].map(actorId => ({ command: { type: 'CROSS', actorId, segment: 'A' } })) },
    darkAngel: { life: { ledger: [{ moves: [{ actorId: 'PLAYER' }, { actorId: 'THT3-MARA' }] }] } },
    divineHand: { life: { site: { guard: { actorId: null } } } },
    glory: { life: { site: { guard: { actorId: null } } } },
    writer: { life: { practice: { record: { reportDigest: null } } } },
  };
  assert.doesNotThrow(() => assertPublicOnly(view));
  for (const bad of [
    { actorId: 'PLAYER' }, { actorId: 'HM223-KEEPER' }, { actorId: null }, { source: { private: true } },
    { nextRoll: 7 }, { cursor: 9 }, { unknownDigest: 'hidden' }, { elsewhere: { reportDigest: null } },
    { hangedMan: { actions: [{ command: { actorId: 'HM223-KEEPER' } }] } },
    { hangedMan: { actions: [{ command: { actorId: 'private-player' } }] } },
    { darkAngel: { life: { ledger: [{ moves: [{ actorId: 'HM223-VERA' }] }] } } },
    { darkAngel: { life: { pending: { actorId: 'PLAYER' } } } },
  ]) assert.throws(() => assertPublicOnly(bad));
  const privateState = { random: { seed: 'private-seed' }, hangedMan: {
    source: { actorId: 'private-player', historyDigest: 'private-digest' }, scene: { receipts: [{ actorId: 'HM223-KEEPER' }] },
  } };
  assert.doesNotThrow(() => auditPublic(view, privateState));
  assert.doesNotThrow(() => auditPublic({ owner: 'HM223-KEEPER' }, privateState));
  for (const secret of ['private-seed', 'private-player', 'private-digest']) assert.throws(() => auditPublic({ lines: [secret] }, privateState));
  for (const actorId of ['PLAYER', 'HM223-VERA', 'HM223-EDWIN', 'HM223-KEEPER']) {
    const admitted = structuredClone(privateState); admitted.hangedMan.source.actorId = actorId;
    assert.throws(() => auditPublic({ lines: [actorId] }, admitted));
  }
});

const reportedState = () => ({ status: 'ACTIVE', progression: { sequence: 0 }, week: 210, health: 90, mind: 90, spirituality: 90,
  darkAngel: { promotionWeek: 190, life: { reflected: true } },
  hangedMan: { guidanceKnown: true, promotionWeek: 210, frame: { location: 'HM223-CORRIDOR' },
    scene: { phase: 'PRACTICE', status: 'COMPLETED', evacuationReportEventId: 'evacuation', returnReportEventId: 'real-report',
      playerPosition: 'OUTSIDE', owner: { position: 'OUTSIDE' },
      workers: ['HM223-VERA', 'HM223-EDWIN'].map(id => ({ id, position: 'OUTSIDE', passage: { a: `${id}:a`, b: `${id}:b`, exit: `${id}:exit` } })),
      segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' }, window: null, contact: false,
      pressureApplied: false, cooperativeSealApplied: false } } });

test('actual return report terminates after ordinary exit including an honestly stopped practice', () => {
  const state = reportedState();
  assert.equal(terminal(state).stage, 'NATURAL_S0_RETURN_REPORTED');
  assert.equal(outcome(state).ordinaryExit, true);
  assert.equal(outcome(state).pressureApplied, false);
  assert.equal(outcome(state).cooperativeSealApplied, false);
  for (const mutate of [s => s.hangedMan.scene.workers[0].position = 'GATE', s => s.hangedMan.scene.workers[0].passage.a = null,
    s => s.hangedMan.scene.returnReportEventId = null, s => s.hangedMan.scene.playerPosition = 'ENTRY',
    s => s.hangedMan.scene.owner.position = 'ENTRY', s => s.hangedMan.scene.window = { kind: 'PRESSURE_BEARING' },
    s => s.hangedMan.scene.contact = true, s => s.hangedMan.scene.segments.B.open = true,
    s => s.hangedMan.scene.exit.door = 'OPEN', s => s.hangedMan.frame.location = 'HM223-WORKSHOP',
    s => s.progression.sequence = 1]) {
    const changed = structuredClone(state); mutate(changed); assert.equal(terminal(changed), null);
  }
  assert.equal(terminal({ ...state, status: 'DEAD' }).stage, 'NATURAL_DEATH');
  assert.equal(terminal({ ...state, status: 'SLICE_COMPLETE' }).stage, 'NATURAL_TERMINAL');
});


test('selection is public-only and never reads RNG, admission identity or future results', () => {
  const view = publicView({ pollution: 30 });
  const poison = (object, keys) => keys.forEach(key => Object.defineProperty(object, key, { get() { throw Error(`Private read: ${key}`); } }));
  poison(view, ['random', 'seed', 'cursor', 'nextRoll']);
  poison(view.hangedMan, ['source', 'frame', 'journal']);
  poison(view.darkAngel, ['sourceScene', 'sourceHistory', 'acquisitionJournal']);
  assert.deepEqual(chooseAction(view).intent, { type: 'ACTION', action: 'REST' });
  view.pollution = 0; view.darkAngel.actions = [bottleAction('REQUEST_RECOVERY_V1', 3)];
  assert.equal(chooseAction(view).intent.command.bottleId, 'dark-angel-potion-3');
});

test('important compact snapshots retain actual recovery and handoff without copying every action', () => {
  assert.deepEqual(snapshotReasons({ newCount: 1, afterIntent: { type: 'DARK_ANGEL', command: { type: 'RECOVER_CHARACTERISTIC_V1' } } }), ['same-original-recovery']);
  assert.deepEqual(snapshotReasons({ newCount: 2, afterIntent: { type: 'DARK_ANGEL', command: { type: 'REFLECT' } } }), ['s1-reflection']);
  assert.deepEqual(snapshotReasons({ newCount: 3, afterIntent: { type: 'HANGED_MAN', command: { type: 'LEARN_GUIDANCE' } } }), ['s0-guidance']);
  assert.deepEqual(snapshotReasons({ newCount: 4, afterIntent: { type: 'HANGED_MAN', command: { type: 'CROSS', actorId: 'HM223-VERA', segment: 'A' } } }), []);
});
