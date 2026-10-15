import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  FIRE_THIEF_COUNT_WHEEL, beginFireThiefCombatRound, createFireThiefRoundObservations,
  currentFireThiefCombatSource, drawFireThiefAbility, fireThiefAbilityWheel, fireThiefActionCount,
  isFireThief, observeFireThiefEnemyAction, resolveFireThiefCombatAbility, resolveFireThiefEnemyAction,
  type FireThiefCombatSource, type FireThiefMoveId,
} from '../../src/domain/fire-thief/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel, createBardRoundContext, resolveBardActorCombatAbility, resolveBardCombatAbility, finishBardCombatRound, type BardEffectContext, type BardMoveId } from '../../src/domain/bard/combat.js';
import { cryptologistAbilityWheel, CRYPTOLOGIST_COUNT_WHEEL, currentCryptologistCombatSource } from '../../src/domain/cryptologist/combat.js';
import { swindlerAbilityWheel, SWINDLER_COUNT_WHEEL } from '../../src/domain/swindler/combat.js';
import { marauderAbilityWheel, MARAUDER_COUNT_WHEEL } from '../../src/domain/marauder/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const theft = 'error.s6.power-theft', borrowed = 'error.s6.borrowed-power';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT', theft];
/** Synthetic paid arrival. Public acquisition/encounter commands have separate integration tests. */
function fixture(): SliceState {
  const state = createSliceRun('fire-thief-combat-test', sliceDefaultCreationSelection, 'fire-thief-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'error', sequence: 6, mastery: { [theft]: 0, [borrowed]: 0 }, acting: 0, promotionWeek: 1 };
  state.fireThief.cases['unknown-power']!.status = 'RESOLVED';
  state.fireThief.cases['unknown-power']!.outcome = 'LIMIT_REVIEWED';
  state.fireThief.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week, enemySpirituality: 20, enemyCourageSeen: false,
    battleLoan: { playerRounds: 0, targetRounds: 0, startedRound: null, uses: 0 } };
  state.combat = { encounterId: 'FIRE_THIEF_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) { return new DeterministicActionRandomStream(state.random.seed, state.random.cursor); }
function resolve(state: SliceState, id: FireThiefMoveId,
  observations = createFireThiefRoundObservations(state), physical = 1,
  source: FireThiefCombatSource | null = currentFireThiefCombatSource(state), random = stream(state)) {
  return resolveFireThiefCombatAbility(state, id, physical, random, observations, source);
}
function enemy(state: SliceState, id: BardMoveId, suppressed = false,
  context: BardEffectContext = { pendingSupportBudgets: [], finished: false }, physical = 1) {
  return resolveFireThiefEnemyAction(state, id, suppressed, stream(state), context, physical);
}
function loan(state: SliceState) {
  state.fireThief.encounter.enemyCourageSeen = true;
  state.fireThief.encounter.battleLoan = { playerRounds: 2, targetRounds: 3, startedRound: state.combat!.round, uses: 0 };
}
/** A synthetic completed, nonterminal round for isolated clock tests. */
function nextRound(state: SliceState) {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 450,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '本轮没有有效致伤动作',
    consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.round += 1;
}
/** Keep real replay cursor consumption while selecting legal production draws. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
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

describe('Fire Thief S6 profile and old Error sequence routing', () => {
  it('routes seven exact slots and detached six-count public wheels', () => {
    const state = fixture(); expect(isFireThief(state)).toBe(true);
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([20, 15, 20, 10, 10, 7, 18]);
    expect(playerCountWheel(state)).toEqual(FIRE_THIEF_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 20, 23, 20, 12]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20); expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('preserves exact 1.25 stance weights and count boundaries without bonus draws', () => {
    for (const [stance, tickets] of [
      [null, [80, 60, 80, 40, 40, 28, 72]], ['ATTACK', [100, 75, 80, 40, 40, 28, 72]],
      ['DEFEND', [80, 60, 100, 40, 40, 28, 72]], ['CONTROL', [80, 60, 80, 50, 40, 28, 90]],
      ['PREPARE', [80, 60, 80, 40, 50, 28, 72]], ['RETREAT', [80, 60, 80, 40, 40, 28, 72]],
    ] as const) {
      const total = tickets.reduce<number>((sum, value) => sum + value, 0);
      expect(fireThiefAbilityWheel(stance).map(x => x.weight)).toEqual(tickets.map(x => total === 400 ? x / 4 : x / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawFireThiefAbility(random, stance)).toBe(ids[index]); expect(drawFireThiefAbility(random, stance)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [45, 3], [46, 4], [68, 4], [69, 5], [88, 5], [89, 6], [100, 6]]) {
      expect(fireThiefActionCount(roll!)).toBe(count);
    }
  });

  it('leaves S7 decryption, S8 deceit and S9 original profiles and source guards unchanged', () => {
    const state = fixture(); state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    for (const [sequence, wheel, count] of [
      [7, cryptologistAbilityWheel, CRYPTOLOGIST_COUNT_WHEEL],
      [8, swindlerAbilityWheel, SWINDLER_COUNT_WHEEL], [9, marauderAbilityWheel, MARAUDER_COUNT_WHEEL],
    ] as const) {
      state.progression.sequence = sequence; expect(isFireThief(state)).toBe(false);
      expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state)); expect(playerCountWheel(state)).toEqual(count);
    }
    state.progression.sequence = 7; expect(currentCryptologistCombatSource(state)).not.toBeNull();
    state.combat!.encounterId = 'FIRE_THIEF_DISPUTE'; expect(currentCryptologistCombatSource(state)).toBeNull();
  });

  it('uses core30/25/30/15, base450, cap90, max80 and recovery8 only on continuing rounds', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 280, 300, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(473);
    expect(result.round.enemyAdvantage).toBeCloseTo(203.3); expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 280, 300, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });
});

describe('Current authored bard and fact boundaries', () => {
  it('requires actual live arrival, exact week/history and no open preparation or daily loan', () => {
    const base = fixture(); expect(currentFireThiefCombatSource(base)).toMatchObject({ target: 'BELIN_SINGLE_ADULT_BARD', nature: 'SUN_SEQUENCE_9', distanceMetres: 2, pursuit: false });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.combat!.encounterId = 'FIRST_CASE'; }, s => { s.fireThief.encounter.status = 'AVAILABLE'; },
      s => { s.fireThief.encounter.attemptWeek = s.week + 1; }, s => { s.fireThief.encounter.startHistoryIndex = -1; },
      s => { s.combat!.round = 2; }, s => { s.world.city = 'TINGEN'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.status = 'DEAD'; },
      s => { s.fireThief.cases['unknown-power']!.contactOpen = true; },
      s => { s.fireThief.cases['borrowed-flash']!.status = 'PREPARED'; },
      s => { s.fireThief.loan.playerSteps = 1; }, s => { s.fireThief.loan.targetSteps = 1; },
    ];
    for (const mutate of mutations) {
      const state = structuredClone(base); mutate(state);
      expect(currentFireThiefCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'CONTROL')).toThrow(); expect(state.random.cursor).toBe(0);
    }
    const history = fixture(); nextRound(history); history.combatHistory.at(-1)!.winner = null;
    expect(currentFireThiefCombatSource(history)).toBeNull();
  });

  it('rejects stale or altered source tokens before cost, random draw or effect', () => {
    for (const key of ['runId', 'revision', 'week', 'round', 'target', 'nature', 'space', 'distanceMetres', 'startHistoryIndex', 'attemptWeek', 'exit', 'abilityObservation'] as const) {
      const state = fixture(), source = currentFireThiefCombatSource(state)!;
      const bad = { ...source, [key]: typeof source[key] === 'number' ? Number(source[key]) + 1 : 'OTHER' } as FireThiefCombatSource;
      const random = stream(state), draws = scriptRolls();
      expect(resolve(state, theft, undefined, 1, bad, random)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(state.spirituality).toBe(80); expect(draws).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });

  it('R only observes present facts and never reads a hidden pool or marks Courage seen', () => {
    const state = fixture(), before = structuredClone(state.fireThief), draws = scriptRolls();
    const result = resolve(state, 'OBSERVE');
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('不标记亲见勇气'); expect(state.fireThief).toEqual(before); expect(draws).not.toHaveBeenCalled();
  });

  it('marks knowledge only after actual unsuppressed Courage B/K using unchanged zeroS budgets', () => {
    const state = fixture();
    expect(enemy(state, 'sun.s9.praise')).toMatchObject({ selfGain: 16, courage: false, threatens: true });
    expect(enemy(state, 'sun.s9.courage', true)).toBeNull();
    expect(state.fireThief.encounter.enemyCourageSeen).toBe(false); expect(state.fireThief.encounter.enemySpirituality).toBe(20);
    expect(enemy(state, 'sun.s9.courage')).toMatchObject({ selfGain: 0, enemyReduction: 5.2 * 0.65, courage: true, threatens: false });
    expect(state.fireThief.encounter.enemyCourageSeen).toBe(true); expect(state.fireThief.encounter.enemySpirituality).toBe(20);
    const second = fixture(); expect(enemy(second, 'BREAK_FEAR')).toMatchObject({ enemyReduction: 2.8 * 0.65, courage: true });
    expect(second.fireThief.encounter.enemyCourageSeen).toBe(true);
  });

  it('blocks only stolen Courage B/K while original praise/support/body remain real', () => {
    const state = fixture(); loan(state); const context: BardEffectContext = { pendingSupportBudgets: [], finished: false };
    expect(enemy(state, 'sun.s9.courage', false, context)).toMatchObject({ selfGain: 0, enemyReduction: 10, courage: false });
    expect(enemy(state, 'BREAK_FEAR', false, context)).toMatchObject({ selfGain: 0, enemyReduction: 8, courage: false });
    expect(enemy(state, 'CHORUS_SUPPORT', false, context)).toMatchObject({ selfGain: 0, courage: false });
    expect(context.pendingSupportBudgets).toEqual([6.3 * 0.65]);
    expect(enemy(state, 'sun.s9.praise', false, context, 0.8)).toMatchObject({ selfGain: 16 * 0.8 + 6.3 * 0.65, threatens: true });
    expect(context.pendingSupportBudgets).toEqual([]); expect(state.fireThief.encounter.enemySpirituality).toBe(20);
    enemy(state, 'CHORUS_SUPPORT', false, context); expect(finishBardCombatRound(context)).toContain('不结转');
    expect(context.pendingSupportBudgets).toEqual([]);
  });

  it('reuses existing S9 six-slot effects without changing the old player wrapper or source guard', () => {
    for (const id of bardAbilityWheel(null).map(item => item.id as BardMoveId)) {
      const state = fixture(); state.progression.pathwayId = 'sun'; state.progression.sequence = 9;
      state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE'; state.world.carrierAlive = true; state.world.carrierCanResist = true;
      state.town.clubLocation = 'HAND'; state.progression.mastery = { 'sun.s9.praise': 250, 'sun.s9.courage': 500 };
      const oldContext = createBardRoundContext(state), sharedContext: BardEffectContext = { pendingSupportBudgets: [], finished: false };
      if (id === 'ACCIDENT') scriptRolls(1, 1);
      const oldEffect = resolveBardCombatAbility(state, id, 0.9, stream(state), oldContext);
      const sharedEffect = resolveBardActorCombatAbility({ armed: true, physicalStateFactor: 0.9,
        praiseMastery: 250, courageMastery: 500, targetDescription: '普通携铃者' }, id, stream(state), sharedContext);
      expect(oldEffect).toEqual(sharedEffect); expect(oldContext.pendingSupportBudgets).toEqual(sharedContext.pendingSupportBudgets);
      vi.restoreAllMocks();
    }
  });

  it('uses actual S9 enemy count boundaries, base200, max30 penalty and finite originalS20', () => {
    expect(BARD_COUNT_WHEEL.map(x => x.weight)).toEqual([35, 30, 20, 15]);
    expect(bardAbilityWheel(null).map(x => x.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [65, 2], [66, 3], [85, 3], [86, 4], [100, 4]]) {
      const state = fixture(); scriptRolls(1, roll!, 280, ...Array<number>(count!).fill(300), 1);
      const result = resolveSliceCombatRound(state, 'PREPARE'); expect(result.round.enemyCount).toBe(count);
      expect(result.round.enemyAdvantage).toBeCloseTo(203.3); expect(state.fireThief.encounter.enemySpirituality).toBe(20);
      vi.restoreAllMocks();
    }
  });
});

describe('One-use temporary sector and two independent clocks', () => {
  it('successful theft pays3S and creates2/3 windows with zero immediate contribution', () => {
    const state = fixture(); enemy(state, 'sun.s9.courage');
    const random = stream(state), draws = scriptRolls(1), result = resolve(state, theft, undefined, 1, undefined, random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(result.label).toContain('知识难度14');
    expect(state.spirituality).toBe(77); expect(state.fireThief.encounter.battleLoan).toEqual({ playerRounds: 2, targetRounds: 3, startedRound: 1, uses: 0 });
    expect(state.fireThief.encounter.enemySpirituality).toBe(20); expect(random.cursor).toBe(1); expect(draws).toHaveBeenCalledTimes(1);
  });

  it('failed production knowledge check loses3S without any clock or ability', () => {
    const state = fixture(); enemy(state, 'sun.s9.courage'); const draws = scriptRolls(100);
    expect(resolve(state, theft)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state.spirituality).toBe(77); expect(state.fireThief.encounter.battleLoan).toEqual({ playerRounds: 0, targetRounds: 0, startedRound: null, uses: 0 });
    expect(draws).toHaveBeenCalledTimes(1);
  });

  it('unknown source, inadequate S and target still locked fall back without costs or extra RNG', () => {
    for (const mode of ['UNKNOWN', 'NO_S', 'LOCKED'] as const) {
      const state = fixture();
      if (mode === 'NO_S') { state.fireThief.encounter.enemyCourageSeen = true; state.spirituality = 2; }
      if (mode === 'LOCKED') { loan(state); state.fireThief.encounter.battleLoan.playerRounds = 0; state.fireThief.encounter.battleLoan.uses = 1; }
      const before = structuredClone(state), draws = scriptRolls();
      expect(resolve(state, theft)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(draws).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });

  it('later K uses once for2S, consumes player sector only and repeated K cannot reuse it', () => {
    const state = fixture(); loan(state); const draws = scriptRolls();
    expect(resolve(state, theft)).toMatchObject({ selfGain: 0, enemyReduction: 5.2 * 0.65, threatens: false });
    expect(state.spirituality).toBe(78); expect(state.fireThief.encounter.battleLoan).toEqual({ playerRounds: 0, targetRounds: 3, startedRound: 1, uses: 1 });
    expect(resolve(state, theft)).toMatchObject({ selfGain: 0, enemyReduction: 10 }); expect(state.spirituality).toBe(78);
    expect(draws).not.toHaveBeenCalled();
  });

  it('insufficient2S preserves the still-valid sector without spending time or use count', () => {
    const state = fixture(); loan(state); state.spirituality = 1; const before = structuredClone(state.fireThief.encounter.battleLoan), draws = scriptRolls();
    expect(resolve(state, theft).enemyReduction).toBe(10); expect(state.spirituality).toBe(1);
    expect(state.fireThief.encounter.battleLoan).toEqual(before); expect(draws).not.toHaveBeenCalled();
  });

  it('clamps only borrowed mastery for the original Courage B reduction without physical threats or inherited stacking', () => {
    for (const mastery of [-1, 0, 250, 500, 900, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); loan(state); state.progression.mastery[borrowed] = mastery; state.progression.mastery[theft] = 500;
      state.progression.mastery['error.s7.decryption'] = 500;
      const level = Number.isFinite(mastery) ? Math.max(0, Math.min(500, mastery)) : 0;
      expect(resolve(state, theft, undefined, 0)).toMatchObject({ selfGain: 0, enemyReduction: 5.2 * (0.65 + 0.35 * level / 500), threatens: false });
    }
  });

  it('ticks only on an actual next round and never resurrects a consumed sector', () => {
    const state = fixture(); loan(state); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 2, targetRounds: 3 });
    nextRound(state); expect(state.fireThief.encounter.battleLoan.targetRounds).toBe(3);
    beginFireThiefCombatRound(state); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 1, targetRounds: 2 });
    resolve(state, theft); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 2, uses: 1 });
    nextRound(state); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 1, uses: 1 });
    nextRound(state); expect(beginFireThiefCombatRound(state)).toContain('贝林的原勇气能力恢复可用');
    expect(beginFireThiefCombatRound(state)).toBeNull();
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 0, uses: 1 });
  });

  it('unused player window expires a full round before target restoration', () => {
    const state = fixture(); loan(state);
    nextRound(state); beginFireThiefCombatRound(state); nextRound(state); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 1, uses: 0 });
    const draws = scriptRolls(); expect(resolve(state, theft).enemyReduction).toBe(10); expect(draws).not.toHaveBeenCalled();
    expect(enemy(state, 'sun.s9.courage')).toMatchObject({ selfGain: 0, enemyReduction: 10, courage: false });
    nextRound(state); beginFireThiefCombatRound(state);
    expect(state.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 0 });
    expect(enemy(state, 'sun.s9.courage')).toMatchObject({ selfGain: 0, enemyReduction: 5.2 * 0.65, courage: true });
  });

  it('allows a new paid attempt only after restoration and resets the new loan origin and uses', () => {
    const state = fixture(); loan(state); resolve(state, theft);
    for (let i = 0; i < 3; i += 1) { nextRound(state); beginFireThiefCombatRound(state); }
    scriptRolls(1); resolve(state, theft);
    expect(state.fireThief.encounter.battleLoan).toEqual({ playerRounds: 2, targetRounds: 3, startedRound: 4, uses: 0 });
    expect(state.spirituality).toBe(75);
  });
});

describe('Ordinary body, facts and complete round consequences', () => {
  it('holds ordinary body budgets, physical limits and original held-club ownership', () => {
    const state = fixture(); expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(12); expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8);
    state.town.clubLocation = 'HAND'; expect(resolve(state, 'BODY_STRIKE', undefined, 0.8).selfGain).toBe(12.8);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8);
    for (const physical of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(resolve(state, 'BODY_STRIKE', undefined, physical).threatens).toBe(false);
    expect(resolve(state, 'BODY_STRIKE', undefined, 2).selfGain).toBe(16);
    expect(state.fireThief.encounter.enemySpirituality).toBe(20); expect(state.spirituality).toBe(80);
  });

  it('bounds cover by actual un-offset ordinary facts and excludes suppressed/song/old observations', () => {
    const state = fixture(), observations = createFireThiefRoundObservations(state);
    observeFireThiefEnemyAction(state, observations, 'STRIKE', 16, true);
    observeFireThiefEnemyAction(state, observations, 'OPENING', 12, false, true);
    expect(observations.remainingContribution).toBe(0); expect(resolve(state, 'COVER', observations).enemyReduction).toBe(10);
    observeFireThiefEnemyAction(state, observations, 'STRIKE', 99);
    expect(resolve(state, 'COVER', observations).enemyReduction).toBe(16); expect(observations.remainingContribution).toBe(0);
    expect(resolve(state, 'COVER', observations).enemyReduction).toBe(10);
    observeFireThiefEnemyAction(state, observations, 'OPENING', 8);
    nextRound(state); expect(resolve(state, 'COVER', observations).enemyReduction).toBe(10);
    expect(state.fireThief.encounter.enemyCourageSeen).toBe(false);
  });

  it('uses real alternating draw order: observe actual song, steal, use once, guard; physical enemy actions continue', () => {
    const state = fixture(); state.spirituality = 70;
    const draws = scriptRolls(100, 85, 400, 220, 400, 1, 1, 400, 260, 400, 280, 150, 1);
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(9);
    expect(result.round.moves.filter(x => x.actor === 'ENEMY').map(x => x.selfGain)).toEqual([0, 16, 0]);
    expect(result.round.moves.filter(x => x.actor === 'ENEMY').map(x => x.enemyReduction)).toEqual([5.2 * 0.65, 0, 8]);
    expect(result.round.moves.filter(x => x.actor === 'PLAYER').map(x => x.selfGain)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(result.round.moves.filter(x => x.actor === 'PLAYER')[2]!.enemyReduction).toBe(5.2 * 0.65);
    expect(state.fireThief.encounter).toMatchObject({ enemySpirituality: 20, enemyCourageSeen: true,
      battleLoan: { playerRounds: 0, targetRounds: 3, startedRound: 1, uses: 1 } });
    expect(state.spirituality).toBe(73); expect(state.health).toBe(100); expect(state.combat!.enemyHealth).toBe(100);
    expect(result.round.consequenceWeights).toBeNull(); expect(draws).toHaveBeenCalledTimes(13); expect(state.random.cursor).toBe(13);
  });

  it('retreat uses the original exit, consumes no sector, makes no pursuit and gives no terminal recovery', () => {
    const state = fixture(); loan(state); state.spirituality = 70; const draws = scriptRolls(1, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.consequence).toContain('原导师练习场外空院的原出口');
    expect(result.round.consequence).toContain('没有瞬移或进入追逐'); expect(result.round.moves).toHaveLength(0);
    expect(state.spirituality).toBe(70); expect(state.fireThief.encounter.battleLoan.uses).toBe(0); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('keeps actual player death, enemy death and voluntary surrender without healing or pickup', () => {
    for (const ending of ['PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'] as const) {
      const state = fixture(); state.spirituality = 70; const originalWeapon = structuredClone(state.marauder.dispute.weapon);
      if (ending === 'PLAYER_DEAD') scriptRolls(1, 1, 150, 1, 1_000_000, 100);
      else scriptRolls(1, 1, 1, 300, 1, ending === 'ENEMY_DEAD' ? 100 : 70);
      const result = resolveSliceCombatRound(state, ending === 'PLAYER_DEAD' ? 'DEFEND' : 'ATTACK');
      expect(result.outcome).toBe(ending); expect(state.spirituality).toBe(70);
      expect(state.marauder.dispute.weapon).toEqual(originalWeapon); expect(currentFireThiefCombatSource(state)).toBeNull();
      if (ending === 'PLAYER_DEAD') expect(state.health).toBe(0);
      if (ending === 'ENEMY_DEAD') expect(state.combat!.enemyHealth).toBe(0);
      if (ending === 'ENEMY_SURRENDERED') { expect(state.combat!.enemyHealth).toBe(70); expect(result.round.consequence).toContain('暂窃没有强迫他投降'); }
      vi.restoreAllMocks();
    }
  });
});
