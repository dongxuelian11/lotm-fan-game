import {LIGHTPRAYER_COUNT_WHEEL,lightprayerAbilityWheel} from '../../src/domain/lightprayer/combat.js';
import {SUNPRIEST_COUNT_WHEEL,sunpriestAbilityWheel} from '../../src/domain/sunpriest/combat.js';
import { PURE_WHITE_ANGEL_COUNT_WHEEL, pureWhiteAngelAbilityWheel } from '../../src/domain/pure-white-angel/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel, bardActionCount, createBardRoundContext,
  currentBardCombatSource, drawBardAbility, finishBardCombatRound, isBard,
  resolveBardCombatAbility, type BardCombatSource, type BardMoveId, type BardRoundContext,
} from '../../src/domain/bard/combat.js';
import { SAILOR_COUNT_WHEEL, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import { READER_COUNT_WHEEL, readerAbilityWheel } from '../../src/domain/reader/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'sun.s9.praise', support = 'CHORUS_SUPPORT';
const morale = 'sun.s9.courage', control = 'BREAK_FEAR';
const ids = [primary, support, morale, control, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('bard-combat-test', sliceDefaultCreationSelection, 'bard-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'sun', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: BardMoveId, context = createBardRoundContext(state), factor = 1) {
  return resolveBardCombatAbility(state, id, factor, stream(state), context);
}
/** Keep the real cursor consumption while scripting the shared random stream. */
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

describe('Bard S9 confirmed Sun D-profile', () => {
  it('selects exact 32/18/12/10/8/20 slots and independent 35/30/20/15 counts', () => {
    const state = fixture();
    expect(isBard(state)).toBe(true);
    expect(bardAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(bardAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(bardAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 30, 20, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(35);
  });

  it('preserves every count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [65, 2], [66, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(bardActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of bardAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawBardAbility(random, null)).toBe(entry.id);
      expect(drawBardAbility(random, null)).toBe(entry.id);
      expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only selected stance slots with exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [160, 90, 48, 40, 32, 80]],
      ['DEFEND', [128, 72, 60, 40, 32, 80]],
      ['CONTROL', [128, 72, 48, 50, 32, 80]],
      ['PREPARE', [128, 72, 48, 40, 40, 80]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(bardAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => value / total * 100));
    }
    expect(bardAbilityWheel('RETREAT')).toEqual(bardAbilityWheel(null));
  });

  it('uses base200, core20/30/25/25, cap40 and spirituality30 with shared penalties', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(225.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('keeps ordinary and existing pathway profiles unchanged outside Sun S9', () => {
    const state = fixture();
    for (const sequence of [8,7,6] as const) {
      state.progression.pathwayId='sun';state.progression.sequence=sequence;
      expect(isBard(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(sequence===8?LIGHTPRAYER_COUNT_WHEEL:SUNPRIEST_COUNT_WHEEL);
      expect(playerAbilityWheel(state,'CONTROL')).toEqual(sequence===8?lightprayerAbilityWheel('CONTROL'):sunpriestAbilityWheel('CONTROL',sequence));
    }
    state.progression.pathwayId = 'sun'; state.progression.sequence = 1;
    expect(isBard(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(PURE_WHITE_ANGEL_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(pureWhiteAngelAbilityWheel(state, 'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['sun', 0], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isBard(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'tyrant'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'white-tower';
    expect(playerCountWheel(state)).toEqual(READER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(readerAbilityWheel('DEFEND'));
  });
});

describe('actual short praise, finite self-support and ordinary target boundaries', () => {
  it('uses exact unrounded 11.7f/6.3f/5.2f/2.8f and the correct two mastery identities', () => {
    for (const mastery of [0, 125, 250, 500]) {
      const state = fixture();
      state.progression.mastery = { [primary]: mastery, [morale]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, context = createBardRoundContext(state);
      expect(resolve(state, primary).selfGain).toBe(11.7 * factor);
      expect(resolve(state, support, context)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(context.pendingSupportBudgets).toEqual([6.3 * factor]);
      expect(resolve(state, morale).enemyReduction).toBe(5.2 * factor);
      expect(resolve(state, control).enemyReduction).toBe(2.8 * factor);
    }
    const state = fixture(); state.progression.mastery = { [primary]: 500, [morale]: 0 };
    expect(resolve(state, primary).selfGain).toBe(11.7);
    expect(resolve(state, morale).enemyReduction).toBe(5.2 * 0.65);
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[primary] = mastery;
      expect(resolve(state, primary).selfGain).toBe(11.7 * (mastery === 800 ? 1 : 0.65));
    }
  });

  it('uses only the current visible ordinary human and the active player as the speaker/listener', () => {
    const state = fixture(), context = createBardRoundContext(state), before = structuredClone(state);
    expect(context.source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', nature: 'ORDINARY_HUMAN',
      sunVulnerable: false, speaker: 'CURRENT_ACTIVE_PLAYER', voice: 'ORDINARY_UNRESTRICTED_SHORT_PHRASE', listeners: 'SELF_ONLY' });
    for (const id of [primary, support, morale, control] as const) {
      const result = resolve(state, id, context);
      expect(result.label).toContain('实际唱出');
    }
    expect(state).toEqual(before);
    expect(resolve(state, primary).selfGain).toBe(11.7 * 0.65);
    expect(resolve(state, primary).label).toContain('普通携铃者没有太阳易伤');
  });

  it('rejects stale, fabricated, remote, non-speaking and phantom-ally source snapshots', () => {
    const state = fixture(), source = currentBardCombatSource(state)!;
    const tampered: BardCombatSource[] = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' } as unknown as BardCombatSource,
      { ...source, target: 'OLD_CASE' } as unknown as BardCombatSource,
      { ...source, nature: 'UNDEAD' } as unknown as BardCombatSource,
      { ...source, sunVulnerable: true } as unknown as BardCombatSource,
      { ...source, speaker: 'INVENTED_HELPER' } as unknown as BardCombatSource,
      { ...source, voice: 'SILENCED' } as unknown as BardCombatSource,
      { ...source, listeners: 'INVENTED_ALLIES' } as unknown as BardCombatSource,
    ];
    for (const badSource of [null, ...tampered]) {
      for (const id of ids) {
        const context: BardRoundContext = { source: badSource, pendingSupportBudgets: [], finished: false };
        const random = stream(state), before = structuredClone(state);
        expect(resolveBardCombatAbility(state, id, 1, random, context)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(context.pendingSupportBudgets).toEqual([]); expect(random.cursor).toBe(0);
        expect(state).toEqual(before);
      }
    }
  });

  it('cannot use the prior scene after location, lifecycle or target availability changes', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 8; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), context = createBardRoundContext(state);
      resolve(state, support, context); mutate(state);
      expect(currentBardCombatSource(state)).toBeNull();
      expect(resolve(state, primary, context)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(finishBardCombatRound(context)).toContain('攻击加成0');
    }
  });

  it('applies support only on the next real main attack, without immediate advantage or an invented ally', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    const context = createBardRoundContext(state), random = stream(state), before = structuredClone(state);
    const queued = resolveBardCombatAbility(state, support, 1, random, context);
    expect(queued).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(queued.label).toContain('只待本人本轮下一次合法身体攻击');
    resolveBardCombatAbility(state, morale, 1, random, context);
    resolveBardCombatAbility(state, control, 1, random, context);
    resolveBardCombatAbility(state, 'OBSERVE', 1, random, context);
    expect(context.pendingSupportBudgets).toEqual([6.3]);
    const attack = resolveBardCombatAbility(state, primary, 1, random, context);
    expect(attack).toMatchObject({ selfGain: 18, enemyReduction: 0, threatens: true });
    expect(attack.label).toContain('消耗本轮1次歌颂支援');
    expect(context.pendingSupportBudgets).toEqual([]);
    expect(resolve(state, primary, context).selfGain).toBe(11.7);
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });

  it('adds each repeated support slot original budget once, never multiplying or recomputing it', () => {
    const state = fixture(), context = createBardRoundContext(state);
    resolve(state, support, context);
    state.progression.mastery[primary] = 500; resolve(state, support, context);
    state.progression.mastery[primary] = 250; resolve(state, support, context);
    const expected = [6.3 * 0.65, 6.3, 6.3 * (0.65 + 0.35 * 250 / 500)];
    expect(context.pendingSupportBudgets).toEqual(expected);
    state.progression.mastery[primary] = 0;
    const attack = resolve(state, primary, context);
    expect(attack.selfGain).toBe(11.7 * 0.65 + expected.reduce((sum, budget) => sum + budget, 0));
    expect(attack.label).toContain('消耗本轮3次');
    expect(context.pendingSupportBudgets).toEqual([]);
    expect(resolve(state, primary, context).selfGain).toBe(11.7 * 0.65);
  });

  it('does not consume support on an ineffective physical slot and clamps the physical factor', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    const context = createBardRoundContext(state); resolve(state, support, context);
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolve(state, primary, context, factor)).toMatchObject({ selfGain: 0, threatens: false });
      expect(context.pendingSupportBudgets).toEqual([6.3]);
    }
    expect(resolve(state, primary, context, 0.8).selfGain).toBe(11.7 * 0.8 + 6.3);
    expect(resolve(state, primary, context, 3).selfGain).toBe(11.7);
  });

  it('only a club actually in HAND replaces the main budget with16 and does not multiply support', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const context = createBardRoundContext(state), armed = location === 'HAND';
      expect(resolve(state, primary, context, 0.8).selfGain).toBe((armed ? 16 : 11.7) * 0.8);
      resolve(state, support, context);
      const attack = resolve(state, primary, context, 0.8);
      expect(attack.selfGain).toBe((armed ? 16 : 11.7) * 0.8 + 6.3);
      if (armed) {
        expect(attack.label).toContain('替换而不叠加歌颂主攻预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      }
    }
  });

  it('expires unconsumed budgets at round end and cannot reuse a context across rounds', () => {
    const state = fixture(), context = createBardRoundContext(state);
    resolve(state, support, context); resolve(state, support, context);
    expect(finishBardCombatRound(context)).toContain('本轮2次歌颂支援');
    expect(context.pendingSupportBudgets).toEqual([]);
    expect(resolve(state, primary, context).selfGain).toBe(0);
    expect(finishBardCombatRound(context)).toBeNull();
    const stale = createBardRoundContext(state); resolve(state, support, stale);
    state.combat!.round += 1;
    expect(resolve(state, primary, stale).selfGain).toBe(0);
    const fresh = createBardRoundContext(state);
    expect(fresh.pendingSupportBudgets).toEqual([]);
    expect(resolve(state, primary, fresh).selfGain).toBe(11.7 * 0.65);
    expect(finishBardCombatRound(fresh)).toBeNull();
  });

  it('only reduces ordinary current morale pressure without injury healing, mind reset or enemy obedience', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 35;
    state.progression.mastery = { [primary]: 500, [morale]: 500 };
    const before = structuredClone(state);
    expect(resolve(state, morale)).toMatchObject({ selfGain: 0, enemyReduction: 5.2, threatens: false });
    expect(resolve(state, morale).label).toContain('不清除污染');
    expect(resolve(state, control)).toMatchObject({ selfGain: 0, enemyReduction: 2.8, threatens: false });
    expect(resolve(state, control).label).toContain('不操纵敌人、不强制皈依');
    expect(state).toEqual(before);
  });

  it('prepares at zero and draws exact ±5 accidents without granting an attack', () => {
    const state = fixture(), context = createBardRoundContext(state);
    const prepare = resolve(state, 'OBSERVE', context);
    expect(prepare).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(prepare.label).toContain('尚未唱出'); expect(context.pendingSupportBudgets).toEqual([]);
    for (const roll of [1, 2]) {
      const draw = scriptRolls(roll), random = stream(state);
      expect(resolveBardCombatAbility(state, 'ACCIDENT', 1, random, context)).toMatchObject({
        selfGain: roll === 1 ? -5 : 5, enemyReduction: 0, threatens: false,
      });
      expect(draw).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });
});

describe('shared round consumes ordinary support without another action queue', () => {
  it('records support0 then its consumption on the next real main with exactly the drawn action count', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    const draw = scriptRolls(36, 1, 161, 400, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(2); expect(round.enemyCount).toBe(1);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(round.moves[2]).toMatchObject({ selfGain: 18, enemyReduction: 0 });
    expect(round.playerAdvantage).toBe(233); expect(round.enemyAdvantage).toBe(114);
    expect(round.moves[2]!.label).toContain('消耗本轮1次');
    expect(round.consequence).not.toContain('支援未等到');
    expect(draw).toHaveBeenCalledTimes(7); expect(state.random.cursor).toBe(7);
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });

  it('lets a support-only round expire with no physical consequence or free advantage, then starts fresh', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    const draw = scriptRolls(1, 1, 161, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(215);
    expect(round.playerCount).toBe(1); expect(round.moves).toHaveLength(2);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyInjuries).toEqual([]);
    expect(round.consequence).toContain('攻击加成0'); expect(round.consequence).toContain('不结转');
    expect(draw).toHaveBeenCalledTimes(5); expect(state.combat!.enemyStatus).toBe('RESISTING');
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 1, 1, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(next.first).toBe('ENEMY');
    expect(next.moves.find(move => move.actor === 'PLAYER')!.selfGain).toBe(11.7);
  });

  it('combines repeated original support budgets on one actual attack and expires late support separately', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    const draw = scriptRolls(86, 1, 161, 400, 161, 1, 161, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    const player = round.moves.filter(move => move.actor === 'PLAYER');
    expect(player).toHaveLength(4);
    expect(player.map(move => move.selfGain)).toEqual([0, 0, 11.7 + (6.3 + 6.3), 0]);
    expect(player[2]!.label).toContain('消耗本轮2次');
    expect(round.consequence).toContain('本轮1次歌颂支援未等到');
    expect(draw).toHaveBeenCalledTimes(9);
  });

  it('does not turn singing into automatic surrender, mental damage, holy attacks or forced conversion', () => {
    const state = fixture(); state.combat!.enemyMind = 20;
    state.progression.mastery[morale] = 500;
    const draw = scriptRolls(36, 1, 249, 400, 249, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction)).toEqual([2.8, 2.8]);
    expect(state.combat).toMatchObject({ enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 20, enemyInjuries: [] });
    expect(draw).toHaveBeenCalledTimes(6);
    expect(round.moves.every(move => !/圣光攻击|神圣之水|皈依成功|控制权转移/.test(move.label))).toBe(true);
  });

  it('uses the original ordinary retreat with no extra song, supernatural exit or second actor', () => {
    const state = fixture(), draw = scriptRolls(86, 100, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.retreat).toBe('SUCCESS');
    expect(round.moves).toEqual([]); expect(draw).toHaveBeenCalledTimes(3);
    expect(state.combat).not.toHaveProperty('pendingSupportBudgets');
  });
});
