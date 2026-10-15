import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { INTERROGATOR_COUNT_WHEEL, interrogatorAbilityWheel, interrogatorActionCount, currentInterrogatorCombatSource,
  drawInterrogatorAbility, isInterrogator, resolveInterrogatorCombatAbility,
  type InterrogatorCombatSource, type InterrogatorMoveId } from '../../src/domain/interrogator/combat.js';
import * as interrogatorCombat from '../../src/domain/interrogator/combat.js';
import { ARBITER_COUNT_WHEEL, arbiterAbilityWheel, currentArbiterCombatSource }
  from '../../src/domain/arbiter/combat.js';
import { SHERIFF_COUNT_WHEEL, sheriffAbilityWheel, currentSheriffCombatSource }
  from '../../src/domain/sheriff/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel } from '../../src/domain/barbarian/combat.js';
import { BRIBER_COUNT_WHEEL, briberAbilityWheel } from '../../src/domain/briber/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const training = 'justiciar.s9.combat-training', authority = 'justiciar.s9.authority';
const charisma = 'justiciar.s9.persuasive-charisma', trace = 'justiciar.s8.trace-sensing';
const reconstruction = 'justiciar.s8.image-reconstruction';
const puncture = 'justiciar.s7.mental-puncture', pressure = 'justiciar.s7.mental-pressure';
const ids = [training, 'BODY_FOLLOWUP', puncture, 'POSITION', pressure, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('interrogator-combat-test', sliceDefaultCreationSelection, 'interrogator-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'justiciar', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: InterrogatorMoveId, physical = 1,
  source = currentInterrogatorCombatSource(state)) {
  return resolveInterrogatorCombatAbility(state, id, physical, stream(state), source);
}
/** Exact scripted outcomes retain the shared deterministic cursor and range checks. */
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

describe('Interrogator S7 exact wheels and inherited physical profile', () => {
  it('uses 30/20/20/10/15/5 slots, exact stance tickets and 10/20/25/25/20 counts', () => {
    const state = fixture();
    expect(isInterrogator(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(interrogatorAbilityWheel(null, state));
    expect(interrogatorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(interrogatorAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(INTERROGATOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(INTERROGATOR_COUNT_WHEEL)).toBe(true);
    expect(INTERROGATOR_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]], ['ATTACK', [150, 100, 100, 40, 60, 20]],
      ['DEFEND', [120, 80, 80, 40, 60, 20]], ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(interrogatorAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(state);
        expect(drawInterrogatorAbility(random, stance)).toBe(ids[index]);
        expect(drawInterrogatorAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(interrogatorAbilityWheel('RETREAT')).toEqual(interrogatorAbilityWheel(null));
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) expect(interrogatorActionCount(roll)).toBe(count);
  });

  it('uses core35/30/20/15, tier450, core cap90, floor45 and max60 with normal recovery6', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 391, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(471.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(6);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 391, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 351, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60); vi.restoreAllMocks();
    vi.spyOn(interrogatorCombat, 'resolveInterrogatorCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 351, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('preserves Arbiter9, Sheriff8, unsupported Justiciar fallback and Black Emperor profiles', () => {
    for (const sequence of [1, 0, null] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.town.clubLocation = 'HAND';
      state.progression.mastery = { [training]: 500, [authority]: 500, [charisma]: 500,
        [trace]: 500, [reconstruction]: 500, [puncture]: 500, [pressure]: 500, 'justiciar.s6.prohibition': 500 };
      expect(isInterrogator(state)).toBe(false); expect(currentInterrogatorCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(true, 'CONTROL').map(entry =>
        entry.id === 'STRIKE' ? { ...entry, label: '持握原短棍打击' } : entry));
      const ordinary = structuredClone(state); ordinary.progression.pathwayId = null; ordinary.progression.sequence = null;
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(ordinary, 'CONTROL'));
      expect(state.random).toEqual(ordinary.random); expect(state.combat).toEqual(ordinary.combat);
      expect(state.spirituality).toBe(ordinary.spirituality); expect(state.town).toEqual(ordinary.town);
    }
    for (const [sequence, counts, wheel, source, tier, recovery] of [
      [9, ARBITER_COUNT_WHEEL, arbiterAbilityWheel, currentArbiterCombatSource, 200, 3],
      [8, SHERIFF_COUNT_WHEEL, sheriffAbilityWheel, currentSheriffCombatSource, 300, 4.5],
    ] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.spirituality = 0;
      expect(isInterrogator(state)).toBe(false); expect(currentInterrogatorCombatSource(state)).toBeNull();
      expect(source(state)).not.toBeNull(); expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'DEFEND')).toEqual(wheel('DEFEND', state));
      scriptRolls(1, 1, 371, 400, 1);
      expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe((tier + 15) * 0.8);
      expect(state.spirituality).toBe(recovery); vi.restoreAllMocks();
    }
    const state = fixture(); state.progression.pathwayId = 'black-emperor';
    for (const [sequence, counts, wheel] of [
      [9, LAWYER_COUNT_WHEEL, lawyerAbilityWheel],
      [8, BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel],
      [7, BRIBER_COUNT_WHEEL, briberAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence;
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'PREPARE')).toEqual(wheel('PREPARE', state));
    }
  });

  it('scales H45/J31.5 from inherited training and no-S trace36.45 independently; K stays6', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [training]: mastery, [trace]: mastery, [authority]: 500, [charisma]: 500,
        [reconstruction]: 500, [puncture]: 500, [pressure]: 500, BODY_FOLLOWUP: 500, POSITION: 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveInterrogatorCombatAbility(state, training, 0.8, random))
        .toMatchObject({ selfGain: 45 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveInterrogatorCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random))
        .toMatchObject({ selfGain: 31.5 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveInterrogatorCombatAbility(state, puncture, 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 36.45 * factor * 0.8, threatens: false });
      expect(resolveInterrogatorCombatAbility(state, 'POSITION', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const independent = fixture(); independent.spirituality = 0; independent.progression.mastery[training] = 500;
    expect(resolve(independent, puncture).enemyReduction).toBe(36.45 * 0.65);
    independent.progression.mastery[training] = 0; independent.progression.mastery[trace] = 500;
    expect(resolve(independent, puncture).enemyReduction).toBe(36.45);
    expect(resolve(independent, training).selfGain).toBe(45 * 0.65);
    expect(resolve(independent, 'BODY_FOLLOWUP').selfGain).toBe(31.5 * 0.65);
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.spirituality = 0; state.progression.mastery[trace] = mastery;
      expect(resolve(state, puncture).enemyReduction).toBe(36.45 * (mastery === 800 ? 1 : 0.65));
      state.progression.mastery[training] = mastery;
      expect(resolve(state, training).selfGain).toBe(45 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [training, 'BODY_FOLLOWUP', puncture, 'POSITION'] as const) {
        const state = fixture(); state.spirituality = 0;
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    expect(resolve(fixture(), training, 2).selfGain).toBe(45 * 0.65);
  });

  it('replaces only H with the same actual held club16 without stacking, equipping or changing J', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'FORGED_WEAPON'] as const) {
      const state = fixture(); state.town.clubLocation = location as SliceState['town']['clubLocation'];
      state.spirituality = 0; state.progression.mastery[training] = 500; state.progression.mastery[trace] = 500;
      const before = structuredClone(state);
      expect(resolve(state, training, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 45) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(31.5);
      expect(resolve(state, puncture).enemyReduction).toBe(36.45);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '审讯者格斗打击');
      expect(state).toEqual(before);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[training] = 0;
    expect(resolve(state, training).selfGain).toBe(16);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(31.5 * 0.65);
  });
});

describe('Interrogator actual mental attempts and current visible source only', () => {
  it.each([puncture, pressure])('spends exactly3S then draws once for %s at every success/failure threshold', id => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const threshold = id === puncture ? 55 + Math.floor(20 * mastery / 500) : 35 + Math.floor(15 * mastery / 500);
      const factor = 0.65 + 0.35 * mastery / 500;
      for (const roll of [1, threshold, threshold + 1, 100]) {
        const state = fixture(); state.progression.mastery = { [id]: mastery, [training]: 500, [trace]: 500, [authority]: 500 };
        const before = structuredClone(state), draws = scriptRolls(roll), random = stream(state);
        const effect = resolveInterrogatorCombatAbility(state, id, 0, random);
        expect(effect).toMatchObject({
          selfGain: id === puncture && roll <= threshold ? 36 * factor : 0,
          enemyReduction: id === pressure && roll <= threshold ? 15 * factor : 0, threatens: false,
        });
        expect(effect.label).toContain(`盘${roll}/100、阈值${threshold}`);
        expect(effect.label).toContain(roll <= threshold ? id === puncture ? '短暂战势贡献' : '短暂受压' : '本次贡献0');
        expect(draws).toHaveBeenCalledExactlyOnceWith(1, 100); expect(random.cursor).toBe(1);
        before.spirituality -= 3; expect(state).toEqual(before); vi.restoreAllMocks();
      }
    }
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[id] = mastery;
      const threshold = id === puncture ? mastery === 800 ? 75 : 55 : mastery === 800 ? 50 : 35;
      const draws = scriptRolls(threshold), effect = resolve(state, id);
      expect(id === puncture ? effect.selfGain : effect.enemyReduction)
        .toBe((id === puncture ? 36 : 15) * (mastery === 800 ? 1 : 0.65));
      expect(draws).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
    }
    const state = fixture(); state.spirituality = 3;
    const draw = vi.fn((minimum: number, maximum: number) => {
      expect(state.spirituality).toBe(0); expect([minimum, maximum]).toEqual([1, 100]); return 100;
    });
    expect(resolveInterrogatorCombatAbility(state, id, 1, { seed: 'cost-before-roll', cursor: 0, nextInt: draw }))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(draw).toHaveBeenCalledTimes(1); expect(state.spirituality).toBe(0);
  });

  it('uses inherited trace fallback for B and ordinary zero for R below3S without touching RNG', () => {
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw without the actual resource'); },
    };
    for (const spirituality of [0, 2.99, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality;
      state.progression.mastery = { [puncture]: 500, [pressure]: 500, [trace]: 200 };
      const before = structuredClone(state);
      const fallback = resolveInterrogatorCombatAbility(state, puncture, 0.8, forbidden);
      expect(fallback).toMatchObject({ selfGain: 0, enemyReduction: 36.45 * (0.65 + 0.35 * 200 / 500) * 0.8, threatens: false });
      expect(fallback.label).toContain('继承的近处痕迹辨认与护身'); expect(fallback.label).toContain('不抽精神刺穿盘');
      const analysis = resolveInterrogatorCombatAbility(state, pressure, 1, forbidden);
      expect(analysis).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(analysis.label).toContain('普通现场分析'); expect(analysis.label).toContain('贡献0、消耗0');
      expect(state).toEqual(before);
    }
  });

  it('never reads hidden knowledge, guarantees truth or grants a new reconstruction/prohibition attack', () => {
    const state = fixture(), before = structuredClone(state);
    const hidden = vi.fn(() => { throw new Error('Combat must not read hidden knowledge'); });
    Object.defineProperty(state, 'knowledge', { configurable: true, get: hidden });
    scriptRolls(1, 1); const random = stream(state);
    for (const id of [puncture, pressure] as const) {
      const effect = resolveInterrogatorCombatAbility(state, id, 1, random);
      expect(effect.threatens).toBe(false); expect(effect.label).toContain('不读取远程或隐藏心智');
      expect(effect.label).toContain('真相'); expect(effect.label).toContain('不取消');
    }
    for (const id of [reconstruction, charisma, authority, trace, 'justiciar.s6.prohibition', 'spirit-piercing', 'pain-whip']) {
      expect(playerAbilityWheel(state, null).some(entry => entry.id === id)).toBe(false);
      expect(resolveInterrogatorCombatAbility(state, id as InterrogatorMoveId, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(hidden).not.toHaveBeenCalled(); expect(random.cursor).toBe(2);
    Object.defineProperty(state, 'knowledge', { configurable: true, writable: true, value: before.knowledge });
    before.spirituality -= 6; expect(state).toEqual(before);
  });

  it('rejects null, stale and forged sources before every slot, resource cost and random draw', () => {
    const state = fixture(), source = currentInterrogatorCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (InterrogatorCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as InterrogatorCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveInterrogatorCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('refuses absent, ended, unrelated, non-finite-health and wrong-sequence sources', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.health = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'black-emperor'; }, (s: SliceState) => { s.progression.pathwayId = null; },
      (s: SliceState) => { s.progression.sequence = 9; }, (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.sequence = 6; }, (s: SliceState) => { s.arc.stage = 'C'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      ...[0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].map(round =>
        (s: SliceState) => { s.combat!.round = round; }),
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentInterrogatorCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveInterrogatorCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Interrogator shared rounds, physical injury boundaries and replay', () => {
  it.each([puncture, pressure])('five successful %s slots keep enemy action and cannot cause wounds or death', id => {
    const state = fixture(); state.progression.mastery[id] = 500;
    const before = structuredClone(state), ticket = id === puncture ? 201 : 321;
    const draws = scriptRolls(100, 1, ticket, 1, 1, ticket, 1, ticket, 1, ticket, 1, ticket, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 1]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual(Array(5).fill(id === puncture ? [36, 0] : [0, 15]));
    expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(round.playerAdvantage).toBe(465 + (id === puncture ? 180 : 0));
    expect(round.enemyAdvantage).toBe(114 + 16 - (id === pressure ? 75 : 0));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(51); expect(state.progression).toEqual(before.progression);
    expect(state.town).toEqual(before.town); expect(state.world).toEqual(before.world); expect(state.knowledge).toEqual(before.knowledge);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(14); expect(state.random.cursor).toBe(before.random.cursor + 14);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 391, 100, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(next.first).toBe('ENEMY'); expect(next.enemyAdvantage).toBe(114);
    expect(next.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(next.moves[1]!.enemyReduction).toBe(0); expect(next.consequenceWeights).toBeNull();
  });

  it('keeps exact alternating shared RNG order for H/J/B/K/R and both actual3S costs', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 55, 1, 351, 391, 35, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[45 * 0.65, 0], [31.5 * 0.65, 0], [36 * 0.65, 0], [0, 6], [0, 15 * 0.65]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(465 * 0.8 + (45 * 0.65 + 31.5 * 0.65 + 36 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (6 + 15 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(10);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(draws).toHaveBeenCalledTimes(14); expect(state.random.cursor).toBe(before.random.cursor + 14);
  });

  it('costs the one affordable attempt, then falls back without an extra draw or early recovery', () => {
    const state = fixture(); state.spirituality = 3;
    const draws = scriptRolls(100, 1, 251, 100, 400, 391, 251, 391, 251, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[0, 0], [0, 0], [0, 36.45 * 0.65], [0, 0], [0, 36.45 * 0.65]]);
    expect(outcome).toBe('CONTINUE'); expect(state.spirituality).toBe(6);
    expect(round.consequenceWeights).toBeNull(); expect(draws).toHaveBeenCalledTimes(10);
  });

  it('keeps B trace and R zero fallbacks at0S across all count boundaries without extra draws', () => {
    for (const id of [puncture, pressure] as const) {
      for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
        [56, 4], [80, 4], [81, 5], [100, 5]] as const) {
        const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
        const ticket = id === puncture ? 251 : 391;
        const draws = scriptRolls(roll, 1, ticket, 400, ...Array<number>(count - 1).fill(ticket), 1);
        const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
        expect([round.playerCount, round.enemyCount]).toEqual([count, 1]);
        expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
          .toEqual(Array(count).fill([0, id === puncture ? 36.45 * 0.65 : 0]));
        expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
        expect(state.spirituality).toBe(6); expect(state.progression).toEqual(before.progression);
        expect(draws).toHaveBeenCalledTimes(count + 4); expect(state.random.cursor).toBe(before.random.cursor + count + 4);
        vi.restoreAllMocks();
      }
    }
  });

  it('never enables wounds from mental success/failure, position or either accident even with held gear', () => {
    for (const [ticket, extra] of [[251, 55], [251, 56], [351, null], [391, 35], [391, 36], [451, 1], [451, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      const draws = scriptRolls(1, 1, ticket, ...(extra === null ? [] : [extra]), 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      if (ticket === 451) expect(round.moves[0]).toMatchObject({
        actor: 'PLAYER', selfGain: extra === 1 ? -11.25 : 11.25, enemyReduction: 0,
      });
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(extra === null ? 5 : 6);
      vi.restoreAllMocks();
    }
  });

  it('keeps the shared injury/surrender/death wheel for H/J and real player death despite pressure', () => {
    for (const ticket of [1, 151]) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
    const enemy = fixture(); enemy.spirituality = 10;
    scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(enemy, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(enemy.combat!.enemyHealth).toBe(0); expect(enemy.spirituality).toBe(10); vi.restoreAllMocks();
    const player = fixture(); player.health = 40; player.spirituality = 5; player.injuryRisk = 1;
    player.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 391, 1, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(player, 'ATTACK');
    expect(round.moves[0]!.enemyReduction).toBe(15 * 0.65); expect(round.moves[1]!.selfGain).toBe(16);
    expect(outcome).toBe('PLAYER_DEAD'); expect(player.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(player.injuryRisk).toBe(2); expect(player.spirituality).toBe(2); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('retains ordinary retreat and rejects unrelated policies before RNG or mutation', () => {
    const state = fixture(), before = structuredClone(state);
    const untouched = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(() => resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST')).toThrow('当前序列不能选择理智爆发策略');
    expect(() => resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST')).toThrow('当前序列不能选择怒击策略');
    expect(state).toEqual(before); expect(untouched).not.toHaveBeenCalled(); vi.restoreAllMocks();
    state.spirituality = 10; state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(state, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(state.spirituality).toBe(10); expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10;
    const failedDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failed, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
    expect(result.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(result.outcome).toBe('CONTINUE'); expect(failed.health).toBe(90); expect(failed.spirituality).toBe(16);
    expect(failedDraws).toHaveBeenCalledTimes(6);
  });

  it('replays saved state, actual held gear and mental costs using only the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    state.progression.mastery = { [pressure]: 300, [puncture]: 400, [training]: 200, [trace]: 400, [charisma]: 500 };
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const left = stream(state), right = stream(restored);
    for (const id of [puncture, pressure] as const) {
      expect(resolveInterrogatorCombatAbility(state, id, 1, left))
        .toEqual(resolveInterrogatorCombatAbility(restored, id, 1, right));
    }
    state.random.cursor = left.cursor; restored.random.cursor = right.cursor;
    expect(resolveSliceCombatRound(state, 'PREPARE')).toEqual(resolveSliceCombatRound(restored, 'PREPARE'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(state.town.clubLocation).toBe('HAND');
  });
});
