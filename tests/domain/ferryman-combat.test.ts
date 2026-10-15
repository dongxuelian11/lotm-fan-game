import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { applyFerrymanCommand, createFerrymanState } from '../../src/domain/ferryman/index.js';
import { applyLongChapterCommand } from '../../src/domain/long-chapter/index.js';
import { applyFerrymanEncounterCommand } from '../../src/domain/ferryman/encounter.js';
import {
  FERRYMAN_COUNT_WHEEL, FERRYMAN_ENEMY_COUNT_WHEEL, FERRYMAN_ENEMY_ABILITY_WHEEL,
  ferrymanActionCount, ferrymanEnemyActionCount, ferrymanAbilityWheel, drawFerrymanAbility, drawFerrymanEnemyAbility,
  beginFerrymanCombatRound, currentFerrymanCombatSource, resolveFerrymanCombatAbility, resolveFerrymanEnemyAbility,
  finishFerrymanCombatRound, ferrymanRoundOutcome, validateFerrymanRoundOutcome, projectFerrymanCombat,
  type FerrymanCombatSource, type FerrymanMoveId,
} from '../../src/domain/ferryman/combat.js';

const FERRY = 'death.s3.bounded-ferry', WARD = 'death.s3.departure-ward';
const SEAL = 'death.s4.underworld-seal', WORDS = 'death.s6.dead-words';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'ferryman-directed-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 unit fixture. Real pre-existing old histories and actual new introduction are preserved;
 * only the new promotion and roomy combat resources are arranged for isolated rules tests. */
function fixture(postCycle = false): SliceState {
  const path = postCycle ? 'long-chapter-v01390' : 'undying-v01260';
  const s = migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${path}/natural.json`, 'utf8')).final);
  s.ferryman = createFerrymanState();
  if (postCycle) applyLongChapterCommand(s, { type: 'CONTINUE_FERRYMAN' }, context);
  applyFerrymanCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.ferryman.promotionWeek = s.week; s.ferryman.promotionDate = structuredClone(s.date); s.ferryman.undyingActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery[FERRY] = 0; s.progression.mastery[WARD] = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginFerrymanCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: FerrymanMoveId, rng = random()) => resolveFerrymanCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveFerrymanEnemyAbility>[1]) => resolveFerrymanEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateFerrymanRoundOutcome(finishFerrymanCombatRound(s, r))).toBe(true);

describe('Ferryman finite G combat with independent original Rowan and actual ordered costs', () => {
  it('keeps exact1–6 counts, six player slots25/20/20/15/15/5 and enemy35/25/20/15/5', () => {
    expect(FERRYMAN_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(FERRYMAN_ENEMY_COUNT_WHEEL).toEqual(FERRYMAN_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(ferrymanActionCount(roll!)).toBe(count); expect(ferrymanEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = ferrymanAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([FERRY, WARD, WORDS, SEAL, 'EVADE', 'ACCIDENT']);
    expect(wheel.map(v => v.weight)).toEqual([25, 20, 20, 15, 15, 5]);
    expect(FERRYMAN_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['ECHO_STRIKE', 'SEAL_WARD', 'BODY_STRIKE', 'FOCUS', 'ACCIDENT']);
    expect(FERRYMAN_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws published boundaries once per slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of ferrymanAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawFerrymanAbility(rng, s, null)).toBe(a.id); expect(drawFerrymanAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of FERRYMAN_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawFerrymanEnemyAbility(rng)).toBe(a.id); expect(drawFerrymanEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('bounded ferry pays6S for36 reduction without moving living Rowan, injuring him or recruiting spirits', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[FERRY] = m;
      const old = structuredClone(s.undying), gray = structuredClone(s.gatekeeper.companion), life = structuredClone(s.ferryman.life), r = begin(s);
      expect(player(s, r, FERRY)).toMatchObject({ selfGain: 0, enemyReduction: 36, threatens: false, mentalPressure: false });
      expect(s.spirituality).toBe(114); expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(100);
      expect(s.undying).toEqual(old); expect(s.gatekeeper.companion).toEqual(gray); expect(s.ferryman.life).toEqual(life);
      expect(r.playerActions[0]).toMatchObject({ paidCost: 6, rolls: [1], fallback: 'NONE', resisted: false }); valid(s, r); }
  });
  it('inherits actual original death.s6.dead-words38 and death.s4.underworld-seal20 mastery independently', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[SEAL] = m; s.progression.mastery[WORDS] = 500 - m; s.progression.mastery[FERRY] = 500;
      const r = begin(s); expect(player(s, r, SEAL)).toMatchObject({ enemyReduction: 20 * (.65 + .35 * m / 500), threatens: false });
      expect(player(s, r, WORDS)).toMatchObject({ selfGain: 38 * (.65 + .35 * (500 - m) / 500), threatens: true });
      expect(s.spirituality).toBe(108); valid(s, r); }
  });
  it('clamps inherited mastery exactly like Undying rather than inventing a new multiplier', () => {
    const s = fixture(); s.progression.mastery[SEAL] = -1; s.progression.mastery[WORDS] = 900; const r = begin(s);
    expect(player(s, r, SEAL).enemyReduction).toBe(20 * .65); expect(player(s, r, WORDS).selfGain).toBe(38); valid(s, r);
  });
  it('new ferry uses will18, ward uses knowledge18 and the two inherited slots use their stated16 checks', () => {
    for (const [id, ability, difficulty] of [[FERRY, 'will', 18], [WARD, 'knowledge', 18], [WORDS, 'will', 16], [SEAL, 'knowledge', 16]] as const) {
      const s = fixture(); s.character.coreStats[ability] = difficulty; const r = begin(s);
      const ok = player(s, r, id, random(50)); expect(ok.selfGain + ok.enemyReduction).toBeGreaterThan(0);
      const fail = player(s, r, id, random(51)); expect(fail).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(108); valid(s, r);
    }
  });
  it('failed checks retain four exact6S costs without a free fallback, injury or mind damage', () => {
    const s = fixture(), r = begin(s), rng = random(100, 100, 100, 100);
    for (const id of [FERRY, WARD, WORDS, SEAL] as const) expect(player(s, r, id, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(96); expect(rng.cursor).toBe(4); expect(s.health).toBe(100); expect(s.ferryman.encounter.enemyMind).toBe(100);
    expect(r.playerActions.map(a => a.paidCost)).toEqual([6, 6, 6, 6]); valid(s, r);
  });
  it('low player S allows only original body or held-club strike, ordinary evade and observation at0S', () => {
    for (const held of [false, true]) { const s = fixture(); s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; const r = begin(s), rng = random();
      expect(player(s, r, FERRY, rng).enemyReduction).toBe(0); expect(player(s, r, WARD, rng).enemyReduction).toBe(0);
      expect(resolveFerrymanCombatAbility(s, WORDS, .5, rng, r).selfGain).toBe(held ? 8 : 6);
      expect(player(s, r, SEAL, rng).enemyReduction).toBe(10);
      expect(r.playerActions.map(a => a.fallback)).toEqual(['OBSERVE', 'OBSERVE', 'STRIKE', 'EVADE']);
      expect(s.spirituality).toBe(3); expect(rng.cursor).toBe(0); valid(s, r); }
  });
  it('mid-round exhaustion cannot overdraw or refund an earlier failure', () => {
    const s = fixture(); s.spirituality = 6; const r = begin(s), rng = random(100);
    player(s, r, WORDS, rng); expect(player(s, r, WORDS, rng).selfGain).toBe(s.town.clubLocation === 'HAND' ? 16 : 12);
    expect(player(s, r, FERRY, rng).enemyReduction).toBe(0); expect(player(s, r, SEAL, rng).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(0); expect(rng.cursor).toBe(1); valid(s, r);
  });
  it('enemy originalG echo strike and ward and focus debit only his independent pool', () => {
    const s = fixture(), r = begin(s);
    expect(enemy(s, r, 'ECHO_STRIKE').selfGain).toBe(75); expect(enemy(s, r, 'SEAL_WARD').enemyReduction).toBe(45); enemy(s, r, 'FOCUS');
    expect(s.ferryman.encounter.enemySpirituality).toBe(107); expect(s.ferryman.encounter.powerUses).toEqual({ ECHO_STRIKE: 1, SEAL_WARD: 1, FOCUS: 1 });
    expect(s.spirituality).toBe(120); expect(s.health).toBe(100); expect(s.mind).toBe(100); valid(s, r);
  });
  it('enemy exhausted pool turns paid intents into actual original-club20×body without magic or focus', () => {
    const s = fixture(); Object.assign(s.ferryman.encounter, { enemySpirituality: 0, powerUses: { ECHO_STRIKE: 0, SEAL_WARD: 0, FOCUS: 30 } });
    const r = begin(s); expect(resolveFerrymanEnemyAbility(s, 'ECHO_STRIKE', .5, random(), r).selfGain).toBe(10);
    expect(enemy(s, r, 'SEAL_WARD').selfGain).toBe(20); expect(enemy(s, r, 'FOCUS').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(r.focusReady).toBe(false); valid(s, r);
  });
  it('paid focus resists one successful ferry or inherited seal while preserving player costs', () => {
    for (const id of [FERRY, SEAL] as const) { const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS');
      expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(r.playerActions[0]!.resisted).toBe(true);
      expect(r.focusReady).toBe(false); expect(s.spirituality).toBe(114);
      expect(player(s, r, id).enemyReduction).toBeGreaterThan(0); expect(r.playerActions[1]!.resisted).toBe(false); valid(s, r); }
  });
  it('focus does not stack or block ward, dead-words, failed checks or ordinary evade', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); enemy(s, r, 'FOCUS');
    player(s, r, FERRY, random(100)); expect(r.focusReady).toBe(true);
    expect(player(s, r, WARD).enemyReduction).toBe(32); expect(r.focusReady).toBe(true);
    expect(player(s, r, WORDS).selfGain).toBeGreaterThan(0); expect(r.focusReady).toBe(true);
    expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(r.focusReady).toBe(true);
    expect(player(s, r, FERRY).enemyReduction).toBe(0); expect(r.focusReady).toBe(false);
    expect(player(s, r, FERRY).enemyReduction).toBe(36); valid(s, r);
  });
  it('unpaid fallback does not consume paid focus', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s); enemy(s, r, 'FOCUS');
    expect(player(s, r, WORDS).selfGain).toBeGreaterThan(0); expect(player(s, r, FERRY).enemyReduction).toBe(0);
    expect(player(s, r, SEAL).enemyReduction).toBe(10); expect(r.focusReady).toBe(true); valid(s, r);
  });
  it('evade and accidents only change common advantage contributions', () => {
    const s = fixture(), r = begin(s); expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(player(s, r, 'ACCIDENT').selfGain).toBe(-22.5);
    expect(enemy(s, r, 'ACCIDENT').selfGain).toBe(-22.5); expect(s.spirituality).toBe(120); expect(s.health).toBe(100); valid(s, r);
  });
  it('rejects stale/substituted sources and loses authority if the court clearance or resources change', () => {
    const s = fixture(), r = begin(s), source = currentFerrymanCombatSource(s)!, rng = random();
    expect(source).toMatchObject({ abilitySource: 'ORIGINAL_LIMITED_G_SPIRIT', targetId: 'FR3-ROWAN', enemyWeapon: 'FR3-ROWAN-CLUB', space: 'FR3-COURT',
      sourceEpoch: 'ORIGINAL', providerId: 'FR3-LEWIS', clearanceConfirmed: true, automaticSpiritAlly: false, ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false });
    expect(JSON.stringify(source)).not.toMatch(/OWEN|UDY4-|emotion|vessel|characteristic/);
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'UDY4-OWEN' }, { ...source, enemyWeapon: 'UDY4-OWEN-CLUB' }]) {
      const before = structuredClone(s); expect(resolveFerrymanCombatAbility(s, FERRY, 1, rng, r, bad as FerrymanCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    s.ferryman.encounter.scene.clearanceConfirmed = false; const before = structuredClone(s);
    expect(player(s, r, WARD, rng).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0); expect(() => finishFerrymanCombatRound(s, r)).toThrow();
  });
  it('finish clears unused focus, records60seconds, preserves actual death and never refills either pool', () => {
    const s = fixture(), r = begin(s), old = structuredClone(s.undying); enemy(s, r, 'FOCUS'); player(s, r, WORDS, random(100)); s.health = 0;
    const o = finishFerrymanCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.ferryman.encounter.enemySpirituality).toBe(116);
    expect(o.focusReadyAfter).toBe(false); expect(r.focusReady).toBe(false); expect(s.ferryman.life.clockSeconds).toBe(60);
    expect(s.undying).toEqual(old); expect(validateFerrymanRoundOutcome(o)).toBe(true); expect(() => finishFerrymanCombatRound(s, r)).toThrow();
  });
  it('caps each actor at six and detaches finished replay evidence', () => {
    const s = fixture(), r = begin(s), rng = random(); for (let i = 0; i < 6; i++) { player(s, r, 'EVADE', rng); enemy(s, r, 'ACCIDENT'); }
    expect(player(s, r, FERRY, rng).selfGain).toBe(0); expect(enemy(s, r, 'ECHO_STRIKE').selfGain).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishFerrymanCombatRound(s, r); o.powerUses.ECHO_STRIKE++; expect(ferrymanRoundOutcome(r).powerUses.ECHO_STRIKE).toBe(0); expect(validateFerrymanRoundOutcome(o)).toBe(false);
  });
  it('replays ordered costs and resists fabricated immunity, provenance, resource refunds or injury threats', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); player(s, r, WARD); player(s, r, FERRY); enemy(s, r, 'SEAL_WARD');
    const o = finishFerrymanCombatRound(s, r); expect(validateFerrymanRoundOutcome(o)).toBe(true);
    const mutations: ((v: typeof o) => void)[] = [v => { v.playerSpiritualityAfter++; }, v => { v.playerActions[0]!.paidCost = 0; },
      v => { v.playerActions[1]!.resisted = false; }, v => { v.enemyActions[1]!.paidCost = 0; }, v => { v.source.clearanceConfirmed = false as true; },
      v => { v.enemyMind--; }, v => { v.source.automaticAllyImmunity = true as false; }, v => { v.playerActions[0]!.order = 99; },
      v => { v.playerActions[0]!.threatens = true; }, v => { v.source.providerId = 'FR3-HANNA'; }];
    for (const mutate of mutations) { const bad = structuredClone(o); mutate(bad); expect(validateFerrymanRoundOutcome(bad)).toBe(false); }
  });
  it('uses a new post-cycle epoch without recalling the released original Gray Feather or old Owen', () => {
    const s = fixture(true), old = structuredClone(s.undying), gray = structuredClone(s.gatekeeper.companion), history = structuredClone(s.longChapter), r = begin(s);
    expect(r.source).toMatchObject({ sourceEpoch: 'POST_CYCLE', providerId: 'FR3-HANNA', automaticSpiritAlly: false });
    expect(s.gatekeeper.companion.status).toBe('OUTSIDE');
    player(s, r, FERRY); player(s, r, WORDS); enemy(s, r, 'ECHO_STRIKE'); valid(s, r);
    expect(s.undying).toEqual(old); expect(s.gatekeeper.companion).toEqual(gray); expect(s.longChapter).toEqual(history);
  });
  it('hides independent opponent facts before actual Ferryman3', () => {
    const s = fixture(); s.progression.sequence = 4; const view = projectFerrymanCombat(s);
    expect(view.source).toBeNull(); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull(); expect(view.scene).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/ROWAN|罗温/);
  });
});
