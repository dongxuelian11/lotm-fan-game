import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createInsightScholarState } from '../../src/domain/insight-scholar/index.js';
import { applyInsightScholarEncounterCommand } from '../../src/domain/insight-scholar/encounter.js';
import {
  INSIGHT_SCHOLAR_COUNT_WHEEL, INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL, INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL,
  insightScholarActionCount, insightScholarEnemyActionCount, insightScholarAbilityWheel,
  drawInsightScholarAbility, drawInsightScholarEnemyAbility, beginInsightScholarCombatRound,
  currentInsightScholarCombatSource, resolveInsightScholarCombatAbility, resolveInsightScholarEnemyAbility,
  finishInsightScholarCombatRound, insightScholarRoundOutcome, validateInsightScholarRoundOutcome, projectInsightScholarCombat,
  type InsightScholarCombatSource, type InsightScholarMoveId,
} from '../../src/domain/insight-scholar/combat.js';

const ANALYSIS = 'reader.s3.method-analysis', FORESIGHT = 'reader.s4.fragmentary-foresight';
const FLASH = 'reader.s6.limited-imitation', MATERIAL = 'reader.s5.material-imitation';
const context: SeerContext = { roll: min => min, note: () => {}, check: () => { throw new Error('No automatic scene check'); } };
function random(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'insight-scholar-unit', get cursor() { return cursor; }, nextInt(min, max) {
    const n = values[cursor++] ?? 1; expect(n).toBeGreaterThanOrEqual(min); expect(n).toBeLessThanOrEqual(max); return n;
  } };
}
/** Directed S3 fixture retains the real S4 Harold surrender and actual old FLASH/craft provenance. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8')).final);
  s.insightScholar = createInsightScholarState(); s.insightScholar.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.health = 100; s.mind = 100; s.spirituality = 120; s.activeEvent = null; s.combat = null;
  applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); return s;
}
const begin = (s: SliceState) => beginInsightScholarCombatRound(s, 'ATTACK', random());
const player = (s: SliceState, r: ReturnType<typeof begin>, id: InsightScholarMoveId, rng = random()) => resolveInsightScholarCombatAbility(s, id, 1, rng, r);
const enemy = (s: SliceState, r: ReturnType<typeof begin>, id: Parameters<typeof resolveInsightScholarEnemyAbility>[1]) => resolveInsightScholarEnemyAbility(s, id, 1, random(), r);

describe('Insight Scholar candidate G finite combat with actual witnessed methods and inherited originals', () => {
  it('uses exact1–6 counts, six player slots and five enemy categories summing100', () => {
    expect(INSIGHT_SCHOLAR_COUNT_WHEEL.map(v => v.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL).toEqual(INSIGHT_SCHOLAR_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(insightScholarActionCount(roll!)).toBe(count); expect(insightScholarEnemyActionCount(roll!)).toBe(count);
    }
    const wheel = insightScholarAbilityWheel(fixture(), null);
    expect(wheel.map(v => v.id)).toEqual(['STRIKE', ANALYSIS, FORESIGHT, FLASH, MATERIAL, 'ACCIDENT']);
    expect(wheel.map(v => v.weight)).toEqual([25, 25, 15, 20, 10, 5]);
    expect(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL.map(v => v.id)).toEqual(['FLASH', 'WARD', 'BODY_STRIKE', 'FOCUS', 'ACCIDENT']);
    expect(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL.map(v => v.weight)).toEqual([35, 25, 20, 15, 5]);
  });
  it('draws the published boundaries exactly once for each actual player or enemy slot', () => {
    const s = fixture(); let boundary = 0;
    for (const a of insightScholarAbilityWheel(s, null)) { const first = boundary + 1; boundary += a.weight * 4; const rng = random(first, boundary);
      expect(drawInsightScholarAbility(rng, s, null)).toBe(a.id); expect(drawInsightScholarAbility(rng, s, null)).toBe(a.id); expect(rng.cursor).toBe(2); }
    boundary = 0;
    for (const a of INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL) { const first = boundary + 1; boundary += a.weight; const rng = random(first, boundary);
      expect(drawInsightScholarEnemyAbility(rng)).toBe(a.id); expect(drawInsightScholarEnemyAbility(rng)).toBe(a.id); expect(rng.cursor).toBe(2); }
  });
  it('unseen methods fall back to explicit ordinary10/0S without peeking at a later enemy draw', () => {
    const s = fixture(), r = begin(s), rng = random(36), oldSamples = structuredClone(s.polymath.samples);
    const effect = player(s, r, ANALYSIS, rng);
    expect(effect).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false }); expect(effect.label).toContain('尚未亲见');
    expect(r.playerActions[0]).toMatchObject({ observedPower: null, paidCost: 0, rolls: [] });
    expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0); expect(s.insightScholar.encounter.seenPowers).toEqual([]);
    expect(drawInsightScholarEnemyAbility(rng)).toBe('WARD'); expect(s.insightScholar.encounter.seenPowers).toEqual([]);
    enemy(s, r, 'WARD'); expect(s.insightScholar.encounter.seenPowers).toEqual(['WARD']);
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(35); expect(s.spirituality).toBe(115);
    expect(r.playerActions[1]).toMatchObject({ observedPower: 'WARD', paidCost: 5, rolls: [1] });
    expect(s.polymath.samples).toEqual(oldSamples); expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('FOCUS and ordinary body actions are not observed FLASH/WARD methods', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); enemy(s, r, 'BODY_STRIKE');
    expect(s.insightScholar.encounter.seenPowers).toEqual([]); expect(player(s, r, ANALYSIS).enemyReduction).toBe(10);
    expect(r.focusReady).toBe(true); expect(s.spirituality).toBe(120);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('paid real FLASH is observed but is never added to the old sample library', () => {
    const s = fixture(), r = begin(s), samples = structuredClone(s.polymath.samples), mastery = structuredClone(s.progression.mastery);
    expect(enemy(s, r, 'FLASH').selfGain).toBe(75); expect(s.insightScholar.encounter.seenPowers).toEqual(['FLASH']);
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(35); expect(s.insightScholar.encounter.enemySpirituality).toBe(115);
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(s.polymath.samples).toEqual(samples); expect(s.progression.mastery).toEqual(mastery); expect(s.health).toBe(100); expect(s.mind).toBe(100);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('method failure keeps5S and has zero effect; lowS after witnessing has ordinary10 without a draw', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'WARD'); const fail = random(100);
    expect(player(s, r, ANALYSIS, fail).enemyReduction).toBe(0); expect(s.spirituality).toBe(115); expect(fail.cursor).toBe(1);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
    const low = fixture(); low.spirituality = 4; const lr = begin(low); enemy(low, lr, 'WARD'); const rng = random();
    expect(player(low, lr, ANALYSIS, rng).enemyReduction).toBe(10); expect(low.spirituality).toBe(4); expect(rng.cursor).toBe(0);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(low, lr))).toBe(true);
  });
  it('FOCUS resists only the next successful pressure, not unseen fallback, failed checks or foresight', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); enemy(s, r, 'FOCUS');
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(10); expect(r.focusReady).toBe(true);
    enemy(s, r, 'WARD'); expect(player(s, r, ANALYSIS, random(100)).enemyReduction).toBe(0); expect(r.focusReady).toBe(true);
    expect(player(s, r, FORESIGHT).enemyReduction).toBe(22); expect(r.focusReady).toBe(true);
    expect(player(s, r, FLASH).enemyReduction).toBe(0); expect(r.playerActions[3]!.resisted).toBe(true); expect(r.focusReady).toBe(false);
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(35); expect(r.playerActions[4]!.resisted).toBe(false);
    expect(s.spirituality).toBe(104); expect(s.combat!.enemyMind).toBe(100);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('successful method pressure spends one FOCUS without refunds or extra direct damage', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'WARD'); enemy(s, r, 'FOCUS');
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(0); expect(r.playerActions[0]!.resisted).toBe(true);
    expect(player(s, r, ANALYSIS).enemyReduction).toBe(35); expect(s.spirituality).toBe(110);
    expect(s.insightScholar.encounter.enemySpirituality).toBe(112); expect(s.combat!.enemyHealth).toBe(100);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('S6 FLASH keeps real learned samples,2S/knowledge14 and12×old mastery rather than free22', () => {
    for (const mastery of [0, 250, 500]) { const s = fixture(); s.progression.mastery[FLASH] = mastery; const r = begin(s), samples = structuredClone(s.polymath.samples);
      expect(player(s, r, FLASH).enemyReduction).toBe(12 * (.65 + .35 * mastery / 500)); expect(s.spirituality).toBe(118);
      expect(player(s, r, FLASH, random(100)).enemyReduction).toBe(0); expect(s.spirituality).toBe(116);
      expect(s.polymath.samples).toEqual(samples); expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true); }
  });
  it('missing real learned FLASH or insufficient spirituality has no ability, draw, free replacement or cost', () => {
    for (const absent of ['LEARNED', 'OBSERVED', 'LOW_SP'] as const) {
      const s = fixture(); if (absent === 'LEARNED') s.polymath.samples.FLASH.learnedWeek = null;
      else if (absent === 'OBSERVED') s.polymath.samples.FLASH.observedWeek = null; else s.spirituality = 1;
      const before = structuredClone(s.polymath), resource = s.spirituality, r = begin(s), rng = random();
      expect(player(s, r, FLASH, rng).enemyReduction).toBe(0); expect(s.spirituality).toBe(resource); expect(rng.cursor).toBe(0);
      expect(s.polymath).toEqual(before); expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
    }
  });
  it('R spends only real MM5-FLASH-3 from original KIT-3 at manufacture power while old1 remains consumed', () => {
    const s = fixture(), old = structuredClone(s.mysticismMagister), prophet = structuredClone(s.prophet), r = begin(s), rng = random();
    const craft = s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')!; expect(craft).toMatchObject({ status: 'PLAYER', sourceKitId: 'MM5-KIT-3', power: .65 });
    expect(player(s, r, MATERIAL, rng).enemyReduction).toBe(18 * .65); expect(craft).toMatchObject({ status: 'CONSUMED', usedWeek: s.week });
    expect(player(s, r, MATERIAL, rng).enemyReduction).toBe(0); expect(s.spirituality).toBe(120); expect(rng.cursor).toBe(0);
    expect(s.mysticismMagister).toEqual({ ...old, crafts: old.crafts.map(c => c.id === craft.id ? { ...c, status: 'CONSUMED', usedWeek: s.week } : c) });
    expect(s.prophet).toEqual(prophet); expect(s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-1')!.status).toBe('CONSUMED');
    const o = finishInsightScholarCombatRound(s, r); expect(o.consumedCraftIds).toEqual(['MM5-FLASH-3']); expect(validateInsightScholarRoundOutcome(o)).toBe(true);
  });
  it('a resisted original flash fragment remains consumed and no second pressure is generated', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); expect(player(s, r, MATERIAL).enemyReduction).toBe(0);
    expect(r.playerActions[0]).toMatchObject({ resisted: true, consumedCraftId: 'MM5-FLASH-3', paidCost: 0 });
    expect(r.focusReady).toBe(false); expect(s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')!.status).toBe('CONSUMED');
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('invalid source kit, duplicate original or already consumed craft cannot create inventory', () => {
    for (const mode of ['KIT', 'DUPLICATE', 'CONSUMED'] as const) { const s = fixture(), craft = s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')!;
      if (mode === 'KIT') craft.sourceKitId = 'FAKE-KIT'; if (mode === 'DUPLICATE') s.mysticismMagister.crafts.push({ ...craft });
      if (mode === 'CONSUMED') { craft.status = 'CONSUMED'; craft.usedWeek = s.week; }
      const before = structuredClone(s.mysticismMagister), r = begin(s), rng = random();
      expect(player(s, r, MATERIAL, rng).enemyReduction).toBe(0); expect(s.mysticismMagister).toEqual(before); expect(rng.cursor).toBe(0);
    }
  });
  it('foresight4/22 remains a fallible fragment with no hidden future draws or mind changes', () => {
    const s = fixture(), r = begin(s), rng = random(1, 100), sourceRandom = structuredClone(s.random);
    expect(player(s, r, FORESIGHT, rng).enemyReduction).toBe(22); expect(player(s, r, FORESIGHT, rng).enemyReduction).toBe(0);
    expect(rng.cursor).toBe(2); expect(s.spirituality).toBe(112); expect(s.random).toEqual(sourceRandom); expect(s.combat!.enemyMind).toBe(100);
    expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('depleted planned spells fall back to original club and do not pretend to have been witnessed', () => {
    const s = fixture(); Object.assign(s.insightScholar.encounter, { enemySpirituality: 0, powerUses: { FLASH: 0, WARD: 0, FOCUS: 30 }, seenPowers: [] });
    const r = begin(s), rng = random(); expect(resolveInsightScholarEnemyAbility(s, 'FLASH', .5, rng, r).selfGain).toBe(10);
    expect(enemy(s, r, 'WARD').selfGain).toBe(20); expect(enemy(s, r, 'FOCUS').selfGain).toBe(20);
    expect(r.enemyActions.every(a => a.actual === 'BODY_STRIKE' && a.paidCost === 0)).toBe(true);
    expect(s.insightScholar.encounter.seenPowers).toEqual([]); expect(player(s, r, ANALYSIS, rng).enemyReduction).toBe(10); expect(rng.cursor).toBe(0);
    expect(s.spirituality).toBe(120); expect(r.focusReady).toBe(false); expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true);
  });
  it('ordinary body, actual held club and accident affect only the existing advantage totals', () => {
    for (const held of [false, true]) { const s = fixture(); s.town.clubLocation = held ? 'HAND' : 'SHOP'; const r = begin(s), rng = random();
      expect(resolveInsightScholarCombatAbility(s, 'STRIKE', .5, rng, r).selfGain).toBe(held ? 8 : 6);
      expect(player(s, r, 'ACCIDENT').selfGain).toBe(-22.5); expect(player(s, r, 'EVADE').enemyReduction).toBe(10);
      expect(s.spirituality).toBe(120); expect(s.combat!.enemyHealth).toBe(100); expect(validateInsightScholarRoundOutcome(finishInsightScholarCombatRound(s, r))).toBe(true); }
  });
  it('stale or substituted sources and external inventory edits cannot spend resources', () => {
    const s = fixture(), r = begin(s), source = currentInsightScholarCombatSource(s)!, rng = random();
    for (const bad of [null, { ...source, round: 99 }, { ...source, targetId: 'PF4-HAROLD' }, { ...source, enemyWeapon: 'FAKE-CLUB' }]) {
      const before = structuredClone(s); expect(resolveInsightScholarCombatAbility(s, MATERIAL, 1, rng, r, bad as InsightScholarCombatSource | null).enemyReduction).toBe(0); expect(s).toEqual(before);
    }
    s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')!.power = 1; const before = structuredClone(s);
    expect(player(s, r, MATERIAL, rng).enemyReduction).toBe(0); expect(s).toEqual(before); expect(rng.cursor).toBe(0); expect(() => finishInsightScholarCombatRound(s, r)).toThrow();
  });
  it('finishing clears unused FOCUS, records60seconds and never heals, refills or resurrects', () => {
    const s = fixture(), r = begin(s); enemy(s, r, 'FOCUS'); player(s, r, FLASH, random(100)); s.health = 0;
    const o = finishInsightScholarCombatRound(s, r, false); expect(s.health).toBe(0); expect(s.spirituality).toBe(118); expect(s.insightScholar.encounter.enemySpirituality).toBe(116);
    expect(o.focusReadyAfter).toBe(false); expect(r.focusReady).toBe(false); expect(s.insightScholar.life.clockSeconds).toBe(60);
    expect(validateInsightScholarRoundOutcome(o)).toBe(true); expect(() => finishInsightScholarCombatRound(s, r)).toThrow();
  });
  it('caps both sides at six slots and keeps completed snapshots detached', () => {
    const s = fixture(), r = begin(s), rng = random(); for (let i = 0; i < 6; i++) { player(s, r, 'OBSERVE', rng); enemy(s, r, 'ACCIDENT'); }
    expect(player(s, r, FLASH, rng).enemyReduction).toBe(0); expect(enemy(s, r, 'FLASH').selfGain).toBe(0);
    expect(r.playerActions).toHaveLength(6); expect(r.enemyActions).toHaveLength(6); expect(rng.cursor).toBe(0);
    const o = finishInsightScholarCombatRound(s, r); o.craftsAfter[0]!.status = 'PLAYER';
    expect(insightScholarRoundOutcome(r).craftsAfter[0]!.status).toBe('CONSUMED'); expect(validateInsightScholarRoundOutcome(o)).toBe(false);
  });
  it('replays actual order so future observations, unpaid spell claims and altered costs are rejected', () => {
    const s = fixture(), r = begin(s); player(s, r, ANALYSIS); enemy(s, r, 'WARD'); enemy(s, r, 'FOCUS'); player(s, r, ANALYSIS); player(s, r, MATERIAL);
    const o = finishInsightScholarCombatRound(s, r); expect(validateInsightScholarRoundOutcome(o)).toBe(true);
    for (const mutate of [(v: typeof o) => { v.playerSpiritualityAfter++; }, (v: typeof o) => { v.playerActions[0]!.observedPower = 'WARD'; },
      (v: typeof o) => { v.playerActions[1]!.paidCost = 0; }, (v: typeof o) => { v.playerActions[1]!.resisted = false; },
      (v: typeof o) => { v.enemyActions[0]!.paidCost = 0; }, (v: typeof o) => { v.seenPowers.push('FLASH'); },
      (v: typeof o) => { v.consumedCraftIds = []; }, (v: typeof o) => { v.enemyMind--; }]) {
      const bad = structuredClone(o); mutate(bad); expect(validateInsightScholarRoundOutcome(bad)).toBe(false);
    }
  });
  it('hides new opponent and unreached candidate combat before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; const view = projectInsightScholarCombat(s);
    expect(view.source).toBeNull(); expect(view.targetId).toBeNull(); expect(view.enemySpirituality).toBeNull(); expect(view.seenPowers).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/ALTON|阿尔顿/);
  });
});
