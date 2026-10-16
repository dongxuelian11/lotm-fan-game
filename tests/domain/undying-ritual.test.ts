import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyUndyingCommand, createUndyingState } from '../../src/domain/undying/index.js';
import type { UndyingAcquisitionCommand } from '../../src/domain/undying/types.js';
import {
  UNDYING_EXPERT_ID, UNDYING_EXPERT_SOURCE, UNDYING_HALL_ID, UNDYING_HALL_SOURCE,
  UNDYING_RITUAL_BOUNDARY, UNDYING_RITUAL_CONSEQUENCE, UNDYING_RITUAL_PRICE,
  applyUndyingRitualCommand, canConsumeUndyingRitual, closeUndyingRitual, createUndyingRitualState,
  currentUndyingVisit, hasUndyingRitualLock, projectUndyingRitual, validateUndyingRitualCommand,
  validateUndyingRitualState, undyingRitualActions, type UndyingRitualCommand,
} from '../../src/domain/undying/ritual.js';

/** Actual S5 replay history with deliberate unit-test week, resources and check stats. */
function gatekeeper(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/gatekeeper-v01040/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior);
  s.activeEvent = null; s.eventQueue = []; s.date = addGameWeeks(s.date, 92 - s.week); s.week = 92; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  s.undying = createUndyingState(); s.undying.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: UndyingRitualCommand) { const c = context(s); applyUndyingRitualCommand(s, command, c); return c; }
function acquire(s: SliceState, command: UndyingAcquisitionCommand, roll = 1) { const c = context(s, roll); applyUndyingCommand(s, command, c); return c; }
function buy(s: SliceState, index = 0) { const bottle = s.undying.bottles[index]!; acquire(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function ready() { const s = gatekeeper(); buy(s); return s; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week += 1; s.date = addGameWeeks(s.date, 1); act(s, { type: 'BEGIN_RITUAL' }); }
function qualify(s: SliceState) { enter(s); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyUndyingRitualCommand(s, command as UndyingRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
}
function rejectDose(s: SliceState, index = 0) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyUndyingCommand(s, { type: 'CONSUME', bottleId: s.undying.bottles[index]!.id, confirmed: true }, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Undying actual professional G preparation and finite original kits', () => {
  it('starts outside with no kit, visit or window, hides unknown knowledge and creates independent state', () => {
    const s = createSliceRun('undying-hidden', sliceDefaultCreationSelection, 'undying-hidden');
    expect(s.undying.ritual).toMatchObject({ playerLocation: 'OUTSIDE', activeVisitId: null, visits: [] });
    expect(s.undying.ritual.expert).toEqual({ id: UNDYING_EXPERT_ID, name: '乔里·埃尔德', age: 67, adultAppearance: true, sequence: 4, source: UNDYING_EXPERT_SOURCE, alive: true, willing: true, location: UNDYING_HALL_ID });
    expect(validateUndyingRitualState(s)).toBe(true); expect(hasUndyingRitualLock(s)).toBe(false); expect(canConsumeUndyingRitual(s)).toBe(false);
    expect(projectUndyingRitual(s)).toMatchObject({ visits: [], expert: null, boundary: '', source: '', consequence: '', currentVisitId: null, windowOpen: false });
    expect(undyingRitualActions(s)).toEqual([]);
    const a = createUndyingRitualState(), b = createUndyingRitualState();
    a.expert.willing = false; a.activeVisitId = 'UDY4-RITUAL-1';
    expect(b.expert.willing).toBe(true); expect(b.activeVisitId).toBeNull(); expect(b.visits).toEqual([]);
  });

  it('actually pays for one next-week appointment and unique original kit held by the supplier', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, expert = structuredClone(s.undying.ritual.expert);
    const c = act(s, { type: 'BOOK_RITUAL' }), visit = currentUndyingVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - UNDYING_RITUAL_PRICE, ap - 1]);
    expect(visit).toMatchObject({ id: 'UDY4-RITUAL-1', source: UNDYING_HALL_SOURCE, hallId: UNDYING_HALL_ID, expertId: UNDYING_EXPERT_ID, paidPennies: 280, status: 'BOOKED', bookedWeek: 92, plannedWeek: 93, enteredWeek: null, preparedWeek: null, preparedById: null, checkedWeek: null, proceedConfirmed: false, windowWeek: null });
    expect(visit.kit).toMatchObject({ id: 'UDY4-KIT-1', location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null });
    expect(visit.kit.source).toContain(visit.kit.id); expect(visit.kit.source).toContain('原创G');
    expect(s.undying.ritual.expert).toEqual(expert); expect(s.undying.ritual.playerLocation).toBe('OUTSIDE');
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(hasUndyingRitualLock(s)).toBe(false); expect(canConsumeUndyingRitual(s)).toBe(false);
    expect(validateUndyingRitualState(s)).toBe(true); reject(s, { type: 'BOOK_RITUAL' });
  });

  it('requires a living guided sequence5 player, actual held bottle, money and one action', () => {
    const s = gatekeeper(); reject(s, { type: 'BOOK_RITUAL' }); buy(s);
    s.undying.guidanceKnown = false; reject(s, { type: 'BOOK_RITUAL' }); s.undying.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'BOOK_RITUAL' }); s.progression.sequence = 5;
    s.cash = 279; reject(s, { type: 'BOOK_RITUAL' }); s.cash = 280;
    s.actionsRemaining = 0; reject(s, { type: 'BOOK_RITUAL' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'BOOK_RITUAL' }); s.health = 100;
    s.mind = 0; reject(s, { type: 'BOOK_RITUAL' }); s.mind = 100;
    s.gatekeeper.practice.marker = 'RECIPIENT'; reject(s, { type: 'BOOK_RITUAL' }); s.gatekeeper.practice.marker = 'DESK';
    s.gatekeeper.practice.gateOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.gatekeeper.practice.gateOpen = false;
    s.gatekeeper.cases['resting-place']!.contactOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.gatekeeper.cases['resting-place']!.contactOpen = false;
    const status = s.gatekeeper.cases['shared-task']!.status; s.gatekeeper.cases['shared-task']!.status = 'PREPARED'; reject(s, { type: 'BOOK_RITUAL' }); s.gatekeeper.cases['shared-task']!.status = status;
    act(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('requires the next real week and an actual one-action visit; the expert is not teleported', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const expert = structuredClone(s.undying.ritual.expert);
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'CHECK_PREPARATION', confirmed: true }); rejectDose(s);
    expect(hasUndyingRitualLock(s)).toBe(false);
    s.week += 1; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 0; reject(s, { type: 'BEGIN_RITUAL' }); s.actionsRemaining = 1;
    const cash = s.cash, c = act(s, { type: 'BEGIN_RITUAL' }), visit = currentUndyingVisit(s)!;
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(visit).toMatchObject({ status: 'OPEN', enteredWeek: 93, preparedWeek: 93, preparedById: UNDYING_EXPERT_ID, checkedWeek: null, windowWeek: null });
    expect(visit.kit).toMatchObject({ location: 'TABLE', status: 'SEALED', sealsIntact: true });
    expect(s.undying.ritual.playerLocation).toBe('HALL'); expect(s.undying.ritual.expert).toEqual(expert);
    expect(hasUndyingRitualLock(s)).toBe(true); expect(canConsumeUndyingRitual(s)).toBe(false);
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(validateUndyingRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('opens only an explicitly confirmed current-week preparation window without rolls or free resources', () => {
    const s = ready(); enter(s); const kit = structuredClone(currentUndyingVisit(s)!.kit), resources = [s.cash, s.health, s.mind, s.spirituality];
    s.actionsRemaining = 0;
    for (const command of [{ type: 'CHECK_PREPARATION' }, { type: 'CHECK_PREPARATION', confirmed: false }, { type: 'CHECK_PREPARATION', confirmed: 'true' }, { type: 'CHECK_PREPARATION', confirmed: true, expertWilling: true }]) reject(s, command);
    const c = act(s, { type: 'CHECK_PREPARATION', confirmed: true }), visit = currentUndyingVisit(s)!;
    expect(visit).toMatchObject({ checkedWeek: s.week, proceedConfirmed: true, windowWeek: s.week });
    expect(visit.kit).toEqual(kit); expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.undying.bottles[0]!.status).toBe('PLAYER'); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(UNDYING_RITUAL_BOUNDARY));
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(UNDYING_RITUAL_CONSEQUENCE));
    expect(canConsumeUndyingRitual(s)).toBe(true); expect(validateUndyingRitualState(s)).toBe(true);
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
  });

  it.each(['BOOKED', 'ENTERED', 'CHECKED'] as const)('allows zero-action exit from %s without refund, moving the expert or giving the unused kit to the player', stage => {
    const s = ready();
    if (stage === 'BOOKED') act(s, { type: 'BOOK_RITUAL' }); else if (stage === 'ENTERED') enter(s); else qualify(s);
    const visit = currentUndyingVisit(s)!, kit = structuredClone(visit.kit), expert = structuredClone(s.undying.ritual.expert), bottle = structuredClone(s.undying.bottles[0]);
    s.actionsRemaining = 0; s.health = 59; s.mind = 67; const resources = [s.cash, s.health, s.mind, s.spirituality];
    const action = undyingRitualActions(s).find(value => ['END_RITUAL', 'CANCEL_RITUAL'].includes(value.command.type)); expect(action?.enabled).toBe(true);
    act(s, { type: stage === 'BOOKED' ? 'CANCEL_RITUAL' : 'END_RITUAL' });
    expect(visit.status).toBe(stage === 'BOOKED' ? 'CANCELLED' : 'CLOSED'); expect(visit.closedWeek).toBe(s.week);
    expect(visit.kit).toEqual(kit); expect(s.undying.ritual.expert).toEqual(expert); expect(s.undying.bottles[0]).toEqual(bottle);
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.undying.ritual.playerLocation).toBe('OUTSIDE'); expect(s.undying.ritual.activeVisitId).toBeNull();
    expect(hasUndyingRitualLock(s)).toBe(false); expect(canConsumeUndyingRitual(s)).toBe(false); expect(validateUndyingRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('never restores health, mind or a missing expert as part of a zero-action safety exit', () => {
    const s = ready(); qualify(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    s.undying.ritual.expert.alive = false; s.undying.ritual.expert.willing = false; s.undying.ritual.expert.location = 'AWAY';
    expect(undyingRitualActions(s).find(value => value.command.type === 'END_RITUAL')?.enabled).toBe(true);
    act(s, { type: 'END_RITUAL' });
    expect([s.actionsRemaining, s.health, s.mind]).toEqual([0, 0, 0]);
    expect(s.undying.ritual.expert).toMatchObject({ alive: false, willing: false, location: 'AWAY' });
    expect(hasUndyingRitualLock(s)).toBe(false);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('preserves current %s facts and refuses actual entry, while cancellation remains available', change => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week += 1; s.date = addGameWeeks(s.date, 1);
    if (change === 'dead') s.undying.ritual.expert.alive = false;
    if (change === 'unwilling') s.undying.ritual.expert.willing = false;
    if (change === 'away') s.undying.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') currentUndyingVisit(s)!.kit.location = 'MISSING';
    if (change === 'broken-seals') currentUndyingVisit(s)!.kit.sealsIntact = false;
    expect(validateUndyingRitualState(s)).toBe(true); reject(s, { type: 'BEGIN_RITUAL' });
    const expert = structuredClone(s.undying.ritual.expert), kit = structuredClone(currentUndyingVisit(s)!.kit);
    s.actionsRemaining = 0; act(s, { type: 'CANCEL_RITUAL' });
    expect(s.undying.ritual.expert).toEqual(expert); expect(s.undying.ritual.visits[0]!.kit).toEqual(kit);
    expect(validateUndyingRitualState(s)).toBe(true);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('rechecks %s at both preparation confirmation and potion consumption, preserving past actual entry', change => {
    const s = ready(); qualify(s); const visit = currentUndyingVisit(s)!;
    if (change === 'dead') s.undying.ritual.expert.alive = false;
    if (change === 'unwilling') s.undying.ritual.expert.willing = false;
    if (change === 'away') s.undying.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') visit.kit.location = 'MISSING';
    if (change === 'broken-seals') visit.kit.sealsIntact = false;
    expect(canConsumeUndyingRitual(s)).toBe(false); expect(validateUndyingRitualState(s)).toBe(true); rejectDose(s);
    visit.checkedWeek = null; visit.proceedConfirmed = false; visit.windowWeek = null;
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
    const history = structuredClone(visit); act(s, { type: 'END_RITUAL' });
    expect(visit.enteredWeek).toBe(history.enteredWeek); expect(visit.preparedWeek).toBe(history.preparedWeek); expect(visit.kit).toEqual(history.kit);
    expect(validateUndyingRitualState(s)).toBe(true);
  });

  it('pays for a distinct new original kit and another actual week after canceling or leaving an old unused one', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const old = structuredClone(s.undying.ritual.visits[0]), cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'BOOK_RITUAL' }); const next = currentUndyingVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 280, ap - 1]);
    expect(next.id).toBe('UDY4-RITUAL-2'); expect(next.kit.id).toBe('UDY4-KIT-2'); expect(next.kit.location).toBe('SUPPLIER');
    expect(next.plannedWeek).toBe(s.week + 1); expect(s.undying.ritual.visits[0]).toEqual(old);
    expect(hasUndyingRitualLock(s)).toBe(false); reject(s, { type: 'BEGIN_RITUAL' });
    s.week += 1; s.date = addGameWeeks(s.date, 1); act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(canConsumeUndyingRitual(s)).toBe(true); expect(s.undying.ritual.visits[0]).toEqual(old); expect(validateUndyingRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 4], [30, 'SUCCESS', 4], [90, 'FAILURE', 5], [100, 'GREAT_FAILURE', 5]] as const)(
    'potion roll %s consumes the original kit and bottle on %s, but requires explicit zero-action walkout', (roll, tier, sequence) => {
      const s = ready(); qualify(s); s.actionsRemaining = 0;
      const visit = currentUndyingVisit(s)!, expert = structuredClone(s.undying.ritual.expert), bottle = s.undying.bottles[0]!, source = visit.kit.source;
      const c = acquire(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledTimes(1); expect(c.check).toHaveBeenCalledWith('will', 28);
      expect(s.progression.sequence).toBe(sequence); expect(s.actionsRemaining).toBe(0);
      expect(bottle).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: visit.id, ritualWindowWeek: s.week });
      expect(visit).toMatchObject({ status: 'OPEN', consumedBottleId: bottle.id, closedWeek: null });
      expect(visit.kit).toEqual({ id: 'UDY4-KIT-1', source, status: 'CONSUMED', location: 'TABLE', sealsIntact: false, consumedWeek: s.week });
      expect(s.undying.ritual.expert).toEqual(expert); expect(s.undying.ritual.playerLocation).toBe('HALL');
      expect(canConsumeUndyingRitual(s)).toBe(false); expect(hasUndyingRitualLock(s)).toBe(true); expect(validateUndyingRitualState(s)).toBe(true);
      expect(undyingRitualActions(s).find(a => a.command.type === 'END_RITUAL')?.enabled).toBe(true);
      act(s, { type: 'END_RITUAL' }); expect(s.undying.ritual.playerLocation).toBe('OUTSIDE'); expect(visit.closedWeek).toBe(s.week);
      expect(hasUndyingRitualLock(s)).toBe(false); expect(validateUndyingRitualState(s)).toBe(true);
      if (sequence === 5) {
        buy(s, 1); rejectDose(s, 1); s.actionsRemaining = 1; const history = structuredClone(visit);
        act(s, { type: 'BOOK_RITUAL' }); expect(currentUndyingVisit(s)!.kit.id).toBe('UDY4-KIT-2');
        expect(s.undying.ritual.visits[0]).toEqual(history); reject(s, { type: 'BEGIN_RITUAL' });
      }
    },
  );

  it('preserves all original Death history and the same resting gray feather through preparation and promotion', () => {
    const s = ready(), original = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide, s.gatekeeper]);
    const gender = s.character.gender;
    qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.undying.bottles[0]!.id, confirmed: true });
    expect(s.progression.sequence).toBe(4);
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide, s.gatekeeper]).toEqual(original);
    expect(s.character.gender).toBe(gender);
    expect(s.gatekeeper.companion).toMatchObject({ source: 'SG6-GRAY-FEATHER', status: 'INSIDE', entries: 2, releases: 1, deployments: 2, recalls: 2, feePaid: 24 });
    expect(s.gatekeeper.practice).toMatchObject({ marker: 'DESK', gateOpen: false });
    act(s, { type: 'END_RITUAL' });
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide, s.gatekeeper]).toEqual(original);
  });

  it('cannot claim actual kit consumption just by supplying an unconsumed or differently bound bottle ID', () => {
    const s = ready(); qualify(s); const bottle = s.undying.bottles[0]!, before = structuredClone(s);
    expect(() => closeUndyingRitual(s, bottle.id)).toThrow(); expect(s).toEqual(before);
    bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.ritualId = 'UDY4-RITUAL-999'; bottle.ritualWindowWeek = s.week;
    const wrongBinding = structuredClone(s); expect(() => closeUndyingRitual(s, bottle.id)).toThrow(); expect(s).toEqual(wrongBinding);
    expect(currentUndyingVisit(s)!.kit.status).toBe('SEALED');
  });

  it.each(['past-week', 'outside', 'different-city', 'no-consent', 'no-check', 'not-prepared', 'wrong-expert', 'wrong-kit', 'wrong-source'] as const)(
    'refuses stale or forged current preparation: %s', change => {
      const s = ready(); qualify(s); const visit = currentUndyingVisit(s)!;
      if (change === 'past-week') { s.week += 1; s.date = addGameWeeks(s.date, 1); }
      if (change === 'outside') s.undying.ritual.playerLocation = 'OUTSIDE';
      if (change === 'different-city') s.world.city = 'ELSEWHERE';
      if (change === 'no-consent') visit.proceedConfirmed = false;
      if (change === 'no-check') visit.checkedWeek = null;
      if (change === 'not-prepared') visit.preparedWeek = null;
      if (change === 'wrong-expert') visit.preparedById = 'EVELYN';
      if (change === 'wrong-kit') visit.kit.id = 'UDY4-KIT-OLD';
      if (change === 'wrong-source') visit.kit.source = 'free replacement from nowhere';
      expect(canConsumeUndyingRitual(s)).toBe(false); expect(validateUndyingRitualState(s)).toBe(false); rejectDose(s);
    },
  );

  it('keeps closed history valid when the expert later dies, withdraws consent or leaves his hall', () => {
    const s = ready(); qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.undying.bottles[0]!.id, confirmed: true });
    act(s, { type: 'END_RITUAL' });
    const history = structuredClone(s.undying.ritual.visits);
    s.undying.ritual.expert.alive = false; s.undying.ritual.expert.willing = false; s.undying.ritual.expert.location = 'AWAY';
    expect(validateUndyingRitualState(s)).toBe(true); expect(s.undying.ritual.visits).toEqual(history);
    expect(projectUndyingRitual(s).expert).toMatchObject({ alive: false, willing: false });
    expect(projectUndyingRitual(s).visits[0]!.summary).toContain('过往到场记录不证明');
    expect(projectUndyingRitual(s).visits[0]!.summary).toContain('均已实际耗尽');
  });

  it('serializes sourceful history and rejects forged prices, duplicate kits, reverse dates and hidden extra fields', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateUndyingRitualState(restored)).toBe(true);
    for (const change of [
      (v: SliceState) => { v.undying.ritual.expert.source = 'assumed powerful Evelyn'; },
      (v: SliceState) => { v.undying.ritual.expert.age = 14; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.paidPennies = 0; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.plannedWeek = 92; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.preparedWeek = 92; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.closedWeek = 94; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.kit.status = 'CONSUMED'; },
      (v: SliceState) => { v.undying.ritual.visits[0]!.consumedBottleId = v.undying.bottles[0]!.id; },
      (v: SliceState) => { Object.assign(v.undying.ritual.visits[0]!, { freeRitual: true }); },
      (v: SliceState) => { Object.assign(v.undying.ritual.visits[0]!, { kit: null }); },
    ]) { const invalid = structuredClone(restored); change(invalid); expect(validateUndyingRitualState(invalid)).toBe(false); }
    act(s, { type: 'BOOK_RITUAL' }); currentUndyingVisit(s)!.kit.id = 'UDY4-KIT-1'; expect(validateUndyingRitualState(s)).toBe(false);
  });

  it('states the unknown complete canon ritual, G workflow, independent original expert and non-bypass boundary', () => {
    const s = ready(); enter(s); const view = projectUndyingRitual(s);
    expect(view.boundary).toBe(UNDYING_RITUAL_BOUNDARY); expect(view.boundary).toContain('完整配方与完整仪式步骤尚未核实');
    expect(view.boundary).toContain('方案G'); expect(view.boundary).toContain('不声称不死者免仪式'); expect(view.consequence).toBe(UNDYING_RITUAL_CONSEQUENCE);
    expect(view.expert).toMatchObject({ id: UNDYING_EXPERT_ID, age: 67, sequence: 4, adultAppearance: true }); expect(view.expert!.source).toContain('不把伊芙琳推定为半神');
    expect(view.boundary).toContain('不是实际死亡演练'); expect(view.boundary).toContain('是否已经历以当前实际保存记录为准'); expect(view.boundary).toContain('六十年负担');
    view.expert!.willing = false; view.visits[0]!.kit.source = 'mutated projection';
    expect(s.undying.ritual.expert.willing).toBe(true); expect(currentUndyingVisit(s)!.kit.source).not.toBe('mutated projection');
    for (const action of undyingRitualActions(s)) expect(validateUndyingRitualCommand(action.command)).toBe(true);
    for (const command of [{ type: 'SUMMON_EXPERT' }, { type: 'SET_EXPERT', willing: true }, { type: 'BOOK_RITUAL', kitId: 'old' }, { type: 'BEGIN_RITUAL', location: UNDYING_HALL_ID }, { type: 'CONSUME_KIT' }, null, []]) expect(validateUndyingRitualCommand(command)).toBe(false);
  });
});
