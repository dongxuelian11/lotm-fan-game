import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateAbominationAcquisitionJournal, validateAbominationJournalContinuity } from '../../src/domain/abomination/index.js';
import { ABOMINATION_ABILITY_IDS, ABOMINATION_SOURCE_KEYS, ABOMINATION_PREPARATION_IDS } from '../../src/domain/abomination/types.js';
import { ABOMINATION_CASE_IDS, getAbominationCurrentSite, abominationLifeMasteryGains, validateAbominationLifeState } from '../../src/domain/abomination/life.js';
import { validateAbominationEncounterState } from '../../src/domain/abomination/encounter.js';
import { currentAbominationCombatSource, replayAbominationCombatRound, abominationActionCount, abominationEnemyActionCount } from '../../src/domain/abomination/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ABOMINATION_CAPTURE_EVIDENCE as evidence, ABOMINATION_METADATA_FILES } from './abomination-capture-evidence.js';
import { ABOMINATION_ROOT as ROOT, ABOMINATION_SOURCE as SOURCE,
  ABOMINATION_PRIOR as PRIOR, ABOMINATION_PREFIX_COUNT as PREFIX, ABOMINATION_INHERITED_COUNT as INHERITED,
  ABOMINATION_SEED as SEED, captureMetadata, observedCapture, naturalEntry, sourceEntry, summaryEntry, capturePath,
  captureFileHash, insertionOrderHash, captureValueHash, captureJsonLines, currentCapture, originalLivingPrefix,
  capturedState, capturedSnapshot, replayCaptureBoundary, captureBody, sourceOriginals, currentOriginals,
  actualLifeAbilityUse, actualCombatAbilityUse, assertOriginalContinuity, sameCaptureValue as same } from './abomination-capture-helper.js';

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
interface Integrity { producerSha256: string; naturalSha256: string; commandsSha256: string; publicSha256: string;
  sourcePrefixSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; files: Record<string, string> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }

// The actual historical final is alive. Its dead and surrendered opponents are
// immutable evidence, never replacement bodies or refill stores.
describe('Abomination complete original642 living source and preserved terminal histories', () => {
  it('pins the immutable full raw178 source and prior507 campaign before CURRENT migration', async () => {
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256);
    expect(await captureFileHash(PRIOR)).toBe(evidence.priorSha256);
    const raw = sourceEntry<SliceState>('final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([178, 'ancient-evil-v178']);
    expect(raw).toMatchObject({ revision: 643, status: 'ACTIVE', health: 100 });
    const commands = sourceEntry<SliceIntent[]>('commands'), prior = readObjectEntry<SliceIntent[]>(PRIOR, 'commands');
    expect(commands).toHaveLength(642); expect(prior).toHaveLength(507); expect(PREFIX).toBe(642); expect(INHERITED).toBe(507);
    expect(sourceEntry('prefixCount')).toBe(INHERITED); same(commands.slice(0, INHERITED), prior);
    expect(insertionOrderHash(commands)).toBe(evidence.prefixSha256);
    for (const path of [SOURCE, PRIOR]) {
      const old = readObjectEntry<SliceState>(path, 'final'), migrated = currentCapture(old);
      expect(migrated.status).toBe('ACTIVE');
      for (const key of Object.keys(old) as (keyof SliceState)[]) if (key !== 'schemaVersion' && key !== 'contentVersion') same(migrated[key], old[key]);
      same(migrated.combatHistory, old.combatHistory); same(migrated.lastCombatRound, old.lastCombatRound);
    }
    const original = originalLivingPrefix();
    expect([original.schemaVersion, original.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of ABOMINATION_SOURCE_KEYS) same(original[key], raw[key]);
  }, 120_000);

  it('retains19 actual masteries, four zeroes, the original living Elsa and spent blocks without reviving Lena or Calder', () => {
    const s = originalLivingPrefix(), site = s.silentDisciple.life;
    expect(s).toMatchObject({ status: 'ACTIVE', revision: 643, week: 148, health: 100, mind: 97, spirituality: 105,
      cash: 730, actionsRemaining: 3, injuries: [], injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 22 },
      random: { seed: SEED, cursor: 228 }, progression: { pathwayId: 'chained', sequence: 2, acting: 100, promotionWeek: 6 } });
    expect(s.ancientEvil.promotionWeek).toBe(138);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180,
      coreStats: { physique: 30, perception: 24, will: 24, knowledge: 20 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(Object.entries(s.progression.mastery).filter(([, value]) => value === 0).map(([id]) => id)).toEqual([
      'chained.s7.toxic-claws', 'chained.s6.steel-body', 'chained.s6.death-craft', 'chained.s5.spirit-possession']);
    expect(site).toMatchObject({ siteId: 'SD3-QUIET-ROOM', playerLocation: 'START', playerTravelMetres: 112, clockSeconds: 4026,
      volunteer: { id: 'SD3-ELSA', bodyId: 'SD3-ELSA', age: 43, alive: true, willing: true, location: 'OUTSIDE', form: 'HUMAN', health: 100, mind: 100, spirituality: 100 },
      guide: { id: 'HARLAN', location: 'OUTSIDE' }, clothing: { id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true },
      bag: { id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' },
      tray: { id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' }, note: { id: 'SD3-NOTE', location: 'B', quantity: 1 } });
    expect(Object.hasOwn(site.volunteer, 'energy')).toBe(false); expect(Object.hasOwn(site, 'playerEnergy')).toBe(false);
    expect(s.ancientEvil.life.operation).toEqual({ door: 'OPEN', inputActive: false, form: null });
    expect(s.ancientEvil.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 98,
      weaponLocation: 'COURT', terminal: { outcome: 'ENEMY_DEAD' } });
    expect(s.ancientEvil.encounter.blocks.map(block => [block.status, block.location])).toEqual([
      ['SPENT', 'TARGET_GROUND'], ['SPENT', 'TARGET_GROUND'], ['SPENT', 'TARGET_GROUND']]);
    expect(s.silentDisciple.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 116,
      terminal: { outcome: 'ENEMY_SURRENDERED' } });
    expect(s.abomination.life.volunteerEffortSpent).toBe(0);
  }, 60_000);
});

it('requires coordinator-frozen observations before claiming a successful stage203 capture suite', () => { observedCapture(); });

describe.skipIf(evidence.observed === null)('Abomination actual original-seed capture, not a directed replacement', () => {
  it('pins every raw capture member, producer and metadata before explicitly migrating to CURRENT', async () => {
    const expected = observedCapture(), { boundaries, steps, snapshots } = captureMetadata();
    expect(expected.observedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await captureFileHash('scripts/play/abomination-stage.mjs')).toBe(expected.producerSha256);
    expect(Object.keys(expected.metadataHashes).sort()).toEqual([...ABOMINATION_METADATA_FILES].sort());
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
    same(readdirSync(ROOT).sort(), [...members, ...ABOMINATION_METADATA_FILES].sort());
    expect(members.length + ABOMINATION_METADATA_FILES.length).toBe(expected.files);
    for (const filename of members) {
      const path = capturePath(filename); expect(realpathSync(path)).toBe(resolve(path));
      expect(integrity.files[filename]).toMatch(/^[0-9a-f]{64}$/); expect(await captureFileHash(path)).toBe(integrity.files[filename]);
    }
    // Raw historical literals are deliberate; the CURRENT helper governs migration output only.
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) expect(naturalEntry(key)).toMatchObject({ schemaVersion: 200, contentVersion: 'abomination-v200' });
    for (const filename of Object.values(snapshots)) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(200);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('abomination-v200');
    }
    same(capturedState('prefixFinal'), originalLivingPrefix()); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
    const prefix = capturePath('source-prefix.json');
    expect(readObjectEntry(prefix, 'source')).toBe(SOURCE); expect(readObjectEntry(prefix, 'sourceSha256')).toBe(evidence.sourceSha256);
    expect(readObjectEntry(prefix, 'sourceRoot')).toBe('final'); expect(readObjectEntry(prefix, 'prefixCount')).toBe(PREFIX);
    expect(readObjectEntry(prefix, 'rawCommandsSha256')).toBe(evidence.prefixSha256);
    expect(readObjectEntry(prefix, 'inheritedDirectedPrefix')).toBe(false);
    same(readObjectEntry(prefix, 'rawInitial'), sourceEntry('initial'));
    same(readObjectEntry(prefix, 'rawFinal'), sourceEntry('final'));
    same(readObjectEntry(prefix, 'commands'), sourceEntry<SliceIntent[]>('commands').slice(0, PREFIX));
    // This digest records the complete schema200 state at capture time, not a future migration.
    const rawPrefix = naturalEntry<SliceState>('prefixFinal'), migratedPrefix = capturedState('prefixFinal');
    expect(readObjectEntry(prefix, 'migratedWholeStateSha256')).toBe(captureValueHash(rawPrefix));
    expect([migratedPrefix.schemaVersion, migratedPrefix.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of Object.keys(rawPrefix) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(migratedPrefix[key], rawPrefix[key]);
    }
    const defaults = createSliceRun(rawPrefix.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED);
    same(Object.keys(migratedPrefix).sort(), Object.keys(defaults).sort());
    for (const key of Object.keys(defaults) as (keyof SliceState)[]) {
      if (!Object.hasOwn(rawPrefix, key)) same(migratedPrefix[key], defaults[key]);
    }
    same(naturalEntry('provenance'), expected.provenance); same(naturalEntry('continuation'), expected.continuation);
    expect(naturalEntry('provenance')).toMatchObject({ kind: 'EXACT642_PUBLIC_ANCIENT_EVIL_THEN_PUBLIC_ABOMINATION',
      source: SOURCE, sourceRoot: 'final', inheritedDirectedPrefix: false,
      fullNaturalS9ToS1: capturedState('final').progression.sequence === 1, newRandomChanges: false });
    same(steps, expected.boundarySteps); same(Object.keys(snapshots), expected.snapshots);
  }, 240_000);

  it('retains the full original command prefix and literal stopping result without a second natural outcome search', () => {
    const expected = observedCapture(), { commands } = captureMetadata(), old = sourceEntry<SliceIntent[]>('commands');
    expect(old).toHaveLength(642); expect(commands).toHaveLength(expected.commands); same(commands.slice(0, PREFIX), old);
    expect(insertionOrderHash(old)).toBe(evidence.prefixSha256); expect(naturalEntry('prefixVerified')).toBe(true);
    expect(naturalEntry('prefixCount')).toBe(PREFIX); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED); expect(naturalEntry('seed')).toBe(SEED);
    same(naturalEntry('strategy'), expected.strategy); same(naturalEntry('creation'), sourceEntry('creation'));
    const final = capturedState('final'); same(captureBody(final), expected.final); assertValidSliceState(final); same(migrateSliceState(final), final);
    expect(final.revision).toBe(capturedState('initial').revision + commands.length);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    same(naturalEntry('pendingIntent'), expected.pendingIntent); expect(naturalEntry('failurePhase')).toBe(expected.failurePhase);
    expect(expected.stage).not.toBe('ACTUAL_BLOCKER'); assertOriginalContinuity(final, originalLivingPrefix());
    // scripts/play/abomination-stage.mjs --replay DIR separately reruns the
    // complete frozen strategy and compares every output without writing files.
  }, 120_000);

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
    let previousFullStateHash: string | null = null;
    for (const row of transitions) {
      const path = capturePath(row.file), ledger = newRows.get(row.commandIndex)!;
      expect(readObjectEntry(path, 'commandCount')).toBe(row.commandIndex); same(readObjectEntry(path, 'lastIntent'), ledger.intent);
      for (const [root, body, revision] of [['beforeLast', ledger.before, row.beforeRevision], ['final', ledger.after, row.afterRevision]] as const) {
        const raw = readObjectEntry<SliceState>(path, root);
        expect([raw.schemaVersion, raw.contentVersion, raw.revision]).toEqual([200, 'abomination-v200', revision]); same(captureBody(raw), body);
        if (root === 'beforeLast' && previousFullStateHash !== null) expect(captureValueHash(raw), `Complete state continuity at ${row.commandIndex}`).toBe(previousFullStateHash);
        if (root === 'final') previousFullStateHash = captureValueHash(raw);
      }
    }
    for (const filename of Object.values(snapshots)) {
      const state = JSON.parse(readFileSync(capturePath(filename), 'utf8')) as SliceState;
      const ledger = newRows.get(state.revision - 1); expect(ledger, filename).toBeDefined(); same(captureBody(state), ledger!.after);
    }
  }, 240_000);

  it('preserves healthy departure and actual acquisition fees, original bottles, failure costs and any observed promotion', () => {
    const expected = observedCapture(), original = capturedState('prefixFinal'), final = capturedState('final'), state = final.abomination;
    same(captureBody(original), expected.originalBody); same(original.character, expected.originalCharacter); same(original.progression.mastery, expected.originalMastery);
    same(naturalEntry('treatments'), expected.treatments); expect(expected.treatments).toEqual([]);
    same(capturedSnapshot('sourceHealthy'), capturedSnapshot('departure'));
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots'), receipt = guidance.final.abomination.acquisitionJournal.at(-1)!;
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    same(guidance.final.abomination.sourceScene!.originals, sourceOriginals(original));
    expect(state.preparations.map(row => row.taskId)).toEqual([...ABOMINATION_PREPARATION_IDS]);
    expect(new Set(state.bottles.map(row => row.id)).size).toBe(state.bottles.length);
    for (const bottle of state.bottles.filter(row => row.status === 'CONSUMED')) {
      const buy = replayCaptureBoundary(`actual1200p-buy-${bottle.id}`), prep = replayCaptureBoundary(`actual180p-current-week-prepare-${bottle.id}`), dose = replayCaptureBoundary(`consume-${bottle.id}`);
      const work = state.acquisitionJournal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id);
      expect(work).toHaveLength(5); for (const row of work) expect([row.before.actions - row.after.actions, row.before.cash - row.after.cash]).toEqual([1, 0]);
      expect(buy.final.abomination.acquisitionJournal.at(-1)!.before.cash - buy.final.abomination.acquisitionJournal.at(-1)!.after.cash).toBe(1200);
      expect(prep.final.abomination.acquisitionJournal.at(-1)!.before.cash - prep.final.abomination.acquisitionJournal.at(-1)!.after.cash).toBe(180);
      expect(dose.before.week - original.ancientEvil.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.abomination.preparedWeek).toBe(dose.before.week); expect(dose.final.abomination.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      same(dose.final.injuries, dose.before.injuries); same(currentOriginals(dose.final), currentOriginals(dose.before));
      expect(dose.final.spirituality).toBe(dose.before.spirituality);
      const doseReceipt = dose.final.abomination.acquisitionJournal.at(-1)!;
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
      const promoted = capturedSnapshot('promoted'); expect(ABOMINATION_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
      expect(promoted.abomination.ancientEvilActingAtPromotion).toBe(100);
      for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id]).toBe(mastery);
    }
    expect(validateAbominationAcquisitionJournal(final)).toBe(true); expect(validateAbominationJournalContinuity(final)).toBe(true);
  }, 240_000);

  it('separates paid casts, resistance and actual applications while consuming each finite test source once', () => {
    const expected = observedCapture(), final = capturedState('final'), life = final.abomination.life;
    same(actualLifeAbilityUse(final), expected.lifeAbilityUse); same(summaryEntry('lifeAbilityUse'), expected.lifeAbilityUse); same(summaryEntry('lifeCases'), life.cases);
    same(ABOMINATION_CASE_IDS.filter(id => life.cases[id].status === 'RESOLVED'), expected.completedCases);
    expect(new Set(life.pieces.map(piece => piece.id)).size).toBe(life.pieces.length);
    expect(new Set(life.pieces.map(piece => piece.testSourceId)).size).toBe(life.pieces.length);
    for (const caseId of expected.completedCases) {
      const c = life.cases[caseId], attempt = c.attempts[0]!, piece = life.pieces.find(row => row.caseId === caseId)!;
      expect(c.attempts).toHaveLength(1); expect(c).toMatchObject({ status: 'RESOLVED', returned: true, contactOpen: false });
      expect(attempt).toMatchObject({ closed: true, returned: true, verified: true, penniesSpent: 20, readTray: true, readOriginal: true, piecePlaced: true, applicationDone: true });
      expect(piece).toMatchObject({ paidPennies: 20, quantity: 1, status: 'RETURNED', location: 'RETURNED', testCharges: 0, testUses: 1 });
      expect(piece.charges).toBe(1 - attempt.appliedAbilityIds.length); expect(piece.wear).toBe(attempt.appliedAbilityIds.length);
      const cast = replayCaptureBoundary(`${caseId}-${caseId === 'spoken-hesitation' ? 'brief_cry' : 'spirit_barrier'}`), row = cast.final.abomination.life.journal.at(-1)!;
      const checkPassed = ['SUCCESS', 'GREAT_SUCCESS'].includes(row.check!.tier), succeeded = checkPassed && !attempt.resisted;
      expect(row.paid.spirituality).toBe(8); expect(row.paid.mind).toBe(succeeded ? 2 : 4);
      expect(cast.before.spirituality - cast.final.spirituality).toBe(8); same(cast.before.progression.mastery, cast.final.progression.mastery);
      expect(cast.final.random.cursor - cast.before.random.cursor).toBe(caseId === 'spoken-hesitation' && checkPassed ? 2 : 1);
      if (caseId === 'spoken-hesitation') {
        expect(row.resistanceRoll !== null).toBe(checkPassed); expect(attempt.resisted).toBe(checkPassed && row.resistanceRoll! <= 45);
        expect(row.paid.pieceCharges).toBe(succeeded ? 1 : 0);
        expect(cast.final.abomination.life.cue).toMatchObject({ actorId: 'SD3-ELSA', bodyId: 'SD3-ELSA', location: 'A', executed: false,
          delayImposedSeconds: succeeded ? 3 : 0, delayRemainingSeconds: succeeded ? 3 : 0 });
        const waits = life.journal.filter(r => r.command.type === 'WAIT_1' && r.command.caseId === caseId);
        expect(waits).toHaveLength(succeeded ? 3 : 0);
        for (const wait of waits) { expect(wait.elapsedSeconds).toBe(1); expect(wait.paid.actions).toBe(0); expect(wait.paid.spirituality).toBe(0); }
        expect(life.journal.filter(r => r.command.type === 'PERFORM_CUE' && r.command.caseId === caseId)).toHaveLength(succeeded ? 0 : 1);
      } else {
        expect(row.paid.pieceCharges).toBe(0); same(cast.before.abomination.life.pieces, cast.final.abomination.life.pieces);
        const window = cast.final.abomination.life.pending;
        if (window) expect(window.expiresAt - window.createdAt).toBe(20);
        const pulse = replayCaptureBoundary(`${caseId}-perform_pulse`), receipt = pulse.final.abomination.life.journal.at(-1)!;
        const applied = attempt.appliedAbilityIds.includes(ABOMINATION_ABILITY_IDS[0]);
        expect(receipt.paid).toMatchObject({ testCharges: 1, pieceCharges: applied ? 1 : 0, mind: applied ? 1 : 3 });
        expect(attempt.baselinePressure).toBe(45); expect(attempt.feltPressure).toBe(applied ? 15 : 45);
        expect(pulse.final.random.cursor).toBe(pulse.before.random.cursor + 1); expect(pulse.final.abomination.life.pulse?.resolved).toBe(true);
        same(pulse.before.progression.mastery, pulse.final.progression.mastery);
      }
      if (caseId === 'withdrawn-input') {
        const withdrawal = replayCaptureBoundary(`${caseId}-withdraw_consent`);
        expect(attempt.withdrawn).toBe(true); expect(attempt.appliedAbilityIds).toEqual([]); expect(piece.charges).toBe(1); expect(piece.wear).toBe(0);
        expect(withdrawal.final.abomination.life.pending).toBeNull(); same(withdrawal.before.random, withdrawal.final.random);
        same(withdrawal.before.progression.mastery, withdrawal.final.progression.mastery);
      }
      const returned = replayCaptureBoundary(`${caseId}-return_piece`), leave = replayCaptureBoundary(`${caseId}-leave`);
      expect(returned.before.abomination.life.pieces.find(p => p.id === piece.id)?.location).toBe('HAND');
      expect(returned.final.abomination.life.pieces.find(p => p.id === piece.id)?.location).toBe('RETURNED');
      expect(leave.final.abomination.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, clothing: { location: 'ELSA', worn: true }, bag: { location: 'ELSA' } });
      expect(leave.final.abomination.life.pending).toBeNull(); same(leave.before.progression.mastery, leave.final.progression.mastery);
      const report = replayCaptureBoundary(`${caseId}-honest-report`);
      expect(report.before.abomination.life.cases[caseId].status).toBe('EXAMINED');
      for (const id of ABOMINATION_ABILITY_IDS) expect(report.final.progression.mastery[id]! - report.before.progression.mastery[id]!).toBe(attempt.appliedAbilityIds.includes(id) ? 8 : 0);
      expect(report.final.progression.acting - report.before.progression.acting).toBe(25);
      expect(life.journal.filter(entry => entry.command.type === 'REPORT' && entry.command.caseId === caseId)).toHaveLength(1);
    }
    const invitations = life.journal.filter(row => row.command.type === 'INVITE');
    expect(invitations).toHaveLength(expected.completedCases.length ? 1 : 0);
    for (const invitation of invitations) expect(invitation.siteAfter.volunteer.location).toBe('OUTSIDE');
    const volunteerMoves = life.journal.flatMap(row => row.moves).filter(move => move.actorId === 'SD3-ELSA');
    if (expected.completedCases.length) same(volunteerMoves, [
      { actorId: 'SD3-ELSA', from: 'OUTSIDE', to: 'START', metres: 4, seconds: 4, itemIds: ['SD3-CLOTHES', 'SD3-BAG'] },
      { actorId: 'SD3-ELSA', from: 'START', to: 'A', metres: 4, seconds: 4, itemIds: ['SD3-CLOTHES', 'SD3-BAG'] }]);
    for (const row of life.journal) {
      if (row.command.type === 'CONSENT') expect(row.paid.volunteerEffort).toBe(0);
      if (row.paid.volunteerEffort) { expect(row.command.type).toBe('READ_ORIGINAL'); expect(row.paid.volunteerEffort).toBe(3); }
      expect(row.siteAfter.clockSeconds - row.siteBefore.clockSeconds).toBe(row.elapsedSeconds);
      expect(row.siteAfter.playerTravelMetres - row.siteBefore.playerTravelMetres).toBe(sum(row.moves.filter(move => move.actorId === 'PLAYER'), move => move.metres));
      for (const key of ['guide', 'note', 'tray', 'clothing', 'bag'] as const) same(row.siteBefore[key], row.siteAfter[key]);
      same(row.operationBefore, row.operationAfter);
    }
    expect(life.volunteerEffortSpent).toBe(sum(life.journal, row => row.paid.volunteerEffort)); expect(life.volunteerEffortSpent).toBeLessThanOrEqual(12);
    for (const [id, use] of Object.entries(expected.lifeAbilityUse)) expect(abominationLifeMasteryGains(final)[id as typeof ABOMINATION_ABILITY_IDS[number]] ?? 0).toBe(use.reportedApplications * 8);
    expect(validateAbominationLifeState(final)).toBe(true);
  }, 240_000);

  it('replays actual new rounds with finite original plates, real clocks and consumed windows rather than selected casts', () => {
    const expected = observedCapture(), original = capturedState('prefixFinal'), final = capturedState('final');
    const rounds = final.combatHistory.slice(original.combatHistory.length);
    same(rounds.map(round => round.round), expected.combatRounds); same(summaryEntry('rounds'), rounds);
    same(actualCombatAbilityUse(final, original), expected.combatAbilityUse); same(summaryEntry('combatAbilityUse'), expected.combatAbilityUse);
    same([...new Set(rounds.flatMap(round => round.consequenceDomain ? [round.consequenceDomain] : []))], expected.consequenceDomains);
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.abominationOutcome!, actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      same(save.final.lastCombatRound, round); same(currentAbominationCombatSource(save.before), o.source);
      same(replayAbominationCombatRound(o.source, round.stance, o.cursePolicy, o.madmanBurst.policy).round, round);
      expect(o.source).toMatchObject({ targetId: 'AB1-RODERICK', targetName: '罗德里克·霍尔', targetAge: 45, actualBody: true,
        independentMind: true, enemyWeapon: 'AB1-RODERICK-ROD', maxActionCount: 6, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, automaticAllyImmunity: false, policy: 'ALL' });
      same(o.source.site, save.before.abomination.encounter.currentSite); same(o.source.body.plates, save.before.abomination.encounter.plates);
      same(o.source.body.piece, save.before.abomination.encounter.piece); same(o.source.body.blocks, original.ancientEvil.encounter.blocks);
      expect(o.source.site).toMatchObject({ volunteer: { location: 'OUTSIDE' }, clothing: { location: 'ELSA', worn: true }, bag: { location: 'ELSA' }, guide: { location: 'OUTSIDE' } });
      expect(round.playerCount).toBe(abominationActionCount(round.playerCountRoll!)); expect(round.enemyCount).toBe(abominationEnemyActionCount(round.enemyCountRoll!));
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount);
      same(actions.map(a => a.order), Array.from({ length: actions.length }, (_, index) => index));
      expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - sum(o.playerActions, a => a.paidCost));
      expect(o.enemySpirituality).toBe(o.source.body.enemySpirituality - sum(o.enemyActions, a => a.paidCost));
      expect(o.piece!.charges).toBe(o.source.body.piece!.charges - sum(actions, a => a.pieceChargePaid));
      expect(o.piece!.wear).toBe(o.source.body.piece!.wear + sum(actions, a => a.pieceWearPaid));
      expect(o.plates).toHaveLength(3);
      for (const plate of o.source.body.plates) {
        const used = o.enemyActions.find(a => a.receipt?.plateId === plate.id), after = o.plates.find(p => p.id === plate.id)!;
        if (used) { expect(plate.status).toBe('HELD'); expect(after).toEqual({ ...plate, status: 'SPENT', usedRound: round.round, usedOrder: used.order }); expect(used.paidCost).toBe(7); }
        else same(after, plate);
      }
      let actionClock = o.source.site.clockSeconds;
      for (const action of actions) {
        expect(action.atSeconds).toBe(actionClock); expect(action.elapsedSeconds).toBe(5 + action.hesitationSeconds); actionClock += action.elapsedSeconds;
        expect(action.pieceWearPaid).toBe(action.pieceChargePaid); expect(action.pieceChargePaid).toBe(action.windowsApplied.length);
        expect(action.randomCursorAfter).toBeGreaterThanOrEqual(action.randomCursorBefore);
        for (const used of action.windowsApplied) {
          const cast = actions.find(candidate => candidate.order === used.order && used.round === round.round);
          expect(cast?.windowGranted?.kind).toBe(used.kind); expect(action.attackKind).toBe('MENTAL'); expect(action.actor).toBe('ENEMY');
          expect(action.atSeconds).toBeLessThan(cast!.windowGranted!.expiresAt); expect(used.amount).toBeGreaterThan(0); expect(used.amount).toBeLessThanOrEqual(30);
          expect(action.masteryApplied).toContain(ABOMINATION_ABILITY_IDS[used.kind === 'BARRIER' ? 0 : 1]);
        }
        expect(action.hesitationSeconds).toBe(action.windowsApplied.filter(w => w.kind === 'CRY').length * 3);
      }
      for (const action of o.playerActions.filter(a => ABOMINATION_ABILITY_IDS.some(id => id === a.id))) {
        expect(action.pieceChargePaid).toBe(0); expect(action.masteryApplied).toEqual([]);
        if (action.attempted) { expect(action.paidCost).toBe(8); expect(action.mindCost).toBe(action.succeeded ? 2 : 4); }
        else { expect(action.paidCost).toBe(0); expect(action.mindCost).toBe(0); }
        if (action.windowGranted) expect(action.windowGranted.expiresAt - action.windowGranted.castAt).toBe(20);
      }
      for (const action of o.enemyActions) {
        if (action.mode === 'MIND_SPIKE') { expect(action.attackKind).toBe('MENTAL'); expect(action.threatens).toBe(false); expect(action.receipt?.kind).toBe('MENTAL'); expect(action.paidCost).toBe(7); expect(action.selfGain + sum(action.windowsApplied, w => w.amount)).toBe(75); }
        if (action.mode === 'BODY') { expect(action.attackKind).toBe('BODY'); expect(action.windowsApplied).toEqual([]); expect(action.pieceChargePaid).toBe(0); }
        if (action.mode === 'CALM') expect(action.paidCost).toBe(3);
      }
      if (round.consequenceDomain === 'MENTAL') { expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined(); expect(Object.hasOwn(round, 'consequenceRoll')).toBe(false); }
      if (round.consequenceDomain === 'BODY') { expect(round.consequenceWeights).not.toBeNull(); expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceRoll).toBeLessThanOrEqual(100); }
      expect(o.elapsedSeconds).toBe(60 + sum(actions, a => a.hesitationSeconds)); expect(o.siteAfter.clockSeconds - o.source.site.clockSeconds).toBe(o.elapsedSeconds);
      expect(save.final.random.cursor).toBe(o.randomCursorAfter);
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      same(save.final.abomination.encounter.piece, o.piece); same(save.final.abomination.encounter.plates, o.plates); same(o.blocks, original.ancientEvil.encounter.blocks);
    }
    same(final.abomination.encounter.terminal, expected.terminal); expect(validateAbominationEncounterState(final)).toBe(true); assertOriginalContinuity(final, original);
  }, 240_000);

  it('reopens the actual stopping state and retains terminal form waits, ordinary exit and old dead archives', () => {
    const expected = observedCapture(), final = capturedState('final'), before = capturedState('beforeLast'), last = naturalEntry<SliceIntent>('lastIntent');
    same(captureMetadata().commands.at(-1), last); same(applySliceIntent(before, last), final);
    const reopened = currentCapture(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened);
    same(reopened, final); same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    const terminal = final.abomination.encounter.terminal;
    if (terminal) {
      const outcome = final.combatHistory[terminal.historyIndex]!.abominationOutcome!, site = getAbominationCurrentSite(final);
      if (terminal.outcome === 'PLAYER_DEAD') {
        expect(final).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } }); expect(projectSliceState(final).canAct).toBe(false);
        expect(terminal).toMatchObject({ exitMetres: 0, exitSeconds: 0 }); expect(site.playerLocation).toBe('YARD');
      } else {
        expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(site.playerLocation).toBe('START');
        expect(site.volunteer.location).toBe('OUTSIDE'); expect(site.clothing.location).toBe('ELSA'); expect(site.bag.location).toBe('ELSA');
      }
      expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + terminal.exitMetres);
      expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + terminal.formWaitSeconds + terminal.exitSeconds);
      same(final.abomination.encounter.piece, outcome.piece); same(final.abomination.encounter.plates, outcome.plates);
    }
    if (expected.stage === 'NATURAL642_PREFIX_PUBLIC_ABOMINATION_CONTINUATION') {
      const work = replayCaptureBoundary('actual-work-after-living-exit'); expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      same(work.final, final); same(currentOriginals(work.final), currentOriginals(work.before)); same(work.final.random, work.before.random);
      expect(final.status).toBe('ACTIVE'); expect(projectSliceState(final).canAct).toBe(true);
    }
    assertOriginalContinuity(reopened, capturedState('prefixFinal'));
  }, 120_000);
});
