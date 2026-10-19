import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { SOURCE, SOURCE_SHA256, HISTORY, HISTORY_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY,
  WORKS_PLAN, MATERIAL_PLAN, startingPolicy, chooseAction, advancePolicy, parseOptions,
  stateHash, encodeCheckpoint, decodeCheckpoint, recoverAtomicNext, verifyCheckpoint, readSource, main,
} from './perfecter-stage.mjs';

// Producer-only contracts. No game import, runtime/build, natural route, seed
// search or fixture write occurs. Filesystem cases use disposable checkpoints.
const clone = value => structuredClone(value);
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, options = {}) => ({ id: 'public-action', label: '公开行动', cost: '1行动、0便士', enabled: true, reason: null, command, ...options });
const view = (actions, options = {}) => ({ guidanceKnown: true, promoted: false, insideCase: false,
  resources: { health: 100, mind: 100, spirituality: 120, cash: '2000便士', actionsRemaining: 3 },
  sections: [{ id: 'injuries', lines: ['当前没有实际伤势。'] }], actions, ...options });
const phase = (name, extra = {}) => ({ ...startingPolicy(), phase: name, ...extra });
const material = (type, extra = {}) => ({ type: 'MATERIAL', command: { type, ...extra } });
const epilogue = type => ({ type: 'EPILOGUE', command: { type } });
const work = offer({ type: 'WORK' }, { cost: '1行动；180便士，每周一次' });
const rest = offer({ type: 'REST' });
const clinic = offer({ type: 'CLINIC' }, { cost: '1行动、60便士；之后仍须休养' });
const wait = offer({ type: 'NEXT_WEEK' }, { cost: '放弃本周余下行动，实际支付生活费与约定还款' });
const compoundId = 'perfecter-compound-1';
const dose = offer({ type: 'CONSUME', compoundId, confirmed: true }, { cost: '1行动、30灵性；失败可能重伤、污染或死亡' });
const prepare = offer({ type: 'STABILIZE_PROMOTION', compoundId }, { cost: '1行动、100便士、12灵性、8精神' });
const readyView = (extraActions = []) => {
  const result = view([{ ...dose, preferredAction: true }, { ...prepare, enabled: false, reason: '同一瓶在本次准备时段的稳定准备已经完成。' }, ...extraActions]);
  result.sections.push({ id: 'promotion-stability', lines: ['这份成药当前成功率70%；完成实际稳定准备后70%。当前准备仍有效。'] });
  return result;
};
const freezeDeep = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
};

test('exact original living797 bytes, command prefix, identity and injuries remain pinned', () => {
  assert.equal(SOURCE, 'tests/fixtures/civilization-enlightener-v01890/natural.json');
  assert.equal(HISTORY, SOURCE); assert.equal(HISTORY_SHA256, SOURCE_SHA256);
  assert.equal(SOURCE_SHA256, '5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f');
  assert.equal(PREFIX_COUNT, 797);
  assert.equal(PREFIX_SHA256, '3c5d52d10c731b2664f324a27ed5544623af38a66b38a4debdde50a9c62af565');
  const old = readSource();
  assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.equal(old.source.status, 'ACTIVE'); assert.equal(old.source.week, 188);
  assert.equal(old.source.revision, 798); assert.equal(old.source.cash, 436);
  assert.deepEqual(old.source.random, { seed: 'savant-rebuild-first', cursor: 346 });
  assert.deepEqual(old.source.injuries.map(injury => injury.severity), ['LIGHT', 'HEAVY']);
  assert.equal(Object.values(old.source.progression.mastery).filter(value => value === 0).length, 8);
  assert.equal(POLICY.noReroll, true);
});

test('public selection is deterministic, immutable and cannot read private state or future randomness', () => {
  const target = WORKS_PLAN[1], publicView = view([offer(target), wait]);
  for (const key of ['state', 'random', 'seed', 'cursor', 'journal', 'perfecter', 'futureRoll'])
    Object.defineProperty(publicView, key, { get() { throw new Error(`Private ${key} must not enter public policy`); } });
  freezeDeep(publicView);
  const policy = freezeDeep(phase('WORKS', { step: 1 }));
  const first = chooseAction(publicView, policy), second = chooseAction(publicView, policy);
  assert.deepEqual(first, second); assert.deepEqual(first.action.command, target);
  assert.notEqual(first.action, publicView.actions[0]); assert.notEqual(first.policy, policy);
  assert.equal(policy.step, 1); assert.equal(first.advanceStep, true);
});

test('only offered enabled actions are selected, and guidance precedes wages', () => {
  const learn = offer({ type: 'LEARN_GUIDANCE' }, { cost: '1行动、100便士' });
  assert.deepEqual(chooseAction(view([work, learn], { guidanceKnown: false }), startingPolicy()).action.command, learn.command);
  const target = WORKS_PLAN[1], blocked = offer(target, { enabled: false, reason: '真实装置不可用。' });
  assert.equal(chooseAction(view([blocked, wait]), phase('WORKS', { step: 1 })).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(chooseAction(view([wait]), phase('WORKS', { step: 1 })).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('actual clinic and rest preserve the original wounds, wage and weekly budget policy', () => {
  const injured = view([work, clinic, rest, wait]);
  injured.resources.health = 60;
  injured.sections[0].lines = ['轻伤：尚未处置。', '重伤：尚未处置。'];
  assert.equal(chooseAction(injured, phase('HEAL')).action.command.type, 'WORK');
  injured.actions = [clinic, rest, wait];
  assert.equal(chooseAction(injured, phase('HEAL')).action.command.type, 'CLINIC');
  injured.actions = [rest, wait];
  assert.equal(chooseAction(injured, phase('HEAL')).action.command.type, 'REST');
  assert.deepEqual(injured.sections[0].lines, ['轻伤：尚未处置。', '重伤：尚未处置。']);
});

test('three actual stations get ordered repair and independent trials before later verification', () => {
  const stations = ['ARCHIVE', 'WORKSHOP', 'SOUTH_BANK'];
  for (const [index, station] of stations.entries()) {
    assert.deepEqual(WORKS_PLAN.slice(index * 6, index * 6 + 6).map(action => action.command.type),
      ['WORKS_TRAVEL', 'WORKS_INSPECT', 'WORKS_BUY_PARTS', 'WORKS_REPAIR', 'WORKS_CALIBRATE', 'WORKS_TRIAL']);
    assert(WORKS_PLAN.slice(index * 6, index * 6 + 6).every(action => action.command.stationId === station));
  }
  assert.deepEqual(WORKS_PLAN.slice(18, 24).map(action => action.command.type),
    ['WORKS_TRAVEL', 'WORKS_VERIFY', 'WORKS_TRAVEL', 'WORKS_VERIFY', 'WORKS_TRAVEL', 'WORKS_VERIFY']);
  assert.deepEqual(WORKS_PLAN.at(-1), { type: 'TRAVEL', to: 'backlund:civic-repair-workshop' });
});

test('real two-week service wait preserves the intended verification step and public clock', () => {
  const step = WORKS_PLAN.findIndex(action => action.command?.type === 'WORKS_VERIFY');
  const blocked = offer(WORKS_PLAN[step], { enabled: false, reason: '还需等到第210周，再查验两周实际服务的原记录。' });
  const decision = chooseAction(view([blocked, wait]), phase('WORKS', { step, week: 209 }));
  assert.equal(decision.action.command.type, 'NEXT_WEEK'); assert.equal(decision.advanceStep, false);
  const after = advancePolicy(decision, view([]));
  assert.equal(after.week, 210); assert.equal(after.step, step);
  assert.deepEqual(chooseAction(view([offer(WORKS_PLAN[step])]), after).action.command, WORKS_PLAN[step]);
  blocked.reason = '三次实际运行及居民结果已经核验，记录仍然有效。';
  assert.equal(chooseAction(view([blocked, wait]), after).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('material plan uses ten distinct original labour tasks, original custody and a paid ordinary carrier', () => {
  const labour = MATERIAL_PLAN.filter(action => action.command?.type === 'MATERIAL_LABOUR');
  assert.equal(labour.length, 10); assert.equal(new Set(labour.map(action => JSON.stringify(action))).size, 10);
  assert.deepEqual([...new Set(labour.map(action => action.command.bottleId))], ['civilization-enlightener-potion-2', 'civilization-enlightener-potion-3']);
  assert.deepEqual(MATERIAL_PLAN.filter(action => action.command?.type === 'VERIFY_UNIQUENESS').map(action => action.command.step), ['CHAIN', 'VACANCY', 'SEAL']);
  assert.equal(MATERIAL_PLAN.filter(action => action.command?.type === 'BUY_COMPOUND').length, 1);
  assert.deepEqual(MATERIAL_PLAN.at(-1), material('COMPOSE_POTION', { batchId: 'perfecter-carrier-1' }));
});

test('final uniqueness seal reserves publicly priced same-week delivery and living costs', () => {
  const step = MATERIAL_PLAN.findIndex(action => action.command?.type === 'VERIFY_UNIQUENESS' && action.command.step === 'SEAL');
  const seal = offer(MATERIAL_PLAN[step], { cost: '1行动 · 100便士' });
  const handoff = offer(material('ACQUIRE_UNIQUENESS'), { cost: '1行动 · 1600便士', enabled: false, reason: '先完成同一唯一性三步实地查验。' });
  const current = view([seal, handoff, wait]); current.resources.actionsRemaining = 1;
  assert.equal(chooseAction(current, phase('MATERIALS', { step })).action.command.type, 'NEXT_WEEK');
  current.resources.actionsRemaining = 2; current.resources.cash = '1729便士';
  assert.equal(chooseAction(current, phase('MATERIALS', { step })).action.command.type, 'NEXT_WEEK');
  current.resources.cash = '1730便士';
  assert.deepEqual(chooseAction(current, phase('MATERIALS', { step })).action.command, seal.command);
  current.actions.unshift(work);
  assert.equal(chooseAction(current, phase('MATERIALS', { step })).action.command.type, 'WORK');
  const expired = offer(handoff.command, { cost: handoff.cost, enabled: false, reason: '封签与当代空位核验过期；交付须紧接本周最后查验。' });
  assert.equal(chooseAction(view([expired, wait]), phase('MATERIALS', { step: step + 1 })).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('enabled unprepared consumption never bypasses paid same-bottle preparation', () => {
  const current = view([dose, prepare, wait]);
  const decision = chooseAction(current, phase('PROMOTE'));
  assert.deepEqual(decision.action.command, prepare.command);
  current.resources.actionsRemaining = 1;
  assert.equal(chooseAction(current, phase('PROMOTE')).action.command.type, 'NEXT_WEEK');
  assert.equal(chooseAction(view([dose, wait]), phase('PROMOTE')).stop, 'PUBLIC_ACTION_BLOCKED');
  const blocked = { ...prepare, enabled: false, reason: '须先亲自完成三站修理、成年人独立操作试验、至少两周真实运行与结果核验。' };
  assert.equal(chooseAction(view([dose, blocked, wait]), phase('PROMOTE')).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('effective paid same-bottle consumption beats work and rest despite preparation resource costs', () => {
  const current = readyView([work, rest, wait]);
  Object.assign(current.resources, { mind: 92, spirituality: 108, actionsRemaining: 1 });
  assert.deepEqual(chooseAction(current, phase('PROMOTE')).action.command, dose.command);
  assert.deepEqual(chooseAction(current, phase('MATERIALS', { step: MATERIAL_PLAN.length })).action.command, work.command);
  current.actions = current.actions.filter(action => action.command.type !== 'WORK');
  assert.deepEqual(chooseAction(current, phase('MATERIALS', { step: MATERIAL_PLAN.length })).action.command, dose.command);
});

test('prepared marker must bind to the same compound and an effective public preparation', () => {
  for (const mutate of [
    current => { current.actions[1].command = { type: 'STABILIZE_PROMOTION', compoundId: 'perfecter-compound-2' }; },
    current => { current.actions[1].enabled = true; },
    current => { current.sections = current.sections.filter(section => section.id !== 'promotion-stability'); },
  ]) {
    const current = readyView([work, rest, wait]); mutate(current);
    assert.equal(chooseAction(current, phase('PROMOTE')).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
  }
  const current = readyView([wait]); current.actions[0].enabled = false; current.resources.actionsRemaining = 0;
  assert.equal(chooseAction(current, phase('PROMOTE')).action.command.type, 'NEXT_WEEK');
});

test('actual failed dose stays recorded and pays professional recovery of exactly its original remains', () => {
  const prior = phase('PROMOTE'), decision = chooseAction(readyView(), prior);
  const failed = advancePolicy(decision, view([]));
  assert.equal(prior.doses, 0); assert.equal(failed.doses, 1); assert.equal(failed.phase, 'RECOVERY');
  assert.equal(failed.failedCompoundId, compoundId); assert.equal(failed.recoveryStep, 0);
  const seal = offer(material('SEAL_REMAINS', { compoundId, method: 'PROFESSIONAL' }), { cost: '2行动 · 260便士' });
  const ability = offer(material('SEAL_REMAINS', { compoundId, method: 'ABILITY' }), { cost: '1行动 · 60便士 · 6灵性 · 2精神' });
  const selected = chooseAction(view([ability, seal, wait]), failed);
  assert.deepEqual(selected.action.command, seal.command);
  const sealed = advancePolicy(selected, view([]));
  const recover = offer(material('RECOVER_SEALED', { compoundId }), { cost: '1行动 · 100便士' });
  assert.deepEqual(chooseAction(view([recover, wait]), sealed).action.command, recover.command);
  const recovered = advancePolicy(chooseAction(view([recover]), sealed), view([]));
  assert.deepEqual(chooseAction(view([clinic, rest, wait]), recovered).action.command, clinic.command);
  const injured = view([rest, wait]); injured.resources.health = 60;
  assert.equal(chooseAction(injured, { ...recovered, recoveryStep: 3 }).action.command.type, 'REST');
  const saved = decodeCheckpoint(encodeCheckpoint({ format: FORMAT, policy: failed, pending: { intent: { type: 'PERFECTER', command: seal.command } } }));
  assert.deepEqual(saved.payload.policy, failed);
});

test('recovery buys real next carriers then pays bounded same-container refill rather than resetting attempts', () => {
  for (const doses of [1, 2]) {
    const command = material('BUY_COMPOUND', { batchId: `perfecter-carrier-${doses + 1}` });
    assert.deepEqual(chooseAction(view([offer(command)]), phase('RECOVERY', { doses, failedCompoundId: compoundId, recoveryStep: 4 })).action.command, command);
  }
  const refill = material('REQUEST_COMPOUND_REPAIR', { batchId: 'perfecter-carrier-1' });
  const receive = material('RECEIVE_COMPOUND_REPAIR', { batchId: 'perfecter-carrier-1' });
  const policy = phase('RECOVERY', { doses: 3, failedCompoundId: 'perfecter-compound-3', recoveryStep: 4 });
  assert.deepEqual(chooseAction(view([offer(refill, { cost: '1行动 · 220便士' })]), policy).action.command, refill);
  const delayed = offer(receive, { cost: '1行动 · 100便士', enabled: false, reason: '须下单并经过下一真实周，才能实际领取新普通药液。' });
  assert.equal(chooseAction(view([delayed, wait]), { ...policy, recoveryStep: 5 }).action.command.type, 'NEXT_WEEK');
  const depleted = offer(refill, { cost: '1行动 · 220便士', enabled: false, reason: '当前没有可用余量。' });
  assert.equal(chooseAction(view([depleted, wait]), policy).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('public committed travel and ordinary waits update location and week without consulting state', () => {
  const prior = phase('WORKS', { week: 200, step: 0 });
  const travel = advancePolicy({ policy: prior, action: offer(WORKS_PLAN[0]), advanceStep: true }, view([]));
  assert.equal(travel.location, 'backlund:old-civic-archive'); assert.equal(travel.week, 200); assert.equal(travel.step, 1);
  const ordinary = advancePolicy({ policy: travel, action: offer({ type: 'RETURN_ON_FOOT' }) }, view([]));
  assert.equal(ordinary.location, 'backlund:civic-repair-workshop');
  assert.equal(advancePolicy({ policy: ordinary, action: wait }, view([])).week, 201);
  assert.deepEqual(prior, phase('WORKS', { week: 200, step: 0 }));
});

test('ordinary isolation before evacuation protects the remaining action after finite failed techniques', () => {
  const techniques = [offer(epilogue('CONTAIN_FLOW')), offer(epilogue('RECONSTRUCT_MODEL'))];
  const isolate = offer(epilogue('ISOLATE'), { cost: '0行动，普通机械处置' });
  const evacuate = offer(epilogue('EVACUATE'));
  const withdraw = offer(epilogue('WITHDRAW'), { cost: '0行动，保留费用、伤势与尚未完成的救援' });
  const current = view([...techniques, evacuate, isolate, withdraw], { promoted: true, insideCase: true });
  assert.deepEqual(chooseAction(current, phase('EPILOGUE')).action.command, techniques[0].command);
  current.resources.actionsRemaining = 1; current.resources.health = 64;
  let policy = phase('EPILOGUE', { epilogueAttempted: ['OBSERVE', 'CONTAIN_FLOW', 'RECONSTRUCT_MODEL'] });
  const selected = chooseAction(current, policy);
  assert.deepEqual(selected.action.command, isolate.command);
  policy = advancePolicy(selected, current); current.actions = [evacuate, withdraw];
  assert.deepEqual(chooseAction(current, policy).action.command, evacuate.command);
  current.actions = [withdraw]; current.resources.actionsRemaining = 0;
  assert.deepEqual(chooseAction(current, policy).action.command, withdraw.command);
  assert.equal(current.resources.health, 64);
});

test('one real epilogue reserves three actions, reports actual results and never reopens the scene', () => {
  const current = view([offer({ type: 'START_EPILOGUE' }, { cost: '0行动' }), wait], { promoted: true });
  const policy = phase('EPILOGUE', { location: 'backlund:old-civic-archive' });
  current.resources.actionsRemaining = 2;
  assert.equal(chooseAction(current, policy).action.command.type, 'NEXT_WEEK');
  current.resources.actionsRemaining = 3;
  assert.equal(chooseAction(current, policy).action.command.type, 'START_EPILOGUE');
  const report = offer(epilogue('REPORT'), { cost: '0行动，只记录实际应用与结果' });
  current.actions = [work, report]; current.resources.health = 44;
  const selected = chooseAction(current, policy); assert.deepEqual(selected.action.command, report.command);
  const reported = advancePolicy(selected, current);
  assert.equal(chooseAction(current, reported).stop, 'NATURAL_ARCHIVE_REPORTED');
});

test('command line permits only a resumable observation limit, never seed/source/result search', () => {
  assert.equal(parseOptions([]).maxNewActions, 500); assert.equal(parseOptions(['--max-new-actions', '0']).maxNewActions, 0);
  for (const flag of ['--seed', '--source', '--cash', '--cursor', '--roll', '--strategy', '--force', '--outcome'])
    assert.throws(() => parseOptions([flag, '1']), /Unsupported/);
  for (const value of ['-1', '1.5', 'NaN', '9007199254740992']) assert.throws(() => parseOptions(['--max-new-actions', value]));
  assert.throws(() => parseOptions(['--max-new-actions', '1', '--max-new-actions', '2']), /Duplicate/);
  assert.throws(() => parseOptions(['--out']), /Missing value/);
  const path = resolve('output/play/perfecter-contract/checkpoint.json');
  assert.equal(parseOptions(['--resume', path]).out, dirname(path));
  assert.throws(() => parseOptions(['--resume', path, '--out', '/tmp/other-capture']), /exact output directory/);
});

function initialCheckpoint() {
  const state = { week: 188, random: { seed: 'savant-rebuild-first', cursor: 346 } };
  const publicView = view([offer({ type: 'LEARN_GUIDANCE' })], { guidanceKnown: false });
  const policy = startingPolicy(), hash = stateHash(state), publicHash = stateHash(publicView);
  const payload = { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, historySha256: HISTORY_SHA256,
    prefixSha256: PREFIX_SHA256, freezeSha256: 'synthetic-producer-only-freeze', policyDefinition: POLICY,
    policy, commandCount: PREFIX_COUNT, commands: [], rows: [], state, initialStateSha256: hash,
    finalStateSha256: hash, initialPublicSha256: publicHash, publicStateSha256: publicHash,
    initialRandomSha256: stateHash(state.random), pending: null };
  const decision = chooseAction(publicView, policy);
  payload.pending = { commandCount: PREFIX_COUNT + 1, intent: { type: 'PERFECTER', command: clone(decision.action.command) },
    decision, beforeStateSha256: hash, publicBeforeSha256: publicHash, policyBeforeSha256: stateHash(policy) };
  return { payload, freeze: { sha256: payload.freezeSha256 }, initialHash: hash };
}

test('pending checkpoint binds the exact command, public boundary, policy and unchanged RNG', () => {
  const { payload, freeze, initialHash } = initialCheckpoint();
  verifyCheckpoint(payload, freeze, initialHash);
  const restored = decodeCheckpoint(encodeCheckpoint(payload)).payload;
  assert.deepEqual(restored.pending, payload.pending); assert.deepEqual(restored.state.random, payload.state.random);
  for (const mutate of [
    candidate => { candidate.pending.commandCount++; },
    candidate => { candidate.pending.intent.command = { type: 'NEXT_WEEK' }; },
    candidate => { candidate.pending.beforeStateSha256 = 'different-state'; },
    candidate => { candidate.pending.publicBeforeSha256 = 'different-public'; },
    candidate => { candidate.pending.policyBeforeSha256 = 'different-policy'; },
    candidate => { candidate.state.random.cursor++; },
    candidate => { candidate.freezeSha256 = 'different-runtime'; },
    candidate => { candidate.sourceSha256 = 'different-source'; },
    candidate => { candidate.prefixSha256 = 'different-prefix'; },
  ]) { const candidate = clone(payload); mutate(candidate); assert.throws(() => verifyCheckpoint(candidate, freeze, initialHash)); }
});

test('checkpoint checksum and complete atomic successors retain pending or completed failures exactly', () => {
  const directory = mkdtempSync(join(tmpdir(), 'perfecter-producer-contract-')), path = join(directory, 'checkpoint.json');
  try {
    const { payload } = initialCheckpoint();
    const text = encodeCheckpoint({ ...payload, predecessorSha256: null }); writeFileSync(path, text);
    const previous = decodeCheckpoint(text);
    const failed = { format: FORMAT, predecessorSha256: previous.sha256,
      policy: phase('RECOVERY', { doses: 1, failedCompoundId: compoundId }),
      actualFailure: { tier: 'FAILURE', costPaid: true, heavyInjuryRetained: true }, pending: null };
    writeFileSync(`${path}.next`, encodeCheckpoint(failed)); recoverAtomicNext(path);
    assert.deepEqual(decodeCheckpoint(readFileSync(path, 'utf8')).payload, failed);
    assert.equal(existsSync(`${path}.next`), false);
    const forged = JSON.parse(text); forged.payload.pending.intent.command = { type: 'NEXT_WEEK' };
    assert.throws(() => decodeCheckpoint(JSON.stringify(forged)), /checksum/);
    writeFileSync(`${path}.next`, '{incomplete'); recoverAtomicNext(path);
    assert.equal(readFileSync(`${path}.incomplete`, 'utf8'), '{incomplete');
    assert.deepEqual(decodeCheckpoint(readFileSync(path, 'utf8')).payload, failed);
    writeFileSync(`${path}.next`, encodeCheckpoint({ format: FORMAT, predecessorSha256: 'unknown', pending: null }));
    assert.throws(() => recoverAtomicNext(path), /Unknown checkpoint successor/);
    assert.equal(existsSync(`${path}.next`), true);
    assert.deepEqual(decodeCheckpoint(readFileSync(path, 'utf8')).payload, failed);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('capture orchestration saves pending before prepare and completed draft before commit', () => {
  // Static ordering protects the import-safe durable orchestrator without
  // loading a domain runtime or executing the natural campaign for this suite.
  const source = main.toString();
  const pending = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...boundary, pending }');
  const selection = source.indexOf('assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision');
  const prepareDraft = source.indexOf('draft = session.prepare(pending.intent, before.revision)');
  const completeDraft = source.indexOf('saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next');
  const commit = source.indexOf('if (draft) session.commit(draft)');
  assert(pending >= 0 && pending < selection && selection < prepareDraft && prepareDraft < completeDraft && completeDraft < commit);
  assert.match(source, /if \(!boundary\.pending && count >= options\.maxNewActions\)/);
  assert.match(source, /if \(!paused && !saved\.payload\.terminal\)/);
  assert.match(source, /assert\.deepEqual\(JSON\.parse\(readFileSync\(freezePath, 'utf8'\)\), freeze/);
  assert.match(source, /resumeExactPendingRequired: true/);
});
