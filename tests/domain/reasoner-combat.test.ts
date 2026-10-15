import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { REASONER_COUNT_WHEEL, REASONER_ORDINARY_TARGET, consumeReasonerInterference,
  currentReasonerCombatSource, drawReasonerAbility, isReasoner, reasonerAbilityWheel, reasonerActionCount,
  resolveReasonerCombatAbility, whiteTowerKnowledgeChance,
  type ReasonerCombatSource, type ReasonerMoveId, type WhiteTowerKnowledgeInput } from '../../src/domain/reasoner/combat.js';
import { READER_COUNT_WHEEL, readerAbilityWheel } from '../../src/domain/reader/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel } from '../../src/domain/midnight/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'reader.s8.calculated-strike', secondary = 'reader.s8.ritual-attack';
const defense = 'reader.s8.tactical-calculation', control = 'reader.s8.route-interference';
const ids = [primary, secondary, defense, control, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('reasoner-combat-test', sliceDefaultCreationSelection, 'reasoner-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'white-tower', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 45;
  return state;
}
function stream(state: SliceState) { return new DeterministicActionRandomStream(state.random.seed, state.random.cursor); }
function resolve(state: SliceState, id: ReasonerMoveId, source = currentReasonerCombatSource(state)) {
  return resolveReasonerCombatAbility(state, id, 1, stream(state), source);
}
/** Script the production random source while preserving its real cursor. */
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

describe('Reasoner S8 confirmed White Tower V3 combat profile', () => {
  it('selects exact six-slot I weights, independent 40/35/25 count weights and defensive copies', () => {
    const state = fixture();
    expect(isReasoner(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(reasonerAbilityWheel(null));
    expect(reasonerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(reasonerAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(playerCountWheel(state)).toEqual(REASONER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([40, 35, 25]);
    const abilities = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    abilities[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(40);
  });

  it('uses exact boundaries and one random draw per six-slot selection', () => {
    for (const [roll, count] of [[1, 1], [40, 1], [41, 2], [75, 2], [76, 3], [100, 3]]) {
      expect(reasonerActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of reasonerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawReasonerAbility(random, null)).toBe(entry.id);
      expect(drawReasonerAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes stance weights by exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]],
      ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, value) => sum + value, 0);
      expect(reasonerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
    }
    expect(reasonerAbilityWheel('RETREAT')).toEqual(reasonerAbilityWheel(null));
  });

  it('uses base300, 10/30/20/40 core, cap60 and spirituality45 with existing penalties', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 349, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(329); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 349, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('keeps Reader S9, ordinary, Audience and Midnight profiles unchanged', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(READER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(readerAbilityWheel(null));
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['paragon', 8]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isReasoner(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'audience'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(AUDIENCE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(audienceAbilityWheel(null));
    state.progression.pathwayId = 'darkness'; state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(MIDNIGHT_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(midnightAbilityWheel(null));
  });
});

describe('actual body/tool attacks, preparation boundaries and G budgets', () => {
  it('uses unrounded 7.8f observation and 15.6f/8.4f deduction, even on failed knowledge checks', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(), factor = 0.65 + 0.35 * mastery / 500;
      state.progression.mastery['reader.s8.observation'] = mastery;
      state.progression.mastery['reader.s8.deduction'] = mastery;
      const random = stream(state), before = structuredClone(state);
      const draws = scriptRolls(1_000_000, 1_000_000);
      expect(resolveReasonerCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 7.8 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveReasonerCombatAbility(state, defense, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 15.6 * factor, threatens: false });
      expect(resolveReasonerCombatAbility(state, control, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 8.4 * factor, threatens: false });
      expect(state).toEqual(before); expect(draws).toHaveBeenCalledTimes(2);
      vi.restoreAllMocks();
    }
  });

  it('uses held club16 as replacement, while a stored club provides no bonus', () => {
    const state = fixture(); state.progression.mastery['reader.s8.observation'] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveReasonerCombatAbility(state, primary, 0.8, random);
      expect(effect.selfGain).toBe((location === 'HAND' ? 16 : 7.8) * 0.8);
      if (location === 'HAND') {
        expect(effect.label).toContain('替代本槽预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const physical of [0, -1, Number.NaN]) {
      expect(resolveReasonerCombatAbility(state, primary, physical, stream(state))).toMatchObject({ selfGain: 0, threatens: false });
    }
  });

  it('does not execute nominal4.2f rituals, invent producers or pay unapproved spirituality costs', () => {
    const state = fixture(); state.spirituality = 0;
    state.progression.mastery = { 'reader.s8.ritual-specialism': 500, 'reader.s9.ritual-procedure': 500 };
    state.knowledge = [{ id: 'ritual-secret', week: 1, title: '仪式完成', text: 'HIDDEN_RITUAL_SOURCE' }];
    for (const location of ['BAG', 'HAND'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveReasonerCombatAbility(state, secondary, 0.8, random);
      expect(effect).toMatchObject({ selfGain: (location === 'HAND' ? 16 : 12) * 0.8, enemyReduction: 0, threatens: true });
      expect(effect.label).toMatch(/改用.*不叠加4.2f.*不耗灵性、不重抽/);
      expect(effect.label).not.toContain('HIDDEN_RITUAL_SOURCE');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('keeps R0 and ±7.5 accidents from becoming attacks, forecasts or interference producers', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    expect(resolveReasonerCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    scriptRolls(1, 2);
    expect(resolveReasonerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -7.5, enemyReduction: 0, threatens: false });
    expect(resolveReasonerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 7.5, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(state).toEqual(before);
  });
});

describe('knowledge V3 and actual ordinary scene sources', () => {
  const input: WhiteTowerKnowledgeInput = { knowledge: 100, mastery: 200, tier: 1,
    targetMainAttribute: 40, targetMastery: 80, targetTier: 0, familiarity: 'NONE' };
  it('uses 0.7knowledge+0.3mastery against 0.5main+0.5mastery, tier and bounded familiarity', () => {
    // Understanding130, complexity60, tier difference1: 50+8+7=65.
    expect(whiteTowerKnowledgeChance(input)).toBe(65);
    expect(whiteTowerKnowledgeChance({ ...input, familiarity: 'FAMILIAR' })).toBe(70);
    expect(whiteTowerKnowledgeChance({ ...input, familiarity: 'VERIFIED' })).toBe(75);
    expect(whiteTowerKnowledgeChance({ ...input, tier: 9, knowledge: 500, mastery: 500 })).toBe(90);
    expect(whiteTowerKnowledgeChance({ ...input, targetTier: 9, targetMainAttribute: 500, targetMastery: 500 })).toBe(10);
    expect(REASONER_ORDINARY_TARGET).toEqual({ mainAttribute: 14, knowledge: 14, mastery: 100, tier: -1, familiarity: 'NONE' });
  });

  it('rejects incomplete/invalid target inputs instead of defaulting hidden NPC metadata to zero', () => {
    for (const invalid of [
      { ...input, targetMastery: undefined }, { ...input, targetMainAttribute: undefined },
      { ...input, targetTier: undefined }, { ...input, targetMastery: Number.NaN },
      { ...input, targetMastery: 501 }, { ...input, knowledge: -1 },
      { ...input, familiarity: 'UNAUTHORED' },
    ]) expect(() => whiteTowerKnowledgeChance(invalid as WhiteTowerKnowledgeInput)).toThrow();
  });

  it('preserves the fractional61.35% boundary with exactly one check and no future enemy draw', () => {
    const state = fixture(), random = stream(state);
    const draws = scriptRolls(613501, 613500);
    const failed = resolveReasonerCombatAbility(state, defense, 1, random);
    expect(failed.label).toContain('61.35%'); expect(failed.label).toContain('失败');
    expect(state.combat!.reasonerInterference).toBeUndefined();
    const succeeded = resolveReasonerCombatAbility(state, defense, 1, random);
    expect(succeeded.label).toContain('成功'); expect(state.combat!.reasonerInterference).toBe(true);
    expect(succeeded.enemyReduction).toBe(15.6 * 0.65);
    expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
  });

  it('never converts generic event knowledge or completed cases into target mastery, familiarity or omniscience', () => {
    const state = fixture();
    state.knowledge = [{ id: 'verified-carrier-combat', week: 1, title: 'VERIFIED', text: 'HIDDEN_TARGET_SECRET' }];
    state.progression.mastery['reader.s9.memory'] = 500;
    state.progression.mastery['reader.s9.understanding'] = 500;
    const before = structuredClone(state);
    scriptRolls(1_000_000);
    const effect = resolve(state, defense);
    expect(effect.label).toContain('61.35%'); expect(effect.label).not.toContain('HIDDEN_TARGET_SECRET');
    expect(effect.enemyReduction).toBe(15.6 * 0.65); expect(state).toEqual(before);
  });

  it('rejects stale, foreign and forged visible-scene snapshots without a check or token', () => {
    const state = fixture(), source = currentReasonerCombatSource(state)!;
    const invalid: (ReasonerCombatSource | null)[] = [null, { ...source, runId: 'another-run' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week + 1 },
      { ...source, round: 2 }, { ...source, encounterId: 'HUNTER_CARGO' } as unknown as ReasonerCombatSource,
      { ...source, target: 'HIDDEN_TARGET_SECRET' } as unknown as ReasonerCombatSource,
      { ...source, scene: 'FUTURE_ENEMY_ATTACK' } as unknown as ReasonerCombatSource];
    for (const snapshot of invalid) {
      const before = structuredClone(state), random = stream(state);
      expect(resolveReasonerCombatAbility(state, defense, 1, random, snapshot)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveReasonerCombatAbility(state, control, 1, random, snapshot)).toMatchObject({ selfGain: 0, enemyReduction: 8, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('requires a present live same-scene ordinary opponent, not a global combat history', () => {
    for (const mutate of [
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state);
      state.knowledge = [{ id: 'old-case', week: 1, title: '旧案', text: 'OLD_HIDDEN_SECRET' }];
      const random = stream(state), before = structuredClone(state);
      expect(currentReasonerCombatSource(state)).toBeNull();
      expect(resolveReasonerCombatAbility(state, defense, 1, random).enemyReduction).toBe(10);
      expect(resolveReasonerCombatAbility(state, control, 1, random).enemyReduction).toBe(8);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not resolve any S8 ability for absent combat, dead actors or another progression', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 9; }, (s: SliceState) => { s.progression.pathwayId = 'audience'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveReasonerCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('once-only saved interference in real alternating round resolution', () => {
  it('reduces only the next actual enemy positive contribution and leaves counts/actions intact', () => {
    const state = fixture();
    // One defense/check; three real enemy strikes, of which only the first is reduced.
    const draws = scriptRolls(1, 100, 121, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves[0]!.enemyReduction).toBe(15.6 * 0.65);
    expect(round.moves.slice(1).map(move => move.selfGain)).toEqual([16 * 0.85, 16, 16]);
    expect(round.moves[1]!.label).toContain('干扰已消耗');
    expect(round.moves[2]!.label).toBe('短棍打击');
    expect(round.enemyAdvantage).toBe(114 + 16 * 0.85 + 32 - 15.6 * 0.65);
    expect(state.combat!.reasonerInterference).toBeUndefined();
    expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(8);
  });

  it('waits past ordinary defense/miss and applies once to an actual opening gain', () => {
    const state = fixture();
    scriptRolls(1, 100, 249, 1, 161, 400, 241, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.slice(1).map(move => [move.selfGain, move.enemyReduction])).toEqual([[0, 10], [0, 0], [8 * 0.85, 0]]);
    expect(round.moves[1]!.label).toBe('格挡护身'); expect(round.moves[2]!.label).toBe('动作落空');
    expect(round.moves[3]!.label).toContain('干扰已消耗');
    expect(state.combat!.reasonerInterference).toBeUndefined();
  });

  it('persists through zero/negative contributions without applying to penalties or defense', () => {
    const state = fixture(); state.combat!.reasonerInterference = true;
    for (const gain of [0, -7.5, -16]) {
      expect(consumeReasonerInterference(state, gain)).toEqual({ selfGain: gain, label: '' });
      expect(state.combat!.reasonerInterference).toBe(true);
    }
    expect(consumeReasonerInterference(state, 16).selfGain).toBe(13.6);
    expect(state.combat!.reasonerInterference).toBeUndefined();
  });

  it('survives a complete round and serialization until the next actual enemy positive', () => {
    const state = fixture();
    scriptRolls(1, 1, 121, 1, 161, 1);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('CONTINUE');
    expect(state.combat!.reasonerInterference).toBe(true);
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    // Even round: enemy acts before the player's observation.
    scriptRolls(1, 1, 1, 349, 1);
    const result = resolveSliceCombatRound(restored, 'PREPARE');
    expect(result.round.first).toBe('ENEMY');
    expect(result.round.moves[0]!.selfGain).toBe(13.6);
    expect(restored.combat!.reasonerInterference).toBeUndefined();
    expect(state.combat!.reasonerInterference).toBe(true);
  });

  it('refreshes successful checks without stacking and retains an existing token after a failed check', () => {
    const state = fixture(), random = stream(state);
    scriptRolls(1, 1, 1_000_000);
    resolveReasonerCombatAbility(state, defense, 1, random);
    resolveReasonerCombatAbility(state, control, 1, random);
    resolveReasonerCombatAbility(state, defense, 1, random);
    expect(state.combat!.reasonerInterference).toBe(true);
    expect(consumeReasonerInterference(state, 16).selfGain).toBe(16 * 0.85);
    expect(consumeReasonerInterference(state, 16).selfGain).toBe(16);
  });

  it('does not apply a later calculation retroactively to an earlier enemy action', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(1, 1, 1, 121, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', label: '短棍打击', selfGain: 16 });
    expect(state.combat!.reasonerInterference).toBe(true);
  });

  it('clears pending interference on successful retreat and a fresh battle cannot inherit it from history', () => {
    const state = fixture(); state.combat!.reasonerInterference = true; state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(state.combat!.reasonerInterference).toBeUndefined(); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const fresh = fixture(); fresh.lastCombatRound = structuredClone(round); fresh.combatHistory = [structuredClone(round)];
    scriptRolls(1, 1, 349, 1, 1);
    const next = resolveSliceCombatRound(fresh, 'PREPARE');
    expect(next.round.moves[1]!.selfGain).toBe(16);
    expect(fresh.combat!.reasonerInterference).toBeUndefined();
  });

  it('keeps a token on failed retreat until an actual positive contribution occurs', () => {
    const state = fixture(); state.combat!.reasonerInterference = true;
    scriptRolls(1, 1, 51, 161, 1);
    expect(resolveSliceCombatRound(state, 'RETREAT').round.retreat).toBe('FAILURE');
    expect(state.combat!.reasonerInterference).toBe(true);
  });

  it('clears pending interference on enemy surrender/death and real player death', () => {
    for (const consequence of [66, 96]) {
      const state = fixture(); state.combat!.reasonerInterference = true;
      scriptRolls(1, 1, 1, 400, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(consequence === 66 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(state.combat!.reasonerInterference).toBeUndefined();
      vi.restoreAllMocks();
    }
    // Enemy first, then player creates a token, then actual fatal consequence.
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(1, 1, 1, 121, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0); expect(state.combat!.reasonerInterference).toBeUndefined();
  });

  it('grants no physical injury from defense/control/R0 or a positive accident, even while armed', () => {
    for (const slot of [121, 249, 349, 389]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      if (slot === 121 || slot === 249) scriptRolls(1, 1, slot, 1, 400, 1);
      else if (slot === 389) scriptRolls(1, 1, slot, 2, 400, 1);
      else scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('replays serialized pending interference deterministically without Math.random or extra resources', () => {
    const state = fixture(); state.combat!.reasonerInterference = true; state.combat!.round = 2;
    state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const before = structuredClone(state);
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
  });
});
