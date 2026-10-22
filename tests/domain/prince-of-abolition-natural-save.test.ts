import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../../src/domain/prince-of-abolition/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentPrinceOfAbolitionReplayExpectation } from '../helpers/prince-of-abolition-current-replay.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE as evidence } from './prince-of-abolition-capture-evidence.js';
import { PRINCE_OF_ABOLITION_PREFIX_COUNT, PRINCE_OF_ABOLITION_SOURCE, PRINCE_OF_ABOLITION_PRIOR,
  captureMetadata, captureFileHash, captureValueHash, captureBody, namedBoundary, capturedState, capturedSnapshot,
  observedCapture, currentCapture, sourceEntry, assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same,
} from './prince-of-abolition-capture-helper.js';
import { GUIDANCE, SQLITE_REPRESENTATIVES, OBSERVED_SQLITE_STEPS, assertObservedBoundary, assertObservedFinal, assertCapturedResources, assertPublicProjection } from './prince-of-abolition-save-ui-helper.js';

// Full unique-transition coverage belongs to the coordinator's immutable-input
// prince-of-abolition-save.mjs verifier. This suite repeats distinct real saves.
// It cannot pass through a missing capture and never manufactures a route.
it('requires coordinator-observed stage205 evidence before claiming actual SQLite coverage', () => {
  const observed = observedCapture();
  expect(observed.commands).toBe(924); expect(observed.namedBoundaries).toBe(246); expect(observed.uniqueTransitions).toBe(182);
  expect(observed.boundarySteps['exact-original743-living-source']).toBe(743);
  expect(observed.boundarySteps[GUIDANCE]).toBeDefined();
  expect(observed.pendingIntent).toBeNull(); expect(observed.failurePhase).toBe('IDLE');
  expect(observed.stage).toBe('NATURAL743_PREFIX_PUBLIC_PRINCE_OF_ABOLITION_CONTINUATION');
  expect(SQLITE_REPRESENTATIVES).toEqual(Object.keys(OBSERVED_SQLITE_STEPS));
  expect(Object.fromEntries(SQLITE_REPRESENTATIVES.map(name => [name, observed.boundarySteps[name]]))).toEqual(OBSERVED_SQLITE_STEPS);
  expect(observed.sqliteRepresentatives).toEqual(SQLITE_REPRESENTATIVES);
}, 30_000);

describe.skipIf(evidence.observed === null)('Prince of Abolition actual representative SQLite rollback and reopen', () => {
  it('retains exact raw180 full743 source bytes and separate original558 death evidence', async () => {
    expect(await captureFileHash(PRINCE_OF_ABOLITION_SOURCE)).toBe(evidence.sourceSha256);
    expect(await captureFileHash(PRINCE_OF_ABOLITION_PRIOR)).toBe(evidence.priorSha256);
    const { boundaries, steps } = captureMetadata();
    for (const name of SQLITE_REPRESENTATIVES) expect(boundaries[name], name).toBeDefined();
    const selected = SQLITE_REPRESENTATIVES.map(name => steps[name]!);
    expect(new Set(selected).size).toBe(selected.length); expect(selected.length).toBeGreaterThan(1);
    expect(selected.length).toBeLessThanOrEqual(observedCapture().uniqueTransitions);
    expect(selected).toContain(observedCapture().commands);
    const raw = sourceEntry<SliceState>('final'), original = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([180, 'entropy-duke-v180']);
    expect(original).toMatchObject({ status: 'ACTIVE', revision: 744, week: 185, health: 100, mind: 95,
      spirituality: 94, cash: 800, actionsRemaining: 3, random: { seed: 'lawyer-natural-v063', cursor: 228 } });
    same(original, capturedState('prefixFinal')); expect(sourceEntry<SliceIntent[]>('commands')).toHaveLength(743);
    const prior = readObjectEntry<SliceState>(PRINCE_OF_ABOLITION_PRIOR, 'final');
    expect(prior.status).toBe('DEAD'); expect(prior.health).toBe(0);
    expect(readObjectEntry<SliceIntent[]>(PRINCE_OF_ABOLITION_PRIOR, 'commands')).toHaveLength(558);
    expect(sourceEntry<number>('prefixCount')).toBe(555);
    expect(currentCapture(prior).status).toBe('DEAD'); expect(original.princeOfAbolition.guidanceKnown).toBe(false);
  }, 120_000);

  it.each(SQLITE_REPRESENTATIVES)('%s keeps exact rows through failure, reopen, retry and stale rejection', async name => {
    const { commands, steps } = captureMetadata(), save = namedBoundary(name), beforeHash = await captureFileHash(save.path);
    expect(save.count).toBe(steps[name]); same(save.intent, commands[save.count - 1]);
    if (save.count > PRINCE_OF_ABOLITION_PREFIX_COUNT) {
      assertPublicCaptureControl(save.before, save.intent); assertCapturedResources(save.before, save.intent, save.final);
    }
    assertObservedBoundary(name, save.final);
    // Only newly committed guidance uses current text; loaded historical rows stay exact.
    const expected = name === GUIDANCE ? currentPrinceOfAbolitionReplayExpectation(save.final) : save.final;
    exerciseSqlite(save.before, save.intent, expected, `prince-of-abolition205:${save.count}`);
    expect(await captureFileHash(save.path)).toBe(beforeHash);
  }, 180_000);

  it('migrates the whole raw180 source without replacing inherited roots or accepting incomplete/future current saves', () => {
    const raw = sourceEntry<SliceState>('final'), rawHash = captureValueHash(raw), migrated = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([180, 'entropy-duke-v180']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) same(migrated[key], raw[key]);
    const final = capturedState('final'), finalHash = captureValueHash(final); assertObservedFinal(final);
    for (const key of [...PRINCE_OF_ABOLITION_SOURCE_KEYS, 'princeOfAbolition'] as const) {
      const invalid = structuredClone(final) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), `Missing current root ${key}`).toThrow();
    }
    expect(() => migrateSliceState({ ...final, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...final, contentVersion: 'future-prince-of-abolition-unrecognized' })).toThrow();
    assertOriginalContinuity(final, migrated); same(captureBody(final), observedCapture().final);
    expect(captureValueHash(raw)).toBe(rawHash); expect(captureValueHash(final)).toBe(finalHash);
  }, 180_000);

  it.each((evidence.observed?.snapshots ?? []).filter(name => ['guidance', 'promoted', 'combatStart', 'combatTerminal', 'actualTerminal'].includes(name)))
  ('keeps the eight original roots, old Oswin, unique gifts and filtered public facts at %s', name => {
    const state = capturedSnapshot(name), original = currentCapture(sourceEntry('final')), hash = captureValueHash(state);
    assertOriginalContinuity(state, original); assertPublicProjection(state, projectSliceState(state));
    same(state.entropyDuke.encounter, original.entropyDuke.encounter);
    expect(state.entropyDuke.encounter).toMatchObject({ targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED',
      enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, enemyRisk: 1, weaponLocation: 'HAND' });
    same(state.princeOfAbolition.gifts.slice(0, 12), original.briber.gifts.slice(0, 12));
    expect(state.princeOfAbolition.gifts.map(gift => gift.id)).toEqual(original.briber.gifts.map(gift => gift.id));
    expect(captureValueHash(state)).toBe(hash);
  }, 180_000);
});

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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-prince-of-abolition-save-')), database = join(directory, 'boundary.sqlite');
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
        { type: 'PRINCE_OF_ABOLITION', command: { type: 'OBSERVE', caseId: 'directed-throw' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
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
