import { STAR_KEY_COUNT_WHEEL, starKeyAbilityWheel } from '../../src/domain/star-key/combat.js';
import { WANDERER_COUNT_WHEEL, wandererAbilityWheel } from '../../src/domain/wanderer/combat.js';
import { PLANESWALKER_COUNT_WHEEL, planeswalkerAbilityWheel } from '../../src/domain/planeswalker/combat.js';
import { TRAVELER_COUNT_WHEEL, travelerAbilityWheel } from '../../src/domain/traveler/combat.js';
import { SECRETS_SORCERER_COUNT_WHEEL, secretsSorcererAbilityWheel } from '../../src/domain/secrets-sorcerer/combat.js';
import { ASTROLOGER_COUNT_WHEEL, astrologerAbilityWheel } from '../../src/domain/astrologer/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { APPRENTICE_COUNT_WHEEL, apprenticeAbilityWheel } from '../../src/domain/apprentice/combat.js';
import { LIGHTPRAYER_COUNT_WHEEL, lightprayerAbilityWheel } from '../../src/domain/lightprayer/combat.js';
import { TRICKMASTER_COUNT_WHEEL, currentTrickmasterCombatSource, drawTrickmasterAbility,
  isTrickmaster, resolveTrickmasterCombatAbility, trickmasterAbilityWheel, trickmasterActionCount,
  type TrickmasterCombatSource, type TrickmasterMoveId,
} from '../../src/domain/trickmaster/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const opening = 'door.s9.door-opening', tricks = 'door.s8.tricks';
const ids = ['TRICK_ATTACK', 'BODY_FOLLOWUP', 'TRICK_COVER', 'TRICK_INTERFERENCE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('trickmaster-combat-test', sliceDefaultCreationSelection, 'trickmaster-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'door', sequence: 8, mastery: { [opening]: 500, [tricks]: 0 },
    acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: TrickmasterMoveId, physical = 1) {
  return resolveTrickmasterCombatAbility(state, id, physical, stream(state));
}
/** Preserve real cursor movement while targeting the exact shared-wheel tickets. */
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

describe('Trickmaster S8 exact Door V1 profile', () => {
  it('uses the V six-slot weights and the S8 five-count distribution', () => {
    const state = fixture();
    expect(isTrickmaster(state)).toBe(true);
    expect(trickmasterAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(trickmasterAbilityWheel(null).map(entry => entry.weight)).toEqual([24, 14, 12, 8, 10, 32]);
    expect(playerAbilityWheel(state, null)).toEqual(trickmasterAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(TRICKMASTER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([12, 18, 25, 28, 17]);
    expect(TRICKMASTER_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.2);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(24);
    expect(playerCountWheel(state)[0]!.weight).toBe(12);
  });

  it('preserves both ends of every S8 action-count interval', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [30, 2], [31, 3], [55, 3], [56, 4], [83, 4], [84, 5], [100, 5]]) {
      expect(trickmasterActionCount(roll!)).toBe(count);
    }
  });

  it('preserves exact stance tickets and one draw per main slot', () => {
    for (const [stance, weights] of [
      [null, [96, 56, 48, 32, 40, 128]],
      ['ATTACK', [120, 70, 48, 32, 40, 128]],
      ['DEFEND', [96, 56, 60, 32, 40, 128]],
      ['CONTROL', [96, 56, 48, 40, 40, 128]],
      ['PREPARE', [96, 56, 48, 32, 50, 128]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(trickmasterAbilityWheel(stance).map(entry => entry.weight)).toEqual(
        weights.map(value => total === 400 ? value / 4 : value / total * 100),
      );
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawTrickmasterAbility(random, stance)).toBe(ids[index]);
        expect(drawTrickmasterAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(trickmasterAbilityWheel('RETREAT')).toEqual(trickmasterAbilityWheel(null));
  });

  it('uses base300, core20/40/20/20, cap60 and spirituality45 with shared penalties', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 271, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(324); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 271, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('preserves S9 and other profiles, and never routes unsupported Door sequences into S8', () => {
    const state = fixture();
    state.progression.sequence = 9;
    expect(isTrickmaster(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(APPRENTICE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(apprenticeAbilityWheel('CONTROL'));
    // Former future sequences now use their own current profiles, never this old profile.
    state.progression.pathwayId='door';state.progression.sequence=6;expect(isTrickmaster(state)).toBe(false);expect(playerCountWheel(state)).toEqual(ASTROLOGER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(astrologerAbilityWheel('CONTROL',6));
    state.progression.pathwayId='door';state.progression.sequence=5;expect(isTrickmaster(state)).toBe(false);expect(playerCountWheel(state)).toEqual(TRAVELER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(travelerAbilityWheel(state,'CONTROL'));
    state.progression.pathwayId='door';state.progression.sequence=3;expect(isTrickmaster(state)).toBe(false);expect(playerCountWheel(state)).toEqual(WANDERER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(wandererAbilityWheel(state,'CONTROL'));
    state.progression.sequence=2;expect(isTrickmaster(state)).toBe(false);expect(playerCountWheel(state)).toEqual(PLANESWALKER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(planeswalkerAbilityWheel(state,'CONTROL'));
    state.progression.sequence=1;expect(isTrickmaster(state)).toBe(false);expect(playerCountWheel(state)).toEqual(STAR_KEY_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(starKeyAbilityWheel(state,'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['door', 0], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isTrickmaster(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'sun'; state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(LIGHTPRAYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(lightprayerAbilityWheel('DEFEND'));
  });
});

describe('one current paid trick and a single shared mastery pool', () => {
  it('uses unrounded H/B13.65f and K7.35f at all six mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[tricks] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      const random = stream(state);
      const attack = resolveTrickmasterCombatAbility(state, 'TRICK_ATTACK', 1, random);
      expect(attack).toMatchObject({ selfGain: 13.65 * factor, enemyReduction: 0, threatens: true });
      expect(attack.label).toContain('弱小电击');
      expect(resolveTrickmasterCombatAbility(state, 'TRICK_COVER', 1, random)).toMatchObject({
        selfGain: 0, enemyReduction: 13.65 * factor, threatens: false,
      });
      expect(resolveTrickmasterCombatAbility(state, 'TRICK_INTERFERENCE', 1, random)).toMatchObject({
        selfGain: 0, enemyReduction: 7.35 * factor, threatens: false,
      });
      expect(state).toEqual({ ...before, spirituality: before.spirituality - 6 });
      expect(random.cursor).toBe(0);
    }
  });

  it('clamps the shared mastery and does not borrow S9 or separately named trick masteries', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[tricks] = mastery;
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, 'TRICK_ATTACK').selfGain).toBe(13.65 * factor);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(13.65 * factor);
      expect(resolve(state, 'TRICK_INTERFERENCE').enemyReduction).toBe(7.35 * factor);
    }
    const lowOpening = fixture(), highOpening = fixture();
    lowOpening.progression.mastery[opening] = 0;
    for (const name of ['fog', 'wind', 'flash', 'freeze', 'electric', 'trip']) {
      highOpening.progression.mastery[`door.s8.${name}`] = 500;
    }
    for (const id of ['TRICK_ATTACK', 'TRICK_COVER', 'TRICK_INTERFERENCE'] as const) {
      expect(resolve(lowOpening, id)).toEqual(resolve(highOpening, id));
    }
    expect(Object.keys(lowOpening.progression.mastery)).toEqual([opening, tricks]);
  });

  it('charges exactly2 from current spirituality and uses ordinary fallbacks once it runs out', () => {
    const state = fixture(); state.spirituality = 4; state.progression.mastery[tricks] = 500;
    const before = structuredClone(state), random = stream(state);
    expect(resolveTrickmasterCombatAbility(state, 'TRICK_ATTACK', 1, random).selfGain).toBe(13.65);
    expect(state.spirituality).toBe(2);
    expect(resolveTrickmasterCombatAbility(state, 'TRICK_COVER', 1, random).enemyReduction).toBe(13.65);
    expect(state.spirituality).toBe(0);
    expect(resolveTrickmasterCombatAbility(state, 'TRICK_INTERFERENCE', 1, random)).toMatchObject({
      selfGain: 0, enemyReduction: 4.2, threatens: false,
    });
    expect(state).toEqual({ ...before, spirituality: 0 }); expect(random.cursor).toBe(0);
  });

  it('falls back below2 with no debit, redraw, phantom preparation or fake spell', () => {
    for (const spirituality of [0, 1, 1.999]) {
      const state = fixture(); state.spirituality = spirituality;
      state.progression.mastery[tricks] = 500;
      const before = structuredClone(state), random = stream(state);
      const h = resolveTrickmasterCombatAbility(state, 'TRICK_ATTACK', 0.8, random);
      const b = resolveTrickmasterCombatAbility(state, 'TRICK_COVER', 1, random);
      const k = resolveTrickmasterCombatAbility(state, 'TRICK_INTERFERENCE', 1, random);
      expect(h).toMatchObject({ selfGain: 6.5 * 0.8, enemyReduction: 0, threatens: true });
      expect(b).toMatchObject({ selfGain: 0, enemyReduction: 7.8, threatens: false });
      expect(k).toMatchObject({ selfGain: 0, enemyReduction: 4.2, threatens: false });
      for (const effect of [h, b, k]) {
        expect(effect.label).toContain('灵性不足2'); expect(effect.label).toContain('不耗灵性');
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('makes current single-target scope, balance cost and temporary effects visible', () => {
    const state = fixture();
    const h = resolve(state, 'TRICK_ATTACK'), b = resolve(state, 'TRICK_COVER'), k = resolve(state, 'TRICK_INTERFERENCE');
    for (const effect of [h, b, k]) {
      expect(effect.label).toContain('耗灵性2'); expect(effect.label).toContain('（G）');
    }
    expect(h.label).toContain('眼前单一普通对手');
    expect(b.label).toContain('短促雾气'); expect(b.label).toContain('不保证免伤');
    expect(k.label).toContain('眼前闪光'); expect(k.label).toContain('不催眠');
    expect(k.label).toContain('不直接判伤或判死');
  });

  it('replaces only H with an actual HAND club16, preserving all other costs and budgets', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[tricks] = 500;
      const before = state.spirituality;
      expect(resolve(state, 'TRICK_ATTACK', 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 13.65);
      expect(state.spirituality).toBe(before - (location === 'HAND' ? 0 : 2));
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(7.35 * 0.8);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(13.65);
      expect(resolve(state, 'TRICK_INTERFERENCE').enemyReduction).toBe(7.35);
      expect(state.spirituality).toBe(before - (location === 'HAND' ? 4 : 6));
      if (location === 'HAND') {
        expect(resolve(state, 'TRICK_ATTACK').label).toContain('替换而不叠加');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('clamps actual ordinary-body factors and does not threaten with zero physical gain', () => {
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = 0;
      expect(resolve(state, 'TRICK_ATTACK', physical)).toMatchObject({ selfGain: 0, threatens: false });
      expect(resolve(state, 'BODY_FOLLOWUP', physical)).toMatchObject({ selfGain: 0, threatens: false });
      state.town.clubLocation = 'HAND';
      expect(resolve(state, 'TRICK_ATTACK', physical)).toMatchObject({ selfGain: 0, threatens: false });
    }
    const state = fixture(); state.spirituality = 0;
    expect(resolve(state, 'BODY_FOLLOWUP', 3).selfGain).toBe(7.35);
    expect(resolve(state, 'TRICK_ATTACK', 3).selfGain).toBe(6.5);
  });

  it('uses ordinary J without a gas object, R0 without preparing a combo, and exact ±7.5 accidents', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state);
    const j = resolveTrickmasterCombatAbility(state, 'BODY_FOLLOWUP', 1, random);
    expect(j.selfGain).toBe(7.35); expect(j.label).toContain('没有已声明可转移的气体对象');
    expect(resolveTrickmasterCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({
      selfGain: 0, enemyReduction: 0, threatens: false,
    });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveTrickmasterCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
      selfGain: -7.5, enemyReduction: 0, threatens: false,
    });
    expect(resolveTrickmasterCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
      selfGain: 7.5, enemyReduction: 0, threatens: false,
    });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current source, no old room, invented target or doorway', () => {
  it('authors only the ordinary carrier in the present local open passage', () => {
    const state = fixture();
    expect(currentTrickmasterCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      scope: 'CURRENT_LOCAL_SINGLE_OPPONENT', gasObject: 'NONE', doorPath: 'NONE',
      exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' });
  });

  it('rejects every stale or forged source field before any cost, effect or random draw', () => {
    const state = fixture(), source = currentTrickmasterCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_TARGET' },
      { ...source, nature: 'SPIRIT' }, { ...source, body: 'UNREACHABLE_BODY' },
      { ...source, space: 'PAST_WORKSHOP' }, { ...source, scope: 'WHOLE_CITY' },
      { ...source, gasObject: 'UNDECLARED_POISON' }, { ...source, doorPath: 'INVENTED_THIN_WALL' },
      { ...source, exit: 'DISTANT_TELEPORT' }, { ...source, companion: 'INVENTED_ALLY' },
    ] as unknown as TrickmasterCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveTrickmasterCombatAbility(state, id, 1, random, input);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_TARGET|INVENTED_ALLY|DISTANT_TELEPORT/);
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
      state => { state.progression.sequence = 9; }, state => { state.progression.sequence = 7; },
      state => { state.progression.pathwayId = 'death'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentTrickmasterCombatSource(state)!;
      mutate(state); const random = stream(state), before = structuredClone(state);
      expect(currentTrickmasterCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveTrickmasterCombatAbility(state, id, 1, random, source)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentTrickmasterCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveTrickmasterCombatAbility(state, 'TRICK_ATTACK', 1, stream(state), source).selfGain).toBe(0);
    expect(state.spirituality).toBe(45);
    expect(resolve(state, 'TRICK_ATTACK').selfGain).toBe(13.65 * 0.65);
  });
});

describe('ordinary enemy, honest consequences and deterministic replay', () => {
  it('preserves every ordinary enemy action after fog, including the full club16 action', () => {
    for (const [roll, label, selfGain, enemyReduction] of [
      [1, '短棍打击', 16, 0], [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
      [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
    ] as const) {
      const state = fixture(); state.progression.mastery[tricks] = 500;
      scriptRolls(1, 1, 191, roll, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 13.65 });
      expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
      expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('keeps every action count and ordinary enemy action after flash without hypnosis or a free turn', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state), draws = scriptRolls(1, 100, 239, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves[0]!.label).toContain('眼前闪光');
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(12.5); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('does not front-load recovery to pay an unaffordable trick', () => {
    const state = fixture(); state.spirituality = 1;
    scriptRolls(1, 1, 191, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.label).toContain('灵性不足2');
    expect(round.moves[0]!.enemyReduction).toBe(7.8);
    expect(state.spirituality).toBe(5.5);
  });

  it('does not grant injury from fog, flash, R0 or a positive accident while armed', () => {
    for (const slot of [191, 239, 271, 311]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 311 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 311 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 311 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('repeated fog uses the existing action budget and leaves no protection into the next round', () => {
    const state = fixture(); state.progression.mastery[tricks] = 500;
    scriptRolls(100, 100, 191, 400, 191, 400, 191, 400, 191, 191, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.round.playerCount).toBe(5); expect(first.round.enemyCount).toBe(3);
    expect(first.round.moves).toHaveLength(8); expect(state.spirituality).toBe(39.5);
    expect(first.round.moves.filter(move => move.actor === 'PLAYER').every(move => move.enemyReduction === 13.65)).toBe(true);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 271, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(second.round.first).toBe('ENEMY');
    expect(second.round.moves).toHaveLength(2);
    expect(second.round.moves[0]).toEqual({ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(second.round.enemyAdvantage).toBe(130);
    expect(second.round.moves[1]!.enemyReduction).toBe(0);
    expect(state.spirituality).toBe(44);
    expect(Object.keys(state.combat!).sort()).toEqual([
      'encounterId', 'enemyHealth', 'enemyInjuries', 'enemyMind', 'enemyRisk', 'enemyStatus', 'lastRound', 'round',
    ]);
  });

  it('uses normal injury and surrender after electric or ordinary J, never an automatic kill', () => {
    for (const slot of [1, 121]) {
      const state = fixture();
      scriptRolls(1, 1, slot, 400, 1, 66);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe('ENEMY_SURRENDERED');
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(state.spirituality).toBe(slot === 1 ? 43 : 45);
      vi.restoreAllMocks();
    }
  });

  it('preserves ordinary injury risk and final player death even after fog', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 191, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(result.round.moves[1]!.selfGain).toBe(16);
    expect(state.spirituality).toBe(3); expect(state.injuryRisk).toBe(2);
    expect(result.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(result.round.consequence).toContain('最终死亡');
  });

  it('retreats only along the original ordinary exit without creating a portal or buffing odds', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.playerCount).toBe(5); expect(result.round.enemyCount).toBe(3);
    expect(result.round.consequence).toContain('携铃者'); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const blocked = fixture();
    scriptRolls(1, 1, 51, 400, 1);
    const failed = resolveSliceCombatRound(blocked, 'RETREAT');
    expect(failed.outcome).toBe('CONTINUE'); expect(failed.round.retreat).toBe('FAILURE');
    expect(failed.round.moves).toEqual([{ actor: 'ENEMY', label: '动作落空', selfGain: 0, enemyReduction: 0 }]);
  });

  it('replays the exact JSON state, current resource payments and cursor without Math.random', () => {
    for (const spirituality of [1, 4, 45]) {
      const state = fixture(); state.random.cursor = 7; state.health = 70; state.spirituality = spirituality;
      const restored = JSON.parse(JSON.stringify(state)) as SliceState;
      const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
      expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });
});
