import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createMysticState } from '../../src/domain/mystic/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { MYSTIC_COUNT_WHEEL, MYSTIC_ENEMY_COUNT_WHEEL, MYSTIC_ENEMY_ABILITY_WHEEL, mysticAbilityWheel, mysticActionCount, mysticEnemyActionCount,
  drawMysticAbility, drawMysticEnemyAbility, currentMysticCombatSource, beginMysticCombatRound, resolveMysticCombatAbility,
  resolveMysticEnemyAbility, finishMysticCombatRound, validateMysticRoundOutcome, projectMysticCombat, type MysticMoveId } from '../../src/domain/mystic/combat.js';
import { applyMysticEncounterCommand, createMysticEncounterState, mysticEncounterReason, hasMysticDisputeOpponent,
  projectMysticEncounter, settleMysticEncounter, validateMysticEncounter, validateMysticEncounterCommand } from '../../src/domain/mystic/encounter.js';
import { STAR_MYSTIC_COUNT_WHEEL } from '../../src/domain/star-mystic/combat.js';

const H = 'hermit.s6.scrollcraft', J = 'BODY_FOLLOWUP', B = 'BRIEF_WARD', K = 'hermit.s5.star-cage', R = 'hermit.s4.mystical-reenactment';
const profile: readonly [MysticMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: MysticMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'mystic-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed isolated unit state; no claim of naturally acquired life/ritual progress. */
function fixture(start = true, learned = false): SliceState {
  const s = createSliceRun('mystic-combat-directed', sliceDefaultCreationSelection, 'mystic-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'hermit', sequence: 4, mastery: { [H]: 0, 'hermit.s7.spellcraft': 0, 'hermit.s8.combat-study': 0, [K]: 0, [R]: 0 }, acting: 0, promotionWeek: 110 };
  s.mystic = createMysticState(); s.mystic.promotionWeek = 110; s.mystic.starMysticActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.mystic.life.cases['sealed-story'].status = 'RESOLVED'; s.mystic.life.echoLearned = learned;
  if (start) applyMysticEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: MysticMoveId, r = beginMysticCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolveMysticCombatAbility(s, id, physical, rng, r);
}
function play(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
function scroll(s: SliceState, makerSequence: 6 | 5 | 4, kind: 'IMPACT' | 'WARD', mastery = 0) {
  const id = s.scrollProfessor.workshop.scrolls.length + 1, materialId = `scroll-professor-material-${id}`;
  s.scrollProfessor.workshop.materials.push({ id: materialId, acquiredWeek: 100, spentWeek: 101, status: 'SPENT' });
  const item = { id: `scroll-professor-scroll-${id}`, kind, makerSequence, inscriptionMastery: mastery, materialId, createdWeek: 101, status: 'HELD' as const, usedWeek: null, authorized: true };
  s.scrollProfessor.workshop.scrolls.push(item); return s.scrollProfessor.workshop.scrolls.at(-1)!;
}
afterEach(() => vi.restoreAllMocks());

describe('Mystic original source and inherited profile', () => {
  it('dispatches the inherited exact1–6 count and six slots, separate finite enemy2–4 wheel', () => {
    const s = fixture(); expect(MYSTIC_COUNT_WHEEL).toEqual(STAR_MYSTIC_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(MYSTIC_COUNT_WHEEL);
    expect(mysticAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(mysticAbilityWheel(s, null));
    for (const [id] of profile) expect(drawMysticAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(mysticActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(MYSTIC_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]); expect([1, 20, 21, 70, 71, 100].map(mysticEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(MYSTIC_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([40, 30, 25, 5]);
    expect([1, 41, 71, 96].map(n => drawMysticEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'ACCIDENT']);
  });
  it('uses actual HERMIT10/30/25/35 and1250 tier rather than Despair25/30/30/15', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .1 + 20 * .3 + 30 * .25 + 40 * .35, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40));
    expect(result.round.consequenceWeights).toBeNull(); expect(validateMysticEncounter(s)).toBe(true);
  });
  it('starts the separate original Lucan and does not revive or overwrite old Bryce', () => {
    const s = fixture(false); s.starMystic.encounter.status = 'RESOLVED'; const prior = structuredClone(s.starMystic);
    applyMysticEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyHealth: 100, enemySpirituality: 40 });
    expect(currentMysticCombatSource(s)).toMatchObject({ distanceMetres: 4, noBystanders: true, friendImmunity: false, ordinaryExit: true, pursuit: false, enemyWeapon: 'MY4-LUCAN-CLUB' });
    expect(hasMysticDisputeOpponent(s)).toBe(true); expect(validateMysticEncounter(s)).toBe(true); expect(s.starMystic).toEqual(prior);
    expect(projectMysticEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3]);
  });
  it('rejects stale source, counterfeit targets and other encounters before costs or draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.mind--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.mystic.life.echoLearned = true; }]) {
      const s = fixture(), r = beginMysticCombatRound(s, 'ATTACK'); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(); s.combat!.encounterId = 'FIRST_CASE'; expect(currentMysticCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow('原');
    s.combat!.encounterId = 'MYSTIC_DISPUTE'; s.mystic.encounter.targetId = 'REVIVED-BRYCE' as never; expect(currentMysticCombatSource(s)).toBeNull();
  });
  it('requires a closed real report and permits one ordinary exit without rewards or repeated combat', () => {
    const s = fixture(false); s.mystic.life.cases['sealed-story'].status = 'AVAILABLE'; expect(mysticEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.mystic.life.cases['sealed-story'].status = 'RESOLVED'; s.mystic.life.sight.eyeActive = true; expect(mysticEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('关闭');
    s.mystic.life.sight.eyeActive = false; applyMysticEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.combat).toBeNull(); expect(s.mystic.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 40 }); expect(s.actionsRemaining).toBe(5);
    expect(validateMysticEncounter(s)).toBe(true); expect(() => applyMysticEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validateMysticEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
  });
});

describe('Mystic actual inherited scrolls, learned spells and glasses', () => {
  it('burns only actual authorized maker6/5/4 originals under unchanged sealed budgets', () => {
    for (const maker of [6, 5, 4] as const) {
      const s = fixture(), original = scroll(s, maker, 'IMPACT', 0), r = beginMysticCombatRound(s, 'ATTACK');
      expect(effect(s, H, r).selfGain).toBeCloseTo(38.025 * .65); expect(original).toMatchObject({ makerSequence: maker, inscriptionMastery: 0, status: 'USED', usedWeek: 110, authorized: false });
      const ward = scroll(s, maker, 'WARD', 500); expect(effect(s, B, r).enemyReduction).toBe(42.25); expect(ward.status).toBe('USED');
      expect(s.spirituality).toBe(118); expect(s.scrollProfessor.workshop.materials.every(m => m.status === 'SPENT')).toBe(true);
      expect(validateMysticRoundOutcome(finishMysticCombatRound(s, r))).toBe(true);
    }
  });
  it('rejects counterfeit input and unknown spell inventory, then uses own body or real held club', () => {
    const s = fixture(), original = scroll(s, 6, 'IMPACT'); s.scrollProfessor.workshop.materials[0]!.status = 'HELD';
    expect(effect(s, H).selfGain).toBe(12); expect(original.status).toBe('HELD'); expect(s.spirituality).toBe(120);
    const held = fixture(); held.town.clubLocation = 'HAND'; expect(effect(held, H).selfGain).toBe(16); expect(effect(held, B).enemyReduction).toBe(10);
    expect(effect(held, J).selfGain).toBeCloseTo(20.475 * .65); expect(effect(held, 'ACCIDENT').selfGain).toBe(-22.5);
  });
  it('uses only actually learned old spells and never boosts them after sequence4', () => {
    const s = fixture(); s.wizard.lessons['light-touch']!.learned = true; s.wizard.lessons['brief-ward']!.learned = true;
    const r = beginMysticCombatRound(s, 'ATTACK'); expect(effect(s, H, r).selfGain).toBeCloseTo(38.025 * .65); expect(effect(s, B, r).enemyReduction).toBeCloseTo(42.25 * .65); expect(s.spirituality).toBe(116);
  });
  it('unlearned R requires actual worn original lenses and charges3S2M once, then improves only nextK', () => {
    const absent = fixture(); expect(effect(absent, R).label).toContain('未学会'); expect(absent.spirituality).toBe(120); expect(absent.starMystic.practice.lenses).toBe('SUPPLIER');
    const s = fixture(); s.starMystic.practice.lenses = 'WORN'; const r = beginMysticCombatRound(s, 'PREPARE');
    effect(s, R, r); expect(s.spirituality).toBe(117); expect(s.mind).toBe(98); expect(s.mystic.encounter.focused).toBe(true); expect(s.starMystic.practice.lenses).toBe('HELD');
    effect(s, R, r); expect(s.spirituality).toBe(117); effect(s, K, r, random(1)); expect(s.spirituality).toBe(114);
    expect(s.starMystic.practice.lenses).toBe('WORN'); expect(r.playerActions.at(-1)!.focusConsumed).toBe(true); expect(s.mystic.encounter.echoReady).toBe(false);
    expect(validateMysticRoundOutcome(finishMysticCombatRound(s, r))).toBe(true);
  });
  it('failure preserves real cage costs, and cage waits for only next positive BODY_STRIKE', () => {
    const s = fixture(), r = beginMysticCombatRound(s, 'CONTROL'); effect(s, K, r, random(100)); expect(s.spirituality).toBe(117); expect(s.mystic.encounter.cageReady).toBe(false);
    effect(s, K, r, random(1)); expect(s.spirituality).toBe(114); effect(s, K, r); expect(s.spirituality).toBe(114);
    expect(resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55); expect(s.mystic.encounter.cageReady).toBe(true);
    expect(resolveMysticEnemyAbility(s, 'BODY_STRIKE', 0, random(), r).selfGain).toBe(0); expect(s.mystic.encounter.cageReady).toBe(true);
    expect(resolveMysticEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(9); expect(resolveMysticEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(18);
    expect(validateMysticRoundOutcome(finishMysticCombatRound(s, r))).toBe(true);
  });
});

describe('Learned, resistible, publicly weakened finite echo', () => {
  it('pays a failed4S attempt without effect, and learned R never also grants glasses focus', () => {
    const s = fixture(true, true); s.starMystic.practice.lenses = 'WORN'; const r = beginMysticCombatRound(s, 'PREPARE');
    effect(s, R, r, random(100)); expect(s.spirituality).toBe(116); expect(s.mind).toBe(100); expect(s.mystic.encounter.echoReady).toBe(false);
    expect(s.mystic.encounter.focused).toBe(false); expect(s.starMystic.practice.lenses).toBe('WORN');
    expect(resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55); expect(validateMysticRoundOutcome(finishMysticCombatRound(s, r))).toBe(true);
  });
  it('reduces only the next actual positive paid arc after cost, with private .7/public .955', () => {
    for (const disclosed of [false, true]) {
      const s = fixture(true, true); s.mystic.life.publicDisclosed = disclosed; const r = beginMysticCombatRound(s, 'PREPARE');
      effect(s, R, r, random(1)); effect(s, R, r); expect(s.spirituality).toBe(116);
      expect(resolveMysticEnemyAbility(s, 'WARD', 1, random(), r).enemyReduction).toBe(30); expect(s.mystic.encounter.echoReady).toBe(true);
      expect(resolveMysticEnemyAbility(s, 'BODY_STRIKE', 1, random(), r).selfGain).toBe(18); expect(s.mystic.encounter.echoReady).toBe(true);
      expect(resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55 * (disclosed ? .955 : .7)); expect(s.mystic.encounter.echoReady).toBe(false);
      expect(resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(55); expect(s.mystic.encounter.enemySpirituality).toBe(27);
      const snapshot = finishMysticCombatRound(s, r); expect(validateMysticRoundOutcome(snapshot)).toBe(true);
      expect(snapshot.enemyActions[2]).toMatchObject({ paidCost: 5, echoApplied: true }); expect(projectMysticCombat(s).effectFactor).toBe(disclosed ? .15 : 1);
    }
  });
  it('clears all unconsumed finite effects and restores the same glasses at round end without refund', () => {
    const s = fixture(); s.starMystic.practice.lenses = 'WORN'; const r = beginMysticCombatRound(s, 'PREPARE'); effect(s, R, r);
    const snapshot = finishMysticCombatRound(s, r); expect(s.starMystic.practice.lenses).toBe('WORN'); expect(s.spirituality).toBe(117); expect(s.mind).toBe(98);
    expect(snapshot).toMatchObject({ focused: false, cageReady: false, echoReady: false }); expect(validateMysticRoundOutcome(snapshot)).toBe(true);
    const learned = fixture(true, true), lr = beginMysticCombatRound(learned, 'CONTROL'); effect(learned, K, lr, random(1)); effect(learned, R, lr, random(1));
    finishMysticCombatRound(learned, lr); expect(learned.mystic.encounter).toMatchObject({ cageReady: false, echoReady: false }); expect(learned.spirituality).toBe(113);
  });
  it('depletes original40SP without refill or free spell substitution', () => {
    const s = fixture(true, true), r = beginMysticCombatRound(s, 'PREPARE'); for (let i = 0; i < 8; i++) resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r);
    expect(s.mystic.encounter.enemySpirituality).toBe(0); expect(s.mystic.encounter.powerUses.ARC_BOLT).toBe(8);
    effect(s, R, r, random(1)); expect(resolveMysticEnemyAbility(s, 'ARC_BOLT', 1, random(), r).selfGain).toBe(18);
    expect(s.mystic.encounter.echoReady).toBe(true); expect(r.enemyActions.at(-1)).toMatchObject({ planned: 'ARC_BOLT', actual: 'BODY_STRIKE', paidCost: 0, echoApplied: false });
  });
});

describe('Shared injury, retreat and persisted original terminal continuity', () => {
  it('uses shared light/heavy/death injury branches and12SP continuing regeneration only', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(); s.wizard.lessons['light-touch']!.learned = true;
      const result = play(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 96, 96, 1, roll);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(validateMysticRoundOutcome(result.round.mysticOutcome)).toBe(true); expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 120 : 118);
      if (outcome !== 'CONTINUE') settleMysticEncounter(s, outcome, context()); expect(validateMysticEncounter(s)).toBe(true);
    }
  });
  it('preserves failed retreat, ordinary damage, injuries and common risk progression', () => {
    const s = fixture(); s.injuries.push({ id: 'old-original-injury', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const result = play(s, 'RETREAT', 1, 1, 100, 71, 96, 1_000_000, 56);
    expect(result.round.retreat).toBe('FAILURE'); expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toEqual(consequenceWeights(1));
    expect(s.health).toBe(70); expect(s.injuryRisk).toBe(1); expect(validateMysticEncounter(s)).toBe(true);
  });
  it('records real player death and no story resurrection, and real exit without resetting enemy costs', () => {
    const dead = fixture(), death = play(dead, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 96, 1_000_000, 96);
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dead.health).toBe(0); dead.status = 'DEAD'; settleMysticEncounter(dead, death.outcome, context()); expect(validateMysticEncounter(dead)).toBe(true);
    const s = fixture(); play(s, 'ATTACK', 1, 1, ticket(B, 'ATTACK'), 1, 96, 1); // Player wins, no actual player attack, no injury draw.
    const before = s.mystic.encounter.enemySpirituality, result = play(s, 'RETREAT', 1, 1, 96, 1);
    expect(result.outcome).toBe('RETREATED'); settleMysticEncounter(s, result.outcome, context()); expect(s.mystic.encounter.enemySpirituality).toBe(before); expect(validateMysticEncounter(s)).toBe(true);
  });
  it('rejects forged snapshots, free resources, false learned source and counterfeit original targets', () => {
    const s = fixture(true, true); play(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 1, 1, 41, 1);
    expect(validateMysticEncounter(s)).toBe(true);
    for (const change of [(x: SliceState) => { x.mystic.encounter.enemySpirituality++; },
      (x: SliceState) => { x.combatHistory.at(-1)!.mysticOutcome!.enemyActions[0]!.paidCost = 0; },
      (x: SliceState) => { x.combatHistory.at(-1)!.mysticOutcome!.enemyActions[0]!.echoMultiplier = 0; },
      (x: SliceState) => { x.combatHistory.at(-1)!.mysticOutcome!.source.targetId = 'BRYCE' as never; },
      (x: SliceState) => { x.combatHistory.at(-1)!.mysticOutcome!.source.echoLearned = false; },
      (x: SliceState) => { x.combatHistory.at(-1)!.mysticOutcome!.playerActions[0]!.paidCost = 0; }]) {
      const bad = structuredClone(s); change(bad); expect(validateMysticEncounter(bad)).toBe(false);
    }
    expect(createMysticEncounterState().enemySpirituality).toBe(40);
  });
});
