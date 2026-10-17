import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceCombatRound, SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createPainState } from '../../src/domain/pain/index.js';
import {
  PAIN_COUNT_WHEEL, beginPainCombatRound, consumePainEnemyStrike, currentPainCombatSource,
  drawPainAbility, finishPainCombatRound, isPain, painAbilityWheel, painActionCount, resolvePainCombatAbility,
  type PainCombatSource, type PainMoveId,
} from '../../src/domain/pain/combat.js';
import * as painCombat from '../../src/domain/pain/combat.js';
import { applyPainEncounter, blockPainEncounter, PAIN_ENCOUNTER_STORY, settlePainEncounter, validatePainEncounter } from '../../src/domain/pain/encounter.js';
import { PLEASURE_COUNT_WHEEL, pleasureAbilityWheel } from '../../src/domain/pleasure/combat.js';
import { WITCH_COUNT_WHEEL, witchAbilityWheel } from '../../src/domain/witch/combat.js';
import { INSTIGATOR_COUNT_WHEEL, instigatorAbilityWheel } from '../../src/domain/instigator/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel } from '../../src/domain/assassin/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'assassin.s7.black-flame', J = 'assassin.s7.frost', B = 'assassin.s7.substitute', K = 'assassin.s5.disease';
const profile: readonly [PainMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], ['OBSERVE', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
/** Explicit synthetic paid-arrival fixture for isolated rules, not natural promotion evidence. */
function fixture(): SliceState {
  const s = createSliceRun('pain-combat-test', sliceDefaultCreationSelection, 'pain-combat');
  s.activeEvent = null; s.eventQueue = []; s.arc.stage = 'ENDED'; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'demoness', sequence: 5, mastery: { [K]: 0 }, acting: 25, promotionWeek: 22 };
  s.pain = createPainState(); s.pain.promotionWeek = 22;
  Object.assign(s.pain.cases['exit-markers']!, { status: 'RESOLVED', contactOpen: false, closes: 1,
    attemptWeek: 23, method: 'ORDINARY', outcome: 'EXIT_REHEARSED' });
  Object.assign(s.pain.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0, enemyStatus: 'RESISTING' });
  s.combat = { encounterId: 'PAIN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.cash = 1000; s.actionsRemaining = 6; s.town.clubLocation = 'SHOP';
  return s;
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.pain.encounter = createPainState().encounter; return s;
}
function ticket(id: PainMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-pain', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: PainMoveId, random = fixedRolls(), physical = 1,
  source: PainCombatSource | null = currentPainCombatSource(s), stance: SliceStance = 'ATTACK') {
  return resolvePainCombatAbility(s, id, physical, random, source, stance);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
/** Synthetic no-damage round for unit maintenance boundaries only. */
function nextRound(s: SliceState): void {
  finishPainCombatRound(s, true);
  const r: SliceCombatRound = { round: s.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [],
    playerAdvantage: 915, enemyAdvantage: 114, winChance: 80, winner: 'PLAYER',
    consequence: '没有有效致伤行动', consequenceWeights: null, retreat: 'NONE',
    painOutcome: { enemyHealth: s.combat!.enemyHealth, enemyStatus: s.combat!.enemyStatus,
      enemyDisease: s.pain.encounter.enemyDisease, diseaseApplications: s.pain.encounter.diseaseApplications } };
  s.combatHistory.push(r); s.combat!.lastRound = r; s.combat!.round += 1;
}
function expose(s: SliceState): void { expect(effect(s, K, fixedRolls(1)).threatens).toBe(false); }
function surrenderedExposed(): SliceState {
  const s = fixture();
  recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1);
  const result = recordedRound(s, 'ATTACK', 1, 1, 1, ticket(H, 'ATTACK'), 1, 80);
  expect(result.outcome).toBe('ENEMY_SURRENDERED');
  settlePainEncounter(s, result.outcome, context(), (source) => { s.seer.completedSources.push(source); });
  return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Pain S5 exact finite profile, original source and inheritance', () => {
  it('routes detached six30/15/20/20/10/5 slots and six12/20/25/23/14/6 counts', () => {
    const s = fixture(); expect(isPain(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(painAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(PAIN_COUNT_WHEEL);
    expect(playerCountWheel(s).map(a => a.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
  });
  it('keeps integer draw boundaries and exact normalized posture weights', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(painActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0);
      for (const [i, [id]] of profile.entries()) {
        const random = fixedRolls(ticket(id, stance)); expect(drawPainAbility(random, stance)).toBe(id); expect(random.cursor).toBe(1);
        expect(painAbilityWheel(stance)[i]!.weight).toBeCloseTo(weights[i]! / total * 100, 12);
      }
    }
  });
  it('uses inherited demoness core25/30/30/15, tier900/floor90, max100 and recovery10', () => {
    const s = fixture(); s.spirituality = 90; s.character.coreStats = { physique: 20, perception: 10, will: 40, knowledge: 30 };
    const r = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 100, 400, 1);
    expect(r.round.playerAdvantage).toBe(924.5); expect(r.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(96);
    const capped = fixture(); capped.character.coreStats = { physique: 200, perception: 200, will: 200, knowledge: 200 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 10;
    expect(recordedRound(capped, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 100, 400, 1).round.playerAdvantage).toBe(648);
    expect(capped.spirituality).toBe(16);
    vi.spyOn(painCombat, 'resolvePainCombatAbility').mockReturnValue({ label: 'bounded floor fixture', selfGain: -5000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('requires current original Oren, clear2m empty yard, closed report and continuous actual history', () => {
    const s = fixture(); expect(currentPainCombatSource(s)).toMatchObject({ target: 'OREN_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'ORENS_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    for (const mutate of [
      (x: SliceState) => { x.pain.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.pain.cases['exit-markers']!.closes = 0; },
      (x: SliceState) => { x.pain.practice.companionNode = 'SAFE_MARK'; },
      (x: SliceState) => { x.pain.practice.marker = 'DOOR_MARK'; },
      (x: SliceState) => { x.pleasure.practice.wrist = 'SILK'; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.encounterId = 'FIRST_CASE'; },
      (x: SliceState) => { x.pain.encounter.enemyStatus = 'SURRENDERED'; },
    ]) {
      const bad = structuredClone(s); mutate(bad); const old = structuredClone(bad);
      expect(currentPainCombatSource(bad)).toBeNull(); expect(() => resolveSliceCombatRound(bad, 'ATTACK')).toThrow();
      expect(effect(bad, K)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(bad).toEqual(old);
    }
    const stale = currentPainCombatSource(s)!; s.revision++;
    expect(effect(s, H, fixedRolls(), 1, stale).selfGain).toBe(0);
    expect(effect(s, K, fixedRolls(), 1, { ...currentPainCombatSource(s)!, distanceMetres: 3 } as unknown as PainCombatSource).selfGain).toBe(0);
  });
  it('preserves all four old profile wheels and actual old body, mastery, tools and encounter state', () => {
    const s = fixture(), oldBody = [s.witch.previousGender, s.character.gender, s.character.appearanceDescription], oldPleasure = structuredClone(s.pleasure);
    for (const [sequence, wheel, counts] of [[6, pleasureAbilityWheel, PLEASURE_COUNT_WHEEL], [7, witchAbilityWheel, WITCH_COUNT_WHEEL],
      [8, instigatorAbilityWheel, INSTIGATOR_COUNT_WHEEL], [9, assassinAbilityWheel, ASSASSIN_COUNT_WHEEL]] as const) {
      s.progression.sequence = sequence; expect(playerAbilityWheel(s, null)).toEqual(wheel(null, s)); expect(playerCountWheel(s)).toEqual(counts);
    }
    s.progression.sequence = 5; s.progression.mastery[H] = 500;
    expect(effect(s, H).selfGain).toBeCloseTo(59.15); expect(effect(s, J).enemyReduction).toBeCloseTo(31.85 * 0.65);
    expect([s.witch.previousGender, s.character.gender, s.character.appearanceDescription]).toEqual(oldBody); expect(s.pleasure).toEqual(oldPleasure); expect(s.progression.mastery[H]).toBe(500);
  });
  it('consumes one actual prepared original mirror, then actual powder, then ordinary fallback', () => {
    const s = fixture(), tools = s.witch.tools;
    Object.assign(tools, { mirrorsHeld: 1, mirrorPrepared: true, mirrorsUsed: 0, powderHeld: 1, powderUsed: 0 });
    expect(effect(s, B).enemyReduction).toBeCloseTo(42.25 * 0.65); expect(s.spirituality).toBe(97);
    expect(tools).toMatchObject({ mirrorsHeld: 0, mirrorPrepared: false, mirrorsUsed: 1, powderHeld: 1 });
    expect(effect(s, B).enemyReduction).toBeCloseTo(21.125 * 0.65); expect(s.spirituality).toBe(95);
    expect(tools).toMatchObject({ powderHeld: 0, powderUsed: 1 });
    expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(95);
  });
  it('replaces black flame with the actual held club and keeps accidents non-threatening', () => {
    const s = fixture(); s.town.clubLocation = 'HAND';
    expect(effect(s, H, fixedRolls(), 0.5)).toMatchObject({ selfGain: 8, threatens: true }); expect(s.spirituality).toBe(100);
    expect(effect(s, 'ACCIDENT', fixedRolls(1))).toMatchObject({ selfGain: -22.5, threatens: false });
    expect(effect(s, 'ACCIDENT', fixedRolls(2))).toMatchObject({ selfGain: 22.5, threatens: false });
    expect(effect(s, 'assassin.s6.charm')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(100);
  });
});

describe('Finite supernatural disease is progressive, paid and persistent', () => {
  it('starts only after real4S knowledge14 success, without instant health damage or attack', () => {
    const s = fixture(); const r = effect(s, K, fixedRolls(52));
    expect(r).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s.spirituality).toBe(96);
    expect(s.pain.encounter).toMatchObject({ fieldActive: true, enemyDisease: 1, diseaseApplications: 1, lastDiseaseRound: 1 });
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyStatus).toBe('RESISTING');
    expect(effect(s, K)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(beginPainCombatRound(s, 'ATTACK')).toBeNull(); expect(s.spirituality).toBe(96); expect(s.pain.encounter.enemyDisease).toBe(1);
  });
  it('charges failed starts, never invents exposure, and cannot start below4S', () => {
    const s = fixture(); expect(effect(s, K, fixedRolls(53)).threatens).toBe(false); expect(s.spirituality).toBe(96);
    expect(s.pain.encounter).toMatchObject({ fieldActive: false, enemyDisease: 0, diseaseApplications: 0, lastDiseaseRound: null });
    s.spirituality = 3; expect(effect(s, K)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s.spirituality).toBe(3);
  });
  it('advances at most once per new round for2S and remains capped at3 while maintenance still costs', () => {
    const s = fixture(); expose(s);
    for (const [round, intensity, spirit] of [[2, 2, 94], [3, 3, 92], [4, 3, 90]]) {
      nextRound(s); expect(beginPainCombatRound(s, 'CONTROL')).toContain('2灵性');
      expect(s.pain.encounter).toMatchObject({ enemyDisease: intensity, lastDiseaseRound: round, diseaseApplications: 1 });
      expect(s.spirituality).toBe(spirit); expect(beginPainCombatRound(s, 'ATTACK')).toBeNull(); expect(s.spirituality).toBe(spirit);
    }
    expect(s.combat!.enemyHealth).toBe(100);
  });
  it('explicit DEFEND stops all new exposure and maintenance while original illness remains', () => {
    const s = fixture(); expose(s); nextRound(s); const before = s.spirituality;
    expect(beginPainCombatRound(s, 'DEFEND')).toContain('不等于治愈');
    expect(effect(s, K, fixedRolls(), 1, currentPainCombatSource(s), 'DEFEND').enemyReduction).toBe(10);
    expect(s.spirituality).toBe(before); expect(s.pain.encounter).toMatchObject({ fieldActive: false, enemyDisease: 1, diseaseApplications: 1 });
    expect(consumePainEnemyStrike(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.9);
    nextRound(s); expect(beginPainCombatRound(s, 'CONTROL')).toBeNull(); expect(effect(s, K).enemyReduction).toBe(10);
    expect(s.pain.encounter.enemyDisease).toBe(1); expect(s.spirituality).toBe(before);
    const clean = fixture(); beginPainCombatRound(clean, 'DEFEND');
    expect(effect(clean, K, fixedRolls(), 1, currentPainCombatSource(clean), 'DEFEND').enemyReduction).toBe(10);
    expect(clean.pain.encounter.enemyDisease).toBe(0); expect(clean.spirituality).toBe(100);
  });
  it('insufficient maintenance ends the field without reducing disease or refunding resources', () => {
    const s = fixture(); expose(s); nextRound(s); s.spirituality = 1;
    expect(beginPainCombatRound(s, 'ATTACK')).toContain('不足2灵性');
    expect(s.pain.encounter).toMatchObject({ fieldActive: false, enemyDisease: 1, lastDiseaseRound: 1 }); expect(s.spirituality).toBe(1);
  });
  it('modifies only actual positive unsuppressed STRIKE at exact.90/.80/.65, never health or other moves', () => {
    const s = fixture(); expect(consumePainEnemyStrike(s, 'STRIKE', 16)).toBeNull(); expose(s);
    for (const [intensity, multiplier] of [[1, 0.9], [2, 0.8], [3, 0.65]]) {
      if (intensity! > 1) { nextRound(s); beginPainCombatRound(s, 'ATTACK'); }
      for (const [id, value, suppressed] of [['OPENING', 8, false], ['SPELL', 30, false], ['STRIKE', 0, false], ['STRIKE', -1, false], ['STRIKE', 16, true]] as const)
        expect(consumePainEnemyStrike(s, id, value, suppressed)).toBeNull();
      expect(consumePainEnemyStrike(s, 'STRIKE', 16)?.physicalMultiplier).toBe(multiplier);
      expect(s.combat!.enemyHealth).toBe(100); expect(s.pain.encounter.enemyDisease).toBe(intensity);
    }
    expect(PAIN_ENCOUNTER_STORY).toContain('无友军自动免疫'); expect(PAIN_ENCOUNTER_STORY).toContain('没有旁人');
  });
  it('requires separate paid R preparation and later paid resistance, independent of old Pleasure silk', () => {
    const s = fixture(); s.pleasure.encounter.silkPrepared = true; s.pleasure.encounter.boundRound = 17;
    const old = structuredClone(s.pleasure.encounter);
    expect(effect(s, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(s.pain.encounter).toMatchObject({ silkPrepared: true, boundRound: null }); expect(s.spirituality).toBe(97);
    expect(consumePainEnemyStrike(s, 'STRIKE', 16)).toBeNull();
    expose(s); expect(effect(s, 'OBSERVE', fixedRolls(1)).threatens).toBe(false); expect(s.spirituality).toBe(90);
    expect(s.pain.encounter).toMatchObject({ silkPrepared: false, boundRound: 1 });
    expect(consumePainEnemyStrike(s, 'OPENING', 8)).toBeNull(); expect(s.pain.encounter.boundRound).toBe(1);
    expect(consumePainEnemyStrike(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.5);
    expect(s.pain.encounter.boundRound).toBeNull(); expect(consumePainEnemyStrike(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.9);
    expect(s.pleasure.encounter).toEqual(old);
  });
  it('preserves preparation if unaffordable, consumes failed binding and expires unused successful binding', () => {
    const s = fixture(); effect(s, 'OBSERVE'); s.spirituality = 2;
    expect(effect(s, 'OBSERVE').selfGain).toBe(0); expect(s.pain.encounter.silkPrepared).toBe(true); expect(s.spirituality).toBe(2);
    s.spirituality = 20; effect(s, 'OBSERVE', fixedRolls(100));
    expect(s.pain.encounter).toMatchObject({ silkPrepared: false, boundRound: null }); expect(s.spirituality).toBe(17);
    effect(s, 'OBSERVE'); effect(s, 'OBSERVE', fixedRolls(1));
    expect(finishPainCombatRound(s, true)).toContain('已实际解除'); expect(s.pain.encounter.boundRound).toBeNull();
  });
});

describe('Shared round outcomes, original injury snapshots and assistance', () => {
  it('K alone cannot turn high advantage into injury, surrender or immediate death', () => {
    const s = fixture(); const r = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(r.outcome).toBe('CONTINUE'); expect(r.round.consequenceWeights).toBeNull();
    expect(r.round.moves.find(m => m.actor === 'ENEMY')?.selfGain).toBeCloseTo(14.4);
    expect(r.round.painOutcome).toEqual({ enemyHealth: 100, enemyStatus: 'RESISTING', enemyDisease: 1, diseaseApplications: 1 });
    expect(s.pain.encounter.enemyHealth).toBe(100); expect(validatePainEncounter(s)).toBe(true);
  });
  it('advances before the next actual enemy action; DEFEND then stops exposure without stopping existing weakness', () => {
    const s = fixture(); recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1);
    const second = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 1);
    expect(second.round.moves.find(m => m.actor === 'ENEMY')?.selfGain).toBeCloseTo(12.8);
    expect(s.pain.encounter.enemyDisease).toBe(2);
    const third = recordedRound(s, 'DEFEND', 1, 1, ticket(K, 'DEFEND'), 1, 1);
    expect(third.round.moves.find(m => m.actor === 'ENEMY')?.selfGain).toBeCloseTo(12.8);
    expect(third.round.consequence).toContain('停止新增暴露'); expect(s.pain.encounter.fieldActive).toBe(false);
    expect(s.pain.encounter.enemyDisease).toBe(2); expect(s.combat!.enemyHealth).toBe(100);
  });
  it('real attack retains shared heavy injury, voluntary surrender and illness before cleanup', () => {
    const s = surrenderedExposed();
    expect(s.combat).toBeNull(); expect(s.pain.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70,
      enemyStatus: 'SURRENDERED', enemyDisease: 2, diseaseApplications: 1, fieldActive: false });
    expect(s.combatHistory.at(-1)?.painOutcome).toEqual({ enemyHealth: 70, enemyStatus: 'SURRENDERED', enemyDisease: 2, diseaseApplications: 1 });
    expect(s.seer.completedSources.filter(x => x === 'pain-dispute')).toHaveLength(1); expect(validatePainEncounter(s)).toBe(true);
  });
  it('requests actual assistance once for1AP40p without curing or resetting original health, intensity or history', () => {
    const s = surrenderedExposed(), health = s.health, mind = s.mind, spirit = s.spirituality;
    const before = structuredClone(s.pain.encounter), history = structuredClone(s.combatHistory), ap = s.actionsRemaining, cash = s.cash;
    expect(blockPainEncounter(s, { type: 'ENCOUNTER_AID' })).toBeNull(); applyPainEncounter(s, { type: 'ENCOUNTER_AID' }, context());
    expect(s.pain.encounter).toEqual({ ...before, care: 'REQUESTED' }); expect(s.combatHistory).toEqual(history);
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash - 40);
    expect([s.health, s.mind, s.spirituality]).toEqual([health, mind, spirit]); expect(validatePainEncounter(s)).toBe(true);
    expect(blockPainEncounter(s, { type: 'ENCOUNTER_AID' })).toContain('已经');
    expect(() => applyPainEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow();
  });
  it('original enemy death remains death and does not allow aid or a regenerated retry', () => {
    const s = fixture(); expose(s);
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); settlePainEncounter(s, result.outcome, context(), source => s.seer.completedSources.push(source));
    expect(s.pain.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD', enemyDisease: 1, fieldActive: false });
    expect(validatePainEncounter(s)).toBe(true); expect(blockPainEncounter(s, { type: 'ENCOUNTER_AID' })).not.toBeNull();
    expect(blockPainEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
  });
  it('player death loses maintenance but never cures the surviving original enemy or grants reward', () => {
    const s = fixture(); expose(s);
    const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); const award = vi.fn(); settlePainEncounter(s, result.outcome, context(), award); s.status = 'DEAD';
    expect(award).not.toHaveBeenCalled(); expect(s.pain.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100,
      enemyStatus: 'RESISTING', enemyDisease: 1, fieldActive: false });
    expect(validatePainEncounter(s)).toBe(true); expect(blockPainEncounter(s, { type: 'ENCOUNTER_AID' })).not.toBeNull();
  });
  it('actual retreat preserves original illness, gives no reward, and later aid remains only a request', () => {
    const s = fixture(); expose(s); effect(s, 'OBSERVE');
    const result = recordedRound(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED');
    const award = vi.fn(); settlePainEncounter(s, result.outcome, context(), award);
    expect(award).not.toHaveBeenCalled(); expect(s.pain.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100,
      enemyStatus: 'RESISTING', enemyDisease: 1, fieldActive: false, silkPrepared: false });
    expect(result.round.consequence).toContain('原出口'); expect(validatePainEncounter(s)).toBe(true);
    applyPainEncounter(s, { type: 'ENCOUNTER_AID' }, context()); expect(s.pain.encounter.enemyDisease).toBe(1);
  });
  it('failed retreat really keeps the fight open without reactivating the field or removing exposure', () => {
    const s = fixture(); expose(s);
    const result = recordedRound(s, 'RETREAT', 1, 1, 100, 400, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.retreat).toBe('FAILURE');
    expect(s.pain.encounter).toMatchObject({ status: 'FIGHTING', fieldActive: false, enemyDisease: 1 }); expect(validatePainEncounter(s)).toBe(true);
  });
  it('ordinary talk uses actual consent and never creates disease, rewards or access to aid', () => {
    const s = available(), before = s.actionsRemaining;
    applyPainEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(before - 1);
    expect(s.pain.encounter).toMatchObject({ status: 'AVAILABLE', enemyDisease: 0, enemyStatus: 'RESISTING' });
    expect(validatePainEncounter(s)).toBe(true); expect(blockPainEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.week++; applyPainEncounter(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.pain.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'LEFT', enemyDisease: 0 }); expect(validatePainEncounter(s)).toBe(true);
    expect(blockPainEncounter(s, { type: 'ENCOUNTER_AID' })).not.toBeNull(); expect(s.seer.completedSources).not.toContain('pain-dispute');
  });
  it('rejects missing original snapshots, terminal health/status changes and cleared exposure history', () => {
    const s = surrenderedExposed();
    for (const mutate of [
      (x: SliceState) => { x.pain.encounter.enemyHealth = 100; },
      (x: SliceState) => { x.pain.encounter.enemyStatus = 'DEAD'; },
      (x: SliceState) => { x.pain.encounter.enemyDisease = 0; x.pain.encounter.diseaseApplications = 0; x.pain.encounter.lastDiseaseRound = null; },
      (x: SliceState) => { delete x.combatHistory.at(-1)!.painOutcome; },
      (x: SliceState) => { x.pain.encounter.fieldActive = true; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(validatePainEncounter(bad)).toBe(false); expect(blockPainEncounter(bad, { type: 'ENCOUNTER_AID' })).not.toBeNull(); }
    const pristine = createSliceRun('pain-pristine', sliceDefaultCreationSelection, 'pain-pristine');
    expect(validatePainEncounter(pristine)).toBe(true); pristine.pain.encounter.enemyDisease = 1; expect(validatePainEncounter(pristine)).toBe(false);
  });
  it('does not settle a fabricated outcome or erase original combat when snapshot evidence disagrees', () => {
    const s = fixture(); const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 1, 80);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); s.pain.encounter.enemyHealth = 100;
    const before = structuredClone(s); expect(() => settlePainEncounter(s, result.outcome, context(), vi.fn())).toThrow(); expect(s).toEqual(before);
  });
});
