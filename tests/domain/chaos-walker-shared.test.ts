import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { playerText } from '../../src/shared/player-text.js';
import { CHAOS_WALKER_FORMULA_STATUS, CHAOS_WALKER_SOURCE_STATUS } from '../../src/domain/chaos-walker/content.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createChaosWalkerState, hasChaosWalkerLock, validateChaosWalkerLuckHistory } from '../../src/domain/chaos-walker/index.js';
import { CHAOS_WALKER_ABILITY_IDS } from '../../src/domain/chaos-walker/types.js';
import { createChaosWalkerLifeState, CHAOS_WALKER_CASE_IDS } from '../../src/domain/chaos-walker/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  prepared: SliceState; promoted: SliceState; practiced: SliceState; combatStart: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/misfortune-mage-v01350/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/natural.json', 'utf8'));
  for (const key of ['prepared', 'promoted', 'practiced', 'combatStart', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/boundaries.json', 'utf8'));
const immutableRoots = ['monster', 'machine', 'lucky', 'calamityPriest', 'misfortuneMage'] as const;
function expectOriginals(s: SliceState, before: SliceState, preserveLuck = false) {
  for (const root of immutableRoots) expect(s[root]).toEqual(before[root]);
  const { luck, ...winner } = s.winner, { luck: oldLuck, ...oldWinner } = before.winner;
  expect(winner).toEqual(oldWinner); if (preserveLuck) expect(luck).toEqual(oldLuck);
  expect(luck.stored).toBe(luck.accumulated - luck.spent); expect(luck.stored).toBeGreaterThanOrEqual(0); expect(luck.stored).toBeLessThanOrEqual(3);
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.misfortuneMage.encounter).toMatchObject({ targetId: 'MM4-FERRIS-LORNE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 16 });
  expect(s.misfortuneMage.encounter.enemyInjuries.map(i => i.severity)).toEqual(['HEAVY']);
  expect(s.misfortuneMage.life.bag).toMatchObject({ id: 'MM4-BAG-1', owner: 'SELLA', effectActive: false });
}

describe('Candidate ChaosWalker public continuation with the sole original luck reserve', () => {
  it('replays all333 original commands and every new public command with the original seed and untouched prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(333); expect(c.prefixCount).toBe(333);
    expect(c.commands.length).toBeGreaterThan(333); expect(c.commands.slice(0, 333)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('monster-natural-v060'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 332) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates W87 without changing original resources, six roots or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION); expect(s.chaosWalker).toEqual(createChaosWalkerState());
    expect(s).toMatchObject({ week: 87, status: 'ACTIVE', health: 70, mind: 100, spirituality: 113, cash: 360, actionsRemaining: 1, progression: { sequence: 4, acting: 100 }, random: { seed: 'monster-natural-v060', cursor: 153 } });
    expect(s.winner.luck).toEqual({ stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 87 });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old, true); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every original and old mastery at actual promotion, adding only two zero masteries and no luck', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old, true);
    expect(s.progression).toMatchObject({ pathwayId: 'wheel', sequence: 3, acting: 0 }); expect(s.chaosWalker.misfortuneMageActingAtPromotion).toBe(100);
    expect(s.chaosWalker.promotionWeek! - s.misfortuneMage.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...CHAOS_WALKER_ABILITY_IDS]);
    for (const id of CHAOS_WALKER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.chaosWalker.life).toEqual(createChaosWalkerLifeState()); expect(Object.hasOwn(s.chaosWalker, 'luck')).toBe(false);
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.misfortuneMage.acting).toBe(100); expect(view.winner.acting).toBe(100);
    expect(view.chaosWalker).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    expect(view.chaosWalker.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    for (const text of ['MM4-FERRIS-LORNE', 'SURRENDERED', '原伤势1处', '唯一幸运账本']) expect(view.chaosWalker.inheritedHistory.join(' ')).toContain(text);
    const authoredStory = `${CHAOS_WALKER_FORMULA_STATUS}${CHAOS_WALKER_SOURCE_STATUS}`;
    for (const text of ['候选G映射', 'L215038', '序列2先知']) expect(authoredStory).toContain(text);
    expect(view.chaosWalker.story).toBe(playerText(authoredStory));
    for (const text of ['候选G映射', 'L215038']) expect(view.chaosWalker.story).not.toContain(text);
    for (const text of ['完整配方尚未掌握', '服用前需要专业准备', '不开放自制魔药', '后续为先知2、水银之蛇1', '唯一winner.luck账本容量3', '失败照付，晋升不重置或补满', '没有第二池', '重抽、重启、改写过去、必定成功']) expect(view.chaosWalker.story).toContain(text);
    const b = Object.values(boundaries()).find(b => b.lastIntent.type === 'CHAOS_WALKER' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3)!;
    expect(b).toBeTruthy(); expect(s.spirituality).toBe(b.beforeLast.spirituality); expect(s.health).toBe(b.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, b.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically with unchanged input, intent and original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('finishes three honest reports without assuming that all paid checks or modified events succeed', () => {
    const s = capture().practiced, life = s.chaosWalker.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'wheel', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...CHAOS_WALKER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasChaosWalkerLock(s)).toBe(false);
    expect(projectSliceState(s).chaosWalker.digestion).toContain('和平100不保证安全消化');
    expect(s.winner.luck.accumulated).toBeGreaterThanOrEqual(7); expect(s.winner.luck.spent).toBeGreaterThanOrEqual(6);
    expect(Object.hasOwn(life, 'luck')).toBe(false); expect(Object.hasOwn(s.chaosWalker, 'luck')).toBe(false);
  });
  it('rejects minted reserve totals and disconnected cross-scene receipts without touching the real save', () => {
    const originalState = capture().practiced, before = JSON.stringify(originalState);
    expect(validateChaosWalkerLuckHistory(originalState)).toBe(true);
    const minted = structuredClone(originalState); minted.winner.luck.accumulated++; minted.winner.luck.spent++;
    expect(validateChaosWalkerLuckHistory(minted)).toBe(false);
    const attempts = Object.values(originalState.chaosWalker.life.cases).flatMap(c => c.attempts);
    expect(attempts).toHaveLength(3);
    for (const [caseId, scene] of Object.entries(originalState.chaosWalker.life.cases)) {
      const a = scene.attempts[0]!; if (!a.luckBefore) continue;
      const forged = structuredClone(originalState), target = forged.chaosWalker.life.cases[caseId as keyof typeof forged.chaosWalker.life.cases].attempts[0]!;
      target.luckBefore!.accumulated++; target.luckBefore!.spent++;
      expect(validateChaosWalkerLuckHistory(forged)).toBe(false);
    }
    expect(JSON.stringify(originalState)).toBe(before);
  });
  it('records each real bottle outcome after a separate same-week140 preparation', () => {
    const s = capture().promoted;
    expect(s.chaosWalker.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const b of s.chaosWalker.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(b.preparationWeek).toBe(b.consumedWeek); expect(b.acquiredWeek).not.toBeNull(); expect(b.id).toMatch(/^chaos-walker-potion-/);
      expect(b.consumedWeek).toBeGreaterThanOrEqual(s.misfortuneMage.promotionWeek! + 12); expect(b.consumedWeek).toBeLessThanOrEqual(s.chaosWalker.promotionWeek!);
    }
    expect(s.chaosWalker.preparedWeek).toBeNull(); expect(s.chaosWalker.preparations).toHaveLength(3);
  });
  it('shows only the purchased original bottle in the ordinary bag and removes only the consumed bottle', () => {
    const all = Object.values(boundaries()), purchase = all.find(b => b.lastIntent.type === 'CHAOS_WALKER' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'CHAOS_WALKER' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'CHAOS_WALKER' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('rejects old-stage actions after promotion without reopening Ferris or rewriting old bottles', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'uncertain-weight' }] as const) expect(() => applySliceIntent(s, { type: 'MISFORTUNE_MAGE', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final, true);
  });
  it('retains optional-combat results honestly without promising a win or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.chaosWalker.encounter; expect(encounter.targetId).toBe('CW3-GARETH'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.COMPOSE * 4);
    expect(s.winner.luck.spent).toBeGreaterThanOrEqual(capture().practiced.winner.luck.spent);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'CHAOS_WALKER', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasChaosWalkerLock(s)).toBe(false); }
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

it('retains earned earlier history after a clearly directed actual public death and rejects all later commands', () => {
  const b = JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/directed-death.json', 'utf8'));
  expect(b.provenance.kind).toBe('DIRECTED_RNG_FATAL_HISTORY_REGRESSION');
  expect(b.provenance.naturalCursor).toBe(capture().combatStart.random.cursor);
  const before = migrateSliceState(b.beforeLast), after = applySliceIntent(before, b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final)); assertValidSliceState(before); assertValidSliceState(after);
  expect(after.status).toBe('DEAD'); expect(after.health).toBe(0); expect(after.combat).toBeNull();
  expect(after.calamityPriest).toEqual(before.calamityPriest); expect(after.misfortuneMage).toEqual(before.misfortuneMage);
  expect(after.chaosWalker.encounter.scene.playerPosition).toBe('COURT');
  expect(after.chaosWalker.encounter.exitTravelMetres).toBe(0);
  expect(() => applySliceIntent(after, { type: 'ACTION', action: 'WORK' })).toThrow();
  expect(() => applySliceIntent(after, { type: 'CHAOS_WALKER', command: { type: 'ACCUMULATE' } })).toThrow();
  expect(migrateSliceState(structuredClone(after))).toEqual(after);
});
