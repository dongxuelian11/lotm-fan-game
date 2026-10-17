import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { starKeyFinanceSnapshot, validateStarKeyAcquisitionJournal, validateStarKeyJournalContinuity,
  validateStarKeySource } from '../../src/domain/star-key/index.js';
import { STAR_KEY_ABILITY_IDS, STAR_KEY_SOURCE_KEYS } from '../../src/domain/star-key/types.js';
import { STAR_KEY_CASE_IDS, starKeyExpectedOriginals, starKeyLifeMasteryGains, validateStarKeyLifeState } from '../../src/domain/star-key/life.js';
import { currentStarKeyCombatSource, replayStarKeyCombatRound, starKeyActionCount,
  starKeyEnemyActionCount } from '../../src/domain/star-key/combat.js';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { actualStarKeyEvidence } from './star-key-capture-evidence.js';
import { STAR_KEY_ROOT, STAR_KEY_SOURCE, STAR_KEY_PEACEFUL_SOURCE, STAR_KEY_WANDERER_DEATH_SOURCE,
  STAR_KEY_PREFIX_COUNT, captureFileHash, captureValueHash, insertionOrderHash, sourceEntry,
  peacefulEntry, naturalEntry, summaryEntry, captureCommands, boundaryIndex, boundarySteps, snapshotIndex,
  capturedState, capturedSnapshot, replayCaptureBoundary, assertPublicCaptureControl, assertOriginalContinuity,
  captureBody, captureJsonLines, sameCaptureValue as same } from './star-key-capture-helper.js';

const expected = actualStarKeyEvidence();
const [ENDPOINT, ANCHOR] = STAR_KEY_ABILITY_IDS;
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const finalRounds = () => capturedState('final').combatHistory.slice(capturedState('prefixFinal').combatHistory.length);
const acquisitionChecks = (s: SliceState) => s.starKey.acquisitionJournal.filter(row => row.check)
  .map(row => [row.command, row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const lifeChecks = (s: SliceState) => s.starKey.life.journal.filter(row => row.check)
  .map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
function roundEvidence(round: SliceCombatRound) {
  const o = round.starKeyOutcome!;
  return { round: round.round, stance: round.stance, first: round.first,
    countWheels: { playerRoll: round.playerCountRoll, playerCount: round.playerCount, enemyRoll: round.enemyCountRoll, enemyCount: round.enemyCount },
    consequenceDomain: round.consequenceDomain ?? null, consequenceRoll: round.consequenceRoll ?? null,
    random: [o.source.randomCursor, o.randomCursorAfter], roundSha256: captureValueHash(round), outcomeSha256: captureValueHash(o),
    result: { playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: o.playerSpiritualityAfter,
      playerRisk: o.playerRiskAfter, enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
      enemyStatus: o.enemyStatus, actualPlayerActions: o.playerActions.length, actualEnemyActions: o.enemyActions.length },
    actions: [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order).map(a =>
      [a.order, a.actor, a.planned, a.selectedAbility, a.paidCost, a.mindCost, a.check && [a.check.roll, a.check.chance, a.check.tier],
        a.resistanceRoll, a.finiteResult, a.masteryApplied, a.consumedMarkId]) };
}

// The inherited initial is an explicitly directed historical S4 origin. The
// complete701-command living boundary is replayed once; createSliceRun would
// silently replace that original and is deliberately never used here.
describe('Star Key exact701-command living boundary and actual public continuation', () => {
  it('pins raw171 sources and raw193 capture separately from current migration', async () => {
    expect(await captureFileHash(STAR_KEY_SOURCE)).toBe(expected.sourceSha256);
    expect(await captureFileHash(STAR_KEY_PEACEFUL_SOURCE)).toBe(expected.peacefulSha256);
    expect(await captureFileHash(`${STAR_KEY_ROOT}/natural.json`)).toBe(expected.naturalSha256);
    expect(await captureFileHash('scripts/play/star-key-stage.mjs')).toBe(expected.producerSha256);
    const raw = peacefulEntry<SliceState>('beforeLast');
    expect(raw).toMatchObject({ schemaVersion: 171, contentVersion: 'planeswalker-v171', revision: 1009, status: 'ACTIVE', week: 201,
      health: 100, mind: 100, spirituality: 120, cash: 5280, actionsRemaining: 3, injuries: [], injuryRisk: 0,
      random: { seed: 'secrets-sorcerer-directed-24', cursor: 94 }, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 28 } });
    expect(insertionOrderHash(raw)).toBe(expected.rawSourceStateSha256);
    expect(captureValueHash(raw)).toBe(expected.rawSourceStateSortedSha256);
    expect(insertionOrderHash(sourceEntry('initial'))).toBe(expected.rawInitialSha256);
    for (const key of STAR_KEY_SOURCE_KEYS) expect(insertionOrderHash(raw[key]), key).toBe(expected.rawRootHashes[key]);
    expect(naturalEntry('final')).toMatchObject({ schemaVersion: 193, contentVersion: 'star-key-v193' });
    expect(insertionOrderHash(naturalEntry('final'))).toBe(expected.rawFinalSha256);
    expect(insertionOrderHash(naturalEntry('prefixFinal'))).toBe(expected.rawPrefixFinalSha256);
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), migrateSliceState(raw));
    same(capturedState('initial'), migrateSliceState(sourceEntry('initial')));
    expect(naturalEntry('producerSha256')).toBe(expected.producerSha256);
    expect(naturalEntry('originalProducerSha256')).toBe(expected.originalProducerSha256);
    expect(await captureFileHash(`${STAR_KEY_ROOT}/resume-verification.json`)).toBe(expected.resumeVerificationSha256);
    const continuation = naturalEntry<Record<string, unknown>>('continuationSource');
    same(continuation, expected.continuationSource);
    expect(continuation).toMatchObject({ kind: 'EXACT_FIRST_COMBAT_VALIDATOR_REPAIR_ONLY', originalCommandCount: 813,
      restoredCommandCount: 812, fullStateUnchanged: true, commandLedgerExactThrough813: true, newRandomChanges: false });
    for (const [file, hash] of Object.entries(expected.preservedFailureFiles)) expect(await captureFileHash(`${STAR_KEY_ROOT}/${file}`), file).toBe(hash);
  }, 60_000);

  it('preserves original707-command and separate209-command deaths without reviving either', async () => {
    expect(await captureFileHash(STAR_KEY_WANDERER_DEATH_SOURCE)).toBe(expected.wandererDeathSha256);
    const fullCommands = sourceEntry<SliceIntent[]>('commands'), dead = sourceEntry<SliceState>('final');
    expect(fullCommands).toHaveLength(707);
    expect(dead).toMatchObject({ status: 'DEAD', health: 0, revision: 1015, random: { seed: 'secrets-sorcerer-directed-24', cursor: 147 } });
    expect(insertionOrderHash(dead)).toBe(expected.originalDeathStateSha256);
    const wandererDead = readObjectEntry<SliceState>(STAR_KEY_WANDERER_DEATH_SOURCE, 'final');
    expect(readObjectEntry<SliceIntent[]>(STAR_KEY_WANDERER_DEATH_SOURCE, 'commands')).toHaveLength(209);
    expect(wandererDead).toMatchObject({ status: 'DEAD', health: 0 });
    expect(insertionOrderHash(wandererDead)).toBe(expected.wandererDeathStateSha256);
    for (const original of [dead, wandererDead]) {
      const migrated = migrateSliceState(original); assertValidSliceState(migrated);
      expect(migrated.status).toBe('DEAD'); expect(migrated.health).toBe(0);
      expect(projectSliceState(migrated).canAct).toBe(false);
      for (const blocked of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }] satisfies SliceIntent[]) {
        const hash = captureValueHash(migrated); expect(() => applySliceIntent(migrated, blocked)).toThrow();
        expect(captureValueHash(migrated)).toBe(hash);
      }
    }
    same(fullCommands[701], { type: 'PLANESWALKER', command: { type: 'ENCOUNTER_TALK' } });
    same(peacefulEntry('lastIntent'), fullCommands[701]);
    expect(sourceEntry('provenance')).toMatchObject({ kind: 'DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER', newRandomChanges: false });
    expect(naturalEntry('provenance')).toMatchObject({ kind: 'DIRECTED_S4_ORIGIN_EXACT701_PUBLIC_PREFIX_THEN_PUBLIC_STAR_KEY',
      original707CommandDeathPreserved: true, separate209CommandDeathPreserved: true, inheritedDirectedPrefix: true, newRandomChanges: false });
  }, 60_000);

  it('replays the whole exact prefix once and every actual public continuation without changing seed or body', () => {
    const sourceCommands = sourceEntry<SliceIntent[]>('commands').slice(0, STAR_KEY_PREFIX_COUNT);
    expect(STAR_KEY_PREFIX_COUNT).toBe(701); expect(captureCommands).toHaveLength(expected.commandCount);
    same(captureCommands.slice(0, STAR_KEY_PREFIX_COUNT), sourceCommands);
    expect(insertionOrderHash(sourceCommands)).toBe(expected.prefixSha256);
    expect(naturalEntry('prefixCount')).toBe(701); expect(naturalEntry('prefixVerified')).toBe(true);
    expect(naturalEntry('inheritedPrefixCount')).toBe(208); expect(naturalEntry('inheritedDirectedCommandCount')).toBe(60);
    same(naturalEntry('creation'), sourceEntry('creation')); expect(naturalEntry('seed')).toBe('secrets-sorcerer-directed-24');
    same(naturalEntry('strategy'), expected.strategy);
    const original = capturedState('prefixFinal');
    let state = migrateSliceState(sourceEntry('initial'));
    let history: SliceState['starKey']['sourceHistory'] = null, scene: SliceState['starKey']['sourceScene'] = null;
    same(state, capturedState('initial'));
    for (const [index, intent] of captureCommands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(STAR_KEY_PREFIX_COUNT); expect(state.status).toBe('SLICE_COMPLETE');
        expect(state.ending).not.toBeNull(); expect(state.ending!.kind).not.toBe('DEATH');
      } else expect(state.status, `No post-terminal continuation at command ${index + 1}`).toBe('ACTIVE');
      if (index >= STAR_KEY_PREFIX_COUNT) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe('secrets-sorcerer-directed-24');
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === STAR_KEY_PREFIX_COUNT - 1) same(state, original);
      if (index >= STAR_KEY_PREFIX_COUNT) {
        assertOriginalContinuity(state, original);
        if (state.starKey.guidanceKnown) {
          history ??= structuredClone(state.starKey.sourceHistory); scene ??= structuredClone(state.starKey.sourceScene);
          same(state.starKey.sourceHistory, history); same(state.starKey.sourceScene, scene);
        }
      }
    }
    same(state, capturedState('final')); assertValidSliceState(state); same(migrateSliceState(state), state);
    same(captureBody(state), expected.final); expect(state.revision).toBe(capturedState('initial').revision + expected.commandCount);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames); expect(Object.keys(snapshotIndex)).toEqual(expected.snapshots);
    same(Object.keys(boundarySteps), Object.keys(boundaryIndex));
  }, 240_000);

  it('freezes all eight histories, original people, fifteen actual masteries and the two new zero skills', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), promoted = capturedSnapshot('promoted');
    expect(Object.keys(original.progression.mastery)).toHaveLength(15); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    same(original.character, expected.originalCharacter);
    expect(original.character.coreStats).toEqual({ physique: 27, perception: 28, will: 27, knowledge: 23 });
    expect(final.planeswalker.promotionWeek).toBe(193); expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(final.wanderer.life.packet.location).toBe('REMOTE');
    same(final.planeswalker.encounter, original.planeswalker.encounter); expect(final.planeswalker.encounter.status).toBe('AVAILABLE');
    assertOriginalContinuity(final, original);
    same(final.starKey.sourceScene!.originals, { site: original.planeswalker.life.site });
    expect(insertionOrderHash(final.starKey.sourceHistory)).toBe(expected.sourceHistorySha256);
    expect(insertionOrderHash(final.starKey.sourceScene)).toBe(expected.sourceSceneSha256);
    expect(Object.keys(promoted.progression.mastery)).toHaveLength(17); expect(STAR_KEY_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    const mastery: Record<string, number> = { ...original.progression.mastery, [ENDPOINT]: 0, [ANCHOR]: 0 };
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(value);
    for (const [id, gain] of Object.entries(starKeyLifeMasteryGains(final))) mastery[id] = Math.min(500, mastery[id]! + gain);
    for (const round of finalRounds()) for (const action of [...round.starKeyOutcome!.playerActions, ...round.starKeyOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
    same(final.progression.mastery, mastery); expect(Object.keys(mastery)).toHaveLength(17);
    expect(validateStarKeySource(final)).toBe(true);
  }, 60_000);

  it('retains each original paid bottle, actual failed draws, five separate labour steps and real recovery', () => {
    const final = capturedState('final'), journal = final.starKey.acquisitionJournal;
    const guidance = replayCaptureBoundary('actual500p-guidance-and-frozen-eight-root-source');
    expect(guidance.before.cash - guidance.final.cash).toBe(500);
    same(acquisitionChecks(final), expected.acquisitionChecks); same(final.starKey.bottles, expected.bottles);
    const consumed = final.starKey.bottles.filter(b => b.status === 'CONSUMED');
    same(consumed.map(b => b.outcome), expected.potionOutcomes);
    expect(consumed.map(b => b.outcome)).toEqual(['FAILURE', 'SUCCESS']);
    expect(final.starKey.bottles).toHaveLength(3);
    expect(final.starKey.bottles[2]).toMatchObject({ id: 'star-key-potion-3', status: 'SUPPLIER', labourSteps: 0,
      acquiredWeek: null, consumedWeek: null, preparationWeek: null, outcome: null });
    for (const bottle of consumed) {
      const buy = replayCaptureBoundary(`actual1100p-buy-${bottle.id}`), preparation = replayCaptureBoundary(`actual150p-current-week-preparation-${bottle.id}`);
      const dose = replayCaptureBoundary(`actual-consumption-${bottle.id}`);
      const buyReceipt = buy.final.starKey.acquisitionJournal.at(-1)!, preparationReceipt = preparation.final.starKey.acquisitionJournal.at(-1)!;
      expect(buyReceipt.before.cash - buyReceipt.after.cash).toBe(1100);
      expect(preparationReceipt.before.cash - preparationReceipt.after.cash).toBe(150);
      expect(journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before.week - dose.before.planeswalker.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.starKey.preparedWeek).toBe(dose.before.week); expect(dose.final.starKey.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!));
      expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
      expect(dose.final.spirituality).toBe(dose.before.spirituality); same(dose.final.injuries, dose.before.injuries);
      expect(dose.final.injuryRisk).toBe(dose.before.injuryRisk);
      for (const [id, value] of Object.entries(dose.before.progression.mastery)) expect(dose.final.progression.mastery[id]).toBe(value);
    }
    expect(final.starKey.preparations.map(row => row.taskId)).toEqual(['VERIFY_ORIGINALS', 'RECORD_ENDPOINTS', 'MARK_RETURN']);
    same(naturalEntry('treatments'), expected.treatments); expect(validateStarKeyAcquisitionJournal(final)).toBe(true);
    expect(capturedSnapshot('recoveredBeforeEncounter')).toMatchObject({ health: 100, mind: 100, spirituality: 120, seer: { pollution: 0 } });
  }, 60_000);

  it('charges every real life cast and awards mastery only for subsequent applied walks, preserving withdrawal', () => {
    const final = capturedState('final'), life = final.starKey.life;
    same(lifeChecks(final), expected.lifeChecks); same(life.cases, expected.lifeCases);
    for (const caseId of STAR_KEY_CASE_IDS) {
      const power = caseId === 'endpoint-verification' ? 'endpoint_location' : 'anchor_maintenance';
      const cast = replayCaptureBoundary(`${caseId}-one-paid-${power}-attempt`);
      const id = caseId === 'endpoint-verification' ? ENDPOINT : ANCHOR;
      expect(cast.before.spirituality - cast.final.spirituality).toBe(id === ENDPOINT ? 8 : 7);
      expect(cast.before.mind - cast.final.mind).toBe(2); expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1);
      expect(cast.final.planeswalker.life.site.playerLocation).toBe(cast.before.planeswalker.life.site.playerLocation);
      expect(cast.final.planeswalker.life.site.parcel.location).toBe(cast.before.planeswalker.life.site.parcel.location);
      same(cast.final.progression.mastery, cast.before.progression.mastery);
      const attempt = life.cases[caseId].attempts[0]!;
      expect(life.cases[caseId].attempts).toHaveLength(1); expect(attempt.closed).toBe(true);
      expect(attempt).toMatchObject({ penniesSpent: 10, parcelReturned: true, exited: true });
      expect(life.cases[caseId]).toMatchObject({ status: 'RESOLVED', method: 'ABILITY', returned: true });
    }
    for (const [caseId, name] of [['endpoint-verification', 'independent-check-and-actual4metre-walk'], ['anchor-transfer', 'independent-check-and-actual4metre-carry']] as const) {
      const walked = replayCaptureBoundary(`${caseId}-${name}`);
      expect(walked.final.planeswalker.life.site.playerMetres - walked.before.planeswalker.life.site.playerMetres).toBe(4);
      expect(walked.final.planeswalker.life.site.parcel.ordinaryMetres - walked.before.planeswalker.life.site.parcel.ordinaryMetres).toBe(4);
      expect(walked.final.random.cursor).toBe(walked.before.random.cursor + 1);
      expect(walked.final.starKey.life.pending).toBeNull();
    }
    const withdrawn = replayCaptureBoundary('withdrawn-return-mara-withdraws-current-participation');
    expect(withdrawn.final.starKey.life.pending).toBeNull();
    expect(withdrawn.final.starKey.life.cases['withdrawn-return'].attempts[0]!.permission.operator).toBe('WITHDRAWN');
    same([withdrawn.final.cash, withdrawn.final.spirituality, withdrawn.final.mind], [withdrawn.before.cash, withdrawn.before.spirituality, withdrawn.before.mind]);
    same(withdrawn.final.planeswalker.life.site.parcel, withdrawn.before.planeswalker.life.site.parcel);
    expect(life.cases['withdrawn-return'].attempts[0]!.anchor.effects).toBe(0);
    expect(life.cases['withdrawn-return'].result).toBe('ORDINARY');
    same(Object.fromEntries([['endpoint', ENDPOINT], ['anchor', ANCHOR]].map(([key, id]) => {
      const uses = STAR_KEY_CASE_IDS.flatMap(caseId => life.cases[caseId].attempts.map(a => a[key as 'endpoint' | 'anchor']));
      return [id, { attempts: sum(uses, a => a.attempts), checkSuccesses: sum(uses, a => a.successes), actualApplications: sum(uses, a => a.effects), states: uses.map(a => a.state) }];
    })), expected.lifeAbilityUse);
    expect(validateStarKeyLifeState(final)).toBe(true);
  }, 60_000);

  it('reconciles authoritative original room, Mara, actual travel, resource costs and current weekly finances', async () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), life = final.starKey.life, journal = life.journal;
    const { journal: _journal, cases: _cases, ...currentLife } = life;
    same(currentLife, expected.life); expect(captureValueHash(journal)).toBe(expected.lifeJournalSha256);
    let originals = { site: original.planeswalker.life.site };
    for (const row of journal) { same(row.originalsBefore, originals); originals = row.originalsAfter; }
    same(originals, { site: final.planeswalker.life.site }); same(originals, starKeyExpectedOriginals(final));
    expect(life.clockSeconds).toBe(original.planeswalker.life.site.elapsedSeconds + sum(journal, row => row.elapsedSeconds));
    expect(life.elapsedSeconds).toBe(sum(journal, row => row.elapsedSeconds));
    expect(life.playerTravelMetres).toBe(sum(journal, row => row.playerWalkedMetres));
    expect(life.maraTravelMetres).toBe(sum(journal, row => row.maraWalkedMetres));
    const site = final.planeswalker.life.site, oldSite = original.planeswalker.life.site;
    same(site, expected.currentOriginalSite);
    expect(site.playerMetres).toBe(oldSite.playerMetres + life.playerTravelMetres);
    expect(site.operatorMetres).toBe(oldSite.operatorMetres + life.maraTravelMetres);
    expect(site.operatorEnergy).toBe(94 - sum(journal, row => row.operatorEnergySpent));
    for (const key of ['lamp', 'screen', 'kits', 'effect'] as const) same(site[key], oldSite[key]);
    expect(site.playerAstralLegs).toBe(2); expect(site.parcel.astralLegs).toBe(2);
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', operatorLocation: 'OUTSIDE', parcel: { id: 'PW2-PARCEL', location: 'ENTRY_STAND' }, door: { state: 'CLOSED' } });
    const acquisition = final.starKey.acquisitionJournal, outcomes = finalRounds().map(r => r.starKeyOutcome!);
    const actualCosts = {
      acquisitionCash: sum(acquisition, row => row.before.cash - row.after.cash), acquisitionAP: sum(acquisition, row => row.before.actions - row.after.actions),
      lifeCash: sum(journal, row => row.before.cash - row.after.cash), lifeAP: sum(journal, row => row.before.actions - row.after.actions),
      lifeSpirituality: sum(journal, row => row.before.spirituality - row.after.spirituality), lifeMind: sum(journal, row => row.before.mind - row.after.mind),
      playerOrdinaryMetres: sum(journal, row => row.playerWalkedMetres), maraOrdinaryMetres: sum(journal, row => row.maraWalkedMetres), maraEnergy: sum(journal, row => row.operatorEnergySpent),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyOriginalMarksSpent: final.starKey.encounter.materials.marks.filter(mark => mark.status === 'SPENT').length,
      clinic: sum(naturalEntry<{ paidPennies: number }[]>('treatments'), t => t.paidPennies),
      ordinaryWorkCount: captureCommands.slice(701).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: captureCommands.slice(701).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
    };
    const { note: _note, ...expectedCosts } = expected.actualCosts; same(actualCosts, expectedCosts); same(summaryEntry('actualCosts'), expected.actualCosts);
    type Row = { step: number; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    let cash = original.cash, rows = 0, prior = captureBody(original);
    for await (const row of captureJsonLines<Row>('commands.jsonl')) if (row.step > 701) {
      same(row.before, prior); cash += row.after.cash - row.before.cash; prior = row.after; rows++;
    }
    expect(rows).toBe(expected.commandCount - 701); expect(cash).toBe(final.cash); same(prior, captureBody(final));
    const reflection = replayCaptureBoundary('three-honest-actual-reports-reflected');
    same(reflection.final.starKey.life.journal.at(-1)!.finance, starKeyFinanceSnapshot(reflection.before));
    const zeroApPromotion = replayCaptureBoundary('actual-consumption-star-key-potion-2');
    expect(zeroApPromotion.before).toMatchObject({ week: 208, actionsRemaining: 0, cash: 2610 });
    const receipt = zeroApPromotion.final.starKey.acquisitionJournal.at(-1)!;
    same(receipt.finance, starKeyFinanceSnapshot(zeroApPromotion.before));
    const settled = resolveSliceWeeklyFinance({ ...receipt.finance, week: receipt.week, revision: receipt.revision,
      cash: receipt.after.cash, pulse: 'BILL', billAmount: 0 });
    expect(settled.eventId).toBeNull(); expect(settled.state.pulse).toBe('ADVANCE');
    expect(zeroApPromotion.final.cash).toBe(settled.state.cash); expect(zeroApPromotion.final.cash).toBe(2580);
    expect(zeroApPromotion.final.week).toBe(receipt.week + 1); same(zeroApPromotion.final.date, addGameWeeks(receipt.date, 1));
    expect(zeroApPromotion.final.actionsRemaining).toBe(receipt.finance.weeklyBudget);
    same(zeroApPromotion.final.debts, settled.state.debts);
    expect(final.cash).toBe(original.cash + actualCosts.ordinaryWorkCount * original.character.weeklyWage -
      actualCosts.acquisitionCash - actualCosts.lifeCash - (final.week - original.week) * 30);
    same(starKeyFinanceSnapshot(final), expected.finalFinance);
    expect(validateStarKeyJournalContinuity(final)).toBe(true);
  }, 60_000);

  it('replays full actual combat records with ordered draws, finite original marks and separate BODY/MENTAL consequences', () => {
    const final = capturedState('final'), rounds = finalRounds(); expect(rounds).toHaveLength(expected.rounds.length);
    same(rounds.map(roundEvidence), expected.rounds);
    // The first actual round legitimately draws five enemy slots. Its typed
    // outcome admits the bounded S1 wheel without widening ordinary combat.
    const first = replayCaptureBoundary('combat-round-1');
    expect(first.count).toBe(813); expect(first.final.lastCombatRound!.enemyCount).toBe(5);
    same(first.before, migrateSliceState(readObjectEntry(`${STAR_KEY_ROOT}/prior-blocker-natural.json`, 'beforeLast')));
    same(first.final, migrateSliceState(readObjectEntry(`${STAR_KEY_ROOT}/prior-blocker-natural.json`, 'final')));
    same(captureCommands.slice(0, 813), readObjectEntry(`${STAR_KEY_ROOT}/prior-blocker-natural.json`, 'commands'));
    assertValidSliceState(first.final); same(first.final.random, { seed: 'secrets-sorcerer-directed-24', cursor: first.final.lastCombatRound!.starKeyOutcome!.randomCursorAfter });
    for (const forge of [
      (round: SliceCombatRound) => { round.enemyCount = 7; },
      (round: SliceCombatRound) => { round.moves = Array.from({ length: 13 }, () => structuredClone(round.moves[0]!)); },
      (round: SliceCombatRound) => { delete round.starKeyOutcome; },
    ]) {
      const forged = structuredClone(first.final), bad = structuredClone(forged.lastCombatRound!);
      forge(bad); forged.lastCombatRound = bad; forged.combatHistory[forged.combatHistory.length - 1] = structuredClone(bad);
      expect(() => assertValidSliceState(forged)).toThrow();
    }
    let enemyPaid = 0; const spentIds = new Set<string>();
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.starKeyOutcome!;
      same(o.source, currentStarKeyCombatSource(save.before)); same(replayStarKeyCombatRound(o.source, 'CONTROL').round, round); same(save.final.lastCombatRound, round);
      expect(o.source).toMatchObject({ targetId: 'SK1-ROWAN-VALE', targetAge: 44, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'secrets-sorcerer-directed-24' });
      expect(round.playerCount).toBe(starKeyActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(starKeyEnemyActionCount(round.enemyCountRoll));
      expect(o.playerActions.length).toBeLessThanOrEqual(round.playerCount); expect(o.enemyActions.length).toBeLessThanOrEqual(round.enemyCount);
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      same(round.moves, actions.map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })));
      let cursor = o.source.randomCursor + 2;
      for (const [index, a] of actions.entries()) {
        expect(a.atSeconds).toBe(o.source.root.clockSeconds + index * 5); expect(a.elapsedSeconds).toBe(5);
        expect(a.randomCursorBefore).toBeGreaterThanOrEqual(cursor);
        expect(a.randomCursorAfter - a.randomCursorBefore).toBe(Number(a.check !== null) + Number(a.resistanceRoll !== null)); cursor = a.randomCursorAfter;
        if (a.consumedMarkId) {
          expect(a.actor).toBe('ENEMY'); expect(a.paidCost).toBe(7); expect(['SPATIAL', 'MENTAL']).toContain(a.attackKind);
          expect(spentIds.has(a.consumedMarkId)).toBe(false); spentIds.add(a.consumedMarkId);
          expect(a.materialsBefore.marks.find(m => m.id === a.consumedMarkId)!.status).toBe('HELD');
          expect(a.materialsAfter.marks.find(m => m.id === a.consumedMarkId)!.status).toBe('SPENT');
        }
        for (const id of STAR_KEY_ABILITY_IDS) if (a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0) {
          expect([a.paidCost, a.mindCost]).toEqual([id === ENDPOINT ? 8 : 7, 2]); expect(a.masteryApplied).not.toContain(id);
        }
        if (a.masteryApplied.includes(ENDPOINT)) {
          const window = a.windowsBefore.endpointLocation!; expect(window).not.toBeNull(); expect(a.actor).toBe('PLAYER');
          expect(window.openedOrder).toBeLessThan(a.order); expect(window.expiresAt).toBeGreaterThan(a.atSeconds);
          expect(a.windowsAfter.endpointLocation).toBeNull(); expect(a.countered).toContain(window.id);
        }
        if (a.masteryApplied.includes(ANCHOR)) {
          const window = a.windowsBefore.anchorMaintenance!; expect(window).not.toBeNull(); expect(a.actor).toBe('ENEMY');
          expect(['SPATIAL', 'MENTAL']).toContain(a.attackKind); expect(window.targetActionId).toBe(a.pendingBefore!.id);
          expect(window.openedOrder).toBeLessThan(a.order); expect(window.expiresAt).toBeGreaterThan(a.atSeconds);
          expect(a.windowsAfter.anchorMaintenance).toBeNull(); expect(a.countered).toContain(window.id);
        }
      }
      expect(o.randomCursorAfter - cursor).toBe(Number(actions.at(-1)?.enemyMindAfter !== 0) + Number(round.consequenceDomain === 'BODY'));
      expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60);
      expect(o.source.playerSpirituality - o.playerSpiritualityAfter).toBe(sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - (round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      enemyPaid += sum(o.enemyActions, a => a.paidCost); expect(o.enemySpirituality).toBe(120 - enemyPaid);
      expect(o.materialsAfter.marks.filter(m => m.status === 'SPENT')).toHaveLength(spentIds.size);
      expect(o.materialsAfter.marks.filter(m => m.status === 'HELD')).toHaveLength(3 - spentIds.size);
      if (round.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined(); expect(o.playerHealthAfter).toBe(o.source.playerHealth);
        same(o.playerInjuriesAfter, o.source.playerInjuries); expect(o.playerRiskAfter).toBe(o.source.playerRisk);
      }
      same(o.windowsAfter, { endpointLocation: null, anchorMaintenance: null }); expect(o.pendingEnemyActionAfter).toBeNull();
      same(save.final.planeswalker.life.site, save.before.planeswalker.life.site);
    }
    const e = final.starKey.encounter;
    same({ status: e.status, targetId: e.targetId, terminal: e.terminal, scene: e.scene, materials: e.materials,
      enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      endpointLocation: { attempts: e.endpointLocationAttempts, successfulWindows: e.endpointLocationChecks, actualApplications: e.endpointLocationSuccesses },
      anchorMaintenance: { attempts: e.anchorMaintenanceAttempts, successfulWindows: e.anchorMaintenanceChecks, actualApplications: e.anchorMaintenanceSuccesses } }, expected.encounter);
  }, 60_000);

  it('reopens only the recorded terminal or living body, with exact ordinary exit and no fabricated death', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(captureCommands.at(-1), intent); same(applySliceIntent(before, intent), final);
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    same(final.starKey.encounter.terminal, expected.terminal);
    if (final.status === 'DEAD') {
      expect(final.health).toBe(0); expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
      expect(projectSliceState(reopened).starKey.actions.some(a => a.enabled)).toBe(false);
      expect(boundaryIndex['actual-paid-work-after-living-exit']).toBeUndefined();
      for (const blocked of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
        { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'STAR_KEY', command: { type: 'LEAVE_ENCOUNTER' } }] satisfies SliceIntent[]) {
        const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
      }
    } else {
      expect(final.status).toBe('ACTIVE'); expect(final.health).toBeGreaterThan(0);
      expect(final.starKey.encounter.terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 });
      expect(final.starKey.encounter.scene).toMatchObject({ playerLocation: 'OUTSIDE', playerCoordinate: 0 });
      const work = replayCaptureBoundary('actual-paid-work-after-living-exit');
      expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      same(final.injuries, capturedSnapshot('combatTerminal').injuries);
    }
    assertOriginalContinuity(final, capturedState('prefixFinal'));
  }, 60_000);
});
