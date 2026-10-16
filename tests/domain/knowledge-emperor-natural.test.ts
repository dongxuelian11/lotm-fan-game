import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateKnowledgeEmperorSource, validateKnowledgeEmperorAcquisitionJournal,
  validateKnowledgeEmperorJournalContinuity } from '../../src/domain/knowledge-emperor/index.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS, KNOWLEDGE_EMPEROR_SOURCE_KEYS,
  KNOWLEDGE_EMPEROR_PREPARATION_IDS } from '../../src/domain/knowledge-emperor/types.js';
import { KNOWLEDGE_EMPEROR_CASE_IDS, getKnowledgeEmperorCurrentSite, knowledgeEmperorLifeMasteryGains,
  validateKnowledgeEmperorLifeState } from '../../src/domain/knowledge-emperor/life.js';
import { knowledgeEmperorFinanceSnapshot, validateKnowledgeEmperorEncounterState } from '../../src/domain/knowledge-emperor/encounter.js';
import { currentKnowledgeEmperorCombatSource, replayKnowledgeEmperorCombatRound,
  knowledgeEmperorActionCount, knowledgeEmperorEnemyActionCount } from '../../src/domain/knowledge-emperor/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { KNOWLEDGE_EMPEROR_CAPTURE_EVIDENCE as expected } from './knowledge-emperor-capture-evidence.js';
import { KNOWLEDGE_EMPEROR_ROOT as ROOT, KNOWLEDGE_EMPEROR_SOURCE as SOURCE, KNOWLEDGE_EMPEROR_PRIOR as PRIOR,
  KNOWLEDGE_EMPEROR_PREFIX_COUNT as PREFIX, KNOWLEDGE_EMPEROR_INHERITED_COUNT as INHERITED,
  KNOWLEDGE_EMPEROR_SEED as SEED, captureCommands as commands, boundaryIndex, boundarySteps, snapshotIndex,
  naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash, insertionOrderHash, captureValueHash,
  captureJsonLines, currentCapture, capturedState, capturedSnapshot, namedBoundary, replayCaptureBoundary,
  captureBody, assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './knowledge-emperor-capture-helper.js';

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
interface Integrity { producerSha256: string; naturalSha256: string; commandsSha256: string; publicSha256: string;
  sourcePrefixSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; files: Record<string, string> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }

// The unchanged original seed reaches S1 naturally and dies in the first actual
// independent fight. No directed prefix, successful power, exit, or later work
// is substituted for this capture's observed choices and consequences.
describe('Knowledge Emperor exact651 natural history and actual831-command public continuation', () => {
  it('pins raw175 source, raw152 ancestry, frozen producer and every raw197 capture member before explicit CURRENT migration', async () => {
    expect(await captureFileHash(SOURCE)).toBe(expected.sourceSha256);
    expect(await captureFileHash(PRIOR)).toBe(expected.priorSha256);
    expect(await captureFileHash('scripts/play/knowledge-emperor-stage.mjs')).toBe(expected.producerSha256);
    for (const [filename, hash] of Object.entries(expected.metadataHashes)) {
      const actualPath = filename.endsWith('.jsonl') ? `${ROOT}/${filename}` : capturePath(filename);
      expect(realpathSync(actualPath), filename).toBe(resolve(actualPath));
      expect(await captureFileHash(actualPath), filename).toBe(hash);
    }
    const integrity = JSON.parse(readFileSync(`${ROOT}/capture-integrity.json`, 'utf8')) as Integrity;
    expect(integrity).toMatchObject({ producerSha256: expected.producerSha256,
      naturalSha256: expected.metadataHashes['natural.json'], commandsSha256: expected.metadataHashes['commands.jsonl'],
      publicSha256: expected.metadataHashes['public.jsonl'], sourcePrefixSha256: expected.metadataHashes['source-prefix.json'],
      boundaryIndexSha256: expected.metadataHashes['boundaries.index.json'], boundaryStepsSha256: expected.metadataHashes['boundaries.steps.json'],
      transitionsSha256: expected.metadataHashes['transitions.json'], summarySha256: expected.metadataHashes['summary.json'] });
    const members = [...new Set([...Object.values(boundaryIndex), ...Object.values(snapshotIndex)])].sort();
    expect(Object.keys(integrity.files).sort()).toEqual(members);
    expect(readdirSync(ROOT).sort()).toEqual([...members, ...Object.keys(expected.metadataHashes)].sort());
    expect(members.length + Object.keys(expected.metadataHashes).length).toBe(expected.files);
    for (const filename of members) {
      const path = capturePath(filename); expect(realpathSync(path), filename).toBe(resolve(path));
      expect(integrity.files[filename], filename).toMatch(/^[0-9a-f]{64}$/);
      expect(await captureFileHash(path), filename).toBe(integrity.files[filename]);
    }
    const raw = sourceEntry<SliceState>('final'), prior = readObjectEntry<SliceState>(PRIOR, 'final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([175, 'sage-v175']);
    expect([prior.schemaVersion, prior.contentVersion]).toEqual([152, 'prophecy-master-v152']);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) {
      expect(naturalEntry(key)).toMatchObject({ schemaVersion: 197, contentVersion: 'knowledge-emperor-v197' });
    }
    for (const filename of Object.values(snapshotIndex)) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(197);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('knowledge-emperor-v197');
    }
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), currentCapture(raw)); same(capturedState('initial'), currentCapture(sourceEntry('initial')));
    same(naturalEntry('provenance'), expected.provenance); same(naturalEntry('continuation'), expected.continuation);
    same(sourceEntry('provenance'), expected.provenance.prior);
    expect(naturalEntry('provenance')).toMatchObject({ inheritedDirectedPrefix: false, fullNaturalS9ToS1: true, newRandomChanges: false });
    expect(sourceEntry('prefixCount')).toBe(INHERITED); expect(naturalEntry('inheritedPrefixCount')).toBe(INHERITED);
    const prefixPath = capturePath('source-prefix.json');
    expect(readObjectEntry(prefixPath, 'source')).toBe(SOURCE); expect(readObjectEntry(prefixPath, 'sourceSha256')).toBe(expected.sourceSha256);
    expect(readObjectEntry(prefixPath, 'prefixCount')).toBe(PREFIX); expect(readObjectEntry(prefixPath, 'inheritedDirectedPrefix')).toBe(false);
    expect(readObjectEntry(prefixPath, 'rawCommandsSha256')).toBe(expected.prefixSha256);
    same(readObjectEntry(prefixPath, 'rawInitial'), sourceEntry('initial')); same(readObjectEntry(prefixPath, 'rawFinal'), raw);
    same(readObjectEntry(prefixPath, 'commands'), sourceEntry('commands'));
    same(commands.slice(0, INHERITED), readObjectEntry(PRIOR, 'commands'));
    expect(readObjectEntry<SliceIntent[]>(PRIOR, 'commands')).toHaveLength(507);
  }, 240_000);

  it('retains the actual outside30-energy source, stopped disaster, living Merrin, exhausted originals and thirteen exact mastery values', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), site = original.sage.encounter.currentSite!;
    same(captureBody(original), expected.originalBody); same(original.character, expected.originalCharacter);
    same(original.progression.mastery, expected.originalMastery);
    expect(Object.keys(original.progression.mastery)).toHaveLength(13);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(3);
    expect(original).toMatchObject({ careKnown: false, injuryRisk: 1, health: 40, cash: 770, week: 152 });
    expect(original.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['HEAVY', null], ['HEAVY', null]]);
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 30, playerTravelMetres: 66, clockSeconds: 510,
      body: 'SOLID', form: { active: false }, iris: { location: 'OUTSIDE', energy: 78, travelMetres: 22 },
      archive: { readings: 2, verifications: 2 }, record: { travelMetres: 72 } });
    expect(site).not.toEqual(original.sage.life.site);
    expect(site.materials.map(row => [row.status, row.wear])).toEqual([['RETURNED', 2], ['RETURNED', 2], ['RETURNED', 4]]);
    expect(original.scrollProfessor.workshop.scrolls).toHaveLength(9);
    expect(original.scrollProfessor.workshop.scrolls.every(scroll => scroll.status === 'USED' && !scroll.authorized)).toBe(true);
    expect(original.scrollProfessor.workshop.materials).toHaveLength(12);
    expect(original.scrollProfessor.workshop.materials.every(material => material.status === 'SPENT')).toBe(true);
    expect(original.sage.ritual).toMatchObject({ status: 'STOPPED', closure: 'SEALED', records: { damaged: 5 }, plates: { damaged: 2 } });
    expect(original.sage.ritual.people.map(person => [person.location, person.health, person.mind])).toEqual([['OUTSIDE', 88, 82], ['OUTSIDE', 91, 79]]);
    expect(original.sage.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyStatus: 'RESISTING',
      terminal: { outcome: 'RETREATED', round: 5, enemySpirituality: 77 } });
    for (const key of KNOWLEDGE_EMPEROR_SOURCE_KEYS) same(final[key], original[key]);
    assertOriginalContinuity(final, original);
  }, 60_000);

  it('replays all831 commands exactly once from original creation with enabled public controls after651', () => {
    expect(PREFIX).toBe(651); expect(commands).toHaveLength(expected.commands);
    const originalCommands = sourceEntry<SliceIntent[]>('commands'); expect(originalCommands).toHaveLength(PREFIX);
    same(commands.slice(0, PREFIX), originalCommands); expect(insertionOrderHash(originalCommands)).toBe(expected.prefixSha256);
    expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('prefixCount')).toBe(PREFIX);
    same(naturalEntry('strategy'), expected.strategy); expect(naturalEntry('seed')).toBe(SEED);
    let state = currentCapture(sourceEntry('initial')); const original = capturedState('prefixFinal');
    same(state, capturedState('initial')); expect(state.progression.sequence).toBeNull();
    for (const [index, intent] of commands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(PREFIX); expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending?.kind).not.toBe('DEATH');
      } else expect(state.status, `No command after death at step ${index + 1}`).toBe('ACTIVE');
      if (index >= PREFIX) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe(SEED);
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === PREFIX - 1) same(state, original);
      if (index >= PREFIX) assertOriginalContinuity(state, original);
    }
    same(state, capturedState('final')); same(captureBody(state), expected.final);
    assertValidSliceState(state); same(migrateSliceState(state), state);
    expect(state.revision).toBe(capturedState('initial').revision + expected.commands);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBeNull();
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
  }, 480_000);

  it('keeps complete contiguous command/public ledgers,184 names,181 unique transitions and only the eight observed snapshots', async () => {
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.namedBoundaries); same(Object.keys(boundarySteps), Object.keys(boundaryIndex));
    same(Object.keys(snapshotIndex), expected.snapshots); expect(snapshotIndex.combatTerminal).toBeUndefined();
    const transitions = JSON.parse(readFileSync(`${ROOT}/transitions.json`, 'utf8')) as Transition[];
    expect(transitions).toHaveLength(expected.uniqueTransitions); expect(transitions).toHaveLength(expected.commands - PREFIX + 1);
    expect([...new Set(Object.values(boundaryIndex))]).toEqual(transitions.map(row => row.file));
    const firstNames = new Map<number, string>(), byStep = new Map(transitions.map(row => [row.commandIndex, row]));
    for (const [index, transition] of transitions.entries()) {
      const step = PREFIX + index;
      expect(transition).toMatchObject({ commandIndex: step, beforeRevision: step, afterRevision: step + 1 });
      expect(boundaryIndex[transition.key]).toBe(transition.file); expect(boundarySteps[transition.key]).toBe(step);
    }
    let aliases = 0;
    for (const [name, filename] of Object.entries(boundaryIndex)) {
      const step = boundarySteps[name]!, transition = byStep.get(step); expect(transition, name).toBeDefined();
      expect(filename).toBe(transition!.file);
      if (firstNames.has(step)) aliases++; else { firstNames.set(step, name); expect(name).toBe(transition!.key); }
    }
    expect(firstNames.size).toBe(expected.uniqueTransitions); expect(aliases).toBe(expected.aliases);
    for (const [name, step] of Object.entries(expected.specialSteps)) expect(boundarySteps[name], name).toBe(step);
    type Ledger = { step: number; sourcePrefix: boolean; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    let count = 0, previous = captureBody(capturedState('initial')); const newRows = new Map<number, Ledger>();
    for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
      expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX); same(row.intent, commands[count - 1]);
      same(row.before, previous); expect(row.after.revision).toBe(row.before.revision + 1); previous = row.after;
      if (count > PREFIX) newRows.set(count, row);
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
  }, 120_000);

  it('pays for actual clinic discovery and recovery,500 guidance and three separately laboured1200+180 bottles before week185 promotion', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), journal = final.knowledgeEmperor.acquisitionJournal;
    const discovery = replayCaptureBoundary('actual-discovery-of-ordinary-clinic');
    expect(discovery.intent).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(discovery.before.careKnown).toBe(false); expect(discovery.final.careKnown).toBe(true);
    same(discovery.final.injuries, original.injuries); same(discovery.before.random, discovery.final.random);
    same(naturalEntry('treatments'), expected.treatments); expect(expected.treatments).toHaveLength(1);
    const treatment = namedBoundary('step-654-event_choice');
    expect(treatment.intent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(treatment.before.cash - treatment.final.cash).toBe(60); expect(treatment.final.health).toBe(treatment.before.health);
    expect(treatment.final.injuries).toHaveLength(2); expect(treatment.final.injuries.every(injury => injury.treatedRevision !== null)).toBe(true);
    expect(capturedSnapshot('sourceRecovered')).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0 });
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots');
    const guidanceReceipt = guidance.final.knowledgeEmperor.acquisitionJournal.at(-1)!;
    expect(guidanceReceipt.before.cash - guidanceReceipt.after.cash).toBe(500);
    // The last weekly action also settles the ordinary30p bill after the500p fee.
    expect([guidance.before.cash, guidance.final.cash, guidance.before.week, guidance.final.week]).toEqual([980, 450, 155, 156]);
    same(guidance.final.knowledgeEmperor.sourceScene!.originals, { site: original.sage.encounter.currentSite, workshop: original.scrollProfessor.workshop });
    same(final.knowledgeEmperor.bottles, expected.bottles);
    expect(final.knowledgeEmperor.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
    expect(final.knowledgeEmperor.bottles.map(bottle => bottle.consumedWeek)).toEqual([164, 174, 185]);
    expect(final.knowledgeEmperor.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(boundaryIndex['paid-next-week-resupply']).toBeUndefined();
    same(journal.filter(row => row.check).map(row => [row.command, row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]), expected.acquisitionChecks);
    for (const bottle of final.knowledgeEmperor.bottles) {
      const buy = replayCaptureBoundary(`actual1200p-buy-${bottle.id}`), prep = replayCaptureBoundary(`actual180p-current-week-prepare-${bottle.id}`), dose = replayCaptureBoundary(`consume-${bottle.id}`);
      const work = journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id);
      expect(work).toHaveLength(5); for (const row of work) expect([row.before.actions - row.after.actions, row.before.cash - row.after.cash]).toEqual([1, 0]);
      expect(buy.final.knowledgeEmperor.acquisitionJournal.at(-1)!.before.cash - buy.final.knowledgeEmperor.acquisitionJournal.at(-1)!.after.cash).toBe(1200);
      expect(prep.final.knowledgeEmperor.acquisitionJournal.at(-1)!.before.cash - prep.final.knowledgeEmperor.acquisitionJournal.at(-1)!.after.cash).toBe(180);
      expect(dose.before.week - original.sage.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.knowledgeEmperor.preparedWeek).toBe(dose.before.week); expect(dose.final.knowledgeEmperor.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1); same(dose.final.injuries, dose.before.injuries);
      same(getKnowledgeEmperorCurrentSite(dose.final), getKnowledgeEmperorCurrentSite(dose.before));
      expect(dose.final.spirituality).toBe(dose.before.spirituality);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!)); expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
    }
    expect(final.knowledgeEmperor.preparations.map(row => row.taskId)).toEqual([...KNOWLEDGE_EMPEROR_PREPARATION_IDS]);
    const promoted = capturedSnapshot('promoted'); expect(promoted.knowledgeEmperor.promotionWeek).toBe(185);
    expect(KNOWLEDGE_EMPEROR_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id]).toBe(mastery);
    expect(validateKnowledgeEmperorAcquisitionJournal(final)).toBe(true); expect(validateKnowledgeEmperorJournalContinuity(final)).toBe(true);
  }, 240_000);

  it('retains three failed ability checks, paid ordinary completion, real force spending, withdrawal and report-only mastery', () => {
    const final = capturedState('final'), life = final.knowledgeEmperor.life;
    same(summaryEntry('lifeAbilityUse'), expected.lifeAbilityUse); same(summaryEntry('lifeCases'), life.cases);
    same(life.journal.filter(row => row.check).map(row => [row.command, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]), expected.lifeChecks);
    same(Object.fromEntries(KNOWLEDGE_EMPEROR_CASE_IDS.map(id => { const c = life.cases[id]; return [id, {
      status: c.status, result: c.result, returned: c.returned,
      attempts: c.attempts.map(({ siteAtStart: _start, siteAtClose: _close, ...attempt }) => attempt) }]; })), expected.lifeResults);
    same(life.notes, expected.notes); expect(life.notes.map(note => [note.charges, note.wear])).toEqual([[0, 1], [0, 2], [1, 0]]);
    expect(new Set(life.notes.map(note => note.substrateId)).size).toBe(3);
    for (const [caseId, command] of [['knowledge-power', 'knowledge_power'], ['power-knowledge', 'power_knowledge'], ['withdrawn-consent', 'knowledge_power']] as const) {
      const cast = replayCaptureBoundary(`${caseId}-${command}`), attempt = life.cases[caseId].attempts[0]!;
      expect(life.cases[caseId].attempts).toHaveLength(1); expect(attempt).toMatchObject({ result: 'ORDINARY', closed: true, returned: true, appliedAbilityIds: [] });
      expect(cast.before.spirituality - cast.final.spirituality).toBe(8); expect(cast.before.mind - cast.final.mind).toBe(2);
      expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1); expect(cast.final.knowledgeEmperor.life.pending).toBeNull();
      same(cast.before.progression.mastery, cast.final.progression.mastery);
      const report = replayCaptureBoundary(`${caseId}-honest-report`);
      expect(report.before.knowledgeEmperor.life.cases[caseId].status).toBe('EXAMINED'); expect(report.final.knowledgeEmperor.life.cases[caseId].status).toBe('RESOLVED');
      same(report.final.progression.mastery, report.before.progression.mastery);
      expect(report.final.progression.acting - report.before.progression.acting).toBe(25);
      const hash = captureValueHash(report.final); expect(() => applySliceIntent(report.final, report.intent)).toThrow(); expect(captureValueHash(report.final)).toBe(hash);
    }
    const power = replayCaptureBoundary('knowledge-power-apply_power');
    expect(power.final.knowledgeEmperor.life.cases['knowledge-power'].attempts[0]).toMatchObject({ baselineStabilization: 3, measuredStabilization: 3, appliedAbilityIds: [] });
    same(power.before.random, power.final.random); same(power.before.progression.mastery, power.final.progression.mastery);
    const force = replayCaptureBoundary('power-knowledge-spend_force');
    expect(force.before.spirituality - force.final.spirituality).toBe(4);
    expect(force.final.knowledgeEmperor.life.cases['power-knowledge'].attempts[0]!.forceReceipt).toMatchObject({ spiritualitySpent: 4, noteChargeSpent: 1, paperEdgeMovedMm: 1 });
    same(force.before.random, force.final.random); same(force.before.progression.mastery, force.final.progression.mastery);
    const withdrawn = replayCaptureBoundary('withdrawn-consent-withdraw_consent');
    expect(withdrawn.intent).toEqual({ type: 'KNOWLEDGE_EMPEROR', command: { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-consent', permission: 'ABILITY' } });
    expect(life.cases['withdrawn-consent'].attempts[0]).toMatchObject({ withdrawn: true, stopped: true, verified: false, appliedAbilityIds: [] });
    expect(withdrawn.final.knowledgeEmperor.life.pending).toBeNull(); same(withdrawn.before.random, withdrawn.final.random);
    expect(knowledgeEmperorLifeMasteryGains(final)).toEqual({ 'hermit.s1.knowledge-power': 0, 'hermit.s1.power-knowledge': 0 });
    expect(capturedSnapshot('practiced').progression.acting).toBe(100); expect(life.reflected).toBe(true);
    expect(validateKnowledgeEmperorLifeState(final)).toBe(true);
  }, 240_000);

  it('reconciles actual movement, finite original gear, paid energy recovery and all ordinary weekly finances', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), life = final.knowledgeEmperor.life;
    let site = original.sage.encounter.currentSite!;
    for (const row of life.journal) {
      same(row.siteBefore, site); site = row.siteAfter;
      if (row.command.type === 'RECOVER_ENERGY') {
        expect(row.before.cash - row.after.cash).toBe(15); expect(row.before.actions - row.after.actions).toBe(1);
        expect(row.energyRecovered).toBe(20); expect(row.elapsedSeconds).toBe(60);
        expect(row.siteAfter.playerEnergy - row.siteBefore.playerEnergy).toBe(20);
        same(row.siteBefore.materials, row.siteAfter.materials);
      }
    }
    same(site, life.site); const encounter = final.knowledgeEmperor.encounter;
    same(encounter.preparation!.site, site); same(encounter.preparation!.workshop, original.scrollProfessor.workshop);
    for (const row of encounter.journal) { same(row.siteBefore, site); site = row.siteAfter; }
    const rounds = final.combatHistory.slice(original.combatHistory.length);
    for (const round of rounds) { same(round.knowledgeEmperorOutcome!.source.site, site); site = round.knowledgeEmperorOutcome!.siteAfter; }
    same(site, getKnowledgeEmperorCurrentSite(final)); same(site, expected.finalSite);
    same(encounter.workshop, original.scrollProfessor.workshop);
    const acq = final.knowledgeEmperor.acquisitionJournal, journal = life.journal, enc = encounter.journal;
    const costs = {
      acquisitionCash: sum(acq, row => row.before.cash - row.after.cash), acquisitionAP: sum(acq, row => row.before.actions - row.after.actions),
      acquisitionSpirituality: sum(acq, row => row.before.spirituality - row.after.spirituality), acquisitionMind: sum(acq, row => row.before.mind - row.after.mind),
      lifeCash: sum(journal, row => row.before.cash - row.after.cash), lifeAP: sum(journal, row => row.before.actions - row.after.actions),
      lifeSpirituality: sum(journal, row => row.before.spirituality - row.after.spirituality), lifeMind: sum(journal, row => row.before.mind - row.after.mind),
      encounterCash: sum(enc, row => row.before.cash - row.after.cash), encounterAP: sum(enc, row => row.before.actions - row.after.actions),
      encounterSpirituality: sum(enc, row => row.before.spirituality - row.after.spirituality), encounterMind: sum(enc, row => row.before.mind - row.after.mind),
      playerOrdinaryMetres: sum(journal, row => sum(row.moves.filter(move => move.actorId === 'PLAYER'), move => move.metres)),
      ownerOrdinaryMetres: sum(journal, row => sum(row.moves.filter(move => move.actorId !== 'PLAYER'), move => move.metres)),
      playerEnergySpent: sum(journal, row => row.paid.energy), playerEnergyRecovered: sum(journal, row => row.energyRecovered),
      ordinaryWorkCount: commands.slice(PREFIX).filter(command => command.type === 'ACTION' && command.action === 'WORK').length,
      ordinaryRestCount: commands.slice(PREFIX).filter(command => command.type === 'ACTION' && command.action === 'REST').length,
    };
    same(costs, expected.actualCosts);
    const note = replayCaptureBoundary('paid-independent-combat-note'); expect(note.before.cash - note.final.cash).toBe(30);
    expect(note.before.actionsRemaining - note.final.actionsRemaining).toBe(1); expect(encounter.preparation!.pricePaid).toBe(30);
    expect(final.cash).toBe(original.cash + costs.ordinaryWorkCount * original.character.weeklyWage - costs.acquisitionCash - costs.lifeCash - costs.encounterCash - 30 - 60 - (final.week - original.week) * 30);
    same(knowledgeEmperorFinanceSnapshot(final), expected.finalFinance);
    expect(final.random).toEqual({ seed: SEED, cursor: 357 });
    expect(validateKnowledgeEmperorSource(final)).toBe(true); expect(validateKnowledgeEmperorJournalContinuity(final)).toBe(true);
  }, 120_000);

  it('replays the actual five ordered slots, unspent new note, failed future reading and healthy-body first-round death', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), rounds = final.combatHistory.slice(original.combatHistory.length);
    expect(rounds).toHaveLength(1); same(summaryEntry('rounds'), rounds);
    const round = rounds[0]!, outcome = round.knowledgeEmperorOutcome!, save = replayCaptureBoundary('combat-round-1');
    same(outcome.source, currentKnowledgeEmperorCombatSource(save.before)); same(replayKnowledgeEmperorCombatRound(outcome.source, 'CONTROL').round, round);
    expect(round).toMatchObject(expected.combat); same(outcome.playerActions, expected.playerActions); same(outcome.enemyActions, expected.enemyActions);
    expect(outcome.source).toMatchObject({ targetId: 'KE1-DARIAN', targetAge: 44, actualBody: true, independentMind: true,
      policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, playerHealth: 100, playerMind: 100, playerSpirituality: 120,
      playerInjuries: [], playerRisk: 0, randomSeed: SEED, randomCursor: 346 });
    expect(round.playerCount).toBe(knowledgeEmperorActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(knowledgeEmperorEnemyActionCount(round.enemyCountRoll));
    const actions = [...outcome.playerActions.map(action => ({ ...action, actor: 'PLAYER' })), ...outcome.enemyActions.map(action => ({ ...action, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order);
    expect(actions.map(action => action.order)).toEqual([0, 1, 2, 3, 4]);
    same(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })));
    for (const action of actions) { expect(action.elapsedSeconds).toBe(5); expect(action.randomCursorAfter - action.randomCursorBefore).toBe(action.rolls.length); expect(action.masteryApplied).toEqual([]); }
    expect(outcome.playerActions[0]).toMatchObject({ id: 'hermit.s1.power-knowledge', mode: 'NO_ACTUAL_RECEIPT', attempted: false, paidCost: 0, applied: false });
    expect(outcome.enemyActions[0]).toMatchObject({ actual: 'ARC_BOLT', attackKind: 'BODY', paidCost: 7, markId: 'KE1-DARIAN-MARK-1' });
    expect(outcome.playerActions[1]).toMatchObject({ id: 'hermit.s6.scrollcraft', mode: 'LEARNED_SPELL', paidCost: 2, scroll: null });
    expect(outcome.playerActions[2]).toMatchObject({ id: 'hermit.s2.information-sift', paidCost: 6, mindCost: 2, succeeded: true, resisted: false, applied: false, chargeConsumedByOrder: null });
    expect(outcome.expiredEffectOrders).toEqual([4]);
    expect(outcome.noteAfter).toMatchObject({ id: 'KE1-COMBAT-NOTE', charges: 3, wear: 0, paidPennies: 30 });
    expect(outcome.marksAfter.map(mark => mark.status)).toEqual(['SPENT', 'HELD', 'HELD']);
    expect(outcome.enemySpirituality).toBe(120 - sum(outcome.enemyActions, action => action.paidCost));
    expect(outcome.playerSpiritualityAfter).toBe(120 - sum(outcome.playerActions, action => action.paidCost));
    expect(final.spirituality).toBe(outcome.playerSpiritualityAfter); expect(outcome.clockSecondsAfter - outcome.source.clockSeconds).toBe(60);
    expect(round).toMatchObject({ winner: 'ENEMY', consequenceDomain: 'BODY', consequenceRoll: 97, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    expect(KNOWLEDGE_EMPEROR_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id]).toBe(mastery);
    same(final.knowledgeEmperor.encounter.terminal, expected.terminal); expect(validateKnowledgeEmperorEncounterState(final)).toBe(true);
  }, 120_000);

  it('reopens the actual week194 death with Darian alive and rejects postmortem play without inventing an exit or later work', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(commands.at(-1), intent); expect(intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    same(applySliceIntent(before, intent), final);
    const reopened = currentCapture(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    expect(reopened).toMatchObject({ status: 'DEAD', health: 0, week: 194, revision: 832, injuries: [], injuryRisk: 0 });
    expect(reopened.knowledgeEmperor.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 1,
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 113, enemyStatus: 'RESISTING', exitMetres: 0, exitSeconds: 0, playerEnergyPaid: 0 });
    expect(getKnowledgeEmperorCurrentSite(reopened)).toMatchObject({ playerLocation: 'YARD', body: 'SOLID', iris: { location: 'OUTSIDE' } });
    expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
    expect(projectSliceState(reopened).knowledgeEmperor.actions.some(action => action.enabled)).toBe(false);
    expect(boundaryIndex['actual-ordinary-encounter-exit']).toBeUndefined(); expect(boundaryIndex['actual-work-after-living-exit']).toBeUndefined();
    same(capturedSnapshot('actualTerminal'), final);
    for (const blocked of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
      { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'KNOWLEDGE_EMPEROR', command: { type: 'LEAVE_ENCOUNTER' } },
      { type: 'CONTINUE_LIFE' }] satisfies SliceIntent[]) {
      const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
    }
  }, 120_000);
});
