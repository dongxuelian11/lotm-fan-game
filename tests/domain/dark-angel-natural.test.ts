import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SHEPHERD_CAPACITY } from '../../src/domain/shepherd/types.js';
import { validateDarkAngelSource, validateDarkAngelAcquisitionJournal,
  validateDarkAngelJournalContinuity } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_ABILITY_IDS, DARK_ANGEL_SOURCE_KEYS,
  DARK_ANGEL_PREPARATION_IDS } from '../../src/domain/dark-angel/types.js';
import { DARK_ANGEL_CASE_IDS, getDarkAngelCurrentSite, darkAngelLifeMasteryGains,
  validateDarkAngelLifeState } from '../../src/domain/dark-angel/life.js';
import { darkAngelFinanceSnapshot, validateDarkAngelEncounterState } from '../../src/domain/dark-angel/encounter.js';
import { currentDarkAngelCombatSource, replayDarkAngelCombatRound,
  darkAngelActionCount, darkAngelEnemyActionCount } from '../../src/domain/dark-angel/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { DARK_ANGEL_CAPTURE_EVIDENCE as expected } from './dark-angel-capture-evidence.js';
import { DARK_ANGEL_ROOT as ROOT, DARK_ANGEL_SOURCE as SOURCE, DARK_ANGEL_PRIOR as PRIOR,
  DARK_ANGEL_PREFIX_COUNT as PREFIX, DARK_ANGEL_INHERITED_COUNT as INHERITED,
  DARK_ANGEL_SEED as SEED, captureCommands as commands, boundaryIndex, boundarySteps, snapshotIndex,
  naturalEntry, sourceEntry, summaryEntry, capturePath, captureFileHash, insertionOrderHash, captureValueHash,
  captureJsonLines, currentCapture, capturedState, capturedSnapshot, replayCaptureBoundary,
  captureBody, sourceOriginals, currentOriginals, assertPublicCaptureControl, assertOriginalContinuity,
  sameCaptureValue as same } from './dark-angel-capture-helper.js';

const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
interface Integrity { producerSha256: string; naturalSha256: string; commandsSha256: string; publicSha256: string;
  sourcePrefixSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string; transitionsSha256: string;
  summarySha256: string; files: Record<string, string> }
interface Transition { key: string; file: string; commandIndex: number; beforeRevision: number; afterRevision: number }

// Frozen evidence describes this one original-seed capture. No directed prefix,
// favorable reroll or invented successful application replaces an actual result.
describe('Dark Angel exact615 natural history and complete original-seed public continuation', () => {
  it('pins raw176 source, raw153 ancestry, frozen producer and every raw198 capture member before explicit CURRENT migration', async () => {
    expect(await captureFileHash(SOURCE)).toBe(expected.sourceSha256);
    expect(await captureFileHash(PRIOR)).toBe(expected.priorSha256);
    expect(await captureFileHash('scripts/play/dark-angel-stage.mjs')).toBe(expected.producerSha256);
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
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([176, 'elder-v176']);
    expect([prior.schemaVersion, prior.contentVersion]).toEqual([153, 'three-headed-templar-v153']);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) {
      expect(naturalEntry(key)).toMatchObject({ schemaVersion: 198, contentVersion: 'dark-angel-v198' });
    }
    for (const filename of Object.values(snapshotIndex)) {
      expect(readObjectEntry(capturePath(filename), 'schemaVersion')).toBe(198);
      expect(readObjectEntry(capturePath(filename), 'contentVersion')).toBe('dark-angel-v198');
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
    expect(readObjectEntry<SliceIntent[]>(PRIOR, 'commands')).toHaveLength(500);
  }, 240_000);

  it('retains15 exact old skills, original light/heavy wounds, two finite spirits, released Cedric and both living old opponents', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), site = original.threeHeadedTemplar.life;
    same(captureBody(original), expected.originalBody); same(original.character, expected.originalCharacter);
    same(original.progression.mastery, expected.originalMastery);
    expect(Object.keys(original.progression.mastery)).toHaveLength(15);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(2);
    expect(original).toMatchObject({ careKnown: true, injuryRisk: 1, health: 60, cash: 818, week: 145 });
    expect(original.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', null]]);
    expect(site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 88, clockSeconds: 933,
      owner: { id: 'THT3-MARA', age: 51, alive: true, location: 'OUTSIDE' },
      card: { id: 'THT3-CARD', location: 'TABLE', travelMetres: 40 }, lamp: { on: false }, shutter: { state: 'CLOSED' } });
    expect(Object.hasOwn(site, 'playerEnergy')).toBe(false);
    expect(site.spirits['THT3-HELENA']).toMatchObject({ age: 54, spirituality: 18, integrity: 60, location: 'INTERNAL', interrupted: true });
    expect(site.spirits['THT3-ROLAND']).toMatchObject({ age: 61, spirituality: 21, integrity: 100, location: 'INTERNAL', interrupted: false });
    expect(SHEPHERD_CAPACITY).toBe(7);
    expect(original.shepherd.grazing.spirits.map(spirit => [spirit.id, spirit.status, spirit.releasedWeek])).toEqual([
      ['SH5-IRIS-1', 'GRAZED', null], ['SH5-CEDRIC-1', 'RELEASED', 64] ]);
    expect(original.elder.life.operation).toMatchObject({ contained: true, residualPressure: 3, sealWear: 5, focus: null, suppressedUntil: null });
    expect(original.elder.life.operation.materials.map(row => [row.status, row.location, row.charges, row.spentCharges])).toEqual([
      ['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 0, 2] ]);
    expect(original.roseBishop.reserve).toMatchObject({ points: 1, packetsBought: 6 });
    expect(original.roseBishop.reserve.packets.every(packet => packet.status === 'CONSUMED')).toBe(true);
    expect(original.elder.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100,
      enemySpirituality: 90, terminal: { outcome: 'RETREATED', round: 3 } });
    expect(original.threeHeadedTemplar.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 80, enemyMind: 100,
      enemySpirituality: 30, terminal: { outcome: 'RETREATED', round: 8 } });
    for (const key of DARK_ANGEL_SOURCE_KEYS) same(final[key], original[key]);
    assertOriginalContinuity(final, original);
  }, 60_000);

  it('replays every command from original creation, the exact615 prefix and all enabled public continuation controls', () => {
    expect(PREFIX).toBe(615); expect(commands).toHaveLength(expected.commands);
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
  // The frozen producer took about442s including824 reductions, validation and
  // capture I/O. Keep all assertions and give this full-history replay600s.
  }, 600_000);

  it('keeps every boundary name, alias, snapshot, transition and command/public ledger complete and contiguous', async () => {
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.namedBoundaries); same(Object.keys(boundarySteps), Object.keys(boundaryIndex));
    same(Object.keys(snapshotIndex), expected.snapshots);
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
    // Read one large root at a time and tie every indexed file to its exact
    // ledger step, rather than merely checking that the filename exists.
    for (const transition of transitions) {
      const path = capturePath(transition.file), ledger = newRows.get(transition.commandIndex)!;
      expect(readObjectEntry(path, 'commandCount')).toBe(transition.commandIndex);
      same(readObjectEntry(path, 'lastIntent'), ledger.intent);
      for (const [root, body, revision] of [
        ['beforeLast', ledger.before, transition.beforeRevision], ['final', ledger.after, transition.afterRevision],
      ] as const) {
        const state = readObjectEntry<SliceState>(path, root);
        expect([state.schemaVersion, state.contentVersion, state.revision]).toEqual([198, 'dark-angel-v198', revision]);
        same(captureBody(state), body);
      }
    }
    for (const filename of Object.values(snapshotIndex)) {
      const state = JSON.parse(readFileSync(capturePath(filename), 'utf8')) as SliceState;
      const ledger = newRows.get(state.revision - 1); expect(ledger, filename).toBeDefined();
      same(captureBody(state), ledger!.after);
    }
  }, 240_000);

  it('pays actual60p treatment,500p guidance, finite resupply and separate five-action1200+180p bottles without healing on purchase', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), journal = final.darkAngel.acquisitionJournal;
    same(naturalEntry('treatments'), expected.treatments); expect(expected.treatments).toHaveLength(1);
    const treatment = replayCaptureBoundary('step-617-event_choice');
    expect(treatment.intent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(treatment.before.cash - treatment.final.cash).toBe(60);
    expect(treatment.final.health).toBe(treatment.before.health);
    expect(treatment.final.injuries.map(injury => injury.id)).toEqual(original.injuries.map(injury => injury.id));
    expect(treatment.final.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', 618]]);
    expect(capturedSnapshot('sourceRecovered')).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0 });
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots');
    const guidanceReceipt = guidance.final.darkAngel.acquisitionJournal.at(-1)!;
    expect(guidanceReceipt.before.cash - guidanceReceipt.after.cash).toBe(500);
    same(guidance.final.darkAngel.sourceScene!.originals, sourceOriginals(original));
    same(final.darkAngel.bottles, expected.bottles); same(final.darkAngel.resupply, expected.resupply);
    expect(final.darkAngel.bottles.filter(row => row.status === 'CONSUMED').map(row => row.outcome)).toEqual([
      'FAILURE', 'FAILURE', 'FAILURE', 'GREAT_SUCCESS' ]);
    same(journal.filter(row => row.check).map(row => [row.command, row.week, row.check!.roll,
      row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]), expected.acquisitionChecks);
    for (const bottle of final.darkAngel.bottles.filter(row => row.status === 'CONSUMED')) {
      const buy = replayCaptureBoundary(`actual1200p-buy-${bottle.id}`);
      const prep = replayCaptureBoundary(`actual180p-current-week-prepare-${bottle.id}`);
      const dose = replayCaptureBoundary(`consume-${bottle.id}`);
      const work = journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id);
      expect(work).toHaveLength(5);
      for (const row of work) expect([row.before.actions - row.after.actions, row.before.cash - row.after.cash]).toEqual([1, 0]);
      expect(buy.final.darkAngel.acquisitionJournal.at(-1)!.before.cash - buy.final.darkAngel.acquisitionJournal.at(-1)!.after.cash).toBe(1200);
      expect(prep.final.darkAngel.acquisitionJournal.at(-1)!.before.cash - prep.final.darkAngel.acquisitionJournal.at(-1)!.after.cash).toBe(180);
      expect(dose.before.week - original.elder.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.darkAngel.preparedWeek).toBe(dose.before.week); expect(dose.final.darkAngel.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      same(dose.final.injuries, dose.before.injuries); same(currentOriginals(dose.final), currentOriginals(dose.before));
      expect(dose.final.spirituality).toBe(dose.before.spirituality);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!));
      expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
    }
    const request = replayCaptureBoundary('paid-next-week-resupply'), delivery = replayCaptureBoundary('actual-next-week-new-stock');
    const receipt = request.final.darkAngel.acquisitionJournal.at(-1)!;
    expect(receipt.before.cash - receipt.after.cash).toBe(100);
    expect(delivery.before.week).toBeGreaterThan(request.before.week);
    same(delivery.final.darkAngel.bottles.slice(0, request.before.darkAngel.bottles.length), request.before.darkAngel.bottles);
    expect(final.darkAngel.preparations.map(row => row.taskId)).toEqual([...DARK_ANGEL_PREPARATION_IDS]);
    const promoted = capturedSnapshot('promoted'); expect(promoted.darkAngel.promotionWeek).toBe(expected.promotionWeek);
    expect(DARK_ANGEL_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id]).toBe(mastery);
    expect(validateDarkAngelAcquisitionJournal(final)).toBe(true); expect(validateDarkAngelJournalContinuity(final)).toBe(true);
  }, 240_000);

  it('preserves each actual cast result, withdrawal, honest report and physical return of the same card and paid strip', () => {
    const final = capturedState('final'), life = final.darkAngel.life;
    same(summaryEntry('lifeAbilityUse'), expected.lifeAbilityUse); same(summaryEntry('lifeCases'), life.cases);
    same(life.journal.filter(row => row.check).map(row => [row.command, row.checkBase, row.check!.roll,
      row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]), expected.lifeChecks);
    same(Object.fromEntries(DARK_ANGEL_CASE_IDS.map(id => { const c = life.cases[id]; return [id, {
      status: c.status, result: c.result, returned: c.returned,
      attempts: c.attempts.map(({ siteAtStart: _start, siteAtClose: _close, ...attempt }) => attempt) }]; })), expected.lifeResults);
    same(life.strips, expected.strips); expect(new Set(life.strips.map(strip => strip.id)).size).toBe(3);
    for (const caseId of DARK_ANGEL_CASE_IDS) {
      const c = life.cases[caseId], attempt = c.attempts[0]!;
      expect(c.attempts).toHaveLength(1); expect(c).toMatchObject({ status: 'RESOLVED', returned: true, contactOpen: false });
      expect(attempt).toMatchObject({ closed: true, returned: true, cardReturned: true, verified: true, penniesSpent: 20 });
      const cast = replayCaptureBoundary(`${caseId}-${caseId === 'guarded-pulse' ? 'shelter' : 'guidance'}`);
      const row = cast.final.darkAngel.life.journal.at(-1)!;
      expect(row.paid).toMatchObject({ spirituality: 8, spiritSpirituality: 3 });
      expect(cast.before.spirituality - cast.final.spirituality).toBe(8);
      expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1);
      same(cast.before.progression.mastery, cast.final.progression.mastery);
      const returned = replayCaptureBoundary(`${caseId}-return_card`), leave = replayCaptureBoundary(`${caseId}-leave`);
      expect(returned.before.darkAngel.life.site.card.location).toBe('PLAYER');
      expect(returned.final.darkAngel.life.site.card.location).toBe('TABLE');
      expect(leave.final.darkAngel.life.site).toMatchObject({ playerLocation: 'START', owner: { location: 'OUTSIDE' }, card: { location: 'TABLE' } });
      expect(leave.final.darkAngel.life.pending).toBeNull();
      same(leave.final.progression.mastery, leave.before.progression.mastery);
      const report = replayCaptureBoundary(`${caseId}-honest-report`);
      expect(report.before.darkAngel.life.cases[caseId].status).toBe('EXAMINED');
      expect(report.final.progression.acting - report.before.progression.acting).toBe(25);
      for (const id of DARK_ANGEL_ABILITY_IDS) expect(report.final.progression.mastery[id]! - report.before.progression.mastery[id]!).toBe(attempt.appliedAbilityIds.includes(id) ? 8 : 0);
      const hash = captureValueHash(report.final); expect(() => applySliceIntent(report.final, report.intent)).toThrow();
      expect(captureValueHash(report.final)).toBe(hash);
    }
    const withdrawn = replayCaptureBoundary('withdrawn-guidance-withdraw_consent');
    expect(withdrawn.intent).toEqual({ type: 'DARK_ANGEL', command: { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-guidance', permission: 'ABILITY' } });
    expect(life.cases['withdrawn-guidance'].attempts[0]).toMatchObject({ withdrawn: true, stopped: true, appliedAbilityIds: [] });
    expect(withdrawn.final.darkAngel.life.pending).toBeNull(); same(withdrawn.before.random, withdrawn.final.random);
    same(darkAngelLifeMasteryGains(final), expected.lifeMasteryGains);
    expect(capturedSnapshot('practiced').progression.acting).toBe(100); expect(life.reflected).toBe(true);
    expect(validateDarkAngelLifeState(final)).toBe(true);
  }, 240_000);

  it('reconciles real movement, spent original soul/flesh resources and every ordinary wage and weekly bill', async () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), life = final.darkAngel.life;
    let site = getDarkAngelCurrentSite(original);
    for (const row of life.journal) {
      same(row.siteBefore, site); site = row.siteAfter;
      expect(row.siteAfter.clockSeconds - row.siteBefore.clockSeconds).toBe(row.elapsedSeconds);
      expect(row.siteAfter.playerTravelMetres - row.siteBefore.playerTravelMetres).toBe(sum(row.moves.filter(move => move.actorId === 'PLAYER'), move => move.metres));
      for (const move of row.moves) expect(move.seconds).toBe(move.metres);
    }
    same(site, life.site); const encounter = final.darkAngel.encounter;
    same(encounter.preparation!.site, site); same(encounter.preparation!.originals, sourceOriginals(original));
    for (const row of encounter.journal) { same(row.siteBefore, site); site = row.siteAfter; }
    for (const round of final.combatHistory.slice(original.combatHistory.length)) {
      same(round.darkAngelOutcome!.source.site, site); site = round.darkAngelOutcome!.siteAfter;
    }
    const actual = getDarkAngelCurrentSite(final), exit = encounter.terminal!.exitMetres;
    expect(actual.playerTravelMetres - site.playerTravelMetres).toBe(exit);
    expect(actual.clockSeconds - site.clockSeconds).toBe(encounter.terminal!.exitSeconds);
    same(currentOriginals(final), expected.finalOriginals);
    expect(actual.spirits['THT3-HELENA']).toMatchObject({ spirituality: 9, integrity: 60, interrupted: true });
    expect(actual.spirits['THT3-ROLAND']).toMatchObject({ spirituality: 15, integrity: 100 });
    const acq = final.darkAngel.acquisitionJournal, journal = life.journal, enc = encounter.journal;
    const costs = {
      acquisitionCash: sum(acq, row => row.before.cash - row.after.cash), acquisitionAP: sum(acq, row => row.before.actions - row.after.actions),
      acquisitionSpirituality: sum(acq, row => row.before.spirituality - row.after.spirituality), acquisitionMind: sum(acq, row => row.before.mind - row.after.mind),
      lifeCash: sum(journal, row => row.before.cash - row.after.cash), lifeAP: sum(journal, row => row.before.actions - row.after.actions),
      lifeSpirituality: sum(journal, row => row.before.spirituality - row.after.spirituality), lifeMind: sum(journal, row => row.before.mind - row.after.mind),
      encounterCash: sum(enc, row => row.before.cash - row.after.cash), encounterAP: sum(enc, row => row.before.actions - row.after.actions),
      encounterSpirituality: sum(enc, row => row.before.spirituality - row.after.spirituality), encounterMind: sum(enc, row => row.before.mind - row.after.mind),
      playerOrdinaryMetres: sum(journal, row => sum(row.moves.filter(move => move.actorId === 'PLAYER'), move => move.metres)),
      ownerOrdinaryMetres: sum(journal, row => sum(row.moves.filter(move => move.actorId !== 'PLAYER'), move => move.metres)),
      lifeSpiritSpirituality: sum(journal, row => row.paid.spiritSpirituality),
      ordinaryWorkCount: commands.slice(PREFIX).filter(command => command.type === 'ACTION' && command.action === 'WORK').length,
      ordinaryRestCount: commands.slice(PREFIX).filter(command => command.type === 'ACTION' && command.action === 'REST').length,
    };
    same(costs, expected.actualCosts);
    const seal = replayCaptureBoundary('paid-independent-combat-seal-strip');
    expect(encounter.preparation).toMatchObject({ pricePaid: 30, actionsPaid: 1 });
    expect(encounter.preparation!.before.cash - encounter.preparation!.after.cash).toBe(30);
    expect(encounter.preparation!.before.actions - encounter.preparation!.after.actions).toBe(1);
    same(seal.final.darkAngel.encounter.preparation, encounter.preparation);
    let cashDelta = 0, ordinaryCashDelta = 0;
    type Row = { step: number; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    for await (const row of captureJsonLines<Row>('commands.jsonl')) if (row.step > PREFIX) {
      cashDelta += row.after.cash - row.before.cash;
      if (row.intent.type === 'ACTION') ordinaryCashDelta += row.after.cash - row.before.cash;
      expect(row.before.random.seed).toBe(SEED); expect(row.after.random.seed).toBe(SEED);
    }
    expect(cashDelta).toBe(final.cash - original.cash);
    expect(ordinaryCashDelta).toBe(expected.ordinaryCashDelta);
    expect(final.cash).toBe(original.cash + costs.ordinaryWorkCount * original.character.weeklyWage -
      costs.acquisitionCash - costs.lifeCash - costs.encounterCash - 30 - 60 - expected.actualWeeklyPayments);
    same(darkAngelFinanceSnapshot(final), expected.finalFinance);
    expect(validateDarkAngelSource(final)).toBe(true); expect(validateDarkAngelJournalContinuity(final)).toBe(true);
  }, 120_000);

  it('replays the exact ordered combat slots with finite marks, actual costs, original Roland and no fabricated mastery', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal');
    const rounds = final.combatHistory.slice(original.combatHistory.length);
    expect(rounds).toHaveLength(expected.rounds.length); same(summaryEntry('rounds'), rounds);
    expect(rounds.map(round => [round.winner, round.consequenceDomain, round.consequenceRoll])).toEqual([
      ['ENEMY', 'MENTAL', undefined], ['PLAYER', 'BODY', 34], ['PLAYER', 'BODY', 82] ]);
    expect(Object.hasOwn(rounds[0]!, 'consequenceRoll')).toBe(false);
    expect(rounds[0]!.darkAngelOutcome).toMatchObject({ playerHealthAfter: 100, playerMindAfter: 84, playerInjuriesAfter: [], playerRiskAfter: 0 });
    const paidGuidance = rounds[1]!.darkAngelOutcome!.playerActions.find(action => action.id === DARK_ANGEL_ABILITY_IDS[0])!;
    expect(paidGuidance).toMatchObject({ mode: 'PREPARED', paidCost: 8, mindCost: 2, succeeded: true,
      applied: false, chargeCancelledByOrder: 4, chargeConsumedByOrder: null, masteryApplied: [] });
    expect(final.darkAngel.encounter.note).toMatchObject({ charges: 3, wear: 0, paidPennies: 30 });
    expect(final.darkAngel.encounter.marks.every(mark => mark.status === 'SPENT')).toBe(true);
    same(rounds.map(({ darkAngelOutcome, ...round }) => {
      const { source: _source, siteAfter: _site, grazingAfter: _grazing, reserveAfter: _reserve,
        operationAfter: _operation, ...outcome } = darkAngelOutcome!;
      return { ...round, outcome };
    }), expected.rounds);
    for (const round of rounds) {
      const outcome = round.darkAngelOutcome!, save = replayCaptureBoundary(`combat-round-${round.round}`);
      same(outcome.source, currentDarkAngelCombatSource(save.before)); same(replayDarkAngelCombatRound(outcome.source, 'CONTROL').round, round);
      expect(outcome.source).toMatchObject({ targetId: 'DA1-EDGAR', targetAge: 45, actualBody: true, independentMind: true,
        policy: 'ALL', selectedSpiritId: 'THT3-ROLAND', ordinaryExit: 'OPEN', thirdPartiesInArea: 0,
        automaticAllyImmunity: false, randomSeed: SEED });
      expect(round.playerCount).toBe(darkAngelActionCount(round.playerCountRoll));
      expect(round.enemyCount).toBe(darkAngelEnemyActionCount(round.enemyCountRoll));
      const actions = [...outcome.playerActions.map(action => ({ ...action, actor: 'PLAYER' })),
        ...outcome.enemyActions.map(action => ({ ...action, actor: 'ENEMY' }))].sort((a, b) => a.order - b.order);
      expect(actions.map(action => action.order)).toEqual(Array.from({ length: actions.length }, (_, index) => index));
      same(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })));
      for (const action of actions) {
        expect(action.elapsedSeconds).toBe(5); expect(action.randomCursorAfter - action.randomCursorBefore).toBe(action.rolls.length);
        expect(action.atSeconds).toBe(outcome.source.clockSeconds + action.order * 5);
      }
      expect(outcome.playerSpiritualityAfter).toBe(outcome.source.playerSpirituality - sum(outcome.playerActions, action => action.paidCost));
      expect(outcome.enemySpirituality).toBe(outcome.source.enemySpirituality - sum(outcome.enemyActions, action => action.paidCost));
      expect(outcome.noteAfter.charges).toBe(outcome.source.note.charges - sum(actions, action => action.noteChargePaid));
      expect(outcome.noteAfter.wear).toBe(outcome.source.note.wear + sum(actions, action => action.noteWearPaid));
      expect(outcome.reserveAfter.points).toBe(outcome.source.reserve.points - sum(outcome.playerActions, action => action.reserveCost));
      same(outcome.grazingAfter, original.shepherd.grazing);
      expect(outcome.marksAfter.filter(mark => mark.status === 'SPENT')).toHaveLength(
        outcome.source.marks.filter(mark => mark.status === 'SPENT').length + outcome.enemyActions.filter(action => action.markId !== null).length);
      for (const id of ['THT3-HELENA', 'THT3-ROLAND'] as const) {
        const spiritsPaid = outcome.playerActions.filter(action => action.spirit?.id === id);
        expect(outcome.siteAfter.spirits[id].spirituality).toBe(outcome.source.site.spirits[id].spirituality - sum(spiritsPaid, action => action.spirit!.spiritCost));
        for (const action of spiritsPaid) {
          expect(action.spirit!.spiritualityBefore - action.spirit!.spiritualityAfter).toBe(3);
          expect(action.spirit!.deathRecordId).toBe(original.threeHeadedTemplar.life.spirits[id].deathRecordId);
          expect(action.spirit!.casketId).toBe(original.threeHeadedTemplar.life.spirits[id].casketId);
        }
      }
      for (const action of outcome.playerActions.filter(action => action.id === DARK_ANGEL_ABILITY_IDS[0] || action.id === DARK_ANGEL_ABILITY_IDS[1])) {
        if (action.attempted) { expect(action.paidCost).toBe(8); expect(action.spirit?.id).toBe('THT3-ROLAND'); }
        else { expect(action.paidCost).toBe(0); expect(action.spirit).toBeNull(); }
        if (action.masteryApplied.length) { expect(action.chargeConsumedByOrder).not.toBeNull(); expect(action.appliedAmount).toBeGreaterThan(0); }
      }
      expect(outcome.clockSecondsAfter - outcome.source.clockSeconds).toBe(60);
      expect(save.final.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    }
    same(final.darkAngel.encounter.terminal, expected.terminal); assertOriginalContinuity(final, original);
    expect(validateDarkAngelEncounterState(final)).toBe(true);
  }, 240_000);

  it('reopens actual surrender, four-metre return and subsequent paid work with no invented death or opponent reset', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(commands.at(-1), intent); expect(intent).toEqual({ type: 'ACTION', action: 'WORK' });
    same(applySliceIntent(before, intent), final);
    const reopened = currentCapture(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    expect(reopened).toMatchObject({ status: 'ACTIVE', health: 100, mind: 82, spirituality: 104, cash: 548,
      week: 197, revision: 825, actionsRemaining: 3, injuries: [], injuryRisk: 0,
      random: { seed: SEED, cursor: 394 } });
    expect(reopened.darkAngel.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 60, enemyMind: 100,
      enemySpirituality: 95, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD',
      terminal: { outcome: 'ENEMY_SURRENDERED', round: 3, exitMetres: 4, exitSeconds: 4 } });
    const terminal = capturedSnapshot('combatTerminal'), exit = replayCaptureBoundary('actual-ordinary-encounter-exit');
    same(exit.final, terminal); expect(boundarySteps['actual-ordinary-encounter-exit']).toBe(823);
    expect(boundarySteps['combat-round-3']).toBe(823);
    expect(boundaryIndex['actual-ordinary-encounter-exit']).toBe(boundaryIndex['combat-round-3']);
    expect(snapshotIndex.actualTerminal).toBeUndefined();
    expect(getDarkAngelCurrentSite(reopened)).toMatchObject({ playerLocation: 'START', owner: { location: 'OUTSIDE' }, card: { location: 'TABLE' } });
    expect(projectSliceState(reopened).canAct).toBe(true); expect(projectSliceState(reopened).combat).toBeNull();
    const work = replayCaptureBoundary('actual-work-after-living-exit');
    same(work.before, terminal); same(work.final, final);
    expect(work.final.cash - work.before.cash).toBe(180 - 30);
    expect(work.final.week - work.before.week).toBe(1);
    same(work.final.random, work.before.random); same(currentOriginals(work.final), currentOriginals(work.before));
    expect(DARK_ANGEL_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    const original = capturedState('prefixFinal');
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id]).toBe(mastery);
    for (const blocked of [
      { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'DARK_ANGEL', command: { type: 'ENCOUNTER_FIGHT' } },
      { type: 'DARK_ANGEL', command: { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' } },
      { type: 'THREE_HEADED_TEMPLAR', command: { type: 'REST_SPIRIT', spiritId: 'THT3-HELENA' } },
    ] satisfies SliceIntent[]) {
      const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow();
      expect(captureValueHash(reopened)).toBe(hash);
    }
  }, 120_000);
});
