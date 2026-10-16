import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createDreamWeaverState } from '../../src/domain/dream-weaver/index.js';
import { applyDreamWeaverEncounterCommand } from '../../src/domain/dream-weaver/encounter.js';
import { PSYCHOLOGIST_COUNT_WHEEL } from '../../src/domain/psychologist/combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveDreamWeaverCombatRound } from '../../src/domain/slice/dream-weaver-combat.js';
import { DREAM_WEAVER_COUNT_WHEEL, DREAM_WEAVER_ENEMY_COUNT_WHEEL, DREAM_WEAVER_ENEMY_ABILITY_WHEEL,
  dreamWeaverActionCount, dreamWeaverEnemyActionCount, dreamWeaverAbilityWheel, drawDreamWeaverAbility, drawDreamWeaverEnemyAbility,
  beginDreamWeaverCombatRound, currentDreamWeaverCombatSource, resolveDreamWeaverCombatAbility, resolveDreamWeaverEnemyAbility,
  finishDreamWeaverCombatRound, validateDreamWeaverRoundOutcome, projectDreamWeaverCombat,
  type DreamWeaverMoveId, type DreamWeaverCombatSource } from '../../src/domain/dream-weaver/combat.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No scene check in this fixture'); } };
const noRandom: ActionRandomStream = { seed: 'dwv3-no-draw', cursor: 0, nextInt() { throw new Error('Unexpected random draw'); } };
const random = (...values: number[]): ActionRandomStream => { let index = 0; return { seed: 'dwv3-directed', cursor: 0, nextInt(min, max) { const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error('Unexpected directed random draw'); return n; } }; };
/** Directed post-promotion unit fixture. Preserves actual old Rulan and all old
 * history; it does not claim to be evidence of a natural S3 promotion. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json', 'utf8')).final);
  s.dreamWeaver = createDreamWeaverState(); s.dreamWeaver.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['audience.s3.external-identity'] = 0; s.progression.mastery['audience.s3.woven-image'] = 0;
  s.character.coreStats.will = 30; s.actionsRemaining = 2; s.cash = 400; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null;
  applyDreamWeaverEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyDreamWeaverEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginDreamWeaverCombatRound(s, 'ATTACK', noRandom);
const effect = (s: SliceState, id: DreamWeaverMoveId, r: ReturnType<typeof begin>, rng = noRandom, source: DreamWeaverCombatSource | null = r.source) => resolveDreamWeaverCombatAbility(s, id, 1, rng, r, source);
const enemy = (s: SliceState, id: Parameters<typeof resolveDreamWeaverEnemyAbility>[1], r: ReturnType<typeof begin>) => resolveDreamWeaverEnemyAbility(s, id, 1, noRandom, r);
function finish(s: SliceState, r: ReturnType<typeof begin>, continuing = true) { const o = finishDreamWeaverCombatRound(s, r, continuing); expect(validateDreamWeaverRoundOutcome(o)).toBe(true); return o; }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
afterEach(() => vi.restoreAllMocks());
describe('Dream Weaver finite original-body combat', () => {
  it('inherits the actual Audience4 15/20/25/20/15/5 counts for both bodies and only two new IDs', () => {
    const s = fixture(); expect(DREAM_WEAVER_COUNT_WHEEL).toEqual(PSYCHOLOGIST_COUNT_WHEEL); expect(DREAM_WEAVER_ENEMY_COUNT_WHEEL).toEqual(PSYCHOLOGIST_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(dreamWeaverActionCount(roll!)).toBe(count); expect(dreamWeaverEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = dreamWeaverAbilityWheel(s, null); expect(wheel.reduce((n, a) => n + a.weight, 0)).toBeCloseTo(100);
    expect(wheel.filter(a => a.id.startsWith('audience.s3.')).map(a => a.id).sort()).toEqual(['audience.s3.external-identity', 'audience.s3.woven-image']);
    for (const id of ['audience.s4.mind-island', 'audience.s4.virtual-persona', 'audience.s4.mental-plague', 'audience.s6.scales']) expect(wheel.some(a => a.id === id)).toBe(true);
    expect(drawDreamWeaverAbility(random(1), s, 'ATTACK')).toBe('audience.s3.woven-image'); expect(drawDreamWeaverEnemyAbility(random(1))).toBe('ARC_BOLT');
    expect(DREAM_WEAVER_ENEMY_ABILITY_WHEEL.map(a => a.weight)).toEqual([30, 20, 20, 20, 5, 5]);
  });
  it('has an independent adult original caster, original weapon and own finite SP without changing old Rulan', () => {
    const s = fixture(), old = structuredClone(s.manipulator), r = begin(s);
    expect(currentDreamWeaverCombatSource(s)).toMatchObject({ targetId: 'DWV3-OSMOND', targetAge: 45, targetSequence: 3, enemyWeapon: 'DWV3-OSMOND-CLUB', actualOriginalBody: true, independentMind: true, ordinaryExit: true, pursuit: false, noBystanders: true });
    expect(enemy(s, 'ARC_BOLT', r)).toMatchObject({ selfGain: 75, threatens: true }); expect(enemy(s, 'WARD', r).enemyReduction).toBe(45); expect(enemy(s, 'COMPOSE', r).selfGain).toBe(0);
    expect(s.dreamWeaver.encounter.enemySpirituality).toBe(108); expect(s.spirituality).toBe(120); expect(s.manipulator).toEqual(old); finish(s, r);
  });
  it('pays owner5S+2M once for one finite identity, reunites and creates no equipment or second wheel', () => {
    const s = fixture(), original = structuredClone([s.town, s.manipulator.life, s.dreamWeaver.life]), r = begin(s);
    expect(effect(s, 'audience.s3.external-identity', r, random(1))).toMatchObject({ enemyReduction: 26, threatens: false, mentalPressure: false });
    expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(r.playerActions[0]).toMatchObject({ identityCreated: true, identityRejoined: true, paidCost: 5, ownerMindSpent: 2 });
    expect([s.town, s.manipulator.life, s.dreamWeaver.life]).toEqual(original); expect(finish(s, r)).toMatchObject({ identityUses: 1, ownerMindSpent: 2, identityActiveAfter: false, elapsedSeconds: 60 });
  });
  it('identity failure retains real cost, and low owner resources fall back ordinarily without overdraft', () => {
    const s = fixture(), r = begin(s); expect(effect(s, 'audience.s3.external-identity', r, random(100)).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(r.playerActions[0]!.identityCreated).toBe(false); finish(s, r);
    for (const change of [(x: SliceState) => { x.spirituality = 4; }, (x: SliceState) => { x.mind = 2; }]) {
      const low = fixture(); change(low); const before = [low.spirituality, low.mind], rr = begin(low);
      expect(effect(low, 'audience.s3.external-identity', rr).enemyReduction).toBe(10); expect([low.spirituality, low.mind]).toEqual(before); finish(low, rr);
    }
  });
  it('a believed near-real image pays6 and affects only original mind by6, never health', () => {
    const s = fixture(), r = begin(s); expect(effect(s, 'audience.s3.woven-image', r, random(1, 100))).toMatchObject({ selfGain: 38, threatens: false, mentalPressure: true });
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(94); expect(s.spirituality).toBe(114);
    expect(r.playerActions[0]!.imageResult).toBe('BELIEVED'); expect(finish(s, r)).toMatchObject({ wovenMindDamage: 6, wovenImageUses: 1, wovenImageActiveAfter: false });
  });
  it('failed casting and ordinary recognition keep real cost but cause no mental harm', () => {
    for (const [rolls, result] of [[[100], 'FAILED'], [[1, 30], 'RECOGNIZED']] as const) {
      const s = fixture(), r = begin(s); expect(effect(s, 'audience.s3.woven-image', r, random(...rolls))).toMatchObject({ selfGain: 0, mentalPressure: false });
      expect(s.combat!.enemyMind).toBe(100); expect(s.spirituality).toBe(114); expect(r.playerActions[0]!.imageResult).toBe(result); finish(s, r);
    }
  });
  it('COMPOSE really spends3 enemyS, resists once, cannot stack and expires at the end', () => {
    const s = fixture(), r = begin(s); enemy(s, 'COMPOSE', r); enemy(s, 'COMPOSE', r);
    expect(s.dreamWeaver.encounter.enemySpirituality).toBe(117); expect(s.dreamWeaver.encounter.powerUses.COMPOSE).toBe(1);
    effect(s, 'audience.s3.woven-image', r, random(1, 60)); expect(r.playerActions[0]!.imageResult).toBe('RESISTED'); expect(s.combat!.enemyMind).toBe(100);
    effect(s, 'audience.s3.woven-image', r, random(1, 60)); expect(r.playerActions[1]!.imageResult).toBe('BELIEVED'); expect(s.combat!.enemyMind).toBe(94);
    expect(finish(s, r).resistanceActiveAfter).toBe(false);
  });
  it('retains actual old island/persona/scales costs and no free plague reapplication', () => {
    const s = fixture(), r = begin(s);
    expect(effect(s, 'audience.s4.mind-island', r, random(1))).toMatchObject({ selfGain: 42, threatens: false, mentalPressure: true });
    expect(effect(s, 'audience.s4.virtual-persona', r).enemyReduction).toBe(24);
    expect(effect(s, 'audience.s6.scales', r).enemyReduction).toBeCloseTo(14 * (1 + (s.progression.mastery['audience.s6.scales'] ?? 0) / 500));
    effect(s, 'audience.s4.mental-plague', r, random(1)); effect(s, 'audience.s4.mental-plague', r);
    expect(s.spirituality).toBe(107); expect(s.mind).toBe(99); expect(s.combat!.enemyMind).toBe(92);
    expect(finish(s, r)).toMatchObject({ islandMindDamage: 8, enemyMentalPlague: 1, plagueApplications: 1, personaGuards: 1, ownerMindSpent: 1 });
  });
  it('enemy depleted SP uses only its actual original club and never refills resources', () => {
    const s = fixture(); s.dreamWeaver.encounter.powerUses.ARC_BOLT = 24; s.dreamWeaver.encounter.enemySpirituality = 0; const r = begin(s);
    for (const id of ['ARC_BOLT', 'WARD', 'COMPOSE'] as const) expect(enemy(s, id, r)).toMatchObject({ selfGain: 20, threatens: true });
    expect(s.dreamWeaver.encounter.enemySpirituality).toBe(0); expect(s.dreamWeaver.encounter.powerUses.COMPOSE).toBe(0); finish(s, r);
  });
  it('source substitution, stale sources, resource changes and seventh actions cannot spend or redraw', () => {
    const s = fixture(), r = begin(s), before = structuredClone(s);
    for (const source of [null, { ...r.source, targetId: 'MP4-RULAN' }, { ...r.source, round: 2 }, { ...r.source, enemyWeapon: 'COPY' }])
      expect(effect(s, 'audience.s3.woven-image', r, noRandom, source as DreamWeaverCombatSource | null).selfGain).toBe(0);
    expect(s).toEqual(before); s.spirituality--; const changed = structuredClone(s); expect(effect(s, 'audience.s3.woven-image', r).selfGain).toBe(0); expect(s).toEqual(changed);
    const capped = fixture(), rr = begin(capped); for (let i = 0; i < 6; i++) effect(capped, 'OBSERVE', rr);
    expect(effect(capped, 'audience.s3.woven-image', rr).selfGain).toBe(0); expect(rr.playerActions).toHaveLength(6); finish(capped, rr);
  });
  it('spirit exhaustion gives ordinary attacks/guards and actual held equipment alone changes strike', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s);
    expect(effect(s, 'audience.s3.woven-image', r)).toMatchObject({ selfGain: 12, threatens: true }); expect(effect(s, 'audience.s6.scales', r).enemyReduction).toBe(10);
    expect(effect(s, 'audience.s4.virtual-persona', r).enemyReduction).toBe(10); expect(effect(s, 'OBSERVE', r).selfGain).toBe(0); expect(effect(s, 'ACCIDENT', r).selfGain).toBe(-22.5); finish(s, r);
    const armed = fixture(); armed.town.clubLocation = 'HAND'; const ar = begin(armed); expect(effect(armed, 'STRIKE', ar).selfGain).toBe(16); finish(armed, ar);
  });
  it('M0 really stops combat as a living surrendered original instead of rolling physical death', () => {
    const s = fixture(); s.dreamWeaver.encounter.enemyMind = 6; s.combat!.enemyMind = 6;
    const spy = script(1, 1, 1, 1, 100); const result = resolveDreamWeaverCombatRound(s, 'ATTACK');
    expect(spy).toHaveBeenCalledTimes(5); expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.combat!.enemyMind).toBe(0); expect(s.combat!.enemyHealth).toBe(100);
    expect(s.spirituality).toBe(114); expect(s.dreamWeaver.encounter.weaponLocation).toBe('YARD'); expect(validateDreamWeaverRoundOutcome(result.round.dreamWeaverOutcome)).toBe(true);
  });
  it('plague ticks4/8/12 on following actual rounds and persists through ordinary retreat', () => {
    const s = fixture(); script(1, 1, 355, 1, 91, 1); // ATTACK wheel: plague; enemy ordinary observation.
    const first = resolveDreamWeaverCombatRound(s, 'ATTACK'); expect(first.outcome).toBe('CONTINUE'); s.combatHistory.push(first.round); vi.restoreAllMocks();
    expect(s.dreamWeaver.encounter.mentalPlague).toBe(1); expect(s.combat!.enemyMind).toBe(100);
    for (const [damage, after, mind] of [[4, 2, 96], [8, 3, 88]] as const) {
      const r = beginDreamWeaverCombatRound(s, 'PREPARE', noRandom); expect(r.model.plagueMindDamage).toBe(damage); expect(s.combat!.enemyMind).toBe(mind);
      const o = finish(s, r); expect(o.enemyMentalPlague).toBe(after);
      const round = { ...first.round, round: s.combat!.round, stance: 'PREPARE' as const, moves: [], dreamWeaverOutcome: o }; s.combatHistory.push(round); s.combat!.round++;
    }
    script(1, 1, 91, 1); // Even round: original enemy observation, then real ordinary retreat.
    const last = resolveDreamWeaverCombatRound(s, 'RETREAT'); expect(last.outcome).toBe('RETREATED'); expect(last.round.dreamWeaverOutcome).toMatchObject({ plagueMindDamage: 12, enemyMentalPlague: 3, enemyMind: 76 });
    expect(s.dreamWeaver.encounter.mentalPlague).toBe(3);
  });
  it('audits finite action cost, belief/resistance and owner mind without a second injury engine', () => {
    const s = fixture(), r = begin(s); effect(s, 'audience.s3.external-identity', r, random(1)); effect(s, 'audience.s3.woven-image', r, random(1, 100)); enemy(s, 'ARC_BOLT', r);
    s.health -= 10; const o = finish(s, r);
    for (const edit of [(x: typeof o) => { x.playerSpiritualityAfter++; }, (x: typeof o) => { x.playerMindAfter++; }, (x: typeof o) => { x.enemyMind++; },
      (x: typeof o) => { x.source.targetAge = 40 as 45; }, (x: typeof o) => { x.playerActions[1]!.imageResult = 'RECOGNIZED'; }, (x: typeof o) => { x.playerActions[1]!.selfGain = 300; },
      (x: typeof o) => { x.identityActiveAfter = true as false; }, (x: typeof o) => { x.enemySpirituality++; }]) {
      const forged = structuredClone(o); edit(forged); expect(validateDreamWeaverRoundOutcome(forged)).toBe(false);
    }
    expect(() => finishDreamWeaverCombatRound(s, r)).toThrow(); expect(projectDreamWeaverCombat(s).summary).toContain('1250/底125');
  });
});
