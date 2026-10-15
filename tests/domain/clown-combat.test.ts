import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  CLOWN_COUNT_WHEEL, clownActionCount, currentClownDangerSource, resolveClownCombatAbility,
} from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('clown-combat-test', sliceDefaultCreationSelection, 'clown-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.combat = { encounterId: 'CLOWN_RESCUE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: 'diviner', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spirituality = 45;
  state.clown.paperSheets = 3;
  state.clown.paperSpent = 0;
  // Old-case life and item facts cannot identify the new rescue opponent.
  state.world.carrierAlive = false;
  state.world.carrierCanResist = false;
  return state;
}

/** Retain production cursor advancement while prescribing exact wheel draws. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('S8 combat wheels', () => {
  it('routes sequence 8 before earlier profiles, without granting a firearm or a higher-sequence ability', () => {
    const state = fixture();
    expect(playerCountWheel(state)).toEqual(CLOWN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([15, 25, 30, 20, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel.map(({ id }) => id)).toEqual([
      'diviner.s8.body-control', 'diviner.s8.balance', 'diviner.s8.agility',
      'diviner.s8.danger-prediction', 'diviner.s8.paper-dagger', 'diviner.s9.spiritual-sight',
      'OBSERVE', 'MISS',
    ]);
    wheel.forEach(({ weight }, index) => expect(weight).toBeCloseTo([24, 16, 14, 14, 14, 6, 8, 4][index]!));
    expect(wheel.reduce((sum, { weight }) => sum + weight, 0)).toBeCloseTo(100);
    expect(wheel.some(({ label }) => /枪|快速施法|火焰|替身/.test(label))).toBe(false);
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    wheel[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(24);
  });

  it.each([[1, 1], [15, 1], [16, 2], [40, 2], [41, 3], [70, 3], [71, 4], [90, 4], [91, 5], [100, 5]])(
    'maps count roll %i to %i actions', (roll, count) => expect(clownActionCount(roll)).toBe(count),
  );

  it.each([
    ['ATTACK', [120, 64, 56, 56, 70, 24, 32, 16]],
    ['DEFEND', [96, 80, 56, 56, 56, 24, 32, 16]],
    ['CONTROL', [96, 64, 56, 70, 56, 30, 32, 16]],
    ['PREPARE', [96, 64, 70, 56, 56, 24, 40, 16]],
  ] as const)('uses exact ×1.25 normalized %s weights', (stance, tickets) => {
    const total = tickets.reduce((sum, weight) => sum + weight, 0);
    expect(playerAbilityWheel(fixture(), stance as SliceStance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / total * 100));
  });

  it('preserves ordinary and S9 public wheels exactly', () => {
    const state = fixture();
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(SEER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(seerAbilityWheel('CONTROL'));
    state.progression.pathwayId = null; state.progression.sequence = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
  });
});

describe('S8 round effects and real paper costs', () => {
  it('uses tier 300 and 40/35/15/10 core weights with the existing status brackets and core cap', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 438, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(319.5);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 9;
    scriptRolls(1, 1, 438, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(13.5);
  });

  it('alternates five player actions and three unchanged ordinary enemy actions without bonus turns', () => {
    const state = fixture();
    const draws = scriptRolls(91, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').map(({ selfGain }) => selfGain)).toEqual([30, 30, 30, 30, 30]);
    expect(round.moves.filter(({ actor }) => actor === 'ENEMY').map(({ selfGain }) => selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(465);
    expect(round.enemyAdvantage).toBe(162);
    expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.random.cursor).toBe(12);
    expect(draws).toHaveBeenCalledTimes(12);
  });

  it('scales the actual bodily action once using the old health bracket', () => {
    const state = fixture(); state.health = 50;
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBe(27);
    expect(round.playerAdvantage).toBeCloseTo(315 * 0.9 + 27);
  });

  it('spends real paper and spirituality on each draw, falls back after depletion, and saves the same round', () => {
    const state = fixture(); state.clown.paperSheets = 2; state.spirituality = 2;
    const draws = scriptRolls(91, 86, 297, 400, 297, 400, 297, 400, 297, 297, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    const playerMoves = round.moves.filter(({ actor }) => actor === 'PLAYER');
    expect(playerMoves.map(({ selfGain }) => selfGain)).toEqual([34, 34, 12, 12, 12]);
    expect(playerMoves.slice(0, 2).every(({ label }) => label.includes('消耗纸张1、灵性1'))).toBe(true);
    expect(playerMoves.slice(2).every(({ label }) => label.includes('纸张与灵性不足'))).toBe(true);
    expect(state.clown.paperSheets).toBe(0);
    expect(state.clown.paperSpent).toBe(2);
    expect(state.spirituality).toBe(4.5); // recovery happens after all five actions
    expect(outcome).toBe('CONTINUE');
    expect(state.combat!.lastRound).toBe(round);
    expect(state.lastCombatRound).toBe(round);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(draws).toHaveBeenCalledTimes(12); // no fallback redraw
    const saved = JSON.parse(JSON.stringify(state)) as SliceState;
    expect(saved.clown.paperSheets).toBe(0);
    expect(saved.clown.paperSpent).toBe(2);
    expect(saved.lastCombatRound).toEqual(round);
  });

  it.each([
    [0, 10, '纸张不足'], [3, 0, '灵性不足'], [3, 0.5, '灵性不足'], [0, 0, '纸张与灵性不足'],
  ] as const)('falls back with %i paper and %f spirituality without negative balances', (paper, spirit, reason) => {
    const state = fixture(); state.clown.paperSheets = paper; state.spirituality = spirit;
    const result = resolveClownCombatAbility(state, 'diviner.s8.paper-dagger', 0.9);
    expect(result.label).toContain(reason);
    expect(result.label).toContain('普通体术，不重抽');
    expect(result.selfGain).toBeCloseTo(10.8);
    expect(result.threatens).toBe(true); // the fallback is an actual ordinary attack
    expect(state.clown.paperSheets).toBe(paper);
    expect(state.clown.paperSpent).toBe(0);
    expect(state.spirituality).toBe(spirit);
  });

  it.each([
    [121, 0, 28], [185, 18, 0], [241, 0, 22], [367, 5, 0], [391, 0, 0], [438, 0, 0],
  ])('never injures or kills with the non-attacking sector drawn at %i', (roll, gain, reduction) => {
    const state = fixture(); state.combat!.enemyHealth = 1;
    const draws = scriptRolls(1, 1, roll, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]).toMatchObject({ selfGain: gain, enemyReduction: reduction });
    expect(round.winner).toBe('PLAYER');
    expect(round.consequenceWeights).toBeNull();
    expect(round.consequence).toContain('勒索者本回合处于下风');
    expect(state.combat!.enemyHealth).toBe(1);
    expect(state.combat!.enemyInjuries).toEqual([]);
    expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(5);
  });

  it('does not give mastery or unselected abilities passive contributions', () => {
    const state = fixture();
    state.progression.mastery = { 'diviner.s8.body-control': 500, 'diviner.s8.danger-prediction': 500 };
    scriptRolls(1, 1, 438, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(315);
    expect(round.enemyAdvantage).toBe(114);
    expect(round.moves).toHaveLength(2);
    expect(state.clown.paperSheets).toBe(3);
    expect(state.clown.paperSpent).toBe(0);
  });
});

describe('current encounter sources, real consequences, and replay', () => {
  it('reads rescue opponent health even after the old carrier died, without claiming old bell activity', () => {
    const state = fixture(); state.combat!.enemyHealth = 70;
    state.world.bellFactKnown = true; state.world.bellAtScene = true; state.world.bell = 'ACTIVE';
    const result = resolveClownCombatAbility(state, 'diviner.s9.spiritual-sight', 1);
    expect(result.label).toBe('灵视：眼前勒索者身上已有伤势');
    expect(result.label).not.toMatch(/携铃者|铜铃|幕后|途径/);
    expect(result.selfGain).toBe(5);
    expect(result.threatens).toBe(false);
  });

  it('requires a current visible action source for danger prediction, without guaranteeing survival', () => {
    const state = fixture();
    expect(resolveClownCombatAbility(state, 'diviner.s8.danger-prediction', 1).enemyReduction).toBe(0);
    const source = currentClownDangerSource(state)!;
    const valid = resolveClownCombatAbility(state, 'diviner.s8.danger-prediction', 1, source);
    expect(valid.enemyReduction).toBe(22);
    expect(valid.threatens).toBe(false);
    expect(valid.label).toContain('判断未必准确');
    expect(resolveClownCombatAbility(state, 'diviner.s8.danger-prediction', 1,
      { ...source, encounterId: 'FIRST_CASE' }).enemyReduction).toBe(0);
    expect(resolveClownCombatAbility(state, 'diviner.s8.danger-prediction', 1,
      { ...source, round: 2 }).enemyReduction).toBe(0);
    scriptRolls(1, 1, 241, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
  });

  it.each(['DEAD', 'SURRENDERED', 'ZERO_HEALTH', 'NO_COMBAT', 'OLD_CARRIER_DEAD'] as const)(
    'invalidates sight and danger after source loss: %s', (loss) => {
      const state = fixture();
      if (loss === 'OLD_CARRIER_DEAD') {
        state.combat!.encounterId = 'FIRST_CASE';
        state.world.carrierAlive = true; state.world.carrierCanResist = true;
      }
      const source = currentClownDangerSource(state)!;
      if (loss === 'DEAD' || loss === 'SURRENDERED') state.combat!.enemyStatus = loss;
      else if (loss === 'ZERO_HEALTH') state.combat!.enemyHealth = 0;
      else if (loss === 'NO_COMBAT') state.combat = null;
      else state.world.carrierAlive = false;
      expect(currentClownDangerSource(state)).toBeNull();
      expect(resolveClownCombatAbility(state, 'diviner.s8.danger-prediction', 1, source).enemyReduction).toBe(0);
      expect(resolveClownCombatAbility(state, 'diviner.s9.spiritual-sight', 1).selfGain).toBe(0);
    },
  );

  it('uses the current opponent in injury, surrender, and death text with unchanged consequence numbers', () => {
    const state = fixture();
    scriptRolls(1, 1, 1, 400, 1, 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(result.round.consequence).toContain('勒索者受到重伤，健康减少30');
    expect(result.round.consequence).toContain('勒索者仍然活着，放下短棍投降');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子/);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const fatal = fixture(); fatal.spirituality = 20;
    scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(fatal, 'ATTACK').round.consequence).toContain('勒索者进入死亡分支');
    expect(fatal.spirituality).toBe(20);
    expect(fatal.combat!.enemyStatus).toBe('DEAD');
  });

  it('retreats from the current scene without moving the old bell or recovering spirituality', () => {
    const state = fixture(); state.spirituality = 10;
    const world = JSON.parse(JSON.stringify(state.world));
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED');
    expect(result.round.consequence).toContain('勒索者保住了现场');
    expect(result.round.consequence).not.toContain('携铃者');
    expect(result.round.moves).toEqual([]);
    expect(state.world).toEqual(world);
    expect(state.spirituality).toBe(10);
  });

  it('caps continuing recovery at 45 and clears all prior round advantages', () => {
    const state = fixture(); state.spirituality = 44;
    scriptRolls(1, 1, 185, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(333);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 438, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(315);
  });

  it.each([null, 9] as const)('preserves the old %s profile draw order and base values', (sequence) => {
    const state = fixture();
    state.progression.sequence = sequence;
    state.progression.pathwayId = sequence === null ? null : 'diviner';
    state.spirituality = sequence === null ? 15 : 30;
    state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    const draws = scriptRolls(1, 1, sequence === null ? 440 : 270, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(sequence === null ? 115 : 215);
    expect(round.enemyAdvantage).toBe(114);
    expect(round.playerCount).toBe(1);
    expect(state.random.cursor).toBe(5);
    expect(draws).toHaveBeenCalledTimes(5);
  });

  it('replays a restored same-seed round and real inventory exactly without Math.random', () => {
    const state = fixture(); state.random.cursor = 4; state.clown.paperSheets = 1; state.spirituality = 1;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'DEFEND')).toEqual(resolveSliceCombatRound(restored, 'DEFEND'));
    expect(state).toEqual(restored);
    expect(forbidden).not.toHaveBeenCalled();
  });
});
