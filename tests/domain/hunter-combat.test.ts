import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  HUNTER_COUNT_WHEEL, currentHunterApproachSource, currentHunterDangerSource,
  hunterActionCount, resolveHunterCombatAbility, resolveHunterTrap,
} from '../../src/domain/hunter/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(encounterId: 'FIRST_CASE' | 'HUNTER_CARGO' = 'HUNTER_CARGO'): SliceState {
  const state = createSliceRun('hunter-combat-test', sliceDefaultCreationSelection, 'hunter-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.combat = { encounterId, round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: 'hunter', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spirituality = 30;
  state.hunter.cargo.status = encounterId === 'HUNTER_CARGO' ? 'FIGHTING' : 'AVAILABLE';
  state.world.carrierAlive = encounterId === 'FIRST_CASE';
  state.world.carrierCanResist = encounterId === 'FIRST_CASE';
  return state;
}

function deploy(state: SliceState, location: 'FIRST_CASE' | 'HUNTER_CARGO' = 'HUNTER_CARGO') {
  state.hunter.trapStock = 2;
  state.hunter.trapHeld = 0;
  state.hunter.trapDeployed = 1;
  state.hunter.trapSpent = 0;
  state.hunter.trapLocation = location;
}

function trapTotal(state: SliceState): number {
  const hunter = state.hunter;
  return hunter.trapStock + hunter.trapHeld + hunter.trapDeployed + hunter.trapSpent;
}

/** Prescribe draws while retaining the production stream's real cursor advancement. */
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

describe('hunter S9 profile and unchanged earlier pathways', () => {
  it('uses its own five-sector wheel without inventing weapons, higher-sequence powers, or instant traps', () => {
    const state = fixture();
    expect(playerCountWheel(state)).toEqual(HUNTER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([20, 40, 30, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel.map(({ id }) => id)).toEqual([
      'hunter.s9.physical-enhancement', 'EVADE', 'hunter.s9.hunting-instinct', 'OBSERVE', 'MISS',
    ]);
    expect(wheel.map(({ weight }) => weight)).toEqual([40, 20, 15, 20, 5]);
    expect(wheel.some(({ label }) => /枪|挑衅|火|陷阱|追踪/.test(label))).toBe(false);
    const counts = playerCountWheel(state); counts[0]!.weight = 0; wheel[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(20);
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(40);
  });

  it.each([[1, 1], [20, 1], [21, 2], [60, 2], [61, 3], [90, 3], [91, 4], [100, 4]])(
    'maps count roll %i to %i actions', (roll, count) => expect(hunterActionCount(roll)).toBe(count),
  );

  it.each([
    ['ATTACK', [200, 80, 60, 80, 20]],
    ['DEFEND', [160, 100, 60, 80, 20]],
    ['CONTROL', [160, 80, 75, 80, 20]],
    ['PREPARE', [160, 80, 60, 100, 20]],
  ] as const)('retains exact ×1.25 normalized %s stance weights', (stance, tickets) => {
    const total = tickets.reduce((sum, weight) => sum + weight, 0);
    expect(playerAbilityWheel(fixture(), stance as SliceStance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / total * 100));
  });

  it('preserves the ordinary, seer, clown, and enemy wheel contracts', () => {
    const state = fixture();
    state.progression.pathwayId = 'diviner';
    expect(playerCountWheel(state)).toEqual(SEER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(seerAbilityWheel('CONTROL'));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(CLOWN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(clownAbilityWheel('CONTROL'));
    state.progression.pathwayId = null; state.progression.sequence = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
  });

  it('uses base 200, core weights 40/30/10/20, and the existing capped state penalty', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 440, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(221);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 440, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(9);
  });

  it('alternates four hunter actions against three ordinary actions with only one consequence draw', () => {
    const state = fixture();
    const draws = scriptRolls(91, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER',
    ]);
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').map(({ selfGain }) => selfGain)).toEqual([24, 24, 24, 24]);
    expect(round.moves.filter(({ actor }) => actor === 'ENEMY').map(({ selfGain }) => selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(311);
    expect(round.enemyAdvantage).toBe(162);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.combat!.enemyHealth).toBe(90);
    expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(11);
    expect(state.random.cursor).toBe(11);
  });

  it('scales physical damage contribution only once by the existing health bracket', () => {
    const state = fixture(); state.health = 50;
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBeCloseTo(21.6);
    expect(round.playerAdvantage).toBeCloseTo(215 * 0.9 + 21.6);
  });

  it.each([[201, 0, 18], [281, 0, 15], [341, 8, 0], [440, 0, 0]])(
    'does not injure a one-health enemy with non-attacking sector %i', (roll, gain, reduction) => {
      const state = fixture(); state.combat!.enemyHealth = 1;
      const draws = scriptRolls(1, 1, roll, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]).toMatchObject({ selfGain: gain, enemyReduction: reduction });
      expect(round.consequenceWeights).toBeNull();
      expect(state.combat!.enemyHealth).toBe(1);
      expect(state.combat!.enemyInjuries).toEqual([]);
      expect(outcome).toBe('CONTINUE');
      expect(draws).toHaveBeenCalledTimes(5);
    },
  );

  it('does not create passive mastery bonuses, free traps, or opening spirituality recovery', () => {
    const state = fixture(); state.spirituality = 10;
    state.progression.mastery = { 'hunter.s9.hunting-instinct': 500, 'hunter.s9.trapcraft': 500 };
    const trapBefore = structuredClone(state.hunter);
    const draws = scriptRolls(100, 100, 50);
    expect(resolveSliceCombatRound(state, 'RETREAT').outcome).toBe('RETREATED');
    expect(state.spirituality).toBe(10);
    expect(state.hunter).toEqual(trapBefore);
    expect(draws).toHaveBeenCalledTimes(3);
  });
});

describe('hunter intuition has a present encounter-bound threat source', () => {
  it('uses the current cargo opponent independently of the dead first-case carrier', () => {
    const state = fixture();
    const source = currentHunterDangerSource(state)!;
    const result = resolveHunterCombatAbility(state, 'hunter.s9.hunting-instinct', 1, source);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 15, threatens: false });
    expect(result.label).toContain('拦路者');
    expect(result.label).not.toMatch(/携铃者|铜铃|必定|幕后|途径/);
    expect(resolveHunterCombatAbility(state, 'hunter.s9.hunting-instinct', 1).enemyReduction).toBe(0);
    expect(resolveHunterCombatAbility(state, 'hunter.s9.hunting-instinct', 1,
      { ...source, round: 2 }).enemyReduction).toBe(0);
    expect(resolveHunterCombatAbility(state, 'hunter.s9.hunting-instinct', 1,
      { ...source, encounterId: 'FIRST_CASE' }).enemyReduction).toBe(0);
  });

  it.each(['SURRENDERED', 'DEAD'] as const)('rejects stale danger after the enemy is %s', (status) => {
    const state = fixture();
    const source = currentHunterDangerSource(state)!;
    state.combat!.enemyStatus = status;
    expect(currentHunterDangerSource(state)).toBeNull();
    expect(resolveHunterCombatAbility(state, 'hunter.s9.hunting-instinct', 1, source).enemyReduction).toBe(0);
  });

  it('rejects dead, ended, unrelated, and not-yet-fighting scenes', () => {
    const dead = fixture(); dead.combat!.enemyHealth = 0;
    expect(currentHunterDangerSource(dead)).toBeNull();
    const ended = fixture(); ended.status = 'DEAD';
    expect(currentHunterDangerSource(ended)).toBeNull();
    const unrelated = fixture(); unrelated.combat!.encounterId = 'CLOWN_RESCUE';
    expect(currentHunterDangerSource(unrelated)).toBeNull();
    const awaiting = fixture(); awaiting.hunter.cargo.status = 'AVAILABLE';
    expect(currentHunterDangerSource(awaiting)).toBeNull();
    const oldCase = fixture('FIRST_CASE'); oldCase.world.carrierCanResist = false;
    expect(currentHunterDangerSource(oldCase)).toBeNull();
  });
});

describe('real deployed traps react once to the same-scene approaching strike', () => {
  it.each(['FIRST_CASE', 'HUNTER_CARGO'] as const)('consumes one actual trap in %s without adding action, draw, or injury', (scene) => {
    const state = fixture(scene); deploy(state, scene); state.combat!.enemyHealth = 1;
    const enemyBase = 114 * 0.8;
    const draws = scriptRolls(1, 1, 440, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.enemyAdvantage).toBeCloseTo(enemyBase + 16 - 20);
    expect(round.moves).toHaveLength(2);
    expect(round.moves[1]!.label).toContain('既有狭口');
    expect(round.moves[1]!.label).toContain('敌方优势减少20');
    expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(1);
    expect(state.combat!.enemyInjuries).toEqual([]);
    expect(state.hunter).toMatchObject({ trapStock: 2, trapHeld: 0, trapDeployed: 0, trapSpent: 1, trapLocation: null });
    expect(trapTotal(state)).toBe(3);
    expect(draws).toHaveBeenCalledTimes(5);
    expect(outcome).toBe('CONTINUE');
  });

  it('does not retrigger on later strikes or after restoring the committed round', () => {
    const state = fixture(); deploy(state);
    const draws = scriptRolls(91, 86, 440, 1, 440, 1, 440, 1, 440, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.enemyAdvantage).toBe(142); // 114 + 3 × 16 - 20
    expect(round.moves.filter(({ label }) => label.includes('陷阱触发'))).toHaveLength(1);
    expect(round.moves).toHaveLength(7);
    expect(draws).toHaveBeenCalledTimes(10);
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    scriptRolls(1, 1, 1, 440, 1);
    const later = resolveSliceCombatRound(restored, 'ATTACK');
    expect(later.round.enemyAdvantage).toBe(130);
    expect(later.round.moves.some(({ label }) => label.includes('陷阱触发'))).toBe(false);
    expect(restored.hunter.trapSpent).toBe(1);
    expect(trapTotal(restored)).toBe(3);
  });

  it.each([['BLOCK', 200], ['OPENING', 300], ['DISTANCE', 360], ['MISS', 400]] as const)(
    'keeps the deployed trap when the actual enemy move is %s', (move, roll) => {
      const state = fixture(); deploy(state);
      expect(currentHunterApproachSource(state, move)).toBeNull();
      const draws = scriptRolls(1, 1, 440, roll, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.some(({ label }) => label.includes('陷阱触发'))).toBe(false);
      expect(state.hunter.trapDeployed).toBe(1);
      expect(state.hunter.trapSpent).toBe(0);
      expect(state.hunter.trapLocation).toBe('HUNTER_CARGO');
      expect(draws).toHaveBeenCalledTimes(5);
    },
  );

  it('waits through a non-striking round for the first actual approach', () => {
    const state = fixture(); deploy(state);
    scriptRolls(1, 1, 440, 400, 1);
    resolveSliceCombatRound(state, 'ATTACK');
    expect(state.hunter.trapDeployed).toBe(1);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 440, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY');
    expect(round.moves[0]!.label).toContain('陷阱触发');
    expect(state.hunter.trapSpent).toBe(1);
    expect(state.hunter.trapLocation).toBeNull();
  });

  it('does not consume held, absent, stale, wrong-scene, invalid-route, or non-conserved assets', () => {
    const state = fixture(); deploy(state);
    const source = currentHunterApproachSource(state, 'STRIKE')!;
    const initial = structuredClone(state.hunter);
    expect(resolveHunterTrap(state, null)).toBeNull();
    expect(resolveHunterTrap(state, { ...source, round: 2 })).toBeNull();
    expect(resolveHunterTrap(state, { ...source, encounterId: 'FIRST_CASE' })).toBeNull();
    expect(resolveHunterTrap(state, { ...source, route: 'UNPROVEN_ROUTE' } as unknown as typeof source)).toBeNull();
    expect(state.hunter).toEqual(initial);
    state.hunter.trapLocation = 'FIRST_CASE';
    expect(resolveHunterTrap(state, source)).toBeNull();
    state.hunter.trapLocation = null; state.hunter.trapHeld = 1; state.hunter.trapDeployed = 0;
    expect(resolveHunterTrap(state, source)).toBeNull();
    expect(state.hunter.trapHeld).toBe(1);
    deploy(state); state.hunter.trapStock = 3;
    expect(resolveHunterTrap(state, source)).toBeNull();
    expect(state.hunter.trapDeployed).toBe(1);
    deploy(state); state.combat!.enemyStatus = 'SURRENDERED';
    expect(resolveHunterTrap(state, source)).toBeNull();
    expect(state.hunter.trapSpent).toBe(0);
  });

  it('cannot prevent real player death or turn traps into automatic enemy surrender', () => {
    const state = fixture(); deploy(state);
    scriptRolls(1, 1, 440, 1, 1_000_000, 100);
    const { outcome, round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(state.hunter.trapSpent).toBe(1);
  });

  it('retains ordinary enemy death and live surrender outcomes with the correct opponent name', () => {
    const surrendered = fixture();
    scriptRolls(1, 1, 1, 400, 1, 66);
    const result = resolveSliceCombatRound(surrendered, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('拦路者仍然活着，放下短棍投降');
    expect(result.round.consequence).not.toContain('携铃者');
    vi.restoreAllMocks();
    const killed = fixture();
    scriptRolls(1, 1, 1, 400, 1, 100);
    expect(resolveSliceCombatRound(killed, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(killed.combat!.enemyHealth).toBe(0);
  });

  it('replays the same native random stream and trap state deterministically', () => {
    const state = fixture(); deploy(state);
    const copy = structuredClone(state);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    const second = resolveSliceCombatRound(copy, 'ATTACK');
    expect(second).toEqual(first);
    expect(copy).toEqual(state);
    expect(state.random.cursor).toBeGreaterThan(0);
    expect(trapTotal(state)).toBe(3);
  });
});
