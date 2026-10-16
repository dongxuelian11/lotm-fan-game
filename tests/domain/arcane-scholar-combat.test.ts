import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createArcaneScholarState } from '../../src/domain/arcane-scholar/index.js';
import { applyArcaneScholarEncounterCommand } from '../../src/domain/arcane-scholar/encounter.js';
import { findArcaneScholarOriginalCreation } from '../../src/domain/arcane-scholar/life.js';
import { PYROMANIAC_COUNT_WHEEL } from '../../src/domain/pyromaniac/combat.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ARCANE_SCHOLAR_COUNT_WHEEL, ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL, ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL,
  arcaneScholarActionCount, arcaneScholarEnemyActionCount, arcaneScholarAbilityWheel, drawArcaneScholarAbility, drawArcaneScholarEnemyAbility,
  beginArcaneScholarCombatRound, currentArcaneScholarCombatSource, resolveArcaneScholarCombatAbility, resolveArcaneScholarEnemyAbility,
  finishArcaneScholarCombatRound, validateArcaneScholarRoundOutcome, projectArcaneScholarCombat,
  type ArcaneScholarMoveId, type ArcaneScholarCombatSource } from '../../src/domain/arcane-scholar/combat.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No scene check in this fixture'); } };
const noRandom: ActionRandomStream = { seed: 'ar3-no-draw', cursor: 0, nextInt() { throw new Error('Unexpected random draw'); } };
const random = (...values: number[]): ActionRandomStream => { let index = 0; return { seed: 'ar3-directed', cursor: 0, nextInt(min, max) { const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${n} in ${min}..${max}`); return n; } }; };
/** Directed post-promotion unit fixture, not a natural promotion or recharge claim.
 * The default retains the real prior frame0/95 and box2/100. */
function fixture(frameCharge?: number): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/alchemist-v01200/natural.json', 'utf8')).final);
  s.arcaneScholar = createArcaneScholarState(); s.arcaneScholar.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['paragon.s3.bounded-analysis'] = 0; s.progression.mastery['paragon.s3.construct-coordination'] = 0;
  s.character.coreStats.knowledge = 30; s.actionsRemaining = 2; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null;
  if (frameCharge !== undefined) findArcaneScholarOriginalCreation(s, 'AL4-FRAME-1')!.charge = frameCharge;
  applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginArcaneScholarCombatRound(s, 'ATTACK', noRandom);
const effect = (s: SliceState, id: ArcaneScholarMoveId, r: ReturnType<typeof begin>, rng = noRandom, source: ArcaneScholarCombatSource | null = r.source, physical = 1) => resolveArcaneScholarCombatAbility(s, id, physical, rng, r, source);
const enemy = (s: SliceState, id: Parameters<typeof resolveArcaneScholarEnemyAbility>[1], r: ReturnType<typeof begin>, physical = 1) => resolveArcaneScholarEnemyAbility(s, id, physical, noRandom, r);
const finish = (s: SliceState, r: ReturnType<typeof begin>, continuing = true) => { const o = finishArcaneScholarCombatRound(s, r, continuing); expect(validateArcaneScholarRoundOutcome(o)).toBe(true); return o; };
const box = (s: SliceState) => findArcaneScholarOriginalCreation(s, 'AL4-BOX-1')!;
const frame = (s: SliceState) => findArcaneScholarOriginalCreation(s, 'AL4-FRAME-1')!;
describe('Arcane Scholar finite original-object combat', () => {
  it('retains actual prior count weights, both bounded1–6 wheels and normalized ability draws', () => {
    const s = fixture(); expect(ARCANE_SCHOLAR_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL); expect(ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL).toEqual(PYROMANIAC_COUNT_WHEEL);
    const rolls = [1, 10, 11, 25, 26, 50, 51, 75, 76, 90, 91, 100];
    expect(rolls.map(arcaneScholarActionCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]); expect(rolls.map(arcaneScholarEnemyActionCount)).toEqual(rolls.map(arcaneScholarActionCount));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) expect(arcaneScholarAbilityWheel(s, stance).reduce((n, x) => n + x.weight, 0)).toBeCloseTo(100);
    expect(drawArcaneScholarAbility(random(1), s, 'ATTACK')).toBe('paragon.s3.construct-coordination'); expect(drawArcaneScholarAbility(random(445), s, 'ATTACK')).toBe('ACCIDENT');
    expect(ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL.reduce((n, x) => n + x.weight, 0)).toBe(100); expect(drawArcaneScholarEnemyAbility(random(51))).toBe('JAM');
  });
  it('has independent original Corwin47/club/G3 resources without restoring dead Osric', () => {
    const s = fixture(), old = structuredClone(s.alchemist.encounter), r = begin(s);
    expect(currentArcaneScholarCombatSource(s)).toMatchObject({ targetId: 'AR3-CORWIN', targetAge: 47, targetSequence: 3, enemyWeapon: 'AR3-CORWIN-CLUB', actualOriginalBody: true, independentMind: true, ordinaryExit: true, pursuit: false });
    expect(enemy(s, 'ARC_BOLT', r)).toMatchObject({ selfGain: 75, threatens: true }); expect(enemy(s, 'WARD', r).enemyReduction).toBe(45); enemy(s, 'JAM', r);
    expect(s.arcaneScholar.encounter.enemySpirituality).toBe(107); expect(s.spirituality).toBe(120); expect(s.alchemist.encounter).toEqual(old); expect(old.enemy.status).toBe('DEAD'); finish(s, r);
  });
  it('actual inherited frame0 falls back ordinarily and never receives a new frame or charge', () => {
    const s = fixture(), originals = structuredClone(s.alchemist.life.creations), r = begin(s);
    expect(effect(s, 'paragon.s3.construct-coordination', r)).toMatchObject({ selfGain: 16, threatens: true }); expect(effect(s, 'paragon.s4.animate-made-object', r).selfGain).toBe(16);
    expect(effect(s, 'paragon.s4.direct-creation', r).enemyReduction).toBe(10); expect(s.spirituality).toBe(120); expect(s.alchemist.life.creations).toEqual(originals); finish(s, r);
  });
  it('finite two-object coordination pays5S and each original1charge with exactly40/20', () => {
    const s = fixture(3), originalBox = box(s), originalFrame = frame(s), oldFacts = structuredClone([s.alchemist.encounter, s.alchemist.life.parcel, s.alchemist.life.entrustedMaterial]), r = begin(s);
    expect(effect(s, 'paragon.s3.construct-coordination', r, random(1, 100))).toMatchObject({ selfGain: 40, enemyReduction: 20, threatens: true, mentalPressure: false });
    expect(s.spirituality).toBe(115); expect(box(s)).toBe(originalBox); expect(frame(s)).toBe(originalFrame); expect([box(s).charge, frame(s).charge]).toEqual([1, 2]);
    expect([box(s).durability, frame(s).durability]).toEqual([100, 95]); expect(s.alchemist.life.creations).toHaveLength(2); expect(s.combat!.enemyHealth).toBe(100);
    expect([s.alchemist.encounter, s.alchemist.life.parcel, s.alchemist.life.entrustedMaterial]).toEqual(oldFacts); expect(finish(s, r)).toMatchObject({ coordinationActiveAfter: false, elapsedSeconds: 60 });
  });
  it('coordination knowledge failure and ordinary resistance retain both charge payments', () => {
    for (const [rolls, result] of [[[100], 'FAILED'], [[1, 30], 'RESISTED']] as const) {
      const s = fixture(3), r = begin(s); expect(effect(s, 'paragon.s3.construct-coordination', r, random(...rolls))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(115); expect([box(s).charge, frame(s).charge]).toEqual([1, 2]); expect(r.playerActions[0]!.coordinationResult).toBe(result);
      expect(box(s).active || frame(s).active).toBe(false); finish(s, r);
    }
  });
  it('JAM costs4 independentS, raises one resistance to70, does not stack and is consumed', () => {
    const s = fixture(3), r = begin(s); enemy(s, 'JAM', r); enemy(s, 'JAM', r);
    expect(s.arcaneScholar.encounter.enemySpirituality).toBe(116); expect(s.arcaneScholar.encounter.powerUses.JAM).toBe(1);
    effect(s, 'paragon.s3.construct-coordination', r, random(1, 60)); expect(r.playerActions[0]!.coordinationResult).toBe('RESISTED');
    effect(s, 'paragon.s3.construct-coordination', r, random(1, 60)); expect(r.playerActions[1]!.coordinationResult).toBe('SUCCEEDED');
    expect([box(s).charge, frame(s).charge]).toEqual([0, 1]); expect(finish(s, r).resistanceActiveAfter).toBe(false);
  });
  it('analysis opens only one paid same-round ordinary strike window and consumes it once', () => {
    const s = fixture(), r = begin(s); expect(effect(s, 'paragon.s3.bounded-analysis', r, random(1)).selfGain).toBe(0);
    effect(s, 'paragon.s3.bounded-analysis', r); expect(s.spirituality).toBe(116);
    expect(effect(s, 'STRIKE', r, noRandom, r.source, 0.5).selfGain).toBe(14); expect(r.playerActions[2]!.analysisUsed).toBe(true);
    expect(effect(s, 'STRIKE', r).selfGain).toBe(16); expect(finish(s, r).analysisActiveAfter).toBe(false);
  });
  it('failed analysis keeps4S cost and an unused successful window ends without free damage', () => {
    const failed = fixture(), a = begin(failed); effect(failed, 'paragon.s3.bounded-analysis', a, random(100)); expect(failed.spirituality).toBe(116); expect(effect(failed, 'STRIKE', a).selfGain).toBe(16); finish(failed, a);
    const s = fixture(), r = begin(s); effect(s, 'paragon.s3.bounded-analysis', r, random(1)); const o = finish(s, r);
    expect(o.enemyHealth).toBe(100); expect(o.analysisActiveAfter).toBe(false); expect(r.model.analysisWindow).toBe(false);
  });
  it('inherits old animate4S/knowledge16, direct2S/26 and real later club-only durability loss', () => {
    const s = fixture(3), r = begin(s); expect(effect(s, 'paragon.s4.animate-made-object', r, random(1)).selfGain).toBeCloseTo(40 * (0.65 + 0.35 * (s.progression.mastery['paragon.s4.animate-made-object'] ?? 0) / 500));
    expect(frame(s).active).toBe(true); expect(effect(s, 'paragon.s4.direct-creation', r).enemyReduction).toBe(26); expect(s.spirituality).toBe(114); expect(frame(s).charge).toBe(1);
    enemy(s, 'OBSERVE', r); enemy(s, 'ARC_BOLT', r); expect(frame(s).durability).toBe(95);
    enemy(s, 'BODY_STRIKE', r); expect(frame(s).durability).toBe(90); enemy(s, 'BODY_STRIKE', r); expect(frame(s).durability).toBe(90); finish(s, r);
  });
  it('unspent old frame guard expires, and successful last-charge animation cannot stay active', () => {
    const s = fixture(3), r = begin(s); effect(s, 'paragon.s4.animate-made-object', r, random(1)); effect(s, 'paragon.s4.direct-creation', r); finish(s, r);
    expect(frame(s).durability).toBe(95); expect(r.model.pendingGuards).toBe(0);
    const last = fixture(1), rr = begin(last); effect(last, 'paragon.s4.animate-made-object', rr, random(1)); expect(frame(last).active).toBe(false); expect(frame(last).charge).toBe(0); finish(last, rr);
  });
  it('broken originals and insufficient player spirituality use ordinary fallback without overdraft', () => {
    const s = fixture(3); frame(s).durability = 0; const r = begin(s); effect(s, 'paragon.s3.construct-coordination', r); expect(s.spirituality).toBe(120); expect(frame(s).charge).toBe(3); finish(s, r);
    const low = fixture(3); low.spirituality = 1; const rr = begin(low); expect(effect(low, 'paragon.s3.construct-coordination', rr).selfGain).toBe(16); expect(effect(low, 'paragon.s4.direct-creation', rr).enemyReduction).toBe(10);
    expect(effect(low, 'paragon.s3.bounded-analysis', rr).selfGain).toBe(0); expect(effect(low, 'paragon.s5.precision-focus', rr).selfGain).toBe(0); expect(low.spirituality).toBe(1); finish(low, rr);
  });
  it('inherits old focus mastery and keeps ordinary physical bounds without stealing the enemy club', () => {
    const s = fixture(), r = begin(s); expect(effect(s, 'paragon.s5.precision-focus', r).selfGain).toBeCloseTo(12 * (0.65 + 0.35 * (s.progression.mastery['paragon.s5.precision-focus'] ?? 0) / 500));
    expect(s.spirituality).toBe(118); expect(effect(s, 'STRIKE', r, noRandom, r.source, 2).selfGain).toBe(16); expect(effect(s, 'STRIKE', r, noRandom, r.source, -1).threatens).toBe(false);
    expect(effect(s, 'OBSERVE', r).selfGain).toBe(0); expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5); finish(s, r);
  });
  it('enemy depleted resources fall back to its single original club with no free powers', () => {
    const s = fixture(); s.arcaneScholar.encounter.powerUses.ARC_BOLT = 24; s.arcaneScholar.encounter.enemySpirituality = 0; const r = begin(s);
    for (const id of ['ARC_BOLT', 'WARD', 'JAM'] as const) expect(enemy(s, id, r)).toMatchObject({ selfGain: 20, threatens: true });
    expect(s.arcaneScholar.encounter.enemySpirituality).toBe(0); expect(s.arcaneScholar.encounter.powerUses.JAM).toBe(0); finish(s, r);
  });
  it('rejects stale sources and replaced actual objects before resource use or extra draws', () => {
    const s = fixture(3), r = begin(s), before = structuredClone(s);
    for (const source of [null, { ...r.source, targetId: 'AL4-OSRIC' }, { ...r.source, round: 2 }, { ...r.source, enemyWeapon: 'COPY' }])
      expect(effect(s, 'paragon.s3.construct-coordination', r, noRandom, source as ArcaneScholarCombatSource | null).selfGain).toBe(0);
    expect(s).toEqual(before); frame(s).charge--; const changed = structuredClone(s); expect(effect(s, 'paragon.s3.construct-coordination', r).selfGain).toBe(0); expect(s).toEqual(changed);
    const forged = fixture(3), rr = begin(forged); frame(forged).madeBy = 'other-maker'; expect(currentArcaneScholarCombatSource(forged)).toBeNull(); expect(effect(forged, 'paragon.s4.animate-made-object', rr).selfGain).toBe(0);
  });
  it('caps each original actor at6 actions and provides no seventh object turn', () => {
    const s = fixture(3), r = begin(s); for (let i = 0; i < 6; i++) { effect(s, 'OBSERVE', r); enemy(s, 'OBSERVE', r); }
    effect(s, 'paragon.s3.construct-coordination', r); enemy(s, 'ARC_BOLT', r); expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(s.spirituality).toBe(120); finish(s, r);
  });
  it('validates actual cost and original-object effects while accepting common physical injury', () => {
    const s = fixture(3), r = begin(s); effect(s, 'paragon.s3.construct-coordination', r, random(1, 100)); enemy(s, 'ARC_BOLT', r); s.health -= 10; const o = finish(s, r);
    for (const edit of [(x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.enemySpirituality++; }, (x: typeof o) => { x.creations[0]!.charge++; },
      (x: typeof o) => { x.creations[1]!.durability++; }, (x: typeof o) => { x.playerActions[0]!.selfGain = 999; }, (x: typeof o) => { x.coordinationActiveAfter = true as false; },
      (x: typeof o) => { x.source.targetAge = 44 as 47; }, (x: typeof o) => { x.enemyMind--; }]) {
      const changed = structuredClone(o); edit(changed); expect(validateArcaneScholarRoundOutcome(changed)).toBe(false);
    }
    expect(() => finishArcaneScholarCombatRound(s, r)).toThrow(); expect(projectArcaneScholarCombat(s).summary).toContain('1250/底125');
  });
});
