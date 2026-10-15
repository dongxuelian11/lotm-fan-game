import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applyDeceitMentorCommand, createDeceitMentorState } from '../../src/domain/deceit-mentor/index.js';
import { applyDeceitMentorEncounterCommand } from '../../src/domain/deceit-mentor/encounter.js';
import {
  DECEIT_MENTOR_COUNT_WHEEL, DECEIT_MENTOR_ENEMY_COUNT_WHEEL, DECEIT_MENTOR_ENEMY_ABILITY_WHEEL,
  deceitMentorActionCount, deceitMentorEnemyActionCount, deceitMentorAbilityWheel, drawDeceitMentorAbility, drawDeceitMentorEnemyAbility,
  beginDeceitMentorCombatRound, currentDeceitMentorCombatSource, resolveDeceitMentorCombatAbility, resolveDeceitMentorEnemyAbility,
  finishDeceitMentorCombatRound, deceitMentorRoundOutcome, validateDeceitMentorRoundOutcome, projectDeceitMentorCombat,
  type DeceitMentorCombatSource, type DeceitMentorMoveId,
} from '../../src/domain/deceit-mentor/combat.js';

const LAW = 'error.s3.law-deceit', DEEP = 'error.s3.deep-deception';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'deceit-mentor-directed-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 unit arrangement on the unchanged natural352-command S4 predecessor.
 * S3 promotion and combat resources below are directed, not a claim of natural promotion. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/parasite-v01280/natural.json', 'utf8')).final);
  s.deceitMentor = createDeceitMentorState(); applyDeceitMentorCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.deceitMentor.promotionWeek = s.week; s.deceitMentor.parasiteActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[LAW] = 0; s.progression.mastery[DEEP] = 0;
  s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginDeceitMentorCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: DeceitMentorMoveId, rng = random()) => resolveDeceitMentorCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveDeceitMentorEnemyAbility>[1]) => resolveDeceitMentorEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateDeceitMentorRoundOutcome(finishDeceitMentorCombatRound(s, r))).toBe(true);
const legacy = (s: SliceState) => structuredClone({ marauder: s.marauder, swindler: s.swindler, cryptologist: s.cryptologist,
  fireThief: s.fireThief, dreamStealer: s.dreamStealer, parasite: s.parasite, town: s.town });

describe('DeceitMentor finite G combat with independent original Gideon47', () => {
  it('retains shared1–6 counts and exact published six/five-slot weights', () => {
    expect(DECEIT_MENTOR_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(DECEIT_MENTOR_ENEMY_COUNT_WHEEL).toEqual(DECEIT_MENTOR_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(deceitMentorActionCount(roll!)).toBe(count); expect(deceitMentorEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = deceitMentorAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([LAW, DEEP, 'STRIKE', 'EVADE', 'BLOCK', 'ACCIDENT']); expect(wheel.map(v => v.weight)).toEqual([25, 20, 20, 15, 15, 5]);
    expect(DECEIT_MENTOR_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['FORCE_STRIKE', 'GUARD', 'BODY_STRIKE', 'DISCERN', 'ACCIDENT']);
    expect(DECEIT_MENTOR_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws each exact base-wheel boundary once without extra slots', () => {
    const s = fixture(); let boundary = 0;
    for (const a of deceitMentorAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawDeceitMentorAbility(rng, s, null)).toBe(a.id); expect(drawDeceitMentorAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of DECEIT_MENTOR_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawDeceitMentorEnemyAbility(rng)).toBe(a.id); expect(drawDeceitMentorEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('applies only the standard5-to4 stance ticket bias without changing base slots', () => {
    const s = fixture(); expect(drawDeceitMentorAbility(random(181), s, 'ATTACK')).toBe('STRIKE');
    expect(drawDeceitMentorAbility(random(280), s, 'ATTACK')).toBe('STRIKE'); expect(drawDeceitMentorAbility(random(281), s, 'ATTACK')).toBe('EVADE');
    const control = deceitMentorAbilityWheel(s, 'CONTROL'); expect(control[0]!.weight).toBe(125 / 445 * 100); expect(control[1]!.weight).toBe(100 / 445 * 100);
  });
  it.each([[LAW, 36], [DEEP, 30]] as const)('%s pays6S and reduces only this round advantage by%s without damage or control', (id, reduction) => {
    const s = fixture(), old = legacy(s), life = structuredClone(s.deceitMentor.life), r = begin(s);
    expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false, mentalPressure: false });
    expect(s.spirituality).toBe(114); expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100 });
    expect(s.deceitMentor.encounter.scene.playerPosition).toBe('ORIGIN'); expect(legacy(s)).toEqual(old); expect(s.deceitMentor.life).toEqual(life);
    const o = finishDeceitMentorCombatRound(s, r); expect(o).toMatchObject({ elapsedSeconds: 60, lifeClockSecondsAfter: 60, enemyDistanceAfter: 2 });
    expect(validateDeceitMentorRoundOutcome(o)).toBe(true);
  });
  it.each([LAW, DEEP] as const)('%s uses actual knowledge18 and leaves failed paid costs spent', id => {
    const s = fixture(); s.character.coreStats.knowledge = 18; const r = begin(s);
    expect(player(s, r, id, random(50)).enemyReduction).toBeGreaterThan(0);
    expect(player(s, r, id, random(51))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(r.playerActions[1]).toMatchObject({ paidCost: 6, fallback: 'NONE', resisted: false }); expect(s.spirituality).toBe(108); valid(s, r);
  });
  it('ordinary STRIKE uses only actual own held club, otherwise own hands, and does not steal either enemy weapon', () => {
    for (const held of [false, true]) { const s = fixture(); s.town.clubLocation = held ? 'HAND' : 'SHOP'; const old = legacy(s), r = begin(s), rng = random();
      expect(resolveDeceitMentorCombatAbility(s, 'STRIKE', .5, rng, r)).toMatchObject({ selfGain: held ? 8 : 6, threatens: true, enemyReduction: 0 });
      expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0); expect(s.deceitMentor.encounter.weaponLocation).toBe('HAND'); expect(legacy(s)).toEqual(old); valid(s, r); }
  });
  it('lowS falls back law→ordinary evade10 and deep→observation0 without free S or threat', () => {
    const s = fixture(); s.spirituality = 3; const r = begin(s), rng = random();
    expect(player(s, r, LAW, rng)).toMatchObject({ enemyReduction: 10, threatens: false });
    expect(player(s, r, DEEP, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(r.playerActions.map(a => a.fallback)).toEqual(['EVADE', 'OBSERVE']); expect(s.spirituality).toBe(3); expect(rng.cursor).toBe(0); valid(s, r);
  });
  it('mid-round exhaustion keeps the earlier failed6S and does not overdraw or redraw', () => {
    const s = fixture(); s.spirituality = 6; const r = begin(s), rng = random(100);
    player(s, r, LAW, rng); expect(player(s, r, LAW, rng).enemyReduction).toBe(10); expect(player(s, r, DEEP, rng).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(0); expect(rng.cursor).toBe(1); valid(s, r);
  });
  it('evade and block never threaten while accident is one fixed negative contribution', () => {
    const s = fixture(), r = begin(s), rng = random();
    for (const id of ['EVADE', 'BLOCK'] as const) expect(player(s, r, id, rng)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(player(s, r, 'ACCIDENT', rng)).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false }); expect(rng.cursor).toBe(0); valid(s, r);
  });
  it('enemy spells pay5/4/4 from only his independent120S pool and keep serial original power counts', () => {
    const s = fixture(), r = begin(s); expect(enemy(s, r, 'FORCE_STRIKE')).toMatchObject({ selfGain: 70, threatens: true });
    expect(enemy(s, r, 'GUARD')).toMatchObject({ enemyReduction: 40, threatens: false }); enemy(s, r, 'DISCERN');
    expect(s.deceitMentor.encounter.enemySpirituality).toBe(107); expect(s.deceitMentor.encounter.powerUses).toEqual({ FORCE_STRIKE: 1, GUARD: 1, DISCERN: 1 });
    expect(s.spirituality).toBe(120); expect(s.health).toBe(100); expect(s.mind).toBe(100); valid(s, r);
  });
  it('exhausted enemy spells become only the actual original rod20×body and grant no discern', () => {
    const s = fixture(); Object.assign(s.deceitMentor.encounter, { enemySpirituality: 0, powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISCERN: 30 } });
    const r = begin(s); expect(resolveDeceitMentorEnemyAbility(s, 'FORCE_STRIKE', .5, random(), r).selfGain).toBe(10);
    expect(enemy(s, r, 'GUARD').selfGain).toBe(20); expect(enemy(s, r, 'DISCERN').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(r.discernReady).toBe(false); valid(s, r);
  });
  it.each([LAW, DEEP] as const)('paid discern resists only the next successful%s, keeps6S cost, and expires after consumption', id => {
    const s = fixture(), r = begin(s); enemy(s, r, 'DISCERN'); expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(r.playerActions[0]).toMatchObject({ resisted: true, paidCost: 6 }); expect(r.discernReady).toBe(false);
    player(s, r, id); expect(r.playerActions[1]!.resisted).toBe(false); expect(s.spirituality).toBe(108); valid(s, r);
  });
  it('discern does not stack or consume on a failure, ordinary strike, evade or block', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'DISCERN'); enemy(s, r, 'DISCERN'); player(s, r, LAW, random(100));
    expect(player(s, r, 'STRIKE').threatens).toBe(true); player(s, r, 'EVADE'); player(s, r, 'BLOCK'); expect(r.discernReady).toBe(true);
    expect(player(s, r, DEEP).enemyReduction).toBe(0); expect(r.discernReady).toBe(false); expect(player(s, r, LAW).enemyReduction).toBe(36); valid(s, r);
  });
  it('unpaid ordinary fallback never consumes already paid discern', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s); enemy(s, r, 'DISCERN'); player(s, r, LAW); player(s, r, DEEP);
    expect(r.discernReady).toBe(true); valid(s, r);
  });
  it('rejects stale source, substituted Ralf, changed actual weapon or clock without drawing or spending', () => {
    const s = fixture(), r = begin(s), rng = random(), before = structuredClone(s);
    const wrong = { ...r.source, targetId: 'PR4-RALF-TOREN' } as unknown as DeceitMentorCombatSource;
    expect(resolveDeceitMentorCombatAbility(s, LAW, 1, rng, r, wrong).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    s.deceitMentor.life.clockSeconds++; expect(player(s, r, DEEP, rng).enemyReduction).toBe(0); expect(rng.cursor).toBe(0); expect(() => finishDeceitMentorCombatRound(s, r)).toThrow();
    s.deceitMentor.life.clockSeconds--; s.deceitMentor.encounter.weaponLocation = 'COURT'; expect(currentDeceitMentorCombatSource(s)).toBeNull();
  });
  it('finishes once, clears unused discern, adds60seconds and never heals actual attack death or refills pools', () => {
    const s = fixture(), r = begin(s), old = legacy(s); enemy(s, r, 'FORCE_STRIKE'); enemy(s, r, 'DISCERN'); player(s, r, LAW, random(100)); s.health = 0;
    const o = finishDeceitMentorCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.deceitMentor.encounter.enemySpirituality).toBe(111);
    expect(o.discernReadyAfter).toBe(false); expect(r.discernReady).toBe(false); expect(s.deceitMentor.life.clockSeconds).toBe(60); expect(legacy(s)).toEqual(old);
    expect(validateDeceitMentorRoundOutcome(o)).toBe(true); expect(() => finishDeceitMentorCombatRound(s, r)).toThrow();
  });
  it('caps both actors at six, rejects extra resolution without RNG and returns isolated outcomes', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 6; i++) { player(s, r, LAW); enemy(s, r, 'ACCIDENT'); }
    const rng = random(); expect(player(s, r, LAW, rng).enemyReduction).toBe(0); expect(enemy(s, r, 'FORCE_STRIKE').selfGain).toBe(0); expect(rng.cursor).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6);
    const o = finishDeceitMentorCombatRound(s, r); expect(validateDeceitMentorRoundOutcome(o)).toBe(true);
    o.powerUses.FORCE_STRIKE++; expect(deceitMentorRoundOutcome(r).powerUses.FORCE_STRIKE).toBe(0); expect(validateDeceitMentorRoundOutcome(o)).toBe(false);
  });
  it('rejects fabricated refund, resistance, mind/control damage, phantom injury, source and clock', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'DISCERN'); player(s, r, DEEP); player(s, r, LAW); enemy(s, r, 'GUARD');
    const o = finishDeceitMentorCombatRound(s, r); expect(validateDeceitMentorRoundOutcome(o)).toBe(true);
    const mutations: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerActions[0]!.paidCost = 0; },
      v => { v.playerActions[0]!.resisted = false; }, v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.source.clearanceConfirmed = false as true; },
      v => { v.enemyMind--; }, v => { v.source.independentMind = false as true; }, v => { v.source.automaticAllyImmunity = true as false; },
      v => { v.playerActions[0]!.order = 99; }, v => { v.playerActions[0]!.threatens = true; }, v => { v.lifeClockSecondsAfter++; },
      v => { v.enemyHealth--; }, v => { v.playerHealthAfter--; }, v => { v.enemyStatus = 'SURRENDERED'; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateDeceitMentorRoundOutcome(bad)).toBe(false); }
  });
  it('does not silently offer inherited theft slots or expose Gideon before actual S3', () => {
    const s = fixture(); expect(deceitMentorAbilityWheel(s, null).some(a => /power-theft|thought-theft|parasitism/.test(a.id))).toBe(false);
    expect(currentDeceitMentorCombatSource(s)).toMatchObject({ abilitySource: 'ORIGINAL_LIMITED_G', targetAge: 47, independentMind: true });
    s.progression.sequence = 4; const view = projectDeceitMentorCombat(s); expect(view.source).toBeNull(); expect(view.targetId).toBeNull(); expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/GIDEON|吉迪恩/);
  });
});
