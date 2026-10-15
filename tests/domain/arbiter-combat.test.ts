import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { ARBITER_COUNT_WHEEL, arbiterAbilityWheel, arbiterActionCount, currentArbiterCombatSource,
  drawArbiterAbility, isArbiter, resolveArbiterCombatAbility,
  type ArbiterCombatSource, type ArbiterMoveId } from '../../src/domain/arbiter/combat.js';
import * as arbiterCombat from '../../src/domain/arbiter/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel } from '../../src/domain/barbarian/combat.js';
import { BRIBER_COUNT_WHEEL, briberAbilityWheel } from '../../src/domain/briber/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const training = 'justiciar.s9.combat-training', authority = 'justiciar.s9.authority';
const charisma = 'justiciar.s9.persuasive-charisma';
const ids = [training, 'BODY_FOLLOWUP', 'COMBAT_DEFENSE', 'POSITION', authority, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('arbiter-combat-test', sliceDefaultCreationSelection, 'arbiter-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'justiciar', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: ArbiterMoveId, physical = 1,
  source = currentArbiterCombatSource(state)) {
  return resolveArbiterCombatAbility(state, id, physical, stream(state), source);
}
/** Exact tickets, with the real deterministic cursor and its range checks retained. */
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

describe('Arbiter S9 wheels, profile and original bodily source', () => {
  it('uses exact 30/20/20/10/15/5 slots, stance tickets and independent count boundaries', () => {
    const state = fixture();
    expect(isArbiter(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(arbiterAbilityWheel(null, state));
    expect(arbiterAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(arbiterAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(ARBITER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    expect(Object.isFrozen(ARBITER_COUNT_WHEEL)).toBe(true);
    expect(ARBITER_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]], ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]], ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(arbiterAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(state);
        expect(drawArbiterAbility(random, stance)).toBe(ids[index]);
        expect(drawArbiterAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(arbiterAbilityWheel('RETREAT')).toEqual(arbiterAbilityWheel(null));
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]] as const) expect(arbiterActionCount(roll)).toBe(count);
  });

  it('uses core35/30/20/15, tier200, core cap40, floor20 and max30 with normal recovery3', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(221.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(3); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 251, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30); vi.restoreAllMocks();
    vi.spyOn(arbiterCombat, 'resolveArbiterCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 251, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('keeps unsupported Justiciar sequences ordinary and existing Black Emperor profiles unchanged', () => {
    for (const sequence of [1, 0, null] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.town.clubLocation = 'HAND';
      state.progression.mastery = { [authority]: 500, [training]: 500, [charisma]: 500,
        'justiciar.s8.tracking': 500, 'justiciar.s7.mental-puncture': 500, 'justiciar.s6.prohibition': 500 };
      expect(isArbiter(state)).toBe(false); expect(currentArbiterCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(true, 'CONTROL').map(entry =>
        entry.id === 'STRIKE' ? { ...entry, label: '持握原短棍打击' } : entry));
      const ordinary = structuredClone(state); ordinary.progression.pathwayId = null; ordinary.progression.sequence = null;
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(ordinary, 'CONTROL'));
      expect(state.random).toEqual(ordinary.random); expect(state.combat).toEqual(ordinary.combat);
      expect(state.spirituality).toBe(ordinary.spirituality); expect(state.town).toEqual(ordinary.town);
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

  it('scales H20/J14/B14 only with combat training and leaves K6 ordinary and zero-cost', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [training]: mastery, [authority]: 500, [charisma]: 500,
        BODY_FOLLOWUP: 500, COMBAT_DEFENSE: 500, POSITION: 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveArbiterCombatAbility(state, training, 0.8, random))
        .toMatchObject({ selfGain: 20 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveArbiterCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random))
        .toMatchObject({ selfGain: 14 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveArbiterCombatAbility(state, 'COMBAT_DEFENSE', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 14 * factor * 0.8, threatens: false });
      expect(resolveArbiterCombatAbility(state, 'POSITION', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[training] = mastery;
      expect(resolve(state, training).selfGain).toBe(20 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [training, 'BODY_FOLLOWUP', 'COMBAT_DEFENSE', 'POSITION'] as const)
        expect(resolve(fixture(), id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(resolve(fixture(), training, 2).selfGain).toBe(13);
  });

  it('replaces only H with the same actual held club16, never stacks or equips a prop', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.progression.mastery[training] = 500;
      const before = structuredClone(state);
      expect(resolve(state, training, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 20) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(14);
      expect(resolve(state, 'COMBAT_DEFENSE').enemyReduction).toBe(14);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '仲裁人格斗打击');
      expect(state).toEqual(before);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[training] = 0;
    expect(resolve(state, training).selfGain).toBe(16);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(14 * 0.65);
  });
});

describe('Arbiter limited authority and source guards', () => {
  it('spends exactly1S for one real 1..100 draw at every success/resistance threshold', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const threshold = 35 + Math.floor(15 * mastery / 500), factor = 0.65 + 0.35 * mastery / 500;
      for (const roll of [1, threshold, threshold + 1, 100]) {
        const state = fixture(); state.progression.mastery = { [authority]: mastery, [training]: 500, [charisma]: 500 };
        const before = structuredClone(state), draws = scriptRolls(roll), random = stream(state);
        const effect = resolveArbiterCombatAbility(state, authority, 0, random);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: roll <= threshold ? 10 * factor : 0, threatens: false });
        expect(effect.label).toContain(`抵抗盘${roll}/100、阈值${threshold}`);
        expect(effect.label).toContain(roll <= threshold ? '短暂迟疑' : '对方抵抗');
        expect(draws).toHaveBeenCalledExactlyOnceWith(1, 100); expect(random.cursor).toBe(1);
        before.spirituality -= 1; expect(state).toEqual(before); vi.restoreAllMocks();
      }
    }
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[authority] = mastery;
      const draws = scriptRolls(mastery === 800 ? 50 : 35);
      expect(resolve(state, authority).enemyReduction).toBe(10 * (mastery === 800 ? 1 : 0.65));
      expect(draws).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
    }
  });

  it('falls back to zero ordinary scene analysis without any RNG or cost below1S', () => {
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw without the actual resource'); },
    };
    for (const spirituality of [0, 0.99, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality; state.progression.mastery[authority] = 500;
      const before = structuredClone(state);
      const effect = resolveArbiterCombatAbility(state, authority, 1, forbidden);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('普通现场分析'); expect(effect.label).toContain('贡献0、消耗0');
      expect(state).toEqual(before);
    }
    const exact = fixture(); exact.spirituality = 1;
    scriptRolls(100); expect(resolve(exact, authority).enemyReduction).toBe(0); expect(exact.spirituality).toBe(0);
  });

  it('rejects null, stale and forged sources before all slots, costs and random draws', () => {
    const state = fixture(), source = currentArbiterCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (ArbiterCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as ArbiterCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveArbiterCombatAbility(state, id, 1, random, input))
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
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentArbiterCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveArbiterCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Arbiter shared round, real threats and replay', () => {
  it('uses five authority slots without cancelling enemy actions, causing injury or saving a status', () => {
    const state = fixture(); state.progression.mastery[authority] = 500;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 1, 321, 50, 1, 321, 50, 321, 50, 321, 50, 321, 50, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 1]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual(Array(5).fill([0, 10]));
    expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(round.enemyAdvantage).toBe(114 + 16 - 50);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(28); expect(state.progression).toEqual(before.progression);
    expect(state.town).toEqual(before.town); expect(state.world).toEqual(before.world);
    expect(state.knowledge).toEqual(before.knowledge);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(14); expect(state.random.cursor).toBe(before.random.cursor + 14);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 371, 100, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(next.first).toBe('ENEMY'); expect(next.enemyAdvantage).toBe(114);
    expect(next.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(next.moves[1]!.enemyReduction).toBe(0); expect(next.consequenceWeights).toBeNull();
  });

  it('keeps exact alternating RNG order and mastery when physical and authority slots are mixed', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 35, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[20 * 0.65, 0], [14 * 0.65, 0], [0, 14 * 0.65], [0, 6], [0, 10 * 0.65]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (20 * 0.65 + 14 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (14 * 0.65 + 6 + 10 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(12);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(draws).toHaveBeenCalledTimes(13); expect(state.random.cursor).toBe(before.random.cursor + 13);
  });

  it('keeps authority-only rounds at0S on the ordinary zero-contribution fallback without extra draws', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]] as const) {
      const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
      const draws = scriptRolls(roll, 1, 371, 400, ...Array<number>(count - 1).fill(371), 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect([round.playerCount, round.enemyCount]).toEqual([count, 1]);
      expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(count);
      expect(round.moves.filter(move => move.actor === 'PLAYER').every(move =>
        move.label.includes('普通现场分析') && move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.spirituality).toBe(3); expect(state.progression).toEqual(before.progression);
      expect(draws).toHaveBeenCalledTimes(count + 4); expect(state.random.cursor).toBe(before.random.cursor + count + 4);
      vi.restoreAllMocks();
    }
  });

  it('never enables wounds from defense, position, authority success/resistance or either accident', () => {
    for (const [ticket, extra] of [[251, null], [331, null], [371, 35], [371, 36], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      const draws = scriptRolls(1, 1, ticket, ...(extra === null ? [] : [extra]), 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(extra === null ? 5 : 6);
      vi.restoreAllMocks();
    }
  });

  it('keeps shared injury/surrender/death draws for actual attacks and real player death despite authority', () => {
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
    const draws = scriptRolls(1, 1, 371, 1, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(player, 'ATTACK');
    expect(round.moves[0]!.enemyReduction).toBe(6.5); expect(round.moves[1]!.selfGain).toBe(16);
    expect(outcome).toBe('PLAYER_DEAD'); expect(player.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(player.injuryRisk).toBe(2); expect(player.spirituality).toBe(4); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('retains the ordinary retreat boundary and rejects unrelated policies before RNG or mutation', () => {
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
    expect(result.outcome).toBe('CONTINUE'); expect(failed.health).toBe(90); expect(failed.spirituality).toBe(13);
    expect(failedDraws).toHaveBeenCalledTimes(6);
  });

  it('replays saved state, actual held gear and authority costs using only the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    state.progression.mastery = { [authority]: 300, [training]: 200, [charisma]: 500 };
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const left = stream(state), right = stream(restored);
    expect(resolveArbiterCombatAbility(state, authority, 1, left)).toEqual(resolveArbiterCombatAbility(restored, authority, 1, right));
    state.random.cursor = left.cursor; restored.random.cursor = right.cursor;
    expect(resolveSliceCombatRound(state, 'PREPARE')).toEqual(resolveSliceCombatRound(restored, 'PREPARE'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
