import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { HAND_OF_ORDER_SOURCE_KEYS } from '../../src/domain/hand-of-order/types.js';
import { resolveHandOfOrderOriginalsSnapshot, validateHandOfOrderAcquisitionJournal, validateHandOfOrderJournalContinuity } from '../../src/domain/hand-of-order/index.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { HAND_OF_ORDER_PREFIX_COUNT, HAND_OF_ORDER_SOURCE, HAND_OF_ORDER_PREDECESSOR, HAND_OF_ORDER_ORIGINAL_DEATH,
  captureMetadata, captureFileHash, captureValueHash, captureBody, namedBoundary, capturedState, capturedSnapshot,
  observedCapture, currentCapture, sourceEntry, assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same,
} from './hand-of-order-capture-helper.js';
import { GUIDANCE, SQLITE_REPRESENTATIVES, assertObservedBoundary, assertObservedFinal, OBSERVED_SQLITE_STEPS, assertCapturedResources, assertPublicProjection } from './hand-of-order-save-ui-helper.js';

const archivedRepresentatives = new Map([
  ['paid1200-hand-of-order-potion-4', '2c081546f38884a78e2d3ba1e7983d8f4fb036c6701f7825264c78a5e2933f93'],
  ['consume-hand-of-order-potion-4', '24ff09f0bc982dcd9adf05c661825568e7ddca7595e1c9682e3fd022fe703009'],
  ['paid100-after-all-original-bottles-failed', '65e93eb2c74883bc0fc8cebffcea63679547cc1c9d8e2e36a05ff2e93698fca0'],
  ['next-real-week-three-new-bottle-identities', 'ec8860320bb1e205cbd046f410d02ad8b38ff813c4cabfd2ee31e362c7b4de4b'],
]);

// Every unique actual transition is covered by the coordinator's frozen-input
// hand-of-order-save.mjs verifier. Current transactions cover still-legal cases;
// four archived acquisition cases prove strict import/reopen and rejection,
// without minting their old fourth-plus originals or synthetic success receipts.
it('requires coordinator-observed stage206 evidence before claiming actual SQLite coverage', () => {
  const observed = observedCapture(), { boundaries, steps } = captureMetadata();
  expect(observed.commands).toBe(801); expect(observed.namedBoundaries).toBe(283); expect(observed.uniqueTransitions).toBe(208);
  expect(SQLITE_REPRESENTATIVES).toEqual(Object.keys(OBSERVED_SQLITE_STEPS));
  expect(observed.sqliteRepresentatives).toEqual(SQLITE_REPRESENTATIVES);
  expect(Object.fromEntries(SQLITE_REPRESENTATIVES.map(name => [name, steps[name]]))).toEqual(OBSERVED_SQLITE_STEPS);
  expect(observed.boundarySteps['exact-original594-living-source']).toBe(HAND_OF_ORDER_PREFIX_COUNT);
  expect(observed.boundarySteps[GUIDANCE]).toBeDefined();
  expect(observed.pendingIntent).toBeNull(); expect(observed.failurePhase).toBe('IDLE');
  expect(observed.freezeSha256).toBe('82595e0577e1408fe3343da02116e90f99f4ac129af355b3ad57947655dc8b90');
  expect(SQLITE_REPRESENTATIVES.length).toBeGreaterThan(1);
  const selected = SQLITE_REPRESENTATIVES.map(name => { expect(boundaries[name], name).toBeDefined(); return steps[name]; });
  expect(new Set(selected).size).toBe(selected.length); expect(selected).toContain(observed.commands);
  expect(selected.length).toBeLessThanOrEqual(observed.uniqueTransitions);
}, 30_000);

describe('Hand of Order actual representative SQLite rollback and reopen', () => {
  it('preserves the exact whole594 living source, original483 recovery and separate477 death with common474 prefix', async () => {
    expect(await captureFileHash(HAND_OF_ORDER_SOURCE)).toBe('e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1');
    expect(await captureFileHash(HAND_OF_ORDER_PREDECESSOR)).toBe('3589c7d792bc5974dc79452a9d9f10ae68832da565e97ad88f06f61915f07942');
    expect(await captureFileHash(HAND_OF_ORDER_ORIGINAL_DEATH)).toBe('8e65fcb081f33b5714534acf7d5e47227247ed90e8aa20d00861dc51f2e43588');
    const raw = sourceEntry<SliceState>('final'), original = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([181, 'balancer-v181']);
    expect(original).toMatchObject({ status: 'ACTIVE', revision: 595, week: 135, health: 60, mind: 96, spirituality: 120,
      cash: 690, actionsRemaining: 3, injuryRisk: 1, random: { seed: 'arbiter-natural-v066', cursor: 367 } });
    expect(original.injuries.map(injury => [injury.severity, injury.acquiredRevision, injury.treatedRevision])).toEqual([['LIGHT', 590, null], ['HEAVY', 593, null]]);
    same(original, capturedState('prefixFinal'));
    const commands = sourceEntry<SliceIntent[]>('commands'), recovery = readObjectEntry<SliceIntent[]>(HAND_OF_ORDER_PREDECESSOR, 'commands'),
      death = readObjectEntry<SliceIntent[]>(HAND_OF_ORDER_ORIGINAL_DEATH, 'commands');
    expect(commands).toHaveLength(594); expect(recovery).toHaveLength(483); expect(death).toHaveLength(477);
    same(commands.slice(0, 483), recovery); same(recovery.slice(0, 474), death.slice(0, 474)); expect(recovery[474]).not.toEqual(death[474]);
    const dead = currentCapture(readObjectEntry<unknown>(HAND_OF_ORDER_ORIGINAL_DEATH, 'final'));
    expect(dead).toMatchObject({ status: 'DEAD', health: 0, revision: 478, random: { seed: 'arbiter-natural-v066', cursor: 290 } });
    same(currentCapture(sourceEntry('prefixFinal')), currentCapture(readObjectEntry<unknown>(HAND_OF_ORDER_PREDECESSOR, 'final')));
    expect(original.handOfOrder.guidanceKnown).toBe(false); expect(original.balancer.promotionWeek).toBe(126);
    expect(original.progression.promotionWeek).toBe(9); expect(Object.keys(original.progression.mastery)).toHaveLength(17);
  }, 120_000);

  it.each(SQLITE_REPRESENTATIVES.map(name => ({ name, verification: archivedRepresentatives.has(name)
    ? 'preserves its archived endpoints through strict reopen and live rejection without row writes'
    : 'keeps exact private states and rows through failure, reopen, retry and stale rejection' })))('$name $verification', async ({ name }) => {
    const { commands, steps } = captureMetadata(), save = namedBoundary(name), beforeHash = await captureFileHash(save.path);
    expect(save.count).toBe(steps[name]); same(save.intent, commands[save.count - 1]);
    if (save.count > HAND_OF_ORDER_PREFIX_COUNT) assertCapturedResources(save.before, save.intent, save.final);
    assertObservedBoundary(name, save.final);
    if (archivedRepresentatives.has(name)) {
      expect(beforeHash).toBe(archivedRepresentatives.get(name));
      assertArchivedAcquisition(save.before, save.intent, save.final);
      exerciseArchivedSqlite(save.before, save.intent, save.final, `hand-of-order206:${save.count}`);
    } else {
      if (save.count > HAND_OF_ORDER_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
      const expected = name === GUIDANCE ? withCurrentGuidance(save.final) : save.final;
      exerciseSqlite(save.before, save.intent, expected, `hand-of-order206:${save.count}`);
    }
    expect(await captureFileHash(save.path)).toBe(beforeHash);
  }, 180_000);

  it('explicitly migrates raw181 without replacing original roots or accepting missing/future current saves', () => {
    const raw = sourceEntry<SliceState>('final'), rawHash = captureValueHash(raw), migrated = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([181, 'balancer-v181']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of HAND_OF_ORDER_SOURCE_KEYS) same(migrated[key], raw[key]);
    const final = capturedState('final'), finalHash = captureValueHash(final); assertObservedFinal(final);
    for (const key of [...HAND_OF_ORDER_SOURCE_KEYS, 'handOfOrder'] as const) {
      const invalid = structuredClone(final) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), `Missing current root ${key}`).toThrow();
    }
    expect(() => migrateSliceState({ ...final, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...final, contentVersion: 'future-hand-of-order-unrecognized' })).toThrow();
    assertOriginalContinuity(final, migrated); same(captureBody(final), observedCapture().final);
    expect(captureValueHash(raw)).toBe(rawHash); expect(captureValueHash(final)).toBe(finalHash);
  }, 180_000);

  it.each(['guidance', 'promoted', 'combatStart', 'actualTerminal'])
  ('retains frozen old opponents, the single actual guard plate and filtered public facts at %s', name => {
    const state = capturedSnapshot(name), original = currentCapture(sourceEntry('final')), hash = captureValueHash(state);
    assertOriginalContinuity(state, original); assertPublicProjection(state, projectSliceState(state));
    same(state.balancer.encounter, original.balancer.encounter);
    expect(state.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90,
      enemyMind: 100, enemySpirituality: 67, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B' });
    expect(state.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 126 });
    expect(captureValueHash(state)).toBe(hash);
  }, 180_000);
});

/** Only the newly emitted guidance record changes. Historical capture bytes,
 * all other records and every gameplay/random field remain the original. */
function withCurrentGuidance(archived: SliceState): SliceState {
  const expected = structuredClone(archived), records = expected.chronicle.filter(record => record.id === 'record-602-943');
  expect(records).toHaveLength(1);
  const record = records[0]!;
  expect({ id: record.id, week: record.week, title: record.title }).toEqual({
    id: 'record-602-943', week: 136, title: '听取秩序之手独立成品与专业准备指导',
  });
  expect(createHash('sha256').update(record.text).digest('hex')).toBe('71580ffd37c86930cd2c48ca913eef9d0cec1ba009bd0306b73615b3fe67ec4b');
  const oldGuidance = '全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
  const currentGuidance = '最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。可另付60便士、8灵性、6精神为所选同瓶准备同场当周支持，0行动，意志临时+15；仍可能失败，换瓶、退出或跨周失效，已付成本不退。';
  expect(record.text.endsWith(oldGuidance)).toBe(true);
  expect(expected.chronicle.reduce((count, row) => count + row.text.split(oldGuidance).length - 1, 0)).toBe(1);
  const latestGuidance = expected.lastResult?.id === record.id ? expected.lastResult : null;
  if (latestGuidance) same(latestGuidance, record);
  record.text = record.text.slice(0, -oldGuidance.length) + currentGuidance;
  if (latestGuidance) latestGuidance.text = record.text;
  return expected;
}

function assertArchivedAcquisition(before: SliceState, intent: SliceIntent, final: SliceState): void {
  if (intent.type !== 'HAND_OF_ORDER') throw new Error('Only the four named archived acquisition cases use this path.');
  const legacySupply = intent.command.type === 'REQUEST_SUPPLY' || intent.command.type === 'RECEIVE_SUPPLY';
  if (!legacySupply) {
    expect(['BUY_POTION', 'CONSUME']).toContain(intent.command.type);
    expect(intent.command).toHaveProperty('bottleId', 'hand-of-order-potion-4');
  }
  expect(validateSlicePayload(intent)).toBe(!legacySupply);
  expect(final.revision).toBe(before.revision + 1); expect(final.runId).toBe(before.runId);
  for (const state of [before, final]) {
    assertValidSliceState(state); expect(validateHandOfOrderAcquisitionJournal(state)).toBe(true);
    expect(validateHandOfOrderJournalContinuity(state)).toBe(true);
    expect(state.handOfOrder.bottles.every(bottle => bottle.recovery === undefined)).toBe(true);
    if (state.handOfOrder.bottles.length > 3) {
      expect(state.handOfOrder.bottles).toHaveLength(6);
      expect(resolveHandOfOrderOriginalsSnapshot(state.handOfOrder)).toBeNull();
    }
    expect(projectSliceState(state).handOfOrder.actions.some(action => action.enabled &&
      stableStringify({ type: 'HAND_OF_ORDER', command: action.command }) === stableStringify(intent))).toBe(false);
    const hash = captureValueHash(state);
    expect(() => applySliceIntent(state, intent)).toThrow(); expect(captureValueHash(state)).toBe(hash);
  }
  same(final.handOfOrder.sourceHistory, before.handOfOrder.sourceHistory); same(final.handOfOrder.sourceScene, before.handOfOrder.sourceScene);
  const receipt = final.handOfOrder.acquisitionJournal.at(-1)!;
  expect(receipt.revision).toBe(before.revision); expect(receipt.week).toBe(before.week); same(receipt.date, before.date);
  same({ type: 'HAND_OF_ORDER', command: receipt.command }, intent);
  same(final.handOfOrder.acquisitionJournal.slice(0, -1), before.handOfOrder.acquisitionJournal);
  expect([receipt.cursorBefore, receipt.cursorAfter]).toEqual([before.random.cursor, final.random.cursor]);
}

/** Import each real endpoint independently. Never execute a forbidden command
 * or synthesize its old successful intent receipt under the current rules. */
function exerciseArchivedSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  if (intent.type !== 'HAND_OF_ORDER') throw new Error('Expected an archived Hand of Order acquisition.');
  const legacySupply = intent.command.type === 'REQUEST_SUPPLY' || intent.command.type === 'RECEIVE_SUPPLY';
  for (const [endpoint, state] of [['before', before], ['final', final]] as const) {
    const hash = captureValueHash(state), expectedPublic = projectSliceState(state); assertPublicProjection(state, expectedPublic);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-hand-of-order-archived-save-')), database = join(directory, 'boundary.sqlite');
    const envelope = { intentId: `${intentId}:${endpoint}`, runId: state.runId, expectedRevision: state.revision, payload: intent };
    let app: SqliteSliceStore | undefined;
    try {
      app = new SqliteSliceStore(database);
      app.repository.transaction(() => {
        app!.repository.put({ state, updatedAt: '2026-10-16T00:00:00.000Z' }); app!.repository.selectRun(state.runId);
      });
      const originalRows = storedRows(database);
      for (let attempt = 0; attempt < 2; attempt++) {
        app.close(); app = undefined; app = new SqliteSliceStore(database);
        sameRows(database, originalRows); same(app.repository.get(state.runId)!.state, state);
        const bootstrap = app.getBootstrap(); expect(bootstrap.ok).toBe(true);
        if (!bootstrap.ok) throw new Error(JSON.stringify(bootstrap.error));
        same(bootstrap.value.activeState, expectedPublic); expect(app.repository.activeRun()).toBe(state.runId);
        const rejected = app.submitIntent(envelope);
        expect(rejected.ok).toBe(false); if (rejected.ok) throw new Error('An archived acquisition unexpectedly committed');
        expect(rejected.error.code).toBe(legacySupply ? 'INVALID_INTENT' : 'ACTION_UNAVAILABLE');
        expect(app.repository.receipt(envelope.intentId)).toBeNull();
        same(app.repository.get(state.runId)!.state, state); sameRows(database, originalRows);
      }
      // Removed supply payloads fail schema validation first. Use a valid shape
      // to retain an independent assertion of the stale-revision boundary.
      const staleId = `${envelope.intentId}:stale`, stalePayload: SliceIntent = legacySupply
        ? { type: 'HAND_OF_ORDER', command: { type: 'LEARN_GUIDANCE' } } : intent;
      const stale = app.submitIntent({ ...envelope, intentId: staleId, expectedRevision: state.revision - 1, payload: stalePayload });
      expect(stale.ok).toBe(false); if (stale.ok) throw new Error('A stale archived action unexpectedly committed');
      expect(stale.error.code).toBe('REVISION_CONFLICT'); expect(app.repository.receipt(staleId)).toBeNull();
      app.close(); app = undefined; app = new SqliteSliceStore(database);
      same(app.repository.get(state.runId)!.state, state); sameRows(database, originalRows);
      expect(app.repository.receipt(envelope.intentId)).toBeNull(); expect(app.repository.receipt(staleId)).toBeNull();
      expect(existsSync(`${database}.sealed`)).toBe(false); expect(captureValueHash(state)).toBe(hash);
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
  }
}

function storedRows(database: string): Buffer {
  const db = new DatabaseSync(database, { readOnly: true });
  try { return Buffer.from(JSON.stringify({
    runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
    receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
    meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
  })); } finally { db.close(); }
}
function sameRows(database: string, expected: Buffer): void {
  expect(storedRows(database).equals(expected), 'Exact persisted rows, backups, timestamps, selection and receipts').toBe(true);
}
function exerciseSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  expect(before.status === 'ACTIVE' || before.status === 'SLICE_COMPLETE' && intent.type === 'CONTINUE_LIFE').toBe(true);
  expect(final.revision).toBe(before.revision + 1); expect(final.runId).toBe(before.runId);
  assertValidSliceState(before); assertValidSliceState(final);
  const beforeHash = captureValueHash(before), finalHash = captureValueHash(final);
  const directory = mkdtempSync(join(tmpdir(), 'lotm-hand-of-order-save-')), database = join(directory, 'boundary.sqlite');
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = projectSliceState(final); assertPublicProjection(final, expectedPublic);
  let app: SqliteSliceStore | undefined, fail = false, injectedAfterApply = 0;
  try {
    app = new SqliteSliceStore(database, { beforeWrite: () => {
      if (!fail) return;
      same(app!.repository.get(final.runId)!.state, final);
      const receipt = app!.repository.receipt(intentId);
      expect(receipt).not.toBeNull(); expect(receipt!.fingerprint).toBe(stableStringify(envelope));
      same(receipt!.receipt.state, expectedPublic); expect(app!.repository.activeRun()).toBe(before.runId);
      injectedAfterApply++; throw new Error('Injected write failure after full actual command, receipt and run selection');
    } });
    app.repository.transaction(() => {
      app!.repository.put({ state: before, updatedAt: '2026-10-16T00:00:00.000Z' }); app!.repository.selectRun(before.runId);
    });
    const originalRows = storedRows(database); fail = true;
    const rejected = app.submitIntent(envelope);
    expect(rejected.ok).toBe(false); if (rejected.ok) throw new Error('Injected failure unexpectedly committed');
    expect(rejected.error.code).toBe('SAVE_FAILED'); expect(injectedAfterApply).toBe(1);
    same(app.repository.get(before.runId)!.state, before); expect(app.repository.receipt(intentId)).toBeNull();
    sameRows(database, originalRows); expect(existsSync(`${database}.sealed`)).toBe(false);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameRows(database, originalRows); same(app.repository.get(before.runId)!.state, before);
    expect(app.repository.receipt(intentId)).toBeNull(); expect(app.repository.activeRun()).toBe(before.runId);

    const committed = app.submitIntent(envelope);
    expect(committed.ok).toBe(true); if (!committed.ok) throw new Error(JSON.stringify(committed.error));
    expect(committed.value.replayed).toBe(false); same(committed.value.state, expectedPublic);
    same(app.repository.get(final.runId)!.state, final); same(app.repository.receipt(intentId)!.receipt, committed.value);
    const committedRows = storedRows(database);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameRows(database, committedRows); same(app.repository.get(final.runId)!.state, final);
    same(projectSliceState(app.repository.get(final.runId)!.state), expectedPublic); expect(app.repository.activeRun()).toBe(final.runId);
    const retried = app.submitIntent(envelope);
    expect(retried.ok).toBe(true); if (!retried.ok) throw new Error(JSON.stringify(retried.error));
    same(retried.value, { ...committed.value, replayed: true }); sameRows(database, committedRows);
    const staleId = `${intentId}:stale`, stale = app.submitIntent({ ...envelope, intentId: staleId });
    expect(stale.ok).toBe(false); if (stale.ok) throw new Error('Stale command unexpectedly committed');
    expect(stale.error.code).toBe('REVISION_CONFLICT'); expect(app.repository.receipt(staleId)).toBeNull(); sameRows(database, committedRows);
    if (final.status === 'DEAD') {
      const seal = () => JSON.parse(readFileSync(`${database}.sealed`, 'utf8')) as string[];
      expect(seal()).toEqual([final.runId]); expect(expectedPublic.canAct).toBe(false);
      const blocked: SliceIntent[] = [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' },
        { type: 'HAND_OF_ORDER', command: { type: 'OBSERVE', caseId: 'paired-handover' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
      for (const payload of blocked) {
        const id = `${intentId}:sealed:${payload.type}`, result = app.submitIntent({ intentId: id, runId: final.runId, expectedRevision: final.revision, payload });
        expect(result.ok).toBe(false); if (result.ok) throw new Error('Sealed player death was continued');
        expect(result.error.code).toBe('ARCHIVED'); expect(app.repository.receipt(id)).toBeNull();
        same(app.repository.get(final.runId)!.state, final); sameRows(database, committedRows); expect(seal()).toEqual([final.runId]);
      }
    } else expect(existsSync(`${database}.sealed`), 'A living player is not sealed by an opponent terminal result').toBe(false);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameRows(database, committedRows); same(app.repository.get(final.runId)!.state, final);
    expect(app.repository.receipt(staleId)).toBeNull();
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
