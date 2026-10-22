import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOriginalRoots, assertOriginals, assertPublicOnly, auditPublic, chooseAction, freezePredecessors, FROZEN_SOURCE_KEYS,
  outcome, parseOptions, portableSourcePath, PREFIX_COUNT, sealRow, shouldPauseAtBoundary, snapshotReasons, SOURCE, SOURCE_REVISION,
  stable, stateHash, terminal, unwrapSource, verifyCommandChain, verifyRow } from './justiciar-stage.mjs';

// Pure selection/integrity helpers only: no fixture, dist, game, session or draw.
const action = (type, fields = {}) => ({ id: type, label: type, cost: 'Actual public cost', enabled: true,
  preferredAction: true, reason: null, command: { type }, ...fields });
const publicView = (overrides = {}) => ({ status: 'ACTIVE', activeEvent: null, combat: null,
  progression: { pathwayId: 'justiciar', sequence: 2 }, week: 169, health: 100, mind: 100,
  spirituality: 120, cash: 360, actionsRemaining: 3, pollution: 0, wagePaid: true,
  canAct: true, actionBlockedReason: null, justiciar: { guidanceKnown: false, actions: [] },
  handOfOrder: { insideCase: false, preparedWeek: null, actions: [], life: { reflected: false, preferredActionId: null, actions: [] } },
  ...overrides });
const bottleAction = (type, n, fields = {}) => action(type, { id: `${type}-${n}`,
  command: { type, bottleId: n <= 3 ? `hand-of-order-potion-${n}` : `hand-of-order-recovery-${n - 3}` }, ...fields });
const withHand = (view, changes) => ({ ...view, handOfOrder: { ...view.handOfOrder, ...changes } });

test('canonical exact706 complete wrapper distinguishes command count707 from revision708', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
  const final = { revision: 707, status: 'ACTIVE', progression: { pathwayId: 'justiciar', sequence: 2 } };
  const wrapper = { commandCount: 706, beforeLast: { revision: 706 }, lastIntent: { type: 'ACTION', action: 'WORK' }, final };
  assert.equal(unwrapSource(wrapper), final);
  for (const bad of [final, { ...wrapper, commandCount: 801 }, { ...wrapper, final: wrapper.beforeLast },
    { ...wrapper, final: { ...final, status: 'DEAD' } }, { ...wrapper, final: { ...final, progression: { pathwayId: 'justiciar', sequence: 1 } } }])
    assert.throws(() => unwrapSource(bad));
  assert.equal(PREFIX_COUNT + 1, 707); assert.equal(SOURCE_REVISION + 1, 708);
  assert.equal(portableSourcePath('/tmp/repo', `/tmp/repo/${SOURCE}`), SOURCE);
  assert.throws(() => portableSourcePath('/tmp/repo', 'tests/fixtures/hand-of-order-v02060/natural.json'));
});

test('public S2 selection purifies20 first and pays only the latest failed original recovery', () => {
  const clean = publicView(), requests = [1, 2, 3].map(n => bottleAction('REQUEST_RECOVERY_V1', n));
  assert.deepEqual(chooseAction(withHand({ ...clean, pollution: 20, wagePaid: false }, { actions: requests })).intent, { type: 'ACTION', action: 'REST' });
  assert.deepEqual(chooseAction(withHand(clean, { actions: requests })).intent,
    { type: 'HAND_OF_ORDER', command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'hand-of-order-potion-3' } });
  const retry = withHand(clean, { actions: [...requests.slice(0, 2), bottleAction('REQUEST_RECOVERY_V1', 4)] });
  assert.equal(chooseAction(retry).intent.command.bottleId, 'hand-of-order-recovery-1');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: false }).intent.action, 'WORK');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: true }).intent.action, 'REST');
  const pending = withHand(clean, { actions: [bottleAction('RECOVER_CHARACTERISTIC_V1', 3, { enabled: false, reason: 'Wait one actual week' })] });
  assert.equal(chooseAction(pending).intent.action, 'REST');
  assert.equal(chooseAction(withHand(clean, { actions: [bottleAction('RECOVER_CHARACTERISTIC_V1', 3)] })).intent.command.type, 'RECOVER_CHARACTERISTIC_V1');
  assert.equal(chooseAction(withHand(clean, { actions: [action('REQUEST_SUPPLY')] })).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('five real labour controls precede new drugs and budget includes180 site60 support30 bill', () => {
  const clean = publicView();
  const labour = withHand(clean, { actions: [bottleAction('POTION_WORK', 4), bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(labour).intent.command.type, 'POTION_WORK');
  assert.equal(chooseAction({ ...labour, actionsRemaining: 0 }).intent.action, 'REST');
  const buy = withHand(clean, { actions: [bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(buy).intent.command.type, 'BUY_POTION');
  assert.equal(chooseAction({ ...buy, cash: 359 }).intent.action, 'REST');
  const held = withHand({ ...clean, cash: 270 }, { actions: [bottleAction('CONSUME', 4), action('PREPARE_PROMOTION')] });
  assert.equal(chooseAction(held).intent.command.type, 'PREPARE_PROMOTION');
  assert.equal(chooseAction({ ...held, cash: 269 }).intent.action, 'REST');
});

test('prepared same bottle gets paid support then actual consume without chance or outcome guarantees', () => {
  const consume = bottleAction('CONSUME', 4, { command: { type: 'CONSUME', bottleId: 'hand-of-order-recovery-1', confirmed: true } });
  const support = bottleAction('STABILIZE_PROMOTION', 4);
  const prepared = withHand(publicView({ canAct: false }), { insideCase: true, preparedWeek: 169, actions: [consume, support] });
  const chosen = chooseAction(prepared); assert.equal(chosen.intent.command.type, 'STABILIZE_PROMOTION');
  const after = withHand(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Already supported' }] });
  assert.equal(chooseAction(after, chosen.intent).intent.command.type, 'CONSUME');
  assert.equal(chooseAction(after).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(withHand(prepared, { preparedWeek: 168 }), chosen.intent).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(after, { type: 'HAND_OF_ORDER', command: { type: 'STABILIZE_PROMOTION', bottleId: 'hand-of-order-potion-3' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(withHand(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Insufficient real cash' }] })).stop, 'PUBLIC_ACTION_BLOCKED');
  const actualScene = withHand(prepared, { preparedWeek: null, actions: [bottleAction('REQUEST_RECOVERY_V1', 4)] });
  assert.equal(chooseAction({ ...actualScene, pollution: 20 }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('real S1 life uses public preferred route and real rest for AP rather than fees or travel', () => {
  const lifeAction = action('EXIT_ORIGINAL');
  const life = withHand(publicView({ progression: { pathwayId: 'justiciar', sequence: 1 } }),
    { life: { reflected: false, preferredActionId: lifeAction.id, actions: [lifeAction] } });
  assert.deepEqual(chooseAction(life).intent, { type: 'HAND_OF_ORDER', command: { type: 'EXIT_ORIGINAL' } });
  const ability = action('PREPARE', { id: 'prepare-ability', command: { type: 'PREPARE', caseId: 'paired-handover', method: 'ABILITY' } });
  const ordinary = action('PREPARE', { id: 'prepare-ordinary', command: { type: 'PREPARE', caseId: 'paired-handover', method: 'ORDINARY' } });
  const shortAp = withHand({ ...life, actionsRemaining: 1, wagePaid: false },
    { life: { reflected: false, preferredActionId: ordinary.id, actions: [{ ...ability, enabled: false }, ordinary] } });
  assert.deepEqual(chooseAction(shortAp).intent, { type: 'ACTION', action: 'REST' });
  assert.equal(chooseAction({ ...shortAp, actionsRemaining: 2 }).intent.action, 'REST');
  const prepared = withHand({ ...life, actionsRemaining: 0, canAct: false },
    { insideCase: true, life: { reflected: false, preferredActionId: 'WALK', actions: [action('WALK', { command: { type: 'WALK', caseId: 'paired-handover', to: 'OUTSIDE' } })] } });
  assert.equal(chooseAction(prepared).intent.command.type, 'WALK');
  assert.equal(chooseAction(withHand(prepared, { preparedWeek: 169 })).stop, 'PUBLIC_ACTION_BLOCKED');
  const reflected = withHand({ ...life, justiciar: { guidanceKnown: false, actions: [action('LEARN_GUIDANCE')] } },
    { life: { reflected: true, preferredActionId: null, actions: [] } });
  assert.deepEqual(chooseAction(reflected).intent, { type: 'JUSTICIAR', command: { type: 'LEARN_GUIDANCE' } });
});

test('owned S0 selects one enabled exact preferred control and never reads private RNG or admission state', () => {
  const rest = action('REST'), view = publicView({ justiciar: { guidanceKnown: true, actions: [rest] } });
  assert.deepEqual(chooseAction(view).intent, { type: 'JUSTICIAR', command: { type: 'REST' } });
  for (const actions of [[], [{ ...rest, enabled: false }], [rest, { ...rest, id: 'second' }]])
    assert.equal(chooseAction({ ...view, justiciar: { ...view.justiciar, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  for (const status of ['DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING']) assert.equal(chooseAction({ ...view, status }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'real' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'real' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  const publicOnly = publicView({ pollution: 20 });
  const poison = (object, keys) => keys.forEach(key => Object.defineProperty(object, key, { get() { throw Error(`Private read: ${key}`); } }));
  poison(publicOnly, ['random', 'seed', 'cursor', 'nextRoll']); poison(publicOnly.justiciar, ['source', 'frame', 'journal']);
  poison(publicOnly.handOfOrder, ['sourceScene', 'sourceHistory', 'acquisitionJournal']);
  assert.deepEqual(chooseAction(publicOnly).intent, { type: 'ACTION', action: 'REST' });
});

test('compact hashes bind commands public controls private boundaries and monotonic original RNG', () => {
  const old = { type: 'OLD' }, intent = { type: 'ACTION', action: 'REST' }, random = { seed: 'pure-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const after = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'JUSTICIAR_CONTINUATION_ACTION', commandCount: 2, newCount: 1, intent,
    commandSha256: stateHash(intent), previousRowSha256: prefix.rowSha256, before: initial, after,
    publicAction: { enabled: true, kind: 'ORDINARY_RESOURCE', action: 'REST' } };
  const row = sealRow(payload), check = rows => verifyCommandChain(rows, { prefixCommands: [old], initial });
  assert.deepEqual(check([prefix, row]), { commandCount: 2, newCount: 1, rowSha256: row.rowSha256, anchor: after });
  for (const changes of [{ commandCount: 3 }, { after: { ...after, revision: 2 } },
    { before: { ...initial, publicStateSha256: stateHash('tampered') } },
    { after: { ...after, random: { ...random, cursor: 4 }, randomSha256: stateHash({ ...random, cursor: 4 }) } },
    { publicAction: { ...payload.publicAction, action: 'WORK' } }]) assert.throws(() => check([prefix, sealRow({ ...payload, ...changes })]));
  assert.throws(() => check([prefix, row, row])); assert.throws(() => verifyRow({ ...row, intent: { type: 'OTHER' } }));
  const consume = { type: 'JUSTICIAR', command: { type: 'CONSUME', compoundId: 'same', confirmed: true } };
  const s0 = { ...payload, intent: consume, commandSha256: stateHash(consume), publicAction: { enabled: true, preferredAction: true, selectionRule: 'EXACT_PUBLIC_PREFERRED', command: consume.command } };
  assert.doesNotThrow(() => check([prefix, sealRow(s0)]));
  assert.throws(() => check([prefix, sealRow({ ...s0, publicAction: { ...s0.publicAction, preferredAction: false } })]));
});

test('sparse consumption recovery handoff snapshots and zero one N safe pause accept no override', () => {
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: { type: 'ACTION', action: 'REST' } }), []);
  for (const type of ['HAND_OF_ORDER', 'JUSTICIAR']) {
    const intent = { type, command: { type: 'CONSUME', confirmed: true } };
    assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: intent }), ['before-consume']);
    assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: intent, terminal: true }), ['periodic', 'after-consume', 'terminal']);
  }
  for (const [type, command, reason] of [['HAND_OF_ORDER', 'RECOVER_CHARACTERISTIC_V1', 'same-original-recovery'], ['HAND_OF_ORDER', 'REFLECT', 's1-reflection'], ['JUSTICIAR', 'LEARN_GUIDANCE', 's0-guidance']])
    assert.deepEqual(snapshotReasons({ newCount: 1, afterIntent: { type, command: { type: command } } }), [reason]);
  for (const n of [0, 1, 32]) assert.equal(parseOptions(['--source', SOURCE, '--out=capture', `--max-new-actions=${n}`, '--resume'], '/tmp/repo').maxNewActions, n);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 0 }), true);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 1, maxNewActions: 1 }), true);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 1 }), false);
  assert.equal(shouldPauseAtBoundary({ pending: null, completed: 0, maxNewActions: 10, pauseRequested: true }), true);
  assert.equal(shouldPauseAtBoundary({ pending: { intent: 'durable' }, completed: 0, maxNewActions: 0 }), false);
  for (const suffix of [['--seed', 'override'], ['--max-new-actions=-1'], ['--resume', '--resume'], ['--strategy', 'other']])
    assert.throws(() => parseOptions(['--source', SOURCE, '--out=capture', ...suffix]));
});

test('first eight roots three failures and source identity remain exact while S1 evolves until guidance', () => {
  assert.equal(FROZEN_SOURCE_KEYS.length, 9); assert.deepEqual(FROZEN_SOURCE_KEYS.slice(0, 2), ['arbiter', 'sheriff']);
  const original = { runId: 'same', random: { seed: 'same', cursor: 5 }, revision: 40, status: 'ACTIVE', week: 4,
    originalA: { actual: 1 }, world: { actual: 2 }, combatHistory: [],
    character: { name: 'Same person', coreStats: { physique: 499, perception: 500, will: 25, knowledge: 25 } },
    progression: { sequence: 2, mastery: { old: 8 } },
    handOfOrder: { sourceHistory: { original: true }, sourceScene: { original: true }, bottles: [{ id: '1' }, { id: '2' }, { id: '3' }], acquisitionJournal: [{ original: true }], life: { journal: [] } } };
  const keys = ['originalA', 'handOfOrder'], before = { ...structuredClone(original), justiciar: { guidanceKnown: false, source: null } };
  const s1 = structuredClone(before); s1.revision++; s1.progression.sequence = 1; s1.handOfOrder.promotionWeek = 4;
  s1.character.coreStats = { physique: 500, perception: 500, will: 26, knowledge: 26 }; s1.handOfOrder.life.journal.push({ actual: 'S1' });
  assert.doesNotThrow(() => assertOriginals(s1, original, before, keys, { type: 'HAND_OF_ORDER', command: { type: 'CONSUME' } }, null));
  const handoff = structuredClone(s1); handoff.justiciar = { guidanceKnown: true, source: { revision: 41, character: structuredClone(s1.character) } };
  const frozen = freezePredecessors(handoff, keys); assert.doesNotThrow(() => assertOriginalRoots(handoff, original, keys, frozen));
  for (const mutate of [s => s.originalA.actual++, s => s.handOfOrder.life.journal.push({ edited: true }), s => s.handOfOrder.bottles[0].id = 'rewritten', s => s.character.name = 'Replacement', s => s.progression.mastery.old++]) {
    const bad = structuredClone(handoff); mutate(bad); assert.throws(() => assertOriginalRoots(bad, original, keys, frozen));
  }
  assert.throws(() => assertOriginalRoots(handoff, original, keys)); assert.throws(() => assertOriginalRoots(before, original, keys, frozen));
  const s0 = structuredClone(handoff); s0.revision++; s0.progression.sequence = 0; s0.justiciar.promotionWeek = s0.week;
  assert.doesNotThrow(() => assertOriginals(s0, original, handoff, keys, { type: 'JUSTICIAR', command: { type: 'CONSUME' } }, frozen));
  const independent = structuredClone(before); independent.handOfOrder.bottles.push({ id: 'hand-of-order-potion-4' });
  assert.throws(() => assertOriginalRoots(independent, original, keys));
  const same = structuredClone(before); same.handOfOrder.bottles.push({ id: 'hand-of-order-recovery-1', recovery: { originalBottleId: 'hand-of-order-potion-3' } });
  assert.doesNotThrow(() => assertOriginalRoots(same, original, keys));
});

test('whole public audit protects identities and terminal requires both actual adult cargo passages', () => {
  const view = { justiciar: { actions: ['PLAYER', 'JU228-ADA', 'JU228-SIMON'].map(actorId => ({ command: { type: 'CROSS', actorId, segment: 'A' } })) },
    divineHand: { life: { site: { guard: { actorId: null } } } }, glory: { life: { site: { guard: { actorId: null } } } },
    writer: { life: { practice: { record: { reportDigest: null } } } } };
  assert.doesNotThrow(() => assertPublicOnly(view));
  for (const bad of [{ actorId: 'PLAYER' }, { source: { private: true } }, { nextRoll: 7 }, { cursor: 9 }, { unknownDigest: 'hidden' },
    { justiciar: { actions: [{ command: { actorId: 'JU228-KEEPER' } }] } }, { handOfOrder: { life: { pending: { actorId: 'PLAYER' } } } }])
    assert.throws(() => assertPublicOnly(bad));
  const privateState = { random: { seed: 'private-seed' }, justiciar: { source: { actorId: 'private-player', historyDigest: 'private-digest' } } };
  assert.doesNotThrow(() => auditPublic(view, privateState));
  for (const secret of ['private-seed', 'private-player', 'private-digest']) assert.throws(() => auditPublic({ lines: [secret] }, privateState));
  const passage = { a: 'real-a', b: 'real-b', exit: 'real-exit' };
  const state = { status: 'ACTIVE', progression: { sequence: 0 }, week: 210, health: 90, mind: 90, spirituality: 90,
    handOfOrder: { promotionWeek: 190, life: { reflected: true } },
    justiciar: { guidanceKnown: true, promotionWeek: 210, frame: { location: 'JU228-DOCK' },
      scene: { phase: 'PRACTICE', status: 'COMPLETED', originalDepartureEventId: 'depart', evacuationReportEventId: 'evacuation', returnReportEventId: 'report',
        playerPosition: 'OUTSIDE', owner: { position: 'OUTSIDE' },
        workers: ['JU228-ADA', 'JU228-SIMON'].map(id => ({ id, position: 'OUTSIDE', passage: { ...passage } })),
        cargo: ['JU228-ADA', 'JU228-SIMON'].map(carrierId => ({ carrierId, position: 'OUTSIDE', passage: { ...passage } })),
        device: { loadMethod: 'ORDINARY', cargoMethod: 'ORDINARY' },
        segments: { A: { open: false }, B: { open: false } }, exit: { door: 'CLOSED' }, window: null, contact: false,
        constraintApplied: false, priorityApplied: false } } };
  assert.equal(terminal(state).stage, 'NATURAL_S0_RETURN_REPORTED'); assert.equal(outcome(state).cargoDelivered, true);
  const inheritedDeparture = structuredClone(state); inheritedDeparture.justiciar.scene.originalDepartureEventId = null;
  inheritedDeparture.handOfOrder.life.journal = [{ revision: 750, command: { type: 'EXIT_ORIGINAL' }, clockBefore: 10, clockAfter: 14 }];
  inheritedDeparture.handOfOrder.life.movements = [{ actor: 'PLAYER', from: 'START', to: 'OUTSIDE', metres: 4, seconds: 4 }];
  assert.equal(terminal(inheritedDeparture).stage, 'NATURAL_S0_RETURN_REPORTED');
  assert.equal(outcome(inheritedDeparture).originalDepartureSource, 'PRESERVED_HAND_OF_ORDER_LIFE');
  inheritedDeparture.handOfOrder.life.movements[0].metres = 0; assert.equal(terminal(inheritedDeparture), null);
  assert.equal(outcome(state).constraintApplied, false); assert.equal(outcome(state).priorityApplied, false);
  for (const mutate of [s => s.justiciar.scene.workers[0].position = 'GATE', s => s.justiciar.scene.cargo[0].passage.a = null,
    s => s.justiciar.scene.returnReportEventId = null, s => s.justiciar.scene.originalDepartureEventId = null,
    s => s.justiciar.scene.playerPosition = 'ENTRY', s => s.justiciar.scene.window = { kind: 'GATE_CONSTRAINT' },
    s => s.justiciar.scene.contact = true, s => s.justiciar.scene.segments.B.open = true,
    s => s.justiciar.scene.exit.door = 'OPEN', s => s.justiciar.frame.location = 'JU228-WORKSHOP', s => s.progression.sequence = 1]) {
    const changed = structuredClone(state); mutate(changed); assert.equal(terminal(changed), null);
  }
  assert.equal(terminal({ ...state, status: 'DEAD' }).stage, 'NATURAL_DEATH');
});
