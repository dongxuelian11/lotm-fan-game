import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { POLICY, STABILITY_PIN, assertStabilityPin, assertFirstBranchPolicy as assertStabilityPolicy, materialCycleFromCommands,
  chooseAction, advancePolicy, runtimeDifference, assertFrozenTransition, parseOptions, stable, stateHash, initialBranchPolicy, assertCurrent918Binding, encodeCheckpoint, decodeCheckpoint } from './red-priest-stability-first-branch.mjs';
const clone = value => structuredClone(value);
const intent = command => ({ type: 'RED_PRIEST', command });
const material = { type: 'MATERIAL', command: { type: 'TRANSFER_CUSTODY', itemId: 'same-original' } };
const offer = (command, enabled = true, extra = {}) => ({ command, enabled, label: '公开动作', cost: '1行动', reason: null, ...extra });
const policy = () => ({ phase: 'POSTWAR', attempts: { [JSON.stringify(material)]: 12 }, materialCycle: { startedAfterCommand: 1114,
  attempts: { [JSON.stringify(material)]: 3 } }, supportSinceProgress: 0, unchangedWaits: 0, lastProgress: null, stopAfterWithdrawal: null });
const view = actions => ({ actions, promoted: false, guidanceKnown: true, nextStep: '', resources: { health: 100, mind: 100, spirituality: 120, cash: '200便士', actionsRemaining: 3 },
  sections: [{ id: 'finance', lines: ['当前伤势0份'] }, { id: 'materials', lines: ['本人持有原件', '本人持有原件', '本人持有原件'] }] });
const fixtureRoot = process.env.RED_PRIEST_CAPTURE_FIXTURE ?? 'tests/fixtures/red-priest-v02090';
const prior1137 = process.env.RED_PRIEST_STABILITY_CHECKPOINT ?? join(fixtureRoot, 'planned1137/checkpoint.json');
const failure1222 = process.env.RED_PRIEST_STABLE_FAILURE_CHECKPOINT ?? join(fixtureRoot, 'historical-stable-failure/checkpoint.json');
const fork918 = process.env.RED_PRIEST_FORK_CHECKPOINT ?? join(fixtureRoot, 'fork/original-918-checkpoint.json');
const stabilityProof = process.env.RED_PRIEST_STABILITY_EQUIVALENCE_PROOF ?? join(fixtureRoot, 'proofs/stability-equivalence.json');
const oldPolicy = JSON.parse(readFileSync(failure1222)).payload.policyDefinition;

test('Preserved1137 pin and full audited stable strategy identity are exact', () => {
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
  const cp = JSON.parse(readFileSync(prior1137)).payload;
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
  const prior = JSON.parse(readFileSync(join(dirname(prior1137), 'freeze.json')));
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

test('Independent strategy starts before919 with empty branch attempts and explicit planning', () => {
  const p = initialBranchPolicy(); assert.equal(p.phase, 'WAR'); assert.deepEqual(p.attempts, {});
  assert.deepEqual(p.materialCycle, { startedAfterCommand: 918, attempts: {} });
  const enabled = offer({ type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } });
  assert.deepEqual(chooseAction(view([enabled]), p).action.command, enabled.command);
  assert.equal(POLICY.id, 'RED_PRIEST918_STABILITY_FROM_FIRST_COMPOUND_V1');
  assert.equal(POLICY.promotionPreparation, 'REQUIRE_SAME_COMPOUND_PAID_STABILITY');
});
test('First original prepared bottle receives paid stability; no inherited later checkpoint', () => {
  const p = initialBranchPolicy(); p.phase = 'POSTWAR';
  const bottle = 'red-priest:ordinary-compound-pack:1:EMPTY_BOTTLE';
  const v = view([offer({ type: 'CONSUME', compoundId: bottle, confirmed: true }), offer({ type: 'STABILIZE_PROMOTION', compoundId: bottle })]);
  assert.deepEqual(chooseAction(v, p).action.command, { type: 'STABILIZE_PROMOTION', compoundId: bottle });
  const prior = clone(p); p.materialCycle.attempts[JSON.stringify(material)] = 12;
  assert.equal(chooseAction(view([offer(material)]), p).stop, 'FINITE_MATERIAL_ATTEMPTS');
  assert.deepEqual(prior.attempts, {}, 'No preserved1137 or1222 attempts seed this new genuine918 branch');
});
test('Current219 proof strictly binds genuine918 rather than claiming current188 replay', () => {
  const root = JSON.parse(readFileSync(fork918)).payload;
  const proof = JSON.parse(readFileSync(stabilityProof));
  assertCurrent918Binding(root, proof);
  const wrong = clone(proof); wrong.replay.rows[0].randomBefore.cursor = 477; assert.throws(() => assertCurrent918Binding(root, wrong));
  const future = clone(root); future.finalStateSha256 = '0'.repeat(64); assert.throws(() => assertCurrent918Binding(future, proof));
});
test('Checksummed action-boundary persistence rejects a modified saved pending intent', () => {
  const payload = { format: 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1', commandCount: 918, policy: initialBranchPolicy(),
    pending: { commandCount: 919, intent: intent({ type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } }) } };
  const encoded = encodeCheckpoint(payload); assert.deepEqual(decodeCheckpoint(encoded).payload, payload);
  const forged = JSON.parse(encoded); forged.payload.pending.intent.command = { type: 'CONSUME', compoundId: 'future-bottle', confirmed: true };
  assert.throws(() => decodeCheckpoint(JSON.stringify(forged)));
});
