import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createBlackKnightState } from '../../src/domain/black-knight/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolveBlackKnightCombatRound } from '../../src/domain/slice/black-knight-combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { BLACK_KNIGHT_COUNT_WHEEL, BLACK_KNIGHT_ENEMY_COUNT_WHEEL, BLACK_KNIGHT_ENEMY_ABILITY_WHEEL,
  blackKnightAbilityWheel, blackKnightActionCount, blackKnightEnemyActionCount, drawBlackKnightAbility, drawBlackKnightEnemyAbility,
  currentBlackKnightCombatSource, beginBlackKnightCombatRound, resolveBlackKnightCombatAbility, resolveBlackKnightEnemyAbility,
  finishBlackKnightCombatRound, validateBlackKnightRoundOutcome, projectBlackKnightCombat, type BlackKnightMoveId } from '../../src/domain/black-knight/combat.js';
import { applyBlackKnightEncounterCommand, blackKnightEncounterReason, hasBlackKnightDisputeOpponent,
  projectBlackKnightEncounter, settleBlackKnightEncounter, validateBlackKnightEncounter, validateBlackKnightEncounterCommand } from '../../src/domain/black-knight/encounter.js';
import { SHEPHERD_COUNT_WHEEL } from '../../src/domain/shepherd/combat.js';

const H = 'hanged-man.s4.flesh-soul-blade', J = 'BODY_FOLLOWUP', B = 'BORROWED_WARD', K = 'hanged-man.s4.shadow-command', R = 'hanged-man.s5.borrowed-arts';
const profile: readonly [BlackKnightMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: BlackKnightMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'black-knight-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Deliberately isolated unit fixture, not a claim of naturally acquired life progress. */
function fixture(start = true, withIris = true): SliceState {
  const s = createSliceRun('black-knight-combat-directed', sliceDefaultCreationSelection, 'black-knight-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'hanged-man', sequence: 4, mastery: { [H]: 0, 'hanged-man.s6.flesh-shaping': 0, [K]: 0, [R]: 0 }, acting: 0, promotionWeek: 110 };
  s.blackKnight = createBlackKnightState(); s.blackKnight.promotionWeek = 110; s.blackKnight.shepherdActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.blackKnight.life.cases['shadow-boundary'].status = 'RESOLVED';
  s.shepherd.promotionWeek = 70; s.shepherd.grazing.met = true;
  const iris = s.shepherd.grazing.spirits.find(x => x.id === 'SH5-IRIS-1')!, cedric = s.shepherd.grazing.spirits.find(x => x.id === 'SH5-CEDRIC-1')!;
  Object.assign(cedric, { status: 'RELEASED', attemptWeek: 71, acquiredWeek: 71, releasedWeek: 75, selectedAbilities: ['courage-song'] });
  if (withIris) {
    Object.assign(iris, { status: 'GRAZED', attemptWeek: 72, acquiredWeek: 72, selectedAbilities: ['light-touch', 'brief-ward', 'blur-mark'] });
    s.shepherd.grazing.activeSpiritId = iris.id;
  }
  if (start) applyBlackKnightEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: BlackKnightMoveId, r = beginBlackKnightCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolveBlackKnightCombatAbility(s, id, physical, rng, r);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveBlackKnightCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
function reserve(s: SliceState, points = 1) {
  s.roseBishop.reserve.points = points; s.roseBishop.reserve.packetsBought = points;
  s.roseBishop.reserve.packets = Array.from({ length: points }, (_, i) => ({ id: `rose-bishop-ration-${i + 1}`, acquiredWeek: 60, consumedWeek: 61, status: 'CONSUMED' as const }));
}
afterEach(() => vi.restoreAllMocks());

describe('Black Knight original source and inherited profile', () => {
  it('preserves the inherited1–6 count and six-slot weights with finite enemy2–4', () => {
    const s = fixture(); expect(BLACK_KNIGHT_COUNT_WHEEL).toEqual(SHEPHERD_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(BLACK_KNIGHT_COUNT_WHEEL);
    expect(blackKnightAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(blackKnightAbilityWheel(s, null));
    for (const [id] of profile) expect(drawBlackKnightAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(blackKnightActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(BLACK_KNIGHT_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(blackKnightEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(BLACK_KNIGHT_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([40, 30, 25, 5]);
    expect([1, 41, 71, 96].map(n => drawBlackKnightEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'ACCIDENT']);
  });
  it('uses HANGED-MAN50/20/20/10 and1250/floor125, keeping enemy850/floor85', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .5 + 20 * .2 + 30 * .2 + 40 * .1, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40)); expect(result.round.consequenceWeights).toBeNull();
    expect(validateBlackKnightEncounter(s)).toBe(true);
  });
  it('starts only the original Garrick, preserves original souls and old enemy unchanged', () => {
    const s = fixture(false), old = structuredClone(s.shepherd); applyBlackKnightEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.shepherd).toEqual(old); expect(s.blackKnight.encounter).toMatchObject({ targetId: 'BK4-GARRICK-NOLL', enemySpirituality: 40 });
    expect(currentBlackKnightCombatSource(s)).toMatchObject({ distanceMetres: 4, noBystanders: true, friendImmunity: false, ordinaryExit: true,
      pursuit: false, originalShadow: 'BK4-GARRICK-SHADOW', shadowLit: true, offensiveIntent: true, corruptIntent: true });
    expect(hasBlackKnightDisputeOpponent(s)).toBe(true); expect(validateBlackKnightEncounter(s)).toBe(true);
    expect(projectBlackKnightEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3]);
  });
  it('rejects stale source, unknown targets and other encounters before costs or draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.mind--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.shepherd.grazing.activeSpiritId = null; }]) {
      const s = fixture(), r = beginBlackKnightCombatRound(s, 'ATTACK'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'FIRST_CASE'; expect(currentBlackKnightCombatSource(s)).toBeNull(); expect(() => resolveBlackKnightCombatRound(s, 'ATTACK')).toThrow('原');
    s.combat!.encounterId = 'BLACK_KNIGHT_DISPUTE'; s.blackKnight.encounter.targetId = 'REVIVED-ELTON' as never; expect(currentBlackKnightCombatSource(s)).toBeNull();
  });
  it('requires a closed report and real shade cleanup, then permits one ordinary exit', () => {
    const s = fixture(false); s.blackKnight.life.cases['shadow-boundary'].status = 'AVAILABLE'; expect(blackKnightEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.blackKnight.life.cases['shadow-boundary'].status = 'RESOLVED'; s.blackKnight.life.shade.playerNode = 'ROOM'; expect(blackKnightEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('关闭');
    s.blackKnight.life.shade.playerNode = 'OUTSIDE'; s.blackKnight.life.shade.status = 'SEALED'; expect(blackKnightEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('移交');
    s.blackKnight.life.shade.status = 'NOT_CREATED'; applyBlackKnightEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.blackKnight.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 });
    expect(s.actionsRemaining).toBe(5); expect(validateBlackKnightEncounter(s)).toBe(true);
    expect(() => applyBlackKnightEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateBlackKnightEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
});

describe('Black Knight paid blade and finite original shadow', () => {
  it.each([false, true])('ignores at most one real paidWARD whether it precedes blade: %s', wardFirst => {
    const s = fixture(), r = beginBlackKnightCombatRound(s, 'ATTACK');
    if (wardFirst) resolveBlackKnightEnemyAbility(s, 'WARD', 1, random(), r);
    expect(effect(s, H, r).selfGain).toBe(55 * .65);
    if (!wardFirst) resolveBlackKnightEnemyAbility(s, 'WARD', 1, random(), r);
    effect(s, H, r); resolveBlackKnightEnemyAbility(s, 'WARD', 1, random(), r);
    expect(s.spirituality).toBe(110); expect(s.blackKnight.encounter.enemySpirituality).toBe(34);
    expect(r.enemyActions.map(a => a.enemyReduction)).toEqual([0, 30]); expect(r.enemyActions.map(a => a.paidCost)).toEqual([3, 3]);
    expect(r.enemyActions[0]!.wardIgnoredBy).toBe(r.playerActions[0]!.order); expect(r.enemyActions[1]!.wardIgnoredBy).toBeNull();
    expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100); expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
  });
  it('does not grant free blade or bypass for underfundedH, ordinaryJ or borrowedR', () => {
    for (const id of [H, J, R] as const) {
      const s = fixture(); if (id === H) s.spirituality = 4; const r = beginBlackKnightCombatRound(s, 'ATTACK');
      const hit = effect(s, id, r); resolveBlackKnightEnemyAbility(s, 'WARD', 1, random(), r);
      expect(r.enemyActions[0]!.enemyReduction).toBe(30); expect(s.blackKnight.encounter.wardIgnored).toBe(false);
      expect(hit.selfGain).toBeCloseTo(id === H ? 12 : id === J ? 27.3 * .65 : 38.025 * .65);
      expect(r.playerActions[0]!.bladePaid).toBe(false); expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
    }
  });
  it('does not accept fabricated corrupt intent or an unlit/non-original shadow source', () => {
    const s = fixture(), r = beginBlackKnightCombatRound(s, 'CONTROL'), before = structuredClone(s), rng = random();
    expect(resolveBlackKnightCombatAbility(s, H, 1, rng, r, { ...r.source, corruptIntent: false } as never).selfGain).toBe(0);
    expect(resolveBlackKnightCombatAbility(s, K, 1, rng, r, { ...r.source, shadowLit: false } as never).selfGain).toBe(0);
    expect(s).toEqual(before); expect(rng.cursor).toBe(0);
  });
  it('charges resisted4S and restricts only the next positive BODY_STRIKE once', () => {
    const s = fixture(), r = beginBlackKnightCombatRound(s, 'CONTROL'); effect(s, K, r, random(100)); expect(s.spirituality).toBe(116);
    effect(s, K, r, random(1)); expect(s.spirituality).toBe(112); effect(s, K, r); expect(s.spirituality).toBe(112);
    expect(resolveBlackKnightEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55); expect(s.blackKnight.encounter.shadowReady).toBe(true);
    expect(resolveBlackKnightEnemyAbility(s, 'BODY_STRIKE', 0, random(), r).selfGain).toBe(0); expect(s.blackKnight.encounter.shadowReady).toBe(true);
    expect(resolveBlackKnightEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(9);
    expect(resolveBlackKnightEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(18);
    expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
  });
  it('clears unused shadow and blade opportunity without refund or carryover', () => {
    const s = fixture(), r = beginBlackKnightCombatRound(s, 'CONTROL'); effect(s, K, r, random(1)); effect(s, H, r);
    expect(s.blackKnight.encounter).toMatchObject({ shadowReady: true, bladeReady: true });
    const outcome = finishBlackKnightCombatRound(s, r); expect(s.spirituality).toBe(111);
    expect(outcome).toMatchObject({ shadowReady: false, bladeReady: false, wardIgnored: false }); expect(validateBlackKnightRoundOutcome(outcome)).toBe(true);
    expect(() => finishBlackKnightCombatRound(s, r)).toThrow('结束');
  });
});

describe('Original single soul and unchanged S6 reserve', () => {
  it('borrows only the actual current selected Iris and preserves released Cedric', () => {
    const s = fixture(), old = structuredClone(s.shepherd.grazing), r = beginBlackKnightCombatRound(s, 'ATTACK');
    expect(effect(s, R, r).selfGain).toBeCloseTo(38.025 * .65); expect(effect(s, B, r).enemyReduction).toBe(30 * .65);
    expect(s.spirituality).toBe(116); expect(s.shepherd.grazing).toEqual(old); expect(projectBlackKnightCombat(s).activeSpiritId).toBe('SH5-IRIS-1');
    expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
  });
  it('has no freeR for no soul, released soul, unselected method or depleted spirituality', () => {
    for (const change of [(s: SliceState) => { s.shepherd.grazing.activeSpiritId = null; },
      (s: SliceState) => { s.shepherd.grazing.activeSpiritId = 'SH5-CEDRIC-1'; },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['brief-ward']; },
      (s: SliceState) => { s.spirituality = 1; }]) {
      const s = fixture(); change(s); const before = structuredClone(s), r = beginBlackKnightCombatRound(s, 'PREPARE');
      expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s).toEqual(before);
      expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
    }
  });
  it('prefers actual paid ward before restoration; restoration spends one original point and preserves injuries', () => {
    const ward = fixture(); ward.health = 85; reserve(ward); const wr = beginBlackKnightCombatRound(ward, 'DEFEND');
    expect(effect(ward, B, wr).enemyReduction).toBe(19.5); expect(ward.health).toBe(85); expect(ward.roseBishop.reserve.points).toBe(1);
    const s = fixture(true, false); s.health = 95; reserve(s); s.injuries.push({ id: 'old', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }); s.injuryRisk = 3;
    const packets = structuredClone(s.roseBishop.reserve.packets), r = beginBlackKnightCombatRound(s, 'DEFEND');
    expect(effect(s, B, r).selfGain).toBe(8); expect(s.health).toBe(100); expect(s.spirituality).toBe(117); expect(s.roseBishop.reserve.points).toBe(0);
    expect(effect(s, B, r).enemyReduction).toBe(10); expect(s.injuries).toHaveLength(1); expect(s.injuryRisk).toBe(3); expect(s.roseBishop.reserve.packets).toEqual(packets);
    expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
  });
  it('will not heal from counterfeit reserve, empty stock or a healthy body', () => {
    for (const mode of ['COUNTERFEIT', 'EMPTY', 'HEALTHY'] as const) {
      const s = fixture(true, false); s.health = mode === 'HEALTHY' ? 100 : 70; reserve(s, mode === 'EMPTY' ? 0 : 1);
      if (mode === 'COUNTERFEIT') s.roseBishop.reserve.packets[0]!.status = 'HELD';
      const before = structuredClone(s), r = beginBlackKnightCombatRound(s, 'DEFEND'); expect(effect(s, B, r).enemyReduction).toBe(10);
      expect(s).toEqual(before); expect(validateBlackKnightRoundOutcome(finishBlackKnightCombatRound(s, r))).toBe(true);
    }
  });
});

describe('Black Knight shared settlement and original enemy persistence', () => {
  it('retains the shared light/heavy/death wheel and continuing-only12SP regeneration', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(), result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 41, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(result.round.moves.find(m => m.actor === 'ENEMY')!.enemyReduction).toBe(0); expect(result.round.blackKnightOutcome!.enemySpirituality).toBe(37);
      expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 120 : 115); expect(validateBlackKnightRoundOutcome(result.round.blackKnightOutcome)).toBe(true);
      if (outcome !== 'CONTINUE') settleBlackKnightEncounter(s, outcome, context()); expect(validateBlackKnightEncounter(s)).toBe(true);
    }
  });
  it('records a later blade ignoring an earlier ward in actual even-round order', () => {
    const s = fixture(); play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    const result = play(s, 'ATTACK', 1, 1, 41, ticket(H, 'ATTACK'), 96, 1, 66);
    expect(result.round.first).toBe('ENEMY'); expect(result.round.moves[0]!.enemyReduction).toBe(0);
    expect(result.round.blackKnightOutcome!.enemyActions[0]!.wardIgnoredBy).toBe(1);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); settleBlackKnightEncounter(s, result.outcome, context()); expect(validateBlackKnightEncounter(s)).toBe(true);
  });
  it('depletes the same40S over real rounds and falls back to the same original club', () => {
    const s = fixture();
    for (let i = 0; i < 2; i++) {
      const values = i === 0 ? [1, 100, ticket(B, 'DEFEND'), 1, 1, 1, 1, 1] : [1, 100, 1, ticket(B, 'DEFEND'), 1, 1, 1, 1];
      play(s, 'DEFEND', ...values); expect(validateBlackKnightEncounter(s)).toBe(true);
    }
    expect(s.blackKnight.encounter.enemySpirituality).toBe(0); expect(s.blackKnight.encounter.powerUses.ARC_BOLT).toBe(8);
    const result = play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 41, 1);
    expect(result.round.blackKnightOutcome!.enemyActions.map(a => [a.actual, a.paidCost])).toEqual([['BODY_STRIKE', 0], ['BODY_STRIKE', 0]]);
    expect(s.blackKnight.encounter.enemySpirituality).toBe(0); expect(validateBlackKnightEncounter(s)).toBe(true);
  });
  it('preserves failed retreat damage and risk, and never resurrects a dead player', () => {
    const s = fixture(); s.injuries.push({ id: 'old-original-injury', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const fail = play(s, 'RETREAT', 1, 1, 100, 71, 96, 1_000_000, 56);
    expect(fail.round.retreat).toBe('FAILURE'); expect(s.health).toBe(70); expect(s.injuryRisk).toBe(1); expect(validateBlackKnightEncounter(s)).toBe(true);
    const dead = fixture(), death = play(dead, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 96, 1_000_000, 96);
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dead.health).toBe(0); dead.status = 'DEAD'; settleBlackKnightEncounter(dead, death.outcome, context());
    expect(validateBlackKnightEncounter(dead)).toBe(true); expect(() => applyBlackKnightEncounterCommand(dead, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow();
  });
  it('actual ordinary retreat keeps the original enemy spentSP and does not reward', () => {
    const s = fixture(); play(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 96, 1);
    const result = play(s, 'RETREAT', 1, 1, 41, 1), award = vi.fn(); expect(result.outcome).toBe('RETREATED');
    settleBlackKnightEncounter(s, result.outcome, context(), award); expect(s.blackKnight.encounter.enemySpirituality).toBe(32);
    expect(award).not.toHaveBeenCalled(); expect(validateBlackKnightEncounter(s)).toBe(true);
  });
  it('rejects forged cost, ward bypass, reserve restoration, source intent and terminal history', () => {
    const s = fixture(); play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 41, 1, 1, 1); expect(validateBlackKnightEncounter(s)).toBe(true);
    for (const change of [(x: SliceState) => { x.blackKnight.encounter.enemySpirituality++; },
      (x: SliceState) => { x.combatHistory.at(-1)!.blackKnightOutcome!.enemyActions[0]!.paidCost = 0; },
      (x: SliceState) => { x.combatHistory.at(-1)!.blackKnightOutcome!.enemyActions[0]!.wardIgnoredBy = 99; },
      (x: SliceState) => { x.combatHistory.at(-1)!.blackKnightOutcome!.source.corruptIntent = false as never; },
      (x: SliceState) => { x.combatHistory.at(-1)!.blackKnightOutcome!.playerActions[0]!.paidCost = 0; },
      (x: SliceState) => { x.combatHistory.at(-1)!.blackKnightOutcome!.playerActions[0]!.healthRestored = 10; }]) {
      const bad = structuredClone(s); change(bad); expect(validateBlackKnightEncounter(bad)).toBe(false);
    }
  });
});
