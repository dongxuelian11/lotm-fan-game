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
import { actualPaleEmperorEvidence } from './pale-emperor-capture-evidence.js';
import { PALE_EMPEROR_ROOT, PALE_EMPEROR_SOURCE, PALE_EMPEROR_SOURCE_SHA, PALE_EMPEROR_PREFIX_COUNT,
  PALE_EMPEROR_PREFIX_SHA, PALE_EMPEROR_RAW_SOURCE_STATE_SHA, boundaryIndex, uniqueBoundaryFiles, captureCommands,
  capturePath, captureFileHash, captureValueHash, insertionOrderHash, captureJsonLines, captureBody, boundaryFile,
  capturedState, assertPublicCaptureControl, sameCaptureValue as same, snapshotIndex, CAPTURE_BOUNDARY_TIMEOUT } from './pale-emperor-capture-helper.js';

const expected = actualPaleEmperorEvidence();
const integrity = JSON.parse(readFileSync(`${PALE_EMPEROR_ROOT}/capture-integrity.json`, 'utf8')) as {
  naturalSha256: string; producerSha256: string; commandsSha256: string; publicSha256: string; indexSha256: string;
  summarySha256: string; sourcePrefixSha256: string; captureBudget: Record<string, unknown>; files: Record<string, string>;
};
type Body = ReturnType<typeof captureBody>;
interface CommandProof { step: number; intent: SliceIntent; sourcePrefix: boolean; before: Body; after: Body }
interface PublicProof { step: number; revision: number; command: SliceIntent; control: { kind: string; enabled: boolean; command?: unknown; stance?: string }; randomBefore: SliceState['random']; randomAfter: SliceState['random'] }

describe('Pale Emperor exhaustive immutable capture and representative SQLite recovery', () => {
  it('pins all evidence files, the815-command prefix, and every command/public proof without loading giant trees', async () => {
    for (const [name, hash] of [
      ['natural.json', expected.naturalSha256], ['boundaries.index.json', expected.boundaryIndexSha256],
      ['capture-integrity.json', expected.integritySha256], ['summary.json', expected.summarySha256],
      ['commands.jsonl', expected.commandsSha256], ['public.jsonl', expected.publicSha256], ['source-prefix.json', expected.sourcePrefixSha256],
    ]) expect(await captureFileHash(`${PALE_EMPEROR_ROOT}/${name}`), name).toBe(hash);
    expect(await captureFileHash(PALE_EMPEROR_SOURCE)).toBe(PALE_EMPEROR_SOURCE_SHA);
    expect(await captureFileHash('scripts/play/pale-emperor-stage.mjs')).toBe(expected.producerSha256);
    expect(integrity).toMatchObject({ producerSha256: expected.producerSha256, naturalSha256: expected.naturalSha256,
      commandsSha256: expected.commandsSha256, publicSha256: expected.publicSha256, indexSha256: expected.boundaryIndexSha256,
      summarySha256: expected.summarySha256, sourcePrefixSha256: expected.sourcePrefixSha256, captureBudget: expected.captureBudget });
    const prefixPath = `${PALE_EMPEROR_ROOT}/source-prefix.json`;
    expect(readObjectEntry(prefixPath, 'commandCount')).toBe(PALE_EMPEROR_PREFIX_COUNT);
    expect(readObjectEntry(prefixPath, 'jsonStringifySha256')).toBe(PALE_EMPEROR_PREFIX_SHA);
    expect(readObjectEntry(prefixPath, 'rawSourceSha256')).toBe(PALE_EMPEROR_SOURCE_SHA);
    expect(readObjectEntry(prefixPath, 'rawWholeStateSha256')).toBe(PALE_EMPEROR_RAW_SOURCE_STATE_SHA);
    expect(readObjectEntry(prefixPath, 'rawSchemaVersion')).toBe(170); expect(readObjectEntry(prefixPath, 'rawContentVersion')).toBe('death-consul-v170');
    const prefixCommands = readObjectEntry<SliceIntent[]>(prefixPath, 'commands');
    same(prefixCommands, captureCommands.slice(0, PALE_EMPEROR_PREFIX_COUNT)); expect(insertionOrderHash(prefixCommands)).toBe(PALE_EMPEROR_PREFIX_SHA);
    let count = 0, previous: Body | null = null;
    const publicIterator = captureJsonLines<PublicProof>('public.jsonl')[Symbol.asyncIterator]();
    try {
      for await (const row of captureJsonLines<CommandProof>('commands.jsonl')) {
        count++; expect(row.step).toBe(count); same(row.intent, captureCommands[count - 1]); expect(row.sourcePrefix).toBe(count <= PALE_EMPEROR_PREFIX_COUNT);
        if (previous) same(row.before, previous); else same(row.before, captureBody(capturedState('initial')));
        expect(row.after.revision).toBe(row.before.revision + 1); expect(row.after.random.seed).toBe('corpsecollector-natural-v032');
        expect(row.after.random.cursor).toBeGreaterThanOrEqual(row.before.random.cursor); previous = row.after;
        if (count === PALE_EMPEROR_PREFIX_COUNT) same(row.after, captureBody(capturedState('prefixFinal')));
        if (count > PALE_EMPEROR_PREFIX_COUNT) {
          const next = await publicIterator.next(); expect(next.done).toBe(false); const proof = next.value!;
          expect(proof.step).toBe(count); expect(proof.revision).toBe(row.before.revision); same(proof.command, row.intent);
          expect(proof.control.enabled).toBe(true); expect(proof.control.kind).toBe(row.intent.type);
          if (row.intent.type === 'PALE_EMPEROR' || row.intent.type === 'FERRYMAN') same(proof.control.command, row.intent.command);
          else { expect(row.intent.type).toBe('COMBAT_ROUND'); expect(proof.control.stance).toBe('CONTROL'); }
          same(proof.randomBefore, row.before.random); same(proof.randomAfter, row.after.random);
        }
      }
      expect((await publicIterator.next()).done).toBe(true);
    } finally { await publicIterator.return?.(undefined); }
    expect(count).toBe(expected.commandCount); same(previous, captureBody(capturedState('final')));
  }, 180_000);

  it('validates all224 distinct transitions and their actual enabled public controls with no omissions or aliases', async () => {
    const names = Object.keys(boundaryIndex);
    expect(names).toHaveLength(expected.boundaryNames); expect(uniqueBoundaryFiles).toHaveLength(expected.uniqueBoundaryFiles);
    expect(uniqueBoundaryFiles.length).toBe(names.length);
    expect(Object.keys(integrity.files).sort()).toEqual([...new Set([...uniqueBoundaryFiles, ...Object.values(snapshotIndex)])].sort());
    const byteHashes = new Set<string>(), stateHashes = new Set<string>(), commandCounts = new Set<number>();
    let previousFinalHash: string | null = null;
    for (const [index, filename] of uniqueBoundaryFiles.entries()) {
      const path = capturePath(filename), hash = await captureFileHash(path); expect(hash, filename).toBe(integrity.files[filename]); byteHashes.add(hash);
      const rawFinal = readObjectEntry<unknown>(path, 'final');
      expect(rawFinal).toMatchObject({ schemaVersion: 192, contentVersion: 'pale-emperor-v192' });
      const final = migrateSliceState(rawFinal), before = migrateSliceState(readObjectEntry<unknown>(path, 'beforeLast'));
      assertValidSliceState(before); assertValidSliceState(final);
      expect([before.schemaVersion, before.contentVersion, final.schemaVersion, final.contentVersion])
        .toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      expect(before.status).toBe('ACTIVE'); expect(final.runId).toBe(before.runId); expect(final.revision).toBe(before.revision + 1);
      const count = readObjectEntry<number>(path, 'commandCount'), intent = readObjectEntry<SliceIntent>(path, 'lastIntent');
      expect(count).toBe(PALE_EMPEROR_PREFIX_COUNT + index); expect(final.revision).toBe(capturedState('initial').revision + count);
      same(intent, captureCommands[count - 1]); if (count > PALE_EMPEROR_PREFIX_COUNT) assertPublicCaptureControl(before, intent);
      if (previousFinalHash !== null) expect(captureValueHash(before), filename).toBe(previousFinalHash);
      previousFinalHash = captureValueHash(final); stateHashes.add(previousFinalHash); commandCounts.add(count);
    }
    expect(byteHashes.size).toBe(expected.uniqueBoundaryBytes); expect(stateHashes.size).toBe(expected.uniqueBoundaryFinalStates);
    expect(previousFinalHash).toBe(captureValueHash(capturedState('final')));
    expect([...commandCounts]).toEqual(Array.from({ length: expected.commandCount - PALE_EMPEROR_PREFIX_COUNT + 1 }, (_, i) => PALE_EMPEROR_PREFIX_COUNT + i));
    for (const filename of Object.values(snapshotIndex)) expect(await captureFileHash(capturePath(filename)), filename).toBe(integrity.files[filename]);
    expect(expected.sqliteRepresentatives).toHaveLength(10); expect(new Set(expected.sqliteRepresentatives).size).toBe(10);
    for (const name of expected.sqliteRepresentatives) expect(boundaryIndex[name], name).toBeDefined();
  }, Math.max(180_000, expected.uniqueBoundaryFiles * 3_000));

  // The independent pale-emperor-save.mjs run owns the complete224 real SQLite
  // transactions. CI keeps ten observed representatives plus exhaustive hashes,
  // validity, sequence continuity and public-intent checks above. No second
  // all224 database suite is hidden here, and no player death is manufactured.
  it.each(expected.sqliteRepresentatives)('%s survives actual rollback, reopen, commit and idempotent retry', async name => {
    const filename = boundaryIndex[name]; if (!filename) throw new Error(`Missing actual SQLite representative: ${name}`);
    const path = capturePath(filename), sourceHash = await captureFileHash(path); expect(sourceHash).toBe(integrity.files[filename]);
    const save = boundaryFile(filename); same(save.intent, captureCommands[save.count - 1]);
    expect(save.count).toBeGreaterThanOrEqual(PALE_EMPEROR_PREFIX_COUNT); expect(save.count).toBeLessThanOrEqual(captureCommands.length);
    expect(save.before.status).toBe('ACTIVE'); expect(save.final.revision).toBe(save.before.revision + 1); expect(save.before.runId).toBe(save.final.runId);
    assertValidSliceState(save.before); assertValidSliceState(save.final); if (save.count > PALE_EMPEROR_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
    const directory = mkdtempSync(join(tmpdir(), 'lotm-pale-emperor-actual-save-')), database = join(directory, 'boundary.sqlite');
    let app: SqliteSliceStore | undefined, fail = false;
    const envelope = { intentId: `pale-emperor-195:${name}`, runId: save.before.runId, expectedRevision: save.before.revision, payload: save.intent };
    try {
      app = new SqliteSliceStore(database, { beforeWrite: () => { if (fail) throw new Error('injected actual-boundary write failure'); } });
      app.repository.transaction(() => { app!.repository.put({ state: save.before, updatedAt: '2026-10-15T00:00:00.000Z' }); app!.repository.selectRun(save.before.runId); });
      fail = true; const rejected = app.submitIntent(envelope); expect(rejected.ok).toBe(false);
      if (rejected.ok) throw new Error('Injected rollback unexpectedly committed'); expect(rejected.error.code).toBe('SAVE_FAILED');
      same(app.repository.get(save.before.runId)!.state, save.before); expect(app.repository.receipt(envelope.intentId)).toBeNull(); expect(existsSync(`${database}.sealed`)).toBe(false);
      app.close(); app = undefined; app = new SqliteSliceStore(database);
      same(app.repository.get(save.before.runId)!.state, save.before); expect(app.repository.activeRun()).toBe(save.before.runId); expect(app.repository.receipt(envelope.intentId)).toBeNull();
      const committed = app.submitIntent(envelope); expect(committed.ok).toBe(true); if (!committed.ok) throw new Error(JSON.stringify(committed.error));
      expect(committed.value.replayed).toBe(false); same(committed.value.state, projectSliceState(save.final));
      same(app.repository.get(save.final.runId)!.state, save.final); same(app.repository.receipt(envelope.intentId)!.receipt, committed.value);
      app.close(); app = undefined; app = new SqliteSliceStore(database); same(app.repository.get(save.final.runId)!.state, save.final);
      const retried = app.submitIntent(envelope); expect(retried.ok).toBe(true); if (!retried.ok) throw new Error(JSON.stringify(retried.error));
      same(retried.value, { ...committed.value, replayed: true }); same(app.repository.get(save.final.runId)!.state, save.final);
      // Sealing is for actual player death. The observed Alden death leaves the
      // same injured player alive and therefore must not create this sidecar.
      if (save.final.status === 'DEAD') {
        same(JSON.parse(readFileSync(`${database}.sealed`, 'utf8')), [save.final.runId]); expect(projectSliceState(save.final).canAct).toBe(false);
      } else expect(existsSync(`${database}.sealed`)).toBe(false);
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
    expect(await captureFileHash(path)).toBe(sourceHash);
  }, CAPTURE_BOUNDARY_TIMEOUT);
});

interface Forgery { name: string; change: (s: SliceState) => void }
const forgeries: Forgery[] = [
  { name: 'replace historical available Owen with a current corpse', change: s => { s.undying.encounter.enemy.health = 0; s.undying.encounter.enemy.status = 'DEAD'; } },
  { name: 'undo historical Nolan retreat injuries', change: s => { s.deathConsul.encounter.enemyInjuries = []; } },
  { name: 'refill the historical exhausted material', change: s => { s.deathConsul.life.site.material.remaining++; } },
  { name: 'restore historical operator energy', change: s => { s.deathConsul.life.site.operatorEnergy++; } },
  { name: 'rewrite the frozen source-history door', change: s => { s.paleEmperor.sourceHistory!.deathConsul.life.site.door.operations++; } },
  { name: 'rewrite the frozen paid-guidance budget', change: s => { s.paleEmperor.sourceScene!.budget.cash++; } },
  { name: 'invent free current-era income', change: s => { s.ferryman.era.income += 24; } },
  { name: 'refund a real current-era rest', change: s => { s.paleEmperor.eraJournal.find(r => r.command.type === 'ERA_REST')!.after.cash += 8; } },
  { name: 'refund the first genuinely consumed failed bottle', change: s => { s.paleEmperor.acquisitionJournal.find(r => r.command.type === 'BUY_POTION')!.after.cash += 80; } },
  { name: 'replace the first actual failed potion draw', change: s => { s.paleEmperor.acquisitionJournal.find(r => r.command.type === 'CONSUME')!.check!.roll = 1; } },
  { name: 'return a consumed failed bottle to inventory', change: s => { s.paleEmperor.bottles[0]!.status = 'PLAYER'; } },
  { name: 'erase an original zero skill', change: s => { delete s.progression.mastery['death.s8.spirit-contact']; } },
  { name: 'invent a20th learned skill', change: s => { s.progression.mastery['death.s1.fabricated'] = 0; } },
  { name: 'award quieting mastery for the real failed cast', change: s => { s.progression.mastery['death.s1.residual-quieting'] = 8; } },
  { name: 'award interdiction mastery for ordinary screened carrying', change: s => { s.progression.mastery['death.s1.spiritual-interdiction'] = 8; } },
  { name: 'invent an effect for the actual quieting failure', change: s => { s.paleEmperor.life.cases['quiet-lid'].attempts[0]!.quieting.effects = 1; } },
  { name: 'invent a successful window for the actual interdiction failure', change: s => { s.paleEmperor.life.cases['guarded-carry'].attempts[0]!.interdiction.successes = 1; } },
  { name: 'change the current withdrawal into consent', change: s => { s.paleEmperor.life.cases['withdrawn-return'].attempts[0]!.permission.custodian = 'GRANTED'; } },
  { name: 'restock one original spent seal', change: s => { s.paleEmperor.life.site!.seals[0]!.state = 'PLAYER'; } },
  { name: 'erase actual vessel travel', change: s => { s.paleEmperor.life.site!.vessel.travelledMetres = 0; } },
  { name: 'erase ordinary lid scuffs', change: s => { s.paleEmperor.life.site!.vessel.scuffs = 0; } },
  { name: 'restore Nora energy without a receipt', change: s => { s.paleEmperor.life.nora!.energy = 100; } },
  { name: 'put the departed custodian into the completed encounter', change: s => { s.paleEmperor.encounter.scene.presentMemberIds.push('PE1-NORA'); } },
  { name: 'resurrect the actual dead Alden', change: s => { s.paleEmperor.encounter.enemyHealth = 100; s.paleEmperor.encounter.enemyStatus = 'RESISTING'; } },
  { name: 'refill Alden independent spirituality', change: s => { s.paleEmperor.encounter.enemySpirituality = 120; } },
  { name: 'invent an extra original spirit mark', change: s => { s.paleEmperor.encounter.materials.marks.remaining++; } },
  { name: 'put the dead enemy weapon back in hand', change: s => { s.paleEmperor.encounter.materials.weapon.location = 'HAND'; s.paleEmperor.encounter.weaponLocation = 'HAND'; } },
  { name: 'erase the actual player heavy wound', change: s => { s.injuries = s.injuries.filter(i => i.severity !== 'HEAVY'); } },
  { name: 'restore the actual player body to full health', change: s => { s.health = 100; } },
  { name: 'replace the actual final consequence draw', change: s => { s.combatHistory.at(-1)!.consequenceRoll = 1; } },
  { name: 'invent a new-ability combat application', change: s => { s.combatHistory.at(-1)!.paleEmperorOutcome!.playerActions[0]!.masteryApplied.push('death.s1.residual-quieting'); } },
  { name: 'restore a consumed random position', change: s => { s.random.cursor--; } },
  { name: 'erase the actual twelve-metre road exit', change: s => { s.paleEmperor.encounter.terminal!.roadExitMetres = 0; } },
];

describe('Pale Emperor actual save rejects forged historical, failed and terminal evidence', () => {
  it('rejects every forgery without mutation or persistence in one isolated database', () => {
    const valid = capturedState('final'), directory = mkdtempSync(join(tmpdir(), 'lotm-pale-emperor-reject-forgery-'));
    let app: SqliteSliceStore | undefined;
    try {
      app = new SqliteSliceStore(join(directory, 'forgery.sqlite'));
      app.repository.transaction(() => app!.repository.put({ state: valid, updatedAt: '2026-10-15T00:00:00.000Z' }));
      for (const { name, change } of forgeries) {
        const forged = structuredClone(valid); change(forged); const fingerprint = captureValueHash(forged);
        expect(fingerprint, `Forgery must change actual evidence: ${name}`).not.toBe(captureValueHash(valid));
        expect(() => assertValidSliceState(forged), name).toThrow(); expect(captureValueHash(forged), name).toBe(fingerprint);
        expect(() => migrateSliceState(forged), name).toThrow(); expect(captureValueHash(forged), name).toBe(fingerprint);
        expect(() => app!.repository.transaction(() => app!.repository.put({ state: forged, updatedAt: '2026-10-15T00:01:00.000Z' })), name).toThrow();
        same(app.repository.get(valid.runId)!.state, valid); expect(captureValueHash(forged), name).toBe(fingerprint);
      }
    } finally { app?.close(); rmSync(directory, { recursive: true, force: true }); }
  }, Math.max(180_000, forgeries.length * 3_000));
});
