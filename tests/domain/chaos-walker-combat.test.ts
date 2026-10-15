import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createChaosWalkerState } from '../../src/domain/chaos-walker/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveChaosWalkerCombatRound } from '../../src/domain/slice/chaos-walker-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { WinnerLuckPolicy } from '../../src/domain/winner/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { CHAOS_WALKER_COUNT_WHEEL, CHAOS_WALKER_ENEMY_COUNT_WHEEL, CHAOS_WALKER_ENEMY_ABILITY_WHEEL, chaosWalkerAbilityWheel, chaosWalkerActionCount, chaosWalkerEnemyActionCount,
  drawChaosWalkerAbility, drawChaosWalkerEnemyAbility, currentChaosWalkerCombatSource, beginChaosWalkerCombatRound, resolveChaosWalkerCombatAbility, resolveChaosWalkerEnemyAbility,
  finishChaosWalkerCombatRound, validateChaosWalkerRoundOutcome, projectChaosWalkerCombat, type ChaosWalkerMoveId, type ChaosWalkerRoundOutcome } from '../../src/domain/chaos-walker/combat.js';
import { applyChaosWalkerEncounterCommand, settleChaosWalkerEncounter, validateChaosWalkerEncounter } from '../../src/domain/chaos-walker/encounter.js';
import { WINNER_COUNT_WHEEL } from '../../src/domain/winner/combat.js';

const H = 'BODY_STRIKE', J = 'BODY_FOLLOWUP', B = 'wheel.s3.deviation-buffer', K = 'wheel.s3.future-impediment', R = 'OBSERVE';
const profile: readonly [ChaosWalkerMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: ChaosWalkerMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); } throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'chaos-walker-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed unit state, not a natural promotion claim. Natural evidence is owned by the public-command fixture. */
function fixture(): SliceState {
  const s = createSliceRun('chaos-walker-combat-directed', sliceDefaultCreationSelection, 'chaos-walker-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'wheel', sequence: 3, mastery: { [B]: 0, [K]: 0, 'wheel.s8.calculation-control': 0, 'wheel.s6.disaster-awareness': 0, 'wheel.s6.mental-storm': 0, 'wheel.s7.passive-luck': 0 }, acting: 0, promotionWeek: 120 };
  s.chaosWalker = createChaosWalkerState(); s.chaosWalker.guidanceKnown = true; s.chaosWalker.promotionWeek = 120; s.chaosWalker.misfortuneMageActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.winner.luck = { stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67 }; s.chaosWalker.life.cases['cart-fork'].status = 'RESOLVED';
  applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
function begin(s: SliceState, policy: WinnerLuckPolicy = 'HOLD', stance: SliceStance = 'ATTACK', roll = 100) {
  return beginChaosWalkerCombatRound(s, stance, random(...(stance === 'RETREAT' ? [] : [roll])), policy);
}
function effect(s: SliceState, id: ChaosWalkerMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveChaosWalkerCombatAbility(s, id, physical, rng, r); }
function enemy(s: SliceState, id: Parameters<typeof resolveChaosWalkerEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) { return resolveChaosWalkerEnemyAbility(s, id, physical, random(), r); }
function play(s: SliceState, stance: SliceStance, policy: WinnerLuckPolicy, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveChaosWalkerCombatRound(s, stance, policy); s.combatHistory.push(structuredClone(result.round)); s.revision++; expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Candidate Chaos Walker inherited wheel and exact finite reserve', () => {
  it('uses both1–6 old Winner count wheels and unchanged stance tickets', () => {
    const s = fixture(); expect(CHAOS_WALKER_COUNT_WHEEL).toEqual(WINNER_COUNT_WHEEL); expect(CHAOS_WALKER_ENEMY_COUNT_WHEEL).toEqual(WINNER_COUNT_WHEEL);
    expect(playerCountWheel(s)).toEqual(WINNER_COUNT_WHEEL); expect(chaosWalkerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(chaosWalkerAbilityWheel(s, null));
    for (const [id] of profile) expect(drawChaosWalkerAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    for (const count of [chaosWalkerActionCount, chaosWalkerEnemyActionCount]) expect([1, 12, 13, 32, 33, 57, 58, 80, 81, 94, 95, 100].map(count)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(CHAOS_WALKER_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]); expect([1, 36, 61, 86, 96].map(n => drawChaosWalkerEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('preserves WHEEL15/20/40/25 and finite player1250/120 versus original22 enemy1250/120', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const r = play(s, 'ATTACK', 'HOLD', 100, 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 1);
    expect(r.round.playerAdvantage).toBe(baseAdvantage(10 * .15 + 20 * .2 + 30 * .4 + 40 * .25, 100, 100, 120, 1250, 120) - 22.5);
    expect(r.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120) - 22.5); expect(r.round.consequenceWeights).toBeNull(); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it('defaults HOLD, never spends reserve, and inherits actual H/J/B/K formulas', () => {
    const s = fixture(), old = structuredClone(s.winner), r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(9); expect(effect(s, J, r, random(), .5).selfGain).toBe(22.75 * .65 * .5);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(42.25 * .65 * .5); expect(effect(s, K, r, random(), .5).enemyReduction).toBe(42.25 * .65);
    expect(s.spirituality).toBe(114); expect(s.winner).toEqual(old); expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it.each([0, 2, 3, 4])('at%s spirituality cannot fabricate a paid5S cast or draw', spirituality => {
    const s = fixture(); s.spirituality = spirituality; const r = begin(s, 'SPEND_FIRST'), rng = random();
    expect(effect(s, B, r, rng).enemyReduction).toBe(spirituality >= 3 ? 42.25 * .65 : 8);
    expect(s.spirituality).toBe(spirituality >= 3 ? spirituality - 3 : spirituality); expect(s.winner.luck.stored).toBe(2); expect(rng.cursor).toBe(0);
    expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it('zero original reserve has a feasible ordinary inherited path without a new pool', () => {
    const s = fixture(); s.winner.luck.stored = 0; s.winner.luck.spent = 5; const r = begin(s, 'SPEND_FIRST');
    effect(s, B, r); effect(s, K, r); expect(s.spirituality).toBe(114); expect(s.winner.luck.stored).toBe(0); expect(s.chaosWalker.encounter.luckAttempts).toBe(0);
    expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it.each([25, 26])('draws old passive once before the count wheels at boundary%s with no reserve expense', roll => {
    const s = fixture(); s.health = 50; s.progression.mastery['wheel.s7.passive-luck'] = 500; const old = structuredClone(s.winner.luck);
    const r = play(s, 'PREPARE', 'HOLD', roll, 1, 1, ticket(R, 'PREPARE'), 96, 1);
    expect(r.round.passiveLuck).toEqual({ roll, triggered: roll === 25, bonus: roll === 25 ? 45 * .9 : 0 }); expect(s.winner.luck).toEqual(old); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it('rejects stale sources and altered actual funds without costs or extra draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.winner.luck.stored--; s.winner.luck.spent++; }, (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.chaosWalker.life.clockSeconds++; }]) {
      const s = fixture(), r = begin(s, 'SPEND_FIRST'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'MISFORTUNE_MAGE_DISPUTE'; expect(currentChaosWalkerCombatSource(s)).toBeNull();
  });
});

describe('One new pending future contribution, finite checks and ordered actual costs', () => {
  it.each([B, K] as const)('%s pays one old reserve plus5S and changes only one later BODY/ARC', id => {
    const s = fixture(), oldEncounter = structuredClone(s.winner.encounter), r = begin(s, 'SPEND_FIRST');
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(effect(s, id, r, random(1))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0);
    expect(s.chaosWalker.encounter.pendingKind).not.toBeNull(); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(35); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20);
    expect(s.spirituality).toBe(115); expect(s.chaosWalker.encounter.enemySpirituality).toBe(106); expect(s.winner.luck).toEqual({ stored: 1, accumulated: 5, spent: 4, lastAccumulateWeek: 67 }); expect(s.winner.encounter).toEqual(oldEncounter);
    const o = finishChaosWalkerCombatRound(s, r); expect(o.enemyActions[3]).toMatchObject({ paidCost: 5, spiritualityBefore: 111, spiritualityAfter: 106, rawContribution: 70, selfGain: 35 }); expect(validateChaosWalkerRoundOutcome(o)).toBe(true);
  });
  it('first eligible B/K consumes the round opportunity even on failure; later B/K uses old3S', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, B, r, random(100));
    expect(r.playerActions[0]).toMatchObject({ paidCost: 5, luckCost: 1, checkTier: 'GREAT_FAILURE', succeeded: false }); expect(effect(s, K, r).enemyReduction).toBe(42.25 * .65);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(s.spirituality).toBe(112); expect(s.winner.luck.stored).toBe(1); expect(s.chaosWalker.encounter.luckAttempts).toBe(1);
    expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS'], [6, 'SUCCESS'], [51, 'FAILURE'], [96, 'GREAT_FAILURE']] as const)('records actual fourtier roll%s without guaranteeing success', (roll, tier) => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(roll)); expect(r.playerActions[0]!.checkTier).toBe(tier); expect(r.playerActions[0]!.checkChance).toBe(50);
    expect(s.spirituality).toBe(115); expect(s.winner.luck.stored).toBe(1); expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it.each([B, K] as const)('earlier real COMPOSE costs4S, contributes8 and resists later%s without refund', id => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST'); expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false }); effect(s, id, r, random(1));
    expect(r.playerActions[0]).toMatchObject({ paidCost: 5, luckCost: 1, checkTier: 'GREAT_SUCCESS', resistedByComposure: true, succeeded: false }); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70);
    expect(s.chaosWalker.encounter.enemySpirituality).toBe(111); expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
  });
  it('later COMPOSE cancels unused effects but never rewrites an already reduced contribution', () => {
    for (const applied of [false, true]) {
      const s = fixture(), r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(1)); if (applied) expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(35);
      enemy(s, 'COMPOSE', r); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(s.chaosWalker.encounter.pendingKind).toBeNull();
      if (applied) expect(r.enemyActions[0]!.selfGain).toBe(35); expect(validateChaosWalkerRoundOutcome(finishChaosWalkerCombatRound(s, r))).toBe(true);
    }
  });
  it('unused effects expire at actual60seconds with no resource refund or mastery', () => {
    const s = fixture(), oldMastery = { ...s.progression.mastery }, r = begin(s, 'SPEND_FIRST'); effect(s, K, r, random(1)); const o = finishChaosWalkerCombatRound(s, r);
    expect(o).toMatchObject({ pendingKind: null, composureReady: false, elapsedSeconds: 60, lifeClockSecondsAfter: 60, luckStoredAfter: 1, playerSpiritualityAfter: 115 }); expect(s.progression.mastery).toEqual(oldMastery);
    expect(validateChaosWalkerRoundOutcome(o)).toBe(true); expect(() => finishChaosWalkerCombatRound(s, r)).toThrow('结束');
  });
  it('replays the unique original reserve before/after and rejects forged costs, retroactivity and effects', () => {
    const s = fixture(), r = begin(s, 'SPEND_FIRST', 'CONTROL', 25); enemy(s, 'ARC_BOLT', r); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r); const o = finishChaosWalkerCombatRound(s, r);
    expect(o.playerActions[0]!.luckBefore).toEqual({ stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67 }); expect(validateChaosWalkerRoundOutcome(o)).toBe(true);
    const mutations: ((v: ChaosWalkerRoundOutcome) => void)[] = [v => { v.luckStoredAfter++; }, v => { v.playerActions[0]!.luckBefore.stored++; }, v => { v.playerActions[0]!.luckCost = 0; }, v => { v.playerActions[0]!.checkTier = 'FAILURE'; },
      v => { v.enemyActions[0]!.selfGain = 35; }, v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.enemyActions[1]!.spiritualityAfter++; }, v => { v.enemyActions[1]!.rawContribution = 35; },
      v => { v.passiveLuck!.bonus = 45; }, v => { v.pendingKind = 'FUTURE_IMPEDIMENT' as never; }, v => { v.elapsedSeconds = 0 as never; }, v => { v.source.targetId = 'MM4-FERRIS-LORNE' as never; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateChaosWalkerRoundOutcome(bad)).toBe(false); }
  });
});

describe('Real finite enemy depletion, injury and terminal movement', () => {
  it('depletes original120S over four real rounds and then all three planned spells use owned rod20', () => {
    const s = fixture();
    for (let round = 1; round <= 4; round++) {
      const actions = round % 2 ? [ticket(R, 'PREPARE'), 1, 1, 1, 1, 1, 1] : [1, ticket(R, 'PREPARE'), 1, 1, 1, 1, 1];
      play(s, 'PREPARE', 'HOLD', 100, 1, 100, ...actions, 1); expect(validateChaosWalkerEncounter(s)).toBe(true);
    }
    expect(s.chaosWalker.encounter.enemySpirituality).toBe(0); expect(s.chaosWalker.encounter.powerUses.ARC_BOLT).toBe(24);
    const r = play(s, 'PREPARE', 'HOLD', 100, 1, 33, ticket(R, 'PREPARE'), 1, 36, 86, 1);
    expect(r.round.chaosWalkerOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20]]); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it.each([[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const)('keeps ordinary consequence%s and regenerates12S only while continuing', (roll, health, outcome) => {
    const s = fixture(); s.spirituality = 100; const r = play(s, 'ATTACK', 'HOLD', 100, 1, 1, ticket(H, 'ATTACK'), 36, 1, roll);
    expect(r.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(r.round.consequenceWeights).toEqual(consequenceWeights(0)); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 112 : 100);
    expect(s.chaosWalker.life.clockSeconds).toBe(outcome === 'CONTINUE' ? 60 : 64); expect(s.chaosWalker.encounter.weaponLocation).toBe(outcome === 'ENEMY_DEAD' ? 'COURT' : 'HAND');
    if (outcome !== 'CONTINUE') settleChaosWalkerEncounter(s, outcome, context()); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it('real death after an actual paid cast spends resources and leaves player body in original court', () => {
    const s = fixture(), old = structuredClone({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamityPriest: s.calamityPriest, misfortuneMage: s.misfortuneMage });
    const r = play(s, 'CONTROL', 'SPEND_FIRST', 100, 1, 1, ticket(K, 'CONTROL'), 1, 1, 1_000_000, 96);
    expect(r.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(115); expect(s.winner.luck.stored).toBe(1); expect(s.chaosWalker.life.clockSeconds).toBe(60);
    expect(s.chaosWalker.encounter.scene.playerPosition).toBe('COURT'); expect(s.chaosWalker.encounter.exitTravelMetres).toBe(0); s.status = 'DEAD'; settleChaosWalkerEncounter(s, r.outcome, context()); expect(validateChaosWalkerEncounter(s)).toBe(true);
    expect({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamityPriest: s.calamityPriest, misfortuneMage: s.misfortuneMage }).toEqual(old);
  });
  it('retreat omits passive, preserves prior enemy payment and actually walks the4m exit', () => {
    const s = fixture(); play(s, 'PREPARE', 'HOLD', 100, 1, 1, ticket(R, 'PREPARE'), 96, 1);
    const oldLuck = structuredClone(s.winner.luck), r = play(s, 'RETREAT', 'SPEND_FIRST', 1, 1, 36, 1);
    expect(r.outcome).toBe('RETREATED'); expect(r.round.passiveLuck).toBeUndefined(); expect(r.round.chaosWalkerOutcome!.passiveLuck).toBeNull(); expect(s.chaosWalker.encounter.enemySpirituality).toBe(116); expect(s.winner.luck).toEqual(oldLuck);
    settleChaosWalkerEncounter(s, r.outcome, context()); expect(s.chaosWalker.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(validateChaosWalkerEncounter(s)).toBe(true);
  });
  it('retains explicit source limits, actual resources and no second pool in public summary', () => {
    const p = projectChaosWalkerCombat(fixture()); expect(p).toMatchObject({ targetId: 'CW3-GARETH', enemySpirituality: 120, luck: { stored: 2, accumulated: 5, spent: 3, capacity: 3 }, pursuit: false });
    expect(p.summary).toContain('完整原著3级技能'); expect(p.summary).toContain('G候选'); expect(p.source!.enemyWeapon).toBe('CW3-GARETH-ROD');
  });
});
