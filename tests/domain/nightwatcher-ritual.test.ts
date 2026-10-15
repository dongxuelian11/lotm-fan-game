import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyNightwatcherCommand, createNightwatcherState } from '../../src/domain/nightwatcher/index.js';
import type { NightwatcherAcquisitionCommand } from '../../src/domain/nightwatcher/types.js';
import {
  NIGHTWATCHER_EXPERT_ID, NIGHTWATCHER_EXPERT_SOURCE, NIGHTWATCHER_HALL_ID, NIGHTWATCHER_HALL_SOURCE,
  NIGHTWATCHER_RITUAL_BOUNDARY, NIGHTWATCHER_RITUAL_CONSEQUENCE, NIGHTWATCHER_RITUAL_PRICE,
  applyNightwatcherRitualCommand, canConsumeNightwatcherRitual, closeNightwatcherRitual, createNightwatcherRitualState,
  currentNightwatcherVisit, hasNightwatcherRitualLock, projectNightwatcherRitual, validateNightwatcherRitualCommand,
  validateNightwatcherRitualState, nightwatcherRitualActions, type NightwatcherRitualCommand,
} from '../../src/domain/nightwatcher/ritual.js';

/** Deliberate prior-S5 unit fixture; natural chronological play is exercised by the shared replay. */
function warlock(): SliceState {
  const s = createSliceRun('nightwatcher-ritual-unit', sliceDefaultCreationSelection, 'nightwatcher-ritual-unit');
  s.activeEvent = null; s.eventQueue = []; s.week = 77; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.sleepless.discovered = true; s.sleepless.guidanceKnown = true; s.midnight.guidanceKnown = true;
  s.nightmare.guidanceKnown = true; s.soother.guidanceKnown = true; s.soother.promotionWeek = 45;
  s.spiritWarlock.guidanceKnown = true; s.spiritWarlock.promotionWeek = 65;
  s.progression.pathwayId = 'darkness'; s.progression.sequence = 5; s.progression.acting = 100;
  s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  s.nightwatcher = createNightwatcherState(); s.nightwatcher.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: NightwatcherRitualCommand) { const c = context(s); applyNightwatcherRitualCommand(s, command, c); return c; }
function acquire(s: SliceState, command: NightwatcherAcquisitionCommand, roll = 1) { const c = context(s, roll); applyNightwatcherCommand(s, command, c); return c; }
function buy(s: SliceState, index = 0) { const bottle = s.nightwatcher.bottles[index]!; acquire(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function ready() { const s = warlock(); buy(s); return s; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); }
function qualify(s: SliceState) { enter(s); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyNightwatcherRitualCommand(s, command as NightwatcherRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
}
function rejectDose(s: SliceState, index = 0) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyNightwatcherCommand(s, { type: 'CONSUME', bottleId: s.nightwatcher.bottles[index]!.id, confirmed: true }, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Nightwatcher actual professional G preparation and finite original kits', () => {
  it('starts outside with no kit, visit or window, hides unknown knowledge and creates independent state', () => {
    const s = createSliceRun('nightwatcher-hidden', sliceDefaultCreationSelection, 'nightwatcher-hidden');
    expect(s.nightwatcher.ritual).toMatchObject({ playerLocation: 'OUTSIDE', activeVisitId: null, visits: [] });
    expect(s.nightwatcher.ritual.expert).toEqual({ id: NIGHTWATCHER_EXPERT_ID, name: '奥黛莉娅·黑尔', age: 66, adultAppearance: true, sequence: 4, source: NIGHTWATCHER_EXPERT_SOURCE, alive: true, willing: true, location: NIGHTWATCHER_HALL_ID });
    expect(validateNightwatcherRitualState(s)).toBe(true); expect(hasNightwatcherRitualLock(s)).toBe(false); expect(canConsumeNightwatcherRitual(s)).toBe(false);
    expect(projectNightwatcherRitual(s)).toMatchObject({ visits: [], expert: null, boundary: '', source: '', consequence: '', currentVisitId: null, windowOpen: false });
    expect(nightwatcherRitualActions(s)).toEqual([]);
    const a = createNightwatcherRitualState(), b = createNightwatcherRitualState();
    a.expert.willing = false; a.activeVisitId = 'NW4-RITUAL-1';
    expect(b.expert.willing).toBe(true); expect(b.activeVisitId).toBeNull(); expect(b.visits).toEqual([]);
  });

  it('actually pays for one next-week appointment and unique original kit held by the supplier', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, expert = structuredClone(s.nightwatcher.ritual.expert);
    const c = act(s, { type: 'BOOK_RITUAL' }), visit = currentNightwatcherVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - NIGHTWATCHER_RITUAL_PRICE, ap - 1]);
    expect(visit).toMatchObject({ id: 'NW4-RITUAL-1', source: NIGHTWATCHER_HALL_SOURCE, hallId: NIGHTWATCHER_HALL_ID, expertId: NIGHTWATCHER_EXPERT_ID, paidPennies: 240, status: 'BOOKED', bookedWeek: 77, plannedWeek: 78, enteredWeek: null, preparedWeek: null, preparedById: null, checkedWeek: null, proceedConfirmed: false, windowWeek: null });
    expect(visit.kit).toMatchObject({ id: 'NW4-KIT-1', location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null });
    expect(visit.kit.source).toContain(visit.kit.id); expect(visit.kit.source).toContain('原创G');
    expect(s.nightwatcher.ritual.expert).toEqual(expert); expect(s.nightwatcher.ritual.playerLocation).toBe('OUTSIDE');
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(hasNightwatcherRitualLock(s)).toBe(false); expect(canConsumeNightwatcherRitual(s)).toBe(false);
    expect(validateNightwatcherRitualState(s)).toBe(true); reject(s, { type: 'BOOK_RITUAL' });
  });

  it('requires a living guided sequence5 player, actual held bottle, money and one action', () => {
    const s = warlock(); reject(s, { type: 'BOOK_RITUAL' }); buy(s);
    s.nightwatcher.guidanceKnown = false; reject(s, { type: 'BOOK_RITUAL' }); s.nightwatcher.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'BOOK_RITUAL' }); s.progression.sequence = 5;
    s.cash = 239; reject(s, { type: 'BOOK_RITUAL' }); s.cash = 240;
    s.actionsRemaining = 0; reject(s, { type: 'BOOK_RITUAL' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'BOOK_RITUAL' }); s.health = 100;
    s.mind = 0; reject(s, { type: 'BOOK_RITUAL' }); s.mind = 100;
    s.spiritWarlock.practice.note = 'RECIPIENT'; reject(s, { type: 'BOOK_RITUAL' }); s.spiritWarlock.practice.note = 'TABLE';
    s.spiritWarlock.practice.dreamOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.spiritWarlock.practice.dreamOpen = false;
    s.spiritWarlock.cases['listening-leaves']!.contactOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.spiritWarlock.cases['listening-leaves']!.contactOpen = false;
    s.spiritWarlock.companion.status = 'DEPLOYED'; reject(s, { type: 'BOOK_RITUAL' }); s.spiritWarlock.companion.status = 'SEALED';
    act(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('requires the next real week and an actual one-action visit; the expert is not teleported', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const expert = structuredClone(s.nightwatcher.ritual.expert);
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'CHECK_PREPARATION', confirmed: true }); rejectDose(s);
    expect(hasNightwatcherRitualLock(s)).toBe(false);
    s.week += 1; s.actionsRemaining = 0; reject(s, { type: 'BEGIN_RITUAL' }); s.actionsRemaining = 1;
    const cash = s.cash, c = act(s, { type: 'BEGIN_RITUAL' }), visit = currentNightwatcherVisit(s)!;
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(visit).toMatchObject({ status: 'OPEN', enteredWeek: 78, preparedWeek: 78, preparedById: NIGHTWATCHER_EXPERT_ID, checkedWeek: null, windowWeek: null });
    expect(visit.kit).toMatchObject({ location: 'TABLE', status: 'SEALED', sealsIntact: true });
    expect(s.nightwatcher.ritual.playerLocation).toBe('HALL'); expect(s.nightwatcher.ritual.expert).toEqual(expert);
    expect(hasNightwatcherRitualLock(s)).toBe(true); expect(canConsumeNightwatcherRitual(s)).toBe(false);
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(validateNightwatcherRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('opens only an explicitly confirmed current-week preparation window without rolls or free resources', () => {
    const s = ready(); enter(s); const kit = structuredClone(currentNightwatcherVisit(s)!.kit), resources = [s.cash, s.health, s.mind, s.spirituality];
    s.actionsRemaining = 0;
    for (const command of [{ type: 'CHECK_PREPARATION' }, { type: 'CHECK_PREPARATION', confirmed: false }, { type: 'CHECK_PREPARATION', confirmed: 'true' }, { type: 'CHECK_PREPARATION', confirmed: true, expertWilling: true }]) reject(s, command);
    const c = act(s, { type: 'CHECK_PREPARATION', confirmed: true }), visit = currentNightwatcherVisit(s)!;
    expect(visit).toMatchObject({ checkedWeek: s.week, proceedConfirmed: true, windowWeek: s.week });
    expect(visit.kit).toEqual(kit); expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.nightwatcher.bottles[0]!.status).toBe('PLAYER'); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(NIGHTWATCHER_RITUAL_BOUNDARY));
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(NIGHTWATCHER_RITUAL_CONSEQUENCE));
    expect(canConsumeNightwatcherRitual(s)).toBe(true); expect(validateNightwatcherRitualState(s)).toBe(true);
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
  });

  it.each(['BOOKED', 'ENTERED', 'CHECKED'] as const)('allows zero-action exit from %s without refund, moving the expert or giving the unused kit to the player', stage => {
    const s = ready();
    if (stage === 'BOOKED') act(s, { type: 'BOOK_RITUAL' }); else if (stage === 'ENTERED') enter(s); else qualify(s);
    const visit = currentNightwatcherVisit(s)!, kit = structuredClone(visit.kit), expert = structuredClone(s.nightwatcher.ritual.expert), bottle = structuredClone(s.nightwatcher.bottles[0]);
    s.actionsRemaining = 0; s.health = 59; s.mind = 64; const resources = [s.cash, s.health, s.mind, s.spirituality];
    const action = nightwatcherRitualActions(s).find(value => ['END_RITUAL', 'CANCEL_RITUAL'].includes(value.command.type)); expect(action?.enabled).toBe(true);
    act(s, { type: stage === 'BOOKED' ? 'CANCEL_RITUAL' : 'END_RITUAL' });
    expect(visit.status).toBe(stage === 'BOOKED' ? 'CANCELLED' : 'CLOSED'); expect(visit.closedWeek).toBe(s.week);
    expect(visit.kit).toEqual(kit); expect(s.nightwatcher.ritual.expert).toEqual(expert); expect(s.nightwatcher.bottles[0]).toEqual(bottle);
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.nightwatcher.ritual.playerLocation).toBe('OUTSIDE'); expect(s.nightwatcher.ritual.activeVisitId).toBeNull();
    expect(hasNightwatcherRitualLock(s)).toBe(false); expect(canConsumeNightwatcherRitual(s)).toBe(false); expect(validateNightwatcherRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('never restores health, mind or a missing expert as part of a zero-action safety exit', () => {
    const s = ready(); qualify(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    s.nightwatcher.ritual.expert.alive = false; s.nightwatcher.ritual.expert.willing = false; s.nightwatcher.ritual.expert.location = 'AWAY';
    expect(nightwatcherRitualActions(s).find(value => value.command.type === 'END_RITUAL')?.enabled).toBe(true);
    act(s, { type: 'END_RITUAL' });
    expect([s.actionsRemaining, s.health, s.mind]).toEqual([0, 0, 0]);
    expect(s.nightwatcher.ritual.expert).toMatchObject({ alive: false, willing: false, location: 'AWAY' });
    expect(hasNightwatcherRitualLock(s)).toBe(false);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('preserves current %s facts and refuses actual entry, while cancellation remains available', change => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week += 1;
    if (change === 'dead') s.nightwatcher.ritual.expert.alive = false;
    if (change === 'unwilling') s.nightwatcher.ritual.expert.willing = false;
    if (change === 'away') s.nightwatcher.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') currentNightwatcherVisit(s)!.kit.location = 'MISSING';
    if (change === 'broken-seals') currentNightwatcherVisit(s)!.kit.sealsIntact = false;
    expect(validateNightwatcherRitualState(s)).toBe(true); reject(s, { type: 'BEGIN_RITUAL' });
    const expert = structuredClone(s.nightwatcher.ritual.expert), kit = structuredClone(currentNightwatcherVisit(s)!.kit);
    s.actionsRemaining = 0; act(s, { type: 'CANCEL_RITUAL' });
    expect(s.nightwatcher.ritual.expert).toEqual(expert); expect(s.nightwatcher.ritual.visits[0]!.kit).toEqual(kit);
    expect(validateNightwatcherRitualState(s)).toBe(true);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('rechecks %s at both preparation confirmation and potion consumption, preserving past actual entry', change => {
    const s = ready(); qualify(s); const visit = currentNightwatcherVisit(s)!;
    if (change === 'dead') s.nightwatcher.ritual.expert.alive = false;
    if (change === 'unwilling') s.nightwatcher.ritual.expert.willing = false;
    if (change === 'away') s.nightwatcher.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') visit.kit.location = 'MISSING';
    if (change === 'broken-seals') visit.kit.sealsIntact = false;
    expect(canConsumeNightwatcherRitual(s)).toBe(false); expect(validateNightwatcherRitualState(s)).toBe(true); rejectDose(s);
    visit.checkedWeek = null; visit.proceedConfirmed = false; visit.windowWeek = null;
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
    const history = structuredClone(visit); act(s, { type: 'END_RITUAL' });
    expect(visit.enteredWeek).toBe(history.enteredWeek); expect(visit.preparedWeek).toBe(history.preparedWeek); expect(visit.kit).toEqual(history.kit);
    expect(validateNightwatcherRitualState(s)).toBe(true);
  });

  it('pays for a distinct new original kit and another actual week after canceling or leaving an old unused one', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const old = structuredClone(s.nightwatcher.ritual.visits[0]), cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'BOOK_RITUAL' }); const next = currentNightwatcherVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(next.id).toBe('NW4-RITUAL-2'); expect(next.kit.id).toBe('NW4-KIT-2'); expect(next.kit.location).toBe('SUPPLIER');
    expect(next.plannedWeek).toBe(s.week + 1); expect(s.nightwatcher.ritual.visits[0]).toEqual(old);
    expect(hasNightwatcherRitualLock(s)).toBe(false); reject(s, { type: 'BEGIN_RITUAL' });
    s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(canConsumeNightwatcherRitual(s)).toBe(true); expect(s.nightwatcher.ritual.visits[0]).toEqual(old); expect(validateNightwatcherRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 4], [30, 'SUCCESS', 4], [90, 'FAILURE', 5], [100, 'GREAT_FAILURE', 5]] as const)(
    'potion roll %s consumes the same sourceful kit and bottle even on %s, then actually exits', (roll, tier, sequence) => {
      const s = ready(); qualify(s); s.actionsRemaining = 0;
      const visit = currentNightwatcherVisit(s)!, expert = structuredClone(s.nightwatcher.ritual.expert), bottle = s.nightwatcher.bottles[0]!, source = visit.kit.source;
      const c = acquire(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledTimes(1); expect(c.check).toHaveBeenCalledWith('will', 28);
      expect(s.progression.sequence).toBe(sequence); expect(s.actionsRemaining).toBe(0);
      expect(bottle).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: visit.id, ritualWindowWeek: s.week });
      expect(visit).toMatchObject({ status: 'CLOSED', consumedBottleId: bottle.id, closedWeek: s.week });
      expect(visit.kit).toEqual({ id: 'NW4-KIT-1', source, status: 'CONSUMED', location: 'TABLE', sealsIntact: false, consumedWeek: s.week });
      expect(s.nightwatcher.ritual.expert).toEqual(expert); expect(s.nightwatcher.ritual.playerLocation).toBe('OUTSIDE');
      expect(canConsumeNightwatcherRitual(s)).toBe(false); expect(hasNightwatcherRitualLock(s)).toBe(false); expect(validateNightwatcherRitualState(s)).toBe(true);
      if (sequence === 5) {
        buy(s, 1); rejectDose(s, 1); s.actionsRemaining = 1; const history = structuredClone(visit);
        act(s, { type: 'BOOK_RITUAL' }); expect(currentNightwatcherVisit(s)!.kit.id).toBe('NW4-KIT-2');
        expect(s.nightwatcher.ritual.visits[0]).toEqual(history); reject(s, { type: 'BEGIN_RITUAL' });
      }
    },
  );

  it('does not create, acquire, release or move an inherited spirit through professional preparation or promotion', () => {
    const s = ready(), original = structuredClone(s.spiritWarlock);
    qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.nightwatcher.bottles[0]!.id, confirmed: true });
    expect(s.progression.sequence).toBe(4);
    expect(s.spiritWarlock).toEqual(original);
    expect(s.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'UNMET', acquiredWeek: null, deployments: 0, recalls: 0 });
  });

  it('cannot claim actual kit consumption just by supplying an unconsumed or differently bound bottle ID', () => {
    const s = ready(); qualify(s); const bottle = s.nightwatcher.bottles[0]!, before = structuredClone(s);
    expect(() => closeNightwatcherRitual(s, bottle.id)).toThrow(); expect(s).toEqual(before);
    bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.ritualId = 'NW4-RITUAL-999'; bottle.ritualWindowWeek = s.week;
    const wrongBinding = structuredClone(s); expect(() => closeNightwatcherRitual(s, bottle.id)).toThrow(); expect(s).toEqual(wrongBinding);
    expect(currentNightwatcherVisit(s)!.kit.status).toBe('SEALED');
  });

  it.each(['past-week', 'outside', 'different-city', 'no-consent', 'no-check', 'not-prepared', 'wrong-expert', 'wrong-kit', 'wrong-source'] as const)(
    'refuses stale or forged current preparation: %s', change => {
      const s = ready(); qualify(s); const visit = currentNightwatcherVisit(s)!;
      if (change === 'past-week') s.week += 1;
      if (change === 'outside') s.nightwatcher.ritual.playerLocation = 'OUTSIDE';
      if (change === 'different-city') s.world.city = 'ELSEWHERE';
      if (change === 'no-consent') visit.proceedConfirmed = false;
      if (change === 'no-check') visit.checkedWeek = null;
      if (change === 'not-prepared') visit.preparedWeek = null;
      if (change === 'wrong-expert') visit.preparedById = 'SELINE';
      if (change === 'wrong-kit') visit.kit.id = 'NW4-KIT-OLD';
      if (change === 'wrong-source') visit.kit.source = 'free replacement from nowhere';
      expect(canConsumeNightwatcherRitual(s)).toBe(false); expect(validateNightwatcherRitualState(s)).toBe(false); rejectDose(s);
    },
  );

  it('keeps closed history valid when the expert later dies, withdraws consent or leaves her hall', () => {
    const s = ready(); qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.nightwatcher.bottles[0]!.id, confirmed: true });
    const history = structuredClone(s.nightwatcher.ritual.visits);
    s.nightwatcher.ritual.expert.alive = false; s.nightwatcher.ritual.expert.willing = false; s.nightwatcher.ritual.expert.location = 'AWAY';
    expect(validateNightwatcherRitualState(s)).toBe(true); expect(s.nightwatcher.ritual.visits).toEqual(history);
    expect(projectNightwatcherRitual(s).expert).toMatchObject({ alive: false, willing: false });
    expect(projectNightwatcherRitual(s).visits[0]!.summary).toContain('过往到场记录不证明');
    expect(projectNightwatcherRitual(s).visits[0]!.summary).toContain('均已实际耗尽');
  });

  it('serializes sourceful history and rejects forged prices, duplicate kits, reverse dates and hidden extra fields', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateNightwatcherRitualState(restored)).toBe(true);
    for (const change of [
      (v: SliceState) => { v.nightwatcher.ritual.expert.source = 'assumed powerful Seline'; },
      (v: SliceState) => { v.nightwatcher.ritual.expert.age = 14; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.paidPennies = 0; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.plannedWeek = 77; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.preparedWeek = 77; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.closedWeek = 79; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.kit.status = 'CONSUMED'; },
      (v: SliceState) => { v.nightwatcher.ritual.visits[0]!.consumedBottleId = v.nightwatcher.bottles[0]!.id; },
      (v: SliceState) => { Object.assign(v.nightwatcher.ritual.visits[0]!, { freeRitual: true }); },
      (v: SliceState) => { Object.assign(v.nightwatcher.ritual.visits[0]!, { kit: null }); },
    ]) { const invalid = structuredClone(restored); change(invalid); expect(validateNightwatcherRitualState(invalid)).toBe(false); }
    act(s, { type: 'BOOK_RITUAL' }); currentNightwatcherVisit(s)!.kit.id = 'NW4-KIT-1'; expect(validateNightwatcherRitualState(s)).toBe(false);
  });

  it('states the unknown complete canon ritual, G workflow, independent original expert and non-bypass boundary', () => {
    const s = ready(); enter(s); const view = projectNightwatcherRitual(s);
    expect(view.boundary).toBe(NIGHTWATCHER_RITUAL_BOUNDARY); expect(view.boundary).toContain('完整配方与完整仪式步骤尚未核实');
    expect(view.boundary).toContain('方案G'); expect(view.boundary).toContain('不声称守夜人免仪式'); expect(view.consequence).toBe(NIGHTWATCHER_RITUAL_CONSEQUENCE);
    expect(view.expert).toMatchObject({ id: NIGHTWATCHER_EXPERT_ID, age: 66, sequence: 4, adultAppearance: true }); expect(view.expert!.source).toContain('不把赛琳推定为半神');
    view.expert!.willing = false; view.visits[0]!.kit.source = 'mutated projection';
    expect(s.nightwatcher.ritual.expert.willing).toBe(true); expect(currentNightwatcherVisit(s)!.kit.source).not.toBe('mutated projection');
    for (const action of nightwatcherRitualActions(s)) expect(validateNightwatcherRitualCommand(action.command)).toBe(true);
    for (const command of [{ type: 'SUMMON_EXPERT' }, { type: 'SET_EXPERT', willing: true }, { type: 'BOOK_RITUAL', kitId: 'old' }, { type: 'BEGIN_RITUAL', location: NIGHTWATCHER_HALL_ID }, { type: 'CONSUME_KIT' }, null, []]) expect(validateNightwatcherRitualCommand(command)).toBe(false);
  });
});
