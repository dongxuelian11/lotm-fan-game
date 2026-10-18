import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createSeaKingState } from '../../src/domain/sea-king/index.js';
import { applySeaKingEncounterCommand } from '../../src/domain/sea-king/encounter.js';
import {
  SEA_KING_COUNT_WHEEL, SEA_KING_ENEMY_COUNT_WHEEL, SEA_KING_ENEMY_ABILITY_WHEEL,
  seaKingActionCount, seaKingEnemyActionCount, seaKingAbilityWheel, drawSeaKingAbility, drawSeaKingEnemyAbility,
  beginSeaKingCombatRound, currentSeaKingCombatSource, resolveSeaKingCombatAbility, resolveSeaKingEnemyAbility,
  finishSeaKingCombatRound, seaKingRoundOutcome, validateSeaKingRoundOutcome, projectSeaKingCombat,
  type SeaKingCombatSource, type SeaKingMoveId,
} from '../../src/domain/sea-king/combat.js';

const TEMPEST = 'tyrant.s3.remote-tempest', DOMAIN = 'tyrant.s3.sea-domain';
const WIND = 'tyrant.s6.wind-control', LIGHTNING = 'tyrant.s4.great-lightning';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'sea-king-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 fixture preserves the real old Benedict death and all original people/objects. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8')).final);
  s.seaKing = createSeaKingState(); s.seaKing.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginSeaKingCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: SeaKingMoveId, rng = random()) => resolveSeaKingCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveSeaKingEnemyAbility>[1]) => resolveSeaKingEnemyAbility(s, id, 1, random(), r);
const valid = (s: SliceState, r: ReturnType<typeof begin>) => expect(validateSeaKingRoundOutcome(finishSeaKingCombatRound(s, r))).toBe(true);

describe('Sea King finite G combat with actual original water and separately paid resources', () => {
  it('uses exact1–6 counts, six player slots25/20/15/20/15/5 and five enemy categories35/25/20/15/5', () => {
    expect(SEA_KING_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(SEA_KING_ENEMY_COUNT_WHEEL).toEqual(SEA_KING_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(seaKingActionCount(roll!)).toBe(count); expect(seaKingEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = seaKingAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual([TEMPEST, DOMAIN, WIND, LIGHTNING, 'EVADE', 'ACCIDENT']);
    expect(wheel.map(v => v.weight)).toEqual([25, 20, 15, 20, 15, 5]);
    expect(SEA_KING_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['WIND', 'WATER_WARD', 'BODY_STRIKE', 'FOCUS', 'ACCIDENT']);
    expect(SEA_KING_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws published player and enemy boundaries once per slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of seaKingAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawSeaKingAbility(rng, s, null)).toBe(a.id); expect(drawSeaKingAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of SEA_KING_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawSeaKingEnemyAbility(rng)).toBe(a.id); expect(drawSeaKingEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('remote wind actually pays6S and scales65 by the new mastery without directly injuring the opponent', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[TEMPEST] = m; const old = structuredClone(s.cataclysmPriest), r = begin(s);
      expect(player(s, r, TEMPEST).selfGain).toBe(65 * (.65 + .35 * m / 500));
      expect(s.spirituality).toBe(114); expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(100);
      expect(s.cataclysmPriest).toEqual(old); expect(r.playerActions[0]).toMatchObject({ paidCost: 6, rolls: [1], fallback: 'NONE', resisted: false }); valid(s, r); }
  });
  it('inherits exact old mastery factor for18 wind and38 lightning independently of new mastery', () => {
    for (const m of [0, 250, 500]) { const s = fixture(); s.progression.mastery[WIND] = m; s.progression.mastery[LIGHTNING] = 500 - m; s.progression.mastery[TEMPEST] = 500;
      const r = begin(s); expect(player(s, r, WIND).enemyReduction).toBe(18 * (.65 + .35 * m / 500));
      expect(player(s, r, LIGHTNING).selfGain).toBe(38 * (.65 + .35 * (500 - m) / 500)); expect(s.spirituality).toBe(110); valid(s, r); }
  });
  it('clamps inherited mastery exactly like actual Cataclysm Priest code', () => {
    const s = fixture(); s.progression.mastery[WIND] = -1; s.progression.mastery[LIGHTNING] = 900; const r = begin(s);
    expect(player(s, r, WIND).enemyReduction).toBe(18 * .65); expect(player(s, r, LIGHTNING).selfGain).toBe(38); valid(s, r);
  });
  it('sea-domain actually pays6S for knowledge18 and uses actual adjacent sea without deleting it', () => {
    const s = fixture(), r = begin(s); expect(player(s, r, DOMAIN).enemyReduction).toBe(32);
    expect(s.spirituality).toBe(114); expect(s.seaKing.encounter.waterSource).toBe('SEAWATER');
    expect(enemy(s, r, 'WATER_WARD').enemyReduction).toBe(45); expect(s.seaKing.encounter.enemySpirituality).toBe(116); valid(s, r);
  });
  it('missing actual sea gives player ordinary evade and enemy original-club fallback without costs or random checks', () => {
    const s = fixture(); s.seaKing.encounter.waterSource = 'NONE'; const r = begin(s), rng = random();
    expect(player(s, r, DOMAIN, rng)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(r.playerActions[0]).toMatchObject({ paidCost: 0, rolls: [], fallback: 'EVADE' });
    expect(enemy(s, r, 'WATER_WARD')).toMatchObject({ selfGain: 20, enemyReduction: 0 });
    expect(s.spirituality).toBe(120); expect(s.seaKing.encounter.enemySpirituality).toBe(120);
    expect(s.seaKing.encounter.powerUses.WATER_WARD).toBe(0); expect(rng.cursor).toBe(0); expect(s.seaKing.encounter.waterSource).toBe('NONE'); valid(s, r);
  });
  it('all four failed checks retain the real4/6S costs with no automatic fallback or health loss', () => {
    const s = fixture(), r = begin(s), rng = random(100, 100, 100, 100);
    for (const id of [TEMPEST, DOMAIN, WIND, LIGHTNING] as const) expect(player(s, r, id, rng)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(98); expect(rng.cursor).toBe(4); expect(s.health).toBe(100); expect(s.seaKing.encounter.enemyHealth).toBe(100);
    expect(r.playerActions.map(a => a.paidCost)).toEqual([6, 6, 4, 6]); valid(s, r);
  });
  it('insufficient player S uses only actual body/held original club, ordinary evade or observe with0S', () => {
    for (const held of [false, true]) { const s = fixture(); s.spirituality = 3; s.town.clubLocation = held ? 'HAND' : 'SHOP'; const r = begin(s), rng = random();
      expect(resolveSeaKingCombatAbility(s, TEMPEST, .5, rng, r).selfGain).toBe(held ? 8 : 6);
      expect(player(s, r, DOMAIN, rng).enemyReduction).toBe(10); expect(player(s, r, WIND, rng).enemyReduction).toBe(10);
      expect(player(s, r, LIGHTNING, rng).selfGain).toBe(0); expect(r.playerActions.map(a => a.fallback)).toEqual(['STRIKE', 'EVADE', 'EVADE', 'OBSERVE']);
      expect(s.spirituality).toBe(3); expect(rng.cursor).toBe(0); valid(s, r); }
  });
  it('a pool exhausted mid-round does not overdraw or refund earlier failed spells', () => {
    const s = fixture(); s.spirituality = 6; const r = begin(s), rng = random(100);
    player(s, r, TEMPEST, rng); expect(player(s, r, TEMPEST, rng).selfGain).toBe(s.town.clubLocation === 'HAND' ? 16 : 12);
    expect(player(s, r, DOMAIN, rng).enemyReduction).toBe(10); expect(s.spirituality).toBe(0); expect(rng.cursor).toBe(1); valid(s, r);
  });
  it('enemy spells each debit the independent pool and never debit the player', () => {
    const s = fixture(), r = begin(s);
    expect(enemy(s, r, 'WIND').selfGain).toBe(75); expect(enemy(s, r, 'WATER_WARD').enemyReduction).toBe(45); enemy(s, r, 'FOCUS');
    expect(s.seaKing.encounter.enemySpirituality).toBe(107); expect(s.seaKing.encounter.powerUses).toEqual({ WIND: 1, WATER_WARD: 1, FOCUS: 1 });
    expect(s.spirituality).toBe(120); expect(s.health).toBe(100); expect(s.mind).toBe(100); valid(s, r);
  });
  it('insufficient enemy S converts each paid intent into actual ordinary original-club20×body', () => {
    const s = fixture(); Object.assign(s.seaKing.encounter, { enemySpirituality: 0, powerUses: { WIND: 0, WATER_WARD: 0, FOCUS: 30 } });
    const r = begin(s); expect(resolveSeaKingEnemyAbility(s, 'WIND', .5, random(), r).selfGain).toBe(10);
    expect(enemy(s, r, 'WATER_WARD').selfGain).toBe(20); expect(enemy(s, r, 'FOCUS').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true); expect(r.focusReady).toBe(false); valid(s, r);
  });
  it('FOCUS resists each kind of successful wind/water pressure once while preserving actual cost', () => {
    for (const id of [TEMPEST, DOMAIN, WIND] as const) { const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS');
      expect(player(s, r, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(r.playerActions[0]!.resisted).toBe(true);
      expect(r.focusReady).toBe(false); expect(s.spirituality).toBe(id === WIND ? 116 : 114);
      const next = player(s, r, id); expect(next.selfGain + next.enemyReduction).toBeGreaterThan(0); expect(r.playerActions[1]!.resisted).toBe(false); valid(s, r); }
  });
  it('FOCUS does not stack, resist lightning, consume itself on failures or claim ordinary evade as magic', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); enemy(s, r, 'FOCUS');
    expect(player(s, r, TEMPEST, random(100)).selfGain).toBe(0); expect(r.focusReady).toBe(true);
    expect(player(s, r, LIGHTNING).selfGain).toBeGreaterThan(0); expect(r.focusReady).toBe(true);
    expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(r.focusReady).toBe(true);
    expect(player(s, r, DOMAIN).enemyReduction).toBe(0); expect(r.focusReady).toBe(false);
    expect(player(s, r, DOMAIN).enemyReduction).toBe(32); valid(s, r);
  });
  it('unpaid resource fallbacks cannot consume the enemy paid resistance', () => {
    const s = fixture(); s.spirituality = 0; const r = begin(s); enemy(s, r, 'FOCUS');
    expect(player(s, r, TEMPEST).selfGain).toBeGreaterThan(0); expect(player(s, r, DOMAIN).enemyReduction).toBe(10);
    expect(player(s, r, WIND).enemyReduction).toBe(10); expect(r.focusReady).toBe(true); valid(s, r);
  });
  it('ordinary evade and accident affect only existing common advantage totals', () => {
    const s = fixture(), r = begin(s); expect(player(s, r, 'EVADE').enemyReduction).toBe(10); expect(player(s, r, 'ACCIDENT').selfGain).toBe(-22.5);
    expect(enemy(s, r, 'ACCIDENT').selfGain).toBe(-22.5); expect(s.spirituality).toBe(120); expect(s.health).toBe(100); valid(s, r);
  });
  it('stale or substituted sources and external water/resource edits cannot spend or draw', () => {
    const s = fixture(), r = begin(s), source = currentSeaKingCombatSource(s)!, rng = random();
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'CP4-BENEDICT' }, { ...source, enemyWeapon: 'FAKE-CLUB' }]) {
      const before = structuredClone(s); expect(resolveSeaKingCombatAbility(s, TEMPEST, 1, rng, r, bad as SeaKingCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    s.seaKing.encounter.waterSource = 'NONE'; const before = structuredClone(s);
    expect(player(s, r, DOMAIN, rng).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0); expect(() => finishSeaKingCombatRound(s, r)).toThrow();
  });
  it('finishing clears unused FOCUS, records60seconds, preserves death and never refills either pool', () => {
    const s = fixture(), r = begin(s), old = structuredClone(s.cataclysmPriest); enemy(s, r, 'FOCUS'); player(s, r, LIGHTNING, random(100)); s.health = 0;
    const o = finishSeaKingCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(114); expect(s.seaKing.encounter.enemySpirituality).toBe(116);
    expect(o.focusReadyAfter).toBe(false); expect(r.focusReady).toBe(false); expect(s.seaKing.life.clockSeconds).toBe(60);
    expect(s.cataclysmPriest).toEqual(old); expect(validateSeaKingRoundOutcome(o)).toBe(true); expect(() => finishSeaKingCombatRound(s, r)).toThrow();
  });
  it('caps both actors at six slots and detaches completed resource evidence', () => {
    const s = fixture(), r = begin(s), rng = random(); for (let i = 0; i < 6; i++) { player(s, r, 'EVADE', rng); enemy(s, r, 'ACCIDENT'); }
    expect(player(s, r, TEMPEST, rng).selfGain).toBe(0); expect(enemy(s, r, 'WIND').selfGain).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishSeaKingCombatRound(s, r); o.powerUses.WIND++; expect(seaKingRoundOutcome(r).powerUses.WIND).toBe(0); expect(validateSeaKingRoundOutcome(o)).toBe(false);
  });
  it('replays actual order and rejects fabricated spells, costs, resistance, water or automatic immunity', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); player(s, r, LIGHTNING); player(s, r, DOMAIN); enemy(s, r, 'WATER_WARD');
    const o = finishSeaKingCombatRound(s, r); expect(validateSeaKingRoundOutcome(o)).toBe(true);
    for (const mutate of [(v: typeof o) => { v.playerSpiritualityAfter++; }, (v: typeof o) => { v.playerActions[0]!.paidCost = 0; },
      (v: typeof o) => { v.playerActions[1]!.resisted = false; }, (v: typeof o) => { v.enemyActions[1]!.paidCost = 0; },
      (v: typeof o) => { v.source.waterSource = 'NONE'; v.waterSource = 'NONE'; }, (v: typeof o) => { v.enemyMind--; },
      (v: typeof o) => { v.source.automaticAllyImmunity = true as false; }, (v: typeof o) => { v.playerActions[0]!.order = 99; }]) {
      const bad = structuredClone(o); mutate(bad); expect(validateSeaKingRoundOutcome(bad)).toBe(false);
    }
  });
  it('hides new opponent and resources before actual Sea King3', () => {
    const s = fixture(); s.progression.sequence = 4; const view = projectSeaKingCombat(s);
    expect(Object.hasOwn(view, 'source')).toBe(false); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull(); expect(view.waterSource).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/QUENTIN|昆廷/);
  });
});
