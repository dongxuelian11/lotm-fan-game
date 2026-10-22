import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createFearBishopState } from '../../src/domain/fear-bishop/index.js';
import { applyFearBishopEncounterCommand } from '../../src/domain/fear-bishop/encounter.js';
import {
  FEAR_BISHOP_COUNT_WHEEL, FEAR_BISHOP_ENEMY_COUNT_WHEEL, FEAR_BISHOP_ENEMY_ABILITY_WHEEL,
  fearBishopActionCount, fearBishopEnemyActionCount, fearBishopAbilityWheel,
  drawFearBishopAbility, drawFearBishopEnemyAbility, beginFearBishopCombatRound,
  currentFearBishopCombatSource, resolveFearBishopCombatAbility, resolveFearBishopEnemyAbility,
  finishFearBishopCombatRound, fearBishopRoundOutcome, validateFearBishopRoundOutcome, projectFearBishopCombat,
  type FearBishopCombatSource, type FearBishopMoveId,
} from '../../src/domain/fear-bishop/combat.js';

const DISSOLUTION = 'darkness.s3.dark-dissolution', SLEEP_FEAR = 'darkness.s3.sleep-fear';
const MISFORTUNE = 'darkness.s4.limited-misfortune', ASSISTANCE = 'darkness.s5.spirit-assistance';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'fear-bishop-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 fixture preserves the authentic dead Bram and original Leaf acquisition history. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8')).final);
  s.fearBishop = createFearBishopState(); s.fearBishop.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30; s.progression.mastery[DISSOLUTION] = 500;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginFearBishopCombatRound(s, 'ATTACK', random());

describe('Fear Bishop finite shared combat and the one inherited original Leaf', () => {
  it('uses exact 1–6 counts for both sides and six published player weights', () => {
    expect(FEAR_BISHOP_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(FEAR_BISHOP_ENEMY_COUNT_WHEEL).toEqual(FEAR_BISHOP_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(fearBishopActionCount(roll!)).toBe(count); expect(fearBishopEnemyActionCount(roll!)).toBe(count);
    }
    const s = fixture();
    expect(fearBishopAbilityWheel(s, null).map(v => v.id)).toEqual(['STRIKE', DISSOLUTION, SLEEP_FEAR, MISFORTUNE, ASSISTANCE, 'ACCIDENT']);
    expect(fearBishopAbilityWheel(s, null).map(v => v.weight)).toEqual([20, 25, 20, 15, 15, 5]);
    expect(FEAR_BISHOP_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws the displayed boundaries with one draw per player or enemy slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of fearBishopAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawFearBishopAbility(rng, s, null)).toBe(a.id); expect(drawFearBishopAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of FEAR_BISHOP_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawFearBishopEnemyAbility(rng)).toBe(a.id); expect(drawFearBishopEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('dissolution6/knowledge18 produces mastery-scaled advantage without direct H/M damage or erasing a body', () => {
    for (const mastery of [0, 250, 500]) {
      const s = fixture(); s.progression.mastery[DISSOLUTION] = mastery; const r = begin(s), rng = random(1);
      expect(resolveFearBishopCombatAbility(s, DISSOLUTION, 1, rng, r)).toMatchObject({ selfGain: 65 * (.65 + .35 * mastery / 500), enemyReduction: 0, threatens: true });
      expect(s.spirituality).toBe(114); expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
      expect(s.fearBishop.encounter.weaponLocation).toBe('HAND'); expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
    }
  });
  it('paid failed checks have no ordinary consolation and keep each real cost', () => {
    const s = fixture(), r = begin(s), rng = random(100, 100, 100);
    for (const id of [DISSOLUTION, SLEEP_FEAR, MISFORTUNE] as const)
      expect(resolveFearBishopCombatAbility(s, id, 1, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(105); expect(rng.cursor).toBe(3);
    expect(s.combat!.enemyMind).toBe(100); expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
  });
  it('sleep-fear5/32 and inherited misfortune4/22 are finite pressure, with no direct mind or will edits', () => {
    const s = fixture(), r = begin(s), rng = random(1, 1), will = s.character.coreStats.will;
    expect(resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r)).toMatchObject({ enemyReduction: 32, threatens: false, mentalPressure: false });
    expect(resolveFearBishopCombatAbility(s, MISFORTUNE, 1, rng, r)).toMatchObject({ enemyReduction: 22, threatens: false });
    expect(s.spirituality).toBe(111); expect(s.mind).toBe(100); expect(s.character.coreStats.will).toBe(will); expect(s.combat!.enemyMind).toBe(100);
    expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
  });
  it('paid FOCUS resists exactly the next formed sleep-fear once and never refunds its cost', () => {
    const s = fixture(), r = begin(s), rng = random(1, 1);
    expect(resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r).enemyReduction).toBe(0);
    expect(r.playerActions[0]!.resisted).toBe(true); expect(r.focusReady).toBe(false);
    expect(resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r).enemyReduction).toBe(32);
    expect(s.spirituality).toBe(110); expect(s.fearBishop.encounter.enemySpirituality).toBe(116);
    expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
  });
  it('FOCUS does not stack, is not spent by failed pressure or misfortune, and clears at round end', () => {
    const s = fixture(), r = begin(s), rng = random(100, 1, 1, 1);
    resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r); resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r);
    resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r); expect(r.focusReady).toBe(true);
    expect(resolveFearBishopCombatAbility(s, MISFORTUNE, 1, rng, r).enemyReduction).toBe(22); expect(r.focusReady).toBe(true);
    expect(resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r).enemyReduction).toBe(0);
    expect(resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r).enemyReduction).toBe(32);
    resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r); const o = finishFearBishopCombatRound(s, r);
    expect(o.focusReadyAfter).toBe(false); expect(r.focusReady).toBe(false); expect(o.powerUses.FOCUS).toBe(3); expect(validateFearBishopRoundOutcome(o)).toBe(true);
  });
  it('deploys the actual old SEALED Leaf for2S/0, assists only on a later paid slot, then really recalls it', () => {
    const s = fixture(), spirit = s.spiritWarlock.companion, before = structuredClone(spirit), oldNight = structuredClone(s.nightwatcher), oldSpirit = structuredClone(s.spiritWarlock);
    const r = begin(s), rng = random(); expect(spirit).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', deployments: 10, recalls: 10 });
    expect(resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(s.spiritWarlock.companion).toBe(spirit); expect(spirit.status).toBe('DEPLOYED'); expect(spirit.deployments).toBe(11); expect(spirit.recalls).toBe(10);
    expect(resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r).enemyReduction).toBe(22); expect(s.spirituality).toBe(116); expect(rng.cursor).toBe(0);
    const o = finishFearBishopCombatRound(s, r); expect(o.recalled).toBe(true); expect(spirit).toEqual({ ...before, deployments: 11, recalls: 11 });
    expect(s.nightwatcher).toEqual(oldNight); expect(s.spiritWarlock).toEqual({ ...oldSpirit, companion: { ...before, deployments: 11, recalls: 11 } });
    expect(s.nightwatcher.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0, weaponLocation: 'YARD' });
    expect(validateFearBishopRoundOutcome(o)).toBe(true);
  });
  it('does not revive RELEASED/unacquired spirits, reset releases, reinvite, or create a replacement', () => {
    for (const status of ['RELEASED', 'UNMET', 'AVAILABLE'] as const) {
      const s = fixture(); s.spiritWarlock.companion.status = status;
      if (status === 'RELEASED') { s.spiritWarlock.companion.releases++; s.spiritWarlock.companion.invitedWeek = null; }
      if (status === 'UNMET') { s.spiritWarlock.companion.acquiredWeek = null; s.spiritWarlock.companion.invitedWeek = null; }
      const before = structuredClone(s.spiritWarlock), r = begin(s), rng = random();
      expect(resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r).enemyReduction).toBe(10);
      expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0); const o = finishFearBishopCombatRound(s, r);
      expect(o.recalled).toBe(false); expect(s.spiritWarlock).toEqual(before); expect(validateFearBishopRoundOutcome(o)).toBe(true);
    }
  });
  it('lacking original acquisition provenance uses ordinary fallback instead of fake deployment', () => {
    const s = fixture(); s.spiritWarlock.companion.acquiredWeek = null; const r = begin(s), rng = random();
    expect(resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r).enemyReduction).toBe(10);
    expect(r.playerActions[0]!.spiritOperation).toBe('NONE'); expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0);
    expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
  });
  it('low spirituality uses the actual body/held club or ordinary evade without a hidden draw', () => {
    const s = fixture(); s.spirituality = 1; s.town.clubLocation = 'HAND'; const r = begin(s), rng = random();
    expect(resolveFearBishopCombatAbility(s, DISSOLUTION, .5, rng, r).selfGain).toBe(8);
    for (const id of [SLEEP_FEAR, MISFORTUNE, ASSISTANCE] as const) expect(resolveFearBishopCombatAbility(s, id, 1, rng, r).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(1); expect(rng.cursor).toBe(0); expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
  });
  it('the independent enemy pool pays5/4/4 and depleted spells use only its own original club', () => {
    const s = fixture(), r = begin(s), rng = random();
    expect(resolveFearBishopEnemyAbility(s, 'DARK_BOLT', 1, rng, r).selfGain).toBe(75);
    expect(resolveFearBishopEnemyAbility(s, 'WARD', 1, rng, r).enemyReduction).toBe(45);
    resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r);
    expect(s.fearBishop.encounter).toMatchObject({ enemySpirituality: 107, powerUses: { DARK_BOLT: 1, WARD: 1, FOCUS: 1 } }); expect(s.spirituality).toBe(120);
    expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(s, r))).toBe(true);
    const low = fixture(); Object.assign(low.fearBishop.encounter, { enemySpirituality: 3, powerUses: { DARK_BOLT: 9, WARD: 18, FOCUS: 0 } });
    const lr = begin(low); expect(resolveFearBishopEnemyAbility(low, 'DARK_BOLT', .5, rng, lr).selfGain).toBe(10);
    expect(resolveFearBishopEnemyAbility(low, 'FOCUS', 1, rng, lr).selfGain).toBe(20); expect(lr.focusReady).toBe(false);
    expect(low.fearBishop.encounter.enemySpirituality).toBe(3); expect(validateFearBishopRoundOutcome(finishFearBishopCombatRound(low, lr))).toBe(true);
  });
  it('rejects missing, stale, substituted source or externally edited original resources without cost or draw', () => {
    const s = fixture(), r = begin(s), source = currentFearBishopCombatSource(s)!, rng = random();
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'NW4-BRAM' }, { ...source, companion: { ...source.companion, source: 'NEW-LEAF' } }]) {
      const before = structuredClone(s); expect(resolveFearBishopCombatAbility(s, DISSOLUTION, 1, rng, r, bad as FearBishopCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    s.spiritWarlock.companion.releases++; const before = structuredClone(s);
    expect(resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0);
    expect(() => finishFearBishopCombatRound(s, r)).toThrow();
  });
  it('ends pressure and recalls the actual deployed spirit even when the shared wheel kills the player', () => {
    const s = fixture(), r = begin(s), rng = random(); resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r);
    resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r); s.health = 0; const o = finishFearBishopCombatRound(s, r, false);
    expect(s.health).toBe(0); expect(s.spirituality).toBe(118); expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 11, recalls: 11 });
    expect(o.recalled).toBe(true); expect(o.focusReadyAfter).toBe(false); expect(validateFearBishopRoundOutcome(o)).toBe(true);
  });
  it('finished rounds cannot be reused, snapshots cannot rewrite the spirit, and no seventh action is available', () => {
    const s = fixture(), r = begin(s), rng = random(); for (let i = 0; i < 6; i++) resolveFearBishopCombatAbility(s, 'OBSERVE', 1, rng, r);
    expect(resolveFearBishopCombatAbility(s, DISSOLUTION, 1, rng, r).selfGain).toBe(0); expect(r.playerActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishFearBishopCombatRound(s, r); expect(s.fearBishop.life.clockSeconds).toBe(60); expect(() => finishFearBishopCombatRound(s, r)).toThrow();
    expect(resolveFearBishopCombatAbility(s, DISSOLUTION, 1, rng, r).selfGain).toBe(0); o.companionAfter.releases++;
    expect(fearBishopRoundOutcome(r).companionAfter.releases).toBe(s.spiritWarlock.companion.releases); expect(validateFearBishopRoundOutcome(o)).toBe(false);
  });
  it('validates exact costs, resistance order and real deployment/recall continuity', () => {
    const s = fixture(), r = begin(s), rng = random(); resolveFearBishopCombatAbility(s, ASSISTANCE, 1, rng, r);
    resolveFearBishopEnemyAbility(s, 'FOCUS', 1, rng, r); resolveFearBishopCombatAbility(s, SLEEP_FEAR, 1, rng, r);
    const o = finishFearBishopCombatRound(s, r); expect(validateFearBishopRoundOutcome(o)).toBe(true);
    for (const mutate of [(v: typeof o) => { v.playerSpiritualityAfter++; }, (v: typeof o) => { v.companionAfter.recalls--; },
      (v: typeof o) => { v.playerActions[0]!.paidCost = 0; }, (v: typeof o) => { v.playerActions[1]!.resisted = false; },
      (v: typeof o) => { v.playerActions[1]!.enemyReduction = 32; }, (v: typeof o) => { v.enemyActions[0]!.paidCost = 0; },
      (v: typeof o) => { v.source.companion.releases++; }, (v: typeof o) => { v.enemyMind--; }]) {
      const bad = structuredClone(o); mutate(bad); expect(validateFearBishopRoundOutcome(bad)).toBe(false);
    }
    expect(resolveFearBishopCombatAbility(s, 'darkness.s2.concealment' as FearBishopMoveId, 1, rng, r).selfGain).toBe(0);
  });
  it('keeps the independent enemy and combat summary hidden before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; const view = projectFearBishopCombat(s);
    expect(view).not.toHaveProperty('source'); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/HARLAN|哈兰|FB3-HARLAN-CLUB/);
  });
});
