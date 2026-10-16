import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { CLOWN_ABILITY_IDS } from '../../src/domain/clown/types.js';
import { MAGICIAN_ABILITY_IDS } from '../../src/domain/magician/types.js';
import { FACELESS_ABILITY_IDS } from '../../src/domain/faceless/types.js';
import { applyMarionettistAcquisition, createMarionettistState, projectMarionettist, validateMarionettistCommand, validateMarionettistState } from '../../src/domain/marionettist/index.js';
import { marionettistInside } from '../../src/domain/marionettist/practice.js';
import { MARIONETTIST_FORMULA, MARIONETTIST_FORMULA_SOURCE } from '../../src/domain/marionettist/content.js';
import { MARIONETTIST_ABILITY_IDS, type MarionettistAcquisitionCommand } from '../../src/domain/marionettist/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Prior S6 is an explicit domain fixture, not a claimed natural 9→5 playthrough. */
function faceless(): SliceState {
  const s = createSliceRun('marionettist-acquisition-fixture', sliceDefaultCreationSelection, 'marionettist-fixture');
  s.activeEvent = null; s.eventQueue = []; s.week = 43; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.discovered = true; s.faceless.formulaKnown = true; s.faceless.promotionWeek = 31;
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 6; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS, ...FACELESS_ABILITY_IDS].map((id, i) => [id, i + 12]));
  s.character.coreStats.will = 25; s.marionettist = createMarionettistState(); return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, c: MarionettistAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyMarionettistAcquisition(s, c, ctx); return ctx; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyMarionettistAcquisition(s, c as MarionettistAcquisitionCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
function taught() { const s = faceless(); apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, i = 0) { const batchId = s.marionettist.batches[i]!.id; apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId }); return s.marionettist.bottles.at(-1)!; }
function visit(s: SliceState) { apply(s, { type: 'REQUEST_RITUAL' }); s.week += 1; apply(s, { type: 'GO_RITUAL' }); apply(s, { type: 'BEGIN_SONG' }); }

describe('Marionettist original materials and real mermaid visit', () => {
  it('keeps independent three-by-six stock and three unquantified canonical amounts', () => {
    const s = faceless(); expect(validateMarionettistState(s)).toBe(true);
    expect(MARIONETTIST_FORMULA.map(m => m.quantity)).toEqual([null, null, 80, 10, null, 1]);
    expect(MARIONETTIST_FORMULA_SOURCE).toContain('第二部第38章');
    expect(s.marionettist.batches.map(b => b.materials.length)).toEqual([6, 6, 6]);
    createMarionettistState().batches[0]!.materials[0]!.quantity = 0;
    expect(s.marionettist.batches[0]!.materials[0]!.quantity).toBe(1);
    apply(s, { type: 'LEARN_FORMULA' }); expect(s.cash).toBe(49580);
    expect(projectMarionettist(s).formula.map(m => m.quantity)).toEqual([null, null, 80, 10, null, 1]);
  });
  it('requires five original-batch labour actions and still pays auxiliaries and brewing', () => {
    const s = taught(), batchId = s.marionettist.batches[0]!.id, start = s.cash, ap = s.actionsRemaining;
    for (let i = 0; i < 5; i++) apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(s.cash).toBe(start); expect(s.actionsRemaining).toBe(ap - 5);
    expect(s.marionettist.batches[1]!.labourSteps).toBe(0); reject(s, { type: 'MATERIAL_WORK', batchId });
    apply(s, { type: 'BUY_MATERIALS', batchId }); expect(s.cash).toBe(start - 280);
    apply(s, { type: 'BREW', batchId }); expect(s.cash).toBe(start - 380);
    expect(s.marionettist.batches[0]!.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.marionettist.bottles[0]).toMatchObject({ status: 'PREPARED', outcome: null, consumedWeek: null, ritualVisit: null });
    reject(s, { type: 'BREW', batchId }); expect(validateMarionettistState(s)).toBe(true);
  });
  it('rejects substituted quantities, mixed inputs and malformed exact commands without mutation', () => {
    const s = taught(), batchId = s.marionettist.batches[0]!.id;
    apply(s, { type: 'BUY_MATERIALS', batchId }); s.marionettist.batches[0]!.materials[2]!.quantity = 81;
    reject(s, { type: 'BREW', batchId }); expect(validateMarionettistState(s)).toBe(false);
    expect(validateMarionettistCommand({ type: 'BEGIN_SONG', recording: true })).toBe(false);
    expect(validateMarionettistCommand({ type: 'CONSUME', bottleId: `${batchId}:bottle`, confirmed: false })).toBe(false);
    expect(validateMarionettistCommand({ type: 'PREPARE', caseId: 'living-lines', method: 'ORDINARY' })).toBe(false);
  });
  it('requires prior-week appointment, real city travel and actual song before dosing', () => {
    const s = taught(), b = brew(s), originalWorld = structuredClone(s.world);
    const dose = { type: 'CONSUME', bottleId: b.id, confirmed: true } as const;
    reject(s, dose); apply(s, { type: 'REQUEST_RITUAL' }); reject(s, { type: 'GO_RITUAL' });
    s.week += 1; const ap = s.actionsRemaining, cash = s.cash; apply(s, { type: 'GO_RITUAL' });
    expect([s.actionsRemaining, s.cash, s.world.city]).toEqual([ap - 1, cash - 80, 'ELSEWHERE']);
    expect({ ...s.world, city: originalWorld.city }).toEqual(originalWorld); expect(marionettistInside(s)).toBe(true); reject(s, dose);
    apply(s, { type: 'BEGIN_SONG' }); s.marionettist.ritual.singerWilling = false; reject(s, dose); s.marionettist.ritual.singerWilling = true;
    s.progression.acting = 99; reject(s, dose); s.progression.acting = 100;
    s.faceless.promotionWeek = s.week - 11; reject(s, dose); s.faceless.promotionWeek = 31;
    expect(validateMarionettistState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0], [30, 'SUCCESS', 90, 100, 0], [90, 'FAILURE', 80, 90, 25], [100, 'GREAT_FAILURE', 60, 80, 50]] as const)('applies exact four-tier dose %s and never restores S or appearance', (roll, tier, mind, health, pollution) => {
    const s = taught(), b = brew(s), before = structuredClone(s.faceless), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
    visit(s); const ctx = apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.check).toHaveBeenCalledWith('will', 26); expect(b.outcome).toBe(tier);
    expect([s.mind, s.health, s.seer.pollution, s.spirituality]).toEqual([mind, health, pollution, 31]);
    expect(s.faceless).toEqual(before); expect(s.marionettist.ritual.history[0]!.consumedBottleId).toBe(b.id);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    if (roll <= 30) { expect(s.progression.sequence).toBe(5); expect(MARIONETTIST_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(s.marionettist.facelessActingAtPromotion).toBe(100); for (const id of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[id]).toBe(stats[id] + 1); }
    else expect(s.progression.sequence).toBe(6);
    expect(validateMarionettistState(s)).toBe(true); s.actionsRemaining = 0; apply(s, { type: 'RETURN_CLUB' });
    expect(s.world.city).toBe('BACKLUND'); expect(s.marionettist.ritual.singing).toBe(false); expect(marionettistInside(s)).toBe(false); expect(validateMarionettistState(s)).toBe(true);
  });
  it('has zero-AP ending and physical return even with depleted health or mind', () => {
    const s = taught(), b = brew(s); visit(s); const cash = s.cash; s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    apply(s, { type: 'END_SONG' }); apply(s, { type: 'RETURN_CLUB' });
    expect([s.health, s.mind, s.cash, s.actionsRemaining]).toEqual([0, 0, cash, 0]); expect(b.status).toBe('PREPARED'); expect(s.marionettist.ritual.history[0]!.returned).toBe(true);
  });
  it('requires a new real visit for another dose and only replenishes after three failures across a real week', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) {
      const b = brew(s, i); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
      reject(s, { type: 'BEGIN_SONG' }); apply(s, { type: 'RETURN_CLUB' }); s.health = 100; s.mind = 100;
      if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.marionettist.batches).toHaveLength(6); expect(s.marionettist.bottles).toHaveLength(3); expect(s.marionettist.ritual.consumptions).toBe(3);
    expect(s.marionettist.batches.slice(3).every(b => !b.acquired && !b.brewed && b.labourSteps === 0)).toBe(true); expect(validateMarionettistState(s)).toBe(true);
  });
  it('rejects fabricated visit and bottle history instead of accepting recorded audio as a ritual', () => {
    const s = taught(), b = brew(s); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    const corrupt = structuredClone(s); corrupt.marionettist.ritual.history[0]!.requestedWeek = corrupt.week;
    expect(validateMarionettistState(corrupt)).toBe(false);
    const swapped = structuredClone(s); swapped.marionettist.bottles[0]!.ritualVisit = 2; expect(validateMarionettistState(swapped)).toBe(false);
    const missing = structuredClone(s); (missing.marionettist as unknown as Record<string, unknown>).ritual = null;
    expect(validateMarionettistState(missing)).toBe(false);
  });
});
