import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { SOURCE, SOURCE_SHA256, SOURCE_STATE_SHA256, PREFIX_COUNT, PREFIX_SHA256, FORMAT, POLICY, OUTPUT,
  CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION, readSource, migrate, stateHash, startingPolicy,
  chooseAction, advancePolicy, publicActionStillAvailable, assertPublicOnly, assertGlobalPublic,
  capturePublic, selectionOutcome, selectedBoundary, actualReceipts, parseOptions, observationPause,
  initialCheckpoint, verifyCheckpoint, verifyActionCapture, encodeCheckpoint, decodeCheckpoint,
  saveCheckpoint, recoverAtomicNext, retainActionCapture, readCapture, loopDiagnostic } from './sun-stage.mjs';

// Pure producer contracts only. No dist import, game reducer, build, SQLite,
// random generation, controlled-success seam, or natural action is executed.
const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const offer = (command, extra = {}) => ({ id: `public-${JSON.stringify(command)}`, label: '真实公开行动',
  cost: '1行动、100便士', command, enabled: true, reason: null, preferredAction: true, ...extra });
const view = (actions = [offer({ type: 'LEARN_GUIDANCE' })], extra = {}) => ({
  runId: 'synthetic-pure-contract', revision: 854, status: 'ACTIVE', week: 196,
  date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 3, day: 24 }, actionsRemaining: 3, weeklyBudget: 3,
  cash: 1250, weeklyWage: 180, wagePaid: false, health: 100, mind: 98, spirituality: 106,
  maxHealth: 100, maxMind: 100, maxSpirituality: 120, pollution: 0, injuries: [], injuryRisk: 0,
  debtTotal: 0, debts: [], canAct: true, actionBlockedReason: null, activeEvent: null, combat: null,
  progression: { sequence: 1, acting: 100, mastery: { 'original.zero': 0 } },
  sun: { guidanceKnown: false, promoted: false, insideCase: false, sections: [], actions }, ...extra,
});
const owned = (actions, extra = {}) => view(actions, { sun: { guidanceKnown: true, promoted: false, insideCase: false, sections: [], actions }, ...extra });
const command = decision => decision.action?.intent.command;
const freeze = { sha256: 'f'.repeat(64) }, inputs = { sha256: 'e'.repeat(64) };
const initialState = () => ({ revision: 854, week: 196, status: 'ACTIVE', random: { seed: 'synthetic-private-seed', cursor: 7 },
  sun: { guidanceKnown: false, journal: [] }, chronicle: [], synthetic: 'Not a playable save' });
const temp = fn => { const dir = mkdtempSync(join(tmpdir(), 'sun-producer-pure-')); try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
const verify = payload => verifyCheckpoint(payload, freeze, payload.initialStateSha256, inputs);

function oneAction(dir) {
  const beforeLast = initialState(), globalPublicBefore = view(), publicBefore = capturePublic(globalPublicBefore);
  const zero = initialCheckpoint(beforeLast, globalPublicBefore, freeze, inputs, 'synthetic-test-time');
  const decision = chooseAction(publicBefore, zero.policy), lastIntent = decision.action.intent;
  const final = { ...clone(beforeLast), revision: 855, sun: { guidanceKnown: true, journal: [] }, chronicle: [{ actual: 'synthetic guidance cost' }] };
  const globalPublic = owned([offer({ type: 'WORK' })], { revision: 855, cash: 1150, actionsRemaining: 2 });
  const publicAfter = capturePublic(globalPublic), policyAfter = advancePolicy(decision, publicAfter, publicBefore);
  const row = { commandCount: 854, intent: lastIntent, commandSha256: digest(lastIntent), reason: decision.reason,
    publicLabel: decision.action.label, publicCost: decision.action.cost, startedAt: 'synthetic-test-time', elapsedMilliseconds: 0,
    revision: 855, week: 196, beforeStateSha256: stateHash(beforeLast), afterStateSha256: stateHash(final),
    publicBeforeSha256: stateHash(publicBefore), publicAfterSha256: stateHash(publicAfter),
    globalPublicBeforeSha256: stateHash(globalPublicBefore), globalPublicAfterSha256: stateHash(globalPublic),
    selectionOutcome: selectionOutcome(publicAfter), randomBefore: clone(beforeLast.random), randomAfter: clone(final.random),
    randomBeforeSha256: stateHash(beforeLast.random), randomAfterSha256: stateHash(final.random),
    policyBeforeSha256: stateHash(zero.policy), policyAfterSha256: stateHash(policyAfter), receipts: actualReceipts(final, beforeLast) };
  const content = { commandCount: 854, beforeLast, lastIntent, final, randomBefore: row.randomBefore, randomAfter: row.randomAfter,
    publicBefore, public: publicAfter, globalPublicBefore, globalPublic, policyBefore: zero.policy, policyAfter,
    audit: { ...row, elapsedMilliseconds: null } };
  row.capture = retainActionCapture(dir, content);
  const payload = { ...zero, commandCount: 854, state: final, finalStateSha256: row.afterStateSha256,
    publicStateSha256: row.publicAfterSha256, globalPublicStateSha256: row.globalPublicAfterSha256,
    commands: [lastIntent], rows: [row], boundaries: [{ ...row.capture, kind: selectedBoundary(lastIntent, publicAfter, []), commandCount: 854 }], policy: policyAfter };
  return { zero, decision, row, content, payload };
}

test('authenticates immutable living853 bytes, canonical final and retained prefix without replay', () => {
  const old = readSource();
  assert.equal(old.commands.length, 853); assert.equal(stateHash(old.source), SOURCE_STATE_SHA256);
  assert.equal(digest(old.commands), PREFIX_SHA256); assert.equal(PREFIX_COUNT, 853);
  assert.equal(old.inputFreeze.files[0].file, SOURCE); assert.equal(old.inputFreeze.files[0].sha256, SOURCE_SHA256);
  assert.equal(POLICY.noReroll, true); assert.equal(old.source.random.cursor, 385);
});

test('strict current migration preserves every old field and rejects repaired resources or identity', () => {
  const original = { schemaVersion: 191, contentVersion: 'pure-white-angel-v191', health: 100, random: { seed: 'same', cursor: 7 } };
  const runtime = { migrateSliceState: value => ({ ...clone(value), schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, sun: {} }), assertValidSliceState: () => {} };
  assert.equal(migrate(runtime, original).schemaVersion, 213); assert.equal(original.schemaVersion, 191);
  runtime.migrateSliceState = value => ({ ...clone(value), schemaVersion: 213, contentVersion: CURRENT_CONTENT_VERSION, health: 101 });
  assert.throws(() => migrate(runtime, original), /Migration changed original health/);
});

test('selects only the unique exact enabled preferred Sun control, including ordinary runtime actions', () => {
  assert.deepEqual(command(chooseAction(view(), startingPolicy())), { type: 'LEARN_GUIDANCE' });
  for (const type of ['WORK','REST','CLINIC','NEXT_WEEK','RETURN_ON_FOOT','STABILIZE_PROMOTION','CONSUME']) {
    const p = owned([offer({ type })]), result = chooseAction(p, startingPolicy());
    assert.equal(command(result).type, type); assert(publicActionStillAvailable(p, result.action));
    const forged = clone(result.action); forged.cost = 'free'; assert(!publicActionStillAvailable(p, forged));
  }
  for (const actions of [[], [offer({ type: 'REST' }, { preferredAction: false })], [offer({ type: 'REST' }), offer({ type: 'WORK' })]])
    assert.equal(chooseAction(owned(actions), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED');
  const blocked = offer({ type: 'MATERIAL', command: { type: 'RECOVER_SEALED' } }, { enabled: false, reason: '须至少下一真实周回同一封存原处，再付费回收原两份及同一唯一性。' });
  assert.equal(chooseAction(owned([blocked, offer({ type: 'NEXT_WEEK' }, { preferredAction: false })]), startingPolicy()).stop, 'PUBLIC_ACTION_BLOCKED', 'No guessed week override even for a temporary refusal');
});

test('retains terminal death, finite failures and ordinary epilogue exits without rerolls', () => {
  assert.equal(chooseAction(view([], { status: 'DEAD' }), startingPolicy()).stop, 'NATURAL_ACTUAL_TERMINAL');
  for (const type of ['DIRECTED_RADIANCE','RADIANCE_WARD']) {
    const p = owned([offer({ type: 'EPILOGUE', command: { type } })]), result = chooseAction(p, startingPolicy());
    const after = advancePolicy(result, p, p); assert.deepEqual(after.epilogueAttempted, [type]);
    assert.equal(chooseAction(p, after).stop, 'PUBLIC_ACTION_BLOCKED');
  }
  for (const type of ['CUTOFF_AND_SEAL','ORDINARY_EXIT','WITHDRAW','REPORT']) {
    const p = owned([offer({ type: 'EPILOGUE', command: { type } })]);
    const result = chooseAction(p, startingPolicy()); assert.equal(command(result).command.type, type);
    if (type === 'REPORT') assert.equal(chooseAction(p, advancePolicy(result, p, p)).stop, 'NATURAL_FINITE_SUN_REPORTED');
  }
  const p = startingPolicy(); p.doses = 3;
  assert.equal(chooseAction(owned([offer({ type: 'CONSUME' })]), p).stop, 'PUBLIC_ACTION_BLOCKED');
});

test('whole-public audit is path-aware and retains lawful prices and scalar check source labels', () => {
  const legitimate = { prices: { preparation: 100 }, check: { modifiers: [{ source: '实际原样本', value: 10 }] },
    divineHand: { life: { site: { guard: { actorId: null } } } }, glory: { life: { site: { guard: { actorId: null } } } } };
  assertPublicOnly(legitimate);
  for (const value of [{ elsewhere: { actorId: null } }, { source: {} }, { randomCursor: 7 }, { sourceDigest: 'private' }, { futureRoll: 1 }])
    assert.throws(() => assertPublicOnly(value), /Private public field/);
  assert.throws(() => assertGlobalPublic({ text: 'synthetic-private-seed' }, initialState()), /actual private/);
});

test('0/1 observation limits pause only at completed boundaries, never fail the gameplay', () => {
  const zero = initialCheckpoint(initialState(), view(), freeze, inputs, 'synthetic-test-time');
  verify(zero); assert.equal(zero.terminal, null); assert.equal(zero.commands.length, 0);
  const options = parseOptions(['--max-actions','0']); assert(observationPause(zero, 0, options));
  options.maxNewActions = 1; assert(!observationPause(zero, 0, options)); assert(observationPause(zero, 1, options));
  assert(!observationPause({ ...zero, pending: { durable: true } }, 1, options, true));
  options.stopAfterCommand = 853; assert(observationPause(zero, 0, options));
  assert.equal(options.out, resolve(OUTPUT)); assert.equal(FORMAT.startsWith('NEW216_RESTORED194'), true);
  for (const args of [['--seed','anything'], ['--max-actions','-1'], ['--max-actions','0','--max-new-actions','1'], ['--out','/tmp/other'], ['--resume','/tmp/other/checkpoint.json.gz']])
    assert.throws(() => parseOptions(args));
});

test('zero boundary and one full synthetic action survive checkpoint/reopen with receipts and public hashes exact', () => temp(dir => {
  const { zero, content, row, payload } = oneAction(dir), path = join(dir, 'checkpoint.json.gz');
  const first = saveCheckpoint(path, zero, null); verify(decodeCheckpoint(readFileSync(path)).payload);
  verifyActionCapture(content, row); verify(payload);
  const second = saveCheckpoint(path, payload, first.sha256), reopened = decodeCheckpoint(readFileSync(path));
  assert.deepEqual(reopened, second); verify(reopened.payload);
  assert.deepEqual(retainActionCapture(dir, content), row.capture); assert.deepEqual(readCapture(join(dir, row.capture.file)), content);
  assert.equal(reopened.payload.commandCount, 854); assert.deepEqual(reopened.payload.state.random, zero.state.random);
  for (const alter of [p => p.runtimeFreezeSha256 = 'wrong', p => p.sourceSha256 = 'wrong', p => p.inputFreezeSha256 = 'wrong',
    p => p.rows[0].randomAfter.cursor++, p => p.rows[0].globalPublicAfterSha256 = '0'.repeat(64), p => p.commands[0].command.type = 'REST']) {
    const bad = clone(payload); alter(bad); assert.throws(() => verify(bad));
  }
  const badReceipt = clone(content); badReceipt.audit.receipts.notes.push('invented'); assert.throws(() => verifyActionCapture(badReceipt, row));
}));

test('atomic pending/complete successors recover exactly; incomplete and unknown bytes are preserved', () => temp(dir => {
  const { zero, decision, payload } = oneAction(dir), path = join(dir, 'checkpoint.json.gz');
  const first = saveCheckpoint(path, zero, null);
  const pending = { commandCount: 854, intent: decision.action.intent, decision, beforeStateSha256: zero.finalStateSha256,
    publicBeforeSha256: zero.publicStateSha256, globalPublicBeforeSha256: zero.globalPublicStateSha256,
    randomBeforeSha256: stateHash(zero.state.random), policyBeforeSha256: stateHash(zero.policy), startedAt: 'synthetic-test-time' };
  const prepared = { ...zero, pending, predecessorSha256: first.sha256 };
  writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint(prepared))); recoverAtomicNext(path);
  const reopened = decodeCheckpoint(readFileSync(path)); verify(reopened.payload); assert.deepEqual(reopened.payload.pending, pending);
  assert.equal(reopened.payload.commands.length, 0, 'Pending intent is not a completed action');
  writeFileSync(`${path}.next`, gzipSync(encodeCheckpoint({ ...payload, predecessorSha256: reopened.sha256 }))); recoverAtomicNext(path);
  const committed = decodeCheckpoint(readFileSync(path)); verify(committed.payload); assert.equal(committed.payload.commands.length, 1);
  writeFileSync(`${path}.next`, 'partial bytes'); recoverAtomicNext(path); assert(existsSync(`${path}.incomplete`));
  assert.deepEqual(decodeCheckpoint(readFileSync(path)), committed);
  writeFileSync(`${path}.next`, encodeCheckpoint({ ...payload, predecessorSha256: 'unknown' }));
  assert.throws(() => recoverAtomicNext(path), /Unknown checkpoint successor/); assert(existsSync(`${path}.next`));
}));

test('actual wage or bodily recovery is progress; clock-only repetition is diagnostic', () => {
  const before = owned([offer({ type: 'NEXT_WEEK' })]), policy = startingPolicy(); policy.loop.repetitions = 2;
  assert.equal(loopDiagnostic(before, clone(before), policy).repetitions, 3);
  assert.equal(loopDiagnostic(before, { ...clone(before), cash: before.cash + 180 }, policy).repetitions, 0);
});
