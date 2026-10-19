import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as v1 from './tyrant-stage.mjs';
import * as v2 from './tyrant-stage-cooldown-v2.mjs';
import { build835Payload, parseContinuationOptions } from './tyrant-stage-continue-835.mjs';

// Pure helper tests only: no game import, replay, source capture or natural action.
const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, extra = {}) => ({ id: `public-${JSON.stringify(command)}`, label: '真实公开行动',
  cost: '0便士、0行动', command, enabled: true, reason: null, ...extra });
const cooldown = extra => offer({ type: 'COAST', command: { type: 'ASK_PERMISSION', coastId: 'east' } },
  { preferredAction: true, enabled: false, reason: v2.CONTINUATION_835.blockedReason, ...extra });
const week = offer({ type: 'NEXT_WEEK' }, { cost: '结实际生活费；没有工资或恢复' });
const work = offer({ type: 'WORK' }, { cost: '1行动、8小时，180便士，每周一次' });
const view = (actions = [cooldown(), week, work], cash = 30) => ({ status: 'ACTIVE', week: 190, activeEvent: null,
  combat: null, health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: [],
  progression: { sequence: 1 }, tyrant: { guidanceKnown: true, promoted: false, insideCase: false,
    resources: { cash: `${cash}便士`, actionsRemaining: 2 }, actions, sections: [] } });
const choose = publicView => v2.chooseAction(publicView, v2.startingPolicy());

test('V2 is an explicit new policy identity with unchanged running policy state', () => {
  assert.notEqual(v2.POLICY.id, v1.POLICY.id); assert.equal(v2.POLICY.predecessorPolicy, v1.POLICY.id);
  assert.equal(v2.FORMAT, v1.FORMAT); assert.deepEqual(v2.startingPolicy(), v1.startingPolicy());
  const { id, predecessorPolicy, cooldown, ...same } = v2.POLICY;
  const { id: oldId, ...previous } = v1.POLICY; assert.deepEqual(same, previous);
});
test('only exact already-answered public coast cooldown gains a real next week', () => {
  const p = view(), d = choose(p);
  assert.equal(v1.chooseAction(p, v1.startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
  assert.equal(d.action.intent.command.type, 'NEXT_WEEK'); assert(v2.publicActionStillAvailable(p, d.action));
  assert.match(d.reason, /paying living costs and old debts/);
});
test('cooldown uses existing real wage budget, never invents wages or repeats paid work', () => {
  assert.equal(choose(view(undefined, 29)).action.intent.command.type, 'WORK');
  assert.equal(choose(view([cooldown(), week, { ...work, enabled: false }], 0)).action.intent.command.type, 'NEXT_WEEK');
  assert.equal(choose(view([cooldown(), { ...week, enabled: false }, { ...work, enabled: false }], 0)).stop, 'PUBLIC_ACTION_BLOCKED');
});
test('exact same cooldown remains valid for the other actual named coasts', () => {
  for (const coastId of ['north','south']) {
    const a = cooldown(); a.command.command.coastId = coastId;
    assert.equal(choose(view([a, week])).action.intent.command.type, 'NEXT_WEEK');
  }
});
test('permanent refusal and superficially similar text remain diagnostic', () => {
  for (const reason of ['居民永久拒绝参与。', v2.CONTINUATION_835.blockedReason + ' ', '本周已得到这一原人群答复。']) {
    const p = view([cooldown({ reason }), week, work]);
    assert.equal(choose(p).stop, 'PUBLIC_ACTION_BLOCKED');
    assert.deepEqual(choose(p), v1.chooseAction(p, v1.startingPolicy()));
  }
});
test('cooldown does not authorize another command, fictional coast, or unmarked alternative', () => {
  const invalid = [
    cooldown({ command: { type: 'MATERIAL', command: { type: 'ASK_PERMISSION', coastId: 'east' } } }),
    cooldown({ command: { type: 'COAST', command: { type: 'COERCE', coastId: 'east' } } }),
    cooldown({ command: { type: 'COAST', command: { type: 'ASK_PERMISSION', coastId: 'fictional-fourth' } } }),
    cooldown({ preferredAction: false })
  ];
  for (const a of invalid) {
    assert.equal(v2.isExactCoastPermissionCooldown(a), false);
    assert.equal(choose(view([a, week, work])).stop, 'PUBLIC_ACTION_BLOCKED');
  }
});
test('enabled permission is still asked, with no wait or new random preference', () => {
  const p = view([cooldown({ enabled: true, reason: null }), week]);
  assert.deepEqual(choose(p), v1.chooseAction(p, v1.startingPolicy()));
  assert.equal(choose(p).action.intent.command.command.type, 'ASK_PERMISSION');
});
test('irreversible death is still terminal, never cooldown-repaired', () => {
  const p = view(); p.status = 'DEAD';
  assert.equal(choose(p).stop, 'NATURAL_ACTUAL_TERMINAL');
  assert.deepEqual(choose(p), v1.chooseAction(p, v1.startingPolicy()));
});
test('freeze comparison accepts exactly one producer replacement and rejects product drift', () => {
  const before = { nodeVersion: process.version, files: [
    { file: 'src/domain/example.ts', bytes: 1, sha256: 'a'.repeat(64) },
    { file: '$natural-producer', bytes: 62869, sha256: v2.CONTINUATION_835.producerSha256 },
    { file: 'scripts/play/tyrant-stage.test.mjs', bytes: 2, sha256: 'c'.repeat(64) }
  ] }; before.sha256 = digest(before.files);
  const producer = { bytes: 70000, sha256: 'b'.repeat(64) }, after = clone(before);
  after.files[1] = { file: '$natural-producer', ...producer }; after.sha256 = digest(after.files);
  v2.assertFrozenRowsExceptProducer(before, after, producer);
  for (const mutate of [f => f.files[0].sha256 = 'd'.repeat(64), f => f.files[2].bytes++, f => f.files.reverse(),
    f => f.files.push({ file: 'unknown', bytes: 1, sha256: 'e'.repeat(64) }), f => f.nodeVersion = 'unknown']) {
    const drift = clone(after); mutate(drift); drift.sha256 = digest(drift.files);
    assert.throws(() => v2.assertFrozenRowsExceptProducer(before, drift, producer));
  }
  assert.throws(() => v2.assertOnlyProducerFreezeChanged(before, after, producer), 'Synthetic freeze cannot impersonate actual835');
});
const predecessorPayload = () => ({ commandCount: 835, commands: Array.from({ length: 134 }, (_, i) => ({ actual: i + 702 })),
  rows: Array.from({ length: 134 }, (_, i) => ({ commandCount: i + 702, receipts: { real: i } })), boundaries: [{ commandCount: 717, kind: 'S1' }],
  format: v1.FORMAT, source: v1.SOURCE, sourceSha256: v1.SOURCE_SHA256, prefixSha256: v1.PREFIX_SHA256,
  inputFreezeSha256: 'same-inputs', migration: { fromSchema: 190, toSchema: 212 }, createdAt: 'retained',
  initialStateSha256: 'same-initial', initialPublicSha256: 'same-public', initialGlobalPublicSha256: 'same-global', initialRandomSha256: 'same-random',
  state: { random: { seed: 'synthetic-test-only', cursor: 273 }, realCosts: 44 }, finalStateSha256: 'same-final',
  publicStateSha256: 'same-current-public', globalPublicStateSha256: 'same-current-global', policy: v1.startingPolicy(), pending: null, terminal: null });
test('metadata handoff preserves every command, receipt, running state and RNG', () => {
  const previous = { sha256: 'original-envelope', payload: predecessorPayload() };
  const next = build835Payload(previous, { sha256: 'new-freeze' }, { testProof: true });
  v2.assert835InheritedPayload(next, previous.payload);
  assert.deepEqual(next.state, previous.payload.state); assert.deepEqual(next.policy, previous.payload.policy);
  assert.equal(next.predecessorSha256, previous.sha256); assert.deepEqual(next.policyDefinition, v2.POLICY);
});
test('handoff rejects dropped failure, rewritten receipt, changed expense, RNG, policy, and rewind', () => {
  const previous = predecessorPayload();
  for (const mutate of [p => p.commands[128].actual = 'rerolled', p => p.rows[128].receipts.real = 'hidden-failure',
    p => p.state.realCosts = 0, p => p.state.random.cursor--, p => p.policy.doses++, p => p.commandCount = 701,
    p => p.pending = { fabricated: true }, p => p.terminal = { stage: 'pretend' }, p => p.createdAt = 'restarted']) {
    const next = clone(previous); mutate(next); assert.throws(() => v2.assert835InheritedPayload(next, previous));
  }
});
test('crash-resume accepts only the durable exact836 pending public decision without changing835', () => {
  const previous = predecessorPayload(), current = clone(previous), p = view(), decision = v2.chooseAction(p, current.policy);
  current.pending = { commandCount: 836, beforeStateSha256: previous.finalStateSha256,
    policyBeforeSha256: v2.stateHash(previous.policy), intent: clone(decision.action.intent), decision: clone(decision) };
  v2.assert835InheritedPayload(current, previous); v2.assert835PendingDecision(current, p);
  const changed = clone(current); changed.pending.intent.command.type = 'COERCE';
  assert.throws(() => v2.assert835PendingDecision(changed, p));
  changed.pending = { ...clone(current.pending), commandCount: 837 };
  assert.throws(() => v2.assert835InheritedPayload(changed, previous));
});
test('actual835 anchor rejects another checkpoint before any runtime can be loaded', () => {
  assert.throws(() => v2.assert835Predecessor({ payload: predecessorPayload() }, { sha256: '0'.repeat(64) }), /pinned actual835/);
});
test('handoff CLI requires reviewed code hashes and disjoint fresh output, no seed or override', () => {
  const valid = ['--source','/tmp/835-pure-test-source','--audit-only','--producer-sha256','a'.repeat(64),'--tool-sha256','b'.repeat(64)];
  assert.equal(parseContinuationOptions(valid).auditOnly, true);
  assert.throws(() => parseContinuationOptions(['--source','/tmp/source','--audit-only']), /both reviewed code hashes/);
  assert.throws(() => parseContinuationOptions([...valid,'--seed','alternate']), /Unsupported/);
  assert.throws(() => parseContinuationOptions([...valid,'--out','/tmp/835-pure-test-source/child']), /disjoint/);
  assert.throws(() => parseContinuationOptions([...valid,'--out','/tmp/835-pure-test-source']), /disjoint/);
});
test('V2 cannot initialize or replay a new701 run', async () => {
  await assert.rejects(v2.main(['--out','/tmp/new701-is-forbidden','--max-new-actions','0']), /creating a new701 run is forbidden/);
});
