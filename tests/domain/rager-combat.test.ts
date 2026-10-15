import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SAILOR_COUNT_WHEEL, consumeSailorScales, currentSailorCombatSource, isSailor,
  resolveSailorCombatAbility, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import { RAGER_COUNT_WHEEL, currentRagerCombatSource, drawRagerAbility, isRager,
  ragerAbilityWheel, ragerAccidentWheel, ragerActionCount, ragerWrathCharge,
  resolveRagerCombatAbility, resolveRagerPhysicalExchange,
  type RagerCombatSource, type RagerMoveId, type RagerRagePolicy, type RagerRoundPolicy,
} from '../../src/domain/rager/combat.js';
import { NAVIGATOR_COUNT_WHEEL, navigatorAbilityWheel } from '../../src/domain/navigator/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'tyrant.s8.fury', secondary = 'TYRANT_COMBO', protection = 'tyrant.s8.impact-resilience';
const ids = [primary, secondary, protection, 'INTIMIDATE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('rager-combat-test', sliceDefaultCreationSelection, 'rager-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'tyrant', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: RagerMoveId, policy: RagerRoundPolicy = { policy: 'HOLD', released: false },
  source = currentRagerCombatSource(state), physical = 1) {
  return resolveRagerCombatAbility(state, id, physical, stream(state), policy, source);
}
/** Keep the production cursor while selecting exact actual action boundaries. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Rager S8 exact M profile and budgets', () => {
  it('uses independent 30/30/25/15 counts, six 38/20/8/5/4/25 slots and copied projections', () => {
    const state = fixture();
    expect(isRager(state)).toBe(true); expect(isSailor(state)).toBe(false);
    expect(playerAbilityWheel(state, null)).toEqual(ragerAbilityWheel(null));
    expect(ragerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(ragerAbilityWheel(null).map(entry => entry.weight)).toEqual([38, 20, 8, 5, 4, 25]);
    expect(playerCountWheel(state)).toEqual(RAGER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([30, 30, 25, 15]);
    const wheel = playerAbilityWheel(state, null), count = playerCountWheel(state);
    wheel[0]!.weight = 0; count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(38);
    expect(playerCountWheel(state)[0]!.weight).toBe(30);
    expect(Object.isFrozen(RAGER_COUNT_WHEEL)).toBe(true);
    expect(RAGER_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
  });

  it('preserves every count/slot boundary and consumes one draw per ability', () => {
    for (const [roll, count] of [[1, 1], [30, 1], [31, 2], [60, 2], [61, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(ragerActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of ragerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawRagerAbility(random, null)).toBe(entry.id);
      expect(drawRagerAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses existing normalized stance tickets without changing action counts', () => {
    for (const [stance, weights] of [
      ['ATTACK', [190, 100, 32, 20, 16, 100]],
      ['DEFEND', [152, 80, 40, 20, 16, 100]],
      ['CONTROL', [152, 80, 32, 25, 16, 100]],
      ['PREPARE', [152, 80, 32, 20, 20, 100]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(ragerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
    }
    expect(ragerAbilityWheel('RETREAT')).toEqual(ragerAbilityWheel(null));
  });

  it('uses base300, core45/25/20/10, cap60 and spirituality45 with recovery4.5', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 343, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(319.5); expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBe(319.5 / 433.5 * 100); expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('uses exact 23.4f/12.6f/5.85f/3.15f budgets at every mastery endpoint', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      state.spirituality = 0;
      state.progression.mastery = { [primary]: mastery, [protection]: mastery };
      const before = structuredClone(state);
      expect(resolveRagerCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 23.4 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveRagerCombatAbility(state, secondary, 0.8, random)).toMatchObject({ selfGain: 12.6 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveRagerCombatAbility(state, protection, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 5.85 * f, threatens: false });
      expect(resolveRagerCombatAbility(state, 'INTIMIDATE', 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 3.15 * f, threatens: false });
      before.combat!.wrathCharge = 2; before.combat!.sailorScalesReady = true;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('uses only stable ability mastery and clamps malformed mastery or physical factors', () => {
    const state = fixture();
    state.progression.mastery = { [primary]: 500, [protection]: 0, 'tyrant.s9.physique': 0, TYRANT_COMBO: 0 };
    expect(resolve(state, primary).selfGain).toBe(23.4);
    expect(resolve(state, secondary).selfGain).toBe(12.6);
    expect(resolve(state, protection).enemyReduction).toBe(5.85 * 0.65);
    expect(resolve(state, 'INTIMIDATE').enemyReduction).toBe(3.15);
    for (const mastery of [-100, Number.NaN, Number.POSITIVE_INFINITY, 1000]) {
      state.progression.mastery[primary] = mastery;
      expect(resolve(state, primary).selfGain).toBe(23.4 * (mastery === 1000 ? 1 : 0.65));
    }
    for (const id of [primary, secondary] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        state.combat!.wrathCharge = 2;
        const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
        expect(resolve(state, id, policy, currentRagerCombatSource(state), physical)).toMatchObject({ selfGain: 0, threatens: false });
        expect(policy.released).toBe(false); expect(state.combat!.wrathCharge).toBe(2);
      }
    }
  });

  it('replaces only the primary with the actual held club16, never adds the two budgets', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      expect(resolve(state, primary).selfGain).toBe(location === 'HAND' ? 16 : 23.4);
      expect(resolve(state, secondary).selfGain).toBe(12.6);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '蓄势怒击');
    }
    state.town.clubLocation = 'HAND'; state.combat!.wrathCharge = 3;
    const effect = resolve(state, primary, { policy: 'RELEASE_FIRST', released: false });
    expect(effect.selfGain).toBe(16 * 1.4); expect(effect.label).toContain('不叠加体术预算');
    expect(state.combat!.wrathCharge).toBe(1);
  });

  it('preserves ordinary and S9 profiles and does not lend S8 to higher sequences', () => {
    const state = fixture();
    state.progression.sequence = 9;
    expect(isRager(state)).toBe(false); expect(isSailor(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
    state.progression.sequence = 7;
    expect(isRager(state)).toBe(false); expect(currentRagerCombatSource(state)).not.toBeNull();
    expect(playerCountWheel(state)).toEqual(NAVIGATOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(navigatorAbilityWheel('CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['hunter', null]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isRager(state)).toBe(false); expect(currentRagerCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });
});

describe('actual hostile exchanges and player-controlled release', () => {
  it('defaults to HOLD, gains once per main/secondary attack and caps at3', () => {
    const state = fixture();
    for (let index = 0; index < 6; index += 1) {
      const id = index % 2 === 0 ? primary : secondary, effect = resolve(state, id);
      expect(effect.selfGain).toBe((id === primary ? 23.4 : 12.6) * 0.65);
      expect(effect.label).toContain('按本轮选择保留');
      expect(ragerWrathCharge(state)).toBe(Math.min(index + 1, 3));
    }
    expect(resolve(state, primary).label).toContain('怒势3→3/3（已满）');
  });

  it('spends existing2/3 layers, clears all, then builds exactly1 from the current hit', () => {
    for (const charge of [2, 3]) for (const id of [primary, secondary] as const) {
      const state = fixture(); state.combat!.wrathCharge = charge;
      const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      const effect = resolve(state, id, policy);
      expect(effect.selfGain).toBe((id === primary ? 23.4 : 12.6) * 0.65 * (charge === 3 ? 1.4 : 1.25));
      expect(effect.label).toContain(`释放${charge}层怒击`); expect(effect.label).toContain('怒势0→1/3');
      expect(state.combat!.wrathCharge).toBe(1); expect(policy.released).toBe(true);
    }
  });

  it('never spends the current hit newly gained second layer; later eligible attack can release', () => {
    const state = fixture(); state.combat!.wrathCharge = 1;
    const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
    expect(resolve(state, primary, policy).selfGain).toBe(23.4 * 0.65);
    expect(state.combat!.wrathCharge).toBe(2); expect(policy.released).toBe(false);
    const second = resolve(state, secondary, policy);
    expect(second.selfGain).toBe(12.6 * 0.65 * 1.25);
    expect(state.combat!.wrathCharge).toBe(1); expect(policy.released).toBe(true);
  });

  it('does not count OPENING, defense, preparation, accident, allies, self-harm or zero/negative contribution', () => {
    const state = fixture(); state.combat!.wrathCharge = 1;
    for (const actor of ['PLAYER', 'ENEMY'] as const) {
      for (const move of ['OPENING', 'BLOCK', 'DISTANCE', 'MISS', protection, 'INTIMIDATE', 'OBSERVE', 'ACCIDENT', 'SELF_HARM']) {
        expect(resolveRagerPhysicalExchange(state, actor, move, 10)).toBeNull();
      }
    }
    expect(resolveRagerPhysicalExchange(state, 'PLAYER', 'STRIKE', 16)).toBeNull();
    expect(resolveRagerPhysicalExchange(state, 'ENEMY', primary, 16)).toBeNull();
    expect(resolveRagerPhysicalExchange(state, 'ALLY' as 'ENEMY', 'STRIKE', 16)).toBeNull();
    for (const contribution of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', contribution)).toBeNull();
      expect(resolveRagerPhysicalExchange(state, 'PLAYER', primary, contribution)).toBeNull();
    }
    expect(state.combat!.wrathCharge).toBe(1);
    expect(resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 12)).toContain('怒势1→2/3');
    expect(resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16)).toContain('怒势2→3/3');
  });

  it('requires current original hostile body and rejects every stale or forged source field', () => {
    const state = fixture(), source = currentRagerCombatSource(state)!;
    expect(source).toMatchObject({ encounterId: 'FIRST_CASE', round: 1, water: 'NONE', throwable: 'NONE' });
    expect(currentSailorCombatSource(state)).toBeNull();
    const invalid: (RagerCombatSource | null)[] = [null,
      { ...source, runId: 'another-run' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'water', 'throwable', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as RagerCombatSource)];
    for (const input of invalid) {
      state.combat!.wrathCharge = 3;
      const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      expect(resolve(state, primary, policy, input).selfGain).toBe(23.4 * 0.65);
      expect(resolve(state, secondary, policy, input).selfGain).toBe(12.6 * 0.65);
      expect(resolve(state, protection, policy, input).enemyReduction).toBe(5.85 * 0.65);
      expect(resolve(state, 'INTIMIDATE', policy, input).enemyReduction).toBe(10);
      expect(resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16, input)).toBeNull();
      expect(state.combat!.wrathCharge).toBe(3); expect(policy.released).toBe(false);
      expect(state.combat!.sailorScalesReady).toBeUndefined();
    }
    for (const mutate of [
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const candidate = fixture(); candidate.combat!.wrathCharge = 2; mutate(candidate);
      expect(currentRagerCombatSource(candidate)).toBeNull();
      const effect = resolve(candidate, primary, { policy: 'RELEASE_FIRST', released: false });
      expect(effect.label).toContain('缺少当前敌对来源'); expect(candidate.combat!.wrathCharge).toBe(2);
    }
  });

  it('does nothing in absent, terminal, dead or wrong-profile combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 9; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentRagerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveRagerCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16)).toBeNull();
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('normalized accident risk, R0 and inherited scales', () => {
  it('adds0/3/6/10 to BAD50 then normalizes, without an additional fixed accident chance', () => {
    for (const [charge, extra] of [[0, 0], [1, 3], [2, 6], [3, 10]]) {
      const state = fixture(); state.combat!.wrathCharge = charge!;
      expect(ragerAccidentWheel(state).map(entry => entry.weight)).toEqual([
        50 / (100 + extra!) * 100, (50 + extra!) / (100 + extra!) * 100,
      ]);
      const before = structuredClone(state), random = stream(state);
      const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      const draws = scriptRolls(1, 50, 51, 100 + extra!);
      for (const selfGain of [7.5, 7.5, -7.5, -7.5]) {
        expect(resolveRagerCombatAbility(state, 'ACCIDENT', 0, random, policy)).toMatchObject({ selfGain, enemyReduction: 0, threatens: false });
      }
      expect(draws).toHaveBeenCalledTimes(4); expect(random.cursor).toBe(4);
      expect(policy.released).toBe(false); expect(state).toEqual(before);
      vi.restoreAllMocks();
    }
  });

  it('preparation keeps R0 without extra wrath, spirituality, mastery or action', () => {
    const state = fixture(); state.combat!.wrathCharge = 2; state.spirituality = 0;
    const before = structuredClone(state), random = stream(state);
    expect(resolveRagerCombatAbility(state, 'OBSERVE', 1, random,
      { policy: 'RELEASE_FIRST', released: false })).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('retains self-defense plus one inherited×0.75 against only the actual STRIKE', () => {
    const state = fixture(); state.combat!.wrathCharge = 2;
    for (let index = 0; index < 2; index += 1) {
      expect(resolve(state, protection).enemyReduction).toBe(5.85 * 0.65);
      expect(state.combat!.sailorScalesReady).toBe(true);
    }
    for (const move of ['OPENING', 'BLOCK', 'DISTANCE', 'MISS'] as const) {
      expect(consumeSailorScales(state, move)).toBeNull(); expect(state.combat!.sailorScalesReady).toBe(true);
    }
    expect(consumeSailorScales(state, 'STRIKE')).toMatchObject({ physicalMultiplier: 0.75 });
    expect(state.combat!.sailorScalesReady).toBeUndefined();
    expect(consumeSailorScales(state, 'STRIKE')).toBeNull(); expect(state.combat!.wrathCharge).toBe(2);
    // Inheritance extends the shared source only, not the S9-specific resolver.
    expect(resolveSailorCombatAbility(state, 'tyrant.s9.balance', 1, stream(state)).enemyReduction).toBe(0);
  });
});

describe('complete S8 rounds and serialized cross-round state', () => {
  it('retains four actual S8 moves, ordinary enemy counts and one wrath gain per effective move', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 191, 1, 291, 1, 323, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [23.4 * 0.65, 0], [12.6 * 0.65, 0], [0, 5.85 * 0.65], [0, 3.15 * 0.65],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 12]);
    expect(round.moves.filter(move => /怒势\d→\d/.test(move.label))).toHaveLength(5);
    expect(round.playerAdvantage).toBe(315 * 0.8 + (23.4 * 0.65 + 12.6 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 44 - (5.85 * 0.65 + 3.15 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.wrathCharge).toBe(3); expect(state.spirituality).toBe(14.5);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.week).toBe(before.week); expect(state.progression).toEqual(before.progression);
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(before.random.cursor + 11);
  });

  it('default HOLD and explicit HOLD are identical and never release automatically', () => {
    const state = fixture(); state.combat!.wrathCharge = 3;
    const explicit = structuredClone(state);
    scriptRolls(1, 1, 1, 400, 1, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.moves[0]!.selfGain).toBe(23.4 * 0.65);
    expect(result.round.moves[0]!.label).toContain('按本轮选择保留');
    expect(state.combat!.wrathCharge).toBe(3);
    vi.restoreAllMocks(); scriptRolls(1, 1, 1, 400, 1, 1);
    expect(resolveSliceCombatRound(explicit, 'ATTACK', 'HOLD')).toEqual(result);
    expect(explicit).toEqual(state);
  });

  it('releases at most once even when later actual exchanges rebuild3 in the same round', () => {
    const state = fixture(); state.combat!.wrathCharge = 3;
    const draws = scriptRolls(100, 100, 1, 1, 191, 1, 1, 1, 191, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain)).toEqual([
      23.4 * 0.65 * 1.4, 12.6 * 0.65, 23.4 * 0.65, 12.6 * 0.65,
    ]);
    expect(round.moves.filter(move => move.label.includes('按本轮选择释放'))).toHaveLength(1);
    expect(state.combat!.wrathCharge).toBe(3); expect(draws).toHaveBeenCalledTimes(11);
  });

  it('keeps insufficient first attack ordinary then releases at the later eligible secondary', () => {
    const state = fixture();
    const draws = scriptRolls(61, 46, 1, 1, 191, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain)).toEqual([
      23.4 * 0.65, 12.6 * 0.65 * 1.25, 23.4 * 0.65,
    ]);
    expect(round.moves[0]!.label).toContain('不足2层');
    expect(round.moves[2]!.label).toContain('释放2层'); expect(state.combat!.wrathCharge).toBe(3);
    expect(draws).toHaveBeenCalledTimes(9);
  });

  it('does not consume if no attack qualifies and does not carry the release policy to next round', () => {
    const state = fixture(); state.combat!.wrathCharge = 3;
    scriptRolls(1, 1, 343, 400, 1);
    resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(state.combat!.wrathCharge).toBe(3);
    vi.restoreAllMocks(); scriptRolls(1, 1, 400, 1, 1, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK');
    expect(next.round.moves[1]!.selfGain).toBe(23.4 * 0.65);
    expect(next.round.moves[1]!.label).toContain('按本轮选择保留');
    expect(state.combat!.wrathCharge).toBe(3);
  });

  it('keeps charge/scales through JSON and applies next enemy strike before chosen release', () => {
    const state = fixture(); state.combat!.wrathCharge = 2;
    scriptRolls(1, 1, 291, 300, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.outcome).toBe('CONTINUE'); expect(state.combat!.wrathCharge).toBe(2);
    expect(state.combat!.sailorScalesReady).toBe(true); expect(first.round.moves[1]!.selfGain).toBe(8);
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    scriptRolls(1, 1, 1, 1, 1, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(next.round.first).toBe('ENEMY'); expect(next.round.moves[0]!.selfGain).toBe(12);
    expect(next.round.moves[0]!.label).toContain('怒势2→3/3');
    expect(next.round.moves[1]!.selfGain).toBe(23.4 * 0.65 * 1.4);
    expect(state.combat!.wrathCharge).toBe(1); expect(state.combat!.sailorScalesReady).toBeUndefined();
    vi.restoreAllMocks(); scriptRolls(1, 1, 1, 1, 1, 1);
    expect(resolveSliceCombatRound(restored, 'ATTACK', 'RELEASE_FIRST')).toEqual(next);
    expect(restored).toEqual(state);
  });

  it('does not grant wounds, extra wrath or forced death from R0/control/defense/positive or negative accident', () => {
    for (const [slot, accident] of [[291, 0], [323, 0], [343, 0], [359, 1], [359, 110]]) {
      const state = fixture(); state.combat!.wrathCharge = 3;
      const draws = accident ? scriptRolls(1, 1, slot!, accident, 400, 1) : scriptRolls(1, 1, slot!, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ wrathCharge: 3, enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.health).toBe(100); expect(state.status).toBe('ACTIVE');
      expect(round.moves[0]!.selfGain).toBe(accident ? accident === 1 ? 7.5 : -7.5 : 0);
      expect(draws).toHaveBeenCalledTimes(accident ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('clears charge and scales on every terminal path and preserves ordinary injury/death rules', () => {
    for (const [stance, rolls, outcome] of [
      ['RETREAT', [1, 1, 1], 'RETREATED'],
      ['ATTACK', [1, 1, 1, 400, 1, 66], 'ENEMY_SURRENDERED'],
      ['ATTACK', [1, 1, 1, 400, 1, 96], 'ENEMY_DEAD'],
      ['ATTACK', [1, 1, 291, 1, 1_000_000, 96], 'PLAYER_DEAD'],
    ] as const) {
      const state = fixture(); state.combat!.wrathCharge = 3; state.combat!.sailorScalesReady = true;
      state.spirituality = 10;
      scriptRolls(...rolls);
      const result = resolveSliceCombatRound(state, stance, 'RELEASE_FIRST');
      expect(result.outcome).toBe(outcome); expect(state.combat!.wrathCharge).toBeUndefined();
      expect(state.combat!.sailorScalesReady).toBeUndefined(); expect(state.spirituality).toBe(10);
      if (outcome === 'PLAYER_DEAD') {
        expect(state.health).toBe(0); expect(result.round.moves[1]!.selfGain).toBe(12);
        expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      }
      vi.restoreAllMocks();
    }
  });

  it('replays without global random and rejects unknown or wrong-profile release without mutation', () => {
    const state = fixture(); state.combat!.wrathCharge = 2; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL', 'RELEASE_FIRST')).toEqual(resolveSliceCombatRound(restored, 'CONTROL', 'RELEASE_FIRST'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    for (const [sequence, policy] of [[8, 'UNKNOWN'], [9, 'RELEASE_FIRST']] as const) {
      const candidate = fixture(); candidate.progression.sequence = sequence;
      const before = structuredClone(candidate);
      expect(() => resolveSliceCombatRound(candidate, 'ATTACK', policy as RagerRagePolicy)).toThrow();
      expect(candidate).toEqual(before);
    }
  });
});
