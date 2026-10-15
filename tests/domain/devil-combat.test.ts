import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createDevilState } from '../../src/domain/devil/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveDevilCombatRound } from '../../src/domain/slice/devil-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DEVIL_COUNT_WHEEL, DEVIL_ENEMY_COUNT_WHEEL, DEVIL_ENEMY_ABILITY_WHEEL,
  devilAbilityWheel, devilActionCount, devilEnemyActionCount, drawDevilAbility, drawDevilEnemyAbility,
  currentDevilCombatSource, beginDevilCombatRound, resolveDevilCombatAbility, resolveDevilEnemyAbility,
  finishDevilCombatRound, validateDevilRoundOutcome, projectDevilCombat, type DevilMoveId } from '../../src/domain/devil/combat.js';
import { applyDevilEncounterCommand, devilEncounterReason, hasDevilDisputeOpponent,
  projectDevilEncounter, settleDevilEncounter, validateDevilEncounter, validateDevilEncounterCommand } from '../../src/domain/devil/encounter.js';
import { DESIRE_APOSTLE_COUNT_WHEEL } from '../../src/domain/desire-apostle/combat.js';

const H = 'abyss.s6.flame-hex', J = 'BODY_FOLLOWUP', B = 'abyss.s6.demonic-body', K = 'abyss.s4.desire-focus', R = 'OBSERVE';
const profile: readonly [DevilMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: DevilMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'devil-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Isolated directed unit fixture; never presented as naturally acquired promotion or life progress. */
function fixture(start = true): SliceState {
  const s = createSliceRun('devil-combat-directed', sliceDefaultCreationSelection, 'devil-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'abyss', sequence: 4, mastery: { [H]: 0, [B]: 0, [K]: 0, 'abyss.s4.catalytic-pressure': 0 }, acting: 0, promotionWeek: 110 };
  s.devil = createDevilState(); s.devil.promotionWeek = 110; s.devil.desireApostleActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.devil.life.cases['stage-decision'].status = 'RESOLVED';
  if (start) applyDevilEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: DevilMoveId, r = beginDevilCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolveDevilCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolveDevilEnemyAbility>[1], r: ReturnType<typeof beginDevilCombatRound>, physical = 1) {
  return resolveDevilEnemyAbility(s, id, physical, random(), r);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveDevilCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Devil inherited profile and original encounter', () => {
  it('keeps inherited1–6 and six-slot stance weights, with actual2–4 enemy actions', () => {
    const s = fixture(); expect(DEVIL_COUNT_WHEEL).toEqual(DESIRE_APOSTLE_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(DEVIL_COUNT_WHEEL);
    expect(devilAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(devilAbilityWheel(s, null));
    for (const [id] of profile) expect(drawDevilAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(devilActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DEVIL_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(devilEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(DEVIL_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawDevilEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('uses actual ABYSS35/30/15/20 core,1250/floor125, enemy850/floor85', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .35 + 20 * .3 + 30 * .15 + 40 * .2, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40)); expect(result.round.consequenceWeights).toBeNull();
    expect(validateDevilEncounter(s)).toBe(true);
  });
  it('starts original Orrick without reopening old Ferran or Morton or their resources', () => {
    const s = fixture(false), old = structuredClone({ desire: s.desireApostle, demon: s.demon });
    applyDevilEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.desireApostle).toEqual(old.desire); expect(s.demon).toEqual(old.demon);
    expect(currentDevilCombatSource(s)).toMatchObject({ targetId: 'DV4-ORRICK-FANE', distanceMetres: 4, targetSequence: 5,
      noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false, emotion: 'STRONG', enemyWeapon: 'DV4-ORRICK-CLUB' });
    expect(hasDevilDisputeOpponent(s)).toBe(true); expect(validateDevilEncounter(s)).toBe(true);
    expect(projectDevilEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3]);
  });
  it('requires actual closed report and ordinary original cleanup, then permits one refusal', () => {
    const s = fixture(false); s.devil.life.cases['stage-decision'].status = 'AVAILABLE';
    expect(devilEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.devil.life.cases['stage-decision'].status = 'RESOLVED'; s.devil.life.invitation.playerNode = 'SHELF';
    expect(devilEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('关闭');
    s.devil.life.invitation.playerNode = 'GUIDE'; s.desireApostle.practice.ledger = 'PLAYER';
    expect(devilEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('账册');
    s.desireApostle.practice.ledger = 'GUIDE'; applyDevilEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.devil.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(s.actionsRemaining).toBe(5); expect(validateDevilEncounter(s)).toBe(true);
    expect(() => applyDevilEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateDevilEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
  it('rejects stale source, resource mutation, fabricated body and wrong encounter before costs or draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.mind--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.demon.strain++; }, (s: SliceState) => { s.spirituality--; }]) {
      const s = fixture(), r = beginDevilCombatRound(s, 'ATTACK'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL');
    expect(resolveDevilCombatAbility(s, K, 1, random(), r, { ...r.source, targetId: 'FERRAN' } as never).selfGain).toBe(0);
    s.combat!.encounterId = 'FIRST_CASE'; expect(currentDevilCombatSource(s)).toBeNull(); expect(() => resolveDevilCombatRound(s, 'ATTACK')).toThrow('原');
  });
});

describe('Actual inherited Demon techniques and persistent finite strain', () => {
  it('pays original flame and hide costs against the same three-point strain cap', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'ATTACK');
    expect(effect(s, H, r).selfGain).toBe(54.925 * .65);
    expect(effect(s, B, r).enemyReduction).toBe(50.7 * .65);
    expect(effect(s, H, r).selfGain).toBe(54.925 * .65);
    expect(effect(s, H, r).selfGain).toBe(12); expect(effect(s, B, r).enemyReduction).toBe(10);
    expect(effect(s, J, r).selfGain).toBe(29.575 * .65);
    expect(s.spirituality).toBe(112); expect(s.demon.strain).toBe(3); expect(s.health).toBe(100);
    const o = finishDevilCombatRound(s, r); expect(o.playerStrainAfter).toBe(3); expect(validateDevilRoundOutcome(o)).toBe(true);
    expect(s.demon.strain).toBe(3); expect(() => finishDevilCombatRound(s, r)).toThrow('结束');
  });
  it('held original club replaces flame entirely, while injured body scales ordinary and hide only', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = beginDevilCombatRound(s, 'ATTACK');
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(s.spirituality).toBe(120); expect(s.demon.strain).toBe(0);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(29.575 * .65 * .5);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(50.7 * .65 * .5);
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it.each([0, 1])('insufficient original spirituality %s never supplies free flame or hide', spirituality => {
    const s = fixture(); s.spirituality = spirituality; const r = beginDevilCombatRound(s, 'ATTACK');
    expect(effect(s, H, r).selfGain).toBe(12); expect(effect(s, B, r).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(spirituality); expect(s.demon.strain).toBe(0);
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('observation and accident grant no resources, no automatic calming and no healing', () => {
    const s = fixture(); s.health = 70; s.demon.strain = 2; const r = beginDevilCombatRound(s, 'PREPARE');
    const before = structuredClone(s); expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5); expect(s).toEqual(before);
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
});

describe('Paid G seed, resistance, catalysis and permanent real calming', () => {
  it('pays4 then3 and halves only the next positive actual BODY or paidARC, leavingWARD intact', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL');
    expect(effect(s, K, r, random(1))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.devil.encounter).toMatchObject({ seedPlanted: true, lastSeedRound: 1, seedAttempts: 1, catalysisAttempts: 0 }); expect(s.spirituality).toBe(116);
    effect(s, K, r, random(1)); expect(s.spirituality).toBe(113); expect(s.devil.encounter.staggerReady).toBe(true);
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(s.devil.encounter.staggerReady).toBe(true);
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(s.devil.encounter.staggerReady).toBe(true);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(27.5); expect(s.devil.encounter.staggerReady).toBe(false);
    expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18); expect(s.devil.encounter.enemySpirituality).toBe(32);
    expect(r.enemyActions.map(a => a.paidCost)).toEqual([3, 0, 5, 0]); expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100);
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('consumes catalysis on a positive body strike once without cancelling its action', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(1)); effect(s, K, r, random(1));
    expect(enemy(s, 'BODY_STRIKE', r, .5).selfGain).toBe(4.5); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55);
    expect(r.enemyActions).toHaveLength(2); expect(s.devil.encounter.enemySpirituality).toBe(35);
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('failed paid seed consumes4 and cannot be reattempted in the same round', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(100)); effect(s, K, r);
    expect(s.spirituality).toBe(116); expect(s.devil.encounter).toMatchObject({ seedPlanted: false, seedAttempts: 1, lastSeedRound: 1, staggerReady: false });
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('resisted catalysis still spends3 and consumes the same original seed, without a free replacement', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(1)); effect(s, K, r, random(100)); effect(s, K, r);
    expect(s.spirituality).toBe(113); expect(s.devil.encounter).toMatchObject({ seedPlanted: false, seedAttempts: 1, catalysisAttempts: 1, staggerReady: false });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('does not overdraw or create paid-attempt history with less than4 spiritual points', () => {
    const s = fixture(); s.spirituality = 3; const r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r);
    expect(s.spirituality).toBe(3); expect(s.devil.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: null, seedAttempts: 0 });
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('can plant with4 while unable to pay subsequent3, leaving only the actual original seed', () => {
    const s = fixture(); s.spirituality = 6; const r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(1)); effect(s, K, r);
    expect(s.spirituality).toBe(2); expect(s.devil.encounter).toMatchObject({ seedPlanted: true, catalysisAttempts: 0, staggerReady: false });
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('COMPOSE executes8 without threat, expires the real seed and permanently removes the entry', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(1));
    expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(s.devil.encounter).toMatchObject({ emotion: 'CALM', seedPlanted: false, composeUses: 1, lastSeedRound: 1 });
    effect(s, K, r); effect(s, R, r); expect(s.spirituality).toBe(116); expect(s.devil.encounter.enemySpirituality).toBe(40);
    expect(devilAbilityWheel(s, null).find(a => a.id === K)!.label).toContain('无情绪入口');
    expect(validateDevilRoundOutcome(finishDevilCombatRound(s, r))).toBe(true);
  });
  it('does not stack paid stagger, and no unused one-round hesitation survives end of round', () => {
    const s = fixture(), r = beginDevilCombatRound(s, 'CONTROL'); effect(s, K, r, random(1)); effect(s, K, r, random(1)); effect(s, K, r);
    expect(s.spirituality).toBe(113); expect(s.devil.encounter.staggerReady).toBe(true);
    const outcome = finishDevilCombatRound(s, r); expect(outcome).toMatchObject({ seedPlanted: false, staggerReady: false, seedAttempts: 1, catalysisAttempts: 1 });
    expect(validateDevilRoundOutcome(outcome)).toBe(true);
  });
  it('retains paid seed for the planting round and next two actual rounds, then expires it without refund', () => {
    const s = fixture();
    play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1);
    expect(s.devil.encounter).toMatchObject({ seedPlanted: true, lastSeedRound: 1 }); expect(validateDevilEncounter(s)).toBe(true);
    play(s, 'PREPARE', 1, 1, 96, ticket(R, 'PREPARE'), 96, 1);
    expect(s.devil.encounter.seedPlanted).toBe(true); expect(validateDevilEncounter(s)).toBe(true);
    play(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 96, 96, 1);
    expect(s.devil.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1, seedAttempts: 1 }); expect(validateDevilEncounter(s)).toBe(true);
    expect(s.combatHistory[0]!.devilOutcome).toMatchObject({ playerSpiritualityBefore: 120, playerSpiritualityAfter: 116 });
  });
  it('reads current emotion after actual even-round enemyCOMPOSE, never a stale prior strong source', () => {
    const s = fixture(); play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1);
    const result = play(s, 'CONTROL', 1, 1, 86, ticket(K, 'CONTROL'), 96, 1);
    expect(result.round.first).toBe('ENEMY'); expect(result.round.devilOutcome!.playerActions[0]!.paidCost).toBe(0);
    expect(result.round.devilOutcome!.enemyActions[0]!.selfGain).toBe(8); expect(s.devil.encounter).toMatchObject({ emotion: 'CALM', seedPlanted: false });
    play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 96, 96, 1);
    expect(s.devil.encounter).toMatchObject({ emotion: 'CALM', seedAttempts: 1, catalysisAttempts: 0, composeUses: 1 }); expect(validateDevilEncounter(s)).toBe(true);
  });
});

describe('Devil common settlement and persistent original action history', () => {
  it('preserves ordinary light/heavy/death outcomes and only continuing12S regeneration', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(), old = structuredClone(s.desireApostle), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(result.round.moves.find(m => m.actor === 'ENEMY')!.enemyReduction).toBe(30); expect(result.round.devilOutcome!.enemySpirituality).toBe(37);
      expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 120 : 117); expect(s.demon.strain).toBe(1); expect(s.desireApostle).toEqual(old);
      expect(validateDevilRoundOutcome(result.round.devilOutcome)).toBe(true);
      if (outcome !== 'CONTINUE') settleDevilEncounter(s, outcome, context()); expect(validateDevilEncounter(s)).toBe(true);
    }
  });
  it('paid catalysis contributes no instant damage; shared action order preserves actual spell cost', () => {
    const s = fixture(), result = play(s, 'CONTROL', 13, 1, ticket(K, 'CONTROL'), 1, 36, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100);
    expect(result.round.devilOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain, a.enemyReduction])).toEqual([['WARD', 3, 0, 30], ['ARC_BOLT', 5, 27.5, 0]]);
    expect(result.round.devilOutcome!.playerSpiritualityAfter).toBe(113); expect(validateDevilEncounter(s)).toBe(true);
  });
  it('enemy original40 spiritual points truly deplete, then same planned spells use its original body', () => {
    const s = fixture();
    play(s, 'DEFEND', 1, 100, ticket(B, 'DEFEND'), 1, 1, 1, 1, 1);
    play(s, 'DEFEND', 1, 100, 1, ticket(B, 'DEFEND'), 1, 1, 1, 1);
    expect(s.devil.encounter.enemySpirituality).toBe(0); expect(s.devil.encounter.powerUses.ARC_BOLT).toBe(8);
    const result = play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 36, 1);
    expect(result.round.devilOutcome!.enemyActions.map(a => [a.actual, a.paidCost])).toEqual([['BODY_STRIKE', 0], ['BODY_STRIKE', 0]]);
    expect(s.devil.encounter.enemySpirituality).toBe(0); expect(s.demon.strain).toBe(3); expect(validateDevilEncounter(s)).toBe(true);
    const fourth = play(s, 'DEFEND', 1, 1, 96, ticket(B, 'DEFEND'), 96, 1);
    expect(fourth.round.devilOutcome!.playerActions[0]!).toMatchObject({ paidCost: 0, strainCost: 0, enemyReduction: 10 }); expect(validateDevilEncounter(s)).toBe(true);
  });
  it('terminal surrender expires an unused paid seed, preserves recorded attempt and pays no regeneration', () => {
    const s = fixture(), result = play(s, 'CONTROL', 13, 1, ticket(K, 'CONTROL'), 1, 96, ticket(H, 'CONTROL'), 96, 1, 66);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.spirituality).toBe(113); expect(s.devil.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1, seedAttempts: 1 });
    settleDevilEncounter(s, result.outcome, context()); expect(validateDevilEncounter(s)).toBe(true); expect(s.devil.encounter.enemyHealth).toBe(70);
  });
  it('successful ordinary retreat closes once without resetting the original resources or history', () => {
    const s = fixture(); play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1);
    const result = play(s, 'RETREAT', 1, 1, 36, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.devil.encounter).toMatchObject({ seedPlanted: false, lastSeedRound: 1, enemySpirituality: 37 });
    settleDevilEncounter(s, result.outcome, context()); expect(validateDevilEncounter(s)).toBe(true); expect(s.combat).toBeNull();
    expect(() => applyDevilEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
  });
  it('common player death remains real and closes all temporary effects', () => {
    const s = fixture(), result = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 96, 1_000_000, 96);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(116);
    expect(s.devil.encounter.seedPlanted).toBe(false); s.status = 'DEAD'; settleDevilEncounter(s, result.outcome, context());
    expect(s.devil.encounter.status).toBe('LOST'); expect(validateDevilEncounter(s)).toBe(true);
  });
  it('rejects forged seed, reset strain, changed paid enemy cost and rewritten current emotion', () => {
    const s = fixture(), result = play(s, 'CONTROL', 13, 1, ticket(K, 'CONTROL'), 1, 36, ticket(K, 'CONTROL'), 1, 1, 1);
    for (const mutate of [
      (o: NonNullable<typeof result.round.devilOutcome>) => { o.seedPlanted = true; },
      (o: NonNullable<typeof result.round.devilOutcome>) => { o.enemyActions[1]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.devilOutcome>) => { o.enemyActions[1]!.selfGain = 55; },
      (o: NonNullable<typeof result.round.devilOutcome>) => { o.playerActions[0]!.paidCost = 0; },
    ]) { const o = structuredClone(result.round.devilOutcome!); mutate(o); expect(validateDevilRoundOutcome(o)).toBe(false); }
    const clone = structuredClone(s); clone.devil.encounter.emotion = 'CALM'; expect(validateDevilEncounter(clone)).toBe(false);
    const withStrain = fixture(); play(withStrain, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 96, 96, 1, 1);
    withStrain.demon.strain = 0; expect(validateDevilEncounter(withStrain)).toBe(false);
  });
  it('exposes current original resources and G source limits without inferring unknown abilities', () => {
    const s = fixture(), p = projectDevilCombat(s); expect(p).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemySpirituality: 40, emotion: 'STRONG', strain: 0, pursuit: false });
    expect(p.summary).toContain('完整原著4级技能仍未知'); expect(p.source!.enemyWeapon).toBe('DV4-ORRICK-CLUB');
  });
});
