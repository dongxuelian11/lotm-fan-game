import { BLATHERER_COUNT_WHEEL, blathererAbilityWheel, currentBlathererCombatSource } from '../../src/domain/blatherer/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SERIAL_KILLER_COUNT_WHEEL, serialKillerAbilityWheel, serialKillerActionCount, currentSerialKillerCombatSource,
  drawSerialKillerAbility, isSerialKiller, resolveSerialKillerCombatAbility,
  type SerialKillerCombatSource, type SerialKillerMoveId } from '../../src/domain/serial-killer/combat.js';
import * as serialKillerCombat from '../../src/domain/serial-killer/combat.js';
import { UNWINGED_COUNT_WHEEL, unwingedAbilityWheel, isUnwinged } from '../../src/domain/unwinged/combat.js';
import { CRIMINAL_COUNT_WHEEL, criminalAbilityWheel, isCriminal } from '../../src/domain/criminal/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel } from '../../src/domain/assassin/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'abyss.s8.inhuman-body', alertness = 'abyss.s9.alertness', lore = 'abyss.s7.demonic-lore';
const ids = [body, 'BODY_FOLLOWUP', alertness, 'POSITION', lore, 'ACCIDENT'] as const;
/** Synthetic combat-only state; natural S7 acquisition is tested separately. */
function fixture(): SliceState {
  const state = createSliceRun('serial-killer-combat-test', sliceDefaultCreationSelection, 'serial-killer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'abyss', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SerialKillerMoveId, physical = 1,
  source = currentSerialKillerCombatSource(state)) {
  return resolveSerialKillerCombatAbility(state, id, physical, stream(state), source);
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

describe('Serial Killer S7 exact G physical profile', () => {
  it('uses 30/20/20/10/15/5 slots and independent 10/15/25/30/20 counts', () => {
    const state = fixture();
    expect(isSerialKiller(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(serialKillerAbilityWheel(null, state));
    expect(serialKillerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(serialKillerAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(SERIAL_KILLER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('preserves every count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]]) expect(serialKillerActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of serialKillerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawSerialKillerAbility(random, null)).toBe(entry.id);
      expect(drawSerialKillerAbility(random, null)).toBe(entry.id);
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
      expect(serialKillerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawSerialKillerAbility(random, stance)).toBe(ids[index]);
        expect(drawSerialKillerAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(serialKillerAbilityWheel('RETREAT')).toEqual(serialKillerAbilityWheel(null));
  });

  it('dispatches each S7 count boundary without adding an action or a random draw', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]] as const) {
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

  it('uses core 30/35/20/15, base450, max60 and one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(472 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(6);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town);
  });

  it('caps core at90 and combined penalties at40 percent, with recovery capped at60', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(state.spirituality).toBe(9); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60);
  });

  it('retains the S7 floor45 after extreme negative contribution', () => {
    vi.spyOn(serialKillerCombat, 'resolveSerialKillerCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('does not unlock later Abyss powers or change neighboring original profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['abyss', 3], ['abyss', 3], ['abyss', 2]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSerialKiller(state)).toBe(false); expect(currentSerialKillerCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(sequence === 3 ? BLATHERER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sequence === 3 ? blathererAbilityWheel(state, 'CONTROL') : ordinaryAbilityWheel(false, 'CONTROL'));
      expect(currentBlathererCombatSource(state)).toBeNull();
    }
    state.progression.pathwayId = 'abyss'; state.progression.sequence = 8;
    expect(isSerialKiller(state)).toBe(false); expect(isUnwinged(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(UNWINGED_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(unwingedAbilityWheel('CONTROL', state));
    state.progression.sequence = 9;
    expect(isSerialKiller(state)).toBe(false); expect(isCriminal(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(CRIMINAL_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(criminalAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'warrior'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(warriorAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'demoness';
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(assassinAbilityWheel('CONTROL', state));
  });
});

describe('Serial Killer physical budgets, actual tools and bounded present information', () => {
  it('uses 36f/25.2f/27f/6 physical budgets at all mastery nodes for zero spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [alertness]: mastery, [lore]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveSerialKillerCombatAbility(state, body, 0.8, random)).toMatchObject({
        selfGain: 36 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveSerialKillerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random)).toMatchObject({
        selfGain: 25.2 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveSerialKillerCombatAbility(state, alertness, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 27 * factor * 0.8, threatens: false,
      });
      expect(resolveSerialKillerCombatAbility(state, 'POSITION', 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 6 * 0.8, threatens: false,
      });
      expect(resolveSerialKillerCombatAbility(state, lore, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('shares the inherited inhuman-body mastery only between H/J and gives ordinary footwork no mastery', () => {
    const state = fixture(); state.progression.mastery = {
      [body]: 500, [alertness]: 0, [lore]: 500, BODY_FOLLOWUP: 0, POSITION: 500,
      'abyss.s6.danger-sense': 500, 'abyss.s6.demonization': 500, 'warrior.s6.dawn-armor': 500,
    };
    expect(resolve(state, body).selfGain).toBe(36);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(25.2);
    expect(resolve(state, alertness).enemyReduction).toBe(27 * 0.65);
    expect(resolve(state, 'POSITION').enemyReduction).toBe(6);
    expect(resolve(state, lore)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(serialKillerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('retains all four inherited mastery entries without letting lore unlock spells or amplify the body', () => {
    const state = fixture();
    state.progression.mastery = {
      'abyss.s9.brute-force': 500, [alertness]: 300, 'abyss.s9.illicit-insight': 400, [body]: 0,
      [lore]: 500, 'abyss.s7.ritual-practice': 500,
      'abyss.s8.lesser-sorcery': 500, 'abyss.s6.infernal-spells': 500,
    };
    const before = structuredClone(state);
    expect(resolve(state, body).selfGain).toBe(36 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(25.2 * 0.65);
    expect(resolve(state, alertness).enemyReduction).toBe(27 * (0.65 + 0.35 * 300 / 500));
    expect(resolve(state, lore)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(state).toEqual(before);
  });

  it('bounds malformed mastery and physical factors, including both defensive slots', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[body] = mastery; state.progression.mastery[alertness] = mastery;
      expect(resolve(state, body).selfGain).toBe(36 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, alertness).enemyReduction).toBe(27 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [body]: 500, [alertness]: 500 };
    for (const id of [body, 'BODY_FOLLOWUP', alertness, 'POSITION'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
    }
    expect(resolve(state, body, 3).selfGain).toBe(36);
    expect(resolve(state, alertness, 3).enemyReduction).toBe(27);
    expect(resolve(state, 'POSITION', 3).enemyReduction).toBe(6);
  });

  it('only actual Town HAND club replaces H with16 without stacking or mastery amplification', () => {
    for (const mastery of [0, 500]) {
      for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
        const state = fixture(); state.spirituality = 0; state.town.clubLocation = location;
        state.progression.mastery[body] = mastery;
        const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
        expect(resolveSerialKillerCombatAbility(state, body, 0.8, random).selfGain)
          .toBe((location === 'HAND' ? 16 : 36 * factor) * 0.8);
        expect(resolveSerialKillerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(25.2 * factor * 0.8);
        expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '继承非人体魄打击');
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
      }
    }
    const state = fixture(); state.town.clubLocation = 'SHOP';
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    const before = structuredClone(state);
    expect(resolve(state, body).selfGain).toBe(36 * 0.65); expect(state).toEqual(before);
  });

  it('derives only the current ordinary body, passage and original exit', () => {
    const state = fixture();
    expect(currentSerialKillerCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
  });

  it('cannot turn lore, ritual mastery or supplied preparation claims into a combat ritual', () => {
    const state = fixture(); state.progression.mastery[lore] = 500; state.progression.mastery['abyss.s7.ritual-practice'] = 500;
    state.knowledge.push({ id: 'unrelated-practice', week: state.week, title: '别处记录',
      text: 'PREPARED_RITUAL PRIVATE_INVENTORY FUTURE_CRIME_PLAN NEXT_DRAW' });
    Object.assign(state.combat!, { ritualPrepared: true, ritualSource: 'PREPARED_RITUAL', hiddenInventory: 'PRIVATE_INVENTORY', crimePlan: 'FUTURE_CRIME_PLAN' });
    const source = { ...currentSerialKillerCombatSource(state)!, ritualPrepared: true, ritualSource: true, relatedRecord: true, hiddenInventory: true, crimePlan: true };
    const before = structuredClone(state), random = stream(state);
    const effect = resolveSerialKillerCombatAbility(state, lore, 1, random, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('没有已登记的可用仪式来源');
    expect(effect.label).toContain('本次贡献0、消耗0');
    expect(effect.label).toContain('不额外抽盘');
    expect(effect.label).not.toMatch(/PREPARED_RITUAL|PRIVATE_INVENTORY|FUTURE_CRIME_PLAN|NEXT_DRAW/);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('keeps repeated preparation at zero without recovering mind, cleansing costs or creating a spell', () => {
    const state = fixture(); state.mind = 30; state.spirituality = 0;
    state.unwinged.conscienceLost = true;
    state.progression.mastery[lore] = 500;
    state.progression.mastery['abyss.s7.ritual-practice'] = 500;
    state.progression.mastery['abyss.s6.infernal-spells'] = 500;
    state.progression.mastery['abyss.s5.desire-control'] = 500;
    const before = structuredClone(state), random = stream(state);
    for (let repeat = 0; repeat < 5; repeat++) {
      expect(resolveSerialKillerCombatAbility(state, lore, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(serialKillerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('keeps alertness and lore independent of future RNG, with no forecasting or new status', () => {
    const state = fixture(), changed = structuredClone(state);
    changed.random.seed = 'different-future'; changed.random.cursor = 39;
    Object.assign(changed.combat!, { nextAction: 'UNREVEALED_STRIKE', lethalDanger: true });
    const before = structuredClone(changed);
    const forbidden = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt')
      .mockImplementation(() => { throw new Error('Present observation must not read future draws'); });
    for (const id of [alertness, lore] as const) expect(resolve(changed, id)).toEqual(resolve(state, id));
    expect(changed).toEqual(before); expect(forbidden).not.toHaveBeenCalled();
    expect(Object.keys(state.combat!)).not.toContain('dangerForecast');
  });

  it('rejects stale and forged sources without spending resources, draws or exposing information', () => {
    const state = fixture(), source = currentSerialKillerCombatSource(state)!;
    const invalid: (SerialKillerCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as SerialKillerCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveSerialKillerCombatAbility(state, id, 1, random, input))
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
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentSerialKillerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveSerialKillerCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Serial Killer shared enemy actions, injury, death, retreat and deterministic replay', () => {
  it('does not turn conscience loss into armor, pressure immunity, mind control or injury protection', () => {
    const state = fixture();
    state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    state.unwinged.conscienceLost = false;
    const changed = structuredClone(state); changed.unwinged.conscienceLost = true;
    const originalProfile = structuredClone(changed.unwinged);
    scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const originalResult = resolveSliceCombatRound(state, 'ATTACK');
    vi.restoreAllMocks();
    const draws = scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const changedResult = resolveSliceCombatRound(changed, 'ATTACK');
    expect(changedResult).toEqual(originalResult);
    expect(changedResult.outcome).toBe('PLAYER_DEAD');
    expect(changedResult.round.playerAdvantage).toBe(465 * 0.6);
    expect(changedResult.round.moves[0]!.enemyReduction).toBe(27 * 0.65 * 0.9);
    expect(changedResult.round.moves[1]!.selfGain).toBe(16);
    expect(changedResult.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(changed).toMatchObject({ health: 0, mind: 25, spirituality: 5, injuryRisk: 2 });
    expect(changed.combat).toMatchObject({ enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(changed.unwinged).toEqual(originalProfile);
    expect(draws).toHaveBeenCalledTimes(6);
    changed.unwinged.conscienceLost = false;
    expect(changed).toEqual(state);
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
      [36 * 0.65, 0], [25.2 * 0.65, 0], [0, 27 * 0.65], [0, 6], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(465 * 0.8 + (36 * 0.65 + 25.2 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (27 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(16); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('switches first actor on even rounds and keeps lore nonthreatening', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('never permits injury from alertness, footwork, lore or positive accident', () => {
    for (const ticket of [251, 331, 371, 431]) {
      const state = fixture(), town = structuredClone(state.town);
      const draws = ticket === 431 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 431 ? 11.25 : 0);
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
    expect(round.playerAdvantage).toBe(453.75); expect(round.moves[0]!.selfGain).toBe(-11.25);
    expect(state.town).toEqual(town); expect(round.consequenceWeights).toBeNull();
  });

  it('preserves all ordinary enemy attacks despite alertness or footwork', () => {
    for (const ticket of [251, 331]) {
      const state = fixture(); state.mind = 25;
      const draws = scriptRolls(1, 100, ticket, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(465 * 0.8);
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
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(60);
      vi.restoreAllMocks();
    }
  });

  it('retains enemy death only through the shared consequence draw after a real attack', () => {
    const state = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD'); expect(state.combat!.enemyHealth).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.spirituality).toBe(60);
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

  it('keeps old injuries and increments defeat risk even when preparation meets no effective strike', () => {
    const state = fixture(); state.health = 70; state.injuryRisk = 2;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    state.mind = 30; state.spirituality = 0; state.unwinged.conscienceLost = true;
    const before = structuredClone(state);
    const draws = scriptRolls(1, 1, 371, 400, 1_000_000);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.winner).toBe('ENEMY');
    expect(round.consequenceWeights).toBeNull(); expect(state.injuryRisk).toBe(3);
    expect(state.health).toBe(70); expect(state.injuries).toEqual(before.injuries);
    expect(state.mind).toBe(30); expect(state.spirituality).toBe(6);
    expect(state.unwinged).toEqual(before.unwinged);
    expect(draws).toHaveBeenCalledTimes(5);
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
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(16);
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
