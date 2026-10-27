import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentDivineHandReplayExpectation } from '../helpers/divine-hand-current-replay.js';
import { DIVINE_HAND_CAPTURE_EVIDENCE as expected } from './divine-hand-capture-evidence.js';
import { DIVINE_HAND_ROOT, DIVINE_HAND_SOURCE, DIVINE_HAND_PREFIX_COUNT, boundaryIndex, boundarySteps, snapshotIndex,
  uniqueBoundaryFiles, captureCommands, capturePath, captureFileHash, captureValueHash, captureBody, boundaryFile,
  currentCapture, sourceEntry, naturalEntry, assertPublicCaptureControl, sameCaptureValue as same,
} from './divine-hand-capture-helper.js';

interface CaptureIntegrity {
  naturalSha256: string; producerSha256: string; commandsSha256: string; publicSha256: string;
  boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; sourcePrefixSha256: string; files: Record<string, string>;
}
interface CaptureTransition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }
const integrity = JSON.parse(readFileSync(`${DIVINE_HAND_ROOT}/capture-integrity.json`, 'utf8')) as CaptureIntegrity;
const transitions = JSON.parse(readFileSync(`${DIVINE_HAND_ROOT}/transitions.json`, 'utf8')) as CaptureTransition[];

// Exhaustive SQLite verification of all140 transitions belongs to
// scripts/play/divine-hand-save.mjs. This suite hashes every input, then repeats
// only14 literal observed representatives instead of creating another140-save job.
describe('Divine Hand immutable capture integrity and representative SQLite recovery', () => {
  it('pins all157 capture files, all140 distinct transition states and both aliases without changing original bytes', async () => {
    for (const [name, hash] of Object.entries(expected.metadataHashes)) {
      expect(hash, name).toMatch(/^[0-9a-f]{64}$/); expect(await captureFileHash(join(DIVINE_HAND_ROOT, name)), name).toBe(hash);
    }
    expect(await captureFileHash(DIVINE_HAND_SOURCE)).toBe(expected.sourceSha256);
    expect(await captureFileHash('scripts/play/divine-hand-stage.mjs')).toBe(expected.producerSha256);
    for (const historical of expected.preserved) expect(await captureFileHash(historical.file), historical.file).toBe(historical.sha256);
    expect(integrity).toMatchObject({
      producerSha256: expected.producerSha256, naturalSha256: expected.metadataHashes['natural.json'],
      commandsSha256: expected.metadataHashes['commands.jsonl'], publicSha256: expected.metadataHashes['public.jsonl'],
      sourcePrefixSha256: expected.metadataHashes['source-prefix.json'], boundaryIndexSha256: expected.metadataHashes['boundaries.index.json'],
      boundaryStepsSha256: expected.metadataHashes['boundaries.steps.json'], transitionsSha256: expected.metadataHashes['transitions.json'],
      summarySha256: expected.metadataHashes['summary.json'],
    });
    expect(Object.keys(boundaryIndex)).toHaveLength(142); expect(Object.keys(boundarySteps)).toEqual(Object.keys(boundaryIndex));
    expect(uniqueBoundaryFiles).toHaveLength(140); expect(transitions).toHaveLength(297 - 158 + 1);
    expect(new Set(transitions.map(r => r.file)).size).toBe(140); expect(uniqueBoundaryFiles).toEqual(transitions.map(r => r.file));
    const members = [...new Set([...uniqueBoundaryFiles, ...Object.values(snapshotIndex)])].sort();
    expect(Object.keys(integrity.files).sort()).toEqual(members);
    expect(readdirSync(DIVINE_HAND_ROOT).sort()).toEqual([...Object.keys(expected.metadataHashes), ...members].sort());
    expect(members.length + Object.keys(expected.metadataHashes).length).toBe(157);
    for (const filename of members) {
      const path = capturePath(filename); expect(realpathSync(path), filename).toBe(resolve(path));
      expect(integrity.files[filename], filename).toMatch(/^[0-9a-f]{64}$/);
      expect(await captureFileHash(path), filename).toBe(integrity.files[filename]);
    }
    const byStep = new Map<number, CaptureTransition>(), bytes = new Set<string>(), finals = new Set<string>();
    const initialRevision = naturalEntry<SliceState>('initial').revision;
    expect(initialRevision).toBe(442);
    let previousFinalHash: string | null = null;
    for (const [index, row] of transitions.entries()) {
      const count = DIVINE_HAND_PREFIX_COUNT + index, path = capturePath(row.file);
      expect(Object.keys(row).sort()).toEqual(['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
      expect(row.commandIndex).toBe(count); expect(row.beforeRevision).toBe(initialRevision + count - 1); expect(row.afterRevision).toBe(initialRevision + count);
      expect(boundaryIndex[row.key]).toBe(row.file); expect(boundarySteps[row.key]).toBe(count);
      expect(readObjectEntry<number>(path, 'commandCount')).toBe(count); same(readObjectEntry<SliceIntent>(path, 'lastIntent'), captureCommands[count - 1]);
      const rawBefore = readObjectEntry<SliceState>(path, 'beforeLast');
      expect([rawBefore.schemaVersion, rawBefore.contentVersion]).toEqual([195, 'divine-hand-v195']);
      expect(rawBefore.revision).toBe(row.beforeRevision);
      if (previousFinalHash !== null) expect(captureValueHash(rawBefore), `Continuous full state at command ${count}`).toBe(previousFinalHash);
      else same(currentCapture(rawBefore), currentCapture(sourceEntry('beforeLast')));
      const raw = readObjectEntry<SliceState>(path, 'final');
      previousFinalHash = captureValueHash(raw);
      // Raw195 is frozen historical evidence; migrated assertions use only the
      // single shared current-format module, never copied current literals.
      expect([raw.schemaVersion, raw.contentVersion]).toEqual([195, 'divine-hand-v195']); expect(raw.revision).toBe(row.afterRevision);
      const final = currentCapture(raw); expect([final.schemaVersion, final.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      bytes.add(integrity.files[row.file]!); finals.add(captureValueHash(final)); byStep.set(count, row);
    }
    const firstNames = new Map<number, string>();
    for (const [name, filename] of Object.entries(boundaryIndex)) {
      const count = boundarySteps[name]!, row = byStep.get(count); expect(row, name).toBeDefined();
      expect(filename, `${name} aliases the same captured transition`).toBe(row!.file);
      if (!firstNames.has(count)) { expect(name).toBe(row!.key); firstNames.set(count, name); }
    }
    expect(firstNames.size).toBe(140); expect(bytes.size).toBe(140); expect(finals.size).toBe(140);
    expect(boundaryIndex['actual-potion-failure']).toBe(boundaryIndex['consume-divine-hand-potion-1']);
    expect(boundaryIndex.promotion).toBe(boundaryIndex['consume-divine-hand-potion-2']);
    for (const filename of Object.values(snapshotIndex)) {
      expect(readObjectEntry<number>(capturePath(filename), 'schemaVersion')).toBe(195);
      expect(readObjectEntry<string>(capturePath(filename), 'contentVersion')).toBe('divine-hand-v195');
    }
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(DIVINE_HAND_SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(expected.sourceSha256);
    expect(readObjectEntry(prefix, 'prefixCount')).toBe(158); expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(true);
    same(readObjectEntry(prefix, 'rawInitial'), sourceEntry('initial')); same(readObjectEntry(prefix, 'rawFinal'), sourceEntry('final'));
    same(readObjectEntry(prefix, 'commands'), sourceEntry('commands')); expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(expected.prefixSha256);
    same(currentCapture(sourceEntry('final')), currentCapture(naturalEntry('prefixFinal')));
    const steps = expected.sqliteRepresentatives.map(name => { expect(boundaryIndex[name], name).toBeDefined(); return boundarySteps[name]!; });
    expect(new Set(steps).size).toBe(14); expect(steps).toEqual([158, 159, 162, 194, 199, 227, 240, 260, 261, 279, 287, 290, 292, 297]);
    expect(steps.length).toBeLessThan(transitions.length);
  }, 420_000);

  it.each(expected.sqliteRepresentatives)('%s survives rollback, reopen, commit and idempotent retry', async name => {
    const filename = boundaryIndex[name]; if (!filename) throw new Error(`Missing SQLite representative: ${name}`);
    const path = capturePath(filename), originalHash = await captureFileHash(path); expect(originalHash).toBe(integrity.files[filename]);
    const save = boundaryFile(filename); expect(save.count).toBe(boundarySteps[name]); same(save.intent, captureCommands[save.count - 1]);
    if (save.count > DIVINE_HAND_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    assertObservedRepresentative(save);
    const currentFinal = save.intent.type === 'DIVINE_HAND' && save.intent.command.type === 'LEARN_GUIDANCE'
      ? currentDivineHandReplayExpectation(save.final) : save.final;
    exerciseSqlite(save.before, save.intent, currentFinal, `divine-hand198:${save.count}`);
    expect(await captureFileHash(path)).toBe(originalHash);
  }, 80_000);
});

function assertObservedRepresentative(save: ReturnType<typeof boundaryFile>): void {
  if (save.count === 158) {
    same(save.final, currentCapture(sourceEntry('final'))); expect(save.final.status).toBe('ACTIVE'); expect(save.final.health).toBe(90);
    expect(save.final.injuries.map(r => r.severity)).toEqual(['LIGHT']);
  } else if (save.count === 194 || save.count === 227) {
    expect(save.intent).toEqual({ type: 'DIVINE_HAND', command: { type: 'CONSUME', bottleId: `divine-hand-potion-${save.count === 194 ? 1 : 2}`, confirmed: true } });
    expect(save.final.divineHand.bottles.filter(b => b.status === 'CONSUMED').map(b => b.outcome)).toEqual(save.count === 194 ? ['FAILURE'] : ['FAILURE', 'SUCCESS']);
    expect(save.final.progression.sequence).toBe(save.count === 194 ? 2 : 1);
  } else if (save.count === 240 || save.count === 260) {
    expect(save.before.spirituality - save.final.spirituality).toBe(8); expect(save.before.mind - save.final.mind).toBe(2);
    expect(save.final.divineHand.life.pending).toBeNull(); same(save.before.progression.mastery, save.final.progression.mastery);
  } else if (save.count === 261) {
    expect(save.intent).toEqual({ type: 'DIVINE_HAND', command: { type: 'APPLY_LOAD' } });
    expect([save.before.glory.life.site.armor!.integrity, save.final.glory.life.site.armor!.integrity]).toEqual([60, 55]);
    expect(save.before.health - save.final.health).toBe(6); same(save.final.glory.life.site.load, save.before.glory.life.site.load);
  } else if (save.count === 279) {
    expect(save.intent).toEqual({ type: 'DIVINE_HAND', command: { type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' } });
    expect(save.final.divineHand.life.cases['withdrawn-support'].attempts.at(-1)!.permission.participant).toBe('WITHDRAWN');
    expect(save.before.divineHand.life.pending).toBeNull(); expect(save.final.divineHand.life.pending).toBeNull(); same(save.before.random, save.final.random);
  } else if (save.count === 292) {
    expect(save.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect([save.before.glory.life.site.armor!.integrity, save.final.glory.life.site.armor!.integrity]).toEqual([55, 50]);
    expect(save.final.combatHistory.at(-1)!.divineHandOutcome!.enemyActions.filter(a => a.masteryApplied.includes('warrior.s1.armor-convergence'))).toHaveLength(1);
  } else if (save.count === 297) {
    same(captureBody(save.final), expected.final); expect(save.final.status).toBe('DEAD'); expect(save.final.health).toBe(0);
    expect(save.final.divineHand.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 7, enemyHealth: 100, enemyStatus: 'RESISTING', exitMetres: 0 });
  }
}

// These bytes include current and rolling-backup snapshots, timestamps,
// receipts and active-run metadata. State equality alone cannot prove rollback.
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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-divine-hand-representative-save-')), database = join(directory, 'boundary.sqlite');
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
      app!.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' });
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
      expect(readFileSync(`${database}.sealed`).equals(sealed), 'The actual297-command death marker remains exact').toBe(true);
    } else expect(existsSync(`${database}.sealed`), 'A living representative never creates a death seal').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
