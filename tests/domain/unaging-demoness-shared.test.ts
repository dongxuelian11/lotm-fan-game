import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createUnagingDemonessState, hasUnagingDemonessLock } from '../../src/domain/unaging-demoness/index.js';
import { UNAGING_DEMONESS_ABILITY_IDS } from '../../src/domain/unaging-demoness/types.js';
import { createUnagingDemonessLifeState, UNAGING_DEMONESS_CASE_IDS } from '../../src/domain/unaging-demoness/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  promoted: SliceState; practiced: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/despair-v01300/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/unaging-demoness-v01530/natural.json', 'utf8'));
  for (const key of ['promoted', 'practiced', 'final'] as const) c[key] = migrateSliceState(c[key]); return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/unaging-demoness-v01530/boundaries.json', 'utf8'));
const roots = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair'] as const;
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of roots) {
    if (root !== 'witch') expect(s[root]).toEqual(before[root]);
    else { const { tools: actual, ...a } = s.witch, { tools: previous, ...b } = before.witch; expect(a).toEqual(b);
      expect(actual.kitsBought).toBe(previous.kitsBought); expect(actual.lastPurchaseWeek).toBe(previous.lastPurchaseWeek);
      expect(actual.powderHeld).toBeLessThanOrEqual(previous.powderHeld); expect(previous.powderHeld - actual.powderHeld).toBe(actual.powderUsed - previous.powderUsed);
      expect(actual.mirrorsHeld).toBeLessThanOrEqual(previous.mirrorsHeld); expect(previous.mirrorsHeld - actual.mirrorsHeld).toBe(actual.mirrorsUsed - previous.mirrorsUsed);
    }
  }
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 12, enemyDisease: 0, terminal: { enemyDisease: 2 } });
  expect(s.despair.encounter.enemyInjuries).toHaveLength(2); expect(s.despair.encounter.careVisits).toEqual([{ week: 97, costPence: 60, before: 2, after: 0 }]);
  expect(s.pain.encounter.enemyStatus).toBe('DEAD');
}

describe('Unaging Demoness actual public continuation from preserved Despair history', () => {
  it('replays creation, all361 original commands and every new public command without changing the seed or prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(361); expect(c.prefixCount).toBe(361);
    expect(c.commands.length).toBeGreaterThan(361); expect(c.commands.slice(0, 361)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('assassin-natural-v045'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 360) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates the entire real W97 state without refilling, healing original injuries or rewriting the next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(177); expect(s.contentVersion).toBe('blood-duke-v177'); expect(s.unagingDemoness).toEqual(createUnagingDemonessState());
    expect(s).toMatchObject({ week: 97, status: 'ACTIVE', health: 100, mind: 100, spirituality: 107, cash: 130, actionsRemaining: 1, progression: { sequence: 4, acting: 100 }, random: { seed: 'assassin-natural-v045', cursor: 149 } });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every old mastery including zero, old anatomy and originals at actual S3 promotion', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression.sequence).toBe(3); expect(s.progression.acting).toBe(0); expect(s.unagingDemoness.despairActingAtPromotion).toBe(100);
    expect(s.unagingDemoness.promotionWeek! - s.despair.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...UNAGING_DEMONESS_ABILITY_IDS]);
    expect(s.progression.mastery['assassin.s3.mirror-passage']).toBe(0); expect(s.unagingDemoness.life).toEqual(createUnagingDemonessLifeState());
    expect(s.unagingDemoness.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'UD3-CORBIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.despair.acting).toBe(100);
    expect(view.unagingDemoness.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(view.unagingDemoness).toMatchObject({ promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(view.unagingDemoness.appearanceRecord).toContain(`第${s.unagingDemoness.promotionWeek}周登记`); expect(s.character.age).toBe(26);
    const promotion = Object.values(boundaries()).find(b => b.lastIntent.type === 'UNAGING_DEMONESS' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3);
    expect(promotion).toBeTruthy(); expect(s.spirituality).toBe(promotion!.beforeLast.spirituality); expect(s.health).toBe(promotion!.beforeLast.health);
  });
  it('replays each actual saved boundary atomically with unchanged inputs and exact original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('finishes factual identity registration and two finite routes without assuming successful natural spells', () => {
    const s = capture().practiced, life = s.unagingDemoness.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'demoness', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...UNAGING_DEMONESS_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null, entry: { held: false, returnStepsRemaining: 0 }, shutter: { state: 'OPEN' } });
    expect(life.register).toMatchObject({ id: 'UD3-REGISTER', written: true, location: 'A' }); expect(life.register.oldNameRead).toBe('维瑞娜·肖'); expect(life.register.writtenDate).not.toBeNull();
    expect(life.portrait.location).toBe('OWNER'); expect(life.receipt.location).toBe('OWNER'); expect(life.testSign.location).toBe('OWNER');
    expect(life.cases['dated-record'].method).toBe('ORDINARY'); expect(life.cases['dated-record'].result).toBe('ORDINARY');
    const actualSuccesses = ['mirror-parcel', 'blocked-exit'].filter(id => life.cases[id as 'mirror-parcel' | 'blocked-exit'].result === 'ABILITY').length;
    expect(s.progression.mastery['assassin.s3.mirror-passage']).toBe(actualSuccesses * 8); expect(hasUnagingDemonessLock(s)).toBe(false);
    expect(life.playerTravelMetres).toBeGreaterThan(0); expect(life.clockSeconds).toBeGreaterThan(0); expect(life.shutter.remainingTests).toBe(0);
  });
  it('records every failed or successful potion with its actual same-week paid preparation', () => {
    const s = capture().promoted;
    expect(s.unagingDemoness.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const bottle of s.unagingDemoness.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^unaging-demoness-potion-/);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(s.despair.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(s.unagingDemoness.promotionWeek!);
    }
    expect(s.unagingDemoness.preparedWeek).toBeNull(); expect(s.unagingDemoness.preparations).toHaveLength(3);
  });
  it('lists the actual held S3 bottle in the ordinary bag and removes only the consumed original', () => {
    const all = Object.values(boundaries());
    const purchase = all.find(b => b.lastIntent.type === 'UNAGING_DEMONESS' && b.lastIntent.command.type === 'BUY_POTION')!;
    const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'UNAGING_DEMONESS' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false);
    expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'UNAGING_DEMONESS' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('prevents reopening original S4 practice or redosing old bottles after S3', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'room-clearance' }] as const) expect(() => applySliceIntent(s, { type: 'DESPAIR', command })).toThrow();
    expect(projectSliceState(s).despair.actions.every(a => !a.enabled && !!a.reason)).toBe(true); expect(JSON.stringify(s)).toBe(bytes);
  });
  it('keeps the actual independent opponent and terminal outcome without assuming victory, survival or repairing mirrors', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.unagingDemoness.encounter, rounds = s.combatHistory.filter(r => r.unagingDemonessOutcome);
    expect(encounter.targetId).toBe('UD3-CORBIN'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    if (rounds.length > 0) expect(encounter.terminal).not.toBeNull();
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'UNAGING_DEMONESS', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasUnagingDemonessLock(s)).toBe(false); }
  });
});
