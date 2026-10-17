import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createFallenEarlState } from '../../src/domain/fallen-earl/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveFallenEarlCombatRound } from '../../src/domain/slice/fallen-earl-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { FALLEN_EARL_COUNT_WHEEL, FALLEN_EARL_ENEMY_COUNT_WHEEL, FALLEN_EARL_ENEMY_ABILITY_WHEEL,
  fallenEarlAbilityWheel, fallenEarlActionCount, fallenEarlEnemyActionCount, drawFallenEarlAbility, drawFallenEarlEnemyAbility,
  currentFallenEarlCombatSource, beginFallenEarlCombatRound, resolveFallenEarlCombatAbility, resolveFallenEarlEnemyAbility,
  finishFallenEarlCombatRound, validateFallenEarlRoundOutcome, projectFallenEarlCombat, type FallenEarlMoveId } from '../../src/domain/fallen-earl/combat.js';
import { applyFallenEarlEncounterCommand, fallenEarlEncounterReason, hasFallenEarlDisputeOpponent,
  projectFallenEarlEncounter, settleFallenEarlEncounter, validateFallenEarlEncounter, validateFallenEarlEncounterCommand } from '../../src/domain/fallen-earl/encounter.js';
import { MENTOR_DISORDER_COUNT_WHEEL } from '../../src/domain/mentor-disorder/combat.js';

const H = 'black-emperor.s4.magnify', J = 'BODY_FOLLOWUP', B = 'black-emperor.s7.bribery-weakening', K = 'black-emperor.s4.bestow', R = 'black-emperor.s4.exploit';
const profile: readonly [FallenEarlMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: FallenEarlMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'fallen-earl-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed combat setup only; promotion and the unchanged original prefix have separate public-command coverage. */
function fixture(start = true): SliceState {
  const s = createSliceRun('fallen-earl-combat-directed', sliceDefaultCreationSelection, 'fallen-earl-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'black-emperor', sequence: 4, mastery: { [H]: 0, [K]: 0, [R]: 0, [B]: 0,
    'black-emperor.s8.enhanced-body': 0, 'black-emperor.s9.weak-point-insight': 0 }, acting: 0, promotionWeek: 110 };
  s.fallenEarl = createFallenEarlState(); s.fallenEarl.promotionWeek = 110; s.fallenEarl.mentorDisorderActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.mentorDisorder.encounter.status = 'RESOLVED';
  s.briber.giftPacks = 1; s.briber.gifts = [
    { id: 'BR7-GIFT-1', location: 'GIVEN', destination: 'BATTLE:MENTOR_DISORDER_DISPUTE:GROUND', givenWeek: 84 },
    { id: 'BR7-GIFT-2', location: 'PLAYER', destination: null, givenWeek: null },
    { id: 'BR7-GIFT-3', location: 'PLAYER', destination: null, givenWeek: null },
  ];
  s.fallenEarl.life.cases['willing-pause'].status = 'RESOLVED';
  if (start) applyFallenEarlEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginFallenEarlCombatRound(s, stance, random()); }
function effect(s: SliceState, id: FallenEarlMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) {
  return resolveFallenEarlCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolveFallenEarlEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) {
  return resolveFallenEarlEnemyAbility(s, id, physical, random(), r);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveFallenEarlCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Fallen Earl finite profile and one actual Marlow', () => {
  it('keeps old5 counts and30/15/25/10/15/5 weights with2–4 actual enemy actions', () => {
    const s = fixture(); expect(FALLEN_EARL_COUNT_WHEEL).toEqual(MENTOR_DISORDER_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(FALLEN_EARL_COUNT_WHEEL);
    expect(fallenEarlAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(fallenEarlAbilityWheel(s, null));
    for (const [id] of profile) expect(drawFallenEarlAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(fallenEarlActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(FALLEN_EARL_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(fallenEarlEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(FALLEN_EARL_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawFallenEarlEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('preserves black-emperor35/15/20/30 core,1250/floor125 and enemy850/floor85', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .35 + 20 * .15 + 30 * .2 + 40 * .3, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40) - 45); expect(result.round.consequenceWeights).toBeNull();
    expect(validateFallenEarlEncounter(s)).toBe(true);
  });
  it('keeps original Rees and all existing gifts while creating an independent living opponent', () => {
    const s = fixture(false), old = structuredClone({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, baron: s.corruptionBaron, mentor: s.mentorDisorder });
    applyFallenEarlEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, baron: s.corruptionBaron, mentor: s.mentorDisorder }).toEqual(old);
    expect(currentFallenEarlCombatSource(s)).toMatchObject({ targetId: 'FE4-MARLOW-VENN', targetAlive: true, independentMind: true, distanceMetres: 2, targetSequence: 5,
      noBystanders: true, ordinaryExit: true, pursuit: false, enemyWeapon: 'FE4-MARLOW-CLUB' });
    expect(hasFallenEarlDisputeOpponent(s)).toBe(true); expect(validateFallenEarlEncounter(s)).toBe(true);
    expect(projectFallenEarlEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3, 3]);
  });
  it('requires a closed report and original practices, then permits one ordinary refusal', () => {
    const s = fixture(false); s.fallenEarl.life.cases['willing-pause'].status = 'AVAILABLE';
    expect(fallenEarlEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.fallenEarl.life.cases['willing-pause'].status = 'RESOLVED'; s.mentorDisorder.practice.markers = 'MIXED';
    expect(fallenEarlEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('收束');
    s.mentorDisorder.practice.markers = 'SORTED'; const old = structuredClone(s.briber);
    applyFallenEarlEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(s.briber).toEqual(old);
    expect(s.fallenEarl.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(validateFallenEarlEncounter(s)).toBe(true); expect(() => applyFallenEarlEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateFallenEarlEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
  it('purchases three new IDs into the original briber inventory without refunding old gifts', () => {
    const s = fixture(false), old = structuredClone(s.briber.gifts);
    applyFallenEarlEncounterCommand(s, { type: 'BUY_GIFTS' }, context());
    expect(s.cash).toBe(940); expect(s.actionsRemaining).toBe(6); expect(s.briber.giftPacks).toBe(2); expect(s.briber.gifts.slice(0, 3)).toEqual(old);
    expect(s.briber.gifts.slice(3).map(g => g.id)).toEqual(['BR7-GIFT-4', 'BR7-GIFT-5', 'BR7-GIFT-6']);
    expect(projectFallenEarlEncounter(s).gifts).toMatchObject({ held: 5, given: 1, battleGround: 0 });
  });
  it('rejects changed original source/resources and old encounter with no payment or random draw', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.briber.gifts[1]!.location = 'GIVEN'; }, (s: SliceState) => { s.spirituality--; }]) {
      const s = fixture(), r = begin(s); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = begin(s);
    expect(resolveFallenEarlCombatAbility(s, K, 1, random(), r, { ...r.source, independentMind: false } as never).selfGain).toBe(0);
    s.combat!.encounterId = 'MENTOR_DISORDER_DISPUTE'; expect(currentFallenEarlCombatSource(s)).toBeNull(); expect(() => resolveFallenEarlCombatRound(s, 'ATTACK')).toThrow('原');
  });
});

describe('Only magnify the original actor and preserve inherited formulas', () => {
  it('pays4S per own unarmedH and uses original oldbody/newmagnify mastery once', () => {
    const s = fixture(), r = begin(s), old = structuredClone(s.briber);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(59.15 * .65 * .5 * (1 + .25 * .65));
    expect(effect(s, H, r).selfGain).toBe(59.15 * .65 * (1 + .25 * .65));
    expect(effect(s, J, r, random(), .5).selfGain).toBe(41.405 * .65 * .5);
    expect(s.spirituality).toBe(112); expect(s.fallenEarl.encounter.magnifyUses).toBe(2); expect(s.briber).toEqual(old);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('only held own club replacesH at16physical and lowS uses the exact original fallback', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; s.spirituality = 4; s.progression.mastery[H] = 500; const r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(16 * .5 * 1.25);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(s.spirituality).toBe(0);
    expect(effect(s, B, r).enemyReduction).toBe(36.45 * .65); expect(effect(s, K, r).selfGain).toBe(0);
    expect(s.briber.gifts.filter(g => g.location === 'PLAYER')).toHaveLength(2);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('fixednegativeA and source-freeR have no secret costs or new states', () => {
    const s = fixture(), r = begin(s), before = structuredClone(s);
    expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5); expect(s).toEqual(before);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
});

describe('Actual old gift, one bounded extension and independent bestow', () => {
  it('B moves the first held original and WARD/COMPOSE cannot consume it; zeroBODY does', () => {
    const s = fixture(), r = begin(s), originalGiven = structuredClone(s.briber.gifts[0]);
    effect(s, B, r); expect(s.spirituality).toBe(117);
    expect(s.briber.gifts[1]).toEqual({ id: 'BR7-GIFT-2', location: 'GIVEN', destination: 'BATTLE:FALLEN_EARL_DISPUTE:GROUND', givenWeek: 110 });
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); enemy(s, 'COMPOSE', r); expect(r.pendingWeakening?.remaining).toBe(1);
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(r.pendingWeakening).toBeNull();
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); expect(s.briber.gifts[0]).toEqual(originalGiven);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('R extends only an existing samegift once to two real attacks and cannot extend again', () => {
    const s = fixture(), r = begin(s);
    effect(s, R, r); effect(s, B, r); effect(s, R, r); effect(s, R, r);
    expect(s.spirituality).toBe(114); expect(r.pendingWeakening).toMatchObject({ giftId: 'BR7-GIFT-2', remaining: 2, extended: true });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55 * (1 - .35 * .65));
    expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18 * (1 - .35 * .65)); expect(r.pendingWeakening).toBeNull();
    expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18); effect(s, R, r); expect(s.spirituality).toBe(114);
    expect(s.fallenEarl.encounter.exploitUses).toBe(1); expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('repeatedB uses old defense without spending second original or duplicating pending', () => {
    const s = fixture(), r = begin(s); effect(s, B, r);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(36.45 * .65 * .5);
    expect(s.spirituality).toBe(117); expect(s.briber.gifts.filter(g => g.location === 'PLAYER')).toHaveLength(1);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('a consumedgift cannot be recreated or retrospectively extended and paid effects expire', () => {
    const s = fixture(), r = begin(s); effect(s, B, r); enemy(s, 'BODY_STRIKE', r); effect(s, R, r);
    expect(s.spirituality).toBe(117); expect(s.fallenEarl.encounter.exploitUses).toBe(0);
    effect(s, B, r); effect(s, R, r); const o = finishFallenEarlCombatRound(s, r);
    expect(o.pendingWeakening).toBeNull(); expect(s.spirituality).toBe(111); expect(s.briber.gifts.every(g => g.location === 'GIVEN')).toBe(true);
    expect(validateFallenEarlRoundOutcome(o)).toBe(true); expect(() => finishFallenEarlCombatRound(s, r)).toThrow('结束');
  });
  it('lowS cannot extend or refund an existinggift', () => {
    const s = fixture(); s.spirituality = 5; const r = begin(s); effect(s, B, r); effect(s, R, r);
    expect(s.spirituality).toBe(2); expect(r.pendingWeakening).toMatchObject({ remaining: 1, extended: false });
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('successful paidK has no immediate damage, surviveszeroBODY and independently multipliesgift', () => {
    const s = fixture(), r = begin(s); effect(s, B, r); effect(s, R, r); effect(s, K, r, random(1));
    expect(effect(s, K, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s.spirituality).toBe(110);
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(s.fallenEarl.encounter.bestowReady).toBe(true);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55 * .55 * (1 - .35 * .65));
    expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(18); expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('failedK still pays and cannot rewrite an earlier original attack', () => {
    const s = fixture(), r = begin(s); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); effect(s, K, r, random(100));
    expect(s.spirituality).toBe(116); expect(s.fallenEarl.encounter.bestowReady).toBe(false); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55);
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('laterCOMPOSE pays3S and clearsK while retaining independent originalgift', () => {
    const s = fixture(), r = begin(s); effect(s, B, r); effect(s, K, r, random(1));
    expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.fallenEarl.encounter).toMatchObject({ composureReady: true, bestowReady: false, enemySpirituality: 37 });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55 * (1 - .35 * .65));
    expect(validateFallenEarlRoundOutcome(finishFallenEarlCombatRound(s, r))).toBe(true);
  });
  it('earlierpaidCOMPOSE resists a successfulKroll without refund and ends at roundend', () => {
    const s = fixture(), r = begin(s); enemy(s, 'COMPOSE', r); effect(s, K, r, random(1));
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, checkRoll: 1, resistedByComposure: true, succeeded: false });
    expect(s.spirituality).toBe(116); const o = finishFallenEarlCombatRound(s, r);
    expect(o).toMatchObject({ composureReady: false, bestowReady: false, pendingWeakening: null }); expect(validateFallenEarlRoundOutcome(o)).toBe(true);
  });
});

describe('Finite40SP, persistent original consequences and real exit', () => {
  it('depletes actualenemy40S across rounds and returns every unaffordable spell to originalclub', () => {
    const s = fixture();
    play(s, 'PREPARE', 1, 100, ticket(R, 'PREPARE'), 1, 1, 1, 1, 1);
    play(s, 'PREPARE', 1, 100, 1, ticket(R, 'PREPARE'), 1, 1, 1, 1);
    expect(s.fallenEarl.encounter.enemySpirituality).toBe(0); expect(s.fallenEarl.encounter.powerUses.ARC_BOLT).toBe(8);
    const result = play(s, 'PREPARE', 1, 21, ticket(R, 'PREPARE'), 1, 36, 86, 1);
    expect(result.round.fallenEarlOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([
      ['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18],
    ]); expect(validateFallenEarlEncounter(s)).toBe(true);
  });
  it('keeps common light/heavy/death and only continuing12S regeneration', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(); s.spirituality = 100; const old = structuredClone(s.mentorDisorder);
      const result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(result.round.fallenEarlOutcome!.enemySpirituality).toBe(37); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 108 : 96); expect(s.mentorDisorder).toEqual(old);
      expect(result.round.consequence).not.toContain('放下'); expect(validateFallenEarlRoundOutcome(result.round.fallenEarlOutcome)).toBe(true);
      if (outcome !== 'CONTINUE') settleFallenEarlEncounter(s, outcome, context()); expect(validateFallenEarlEncounter(s)).toBe(true);
    }
  });
  it('real playerdeath remains possible after successfulK and pendingeffects finish', () => {
    const s = fixture(), result = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 96, 1_000_000, 96);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(116);
    expect(s.fallenEarl.encounter.bestowReady).toBe(false); s.status = 'DEAD'; settleFallenEarlEncounter(s, result.outcome, context());
    expect(s.fallenEarl.encounter.status).toBe('LOST'); expect(validateFallenEarlEncounter(s)).toBe(true);
  });
  it('ordinaryretreat preserves prior originalgift and actualenemycost then prohibits reopening', () => {
    const s = fixture(); play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 96, 96, 1);
    const originalGifts = structuredClone(s.briber.gifts), result = play(s, 'RETREAT', 1, 1, 36, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.fallenEarl.encounter.enemySpirituality).toBe(37); expect(s.briber.gifts).toEqual(originalGifts);
    settleFallenEarlEncounter(s, result.outcome, context()); expect(validateFallenEarlEncounter(s)).toBe(true);
    expect(() => applyFallenEarlEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
  });
  it('rejects forgedoriginalgift, freeenemyspell, freemagnify and persistenttemporaryflags', () => {
    const s = fixture(), result = play(s, 'ATTACK', 13, 1, ticket(B, 'ATTACK'), 36, ticket(H, 'ATTACK'), 1, 1, 1);
    for (const mutate of [
      (o: NonNullable<typeof result.round.fallenEarlOutcome>) => { o.giftsAfter[1]!.location = 'PLAYER'; },
      (o: NonNullable<typeof result.round.fallenEarlOutcome>) => { o.enemyActions[1]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.fallenEarlOutcome>) => { o.enemyActions[1]!.selfGain = 55; },
      (o: NonNullable<typeof result.round.fallenEarlOutcome>) => { o.playerActions[1]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.fallenEarlOutcome>) => { o.source.independentMind = false as never; },
    ]) { const o = structuredClone(result.round.fallenEarlOutcome!); mutate(o); expect(validateFallenEarlRoundOutcome(o)).toBe(false); }
    const clone = structuredClone(s); clone.fallenEarl.encounter.composureReady = true; expect(validateFallenEarlEncounter(clone)).toBe(false);
    s.briber.gifts[1]!.location = 'PLAYER'; expect(validateFallenEarlEncounter(s)).toBe(false);
  });
  it('shows actualoriginal inventory, originalopponent and source-limitedG without unknown3abilities', () => {
    const s = fixture(), p = projectFallenEarlCombat(s);
    expect(p).toMatchObject({ targetId: 'FE4-MARLOW-VENN', enemySpirituality: 40, gifts: { held: 2, given: 1, battleGround: 0 }, pursuit: false });
    expect(p.summary).toContain('完整配方与仪式未知'); expect(p.summary).toContain('狂乱法师3未开放'); expect(p.source!.enemyWeapon).toBe('FE4-MARLOW-CLUB');
  });
});
