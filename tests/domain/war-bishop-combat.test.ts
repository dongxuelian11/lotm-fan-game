import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createWarBishopState } from '../../src/domain/war-bishop/index.js';
import { applyWarBishopEncounterCommand } from '../../src/domain/war-bishop/encounter.js';
import { PYROMANIAC_COUNT_WHEEL } from '../../src/domain/pyromaniac/combat.js';
import { WAR_BISHOP_COUNT_WHEEL, WAR_BISHOP_ENEMY_COUNT_WHEEL, WAR_BISHOP_ENEMY_ABILITY_WHEEL,
  warBishopActionCount, warBishopEnemyActionCount, warBishopAbilityWheel, drawWarBishopAbility, drawWarBishopEnemyAbility,
  beginWarBishopCombatRound, currentWarBishopCombatSource, resolveWarBishopCombatAbility, resolveWarBishopEnemyAbility,
  finishWarBishopCombatRound, shareWarBishopHealthDamage, validateWarBishopRoundOutcome, projectWarBishopCombat,
  type WarBishopMoveId, type WarBishopPolicy, type WarBishopCombatSource } from '../../src/domain/war-bishop/combat.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No random check in this fixture'); } };
const noRandom: ActionRandomStream = { seed: 'wb3-unit-no-draw', cursor: 0, nextInt() { throw new Error('Unexpected draw'); } };
/** Directed post-promotion unit fixture. Keeps actual original member H/E and
 * prior endings; it is not evidence of natural promotion or combat victory. */
function fixture(companions = true): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json', 'utf8')).final);
  s.warBishop = createWarBishopState(); s.warBishop.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['hunter.s3.formation-link'] = 0; s.progression.mastery['hunter.s3.coordinated-action'] = 0;
  s.actionsRemaining = 3; s.cash = 400; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyWarBishopEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  if (companions) applyWarBishopEncounterCommand(s, { type: 'CALL_COMPANIONS' }, context);
  applyWarBishopEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState, policy: WarBishopPolicy = 'HOLD') => beginWarBishopCombatRound(s, 'ATTACK', noRandom, policy);
const effect = (s: SliceState, id: WarBishopMoveId, r: ReturnType<typeof begin>, source: WarBishopCombatSource | null = r.source) => resolveWarBishopCombatAbility(s, id, 1, noRandom, r, source);
const enemy = (s: SliceState, id: Parameters<typeof resolveWarBishopEnemyAbility>[1], r: ReturnType<typeof begin>) => resolveWarBishopEnemyAbility(s, id, 1, noRandom, r);
function finish(s: SliceState, r: ReturnType<typeof begin>) { const o = finishWarBishopCombatRound(s, r); expect(validateWarBishopRoundOutcome(o)).toBe(true); return o; }

describe('War Bishop finite original-team combat', () => {
  it('keeps both exact six-slot count wheels, inherited budgets and only two new ability IDs', () => {
    const s = fixture(); expect(WAR_BISHOP_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL); expect(WAR_BISHOP_ENEMY_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect([1, 11, 26, 51, 76, 91].map(warBishopActionCount)).toEqual([1, 2, 3, 4, 5, 6]); expect([1, 11, 26, 51, 76, 91].map(warBishopEnemyActionCount)).toEqual([1, 2, 3, 4, 5, 6]);
    const wheel = warBishopAbilityWheel(s, null); expect(wheel.reduce((n, a) => n + a.weight, 0)).toBeCloseTo(100);
    expect(wheel.filter(a => a.id.startsWith('hunter.s3.')).map(a => a.id)).toEqual(['hunter.s3.formation-link', 'hunter.s3.coordinated-action']);
    for (const id of ['IRON_BLOOD_FLAME', 'IRON_BLOOD_STEEL', 'hunter.s4.comrade-link', 'hunter.s5.precision-strike', 'hunter.s7.compressed-fireball']) expect(wheel.some(a => a.id === id)).toBe(true);
    const first: ActionRandomStream = { seed: 'directed-first', cursor: 0, nextInt: min => min };
    expect(drawWarBishopAbility(first, s, 'ATTACK')).toBe('IRON_BLOOD_FLAME'); expect(drawWarBishopEnemyAbility(first)).toBe('ARC_BOLT');
    expect(WAR_BISHOP_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([35, 25, 25, 10, 5]);
  });
  it('has one new adult original caster and original weapon, never the old surrendered Garrick', () => {
    const s = fixture(), old = structuredClone(s.ironBloodKnight.encounter), r = begin(s);
    expect(currentWarBishopCombatSource(s)).toMatchObject({ targetId: 'WB3-CEDRIC-VALE', targetAge: 42, targetSequence: 3, enemyWeapon: 'WB3-CEDRIC-CLUB', independentMind: true, ordinaryExit: true, pursuit: false });
    expect(enemy(s, 'ARC_BOLT', r).selfGain).toBe(75); expect(enemy(s, 'WARD', r).enemyReduction).toBe(45); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(0);
    expect(s.warBishop.encounter.enemySpirituality).toBe(111); expect(s.spirituality).toBe(120); expect(s.ironBloodKnight.encounter).toEqual(old); finish(s, r);
  });
  it('defaults to HOLD without paying or inventing ordinary team contribution', () => {
    const s = fixture(), before = structuredClone(s.ironBloodKnight.team.members), r = begin(s);
    expect(effect(s, 'hunter.s3.formation-link', r).enemyReduction).toBe(0); expect(effect(s, 'hunter.s3.coordinated-action', r).selfGain).toBe(0);
    expect(s.spirituality).toBe(120); expect(s.ironBloodKnight.team.members).toEqual(before); expect(finish(s, r)).toMatchObject({ policy: 'HOLD', linkCost: 0, teamContribution: 0, payments: [] });
  });
  it('pays 5 original SP and each original member2 E once without resetting prior injuries or histories', () => {
    const s = fixture(), before = structuredClone(s.ironBloodKnight.team.members), r = begin(s, 'LINK_IF_READY');
    expect(s.spirituality).toBe(115); expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([16, 16, 16, 16, 16]);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health)).toEqual([99, 99, 100, 100, 100]);
    expect(s.ironBloodKnight.team.members.slice(5)).toEqual(before.slice(5)); expect(s.ironBloodKnight.team.members[0]!.cohortActivities).toEqual(before[0]!.cohortActivities);
    const o = finish(s, r); expect(o.linkedMemberIds).toHaveLength(5); expect(o.linkedMemberIdsAfter).toEqual([]); expect(o.elapsedSeconds).toBe(60); expect(s.warBishop.encounter.linkedMemberIds).toEqual([]);
    expect(s.ironBloodKnight.team.members[0]!.energy).toBe(16);
  });
  it('does not pay when one invited original refuses, is unsafe, fatigued, or owner lacks5 SP', () => {
    for (const change of [(s: SliceState) => { s.ironBloodKnight.team.members[0]!.willing = false; }, (s: SliceState) => { s.ironBloodKnight.team.members[0]!.health = 49; },
      (s: SliceState) => { s.ironBloodKnight.team.members[0]!.energy = 1; }, (s: SliceState) => { s.spirituality = 4; }]) {
      const s = fixture(); change(s); const before = structuredClone(s.ironBloodKnight.team.members), spirit = s.spirituality, r = begin(s, 'LINK_IF_READY');
      expect(r.model.linkCost).toBe(0); expect(s.spirituality).toBe(spirit); expect(s.ironBloodKnight.team.members).toEqual(before); finish(s, r);
    }
    const solo = fixture(false), r = begin(solo, 'LINK_IF_READY'); expect(r.model.linkCost).toBe(0); expect(solo.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true); finish(solo, r);
  });
  it('shares a total20 team budget between genuine coordinated actions and inherited borrowing', () => {
    const s = fixture(), r = begin(s, 'LINK_IF_READY'); expect(effect(s, 'hunter.s3.coordinated-action', r)).toMatchObject({ selfGain: 20, threatens: true });
    expect(effect(s, 'hunter.s3.formation-link', r).enemyReduction).toBe(0); expect(effect(s, 'hunter.s4.comrade-link', r).selfGain).toBe(0); expect(s.spirituality).toBe(115);
    expect(finish(s, r).teamContribution).toBe(20);
    const other = fixture(), rr = begin(other, 'LINK_IF_READY'); expect(effect(other, 'hunter.s4.comrade-link', rr).selfGain).toBe(20);
    expect(other.spirituality).toBe(112); expect(other.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([13, 13, 13, 13, 13]);
    expect(effect(other, 'hunter.s3.coordinated-action', rr).selfGain).toBe(0); finish(other, rr);
  });
  it('retains real personal flame, steel and weapon sources without gifting old paper, lamp or traps', () => {
    const s = fixture(), old = structuredClone([s.town, s.hunter, s.magician]), r = begin(s);
    expect(effect(s, 'STRIKE', r).selfGain).toBe(12); expect(effect(s, 'IRON_BLOOD_FLAME', r).selfGain).toBeCloseTo(55 * (.65 + .35 * 8 / 500));
    expect(effect(s, 'IRON_BLOOD_STEEL', r).enemyReduction).toBe(18); expect(effect(s, 'hunter.s7.compressed-fireball', r).selfGain).toBe(36);
    expect(effect(s, 'hunter.s7.fire-raven', r).selfGain).toBe(24); expect(s.spirituality).toBe(108); expect([s.town, s.hunter, s.magician]).toEqual(old); finish(s, r);
    const armed = fixture(); armed.town.clubLocation = 'HAND'; const a = begin(armed); expect(effect(armed, 'STRIKE', a).selfGain).toBe(16); finish(armed, a);
  });
  it('uses only its own actual weakness window and consumes it for two real SP', () => {
    const s = fixture(), old = structuredClone(s.ironBloodKnight.encounter.weakness), r = begin(s);
    expect(effect(s, 'hunter.s5.precision-strike', r).selfGain).toBe(12); effect(s, 'hunter.s5.weakness-observation', r);
    expect(effect(s, 'hunter.s5.precision-strike', r).selfGain).toBeGreaterThan(12); expect(s.spirituality).toBe(116);
    expect(s.warBishop.encounter.weakness).toMatchObject({ available: false, observations: 1, uses: 1 }); expect(s.ironBloodKnight.encounter.weakness).toEqual(old); finish(s, r);
  });
  it('keeps enemy depletion and ordinary fallback at zero without replenishment', () => {
    const s = fixture(); s.warBishop.encounter.powerUses.ARC_BOLT = 24; s.warBishop.encounter.enemySpirituality = 0; const r = begin(s);
    expect(enemy(s, 'ARC_BOLT', r)).toMatchObject({ selfGain: 20, threatens: true }); expect(enemy(s, 'WARD', r).selfGain).toBe(20);
    expect(s.warBishop.encounter.enemySpirituality).toBe(0); expect(s.warBishop.encounter.powerUses.ARC_BOLT).toBe(24); finish(s, r);
  });
  it('rejects stale or substituted original sources and external resource changes without spending', () => {
    const s = fixture(), r = begin(s), before = structuredClone(s);
    for (const wrong of [null, { ...r.source, targetId: 'IB4-GARRICK' }, { ...r.source, enemyWeapon: 'COPY' }, { ...r.source, round: 2 }])
      expect(effect(s, 'IRON_BLOOD_FLAME', r, wrong as WarBishopCombatSource | null).selfGain).toBe(0);
    expect(s).toEqual(before); s.spirituality--; const altered = structuredClone(s); expect(effect(s, 'IRON_BLOOD_FLAME', r).selfGain).toBe(0); expect(s).toEqual(altered);
  });
  it('transfers only real health once, conserving the original damage and each member cap2', () => {
    const s = fixture(), r = begin(s, 'LINK_IF_READY'), original = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health);
    const result = shareWarBishopHealthDamage(s, 30, r, 'HEAVY'); expect(result.ownerDamage).toBe(24); s.health -= result.ownerDamage;
    expect(s.ironBloodKnight.team.members.slice(0, 5).map((m, i) => original[i]! - m.health)).toEqual([2, 2, 2, 0, 0]);
    expect(shareWarBishopHealthDamage(s, 30, r, 'HEAVY').ownerDamage).toBe(30); const o = finish(s, r);
    expect(o.sharedHealthDamage).toBe(6); expect(o.payments.reduce((n, p) => n + p.healthDamage, 0)).toBe(6); expect(s.mind).toBe(100);
  });
  it('never redirects death, and safe member participation does not erase owner damage', () => {
    const s = fixture(); for (const m of s.ironBloodKnight.team.members.slice(0, 5)) m.health = 50; const r = begin(s, 'LINK_IF_READY');
    expect(shareWarBishopHealthDamage(s, 100, r, 'DEATH').ownerDamage).toBe(100); expect(r.share).toBeNull();
    const hit = shareWarBishopHealthDamage(s, 100, r, 'HEAVY'); expect(hit.ownerDamage).toBe(90); s.health -= hit.ownerDamage;
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health)).toEqual([48, 48, 48, 48, 48]); expect(finish(s, r).sharedHealthDamage).toBe(10);
    const low = fixture(); low.health = 1; const lr = begin(low, 'LINK_IF_READY'); expect(shareWarBishopHealthDamage(low, 30, lr, 'HEAVY').ownerDamage).toBe(1); low.health = 0;
    expect(finish(low, lr).sharedHealthDamage).toBe(0);
  });
  it('audits costs, caps, original identities and expiration without a second injury engine', () => {
    const s = fixture(), r = begin(s, 'LINK_IF_READY'); effect(s, 'hunter.s3.coordinated-action', r); enemy(s, 'ARC_BOLT', r); const o = finish(s, r);
    for (const edit of [(x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.membersAfter[0]!.energy++; }, (x: typeof o) => { x.teamContribution++; },
      (x: typeof o) => { x.source.targetAge = 38 as 42; }, (x: typeof o) => { x.playerActions[0]!.selfGain = 100; }, (x: typeof o) => { x.elapsedSeconds = 120 as 60; }]) {
      const forged = structuredClone(o); edit(forged); expect(validateWarBishopRoundOutcome(forged)).toBe(false);
    }
    expect(() => finishWarBishopCombatRound(s, r)).toThrow(); expect(projectWarBishopCombat(s).summary).toContain('1250/底125');
  });
});
