import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { DETECTIVE_COUNT_WHEEL, createDetectiveRoundObservations, currentDetectiveCombatSource,
  detectiveAbilityWheel, detectiveActionCount, detectiveRepeatBonus, drawDetectiveAbility, isDetective,
  observeDetectiveEnemyAction, resolveDetectiveCombatAbility,
  type DetectiveMoveId, type DetectiveRoundObservations } from '../../src/domain/detective/combat.js';
import { REASONER_COUNT_WHEEL, REASONER_ORDINARY_TARGET, consumeReasonerInterference,
  currentReasonerCombatSource, reasonerAbilityWheel, whiteTowerKnowledgeChance } from '../../src/domain/reasoner/combat.js';
import { READER_COUNT_WHEEL, readerAbilityWheel } from '../../src/domain/reader/combat.js';
import { ALL_KNOWING_EYE_COUNT_WHEEL, allKnowingEyeAbilityWheel } from '../../src/domain/all-knowing-eye/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'reader.s7.weapon-combat', secondary = 'reader.s7.trajectory-strike';
const defense = 'reader.s7.battlefield-model', control = 'reader.s7.tactical-blockade';
const ids = [primary, secondary, defense, control, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('detective-combat-test', sliceDefaultCreationSelection, 'detective-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'white-tower', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) { return new DeterministicActionRandomStream(state.random.seed, state.random.cursor); }
function resolve(state: SliceState, id: DetectiveMoveId, observations = createDetectiveRoundObservations(state)) {
  return resolveDetectiveCombatAbility(state, id, 1, stream(state), observations);
}
/** Script the production stream without bypassing real cursor advancement or checking a future action. */
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

describe('Detective S7 confirmed White Tower V3 profile', () => {
  it('uses I slots18/12/32/25/8/5 and counts35/32/22/11 with defensive copies', () => {
    const state = fixture();
    expect(isDetective(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(detectiveAbilityWheel(null));
    expect(detectiveAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(detectiveAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(playerCountWheel(state)).toEqual(DETECTIVE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 32, 22, 11]);
    const abilities = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    abilities[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(35);
  });

  it('preserves exact count boundaries and consumes exactly one draw per selected slot', () => {
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [67, 2], [68, 3], [89, 3], [90, 4], [100, 4]]) {
      expect(detectiveActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of detectiveAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawDetectiveAbility(random, null)).toBe(entry.id);
      expect(drawDetectiveAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only the selected stance slots by exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]],
      ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, value) => sum + value, 0);
      expect(detectiveAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
    }
    expect(detectiveAbilityWheel('RETREAT')).toEqual(detectiveAbilityWheel(null));
  });

  it('uses base450, core10/30/20/40 with core cap90 and spirituality60/status penalties', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 349, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(479); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 349, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(9);
  });

  it('leaves S8/S9/ordinary profiles unchanged and does not expose S8 source at S7', () => {
    const state = fixture(); expect(currentReasonerCombatSource(state)).toBeNull();
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(REASONER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(reasonerAbilityWheel(null));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(READER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(readerAbilityWheel(null));
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isDetective(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });

  it('delegates White Tower S1 to All-Knowing Eye without exposing older combat sources', () => {
    const state = fixture(); state.progression.sequence = 1;
    expect(isDetective(state)).toBe(false);
    expect(currentDetectiveCombatSource(state)).toBeNull(); expect(currentReasonerCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(ALL_KNOWING_EYE_COUNT_WHEEL);
    expect(playerCountWheel(state)).toHaveLength(6);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(allKnowingEyeAbilityWheel(state, 'CONTROL'));
  });
});

describe('actual physical abilities and independent mastery budgets', () => {
  it('uses exact17.55f/9.45f/29.25f/15.75f without truncation or extra costs', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(), factor = 0.65 + 0.35 * mastery / 500;
      state.spirituality = 0;
      state.progression.mastery = { 'reader.s7.combat-training': mastery,
        'reader.s7.agility': mastery, 'reader.s7.reconstruction': mastery };
      const before = structuredClone(state), random = stream(state), draws = scriptRolls(1_000_000, 1_000_000);
      expect(resolveDetectiveCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 17.55 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveDetectiveCombatAbility(state, secondary, 0.8, random)).toMatchObject({ selfGain: 9.45 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveDetectiveCombatAbility(state, defense, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 29.25 * factor, threatens: false });
      expect(resolveDetectiveCombatAbility(state, control, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 15.75 * factor, threatens: false });
      expect(state).toEqual(before); expect(draws).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    }
  });

  it('reads combat-training, agility and reconstruction separately instead of inherited/event mastery', () => {
    const state = fixture();
    state.progression.mastery = { 'reader.s7.combat-training': 500, 'reader.s7.agility': 250,
      'reader.s7.reconstruction': 0, 'reader.s8.observation': 500, 'reader.s8.deduction': 500,
      'reader.s8.ritual-specialism': 500, 'reader.s9.memory': 500, 'reader.s9.understanding': 500,
      'reader.s9.ritual-procedure': 500 };
    const before = structuredClone(state), random = stream(state); scriptRolls(1_000_000);
    expect(resolveDetectiveCombatAbility(state, primary, 1, random).selfGain).toBe(17.55);
    expect(resolveDetectiveCombatAbility(state, secondary, 1, random).selfGain).toBe(9.45 * 0.825);
    expect(resolveDetectiveCombatAbility(state, defense, 1, random).enemyReduction).toBe(29.25 * 0.65);
    expect(state).toEqual(before);
  });

  it('replaces primary with actual held club16 and never invents a weapon, ritual or thrown projectile', () => {
    const state = fixture(); state.progression.mastery['reader.s7.combat-training'] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveDetectiveCombatAbility(state, primary, 0.8, random);
      expect(effect.selfGain).toBe((location === 'HAND' ? 16 : 17.55) * 0.8);
      if (location === 'HAND') {
        expect(effect.label).toContain('替代本槽17.55f预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      }
      const trajectory = resolveDetectiveCombatAbility(state, secondary, 1, random);
      expect(trajectory.selfGain).toBe(9.45 * 0.65);
      expect(trajectory.label).toContain('不创造仪式或投射物');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const physical of [0, -1, Number.NaN]) {
      for (const id of [primary, secondary] as const) {
        expect(resolveDetectiveCombatAbility(state, id, physical, stream(state))).toMatchObject({ selfGain: 0, threatens: false });
      }
    }
  });

  it('keeps preparation at0 without observation inflation and accident±11.25 with one draw, never injury', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const observations = createDetectiveRoundObservations(state);
    observeDetectiveEnemyAction(observations, 'BLOCK');
    const snapshot = structuredClone(observations);
    expect(resolveDetectiveCombatAbility(state, 'OBSERVE', 1, random, observations)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(observations).toEqual(snapshot); expect(random.cursor).toBe(0);
    scriptRolls(1, 2);
    expect(resolveDetectiveCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -11.25, enemyReduction: 0, threatens: false });
    expect(resolveDetectiveCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 11.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(state).toEqual(before);
  });
});

describe('knowledge V3 and actual same-round repeated actions', () => {
  it('preserves exact69.35% baseline and74.35% second-use boundary with one check and no future draw', () => {
    const state = fixture(), observations = createDetectiveRoundObservations(state), random = stream(state);
    const draws = scriptRolls(693501, 693500, 743501, 743500);
    expect(resolveDetectiveCombatAbility(state, defense, 1, random, observations).label).toContain('69.35%，失败');
    expect(state.combat!.reasonerInterference).toBeUndefined();
    expect(resolveDetectiveCombatAbility(state, defense, 1, random, observations).label).toContain('69.35%，成功');
    delete state.combat!.reasonerInterference;
    observeDetectiveEnemyAction(observations, 'STRIKE'); observeDetectiveEnemyAction(observations, 'STRIKE');
    expect(resolveDetectiveCombatAbility(state, control, 1, random, observations).label).toContain('74.35%，失败');
    expect(state.combat!.reasonerInterference).toBeUndefined();
    const success = resolveDetectiveCombatAbility(state, control, 1, random, observations);
    expect(success.label).toContain('74.35%，成功'); expect(success.label).toContain('重复加值+5');
    expect(state.combat!.reasonerInterference).toBe(true);
    expect(draws).toHaveBeenCalledTimes(4); expect(random.cursor).toBe(4);
  });

  it('counts same ability only, starts at its second use, caps+15 and cannot lend a bonus to another action', () => {
    const state = fixture(), observations = createDetectiveRoundObservations(state);
    const before = structuredClone(state);
    expect(detectiveRepeatBonus(state, observations)).toBe(0);
    for (const bonus of [0, 5, 10, 15, 15]) {
      observeDetectiveEnemyAction(observations, 'STRIKE');
      expect(detectiveRepeatBonus(state, observations)).toBe(bonus);
    }
    observeDetectiveEnemyAction(observations, 'BLOCK');
    expect(detectiveRepeatBonus(state, observations)).toBe(0);
    observeDetectiveEnemyAction(observations, 'BLOCK');
    expect(detectiveRepeatBonus(state, observations)).toBe(5);
    expect(state).toEqual(before); expect(state.random.cursor).toBe(0);
  });

  it('adds repetition before the shared clamp and retains explicit nonzero ordinary target mastery', () => {
    const input = { knowledge: 100, mastery: 200, tier: 2, targetMainAttribute: 40,
      targetMastery: 80, targetTier: 0, familiarity: 'NONE' as const };
    expect(whiteTowerKnowledgeChance(input)).toBe(73);
    expect(whiteTowerKnowledgeChance({ ...input, repetitionBonus: 15 })).toBe(88);
    expect(whiteTowerKnowledgeChance({ ...input, familiarity: 'VERIFIED', repetitionBonus: 15 })).toBe(90);
    expect(whiteTowerKnowledgeChance({ ...input, targetTier: 9, targetMainAttribute: 500,
      targetMastery: 500, repetitionBonus: 15 })).toBe(10);
    for (const bonus of [-5, 1, 20, Number.NaN]) {
      expect(() => whiteTowerKnowledgeChance({ ...input, repetitionBonus: bonus })).toThrow();
    }
    expect(REASONER_ORDINARY_TARGET).toEqual({ mainAttribute: 14, knowledge: 14, mastery: 100, tier: -1, familiarity: 'NONE' });
  });

  it('observes real enemy actions in order, does not count player checks, and resets all counts next round', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(90, 100, 1, 121, 1_000_000, 1, 121, 1_000_000,
      1, 121, 1_000_000, 121, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    const actions = round.moves.filter(move => move.actor === 'PLAYER');
    for (const [index, bonus] of [0, 5, 10, 10].entries()) {
      expect(actions[index]!.label).toContain(`重复加值+${bonus}`);
    }
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(14);
    vi.restoreAllMocks();
    // Previous nested/global histories contain three strikes. The new player-first round has seen none.
    state.combatHistory = [structuredClone(round)];
    scriptRolls(1, 1, 121, 1_000_000, 1, 1);
    const next = resolveSliceCombatRound(state, 'PREPARE');
    expect(next.round.moves[0]!.label).toContain('尚未观察到敌方实际动作，重复加值+0');
    expect(next.round.moves[0]!.label).toContain('69.35%');
  });

  it('cannot use a future enemy draw, generic knowledge or old encounter histories as repetitions', () => {
    for (const future of [1, 161]) {
      const state = fixture();
      state.knowledge = [{ id: 'old-case', week: 1, title: 'VERIFIED', text: 'HIDDEN_TARGET_SECRET' }];
      const before = structuredClone(state.knowledge);
      const draws = scriptRolls(1, 1, 121, 1_000_000, future, 1);
      const { round } = resolveSliceCombatRound(state, 'PREPARE');
      expect(round.moves[0]!.label).toContain('尚未观察到敌方实际动作，重复加值+0');
      expect(round.moves[0]!.label).toContain('69.35%');
      expect(JSON.stringify(round)).not.toContain('HIDDEN_TARGET_SECRET');
      expect(state.knowledge).toEqual(before); expect(draws).toHaveBeenCalledTimes(6);
      vi.restoreAllMocks();
    }
  });

  it('rejects stale/cross-run/altered scene sources without randomness or reading foreign observation text', () => {
    const state = fixture(), current = createDetectiveRoundObservations(state);
    observeDetectiveEnemyAction(current, 'STRIKE'); observeDetectiveEnemyAction(current, 'STRIKE');
    const source = current.source!;
    const invalid: DetectiveRoundObservations[] = [
      { ...current, source: null }, { ...current, source: { ...source, round: 2 } },
      { ...current, source: { ...source, revision: source.revision + 1 } },
      { ...current, source: { ...source, runId: 'another-run' } },
      { ...current, source: { ...source, week: source.week + 1 } },
      { ...current, source: { ...source, scene: 'HIDDEN_FUTURE' } } as unknown as DetectiveRoundObservations,
    ];
    for (const observations of invalid) {
      const before = structuredClone(state), random = stream(state);
      expect(detectiveRepeatBonus(state, observations)).toBe(0);
      expect(resolveDetectiveCombatAbility(state, defense, 1, random, observations)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveDetectiveCombatAbility(state, control, 1, random, observations)).toMatchObject({ selfGain: 0, enemyReduction: 8, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('requires FIRST_CASE live visible opponent and rejects wrong progression or ended combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentDetectiveCombatSource(state)).toBeNull();
      expect(resolveDetectiveCombatAbility(state, defense, 1, random).enemyReduction).toBe(10);
      expect(resolveDetectiveCombatAbility(state, control, 1, random).enemyReduction).toBe(8);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.pathwayId = 'audience'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentDetectiveCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveDetectiveCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('inherited once-only interference and shared encounter lifecycle', () => {
  it('reduces only the next actual positive contribution and preserves all actual ordinary enemy actions', () => {
    const state = fixture();
    const draws = scriptRolls(1, 100, 121, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 3]);
    expect(round.moves.slice(1).map(move => move.selfGain)).toEqual([13.6, 16, 16]);
    expect(round.moves[1]!.label).toContain('干扰已消耗');
    expect(round.moves[2]!.label).toBe('短棍打击');
    expect(state.combat!.reasonerInterference).toBeUndefined();
    expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(8);
  });

  it('waits past defenses/misses and survives serialization across rounds until one actual positive', () => {
    const state = fixture();
    scriptRolls(1, 1, 121, 1, 161, 1);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('CONTINUE');
    expect(state.combat!.reasonerInterference).toBe(true);
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    scriptRolls(1, 100, 1, 349, 1, 1, 1);
    const result = resolveSliceCombatRound(restored, 'PREPARE');
    expect(result.round.first).toBe('ENEMY');
    expect(result.round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([13.6, 16, 16]);
    expect(restored.combat!.reasonerInterference).toBeUndefined();
    expect(state.combat!.reasonerInterference).toBe(true);
    vi.restoreAllMocks();
    const waiting = fixture();
    scriptRolls(1, 100, 249, 1, 161, 400, 241, 1);
    const waited = resolveSliceCombatRound(waiting, 'PREPARE');
    expect(waited.round.moves.slice(1).map(move => [move.selfGain, move.enemyReduction])).toEqual([[0, 10], [0, 0], [6.8, 0]]);
    expect(waiting.combat!.reasonerInterference).toBeUndefined();
  });

  it('refreshes successful checks without stacking, failed checks preserve a token, zero/negative do not consume', () => {
    const state = fixture(), random = stream(state); scriptRolls(1, 1, 1_000_000);
    resolveDetectiveCombatAbility(state, defense, 1, random);
    resolveDetectiveCombatAbility(state, control, 1, random);
    resolveDetectiveCombatAbility(state, defense, 1, random);
    expect(state.combat!.reasonerInterference).toBe(true);
    for (const value of [0, -11.25]) {
      expect(consumeReasonerInterference(state, value)).toEqual({ selfGain: value, label: '' });
      expect(state.combat!.reasonerInterference).toBe(true);
    }
    expect(consumeReasonerInterference(state, 16).selfGain).toBe(13.6);
    expect(consumeReasonerInterference(state, 16).selfGain).toBe(16);
  });

  it('clears the token on successful retreat, enemy surrender/death and player death', () => {
    const retreating = fixture(); retreating.combat!.reasonerInterference = true; retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreating.combat!.reasonerInterference).toBeUndefined(); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    for (const consequence of [66, 96]) {
      const state = fixture(); state.combat!.reasonerInterference = true;
      scriptRolls(1, 1, 1, 400, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(consequence === 66 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(state.combat!.reasonerInterference).toBeUndefined();
      vi.restoreAllMocks();
    }
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(1, 1, 1, 121, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0); expect(state.combat!.reasonerInterference).toBeUndefined();
  });

  it('keeps the ordinary failed retreat and never grants physical injury from defense/control/R0/accident', () => {
    const state = fixture(); state.combat!.reasonerInterference = true;
    scriptRolls(1, 1, 51, 161, 1);
    expect(resolveSliceCombatRound(state, 'RETREAT').round.retreat).toBe('FAILURE');
    expect(state.combat!.reasonerInterference).toBe(true); vi.restoreAllMocks();
    for (const slot of [121, 249, 349, 389]) {
      const safe = fixture(); safe.town.clubLocation = 'HAND';
      if (slot === 121 || slot === 249) scriptRolls(1, 1, slot, 1, 400, 1);
      else if (slot === 389) scriptRolls(1, 1, slot, 2, 400, 1);
      else scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(safe, 'PREPARE');
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(safe.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('replays serialized combat deterministically without Math.random or extra resources, mastery or events', () => {
    const state = fixture(); state.combat!.reasonerInterference = true; state.combat!.round = 2;
    state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState, before = structuredClone(state);
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.knowledge).toEqual(before.knowledge); expect(state.activeEvent).toBeNull();
  });
});
