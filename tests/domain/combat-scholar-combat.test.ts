import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { COMBAT_SCHOLAR_COUNT_WHEEL, combatScholarAbilityWheel, combatScholarActionCount,
  drawCombatScholarAbility, isCombatScholar, resolveCombatScholarCombatAbility,
  type CombatScholarMoveId } from '../../src/domain/combat-scholar/combat.js';
import * as scholarCombat from '../../src/domain/combat-scholar/combat.js';
import { PRYER_COUNT_WHEEL, pryerAbilityWheel, resolvePryerCombatAbility } from '../../src/domain/pryer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const training = 'hermit.s8.combat-study', vision = 'hermit.s9.spirit-vision';
const ritual = 'hermit.s9.ritual-lore', study = 'hermit.s9.occult-study';
const ids = [training, 'BODY_FOLLOWUP', vision, 'SITE_PRESSURE', ritual, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('scholar-combat-test', sliceDefaultCreationSelection, 'scholar-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hermit', sequence: 8,
    mastery: { [training]: 0, [vision]: 0, [ritual]: 0, [study]: 0 }, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: CombatScholarMoveId, physical = 1) {
  return resolveCombatScholarCombatAbility(state, id, physical, stream(state));
}
/** Known tickets retain the real deterministic cursor advancement. */
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

describe('Combat Scholar S8 ordinary training profile (G)', () => {
  it('uses exact six-slot weights and five count boundaries without mutating wheel definitions', () => {
    const state = fixture();
    expect(isCombatScholar(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(combatScholarAbilityWheel(null, state));
    expect(combatScholarAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(combatScholarAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 25, 15, 5, 5]);
    expect(playerCountWheel(state)).toEqual(COMBAT_SCHOLAR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([12, 18, 25, 28, 17]);
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [83, 4], [84, 5], [100, 5]]) expect(combatScholarActionCount(roll!)).toBe(count);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(12);
  });

  it('draws every exact stance ticket with one random draw and no extra action', () => {
    for (const [stance, weights] of [
      [null, [120, 80, 100, 60, 20, 20]],
      ['ATTACK', [150, 100, 100, 60, 20, 20]],
      ['DEFEND', [120, 80, 125, 60, 20, 20]],
      ['CONTROL', [120, 80, 100, 75, 20, 20]],
      ['PREPARE', [120, 80, 100, 60, 25, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(combatScholarAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawCombatScholarAbility(random, stance)).toBe(ids[index]);
        expect(drawCombatScholarAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
    }
    expect(combatScholarAbilityWheel('RETREAT')).toEqual(combatScholarAbilityWheel(null));
  });

  it('keeps ordinary, unsupported higher Hermit and old Pryer S9 behavior unchanged', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isCombatScholar(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'hermit'; state.progression.sequence = 9; state.spirituality = 30;
    state.progression.mastery[training] = 500;
    expect(playerCountWheel(state)).toEqual(PRYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(pryerAbilityWheel(null, state));
    expect(resolvePryerCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(12);
    expect(resolvePryerCombatAbility(state, vision, 1, stream(state)).enemyReduction).toBe(18 * 0.65);
    state.spirituality = 30;
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(215);
    expect(state.spirituality).toBe(30);
  });

  it('uses only new ordinary training mastery for H24/J16.8/K18.9 physical contributions', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[training] = mastery;
      state.progression.mastery[vision] = 500; state.progression.mastery[ritual] = 500;
      state.progression.mastery[study] = 500;
      const before = structuredClone(state), random = stream(state), factor = 0.65 + 0.35 * mastery / 500;
      expect(resolveCombatScholarCombatAbility(state, training, 0.8, random))
        .toMatchObject({ selfGain: 24 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveCombatScholarCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random))
        .toMatchObject({ selfGain: 16.8 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveCombatScholarCombatAbility(state, 'SITE_PRESSURE', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 18.9 * factor * 0.8, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.progression.mastery[training] = 500;
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [training, 'BODY_FOLLOWUP', 'SITE_PRESSURE'] as const) {
        expect(resolve(state, id, factor)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    for (const mastery of [-1, Number.NaN, Number.POSITIVE_INFINITY, 700]) {
      state.progression.mastery[training] = mastery;
      expect(resolve(state, training, 2).selfGain).toBe(24 * (mastery === 700 ? 1 : 0.65));
    }
  });

  it('inherits vision mastery, pays exactly1S, and falls back to ordinary10 physical at insufficientS', () => {
    for (const spirituality of [0, 0.5, 1, 1.5]) {
      const state = fixture(); state.spirituality = spirituality;
      state.progression.mastery[vision] = 100; state.progression.mastery[training] = 500;
      const before = structuredClone(state), random = stream(state);
      expect(resolveCombatScholarCombatAbility(state, vision, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: spirituality >= 1 ? 27 * (0.65 + 0.35 * 100 / 500) : 8, threatens: false,
      });
      before.spirituality = spirituality >= 1 ? spirituality - 1 : spirituality;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const spirituality of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality;
      expect(resolve(state, vision, 0.8).enemyReduction).toBe(8);
      expect(state.spirituality).toBe(spirituality);
    }
  });

  it('replaces H with16physical only for the actual Town HAND original, without stacking training', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.spirituality = 0;
      state.progression.mastery[training] = 500;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state);
      expect(resolve(state, training, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 24) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(16.8 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '实练近身打击（G）');
      expect(state).toEqual(before);
    }
  });

  it('requires this living resisting FIRST_CASE target for every action and cost', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveCombatScholarCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not create a ritual source and gives accident only its signed7.5 contribution', () => {
    const state = fixture(); state.progression.mastery[ritual] = 500;
    state.knowledge.push({ id: 'unrelated-note', week: state.week, title: '异地笔记', text: 'PREPARED_RITUAL FUTURE_ACTION' });
    const before = structuredClone(state), random = stream(state);
    const effect = resolveCombatScholarCombatAbility(state, ritual, 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('没有已准备并获准使用的仪式来源');
    expect(effect.label).not.toMatch(/PREPARED_RITUAL|FUTURE_ACTION/);
    expect(random.cursor).toBe(0);
    scriptRolls(1, 2);
    expect(resolveCombatScholarCombatAbility(state, 'ACCIDENT', 1, random))
      .toMatchObject({ selfGain: -7.5, enemyReduction: 0, threatens: false });
    expect(resolveCombatScholarCombatAbility(state, 'ACCIDENT', 1, random))
      .toMatchObject({ selfGain: 7.5, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(state).toEqual(before);
  });
});

describe('Combat Scholar shared round settlement', () => {
  it('uses core20/25/25/30, base300, floor30 and max45 recovery without progression changes', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 411, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(326.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(4.5);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 411, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 44;
    scriptRolls(1, 1, 411, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(45);
    vi.restoreAllMocks();
    vi.spyOn(scholarCombat, 'resolveCombatScholarCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 411, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('resolves five distinct player slots against three real enemy strikes, preserving shared injury', () => {
    const state = fixture(); const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 351, 411, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [24 * 0.65, 0], [16.8 * 0.65, 0], [0, 27 * 0.65], [0, 18.9 * 0.65], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(315 + (24 * 0.65 + 16.8 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (27 * 0.65 + 18.9 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(45); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('spends the last1S once before fallback blocks, with only one round-end recovery', () => {
    const state = fixture(); state.spirituality = 1;
    const draws = scriptRolls(100, 1, 251, 400, 251, 251, 251, 251, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction))
      .toEqual([27 * 0.65, 10, 10, 10, 10]);
    expect(round.consequenceWeights).toBeNull(); expect(state.spirituality).toBe(4.5);
    expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('never grants injury from vision, ordinary footwork, ritual checks or positive accidents', () => {
    for (const ticket of [251, 351, 411, 431]) {
      const state = fixture();
      const draws = ticket === 431 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves).toHaveLength(2); expect(round.consequenceWeights).toBeNull();
      expect(round.moves[0]!.selfGain).toBe(ticket === 431 ? 7.5 : 0);
      expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(ticket === 431 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('uses shared surrender and actual death consequences with no special protection or free recovery', () => {
    for (const ticket of [1, 151]) {
      const state = fixture(); state.spirituality = 20;
      scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(state.spirituality).toBe(20);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      vi.restoreAllMocks();
    }
    const enemyDeath = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(enemyDeath, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(enemyDeath.combat!.enemyHealth).toBe(0); vi.restoreAllMocks();
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(4);
  });

  it('keeps ordinary retreat and deterministic saved-state replay', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const original = fixture(); original.town.clubLocation = 'HAND'; original.random.cursor = 7; original.health = 70;
    const restored = JSON.parse(JSON.stringify(original)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(original, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(original).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(original.town.clubLocation).toBe('HAND');
  });
});
