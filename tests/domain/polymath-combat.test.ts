import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { DETECTIVE_COUNT_WHEEL, consumePolymathInterference, createDetectiveRoundObservations,
  currentDetectiveCombatSource, currentPolymathCombatSource, detectiveAbilityWheel, detectiveActionCount,
  detectiveRepeatBonus, drawDetectiveAbility, hasDetectiveCombat, isDetective, isPolymath,
  observeDetectiveEnemyAction, resolveDetectiveCombatAbility,
  type DetectiveRoundObservations } from '../../src/domain/detective/combat.js';
import { currentWhiteTowerTacticalSource } from '../../src/domain/reasoner/combat.js';
import { applyPolymathActivity } from '../../src/domain/polymath/life.js';
import { applyPolymathEncounter, settlePolymathEncounter } from '../../src/domain/polymath/encounter.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const flash = 'reader.s6.limited-imitation';
const primary = 'reader.s7.weapon-combat', defense = 'reader.s7.battlefield-model';
const control = 'reader.s7.tactical-blockade';
const ids = [primary, 'reader.s7.trajectory-strike', defense, control, flash, 'OBSERVE', 'ACCIDENT'];
/** Combat-only fixture; the producer test below must pay for a real visit and learn its sample. */
function fixture(): SliceState {
  const state = createSliceRun('polymath-combat-test', sliceDefaultCreationSelection, 'polymath-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'white-tower', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.polymath.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'POLYMATH_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function learnFixtureFlash(state: SliceState) {
  state.polymath.samples.FLASH = { observedWeek: state.week, understoodWeek: state.week,
    learnedWeek: state.week, analysisAttemptWeek: state.week };
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
/** Preserve the actual production stream consumption while pinning only the draw being resolved. */
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
function lifeContext(state: SliceState): SeerContext {
  return { note: vi.fn(), roll: () => { throw new Error('Unexpected life draw'); },
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability,
      baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
}
function advanceOneQuietRound(state: SliceState) {
  scriptRolls(1, 1, 349, 400, 1);
  const { round } = resolveSliceCombatRound(state, 'PREPARE');
  state.combatHistory.push(structuredClone(round));
  vi.restoreAllMocks();
}
afterEach(() => vi.restoreAllMocks());

describe('Polymath S6 finite inherited wheel', () => {
  it('changes only ten blockade tickets to the learned-flash slot and preserves all S7 defaults', () => {
    const state = fixture();
    expect(isPolymath(state)).toBe(true); expect(isDetective(state)).toBe(false);
    expect(hasDetectiveCombat(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(DETECTIVE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 32, 22, 11]);
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(entry => entry.weight)).toEqual([18, 12, 32, 15, 10, 8, 5]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(detectiveAbilityWheel(stance, 6));
      expect(detectiveAbilityWheel(stance)).toEqual(detectiveAbilityWheel(stance, 7));
    }
    expect(detectiveAbilityWheel(null).map(entry => entry.id)).toEqual(ids.filter(id => id !== flash));
    expect(detectiveAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    const entries = playerAbilityWheel(state, null); entries[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(35);
    expect(ORDINARY_COUNT_WHEEL.map(entry => entry.weight)).toEqual([45, 40, 15]);
  });

  it('uses exactly the published order and integer weights for every stance and every draw boundary', () => {
    for (const [stance, tickets] of [
      [null, [72, 48, 128, 60, 40, 32, 20]],
      ['ATTACK', [90, 60, 128, 60, 40, 32, 20]],
      ['DEFEND', [72, 48, 160, 60, 40, 32, 20]],
      ['CONTROL', [72, 48, 128, 75, 50, 32, 20]],
      ['PREPARE', [72, 48, 128, 60, 40, 40, 20]],
      ['RETREAT', [72, 48, 128, 60, 40, 32, 20]],
    ] as const) {
      const total = tickets.reduce<number>((sum, weight) => sum + weight, 0);
      expect(detectiveAbilityWheel(stance, 6).map(entry => entry.weight))
        .toEqual(tickets.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawDetectiveAbility(random, stance, 6)).toBe(ids[index]);
        expect(drawDetectiveAbility(random, stance, 6)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [67, 2], [68, 3], [89, 3], [90, 4], [100, 4]]) {
      expect(detectiveActionCount(roll!)).toBe(count);
    }
  });

  it('retains tier450 and capped core90, with S6 core30/25/30/15, max80 and continuing recovery8', () => {
    const state = fixture(); state.spirituality = 79;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 349, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.round.playerAdvantage).toBe(473); expect(result.round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 349, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });

  it('retains real S7 body budgets and the held original club replacement without spending spirituality', () => {
    const state = fixture(), random = stream(state);
    state.progression.mastery = { 'reader.s7.combat-training': 500, 'reader.s7.agility': 250,
      'reader.s7.reconstruction': 0, [flash]: 500, 'reader.s6.analysis': 500 };
    const before = structuredClone(state);
    expect(resolveDetectiveCombatAbility(state, primary, 0.8, random).selfGain).toBe(17.55 * 0.8);
    expect(resolveDetectiveCombatAbility(state, 'reader.s7.trajectory-strike', 1, random).selfGain).toBe(9.45 * 0.825);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    state.town.clubLocation = 'HAND';
    expect(resolveDetectiveCombatAbility(state, primary, 0.8, random).selfGain).toBe(16 * 0.8);
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
  });
});

describe('Learned finite flash and honest ordinary fallback', () => {
  it('requires every real learning stage, never observation alone, other samples or old item knowledge', () => {
    const variants = [
      {}, { observedWeek: 1 }, { observedWeek: 1, analysisAttemptWeek: 1 },
      { observedWeek: 1, understoodWeek: 1, analysisAttemptWeek: 1 },
      { observedWeek: 1, understoodWeek: 1, learnedWeek: 2, analysisAttemptWeek: 1 },
      { observedWeek: 0, understoodWeek: 1, learnedWeek: 1, analysisAttemptWeek: 1 },
      { observedWeek: 1, understoodWeek: 1, learnedWeek: 1, analysisAttemptWeek: null },
    ];
    for (const variant of variants) {
      const state = fixture();
      Object.assign(state.polymath.samples.FLASH, variant);
      state.polymath.samples.FROST = { observedWeek: 1, understoodWeek: 1, learnedWeek: 1, analysisAttemptWeek: 1 };
      state.polymath.samples.COURAGE = { ...state.polymath.samples.FROST };
      state.knowledge = [{ id: 'old-2-081', week: 1, title: '旧物资料', text: '已见物品并不赠予完整技能库' }];
      const before = structuredClone(state), random = stream(state);
      expect(resolveDetectiveCombatAbility(state, flash, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(playerAbilityWheel(state, null).some(entry => /frost|courage/i.test(entry.id))).toBe(false);
    }
  });

  it('spends exactly2 on either result, uses one knowledge18 draw, and gives8×(1+mastery/500) only on success', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(); learnFixtureFlash(state); state.spirituality = 4;
      state.progression.mastery[flash] = mastery;
      const random = stream(state), draws = scriptRolls(44, 45);
      const success = resolveDetectiveCombatAbility(state, flash, 1, random);
      expect(success).toMatchObject({ selfGain: 0, enemyReduction: 8 * (1 + mastery / 500), threatens: false });
      expect(success.label).toContain('知识难度18检定44%，成功'); expect(state.spirituality).toBe(2);
      const failure = resolveDetectiveCombatAbility(state, flash, 1, random);
      expect(failure).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(failure.label).toContain('失败'); expect(state.spirituality).toBe(0);
      expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2);
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.combat!.reasonerInterference).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('falls back without draw or cost when short of2S or when the same-scene source is missing/stale', () => {
    for (const mutate of [
      (s: SliceState) => { s.spirituality = 1; },
      (s: SliceState) => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      (s: SliceState) => { s.polymath.encounter.attemptWeek = s.week + 1; },
      (s: SliceState) => { s.polymath.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
    ]) {
      const state = fixture(); learnFixtureFlash(state); mutate(state);
      const before = structuredClone(state), random = stream(state);
      const result = resolveDetectiveCombatAbility(state, flash, 1, random);
      expect(result.enemyReduction).toBe(10); expect(result.label).toContain('普通格挡护身');
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
    const state = fixture(); learnFixtureFlash(state);
    const observations = createDetectiveRoundObservations(state); state.revision += 1;
    const random = stream(state);
    expect(resolveDetectiveCombatAbility(state, flash, 1, random, observations).enemyReduction).toBe(10);
    expect(random.cursor).toBe(0); expect(state.spirituality).toBe(80);
  });

  it('uses the new slot in the real shared round without deleting an enemy action or granting wounds', () => {
    const state = fixture(); learnFixtureFlash(state); state.spirituality = 2;
    const draws = scriptRolls(1, 1, 324, 44, 400, 1);
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(2);
    expect(result.round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 8 });
    expect(result.round.moves[0]!.label).toContain('有限闪光模仿');
    expect(result.round.moves[1]!.actor).toBe('ENEMY');
    expect(result.round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(state.spirituality).toBe(8); expect(draws).toHaveBeenCalledTimes(6);
  });
});

describe('Actual Polymath scene and same-round observations', () => {
  it('produces the scene only after a report and a real1AP arrival, with observation, analysis and successful weak imitation', () => {
    const state = fixture(); state.combat = null;
    state.polymath.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null };
    state.actionsRemaining = 8;
    const context = lifeContext(state);
    const award = vi.fn((source: string, _amount: 5 | 8 | 25) => state.seer.completedSources.push(source));
    expect(currentPolymathCombatSource(state)).toBeNull();
    expect(() => applyPolymathEncounter(state, { type: 'ENCOUNTER_FIGHT' }, context)).toThrow();
    applyPolymathActivity(state, { type: 'OBSERVE', caseId: 'flash-study' }, context, award);
    expect(state.polymath.samples.FLASH).toMatchObject({ observedWeek: state.week, understoodWeek: null, learnedWeek: null });
    applyPolymathActivity(state, { type: 'ANALYSE', caseId: 'flash-study' }, context, award);
    expect(state.polymath.samples.FLASH).toMatchObject({ understoodWeek: state.week, learnedWeek: null });
    applyPolymathActivity(state, { type: 'PREPARE', caseId: 'flash-study', method: 'ABILITY' }, context, award);
    applyPolymathActivity(state, { type: 'PERFORM', caseId: 'flash-study' }, context, award);
    expect(state.polymath.samples.FLASH.learnedWeek).toBe(state.week);
    expect(() => applyPolymathEncounter(state, { type: 'ENCOUNTER_FIGHT' }, context)).toThrow();
    applyPolymathActivity(state, { type: 'CLOSE', caseId: 'flash-study' }, context, award);
    applyPolymathActivity(state, { type: 'REPORT', caseId: 'flash-study' }, context, award);
    const actions = state.actionsRemaining, town = structuredClone(state.town);
    const samples = structuredClone(state.polymath.samples), cursor = state.random.cursor;
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    applyPolymathEncounter(state, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(state.actionsRemaining).toBe(actions - 1); expect(state.random.cursor).toBe(cursor);
    expect(state.town).toEqual(town); expect(state.polymath.samples).toEqual(samples);
    expect(currentWhiteTowerTacticalSource(state)).toBeNull();
    expect(currentPolymathCombatSource(state)).toMatchObject({ encounterId: 'POLYMATH_DISPUTE',
      target: 'IAN_SINGLE_ORDINARY_ADULT', weapon: 'IANS_ORDINARY_SHORT_CLUB',
      space: 'ORIGINAL_LIBRARY_TEACHING_ROOM_OUTER_COURTYARD', visibility: 'MUTUALLY_VISIBLE',
      lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND',
      bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    const draws = scriptRolls(1);
    expect(resolveDetectiveCombatAbility(state, flash, 1, stream(state)).enemyReduction).toBeGreaterThanOrEqual(8);
    expect(draws).toHaveBeenCalledTimes(1);
  });

  it('requires current-week continuous completed history and a resisting living body', () => {
    const state = fixture(); advanceOneQuietRound(state);
    expect(currentPolymathCombatSource(state)).not.toBeNull();
    for (const mutate of [
      (s: SliceState) => { s.week += 1; },
      (s: SliceState) => { s.combatHistory.length = 0; },
      (s: SliceState) => { s.combatHistory[0]!.round = 2; },
      (s: SliceState) => { s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { s.combatHistory[0]!.retreat = 'SUCCESS'; },
      (s: SliceState) => { s.polymath.encounter.status = 'RESOLVED'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; },
    ]) {
      const invalid = structuredClone(state); mutate(invalid);
      expect(currentPolymathCombatSource(invalid)).toBeNull();
      const before = structuredClone(invalid);
      expect(() => resolveSliceCombatRound(invalid, 'PREPARE')).toThrow();
      expect(invalid).toEqual(before);
    }
  });

  it('uses only actual latest same-round repetitions, resets next round and never reveals a future draw', () => {
    const state = fixture(); advanceOneQuietRound(state);
    const draws = scriptRolls(90, 100, 1, 121, 1_000_000, 1, 121, 1_000_000,
      1, 121, 1_000_000, 121, 1_000_000, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    const actions = round.moves.filter(move => move.actor === 'PLAYER');
    for (const [index, bonus] of [0, 5, 10, 10].entries()) expect(actions[index]!.label).toContain(`重复加值+${bonus}`);
    expect(draws).toHaveBeenCalledTimes(14); vi.restoreAllMocks();
    state.combatHistory.push(structuredClone(round));
    for (const future of [1, 161]) {
      const next = structuredClone(state);
      scriptRolls(1, 1, 121, 1_000_000, future, 1);
      const result = resolveSliceCombatRound(next, 'PREPARE');
      expect(result.round.moves[0]!.label).toContain('尚未观察到敌方实际动作，重复加值+0');
      expect(result.round.moves[0]!.label).toContain('69.35%');
      vi.restoreAllMocks();
    }
  });

  it('caps only repetitions of the latest observed move and rejects cross-scene observation sources', () => {
    const state = fixture(), observations = createDetectiveRoundObservations(state);
    for (const bonus of [0, 5, 10, 15, 15]) {
      observeDetectiveEnemyAction(observations, 'STRIKE'); expect(detectiveRepeatBonus(state, observations)).toBe(bonus);
    }
    observeDetectiveEnemyAction(observations, 'BLOCK'); expect(detectiveRepeatBonus(state, observations)).toBe(0);
    const source = observations.source!;
    const invalid = { ...observations, source: { ...source, scene: 'HIDDEN_FUTURE' } } as unknown as DetectiveRoundObservations;
    const random = stream(state);
    expect(detectiveRepeatBonus(state, invalid)).toBe(0);
    expect(resolveDetectiveCombatAbility(state, defense, 1, random, invalid).enemyReduction).toBe(10);
    expect(resolveDetectiveCombatAbility(state, control, 1, random, invalid).enemyReduction).toBe(8);
    expect(random.cursor).toBe(0);
  });

  it('commits and validates a retained interference token through the complete public intent boundary', () => {
    const capture = JSON.parse(readFileSync('tests/fixtures/polymath-v0790/shared-stage-natural.json', 'utf8')) as { combatStart: SliceState };
    const before = migrateSliceState(capture.combatStart);
    assertValidSliceState(before);
    // A real successful battlefield model followed by an actual block retains its token.
    scriptRolls(1, 1, 121, 1, 161, 1);
    const retained = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'PREPARE' });
    expect(retained.combat!.reasonerInterference).toBe(true);
    expect(retained.combatHistory.length).toBe(before.combatHistory.length + 1);
    assertValidSliceState(retained);
    const restored = JSON.parse(JSON.stringify(retained)) as SliceState;
    assertValidSliceState(restored); vi.restoreAllMocks();
    // The next real enemy-first round consumes it exactly once, through the same boundary.
    scriptRolls(1, 1, 1, 349, 1);
    const consumed = applySliceIntent(restored, { type: 'COMBAT_ROUND', stance: 'PREPARE' });
    expect(consumed.lastCombatRound!.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 13.6 });
    expect(consumed.combat!.reasonerInterference).toBeUndefined();
    assertValidSliceState(consumed);
  });

  it('inherits only one future actual positive ordinary interference, with no extra enemy draw', () => {
    const state = fixture();
    const draws = scriptRolls(1, 100, 121, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([13.6, 16, 16]);
    expect(state.combat!.reasonerInterference).toBeUndefined(); expect(draws).toHaveBeenCalledTimes(8);
    vi.restoreAllMocks();
    const waiting = fixture(); waiting.combat!.reasonerInterference = true;
    expect(consumePolymathInterference(waiting, 0).selfGain).toBe(0);
    expect(consumePolymathInterference(waiting, -1).selfGain).toBe(-1);
    expect(waiting.combat!.reasonerInterference).toBe(true);
    expect(consumePolymathInterference(waiting, 16).selfGain).toBe(13.6);
    expect(consumePolymathInterference(waiting, 16).selfGain).toBe(16);
  });
});

describe('Real consequences, retreat and deterministic S7 compatibility', () => {
  it('retreats through the original exit with no remaining damage, cost, recovery or reward', () => {
    const state = fixture(); learnFixtureFlash(state); state.spirituality = 10;
    state.combat!.reasonerInterference = true;
    scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('伊恩'); expect(result.round.consequence).toContain('普通出口');
    expect(state.spirituality).toBe(10); expect(state.health).toBe(100);
    expect(state.combat!.reasonerInterference).toBeUndefined();
    state.combatHistory.push(result.round);
    const award = vi.fn(); settlePolymathEncounter(state, result.outcome, lifeContext(state), award);
    expect(state.polymath.encounter.status).toBe('RETREATED'); expect(state.combat).toBeNull();
    expect(award).not.toHaveBeenCalled();
  });

  it('names Ian on real surrender/death and rewards only the surviving effective participant', () => {
    for (const consequence of [66, 96]) {
      const state = fixture(); state.combat!.reasonerInterference = true;
      scriptRolls(1, 1, 1, 400, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(consequence === 66 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('伊恩');
      expect(state.combat!.enemyHealth).toBe(consequence === 66 ? 70 : 0);
      expect(state.combat!.reasonerInterference).toBeUndefined(); expect(state.health).toBe(100);
      state.combatHistory.push(result.round);
      const award = vi.fn(); settlePolymathEncounter(state, result.outcome, lifeContext(state), award);
      expect(award).toHaveBeenCalledExactlyOnceWith('polymath-dispute', 25);
      expect(state.polymath.encounter.status).toBe('RESOLVED');
      vi.restoreAllMocks();
    }
  });

  it('keeps actual player final death at0 and gives no reward or continuing recovery', () => {
    const state = fixture(); state.spirituality = 12;
    scriptRolls(1, 1, 349, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(12);
    state.status = 'DEAD'; state.combatHistory.push(result.round);
    const award = vi.fn(); settlePolymathEncounter(state, result.outcome, lifeContext(state), award);
    expect(state.polymath.encounter.status).toBe('LOST'); expect(award).not.toHaveBeenCalled();
  });

  it('retains the unchanged S7 source/wheel/check threshold and rejects an S6 imitation at S7', () => {
    const state = fixture(); state.progression.sequence = 7;
    state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(currentDetectiveCombatSource(state)).toEqual(currentWhiteTowerTacticalSource(state));
    expect(playerAbilityWheel(state, null)).toEqual(detectiveAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(DETECTIVE_COUNT_WHEEL);
    const random = stream(state); scriptRolls(693500);
    expect(resolveDetectiveCombatAbility(state, defense, 1, random).label).toContain('69.35%，成功');
    expect(resolveDetectiveCombatAbility(state, flash, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(1);
  });

  it('replays the real finite S6 round through serialization without generic random or inventory mutation', () => {
    const state = fixture(); learnFixtureFlash(state); state.random.cursor = 7;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const before = structuredClone(state);
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.polymath.samples).toEqual(before.polymath.samples);
    expect(state.town).toEqual(before.town); expect(state.progression).toEqual(before.progression);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
  });
});
