import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { FATE_PROPHET_PREPARATION_IDS } from '../../src/domain/fate-prophet/types.js';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createChaosWalkerLifeState } from '../../src/domain/chaos-walker/life.js';
import { combatBody, createFateProphetEncounterState, fateProphetApproachedRoot, hasFateProphetDisputeOpponent, settleFateProphetEncounter, validateFateProphetEncounter, validateFateProphetEncounterCommand } from '../../src/domain/fate-prophet/encounter.js';
import { FATE_PROPHET_COUNT_WHEEL, FATE_PROPHET_ENEMY_COUNT_WHEEL, FATE_PROPHET_ENEMY_ABILITY_WHEEL, FORESIGHT, HAZARD, createFateProphetRuntime, drawFateProphetEnemyAbility, fateProphetAbilityWheel,
  nextFateProphetCombatSource, replayFateProphetCombatRound, resolveFateProphetEnemySlot, resolveFateProphetPlayerSlot, validateFateProphetCombatRound, validateFateProphetRoundOutcome, validFateProphetCombatSource, type FateProphetCombatSource } from '../../src/domain/fate-prophet/combat.js';
import { FATE_PROPHET_CASE_IDS, type FateProphetActivityCommand, type FateProphetCaseId } from '../../src/domain/fate-prophet/life.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance, type SliceWeeklyFinanceState, type SliceWeeklyFinanceResult } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { directedInitial3, dose, fp, promoted, rejectFateProphet, rejectIntent, step } from './fate-prophet-directed-helper.js';

/** Declared UNIT-only original source. Never edits source fixture, seed or natural command history. */
function source(luck = 1): FateProphetCombatSource {
  const root = createChaosWalkerLifeState(); root.introducedWeek = 1; root.playerLocation = 'A'; root.volunteer.location = 'OUTSIDE'; root.guide.location = 'OUTSIDE'; root.clockSeconds = 16; root.playerTravelMetres = 4; root.guideTravelMetres = 4;
  const before = { cash: 1000, actions: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, sequence: 2 as const, acting: 100, coreStats: { physique: 10, perception: 20, will: 30, knowledge: 40 }, mastery: {}, completedSources: [], injuries: [], injuryRisk: 0,
    luck: { stored: luck, accumulated: 12 + luck, spent: 12, lastAccumulateWeek: 1 } };
  const date = { epoch: 'FIFTH_EPOCH' as const, year: 1349, month: 6, day: 28 };
  return { runId: 'fate-combat-declared-unit', revision: 4, week: 1, date, round: 1, encounterId: 'FATE_PROPHET_DISPUTE', targetId: 'FP2-ROWAN', attemptWeek: 1, startHistoryIndex: 0,
    targetName: '洛温·米勒', targetAge: 42, targetPathway: 'original-caster', targetSequence: 3, targetCore: 22, actualBody: true, independentMind: true, enemyWeapon: 'FP2-ROWAN-ROD', weaponOwner: 'FP2-ROWAN', yardId: 'CW3-MECHANICAL-WORKSHOP', enemyPosition: 'BETWEEN_A_AND_B', enemyDistanceMetres: 2,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, playerHealth: 100, playerMind: 98, playerSpirituality: 120, playerInjuries: [], playerRisk: 0,
    ...before.coreStats, calculationMastery: 0, awarenessMastery: 0, stormMastery: 0, passiveMastery: 0, clubHeld: false, luck: { ...before.luck },
    preparation: { week: 1, date, revision: 2, runId: 'fate-combat-declared-unit', randomSeed: 'fate-combat-declared-unit', randomCursor: 0, mindPaid: 2, lifeJournalLength: 1, lifeClockSeconds: 0, before, after: { ...before, mind: 98 },
      finance: { weeklyBudget: 100, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 'NORMAL' } },
    root, body: combatBody(createFateProphetEncounterState()), randomSeed: 'fate-combat-declared-unit', randomCursor: 0 };
}
function random(...rolls: number[]): ActionRandomStream { let cursor = 0; return { seed: 'declared-slot-unit', get cursor() { return cursor; }, nextInt(min, max) { const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected declared draw ${n} in ${min}..${max}`); return n; } }; }
function scripted(rolls: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = rolls[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${n} in ${min}..${max}`); return n;
  });
}
afterEach(() => vi.restoreAllMocks());
const act = (s: SliceState, c: FateProphetActivityCommand) => fp(s, c);
function ordinary(s: SliceState, id: FateProphetCaseId): SliceState {
  s = act(s, { type: 'OBSERVE', caseId: id }); s = act(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); s = act(s, { type: 'MANUAL_INSPECTION', caseId: id });
  s = act(s, { type: id === 'finite-disc' ? 'SPIN_DISC' : 'RELEASE_CART', caseId: id });
  if (id === 'finite-disc') { s = act(s, { type: 'WALK', caseId: id, to: 'B' }); s = act(s, { type: 'READ_RECORD', caseId: id }); s = act(s, { type: 'WALK', caseId: id, to: 'A' }); }
  else { s = act(s, { type: 'WALK', caseId: id, to: s.chaosWalker.life.cart.location }); s = act(s, { type: 'RETURN_CART', caseId: id }); }
  s = act(s, { type: 'RETURN_OBJECT', caseId: id }); s = act(s, { type: 'WALK', caseId: id, to: 'START' }); s = act(s, { type: 'INSPECT', caseId: id }); s = act(s, { type: 'LEAVE', caseId: id }); return act(s, { type: 'REPORT', caseId: id });
}
let completed: SliceState | undefined;
function ready(): SliceState { if (!completed) { let s = promoted(); for (const id of FATE_PROPHET_CASE_IDS) s = ordinary(s, id); completed = act(s, { type: 'REFLECT' }); } return structuredClone(completed); }
function fighting(): SliceState { return fp(fp(fp(ready(), { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' }); }

/** All finance variations are declared before any new journal; only public
 * acquisition/life/encounter commands execute afterward. */
function financialReady(cash?: number, finance: Partial<Pick<SliceState, 'debts' | 'missedWeeks' | 'credit' | 'lifeTier' | 'nextLifeTier'>> = {}, actionsAtReady = 2, newDebt = false): SliceState {
    // Declared pre-journal UNIT action budget, followed only by real public commands.
    let s = directedInitial3(); s.actionsRemaining = s.weeklyBudget = 100 - ready().actionsRemaining + actionsAtReady;
    if (cash !== undefined) s.cash -= ready().cash - cash;
    Object.assign(s, finance);
    if (newDebt) s.debts[0]!.createdWeek = s.week;
    // Select one bounded original-seed UNIT source before any new journal, never
    // alter a recorded draw: successful potion, six ordinary physical draws,
    // then two actual count draws and an ordinary successful retreat check.
    const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let cursor: number | null = null;
    for (let candidate = s.random.cursor; candidate < s.random.cursor + 128; candidate++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, candidate), potion = rng.nextInt(1, 100);
      for (let n = 0; n < 8; n++) rng.nextInt(1, 100);
      if (potion > 5 && potion <= chance && rng.nextInt(1, 100) <= 50) { cursor = candidate; break; }
    }
    expect(cursor).not.toBeNull(); s.random.cursor = cursor!; assertValidSliceState(s);
    s = fp(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' }); s = fp(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, dose);
    for (const id of FATE_PROPHET_CASE_IDS) s = ordinary(s, id); s = act(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(actionsAtReady);
    return s;
}

describe('Fate Prophet original body combat and strict replay', () => {
  it('shared financial extraction is exactly equivalent to the original ordinary BILL/DEBTS branches', () => {
    // Frozen pre-extraction oracle, confined to this test. No production mirror.
    const original = (input: SliceWeeklyFinanceState): SliceWeeklyFinanceResult => {
      const s = structuredClone(input), receipts: SliceWeeklyFinanceResult['receipts'] = [];
      const note = (title: string, text: string) => { receipts.push({ title, text }); };
      const done = (eventId: SliceWeeklyFinanceResult['eventId'] = null) => ({ state: s, receipts, eventId });
      if (s.pulse === 'BILL') {
        const cost = SLICE_LIFE[s.lifeTier].cost; s.billAmount = cost;
        if (s.cash >= cost) { s.cash -= cost; note('本周生活费', `已支付${cost}便士，工作工资不重复入账。`); s.pulse = 'DEBTS'; }
        else if (s.credit === 'SUSPENDED') { const paid = s.cash; s.cash = 0; s.debts.push({ id: `debt-${s.week}-${s.revision + 1}-${s.debts.length}`, source: '生活应付款', remaining: cost - paid, weeklyPayment: 30, createdWeek: s.week }); s.nextLifeTier = 'DESTITUTE'; note('生活费如实记账', `已付${paid}便士，剩余${cost - paid}便士计欠，下周转赤贫。`); s.pulse = 'DEBTS'; }
        else return done('LIFE-BILL-01');
      }
      if (s.pulse === 'DEBTS') {
        const before = s.debts.reduce((sum, d) => sum + d.remaining, 0); let due = 0, paid = 0;
        for (const d of s.debts) { if (d.createdWeek >= s.week) continue; const amount = Math.min(d.remaining, d.weeklyPayment); due += amount; const p = Math.min(amount, s.cash); d.remaining -= p; s.cash -= p; paid += p; }
        if (due > 0) { s.missedWeeks = paid === due ? 0 : s.missedWeeks + 1; note('本周约定还款', `应付${due}便士，实际支付${paid}便士；未付款仍在本金中，不重复计债。`); }
        if (before > 0 && s.debts.every(d => d.remaining === 0)) { s.missedWeeks = 0; s.credit = 'NORMAL'; note('账目结清', '最后一笔应付款已结清。旧记录保留，当前不再要求还款。'); } s.pulse = 'ADVANCE';
        if (s.missedWeeks >= 4 && s.credit !== 'SUSPENDED') { s.credit = 'SUSPENDED'; return done('DEBT-SETTLE-01'); }
        if (s.missedWeeks >= 2 && s.credit === 'NORMAL') { s.credit = 'NOTICE'; return done('DEBT-NOTICE-01'); }
      }
      return done();
    };
    const old = { id: 'old', source: 'contract', remaining: 20, weeklyPayment: 30, createdWeek: 1 }, recent = { ...old, id: 'recent', createdWeek: 2 };
    let cases = 0;
    for (const lifeTier of Object.keys(SLICE_LIFE) as SliceState['lifeTier'][]) for (const pulse of ['BILL', 'DEBTS', 'ADVANCE'] as const)
      for (const credit of ['NORMAL', 'NOTICE', 'SUSPENDED'] as const) for (const cash of [0, 20, 30, 10000]) for (const missedWeeks of [0, 1, 3, 4])
        for (const debts of [[], [old], [{ ...old, remaining: 100 }, { ...old, id: 'second', remaining: 50 }, recent]]) {
          const input: SliceWeeklyFinanceState = { week: 2, revision: 10, cash, lifeTier, nextLifeTier: 'POOR', debts, missedWeeks, credit, pulse, billAmount: pulse === 'BILL' ? 0 : SLICE_LIFE[lifeTier].cost };
          const saved = structuredClone(input); expect(resolveSliceWeeklyFinance(input)).toEqual(original(input)); expect(input).toEqual(saved); cases++;
        }
    expect(cases).toBe(2160);
  });
  it('preserves all six slot weights, old counts, Wheel core weights, independent caster and original-seed replay', () => {
    const x = source(); expect(validFateProphetCombatSource(x)).toBe(true);
    expect(fateProphetAbilityWheel({} as SliceState, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(FATE_PROPHET_COUNT_WHEEL).toEqual(FATE_PROPHET_ENEMY_COUNT_WHEEL);
    expect(FATE_PROPHET_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]); expect([1, 36, 61, 86, 96].map(n => drawFateProphetEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
    const result = replayFateProphetCombatRound(x, 'CONTROL'); expect(validateFateProphetCombatRound(result.round)).toBe(true); expect(validateFateProphetRoundOutcome(result.round.fateProphetOutcome)).toBe(true); expect(replayFateProphetCombatRound(x, 'CONTROL')).toEqual(result);
    const spy = scripted([100, 1, 1, 426, 96, 1]); const r = replayFateProphetCombatRound(x, 'ATTACK').round; spy.mockRestore();
    expect(r.playerAdvantage).toBe(1250 + 10 * .15 + 20 * .2 + 30 * .4 + 40 * .25 - 22.5); expect(r.enemyAdvantage).toBe(1272 - 22.5); expect(r.consequenceDomain).toBeUndefined();
  });
  it('foresight never previews a future draw, costs5S1M and mitigates only the next actual attack30%', () => {
    const x = source(), r = createFateProphetRuntime(x), rng = random(1);
    const cast = resolveFateProphetPlayerSlot(x, r, FORESIGHT, 0, rng); expect(rng.cursor).toBe(1); expect(cast).toMatchObject({ paidCost: 5, mindCost: 1, luckCost: 0, succeeded: true, pendingAfter: 'FORESIGHT' });
    const duplicate = resolveFateProphetPlayerSlot(x, r, FORESIGHT, 1, random()); expect(duplicate).toMatchObject({ paidCost: 0, mindCost: 0, fallbackReason: 'ONE_PENDING_WINDOW', selectedAbility: 'OBSERVE' });
    expect(resolveFateProphetEnemySlot(x, r, 'WARD', 2, random())).toMatchObject({ pendingApplied: null, paidCost: 4, pendingAfter: 'FORESIGHT' });
    expect(resolveFateProphetEnemySlot(x, r, 'ACCIDENT', 3, random())).toMatchObject({ pendingApplied: null, selfGain: -22.5, pendingAfter: 'FORESIGHT' });
    expect(resolveFateProphetEnemySlot(x, r, 'ARC_BOLT', 4, random())).toMatchObject({ pendingApplied: 'FORESIGHT', paidCost: 5, rawContribution: 70, selfGain: 49, pendingAfter: null });
    expect(resolveFateProphetEnemySlot(x, r, 'BODY_STRIKE', 5, random()).selfGain).toBe(20); expect(r.luck).toEqual(x.luck); expect([r.playerS, r.playerM]).toEqual([115, 97]);
  });
  it('hazard pays only real stored luck and shared round cap survives failure, with truthful HOLD fallback', () => {
    const x = source(3), r = createFateProphetRuntime(x, 'SPEND_FIRST');
    expect(resolveFateProphetPlayerSlot(x, r, HAZARD, 0, random(100))).toMatchObject({ paidCost: 5, mindCost: 1, luckCost: 1, succeeded: false }); expect(r.luck).toMatchObject({ stored: 2, spent: 13 });
    expect(resolveFateProphetPlayerSlot(x, r, HAZARD, 1, random())).toMatchObject({ luckCost: 0, paidCost: 3, selectedAbility: 'wheel.s6.mental-storm', fallbackReason: 'RESOURCES_OR_ROUND_LUCK_CAP' });
    const hold = createFateProphetRuntime(x); expect(resolveFateProphetPlayerSlot(x, hold, HAZARD, 0, random())).toMatchObject({ luckCost: 0, paidCost: 3, mindCost: 0, fallbackReason: 'HOLD_LUCK' }); expect(hold.luck).toEqual(x.luck);
    const zero = createFateProphetRuntime(source(0), 'SPEND_FIRST'); expect(resolveFateProphetPlayerSlot(x, zero, HAZARD, 0, random()).luckCost).toBe(0); expect(zero.luck.spent).toBe(12);
    const old = createFateProphetRuntime(x, 'SPEND_FIRST'); old.playerM = 0;
    expect(resolveFateProphetPlayerSlot(x, old, FORESIGHT, 0, random(100))).toMatchObject({ selectedAbility: 'wheel.s3.deviation-buffer', paidCost: 5, mindCost: 0, luckCost: 1, succeeded: false });
    expect(resolveFateProphetPlayerSlot(x, old, HAZARD, 1, random())).toMatchObject({ selectedAbility: 'wheel.s6.mental-storm', luckCost: 0 }); expect(old.body.luckAttempts).toBe(1);
  });
  it('hazard reduces actual positive body or arc50%, full cost remains, and compose cancels without refund', () => {
    const x = source(), r = createFateProphetRuntime(x, 'SPEND_FIRST'); resolveFateProphetPlayerSlot(x, r, HAZARD, 0, random(1));
    expect(resolveFateProphetEnemySlot(x, r, 'ARC_BOLT', 1, random())).toMatchObject({ rawContribution: 70, selfGain: 35, paidCost: 5, pendingApplied: 'HAZARD_ADJUSTMENT' });
    expect([r.playerS, r.playerM, r.luck.stored, r.luck.spent, r.body.enemySpirituality]).toEqual([115, 97, 0, 13, 115]);
    const cancelled = createFateProphetRuntime(x, 'SPEND_FIRST'); resolveFateProphetPlayerSlot(x, cancelled, HAZARD, 0, random(1));
    expect(resolveFateProphetEnemySlot(x, cancelled, 'COMPOSE', 1, random())).toMatchObject({ paidCost: 4, pendingAfter: null, pendingApplied: null, selfGain: 8 });
    expect(resolveFateProphetPlayerSlot(x, cancelled, FORESIGHT, 2, random(1))).toMatchObject({ paidCost: 5, mindCost: 1, succeeded: false, resisted: true });
    expect(cancelled.luck.stored).toBe(0); expect(cancelled.luck.spent).toBe(13); expect(cancelled.body.pendingKind).toBeNull();
    cancelled.body.enemySpirituality = 0; expect(resolveFateProphetEnemySlot(x, cancelled, 'ARC_BOLT', 3, random())).toMatchObject({ selectedAbility: 'BODY_STRIKE', paidCost: 0, rawContribution: 20, fallbackReason: 'INSUFFICIENT_ENEMY_SPIRITUALITY' });
  });
  it('expires unused window, consumes no refund, and carries the single original luck ledger and finite resources', () => {
    const x = source(), spy = scripted([100, 1, 1, 275, 1, 40, 1000000]);
    const result = replayFateProphetCombatRound(x, 'CONTROL', 'SPEND_FIRST'); spy.mockRestore();
    const o = result.round.fateProphetOutcome!; expect(o.expiredPending).toBe('HAZARD_ADJUSTMENT'); expect(o.pendingKind).toBeNull(); expect(o.playerSpiritualityAfter).toBe(115); expect(o.playerMindAfter).toBe(97); expect(o.luckAfter).toMatchObject({ stored: 0, spent: 13 });
    const next = nextFateProphetCombatSource(o); expect(next.randomCursor).toBe(o.randomCursorAfter); expect(next.randomSeed).toBe(x.randomSeed); expect(next.luck).toEqual(o.luckAfter); expect(next.playerSpirituality).toBe(120); expect(next.root.clockSeconds).toBe(76);
  });
  it('mental-only pressure never fabricates a physical injury; arc/body retain real injury/death', () => {
    const x = source(), mental = scripted([100, 1, 1, 275, 40, 1]); const m = replayFateProphetCombatRound(x, 'CONTROL'); mental.mockRestore();
    expect(m.round.consequenceDomain).toBe('MENTAL'); expect(m.round.consequenceWeights).toBeNull(); expect(m.round.fateProphetOutcome!.enemyMind).toBe(90); expect(m.round.fateProphetOutcome!.enemyHealth).toBe(100); expect(m.round.fateProphetOutcome!.enemyInjuries).toEqual([]);
    const death = scripted([100, 1, 1, 426, 1, 1000000, 100]); const d = replayFateProphetCombatRound(x, 'ATTACK'); death.mockRestore();
    expect(d.outcome).toBe('PLAYER_DEAD'); expect(d.round.consequenceDomain).toBe('BODY'); expect(d.round.fateProphetOutcome!.playerHealthAfter).toBe(0); expect(d.round.fateProphetOutcome!.rootAfter.playerLocation).toBe('A');
    const enemyDeath = scripted([100, 1, 1, 1, 96, 1, 100]); const e = replayFateProphetCombatRound(x, 'ATTACK'); enemyDeath.mockRestore(); expect(e.outcome).toBe('ENEMY_DEAD'); expect(e.round.fateProphetOutcome!.weaponLocation).toBe('COURT');
  });
  it('successful retreat never takes passive/action previews and terminal forgery cannot validate', () => {
    const x = source(), spy = scripted([1, 1, 1]); const r = replayFateProphetCombatRound(x, 'RETREAT'); spy.mockRestore(); expect(r.outcome).toBe('RETREATED'); expect(r.round.fateProphetOutcome!.passiveLuck).toBeNull(); expect(r.round.fateProphetOutcome!.playerActions).toEqual([]); expect(r.round.fateProphetOutcome!.randomCursorAfter).toBe(3);
    const original = replayFateProphetCombatRound(x, 'DEFEND').round;
    for (const change of [ (o: typeof original) => { o.playerAdvantage++; }, (o: typeof original) => { o.fateProphetOutcome!.source.randomCursor++; }, (o: typeof original) => { o.fateProphetOutcome!.source.randomSeed += 'forged'; }, (o: typeof original) => { o.fateProphetOutcome!.luckAfter.accumulated++; }, (o: typeof original) => { o.fateProphetOutcome!.enemySpirituality++; }, (o: typeof original) => { o.fateProphetOutcome!.rootAfter.clockSeconds++; }, (o: typeof original) => { o.fateProphetOutcome!.source.enemyWeapon = 'FREE_STAFF' as never; }, (o: typeof original) => { o.fateProphetOutcome!.source.root.volunteer.location = 'A'; }, (o: typeof original) => { o.fateProphetOutcome!.source.date = { ...o.fateProphetOutcome!.source.date, day: o.fateProphetOutcome!.source.date.day + 1 }; } ]) { const fake = structuredClone(original); change(fake); expect(validateFateProphetCombatRound(fake), change.toString()).toBe(false); }
  });
  it('requires all real reports and explicit clearance, allows unpaid ordinary exit, preserves both old opponents and history', () => {
    expect(validateFateProphetEncounterCommand({ type: 'ENCOUNTER_FIGHT', target: 'arbitrary' })).toBe(false); rejectFateProphet(promoted(), { type: 'PREPARE_ENCOUNTER' });
    let s = ready(); const old = [structuredClone(s.misfortuneMage.encounter), structuredClone(s.chaosWalker.encounter), structuredClone(s.combatHistory)], root = structuredClone(s.chaosWalker.life), mind = s.mind;
    s = fp(s, { type: 'PREPARE_ENCOUNTER' }); expect(s.mind).toBe(mind - 2); rejectIntent(s, { type: 'ACTION', action: 'REST' }); rejectFateProphet(s, { type: 'ENCOUNTER_FIGHT' });
    s = fp(s, { type: 'ENCOUNTER_TALK' }); expect(s.chaosWalker.life).toEqual(fateProphetApproachedRoot(root, s.week)); expect(s.fateProphet.encounter.clearance).toMatchObject({ veraConsent: 'GRANTED', veraMetres: 8, guideConsent: 'GRANTED', guideMetres: 4, elapsedSeconds: 16 });
    const before = [s.actionsRemaining, s.spirituality, s.mind, structuredClone(s.winner.luck)]; s = fp(s, { type: 'LEAVE_ENCOUNTER' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.winner.luck]).toEqual(before); expect(s.chaosWalker.life.clockSeconds).toBe(root.clockSeconds + 20); expect(s.chaosWalker.life.playerLocation).toBe('START'); expect([s.chaosWalker.life.volunteer.location, s.chaosWalker.life.guide.location]).toEqual(['OUTSIDE', 'OUTSIDE']);
    expect([s.misfortuneMage.encounter, s.chaosWalker.encounter, s.combatHistory]).toEqual(old); expect(validateFateProphetEncounter(s)).toBe(true); assertValidSliceState(s); rejectFateProphet(s, { type: 'PREPARE_ENCOUNTER' });
  });
  it('public combat preserves default HOLD and closes real injury or death without reviving either body', () => {
    const start = fighting(), omitted = step(start, { type: 'COMBAT_ROUND', stance: 'ATTACK' }), held = step(start, { type: 'COMBAT_ROUND', stance: 'ATTACK', winnerPolicy: 'HOLD' });
    expect(omitted).toEqual(held); expect(held.winner.luck).toEqual(start.winner.luck); let s = held;
    for (let n = 1; n < 24 && s.combat; n++) s = step(s, { type: 'COMBAT_ROUND', stance: 'ATTACK' });
    expect(s.combat).toBeNull(); expect(s.fateProphet.encounter.terminal).not.toBeNull(); expect(validateFateProphetEncounter(s)).toBe(true); assertValidSliceState(s);
    const terminal = s.fateProphet.encounter.terminal!; expect(terminal.exitMetres).toBe(s.health > 0 ? 4 : 0);
    if (s.health === 0) { expect(s.status).toBe('DEAD'); expect(terminal.outcome).toBe('PLAYER_DEAD'); expect(s.chaosWalker.life.playerLocation).toBe('A'); rejectIntent(s, { type: 'ACTION', action: 'REST' }); }
    const fake = structuredClone(s); fake.spirituality++; expect(validateFateProphetEncounter(fake)).toBe(false);
  });
  it('zero-action terminal releases only the exact paid weekly boundary, rejecting extra cash, dates, actions or missing receipts', () => {
    let s = financialReady();
    s = fp(fp(fp(s, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' }); expect(s.actionsRemaining).toBe(0);
    const before = structuredClone(s), cost = SLICE_LIFE[s.lifeTier].cost;
    for (let n = 0; n < 24 && s.combat; n++) s = step(s, { type: 'COMBAT_ROUND', stance: 'RETREAT' });
    expect(s.status).toBe('ACTIVE'); expect(s.combat).toBeNull(); expect(s.week).toBe(before.week + 1); expect(s.date).toEqual(addGameWeeks(before.date, 1)); expect(s.cash).toBe(before.cash - cost); expect(s.actionsRemaining).toBe(s.weeklyBudget);
    const outcome = s.lastCombatRound!.fateProphetOutcome!; expect([s.health, s.mind, s.spirituality, s.random.cursor, s.winner.luck]).toEqual([outcome.playerHealthAfter, outcome.playerMindAfter, outcome.playerSpiritualityAfter, outcome.randomCursorAfter, outcome.luckAfter]);
    expect(validateFateProphetEncounter(s)).toBe(true); assertValidSliceState(s);
    for (const change of [(x: SliceState) => { x.cash++; }, (x: SliceState) => { x.cash--; }, (x: SliceState) => { x.actionsRemaining--; }, (x: SliceState) => { x.date.day++; }, (x: SliceState) => { x.week++; }, (x: SliceState) => { x.chronicle = x.chronicle.filter(e => e.title !== '本周生活费'); }, (x: SliceState) => { x.spirituality++; }, (x: SliceState) => { x.random.cursor++; }]) { const fake = structuredClone(s); change(fake); expect(validateFateProphetEncounter(fake), change.toString()).toBe(false); }
  });
  // Windows CI measured the complete NOTICE scenario at 8168ms. Keep every
  // acquisition, finance and forgery assertion within a bounded full-case budget.
  it.each([
    { name: 'same-week actions retain original debt', cash: 40, debt: 100, credit: 'SUSPENDED', missed: 4, actions: 3, paidCash: 40, remaining: [100], finalCredit: 'SUSPENDED', finalMissed: 4, event: null, advanced: false },
    { name: 'paid debt-free boundary advances unchanged', cash: 100, debt: 0, credit: 'NORMAL', missed: 0, paidCash: 70, remaining: [], finalCredit: 'NORMAL', finalMissed: 0, event: null, advanced: true },
    { name: 'contractual repayment advances with remaining debt', cash: 100, debt: 100, credit: 'NOTICE', missed: 2, paidCash: 40, remaining: [70], finalCredit: 'NOTICE', finalMissed: 0, event: null, advanced: true },
    { name: 'last contractual repayment clears credit', cash: 100, debt: 20, credit: 'SUSPENDED', missed: 4, paidCash: 50, remaining: [0], finalCredit: 'NORMAL', finalMissed: 0, event: null, advanced: true },
    { name: 'second missed payment opens NOTICE before advance', cash: 40, debt: 100, credit: 'NORMAL', missed: 1, paidCash: 0, remaining: [90], finalCredit: 'NOTICE', finalMissed: 2, event: 'DEBT-NOTICE-01', advanced: false },
    { name: 'fourth missed payment opens SUSPENDED settlement', cash: 40, debt: 100, credit: 'NOTICE', missed: 3, paidCash: 0, remaining: [90], finalCredit: 'SUSPENDED', finalMissed: 4, event: 'DEBT-SETTLE-01', advanced: false },
    { name: 'NORMAL insufficient cash opens bill without deductions', cash: 20, debt: 100, credit: 'NORMAL', missed: 0, paidCash: 20, remaining: [100], finalCredit: 'NORMAL', finalMissed: 0, event: 'LIFE-BILL-01', advanced: false },
    { name: 'NOTICE insufficient cash opens bill without deductions', cash: 20, debt: 100, credit: 'NOTICE', missed: 2, paidCash: 20, remaining: [100], finalCredit: 'NOTICE', finalMissed: 2, event: 'LIFE-BILL-01', advanced: false },
    { name: 'SUSPENDED insufficient cash records actual shortfall and advances', cash: 20, debt: 100, credit: 'SUSPENDED', missed: 4, paidCash: 0, remaining: [100, 10], finalCredit: 'SUSPENDED', finalMissed: 5, event: null, advanced: true },
    { name: 'new debt is not prematurely collected', cash: 100, debt: 100, credit: 'NORMAL', missed: 0, newDebt: true, paidCash: 70, remaining: [100], finalCredit: 'NORMAL', finalMissed: 0, event: null, advanced: true },
    { name: 'changed lifestyle charges the original week tier', cash: 100, debt: 0, credit: 'NORMAL', missed: 0, nextTier: 'POOR', paidCash: 70, remaining: [], finalCredit: 'NORMAL', finalMissed: 0, event: null, advanced: true },
  ] as const)('reconciles exact ordinary finance: $name', scenario => {
    const debts = scenario.debt ? [{ id: 'declared-finance-unit-debt', source: 'Declared ordinary contractual debt', remaining: scenario.debt, weeklyPayment: 30, createdWeek: 0 }] : [];
    let s = financialReady(scenario.cash, { debts, missedWeeks: scenario.missed, credit: scenario.credit, lifeTier: 'DESTITUTE', nextLifeTier: 'nextTier' in scenario ? scenario.nextTier : 'DESTITUTE' },
      'actions' in scenario ? scenario.actions : 2, 'newDebt' in scenario && scenario.newDebt);
    s = fp(fp(fp(s, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' });
    const before = structuredClone(s), intent = { type: 'COMBAT_ROUND', stance: 'RETREAT' } as const;
    if (s.actionsRemaining === 0) {
      const input = { ...s, pulse: 'BILL' as const }, saved = structuredClone(input), result = resolveSliceWeeklyFinance(input);
      expect(input).toEqual(saved); expect(result.state.cash).toBe(scenario.paidCash); expect(result.state.debts.map(d => d.remaining)).toEqual(scenario.remaining);
      expect(result.state.credit).toBe(scenario.finalCredit); expect(result.state.missedWeeks).toBe(scenario.finalMissed); expect(result.eventId).toBe(scenario.event);
      expect(result.receipts.map(r => r.title)).toEqual(scenario.event === 'LIFE-BILL-01' ? [] : scenario.remaining.length === 2 ? ['生活费如实记账', '本周约定还款'] :
        scenario.debt && !('newDebt' in scenario) ? ['本周生活费', '本周约定还款', ...(scenario.remaining[0] === 0 ? ['账目结清'] : [])] : ['本周生活费']);
    }
    s = step(s, intent);
    expect(s.combat).toBeNull(); expect(s.fateProphet.encounter.terminal!.outcome).toBe('RETREATED'); expect(s.cash).toBe(scenario.paidCash);
    expect(s.debts.map(d => d.remaining)).toEqual(scenario.remaining); expect(s.credit).toBe(scenario.finalCredit); expect(s.missedWeeks).toBe(scenario.finalMissed); expect(s.activeEvent?.id ?? null).toBe(scenario.event);
    expect(s.week).toBe(before.week + Number(scenario.advanced)); expect(s.date).toEqual(scenario.advanced ? addGameWeeks(before.date, 1) : before.date);
    expect(s.actionsRemaining).toBe(scenario.advanced ? before.weeklyBudget : before.actionsRemaining);
    expect(s.lifeTier).toBe(scenario.advanced && 'nextTier' in scenario ? scenario.nextTier : 'DESTITUTE');
    expect(s.pulse).toBe(scenario.event === 'LIFE-BILL-01' ? 'BILL' : scenario.event ? 'ADVANCE' : 'NONE');
    expect(s.billAmount).toBe(scenario.event ? 30 : 0); expect(s.wagePaidWeek).toBe(before.wagePaidWeek);
    const outcome = s.lastCombatRound!.fateProphetOutcome!;
    expect([s.health, s.mind, s.spirituality, s.winner.luck, s.injuries, s.injuryRisk, s.random.cursor]).toEqual([outcome.playerHealthAfter, outcome.playerMindAfter, outcome.playerSpiritualityAfter, outcome.luckAfter, outcome.playerInjuriesAfter, outcome.playerRiskAfter, outcome.randomCursorAfter]);
    expect(validateFateProphetEncounter(s)).toBe(true); assertValidSliceState(s);
    // Terminal reconciliation must reject changes to the actual financial ledger.
    for (const mutate of [(x: SliceState) => { x.cash++; }, (x: SliceState) => { x.date = addGameWeeks(x.date, 1); }, (x: SliceState) => { x.actionsRemaining++; },
      (x: SliceState) => { x.debts.push({ id: 'forged-debt', source: 'fabricated', remaining: 1, weeklyPayment: 1, createdWeek: x.week }); },
      (x: SliceState) => { if (x.debts.length) x.debts[0]!.remaining++; else x.credit = 'NOTICE'; }, (x: SliceState) => { x.missedWeeks++; },
      (x: SliceState) => { x.nextLifeTier = 'LUXURIOUS'; }, (x: SliceState) => { x.billAmount++; }, (x: SliceState) => { x.fateProphet.encounter.preparation!.finance.weeklyBudget++; }]) {
      const forged = structuredClone(s); mutate(forged); expect(validateFateProphetEncounter(forged), mutate.toString()).toBe(false);
    }
    if (s.activeEvent) { const forged = structuredClone(s); forged.activeEvent!.instanceId += '-forged'; expect(validateFateProphetEncounter(forged)).toBe(false); }
  }, 10_000);
  it('finishes a bounded real original-seed encounter and rejects false closure and resource/position/history forgeries', () => {
    let s = fighting(); expect(hasFateProphetDisputeOpponent(s)).toBe(true); const old = [structuredClone(s.chaosWalker.encounter), structuredClone(s.misfortuneMage.encounter), structuredClone(s.combatHistory)];
    expect(() => settleFateProphetEncounter(structuredClone(s), 'ENEMY_DEAD', { note() {} } as never)).toThrow();
    for (const change of [(x: SliceState) => { x.winner.luck.stored++; x.winner.luck.accumulated++; }, (x: SliceState) => { x.health++; }, (x: SliceState) => { x.random.cursor++; }, (x: SliceState) => { x.fateProphet.encounter.status = 'RESOLVED'; x.combat = null; }, (x: SliceState) => { x.chaosWalker.life.volunteer.location = 'A'; }, (x: SliceState) => { x.fateProphet.encounter.startSource!.enemyWeapon = 'CW3-GARETH-ROD' as never; }, (x: SliceState) => { x.fateProphet.encounter.preparation!.before.luck.stored++; x.fateProphet.encounter.preparation!.before.luck.accumulated++; }]) { const fake = structuredClone(s); change(fake); expect(validateFateProphetEncounter(fake)).toBe(false); }
    for (let n = 0; n < 24 && s.combat; n++) { s = step(s, { type: 'COMBAT_ROUND', stance: 'RETREAT', winnerPolicy: 'HOLD' }); expect(validateFateProphetEncounter(s)).toBe(true); }
    expect(s.combat).toBeNull(); expect(s.fateProphet.encounter.terminal).not.toBeNull(); assertValidSliceState(s);
    expect([s.chaosWalker.encounter, s.misfortuneMage.encounter, s.combatHistory.slice(0, (old[2] as unknown[]).length)]).toEqual(old);
    expect(s.fateProphet.encounter.terminal!.exitMetres).toBe(s.health > 0 ? 4 : 0); expect(s.chaosWalker.life.playerLocation).toBe(s.health > 0 ? 'START' : 'A');
    const fake = structuredClone(s); fake.fateProphet.encounter.terminal!.exitSeconds = s.health > 0 ? 0 : 4; expect(validateFateProphetEncounter(fake)).toBe(false);
  });
});
