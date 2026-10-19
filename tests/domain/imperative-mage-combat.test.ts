import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createImperativeMageState } from '../../src/domain/imperative-mage/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveImperativeMageCombatRound } from '../../src/domain/slice/imperative-mage-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { IMPERATIVE_MAGE_COUNT_WHEEL, IMPERATIVE_MAGE_ENEMY_COUNT_WHEEL, IMPERATIVE_MAGE_ENEMY_ABILITY_WHEEL,
  imperativeMageAbilityWheel, imperativeMageActionCount, imperativeMageEnemyActionCount, drawImperativeMageAbility, drawImperativeMageEnemyAbility,
  currentImperativeMageCombatSource, beginImperativeMageCombatRound, resolveImperativeMageCombatAbility, resolveImperativeMageEnemyAbility,
  finishImperativeMageCombatRound, validateImperativeMageRoundOutcome, projectImperativeMageCombat, type ImperativeMageMoveId } from '../../src/domain/imperative-mage/combat.js';
import { applyImperativeMageEncounterCommand, imperativeMageEncounterReason, hasImperativeMageDisputeOpponent,
  projectImperativeMageEncounter, settleImperativeMageEncounter, validateImperativeMageEncounter, validateImperativeMageEncounterCommand } from '../../src/domain/imperative-mage/encounter.js';
import { PUNISHMENT_KNIGHT_COUNT_WHEEL } from '../../src/domain/punishment-knight/combat.js';

const H = 'justiciar.s9.combat-training', J = 'justiciar.s5.wound-verdict', B = 'justiciar.s4.intimidation', K = 'justiciar.s6.prohibition', R = 'justiciar.s4.deprivation';
const profile: readonly [ImperativeMageMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 25, 'DEFEND'], [K, 10, 'CONTROL'], [R, 15, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: ImperativeMageMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'imperative-mage-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed fixture, not a substitute for the unchanged natural S5 prefix and public promotion. */
function fixture(start = true): SliceState {
  const s = createSliceRun('imperative-mage-combat-directed', sliceDefaultCreationSelection, 'imperative-mage-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 100; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'justiciar', sequence: 4, mastery: { [H]: 0, [J]: 0, [B]: 0, [K]: 0, [R]: 0,
    'justiciar.s5.punishment': 0, 'justiciar.s8.trace-sensing': 0 }, acting: 0, promotionWeek: 100 };
  s.imperativeMage = createImperativeMageState(); s.imperativeMage.promotionWeek = 100; s.imperativeMage.punishmentKnightActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.punishmentKnight.encounter.status = 'RESOLVED'; s.imperativeMage.life.cases['willing-attention'].status = 'RESOLVED';
  if (start) applyImperativeMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
function begin(s: SliceState, stance: SliceStance = 'ATTACK') { return beginImperativeMageCombatRound(s, stance, random()); }
function effect(s: SliceState, id: ImperativeMageMoveId, r: ReturnType<typeof begin>, rng = random(), physical = 1) {
  return resolveImperativeMageCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolveImperativeMageEnemyAbility>[1], r: ReturnType<typeof begin>, rng = random(), physical = 1) {
  return resolveImperativeMageEnemyAbility(s, id, physical, rng, r);
}
function complete(s: SliceState, r: ReturnType<typeof begin>) { const o = finishImperativeMageCombatRound(s, r); expect(validateImperativeMageRoundOutcome(o)).toBe(true); return o; }
function wound(s: SliceState) {
  s.revision = 2;
  s.combat!.enemyInjuries = [{ id: 'actual-old-enemy-injury', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
  s.imperativeMage.encounter.enemyInjuries = structuredClone(s.combat!.enemyInjuries);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveImperativeMageCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); s.revision++;
    expect(spy).toHaveBeenCalledTimes(values.length); return result; } finally { spy.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe('One actual Rowan and inherited S5 finite profile', () => {
  it('preserves six old counts,30/15/25/10/15/5 and actual enemy2–4 slots', () => {
    const s = fixture(); expect(IMPERATIVE_MAGE_COUNT_WHEEL).toEqual(PUNISHMENT_KNIGHT_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(IMPERATIVE_MAGE_COUNT_WHEEL);
    expect(imperativeMageAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 25, 10, 15, 5]); expect(playerAbilityWheel(s, null)).toEqual(imperativeMageAbilityWheel(s, null));
    for (const [id] of profile) expect(drawImperativeMageAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(imperativeMageActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(IMPERATIVE_MAGE_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(imperativeMageEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(IMPERATIVE_MAGE_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawImperativeMageEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'COMPOSE', 'ACCIDENT']);
  });
  it('inherits exact S5 core30/20/35/15, player1250 and independent enemy850', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .3 + 20 * .2 + 30 * .35 + 40 * .15, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40) - 45); expect(result.round.consequenceWeights).toBeNull();
    expect(validateImperativeMageEncounter(s)).toBe(true);
  });
  it('never reopens Dean or changes any old practice or original object', () => {
    const s = fixture(false), old = structuredClone({ arbiter: s.arbiter, sheriff: s.sheriff, interrogator: s.interrogator, judge: s.judge, punishmentKnight: s.punishmentKnight });
    applyImperativeMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect({ arbiter: s.arbiter, sheriff: s.sheriff, interrogator: s.interrogator, judge: s.judge, punishmentKnight: s.punishmentKnight }).toEqual(old);
    expect(currentImperativeMageCombatSource(s)).toMatchObject({ targetId: 'IM4-ROWAN-KELL', targetAlive: true, independentMind: true, distanceMetres: 2,
      noBystanders: true, ordinaryExit: true, pursuit: false, enemyWeapon: 'IM4-ROWAN-CLUB' });
    expect(hasImperativeMageDisputeOpponent(s)).toBe(true); expect(validateImperativeMageEncounter(s)).toBe(true);
    expect(projectImperativeMageEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3, 3]);
  });
  it('requires closed real reports and permits a single ordinary refusal with no spell', () => {
    const s = fixture(false); s.imperativeMage.life.cases['willing-attention'].status = 'AVAILABLE';
    expect(imperativeMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.imperativeMage.life.cases['willing-attention'].status = 'RESOLVED'; s.punishmentKnight.practice.pad = 'MAT';
    expect(imperativeMageEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('收束'); s.punishmentKnight.practice.pad = 'STAND';
    applyImperativeMageEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.actionsRemaining).toBe(5); expect(s.imperativeMage.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(validateImperativeMageEncounter(s)).toBe(true); expect(() => applyImperativeMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateImperativeMageEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
  it('rejects changed source, old enemy and resources without a draw or payment', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; },
      (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.imperativeMage.encounter.enemySpirituality--; }]) {
      const s = fixture(), r = begin(s); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, R, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = begin(s); expect(resolveImperativeMageCombatAbility(s, B, 1, random(), r, { ...r.source, independentMind: false } as never).selfGain).toBe(0);
    s.combat!.encounterId = 'PUNISHMENT_KNIGHT_DISPUTE'; expect(currentImperativeMageCombatSource(s)).toBeNull(); expect(() => resolveImperativeMageCombatRound(s, 'ATTACK')).toThrow('原');
  });
});

describe('Exact old H/J, actual old prohibition and actual violation', () => {
  it('uses old50.7H,35.49 ordinaryJ and no invented punishment without a real violation', () => {
    const s = fixture(), r = begin(s); expect(effect(s, H, r, random(), .5).selfGain).toBe(50.7 * .65 * .5);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(35.49 * .65 * .5); expect(s.spirituality).toBe(120); complete(s, r);
  });
  it('held own club replacesH with16physical and exact lowS traces remain42.25', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; s.spirituality = 2; const r = begin(s);
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(effect(s, B, r, random(), .5).enemyReduction).toBe(42.25 * .65 * .5);
    expect(effect(s, K, r, random(), .5).enemyReduction).toBe(3); expect(effect(s, R, r).selfGain).toBe(0);
    expect(s.spirituality).toBe(2); complete(s, r);
  });
  it('only actual enemyoldinjury permits paid45masteryJ without body or instant death', () => {
    const s = fixture(); wound(s); const r = begin(s); effect(s, K, r);
    expect(effect(s, J, r, random(1), 0).selfGain).toBe(45 * .65); expect(r.model.prohibitionPending).toBe(true);
    expect(s.spirituality).toBe(114); expect(s.combat!.enemyHealth).toBe(100); complete(s, r);
    const failed = fixture(); wound(failed); const f = begin(failed); expect(effect(failed, J, f, random(100)).selfGain).toBe(0); expect(failed.spirituality).toBe(117); complete(failed, f);
  });
  it('player injuries cannot feed J, and noresource oldinjuryJ really becomes restricted body', () => {
    const s = fixture(); s.injuries = [{ id: 'player-only', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }]; const r = begin(s);
    expect(effect(s, J, r).selfGain).toBe(35.49 * .65); expect(s.spirituality).toBe(120); complete(s, r);
    const low = fixture(); wound(low); low.spirituality = 5; const l = begin(low); effect(low, K, l);
    expect(effect(low, J, l, random(1))).toMatchObject({ selfGain: 0, threatens: false }); expect(low.spirituality).toBe(2); complete(low, l);
  });
  it('K waits for one actual BODY, and blocked enemy action gives no punishment source', () => {
    const s = fixture(), r = begin(s); effect(s, K, r); effect(s, K, r);
    expect(enemy(s, 'WARD', r).enemyReduction).toBe(30); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55); expect(r.model.prohibitionPending).toBe(true);
    expect(enemy(s, 'BODY_STRIKE', r, random(1))).toMatchObject({ selfGain: 0, threatens: false }); expect(r.model.breachReady).toBe(false);
    expect(effect(s, H, r).selfGain).toBe(50.7 * .65); expect(s.spirituality).toBe(117); complete(s, r);
  });
  it('resisted actual positiveBODY unlocks one paid old20mastery punishment in the sameH', () => {
    const s = fixture(), r = begin(s); effect(s, K, r); expect(enemy(s, 'BODY_STRIKE', r, random(100)).selfGain).toBe(18);
    expect(r.model.breachReady).toBe(true); expect(effect(s, H, r).selfGain).toBe(50.7 * .65 + 20 * .65);
    expect(effect(s, H, r).selfGain).toBe(50.7 * .65); expect(s.spirituality).toBe(114); expect(s.imperativeMage.encounter.punishmentUses).toBe(1); complete(s, r);
  });
  it('zeroBODY after resistance and player own resistance never invent enemy breach', () => {
    const s = fixture(), r = begin(s); effect(s, K, r); enemy(s, 'BODY_STRIKE', r, random(100), 0);
    expect(r.model.breachReady).toBe(false); effect(s, K, r); effect(s, H, r, random(100));
    expect(r.model.breachReady).toBe(false); expect(s.imperativeMage.encounter.punishmentUses).toBe(0); complete(s, r);
  });
  it('player blockedH cannot spend punishment before the actual body restriction', () => {
    const s = fixture(), r = begin(s); effect(s, K, r); enemy(s, 'BODY_STRIKE', r, random(100)); effect(s, K, r);
    expect(effect(s, H, r, random(1)).selfGain).toBe(0); expect(r.model.breachReady).toBe(true); expect(s.spirituality).toBe(114);
    expect(effect(s, H, r).selfGain).toBe(50.7 * .65 + 20 * .65); expect(s.spirituality).toBe(111); complete(s, r);
  });
});

describe('Finite intimidation and one original temporarily unavailable ability', () => {
  it('successfulB pays4S once, survives selfactions andzeroBODY, then reduces only one positiveARC', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(1)); effect(s, B, r);
    expect(s.spirituality).toBe(116); enemy(s, 'WARD', r); enemy(s, 'ACCIDENT', r); enemy(s, 'BODY_STRIKE', r, random(), 0);
    expect(s.imperativeMage.encounter.intimidationReady).toBe(true); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55 * .6);
    expect(s.imperativeMage.encounter.intimidationReady).toBe(false); expect(s.imperativeMage.encounter.enemySpirituality).toBe(32); complete(s, r);
  });
  it('failedB pays and never retroactively alters prior real attack', () => {
    const s = fixture(), r = begin(s); enemy(s, 'ARC_BOLT', r); effect(s, B, r, random(100)); enemy(s, 'ARC_BOLT', r);
    expect(r.enemyActions.map(a => a.selfGain)).toEqual([55, 55]); expect(s.spirituality).toBe(116); complete(s, r);
  });
  it('R replaces laterARC with one actualBODY0S, keeps WARD usable and restores sameARC at end', () => {
    const s = fixture(), r = begin(s), oldMastery = structuredClone(s.progression.mastery); effect(s, R, r, random(1)); effect(s, R, r);
    expect(projectImperativeMageEncounter(s).encounter!.abilities.find(a => a.id === 'ARC_BOLT')!.available).toBe(false);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(18); expect(enemy(s, 'WARD', r).enemyReduction).toBe(30);
    expect(r.enemyActions[0]).toMatchObject({ planned: 'ARC_BOLT', actual: 'BODY_STRIKE', paidCost: 0, deprivationApplied: true });
    expect(s.spirituality).toBe(116); expect(s.imperativeMage.encounter).toMatchObject({ enemySpirituality: 37, powerUses: { ARC_BOLT: 0, WARD: 1 } });
    complete(s, r); expect(s.imperativeMage.encounter.deprivationReady).toBe(false);
    expect(projectImperativeMageEncounter(s).encounter!.abilities.find(a => a.id === 'ARC_BOLT')!.available).toBe(true); expect(s.progression.mastery).toEqual(oldMastery);
  });
  it('deprivedARC actualBODY still meets K and actual positive resistance can fund H', () => {
    const s = fixture(), r = begin(s); effect(s, R, r, random(1)); effect(s, K, r); enemy(s, 'ARC_BOLT', r, random(100));
    expect(r.enemyActions[0]).toMatchObject({ actual: 'BODY_STRIKE', paidCost: 0, selfGain: 18, prohibitionResisted: true });
    expect(effect(s, H, r).selfGain).toBe(50.7 * .65 + 20 * .65); expect(s.spirituality).toBe(110); expect(s.imperativeMage.encounter.enemySpirituality).toBe(40); complete(s, r);
  });
  it('blocked deprivedARC consumes only originalslot, not pendingB or enemySP, and no breach', () => {
    const s = fixture(), r = begin(s); effect(s, R, r, random(1)); effect(s, B, r, random(1)); effect(s, K, r); enemy(s, 'ARC_BOLT', r, random(1));
    expect(r.enemyActions).toHaveLength(1); expect(r.enemyActions[0]).toMatchObject({ actual: 'BODY_STRIKE', selfGain: 0, paidCost: 0, prohibitionBlocked: true });
    expect(r.model.breachReady).toBe(false); expect(s.imperativeMage.encounter.intimidationReady).toBe(true);
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(18 * .6); expect(s.imperativeMage.encounter.enemySpirituality).toBe(40); complete(s, r);
  });
  it('failedR pays4 and original actualARC stays55 with its actual5S cost', () => {
    const s = fixture(), r = begin(s); enemy(s, 'ARC_BOLT', r); effect(s, R, r, random(100)); enemy(s, 'ARC_BOLT', r);
    expect(r.enemyActions.map(a => [a.actual, a.selfGain, a.paidCost])).toEqual([['ARC_BOLT', 55, 5], ['ARC_BOLT', 55, 5]]);
    expect(s.spirituality).toBe(116); complete(s, r);
  });
  it('later paidCOMPOSE clears both neweffects while preserving the independent oldbodyK', () => {
    const s = fixture(), r = begin(s); effect(s, B, r, random(1)); effect(s, R, r, random(1)); effect(s, K, r); enemy(s, 'COMPOSE', r);
    expect(s.imperativeMage.encounter).toMatchObject({ intimidationReady: false, deprivationReady: false, composureReady: true, enemySpirituality: 37 });
    expect(r.model.prohibitionPending).toBe(true); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(55);
    expect(enemy(s, 'BODY_STRIKE', r, random(1)).selfGain).toBe(0); complete(s, r);
  });
  it('earlier actualCOMPOSE resists otherwise successfulB/R and never refunds either cost', () => {
    const s = fixture(), r = begin(s); enemy(s, 'COMPOSE', r); effect(s, B, r, random(1)); effect(s, R, r, random(1));
    expect(r.playerActions.every(a => a.resistedByComposure && !a.succeeded && a.paidCost === 4)).toBe(true); expect(s.spirituality).toBe(112);
    const o = complete(s, r); expect(o).toMatchObject({ intimidationReady: false, deprivationReady: false, composureReady: false, prohibitionPending: false, breachReady: false });
    expect(() => finishImperativeMageCombatRound(s, r)).toThrow('结束');
  });
});

describe('Persistent costs, common originalbody consequences and actual exit', () => {
  it('spends40 enemySP across real rounds; every unaffordable spell becomes its own actual clubslot', () => {
    const s = fixture();
    play(s, 'PREPARE', 1, 100, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1, 1);
    play(s, 'PREPARE', 1, 100, 1, ticket('ACCIDENT', 'PREPARE'), 1, 1, 1, 1);
    expect(s.imperativeMage.encounter.enemySpirituality).toBe(0); expect(s.imperativeMage.encounter.powerUses.ARC_BOLT).toBe(8);
    const result = play(s, 'PREPARE', 1, 21, ticket('ACCIDENT', 'PREPARE'), 1, 36, 86, 1);
    expect(result.round.imperativeMageOutcome!.enemyActions.map(a => [a.actual, a.paidCost, a.selfGain])).toEqual([['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18], ['BODY_STRIKE', 0, 18]]);
    expect(validateImperativeMageEncounter(s)).toBe(true);
  });
  it('retains the common light/heavy/death wheel, original injuries and only continuing12S recovery', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(); s.spirituality = 100; const old = structuredClone(s.punishmentKnight);
      const result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 36, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 112 : 100); expect(s.punishmentKnight).toEqual(old);
      expect(validateImperativeMageRoundOutcome(result.round.imperativeMageOutcome)).toBe(true);
      if (outcome !== 'CONTINUE') settleImperativeMageEncounter(s, outcome, context()); expect(validateImperativeMageEncounter(s)).toBe(true);
    }
  });
  it('playerdeath remains real even after successful paidB and all temporary abilities restore', () => {
    const s = fixture(), result = play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 1, 96, 1_000_000, 96);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(116);
    expect(s.imperativeMage.encounter.intimidationReady).toBe(false); s.status = 'DEAD'; settleImperativeMageEncounter(s, result.outcome, context());
    expect(s.imperativeMage.encounter.status).toBe('LOST'); expect(validateImperativeMageEncounter(s)).toBe(true);
  });
  it('ordinaryretreat on the next round preserves actual enemycost and oldDean and cannot reopen', () => {
    const s = fixture(); const old = structuredClone(s.punishmentKnight); play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 96, 96, 1);
    const result = play(s, 'RETREAT', 1, 1, 36, 1); expect(result.outcome).toBe('RETREATED'); expect(s.imperativeMage.encounter.enemySpirituality).toBe(37);
    settleImperativeMageEncounter(s, result.outcome, context()); expect(validateImperativeMageEncounter(s)).toBe(true); expect(s.punishmentKnight).toEqual(old);
    expect(() => applyImperativeMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
  });
  it('rejects free spells, false realdeprivation, forged checks and permanent temporaryflags', () => {
    const s = fixture(), result = play(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 1, 1, 36, 1);
    for (const change of [
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.playerActions[0]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.enemyActions[0]!.selfGain = 55; },
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.enemyActions[1]!.paidCost = 0; },
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.playerActions[0]!.checkRoll = 100; },
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.source.independentMind = false as never; },
      (o: NonNullable<typeof result.round.imperativeMageOutcome>) => { o.deprivationReady = true as never; },
    ]) { const o = structuredClone(result.round.imperativeMageOutcome!); change(o); expect(validateImperativeMageRoundOutcome(o)).toBe(false); }
    s.imperativeMage.encounter.deprivationReady = true; expect(validateImperativeMageEncounter(s)).toBe(false);
  });
  it('shows actual finite opponent and source caveats without unknown3 or a universal2-rule cap', () => {
    const s = fixture(), p = projectImperativeMageCombat(s); expect(p).toMatchObject({ targetId: 'IM4-ROWAN-KELL', enemySpirituality: 40, pursuit: false });
    expect(p.summary).toContain('完整配方与仪式未知'); expect(p.summary).toContain('混乱猎手3未开放'); expect(p.summary).toContain('0-08');
    expect(p.source!.enemyWeapon).toBe('IM4-ROWAN-CLUB');
  });
});
