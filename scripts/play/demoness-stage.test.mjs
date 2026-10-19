import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOriginalRoots, assertOriginals, assertPublicOnly, auditPublic, chooseAction, freezePredecessors,
  outcome, parseOptions, portableSourcePath, PREFIX_COUNT, sealRow, shouldPauseAtBoundary, snapshotReasons, SOURCE, SOURCE_REVISION,
  stable, stateHash, terminal, unwrapSource, verifyCommandChain, verifyRow } from './demoness-stage.mjs';

// Pure helpers only. No dist import, original fixture load, build, game or session.
const action = (type, fields = {}) => ({ id: type, label: type, cost: 'Actual cost', enabled: true,
  preferredAction: true, reason: null, command: { type }, ...fields });
const publicView = (overrides = {}) => ({ status: 'ACTIVE', activeEvent: null, combat: null,
  progression: { pathwayId: 'demoness', sequence: 2 }, week: 174, health: 100, mind: 100,
  spirituality: 120, cash: 330, actionsRemaining: 2, pollution: 0, wagePaid: true,
  canAct: true, actionBlockedReason: null, demoness: { guidanceKnown: false, actions: [] },
  apocalypseDemoness: { insideCase: false, preparedWeek: null, actions: [], life: { reflected: false, preferredActionId: null, actions: [] } },
  ...overrides });
const bottleAction = (type, n, fields = {}) => action(type, { id: `${type}-${n}`, command: { type, bottleId: `apocalypse-demoness-potion-${n}` }, ...fields });
const withApoc = (view, changes) => ({ ...view, apocalypseDemoness: { ...view.apocalypseDemoness, ...changes } });

test('canonical encoding and exact source wrapper never substitute beforeLast or archive final', () => {
  assert.equal(stateHash({ b: 2, a: [1, { z: true }] }), stateHash({ a: [1, { z: true }], b: 2 }));
  assert.notEqual(stateHash({ a: [1, 2] }), stateHash({ a: [2, 1] }));
  assert.equal(stable({ zero: -0 }), '{"zero":0}');
  assert.throws(() => stateHash({ bad: undefined })); assert.throws(() => stateHash(NaN));
  const final = { revision: 689, status: 'ACTIVE', progression: { pathwayId: 'demoness', sequence: 2 } };
  const wrapper = { commandCount: 688, beforeLast: { revision: 688 }, lastIntent: { type: 'ACTION', action: 'WORK' }, final };
  assert.equal(unwrapSource(wrapper), final);
  for (const bad of [final, { ...wrapper, commandCount: 854 }, { ...wrapper, final: wrapper.beforeLast },
    { ...wrapper, final: { ...final, status: 'DEAD' } }, { ...wrapper, final: { ...final, progression: { pathwayId: 'demoness', sequence: 1 } } }])
    assert.throws(() => unwrapSource(bad));
  assert.equal(PREFIX_COUNT + 1, 689); assert.equal(SOURCE_REVISION + 1, 690);
});

test('public resource policy purifies first then pays latest same-original recovery and real labour', () => {
  const clean = publicView();
  assert.deepEqual(chooseAction({ ...clean, pollution: 50, wagePaid: false }).intent, { type: 'ACTION', action: 'REST' });
  const requests = [1, 2, 3].map(n => bottleAction('REQUEST_RECOVERY_V1', n));
  assert.deepEqual(chooseAction(withApoc(clean, { actions: requests })).intent, { type: 'APOCALYPSE_DEMONESS', command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'apocalypse-demoness-potion-3' } });
  const retry = withApoc(clean, { actions: [...requests.slice(0, 2), bottleAction('REQUEST_RECOVERY_V1', 4)] });
  assert.equal(chooseAction(retry).intent.command.bottleId, 'apocalypse-demoness-potion-4');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: false }).intent.action, 'WORK');
  assert.equal(chooseAction({ ...retry, cash: 20, wagePaid: true }).intent.action, 'REST');
  const pending = withApoc(clean, { actions: [bottleAction('RECOVER_CHARACTERISTIC_V1', 3, { enabled: false, reason: 'Wait one real week' })] });
  assert.equal(chooseAction(pending).intent.action, 'REST');
  const labour = withApoc(clean, { actions: [bottleAction('POTION_WORK', 4), bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(labour).intent.command.type, 'POTION_WORK');
  assert.equal(chooseAction({ ...labour, actionsRemaining: 0 }).intent.action, 'REST');
  const buy = withApoc(clean, { actions: [bottleAction('BUY_POTION', 4)] });
  assert.equal(chooseAction(buy).intent.command.type, 'BUY_POTION');
  assert.equal(chooseAction({ ...buy, cash: 100 }).intent.action, 'REST');
  assert.equal(chooseAction(withApoc(clean, { actions: [action('REQUEST_SUPPLY')] })).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('prepared dose gets actual paid same-bottle support before consumption, never an unfunded fallback', () => {
  const consume = bottleAction('CONSUME', 4, { command: { type: 'CONSUME', bottleId: 'apocalypse-demoness-potion-4', confirmed: true } });
  const support = bottleAction('STABILIZE_PROMOTION', 4);
  const prepared = withApoc(publicView({ canAct: false }), { insideCase: true, preparedWeek: 174, actions: [consume, support] });
  const chosen = chooseAction(prepared);
  assert.equal(chosen.intent.command.type, 'STABILIZE_PROMOTION');
  const after = withApoc(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Already supported' }] });
  assert.equal(chooseAction(after, chosen.intent).intent.command.type, 'CONSUME');
  assert.equal(chooseAction(after).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(after, { type: 'APOCALYPSE_DEMONESS', command: { type: 'STABILIZE_PROMOTION', bottleId: 'apocalypse-demoness-potion-3' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(withApoc(prepared, { actions: [consume, { ...support, enabled: false, reason: 'Insufficient actual cash' }] })).stop, 'PUBLIC_ACTION_BLOCKED');
  const unrelatedScene = withApoc(prepared, { preparedWeek: null, actions: [bottleAction('REQUEST_RECOVERY_V1', 4)] });
  assert.equal(chooseAction(unrelatedScene).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...unrelatedScene, pollution: 50 }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('real S1 preferred life and reflection precede guidance; locked scenes cannot be bypassed', () => {
  const lifeAction = action('OBSERVE');
  const life = withApoc(publicView({ progression: { pathwayId: 'demoness', sequence: 1 } }),
    { life: { reflected: false, preferredActionId: lifeAction.id, actions: [lifeAction] } });
  assert.equal(chooseAction(life).intent.type, 'APOCALYPSE_DEMONESS');
  assert.equal(chooseAction(life).intent.command.type, 'OBSERVE');
  const noAp = withApoc({ ...life, actionsRemaining: 0 }, { life: { reflected: false, preferredActionId: null, actions: [] } });
  assert.equal(chooseAction(noAp).intent.action, 'REST');
  assert.equal(chooseAction(withApoc(noAp, { insideCase: true })).stop, 'PUBLIC_ACTION_BLOCKED');
  const reflected = withApoc({ ...life, demoness: { guidanceKnown: false, actions: [action('LEARN_GUIDANCE')] } },
    { life: { reflected: true, preferredActionId: null, actions: [] } });
  assert.equal(chooseAction(reflected).intent.type, 'DEMONESS');
  assert.equal(chooseAction(reflected).intent.command.type, 'LEARN_GUIDANCE');
});

test('owned S0 selects exactly one enabled public preferred action and death stops absolutely', () => {
  const rest = action('REST'), view = publicView({ demoness: { guidanceKnown: true, actions: [rest] } });
  assert.deepEqual(chooseAction(view).intent, { type: 'DEMONESS', command: { type: 'REST' } });
  for (const actions of [[], [{ ...rest, enabled: false }], [rest, { ...rest, id: 'second' }]])
    assert.equal(chooseAction({ ...view, demoness: { ...view.demoness, actions } }).stop, 'PUBLIC_ACTION_BLOCKED');
  for (const status of ['DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING']) assert.equal(chooseAction({ ...view, status }).stop, 'NATURAL_TERMINAL');
  assert.equal(chooseAction({ ...view, activeEvent: { id: 'actual' } }).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction({ ...view, combat: { id: 'actual' } }).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('compact command/private/public/RNG chains bind prelude controls and preserve count versus revision', () => {
  const old = { type: 'OLD' }, intent = { type: 'ACTION', action: 'REST' }, random = { seed: 'pure-example', cursor: 5 };
  const initial = { revision: 40, privateStateSha256: stateHash('before'), publicStateSha256: stateHash('public-before'), random, randomSha256: stateHash(random) };
  const prefix = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: 1, intent: old, commandSha256: stateHash(old), previousRowSha256: null });
  const after = { ...initial, revision: 41, privateStateSha256: stateHash('after'), publicStateSha256: stateHash('public-after') };
  const payload = { kind: 'DEMONESS_CONTINUATION_ACTION', commandCount: 2, newCount: 1, intent,
    commandSha256: stateHash(intent), previousRowSha256: prefix.rowSha256, before: initial, after,
    publicAction: { enabled: true, kind: 'ORDINARY_RESOURCE', action: 'REST' } };
  const row = sealRow(payload), check = rows => verifyCommandChain(rows, { prefixCommands: [old], initial });
  assert.deepEqual(check([prefix, row]), { commandCount: 2, newCount: 1, rowSha256: row.rowSha256, anchor: after });
  for (const changes of [{ commandCount: 3 }, { after: { ...after, revision: 2 } },
    { before: { ...initial, publicStateSha256: stateHash('tampered') } },
    { after: { ...after, random: { ...random, cursor: 4 }, randomSha256: stateHash({ ...random, cursor: 4 }) } },
    { publicAction: { ...payload.publicAction, action: 'WORK' } }]) assert.throws(() => check([prefix, sealRow({ ...payload, ...changes })]));
  assert.throws(() => check([prefix, row, row])); assert.throws(() => verifyRow({ ...row, intent: { type: 'OTHER' } }));
  const consume = { type: 'DEMONESS', command: { type: 'CONSUME', compoundId: 'same', confirmed: true } };
  const s0 = { ...payload, intent: consume, commandSha256: stateHash(consume), publicAction: { enabled: true, preferredAction: true, selectionRule: 'EXACT_PUBLIC_PREFERRED', command: consume.command } };
  assert.doesNotThrow(() => check([prefix, sealRow(s0)]));
  assert.throws(() => check([prefix, sealRow({ ...s0, publicAction: { ...s0.publicAction, preferredAction: false } })]));
});

test('snapshots are sparse but retain both S1 and S0 consumption boundaries', () => {
  assert.deepEqual(snapshotReasons({ newCount: 0 }), ['initial']);
  assert.deepEqual(snapshotReasons({ newCount: 15, afterIntent: { type: 'ACTION', action: 'REST' } }), []);
  for (const type of ['APOCALYPSE_DEMONESS', 'DEMONESS']) {
    const intent = { type, command: { type: 'CONSUME', confirmed: true } };
    assert.deepEqual(snapshotReasons({ newCount: 15, beforeIntent: intent }), ['before-consume']);
    assert.deepEqual(snapshotReasons({ newCount: 16, afterIntent: intent, terminal: true }), ['periodic', 'after-consume', 'terminal']);
  }
});

test('explicit zero/one/N pause options offer no seed, cursor or outcome policy override', () => {
  assert.equal(portableSourcePath('/tmp/repo', `/tmp/repo/${SOURCE}`), SOURCE);
  assert.throws(() => portableSourcePath('/tmp/repo', '/tmp/other/source.json'));
  assert.throws(() => portableSourcePath('/tmp/repo', 'tests/fixtures/apocalypse-demoness-v01990/natural.json'));
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
  const original = { runId: 'same', random: { seed: 'same', cursor: 5 }, revision: 40, status: 'ACTIVE', week: 4,
    originalA: { actual: 1 }, world: { actual: 2 }, combatHistory: [],
    character: { name: 'Same person', coreStats: { physique: 499, perception: 500, will: 25, knowledge: 25 } },
    progression: { sequence: 2, mastery: { old: 8 } },
    apocalypseDemoness: { sourceHistory: { original: true }, sourceScene: { original: true }, bottles: [{ id: '1' }, { id: '2' }, { id: '3' }], acquisitionJournal: [{ original: true }], life: { journal: [] } } };
  const keys = ['originalA', 'apocalypseDemoness'];
  const before = { ...structuredClone(original), demoness: { guidanceKnown: false, source: null } };
  const s1 = structuredClone(before); s1.revision++; s1.progression.sequence = 1; s1.apocalypseDemoness.promotionWeek = 4;
  s1.character.coreStats = { physique: 500, perception: 500, will: 26, knowledge: 26 };
  s1.apocalypseDemoness.life.journal.push({ actual: 'S1' });
  assert.doesNotThrow(() => assertOriginals(s1, original, before, keys, { type: 'APOCALYPSE_DEMONESS', command: { type: 'CONSUME' } }, null));
  const handoff = structuredClone(s1); handoff.demoness = { guidanceKnown: true, source: { revision: 41, character: structuredClone(s1.character) } };
  const frozen = freezePredecessors(handoff, keys);
  assert.doesNotThrow(() => assertOriginalRoots(handoff, original, keys, frozen));
  for (const mutate of [s => s.originalA.actual++, s => s.apocalypseDemoness.life.journal.push({ edited: true }), s => s.apocalypseDemoness.bottles[0].id = 'rewritten', s => s.character.name = 'Replacement', s => s.progression.mastery.old++]) {
    const bad = structuredClone(handoff); mutate(bad); assert.throws(() => assertOriginalRoots(bad, original, keys, frozen));
  }
  assert.throws(() => assertOriginalRoots(handoff, original, keys));
  assert.throws(() => assertOriginalRoots(before, original, keys, frozen));
});

test('public audit allows actual inherited body labels but rejects private sources and future draws', () => {
  const view = { calamityDemoness: { life: { site: { actorMoves: [{ actorId: 'UD3-VERA' }] } } } };
  assert.doesNotThrow(() => assertPublicOnly(view));
  for (const bad of [{ actorId: 'UD3-VERA' }, { source: { private: true } }, { nextRoll: 7 }, { cursor: 9 },
    { calamityDemoness: { life: { site: { actorMoves: [{ actorId: 'private-player' }] } } } }]) assert.throws(() => assertPublicOnly(bad));
  const privateState = { random: { seed: 'private-seed' }, demoness: { source: { actorId: 'private-player', historyDigest: 'private-digest' } } };
  assert.doesNotThrow(() => auditPublic(view, privateState));
  for (const secret of ['private-seed', 'private-player', 'private-digest']) assert.throws(() => auditPublic({ lines: [secret] }, privateState));
});

test('terminal requires actual promotion, return report and every ordinary exit; death always wins', () => {
  const state = { status: 'ACTIVE', progression: { sequence: 0 }, week: 200, health: 90, mind: 90, spirituality: 90,
    apocalypseDemoness: { promotionWeek: 180, life: { reflected: true } },
    demoness: { guidanceKnown: true, promotionWeek: 200, frame: { location: 'DM221-ARCH' },
      passage: { phase: 'CLOSED', returnReportEventId: 'real-report', position: -2, residents: [{ position: -2, returnPassage: { crossing: 'cross-1', exit: 'exit-1' } }, { position: -2, returnPassage: { crossing: 'cross-2', exit: 'exit-2' } }],
        petrificationAppliedEventId: null, reshapingAppliedEventId: 'real-application' } } };
  const view = { demoness: { actions: [] } };
  assert.equal(terminal(state, view).stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(outcome(state).ordinaryExit, true); assert.equal(outcome(state).petrificationApplied, false);
  const inside = structuredClone(state); inside.demoness.passage.residents[0].position = 3;
  assert.equal(terminal(inside, view), null);
  const missingCrossing = structuredClone(state); missingCrossing.demoness.passage.residents[0].returnPassage.crossing = null;
  assert.equal(terminal(missingCrossing, view), null);
  const unreported = structuredClone(state); unreported.demoness.passage.returnReportEventId = null;
  assert.equal(terminal(unreported, view), null);
  const preferred = { demoness: { actions: [action('REPORT_RETURN')] } };
  assert.equal(terminal(state, preferred), null);
  assert.equal(terminal({ ...state, status: 'DEAD' }, preferred).stage, 'NATURAL_DEATH');
});
