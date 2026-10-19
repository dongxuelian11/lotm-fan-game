import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, INPUTS, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY,
  startingPolicy, chooseAction, advancePolicy, publicPrice, loopDiagnostic, selectedBoundary, selectionOutcome,
  parseOptions, stateHash, encodeCheckpoint, decodeCheckpoint, recoverAtomicNext, verifyCheckpoint, readSource, readCapture,
  assertPublicOnly, assertGlobalPublic, capturePublic, publicActionStillAvailable, checkOriginals, inspectFreeze, migrate,
  verifyActionCapture, retainActionCapture, main } from './white-tower-stage.mjs';

// Static producer contracts only. Authoring this file executes no game, build,
// migration, replay, SQLite seam, RNG draw or natural capture. Parent owns runs.
const clone = value => structuredClone(value);
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, options = {}) => ({ id: `public-${command.type}-${JSON.stringify(command)}`, label: '公开行动',
  cost: '1行动、0便士', enabled: true, reason: null, command, ...options });
const preferred = (command, options = {}) => offer(command, { preferredAction: true, ...options });
const nested = (domain, type, data = {}, options = {}) => offer({ type: domain, command: { type, ...data } }, options);
const panel = (actions = [], options = {}) => ({ guidanceKnown: true, promoted: false, insideCase: false,
  resources: { health: 100, mind: 100, spirituality: 120, cash: '1500便士', actionsRemaining: 3 }, sections: [], actions, ...options });
const view = (actions = [], options = {}, panelOptions = {}) => ({ runId: 'contract-original', revision: 667,
  status: 'ACTIVE', week: 146, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 },
  actionsRemaining: 3, weeklyBudget: 3, cash: 1500, weeklyWage: 180, wagePaid: false,
  health: 100, mind: 100, spirituality: 120, maxHealth: 100, maxMind: 100, maxSpirituality: 120,
  pollution: 0, injuries: [], injuryRisk: 0, debtTotal: 0, debts: [], canAct: true, actionBlockedReason: null,
  activeEvent: null, combat: null, progression: { sequence: 1, acting: 100, mastery: {} }, whiteTower: panel(actions, panelOptions), ...options });
const command = decision => decision.action?.intent.command;
const work = offer({ type: 'WORK' }, { cost: '1行动，180便士，每周一次' });
const rest = offer({ type: 'REST' });
const week = offer({ type: 'NEXT_WEEK' }, { cost: '结算生活费与约定还款；没有工资或恢复' });
const clinic = offer({ type: 'CLINIC' }, { cost: '1行动、60便士，之后仍须实际休养' });
const compoundId = 'white-tower-compound-1';
const prepare = preferred({ type: 'STABILIZE_PROMOTION', compoundId }, { cost: '1行动、100便士、12灵性、8精神' });
const dose = preferred({ type: 'CONSUME', compoundId, confirmed: true }, { cost: '1行动、30灵性；有效准备后70%成功；可能重伤、污染或死亡' });
const binding = { id: 'promotion-stability', lines: ['本瓶付费准备后的实际成功率70%；同一现场七天准备仍有效。'] };
const freezeDeep = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); } return value; };

test('pins the complete original666 natural.final, untreated body, full prefix and exact source bytes', () => {
  assert.equal(SOURCE, 'tests/fixtures/all-knowing-eye-v01920/natural.json');
  assert.equal(SOURCE_SHA256, 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f');
  assert.equal(SOURCE_STATE_SHA256, '08106a9cd35089fd9df5addb9d9425aa5abe93618bfaaa359c6731a734e09c11');
  assert.equal(PREFIX_SHA256, '8ef19a15574807a0dacdf1e7a1c20ce0185fbc90c7002327825fd6553a5abd20');
  assert.deepEqual(INPUTS, [{ file: SOURCE, sha256: SOURCE_SHA256 }]);
  const old = readSource(), archive = JSON.parse(old.buffers[0]);
  assert.deepEqual(old.source, archive.final); assert.deepEqual(old.commands, archive.commands);
  assert.equal(PREFIX_COUNT, 666); assert.equal(old.commands.length, 666); assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.equal(compactHash(old.source), SOURCE_STATE_SHA256); assert.equal(old.source.revision, 667);
  assert.deepEqual(old.source.random, { seed: 'reader-natural-v023', cursor: 227 });
  assert.deepEqual([old.source.week,old.source.health,old.source.mind,old.source.spirituality,old.source.cash,old.source.actionsRemaining], [146,70,86,120,1390,3]);
  assert.equal(old.source.injuries.length, 1); assert.equal(old.source.injuries[0].severity, 'HEAVY'); assert.equal(old.source.injuries[0].treatedRevision, null);
  assert.equal(old.source.character.weeklyWage, 180); assert.equal(old.source.character.coreStats.will, 28); assert.equal(old.source.lifeTier, 'DESTITUTE');
  assert.equal(old.inputFreeze.sourceRoot, 'final'); assert.equal(old.inputFreeze.archivedCommandCount, 666);
  assert.equal(POLICY.minimumS1Weeks, 12); assert.equal(POLICY.noReroll, true); assert.equal(POLICY.carrierLimit, 3);
  assert.doesNotMatch(readSource.toString(), /slice\(0|beforeLast|snapshot-practiced|694/);
});

test('migration adds only current roots/schema metadata and rejects any repaired historical source', () => {
  const original = { schemaVersion: 189, contentVersion: 'all-knowing-eye-v189', random: { seed: 'test-source', cursor: 227 }, health: 70, allKnowingEye: { unchanged: true } };
  let validations = 0;
  const runtime = { migrateSliceState: input => ({ ...clone(input), schemaVersion: 211, contentVersion: 'white-tower-v211', whiteTower: {} }),
    assertValidSliceState: () => validations++ };
  const state = migrate(runtime, original); assert.equal(state.schemaVersion, 211); assert.equal(validations, 1); assert.equal(original.health, 70);
  runtime.migrateSliceState = input => ({ ...clone(input), schemaVersion: 211, contentVersion: 'white-tower-v211', health: 100 });
  assert.throws(() => migrate(runtime, original), /Migration changed original health/);
});

test('every inherited original chapter, person, object, old outcome and old mastery stays frozen', () => {
  const original = { runId: 'original-reader', random: { seed: 'original-seed', cursor: 227 },
    character: { weeklyWage: 180, coreStats: { will: 28 } }, progression: { mastery: { 'reader.s1.bounded-insight': 0 } },
    reader: { sameOriginal: true }, allKnowingEye: { bottles: [{ id: 'all-knowing-eye-potion-1', outcome: 'SUCCESS' }] },
    wisdomAngel: { papers: [{ location: 'TABLE' }] }, world: { samePeople: true }, combatHistory: [{ outcome: 'SURRENDER' }], combat: null, activeEvent: null };
  const before = { ...clone(original), whiteTower: { guidanceKnown: true, source: { identity: 'exact-original' } } };
  const state = clone(before); state.random.cursor++; state.progression.mastery['reader.s0.structural-insight'] = 0;
  assert.doesNotThrow(() => checkOriginals(state, original, before));
  for (const mutate of [s => s.reader.sameOriginal = false,s => s.allKnowingEye.bottles[0].outcome = 'FAILURE',
    s => s.wisdomAngel.papers[0].location = 'NEW_SITE',s => s.world.samePeople = false,s => s.combatHistory[0].outcome = 'DEATH',
    s => s.character.weeklyWage = 999,s => s.progression.mastery['reader.s1.bounded-insight'] = 8,s => s.random.seed = 'different',
    s => s.whiteTower.source.identity = 'replacement']) {
    const candidate = clone(state); mutate(candidate); assert.throws(() => checkOriginals(candidate, original, before));
  }
});

test('guidance uses the exact enabled public button and never replays an old encounter', () => {
  const p = view([preferred({ type: 'LEARN_GUIDANCE' })], {}, { guidanceKnown: false });
  const decision = chooseAction(p, startingPolicy()); assert.deepEqual(command(decision), { type: 'LEARN_GUIDANCE' });
  assert(publicActionStillAvailable(p, decision.action)); p.whiteTower.actions[0].enabled = false;
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(view([], { combat: { id: 'old-real-encounter' } }), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('public normal recommendations retain real clinic and both 70→78→86 DESTITUTE rests', () => {
  const p = view([{ ...clinic, preferredAction: true },rest,work,week]);
  p.whiteTower.resources.health = 70; p.injuries = [{ severity: 'HEAVY', treatedRevision: null }];
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'CLINIC'); assert.deepEqual(publicPrice(clinic), { actions: 1, cash: 60 });
  p.injuries[0].treatedRevision = 669; p.whiteTower.actions = [{ ...rest, preferredAction: true },work,week];
  for (const health of [70,78]) { p.whiteTower.resources.health = health; assert.equal(command(chooseAction(p, startingPolicy())).type, 'REST'); }
  p.whiteTower.resources.health = 86; p.injuries = []; p.whiteTower.actions = [preferred({ type: 'TRAVEL', to: 'WT0-MARKET' }),rest];
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'TRAVEL');
  p.whiteTower.actions = [{ ...week, preferredAction: true }]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
});

test('policy is a deterministic function of immutable positive public data and its saved decisions', () => {
  const p = freezeDeep(view([preferred({ type: 'PASSAGE', command: { type: 'BUILD', passageId: 'market-steps' } })]));
  const prior = freezeDeep(startingPolicy()), first = chooseAction(p, prior), second = chooseAction(p, prior);
  assert.deepEqual(first, second); assert.equal(prior.phase, 'WHITE_TOWER_ENTRY');
  assert.throws(() => chooseAction({ ...clone(p), random: { seed: 'hidden', cursor: 227 } }, prior), /Private/);
  const changed = clone(p); changed.whiteTower.actions[0].label = '不同按钮'; assert.equal(publicActionStillAvailable(changed, first.action), false);
});

test('chapter whitelist and whole-dashboard scan preserve lawful labels while rejecting all inherited private data', () => {
  const p = view(); p.random = { seed: 'private', cursor: 227 }; p.allKnowingEye = { source: { private: true } };
  const captured = capturePublic(p); assert.equal(Object.hasOwn(captured, 'random'), false); assert.equal(Object.hasOwn(captured, 'allKnowingEye'), false);
  assert.doesNotThrow(() => assertPublicOnly({ prices: { preparation: 100 }, check: { modifiers: [{ source: '本瓶实际准备', value: 40 }] }, debts: [{ source: '生活应付款' }] }));
  const state = { random: { seed: 'actual-hidden-seed' }, whiteTower: { source: { actorId: 'actual-private-actor', historyDigest: 'actual-private-history' } },
    inherited: { originalWorldDigest: 'inherited-private-digest', nested: { actorId: 'inherited-private-actor' } } };
  const valid = { prices: { preparation: 100 }, check: { modifiers: [{ source: '合法公开准备', value: 40 }] },
    divineHand: { life: { site: { guard: { actorId: null } } } }, glory: { life: { site: { guard: { actorId: null } } } } };
  const saved = clone(valid); assert.doesNotThrow(() => assertGlobalPublic(valid, state)); assert.deepEqual(valid, saved);
  for (const invalid of [{ other: { randomCursor: 227 } },{ other: { source: {} } },{ guard: { actorId: null } },
    { divineHand: { life: { site: { guard: { actorId: 'visible-private' } } } } },{ label: 'actual-hidden-seed' },{ label: 'actual-private-actor' },
    { label: 'actual-private-history' },{ label: 'inherited-private-digest' },{ label: 'inherited-private-actor' },{ originalWorldDigest: 'hidden' },{ futureRoll: 3 }])
    assert.throws(() => assertGlobalPublic(invalid, state), /Private|private/);
  for (const invalid of [{ source: {} },{ frame: {} },{ seed: 'hidden' },{ cursor: 227 },{ rngState: {} },{ futureRoll: 3 },{ check: { modifiers: [{ source: {} }] } }])
    assert.throws(() => assertPublicOnly(invalid), /Private/);
});

test('three passage routes follow actual inspect, permission, purchase, repair, walking and later review buttons', () => {
  for (const passageId of ['market-steps','canal-gallery','apartment-alley'])
    for (const type of ['SURVEY','ASK_PERMISSION','BUY_MATERIALS','BUILD','BUY_REPAIR','REPAIR','ACCEPT_WORK','RETURN_ON_FOOT','PASS_RESIDENT','REVIEW_NEXT_WEEK']) {
      const action = nested('PASSAGE', type, { passageId }, { preferredAction: true });
      assert.deepEqual(command(chooseAction(view([action,work,week]), startingPolicy())), action.command);
    }
  const failed = nested('PASSAGE','BUILD',{ passageId: 'market-steps' },{ enabled: false, reason: '每处施工仅一次，失败后走普通维修。' });
  const repair = nested('PASSAGE','BUY_REPAIR',{ passageId: 'market-steps' },{ preferredAction: true, cost: '0行动、18便士' });
  assert.equal(command(chooseAction(view([failed,repair]), startingPolicy())).command.type, 'BUY_REPAIR');
});

test('ordinary unload and walked return remain available without creating a permanent observation end', () => {
  const blocked = nested('PASSAGE','REPAIR',{ passageId: 'market-steps' },{ preferredAction: true, enabled: false, reason: '实际行动不足。' });
  const unload = nested('PASSAGE','UNLOAD',{ passageId: 'market-steps' },{ cost: '0行动、0便士' });
  const p = view([blocked,unload], {}, { insideCase: true }); const first = chooseAction(p, startingPolicy());
  assert.equal(command(first).command.type, 'UNLOAD'); assert.equal(Object.hasOwn(first.policy, 'ordinaryExitReason'), false);
  p.whiteTower.actions = [blocked,nested('PASSAGE','RETURN_ON_FOOT',{ passageId: 'market-steps' },{ cost: '0行动、0便士' })];
  assert.equal(command(chooseAction(p, first.policy)).command.type, 'RETURN_ON_FOOT');
  p.whiteTower.insideCase = false; p.whiteTower.actions = [{ ...week, preferredAction: true }];
  assert.equal(command(chooseAction(p, first.policy)).type, 'NEXT_WEEK');
});

test('material labour, real wages and living costs pay for the same original suppliers without free resources', () => {
  const buy = nested('MATERIAL','ACQUIRE_CHARACTERISTIC',{ bottleId: 'all-knowing-eye-potion-2' },{ preferredAction: true, enabled: false, cost: '1行动、1100便士', reason: '需要1100便士。' });
  const p = view([buy,work,week]); p.whiteTower.resources.cash = '200便士';
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'WORK');
  p.whiteTower.actions = [buy,week]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  for (const taskId of ['SEAL_REGISTER','CRATE_AUDIT','SUPPLY_LIST','TRANSIT_RECEIPT','DELIVERY_REVIEW']) {
    const action = nested('MATERIAL','MATERIAL_LABOUR',{ bottleId: 'all-knowing-eye-potion-2', taskId },{ preferredAction: true });
    assert.deepEqual(command(chooseAction(view([action,work]), startingPolicy())), action.command);
  }
  const denied = nested('MATERIAL','RECOVER_LEGACY_REMAINS',{ bottleId: 'all-knowing-eye-potion-2' },{ preferredAction: true, enabled: false, reason: '原场保管人明确拒绝。' });
  assert.equal(chooseAction(view([denied,work,week]), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('real1352 custody,12 actual S1 weeks and later-week remains use ordinary time without jumping a date', () => {
  for (const reason of ['真实日期尚未到达原件保管交接。','成为全知之眼尚未满12个实际周，仍可施工、工作与休养。','隔周回原处付费交接同一原残余。']) {
    const action = nested('MATERIAL','VERIFY_UNIQUENESS',{ step: 'CHAIN' },{ preferredAction: true, enabled: false, reason });
    assert.equal(command(chooseAction(view([action,week]), startingPolicy())).type, 'NEXT_WEEK');
  }
  const vacancy = nested('MATERIAL','VERIFY_UNIQUENESS',{ step: 'VACANCY' },{ preferredAction: true, cost: '1行动、60便士' });
  const delivery = nested('MATERIAL','ACQUIRE_UNIQUENESS',{}, { enabled: false, cost: '1行动、120便士' });
  const p = view([vacancy,delivery,week]); p.whiteTower.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.whiteTower.resources.actionsRemaining = 2; p.whiteTower.resources.cash = '209便士';
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.whiteTower.resources.cash = '210便士'; assert.equal(command(chooseAction(p, startingPolicy())).command.step, 'VACANCY');
  p.whiteTower.actions = [{ ...delivery, enabled: true, preferredAction: true },work,rest];
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'ACQUIRE_UNIQUENESS');
});

test('same paid70% compound is consumed immediately with no future roll and no unprepared fallback', () => {
  const p = view([dose,{ ...prepare, enabled: false },work,rest], {}, { sections: [binding] }); p.whiteTower.resources.mind = 92;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'CONSUME');
  p.whiteTower.sections = []; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.whiteTower.sections = [binding]; p.whiteTower.actions[1].command = { type: 'STABILIZE_PROMOTION', compoundId: 'different' };
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.whiteTower.actions = [dose,prepare]; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.whiteTower.actions = [{ ...dose, preferredAction: false }]; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('paid preparation reserves two actions and normal recovery without spending the dose early', () => {
  const p = view([prepare,week,rest]); p.whiteTower.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.whiteTower.resources.actionsRemaining = 3; p.whiteTower.resources.mind = 97;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'REST');
  p.whiteTower.resources.mind = 100; assert.equal(command(chooseAction(p, startingPolicy())).type, 'STABILIZE_PROMOTION');
  assert.deepEqual(publicPrice(prepare), { actions: 1, cash: 100 });
});

test('living failure is sealed before treatment, later paid recovery stays real and death ends immediately', () => {
  const seal = nested('MATERIAL','SEAL_REMAINS',{ compoundId },{ cost: '0行动、0便士' });
  const p = view([seal,clinic,rest,work]); p.whiteTower.resources.health = 55;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'SEAL_REMAINS');
  p.whiteTower.actions = [prepare,clinic,rest]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'CLINIC');
  const recover = nested('MATERIAL','RECOVER_SEALED',{ compoundId },{ preferredAction: true, enabled: false, cost: '1行动、120便士', reason: '须隔周回原处付费回收。' });
  p.whiteTower.actions = [recover,week]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.status = 'DEAD'; assert.equal(chooseAction(p, startingPolicy()).stop, 'NATURAL_ACTUAL_TERMINAL');
});

test('three finite carriers and actual doses stop only after real same-original recovery', () => {
  let policy = startingPolicy();
  for (let n = 1; n <= 3; n++) {
    const p = view([nested('MATERIAL','BUY_COMPOUND',{ batchId: `white-tower-carrier-${n}` },{ preferredAction: true })]);
    policy = advancePolicy(chooseAction(p, policy), p, p);
    const ready = view([dose,{ ...prepare, enabled: false }], {}, { sections: [binding] });
    policy = advancePolicy(chooseAction(ready, policy), ready, ready);
  }
  assert.equal(policy.doses, 3); assert.equal(policy.carriers.length, 3);
  const p = view([], {}, { sections: [{ id: 'materials', lines: ['三件普通载体尚有0件未使用；已用普通药液不补回。'] }] });
  assert.equal(chooseAction(p, policy).stop, 'NATURAL_CARRIERS_UNAVAILABLE');
  p.whiteTower.actions = [nested('MATERIAL','RECOVER_SEALED',{ compoundId },{ preferredAction: true })];
  assert.equal(command(chooseAction(p, policy)).command.type, 'RECOVER_SEALED');
});

test('epilogue retains both finite attempts but permits actual re-observation and renewed permission', () => {
  const p = view([preferred({ type: 'START_EPILOGUE' }),week], {}, { promoted: true });
  p.whiteTower.resources.spirituality = 150; p.whiteTower.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.whiteTower.resources.actionsRemaining = 2; assert.equal(command(chooseAction(p, startingPolicy())).type, 'START_EPILOGUE');
  let policy = startingPolicy();
  for (const type of ['OBSERVE','ASK_PERMISSION','STRUCTURAL_INSIGHT','VERIFY_STRUCTURE','CLEAR_SCREEN','OBSERVE','VERIFY_STRUCTURE','ASK_PERMISSION','BOUNDED_WEAK_POINT']) {
    p.whiteTower.actions = [nested('EPILOGUE',type,{}, { preferredAction: true })];
    const decision = chooseAction(p, policy); assert.equal(command(decision).command.type, type); policy = advancePolicy(decision, p, p);
  }
  assert.deepEqual(policy.epilogueAttempted, ['STRUCTURAL_INSIGHT','BOUNDED_WEAK_POINT']);
  p.whiteTower.actions = [nested('EPILOGUE','BOUNDED_WEAK_POINT',{}, { preferredAction: true }),nested('EPILOGUE','ORDINARY_SIDE_EXIT')];
  assert.equal(command(chooseAction(p, policy)).command.type, 'ORDINARY_SIDE_EXIT');
  p.whiteTower.actions = [nested('EPILOGUE','REPORT')]; policy = advancePolicy(chooseAction(p, policy), p, p);
  assert.equal(chooseAction(p, policy).stop, 'NATURAL_FINITE_WHITE_TOWER_REPORTED');
});

test('meaningful public progress and costs prevent false no-progress diagnoses', () => {
  const p = view(), policy = startingPolicy(); policy.loop = loopDiagnostic(p, p, policy);
  assert.equal(policy.loop.repetitions, 1); policy.loop = loopDiagnostic(p, p, policy); assert.equal(policy.loop.repetitions, 2);
  assert.equal(loopDiagnostic(p, view([], { cash: 1680 }), policy).repetitions, 0);
  const progressed = view([], {}, { sections: [{ id: 'white-tower-passages', lines: ['第147周已实走复核'] }] });
  assert.equal(loopDiagnostic(p, progressed, policy).repetitions, 0);
});

test('selected SQLite evidence derives actual passages, reviews and first dose outcomes without replacing any action', () => {
  const p = view([], {}, { sections: [{ id: 'white-tower-passages', lines: ['市场：第147周已实走复核','运河：第147周已实际通过，待下一真实周回访','公寓：待亲到实勘'] }] });
  const outcome = selectionOutcome(p); assert.deepEqual(outcome, { status: 'ACTIVE', promoted: false, passages: 2, reviews: 1 });
  const intent = { type: 'WHITE_TOWER', command: { type: 'PASSAGE', command: { type: 'REVIEW_NEXT_WEEK', passageId: 'market-steps' } } };
  const kind = selectedBoundary(intent, p, []); assert.equal(kind, 'passage-market-steps-review_next_week');
  assert.equal(selectedBoundary(intent, outcome, []), kind); assert.equal(selectedBoundary(intent, outcome, [{ kind }]), null);
  assert.equal(selectedBoundary(intent, outcome, Array.from({ length: POLICY.selectedBoundaryLimit }, (_,i) => ({ kind: `prior-${i}` }))), null);
  for (const [status,promoted,expected] of [['ACTIVE',false,'white-tower-first-failed-dose'],['ACTIVE',true,'white-tower-actual-promotion'],['DEAD',false,'white-tower-actual-terminal-dose']])
    assert.equal(selectedBoundary({ type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId, confirmed: true } }, { status,promoted,passages: 3,reviews: 3 }, []), expected);
});

test('CLI allows only exact output/resume and resumable observation boundaries, never source/seed/resource overrides', () => {
  assert.equal(parseOptions(['--max-new-actions','0']).maxNewActions, 0); assert.equal(parseOptions(['--stop-after-command','666']).stopAfterCommand, 666);
  assert.equal(parseOptions(['--stop-after-command','700']).stopAfterCommand, 700);
  for (const flag of ['--seed','--source','--roll','--outcome','--strategy','--resume-from','--cash']) assert.throws(() => parseOptions([flag,'value']), /Unsupported/);
  assert.throws(() => parseOptions(['--stop-after-command','665'])); assert.throws(() => parseOptions(['--max-new-actions','-1']));
  assert.throws(() => parseOptions(['--max-new-actions','2','--max-new-actions','3']), /Duplicate/);
  assert.throws(() => parseOptions(['--out','/tmp/a','--resume','/tmp/b/checkpoint.json.gz']), /exact output/);
});

function initialCheckpoint() {
  const policy = startingPolicy(), state = { week: 146, revision: 667, random: { seed: 'reader-natural-v023', cursor: 227 } }, hash = stateHash(state);
  const before = view([preferred({ type: 'LEARN_GUIDANCE' })], {}, { guidanceKnown: false }), publicHash = stateHash(before), decision = chooseAction(before, policy);
  const payload = { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    runtimeFreezeSha256: 'frozen-runtime', inputFreezeSha256: 'frozen-inputs', policyDefinition: POLICY, policy,
    migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: hash, fromSchema: 189, toSchema: 211 },
    commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state, initialStateSha256: hash, finalStateSha256: hash,
    initialPublicSha256: publicHash, publicStateSha256: publicHash, initialGlobalPublicSha256: publicHash, globalPublicStateSha256: publicHash,
    initialRandomSha256: stateHash(state.random), pending: null, terminal: null };
  payload.pending = { commandCount: PREFIX_COUNT + 1, intent: clone(decision.action.intent), decision, beforeStateSha256: hash,
    publicBeforeSha256: publicHash, globalPublicBeforeSha256: publicHash, randomBeforeSha256: stateHash(state.random), policyBeforeSha256: stateHash(policy) };
  return { payload, before, freeze: { sha256: payload.runtimeFreezeSha256 }, inputFreeze: { sha256: payload.inputFreezeSha256 }, initialHash: hash };
}
function completedCheckpoint() {
  const fixture = initialCheckpoint(), { payload,before,initialHash } = fixture, pending = payload.pending, beforeState = payload.state;
  const after = view([], { revision: 668 }), policy = advancePolicy(pending.decision, after, before), state = { ...beforeState, revision: 668 };
  const row = { commandCount: 667, revision: 668, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
    beforeStateSha256: initialHash, afterStateSha256: stateHash(state), publicBeforeSha256: payload.initialPublicSha256, publicAfterSha256: stateHash(after),
    globalPublicBeforeSha256: payload.initialGlobalPublicSha256, globalPublicAfterSha256: stateHash(after),
    randomBefore: clone(state.random), randomAfter: clone(state.random), randomBeforeSha256: stateHash(state.random), randomAfterSha256: stateHash(state.random),
    policyBeforeSha256: stateHash(payload.policy), policyAfterSha256: stateHash(policy), selectionOutcome: selectionOutcome(after), elapsedMilliseconds: 7 };
  const content = { commandCount: row.commandCount, beforeLast: clone(beforeState), lastIntent: clone(pending.intent), final: clone(state),
    randomBefore: clone(row.randomBefore), randomAfter: clone(row.randomAfter), publicBefore: clone(before), public: clone(after),
    globalPublicBefore: clone(before), globalPublic: clone(after), audit: { ...clone(row), elapsedMilliseconds: null } };
  row.capture = { file: 'action-667.json.gz', bytes: 100, sha256: 'a'.repeat(64) };
  Object.assign(payload, { commandCount: 667, commands: [pending.intent], rows: [row], state, policy, finalStateSha256: stateHash(state),
    publicStateSha256: stateHash(after), globalPublicStateSha256: stateHash(after), pending: null,
    boundaries: [{ ...row.capture, kind: 'white-tower-learn_guidance', commandCount: 667 }] });
  return { ...fixture, content, row };
}

test('gzip checkpoints bind source/schema/freeze and exact pending private/public/RNG/policy boundary', () => {
  const { payload,freeze,inputFreeze,initialHash } = initialCheckpoint(); verifyCheckpoint(payload, freeze, initialHash, inputFreeze);
  assert.deepEqual(decodeCheckpoint(gzipSync(encodeCheckpoint(payload))).payload, payload);
  for (const mutate of [p => p.pending.commandCount++,p => p.pending.intent.command.type = 'WORK',p => p.pending.beforeStateSha256 = 'changed',
    p => p.pending.publicBeforeSha256 = 'changed',p => p.pending.globalPublicBeforeSha256 = 'changed',p => p.pending.randomBeforeSha256 = 'changed',
    p => p.pending.policyBeforeSha256 = 'changed',p => p.state.random.cursor++,p => p.runtimeFreezeSha256 = 'changed',p => p.inputFreezeSha256 = 'changed',
    p => p.sourceSha256 = 'changed',p => p.prefixSha256 = 'changed',p => p.migration.originalStateSha256 = 'changed',p => p.migration.toSchema = 210,
    p => { delete p.initialGlobalPublicSha256; },p => { delete p.pending.globalPublicBeforeSha256; }]) {
    const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash, inputFreeze));
  }
});

test('completed rows chain all hashes, exact command, real outcome and full-action evidence identity', () => {
  const { payload,freeze,inputFreeze,initialHash } = completedCheckpoint(); verifyCheckpoint(payload, freeze, initialHash, inputFreeze);
  for (const mutate of [p => p.rows[0].commandSha256 = 'wrong',p => p.rows[0].publicBeforeSha256 = 'wrong',p => p.rows[0].randomBefore.cursor++,
    p => p.rows[0].policyAfterSha256 = 'wrong',p => { delete p.rows[0].globalPublicBeforeSha256; },p => p.rows[0].globalPublicAfterSha256 = 'wrong',
    p => p.rows[0].selectionOutcome.privateSource = {},p => p.rows[0].selectionOutcome.reviews = 4,p => p.rows[0].capture.file = '../escape.json.gz',
    p => p.rows[0].capture.bytes = 0,p => p.boundaries.push(clone(p.boundaries[0])),p => p.boundaries[0].sha256 = 'b'.repeat(64),
    p => p.boundaries[0].kind = 'not-the-actual-transition',p => p.commands[0].command.type = 'NEXT_WEEK']) {
    const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash, inputFreeze));
  }
});

test('every compressed action retains and verifies full private, RNG, chapter and global boundaries', () => {
  const { content,row } = completedCheckpoint(); verifyActionCapture(content, row);
  for (const mutate of [c => c.beforeLast.revision++,c => c.final.revision++,c => c.randomAfter.cursor++,c => c.publicBefore.cash++,
    c => c.public.cash++,c => c.globalPublicBefore.cash++,c => c.globalPublic.cash++,c => c.audit.intent.command.type = 'WORK']) {
    const candidate = clone(content); mutate(candidate); assert.throws(() => verifyActionCapture(candidate, row));
  }
  const directory = mkdtempSync(join(tmpdir(), 'white-tower-action-contract-'));
  try {
    const evidence = retainActionCapture(directory, content); assert.equal(evidence.file, 'action-667.json.gz');
    assert.deepEqual(readCapture(join(directory, evidence.file)), content); verifyActionCapture(readCapture(join(directory, evidence.file)), { ...row, capture: evidence });
    assert.deepEqual(retainActionCapture(directory, content), evidence);
    const changed = clone(content); changed.final.revision++; assert.throws(() => retainActionCapture(directory, changed), /Existing actual action/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('atomic successor preserves first actual failure and interrupted evidence instead of redrawing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'white-tower-checkpoint-contract-')), path = join(directory, 'checkpoint.json.gz');
  try {
    const { payload } = initialCheckpoint(), text = encodeCheckpoint({ ...payload, predecessorSha256: null }); writeFileSync(path, gzipSync(text));
    const failed = { format: FORMAT, predecessorSha256: decodeCheckpoint(text).sha256, pending: null,
      actualFailure: { chance: 70, tier: 'FAILURE', sameOriginal: true, costsRetained: true } };
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint(failed))); recoverAtomicNext(path);
    assert.deepEqual(decodeCheckpoint(readFileSync(path)).payload, failed); assert.equal(existsSync(`${path}.next`), false);
    writeFileSync(`${path}.next`, Buffer.from([0x1f,0x8b,0x00])); recoverAtomicNext(path); assert(existsSync(`${path}.incomplete`));
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint({ format: FORMAT, predecessorSha256: 'unknown' })));
    assert.throws(() => recoverAtomicNext(path), /Unknown checkpoint successor/); assert(existsSync(`${path}.next`));
    const forged = JSON.parse(text); forged.payload.state.random.cursor++; assert.throws(() => decodeCheckpoint(JSON.stringify(forged)), /checksum/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a truncated action capture is retained and its exact pending action can finish without changing outcomes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'white-tower-pending-action-')), { content } = completedCheckpoint();
  const path = join(directory, 'action-667.json.gz');
  try {
    writeFileSync(`${path}.next`, Buffer.from([0x1f,0x8b,0x00]));
    retainActionCapture(directory, content); assert(existsSync(`${path}.incomplete`)); assert.deepEqual(readCapture(path), content);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a parseable but unknown action successor is preserved and never promoted as valid evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'white-tower-unknown-action-')), { content } = completedCheckpoint();
  const path = join(directory, 'action-667.json.gz');
  try {
    writeFileSync(`${path}.next`, gzipSync('null'));
    assert.throws(() => retainActionCapture(directory, content), /Unknown actual action successor/);
    assert(existsSync(`${path}.next`)); assert.equal(existsSync(path), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('orchestration freezes before transition, persists pending then full evidence then complete state then commits', () => {
  const source = main.toString(), pending = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...boundary, pending }');
  const select = source.indexOf('assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision');
  const prepareDraft = source.indexOf('draft = session.prepare(pending.intent, before.revision)');
  const evidence = source.indexOf('row.capture = retainActionCapture(options.out, content)');
  const completed = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next');
  const commit = source.indexOf('if (draft) session.commit(draft)');
  assert(pending >= 0 && pending < select && select < prepareDraft && prepareDraft < evidence && evidence < completed && completed < commit);
  assert(source.indexOf('assertGlobalPublic(initialGlobal, initial)') < pending);
  assert.match(source, /!boundary\.pending && \(count >= options\.maxNewActions/); assert.match(source, /boundary\.commandCount >= options\.stopAfterCommand/);
  assert.match(source, /if \(!paused && !diagnostic && !saved\.payload\.terminal\)/);
  assert.match(source, /historicalPrefixReplayedByThisProducer: false/); assert.match(source, /originalPrefixRetainedExactly: true/);
  assert.match(source, /completeOriginalSourceRetainedExactly: true/); assert.match(source, /alternateSourceUsed: false/);
  assert.match(source, /gzipSync\(old\.buffers\[index\]/); assert.match(source, /resumeExactPendingRequired: true/); assert.match(source, /readdirSync\(options\.out\)\.length, 0/);
  assert.match(source, /runtime-freeze\.json/); assert.match(source, /input-freeze\.json/); assert.match(source, /migration-initial\.json\.gz/);
  assert.match(source, /globalPublicBefore: beforeGlobal, globalPublic: globalAfter/); assert.match(source, /assertGlobalPublic\(globalAfter, next\)/);
  assert.match(inspectFreeze.toString(), /dist\/domain\/white-tower\/owned-session\.js/); assert.match(inspectFreeze.toString(), /white-tower-stage\.test\.mjs/);
  assert.match(checkOriginals.toString(), /Frozen actual S1 handoff/);
  assert.doesNotMatch(source, /createSliceRun|nextInt|Math\.random|spyOn|mockImplementation|694|679/);
});
