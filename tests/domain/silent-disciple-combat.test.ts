import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createSilentDiscipleState } from '../../src/domain/silent-disciple/index.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveSilentDiscipleCombatRound } from '../../src/domain/slice/silent-disciple-combat.js';
import type { SliceState, SliceStance, SliceInjury } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { PYROMANIAC_COUNT_WHEEL } from '../../src/domain/pyromaniac/combat.js';
import { SILENT_DISCIPLE_COUNT_WHEEL, SILENT_DISCIPLE_ENEMY_COUNT_WHEEL, SILENT_DISCIPLE_ENEMY_ABILITY_WHEEL, silentDiscipleAbilityWheel,
  silentDiscipleActionCount, silentDiscipleEnemyActionCount, drawSilentDiscipleAbility, drawSilentDiscipleEnemyAbility,
  currentSilentDiscipleCombatSource, beginSilentDiscipleCombatRound, resolveSilentDiscipleCombatAbility, resolveSilentDiscipleEnemyAbility,
  finishSilentDiscipleCombatRound, validateSilentDiscipleRoundOutcome, reflectSilentDiscipleActualWound, projectSilentDiscipleCombat, type SilentDiscipleMoveId } from '../../src/domain/silent-disciple/combat.js';
import { applySilentDiscipleEncounterCommand, validateSilentDiscipleEncounter, settleSilentDiscipleEncounter } from '../../src/domain/silent-disciple/encounter.js';

const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s3.short-transfiguration';
const profile: readonly [SilentDiscipleMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], ['OBSERVE', 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: SilentDiscipleMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); } throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'silent-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed rule fixture. Natural acquisition and real volunteer reports are tested separately. */
function fixture(purchase = true): SliceState {
  const s = createSliceRun('silent-combat-directed', sliceDefaultCreationSelection, 'silent-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 120; s.actionsRemaining = 6; s.cash = 1000; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'chained', sequence: 3, mastery: { [H]: 0, [K]: 0, 'chained.s3.measured-curse': 0, 'chained.s6.steel-body': 0, 'chained.s8.reason-sacrifice': 0 }, acting: 0, promotionWeek: 120 };
  s.silentDisciple = createSilentDiscipleState(); s.silentDisciple.promotionWeek = 120; s.silentDisciple.guidanceKnown = true; s.silentDisciple.puppetActingAtPromotion = 100;
  s.silentDisciple.life.cases['original-body'].status = 'RESOLVED'; s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP';
  if (purchase) applySilentDiscipleEncounterCommand(s, { type: 'BUY_BLOCKS' }, context());
  applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context()); return s;
}
function player(s: SliceState, id: SilentDiscipleMoveId, r = beginSilentDiscipleCombatRound(s, 'CONTROL'), rng = random(), physical = 1) { return resolveSilentDiscipleCombatAbility(s, id, physical, rng, r); }
function enemy(s: SliceState, id: Parameters<typeof resolveSilentDiscipleEnemyAbility>[1], r: ReturnType<typeof beginSilentDiscipleCombatRound>, physical = 1) { return resolveSilentDiscipleEnemyAbility(s, id, physical, random(), r); }
function play(s: SliceState, stance: SliceStance, values: number[], curse = false, madman: 'HOLD' | 'BURST_FIRST' = 'HOLD') {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolveSilentDiscipleCombatRound(s, stance, curse, madman); s.combatHistory.push(structuredClone(result.round)); s.revision++; expect(cursor).toBe(values.length); return result; }
  finally { spy.mockRestore(); }
}
const oldRoots = (s: SliceState) => structuredClone({ prisoner: s.prisoner, madman: s.madman, werewolf: s.werewolf, zombie: s.zombie, wraith: s.wraith, puppet: s.puppet });
afterEach(() => vi.restoreAllMocks());

describe('Silent Disciple finite original combat profile', () => {
  it('uses matching1–6 wheels and exact six action weights without automatic silence', () => {
    const s = fixture(); expect(SILENT_DISCIPLE_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL); expect(SILENT_DISCIPLE_ENEMY_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect(silentDiscipleAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    for (const [id] of profile) expect(drawSilentDiscipleAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 11, 26, 51, 76, 91].map(silentDiscipleActionCount)).toEqual([1, 2, 3, 4, 5, 6]); expect([1, 11, 26, 51, 76, 91].map(silentDiscipleEnemyActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(SILENT_DISCIPLE_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawSilentDiscipleEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'BREAK_CURSE', 'ACCIDENT']);
  });
  it('retains CHAINED50/20/15/15 and1250/120 budgets, enemyphysical22 and floor125', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', [1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 1]);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .5 + 20 * .2 + 30 * .15 + 40 * .15, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120)); expect(result.round.consequenceWeights).toBeNull(); expect(validateSilentDiscipleEncounter(s)).toBe(true);
  });
  it('requires the same actual source and rejects stale or changed resources without draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.mind--; },
      (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.silentDisciple.encounter.weaponLocation = 'COURT'; }]) {
      const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); change(s); const before = structuredClone(s), rng = random();
      expect(player(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL');
    expect(resolveSilentDiscipleCombatAbility(s, K, 1, random(), r, { ...r.source, targetId: 'SD3-ELSA' } as never).selfGain).toBe(0);
    s.progression.sequence = 4; expect(currentSilentDiscipleCombatSource(s)).toBeNull();
  });
  it('spends exactly three purchased originals and uses free ordinary16 fallback rather than refilling old blocks', () => {
    const s = fixture(), old = oldRoots(s), r = beginSilentDiscipleCombatRound(s, 'ATTACK');
    for (let i = 0; i < 3; i++) expect(player(s, H, r, random(), .2).selfGain).toBe(55 * .65);
    expect(s.spirituality).toBe(111); expect(player(s, H, r, random(), .2).selfGain).toBe(16 * .2); expect(s.spirituality).toBe(111);
    expect(s.silentDisciple.encounter.blocks.map(b => [b.id, b.owner, b.status, b.location])).toEqual(['1', '2', '3'].map(id => [`SD3-BLOCK-${id}`, 'PLAYER', 'SPENT', 'TARGET_GROUND']));
    expect(oldRoots(s)).toEqual(old); expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
  });
  it('keeps held original clubH and insufficientS fallback ordinary with no new object use', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = beginSilentDiscipleCombatRound(s, 'ATTACK'); expect(player(s, H, r).selfGain).toBe(16); expect(s.spirituality).toBe(120);
    const poor = fixture(); poor.spirituality = 1; const q = beginSilentDiscipleCombatRound(poor, 'ATTACK'); expect(player(poor, H, q).selfGain).toBe(16); expect(poor.silentDisciple.encounter.blocks.every(b => b.status === 'READY')).toBe(true);
  });
  it('retains exact old body/dodge costs and explicit first eligible Madman burst only', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'ATTACK', false, 'BURST_FIRST');
    expect(player(s, B, r).enemyReduction).toBe(17.55); expect(r.madman.triggered).toBe(false);
    expect(player(s, H, r).selfGain).toBe(55 * .65); expect(r.madman.triggered).toBe(false);
    expect(player(s, J, r).selfGain).toBe(29.575 * .65 * (1 + .25 * .65)); expect(player(s, J, r).selfGain).toBe(29.575 * .65);
    expect(s.spirituality).toBe(113); expect(s.mind).toBe(90); expect(r.madman).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
    const held = fixture(), q = beginSilentDiscipleCombatRound(held, 'ATTACK'); player(held, J, q); expect(held.mind).toBe(100); expect(held.spirituality).toBe(120);
  });
});

describe('One actual body, finite form and original rod', () => {
  it('defaults to paid current-target contact then paid60s form and preserves all body resources/injuries', () => {
    const s = fixture(), e = s.silentDisciple.encounter; e.enemyHealth = s.combat!.enemyHealth = 80;
    const injury: SliceInjury = { id: 'directed-old-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }; e.enemyInjuries = [injury]; s.combat!.enemyInjuries = structuredClone(e.enemyInjuries);
    const r = beginSilentDiscipleCombatRound(s, 'CONTROL'); player(s, K, r, random(1)); expect(e.link).toBe('LINKED'); expect(e.enemyForm).toBe('HUMAN'); expect(e.contactDistanceMetres).toBe(4);
    player(s, K, r, random(1)); expect(e).toMatchObject({ enemyForm: 'RABBIT', enemyFormUntilSeconds: 60, weaponLocation: 'COURT', enemyHealth: 80, enemyMind: 100, enemySpirituality: 120, form: 'HUMAN' });
    expect(s.combat!.enemyInjuries).toEqual([injury]); expect(s.spirituality).toBe(111); expect(s.mind).toBe(97); expect(r.madman.triggered).toBe(false);
    const rng = random(); player(s, K, r, rng); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(111); expect(e.enemyFormUntilSeconds).toBe(60);
    const o = finishSilentDiscipleCombatRound(s, r); expect(e).toMatchObject({ enemyForm: 'HUMAN', weaponLocation: 'COURT', enemyHealth: 80, enemyFormUntilSeconds: null }); expect(s.silentDisciple.life.clockSeconds).toBe(60); expect(validateSilentDiscipleRoundOutcome(o)).toBe(true);
  });
  it('resistance retains every paid cost and never produces a form, weapon drop or refund', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); player(s, K, r, random(1)); player(s, K, r, random(100));
    expect(s.silentDisciple.encounter).toMatchObject({ enemyForm: 'HUMAN', weaponLocation: 'HAND', transfigurationAttempts: 1, transfigurationSuccesses: 0 }); expect([s.spirituality, s.mind]).toEqual([111, 97]);
    expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
  });
  it('does not weaken earlier executed spells; later rabbit slots really use unarmed fallback', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70);
    player(s, K, r, random(1)); player(s, K, r, random(1)); expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(10); expect(enemy(s, 'WARD', r).selfGain).toBe(10); expect(enemy(s, 'BODY_STRIKE', r).selfGain).toBe(10);
    expect(r.enemyActions.map(a => a.paidCost)).toEqual([5, 0, 0, 0]); expect(s.silentDisciple.encounter.enemySpirituality).toBe(115); expect(r.enemyActions[0]!.selfGain).toBe(70);
    expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
  });
  it('mental BREAK_CURSE can restore the same body but leaves rod until a separate paid-in-time pickup slot', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); player(s, K, r, random(1)); player(s, K, r, random(1));
    expect(enemy(s, 'BREAK_CURSE', r).selfGain).toBe(8); expect(s.silentDisciple.encounter).toMatchObject({ enemyForm: 'HUMAN', weaponLocation: 'COURT', link: 'NONE', enemySpirituality: 116 });
    expect(enemy(s, 'ARC_BOLT', r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(r.enemyActions[1]).toMatchObject({ planned: 'ARC_BOLT', actual: 'PICK_UP', paidCost: 0 });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(70); expect(s.silentDisciple.encounter.enemySpirituality).toBe(111); expect(s.silentDisciple.encounter.pickUpUses).toBe(1);
    expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
  });
  it('elapsed-round restoration leaves rod on ground and next round original human must pick it up', () => {
    const s = fixture(), first = play(s, 'CONTROL', [11, 1, ticket(K, 'CONTROL'), 1, 96, ticket(K, 'CONTROL'), 1, 1]);
    expect(first.outcome).toBe('CONTINUE'); expect(s.silentDisciple.encounter.weaponLocation).toBe('COURT'); expect(validateSilentDiscipleEncounter(s)).toBe(true);
    const second = play(s, 'PREPARE', [1, 1, 1, ticket('OBSERVE', 'PREPARE'), 1]);
    expect(second.round.silentDiscipleOutcome!.enemyActions[0]).toMatchObject({ actual: 'PICK_UP', paidCost: 0, selfGain: 0 }); expect(validateSilentDiscipleEncounter(s)).toBe(true);
  });
  it('cannot spend unavailable physical or mental resources on contact/form and never redraws', () => {
    const s = fixture(); s.spirituality = 3; const r = beginSilentDiscipleCombatRound(s, 'CONTROL'), rng = random(); player(s, K, r, rng); expect(rng.cursor).toBe(0); expect(s.spirituality).toBe(3);
    const mind = fixture(); mind.mind = 1; const q = beginSilentDiscipleCombatRound(mind, 'CONTROL'); player(mind, K, q, random(1)); player(mind, K, q, random()); expect(mind.mind).toBe(0); expect(mind.spirituality).toBe(116);
  });
});

describe('Paid old self-curse, common wounds and strict replay', () => {
  it('requires explicit self-curse and actual original health loss before reflection', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL', true); player(s, K, r, random(1)); player(s, K, r, random(1)); enemy(s, 'BODY_STRIKE', r);
    expect(s.silentDisciple.encounter.form).toBe('WOOD'); expect([s.spirituality, s.mind]).toEqual([112, 99]);
    const wound: SliceInjury = { id: 'actual-self-wound', severity: 'LIGHT', acquiredRevision: s.revision + 1, treatedRevision: null }; s.injuries.push(wound);
    expect(reflectSilentDiscipleActualWound(s, wound, r)).toBeNull(); s.health -= 10;
    expect(reflectSilentDiscipleActualWound(s, wound, r)).toMatchObject({ playerDamage: 10, enemyDamage: 5 }); expect(s.health).toBe(90); expect(s.combat!.enemyHealth).toBe(95);
    expect(reflectSilentDiscipleActualWound(s, wound, r)).toBeNull(); expect(validateSilentDiscipleRoundOutcome(finishSilentDiscipleCombatRound(s, r))).toBe(true);
  });
  it('default short form never reflects actual wounds for free', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); player(s, K, r, random(1)); player(s, K, r, random(1));
    const wound: SliceInjury = { id: 'default-real-wound', severity: 'HEAVY', acquiredRevision: s.revision + 1, treatedRevision: null }; s.injuries.push(wound); s.health -= 30;
    expect(reflectSilentDiscipleActualWound(s, wound, r)).toBeNull(); expect(s.combat!.enemyHealth).toBe(100); expect(s.silentDisciple.encounter.form).toBe('HUMAN');
  });
  it('keeps simultaneous real deaths and gives player death priority without automatic +12 recovery', () => {
    const s = fixture(); s.health = 10; s.silentDisciple.encounter.enemyHealth = s.combat!.enemyHealth = 5;
    const result = play(s, 'CONTROL', [11, 1, ticket(K, 'CONTROL'), 1, 1, ticket(K, 'CONTROL'), 1, 1_000_000, 1], true);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat!.enemyHealth).toBe(0); expect(s.spirituality).toBe(112);
    expect(result.round.silentDiscipleOutcome).toMatchObject({ enemyForm: 'HUMAN', form: 'HUMAN', link: 'NONE', weaponLocation: 'COURT', continuing: false, playerHealthAfter: 0 });
    expect(s.silentDisciple.encounter.scene.playerPosition).toBe('COURT'); expect(validateSilentDiscipleRoundOutcome(result.round.silentDiscipleOutcome)).toBe(true);
  });
  it('replays all actual slot costs, form ordering, sources, expiry and ownership; rejects manufactured results', () => {
    const s = fixture(), r = beginSilentDiscipleCombatRound(s, 'CONTROL'); player(s, K, r, random(1)); player(s, K, r, random(1)); enemy(s, 'ARC_BOLT', r);
    const o = finishSilentDiscipleCombatRound(s, r); expect(validateSilentDiscipleRoundOutcome(o)).toBe(true);
    for (const forge of [(x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.playerMindAfter++; },
      (x: typeof o) => { x.weaponLocation = 'HAND'; }, (x: typeof o) => { x.elapsedSeconds = 0 as 60; }, (x: typeof o) => { x.enemyActions[0]!.paidCost = 5; },
      (x: typeof o) => { x.enemyActions[0]!.selfGain = 70; }, (x: typeof o) => { x.playerActions[1]!.succeeded = false; },
      (x: typeof o) => { x.source.targetId = 'SD3-ELSA' as never; }, (x: typeof o) => { x.source.distanceMetres = 99 as 2; },
      (x: typeof o) => { x.source.enemyHealth = 101; }, (x: typeof o) => { x.transfigurationSuccesses++; }, (x: typeof o) => { x.pickUpUses++; }]) {
      const bad = structuredClone(o); forge(bad); expect(validateSilentDiscipleRoundOutcome(bad)).toBe(false);
    }
  });
  it('ordinary successful retreat takes real4m exit, closes effects, preserves original enemy and history', () => {
    const s = fixture(), old = oldRoots(s), result = play(s, 'RETREAT', [1, 1, 1]); expect(result.outcome).toBe('RETREATED');
    settleSilentDiscipleEncounter(s, result.outcome, context()); expect(s.combat).toBeNull(); expect(s.silentDisciple.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4 });
    expect(s.silentDisciple.encounter.enemySpirituality).toBe(120); expect(oldRoots(s)).toEqual(old); expect(validateSilentDiscipleEncounter(s)).toBe(true);
    expect(projectSilentDiscipleCombat(s).summary).toContain('默认关闭');
  });
});
