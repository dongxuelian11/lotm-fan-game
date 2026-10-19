import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { ABOMINATION_SOURCE_KEYS } from '../../src/domain/abomination/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ABOMINATION_CAPTURE_EVIDENCE as evidence } from './abomination-capture-evidence.js';
import { ABOMINATION_PREFIX_COUNT, ABOMINATION_SOURCE, ABOMINATION_PRIOR, captureMetadata, captureFileHash, captureValueHash,
  namedBoundary, capturedState, capturedSnapshot, observedCapture, currentCapture, sourceEntry,
  assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './abomination-capture-helper.js';

// The separate abomination-save.mjs verifier owns all137 actual transitions.
// CI repeats only observed representatives. No new seed, state, death or effect
// is manufactured to stand in for the original living source or final result.
describe.skipIf(evidence.observed === null)('Abomination actual representative SQLite rollback and reopen', () => {
  it('selects distinct observed transitions while retaining all historical source bytes', async () => {
    const expected = observedCapture(), { boundaries, steps } = captureMetadata();
    expect(await captureFileHash(ABOMINATION_SOURCE)).toBe(evidence.sourceSha256);
    expect(await captureFileHash(ABOMINATION_PRIOR)).toBe(evidence.priorSha256);
    expect(expected.sqliteRepresentatives).toHaveLength(19);
    expect(new Set(expected.sqliteRepresentatives).size).toBe(expected.sqliteRepresentatives.length);
    for (const name of expected.sqliteRepresentatives) expect(boundaries[name], name).toBeDefined();
    const selected = expected.sqliteRepresentatives.map(name => steps[name]!);
    expect(new Set(selected).size).toBe(selected.length); expect(selected.length).toBeLessThan(expected.uniqueTransitions);
    expect(selected).toEqual([642, 643, 679, 711, 716, 718, 724, 725, 730, 744, 762, 770, 771, 772, 773, 774, 776, 777, 778]);
  }, 60_000);

  it.each(evidence.observed?.sqliteRepresentatives ?? [])('%s retains exact rows through failure, reopen and idempotent retry', async name => {
    const { commands, steps } = captureMetadata(), save = namedBoundary(name), beforeHash = await captureFileHash(save.path);
    expect(save.count).toBe(steps[name]); same(save.intent, commands[save.count - 1]);
    if (save.count > ABOMINATION_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    exerciseSqlite(save.before, save.intent, save.final, `abomination203:${save.count}`);
    expect(await captureFileHash(save.path)).toBe(beforeHash);
  }, 120_000);

  it('persists the actual UI explicit default policies with the same first-round state and retry result', () => {
    const save = namedBoundary('combat-round-1');
    const intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' };
    same(applySliceIntent(save.before, intent), save.final);
    exerciseSqlite(save.before, intent, save.final, 'abomination203:explicit-default-policies');
  }, 120_000);

  it('migrates the real raw178 whole source with no root deletion and refuses future or missing current roots', () => {
    const raw = sourceEntry<SliceState>('final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([178, 'ancient-evil-v178']);
    const current = currentCapture(raw);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.status).toBe('ACTIVE'); same(current.ancientEvil, raw.ancientEvil); same(current.silentDisciple, raw.silentDisciple);
    const final = capturedState('final'), finalHash = captureValueHash(final);
    for (const key of [...ABOMINATION_SOURCE_KEYS, 'abomination'] as const) {
      const invalid = structuredClone(final) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), `Current-format missing root ${key}`).toThrow();
    }
    expect(() => migrateSliceState({ ...final, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...final, contentVersion: 'future-abomination-unrecognized' })).toThrow();
    expect(captureValueHash(final)).toBe(finalHash); assertOriginalContinuity(final, current);
  }, 120_000);

  it('preserves actual original death and surrender archives in live source, promotion, combat and final saves', () => {
    const original = currentCapture(sourceEntry('final'));
    for (const state of [original, capturedSnapshot('promoted'), capturedSnapshot('combatStart'), capturedState('final')]) {
      expect(state.status).toBe('ACTIVE');
      same(state.ancientEvil.encounter, original.ancientEvil.encounter); same(state.silentDisciple.encounter, original.silentDisciple.encounter);
      expect(state.ancientEvil.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT', terminal: { outcome: 'ENEMY_DEAD' } });
      expect(state.silentDisciple.encounter).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', terminal: { outcome: 'ENEMY_SURRENDERED' } });
      same(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
      assertOriginalContinuity(state, original);
    }
  }, 120_000);
});

function storedRows(database: string): Buffer {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    return Buffer.from(JSON.stringify({
      runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
    }));
  } finally { db.close(); }
}
function sameStoredRows(database: string, expectedRows: Buffer): void {
  expect(storedRows(database).equals(expectedRows), 'Exact persisted row bytes, including backup and receipt').toBe(true);
}

function exerciseSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  expect(before.status).toBe('ACTIVE'); expect(final.revision).toBe(before.revision + 1); expect(final.runId).toBe(before.runId);
  assertValidSliceState(before); assertValidSliceState(final);
  const beforeHash = captureValueHash(before), finalHash = captureValueHash(final);
  const directory = mkdtempSync(join(tmpdir(), 'lotm-abomination-representative-save-')), database = join(directory, 'boundary.sqlite');
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = projectSliceState(final);
  let app: SqliteSliceStore | undefined, fail = false, injectedAfterApply = 0;
  try {
    app = new SqliteSliceStore(database, { beforeWrite: () => {
      if (!fail) return;
      same(app!.repository.get(final.runId)!.state, final);
      const receipt = app!.repository.receipt(intentId);
      expect(receipt).not.toBeNull(); expect(receipt!.fingerprint).toBe(stableStringify(envelope));
      same(receipt!.receipt.state, expectedPublic); expect(app!.repository.activeRun()).toBe(before.runId);
      injectedAfterApply++;
      throw new Error('injected representative write failure after complete actual intent and receipt');
    } });
    app.repository.transaction(() => {
      app!.repository.put({ state: before, updatedAt: '2026-10-16T00:00:00.000Z' });
      app!.repository.selectRun(before.runId);
    });
    const originalRows = storedRows(database);
    fail = true;
    const rejected = app.submitIntent(envelope);
    expect(rejected.ok).toBe(false); if (rejected.ok) throw new Error('Injected rollback unexpectedly committed');
    expect(rejected.error.code).toBe('SAVE_FAILED'); expect(injectedAfterApply).toBe(1);
    same(app.repository.get(before.runId)!.state, before); expect(app.repository.receipt(intentId)).toBeNull();
    sameStoredRows(database, originalRows); expect(existsSync(`${database}.sealed`)).toBe(false);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameStoredRows(database, originalRows); same(app.repository.get(before.runId)!.state, before);
    expect(app.repository.receipt(intentId)).toBeNull(); expect(app.repository.activeRun()).toBe(before.runId);

    const committed = app.submitIntent(envelope);
    expect(committed.ok).toBe(true); if (!committed.ok) throw new Error(JSON.stringify(committed.error));
    expect(committed.value.replayed).toBe(false); same(committed.value.state, expectedPublic);
    same(app.repository.get(final.runId)!.state, final); same(app.repository.receipt(intentId)!.receipt, committed.value);
    const original = currentCapture(sourceEntry('final'));
    if (final.revision >= original.revision) assertOriginalContinuity(app.repository.get(final.runId)!.state, original);
    const committedRows = storedRows(database);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    sameStoredRows(database, committedRows); same(app.repository.get(final.runId)!.state, final);
    same(projectSliceState(app.repository.get(final.runId)!.state), expectedPublic); expect(app.repository.activeRun()).toBe(final.runId);
    const retried = app.submitIntent(envelope);
    expect(retried.ok).toBe(true); if (!retried.ok) throw new Error(JSON.stringify(retried.error));
    same(retried.value, { ...committed.value, replayed: true }); same(app.repository.get(final.runId)!.state, final);
    sameStoredRows(database, committedRows);
    if (final.status === 'DEAD') {
      const sealed = readFileSync(`${database}.sealed`);
      expect(JSON.parse(sealed.toString('utf8'))).toEqual([final.runId]); expect(expectedPublic.canAct).toBe(false);
      const blocked = app.submitIntent({ intentId: `${intentId}:sealed`, runId: final.runId, expectedRevision: final.revision,
        payload: { type: 'ACTION', action: 'REST' } });
      expect(blocked.ok).toBe(false); if (blocked.ok) throw new Error('A sealed original death accepted a new action');
      expect(blocked.error.code).toBe('ARCHIVED'); expect(app.repository.receipt(`${intentId}:sealed`)).toBeNull();
      same(app.repository.get(final.runId)!.state, final); sameStoredRows(database, committedRows);
      expect(readFileSync(`${database}.sealed`).equals(sealed), 'The actual captured death marker remains exact').toBe(true);
    } else expect(existsSync(`${database}.sealed`), 'A living representative never creates a death seal').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
