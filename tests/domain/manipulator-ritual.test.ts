import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyManipulatorCommand, createManipulatorState } from '../../src/domain/manipulator/index.js';
import { MANIPULATOR_DONOR_IDS, type ManipulatorAcquisitionCommand } from '../../src/domain/manipulator/types.js';
import {
  MANIPULATOR_DISTRICTS, MANIPULATOR_GROUP_IDS, applyManipulatorRitualCommand,
  canConsumeManipulatorRitual, closeManipulatorRitual, createManipulatorRitualState,
  currentManipulatorGathering, hasManipulatorRitualLock, manipulatorRitualActions,
  projectManipulatorRitual, validateManipulatorRitualCommand, validateManipulatorRitualState,
  type ManipulatorRitualCommand,
} from '../../src/domain/manipulator/ritual.js';

/** Explicit prior S5 fixture, not a claim to a natural previous-path playthrough. */
function dreamwalker(): SliceState {
  const s = createSliceRun('manipulator-ritual-fixture', sliceDefaultCreationSelection, 'manipulator-ritual-fixture');
  s.activeEvent = null; s.eventQueue = []; s.week = 43; s.cash = 50000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.audience.discovered = true; s.dreamwalker.guidanceKnown = true; s.dreamwalker.promotionWeek = 31;
  s.progression.pathwayId = 'audience'; s.progression.sequence = 5; s.progression.acting = 100;
  s.character.coreStats.knowledge = 25; s.character.coreStats.will = 25;
  s.manipulator = createManipulatorState(); s.manipulator.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ManipulatorRitualCommand, roll = 1) {
  const c = context(s, roll); applyManipulatorRitualCommand(s, command, c); return c;
}
function acquire(s: SliceState, command: ManipulatorAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyManipulatorCommand(s, command, c); return c;
}
/** The new bottle is actually built by acquisition commands, with seven original donor events. */
function bottle(s: SliceState, index = 0) {
  const batch = s.manipulator.batches[index]!;
  acquire(s, { type: 'BUY_MATERIALS', batchId: batch.id });
  for (const donorId of MANIPULATOR_DONOR_IDS) acquire(s, { type: 'COLLECT_TEAR', batchId: batch.id, donorId });
  acquire(s, { type: 'BREW', batchId: batch.id });
  return s.manipulator.bottles.at(-1)!;
}
function prepared() { const s = dreamwalker(); bottle(s); return s; }
function open(s: SliceState) { apply(s, { type: 'BOOK_GATHERING' }); s.week += 1; apply(s, { type: 'OPEN_GATHERING' }); }
function arrivals(s: SliceState, rolls: readonly number[] = [1, 1, 1, 1]) {
  for (const [i, groupId] of MANIPULATOR_GROUP_IDS.entries()) apply(s, { type: 'ARRIVE_GROUP', groupId }, rolls[i]);
}
function qualify(s: SliceState) { open(s); arrivals(s); apply(s, { type: 'RESONATE' }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyManipulatorRitualCommand(s, command as ManipulatorRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Manipulator original four-district gathering and current 10000-person window', () => {
  it('creates independent empty rituals and never counts a paid invitation as attendance', () => {
    const s = prepared(), another = createManipulatorRitualState(), cash = s.cash, ap = s.actionsRemaining;
    expect(validateManipulatorRitualState(s)).toBe(true);
    apply(s, { type: 'BOOK_GATHERING' });
    const g = currentManipulatorGathering(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(g).toMatchObject({ id: 'manipulator-gathering-1', status: 'BOOKED', bookedWeek: 43, plannedWeek: 44, startedWeek: null, windowWeek: null });
    expect(g.groups.map(group => group.id)).toEqual(MANIPULATOR_GROUP_IDS);
    expect(new Set(g.groups.map(group => group.source)).size).toBe(4);
    expect(g.groups.every(group => group.registeredCount === 3000 && group.location === 'HOME' && group.presentCount === 0 && group.arrivedCount === 0)).toBe(true);
    expect(another.gatherings).toEqual([]); expect(hasManipulatorRitualLock(s)).toBe(false); expect(canConsumeManipulatorRitual(s)).toBe(false);
    expect(projectManipulatorRitual(s)).toMatchObject({ actualPresent: 0, registeredCount: 12000, requiredCount: 10000, windowOpen: false });
    expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('requires a living guided Dreamwalker with an actual bottle, enough AP and real booking funds', () => {
    const s = dreamwalker(); reject(s, { type: 'BOOK_GATHERING' }); bottle(s);
    s.manipulator.guidanceKnown = false; reject(s, { type: 'BOOK_GATHERING' }); s.manipulator.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'BOOK_GATHERING' }); s.progression.sequence = 5;
    s.cash = 239; reject(s, { type: 'BOOK_GATHERING' }); s.cash = 240;
    s.actionsRemaining = 0; reject(s, { type: 'BOOK_GATHERING' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'BOOK_GATHERING' }); s.health = 100;
    apply(s, { type: 'BOOK_GATHERING' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
    reject(s, { type: 'BOOK_GATHERING' });
  });

  it('waits an actual next week before the paid opening and then reserves a bounded free service', () => {
    const s = prepared(); apply(s, { type: 'BOOK_GATHERING' }); reject(s, { type: 'OPEN_GATHERING' });
    reject(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-NORTH' }); reject(s, { type: 'RESONATE' });
    s.week += 1; s.actionsRemaining = 0; reject(s, { type: 'OPEN_GATHERING' });
    s.actionsRemaining = 1; const cash = s.cash; apply(s, { type: 'OPEN_GATHERING' });
    expect(s.actionsRemaining).toBe(0); expect(s.cash).toBe(cash); expect(hasManipulatorRitualLock(s)).toBe(true);
    expect(s.manipulator.ritual.playerLocation).toBe('HALL'); expect(projectManipulatorRitual(s).actualPresent).toBe(0);
    reject(s, { type: 'OPEN_GATHERING' });
    arrivals(s); apply(s, { type: 'RESONATE' }); expect(s.actionsRemaining).toBe(0);
    expect(canConsumeManipulatorRitual(s)).toBe(true); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 3000], [30, 'SUCCESS', 3000], [90, 'FAILURE', 1800], [100, 'GREAT_FAILURE', 1200]] as const)(
    'records actual knowledge12 arrival tier %s with original count and people remaining home', (roll, tier, count) => {
      const s = prepared(); open(s); const ap = s.actionsRemaining, cash = s.cash;
      const c = apply(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-NORTH' }, roll), g = currentManipulatorGathering(s)!;
      expect(c.check).toHaveBeenCalledWith('knowledge', 12);
      expect(g.groups[0]).toMatchObject({ registeredCount: 3000, arrivalWeek: s.week, arrivalOutcome: tier, arrivedCount: count, presentCount: count, location: 'HALL', emotion: 'CALM', source: MANIPULATOR_DISTRICTS[0].source });
      expect(g.groups.slice(1).every(group => group.location === 'HOME' && group.presentCount === 0)).toBe(true);
      expect([s.actionsRemaining, s.cash]).toEqual([ap, cash]); expect(projectManipulatorRitual(s).actualPresent).toBe(count);
      reject(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-NORTH' }); expect(validateManipulatorRitualState(s)).toBe(true);
    },
  );

  it('cannot tell the once-per-event common story until all four actual delegations have arrived', () => {
    const s = prepared(); open(s);
    for (const groupId of MANIPULATOR_GROUP_IDS.slice(0, 3)) apply(s, { type: 'ARRIVE_GROUP', groupId });
    reject(s, { type: 'RESONATE' }); apply(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-WEST' });
    const c = apply(s, { type: 'RESONATE' }, 30); expect(c.check).toHaveBeenCalledWith('will', 14);
    expect(currentManipulatorGathering(s)).toMatchObject({ resonanceAttemptWeek: s.week, resonanceOutcome: 'SUCCESS', windowWeek: s.week, commonEmotion: 'REMEMBRANCE_AND_SOLIDARITY' });
    expect(currentManipulatorGathering(s)!.groups.every(group => group.emotion === 'RESONANT')).toBe(true);
    reject(s, { type: 'RESONATE' }); reject(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-WEST' });
  });

  it('uses real 10200 bodies rather than requiring a perfect roll or mistaking registration for presence', () => {
    const s = prepared(); open(s); arrivals(s, [30, 30, 30, 100]); apply(s, { type: 'RESONATE' }, 30);
    expect(projectManipulatorRitual(s)).toMatchObject({ actualPresent: 10200, registeredCount: 12000, windowOpen: true });
    expect(canConsumeManipulatorRitual(s)).toBe(true); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('cannot open a window with 9600 actual people, even when all present residents share strong emotion', () => {
    const s = prepared(); open(s); arrivals(s, [30, 30, 90, 90]); s.actionsRemaining = 0;
    apply(s, { type: 'RESONATE' }); const g = currentManipulatorGathering(s)!;
    expect(g.groups.every(group => group.emotion === 'RESONANT')).toBe(true);
    expect(projectManipulatorRitual(s)).toMatchObject({ actualPresent: 9600, registeredCount: 12000, windowOpen: false });
    expect(g.windowWeek).toBeNull(); expect(canConsumeManipulatorRitual(s)).toBe(false);
    const original = structuredClone(s.manipulator.bottles[0]);
    expect(() => acquire(s, { type: 'CONSUME', bottleId: original.id, confirmed: true })).toThrow();
    expect(s.manipulator.bottles[0]).toEqual(original); expect(validateManipulatorRitualState(s)).toBe(true);
    apply(s, { type: 'LEAVE_GATHERING' }); expect(s.actionsRemaining).toBe(0); expect(hasManipulatorRitualLock(s)).toBe(false);
    expect(g.groups.every(group => group.location === 'HOME' && group.presentCount === 0 && group.returnedWeek === s.week)).toBe(true);
    expect(g.groups.map(group => group.arrivedCount)).toEqual([3000, 3000, 1800, 1800]);
  });

  it.each([90, 100])('retains all actual arrivals but opens no emotional window on failed story %s', roll => {
    const s = prepared(); open(s); arrivals(s); apply(s, { type: 'RESONATE' }, roll);
    expect(projectManipulatorRitual(s)).toMatchObject({ actualPresent: 12000, windowOpen: false });
    expect(currentManipulatorGathering(s)!.groups.every(group => group.emotion === 'CALM')).toBe(true);
    reject(s, { type: 'RESONATE' }); s.actionsRemaining = 0; apply(s, { type: 'LEAVE_GATHERING' });
    expect(s.manipulator.bottles[0]!.status).toBe('PLAYER'); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('cancels a booked gathering at zero AP without arrivals, refunds or resource recovery', () => {
    const s = prepared(); apply(s, { type: 'BOOK_GATHERING' }); s.actionsRemaining = 0; s.health = 57; s.mind = 64;
    const cash = s.cash, original = structuredClone(s.manipulator.bottles), g = currentManipulatorGathering(s)!;
    apply(s, { type: 'LEAVE_GATHERING' });
    expect([s.cash, s.actionsRemaining, s.health, s.mind]).toEqual([cash, 0, 57, 64]);
    expect(g).toMatchObject({ status: 'CANCELLED', startedWeek: null, closedWeek: s.week, consumedBottleId: null });
    expect(g.groups.every(group => group.location === 'HOME' && group.arrivalWeek === null && group.returnedWeek === null)).toBe(true);
    expect(s.manipulator.bottles).toEqual(original); expect(s.manipulator.ritual.activeGatheringId).toBeNull();
    reject(s, { type: 'LEAVE_GATHERING' }); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('lets a partially arrived gathering physically leave, and historical peaks never open the next event', () => {
    const s = prepared(); qualify(s); const first = currentManipulatorGathering(s)!;
    apply(s, { type: 'LEAVE_GATHERING' }); const history = structuredClone(first);
    expect(canConsumeManipulatorRitual(s)).toBe(false); expect(projectManipulatorRitual(s).actualPresent).toBe(0);
    expect(projectManipulatorRitual(s).groups.every(group => group.arrivedCount === 3000 && group.presentCount === 0)).toBe(true);
    apply(s, { type: 'BOOK_GATHERING' }); expect(currentManipulatorGathering(s)!.id).toBe('manipulator-gathering-2');
    reject(s, { type: 'OPEN_GATHERING' }); s.week += 1; apply(s, { type: 'OPEN_GATHERING' });
    apply(s, { type: 'ARRIVE_GROUP', groupId: 'MP4-NORTH' }, 90); s.actionsRemaining = 0; apply(s, { type: 'LEAVE_GATHERING' });
    expect(s.manipulator.ritual.gatherings[0]).toEqual(history);
    expect(s.manipulator.ritual.gatherings[1]!.groups.map(group => group.returnedWeek)).toEqual([s.week, null, null, null]);
    expect(canConsumeManipulatorRitual(s)).toBe(false); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('consumes only an original bottle in this event and returns every group after failed potion at zero AP', () => {
    const s = prepared(), firstBottle = s.manipulator.bottles[0]!; bottle(s, 1); qualify(s);
    const first = currentManipulatorGathering(s)!; s.actionsRemaining = 0; const cash = s.cash;
    acquire(s, { type: 'CONSUME', bottleId: firstBottle.id, confirmed: true }, 100);
    expect(firstBottle).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE', consumedWeek: s.week, ritualId: first.id, ritualWindowWeek: s.week });
    expect(first).toMatchObject({ status: 'CLOSED', consumedBottleId: firstBottle.id, closedWeek: s.week, windowWeek: s.week });
    expect(first.groups.every(group => group.arrivedCount === 3000 && group.presentCount === 0 && group.location === 'HOME' && group.returnedWeek === s.week)).toBe(true);
    expect([s.actionsRemaining, s.cash, s.progression.sequence, s.health, s.mind]).toEqual([0, cash, 5, 75, 55]);
    expect(hasManipulatorRitualLock(s)).toBe(false); expect(canConsumeManipulatorRitual(s)).toBe(false);
    expect(() => acquire(s, { type: 'CONSUME', bottleId: s.manipulator.bottles[1]!.id, confirmed: true })).toThrow();
    expect(validateManipulatorRitualState(s)).toBe(true);
    s.actionsRemaining = 2; apply(s, { type: 'BOOK_GATHERING' }); reject(s, { type: 'OPEN_GATHERING' });
    s.week += 1; apply(s, { type: 'OPEN_GATHERING' }); expect(projectManipulatorRitual(s).actualPresent).toBe(0);
    expect(first.consumedBottleId).toBe(firstBottle.id); expect(currentManipulatorGathering(s)!.id).not.toBe(first.id);
  });

  it('closes and returns everyone after successful promotion without requiring a new AP or refilling spirituality', () => {
    const s = prepared(); qualify(s); s.actionsRemaining = 0; const g = currentManipulatorGathering(s)!;
    acquire(s, { type: 'CONSUME', bottleId: s.manipulator.bottles[0]!.id, confirmed: true });
    expect([s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([4, 31, 0]);
    expect(g.status).toBe('CLOSED'); expect(s.manipulator.ritual.playerLocation).toBe('OUTSIDE');
    expect(g.groups.every(group => group.location === 'HOME' && group.presentCount === 0)).toBe(true);
    expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('rejects stale week, wrong hall, absent player, lost presence or changed emotion without mutating original state', () => {
    const s = prepared(); qualify(s);
    const changes: ((copy: SliceState) => void)[] = [
      copy => { copy.week += 1; }, copy => { copy.manipulator.ritual.playerLocation = 'OUTSIDE'; },
      copy => { currentManipulatorGathering(copy)!.venueId = 'different-hall'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.location = 'HOME'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.presentCount = 0; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.emotion = 'CALM'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.returnedWeek = copy.week; },
      copy => { copy.health = 0; }, copy => { copy.mind = 0; },
    ];
    for (const change of changes) { const copy = structuredClone(s); change(copy); expect(canConsumeManipulatorRitual(copy)).toBe(false); expect(validateManipulatorRitualState(copy)).toBe(false); }
    expect(canConsumeManipulatorRitual(s)).toBe(true);
  });

  it('validates source identity, disjoint original groups, actual tiers and immutable closed-event chronology', () => {
    const s = prepared(); qualify(s);
    const changes: ((copy: SliceState) => void)[] = [
      copy => { currentManipulatorGathering(copy)!.groups[1]!.id = 'MP4-NORTH'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.source = 'purchased list'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.registeredCount = 99999; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.arrivalOutcome = 'FAILURE'; },
      copy => { currentManipulatorGathering(copy)!.groups[0]!.arrivalWeek! -= 1; },
      copy => { currentManipulatorGathering(copy)!.plannedWeek -= 1; },
      copy => { currentManipulatorGathering(copy)!.resonanceOutcome = 'FAILURE'; },
      copy => { currentManipulatorGathering(copy)!.windowWeek! -= 1; },
      copy => { currentManipulatorGathering(copy)!.consumedBottleId = 'free-potion'; },
      copy => { copy.manipulator.ritual.activeGatheringId = 'manipulator-gathering-99'; },
    ];
    for (const change of changes) { const copy = structuredClone(s); change(copy); expect(validateManipulatorRitualState(copy)).toBe(false); }
    apply(s, { type: 'LEAVE_GATHERING' }); expect(validateManipulatorRitualState(s)).toBe(true);
    s.manipulator.ritual.gatherings[0]!.closedWeek! -= 1; expect(validateManipulatorRitualState(s)).toBe(false);
  });

  it('does not allow the internal close helper to claim a fake or unconsumed bottle', () => {
    const s = prepared(); qualify(s); const before = structuredClone(s);
    expect(() => closeManipulatorRitual(s, 'purchased-list-potion')).toThrow(); expect(s).toEqual(before);
    expect(() => closeManipulatorRitual(s, s.manipulator.bottles[0]!.id)).toThrow(); expect(s).toEqual(before);
    closeManipulatorRitual(s, null); expect(hasManipulatorRitualLock(s)).toBe(false); expect(validateManipulatorRitualState(s)).toBe(true);
  });

  it('only accepts bounded intents and exposes zero-AP exit while rejecting arbitrary attendance setters', () => {
    const s = prepared(); open(s); s.actionsRemaining = 0;
    for (const value of [null, { type: 'SET_ATTENDANCE', count: 10000 }, { type: 'ARRIVE_GROUP', groupId: 'purchased-list' }, { type: 'ARRIVE_GROUP', groupId: 'MP4-NORTH', presentCount: 3000 }, { type: 'RESONATE', result: 'SUCCESS' }, { type: 'BOOK_GATHERING', plannedWeek: s.week }]) {
      expect(validateManipulatorRitualCommand(value)).toBe(false); reject(s, value);
    }
    const actions = manipulatorRitualActions(s);
    expect(actions.find(action => action.command.type === 'LEAVE_GATHERING')).toMatchObject({ enabled: true, reason: null });
    expect(actions.filter(action => action.command.type === 'ARRIVE_GROUP').every(action => action.enabled && action.cost.startsWith('0行动'))).toBe(true);
    expect(actions.find(action => action.command.type === 'RESONATE')!.enabled).toBe(false);
    expect(validateManipulatorRitualState(s)).toBe(true);
  });
});
