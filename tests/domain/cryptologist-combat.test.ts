import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { MARAUDER_COUNT_WHEEL, marauderAbilityWheel } from '../../src/domain/marauder/combat.js';
import {
  CRYPTOLOGIST_COUNT_WHEEL, createCryptologistRoundObservations, cryptologistAbilityWheel,
  cryptologistActionCount, currentCryptologistCombatSource, drawCryptologistAbility, isCryptologist,
  observeCryptologistEnemyAction, resolveCryptologistCombatAbility, type CryptologistMoveId,
  type CryptologistRoundObservations,
} from '../../src/domain/cryptologist/combat.js';
import * as cryptologistCombat from '../../src/domain/cryptologist/combat.js';
import {
  SWINDLER_COUNT_WHEEL, consumeSwindlerMisdirection, observeSwindlerEnemyAction,
  swindlerAbilityWheel, type SwindlerActionRemainder, type SwindlerCombatSource,
} from '../../src/domain/swindler/combat.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const decryption = 'error.s7.decryption';
const ids = ['BODY_STRIKE', 'MISDIRECT', decryption, 'DECEIT', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(sequence = 7): SliceState {
  const state = createSliceRun('cryptologist-combat-test', sliceDefaultCreationSelection, 'cryptologist-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'error', sequence, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = sequence === 8 ? 45 : 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(
  state: SliceState, id: CryptologistMoveId, observations = createCryptologistRoundObservations(state),
  remaining: SwindlerActionRemainder = { PLAYER: 0, ENEMY: 1 }, physical = 1,
) {
  return resolveCryptologistCombatAbility(state, id, physical, stream(state), remaining, observations);
}
function observe(state: SliceState, observations: CryptologistRoundObservations, id = 'STRIKE', gain = 16) {
  observeSwindlerEnemyAction(state, id);
  observeCryptologistEnemyAction(state, observations, id, gain);
}
/** Exact tickets, with real cursor advancement and a failure on any extra draw. */
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

describe('Cryptologist S7 Error V1 profile', () => {
  it('routes only error7 with I18/12/32/25/8/5 and six-count mean3.64, preserving lower profiles', () => {
    const state = fixture();
    expect(isCryptologist(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(cryptologistAbilityWheel(null, state));
    expect(cryptologistAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(cryptologistAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(playerCountWheel(state)).toEqual(CRYPTOLOGIST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 20, 23, 20, 12]);
    expect(CRYPTOLOGIST_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.64);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    state.progression.sequence = 8;
    expect(isCryptologist(state)).toBe(false); expect(playerCountWheel(state)).toEqual(SWINDLER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(swindlerAbilityWheel(null, state));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(MARAUDER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(marauderAbilityWheel(null, state));
    state.progression.pathwayId = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(ordinaryAbilityWheel(false, null));
  });

  it('uses exact count boundaries, 1.25 stance tickets and one draw for every ability', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [45, 3], [46, 4], [68, 4], [69, 5], [88, 5], [89, 6], [100, 6]]) {
      expect(cryptologistActionCount(roll!)).toBe(count);
    }
    for (const [stance, weights] of [
      [null, [72, 48, 128, 100, 32, 20]], ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]], ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]], ['RETREAT', [72, 48, 128, 100, 32, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(cryptologistAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let lower = 1;
      weights.forEach((weight, index) => {
        for (const roll of [lower, lower + weight - 1]) {
          const random = stream(fixture()), draws = scriptRolls(roll);
          expect(drawCryptologistAbility(random, stance)).toBe(ids[index]);
          expect(random.cursor).toBe(1); expect(draws).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
        }
        lower += weight;
      });
    }
  });

  it('previews actual-source gates, fixed fallback, shared preparation and no dangerous source', () => {
    const state = fixture(), wheel = playerAbilityWheel(state, null);
    expect(wheel[0]!.label).toContain('仅本轮已实际发生'); expect(wheel[0]!.label).toContain('普通身体12');
    expect(wheel[1]!.label).toContain('耗1灵性'); expect(wheel[1]!.label).toContain('当前前置不足');
    expect(wheel[2]!.label).toContain('31.5f'); expect(wheel[2]!.label).toContain('普通格挡10');
    for (const index of [3, 4]) {
      expect(wheel[index]!.label).toContain('K/R共用两段'); expect(wheel[index]!.label).toContain('0即时贡献');
      expect(wheel[index]!.label).toContain('不额外立即行动');
    }
    expect(wheel[5]!.label).toContain('当前无危险解密源');
    const observations = createCryptologistRoundObservations(state); observe(state, observations); resolve(state, 'DECEIT', observations);
    state.spirituality = 0;
    expect(playerAbilityWheel(state, null)[3]!.label).toContain('已准备');
    expect(playerAbilityWheel(state, null)[3]!.label).toContain('当前不足');
  });
});

describe('already-observed ordinary facts and bounded decryption budgets', () => {
  it('gates H45f on each actual attack source once and clamps decryption mastery and physical factors', () => {
    for (const mastery of [0, 100, 300, 500, 800, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state);
      state.progression.mastery[decryption] = mastery;
      const level = Number.isFinite(mastery) ? Math.max(0, Math.min(500, mastery)) : 0;
      const f = 0.65 + 0.35 * level / 500;
      expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(12);
      observe(state, observations);
      expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(45 * f);
      expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(12);
      state.progression.mastery['error.s9.agility'] = 500;
      state.progression.mastery['error.s9.dexterity'] = 500;
      state.progression.mastery['error.s9.theft'] = 500;
      state.progression.mastery['error.s8.deceit'] = 500;
      observe(state, observations, 'OPENING', 8);
      expect(resolve(state, 'BODY_STRIKE', observations, undefined, 0.8).selfGain).toBe(45 * f * 0.8);
      expect(state.spirituality).toBe(60);
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
      const effect = resolve(state, 'BODY_STRIKE', observations, undefined, physical);
      expect(effect.selfGain).toBe(physical === 2 ? 45 * 0.65 : 0);
      expect(effect.threatens).toBe(physical === 2);
    }
  });

  it('caps B by31.5f and actual un-offset observed contribution, never repeated or future threat', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state);
      state.progression.mastery[decryption] = mastery;
      const budget = 31.5 * (0.65 + 0.35 * mastery / 500);
      expect(resolve(state, decryption, observations)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      observe(state, observations); observe(state, observations); observe(state, observations);
      const first = resolve(state, decryption, observations), second = resolve(state, decryption, observations);
      expect(first.enemyReduction).toBe(budget); expect(second.enemyReduction).toBe(Math.min(budget, 48 - budget));
      const third = resolve(state, decryption, observations);
      expect(first.enemyReduction + second.enemyReduction + third.enemyReduction).toBeCloseTo(48);
      expect(resolve(state, decryption, observations).enemyReduction).toBe(0);
      expect(state.spirituality).toBe(60); expect(state.combat!.enemyHealth).toBe(100);
      observe(state, observations, 'OPENING', 8);
      expect(resolve(state, decryption, observations).enemyReduction).toBe(8);
    }
  });

  it('uses the actual original club16 as a replacement in hand only, preserving object custody', () => {
    const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
    state.progression.mastery[decryption] = 500;
    state.town.clubLocation = 'BAG'; expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(45);
    state.town.clubLocation = 'HAND'; expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(16);
    state.town.clubLocation = 'BAG';
    state.marauder.dispute.weapon.custodian = 'PLAYER'; state.marauder.dispute.weapon.location = 'PLAYER_HAND';
    const weapon = structuredClone(state.marauder.dispute.weapon);
    expect(resolve(state, 'BODY_STRIKE', observations, undefined, 0.8).selfGain).toBe(16 * 0.8);
    expect(resolve(state, 'BODY_STRIKE', observations).label).toContain('所有权仍属塞蒙');
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握塞蒙原短棍打击');
    expect(state.marauder.dispute.weapon).toEqual(weapon);
  });

  it('never decodes secret pools, old knowledge, narrative bell objects or previous-round tactics', () => {
    const state = fixture(), observations = createCryptologistRoundObservations(state);
    state.progression.mastery[decryption] = 500;
    state.knowledge.push({ id: 'secret', week: 1, title: '旧知识', text: 'HIDDEN_SECRET_POOL' });
    state.world.bellAtScene = true; state.world.bellHolder = 'CARRIER';
    const before = structuredClone(state);
    observeCryptologistEnemyAction(state, observations, 'HIDDEN_SECRET_POOL', 1000);
    expect(observations.lastMove).toBeNull(); expect(observations.unansweredThreat).toBe(0);
    expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(12);
    expect(resolve(state, decryption, observations).enemyReduction).toBe(10);
    const info = resolve(state, 'OBSERVE', observations);
    expect(info.label).toContain('不补造线索'); expect(info.label).not.toContain('HIDDEN_SECRET_POOL');
    expect(state).toEqual(before);
    observe(state, observations);
    state.combat!.round = 2;
    expect(resolve(state, 'BODY_STRIKE', observations).selfGain).toBe(12);
    expect(resolve(state, decryption, observations).enemyReduction).toBe(10);
    const fresh = createCryptologistRoundObservations(state);
    expect(fresh.lastMove).toBeNull(); expect(fresh.unansweredThreat).toBe(0);
  });

  it('interprets all five already-seen facts without adding a second R budget or revealing future abilities', () => {
    for (const [id, text] of [['STRIKE', '近身打击'], ['BLOCK', '格挡护身'], ['OPENING', '寻找空当'], ['DISTANCE', '拉开距离'], ['MISS', '落空']]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state);
      observe(state, observations, id!, id === 'STRIKE' ? 16 : id === 'OPENING' ? 8 : 0);
      const random = stream(state), remaining = { PLAYER: 0, ENEMY: 1 };
      const result = resolveCryptologistCombatAbility(state, 'OBSERVE', 1, random, remaining, observations);
      expect(result.label).toContain(`已解读本轮普通事实`); expect(result.label).toContain(text!);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: true, skipNext: false });
      expect(state.spirituality).toBe(60); expect(random.cursor).toBe(0); expect(remaining).toEqual({ PLAYER: 0, ENEMY: 1 });
    }
  });

  it('rejects invalid source snapshots and nonliving/unavailable targets before any effect, spending or draw', () => {
    const state = fixture(), source = currentCryptologistCombatSource(state)!;
    const tampered = [null, { ...source, runId: 'other' }, { ...source, revision: 99 },
      { ...source, week: 99 }, { ...source, round: 2 }, { ...source, target: 'SECRET_TARGET' },
      { ...source, nature: 'HIGH_SEQUENCE' }, { ...source, body: 'UNREACHABLE' },
      { ...source, speech: 'HIDDEN_MIND' }, { ...source, space: 'OTHER' }, { ...source, exit: 'NEW_EXIT' },
    ] as (SwindlerCombatSource | null)[];
    for (const value of tampered) {
      const before = structuredClone(state), observations = createCryptologistRoundObservations(state);
      const random = stream(state), remaining = { PLAYER: 0, ENEMY: 1 };
      for (const id of ids) {
        const result = resolveCryptologistCombatAbility(state, id, 1, random, remaining, observations, value);
        expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(result.label).not.toMatch(/SECRET_TARGET|HIGH_SEQUENCE|HIDDEN_MIND|NEW_EXIT/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(remaining).toEqual({ PLAYER: 0, ENEMY: 1 });
    }
    for (const change of [
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.combat!.encounterId = 'MARAUDER_DISPUTE'; },
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyMind = 0; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
    ]) {
      const altered = fixture(); change(altered); expect(currentCryptologistCombatSource(altered)).toBeNull();
    }
  });

  it('keeps ordinary accidents exactly±11.25, free and non-injuring without registered dangerous decryption', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const draws = scriptRolls(1, 2);
    for (const expected of [-11.25, 11.25]) {
      const result = resolveCryptologistCombatAbility(state, 'ACCIDENT', 1, random, { PLAYER: 0, ENEMY: 1 });
      expect(result).toMatchObject({ selfGain: expected, enemyReduction: 0, threatens: false });
      expect(result.label).toContain('耗0灵性'); expect(result.label).toContain('不触发反向注视');
    }
    expect(state).toEqual(before); expect(draws).toHaveBeenCalledTimes(2);
  });
});

describe('inherited S8 timing, resource conservation and current shared combat', () => {
  it('shares K/R preparation across rounds and transfers at most1 actual remaining action, paying1 only on completion', () => {
    for (const [first, second] of [['DECEIT', 'DECEIT'], ['DECEIT', 'OBSERVE'], ['OBSERVE', 'DECEIT'], ['OBSERVE', 'OBSERVE']] as const) {
      const state = fixture(), observations = createCryptologistRoundObservations(state), remaining = { PLAYER: 0, ENEMY: 2 };
      observe(state, observations);
      expect(resolve(state, first, observations, remaining)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.spirituality).toBe(60); expect(state.combat!.swindlerDeceit!.prepared).toBe(true);
      state.combat!.round = 2;
      const completed = resolve(state, second, createCryptologistRoundObservations(state), remaining);
      expect(completed).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(completed.label).toContain('上限60'); expect(completed.label).toContain('不立即追加行动');
      expect(remaining).toEqual({ PLAYER: 1, ENEMY: 1 }); expect(state.spirituality).toBe(59);
      expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: false, skipNext: true });
    }
  });

  it('retains preparation with zero enemy slots, invalid remainder, or insufficient spirituality', () => {
    for (const [spirit, enemy] of [[60, 0], [0, 1], [0.5, 1], [Number.NaN, 1], [60, -1], [60, 0.5], [60, Number.NaN]]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
      resolve(state, 'DECEIT', observations); state.spirituality = spirit!;
      const before = structuredClone(state), remaining = { PLAYER: 0, ENEMY: enemy! };
      expect(resolve(state, 'OBSERVE', observations, remaining)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(state).toEqual(before); expect(remaining).toEqual({ PLAYER: 0, ENEMY: enemy! });
    }
  });

  it('uses J for one paid next-actual-ability suppression only, with no repeat charge or immediate contribution', () => {
    const state = fixture(), observations = createCryptologistRoundObservations(state);
    expect(resolve(state, 'MISDIRECT', observations).label).toContain('尚未发生'); observe(state, observations);
    const effect = resolve(state, 'MISDIRECT', observations);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('60→59'); expect(state.spirituality).toBe(59);
    const before = structuredClone(state); expect(resolve(state, 'MISDIRECT', observations).label).toContain('不重复付费');
    expect(state).toEqual(before); expect(consumeSwindlerMisdirection(state)).toContain('全部贡献归0');
    expect(consumeSwindlerMisdirection(state)).toBeNull();
  });

  it('records only actual moves in alternation and carries preparation, but not a stale decryption ledger, across rounds', () => {
    const state = fixture(), draws = scriptRolls(11, 100, 249, 1, 249, 161, 381, 1);
    const first = resolveSliceCombatRound(state, 'CONTROL');
    expect(first.round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'ENEMY']);
    expect(first.round.moves[0]!.label).toContain('不建立骗局准备');
    expect(first.round.moves[2]!.label).toContain('第一次有效命中');
    expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: true, skipNext: false });
    expect(draws).toHaveBeenCalledTimes(8); vi.restoreAllMocks();
    const nextDraws = scriptRolls(1, 100, 241, 249, 161, 121, 1);
    const next = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(next.first).toBe('ENEMY'); expect(next.playerCount).toBe(1); expect(next.enemyCount).toBe(3);
    expect(next.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(next.moves[1]!.label).toContain('敌2→1、我0→1');
    expect(next.moves[2]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(next.moves[2]!.label).toContain('全部贡献归0');
    expect(next.moves[3]!.enemyReduction).toBe(8);
    expect(next.moves.length).toBe(next.playerCount + next.enemyCount); expect(nextDraws).toHaveBeenCalledTimes(7);
  });

  it('never pre-draws the transferred final enemy slot, and does not learn a source from a suppressed actual slot', () => {
    const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
    resolve(state, 'DECEIT', observations);
    const draws = scriptRolls(1, 1, 249, 121, 1);
    const first = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(first.moves.map(move => move.actor)).toEqual(['PLAYER', 'PLAYER']);
    expect(first.moves[0]!.label).toContain('敌1→0、我0→1'); expect(draws).toHaveBeenCalledTimes(5);
    expect(state.combat!.swindlerDeceit!.skipNext).toBe(true); vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 121, 1);
    const next = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(next.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 0, enemyReduction: 0 });
    expect(next.moves[0]!.label).toContain('一次失效已用尽');
    expect(next.moves[1]!.label).toContain('尚无合格'); expect(next.moves[1]!.enemyReduction).toBe(10);
    expect(state.combat!.swindlerDeceit!.skipNext).toBe(false); expect(next.consequenceWeights).toBeNull();
  });

  it('suppresses each enemy template ability after its normal neutral draw, once only', () => {
    for (const [roll, gain, reduction] of [[1, 16, 0], [161, 0, 10], [241, 8, 0], [321, 0, 8], [381, 0, 0]]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
      const draws = scriptRolls(1, 46, 73, roll!, roll!, 1);
      const round = resolveSliceCombatRound(state, 'CONTROL').round;
      expect(round.moves[0]!.label).toContain('误导');
      expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 0, enemyReduction: 0 });
      expect(round.moves[2]).toMatchObject({ actor: 'ENEMY', selfGain: gain, enemyReduction: reduction });
      expect(round.moves[2]!.label).not.toContain('全部贡献归0'); expect(draws).toHaveBeenCalledTimes(6);
      vi.restoreAllMocks();
    }
  });

  it('uses core20/35/20/25, base450/corecap90, floor45 and max60 recovery, preserving noncombat state', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 249, 381, 1);
    const round = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(round.playerAdvantage).toBe((450 + 2 + 7 + 6 + 10) * 0.8); expect(state.spirituality).toBe(6);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    vi.restoreAllMocks(); const capped = fixture();
    capped.character.coreStats = { physique: 500, perception: 500, will: 500, knowledge: 500 };
    scriptRolls(1, 1, 249, 381, 1);
    expect(resolveSliceCombatRound(capped, 'CONTROL').round.playerAdvantage).toBe(540);
    vi.restoreAllMocks();
    vi.spyOn(cryptologistCombat, 'resolveCryptologistCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 249, 381, 1);
    expect(resolveSliceCombatRound(fixture(), 'CONTROL').round.playerAdvantage).toBe(45);
  });

  it('permits wounds only from a real body attack and cleans inherited context on surrender, retreat and death', () => {
    for (const ticket of [73, 121, 249, 374, 406]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      observeSwindlerEnemyAction(state, 'STRIKE');
      if (ticket === 406) scriptRolls(1, 1, ticket, 2, 381, 1);
      else scriptRolls(1, 1, ticket, 381, 1);
      const result = resolveSliceCombatRound(state, 'CONTROL');
      expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
      expect(state.combat!.enemyHealth).toBe(100); vi.restoreAllMocks();
    }
    const attacking = fixture(); observeSwindlerEnemyAction(attacking, 'STRIKE');
    scriptRolls(1, 1, 1, 381, 1, 66);
    expect(resolveSliceCombatRound(attacking, 'CONTROL').outcome).toBe('ENEMY_SURRENDERED');
    expect(attacking.combat!.enemyHealth).toBe(70); expect(attacking.combat!.swindlerDeceit).toBeUndefined();
    vi.restoreAllMocks();
    const retreating = fixture(), observations = createCryptologistRoundObservations(retreating); observe(retreating, observations);
    resolve(retreating, 'DECEIT', observations); resolve(retreating, 'MISDIRECT', observations);
    const spirit = retreating.spirituality; scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreating.combat!.swindlerDeceit).toBeUndefined(); expect(retreating.spirituality).toBe(spirit);
    vi.restoreAllMocks(); const dying = fixture(); observeSwindlerEnemyAction(dying, 'STRIKE');
    scriptRolls(1, 1, 121, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(dying, 'CONTROL').outcome).toBe('PLAYER_DEAD');
    expect(dying.health).toBe(0); expect(dying.combat!.swindlerDeceit).toBeUndefined();
  });

  it('retains S8 draw counts,300-base45-max and original combat output after widening inherited source eligibility', () => {
    const state = fixture(8), draws = scriptRolls(1, 1, 201, 381, 1);
    const round = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(round.playerAdvantage).toBe(315); expect(state.spirituality).toBe(45);
    expect(round.moves[0]!.label).toContain('两段式骗局'); expect(draws).toHaveBeenCalledTimes(5);
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(1);
    expect(cryptologistCombat.currentCryptologistCombatSource(state)).toBeNull();
  });

  it('replays persisted preparation and pending suppression exactly without serializing a new ledger', () => {
    for (const prepared of [true, false]) {
      const state = fixture(), observations = createCryptologistRoundObservations(state); observe(state, observations);
      resolve(state, 'DECEIT', observations); if (!prepared) resolve(state, 'DECEIT', observations);
      state.combat!.round = 2; state.random.cursor = 7;
      const restored = JSON.parse(JSON.stringify(state)) as SliceState;
      const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
      expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
      expect(Object.keys(state.combat!)).not.toContain('cryptologistObservations'); vi.restoreAllMocks();
    }
  });
});
