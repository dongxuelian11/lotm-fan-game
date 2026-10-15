import { WANDERER_COUNT_WHEEL, wandererAbilityWheel } from '../../src/domain/wanderer/combat.js';
import { PLANESWALKER_COUNT_WHEEL, planeswalkerAbilityWheel } from '../../src/domain/planeswalker/combat.js';
import { TRAVELER_COUNT_WHEEL, travelerAbilityWheel } from '../../src/domain/traveler/combat.js';
import { SECRETS_SORCERER_COUNT_WHEEL, secretsSorcererAbilityWheel } from '../../src/domain/secrets-sorcerer/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { APPRENTICE_COUNT_WHEEL, apprenticeAbilityWheel } from '../../src/domain/apprentice/combat.js';
import { TRICKMASTER_COUNT_WHEEL, trickmasterAbilityWheel } from '../../src/domain/trickmaster/combat.js';
import { ASTROLOGER_COUNT_WHEEL, currentAstrologerCombatSource, drawAstrologerAbility,
  isAstrologer, resolveAstrologerCombatAbility, astrologerAbilityWheel, astrologerActionCount,
  type AstrologerCombatSource, type AstrologerMoveId,
} from '../../src/domain/astrologer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const opening = 'door.s9.door-opening', tricks = 'door.s8.tricks';
const astrology = 'door.s7.astrology', interference = 'door.s7.divination-interference';
const ids = ['TRICK_ATTACK', 'BODY_FOLLOWUP', 'TRICK_COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('astrologer-combat-test', sliceDefaultCreationSelection, 'astrologer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'door', sequence: 7,
    mastery: { [opening]: 500, [tricks]: 0, [astrology]: 0, [interference]: 0 }, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: AstrologerMoveId, physical = 1) {
  return resolveAstrologerCombatAbility(state, id, physical, stream(state));
}
/** Move the real replay cursor, then substitute only the specified legal draw. */
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

describe('Astrologer S7 exact Door V1 profile', () => {
  it('uses I18/12/32/25/8/5 and exact six-count distribution, with detached public wheels', () => {
    const state = fixture();
    expect(isAstrologer(state)).toBe(true);
    expect(astrologerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(astrologerAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(playerAbilityWheel(state, null)).toEqual(astrologerAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(ASTROLOGER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 20, 23, 20, 12]);
    expect(ASTROLOGER_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.64);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('preserves both ends of every S7 action-count interval', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [45, 3],
      [46, 4], [68, 4], [69, 5], [88, 5], [89, 6], [100, 6]]) {
      expect(astrologerActionCount(roll!)).toBe(count);
    }
  });

  it('uses exact stance tickets and a single draw per slot without astrology prediction', () => {
    for (const [stance, weights] of [
      [null, [72, 48, 128, 100, 32, 20]],
      ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]],
      ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(astrologerAbilityWheel(stance).map(entry => entry.weight)).toEqual(
        weights.map(value => total === 400 ? value / 4 : value / total * 100),
      );
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawAstrologerAbility(random, stance)).toBe(ids[index]);
        expect(drawAstrologerAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(astrologerAbilityWheel('RETREAT')).toEqual(astrologerAbilityWheel(null));
    expect(ids).not.toContain(astrology); expect(ids).not.toContain(interference);
  });

  it('uses base450, core15/40/20/25, cap90, spirituality60 and shared penalties', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 379, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(475.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 379, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(9);
  });

  it('preserves S9/S8, and never routes unsupported Door sequences into S7', () => {
    const state = fixture();
    state.progression.sequence = 9;
    expect(isAstrologer(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(APPRENTICE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(apprenticeAbilityWheel('CONTROL'));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(TRICKMASTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(trickmasterAbilityWheel('CONTROL'));
    // Former future sequences now use their own current profiles, never this old profile.
    state.progression.pathwayId='door';state.progression.sequence=4;expect(isAstrologer(state)).toBe(false);expect(playerCountWheel(state)).toEqual(SECRETS_SORCERER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(secretsSorcererAbilityWheel(state,'CONTROL'));
    state.progression.pathwayId='door';state.progression.sequence=3;expect(isAstrologer(state)).toBe(false);expect(playerCountWheel(state)).toEqual(WANDERER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(wandererAbilityWheel(state,'CONTROL'));
    state.progression.sequence=2;expect(isAstrologer(state)).toBe(false);expect(playerCountWheel(state)).toEqual(PLANESWALKER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(planeswalkerAbilityWheel(state,'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['door', 1], ['door', 0], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isAstrologer(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });
});

describe('retained low tricks and ordinary fallbacks', () => {
  it('uses unrounded H26.325f and B23.4f from the actual retained tricks at all mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[tricks] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveAstrologerCombatAbility(state, 'TRICK_ATTACK', 1, random)).toMatchObject({
        selfGain: 26.325 * factor, enemyReduction: 0, threatens: true,
      });
      expect(resolveAstrologerCombatAbility(state, 'TRICK_COVER', 1, random)).toMatchObject({
        selfGain: 0, enemyReduction: 23.4 * factor, threatens: false,
      });
      expect(state).toEqual({ ...before, spirituality: before.spirituality - 4 });
      expect(random.cursor).toBe(0);
    }
  });

  it('uses ordinary J14.175f and K12.6f without paying or establishing supernatural interference', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[opening] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveAstrologerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random)).toMatchObject({
        selfGain: 14.175 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      const k = resolveAstrologerCombatAbility(state, 'SITE_PRESSURE', 1, random);
      expect(k).toMatchObject({ selfGain: 0, enemyReduction: 12.6 * factor, threatens: false });
      expect(k.label).toContain('没有占卜或预知能力'); expect(k.label).toContain('不留下干扰标记');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not convert new astrology or divination-interference mastery into physical attack or defense', () => {
    const low = fixture(), high = fixture();
    high.progression.mastery[astrology] = 500; high.progression.mastery[interference] = 500;
    for (const id of ids.filter(id => id !== 'ACCIDENT')) expect(resolve(low, id)).toEqual(resolve(high, id));
    expect(low.spirituality).toBe(56); expect(high.spirituality).toBe(56);
    expect(high.progression.mastery).toEqual({ [opening]: 500, [tricks]: 0, [astrology]: 500, [interference]: 500 });
  });

  it('clamps actual retained mastery and never borrows independent named trick records', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[tricks] = mastery;
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, 'TRICK_ATTACK').selfGain).toBe(26.325 * factor);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(23.4 * factor);
    }
    const low = fixture(), high = fixture();
    high.progression.mastery[opening] = 0;
    for (const name of ['fog', 'wind', 'flash', 'freeze', 'electric', 'trip']) high.progression.mastery[`door.s8.${name}`] = 500;
    for (const id of ['TRICK_ATTACK', 'TRICK_COVER'] as const) expect(resolve(low, id)).toEqual(resolve(high, id));
  });

  it('charges each actual retained trick exactly2, then falls back with no redraw or free extra effect', () => {
    const state = fixture(); state.spirituality = 2; state.progression.mastery[tricks] = 500;
    const before = structuredClone(state), random = stream(state);
    expect(resolveAstrologerCombatAbility(state, 'TRICK_ATTACK', 1, random).selfGain).toBe(26.325);
    expect(state.spirituality).toBe(0);
    const b = resolveAstrologerCombatAbility(state, 'TRICK_COVER', 1, random);
    expect(b).toMatchObject({ selfGain: 0, enemyReduction: 7.8, threatens: false });
    expect(b.label).toContain('灵性不足2');
    expect(resolveAstrologerCombatAbility(state, 'SITE_PRESSURE', 1, random).enemyReduction).toBe(12.6);
    expect(state).toEqual({ ...before, spirituality: 0 }); expect(random.cursor).toBe(0);
  });

  it('falls back below2 without debit, forced spell, borrowed future or extra action', () => {
    for (const spirituality of [0, 1, 1.999]) {
      const state = fixture(); state.spirituality = spirituality;
      state.progression.mastery[tricks] = 500;
      const before = structuredClone(state), random = stream(state);
      const h = resolveAstrologerCombatAbility(state, 'TRICK_ATTACK', 0.8, random);
      const b = resolveAstrologerCombatAbility(state, 'TRICK_COVER', 1, random);
      expect(h).toMatchObject({ selfGain: 6.5 * 0.8, enemyReduction: 0, threatens: true });
      expect(b).toMatchObject({ selfGain: 0, enemyReduction: 7.8, threatens: false });
      for (const effect of [h, b]) {
        expect(effect.label).toContain('灵性不足2'); expect(effect.label).toContain('不耗灵性');
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('replaces H only with an actual HAND club16, no electric stacked or extra weapon on J', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[tricks] = 500;
      const before = state.spirituality;
      expect(resolve(state, 'TRICK_ATTACK', 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 26.325);
      expect(state.spirituality).toBe(before - (location === 'HAND' ? 0 : 2));
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(14.175 * 0.8);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(23.4);
      expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(12.6);
      expect(state.spirituality).toBe(before - (location === 'HAND' ? 2 : 4));
      if (location === 'HAND') {
        expect(resolve(state, 'TRICK_ATTACK').label).toContain('替换而不叠加');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('clamps actual physical factors and does not threaten with zero ordinary contribution', () => {
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = 0;
      expect(resolve(state, 'TRICK_ATTACK', physical)).toMatchObject({ selfGain: 0, threatens: false });
      expect(resolve(state, 'BODY_FOLLOWUP', physical)).toMatchObject({ selfGain: 0, threatens: false });
      state.town.clubLocation = 'HAND';
      expect(resolve(state, 'TRICK_ATTACK', physical)).toMatchObject({ selfGain: 0, threatens: false });
    }
    const state = fixture(); state.spirituality = 0;
    expect(resolve(state, 'BODY_FOLLOWUP', 3).selfGain).toBe(14.175);
    expect(resolve(state, 'TRICK_ATTACK', 3).selfGain).toBe(6.5);
  });

  it('keeps R0, no divination draw or future preparation, and exact ±11.25 accidents', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state);
    const r = resolveAstrologerCombatAbility(state, 'OBSERVE', 1, random);
    expect(r).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(r.label).toContain('占星术只在战斗外'); expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveAstrologerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
      selfGain: -11.25, enemyReduction: 0, threatens: false,
    });
    expect(resolveAstrologerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
      selfGain: 11.25, enemyReduction: 0, threatens: false,
    });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current ordinary target, no invented divination or doorway', () => {
  it('binds the current carrier and explicitly absent divination/forecast sources', () => {
    const state = fixture();
    expect(currentAstrologerCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      scope: 'CURRENT_LOCAL_SINGLE_OPPONENT', gasObject: 'NONE', doorPath: 'NONE',
      enemyDivination: 'NONE', enemyForecast: 'NONE', exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' });
  });

  it('rejects every stale or forged source field before cost, effect or any random draw', () => {
    const state = fixture(), source = currentAstrologerCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_TARGET' },
      { ...source, nature: 'SPIRIT' }, { ...source, body: 'UNREACHABLE_BODY' },
      { ...source, space: 'PAST_WORKSHOP' }, { ...source, scope: 'WHOLE_CITY' },
      { ...source, gasObject: 'UNDECLARED_POISON' }, { ...source, doorPath: 'INVENTED_THIN_WALL' },
      { ...source, enemyDivination: 'INVENTED_DIVINATION' }, { ...source, enemyForecast: 'INVENTED_FORECAST' },
      { ...source, exit: 'DISTANT_TELEPORT' }, { ...source, companion: 'INVENTED_ALLY' },
    ] as unknown as AstrologerCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveAstrologerCombatAbility(state, id, 1, random, input);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_TARGET|INVENTED_|DISTANT_TELEPORT/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('invalidates sources after lifecycle, location, sequence or opponent changes', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 9; }, state => { state.progression.sequence = 8; },
      state => { state.progression.sequence = 6; }, state => { state.progression.pathwayId = 'death'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentAstrologerCombatSource(state)!;
      mutate(state); const random = stream(state), before = structuredClone(state);
      expect(currentAstrologerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveAstrologerCombatAbility(state, id, 1, random, source)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentAstrologerCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveAstrologerCombatAbility(state, 'TRICK_ATTACK', 1, stream(state), source).selfGain).toBe(0);
    expect(state.spirituality).toBe(60);
    expect(resolve(state, 'TRICK_ATTACK').selfGain).toBe(26.325 * 0.65);
  });
});

describe('ordinary enemy agency, consequences and deterministic replay', () => {
  it('preserves all enemy actions after fog or unmatched interference, including full physical club16', () => {
    for (const playerSlot of [151, 279]) {
      for (const [roll, label, selfGain, enemyReduction] of [
        [1, '短棍打击', 16, 0], [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
        [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
      ] as const) {
        const state = fixture(); state.progression.mastery[tricks] = 500;
        scriptRolls(1, 1, playerSlot, roll, 1);
        const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
        expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: playerSlot === 151 ? 23.4 : 12.6 });
        expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
        expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
        expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
        vi.restoreAllMocks();
      }
    }
  });

  it('does not cancel or redraw ordinary attack/prepare actions as if the enemy were a diviner', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state), draws = scriptRolls(1, 100, 279, 1, 241, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves[0]!.label).toContain('没有占卜或预知能力');
    expect(round.moves.slice(1)).toEqual([
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
      { actor: 'ENEMY', label: '寻找空当', selfGain: 8, enemyReduction: 0 },
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(16); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('does not front-load recovery to pay an unaffordable retained trick', () => {
    const state = fixture(); state.spirituality = 1;
    scriptRolls(1, 1, 151, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.label).toContain('灵性不足2');
    expect(round.moves[0]!.enemyReduction).toBe(7.8);
    expect(state.spirituality).toBe(7);
  });

  it('does not grant injury from cover, restraint, R0 or a positive accident while armed', () => {
    for (const slot of [151, 279, 379, 411]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 411 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 411 ? 11.25 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 411 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('spends the existing action budget and leaves no fog, portal or counterdivination state next round', () => {
    const state = fixture(); state.progression.mastery[tricks] = 500;
    scriptRolls(100, 100, 151, 400, 151, 400, 151, 400, 151, 151, 151, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.round.playerCount).toBe(6); expect(first.round.enemyCount).toBe(3);
    expect(first.round.moves).toHaveLength(9); expect(state.spirituality).toBe(54);
    expect(first.round.moves.filter(move => move.actor === 'PLAYER').every(move => move.enemyReduction === 23.4)).toBe(true);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 379, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(second.round.first).toBe('ENEMY'); expect(second.round.moves).toHaveLength(2);
    expect(second.round.moves[0]).toEqual({ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(second.round.enemyAdvantage).toBe(130); expect(second.round.moves[1]!.enemyReduction).toBe(0);
    expect(state.spirituality).toBe(60);
    expect(Object.keys(state.combat!).sort()).toEqual([
      'encounterId', 'enemyHealth', 'enemyInjuries', 'enemyMind', 'enemyRisk', 'enemyStatus', 'lastRound', 'round',
    ]);
  });

  it('uses normal injury and surrender after electric or ordinary J, never automatic damage or killing', () => {
    for (const slot of [1, 91]) {
      const state = fixture();
      scriptRolls(1, 1, slot, 400, 1, 66);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe('ENEMY_SURRENDERED');
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(state.spirituality).toBe(slot === 1 ? 58 : 60);
      vi.restoreAllMocks();
    }
  });

  it('preserves injury risk and final player death after fog, without portal immunity', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 151, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(result.round.moves[1]!.selfGain).toBe(16);
    expect(state.spirituality).toBe(3); expect(state.injuryRisk).toBe(2);
    expect(result.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(result.round.consequence).toContain('最终死亡');
  });

  it('retreats only by the original ordinary exit, no companion, new portal or improved odds', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.playerCount).toBe(6); expect(result.round.enemyCount).toBe(3);
    expect(result.round.consequence).toContain('携铃者'); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const blocked = fixture();
    scriptRolls(1, 1, 51, 400, 1);
    const failed = resolveSliceCombatRound(blocked, 'RETREAT');
    expect(failed.outcome).toBe('CONTINUE'); expect(failed.round.retreat).toBe('FAILURE');
    expect(failed.round.moves).toEqual([{ actor: 'ENEMY', label: '动作落空', selfGain: 0, enemyReduction: 0 }]);
  });

  it('replays exact JSON state, payments and random cursor without Math.random or precognition', () => {
    for (const spirituality of [1, 4, 60]) {
      const state = fixture(); state.random.cursor = 7; state.health = 70; state.spirituality = spirituality;
      const restored = JSON.parse(JSON.stringify(state)) as SliceState;
      const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
      expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });
});
