import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import {
  APPRAISER_COUNT_WHEEL, ORDINARY_COUNT_WHEEL, appraiserActionCount,
  ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel } from '../../src/domain/mindreader/combat.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistAbilityWheel } from '../../src/domain/psychologist/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { MAGICIAN_COUNT_WHEEL, magicianAbilityWheel } from '../../src/domain/magician/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel } from '../../src/domain/pyromaniac/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Combat-only fixture; it does not claim a new Appraiser encounter or promotion history. */
function fixture(): SliceState {
  const state = createSliceRun('appraiser-combat-test', sliceDefaultCreationSelection, 'appraiser-combat');
  state.activeEvent = null;
  state.arc.stage = 'COMBAT';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'paragon', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}

/** Prescribe wheel results while advancing the real deterministic stream. */
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

describe('Appraiser S7 ordinary combat continuation', () => {
  it('uses its own six-count wheel and boundaries without upgrading ordinary NPC counts', () => {
    const state = fixture();
    expect(APPRAISER_COUNT_WHEEL.map(entry => entry.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(APPRAISER_COUNT_WHEEL.map(entry => entry.weight)).toEqual([15, 20, 25, 20, 15, 5]);
    expect(APPRAISER_COUNT_WHEEL.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100);
    expect(APPRAISER_COUNT_WHEEL).not.toBe(PSYCHOLOGIST_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(appraiserActionCount(roll!)).toBe(count);
    }
    const projected = playerCountWheel(state);
    expect(projected).toEqual(APPRAISER_COUNT_WHEEL);
    projected[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    scriptRolls(96, 86, ...Array<number>(9).fill(400), 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([6, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(state.random.cursor).toBe(12);
    expect(ORDINARY_COUNT_WHEEL.map(entry => entry.weight)).toEqual([45, 40, 15]);
  });

  it('uses tier450, core15/35/25/25, capped core90 and the existing maximum status penalty', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 400, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(476);
    expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBeCloseTo(476 / 590 * 100);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 400, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(12);
  });

  it('retains every ordinary stance and move without inventing appraisal attacks or copied powers', () => {
    const state = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(ordinaryAbilityWheel(false, stance));
    }
    expect(playerAbilityWheel(state, null).map(entry => entry.id))
      .toEqual(['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS']);
    const before = structuredClone(state);
    scriptRolls(96, 1, 1, 400, 161, 241, 321, 400, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.label))
      .toEqual(['普通打击', '格挡护身', '寻找空当', '拉开距离', '动作落空', '普通打击']);
    expect(round.playerAdvantage).toBe(497);
    expect(round.enemyAdvantage).toBe(96);
    expect(state.progression).toEqual(before.progression);
    expect(state.town).toEqual(before.town);
    expect(state.world).toEqual(before.world);
    expect(state.character).toEqual(before.character);
  });

  it('uses the actual original short club only while held, with unchanged ordinary effects', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      const before = structuredClone(state.town);
      scriptRolls(1, 1, 1, 400, 1, 1);
      const { round } = resolveSliceCombatRound(state, 'PREPARE');
      expect(round.moves[0]).toEqual({ actor: 'PLAYER',
        label: location === 'HAND' ? '短棍打击' : '普通打击',
        selfGain: location === 'HAND' ? 16 : 12, enemyReduction: 0 });
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '普通打击');
      expect(state.town).toEqual(before);
      expect(state.combat!.enemyHealth).toBe(90);
      vi.restoreAllMocks();
    }
  });

  it('preserves Savant9 and Archaeologist8 ordinary counts, abilities, core and resource ceilings', () => {
    for (const [sequence, tier, maximum] of [[9, 200, 30], [8, 300, 45]] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.spirituality = maximum - 1;
      state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'PREPARE')).toEqual(ordinaryAbilityWheel(false, 'PREPARE'));
      scriptRolls(1, 1, 400, 400, 1);
      expect(resolveSliceCombatRound(state, 'PREPARE').round.playerAdvantage).toBe(tier + 25);
      expect(state.spirituality).toBe(maximum);
      vi.restoreAllMocks();
    }
  });

  it('leaves every other implemented pathway profile and the ordinary fallback unchanged', () => {
    const state = fixture();
    const profiles = [
      ['audience', 9, AUDIENCE_COUNT_WHEEL, audienceAbilityWheel('CONTROL')],
      ['audience', 8, MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel('CONTROL')],
      ['audience', 7, PSYCHOLOGIST_COUNT_WHEEL, psychologistAbilityWheel('CONTROL')],
      ['diviner', 9, SEER_COUNT_WHEEL, seerAbilityWheel('CONTROL')],
      ['diviner', 8, CLOWN_COUNT_WHEEL, clownAbilityWheel('CONTROL')],
      ['diviner', 7, MAGICIAN_COUNT_WHEEL, magicianAbilityWheel(state, 'CONTROL')],
      ['hunter', 9, HUNTER_COUNT_WHEEL, hunterAbilityWheel('CONTROL')],
      ['hunter', 8, PROVOKER_COUNT_WHEEL, provokerAbilityWheel('CONTROL')],
      ['hunter', 7, PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel('CONTROL')],
      ['moon', 9, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['moon', 8, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      [null, null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
    ] as const;
    for (const [pathwayId, sequence, counts, abilities] of profiles) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(abilities);
    }
  });

  it('recovers six spirituality only on continuing rounds and never exceeds sixty', () => {
    for (const [before, after] of [[0, 6], [30, 36], [59, 60], [60, 60]]) {
      const state = fixture(); state.spirituality = before!;
      scriptRolls(1, 1, 400, 400, 1);
      expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('CONTINUE');
      expect(state.spirituality).toBe(after);
      vi.restoreAllMocks();
    }
    const terminal = fixture(); terminal.spirituality = 30;
    scriptRolls(1, 1, 1, 400, 1, 66);
    expect(resolveSliceCombatRound(terminal, 'PREPARE').outcome).toBe('ENEMY_SURRENDERED');
    expect(terminal.spirituality).toBe(30);
  });

  it('replays a complete deterministic first-case fixture battle with ordinary damage and original gear', () => {
    const play = () => {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const rounds: SliceCombatRound[] = [];
      let outcome: ReturnType<typeof resolveSliceCombatRound>['outcome'] = 'CONTINUE';
      while (outcome === 'CONTINUE' && rounds.length < 100) {
        const result = resolveSliceCombatRound(state, 'ATTACK');
        rounds.push(structuredClone(result.round)); outcome = result.outcome;
      }
      expect(outcome).not.toBe('CONTINUE');
      expect(rounds.length).toBeGreaterThan(0);
      expect(rounds.every(round => round.playerCount >= 1 && round.playerCount <= 6
        && round.enemyCount >= 1 && round.enemyCount <= 3 && round.playerAdvantage >= 45)).toBe(true);
      expect(rounds.flatMap(round => round.moves).every(move =>
        ['短棍打击', '格挡护身', '寻找空当', '拉开距离', '动作落空'].includes(move.label))).toBe(true);
      expect(state.town.clubLocation).toBe('HAND');
      expect(state.progression.mastery).toEqual({});
      expect(state.spirituality).toBeLessThanOrEqual(60);
      return { state, rounds, outcome };
    };
    expect(play()).toEqual(play());
  });
});
