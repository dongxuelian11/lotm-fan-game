import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { playerText } from '../../src/shared/player-text.js';
import { CHAOS_HUNTER_FORMULA_STATUS, CHAOS_HUNTER_SOURCE_STATUS } from '../../src/domain/chaos-hunter/content.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createChaosHunterState, hasChaosHunterLock } from '../../src/domain/chaos-hunter/index.js';
import { CHAOS_HUNTER_ABILITY_IDS } from '../../src/domain/chaos-hunter/types.js';
import { createChaosHunterLifeState, CHAOS_HUNTER_CASE_IDS } from '../../src/domain/chaos-hunter/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  prepared: SliceState; promoted: SliceState; practiced: SliceState; combatStart: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/imperative-mage-v01370/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/chaos-hunter-v01600/natural.json', 'utf8'));
  for (const key of ['prepared', 'promoted', 'practiced', 'combatStart', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/chaos-hunter-v01600/boundaries.json', 'utf8'));
const immutableRoots = ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage'] as const;
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of immutableRoots) expect(s[root]).toEqual(before[root]);
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.imperativeMage.encounter).toMatchObject({ targetId: 'IM4-ROWAN-KELL', enemyStatus: 'SURRENDERED', enemyHealth: 30, enemyMind: 100, enemySpirituality: 0, enemyRisk: 4, powerUses: { ARC_BOLT: 5, WARD: 3, COMPOSE: 2 } });
  expect(s.imperativeMage.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT', 'LIGHT', 'LIGHT', 'HEAVY']);
  expect(s.imperativeMage.life.partner).toMatchObject({ id: 'IM4-ELDEN-VALE', spirituality: 8, maxSpirituality: 12, abilityAvailable: true, consented: false });
  expect(s.imperativeMage.life.light).toMatchObject({ cardId: 'IM4-CARD-1', hoodId: 'IM4-HOOD-1', holder: 'GUIDE', positionMetres: 0, remainingSeconds: 0 });
  expect(s.imperativeMage.life.line).toMatchObject({ id: 'IM4-LINE-1', tokenId: 'IM4-TOKEN-1', holder: 'GUIDE', tokenHolder: 'GUIDE', rule: 'NONE' });
}

describe('ChaosHunter public continuation with the same originals and no new inventory', () => {
  it('replays all352 original commands and every new public command from the unchanged original seed', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(352); expect(c.prefixCount).toBe(352);
    expect(c.commands.length).toBeGreaterThan(352); expect(c.commands.slice(0, 352)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('arbiter-natural-v066'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 351) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates W89 without changing original resources, six roots, original Rowan history or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(176); expect(s.contentVersion).toBe('elder-v176'); expect(s.chaosHunter).toEqual(createChaosHunterState());
    expect(s).toMatchObject({ week: 89, status: 'ACTIVE', health: 50, mind: 100, spirituality: 117, cash: 400, actionsRemaining: 2, progression: { sequence: 4, acting: 100 }, random: { seed: 'arbiter-natural-v066', cursor: 269 } });
    expect(s.character.coreStats).toEqual({ physique: 28, perception: 23, will: 23, knowledge: 19 }); expect(s.imperativeMage.promotionWeek).toBe(82);
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every original and old mastery at promotion, adding only one zero mastery and no gift', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression).toMatchObject({ pathwayId: 'justiciar', sequence: 3, acting: 0 }); expect(s.chaosHunter.imperativeMageActingAtPromotion).toBe(100);
    expect(s.chaosHunter.promotionWeek! - s.imperativeMage.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...CHAOS_HUNTER_ABILITY_IDS]);
    expect(s.progression.mastery['justiciar.s3.bounded-order']).toBe(0);
    expect(s.chaosHunter.life).toEqual(createChaosHunterLifeState()); expect(Object.hasOwn(s.chaosHunter, 'gifts')).toBe(false); expect(Object.hasOwn(s.chaosHunter, 'luck')).toBe(false);
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.imperativeMage.acting).toBe(100); expect(view.punishmentKnight.acting).toBe(100);
    expect(view.chaosHunter).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    expect(view.chaosHunter.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    for (const text of ['IM4-ROWAN-KELL', 'SURRENDERED', '原伤势5处', '轻伤4', '重伤1', 'IM4-ELDEN-VALE', '原灵性8/12']) expect(view.chaosHunter.inheritedHistory.join(' ')).toContain(text);
    const authoredStory = `${CHAOS_HUNTER_FORMULA_STATUS}${CHAOS_HUNTER_SOURCE_STATUS}`;
    // Keep the original source assertions, then verify the player copy and its mechanical limits.
    for (const text of ['L200622', 'L201014', '序列2平衡者', '尚未披露', '均为原创G']) expect(authoredStory).toContain(text);
    expect(view.chaosHunter.story).toBe(playerText(authoredStory));
    for (const text of ['L200622', 'L201014', '均为原创G']) expect(view.chaosHunter.story).not.toContain(text);
    for (const text of ['下一阶段为平衡者2', '完整主辅配方、材料用量、调配顺序与晋升仪式尚未获得', '三项专业准备和当周房间检查仍须完成', '不开放自制魔药', '20秒窗口', '双方同受约束', '不保证对任何目标生效', '不传送或复位已发生动作']) expect(view.chaosHunter.story).toContain(text);
    const b = Object.values(boundaries()).find(b => b.lastIntent.type === 'CHAOS_HUNTER' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3)!;
    expect(b).toBeTruthy(); expect(s.spirituality).toBe(b.beforeLast.spirituality); expect(s.health).toBe(b.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, b.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically without mutating input or prior history', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('finishes three honest reports without assuming that paid checks all succeed', () => {
    const s = capture().practiced, life = s.chaosHunter.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'justiciar', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...CHAOS_HUNTER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasChaosHunterLock(s)).toBe(false);
    expect(projectSliceState(s).chaosHunter.digestion).toContain('和平100不保证安全消化');
    expect(Object.hasOwn(life, 'luck')).toBe(false); expect(Object.hasOwn(s.chaosHunter, 'gifts')).toBe(false);
    expect(s.progression.mastery['justiciar.s3.bounded-order']).toBeLessThanOrEqual(16);
    expect(s.progression.mastery['justiciar.s3.bounded-order']! % 8).toBe(0);
  });
  it('records each real original-bottle outcome after a separate same-week140 preparation', () => {
    const s = capture().promoted;
    expect(s.chaosHunter.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const b of s.chaosHunter.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(b.preparationWeek).toBe(b.consumedWeek); expect(b.acquiredWeek).not.toBeNull(); expect(b.id).toMatch(/^chaos-hunter-potion-/);
      expect(b.consumedWeek).toBeGreaterThanOrEqual(s.imperativeMage.promotionWeek! + 12); expect(b.consumedWeek).toBeLessThanOrEqual(s.chaosHunter.promotionWeek!);
    }
    expect(s.chaosHunter.preparedWeek).toBeNull(); expect(s.chaosHunter.preparations).toHaveLength(3);
  });
  it('shows only the purchased original bottle in the ordinary bag and removes only the consumed bottle', () => {
    const all = Object.values(boundaries()), purchase = all.find(b => b.lastIntent.type === 'CHAOS_HUNTER' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'CHAOS_HUNTER' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'CHAOS_HUNTER' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('rejects old-stage commands after promotion without refreshing Rowan, old partners or old bottles', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'PARTNER_REST' }, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'equal-line' }] as const) expect(() => applySliceIntent(s, { type: 'IMPERATIVE_MAGE', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final);
  });
  it('retains optional-combat results honestly without promising victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.chaosHunter.encounter; expect(encounter.targetId).toBe('CH3-EDRIC'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.COMPOSE * 4);
    expect(s.progression.mastery['justiciar.s3.bounded-order']).toBe(capture().practiced.progression.mastery['justiciar.s3.bounded-order']);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'CHAOS_HUNTER', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasChaosHunterLock(s)).toBe(false); }
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
