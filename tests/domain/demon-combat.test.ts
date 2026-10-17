import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  DEMON_COUNT_WHEEL, currentDemonCombatSource, demonAbilityWheel, demonActionCount, drawDemonAbility,
  isDemon, resolveDemonCombatAbility, type DemonCombatSource, type DemonMoveId,
} from '../../src/domain/demon/combat.js';
import * as demonCombat from '../../src/domain/demon/combat.js';
import { SERIAL_KILLER_COUNT_WHEEL, resolveSerialKillerCombatAbility, serialKillerAbilityWheel }
  from '../../src/domain/serial-killer/combat.js';
import { UNWINGED_COUNT_WHEEL, unwingedAbilityWheel } from '../../src/domain/unwinged/combat.js';
import { CRIMINAL_COUNT_WHEEL, criminalAbilityWheel } from '../../src/domain/criminal/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'abyss.s6.flame-hex', J = 'BODY_FOLLOWUP', B = 'abyss.s6.demonic-body';
const K = 'POSITION', R = 'abyss.s6.danger-premonition', A = 'ACCIDENT';
const ids = [H, J, B, K, R, A] as const;

/** Combat arrival only; growth tests cover paid arrival and actual practice exits. */
function fixture(strain = 0): SliceState {
  const state = createSliceRun('demon-combat-test', sliceDefaultCreationSelection, 'demon-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'abyss', sequence: 6, acting: 0, promotionWeek: 1,
    mastery: { [H]: 0, [B]: 0, [R]: 0, 'abyss.s9.brute-force': 0, 'abyss.s9.alertness': 0,
      'abyss.s9.illicit-insight': 0, 'abyss.s8.inhuman-body': 0, 'abyss.s7.demonic-lore': 0 } };
  Object.assign(state.demon.cases['loading-lane']!, { status: 'RESOLVED', outcome: 'LANE_VERIFIED', method: 'ORDINARY' });
  state.demon.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length, attemptWeek: state.week };
  state.demon.practice = { body: 'NORMAL', flame: 'NONE' }; state.demon.strain = strain;
  state.combat = { encounterId: 'DEMON_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-demon-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: DemonMoveId, physical = 1,
  source: DemonCombatSource | null = currentDemonCombatSource(state), random = fixedRolls()) {
  return resolveDemonCombatAbility(state, id, physical, random, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '本轮没有有效致伤动作',
    consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
function scriptRolls(...rolls: number[]) {
  const originalNext = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    originalNext.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Demon exact S6 candidate profile', () => {
  it('routes only abyss6 to detached30/15/25/10/15/5 and10/15/25/30/20 wheels', () => {
    const state = fixture(); expect(isDemon(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(demonAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(DEMON_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    state.progression.pathwayId = 'chained'; expect(isDemon(state)).toBe(false);
  });

  it('keeps every count and stance ticket boundary with one draw per selected slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]]) {
      expect(demonActionCount(roll!)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      demonAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawDemonAbility(random, stance)).toBe(ids[index]);
        expect(drawDemonAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('retains the old abyss9–7 wheels, S7 body budgets and its separate accident coin', () => {
    const state = fixture();
    for (const [sequence, count, wheel] of [
      [9, CRIMINAL_COUNT_WHEEL, criminalAbilityWheel], [8, UNWINGED_COUNT_WHEEL, unwingedAbilityWheel],
      [7, SERIAL_KILLER_COUNT_WHEEL, serialKillerAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence; expect(isDemon(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count); expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentDemonCombatSource(state)).toBeNull();
    }
    state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(resolveSerialKillerCombatAbility(state, 'abyss.s8.inhuman-body', 1, fixedRolls()).selfGain).toBe(36 * 0.65);
    expect(resolveSerialKillerCombatAbility(state, J, 1, fixedRolls()).selfGain).toBe(25.2 * 0.65);
    const random = fixedRolls(2);
    expect(resolveSerialKillerCombatAbility(state, A, 1, random).selfGain).toBe(11.25); expect(random.cursor).toBe(1);
    expect(state.demon.strain).toBe(0);
  });
});

describe('Demon finite costs and visible strain cap', () => {
  it('pays H3S1strain immediately using only flame mastery and the spell budget54.925f', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.progression.mastery[H] = mastery; state.progression.mastery[B] = 500;
      const practice = structuredClone(state.demon.practice), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, random)).toMatchObject({
        selfGain: 54.925 * (0.65 + 0.35 * mastery / 500), enemyReduction: 0, threatens: true,
      });
      expect(state.spirituality).toBe(77); expect(state.demon.strain).toBe(1);
      expect(state.demon.practice).toEqual(practice); expect(random.cursor).toBe(0);
      expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
    }
  });

  it('prioritizes the actually held town club, replacing H without changing J or resources', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[H] = 500;
    state.progression.mastery[B] = 100; const before = structuredClone(state);
    expect(resolve(state, H, 0.8)).toMatchObject({ selfGain: 16 * 0.8, enemyReduction: 0, threatens: true });
    expect(resolve(state, J, 0.8).selfGain).toBe(29.575 * 0.72 * 0.8);
    expect(playerAbilityWheel(state, null)[0]!.label).toContain('不增加负荷'); expect(state).toEqual(before);
    state.town.clubLocation = 'BAG';
    expect(resolve(state, H).selfGain).toBe(54.925); expect(state.demon.strain).toBe(1);
  });

  it('falls back without partial payment when S is insufficient, while2S still pays B', () => {
    for (const spirituality of [0, 1]) {
      const state = fixture(); state.spirituality = spirituality; const before = structuredClone(state);
      expect(resolve(state, H, 0.8).selfGain).toBe(12 * 0.8);
      expect(resolve(state, B, 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 10 * 0.8, threatens: false });
      expect(state).toEqual(before);
    }
    const state = fixture(); state.spirituality = 2;
    expect(resolve(state, H).selfGain).toBe(12); expect(state.spirituality).toBe(2); expect(state.demon.strain).toBe(0);
    expect(resolve(state, B).enemyReduction).toBe(50.7 * 0.65);
    expect(state.spirituality).toBe(0); expect(state.demon.strain).toBe(1);
  });

  it('pays selected slots in order until strain3 and then uses ordinary fallback without madness', () => {
    const state = fixture(); state.spirituality = 20;
    expect(resolve(state, H).selfGain).toBe(54.925 * 0.65);
    expect(resolve(state, B).enemyReduction).toBe(50.7 * 0.65);
    expect(resolve(state, H).selfGain).toBe(54.925 * 0.65);
    expect(state.spirituality).toBe(12); expect(state.demon.strain).toBe(3);
    const before = structuredClone(state);
    expect(resolve(state, H).selfGain).toBe(12); expect(resolve(state, B).enemyReduction).toBe(10);
    expect(resolve(state, J).selfGain).toBe(29.575 * 0.65); expect(state).toEqual(before);
    state.town.clubLocation = 'HAND'; expect(resolve(state, H).selfGain).toBe(16);
    expect(state.demon.strain).toBe(3); expect(state.spirituality).toBe(12);
  });

  it('does not spend on malformed strain or nonfinite spirituality', () => {
    for (const strain of [-1, 0.5, 4, Number.NaN]) {
      const state = fixture(strain), before = structuredClone(state);
      expect(resolve(state, H).selfGain).toBe(12); expect(resolve(state, B).enemyReduction).toBe(10);
      expect(state).toEqual(before);
    }
    for (const spirituality of [Number.NaN, Infinity]) {
      const state = fixture(); state.spirituality = spirituality; const before = structuredClone(state);
      expect(resolve(state, H).selfGain).toBe(12); expect(resolve(state, B).enemyReduction).toBe(10);
      expect(state).toEqual(before);
    }
  });

  it('limits B to50.7 bodyf and this slot, preserving health, mind, injuries, risk and normal form', () => {
    const state = fixture(); state.health = 55; state.mind = 67; state.injuryRisk = 4;
    state.progression.mastery[B] = 100; state.progression.mastery[H] = 500;
    state.injuries.push({ id: 'prior-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({
      selfGain: 0, enemyReduction: 50.7 * 0.72 * 0.8, threatens: false,
    });
    expect(state.spirituality).toBe(78); expect(state.demon.strain).toBe(1); expect(state.health).toBe(55);
    expect(state.injuries).toEqual(before.injuries); expect(state.injuryRisk).toBe(4); expect(state.mind).toBe(67);
    expect(state.demon.practice).toEqual({ body: 'NORMAL', flame: 'NONE' });
    expect(state.combat).toEqual(before.combat); expect(random.cursor).toBe(0);
  });

  it('keeps J29.575 bodyf, K6, R0 and fixed A−16.25 free of resource changes and hidden draws', () => {
    const state = fixture(3); state.spirituality = 0; state.progression.mastery[B] = 100;
    state.progression.mastery[H] = 500; const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, J, 0.8, undefined, random).selfGain).toBe(29.575 * 0.72 * 0.8);
    expect(resolve(state, K, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
    expect(resolve(state, R, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, A, 1, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });
});

describe('Demon current living encounter source and no-oracle boundary', () => {
  it('binds the current adult, his own club,2m, real exit, run, revision, week and round', () => {
    const state = fixture(), source = currentDemonCombatSource(state);
    expect(source).toMatchObject({ target: 'MORTON_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'MORTONS_OWN_ORDINARY_SHORT_CLUB',
      encounterId: 'DEMON_DISPUTE', distanceMetres: 2, bystanders: 'NONE', pursuit: false,
      qualifyingNearTermDeadlyPlan: false });
    for (const mutate of [
      (s: SliceState) => { s.runId += '-other'; }, (s: SliceState) => { s.revision += 1; },
      (s: SliceState) => { s.week += 1; s.demon.encounter.attemptWeek = s.week; },
      (s: SliceState) => nextRound(s),
    ]) {
      const changed = structuredClone(state); mutate(changed); const before = structuredClone(changed);
      for (const id of ids) expect(resolve(changed, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(changed).toEqual(before);
    }
  });

  it('refuses caller-invented deadly plans, targets, weapons or environmental properties', () => {
    const state = fixture(), source = currentDemonCombatSource(state)!;
    for (const patch of [{ qualifyingNearTermDeadlyPlan: true }, { target: 'UNKNOWN_ATTACKER' },
      { weapon: 'STOLEN_CLUB' }, { pursuit: true }, { bystanders: 'CROWD' }, { distanceMetres: 20 }]) {
      const altered = { ...source, ...patch } as unknown as DemonCombatSource;
      const before = structuredClone(state), random = fixedRolls();
      for (const id of ids) expect(resolve(state, id, 1, altered, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not borrow completed practice danger or max mastery as proof of a current deadly plan', () => {
    const state = fixture(); state.demon.threat = { active: true, noticed: true, verified: true, avoided: true };
    state.progression.mastery[R] = 500; const before = structuredClone(state), random = fixedRolls();
    expect(currentDemonCombatSource(state)!.qualifyingNearTermDeadlyPlan).toBe(false);
    const result = resolve(state, R, 1, undefined, random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('不符合本场预感来源'); expect(result.label).toContain('不能证明莫顿有杀意');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('rejects dead bodies, first-case borrowing, active practice, stale arrival and broken history before RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.health = Number.NaN; },
      (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.demon.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.demon.encounter.attemptWeek = null; },
      (s: SliceState) => { s.demon.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.demon.practice.body = 'ENLARGED'; },
      (s: SliceState) => { s.demon.practice.flame = 'LIT'; },
      (s: SliceState) => { s.demon.cases['loading-lane']!.contactOpen = true; },
      (s: SliceState) => { s.demon.cases['wide-door']!.status = 'PREPARED'; },
      (s: SliceState) => { s.demon.cases['loading-lane']!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentDemonCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });

  it('accepts an actually extinguished practice flame without re-igniting it', () => {
    const state = fixture(); state.demon.practice.flame = 'EXTINGUISHED';
    expect(currentDemonCombatSource(state)).not.toBeNull(); expect(resolve(state, H).selfGain).toBe(54.925 * 0.65);
    expect(state.demon.practice).toEqual({ body: 'NORMAL', flame: 'EXTINGUISHED' });
  });
});

describe('Demon shared complete rounds', () => {
  it('uses core35/30/15/20, tier650/cap130/floor65, max80 and continuation regeneration8', () => {
    const state = fixture(2); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(672);
    expect(state.spirituality).toBe(80); expect(state.demon.strain).toBe(2); vi.restoreAllMocks();
    const dry = fixture(3); dry.spirituality = 0; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8);
    expect(dry.spirituality).toBe(8); expect(dry.demon.strain).toBe(3); vi.restoreAllMocks();
    const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780); expect(cap.spirituality).toBe(80);
    vi.restoreAllMocks(); vi.spyOn(demonCombat, 'resolveDemonCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('spends in slot order, falls back at strain3 and keeps all three ordinary enemy actions', () => {
    const state = fixture(2); state.spirituality = 70;
    const practice = structuredClone(state.demon.practice);
    const draws = scriptRolls(100, 100, 1, 1, 226, 1, 1, 1, 326, 366, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[54.925 * 0.65, 0], [0, 10], [12, 0], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(665 + (54.925 * 0.65 + 12)); expect(round.enemyAdvantage).toBe(146);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.health).toBe(100);
    expect(state.spirituality).toBe(75); expect(state.demon.strain).toBe(3);
    expect(state.demon.practice).toEqual(practice); expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(12);
  });

  it('finishes a full paid H/B/H then ordinary H/B round without clearing strain on regeneration', () => {
    const state = fixture(); state.spirituality = 70;
    scriptRolls(100, 100, 1, 1, 226, 1, 1, 1, 1, 226, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(state.spirituality).toBe(70); expect(state.demon.strain).toBe(3);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[54.925 * 0.65, 0], [0, 50.7 * 0.65], [54.925 * 0.65, 0], [12, 0], [0, 10]]);
    expect(state.demon.practice.body).toBe('NORMAL'); expect(state.demon.practice.flame).toBe('NONE');
  });

  it('hard skin alone cannot wound the enemy and does not prevent an ordinary lost-round injury', () => {
    const state = fixture(); state.spirituality = 70;
    scriptRolls(1, 1, 181, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.spirituality).toBe(76); expect(state.demon.strain).toBe(1);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 50.7 * 0.65 });
    vi.restoreAllMocks(); const lost = fixture(); lost.spirituality = 70;
    scriptRolls(1, 1, 181, 1, 1_000_000, 1);
    expect(resolveSliceCombatRound(lost, 'DEFEND').outcome).toBe('CONTINUE');
    expect(lost.health).toBe(90); expect(lost.injuries).toHaveLength(1); expect(lost.demon.strain).toBe(1);
  });

  it('R alone has no premonition bonus, hidden RNG, injury threat or enemy-action suppression', () => {
    const state = fixture(); state.progression.mastery[R] = 500;
    const before = structuredClone(state.demon); const draws = scriptRolls(1, 100, 321, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(665); expect(round.enemyAdvantage).toBe(162);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.demon).toEqual(before); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('fixed negative A has no coin draw, strain change or injury threat', () => {
    const state = fixture(); const before = structuredClone(state.demon);
    const draws = scriptRolls(1, 1, 445, 400, 1); const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(665 - 16.25); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.demon).toEqual(before);
    expect(draws).toHaveBeenCalledTimes(5); expect(state.random.cursor).toBe(5);
  });

  it('final surrender and death keep costs, strain and shared injuries without final regeneration', () => {
    for (const [winner, severity, outcome] of [[1, 66, 'ENEMY_SURRENDERED'], [1, 100, 'ENEMY_DEAD'],
      [1_000_000, 100, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.spirituality = 70;
      scriptRolls(1, 1, 1, 1, winner, severity);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.spirituality).toBe(67); expect(state.demon.strain).toBe(1);
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(result.round.consequence).toContain('莫顿'); expect(result.round.consequence).toContain('自己的原普通短棍');
        expect(result.round.consequence).not.toContain('箱子'); expect(state.combat!.enemyStatus).toBe('SURRENDERED');
      } else if (outcome === 'PLAYER_DEAD') {
        expect(state.health).toBe(0); const dead = structuredClone(state);
        expect(resolve(state, B).enemyReduction).toBe(0); expect(state).toEqual(dead);
      } else expect(state.combat!.enemyHealth).toBe(0);
      vi.restoreAllMocks();
    }
  });

  it('real-exit retreat stops later actions with no chase, strain clearing or regeneration', () => {
    const state = fixture(3); state.spirituality = 61; const demon = structuredClone(state.demon);
    const draws = scriptRolls(100, 100, 1); const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(result.round.consequence).toContain('莫顿'); expect(state.demon).toEqual(demon);
    expect(state.spirituality).toBe(61); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays the same state exactly, including strain, normal body and random cursor', () => {
    const state = fixture(1); state.health = 85; const replay = structuredClone(state);
    expect(resolveSliceCombatRound(state, 'ATTACK')).toEqual(resolveSliceCombatRound(replay, 'ATTACK'));
    expect(state).toEqual(replay);
  });
});
