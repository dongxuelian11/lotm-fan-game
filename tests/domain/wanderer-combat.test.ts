import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applyWandererCommand, createWandererState } from '../../src/domain/wanderer/index.js';
import { applyWandererEncounterCommand } from '../../src/domain/wanderer/encounter.js';
import {
  WANDERER_COUNT_WHEEL, WANDERER_ENEMY_COUNT_WHEEL, WANDERER_ENEMY_ABILITY_WHEEL,
  wandererActionCount, wandererEnemyActionCount, wandererAbilityWheel, drawWandererAbility, drawWandererEnemyAbility,
  beginWandererCombatRound, currentWandererCombatSource, resolveWandererCombatAbility, resolveWandererEnemyAbility,
  finishWandererCombatRound, wandererRoundOutcome, validateWandererRoundOutcome, projectWandererCombat,
  type WandererCombatSource, type WandererMoveId,
} from '../../src/domain/wanderer/combat.js';

const WANDER = 'door.s3.star-wandering', POSITION = 'door.s3.astral-positioning';
const TRAVEL = 'door.s5.travel', TRICKS = 'door.s8.tricks';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'wanderer-directed-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 unit fixture based on the declared directed-S4 prefix plus its original60 public commands.
 * Actual S4 target/object history is retained; S3 promotion and roomy combat resources are arranged only here. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json', 'utf8')).final);
  s.wanderer = createWandererState(); applyWandererCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.wanderer.promotionWeek = s.week; s.wanderer.secretsSorcererActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[WANDER] = 0; s.progression.mastery[POSITION] = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.perception = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyWandererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyWandererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginWandererCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: WandererMoveId, rng = random()) => resolveWandererCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveWandererEnemyAbility>[1]) => resolveWandererEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateWandererRoundOutcome(finishWandererCombatRound(s, r))).toBe(true);

describe('Wanderer finite G combat with original Cassian and actual ordered resources', () => {
  it('retains exact1–6 counts and published player25/20/20/15/15/5 and enemy35/25/20/15/5 wheels', () => {
    expect(WANDERER_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(WANDERER_ENEMY_COUNT_WHEEL).toEqual(WANDERER_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(wandererActionCount(roll!)).toBe(count); expect(wandererEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = wandererAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([WANDER, POSITION, TRICKS, TRAVEL, 'EVADE', 'ACCIDENT']); expect(wheel.map(v => v.weight)).toEqual([25, 20, 20, 15, 15, 5]);
    expect(WANDERER_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['VECTOR_STRIKE', 'REFRACT_WARD', 'BODY_STRIKE', 'PARALLAX', 'ACCIDENT']);
    expect(WANDERER_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws each published boundary exactly once without adding slots', () => {
    const s = fixture(); let boundary = 0;
    for (const a of wandererAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawWandererAbility(rng, s, null)).toBe(a.id); expect(drawWandererAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of WANDERER_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawWandererEnemyAbility(rng)).toBe(a.id); expect(drawWandererEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('successful side-step pays6S and moves the same body1m out then1m back within the same slot', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer), records = structuredClone(s.recorder), life = structuredClone(s.wanderer.life), r = begin(s);
    expect(player(s, r, WANDER)).toMatchObject({ selfGain: 0, enemyReduction: 36, threatens: false, mentalPressure: false });
    expect(s.spirituality).toBe(114); expect(s.wanderer.encounter.scene.playerPosition).toBe('ORIGIN');
    expect(r.playerActions[0]!.movements).toEqual([
      { from: 'ORIGIN', to: 'SIDE', metres: 1, actualOriginalBody: true, enemyDistanceBefore: 2, enemyDistanceAfter: Math.sqrt(5) },
      { from: 'SIDE', to: 'ORIGIN', metres: 1, actualOriginalBody: true, enemyDistanceBefore: Math.sqrt(5), enemyDistanceAfter: 2 },
    ]);
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(100); expect(s.secretsSorcerer).toEqual(old); expect(s.recorder).toEqual(records); expect(s.wanderer.life).toEqual(life);
    const o = finishWandererCombatRound(s, r); expect(o).toMatchObject({ movementCount: 2, totalMetres: 2, playerPositionAfter: 'ORIGIN', enemyDistanceAfter: 2 }); expect(validateWandererRoundOutcome(o)).toBe(true);
  });
  it('positioning grants30 own advantage but never damage permission, mind damage or body movement', () => {
    const s = fixture(), r = begin(s); expect(player(s, r, POSITION)).toMatchObject({ selfGain: 30, enemyReduction: 0, threatens: false, mentalPressure: false });
    expect(r.playerActions[0]!.movements).toEqual([]); expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100 }); valid(s, r);
  });
  it('inherits original tricks36 and travel22 mastery independently without consuming recorded powers', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[TRAVEL] = m; s.progression.mastery[TRICKS] = 500 - m; s.progression.mastery[WANDER] = 500;
      const records = structuredClone(s.recorder), r = begin(s); expect(player(s, r, TRAVEL)).toMatchObject({ enemyReduction: 22 * (.65 + .35 * m / 500), threatens: false });
      expect(player(s, r, TRICKS)).toMatchObject({ selfGain: 36 * (.65 + .35 * (500 - m) / 500), threatens: true });
      expect(s.spirituality).toBe(108); expect(s.recorder).toEqual(records); valid(s, r); }
  });
  it('clamps inherited mastery exactly to0..500', () => {
    const s = fixture(); s.progression.mastery[TRAVEL] = -1; s.progression.mastery[TRICKS] = 900; const r = begin(s);
    expect(player(s, r, TRAVEL).enemyReduction).toBe(22 * .65); expect(player(s, r, TRICKS).selfGain).toBe(36); valid(s, r);
  });
  it('uses new perception18/knowledge18 and original knowledge16/perception16 checks', () => {
    for (const [id, ability, difficulty] of [[WANDER, 'perception', 18], [POSITION, 'knowledge', 18], [TRICKS, 'knowledge', 16], [TRAVEL, 'perception', 16]] as const) {
      const s = fixture(); s.character.coreStats[ability] = difficulty; const r = begin(s);
      expect(player(s, r, id, random(50)).selfGain + r.playerActions[0]!.enemyReduction).toBeGreaterThan(0);
      expect(player(s, r, id, random(51))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(r.playerActions[1]!.movements).toEqual([]); expect(s.spirituality).toBe(108); valid(s, r);
    }
  });
  it('failed checks keep four6S costs and no free fallback, movement or damage', () => {
    const s = fixture(), r = begin(s), rng = random(100, 100, 100, 100);
    for (const id of [WANDER, POSITION, TRICKS, TRAVEL] as const) expect(player(s, r, id, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(96); expect(rng.cursor).toBe(4); expect(r.playerActions.every(a => a.movements.length === 0 && a.fallback === 'NONE')).toBe(true); valid(s, r);
  });
  it('low S permits only original physical strike, ordinary evade and observation at0S', () => {
    for (const held of [false, true]) { const s = fixture(); s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; const r = begin(s), rng = random();
      expect(player(s, r, WANDER, rng).enemyReduction).toBe(0); expect(player(s, r, POSITION, rng).selfGain).toBe(0);
      expect(resolveWandererCombatAbility(s, TRICKS, .5, rng, r).selfGain).toBe(held ? 8 : 6); expect(player(s, r, TRAVEL, rng).enemyReduction).toBe(10);
      expect(r.playerActions.map(a => a.fallback)).toEqual(['OBSERVE', 'OBSERVE', 'STRIKE', 'EVADE']);
      expect(r.playerActions.every(a => a.movements.length === 0)).toBe(true); expect(s.spirituality).toBe(3); expect(rng.cursor).toBe(0); valid(s, r); }
  });
  it('mid-round exhaustion does not overdraw, refund earlier failure or grant a side-step', () => {
    const s = fixture(); s.spirituality = 6; const r = begin(s), rng = random(100);
    player(s, r, TRICKS, rng); expect(player(s, r, TRICKS, rng).selfGain).toBe(s.town.clubLocation === 'HAND' ? 16 : 12);
    expect(player(s, r, WANDER, rng).enemyReduction).toBe(0); expect(player(s, r, TRAVEL, rng).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(0); expect(rng.cursor).toBe(1); valid(s, r);
  });
  it('enemy spells debit only his independent original120S pool and retain serial power counts', () => {
    const s = fixture(), r = begin(s); expect(enemy(s, r, 'VECTOR_STRIKE').selfGain).toBe(75); expect(enemy(s, r, 'REFRACT_WARD').enemyReduction).toBe(45); enemy(s, r, 'PARALLAX');
    expect(s.wanderer.encounter.enemySpirituality).toBe(107); expect(s.wanderer.encounter.powerUses).toEqual({ VECTOR_STRIKE: 1, REFRACT_WARD: 1, PARALLAX: 1 });
    expect(s.spirituality).toBe(120); expect(s.health).toBe(100); expect(s.mind).toBe(100); valid(s, r);
  });
  it('exhausted enemy intents become ordinary original-rod20×body without spell or parallax', () => {
    const s = fixture(); Object.assign(s.wanderer.encounter, { enemySpirituality: 0, powerUses: { VECTOR_STRIKE: 0, REFRACT_WARD: 0, PARALLAX: 30 } });
    const r = begin(s); expect(resolveWandererEnemyAbility(s, 'VECTOR_STRIKE', .5, random(), r).selfGain).toBe(10);
    expect(enemy(s, r, 'REFRACT_WARD').selfGain).toBe(20); expect(enemy(s, r, 'PARALLAX').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(r.parallaxReady).toBe(false); valid(s, r);
  });
  it('paid parallax resists one successful new positioning or side-step and retains its6S cost', () => {
    for (const id of [WANDER, POSITION] as const) { const s = fixture(), r = begin(s); enemy(s, r, 'PARALLAX');
      expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(r.playerActions[0]).toMatchObject({ resisted: true, movements: [] });
      expect(r.parallaxReady).toBe(false); expect(s.spirituality).toBe(114); player(s, r, id); expect(r.playerActions[1]!.resisted).toBe(false); valid(s, r); }
  });
  it('parallax does not stack or block old tricks, old travel, failed checks or ordinary evade', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'PARALLAX'); enemy(s, r, 'PARALLAX'); player(s, r, WANDER, random(100)); expect(r.parallaxReady).toBe(true);
    expect(player(s, r, TRAVEL).enemyReduction).toBeGreaterThan(0); expect(player(s, r, TRICKS).selfGain).toBeGreaterThan(0); expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(r.parallaxReady).toBe(true);
    expect(player(s, r, WANDER).enemyReduction).toBe(0); expect(r.parallaxReady).toBe(false); expect(player(s, r, WANDER).enemyReduction).toBe(36); valid(s, r);
  });
  it('unpaid fallback never consumes the paid parallax resistance', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s); enemy(s, r, 'PARALLAX'); player(s, r, WANDER); player(s, r, POSITION); player(s, r, TRICKS); player(s, r, TRAVEL);
    expect(r.parallaxReady).toBe(true); valid(s, r);
  });
  it('rejects stale source, wrong original target and changed resources without drawing or spending', () => {
    const s = fixture(), r = begin(s), rng = random(), before = structuredClone(s);
    const wrong = { ...r.source, targetId: 'SS4-ARCH-B' } as unknown as WandererCombatSource;
    expect(resolveWandererCombatAbility(s, WANDER, 1, rng, r, wrong).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    s.wanderer.encounter.weaponLocation = 'COURT'; expect(currentWandererCombatSource(s)).toBeNull();
    expect(player(s, r, POSITION, rng).selfGain).toBe(0); expect(rng.cursor).toBe(0); expect(() => finishWandererCombatRound(s, r)).toThrow();
  });
  it('finish clears unused parallax and records60seconds without healing death or refilling either pool', () => {
    const s = fixture(), r = begin(s), old = structuredClone(s.secretsSorcerer); enemy(s, r, 'PARALLAX'); player(s, r, TRICKS, random(100)); s.health = 0;
    const o = finishWandererCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.wanderer.encounter.enemySpirituality).toBe(116);
    expect(o.parallaxReadyAfter).toBe(false); expect(r.parallaxReady).toBe(false); expect(s.wanderer.life.clockSeconds).toBe(60); expect(s.secretsSorcerer).toEqual(old);
    expect(validateWandererRoundOutcome(o)).toBe(true); expect(() => finishWandererCombatRound(s, r)).toThrow();
  });
  it('caps both actors at six and keeps no more than12 actual movement legs in a round', () => {
    const s = fixture(), r = begin(s); for (let i = 0; i < 6; i++) { player(s, r, WANDER); enemy(s, r, 'ACCIDENT'); }
    const rng = random(); expect(player(s, r, WANDER, rng).enemyReduction).toBe(0); expect(enemy(s, r, 'VECTOR_STRIKE').selfGain).toBe(0); expect(rng.cursor).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6);
    const o = finishWandererCombatRound(s, r); expect(o).toMatchObject({ movementCount: 12, totalMetres: 12 }); expect(validateWandererRoundOutcome(o)).toBe(true);
    o.powerUses.VECTOR_STRIKE++; expect(wandererRoundOutcome(r).powerUses.VECTOR_STRIKE).toBe(0); expect(validateWandererRoundOutcome(o)).toBe(false);
  });
  it('rejects forged refunds, movement legs, distance, immunity, action order and positioning injury permission', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'PARALLAX'); player(s, r, POSITION); player(s, r, WANDER); enemy(s, r, 'REFRACT_WARD');
    const o = finishWandererCombatRound(s, r); expect(validateWandererRoundOutcome(o)).toBe(true);
    const mutations: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerActions[0]!.paidCost = 0; },
      v => { v.playerActions[0]!.resisted = false; }, v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.source.clearanceConfirmed = false as true; },
      v => { v.enemyMind--; }, v => { v.source.automaticAllyImmunity = true as false; }, v => { v.playerActions[0]!.order = 99; },
      v => { v.playerActions[0]!.threatens = true; }, v => { v.totalMetres = 1000; }, v => { v.playerActions[1]!.movements.pop(); },
      v => { v.playerActions[1]!.movements[0]!.enemyDistanceAfter = 2; }, v => { v.playerActions[1]!.movements[1]!.to = 'SIDE'; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateWandererRoundOutcome(bad)).toBe(false); }
  });
  it('uses no era field or replacement body and hides enemy facts before actual Wanderer3', () => {
    const s = fixture(), r = begin(s); expect(r.source).not.toHaveProperty('sourceEpoch'); expect(s.wanderer.encounter).not.toHaveProperty('sourceEpoch');
    s.progression.sequence = 4; const view = projectWandererCombat(s); expect(view.source).toBeNull(); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull(); expect(view.scene).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/CASSIAN|卡西安/);
  });
});
