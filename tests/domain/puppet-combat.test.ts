import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createPuppetState } from '../../src/domain/puppet/index.js';
import { baseAdvantage, consequenceWeights, playerAbilityWheel, playerCountWheel } from '../../src/domain/slice/combat.js';
import { resolvePuppetCombatRound } from '../../src/domain/slice/puppet-combat.js';
import type { SliceState, SliceStance, SliceInjury } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { PUPPET_COUNT_WHEEL, PUPPET_ENEMY_COUNT_WHEEL, PUPPET_ENEMY_ABILITY_WHEEL, isPuppet,
  puppetAbilityWheel, puppetActionCount, puppetEnemyActionCount, drawPuppetAbility, drawPuppetEnemyAbility,
  currentPuppetCombatSource, beginPuppetCombatRound, resolvePuppetCombatAbility, resolvePuppetEnemyAbility,
  finishPuppetCombatRound, validatePuppetRoundOutcome, projectPuppetCombat, reflectPuppetActualWound, type PuppetMoveId } from '../../src/domain/puppet/combat.js';
import { applyPuppetEncounterCommand, puppetEncounterReason, hasPuppetDisputeOpponent,
  projectPuppetEncounter, settlePuppetEncounter, validatePuppetEncounter, validatePuppetEncounterCommand } from '../../src/domain/puppet/encounter.js';
import { WRAITH_COUNT_WHEEL } from '../../src/domain/wraith/combat.js';

const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s4.curse-link', R = 'OBSERVE';
const profile: readonly [PuppetMoveId, number, SliceStance | null][] = [[H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null]];
function ticket(id: PuppetMoveId, stance: SliceStance | null): number {
  let n = 1; for (const [candidate, weight, preferred] of profile) { if (id === candidate) return n; n += weight * (stance !== null && preferred === stance ? 5 : 4); }
  throw new Error('Missing action');
}
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'puppet-directed', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${cursor}: ${n}, ${min}..${max}`); return n;
  } };
}
function context(): SeerContext { return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 20, difficulty, modifiers: [], roll: 1 }) }; }
/** Directed combat fixture, never evidence of natural acquisition or life progress. */
function fixture(start = true, purchase = true): SliceState {
  const s = createSliceRun('puppet-combat-directed', sliceDefaultCreationSelection, 'puppet-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 110; s.actionsRemaining = 6; s.cash = 1000;
  s.character.coreStats = { physique: 20, perception: 20, will: 20, knowledge: 20 };
  s.progression = { pathwayId: 'chained', sequence: 4, mastery: { [H]: 0, [K]: 0, 'chained.s4.cursed-form': 0, 'chained.s5.spirit-possession': 0, 'chained.s6.steel-body': 0, 'chained.s8.reason-sacrifice': 0 }, acting: 0, promotionWeek: 110 };
  s.puppet = createPuppetState(); s.puppet.promotionWeek = 110; s.puppet.wraithActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.town.clubLocation = 'SHOP'; s.arc.stage = 'ENDED';
  s.puppet.life.cases['moving-token'].status = 'RESOLVED';
  if (purchase) applyPuppetEncounterCommand(s, { type: 'PURCHASE_BLOCKS' }, context());
  if (start) applyPuppetEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
  return s;
}
function effect(s: SliceState, id: PuppetMoveId, r = beginPuppetCombatRound(s, 'ATTACK'), rng = random(), physical = 1) {
  return resolvePuppetCombatAbility(s, id, physical, rng, r);
}
function enemy(s: SliceState, id: Parameters<typeof resolvePuppetEnemyAbility>[1], r: ReturnType<typeof beginPuppetCombatRound>, physical = 1) {
  return resolvePuppetEnemyAbility(s, id, physical, random(), r);
}
function play(s: SliceState, stance: SliceStance, values: number[], curse = false, madman: 'HOLD' | 'BURST_FIRST' = 'HOLD') {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function(this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[cursor++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected shared draw ${cursor}: ${n}, ${min}..${max}`); return n;
  });
  try { const result = resolvePuppetCombatRound(s, stance, curse, madman); s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result; }
  finally { spy.mockRestore(); }
}
const twoK = (lastEnemy = 61, wound = 1) => [13, 1, ticket(K, 'CONTROL'), 1, 1, ticket(K, 'CONTROL'), 1, lastEnemy, 1_000_000, wound];
function oldStates(s: SliceState) { return structuredClone({ prisoner: s.prisoner, madman: s.madman, werewolf: s.werewolf, zombie: s.zombie, wraith: s.wraith }); }
afterEach(() => vi.restoreAllMocks());

describe('Puppet exact inherited profile and finite original encounter', () => {
  it('keeps inherited1–6 and six slots, with actual2–4 original enemy actions', () => {
    const s = fixture(); expect(PUPPET_COUNT_WHEEL).toEqual(WRAITH_COUNT_WHEEL); expect(playerCountWheel(s)).toEqual(PUPPET_COUNT_WHEEL);
    expect(puppetAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]); expect(playerAbilityWheel(s, null)).toEqual(puppetAbilityWheel(s, null));
    for (const [id] of profile) expect(drawPuppetAbility(random(ticket(id, 'CONTROL')), s, 'CONTROL')).toBe(id);
    expect([1, 13, 33, 58, 81, 95].map(puppetActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PUPPET_ENEMY_COUNT_WHEEL.map(a => a.weight)).toEqual([20, 50, 30]);
    expect([1, 20, 21, 70, 71, 100].map(puppetEnemyActionCount)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(PUPPET_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
    expect([1, 36, 61, 86, 96].map(n => drawPuppetEnemyAbility(random(n)))).toEqual(['ARC_BOLT', 'WARD', 'BODY_STRIKE', 'BREAK_LINK', 'ACCIDENT']);
  });
  it('uses actual CHAINED50/20/15/15 core,1250/floor125, enemy850/floor85', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = play(s, 'ATTACK', [1, 1, ticket('ACCIDENT', 'ATTACK'), 96, 96, 1]);
    expect(result.round.playerAdvantage).toBe(baseAdvantage(10 * .5 + 20 * .2 + 30 * .15 + 40 * .15, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 40, 850, 40)); expect(result.round.consequenceWeights).toBeNull();
    expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('buys only three actual originals for60p and0AP, never refills or transfers the enemy club', () => {
    const s = fixture(false, false), old = oldStates(s); s.actionsRemaining = 0;
    expect(s.puppet.encounter.blocks).toEqual([]); applyPuppetEncounterCommand(s, { type: 'PURCHASE_BLOCKS' }, context());
    expect(s.cash).toBe(940); expect(s.actionsRemaining).toBe(0);
    expect(s.puppet.encounter.blocks.map(b => b.id)).toEqual(['PU4-BLOCK-1', 'PU4-BLOCK-2', 'PU4-BLOCK-3']);
    expect(() => applyPuppetEncounterCommand(s, { type: 'PURCHASE_BLOCKS' }, context())).toThrow('唯一');
    s.actionsRemaining = 1; applyPuppetEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(oldStates(s)).toEqual(old); expect(s.town.clubLocation).toBe('SHOP');
    expect(currentPuppetCombatSource(s)).toMatchObject({ targetId: 'PU4-EDRIN-VALE', distanceMetres: 2, targetSequence: 5, actualOriginalBody: true, ordinaryExit: true, pursuit: false, enemyWeapon: 'PU4-EDRIN-CLUB' });
    expect(projectPuppetEncounter(s).encounter!.abilities.map(a => a.cost)).toEqual([5, 3, 3]); expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('requires a closed report, no active practice or moon, enough money and a single encounter', () => {
    const s = fixture(false, false); s.cash = 59;
    expect(puppetEncounterReason(s, { type: 'PURCHASE_BLOCKS' })).toContain('60'); s.cash = 1000;
    s.puppet.life.cases['moving-token'].status = 'AVAILABLE'; expect(puppetEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('报告');
    s.puppet.life.cases['moving-token'].status = 'RESOLVED'; s.puppet.life.body.form = 'WOOD';
    expect(puppetEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('关闭'); s.puppet.life.body.form = 'HUMAN';
    s.puppet.life.moon.pendingId = 'PU4-MOON-1'; expect(puppetEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toContain('月相'); s.puppet.life.moon.pendingId = null;
    applyPuppetEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.combat).toBeNull(); expect(s.puppet.encounter.enemySpirituality).toBe(40);
    expect(validatePuppetEncounter(s)).toBe(true); expect(() => applyPuppetEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow('不能');
    expect(validatePuppetEncounterCommand({ type: 'ENCOUNTER_FIGHT', revive: true })).toBe(false);
    expect(validatePuppetEncounterCommand({ type: 'PURCHASE_BLOCKS', quantity: 9 })).toBe(false);
  });
  it('rejects stale source, mutated resources, other opponents and future3 without costs or draws', () => {
    for (const change of [(s: SliceState) => { s.revision++; }, (s: SliceState) => { s.health--; }, (s: SliceState) => { s.mind--; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.spirituality--; }, (s: SliceState) => { s.puppet.encounter.blocks[0]!.status = 'SPENT'; }]) {
      const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL', true); change(s); const before = structuredClone(s), rng = random();
      expect(effect(s, K, r, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0 }); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    }
    const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL', true);
    expect(resolvePuppetCombatAbility(s, K, 1, random(), r, { ...r.source, targetId: 'BEVAN' } as never).selfGain).toBe(0);
    s.progression.sequence = 3; expect(isPuppet(s)).toBe(false); expect(currentPuppetCombatSource(s)).toBeNull(); expect(hasPuppetDisputeOpponent(s)).toBe(false);
    expect(() => resolvePuppetCombatRound(s, 'ATTACK')).toThrow('来源');
  });
});

describe('Finite original wood and inherited CHAINED costs', () => {
  it('spends three different originals, then uses old spiritH without copying, picking up or refunding', () => {
    const s = fixture(), old = oldStates(s), r = beginPuppetCombatRound(s, 'ATTACK');
    for (let n = 0; n < 3; n++) expect(effect(s, H, r, random(), .2).selfGain).toBe(55 * .65);
    expect(effect(s, H, r, random(), .2).selfGain).toBe(54.925 * .65);
    expect(s.puppet.encounter.blocks.every(b => b.status === 'SPENT' && b.location === 'TARGET_GROUND' && b.usedRound === 1)).toBe(true);
    expect(s.spirituality).toBe(108); expect(oldStates(s)).toEqual(old);
    expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
  it('held ownclub replaces H; J scales steel-body mastery and body, B costs2 for fixed17.55', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; const r = beginPuppetCombatRound(s, 'ATTACK');
    expect(effect(s, H, r, random(), .5).selfGain).toBe(8); expect(s.spirituality).toBe(120);
    expect(effect(s, J, r, random(), .5).selfGain).toBe(29.575 * .65 * .5);
    expect(effect(s, B, r, random(), .5).enemyReduction).toBe(17.55); expect(s.spirituality).toBe(118);
    expect(s.puppet.encounter.blocks.every(b => b.status === 'READY')).toBe(true); expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
  it.each([0, 1])('low spirituality%s uses ordinary12 and8, preserving blocks and no debt', spirituality => {
    const s = fixture(); s.spirituality = spirituality; const r = beginPuppetCombatRound(s, 'ATTACK');
    expect(effect(s, H, r).selfGain).toBe(12); expect(effect(s, B, r).enemyReduction).toBe(8); expect(s.spirituality).toBe(spirituality);
    expect(s.puppet.encounter.blocks.every(b => b.status === 'READY')).toBe(true); expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
  it('retains optional inherited firstphysical burst with exact10M2S and no burst on spiritual H', () => {
    const s = fixture(), old = oldStates(s), r = beginPuppetCombatRound(s, 'ATTACK', false, 'BURST_FIRST');
    effect(s, H, r); expect(s.mind).toBe(100); expect(s.spirituality).toBe(117);
    expect(effect(s, J, r).selfGain).toBe(29.575 * .65 * (1 + .25 * .65));
    expect(effect(s, J, r).selfGain).toBe(29.575 * .65); expect(s.mind).toBe(90); expect(s.spirituality).toBe(115);
    expect(oldStates(s)).toEqual(old); expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
  it('exact10M inherited burst leaves real0M in the already open fight without erasing or inventing death', () => {
    const s = fixture(); s.mind = 10;
    const result = play(s, 'ATTACK', [1, 1, ticket(J, 'ATTACK'), 96, 96, 1_000_000], false, 'BURST_FIRST');
    expect(result.outcome).toBe('CONTINUE'); expect(s.mind).toBe(0); expect(s.health).toBe(100);
    expect(result.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(result.round.puppetOutcome!.enemyActions).toHaveLength(2); expect(hasPuppetDisputeOpponent(s)).toBe(true); expect(validatePuppetEncounter(s)).toBe(true);
    play(s, 'PREPARE', [1, 1, 96, ticket(R, 'PREPARE'), 96, 1]);
    expect(s.mind).toBe(0); expect(s.health).toBe(100); expect(validatePuppetEncounter(s)).toBe(true);
    const unopened = fixture(false); unopened.mind = 0;
    expect(puppetEncounterReason(unopened, { type: 'ENCOUNTER_FIGHT' })).toContain('实际行动');
  });
  it('R and accident do not heal, prepare, restore originals or regain resources', () => {
    const s = fixture(); s.health = 70; const r = beginPuppetCombatRound(s, 'PREPARE'), before = structuredClone(s);
    expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5);
    expect(s).toEqual(before); expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
});

describe('Optional paid contact and later own curse-source form', () => {
  it('default policy never contacts or curses, while true pays3 plus4 with actual2m contact route', () => {
    const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL'); effect(s, K, r); expect(s.spirituality).toBe(120);
    expect(s.puppet.encounter).toMatchObject({ link: 'NONE', form: 'HUMAN', contactAttempts: 0 }); expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
    const t = fixture(), q = beginPuppetCombatRound(t, 'CONTROL', true); effect(t, K, q, random(1));
    expect(t.puppet.encounter).toMatchObject({ link: 'LINKED', linkRound: 1, form: 'HUMAN', contactDistanceMetres: 2 }); expect(t.spirituality).toBe(117);
    effect(t, K, q, random(1)); expect(t.puppet.encounter.form).toBe('WOOD'); expect(t.spirituality).toBe(113);
    expect(t.health).toBe(100); expect(t.combat!.enemyHealth).toBe(100); effect(t, K, q); expect(t.spirituality).toBe(113);
    expect(validatePuppetRoundOutcome(finishPuppetCombatRound(t, q))).toBe(true); expect(t.puppet.encounter.form).toBe('HUMAN');
  });
  it('resisted contact or form keeps real costs and failed form cannot retry that round', () => {
    const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL', true);
    effect(s, K, r, random(100)); expect(s.puppet.encounter).toMatchObject({ link: 'NONE', contactAttempts: 1, contactDistanceMetres: 2 });
    effect(s, K, r, random(1)); effect(s, K, r, random(100)); effect(s, K, r);
    expect(s.spirituality).toBe(110); expect(s.puppet.encounter).toMatchObject({ link: 'LINKED', form: 'HUMAN', formAttempts: 1, contactDistanceMetres: 4 });
    expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
  });
  it('insufficient contact/form budgets do not invent attempts, links, form or debt', () => {
    for (const funds of [0, 2, 3, 6]) {
      const s = fixture(); s.spirituality = funds; const r = beginPuppetCombatRound(s, 'CONTROL', true);
      effect(s, K, r, funds >= 3 ? random(1) : random()); effect(s, K, r);
      expect(s.spirituality).toBe(funds >= 3 ? funds - 3 : funds); expect(s.puppet.encounter.formAttempts).toBe(0);
      expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
    }
  });
  it('enemyBREAK_LINK pays3, keeps8 contribution and original bodies; insufficientS uses ownclub', () => {
    const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL', true); effect(s, K, r, random(1)); effect(s, K, r, random(1));
    expect(enemy(s, 'BREAK_LINK', r)).toMatchObject({ selfGain: 8, threatens: false });
    expect(s.puppet.encounter).toMatchObject({ link: 'NONE', form: 'WOOD', enemySpirituality: 37, breakLinkUses: 1 }); expect(s.health).toBe(100);
    expect(validatePuppetRoundOutcome(finishPuppetCombatRound(s, r))).toBe(true);
    const t = fixture(); t.puppet.encounter.powerUses.ARC_BOLT = 8; t.puppet.encounter.enemySpirituality = 0;
    const q = beginPuppetCombatRound(t, 'CONTROL', true); effect(t, K, q, random(1));
    expect(enemy(t, 'BREAK_LINK', q, .5)).toMatchObject({ selfGain: 9, threatens: true }); expect(t.puppet.encounter.link).toBe('LINKED');
    expect(q.enemyActions[0]).toMatchObject({ planned: 'BREAK_LINK', actual: 'BODY_STRIKE', paidCost: 0, linkBroken: false });
    expect(validatePuppetRoundOutcome(finishPuppetCombatRound(t, q))).toBe(true);
  });
  it('link lasts planting plus two rounds, or is voluntarily stopped at next default-policy start', () => {
    const s = fixture(); play(s, 'CONTROL', [1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1], true);
    play(s, 'PREPARE', [1, 1, 96, ticket(R, 'PREPARE'), 96, 1], true); expect(s.puppet.encounter.link).toBe('LINKED');
    play(s, 'PREPARE', [1, 1, ticket(R, 'PREPARE'), 96, 96, 1], true); expect(s.puppet.encounter.link).toBe('NONE'); expect(validatePuppetEncounter(s)).toBe(true);
    const t = fixture(); play(t, 'CONTROL', [1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1], true);
    play(t, 'CONTROL', [1, 1, 96, ticket(K, 'CONTROL'), 96, 1]); expect(t.puppet.encounter.link).toBe('NONE'); expect(t.puppet.encounter.contactAttempts).toBe(1);
    expect(validatePuppetEncounter(t)).toBe(true);
  });
});

describe('Actual common injuries, reflected original wounds and terminal priority', () => {
  it.each([[1, 10, 5, 'LIGHT'], [66, 30, 15, 'HEAVY']] as const)('reflects real wound roll%s without removing any player loss', (roll, playerDamage, enemyDamage, severity) => {
    const s = fixture(), old = oldStates(s), result = play(s, 'CONTROL', twoK(61, roll), true);
    expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(100 - playerDamage); expect(s.combat!.enemyHealth).toBe(100 - enemyDamage);
    expect(s.injuries.at(-1)!.severity).toBe(severity); expect(s.combat!.enemyInjuries.at(-1)!.severity).toBe(severity);
    expect(s.puppet.encounter).toMatchObject({ form: 'HUMAN', link: 'LINKED', enemySpirituality: 35 });
    expect(result.round.puppetOutcome!.reflection).toMatchObject({ round: 1, playerDamage, enemyDamage, severity });
    expect(oldStates(s)).toEqual(old); expect(validatePuppetRoundOutcome(result.round.puppetOutcome)).toBe(true); expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('no wound means no reflection; active form is no free invulnerability or automatic enemy damage', () => {
    const s = fixture(), result = play(s, 'CONTROL', [13, 1, ticket(K, 'CONTROL'), 1, 36, ticket(K, 'CONTROL'), 1, 36, 1_000_000], true);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.health).toBe(100); expect(s.combat!.enemyHealth).toBe(100); expect(s.puppet.encounter.reflectionHistory).toEqual([]);
    expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('real BREAK_LINK before the consequence prevents reflection but preserves the full original wound', () => {
    const s = fixture(), result = play(s, 'CONTROL', twoK(86, 66), true);
    expect(s.health).toBe(70); expect(s.combat!.enemyHealth).toBe(100); expect(result.round.puppetOutcome!.reflection).toBeNull();
    expect(s.puppet.encounter).toMatchObject({ enemySpirituality: 32, link: 'NONE', form: 'HUMAN' }); expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('rejects invented wounds or repeated reflection calls', () => {
    const s = fixture(), r = beginPuppetCombatRound(s, 'CONTROL', true); effect(s, K, r, random(1)); effect(s, K, r, random(1));
    const injury: SliceInjury = { id: 'actual-directed-injury', severity: 'LIGHT', acquiredRevision: s.revision + 1, treatedRevision: null };
    expect(reflectPuppetActualWound(s, injury, r)).toBeNull(); s.injuries.push(injury); expect(reflectPuppetActualWound(s, injury, r)).toBeNull();
    s.health -= 10; expect(reflectPuppetActualWound(s, injury, r)).toMatchObject({ playerDamage: 10, enemyDamage: 5 });
    expect(reflectPuppetActualWound(s, injury, r)).toBeNull(); expect(s.combat!.enemyHealth).toBe(95);
  });
  it.each([[30, 15, 'PLAYER_DEAD', 0, 'DEAD'], [100, 15, 'ENEMY_DEAD', 70, 'DEAD'], [100, 50, 'ENEMY_SURRENDERED', 70, 'SURRENDERED']] as const)('low actual originals H%s/%s resolve%s with playerdeath priority', (health, enemyHealth, outcome, afterHealth, enemyStatus) => {
    const s = fixture(); s.health = health; s.combat!.enemyHealth = enemyHealth; s.puppet.encounter.enemyHealth = enemyHealth;
    const result = play(s, 'CONTROL', twoK(61, 66), true); expect(result.outcome).toBe(outcome);
    expect(s.health).toBe(afterHealth); expect(s.combat!.enemyHealth).toBe(enemyHealth - 15); expect(s.combat!.enemyStatus).toBe(enemyStatus);
    expect(s.injuries.at(-1)!.severity).toBe('HEAVY'); expect(s.combat!.enemyInjuries.at(-1)!.severity).toBe('HEAVY');
    expect(s.puppet.encounter).toMatchObject({ link: 'NONE', form: 'HUMAN' }); expect(s.spirituality).toBe(113);
    expect(validatePuppetRoundOutcome(result.round.puppetOutcome)).toBe(true); settlePuppetEncounter(s, outcome, context()); expect(s.combat).toBeNull();
  });
  it('commonDEATH is still real, does not fabricate a light/heavy reflection or revive either original', () => {
    const s = fixture(), result = play(s, 'CONTROL', twoK(61, 96), true);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat!.enemyHealth).toBe(100);
    expect(result.round.puppetOutcome!.reflection).toBeNull(); settlePuppetEncounter(s, result.outcome, context()); s.status = 'DEAD'; expect(validatePuppetEncounter(s)).toBe(true);
  });
  it('ordinary enemy light/heavy/death retain common65/30/5 and only continuing12S regen', () => {
    for (const [roll, health, outcome] of [[1, 90, 'CONTINUE'], [66, 70, 'ENEMY_SURRENDERED'], [96, 0, 'ENEMY_DEAD']] as const) {
      const s = fixture(), result = play(s, 'ATTACK', [1, 1, ticket(H, 'ATTACK'), 36, 96, 1, roll]);
      expect(result.outcome).toBe(outcome); expect(s.combat!.enemyHealth).toBe(health); expect(result.round.consequenceWeights).toEqual(consequenceWeights(0));
      expect(s.spirituality).toBe(outcome === 'CONTINUE' ? 120 : 117); expect(s.puppet.encounter.blocks[0]!.location).toBe('TARGET_GROUND');
      if (outcome !== 'CONTINUE') settlePuppetEncounter(s, outcome, context()); expect(validatePuppetEncounter(s)).toBe(true);
    }
  });
  it('ordinary retreat keeps all originals, paid resources and public copies without a new encounter', () => {
    const s = fixture(); play(s, 'CONTROL', [1, 1, ticket(K, 'CONTROL'), 1, 96, 96, 1], true);
    const result = play(s, 'RETREAT', [1, 1, 1, 1], true); expect(result.outcome).toBe('RETREATED');
    expect(s.puppet.encounter).toMatchObject({ form: 'HUMAN', link: 'NONE', enemySpirituality: 35 });
    settlePuppetEncounter(s, result.outcome, context()); expect(validatePuppetEncounter(s)).toBe(true);
    const publicState = projectPuppetEncounter(s).encounter!; publicState.blocks[0]!.status = 'SPENT'; expect(s.puppet.encounter.blocks[0]!.status).toBe('READY');
    const combatProjection = projectPuppetCombat(s); expect(combatProjection.summary).toContain('本人真实'); expect(combatProjection.source).toBeNull();
  });
  it('replay validators reject fabricated costs, refunded blocks, hidden free links and erased injuries', () => {
    const s = fixture(), result = play(s, 'CONTROL', twoK(), true), original = result.round.puppetOutcome!;
    for (const mutate of [(o: typeof original) => { o.playerSpiritualityAfter++; }, (o: typeof original) => { o.enemySpirituality++; },
      (o: typeof original) => { o.reflection!.enemyDamage = 15; }, (o: typeof original) => { o.form = 'WOOD' as never; },
      (o: typeof original) => { o.contactDistanceMetres = 0; }, (o: typeof original) => { o.cursePolicy = false; }]) {
      const changed = structuredClone(original); mutate(changed); expect(validatePuppetRoundOutcome(changed)).toBe(false);
    }
    s.injuries = []; expect(validatePuppetEncounter(s)).toBe(false);
    const t = fixture(), round = play(t, 'ATTACK', [1, 1, ticket(H, 'ATTACK'), 96, 96, 1, 1]);
    round.round.puppetOutcome!.blocks[0]!.status = 'READY'; expect(validatePuppetRoundOutcome(round.round.puppetOutcome)).toBe(false);
  });
});
