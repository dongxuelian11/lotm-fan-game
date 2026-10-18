import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SOURCE, SOURCE_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY, startingPolicy, chooseAction, advancePolicy,
  publicPrice, loopDiagnostic, selectedBoundary, selectionOutcome, parseOptions, stateHash, encodeCheckpoint, decodeCheckpoint,
  recoverAtomicNext, verifyCheckpoint, readSource, readCapture, checkOriginals, main } from './moon-stage.mjs';

// Producer-only contracts, never a game import, natural run, build, RNG search,
// SQLite action or fixture rewrite. The parent runs these only after review.
const clone = value => structuredClone(value);
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, options = {}) => ({ id: `public-${command.type}`, label: '公开行动', cost: '1行动、0便士', enabled: true, reason: null, command, ...options });
const beauty = (actions = [], options = {}) => ({ promoted: false, guidanceKnown: true, preparedWeek: null, insideCase: false,
  actions, nextStep: '完成真实原特性回收', life: { reflected: false }, ...options });
const moon = (actions = [], options = {}) => ({ promoted: false, guidanceKnown: false, insideCase: false, nextStep: '真实夜航',
  resources: { health: 100, mind: 100, spirituality: 120, cash: '2000便士', actionsRemaining: 3 },
  sections: [{ id: 'injuries', lines: ['当前没有实际伤势。'] }], actions, ...options });
const view = (options = {}) => ({ status: 'ACTIVE', week: 160, date: { year: 1352, month: 7, day: 15 },
  health: 100, mind: 100, spirituality: 120, maxHealth: 100, maxMind: 100, maxSpirituality: 120,
  cash: 2000, actionsRemaining: 3, wagePaid: true, pollution: 0, injuries: [], debtTotal: 0,
  canAct: true, activeEvent: null, combat: null, progression: { sequence: 2, acting: 100, mastery: {} },
  beautyGoddess: beauty(), moon: moon(), ...options });
const command = decision => decision.action?.intent;
const ordinary = type => offer({ type });
const wait = ordinary('NEXT_WEEK');
const work = offer({ type: 'WORK' }, { cost: '1行动；180便士，每周一次' });
const rest = ordinary('REST');
const compoundId = 'moon-compound-1';
const dose = offer({ type: 'CONSUME', compoundId, confirmed: true }, { preferredAction: true });
const prepare = offer({ type: 'STABILIZE_PROMOTION', compoundId }, { cost: '1行动、100便士、12灵性、8精神', preferredAction: true });
const moonView = (actions, options = {}) => view({ moon: moon(actions, { guidanceKnown: true, ...options }) });
const freezeDeep = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); } return value; };

test('exact670 failed source, full command prefix, actual body, original failures and seed stay pinned', () => {
  assert.equal(SOURCE, 'tests/fixtures/beauty-goddess-v01900/script-blocker-first.json');
  assert.equal(SOURCE_SHA256, '195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb');
  assert.equal(PREFIX_COUNT, 670); assert.equal(PREFIX_SHA256, '40c5fe395855437d65c9c670916fe4bbc6a0db2fb683e8c9472de57e1cd409bc');
  const old = readSource();
  assert.equal(compactHash(old.commands), PREFIX_SHA256); assert.equal(old.source.revision, 671);
  assert.deepEqual(old.source.random, { seed: 'apothecary-rebuild-first', cursor: 318 });
  assert.deepEqual([old.source.week,old.source.health,old.source.mind,old.source.spirituality,old.source.cash,old.source.actionsRemaining], [160,85,75,120,14,1]);
  assert.equal(old.source.beautyGoddess.bottles.length, 3); assert(old.source.beautyGoddess.bottles.every(b => b.outcome === 'FAILURE'));
  assert.equal(POLICY.noReroll, true); assert.equal(POLICY.selectedBoundaryLimit, 30);
  assert(old.originalObservation.stage); assert(old.bytes.length > 0);
});

test('initial continuation spends the original last action on rest instead of duplicating W160 wages', () => {
  const p = view({ health: 85, mind: 75, cash: 14, actionsRemaining: 1, pollution: 30, beautyGoddess: beauty([offer({ type: 'REQUEST_RECOVERY_V1', bottleId: 'beauty-goddess-potion-1' }, { enabled: false, cost: '1行动、120便士', reason: '调查原特性需要120便士' })]) });
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'ACTION', action: 'REST' });
  p.week = 161; p.wagePaid = false;
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'ACTION', action: 'WORK' });
});

test('real living and debt choices remain publicly enabled and unknown events pause explicitly', () => {
  for (const [id,choiceId] of [['LIFE-BILL-01','PAY_PART'],['DEBT-SETTLE-01','DEFER'],['DEBT-NOTICE-01','DECLINE']]) {
    const p = view({ activeEvent: { id, instanceId: `event-${id}`, choices: [{ id: choiceId, enabled: true, label: '实际处理' }] } });
    assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'EVENT_CHOICE', eventInstanceId: `event-${id}`, choiceId });
  }
  assert.equal(chooseAction(view({ activeEvent: { id: 'UNKNOWN', choices: [] } }), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('same failed original investigation and later real recovery never use independent supply', () => {
  const target = 'beauty-goddess-potion-1';
  let p = view({ beautyGoddess: beauty([offer({ type: 'REQUEST_RECOVERY_V1', bottleId: target }, { cost: '1行动 · 120便士' }),
    offer({ type: 'REQUEST_SUPPLY' })]) });
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'BEAUTY_GODDESS', command: { type: 'REQUEST_RECOVERY_V1', bottleId: target } });
  p.beautyGoddess = beauty([offer({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: target }, { enabled: false, reason: '隔一真实周' })]);
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'ACTION', action: 'REST' });
  p.beautyGoddess.actions[0].enabled = true;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'RECOVER_CHARACTERISTIC_V1');
  p.beautyGoddess = beauty([offer({ type: 'REQUEST_SUPPLY' }),offer({ type: 'RECEIVE_SUPPLY' })]);
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});


test('permanent original recovery blockers do not become an endless ordinary-work loop', () => {
  const p = view({ beautyGoddess: beauty([offer({ type: 'REQUEST_RECOVERY_V1', bottleId: 'beauty-goddess-potion-1' }, { enabled: false, cost: '1行动、120便士', reason: '须核验真实失败原瓶，不能更换原特性。' })]) });
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('five fresh carrier jobs precede90p purchase and150p actual preparation', () => {
  const bottleId = 'beauty-goddess-potion-4';
  const labour = offer({ type: 'POTION_WORK', bottleId });
  const buy = offer({ type: 'BUY_POTION', bottleId }, { cost: '0行动 · 90便士' });
  const preparation = offer({ type: 'PREPARE_PROMOTION' }, { cost: '1行动 · 150便士' });
  let p = view({ beautyGoddess: beauty([preparation,labour,buy]) });
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'POTION_WORK');
  p.beautyGoddess.actions = [preparation,buy]; assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'BUY_POTION');
  p.beautyGoddess.actions = [preparation,offer({ type: 'CONSUME', bottleId, confirmed: true }, { enabled: false })];
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'PREPARE_PROMOTION');
  assert.deepEqual(publicPrice(preparation), { actions: 1, cash: 150 });
});

test('paid S1 prepared dose is consumed immediately and failed ancestry follows its same new vessel', () => {
  const c = { type: 'CONSUME', bottleId: 'beauty-goddess-potion-4', confirmed: true };
  const before = view({ wagePaid: false, beautyGoddess: beauty([offer(c)], { preparedWeek: 170 }) });
  const d = chooseAction(before, startingPolicy()); assert.deepEqual(command(d), { type: 'BEAUTY_GODDESS', command: c });
  const after = view({ week: 170 }); const policy = advancePolicy(d, after, before);
  assert.equal(policy.beautyDoses, 1); assert.equal(policy.recoveryTarget, c.bottleId);
  const next = view({ beautyGoddess: beauty([offer({ type: 'REQUEST_RECOVERY_V1', bottleId: 'beauty-goddess-potion-2' }),offer({ type: 'REQUEST_RECOVERY_V1', bottleId: c.bottleId })]) });
  assert.equal(command(chooseAction(next, policy)).command.bottleId, c.bottleId);
});

test('three real S1 practices follow public finite attempts and ordinary cleanup without forcing mastery', () => {
  const next = offer({ type: 'ORDINARY_PLACE' }, { id: 'beauty-goddess-life-ordinary_place', preferredAction: true, cleanup: true });
  const p = view({ beautyGoddess: beauty([next], { promoted: true, insideCase: true }) });
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'BEAUTY_GODDESS', command: next.command });
  const blocked = view({ beautyGoddess: beauty([offer({ type: 'ABORT' }, { cleanup: true })], { promoted: true, insideCase: true }) });
  assert.equal(command(chooseAction(blocked, startingPolicy())).command.type, 'ABORT');
});

test('S1 invitation reserves real time/money and actual vacancy wait never changes dates', () => {
  const invite = offer({ type: 'INVITE', caseId: 'lit-crossing', method: 'ABILITY' }, { id: 'beauty-goddess-life-invite', preferredAction: true });
  let p = view({ actionsRemaining: 1, beautyGoddess: beauty([invite], { promoted: true }) });
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'ACTION', action: 'REST' });
  p = view({ progression: { sequence: 1, acting: 100, mastery: Object.fromEntries(Array.from({ length: 23 }, (_,i) => [`skill-${i}`,0])) },
    beautyGoddess: beauty([], { promoted: true, life: { reflected: true } }),
    moon: moon([offer({ type: 'LEARN_GUIDANCE' }, { enabled: false, reason: '银湾的未来变故尚未发生，当前仍没有可交接的空位。' })]) });
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'ACTION', action: 'REST' });
  p.moon.actions[0].enabled = true;
  assert.deepEqual(command(chooseAction(p, startingPolicy())), { type: 'MOON', command: { type: 'LEARN_GUIDANCE' } });
});

test('public selection is deterministic, immutable and cannot inspect source state or random future', () => {
  const p = moonView([offer({ type: 'SERVICE', command: { type: 'CONDUCT_SERVICE', stationId: 'NORTH' } }, { preferredAction: true })]);
  for (const key of ['state','random','seed','cursor','journal','futureRoll','privateSource']) Object.defineProperty(p, key, { get() { throw Error(`Private ${key}`); } });
  freezeDeep(p); const policy = freezeDeep(startingPolicy());
  const first = chooseAction(p, policy); assert.deepEqual(first, chooseAction(p, policy)); assert.notEqual(first.policy, policy);
  assert.equal(command(first).command.command.type, 'CONDUCT_SERVICE');
});

test('actual closure, wait, shore return and repair use the same public station progression', () => {
  for (const type of ['WAIT','CONDUCT_SERVICE','SHORE_RETURN','BUY_SPARE','REPAIR_DAMAGE','VERIFY']) {
    const c = { type: 'SERVICE', command: { type, stationId: 'NORTH' } };
    const decision = chooseAction(moonView([offer(c, { preferredAction: true })]), startingPolicy());
    assert.deepEqual(command(decision), { type: 'MOON', command: c });
  }
  const blocked = offer({ type: 'SERVICE', command: { type: 'REPAIR_DAMAGE', stationId: 'NORTH' } }, { preferredAction: true, enabled: false, cost: '1行动、6便士', reason: '需要一次实际行动' });
  const p = moonView([blocked,wait]); p.moon.resources.actionsRemaining = 0;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'NEXT_WEEK');
});



test('night booking reserves a real service action rather than knowingly scheduling a missed window', () => {
  const p = moonView([offer({ type: 'SERVICE', command: { type: 'BOOK', stationId: 'NORTH' } }, { preferredAction: true }),wait]);
  p.moon.resources.actionsRemaining = 0;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'NEXT_WEEK');
});

test('a booked real night window takes priority over an optional eight-hour wage action', () => {
  for (const type of ['WAIT','CONDUCT_SERVICE','VERIFY']) {
    const p = moonView([offer({ type: 'SERVICE', command: { type, stationId: 'REED' } }, { preferredAction: true }),work,rest]);
    assert.equal(command(chooseAction(p, startingPolicy())).command.command.type, type);
  }
});
test('a funded finite epilogue retains its three real actions instead of endless work/week waiting', () => {
  const p = moonView([offer({ type: 'START_EPILOGUE' }, { preferredAction: true }),work,wait], { promoted: true });
  p.moon.resources.spirituality = 150;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'START_EPILOGUE');
});

test('prepared S0 dose binds its own paid preparation and cannot be delayed for optional work or rest', () => {
  const p = moonView([dose,{ ...prepare, enabled: false },work,rest], { sections: [{ id: 'promotion-stability', lines: ['本瓶付费准备后的实际成功率70%；准备仍在原室和七天实际期限内有效。'] }] });
  p.moon.resources.mind = 92;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'CONSUME');
  p.moon.sections = []; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  p.moon.sections = [{ id: 'promotion-stability', lines: ['当前准备仍有效。'] }]; p.moon.actions[1].command = { ...p.moon.actions[1].command, compoundId: 'different' };
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
});


test('final uniqueness verification reserves paired actual fees and same-week handoff wins over work', () => {
  const verify = offer({ type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } }, { cost: '1行动、30便士', preferredAction: true });
  const delivery = offer({ type: 'MATERIAL', command: { type: 'ACQUIRE_UNIQUENESS' } }, { cost: '1行动、240便士', enabled: false, reason: '先核空位' });
  const p = moonView([verify,delivery,wait]); p.moon.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'NEXT_WEEK');
  p.moon.actions = [{ ...delivery, enabled: true, preferredAction: true },work];
  assert.equal(command(chooseAction(p, startingPolicy())).command.command.type, 'ACQUIRE_UNIQUENESS');
});

test('unprepared S0 consumption is never selected and paid preparation reserves two actual actions', () => {
  const p = moonView([{ ...dose, preferredAction: false },prepare,wait]); p.moon.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'NEXT_WEEK');
  p.moon.actions = [{ ...dose, preferredAction: false },wait];
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('actual failed compound is sealed before wages and heavy injury treatment costs remain real', () => {
  const seal = offer({ type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId } });
  const p = moonView([work,seal,rest]); p.moon.resources.health = 55;
  assert.equal(command(chooseAction(p, startingPolicy())).command.command.type, 'SEAL_REMAINS');
  p.moon.actions = [offer({ type: 'CLINIC' }, { cost: '1行动、60便士' }),rest];
  p.moon.sections = [{ id: 'body', lines: ['重伤：尚未处置。'] }];
  assert.equal(command(chooseAction(p, startingPolicy())).command.type, 'CLINIC');
});

test('finite epilogue preserves attempted failures and offers a real ordinary exit without skill success', () => {
  const skill = offer({ type: 'EPILOGUE', command: { type: 'MOONLIT_CHANNEL' } }, { preferredAction: true });
  const exit = offer({ type: 'EPILOGUE', command: { type: 'EVACUATE' } });
  const p = moonView([skill,exit], { promoted: true, insideCase: true });
  const first = chooseAction(p, startingPolicy()); assert.equal(command(first).command.command.type, 'MOONLIT_CHANNEL');
  const policy = advancePolicy(first, p, p);
  assert.equal(command(chooseAction(p, policy)).command.command.type, 'EVACUATE');
  p.moon.actions = [offer({ type: 'EPILOGUE', command: { type: 'REPORT' } })];
  const report = chooseAction(p, policy); const finished = advancePolicy(report, p, p);
  assert.equal(chooseAction(p, finished).stop, 'NATURAL_FINITE_MOON_REPORTED');
});

test('actual death is terminal before any future action and missing controls remain diagnostics', () => {
  assert.equal(chooseAction(view({ status: 'DEAD' }), startingPolicy()).stop, 'NATURAL_ACTUAL_TERMINAL');
  assert.equal(chooseAction(moonView([]), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('meaningful unchanged boundary identifies an actual repeated no-progress action', () => {
  const p = view(), policy = startingPolicy();
  policy.loop = loopDiagnostic(p, p, policy); assert.equal(policy.loop.repetitions, 1);
  policy.loop = loopDiagnostic(p, p, policy); assert.equal(policy.loop.repetitions, 2);
  const progressed = view({ cash: 2180 }); policy.loop = loopDiagnostic(p, progressed, policy); assert.equal(policy.loop.repetitions, 0);
});

test('selected compressed SQLite evidence has unique kinds and an absolute30-file cap', () => {
  const intent = { type: 'MOON', command: { type: 'SERVICE', command: { type: 'VERIFY', stationId: 'NORTH' } } }, p = moonView([]);
  const key = selectedBoundary(intent, p, []); assert.equal(key, 'night-NORTH-verify');
  assert.equal(selectedBoundary(intent, p, [{ kind: key }]), null);
  assert.equal(selectedBoundary(intent, p, Array.from({ length: 30 }, (_,i) => ({ kind: `prior-${i}` }))), null);
});

test('each actual public selection outcome has exactly three fields and rederives consume selection', () => {
  const cases = [
    ['BEAUTY_GODDESS','ACTIVE',false,false,'s1-first-recovery-failure'],
    ['BEAUTY_GODDESS','ACTIVE',true,false,'s1-actual-promotion'],
    ['MOON','ACTIVE',true,false,'moon-first-failed-dose'],
    ['MOON','ACTIVE',false,true,'moon-actual-promotion'],
    ['MOON','DEAD',false,false,'moon-actual-terminal-dose'],
  ];
  for (const [domain,status,beautyPromoted,moonPromoted,expected] of cases) {
    const after = view({ status, beautyGoddess: beauty([], { promoted: beautyPromoted }), moon: moon([], { promoted: moonPromoted }) });
    for (const key of ['state','random','seed','cursor','journal','futureRoll','privateSource']) Object.defineProperty(after, key, { get() { throw Error(`No private ${key} in selection outcome`); } });
    const outcome = selectionOutcome(after);
    assert.deepEqual(outcome, { status, beautyPromoted, moonPromoted });
    assert.deepEqual(Object.keys(outcome).sort(), ['beautyPromoted','moonPromoted','status']);
    const reconstructed = { status: outcome.status, beautyGoddess: { promoted: outcome.beautyPromoted }, moon: { promoted: outcome.moonPromoted } };
    const intent = { type: domain, command: { type: 'CONSUME', confirmed: true, ...(domain === 'MOON' ? { compoundId } : { bottleId: 'beauty-goddess-potion-4' }) } };
    assert.equal(selectedBoundary(intent, after, []), expected);
    assert.equal(selectedBoundary(intent, reconstructed, []), expected);
    assert.equal(selectedBoundary(intent, reconstructed, [{ kind: expected }]), null);
  }
  assert.match(main.toString(), /selectionOutcome: selectionOutcome\(after\)/);
});

test('CLI permits only output, exact resume and observation limit, never seed/source/outcome overrides', () => {
  assert.equal(parseOptions(['--max-new-actions','0']).maxNewActions, 0);
  assert.equal(parseOptions(['--max-new-actions','15']).maxNewActions, 15);
  for (const flag of ['--seed','--source','--roll','--outcome','--strategy','--resume-from']) assert.throws(() => parseOptions([flag,'value']), /Unsupported/);
  assert.throws(() => parseOptions(['--max-new-actions','-1']));
  assert.throws(() => parseOptions(['--max-new-actions','2','--max-new-actions','3']), /Duplicate/);
  assert.throws(() => parseOptions(['--out','/tmp/a','--resume','/tmp/b/checkpoint.json.gz']), /exact output/);
});
function initialCheckpoint() {
  const policy = startingPolicy(), state = { week: 160, random: { seed: 'apothecary-rebuild-first', cursor: 318 } }, hash = stateHash(state);
  const publicHash = stateHash(view()), decision = chooseAction(view({ wagePaid: false }), policy);
  const payload = { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    freezeSha256: 'frozen-runtime', policyDefinition: POLICY, policy, commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state,
    initialStateSha256: hash, finalStateSha256: hash, initialPublicSha256: publicHash, publicStateSha256: publicHash,
    initialRandomSha256: stateHash(state.random), pending: null, terminal: null };
  payload.pending = { commandCount: PREFIX_COUNT + 1, intent: clone(decision.action.intent), decision,
    beforeStateSha256: hash, publicBeforeSha256: publicHash, policyBeforeSha256: stateHash(policy) };
  return { payload, freeze: { sha256: payload.freezeSha256 }, initialHash: hash };
}

test('checkpoint binds exact pending intent, source, prefix, private/public/RNG hashes and frozen policy', () => {
  const { payload,freeze,initialHash } = initialCheckpoint(); verifyCheckpoint(payload, freeze, initialHash);
  assert.deepEqual(decodeCheckpoint(gzipSync(encodeCheckpoint(payload))).payload, payload);
  for (const mutate of [p => p.pending.commandCount++,p => p.pending.intent.action = 'REST',p => p.pending.beforeStateSha256 = 'different',
    p => p.pending.publicBeforeSha256 = 'different',p => p.pending.policyBeforeSha256 = 'different',p => p.state.random.cursor++,
    p => p.freezeSha256 = 'different',p => p.sourceSha256 = 'different',p => p.prefixSha256 = 'different']) {
    const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash));
  }
});

test('atomic gzip successor preserves failures, truncated evidence and unknown successor without redraw', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moon-producer-contract-')), path = join(directory, 'checkpoint.json.gz');
  try {
    const { payload } = initialCheckpoint(); const text = encodeCheckpoint({ ...payload, predecessorSha256: null }); writeFileSync(path, gzipSync(text));
    const failed = { format: FORMAT, predecessorSha256: decodeCheckpoint(text).sha256, pending: null,
      actualFailure: { chance: 44, roll: 57, tier: 'FAILURE', sameOriginal: true, paidCostsRetained: true } };
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint(failed))); recoverAtomicNext(path);
    assert.deepEqual(decodeCheckpoint(readFileSync(path)).payload, failed); assert.equal(existsSync(`${path}.next`), false);
    assert.deepEqual(readCapture(path).payload, failed);
    writeFileSync(`${path}.next`, Buffer.from([0x1f,0x8b,0x00])); recoverAtomicNext(path);
    assert(existsSync(`${path}.incomplete`)); assert.deepEqual(decodeCheckpoint(readFileSync(path)).payload, failed);
    writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint({ format: FORMAT, predecessorSha256: 'unknown' })));
    assert.throws(() => recoverAtomicNext(path), /Unknown checkpoint successor/); assert(existsSync(`${path}.next`));
    const forged = JSON.parse(text); forged.payload.state.random.cursor++; assert.throws(() => decodeCheckpoint(JSON.stringify(forged)), /checksum/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('orchestration checkpoints before prepare and after complete draft before commit, pauses are resumable', () => {
  const source = main.toString();
  const pending = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...boundary, pending }');
  const select = source.indexOf('assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision');
  const prepareDraft = source.indexOf('draft = session.prepare(pending.intent, before.revision)');
  const completed = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next');
  const commit = source.indexOf('if (draft) session.commit(draft)');
  assert(pending >= 0 && pending < select && select < prepareDraft && prepareDraft < completed && completed < commit);
  assert.match(source, /if \(!boundary\.pending && count >= options\.maxNewActions\)/);
  assert.match(source, /if \(!paused && !diagnostic && !saved\.payload\.terminal\)/);
  assert.match(source, /historicalPrefixReplayedByThisProducer: false/);
  assert.match(source, /archived912Used: false/);
  assert.match(source, /gzipSync\(old\.bytes/);
  assert.match(source, /resumeExactPendingRequired: true/);
  assert.match(checkOriginals.toString(), /Original three failures cannot be rewritten/);
  assert.match(checkOriginals.toString(), /Frozen actual S1 handoff changed/);
});
