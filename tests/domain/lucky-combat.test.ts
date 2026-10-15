import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { LUCKY_COUNT_WHEEL, currentLuckyCombatSource, drawLuckyAbility, drawLuckyPassiveLuck, isLucky,
  luckyAbilityWheel, luckyActionCount, resolveLuckyCombatAbility,
  type LuckyCombatSource, type LuckyMoveId } from '../../src/domain/lucky/combat.js';
import * as luckyCombat from '../../src/domain/lucky/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel, resolveMachineCombatAbility,
  currentMachineCombatSource } from '../../src/domain/machine/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const calculation = 'wheel.s8.calculation-control', intuition = 'wheel.s9.danger-intuition';
const guard = 'wheel.s8.divination-guard', passive = 'wheel.s7.passive-luck';
const ids = [calculation, 'BODY_FOLLOWUP', intuition, 'POSITION', guard, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('lucky-combat-test', sliceDefaultCreationSelection, 'lucky-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'wheel', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: LuckyMoveId, physical = 1,
  source = currentLuckyCombatSource(state)) {
  return resolveLuckyCombatAbility(state, id, physical, stream(state), source);
}
/** Script real draws while retaining the deterministic cursor and exact range contract. */
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

describe('Lucky S7 inherited six-slot profile and source boundaries', () => {
  it('keeps the exact Machine wheels, stance tickets and five-action ceiling without a luck slot', () => {
    const state = fixture();
    expect(isLucky(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(MACHINE_COUNT_WHEEL);
    expect(LUCKY_COUNT_WHEEL).toBe(MACHINE_COUNT_WHEEL);
    expect(luckyAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(luckyAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(machineAbilityWheel(stance, state));
      expect(luckyAbilityWheel(stance).some(entry => entry.id === passive)).toBe(false);
    }
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) expect(luckyActionCount(roll)).toBe(count);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    const draws = scriptRolls(1, 150, 151, 250, 251, 330, 331, 370, 371, 430, 431, 450);
    const random = stream(state);
    expect(Array.from({ length: 12 }, () => drawLuckyAbility(random, 'ATTACK')))
      .toEqual(ids.flatMap(id => [id, id]));
    expect(draws).toHaveBeenCalledTimes(12); expect(random.cursor).toBe(12);
  });

  it('inherits H27f/J18.9f/B24.3f/K6/R0 with no S7 body increase or new resource cost', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [calculation]: mastery, [intuition]: mastery, [passive]: 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        [calculation, 27 * factor * 0.8, 0, true], ['BODY_FOLLOWUP', 18.9 * factor * 0.8, 0, true],
        [intuition, 0, 24.3 * factor * 0.8, false], ['POSITION', 0, 6 * 0.8, false], [guard, 0, 0, false],
      ] as const) expect(resolveLuckyCombatAbility(state, id, 0.8, random))
        .toMatchObject({ selfGain, enemyReduction, threatens });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [calculation]: 500, [intuition]: 0, [passive]: 500 };
    expect(resolve(separate, intuition).enemyReduction).toBe(24.3 * 0.65);
    separate.progression.mastery[calculation] = 0;
    expect(resolve(separate, calculation).selfGain).toBe(27 * 0.65);
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [calculation, 'BODY_FOLLOWUP', intuition, 'POSITION'] as const)
        expect(resolve(separate, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
  });

  it('requires the actual HAND club for replacement16 and keeps source-free divination at zero', () => {
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect future RNG'); },
      get cursor(): number { throw new Error('Do not inspect future RNG'); },
      nextInt() { throw new Error('Do not draw a prediction'); },
    };
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery = { [calculation]: 500, [guard]: 500, [passive]: 500 };
      const source = { ...currentLuckyCombatSource(state)!, heldTool: 'fake-club', enemyDivination: true,
        futureAction: 'PRIVATE_FUTURE_ACTION', prophecy: 'PRIVATE_FUTURE_RESULT' };
      const before = structuredClone(state);
      expect(resolveLuckyCombatAbility(state, calculation, 0.8, forbidden, source).selfGain)
        .toBe((location === 'HAND' ? 16 : 27) * 0.8);
      expect(resolveLuckyCombatAbility(state, 'BODY_FOLLOWUP', 0.8, forbidden, source).selfGain).toBe(18.9 * 0.8);
      const effect = resolveLuckyCombatAbility(state, guard, 1, forbidden, source);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('没有正在使用的有来源占卜效果');
      expect(effect.label).not.toMatch(/PRIVATE_FUTURE/);
      expect(state).toEqual(before);
    }
  });

  it('draws no luck or accident for stale, forged, unrelated or ended sources and profiles', () => {
    const state = fixture(), source = currentLuckyCombatSource(state)!;
    const invalid: (LuckyCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as LuckyCombatSource)];
    const before = structuredClone(state), random = stream(state);
    for (const input of invalid) {
      expect(drawLuckyPassiveLuck(state, 'ATTACK', 1, random, input)).toBeNull();
      for (const id of ids) expect(resolveLuckyCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.round = 0; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.arc.stage = 'C'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      (s: SliceState) => { s.progression.pathwayId = 'chained'; },
      ...([9, 8, 6, null] as const).map(sequence => (s: SliceState) => { s.progression.sequence = sequence; }),
    ]) {
      const invalidState = fixture(); mutate(invalidState); const untouched = structuredClone(invalidState);
      const noDraw = stream(invalidState);
      expect(currentLuckyCombatSource(invalidState)).toBeNull();
      expect(drawLuckyPassiveLuck(invalidState, 'ATTACK', 1, noDraw, source)).toBeNull();
      expect(resolveLuckyCombatAbility(invalidState, 'ACCIDENT', 1, noDraw, source).selfGain).toBe(0);
      expect(noDraw.cursor).toBe(0); expect(invalidState).toEqual(untouched);
    }
  });
});

describe('Lucky once-per-round passive probability and bounded contribution', () => {
  it('uses the exact inclusive25 threshold with one independent draw and no state mutation', () => {
    const state = fixture(); state.progression.mastery[passive] = 500;
    const before = structuredClone(state), draws = scriptRolls(1, 25, 26, 100), random = stream(state);
    expect(drawLuckyPassiveLuck(state, 'ATTACK', 1, random)).toEqual({ roll: 1, triggered: true, bonus: 45 });
    expect(drawLuckyPassiveLuck(state, 'DEFEND', 1, random)).toEqual({ roll: 25, triggered: true, bonus: 45 });
    expect(drawLuckyPassiveLuck(state, 'CONTROL', 1, random)).toEqual({ roll: 26, triggered: false, bonus: 0 });
    expect(drawLuckyPassiveLuck(state, 'PREPARE', 1, random)).toEqual({ roll: 100, triggered: false, bonus: 0 });
    expect(draws.mock.calls).toEqual(Array(4).fill([1, 100]));
    expect(random.cursor).toBe(4); expect(state).toEqual(before);
  });

  it('bounds mastery and physical state without reading seeds or using inherited mastery for luck', () => {
    const random: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt: vi.fn(() => 25),
    };
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 0, 100, 300, 500, 800]) {
      for (const physical of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0, 0.8, 1, 3]) {
        const state = fixture(); state.progression.mastery = { [passive]: mastery, [calculation]: 500, [intuition]: 500 };
        const before = structuredClone(state), effect = drawLuckyPassiveLuck(state, 'ATTACK', physical, random)!;
        const factor = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
        const body = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0;
        expect(effect.bonus).toBe(45 * factor * body);
        expect(effect.bonus).toBeGreaterThanOrEqual(0); expect(effect.bonus).toBeLessThanOrEqual(45);
        expect(state).toEqual(before);
      }
    }
    expect(random.nextInt).toHaveBeenCalledTimes(56);
  });

  it('records luck before both counts, preserves five versus three alternating slots and enemy draws', () => {
    const state = fixture(); state.health = 70; const before = structuredClone(state);
    const draws = scriptRolls(25, 100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.passiveLuck).toEqual({ roll: 25, triggered: true, bonus: 45 * 0.65 * 0.95 });
    expect([round.playerCountRoll, round.enemyCountRoll, round.playerCount, round.enemyCount]).toEqual([100, 100, 5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[27 * 0.65 * 0.95, 0], [18.9 * 0.65 * 0.95, 0], [0, 24.3 * 0.65 * 0.95], [0, 6 * 0.95], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBeCloseTo(465 * 0.95 + (45 + 27 + 18.9) * 0.65 * 0.95, 10);
    expect(round.enemyAdvantage).toBeCloseTo(114 + 48 - (24.3 * 0.65 + 6) * 0.95, 10);
    expect(round.consequence).toContain('25/100'); expect(round.consequence).toContain('触发');
    expect(round.consequence).toContain('健康减少10'); expect(outcome).toBe('CONTINUE');
    expect(draws.mock.calls).toEqual([[1, 100], [1, 100], [1, 100], [1, 450], [1, 400],
      [1, 450], [1, 400], [1, 450], [1, 400], [1, 450], [1, 450], [1, 1_000_000], [1, 100]]);
    expect(state.random.cursor).toBe(before.random.cursor + 13);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
  });

  it('keeps nontriggered luck at zero and even-round enemy initiative unchanged', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(26, 100, 100, 1, 1, 1, 151, 1, 251, 331, 371, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect(round.passiveLuck).toEqual({ roll: 26, triggered: false, bonus: 0 });
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.playerAdvantage).toBe(465 + (27 * 0.65 + 18.9 * 0.65));
    expect(round.consequence).toContain('超过25未触发'); expect(round.consequence).toContain('幸运贡献0');
    expect(draws).toHaveBeenCalledTimes(13);
  });

  it('uses core30/40/15/15, stage450, cap90, floor45 and max60 with recovery6', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(26, 1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(471.5 * 0.8);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(26, 1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 58;
    scriptRolls(26, 1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60); vi.restoreAllMocks();
    vi.spyOn(luckyCombat, 'resolveLuckyCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(26, 1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('ignores invented activation and stored-luck flags, never carries a bonus or imposes repayment', () => {
    const state = fixture();
    Object.assign(state.combat!, { luckEnabled: false, storedLuck: 999, luckDebt: 999 });
    Object.assign(state.progression, { luckPolicy: 'FORCE_TRIGGER' });
    const before = structuredClone(state);
    scriptRolls(1, 1, 1, 371, 400, 1, 100, 1, 1, 400, 371, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.round.passiveLuck).toEqual({ roll: 1, triggered: true, bonus: 45 * 0.65 });
    expect(second.round.passiveLuck).toEqual({ roll: 100, triggered: false, bonus: 0 });
    expect(first.round.playerAdvantage - second.round.playerAdvantage).toBe(45 * 0.65);
    expect(state.progression).toEqual(before.progression);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(state.health).toBe(100); expect(state.mind).toBe(100); expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const untouched = fixture(), copy = structuredClone(untouched);
    const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(() => resolveSliceCombatRound(untouched, 'ATTACK', 'RELEASE_FIRST')).toThrow('当前序列不能选择怒击策略');
    expect(() => resolveSliceCombatRound(untouched, 'ATTACK', 'HOLD', 'BURST_FIRST')).toThrow('当前序列不能选择理智爆发策略');
    expect(draws).not.toHaveBeenCalled(); expect(untouched).toEqual(copy);
  });
});

describe('Lucky shared consequences, retreat, old-profile isolation and replay', () => {
  it('never turns lucky B/K/R or either unchanged ±7.5 accident into an injury or extra action', () => {
    for (const [ticket, accident] of [[251, 0], [331, 0], [371, 0], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = accident ? scriptRolls(1, 1, 1, ticket, accident, 400, 1) : scriptRolls(1, 1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.passiveLuck?.triggered).toBe(true); expect(round.moves).toHaveLength(2);
      expect(round.moves[0]!.selfGain).toBe(accident === 1 ? -7.5 : accident === 2 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(accident ? 7 : 6); vi.restoreAllMocks();
    }
  });

  it('retains common injury, surrender, enemy death and injured-player death despite triggered luck', () => {
    for (const [ticket, consequenceRoll, outcome, health] of [
      [1, 1, 'CONTINUE', 90], [1, 66, 'ENEMY_SURRENDERED', 70], [151, 96, 'ENEMY_DEAD', 0],
    ] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, 1, ticket, 400, 1, consequenceRoll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.round.passiveLuck?.triggered).toBe(true);
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 16 : 10);
      expect(draws).toHaveBeenCalledTimes(7); vi.restoreAllMocks();
    }
    const state = fixture(); state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 1, 371, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.passiveLuck).toEqual({ roll: 1, triggered: true, bonus: 45 * 0.65 * 0.9 });
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5); expect(state.mind).toBe(25);
    expect(round.consequence).toContain('最终死亡'); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('makes no passive draw or metadata for successful or failed ordinary retreat', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const random = stream(state);
    expect(drawLuckyPassiveLuck(state, 'RETREAT', 1, random)).toBeNull(); expect(random.cursor).toBe(0);
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]); expect(round.retreat).toBe('SUCCESS');
    expect(round).not.toHaveProperty('passiveLuck'); expect(round.consequence).not.toContain('被动幸运');
    expect(state.spirituality).toBe(10); expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10;
    const failureDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failed, 'RETREAT');
    expect(result.round).not.toHaveProperty('passiveLuck'); expect(result.round.retreat).toBe('FAILURE');
    expect(result.round.moves).toHaveLength(1); expect(result.outcome).toBe('CONTINUE');
    expect(failed.health).toBe(90); expect(failed.spirituality).toBe(16); expect(failureDraws).toHaveBeenCalledTimes(6);
  });

  it('leaves Monster, Machine and ordinary wheels, draws, source guards and budgets isolated', () => {
    for (const sequence of [9, 8, 1, null] as const) {
      const state = fixture(); state.progression.sequence = sequence;
      state.progression.mastery[passive] = 500;
      expect(isLucky(state)).toBe(false); expect(currentLuckyCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(sequence === 9 ? MONSTER_COUNT_WHEEL
        : sequence === 8 ? MACHINE_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'ATTACK')).toEqual(sequence === 9 ? monsterAbilityWheel('ATTACK', state)
        : sequence === 8 ? machineAbilityWheel('ATTACK', state) : ordinaryAbilityWheel(false, 'ATTACK'));
      const draws = scriptRolls(1, 1, 371, 400, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round).not.toHaveProperty('passiveLuck'); expect(draws).toHaveBeenCalledTimes(5);
      expect(round.playerAdvantage).toBe(sequence === 9 ? 215 : sequence === 8 ? 315 : 115);
      vi.restoreAllMocks();
    }
    const lucky = fixture(), random = stream(lucky);
    expect(currentMachineCombatSource(lucky)).toBeNull();
    expect(resolveMachineCombatAbility(lucky, calculation, 1, random).selfGain).toBe(0);
    const unrelated = fixture(); unrelated.combat!.encounterId = 'HUNTER_CARGO';
    const draws = scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(unrelated, 'ATTACK').round).not.toHaveProperty('passiveLuck');
    expect(draws).toHaveBeenCalledTimes(5);
  });

  it('replays a serialized Lucky round with the same seed, cursor, gear, luck record and outcomes', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    state.progression.mastery = { [calculation]: 300, [intuition]: 100, [passive]: 200 };
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(result.round).toHaveProperty('passiveLuck'); expect(state).toEqual(restored);
    expect(state.lastCombatRound?.passiveLuck).toEqual(result.round.passiveLuck);
    expect(forbidden).not.toHaveBeenCalled(); expect(state.town.clubLocation).toBe('HAND');
  });
});
