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
import { actualTimeWormEvidence } from './time-worm-capture-evidence.js';
import { TIME_WORM_ROOT, TIME_WORM_SOURCE, TIME_WORM_PEACEFUL_SOURCE, TIME_WORM_DEATH_SOURCE,
  TIME_WORM_PREFIX_COUNT, boundaryIndex, boundarySteps, snapshotIndex, uniqueBoundaryFiles,
  captureCommands, capturePath, captureFileHash, captureValueHash, captureBody, boundaryFile,
  currentCapture, sourceEntry, naturalEntry, assertPublicCaptureControl, sameCaptureValue as same,
} from './time-worm-capture-helper.js';

const expected = actualTimeWormEvidence();
const SQLITE_REPRESENTATIVE_TIMEOUT = 80_000;
interface CaptureIntegrity {
  naturalSha256: string; producerSha256: string; originalProducerSha256: string; finalProducerSha256: string;
  commandsSha256: string; publicSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string;
  transitionsSha256: string; summarySha256: string; sourcePrefixSha256: string; resumeVerificationSha256: string;
  continuationSource: Record<string, unknown>; files: Record<string, string>;
}
interface CaptureTransition {
  key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number;
}
const integrity = JSON.parse(readFileSync(`${TIME_WORM_ROOT}/capture-integrity.json`, 'utf8')) as CaptureIntegrity;
const transitions = JSON.parse(readFileSync(`${TIME_WORM_ROOT}/transitions.json`, 'utf8')) as CaptureTransition[];

describe('Time Worm immutable capture integrity and representative actual SQLite recovery', () => {
  it('pins every input byte and indexes aliases separately from all actual transitions', async () => {
    const metadata: Record<string, string> = {
      'natural.json': expected.naturalSha256,
      'summary.json': expected.summarySha256,
      'commands.jsonl': expected.commandsSha256,
      'public.jsonl': expected.publicSha256,
      'source-prefix.json': expected.sourcePrefixSha256,
      'boundaries.index.json': expected.boundaryIndexSha256,
      'boundaries.steps.json': expected.boundaryStepsSha256,
      'transitions.json': expected.transitionsSha256,
      'capture-integrity.json': expected.integritySha256,
      'resume-verification.json': expected.resumeVerificationSha256,
    };
    for (const [name, hash] of Object.entries(metadata)) {
      expect(hash, name).toMatch(/^[0-9a-f]{64}$/);
      expect(await captureFileHash(join(TIME_WORM_ROOT, name)), name).toBe(hash);
    }
    for (const [path, hash] of [
      [TIME_WORM_SOURCE, expected.sourceSha256],
      [TIME_WORM_PEACEFUL_SOURCE, expected.peacefulSha256],
      [TIME_WORM_DEATH_SOURCE, expected.originalDeathSha256],
      ['scripts/play/time-worm-stage.mjs', expected.producerSha256],
    ] as const) expect(await captureFileHash(path), path).toBe(hash);
    expect(integrity).toMatchObject({
      naturalSha256: expected.naturalSha256, producerSha256: expected.producerSha256,
      originalProducerSha256: expected.originalProducerSha256, finalProducerSha256: expected.producerSha256,
      commandsSha256: expected.commandsSha256, publicSha256: expected.publicSha256,
      boundaryIndexSha256: expected.boundaryIndexSha256, boundaryStepsSha256: expected.boundaryStepsSha256,
      transitionsSha256: expected.transitionsSha256, summarySha256: expected.summarySha256,
      sourcePrefixSha256: expected.sourcePrefixSha256, resumeVerificationSha256: expected.resumeVerificationSha256,
    });
    const resume = JSON.parse(readFileSync(capturePath('resume-verification.json'), 'utf8')) as {
      preservedFiles: Record<string, string>;
    };
    same(resume, expected.continuationSource);
    same(resume, integrity.continuationSource);
    same(resume, naturalEntry('continuationSource'));
    same(resume.preservedFiles, expected.preservedFailureFiles);
    for (const [name, hash] of Object.entries(expected.preservedFailureFiles)) {
      expect(name).toMatch(/^prior-blocker-(?:natural\.json|summary\.json|capture-integrity\.json|boundaries\.index\.json|boundaries\.steps\.json|transitions\.json|commands\.jsonl|public\.jsonl|source-prefix\.json)$/);
      expect(await captureFileHash(join(TIME_WORM_ROOT, name)), name).toBe(hash);
    }

    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames);
    expect(Object.keys(boundarySteps)).toEqual(Object.keys(boundaryIndex));
    expect(uniqueBoundaryFiles).toHaveLength(expected.uniqueBoundaryFiles);
    expect(transitions).toHaveLength(expected.commandCount - TIME_WORM_PREFIX_COUNT + 1);
    expect(new Set(transitions.map(row => row.file)).size).toBe(transitions.length);
    expect(uniqueBoundaryFiles).toEqual(transitions.map(row => row.file));
    const members = [...new Set([...uniqueBoundaryFiles, ...Object.values(snapshotIndex)])].sort();
    expect(Object.keys(integrity.files).sort()).toEqual(members);
    expect(readdirSync(TIME_WORM_ROOT).sort()).toEqual([
      ...Object.keys(metadata), ...members, ...Object.keys(expected.preservedFailureFiles),
    ].sort());
    for (const filename of members) {
      const path = capturePath(filename);
      expect(realpathSync(path), filename).toBe(resolve(path));
      expect(integrity.files[filename], filename).toMatch(/^[0-9a-f]{64}$/);
      expect(await captureFileHash(path), filename).toBe(integrity.files[filename]);
    }

    const byStep = new Map<number, CaptureTransition>();
    const bytes = new Set<string>(), finals = new Set<string>();
    for (const [index, transition] of transitions.entries()) {
      const count = TIME_WORM_PREFIX_COUNT + index, path = capturePath(transition.file);
      expect(Object.keys(transition).sort()).toEqual(['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
      expect(transition.commandIndex).toBe(count);
      expect(transition.beforeRevision).toBe(count);
      expect(transition.afterRevision).toBe(count + 1);
      expect(boundaryIndex[transition.key]).toBe(transition.file);
      expect(boundarySteps[transition.key]).toBe(count);
      expect(readObjectEntry<number>(path, 'commandCount')).toBe(count);
      same(readObjectEntry<SliceIntent>(path, 'lastIntent'), captureCommands[count - 1]);
      const rawFinal = readObjectEntry<SliceState>(path, 'final');
      // Recorded194 bytes are historical evidence; current output uses the
      // shared format constants only after migration.
      expect([rawFinal.schemaVersion, rawFinal.contentVersion]).toEqual([194, 'time-worm-v194']);
      expect(rawFinal.revision).toBe(transition.afterRevision);
      const final = currentCapture(rawFinal);
      expect([final.schemaVersion, final.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      bytes.add(integrity.files[transition.file]!); finals.add(captureValueHash(final));
      byStep.set(count, transition);
    }
    const firstNames = new Map<number, string>();
    for (const [name, filename] of Object.entries(boundaryIndex)) {
      const count = boundarySteps[name]!, transition = byStep.get(count);
      expect(transition, name).toBeDefined();
      expect(filename, `${name} aliases the exact same file, never a second outcome`).toBe(transition!.file);
      if (!firstNames.has(count)) { expect(name).toBe(transition!.key); firstNames.set(count, name); }
    }
    expect(firstNames.size).toBe(transitions.length);
    expect(bytes.size).toBe(expected.uniqueBoundaryBytes);
    expect(finals.size).toBe(expected.uniqueBoundaryFinalStates);
    for (const filename of Object.values(snapshotIndex)) {
      expect(readObjectEntry<number>(capturePath(filename), 'schemaVersion')).toBe(194);
      expect(readObjectEntry<string>(capturePath(filename), 'contentVersion')).toBe('time-worm-v194');
    }
    expect(captureCommands).toHaveLength(expected.commandCount);
    const rawSource = sourceEntry<SliceState>('final');
    expect([rawSource.schemaVersion, rawSource.contentVersion]).toEqual([172, 'fate-trojan-v172']);
    same(currentCapture(rawSource), currentCapture(naturalEntry('prefixFinal')));
    const representativeSteps = expected.sqliteRepresentatives.map(name => {
      expect(boundaryIndex[name], name).toBeDefined(); return boundarySteps[name]!;
    });
    expect(new Set(expected.sqliteRepresentatives).size).toBe(expected.sqliteRepresentatives.length);
    expect(new Set(representativeSteps).size).toBe(expected.sqliteRepresentatives.length);
    for (const count of [551, 592, 621, 639, 640, 654, 655, expected.commandCount]) expect(representativeSteps).toContain(count);
    expect(representativeSteps.length).toBeLessThan(transitions.length);
  }, Math.max(180_000, expected.uniqueBoundaryFiles * 3_000));

  // scripts/play/time-worm-save.mjs owns exhaustive real SQLite verification.
  // CI repeats these literal observed representatives only. Potion1 actually
  // succeeded; no failed potion or player-death continuation is manufactured.
  it.each(expected.sqliteRepresentatives)('%s survives rollback, reopen, commit and idempotent retry', async name => {
    const filename = boundaryIndex[name];
    if (!filename) throw new Error(`Missing SQLite representative: ${name}`);
    const path = capturePath(filename), originalHash = await captureFileHash(path);
    expect(originalHash).toBe(integrity.files[filename]);
    const save = boundaryFile(filename);
    expect(save.count).toBe(boundarySteps[name]);
    same(save.intent, captureCommands[save.count - 1]);
    if (save.count > TIME_WORM_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    assertObservedRepresentative(save);
    exerciseSqlite(save.before, save.intent, save.final, `time-worm197:${save.count}`);
    expect(await captureFileHash(path)).toBe(originalHash);
  }, SQLITE_REPRESENTATIVE_TIMEOUT);

  it('independently replays and seals the immutable old456-command death after reopening', async () => {
    const sha = await captureFileHash(TIME_WORM_DEATH_SOURCE);
    expect(sha).toBe(expected.originalDeathSha256);
    const commands = readObjectEntry<SliceIntent[]>(TIME_WORM_DEATH_SOURCE, 'commands');
    expect(commands).toHaveLength(456);
    const livingCommands = sourceEntry<SliceIntent[]>('commands');
    same(commands.slice(0, 449), livingCommands.slice(0, 449));
    same(livingCommands.slice(449, 451), [{ type: 'DECEIT_MENTOR', command: { type: 'LEAVE_ENCOUNTER' } }, { type: 'ACTION', action: 'WORK' }]);
    same(commands.slice(449, 451), [{ type: 'DECEIT_MENTOR', command: { type: 'ENCOUNTER_FIGHT' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }]);
    const rawFinal = readObjectEntry<SliceState>(TIME_WORM_DEATH_SOURCE, 'final');
    expect([rawFinal.schemaVersion, rawFinal.contentVersion]).toEqual([149, 'deceit-mentor-v149']);
    const before = currentCapture(readObjectEntry<unknown>(TIME_WORM_DEATH_SOURCE, 'beforeLast'));
    const intent = readObjectEntry<SliceIntent>(TIME_WORM_DEATH_SOURCE, 'lastIntent'), final = currentCapture(rawFinal);
    same(intent, commands.at(-1));
    expect(final.status).toBe('DEAD'); expect(final.health).toBe(0);
    expect(final.revision).toBe(457); expect(final.week).toBe(108);
    expect(final.random).toEqual({ seed: 'marauder-natural-v038', cursor: 319 });
    exerciseSqlite(before, intent, final, 'time-worm197:original456');
    expect(await captureFileHash(TIME_WORM_DEATH_SOURCE)).toBe(sha);
    expect(await captureFileHash(TIME_WORM_SOURCE)).toBe(expected.sourceSha256);
  }, SQLITE_REPRESENTATIVE_TIMEOUT);
});

function assertObservedRepresentative(save: ReturnType<typeof boundaryFile>): void {
  if (save.count === 551) {
    same(save.final, currentCapture(sourceEntry('final')));
    expect(save.final.status).toBe('ACTIVE'); expect(save.final.health).toBe(40);
    expect(save.final.injuries.map(row => row.severity)).toEqual(['LIGHT', 'LIGHT', 'HEAVY']);
  } else if (save.count === 592) {
    expect(save.intent).toEqual({ type: 'TIME_WORM', command: { type: 'CONSUME', bottleId: 'time-worm-potion-1', confirmed: true } });
    expect(save.before.progression.sequence).toBe(2); expect(save.final.progression.sequence).toBe(1);
    expect(save.final.timeWorm.bottles.filter(row => row.status === 'CONSUMED').map(row => row.outcome)).toEqual(['SUCCESS']);
  } else if (save.count === 621) {
    expect(save.intent).toEqual({ type: 'TIME_WORM', command: { type: 'SHORT_TIME_THEFT' } });
    expect(save.final.timeWorm.life.cases['released-interval'].attempts.at(-1)!.theft)
      .toEqual({ attempts: 1, successes: 0, effects: 0, tier: 'FAILURE', state: 'FAILED' });
    expect(save.final.spirituality).toBe(save.before.spirituality - 8);
    expect(save.final.mind).toBe(save.before.mind - 2); expect(save.final.timeWorm.life.pending).toBeNull();
  } else if (save.count === 639) {
    expect(save.intent).toEqual({ type: 'TIME_WORM', command: { type: 'WITHDRAW_CONSENT', permission: 'ABILITY' } });
    expect(save.before.timeWorm.life.pending?.state).toBe('STORED'); expect(save.final.timeWorm.life.pending).toBeNull();
    const prior = save.before.timeWorm.life.cases['withdrawn-delay'].attempts.at(-1)!;
    const after = save.final.timeWorm.life.cases['withdrawn-delay'].attempts.at(-1)!;
    expect(prior.permission.ability).toBe('GRANTED'); expect(after.permission.ability).toBe('WITHDRAWN');
    same(after.declaration, prior.declaration);
    expect(after.declaration).toMatchObject({ state: 'DELAYED', dueAt: 890, delayedSeconds: 1, executedAt: null });
    expect(save.final.timeWorm.life.clockSeconds).toBe(888);
    same({ ...captureBody(save.final), revision: save.before.revision }, captureBody(save.before));
  } else if (save.count === 640) {
    expect(save.intent).toEqual({ type: 'TIME_WORM', command: { type: 'WAIT_1' } });
    same(save.before, currentCapture(readObjectEntry<unknown>(capturePath('prior-blocker-natural.json'), 'final')));
    expect(save.before.timeWorm.life.clockSeconds).toBe(888); expect(save.final.timeWorm.life.clockSeconds).toBe(889);
    expect(save.final.timeWorm.life.pending).toBeNull(); same(save.final.random, save.before.random);
    expect(save.final.timeWorm.life.cases['withdrawn-delay'].attempts.at(-1)!.declaration)
      .toMatchObject({ state: 'DELAYED', dueAt: 890, delayedSeconds: 2, executedAt: null });
    expect(save.final.actionsRemaining).toBe(save.before.actionsRemaining); expect(save.final.week).toBe(save.before.week);
  }
  if (save.count === 654 || save.count === 655) {
    expect(save.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(save.final.combatHistory.length).toBe(save.before.combatHistory.length + 1);
    expect(save.final.combatHistory.at(-1)!.timeWormOutcome).toBeDefined();
  }
  if (save.count === 655 || save.count === expected.commandCount) {
    expect(save.final.status).toBe('ACTIVE');
    expect(save.final.timeWorm.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, exitMetres: 4, exitSeconds: 4 });
  }
  if (save.count === expected.commandCount) same(captureBody(save.final), expected.final);
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
  const directory = mkdtempSync(join(tmpdir(), 'lotm-time-worm-representative-save-')), database = join(directory, 'boundary.sqlite');
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
      expect(readFileSync(`${database}.sealed`).equals(sealed), 'The independent death marker remains exact').toBe(true);
    } else expect(existsSync(`${database}.sealed`), 'A living continuation is never relabeled as a sealed player death').toBe(false);
    expect(captureValueHash(before)).toBe(beforeHash); expect(captureValueHash(final)).toBe(finalHash);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}
