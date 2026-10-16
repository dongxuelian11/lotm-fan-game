import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel,
  playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  MINDREADER_COUNT_WHEEL, drawMindreaderAbility, isMindreader, mindreaderAbilityWheel,
  mindreaderActionCount, resolveMindreaderCombatAbility,
} from '../../src/domain/mindreader/combat.js';
import {
  AUDIENCE_COUNT_WHEEL, audienceAbilityWheel, resolveAudienceCombatAbility,
} from '../../src/domain/audience/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('mindreader-combat-test', sliceDefaultCreationSelection, 'mindreader-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.combat = {
    encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null,
  };
  state.progression = { pathwayId: 'audience', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spirituality = 45;
  state.world.carrierAlive = true;
  state.world.carrierCanResist = true;
  return state;
}

function previousRound(): SliceCombatRound {
  return {
    round: 1, stance: 'PREPARE', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'ENEMY', label: '格挡护身', selfGain: 0, enemyReduction: 10 }],
    playerAdvantage: 315, enemyAdvantage: 114, winChance: 315 / 429 * 100,
    winner: 'PLAYER', consequence: '未增加伤势', consequenceWeights: null, retreat: 'NONE',
  };
}

/** Prescribe draws while consuming the real deterministic stream/cursor. */
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

describe('mindreader S8 combat profile', () => {
  it('adds shallow reading to the three inherited abilities and ordinary bodily actions', () => {
    const state = fixture();
    expect(isMindreader(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(MINDREADER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([15, 25, 30, 20, 10]);
    expect(playerAbilityWheel(state, null)).toEqual(mindreaderAbilityWheel(null));
    expect(playerAbilityWheel(state, null).map(({ id }) => id)).toEqual([
      'STRIKE', 'EVADE', 'audience.observation', 'audience.behavior-analysis',
      'audience.memory-deduction', 'audience.mind-reading', 'MISS',
    ]);
    expect(playerAbilityWheel(state, null).map(({ weight }) => weight)).toEqual([15, 25, 20, 15, 10, 10, 5]);
    expect(playerAbilityWheel(state, null).some(({ label }) => /暗示|催眠|精神攻击|控心|枪/.test(label))).toBe(false);
    const counts = playerCountWheel(state), abilities = playerAbilityWheel(state, null);
    counts[0]!.weight = 0; abilities[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(15);
  });

  it.each([[1, 1], [15, 1], [16, 2], [40, 2], [41, 3], [70, 3], [71, 4], [90, 4], [91, 5], [100, 5]])(
    'maps count roll %i to %i actions', (roll, count) => expect(mindreaderActionCount(roll)).toBe(count),
  );

  it.each([
    ['ATTACK', [75, 100, 80, 60, 40, 40, 20]],
    ['DEFEND', [60, 125, 80, 60, 40, 40, 20]],
    ['CONTROL', [60, 100, 80, 75, 40, 50, 20]],
    ['PREPARE', [60, 100, 100, 60, 50, 40, 20]],
  ] as const)('uses exact ×1.25 normalized %s category tickets', (stance, tickets) => {
    const total = tickets.reduce((sum, weight) => sum + weight, 0);
    expect(playerAbilityWheel(fixture(), stance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / total * 100));
  });

  it.each([
    [1, 'STRIKE'], [60, 'STRIKE'], [61, 'EVADE'], [160, 'EVADE'],
    [161, 'audience.observation'], [240, 'audience.observation'],
    [241, 'audience.behavior-analysis'], [300, 'audience.behavior-analysis'],
    [301, 'audience.memory-deduction'], [340, 'audience.memory-deduction'],
    [341, 'audience.mind-reading'], [380, 'audience.mind-reading'], [381, 'MISS'], [400, 'MISS'],
  ] as const)('draws neutral ticket %i as %s', (roll, id) => {
    scriptRolls(roll);
    expect(drawMindreaderAbility(new DeterministicActionRandomStream('wheel'), null)).toBe(id);
  });

  it('keeps all previously playable profile selectors unchanged', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(isMindreader(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(AUDIENCE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(audienceAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'diviner';
    expect(playerCountWheel(state)).toEqual(SEER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(seerAbilityWheel('CONTROL'));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(CLOWN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(clownAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'hunter';
    expect(playerCountWheel(state)).toEqual(PROVOKER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(provokerAbilityWheel('CONTROL'));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(HUNTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(hunterAbilityWheel('CONTROL'));
    state.progression.pathwayId = null; state.progression.sequence = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(ordinaryAbilityWheel(false, 'ATTACK'));
  });

  it('uses tier 300, core 5/40/30/25, a 60-point cap, and spirituality max 45', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 44;
    scriptRolls(1, 1, 415, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(327.5);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 415, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(10.5);
  });

  it('does not add passive benefits merely for mastery or possession', () => {
    const state = fixture(), before = playerAbilityWheel(state, null);
    state.progression.mastery = { 'audience.mind-reading': 500, 'audience.observation': 500 };
    expect(playerAbilityWheel(state, null)).toEqual(before);
    scriptRolls(1, 1, 415, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(315);
  });
});

describe('source-bound shallow mind reading', () => {
  it.each([[1, 'GREAT_SUCCESS', 10], [56, 'SUCCESS', 10], [57, 'FAILURE', 0], [100, 'GREAT_FAILURE', 0]] as const)(
    'roll %i pays exactly 1 spirituality and resolves %s without affecting the opponent', (roll, tier, gain) => {
      const state = fixture(), before = structuredClone(state);
      const random = new DeterministicActionRandomStream('read');
      scriptRolls(roll);
      const effect = resolveMindreaderCombatAbility(state, 'audience.mind-reading', 1, random);
      expect(effect).toMatchObject({ selfGain: gain, enemyReduction: 0, threatens: false });
      expect(state.spirituality).toBe(44);
      expect(state.lastCheck).toMatchObject({ ability: 'perception', difficulty: 12, chance: 56, roll, tier });
      expect(random.cursor).toBe(1);
      expect(state).toEqual({ ...before, spirituality: 44, lastCheck: state.lastCheck });
      if (gain) {
        expect(effect.label).toContain('此刻想守住身前空间');
        expect(effect.label).toContain('不保证下一步动作');
      } else expect(effect.label).toContain('未辨清浅层意图');
    },
  );

  it('rejects missing, remote, dead, surrendered, non-first-case, and unavailable minds before any charge or check', () => {
    const changes: ((state: SliceState) => void)[] = [
      (s) => { s.combat = null; },
      (s) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s) => { s.combat!.enemyStatus = 'DEAD'; },
      (s) => { s.combat!.enemyHealth = 0; },
      (s) => { s.combat!.enemyMind = 0; },
      (s) => { s.world.carrierAlive = false; },
      (s) => { s.world.carrierCanResist = false; },
      (s) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      (s) => { s.combat!.encounterId = 'CLOWN_RESCUE'; },
      (s) => { s.combat!.encounterId = 'PROVOKER_DISPUTE'; },
      (s) => { s.arc.stage = 'ENDED'; },
      (s) => { s.world.city = 'ELSEWHERE'; },
      (s) => { s.status = 'DEAD'; },
      (s) => { s.health = 0; },
      (s) => { s.progression.pathwayId = 'diviner'; },
      (s) => { s.progression.sequence = 9; },
    ];
    for (const change of changes) {
      const state = fixture(); change(state);
      const before = structuredClone(state), random = new DeterministicActionRandomStream('invalid');
      expect(resolveMindreaderCombatAbility(state, 'audience.mind-reading', 1, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it.each([0, 0.5])('has no free read or redraw when spirituality is %s', (spirituality) => {
    const state = fixture(); state.spirituality = spirituality;
    const before = structuredClone(state), random = new DeterministicActionRandomStream('empty');
    const effect = resolveMindreaderCombatAbility(state, 'audience.mind-reading', 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('灵性不足1');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('does not inspect hidden case facts, deep memories, or future enemy draws', () => {
    const state = fixture(), hiddenChanged = structuredClone(state);
    hiddenChanged.world.bellFactKnown = true; hiddenChanged.world.bell = 'DESTROYED_VERIFIED';
    hiddenChanged.world.bellHolder = 'NONE'; hiddenChanged.world.bellAtScene = false;
    hiddenChanged.world.audrey = 'GONE'; hiddenChanged.world.manager = 'ARRESTED';
    hiddenChanged.knowledge = [{ id: 'private', week: 1, title: 'PRIVATE', text: 'SECRET' }];
    hiddenChanged.combatHistory = [previousRound()];
    scriptRolls(1, 1);
    const actual = resolveMindreaderCombatAbility(state, 'audience.mind-reading', 1, new DeterministicActionRandomStream('a'));
    const other = resolveMindreaderCombatAbility(hiddenChanged, 'audience.mind-reading', 1, new DeterministicActionRandomStream('b'));
    expect(actual).toEqual(other);
    expect(actual.label).not.toMatch(/SECRET|PRIVATE|幕后|必定|下一步会|深层记忆/);
    expect(hiddenChanged.knowledge[0]!.text).toBe('SECRET');
  });

  it('uses one ongoing-round check draw, grants no extra turn, and never damages or controls a mind', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state);
    const draws = scriptRolls(1, 1, 356, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 1]);
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 10, enemyReduction: 0 });
    expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', label: '短棍打击', selfGain: 16 });
    expect(round.playerAdvantage).toBe(262); expect(round.enemyAdvantage).toBe(130);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyMind: 100, enemyHealth: 100, enemyStatus: 'RESISTING', enemyInjuries: [] });
    expect(state.spirituality).toBe(13.5);
    expect(state.knowledge).toEqual(before.knowledge); expect(state.world).toEqual(before.world);
    expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
  });

  it('consumes failure costs during the round and does not redraw a failed or unaffordable read', () => {
    const state = fixture(); state.spirituality = 1;
    const draws = scriptRolls(16, 1, 356, 100, 400, 356, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves.map(({ actor }) => actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]!.label).toContain('未辨清浅层意图');
    expect(round.moves[2]!.label).toContain('灵性不足1');
    expect(round.moves.every(({ selfGain }) => selfGain === 0)).toBe(true);
    expect(state.lastCheck?.tier).toBe('GREAT_FAILURE');
    expect(state.spirituality).toBe(4.5);
    expect(draws).toHaveBeenCalledTimes(7); expect(state.random.cursor).toBe(7);
  });
});

describe('inherited observation and unchanged common combat rules', () => {
  it('inherits the exact S9 observation, analysis, and source-bound memory effects without mutating progression', () => {
    const state = fixture(), random = new DeterministicActionRandomStream('inherited');
    for (const id of ['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction'] as const) {
      const before = structuredClone(state);
      const s9 = structuredClone(state); s9.progression.sequence = 9;
      expect(resolveMindreaderCombatAbility(state, id, 1, random)).toEqual(resolveAudienceCombatAbility(s9, id, 1));
      expect(state).toEqual(before);
    }
    expect(resolveMindreaderCombatAbility(state, 'audience.observation', 1, random).selfGain).toBe(8);
    expect(resolveMindreaderCombatAbility(state, 'audience.behavior-analysis', 1, random).selfGain).toBe(6);
    state.combatHistory = [previousRound()]; state.lastCombatRound = previousRound();
    state.combat!.round = 2;
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(0);
    state.combat!.lastRound = previousRound();
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(6);
    state.combat!.lastRound!.round = 2;
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.moves = [];
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.winner = null;
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.retreat = 'SUCCESS';
    expect(resolveMindreaderCombatAbility(state, 'audience.memory-deduction', 1, random).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.encounterId = 'CLOWN_RESCUE';
    for (const id of ['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction'] as const) {
      expect(resolveMindreaderCombatAbility(state, id, 1, random).selfGain).toBe(0);
    }
    expect(state.progression.sequence).toBe(8); expect(random.cursor).toBe(0);
  });

  it('alternates five ordinary strikes with three enemy actions and resolves one injury', () => {
    const state = fixture();
    const draws = scriptRolls(91, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').every(({ selfGain }) => selfGain === 12)).toBe(true);
    expect(round.playerAdvantage).toBe(375); expect(round.enemyAdvantage).toBe(162);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1); expect(state.combat!.enemyMind).toBe(100);
    expect(draws).toHaveBeenCalledTimes(12);
  });

  it('scales ordinary bodily strikes once and keeps evade non-threatening', () => {
    const state = fixture(); state.health = 50;
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBeCloseTo(10.8);
    expect(round.playerAdvantage).toBeCloseTo(315 * 0.9 + 10.8);
    expect(resolveMindreaderCombatAbility(state, 'EVADE', 1, new DeterministicActionRandomStream('evade')))
      .toMatchObject({ selfGain: 0, enemyReduction: 18, threatens: false });
  });

  it('preserves whole-turn retreat and true death with no mental rescue or end-of-encounter recovery', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(state.spirituality).toBe(10);
    vi.restoreAllMocks();
    const dying = fixture(); dying.spirituality = 10;
    scriptRolls(1, 1, 356, 1, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(dying, 'CONTROL').outcome).toBe('PLAYER_DEAD');
    expect(dying.health).toBe(0); expect(dying.combat!.enemyMind).toBe(100);
    expect(dying.spirituality).toBe(9);
  });

  it('replays saved rounds deterministically without Math.random or new private information', () => {
    const state = fixture(); state.random.cursor = 7;
    state.combat!.round = 2; state.combat!.lastRound = previousRound();
    const reloaded = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(reloaded, 'CONTROL'));
    expect(state).toEqual(reloaded); expect(forbidden).not.toHaveBeenCalled();
  });
});
