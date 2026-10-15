import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createDesireApostleState } from '../../src/domain/desire-apostle/index.js';
import {
  DESIRE_APOSTLE_COUNT_WHEEL, consumeDesireApostleStagger, currentDesireApostleCombatSource,
  desireApostleAbilityWheel, desireApostleActionCount, drawDesireApostleAbility, finishDesireApostleCombatRound,
  isDesireApostle, observeDesireApostleEnemyOpening, resolveDesireApostleCombatAbility,
  type DesireApostleCombatSource, type DesireApostleMoveId,
} from '../../src/domain/desire-apostle/combat.js';
import * as desireCombat from '../../src/domain/desire-apostle/combat.js';
import {
  applyDesireApostleEncounter, blockDesireApostleEncounter, settleDesireApostleEncounter,
  validateDesireApostleEncounter,
} from '../../src/domain/desire-apostle/encounter.js';
import { DEMON_COUNT_WHEEL, demonAbilityWheel, resolveDemonCombatAbility } from '../../src/domain/demon/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'abyss.s6.flame-hex', J = 'BODY_FOLLOWUP', B = 'abyss.s6.demonic-body';
const K = 'abyss.s5.emotion-seed', R = 'OBSERVE', A = 'ACCIDENT';
const profile: readonly [DesireApostleMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], [A, 5, null],
];
/** Synthetic actual arrival isolates engine boundaries; natural fixtures cover acquisition and reports. */
function fixture(): SliceState {
  const s = createSliceRun('desire-apostle-combat-test', sliceDefaultCreationSelection, 'desire-apostle-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'abyss', sequence: 5,
    mastery: { [K]: 0, 'abyss.s5.catalysis': 0, [H]: 0, [B]: 0, 'abyss.s6.danger-premonition': 0 },
    acting: 25, promotionWeek: 22 };
  s.desireApostle = createDesireApostleState(); s.desireApostle.promotionWeek = 22;
  Object.assign(s.desireApostle.cases['calm-boundary']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'CALM_CHECKED' });
  Object.assign(s.desireApostle.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0, emotion: 'STRONG' });
  s.combat = { encounterId: 'DESIRE_APOSTLE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 80; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-desire-apostle', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function ticket(id: DesireApostleMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) { if (candidate === id) return start; start += weight * (stance !== null && stance === preferred ? 5 : 4); }
  throw new Error('Missing test ability');
}
function effect(s: SliceState, id: DesireApostleMoveId, random = fixedRolls(), physical = 1, source: DesireApostleCombatSource | null = currentDesireApostleCombatSource(s)) {
  return resolveDesireApostleCombatAbility(s, id, physical, random, source);
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const next = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    next.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected random draw ${index}: ${value}, expected ${min}–${max}`); return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(s: SliceState): void {
  s.combat = null; s.desireApostle.encounter = createDesireApostleState().encounter;
}
afterEach(() => vi.restoreAllMocks());

describe('Desire Apostle exact S5 profile and original Ferran source', () => {
  it('routes only abyss5 to detached30/15/20/20/10/5 and count12/20/25/23/14/6 wheels', () => {
    const s = fixture(); expect(isDesireApostle(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(desireApostleAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(DESIRE_APOSTLE_COUNT_WHEEL);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    s.progression.pathwayId = 'sun'; expect(isDesireApostle(s)).toBe(false);
    s.progression.pathwayId = 'abyss'; s.progression.sequence = 4; expect(isDesireApostle(s)).toBe(false);
  });
  it('uses exact count and stance-ticket boundaries with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(desireApostleActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, w, preferred]) => w * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0); let edge = 0;
      desireApostleAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = edge + 1; edge += weights[i]!; const r = fixedRolls(first, edge);
        expect(drawDesireApostleAbility(r, stance)).toBe(entry.id); expect(drawDesireApostleAbility(r, stance)).toBe(entry.id); expect(r.cursor).toBe(2);
      });
    }
  });
  it('binds original Ferran, own club, actual2m daylight exit and rejects forged provenance without a draw', () => {
    const s = fixture(), source = currentDesireApostleCombatSource(s)!;
    expect(source).toMatchObject({ target: 'FERRAN_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'FERRANS_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, daylight: true, bystanders: 'NONE', pursuit: false });
    for (const key of Object.keys(source)) {
      const forged = { ...source, [key]: 'WRONG' } as unknown as DesireApostleCombatSource, before = structuredClone(s), r = fixedRolls();
      for (const [id] of profile) expect(effect(s, id, r, 1, forged)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(observeDesireApostleEnemyOpening(s, 'OPENING', false, forged)).toBeNull();
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    expect(effect(s, H, fixedRolls(), 1, null).selfGain).toBe(0);
  });
  it('rejects unrelated encounters, missing reports, unclosed original practice and discontinuous histories', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat!.encounterId = 'FIRST_CASE'; }, (s: SliceState) => { s.combat!.encounterId = 'DEMON_DISPUTE'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.desireApostle.encounter.attemptWeek = 1; }, (s: SliceState) => { s.desireApostle.practice.ledger = 'PLAYER'; },
      (s: SliceState) => { s.desireApostle.practice.note = 'WRITTEN'; }, (s: SliceState) => { s.desireApostle.practice.seed = 'PLANTED'; },
      (s: SliceState) => { s.desireApostle.cases['calm-boundary']!.contactOpen = true; },
      (s: SliceState) => { s.desireApostle.cases['calm-boundary']!.closes = 0; },
      (s: SliceState) => { s.demon.practice.body = 'ENLARGED'; }, (s: SliceState) => { s.demon.practice.flame = 'LIT'; },
    ]) {
      const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(currentDesireApostleCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow(); expect(s).toEqual(before);
    }
  });
  it('preserves the exact old Demon6 wheel, budgets, strain and accident without mutating S5 history', () => {
    const s = fixture(); s.progression.sequence = 6;
    Object.assign(s.demon.cases['loading-lane']!, { status: 'RESOLVED', outcome: 'LANE_VERIFIED', method: 'ORDINARY' });
    s.demon.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 }; s.combat!.encounterId = 'DEMON_DISPUTE';
    const history = structuredClone(s.desireApostle);
    expect(playerAbilityWheel(s, null)).toEqual(demonAbilityWheel(null, s)); expect(playerCountWheel(s)).toEqual(DEMON_COUNT_WHEEL);
    expect(resolveDemonCombatAbility(s, H, 1, fixedRolls()).selfGain).toBe(54.925 * 0.65);
    expect(resolveDemonCombatAbility(s, A, 1, fixedRolls()).selfGain).toBe(-16.25);
    expect(s.spirituality).toBe(77); expect(s.demon.strain).toBe(1); expect(s.desireApostle).toEqual(history); expect(currentDesireApostleCombatSource(s)).toBeNull();
  });
});

describe('Inherited Demon costs and separate two-stage emotion transaction', () => {
  it('inherits H3S1strain, free J and B2S1strain with exact unchanged mastery budgets', () => {
    for (const mastery of [0, 100, 500]) {
      const s = fixture(); s.progression.mastery[H] = mastery; s.progression.mastery[B] = mastery;
      const f = 0.65 + 0.35 * mastery / 500, original = structuredClone(s.combat), physical = 0.8;
      expect(effect(s, H, fixedRolls(), physical).selfGain).toBe(54.925 * f);
      expect(effect(s, J, fixedRolls(), physical).selfGain).toBe(29.575 * f * physical);
      expect(effect(s, B, fixedRolls(), physical).enemyReduction).toBe(50.7 * f * physical);
      expect(s.spirituality).toBe(75); expect(s.demon.strain).toBe(2); expect(s.combat).toEqual(original);
    }
  });
  it('prioritizes the actually held club, and never pays partial costs beyond the original strain cap', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const before = structuredClone(s);
    expect(effect(s, H, fixedRolls(), 0.8).selfGain).toBe(16 * 0.8); expect(s).toEqual(before);
    s.town.clubLocation = 'SHOP'; s.demon.strain = 3;
    expect(effect(s, H).selfGain).toBe(12); expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(80);
    s.demon.strain = 0; s.spirituality = 1;
    expect(effect(s, H).selfGain).toBe(12); expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(1); expect(s.demon.strain).toBe(0);
  });
  it('pays3S to plant and a later2S to catalyze at knowledge14, with no immediate gain or damage', () => {
    const s = fixture(), original = structuredClone(s.combat), source = currentDesireApostleCombatSource(s), r = fixedRolls(52, 52);
    expect(effect(s, K, r, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(77); expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: true, lastSeedRound: 1, staggerReady: false });
    expect(effect(s, K, r, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(75); expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1, staggerReady: true });
    expect(s.combat).toEqual(original); expect(s.demon.strain).toBe(0); expect(r.cursor).toBe(2);
    expect(effect(s, K).label).toContain('本轮已经尝试'); expect(s.spirituality).toBe(75);
  });
  it('charges failed planting and failed catalysis, consumes the seed, and prevents same-round replanting', () => {
    const plantFailure = fixture(); expect(effect(plantFailure, K, fixedRolls(53)).label).toContain('情绪埋种失败');
    expect(plantFailure.spirituality).toBe(77); expect(plantFailure.desireApostle.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1 });
    expect(effect(plantFailure, K).label).toContain('本轮已经尝试'); expect(plantFailure.spirituality).toBe(77);
    const catalystFailure = fixture(); effect(catalystFailure, K, fixedRolls(1));
    expect(effect(catalystFailure, K, fixedRolls(100)).label).toContain('情绪催化失败');
    expect(catalystFailure.spirituality).toBe(75); expect(catalystFailure.desireApostle.encounter).toMatchObject({ seedPlanted: false, staggerReady: false });
    effect(catalystFailure, K); expect(catalystFailure.spirituality).toBe(75);
  });
  it('insufficient spirituality neither draws nor records a false attempt, and preserves an unpaid catalyst seed', () => {
    const s = fixture(); s.spirituality = 2; const before = structuredClone(s);
    expect(effect(s, K).label).toContain('不足'); expect(s).toEqual(before);
    s.spirituality = 3; effect(s, K, fixedRolls(1)); expect(s.spirituality).toBe(0);
    const pending = structuredClone(s); expect(effect(s, K).label).toContain('不足'); expect(s).toEqual(pending);
    expect(finishDesireApostleCombatRound(s, false)).toContain('原种子已经清除'); expect(s.spirituality).toBe(0); expect(s.desireApostle.encounter.lastSeedRound).toBe(1);
  });
  it('actual calm blocks both stages without payment, draws, forced anger, or hidden source fallback', () => {
    const s = fixture(), source = currentDesireApostleCombatSource(s); effect(s, K, fixedRolls(1));
    expect(observeDesireApostleEnemyOpening(s, 'OPENING', false, source)).toContain('放缓呼吸');
    const pending = structuredClone(s); expect(effect(s, K, fixedRolls(), 1, source).label).toContain('情绪平稳'); expect(s).toEqual(pending);
    s.desireApostle.encounter.seedPlanted = false; const calm = structuredClone(s); effect(s, K); effect(s, R); expect(s).toEqual(calm);
    expect(desireApostleAbilityWheel('CONTROL', s).find(a => a.id === K)!.label).toContain('缺少入口');
  });
  it('R only observes current public state and A is fixed−22.5 without a random coin or emotions', () => {
    const s = fixture(), before = structuredClone(s), random = fixedRolls();
    expect(effect(s, R, random).selfGain).toBe(0); expect(effect(s, A, random).selfGain).toBe(-22.5);
    expect(random.cursor).toBe(0); expect(s).toEqual(before);
    expect(observeDesireApostleEnemyOpening(s, 'STRIKE')).toBeNull();
    expect(observeDesireApostleEnemyOpening(s, 'OPENING', true)).toBeNull(); expect(s).toEqual(before);
  });
  it('consumes successful catalysis on only one later positive ordinarySTRIKE, without health or carryover', () => {
    const s = fixture(), body = structuredClone(s.combat); effect(s, K, fixedRolls(1)); effect(s, K, fixedRolls(1));
    for (const [id, gain, suppressed] of [['OPENING', 8, false], ['BLOCK', 16, false], ['STRIKE', 0, false], ['STRIKE', -1, false], ['STRIKE', 16, true]] as const) expect(consumeDesireApostleStagger(s, id, gain, suppressed)).toBeNull();
    expect(consumeDesireApostleStagger(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.5); expect(consumeDesireApostleStagger(s, 'STRIKE', 16)).toBeNull(); expect(s.combat).toEqual(body);
    const unused = fixture(); effect(unused, K, fixedRolls(1)); effect(unused, K, fixedRolls(1));
    expect(finishDesireApostleCombatRound(unused, true)).toContain('本轮结束'); expect(unused.desireApostle.encounter.staggerReady).toBe(false); expect(unused.spirituality).toBe(75);
  });
});

describe('Actual ordinary opening, finite expiry and shared battle outcomes', () => {
  it('uses inherited core35/30/15/20, tier900/floor90/max100 and continuing regeneration10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 90;
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1);
    expect(result.round.playerAdvantage).toBe(922 - 22.5); expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(100);
    const dry = fixture(); dry.spirituality = 0;
    expect(recordedRound(dry, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(915 * 0.8); expect(dry.spirituality).toBe(10);
    const cap = fixture(); cap.spirituality = 100; cap.character.coreStats = { physique: 1000, perception: 1000, will: 1000, knowledge: 1000 };
    expect(recordedRound(cap, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(1080);
    vi.spyOn(desireCombat, 'resolveDesireApostleCombatAbility').mockReturnValue({ label: 'controlled floor', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('two actual K slots weaken only the following original club strike and cannot injure on their own', () => {
    const s = fixture();
    const result = recordedRound(s, 'CONTROL', 33, 46, ticket(K, 'CONTROL'), 1, 161, ticket(K, 'CONTROL'), 1, 1, ticket(R, 'CONTROL'), 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 0, 0, 8, 0]);
    expect(result.round.moves[3]!.label).toContain('×0.5'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyStatus).toBe('RESISTING'); expect(s.spirituality).toBe(85);
    expect(s.desireApostle.encounter).toMatchObject({ emotion: 'STRONG', seedPlanted: false, staggerReady: false, lastSeedRound: 1 }); expect(validateDesireApostleEncounter(s)).toBe(true);
  });
  it('the real existing OPENING retains8, visibly calms Ferran, and blocks later actual K without another draw', () => {
    const s = fixture();
    const result = recordedRound(s, 'CONTROL', 33, 46, ticket(K, 'CONTROL'), 1, 241, ticket(K, 'CONTROL'), 1, ticket(R, 'CONTROL'), 1);
    expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 8, 0, 16, 0]); expect(result.round.moves[1]!.label).toContain('稳住情绪后寻找空当');
    expect(result.round.moves[2]!.label).toContain('情绪平稳'); expect(s.spirituality).toBe(87);
    expect(s.desireApostle.encounter).toMatchObject({ emotion: 'CALM', seedPlanted: true, lastSeedRound: 1, staggerReady: false });
    expect(validateDesireApostleEncounter(s)).toBe(true);
    recordedRound(s, 'CONTROL', 1, 1, 400, ticket(K, 'CONTROL'), 1);
    expect(s.desireApostle.encounter).toMatchObject({ emotion: 'CALM', seedPlanted: false, lastSeedRound: 1 }); expect(validateDesireApostleEncounter(s)).toBe(true);
  });
  it('a successful seed survives its planting round, expires at the next round end, and preserves its attempt history', () => {
    const s = fixture(); recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1);
    expect(s.desireApostle.encounter.seedPlanted).toBe(true); expect(s.combat!.round).toBe(2); expect(validateDesireApostleEncounter(s)).toBe(true);
    const next = recordedRound(s, 'CONTROL', 1, 1, 400, ticket(R, 'CONTROL'), 1);
    expect(next.round.consequence).toContain('两轮窗口'); expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1, emotion: 'STRONG' });
    expect(validateDesireApostleEncounter(s)).toBe(true);
    recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1);
    expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: true, lastSeedRound: 3 }); expect(validateDesireApostleEncounter(s)).toBe(true);
  });
  it('calm arrived before a first planting blocks the real slot and does not fabricate attempt history', () => {
    const s = fixture(); recordedRound(s, 'CONTROL', 13, 1, ticket(R, 'CONTROL'), 241, ticket(K, 'CONTROL'), 1);
    expect(s.desireApostle.encounter).toMatchObject({ emotion: 'CALM', seedPlanted: false, lastSeedRound: null }); expect(s.spirituality).toBe(90);
    expect(validateDesireApostleEncounter(s)).toBe(true);
    s.desireApostle.encounter.emotion = 'STRONG'; expect(validateDesireApostleEncounter(s)).toBe(false);
  });
  it('pays1AP for actual arrival and sets real anger then, while ordinary refusal/talk grants no reward', () => {
    const s = fixture(); available(s); s.actionsRemaining = 2;
    applyDesireApostleEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(1);
    expect(s.desireApostle.encounter.status).toBe('AVAILABLE'); expect(blockDesireApostleEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周');
    const ctx = context(); applyDesireApostleEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.actionsRemaining).toBe(0); expect(s.desireApostle.encounter.emotion).toBe('STRONG'); expect(currentDesireApostleCombatSource(s)).not.toBeNull(); expect(validateDesireApostleEncounter(s)).toBe(true);
    expect(ctx.note).toHaveBeenCalledWith('费兰当前实际愤怒的有限冲突', expect.stringContaining('明确说自己'));
    const peaceful = fixture(); available(peaceful); const before = structuredClone(peaceful.progression);
    applyDesireApostleEncounter(peaceful, { type: 'ENCOUNTER_TALK' }, context()); expect(peaceful.desireApostle.encounter.status).toBe('RESOLVED'); expect(peaceful.progression).toEqual(before); expect(validateDesireApostleEncounter(peaceful)).toBe(true);
  });
  it('retreat uses the original real exit, clears a remaining seed and grants no terminal regeneration or reward', () => {
    const s = fixture(); recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1);
    const spirituality = s.spirituality, award = vi.fn(); const result = recordedRound(s, 'RETREAT', 100, 100, 400, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.consequence).toContain('费兰'); expect(result.round.consequence).toContain('实际原出口');
    expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: false, staggerReady: false, lastSeedRound: 1 }); expect(s.spirituality).toBe(spirituality);
    settleDesireApostleEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.desireApostle.encounter.status).toBe('RETREATED'); expect(validateDesireApostleEncounter(s)).toBe(true);
  });
  it('enemy surrender/death are real common outcomes, clear seeds, preserve custody and award effective survival only once', () => {
    for (const roll of [70, 100]) {
      const s = fixture(), awards: [string, number][] = [];
      const result = recordedRound(s, 'CONTROL', 13, 1, ticket(K, 'CONTROL'), 1, 400, ticket(H, 'CONTROL'), 1, roll);
      expect(result.outcome).toBe(roll === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD'); expect(result.round.consequence).toContain('费兰'); expect(s.spirituality).toBe(74);
      expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: false, staggerReady: false, lastSeedRound: 1 });
      if (roll === 100) expect(s.combat!.enemyHealth).toBe(0);
      settleDesireApostleEncounter(s, result.outcome, context(), (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
      expect(awards).toEqual([['desire-apostle-dispute', 25]]); expect(s.town.clubLocation).toBe('SHOP'); expect(s.demon.strain).toBe(1); expect(s.progression.acting).toBe(25);
      expect(s.combat).toBeNull(); expect(validateDesireApostleEncounter(s)).toBe(true); expect(() => settleDesireApostleEncounter(s, result.outcome, context(), vi.fn())).toThrow();
    }
  });
  it('player death clears pending effects with no refund, resurrection or award and rejects invented endings', () => {
    const s = fixture(), award = vi.fn(); const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1000000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('费兰'); expect(s.health).toBe(0); expect(s.spirituality).toBe(77);
    expect(s.desireApostle.encounter).toMatchObject({ seedPlanted: false, staggerReady: false, lastSeedRound: 1 }); s.status = 'DEAD';
    settleDesireApostleEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(validateDesireApostleEncounter(s)).toBe(true);
    expect(() => settleDesireApostleEncounter(fixture(), 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
  it('rejects fabricated persisted pending/stagger/anger history and replays the same actual battle deterministically', () => {
    const s = fixture(); expect(validateDesireApostleEncounter(s)).toBe(true);
    s.desireApostle.encounter.seedPlanted = true; s.desireApostle.encounter.lastSeedRound = 1; expect(validateDesireApostleEncounter(s)).toBe(false);
    s.desireApostle.encounter.seedPlanted = false; s.desireApostle.encounter.lastSeedRound = null; s.desireApostle.encounter.staggerReady = true; expect(validateDesireApostleEncounter(s)).toBe(false);
    const original = fixture(), copy = structuredClone(original);
    expect(resolveSliceCombatRound(original, 'CONTROL')).toEqual(resolveSliceCombatRound(copy, 'CONTROL')); expect(original).toEqual(copy);
  });
});
