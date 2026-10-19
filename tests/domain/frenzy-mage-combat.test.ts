import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createFrenzyMageState } from '../../src/domain/frenzy-mage/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveFrenzyMageCombatRound } from '../../src/domain/slice/frenzy-mage-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { FRENZY_MAGE_COUNT_WHEEL, FRENZY_MAGE_ENEMY_COUNT_WHEEL, FRENZY_MAGE_ENEMY_ABILITY_WHEEL, frenzyMageAbilityWheel, frenzyMageActionCount, frenzyMageEnemyActionCount,
  drawFrenzyMageAbility, drawFrenzyMageEnemyAbility, currentFrenzyMageCombatSource, beginFrenzyMageCombatRound, resolveFrenzyMageCombatAbility, resolveFrenzyMageEnemyCombatAbility,
  finishFrenzyMageCombatRound, validateFrenzyMageRoundOutcome, projectFrenzyMageCombat, type FrenzyMageMoveId, type FrenzyMageRoundOutcome } from '../../src/domain/frenzy-mage/combat.js';
import { applyFrenzyMageEncounterCommand, settleFrenzyMageEncounter, validateFrenzyMageEncounter } from '../../src/domain/frenzy-mage/encounter.js';
import { MENTOR_DISORDER_COUNT_WHEEL } from '../../src/domain/mentor-disorder/combat.js';

const H = 'black-emperor.s4.magnify', J = 'BODY_FOLLOWUP', B = 'black-emperor.s7.bribery-weakening', K = 'black-emperor.s3.ordered-deviation', R = 'black-emperor.s4.exploit';
const profile: readonly [FrenzyMageMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: FrenzyMageMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); } throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'frenzy-mage-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed unit fixture. It is not the438-command natural prefix and never replaces it. */
function fixture(): SliceState {
  const s = createSliceRun('frenzy-mage-combat-directed', sliceDefaultCreationSelection, 'frenzy-mage-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'black-emperor', sequence: 3, mastery: { [H]: 0, [K]: 0, [B]: 0, [R]: 0, 'black-emperor.s8.enhanced-body': 0, 'black-emperor.s9.weak-point-insight': 0 }, acting: 0, promotionWeek: 120 };
  s.frenzyMage = createFrenzyMageState(); s.frenzyMage.guidanceKnown = true; s.frenzyMage.promotionWeek = 120; s.frenzyMage.fallenEarlActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.frenzyMage.life.cases['courier-route'].status = 'RESOLVED';
  // Directed original-gift snapshot: ten previously given, five currently held, same array and IDs.
  s.briber.gifts = Array.from({ length: 15 }, (_, i) => ({ id: `BR7-GIFT-${i + 1}`, location: (i < 10 ? 'GIVEN' : 'PLAYER') as 'GIVEN' | 'PLAYER', destination: i < 10 ? `DIRECTED:PRIOR:${i + 1}` : null, givenWeek: i < 10 ? 110 : null }));
  applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginFrenzyMageCombatRound(s, stance, random()); }
function effect(s: SliceState, id: FrenzyMageMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveFrenzyMageCombatAbility(s, id, physical, rng, r); }
function enemy(s: SliceState, id: Parameters<typeof resolveFrenzyMageEnemyCombatAbility>[1], r: ReturnType<typeof begin>, physical = 1) { return resolveFrenzyMageEnemyCombatAbility(s, id, physical, random(), r); }
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveFrenzyMageCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); s.revision++; expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('Frenzy Mage directed exact inherited wheels and sources', () => {
  it('inherits both1–6 count weights and all six30/15/25/10/15/5 stance tickets without luck', () => {
    const s = fixture(); expect(FRENZY_MAGE_COUNT_WHEEL).toEqual(MENTOR_DISORDER_COUNT_WHEEL); expect(FRENZY_MAGE_ENEMY_COUNT_WHEEL).toEqual(MENTOR_DISORDER_COUNT_WHEEL);
    expect(playerCountWheel(s)).toEqual(FRENZY_MAGE_COUNT_WHEEL); expect(frenzyMageAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(frenzyMageAbilityWheel(s, null));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) for (const [id] of profile) expect(drawFrenzyMageAbility(random(ticket(id, stance)), s, stance)).toBe(id);
    for (const count of [frenzyMageActionCount, frenzyMageEnemyActionCount]) expect([1, 12, 13, 32, 33, 57, 58, 80, 81, 94, 95, 100].map(count)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(FRENZY_MAGE_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]); expect([1, 36, 61, 86, 96].map(n => drawFrenzyMageEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
    const rng = random(); beginFrenzyMageCombatRound(s, 'ATTACK', rng); expect(rng.cursor).toBe(0);
  });
  it('preserves BLACK_EMPEROR35/15/20/30 and both1250/120 budgets with floor125', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const r = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 1);
    expect(r.round.playerAdvantage).toBe(baseAdvantage(10 * .35 + 20 * .15 + 30 * .2 + 40 * .3, 100, 100, 120, 1250, 120) - 22.5);
    expect(r.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120) - 22.5); expect(r.round.consequenceWeights).toBeNull(); expect(r.round.passiveLuck).toBeUndefined(); expect(validateFrenzyMageEncounter(s)).toBe(true);
  });
  it.each(['SHOP', 'BAG', 'HAND'] as const)('H magnifies only own actual%s main strike while J stays independent', gear => {
    const s = fixture(); s.town.clubLocation = gear; const oldMastery = { ...s.progression.mastery }, r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe((gear === 'HAND' ? 16 : 59.15 * .65) * .5 * (1 + .25 * .65));
    expect(effect(s, J, r, random(), .5).selfGain).toBe(41.405 * .65 * .5); expect(s.spirituality).toBe(116); expect(s.progression.mastery).toEqual(oldMastery);
    expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('insufficient H/K/R funds never go negative or fake a new effect', () => {
    const s = fixture(); s.spirituality = 2; const r = begin(s); expect(effect(s, H, r).selfGain).toBe(59.15 * .65);
    expect(effect(s, B, r).enemyReduction).toBe(36.45 * .65); expect(effect(s, K, r).selfGain).toBe(0); expect(effect(s, R, r).selfGain).toBe(0);
    expect(s.spirituality).toBe(2); expect(s.briber.gifts.filter(g => g.location === 'PLAYER')).toHaveLength(5); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('refuses stale source, altered funds, gear, gifts, health, body or clock without draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.briber.gifts[0]!.destination = 'FORGED'; },
      (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.character.coreStats.physique++; }, (s: SliceState) => { s.frenzyMage.life.clockSeconds++; }]) {
      const s = fixture(), r = begin(s); change(s); const before = structuredClone(s), rng = random(); expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'FALLEN_EARL_DISPUTE'; expect(currentFrenzyMageCombatSource(s)).toBeNull();
  });
});

describe('Frenzy Mage directed one future action and actual original gifts', () => {
  it('K skips past actions and zeroBODY, then halves one actual positive ARC after full5S', () => {
    const s = fixture(), r = begin(s); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); effect(s, K, r, random(1));
    expect(enemy(s, 'BODY_STRIKE', r, 0).selfGain).toBe(0); expect(s.frenzyMage.encounter.pendingKind).toBe('ORDERED_DEVIATION');
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(35); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20);
    expect(s.spirituality).toBe(115); expect(s.frenzyMage.encounter.enemySpirituality).toBe(110);
    const o = finishFrenzyMageCombatRound(s, r); expect(o.enemyActions[2]).toMatchObject({ paidCost: 5, spiritualityBefore: 115, spiritualityAfter: 110, rawContribution: 70, selfGain: 35 }); expect(validateFrenzyMageRoundOutcome(o)).toBe(true);
  });
  it('K can halve actualWARD30 to15 for full4S without spending the old gift on SELF', () => {
    const s = fixture(), old = structuredClone(s.briber.gifts.slice(0, 10)), r = begin(s); effect(s, B, r); effect(s, K, r, random(6));
    expect(enemy(s, 'WARD', r)).toMatchObject({ selfGain: 0, enemyReduction: 15, threatens: false }); expect(r.pendingWeakening).toMatchObject({ giftId: 'BR7-GIFT-11', remaining: 1 });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70 * (1 - .35 * .65)); expect(r.pendingWeakening).toBeNull(); expect(s.briber.gifts.slice(0, 10)).toEqual(old);
    const o = finishFrenzyMageCombatRound(s, r); expect(o.enemyActions[0]).toMatchObject({ actual: 'WARD', paidCost: 4, spiritualityBefore: 120, spiritualityAfter: 116, pendingApplied: 'ORDERED_DEVIATION', weakeningGiftId: null }); expect(validateFrenzyMageRoundOutcome(o)).toBe(true);
  });
  it('B consumes same firstPLAYER original and R extends only that pending gift once to2', () => {
    const s = fixture(), old = structuredClone(s.briber.gifts.slice(0, 10)), r = begin(s); effect(s, R, r); effect(s, B, r); effect(s, R, r); effect(s, R, r); effect(s, K, r, random(1));
    expect(s.spirituality).toBe(109); expect(s.briber.gifts[10]).toEqual({ id: 'BR7-GIFT-11', location: 'GIVEN', destination: 'BATTLE:FRENZY_MAGE_DISPUTE:GROUND', givenWeek: 120 });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70 * .5 * (1 - .35 * .65)); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20 * (1 - .35 * .65)); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20);
    expect(r.pendingWeakening).toBeNull(); expect(s.frenzyMage.encounter.exploitUses).toBe(1); expect(s.briber.gifts.slice(0, 10)).toEqual(old); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('B falls back without a held original or while its earlier actual gift is pending', () => {
    const s = fixture(), r = begin(s); effect(s, B, r); expect(effect(s, B, r).enemyReduction).toBe(36.45 * .65); expect(s.spirituality).toBe(117);
    expect(s.briber.gifts.filter(g => g.location === 'PLAYER')).toHaveLength(4); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
    const empty = fixture(); empty.briber.gifts = empty.briber.gifts.slice(0, 10); const q = begin(empty); expect(effect(empty, B, q).enemyReduction).toBe(36.45 * .65); expect(effect(empty, R, q).selfGain).toBe(0); expect(empty.spirituality).toBe(120); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(empty, q))).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS'], [6, 'SUCCESS'], [51, 'FAILURE'], [96, 'GREAT_FAILURE']] as const)('records knowledge20 fourtier roll%s with real5S', (roll, tier) => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(roll)); expect(r.playerActions[0]).toMatchObject({ paidCost: 5, checkChance: 50, checkTier: tier, succeeded: roll <= 50 }); expect(s.spirituality).toBe(115);
    expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('one unconsumed K prevents stacking and does not cost or draw again', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); effect(s, K, r); expect(s.spirituality).toBe(115); expect(s.frenzyMage.encounter.deviationAttempts).toBe(1);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(35); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('paidCOMPOSE8 isSELF, preserves old gift, cancels pendingK and resists later paidK', () => {
    const s = fixture(), r = begin(s); effect(s, B, r); effect(s, K, r, random(1)); expect(enemy(s, 'COMPOSE', r)).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(r.pendingWeakening).toMatchObject({ giftId: 'BR7-GIFT-11', remaining: 1 }); effect(s, K, r, random(1)); expect(r.playerActions[2]).toMatchObject({ paidCost: 5, checkTier: 'GREAT_SUCCESS', resistedByComposure: true, succeeded: false });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70 * (1 - .35 * .65)); expect(s.frenzyMage.encounter.enemySpirituality).toBe(111); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('laterCOMPOSE never rewrites a previously halved action', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r); enemy(s, 'COMPOSE', r); enemy(s, 'ARC_BOLT', r);
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([35, 8, 70]); expect(validateFrenzyMageRoundOutcome(finishFrenzyMageCombatRound(s, r))).toBe(true);
  });
  it('actual60seconds clears unused effects without refund, returning gifts or addingmastery', () => {
    const s = fixture(), oldMastery = { ...s.progression.mastery }, r = begin(s); effect(s, B, r); effect(s, K, r, random(1)); const o = finishFrenzyMageCombatRound(s, r);
    expect(o).toMatchObject({ pendingKind: null, pendingWeakening: null, composureReady: false, elapsedSeconds: 60, lifeClockSecondsAfter: 60, playerSpiritualityAfter: 112 }); expect(s.progression.mastery).toEqual(oldMastery);
    expect(s.briber.gifts[10]!.location).toBe('GIVEN'); expect(validateFrenzyMageRoundOutcome(o)).toBe(true); expect(() => finishFrenzyMageCombatRound(s, r)).toThrow('结束');
  });
  it('replays full gift/cost/source/order/clock receipts and rejects forged records', () => {
    const s = fixture(), r = begin(s); enemy(s, 'ARC_BOLT', r); effect(s, B, r); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r); const o = finishFrenzyMageCombatRound(s, r); expect(validateFrenzyMageRoundOutcome(o)).toBe(true);
    const mutations: ((v: FrenzyMageRoundOutcome) => void)[] = [v => { v.giftsAfter[0]!.destination = 'FORGED'; }, v => { v.giftsAfter[10]!.location = 'PLAYER'; }, v => { v.giftsAfter.push({ id: 'BR7-GIFT-16', location: 'PLAYER', destination: null, givenWeek: null }); },
      v => { v.playerActions[0]!.giftId = 'BR7-GIFT-1'; }, v => { v.playerActions[1]!.checkTier = 'FAILURE'; }, v => { v.enemyActions[0]!.selfGain = 35; }, v => { v.enemyActions[1]!.paidCost = 0; },
      v => { v.enemyActions[1]!.spiritualityAfter++; }, v => { v.enemyActions[1]!.rawContribution = 35; }, v => { v.playerActions[1]!.order = 0; }, v => { v.playerActions[1]!.spiritualityBefore++; },
      v => { v.source.targetId = 'FE4-MARLOW-VENN' as never; }, v => { v.source.targetSequence = 5 as never; }, v => { v.source.enemyWeapon = 'FE4-MARLOW-CLUB' as never; }, v => { v.source.scene.distanceMetres = 4 as never; },
      v => { v.elapsedSeconds = 0 as never; }, v => { v.source.playerSpirituality++; }, v => { v.pendingKind = 'ORDERED_DEVIATION' as never; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateFrenzyMageRoundOutcome(bad)).toBe(false); }
  });
});

describe('Frenzy Mage directed complete ordered rounds and bodily outcomes', () => {
  it('spends120 enemyS over four full real rounds then falls back from all planned spells', () => {
    const s = fixture();
    for (let round = 1; round <= 4; round++) {
      const actions = round % 2 ? [ticket(R, 'PREPARE'), 1, 1, 1, 1, 1, 1] : [1, ticket(R, 'PREPARE'), 1, 1, 1, 1, 1];
      play(s, 'PREPARE', 1, 100, ...actions, 1); expect(validateFrenzyMageEncounter(s)).toBe(true);
    }
    expect(s.frenzyMage.encounter.enemySpirituality).toBe(0); expect(s.frenzyMage.encounter.powerUses.ARC_BOLT).toBe(24);
    const r = play(s, 'PREPARE', 1, 33, ticket(R, 'PREPARE'), 1, 36, 86, 1);
    expect(r.round.frenzyMageOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20]]); expect(validateFrenzyMageEncounter(s)).toBe(true);
  });
  it.each([[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const)('shared consequence%s preserves actual injuries and12S regeneration only for continued rounds', (roll, health, outcome) => {
    const s = fixture(); s.spirituality = 100; const r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, roll);
    expect(r.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(r.round.consequenceWeights).toEqual(consequenceWeights(0)); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 108 : 96);
    expect(s.frenzyMage.life.clockSeconds).toBe(outcome === 'CONTINUE' ? 60 : 64); expect(s.frenzyMage.encounter.weaponLocation).toBe(outcome === 'ENEMY_DEAD' ? 'COURT' : 'HAND');
    if (outcome !== 'CONTINUE') settleFrenzyMageEncounter(s, outcome, context()); expect(validateFrenzyMageEncounter(s)).toBe(true);
  });
  it('new encounter retains player death and spent5S, original body stays in court', () => {
    const s = fixture(), old = structuredClone({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, corruptionBaron: s.corruptionBaron, mentorDisorder: s.mentorDisorder, fallenEarl: s.fallenEarl });
    const r = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1_000_000, 96); expect(r.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(115); expect(s.frenzyMage.life.clockSeconds).toBe(60);
    expect(s.frenzyMage.encounter.scene.playerPosition).toBe('COURT'); expect(s.frenzyMage.encounter.exitTravelMetres).toBe(0); s.status = 'DEAD'; settleFrenzyMageEncounter(s, r.outcome, context()); expect(validateFrenzyMageEncounter(s)).toBe(true);
    expect({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, corruptionBaron: s.corruptionBaron, mentorDisorder: s.mentorDisorder, fallenEarl: s.fallenEarl }).toEqual(old);
  });
  it('retreat keeps already paid enemyWARD and ordinary4m4s exit', () => {
    const s = fixture(); play(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 96, 1); const gifts = structuredClone(s.briber.gifts);
    const r = play(s, 'RETREAT', 1, 1, 36, 1); expect(r.outcome).toBe('RETREATED'); expect(r.round.passiveLuck).toBeUndefined(); expect(s.frenzyMage.encounter.enemySpirituality).toBe(116); expect(s.briber.gifts).toEqual(gifts);
    settleFrenzyMageEncounter(s, r.outcome, context()); expect(s.frenzyMage.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 }); expect(validateFrenzyMageEncounter(s)).toBe(true);
  });
  it('rejects exact health, risk, source gear and final oldgift tampering in a completed receipt', () => {
    const s = fixture(); const r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, 66); settleFrenzyMageEncounter(s, r.outcome, context()); expect(validateFrenzyMageEncounter(s)).toBe(true);
    for (const mutate of [(x: SliceState) => { x.combatHistory.at(-1)!.frenzyMageOutcome!.playerRiskAfter++; }, (x: SliceState) => { x.combatHistory.at(-1)!.frenzyMageOutcome!.source.clubLocation = 'HAND'; },
      (x: SliceState) => { x.combatHistory.at(-1)!.playerAdvantage++; }, (x: SliceState) => { x.combatHistory.at(-1)!.frenzyMageOutcome!.enemyInjuriesAfter[0]!.severity = 'LIGHT'; },
      (x: SliceState) => { x.briber.gifts[0]!.givenWeek = (x.briber.gifts[0]!.givenWeek ?? 0) + 1; }]) { const bad = structuredClone(s); mutate(bad); expect(validateFrenzyMageEncounter(bad)).toBe(false); }
  });
  it('public source specifies independent45year adult, real original gifts and originalNPC permanence', () => {
    const p = projectFrenzyMageCombat(fixture()); expect(p).toMatchObject({ targetId: 'FM3-ALDEN', enemySpirituality: 120, gifts: { held: 5, given: 10, battleGround: 0 }, pursuit: false });
    expect(p.summary).toContain('完整配方与晋升仪式未知'); expect(p.summary).toContain('原马洛永久死亡'); expect(p.source).toMatchObject({ targetAge: 45, targetSequence: 4, targetPhysique: 22, enemyWeapon: 'FM3-ALDEN-ROD' });
  });
});
