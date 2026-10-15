import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createDespairState } from '../../src/domain/despair/index.js';
import { playerAbilityWheel, playerCountWheel, consequenceWeights, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DESPAIR_COUNT_WHEEL, DESPAIR_ENEMY_COUNT_WHEEL, despairAbilityWheel, despairActionCount, despairEnemyActionCount,
  drawDespairAbility, drawDespairEnemyAbility, currentDespairCombatSource, beginDespairCombatRound, resolveDespairCombatAbility,
  resolveDespairEnemyAbility, validateDespairRoundOutcome, type DespairMoveId, type DespairRoundContext } from '../../src/domain/despair/combat.js';
import { applyDespairEncounterCommand, createDespairEncounterState, despairEncounterReason, hasDespairDisputeOpponent,
  projectDespairEncounter, settleDespairEncounter, validateDespairEncounter, validateDespairEncounterCommand } from '../../src/domain/despair/encounter.js';
import { TRAVELER_COUNT_WHEEL } from '../../src/domain/traveler/combat.js';

const H = 'assassin.s7.black-flame', J = 'assassin.s7.frost', B = 'assassin.s7.substitute', K = 'assassin.s4.plague', R = 'assassin.s6.silk-binding';
const profile: readonly [DespairMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: DespairMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'despair-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed unit fixture; natural acquisition and prior Oren history are checked separately. */
function fixture(start = true): SliceState {
  const s = createSliceRun('despair-combat-directed', sliceDefaultCreationSelection, 'despair-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 90; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'demoness', sequence: 4, mastery: { [H]: 0, [J]: 0, [B]: 0, [K]: 0, [R]: 0 }, acting: 0, promotionWeek: 90 };
  s.despair = createDespairState(); s.despair.promotionWeek = 90; s.despair.painActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.despair.life.cases['room-clearance'].status = 'RESOLVED';
  if (start) applyDespairEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: DespairMoveId, r = beginDespairCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolveDespairCombatAbility(s, id, physical, rng, r);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
function quietRound(s: SliceState) {
  const odd = s.combat!.round % 2 === 1, first = s.despair.encounter.diseaseApplications === 0;
  return play(s, 'CONTROL', 1, 1, ...(odd ? [ticket(K, 'CONTROL'), ...(first ? [1] : []), 96, 96] : [96, ticket(K, 'CONTROL'), 96]), 1);
}
function symptomatic(strength = 3) { const s = fixture(); for (let i = 0; i < strength; i++) quietRound(s); return s; }
afterEach(() => vi.restoreAllMocks());

describe('Despair finite actual source and six-slot profile', () => {
  it('uses actual Traveler counts, enemy2–4 counts and six exact neutral weights', () => {
    const s = fixture(); expect(DESPAIR_COUNT_WHEEL).toEqual(TRAVELER_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(DESPAIR_COUNT_WHEEL);
    expect(despairAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(despairAbilityWheel(s, null));
    for (const [id] of profile) expect(drawDespairAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 11, 26, 51, 76, 91].map(despairActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(DESPAIR_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]); expect([1, 20, 21, 70, 71, 100].map(despairEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect([1, 31, 56, 76, 96].map(n => drawDespairEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'FROST_GUARD', 'SPRINT_STRIKE', 'BODY_STRIKE', 'ACCIDENT']);
    expect(consequenceWeights(0)).toEqual({ light: 65, heavy: 30, death: 5 });
  });
  it('starts a separate original Valen with finite resources and exact no-bystander scene', () => {
    const s = fixture(); expect(s.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyHealth: 100, enemySpirituality: 40, enemyDisease: 0, fieldActive: false });
    expect(currentDespairCombatSource(s)).toMatchObject({ distanceMetres: 4, fieldRadiusMetres: 10, noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false, enemyWeapon: 'DP4-VALEN-CLUB' });
    expect(hasDespairDisputeOpponent(s)).toBe(true); expect(validateDespairEncounter(s)).toBe(true);
    const publicEnemy = projectDespairEncounter(s).encounter!; expect(publicEnemy.abilities).toHaveLength(3); expect(publicEnemy.abilities.map(a => a.cost)).toEqual([5, 3, 4]);
  });
  it('rejects stale original source, other encounters and counterfeit targets before spending', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; }]) {
      const s = fixture(), r = beginDespairCombatRound(s, 'ATTACK'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'FIRST_CASE'; expect(currentDespairCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow('原');
    s.combat!.encounterId = 'DESPAIR_DISPUTE'; s.despair.encounter.targetId = 'REVIVED-OREN' as never; expect(currentDespairCombatSource(s)).toBeNull();
  });
  it('ordinary refusal really ends the finite meeting without exposure, reward or rebirth', () => {
    const s = fixture(false), before = structuredClone(s.pain); applyDespairEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.despair.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40, enemyDisease: 0 });
    expect(s.pain).toEqual(before); expect(s.actionsRemaining).toBe(5); expect(validateDespairEncounter(s)).toBe(true);
    expect(() => applyDespairEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(despairEncounterReason(s, { type: 'ENCOUNTER_AID' })).not.toBeNull();
  });
});

describe('Actual original inherited tools and silk', () => {
  it('consumes real mirror then powder, falls back ordinary, never resets prior stock', () => {
    const s = fixture(); s.witch.tools = { kitsBought: 1, powderHeld: 1, powderUsed: 2, mirrorsHeld: 1, mirrorsUsed: 0, lastPurchaseWeek: 89, mirrorPrepared: true };
    const r = beginDespairCombatRound(s, 'ATTACK'); expect(effect(s, B, r).enemyReduction).toBeCloseTo(42.25 * .65);
    expect(s.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 1, mirrorPrepared: false });
    expect(effect(s, B, r).enemyReduction).toBeCloseTo(21.125 * .65); expect(s.witch.tools).toMatchObject({ powderHeld: 0, powderUsed: 3 });
    expect(effect(s, B, r).enemyReduction).toBe(10); expect(s.spirituality).toBe(115); expect(s.progression.mastery[B]).toBe(0);
  });
  it('preserves real60p/3powder/1mirror supply arithmetic and bounded next-week stock', () => {
    const s = fixture(false), t = s.witch.tools; const old = structuredClone(t);
    applyDespairEncounterCommand(s, { type: 'BUY_SUPPLIES' }, context()); expect(t.kitsBought).toBe(old.kitsBought + 1); expect(t.powderHeld).toBe(old.powderHeld + 3); expect(t.mirrorsHeld).toBe(old.mirrorsHeld + 1); expect(s.cash).toBe(940);
    const ap = s.actionsRemaining; applyDespairEncounterCommand(s, { type: 'PREPARE_MIRROR' }, context()); expect(s.actionsRemaining).toBe(ap); expect(s.spirituality).toBe(120);
    expect(() => applyDespairEncounterCommand(s, { type: 'BUY_SUPPLIES' }, context())).toThrow('本周');
    s.week++; applyDespairEncounterCommand(s, { type: 'BUY_SUPPLIES' }, context()); s.week++; applyDespairEncounterCommand(s, { type: 'BUY_SUPPLIES' }, context());
    s.week++; expect(() => applyDespairEncounterCommand(s, { type: 'BUY_SUPPLIES' }, context())).toThrow('三包');
  });
  it('uses inherited black flame or held ordinary club and fixed negative accident', () => {
    const s = fixture(), r = beginDespairCombatRound(s, 'ATTACK'); expect(effect(s, H, r).selfGain).toBeCloseTo(59.15 * .65); expect(s.spirituality).toBe(118);
    expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5);
    const held = fixture(); held.town.clubLocation = 'HAND'; expect(effect(held, H).selfGain).toBe(16); expect(held.spirituality).toBe(120);
  });
  it('requires separate real3S setup and3S resisted binding; modifies only one body hit', () => {
    const s = fixture(), r = beginDespairCombatRound(s, 'ATTACK'); effect(s, R, r); expect(s.despair.encounter.silkPrepared).toBe(true);
    effect(s, R, r, random(1)); expect(s.spirituality).toBe(114); expect(s.despair.encounter.boundRound).toBe(1);
    expect(resolveDespairEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55); expect(s.despair.encounter.boundRound).toBe(1);
    expect(resolveDespairEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(9); expect(s.despair.encounter.boundRound).toBeNull();
    expect(resolveDespairEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(18);
    effect(s, R, r); effect(s, R, r, random(100)); expect(s.despair.encounter.boundRound).toBeNull();
  });
});

describe('Progressive finite supernatural plague and real enemy spell window', () => {
  it('charges failed start, permits a later true attempt, and never grows twice from repeated K', () => {
    const s = fixture(), r = beginDespairCombatRound(s, 'CONTROL'); effect(s, K, r, random(100)); expect(s.spirituality).toBe(116); expect(s.despair.encounter.enemyDisease).toBe(0);
    effect(s, K, r, random(1)); expect(s.spirituality).toBe(112); expect(s.despair.encounter.enemyDisease).toBe(1);
    expect(effect(s, K, r).enemyReduction).toBe(10); beginDespairCombatRound(s, 'CONTROL'); expect(s.spirituality).toBe(112); expect(s.despair.encounter.enemyDisease).toBe(1);
  });
  it('actual subsequent rounds grow once to6 and defend stops upkeep before growth while preserving symptoms', () => {
    const s = symptomatic(6); expect(s.despair.encounter.enemyDisease).toBe(6); expect(s.despair.encounter.fieldActive).toBe(true);
    quietRound(s); expect(s.despair.encounter.enemyDisease).toBe(6); expect(s.despair.encounter.diseaseApplications).toBe(1);
    const oldS = s.spirituality, r = beginDespairCombatRound(s, 'DEFEND'); expect(s.spirituality).toBe(oldS); expect(s.despair.encounter.fieldActive).toBe(false); expect(s.despair.encounter.enemyDisease).toBe(6);
    effect(s, K, r); expect(s.spirituality).toBe(oldS); expect(s.despair.encounter.fieldActive).toBe(false);
  });
  it('insufficient upkeep stops exposure without clearing existing infection or granting resources', () => {
    const s = symptomatic(2); s.spirituality = 1; beginDespairCombatRound(s, 'ATTACK'); expect(s.spirituality).toBe(1); expect(s.despair.encounter.fieldActive).toBe(false); expect(s.despair.encounter.enemyDisease).toBe(2);
  });
  it('only the first actual affordable spell can be interrupted, spends its real cost, and other slots still execute', () => {
    const s = symptomatic(2); // Next real round is3, upkeep reaches3 before actions.
    const result = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 31, 1);
    const o = result.round.despairOutcome!; expect(o.enemyDisease).toBe(3); expect(o.enemyActions).toEqual([
      { planned: 'ARC_BOLT', actual: 'INTERRUPTED', paidCost: 5, diseaseAtAction: 3, symptomChance: 40, symptomRoll: 1, interrupted: true },
      { planned: 'FROST_GUARD', actual: 'FROST_GUARD', paidCost: 3, diseaseAtAction: 3, symptomChance: null, symptomRoll: null, interrupted: false },
    ]); expect(o.enemySpirituality).toBe(32); expect(o.interruptionCount).toBe(1); expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(2);
    expect(validateDespairRoundOutcome(o)).toBe(true); expect(validateDespairEncounter(s)).toBe(true);
  });
  it('resistance can fail, preserves completed spell, and never manufactures a spell on ordinary/empty-SP slots', () => {
    const s = symptomatic(3), r = beginDespairCombatRound(s, 'DEFEND'); // Existing3 persists after stop.
    expect(resolveDespairEnemyAbility(s, 'ARC_BOLT', 1, random(100), r).selfGain).toBe(55);
    expect(resolveDespairEnemyAbility(s, 'FROST_GUARD', 1, random(), r).enemyReduction).toBe(30); expect(s.despair.encounter.interruptionCount).toBe(0);
    s.despair.encounter.enemySpirituality = 0; const rng = random(); expect(resolveDespairEnemyAbility(s, 'ARC_BOLT', 1, rng, r).selfGain).toBeCloseTo(18 * .85); expect(rng.cursor).toBe(0);
    expect(r.enemyActions.at(-1)).toMatchObject({ planned: 'ARC_BOLT', actual: 'BODY_STRIKE', paidCost: 0, symptomRoll: null });
  });
  it('limits disease body reduction to30percent and does not directly damage either body', () => {
    const s = symptomatic(6), r = beginDespairCombatRound(s, 'DEFEND'); expect(resolveDespairEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBeCloseTo(12.6);
    expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100); expect(s.despair.encounter.enemyDisease).toBe(6);
  });
  it('depletes finite original40SP without refill and records real fallback', () => {
    const s = fixture(), r = beginDespairCombatRound(s, 'ATTACK'); for (let i = 0; i < 8; i++) resolveDespairEnemyAbility(s, 'ARC_BOLT', 1, random(), r);
    expect(s.despair.encounter.enemySpirituality).toBe(0); expect(s.despair.encounter.powerUses.ARC_BOLT).toBe(8);
    expect(resolveDespairEnemyAbility(s, 'FROST_GUARD', 1, random(), r).selfGain).toBe(18); expect(s.despair.encounter.enemySpirituality).toBe(0);
  });
});

describe('Shared injury wheel, terminal continuity and actual finite follow-up', () => {
  it('uses real common light/heavy/death outcomes and never treats plague as guaranteed damage', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 96, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(validateDespairRoundOutcome(result.round.despairOutcome)).toBe(true);
    }
  });
  it('player death and already-injured defeats retain the shared risk wheel, not a disease-specific injury shortcut', () => {
    const dead = fixture(), death = play(dead, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 96, 1_000_000, 96);
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dead.health).toBe(0); expect(dead.despair.encounter.enemyHealth).toBe(100);
    dead.status = 'DEAD'; settleDespairEncounter(dead, death.outcome, context()); expect(validateDespairEncounter(dead)).toBe(true);
    expect(despairEncounterReason(dead, { type: 'ENCOUNTER_AID' })).not.toBeNull();
    const hurt = fixture(); hurt.injuries.push({ id: 'prior-real-injury', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const loss = play(hurt, 'ATTACK', 1, 1, ticket(B, 'ATTACK'), 76, 96, 1_000_000, 56);
    expect(loss.round.consequenceWeights).toEqual(consequenceWeights(1)); expect(hurt.injuryRisk).toBe(1); expect(hurt.health).toBe(70);
  });
  it('failed ordinary retreat still stops exposure before the enemy acts and cannot clear symptoms', () => {
    const s = symptomatic(3), before = s.spirituality;
    const result = play(s, 'RETREAT', 1, 1, 76, 100, 76, 1_000_000, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.retreat).toBe('FAILURE');
    expect(result.round.despairOutcome).toMatchObject({ enemyDisease: 3, fieldActive: false, playerSpiritualityBefore: before, playerSpiritualityAfter: before });
    expect(s.health).toBe(90); expect(validateDespairEncounter(s)).toBe(true);
    quietRound(s); expect(s.despair.encounter.enemyDisease).toBe(3); expect(s.despair.encounter.fieldActive).toBe(false);
  });
  it('successful actual retreat preserves infection, stops the field and supports only paid distinct-week original-person visits', () => {
    const s = symptomatic(5); // Round6 enemy goes first; one ordinary miss, then actual exit.
    const result = play(s, 'RETREAT', 1, 1, 96, 1); expect(result.outcome).toBe('RETREATED'); expect(s.despair.encounter.enemyDisease).toBe(5);
    settleDespairEncounter(s, result.outcome, context()); expect(validateDespairEncounter(s)).toBe(true); expect(s.combat).toBeNull();
    const health = s.despair.encounter.enemyHealth, oldCash = s.cash;
    applyDespairEncounterCommand(s, { type: 'ENCOUNTER_AID' }, context()); expect(s.despair.encounter.enemyDisease).toBe(3); expect(s.cash).toBe(oldCash - 60); expect(validateDespairEncounter(s)).toBe(true);
    expect(() => applyDespairEncounterCommand(s, { type: 'ENCOUNTER_AID' }, context())).toThrow('本周');
    s.week++; applyDespairEncounterCommand(s, { type: 'ENCOUNTER_AID' }, context()); expect(s.despair.encounter.enemyDisease).toBe(1);
    s.week++; applyDespairEncounterCommand(s, { type: 'ENCOUNTER_AID' }, context()); expect(s.despair.encounter.enemyDisease).toBe(0);
    expect(s.despair.encounter.enemyHealth).toBe(health); expect(s.despair.encounter.terminal!.enemyDisease).toBe(5); expect(validateDespairEncounter(s)).toBe(true);
    expect(despairEncounterReason(s, { type: 'ENCOUNTER_AID' })).not.toBeNull(); expect(s.despair.encounter.careVisits).toHaveLength(3);
  });
  it('terminal enemy death remains dead and cannot be aided, replayed or replaced by old Oren', () => {
    const s = fixture(), old = structuredClone(s.pain), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 96, 96, 1, 100);
    settleDespairEncounter(s, result.outcome, context()); expect(s.despair.encounter.enemyStatus).toBe('DEAD'); expect(validateDespairEncounter(s)).toBe(true);
    expect(despairEncounterReason(s, { type: 'ENCOUNTER_AID' })).not.toBeNull(); expect(() => applyDespairEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s.pain).toEqual(old);
  });
  it('round snapshots and finite original resource/care conservation reject forged saves', () => {
    const s = symptomatic(3); expect(validateDespairEncounter(s)).toBe(true);
    for (const change of [(x: SliceState) => { x.despair.encounter.enemySpirituality++; }, (x: SliceState) => { x.despair.encounter.enemyDisease = 0; }, (x: SliceState) => { x.despair.encounter.interruptionCount++; }, (x: SliceState) => { x.combatHistory.at(-1)!.despairOutcome!.enemyActions[0]!.actual = 'INTERRUPTED'; }]) {
      const bad = structuredClone(s); change(bad); expect(validateDespairEncounter(bad)).toBe(false);
    }
    const original = createDespairEncounterState(); expect(original.enemySpirituality).toBe(40); expect(validateDespairEncounterCommand({ type: 'ENCOUNTER_AID', cured: true })).toBe(false);
  });
});
