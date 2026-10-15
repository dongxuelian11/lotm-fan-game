import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createJusticeMentorState } from '../../src/domain/justice-mentor/index.js';
import { applyJusticeMentorEncounterCommand } from '../../src/domain/justice-mentor/encounter.js';
import {
  JUSTICE_MENTOR_COUNT_WHEEL, JUSTICE_MENTOR_ENEMY_COUNT_WHEEL, JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL,
  justiceMentorActionCount, justiceMentorEnemyActionCount, justiceMentorAbilityWheel, drawJusticeMentorAbility, drawJusticeMentorEnemyAbility,
  beginJusticeMentorCombatRound, currentJusticeMentorCombatSource, resolveJusticeMentorCombatAbility, resolveJusticeMentorEnemyAbility,
  finishJusticeMentorCombatRound, justiceMentorRoundOutcome, validateJusticeMentorRoundOutcome, projectJusticeMentorCombat,
  type JusticeMentorCombatSource, type JusticeMentorMoveId,
} from '../../src/domain/justice-mentor/combat.js';

const SHARED = 'sun.s3.shared-radiance', CLARITY = 'sun.s3.clarity-mark';
const DOMAIN = 'sun.s4.unshadowed-domain', PURIFICATION = 'sun.s4.purification';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'justice-mentor-directed-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 fixture; the captured old Edmund surrender and every old original are preserved. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8')).final);
  s.justiceMentor = createJusticeMentorState(); s.justiceMentor.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginJusticeMentorCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: JusticeMentorMoveId, rng = random()) => resolveJusticeMentorCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveJusticeMentorEnemyAbility>[1]) => resolveJusticeMentorEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateJusticeMentorRoundOutcome(finishJusticeMentorCombatRound(s, r))).toBe(true);

describe('Justice Mentor finite G combat with independent original Corwin and actual ordered costs', () => {
  it('keeps exact1–6 counts, six player slots25/20/15/20/15/5 and enemy35/25/20/15/5', () => {
    expect(JUSTICE_MENTOR_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(JUSTICE_MENTOR_ENEMY_COUNT_WHEEL).toEqual(JUSTICE_MENTOR_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(justiceMentorActionCount(roll!)).toBe(count); expect(justiceMentorEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = justiceMentorAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([SHARED, CLARITY, DOMAIN, PURIFICATION, 'EVADE', 'ACCIDENT']);
    expect(wheel.map(v => v.weight)).toEqual([25, 20, 15, 20, 15, 5]);
    expect(JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['LIGHT_STRIKE', 'LIGHT_WARD', 'BODY_STRIKE', 'FOCUS', 'ACCIDENT']);
    expect(JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws published boundaries once per slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of justiceMentorAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawJusticeMentorAbility(rng, s, null)).toBe(a.id); expect(drawJusticeMentorAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of JUSTICE_MENTOR_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawJusticeMentorEnemyAbility(rng)).toBe(a.id); expect(drawJusticeMentorEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('shared-radiance pays6S for65 self-encouragement without phantom allies, direct injury or new-mastery scaling', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[SHARED] = m;
      const old = structuredClone(s.unshadowed), life = structuredClone(s.justiceMentor.life), r = begin(s);
      expect(player(s, r, SHARED)).toMatchObject({ selfGain: 65, enemyReduction: 0, threatens: false, mentalPressure: false });
      expect(s.spirituality).toBe(114); expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(100);
      expect(s.unshadowed).toEqual(old); expect(s.justiceMentor.life).toEqual(life);
      expect(r.playerActions[0]).toMatchObject({ paidCost: 6, rolls: [1], fallback: 'NONE', resisted: false }); valid(s, r); }
  });
  it('inherits actual Unshadowed mastery factor independently for domain18 and purification34', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[DOMAIN] = m; s.progression.mastery[PURIFICATION] = 500 - m; s.progression.mastery[SHARED] = 500;
      const r = begin(s); expect(player(s, r, DOMAIN)).toMatchObject({ enemyReduction: 18 * (.65 + .35 * m / 500), threatens: false });
      expect(player(s, r, PURIFICATION)).toMatchObject({ selfGain: 34 * (.65 + .35 * (500 - m) / 500), threatens: true });
      expect(s.spirituality).toBe(109); expect(r.source.sunVulnerable).toBe(false); valid(s, r); }
  });
  it('clamps old mastery exactly like Unshadowed without an ordinary-human evil multiplier', () => {
    const s = fixture(); s.progression.mastery[DOMAIN] = -1; s.progression.mastery[PURIFICATION] = 900; const r = begin(s);
    expect(player(s, r, DOMAIN).enemyReduction).toBe(18 * .65); expect(player(s, r, PURIFICATION).selfGain).toBe(34); valid(s, r);
  });
  it('clarity pays6S and uses knowledge18 rather than will or a moral check', () => {
    const s = fixture(); s.character.coreStats.knowledge = 0; s.character.coreStats.will = 100; const r = begin(s);
    expect(player(s, r, CLARITY, random(50))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(114); expect(r.playerActions[0]!.label).toContain('无善恶判定'); valid(s, r);
    const good = fixture(), gr = begin(good); expect(player(good, gr, CLARITY).enemyReduction).toBe(32); valid(good, gr);
  });
  it('failed checks retain exact6/6/5/6 costs with no free fallback, injury or mind damage', () => {
    const s = fixture(), r = begin(s), rng = random(100, 100, 100, 100);
    for (const id of [SHARED, CLARITY, DOMAIN, PURIFICATION] as const) expect(player(s, r, id, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(97); expect(rng.cursor).toBe(4); expect(s.health).toBe(100); expect(s.justiceMentor.encounter.enemyMind).toBe(100);
    expect(r.playerActions.map(a => a.paidCost)).toEqual([6, 6, 5, 6]); valid(s, r);
  });
  it('low player S only allows the held original/body strike, ordinary evade or observation at0S', () => {
    for (const held of [false, true]) { const s = fixture(); s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; const r = begin(s), rng = random();
      expect(resolveJusticeMentorCombatAbility(s, SHARED, .5, rng, r).selfGain).toBe(held ? 8 : 6);
      expect(player(s, r, CLARITY, rng).enemyReduction).toBe(0); expect(player(s, r, DOMAIN, rng).enemyReduction).toBe(10);
      expect(player(s, r, PURIFICATION, rng).selfGain).toBe(0); expect(r.playerActions.map(a => a.fallback)).toEqual(['STRIKE', 'OBSERVE', 'EVADE', 'OBSERVE']);
      expect(s.spirituality).toBe(3); expect(rng.cursor).toBe(0); valid(s, r); }
  });
  it('mid-round exhaustion cannot overdraw or refund the earlier failure', () => {
    const s = fixture(); s.spirituality = 6; const r = begin(s), rng = random(100);
    player(s, r, SHARED, rng); expect(player(s, r, SHARED, rng).selfGain).toBe(s.town.clubLocation === 'HAND' ? 16 : 12);
    expect(player(s, r, DOMAIN, rng).enemyReduction).toBe(10); expect(s.spirituality).toBe(0); expect(rng.cursor).toBe(1); valid(s, r);
  });
  it('enemy originalG light and focus debit only his independent pool', () => {
    const s = fixture(), r = begin(s);
    expect(enemy(s, r, 'LIGHT_STRIKE').selfGain).toBe(75); expect(enemy(s, r, 'LIGHT_WARD').enemyReduction).toBe(45); enemy(s, r, 'FOCUS');
    expect(s.justiceMentor.encounter.enemySpirituality).toBe(107); expect(s.justiceMentor.encounter.powerUses).toEqual({ LIGHT_STRIKE: 1, LIGHT_WARD: 1, FOCUS: 1 });
    expect(s.spirituality).toBe(120); expect(s.health).toBe(100); expect(s.mind).toBe(100); valid(s, r);
  });
  it('enemy exhausted pool turns paid intents into actual original-club20×body without magic or focus', () => {
    const s = fixture(); Object.assign(s.justiceMentor.encounter, { enemySpirituality: 0, powerUses: { LIGHT_STRIKE: 0, LIGHT_WARD: 0, FOCUS: 30 } });
    const r = begin(s); expect(resolveJusticeMentorEnemyAbility(s, 'LIGHT_STRIKE', .5, random(), r).selfGain).toBe(10);
    expect(enemy(s, r, 'LIGHT_WARD').selfGain).toBe(20); expect(enemy(s, r, 'FOCUS').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(r.focusReady).toBe(false); valid(s, r);
  });
  it('paid focus resists one successful clarity or domain while preserving player costs', () => {
    for (const id of [CLARITY, DOMAIN] as const) { const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS');
      expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(r.playerActions[0]!.resisted).toBe(true);
      expect(r.focusReady).toBe(false); expect(s.spirituality).toBe(id === DOMAIN ? 115 : 114);
      expect(player(s, r, id).enemyReduction).toBeGreaterThan(0); expect(r.playerActions[1]!.resisted).toBe(false); valid(s, r); }
  });
  it('focus does not stack or block self-encouragement, purification, failed checks or ordinary evade', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); enemy(s, r, 'FOCUS');
    player(s, r, CLARITY, random(100)); expect(r.focusReady).toBe(true);
    expect(player(s, r, SHARED).selfGain).toBe(65); expect(r.focusReady).toBe(true);
    expect(player(s, r, PURIFICATION).selfGain).toBeGreaterThan(0); expect(r.focusReady).toBe(true);
    expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(r.focusReady).toBe(true);
    expect(player(s, r, CLARITY).enemyReduction).toBe(0); expect(r.focusReady).toBe(false);
    expect(player(s, r, CLARITY).enemyReduction).toBe(32); valid(s, r);
  });
  it('unpaid fallback does not consume paid focus', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s); enemy(s, r, 'FOCUS');
    expect(player(s, r, SHARED).selfGain).toBeGreaterThan(0); expect(player(s, r, CLARITY).enemyReduction).toBe(0);
    expect(player(s, r, DOMAIN).enemyReduction).toBe(10); expect(r.focusReady).toBe(true); valid(s, r);
  });
  it('evade and accidents only change common advantage contributions', () => {
    const s = fixture(), r = begin(s); expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(player(s, r, 'ACCIDENT').selfGain).toBe(-22.5);
    expect(enemy(s, r, 'ACCIDENT').selfGain).toBe(-22.5); expect(s.spirituality).toBe(120); expect(s.health).toBe(100); valid(s, r);
  });
  it('rejects stale/substituted sources and loses authority if the court clearance or resources change', () => {
    const s = fixture(), r = begin(s), source = currentJusticeMentorCombatSource(s)!, rng = random();
    expect(source).toMatchObject({ abilitySource: 'ORIGINAL_LIMITED_G_LIGHT', targetId: 'JM3-CORWIN', enemyWeapon: 'JM3-CORWIN-CLUB', space: 'JM3-COURT',
      clearanceConfirmed: true, sunVulnerable: false, selfEncouragementOnly: true, ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false });
    expect(JSON.stringify(source)).not.toMatch(/EDMUND|UD4-|emotion|vessel|characteristic/);
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'UD4-EDMUND' }, { ...source, enemyWeapon: 'UD4-EDMUND-CLUB' }]) {
      const before = structuredClone(s); expect(resolveJusticeMentorCombatAbility(s, SHARED, 1, rng, r, bad as JusticeMentorCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    s.justiceMentor.encounter.scene.clearanceConfirmed = false; const before = structuredClone(s);
    expect(player(s, r, CLARITY, rng).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0); expect(() => finishJusticeMentorCombatRound(s, r)).toThrow();
  });
  it('finish clears unused focus, records60seconds, preserves actual death and never refills either pool', () => {
    const s = fixture(), r = begin(s), old = structuredClone(s.unshadowed); enemy(s, r, 'FOCUS'); player(s, r, PURIFICATION, random(100)); s.health = 0;
    const o = finishJusticeMentorCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.justiceMentor.encounter.enemySpirituality).toBe(116);
    expect(o.focusReadyAfter).toBe(false); expect(r.focusReady).toBe(false); expect(s.justiceMentor.life.clockSeconds).toBe(60);
    expect(s.unshadowed).toEqual(old); expect(validateJusticeMentorRoundOutcome(o)).toBe(true); expect(() => finishJusticeMentorCombatRound(s, r)).toThrow();
  });
  it('caps each actor at six and detaches finished replay evidence', () => {
    const s = fixture(), r = begin(s), rng = random(); for (let i = 0; i < 6; i++) { player(s, r, 'EVADE', rng); enemy(s, r, 'ACCIDENT'); }
    expect(player(s, r, SHARED, rng).selfGain).toBe(0); expect(enemy(s, r, 'LIGHT_STRIKE').selfGain).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishJusticeMentorCombatRound(s, r); o.powerUses.LIGHT_STRIKE++; expect(justiceMentorRoundOutcome(r).powerUses.LIGHT_STRIKE).toBe(0); expect(validateJusticeMentorRoundOutcome(o)).toBe(false);
  });
  it('replays ordered costs and resists fabricated immunity, provenance, resource refunds or injury threats', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); player(s, r, SHARED); player(s, r, CLARITY); enemy(s, r, 'LIGHT_WARD');
    const o = finishJusticeMentorCombatRound(s, r); expect(validateJusticeMentorRoundOutcome(o)).toBe(true);
    const mutations: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerActions[0]!.paidCost = 0; },
      v => { v.playerActions[1]!.resisted = false; }, v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.source.clearanceConfirmed = false as true; },
      v => { v.enemyMind--; }, v => { v.source.automaticAllyImmunity = true as false; }, v => { v.playerActions[0]!.order = 99; },
      v => { v.playerActions[0]!.threatens = true; }, v => { v.source.sunVulnerable = true as false; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateJusticeMentorRoundOutcome(bad)).toBe(false); }
  });
  it('hides independent opponent facts before actual Justice Mentor3', () => {
    const s = fixture(); s.progression.sequence = 4; const view = projectJusticeMentorCombat(s);
    expect(view.source).toBeNull(); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull(); expect(view.scene).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/CORWIN|科温/);
  });
});
