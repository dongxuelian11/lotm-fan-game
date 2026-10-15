import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { WARRIOR_COUNT_WHEEL, currentWarriorCombatSource, drawWarriorAbility, isWarrior,
  resolveWarriorCombatAbility, warriorAbilityWheel, warriorActionCount, warriorPlayerHoldsPracticeClub,
  type WarriorCombatSource, type WarriorMoveId } from '../../src/domain/warrior/combat.js';
import * as warriorCombat from '../../src/domain/warrior/combat.js';
import { SAILOR_COUNT_WHEEL, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import { MARAUDER_COUNT_WHEEL, marauderAbilityWheel } from '../../src/domain/marauder/combat.js';
import { SWINDLER_COUNT_WHEEL, swindlerAbilityWheel } from '../../src/domain/swindler/combat.js';
import { CRYPTOLOGIST_COUNT_WHEEL, cryptologistAbilityWheel } from '../../src/domain/cryptologist/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const physique = 'warrior.s9.physique', arms = 'warrior.s9.arms', restraint = 'warrior.s9.restraint';
const ids = [physique, arms, restraint, 'POSITION', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('warrior-combat-test', sliceDefaultCreationSelection, 'warrior-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'warrior', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: WarriorMoveId, physical = 1,
  source = currentWarriorCombatSource(state)) {
  return resolveWarriorCombatAbility(state, id, physical, stream(state), source);
}
function heldPracticeClub(state: SliceState) {
  Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand', version: 2 });
}
/** Script known tickets while retaining the production deterministic cursor. */
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

describe('Warrior S9 exact M combat profile', () => {
  it('uses six38/20/8/5/4/25 slots and independent35/30/20/15 counts', () => {
    const state = fixture();
    expect(isWarrior(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(warriorAbilityWheel(null, state));
    expect(warriorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(warriorAbilityWheel(null).map(entry => entry.weight)).toEqual([38, 20, 8, 5, 4, 25]);
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 30, 20, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(38);
    expect(playerCountWheel(state)[0]!.weight).toBe(35);
  });

  it('preserves every count and ability boundary with exactly one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [65, 2], [66, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(warriorActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of warriorAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawWarriorAbility(random, null)).toBe(entry.id);
      expect(drawWarriorAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('uses exact normalized ×1.25 tickets for each stance, including both attack slots', () => {
    for (const [stance, weights] of [
      ['ATTACK', [190, 100, 32, 20, 16, 100]],
      ['DEFEND', [152, 80, 40, 20, 16, 100]],
      ['CONTROL', [152, 80, 32, 25, 16, 100]],
      ['PREPARE', [152, 80, 32, 20, 20, 100]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(warriorAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawWarriorAbility(random, stance)).toBe(ids[index]);
        expect(drawWarriorAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(warriorAbilityWheel('RETREAT')).toEqual(warriorAbilityWheel(null));
  });

  it('uses core50/20/20/10, base200 and max30 round-end recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 343, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(219 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.warrior).toEqual(before.warrior); expect(state.world).toEqual(before.world);
  });

  it('caps the core bonus at40 and combined status penalty at40 percent', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(state.spirituality).toBe(6);
    vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 343, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30);
  });

  it('retains the S9 advantage floor20 after extreme accumulated negative contribution', () => {
    vi.spyOn(warriorCombat, 'resolveWarriorCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('keeps ordinary and neighboring original profiles untouched', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['warrior', 1], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isWarrior(state)).toBe(false); expect(currentWarriorCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'tyrant'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'error';
    expect(playerCountWheel(state)).toEqual(MARAUDER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(marauderAbilityWheel('CONTROL', state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(SWINDLER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(swindlerAbilityWheel('CONTROL', state));
    state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(CRYPTOLOGIST_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(cryptologistAbilityWheel('CONTROL', state));
  });
});

describe('Warrior physical budgets, actual tools and source boundaries', () => {
  it('uses exact26f/18.2f/6f/4.2f budgets at all six mastery nodes even at zero spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [physique]: mastery, [arms]: mastery, [restraint]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveWarriorCombatAbility(state, physique, 0.8, random)).toMatchObject({ selfGain: 26 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveWarriorCombatAbility(state, arms, 0.8, random)).toMatchObject({ selfGain: 18.2 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveWarriorCombatAbility(state, restraint, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 6 * factor, threatens: false });
      expect(resolveWarriorCombatAbility(state, 'POSITION', 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 4.2 * factor, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('reads only each existing G training mastery, never unrelated high-sequence entries', () => {
    const state = fixture(); state.progression.mastery = { [physique]: 500, [arms]: 250, [restraint]: 0,
      'warrior.s6.dawn-armor': 500, 'warrior.s6.dawn-weapon': 500, 'warrior.s8.grapple': 500 };
    expect(resolve(state, physique).selfGain).toBe(26);
    expect(resolve(state, arms).selfGain).toBe(18.2 * (0.65 + 0.35 * 250 / 500));
    expect(resolve(state, restraint).enemyReduction).toBe(6 * 0.65);
    expect(resolve(state, 'POSITION').enemyReduction).toBe(4.2 * (0.65 + 0.35 * 250 / 500));
    expect(warriorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors, without making zero output threatening', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[physique] = mastery;
      expect(resolve(state, physique).selfGain).toBe(26 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [physique]: 500, [arms]: 500 };
    for (const id of [physique, arms]) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === physique ? 26 : 18.2);
    }
  });

  it('only an actual held town club replaces H with16, while J stays one bodily18.2f action', () => {
    const state = fixture(); state.progression.mastery = { [physique]: 500, [arms]: 500 };
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location; const before = structuredClone(state), random = stream(state);
      expect(resolveWarriorCombatAbility(state, physique, 0.8, random).selfGain).toBe((location === 'HAND' ? 16 : 26) * 0.8);
      expect(resolveWarriorCombatAbility(state, arms, 0.8, random).selfGain).toBe(18.2 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '战士体魄打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('uses only the original borrowed practice club with correct owner, custody and location', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    expect(warriorPlayerHoldsPracticeClub(state)).toBe(false); expect(resolve(state, physique).selfGain).toBe(26);
    heldPracticeClub(state); const before = structuredClone(state);
    expect(warriorPlayerHoldsPracticeClub(state)).toBe(true);
    expect(resolve(state, physique, 0.8).selfGain).toBe(16 * 0.8);
    expect(resolve(state, physique).label).toContain('奥斯温原练习短棍');
    expect(resolve(state, physique).label).toContain('不叠加体魄预算');
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握奥斯温原练习短棍打击');
    expect(state).toEqual(before);
    for (const mismatch of [
      { id: 'copy-club' }, { owner: '另一人' }, { custodian: 'MENTOR' }, { location: 'training-rack' },
    ]) {
      const candidate = structuredClone(before); Object.assign(candidate.warrior.practiceClub, mismatch);
      const untouched = structuredClone(candidate);
      expect(warriorPlayerHoldsPracticeClub(candidate)).toBe(false); expect(resolve(candidate, physique).selfGain).toBe(26);
      expect(candidate).toEqual(untouched);
    }
  });

  it('does not create, borrow, equip, duplicate, drop or return an original tool during any action', () => {
    for (const held of [false, true]) {
      const state = fixture(); if (held) heldPracticeClub(state);
      const before = structuredClone(state);
      for (const id of ids.slice(0, 5)) resolve(state, id);
      const random = stream(state), draws = scriptRolls(1, 2);
      expect(resolveWarriorCombatAbility(state, 'ACCIDENT', 1, random).selfGain).toBe(-5);
      expect(resolveWarriorCombatAbility(state, 'ACCIDENT', 1, random).selfGain).toBe(5);
      expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
      vi.restoreAllMocks();
    }
  });

  it('derives only the current first-case ordinary body, actual passage and existing exit', () => {
    const state = fixture();
    expect(currentWarriorCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    state.knowledge.push({ id: 'old-fear', week: 1, title: '旧消息', text: 'PRIVATE_SECRET 光甲 巨剑 恐惧免疫' });
    const before = structuredClone(state);
    expect(resolve(state, 'OBSERVE').label).toContain('本次贡献0');
    expect(resolve(state, 'OBSERVE').label).not.toMatch(/PRIVATE_SECRET|巨剑|恐惧免疫/);
    expect(state).toEqual(before);
  });

  it('rejects stale or forged sources without extra draws, actions or hidden information', () => {
    const state = fixture(), source = currentWarriorCombatSource(state)!;
    const invalid: (WarriorCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as WarriorCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveWarriorCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('does not act for ended, dead, absent, wrong-pathway or noncurrent encounters', () => {
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
      expect(currentWarriorCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveWarriorCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Warrior shared first-case rounds, death, retreat and replay', () => {
  it('resolves all four actions against three ordinary enemy actions with no free attack or resource cost', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 191, 1, 291, 1, 323, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [26 * 0.65, 0], [18.2 * 0.65, 0], [0, 6 * 0.65], [0, 4.2 * 0.65],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (26 * 0.65 + 18.2 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (6 * 0.65 + 4.2 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(13); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.warrior).toEqual(before.warrior);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(before.random.cursor + 11);
  });

  it('never authorizes injury from defense, position, preparation or a positive accident', () => {
    for (const ticket of [291, 323, 343, 359]) {
      const state = fixture(); heldPracticeClub(state); const club = structuredClone(state.warrior.practiceClub);
      const draws = ticket === 359 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 359 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.warrior.practiceClub).toEqual(club); expect(draws).toHaveBeenCalledTimes(ticket === 359 ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('applies a negative accident exactly once without losing the held original club', () => {
    const state = fixture(); heldPracticeClub(state); const club = structuredClone(state.warrior.practiceClub);
    scriptRolls(1, 1, 359, 1, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(210); expect(round.moves[0]!.selfGain).toBe(-5);
    expect(state.warrior.practiceClub).toEqual(club); expect(round.consequenceWeights).toBeNull();
  });

  it('keeps ordinary enemy strikes intact: no light armor, fear immunity or forced grapple', () => {
    const state = fixture(); state.mind = 25;
    const draws = scriptRolls(1, 100, 323, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(215 * 0.8);
    expect(round.moves[0]!.label).toContain('不强制擒拿或取消对手行动');
    expect(state.mind).toBe(25); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.sailorScalesReady).toBeUndefined(); expect(state.combat!.navigatorWater).toBeUndefined();
    expect(state.combat!.wrathCharge).toBeUndefined();
  });

  it('lets real H and J body attacks cause the ordinary injury and surrender consequences', () => {
    for (const ticket of [1, 191]) {
      const state = fixture(); state.spirituality = 0;
      scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(0);
      vi.restoreAllMocks();
    }
  });

  it('keeps real ordinary enemy damage, accumulated injury risk and death despite defense', () => {
    const state = fixture(); heldPracticeClub(state); const club = structuredClone(state.warrior.practiceClub);
    state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 291, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(round.moves[0]!.label).toContain('不能防弹');
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(state.warrior.practiceClub).toEqual(club); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses the original ordinary retreat route and preserves held custody without end-round recovery', () => {
    const state = fixture(); state.spirituality = 10; heldPracticeClub(state);
    const club = structuredClone(state.warrior.practiceClub), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('携铃者'); expect(round.retreat).toBe('SUCCESS');
    expect(state.spirituality).toBe(10); expect(state.warrior.practiceClub).toEqual(club);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it('does not make retreat automatic or protect from enemy attacks after an unsuccessful attempt', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(13);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized S9 state and original club custody from the same seed and cursor', () => {
    const state = fixture(); heldPracticeClub(state); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.warrior.practiceClub).toMatchObject({ id: 'warrior-training-club',
      owner: '奥斯温·布莱克特', custodian: 'PLAYER', location: 'player:hand', version: 2 });
  });
});
