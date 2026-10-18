import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { MERCURY_SNAKE_SOURCE_KEYS } from '../../src/domain/mercury-snake/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { MERCURY_SNAKE_CAPTURE_EVIDENCE as evidence } from './mercury-snake-capture-evidence.js';
import { MERCURY_SNAKE_PREFIX_COUNT, MERCURY_SNAKE_SOURCE, MERCURY_SNAKE_PRIOR, captureMetadata, captureFileHash, captureValueHash,
  namedBoundary, capturedState, capturedSnapshot, observedCapture, currentCapture, sourceEntry,
  assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './mercury-snake-capture-helper.js';

// The separate mercury-snake-save.mjs verifier owns all 139 actual transitions.
// These distinct observed representatives cover SQLite transaction boundaries;
// the capture suite owns full 154-file integrity. Neither suite invents a route.
const SQLITE_REPRESENTATIVES = [
  'exact-original703-living-source', 'paid500-guidance-freezes-eight-roots-and-original-luck',
  'paid1200-mercury-snake-potion-1', 'consume-mercury-snake-potion-1', 'consume-mercury-snake-potion-2',
  'cart-return-prepare', 'cart-return-capture_moment', 'cart-return-local_restart',
  'maintained-contact-moment_anchor', 'maintained-contact-local_restart',
  'withdrawn-contact-moment_anchor', 'withdrawn-contact-withdraw_consent-ability',
  'withdrawn-contact-push_back', 'withdrawn-contact-leave', 'three-honest-reports-reflected',
  'paid30-independent-three-charge-combat-piece', 'original-adults-actually-leave-player-walks-to-new-yard',
  'independent-optional-oswin-fight', 'combat-round-1', 'combat-round-2',
] as const;

it('requires the frozen 841-command actual stage204 observations before claiming save coverage', () => {
  expect(observedCapture()).toMatchObject({ files: 154, commands: 841, namedBoundaries: 182, uniqueTransitions: 139, aliases: 43,
    combatRounds: [1, 2], consequenceDomains: ['BODY'], promotionWeek: 196,
    final: { status: 'ACTIVE', week: 202, H: 90, M: 88, S: 86, cash: 20, AP: 3 },
    terminal: { outcome: 'ENEMY_SURRENDERED', round: 2, enemyHealth: 70, enemyMind: 100, enemySpirituality: 95 } });
}, 30_000);

describe.skipIf(evidence.observed === null)('Mercury Snake actual representative SQLite rollback and reopen', () => {
  it('selects distinct actual transitions while retaining both historical source files', async () => {
    const expected = observedCapture(), { boundaries, steps } = captureMetadata();
    expect(await captureFileHash(MERCURY_SNAKE_SOURCE)).toBe(evidence.sourceSha256);
    expect(await captureFileHash(MERCURY_SNAKE_PRIOR)).toBe(evidence.priorSha256);
    for (const name of SQLITE_REPRESENTATIVES) expect(boundaries[name], name).toBeDefined();
    const selected = SQLITE_REPRESENTATIVES.map(name => steps[name]!);
    expect(new Set(selected).size).toBe(selected.length); expect(selected.length).toBeLessThan(expected.uniqueTransitions);
    expect(selected).toEqual([703, 704, 725, 730, 767, 773, 779, 781, 799, 801, 825, 826, 829, 834, 836, 837, 838, 839, 840, 841]);
  }, 60_000);

  it.each(SQLITE_REPRESENTATIVES)('%s retains exact rows through failure, reopen and idempotent retry', async name => {
    const { commands, steps } = captureMetadata(), save = namedBoundary(name), beforeHash = await captureFileHash(save.path);
    expect(save.count).toBe(steps[name]); same(save.intent, commands[save.count - 1]);
    if (save.count > MERCURY_SNAKE_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    exerciseSqlite(save.before, save.intent, save.final, `mercury-snake204:${save.count}`);
    expect(await captureFileHash(save.path)).toBe(beforeHash);
  }, 120_000);

  it('persists the exact UI default HOLD policy without changing the original first-round RNG or result', () => {
    const save = namedBoundary('combat-round-1');
    const intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy: 'HOLD' };
    expect(save.intent).toEqual(intent);
    same(applySliceIntent(save.before, { type: 'COMBAT_ROUND', stance: 'CONTROL' }), save.final);
    same(applySliceIntent(save.before, intent), save.final);
    exerciseSqlite(save.before, intent, save.final, 'mercury-snake204:explicit-default-policy');
  }, 120_000);

  it('migrates the intact raw179 whole source and rejects missing current roots and future formats', () => {
    const raw = sourceEntry<SliceState>('final'), rawHash = captureValueHash(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([179, 'fate-prophet-v179']);
    const current = currentCapture(raw);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current).toMatchObject({ status: 'ACTIVE', week: 177, health: 90, mind: 95, spirituality: 119, cash: 1060, actionsRemaining: 2 });
    for (const key of MERCURY_SNAKE_SOURCE_KEYS) same(current[key], raw[key]);
    const final = capturedState('final'), finalHash = captureValueHash(final);
    for (const key of [...MERCURY_SNAKE_SOURCE_KEYS, 'mercurySnake'] as const) {
      const invalid = structuredClone(final) as Partial<SliceState>; delete invalid[key];
      expect(() => migrateSliceState(invalid), `Current-format missing root ${key}`).toThrow();
    }
    expect(() => migrateSliceState({ ...final, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...final, contentVersion: 'future-mercury-snake-unrecognized' })).toThrow();
    expect(captureValueHash(raw)).toBe(rawHash); expect(captureValueHash(final)).toBe(finalHash);
    assertOriginalContinuity(final, current);
  }, 120_000);

  it.each(['guidance', 'promoted', 'combatStart', 'combatTerminal'])('preserves all eight roots, the surrendered Rowan and spent original luck at %s', name => {
    const original = currentCapture(sourceEntry('final')), state = capturedSnapshot(name);
    expect(state.status).toBe('ACTIVE');
    same(state.fateProphet.encounter, original.fateProphet.encounter);
    expect(state.fateProphet.encounter).toMatchObject({ targetId: 'FP2-ROWAN', enemyHealth: 60, enemyMind: 100,
      enemySpirituality: 83, enemyStatus: 'SURRENDERED', terminal: { outcome: 'ENEMY_SURRENDERED', round: 3 } });
    expect(state.mercurySnake.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    same(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    assertOriginalContinuity(state, original);
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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-mercury-snake-representative-save-')), database = join(directory, 'boundary.sqlite');
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
    expect(final.status).toBe('ACTIVE');
    expect(existsSync(`${database}.sealed`), 'The actual living continuation never creates a death seal').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
