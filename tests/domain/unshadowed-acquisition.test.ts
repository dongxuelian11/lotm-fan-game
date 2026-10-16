import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyUnshadowedCommand, createUnshadowedState, projectUnshadowed, validateUnshadowedState, validateUnshadowedCommand } from '../../src/domain/unshadowed/index.js';
import { UNSHADOWED_ABILITY_IDS, type UnshadowedCommand } from '../../src/domain/unshadowed/types.js';
import { UNSHADOWED_PRICES, UNSHADOWED_FORMULA, UNSHADOWED_FORMULA_SOURCE, UNSHADOWED_SOURCE_STATUS } from '../../src/domain/unshadowed/content.js';
import { currentUnshadowedVisit } from '../../src/domain/unshadowed/ritual.js';
/** Original 360-command S5 history is preserved; later time/resources below are explicit unit setup. */
function priest(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/priest-of-light-v01030/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior); s.unshadowed = createUnshadowedState();
  s.week = Math.max(s.week, s.priestOfLight.promotionWeek! + 12); s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28; return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, command: UnshadowedCommand, roll = 1) { const c = context(s, roll); applyUnshadowedCommand(s, command, c); return c; }
function taught() { const s = priest(); act(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, i = 0) { const batchId = s.unshadowed.batches[i]!.id; act(s, { type: 'BUY_MATERIALS', batchId }); act(s, { type: 'BREW', batchId }); return s.unshadowed.bottles.at(-1)!; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week++; act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true }); act(s, { type: 'SEPARATE_EMOTION', confirmed: true }); }
function ready() { const s = taught(); brew(s); enter(s); return s; }
const dose = (s: SliceState, i = 0) => ({ type: 'CONSUME', bottleId: s.unshadowed.bottles[i]!.id, confirmed: true }) as const;
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applyUnshadowedCommand(s, command as UnshadowedCommand, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
const oldPath = (s: SliceState) => [s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight];

describe('Unshadowed actual six-material acquisition and deferred emotion promotion', () => {
  it('starts hidden with three independent six-material batches, without god-blood stock', () => {
    const s = createSliceRun('ud4-hidden', sliceDefaultCreationSelection, 'ud4-hidden');
    expect(validateUnshadowedState(s)).toBe(true); expect(projectUnshadowed(s)).toMatchObject({ discovered: false, formulaKnown: false, promoted: false, formula: [], batches: [], bottles: [], actions: [], abilities: [] }); expect(projectUnshadowed(s).story).toBeUndefined();
    expect(s.unshadowed.batches.map(b => b.materials.length)).toEqual([6, 6, 6]); expect(s.unshadowed.bottles).toEqual([]);
    expect(UNSHADOWED_FORMULA.map(m => m.quantity)).toEqual([3, 1, 60, 30, 7, 10]);
    expect(UNSHADOWED_FORMULA_SOURCE).toContain('太阳神血液1滴'); expect(UNSHADOWED_FORMULA_SOURCE).toContain('第五部第88章'); expect(UNSHADOWED_FORMULA_SOURCE).toContain('本处没有神血库存'); expect(UNSHADOWED_SOURCE_STATUS).toContain('正义导师');
    expect(s.unshadowed.batches.flatMap(b => b.materials).some(m => m.name === '太阳神血液')).toBe(false);
    createUnshadowedState().batches[0]!.materials[0]!.quantity = 0; expect(s.unshadowed.batches[0]!.materials[0]!.quantity).toBe(3); reject(s, { type: 'LEARN_FORMULA' });
  });
  it('charges formula 520 and one action while preserving all old original sources and abilities', () => {
    const s = priest(), old = structuredClone(oldPath(s)), mastery = structuredClone(s.progression.mastery); act(s, { type: 'LEARN_FORMULA' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldPath(s)).toEqual(old); expect(s.progression.mastery).toEqual(mastery); expect(UNSHADOWED_PRICES).toEqual({ formula: 520, mainMaterials: 6000, auxiliaryMaterials: 600, labourCredit: 5700, brewing: 100, ritual: 320 });
    expect(projectUnshadowed(s).formula.map(m => m.quantity)).toEqual([3, 1, 60, 30, 7, 10]); expect(validateUnshadowedState(s)).toBe(true); reject(s, { type: 'LEARN_FORMULA' });
  });
  it('requires five batch-specific jobs for 5700 credit and actual delivery before one brew', () => {
    const s = taught(), batch = s.unshadowed.batches[0]!, cash = s.cash, ap = s.actionsRemaining;
    for (let i = 0; i < 5; i++) act(s, { type: 'POTION_WORK', batchId: batch.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); expect(s.unshadowed.batches[1]!.labourSteps).toBe(0); expect(batch.materials.every(m => m.holder === 'SUPPLIER')).toBe(true); reject(s, { type: 'POTION_WORK', batchId: batch.id }); reject(s, { type: 'BREW', batchId: batch.id });
    act(s, { type: 'BUY_MATERIALS', batchId: batch.id }); expect(s.cash).toBe(cash - 900); expect(batch.materials.map(m => m.quantity)).toEqual([3, 1, 60, 30, 7, 10]); expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true); expect(s.unshadowed.bottles).toEqual([]);
    const c = act(s, { type: 'BREW', batchId: batch.id }); expect(c.check).not.toHaveBeenCalled(); expect(s.cash).toBe(cash - 1000); expect(s.actionsRemaining).toBe(ap - 6); expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.unshadowed.bottles[0]).toMatchObject({ id: `${batch.id}:bottle`, batchId: batch.id, inputIds: batch.materials.map(m => m.id), status: 'PREPARED', outcome: null, consumedWeek: null, ritualId: null }); reject(s, { type: 'BREW', batchId: batch.id }); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('charges full 6600 when the fifth job is absent and cannot use another batch credit', () => {
    const s = taught(), first = s.unshadowed.batches[0]!, second = s.unshadowed.batches[1]!;
    for (let i = 0; i < 4; i++) act(s, { type: 'POTION_WORK', batchId: first.id }); const cash = s.cash;
    act(s, { type: 'BUY_MATERIALS', batchId: first.id }); expect(s.cash).toBe(cash - 6600); expect(second.labourSteps).toBe(0); reject(s, { type: 'POTION_WORK', batchId: first.id }); reject(s, { type: 'BUY_MATERIALS', batchId: first.id }); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('refuses wrong original quantities or swapped ingredients without mutating costs', () => {
    const s = taught(), b = s.unshadowed.batches[0]!; act(s, { type: 'BUY_MATERIALS', batchId: b.id }); b.materials[0]!.quantity = 1; reject(s, { type: 'BREW', batchId: b.id }); expect(validateUnshadowedState(s)).toBe(false);
    b.materials[0]!.quantity = 3; b.materials[0]!.id = s.unshadowed.batches[1]!.materials[0]!.id; reject(s, { type: 'BREW', batchId: b.id }); expect(s.unshadowed.bottles).toEqual([]);
  });
  it.each([{ roll: 1, outcome: 'GREAT_SUCCESS', health: 100, mind: 92, pollution: 0 }, { roll: 30, outcome: 'SUCCESS', health: 100, mind: 85, pollution: 0 }, { roll: 75, outcome: 'FAILURE', health: 85, mind: 75, pollution: 30 }, { roll: 100, outcome: 'GREAT_FAILURE', health: 75, mind: 55, pollution: 60 }])('records raw $outcome but stays sequence5 with the same absent original emotion', ({ roll, outcome, health, mind, pollution }) => {
    const s = ready(), old = structuredClone(oldPath(s)), mastery = structuredClone(s.progression.mastery), stats = structuredClone(s.character.coreStats), ap = s.actionsRemaining, gender = s.character.gender, v = currentUnshadowedVisit(s)!, anchor = structuredClone(v.anchor), vessel = structuredClone(v.vessel);
    const c = act(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28); expect([s.health, s.mind, s.seer.pollution]).toEqual([health, mind, pollution]); expect(s.actionsRemaining).toBe(ap);
    expect([s.progression.sequence, s.progression.acting, s.spirituality]).toEqual([5, 100, 31]); expect(s.character.gender).toBe(gender); expect(s.character.coreStats).toEqual(stats); expect(s.progression.mastery).toEqual(mastery); expect(oldPath(s)).toEqual(old);
    expect(v).toMatchObject({ phase: 'DRUNK', rawOutcome: outcome, finishedSuccess: false, pendingBottleId: s.unshadowed.bottles[0]!.id }); expect(v.anchor).toEqual(anchor); expect(v.vessel).toEqual(vessel); expect(v.kit.status).toBe('CONSUMED'); expect(projectUnshadowed(s).bottles[0]!.status).toContain('尚未晋升'); expect(validateUnshadowedState(s)).toBe(true); reject(s, dose(s));
  });
  it('promotes only after actual same-original return, retaining old histories and no free spirituality', () => {
    const s = ready(), old = structuredClone(oldPath(s)), mastery = structuredClone(s.progression.mastery), stats = structuredClone(s.character.coreStats), v = currentUnshadowedVisit(s)!; act(s, dose(s), 30); act(s, { type: 'RETURN_EMOTION' });
    expect([s.progression.sequence, s.progression.acting, s.spirituality]).toEqual([4, 0, 31]); expect(s.unshadowed).toMatchObject({ promotionWeek: s.week, priestOfLightActingAtPromotion: 100 }); expect(v).toMatchObject({ phase: 'RETURNED', finishedSuccess: true }); expect(v.anchor).toMatchObject({ location: 'RETURNED', felt: true, returnedFromVesselId: v.vessel.id }); expect(v.vessel).toMatchObject({ status: 'EMPTY', anchorId: null });
    expect(s.progression.mastery).toEqual({ ...mastery, ...Object.fromEntries(UNSHADOWED_ABILITY_IDS.map(id => [id, 0])) }); for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
    expect(oldPath(s)).toEqual(old); expect(validateUnshadowedState(s)).toBe(true); reject(s, { type: 'RETURN_EMOTION' }); act(s, { type: 'END_RITUAL' }); expect(s.unshadowed.ritual.playerLocation).toBe('OUTSIDE'); reject(s, dose(s)); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('keeps failed potion costs and old acting100 after honest emotional return and exit', () => {
    const s = ready(), cash = s.cash; act(s, dose(s), 100); act(s, { type: 'RETURN_EMOTION' }); act(s, { type: 'END_RITUAL' });
    expect([s.progression.sequence, s.progression.acting, s.health, s.mind, s.cash]).toEqual([5, 100, 75, 55, cash]); expect(s.unshadowed.ritual.visits[0]!.anchor).toMatchObject({ location: 'RETURNED', felt: true }); expect(s.unshadowed.promotionWeek).toBeNull(); expect(validateUnshadowedState(s)).toBe(true);
  });
  it('allows actual next-week resupply after three raw successes were explicitly returned and aborted', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { brew(s, i); enter(s); act(s, dose(s, i), 30); act(s, { type: 'CANCEL_RITUAL' }); }
    const old = structuredClone(s.unshadowed.ritual.visits), cash = s.cash; expect(s.progression.sequence).toBe(5); expect(s.unshadowed.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'SUCCESS')).toBe(true); act(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.cash).toBe(cash); expect(s.unshadowed.batches).toHaveLength(6); expect(s.unshadowed.batches[3]).toMatchObject({ id: 'unshadowed-batch-4', acquired: false, brewed: false, labourSteps: 0, stockedWeek: s.week }); expect(s.unshadowed.batches[3]!.materials.map(m => m.quantity)).toEqual([3, 1, 60, 30, 7, 10]); expect(s.unshadowed.ritual.visits).toEqual(old); expect(validateUnshadowedState(s)).toBe(true); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects exact-command changes and premature consumption thresholds before any mutation', () => {
    for (const command of [{ type: 'BUY_POTION', bottleId: 'unshadowed-batch-1:bottle' }, { type: 'POTION_WORK', batchId: 'unshadowed-batch-0' }, { type: 'BREW', batchId: 'unshadowed-batch-1', extra: true }, { type: 'CONSUME', bottleId: 'unshadowed-batch-1:bottle', confirmed: false }, { type: 'DECLARE_EMOTION', subjectId: 'UD4-CELIA', confirmed: true }]) expect(validateUnshadowedCommand(command)).toBe(false);
    const s = ready(); s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100; s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.priestOfLight.promotionWeek = s.week - 11; reject(s, dose(s));
  });
  it('persists all original identities and rejects forged promotion, missing inputs and fake return facts', () => {
    const s = ready(); act(s, dose(s), 30); const copy: SliceState = JSON.parse(JSON.stringify(s)); expect(validateUnshadowedState(copy)).toBe(true); expect(projectUnshadowed(copy)).toEqual(projectUnshadowed(s));
    const corruptions = [(v: SliceState) => { v.unshadowed.bottles[0]!.inputIds.pop(); }, (v: SliceState) => { v.unshadowed.promotionWeek = v.week; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.finishedSuccess = true; }, (v: SliceState) => { v.unshadowed.ritual.visits[0]!.anchor!.felt = true; }];
    for (const corrupt of corruptions) { const bad = structuredClone(s); corrupt(bad); expect(validateUnshadowedState(bad)).toBe(false); }
  });
});
