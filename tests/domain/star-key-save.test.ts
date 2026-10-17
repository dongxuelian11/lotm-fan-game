import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { actualStarKeyEvidence } from './star-key-capture-evidence.js';
import { STAR_KEY_ROOT, STAR_KEY_SOURCE, STAR_KEY_SOURCE_SHA, STAR_KEY_PEACEFUL_SOURCE, STAR_KEY_PEACEFUL_SHA,
  STAR_KEY_WANDERER_DEATH_SOURCE, STAR_KEY_WANDERER_DEATH_SHA, STAR_KEY_PREFIX_COUNT,
  boundaryIndex, boundarySteps, snapshotIndex, uniqueBoundaryFiles, captureCommands, capturePath, captureFileHash,
  captureValueHash, captureBody, boundaryFile, capturedState, currentCapture, sourceEntry,
  assertPublicCaptureControl, sameCaptureValue as same, CAPTURE_BOUNDARY_TIMEOUT } from './star-key-capture-helper.js';

const expected = actualStarKeyEvidence();
const integrity = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/capture-integrity.json`, 'utf8')) as {
  naturalSha256: string; producerSha256: string; commandsSha256: string; publicSha256: string; boundaryIndexSha256: string;
  boundaryStepsSha256: string; summarySha256: string; sourcePrefixSha256: string; files: Record<string, string>;
};

describe('Star Key immutable named captures and actual SQLite recovery', () => {
  it('pins every capture and counts genuine aliases separately from unique transitions', async () => {
    for (const [name, hash] of [
      ['natural.json', expected.naturalSha256], ['boundaries.index.json', expected.boundaryIndexSha256],
      ['boundaries.steps.json', expected.boundaryStepsSha256], ['capture-integrity.json', expected.integritySha256],
      ['summary.json', expected.summarySha256], ['commands.jsonl', expected.commandsSha256],
      ['public.jsonl', expected.publicSha256], ['source-prefix.json', expected.sourcePrefixSha256],
    ]) expect(await captureFileHash(`${STAR_KEY_ROOT}/${name}`), name).toBe(hash);
    expect(await captureFileHash(STAR_KEY_SOURCE)).toBe(STAR_KEY_SOURCE_SHA);
    expect(await captureFileHash(STAR_KEY_PEACEFUL_SOURCE)).toBe(STAR_KEY_PEACEFUL_SHA);
    expect(await captureFileHash(STAR_KEY_WANDERER_DEATH_SOURCE)).toBe(STAR_KEY_WANDERER_DEATH_SHA);
    expect(await captureFileHash('scripts/play/star-key-stage.mjs')).toBe(expected.producerSha256);
    if (expected.resumeVerificationSha256) {
      const resume = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/resume-verification.json`, 'utf8')) as { preservedFiles: Record<string, string> };
      expect(await captureFileHash(`${STAR_KEY_ROOT}/resume-verification.json`)).toBe(expected.resumeVerificationSha256);
      expect(resume).toMatchObject(expected.continuationSource!);
      same(resume, readObjectEntry<unknown>(`${STAR_KEY_ROOT}/natural.json`, 'continuationSource'));
      for (const [filename, hash] of Object.entries(resume.preservedFiles)) {
        expect(filename).toMatch(/^prior-blocker-(?:natural\.json|summary\.json|capture-integrity\.json|boundaries\.index\.json|boundaries\.steps\.json|commands\.jsonl|public\.jsonl)$/);
        expect(await captureFileHash(`${STAR_KEY_ROOT}/${filename}`), filename).toBe(hash);
      }
    }

    expect(integrity).toMatchObject({ naturalSha256: expected.naturalSha256, producerSha256: expected.producerSha256,
      commandsSha256: expected.commandsSha256, publicSha256: expected.publicSha256, boundaryIndexSha256: expected.boundaryIndexSha256,
      boundaryStepsSha256: expected.boundaryStepsSha256, summarySha256: expected.summarySha256, sourcePrefixSha256: expected.sourcePrefixSha256 });
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames);
    expect(uniqueBoundaryFiles).toHaveLength(expected.uniqueBoundaryFiles);
    expect(uniqueBoundaryFiles.length).toBe(Object.keys(boundaryIndex).length);
    expect(Object.keys(boundarySteps)).toEqual(Object.keys(boundaryIndex));
    expect(Object.keys(integrity.files).sort()).toEqual([...new Set([...uniqueBoundaryFiles, ...Object.values(snapshotIndex)])].sort());
    const bytes = new Set<string>(), finals = new Set<string>(), unique = new Map<number, { name: string; sha: string; final: string }>();
    for (const [name, filename] of Object.entries(boundaryIndex)) {
      const path = capturePath(filename), sha = await captureFileHash(path);
      expect(sha, name).toBe(integrity.files[filename]); bytes.add(sha);
      const count = readObjectEntry<number>(path, 'commandCount'); expect(count).toBe(boundarySteps[name]);
      const rawFinal = readObjectEntry<SliceState>(path, 'final');
      // Raw historical format and migrated current format are separate claims.
      expect([rawFinal.schemaVersion, rawFinal.contentVersion]).toEqual([193, 'star-key-v193']);
      const final = migrateSliceState(rawFinal);
      expect([final.schemaVersion, final.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      const finalSha = captureValueHash(final); finals.add(finalSha);
      const prior = unique.get(count);
      if (prior) { expect(sha, `${name} must be the exact same captured transition as ${prior.name}`).toBe(prior.sha); expect(finalSha).toBe(prior.final); }
      else {
        expect(count).toBe(STAR_KEY_PREFIX_COUNT + unique.size);
        unique.set(count, { name, sha, final: finalSha });
      }
    }
    expect(unique.size).toBe(expected.commandCount - STAR_KEY_PREFIX_COUNT + 1);
    expect(bytes.size).toBe(expected.uniqueBoundaryBytes); expect(finals.size).toBe(expected.uniqueBoundaryFinalStates);
    expect([...unique.keys()]).toEqual(Array.from({ length: expected.commandCount - STAR_KEY_PREFIX_COUNT + 1 }, (_, i) => STAR_KEY_PREFIX_COUNT + i));
    for (const filename of Object.values(snapshotIndex)) expect(await captureFileHash(capturePath(filename)), filename).toBe(integrity.files[filename]);
    expect(expected.sqliteRepresentatives.length).toBeGreaterThan(0);
    expect(new Set(expected.sqliteRepresentatives).size).toBe(expected.sqliteRepresentatives.length);
    expect(new Set(expected.sqliteRepresentatives.map(name => boundarySteps[name])).size).toBe(expected.sqliteRepresentatives.length);
    for (const name of expected.sqliteRepresentatives) expect(boundaryIndex[name], name).toBeDefined();
  }, Math.max(180_000, expected.uniqueBoundaryFiles * 3_000));

  // scripts/play/star-key-save.mjs owns exhaustive real SQLite verification.
  // CI repeats literal observed representatives, rather than silently opening
  // a second full database suite or manufacturing a new player-death branch.
  it.each(expected.sqliteRepresentatives)('%s survives rollback, reopen, commit and idempotent retry', async name => {
    const filename = boundaryIndex[name]; if (!filename) throw new Error(`Missing SQLite representative: ${name}`);
    const path = capturePath(filename), originalHash = await captureFileHash(path); expect(originalHash).toBe(integrity.files[filename]);
    const save = boundaryFile(filename); same(save.intent, captureCommands[save.count - 1]);
    expect(save.count).toBeGreaterThanOrEqual(STAR_KEY_PREFIX_COUNT); expect(save.count).toBeLessThanOrEqual(captureCommands.length);
    if (save.count > STAR_KEY_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    exerciseSqlite(save.before, save.intent, save.final, `star-key196:${save.count}`);
    expect(await captureFileHash(path)).toBe(originalHash);
  }, CAPTURE_BOUNDARY_TIMEOUT);

  it('keeps the independent original707-command player death sealed after actual replay and reopening', async () => {
    const sha = await captureFileHash(STAR_KEY_SOURCE); expect(sha).toBe(STAR_KEY_SOURCE_SHA);
    const commands = sourceEntry<SliceIntent[]>('commands'); expect(commands).toHaveLength(707);
    const before = currentCapture(sourceEntry<unknown>('beforeLast')), intent = sourceEntry<SliceIntent>('lastIntent'), final = currentCapture(sourceEntry<unknown>('final'));
    same(intent, commands.at(-1)); expect(final.status).toBe('DEAD'); expect(final.health).toBe(0);
    expect(final.revision).toBe(1015); expect(final.random).toEqual({ seed: 'secrets-sorcerer-directed-24', cursor: 147 });
    exerciseSqlite(before, intent, final, 'star-key196:original707');
    expect(await captureFileHash(STAR_KEY_SOURCE)).toBe(sha);
    const oldWanderer = readObjectEntry<SliceState>(STAR_KEY_WANDERER_DEATH_SOURCE, 'final');
    expect(oldWanderer.status).toBe('DEAD'); expect(oldWanderer.health).toBe(0);
    expect(readObjectEntry<SliceIntent[]>(STAR_KEY_WANDERER_DEATH_SOURCE, 'commands')).toHaveLength(209);
    expect(await captureFileHash(STAR_KEY_WANDERER_DEATH_SOURCE)).toBe(STAR_KEY_WANDERER_DEATH_SHA);
  }, CAPTURE_BOUNDARY_TIMEOUT);
});

function exerciseSqlite(before: SliceState, intent: SliceIntent, final: SliceState, intentId: string): void {
  expect(before.status).toBe('ACTIVE'); expect(final.revision).toBe(before.revision + 1); expect(final.runId).toBe(before.runId);
  assertValidSliceState(before); assertValidSliceState(final);
  const directory = mkdtempSync(join(tmpdir(), 'lotm-star-key-actual-save-')), database = join(directory, 'boundary.sqlite');
  let app: SqliteSliceStore | undefined, fail = false;
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  try {
    app = new SqliteSliceStore(database, { beforeWrite: () => { if (fail) throw new Error('injected actual-boundary write failure'); } });
    app.repository.transaction(() => { app!.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' }); app!.repository.selectRun(before.runId); });
    fail = true; const rejected = app.submitIntent(envelope); expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Injected rollback unexpectedly committed'); expect(rejected.error.code).toBe('SAVE_FAILED');
    same(app.repository.get(before.runId)!.state, before); expect(app.repository.receipt(intentId)).toBeNull(); expect(existsSync(`${database}.sealed`)).toBe(false);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    same(app.repository.get(before.runId)!.state, before); expect(app.repository.activeRun()).toBe(before.runId); expect(app.repository.receipt(intentId)).toBeNull();
    const committed = app.submitIntent(envelope); expect(committed.ok).toBe(true); if (!committed.ok) throw new Error(JSON.stringify(committed.error));
    expect(committed.value.replayed).toBe(false); same(committed.value.state, projectSliceState(final));
    same(app.repository.get(final.runId)!.state, final); same(captureBody(app.repository.get(final.runId)!.state), captureBody(final));
    same(app.repository.receipt(intentId)!.receipt, committed.value);
    app.close(); app = undefined; app = new SqliteSliceStore(database);
    same(app.repository.get(final.runId)!.state, final); expect(app.repository.activeRun()).toBe(final.runId);
    const retried = app.submitIntent(envelope); expect(retried.ok).toBe(true); if (!retried.ok) throw new Error(JSON.stringify(retried.error));
    same(retried.value, { ...committed.value, replayed: true }); same(app.repository.get(final.runId)!.state, final);
    if (final.status === 'DEAD') {
      same(JSON.parse(readFileSync(`${database}.sealed`, 'utf8')), [final.runId]); expect(projectSliceState(final).canAct).toBe(false);
      const blocked = app.submitIntent({ intentId: `${intentId}:sealed`, runId: final.runId, expectedRevision: final.revision, payload: { type: 'ACTION', action: 'REST' } });
      expect(blocked.ok).toBe(false); if (blocked.ok) throw new Error('A sealed original death accepted a new action');
      expect(blocked.error.code).toBe('ARCHIVED'); expect(app.repository.receipt(`${intentId}:sealed`)).toBeNull(); same(app.repository.get(final.runId)!.state, final);
    } else expect(existsSync(`${database}.sealed`)).toBe(false);
  } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
}

interface Forgery { name: string; change: (state: SliceState) => void }
const forgeries: Forgery[] = [
  { name: 'rewrite the frozen original history door', change: s => { s.starKey.sourceHistory!.planeswalker.life.site.door.operations++; } },
  { name: 'invent free paid-guidance budget', change: s => { s.starKey.sourceScene!.budget.cash++; } },
  { name: 'refund a real acquisition payment', change: s => { s.starKey.acquisitionJournal[0]!.after.cash++; } },
  { name: 'replace the first actual potion draw', change: s => { const row = s.starKey.acquisitionJournal.find(row => row.command.type === 'CONSUME')!; row.check = { ...row.check!, roll: row.check!.roll === 1 ? 2 : 1 }; } },
  { name: 'return an actually consumed bottle to stock', change: s => { s.starKey.bottles.find(row => row.status === 'CONSUMED')!.status = 'SUPPLIER'; } },
  { name: 'add an unlearned eighteenth skill', change: s => { s.progression.mastery['door.s1.fabricated'] = 0; } },
  { name: 'restore original lamp oil without a source receipt', change: s => { s.planeswalker.life.site.lamp.oilRemaining++; } },
  { name: 'restore Mara energy without actual recovery', change: s => { s.planeswalker.life.site.operatorEnergy++; } },
  { name: 'erase original parcel travel', change: s => { s.planeswalker.life.site.parcel.ordinaryMetres = 0; } },
  { name: 'replace historical source consent', change: s => { s.starKey.sourceScene!.originals.site.operatorConsent = 'GRANTED'; } },
  { name: 'invent a fourth independent enemy mark', change: s => { s.starKey.encounter.materials.marks.push(structuredClone(s.starKey.encounter.materials.marks[0]!)); } },
  { name: 'erase an original zero-mastery skill', change: s => { delete s.progression.mastery['door.s5.invisible-hand']; } },
  { name: 'award anchor mastery for failed or withdrawn applications', change: s => { s.progression.mastery['door.s1.anchor-maintenance'] = 8; } },
  { name: 'invent an effect for the actual failed anchor cast', change: s => { s.starKey.life.cases['anchor-transfer'].attempts[0]!.anchor.effects = 1; } },
  { name: 'apply the actual successful but withdrawn anchor window', change: s => { s.starKey.life.cases['withdrawn-return'].attempts[0]!.anchor.effects = 1; } },
  { name: 'turn Mara actual withdrawal into consent', change: s => { s.starKey.life.cases['withdrawn-return'].attempts[0]!.permission.operator = 'GRANTED'; } },
  { name: 'restore an actual spent enemy mark', change: s => { s.starKey.encounter.materials.marks[0]!.status = 'HELD'; } },
  { name: 'revive the independently dead Rowan', change: s => { s.starKey.encounter.enemyHealth = 100; s.starKey.encounter.enemyStatus = 'RESISTING'; } },
  { name: 'restore an already consumed random position', change: s => { s.random.cursor--; } },
];

describe('Star Key save rejects forged source and resource records', () => {
  it('rejects every changed record without mutation or persistence', () => {
    const valid = capturedState('final'), originalHash = captureValueHash(valid), directory = mkdtempSync(join(tmpdir(), 'lotm-star-key-forgery-'));
    let app: SqliteSliceStore | undefined;
    try {
      app = new SqliteSliceStore(join(directory, 'forgery.sqlite'));
      app.repository.transaction(() => app!.repository.put({ state: valid, updatedAt: '2026-10-15T00:00:00.000Z' }));
      for (const { name, change } of forgeries) {
        const forged = structuredClone(valid); change(forged); const hash = captureValueHash(forged);
        expect(hash, name).not.toBe(originalHash);
        expect(() => assertValidSliceState(forged), name).toThrow(); expect(captureValueHash(forged), name).toBe(hash);
        expect(() => migrateSliceState(forged), name).toThrow(); expect(captureValueHash(forged), name).toBe(hash);
        expect(() => app!.repository.transaction(() => app!.repository.put({ state: forged, updatedAt: '2026-10-15T00:01:00.000Z' })), name).toThrow();
        same(app.repository.get(valid.runId)!.state, valid); expect(captureValueHash(forged), name).toBe(hash);
      }
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, Math.max(180_000, forgeries.length * 3_000));
});
