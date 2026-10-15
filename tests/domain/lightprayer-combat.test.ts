import {SUNPRIEST_COUNT_WHEEL,sunpriestAbilityWheel} from '../../src/domain/sunpriest/combat.js';
import { PURE_WHITE_ANGEL_COUNT_WHEEL, pureWhiteAngelAbilityWheel } from '../../src/domain/pure-white-angel/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel, createBardRoundContext, isBard,
  resolveBardCombatAbility } from '../../src/domain/bard/combat.js';
import { LIGHTPRAYER_COUNT_WHEEL, applyAuthoredSunVulnerability, currentLightprayerCombatSource,
  drawLightprayerAbility, isLightprayer, lightprayerAbilityWheel, lightprayerActionCount,
  resolveLightprayerCombatAbility, type LightprayerCombatSource, type LightprayerMoveId,
} from '../../src/domain/lightprayer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'sun.s8.light', secondary = 'sun.s8.solar-flame', ritual = 'sun.s8.ritual';
const blessing = 'LIGHTPRAYER_BLESSING', control = 'LIGHTPRAYER_GLARE';
const ids = [primary, secondary, blessing, control, ritual, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('lightprayer-combat-test', sliceDefaultCreationSelection, 'lightprayer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'sun', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: LightprayerMoveId, factor = 1) {
  return resolveLightprayerCombatAbility(state, id, factor, stream(state));
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

describe('Lightprayer S8 confirmed Sun D-profile', () => {
  it('selects exact 32/18/12/10/8/20 slots and independent 30/30/25/15 counts', () => {
    const state = fixture();
    expect(isLightprayer(state)).toBe(true); expect(isBard(state)).toBe(false);
    expect(lightprayerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(lightprayerAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(lightprayerAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(LIGHTPRAYER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([30, 30, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(30);
  });

  it('preserves every count and neutral ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [30, 1], [31, 2], [60, 2], [61, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(lightprayerActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of lightprayerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawLightprayerAbility(random, null)).toBe(entry.id);
      expect(drawLightprayerAbility(random, null)).toBe(entry.id);
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
      expect(lightprayerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => value / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawLightprayerAbility(random, stance)).toBe(ids[index]);
        expect(drawLightprayerAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    expect(lightprayerAbilityWheel('RETREAT')).toEqual(lightprayerAbilityWheel(null));
  });

  it('uses base300, core20/30/25/25, cap60 and spirituality45 with shared penalties', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(325.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('uses the S8 defensive floor30 even for a malformed negative-core input', () => {
    const state = fixture();
    state.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('keeps Bard S9 scoped to nine and never resolves inherited chorus from an S8 non-chorus slot', () => {
    const state = fixture(), context = createBardRoundContext(state), random = stream(state);
    expect(context.source).toBeNull();
    expect(resolveBardCombatAbility(state, 'CHORUS_SUPPORT', 1, random, context)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(context.pendingSupportBudgets).toEqual([]);
    state.progression.sequence = 9;
    expect(isLightprayer(state)).toBe(false); expect(isBard(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(bardAbilityWheel('ATTACK'));
    for (const sequence of [7,6] as const) {
      state.progression.pathwayId='sun';state.progression.sequence=sequence;
      expect(isLightprayer(state)).toBe(false);expect(playerCountWheel(state)).toEqual(SUNPRIEST_COUNT_WHEEL);
      expect(playerAbilityWheel(state,'CONTROL')).toEqual(sunpriestAbilityWheel('CONTROL',sequence));
    }
    state.progression.pathwayId = 'sun'; state.progression.sequence = 1;
    expect(isLightprayer(state)).toBe(false); expect(isBard(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(PURE_WHITE_ANGEL_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(pureWhiteAngelAbilityWheel(state, 'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['sun', 0], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isLightprayer(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });
});

describe('bounded light, gold flame, blessing and current authored source', () => {
  it('uses unrounded 19.5f/10.5f/7.8f/4.2f with independent relevant mastery', () => {
    for (const mastery of [0, 125, 250, 500]) {
      const state = fixture(); state.progression.mastery = { [primary]: mastery, [secondary]: mastery, [ritual]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, primary).selfGain).toBe(19.5 * factor);
      expect(resolve(state, secondary).selfGain).toBe(10.5 * factor);
      expect(resolve(state, blessing).enemyReduction).toBe(7.8 * factor);
      expect(resolve(state, control).enemyReduction).toBe(4.2 * factor);
    }
    const state = fixture();
    state.progression.mastery = { [primary]: 500, [secondary]: 0, [ritual]: 250,
      'sun.s9.praise': 500, 'sun.s9.courage': 500 };
    expect(resolve(state, primary).selfGain).toBe(19.5);
    expect(resolve(state, secondary).selfGain).toBe(10.5 * 0.65);
    expect(resolve(state, blessing).enemyReduction).toBe(7.8 * (0.65 + 0.35 * 250 / 500));
    expect(resolve(state, control).enemyReduction).toBe(4.2);
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery = { [primary]: mastery, [secondary]: mastery, [ritual]: mastery };
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, primary).selfGain).toBe(19.5 * factor);
      expect(resolve(state, secondary).selfGain).toBe(10.5 * factor);
      expect(resolve(state, blessing).enemyReduction).toBe(7.8 * factor);
    }
  });

  it('only uses this ordinary visible carrier, with no moral or supernatural weakness', () => {
    const state = fixture(), before = structuredClone(state);
    expect(currentLightprayerCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', sunVulnerable: false, scope: 'CURRENT_VISIBLE_SINGLE_TARGET' });
    for (const id of [primary, secondary, blessing, control, ritual] as const) resolve(state, id);
    expect(state).toEqual(before);
    expect(resolve(state, primary).selfGain).toBe(19.5 * 0.65);
    expect(resolve(state, primary).label).toContain('普通携铃者没有太阳易伤');
    expect(resolve(state, secondary).label).toContain('没有太阳易伤');
  });

  it('rejects stale, forged, remote and secretly reclassified target snapshots without a random draw', () => {
    const state = fixture(), source = currentLightprayerCombatSource(state)!;
    const tampered: LightprayerCombatSource[] = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' } as unknown as LightprayerCombatSource,
      { ...source, target: 'OLD_CASE' } as unknown as LightprayerCombatSource,
      { ...source, nature: 'UNDEAD' } as unknown as LightprayerCombatSource,
      { ...source, sunVulnerable: true } as unknown as LightprayerCombatSource,
      { ...source, scope: 'UNKNOWN_SECRET_OR_DISTANT_TARGET' } as unknown as LightprayerCombatSource,
    ];
    for (const badSource of [null, ...tampered]) {
      for (const id of ids) {
        const random = stream(state), before = structuredClone(state);
        expect(resolveLightprayerCombatAbility(state, id, 1, random, badSource)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
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
      state => { state.progression.sequence = 9; }, state => { state.progression.sequence = 7; },
      state => { state.progression.pathwayId = 'tyrant'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentLightprayerCombatSource(state); mutate(state);
      expect(currentLightprayerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveLightprayerCombatAbility(state, id, 1, stream(state), source))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
  });

  it('requires the exact authored SUN_VULNERABLE tag for a direct Sun attack and multiplies once', () => {
    expect(applyAuthoredSunVulnerability(19.5, true, [])).toBe(19.5);
    expect(applyAuthoredSunVulnerability(19.5, true, ['CRIMINAL', 'HOSTILE', 'DARKNESS', 'UNDEAD'])).toBe(19.5);
    expect(applyAuthoredSunVulnerability(19.5, true, ['SUN_VULNERABLE'])).toBe(19.5 * 1.25);
    expect(applyAuthoredSunVulnerability(19.5, true, ['SUN_VULNERABLE', 'SUN_VULNERABLE', 'UNDEAD'])).toBe(19.5 * 1.25);
    expect(applyAuthoredSunVulnerability(7.8, false, ['SUN_VULNERABLE'])).toBe(7.8);
    expect(applyAuthoredSunVulnerability(-7.5, true, ['SUN_VULNERABLE'])).toBe(-7.5);
    expect(applyAuthoredSunVulnerability(0, true, ['SUN_VULNERABLE'])).toBe(0);
  });

  it('replaces the main light budget only for a club actually in HAND and never stacks physical plus light', () => {
    const state = fixture(); state.progression.mastery = { [primary]: 500, [secondary]: 500 };
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const armed = location === 'HAND', main = resolve(state, primary, 0.8);
      expect(main.selfGain).toBe(armed ? 16 * 0.8 : 19.5);
      expect(resolve(state, secondary, 0.8).selfGain).toBe(10.5);
      if (armed) {
        expect(main.label).toContain('替代日光术预算'); expect(main.label).toContain('不叠加');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      } else expect(playerAbilityWheel(state, null)[0]!.label).toBe('日光术');
    }
    state.town.clubLocation = 'HAND';
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(resolve(state, primary, factor))
      .toMatchObject({ selfGain: 0, threatens: false });
    expect(resolve(state, primary, 3).selfGain).toBe(16);
    state.town.clubLocation = 'BAG';
    expect(resolve(state, primary, 0).selfGain).toBe(19.5);
  });

  it('blesses and interferes only as ordinary contribution without healing, immunity, obedience or secret scanning', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 35;
    state.progression.mastery = { [primary]: 500, [ritual]: 500 };
    const before = structuredClone(state);
    expect(resolve(state, blessing)).toMatchObject({ selfGain: 0, enemyReduction: 7.8, threatens: false });
    expect(resolve(state, blessing).label).toContain('不建立免疫');
    expect(resolve(state, control)).toMatchObject({ selfGain: 0, enemyReduction: 4.2, threatens: false });
    expect(resolve(state, control).label).toContain('不扫描秘密');
    expect(state).toEqual(before);
  });

  it('prepares for zero and draws exact ±7.5 accidents without extra state, spirituality or damage permission', () => {
    const state = fixture(), before = structuredClone(state);
    expect(resolve(state, ritual)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    for (const roll of [1, 2]) {
      const draw = scriptRolls(roll), random = stream(state);
      expect(resolveLightprayerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
        selfGain: roll === 1 ? -7.5 : 7.5, enemyReduction: 0, threatens: false,
      });
      expect(draw).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
    expect(state).toEqual(before);
  });
});

describe('shared Sun S8 round uses only original drawn slots', () => {
  it('resolves flame then light as separate immediate original budgets, with no automatic chorus', () => {
    const state = fixture(); state.progression.mastery = { [primary]: 500, [secondary]: 500, 'sun.s9.praise': 500 };
    const draw = scriptRolls(31, 1, 161, 400, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(2); expect(round.enemyCount).toBe(1);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]).toMatchObject({ selfGain: 10.5, enemyReduction: 0 });
    expect(round.moves[2]).toMatchObject({ selfGain: 19.5, enemyReduction: 0 });
    expect(round.playerAdvantage).toBe(345); expect(round.enemyAdvantage).toBe(114);
    expect(round.consequence).not.toContain('歌颂支援');
    expect(draw).toHaveBeenCalledTimes(7); expect(state.random.cursor).toBe(7);
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });

  it('keeps blessing and glare finite without injury, automatic surrender, immunity or lost enemy actions', () => {
    const state = fixture(); state.combat!.enemyMind = 20;
    state.progression.mastery = { [primary]: 500, [ritual]: 500 };
    const draw = scriptRolls(31, 1, 201, 1, 249, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction)).toEqual([7.8, 4.2]);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toEqual([
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
    ]);
    expect(state.combat).toMatchObject({ enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 20, enemyInjuries: [] });
    expect(round.enemyAdvantage).toBeCloseTo(95.2); expect(draw).toHaveBeenCalledTimes(6);
    expect(state.combat).not.toHaveProperty('sunBlessing');
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });

  it('does not turn preparation into an extra attack, resource recovery or a persistent buff', () => {
    const state = fixture(); state.spirituality = 20;
    const draw = scriptRolls(86, 1, 289, 400, 289, 289, 289, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(outcome).toBe('CONTINUE'); expect(round.playerCount).toBe(4);
    expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(4);
    expect(round.moves.every(move => move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(state.spirituality).toBe(24.5);
    expect(draw).toHaveBeenCalledTimes(8);
  });

  it('uses the original retreat route with no free light, chorus, immunity or second actor', () => {
    const state = fixture(), draw = scriptRolls(86, 100, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.retreat).toBe('SUCCESS');
    expect(round.moves).toEqual([]); expect(draw).toHaveBeenCalledTimes(3);
  });

  it('replays identical seeds and leaves no Lightprayer state after a resolved round', () => {
    const first = fixture(), second = structuredClone(first);
    expect(resolveSliceCombatRound(first, 'DEFEND')).toEqual(resolveSliceCombatRound(second, 'DEFEND'));
    expect(first).toEqual(second);
    expect(first.combat).not.toHaveProperty('sunBlessing');
    expect(first.combat).not.toHaveProperty('pendingSupportBudgets');
  });
});
