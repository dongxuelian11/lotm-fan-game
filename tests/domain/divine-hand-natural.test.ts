import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { divineHandFinanceSnapshot, validateDivineHandAcquisitionJournal, validateDivineHandJournalContinuity,
  validateDivineHandSource } from '../../src/domain/divine-hand/index.js';
import { DIVINE_HAND_ABILITY_IDS, DIVINE_HAND_SOURCE_KEYS } from '../../src/domain/divine-hand/types.js';
import { DIVINE_HAND_CASE_IDS, divineHandExpectedOriginals, validateDivineHandLifeState } from '../../src/domain/divine-hand/life.js';
import { divineHandEncounterOriginalEvents } from '../../src/domain/divine-hand/encounter.js';
import { currentDivineHandCombatSource, replayDivineHandCombatRound, divineHandActionCount,
  divineHandEnemyActionCount } from '../../src/domain/divine-hand/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { DIVINE_HAND_CAPTURE_EVIDENCE as expected } from './divine-hand-capture-evidence.js';
import { DIVINE_HAND_ROOT, DIVINE_HAND_SOURCE, DIVINE_HAND_PREFIX_COUNT, captureCommands, boundaryIndex, boundarySteps,
  snapshotIndex, naturalEntry, sourceEntry, summaryEntry, capturedState, capturedSnapshot, currentCapture,
  captureFileHash, captureValueHash, insertionOrderHash, captureBody, captureJsonLines, replayCaptureBoundary,
  assertPublicCaptureControl, assertOriginalContinuity, sameCaptureValue as same } from './divine-hand-capture-helper.js';

const [BEAM, ARMOR] = DIVINE_HAND_ABILITY_IDS;
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
const finalRounds = (s: SliceState) => s.combatHistory.slice(capturedState('prefixFinal').combatHistory.length);

// The first70 commands came from directed S3 history. The complete original158
// commands and all139 new public choices are retained, including the actual death.
describe('Divine Hand exact158 source and actual297-command public continuation', () => {
  it('pins historical173 source and raw195 capture separately from current migrated output', async () => {
    expect(await captureFileHash(DIVINE_HAND_SOURCE)).toBe(expected.sourceSha256);
    expect(await captureFileHash('scripts/play/divine-hand-stage.mjs')).toBe(expected.producerSha256);
    const raw = sourceEntry<SliceState>('final');
    expect(raw).toMatchObject({ schemaVersion: 173, contentVersion: 'glory-v173', status: 'ACTIVE', revision: 600,
      week: 146, health: 90, mind: 100, spirituality: 96, cash: 500, actionsRemaining: 2,
      random: { seed: 'warrior-natural-v042', cursor: 475 } });
    expect(raw.injuries.map(i => i.severity)).toEqual(['LIGHT']);
    expect(raw.glory.life.site.armor!.integrity).toBe(60); expect(raw.glory.life.site.playerEnergy).toBe(35);
    expect(insertionOrderHash(raw)).toBe(expected.rawSourceStateSha256);
    expect(captureValueHash(raw)).toBe(expected.rawSourceStateSortedSha256);
    expect(insertionOrderHash(sourceEntry('initial'))).toBe(expected.rawInitialSha256);
    for (const key of DIVINE_HAND_SOURCE_KEYS) expect(insertionOrderHash(raw[key]), key).toBe(expected.rawRootHashes[key]);
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) {
      expect(naturalEntry(key)).toMatchObject({ schemaVersion: 195, contentVersion: 'divine-hand-v195' });
    }
    expect(insertionOrderHash(naturalEntry('final'))).toBe(expected.rawFinalSha256);
    expect(insertionOrderHash(naturalEntry('prefixFinal'))).toBe(expected.rawPrefixFinalSha256);
    expect(capturedState('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(capturedState('prefixFinal'), migrateSliceState(raw)); same(capturedState('initial'), migrateSliceState(sourceEntry('initial')));
    expect(naturalEntry('producerSha256')).toBe(expected.producerSha256);
    same(naturalEntry('provenance'), expected.provenance);
    expect(naturalEntry('provenance')).toMatchObject({ kind: 'DIRECTED70_EXACT158_PUBLIC_GLORY_THEN_PUBLIC_DIVINE_HAND',
      sourceRoot: 'final', inheritedDirectedPrefix: true, fullNaturalS9ToS1: false, newRandomChanges: false });
    same(sourceEntry('continuation'), expected.provenance.priorContinuation);
    expect(sourceEntry('prefixCount')).toBe(70); expect(naturalEntry('inheritedPrefixCount')).toBe(70);
    same(capturedState('prefixFinal').character, expected.originalCharacter);
  }, 60_000);

  it('keeps earlier directed, natural, and two independent dead histories without reviving them', async () => {
    for (const historical of expected.preserved) {
      expect(await captureFileHash(historical.file), historical.file).toBe(historical.sha256);
      expect(readObjectEntry<SliceIntent[]>(historical.file, 'commands')).toHaveLength(historical.commands);
      const raw = readObjectEntry<SliceState>(historical.file, 'final');
      expect([raw.schemaVersion, raw.contentVersion]).toEqual([historical.rawSchemaVersion, historical.rawContentVersion]);
      expect(insertionOrderHash(raw)).toBe(historical.rawFinalSha256);
      expect(raw).toMatchObject({ status: historical.finalStatus, health: historical.health, week: historical.week,
        revision: historical.revision, random: historical.random });
      const state = currentCapture(raw); assertValidSliceState(state);
      if (historical.status === 'DEAD') {
        expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(projectSliceState(state).canAct).toBe(false);
        for (const intent of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }] satisfies SliceIntent[]) {
          const hash = captureValueHash(state); expect(() => applySliceIntent(state, intent)).toThrow(); expect(captureValueHash(state)).toBe(hash);
        }
      }
    }
    const directed = readObjectEntry<SliceIntent[]>(expected.preserved[0]!.file, 'commands');
    same(captureCommands.slice(0, 70), directed);
    same(captureCommands.slice(0, 158), sourceEntry('commands'));
    expect(expected.preserved.filter(row => row.status === 'DEAD')).toHaveLength(2);
  }, 60_000);

  it('replays all297 commands exactly once, with current public controls for every new choice', () => {
    expect(DIVINE_HAND_PREFIX_COUNT).toBe(158); expect(captureCommands).toHaveLength(297);
    const originalCommands = sourceEntry<SliceIntent[]>('commands'); expect(originalCommands).toHaveLength(158);
    same(captureCommands.slice(0, 158), originalCommands); expect(insertionOrderHash(originalCommands)).toBe(expected.prefixSha256);
    expect(naturalEntry('prefixCount')).toBe(158); expect(naturalEntry('prefixVerified')).toBe(true);
    same(naturalEntry('strategy'), expected.strategy); expect(naturalEntry('seed')).toBe('warrior-natural-v042');
    let state = currentCapture(sourceEntry('initial')); const original = capturedState('prefixFinal');
    same(state, capturedState('initial'));
    for (const [index, intent] of captureCommands.entries()) {
      if (intent.type === 'CONTINUE_LIFE') {
        expect(index).toBeLessThan(158); expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending?.kind).not.toBe('DEATH');
      } else expect(state.status, `No command after death at step ${index + 1}`).toBe('ACTIVE');
      if (index >= 158) assertPublicCaptureControl(state, intent);
      const before = state; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(before.revision + 1); expect(state.random.seed).toBe('warrior-natural-v042');
      expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === 157) same(state, original);
      if (index >= 158) assertOriginalContinuity(state, original);
    }
    same(state, capturedState('final')); assertValidSliceState(state); same(migrateSliceState(state), state);
    same(captureBody(state), expected.final); expect(state.revision).toBe(capturedState('initial').revision + 297);
    expect(naturalEntry('stage')).toBe('ACTUAL_TERMINAL_WITH_DIRECTED70_HISTORY'); expect(naturalEntry('error')).toBeNull();
    expect(naturalEntry('pendingIntent')).toBeNull(); expect(naturalEntry('failurePhase')).toBe('IDLE');
  }, 120_000);

  it('retains contiguous complete command and public ledgers without claiming combat controls have enabled fields', async () => {
    expect(Object.keys(boundaryIndex)).toHaveLength(142); same(Object.keys(boundarySteps), Object.keys(boundaryIndex));
    same(Object.keys(snapshotIndex), expected.snapshots);
    type Ledger = { step: number; sourcePrefix: boolean; intent: SliceIntent; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    let prior = captureBody(capturedState('initial')), count = 0;
    const bodies = new Map<number, { before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> }>();
    for await (const row of captureJsonLines<Ledger>('commands.jsonl')) {
      expect(row.step).toBe(++count); same(row.intent, captureCommands[count - 1]); expect(row.sourcePrefix).toBe(count <= 158);
      same(row.before, prior); expect(row.after.revision).toBe(row.before.revision + 1); prior = row.after;
      if (count > 158) bodies.set(count, row);
    }
    expect(count).toBe(297); same(prior, expected.final);
    type PublicRow = { step: number; revision: number; command: SliceIntent; control: { enabled?: boolean; kind?: string; stance?: string };
      randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof captureBody>; after: ReturnType<typeof captureBody> };
    count = 158;
    for await (const row of captureJsonLines<PublicRow>('public.jsonl')) {
      expect(row.step).toBe(++count); same(row.command, captureCommands[count - 1]);
      if (row.command.type === 'COMBAT_ROUND') expect(row.control).toMatchObject({ kind: 'COMBAT_ROUND', stance: 'CONTROL' });
      else expect(row.control.enabled).toBe(true);
      const body = bodies.get(count)!; expect(row.revision).toBe(body.before.revision);
      for (const key of Object.keys(body.before) as (keyof ReturnType<typeof captureBody>)[]) {
        same(row.before[key], body.before[key]); same(row.after[key], body.after[key]);
      }
      same(row.randomBefore, body.before.random); same(row.randomAfter, body.after.random);
      expect(row.randomBefore.seed).toBe('warrior-natural-v042'); expect(row.randomAfter.cursor).toBeGreaterThanOrEqual(row.randomBefore.cursor);
    }
    expect(count).toBe(297);
  }, 60_000);

  it('preserves paid ordinary recovery, both independent bottles, failed first dose and successful second dose', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), promoted = capturedSnapshot('promoted');
    const rest = replayCaptureBoundary('actual-rest-for-original-light-wound');
    expect(rest.intent).toEqual({ type: 'ACTION', action: 'REST' }); expect([rest.before.health, rest.final.health]).toEqual([90, 98]);
    expect(rest.final.actionsRemaining).toBe(rest.before.actionsRemaining - 1); same(rest.final.random, rest.before.random);
    expect(capturedSnapshot('sourceRecovered')).toMatchObject({ health: 100, injuries: [], injuryRisk: 0 });
    expect(naturalEntry('treatments')).toEqual([]);
    const guidance = replayCaptureBoundary('paid500-guidance-freezes-eight-roots'); expect(guidance.before.cash - guidance.final.cash).toBe(500);
    const journal = final.divineHand.acquisitionJournal;
    same(journal.filter(r => r.check).map(r => [r.command, r.week, r.check!.roll, r.check!.chance, r.check!.tier, r.randomBefore, r.randomAfter]), expected.acquisitionChecks);
    same(final.divineHand.bottles, expected.bottles); expect(expected.potionOutcomes).toEqual(['FAILURE', 'SUCCESS']);
    for (const bottle of final.divineHand.bottles.filter(b => b.status === 'CONSUMED')) {
      const buy = replayCaptureBoundary(`actual1100p-buy-${bottle.id}`), prep = replayCaptureBoundary(`actual150p-current-week-prepare-${bottle.id}`);
      const dose = replayCaptureBoundary(`consume-${bottle.id}`);
      expect(buy.final.divineHand.acquisitionJournal.at(-1)!.before.cash - buy.final.divineHand.acquisitionJournal.at(-1)!.after.cash).toBe(1100);
      expect(prep.final.divineHand.acquisitionJournal.at(-1)!.before.cash - prep.final.divineHand.acquisitionJournal.at(-1)!.after.cash).toBe(150);
      expect(journal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before.week - original.glory.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.divineHand.preparedWeek).toBe(dose.before.week); expect(dose.final.divineHand.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!)); expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
      expect(dose.final.spirituality).toBe(dose.before.spirituality); same(dose.final.injuries, dose.before.injuries);
    }
    expect(DIVINE_HAND_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(promoted.progression.mastery[id], id).toBe(value);
    expect(final.divineHand.preparations.map(r => r.taskId)).toEqual(['VERIFY_ORIGINALS', 'PLAN_FINITE_LOAD', 'CHECK_RETURN']);
    expect(validateDivineHandAcquisitionJournal(final)).toBe(true);
  }, 60_000);

  it('retains all three failed life abilities, ordinary outcomes, paid finite load and actual participant withdrawal', () => {
    const final = capturedState('final'), life = final.divineHand.life;
    same(life.journal.filter(r => r.check).map(r => [r.command.type, r.checkBase, r.check!.roll, r.check!.chance, r.check!.tier, r.randomBefore, r.randomAfter]), expected.lifeChecks);
    same(Object.fromEntries(DIVINE_HAND_CASE_IDS.map(id => { const c = life.cases[id]; return [id, {
      status: c.status, result: c.result, returned: c.returned, attempts: c.attempts.map(({ siteAtStart: _site, ...attempt }) => attempt) }]; })), expected.lifeResults);
    for (const [id, command] of [['beam-support', 'beam_stabilize'], ['armor-window', 'armor_convergence'], ['withdrawn-support', 'beam_stabilize']] as const) {
      const cast = replayCaptureBoundary(`${id}-${command}`), attempt = life.cases[id].attempts[0]!;
      expect(life.cases[id].attempts).toHaveLength(1); expect(attempt).toMatchObject({ closed: true, exited: true, result: 'ORDINARY' });
      expect(cast.before.spirituality - cast.final.spirituality).toBe(8); expect(cast.before.mind - cast.final.mind).toBe(2);
      expect(cast.final.random.cursor).toBe(cast.before.random.cursor + 1); same(cast.before.progression.mastery, cast.final.progression.mastery);
      expect(cast.final.divineHand.life.pending).toBeNull(); expect(cast.final.actionsRemaining).toBe(cast.before.actionsRemaining);
    }
    same(summaryEntry('lifeAbilityUse'), expected.lifeAbilityUse);
    const impact = replayCaptureBoundary('armor-window-apply_load'), armor = life.cases['armor-window'].attempts[0]!;
    expect([impact.before.glory.life.site.armor!.integrity, impact.final.glory.life.site.armor!.integrity]).toEqual([60, 55]);
    expect(impact.before.health - impact.final.health).toBe(6); same(impact.before.random, impact.final.random);
    expect(armor.load).toMatchObject({ id: 'DH1-LOAD:armor-window:1', paidPennies: 30, remaining: 0, consumed: 1 });
    expect(armor).toMatchObject({ penniesSpent: 50, armorWear: 5, impactDamage: 6, impactReduction: 0, padRetrieved: true, padReturned: true });
    expect(impact.final.glory.life.site.load).toMatchObject({ id: 'GL2-LOAD', remainingLoads: 0, appliedLoads: 1 });
    const withdrawn = replayCaptureBoundary('withdrawn-support-withdraw_consent');
    expect(withdrawn.intent).toEqual({ type: 'DIVINE_HAND', command: { type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' } });
    expect(withdrawn.before.divineHand.life.pending).toBeNull(); expect(withdrawn.final.divineHand.life.pending).toBeNull();
    expect(life.cases['withdrawn-support'].attempts[0]!).toMatchObject({ stopped: true, permission: { participant: 'WITHDRAWN' }, beam: { successes: 0, effects: 0, state: 'FAILED' } });
    same(withdrawn.final.random, withdrawn.before.random); expect(validateDivineHandLifeState(final)).toBe(true);
  }, 60_000);

  it('reconciles the single original registry, actual movement, energy, mastery and weekly finances', () => {
    const final = capturedState('final'), original = capturedState('prefixFinal'), journal = final.divineHand.life.journal;
    const events = [...journal.map(r => ({ revision: r.revision, before: r.originalsBefore, after: r.originalsAfter })), ...divineHandEncounterOriginalEvents(final)].sort((a, b) => a.revision - b.revision);
    let originals = { site: original.glory.life.site };
    for (const event of events) { same(event.before, originals); originals = event.after; }
    same(originals, { site: final.glory.life.site }); same(originals, expected.currentOriginals); same(originals, divineHandExpectedOriginals(final));
    expect(captureValueHash(journal)).toBe(expected.lifeJournalSha256);
    expect(insertionOrderHash(final.divineHand.sourceHistory)).toBe(expected.sourceHistorySha256);
    expect(insertionOrderHash(final.divineHand.sourceScene)).toBe(expected.sourceSceneSha256);
    const recovery = replayCaptureBoundary('actual-paid-outside-energy-recovery');
    expect(recovery.before.cash - recovery.final.cash).toBe(15); expect(recovery.before.actionsRemaining - recovery.final.actionsRemaining).toBe(1);
    expect(recovery.final.glory.life.site.playerEnergy - recovery.before.glory.life.site.playerEnergy).toBe(20);
    expect(recovery.final.divineHand.life.clockSeconds - recovery.before.divineHand.life.clockSeconds).toBe(60);
    const acq = final.divineHand.acquisitionJournal, actions = finalRounds(final).flatMap(r => [...r.divineHandOutcome!.playerActions, ...r.divineHandOutcome!.enemyActions]);
    const costs = {
      acquisitionCash: sum(acq, r => r.before.cash - r.after.cash), acquisitionAP: sum(acq, r => r.before.actions - r.after.actions),
      lifeCash: sum(journal, r => r.before.cash - r.after.cash), lifeAP: sum(journal, r => r.before.actions - r.after.actions),
      lifeSpirituality: sum(journal, r => r.before.spirituality - r.after.spirituality), lifeMind: sum(journal, r => r.before.mind - r.after.mind),
      playerOrdinaryMetres: sum(journal, r => r.playerWalkedMetres), celiaOrdinaryMetres: sum(journal, r => r.celiaWalkedMetres), evanOrdinaryMetres: sum(journal, r => r.evanWalkedMetres),
      playerEnergySpent: sum(journal, r => r.playerEnergySpent), playerEnergyRecovered: sum(journal, r => r.playerEnergyRecovered),
      celiaEnergySpent: sum(journal, r => r.celiaEnergySpent), evanEnergySpent: sum(journal, r => r.evanEnergySpent),
      combatSpirituality: sum(actions.filter(a => a.actor === 'PLAYER'), a => a.paidCost), combatMindCasting: sum(actions.filter(a => a.actor === 'PLAYER'), a => a.mindCost),
      enemySpirituality: sum(actions.filter(a => a.actor === 'ENEMY'), a => a.paidCost),
      ordinaryWorkCount: captureCommands.slice(158).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: captureCommands.slice(158).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
    };
    same(costs, expected.actualCosts);
    expect(final.cash).toBe(original.cash + costs.ordinaryWorkCount * original.character.weeklyWage - costs.acquisitionCash - costs.lifeCash - (final.week - original.week) * 30);
    same(divineHandFinanceSnapshot(final), expected.finalFinance); assertOriginalContinuity(final, original);
    expect(validateDivineHandSource(final)).toBe(true); expect(validateDivineHandJournalContinuity(final)).toBe(true);
  }, 60_000);

  it('replays all seven ordered combat rounds and the single future-slot armor application', () => {
    const final = capturedState('final'), rounds = finalRounds(final), spent = new Set<string>();
    expect(rounds).toHaveLength(7); expect(rounds.map(captureValueHash)).toEqual(expected.roundHashes);
    let enemyPaid = 0;
    for (const round of rounds) {
      const save = replayCaptureBoundary(`combat-round-${round.round}`), o = round.divineHandOutcome!;
      same(o.source, currentDivineHandCombatSource(save.before)); same(replayDivineHandCombatRound(o.source, 'CONTROL').round, round);
      expect(o.source).toMatchObject({ targetId: 'DH1-OSCAR', targetAge: 43, actualBody: true, independentMind: true,
        policy: 'ALL', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'warrior-natural-v042' });
      expect(round.playerCount).toBe(divineHandActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(divineHandEnemyActionCount(round.enemyCountRoll));
      const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
      expect(actions.map(a => a.order)).toEqual(actions.map((_, i) => i));
      same(round.moves, actions.map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })));
      for (const a of actions) {
        expect(a.completedAtSeconds - a.atSeconds).toBe(5); expect(a.elapsedSeconds).toBe(5);
        expect(a.randomCursorAfter - a.randomCursorBefore).toBe(Number(a.check !== null));
        if (a.consumedMarkId) { expect(spent.has(a.consumedMarkId)).toBe(false); spent.add(a.consumedMarkId); expect(a.paidCost).toBe(7); }
        if (a.actor === 'PLAYER' && DIVINE_HAND_ABILITY_IDS.some(id => id === a.selectedAbility) && a.paidCost > 0) {
          expect([a.paidCost, a.mindCost]).toEqual([8, 2]); expect(a.masteryApplied).not.toContain(a.selectedAbility);
        }
        if (a.masteryApplied.includes(ARMOR)) {
          const window = a.windowsBefore.armorConvergence!;
          expect(a.actor).toBe('ENEMY'); expect(a.attackKind).toBe('BODY'); expect(a.selectedAbility).toBe('BODY_STRIKE');
          expect(window.openedOrder).toBeLessThan(a.order); expect(a.completedAtSeconds).toBeLessThan(window.expiresAt);
          expect(a.appliedWindowId).toBe(window.id); expect(a.armorWear).toBe(5);
          expect(a.originalsBefore.site.armor!.integrity - a.originalsAfter.site.armor!.integrity).toBe(5);
        }
        expect(a.masteryApplied).not.toContain(BEAM);
      }
      expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60);
      expect(o.source.playerSpirituality - o.playerSpiritualityAfter).toBe(sum(o.playerActions, a => a.paidCost));
      expect(save.final.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
      enemyPaid += sum(o.enemyActions, a => a.paidCost); expect(o.enemySpirituality).toBe(120 - enemyPaid);
      expect(o.materialsAfter.marks.filter(m => m.status === 'SPENT')).toHaveLength(spent.size);
      same(o.windowsAfter, { beamStabilize: null, armorConvergence: null, armorTemper: null });
    }
    const actions = rounds.flatMap(r => [...r.divineHandOutcome!.playerActions, ...r.divineHandOutcome!.enemyActions]);
    same(Object.fromEntries(DIVINE_HAND_ABILITY_IDS.map(id => [id, {
      plannedSelections: actions.filter(a => a.actor === 'PLAYER' && a.planned === id).length,
      paidAttempts: actions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0).length,
      successfulChecks: actions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.check && ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier)).length,
      actualApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
    }])), expected.combatAbilityUse);
    expect(rounds.map(r => r.divineHandOutcome!.originalsAfter.site.armor!.integrity)).toEqual([55, 50, 50, 50, 50, 50, 50]);
    expect(captureValueHash(final.divineHand.encounter)).toBe(expected.encounterSha256);
  }, 60_000);

  it('reopens the actual player death with Oscar alive and rejects postmortem actions without manufacturing an exit', () => {
    const final = capturedState('final'), before = capturedState('beforeLast'), intent = naturalEntry<SliceIntent>('lastIntent');
    same(captureCommands.at(-1), intent); same(applySliceIntent(before, intent), final);
    const reopened = currentCapture(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(projectSliceState(reopened), projectSliceState(final)); same(captureBody(reopened), expected.final);
    expect(reopened).toMatchObject({ status: 'DEAD', health: 0, week: 175, revision: 739 });
    expect(reopened.divineHand.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 7,
      enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING', exitMetres: 0, exitSeconds: 0 });
    expect(projectSliceState(reopened).canAct).toBe(false); expect(projectSliceState(reopened).combat).toBeNull();
    expect(projectSliceState(reopened).divineHand.actions.some(a => a.enabled)).toBe(false);
    expect(boundaryIndex['actual-work-after-living-exit']).toBeUndefined();
    for (const blocked of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
      { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'DIVINE_HAND', command: { type: 'LEAVE_ENCOUNTER' } },
      { type: 'CONTINUE_LIFE' }] satisfies SliceIntent[]) {
      const hash = captureValueHash(reopened); expect(() => applySliceIntent(reopened, blocked)).toThrow(); expect(captureValueHash(reopened)).toBe(hash);
    }
  }, 60_000);
});
