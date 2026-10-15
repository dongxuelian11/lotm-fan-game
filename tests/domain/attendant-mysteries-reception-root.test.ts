import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays, gameDaysBetween } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { AttendantMysteriesCommand } from '../../src/domain/attendant-mysteries/types.js';
import { attendantMysteriesSourceDigest, validateAttendantMysteriesTown } from '../../src/domain/attendant-mysteries/ritual.js';
import { validateAttendantMysteriesAcquisitionJournal } from '../../src/domain/attendant-mysteries/index.js';
import { validateAttendantMysteriesReception } from '../../src/domain/attendant-mysteries/reception.js';
import { createTownState } from '../../src/domain/attendant-mysteries/town.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const SOURCE = 'tests/fixtures/miracle-worker-v01640/continuation.json';
const ORIGIN = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 } as const;
const same = (actual: unknown, expected: unknown, label?: string): void => {
  expect(stableStringify(actual), label).toBe(stableStringify(expected));
};
/** A declared continuation from the captured, actually schema161 final state.
 * This does not replay or claim to regenerate the preceding1038 commands. */
function source(): SliceState {
  const old = readObjectEntry<Record<string, unknown>>(SOURCE, 'final'), before = stableStringify(old);
  expect([old.schemaVersion, old.contentVersion]).toEqual([161, 'miracle-worker-v161']);
  const s = migrateSliceState(old);
  expect(stableStringify(old)).toBe(before);
  expect(s).toMatchObject({ week: 15839, revision: 1039, cash: 358, actionsRemaining: 0, status: 'ACTIVE', progression: { pathwayId: 'diviner', sequence: 2, acting: 100 } });
  expect(s.attendantMysteries.guidanceKnown).toBe(false);
  expect(s.attendantMysteries.reception.origin).toBeNull();
  expect(s.ancientScholar.ritual.calendarRemainderDays).toBe(2);
  expect(gameDaysBetween(ORIGIN, s.date)).toBe(7 * (s.week - 1) + 2);
  assertValidSliceState(s);
  return s;
}
function inherited(s: SliceState, old: SliceState): void {
  for (const key of ['seer', 'clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker'] as const) same(s[key], old[key], key);
  same(s.progression, old.progression);
  same(s.character, old.character);
  same(s.random, old.random);
  same(s.combatHistory, old.combatHistory);
  expect(attendantMysteriesSourceDigest(s)).toBe(attendantMysteriesSourceDigest(old));
}
function act(s: SliceState, command: AttendantMysteriesCommand, old: SliceState): SliceState {
  const before = stableStringify(s);
  const shown = projectSliceState(s).attendantMysteries.actions.find(action => stableStringify(action.command) === stableStringify(command));
  expect(shown, command.type).toBeDefined();
  expect(shown!.enabled, shown!.reason ?? command.type).toBe(true);
  const intent: SliceIntent = { type: 'ATTENDANT_MYSTERIES', command };
  expect(validateSlicePayload(intent)).toBe(true);
  const next = applySliceIntent(s, intent);
  expect(stableStringify(s), `${command.type} leaves its input intact`).toBe(before);
  expect(next.revision).toBe(s.revision + 1);
  assertValidSliceState(next);
  expect(validateAttendantMysteriesReception(next)).toBe(true);
  inherited(next, old);
  return next;
}

describe('Attendant reception root wiring from the unchanged actual164 S2 source', () => {
  it('earns real guidance money through twelve public reception actions, pays500 and creates the actual town', () => {
    const old = source(), initial = projectSliceState(old).attendantMysteries;
    expect(initial.actions.find(action => action.command.type === 'RECEPTION_NEXT_WEEK')?.enabled).toBe(true);
    expect(initial.actions.find(action => action.command.type === 'RECEPTION_WORK')?.enabled).toBe(false);
    expect(initial.actions.find(action => action.command.type === 'LEARN_GUIDANCE')?.enabled).toBe(false);
    let s = old;
    for (let step = 0; step < 12; step++) {
      const command: AttendantMysteriesCommand = { type: s.actionsRemaining === 0 ? 'RECEPTION_NEXT_WEEK' : 'RECEPTION_WORK' };
      const before = { cash: s.cash, actions: s.actionsRemaining, week: s.week, date: s.date };
      s = act(s, command, old);
      expect(s.cash).toBe(before.cash + (command.type === 'RECEPTION_WORK' ? 24 : -24));
      expect(s.actionsRemaining).toBe(command.type === 'RECEPTION_WORK' ? before.actions - 1 : 4);
      expect(s.week).toBe(before.week + (command.type === 'RECEPTION_NEXT_WEEK' ? 1 : 0));
      same(s.date, addGameDays(before.date, command.type === 'RECEPTION_NEXT_WEEK' ? 7 : 0));
      expect(s.attendantMysteries.guidanceKnown).toBe(false);
      expect(s.attendantMysteries.town).toBeNull();
      expect(s.attendantMysteries.acquisitionJournal).toEqual([]);
    }
    expect([s.cash, s.actionsRemaining, s.week]).toEqual([502, 3, 15842]);
    expect(s.attendantMysteries.reception.journal).toHaveLength(12);
    expect(s.attendantMysteries.reception.work).toMatchObject({ works: 9, rests: 0, weeks: 3, income: 216, expenses: 72, emergencyUsed: false });
    same(s.date, addGameDays(old.date, 21));
    expect(gameDaysBetween(ORIGIN, s.date)).toBe(7 * (s.week - 1) + old.ancientScholar.ritual.calendarRemainderDays);
    same(s.attendantMysteries.reception.origin!.oldWork, old.miracleWorker.ritual.work);
    const beforeGuidance = s;
    s = act(s, { type: 'LEARN_GUIDANCE' }, old);
    expect([s.cash, s.actionsRemaining, s.progression.sequence]).toEqual([2, 2, 2]);
    expect(s.attendantMysteries).toMatchObject({ guidanceKnown: true, guidanceWeek: 15842, promotionWeek: null, miracleWorkerActingAtPromotion: null });
    expect(s.attendantMysteries.sourceHistoryDigest).toBe(attendantMysteriesSourceDigest(old));
    same(s.attendantMysteries.town, createTownState(s.week));
    expect(s.attendantMysteries.batches.every(batch => batch.stockedWeek === s.week && batch.acquiredWeek === null && batch.brewedWeek === null)).toBe(true);
    expect(s.attendantMysteries.bottles).toEqual([]);
    expect(s.attendantMysteries.acquisitionJournal).toHaveLength(1);
    const receipt = s.attendantMysteries.acquisitionJournal[0]!;
    expect(receipt.command).toEqual({ type: 'LEARN_GUIDANCE' });
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    same(receipt.date, beforeGuidance.date);
    expect(gameDaysBetween(ORIGIN, receipt.date)).toBe(7 * (receipt.week - 1) + 2);
    const zeroRemainderGuidance = structuredClone(s);
    zeroRemainderGuidance.attendantMysteries.acquisitionJournal[0]!.date = addGameDays(ORIGIN, 7 * (receipt.week - 1));
    expect(validateAttendantMysteriesAcquisitionJournal(zeroRemainderGuidance)).toBe(false);
    expect(() => assertValidSliceState(zeroRemainderGuidance)).toThrow();
    same(s.attendantMysteries.reception, beforeGuidance.attendantMysteries.reception);
    // The public reception remains usable after the real acquisition event.
    const town = structuredClone(s.attendantMysteries.town);
    s = act(s, { type: 'RECEPTION_WORK' }, old);
    expect([s.cash, s.actionsRemaining]).toEqual([26, 1]);
    same(s.attendantMysteries.town, town);
    s = act(s, { type: 'TOWN', command: { type: 'TRAVEL', to: 'quarry' } }, old);
    expect([s.cash, s.actionsRemaining, s.week]).toEqual([22, 0, 15842]);
    expect(s.attendantMysteries.town!.operatorAt).toBe('quarry');
    expect(s.attendantMysteries.townJournal).toHaveLength(1);
    const journey = s.attendantMysteries.townJournal[0]!;
    same(journey.date, s.date);
    same(s.date, addGameDays(old.date, 21));
    expect(gameDaysBetween(ORIGIN, journey.date)).toBe(7 * (journey.week - 1) + 2);
    const zeroRemainderTown = structuredClone(s);
    zeroRemainderTown.attendantMysteries.townJournal[0]!.date = addGameDays(ORIGIN, 7 * (journey.week - 1));
    expect(validateAttendantMysteriesTown(zeroRemainderTown)).toBe(false);
    expect(() => assertValidSliceState(zeroRemainderTown)).toThrow();
    expect(projectSliceState(s).attendantMysteries.promoted).toBe(false);
  });

  it('rejects extra cash or a wrong date against the latest actual reception snapshot', () => {
    const old = source(), s = act(old, { type: 'RECEPTION_NEXT_WEEK' }, old), before = stableStringify(s);
    expect(s.attendantMysteries.reception.journal.at(-1)!.revision).toBe(s.revision);
    const extraCash = structuredClone(s); extraCash.cash++;
    expect(validateAttendantMysteriesReception(extraCash)).toBe(false);
    expect(() => assertValidSliceState(extraCash)).toThrow();
    const wrongDate = structuredClone(s); wrongDate.date = addGameDays(wrongDate.date, 1);
    expect(validateAttendantMysteriesReception(wrongDate)).toBe(false);
    expect(() => assertValidSliceState(wrongDate)).toThrow();
    expect(stableStringify(s)).toBe(before);
    assertValidSliceState(s);
  });

  it('closes old Miracle Worker commands immediately after new reception use, even before guidance', () => {
    const old = source(), s = act(old, { type: 'RECEPTION_NEXT_WEEK' }, old), before = stableStringify(s);
    expect(s.attendantMysteries.guidanceKnown).toBe(false);
    expect(s.attendantMysteries.reception.origin).not.toBeNull();
    expect(s.actionsRemaining).toBe(4); // Old WORK would otherwise have sufficient AP.
    const oldWork: SliceIntent = { type: 'MIRACLE_WORKER', command: { type: 'WORK' } };
    expect(validateSlicePayload(oldWork)).toBe(true);
    expect(() => applySliceIntent(s, oldWork)).toThrow();
    expect(stableStringify(s)).toBe(before);
    inherited(s, old);
    assertValidSliceState(s);
  });
});
