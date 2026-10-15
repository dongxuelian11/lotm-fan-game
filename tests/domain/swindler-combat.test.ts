import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { MARAUDER_COUNT_WHEEL, marauderAbilityWheel } from '../../src/domain/marauder/combat.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SWINDLER_COUNT_WHEEL, consumeSwindlerMisdirection, currentSwindlerCombatSource,
  drawSwindlerAbility, isSwindler, observeSwindlerEnemyAction, resolveSwindlerCombatAbility,
  swindlerAbilityWheel, swindlerActionCount, type SwindlerActionRemainder,
  type SwindlerCombatSource, type SwindlerMoveId } from '../../src/domain/swindler/combat.js';
import * as swindlerCombat from '../../src/domain/swindler/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const agility = 'error.s9.agility', dexterity = 'error.s9.dexterity', theft = 'error.s9.theft', deceit = 'error.s8.deceit';
const ids = ['BODY_STRIKE', 'MISDIRECT', 'COVER', 'DECEIT', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('swindler-combat-test', sliceDefaultCreationSelection, 'swindler-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'error', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: SwindlerMoveId, remaining: SwindlerActionRemainder = { PLAYER: 0, ENEMY: 1 }, physical = 1) {
  return resolveSwindlerCombatAbility(state, id, physical, stream(state), remaining);
}
function observe(state: SliceState) { observeSwindlerEnemyAction(state, 'STRIKE'); }
/** Advance the real cursor even when selecting exact tickets. Unexpected draws fail. */
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

describe('Swindler S8 Error V1 exact profile', () => {
  it('routes only error8, preserving S9 and ordinary public profiles', () => {
    const state = fixture();
    expect(isSwindler(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(SWINDLER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(swindlerAbilityWheel(null, state));
    expect(swindlerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(swindlerAbilityWheel(null).map(entry => entry.weight)).toEqual([24, 14, 12, 8, 10, 32]);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([12, 18, 25, 28, 17]);
    expect(SWINDLER_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.2);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(24); expect(playerCountWheel(state)[0]!.weight).toBe(12);
    state.progression.sequence = 9;
    expect(isSwindler(state)).toBe(false); expect(playerCountWheel(state)).toEqual(MARAUDER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(marauderAbilityWheel(null, state));
    state.progression = { pathwayId: null, sequence: null, mastery: {}, acting: 0, promotionWeek: null };
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(ordinaryAbilityWheel(false, null));
  });

  it('preserves count endpoints and exact x1.25 stance tickets with one draw', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [30, 2], [31, 3], [55, 3], [56, 4], [83, 4], [84, 5], [100, 5]]) {
      expect(swindlerActionCount(roll!)).toBe(count);
    }
    for (const [stance, weights] of [
      [null, [96, 56, 48, 32, 40, 128]], ['ATTACK', [120, 70, 48, 32, 40, 128]],
      ['DEFEND', [96, 56, 60, 32, 40, 128]], ['CONTROL', [96, 56, 48, 40, 40, 128]],
      ['PREPARE', [96, 56, 48, 32, 50, 128]], ['RETREAT', [96, 56, 48, 32, 40, 128]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(swindlerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => total === 400 ? value / 4 : value / total * 100));
      let lower = 1;
      weights.forEach((weight, index) => {
        for (const roll of [lower, lower + weight - 1]) {
          const random = stream(fixture()), draws = scriptRolls(roll);
          expect(drawSwindlerAbility(random, stance)).toBe(ids[index]);
          expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
        }
        lower += weight;
      });
    }
  });

  it('shows prerequisites, costs, shared K/R preparation and no immediate action before drawing', () => {
    const state = fixture();
    let wheel = playerAbilityWheel(state, 'CONTROL');
    expect(wheel[1]!.label).toContain('耗1灵性'); expect(wheel[1]!.label).toContain('当前前置不足');
    for (const index of [3, 4]) {
      expect(wheel[index]!.label).toContain('K/R共用两段'); expect(wheel[index]!.label).toContain('尚无已发生');
      expect(wheel[index]!.label).toContain('0即时贡献'); expect(wheel[index]!.label).toContain('不额外立即行动');
    }
    observe(state); resolve(state, 'DECEIT'); state.spirituality = 0;
    wheel = playerAbilityWheel(state, null);
    expect(wheel[3]!.label).toContain('已准备'); expect(wheel[3]!.label).toContain('耗1灵性');
    expect(wheel[3]!.label).toContain('当前不足'); expect(wheel[1]!.label).toContain('当前灵性不足');
  });
});

describe('real physical budgets and source boundary', () => {
  it('uses H15.6f and B9.75f, original agility mastery, no mechanism bonus or resource fee', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[agility] = mastery;
      const f = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(15.6 * f);
      expect(resolve(state, 'COVER')).toMatchObject({ selfGain: 0, enemyReduction: 9.75 * f, threatens: false });
      expect(state).toEqual(before);
      state.progression.mastery[dexterity] = 500; state.progression.mastery[theft] = 500; state.progression.mastery[deceit] = 500;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(15.6 * f);
      expect(resolve(state, 'COVER').enemyReduction).toBe(9.75 * f);
    }
  });

  it('clamps mastery/physical input and only grants threat for an actual positive body attack', () => {
    const state = fixture();
    for (const mastery of [-1, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[agility] = mastery;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(15.6 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolve(state, 'BODY_STRIKE', undefined, physical)).toMatchObject({ selfGain: 0, threatens: false });
    }
    expect(resolve(state, 'BODY_STRIKE', undefined, 0.8).selfGain).toBe(15.6 * 0.8);
    expect(resolve(state, 'BODY_STRIKE', undefined, 2).selfGain).toBe(15.6);
  });

  it('uses a currently held original club16 replacement, including Simon custody, without duplicating it', () => {
    const state = fixture(); state.progression.mastery[agility] = 500;
    state.town.clubLocation = 'BAG'; expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(15.6);
    state.town.clubLocation = 'HAND'; expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(16);
    state.town.clubLocation = 'BAG';
    state.marauder.dispute.weapon.custodian = 'PLAYER'; state.marauder.dispute.weapon.location = 'PLAYER_HAND';
    const before = structuredClone(state.marauder.dispute.weapon);
    expect(resolve(state, 'BODY_STRIKE', undefined, 0.8).selfGain).toBe(16 * 0.8);
    expect(resolve(state, 'BODY_STRIKE').label).toContain('所有权仍属塞蒙');
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握塞蒙原短棍打击');
    expect(state.marauder.dispute.weapon).toEqual(before);
  });

  it('rejects stale/forged sources, other encounters, nonliving and noncommunicable targets before all effects', () => {
    const state = fixture(), source = currentSwindlerCombatSource(state)!;
    const tampered = [null, { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 }, { ...source, target: 'HIDDEN_TARGET' },
      { ...source, nature: 'HIGH_SEQUENCE' }, { ...source, body: 'UNREACHABLE' },
      { ...source, speech: 'UNKNOWN_MIND' }, { ...source, space: 'OTHER' }, { ...source, exit: 'INVENTED_EXIT' },
    ] as (SwindlerCombatSource | null)[];
    for (const value of tampered) {
      const before = structuredClone(state), random = stream(state), remaining = { PLAYER: 1, ENEMY: 1 };
      for (const id of ids) {
        const effect = resolveSwindlerCombatAbility(state, id, 1, random, remaining, value);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_TARGET|HIGH_SEQUENCE|UNKNOWN_MIND|INVENTED_EXIT/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(remaining).toEqual({ PLAYER: 1, ENEMY: 1 });
    }
    for (const mutation of [
      (s: SliceState) => { s.combat!.encounterId = 'MARAUDER_DISPUTE'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.combat!.enemyMind = Number.NaN; }, (s: SliceState) => { s.health = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.progression.sequence = 9; },
    ]) {
      const altered = fixture(); mutation(altered); const before = structuredClone(altered);
      expect(currentSwindlerCombatSource(altered)).toBeNull(); observe(altered);
      expect(consumeSwindlerMisdirection(altered)).toBeNull(); expect(altered).toEqual(before);
    }
  });

  it('does not invent an observed gap from high mastery, old knowledge, narrative objects or a future action', () => {
    const state = fixture(); state.progression.mastery[deceit] = 500;
    state.knowledge.push({ id: 'old', week: 1, title: '旧事', text: 'HIDDEN_KNOWLEDGE' });
    state.world.bellAtScene = true; state.world.bellHolder = 'CARRIER';
    const before = structuredClone(state);
    observeSwindlerEnemyAction(state, 'FUTURE_SECRET_ABILITY');
    for (const id of ['MISDIRECT', 'DECEIT', 'OBSERVE'] as const) {
      expect(resolve(state, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual(before);
    for (const id of ['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS']) {
      const fresh = fixture(); observeSwindlerEnemyAction(fresh, id);
      expect(fresh.combat!.swindlerDeceit).toEqual({ observed: true, prepared: false, skipNext: false });
    }
  });

  it('uses exact ±7.5 accidents with no injury, preparation, suppression or resource effects', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state), remaining = { PLAYER: 0, ENEMY: 1 };
    const draws = scriptRolls(1, 2);
    expect(resolveSwindlerCombatAbility(state, 'ACCIDENT', 1, random, remaining)).toMatchObject({ selfGain: -7.5, threatens: false });
    expect(resolveSwindlerCombatAbility(state, 'ACCIDENT', 1, random, remaining)).toMatchObject({ selfGain: 7.5, threatens: false });
    expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before); expect(remaining).toEqual({ PLAYER: 0, ENEMY: 1 });
  });
});

describe('observed two-hit deception and next actual ability failure', () => {
  it('lets K and R prepare and complete each other across rounds, preserving total remaining and charging only completion', () => {
    for (const [first, second] of [['DECEIT', 'DECEIT'], ['DECEIT', 'OBSERVE'], ['OBSERVE', 'DECEIT'], ['OBSERVE', 'OBSERVE']] as const) {
      const state = fixture(), remaining = { PLAYER: 0, ENEMY: 2 }; observe(state);
      expect(resolve(state, first, remaining)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: true, skipNext: false });
      expect(state.spirituality).toBe(45); expect(remaining).toEqual({ PLAYER: 0, ENEMY: 2 });
      state.combat!.round += 1;
      const effect = resolve(state, second, remaining);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(remaining).toEqual({ PLAYER: 1, ENEMY: 1 }); expect(remaining.PLAYER + remaining.ENEMY).toBe(2);
      expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: false, skipNext: true });
      expect(state.spirituality).toBe(44); expect(effect.label).toContain('45→44'); expect(effect.label).toContain('不立即追加行动');
      resolve(state, first, remaining);
      expect(state.combat!.swindlerDeceit!.prepared).toBe(true); expect(state.spirituality).toBe(44);
    }
  });

  it('keeps preparation without phantom transfers when the enemy has no remaining slot or cost cannot be paid', () => {
    for (const [spirit, enemy] of [[45, 0], [0, 1], [0.5, 1], [Number.NaN, 1]]) {
      const state = fixture(); observe(state); resolve(state, 'DECEIT'); state.spirituality = spirit!;
      const before = structuredClone(state), remaining = { PLAYER: 0, ENEMY: enemy! }, random = stream(state);
      const effect = resolveSwindlerCombatAbility(state, 'OBSERVE', 1, random, remaining);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(remaining).toEqual({ PLAYER: 0, ENEMY: enemy! });
    }
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); observe(state); resolve(state, 'DECEIT'); const before = structuredClone(state);
      resolve(state, 'DECEIT', { PLAYER: 0, ENEMY: value }); expect(state).toEqual(before);
    }
  });

  it('J charges1 only after real observation, never draws an invented success wheel, and does not stack pending failures', () => {
    const state = fixture(), remaining = { PLAYER: 1, ENEMY: 2 }, random = stream(state);
    expect(resolve(state, 'MISDIRECT').label).toContain('尚未发生'); observe(state);
    const before = structuredClone(state), effect = resolveSwindlerCombatAbility(state, 'MISDIRECT', 1, random, remaining);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('45→44'); expect(random.cursor).toBe(0); expect(state.spirituality).toBe(44);
    expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: false, skipNext: true });
    expect(state.world).toEqual(before.world); expect(state.knowledge).toEqual(before.knowledge);
    expect(state.progression).toEqual(before.progression); expect(remaining).toEqual({ PLAYER: 1, ENEMY: 2 });
    const pending = structuredClone(state); expect(resolve(state, 'MISDIRECT').label).toContain('不重复付费'); expect(state).toEqual(pending);
    expect(consumeSwindlerMisdirection(state)).toContain('全部贡献归0');
    expect(consumeSwindlerMisdirection(state)).toBeNull(); expect(state.spirituality).toBe(44);
    state.spirituality = 0; const empty = structuredClone(state);
    expect(resolve(state, 'MISDIRECT').label).toContain('灵性不足'); expect(state).toEqual(empty);
  });
});

describe('shared interleaving, suppression, consequences and replay', () => {
  it('observes only after an actual enemy action and retains first-hit preparation into the next round', () => {
    const state = fixture(); const draws = scriptRolls(13, 100, 201, 1, 241, 161, 381, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'ENEMY']);
    expect(round.moves[0]!.label).toContain('不建立骗局准备'); expect(round.moves[2]!.label).toContain('第一次有效命中');
    expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: true, skipNext: false });
    expect(state.spirituality).toBe(45); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(8);
    vi.restoreAllMocks();
    const nextDraws = scriptRolls(1, 100, 241, 201, 161, 153, 1);
    const next = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(next.first).toBe('ENEMY'); expect(next.playerCount).toBe(1); expect(next.enemyCount).toBe(3);
    expect(next.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(next.moves[1]!.label).toContain('敌2→1、我0→1');
    expect(next.moves[2]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(next.moves[2]!.label).toContain('本次全部贡献归0'); expect(next.moves[3]!.enemyReduction).toBe(9.75 * 0.65);
    expect(next.moves.length).toBe(next.playerCount + next.enemyCount); expect(nextDraws).toHaveBeenCalledTimes(7);
  });

  it('never draws a stolen final enemy slot and defers the pending failure until the next actual round action', () => {
    const state = fixture(); observe(state); resolve(state, 'DECEIT');
    const draws = scriptRolls(1, 1, 201, 153, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'PLAYER']);
    expect(round.moves[0]!.label).toContain('敌1→0、我0→1'); expect(draws).toHaveBeenCalledTimes(5);
    expect(state.combat!.swindlerDeceit).toEqual({ observed: true, prepared: false, skipNext: true });
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 153, 1);
    const next = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(next.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 0, enemyReduction: 0 });
    expect(next.moves[0]!.label).toContain('一次失效已用尽'); expect(state.combat!.swindlerDeceit!.skipNext).toBe(false);
    expect(next.consequenceWeights).toBeNull();
  });

  it('suppresses every ordinary ability exactly once, including negative contribution, without applying player stance to enemies', () => {
    for (const [roll, nextGain, nextReduction] of [[1, 16, 0], [161, 0, 10], [241, 8, 0], [321, 0, 8], [381, 0, 0]]) {
      const state = fixture(); observe(state);
      const draws = scriptRolls(1, 46, 97, roll!, roll!, 1);
      const { round } = resolveSliceCombatRound(state, 'CONTROL');
      expect(round.moves[0]!.label).toContain('误导');
      expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 0, enemyReduction: 0 });
      expect(round.moves[2]).toMatchObject({ actor: 'ENEMY', selfGain: nextGain, enemyReduction: nextReduction });
      expect(round.moves[2]!.label).not.toContain('全部贡献归0'); expect(draws).toHaveBeenCalledTimes(6);
      expect(round.consequenceWeights).toBeNull(); vi.restoreAllMocks();
    }
  });

  it('uses core25/35/20/20, base300, corecap60 and max45 recovery, without changing noncombat state', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 201, 381, 1);
    const round = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(round.playerAdvantage).toBe((300 + 2.5 + 7 + 6 + 8) * 0.8); expect(state.spirituality).toBe(4.5);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    vi.restoreAllMocks(); const capped = fixture();
    capped.character.coreStats = { physique: 500, perception: 500, will: 500, knowledge: 500 };
    scriptRolls(1, 1, 201, 381, 1);
    expect(resolveSliceCombatRound(capped, 'CONTROL').round.playerAdvantage).toBe(360);
  });

  it('retains the S8 advantage floor30 after extreme accumulated negative contribution', () => {
    vi.spyOn(swindlerCombat, 'resolveSwindlerCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 201, 381, 1);
    expect(resolveSliceCombatRound(fixture(), 'CONTROL').round.playerAdvantage).toBe(30);
  });

  it('does not authorize injury from mechanisms, cover or accidents, and keeps actual body attack consequences', () => {
    for (const ticket of [97, 153, 201, 241, 281]) {
      const state = fixture(); state.town.clubLocation = 'HAND'; observe(state);
      if (ticket === 281) scriptRolls(1, 1, ticket, 2, 381, 1);
      else scriptRolls(1, 1, ticket, 381, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
      expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
      vi.restoreAllMocks();
    }
    const state = fixture(); observe(state); resolve(state, 'DECEIT');
    scriptRolls(1, 1, 1, 381, 1, 66);
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(state.combat!.enemyHealth).toBe(70);
    expect(state.combat!.swindlerDeceit).toBeUndefined();
  });

  it('clears prepared and pending effects on ordinary50% retreat or death, with no extra action or escape route', () => {
    const state = fixture(); observe(state); resolve(state, 'DECEIT'); resolve(state, 'MISDIRECT'); const spirit = state.spirituality;
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(state.combat!.swindlerDeceit).toBeUndefined(); expect(state.spirituality).toBe(spirit);
    vi.restoreAllMocks(); const dying = fixture(); observe(dying); resolve(dying, 'DECEIT');
    scriptRolls(1, 1, 153, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(dying, 'CONTROL').outcome).toBe('PLAYER_DEAD');
    expect(dying.health).toBe(0); expect(dying.combat!.swindlerDeceit).toBeUndefined();
  });

  it('round-trips persistent preparation and pending suppression with deterministic exact replay', () => {
    for (const prepared of [true, false]) {
      const state = fixture(); observe(state); resolve(state, 'DECEIT');
      if (!prepared) resolve(state, 'DECEIT');
      state.combat!.round = 2; state.random.cursor = 7;
      const restored = JSON.parse(JSON.stringify(state)) as SliceState;
      const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
      expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });
});
