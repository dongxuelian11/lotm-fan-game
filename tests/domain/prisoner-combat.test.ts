import { ABOMINATION_COUNT_WHEEL, abominationAbilityWheel, currentAbominationCombatSource } from '../../src/domain/abomination/combat.js';
import {MADMAN_COUNT_WHEEL,madmanAbilityWheel} from '../../src/domain/madman/combat.js';
import {WEREWOLF_COUNT_WHEEL,werewolfAbilityWheel} from '../../src/domain/werewolf/combat.js';
import {ZOMBIE_COUNT_WHEEL,zombieAbilityWheel} from '../../src/domain/zombie/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel, prisonerActionCount, currentPrisonerCombatSource,
  drawPrisonerAbility, isPrisoner, resolvePrisonerCombatAbility,
  type PrisonerCombatSource, type PrisonerMoveId } from '../../src/domain/prisoner/combat.js';
import * as prisonerCombat from '../../src/domain/prisoner/combat.js';
import { CRIMINAL_COUNT_WHEEL, criminalAbilityWheel } from '../../src/domain/criminal/combat.js';
import { UNWINGED_COUNT_WHEEL, unwingedAbilityWheel } from '../../src/domain/unwinged/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel } from '../../src/domain/assassin/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'chained.s9.prisoner-body', perception = 'chained.s9.keen-perception', improvisation = 'chained.s9.improvised-combat';
const ids = [body, 'BODY_FOLLOWUP', perception, 'POSITION', improvisation, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('prisoner-combat-test', sliceDefaultCreationSelection, 'prisoner-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'chained', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: PrisonerMoveId, physical = 1,
  source = currentPrisonerCombatSource(state)) {
  return resolvePrisonerCombatAbility(state, id, physical, stream(state), source);
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

describe('Prisoner S9 exact G physical profile', () => {
  it('uses 30/20/20/10/15/5 slots and independent 15/20/25/25/15 counts', () => {
    const state = fixture();
    expect(isPrisoner(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(prisonerAbilityWheel(null, state));
    expect(prisonerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(prisonerAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(PRISONER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves every count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]]) expect(prisonerActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of prisonerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawPrisonerAbility(random, null)).toBe(entry.id);
      expect(drawPrisonerAbility(random, null)).toBe(entry.id);
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
      expect(prisonerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawPrisonerAbility(random, stance)).toBe(ids[index]);
        expect(drawPrisonerAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(prisonerAbilityWheel('RETREAT')).toEqual(prisonerAbilityWheel(null));
  });

  it('dispatches each S9 count boundary with exactly one draw per existing slot', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]] as const) {
      const state = fixture(), cursor = state.random.cursor;
      const draws = scriptRolls(roll, 1, 371, 400, ...Array<number>(count - 1).fill(371), 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect([round.playerCount, round.enemyCount]).toEqual([count, 1]);
      expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(count);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(draws).toHaveBeenCalledTimes(count + 4);
      expect(state.random.cursor).toBe(cursor + count + 4);
      vi.restoreAllMocks();
    }
  });

  it('uses core 35/35/15/15, base200, max30 and one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(221 * 0.8);
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
    vi.spyOn(prisonerCombat, 'resolvePrisonerCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('does not unlock later Chained powers or change neighboring original profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['chained', 1], ['chained', 0]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isPrisoner(state)).toBe(false); expect(currentPrisonerCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(sequence === 1 ? ABOMINATION_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sequence === 1 ? abominationAbilityWheel(state, 'CONTROL') : ordinaryAbilityWheel(false, 'CONTROL'));
      expect(currentAbominationCombatSource(state)).toBeNull();
      if (sequence === 1) expect(playerCountWheel(state)).toHaveLength(6);
    }
    for(const [sequence,wheel,ability] of [[8,MADMAN_COUNT_WHEEL,madmanAbilityWheel],[7,WEREWOLF_COUNT_WHEEL,werewolfAbilityWheel],[6,ZOMBIE_COUNT_WHEEL,zombieAbilityWheel]] as const){
      state.progression.pathwayId='chained';state.progression.sequence=sequence;
      expect(isPrisoner(state)).toBe(false);expect(currentPrisonerCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(wheel);expect(playerAbilityWheel(state,'CONTROL')).toEqual(ability('CONTROL',state));
    }
    state.progression.pathwayId = 'warrior'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(warriorAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'demoness';
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(assassinAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'abyss';
    expect(playerCountWheel(state)).toEqual(CRIMINAL_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(criminalAbilityWheel('CONTROL', state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(UNWINGED_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(unwingedAbilityWheel('CONTROL', state));
  });
});

describe('Prisoner physical budgets, actual tools and bounded present information', () => {
  it('uses 16f/11.2f/16f/6 physical budgets at all mastery nodes for zero spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [perception]: mastery, [improvisation]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolvePrisonerCombatAbility(state, body, 0.8, random)).toMatchObject({
        selfGain: 16 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolvePrisonerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random)).toMatchObject({
        selfGain: 11.2 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolvePrisonerCombatAbility(state, perception, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 16 * factor * 0.8, threatens: false,
      });
      expect(resolvePrisonerCombatAbility(state, 'POSITION', 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 6 * 0.8, threatens: false,
      });
      expect(resolvePrisonerCombatAbility(state, improvisation, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('shares prisoner-body mastery only between H/J and gives ordinary footwork no mastery', () => {
    const state = fixture(); state.progression.mastery = {
      [body]: 500, [perception]: 0, [improvisation]: 500, BODY_FOLLOWUP: 0, POSITION: 500,
      'chained.s8.madness-release': 500, 'chained.s7.werewolf-form': 500, 'chained.s6.zombie-body': 500,
    };
    expect(resolve(state, body).selfGain).toBe(16);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(11.2);
    expect(resolve(state, perception).enemyReduction).toBe(16 * 0.65);
    expect(resolve(state, 'POSITION').enemyReduction).toBe(6);
    expect(resolve(state, improvisation)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(prisonerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors, including both defensive slots', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[body] = mastery; state.progression.mastery[perception] = mastery;
      expect(resolve(state, body).selfGain).toBe(16 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, perception).enemyReduction).toBe(16 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [body]: 500, [perception]: 500 };
    for (const id of [body, 'BODY_FOLLOWUP', perception, 'POSITION'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    expect(resolve(state, body, 3).selfGain).toBe(16);
    expect(resolve(state, perception, 3).enemyReduction).toBe(16);
    expect(resolve(state, 'POSITION', 3).enemyReduction).toBe(6);
  });

  it('only actual Town HAND club replaces H with16; a closed BAG never stacks or equips it', () => {
    for (const mastery of [0, 500]) {
      for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
        const state = fixture(); state.spirituality = 0; state.town.clubLocation = location;
        state.progression.mastery[body] = mastery;
        const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
        expect(resolvePrisonerCombatAbility(state, body, 0.8, random).selfGain)
          .toBe((location === 'HAND' ? 16 : 16 * factor) * 0.8);
        expect(resolvePrisonerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(11.2 * factor * 0.8);
        expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '囚犯体魄打击');
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
      }
    }
    const state = fixture(); state.town.clubLocation = 'SHOP';
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    const before = structuredClone(state);
    expect(resolve(state, body).selfGain).toBe(16 * 0.65); expect(state).toEqual(before);
  });

  it('uses preparation only to check an already held club, with zero gain, cost or mutation', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.spirituality = 0;
      state.progression.mastery[improvisation] = 500;
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePrisonerCombatAbility(state, improvisation, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain(location === 'HAND' ? '只检查已经在手的普通短棍' : '没有已持握的可用工具来源');
      expect(playerAbilityWheel(state, 'PREPARE')[4]!.label)
        .toBe(location === 'HAND' ? '核实原短棍握持' : '核实手边普通工具');
      expect(resolvePrisonerCombatAbility(state, body, 1, random).selfGain)
        .toBe(location === 'HAND' ? 16 : 16 * 0.65);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rechecks the actual held original instead of taking equipment from supplied source flags', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    const source = { ...currentPrisonerCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
    state.town.clubLocation = 'BAG';
    const before = structuredClone(state), random = stream(state);
    expect(resolvePrisonerCombatAbility(state, body, 1, random, source).selfGain).toBe(16 * 0.65);
    expect(resolvePrisonerCombatAbility(state, improvisation, 1, random, source).label)
      .toContain('没有已持握的可用工具来源');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('never promotes the borrowed PR9-STOP-01 practice spacer into combat equipment', () => {
    // Synthetic pure-engine boundary test. The public domain blocks entry while
    // the original spacer is held, so this is not a natural combat-entry route.
    const state = fixture();
    state.prisoner.cases['jammed-shutter']!.holding = true;
    state.prisoner.cases['jammed-shutter']!.returns = 2;
    state.town.clubLocation = 'BAG';
    const before = structuredClone(state), random = stream(state);
    expect(resolvePrisonerCombatAbility(state, body, 1, random).selfGain).toBe(16 * 0.65);
    expect(resolvePrisonerCombatAbility(state, improvisation, 1, random)).toMatchObject({
      selfGain: 0, enemyReduction: 0, threatens: false,
    });
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('囚犯体魄打击');
    expect(playerAbilityWheel(state, null)[4]!.label).toBe('核实手边普通工具');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('derives only the current ordinary body, passage and original exit', () => {
    const state = fixture();
    expect(currentPrisonerCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
  });

  it('cannot turn knowledge, mastery or supplied flags into a held tool or private information', () => {
    const state = fixture(); state.progression.mastery[improvisation] = 500;
    state.knowledge.push({ id: 'unrelated-practice', week: state.week, title: '别处记录',
      text: 'PRIVATE_INVENTORY FUTURE_ACTION NEXT_DRAW' });
    Object.assign(state.combat!, { hiddenInventory: 'PRIVATE_INVENTORY', futureAction: 'FUTURE_ACTION' });
    const source = { ...currentPrisonerCombatSource(state)!, heldTool: true, hiddenInventory: true, futureAction: true };
    const before = structuredClone(state), random = stream(state);
    const effect = resolvePrisonerCombatAbility(state, improvisation, 1, random, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('没有已持握的可用工具来源');
    expect(effect.label).not.toMatch(/PRIVATE_INVENTORY|FUTURE_ACTION|NEXT_DRAW/);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('keeps perception and improvisation independent of future RNG, with no forecasting or new status', () => {
    const state = fixture(), changed = structuredClone(state);
    changed.random.seed = 'different-future'; changed.random.cursor = 39;
    Object.assign(changed.combat!, { nextAction: 'UNREVEALED_STRIKE', lethalDanger: true });
    const before = structuredClone(changed);
    const forbidden = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt')
      .mockImplementation(() => { throw new Error('Present observation must not read future draws'); });
    for (const id of [perception, improvisation] as const) expect(resolve(changed, id)).toEqual(resolve(state, id));
    expect(changed).toEqual(before); expect(forbidden).not.toHaveBeenCalled();
    expect(Object.keys(state.combat!)).not.toContain('dangerForecast');
  });

  it('rejects stale and forged sources without spending resources, draws or exposing information', () => {
    const state = fixture(), source = currentPrisonerCombatSource(state)!;
    const invalid: (PrisonerCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as PrisonerCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolvePrisonerCombatAbility(state, id, 1, random, input))
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
      expect(currentPrisonerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolvePrisonerCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Prisoner shared enemy actions, injury, death, retreat and deterministic replay', () => {
  it('keeps five held-club preparation slots nonthreatening without an extra attack or item change', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.spirituality = 0;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves).toHaveLength(5);
    expect(moves.every(move => move.label.includes('只检查已经在手的普通短棍'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(3); expect(state.town).toEqual(before.town);
    expect(state.progression).toEqual(before.progression); expect(state.prisoner).toEqual(before.prisoner);
    expect(draws).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(before.random.cursor + 9);
  });

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

  it('switches first actor on even rounds and keeps improvisation nonthreatening', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('never permits injury from perception, footwork, improvisation or positive accident', () => {
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

  it('preserves all ordinary enemy attacks despite perception or footwork', () => {
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
      const state = fixture(); state.progression.mastery[body] = 500;
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

  it('retains accumulated player injury risk and real death despite keen perception', () => {
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
