import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import { resolveSeerCombatAbility, seerActionCount } from '../../src/domain/seer/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(promoted = true): SliceState {
  const state = createSliceRun('seer-combat-test', sliceDefaultCreationSelection, 'seer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.world.bellFactKnown = true;
  state.combat = { encounterId:'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
    enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: promoted ? 'diviner' : null, sequence: promoted ? 9 : null,
    mastery: {}, acting: 0, promotionWeek: promoted ? 1 : null };
  state.spirituality = promoted ? 30 : 15;
  return state;
}

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

describe('progression-aware combat profiles', () => {
  it('preserves the ordinary player and enemy wheel interfaces', () => {
    const state = fixture(false);
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
  });

  it('uses the S9 25/30/25/20 pace without changing the ordinary count cap', () => {
    const state = fixture();
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([25, 30, 25, 20]);
    expect(playerCountWheel(state).map(({ id }) => id)).toEqual(['1', '2', '3', '4']);
    expect(ORDINARY_COUNT_WHEEL.map(({ id }) => id)).toEqual(['1', '2', '3']);
    const copy = playerCountWheel(state); copy[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(25);
  });

  it.each([[1, 1], [25, 1], [26, 2], [55, 2], [56, 3], [80, 3], [81, 4], [100, 4]])(
    'maps count roll %i to %i actions', (roll, count) => expect(seerActionCount(roll)).toBe(count),
  );

  it('removes nonexistent guns and renormalizes the confirmed seven-sector baseline', () => {
    const wheel = playerAbilityWheel(fixture(), null);
    expect(wheel.map(({ weight }) => weight)).toEqual([14, 10, 8, 10, 14, 8].map((weight) => weight / 64 * 100));
    expect(wheel.map(({ id }) => id)).toEqual([
      'MARTIAL', 'EVADE', 'diviner.s9.spiritual-sight', 'diviner.s9.spiritual-intuition', 'OBSERVE', 'MISS',
    ]);
    expect(wheel.some(({ label }) => /枪|占卜|神秘学/.test(label))).toBe(false);
    expect(wheel.reduce((sum, { weight }) => sum + weight, 0)).toBeCloseTo(100);
  });

  it.each([
    ['ATTACK', [70, 40, 32, 40, 56, 32]],
    ['DEFEND', [56, 50, 32, 40, 56, 32]],
    ['CONTROL', [56, 40, 40, 50, 56, 32]],
    ['PREPARE', [56, 40, 32, 40, 70, 32]],
  ] as const)('shows the exact ×1.25 normalized %s stance', (stance, tickets) => {
    const sum = tickets.reduce((total, weight) => total + weight, 0);
    expect(playerAbilityWheel(fixture(), stance as SliceStance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / sum * 100));
  });

  it('does not turn mastery or possession of intuition into an unlisted passive bonus', () => {
    const state = fixture();
    const before = playerAbilityWheel(state, null);
    state.progression.mastery = { 'diviner.s9.spiritual-sight': 500, 'diviner.s9.spiritual-intuition': 500 };
    expect(playerAbilityWheel(state, null)).toEqual(before);
    scriptRolls(1, 1, 270, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(215);
    expect(round.enemyAdvantage).toBe(114);
  });
});

describe('S9 combat and source-bound feedback', () => {
  it('uses tier 200 with 10/40/20/30 core weights and the same 20%-of-tier core cap', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 270, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(227); // 200 + 1 + 8 + 6 + 12
    expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBeCloseTo(227 / 341 * 100);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 270, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(9);
  });

  it('alternates four S9 actions against three original carrier actions and injures only once', () => {
    const state = fixture();
    const draws = scriptRolls(81, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').every(({ selfGain }) => selfGain === 22)).toBe(true);
    expect(round.moves.filter(({ actor }) => actor === 'ENEMY').every(({ selfGain }) => selfGain === 16)).toBe(true);
    expect(round.playerAdvantage).toBe(303);
    expect(round.enemyAdvantage).toBe(162);
    expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('reveals only existing health and known bell facts when spirit sight is actually drawn', () => {
    const state = fixture();
    scriptRolls(1, 1, 111, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]).toMatchObject({ selfGain: 5, enemyReduction: 0 });
    expect(round.moves[0]!.label).toContain('灵视');
    expect(round.moves[0]!.label).toContain('铜铃的异常仍在');
    expect(round.playerAdvantage).toBe(220);
    expect(outcome).toBe('CONTINUE');
    expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyInjuries).toEqual([]);
    state.world.bellFactKnown = false;
    const unknown = resolveSeerCombatAbility(state, 'diviner.s9.spiritual-sight', 1);
    expect(unknown.label).not.toContain('铜铃');
    state.world.carrierAlive = false;
    expect(resolveSeerCombatAbility(state, 'diviner.s9.spiritual-sight', 1).selfGain).toBe(0);
  });

  it('does not fabricate a danger-difference source from a carried inactive bell', () => {
    const state = fixture();
    scriptRolls(1, 1, 137, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(round.moves[0]!.label).toContain('灵性直觉');
    expect(round.enemyAdvantage).toBe(114);
    expect(round.consequenceWeights).toBeNull();
  });

  it('requires an explicit original danger source at the confirmed threshold for intuition', () => {
    const state = fixture();
    expect(resolveSeerCombatAbility(state, 'diviner.s9.spiritual-intuition', 1).enemyReduction).toBe(0);
    expect(resolveSeerCombatAbility(state, 'diviner.s9.spiritual-intuition', 1,
      { difference: 19, publicWarning: '测试场景的已登记袭击' }).enemyReduction).toBe(0);
    const result = resolveSeerCombatAbility(state, 'diviner.s9.spiritual-intuition', 1,
      { difference: 20, publicWarning: '测试场景的已登记袭击' });
    expect(result.enemyReduction).toBe(25);
    expect(result.threatens).toBe(false);
  });

  it('keeps observation at zero and creates no undocumented later advantage', () => {
    const state = fixture();
    scriptRolls(1, 1, 169, 400, 1);
    const first = resolveSliceCombatRound(state, 'PREPARE');
    expect(first.round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(first.round.moves[0]!.label).toContain('观察/调整位置');
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 270, 1);
    const second = resolveSliceCombatRound(state, 'PREPARE');
    expect(second.round.playerAdvantage).toBe(215);
    expect(second.round.enemyAdvantage).toBe(114);
  });

  it('scales bodily contribution by the existing health bracket without duplicate injury-tag penalties', () => {
    const state = fixture(); state.health = 50;
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBeCloseTo(19.8);
    expect(round.playerAdvantage).toBeCloseTo(215 * 0.9 + 19.8);
  });

  it('recovers 10% of actual S9 spirituality only after a continuing complete round', () => {
    const state = fixture(); state.spirituality = 29;
    scriptRolls(1, 1, 270, 400, 1);
    resolveSliceCombatRound(state, 'ATTACK');
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const retreating = fixture(); retreating.spirituality = 10;
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(result.outcome).toBe('RETREATED');
    expect(result.round.moves).toEqual([]);
    expect(retreating.spirituality).toBe(10);
  });

  it('preserves true injury, death and deterministic replay for promoted characters', () => {
    const state = fixture();
    scriptRolls(1, 1, 1, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
    expect(result.round.consequence).toContain('最终死亡');
    vi.restoreAllMocks();
    const live = fixture(); live.random.cursor = 4;
    const reloaded = JSON.parse(JSON.stringify(live)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(live, 'DEFEND')).toEqual(resolveSliceCombatRound(reloaded, 'DEFEND'));
    expect(live).toEqual(reloaded);
    expect(forbidden).not.toHaveBeenCalled();
  });
});
