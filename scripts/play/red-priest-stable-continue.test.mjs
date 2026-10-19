import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { POLICY, STABILITY_PIN, assertStabilityPin, assertStabilityPolicy, materialCycleFromCommands,
  chooseAction, advancePolicy, runtimeDifference, assertFrozenTransition, parseOptions, stable, stateHash } from './red-priest-stable-continue.mjs';
const clone = value => structuredClone(value);
const intent = command => ({ type: 'RED_PRIEST', command });
const material = { type: 'MATERIAL', command: { type: 'TRANSFER_CUSTODY', itemId: 'same-original' } };
const offer = (command, enabled = true, extra = {}) => ({ command, enabled, label: '公开动作', cost: '1行动', reason: null, ...extra });
const policy = () => ({ phase: 'POSTWAR', attempts: { [JSON.stringify(material)]: 12 }, materialCycle: { startedAfterCommand: 1114,
  attempts: { [JSON.stringify(material)]: 3 } }, supportSinceProgress: 0, unchangedWaits: 0, lastProgress: null, stopAfterWithdrawal: null });
const view = actions => ({ actions, promoted: false, guidanceKnown: true, nextStep: '', resources: { health: 100, mind: 100, spirituality: 120, cash: '200便士', actionsRemaining: 3 },
  sections: [{ id: 'finance', lines: ['当前伤势0份'] }, { id: 'materials', lines: ['本人持有原件', '本人持有原件', '本人持有原件'] }] });
const historicalCheckpoint = process.env.RED_PRIEST_STABILITY_CHECKPOINT ?? 'tests/fixtures/red-priest-v02090/planned1137/checkpoint.json';
const oldPolicy = JSON.parse(readFileSync(historicalCheckpoint)).payload.policyDefinition;

test('Only the exact1137 capture and narrow policy delta are accepted', () => {
  assertStabilityPin(STABILITY_PIN); assertStabilityPolicy(oldPolicy, POLICY);
  for (const changed of [{ ...STABILITY_PIN, commandCount: 1114 }, { ...STABILITY_PIN, random: { seed: 'alternate', cursor: 477 } }]) assert.throws(() => assertStabilityPin(changed));
  for (const changed of [{ ...POLICY, attemptsPerMaterialOperation: 100 }, { ...POLICY, minimumMindBeforeStability: 70 }, { ...POLICY, noReroll: false }])
    assert.throws(() => assertStabilityPolicy(oldPolicy, changed));
});
test('Cycle derives only from actual retained commands; old totals are not reset', () => {
  const commands = [intent(material), intent(material), intent({ type: 'CONSUME', compoundId: 'original-bottle', confirmed: true }), intent(material), intent({ type: 'NEXT_WEEK' }), intent(material)];
  assert.deepEqual(materialCycleFromCommands(commands), { startedAfterCommand: 921, attempts: { [JSON.stringify(material)]: 2 } });
  const p = policy(), decision = chooseAction(view([offer(material)]), p);
  assert.deepEqual(decision.action.command, material); assert.equal(decision.policy.attempts[JSON.stringify(material)], 12);
  assert.deepEqual(p, policy(), 'Public selection must not mutate its predecessor');
  const next = advancePolicy(decision, view([]), 1138); assert.equal(next.attempts[JSON.stringify(material)], 13); assert.equal(next.materialCycle.attempts[JSON.stringify(material)], 4);
});
test('Twelve actual attempts in this cycle stop; unrelated waiting cannot reset it', () => {
  const p = policy(); p.materialCycle.attempts[JSON.stringify(material)] = 12;
  assert.equal(chooseAction(view([offer(material)]), p).stop, 'FINITE_MATERIAL_ATTEMPTS');
  const waited = advancePolicy({ policy: p, action: offer({ type: 'NEXT_WEEK' }) }, view([]), 1138);
  assert.equal(waited.materialCycle.attempts[JSON.stringify(material)], 12);
  assert.equal(chooseAction(view([offer(material)]), waited).stop, 'FINITE_MATERIAL_ATTEMPTS');
});
test('Exact original1137 cycle preserves three current handoffs and twelve historic handoffs', () => {
  const cp = JSON.parse(readFileSync(historicalCheckpoint)).payload;
  const cycle = materialCycleFromCommands(cp.commands), key = JSON.stringify({ type: 'MATERIAL', command: { type: 'TRANSFER_CUSTODY', itemId: 'conqueror-potion-1:characteristic' } });
  assert.equal(cycle.startedAfterCommand, 1114); assert.equal(cycle.attempts[key], 3); assert.equal(cp.policy.attempts[key], 12);
});
test('A prepared compound is stabilized before consumption, never substituted', () => {
  const dose = offer({ type: 'CONSUME', compoundId: 'same-bottle', confirmed: true }), prep = offer({ type: 'STABILIZE_PROMOTION', compoundId: 'same-bottle' }, true, { cost: '2行动、120便士、12灵性、8精神；实际1周' });
  assert.equal(chooseAction(view([dose, prep]), policy()).action.command.type, 'STABILIZE_PROMOTION');
  assert.equal(chooseAction(view([dose]), policy()).stop, 'PUBLIC_STABILITY_UNAVAILABLE');
  assert.equal(chooseAction(view([dose, offer({ type: 'STABILIZE_PROMOTION', compoundId: 'other-bottle' })]), policy()).stop, 'PUBLIC_STABILITY_UNAVAILABLE');
  const ready = view([dose, { ...prep, enabled: false, reason: '本瓶已有一次稳定准备；不能重复付费叠加或转给另一瓶。' }]);
  ready.sections.push({ id: 'promotion-stability', lines: ['这份原成药当前服用成功率68%；已生效稳定加值35，仅用于此份原成药的下一次服用。'] });
  assert.equal(chooseAction(ready, policy()).action.command.type, 'CONSUME');
  ready.actions[1].reason = '此准备已经失效'; assert.equal(chooseAction(ready, policy()).stop, 'PUBLIC_STABILITY_BINDING_BLOCKED');
});
test('Preparation earns real money and restores real mind before spending', () => {
  const actions = [offer({ type: 'CONSUME', compoundId: 'same-bottle', confirmed: true }), offer({ type: 'STABILIZE_PROMOTION', compoundId: 'same-bottle' }), offer({ type: 'WORK' }), offer({ type: 'REST' }), offer({ type: 'NEXT_WEEK' })];
  const poor = view(actions); poor.resources.cash = '86便士'; assert.equal(chooseAction(poor, policy()).action.command.type, 'WORK');
  const drained = view(actions); drained.resources.mind = 70; assert.equal(chooseAction(drained, policy()).action.command.type, 'REST');
});
test('Real consumption starts the next cycle without erasing history or reusing preparation', () => {
  const p = policy(), command = { type: 'CONSUME', compoundId: 'same-bottle', confirmed: true };
  const next = advancePolicy({ policy: p, action: offer(command) }, view([]), 1200);
  assert.deepEqual(next.materialCycle, { startedAfterCommand: 1200, attempts: {} }); assert.equal(next.attempts[JSON.stringify(material)], 12);
  assert.equal(next.attempts[JSON.stringify(command)], 1);
});
test('Prepared rescue opts in with one ordinary AP and never sacrifices evacuation to checklist', () => {
  const p = policy(), start = view([offer({ type: 'START_EPILOGUE' }), offer({ type: 'START_PREPARED_EPILOGUE' })]); start.promoted = true;
  assert.equal(chooseAction(start, p).action.command.type, 'START_PREPARED_EPILOGUE');
  const scene = view([offer({ type: 'EPILOGUE', command: { type: 'EVACUATE' } }), offer({ type: 'EPILOGUE', command: { type: 'CONTAIN_FIRE' } })]); scene.promoted = true;
  assert.equal(chooseAction(scene, p).action.command.command.type, 'EVACUATE');
  const low = view([offer({ type: 'START_PREPARED_EPILOGUE' }), offer({ type: 'NEXT_WEEK' })]); low.promoted = true; low.resources.actionsRemaining = 1;
  assert.equal(chooseAction(low, p).action.command.type, 'NEXT_WEEK');
});
test('Exact freeze diff rejects unrelated source drift, missing changes and proof tampering', () => {
  const prior = JSON.parse(readFileSync(join(dirname(historicalCheckpoint), 'freeze.json')));
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const after = clone(prior.files); after.find(e => e.file === 'src/domain/red-priest/engine.ts').sha256 = 'c'.repeat(64);
  after.find(e => e.file === '$natural-producer').sha256 = 'd'.repeat(64);
  const freeze = { files: after, sha256: hash(after) }, current = after.filter(e => e.file !== '$natural-producer');
  const proof = { originalFreezeSha256: prior.sha256, changedFiles: runtimeDifference(prior.files, after), currentRuntimeFreeze: { files: current, sha256: hash(current) } };
  assertFrozenTransition(prior, freeze, proof);
  const bad = clone(freeze); bad.files.find(e => e.file === 'package.json').sha256 = 'e'.repeat(64); bad.sha256 = hash(bad.files);
  assert.throws(() => assertFrozenTransition(prior, bad, proof));
  const missing = clone(proof); missing.changedFiles = []; assert.throws(() => assertFrozenTransition(prior, freeze, missing));
  const altered = clone(proof); altered.changedFiles[0].before.sha256 = '0'.repeat(64); assert.throws(() => assertFrozenTransition(prior, freeze, altered));
  const removed = clone(freeze); removed.files.pop(); removed.sha256 = hash(removed.files); assert.throws(() => assertFrozenTransition(prior, removed, proof));
  assert.throws(() => assertFrozenTransition({ ...prior, sha256: 'forged' }, freeze, proof));
});
test('CLI exposes no seed, reroll, strategy, result or override route', () => {
  for (const flag of ['--seed', '--success', '--cash', '--strategy', '--random-cursor', '--force']) assert.throws(() => parseOptions([flag, '1']));
  assert.throws(() => parseOptions(['--stability-equivalence-sha256', 'fake']));
});
