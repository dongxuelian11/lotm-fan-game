import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { INSTIGATOR_COUNT_WHEEL, drawInstigatorAbility, instigatorAbilityWheel, instigatorActionCount,
  isInstigator, resolveInstigatorCombatAbility, type InstigatorMoveId } from '../../src/domain/instigator/combat.js';
import * as instigatorCombat from '../../src/domain/instigator/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel, isAssassin,
  resolveAssassinCombatAbility } from '../../src/domain/assassin/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const burst = 'assassin.s9.burst', lightness = 'assassin.s9.lightness';
const vision = 'assassin.s9.vision', instigation = 'assassin.s8.instigation';
const ids = [burst, lightness, vision, instigation, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('instigator-combat-test', sliceDefaultCreationSelection, 'instigator-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'demoness', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: InstigatorMoveId, physical = 1) {
  return resolveInstigatorCombatAbility(state, id, physical, stream(state));
}
/** Script tickets while preserving the production random cursor. */
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

describe('Instigator S8 exact C profile and neighboring sequences', () => {
  it('uses20/15/20/30/8/7 slots and independent12/18/25/28/17 counts', () => {
    const state = fixture();
    expect(isInstigator(state)).toBe(true); expect(isAssassin(state)).toBe(false);
    expect(playerAbilityWheel(state, null)).toEqual(instigatorAbilityWheel(null, state));
    expect(instigatorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(instigatorAbilityWheel(null).map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(playerCountWheel(state)).toEqual(INSTIGATOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([12, 18, 25, 28, 17]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(12);
  });

  it('preserves all count boundaries and exactly one draw per normal ability slot', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [83, 4], [84, 5], [100, 5]]) expect(instigatorActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of instigatorAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawInstigatorAbility(random, null)).toBe(entry.id);
      expect(drawInstigatorAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses exact ×1.25 integer stance tickets without borrowing another slot', () => {
    for (const [stance, weights] of [
      ['ATTACK', [100, 75, 80, 120, 32, 28]],
      ['DEFEND', [80, 60, 100, 120, 32, 28]],
      ['CONTROL', [80, 60, 80, 150, 32, 28]],
      ['PREPARE', [80, 60, 80, 120, 40, 28]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(instigatorAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawInstigatorAbility(random, stance)).toBe(ids[index]);
        expect(drawInstigatorAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(instigatorAbilityWheel('RETREAT')).toEqual(instigatorAbilityWheel(null));
  });

  it('uses core30/35/20/15, base300, max45 and one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 376, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(322 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(4.5);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
  });

  it('caps core at60, state penalty at40 percent and recovery at45', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(state.spirituality).toBe(7.5); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 44;
    scriptRolls(1, 1, 376, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(45);
  });

  it('retains the S8 advantage floor30', () => {
    vi.spyOn(instigatorCombat, 'resolveInstigatorCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('keeps S9, ordinary and Provoker profiles separate and grants no S7 magic', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(isInstigator(state)).toBe(false); expect(isAssassin(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(assassinAbilityWheel(null, state));
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(resolveAssassinCombatAbility(state, burst, 1, stream(state)).selfGain).toBe(16 * 0.65);
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isInstigator(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'hunter'; state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(PROVOKER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(provokerAbilityWheel('CONTROL'));
    expect(ids.join(' ')).not.toMatch(/s7|flame|frost|mirror|invisible/);
  });
});

describe('Instigator actual slots, costs and finite influence', () => {
  it('uses27f/18.9f/21f/14.7f at all mastery nodes and only H/J take the physical factor', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery = {
        [burst]: mastery, [lightness]: mastery, [vision]: mastery, [instigation]: mastery,
      };
      const f = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveInstigatorCombatAbility(state, burst, 0.8, random)).toMatchObject({
        selfGain: 27 * f * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveInstigatorCombatAbility(state, lightness, 0.8, random)).toMatchObject({
        selfGain: 18.9 * f * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveInstigatorCombatAbility(state, vision, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 21 * f, threatens: false,
      });
      expect(resolveInstigatorCombatAbility(state, instigation, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 14.7 * f, threatens: false,
      });
      before.spirituality -= 2;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('uses only the selected mastery, retaining shadow history without a new shadow slot', () => {
    const state = fixture(); state.progression.mastery = {
      [burst]: 500, [lightness]: 300, [vision]: 100, [instigation]: 200,
      'assassin.s9.shadow': 500, 'demoness.s7.invisibility': 500,
    };
    const before = structuredClone(state.progression);
    expect(resolve(state, burst).selfGain).toBe(27);
    expect(resolve(state, lightness).selfGain).toBe(18.9 * (0.65 + 0.35 * 300 / 500));
    expect(resolve(state, vision).enemyReduction).toBe(21 * (0.65 + 0.35 * 100 / 500));
    expect(resolve(state, instigation).enemyReduction).toBe(14.7 * (0.65 + 0.35 * 200 / 500));
    expect(state.progression).toEqual(before);
  });

  it('bounds malformed mastery and physical factors, and zero physical output is nonthreatening', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[instigation] = mastery;
      expect(resolve(state, instigation).enemyReduction).toBe(14.7 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [burst]: 500, [lightness]: 500, [instigation]: 500 };
    for (const id of [burst, lightness]) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === burst ? 27 : 18.9);
    }
    state.spirituality = 0;
    expect(resolve(state, instigation, Number.NaN).enemyReduction).toBe(0);
    expect(resolve(state, instigation, 3).enemyReduction).toBe(6);
  });

  it('pays exactly1S for H and K or falls back without overdraft or redraw', () => {
    for (const spirituality of [0, 0.5, 1, 1.5]) {
      for (const id of [burst, instigation]) {
        const state = fixture(); state.spirituality = spirituality; state.progression.mastery[id] = 500;
        const before = structuredClone(state), random = stream(state);
        const effect = resolveInstigatorCombatAbility(state, id, 0.8, random);
        expect(effect.selfGain).toBe(id === burst ? (spirituality >= 1 ? 27 : 12) * 0.8 : 0);
        expect(effect.enemyReduction).toBe(id === instigation ? (spirituality >= 1 ? 14.7 : 6 * 0.8) : 0);
        expect(effect.threatens).toBe(id === burst);
        before.spirituality = spirituality >= 1 ? spirituality - 1 : spirituality;
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
        if (id === instigation && spirituality < 1) expect(effect.label).toContain('不施加精神影响');
      }
    }
    const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
    for (const id of [lightness, vision, 'OBSERVE'] as const) resolve(state, id);
    expect(state).toEqual(before);
  });

  it('only an actually held Town club replaces H with16 at0S, without an additive burst', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state), random = stream(state);
      expect(resolveInstigatorCombatAbility(state, burst, 0.8, random).selfGain)
        .toBe((location === 'HAND' ? 16 : 27 * 0.65) * 0.8);
      expect(resolveInstigatorCombatAbility(state, lightness, 0.8, random).selfGain).toBe(18.9 * 0.65 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '教唆者蓄力爆发');
      before.spirituality -= location === 'HAND' ? 0 : 1;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.spirituality = 0; state.town.clubLocation = 'HAND';
    expect(resolve(state, burst).selfGain).toBe(16); expect(state.spirituality).toBe(0);
  });

  it('influences only the already-hostile carrier without reading thoughts or saving control flags', () => {
    const state = fixture(); state.progression.mastery[instigation] = 500;
    state.knowledge.push({ id: 'unrelated', week: 1, title: '旧消息',
      text: 'PRIVATE_SECRET NEXT_ACTION FORCE_TARGET DARK_COVER 黑焰 冰霜 镜替' });
    const before = structuredClone(state), random = stream(state);
    const effect = resolveInstigatorCombatAbility(state, instigation, 0, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 14.7, threatens: false });
    expect(effect.label).toContain('当前已表现的敌意'); expect(effect.label).toContain('不是绝对控制');
    expect(effect.label).not.toMatch(/PRIVATE_SECRET|NEXT_ACTION|FORCE_TARGET|DARK_COVER|黑焰|冰霜|镜替/);
    before.spirituality -= 1; expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(resolve(state, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
  });

  it('does not create an enemy from absent, peaceful, ended or unrelated encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'PROVOKER_DISPUTE'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveInstigatorCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Instigator shared slots, agency, injury and replay', () => {
  it('resolves five S8 slots against three ordinary enemy slots with only two paid actions', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 101, 1, 176, 1, 256, 376, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [27 * 0.65, 0], [18.9 * 0.65, 0], [0, 21 * 0.65], [0, 14.7 * 0.65], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(315 * 0.8 + (27 * 0.65 + 18.9 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (21 * 0.65 + 14.7 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(12.5); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('only the first H spends the final1S; later H slots use ordinary12 and recovery happens once', () => {
    const state = fixture(); state.spirituality = 1;
    const draws = scriptRolls(100, 1, 1, 400, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain))
      .toEqual([27 * 0.65, 12, 12, 12, 12]);
    expect(state.spirituality).toBe(4.5); expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(10);
  });

  it('K spends once then falls back for each remaining slot, without free action or reroll', () => {
    const state = fixture(); state.spirituality = 1; state.health = 50;
    const draws = scriptRolls(100, 1, 256, 400, 256, 256, 256, 256, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction))
      .toEqual([14.7 * 0.65, 6 * 0.65 * 0.9, 6 * 0.65 * 0.9, 6 * 0.65 * 0.9, 6 * 0.65 * 0.9]);
    expect(state.spirituality).toBe(4.5); expect(round.consequenceWeights).toBeNull();
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(draws).toHaveBeenCalledTimes(9);
  });

  it('keeps all ordinary enemy actions after K and does not change its later draw range or mind', () => {
    const state = fixture(); const before = structuredClone(state.combat);
    const draws = scriptRolls(1, 100, 256, 1, 200, 300, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.map(move => [move.actor, move.selfGain, move.enemyReduction])).toEqual([
      ['PLAYER', 0, 14.7 * 0.65], ['ENEMY', 16, 0], ['ENEMY', 0, 10], ['ENEMY', 8, 0],
    ]);
    expect(draws.mock.calls.slice(3, 6)).toEqual([[1, 400], [1, 400], [1, 400]]);
    expect(round.enemyAdvantage).toBe(114 + 24 - 14.7 * 0.65);
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyMind).toBe(before!.enemyMind);
    expect(state.combat!.enemyStatus).toBe('RESISTING'); expect(state.combat!.enemyInjuries).toEqual([]);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before!).sort());
    expect(draws).toHaveBeenCalledTimes(7);
  });

  it('alternates first actor on even rounds and retains ordinary independent counts', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 376, 400, 376, 400, 376, 376, 376, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('never grants physical injury from B, K, R or either accident sign', () => {
    for (const [ticket, accident] of [[176, null], [256, null], [376, null], [408, 1], [408, 2]]) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const before = structuredClone(state.town);
      const draws = accident === null ? scriptRolls(1, 1, ticket!, 400, 1)
        : scriptRolls(1, 1, ticket!, accident!, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === null ? 0 : accident === 1 ? -7.5 : 7.5);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before); expect(draws).toHaveBeenCalledTimes(accident === null ? 5 : 6);
      vi.restoreAllMocks();
    }
  });

  it('H and J still cause shared heavy injury/surrender rather than automatic killing', () => {
    for (const ticket of [1, 101]) {
      const state = fixture(); scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(ticket === 1 ? 44 : 45);
      vi.restoreAllMocks();
    }
  });

  it('retains shared enemy death after an actual attack and player death despite K', () => {
    const attacker = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(attacker, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(attacker.combat!.enemyHealth).toBe(0); expect(attacker.spirituality).toBe(44);
    vi.restoreAllMocks();
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 256, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(4); expect(state.town).toEqual(town);
  });

  it('keeps ordinary retreat and failure injury possible without a mental escape override', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.retreat).toBe('SUCCESS'); expect(state.spirituality).toBe(10);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const failure = fixture(); failure.spirituality = 10;
    scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failure, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
    expect(result.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(result.outcome).toBe('CONTINUE'); expect(failure.health).toBe(90); expect(failure.spirituality).toBe(14.5);
  });

  it('replays serialized S8 state, held gear and costs from the same seed/cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
