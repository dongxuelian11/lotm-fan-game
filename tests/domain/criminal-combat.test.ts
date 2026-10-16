import { UNCLEAN_MONARCH_COUNT_WHEEL, uncleanMonarchAbilityWheel, currentUncleanMonarchCombatSource } from '../../src/domain/unclean-monarch/combat.js';
import { BLOOD_DUKE_COUNT_WHEEL, bloodDukeAbilityWheel, currentBloodDukeCombatSource } from '../../src/domain/blood-duke/combat.js';
import { BLATHERER_COUNT_WHEEL, blathererAbilityWheel, currentBlathererCombatSource } from '../../src/domain/blatherer/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { CRIMINAL_COUNT_WHEEL, criminalAbilityWheel, criminalActionCount, currentCriminalCombatSource,
  drawCriminalAbility, isCriminal, resolveCriminalCombatAbility,
  type CriminalCombatSource, type CriminalMoveId } from '../../src/domain/criminal/combat.js';
import { SERIAL_KILLER_COUNT_WHEEL, serialKillerAbilityWheel } from '../../src/domain/serial-killer/combat.js';
import { UNWINGED_COUNT_WHEEL, unwingedAbilityWheel } from '../../src/domain/unwinged/combat.js';
import { DEMON_COUNT_WHEEL, demonAbilityWheel } from '../../src/domain/demon/combat.js';
import * as criminalCombat from '../../src/domain/criminal/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel } from '../../src/domain/assassin/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const brute = 'abyss.s9.brute-force', alertness = 'abyss.s9.alertness', insight = 'abyss.s9.illicit-insight';
const ids = [brute, 'BODY_FOLLOWUP', alertness, 'POSITION', insight, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('criminal-combat-test', sliceDefaultCreationSelection, 'criminal-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'abyss', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: CriminalMoveId, physical = 1,
  source = currentCriminalCombatSource(state)) {
  return resolveCriminalCombatAbility(state, id, physical, stream(state), source);
}
/** Script exact tickets while advancing the production deterministic cursor. */
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

describe('Criminal S9 exact G physical profile', () => {
  it('uses 30/20/20/10/15/5 slots and independent 15/20/25/25/15 counts', () => {
    const state = fixture();
    expect(isCriminal(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(criminalAbilityWheel(null, state));
    expect(criminalAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(criminalAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(CRIMINAL_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves every count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]]) expect(criminalActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of criminalAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawCriminalAbility(random, null)).toBe(entry.id);
      expect(drawCriminalAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses exact normalized ×1.25 stance tickets, including both body attacks', () => {
    for (const [stance, weights] of [
      ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]],
      ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(criminalAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawCriminalAbility(random, stance)).toBe(ids[index]);
        expect(drawCriminalAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(criminalAbilityWheel('RETREAT')).toEqual(criminalAbilityWheel(null));
  });

  it('uses core 30/35/20/15, base200, max30 and one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(222 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town);
  });

  it('caps core at40 and combined penalties at40 percent, with recovery capped at30', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30);
  });

  it('retains the S9 floor20 after extreme negative contribution', () => {
    vi.spyOn(criminalCombat, 'resolveCriminalCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('does not unlock later Abyss powers or change neighboring original profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['abyss', 3], ['abyss', 2], ['abyss', 1], ['abyss', 0]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isCriminal(state)).toBe(false); expect(currentCriminalCombatSource(state)).toBeNull();
      // Sequence 3 is now the implemented Blatherer profile; changing the selector cannot grant its source.
      expect(playerCountWheel(state)).toEqual(sequence === 1 ? UNCLEAN_MONARCH_COUNT_WHEEL : sequence === 2 ? BLOOD_DUKE_COUNT_WHEEL : sequence === 3 ? BLATHERER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sequence === 1 ? uncleanMonarchAbilityWheel(state, 'CONTROL') : sequence === 2 ? bloodDukeAbilityWheel(state, 'CONTROL') : sequence === 3 ? blathererAbilityWheel(state, 'CONTROL') : ordinaryAbilityWheel(false, 'CONTROL'));
      expect(currentBlathererCombatSource(state)).toBeNull(); expect(currentBloodDukeCombatSource(state)).toBeNull();
      expect(currentUncleanMonarchCombatSource(state)).toBeNull();
      if (sequence === 1) expect(playerCountWheel(state)).toHaveLength(6);
    }
    for (const [sequence, wheel, ability] of [[8, UNWINGED_COUNT_WHEEL, unwingedAbilityWheel], [7, SERIAL_KILLER_COUNT_WHEEL, serialKillerAbilityWheel], [6, DEMON_COUNT_WHEEL, demonAbilityWheel]] as const) {
      state.progression.pathwayId = 'abyss'; state.progression.sequence = sequence;
      expect(isCriminal(state)).toBe(false); expect(currentCriminalCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(wheel);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ability('CONTROL', state));
    }
    state.progression.pathwayId = 'warrior'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(warriorAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'demoness';
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(assassinAbilityWheel('CONTROL', state));
  });
});

describe('Criminal physical budgets, actual tools and bounded present information', () => {
  it('uses 16f/11.2f/16f/6 physical budgets at all mastery nodes for zero spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [brute]: mastery, [alertness]: mastery, [insight]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveCriminalCombatAbility(state, brute, 0.8, random)).toMatchObject({
        selfGain: 16 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveCriminalCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random)).toMatchObject({
        selfGain: 11.2 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveCriminalCombatAbility(state, alertness, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 16 * factor * 0.8, threatens: false,
      });
      expect(resolveCriminalCombatAbility(state, 'POSITION', 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 6 * 0.8, threatens: false,
      });
      expect(resolveCriminalCombatAbility(state, insight, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('shares brute-force mastery only between H/J and gives ordinary footwork no mastery', () => {
    const state = fixture(); state.progression.mastery = {
      [brute]: 500, [alertness]: 0, [insight]: 500, BODY_FOLLOWUP: 0, POSITION: 500,
      'abyss.s6.danger-sense': 500, 'abyss.s6.demonization': 500, 'warrior.s6.dawn-armor': 500,
    };
    expect(resolve(state, brute).selfGain).toBe(16);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(11.2);
    expect(resolve(state, alertness).enemyReduction).toBe(16 * 0.65);
    expect(resolve(state, 'POSITION').enemyReduction).toBe(6);
    expect(resolve(state, insight)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(criminalAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors, including both defensive slots', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[brute] = mastery; state.progression.mastery[alertness] = mastery;
      expect(resolve(state, brute).selfGain).toBe(16 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, alertness).enemyReduction).toBe(16 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [brute]: 500, [alertness]: 500 };
    for (const id of [brute, 'BODY_FOLLOWUP', alertness, 'POSITION'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    expect(resolve(state, brute, 3).selfGain).toBe(16);
    expect(resolve(state, alertness, 3).enemyReduction).toBe(16);
    expect(resolve(state, 'POSITION', 3).enemyReduction).toBe(6);
  });

  it('only actual Town HAND club replaces H with16 without stacking or mastery amplification', () => {
    for (const mastery of [0, 500]) {
      for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
        const state = fixture(); state.spirituality = 0; state.town.clubLocation = location;
        state.progression.mastery[brute] = mastery;
        const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
        expect(resolveCriminalCombatAbility(state, brute, 0.8, random).selfGain)
          .toBe((location === 'HAND' ? 16 : 16 * factor) * 0.8);
        expect(resolveCriminalCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(11.2 * factor * 0.8);
        expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '强健身体打击');
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
      }
    }
    const state = fixture(); state.town.clubLocation = 'SHOP';
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    const before = structuredClone(state);
    expect(resolve(state, brute).selfGain).toBe(16 * 0.65); expect(state).toEqual(before);
  });

  it('derives only the current ordinary body, passage and original exit', () => {
    const state = fixture();
    expect(currentCriminalCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
  });

  it('cannot turn knowledge, mastery or supplied flags into hidden inventory or criminal plans', () => {
    const state = fixture(); state.progression.mastery[insight] = 500;
    state.knowledge.push({ id: 'unrelated-practice', week: state.week, title: '别处记录',
      text: 'PRIVATE_INVENTORY FUTURE_CRIME_PLAN NEXT_DRAW' });
    Object.assign(state.combat!, { hiddenInventory: 'PRIVATE_INVENTORY', crimePlan: 'FUTURE_CRIME_PLAN' });
    const source = { ...currentCriminalCombatSource(state)!, relatedRecord: true, hiddenInventory: true, crimePlan: true };
    const before = structuredClone(state), random = stream(state);
    const effect = resolveCriminalCombatAbility(state, insight, 1, random, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('缺少相关记录');
    expect(effect.label).not.toMatch(/PRIVATE_INVENTORY|FUTURE_CRIME_PLAN|NEXT_DRAW/);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('keeps alertness and insight independent of future RNG, with no forecasting or new status', () => {
    const state = fixture(), changed = structuredClone(state);
    changed.random.seed = 'different-future'; changed.random.cursor = 39;
    Object.assign(changed.combat!, { nextAction: 'UNREVEALED_STRIKE', lethalDanger: true });
    const before = structuredClone(changed);
    const forbidden = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt')
      .mockImplementation(() => { throw new Error('Present observation must not read future draws'); });
    for (const id of [alertness, insight] as const) expect(resolve(changed, id)).toEqual(resolve(state, id));
    expect(changed).toEqual(before); expect(forbidden).not.toHaveBeenCalled();
    expect(Object.keys(state.combat!)).not.toContain('dangerForecast');
  });

  it('rejects stale and forged sources without spending resources, draws or exposing information', () => {
    const state = fixture(), source = currentCriminalCombatSource(state)!;
    const invalid: (CriminalCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as CriminalCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveCriminalCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('does not act on ended, dead, absent, wrong-pathway or unrelated encounters', () => {
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
      expect(currentCriminalCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveCriminalCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Criminal shared enemy actions, injury, death, retreat and deterministic replay', () => {
  it('alternates five player slots and three ordinary enemy slots without extra costs or attacks', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [16 * 0.65, 0], [11.2 * 0.65, 0], [0, 16 * 0.65], [0, 6], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (16 * 0.65 + 11.2 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (16 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(13); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('switches first actor on even rounds and keeps insight nonthreatening', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('never permits injury from alertness, footwork, insight or positive accident', () => {
    for (const ticket of [251, 331, 371, 431]) {
      const state = fixture(), town = structuredClone(state.town);
      const draws = ticket === 431 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 431 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(ticket === 431 ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('applies the negative accident once without dropping, copying or improving a held club', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    scriptRolls(1, 1, 431, 1, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(210); expect(round.moves[0]!.selfGain).toBe(-5);
    expect(state.town).toEqual(town); expect(round.consequenceWeights).toBeNull();
  });

  it('preserves all ordinary enemy attacks despite alertness or footwork', () => {
    for (const ticket of [251, 331]) {
      const state = fixture(); state.mind = 25;
      const draws = scriptRolls(1, 100, ticket, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(215 * 0.8);
      expect(state.mind).toBe(25); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(7);
      expect(state.combat!.navigatorWater).toBeUndefined(); expect(state.combat!.wrathCharge).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('lets H and J cause shared ordinary injury and surrender without an automatic killing blow', () => {
    for (const ticket of [1, 151]) {
      const state = fixture(); state.progression.mastery[brute] = 500;
      scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(30);
      vi.restoreAllMocks();
    }
  });

  it('retains enemy death only through the shared consequence draw after a real attack', () => {
    const state = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD'); expect(state.combat!.enemyHealth).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.spirituality).toBe(30);
  });

  it('retains accumulated player injury risk and real death despite sensitive intuition', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('retreats by the original exit without recovery or changes to original gear', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('携铃者'); expect(round.retreat).toBe('SUCCESS');
    expect(state.spirituality).toBe(10); expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('keeps failed retreat and subsequent enemy injury possible', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(13);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized state and actual held gear from the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
