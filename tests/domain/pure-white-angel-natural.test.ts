import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validatePureWhiteAngelSource } from '../../src/domain/pure-white-angel/index.js';
import { PURE_WHITE_ANGEL_ABILITY_IDS, PURE_WHITE_ANGEL_SOURCE_KEYS } from '../../src/domain/pure-white-angel/types.js';
import { PURE_WHITE_ANGEL_CASE_IDS, pureWhiteAngelExpectedOriginals, pureWhiteAngelLifeMasteryGains } from '../../src/domain/pure-white-angel/life.js';
import { pureWhiteAngelEncounterOriginalEvents } from '../../src/domain/pure-white-angel/encounter.js';
import { currentPureWhiteAngelCombatSource, replayPureWhiteAngelCombatRound, pureWhiteAngelActionCount,
  pureWhiteAngelEnemyActionCount } from '../../src/domain/pure-white-angel/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { actualPureWhiteAngelEvidence } from './pure-white-angel-capture-evidence.js';
import { PURE_WHITE_ROOT, PURE_WHITE_SOURCE, PURE_WHITE_SOURCE_SHA, PURE_WHITE_RAW_SOURCE_STATE_SHA, PURE_WHITE_PREFIX_SHA,
  PURE_WHITE_PREFIX_COUNT, captureFileHash, captureValueHash, sourceEntry, naturalEntry, captureCommands, boundaryIndex,
  snapshotIndex, capturedState, capturedSnapshot, namedBoundary, replayCaptureBoundary, assertPublicCaptureControl, currentGuidanceCaptureExpected,
  sameCaptureValue as same, FULL_CAPTURE_REPLAY_TIMEOUT } from './pure-white-angel-capture-helper.js';

const expected = actualPureWhiteAngelEvidence();
const [FOCUSED, GUARD] = PURE_WHITE_ANGEL_ABILITY_IDS;
const finalRounds = () => capturedState('final').combatHistory.slice(capturedState('prefixFinal').combatHistory.length);
const checkRows = (state: SliceState) => state.pureWhiteAngel.acquisitionJournal.filter(row => row.check)
  .map(row => [row.command, row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);
const lifeCheckRows = (state: SliceState) => state.pureWhiteAngel.life.journal.filter(row => row.check)
  .map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]);

describe('Pure White Angel complete729-command original public continuation', () => {
  it('pins raw169 source and raw191 capture separately from explicit current migration', async () => {
    expect(await captureFileHash(PURE_WHITE_SOURCE)).toBe(PURE_WHITE_SOURCE_SHA);
    expect(await captureFileHash(`${PURE_WHITE_ROOT}/natural.json`)).toBe(expected.naturalSha256);
    expect(await captureFileHash(`${PURE_WHITE_ROOT}/boundaries.index.json`)).toBe(expected.boundaryIndexSha256);
    const raw = sourceEntry<SliceState>('final');
    expect(raw).toMatchObject({ schemaVersion: 169, contentVersion: 'light-seeker-v169', revision: 730, status: 'ACTIVE', week: 175,
      health: 50, mind: 100, spirituality: 87, cash: 540, actionsRemaining: 3, injuryRisk: 3,
      random: { seed: 'bard-natural-v029', cursor: 356 } });
    expect(captureValueHash(raw)).toBe(PURE_WHITE_RAW_SOURCE_STATE_SHA);
    expect(naturalEntry('final')).toMatchObject({ schemaVersion: 191, contentVersion: 'pure-white-angel-v191' });
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), migrateSliceState(raw));
    expect(naturalEntry('producerSha256')).toBe(expected.producerSha256);
  }, 120_000);

  it('limits the current guidance expectation to its exact original command record and preserves capture bytes', () => {
    const guidance = namedBoundary('actual500p-guidance-and-frozen-eight-root-source');
    expect([guidance.count, guidance.before.revision, guidance.final.revision]).toEqual([743, 743, 744]);
    expect(captureCommands[742]).toEqual({ type: 'PURE_WHITE_ANGEL', command: { type: 'LEARN_GUIDANCE' } });
    for (const original of [guidance.final, capturedState('final')]) {
      const originalHash = captureValueHash(original);
      const aligned = currentGuidanceCaptureExpected(original);
      expect(aligned.chronicle[1160]!.text).not.toBe(original.chronicle[1160]!.text);
      same({
        ...aligned,
        chronicle: aligned.chronicle.map((entry, index) => index === 1160 ? { ...entry, text: original.chronicle[index]!.text } : entry),
        lastResult: original.revision === 744 ? { ...aligned.lastResult!, text: original.lastResult!.text } : aligned.lastResult,
      }, original);
      expect(captureValueHash(original)).toBe(originalHash);
    }
    expect(() => currentGuidanceCaptureExpected({ ...guidance.final, revision: 745 })).toThrow();
    const changed = structuredClone(guidance.final);
    changed.chronicle[1160]!.text += 'unexpected';
    expect(() => currentGuidanceCaptureExpected(changed)).toThrow();
    expect(() => same({ random: { cursor: 1 } }, { random: { cursor: 2 } })).toThrow('Capture byte mismatch: actual SHA-256');
  }, 120_000);

  it('replays every actual command in order and exposes every continuation control publicly', () => {
    const sourceCommands = sourceEntry<SliceIntent[]>('commands');
    expect(sourceCommands).toHaveLength(PURE_WHITE_PREFIX_COUNT);
    expect(captureCommands).toHaveLength(expected.commandCount);
    same(captureCommands.slice(0, PURE_WHITE_PREFIX_COUNT), sourceCommands);
    expect(captureValueHash(captureCommands.slice(0, PURE_WHITE_PREFIX_COUNT))).toBe(PURE_WHITE_PREFIX_SHA);
    expect(naturalEntry('prefixCount')).toBe(PURE_WHITE_PREFIX_COUNT); expect(naturalEntry('prefixVerified')).toBe(true);
    same(naturalEntry('creation'), sourceEntry('creation')); expect(naturalEntry('seed')).toBe('bard-natural-v029');
    expect(naturalEntry('provenance')).toEqual({ kind: 'SAME_SEED_COMPLETE729_COMMAND_ACTUAL_LIVING_SOURCE', source: PURE_WHITE_SOURCE,
      sourceSha256: PURE_WHITE_SOURCE_SHA, sourceRoot: 'final', rawSourceStateSha256: PURE_WHITE_RAW_SOURCE_STATE_SHA,
      rawSchemaVersion: 169, rawContentVersion: 'light-seeker-v169', entireOriginalPrefixPreserved: true,
      originalDeadOwenPreserved: true, newRandomChanges: false });
    expect(naturalEntry('strategy')).toMatchObject({ caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL',
      combatRoundCap: 90, potionAttemptCap: 12, ordinaryActions: 'WORK_ONCE_PER_WEEK_WHEN_FIT_THEN_REST', potionLabourSteps: 5,
      recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: 0 } });
    let state = createSliceRun(capturedState('final').runId, naturalEntry<Parameters<typeof createSliceRun>[1]>('creation'), naturalEntry<string>('seed'));
    same(state, capturedState('initial'));
    for (const [index, intent] of captureCommands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        // The immutable prefix archives its living first-case ending before
        // later progression. This is the dispatcher's sole completed-case exit.
        expect(index).toBeLessThan(PURE_WHITE_PREFIX_COUNT);
        expect(state.status, `Only a living first-case ending may continue at command ${index + 1}`).toBe('SLICE_COMPLETE');
        expect(state.ending).not.toBeNull(); expect(state.ending!.kind).not.toBe('DEATH');
        expect(state.caseArchive).toHaveLength(0);
      } else expect(state.status, `No continuation after a real terminal at command ${index + 1}`).toBe('ACTIVE');
      if (index >= PURE_WHITE_PREFIX_COUNT) assertPublicCaptureControl(state, intent);
      const revision = state.revision, cursor = state.random.cursor;
      state = applySliceIntent(state, intent);
      expect(state.revision).toBe(revision + 1); expect(state.random.seed).toBe('bard-natural-v029');
      expect(state.random.cursor).toBeGreaterThanOrEqual(cursor);
      if (index === PURE_WHITE_PREFIX_COUNT - 1) same(state, capturedState('prefixFinal'));
    }
    same(state, currentGuidanceCaptureExpected(capturedState('final'))); assertValidSliceState(state); same(migrateSliceState(state), state);
    expect(state.revision).toBe(capturedState('initial').revision + expected.commandCount);
    expect(state).toMatchObject(expected.final);
    expect(naturalEntry('stage')).toBe(expected.stage); expect(naturalEntry('error')).toBe(expected.error);
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
    same(naturalEntry('continuationSource'), expected.continuationSource);
    expect(Object.keys(boundaryIndex)).toHaveLength(expected.boundaryNames);
    expect(Object.keys(snapshotIndex)).toEqual(expected.snapshots);
  }, FULL_CAPTURE_REPLAY_TIMEOUT);

  it('records clinic discovery, actual60p treatment and subsequent ordinary healing of the original wounds', () => {
    const original = capturedState('prefixFinal');
    expect(original.injuries.map(row => [row.severity, row.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    const discovery = replayCaptureBoundary('public-original-injury-clinic-discovery-1AP');
    expect(discovery.intent).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(discovery.before.careKnown).toBe(false); expect(discovery.final.careKnown).toBe(true);
    same(discovery.before.injuries, original.injuries);
    const treatment = replayCaptureBoundary('actual-clinic-pay60');
    expect(treatment.intent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(projectSliceState(treatment.before).activeEvent?.id).toBe('LIFE-CARE-01');
    expect(treatment.before.cash - treatment.final.cash).toBeGreaterThanOrEqual(60);
    expect(treatment.final.health).toBe(treatment.before.health);
    const heavy = original.injuries.find(row => row.severity === 'HEAVY')!;
    expect(treatment.final.injuries.find(row => row.id === heavy.id)).toEqual({ ...heavy, treatedRevision: treatment.before.revision + 1 });
    const recovered = capturedSnapshot('recoveredOriginalInjuries');
    expect(recovered).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0, seer: { pollution: 0 } });
    expect(recovered.revision).toBeGreaterThan(treatment.final.revision);
    expect(captureCommands.slice(treatment.count, recovered.revision - capturedState('initial').revision)
      .some(intent => intent.type === 'ACTION' && intent.action === 'REST')).toBe(true);
    same(naturalEntry('treatments'), expected.treatments);
    same(recovered.lightSeeker.encounter, original.lightSeeker.encounter);
  }, 180_000);

  it('preserves all20 old masteries and adds only the two learned abilities after actual promotion', () => {
    const original = capturedState('prefixFinal'), final = capturedState('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(20);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(5);
    same(final.pureWhiteAngel.sourceHistory, Object.fromEntries(PURE_WHITE_ANGEL_SOURCE_KEYS.map(key => [key, original[key]])));
    for (const key of PURE_WHITE_ANGEL_SOURCE_KEYS) {
      const live = structuredClone(final[key]);
      if (key === 'lightSeeker') (live as SliceState['lightSeeker']).life.site = structuredClone(original.lightSeeker.life.site);
      same(live, original[key]);
    }
    same(final.pureWhiteAngel.sourceScene!.originals, original.lightSeeker.life.site);
    same(final.lightSeeker.encounter, original.lightSeeker.encounter);
    expect(final.lightSeeker.encounter).toMatchObject({ targetId: 'LS2-OWEN', status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0 });
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory); same(final.town, original.town);
    same({ ...final.character, coreStats: original.character.coreStats }, original.character);
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    const mastery = { ...original.progression.mastery };
    if (final.progression.sequence === 1) {
      const promoted = capturedSnapshot('promoted');
      expect(Object.keys(promoted.progression.mastery)).toHaveLength(22);
      expect(PURE_WHITE_ANGEL_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
      for (const [id, value] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(value);
      for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) mastery[id] = 0;
      for (const [id, gain] of Object.entries(pureWhiteAngelLifeMasteryGains(final))) mastery[id] = Math.min(500, mastery[id]! + gain);
      same(final.pureWhiteAngel.sourceScene, promoted.pureWhiteAngel.sourceScene);
    }
    for (const round of finalRounds()) for (const action of [...round.pureWhiteAngelOutcome!.playerActions, ...round.pureWhiteAngelOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
    same(final.progression.mastery, mastery);
    expect(Object.keys(final.progression.mastery)).toHaveLength(22);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(5);
    expect(Object.values(final.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect([final.progression.mastery[FOCUSED], final.progression.mastery[GUARD]]).toEqual([8, 0]);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) {
      expect(final.character.coreStats[key]).toBe(original.character.coreStats[key] + Number(final.progression.sequence === 1));
    }
    expect(validatePureWhiteAngelSource(final)).toBe(true);
  }, 180_000);

  it('retains every actual failed or successful bottle with five paid jobs and exact check receipts', () => {
    const final = capturedState('final'), journal = final.pureWhiteAngel.acquisitionJournal;
    const guidance = replayCaptureBoundary('actual500p-guidance-and-frozen-eight-root-source');
    expect(guidance.before.cash - guidance.final.cash).toBe(500);
    same(checkRows(final), expected.acquisitionChecks); same(final.pureWhiteAngel.bottles, expected.bottles);
    const consumed = final.pureWhiteAngel.bottles.filter(bottle => bottle.status === 'CONSUMED');
    for (const bottle of consumed) {
      const buy = replayCaptureBoundary(`actual1100p-buy-${bottle.id}`);
      const prepared = replayCaptureBoundary(`actual150p-current-week-preparation-${bottle.id}`);
      const dose = replayCaptureBoundary(`actual-consumption-${bottle.id}`);
      expect(buy.before.cash - buy.final.cash).toBe(1100); expect(prepared.before.cash - prepared.final.cash).toBe(150);
      expect(journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0, seer: { pollution: 0 } });
      expect(dose.before.pureWhiteAngel.preparedWeek).toBe(dose.before.week); expect(dose.final.pureWhiteAngel.preparedWeek).toBeNull();
      expect(dose.before.week - dose.before.lightSeeker.promotionWeek!).toBeGreaterThanOrEqual(12);
      const result = dose.final.pureWhiteAngel.bottles.find(row => row.id === bottle.id)!;
      same(result, bottle); expect(result.labourSteps).toBe(5); expect(result.status).toBe('CONSUMED');
      expect(dose.final.random.cursor - dose.before.random.cursor).toBe(1);
      for (const [id, value] of Object.entries(dose.before.progression.mastery)) expect(dose.final.progression.mastery[id], id).toBe(value);
      expect(() => applySliceIntent(dose.final, dose.intent)).toThrow();
    }
    expect(journal.filter(row => row.command.type === 'PREPARE_TASK')).toHaveLength(3);
    const successful = consumed.filter(row => row.outcome === 'SUCCESS' || row.outcome === 'GREAT_SUCCESS');
    expect(successful).toHaveLength(Number(final.progression.sequence === 1));
    expect(consumed.map(row => [row.id, row.consumedWeek, row.outcome])).toEqual([['pure-white-angel-potion-1', 186, 'GREAT_SUCCESS']]);
    expect(final.pureWhiteAngel.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    for (const [name] of Object.entries(boundaryIndex).filter(([key]) => key.startsWith('actual-later-week-new-supply-'))) {
      const supply = replayCaptureBoundary(name);
      expect(supply.before.week).toBeGreaterThan(supply.before.pureWhiteAngel.resupply.requestedWeek!);
      same(supply.final.pureWhiteAngel.bottles.slice(0, supply.before.pureWhiteAngel.bottles.length), supply.before.pureWhiteAngel.bottles);
    }
  }, 300_000);

  it('keeps the successful focused window separate from the later finite cleanse and report award', () => {
    const cast = replayCaptureBoundary('residue-trace-one-paid-focused-window-attempt');
    expect(cast.final.lastCheck).toMatchObject({ roll: 20, chance: 74, tier: 'SUCCESS' });
    expect(cast.final.pureWhiteAngel.life.pending).toMatchObject({ kind: 'FOCUSED', caseId: 'residue-trace', sampleVersion: 1 });
    expect(cast.final.pureWhiteAngel.life.sample.residueUnits).toBe(1); expect(cast.final.progression.mastery[FOCUSED]).toBe(0);
    expect(cast.final.pureWhiteAngel.life.cases['residue-trace'].attempts[0]!.focused)
      .toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'ACTIVE' });
    const cleanse = replayCaptureBoundary('residue-trace-separate-actual-will18-check-and-finite-unit-result');
    expect(cleanse.final.lastCheck).toMatchObject({ roll: 67, chance: 94, tier: 'SUCCESS',
      modifiers: [{ source: '同一已观察残留的有限净光', value: 10 }] });
    expect(cleanse.final.pureWhiteAngel.life.sample.residueUnits).toBe(0); expect(cleanse.final.pureWhiteAngel.life.pending).toBeNull();
    expect(cleanse.final.progression.mastery[FOCUSED]).toBe(0);
    expect(cleanse.final.pureWhiteAngel.life.cases['residue-trace'].attempts[0]!.focused)
      .toMatchObject({ attempts: 1, successes: 1, effects: 1, state: 'APPLIED' });
    expect(replayCaptureBoundary('residue-trace-honest-actual-result-cost-and-application-report').final.progression.mastery[FOCUSED]).toBe(8);
  }, 180_000);

  it('preserves the failed guard and invalidated successful guard, with two real resets and zero protected impacts', () => {
    const failed = replayCaptureBoundary('personal-impact-one-paid-personal-guard-attempt');
    expect(failed.final.lastCheck).toMatchObject({ roll: 86, chance: 64, tier: 'FAILURE' });
    expect([failed.before.spirituality - failed.final.spirituality, failed.before.mind - failed.final.mind]).toEqual([6, 2]);
    expect(failed.final.pureWhiteAngel.life.pending).toBeNull(); expect(failed.final.progression.mastery[GUARD]).toBe(0);
    const reset = replayCaptureBoundary('personal-impact-ordinary-safe-reset-after-failed-guard-with-actual-pad-wear');
    expect(reset.final.pureWhiteAngel.life.pad).toMatchObject({ durability: 90, impacts: 0, resets: 1 });
    expect(reset.final.health).toBe(reset.before.health);
    const cast = replayCaptureBoundary('screened-return-one-paid-personal-guard-attempt');
    expect(cast.final.lastCheck).toMatchObject({ roll: 6, chance: 64, tier: 'SUCCESS' });
    expect(cast.final.pureWhiteAngel.life.pending).toMatchObject({ kind: 'GUARD', caseId: 'screened-return', conditionVersion: 1 });
    expect(cast.final.progression.mastery[GUARD]).toBe(0);
    const changed = replayCaptureBoundary('screened-return-ivan-actual24metre-walk-and-original-shutter-close-wear');
    expect(changed.final.pureWhiteAngel.life.pending).toBeNull();
    expect(changed.final.pureWhiteAngel.life.cases['screened-return'].attempts[0]!.guard)
      .toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'INVALIDATED' });
    for (const suffix of ['current-mara-withdrawal', 'explicit-ordinary-stop-after-withdrawal', 'ordinary-safe-reset-with-pad10-no-impact-release',
      'ordinary-real-six-metre-walk-and-original-shutter-wear', 'same-original-pad-returned-to-player', 'actual-six-metre-gallery-return']) {
      const save = replayCaptureBoundary(`screened-return-${suffix}`), receipt = save.final.pureWhiteAngel.life.journal.at(-1)!;
      expect([receipt.before.actions, receipt.after.actions]).toEqual([0, 0]);
      expect([receipt.before.spirituality - receipt.after.spirituality, receipt.before.mind - receipt.after.mind]).toEqual([0, 0]);
      expect(save.final.progression.mastery[GUARD]).toBe(0);
    }
    const practiced = capturedSnapshot('practiced');
    expect(practiced.pureWhiteAngel.life.pad).toMatchObject({ durability: 80, impacts: 0, resets: 2, location: 'PLAYER' });
    expect(practiced.progression.mastery[GUARD]).toBe(0);
    expect(practiced.pureWhiteAngel.life.cases['personal-impact'].result).toBe('ORDINARY');
    expect(practiced.pureWhiteAngel.life.cases['screened-return'].result).toBe('ORDINARY');
  }, 300_000);

  it('accounts for actual casts, separate applications, changed windows, original wear and physical walking', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), life = final.pureWhiteAngel.life;
    const start = original.lightSeeker.life.site, end = final.lightSeeker.life.site, journal = life.journal;
    same(lifeCheckRows(final), expected.lifeChecks); same(life.cases, expected.lifeCases);
    expect(life).toMatchObject(expected.life);
    const uses = Object.fromEntries(([['focused', FOCUSED], ['guard', GUARD]] as const).map(([key, id]) => {
      const rows = PURE_WHITE_ANGEL_CASE_IDS.flatMap(caseId => life.cases[caseId].attempts.map(attempt => attempt[key]));
      return [id, { actualCasts: rows.reduce((n, row) => n + row.attempts, 0), successfulWindows: rows.reduce((n, row) => n + row.successes, 0),
        actualApplications: rows.reduce((n, row) => n + row.effects, 0), states: rows.map(row => row.state) }];
    }));
    same(uses, expected.lifeAbilityUse);
    for (const row of Object.values(uses)) {
      expect(row.actualApplications).toBeLessThanOrEqual(row.successfulWindows); expect(row.successfulWindows).toBeLessThanOrEqual(row.actualCasts);
    }
    let prior = start;
    for (const row of journal) {
      same(row.originalsBefore, prior); prior = row.originalsAfter;
      expect(row.originalsAfter.elapsedSeconds - row.originalsBefore.elapsedSeconds).toBe(row.elapsedSeconds);
      expect(row.originalsBefore.operatorEnergy - row.originalsAfter.operatorEnergy).toBe(row.ownerEnergySpent);
      expect(row.originalsAfter.playerMetres - row.originalsBefore.playerMetres).toBeLessThanOrEqual(row.playerWalkedMetres);
      expect(row.originalsAfter.playerMetres).toBeGreaterThanOrEqual(row.originalsBefore.playerMetres);
      if (row.command.type === 'FOCUSED_PURIFICATION' || row.command.type === 'WARM_RADIANCE_GUARD') {
        expect([row.before.spirituality - row.after.spirituality, row.before.mind - row.after.mind])
          .toEqual([row.command.type === 'FOCUSED_PURIFICATION' ? 8 : 6, 2]);
        same(row.after.mastery, row.before.mastery);
      }
      if (row.command.type === 'CLEANSE_SAMPLE' || row.command.type === 'RELEASE_IMPACT') same(row.after.mastery, row.before.mastery);
    }
    same(prior, end); same(end, pureWhiteAngelExpectedOriginals(final));
    for (const key of ['id', 'lengthMetres', 'ordinaryExit', 'operatorId', 'operatorName', 'operatorAge', 'spiritId', 'spiritName',
      'spiritLocation', 'spiritMetres', 'spiritEnergy', 'lamp', 'cover', 'screen', 'light', 'board'] as const) same(end[key], start[key]);
    const transitions = journal.flatMap(row => row.transitions);
    const shutter = transitions.filter(type => ['CLOSE_SHUTTER', 'OPEN_SHUTTER', 'SHUTTER_BROKEN'].includes(type)).length;
    expect(end.shutter.operations).toBe(start.shutter.operations + shutter); expect(end.shutter.durability).toBe(start.shutter.durability - shutter);
    expect(life.sample.residueUnits).toBe(1 - transitions.filter(type => type === 'CLEANSE').length);
    expect(life.pad.durability).toBe(100 - 10 * (life.pad.impacts + life.pad.resets));
    expect(life.pad.impacts).toBe(transitions.filter(type => type === 'RELEASE_IMPACT').length);
    expect(life.pad.resets).toBe(transitions.filter(type => type === 'HANDLE_RESET').length);
    expect(life.elapsedSeconds).toBe(journal.reduce((n, row) => n + row.elapsedSeconds, 0));
    expect(life.playerTravelMetres).toBe(journal.reduce((n, row) => n + row.playerWalkedMetres, 0));
    expect(life.ivan.travelMetres).toBe(journal.reduce((n, row) => n + row.ivanWalkedMetres, 0));
    expect(end.operatorMetres - start.operatorMetres).toBe(journal.reduce((n, row) => n + row.maraWalkedMetres, 0));
    for (const attempt of life.cases['screened-return'].attempts) if (attempt.conditionChanged) {
      expect(attempt.guard.effects).toBe(0); expect(attempt.impactReleased).toBe(false);
      expect(attempt.impactReset).toBe(true); expect(attempt.permission.owner).toBe('WITHDRAWN');
    }
    same(pureWhiteAngelEncounterOriginalEvents(final), []);
    const acquisition = final.pureWhiteAngel.acquisitionJournal;
    const outcomes = finalRounds().map(round => round.pureWhiteAngelOutcome!);
    const playerActions = outcomes.flatMap(outcome => outcome.playerActions), enemyActions = outcomes.flatMap(outcome => outcome.enemyActions);
    same({
      acquisitionCash: acquisition.reduce((n, row) => n + row.before.cash - row.after.cash, 0),
      acquisitionAP: acquisition.reduce((n, row) => n + row.before.actions - row.after.actions, 0),
      lifeCash: journal.reduce((n, row) => n + row.before.cash - row.after.cash, 0),
      lifeAP: journal.reduce((n, row) => n + row.before.actions - row.after.actions, 0),
      lifeSpirituality: journal.reduce((n, row) => n + row.before.spirituality - row.after.spirituality, 0),
      lifeMind: journal.reduce((n, row) => n + row.before.mind - row.after.mind, 0),
      lifeHealthLost: journal.reduce((n, row) => n + row.before.health - row.after.health, 0),
      sourceMaraEnergy: journal.reduce((n, row) => n + row.ownerEnergySpent, 0),
      sourceMaraWalkedMetres: journal.reduce((n, row) => n + row.maraWalkedMetres, 0),
      actualPlayerWalkedMetres: journal.reduce((n, row) => n + row.playerWalkedMetres, 0),
      sourceGalleryWalkedMetres: journal.reduce((n, row) => n + row.originalsAfter.playerMetres - row.originalsBefore.playerMetres, 0),
      ivanWalkedMetres: journal.reduce((n, row) => n + row.ivanWalkedMetres, 0),
      sourceClockSeconds: journal.reduce((n, row) => n + row.elapsedSeconds, 0),
      originalResidueUnitsConsumed: 1 - life.sample.residueUnits,
      originalShutterDurabilitySpent: start.shutter.durability - end.shutter.durability,
      personalPadDurabilitySpent: 100 - life.pad.durability,
      combatSpirituality: playerActions.reduce((n, row) => n + row.paidCost, 0),
      combatMindCasting: playerActions.reduce((n, row) => n + row.mindCost, 0),
      enemySpirituality: enemyActions.reduce((n, row) => n + row.paidCost, 0),
      enemyRodChargesSpent: enemyActions.reduce((n, row) => n + row.rodChargeSpent, 0),
      clinic: naturalEntry<{ paidPennies: number }[]>('treatments').reduce((n, row) => n + row.paidPennies, 0),
      ordinaryWorkCount: captureCommands.slice(PURE_WHITE_PREFIX_COUNT).filter(intent => intent.type === 'ACTION' && intent.action === 'WORK').length,
      ordinaryRestCount: captureCommands.slice(PURE_WHITE_PREFIX_COUNT).filter(intent => intent.type === 'ACTION' && intent.action === 'REST').length,
    }, expected.actualCosts);
  }, 180_000);

  it('replays each actual round, all ordered random draws and finite BODY/MIND costs without equating windows to effects', () => {
    const final = capturedState('final'), rounds = finalRounds();
    expect(rounds).toHaveLength(expected.rounds.length);
    expect(rounds.map(round => [round.pureWhiteAngelOutcome!.source.randomCursor, round.pureWhiteAngelOutcome!.randomCursorAfter])).toEqual([[361, 385]]);
    same(rounds.map(round => {
      const outcome = round.pureWhiteAngelOutcome!;
      return { round: round.round, stance: round.stance, first: round.first,
        countWheels: { playerRoll: round.playerCountRoll, playerCount: round.playerCount, enemyRoll: round.enemyCountRoll, enemyCount: round.enemyCount },
        consequenceDomain: outcome.consequenceDomain, consequenceRoll: round.consequenceRoll ?? null,
        result: { playerHealth: outcome.playerHealthAfter, playerMind: outcome.playerMindAfter, playerSpirituality: outcome.playerSpiritualityAfter,
          enemyHealth: outcome.enemyHealth, enemyMind: outcome.enemyMind, enemySpirituality: outcome.enemySpirituality,
          actualPlayerActions: outcome.playerActions.length, actualEnemyActions: outcome.enemyActions.length,
          actualOrderedActions: [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order),
          expiredWindows: outcome.expiredWindows, pendingAfter: outcome.pendingEnemyActionAfter,
          windowsAfter: outcome.windowsAfter, materialsAfter: outcome.materialsAfter } };
    }), expected.rounds);
    let enemyPaid = 0, charges = 0;
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), outcome = round.pureWhiteAngelOutcome!;
      expect(outcome).toBeDefined(); same(outcome.source, currentPureWhiteAngelCombatSource(save.before));
      same(replayPureWhiteAngelCombatRound(outcome.source, 'CONTROL').round, round); same(save.final.lastCombatRound, round);
      expect(outcome.source).toMatchObject({ targetId: 'PW1-SILAS-DANE', targetAge: 49, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'bard-natural-v029' });
      expect(outcome.source.clubHeld).toBe(capturedState('prefixFinal').town.clubLocation === 'HAND');
      expect(round.playerCount).toBe(pureWhiteAngelActionCount(round.playerCountRoll));
      expect(round.enemyCount).toBe(pureWhiteAngelEnemyActionCount(round.enemyCountRoll));
      expect(outcome.playerActions.length).toBeLessThanOrEqual(round.playerCount); expect(outcome.enemyActions.length).toBeLessThanOrEqual(round.enemyCount);
      const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
      if (actions.length < round.playerCount + round.enemyCount) expect(outcome.enemyStatus).toBe('SURRENDERED');
      same(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })));
      expect(actions.map(action => action.order)).toEqual(actions.map((_, index) => index));
      let cursor = outcome.source.randomCursor + 2;
      for (const [index, action] of actions.entries()) {
        expect(action.atSeconds).toBe(outcome.source.root.clockSeconds + index * 5); expect(action.elapsedSeconds).toBe(5);
        expect(action.randomCursorBefore).toBeGreaterThanOrEqual(cursor);
        expect(action.randomCursorAfter - action.randomCursorBefore).toBe(Number(action.check !== null) + Number(action.resistanceRoll !== null));
        cursor = action.randomCursorAfter;
        expect(action.materialsBefore.weapon.charge - action.materialsAfter.weapon.charge).toBe(action.rodChargeSpent);
        if (action.actor === 'PLAYER' && (action.selectedAbility === FOCUSED || action.selectedAbility === GUARD) && action.paidCost > 0) {
          expect([action.paidCost, action.mindCost]).toEqual([action.selectedAbility === FOCUSED ? 8 : 6, 2]);
          expect(action.masteryApplied).not.toContain(action.selectedAbility);
        }
        if (action.masteryApplied.includes(FOCUSED)) {
          const window = action.windowsBefore.focusedPurification!;
          expect(window).not.toBeNull(); expect(window.openedOrder).toBeLessThan(action.order);
          expect(window.expiresAt).toBeGreaterThan(action.atSeconds); expect(action.attackKind).toBe('BODY');
          expect(action.windowsAfter.focusedPurification).toBeNull(); expect(action.countered).toContain(window.id);
        }
        if (action.masteryApplied.includes(GUARD)) {
          const window = action.windowsBefore.warmRadianceGuard!;
          expect(window).not.toBeNull(); expect(window.openedOrder).toBeLessThan(action.order);
          expect(window.expiresAt).toBeGreaterThan(action.atSeconds); expect(action.attackKind).toBe('BODY');
          expect(action.windowsAfter.warmRadianceGuard).toBeNull(); expect(action.countered).toContain(window.id);
        }
      }
      // An actual zero-mind surrender suppresses the winner draw; a normal
      // nonterminal or bodily terminal round still consumes its winner draw.
      const endedDuringSlots = actions.at(-1)?.enemyMindAfter === 0;
      expect(outcome.randomCursorAfter - cursor).toBe(Number(!endedDuringSlots) + Number(outcome.consequenceDomain === 'BODY'));
      expect(outcome.rootAfter.clockSeconds - outcome.source.root.clockSeconds).toBe(60);
      expect(outcome.source.playerSpirituality - outcome.playerSpiritualityAfter).toBe(outcome.playerActions.reduce((n, action) => n + action.paidCost, 0));
      expect(outcome.playerMindAfter).toBe(Math.max(0, outcome.source.playerMind - outcome.playerActions.reduce((n, action) => n + action.mindCost, 0)
        - (round.winner === 'ENEMY' && outcome.consequenceDomain === 'MENTAL' ? 10 : 0)));
      expect(save.final.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
      enemyPaid += outcome.enemyActions.reduce((n, action) => n + action.paidCost, 0);
      charges += outcome.enemyActions.reduce((n, action) => n + action.rodChargeSpent, 0);
      expect(outcome.enemySpirituality).toBe(120 - enemyPaid); expect(outcome.materialsAfter.weapon.charge).toBe(4 - charges);
      expect(outcome.materialsAfter.weapon.pieces.filter(piece => piece.state === 'SPENT')).toHaveLength(charges);
      if (outcome.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
        expect(outcome.playerHealthAfter).toBe(outcome.source.playerHealth);
        same(outcome.playerInjuriesAfter, outcome.source.playerInjuries); expect(outcome.playerRiskAfter).toBe(outcome.source.playerRisk);
      }
    }
    const encounter = final.pureWhiteAngel.encounter;
    expect(encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 99, enemyStatus: 'SURRENDERED',
      inheritedApplications: { 'sun.s9.praise': 1, 'sun.s8.light': 2 }, focusedPurificationAttempts: 0, focusedPurificationChecks: 0,
      focusedPurificationSuccesses: 0, warmRadianceGuardAttempts: 1, warmRadianceGuardChecks: 0, warmRadianceGuardSuccesses: 0 });
    same({ status: encounter.status, terminal: encounter.terminal, scene: encounter.scene, materials: encounter.materials,
      enemyHealth: encounter.enemyHealth, enemyMind: encounter.enemyMind, enemySpirituality: encounter.enemySpirituality, enemyInjuries: encounter.enemyInjuries,
      powerUses: encounter.powerUses, inheritedApplications: encounter.inheritedApplications, screenReveals: encounter.screenReveals,
      focusedPurification: { actualCasts: encounter.focusedPurificationAttempts, successfulWindows: encounter.focusedPurificationChecks, actualApplications: encounter.focusedPurificationSuccesses },
      warmRadianceGuard: { actualCasts: encounter.warmRadianceGuardAttempts, successfulWindows: encounter.warmRadianceGuardChecks, actualApplications: encounter.warmRadianceGuardSuccesses } }, expected.encounter);
  }, Math.max(180_000, expected.rounds.length * 20_000));

  it('reopens the exact observed terminal or living state without manufacturing an exit, work or resurrection', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(captureCommands.at(-1), intent); same(applySliceIntent(before, intent), final);
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened);
    same(reopened, final); same(projectSliceState(reopened), projectSliceState(final));
    expect(reopened).toMatchObject(expected.final);
    const terminal = final.pureWhiteAngel.encounter.terminal;
    if (final.status === 'DEAD') {
      expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
      expect(projectSliceState(reopened).pureWhiteAngel.actions.some(action => action.enabled)).toBe(false);
      expect(boundaryIndex['actual-paid-work-after-living-exit']).toBeUndefined();
      expect(boundaryIndex['actual-ordinary-encounter-exit']).toBeUndefined();
      if (terminal) expect(terminal).toMatchObject({ outcome: 'PLAYER_DEAD', exitMetres: 0, exitSeconds: 0 });
      for (const blocked of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
        { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'PURE_WHITE_ANGEL', command: { type: 'LEAVE_ENCOUNTER' } }] satisfies SliceIntent[]) {
        const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
      }
    } else if (terminal) {
      expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 });
      expect(final.pureWhiteAngel.encounter.scene).toMatchObject({ playerLocation: 'OUTSIDE', playerCoordinate: 0 });
      const work = replayCaptureBoundary('actual-paid-work-after-living-exit');
      expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      expect(work.before.wagePaidWeek).not.toBe(work.before.week); expect(work.final.wagePaidWeek).toBe(work.before.week);
    }
    same(final.lightSeeker.encounter, capturedState('prefixFinal').lightSeeker.encounter);
  }, 180_000);
});
