import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  ROSE_BISHOP_COUNT_WHEEL, currentRoseBishopCombatSource, drawRoseBishopAbility, isRoseBishop,
  resolveRoseBishopCombatAbility, roseBishopAbilityWheel, roseBishopActionCount,
  type RoseBishopCombatSource, type RoseBishopMoveId,
} from '../../src/domain/rose-bishop/combat.js';
import * as roseCombat from '../../src/domain/rose-bishop/combat.js';
import { SHADOW_ASCETIC_COUNT_WHEEL, resolveShadowAsceticCombatAbility, shadowAsceticAbilityWheel }
  from '../../src/domain/shadow-ascetic/combat.js';
import { LISTENER_COUNT_WHEEL, listenerAbilityWheel } from '../../src/domain/listener/combat.js';
import { SECRET_SUPPLICANT_COUNT_WHEEL, secretSupplicantAbilityWheel }
  from '../../src/domain/secret-supplicant/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'hanged-man.s6.flesh-shaping', J = 'BODY_FOLLOWUP', B = 'hanged-man.s6.self-renewal';
const K = 'hanged-man.s7.shadow-concealment', R = 'CHECK_RESERVE', A = 'ACCIDENT';
const ids = [H, J, B, K, R, A] as const;

/** Combat-only arrival. Growth tests cover buying and separately consuming actual rations. */
function fixture(points = 3): SliceState {
  const state = createSliceRun('rose-combat-test', sliceDefaultCreationSelection, 'rose-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hanged-man', sequence: 6, acting: 0, promotionWeek: 1,
    mastery: { [H]: 0, [B]: 0, [K]: 0, 'hanged-man.s9.secret-sense': 0,
      'hanged-man.s9.sacrificial-lore': 0, 'hanged-man.s9.ritual-practice': 0, 'hanged-man.s8.whisper-listening': 0 } };
  Object.assign(state.roseBishop.cases['ring-release']!, { status: 'RESOLVED', outcome: 'RING_VERIFIED', method: 'ORDINARY' });
  state.roseBishop.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length, attemptWeek: state.week };
  state.roseBishop.practice.shape = 'NORMAL';
  state.roseBishop.reserve = { points, max: 3, packetsBought: points, lastPurchaseWeek: points ? state.week : null,
    packets: Array.from({ length: points }, (_, index) => ({ id: `rose-bishop-ration-${index + 1}`,
      acquiredWeek: state.week, status: 'CONSUMED', consumedWeek: state.week })) };
  state.combat = { encounterId: 'ROSE_BISHOP_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-rose-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: RoseBishopMoveId, physical = 1,
  source: RoseBishopCombatSource | null = currentRoseBishopCombatSource(state), random = fixedRolls()) {
  return resolveRoseBishopCombatAbility(state, id, physical, random, source);
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

describe('Rose Bishop exact S6 candidate profile', () => {
  it('routes only hanged-man6 to its detached25/15/25/15/15/5 and10/15/25/30/20 wheels', () => {
    const state = fixture(); expect(isRoseBishop(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(roseBishopAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([25, 15, 25, 15, 15, 5]);
    expect(playerCountWheel(state)).toEqual(ROSE_BISHOP_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    state.progression.pathwayId = 'hermit'; expect(isRoseBishop(state)).toBe(false);
  });

  it('keeps each count and stance ticket boundary with exactly one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]]) {
      expect(roseBishopActionCount(roll!)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [25, 15, 25, 15, 15, 5].map((x, index) => x * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, x) => sum + x, 0); let boundary = 0;
      roseBishopAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawRoseBishopAbility(random, stance)).toBe(ids[index]);
        expect(drawRoseBishopAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('retains original S9–S7 wheels and S7 ordinary budgets and accident coin', () => {
    const state = fixture();
    for (const [sequence, count, wheel] of [
      [9, SECRET_SUPPLICANT_COUNT_WHEEL, secretSupplicantAbilityWheel],
      [8, LISTENER_COUNT_WHEEL, listenerAbilityWheel], [7, SHADOW_ASCETIC_COUNT_WHEEL, shadowAsceticAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence; expect(isRoseBishop(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count); expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentRoseBishopCombatSource(state)).toBeNull();
    }
    state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(resolveShadowAsceticCombatAbility(state, 'BODY_STRIKE', 1, fixedRolls()).selfGain).toBe(12);
    expect(resolveShadowAsceticCombatAbility(state, J, 1, fixedRolls()).selfGain).toBe(8.4);
    const random = fixedRolls(2);
    expect(resolveShadowAsceticCombatAbility(state, A, 1, random).selfGain).toBe(11.25); expect(random.cursor).toBe(1);
  });
});

describe('Rose Bishop finite own-body costs and fallback', () => {
  it('pays H2S1reserve immediately, using only flesh-shaping mastery and current body', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.progression.mastery[H] = mastery; state.progression.mastery[B] = 500;
      const packets = structuredClone(state.roseBishop.reserve.packets), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, random)).toMatchObject({
        selfGain: 50.7 * (0.65 + 0.35 * mastery / 500) * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(state.spirituality).toBe(78); expect(state.roseBishop.reserve.points).toBe(2);
      expect(state.roseBishop.reserve.packets).toEqual(packets); expect(random.cursor).toBe(0);
    }
  });

  it('prioritizes an actually held town club, preserving both resources and replacing only H', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[H] = 500;
    const before = structuredClone(state);
    expect(resolve(state, H, 0.8)).toMatchObject({ selfGain: 16 * 0.8, enemyReduction: 0, threatens: true });
    expect(resolve(state, J, 0.8).selfGain).toBe(27.3 * 0.8);
    expect(playerAbilityWheel(state, null)[0]!.label).toContain('保留血肉储备'); expect(state).toEqual(before);
    state.town.clubLocation = 'BAG';
    expect(resolve(state, H).selfGain).toBe(50.7); expect(state.roseBishop.reserve.points).toBe(2);
  });

  it('falls back ordinarily without partial spending when spirituality or actual reserve is missing', () => {
    for (const [points, spirituality] of [[0, 80], [1, 1], [0, 0]]) {
      const state = fixture(points); state.spirituality = spirituality!; state.health = 80;
      const before = structuredClone(state);
      expect(resolve(state, H, 0.8).selfGain).toBe(12 * 0.8);
      expect(resolve(state, B, 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 10 * 0.8, threatens: false });
      expect(state).toEqual(before);
    }
    const state = fixture(1); state.spirituality = 2; state.health = 90;
    expect(resolve(state, B).enemyReduction).toBe(10); expect(state.spirituality).toBe(2);
    expect(resolve(state, H).selfGain).toBe(50.7 * 0.65); expect(state.spirituality).toBe(0);
    expect(state.roseBishop.reserve.points).toBe(0); expect(resolve(state, H).selfGain).toBe(12);
  });

  it('never treats held food or malformed reserve as already available flesh', () => {
    for (const mutate of [
      (s: SliceState) => { s.roseBishop.reserve.packets[0]!.status = 'HELD'; s.roseBishop.reserve.packets[0]!.consumedWeek = null; },
      (s: SliceState) => { s.roseBishop.reserve.points = 4; },
      (s: SliceState) => { s.roseBishop.reserve.points = 0.5; },
      (s: SliceState) => { s.roseBishop.reserve.packets = []; },
      (s: SliceState) => { s.roseBishop.reserve.packets[0]!.consumedWeek = s.week + 1; },
      (s: SliceState) => { s.roseBishop.reserve.packets[0]!.id = ''; },
    ]) {
      const state = fixture(1); mutate(state); const before = structuredClone(state);
      expect(resolve(state, H).selfGain).toBe(12); expect(state).toEqual(before);
    }
  });

  it('heals only the living injured self at3S1reserve with gain8 and preserves injuries, risk and mind', () => {
    const state = fixture(); state.health = 95; state.mind = 67; state.injuryRisk = 4;
    state.injuries.push({ id: 'prior-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(state.health).toBe(100); expect(state.spirituality).toBe(77); expect(state.roseBishop.reserve.points).toBe(2);
    expect(state.injuries).toEqual(before.injuries); expect(state.injuryRisk).toBe(4); expect(state.mind).toBe(67);
    expect(state.combat).toEqual(before.combat); expect(random.cursor).toBe(0);
    const full = structuredClone(state);
    expect(resolve(state, B).enemyReduction).toBe(10); expect(state).toEqual(full);
    state.health = 20;
    expect(resolve(state, B).selfGain).toBe(8); expect(state.health).toBe(30);
  });

  it('keeps J27.3f, daylight K6, R0 and fixed A−16.25 free of hidden draws or stock changes', () => {
    const state = fixture(0); state.spirituality = 0; state.progression.mastery[H] = 100;
    state.progression.mastery[K] = 500; const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, J, 0.8, undefined, random).selfGain).toBe(27.3 * 0.72 * 0.8);
    expect(resolve(state, K, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
    expect(resolve(state, R, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, A, 1, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });
});

describe('Rose Bishop current living encounter source', () => {
  it('binds the actual adult, own club, daylight, real exit, run, revision, week and round', () => {
    const state = fixture(), source = currentRoseBishopCombatSource(state);
    expect(source).toMatchObject({ target: 'WAYNE_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'WAYNES_OWN_ORDINARY_SHORT_CLUB',
      encounterId: 'ROSE_BISHOP_DISPUTE', distanceMetres: 2, daylight: true, usableConcealmentShade: false,
      bystanders: 'NONE', pursuit: false });
    for (const mutate of [
      (s: SliceState) => { s.runId += '-other'; }, (s: SliceState) => { s.revision += 1; },
      (s: SliceState) => { s.week += 1; s.roseBishop.encounter.attemptWeek = s.week; },
      (s: SliceState) => nextRound(s),
    ]) {
      const changed = structuredClone(state); mutate(changed); const before = structuredClone(changed);
      for (const id of ids) expect(resolve(changed, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(changed).toEqual(before);
    }
  });

  it('rejects dead bodies, first-case borrowing, altered practice, stale arrival and broken history before costs or RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.health = Number.NaN; },
      (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.roseBishop.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.roseBishop.encounter.attemptWeek = null; },
      (s: SliceState) => { s.roseBishop.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.roseBishop.practice.shape = 'SLIM_HAND'; },
      (s: SliceState) => { s.roseBishop.practice.shape = 'SUPPORT_PALM'; },
      (s: SliceState) => { s.roseBishop.cases['ring-release']!.contactOpen = true; },
      (s: SliceState) => { s.roseBishop.cases['steady-grip']!.status = 'PREPARED'; },
      (s: SliceState) => { s.roseBishop.cases['ring-release']!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentRoseBishopCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });
});

describe('Rose Bishop shared complete rounds', () => {
  it('uses core50/20/20/10, tier650/cap130/floor65, max80 and only continuation regeneration8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72; scriptRolls(1, 1, 361, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(669);
    expect(state.spirituality).toBe(80); expect(state.roseBishop.reserve.points).toBe(3); vi.restoreAllMocks();
    const dry = fixture(0); dry.spirituality = 0; scriptRolls(1, 1, 361, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8);
    expect(dry.spirituality).toBe(8); expect(dry.roseBishop.reserve.points).toBe(0); vi.restoreAllMocks();
    const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(1, 1, 361, 400, 1);
    expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780); expect(cap.spirituality).toBe(80);
    vi.restoreAllMocks(); vi.spyOn(roseCombat, 'resolveRoseBishopCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 361, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('spends in slot order, falls back after depletion and retains all three ordinary enemy actions', () => {
    const state = fixture(2); state.spirituality = 70; state.health = 90;
    const packets = structuredClone(state.roseBishop.reserve.packets);
    const draws = scriptRolls(100, 100, 1, 1, 201, 1, 1, 1, 301, 361, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[50.7 * 0.65, 0], [8, 0], [12, 0], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(665 + (50.7 * 0.65 + 8 + 12)); expect(round.enemyAdvantage).toBe(156);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.health).toBe(100);
    expect(state.spirituality).toBe(73); expect(state.roseBishop.reserve.points).toBe(0);
    expect(state.roseBishop.reserve.packets).toEqual(packets); expect(draws).toHaveBeenCalledTimes(12);
    expect(state.random.cursor).toBe(12);
  });

  it('self-renewal alone gives no enemy wound or suppression and does not erase existing injuries', () => {
    const state = fixture(1); state.health = 80; state.spirituality = 70; state.injuryRisk = 2;
    state.injuries.push({ id: 'old-light', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const wounds = structuredClone(state.injuries); scriptRolls(1, 1, 161, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(75);
    expect(state.combat!.enemyHealth).toBe(100); expect(round.consequenceWeights).toBeNull();
    expect(round.moves[0]).toMatchObject({ selfGain: 8, enemyReduction: 0 });
    expect(round.enemyCount).toBe(1); expect(state.injuries).toEqual(wounds); expect(state.injuryRisk).toBe(2);
  });

  it('fixed negative A has no coin draw and no injury threat', () => {
    const state = fixture(); const before = structuredClone(state.roseBishop);
    const draws = scriptRolls(1, 1, 440, 400, 1); const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(665 - 16.25); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.roseBishop).toEqual(before);
    expect(draws).toHaveBeenCalledTimes(5); expect(state.random.cursor).toBe(5);
  });

  it('final surrender and death use shared consequences without refunds or final regeneration', () => {
    for (const [winner, severity, outcome] of [[1, 66, 'ENEMY_SURRENDERED'], [1, 100, 'ENEMY_DEAD'],
      [1_000_000, 100, 'PLAYER_DEAD']] as const) {
      const state = fixture(1); state.spirituality = 70;
      scriptRolls(1, 1, 1, 1, winner, severity);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.spirituality).toBe(68); expect(state.roseBishop.reserve.points).toBe(0);
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(result.round.consequence).toContain('维恩'); expect(result.round.consequence).toContain('自己的原普通短棍');
        expect(result.round.consequence).not.toContain('箱子'); expect(state.combat!.enemyStatus).toBe('SURRENDERED');
      } else if (outcome === 'PLAYER_DEAD') {
        expect(state.health).toBe(0); const dead = structuredClone(state);
        expect(resolve(state, B).selfGain).toBe(0); expect(state).toEqual(dead);
      } else expect(state.combat!.enemyHealth).toBe(0);
      vi.restoreAllMocks();
    }
  });

  it('real-exit retreat ends enemy actions with no chase, reserve change or regeneration', () => {
    const state = fixture(2); state.spirituality = 61; const reserve = structuredClone(state.roseBishop.reserve);
    const draws = scriptRolls(100, 100, 1); const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(result.round.consequence).toContain('维恩'); expect(state.roseBishop.reserve).toEqual(reserve);
    expect(state.spirituality).toBe(61); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays the same state exactly, including reserve depletion, healing and random cursor', () => {
    const state = fixture(2); state.health = 85; const replay = structuredClone(state);
    expect(resolveSliceCombatRound(state, 'ATTACK')).toEqual(resolveSliceCombatRound(replay, 'ATTACK'));
    expect(state).toEqual(replay);
  });
});
