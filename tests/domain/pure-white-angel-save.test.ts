import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { actualPureWhiteAngelEvidence } from './pure-white-angel-capture-evidence.js';
import { PURE_WHITE_ROOT, PURE_WHITE_PREFIX_COUNT, boundaryIndex, uniqueBoundaryFiles, captureCommands, capturePath, captureFileHash,
  captureValueHash, boundaryFile, namedBoundary, capturedState, assertPublicCaptureControl, sameCaptureValue as same,
  snapshotIndex, CAPTURE_BOUNDARY_TIMEOUT } from './pure-white-angel-capture-helper.js';

const expected = actualPureWhiteAngelEvidence();
const integrity = JSON.parse(readFileSync(`${PURE_WHITE_ROOT}/capture-integrity.json`, 'utf8')) as {
  naturalSha256: string; producerSha256: string; files: Record<string, string>;
};
const aliases = [
  ['step-742-action', 'original-injuries-actually-treated-and-later-rested'],
  ['combat-round-1', 'actual-ordinary-encounter-exit'],
] as const;
const sqliteRepresentatives = [
  'actual-clinic-pay60',
  'actual-consumption-pure-white-angel-potion-1',
  'residue-trace-separate-actual-will18-check-and-finite-unit-result',
  'personal-impact-one-paid-personal-guard-attempt',
  'screened-return-one-paid-personal-guard-attempt',
  'screened-return-ivan-actual24metre-walk-and-original-shutter-close-wear',
  'screened-return-current-mara-withdrawal',
  'screened-return-ordinary-safe-reset-with-pad10-no-impact-release',
  'combat-round-1',
  'actual-paid-work-after-living-exit',
] as const;

describe('Pure White Angel exhaustive capture validation and representative SQLite recovery', () => {
  it('validates all127 names/files and125 real transition payloads, preserving both explicit aliases', async () => {
    const names = Object.keys(boundaryIndex);
    expect(names).toHaveLength(expected.boundaryNames); expect(names.length).toBeGreaterThan(0);
    expect(uniqueBoundaryFiles).toHaveLength(expected.uniqueBoundaryFiles);
    expect(await captureFileHash(`${PURE_WHITE_ROOT}/boundaries.index.json`)).toBe(expected.boundaryIndexSha256);
    expect(await captureFileHash(`${PURE_WHITE_ROOT}/capture-integrity.json`)).toBe(expected.integritySha256);
    expect(integrity.naturalSha256).toBe(expected.naturalSha256); expect(integrity.producerSha256).toBe(expected.producerSha256);
    expect(Object.keys(integrity.files).sort()).toEqual([...new Set([...uniqueBoundaryFiles, ...Object.values(snapshotIndex)])].sort());
    const byteHashes = new Set<string>(), stateHashes = new Set<string>(), commandCounts = new Set<number>();
    for (const filename of uniqueBoundaryFiles) {
      const path = capturePath(filename);
      const hash = await captureFileHash(path); expect(hash, filename).toBe(integrity.files[filename]); byteHashes.add(hash);
      // Stream each state independently, never JSON.parse the multi-state document.
      const rawFinal = readObjectEntry<unknown>(path, 'final');
      expect(rawFinal).toMatchObject({ schemaVersion: 191, contentVersion: 'pure-white-angel-v191' });
      const final = migrateSliceState(rawFinal), before = migrateSliceState(readObjectEntry<unknown>(path, 'beforeLast'));
      assertValidSliceState(before); assertValidSliceState(final);
      expect([before.schemaVersion, before.contentVersion, final.schemaVersion, final.contentVersion])
        .toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      expect(before.status).toBe('ACTIVE'); expect(final.runId).toBe(before.runId); expect(final.revision).toBe(before.revision + 1);
      const count = readObjectEntry<number>(path, 'commandCount');
      expect(final.revision).toBe(capturedState('initial').revision + count);
      same(readObjectEntry(path, 'lastIntent'), captureCommands[count - 1]);
      stateHashes.add(captureValueHash(final)); commandCounts.add(count);
    }
    expect(byteHashes.size).toBe(expected.uniqueBoundaryBytes); expect(stateHashes.size).toBe(expected.uniqueBoundaryFinalStates);
    for (const filename of Object.values(snapshotIndex)) expect(await captureFileHash(capturePath(filename)), filename).toBe(integrity.files[filename]);
    expect([...commandCounts].sort((a, b) => a - b)).toEqual(Array.from({ length: expected.commandCount - PURE_WHITE_PREFIX_COUNT + 1 }, (_, index) => PURE_WHITE_PREFIX_COUNT + index));
    for (const [first, second] of aliases) {
      expect(boundaryIndex[first]).not.toBe(boundaryIndex[second]);
      const a = readFileSync(capturePath(boundaryIndex[first]!)), b = readFileSync(capturePath(boundaryIndex[second]!));
      expect(a.byteLength).toBe(b.byteLength); expect(a.equals(b)).toBe(true);
    }
    expect(sqliteRepresentatives).toHaveLength(10);
    for (const name of sqliteRepresentatives) expect(boundaryIndex[name], name).toBeDefined();
  }, Math.max(180_000, expected.uniqueBoundaryFiles * 3_000));

  // The standalone pure-white-angel-save.mjs verifier runs all127 SQLite cases.
  // CI retains ten real representatives here, alongside exhaustive fixture
  // integrity/current validation above. Never call this127 SQLite coverage.
  // Each gets its own fresh database; no runId or terminal sidecar is rewritten.
  it.each(sqliteRepresentatives)('%s survives rollback, reopen, real commit and idempotent retry', async name => {
    const filename = boundaryIndex[name];
    if (!filename) throw new Error(`Missing actual SQLite representative: ${name}`);
    const path = capturePath(filename), sourceHash = await captureFileHash(path);
    expect(sourceHash).toBe(integrity.files[filename]);
    const save = boundaryFile(filename);
    expect(save.count).toBeGreaterThanOrEqual(PURE_WHITE_PREFIX_COUNT); expect(save.count).toBeLessThanOrEqual(captureCommands.length);
    same(save.intent, captureCommands[save.count - 1]);
    expect(save.before.status).toBe('ACTIVE'); expect(save.final.revision).toBe(save.before.revision + 1);
    expect(save.final.revision).toBe(capturedState('initial').revision + save.count);
    expect(save.before.runId).toBe(save.final.runId);
    assertValidSliceState(save.before); assertValidSliceState(save.final);
    if (save.count > PURE_WHITE_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    expect([save.before.schemaVersion, save.before.contentVersion, save.final.schemaVersion, save.final.contentVersion])
      .toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-pure-white-actual-save-')), database = join(directory, 'boundary.sqlite');
    let app: SqliteSliceStore | undefined, fail = false;
    const envelope = { intentId: `pure-white-194:${name}`, runId: save.before.runId, expectedRevision: save.before.revision, payload: save.intent };
    try {
      app = new SqliteSliceStore(database, { beforeWrite: () => { if (fail) throw new Error('injected actual-boundary write failure'); } });
      app.repository.transaction(() => {
        app!.repository.put({ state: save.before, updatedAt: '2026-10-15T00:00:00.000Z' });
        app!.repository.selectRun(save.before.runId);
      });
      fail = true;
      const rejected = app.submitIntent(envelope);
      expect(rejected.ok).toBe(false);
      if (rejected.ok) throw new Error('Injected rollback unexpectedly committed');
      expect(rejected.error.code).toBe('SAVE_FAILED');
      same(app.repository.get(save.before.runId)!.state, save.before); expect(app.repository.receipt(envelope.intentId)).toBeNull();
      expect(existsSync(`${database}.sealed`)).toBe(false);
      app.close(); app = undefined; app = new SqliteSliceStore(database);
      same(app.repository.get(save.before.runId)!.state, save.before); expect(app.repository.activeRun()).toBe(save.before.runId);
      expect(app.repository.receipt(envelope.intentId)).toBeNull();
      const committed = app.submitIntent(envelope);
      expect(committed.ok).toBe(true);
      if (!committed.ok) throw new Error(JSON.stringify(committed.error));
      expect(committed.value.replayed).toBe(false); same(committed.value.state, projectSliceState(save.final));
      same(app.repository.get(save.final.runId)!.state, save.final);
      same(app.repository.receipt(envelope.intentId)!.receipt, committed.value);
      app.close(); app = undefined; app = new SqliteSliceStore(database);
      same(app.repository.get(save.final.runId)!.state, save.final);
      const retried = app.submitIntent(envelope);
      expect(retried.ok).toBe(true);
      if (!retried.ok) throw new Error(JSON.stringify(retried.error));
      same(retried.value, { ...committed.value, replayed: true });
      same(app.repository.get(save.final.runId)!.state, save.final);
      if (save.final.status === 'DEAD') same(JSON.parse(readFileSync(`${database}.sealed`, 'utf8')), [save.final.runId]);
      else expect(existsSync(`${database}.sealed`)).toBe(false);
    } finally {
      app?.close();
      // This directory was created by this test and cannot contain a player save.
      rmSync(directory, { recursive: true, force: true });
    }
    expect(await captureFileHash(path)).toBe(sourceHash);
  }, CAPTURE_BOUNDARY_TIMEOUT);
});

interface ForgeryCase {
  name: string;
  boundary?: string;
  change: (state: SliceState) => void;
}
const forgeries: ForgeryCase[] = [
  { name: 'resurrect the actual dead old Owen', change: s => { s.lightSeeker.encounter.enemyHealth = 100; s.lightSeeker.encounter.enemyStatus = 'RESISTING'; } },
  { name: 'rewrite the frozen source history', change: s => { s.pureWhiteAngel.sourceHistory!.lightSeeker.life.site.lamp.oil++; } },
  { name: 'rewrite the frozen paid-guidance budget', change: s => { s.pureWhiteAngel.sourceScene!.budget.cash++; } },
  { name: 'repair the old original shutter for free', change: s => { s.lightSeeker.life.site.shutter.durability = 100; } },
  { name: 'refill old original lamp oil', change: s => { s.lightSeeker.life.site.lamp.oil++; } },
  { name: 'restore Mara energy spent by real receipts', change: s => { s.lightSeeker.life.site.operatorEnergy = 90; } },
  { name: 'walk the refusing original spirit', change: s => { s.lightSeeker.life.site.spiritMetres++; } },
  { name: 'respawn the consumed single residue unit', change: s => { s.pureWhiteAngel.life.sample.residueUnits = 1; } },
  { name: 'repair the two genuinely reset personal pads', change: s => { s.pureWhiteAngel.life.pad.durability = 100; } },
  { name: 'invent an application for the failed life guard', change: s => { s.pureWhiteAngel.life.cases['personal-impact'].attempts[0]!.guard.effects = 1; } },
  { name: 'invent an application for the invalidated life guard', change: s => { s.pureWhiteAngel.life.cases['screened-return'].attempts[0]!.guard.effects = 1; } },
  { name: 'reward guard mastery without any real application', change: s => { s.progression.mastery['sun.s1.warm-radiance-guard'] = 8; } },
  { name: 'invent a23rd learned ability', change: s => { s.progression.mastery['sun.s1.fabricated'] = 0; } },
  { name: 'erase one of the original zero skills', change: s => { delete s.progression.mastery['sun.s7.holy-light']; } },
  { name: 'refund a real purchase through acquisition history', change: s => { s.pureWhiteAngel.acquisitionJournal.find(row => row.command.type === 'BUY_POTION')!.after.cash += 1100; } },
  { name: 'replace the actual potion draw', change: s => { s.pureWhiteAngel.acquisitionJournal.find(row => row.command.type === 'CONSUME')!.check!.roll = 100; } },
  { name: 'return the consumed potion to player inventory', change: s => { s.pureWhiteAngel.bottles[0]!.status = 'PLAYER'; } },
  { name: 'move an active window to an unobserved condition', boundary: 'screened-return-one-paid-personal-guard-attempt', change: s => { s.pureWhiteAngel.life.pending!.conditionVersion++; } },
  { name: 'extend the actual focused window', boundary: 'residue-trace-one-paid-focused-window-attempt', change: s => { s.pureWhiteAngel.life.pending!.expiresAt += 30; } },
  { name: 'make the failed life guard succeed', boundary: 'personal-impact-one-paid-personal-guard-attempt', change: s => { s.pureWhiteAngel.life.cases['personal-impact'].attempts[0]!.guard.successes = 1; } },
  { name: 'refill the independent enemy spirituality', change: s => { s.pureWhiteAngel.encounter.enemySpirituality = 120; } },
  { name: 'refill a genuinely spent original rod charge', change: s => { s.pureWhiteAngel.encounter.materials.weapon.charge = 4; } },
  { name: 'put the surrendered enemy rod back in hand', change: s => { s.pureWhiteAngel.encounter.materials.weapon.location = 'HAND'; s.pureWhiteAngel.encounter.weaponLocation = 'HAND'; } },
  { name: 'erase the real heavy enemy wound', change: s => { s.pureWhiteAngel.encounter.enemyInjuries = []; } },
  { name: 'replace the real consequence roll', change: s => { s.combatHistory.at(-1)!.consequenceRoll = 1; } },
  { name: 'erase the combat guard cost', change: s => { s.combatHistory.at(-1)!.pureWhiteAngelOutcome!.playerActions.at(-1)!.paidCost = 0; } },
  { name: 'award combat guard mastery for its failed cast', change: s => { s.combatHistory.at(-1)!.pureWhiteAngelOutcome!.playerActions.at(-1)!.masteryApplied.push('sun.s1.warm-radiance-guard'); } },
  { name: 'restore a spent RNG position', change: s => { s.random.cursor--; } },
  { name: 'erase the genuine four-metre exit receipt', change: s => { s.pureWhiteAngel.encounter.terminal!.exitMetres = 0; } },
];

describe('Pure White Angel actual save rejects forged replay evidence', () => {
  it.each(forgeries)('$name is rejected without mutation or persistence', ({ boundary, change }) => {
    const valid = boundary ? namedBoundary(boundary).final : capturedState('final');
    const forged = structuredClone(valid); change(forged);
    const fingerprint = captureValueHash(forged);
    expect(() => assertValidSliceState(forged)).toThrow(); expect(captureValueHash(forged)).toBe(fingerprint);
    expect(() => migrateSliceState(forged)).toThrow(); expect(captureValueHash(forged)).toBe(fingerprint);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-pure-white-reject-forgery-'));
    let app: SqliteSliceStore | undefined;
    try {
      app = new SqliteSliceStore(join(directory, 'forgery.sqlite'));
      app.repository.transaction(() => app!.repository.put({ state: valid, updatedAt: '2026-10-15T00:00:00.000Z' }));
      expect(() => app!.repository.transaction(() => app!.repository.put({ state: forged, updatedAt: '2026-10-15T00:01:00.000Z' }))).toThrow();
      same(app.repository.get(valid.runId)!.state, valid); expect(captureValueHash(forged)).toBe(fingerprint);
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, CAPTURE_BOUNDARY_TIMEOUT);
});
