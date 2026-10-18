import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createMisfortuneMageState } from '../../src/domain/misfortune-mage/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveMisfortuneMageCombatRound } from '../../src/domain/slice/misfortune-mage-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { WinnerLuckPolicy } from '../../src/domain/winner/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { MISFORTUNE_MAGE_COUNT_WHEEL, MISFORTUNE_MAGE_ENEMY_COUNT_WHEEL, MISFORTUNE_MAGE_ENEMY_ABILITY_WHEEL,
  misfortuneMageAbilityWheel, misfortuneMageActionCount, misfortuneMageEnemyActionCount, drawMisfortuneMageAbility, drawMisfortuneMageEnemyAbility,
  currentMisfortuneMageCombatSource, beginMisfortuneMageCombatRound, resolveMisfortuneMageCombatAbility, resolveMisfortuneMageEnemyAbility,
  finishMisfortuneMageCombatRound, validateMisfortuneMageRoundOutcome, projectMisfortuneMageCombat, type MisfortuneMageMoveId } from '../../src/domain/misfortune-mage/combat.js';
import { applyMisfortuneMageEncounterCommand, misfortuneMageEncounterReason, hasMisfortuneMageDisputeOpponent,
  projectMisfortuneMageEncounter, settleMisfortuneMageEncounter, validateMisfortuneMageEncounter, validateMisfortuneMageEncounterCommand } from '../../src/domain/misfortune-mage/encounter.js';
import { WINNER_COUNT_WHEEL } from '../../src/domain/winner/combat.js';

const H = 'BODY_STRIKE', J = 'BODY_FOLLOWUP', B = 'wheel.s4.precaution-practice', K = 'wheel.s4.bounded-misfortune', R = 'OBSERVE';
const profile: readonly [MisfortuneMageMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: MisfortuneMageMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'misfortune-mage-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed unit setup only. The unchanged261-command original prefix is independently exercised by the natural script. */
function fixture(start = true): SliceState {
  const s = createSliceRun('misfortune-mage-combat-directed', sliceDefaultCreationSelection, 'misfortune-mage-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'wheel', sequence: 4, mastery: { [B]: 0, [K]: 0, 'wheel.s8.calculation-control': 0,
    'wheel.s6.disaster-awareness': 0, 'wheel.s6.mental-storm': 0, 'wheel.s7.passive-luck': 0 }, acting: 0, promotionWeek: 110 };
  s.misfortuneMage = createMisfortuneMageState(); s.misfortuneMage.promotionWeek = 110; s.misfortuneMage.winnerActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.winner.luck = { stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67 };
  s.misfortuneMage.life.cases['uncertain-weight'].status = 'RESOLVED';
  if (start) applyMisfortuneMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function begin(s: SliceState, policy: WinnerLuckPolicy = 'HOLD', stance: SliceStance = 'ATTACK', passiveRoll = 100) {
  return beginMisfortuneMageCombatRound(s, stance, random(...(stance === 'RETREAT' ? [] : [passiveRoll])), policy);
}
function effect(s: SliceState, id: MisfortuneMageMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) {
  return resolveMisfortuneMageCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolveMisfortuneMageEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) {
  return resolveMisfortuneMageEnemyAbility(s, id, physical, random(), r);
}
function play(s: SliceState, stance: SliceStance, policy: WinnerLuckPolicy, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveMisfortuneMageCombatRound(s, stance, policy); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Candidate G Misfortune Mage profile and original Ferris', () => {
  it('keeps exact old Winner count and stance weights with2–4 real enemy actions', () => {
    const s = fixture(); expect(MISFORTUNE_MAGE_COUNT_WHEEL).toEqual(WINNER_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(MISFORTUNE_MAGE_COUNT_WHEEL);
    expect(misfortuneMageAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(misfortuneMageAbilityWheel(s, null));
    for (const [id] of profile) expect(drawMisfortuneMageAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(misfortuneMageActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(MISFORTUNE_MAGE_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(misfortuneMageEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(MISFORTUNE_MAGE_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawMisfortuneMageEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('preserves wheel15/20/40/25 core,1250/floor125 and enemy850/floor85', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 'HOLD', 100, 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .15 + 20 * .2 + 30 * .4 + 40 * .25, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40) - 45); expect(result.round.consequenceWeights).toBeNull();
    expect(validateMisfortuneMageEncounter(s)).toBe(true);
  });
  it('uses a new original adult and real40SP without reopening Aldry or changing old originals', () => {
    const s = fixture(false), old = structuredClone({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamity: s.calamityPriest, winner: s.winner });
    applyMisfortuneMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamity: s.calamityPriest, winner: s.winner }).toEqual(old);
    expect(currentMisfortuneMageCombatSource(s)).toMatchObject({ targetId: 'MM4-FERRIS-LORNE', distanceMetres: 2, targetSequence: 5,
      noBystanders: true, ordinaryExit: true, pursuit: false, looseObjectSource: false, disasterTrigger: false, enemyWeapon: 'MM4-FERRIS-CLUB' });
    expect(hasMisfortuneMageDisputeOpponent(s)).toBe(true); expect(validateMisfortuneMageEncounter(s)).toBe(true);
    expect(projectMisfortuneMageEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3, 3]);
  });
  it('requires closed reports and actual original props, then permits one ordinary refusal', () => {
    const s = fixture(false); s.misfortuneMage.life.cases['uncertain-weight'].status = 'AVAILABLE';
    expect(misfortuneMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.misfortuneMage.life.cases['uncertain-weight'].status = 'RESOLVED'; s.winner.practice.ring = 'MAT';
    expect(misfortuneMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('归还');
    s.winner.practice.ring = 'OWNER'; const oldLuck = structuredClone(s.winner.luck);
    applyMisfortuneMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(s.winner.luck).toEqual(oldLuck);
    expect(s.misfortuneMage.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(validateMisfortuneMageEncounter(s)).toBe(true); expect(() => applyMisfortuneMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateMisfortuneMageEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
  it('rejects stale source and changed real funds without costs or draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.winner.luck.stored--; s.winner.luck.spent++; },
      (s: SliceState) => { s.spirituality--; }]) {
      const s = fixture(), r = begin(s, 'SPEND_FIRST'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = begin(s, 'SPEND_FIRST');
    expect(resolveMisfortuneMageCombatAbility(s, K, 1, random(), r, { ...r.source, targetId: 'ALDRY' } as never).selfGain).toBe(0);
    s.combat!.encounterId = 'WINNER_DISPUTE'; expect(currentMisfortuneMageCombatSource(s)).toBeNull(); expect(() => resolveMisfortuneMageCombatRound(s, 'ATTACK')).toThrow('原');
  });
});

describe('Exact inherited formulas, physical factors and one passive draw', () => {
  it('defaults HOLD and preserves old physical, calculation, awareness and mental-storm formulas', () => {
    const s = fixture(), old = structuredClone(s.winner), r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(9);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(22.75 * .65 * .5);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(42.25 * .65 * .5);
    expect(effect(s, K, r, random(), .5).enemyReduction).toBe(42.25 * .65);
    expect(s.spirituality).toBe(114); expect(s.winner).toEqual(old); expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('only actually held own club replaces H at16×physical and lowS uses ordinary fallback', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; s.spirituality = 2; const r = begin(s, 'SPEND_FIRST');
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(effect(s, B, r, random(), .5).enemyReduction).toBe(4);
    expect(effect(s, K, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s.spirituality).toBe(2); expect(s.winner.luck.stored).toBe(2);
    expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('ineligible3S uses inherited paid fallback without consuming the first eligible luck attempt', () => {
    const s = fixture(); s.spirituality = 3; const r = begin(s, 'SPEND_FIRST');
    expect(effect(s, B, r).enemyReduction).toBe(42.25 * .65); expect(s.spirituality).toBe(0);
    expect(s.winner.luck.stored).toBe(2); expect(s.misfortuneMage.encounter.lastLuckRound).toBeNull();
    expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('R and fixednegative A cannot fabricate a disaster, reserve, debt, healing or redraw', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'), before = structuredClone(s);
    expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5);
    expect(s).toEqual(before); expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it.each([25, 26])('records independent passive boundary roll%s before either count and never spends luck', roll => {
    const s = fixture(); s.health = 50; s.progression.mastery['wheel.s7.passive-luck'] = 500; const old = structuredClone(s.winner);
    const result = play(s, 'PREPARE', 'HOLD', roll, 1, 1, ticket(R, 'PREPARE'), 96, 96, 1);
    expect(result.round.passiveLuck).toEqual({ roll, triggered: roll === 25, bonus: roll === 25 ? 45 * .9 : 0 });
    expect(result.round.misfortuneMageOutcome!.passiveLuck).toEqual(result.round.passiveLuck); expect(s.winner).toEqual(old);
    expect(result.round.consequenceWeights).toBeNull(); expect(validateMisfortuneMageEncounter(s)).toBe(true);
  });
});

describe('One voluntary real Winner expense and bounded G misfortune', () => {
  it('only first eligibleB/K spends original1luck4S and leaves old Winner encounter entirely unchanged', () => {
    const s = fixture(), oldEncounter = structuredClone(s.winner.encounter), r = begin(s, 'SPEND_FIRST');
    effect(s, H, r); effect(s, R, r);
    expect(effect(s, B, r, random(), .2).enemyReduction).toBe(40 * .65);
    expect(effect(s, K, r).enemyReduction).toBe(42.25 * .65);
    expect(s.spirituality).toBe(113); expect(s.winner.luck).toEqual({ stored: 1, accumulated: 5, spent: 4, lastAccumulateWeek: 67 });
    expect(s.winner.encounter).toEqual(oldEncounter); expect(s.misfortuneMage.encounter).toMatchObject({ lastLuckRound: 1, luckAttempts: 1, misfortuneAttempts: 0 });
    expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('successful paidK affects only the next real positive BODY/ARC; WARD andzeroBODY do not consume it', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST');
    expect(effect(s, K, r, random(1))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(s.misfortuneMage.encounter.staggerReady).toBe(true);
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(s.misfortuneMage.encounter.staggerReady).toBe(true);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(27.5); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18);
    expect(s.misfortuneMage.encounter.enemySpirituality).toBe(32); expect(s.spirituality).toBe(116); expect(s.winner.luck.spent).toBe(4);
    expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100); expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('failedK still pays and leaves enemy attack intact without a second luck attempt', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(100));
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); expect(effect(s, B, r).enemyReduction).toBe(42.25 * .65);
    expect(s.spirituality).toBe(113); expect(s.winner.luck.stored).toBe(1); expect(s.misfortuneMage.encounter.staggerReady).toBe(false);
    expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('COMPOSE spends real3S, clears pendingK and has no immediate contribution', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(1));
    expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.misfortuneMage.encounter).toMatchObject({ composureReady: true, staggerReady: false, enemySpirituality: 37 });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); const o = finishMisfortuneMageCombatRound(s, r);
    expect(o).toMatchObject({ composureReady: false, staggerReady: false }); expect(validateMisfortuneMageRoundOutcome(o)).toBe(true);
  });
  it('earlier paidCOMPOSE resists newly paidK even on successful knowledge roll, without refund', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); enemy(s, 'COMPOSE', r); effect(s, K, r, random(1));
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, luckCost: 1, checkRoll: 1, resistedByComposure: true, succeeded: false });
    expect(s.misfortuneMage.encounter).toMatchObject({ staggerReady: false, composureReady: true, misfortuneAttempts: 1 });
    expect(s.spirituality).toBe(116); expect(s.winner.luck.stored).toBe(1); expect(validateMisfortuneMageRoundOutcome(finishMisfortuneMageCombatRound(s, r))).toBe(true);
  });
  it('roundend expires both effects, so next actual roundK may succeed after enemy ordinary action', () => {
    const s = fixture(); play(s, 'CONTROL', 'SPEND_FIRST', 100, 1, 1, ticket(K, 'CONTROL'), 1, 86, 1, 1);
    expect(s.misfortuneMage.encounter).toMatchObject({ composureReady: false, staggerReady: false, enemySpirituality: 32 });
    const result = play(s, 'CONTROL', 'SPEND_FIRST', 100, 1, 1, 96, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(result.round.first).toBe('ENEMY'); expect(result.round.misfortuneMageOutcome!.playerActions[0]).toMatchObject({ succeeded: true, resistedByComposure: false });
    expect(result.round.misfortuneMageOutcome!.enemyActions[1]!.selfGain).toBe(27.5); expect(s.winner.luck.stored).toBe(0); expect(validateMisfortuneMageEncounter(s)).toBe(true);
  });
  it('unused paidK expires without refund, redraw or carrying into a later round', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(1)); const o = finishMisfortuneMageCombatRound(s, r);
    expect(o).toMatchObject({ staggerReady: false, luckStoredAfter: 1, luckSpentAfter: 4 }); expect(s.spirituality).toBe(116);
    expect(validateMisfortuneMageRoundOutcome(o)).toBe(true); expect(() => finishMisfortuneMageCombatRound(s, r)).toThrow('结束');
  });
});

describe('Finite enemy resources and unchanged common injury, death and retreat', () => {
  it('depletes original40S across actual rounds; insufficientARC/WARD/COMPOSE use original club', () => {
    const s = fixture();
    play(s, 'DEFEND', 'HOLD', 100, 1, 100, ticket(B, 'DEFEND'), 1, 1, 1, 1, 1);
    play(s, 'DEFEND', 'HOLD', 100, 1, 100, 1, ticket(B, 'DEFEND'), 1, 1, 1, 1);
    expect(s.misfortuneMage.encounter.enemySpirituality).toBe(0); expect(s.misfortuneMage.encounter.powerUses.ARC_BOLT).toBe(8);
    const result = play(s, 'DEFEND', 'HOLD', 100, 1, 21, ticket(B, 'DEFEND'), 1, 36, 86, 1);
    expect(result.round.misfortuneMageOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([
      ['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18],
    ]); expect(s.misfortuneMage.encounter.composureReady).toBe(false); expect(validateMisfortuneMageEncounter(s)).toBe(true);
  });
  it('keeps light/heavy/death outcomes and only continuing12S regeneration, never drops untracked club', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(); s.spirituality = 100; const old = structuredClone(s.winner);
      const result = play(s, 'ATTACK', 'HOLD', 100, 1, 1, ticket(H, 'ATTACK'), 36, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(result.round.misfortuneMageOutcome!.enemySpirituality).toBe(37); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 112 : 100); expect(s.winner).toEqual(old);
      expect(result.round.consequence).not.toContain('放下'); expect(validateMisfortuneMageRoundOutcome(result.round.misfortuneMageOutcome)).toBe(true);
      if (outcome !== 'CONTINUE') settleMisfortuneMageEncounter(s, outcome, context()); expect(validateMisfortuneMageEncounter(s)).toBe(true);
    }
  });
  it('preserves real player death even after paidK and clears temporary effects', () => {
    const s = fixture(), result = play(s, 'CONTROL', 'SPEND_FIRST', 100, 1, 1, ticket(K, 'CONTROL'), 1, 1, 96, 1_000_000, 96);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(116); expect(s.winner.luck.stored).toBe(1);
    expect(s.misfortuneMage.encounter.staggerReady).toBe(false); s.status = 'DEAD'; settleMisfortuneMageEncounter(s, result.outcome, context());
    expect(s.misfortuneMage.encounter.status).toBe('LOST'); expect(validateMisfortuneMageEncounter(s)).toBe(true);
  });
  it('ordinary retreat draws no passive, keeps actual preceding enemy payment and cannot reopen', () => {
    const s = fixture(); play(s, 'PREPARE', 'HOLD', 100, 1, 1, ticket(R, 'PREPARE'), 96, 96, 1);
    const oldLuck = structuredClone(s.winner.luck), result = play(s, 'RETREAT', 'SPEND_FIRST', 1, 1, 36, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.passiveLuck).toBeUndefined(); expect(result.round.misfortuneMageOutcome!.passiveLuck).toBeNull();
    expect(s.misfortuneMage.encounter.enemySpirituality).toBe(37); expect(s.winner.luck).toEqual(oldLuck);
    settleMisfortuneMageEncounter(s, result.outcome, context()); expect(validateMisfortuneMageEncounter(s)).toBe(true);
    expect(() => applyMisfortuneMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
  });
  it('rejects forged spend, free spell, rewritten passive and false lingering effects', () => {
    const s = fixture(), result = play(s, 'CONTROL', 'SPEND_FIRST', 25, 1, 1, ticket(K, 'CONTROL'), 1, 36, 1, 1);
    for (const mutate of [
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.luckStoredAfter++; },
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.enemyActions[1]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.enemyActions[1]!.selfGain = 55; },
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.playerActions[0]!.luckCost = 0; },
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.passiveLuck!.bonus = 45; },
      (o: NonNullable<typeof result.round.misfortuneMageOutcome>) => { o.lastLuckRound = null; },
    ]) { const o = structuredClone(result.round.misfortuneMageOutcome!); mutate(o); expect(validateMisfortuneMageRoundOutcome(o)).toBe(false); }
    const clone = structuredClone(s); clone.misfortuneMage.encounter.composureReady = true; expect(validateMisfortuneMageEncounter(clone)).toBe(false);
    s.winner.luck.stored++; s.winner.luck.spent--; expect(validateMisfortuneMageEncounter(s)).toBe(false);
  });
  it('exposes real inherited reserve and candid G source limits with no unknown original ability claim', () => {
    const s = fixture(), p = projectMisfortuneMageCombat(s);
    expect(p).toMatchObject({ targetId: 'MM4-FERRIS-LORNE', enemySpirituality: 40, luck: { stored: 2, accumulated: 5, spent: 3, capacity: 3 }, pursuit: false });
    expect(p.summary).toContain('完整原著4级技能仍未知'); expect(p.source!.enemyWeapon).toBe('MM4-FERRIS-CLUB');
  });
});
