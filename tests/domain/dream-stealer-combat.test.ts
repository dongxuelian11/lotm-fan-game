import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ordinaryAbilityWheel, ORDINARY_COUNT_WHEEL, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createDreamStealerState } from '../../src/domain/dream-stealer/index.js';
import { DREAM_STEALER_ABILITY_IDS } from '../../src/domain/dream-stealer/types.js';
import {
  DREAM_STEALER_COUNT_WHEEL, consumeDreamStealerEnemyIntent, createDreamStealerRoundContext,
  currentDreamStealerCombatSource, decideDreamStealerEnemyIntent, drawDreamStealerAbility,
  dreamStealerAbilityWheel, dreamStealerActionCount, finishDreamStealerCombatRound, isDreamStealer,
  resolveDreamStealerCombatAbility, type DreamStealerCombatSource, type DreamStealerMoveId,
  type DreamStealerOrdinaryIntent, type DreamStealerRoundContext,
} from '../../src/domain/dream-stealer/combat.js';
import * as dreamStealerCombat from '../../src/domain/dream-stealer/combat.js';
import { applyDreamStealerEncounter, blockDreamStealerEncounter, hasDreamStealerDisputeOpponent,
  hasDreamStealerOpenPractice, settleDreamStealerEncounter, validateDreamStealerEncounter } from '../../src/domain/dream-stealer/encounter.js';
import { FIRE_THIEF_COUNT_WHEEL, fireThiefAbilityWheel } from '../../src/domain/fire-thief/combat.js';
import { CRYPTOLOGIST_COUNT_WHEEL, cryptologistAbilityWheel } from '../../src/domain/cryptologist/combat.js';
import { SWINDLER_COUNT_WHEEL, swindlerAbilityWheel } from '../../src/domain/swindler/combat.js';
import { MARAUDER_COUNT_WHEEL, marauderAbilityWheel } from '../../src/domain/marauder/combat.js';
import { GATEKEEPER_COUNT_WHEEL } from '../../src/domain/gatekeeper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const K = 'error.s5.thought-theft';
/** Bounded fixtures exercise branches; they are not natural promotion/playthrough evidence. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('dream-stealer-combat-test', sliceDefaultCreationSelection, 'dream-stealer-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'error', sequence: 5, mastery: { [K]: 0 }, acting: 25, promotionWeek: 22 };
  s.dreamStealer = createDreamStealerState(); s.dreamStealer.promotionWeek = 22;
  Object.assign(s.dreamStealer.cases['announced-seat']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'SEAT_CHECKED' });
  s.dreamStealer.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'DREAM_STEALER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
const profile: readonly [DreamStealerMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['BLOCK', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], ['OBSERVE', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: DreamStealerMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-dream-stealer', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index);
    return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function pending(s: SliceState, id: DreamStealerOrdinaryIntent = 'STRIKE'): DreamStealerRoundContext {
  const round = createDreamStealerRoundContext(s); decideDreamStealerEnemyIntent(s, round, id); return round;
}
function effect(s: SliceState, id: DreamStealerMoveId, round = createDreamStealerRoundContext(s), random = fixedRolls(),
  physical = 1, source: DreamStealerCombatSource | null = currentDreamStealerCombatSource(s)) {
  return resolveDreamStealerCombatAbility(s, id, physical, random, round, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.dreamStealer.encounter = createDreamStealerState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Dream Stealer S5 profile and ordinary source', () => {
  it('routes the sole new ability, H30/J15/B20/K20/R10/A5 and standard1–6 counts', () => {
    const s = fixture(); expect(isDreamStealer(s)).toBe(true); expect(DREAM_STEALER_ABILITY_IDS).toEqual([K]);
    expect(playerAbilityWheel(s, null)).toEqual(dreamStealerAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(DREAM_STEALER_COUNT_WHEEL);
    expect(DREAM_STEALER_COUNT_WHEEL).toBe(GATEKEEPER_COUNT_WHEEL);
    expect(DREAM_STEALER_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(dreamStealerActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null), counts = playerCountWheel(s); wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(10);
  });

  it('uses exact stance tickets and fixed A−22.5 without another random draw', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      dreamStealerAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!; const random = fixedRolls(first, boundary);
        expect(drawDreamStealerAbility(random, s, stance)).toBe(entry.id);
        expect(drawDreamStealerAbility(random, s, stance)).toBe(entry.id); expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', undefined, random)).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('preserves existing Error S9–6 profiles and their count wheels', () => {
    const s = fixture(true);
    for (const [sequence, wheel, counts] of [
      [9, marauderAbilityWheel, MARAUDER_COUNT_WHEEL], [8, swindlerAbilityWheel, SWINDLER_COUNT_WHEEL],
      [7, cryptologistAbilityWheel, CRYPTOLOGIST_COUNT_WHEEL], [6, fireThiefAbilityWheel, FIRE_THIEF_COUNT_WHEEL],
    ] as const) {
      s.progression.sequence = sequence; expect(isDreamStealer(s)).toBe(false); expect(currentDreamStealerCombatSource(s)).toBeNull();
      expect(playerAbilityWheel(s, null)).toEqual(wheel(null, s)); expect(playerCountWheel(s)).toEqual(counts);
    }
  });

  it('uses900/core35-25-25-15/floor90/S100 and continuing regeneration10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, 400, ticket('OBSERVE', 'PREPARE'), 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(result.round.enemyAdvantage).toBe(114); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, 400, ticket('OBSERVE', 'PREPARE'), 1); expect(ceiling.spirituality).toBe(100);
    vi.spyOn(dreamStealerCombat, 'resolveDreamStealerCombatAbility').mockReturnValue({ label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, 400, ticket('OBSERVE', 'PREPARE'), 1).round.playerAdvantage).toBe(90);
  });

  it('binds the current original adult,body,tool,scene,week,revision and contiguous history', () => {
    const s = fixture(), source = currentDreamStealerCombatSource(s)!;
    expect(source).toMatchObject({ target: 'MARLOW_SINGLE_ADULT', nature: 'ORDINARY_ADULT_HUMAN',
      weapon: 'MARLOW_ORIGINAL_CLUB', weaponLocation: 'HAND', distanceMetres: 2, pursuit: false, startHistoryIndex: 0, attemptWeek: 24 });
    for (const key of Object.keys(source) as (keyof DreamStealerCombatSource)[]) {
      const bad = { ...source, [key]: typeof source[key] === 'number' ? Number(source[key]) + 1 : 'OTHER' } as DreamStealerCombatSource;
      const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, K, pending(s), random, 1, bad)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects stale arrival, invalid bodies and actual open practice before any round draw', () => {
    for (const mutate of [
      (s: SliceState) => { s.dreamStealer.encounter.attemptWeek = 23; },
      (s: SliceState) => { s.dreamStealer.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { s.dreamStealer.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.combat!.round = 2; }, (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.world.city = 'TINGEN'; },
      (s: SliceState) => { s.dreamStealer.practice.playerPose = 'SEATED'; },
      (s: SliceState) => { s.dreamStealer.practice.targetPaused = true; },
      (s: SliceState) => { s.dreamStealer.practice.token = 'TARGET_HAND'; },
      (s: SliceState) => { s.dreamStealer.cases['intended-reach']!.contactOpen = true; },
      (s: SliceState) => { s.fireThief.cases['borrowed-flash']!.contactOpen = true; },
      (s: SliceState) => { s.fireThief.loan.targetSteps = 1; },
    ]) {
      const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(currentDreamStealerCombatSource(s)).toBeNull(); expect(effect(s, K).selfGain).toBe(0);
      expect(() => resolveSliceCombatRound(s, 'CONTROL')).toThrow(); expect(s).toEqual(before);
    }
  });

  it('retains the FIRST_CASE original carrier and never imports Marlow or his club', () => {
    const s = fixture(true), world = structuredClone(s.world);
    expect(currentDreamStealerCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null });
    const result = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 1, 1, 70);
    expect(result.round.consequence).toContain('携铃者'); expect(result.round.consequence).not.toMatch(/马洛|贝林|私人庭院/);
    expect(result.round.moves[0]!.selfGain).toBeCloseTo(12 * 0.65); expect(s.world).toEqual(world);
    const dead = fixture(true); dead.world.carrierAlive = false;
    expect(currentDreamStealerCombatSource(dead)).toBeNull(); expect(effect(dead, K).selfGain).toBe(0);
    expect(currentDreamStealerCombatSource(fixture())?.target).toBe('MARLOW_SINGLE_ADULT');
  });
});

describe('One real pending ordinary intention, immediate own action and recovery', () => {
  it('successful knowledge14 theft spends3 and executes the own-body strike immediately in K', () => {
    for (const learned of [0, 250, 500]) {
      const s = fixture(); s.progression.mastery[K] = learned; s.progression.mastery['error.s6.power-theft'] = 500;
      const round = pending(s), before = structuredClone(s), random = fixedRolls(52), factor = 0.65 + 0.35 * learned / 500;
      const result = effect(s, K, round, random, 0.8);
      expect(result).toMatchObject({ enemyReduction: 0, threatens: true }); expect(result.selfGain).toBeCloseTo(12 * 0.8 * factor);
      expect(result.label).toContain('知识难度14'); expect(result.label).toContain('同一个K行动立即执行');
      expect(result.label).toContain('原短棍没有来到手中'); expect(s.spirituality).toBe(97); expect(random.cursor).toBe(1);
      expect(round.pending).toEqual({ id: 'STRIKE', stolen: true });
      expect({ ...s, spirituality: before.spirituality }).toEqual(before);
    }
  });

  it('uses only the actual own held club, not bagged tools, enemy clubs or old Simon custody', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const s = fixture(); s.town.clubLocation = location;
      Object.assign(s.marauder.dispute.weapon, { custodian: 'PLAYER', location: 'PLAYER_HAND' });
      const before = structuredClone(s.marauder), random = fixedRolls(1);
      expect(effect(s, K, pending(s), random).selfGain).toBeCloseTo((location === 'HAND' ? 16 : 12) * 0.65);
      expect(s.town.clubLocation).toBe(location); expect(s.marauder).toEqual(before);
      for (const id of ['STRIKE', 'SECONDARY_STRIKE'] as const) {
        expect(effect(s, id, undefined, fixedRolls(), 0.5).selfGain).toBe(location === 'HAND' ? 8 : 6);
      }
    }
  });

  it('immediately performs corresponding ordinary guard,opening or distance without granting injury', () => {
    for (const [id, gain, reduction] of [['BLOCK', 0, 10], ['OPENING', 8, 0], ['DISTANCE', 0, 8]] as const) {
      const s = fixture(), round = pending(s, id), random = fixedRolls(1);
      const result = effect(s, K, round, random);
      expect(result.selfGain).toBeCloseTo(gain * 0.65); expect(result.enemyReduction).toBeCloseTo(reduction * 0.65);
      expect(result.threatens).toBe(false); expect(round.pending?.stolen).toBe(true); expect(random.cursor).toBe(1);
    }
  });

  it('failed knowledge check spends3 but leaves the same current original decision executable', () => {
    const s = fixture(), round = pending(s), random = fixedRolls(53);
    expect(effect(s, K, round, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(round.pending).toEqual({ id: 'STRIKE', stolen: false }); expect(s.spirituality).toBe(97);
    expect(consumeDreamStealerEnemyIntent(s, round)).toEqual({ id: 'STRIKE', stolen: false });
    expect(round.pending).toBeNull(); expect(random.cursor).toBe(1);
  });

  it('no pending intent,MISS,already-stolen or insufficient S never pays or draws a check', () => {
    for (const mode of ['NONE', 'MISS', 'STOLEN', 'NO_S', 'NAN_S'] as const) {
      const s = fixture(), round = mode === 'NONE' ? createDreamStealerRoundContext(s) : pending(s, mode === 'MISS' ? 'MISS' : 'STRIKE');
      if (mode === 'STOLEN') effect(s, K, round, fixedRolls(1));
      if (mode === 'NO_S') s.spirituality = 2;
      if (mode === 'NAN_S') s.spirituality = Number.NaN;
      const before = structuredClone(s), oldRound = structuredClone(round), random = fixedRolls();
      expect(effect(s, K, round, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(round).toEqual(oldRound); expect(random.cursor).toBe(0);
    }
  });

  it('never precomputes a second decision or steals again until current slot is consumed', () => {
    const s = fixture(), round = pending(s, 'BLOCK');
    expect(() => decideDreamStealerEnemyIntent(s, round, 'STRIKE')).toThrow();
    effect(s, K, round, fixedRolls(1)); expect(effect(s, K, round).enemyReduction).toBe(0);
    expect(consumeDreamStealerEnemyIntent(s, round)).toEqual({ id: 'BLOCK', stolen: true });
    expect(() => consumeDreamStealerEnemyIntent(s, round)).toThrow();
    decideDreamStealerEnemyIntent(s, round, 'STRIKE'); expect(round.pending).toEqual({ id: 'STRIKE', stolen: false });
    expect(round).toMatchObject({ decisions: 2, consumed: 1 });
    finishDreamStealerCombatRound(round); expect(round).toMatchObject({ pending: null, finished: true });
    expect(() => decideDreamStealerEnemyIntent(s, round, 'STRIKE')).toThrow();
    expect(effect(s, K, round).selfGain).toBe(0);
  });

  it('binds resolver-local intentions to the original source and refuses old round/tool snapshots', () => {
    for (const mutate of [
      (s: SliceState) => { s.revision += 1; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; },
      (s: SliceState) => { s.health -= 1; }, (s: SliceState) => { s.combat!.enemyMind -= 1; },
    ]) {
      const s = fixture(), round = pending(s); mutate(s); const before = structuredClone(s);
      expect(effect(s, K, round)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(() => consumeDreamStealerEnemyIntent(s, round)).toThrow(); expect(s).toEqual(before);
    }
  });

  it('R only observes honest ordinary facts and preserves all prior power-theft history', () => {
    const s = fixture(), before = structuredClone(s), random = fixedRolls();
    const result = effect(s, 'OBSERVE', pending(s), random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('没有可供盗火人能力窃取的非凡能力'); expect(s).toEqual(before); expect(random.cursor).toBe(0);
    for (const id of ['error.s6.power-theft', 'error.s5.dream-theft', 'error.s4.parasitism', 'error.s4.stored-intention']) {
      expect(effect(s, id as DreamStealerMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(effect(s, 'BLOCK')).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false }); expect(s).toEqual(before);
  });
});

describe('Production round intent planning bridge', () => {
  it('draws one decision before the first player action, executes K in that slot, and skips only that enemy slot', () => {
    const s = fixture(), old = structuredClone(s.fireThief); s.spirituality = 30;
    const result = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 1, 1, 70);
    expect(result.round.moves).toHaveLength(2); expect(result.round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY']);
    expect(result.round.moves[0]!.selfGain).toBeCloseTo(7.8); expect(result.round.moves[1]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(result.round.moves[1]!.label).toContain('本次原敌槽贡献0'); expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(s.spirituality).toBe(27); expect(s.fireThief).toEqual(old); expect(s.combat).not.toHaveProperty('pendingIntent');
    expect(s.dreamStealer.encounter).not.toHaveProperty('battleLoan'); expect(s.random.cursor).toBe(7);
  });

  it('forms the second decision only after consuming the first and does not cancel it', () => {
    const s = fixture();
    // Actual order: two counts, original STRIKE decision, K draw/check,
    // first enemy consumed, next BLOCK decision, R draw, final win draw.
    const result = recordedRound(s, 'CONTROL', 11, 46, 1, ticket(K, 'CONTROL'), 1, 161, ticket('OBSERVE', 'CONTROL'), 1_000_000);
    const enemy = result.round.moves.filter(m => m.actor === 'ENEMY');
    expect(enemy).toHaveLength(2); expect(enemy[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(enemy[1]).toMatchObject({ label: '格挡护身', selfGain: 0, enemyReduction: 10 });
    expect(result.round.moves.filter(m => m.actor === 'PLAYER')).toHaveLength(2);
    expect(s.random.cursor).toBe(8); expect(result.outcome).toBe('CONTINUE');
  });

  it('after the only enemy action there is no target for later K and no check is drawn', () => {
    const s = fixture(); s.spirituality = 20;
    const result = recordedRound(s, 'CONTROL', 11, 1, 400, ticket('OBSERVE', 'CONTROL'), ticket(K, 'CONTROL'), 1);
    expect(result.round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(result.round.moves[2]!.label).toContain('没有可窃取的待执行普通念头'); expect(s.spirituality).toBe(30);
    expect(result.round.moves[2]).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s.random.cursor).toBe(6);
  });

  it('failed K leaves Marlow ordinary STRIKE16, R has zero cost, and enemy counts stay1–3', () => {
    const failed = fixture(); failed.spirituality = 30;
    const result = recordedRound(failed, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 100, 1);
    expect(result.round.moves[1]).toMatchObject({ label: '短棍打击', selfGain: 16, enemyReduction: 0 }); expect(failed.spirituality).toBe(37);
    expect(ORDINARY_COUNT_WHEEL.map(e => e.weight)).toEqual([45, 40, 15]);
    expect(ordinaryAbilityWheel(true, null).map(e => e.weight)).toEqual([40, 20, 20, 15, 5]);
    for (const [roll, count] of [[1, 1], [45, 1], [46, 2], [85, 2], [86, 3], [100, 3]]) {
      const s = fixture(); s.spirituality = 20;
      const r = recordedRound(s, 'PREPARE', 1, roll!, 1, ticket('OBSERVE', 'PREPARE'), ...Array<number>(count! - 1).fill(1), 1);
      expect(r.round.enemyCount).toBe(count); expect(r.round.moves.filter(m => m.actor === 'ENEMY').map(m => m.selfGain)).toEqual(Array(count).fill(16));
      expect(s.spirituality).toBe(30); expect(s.fireThief.encounter.enemyCourageSeen).toBe(false);
    }
  });

  it('even rounds expose only the next actual decision after the enemy first acts', () => {
    const s = fixture();
    recordedRound(s, 'PREPARE', 1, 1, 400, ticket('OBSERVE', 'PREPARE'), 1);
    const r = recordedRound(s, 'CONTROL', 1, 46, 161, 1, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(r.round.first).toBe('ENEMY'); expect(r.round.moves.map(m => m.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY']);
    expect(r.round.moves[0]).toMatchObject({ label: '格挡护身', enemyReduction: 10 });
    expect(r.round.moves[1]!.selfGain).toBeCloseTo(7.8); expect(r.round.moves[2]!.selfGain).toBe(0);
    expect(r.round.moves[2]!.label).toContain('本次原敌槽贡献0');
  });

  it('leaves ordinary and older Error round random ordering at their original draw point', () => {
    const ordinary = fixture(true); ordinary.progression = { pathwayId: null, sequence: null, mastery: {}, acting: 0, promotionWeek: null };
    const first = recordedRound(ordinary, 'PREPARE', 1, 1, 400, 1, 1);
    expect(first.round.moves.map(m => [m.actor, m.selfGain])).toEqual([['PLAYER', 0], ['ENEMY', 16]]);
    for (const sequence of [7, 8, 9]) {
      const s = fixture(true); s.progression.sequence = sequence;
      // Existing player first STRIKE draw remains third; enemy MISS remains fourth.
      const old = recordedRound(s, 'ATTACK', 1, 1, 1, 400, 1, 1);
      expect(old.round.moves[0]!.actor).toBe('PLAYER'); expect(old.round.moves[0]!.selfGain).toBeGreaterThan(0);
      expect(old.round.moves[1]).toMatchObject({ actor: 'ENEMY', label: '动作落空', selfGain: 0 }); expect(s.random.cursor).toBe(6);
    }
  });
});

describe('Marlow actual arrival, endings and one-time reward', () => {
  it('requires one closed report and actual cleanup, while consent preparation alone is not inside', () => {
    for (const mutate of [
      (s: SliceState) => { s.dreamStealer.cases['announced-seat']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.dreamStealer.cases['announced-seat']!.closes = 0; },
      (s: SliceState) => { s.dreamStealer.cases['intended-reach']!.contactOpen = true; },
      (s: SliceState) => { s.dreamStealer.practice.playerPose = 'REACHING'; },
      (s: SliceState) => { s.dreamStealer.practice.targetPaused = true; },
      (s: SliceState) => { s.dreamStealer.practice.token = 'TARGET_HAND'; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyDreamStealerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = available(); s.dreamStealer.cases['intended-reach']!.status = 'PREPARED'; const old = structuredClone(s.fireThief);
    expect(hasDreamStealerOpenPractice(s)).toBe(false); applyDreamStealerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasDreamStealerDisputeOpponent(s)).toBe(true); expect(s.fireThief).toEqual(old);
    expect(Object.keys(s.dreamStealer.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
  });

  it('preserves ordinary refusal and peaceful consent without extra rewards', () => {
    const refused = available(); applyDreamStealerEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.dreamStealer.encounter.status).toBe('AVAILABLE');
    expect(blockDreamStealerEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateDreamStealerEncounter(refused)).toBe(true);
    applyDreamStealerEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context()); expect(refused.actionsRemaining).toBe(2);
    const talk = available(), progression = structuredClone(talk.progression);
    applyDreamStealerEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.dreamStealer.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateDreamStealerEncounter(talk)).toBe(true);
  });

  it('real surrender/death gives one25 for actual contribution and preserves original custody', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context(), old = structuredClone(s.fireThief), practice = structuredClone(s.dreamStealer.practice), world = structuredClone(s.world);
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx)); s.spirituality = 30;
      const result = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 1, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('马洛'); expect(result.round.consequence).not.toMatch(/携铃者|贝林|箱子投降|凯恩|洛克/);
      expect(result.round.consequence).toContain('原私人庭院'); expect(s.spirituality).toBe(27);
      settleDreamStealerEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('dream-stealer-dispute', 25); expect(s.dreamStealer.encounter.status).toBe('RESOLVED');
      expect(validateDreamStealerEncounter(s)).toBe(true); expect(s.progression.acting).toBe(25);
      expect(s.fireThief).toEqual(old); expect(s.dreamStealer.practice).toEqual(practice); expect(s.world).toEqual(world);
      expect(() => settleDreamStealerEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('first-slot retreat costs no spiritual power,reward or future action draw', () => {
    const s = fixture(), reward = vi.fn(); s.spirituality = 98;
    // Two counts, one actual present decision, ordinary retreat. No other enemy plans.
    const result = recordedRound(s, 'RETREAT', 91, 100, 1, 1);
    expect(result.round.moves).toHaveLength(0); expect(result.round.consequence).toContain('马洛');
    expect(result.round.consequence).toContain('实际原出口'); expect(s.spirituality).toBe(98); expect(s.random.cursor).toBe(4);
    settleDreamStealerEncounter(s, result.outcome, context(), reward); expect(reward).not.toHaveBeenCalled();
    expect(validateDreamStealerEncounter(s)).toBe(true);
  });

  it('player death and health-zero stay in the original scene, with no reward or regeneration', () => {
    const s = fixture(), reward = vi.fn(); s.spirituality = 20;
    const r = recordedRound(s, 'PREPARE', 1, 1, 1, ticket('OBSERVE', 'PREPARE'), 1_000_000, 100);
    expect(r.outcome).toBe('PLAYER_DEAD'); expect(r.round.consequence).toContain('马洛'); expect(s.spirituality).toBe(20);
    settleDreamStealerEncounter(s, r.outcome, context(), reward); s.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(validateDreamStealerEncounter(s)).toBe(true);
    const low = fixture(); low.combat!.enemyHealth = 10;
    const terminal = recordedRound(low, 'ATTACK', 1, 1, 400, ticket('STRIKE', 'ATTACK'), 1, 1);
    expect(terminal.outcome).toBe('ENEMY_DEAD'); expect(terminal.round.consequence).toContain('原私人庭院健康降至0');
    expect(terminal.round.consequence).toContain('马洛'); expect(terminal.round.consequence).not.toContain('携铃者');
  });

  it('rejects invented terminal results and duplicate/unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), reward = vi.fn();
    expect(() => settleDreamStealerEncounter(s, 'ENEMY_SURRENDERED', context(), reward)).toThrow();
    expect(() => settleDreamStealerEncounter(s, 'INVENTED', context(), reward)).toThrow(); expect(s).toEqual(before);
    expect(reward).not.toHaveBeenCalled();
    const bad = fixture(); bad.seer.completedSources.push('dream-stealer-dispute'); expect(validateDreamStealerEncounter(bad)).toBe(false);
    const duplicate = fixture(); duplicate.seer.completedSources.push('dream-stealer-dispute', 'dream-stealer-dispute'); expect(validateDreamStealerEncounter(duplicate)).toBe(false);
  });
});
