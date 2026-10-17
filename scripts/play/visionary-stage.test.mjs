import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POLICY, SOURCE_SHA256, HISTORY_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT,
  MATERIAL_PLAN, SURVEY_PLAN, DEPLOY_PLAN, startingPolicy, chooseAction, advancePolicy,
  parseOptions, stateHash, encodeCheckpoint, decodeCheckpoint, recoverAtomicNext, readSource } from './visionary-stage.mjs';

// Producer-only contracts. Importing this suite never imports/executes the game,
// runs a natural route, builds, chooses a seed or modifies the original fixtures.
const offer = (command, options = {}) => ({ id: 'public-action', label: '公开行动', cost: '1行动、0便士', enabled: true, reason: null, command, ...options });
const view = (actions, options = {}) => ({ guidanceKnown: true, promoted: false, insideCase: false,
  resources: { health: 100, mind: 100, spirituality: 120, cash: '2000便士', actionsRemaining: 3 },
  sections: [{ id: 'injuries', lines: ['当前没有实际伤势。'] }], actions, ...options });
const phase = (name, extra = {}) => ({ ...startingPolicy(), phase: name, ...extra });
const work = offer({ type: 'WORK' });
const wait = offer({ type: 'NEXT_WEEK' }, { cost: '放弃本周余下行动，实际支付生活费与旧约还款' });

test('exact living659 source and independent dead667 remain separately pinned', () => {
  assert.equal(PREFIX_COUNT, 659); assert.match(SOURCE_SHA256, /^[a-f0-9]{64}$/);
  assert.match(HISTORY_SHA256, /^[a-f0-9]{64}$/); assert.match(PREFIX_SHA256, /^[a-f0-9]{64}$/);
  const old = readSource();
  assert.equal(old.commands.length, 659); assert.equal(old.source.status, 'ACTIVE');
  assert.equal(old.source.week, 144); assert.equal(old.source.cash, 400);
  assert.equal(old.source.injuries.length, 0); assert.equal(old.source.random.cursor, 480);
});
test('fixed plan interleaves original wages with ten distinct material labour tasks', () => {
  const labour = MATERIAL_PLAN.filter(c => c.command?.type === 'MATERIAL_LABOUR');
  assert.equal(labour.length, 10); assert.equal(new Set(labour.map(c => JSON.stringify(c))).size, 10);
  assert.deepEqual([...new Set(labour.map(c => c.command.bottleId))], ['writer-potion-2', 'writer-potion-3']);
  const target = MATERIAL_PLAN[2], p = phase('MATERIALS', { step: 2 });
  assert.deepEqual(chooseAction(view([work, offer(target), wait]), p).action.command, { type: 'WORK' });
  const decision = chooseAction(view([offer(target), wait]), p);
  assert.deepEqual(decision.action.command, target); assert.equal(decision.advanceStep, true);
  assert.equal(p.step, 2, 'Selection does not mutate its predecessor');
});
test('reserve follows material work rather than a 35-week idle prefix', () => {
  assert.equal(POLICY.tourReserve, 1200); assert.equal(POLICY.stabilityReserve, 100);
  const p = phase('RESERVE');
  const v = view([offer(SURVEY_PLAN[0]), wait]); v.resources.cash = '1299便士';
  assert.equal(chooseAction(v, p).action.command.type, 'NEXT_WEEK');
  v.resources.cash = '1300便士';
  assert.deepEqual(chooseAction(v, p).action.command, SURVEY_PLAN[0]);
});
test('all six surveys precede forecast and all real pilots/connect/adopt follow it', () => {
  assert.deepEqual(MATERIAL_PLAN[0], { type: 'ERA', command: { type: 'ERA_SURVEY', cityId: 'BACKLUND' } });
  assert.equal(SURVEY_PLAN.filter(c => c.command?.type === 'ERA_SURVEY').length, 5);
  assert.equal(SURVEY_PLAN.at(-1).command.type, 'ERA_FORECAST');
  assert(!SURVEY_PLAN.some(c => ['ERA_PILOT', 'ERA_CONNECT', 'ERA_ADOPT'].includes(c.command.type)));
  for (const type of ['ERA_PILOT', 'ERA_CONNECT']) assert.equal(DEPLOY_PLAN.filter(c => c.command.type === type).length, 6);
  assert.equal(DEPLOY_PLAN.filter(c => c.command.type === 'ERA_ADOPT').length, 4);
});
test('uniqueness final seal keeps funds and actions for same-week actual handoff', () => {
  const step = MATERIAL_PLAN.findIndex(c => c.command?.type === 'VERIFY_UNIQUENESS' && c.command.step === 'SEAL');
  const v = view([offer(MATERIAL_PLAN[step]), wait]);
  v.resources.actionsRemaining = 1;
  assert.equal(chooseAction(v, phase('MATERIALS', { step })).action.command.type, 'NEXT_WEEK');
  v.resources.actionsRemaining = 2; v.resources.cash = '1729便士';
  assert.equal(chooseAction(v, phase('MATERIALS', { step })).action.command.type, 'NEXT_WEEK');
  v.resources.cash = '1730便士';
  assert.deepEqual(chooseAction(v, phase('MATERIALS', { step })).action.command, MATERIAL_PLAN[step]);
});
test('same-compound paid stability is selected before the first enabled dose', () => {
  const dose = offer({ type: 'CONSUME', compoundId: 'visionary-compound-1', confirmed: true });
  const prep = offer({ type: 'STABILIZE_PROMOTION', compoundId: 'visionary-compound-1' });
  const p = phase('WINDOW', { week: 210, location: 'backlund:ritual-workshop' });
  assert.equal(chooseAction(view([dose, prep, wait]), p).action.command.type, 'STABILIZE_PROMOTION');
  const ready = view([{ ...dose, preferredAction: true }, { ...prep, enabled: false, reason: '同一瓶在本季度窗口的稳定准备已经完成。' }, work, wait]);
  ready.sections.push({ id: 'promotion-stability', lines: ['这份原成药当前成功率70%；当前准备仍有效。'] });
  assert.equal(chooseAction(ready, p).action.command.type, 'CONSUME');
  ready.actions[1].command.compoundId = 'visionary-compound-2';
  assert.equal(chooseAction(ready, p).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
});
test('current real incidents take priority over wages before their fixed deadlines', () => {
  const respond = { type: 'ERA', command: { type: 'ERA_RESPOND', incidentId: 'tingen-rail', mode: 'COORDINATED' } };
  assert.deepEqual(chooseAction(view([work, offer(respond), wait]), phase('WINDOW', { week: 205 })).action.command, respond);
  assert.equal(chooseAction(view([work, offer(respond), wait]), phase('WINDOW', { week: 206 })).action.command.type, 'WORK');
});
test('clock and progress are derived from displayed committed travel, never private RNG', () => {
  const action = offer({ type: 'ERA', command: { type: 'ERA_TRAVEL', cityId: 'TRIER' } }, { cost: '1行动、12便士、实际2周，另结生活和还款' });
  const p = phase('SURVEY', { week: 180, step: 4 });
  const next = advancePolicy({ policy: p, action, advanceStep: true }, view([]));
  assert.equal(next.week, 182); assert.equal(next.location, 'trier:relay-station'); assert.equal(next.step, 5);
  assert.deepEqual(p, phase('SURVEY', { week: 180, step: 4 }));
});
test('a real failure starts professional same-original recovery without erasing the dose', () => {
  const command = { type: 'CONSUME', compoundId: 'visionary-compound-1', confirmed: true };
  const p = advancePolicy({ policy: phase('WINDOW', { week: 210 }), action: offer(command) }, view([]));
  assert.equal(p.doses, 1); assert.equal(p.phase, 'RECOVERY'); assert.equal(p.failedCompoundId, command.compoundId);
  const seal = { type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: command.compoundId, method: 'PROFESSIONAL' } };
  assert.deepEqual(chooseAction(view([offer(seal), wait]), p).action.command, seal);
});
test('short rescue preserves ordinary evacuation and zero-action withdrawal', () => {
  const support = offer({ type: 'EPILOGUE', command: { type: 'SUPPORT_STRUCTURE' } });
  const guide = offer({ type: 'EPILOGUE', command: { type: 'GUIDE_RESCUER' } });
  const evacuate = offer({ type: 'EPILOGUE', command: { type: 'EVACUATE' } });
  const withdraw = offer({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } }, { cost: '0行动' });
  const v = view([support, guide, evacuate, withdraw], { promoted: true, insideCase: true });
  assert.equal(chooseAction(v, phase('EPILOGUE')).action.command.command.type, 'SUPPORT_STRUCTURE');
  v.resources.actionsRemaining = 1;
  assert.equal(chooseAction(v, phase('EPILOGUE')).action.command.command.type, 'EVACUATE');
  v.actions = [withdraw]; v.resources.actionsRemaining = 0;
  assert.equal(chooseAction(v, phase('EPILOGUE')).action.command.command.type, 'WITHDRAW');
});
test('finite calendar expiry is distinct from the resumable observation limit', () => {
  assert.equal(chooseAction(view([wait]), phase('WINDOW', { week: 224 })).stop, 'NO_FUTURE_QUARTER_WINDOW');
  assert.equal(parseOptions(['--max-new-actions', '0']).maxNewActions, 0);
  assert.equal(parseOptions([]).maxNewActions, 600);
  for (const flag of ['--seed', '--source', '--cash', '--roll', '--strategy', '--force', '--max-new']) assert.throws(() => parseOptions([flag, '1']));
  assert.throws(() => parseOptions(['--max-new-actions', '-1']));
});
test('checkpoint checksum and complete atomic successor preserve exact pending command', () => {
  const directory = mkdtempSync(join(tmpdir(), 'visionary-producer-contract-')), path = join(directory, 'checkpoint.json');
  try {
    const initial = { format: FORMAT, predecessorSha256: null, pending: { intent: { type: 'VISIONARY', command: { type: 'CONSUME', compoundId: 'visionary-compound-1', confirmed: true } } } };
    const text = encodeCheckpoint(initial); writeFileSync(path, text);
    const next = { ...initial, predecessorSha256: stateHash(initial), pending: null };
    writeFileSync(`${path}.next`, encodeCheckpoint(next)); recoverAtomicNext(path);
    assert.deepEqual(decodeCheckpoint(readFileSync(path, 'utf8')).payload, next);
    const wrong = JSON.parse(text); wrong.payload.pending.intent.command.compoundId = 'visionary-compound-2';
    assert.throws(() => decodeCheckpoint(JSON.stringify(wrong)), /checksum/);
    writeFileSync(`${path}.next`, '{incomplete'); recoverAtomicNext(path);
    assert.equal(readFileSync(`${path}.incomplete`, 'utf8'), '{incomplete');
    assert.deepEqual(decodeCheckpoint(readFileSync(path, 'utf8')).payload, next);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('temporary published port closure waits a real week without advancing the survey step', () => {
  const p = phase('SURVEY', { step: 2, week: 179, location: 'tingen:relay-station' });
  const target = SURVEY_PLAN[2];
  const blocked = offer(target, { enabled: false, reason: '目的港正执行原封港规则，须等本次封港解除；已接通的原值班员仍可转送救济。' });
  const result = chooseAction(view([blocked, wait]), p);
  assert.equal(result.action.command.type, 'NEXT_WEEK'); assert.equal(result.advanceStep, false);
  const next = advancePolicy(result, view([])); assert.equal(next.week, 180); assert.equal(next.step, 2);
  assert.deepEqual(chooseAction(view([offer(target), wait]), next).action.command, target);
  assert.equal(chooseAction(view([offer(target, { enabled:false, reason:'真实不可通行' }), wait]), p).stop, 'PUBLIC_ACTION_BLOCKED');
});
