import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { createReceptionWorkLedger, receptionEconomyBlock, receptionEconomySnapshot, resolveReceptionEconomy } from '../../src/domain/reception-economy.js';
import { MIRACLE_WORKER_CASE_IDS } from '../../src/domain/miracle-worker/life.js';
import { applyMiracleWorkerRitual } from '../../src/domain/miracle-worker/ritual.js';
import { attendantMysteriesSourceDigest } from '../../src/domain/attendant-mysteries/ritual.js';
import { applyAttendantMysteriesReception, blockAttendantMysteriesReception, createAttendantMysteriesReceptionState,
  validateAttendantMysteriesReception, validateAttendantMysteriesReceptionCommand, projectAttendantMysteriesReception,
  type AttendantMysteriesReceptionCommand } from '../../src/domain/attendant-mysteries/reception.js';

/** Declared unit state, not a fabricated natural campaign prefix. */
function source(): SliceState {
  const s = createSliceRun('reception-declared-unit', sliceDefaultCreationSelection, 'reception-declared-unit');
  s.week = 16000; s.date = { epoch: 'FIFTH_EPOCH', year: 1651, month: 1, day: 1 }; s.revision = 10;
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 2; s.ancientScholar.promotionWeek = 1; s.miracleWorker.promotionWeek = 2;
  s.ancientScholar.ritual.location = 'RECEPTION'; s.miracleWorker.ritual.location = 'RECEPTION'; s.attendantMysteries.guidanceKnown = true;
  s.attendantMysteries.reception = createAttendantMysteriesReceptionState(); s.attendantMysteries.sourceHistoryDigest = attendantMysteriesSourceDigest(s);
  s.actionsRemaining = 4; s.cash = 100; s.health = 70; s.mind = 50; s.spirituality = 60; s.seer.pollution = 30; s.injuryRisk = 4;
  s.injuries = [{ id: 'real-original-wound', severity: 'HEAVY', acquiredRevision: 3, treatedRevision: null }];
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.billAmount = 0; return s;
}
function context(): SeerContext { return { note: vi.fn(), roll() { throw new Error('Reception must not draw RNG'); }, check() { throw new Error('Reception must not draw RNG'); } }; }
function act(s: SliceState, type: AttendantMysteriesReceptionCommand['type']) { applyAttendantMysteriesReception(s, { type }, context()); s.revision++; }

describe('Exact shared contemporary reception economy', () => {
  it('keeps the original four-action next week, exact prices, pure inputs and seven-day calendar', () => {
    const s = source(), before = receptionEconomySnapshot(s), w = createReceptionWorkLedger(), copy = structuredClone({ before, w });
    const work = resolveReceptionEconomy(before, w, 'WORK'); expect(work.after).toMatchObject({ cash: 124, actions: 3, week: 16000 }); expect(work.workAfter).toMatchObject({ works: 1, income: 24 });
    const rest = resolveReceptionEconomy(before, w, 'REST'); expect(rest.after).toMatchObject({ cash: 92, actions: 3, health: 75, mind: 58, spirituality: 70, pollution: 20, injuryRisk: 0 });
    expect(rest.after.injuries).toEqual([{ ...s.injuries[0], treatedRevision: 11 }]);
    const next = resolveReceptionEconomy({ ...before, actions: 0 }, w, 'NEXT_WEEK'); expect(next.after).toMatchObject({ cash: 76, actions: 4, week: 16001 }); expect(next.after.date).toEqual(addGameDays(before.date, 7));
    expect({ before, w }).toEqual(copy);
  });
  it('preserves the old ritual ledger and output exactly through the extracted helper', () => {
    for (const command of ['WORK', 'REST', 'NEXT_WEEK'] as const) {
      const s = source(); if (command === 'NEXT_WEEK') s.actionsRemaining = 0;
      const expected = resolveReceptionEconomy(receptionEconomySnapshot(s), s.miracleWorker.ritual.work, command), newLedger = structuredClone(s.attendantMysteries.reception);
      applyMiracleWorkerRitual(s, { type: command }, context());
      expect(receptionEconomySnapshot(s)).toEqual(expected.after); expect(s.miracleWorker.ritual.work).toEqual(expected.workAfter); expect(s.attendantMysteries.reception).toEqual(newLedger);
    }
  });
  it('keeps the emergency work finite, means-tested and reset only by a paid actual week', () => {
    const s = source(), before = { ...receptionEconomySnapshot(s), actions: 0, cash: 0 }, w = createReceptionWorkLedger();
    const one = resolveReceptionEconomy(before, w, 'WORK'); expect(one.after).toMatchObject({ actions: 0, cash: 24 }); expect(one.workAfter.emergencyUsed).toBe(true);
    expect(receptionEconomyBlock({ ...one.after, cash: 0 }, one.workAfter, 'WORK')).not.toBeNull(); expect(receptionEconomyBlock({ ...before, cash: 24 }, w, 'WORK')).not.toBeNull();
    expect(() => resolveReceptionEconomy(before, w, 'NEXT_WEEK')).toThrow();
    const next = resolveReceptionEconomy(one.after, one.workAfter, 'NEXT_WEEK'); expect(next.after).toMatchObject({ cash: 0, actions: 4, week: before.week + 1 }); expect(next.workAfter.emergencyUsed).toBe(false);
  });
});

describe('Independent bounded S2/S1 reception journal', () => {
  it('shares the exact rules but never mutates original history, old ledgers or RNG', () => {
    const s = source(), old = attendantMysteriesSourceDigest(s), rng = structuredClone(s.random), oldWork = structuredClone(s.miracleWorker.ritual.work);
    act(s, 'RECEPTION_WORK'); act(s, 'RECEPTION_REST');
    expect(s.attendantMysteries.reception.work).toMatchObject({ works: 1, rests: 1, income: 24, expenses: 8 });
    expect(s.miracleWorker.ritual.work).toEqual(oldWork); expect(attendantMysteriesSourceDigest(s)).toBe(old); expect(s.random).toEqual(rng); expect(validateAttendantMysteriesReception(s)).toBe(true);
    expect(s.injuries[0]).toMatchObject({ id: 'real-original-wound', severity: 'HEAVY', acquiredRevision: 3, treatedRevision: 12 });
    const scope = JSON.parse(s.attendantMysteries.reception.journal[0]!.preservedBefore);
    expect(Object.keys(scope).sort()).toEqual(['oldHistory', 'preservedDigest', 'progression']); expect(scope.preservedDigest).toMatch(/^[a-f0-9]{64}$/); expect(scope.oldHistory).toBe(old);
  });
  it('funds guidance from the completed original S2 reports before guidance without changing its sealed history', () => {
    const s = source(); s.attendantMysteries.guidanceKnown = false; s.attendantMysteries.sourceHistoryDigest = null; s.actionsRemaining = 0; s.cash = 358;
    s.miracleWorker.life.reflected = true;
    for (const id of MIRACLE_WORKER_CASE_IDS) { s.miracleWorker.life.cases[id].status = 'RESOLVED'; s.seer.completedSources.push(`miracle-worker-case:${id}`); }
    s.seer.completedSources.push('miracle-worker-reflection');
    const old = attendantMysteriesSourceDigest(s), oldWork = structuredClone(s.miracleWorker.ritual.work), rng = structuredClone(s.random);
    const missing = structuredClone(s); missing.seer.completedSources.pop(); expect(blockAttendantMysteriesReception(missing, { type: 'RECEPTION_NEXT_WEEK' })).not.toBeNull();
    const premature = structuredClone(s); premature.progression.sequence = 1; expect(projectAttendantMysteriesReception(premature).actions).toEqual([]);
    for (let step = 0; step < 12; step++) act(s, s.actionsRemaining === 0 ? 'RECEPTION_NEXT_WEEK' : 'RECEPTION_WORK');
    expect([s.cash, s.actionsRemaining]).toEqual([502, 3]); expect(s.attendantMysteries.sourceHistoryDigest).toBeNull();
    expect(s.attendantMysteries.reception.origin!.sourceHistoryDigest).toBe(old); expect(attendantMysteriesSourceDigest(s)).toBe(old); expect(s.miracleWorker.ritual.work).toEqual(oldWork); expect(s.random).toEqual(rng);
    expect(validateAttendantMysteriesReception(s)).toBe(true);
    const forged = structuredClone(s); forged.attendantMysteries.sourceHistoryDigest = old; expect(validateAttendantMysteriesReception(forged)).toBe(false);
    // A later real guidance action seals the same source; this unit check isolates that ledger boundary.
    s.attendantMysteries.guidanceKnown = true; s.attendantMysteries.sourceHistoryDigest = old; s.cash -= 500; s.actionsRemaining--; s.revision++;
    expect(validateAttendantMysteriesReception(s)).toBe(true); act(s, 'RECEPTION_WORK'); expect(validateAttendantMysteriesReception(s)).toBe(true); expect(attendantMysteriesSourceDigest(s)).toBe(old);
  });
  it('requires actual base, no town/life/preparation/encounter lock, and no active event', () => {
    for (const mutate of [
      (s: SliceState) => { s.attendantMysteries.preparation = { week: s.week, bottleId: 'declared', regionId: 'declared', epoch: 0, townJournalLength: 0, evidenceDigest: 'declared' }; },
      (s: SliceState) => { s.attendantMysteries.life.activeCase = 'lost-threads'; },
      (s: SliceState) => { s.attendantMysteries.encounter.status = 'READY'; },
      (s: SliceState) => { s.miracleWorker.ritual.location = 'GATE_OUT'; },
      (s: SliceState) => { s.activeEvent = { id: 'LIFE-BILL-01', instanceId: 'declared-event' }; },
    ]) { const s = source(); mutate(s); const before = structuredClone(s); expect(blockAttendantMysteriesReception(s, { type: 'RECEPTION_WORK' })).not.toBeNull(); expect(() => act(s, 'RECEPTION_WORK')).toThrow(); expect(s).toEqual(before); }
  });
  it('recognizes same-week emergency work already spent through the original reception', () => {
    const s = source(); s.actionsRemaining = 0; s.cash = 0; s.miracleWorker.ritual.work = { week: s.week, works: 1, rests: 0, weeks: 0, income: 24, expenses: 0, emergencyUsed: true };
    s.attendantMysteries.sourceHistoryDigest = attendantMysteriesSourceDigest(s);
    expect(blockAttendantMysteriesReception(s, { type: 'RECEPTION_WORK' })).not.toBeNull();
    const next = source(); next.actionsRemaining = 0; next.cash = 0; act(next, 'RECEPTION_WORK'); expect(next.cash).toBe(24); act(next, 'RECEPTION_NEXT_WEEK'); expect(next.actionsRemaining).toBe(4); expect(validateAttendantMysteriesReception(next)).toBe(true);
  });
  it('retains capped exact recovery and permits the same ordinary services at S1', () => {
    const s = source(); s.progression.sequence = 1; s.attendantMysteries.promotionWeek = s.week; s.health = 99; s.mind = 99; s.spirituality = 119; s.seer.pollution = 2;
    act(s, 'RECEPTION_REST'); expect([s.health, s.mind, s.spirituality, s.seer.pollution]).toEqual([100, 100, 120, 0]); expect(validateAttendantMysteriesReception(s)).toBe(true);
    expect(projectAttendantMysteriesReception(s).actions.map(a => a.command.type)).toEqual(['RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK']);
  });
  it('rejects forged source, free income, altered date, extra commands, RNG or duplicate emergency ledger', () => {
    expect(validateAttendantMysteriesReceptionCommand({ type: 'RECEPTION_WORK', free: true })).toBe(false);
    const original = source(); act(original, 'RECEPTION_WORK'); expect(validateAttendantMysteriesReception(original)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.cash++; },
      (s: SliceState) => { s.attendantMysteries.reception.journal[0]!.after.cash++; },
      (s: SliceState) => { s.attendantMysteries.reception.journal[0]!.after.date = addGameDays(s.date, 1); },
      (s: SliceState) => { s.attendantMysteries.reception.journal[0]!.randomAfter++; },
      (s: SliceState) => { s.attendantMysteries.reception.work.emergencyUsed = true; },
      (s: SliceState) => { s.attendantMysteries.reception.origin!.sourceHistoryDigest = 'forged'; },
    ]) { const s = structuredClone(original); mutate(s); expect(validateAttendantMysteriesReception(s)).toBe(false); }
  });
  it('produces byte-equal records from the same original state without consuming randomness', () => {
    const a = source(), b = structuredClone(a); for (const type of ['RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_WORK', 'RECEPTION_WORK', 'RECEPTION_NEXT_WEEK'] as const) { act(a, type); act(b, type); }
    expect(a).toEqual(b); expect(validateAttendantMysteriesReception(a)).toBe(true); expect(a.attendantMysteries.reception.journal.at(-1)!.after.actions).toBe(4);
  });
});
