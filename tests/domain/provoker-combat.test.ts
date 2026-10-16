import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel,
  playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  PROVOKER_COUNT_WHEEL, drawProvokerAbility, isProvoker, provokerAbilityWheel,
  provokerActionCount, resolveProvokerCombatAbility,
} from '../../src/domain/provoker/combat.js';
import {
  HUNTER_COUNT_WHEEL, currentHunterApproachSource, hunterAbilityWheel,
} from '../../src/domain/hunter/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(encounterId: 'FIRST_CASE' | 'HUNTER_CARGO' | 'PROVOKER_DISPUTE' = 'PROVOKER_DISPUTE'): SliceState {
  const state = createSliceRun('provoker-combat-test', sliceDefaultCreationSelection, 'provoker-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.combat = { encounterId, round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.progression = { pathwayId: 'hunter', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spirituality = 45;
  state.provoker.cases['queue-boast']!.status = 'OBSERVED';
  state.provoker.encounter.status = encounterId === 'PROVOKER_DISPUTE' ? 'FIGHTING' : 'AVAILABLE';
  state.hunter.cargo.status = encounterId === 'HUNTER_CARGO' ? 'FIGHTING' : 'AVAILABLE';
  state.world.carrierAlive = encounterId === 'FIRST_CASE';
  state.world.carrierCanResist = encounterId === 'FIRST_CASE';
  return state;
}

/** Prescribe outcomes while advancing the exact production stream/cursor. */
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

function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}

afterEach(() => vi.restoreAllMocks());

describe('provoker S8 profile and inherited earlier behavior', () => {
  it('uses a six-sector S8 wheel without adding fire, firearms, mind control, or free traps', () => {
    const state = fixture();
    expect(isProvoker(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(PROVOKER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([15, 25, 30, 20, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel.map(({ id }) => id)).toEqual([
      'hunter.s9.physical-enhancement', 'EVADE', 'hunter.s8.provocation',
      'hunter.s8.hostility-aura', 'OBSERVE', 'MISS',
    ]);
    expect(wheel.map(({ weight }) => weight)).toEqual([30, 20, 25, 5, 15, 5]);
    expect(wheel.some(({ label }) => /枪|火|陷阱|控心/.test(label))).toBe(false);
    wheel[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it.each([[1, 1], [15, 1], [16, 2], [40, 2], [41, 3], [70, 3], [71, 4], [90, 4], [91, 5], [100, 5]])(
    'maps count roll %i to %i actions', (roll, count) => expect(provokerActionCount(roll)).toBe(count),
  );

  it.each([
    ['ATTACK', [150, 80, 100, 20, 60, 20]],
    ['DEFEND', [120, 100, 100, 20, 60, 20]],
    ['CONTROL', [120, 80, 125, 25, 60, 20]],
    ['PREPARE', [120, 80, 100, 20, 75, 20]],
  ] as const)('normalizes exact ×1.25 %s stance weights', (stance, tickets) => {
    const total = tickets.reduce((sum, weight) => sum + weight, 0);
    expect(provokerAbilityWheel(stance as SliceStance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / total * 100));
    expect(playerAbilityWheel(fixture(), stance)).toEqual(provokerAbilityWheel(stance));
  });

  it.each([
    [1, 'hunter.s9.physical-enhancement'], [120, 'hunter.s9.physical-enhancement'],
    [121, 'EVADE'], [200, 'EVADE'], [201, 'hunter.s8.provocation'],
    [300, 'hunter.s8.provocation'], [301, 'hunter.s8.hostility-aura'],
    [320, 'hunter.s8.hostility-aura'], [321, 'OBSERVE'], [380, 'OBSERVE'],
    [381, 'MISS'], [400, 'MISS'],
  ] as const)('draws neutral ticket %i as %s', (roll, expected) => {
    scriptRolls(roll);
    expect(drawProvokerAbility(stream(fixture()), null)).toBe(expected);
  });

  it('preserves ordinary, seer, clown, S9 hunter, and neutral enemy profiles', () => {
    const state = fixture();
    state.progression.sequence = 9;
    expect(isProvoker(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(HUNTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(hunterAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'diviner';
    expect(playerCountWheel(state)).toEqual(SEER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(seerAbilityWheel('CONTROL'));
    state.progression.sequence = 8;
    expect(isProvoker(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(CLOWN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(clownAbilityWheel('CONTROL'));
    state.progression.pathwayId = null; state.progression.sequence = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
  });

  it('uses base 300, core 35/30/25/10, cap 60, and spirituality maximum 45', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 430, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(321);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 430, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(10.5);
  });

  it('alternates five provoker actions with three ordinary enemy actions and one consequence draw', () => {
    const state = fixture();
    const draws = scriptRolls(91, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.playerAdvantage).toBe(455);
    expect(round.enemyAdvantage).toBe(162);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.combat!.enemyHealth).toBe(90);
    expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(12);
    expect(state.random.cursor).toBe(12);
  });

  it('applies the inherited physical health scaling once, with no mastery bonus', () => {
    const state = fixture(); state.health = 50;
    state.progression.mastery = { 'hunter.s9.physical-enhancement': 500 };
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBeCloseTo(25.2);
    expect(round.playerAdvantage).toBeCloseTo(315 * 0.9 + 25.2);
  });
});

describe('targeted words need actual public knowledge and a live matching human', () => {
  it.each([
    [5, 'GREAT_SUCCESS', 10, true], [6, 'SUCCESS', 10, true],
    [57, 'FAILURE', 0, false], [96, 'GREAT_FAILURE', 0, false],
  ] as const)('resolves roll %i through the ordinary four-tier will check', (roll, tier, gain, anger) => {
    const state = fixture(); state.spirituality = 7; state.random.cursor = 11;
    const random = stream(state), draws = scriptRolls(roll);
    const result = resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, random);
    expect(result).toMatchObject({ selfGain: gain, enemyReduction: 0, threatens: false, angersEnemy: anger });
    expect(state.lastCheck).toMatchObject({ ability: 'will', baseAbility: 15, difficulty: 12, chance: 56, roll, tier });
    expect(state.spirituality).toBe(6);
    expect(result.label).toContain('我只认先来后到');
    expect(result.label).not.toMatch(/内幕|隐秘|强制|必中/);
    expect(result.label.length).toBeLessThanOrEqual(100);
    expect(random.seed).toBe(state.random.seed);
    expect(random.cursor).toBe(12);
    expect(draws).toHaveBeenCalledTimes(1);
  });

  it('accepts completed public observation without granting new mastery or story completion', () => {
    const state = fixture(); state.provoker.cases['queue-boast']!.status = 'COMPLETED';
    const story = structuredClone(state.provoker), progression = structuredClone(state.progression);
    scriptRolls(6);
    expect(resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, stream(state)).selfGain).toBe(10);
    expect(state.provoker).toEqual(story);
    expect(state.progression).toEqual(progression);
  });

  it('does not know an unobserved boast, even in the matching encounter', () => {
    const state = fixture();
    state.provoker.cases['queue-boast'] = structuredClone(
      createSliceRun('unknown-boast', sliceDefaultCreationSelection, 'unknown-boast').provoker.cases['queue-boast']!,
    );
    const random = stream(state), before = structuredClone(state);
    expect(resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, random)).toMatchObject({
      selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false,
    });
    expect(state).toEqual(before);
    expect(random.cursor).toBe(0);
  });

  it.each(['FIRST_CASE', 'HUNTER_CARGO'] as const)('never transfers Weiss knowledge to %s', (encounter) => {
    const state = fixture(encounter), random = stream(state);
    const result = resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, random);
    expect(result).toMatchObject({ selfGain: 0, angersEnemy: false });
    expect(result.label).toContain('不凭空猜测弱点');
    expect(result.label).not.toContain('威斯');
    expect(state.spirituality).toBe(45);
    expect(state.lastCheck).toBeNull();
    expect(random.cursor).toBe(0);
  });

  it.each(['dead-player', 'ended', 'dead-enemy', 'surrendered', 'zero-enemy-health', 'no-combat', 'S9', 'not-fighting'] as const)(
    'rejects a stale or unavailable target: %s', (reason) => {
      const state = fixture();
      if (reason === 'dead-player') state.health = 0;
      if (reason === 'ended') state.status = 'SLICE_COMPLETE';
      if (reason === 'dead-enemy') state.combat!.enemyStatus = 'DEAD';
      if (reason === 'surrendered') state.combat!.enemyStatus = 'SURRENDERED';
      if (reason === 'zero-enemy-health') state.combat!.enemyHealth = 0;
      if (reason === 'no-combat') state.combat = null;
      if (reason === 'S9') state.progression.sequence = 9;
      if (reason === 'not-fighting') state.provoker.encounter.status = 'AVAILABLE';
      const random = stream(state);
      expect(resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, random).angersEnemy).toBe(false);
      expect(state.spirituality).toBe(45);
      expect(random.cursor).toBe(0);
    },
  );

  it('requires the real spirituality cost without redraw or a fabricated successful check', () => {
    const state = fixture(); state.spirituality = 0.5;
    const random = stream(state), result = resolveProvokerCombatAbility(state, 'hunter.s8.provocation', 1, random);
    expect(result).toMatchObject({ selfGain: 0, angersEnemy: false });
    expect(result.label).toContain('灵性不足1');
    expect(state.spirituality).toBe(0.5);
    expect(state.lastCheck).toBeNull();
    expect(random.cursor).toBe(0);
  });

  it('reports that hostility aura cannot affect a communicative human without charging or rolling', () => {
    const state = fixture(), random = stream(state);
    const result = resolveProvokerCombatAbility(state, 'hunter.s8.hostility-aura', 1, random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false });
    expect(result.label).toContain('可沟通的人类');
    expect(state.spirituality).toBe(45);
    expect(random.cursor).toBe(0);
  });
});

describe('anger adjusts only the remaining real enemy draws of this round', () => {
  it('uses ATTACK ×1.25 after success yet still lets the opponent draw a block', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 231, 6, 201, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBe(10);
    expect(round.moves[1]!.label).toBe('格挡护身');
    expect(draws.mock.calls).toEqual([[1, 100], [1, 100], [1, 430], [1, 100], [1, 440], [1, 1_000_000]]);
    expect(state.spirituality).toBe(13.5); // Paid 1 before normal end-of-round recovery.
    expect(state.random.cursor).toBe(6);
    expect(round.consequenceWeights).toBeNull();
  });

  it('actually expands the enemy strike sector instead of only reporting anger', () => {
    const state = fixture();
    scriptRolls(1, 1, 231, 6, 180, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.label).toBe('短棍打击');
    expect(round.moves[1]!.selfGain).toBe(16);
    expect(round.enemyAdvantage).toBe(130);
  });

  it('keeps failed provocation costly and leaves the enemy distribution unchanged', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 231, 57, 180, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBe(0);
    expect(round.moves[1]!.label).toBe('格挡护身');
    expect(draws.mock.calls[4]).toEqual([1, 400]);
    expect(state.spirituality).toBe(13.5);
  });

  it('does not change already-taken enemy moves or create a further action', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(1, 1, 180, 231, 6, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY');
    expect(round.moves.map(({ label }) => label)[0]).toBe('格挡护身');
    expect(round.moves).toHaveLength(2);
    expect(round.moves[1]!.selfGain).toBe(10);
    expect(draws.mock.calls[2]).toEqual([1, 400]);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses one non-stacking adjustment for repeated successes', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(16, 46, 231, 6, 400, 231, 6, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').map(({ selfGain }) => selfGain)).toEqual([10, 10]);
    expect(draws.mock.calls[4]).toEqual([1, 440]);
    expect(draws.mock.calls[7]).toEqual([1, 440]);
    expect(state.spirituality).toBe(12.5);
    expect(round.enemyCount).toBe(2);
  });

  it('forgets anger before the next round, including after saving and restoring', () => {
    const state = fixture();
    scriptRolls(1, 1, 231, 6, 440, 1);
    resolveSliceCombatRound(state, 'ATTACK');
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const draws = scriptRolls(1, 1, 180, 430, 1);
    const { round } = resolveSliceCombatRound(restored, 'ATTACK');
    expect(round.first).toBe('ENEMY');
    expect(round.moves[0]!.label).toBe('格挡护身');
    expect(draws.mock.calls[2]).toEqual([1, 400]);
    expect(restored.random.cursor).toBe(11);
  });

  it.each([[151, 0, 22], [331, 0, 0], [351, 8, 0], [430, 0, 0]])(
    'does not injure a one-health enemy with non-attacking sector %i', (roll, gain, reduction) => {
      const state = fixture(); state.combat!.enemyHealth = 1;
      scriptRolls(1, 1, roll, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]).toMatchObject({ selfGain: gain, enemyReduction: reduction });
      expect(round.consequenceWeights).toBeNull();
      expect(state.combat!.enemyHealth).toBe(1);
      expect(state.combat!.enemyInjuries).toEqual([]);
      expect(outcome).toBe('CONTINUE');
    },
  );

  it('cannot injure or surrender an enemy through successful words alone', () => {
    const state = fixture(); state.combat!.enemyHealth = 1;
    scriptRolls(1, 1, 231, 6, 440, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(state.combat!.enemyHealth).toBe(1);
    expect(outcome).toBe('CONTINUE');
  });
});

describe('inherited real trap, retreat, and casualty rules remain in force', () => {
  it.each(['FIRST_CASE', 'HUNTER_CARGO'] as const)('retains one real deployed trap in the original %s passage', (scene) => {
    const state = fixture(scene);
    Object.assign(state.hunter, { trapStock: 2, trapHeld: 0, trapDeployed: 1, trapSpent: 0, trapLocation: scene });
    scriptRolls(1, 1, 430, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.enemyAdvantage).toBe(110);
    expect(round.moves[1]!.label).toContain('陷阱触发');
    expect(state.hunter).toMatchObject({ trapStock: 2, trapDeployed: 0, trapSpent: 1, trapLocation: null });
    expect(round.moves).toHaveLength(2);
  });

  it('cannot teleport a trap from the old passage to the new dispute', () => {
    const state = fixture();
    Object.assign(state.hunter, { trapStock: 2, trapHeld: 0, trapDeployed: 1, trapSpent: 0, trapLocation: 'HUNTER_CARGO' });
    const before = structuredClone(state.hunter);
    expect(currentHunterApproachSource(state, 'STRIKE')).toBeNull();
    scriptRolls(1, 1, 430, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.enemyAdvantage).toBe(130);
    expect(round.moves[1]!.label).not.toContain('陷阱');
    expect(state.hunter).toEqual(before);
  });

  it('keeps successful retreat at its original odds and gives no extra recovery', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED');
    expect(round.consequence).toContain('威斯保住了现场');
    expect(state.spirituality).toBe(10);
    expect(state.health).toBe(100);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it('preserves real death after failed retreat without a new S8 protection', () => {
    const state = fixture();
    scriptRolls(1, 1, 51, 1, 1_000_000, 100);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE');
    expect(outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
  });

  it('does not protect the player from the attack provocation made more likely', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 231, 6, 180, 1_000_000, 100);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.label).toBe('短棍打击');
    expect(outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0);
    expect(state.spirituality).toBe(9);
  });

  it('preserves the correct human surrender and death branches after a real strike', () => {
    const surrendered = fixture();
    scriptRolls(1, 1, 1, 400, 1, 66);
    const result = resolveSliceCombatRound(surrendered, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('威斯仍然活着，放下短棍投降');
    expect(result.round.consequence).not.toContain('携铃者');
    vi.restoreAllMocks();
    const killed = fixture();
    scriptRolls(1, 1, 1, 400, 1, 100);
    expect(resolveSliceCombatRound(killed, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(killed.combat!.enemyHealth).toBe(0);
  });

  it('replays native random draws and real spirituality consumption exactly', () => {
    const state = fixture(), copy = structuredClone(state);
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(copy, 'CONTROL'));
    expect(copy).toEqual(state);
    expect(state.random.cursor).toBeGreaterThan(0);
  });
});
