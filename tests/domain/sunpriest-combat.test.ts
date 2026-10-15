import { afterEach, describe, expect, it, vi } from 'vitest';
import { PURE_WHITE_ANGEL_COUNT_WHEEL, pureWhiteAngelAbilityWheel } from '../../src/domain/pure-white-angel/combat.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel, createBardRoundContext, isBard,
  resolveBardCombatAbility } from '../../src/domain/bard/combat.js';
import { SUNPRIEST_COUNT_WHEEL, currentSunpriestCombatSource,
  drawSunpriestAbility, isSunpriest, sunpriestAbilityWheel, sunpriestActionCount,
  resolveSunpriestCombatAbility, type SunpriestCombatSource, type SunpriestMoveId,
} from '../../src/domain/sunpriest/combat.js';
import { LIGHTPRAYER_COUNT_WHEEL, applyAuthoredSunVulnerability, isLightprayer,
  lightprayerAbilityWheel, resolveLightprayerCombatAbility } from '../../src/domain/lightprayer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'sun.s7.holy-light', secondary = 'SUNPRIEST_LIGHTFIRE', ritual = 'sun.s7.holy-water';
const blessing = 'sun.s7.sacred-oath', control = 'sun.s7.sun-aura';
const ids = [primary, secondary, blessing, control, ritual, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('sunpriest-combat-test', sliceDefaultCreationSelection, 'sunpriest-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'sun', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SunpriestMoveId, factor = 1) {
  return resolveSunpriestCombatAbility(state, id, factor, stream(state));
}
/** Script outcomes while preserving the real action stream's cursor use. */
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

describe('Sunpriest S7 confirmed Sun D-profile', () => {
  it('selects exact 32/18/12/10/8/20 slots and independent 22/28/25/17/8 counts', () => {
    const state = fixture();
    expect(isSunpriest(state)).toBe(true); expect(isBard(state)).toBe(false);
    expect(sunpriestAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(sunpriestAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(sunpriestAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(SUNPRIEST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([22, 28, 25, 17, 8]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('preserves every count and neutral ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(sunpriestActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of sunpriestAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawSunpriestAbility(random, null)).toBe(entry.id);
      expect(drawSunpriestAbility(random, null)).toBe(entry.id);
      expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only the selected stance slots using exact ×1.25 tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [160, 90, 48, 40, 32, 80]],
      ['DEFEND', [128, 72, 60, 40, 32, 80]],
      ['CONTROL', [128, 72, 48, 50, 32, 80]],
      ['PREPARE', [128, 72, 48, 40, 40, 80]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(sunpriestAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => value / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawSunpriestAbility(random, stance)).toBe(ids[index]);
        expect(drawSunpriestAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    expect(sunpriestAbilityWheel('RETREAT')).toEqual(sunpriestAbilityWheel(null));
  });

  it('uses base450, core20/25/30/25, cap90 and spirituality60 with shared penalties', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(476); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(9);
  });

  it('uses the S7 defensive floor45 even for a malformed negative-core input', () => {
    const state = fixture();
    state.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps Bard S9 scoped to nine and never resolves inherited chorus from an S7 non-chorus slot', () => {
    const state = fixture(), context = createBardRoundContext(state), random = stream(state);
    expect(context.source).toBeNull();
    expect(resolveBardCombatAbility(state, 'CHORUS_SUPPORT', 1, random, context)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(context.pendingSupportBudgets).toEqual([]);
    state.progression.sequence = 9;
    expect(isSunpriest(state)).toBe(false); expect(isBard(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(bardAbilityWheel('ATTACK'));
    state.progression.pathwayId = 'sun'; state.progression.sequence = 1;
    expect(isSunpriest(state)).toBe(false); expect(isBard(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(PURE_WHITE_ANGEL_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(pureWhiteAngelAbilityWheel(state, 'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['sun', 0], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSunpriest(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });

  it('preserves exact S8 selection while preventing a second inherited S8 spell contribution at S7', () => {
    const state = fixture(), random = stream(state);
    expect(isLightprayer(state)).toBe(false);
    expect(resolveLightprayerCombatAbility(state, 'sun.s8.light', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    state.progression.sequence = 8;
    expect(isSunpriest(state)).toBe(false); expect(isLightprayer(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(LIGHTPRAYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(lightprayerAbilityWheel('DEFEND'));
    expect(resolve(state, primary)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
  });
});

describe('bounded holy light, lightfire, oath and aura from the current ordinary source', () => {
  it('uses unrounded 35.1f/18.9f/14.625f/7.875f with the relevant spell, oath and aura mastery', () => {
    for (const mastery of [0, 125, 250, 500]) {
      const state = fixture(); state.progression.mastery = { [primary]: mastery, [blessing]: mastery, [control]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, primary).selfGain).toBe(35.1 * factor);
      expect(resolve(state, secondary).selfGain).toBe(18.9 * factor);
      expect(resolve(state, blessing).enemyReduction).toBe(14.625 * factor);
      expect(resolve(state, control).enemyReduction).toBe(7.875 * factor);
    }
    const state = fixture();
    state.progression.mastery = { [primary]: 500, [secondary]: 0, [blessing]: 250, [control]: 0,
      'sun.s9.praise': 500, 'sun.s9.courage': 500 };
    expect(resolve(state, primary).selfGain).toBe(35.1);
    expect(resolve(state, secondary).selfGain).toBe(18.9);
    expect(resolve(state, blessing).enemyReduction).toBe(14.625 * (0.65 + 0.35 * 250 / 500));
    expect(resolve(state, control).enemyReduction).toBe(7.875 * 0.65);
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery = { [primary]: mastery, [blessing]: mastery, [control]: mastery };
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, primary).selfGain).toBe(35.1 * factor);
      expect(resolve(state, secondary).selfGain).toBe(18.9 * factor);
      expect(resolve(state, blessing).enemyReduction).toBe(14.625 * factor);
      expect(resolve(state, control).enemyReduction).toBe(7.875 * factor);
    }
  });

  it('only uses this ordinary visible carrier, with no moral or supernatural weakness', () => {
    const state = fixture(), before = structuredClone(state);
    expect(currentSunpriestCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', sunVulnerable: false, scope: 'CURRENT_VISIBLE_SINGLE_TARGET' });
    for (const id of [primary, secondary, blessing, control, ritual] as const) resolve(state, id);
    expect(state).toEqual(before);
    expect(resolve(state, primary).selfGain).toBe(35.1 * 0.65);
    expect(resolve(state, primary).label).toContain('普通携铃者没有太阳易伤');
    expect(resolve(state, secondary).label).toContain('没有太阳易伤');
  });

  it('rejects stale, forged, remote and secretly reclassified target snapshots without a random draw', () => {
    const state = fixture(), source = currentSunpriestCombatSource(state)!;
    const tampered: SunpriestCombatSource[] = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' } as unknown as SunpriestCombatSource,
      { ...source, target: 'OLD_CASE' } as unknown as SunpriestCombatSource,
      { ...source, nature: 'UNDEAD' } as unknown as SunpriestCombatSource,
      { ...source, sunVulnerable: true } as unknown as SunpriestCombatSource,
      { ...source, scope: 'UNKNOWN_SECRET_OR_DISTANT_TARGET' } as unknown as SunpriestCombatSource,
    ];
    for (const badSource of [null, ...tampered]) {
      for (const id of ids) {
        const random = stream(state), before = structuredClone(state);
        expect(resolveSunpriestCombatAbility(state, id, 1, random, badSource)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(random.cursor).toBe(0); expect(state).toEqual(before);
      }
    }
  });

  it('cannot use the previous source after a location, lifecycle, sequence or target change', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 9; }, state => { state.progression.sequence = 8; },
      state => { state.progression.sequence = 6; },
      state => { state.progression.pathwayId = 'tyrant'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentSunpriestCombatSource(state); mutate(state);
      expect(currentSunpriestCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveSunpriestCombatAbility(state, id, 1, stream(state), source))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
  });

  it('requires the exact authored SUN_VULNERABLE tag for a direct Sun attack and multiplies once', () => {
    expect(applyAuthoredSunVulnerability(35.1, true, [])).toBe(35.1);
    expect(applyAuthoredSunVulnerability(35.1, true, ['CRIMINAL', 'HOSTILE', 'DARKNESS', 'UNDEAD'])).toBe(35.1);
    expect(applyAuthoredSunVulnerability(35.1, true, ['SUN_VULNERABLE'])).toBe(35.1 * 1.25);
    expect(applyAuthoredSunVulnerability(35.1, true, ['SUN_VULNERABLE', 'SUN_VULNERABLE', 'UNDEAD'])).toBe(35.1 * 1.25);
    expect(applyAuthoredSunVulnerability(14.625, false, ['SUN_VULNERABLE'])).toBe(14.625);
    expect(applyAuthoredSunVulnerability(-11.25, true, ['SUN_VULNERABLE'])).toBe(-11.25);
    expect(applyAuthoredSunVulnerability(0, true, ['SUN_VULNERABLE'])).toBe(0);
  });

  it('replaces the main light budget only for a club actually in HAND and never stacks physical plus light', () => {
    const state = fixture(); state.progression.mastery = { [primary]: 500, [secondary]: 500 };
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const armed = location === 'HAND', main = resolve(state, primary, 0.8);
      expect(main.selfGain).toBe(armed ? 16 * 0.8 : 35.1);
      expect(resolve(state, secondary, 0.8).selfGain).toBe(18.9);
      if (armed) {
        expect(main.label).toContain('替代圣光预算'); expect(main.label).toContain('不叠加');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      } else expect(playerAbilityWheel(state, null)[0]!.label).toBe('有限圣光');
    }
    state.town.clubLocation = 'HAND';
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(resolve(state, primary, factor))
      .toMatchObject({ selfGain: 0, threatens: false });
    expect(resolve(state, primary, 3).selfGain).toBe(16);
    state.town.clubLocation = 'BAG';
    expect(resolve(state, primary, 0).selfGain).toBe(35.1);
  });

  it('steadies only the actual player and applies immediate pressure without healing, broad immunity or obedience', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 35;
    state.progression.mastery = { [primary]: 500, [blessing]: 500, [control]: 500 };
    const before = structuredClone(state);
    expect(resolve(state, blessing)).toMatchObject({ selfGain: 0, enemyReduction: 14.625, threatens: false });
    expect(resolve(state, blessing).label).toContain('不建立全能免疫');
    expect(resolve(state, blessing).label).toContain('实际在场的自身');
    expect(resolve(state, control)).toMatchObject({ selfGain: 0, enemyReduction: 7.875, threatens: false });
    expect(resolve(state, control).label).toContain('不扫描秘密');
    expect(resolve(state, control).label).toContain('不凭空支援队友');
    expect(state).toEqual(before);
  });

  it('prepares for zero and draws exact ±11.25 accidents without extra state, spirituality or damage permission', () => {
    const state = fixture(), before = structuredClone(state);
    expect(resolve(state, ritual)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, ritual).label).toContain('不制作、使用或消耗生活圣水');
    for (const roll of [1, 2]) {
      const draw = scriptRolls(roll), random = stream(state);
      expect(resolveSunpriestCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
        selfGain: roll === 1 ? -11.25 : 11.25, enemyReduction: 0, threatens: false,
      });
      expect(draw).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
    expect(state).toEqual(before);
  });

  it('leaves the real finite holy-water stock and all life evidence untouched by every combat slot', () => {
    const state = fixture();
    state.sunpriest.holyWater = { prepared: 1, held: 1, used: 0 };
    const before = structuredClone(state);
    const draw = scriptRolls(2);
    for (const id of ids) resolve(state, id);
    expect(state).toEqual(before);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(state.sunpriest.holyWater).toEqual({ prepared: 1, held: 1, used: 0 });
  });
});

describe('shared Sun S7 round uses only original drawn slots', () => {
  it('resolves flame then light as separate immediate original budgets, with no automatic chorus', () => {
    const state = fixture(); state.progression.mastery = { [primary]: 500, [secondary]: 500, 'sun.s9.praise': 500 };
    const draw = scriptRolls(23, 1, 161, 400, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(2); expect(round.enemyCount).toBe(1);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]).toMatchObject({ selfGain: 18.9, enemyReduction: 0 });
    expect(round.moves[2]).toMatchObject({ selfGain: 35.1, enemyReduction: 0 });
    expect(round.playerAdvantage).toBe(519); expect(round.enemyAdvantage).toBe(114);
    expect(round.consequence).not.toContain('歌颂支援');
    expect(draw).toHaveBeenCalledTimes(7); expect(state.random.cursor).toBe(7);
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });

  it('keeps oath and aura finite without injury, automatic surrender, immunity or lost enemy actions', () => {
    const state = fixture(); state.combat!.enemyMind = 20;
    state.progression.mastery = { [primary]: 500, [blessing]: 500, [control]: 500 };
    const draw = scriptRolls(23, 1, 201, 1, 249, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction)).toEqual([14.625, 7.875]);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toEqual([
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
    ]);
    expect(state.combat).toMatchObject({ enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 20, enemyInjuries: [] });
    expect(round.enemyAdvantage).toBeCloseTo(84.7); expect(draw).toHaveBeenCalledTimes(6);
    expect(state.combat).not.toHaveProperty('sunBlessing');
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });

  it('does not turn preparation into an extra attack, resource recovery or a persistent buff', () => {
    const state = fixture(); state.spirituality = 20;
    state.sunpriest.holyWater = { prepared: 1, held: 1, used: 0 };
    const lifeBefore = structuredClone(state.sunpriest);
    const draw = scriptRolls(93, 1, 289, 400, 289, 289, 289, 289, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(outcome).toBe('CONTINUE'); expect(round.playerCount).toBe(5);
    expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(5);
    expect(round.moves.every(move => move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(state.spirituality).toBe(26);
    expect(draw).toHaveBeenCalledTimes(9);
    expect(state.sunpriest).toEqual(lifeBefore);
  });

  it('keeps a held club as one replacement while the original secondary remains a spell', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    state.progression.mastery = { [primary]: 500, [blessing]: 500, [control]: 500 };
    const draw = scriptRolls(23, 1, 1, 400, 161, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain)).toEqual([16, 18.9]);
    expect(round.moves[0]!.label).toContain('替代圣光预算');
    expect(round.moves[2]!.label).toContain('有限光焰');
    expect(round.playerAdvantage).toBeCloseTo(499.9);
    expect(draw).toHaveBeenCalledTimes(7);
  });

  it('keeps independent ordinary enemy counts and original alternation when the enemy starts', () => {
    const state = fixture(); state.combat!.round = 2;
    const draw = scriptRolls(93, 100, 400, 289, 400, 289, 400, 289, 289, 289, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(outcome).toBe('CONTINUE');
    expect(round.playerCount).toBe(5); expect(round.enemyCount).toBe(3);
    expect(round.first).toBe('ENEMY');
    expect(round.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.consequenceWeights).toBeNull(); expect(draw).toHaveBeenCalledTimes(11);
  });

  it('uses the shared injury and surrender consequences after an actual holy-light threat', () => {
    const state = fixture();
    const draw = scriptRolls(1, 1, 1, 400, 1, 80);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.winner).toBe('PLAYER');
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.combat).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100 });
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(draw).toHaveBeenCalledTimes(6);
  });

  it('does not turn a defensive oath into invulnerability or revival when the shared death draw lands', () => {
    const state = fixture(); state.spirituality = 40;
    const draw = scriptRolls(1, 1, 201, 1, 1_000_000, 100);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('PLAYER_DEAD'); expect(round.winner).toBe('ENEMY');
    expect(state.health).toBe(0); expect(state.spirituality).toBe(40);
    expect(round.consequence).toContain('最终死亡');
    expect(draw).toHaveBeenCalledTimes(6);
  });

  it('uses the original retreat route with no free light, chorus, immunity or second actor', () => {
    const state = fixture(), draw = scriptRolls(93, 100, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.retreat).toBe('SUCCESS');
    expect(round.moves).toEqual([]); expect(draw).toHaveBeenCalledTimes(3);
  });

  it('replays identical seeds and leaves no persistent combat aura or queued support after a resolved round', () => {
    const first = fixture(), second = structuredClone(first);
    expect(resolveSliceCombatRound(first, 'DEFEND')).toEqual(resolveSliceCombatRound(second, 'DEFEND'));
    expect(first).toEqual(second);
    expect(first.combat).not.toHaveProperty('sunBlessing');
    expect(first.combat).not.toHaveProperty('pendingSupportBudgets');
  });
});
