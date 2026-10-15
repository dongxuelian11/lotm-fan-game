import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { BARBARIAN_COUNT_WHEEL, currentBarbarianCombatSource, drawBarbarianAbility, isBarbarian,
  barbarianAbilityWheel, barbarianActionCount, resolveBarbarianCombatAbility,
  type BarbarianCombatSource, type BarbarianMoveId } from '../../src/domain/barbarian/combat.js';
import * as barbarianCombat from '../../src/domain/barbarian/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel } from '../../src/domain/machine/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import { LUCKY_COUNT_WHEEL, luckyAbilityWheel } from '../../src/domain/lucky/combat.js';
import { applyLawyerCommand, createLawyerState } from '../../src/domain/lawyer/index.js';
import { applyBarbarianCommand, createBarbarianState } from '../../src/domain/barbarian/index.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'black-emperor.s8.enhanced-body', insight = 'black-emperor.s9.weak-point-insight';
const resistance = 'black-emperor.s8.mental-resistance';
const ids = [body, 'BODY_FOLLOWUP', insight, 'POSITION', resistance, 'ACCIDENT'] as const;
/** A real consumed S9 original and a separately crafted/consumed S8 bottle. */
function fixture(): SliceState {
  const state = createSliceRun('barbarian-combat-test', sliceDefaultCreationSelection, 'barbarian-combat');
  state.activeEvent = null; state.eventQueue = []; state.world.city = 'BACKLUND';
  state.week = 5; state.cash = 10_000; state.actionsRemaining = 40; state.weeklyBudget = 40;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.lawyer = createLawyerState(); state.barbarian = createBarbarianState();
  const context: SeerContext = {
    roll: minimum => minimum,
    note() {},
    check: (ability, difficulty) => resolveNormalCheck({ ability,
      baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: 20 }),
  };
  applyLawyerCommand(state, { type: 'DISCOVER' }, context);
  applyLawyerCommand(state, { type: 'LEARN_GUIDANCE' }, context);
  applyLawyerCommand(state, { type: 'BUY_POTION', bottleId: 'lawyer-potion-1' }, context);
  applyLawyerCommand(state, { type: 'CONSUME', bottleId: 'lawyer-potion-1', confirmed: true }, context);
  state.progression.acting = 100; state.week += 4;
  applyBarbarianCommand(state, { type: 'LEARN_FORMULA' }, context);
  applyBarbarianCommand(state, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'BREW', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true }, context);
  // Combat fixtures isolate the profile from promotion bonuses and prior exertion.
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: BarbarianMoveId, physical = 1,
  source = currentBarbarianCombatSource(state)) {
  return resolveBarbarianCombatAbility(state, id, physical, stream(state), source);
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

describe('Barbarian S8 exact profile and inherited Lawyer dispatch', () => {
  it('selects the six exact slots and independent 10/20/25/25/20 counts', () => {
    const state = fixture();
    expect(isBarbarian(state)).toBe(true);
    expect(state.lawyer.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect(state.barbarian.bottles[0]).toMatchObject({
      id: 'barbarian-batch-1:bottle', batchId: 'barbarian-batch-1', status: 'CONSUMED', outcome: 'SUCCESS',
    });
    expect(state.barbarian.bottles[0]!.inputIds).toHaveLength(6);
    expect(state.barbarian.batches[0]!.materials.every(material => material.holder === 'CONSUMED')).toBe(true);
    expect(Object.keys(state.progression.mastery).sort()).toEqual([
      'black-emperor.s9.rule-analysis', 'black-emperor.s9.persuasive-argument', insight, body, resistance,
    ].sort());
    expect(playerAbilityWheel(state, null)).toEqual(barbarianAbilityWheel(null, state));
    expect(barbarianAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(barbarianAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(BARBARIAN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const abilities = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    abilities[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(BARBARIAN_COUNT_WHEEL)).toBe(true);
    expect(BARBARIAN_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) expect(barbarianActionCount(roll)).toBe(count);
    state.progression.sequence = 9;
    expect(isBarbarian(state)).toBe(false); expect(currentBarbarianCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(LAWYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(lawyerAbilityWheel('ATTACK', state));
    for (const sequence of [2, null] as const) {
      state.progression.sequence = sequence as typeof state.progression.sequence;
      expect(isBarbarian(state)).toBe(false); expect(currentBarbarianCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'wheel';
    for (const [sequence, counts, wheel] of [[9, MONSTER_COUNT_WHEEL, monsterAbilityWheel],
      [8, MACHINE_COUNT_WHEEL, machineAbilityWheel], [7, LUCKY_COUNT_WHEEL, luckyAbilityWheel]] as const) {
      state.progression.sequence = sequence;
      expect(isBarbarian(state)).toBe(false); expect(currentBarbarianCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(wheel('CONTROL', state));
    }
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
      expect(barbarianAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(weight => total === 400 ? weight / 4 : weight / total * 100));
    }
    const draws = scriptRolls(1, 150, 151, 250, 251, 330, 331, 370, 371, 430, 431, 450);
    const random = stream(fixture());
    expect(Array.from({ length: 12 }, () => drawBarbarianAbility(random, 'ATTACK')))
      .toEqual(ids.flatMap(id => [id, id]));
    expect(draws).toHaveBeenCalledTimes(12); expect(random.cursor).toBe(12);
    expect(barbarianAbilityWheel('RETREAT')).toEqual(barbarianAbilityWheel(null));
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
    vi.spyOn(barbarianCombat, 'resolveBarbarianCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });
});

describe('Barbarian current sources, bounded control and actual equipment', () => {
  it('uses H36f/J25.2f of one S8 skill, inherited B24.3f and ordinary K6', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [insight]: mastery, [resistance]: 500,
        'black-emperor.s9.rule-analysis': 500, 'black-emperor.s9.persuasive-argument': 500,
        'black-emperor.s7.bribery': 500, 'black-emperor.s6.distortion': 500, BODY_FOLLOWUP: 500, POSITION: 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        [body, 36 * factor * 0.8, 0, true], ['BODY_FOLLOWUP', 25.2 * factor * 0.8, 0, true],
        [insight, 0, 24.3 * factor * 0.8, false], ['POSITION', 0, 6 * 0.8, false], [resistance, 0, 0, false],
      ] as const) expect(resolveBarbarianCombatAbility(state, id, 0.8, random))
        .toMatchObject({ selfGain, enemyReduction, threatens });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [body]: 500, [insight]: 0 };
    expect(resolve(separate, insight).enemyReduction).toBe(24.3 * 0.65);
    separate.progression.mastery = { [body]: 0, [insight]: 500 };
    expect(resolve(separate, body).selfGain).toBe(36 * 0.65);
    expect(resolve(separate, 'BODY_FOLLOWUP').selfGain).toBe(25.2 * 0.65);
  });

  it('clamps malformed mastery and physical factors without removing ordinary injury penalties', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery = { [body]: mastery, [insight]: mastery };
      expect(resolve(state, body).selfGain).toBe(36 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, insight).enemyReduction).toBe(24.3 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [body, 'BODY_FOLLOWUP', insight, 'POSITION'] as const)
        expect(resolve(fixture(), id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(resolve(fixture(), body, 3).selfGain).toBe(36 * 0.65);
  });

  it('lets only the original HAND club replace H with16 without stacking or changing custody', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery = { [body]: 500, [insight]: 500 };
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const source = { ...currentBarbarianCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
      const before = structuredClone(state), random = stream(state);
      expect(resolveBarbarianCombatAbility(state, body, 0.8, random, source).selfGain)
        .toBe((location === 'HAND' ? 16 : 36) * 0.8);
      expect(resolveBarbarianCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random, source).selfGain).toBe(25.2 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '野蛮人强化身体打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; const source = currentBarbarianCombatSource(state);
    state.town.clubLocation = 'BAG'; expect(resolve(state, body, 1, source).selfGain).toBe(36 * 0.65);
  });

  it('binds every contribution to the current reachable first-case source, including accident', () => {
    const state = fixture(), source = currentBarbarianCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (BarbarianCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as BarbarianCombatSource)];
    const before = structuredClone(state), random = stream(state);
    for (const input of invalid) for (const id of ids)
      expect(resolveBarbarianCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.health = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyHealth = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      (s: SliceState) => { s.progression.sequence = 9; }, (s: SliceState) => { s.progression.pathwayId = 'wheel'; },
    ]) {
      const ended = fixture(); mutate(ended);
      const beforeEnded = structuredClone(ended), noDraws = stream(ended);
      expect(currentBarbarianCombatSource(ended)).toBeNull();
      for (const id of ids) expect(resolveBarbarianCombatAbility(ended, id, 1, noDraws))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(ended).toEqual(beforeEnded); expect(noDraws.cursor).toBe(0);
    }
  });

  it('keeps R at zero without a mental attack, active immunity, recovery or invented negotiation', () => {
    const state = fixture(); state.progression.mastery = { [body]: 500, [insight]: 500, [resistance]: 500,
      'black-emperor.s9.rule-analysis': 500, 'black-emperor.s9.persuasive-argument': 500,
      'black-emperor.s7.bribery': 500, 'black-emperor.s6.distortion': 500 };
    state.health = 70; state.mind = 40; state.spirituality = 0;
    state.knowledge.push({ id: 'unrelated-terms', week: state.week, title: '旧记录', text: 'PRIVATE_TERMS' });
    Object.assign(state.combat!, { mentalAttack: true, agreedTerms: 'PRIVATE_TERMS', forcedConsent: true });
    const source = { ...currentBarbarianCombatSource(state)!, enemyMentalAttack: true, consent: true };
    const before = structuredClone(state);
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw an invented mental attack or agreement'); },
    };
    const effect = resolveBarbarianCombatAbility(state, resistance, 1, forbidden, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    for (const text of ['没有正在使用的有来源精神攻击', '贡献0、消耗0', '不是主动精神免疫',
      '精神控制或恢复', '不生成协商条款', '不强制同意', '不是贿赂或扭曲']) expect(effect.label).toContain(text);
    expect(effect.label).not.toMatch(/PRIVATE_TERMS|forcedConsent|enemyMentalAttack/);
    expect(resolveBarbarianCombatAbility(state, insight, 1, forbidden)).toEqual(resolve(state, insight));
    expect(resolveBarbarianCombatAbility(state, 'POSITION', 1, forbidden).label).toContain('不以力量或口才强制同意');
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(state).toEqual(before);
  });
});

describe('Barbarian shared injury, retreat and deterministic rounds', () => {
  it('keeps all five empty resistance slots at zero with only shared recovery', () => {
    const state = fixture(); state.spirituality = 0; state.mind = 70;
    const before = structuredClone(state), draws = scriptRolls(100, 1, 371, 400, 371, 371, 371, 371, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual(Array(5).fill([0, 0]));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyHealth).toBe(100); expect(state.health).toBe(100); expect(state.mind).toBe(70);
    expect(state.spirituality).toBe(4.5); expect(state.progression).toEqual(before.progression);
    expect(state.lawyer).toEqual(before.lawyer); expect(state.barbarian).toEqual(before.barbarian);
    expect(draws).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(before.random.cursor + 9);
  });

  it('alternates five slots and three ordinary enemy slots with no extra actions or draws', () => {
    const state = fixture(), before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[36 * 0.65, 0], [25.2 * 0.65, 0], [0, 24.3 * 0.65], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(315 + (36 * 0.65 + 25.2 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (24.3 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('retains even-round initiative without turning ordinary enemy moves into mental attacks', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').every(move => move.label.includes('没有正在使用的有来源精神攻击'))).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(draws).toHaveBeenCalledTimes(11);
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

  it('retains real player death and accumulated injury risk despite the resistance slot', () => {
    const state = fixture(); state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 371, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5); expect(state.mind).toBe(25);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses the same 50% exit with no resistance bypass or reroll, and leaves failed-retreat injury possible', () => {
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
