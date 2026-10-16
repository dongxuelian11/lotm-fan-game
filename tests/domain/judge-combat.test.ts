import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  JUDGE_COUNT_WHEEL, createJudgeRoundContext, currentJudgeCombatSource, drawJudgeAbility,
  finishJudgeCombatRound, isJudge, judgeAbilityWheel, judgeActionCount, judgeEnemyProhibition,
  resolveJudgeCombatAbility, type JudgeCombatSource, type JudgeMoveId,
} from '../../src/domain/judge/combat.js';
import * as judgeCombat from '../../src/domain/judge/combat.js';
import { createJudgeState } from '../../src/domain/judge/index.js';
import { settleJudgeEncounter } from '../../src/domain/judge/encounter.js';
import { ARBITER_COUNT_WHEEL, arbiterAbilityWheel, currentArbiterCombatSource } from '../../src/domain/arbiter/combat.js';
import { SHERIFF_COUNT_WHEEL, sheriffAbilityWheel, currentSheriffCombatSource } from '../../src/domain/sheriff/combat.js';
import { INTERROGATOR_COUNT_WHEEL, interrogatorAbilityWheel, currentInterrogatorCombatSource,
  resolveInterrogatorCombatAbility } from '../../src/domain/interrogator/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'justiciar.s9.combat-training', J = 'BODY_FOLLOWUP', B = 'justiciar.s7.mental-puncture';
const K = 'justiciar.s6.prohibition', R = 'justiciar.s6.authority', A = 'ACCIDENT';
const trace = 'justiciar.s8.trace-sensing', ids = [H, J, B, K, R, A] as const;
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('judge-combat-test', sliceDefaultCreationSelection, 'judge-combat');
  state.activeEvent = null; state.eventQueue = []; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'justiciar', sequence: 6, mastery: {
    [H]: 0, 'justiciar.s9.authority': 0, 'justiciar.s9.persuasive-charisma': 0,
    [trace]: 0, 'justiciar.s8.image-reconstruction': 0,
    [B]: 0, 'justiciar.s7.mental-pressure': 0, [K]: 0, [R]: 0,
  }, acting: 0, promotionWeek: 1 };
  state.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.judge = createJudgeState();
  state.judge.encounter = { status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 };
  Object.assign(state.judge.cases['calm-room']!, { status: 'RESOLVED', method: 'ORDINARY' });
  state.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'JUDGE_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
    enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-judge-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: JudgeMoveId, physical = 1,
  context = createJudgeRoundContext(state), random = fixedRolls(), source = currentJudgeCombatSource(state)) {
  return resolveJudgeCombatAbility(state, id, physical, random, context, source);
}
/** Keep exact real cursor increments and reject any redraw or surplus action. */
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
function expectActualConsequenceDraw(draws: ReturnType<typeof scriptRolls>, roll: number): void {
  // Ordinary physical consequences use the shared real draw without persisting
  // the optional magician/psychologist consequenceRoll presentation field.
  expect(draws).toHaveBeenLastCalledWith(1, 100);
  expect(draws.mock.results.at(-1)).toMatchObject({ type: 'return', value: roll });
}
afterEach(() => vi.restoreAllMocks());

describe('Judge S6 exact finite profile and inherited gates', () => {
  it('selects only justiciar6, six30/15/25/10/15/5 slots and detached10/15/25/30/20 counts', () => {
    const state = fixture(); expect(isJudge(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(judgeAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(JUDGE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(JUDGE_COUNT_WHEEL)).toBe(true); expect(JUDGE_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    expect(Object.keys(state.progression.mastery).filter(x => x.includes('.s6.')).sort()).toEqual([R, K].sort());
    state.progression.pathwayId = 'black-emperor'; expect(isJudge(state)).toBe(false);
  });

  it('retains count boundaries and exact1.25 stance tickets with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]] as const)
      expect(judgeActionCount(roll)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1, 2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      judgeAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawJudgeAbility(random, stance)).toBe(ids[index]); expect(drawJudgeAbility(random, stance)).toBe(ids[index]);
        expect(random.cursor).toBe(2);
      });
      expect(boundary).toBe(total);
    }
  });

  it('uses G core30/20/35/15, tier650, core cap130, floor65 and max80/recovery8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(1, 1, 321, 381, 1); // no-S R, ordinary MISS, winner; no extra rolls
    expect(resolveSliceCombatRound(state, 'DEFEND')).toMatchObject({ outcome: 'CONTINUE', round: { playerAdvantage: 673.5 * 0.8, enemyAdvantage: 114 } });
    expect(state.spirituality).toBe(8); expect(state.random.cursor).toBe(5); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 321, 381, 1);
    expect(resolveSliceCombatRound(capped, 'DEFEND').round.playerAdvantage).toBe(780 * 0.6); vi.restoreAllMocks();
    const ceiling = fixture(); ceiling.spirituality = 79;
    scriptRolls(1, 1, 381, 381, 1); resolveSliceCombatRound(ceiling, 'DEFEND');
    expect(ceiling.spirituality).toBe(80); vi.restoreAllMocks();
    vi.spyOn(judgeCombat, 'resolveJudgeCombatAbility').mockReturnValue({ label: 'test-negative', selfGain: -10_000, enemyReduction: 0, threatens: false });
    scriptRolls(1, 1, 381, 381, 1);
    expect(resolveSliceCombatRound(fixture(), 'DEFEND').round.playerAdvantage).toBe(65);
  });

  it('leaves exact old9/8/7 wheels, FIRST_CASE gates and S7 accident RNG unchanged', () => {
    for (const [sequence, counts, wheel, source] of [
      [9, ARBITER_COUNT_WHEEL, arbiterAbilityWheel, currentArbiterCombatSource],
      [8, SHERIFF_COUNT_WHEEL, sheriffAbilityWheel, currentSheriffCombatSource],
      [7, INTERROGATOR_COUNT_WHEEL, interrogatorAbilityWheel, currentInterrogatorCombatSource],
    ] as const) {
      const state = fixture(true); state.progression.sequence = sequence;
      expect(isJudge(state)).toBe(false); expect(currentJudgeCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(counts); expect(playerAbilityWheel(state, 'CONTROL')).toEqual(wheel('CONTROL', state));
      expect(source(state)).not.toBeNull(); state.combat!.encounterId = 'JUDGE_DISPUTE'; expect(source(state)).toBeNull();
    }
    const old = fixture(true); old.progression.sequence = 7; old.spirituality = 60;
    const random = fixedRolls(2); expect(resolveInterrogatorCombatAbility(old, A, 1, random).selfGain).toBe(11.25);
    expect(random.cursor).toBe(1);
    scriptRolls(1, 1, 381, 2, 381, 1);
    const result = resolveSliceCombatRound(old, 'DEFEND'); expect(result.round.playerAdvantage).toBe(476.25);
    expect(old.random.cursor).toBe(6); expect(old.spirituality).toBe(60);
    old.progression.sequence = 6; expect(currentInterrogatorCombatSource(old)).toBeNull();
  });
});

describe('Judge original mastery, originals and costs', () => {
  it('H50.7/J35.49 use only inherited combat mastery; only actual town HAND substitutes16', () => {
    for (const mastery of [0, 100, 500]) for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.progression.mastery[H] = mastery;
      state.progression.mastery[K] = 500; state.progression.mastery[R] = 500; state.town.clubLocation = location;
      const before = structuredClone(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, H, 0.8)).toMatchObject({ selfGain: (location === 'HAND' ? 16 : 50.7 * f) * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, J, 0.8)).toMatchObject({ selfGain: 35.49 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(state).toEqual(before);
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    }
  });

  it('B inherits exactly one55+20m/500 hit draw, spends3 and is nonphysical42.25f with no wound threat', () => {
    for (const mastery of [0, 100, 500]) for (const success of [true, false]) {
      const state = fixture(); state.progression.mastery[B] = mastery; state.progression.mastery[R] = 500;
      const threshold = 55 + 20 * mastery / 500, random = fixedRolls(threshold + (success ? 0 : 1));
      const before = structuredClone(state), effect = resolve(state, B, 0, undefined, random);
      expect(effect).toMatchObject({ selfGain: success ? 42.25 * (0.65 + 0.35 * mastery / 500) : 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain(`阈值${threshold}`); expect(random.cursor).toBe(1);
      before.spirituality -= 3; expect(state).toEqual(before);
    }
  });

  it('R uses only new authority mastery and one35+15m/500 draw; no truth, mind control or injury', () => {
    for (const mastery of [0, 100, 500]) for (const success of [true, false]) {
      const state = fixture(); state.progression.mastery[R] = mastery;
      state.progression.mastery['justiciar.s9.authority'] = 500; state.progression.mastery['justiciar.s7.mental-pressure'] = 500;
      const threshold = 35 + 15 * mastery / 500, random = fixedRolls(threshold + (success ? 0 : 1)), before = structuredClone(state);
      const effect = resolve(state, R, 0, undefined, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: success ? 21.125 * (0.65 + 0.35 * mastery / 500) : 0, threatens: false });
      expect(effect.label).toContain('不保证真话'); expect(effect.label).toContain('不控制意志');
      before.spirituality -= 3; expect(state).toEqual(before); expect(random.cursor).toBe(1);
    }
  });

  it('insufficient/nonfinite S gives trace42.25f body, K position6body and R0 with no draw or payment', () => {
    for (const spirituality of [0, 1, 2.99, Number.NaN, Infinity]) {
      const state = fixture(); state.spirituality = spirituality; state.progression.mastery[trace] = 100;
      state.progression.mastery[B] = 500; const before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, B, 0.8, undefined, random).enemyReduction).toBe(42.25 * 0.72 * 0.8);
      expect(resolve(state, K, 0.8, undefined, random).enemyReduction).toBe(6 * 0.8);
      expect(resolve(state, R, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('A is fixed−16.25 with no RNG, cost or threat, even at zero spirituality', () => {
    const state = fixture(); state.spirituality = 0; const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, A, 0, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });

  it('bounds malformed mastery/body factors without suppressing successful mental slots', () => {
    for (const mastery of [-1, Number.NaN, Infinity, 900]) for (const physical of [-1, Number.NaN, Infinity, 0, 0.8, 1, 3]) {
      const state = fixture(); state.progression.mastery = { [H]: mastery, [B]: mastery, [R]: mastery };
      const f = mastery === 900 ? 1 : 0.65, body = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0;
      expect(resolve(state, H, physical).selfGain).toBe(50.7 * f * body);
      expect(resolve(state, J, physical).selfGain).toBe(35.49 * f * body);
      expect(resolve(state, B, physical, undefined, fixedRolls(1)).selfGain).toBe(42.25 * f);
      expect(resolve(state, R, physical, undefined, fixedRolls(1)).enemyReduction).toBe(21.125 * f);
    }
  });
});

describe('Judge finite symmetric prohibition', () => {
  it('K spends3 for one55+20m/500 resistance, has no immediate gain or threat, and duplicates are free/no-draw', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.spirituality = 3; state.progression.mastery[K] = mastery;
      const context = createJudgeRoundContext(state), random = fixedRolls(55 + 20 * mastery / 500), before = structuredClone(state);
      const effect = resolve(state, K, 0, context, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('G公平规则'); expect(context.closeStrikesProhibited).toBe(true);
      before.spirituality = 0; expect(state).toEqual(before); expect(random.cursor).toBe(1);
      expect(resolve(state, K, 1, context, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(1); expect(state).toEqual(before);
    }
  });

  it('failed K still spends3 but only contributes position6body, with no restriction or reroll', () => {
    const state = fixture(), context = createJudgeRoundContext(state), random = fixedRolls(56);
    const effect = resolve(state, K, 0.8, context, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
    expect(context.closeStrikesProhibited).toBe(false); expect(state.spirituality).toBe(77); expect(random.cursor).toBe(1);
    expect(resolve(state, H, 1, context).threatens).toBe(true);
    expect(judgeEnemyProhibition(state, context, 'STRIKE')).toBeNull();
  });

  it('applies to both actual player H/J and enemy STRIKE; defense, positioning and mental abilities stay legal', () => {
    const state = fixture(), context = createJudgeRoundContext(state); state.town.clubLocation = 'HAND';
    resolve(state, K, 1, context, fixedRolls(1)); const before = structuredClone(state);
    for (const id of [H, J]) expect(resolve(state, id, 1, context)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(judgeEnemyProhibition(state, context, 'STRIKE')).toContain('实际抽出并消耗');
    for (const id of ['BLOCK', 'OPENING', 'DISTANCE', 'MISS']) expect(judgeEnemyProhibition(state, context, id)).toBeNull();
    expect(state).toEqual(before); // no change to town HAND or anyone's original item
    expect(resolve(state, B, 0, context, fixedRolls(1))).toMatchObject({ selfGain: 42.25 * 0.65, threatens: false });
    expect(resolve(state, R, 0, context, fixedRolls(1))).toMatchObject({ enemyReduction: 21.125 * 0.65, threatens: false });
  });

  it('expires once at round end without state persistence; stale round/source cannot constrain another round', () => {
    const state = fixture(), context = createJudgeRoundContext(state);
    resolve(state, K, 1, context, fixedRolls(1)); const before = structuredClone(state);
    expect(finishJudgeCombatRound(context)).toContain('自动消散'); expect(context.closeStrikesProhibited).toBe(false);
    expect(finishJudgeCombatRound(context)).toBeNull(); expect(state).toEqual(before);
    expect(resolve(state, H, 1, context).threatens).toBe(true);
    context.closeStrikesProhibited = true; state.revision += 1;
    expect(judgeEnemyProhibition(state, context, 'STRIKE')).toBeNull();
    expect(resolve(state, H, 1, context)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(createJudgeRoundContext(state).closeStrikesProhibited).toBe(false);
    expect(JSON.stringify(state.combat)).not.toContain('closeStrikesProhibited');
  });
});

// DEFEND has neutral Judge tickets: H1–120/J121–180/B181–280/K281–320/R321–380/A381–400.
describe('Judge real round order, draws and shared consequences', () => {
  it('early K zeros both later enemy strike and player H/J while an actual enemy BLOCK still reduces10', () => {
    const state = fixture(); state.spirituality = 70; const originals = structuredClone({ town: state.town, judge: state.judge });
    const rolls = scriptRolls(26, 46, 281, 1, 1, 1, 161, 121, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.map(m => m.selfGain)).toEqual([0, 0, 0, 0, 0]);
    expect(round.moves.map(m => m.enemyReduction)).toEqual([0, 0, 0, 10, 0]);
    expect(round.playerAdvantage).toBe(655); expect(round.enemyAdvantage).toBe(114);
    expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
    expect(round.consequence).toContain('自动消散'); expect(state.spirituality).toBe(75);
    expect(rolls).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(9);
    expect({ town: state.town, judge: state.judge }).toEqual(originals);
  });

  it('late K never erases earlier H/STRIKE gain or physical threat; only later J/STRIKE are zero', () => {
    const state = fixture(), rolls = scriptRolls(26, 86, 1, 1, 281, 1, 1, 121, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves.map(m => m.selfGain)).toEqual([50.7 * 0.65, 16, 0, 0, 0, 0]);
    expectActualConsequenceDraw(rolls, 1); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1); expect(round.consequence).toContain('自动消散');
    expect(rolls).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(11);
  });

  it('even round keeps enemy strike before K and its real injury, while later strike is consumed harmlessly', () => {
    const state = fixture(true); state.combat!.round = 2;
    const rolls = scriptRolls(11, 46, 1, 281, 1, 1, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.first).toBe('ENEMY');
    expect(round.moves.map(m => m.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.map(m => m.selfGain)).toEqual([16, 0, 0, 0]);
    expect(round.winner).toBe('ENEMY'); expectActualConsequenceDraw(rolls, 1); expect(state.health).toBe(90);
    expect(state.injuries).toHaveLength(1); expect(rolls).toHaveBeenCalledTimes(9);
  });

  it('failed K does not suppress either later actual strike or later H', () => {
    const state = fixture(), rolls = scriptRolls(11, 1, 281, 56, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves.map(m => m.selfGain)).toEqual([0, 16, 50.7 * 0.65]);
    expect(round.moves[0]!.enemyReduction).toBe(6); expectActualConsequenceDraw(rolls, 1);
    expect(state.combat!.enemyHealth).toBe(90); expect(state.combat!.enemyInjuries[0]!.severity).toBe('LIGHT');
    expect(round.consequence).not.toContain('自动消散'); expect(rolls).toHaveBeenCalledTimes(8);
  });

  it('insufficient K draws no resistance, both attacks remain, and costs nothing', () => {
    const state = fixture(); state.spirituality = 2;
    const rolls = scriptRolls(11, 1, 281, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves.map(m => m.selfGain)).toEqual([0, 16, 50.7 * 0.65]);
    expect(round.moves[0]!.enemyReduction).toBe(6); expect(state.spirituality).toBe(10);
    expect(rolls).toHaveBeenCalledTimes(7);
  });

  it('repeated K retains each actual slot, pays once and makes only the original resistance draw', () => {
    const state = fixture(); state.spirituality = 20;
    const rolls = scriptRolls(26, 1, 281, 1, 1, 281, 281, 1);
    const { round } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves).toHaveLength(4); expect(round.moves.every(m => m.selfGain === 0 && m.enemyReduction === 0)).toBe(true);
    expect(round.moves[2]!.label).toContain('抵抗抽签0'); expect(round.moves[3]!.label).toContain('抵抗抽签0');
    expect(state.spirituality).toBe(25); expect(rolls).toHaveBeenCalledTimes(8);
  });

  it('mental B/R survive active K but never independently open physical injury or death', () => {
    const state = fixture(); const rolls = scriptRolls(26, 1, 281, 1, 1, 181, 1, 321, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves.map(m => m.selfGain)).toEqual([0, 0, 42.25 * 0.65, 0]);
    expect(round.moves[3]!.enemyReduction).toBe(21.125 * 0.65);
    expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyMind).toBe(100);
    expect(rolls).toHaveBeenCalledTimes(10);
  });

  it('next committed round restores both strikes without leaking a prohibition flag', () => {
    const state = fixture(); scriptRolls(1, 1, 281, 1, 1, 1);
    const first = resolveSliceCombatRound(state, 'DEFEND'); state.combatHistory.push(first.round);
    expect(first.round.consequence).toContain('自动消散'); vi.restoreAllMocks();
    const rolls = scriptRolls(1, 1, 1, 1, 1, 1);
    const second = resolveSliceCombatRound(state, 'DEFEND');
    expect(second.round.first).toBe('ENEMY'); expect(second.round.moves.map(m => m.selfGain)).toEqual([16, 50.7 * 0.65]);
    expectActualConsequenceDraw(rolls, 1); expect(second.round.consequence).not.toContain('自动消散');
    expect(state.combat!.enemyHealth).toBe(90); expect(state.combat!.enemyInjuries[0]!.severity).toBe('LIGHT');
    expect(rolls).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(12);
  });
});

describe('Judge real sources, exit and terminal boundaries', () => {
  it('offers only FIRST_CASE or Evan with his own HAND club, real2m courtyard and nonpursuit EXIT', () => {
    expect(currentJudgeCombatSource(fixture(true))).toMatchObject({ encounterId: 'FIRST_CASE', target: 'CURRENT_VISIBLE_ORDINARY_CARRIER' });
    expect(currentJudgeCombatSource(fixture())).toMatchObject({ encounterId: 'JUDGE_DISPUTE', target: 'EVAN_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'EVANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', visibility: 'MUTUALLY_VISIBLE', distanceMetres: 2,
      space: 'ORIGINAL_CLEAR_COURTYARD', exit: 'ORIGINAL_OPEN_EXIT', bystanders: 'NONE', pursuit: false });
    const state = fixture(); state.combat!.encounterId = 'CORRUPTION_BARON_DISPUTE'; expect(currentJudgeCombatSource(state)).toBeNull();
  });

  it('rejects inactive/dead/stale/mismatched sources before payment or RNG', () => {
    const invalid: ((s: SliceState) => void)[] = [
      s => { s.status = 'DEAD'; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.health = Number.NaN; }, s => { s.combat!.enemyHealth = 0; }, s => { s.combat!.enemyMind = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.combat!.enemyStatus = 'DEAD'; },
      s => { s.judge.encounter.status = 'RETREATED'; }, s => { s.judge.encounter.attemptWeek = s.week - 1; },
      s => { s.judge.encounter.startHistoryIndex = 1; }, s => { s.combat!.round = 2; },
      s => { s.revision = -1; }, s => { s.week = 0; }, s => { s.progression.sequence = 7; },
      s => { s.judge.cases['calm-room']!.status = 'AVAILABLE'; },
      s => { s.judge.cases['marked-line']!.status = 'PREPARED'; }, s => { s.judge.cases['marked-line']!.contactOpen = true; },
    ];
    for (const change of invalid) {
      const state = fixture(), source = currentJudgeCombatSource(state), context = createJudgeRoundContext(state);
      change(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentJudgeCombatSource(state)).toBeNull();
      expect(resolve(state, K, 1, context, random, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'DEFEND')).toThrow(); expect(state).toEqual(before);
    }
    const state = fixture(), context = createJudgeRoundContext(state), source = currentJudgeCombatSource(state)!;
    const bad = { ...source, target: 'IMAGINED_HIDDEN_PERSON' } as unknown as JudgeCombatSource;
    expect(resolve(state, K, 1, context, fixedRolls(), bad).selfGain).toBe(0); expect(state.spirituality).toBe(80);
    state.revision += 1;
    expect(resolve(state, K, 1, context, fixedRolls(), source).selfGain).toBe(0); expect(state.spirituality).toBe(80);
  });

  it('blocks every open/unsafely placed life-practice state on both encounters without importing it into battle', () => {
    const invalid: ((s: SliceState) => void)[] = [
      s => { s.judge.practice.audience = 'ADDRESSED'; }, s => { s.judge.practice.audience = 'ATTENTIVE'; },
      s => { s.judge.practice.boundary = 'ATTEMPTED'; }, s => { s.judge.practice.boundary = 'HELD'; },
      s => { s.judge.practice.token = 'OUTSIDE_TABLE'; }, s => { s.judge.practice.token = 'HELD_ON_TABLE'; },
    ];
    for (const firstCase of [false, true]) for (const change of invalid) {
      const state = fixture(firstCase); change(state); const before = structuredClone(state);
      expect(currentJudgeCombatSource(state)).toBeNull(); expect(() => resolveSliceCombatRound(state, 'DEFEND')).toThrow();
      expect(state).toEqual(before);
    }
    const state = fixture(); Object.assign(state.judge.practice, { audience: 'FREE', boundary: 'RELEASED', token: 'RETURNED', lineTestedBy: 'BOTH', tokenTestedBy: 'BOTH' });
    expect(currentJudgeCombatSource(state)).not.toBeNull(); expect(createJudgeRoundContext(state).closeStrikesProhibited).toBe(false);
  });

  it('successful real EXIT consumes only counts+retreat, preserves originals/resources, and stops all later damage', () => {
    const state = fixture(); state.spirituality = 44; const before = structuredClone(state), rolls = scriptRolls(81, 86, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('埃文');
    expect(result.round.consequence).toContain('不再承受后续伤害');
    expect(state.spirituality).toBe(44); expect(state.health).toBe(before.health); expect(state.town).toEqual(before.town);
    expect(state.judge).toEqual(before.judge); expect(rolls).toHaveBeenCalledTimes(3);
  });

  it('real strike before K still permits shared heavy surrender/death and terminal expiration with no recovery', () => {
    for (const [roll, outcome, health] of [[70, 'ENEMY_SURRENDERED', 70], [100, 'ENEMY_DEAD', 0]] as const) {
      const state = fixture(); state.spirituality = 50; const originals = structuredClone(state.town);
      // H before K remains a threat; K then blocks no imaginary additional action.
      const rolls = scriptRolls(11, 1, 1, 381, 281, 1, 1, roll);
      const result = resolveSliceCombatRound(state, 'DEFEND');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequence).toContain('自动消散'); expect(state.spirituality).toBe(47);
      expect(state.town).toEqual(originals); expectActualConsequenceDraw(rolls, roll);
      expect(rolls).toHaveBeenCalledTimes(8);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.combat!.enemyStatus).toBe(outcome === 'ENEMY_DEAD' ? 'DEAD' : 'SURRENDERED');
      if (outcome === 'ENEMY_SURRENDERED') expect(result.round.consequence).toContain('原棍归属不变');
      vi.restoreAllMocks();
    }
  });

  it('enemy strike before K can still kill the player on the shared death wheel, with no revival/recovery', () => {
    const state = fixture(true); state.combat!.round = 2; state.spirituality = 50;
    const rolls = scriptRolls(1, 1, 1, 281, 1, 1_000_000, 100);
    const result = resolveSliceCombatRound(state, 'DEFEND');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(47);
    expect(result.round.consequence).toContain('自动消散'); expectActualConsequenceDraw(rolls, 100);
    expect(rolls).toHaveBeenCalledTimes(7);
    expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
  });

  it('settles surrender/death/retreat once, keeps original ownership and grants no reward for mere declaration', () => {
    const ctx = { note: vi.fn(), roll: () => 1, check: () => { throw new Error('No check'); } } satisfies SeerContext;
    const state = fixture(); scriptRolls(1, 1, 281, 1, 1, 1);
    const result = resolveSliceCombatRound(state, 'DEFEND'); state.combatHistory.push(result.round);
    const award = vi.fn(); settleJudgeEncounter(state, 'ENEMY_SURRENDERED', ctx, award);
    expect(state.combat).toBeNull(); expect(state.judge.encounter.status).toBe('RESOLVED'); expect(award).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('SHOP'); expect(ctx.note).toHaveBeenCalled();
    expect(() => settleJudgeEncounter(state, 'ENEMY_SURRENDERED', ctx, award)).toThrow();
  });
});
