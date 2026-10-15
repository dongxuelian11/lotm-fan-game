import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { BARD_ABILITY_IDS } from '../../src/domain/bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../../src/domain/lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../../src/domain/sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../../src/domain/notary/types.js';
import { applyPriestOfLightAcquisition, createPriestOfLightState, projectPriestOfLight, projectPriestOfLightRitual, validatePriestOfLightCommand, validatePriestOfLightState } from '../../src/domain/priest-of-light/index.js';
import { priestOfLightInside } from '../../src/domain/priest-of-light/life.js';
import { PRIEST_OF_LIGHT_FORMULA, PRIEST_OF_LIGHT_FORMULA_SOURCE, PRIEST_OF_LIGHT_ICE_SOURCE, PRIEST_OF_LIGHT_PRICES } from '../../src/domain/priest-of-light/content.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS, type PriestOfLightAcquisitionCommand } from '../../src/domain/priest-of-light/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Explicit prior S6 fixture, not a claim of natural 9→5 playthrough. */
function notary(): SliceState {
  const s = createSliceRun('priest-of-light-acquisition-fixture', sliceDefaultCreationSelection, 'priest-of-light-fixture');
  s.activeEvent = null; s.eventQueue = []; s.week = 43; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.bard.discovered = true; s.bard.guidanceKnown = true; s.lightprayer.guidanceKnown = true; s.sunpriest.formulaKnown = true;
  s.notary.formulaKnown = true; s.notary.promotionWeek = 31;
  s.progression.pathwayId = 'sun'; s.progression.sequence = 6; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS].map((id, i) => [id, i + 12]));
  s.character.coreStats.will = 25; s.priestOfLight = createPriestOfLightState(); return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, c: PriestOfLightAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyPriestOfLightAcquisition(s, c, ctx); return ctx; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyPriestOfLightAcquisition(s, c as PriestOfLightAcquisitionCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
function taught() { const s = notary(); apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, i = 0) { const batchId = s.priestOfLight.batches[i]!.id; apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId }); return s.priestOfLight.bottles.at(-1)!; }
function visit(s: SliceState) { apply(s, { type: 'REQUEST_RITUAL' }); s.week += 1; apply(s, { type: 'GO_RITUAL' }); apply(s, { type: 'BEGIN_RITUAL' }); }
function leave(s: SliceState) { apply(s, { type: 'END_RITUAL' }); apply(s, { type: 'RETURN_GUIDE' }); }

describe('Priest of Light six original materials and actual dark non-melting ice ritual', () => {
  it('keeps three independent six-item batches and only the unquantified canonical red crown', () => {
    const s = notary(); expect(validatePriestOfLightState(s)).toBe(true);
    expect(PRIEST_OF_LIGHT_FORMULA.map(m => m.quantity)).toEqual([null, 1, 5, 7, 10, 60]);
    expect(PRIEST_OF_LIGHT_FORMULA_SOURCE).toContain('第三部第204章'); expect(PRIEST_OF_LIGHT_ICE_SOURCE).toBe('PL5-ICE-1');
    expect(PRIEST_OF_LIGHT_PRICES).toEqual({ formula: 460, mainMaterials: 4200, auxiliaryMaterials: 600, brewing: 100, ritualTravel: 180, ritualAssistance: 120 });
    expect(s.priestOfLight.batches.map(b => b.materials.length)).toEqual([6, 6, 6]); expect(s.priestOfLight.bottles).toEqual([]);
    createPriestOfLightState().batches[0]!.materials[0]!.quantity = 0;
    expect(s.priestOfLight.batches[0]!.materials[0]!.quantity).toBe(1);
    apply(s, { type: 'LEARN_FORMULA' }); expect(s.cash).toBe(49540);
    expect(projectPriestOfLight(s).formula.map(m => m.quantity)).toEqual([null, 1, 5, 7, 10, 60]);
    expect(projectPriestOfLight(s).formula[0]!.note).toContain('不编造克重');
  });
  it('needs five original-batch labour actions, actual six-item delivery, and actual brewing without another check', () => {
    const s = taught(), batchId = s.priestOfLight.batches[0]!.id, start = s.cash, ap = s.actionsRemaining;
    for (let i = 0; i < 5; i++) apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(s.cash).toBe(start); expect(s.actionsRemaining).toBe(ap - 5);
    expect(s.priestOfLight.batches[1]!.labourSteps).toBe(0); reject(s, { type: 'MATERIAL_WORK', batchId });
    expect(s.priestOfLight.batches[0]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
    apply(s, { type: 'BUY_MATERIALS', batchId }); expect(s.cash).toBe(start - 600);
    expect(s.priestOfLight.batches[0]!.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = apply(s, { type: 'BREW', batchId }); expect(ctx.check).not.toHaveBeenCalled(); expect(s.cash).toBe(start - 700);
    expect(s.priestOfLight.batches[0]!.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.priestOfLight.bottles[0]).toMatchObject({ status: 'PREPARED', outcome: null, consumedWeek: null, ritualVisit: null, inputIds: s.priestOfLight.batches[0]!.materials.map(m => m.id) });
    reject(s, { type: 'BREW', batchId }); expect(validatePriestOfLightState(s)).toBe(true);
  });
  it('charges full 4800 material price without completed labour and never creates a ready-made bottle', () => {
    const s = taught(), batchId = s.priestOfLight.batches[0]!.id, cash = s.cash;
    for (let i = 0; i < 4; i++) apply(s, { type: 'MATERIAL_WORK', batchId });
    apply(s, { type: 'BUY_MATERIALS', batchId }); expect(s.cash).toBe(cash - 4800); expect(s.priestOfLight.bottles).toEqual([]);
    reject(s, { type: 'MATERIAL_WORK', batchId }); reject(s, { type: 'BUY_MATERIALS', batchId });
    expect(validatePriestOfLightCommand({ type: 'BUY_POTION', bottleId: 'priest-of-light-potion-1' })).toBe(false);
  });
  it('rejects substituted quantities, mixed inputs, phantom ice and malformed exact commands without mutation', () => {
    const s = taught(), batchId = s.priestOfLight.batches[0]!.id;
    apply(s, { type: 'BUY_MATERIALS', batchId }); s.priestOfLight.batches[0]!.materials[2]!.quantity = 6;
    reject(s, { type: 'BREW', batchId }); expect(validatePriestOfLightState(s)).toBe(false);
    expect(validatePriestOfLightCommand({ type: 'BEGIN_RITUAL', ordinaryIce: true })).toBe(false);
    expect(validatePriestOfLightCommand({ type: 'CONSUME', bottleId: `${batchId}:bottle`, confirmed: false })).toBe(false);
    expect(validatePriestOfLightCommand({ type: 'PREPARE', caseId: 'darkened-walk', method: 'ORDINARY' })).toBe(true);
    expect(validatePriestOfLightCommand({ type: 'MOVE_LANTERN', teleport: true })).toBe(false);
  });
  it('requires prior-week appointment, actual local travel, paid burial and ordinary complete blackout before dosing', () => {
    const s = taught(), b = brew(s), world = structuredClone(s.world), dose = { type: 'CONSUME', bottleId: b.id, confirmed: true } as const;
    reject(s, dose); reject(s, { type: 'BEGIN_RITUAL' }); apply(s, { type: 'REQUEST_RITUAL' }); reject(s, { type: 'GO_RITUAL' });
    s.week += 1; const ap = s.actionsRemaining, cash = s.cash; apply(s, { type: 'GO_RITUAL' });
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 1, cash - 180]); expect(s.world).toEqual(world);
    expect(s.priestOfLight.ritual).toMatchObject({ location: 'CHAMBER', darkness: false, nonMeltingIce: false, helperPresent: true });
    expect(priestOfLightInside(s)).toBe(true); reject(s, dose); apply(s, { type: 'BEGIN_RITUAL' }); expect(s.cash).toBe(cash - 300);
    expect(s.priestOfLight.ritual).toMatchObject({ location: 'ICE', darkness: true, nonMeltingIce: true, helperPresent: true });
    for (const key of ['darkness', 'nonMeltingIce', 'helperPresent'] as const) { s.priestOfLight.ritual[key] = false; reject(s, dose); s.priestOfLight.ritual[key] = true; }
    s.progression.acting = 99; reject(s, dose); s.progression.acting = 100;
    s.notary.promotionWeek = s.week - 11; reject(s, dose); s.notary.promotionWeek = 31;
    s.health = 20; reject(s, dose); s.health = 100; s.mind = 40; reject(s, dose); s.mind = 100;
    expect(validatePriestOfLightState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0], [30, 'SUCCESS', 90, 100, 0], [90, 'FAILURE', 80, 90, 25], [100, 'GREAT_FAILURE', 60, 80, 50]] as const)('applies four-tier dose %s, preserves inherited facts and resources, then needs real extraction', (roll, tier, mind, health, pollution) => {
    const s = taught(), b = brew(s), before = structuredClone(s.notary), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
    visit(s); const ctx = apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.check).toHaveBeenCalledWith('will', 26); expect(b.outcome).toBe(tier);
    expect([s.mind, s.health, s.seer.pollution, s.spirituality]).toEqual([mind, health, pollution, 31]);
    expect(s.notary).toEqual(before); expect(s.priestOfLight.ritual.history[0]!.consumedBottleId).toBe(b.id);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    if (roll <= 30) { expect(s.progression.sequence).toBe(5); expect(PRIEST_OF_LIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(s.priestOfLight.notaryActingAtPromotion).toBe(100); for (const id of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[id]).toBe(stats[id] + 1); }
    else expect(s.progression.sequence).toBe(6);
    expect(validatePriestOfLightState(s)).toBe(true); expect(s.priestOfLight.ritual.location).toBe('ICE');
    s.actionsRemaining = 0; reject(s, { type: 'RETURN_GUIDE' });
    expect(projectPriestOfLight(s).actions.find(a => a.command.type === 'END_RITUAL')?.enabled).toBe(true);
    apply(s, { type: 'END_RITUAL' }); expect(s.priestOfLight.ritual).toMatchObject({ location: 'CHAMBER', darkness: false, nonMeltingIce: false, helperPresent: true });
    expect(priestOfLightInside(s)).toBe(true); apply(s, { type: 'RETURN_GUIDE' });
    expect(priestOfLightInside(s)).toBe(false); expect(validatePriestOfLightState(s)).toBe(true);
    expect(projectPriestOfLightRitual(s).location).toBe('GUIDE');
  });
  it('allows zero-AP actual extraction and return with depleted health, mind and cash without consuming the bottle', () => {
    const s = taught(), b = brew(s); visit(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0; s.cash = 0;
    apply(s, { type: 'END_RITUAL' }); apply(s, { type: 'RETURN_GUIDE' });
    expect([s.health, s.mind, s.cash, s.actionsRemaining]).toEqual([0, 0, 0, 0]); expect(b.status).toBe('PREPARED'); expect(s.priestOfLight.ritual.history[0]!.returned).toBe(true);
  });
  it('allows leaving the chamber before burial and keeps the original bottle and prepaid cost', () => {
    const s = taught(), b = brew(s); apply(s, { type: 'REQUEST_RITUAL' }); s.week += 1;
    const cash = s.cash; apply(s, { type: 'GO_RITUAL' }); s.actionsRemaining = 0; apply(s, { type: 'RETURN_GUIDE' });
    expect(s.cash).toBe(cash - 180); expect(b.status).toBe('PREPARED'); expect(s.priestOfLight.ritual.history[0]).toMatchObject({ entered: false, returned: true, consumedBottleId: null });
    expect(validatePriestOfLightState(s)).toBe(true);
  });
  it('requires a new actual visit for each dose and only replenishes after every old batch failed', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) {
      const b = brew(s, i); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
      apply(s, { type: 'END_RITUAL' }); reject(s, { type: 'BEGIN_RITUAL' }); apply(s, { type: 'RETURN_GUIDE' }); s.health = 100; s.mind = 100;
      if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.priestOfLight.batches).toHaveLength(6); expect(s.priestOfLight.bottles).toHaveLength(3); expect(s.priestOfLight.ritual.consumptions).toBe(3);
    expect(s.priestOfLight.batches.slice(3).every(b => !b.acquired && !b.brewed && b.labourSteps === 0)).toBe(true); expect(validatePriestOfLightState(s)).toBe(true);
  });
  it('rejects fabricated visit, body burial, material input and bottle history', () => {
    const s = taught(), b = brew(s); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    const corrupt = structuredClone(s); corrupt.priestOfLight.ritual.history[0]!.requestedWeek = corrupt.week; expect(validatePriestOfLightState(corrupt)).toBe(false);
    const unburied = structuredClone(s); unburied.priestOfLight.ritual.history[0]!.entered = false; expect(validatePriestOfLightState(unburied)).toBe(false);
    const swapped = structuredClone(s); swapped.priestOfLight.bottles[0]!.ritualVisit = 2; expect(validatePriestOfLightState(swapped)).toBe(false);
    const input = structuredClone(s); input.priestOfLight.bottles[0]!.inputIds[0] = 'notary-batch-1:red-crown'; expect(validatePriestOfLightState(input)).toBe(false);
    const missing = structuredClone(s); (missing.priestOfLight as unknown as Record<string, unknown>).ritual = null; expect(validatePriestOfLightState(missing)).toBe(false);
    const restored = structuredClone(s); restored.priestOfLight.batches[0]!.materials[0]!.quantity = 1; expect(validatePriestOfLightState(restored)).toBe(false);
  });
  it('stops a consumed original from appearing in a second visit history', () => {
    const s = taught(), b = brew(s); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 90); leave(s);
    s.health = 100; s.mind = 100; visit(s);
    s.priestOfLight.ritual.history[1]!.consumedBottleId = b.id; s.priestOfLight.ritual.consumptions = 2;
    expect(validatePriestOfLightState(s)).toBe(false);
  });
});
