import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { NAVIGATOR_COUNT_WHEEL, consumeNavigatorWater, currentNavigatorCombatSource,
  drawNavigatorAbility, isNavigator, navigatorAbilityWheel, navigatorActionCount,
  resolveNavigatorCombatAbility, resolveNavigatorSuffocationContest,
  type NavigatorCombatSource, type NavigatorMoveId,
} from '../../src/domain/navigator/combat.js';
import { RAGER_COUNT_WHEEL, currentRagerCombatSource, hasRagerWrath, isRager,
  ragerAbilityWheel, ragerWrathCharge, resolveRagerCombatAbility, resolveRagerPhysicalAttack,
  resolveRagerPhysicalExchange, type RagerRoundPolicy,
} from '../../src/domain/rager/combat.js';
import { SAILOR_COUNT_WHEEL, consumeSailorScales, currentSailorCombatSource,
  resolveSailorCombatAbility, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'tyrant.s7.water-control', secondary = 'NAVIGATOR_WAVE', guard = 'NAVIGATOR_WATER_GUARD';
const control = 'tyrant.s7.water-binding', prepare = 'tyrant.s7.navigation';
const ids = [primary, secondary, guard, control, prepare, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('navigator-combat-test', sliceDefaultCreationSelection, 'navigator-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'tyrant', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: NavigatorMoveId,
  policy: RagerRoundPolicy = { policy: 'HOLD', released: false },
  source = currentNavigatorCombatSource(state), physical = 1) {
  return resolveNavigatorCombatAbility(state, id, physical, stream(state), policy, source);
}
/** Script exact boundaries while keeping the real production RNG cursor. */
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

describe('Navigator S7 exact D profile and bounded budgets', () => {
  it('uses independent 22/28/25/17/8 counts and six 32/18/12/10/8/20 slots', () => {
    const state = fixture();
    expect(isNavigator(state)).toBe(true); expect(isRager(state)).toBe(false); expect(hasRagerWrath(state)).toBe(true);
    expect(navigatorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(navigatorAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(navigatorAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(NAVIGATOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([22, 28, 25, 17, 8]);
    const wheel = playerAbilityWheel(state, null), count = playerCountWheel(state);
    wheel[0]!.weight = 0; count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
    expect(Object.isFrozen(NAVIGATOR_COUNT_WHEEL)).toBe(true);
    expect(NAVIGATOR_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
  });

  it('preserves every slot/count boundary with one RNG draw per ability', () => {
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(navigatorActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of navigatorAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawNavigatorAbility(random, null)).toBe(entry.id);
      expect(drawNavigatorAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('retains only the existing normalized stance ×1.25 tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [160, 90, 48, 40, 32, 80]],
      ['DEFEND', [128, 72, 60, 40, 32, 80]],
      ['CONTROL', [128, 72, 48, 50, 32, 80]],
      ['PREPARE', [128, 72, 48, 40, 40, 80]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(navigatorAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(weight => weight / total * 100));
    }
    expect(navigatorAbilityWheel('RETREAT')).toEqual(navigatorAbilityWheel(null));
  });

  it('uses base450, core40/25/25/10 capped90 and max spirituality60', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(470.5); expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBe(470.5 / 584.5 * 100); expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(540);
  });

  it('reads exact unrounded S7 mastery budgets and never gives free health, resource or mastery', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      state.progression.mastery = { [primary]: mastery, [control]: mastery };
      state.health = 50; state.spirituality = 0;
      const before = structuredClone(state);
      expect(resolveNavigatorCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 38.025 * f, enemyReduction: 0, threatens: true });
      expect(resolveNavigatorCombatAbility(state, secondary, 0.8, random)).toMatchObject({ selfGain: 20.475 * f, enemyReduction: 0, threatens: true });
      expect(resolveNavigatorCombatAbility(state, guard, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 8.775 * f, threatens: false });
      expect(resolveNavigatorCombatAbility(state, control, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 4.725 * f, threatens: false });
      expect(state.health).toBe(before.health); expect(state.spirituality).toBe(0);
      expect(state.progression).toEqual(before.progression); expect(random.cursor).toBe(0);
      expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 2, bound: true, skipNext: false });
      expect(state.combat!.sailorScalesReady).toBe(true);
    }
  });

  it('does not change ordinary, S9 or S8 routing or grant their resolvers to S7', () => {
    const state = fixture();
    expect(resolveRagerCombatAbility(state, 'tyrant.s8.fury', 1, stream(state)).selfGain).toBe(0);
    expect(resolveSailorCombatAbility(state, 'tyrant.s9.physique', 1, stream(state)).selfGain).toBe(0);
    expect(currentSailorCombatSource(state)).toBeNull();
    for (const [sequence, counts, wheel] of [
      [9, SAILOR_COUNT_WHEEL, sailorAbilityWheel(null)],
      [8, RAGER_COUNT_WHEEL, ragerAbilityWheel(null)],
      [null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, null)],
    ] as const) {
      state.progression.sequence = sequence;
      expect(isNavigator(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(counts); expect(playerAbilityWheel(state, null)).toEqual(wheel);
    }
  });
});

describe('current source, actual club and inherited physical wrath', () => {
  it('uses small conjured water in the original dry-ground scene without inventing open water', () => {
    const state = fixture();
    expect(currentNavigatorCombatSource(state)).toMatchObject({ encounterId: 'FIRST_CASE', water: 'NONE',
      space: 'DRY_GROUND_PASSAGE', needsBreath: true, canWrap: true, targetWill: 14 });
    expect(resolve(state, primary).selfGain).toBe(38.025 * 0.65);
    expect(state.combat!.navigatorWater!.soakedRemaining).toBe(2);
    expect(state.combat!.navigatorWater!.bound).toBe(false);
    expect(resolve(state, secondary).label).toContain('单目标');
  });

  it('replaces only primary with equipped physical club16, including physical status penalty', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    state.progression.mastery = { [primary]: 500, [control]: 500 };
    const effect = resolve(state, primary, undefined, undefined, 0.8);
    expect(effect.selfGain).toBe(16 * 0.8); expect(effect.label).toContain('本次为物理主攻');
    expect(state.combat!.wrathCharge).toBe(1); expect(state.combat!.navigatorWater).toBeUndefined();
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    expect(resolve(state, secondary).selfGain).toBe(20.475);
    expect(state.combat!.wrathCharge).toBe(1);
    for (const factor of [0, -1, Number.NaN]) {
      expect(resolve(state, primary, undefined, undefined, factor).selfGain).toBe(0);
      expect(state.combat!.wrathCharge).toBe(1);
    }
  });

  it('never farms/releases wrath with magical water even under RELEASE_FIRST', () => {
    const state = fixture(); state.combat!.wrathCharge = 3;
    const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
    for (const id of [primary, secondary, guard, control, prepare] as const) resolve(state, id, policy);
    expect(state.combat!.wrathCharge).toBe(3); expect(policy.released).toBe(false);
    for (const move of [primary, secondary, guard, control, prepare, 'STRIKE', 'tyrant.s8.fury', 'TYRANT_COMBO', 'NAVIGATOR_CLUB_STRIKE']) {
      expect(resolveRagerPhysicalExchange(state, 'PLAYER', move, 16)).toBeNull();
      expect(resolveRagerPhysicalAttack(state, move, 16, policy)).toEqual({ selfGain: 16, label: '' });
    }
    expect(state.combat!.wrathCharge).toBe(3); expect(policy.released).toBe(false);
  });

  it('releases existing2/3 layers once on the physical club then adds exactly one current layer', () => {
    for (const charge of [2, 3]) {
      const state = fixture(); state.town.clubLocation = 'HAND'; state.combat!.wrathCharge = charge;
      const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      const effect = resolve(state, primary, policy);
      expect(effect.selfGain).toBe(16 * (charge === 3 ? 1.4 : 1.25));
      expect(effect.label).toContain(`释放${charge}层怒击`); expect(effect.label).toContain('怒势0→1/3');
      expect(state.combat!.wrathCharge).toBe(1); expect(policy.released).toBe(true);
      resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16);
      resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16);
      expect(resolve(state, primary, policy).selfGain).toBe(16);
      expect(state.combat!.wrathCharge).toBe(3);
    }
  });

  it('requires the current original hostile source and rejects forged/stale source details without RNG', () => {
    const state = fixture(), source = currentNavigatorCombatSource(state)!;
    const invalid: (NavigatorCombatSource | null)[] = [null,
      { ...source, runId: 'another-run' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'water', 'throwable', 'exit', 'needsBreath', 'canWrap', 'suffocationImmune', 'targetWill'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as NavigatorCombatSource)];
    for (const input of invalid) {
      const candidate = fixture(), random = stream(candidate);
      candidate.combat!.wrathCharge = 3;
      for (const id of [primary, secondary, control]) {
        expect(resolveNavigatorCombatAbility(candidate, id, 1, random, undefined, input)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      candidate.town.clubLocation = 'HAND';
      const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      expect(resolveNavigatorCombatAbility(candidate, primary, 1, random, policy, input).selfGain).toBe(16);
      expect(policy.released).toBe(false); expect(candidate.combat!.wrathCharge).toBe(3);
      expect(candidate.combat!.navigatorWater).toBeUndefined(); expect(random.cursor).toBe(0);
    }
    for (const mutate of [
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const candidate = fixture(); mutate(candidate);
      expect(currentNavigatorCombatSource(candidate)).toBeNull(); expect(currentRagerCombatSource(candidate)).toBeNull();
      expect(resolve(candidate, control).enemyReduction).toBe(0);
    }
  });

  it('does nothing in absent, terminal, dead or wrong-profile combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 8; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentNavigatorCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveNavigatorCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('water-bind two-stage contest and exact actual-action consumption', () => {
  it('first control binds, second control uses a real bounded contest and clears bind on either result', () => {
    for (const [roll, skipNext] of [[1, true], [100, false]] as const) {
      const state = fixture(), random = stream(state);
      expect(resolveNavigatorCombatAbility(state, control, 1, random).enemyReduction).toBe(4.725 * 0.65);
      expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 2, bound: true, skipNext: false });
      expect(random.cursor).toBe(0);
      const draws = scriptRolls(roll);
      const effect = resolveNavigatorCombatAbility(state, control, 1, random);
      expect(effect.label).toContain('发动成功率52%'); expect(effect.label).toContain(`实抽${roll}/100`);
      expect(effect.enemyReduction).toBe(4.725 * 0.65); expect(effect.threatens).toBe(false);
      expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 2, bound: false, skipNext });
      expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1);
      vi.restoreAllMocks();
    }
  });

  it('cannot stage two once a real qualifying move consumed stage one', () => {
    const state = fixture(), random = stream(state);
    resolveNavigatorCombatAbility(state, control, 1, random);
    expect(consumeNavigatorWater(state, 'STRIKE', 16, 0)).toMatchObject({ suppressed: false, contributionMultiplier: 0.75 });
    expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 1, bound: false, skipNext: false });
    resolveNavigatorCombatAbility(state, control, 1, random);
    expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 2, bound: true, skipNext: false });
    expect(random.cursor).toBe(0);
  });

  it('uses only actual melee/movement contribution, not observation, block, miss or zero contribution', () => {
    const state = fixture(); resolve(state, control);
    for (const [move, gain, reduction] of [['OPENING', 8, 0], ['BLOCK', 0, 10], ['MISS', 0, 0], ['STRIKE', 0, 0]] as const) {
      expect(consumeNavigatorWater(state, move, gain, reduction)?.contributionMultiplier ?? 1).toBe(1);
      expect(state.combat!.navigatorWater!.bound).toBe(true);
    }
    expect(state.combat!.navigatorWater!.soakedRemaining).toBe(0);
    expect(consumeNavigatorWater(state, 'DISTANCE', 0, 8)).toMatchObject({ contributionMultiplier: 0.75 });
    expect(state.combat!.navigatorWater).toBeUndefined();
  });

  it('expires soaked after two completed abilities and refreshes to2 without stacking', () => {
    const state = fixture(); resolve(state, primary); resolve(state, primary);
    expect(state.combat!.navigatorWater!.soakedRemaining).toBe(2);
    consumeNavigatorWater(state, 'BLOCK', 0, 10);
    expect(state.combat!.navigatorWater!.soakedRemaining).toBe(1);
    resolve(state, primary); expect(state.combat!.navigatorWater!.soakedRemaining).toBe(2);
    consumeNavigatorWater(state, 'MISS', 0, 0);
    expect(state.combat!.navigatorWater!.soakedRemaining).toBe(1);
    consumeNavigatorWater(state, 'OPENING', 8, 0);
    expect(state.combat!.navigatorWater).toBeUndefined();
  });

  it('pending skip consumes exactly the next original ability including defense/miss, without rebind stacking', () => {
    for (const move of ['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS'] as const) {
      const state = fixture(), random = stream(state);
      resolveNavigatorCombatAbility(state, control, 1, random); scriptRolls(1);
      resolveNavigatorCombatAbility(state, control, 1, random);
      const pending = resolveNavigatorCombatAbility(state, control, 1, random);
      expect(pending.label).toContain('不叠加'); expect(random.cursor).toBe(1);
      expect(consumeNavigatorWater(state, move, 16, 10)).toMatchObject({ suppressed: true, contributionMultiplier: 1 });
      expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 1, bound: false, skipNext: false });
      expect(consumeNavigatorWater(state, move, 16, 10)?.suppressed).toBe(false);
      expect(state.combat!.navigatorWater).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('rejects no-breath, immune, unwrappable and invalid-stat helper targets without a fake draw', () => {
    const random = stream(fixture()), target = { needsBreath: true, canWrap: true, suffocationImmune: false, targetWill: 14 };
    for (const invalid of [{ ...target, needsBreath: false }, { ...target, canWrap: false },
      { ...target, suffocationImmune: true }, { ...target, targetWill: Number.NaN }]) {
      expect(resolveNavigatorSuffocationContest(random, 15, 0, invalid)).toBeNull();
    }
    expect(resolveNavigatorSuffocationContest(random, Number.NaN, 0, target)).toBeNull();
    expect(random.cursor).toBe(0);
    scriptRolls(10, 11, 90, 91);
    expect(resolveNavigatorSuffocationContest(random, -100, 0, target)).toEqual({ chance: 10, roll: 10, targetResisted: false });
    expect(resolveNavigatorSuffocationContest(random, -100, 0, target)).toEqual({ chance: 10, roll: 11, targetResisted: true });
    expect(resolveNavigatorSuffocationContest(random, 100, 500, target)).toEqual({ chance: 90, roll: 90, targetResisted: false });
    expect(resolveNavigatorSuffocationContest(random, 100, 500, target)).toEqual({ chance: 90, roll: 91, targetResisted: true });
    expect(random.cursor).toBe(4);
  });

  it('does not consume states through a stale source', () => {
    const state = fixture(); resolve(state, control); const source = currentNavigatorCombatSource(state)!;
    state.combat!.round += 1; const before = structuredClone(state);
    expect(consumeNavigatorWater(state, 'STRIKE', 16, 0, source)).toBeNull();
    expect(state).toEqual(before);
  });
});

describe('R0, accident risk, phantom scales and full round integration', () => {
  it('R0 never creates actions/resources/wrath and X is exactly ±11.25 with inherited risk', () => {
    for (const [charge, extra] of [[0, 0], [1, 3], [2, 6], [3, 10]]) {
      const state = fixture(); state.combat!.wrathCharge = charge!; state.spirituality = 0;
      const before = structuredClone(state), random = stream(state);
      expect(resolveNavigatorCombatAbility(state, prepare, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      scriptRolls(50, 51, 100 + extra!);
      for (const selfGain of [11.25, -11.25, -11.25]) {
        expect(resolveNavigatorCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain, enemyReduction: 0, threatens: false });
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(3);
      vi.restoreAllMocks();
    }
  });

  it('water guard adds one phantom scales use only against the next actual ordinary impact', () => {
    const state = fixture(); resolve(state, guard); resolve(state, guard);
    expect(state.combat!.sailorScalesReady).toBe(true);
    for (const move of ['BLOCK', 'OPENING', 'DISTANCE', 'MISS'] as const) expect(consumeSailorScales(state, move)).toBeNull();
    expect(consumeSailorScales(state, 'STRIKE')).toMatchObject({ physicalMultiplier: 0.75 });
    expect(state.combat!.sailorScalesReady).toBeUndefined();
    expect(state.combat!.wrathCharge).toBeUndefined();
  });

  it('resolves five actual player moves, one ordinary enemy move and one real second-control contest', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 1, 249, 161, 249, 1, 299, 1, 249, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL', 'RELEASE_FIRST');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 1]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [0, 4.725 * 0.65], [0, 4.725 * 0.65], [0, 0], [38.025 * 0.65, 0], [0, 4.725 * 0.65],
    ]);
    expect(round.moves.filter(move => move.label.includes('实抽'))).toHaveLength(1);
    expect(round.playerAdvantage).toBe(465 * 0.8 + 38.025 * 0.65 - 10);
    expect(round.enemyAdvantage).toBe(114 - 3 * 4.725 * 0.65);
    expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 2, bound: false, skipNext: true });
    expect(state.combat!.wrathCharge).toBeUndefined(); expect(state.spirituality).toBe(16);
    expect(state.combat!.enemyHealth).toBe(90); expect(outcome).toBe('CONTINUE');
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(state.week).toBe(before.week);
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(before.random.cursor + 11);
  });

  it('consumes bind on a real strike or movement, applying the one ×0.75 to the original contribution', () => {
    for (const [enemyRoll, expectedGain, expectedReduction] of [[1, 12, 0], [321, 0, 6]]) {
      const state = fixture(); resolve(state, control);
      scriptRolls(1, 1, 339, enemyRoll!, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[1]).toMatchObject({ selfGain: expectedGain, enemyReduction: expectedReduction });
      expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 1, bound: false, skipNext: false });
      expect(ragerWrathCharge(state)).toBe(enemyRoll === 1 ? 1 : 0);
      expect(round.consequenceWeights).toBeNull(); vi.restoreAllMocks();
    }
  });

  it('keeps skip/wet/scales/wrath through JSON and suppresses next actual strike without consuming scales or gaining wrath', () => {
    const state = fixture(); state.combat!.round = 2;
    state.combat!.navigatorWater = { soakedRemaining: 2, bound: false, skipNext: true };
    state.combat!.sailorScalesReady = true; state.combat!.wrathCharge = 2;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const draws = scriptRolls(1, 1, 1, 339, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(next.round.first).toBe('ENEMY'); expect(next.round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(next.round.moves[0]!.label).toContain('原行动次数保留'); expect(next.round.consequenceWeights).toBeNull();
    expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 1, bound: false, skipNext: false });
    expect(state.combat!.sailorScalesReady).toBe(true); expect(state.combat!.wrathCharge).toBe(2);
    expect(draws).toHaveBeenCalledTimes(5);
    vi.restoreAllMocks(); scriptRolls(1, 1, 1, 339, 1);
    expect(resolveSliceCombatRound(restored, 'ATTACK', 'RELEASE_FIRST')).toEqual(next); expect(restored).toEqual(state);
  });

  it('an effective strike after inherited scales builds wrath before the player chooses physical release', () => {
    const state = fixture(); state.combat!.round = 2; state.town.clubLocation = 'HAND';
    state.combat!.sailorScalesReady = true; state.combat!.wrathCharge = 2;
    scriptRolls(1, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST');
    expect(round.moves[0]!.selfGain).toBe(12); expect(round.moves[0]!.label).toContain('怒势2→3/3');
    expect(round.moves[1]!.selfGain).toBe(16 * 1.4);
    expect(state.combat!.wrathCharge).toBe(1); expect(state.combat!.sailorScalesReady).toBeUndefined();
    expect(state.combat!.navigatorWater).toBeUndefined();
  });

  it('clears all battle-only water, scales and wrath on every terminal path', () => {
    for (const [stance, rolls, outcome] of [
      ['RETREAT', [1, 1, 1], 'RETREATED'],
      ['ATTACK', [1, 1, 1, 400, 1, 66], 'ENEMY_SURRENDERED'],
      ['ATTACK', [1, 1, 1, 400, 1, 96], 'ENEMY_DEAD'],
      ['ATTACK', [1, 1, 339, 1, 1_000_000, 96], 'PLAYER_DEAD'],
    ] as const) {
      const state = fixture(); state.combat!.wrathCharge = 3; state.combat!.sailorScalesReady = true;
      state.combat!.navigatorWater = { soakedRemaining: 2, bound: true, skipNext: false }; state.spirituality = 10;
      scriptRolls(...rolls);
      expect(resolveSliceCombatRound(state, stance, 'RELEASE_FIRST').outcome).toBe(outcome);
      expect(state.combat!.navigatorWater).toBeUndefined(); expect(state.combat!.wrathCharge).toBeUndefined();
      expect(state.combat!.sailorScalesReady).toBeUndefined(); expect(state.spirituality).toBe(10);
      vi.restoreAllMocks();
    }
  });

  it('replays without global random and rejects malformed or unsupported rage policy without mutation', () => {
    const state = fixture(); state.combat!.wrathCharge = 3; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL', 'RELEASE_FIRST')).toEqual(resolveSliceCombatRound(restored, 'CONTROL', 'RELEASE_FIRST'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    for (const [sequence, policy] of [[7, 'UNKNOWN'], [9, 'RELEASE_FIRST']] as const) {
      const candidate = fixture(); candidate.progression.sequence = sequence; const before = structuredClone(candidate);
      expect(() => resolveSliceCombatRound(candidate, 'ATTACK', policy as 'HOLD')).toThrow();
      expect(candidate).toEqual(before);
    }
  });
});
