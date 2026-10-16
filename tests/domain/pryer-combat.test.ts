import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PRYER_COUNT_WHEEL, drawPryerAbility, isPryer, pryerAbilityWheel, pryerActionCount,
  resolvePryerCombatAbility, type PryerMoveId } from '../../src/domain/pryer/combat.js';
import * as pryerCombat from '../../src/domain/pryer/combat.js';
import { WITCH_COUNT_WHEEL, witchAbilityWheel } from '../../src/domain/witch/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const vision = 'hermit.s9.spirit-vision', ritual = 'hermit.s9.ritual-lore';
const study = 'hermit.s9.occult-study';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', vision, 'SITE_PRESSURE', ritual, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('pryer-combat-test', sliceDefaultCreationSelection, 'pryer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hermit', sequence: 9,
    mastery: { [vision]: 0, [ritual]: 0, [study]: 0 }, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: PryerMoveId, physical = 1) {
  return resolvePryerCombatAbility(state, id, physical, stream(state));
}
/** Script tickets while retaining production cursor advancement. */
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

describe('Pryer S9 support profile and exact tickets', () => {
  it('dispatches six25/15/25/10/20/5 slots and independent20/25/25/20/10 counts', () => {
    const state = fixture();
    expect(isPryer(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(pryerAbilityWheel(null, state));
    expect(pryerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(pryerAbilityWheel(null).map(entry => entry.weight)).toEqual([25, 15, 25, 10, 20, 5]);
    expect(playerCountWheel(state)).toEqual(PRYER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([20, 25, 25, 20, 10]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25);
    expect(playerCountWheel(state)[0]!.weight).toBe(20);
  });

  it('retains every count boundary and spends one draw per ability ticket', () => {
    for (const [roll, count] of [[1, 1], [20, 1], [21, 2], [45, 2], [46, 3], [70, 3],
      [71, 4], [90, 4], [91, 5], [100, 5]]) expect(pryerActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of pryerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawPryerAbility(random, null)).toBe(entry.id);
      expect(drawPryerAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses exact ×1.25 stance tickets with both ordinary attacks in ATTACK', () => {
    for (const [stance, weights] of [
      ['ATTACK', [125, 75, 100, 40, 80, 20]],
      ['DEFEND', [100, 60, 125, 40, 80, 20]],
      ['CONTROL', [100, 60, 100, 50, 80, 20]],
      ['PREPARE', [100, 60, 100, 40, 100, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(pryerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawPryerAbility(random, stance)).toBe(ids[index]);
        expect(drawPryerAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(pryerAbilityWheel('RETREAT')).toEqual(pryerAbilityWheel(null));
  });

  it('uses core15/20/30/35, base200 and max30 with one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 341, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(228.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    expect(state.town).toEqual(before.town);
  });

  it('caps the core at40, combined penalty at40% and recovery at30', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 341, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30);
  });

  it('retains the S9 advantage floor20 after extreme negative contribution', () => {
    vi.spyOn(pryerCombat, 'resolvePryerCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('does not unlock higher Hermit sequences or replace neighboring profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isPryer(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'demoness'; state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(WITCH_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(witchAbilityWheel('CONTROL', state));
  });
});

describe('Pryer ordinary tools, limited spirit vision and absent ritual sources', () => {
  it('keeps ordinary H12/J8.4/K6 physical and uses only vision mastery for B18f', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery = { [vision]: mastery, [ritual]: mastery, [study]: mastery };
      const before = structuredClone(state), random = stream(state), factor = 0.65 + 0.35 * mastery / 500;
      expect(resolvePryerCombatAbility(state, 'BODY_STRIKE', 0.8, random)).toMatchObject({
        selfGain: 12 * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolvePryerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random)).toMatchObject({
        selfGain: 8.4 * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolvePryerCombatAbility(state, vision, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 18 * factor, threatens: false,
      });
      expect(resolvePryerCombatAbility(state, 'SITE_PRESSURE', 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 6 * 0.8, threatens: false,
      });
      expect(resolvePryerCombatAbility(state, ritual, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      before.spirituality -= 1; expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not borrow ritual, study, fighter or higher eyes mastery for spirit vision', () => {
    const state = fixture(); state.progression.mastery = { [vision]: 100, [ritual]: 500, [study]: 500,
      'hermit.s8.fighting': 500, 'hermit.s5.mystic-eyes': 500, 'reader.s9.understanding': 500 };
    expect(resolve(state, vision).enemyReduction).toBe(18 * (0.65 + 0.35 * 100 / 500));
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(12);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8.4);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(6);
    expect(pryerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors without making zero strikes threatening', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[vision] = mastery;
      expect(resolve(state, vision).enemyReduction).toBe(18 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = 0;
      for (const id of ['BODY_STRIKE', 'BODY_FOLLOWUP', 'SITE_PRESSURE', vision] as const) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    const state = fixture(); state.spirituality = 0;
    expect(resolve(state, 'BODY_STRIKE', 3).selfGain).toBe(12);
    expect(resolve(state, 'BODY_FOLLOWUP', 3).selfGain).toBe(8.4);
    expect(resolve(state, 'SITE_PRESSURE', 3).enemyReduction).toBe(6);
    expect(resolve(state, vision, 3).enemyReduction).toBe(10);
  });

  it('pays exactly1S for vision and uses ordinary10physical block without overdraft', () => {
    for (const spirituality of [0, 0.5, 1, 1.5]) {
      const state = fixture(); state.spirituality = spirituality; state.progression.mastery[vision] = 500;
      const before = structuredClone(state), random = stream(state);
      expect(resolvePryerCombatAbility(state, vision, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: spirituality >= 1 ? 18 : 10 * 0.8, threatens: false,
      });
      before.spirituality = spirituality >= 1 ? spirituality - 1 : spirituality;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const spirituality of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality;
      expect(resolve(state, vision, 0.8).enemyReduction).toBe(8);
      expect(state.spirituality).toBe(spirituality);
    }
  });

  it('uses only the actual Town HAND club as a16physical H replacement at0S', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.spirituality = 0;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state), random = stream(state);
      expect(resolvePryerCombatAbility(state, 'BODY_STRIKE', 0.8, random).selfGain)
        .toBe((location === 'HAND' ? 16 : 12) * 0.8);
      expect(resolvePryerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(8.4 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '普通身体/持握工具打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('never converts general knowledge or off-scene practice into a prepared ritual', () => {
    const state = fixture(); state.progression.mastery = { [vision]: 500, [ritual]: 500, [study]: 500 };
    state.knowledge.push({ id: 'unrelated-note', week: state.week, title: '异地笔记',
      text: 'PREPARED_RITUAL SECRET_TRUTH FUTURE_ACTION DIAGNOSIS 光束 墙体 全知' });
    const before = structuredClone(state), random = stream(state);
    for (let repeat = 0; repeat < 5; repeat++) {
      const effect = resolvePryerCombatAbility(state, ritual, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('没有已准备并获准使用的仪式来源');
      expect(effect.label).toContain('需要实际准备');
      expect(effect.label).not.toMatch(/PREPARED_RITUAL|SECRET_TRUTH|FUTURE_ACTION|DIAGNOSIS|光束|墙体|全知/);
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    const effect = resolve(state, vision);
    expect(effect.label).not.toMatch(/SECRET_TRUTH|FUTURE_ACTION|DIAGNOSIS/);
    before.spirituality -= 1; expect(state).toEqual(before);
  });

  it('guards all actions against dead, absent, non-hostile and unrelated current targets', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolvePryerCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Pryer shared consequences and deterministic rounds', () => {
  it('resolves five player slots against three ordinary attacks with one vision cost', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 126, 1, 201, 1, 301, 341, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [12, 0], [8.4, 0], [0, 18 * 0.65], [0, 6], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (12 + 8.4));
    expect(round.enemyAdvantage).toBe(114 + 48 - (18 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(12); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('spends the last1S once and recovers only after five defensive actions finish', () => {
    const state = fixture(); state.spirituality = 1;
    const draws = scriptRolls(100, 1, 201, 400, 201, 201, 201, 201, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction))
      .toEqual([18 * 0.65, 10, 10, 10, 10]);
    expect(round.consequenceWeights).toBeNull(); expect(state.spirituality).toBe(3);
    expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('switches first actor on even rounds and grants no effect for ritual checks', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 341, 400, 341, 400, 341, 341, 341, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.playerAdvantage).toBe(215); expect(round.enemyAdvantage).toBe(114);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('does not turn defense, footwork, ritual knowledge or positive accident into injury', () => {
    for (const ticket of [201, 301, 341, 421]) {
      const state = fixture(); const before = structuredClone(state.town);
      const draws = ticket === 421 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 421 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before); expect(draws).toHaveBeenCalledTimes(ticket === 421 ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('applies a negative accident once without changing items, mind or pollution', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; const before = structuredClone(state);
    scriptRolls(1, 1, 421, 1, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(210); expect(round.moves[0]!.selfGain).toBe(-5);
    expect(state.town).toEqual(before.town); expect(state.mind).toBe(before.mind);
    expect(state.progression).toEqual(before.progression); expect(round.consequenceWeights).toBeNull();
  });

  it('lets ordinary H and J win through shared injury and surrender without automatic killing', () => {
    for (const ticket of [1, 126]) {
      const state = fixture(); scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(30);
      vi.restoreAllMocks();
    }
  });

  it('retains enemy death only through the actual shared consequence draw', () => {
    const state = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD'); expect(state.combat!.enemyHealth).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.spirituality).toBe(30);
  });

  it('retains player accumulated risk and actual death despite finite spirit-vision defense', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 201, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(4);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses the ordinary retreat route without a ritual escape or extra recovery', () => {
    const state = fixture(); state.spirituality = 10; const town = structuredClone(state.town);
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.retreat).toBe('SUCCESS'); expect(state.spirituality).toBe(10);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('retains failed retreat, actual ordinary injury and one continuing recovery', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(13);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('replays a serialized state with the same held club, seed, cursor and costs', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
