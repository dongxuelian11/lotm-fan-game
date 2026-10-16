import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { CLOWN_ABILITY_IDS } from '../../src/domain/clown/types.js';
import { MAGICIAN_ABILITY_IDS } from '../../src/domain/magician/types.js';
import { FACELESS_ABILITY_IDS } from '../../src/domain/faceless/types.js';
import { applyMarionettistAcquisition, createMarionettistState, projectMarionettist, validateMarionettistState } from '../../src/domain/marionettist/index.js';
import { applyMarionettistActivity, marionettistInside, validateMarionettistPractice } from '../../src/domain/marionettist/practice.js';
import { MARIONETTIST_ABILITY_IDS, MARIONETTIST_CASE_IDS, type MarionettistCaseId, type MarionettistActivityCommand, type MarionettistAcquisitionCommand } from '../../src/domain/marionettist/types.js';
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
function taught() { const s = faceless(); apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, i = 0) { const batchId = s.marionettist.batches[i]!.id; apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId }); return s.marionettist.bottles.at(-1)!; }
function visit(s: SliceState) { apply(s, { type: 'REQUEST_RITUAL' }); s.week += 1; apply(s, { type: 'GO_RITUAL' }); apply(s, { type: 'BEGIN_SONG' }); }

function promoted() { const s = taught(), b = brew(s); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); apply(s, { type: 'RETURN_CLUB' }); return s; }
function activity(s: SliceState, c: MarionettistActivityCommand, roll = 1) {
  const ctx = context(s, roll), award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[MARIONETTIST_ABILITY_IDS[0]]! += amount; });
  applyMarionettistActivity(s, c, ctx, award); return { ctx, award };
}
function rejectActivity(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s), award = vi.fn(); expect(() => applyMarionettistActivity(s, c as MarionettistActivityCommand, ctx, award)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: MarionettistCaseId) { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); }
function complete(s: SliceState, caseId: MarionettistCaseId) { begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId }); }

describe('Marionettist real peaceful ability contacts', () => {
  it('keeps PREPARE stable and only PERFORM observes true living lines, never puppet lines', () => {
    const s = promoted(), oldFaceless = structuredClone(s.faceless), sp = s.spirituality;
    begin(s, 'living-lines'); expect(marionettistInside(s)).toBe(false);
    expect(s.marionettist.cases['living-lines']).toMatchObject({ contactOpen: false, linesObserved: false });
    expect(s.spirituality).toBe(sp); expect(validateMarionettistState(s)).toBe(true);
    activity(s, { type: 'PERFORM', caseId: 'living-lines' });
    expect(s.spirituality).toBe(sp - 3); expect(s.marionettist.cases['living-lines']).toMatchObject({ contactOpen: true, linesObserved: true, outcome: 'LINES_RECORDED' });
    rejectActivity(s, { type: 'REPORT', caseId: 'living-lines' });
    activity(s, { type: 'CLOSE', caseId: 'living-lines' }); activity(s, { type: 'REPORT', caseId: 'living-lines' });
    expect(projectMarionettist(s).cases[0]!.result).toContain('普通木偶没有灵体之线');
    expect(s.marionettist.puppet.target).toBeNull(); expect(s.faceless).toEqual(oldFaceless); expect(validateMarionettistState(s)).toBe(true);
  });
  it('requires actual release and witnessed autonomy before the second report', () => {
    const s = promoted(); complete(s, 'living-lines'); begin(s, 'controlled-release'); activity(s, { type: 'PERFORM', caseId: 'controlled-release' });
    const r = s.marionettist.cases['controlled-release'];
    expect(r).toMatchObject({ initialControl: true, contactOpen: true, autonomyVerified: false }); expect(validateMarionettistState(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: 'controlled-release' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'break-contact' });
    const sp = s.spirituality; s.actionsRemaining = 0; s.mind = 0; activity(s, { type: 'CLOSE', caseId: 'controlled-release' });
    expect(r).toMatchObject({ initialControl: false, contactOpen: false, autonomyVerified: true, closes: 1 }); expect(s.spirituality).toBe(sp); expect(s.mind).toBe(0);
    s.actionsRemaining = 2; s.mind = 50; activity(s, { type: 'REPORT', caseId: 'controlled-release' }); expect(s.progression.acting).toBe(50); expect(s.marionettist.puppet.target).toBeNull(); expect(validateMarionettistState(s)).toBe(true);
  });
  it('actually interrupts initial control and verifies autonomous action, then completes peaceful 100', () => {
    const s = promoted(), initialSp = s.spirituality, original = structuredClone(s.faceless);
    complete(s, 'living-lines'); complete(s, 'controlled-release'); begin(s, 'break-contact'); activity(s, { type: 'PERFORM', caseId: 'break-contact' });
    expect(s.marionettist.cases['break-contact']).toMatchObject({ initialControl: false, interrupted: true, autonomyVerified: true, contactOpen: true });
    expect(validateMarionettistPractice(s)).toBe(true); activity(s, { type: 'WITHDRAW', caseId: 'break-contact' }); activity(s, { type: 'REPORT', caseId: 'break-contact' }); activity(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(initialSp - 9); expect(s.faceless).toEqual(original); expect(s.marionettist.puppet.target).toBeNull();
    expect(MARIONETTIST_CASE_IDS.every(id => s.marionettist.cases[id].status === 'RESOLVED')).toBe(true); expect(s.seer.completedSources.filter(x => x.startsWith('marionettist-case:'))).toHaveLength(3);
    rejectActivity(s, { type: 'REFLECT' }); rejectActivity(s, { type: 'REPORT', caseId: 'break-contact' }); expect(validateMarionettistState(s)).toBe(true);
  });
  it('retains failed costs and enforces a real next week before retry preparation', () => {
    const s = promoted(); begin(s, 'living-lines'); const sp = s.spirituality, ap = s.actionsRemaining;
    activity(s, { type: 'PERFORM', caseId: 'living-lines' }, 100);
    expect([s.spirituality, s.actionsRemaining]).toEqual([sp - 3, ap - 1]); expect(s.marionettist.cases['living-lines']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', linesObserved: false, contactOpen: true });
    rejectActivity(s, { type: 'REPORT', caseId: 'living-lines' }); activity(s, { type: 'WITHDRAW', caseId: 'living-lines' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'living-lines', method: 'ABILITY' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'living-lines', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'living-lines' }); activity(s, { type: 'CLOSE', caseId: 'living-lines' }); activity(s, { type: 'REPORT', caseId: 'living-lines' });
    expect(s.spirituality).toBe(sp - 6); expect(s.marionettist.cases['living-lines'].closes).toBe(2); expect(validateMarionettistState(s)).toBe(true);
  });
  it('can cancel preparation without spending S or creating contact and forbids insufficient S', () => {
    const s = promoted(); begin(s, 'living-lines'); s.spirituality = 2; const ap = s.actionsRemaining;
    rejectActivity(s, { type: 'PERFORM', caseId: 'living-lines' }); s.actionsRemaining = 0;
    activity(s, { type: 'WITHDRAW', caseId: 'living-lines' }); expect(s.spirituality).toBe(2); expect(s.actionsRemaining).toBe(0);
    expect(ap).toBeGreaterThan(0); expect(s.marionettist.cases['living-lines']).toMatchObject({ status: 'OBSERVED', method: null, contactOpen: false, attemptWeek: null, withdrawals: 1 }); expect(validateMarionettistState(s)).toBe(true);
  });
  it('rejects forged peaceful reports, fictitious puppet lines and missing original close', () => {
    const s = promoted(); complete(s, 'living-lines');
    const bad = structuredClone(s); bad.marionettist.cases['living-lines'].closes = 0; expect(validateMarionettistState(bad)).toBe(false);
    const outOfOrder = structuredClone(s); outOfOrder.marionettist.cases['break-contact'].status = 'OBSERVED'; outOfOrder.marionettist.cases['break-contact'].observedWeek = s.week; expect(validateMarionettistState(outOfOrder)).toBe(false);
    const fake = structuredClone(s); fake.marionettist.cases['controlled-release'].linesObserved = true; expect(validateMarionettistState(fake)).toBe(false);
    const unknown = structuredClone(s); (unknown.marionettist.cases as unknown as Record<string, unknown>)['living-lines'] = null; expect(validateMarionettistState(unknown)).toBe(false);
  });
});
