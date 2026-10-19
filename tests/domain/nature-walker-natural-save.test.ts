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
import { NATURE_WALKER_SOURCE_KEYS } from '../../src/domain/nature-walker/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { NATURE_WALKER_ROOT, NATURE_WALKER_PREFIX_COUNT, NATURE_WALKER_SOURCE, NATURE_WALKER_PREDECESSOR,
  captureMetadata, captureFileHash, captureValueHash, insertionOrderHash, captureBody, namedBoundary, capturedState, capturedSnapshot,
  observedCapture, currentCapture, sourceEntry, assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same,
} from './nature-walker-capture-helper.js';
import { NATURE_WALKER_METADATA_FILES } from './nature-walker-capture-evidence.js';
import { GUIDANCE, SQLITE_REPRESENTATIVES, OBSERVED_SQLITE_STEPS, assertObservedBoundary, assertObservedFinal, assertCapturedResources, assertPublicProjection } from './nature-walker-save-ui-helper.js';

// Full frozen-input SQLite verification belongs to nature-walker-save.mjs.
// These Vitest cases exercise representative distinct real transitions only.
it('requires finalized actual207 integrity and counts before claiming SQLite coverage', async () => {
  const observed = observedCapture(), { boundaries, steps, commands, snapshots } = captureMetadata();
  expect(observed.commands).toBe(955); expect(observed.namedBoundaries).toBe(146); expect(observed.uniqueTransitions).toBe(105); expect(observed.aliases).toBe(41);
  expect(SQLITE_REPRESENTATIVES).toEqual(Object.keys(OBSERVED_SQLITE_STEPS));
  expect(Object.fromEntries(SQLITE_REPRESENTATIVES.map(name => [name, steps[name]]))).toEqual(OBSERVED_SQLITE_STEPS);
  expect(commands).toHaveLength(observed.commands); expect(Object.keys(boundaries)).toHaveLength(observed.namedBoundaries);
  expect(new Set(Object.values(steps)).size).toBe(observed.uniqueTransitions);
  expect(observed.uniqueTransitions).toBe(observed.commands - NATURE_WALKER_PREFIX_COUNT + 1);
  expect(observed.aliases).toBe(observed.namedBoundaries - observed.uniqueTransitions);
  expect(steps).toEqual(observed.boundarySteps); expect(Object.keys(snapshots)).toEqual(observed.snapshots);
  expect(observed.sqliteRepresentatives).toEqual(SQLITE_REPRESENTATIVES);
  expect(steps['exact-original851-living-source']).toBe(NATURE_WALKER_PREFIX_COUNT); expect(steps[GUIDANCE]).toBeDefined();
  expect(observed.pendingIntent).toBeNull(); expect(observed.failurePhase).toBe('IDLE');
  expect(observed.freezeSha256).toBe('03a780d4a9108a526c3e778d7ad6a21171cc72cde24871fd56c2bc51c02d88bc');
  for (const filename of NATURE_WALKER_METADATA_FILES) {
    expect(await captureFileHash(`${NATURE_WALKER_ROOT}/${filename}`), filename).toBe(observed.metadataHashes[filename]);
  }
  const integrity = JSON.parse(readFileSync(`${NATURE_WALKER_ROOT}/capture-integrity.json`, 'utf8')) as { freezeSha256: string; frozenFiles: unknown[] };
  expect(integrity.freezeSha256).toBe(observed.freezeSha256); expect(insertionOrderHash(integrity.frozenFiles)).toBe(observed.freezeSha256);
  const selected = SQLITE_REPRESENTATIVES.map(name => { expect(boundaries[name], name).toBeDefined(); return steps[name]; });
  expect(new Set(selected).size).toBe(selected.length); expect(selected).toContain(observed.commands);
  expect(selected.length).toBeGreaterThan(1); expect(selected.length).toBeLessThanOrEqual(observed.uniqueTransitions);
}, 30_000);

describe('NatureWalker actual representative SQLite rollback and reopen', () => {
  it('preserves all original851 living commands and their original674 same-seed predecessor', async () => {
    expect(await captureFileHash(NATURE_WALKER_SOURCE)).toBe('cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf');
    expect(await captureFileHash(NATURE_WALKER_PREDECESSOR)).toBe('731c25059489305fc3699c1bdc6fb39489590f30a0f149417210ae4f6aef0fdc');
    const raw = sourceEntry<SliceState>('final'), original = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([182, 'barren-matriarch-v182']);
    expect(original).toMatchObject({ status: 'ACTIVE', revision: 852, week: 212, health: 100, mind: 96, spirituality: 114,
      cash: 885, actionsRemaining: 3, injuryRisk: 0, random: { seed: 'cultivator-natural-v069', cursor: 238 } });
    expect(original.injuries).toEqual([]); same(original, capturedState('prefixFinal'));
    const commands = sourceEntry<SliceIntent[]>('commands'), predecessor = readObjectEntry<SliceIntent[]>(NATURE_WALKER_PREDECESSOR, 'commands');
    expect(commands).toHaveLength(851); expect(predecessor).toHaveLength(674); same(commands.slice(0, 674), predecessor);
    same(currentCapture(sourceEntry('prefixFinal')), currentCapture(readObjectEntry<unknown>(NATURE_WALKER_PREDECESSOR, 'final')));
    expect(original.natureWalker.guidanceKnown).toBe(false); expect(original.barrenMatriarch.promotionWeek).toBe(202);
    expect(original.progression.promotionWeek).toBe(6); expect(Object.keys(original.progression.mastery)).toHaveLength(15);
    expect(original.coffinBearer.life).toMatchObject({ clockSeconds: 834, playerTravelMetres: 124, playerLocation: 'START',
      owner: { id: 'CB3-ADA', age: 46, alive: true, health: 100, mind: 100, location: 'OUTSIDE' },
      recipient: { id: 'CB3-LENA', age: 39, alive: true, health: 100, mind: 100, location: 'OUTSIDE' } });
    expect(original.coffinBearer.life.samples.map(sample => [sample.id, sample.alive, sample.vitality, sample.location])).toEqual([
      ['CB3-LIVE-1', true, 47, 'OUTSIDE'], ['CB3-LIVE-2', true, 47, 'OUTSIDE'], ['CB3-DRY-1', false, 0, 'OUTSIDE'],
    ]);
    expect(original.coffinBearer.life.guard.segments.map(segment => segment.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
    expect(original.barrenMatriarch.life.rootPad).toMatchObject({ id: 'BM2-ROOT-PAD', integrity: 50, location: 'START' });
  }, 120_000);

  it.each(SQLITE_REPRESENTATIVES)('%s keeps private rows through failure, reopen, identical retry and stale rejection', async name => {
    const { commands, steps } = captureMetadata(), save = namedBoundary(name), beforeHash = await captureFileHash(save.path);
    expect(save.count).toBe(steps[name]); same(save.intent, commands[save.count - 1]);
    if (save.count > NATURE_WALKER_PREFIX_COUNT) {
      assertPublicCaptureControl(save.before, save.intent); assertCapturedResources(save.before, save.intent, save.final);
    }
    assertObservedBoundary(name, save.final);
    exerciseSqlite(save.before, save.intent, save.final, `nature-walker207:${save.count}`);
    expect(await captureFileHash(save.path)).toBe(beforeHash);
  }, 180_000);

  it('migrates raw182 explicitly and rejects missing or future CURRENT saves without rewriting originals', () => {
    const raw = sourceEntry<SliceState>('final'), rawHash = captureValueHash(raw), migrated = currentCapture(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([182, 'barren-matriarch-v182']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of NATURE_WALKER_SOURCE_KEYS) same(migrated[key], raw[key]);
    const final = capturedState('final'), finalHash = captureValueHash(final); assertObservedFinal(final);
    for (const key of [...NATURE_WALKER_SOURCE_KEYS, 'natureWalker'] as const) {
      const invalid = structuredClone(final) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), `Missing current root ${key}`).toThrow();
    }
    expect(() => migrateSliceState({ ...final, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...final, contentVersion: 'future-nature-walker-unrecognized' })).toThrow();
    assertOriginalContinuity(final, migrated); same(captureBody(final), observedCapture().final);
    expect(captureValueHash(raw)).toBe(rawHash); expect(captureValueHash(final)).toBe(finalHash);
  }, 180_000);

  it.each(observedCapture().snapshots.filter(name => ['guidance', 'promoted', 'combatStart', 'combatTerminal', 'actualTerminal', 'livingContinuation'].includes(name)))
  ('retains original people, living plants, single pad and filtered public history at actual %s', name => {
    const state = capturedSnapshot(name), original = currentCapture(sourceEntry('final')), hash = captureValueHash(state);
    assertOriginalContinuity(state, original); assertPublicProjection(state, projectSliceState(state));
    same(state.barrenMatriarch.encounter, original.barrenMatriarch.encounter);
    expect(state.barrenMatriarch.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 87 });
    expect(state.coffinBearer.encounter.enemyStatus).toBe('SURRENDERED'); expect(state.barrenMatriarch.life.rootPad.integrity).toBe(50);
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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-nature-walker-save-')), database = join(directory, 'boundary.sqlite');
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
        { type: 'NATURE_WALKER', command: { type: 'OBSERVE', caseId: 'living-response' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }];
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
