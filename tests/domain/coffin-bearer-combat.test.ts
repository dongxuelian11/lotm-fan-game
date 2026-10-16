import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createCoffinBearerState } from '../../src/domain/coffin-bearer/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveCoffinBearerCombatRound } from '../../src/domain/slice/coffin-bearer-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { COFFIN_BEARER_COUNT_WHEEL, COFFIN_BEARER_ENEMY_COUNT_WHEEL, COFFIN_BEARER_ENEMY_ABILITY_WHEEL,
  coffinBearerAbilityWheel, coffinBearerActionCount, coffinBearerEnemyActionCount, drawCoffinBearerAbility, drawCoffinBearerEnemyAbility,
  currentCoffinBearerCombatSource, beginCoffinBearerCombatRound, resolveCoffinBearerCombatAbility, resolveCoffinBearerEnemyCombatAbility,
  finishCoffinBearerCombatRound, validateCoffinBearerRoundOutcome, projectCoffinBearerCombat, type CoffinBearerMoveId, type CoffinBearerRoundOutcome } from '../../src/domain/coffin-bearer/combat.js';
import { applyCoffinBearerActivity } from '../../src/domain/coffin-bearer/life.js';
import { applyCoffinBearerEncounterCommand, settleCoffinBearerEncounter, validateCoffinBearerEncounter } from '../../src/domain/coffin-bearer/encounter.js';

const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s4.living-matrix', K = 'mother.s3.finite-preservation', R = 'mother.s7.life-support';
const profile: readonly [CoffinBearerMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: CoffinBearerMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); } throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'coffin-bearer-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Explicit directed unit setup. The unchanged 483-command natural lineage is separately replayed by shared tests. */
function fixture(guard = true): SliceState {
  const s = createSliceRun('coffin-bearer-combat-directed', sliceDefaultCreationSelection, 'coffin-bearer-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'mother', sequence: 3, mastery: { [H]: 0, [J]: 0, [B]: 0, [K]: 0, [R]: 0,
    'mother.s9.careful-practice': 0, 'mother.s6.specimen-study': 0, 'mother.s5.ground-passage': 0, 'mother.s8.limited-healing': 0 }, acting: 0, promotionWeek: 120 };
  s.coffinBearer = createCoffinBearerState(); s.coffinBearer.guidanceKnown = true; s.coffinBearer.promotionWeek = 120; s.coffinBearer.ancientAlchemistActingAtPromotion = 100;
  for (const c of Object.values(s.coffinBearer.life.cases)) c.status = 'RESOLVED'; s.coffinBearer.life.reflected = true; s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP';
  if (guard) { applyCoffinBearerActivity(s, { type: 'PREPARE_GUARD' }, context()); s.spirituality = 120; }
  applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
const oldRoots = (s: SliceState) => structuredClone({ cultivator: s.cultivator, physician: s.physician, harvestpriest: s.harvestpriest, biologist: s.biologist, druid: s.druid, ancientAlchemist: s.ancientAlchemist });
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginCoffinBearerCombatRound(s, stance, random()); }
function effect(s: SliceState, id: CoffinBearerMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveCoffinBearerCombatAbility(s, id, physical, rng, r); }
function enemy(s: SliceState, id: Parameters<typeof resolveCoffinBearerEnemyCombatAbility>[1], r: ReturnType<typeof begin>, rng = random(), physical = 1) { return resolveCoffinBearerEnemyCombatAbility(s, id, physical, rng, r); }
function complete(s: SliceState, r: ReturnType<typeof begin>) { const o = finishCoffinBearerCombatRound(s, r); expect(validateCoffinBearerRoundOutcome(o)).toBe(true); return o; }
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected directed shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveCoffinBearerCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); s.revision++; expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());


describe('Coffin Bearer inherited Mother budgets, original resources and wheels', () => {
  it('uses both1–6 wheels, six30/15/25/10/15/5 slots and stance5/4 tickets', () => {
    const s = fixture(); expect(COFFIN_BEARER_COUNT_WHEEL.map(a => a.weight)).toEqual([12, 20, 25, 23, 14, 6]); expect(COFFIN_BEARER_ENEMY_COUNT_WHEEL).toEqual(COFFIN_BEARER_COUNT_WHEEL);
    expect(playerCountWheel(s)).toEqual(COFFIN_BEARER_COUNT_WHEEL); expect(coffinBearerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(coffinBearerAbilityWheel(s, null));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) for (const [id] of profile) expect(drawCoffinBearerAbility(random(ticket(id, stance)), s, stance)).toBe(id);
    for (const count of [coffinBearerActionCount, coffinBearerEnemyActionCount]) expect([1, 12, 13, 32, 33, 57, 58, 80, 81, 94, 95, 100].map(count)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(COFFIN_BEARER_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]); expect([1, 36, 61, 86, 96].map(n => drawCoffinBearerEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
    const rng = random(); beginCoffinBearerCombatRound(s, 'ATTACK', rng); expect(rng.cursor).toBe(0);
  });
  it('inherits Mother20/15/20/45, both1250/120 and no passive luck', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const r = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 1);
    expect(r.round.playerAdvantage).toBe(baseAdvantage(10 * .2 + 20 * .15 + 30 * .2 + 40 * .45, 100, 100, 120, 1250, 120) - 22.5);
    expect(r.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120) - 22.5); expect(r.round.consequenceWeights).toBeNull(); expect(r.round.passiveLuck).toBeUndefined(); expect(validateCoffinBearerEncounter(s)).toBe(true);
  });
  it.each(['SHOP', 'BAG', 'HAND'] as const)('H uses actual%s original gear, and J only inherited careful mastery', gear => {
    const s = fixture(); s.town.clubLocation = gear; const r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe((gear === 'HAND' ? 16 : 12) * .5);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(8.4 * .65 * .5); expect(s.spirituality).toBe(120); complete(s, r);
  });
  it.each([false, true])('guard prepared%s never blocks combat, missing material orS uses ordinary exact fallback', prepared => {
    const s = fixture(prepared); if (prepared) s.spirituality = 2; const before = s.spirituality, r = begin(s);
    expect(effect(s, B, r).enemyReduction).toBe(42.25 * .65); expect(effect(s, K, r, random(), .5).enemyReduction).toBe(3); expect(s.spirituality).toBe(before); expect(r.playerActions.every(a => a.paidCost === 0 && a.guard === null && a.rolls.length === 0)).toBe(true); complete(s, r);
  });
  it('rejects source edits and duplicate round models with no draws, costs or old-root changes', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.character.coreStats.physique++; }, (s: SliceState) => { s.injuryRisk++; },
      (s: SliceState) => { s.coffinBearer.life.clockSeconds++; }, (s: SliceState) => { s.coffinBearer.encounter.enemySpirituality--; },
      (s: SliceState) => { s.coffinBearer.life.guard.segments[0]!.status = 'SPENT'; }, (s: SliceState) => { s.progression.mastery['mother.s8.limited-healing'] = 1; }]) {
      const s = fixture(), r = begin(s); change(s); const before = structuredClone(s), rng = random(); expect(effect(s, K, r, rng).selfGain).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); begin(s); expect(() => begin(s)).toThrow('已有回合');
  });
});

describe('Actual independent new guard, inherited matrix and new finite preservation', () => {
  it.each([[1, 'GREAT_SUCCESS'], [6, 'SUCCESS'], [51, 'FAILURE'], [96, 'GREAT_FAILURE']] as const)('K records knowledge20 fourtier%s, one actual segment and5S', (roll, tier) => {
    const s = fixture(), old = oldRoots(s), r = begin(s); effect(s, K, r, random(roll));
    expect(r.playerActions[0]).toMatchObject({ paidCost: 5, checkChance: 50, checkTier: tier, succeeded: roll <= 50, guard: { guardId: 'CB3-GUARD', segmentId: 'CB3-SEG1' }, guardChargesAfter: roll <= 50 ? 2 : 0 });
    expect(s.coffinBearer.life.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']); expect(s.spirituality).toBe(115); expect(oldRoots(s)).toEqual(old); complete(s, r);
  });
  it.each([B, K] as const)('any pending%s blocks bothB/K without cost, material or repeated check', id => {
    const s = fixture(), r = begin(s); effect(s, id, r, random(1)); const cost = s.spirituality; effect(s, B, r); effect(s, K, r);
    expect(s.spirituality).toBe(cost); expect(r.playerActions.slice(1).every(a => a.paidCost === 0 && a.guard === null && a.rolls.length === 0)).toBe(true); complete(s, r);
  });
  it('K weakens only two later positiveBODY/ARC and COMPOSE does not clear physical protection', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'WARD', r); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(8); enemy(s, 'BODY_STRIKE', r, random(), 0);
    expect(r.model.guardCharges).toBe(2); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(56); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(16); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70);
    expect(r.model.guardMode).toBeNull(); expect(s.coffinBearer.encounter.enemySpirituality).toBe(102); complete(s, r);
  });
  it('B keeps knowledge18 binary check and one next attack×0.6 with no K stacking', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(1)); effect(s, K, r); enemy(s, 'ACCIDENT', r); enemy(s, 'WARD', r);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(42); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(20);
    expect(r.playerActions[0]).toMatchObject({ paidCost: 4, checkChance: 54, checkTier: null, activeSeconds: 60 }); expect(s.spirituality).toBe(116); complete(s, r);
  });
  it('failed B/K spend their actual distinct originals and depleted three segments cannot refill', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(100)); effect(s, K, r, random(100)); effect(s, B, r, random(100));
    expect(r.playerActions.map(a => a.guard?.segmentId)).toEqual(['CB3-SEG1', 'CB3-SEG2', 'CB3-SEG3']); expect(s.spirituality).toBe(107);
    expect(effect(s, K, r).enemyReduction).toBe(6); expect(effect(s, B, r).enemyReduction).toBe(42.25 * .65); expect(r.model.guardCharges).toBe(0); complete(s, r);
  });
  it('one remaining K charge blocks reactivation and a later consumed K can use the next original', () => {
    const s = fixture(), r = begin(s); effect(s, K, r, random(1)); enemy(s, 'BODY_STRIKE', r); effect(s, K, r);
    expect(s.spirituality).toBe(115); enemy(s, 'BODY_STRIKE', r); effect(s, B, r, random(1)); expect(s.spirituality).toBe(111); expect(r.playerActions[2]!.guard?.segmentId).toBe('CB3-SEG2'); complete(s, r);
  });
  it('60 real seconds expire unused charges without refunding segments or advancing cared-for samples', () => {
    const s = fixture(), old = oldRoots(s), samples = structuredClone(s.coffinBearer.life.samples), r = begin(s); effect(s, K, r, random(1)); const o = complete(s, r);
    expect(o).toMatchObject({ guardMode: null, guardCharges: 0, elapsedSeconds: 60, lifeClockSecondsAfter: 60, playerSpiritualityAfter: 115 });
    expect(s.coffinBearer.life.externalSeconds).toBe(60); expect(s.coffinBearer.life.samples).toEqual(samples); expect(oldRoots(s)).toEqual(old); expect(() => finishCoffinBearerCombatRound(s, r)).toThrow('结束');
  });
});

describe('R restores actual current health, retains original wounds and risk, never revives', () => {
  it('R actual healing remains a valid source for later guard, ordinary action and second R', () => {
    const s = fixture(), old = oldRoots(s); s.health = 70; s.injuries = [{ id: 'original-heavy', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null }]; s.injuryRisk = 3;
    const wounds = structuredClone(s.injuries), r = begin(s); effect(s, R, r, random(), .95); expect(s.health).toBe(79); expect(currentCoffinBearerCombatSource(s)?.playerHealth).toBe(79);
    expect(effect(s, H, r).selfGain).toBe(12); effect(s, K, r, random(1)); effect(s, R, r); expect(s.health).toBe(88); expect(s.spirituality).toBe(107);
    expect(s.injuries).toEqual(wounds); expect(s.injuryRisk).toBe(3); expect(oldRoots(s)).toEqual(old); const o = complete(s, r); expect(o.playerHealthBeforeConsequence).toBe(88); expect(o.playerHealthAfter).toBe(88);
  });
  it('at500 inherited mastery R floors15 and caps100; full health and insufficientS cost0 and draw0', () => {
    const s = fixture(); s.progression.mastery[R] = 500; s.health = 99; const r = begin(s); effect(s, R, r); effect(s, R, r);
    expect(s.health).toBe(100); expect(s.spirituality).toBe(116); expect(r.playerActions.map(a => [a.paidCost, a.recoveredHealth])).toEqual([[4, 1], [0, 0]]); complete(s, r);
    const low = fixture(); low.health = 70; low.spirituality = 3; const lr = begin(low); effect(low, R, lr); expect(low.health).toBe(70); expect(low.spirituality).toBe(3); complete(low, lr);
  });
  it('zero health invalidates the same live model and cannot be restored by R', () => {
    const s = fixture(), r = begin(s); s.health = 0; s.status = 'DEAD'; const before = structuredClone(s); expect(effect(s, R, r).selfGain).toBe(0); expect(s).toEqual(before);
  });
  it('records exact healing, first unused segment, tier, actions and finite source to reject forged replay', () => {
    const s = fixture(); s.health = 70; const r = begin(s); effect(s, R, r, random(), .95); effect(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r); const o = complete(s, r);
    const changes: ((v: CoffinBearerRoundOutcome) => void)[] = [v => { v.playerActions[0]!.recoveredHealth++; }, v => { v.playerHealthBeforeConsequence++; }, v => { v.playerActions[1]!.guard!.segmentId = 'CB3-SEG3'; },
      v => { v.playerActions[1]!.paidCost = 0; }, v => { v.playerActions[1]!.checkTier = 'FAILURE'; }, v => { v.playerActions[1]!.order = 0; }, v => { v.enemyActions[0]!.guardApplied = false; },
      v => { v.guardAfter.segments[0]!.status = 'UNUSED'; }, v => { v.source.targetSequence = 5 as never; }, v => { v.source.enemyWeapon = 'AA4-OSRIC-CLUB' as never; }, v => { v.lifeClockSecondsAfter--; },
      v => { v.source.lifeSupportMastery = 500; }, v => { v.source.guard.sourceId = 'AA4-GUARD' as never; }, v => { v.playerRiskAfter--; }];
    for (const change of changes) { const bad = structuredClone(o); change(bad); expect(validateCoffinBearerRoundOutcome(bad)).toBe(false); }
  });
});

describe('Directed real rounds preserve actual consequence, finite resources and ordinary exit', () => {
  it.each([[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const)('common injury roll%s preserves ordinary4m4s exit', (roll, health, outcome) => {
    const s = fixture(); s.spirituality = 100; const r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, roll);
    expect(r.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(r.round.consequenceWeights).toEqual(consequenceWeights(0)); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 112 : 100);
    expect(s.coffinBearer.life.clockSeconds).toBe(outcome === 'CONTINUE' ? 60 : 64); expect(s.coffinBearer.encounter.weaponLocation).toBe(outcome === 'ENEMY_DEAD' ? 'COURT' : 'HAND');
    if (outcome !== 'CONTINUE') settleCoffinBearerEncounter(s, outcome, context()); expect(validateCoffinBearerEncounter(s)).toBe(true);
  });
  it('R updates later physical factors and actual consequence health, while old wound increases risk', () => {
    const s = fixture(); s.health = 70; s.injuries = [{ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null }]; s.injuryRisk = 2;
    const r = play(s, 'PREPARE', 13, 1, ticket(R, 'PREPARE'), 61, ticket(H, 'PREPARE'), 1_000_000, 1);
    expect(r.round.coffinBearerOutcome!.playerActions.map(a => a.physicalFactor)).toEqual([.95, 1]); expect(r.round.coffinBearerOutcome!.playerHealthBeforeConsequence).toBe(79); expect(s.health).toBe(69);
    expect(s.injuryRisk).toBe(3); expect(s.injuries[0]!.severity).toBe('HEAVY'); expect(validateCoffinBearerEncounter(s)).toBe(true);
  });
  it('successful K still cannot prevent actual death or restore spent segment and body stays in court', () => {
    const s = fixture(), old = oldRoots(s); const r = play(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1_000_000, 96);
    expect(r.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(115); expect(s.coffinBearer.life.clockSeconds).toBe(60); expect(s.coffinBearer.encounter.scene.playerPosition).toBe('COURT');
    s.status = 'DEAD'; settleCoffinBearerEncounter(s, r.outcome, context()); expect(validateCoffinBearerEncounter(s)).toBe(true); expect(oldRoots(s)).toEqual(old); expect(s.coffinBearer.life.guard.segments[0]!.status).toBe('SPENT');
  });
  it('retreat retains earlier paidWARD and moves only living original body4m4s', () => {
    const s = fixture(); play(s, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 96, 1); const old = oldRoots(s);
    const r = play(s, 'RETREAT', 1, 1, 36, 1); expect(r.outcome).toBe('RETREATED'); expect(s.coffinBearer.encounter.enemySpirituality).toBe(116); expect(s.coffinBearer.life.clockSeconds).toBe(124);
    settleCoffinBearerEncounter(s, r.outcome, context()); expect(validateCoffinBearerEncounter(s)).toBe(true); expect(oldRoots(s)).toEqual(old);
  });
  it('all120 enemyS can run out through actual rounds; unpaid planned spells useBODY0S', () => {
    const s = fixture();
    for (let round = 1; round <= 4; round++) {
      const actions = round % 2 ? [ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1, 1] : [1, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1];
      play(s, 'PREPARE', 1, 100, ...actions, 1); expect(validateCoffinBearerEncounter(s)).toBe(true);
    }
    expect(s.coffinBearer.encounter.enemySpirituality).toBe(0); expect(s.coffinBearer.encounter.powerUses.ARC_BOLT).toBe(24);
    const r = play(s, 'PREPARE', 1, 33, ticket('ACCIDENT', 'PREPARE'), 1, 36, 86, 1);
    expect(r.round.coffinBearerOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20], ['BODY_STRIKE', 0, 20]]); expect(validateCoffinBearerEncounter(s)).toBe(true);
  });
  it('rejects forged terminal guard, health, risk, original core, effect order and injury receipt', () => {
    const s = fixture(), r = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 1, 66); settleCoffinBearerEncounter(s, r.outcome, context()); expect(validateCoffinBearerEncounter(s)).toBe(true);
    for (const mutate of [(x: SliceState) => { x.combatHistory.at(-1)!.coffinBearerOutcome!.playerRiskAfter++; }, (x: SliceState) => { x.combatHistory.at(-1)!.coffinBearerOutcome!.source.clubLocation = 'HAND'; },
      (x: SliceState) => { x.combatHistory.at(-1)!.playerAdvantage++; }, (x: SliceState) => { x.combatHistory.at(-1)!.coffinBearerOutcome!.enemyInjuriesAfter[0]!.severity = 'LIGHT'; },
      (x: SliceState) => { x.combatHistory.at(-1)!.coffinBearerOutcome!.enemyActions[0]!.order = 0; }, (x: SliceState) => { x.coffinBearer.encounter.enemyHealth++; },
      (x: SliceState) => { x.coffinBearer.life.guard.segments[0]!.status = 'SPENT'; }]) { const bad = structuredClone(s); mutate(bad); expect(validateCoffinBearerEncounter(bad)).toBe(false); }
  });
  it('public projection identifies original adult, new media and unknown original formula', () => {
    const p = projectCoffinBearerCombat(fixture()); expect(p).toMatchObject({ targetId: 'CB3-NOLAN', enemySpirituality: 120, guardMode: null, guardCharges: 0, pursuit: false });
    expect(p.source).toMatchObject({ targetAge: 42, targetSequence: 4, targetPhysique: 22, enemyWeapon: 'CB3-NOLAN-ROD' }); expect(p.summary).toContain('完整配方仪式未知'); expect(p.summary).toContain('旧奥斯里克');
  });
});
