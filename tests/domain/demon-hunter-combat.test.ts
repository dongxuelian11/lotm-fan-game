import { afterEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createDemonHunterState } from '../../src/domain/demon-hunter/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DEMON_HUNTER_COUNT_WHEEL, DEMON_HUNTER_ENEMY_COUNT_WHEEL, demonHunterAbilityWheel, demonHunterActionCount,
  demonHunterEnemyActionCount, drawDemonHunterAbility, drawDemonHunterEnemyAbility, currentDemonHunterCombatSource,
  beginDemonHunterCombatRound, resolveDemonHunterCombatAbility, resolveDemonHunterEnemyAbility, consumeDemonHunterDefense,
  validateDemonHunterRoundOutcome, type DemonHunterMoveId, type DemonHunterRoundContext } from '../../src/domain/demon-hunter/combat.js';
import { applyDemonHunterEncounterCommand, createDemonHunterEncounterState, demonHunterEncounterReason,
  hasDemonHunterDisputeOpponent, projectDemonHunterEncounter, settleDemonHunterEncounter, validateDemonHunterEncounter,
  validateDemonHunterEncounterCommand } from '../../src/domain/demon-hunter/encounter.js';
import { TRAVELER_COUNT_WHEEL } from '../../src/domain/traveler/combat.js';

const H = 'warrior.s6.dawn-weapon', J = 'warrior.s4.targeted-preparation', B = 'warrior.s5.guard-state', K = 'warrior.s4.discern-corruption', R = 'warrior.s4.veil-intent';
const profile: readonly [DemonHunterMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: DemonHunterMoveId, stance: SliceStance | null): number {
  let start = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return start; start += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'finite-demon-hunter', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error(`Unexpected draw${cursor}: ${value} outside${min}..${max}`); return value;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed unit fixture. Production natural promotion is verified separately. */
function fixture(start = true, prepared = false): SliceState {
  const s = createSliceRun('demon-hunter-combat-directed', sliceDefaultCreationSelection, 'demon-hunter-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 90; s.actionsRemaining = 6; s.cash = 500;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'warrior', sequence: 4, mastery: { [H]: 0, [J]: 0, [B]: 0, [K]: 0, [R]: 0 }, acting: 0, promotionWeek: 90 };
  s.demonHunter = createDemonHunterState(); s.demonHunter.promotionWeek = 90; s.demonHunter.guardianActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.demonHunter.life.cases['sealed-sample'].status = 'RESOLVED';
  if (prepared) { s.demonHunter.life.cases['tailored-coating'].status = 'RESOLVED'; applyDemonHunterEncounterCommand(s, { type: 'PREPARE_HUNT' }, context()); }
  if (start) applyDemonHunterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: DemonHunterMoveId, r = beginDemonHunterCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolveDemonHunterCombatAbility(s, id, physical, rng, r);
}
function round(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let i = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[i++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw${i}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Demon Hunter finite actual source and six-slot profile', () => {
  it('uses Traveler6 count, original enemy count and exact30/15/20/20/10/5 slots', () => {
    const s = fixture(); expect(DEMON_HUNTER_COUNT_WHEEL).toEqual(TRAVELER_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(DEMON_HUNTER_COUNT_WHEEL);
    expect(demonHunterAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(demonHunterAbilityWheel(s, null));
    for (const [id] of profile) expect(drawDemonHunterAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 11, 26, 51, 76, 91].map(demonHunterActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DEMON_HUNTER_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]); expect([1, 20, 21, 70, 71, 100].map(demonHunterEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect([1, 31, 56, 76, 96].map(n => drawDemonHunterEnemyAbility(random(n)))).toEqual(['CORRUPTION_PULSE', 'CINDER_GUARD', 'CINDER_LUNGE', 'BODY_STRIKE', 'ACCIDENT']);
  });
  it('starts with a distinct original finite creature, no sword, coating, diagnosis or free inherited ally', () => {
    const s = fixture(); expect(s.demonHunter.encounter).toMatchObject({ targetId: 'DH4-CINDER-GUARD', enemyHealth: 100, enemyMind: 100, enemySpirituality: 36, coatings: [], swordReady: false, weaknessObservedRound: null });
    expect(currentDemonHunterCombatSource(s)).toMatchObject({ targetId: 'DH4-CINDER-GUARD', mutuallyVisible: true, ally: false, ordinaryExit: true, pursuit: false });
    expect(hasDemonHunterDisputeOpponent(s)).toBe(true); expect(validateDemonHunterEncounter(s)).toBe(true);
  });
  it('refuses stale source, open original life contacts and counterfeit targets without draws', () => {
    for (const mutate of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; }]) {
      const s = fixture(), r = beginDemonHunterCombatRound(s, 'ATTACK'); mutate(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.demonHunter.life.samples.shardLid = 'OPEN'; expect(currentDemonHunterCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow();
    s.demonHunter.life.samples.shardLid = 'CLOSED'; s.demonHunter.encounter.targetId = 'REVIVED-EDWIN' as never; expect(currentDemonHunterCombatSource(s)).toBeNull();
  });
  it('keeps a live old first-case carrier separate from the original creature and its materials', () => {
    const s = fixture(false, true), before = structuredClone(s.demonHunter.encounter);
    s.arc.stage = 'COMBAT'; s.world.carrierAlive = true; s.world.carrierCanResist = true;
    s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    expect(effect(s, K).label).toContain('原人'); expect(effect(s, J).selfGain).toBe(8); expect(effect(s, H).selfGain).toBe(12); expect(s.demonHunter.encounter).toEqual(before);
  });
});

describe('Actual sword, paid original coatings, observation and bounded intent concealment', () => {
  it('pays4 summon+2 strike only once, keeps finite duration and never moves an occupied original club', () => {
    const s = fixture(), r = beginDemonHunterCombatRound(s, 'ATTACK');
    expect(effect(s, H, r).selfGain).toBeCloseTo(71.825 * .65 - 8); expect(s.spirituality).toBe(114); expect(s.demonHunter.encounter.swordExpiresRound).toBe(3);
    effect(s, H, r); expect(s.spirituality).toBe(112); expect(s.demonHunter.encounter.swordExpiresRound).toBe(3);
    const held = fixture(); held.town.clubLocation = 'HAND'; const old = structuredClone(held.town); expect(effect(held, H).selfGain).toBe(8); expect(held.spirituality).toBe(120); expect(held.demonHunter.encounter.swordReady).toBe(false); expect(held.town).toEqual(old);
  });
  it('J needs observation and a real weapon, consumes each original charge once then explicitly falls back ordinary', () => {
    const s = fixture(true, true), r = beginDemonHunterCombatRound(s, 'ATTACK');
    expect(effect(s, J, r).label).toContain('没有实际观察'); expect(s.demonHunter.encounter.coatings.every(c => c.status === 'SEALED')).toBe(true);
    effect(s, K, r, random(1)); expect(s.spirituality).toBe(116); expect(s.demonHunter.encounter.weaknessObservedRound).toBe(1);
    expect(effect(s, J, r).label).toContain('没有实际持握'); effect(s, H, r); expect(s.spirituality).toBe(110);
    effect(s, J, r); effect(s, J, r); expect(s.spirituality).toBe(106);
    expect(s.demonHunter.encounter.coatings.map(c => [c.id, c.status, c.usedRound])).toEqual([['DH4-COATING-1', 'SPENT', 1], ['DH4-COATING-2', 'SPENT', 1]]);
    const exhausted = effect(s, J, r); expect(exhausted.label).toContain('库存为0'); expect(exhausted.label).toContain('普通次击'); expect(exhausted.selfGain).toBe(8); expect(s.spirituality).toBe(106);
  });
  it('failed observation and veil retain real spending and never create a diagnosis or concealment', () => {
    const s = fixture(), r = beginDemonHunterCombatRound(s, 'ATTACK');
    effect(s, K, r, random(100)); effect(s, R, r, random(100)); expect(s.spirituality).toBe(113); expect(r.veilReady).toBe(false); expect(s.demonHunter.encounter.weaknessObservedRound).toBeNull();
    s.spirituality = 2; const before = structuredClone(s); effect(s, K, r); effect(s, R, r); expect(s).toEqual(before);
  });
  it('veil suppresses one actual finite warning while visible guard still works', () => {
    const s = fixture(), r = beginDemonHunterCombatRound(s, 'ATTACK'); effect(s, R, r, random(1));
    expect(effect(s, H, r).selfGain).toBeCloseTo(71.825 * .65); expect(s.demonHunter.encounter.warningUses).toBe(0); expect(r.veilReady).toBe(false);
    expect(resolveDemonHunterEnemyAbility(s, 'CINDER_GUARD', 1, r).enemyReduction).toBe(30); expect(s.demonHunter.encounter.enemySpirituality).toBe(33);
    effect(s, H, r); expect(s.demonHunter.encounter.warningUses).toBe(1); expect(s.demonHunter.encounter.enemySpirituality).toBe(31);
    effect(s, H, r); effect(s, H, r); effect(s, H, r); expect(s.demonHunter.encounter.warningUses).toBe(3); expect(s.demonHunter.encounter.enemySpirituality).toBe(27);
  });
  it('DEFEND pays3 once, forfeits H and J all round, shares no phantom ally damage and uses one physical multiplier', () => {
    const s = fixture(true, true), r = beginDemonHunterCombatRound(s, 'DEFEND');
    expect(s.spirituality).toBe(117); expect(effect(s, H, r).threatens).toBe(false); expect(effect(s, J, r).threatens).toBe(false); expect(s.spirituality).toBe(117);
    expect(effect(s, B, r).enemyReduction).toBeCloseTo(35.1 * .65); expect(s.demonHunter.encounter.coatings.every(c => c.status === 'SEALED')).toBe(true);
    expect(consumeDemonHunterDefense(s, r, 'BODY_STRIKE', 18)?.physicalMultiplier).toBe(.35); expect(consumeDemonHunterDefense(s, r, 'CORRUPTION_PULSE', 48)).toBeNull();
    expect(resolveDemonHunterEnemyAbility(s, 'CINDER_LUNGE', 1, r).selfGain).toBeCloseTo(56 * .35);
    const low = fixture(); low.spirituality = 2; const failed = beginDemonHunterCombatRound(low, 'DEFEND'); expect(failed.paidGuard).toBe(false); expect(effect(low, H, failed).selfGain).toBe(0); expect(low.spirituality).toBe(2);
  });
  it('finite enemy spends exactly5/3/4 and exhausts into body actions without a refill', () => {
    const s = fixture(), r = beginDemonHunterCombatRound(s, 'ATTACK');
    expect(resolveDemonHunterEnemyAbility(s, 'CORRUPTION_PULSE', 1, r).selfGain).toBe(48);
    expect(resolveDemonHunterEnemyAbility(s, 'CINDER_GUARD', 1, r).enemyReduction).toBe(30);
    expect(resolveDemonHunterEnemyAbility(s, 'CINDER_LUNGE', 1, r).selfGain).toBe(42); expect(s.demonHunter.encounter.enemySpirituality).toBe(24);
    for (let i = 0; i < 8; i++) resolveDemonHunterEnemyAbility(s, 'CINDER_GUARD', 1, r);
    expect(s.demonHunter.encounter.enemySpirituality).toBe(0); const fallback = resolveDemonHunterEnemyAbility(s, 'CORRUPTION_PULSE', 1, r);
    expect(fallback.selfGain).toBe(13.5); expect(fallback.label).toContain('明确回退'); expect(s.demonHunter.encounter.enemySpirituality).toBe(0);
  });
});

describe('Finite encounter preparation, real shared rounds and persistent outcomes', () => {
  it('charges one120p preparation, keeps exact original materials, rejects repeat supplies and does not move life probes', () => {
    const s = fixture(false); expect(demonHunterEncounterReason(s, { type: 'PREPARE_HUNT' })).toContain('报告');
    s.demonHunter.life.cases['tailored-coating'].status = 'RESOLVED'; const life = structuredClone(s.demonHunter.life), ap = s.actionsRemaining;
    applyDemonHunterEncounterCommand(s, { type: 'PREPARE_HUNT' }, context()); expect(s.cash).toBe(380); expect(s.actionsRemaining).toBe(ap - 1); expect(s.demonHunter.life).toEqual(life);
    expect(projectDemonHunterEncounter(s).encounter?.coatingsRemaining).toBe(2); expect(() => applyDemonHunterEncounterCommand(s, { type: 'PREPARE_HUNT' }, context())).toThrow(); expect(validateDemonHunterEncounter(s)).toBe(true);
    expect(validateDemonHunterEncounterCommand({ type: 'PREPARE_HUNT', free: true })).toBe(false);
  });
  it('ordinary TALK is actual withdrawal, not compelled peace or a fake victory', () => {
    const s = fixture(false, true), oldGuardian = structuredClone(s.guardian); applyDemonHunterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.demonHunter.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 36, terminal: null });
    expect(s.guardian).toEqual(oldGuardian); expect(validateDemonHunterEncounter(s)).toBe(true); expect(() => applyDemonHunterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow();
  });
  it('shared guard round preserves the full source and costs, does not injure an enemy on a defensive win', () => {
    const s = fixture(); s.spirituality = 80;
    const result = round(s, 'DEFEND', 1, 1, ticket(H, 'DEFEND'), 76, 76, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyInjuries).toEqual([]); expect(s.spirituality).toBe(89);
    expect(result.round.playerAdvantage).toBeCloseTo(1270 * .95); expect(result.round.enemyAdvantage).toBeCloseTo(870 + 18 * .35 * 2);
    expect(result.round.demonHunterOutcome).toMatchObject({ targetId: 'DH4-CINDER-GUARD', playerSpiritualityBefore: 80, playerSpiritualityAfter: 77, enemySpiritualityBefore: 36, enemySpirituality: 36, defending: true, paidGuard: true });
    expect(validateDemonHunterRoundOutcome(result.round.demonHunterOutcome)).toBe(true); expect(validateDemonHunterEncounter(s)).toBe(true);
    const bad = structuredClone(result.round.demonHunterOutcome!); bad.enemySpirituality = 37; expect(validateDemonHunterRoundOutcome(bad)).toBe(false);
  });
  it('records actual observation and source spending before ordinary continuing-round player recovery', () => {
    const s = fixture(); s.spirituality = 80;
    const result = round(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 31, 1_000_000, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.spirituality).toBe(88); expect(s.demonHunter.encounter.enemySpirituality).toBe(28);
    expect(result.round.demonHunterOutcome).toMatchObject({ playerSpiritualityBefore: 80, playerSpiritualityAfter: 76, weaknessObservedRound: 1, powerUses: { CORRUPTION_PULSE: 1, CINDER_GUARD: 1, CINDER_LUNGE: 0 } });
    expect(validateDemonHunterEncounter(s)).toBe(true);
  });
  it('settles genuine injury surrender with canonical key order, retains body/resources and rewards at most once', () => {
    const s = fixture(), old = structuredClone(s.guardian);
    const result = round(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 96, 96, 1, 70); expect(result.outcome).toBe('ENEMY_SURRENDERED');
    const award = vi.fn((source: string) => s.seer.completedSources.push(source)); s.combat!.lastRound = JSON.parse(stableStringify(s.combat!.lastRound));
    settleDemonHunterEncounter(s, result.outcome, context(), award); expect(award).toHaveBeenCalledExactlyOnceWith('demon-hunter-dispute', 25);
    expect(s.demonHunter.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemySpirituality: 34, swordReady: false, terminal: { outcome: 'ENEMY_SURRENDERED' } });
    expect(s.guardian).toEqual(old); expect(validateDemonHunterEncounter(JSON.parse(stableStringify(s)) as SliceState)).toBe(true);
    expect(() => settleDemonHunterEncounter(s, result.outcome, context(), award)).toThrow();
    const forged = structuredClone(s); forged.demonHunter.encounter.enemySpirituality++; expect(validateDemonHunterEncounter(forged)).toBe(false);
  });
  it('retreat keeps unused original charges and actual original target, without revival or rewards', () => {
    const s = fixture(true, true); const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED');
    settleDemonHunterEncounter(s, result.outcome, context()); expect(s.demonHunter.encounter.coatings.every(c => c.status === 'SEALED')).toBe(true);
    expect(s.demonHunter.encounter.enemySpirituality).toBe(36); expect(s.demonHunter.encounter.status).toBe('RETREATED'); expect(validateDemonHunterEncounter(s)).toBe(true);
  });
  it('dormant exact defaults survive canonical ordering and refuse forged resources', () => {
    const s = createSliceRun('demon-hunter-dormant', sliceDefaultCreationSelection, 'dormant');
    s.demonHunter.encounter = JSON.parse(stableStringify(createDemonHunterEncounterState())); expect(validateDemonHunterEncounter(s)).toBe(true);
    s.demonHunter.encounter.enemySpirituality = 35; expect(validateDemonHunterEncounter(s)).toBe(false);
  });
});
