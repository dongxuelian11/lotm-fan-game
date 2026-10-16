import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { MIDNIGHT_COUNT_WHEEL, currentMidnightNightSource, currentMidnightPoemSource,
  drawMidnightAbility, isMidnight, midnightAbilityWheel, midnightActionCount,
  resolveMidnightCombatAbility, type MidnightMoveId,
  type MidnightNightSource } from '../../src/domain/midnight/combat.js';
import { isSleepless, SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel } from '../../src/domain/sleepless/combat.js';
import { currentClownDangerSource } from '../../src/domain/clown/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('midnight-combat-test', sliceDefaultCreationSelection, 'midnight-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'darkness', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.midnight.encounter, { status: 'FIGHTING', observed: true, bystanderCleared: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: 'MIDNIGHT_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: MidnightMoveId, source = currentMidnightNightSource(state)) {
  return resolveMidnightCombatAbility(state, id, 1, stream(state), source);
}
/** Preserve the real cursor progression while making each individual draw explicit. */
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
const physicalIds = ['darkness.s8.physical-training', 'darkness.s8.physical-follow-up'] as const;
const ids = [...physicalIds, 'darkness.s8.self-protection', 'darkness.s8.poetry', 'OBSERVE', 'ACCIDENT'] as const;
const oldEncounters = ['FIRST_CASE', 'CLOWN_RESCUE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE',
  'MAGICIAN_DISPUTE', 'PYROMANIAC_DISPUTE', 'PSYCHOLOGIST_DISPUTE', 'VAMPIRE_DISPUTE', 'SLEEPLESS_WATCH'] as const;

describe('Midnight Poet S8 exact C combat profile', () => {
  it('uses the confirmed six slots and five counts without fear or dream abilities', () => {
    const state = fixture();
    expect(isMidnight(state)).toBe(true); expect(isSleepless(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(MIDNIGHT_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([20, 25, 25, 20, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(midnightAbilityWheel(null));
    expect(wheel.map(entry => entry.id)).toEqual(ids);
    expect(wheel.map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(wheel.some(entry => /fear|dream|spirit.attack|ritual/.test(entry.id))).toBe(false);
    wheel[0]!.weight = 0; const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(20);
  });

  it('preserves every count and exact neutral ticket boundary with one draw per wheel', () => {
    for (const [roll, count] of [[1, 1], [20, 1], [21, 2], [45, 2], [46, 3], [70, 3], [71, 4], [90, 4], [91, 5], [100, 5]]) {
      expect(midnightActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of midnightAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawMidnightAbility(random, null)).toBe(entry.id);
      expect(drawMidnightAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2); vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses only exact ×1.25 stance tickets and never biases accident slots', () => {
    for (const [stance, weights] of [
      ['ATTACK', [100, 75, 80, 120, 32, 28]],
      ['DEFEND', [80, 60, 100, 120, 32, 28]],
      ['CONTROL', [80, 60, 80, 150, 32, 28]],
      ['PREPARE', [80, 60, 80, 120, 40, 28]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(midnightAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawMidnightAbility(random, stance)).toBe(ids[index]);
        expect(drawMidnightAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    expect(midnightAbilityWheel('RETREAT')).toEqual(midnightAbilityWheel(null));
  });

  it('uses base300, core10/30/35/25, cap60 and spirituality45 without globally boosting the base at night', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 376, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(327.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('retains the exact S9 I wheel and does not grant the S8 profile to other pathways', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(isMidnight(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(sleeplessAbilityWheel(null));
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['moon', 8], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isMidnight(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    expect(currentClownDangerSource(state)).toBeNull();
  });

  it('uses unrounded physical mastery budgets without charging, training or borrowing S9 mastery', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery['darkness.s8.physical-training'] = mastery;
      state.progression.mastery['darkness.s9.night-vigor'] = 500;
      state.progression.mastery['darkness.s8.poetry'] = 500;
      const before = structuredClone(state), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolveMidnightCombatAbility(state, physicalIds[0], 1, random)).toMatchObject({ selfGain: 11.7 * f * 1.1, enemyReduction: 0, threatens: true });
      expect(resolveMidnightCombatAbility(state, physicalIds[1], 0.8, random)).toMatchObject({ selfGain: 6.3 * f * 1.1 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveMidnightCombatAbility(state, 'darkness.s8.self-protection', 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 15.6 * f * 1.1, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('spends exactly two spirituality and one normal will12 check on success and resistance', () => {
    for (const mastery of [0, 250, 500]) for (const roll of [1, 56, 57, 100]) {
      const state = fixture(); state.spirituality = 10;
      state.progression.mastery['darkness.s8.poetry'] = mastery;
      const before = structuredClone(state), random = stream(state), draws = scriptRolls(roll);
      const effect = resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 0.8, random);
      expect(effect).toMatchObject({ selfGain: 0,
        enemyReduction: roll <= 56 ? 8.4 * (0.65 + 0.35 * mastery / 500) * 1.1 : 0, threatens: false });
      expect(effect.label).toContain('普通对手仍按原次数行动');
      if (roll > 56) expect(effect.label).toContain('抵抗住了');
      expect(state.spirituality).toBe(8);
      expect(state.lastCheck).toMatchObject({ ability: 'will', baseAbility: 15, difficulty: 12, chance: 56, roll });
      expect({ ...state, spirituality: before.spirituality, lastCheck: before.lastCheck }).toEqual(before);
      expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });
});

describe('current night, local voice and allied bystander boundaries', () => {
  it('binds the observed Hern, current attempt, open night courtyard and usable local voice', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentMidnightNightSource(state)).toMatchObject({ encounterId: 'MIDNIGHT_DISPUTE',
      target: 'HERN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', time: 'SCHEDULED_NIGHT',
      space: 'OPEN_SMALL_COURTYARD', exit: 'ORDINARY_OPEN_EXIT', voice: 'PLAYER_CAN_VOICE',
      range: 'LOCAL_VOICE_AT_MOST_SIX_METRES', bystander: 'PORTER_WITHDRAWN' });
    expect(currentMidnightPoemSource(state)).toEqual(currentMidnightNightSource(state));
    for (const mutate of [
      (s: SliceState) => { s.midnight.encounter.observed = false; },
      (s: SliceState) => { s.midnight.encounter.status = 'RESOLVED'; },
      (s: SliceState) => { s.midnight.encounter.attemptWeek = null; },
      (s: SliceState) => { s.midnight.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.midnight.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.pathwayId = 'moon'; },
    ]) {
      const candidate = fixture(); mutate(candidate);
      expect(currentMidnightNightSource(candidate)).toBeNull();
      expect(currentMidnightPoemSource(candidate)).toBeNull();
    }
  });

  it('uses ordinary BLOCK10 on the same chosen action when a source is absent or stale', () => {
    const state = fixture(), source = currentMidnightNightSource(state)!;
    state.knowledge = [{ id: 'private', week: 1, title: 'SECRET', text: 'HIDDEN_TARGET_SECRET' }];
    const invalid: (MidnightNightSource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: source.attemptWeek + 1 }, { ...source, startHistoryIndex: 100 },
      ...(['target', 'body', 'time', 'space', 'exit', 'voice', 'range', 'bystander', 'aggression'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as MidnightNightSource)];
    for (const input of invalid) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('改用格挡护身');
      expect(effect.label).not.toMatch(/HIDDEN_TARGET_SECRET|贺恩/);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('withholds poems while the porter remains, without extinguishing the actual night or inventing a silencing projectile', () => {
    const state = fixture(); state.midnight.encounter.bystanderCleared = false;
    const before = structuredClone(state), random = stream(state);
    expect(currentMidnightNightSource(state)?.bystander).toBe('PORTER_PRESENT');
    expect(currentMidnightPoemSource(state)).toBeNull();
    const effect = resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 1, random);
    expect(effect).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false });
    expect(effect.label).toContain('声音可能影响同伴');
    expect(effect.label).not.toMatch(/飞刀|无声|静音|选择性/);
    expect(resolve(state, physicalIds[0]).selfGain).toBe(11.7 * 0.65 * 1.1);
    expect(resolve(state, 'darkness.s8.self-protection').enemyReduction).toBe(15.6 * 0.65 * 1.1);
    expect(resolve(state, 'OBSERVE').selfGain).toBe(0);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('does not cast across old unspecified geometry or infer night from the old S9 watch', () => {
    for (const encounterId of oldEncounters) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      Object.assign(state.sleepless.encounter, { observed: true, night: true, status: 'FIGHTING',
        attemptWeek: state.week, startHistoryIndex: 0 });
      const before = structuredClone(state), random = stream(state);
      expect(currentMidnightNightSource(state)).toBeNull();
      expect(resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 1, random)).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false });
      expect(resolve(state, physicalIds[0]).selfGain).toBe(11.7 * 0.65);
      expect(resolve(state, physicalIds[1]).selfGain).toBe(6.3 * 0.65);
      expect(resolve(state, 'darkness.s8.self-protection').enemyReduction).toBe(15.6 * 0.65);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('falls back before spending or checking when spirituality or a living mind is unavailable', () => {
    for (const amount of [0, 1, 1.5]) {
      const state = fixture(); state.spirituality = amount;
      const before = structuredClone(state), random = stream(state);
      expect(resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 1, random)).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.combat!.enemyMind = 0;
    const before = structuredClone(state), random = stream(state);
    expect(currentMidnightPoemSource(state)).toBeNull();
    expect(resolveMidnightCombatAbility(state, 'darkness.s8.poetry', 1, random).enemyReduction).toBe(10);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('keeps R0 and ±7.5 accidents unboosted, non-threatening and unable to clear a bystander', () => {
    for (const observed of [true, false]) {
      const state = fixture(); state.midnight.encounter.observed = observed;
      state.midnight.encounter.bystanderCleared = false;
      const before = structuredClone(state), random = stream(state);
      expect(resolveMidnightCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); scriptRolls(1, 2);
      expect(resolveMidnightCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -7.5, enemyReduction: 0, threatens: false });
      expect(resolveMidnightCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 7.5, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(2); expect(state).toEqual(before); vi.restoreAllMocks();
    }
  });

  it('spends no RNG or resources after combat ends and rejects ineffective physical factors', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.progression.sequence = 9; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveMidnightCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
    for (const factor of [0, -1, Number.NaN]) for (const id of physicalIds) {
      const state = fixture();
      expect(resolveMidnightCombatAbility(state, id, factor, stream(state))).toMatchObject({ selfGain: 0, threatens: false });
    }
  });
});

describe('original equipment, full enemy agency and shared physical consequences', () => {
  it('replaces only the primary strike with the actual held original club, never stacking mastery or night', () => {
    const state = fixture(); state.progression.mastery['darkness.s8.physical-training'] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state), armed = location === 'HAND';
      const effect = resolveMidnightCombatAbility(state, physicalIds[0], 0.8, random);
      expect(effect.selfGain).toBe(armed ? 16 * 0.8 : 11.7 * 1.1 * 0.8);
      expect(resolve(state, physicalIds[1]).selfGain).toBe(6.3 * 1.1);
      if (armed) {
        expect(effect.label).toContain('不叠加C主攻预算或夜间强化');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      } else expect(playerAbilityWheel(state, null)[0]!.label).toBe('身体训练打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    state.town.clubLocation = 'HAND'; state.midnight.encounter.observed = false;
    expect(resolve(state, physicalIds[0]).selfGain).toBe(16);
  });

  it('keeps every enemy action after successful or resisted poetry, with no free turn, redraw, AP or week gain', () => {
    for (const roll of [1, 100]) {
      const state = fixture(); state.spirituality = 10;
      const before = structuredClone(state), draws = scriptRolls(1, 100, 221, roll, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
      expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
      expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(1);
      expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
      expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: roll === 1 ? 8.4 * 0.65 * 1.1 : 0 });
      expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING', round: 2 });
      expect(state.spirituality).toBe(12.5); expect(state.week).toBe(before.week);
      expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
      expect(state.progression).toEqual(before.progression); expect(state.midnight).toEqual(before.midnight);
      expect(draws).toHaveBeenCalledTimes(8); expect(state.random.cursor).toBe(before.random.cursor + 8);
      vi.restoreAllMocks();
    }
  });

  it('uses exactly one fallback move with no check draw when the ally is still within the voice scene', () => {
    const state = fixture(); state.midnight.encounter.bystanderCleared = false; state.spirituality = 10;
    const draws = scriptRolls(1, 100, 221, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves).toHaveLength(4);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(state.spirituality).toBe(14.5); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.midnight.encounter.bystanderCleared).toBe(false);
  });

  it('does not turn self-protection, R0 or a positive accident into a lethal attack merely because a club is held', () => {
    for (const slot of [176, 376, 408]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 408 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 408 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 408 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('keeps physical injury, named surrender and actual death without changing the old carrier', () => {
    const attacking = fixture(); attacking.world.carrierAlive = false; attacking.world.carrierCanResist = false;
    scriptRolls(1, 1, 1, 400, 1, 66);
    const attack = resolveSliceCombatRound(attacking, 'ATTACK');
    expect(attack.outcome).toBe('ENEMY_SURRENDERED');
    expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
    expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(attack.round.consequence).toContain('持棍贺恩仍然活着');
    expect(attack.round.consequence).not.toContain('携铃者');
    expect(attacking.world.carrierAlive).toBe(false); expect(attacking.world.carrierCanResist).toBe(false);
    vi.restoreAllMocks();
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 176, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(dying.injuries).toEqual([{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }]);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
  });

  it('stops terminal replay without a draw and retains ordinary retreat with no special recovery', () => {
    const state = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    vi.restoreAllMocks(); const before = structuredClone(state), forbidden = scriptRolls();
    expect(() => resolveSliceCombatRound(state, 'CONTROL')).toThrow('当前没有可以继续的战斗');
    expect(forbidden).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    const retreating = fixture(); retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('持棍贺恩'); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it('preserves exact serialized replay without Math.random or modifying the inherited watch archive', () => {
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    state.sleepless.watches['quiet-warehouse'].status = 'RESOLVED';
    const watchArchive = structuredClone(state.sleepless), restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(state.sleepless).toEqual(watchArchive); expect(forbidden).not.toHaveBeenCalled();
  });
});
