import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { paleEmperorSourceHistory, validatePaleEmperorSource, validatePaleEmperorEraJournal,
  validatePaleEmperorFinancialContinuity, validatePaleEmperorJournalContinuity } from '../../src/domain/pale-emperor/index.js';
import { PALE_EMPEROR_ABILITY_IDS, PALE_EMPEROR_SOURCE_KEYS } from '../../src/domain/pale-emperor/types.js';
import { PALE_EMPEROR_CASE_IDS, paleEmperorLifeMasteryGains } from '../../src/domain/pale-emperor/life.js';
import { currentPaleEmperorCombatSource, replayPaleEmperorCombatRound, paleEmperorActionCount,
  paleEmperorEnemyActionCount } from '../../src/domain/pale-emperor/combat.js';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { actualPaleEmperorEvidence } from './pale-emperor-capture-evidence.js';
import { PALE_EMPEROR_ROOT, PALE_EMPEROR_SOURCE, PALE_EMPEROR_SOURCE_SHA, PALE_EMPEROR_RAW_SOURCE_STATE_SHA,
  PALE_EMPEROR_PREFIX_SHA, PALE_EMPEROR_PREFIX_COUNT, PALE_EMPEROR_RAW_ROOT_HASHES, captureFileHash, captureValueHash,
  insertionOrderHash, sourceEntry, naturalEntry, summaryEntry, captureCommands, boundaryIndex, snapshotIndex,
  capturedState, capturedSnapshot, replayCaptureBoundary, assertPublicCaptureControl, assertEraTransition,
  captureBody, sameCaptureValue as same, FULL_CAPTURE_REPLAY_TIMEOUT, PALE_EMPEROR_GUIDANCE_REPLAY_DIFF, namedBoundary,
  currentPaleEmperorGuidanceBoundaryExpected, currentPaleEmperorFullReplayExpected, expectedPaleEmperorBoundaryReplay } from './pale-emperor-capture-helper.js';

const expected = actualPaleEmperorEvidence();
const [QUIETING, INTERDICTION] = PALE_EMPEROR_ABILITY_IDS;
const finalRounds = () => capturedState('final').combatHistory.slice(capturedState('prefixFinal').combatHistory.length);
const checkRows = (s: SliceState) => s.paleEmperor.acquisitionJournal.filter(row => row.check)
  .map(row => [row.command, row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const lifeCheckRows = (s: SliceState) => s.paleEmperor.life.journal.filter(row => row.check)
  .map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const withoutEra = (s: SliceState) => { const { era: _era, ...history } = s.ferryman; return history; };
function assertOriginalHistory(s: SliceState, original: SliceState): void {
  for (const key of PALE_EMPEROR_SOURCE_KEYS) same(key === 'ferryman' ? withoutEra(s) : s[key], key === 'ferryman' ? withoutEra(original) : original[key]);
  same(s.town, original.town); same(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  same({ ...s.character, coreStats: original.character.coreStats }, original.character);
  expect(s.runId).toBe(original.runId); expect(s.random.seed).toBe(original.random.seed);
  expect(s.progression.promotionWeek).toBe(5); expect(s.deathConsul.promotionWeek).toBe(3284);
  for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(original.character.coreStats[key] + Number(s.progression.sequence === 1));
}
function roundEvidence(round: SliceCombatRound) {
  const o = round.paleEmperorOutcome!;
  return { round: round.round, stance: round.stance, first: round.first,
    countWheels: { playerRoll: round.playerCountRoll, playerCount: round.playerCount, enemyRoll: round.enemyCountRoll, enemyCount: round.enemyCount },
    consequenceDomain: o.consequenceDomain, consequenceRoll: round.consequenceRoll ?? null,
    random: [o.source.randomCursor, o.randomCursorAfter], outcomeSha256: captureValueHash(o),
    result: { playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter, playerSpirituality: o.playerSpiritualityAfter,
      playerRisk: o.playerRiskAfter, enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality,
      enemyStatus: o.enemyStatus, actualPlayerActions: o.playerActions.length, actualEnemyActions: o.enemyActions.length },
    actions: [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order).map(a =>
      [a.order, a.actor, a.planned, a.selectedAbility, a.paidCost, a.mindCost, a.check && [a.check.roll, a.check.chance, a.check.tier],
        a.resistanceRoll, a.finiteResult, a.masteryApplied, a.spiritMarksSpent]) };
}

describe('Pale Emperor complete815-command original and actual public continuation', () => {
  it('pins raw170 history and raw192 capture separately from explicit current migration', async () => {
    expect(await captureFileHash(PALE_EMPEROR_SOURCE)).toBe(PALE_EMPEROR_SOURCE_SHA);
    expect(await captureFileHash(`${PALE_EMPEROR_ROOT}/natural.json`)).toBe(expected.naturalSha256);
    expect(await captureFileHash('scripts/play/pale-emperor-stage.mjs')).toBe(expected.producerSha256);
    const raw = sourceEntry<SliceState>('final');
    expect(raw).toMatchObject({ schemaVersion: 170, contentVersion: 'death-consul-v170', revision: 816, status: 'ACTIVE', week: 3290,
      health: 20, mind: 100, spirituality: 95, cash: 34, actionsRemaining: 1, injuryRisk: 6,
      random: { seed: 'corpsecollector-natural-v032', cursor: 359 }, date: { epoch: 'FIFTH_EPOCH', year: 1412, month: 7, day: 15 } });
    expect(insertionOrderHash(raw)).toBe(PALE_EMPEROR_RAW_SOURCE_STATE_SHA);
    for (const [key, hash] of Object.entries(PALE_EMPEROR_RAW_ROOT_HASHES)) expect(insertionOrderHash(raw[key as keyof typeof PALE_EMPEROR_RAW_ROOT_HASHES]), key).toBe(hash);
    expect(naturalEntry('final')).toMatchObject({ schemaVersion: 192, contentVersion: 'pale-emperor-v192' });
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), migrateSliceState(raw)); expect(naturalEntry('producerSha256')).toBe(expected.producerSha256);
  }, 120_000);

  it('permits only the exact reviewed guidance wording delta and rejects altered or already-current evidence', () => {
    const diff = PALE_EMPEROR_GUIDANCE_REPLAY_DIFF, save = namedBoundary('actual120p-guidance-frozen-eight-stages-and-long-history');
    const boundaryHash = captureValueHash(save.final), oldFinal = capturedState('final'), finalHash = captureValueHash(oldFinal);
    const boundaryExpected = expectedPaleEmperorBoundaryReplay(save), fullExpected = currentPaleEmperorFullReplayExpected(oldFinal);
    same(boundaryExpected.chronicle[diff.index], { id: diff.id, week: diff.week, title: diff.title, text: diff.currentText });
    same(boundaryExpected.lastResult, boundaryExpected.chronicle[diff.index]);
    same(fullExpected.chronicle[diff.index], boundaryExpected.chronicle[diff.index]);
    same(fullExpected.lastResult, oldFinal.lastResult);
    // Put back exactly the named record (and its boundary lastResult alias),
    // then compare every other private/public field, RNG and historical root.
    const restoredBoundary = structuredClone(boundaryExpected), restoredFinal = structuredClone(fullExpected);
    restoredBoundary.chronicle[diff.index] = structuredClone(save.final.chronicle[diff.index]!);
    restoredBoundary.lastResult = structuredClone(save.final.lastResult);
    restoredFinal.chronicle[diff.index] = structuredClone(oldFinal.chronicle[diff.index]!);
    same(restoredBoundary, save.final); same(restoredFinal, oldFinal);
    expect(captureValueHash(save.final)).toBe(boundaryHash); expect(captureValueHash(oldFinal)).toBe(finalHash);
    same(migrateSliceState(save.final), save.final); same(migrateSliceState(oldFinal), oldFinal);
    for (const change of [
      (s: SliceState) => { s.chronicle[diff.index]!.text += 'wrong text'; },
      (s: SliceState) => { s.chronicle[diff.index]!.id = 'wrong-id'; },
      (s: SliceState) => { s.chronicle[diff.index]!.title += 'wrong title'; },
      (s: SliceState) => { s.chronicle[diff.index]!.week++; },
      (s: SliceState) => { s.revision++; },
      (s: SliceState) => { s.paleEmperor.acquisitionJournal[0]!.revision++; },
      (s: SliceState) => { s.chronicle[diff.index - 1] = structuredClone(s.chronicle[diff.index]!); },
    ]) {
      const boundary = structuredClone(save.final), final = structuredClone(oldFinal); change(boundary); change(final);
      expect(() => currentPaleEmperorGuidanceBoundaryExpected(boundary), change.toString()).toThrow();
      expect(() => currentPaleEmperorFullReplayExpected(final), change.toString()).toThrow();
    }
    const badLastResult = structuredClone(save.final); badLastResult.lastResult!.text += 'wrong text';
    expect(() => currentPaleEmperorGuidanceBoundaryExpected(badLastResult)).toThrow();
    expect(() => currentPaleEmperorGuidanceBoundaryExpected(boundaryExpected)).toThrow();
    expect(() => currentPaleEmperorFullReplayExpected(fullExpected)).toThrow();
    expect(() => expectedPaleEmperorBoundaryReplay({ ...save, count: save.count + 1 })).toThrow();
    expect(() => expectedPaleEmperorBoundaryReplay({ ...save, before: { ...save.before, revision: save.before.revision + 1 } })).toThrow();
    const last = { before: capturedState('beforeLast'), intent: captureCommands.at(-1)!, final: oldFinal, count: expected.commandCount };
    expect(expectedPaleEmperorBoundaryReplay(last)).toBe(oldFinal);
  }, 120_000);

  it('replays all1038 real commands, every public continuation control, current body and old roots', () => {
    const sourceCommands = sourceEntry<SliceIntent[]>('commands');
    expect(sourceCommands).toHaveLength(PALE_EMPEROR_PREFIX_COUNT); expect(captureCommands).toHaveLength(expected.commandCount);
    same(captureCommands.slice(0, PALE_EMPEROR_PREFIX_COUNT), sourceCommands);
    expect(insertionOrderHash(captureCommands.slice(0, PALE_EMPEROR_PREFIX_COUNT))).toBe(PALE_EMPEROR_PREFIX_SHA);
    expect(naturalEntry('prefixCount')).toBe(PALE_EMPEROR_PREFIX_COUNT); expect(naturalEntry('prefixVerified')).toBe(true);
    same(naturalEntry('creation'), sourceEntry('creation')); expect(naturalEntry('seed')).toBe('corpsecollector-natural-v032');
    expect(naturalEntry('provenance')).toEqual({ kind: 'SAME_SEED_COMPLETE815_COMMAND_ACTUAL_LIVING_SOURCE', source: PALE_EMPEROR_SOURCE,
      sourceSha256: PALE_EMPEROR_SOURCE_SHA, sourceRoot: 'final', rawSourceStateSha256: PALE_EMPEROR_RAW_SOURCE_STATE_SHA,
      rawSchemaVersion: 170, rawContentVersion: 'death-consul-v170', entireOriginalPrefixPreserved: true,
      oldOwenHistoricalAvailablePreserved: true, oldNolanRetreatPreserved: true, experiencedCycles: 1, noNewSeedOrRandomEdits: true });
    expect(naturalEntry('strategy')).toMatchObject({ caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL',
      combatRoundCap: 90, potionAttemptCap: 12, potionLabourSteps: 5, currentEra: 'FERRYMAN_ERA_WORK_REST_CARE_NEXT_WEEK_ONLY',
      recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true } });
    const original = capturedState('prefixFinal');
    let state = createSliceRun(original.runId, naturalEntry<Parameters<typeof createSliceRun>[1]>('creation'), naturalEntry<string>('seed'));
    let history: SliceState['paleEmperor']['sourceHistory'] = null, scene: SliceState['paleEmperor']['sourceScene'] = null;
    same(state, capturedState('initial'));
    for (const [index, intent] of captureCommands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(PALE_EMPEROR_PREFIX_COUNT); expect(state.status).toBe('SLICE_COMPLETE');
        expect(state.ending).not.toBeNull(); expect(state.ending!.kind).not.toBe('DEATH'); expect(state.caseArchive).toHaveLength(0);
      } else expect(state.status, `No post-terminal continuation at command ${index + 1}`).toBe('ACTIVE');
      if (index >= PALE_EMPEROR_PREFIX_COUNT) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe('corpsecollector-natural-v032');
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === PALE_EMPEROR_PREFIX_COUNT - 1) same(state, original);
      if (index >= PALE_EMPEROR_PREFIX_COUNT) {
        assertEraTransition(before, intent, state); assertOriginalHistory(state, original);
        if (state.paleEmperor.guidanceKnown) {
          history ??= structuredClone(state.paleEmperor.sourceHistory); scene ??= structuredClone(state.paleEmperor.sourceScene);
          same(state.paleEmperor.sourceHistory, history); same(state.paleEmperor.sourceScene, scene);
        }
      }
    }
    same(state, currentPaleEmperorFullReplayExpected(capturedState('final'))); assertValidSliceState(state); same(migrateSliceState(state), state);
    same(captureBody(state), expected.final); expect(state.revision).toBe(capturedState('initial').revision + expected.commandCount);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
    same(naturalEntry('continuationSource'), expected.continuationSource); same(naturalEntry('captureBudget'), expected.captureBudget);
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames); expect(Object.keys(snapshotIndex)).toEqual(expected.snapshots);
  }, FULL_CAPTURE_REPLAY_TIMEOUT);

  it('pays one actual60p care for both heavy wounds, then later paid rests heal the original body', () => {
    const original = capturedState('prefixFinal');
    expect(original.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    const treatment = replayCaptureBoundary('actual-current-era-60p-care-without-healing');
    expect(treatment.intent).toEqual({ type: 'FERRYMAN', command: { type: 'ERA_CARE' } });
    assertEraTransition(treatment.before, treatment.intent, treatment.final);
    same(treatment.before.injuries, original.injuries); expect(treatment.final.injuries).toHaveLength(4);
    expect(treatment.final.health).toBe(20); expect(treatment.final.injuryRisk).toBe(6);
    const recovered = capturedSnapshot('recoveredOriginalInjuries');
    expect(recovered).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0, seer: { pollution: 0 } });
    expect(recovered.revision).toBeGreaterThan(treatment.final.revision);
    expect(captureCommands.slice(treatment.count, recovered.revision - capturedState('initial').revision)
      .some(i => i.type === 'FERRYMAN' && i.command.type === 'ERA_REST')).toBe(true);
    same(naturalEntry('treatments'), expected.treatments); assertOriginalHistory(recovered, original);
  }, 180_000);

  it('keeps the17 original skills, five original zeros, historical people and only two new zero skills', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final'), promoted = capturedSnapshot('promoted');
    expect(Object.keys(original.progression.mastery)).toHaveLength(17); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(original.character).toMatchObject({ name: '伊莲', gender: 'FEMALE', age: 26, coreStats: { physique: 32, perception: 28, will: 26, knowledge: 22 } });
    expect(final.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, status: 'RESISTING' } });
    expect(final.undying.lifecycle.experiencedCycles).toBe(1);
    expect(final.deathConsul.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 80, enemySpirituality: 46, enemyStatus: 'RESISTING' });
    expect(final.deathConsul.encounter.enemyInjuries).toHaveLength(2);
    expect(final.deathConsul.life.site).toMatchObject({ operatorLocation: 'OUTSIDE', operatorEnergy: 94,
      door: { state: 'OPEN', operations: 17 }, residual: { strength: 1, scorch: 1 }, material: { remaining: 0 } });
    assertOriginalHistory(final, original); same(final.paleEmperor.sourceScene!.originals, original.deathConsul.life.site);
    const currentHistory = paleEmperorSourceHistory(final); currentHistory.ferryman.era = structuredClone(final.paleEmperor.sourceHistory!.ferryman.era);
    same(currentHistory, final.paleEmperor.sourceHistory); same(promoted.paleEmperor.sourceHistory, final.paleEmperor.sourceHistory);
    same(promoted.paleEmperor.sourceScene, final.paleEmperor.sourceScene);
    expect(insertionOrderHash(final.paleEmperor.sourceHistory)).toBe(expected.sourceHistorySha256);
    expect(insertionOrderHash(final.paleEmperor.sourceScene)).toBe(expected.sourceSceneSha256);
    expect(Object.keys(promoted.progression.mastery)).toHaveLength(19); expect(PALE_EMPEROR_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    const mastery = { ...original.progression.mastery, [QUIETING]: 0, [INTERDICTION]: 0 };
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(value);
    for (const [id, gain] of Object.entries(paleEmperorLifeMasteryGains(final))) mastery[id] = Math.min(500, mastery[id]! + gain);
    for (const round of finalRounds()) for (const action of [...round.paleEmperorOutcome!.playerActions, ...round.paleEmperorOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
    same(final.progression.mastery, mastery); expect(Object.keys(mastery)).toHaveLength(19);
    expect(Object.values(mastery).filter(n => n === 0)).toHaveLength(7); expect([mastery[QUIETING], mastery[INTERDICTION]]).toEqual([0, 0]);
    expect(validatePaleEmperorSource(final)).toBe(true);
  }, 180_000);

  it('preserves the two failed bottles before the third success and all real labour, recovery and draws', () => {
    const final = capturedState('final'), journal = final.paleEmperor.acquisitionJournal;
    const guidance = replayCaptureBoundary('actual120p-guidance-frozen-eight-stages-and-long-history');
    expect(guidance.before.cash - guidance.final.cash).toBe(120); expect(guidance.final.paleEmperor.sourceEra).toBe('POST_CYCLE');
    same(checkRows(final), expected.acquisitionChecks); same(final.paleEmperor.bottles, expected.bottles);
    const consumed = final.paleEmperor.bottles.filter(b => b.status === 'CONSUMED');
    expect(consumed.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
    for (const bottle of consumed) {
      const buy = replayCaptureBoundary(`actual80p-buy-${bottle.id}`), preparation = replayCaptureBoundary(`actual20p-current-week-preparation-${bottle.id}`);
      const dose = replayCaptureBoundary(`actual-consume-${bottle.id}`);
      expect(buy.before.cash - buy.final.cash).toBe(80); expect(preparation.before.cash - preparation.final.cash).toBe(20);
      expect(journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0, seer: { pollution: 0 } });
      expect(dose.before.paleEmperor.preparedWeek).toBe(dose.before.week); expect(dose.final.paleEmperor.preparedWeek).toBeNull();
      expect(dose.before.week - dose.before.deathConsul.promotionWeek!).toBeGreaterThanOrEqual(12);
      same(dose.final.paleEmperor.bottles.find(b => b.id === bottle.id), bottle); expect(bottle.labourSteps).toBe(5);
      expect(dose.final.random.cursor - dose.before.random.cursor).toBe(1);
      const cost = bottle.outcome === 'FAILURE' ? [15, 25, 30] : [0, 15, 0];
      expect([dose.final.health, dose.final.mind, dose.final.seer.pollution]).toEqual([100 - cost[0]!, 100 - cost[1]!, cost[2]!]);
      expect(dose.final.spirituality).toBe(dose.before.spirituality); same(dose.final.injuries, dose.before.injuries);
      for (const [id, value] of Object.entries(dose.before.progression.mastery)) expect(dose.final.progression.mastery[id], id).toBe(value);
      expect(() => applySliceIntent(dose.final, dose.intent)).toThrow();
    }
    expect(journal.filter(row => row.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(final.paleEmperor.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
  }, 300_000);

  it('records all three paid failed casts, ordinary fallbacks and honest reports without inventing effects', () => {
    const final = capturedState('final'), life = final.paleEmperor.life;
    same(lifeCheckRows(final), expected.lifeChecks); same(life.cases, expected.lifeCases);
    for (const caseId of PALE_EMPEROR_CASE_IDS) {
      const cast = replayCaptureBoundary(`${caseId}-one-paid-window-attempt`), use = caseId === 'quiet-lid' ? 'quieting' : 'interdiction';
      const id = caseId === 'quiet-lid' ? QUIETING : INTERDICTION;
      expect(cast.final.lastCheck?.tier).toBe('FAILURE'); expect(cast.final.paleEmperor.life.pending).toBeNull();
      expect(cast.before.spirituality - cast.final.spirituality).toBe(use === 'quieting' ? 8 : 7);
      expect(cast.before.mind - cast.final.mind).toBe(2); expect(cast.final.random.cursor - cast.before.random.cursor).toBe(1);
      expect(cast.final.paleEmperor.life.cases[caseId].attempts[0]![use]).toMatchObject({ attempts: 1, successes: 0, effects: 0, state: 'FAILED' });
      expect(cast.final.progression.mastery[id]).toBe(0);
      const report = replayCaptureBoundary(`${caseId}-honest-report-of-actual-applications-and-failures`);
      expect(report.final.paleEmperor.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', method: 'ABILITY', result: 'ORDINARY', returned: true });
      expect(report.final.progression.mastery[id]).toBe(0);
    }
    expect(replayCaptureBoundary('quiet-lid-actual-lid-action-or-ordinary-fallback').intent).toEqual({ type: 'PALE_EMPEROR', command: { type: 'ORDINARY_FIT' } });
    expect(replayCaptureBoundary('guarded-carry-actual4m-carry-or-ordinary-fallback').intent).toEqual({ type: 'PALE_EMPEROR', command: { type: 'SCREENED_CARRY' } });
    const withdrawal = replayCaptureBoundary('withdrawn-return-actual-current-withdrawal-no-refund');
    expect(withdrawal.final.paleEmperor.life.cases['withdrawn-return'].attempts[0]!.permission.custodian).toBe('WITHDRAWN');
    expect(withdrawal.final.paleEmperor.life.pending).toBeNull(); expect(withdrawal.final.cash).toBe(withdrawal.before.cash);
    const returned = replayCaptureBoundary('withdrawn-return-screened-same-vessel4m-return-no-new-seal');
    expect(returned.intent).toEqual({ type: 'PALE_EMPEROR', command: { type: 'MANUAL_RETURN' } });
    same(returned.final.paleEmperor.life.site!.seals, returned.before.paleEmperor.life.site!.seals);
    same(Object.fromEntries([['quieting', QUIETING], ['interdiction', INTERDICTION]].map(([key, id]) => {
      const uses = PALE_EMPEROR_CASE_IDS.flatMap(caseId => life.cases[caseId].attempts.map(a => a[key as 'quieting' | 'interdiction']));
      return [id, { actualCasts: sum(uses, a => a.attempts), successfulWindows: sum(uses, a => a.successes), actualApplications: sum(uses, a => a.effects), states: uses.map(a => a.state) }];
    })), expected.lifeAbilityUse);
  }, 300_000);

  it('keeps the same vessel, two finite seals, Nora, real movement and the complete current-era ledger', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), l = final.paleEmperor.life;
    const { journal, cases: _cases, ...life } = l; same(life, expected.life);
    expect(captureValueHash(journal)).toBe(expected.lifeJournalSha256); expect(captureValueHash(final.paleEmperor.eraJournal)).toBe(expected.eraJournalSha256);
    expect(l.clockSeconds).toBe(sum(journal, row => row.elapsedSeconds)); expect(l.elapsedSeconds).toBe(l.clockSeconds);
    expect(l.playerTravelMetres).toBe(sum(journal, row => row.playerWalkedMetres));
    let site: typeof l.site = null;
    for (const row of journal) { same(row.siteBefore, site); site = row.siteAfter; }
    same(l.site, site); expect(l.site!.vessel).toMatchObject({ id: 'PE1-VESSEL-1', quantity: 1, nature: 'NON_SENTIENT_RESIDUAL', holder: 'ANNEX', location: 'NEAR' });
    expect(l.site!.vessel.travelledMetres).toBe(sum(journal, row => row.vesselCarriedMetres));
    expect(l.site!.seals.map(seal => [seal.id, seal.price, seal.state])).toEqual([['PE1-SEAL-1', 4, 'USED'], ['PE1-SEAL-2', 4, 'USED']]);
    expect(journal.filter(row => row.command.type === 'BUY_SEALS')).toHaveLength(1); expect(journal.filter(row => row.command.type === 'RESEAL')).toHaveLength(2);
    expect(l.nora).toMatchObject({ id: 'PE1-NORA', name: '诺拉·贝尔', alive: true, age: 42, present: false, location: 'AWAY' });
    expect(l.nora!.energy).toBe(100 - sum(journal, row => row.noraEnergySpent)); expect(l.nora!.travelMetres).toBe(sum(journal, row => row.noraWalkedMetres));
    const acquisition = final.paleEmperor.acquisitionJournal, outcomes = finalRounds().map(r => r.paleEmperorOutcome!);
    const actualCosts = { acquisitionCash: sum(acquisition, row => row.before.cash - row.after.cash), acquisitionAP: sum(acquisition, row => row.before.actions - row.after.actions),
      lifeCash: sum(journal, row => row.before.cash - row.after.cash), lifeAP: sum(journal, row => row.before.actions - row.after.actions),
      lifeSpirituality: sum(journal, row => row.before.spirituality - row.after.spirituality), lifeMind: sum(journal, row => row.before.mind - row.after.mind),
      playerWalkedMetres: sum(journal, row => row.playerWalkedMetres), noraWalkedMetres: sum(journal, row => row.noraWalkedMetres), noraEnergy: sum(journal, row => row.noraEnergySpent),
      vesselCarriedMetres: sum(journal, row => row.vesselCarriedMetres), lifeSeconds: sum(journal, row => row.elapsedSeconds),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyMarksSpent: sum(outcomes.flatMap(o => o.enemyActions), a => a.spiritMarksSpent),
      clinic: sum(naturalEntry<{ paidPennies: number }[]>('treatments'), t => t.paidPennies),
      era: Object.fromEntries((['works', 'rests', 'weeksAdvanced', 'income', 'expenses', 'emergencyWorks', 'treatments'] as const).map(key => [key, final.ferryman.era[key] - original.ferryman.era[key]])) };
    const { note: _note, ...expectedCosts } = expected.actualCosts; same(actualCosts, expectedCosts); same(summaryEntry('actualCosts'), expected.actualCosts);
    expect(final.cash).toBe(original.cash + Number((actualCosts.era as Record<string, number>).income) - Number((actualCosts.era as Record<string, number>).expenses) - actualCosts.acquisitionCash - actualCosts.lifeCash);
    expect(validatePaleEmperorEraJournal(final)).toBe(true); expect(validatePaleEmperorFinancialContinuity(final)).toBe(true); expect(validatePaleEmperorJournalContinuity(final)).toBe(true);
  }, 180_000);

  it('replays all12 actual rounds, ordered draws and independent BODY/MENTAL consequences', () => {
    const final = capturedState('final'), rounds = finalRounds(); expect(rounds).toHaveLength(expected.rounds.length);
    same(rounds.map(roundEvidence), expected.rounds);
    let enemyPaid = 0, marks = 0;
    const spentIds = new Set<string>();
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.paleEmperorOutcome!;
      same(o.source, currentPaleEmperorCombatSource(save.before)); same(replayPaleEmperorCombatRound(o.source, 'CONTROL').round, round); same(save.final.lastCombatRound, round);
      expect(o.source).toMatchObject({ targetId: 'PE1-ALDEN-WARD', targetAge: 47, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clubHeld: false, randomSeed: 'corpsecollector-natural-v032' });
      expect(round.playerCount).toBe(paleEmperorActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(paleEmperorEnemyActionCount(round.enemyCountRoll));
      expect(o.playerActions.length).toBeLessThanOrEqual(round.playerCount); expect(o.enemyActions.length).toBeLessThanOrEqual(round.enemyCount);
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      same(round.moves, actions.map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })));
      let cursor = o.source.randomCursor + 2;
      for (const [index, a] of actions.entries()) {
        expect(a.atSeconds).toBe(o.source.root.clockSeconds + index * 5); expect(a.elapsedSeconds).toBe(5);
        expect(a.randomCursorBefore).toBeGreaterThanOrEqual(cursor); expect(a.randomCursorAfter - a.randomCursorBefore).toBe(Number(a.check !== null) + Number(a.resistanceRoll !== null)); cursor = a.randomCursorAfter;
        expect(a.materialsBefore.marks.remaining - a.materialsAfter.marks.remaining).toBe(a.spiritMarksSpent);
        if (a.spiritMarksSpent) { expect(a.actor).toBe('ENEMY'); expect(a.spiritMarksSpent).toBe(1); expect(a.spiritMarkId).not.toBeNull(); expect(spentIds.has(a.spiritMarkId!)).toBe(false); spentIds.add(a.spiritMarkId!); }
        for (const [id, key] of [[QUIETING, 'residualQuieting'], [INTERDICTION, 'spiritualInterdiction']] as const) {
          if (a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0) { expect([a.paidCost, a.mindCost]).toEqual([id === QUIETING ? 8 : 7, 2]); expect(a.masteryApplied).not.toContain(id); }
          if (a.masteryApplied.includes(id)) {
            const window = a.windowsBefore[key]!; expect(window).not.toBeNull(); expect(window.openedOrder).toBeLessThan(a.order);
            expect(window.expiresAt).toBeGreaterThan(a.atSeconds); expect(a.attackKind).toBe('MENTAL'); expect(a.sourceEffectId).toBe('PE1-ALDEN-SPIRIT-LINE');
            expect(a.windowsAfter[key]).toBeNull(); expect(a.countered).toContain(window.id);
          }
        }
      }
      expect(o.randomCursorAfter - cursor).toBe(Number(actions.at(-1)?.enemyMindAfter !== 0) + Number(o.consequenceDomain === 'BODY'));
      expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60);
      expect(o.source.playerSpirituality - o.playerSpiritualityAfter).toBe(sum(o.playerActions, a => a.paidCost));
      expect(o.playerMindAfter).toBe(Math.max(0, o.source.playerMind - sum(o.playerActions, a => a.mindCost) - (round.winner === 'ENEMY' && o.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      enemyPaid += sum(o.enemyActions, a => a.paidCost); marks += sum(o.enemyActions, a => a.spiritMarksSpent);
      expect(o.enemySpirituality).toBe(120 - enemyPaid); expect(o.materialsAfter.marks.remaining).toBe(3 - marks);
      expect(o.materialsAfter.marks.pieces.filter(p => p.state === 'SPENT')).toHaveLength(marks);
      if (o.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined(); expect(o.playerHealthAfter).toBe(o.source.playerHealth);
        same(o.playerInjuriesAfter, o.source.playerInjuries); expect(o.playerRiskAfter).toBe(o.source.playerRisk);
      }
    }
    const e = final.paleEmperor.encounter;
    same({ status: e.status, terminal: e.terminal, scene: e.scene, materials: e.materials,
      enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries,
      powerUses: e.powerUses, inheritedApplications: e.inheritedApplications,
      residualQuieting: { actualCasts: e.residualQuietingAttempts, successfulWindows: e.residualQuietingChecks, actualApplications: e.residualQuietingSuccesses },
      spiritualInterdiction: { actualCasts: e.spiritualInterdictionAttempts, successfulWindows: e.spiritualInterdictionChecks, actualApplications: e.spiritualInterdictionSuccesses } }, expected.encounter);
    expect(e).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', enemySpirituality: 72, inheritedApplications: {},
      residualQuietingAttempts: 0, residualQuietingChecks: 0, residualQuietingSuccesses: 0,
      spiritualInterdictionAttempts: 0, spiritualInterdictionChecks: 0, spiritualInterdictionSuccesses: 0 });
  }, Math.max(180_000, expected.rounds.length * 20_000));

  it('reopens the actual living injured body after16m exit and24p work, never fabricating a death or recovery', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(captureCommands.at(-1), intent); same(applySliceIntent(before, intent), final);
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    const terminal = final.paleEmperor.encounter.terminal;
    if (final.status === 'DEAD') {
      expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
      expect(projectSliceState(reopened).paleEmperor.actions.some(a => a.enabled)).toBe(false);
      expect(boundaryIndex['actual-current-era-paid-work-after-living16m-exit']).toBeUndefined();
      expect(terminal).toMatchObject({ outcome: 'PLAYER_DEAD', exitMetres: 0, exitSeconds: 0, roadExitMetres: 0, roadExitSeconds: 0 });
      for (const blocked of [{ type: 'FERRYMAN', command: { type: 'ERA_WORK' } }, { type: 'FERRYMAN', command: { type: 'ERA_REST' } },
        { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'PALE_EMPEROR', command: { type: 'LEAVE_ENCOUNTER' } }] satisfies SliceIntent[]) {
        const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
      }
    } else {
      expect(terminal).toMatchObject({ outcome: 'ENEMY_DEAD', exitMetres: 4, exitSeconds: 4, roadExitMetres: 12, roadExitSeconds: 12 });
      expect(final.paleEmperor.encounter.scene).toMatchObject({ playerLocation: 'OUTSIDE', playerCoordinate: 0, roadTravelMetres: 24 });
      const work = replayCaptureBoundary('actual-current-era-paid-work-after-living16m-exit');
      expect(work.intent).toEqual({ type: 'FERRYMAN', command: { type: 'ERA_WORK' } }); assertEraTransition(work.before, work.intent, work.final);
      expect(final.health).toBe(50); expect(final.injuryRisk).toBe(2); expect(final.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null]]);
      same(final.injuries, capturedSnapshot('combatTerminal').injuries);
    }
    assertOriginalHistory(final, capturedState('prefixFinal'));
  }, 180_000);
});
