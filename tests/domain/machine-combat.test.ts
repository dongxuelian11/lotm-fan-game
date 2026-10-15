import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { MACHINE_COUNT_WHEEL, currentMachineCombatSource, drawMachineAbility, isMachine,
  machineAbilityWheel, machineActionCount, resolveMachineCombatAbility,
  type MachineCombatSource, type MachineMoveId } from '../../src/domain/machine/combat.js';
import * as machineCombat from '../../src/domain/machine/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const calculation = 'wheel.s8.calculation-control', intuition = 'wheel.s9.danger-intuition';
const guard = 'wheel.s8.divination-guard';
const ids = [calculation, 'BODY_FOLLOWUP', intuition, 'POSITION', guard, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('machine-combat-test', sliceDefaultCreationSelection, 'machine-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'wheel', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: MachineMoveId, physical = 1,
  source = currentMachineCombatSource(state)) {
  return resolveMachineCombatAbility(state, id, physical, stream(state), source);
}
/** Use exact tickets without bypassing the real deterministic cursor. */
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

describe('Machine S8 exact profile and inherited Monster dispatch', () => {
  it('selects the six exact slots and independent 10/20/25/25/20 counts', () => {
    const state = fixture();
    expect(isMachine(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(machineAbilityWheel(null, state));
    expect(machineAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(machineAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(MACHINE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const abilities = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    abilities[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(MACHINE_COUNT_WHEEL)).toBe(true);
    expect(MACHINE_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) expect(machineActionCount(roll)).toBe(count);
    state.progression.sequence = 9;
    expect(isMachine(state)).toBe(false); expect(currentMachineCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(MONSTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(monsterAbilityWheel('ATTACK', state));
    state.progression.sequence = 2;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
  });

  it('uses exact stance ×5/4 tickets and one draw per slot', () => {
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]],
      ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]],
      ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(machineAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(weight => total === 400 ? weight / 4 : weight / total * 100));
    }
    const draws = scriptRolls(1, 150, 151, 250, 251, 330, 331, 370, 371, 430, 431, 450);
    const random = stream(fixture());
    expect(Array.from({ length: 12 }, () => drawMachineAbility(random, 'ATTACK')))
      .toEqual(ids.flatMap(id => [id, id]));
    expect(draws).toHaveBeenCalledTimes(12); expect(random.cursor).toBe(12);
    expect(machineAbilityWheel('RETREAT')).toEqual(machineAbilityWheel(null));
  });

  it('uses core30/40/15/15, tier300, cap60, floor30 and max45 with recovery4.5', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(321.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(4.5); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(4.5); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 43;
    scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(45); vi.restoreAllMocks();
    vi.spyOn(machineCombat, 'resolveMachineCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });
});

describe('Machine current sources, bounded control and actual equipment', () => {
  it('uses H27f/J18.9f of one S8 skill, inherited B24.3f and ordinary K6', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [calculation]: mastery, [intuition]: mastery, [guard]: 500,
        'wheel.s9.spirit-sensitivity': 500, 'wheel.s9.fragmentary-omen': 500, 'wheel.s7.luck': 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        [calculation, 27 * factor * 0.8, 0, true], ['BODY_FOLLOWUP', 18.9 * factor * 0.8, 0, true],
        [intuition, 0, 24.3 * factor * 0.8, false], ['POSITION', 0, 6 * 0.8, false], [guard, 0, 0, false],
      ] as const) expect(resolveMachineCombatAbility(state, id, 0.8, random))
        .toMatchObject({ selfGain, enemyReduction, threatens });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [calculation]: 500, [intuition]: 0 };
    expect(resolve(separate, intuition).enemyReduction).toBe(24.3 * 0.65);
    separate.progression.mastery = { [calculation]: 0, [intuition]: 500 };
    expect(resolve(separate, calculation).selfGain).toBe(27 * 0.65);
    expect(resolve(separate, 'BODY_FOLLOWUP').selfGain).toBe(18.9 * 0.65);
  });

  it('clamps malformed mastery and physical factors without removing ordinary injury penalties', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery = { [calculation]: mastery, [intuition]: mastery };
      expect(resolve(state, calculation).selfGain).toBe(27 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, intuition).enemyReduction).toBe(24.3 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [calculation, 'BODY_FOLLOWUP', intuition, 'POSITION'] as const)
        expect(resolve(fixture(), id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(resolve(fixture(), calculation, 3).selfGain).toBe(27 * 0.65);
  });

  it('lets only the original HAND club replace H with16 without stacking or changing custody', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery = { [calculation]: 500, [intuition]: 500 };
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const source = { ...currentMachineCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
      const before = structuredClone(state), random = stream(state);
      expect(resolveMachineCombatAbility(state, calculation, 0.8, random, source).selfGain)
        .toBe((location === 'HAND' ? 16 : 27) * 0.8);
      expect(resolveMachineCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random, source).selfGain).toBe(18.9 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '计算与精确身体打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; const source = currentMachineCombatSource(state);
    state.town.clubLocation = 'BAG'; expect(resolve(state, calculation, 1, source).selfGain).toBe(27 * 0.65);
  });

  it('binds every contribution to the current reachable first-case source, including accident', () => {
    const state = fixture(), source = currentMachineCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (MachineCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as MachineCombatSource)];
    const before = structuredClone(state), random = stream(state);
    for (const input of invalid) for (const id of ids)
      expect(resolveMachineCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.arc.stage = 'C'; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const ended = fixture(); mutate(ended);
      expect(currentMachineCombatSource(ended)).toBeNull();
      expect(resolve(ended, calculation)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
  });

  it('keeps R at zero without forecasting, immunity, secret access or future RNG reads', () => {
    const state = fixture(); state.progression.mastery = { [calculation]: 500, [intuition]: 500, [guard]: 500 };
    state.knowledge.push({ id: 'unrelated-omen', week: state.week, title: '旧记录', text: 'PRIVATE_SECRET' });
    Object.assign(state.combat!, { futureAction: 'FUTURE_ACTION', divinationActive: true });
    const source = { ...currentMachineCombatSource(state)!, enemyDivination: true, prophecy: 'FUTURE_RESULT' };
    const before = structuredClone(state);
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw a prediction'); },
    };
    const effect = resolveMachineCombatAbility(state, guard, 1, forbidden, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    for (const text of ['没有正在使用的有来源占卜效果', '贡献0、消耗0', '不生成预知', '不宣称占卜免疫', '不重掷或回退'])
      expect(effect.label).toContain(text);
    expect(effect.label).not.toMatch(/PRIVATE_SECRET|FUTURE_ACTION|FUTURE_RESULT/);
    expect(resolveMachineCombatAbility(state, intuition, 1, forbidden)).toEqual(resolve(state, intuition));
    expect(state).toEqual(before);
  });
});

describe('Machine shared injury, retreat and deterministic rounds', () => {
  it('alternates five slots and three ordinary enemy slots with no extra actions or draws', () => {
    const state = fixture(), before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[27 * 0.65, 0], [18.9 * 0.65, 0], [0, 24.3 * 0.65], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(315 + (27 * 0.65 + 18.9 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (24.3 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('never grants injury to B/K/R or either unchanged ±7.5 accident outcome', () => {
    for (const [ticket, accident] of [[251, 0], [331, 0], [371, 0], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = accident ? scriptRolls(1, 1, ticket, accident, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === 1 ? -7.5 : accident === 2 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(accident ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('leaves H/J injury and death to the common consequence draw, with no terminal recovery', () => {
    for (const [ticket, consequenceRoll, outcome, health] of [
      [1, 66, 'ENEMY_SURRENDERED', 70], [151, 96, 'ENEMY_DEAD', 0],
    ] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, consequenceRoll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('retains real player death and accumulated injury risk despite the guard slot', () => {
    const state = fixture(); state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 371, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5); expect(state.mind).toBe(25);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses the same 50% exit with no luck reroll, and leaves failed-retreat injury possible', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]); expect(round.retreat).toBe('SUCCESS');
    expect(state.spirituality).toBe(10); expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10;
    const failureDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failed, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
    expect(result.outcome).toBe('CONTINUE'); expect(failed.health).toBe(90); expect(failed.spirituality).toBe(14.5);
    expect(failureDraws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized state and held equipment from the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(state.town.clubLocation).toBe('HAND');
  });
});
