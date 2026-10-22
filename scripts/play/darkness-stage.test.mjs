import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SOURCE, SOURCE_SHA256, SNAPSHOT_SHA256, ARCHIVE_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY,
  startingPolicy, chooseAction, advancePolicy, publicPrice, loopDiagnostic, selectedBoundary, selectionOutcome,
  parseOptions, stateHash, encodeCheckpoint, decodeCheckpoint, recoverAtomicNext, verifyCheckpoint, readSource, readCapture,
  assertPublicOnly, assertGlobalPublic, capturePublic, publicActionStillAvailable, checkOriginals, inspectFreeze, main } from './darkness-stage.mjs';

// Producer-only contract tests. No runtime import, game transition, SQLite,
// compilation, random draw, controlled seam, natural run or input rewrite.
// Parent review/freeze owns execution; authoring these tests runs nothing.
const clone = value => structuredClone(value);
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, options = {}) => ({ id: `public-${command.type}-${JSON.stringify(command)}`, label: '公开行动', cost: '1行动、0便士', enabled: true, reason: null, command, ...options });
const nested = (domain, type, data = {}, options = {}) => offer({ type: domain, command: { type, ...data } }, options);
const preferred = (command, options = {}) => offer(command, { preferredAction: true, ...options });
const panel = (actions = [], options = {}) => ({ guidanceKnown: true, promoted: false, insideCase: false, nextStep: '真实长夜撤离',
  resources: { health: 100, mind: 100, spirituality: 120, cash: '1500便士', actionsRemaining: 3 }, sections: [], actions, ...options });
const view = (actions = [], options = {}, panelOptions = {}) => ({ status: 'ACTIVE', week: 158, date: { year: 1352, month: 7, day: 1 },
  health: 100, mind: 100, spirituality: 120, cash: 1500, actionsRemaining: 3, pollution: 0, injuries: [], debtTotal: 0,
  activeEvent: null, combat: null, progression: { sequence: 1, acting: 100, mastery: {} }, darkness: panel(actions, panelOptions), ...options });
const command = decision => decision.action?.intent.command;
const work = offer({ type: 'WORK' }, { cost: '1行动；180便士，每周一次' });
const rest = offer({ type: 'REST' });
const wait = offer({ type: 'NEXT_WEEK' });
const compoundId = 'darkness-compound-1';
const prepare = preferred({ type: 'STABILIZE_PROMOTION', compoundId }, { cost: '1行动、100便士、12灵性、8精神' });
const dose = preferred({ type: 'CONSUME', compoundId, confirmed: true });
const binding = { id: 'promotion-stability', lines: ['本瓶实际付费准备后的成功率70%；准备仍在原室和七天期限内有效。'] };
const freezeDeep = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); } return value; };

test('pins exact living679, original budget/cursor, complete prefix and separate694 death bytes', () => {
  assert.equal(SOURCE, 'tests/fixtures/misfortune-knight-v01910/boundary-three-honest-reports-reflected.json');
  assert.equal(SOURCE_SHA256, '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f');
  assert.equal(SNAPSHOT_SHA256, '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee');
  assert.equal(ARCHIVE_SHA256, '597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8');
  const old = readSource(); assert.equal(PREFIX_COUNT, 679); assert.equal(old.commands.length, 679); assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.deepEqual(old.source, JSON.parse(old.buffers[1])); assert.deepEqual(JSON.parse(old.buffers[0]).final, old.source);
  assert.equal(JSON.parse(old.buffers[2]).commands.length, 694); assert.equal(JSON.parse(old.buffers[2]).final.status, 'DEAD');
  assert.deepEqual(old.source.random, { seed: 'sleepless-natural-v020', cursor: 348 });
  assert.deepEqual([old.source.week,old.source.health,old.source.mind,old.source.spirituality,old.source.cash,old.source.actionsRemaining], [158,100,97,112,400,3]);
  assert.equal(old.source.character.coreStats.will, 31); assert.equal(old.source.character.weeklyWage, 180);
  assert.equal(old.inputFreeze.archivedCommandCount, 694); assert.equal(old.inputFreeze.peacefulStateSha256, SNAPSHOT_SHA256);
  assert.equal(POLICY.noReroll, true); assert.equal(POLICY.carrierLimit, 3); assert.equal(POLICY.selectedBoundaryLimit, 25);
});

test('guidance begins only from the enabled current Darkness button and never rebuilds old Beauty or combat', () => {
  const p = view([preferred({ type: 'LEARN_GUIDANCE' })], {}, { guidanceKnown: false });
  const d = chooseAction(p, startingPolicy()); assert.deepEqual(command(d), { type: 'LEARN_GUIDANCE' }); assert(publicActionStillAvailable(p, d.action));
  p.darkness.actions[0].enabled = false; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(view([], { combat: { id: 'old-independent-fight' } }), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('current-panel capture excludes private state and unrelated historic panels; exact redlines allow public source labels and preparation prices', () => {
  const p = view([preferred({ type: 'LEARN_GUIDANCE' })]); p.random = { seed: 'private', cursor: 348 }; p.misfortuneKnight = { source: { private: true } };
  const result = capturePublic(p); assert.equal(Object.hasOwn(result, 'random'), false); assert.equal(Object.hasOwn(result, 'misfortuneKnight'), false);
  assert.doesNotThrow(() => assertPublicOnly({ prices: { preparation: 100 }, check: { modifiers: [{ source: '本瓶实际准备', value: 40 }] }, debts: [{ source: '生活应付款' }], companions: [{ source: 'SW5-LEAF-1' }], companionAfter: { source: 'SW5-LEAF-1' }, kit: { source: '本人原器具' }, expert: { source: '当面受邀者' } }));
  for (const bad of [{ source: {} }, { darkness: { source: 'private-source' } }, { prices: { preparation: { seed: 'hidden' } } },
    { seed: 'hidden' }, { cursor: 348 }, { randomSeed: 'hidden' }, { randomCursor: 348 }, { frame: {} }, { nextRoll: 1 }, { futureRoll: 1 }, { check: { modifiers: [{ source: { seed: 'hidden' } }] } }])
    assert.throws(() => assertPublicOnly(bad), /Private/);
  p.darkness.source = {}; assert.throws(() => capturePublic(p), /Private source/);
});

test('whole-global audit is distinct, permits only the two inactive null guard identities and rejects inherited private fields', () => {
  const state = { random: { seed: 'test-hidden-seed' }, darkness: { source: { actorId: 'test-private-actor', historyDigest: 'test-private-history' } } };
  const valid = { prices: { preparation: 100 }, check: { modifiers: [{ source: '合法公开准备', value: 40 }] },
    companions: [{ source: 'SW5-LEAF-1' }], divineHand: { life: { site: { guard: { actorId: null } } } }, glory: { life: { site: { guard: { actorId: null } } } } };
  const original = clone(valid), hash = stateHash(valid); assert.doesNotThrow(() => assertGlobalPublic(valid, state)); assert.deepEqual(valid, original);
  const lostPrice = clone(valid); delete lostPrice.prices.preparation; assert.notEqual(stateHash(lostPrice), hash);
  const lostLabel = clone(valid); delete lostLabel.check.modifiers[0].source; assert.notEqual(stateHash(lostLabel), hash);
  for (const invalid of [{ anotherPanel: { randomCursor: 348 } }, { anotherPanel: { source: {} } }, { guard: { actorId: null } },
    { divineHand: { life: { site: { guard: { actorId: 'actor' } } } } }, { label: 'test-hidden-seed' }, { label: 'test-private-actor' },
    { label: 'test-private-history' }, { futureRoll: 1 }]) assert.throws(() => assertGlobalPublic(invalid, state), /[Pp]rivate/);
});

test('selection is deterministic and immutable and never reads private state or a future draw', () => {
  const p = view([preferred({ type: 'EVACUATION', command: { type: 'SHIELD_FALSE_LIGHT' } })], {}, { insideCase: true });
  for (const key of ['state','random','seed','cursor','journal','futureRoll','privateSource']) Object.defineProperty(p, key, { get() { throw Error(`Private ${key}`); } });
  const policy = freezeDeep(startingPolicy()); freezeDeep(p);
  const first = chooseAction(p, policy); assert.deepEqual(first, chooseAction(p, policy)); assert.notEqual(first.policy, policy);
  assert.equal(command(first).command.type, 'SHIELD_FALSE_LIGHT');
});

test('genuine survey, adjacent walking, consent, hazards, individual escort and return use exact enabled public commands', () => {
  for (const c of [{ type: 'SURVEY_DAY' }, { type: 'REGISTER_RESIDENT', residentId: 'DN-ADA' }, { type: 'WALK', to: 25, pace: 'CAREFUL' },
    { type: 'OBSERVE', hazard: 'NOISE' }, { type: 'SHIELD_FALSE_LIGHT' }, { type: 'RELAY_INSTRUCTIONS' }, { type: 'ESCORT', residentId: 'DN-NOAH' }, { type: 'ORDINARY_RETURN' }, { type: 'REPORT' }]) {
    const p = view([preferred({ type: 'EVACUATION', command: c }),work,rest]);
    const d = chooseAction(p, startingPolicy()); assert.deepEqual(command(d), { type: 'EVACUATION', command: c }); assert(publicActionStillAvailable(p, d.action));
  }
});

test('real night opening reserves two actions and paid ordinary work crosses daylight without rewriting time', () => {
  const begin = preferred({ type: 'EVACUATION', command: { type: 'BEGIN_NIGHT' } });
  const p = view([begin,wait]); p.darkness.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.darkness.resources.actionsRemaining = 2; assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'BEGIN_NIGHT');
  const survey = preferred({ type: 'EVACUATION', command: { type: 'SURVEY_DAY' } }, { enabled: false, reason: '白昼在登记处开始一次实勘。' });
  const midnight = view([survey,work,rest]); assert.equal(command(chooseAction(midnight, startingPolicy())).type, 'WORK');
});

test('unavailable in-scene action uses actual release and walked ordinary exit, then stops rather than looping', () => {
  const blocked = preferred({ type: 'EVACUATION', command: { type: 'OBSERVE', hazard: 'NOISE' } }, { enabled: false, reason: '本夜已没有时间。' });
  const p = view([blocked,nested('EVACUATION','RELEASE'),nested('EVACUATION','ORDINARY_RETURN')], {}, { insideCase: true });
  const release = chooseAction(p, startingPolicy()); assert.equal(command(release).command.type, 'RELEASE');
  const policy = advancePolicy(release, p, p); p.darkness.actions = [nested('EVACUATION','ORDINARY_RETURN')];
  assert.equal(command(chooseAction(p, policy)).command.type, 'ORDINARY_RETURN');
  p.darkness.insideCase = false; assert.equal(chooseAction(p, policy).stop, 'PUBLIC_ORDINARY_EXIT_REACHED');
  const trapped = view([blocked], {}, { insideCase: true }); assert.equal(chooseAction(trapped, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('material shortages use real wage and weekly finance, while permanent blockers stop explicitly', () => {
  const buy = preferred({ type: 'MATERIAL', command: { type: 'BUY_COMPOUND', batchId: 'darkness-carrier-1' } }, { enabled: false, cost: '0行动、360便士', reason: '需要360便士。' });
  const p = view([buy,work,wait]); p.darkness.resources.cash = '20便士';
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'WORK');
  p.darkness.actions = [buy,wait]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  const denied = preferred({ type: 'MATERIAL', command: { type: 'RECOVER_LEGACY_REMAINS', bottleId: 'misfortune-knight-potion-1' } }, { enabled: false, reason: '原场保管人明确拒绝。' });
  assert.equal(chooseAction(view([denied,work,wait]), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('dated1353 custody and later-week original recoveries wait through actual work/week buttons', () => {
  for (const reason of ['真实日期尚未到达前任容纳终止、析出与次日保管交接；不能跳年或提前交付。','先付费查到同一残留，再经过下一真实周回原地封存交接。','至少到下一真实周，再回实际封存原处付费清理；封存本身不等于回收。']) {
    const a = preferred({ type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } }, { enabled: false, reason });
    assert.equal(command(chooseAction(view([a,wait]), startingPolicy())).type, 'NEXT_WEEK');
  }
});

test('final vacancy verification reserves270p plus real living and same-week delivery precedes optional work', () => {
  const verify = preferred({ type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } }, { cost: '1行动、30便士' });
  const delivery = nested('MATERIAL','ACQUIRE_UNIQUENESS', {}, { enabled: false, cost: '1行动、240便士' });
  const p = view([verify,delivery,wait]); p.darkness.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.darkness.resources.actionsRemaining = 2; p.darkness.resources.cash = '299便士';
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.darkness.resources.cash = '300便士'; assert.equal(command(chooseAction(p, startingPolicy())).command.step, 'VACANCY');
  p.darkness.actions = [{ ...delivery, enabled: true, preferredAction: true },work,rest];
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'ACQUIRE_UNIQUENESS');
});

test('paid70% preparation binds the exact compound and is immediately consumed before optional work/rest', () => {
  const p = view([dose,{ ...prepare, enabled: false },work,rest], {}, { sections: [binding] }); p.darkness.resources.mind = 92;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'CONSUME');
  p.darkness.sections = []; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.darkness.sections = [binding]; p.darkness.actions[1].command = { type: 'STABILIZE_PROMOTION', compoundId: 'different' };
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.darkness.actions = [dose,prepare]; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
});

test('preparation reserves two actions and actual recovery; no unprepared consumption is selected', () => {
  const p = view([{ ...dose, preferredAction: false },prepare,wait,rest]); p.darkness.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.darkness.resources.actionsRemaining = 3; p.darkness.resources.mind = 97;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'REST');
  p.darkness.resources.mind = 100; assert.equal(command(chooseAction(p, startingPolicy())).type, 'STABILIZE_PROMOTION');
  assert.deepEqual(publicPrice(prepare), { actions: 1, cash: 100 });
  p.darkness.actions = [{ ...dose, preferredAction: false },wait]; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('failed compound is sealed before work, living heavy injury treatment remains paid, death stops immediately', () => {
  const seal = nested('MATERIAL','SEAL_REMAINS', { compoundId });
  const p = view([seal,work,rest]); assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'SEAL_REMAINS');
  p.darkness.actions = [prepare,offer({ type: 'CLINIC' }, { cost: '1行动、60便士' }),rest]; p.darkness.resources.health = 55;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'CLINIC');
  p.status = 'DEAD'; assert.equal(chooseAction(p, startingPolicy()).stop, 'NATURAL_ACTUAL_TERMINAL');
});

test('three finite carriers and doses are bounded and exhaustion is real UNAVAILABLE after same-original recovery', () => {
  let policy = startingPolicy();
  for (let n = 1; n <= 3; n++) {
    const p = view([preferred({ type: 'MATERIAL', command: { type: 'BUY_COMPOUND', batchId: `darkness-carrier-${n}` } })]);
    policy = advancePolicy(chooseAction(p, policy), p, p);
    const ready = view([dose,{ ...prepare, enabled: false }], {}, { sections: [binding] }); policy = advancePolicy(chooseAction(ready, policy), ready, ready);
  }
  assert.equal(policy.doses, 3); assert.equal(policy.carriers.length, 3);
  const exhausted = view([], {}, { sections: [{ id: 'materials', lines: ['有限普通载体剩余0件；无补货、修复或重发入口。'] }] });
  assert.equal(chooseAction(exhausted, policy).stop, 'NATURAL_CARRIERS_UNAVAILABLE');
  exhausted.darkness.actions = [nested('MATERIAL','RECOVER_SEALED',{ compoundId })]; assert.equal(chooseAction(exhausted, policy).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('finite epilogue reserves two real attempts, keeps actual failed techniques and uses ordinary return/report', () => {
  const start = preferred({ type: 'START_EPILOGUE' }); const p = view([start,wait], {}, { promoted: true }); p.darkness.resources.spirituality = 150; p.darkness.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK'); p.darkness.resources.actionsRemaining = 2;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'START_EPILOGUE');
  p.darkness.actions = [nested('EPILOGUE','SHORT_CONCEALMENT',{}, { preferredAction: true }),nested('EPILOGUE','ORDINARY_SIDE_EXIT')];
  const first = chooseAction(p, startingPolicy()), policy = advancePolicy(first, p, p);
  assert.equal(command(chooseAction(p, policy)).command.type, 'ORDINARY_SIDE_EXIT');
  p.darkness.actions = [nested('EPILOGUE','REPORT')]; const report = chooseAction(p, policy), done = advancePolicy(report, p, p);
  assert.equal(chooseAction(p, done).stop, 'NATURAL_FINITE_DARKNESS_REPORTED');
});

test('meaningfully unchanged accepted actions are detected, while resources and real public progress count', () => {
  const p = view(), policy = startingPolicy(); policy.loop = loopDiagnostic(p, p, policy); assert.equal(policy.loop.repetitions, 1);
  policy.loop = loopDiagnostic(p, p, policy); assert.equal(policy.loop.repetitions, 2);
  assert.equal(loopDiagnostic(p, view([], { cash: 1680 }), policy).repetitions, 0);
});

test('selected SQLite-ready captures use actual public arrivals/outcomes, deduplicate transitions and cap25', () => {
  const intent = { type: 'DARKNESS', command: { type: 'EVACUATION', command: { type: 'WALK', to: 110, pace: 'CAREFUL' } } };
  const p = view([], {}, { sections: [{ id: 'darkness-evacuation', lines: ['已到达2/4；当前搀扶无人。'] }] });
  const outcome = selectionOutcome(p); assert.deepEqual(outcome, { status: 'ACTIVE', promoted: false, arrivals: 2 });
  assert.equal(selectedBoundary(intent, p, []), 'evacuation-actual-arrival-2'); assert.equal(selectedBoundary(intent, outcome, []), 'evacuation-actual-arrival-2');
  assert.equal(selectedBoundary(intent, outcome, [{ kind: 'evacuation-actual-arrival-2' }]), null);
  assert.equal(selectedBoundary(intent, outcome, Array.from({ length: 25 }, (_,i) => ({ kind: `prior-${i}` }))), null);
  for (const [status,promoted,expected] of [['ACTIVE',false,'darkness-first-failed-dose'],['ACTIVE',true,'darkness-actual-promotion'],['DEAD',false,'darkness-actual-terminal-dose']])
    assert.equal(selectedBoundary({ type: 'DARKNESS', command: { type: 'CONSUME', compoundId, confirmed: true } }, { status,promoted,arrivals: 4 }, []), expected);
});

test('the25-sample budget covers both original recoveries, all four arrivals and a failed-then-successful final report', () => {
  const selected = [], outcome = { status: 'ACTIVE', promoted: false, arrivals: 0 };
  const take = c => { const kind = selectedBoundary({ type: 'DARKNESS', command: c }, outcome, selected); assert(kind); selected.push({ kind }); };
  take({ type: 'LEARN_GUIDANCE' });
  for (const type of ['SHIELD_FALSE_LIGHT','RELAY_INSTRUCTIONS']) take({ type: 'EVACUATION', command: { type } });
  for (let arrivals = 1; arrivals <= 4; arrivals++) { outcome.arrivals = arrivals; take({ type: 'EVACUATION', command: { type: 'WALK', to: 110, pace: 'CAREFUL' } }); }
  take({ type: 'EVACUATION', command: { type: 'REPORT' } });
  for (const bottleId of ['misfortune-knight-potion-1','misfortune-knight-potion-2'])
    for (const type of ['INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS']) take({ type: 'MATERIAL', command: { type,bottleId } });
  for (const step of ['CHAIN','VACANCY']) take({ type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS',step } });
  for (const type of ['ACQUIRE_UNIQUENESS','COMPOSE_POTION']) take({ type: 'MATERIAL', command: { type } });
  take({ type: 'STABILIZE_PROMOTION',compoundId }); take({ type: 'CONSUME',compoundId,confirmed: true });
  for (const type of ['SEAL_REMAINS','RECOVER_SEALED']) take({ type: 'MATERIAL', command: { type,compoundId } });
  outcome.promoted = true; take({ type: 'CONSUME',compoundId,confirmed: true }); take({ type: 'START_EPILOGUE' });
  for (const type of ['SHORT_CONCEALMENT','BOUNDED_MISFORTUNE_DIVERSION','REPORT']) take({ type: 'EPILOGUE', command: { type } });
  assert.equal(selected.length, 25); assert.equal(selected.at(-1).kind, 'epilogue-report');
});

test('CLI accepts only exact output/resume and completed-action stop boundaries, rejecting seed/source/draw overrides', () => {
  assert.equal(parseOptions(['--max-new-actions','0']).maxNewActions, 0); assert.equal(parseOptions(['--stop-after-command','679']).stopAfterCommand, 679);
  assert.equal(parseOptions(['--stop-after-command','700']).stopAfterCommand, 700);
  for (const flag of ['--seed','--source','--roll','--outcome','--strategy','--resume-from','--cash']) assert.throws(() => parseOptions([flag,'value']), /Unsupported/);
  assert.throws(() => parseOptions(['--stop-after-command','678'])); assert.throws(() => parseOptions(['--max-new-actions','-1']));
  assert.throws(() => parseOptions(['--max-new-actions','2','--max-new-actions','3']), /Duplicate/);
  assert.throws(() => parseOptions(['--out','/tmp/a','--resume','/tmp/b/checkpoint.json.gz']), /exact output/);
});
function initialCheckpoint() {
  const policy = startingPolicy(), state = { week: 158, random: { seed: 'sleepless-natural-v020', cursor: 348 } }, hash = stateHash(state);
  const p = view([preferred({ type: 'LEARN_GUIDANCE' })], {}, { guidanceKnown: false }), publicHash = stateHash(p), decision = chooseAction(p, policy);
  const payload = { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    runtimeFreezeSha256: 'frozen-runtime', inputFreezeSha256: 'frozen-inputs', policyDefinition: POLICY, policy,
    migration: { originalStateSha256: SNAPSHOT_SHA256, migratedStateSha256: hash, fromSchema: 188, toSchema: 210 },
    commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state, initialStateSha256: hash, finalStateSha256: hash,
    initialPublicSha256: publicHash, publicStateSha256: publicHash, initialGlobalPublicSha256: publicHash, globalPublicStateSha256: publicHash, initialRandomSha256: stateHash(state.random), pending: null, terminal: null };
  payload.pending = { commandCount: PREFIX_COUNT + 1, intent: clone(decision.action.intent), decision, beforeStateSha256: hash, publicBeforeSha256: publicHash, globalPublicBeforeSha256: publicHash, policyBeforeSha256: stateHash(policy) };
  return { payload, freeze: { sha256: payload.runtimeFreezeSha256 }, inputFreeze: { sha256: payload.inputFreezeSha256 }, initialHash: hash };
}

test('gzip checkpoint separates historical input and migrated runtime freezes and binds exact pending/private/public/RNG chain', () => {
  const { payload,freeze,inputFreeze,initialHash } = initialCheckpoint(); verifyCheckpoint(payload, freeze, initialHash, inputFreeze);
  assert.deepEqual(decodeCheckpoint(gzipSync(encodeCheckpoint(payload))).payload, payload);
  for (const mutate of [p => p.pending.commandCount++,p => p.pending.intent.command.type = 'WORK',p => p.pending.beforeStateSha256 = 'changed',
    p => p.pending.publicBeforeSha256 = 'changed',p => p.pending.globalPublicBeforeSha256 = 'changed',p => p.pending.policyBeforeSha256 = 'changed',p => p.state.random.cursor++,
    p => p.runtimeFreezeSha256 = 'changed',p => p.inputFreezeSha256 = 'changed',p => p.sourceSha256 = 'changed',p => p.prefixSha256 = 'changed',
    p => p.migration.originalStateSha256 = 'changed',p => p.migration.migratedStateSha256 = 'changed',
    p => { delete p.initialGlobalPublicSha256; delete p.globalPublicStateSha256; },p => { delete p.pending.globalPublicBeforeSha256; }]) {
    const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash, inputFreeze));
  }
});

test('completed rows bind the full command/private/public/RNG/policy chain and exact deduplicated selection', () => {
  const { payload,freeze,inputFreeze,initialHash } = initialCheckpoint(), pending = payload.pending;
  const before = view([preferred({ type: 'LEARN_GUIDANCE' })], {}, { guidanceKnown: false }), after = view();
  const policy = advancePolicy(pending.decision, after, before), state = { ...payload.state, revision: 681 };
  const row = { commandCount: 680, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
    beforeStateSha256: initialHash, afterStateSha256: stateHash(state), publicBeforeSha256: payload.initialPublicSha256, publicAfterSha256: stateHash(after), globalPublicBeforeSha256: payload.initialGlobalPublicSha256, globalPublicAfterSha256: stateHash(after),
    randomBefore: clone(state.random), randomAfter: clone(state.random), randomBeforeSha256: stateHash(state.random), randomAfterSha256: stateHash(state.random),
    policyBeforeSha256: stateHash(payload.policy), policyAfterSha256: stateHash(policy), selectionOutcome: selectionOutcome(after) };
  Object.assign(payload, { commandCount: 680, commands: [pending.intent], rows: [row], state, policy, finalStateSha256: stateHash(state),
    publicStateSha256: stateHash(after), globalPublicStateSha256: stateHash(after), pending: null, boundaries: [{ kind: 'darkness-learn_guidance', commandCount: 680 }] });
  verifyCheckpoint(payload, freeze, initialHash, inputFreeze);
  for (const mutate of [p => p.rows[0].commandSha256 = 'wrong',p => p.rows[0].publicBeforeSha256 = 'wrong',p => p.rows[0].randomBefore.cursor++,
    p => p.rows[0].policyAfterSha256 = 'wrong',p => { delete p.rows[0].globalPublicBeforeSha256; },p => p.rows[0].globalPublicAfterSha256 = 'wrong',p => p.rows[0].selectionOutcome.privateSource = {},p => p.boundaries.push(clone(p.boundaries[0])),
    p => p.boundaries[0].kind = 'not-the-actual-transition',p => p.commands[0].command.type = 'NEXT_WEEK']) {
    const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash, inputFreeze));
  }
});

test('atomic gzip successor retains real failure, truncated evidence and unknown successor without redrawing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'darkness-producer-contract-')), path = join(directory, 'checkpoint.json.gz');
  try {
    const { payload } = initialCheckpoint(), text = encodeCheckpoint({ ...payload, predecessorSha256: null }); writeFileSync(path, gzipSync(text));
    const failed = { format: FORMAT, predecessorSha256: decodeCheckpoint(text).sha256, pending: null, actualFailure: { chance: 70, tier: 'FAILURE', sameOriginal: true, costsRetained: true } };
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint(failed))); recoverAtomicNext(path); assert.deepEqual(decodeCheckpoint(readFileSync(path)).payload, failed);
    assert.equal(existsSync(`${path}.next`), false); assert.deepEqual(readCapture(path).payload, failed);
    writeFileSync(`${path}.next`, Buffer.from([0x1f,0x8b,0x00])); recoverAtomicNext(path); assert(existsSync(`${path}.incomplete`));
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint({ format: FORMAT, predecessorSha256: 'unknown' })));
    assert.throws(() => recoverAtomicNext(path), /Unknown checkpoint successor/); assert(existsSync(`${path}.next`));
    const forged = JSON.parse(text); forged.payload.state.random.cursor++; assert.throws(() => decodeCheckpoint(JSON.stringify(forged)), /checksum/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('orchestration persists pending before prepare and complete draft before commit, with exact resume and no old replay', () => {
  const source = main.toString(), pending = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...boundary, pending }');
  const select = source.indexOf('assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision');
  const prepareDraft = source.indexOf('draft = session.prepare(pending.intent, before.revision)');
  const completed = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next');
  const commit = source.indexOf('if (draft) session.commit(draft)');
  assert(pending >= 0 && pending < select && select < prepareDraft && prepareDraft < completed && completed < commit);
  assert.match(source, /!boundary\.pending && \(count >= options\.maxNewActions/); assert.match(source, /boundary\.commandCount >= options\.stopAfterCommand/);
  assert.match(source, /if \(!paused && !diagnostic && !saved\.payload\.terminal\)/); assert.match(source, /historicalPrefixReplayedByThisProducer: false/);
  assert.match(source, /independent694DeathRetainedExactly: true/); assert.match(source, /independent694DeathUsedAsInput: false/);
  assert.match(source, /gzipSync\(old\.buffers\[index\]/); assert.match(source, /resumeExactPendingRequired: true/); assert.match(source, /readdirSync\(options\.out\)\.length, 0/);
  assert.match(source, /runtime-freeze\.json/); assert.match(source, /input-freeze\.json/); assert.match(source, /migration-initial\.json\.gz/); assert.match(source, /Retained migrated initial\/public boundary changed/);
  assert.match(source, /selectionOutcome: selectionOutcome\(after\)/); assert.match(source, /globalPublicBeforeSha256/); assert.match(source, /globalPublicAfterSha256/); assert.match(source, /assertGlobalPublic\(globalAfter, next\)/); assert.match(checkOriginals.toString(), /Frozen actual S1 handoff/);
  assert.match(inspectFreeze.toString(), /dist\/domain\/darkness\/owned-session\.js/);
  assert.doesNotMatch(source, /createSliceRun|nextInt|Math\.random|spyOn|mockImplementation/);
});
