import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, ARCHIVE, ARCHIVE_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY, INPUTS,
  readSource, migrate, startingPolicy, chooseAction, advancePolicy, publicPrice, publicActionStillAvailable,
  assertPublicOnly, assertGlobalPublic, capturePublic, loopDiagnostic, selectedBoundary, selectionOutcome,
  stateHash, parseOptions, encodeCheckpoint, decodeCheckpoint, recoverAtomicNext, retainActionCapture, readCapture,
  verifyCheckpoint, verifyActionCapture, checkOriginals, main } from './tyrant-stage.mjs';

// Pure producer contracts: no game reducer, build, RNG generation or natural run.
const clone = v => structuredClone(v);
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const offer = (command, extra = {}) => ({ id: `public-${JSON.stringify(command)}`, label: '真实公开行动', cost: '1行动、0便士', command,
  enabled: true, reason: null, ...extra });
const preferred = (command, extra = {}) => offer(command, { preferredAction: true, ...extra });
const panel = (actions = [], extra = {}) => ({ guidanceKnown: true, promoted: false, insideCase: false,
  resources: { health: 100, mind: 100, spirituality: 120, cash: '600便士', actionsRemaining: 3 }, actions, sections: [], ...extra });
const s1 = (actions = [], extra = {}) => ({ guidanceKnown: true, promoted: false, preparedWeek: null, actions, bottles: [], insideCase: false,
  life: { activeCase: null, inside: false, reflected: false, playerLocation: 'OUTSIDE', target: {}, pad: {}, cases: [], actions: [] }, ...extra });
const view = (actions = [], extra = {}) => ({ runId: 'pure-contract', revision: 702, status: 'ACTIVE', week: 169,
  date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 9, day: 16 }, actionsRemaining: 3, weeklyBudget: 3, cash: 600,
  weeklyWage: 180, wagePaid: false, health: 100, mind: 100, spirituality: 120, maxHealth: 100, maxMind: 100, maxSpirituality: 120,
  pollution: 0, injuries: [], injuryRisk: 0, debtTotal: 0, debts: [], canAct: true, actionBlockedReason: null,
  activeEvent: null, combat: null, progression: { sequence: 1, acting: 100, mastery: {} }, thunderGod: s1(), tyrant: panel(actions), ...extra });
const s1view = (actions, extra = {}) => view([], { progression: { sequence: 2, acting: 100, mastery: {} }, tyrant: panel([], { guidanceKnown: false }), thunderGod: s1(actions), ...extra });
const command = decision => decision.action?.intent.command;
const work = offer({ type: 'WORK' }, { cost: '1行动、8小时，180便士，每周一次' });
const rest = offer({ type: 'REST' });
const week = offer({ type: 'NEXT_WEEK' }, { cost: '结生活费；没有工资或恢复' });
const clinic = offer({ type: 'CLINIC' }, { cost: '1行动、60便士' });
const nested = (type, child, extra = {}, options = {}) => preferred({ type, command: { type: child, ...extra } }, options);

test('pins genuinely restored193 living701 and original natural prefix, explicitly new215', () => {
  assert.equal(PREFIX_COUNT, 701); assert.match(FORMAT, /^NEW215_RESTORED193/);
  assert.deepEqual(INPUTS, [{ file: SOURCE, sha256: SOURCE_SHA256 }, { file: ARCHIVE, sha256: ARCHIVE_SHA256 }]);
  const old = readSource();
  assert.equal(digest(old.source), SOURCE_STATE_SHA256); assert.equal(digest(old.commands), PREFIX_SHA256);
  assert.equal(old.commands.length, 701); assert.equal(old.source.schemaVersion, 190);
  assert.deepEqual(old.source.random, { seed: 'sailor-natural-v026', cursor: 270 });
  assert.deepEqual([old.source.revision,old.source.week,old.source.health,old.source.mind,old.source.spirituality,old.source.cash,old.source.actionsRemaining], [702,169,93,85,120,210,2]);
  assert.equal(old.source.thunderGod.bottles.length, 3); assert(old.source.thunderGod.bottles.every(b => b.outcome === 'FAILURE'));
  assert.equal(old.inputFreeze.lostOriginal215Restored, false); assert.equal(old.inputFreeze.origin, 'GENUINELY_RESTORED_VOLUME193');
  assert.equal(POLICY.noReroll, true); assert.equal(POLICY.defaultObservationActions, 32);
});

test('migration preserves every old field and adds only current212 roots and metadata', () => {
  const original = { schemaVersion: 190, contentVersion: 'thunder-god-v190', health: 93, random: { seed: 'same', cursor: 270 } };
  const runtime = { migrateSliceState: old => ({ ...clone(old), schemaVersion: 212, contentVersion: 'tyrant-v212', tyrant: {} }), assertValidSliceState: () => {} };
  assert.equal(migrate(runtime, original).health, 93); assert.equal(original.schemaVersion, 190);
  runtime.migrateSliceState = old => ({ ...clone(old), schemaVersion: 212, contentVersion: 'tyrant-v212', health: 100 });
  assert.throws(() => migrate(runtime, original), /Migration changed original health/);
});

test('paid S1 recovery chooses original1 and preserves late-week restriction without resupply', () => {
  const a = offer({ type: 'REQUEST_RECOVERY_V1', bottleId: 'thunder-god-potion-1' }, { cost: '1行动 · 120便士' });
  const p = s1view([offer({ type: 'REQUEST_SUPPLY' }), a]); const d = chooseAction(p, startingPolicy());
  assert.deepEqual(command(d), a.command); assert(publicActionStillAvailable(p, d.action));
  p.thunderGod.actions = [offer({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'thunder-god-potion-1' }, { enabled: false, reason: '调查后须隔一真实周。' })];
  assert.deepEqual(chooseAction(p, startingPolicy()).action.intent, { type: 'ACTION', action: 'WORK' });
  p.wagePaid = true; assert.deepEqual(chooseAction(p, startingPolicy()).action.intent, { type: 'ACTION', action: 'REST' });
  p.canAct = false; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('five fresh S1 jobs precede payment and current paid support precedes independent dose', () => {
  const bottleId = 'thunder-god-potion-4';
  const p = s1view([offer({ type: 'POTION_WORK', bottleId }), offer({ type: 'BUY_POTION', bottleId })]);
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'POTION_WORK');
  p.thunderGod.actions = [offer({ type: 'BUY_POTION', bottleId }, { cost: '0行动 · 90便士' })]; p.cash = 299;
  assert.equal(chooseAction(p, startingPolicy()).action.intent.type, 'ACTION'); p.cash = 300;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'BUY_POTION');
  p.thunderGod.preparedWeek = p.week;
  p.thunderGod.actions = [offer({ type: 'CONSUME', bottleId, confirmed: true }, { cost: '0行动' }), offer({ type: 'STABILIZE_PROMOTION', bottleId }, { cost: '0行动 · 60便士' })];
  p.thunderGod.bottles = [{ id: bottleId, status: '已交付，尚未服用', chance: 70 }];
  const prepare = chooseAction(p, startingPolicy()); assert.equal(command(prepare).type, 'STABILIZE_PROMOTION');
  const saved = advancePolicy(prepare, p, p); assert.equal(saved.s1StabilizedBottleId, bottleId);
  const dose = chooseAction(p, saved); assert.equal(command(dose).type, 'CONSUME');
  const failed = advancePolicy(dose, p, p); assert.equal(failed.s1SourceBottleId, bottleId); assert.equal(failed.s1Doses, 1);
  p.thunderGod.actions = [offer({ type: 'REQUEST_RECOVERY_V1', bottleId }), offer({ type: 'REQUEST_RECOVERY_V1', bottleId: 'thunder-god-potion-2' })];
  assert.equal(command(chooseAction(p, failed)).bottleId, bottleId, 'After failure continue the same original descendant, not a favorable substitute');
});

test('ordinary S1 practice selects a real paid ordinary invitation, never the preferred ability', () => {
  const ability = preferred({ type: 'INVITE', caseId: 'located-target', method: 'ABILITY' });
  const ordinary = offer({ type: 'INVITE', caseId: 'located-target', method: 'ORDINARY' });
  const p = s1view([ability,ordinary], { progression: { sequence: 1, acting: 0, mastery: {} } });
  p.thunderGod.life.actions = [ability,ordinary]; assert.equal(command(chooseAction(p, startingPolicy())).method, 'ORDINARY');
  p.thunderGod.life.actions = [preferred({ type: 'WALK_TO_SITE' }, { cost: '0行动' })]; p.cash = 9;
  assert.equal(chooseAction(p, startingPolicy()).action.intent.type, 'ACTION');
  p.thunderGod.life.reflected = true; p.progression.acting = 100; p.tyrant.actions = [preferred({ type: 'LEARN_GUIDANCE' }, { cost: '1行动、100便士' })]; p.cash = 100;
  assert.equal(chooseAction(p, startingPolicy()).action.intent.type, 'TYRANT');
});

test('ordinary events retain exact public instance and explicit enabled choice', () => {
  const p = s1view([], { activeEvent: { id: 'LIFE-CARE-01', instanceId: 'real-event', choices: [{ id: 'PAY', label: '支付', enabled: true, preview: '60便士' }] } });
  const d = chooseAction(p, startingPolicy()); assert.equal(d.action.intent.eventInstanceId, 'real-event'); assert(publicActionStillAvailable(p, d.action));
  p.activeEvent.choices[0].enabled = false; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('actual public next costs earn real wages, while permanent denials pause without withdrawal', () => {
  const a = nested('MATERIAL','ACQUIRE_CHARACTERISTIC',{ bottleId: 'thunder-god-potion-2' }, { enabled: false, cost: '1行动、1100便士', reason: '须实付1100便士。' });
  const p = view([a,work,week]); assert.equal(command(chooseAction(p, startingPolicy())).type, 'WORK');
  p.tyrant.actions = [a,{ ...work, enabled: false },week]; assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.tyrant.resources.cash = '1200便士'; a.reason = '原保管人拒绝，当前不能交接。';
  p.tyrant.actions.push(offer({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } }));
  assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('coasts follow paid finite transfers and real renew/review, challenge follows actual public route', () => {
  for (const type of ['ASK_TRANSFER','LOAD_TRANSFER','DELIVER_TRANSFER','FULFILL','RENEW','REVIEW_NEXT_WEEK']) {
    const a = nested('COAST',type,{ coastId: type === 'DELIVER_TRANSFER' ? 'south' : 'north' });
    assert.deepEqual(command(chooseAction(view([a]), startingPolicy())), a.command);
  }
  for (const type of ['BEGIN','WITHDRAW','RETREAT','BREAK_CONTACT']) {
    const a = nested('CHALLENGE',type); assert.deepEqual(command(chooseAction(view([a]), startingPolicy())), a.command);
  }
  const p = view([nested('COAST','REVIEW_NEXT_WEEK',{ coastId: 'north' }, { enabled: false, reason: '须原履约后的下一真实周。' }),week]);
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
});

test('injury recovery cannot loop resting an untreated heavy injury or create free clinic care', () => {
  const prep = preferred({ type: 'STABILIZE_PROMOTION', compoundId: 'tyrant-compound-1' });
  const p = view([prep,{ ...clinic, enabled: false },rest,work,week], { health: 70, injuries: [{ severity: 'HEAVY', treatedRevision: null }] });
  p.tyrant.resources.cash = '20便士'; assert.equal(command(chooseAction(p, startingPolicy())).type, 'WORK');
  p.tyrant.actions[1] = clinic; assert.equal(command(chooseAction(p, startingPolicy())).type, 'CLINIC');
  p.injuries[0].treatedRevision = 800; assert.equal(command(chooseAction(p, startingPolicy())).type, 'REST');
});

test('same-week verification reserves actual handoff costs and actions before spending', () => {
  const check = nested('MATERIAL','VERIFY_UNIQUENESS',{ step: 'VACANCY' }, { cost: '1行动、60便士' });
  const take = offer({ type: 'MATERIAL', command: { type: 'ACQUIRE_UNIQUENESS' } }, { enabled: false, cost: '1行动、120便士' });
  const p = view([check,take,week]); p.tyrant.resources.actionsRemaining = 1;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'NEXT_WEEK');
  p.tyrant.resources.actionsRemaining = 2; p.tyrant.resources.cash = '210便士';
  assert.equal(command(chooseAction(p, startingPolicy())).command.step, 'VACANCY');
});

test('current assembled S0 dose is consumed directly and finite epilogue attempts never reroll', () => {
  const dose = preferred({ type: 'CONSUME', compoundId: 'tyrant-compound-1', confirmed: true }, { cost: '0行动' });
  const p = view([dose,rest]); p.tyrant.sections = [{ id: 'promotion-tyrant-carrier-1', lines: ['当前同瓶准备仍有效。'] }]; p.mind = 92;
  assert.equal(command(chooseAction(p, startingPolicy())).type, 'CONSUME');
  p.tyrant.sections = []; assert.equal(chooseAction(p, startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
  const action = nested('EPILOGUE','DIVERT_WATER'); p.tyrant.actions = [action]; p.tyrant.promoted = true;
  const decision = chooseAction(p, startingPolicy()), saved = advancePolicy(decision,p,p);
  assert.deepEqual(saved.epilogueAttempted,['DIVERT_WATER']); assert.throws(() => advancePolicy({ ...decision, policy: saved },p,p));
  p.tyrant.actions = [nested('EPILOGUE','REPORT')]; const report = chooseAction(p,saved);
  assert.equal(chooseAction(p,advancePolicy(report,p,p)).stop,'NATURAL_FINITE_TYRANT_REPORTED');
});

test('repeated clock-only action burning is diagnostic; actual wages/recovery are progress', () => {
  const a = view([preferred({ type: 'REST' })]), b = clone(a); b.actionsRemaining--; b.week++;
  let policy = startingPolicy();
  for (let n = 1; n <= 3; n++) { policy.loop = loopDiagnostic(a,b,policy); assert.equal(policy.loop.repetitions,n); }
  b.cash++; assert.equal(loopDiagnostic(a,b,policy).repetitions,0); b.cash = a.cash; b.health = a.health + 1;
  assert.equal(loopDiagnostic(a,b,policy).repetitions,0);
});

test('public policy never accepts RNG, private source authority or changed control labels', () => {
  const p = view([preferred({ type: 'WORK' })]), d = chooseAction(p,startingPolicy());
  assert(publicActionStillAvailable(p,d.action)); p.tyrant.actions[0].label = '替代按钮'; assert.equal(publicActionStillAvailable(p,d.action),false);
  for (const invalid of [{ random: { seed: 'private', cursor: 1 } },{ source: {} },{ frame: {} },{ journal: [] },{ futureRoll: 1 }])
    assert.throws(() => assertPublicOnly(invalid),/Private/);
  assert.doesNotThrow(() => assertPublicOnly({ source: '公开普通来源', prices: { preparation: 150 } }));
  const state = { random: { seed: 'private-seed' }, tyrant: { actorId: 'private-actor', sourceDigest: 'private-digest' } };
  for (const invalid of [{ actorId: 'private-actor' },{ sourceDigest: 'x' },{ randomBefore: 270 },{ label: 'private-seed' }])
    assert.throws(() => assertGlobalPublic(invalid,state),/private|Private/);
  const projected = capturePublic({ ...view(), random: state.random, secretRoot: { source: {} } });
  assert.equal('random' in projected,false); assert.equal('secretRoot' in projected,false);
});

test('controlled stop options never accept source, seed, resource or strategy overrides', () => {
  assert.equal(parseOptions(['--max-new-actions','0']).maxNewActions,0);
  assert.equal(parseOptions(['--stop-after-command','701']).stopAfterCommand,701);
  const opts = parseOptions(['--resume','/tmp/new215/checkpoint.json.gz','--pause-flag','/tmp/stop']);
  assert.equal(opts.out,'/tmp/new215'); assert.equal(opts.pauseFlag,'/tmp/stop');
  for (const args of [['--seed','other'],['--source','other'],['--strategy','good'],['--cash','9000'],['--max-new-actions','-1'],['--stop-after-command','700'],['--out','/tmp/one','--resume','/tmp/two/checkpoint.json.gz']]) assert.throws(() => parseOptions(args));
});

test('atomic checkpoints recover only exact checksummed successors and preserve incomplete evidence', () => {
  const dir = mkdtempSync(join(tmpdir(),'tyrant-checkpoint-')), path = join(dir,'checkpoint.json.gz');
  try {
    const payload = { format: FORMAT, commandCount: 701, predecessorSha256: null, state: { health: 93 } };
    const first = encodeCheckpoint(payload); writeFileSync(path,gzipSync(first));
    const second = encodeCheckpoint({ ...payload, commandCount: 702, predecessorSha256: decodeCheckpoint(first).sha256 });
    writeFileSync(`${path}.next`,gzipSync(second)); recoverAtomicNext(path); assert.equal(decodeCheckpoint(readFileSync(path)).payload.commandCount,702);
    writeFileSync(`${path}.next`,'incomplete'); recoverAtomicNext(path); assert(existsSync(`${path}.incomplete`));
    const tampered = JSON.parse(first); tampered.payload.state.health = 100; assert.throws(() => decodeCheckpoint(JSON.stringify(tampered)),/checksum/);
    writeFileSync(`${path}.next`,encodeCheckpoint({ ...payload, predecessorSha256: 'unknown' })); assert.throws(() => recoverAtomicNext(path),/Unknown checkpoint successor/);
  } finally { rmSync(dir,{ recursive: true, force: true }); }
});

test('action captures are immutable and resume cannot replace a completed result', () => {
  const dir = mkdtempSync(join(tmpdir(),'tyrant-action-'));
  try {
    const content = { commandCount: 702, beforeLast: { random: { seed: 'same', cursor: 270 } }, final: { random: { seed: 'same', cursor: 270 } } };
    const capture = retainActionCapture(dir,content); assert.equal(capture.file,'action-702.json.gz');
    assert.deepEqual(readCapture(join(dir,capture.file)),content); assert.deepEqual(retainActionCapture(dir,content),capture);
    assert.throws(() => retainActionCapture(dir,{ ...content, final: { altered: true } }),/differs/);
  } finally { rmSync(dir,{ recursive: true, force: true }); }
});

test('first-occurrence selected evidence records S1, grain, actual challenge and real failures', () => {
  const outcome = selectionOutcome(view());
  for (const [intent,key] of [
    [{ type:'THUNDER_GOD',command:{type:'REQUEST_RECOVERY_V1',bottleId:'thunder-god-potion-1'} },'s1-request_recovery_v1'],
    [{ type:'TYRANT',command:{type:'COAST',command:{type:'LOAD_TRANSFER',coastId:'north'}} },'coast-north-load_transfer'],
    [{ type:'TYRANT',command:{type:'CHALLENGE',command:{type:'BREAK_CONTACT'}} },'challenge-break_contact'],
    [{ type:'TYRANT',command:{type:'CONSUME',compoundId:'tyrant-compound-1',confirmed:true} },'tyrant-first-failed-dose']]) {
    assert.equal(selectedBoundary(intent,outcome,[]),key); assert.equal(selectedBoundary(intent,outcome,[{kind:key}]),null);
  }
});

test('source text dispatches strict before entry and owned prepare/snapshot/commit after entry', () => {
  const source = readFileSync(new URL('./tyrant-stage.mjs',import.meta.url),'utf8');
  assert.match(source,/next = runtime\.applySliceIntent\(before, pending\.intent\)/);
  assert.match(source,/if \(next\.tyrant\.guidanceKnown\) session = runtime\.openTyrantRuntimeSession\(next\)/);
  assert.match(source,/draft = session\.prepare\(pending\.intent, before\.revision\)/);
  assert.match(source,/state: next, finalStateSha256/); assert(source.indexOf('pending }, saved.sha256)') < source.indexOf('draft = session.prepare'));
  assert.match(source,/if \(draft\) session\.commit\(draft\)/);
  assert.doesNotMatch(source,/nextInt\(|Math\.random\(|createSliceRun\(|mockImplementation|before\.random\s*=/);
  assert.match(source,/lostOriginal215Restored: false/); assert.match(source,/process\.on\('SIGINT', requestPause\)/);
  assert.match(source,/existsSync\(options\.pauseFlag\)/); assert.match(source,/NATURAL_ACTUAL_TERMINAL/);
  assert.equal(typeof main,'function');
});

function captureFixture() {
  const globalBefore = view([preferred({ type: 'WORK' })]), globalAfter = clone(globalBefore);
  globalAfter.revision++; globalAfter.cash += 180; globalAfter.tyrant.resources.cash = `${globalAfter.cash}便士`;
  const before = capturePublic(globalBefore), after = capturePublic(globalAfter), policyBefore = startingPolicy();
  const decision = chooseAction(before,policyBefore), policyAfter = advancePolicy(decision,after,before);
  const beforeLast = { random: { seed: 'private-test-seed', cursor: 270 } }, final = clone(beforeLast);
  const row = { commandCount: 702, intent: clone(decision.action.intent), commandSha256: digest(decision.action.intent),
    reason: decision.reason, publicLabel: decision.action.label, publicCost: decision.action.cost,
    startedAt: '2026-10-18T00:00:00.000Z', elapsedMilliseconds: 0, revision: 703, week: 169,
    beforeStateSha256: stateHash(beforeLast), afterStateSha256: stateHash(final),
    publicBeforeSha256: stateHash(before), publicAfterSha256: stateHash(after),
    globalPublicBeforeSha256: stateHash(globalBefore), globalPublicAfterSha256: stateHash(globalAfter),
    selectionOutcome: selectionOutcome(after), randomBefore: clone(beforeLast.random), randomAfter: clone(final.random),
    randomBeforeSha256: stateHash(beforeLast.random), randomAfterSha256: stateHash(final.random),
    policyBeforeSha256: stateHash(policyBefore), policyAfterSha256: stateHash(policyAfter), receipts: {} };
  const content = { commandCount: 702, beforeLast, final, lastIntent: clone(row.intent),
    randomBefore: clone(row.randomBefore), randomAfter: clone(row.randomAfter), publicBefore: before, public: after,
    globalPublicBefore: globalBefore, globalPublic: globalAfter, policyBefore, policyAfter,
    audit: { ...clone(row), elapsedMilliseconds: null } };
  row.capture = { file: 'action-702.json.gz', bytes: 100, sha256: 'a'.repeat(64) };
  return { row,content };
}

test('every retained action rederives its exact public decision and both policy states', () => {
  const { row,content } = captureFixture(); assert.doesNotThrow(() => verifyActionCapture(content,row));
  for (const mutate of [x => x.public.tyrant.actions[0].label = 'tampered',x => x.policyBefore.s1Doses++,
    x => x.policyAfter.reported = true,x => x.final.random.cursor++,x => x.lastIntent.command.type = 'REST']) {
    const bad = clone(content); mutate(bad); assert.throws(() => verifyActionCapture(bad,row));
  }
  const forged = clone(content), forgedRow = clone(row);
  forged.publicBefore.tyrant.actions[0].enabled = false; forged.globalPublicBefore.tyrant.actions[0].enabled = false;
  forgedRow.publicBeforeSha256 = stateHash(forged.publicBefore); forgedRow.globalPublicBeforeSha256 = stateHash(forged.globalPublicBefore);
  assert.throws(() => verifyActionCapture(forged,forgedRow),/Retained action|public|frozen/);
});

test('checkpoint verification links initial state through commands, RNG, public data and policy', () => {
  const state = { week: 169, random: { seed: 'private-test-seed', cursor: 270 } }, hash = stateHash(state), p = view();
  const freeze = { sha256: 'a'.repeat(64) }, input = { sha256: 'b'.repeat(64) }, publicHash = stateHash(p);
  const payload = { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    runtimeFreezeSha256: freeze.sha256, inputFreezeSha256: input.sha256, policyDefinition: POLICY,
    initialStateSha256: hash, finalStateSha256: hash, initialPublicSha256: publicHash, publicStateSha256: publicHash,
    initialGlobalPublicSha256: publicHash, globalPublicStateSha256: publicHash, initialRandomSha256: stateHash(state.random),
    migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: hash, fromSchema: 190, toSchema: 212 },
    commandCount: 701, commands: [], rows: [], boundaries: [], state, policy: startingPolicy(), pending: null };
  assert.doesNotThrow(() => verifyCheckpoint(payload,freeze,hash,input));
  for (const mutate of [x => x.commandCount++,x => x.policy.s1Doses++,x => x.state.random.cursor++,
    x => x.migration.fromSchema = 189,x => x.inputFreezeSha256 = 'other',x => x.prefixSha256 = 'other',
    x => x.boundaries.push({ kind: 'invented', commandCount: 702 })]) {
    const bad = clone(payload); mutate(bad); assert.throws(() => verifyCheckpoint(bad,freeze,hash,input));
  }
  const pending = clone(payload); pending.pending = { commandCount: 702, beforeStateSha256: hash, publicBeforeSha256: publicHash,
    globalPublicBeforeSha256: publicHash, policyBeforeSha256: stateHash(payload.policy), randomBeforeSha256: stateHash(state.random),
    intent: { type: 'TYRANT', command: { type: 'WORK' } }, decision: { action: { intent: { type: 'TYRANT', command: { type: 'WORK' } } } } };
  assert.doesNotThrow(() => verifyCheckpoint(pending,freeze,hash,input)); pending.pending.randomBeforeSha256 = 'changed';
  assert.throws(() => verifyCheckpoint(pending,freeze,hash,input));
});
