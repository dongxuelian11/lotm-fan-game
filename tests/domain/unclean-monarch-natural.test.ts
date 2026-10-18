import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateUncleanMonarchAcquisitionJournal, validateUncleanMonarchJournalContinuity } from '../../src/domain/unclean-monarch/index.js';
import { UNCLEAN_MONARCH_ABILITY_IDS, UNCLEAN_MONARCH_SOURCE_KEYS, UNCLEAN_MONARCH_PREPARATION_IDS } from '../../src/domain/unclean-monarch/types.js';
import { UNCLEAN_MONARCH_CASE_IDS, getUncleanMonarchCurrentSite, uncleanMonarchLifeMasteryGains, validateUncleanMonarchLifeState } from '../../src/domain/unclean-monarch/life.js';
import { validateUncleanMonarchEncounterState } from '../../src/domain/unclean-monarch/encounter.js';
import { currentUncleanMonarchCombatSource, replayUncleanMonarchCombatRound, uncleanMonarchActionCount, uncleanMonarchEnemyActionCount } from '../../src/domain/unclean-monarch/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { UNCLEAN_MONARCH_CAPTURE_EVIDENCE as evidence, UNCLEAN_MONARCH_METADATA_FILES } from './unclean-monarch-capture-evidence.js';
import { UNCLEAN_MONARCH_ROOT as ROOT, UNCLEAN_MONARCH_SOURCE as SOURCE, UNCLEAN_MONARCH_SOURCE_BOUNDARY as SOURCE_BOUNDARY,
  UNCLEAN_MONARCH_PRIOR as PRIOR, UNCLEAN_MONARCH_PREFIX_COUNT as PREFIX, UNCLEAN_MONARCH_INHERITED_COUNT as INHERITED,
  UNCLEAN_MONARCH_SEED as SEED, captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath,
  captureFileHash, insertionOrderHash, captureValueHash, captureJsonLines, currentCapture, originalLivingPrefix,
  capturedState, capturedSnapshot, replayCaptureBoundary, captureBody, sourceOriginals, currentOriginals,
  actualLifeAbilityUse, actualCombatAbilityUse, assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './unclean-monarch-capture-helper.js';

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
interface Integrity { producerSha256: string; naturalSha256: string; commandsSha256: string; publicSha256: string;
  sourcePrefixSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; files: Record<string, string> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }

// Historical evidence is independently executable before a stage202 capture.
// No source is loaded as a whole natural.json, rewritten, or used to resurrect a death.
describe('Unclean Monarch original718 living source and preserved terminal histories', () => {
  it('pins the immutable raw177 boundary and both full DEAD campaigns before CURRENT migration', async () => {
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256);
    expect(await captureFileHash(SOURCE_BOUNDARY)).toBe(evidence.sourceBoundarySha256);
    expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    const raw = readObjectEntry<SliceState>(SOURCE_BOUNDARY, 'beforeLast');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([177, 'blood-duke-v177']);
    expect(raw).toMatchObject({ revision: 719, status: 'ACTIVE', health: 100 });
    const oldCommands = sourceEntry<SliceIntent[]>('commands'), priorCommands = readObjectEntry<SliceIntent[]>(PRIOR, 'commands');
    expect(oldCommands).toHaveLength(724); expect(priorCommands).toHaveLength(592);
    same(oldCommands[PREFIX], readObjectEntry(SOURCE_BOUNDARY, 'lastIntent'));
    expect(sourceEntry('prefixCount')).toBe(INHERITED); expect(INHERITED).toBe(583);
    same(oldCommands.slice(0, INHERITED), priorCommands.slice(0, INHERITED));
    expect(insertionOrderHash(oldCommands.slice(0, PREFIX))).toBe(evidence.prefixSha256);
    for (const path of [SOURCE, PRIOR]) {
      const original = readObjectEntry<SliceState>(path, 'final');
      expect(original).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
      const current = currentCapture(original);
      expect(current).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
      same(current.combatHistory, original.combatHistory); same(current.lastCombatRound, original.lastCombatRound);
      for (const key of Object.keys(original) as (keyof SliceState)[]) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], original[key]);
      for (const key of ['character', 'random', 'injuries', 'injuryRisk', 'health', 'mind', 'spirituality', 'cash', 'ending'] as const) same(current[key], original[key]);
      for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) if (Object.hasOwn(original, key)) same(current[key], original[key]);
      expect(projectSliceState(current).canAct).toBe(false);
      const before = captureValueHash(current);
      expect(() => applySliceIntent(current, { type: 'CONTINUE_LIFE' })).toThrow();
      expect(captureValueHash(current)).toBe(before);
    }
    const original = originalLivingPrefix();
    expect([original.schemaVersion, original.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(original.combatHistory, raw.combatHistory); same(original.random, raw.random);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) if (key !== 'schemaVersion' && key !== 'contentVersion') same(original[key], raw[key]);
    for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) same(original[key], raw[key]);
  }, 120_000);

  it('retains the actual16 masteries, zeroes, original room, adults, objects, strain and old opponents', () => {
    const s = originalLivingPrefix(), site = s.blatherer.life;
    expect(s).toMatchObject({ status: 'ACTIVE', revision: 719, week: 181, health: 100, mind: 100, spirituality: 120,
      cash: 710, actionsRemaining: 3, injuries: [], injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 12, day: 9 },
      random: { seed: SEED, cursor: 112 }, progression: { pathwayId: 'abyss', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(s.bloodDuke.promotionWeek).toBe(172);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180,
      coreStats: { physique: 30, perception: 24, will: 22, knowledge: 24 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(16);
    expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(4);
    expect(site).toMatchObject({ siteId: 'BL3-QUIET-ROOM', playerLocation: 'START', playerTravelMetres: 96, clockSeconds: 317,
      volunteer: { id: 'BL3-NORA', age: 46, alive: true, willing: true, location: 'A' },
      guide: { id: 'ROAN', location: 'OUTSIDE', travelMetres: 24 },
      card: { id: 'BL3-CARD', owner: 'BL3-NORA', quantity: 1, location: 'NORA', travelMetres: 40 },
      bell: { id: 'BL3-BELL', location: 'B', quantity: 1 }, note: { id: 'BL3-NOTE', location: 'B', quantity: 1 } });
    expect(Object.hasOwn(site.volunteer, 'energy')).toBe(false); expect(Object.hasOwn(site.guide, 'age')).toBe(false);
    expect(Object.hasOwn(site, 'playerEnergy')).toBe(false);
    expect(s.bloodDuke.life.operation).toEqual({ door: 'OPEN', inputActive: false, impulse: null, emotion: null,
      restraintUntil: null, hesitationUntil: null, bellRehearsals: 2 });
    expect(s.demon.strain).toBe(3); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.blatherer.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(s.devil.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 32 });
    expect(s.bloodDuke.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0);
  }, 60_000);
});

it('requires coordinator-frozen observations before claiming a successful stage202 capture suite', () => { observedCapture(); });

describe.skipIf(evidence.observed === null)('Unclean Monarch actual original-seed capture, not a directed replacement', () => {
  it('pins every raw capture member, producer and metadata before explicitly migrating to CURRENT', async () => {
    const expected = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(expected.observedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await captureFileHash('scripts/play/unclean-monarch-stage.mjs')).toBe(expected.producerSha256);
    expect(Object.keys(expected.metadataHashes).sort()).toEqual([...UNCLEAN_MONARCH_METADATA_FILES].sort());
    for (const [filename, hash] of Object.entries(expected.metadataHashes)) {
      const path = filename.endsWith('.jsonl') ? `${ROOT}/${filename}` : capturePath(filename);
      expect(hash).toMatch(/^[0-9a-f]{64}$/); expect(realpathSync(path)).toBe(resolve(path)); expect(await captureFileHash(path)).toBe(hash);
    }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity).toMatchObject({ producerSha256: expected.producerSha256, naturalSha256: expected.metadataHashes['natural.json'],
      commandsSha256: expected.metadataHashes['commands.jsonl'], publicSha256: expected.metadataHashes['public.jsonl'],
      sourcePrefixSha256: expected.metadataHashes['source-prefix.json'], boundaryIndexSha256: expected.metadataHashes['boundaries.index.json'],
      boundaryStepsSha256: expected.metadataHashes['boundaries.steps.json'], transitionsSha256: expected.metadataHashes['transitions.json'], summarySha256: expected.metadataHashes['summary.json'] });
    const members = [...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].sort();
    same(Object.keys(integrity.files).sort(), members);
    same(readdirSync(ROOT).sort(), [...members, ...UNCLEAN_MONARCH_METADATA_FILES].sort());
    expect(members.length + UNCLEAN_MONARCH_METADATA_FILES.length).toBe(expected.files);
    for (const filename of members) {
      const path = capturePath(filename); expect(realpathSync(path)).toBe(resolve(path));
      expect(integrity.files[filename]).toMatch(/^[0-9a-f]{64}$/); expect(await captureFileHash(path)).toBe(integrity.files[filename]);
    }
    // Raw historical literals are deliberate; the CURRENT helper governs migration output only.
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) expect(naturalEntry(key)).toMatchObject({ schemaVersion: 199, contentVersion: 'unclean-monarch-v199' });
    for (const filename of Object.values(snapshots)) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(199);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('unclean-monarch-v199');
    }
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(evidence.sourceSha256);
    expect(readObjectEntry(prefix, 'sourceBoundary')).toBe(SOURCE_BOUNDARY);
    expect(readObjectEntry(prefix, 'sourceBoundarySha256')).toBe(evidence.sourceBoundarySha256);
    expect(readObjectEntry(prefix, 'sourceRoot')).toBe('beforeLast'); expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX);
    expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(evidence.prefixSha256);
    expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false);
    same(readObjectEntry(prefix, 'rawInitial'), sourceEntry('initial'));
    same(readObjectEntry(prefix, 'rawFinal'), readObjectEntry(SOURCE_BOUNDARY, 'beforeLast'));
    same(readObjectEntry(prefix, 'commands'), sourceEntry<SliceIntent[]>('commands').slice(0, PREFIX));
    // This digest describes the migration performed during the original capture, not a later schema migration.
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(naturalEntry('prefixFinal')));
    same(naturalEntry('provenance'), expected.provenance); same(naturalEntry('continuation'), expected.continuation);
    expect(naturalEntry('provenance')).toMatchObject({ kind: 'EXACT718_PUBLIC_BLOOD_DUKE_THEN_PUBLIC_UNCLEAN_MONARCH',
      source: SOURCE, sourceRoot: 'beforeLast', sourceBoundary: SOURCE_BOUNDARY, inheritedDirectedPrefix: false,
      fullNaturalS9ToS1: capturedState('final').progression.sequence === 1, newRandomChanges: false });
    same(steps, expected.boundarySteps); same(Object.keys(snapshots), expected.snapshots);
  }, 240_000);

  it('replays every original command and all current public controls in memory with exact state and RNG continuity', () => {
    const expected = observedCapture(), { commands } = captureMetadata(), old = sourceEntry<SliceIntent[]>('commands');
    expect(PREFIX).toBe(718); expect(old).toHaveLength(724); expect(commands).toHaveLength(expected.commands);
    same(commands.slice(0, PREFIX), old.slice(0, PREFIX)); expect(insertionOrderHash(old.slice(0, PREFIX))).toBe(evidence.prefixSha256);
    expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX);
    expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED); expect(naturalEntry('seed')).toBe(SEED);
    same(naturalEntry('strategy'), expected.strategy);
    let state = currentCapture(sourceEntry('initial')); const original = capturedState('prefixFinal');
    expect(state.progression.sequence).toBeNull(); same(state, capturedState('initial'));
    for (const [index, intent] of commands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(PREFIX); expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending?.kind).not.toBe('DEATH');
      } else expect(state.status, `No action after actual death, command ${index + 1}`).toBe('ACTIVE');
      if (index >= PREFIX) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED);
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === PREFIX - 1) same(state, original);
      if (index >= PREFIX) {
        assertOriginalContinuity(state, original); expect(state.weeklyBudget).toBe(3);
        expect([0, 1]).toContain(state.week - before.week);
        if (state.week > before.week) { expect(state.actionsRemaining).toBe(3); same(state.date, addGameWeeks(before.date, 1)); }
      }
    }
    same(state, capturedState('final')); same(captureBody(state), expected.final);
    assertValidSliceState(state); same(migrateSliceState(state), state);
    expect(state.revision).toBe(capturedState('initial').revision + commands.length);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    same(naturalEntry('pendingIntent'), expected.pendingIntent); expect(naturalEntry('failurePhase')).toBe(expected.failurePhase);
    expect(expected.stage).not.toBe('ACTUAL_BLOCKER');
    // This is the only 600-second test. It writes no recapture files or databases.
  }, 600_000);

  it('ties every alias, transition, snapshot and streamed command/public row to its exact saved revision and RNG', async () => {
    const expected = observedCapture(), { boundaries, steps, snapshots, commands } = captureMetadata();
    const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
    expect(Object.keys(boundaries)).toHaveLength(expected.namedBoundaries); same(Object.keys(steps), Object.keys(boundaries));
    expect(transitions).toHaveLength(expected.uniqueTransitions); expect(transitions).toHaveLength(commands.length - PREFIX + 1);
    same([...new Set(Object.values(boundaries))], transitions.map(row => row.file));
    const byStep = new Map(transitions.map(row => [row.commandIndex, row])), firstNames = new Map<number, string>(); let aliases = 0;
    transitions.forEach((row, index) => {
      expect(row).toMatchObject({ commandIndex: PREFIX + index, beforeRevision: PREFIX + index, afterRevision: PREFIX + index + 1 });
      expect(boundaries[row.key]).toBe(row.file); expect(steps[row.key]).toBe(row.commandIndex);
    });
    for (const [name, file] of Object.entries(boundaries)) {
      const step = steps[name]!, row = byStep.get(step); expect(row, name).toBeDefined(); expect(file).toBe(row!.file);
      if (firstNames.has(step)) aliases++; else { firstNames.set(step, name); expect(name).toBe(row!.key); }
    }
    expect(aliases).toBe(expected.aliases); expect(firstNames.size).toBe(expected.uniqueTransitions);
    type Ledger = { step: number; sourcePrefix: boolean; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    const newRows = new Map<number, Ledger>(); let count = 0, previous = captureBody(capturedState('initial'));
    for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
      expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]);
      same(row.before, previous); expect(row.after.revision).toBe(row.before.revision + 1); previous = row.after;
      expect(row.after.random.seed).toBe(SEED); expect(row.after.random.cursor).toBeGreaterThanOrEqual(row.before.random.cursor);
      if (count >= PREFIX) newRows.set(count, row);
    }
    expect(count).toBe(expected.commands); same(previous, expected.final); count = PREFIX;
    type Public = { step: number; revision: number; command: SliceIntent; control: { enabled?: boolean; kind?: string; stance?: string };
      randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    for await (const row of captureJsonLines<Public>('public.jsonl')) {
      expect(row.step).toBe(++count); same(row.command, commands[count - 1]); const ledger = newRows.get(count)!;
      expect(row.revision).toBe(ledger.before.revision); same(row.randomBefore, ledger.before.random); same(row.randomAfter, ledger.after.random);
      for (const key of Object.keys(ledger.before) as (keyof ReturnType<typeof captureBody>)[]) { same(row.before[key], ledger.before[key]); same(row.after[key], ledger.after[key]); }
      if (row.command.type === 'COMBAT_ROUND') expect(row.control).toMatchObject({ kind: 'COMBAT_ROUND', stance: 'CONTROL' });
      else expect(row.control.enabled).toBe(true);
    }
    expect(count).toBe(expected.commands);
    for (const row of transitions) {
      const path = capturePath(row.file), ledger = newRows.get(row.commandIndex)!;
      expect(readObjectEntry(path, 'commandCount')).toBe(row.commandIndex); same(readObjectEntry(path, 'lastIntent'), ledger.intent);
      for (const [root, body, revision] of [['beforeLast', ledger.before, row.beforeRevision], ['final', ledger.after, row.afterRevision]] as const) {
        const raw = readObjectEntry<SliceState>(path, root);
        expect([raw.schemaVersion, raw.contentVersion, raw.revision]).toEqual([199, 'unclean-monarch-v199', revision]); same(captureBody(raw), body);
      }
    }
    for (const filename of Object.values(snapshots)) {
      const state = JSON.parse(readFileSync(capturePath(filename), 'utf8')) as SliceState;
      const ledger = newRows.get(state.revision - 1); expect(ledger, filename).toBeDefined(); same(captureBody(state), ledger!.after);
    }
  }, 240_000);

  it('preserves healthy departure and actual acquisition fees, original bottles, failure costs and any observed promotion', () => {
    const expected = observedCapture(), original = capturedState('prefixFinal'), final = capturedState('final'), state = final.uncleanMonarch;
    same(captureBody(original), expected.originalBody); same(original.character, expected.originalCharacter); same(original.progression.mastery, expected.originalMastery);
    same(naturalEntry('treatments'), expected.treatments); expect(expected.treatments).toEqual([]);
    same(capturedSnapshot('sourceHealthy'), capturedSnapshot('departure'));
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots'), receipt = guidance.final.uncleanMonarch.acquisitionJournal.at(-1)!;
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    same(guidance.final.uncleanMonarch.sourceScene!.originals, sourceOriginals(original));
    expect(state.preparations.map(row => row.taskId)).toEqual([...UNCLEAN_MONARCH_PREPARATION_IDS]);
    expect(new Set(state.bottles.map(row => row.id)).size).toBe(state.bottles.length);
    for (const bottle of state.bottles.filter(row => row.status === 'CONSUMED')) {
      const buy = replayCaptureBoundary(`actual1200p-buy-${bottle.id}`), prep = replayCaptureBoundary(`actual180p-current-week-prepare-${bottle.id}`), dose = replayCaptureBoundary(`consume-${bottle.id}`);
      const work = state.acquisitionJournal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id);
      expect(work).toHaveLength(5); for (const row of work) expect([row.before.actions - row.after.actions, row.before.cash - row.after.cash]).toEqual([1, 0]);
      expect(buy.final.uncleanMonarch.acquisitionJournal.at(-1)!.before.cash - buy.final.uncleanMonarch.acquisitionJournal.at(-1)!.after.cash).toBe(1200);
      expect(prep.final.uncleanMonarch.acquisitionJournal.at(-1)!.before.cash - prep.final.uncleanMonarch.acquisitionJournal.at(-1)!.after.cash).toBe(180);
      expect(dose.before.week - original.bloodDuke.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.uncleanMonarch.preparedWeek).toBe(dose.before.week); expect(dose.final.uncleanMonarch.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      same(dose.final.injuries, dose.before.injuries); same(currentOriginals(dose.final), currentOriginals(dose.before));
      expect(dose.final.spirituality).toBe(dose.before.spirituality);
      const doseReceipt = dose.final.uncleanMonarch.acquisitionJournal.at(-1)!;
      expect(doseReceipt.after.actions).toBe(doseReceipt.before.actions); // A legal exhausted-week rollover may replenish the outer state to3.
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!)); expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
      for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(dose.final.progression.mastery[id]).toBe(mastery);
    }
    for (const row of state.acquisitionJournal.filter(row => row.command.type === 'REQUEST_SUPPLY')) {
      expect([row.before.cash - row.after.cash, row.before.actions - row.after.actions]).toEqual([100, 1]);
      const delivery = state.acquisitionJournal.find(entry => entry.command.type === 'RECEIVE_SUPPLY' && entry.revision > row.revision);
      expect(delivery).toBeDefined(); expect(delivery!.week).toBeGreaterThan(row.week);
      expect(state.bottles.filter(b => b.stockedWeek === delivery!.week)).toHaveLength(3);
    }
    expect(state.promotionWeek).toBe(expected.promotionWeek);
    if (expected.promotionWeek !== null) {
      const promoted = capturedSnapshot('promoted'); expect(UNCLEAN_MONARCH_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
      expect(promoted.uncleanMonarch.bloodDukeActingAtPromotion).toBe(100);
      for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id]).toBe(mastery);
    }
    expect(validateUncleanMonarchAcquisitionJournal(final)).toBe(true); expect(validateUncleanMonarchJournalContinuity(final)).toBe(true);
  }, 240_000);

  it('distinguishes paid casts, actual applications and first honest reports while preserving each original body and one-use piece', () => {
    const expected = observedCapture(), final = capturedState('final'), life = final.uncleanMonarch.life;
    same(actualLifeAbilityUse(final), expected.lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), expected.lifeAbilityUse); same(summaryEntry('lifeCases'), life.cases);
    same(UNCLEAN_MONARCH_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED'), expected.completedCases);
    expect(new Set(life.pieces.map(piece => piece.id)).size).toBe(life.pieces.length);
    for (const caseId of expected.completedCases) {
      const c = life.cases[caseId], attempt = c.attempts[0]!, piece = life.pieces.find(row => row.caseId === caseId)!;
      expect(c.attempts).toHaveLength(1); expect(c).toMatchObject({ status: 'RESOLVED', returned: true, contactOpen: false });
      expect(attempt).toMatchObject({ closed: true, returned: true, cardReturned: true, verified: true, penniesSpent: 20 });
      expect(piece).toMatchObject({ paidPennies: 20, quantity: 1, status: 'RETURNED', location: 'OWNER' });
      expect(piece.charges).toBe(1 - attempt.appliedAbilityIds.length); expect(piece.wear).toBe(attempt.appliedAbilityIds.length);
      const cast = replayCaptureBoundary(`${caseId}-${caseId === 'observed-tension' ? 'focused_interference' : 'impulse_binding'}`), row = cast.final.uncleanMonarch.life.journal.at(-1)!;
      expect(row.paid.spirituality).toBe(8); expect(row.paid.mind).toBe(['SUCCESS', 'GREAT_SUCCESS'].includes(row.check!.tier) ? 2 : 4);
      expect(row.paid.pieceCharges).toBe(0); expect(cast.before.spirituality - cast.final.spirituality).toBe(8);
      expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1); same(cast.before.progression.mastery, cast.final.progression.mastery);
      same(cast.before.uncleanMonarch.life.pieces, cast.final.uncleanMonarch.life.pieces);
      if (cast.final.uncleanMonarch.life.pending) expect(cast.final.uncleanMonarch.life.pending.expiresAt - cast.final.uncleanMonarch.life.pending.createdAt).toBe(20);
      if (caseId === 'withdrawn-input') {
        const withdrawal = replayCaptureBoundary(`${caseId}-withdraw_consent`);
        expect(attempt.withdrawn).toBe(true); expect(attempt.appliedAbilityIds).toEqual([]); expect(piece.charges).toBe(1); expect(piece.wear).toBe(0);
        expect(withdrawal.final.uncleanMonarch.life.pending).toBeNull(); same(withdrawal.before.progression.mastery, withdrawal.final.progression.mastery);
      }
      if (caseId === 'measured-reading') expect(attempt.checkBonus).toBe(attempt.appliedAbilityIds.length ? 35 : 0);
      if (caseId === 'observed-tension') { expect(attempt.baselinePressure).toBe(45); expect(attempt.feltPressure).toBe(attempt.appliedAbilityIds.length ? 15 : 45); }
      const returned = replayCaptureBoundary(`${caseId}-return_card`), leave = replayCaptureBoundary(`${caseId}-leave`);
      expect(returned.before.uncleanMonarch.life.site.card.location).toBe('PLAYER'); expect(returned.final.uncleanMonarch.life.site.card.location).toBe('NORA');
      expect(leave.final.uncleanMonarch.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, card: { location: 'NORA' } });
      expect(leave.final.uncleanMonarch.life.pending).toBeNull(); same(leave.before.progression.mastery, leave.final.progression.mastery);
      const report = replayCaptureBoundary(`${caseId}-honest-report`);
      expect(report.before.uncleanMonarch.life.cases[caseId].status).toBe('EXAMINED');
      for (const id of UNCLEAN_MONARCH_ABILITY_IDS) expect(report.final.progression.mastery[id]! - report.before.progression.mastery[id]!).toBe(attempt.appliedAbilityIds.includes(id) ? 8 : 0);
      expect(report.final.progression.acting - report.before.progression.acting).toBe(25);
      expect(life.journal.filter(entry => entry.command.type === 'REPORT' && entry.command.caseId === caseId)).toHaveLength(1);
    }
    for (const row of life.journal) {
      if (row.command.type === 'CONSENT') expect(row.paid.volunteerEffort).toBe(0);
      if (row.paid.volunteerEffort) { expect(['READ_ORIGINAL', 'REHEARSE_BELL']).toContain(row.command.type); expect(row.paid.volunteerEffort).toBe(3); }
      expect(row.siteAfter.clockSeconds - row.siteBefore.clockSeconds).toBe(row.elapsedSeconds);
      expect(row.siteAfter.playerTravelMetres - row.siteBefore.playerTravelMetres).toBe(sum(row.moves, move => move.metres));
      same(row.siteBefore.guide, row.siteAfter.guide); same(row.siteBefore.note, row.siteAfter.note); same(row.siteBefore.bell, row.siteAfter.bell);
    }
    expect(life.volunteerEffortSpent).toBe(sum(life.journal, row => row.paid.volunteerEffort)); expect(life.volunteerEffortSpent).toBeLessThanOrEqual(12);
    for (const [id, use] of Object.entries(expected.lifeAbilityUse)) expect(uncleanMonarchLifeMasteryGains(final)[id as typeof UNCLEAN_MONARCH_ABILITY_IDS[number]] ?? 0).toBe(use.reportedApplications * 8);
    expect(validateUncleanMonarchLifeState(final)).toBe(true);
  }, 240_000);

  it('replays only actual new rounds with exact sources, paid enemy plates, current strain and selected-versus-consumed effects', () => {
    const expected = observedCapture(), original = capturedState('prefixFinal'), final = capturedState('final');
    const rounds = final.combatHistory.slice(original.combatHistory.length);
    same(rounds.map(round => round.round), expected.combatRounds); same(summaryEntry('rounds'), rounds);
    same(actualCombatAbilityUse(final, original), expected.combatAbilityUse); same(summaryEntry('combatAbilityUse'), expected.combatAbilityUse);
    same([...new Set(rounds.flatMap(round => round.consequenceDomain ? [round.consequenceDomain] : []))], expected.consequenceDomains);
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.uncleanMonarchOutcome!, actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      same(save.final.lastCombatRound, round); same(currentUncleanMonarchCombatSource(save.before), o.source);
      same(replayUncleanMonarchCombatRound(o.source, round.stance).round, round);
      expect(o.source).toMatchObject({ targetId: 'UM1-HARLAN', targetName: '哈伦·维斯', targetAge: 47, actualBody: true,
        independentMind: true, enemyWeapon: 'UM1-HARLAN-ROD', maxActionCount: 6, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, automaticAllyImmunity: false, policy: 'ALL' });
      same(o.source.site, save.before.uncleanMonarch.encounter.currentSite); same(o.source.plates, save.before.uncleanMonarch.encounter.plates);
      same(o.source.piece, save.before.uncleanMonarch.encounter.piece); expect(o.source.strain).toBe(save.before.uncleanMonarch.encounter.strain);
      expect(o.source.site).toMatchObject({ volunteer: { location: 'OUTSIDE' }, card: { location: 'NORA' }, guide: { location: 'OUTSIDE' } });
      expect(round.playerCount).toBe(uncleanMonarchActionCount(round.playerCountRoll!)); expect(round.enemyCount).toBe(uncleanMonarchEnemyActionCount(round.enemyCountRoll!));
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount);
      same(actions.map(a => a.order), Array.from({ length: actions.length }, (_, index) => index));
      expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      expect(o.enemySpirituality).toBe(o.source.enemySpirituality - sum(o.enemyActions, a => a.paidCost));
      expect(o.strainAfter).toBe(o.source.strain + sum(o.playerActions, a => a.strainCost));
      expect(o.pieceAfter.charges).toBe(o.source.piece.charges - sum(actions, a => a.pieceChargePaid));
      expect(o.pieceAfter.wear).toBe(o.source.piece.wear + sum(actions, a => a.pieceWearPaid));
      expect(o.platesAfter).toHaveLength(3);
      for (const plate of o.source.plates) {
        const used = o.enemyActions.find(a => a.plateId === plate.id), after = o.platesAfter.find(p => p.id === plate.id)!;
        if (used) { expect(plate.status).toBe('HELD'); expect(after).toEqual({ ...plate, status: 'SPENT', usedRound: round.round, usedOrder: used.order }); expect(used.paidCost).toBe(7); }
        else same(after, plate);
      }
      for (const action of actions) {
        expect(action.elapsedSeconds).toBe(5); expect(action.atSeconds).toBe(o.source.clockSeconds + action.order * 5);
        expect(action.pieceWearPaid).toBe(action.pieceChargePaid);
        expect(action.randomCursorAfter).toBeGreaterThanOrEqual(action.randomCursorBefore);
      }
      for (const action of o.playerActions.filter(a => UNCLEAN_MONARCH_ABILITY_IDS.some(id => id === a.id))) {
        expect(action.pieceChargePaid).toBe(0); // The later applying slot pays, not the selected cast slot.
        if (action.attempted) { expect(action.paidCost).toBe(8); expect([2, 4]).toContain(action.mindCost); }
        else { expect(action.paidCost).toBe(0); expect(action.mindCost).toBe(0); expect(action.masteryApplied).toEqual([]); }
        if (action.chargeGranted) expect(action.expiresAt! - action.atSeconds).toBe(20);
        if (action.applied) {
          expect(action.appliedAmount).toBeGreaterThan(0); expect(action.chargeConsumedByOrder).not.toBeNull();
          const consumer = actions.find(a => a.order === action.chargeConsumedByOrder)!;
          expect(consumer.pieceChargePaid).toBe(1); expect(consumer.consumedEffectOrders).toContain(action.order);
          expect(action.masteryApplied).toContain(action.id); expect(action.appliedAmount).toBeLessThanOrEqual(action.id === UNCLEAN_MONARCH_ABILITY_IDS[0] ? 35 : 30);
        } else { expect(action.appliedAmount).toBe(0); expect(action.masteryApplied).toEqual([]); }
      }
      for (const action of o.enemyActions) {
        if (action.actual === 'DREAD_PULSE') { expect(action.attackKind).toBe('MENTAL'); expect(action.threatens).toBe(false); expect(action.receipt?.kind).toBe('MENTAL'); }
        if (action.actual === 'ARC_BOLT') { expect(action.attackKind).toBe('BODY'); expect(action.receipt?.kind).toBe('BODY'); }
        if (action.actual === 'CALM_BREATH') { expect(action.emotionAfter).toBe('CALM'); expect(action.paidCost).toBe(3); }
      }
      if (round.consequenceDomain === 'MENTAL') { expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined(); }
      if (round.consequenceDomain === 'BODY') { expect(round.consequenceWeights).not.toBeNull(); expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceRoll).toBeLessThanOrEqual(100); }
      expect(o.clockSecondsAfter - o.source.clockSeconds).toBe(60); expect(save.final.random.cursor).toBe(o.randomCursorAfter);
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      same(save.final.uncleanMonarch.encounter.piece, o.pieceAfter); same(save.final.uncleanMonarch.encounter.plates, o.platesAfter);
      expect(save.final.uncleanMonarch.encounter.strain).toBe(o.strainAfter);
    }
    same(final.uncleanMonarch.encounter.terminal, expected.terminal); expect(validateUncleanMonarchEncounterState(final)).toBe(true); assertOriginalContinuity(final, original);
  }, 240_000);

  it('reopens the actual stopping state without substituting a successful fight, death or ordinary exit', () => {
    const expected = observedCapture(), final = capturedState('final'), before = capturedState('beforeLast'), last = naturalEntry<SliceIntent>('lastIntent');
    same(captureMetadata().commands.at(-1), last); same(applySliceIntent(before, last), final);
    const reopened = currentCapture(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened);
    same(reopened, final); same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    const terminal = final.uncleanMonarch.encounter.terminal;
    if (terminal) {
      const outcome = final.combatHistory[terminal.historyIndex]!.uncleanMonarchOutcome!, site = getUncleanMonarchCurrentSite(final);
      if (terminal.outcome === 'PLAYER_DEAD') {
        expect(final).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } }); expect(projectSliceState(final).canAct).toBe(false);
        expect(terminal).toMatchObject({ exitMetres: 0, exitSeconds: 0 }); same(site, outcome.siteAfter);
      } else {
        expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(site.playerLocation).toBe('START');
        expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + 4); expect(site.clockSeconds).toBe(outcome.clockSecondsAfter + 4);
        expect(site.volunteer.location).toBe('OUTSIDE'); expect(site.card.location).toBe('NORA');
      }
      same(final.uncleanMonarch.encounter.piece, outcome.pieceAfter); same(final.uncleanMonarch.encounter.plates, outcome.platesAfter);
      expect(final.uncleanMonarch.encounter.strain).toBe(outcome.strainAfter);
    }
    if (expected.stage === 'NATURAL718_PREFIX_PUBLIC_UNCLEAN_MONARCH_CONTINUATION') {
      const work = replayCaptureBoundary('actual-work-after-living-exit'); expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      same(work.final, final); same(currentOriginals(work.final), currentOriginals(work.before)); same(work.final.random, work.before.random);
      expect(final.status).toBe('ACTIVE'); expect(projectSliceState(final).canAct).toBe(true);
    }
    assertOriginalContinuity(reopened, capturedState('prefixFinal'));
  }, 120_000);
});
