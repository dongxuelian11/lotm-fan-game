import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SLEEPLESS_COUNT_WHEEL, currentSleeplessNightSource, drawSleeplessAbility, isSleepless,
  resolveSleeplessCombatAbility, sleeplessAbilityWheel, sleeplessActionCount,
  type SleeplessNightSource, type SleeplessMoveId } from '../../src/domain/sleepless/combat.js';
import { currentClownDangerSource } from '../../src/domain/clown/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('sleepless-combat-test', sliceDefaultCreationSelection, 'sleepless-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'darkness', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.sleepless.encounter, { status: 'FIGHTING', observed: true, night: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: 'SLEEPLESS_WATCH', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SleeplessMoveId, source = currentSleeplessNightSource(state)) {
  return resolveSleeplessCombatAbility(state, id, 1, stream(state), source);
}
/** Assert deterministic stream consumption as well as the scripted values. */
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
afterEach(() => vi.restoreAllMocks());
const physicalIds = ['darkness.s9.night-vigor', 'darkness.s9.physical-follow-up'] as const;
const protectiveIds = ['darkness.s9.night-vision', 'darkness.s9.danger-sense'] as const;
const ids = [...physicalIds, ...protectiveIds, 'OBSERVE', 'ACCIDENT'] as const;
const oldEncounters = ['FIRST_CASE', 'CLOWN_RESCUE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE',
  'MAGICIAN_DISPUTE', 'PYROMANIAC_DISPUTE', 'PSYCHOLOGIST_DISPUTE', 'VAMPIRE_DISPUTE'] as const;

describe('Sleepless S9 exact I combat profile', () => {
  it('uses six confirmed sectors and four counts without higher-sequence powers', () => {
    const state = fixture();
    expect(isSleepless(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([25, 30, 25, 20]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(sleeplessAbilityWheel(null));
    expect(wheel.map(entry => entry.id)).toEqual(ids);
    expect(wheel.map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(wheel.some(entry => /poem|dream|sleep|spirit.attack|ritual/.test(entry.id))).toBe(false);
    wheel[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(25);
  });

  it('preserves every count and ability boundary with exactly one draw per wheel', () => {
    for (const [roll, count] of [[1, 1], [25, 1], [26, 2], [55, 2], [56, 3], [80, 3], [81, 4], [100, 4]]) {
      expect(sleeplessActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of sleeplessAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawSleeplessAbility(random, null)).toBe(entry.id);
      expect(drawSleeplessAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses only the existing ×1.25 stance ticket normalization', () => {
    for (const [stance, weights] of [
      ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]],
      ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, weight) => total + weight, 0);
      expect(sleeplessAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
    }
    expect(sleeplessAbilityWheel('RETREAT')).toEqual(sleeplessAbilityWheel(null));
  });

  it('uses base200, core10/35/30/25, cap40 and spirituality30 without a global night multiplier', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 379, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(227);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 379, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('does not borrow the new profile for ordinary people or other pathway sequences', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['moon', 8], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSleepless(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    expect(currentClownDangerSource(state)).toBeNull();
  });

  it('uses exact unrounded mastery budgets for every relevant contribution, with no passive cost or mastery gain', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 0;
      for (const id of ['darkness.s9.night-vigor', ...protectiveIds]) state.progression.mastery[id] = mastery;
      const before = structuredClone(state), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolveSleeplessCombatAbility(state, physicalIds[0], 1, random)).toMatchObject({ selfGain: 6.5 * f * 1.1, enemyReduction: 0, threatens: true });
      expect(resolveSleeplessCombatAbility(state, physicalIds[1], 0.8, random)).toMatchObject({ selfGain: 3.5 * f * 1.1 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveSleeplessCombatAbility(state, protectiveIds[0], 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 9.1 * f * 1.1, threatens: false });
      expect(resolveSleeplessCombatAbility(state, protectiveIds[1], 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 4.9 * f * 1.1, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('actual scheduled night and current local source', () => {
  it('binds only the observed Rafe, current attempt, night, visible body and ordinary courtyard exit', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentSleeplessNightSource(state)).toMatchObject({ encounterId: 'SLEEPLESS_WATCH',
      target: 'RAFE_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', time: 'SCHEDULED_NIGHT',
      space: 'OPEN_WAREHOUSE_COURTYARD', exit: 'ORDINARY_OPEN_EXIT', aggression: 'VISIBLE_SHORT_CLUB_THREAT' });
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.sleepless.encounter.observed = false; }, s => { s.sleepless.encounter.night = false; },
      s => { s.sleepless.encounter.status = 'RESOLVED'; },
      s => { s.sleepless.encounter.attemptWeek = null; },
      s => { s.sleepless.encounter.attemptWeek = s.week - 1; },
      s => { s.sleepless.encounter.startHistoryIndex = null; },
      s => { s.combat = null; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'DEAD'; }, s => { s.combat!.enemyStatus = 'SURRENDERED'; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.health = 0; },
      s => { s.status = 'DEAD'; }, s => { s.progression.sequence = 8; },
      s => { s.progression.pathwayId = 'moon'; },
    ];
    for (const mutate of mutations) {
      const candidate = fixture(); mutate(candidate);
      expect(currentSleeplessNightSource(candidate)).toBeNull();
    }
  });

  it('rejects forged or stale sources without RNG, cost, hidden facts or another action', () => {
    const state = fixture(), source = currentSleeplessNightSource(state)!;
    state.knowledge = [{ id: 'private', week: 1, title: 'SECRET', text: 'HIDDEN_TARGET_SECRET' }];
    const invalid: (SleeplessNightSource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: source.attemptWeek + 1 }, { ...source, startHistoryIndex: 100 },
      ...(['target', 'body', 'time', 'space', 'exit', 'aggression'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as SleeplessNightSource)];
    for (const input of invalid) for (const id of protectiveIds) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolveSleeplessCombatAbility(state, id, 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('改用格挡护身');
      expect(effect.label).not.toMatch(/HIDDEN_TARGET_SECRET|拉夫/);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('never infers night from an old encounter or a lamp, while physical body actions remain usable', () => {
    for (const encounterId of oldEncounters) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      const before = structuredClone(state);
      expect(currentSleeplessNightSource(state)).toBeNull();
      for (const [id, budget] of [[physicalIds[0], 6.5], [physicalIds[1], 3.5]] as const) {
        expect(resolve(state, id)).toMatchObject({ selfGain: budget * 0.65, threatens: true });
      }
      for (const id of protectiveIds) expect(resolve(state, id)).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false });
      expect(resolve(state, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    }
    const day = fixture(); day.sleepless.encounter.night = false;
    expect(resolve(day, physicalIds[0]).selfGain).toBe(6.5 * 0.65);
    expect(resolve(day, physicalIds[1]).selfGain).toBe(3.5 * 0.65);
    expect(resolve(day, protectiveIds[0]).enemyReduction).toBe(10);
  });

  it('keeps night observation at R0 and ±5 accidents unboosted and non-threatening', () => {
    for (const night of [true, false]) {
      const state = fixture(); state.sleepless.encounter.night = night;
      const before = structuredClone(state), random = stream(state);
      expect(resolveSleeplessCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0);
      scriptRolls(1, 2);
      expect(resolveSleeplessCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -5, enemyReduction: 0, threatens: false });
      expect(resolveSleeplessCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 5, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(2); expect(state).toEqual(before);
      vi.restoreAllMocks();
    }
  });

  it('never resolves or spends RNG on ended, dead, absent or wrong-pathway combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.progression.sequence = 8; },
    ]) {
      const state = fixture(); mutate(state);
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveSleeplessCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
    for (const factor of [0, -1, Number.NaN]) for (const id of physicalIds) {
      expect(resolveSleeplessCombatAbility(fixture(), id, factor, stream(fixture()))).toMatchObject({ selfGain: 0, threatens: false });
    }
  });
});

describe('ordinary original equipment and unchanged consequences', () => {
  it('uses the real held town club once instead of stacking budgets, and loses that benefit when put away', () => {
    const state = fixture(); state.progression.mastery['darkness.s9.night-vigor'] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state), armed = location === 'HAND';
      const effect = resolveSleeplessCombatAbility(state, physicalIds[0], 0.8, random);
      expect(effect.selfGain).toBe(armed ? 16 * 0.8 : 6.5 * 1.1 * 0.8);
      expect(resolve(state, physicalIds[1]).selfGain).toBe(3.5 * 1.1);
      expect(resolve(state, 'OBSERVE').selfGain).toBe(0);
      if (armed) {
        expect(effect.label).toContain('不叠加I主攻预算或夜间强化');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      } else expect(playerAbilityWheel(state, null)[0]!.label).toBe('身体打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    state.town.clubLocation = 'HAND'; state.sleepless.encounter.night = false;
    expect(resolve(state, physicalIds[0]).selfGain).toBe(16);
  });

  it('does not grant injury permission from holding a club, R0 or a positive accident', () => {
    for (const slot of [379, 411]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 379 ? scriptRolls(1, 1, slot, 400, 1) : scriptRolls(1, 1, slot, 2, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 379 ? 0 : 5);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 379 ? 5 : 6);
      vi.restoreAllMocks();
    }
  });

  it('retains all actual enemy actions and the one drawn fallback without granting AP, rest or extra turns', () => {
    const state = fixture(); state.sleepless.encounter.observed = false; state.spirituality = 10;
    const before = structuredClone(state);
    const draws = scriptRolls(1, 100, 151, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(1);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.moves[0]).toMatchObject({ enemyReduction: 10, selfGain: 0 });
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(13); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.combat!.round).toBe(2); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('keeps physical injury, named surrender and death without changing the old carrier or granting immunity', () => {
    const attacking = fixture(); attacking.world.carrierAlive = false; attacking.world.carrierCanResist = false;
    scriptRolls(1, 1, 1, 400, 1, 66);
    const attack = resolveSliceCombatRound(attacking, 'ATTACK');
    expect(attack.outcome).toBe('ENEMY_SURRENDERED');
    expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
    expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(attack.round.consequence).toContain('持棍拉夫仍然活着');
    expect(attack.round.consequence).not.toContain('携铃者');
    expect(attacking.world.carrierAlive).toBe(false); expect(attacking.world.carrierCanResist).toBe(false);
    vi.restoreAllMocks();
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 151, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(dying.injuries).toEqual([{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }]);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
  });

  it('uses ordinary retreat and preserves deterministic serialized replay without Math.random', () => {
    const retreating = fixture(); retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('持棍拉夫'); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
