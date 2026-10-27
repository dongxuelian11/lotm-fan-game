import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { timeWormFinanceSnapshot, validateTimeWormAcquisitionJournal, validateTimeWormJournalContinuity,
  validateTimeWormSource } from '../../src/domain/time-worm/index.js';
import { TIME_WORM_ABILITY_IDS, TIME_WORM_SOURCE_KEYS } from '../../src/domain/time-worm/types.js';
import { TIME_WORM_CASE_IDS, timeWormExpectedOriginals, validateTimeWormLifeState } from '../../src/domain/time-worm/life.js';
import { currentTimeWormCombatSource, replayTimeWormCombatRound, timeWormActionCount,
  timeWormEnemyActionCount } from '../../src/domain/time-worm/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentTimeWormReplayExpectation } from '../helpers/time-worm-current-replay.js';
import { actualTimeWormEvidence } from './time-worm-capture-evidence.js';
import { TIME_WORM_ROOT, TIME_WORM_SOURCE, TIME_WORM_PEACEFUL_SOURCE, TIME_WORM_DEATH_SOURCE,
  TIME_WORM_PREFIX_COUNT, captureFileHash, captureValueHash, insertionOrderHash, sourceEntry,
  peacefulEntry, naturalEntry, summaryEntry, captureCommands, boundaryIndex, boundarySteps, snapshotIndex,
  capturedState, capturedSnapshot, replayCaptureBoundary, assertPublicCaptureControl, assertOriginalContinuity,
  captureBody, captureJsonLines, sameCaptureValue as same } from './time-worm-capture-helper.js';

const expected = actualTimeWormEvidence();
const [THEFT, RELEASE] = TIME_WORM_ABILITY_IDS;
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const finalRounds = (state: SliceState) => state.combatHistory.slice(capturedState('prefixFinal').combatHistory.length);
const acquisitionChecks = (s: SliceState) => s.timeWorm.acquisitionJournal.filter(row => row.check)
  .map(row => [row.command, row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const lifeChecks = (s: SliceState) => s.timeWorm.life.journal.filter(row => row.check)
  .map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const lifeResults = (s: SliceState) => Object.fromEntries(TIME_WORM_CASE_IDS.map(id => {
  const c = s.timeWorm.life.cases[id];
  return [id, { status: c.status, result: c.result, returned: c.returned, attempts: c.attempts.map(a => ({
    closed: a.closed, exited: a.exited, result: a.result, declaration: a.declaration,
    comparisonAttempted: a.comparisonAttempted, comparisonBonus: a.comparisonBonus, comparisonTier: a.comparisonTier,
    theft: a.theft, release: a.release })) }];
}));

// Replay the full original551-command natural Error history, including its real
// wounds and retreat. The old451 peaceful and separate456 DEAD histories are
// evidence only: neither replaces the exact551 source or creates a new run.
describe('Time Worm exact551-command source and actual public continuation', () => {
  it('pins raw172 source, raw194 continuation and exact639 blocker separately from current migration', async () => {
    for (const [path, hash] of [[TIME_WORM_SOURCE, expected.sourceSha256], [TIME_WORM_PEACEFUL_SOURCE, expected.peacefulSha256],
      [TIME_WORM_DEATH_SOURCE, expected.deathSha256], ['scripts/play/time-worm-stage.mjs', expected.producerSha256]] as const) {
      expect(await captureFileHash(path), path).toBe(hash);
    }
    const raw = sourceEntry<SliceState>('final');
    expect(raw).toMatchObject({ schemaVersion: 172, contentVersion: 'fate-trojan-v172', revision: 552, status: 'ACTIVE', week: 127,
      health: 40, mind: 100, spirituality: 90, cash: 472, actionsRemaining: 3, injuryRisk: 2,
      random: { seed: 'marauder-natural-v038', cursor: 361 }, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 27 } });
    expect(raw.injuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT', 'HEAVY']);
    expect(insertionOrderHash(raw)).toBe(expected.rawSourceStateSha256); expect(captureValueHash(raw)).toBe(expected.rawSourceStateSortedSha256);
    expect(insertionOrderHash(sourceEntry('initial'))).toBe(expected.rawInitialSha256);
    for (const key of TIME_WORM_SOURCE_KEYS) expect(insertionOrderHash(raw[key]), key).toBe(expected.rawRootHashes[key]);
    expect(naturalEntry('final')).toMatchObject({ schemaVersion: 194, contentVersion: 'time-worm-v194' });
    expect(insertionOrderHash(naturalEntry('final'))).toBe(expected.rawFinalSha256);
    expect(insertionOrderHash(naturalEntry('prefixFinal'))).toBe(expected.rawPrefixFinalSha256);
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), migrateSliceState(raw)); same(capturedState('initial'), migrateSliceState(sourceEntry('initial')));
    expect(naturalEntry('producerSha256')).toBe(expected.producerSha256);
    expect(naturalEntry('originalProducerSha256')).toBe(expected.originalProducerSha256);
    same(naturalEntry('continuationSource'), expected.continuationSource);
    expect(naturalEntry('continuationSource')).toMatchObject({ kind: 'EXACT_639_PUBLIC_PREFLIGHT_PROJECTION_REPAIR_ONLY',
      originalCommandCount: 639, restoredCommandCount: 639, fullStateUnchanged: true, replayedPriorCommands: 0,
      exactCommandLedgerThrough639: true, exactPublicLedgerThrough639: true, newRandomChanges: false });
    const prior = readObjectEntry<SliceState>(`${TIME_WORM_ROOT}/prior-blocker-natural.json`, 'final');
    expect(prior).toMatchObject({ status: 'ACTIVE', revision: 640, week: 143, actionsRemaining: 0, random: { cursor: 366 },
      timeWorm: { life: { clockSeconds: 888, pending: null, activeCase: 'withdrawn-delay' } } });
    same(captureCommands.slice(0, 639), readObjectEntry(`${TIME_WORM_ROOT}/prior-blocker-natural.json`, 'commands'));
    same(readObjectEntry(`${TIME_WORM_ROOT}/prior-blocker-natural.json`, 'pendingIntent'), { type: 'TIME_WORM', command: { type: 'WAIT_1' } });
  }, 60_000);

  it('preserves the historical451 peaceful boundary and separate456 death without revival or new identity', () => {
    const sourceCommands = sourceEntry<SliceIntent[]>('commands'), peaceful = peacefulEntry<SliceState>('final');
    expect(sourceCommands).toHaveLength(551); expect(peacefulEntry<SliceIntent[]>('commands')).toHaveLength(451);
    same(sourceCommands.slice(0, 451), peacefulEntry('commands'));
    expect(peaceful).toMatchObject({ schemaVersion: 149, contentVersion: 'deceit-mentor-v149', status: 'ACTIVE', revision: 452 });
    expect(insertionOrderHash(peaceful)).toBe(expected.peacefulStateSha256);
    expect(readObjectEntry<SliceIntent[]>(TIME_WORM_DEATH_SOURCE, 'commands')).toHaveLength(456);
    const dead = readObjectEntry<SliceState>(TIME_WORM_DEATH_SOURCE, 'final');
    expect(dead).toMatchObject({ schemaVersion: 149, contentVersion: 'deceit-mentor-v149', status: 'DEAD', health: 0,
      revision: 457, week: 108, random: { seed: 'marauder-natural-v038', cursor: 319 } });
    expect(insertionOrderHash(dead)).toBe(expected.deathStateSha256);
    const migrated = migrateSliceState(dead); assertValidSliceState(migrated);
    expect(migrated.status).toBe('DEAD'); expect(projectSliceState(migrated).canAct).toBe(false);
    for (const blocked of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }] satisfies SliceIntent[]) {
      const hash = captureValueHash(migrated); expect(() => applySliceIntent(migrated, blocked)).toThrow(); expect(captureValueHash(migrated)).toBe(hash);
    }
    same(naturalEntry('creation'), sourceEntry('creation')); same(sourceEntry('creation'), peacefulEntry('creation'));
    expect(naturalEntry('provenance')).toMatchObject({ kind: 'SAME_SEED_EXACT551_PUBLIC_PREFIX_THEN_PUBLIC_TIME_WORM',
      sourceRoot: 'final', original456CommandDeathPreserved: true, inheritedDirectedPrefix: false, newRandomChanges: false });
    const original = capturedState('prefixFinal'), final = capturedState('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(14);
    expect(Object.entries(original.progression.mastery).filter(([, n]) => n === 0).map(([id]) => id)).toEqual(['error.s5.thought-theft']);
    same(original.character, expected.originalCharacter); expect(original.character.coreStats).toEqual({ physique: 28, perception: 27, will: 25, knowledge: 25 });
    expect(original.parasite.life.host).toMatchObject({ mode: 'NONE', control: 'HOST', awareness: 'AWARE' });
    expect(original.fateTrojan.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 55 });
    assertOriginalContinuity(final, original); expect(validateTimeWormSource(final)).toBe(true);
  }, 60_000);

  it('replays every original and continuation command exactly once through current public controls', () => {
    const sourceCommands = sourceEntry<SliceIntent[]>('commands'); expect(TIME_WORM_PREFIX_COUNT).toBe(551);
    expect(captureCommands).toHaveLength(expected.commandCount); same(captureCommands.slice(0, 551), sourceCommands);
    expect(insertionOrderHash(sourceCommands)).toBe(expected.prefixSha256);
    expect(naturalEntry('prefixCount')).toBe(551); expect(naturalEntry('prefixVerified')).toBe(true); expect(naturalEntry('inheritedPrefixCount')).toBe(451);
    same(naturalEntry('strategy'), expected.strategy); expect(naturalEntry('seed')).toBe('marauder-natural-v038');
    let state = migrateSliceState(sourceEntry('initial'));
    const original = capturedState('prefixFinal'); same(state, capturedState('initial'));
    for (const [index, intent] of captureCommands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(551); expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending?.kind).not.toBe('DEATH');
      } else expect(state.status, `No command after death at step ${index + 1}`).toBe('ACTIVE');
      if (index >= 551) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe('marauder-natural-v038');
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === 550) same(state, original);
      if (index === 638) same(state, currentTimeWormReplayExpectation(migrateSliceState(readObjectEntry(`${TIME_WORM_ROOT}/prior-blocker-natural.json`, 'final'))));
      if (index >= 551) assertOriginalContinuity(state, original);
    }
    same(state, currentTimeWormReplayExpectation(capturedState('final'))); assertValidSliceState(state); same(migrateSliceState(state), state);
    same(captureBody(state), expected.final); expect(state.revision).toBe(capturedState('initial').revision + expected.commandCount);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
  }, 120_000);

  it('retains the complete contiguous command/public ledgers and exact original append-only bytes', async () => {
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames); same(Object.keys(boundarySteps), Object.keys(boundaryIndex));
    same(Object.keys(snapshotIndex), expected.snapshots);
    type Ledger = { step: number; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    let prior = captureBody(capturedState('initial')), count = 0;
    for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
      expect(row.step).toBe(++count); same(row.intent, captureCommands[count - 1]); same(row.before, prior); prior = row.after;
    }
    expect(count).toBe(expected.commandCount); same(prior, expected.final);
    type PublicRow = { step: number; command: SliceIntent; control: { enabled: boolean }; randomBefore: SliceState['random']; randomAfter: SliceState['random'] };
    count = 551;
    for await (const row of captureJsonLines<PublicRow>('public.jsonl')) {
      expect(row.step).toBe(++count); same(row.command, captureCommands[count - 1]); expect(row.control.enabled).toBe(true);
      expect(row.randomBefore.seed).toBe('marauder-natural-v038'); expect(row.randomAfter.seed).toBe(row.randomBefore.seed);
      expect(row.randomAfter.cursor).toBeGreaterThanOrEqual(row.randomBefore.cursor);
    }
    expect(count).toBe(expected.commandCount);
    for (const file of ['commands.jsonl', 'public.jsonl']) {
      const original = readFileSync(`${TIME_WORM_ROOT}/prior-blocker-${file}`), continued = readFileSync(`${TIME_WORM_ROOT}/${file}`);
      expect(continued.subarray(0, original.length).equals(original), `${file} original bytes`).toBe(true);
    }
  }, 120_000);

  it('pays actual care, labour, bottle and preparation costs without resetting original body or mastery', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), promoted = capturedSnapshot('promoted');
    const care = replayCaptureBoundary('actual-clinic-pay60'); expect(care.before.cash - care.final.cash).toBe(60);
    expect(care.final.health).toBe(care.before.health); same(care.final.random, care.before.random);
    expect(capturedSnapshot('afterOriginalCare')).toMatchObject({ health: 80, injuries: [], injuryRisk: 0 });
    const guidance = replayCaptureBoundary('actual500p-guidance-freezes-eight-original-error-roots');
    const guidanceReceipt = guidance.final.timeWorm.acquisitionJournal.at(-1)!;
    expect(guidanceReceipt.before.cash - guidanceReceipt.after.cash).toBe(500);
    expect(guidance.final.cash).toBe(guidance.before.cash - 500 - 30); expect(guidance.final.week).toBe(guidance.before.week + 1);
    same(acquisitionChecks(final), expected.acquisitionChecks); same(final.timeWorm.bottles, expected.bottles);
    same(final.timeWorm.bottles.filter(b => b.status === 'CONSUMED').map(b => b.outcome), expected.potionOutcomes);
    for (const bottle of final.timeWorm.bottles.filter(b => b.status === 'CONSUMED')) {
      const buy = replayCaptureBoundary(`actual1100p-buy-${bottle.id}`), prep = replayCaptureBoundary(`actual150p-current-week-preparation-${bottle.id}`);
      const dose = replayCaptureBoundary(`actual-consumption-${bottle.id}`);
      expect(buy.final.timeWorm.acquisitionJournal.at(-1)!.before.cash - buy.final.timeWorm.acquisitionJournal.at(-1)!.after.cash).toBe(1100);
      expect(prep.final.timeWorm.acquisitionJournal.at(-1)!.before.cash - prep.final.timeWorm.acquisitionJournal.at(-1)!.after.cash).toBe(150);
      expect(final.timeWorm.acquisitionJournal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before.week - original.fateTrojan.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.timeWorm.preparedWeek).toBe(dose.before.week); expect(dose.final.timeWorm.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!)); expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
      expect(dose.final.spirituality).toBe(dose.before.spirituality); same(dose.final.injuries, dose.before.injuries);
      expect(dose.final.fateTrojan.life.site.playerEnergy).toBe(dose.before.fateTrojan.life.site.playerEnergy);
    }
    expect(Object.keys(promoted.progression.mastery)).toHaveLength(16); expect(TIME_WORM_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(mastery);
    expect(final.timeWorm.preparations.map(p => p.taskId)).toEqual(['VERIFY_ORIGINALS', 'DECLARE_PENDING_ACTION', 'PLAN_RETURN']);
    same(naturalEntry('treatments'), expected.treatments); expect(validateTimeWormAcquisitionJournal(final)).toBe(true);
  }, 60_000);

  it('retains failed theft, unattempted release and withdrawn reserve while the original target still waits', () => {
    const final = capturedState('final'), life = final.timeWorm.life;
    same(lifeChecks(final), expected.lifeChecks); same(lifeResults(final), expected.lifeCaseResults);
    for (const id of TIME_WORM_CASE_IDS) {
      const cast = replayCaptureBoundary(`${id}-single-paid-short-time-theft-attempt`);
      expect(cast.before.spirituality - cast.final.spirituality).toBe(8); expect(cast.before.mind - cast.final.mind).toBe(2);
      expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1);
      same(cast.final.progression.mastery, cast.before.progression.mastery);
      expect(cast.final.timeWorm.life.clockSeconds - cast.before.timeWorm.life.clockSeconds).toBe(1);
      expect(cast.final.actionsRemaining).toBe(cast.before.actionsRemaining); expect(cast.final.week).toBe(cast.before.week);
      const attempt = life.cases[id].attempts[0]!;
      expect(life.cases[id].attempts).toHaveLength(1); expect(attempt).toMatchObject({ closed: true, exited: true, penniesSpent: 20 });
      expect(attempt.declaration).toMatchObject({ targetId: 'FT2-VICTOR', parcelId: 'FT2-PARCEL', state: 'EXECUTED' });
    }
    const released = life.cases['released-interval'].attempts[0]!;
    expect(released.theft).toMatchObject({ attempts: 1, successes: 0, effects: 0, state: 'FAILED' });
    expect(released.release).toMatchObject({ attempts: 0, successes: 0, effects: 0 }); expect(released.comparisonBonus).toBe(0);
    const prior = migrateSliceState(readObjectEntry(`${TIME_WORM_ROOT}/prior-blocker-natural.json`, 'final'));
    const attempt = prior.timeWorm.life.cases['withdrawn-delay'].attempts[0]!;
    expect(attempt.permission.ability).toBe('WITHDRAWN'); expect(attempt.theft).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'STOPPED' });
    expect(prior.timeWorm.life.pending).toBeNull(); expect(attempt.declaration!.dueAt - prior.timeWorm.life.clockSeconds).toBe(2);
    same(naturalEntry('withdrawalEvidence'), expected.withdrawalEvidence);
    const beforeHash = captureValueHash(prior), view = projectSliceState(prior).timeWorm.life;
    expect(view.targetRemainingSeconds).toBe(2); expect(view.pendingRemainingSeconds).toBe(0);
    expect(view.actions.some(a => a.command.type === 'WAIT_1' && a.enabled)).toBe(true);
    expect(captureValueHash(prior)).toBe(beforeHash);
    let state = prior;
    for (const step of [640, 641, 642]) {
      const intent = captureCommands[step - 1]!; assertPublicCaptureControl(state, intent);
      expect(intent).toEqual({ type: 'TIME_WORM', command: { type: step === 642 ? 'EXECUTE_LOOK' : 'WAIT_1' } });
      const before = state; state = applySliceIntent(state, intent);
      expect(state.timeWorm.life.clockSeconds - before.timeWorm.life.clockSeconds).toBe(1);
      same([state.cash, state.spirituality, state.mind, state.actionsRemaining, state.week, state.date, state.random],
        [before.cash, before.spirituality, before.mind, before.actionsRemaining, before.week, before.date, before.random]);
    }
    expect(state.timeWorm.life.cases['withdrawn-delay'].attempts[0]!.declaration).toMatchObject({ state: 'EXECUTED', dueAt: 890, executedAt: 891, delayedSeconds: 3 });
    same(Object.fromEntries([['theft', THEFT], ['release', RELEASE]].map(([key, id]) => {
      const uses = TIME_WORM_CASE_IDS.flatMap(caseId => life.cases[caseId].attempts.map(a => a[key as 'theft' | 'release']));
      return [id, { attempts: sum(uses, a => a.attempts), checkSuccesses: sum(uses, a => a.successes), actualApplications: sum(uses, a => a.effects), states: uses.map(a => a.state) }];
    })), expected.lifeAbilityUse);
    expect(validateTimeWormLifeState(final)).toBe(true);
  }, 60_000);

  it('reconciles original people, no duplicated carry, actual energy recovery, costs and weekly finances', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), life = final.timeWorm.life, journal = life.journal;
    const site = final.fateTrojan.life.site, old = original.fateTrojan.life.site;
    let originals = { site: old };
    for (const row of journal) { same(row.originalsBefore, originals); originals = row.originalsAfter; }
    same(originals, { site }); same(originals, timeWormExpectedOriginals(final));
    expect(captureValueHash(journal)).toBe(expected.lifeJournalSha256); expect(insertionOrderHash(final.timeWorm.sourceHistory)).toBe(expected.sourceHistorySha256);
    expect(insertionOrderHash(final.timeWorm.sourceScene)).toBe(expected.sourceSceneSha256); same(site, expected.currentOriginalSite);
    expect(life.clockSeconds).toBe(old.clockSeconds + sum(journal, r => r.elapsedSeconds));
    expect(life.elapsedSeconds).toBe(sum(journal, r => r.elapsedSeconds)); expect(site.clockSeconds).toBe(life.clockSeconds);
    expect(site.playerTravelMetres).toBe(old.playerTravelMetres + sum(journal, r => r.playerWalkedMetres));
    expect(site.lina.travelMetres).toBe(old.lina.travelMetres + sum(journal, r => r.linaWalkedMetres));
    expect(site.victor.travelMetres).toBe(old.victor.travelMetres + sum(journal, r => r.victorWalkedMetres));
    expect(site.playerEnergy).toBe(old.playerEnergy + sum(journal, r => r.playerEnergyRecovered - r.playerEnergySpent));
    expect(site.lina.energy).toBe(old.lina.energy - sum(journal, r => r.linaEnergySpent));
    expect(site.victor.energy).toBe(old.victor.energy - sum(journal, r => r.victorEnergySpent));
    for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals'] as const) same(site[key], old[key]);
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', lina: { location: 'OUTSIDE' }, victor: { location: 'OUTSIDE' },
      parcel: { location: 'OUTSIDE', ordinaryMetres: 8 }, fate: { status: 'COMPLETED', paidToPlayer: 12, escrowPennies: 0 } });
    for (const row of journal.filter(r => r.command.type === 'RECOVER_ENERGY')) {
      expect(row.before.cash - row.after.cash).toBe(15); expect(row.before.actions - row.after.actions).toBe(1);
      expect(row.elapsedSeconds).toBe(60); expect(row.playerEnergyRecovered).toBe(20); expect(row.originalsBefore.site.playerLocation).toBe('OUTSIDE');
    }
    const acquisition = final.timeWorm.acquisitionJournal, outcomes = finalRounds(final).map(r => r.timeWormOutcome!);
    const costs = {
      acquisitionCash: sum(acquisition, r => r.before.cash - r.after.cash), acquisitionAP: sum(acquisition, r => r.before.actions - r.after.actions),
      lifeCash: sum(journal, r => r.before.cash - r.after.cash), lifeAP: sum(journal, r => r.before.actions - r.after.actions),
      lifeSpirituality: sum(journal, r => r.before.spirituality - r.after.spirituality), lifeMind: sum(journal, r => r.before.mind - r.after.mind),
      playerOrdinaryMetres: sum(journal, r => r.playerWalkedMetres), linaOrdinaryMetres: sum(journal, r => r.linaWalkedMetres), victorOrdinaryMetres: sum(journal, r => r.victorWalkedMetres),
      playerEnergySpent: sum(journal, r => r.playerEnergySpent), playerEnergyRecovered: sum(journal, r => r.playerEnergyRecovered),
      linaEnergySpent: sum(journal, r => r.linaEnergySpent), victorEnergySpent: sum(journal, r => r.victorEnergySpent),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyOriginalMarksSpent: final.timeWorm.encounter.materials.marks.filter(m => m.status === 'SPENT').length,
      clinic: sum(naturalEntry<{ paidPennies: number }[]>('treatments'), t => t.paidPennies),
      ordinaryWorkCount: captureCommands.slice(551).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: captureCommands.slice(551).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
    };
    const { note: _note, ...expectedCosts } = expected.actualCosts; same(costs, expectedCosts); same(summaryEntry('actualCosts'), expected.actualCosts);
    expect(final.cash).toBe(original.cash + costs.ordinaryWorkCount * original.character.weeklyWage - costs.acquisitionCash - costs.lifeCash - costs.clinic - (final.week - original.week) * 30);
    same(timeWormFinanceSnapshot(final), expected.finalFinance); expect(validateTimeWormJournalContinuity(final)).toBe(true);
  }, 60_000);

  it('replays actual ordered combat with finite paid resources and future-only three-second effects', () => {
    const final = capturedState('final'), rounds = finalRounds(final), spent = new Set<string>();
    expect(rounds.map(captureValueHash)).toEqual(expected.roundHashes); let enemyPaid = 0;
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.timeWormOutcome!;
      same(o.source, currentTimeWormCombatSource(save.before)); same(replayTimeWormCombatRound(o.source, 'CONTROL').round, round);
      expect(o.source).toMatchObject({ targetId: 'TW1-ADRIAN', targetAge: 45, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'marauder-natural-v038' });
      expect(round.playerCount).toBe(timeWormActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(timeWormEnemyActionCount(round.enemyCountRoll));
      expect(o.playerActions.length).toBeLessThanOrEqual(round.playerCount); expect(o.enemyActions.length).toBeLessThanOrEqual(round.enemyCount);
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      same(round.moves, actions.map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })));
      for (const a of actions) {
        expect(a.completedAtSeconds - a.atSeconds).toBe(1); expect(a.elapsedSeconds).toBe(1);
        expect(a.randomCursorAfter - a.randomCursorBefore).toBe(Number(a.check !== null) + Number(a.resistanceRoll !== null));
        if (a.consumedMarkId) {
          expect(a.actor).toBe('ENEMY'); expect(a.paidCost).toBe(7); expect(['BODY', 'MENTAL']).toContain(a.attackKind);
          expect(spent.has(a.consumedMarkId)).toBe(false); spent.add(a.consumedMarkId);
          expect(a.materialsBefore.marks.find(m => m.id === a.consumedMarkId)!.status).toBe('HELD');
          expect(a.materialsAfter.marks.find(m => m.id === a.consumedMarkId)!.status).toBe('SPENT');
        }
        for (const id of TIME_WORM_ABILITY_IDS) if (a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0) {
          expect([a.paidCost, a.mindCost]).toEqual([id === THEFT ? 8 : 6, 2]); expect(a.masteryApplied).not.toContain(id);
        }
        if (a.masteryApplied.includes(THEFT)) {
          expect(a.actor).toBe('ENEMY'); expect(a.targetDelay).not.toBeNull(); expect(a.targetDelay!.theftOrder).toBeLessThan(a.order);
          expect(a.targetDelay!.dueAt - a.targetDelay!.heldFrom).toBe(3); expect(a.targetDelay!.executedAt).toBeGreaterThanOrEqual(a.targetDelay!.dueAt);
        }
        if (a.masteryApplied.includes(RELEASE)) {
          expect(a.actor).toBe('PLAYER'); expect(a.selectedAbility).toBe('STRIKE'); const window = a.windowsBefore.timeRelease!;
          expect(window.openedOrder).toBeLessThan(a.order); expect(a.completedAtSeconds).toBeLessThan(window.expiresAt);
        }
        if (a.consumedReserveId) {
          expect([RELEASE, 'STRIKE']).toContain(a.selectedAbility); expect(a.windowsAfter.shortTimeTheft).toBeNull();
          expect(a.pendingAfter?.dueAt).toBe(a.pendingBefore?.dueAt);
        }
      }
      expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60);
      expect(o.source.playerSpirituality - o.playerSpiritualityAfter).toBe(sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - (round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      enemyPaid += sum(o.enemyActions, a => a.paidCost); expect(o.enemySpirituality).toBe(120 - enemyPaid);
      expect(o.materialsAfter.marks.filter(m => m.status === 'SPENT')).toHaveLength(spent.size);
      if (round.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined(); expect(o.playerHealthAfter).toBe(o.source.playerHealth);
        same(o.playerInjuriesAfter, o.source.playerInjuries); expect(o.playerRiskAfter).toBe(o.source.playerRisk);
      }
      same(o.windowsAfter, { shortTimeTheft: null, timeRelease: null }); expect(o.pendingEnemyActionAfter).toBeNull();
      same(save.final.fateTrojan.life.site, save.before.fateTrojan.life.site);
    }
    const allActions = rounds.flatMap(r => [...r.timeWormOutcome!.playerActions, ...r.timeWormOutcome!.enemyActions]);
    same(Object.fromEntries(TIME_WORM_ABILITY_IDS.map(id => [id, {
      plannedSelections: allActions.filter(a => a.actor === 'PLAYER' && a.planned === id).length,
      paidAttempts: allActions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0).length,
      successfulChecks: allActions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.check && ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier)).length,
      actualApplications: allActions.filter(a => a.masteryApplied.includes(id)).length,
    }])), expected.combatAbilityUse);
    expect(captureValueHash(final.timeWorm.encounter)).toBe(expected.encounterSha256);
    same(summaryEntry('encounter'), expected.encounter); same(summaryEntry('rounds'), expected.rounds);
  }, 60_000);

  it('reopens the actual final body and ordinary exit without inventing victory, death or postmortem work', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(captureCommands.at(-1), intent); same(applySliceIntent(before, intent), final);
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    same(final.timeWorm.encounter.terminal, expected.terminal);
    if (final.status === 'DEAD') {
      expect(final.health).toBe(0); expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
      expect(projectSliceState(reopened).timeWorm.actions.some(a => a.enabled)).toBe(false);
      expect(boundaryIndex['actual-paid-work-after-living-four-metre-exit']).toBeUndefined();
      for (const blocked of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
        { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'TIME_WORM', command: { type: 'LEAVE_ENCOUNTER' } }] satisfies SliceIntent[]) {
        const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
      }
    } else {
      expect(final.status).toBe('ACTIVE'); expect(final.health).toBeGreaterThan(0);
      expect(final.timeWorm.encounter.terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 });
      expect(final.timeWorm.encounter.scene).toMatchObject({ playerLocation: 'OUTSIDE', playerCoordinate: 0 });
      const work = replayCaptureBoundary('actual-paid-work-after-living-four-metre-exit'); expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      same(final.injuries, capturedSnapshot('combatTerminal').injuries);
    }
    assertOriginalContinuity(final, capturedState('prefixFinal'));
  }, 60_000);
});
