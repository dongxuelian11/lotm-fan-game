import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createDreamwalkerState } from '../../src/domain/dreamwalker/index.js';
import { DREAMWALKER_COUNT_WHEEL, currentDreamwalkerCombatSource, drawDreamwalkerAbility,
  isDreamwalker, dreamwalkerAbilityWheel, dreamwalkerActionCount, resolveDreamwalkerCombatAbility,
  type DreamwalkerCombatSource, type DreamwalkerMoveId } from '../../src/domain/dreamwalker/combat.js';
import * as dreamwalkerCombat from '../../src/domain/dreamwalker/combat.js';
import { applyDreamwalkerEncounter, blockDreamwalkerEncounter, hasDreamwalkerDisputeOpponent,
  settleDreamwalkerEncounter, validateDreamwalkerEncounter } from '../../src/domain/dreamwalker/encounter.js';
import { PSYCHOLOGIST_COUNT_WHEEL, currentPsychologistMindSource, isPsychologist,
  psychologistAbilityWheel, resolvePsychologistCombatAbility } from '../../src/domain/psychologist/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel } from '../../src/domain/mindreader/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Bounded engine fixtures, not claims of natural promotion or a natural playthrough. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('dreamwalker-combat-test', sliceDefaultCreationSelection, 'dreamwalker-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'audience', sequence: 5, mastery: {}, acting: 25, promotionWeek: 19 };
  s.dreamwalker = createDreamwalkerState(); s.dreamwalker.promotionWeek = 19;
  s.dreamwalker.cases['dream-evidence']!.status = 'RESOLVED';
  Object.assign(s.dreamwalker.encounter, { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 });
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'DREAMWALKER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
const profile: readonly [DreamwalkerMoveId, number, SliceStance | null][] = [
  ['STRIKE', 10, 'ATTACK'], ['audience.s7.frenzy', 10, 'ATTACK'],
  ['audience.s6.scales', 10, 'DEFEND'], ['audience.s7.soothe', 8, 'DEFEND'], ['EVADE', 7, 'DEFEND'],
  ['audience.s6.combat-hypnosis', 20, 'CONTROL'], ['audience.s7.awe', 10, 'CONTROL'],
  ['audience.s7.suggestion', 10, 'CONTROL'], ['audience.s5.dream-guidance', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: DreamwalkerMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-dreamwalker', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function scriptRolls(...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index);
    return value;
  });
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const spy = scriptRolls(...values);
  try {
    const result = resolveSliceCombatRound(s, stance);
    s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length);
    return result;
  } finally { spy.mockRestore(); }
}
function effect(s: SliceState, id: DreamwalkerMoveId, factor = 1,
  source: DreamwalkerCombatSource | null = currentDreamwalkerCombatSource(s), random = fixedRolls()) {
  return resolveDreamwalkerCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Dreamwalker S5 bounded awake-scene combat', () => {
  it('selects independent H10/J10/B25/K40/R10/A5 and the unchanged inherited count wheel', () => {
    const s = fixture();
    expect(isDreamwalker(s)).toBe(true); expect(isPsychologist(s)).toBe(false);
    expect(playerAbilityWheel(s, null)).toEqual(dreamwalkerAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(DREAMWALKER_COUNT_WHEEL);
    expect(DREAMWALKER_COUNT_WHEEL).toBe(PSYCHOLOGIST_COUNT_WHEEL);
    expect(Object.isFrozen(DREAMWALKER_COUNT_WHEEL)).toBe(true);
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(dreamwalkerActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(10);
  });

  it('draws exactly one ticket per action with exact stance weighting and a single A sector', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      dreamwalkerAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawDreamwalkerAbility(random, s, stance)).toBe(entry.id);
        expect(drawDreamwalkerAbility(random, s, stance)).toBe(entry.id);
        expect(random.cursor).toBe(2);
      });
    }
    expect(effect(s, 'ACCIDENT')).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false, mentalPressure: false });
  });

  it('keeps the S9–6 wheels, counts and lower-sequence mind-source ownership unchanged', () => {
    for (const sequence of [9, 8, 7, 6] as const) {
      const s = fixture(); s.progression.sequence = sequence;
      expect(isDreamwalker(s)).toBe(false); expect(currentDreamwalkerCombatSource(s)).toBeNull();
      expect(playerCountWheel(s)).toEqual(sequence === 9 ? AUDIENCE_COUNT_WHEEL : sequence === 8 ? MINDREADER_COUNT_WHEEL : PSYCHOLOGIST_COUNT_WHEEL);
      expect(playerAbilityWheel(s, 'CONTROL')).toEqual(sequence === 9 ? audienceAbilityWheel('CONTROL')
        : sequence === 8 ? mindreaderAbilityWheel('CONTROL') : psychologistAbilityWheel('CONTROL', sequence));
      expect(currentPsychologistMindSource(s)).toBeNull();
    }
    const s = fixture(); s.progression.sequence = 6; s.combat!.encounterId = 'HYPNOTIST_DISPUTE';
    Object.assign(s.hypnotist.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
    expect(currentPsychologistMindSource(s)?.target).toBe('ROWAN_SINGLE_AWAKE_ADULT');
    const rng = fixedRolls();
    expect(resolvePsychologistCombatAbility(s, 'audience.s7.frenzy', 1, rng).selfGain).toBe(28);
    expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(97);
  });

  it('requires the exact original awake adult and current round, never a practice dream or stale source', () => {
    const s = fixture(), source = currentDreamwalkerCombatSource(s)!;
    expect(source).toMatchObject({ target: 'MAS_SINGLE_AWAKE_ADULT', awareness: 'AWAKE', dream: 'NONE',
      distanceMetres: 2, exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, mind: 'ORDINARY_UNPROTECTED' });
    expect(currentPsychologistMindSource(s)?.target).toBe('MAS_SINGLE_AWAKE_ADULT');
    for (const bad of [null, { ...source, round: 2 }, { ...source, revision: s.revision + 1 },
      { ...source, target: 'COPY' }, { ...source, awareness: 'ASLEEP' }, { ...source, dream: 'NOEL' },
      { ...source, distanceMetres: 501 }, { ...source, pursuit: true }]) {
      const before = structuredClone(s), rng = fixedRolls();
      expect(effect(s, 'audience.s6.combat-hypnosis', 1, bad as DreamwalkerCombatSource | null, rng))
        .toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    for (const change of [
      (x: SliceState) => { x.dreamwalker.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.enemyStatus = 'SURRENDERED'; },
      (x: SliceState) => { x.combat!.enemyMind = 0; },
      (x: SliceState) => { x.dreamwalker.practice.dream = 'NOEL'; },
      (x: SliceState) => { x.dreamwalker.ritual.activeVisitId = 1; },
      (x: SliceState) => { x.dreamwalker.cases['paired-dream']!.contactOpen = true; },
    ]) {
      const invalid = fixture(); change(invalid); const before = structuredClone(invalid);
      expect(currentDreamwalkerCombatSource(invalid)).toBeNull();
      expect(() => resolveSliceCombatRound(invalid, 'CONTROL')).toThrow();
      expect(invalid).toEqual(before);
    }
  });

  it('returns explicit R0 for all three dream abilities without spending SP, inventing sleep or moving anything', () => {
    for (const firstCase of [false, true]) {
      const s = fixture(firstCase), before = structuredClone(s), rng = fixedRolls();
      for (const id of ['audience.s5.dream-guidance', 'audience.s5.dream-modification', 'audience.s5.dream-travel'] as const) {
        const result = effect(s, id, 1, currentDreamwalkerCombatSource(s), rng);
        expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
        expect(result.label).toContain('0效果');
      }
      expect(s).toEqual(before); expect(rng.cursor).toBe(0);
      expect(effect(s, 'audience.s5.dream-guidance').label).toContain('清醒');
      expect(effect(s, 'audience.s5.dream-travel').label).toContain('两个智慧生物');
    }
  });

  it('inherits original paid hypnosis and resistible frenzy, keeping costs on resistance and every enemy action', () => {
    for (const [check, reduction] of [[1, 18], [100, 0]]) {
      const s = fixture(); s.spirituality = 20;
      const result = recordedRound(s, 'CONTROL', 1, 86, ticket('audience.s6.combat-hypnosis', 'CONTROL'), check!, 1, 1, 1, 1);
      expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
      expect(result.round.moves.find(m => m.actor === 'PLAYER')!.enemyReduction).toBe(reduction);
      expect(result.round.moves[0]!.label).toContain('不指令自杀');
      expect(s.spirituality).toBe(27); expect(s.combat!.enemyHealth).toBe(100);
      expect(s.combat!.enemyStatus).toBe('RESISTING'); expect(result.outcome).toBe('CONTINUE');
    }
    for (const [roll, gain] of [[1, 28], [100, 0]]) {
      const s = fixture(), rng = fixedRolls(roll!);
      const result = effect(s, 'audience.s7.frenzy', 1, currentDreamwalkerCombatSource(s), rng);
      expect(result).toMatchObject({ selfGain: gain, threatens: false, mentalPressure: gain! > 0 });
      expect(s.spirituality).toBe(97); expect(rng.cursor).toBe(1);
      expect(s.combat!.enemyMind).toBe(100); expect(s.combat!.enemyHealth).toBe(100);
    }
  });

  it('keeps pure mental victory in the mental consequence branch and never causes physical injury or forced surrender', () => {
    const s = fixture(); s.spirituality = 20;
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket('audience.s7.frenzy', 'ATTACK'), 1, 400, 1, 100);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequence).toContain('精神损耗40');
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 60, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    expect(s.spirituality).toBe(27);
  });

  it('retains each inherited protection/control cost, own mastery only and one ordinary fallback on insufficient SP', () => {
    const s = fixture(); s.progression.mastery = { 'audience.s6.scales': 250, 'audience.s7.awe': 500 };
    expect(effect(s, 'audience.s6.scales').enemyReduction).toBe(21);
    expect(effect(s, 'audience.s7.soothe').enemyReduction).toBe(16);
    expect(effect(s, 'audience.s7.awe').enemyReduction).toBe(22);
    expect(effect(s, 'EVADE').enemyReduction).toBe(18); expect(s.spirituality).toBe(94);
    s.spirituality = 1; const before = structuredClone(s), rng = fixedRolls();
    expect(effect(s, 'audience.s6.combat-hypnosis', 1, currentDreamwalkerCombatSource(s), rng).enemyReduction).toBe(10);
    expect(effect(s, 'audience.s6.scales', 1, currentDreamwalkerCombatSource(s), rng).enemyReduction).toBe(10);
    expect(s).toEqual(before); expect(rng.cursor).toBe(0);
  });

  it('inherits Mas observations and shallow intent without importing Rowan, carrier history or full truth', () => {
    const s = fixture();
    expect(effect(s, 'audience.observation').label).toContain('马斯');
    expect(effect(s, 'audience.observation').label).not.toMatch(/罗温|携铃者/);
    expect(effect(s, 'audience.memory-deduction').selfGain).toBe(0);
    const read = effect(s, 'audience.mind-reading', 1, currentDreamwalkerCombatSource(s), fixedRolls(1));
    expect(read.selfGain).toBe(10); expect(read.label).toContain('马斯');
    expect(read.label).toContain('不保证下一步'); expect(s.spirituality).toBe(99);
    const first = fixture(true); const world = structuredClone(first.world);
    expect(currentPsychologistMindSource(first)?.target).toBe('ORIGINAL_LIVING_CARRIER');
    expect(effect(first, 'audience.observation').label).toContain('携铃者');
    expect(effect(first, 'audience.s6.combat-hypnosis', 1, currentDreamwalkerCombatSource(first), fixedRolls(1)).enemyReduction).toBe(18);
    expect(first.world).toEqual(world);
  });

  it('does not retain hypnosis as sleep, grant higher-sequence powers or create a weapon', () => {
    const s = fixture(); const world = structuredClone(s.world), town = structuredClone(s.town);
    effect(s, 'audience.s6.combat-hypnosis', 1, currentDreamwalkerCombatSource(s), fixedRolls(1));
    const before = structuredClone(s);
    expect(effect(s, 'audience.s5.dream-guidance').selfGain).toBe(0);
    for (const id of ['audience.s4.personality', 'audience.s4.mental-plague', 'darkness.s7.dream-drag']) {
      expect(effect(s, id as DreamwalkerMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    }
    expect(s).toEqual(before); expect(s.world).toEqual(world); expect(s.town).toEqual(town);
    expect(effect(s, 'STRIKE', 0.5).selfGain).toBe(6);
    s.town.clubLocation = 'HAND';
    expect(effect(s, 'STRIKE', 0.5).selfGain).toBe(8); expect(s.spirituality).toBe(97);
  });

  it('uses finite G base900/core30-25-30-15/floor90/S100/recovery10 and one fixed accident', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket('audience.s5.dream-guidance', 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(923 * 0.8); expect(s.spirituality).toBe(10);
    expect(result.round.moves[0]!.label).toContain('没有可进入');
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket('audience.s5.dream-guidance', 'PREPARE'), 400, 1);
    expect(ceiling.spirituality).toBe(100);
    const accident = fixture();
    const a = recordedRound(accident, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 400, 1);
    expect(a.round.moves[0]!.selfGain).toBe(-22.5); expect(accident.random.cursor).toBe(5);
    vi.spyOn(dreamwalkerCombat, 'resolveDreamwalkerCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false, mentalPressure: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket('audience.s5.dream-guidance', 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('takes the original exit without dreams, pursuit, transferred objects or altered carrier state', () => {
    const s = fixture(); s.spirituality = 98; const world = structuredClone(s.world), town = structuredClone(s.town);
    const result = recordedRound(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('实际原出口'); expect(result.round.consequence).toContain('没有梦境瞬移');
    expect(s.spirituality).toBe(98); expect(s.combat!.enemyHealth).toBe(100);
    expect(s.world).toEqual(world); expect(s.town).toEqual(town);
  });

  it('awards one25 for effective surviving victory, while retreat and player death award0', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), award = vi.fn((source: string) => { s.seer.completedSources.push(source); });
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, terminal);
      settleDreamwalkerEncounter(s, result.outcome, context(), award);
      expect(award).toHaveBeenCalledExactlyOnceWith('dreamwalker-dispute', 25);
      expect(s.dreamwalker.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.acting).toBe(25); expect(validateDreamwalkerEncounter(s)).toBe(true);
      expect(() => settleDreamwalkerEncounter(s, result.outcome, context(), award)).toThrow();
      expect(award).toHaveBeenCalledTimes(1);
    }
    const retreat = fixture(), reward = vi.fn();
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    settleDreamwalkerEncounter(retreat, r.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validateDreamwalkerEncounter(retreat)).toBe(true);
    const dead = fixture();
    const d = recordedRound(dead, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); settleDreamwalkerEncounter(dead, d.outcome, context(), reward);
    dead.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(dead.health).toBe(0);
    expect(validateDreamwalkerEncounter(dead)).toBe(true);
  });

  it('charges actual arrival, keeps refusal, permits ordinary talk and blocks every open dream/ritual/contact', () => {
    const s = fixture(); s.combat = null; s.dreamwalker.encounter = createDreamwalkerState().encounter;
    s.actionsRemaining = 4;
    for (const mutate of [
      (x: SliceState) => { x.dreamwalker.ritual.activeVisitId = 1; },
      (x: SliceState) => { x.dreamwalker.ritual.featherHolder = 'PLAYER'; },
      (x: SliceState) => { x.dreamwalker.practice.location = 'TARGET_ROOM'; },
      (x: SliceState) => { x.dreamwalker.practice.dream = 'AMINA'; },
      (x: SliceState) => { x.dreamwalker.cases['paired-dream']!.contactOpen = true; },
      (x: SliceState) => { x.dreamwalker.cases['paired-dream']!.status = 'PREPARED'; },
    ]) {
      const invalid = structuredClone(s); mutate(invalid);
      expect(blockDreamwalkerEncounter(invalid, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    }
    applyDreamwalkerEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(s.actionsRemaining).toBe(3); expect(s.dreamwalker.encounter.status).toBe('AVAILABLE');
    expect(blockDreamwalkerEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    applyDreamwalkerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(2); expect(hasDreamwalkerDisputeOpponent(s)).toBe(true);
    expect(Object.keys(s.dreamwalker.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
    const talk = fixture(); talk.combat = null; talk.dreamwalker.encounter = createDreamwalkerState().encounter;
    talk.actionsRemaining = 4; const mastery = structuredClone(talk.progression.mastery);
    applyDreamwalkerEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.dreamwalker.encounter.status).toBe('RESOLVED');
    expect(talk.progression.mastery).toEqual(mastery); expect(validateDreamwalkerEncounter(talk)).toBe(true);
    expect(blockDreamwalkerEncounter(talk, { type: 'ENCOUNTER_FIGHT' })).toContain('已有结果');
  });

  it('rejects forged results, premature scenes, stale promotion dates and duplicate or unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleDreamwalkerEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (x: SliceState) => { x.progression.sequence = 6; },
      (x: SliceState) => { x.dreamwalker.encounter.attemptWeek = 18; },
      (x: SliceState) => { x.dreamwalker.cases['dream-evidence']!.status = 'AVAILABLE'; },
      (x: SliceState) => { x.seer.completedSources.push('dreamwalker-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('dreamwalker-dispute', 'dreamwalker-dispute'); },
    ]) {
      const invalid = fixture(); mutate(invalid); expect(validateDreamwalkerEncounter(invalid)).toBe(false);
    }
    const initial = createSliceRun('dreamwalker-unpromoted-test', sliceDefaultCreationSelection, 'initial');
    expect(validateDreamwalkerEncounter(initial)).toBe(true);
  });
});
