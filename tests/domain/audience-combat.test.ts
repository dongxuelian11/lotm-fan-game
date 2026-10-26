import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel,
  playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  AUDIENCE_COUNT_WHEEL, audienceAbilityWheel, audienceActionCount,
  drawAudienceAbility, isAudience, resolveAudienceCombatAbility,
} from '../../src/domain/audience/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('audience-combat-test', sliceDefaultCreationSelection, 'audience-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.combat = {
    encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null,
  };
  state.progression = { pathwayId: 'audience', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spirituality = 30;
  state.world.carrierAlive = true;
  state.world.carrierCanResist = true;
  return state;
}

function previousRound(): SliceCombatRound {
  return {
    round: 1, stance: 'PREPARE', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'ENEMY', label: '格挡护身', selfGain: 0, enemyReduction: 10 }],
    playerAdvantage: 215, enemyAdvantage: 114, winChance: 215 / 329 * 100,
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

describe('audience S9 combat profile', () => {
  it('uses only ordinary bodily actions and the three S9 information abilities', () => {
    const state = fixture();
    expect(isAudience(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(AUDIENCE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(({ weight }) => weight)).toEqual([25, 30, 25, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(audienceAbilityWheel(null));
    expect(playerAbilityWheel(state, null).map(({ id }) => id)).toEqual([
      'STRIKE', 'EVADE', 'audience.observation', 'audience.behavior-analysis',
      'audience.memory-deduction', 'MISS',
    ]);
    expect(playerAbilityWheel(state, null).map(({ weight }) => weight)).toEqual([20, 25, 25, 15, 10, 5]);
    expect(playerAbilityWheel(state, null).some(({ label }) => /读心|暗示|催眠|精神攻击|控心|枪/.test(label))).toBe(false);
    const counts = playerCountWheel(state), abilities = playerAbilityWheel(state, null);
    counts[0]!.weight = 0; abilities[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(25);
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
  });

  it.each([[1, 1], [25, 1], [26, 2], [55, 2], [56, 3], [80, 3], [81, 4], [100, 4]])(
    'maps count roll %i to %i actions', (roll, count) => expect(audienceActionCount(roll)).toBe(count),
  );

  it.each([
    ['ATTACK', [100, 100, 100, 60, 40, 20]],
    ['DEFEND', [80, 125, 100, 60, 40, 20]],
    ['CONTROL', [80, 100, 100, 75, 40, 20]],
    ['PREPARE', [80, 100, 125, 60, 50, 20]],
  ] as const)('uses exact ×1.25 normalized %s category tickets', (stance, tickets) => {
    const total = tickets.reduce((sum, weight) => sum + weight, 0);
    expect(playerAbilityWheel(fixture(), stance).map(({ weight }) => weight))
      .toEqual(tickets.map((weight) => weight / total * 100));
  });

  it.each([
    [1, 'STRIKE'], [80, 'STRIKE'], [81, 'EVADE'], [180, 'EVADE'],
    [181, 'audience.observation'], [280, 'audience.observation'],
    [281, 'audience.behavior-analysis'], [340, 'audience.behavior-analysis'],
    [341, 'audience.memory-deduction'], [380, 'audience.memory-deduction'],
    [381, 'MISS'], [400, 'MISS'],
  ] as const)('draws neutral ticket %i as %s', (roll, id) => {
    const state = fixture(); scriptRolls(roll);
    expect(drawAudienceAbility(new DeterministicActionRandomStream(state.random.seed), null)).toBe(id);
  });

  it('keeps ordinary, seer, clown, hunter, and provoker selectors unchanged', () => {
    const state = fixture();
    state.progression.pathwayId = 'diviner';
    expect(isAudience(state)).toBe(false);
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
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
    scriptRolls(1, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves).toEqual([
      { actor: 'PLAYER', label: '普通打击', selfGain: 12, enemyReduction: 0 },
      { actor: 'ENEMY', label: '短棍打击', selfGain: 24, enemyReduction: 0 },
    ]);
    expect(round.playerAdvantage).toBe(127);
    expect(round.enemyAdvantage).toBe(133); // ordinary FIRST_CASE base109 + actual held-club24
    expect(state.combat!.enemyHealth).toBe(90);
  });

  it('uses tier 200, core 5/45/20/30, a 40-point cap, and spirituality max 30', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 29;
    scriptRolls(1, 1, 420, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(227.5);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 420, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(9);
  });

  it('does not award passive benefits for mastery or possession of the abilities', () => {
    const state = fixture(); const before = playerAbilityWheel(state, null);
    state.progression.mastery = {
      'audience.observation': 500, 'audience.behavior-analysis': 500, 'audience.memory-deduction': 500,
    };
    expect(playerAbilityWheel(state, null)).toEqual(before);
    scriptRolls(1, 1, 420, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(215);
  });
});

describe('source-bound audience observation and deduction', () => {
  it('observes only visible health and posture, with no state or knowledge mutation', () => {
    const state = fixture(); const before = structuredClone(state);
    const observation = resolveAudienceCombatAbility(state, 'audience.observation', 1);
    expect(observation).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(observation.label).toContain('未显受伤');
    expect(observation.label).toContain('持短棍抵抗');
    expect(state).toEqual(before);
    state.combat!.enemyHealth = 70;
    expect(resolveAudienceCombatAbility(state, 'audience.observation', 1).label).toContain('身上已有伤势');
    const hiddenChanged = structuredClone(state);
    hiddenChanged.world.bellFactKnown = !state.world.bellFactKnown;
    hiddenChanged.world.bell = 'DESTROYED_VERIFIED';
    hiddenChanged.world.audrey = 'GONE';
    hiddenChanged.world.manager = 'ARRESTED';
    hiddenChanged.knowledge = [];
    expect(resolveAudienceCombatAbility(hiddenChanged, 'audience.observation', 1))
      .toEqual(resolveAudienceCombatAbility(state, 'audience.observation', 1));
    expect(resolveAudienceCombatAbility(hiddenChanged, 'audience.behavior-analysis', 1))
      .toEqual(resolveAudienceCombatAbility(state, 'audience.behavior-analysis', 1));
  });

  it.each(['audience.observation', 'audience.behavior-analysis'] as const)(
    '%s needs a present living resisting first-case opponent', (id) => {
      const baseline = fixture();
      const changes: ((state: SliceState) => void)[] = [
        (s) => { s.combat = null; },
        (s) => { s.combat!.enemyStatus = 'SURRENDERED'; },
        (s) => { s.combat!.enemyStatus = 'DEAD'; },
        (s) => { s.combat!.enemyHealth = 0; },
        (s) => { s.world.carrierAlive = false; },
        (s) => { s.world.carrierCanResist = false; },
        (s) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
        (s) => { s.status = 'DEAD'; },
        (s) => { s.health = 0; },
        (s) => { s.progression.pathwayId = 'diviner'; },
      ];
      for (const change of changes) {
        const state = structuredClone(baseline); change(state);
        const before = structuredClone(state);
        expect(resolveAudienceCombatAbility(state, id, 1)).toMatchObject({
          selfGain: 0, enemyReduction: 0, threatens: false,
        });
        expect(state).toEqual(before);
      }
    },
  );

  it('behavior analysis supplies only a tentative personal gain, never mental control or damage', () => {
    const state = fixture(), before = structuredClone(state);
    expect(resolveAudienceCombatAbility(state, 'audience.behavior-analysis', 1)).toMatchObject({
      selfGain: 6, enemyReduction: 0, threatens: false,
    });
    expect(resolveAudienceCombatAbility(state, 'audience.behavior-analysis', 1).label).toContain('推测');
    expect(state).toEqual(before);
    scriptRolls(1, 1, 281, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(1);
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]).toMatchObject({ selfGain: 6, enemyReduction: 0 });
    expect(round.moves[1]).toMatchObject({ label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(round.consequenceWeights).toBeNull();
    expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyMind).toBe(100);
    expect(state.combat!.enemyHealth).toBe(100);
    expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(state.combat!.enemyInjuries).toEqual([]);
    expect(state.knowledge).toEqual(before.knowledge);
    expect(state.world).toEqual(before.world);
    expect(state.random.cursor).toBe(5);
  });

  it('memory uses only actual prior enemy action in this encounter, never global history', () => {
    const state = fixture();
    state.combatHistory = [previousRound()]; state.lastCombatRound = previousRound();
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.round = 2;
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.lastRound = previousRound();
    const before = structuredClone(state);
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1)).toMatchObject({
      selfGain: 6, enemyReduction: 0, threatens: false,
    });
    expect(state).toEqual(before);
    state.combat!.lastRound!.moves = [];
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.round = 2;
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.winner = null;
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.lastRound!.retreat = 'SUCCESS';
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
    state.combat!.lastRound = previousRound(); state.combat!.encounterId = 'CLOWN_RESCUE';
    expect(resolveAudienceCombatAbility(state, 'audience.memory-deduction', 1).selfGain).toBe(0);
  });

  it('memory can use the completed first round on the next round without granting extra actions', () => {
    const state = fixture();
    scriptRolls(1, 1, 366, 400, 1);
    const first = resolveSliceCombatRound(state, 'PREPARE');
    expect(first.round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(first.round.playerAdvantage).toBe(215);
    vi.restoreAllMocks();
    const draws = scriptRolls(1, 1, 400, 366, 1);
    const second = resolveSliceCombatRound(state, 'PREPARE');
    expect(second.round.first).toBe('ENEMY');
    expect(second.round.moves[1]).toMatchObject({ selfGain: 6, enemyReduction: 0 });
    expect(second.round.playerAdvantage).toBe(221);
    expect(second.round.moves).toHaveLength(2);
    expect(second.round.consequenceWeights).toBeNull();
    expect(draws).toHaveBeenCalledTimes(5);
    expect(state.random.cursor).toBe(10);
  });
});

describe('audience shares the original physical and consequence rules', () => {
  it('alternates four ordinary strikes with three enemy actions and applies one physical injury', () => {
    const state = fixture();
    const draws = scriptRolls(81, 86, 1, 1, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(({ actor }) => actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(({ actor }) => actor === 'PLAYER').every(({ selfGain }) => selfGain === 12)).toBe(true);
    expect(round.playerAdvantage).toBe(263); expect(round.enemyAdvantage).toBe(162);
    expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyHealth).toBe(90); expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.combat!.enemyMind).toBe(100);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('applies physical health scaling once and preserves modest non-magical evade', () => {
    const state = fixture(); state.health = 50;
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.selfGain).toBeCloseTo(10.8);
    expect(round.playerAdvantage).toBeCloseTo(215 * 0.9 + 10.8);
    expect(resolveAudienceCombatAbility(state, 'EVADE', 1)).toMatchObject({
      selfGain: 0, enemyReduction: 12, threatens: false,
    });
  });

  it('retreat spends the whole turn and preserves true death without mental effects', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(state.spirituality).toBe(10);
    vi.restoreAllMocks();
    const dying = fixture();
    scriptRolls(1, 1, 1, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(dying, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(dying.health).toBe(0); expect(dying.combat!.enemyMind).toBe(100);
  });

  it('replays a saved audience round deterministically without Math.random', () => {
    const state = fixture(); state.random.cursor = 7;
    state.combat!.round = 2; state.combat!.lastRound = previousRound();
    const reloaded = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'PREPARE')).toEqual(resolveSliceCombatRound(reloaded, 'PREPARE'));
    expect(state).toEqual(reloaded); expect(forbidden).not.toHaveBeenCalled();
  });
});
