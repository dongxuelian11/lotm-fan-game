import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWitchKingCommand, createWitchKingState } from '../../src/domain/witch-king/index.js';
import type { WitchKingAcquisitionCommand } from '../../src/domain/witch-king/types.js';
import {
  WITCH_KING_EXPERT_ID, WITCH_KING_EXPERT_SOURCE, WITCH_KING_HALL_ID, WITCH_KING_HALL_SOURCE,
  WITCH_KING_RITUAL_BOUNDARY, WITCH_KING_RITUAL_CONSEQUENCE, WITCH_KING_RITUAL_PRICE,
  applyWitchKingRitualCommand, canConsumeWitchKingRitual, closeWitchKingRitual, createWitchKingRitualState,
  currentWitchKingVisit, hasWitchKingRitualLock, projectWitchKingRitual, validateWitchKingRitualCommand,
  validateWitchKingRitualState, witchKingRitualActions, type WitchKingRitualCommand,
} from '../../src/domain/witch-king/ritual.js';

/** Deliberate prior-S5 unit fixture; natural chronological play is exercised by the shared replay. */
function scholar(): SliceState {
  const s = createSliceRun('witch-king-ritual-unit', sliceDefaultCreationSelection, 'witch-king-ritual-unit');
  s.activeEvent = null; s.eventQueue = []; s.week = 77; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.apothecary.discovered = true; s.apothecary.guidanceKnown = true; s.tamer.guidanceKnown = true;
  s.vampire.guidanceKnown = true; s.potionProfessor.guidanceKnown = true; s.potionProfessor.promotionWeek = 45;
  s.crimsonScholar.guidanceKnown = true; s.crimsonScholar.promotionWeek = 65;
  s.progression.pathwayId = 'moon'; s.progression.sequence = 5; s.progression.acting = 100;
  s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  s.witchKing = createWitchKingState(); s.witchKing.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: WitchKingRitualCommand) { const c = context(s); applyWitchKingRitualCommand(s, command, c); return c; }
function acquire(s: SliceState, command: WitchKingAcquisitionCommand, roll = 1) { const c = context(s, roll); applyWitchKingCommand(s, command, c); return c; }
function buy(s: SliceState, index = 0) { const bottle = s.witchKing.bottles[index]!; acquire(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function ready() { const s = scholar(); buy(s); return s; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); }
function qualify(s: SliceState) { enter(s); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWitchKingRitualCommand(s, command as WitchKingRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
}
function rejectDose(s: SliceState, index = 0) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWitchKingCommand(s, { type: 'CONSUME', bottleId: s.witchKing.bottles[index]!.id, confirmed: true }, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Witch King actual professional G preparation and finite original kits', () => {
  it('starts outside with no kit, visit or window, hides unknown knowledge and creates independent state', () => {
    const s = createSliceRun('witch-king-hidden', sliceDefaultCreationSelection, 'witch-king-hidden');
    expect(s.witchKing.ritual).toMatchObject({ playerLocation: 'OUTSIDE', activeVisitId: null, visits: [] });
    expect(s.witchKing.ritual.expert).toEqual({ id: WITCH_KING_EXPERT_ID, name: '格蕾丝·维尔', age: 214, adultAppearance: true, sequence: 4, source: WITCH_KING_EXPERT_SOURCE, alive: true, willing: true, location: WITCH_KING_HALL_ID });
    expect(validateWitchKingRitualState(s)).toBe(true); expect(hasWitchKingRitualLock(s)).toBe(false); expect(canConsumeWitchKingRitual(s)).toBe(false);
    expect(projectWitchKingRitual(s)).toMatchObject({ visits: [], expert: null, boundary: '', source: '', consequence: '', currentVisitId: null, windowOpen: false });
    expect(witchKingRitualActions(s)).toEqual([]);
    const a = createWitchKingRitualState(), b = createWitchKingRitualState();
    a.expert.willing = false; a.activeVisitId = 'WK4-RITUAL-1';
    expect(b.expert.willing).toBe(true); expect(b.activeVisitId).toBeNull(); expect(b.visits).toEqual([]);
  });

  it('actually pays for one next-week appointment and unique original kit held by the supplier', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, expert = structuredClone(s.witchKing.ritual.expert);
    const c = act(s, { type: 'BOOK_RITUAL' }), visit = currentWitchKingVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - WITCH_KING_RITUAL_PRICE, ap - 1]);
    expect(visit).toMatchObject({ id: 'WK4-RITUAL-1', source: WITCH_KING_HALL_SOURCE, hallId: WITCH_KING_HALL_ID, expertId: WITCH_KING_EXPERT_ID, paidPennies: 240, status: 'BOOKED', bookedWeek: 77, plannedWeek: 78, enteredWeek: null, preparedWeek: null, preparedById: null, checkedWeek: null, proceedConfirmed: false, windowWeek: null });
    expect(visit.kit).toMatchObject({ id: 'WK4-KIT-1', location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null });
    expect(visit.kit.source).toContain(visit.kit.id); expect(visit.kit.source).toContain('原创G');
    expect(s.witchKing.ritual.expert).toEqual(expert); expect(s.witchKing.ritual.playerLocation).toBe('OUTSIDE');
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(hasWitchKingRitualLock(s)).toBe(false); expect(canConsumeWitchKingRitual(s)).toBe(false);
    expect(validateWitchKingRitualState(s)).toBe(true); reject(s, { type: 'BOOK_RITUAL' });
  });

  it('requires a living guided sequence5 player, actual held bottle, money and one action', () => {
    const s = scholar(); reject(s, { type: 'BOOK_RITUAL' }); buy(s);
    s.witchKing.guidanceKnown = false; reject(s, { type: 'BOOK_RITUAL' }); s.witchKing.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'BOOK_RITUAL' }); s.progression.sequence = 5;
    s.cash = 239; reject(s, { type: 'BOOK_RITUAL' }); s.cash = 240;
    s.actionsRemaining = 0; reject(s, { type: 'BOOK_RITUAL' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'BOOK_RITUAL' }); s.health = 100;
    s.mind = 0; reject(s, { type: 'BOOK_RITUAL' }); s.mind = 100;
    s.crimsonScholar.practice.location = 'END'; reject(s, { type: 'BOOK_RITUAL' }); s.crimsonScholar.practice.location = 'START';
    s.crimsonScholar.practice.field = 'FULL'; reject(s, { type: 'BOOK_RITUAL' }); s.crimsonScholar.practice.field = 'NONE';
    s.crimsonScholar.cases['full-moon']!.contactOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.crimsonScholar.cases['full-moon']!.contactOpen = false;
    act(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('requires the next real week and an actual one-action visit; the expert is not teleported', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const expert = structuredClone(s.witchKing.ritual.expert);
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'CHECK_PREPARATION', confirmed: true }); rejectDose(s);
    expect(hasWitchKingRitualLock(s)).toBe(false);
    s.week += 1; s.actionsRemaining = 0; reject(s, { type: 'BEGIN_RITUAL' }); s.actionsRemaining = 1;
    const cash = s.cash, c = act(s, { type: 'BEGIN_RITUAL' }), visit = currentWitchKingVisit(s)!;
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(visit).toMatchObject({ status: 'OPEN', enteredWeek: 78, preparedWeek: 78, preparedById: WITCH_KING_EXPERT_ID, checkedWeek: null, windowWeek: null });
    expect(visit.kit).toMatchObject({ location: 'TABLE', status: 'SEALED', sealsIntact: true });
    expect(s.witchKing.ritual.playerLocation).toBe('HALL'); expect(s.witchKing.ritual.expert).toEqual(expert);
    expect(hasWitchKingRitualLock(s)).toBe(true); expect(canConsumeWitchKingRitual(s)).toBe(false);
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(validateWitchKingRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('opens only an explicitly confirmed current-week preparation window without rolls or free resources', () => {
    const s = ready(); enter(s); const kit = structuredClone(currentWitchKingVisit(s)!.kit), resources = [s.cash, s.health, s.mind, s.spirituality];
    s.actionsRemaining = 0;
    for (const command of [{ type: 'CHECK_PREPARATION' }, { type: 'CHECK_PREPARATION', confirmed: false }, { type: 'CHECK_PREPARATION', confirmed: 'true' }, { type: 'CHECK_PREPARATION', confirmed: true, expertWilling: true }]) reject(s, command);
    const c = act(s, { type: 'CHECK_PREPARATION', confirmed: true }), visit = currentWitchKingVisit(s)!;
    expect(visit).toMatchObject({ checkedWeek: s.week, proceedConfirmed: true, windowWeek: s.week });
    expect(visit.kit).toEqual(kit); expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.witchKing.bottles[0]!.status).toBe('PLAYER'); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(WITCH_KING_RITUAL_BOUNDARY));
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(WITCH_KING_RITUAL_CONSEQUENCE));
    expect(canConsumeWitchKingRitual(s)).toBe(true); expect(validateWitchKingRitualState(s)).toBe(true);
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
  });

  it.each(['BOOKED', 'ENTERED', 'CHECKED'] as const)('allows zero-action exit from %s without refund, moving the expert or giving the unused kit to the player', stage => {
    const s = ready();
    if (stage === 'BOOKED') act(s, { type: 'BOOK_RITUAL' }); else if (stage === 'ENTERED') enter(s); else qualify(s);
    const visit = currentWitchKingVisit(s)!, kit = structuredClone(visit.kit), expert = structuredClone(s.witchKing.ritual.expert), bottle = structuredClone(s.witchKing.bottles[0]);
    s.actionsRemaining = 0; s.health = 59; s.mind = 64; const resources = [s.cash, s.health, s.mind, s.spirituality];
    const action = witchKingRitualActions(s).find(value => ['END_RITUAL', 'CANCEL_RITUAL'].includes(value.command.type)); expect(action?.enabled).toBe(true);
    act(s, { type: stage === 'BOOKED' ? 'CANCEL_RITUAL' : 'END_RITUAL' });
    expect(visit.status).toBe(stage === 'BOOKED' ? 'CANCELLED' : 'CLOSED'); expect(visit.closedWeek).toBe(s.week);
    expect(visit.kit).toEqual(kit); expect(s.witchKing.ritual.expert).toEqual(expert); expect(s.witchKing.bottles[0]).toEqual(bottle);
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.witchKing.ritual.playerLocation).toBe('OUTSIDE'); expect(s.witchKing.ritual.activeVisitId).toBeNull();
    expect(hasWitchKingRitualLock(s)).toBe(false); expect(canConsumeWitchKingRitual(s)).toBe(false); expect(validateWitchKingRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('never restores health, mind or a missing expert as part of a zero-action safety exit', () => {
    const s = ready(); qualify(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    s.witchKing.ritual.expert.alive = false; s.witchKing.ritual.expert.willing = false; s.witchKing.ritual.expert.location = 'AWAY';
    expect(witchKingRitualActions(s).find(value => value.command.type === 'END_RITUAL')?.enabled).toBe(true);
    act(s, { type: 'END_RITUAL' });
    expect([s.actionsRemaining, s.health, s.mind]).toEqual([0, 0, 0]);
    expect(s.witchKing.ritual.expert).toMatchObject({ alive: false, willing: false, location: 'AWAY' });
    expect(hasWitchKingRitualLock(s)).toBe(false);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('preserves current %s facts and refuses actual entry, while cancellation remains available', change => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week += 1;
    if (change === 'dead') s.witchKing.ritual.expert.alive = false;
    if (change === 'unwilling') s.witchKing.ritual.expert.willing = false;
    if (change === 'away') s.witchKing.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') currentWitchKingVisit(s)!.kit.location = 'MISSING';
    if (change === 'broken-seals') currentWitchKingVisit(s)!.kit.sealsIntact = false;
    expect(validateWitchKingRitualState(s)).toBe(true); reject(s, { type: 'BEGIN_RITUAL' });
    const expert = structuredClone(s.witchKing.ritual.expert), kit = structuredClone(currentWitchKingVisit(s)!.kit);
    s.actionsRemaining = 0; act(s, { type: 'CANCEL_RITUAL' });
    expect(s.witchKing.ritual.expert).toEqual(expert); expect(s.witchKing.ritual.visits[0]!.kit).toEqual(kit);
    expect(validateWitchKingRitualState(s)).toBe(true);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('rechecks %s at both preparation confirmation and potion consumption, preserving past actual entry', change => {
    const s = ready(); qualify(s); const visit = currentWitchKingVisit(s)!;
    if (change === 'dead') s.witchKing.ritual.expert.alive = false;
    if (change === 'unwilling') s.witchKing.ritual.expert.willing = false;
    if (change === 'away') s.witchKing.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') visit.kit.location = 'MISSING';
    if (change === 'broken-seals') visit.kit.sealsIntact = false;
    expect(canConsumeWitchKingRitual(s)).toBe(false); expect(validateWitchKingRitualState(s)).toBe(true); rejectDose(s);
    visit.checkedWeek = null; visit.proceedConfirmed = false; visit.windowWeek = null;
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
    const history = structuredClone(visit); act(s, { type: 'END_RITUAL' });
    expect(visit.enteredWeek).toBe(history.enteredWeek); expect(visit.preparedWeek).toBe(history.preparedWeek); expect(visit.kit).toEqual(history.kit);
    expect(validateWitchKingRitualState(s)).toBe(true);
  });

  it('pays for a distinct new original kit and another actual week after canceling or leaving an old unused one', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const old = structuredClone(s.witchKing.ritual.visits[0]), cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'BOOK_RITUAL' }); const next = currentWitchKingVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(next.id).toBe('WK4-RITUAL-2'); expect(next.kit.id).toBe('WK4-KIT-2'); expect(next.kit.location).toBe('SUPPLIER');
    expect(next.plannedWeek).toBe(s.week + 1); expect(s.witchKing.ritual.visits[0]).toEqual(old);
    expect(hasWitchKingRitualLock(s)).toBe(false); reject(s, { type: 'BEGIN_RITUAL' });
    s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(canConsumeWitchKingRitual(s)).toBe(true); expect(s.witchKing.ritual.visits[0]).toEqual(old); expect(validateWitchKingRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 4], [30, 'SUCCESS', 4], [90, 'FAILURE', 5], [100, 'GREAT_FAILURE', 5]] as const)(
    'potion roll %s consumes the same sourceful kit and bottle even on %s, then actually exits', (roll, tier, sequence) => {
      const s = ready(); qualify(s); s.actionsRemaining = 0;
      const visit = currentWitchKingVisit(s)!, expert = structuredClone(s.witchKing.ritual.expert), bottle = s.witchKing.bottles[0]!, source = visit.kit.source;
      const c = acquire(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledTimes(1); expect(c.check).toHaveBeenCalledWith('will', 28);
      expect(s.progression.sequence).toBe(sequence); expect(s.actionsRemaining).toBe(0);
      expect(bottle).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: visit.id, ritualWindowWeek: s.week });
      expect(visit).toMatchObject({ status: 'CLOSED', consumedBottleId: bottle.id, closedWeek: s.week });
      expect(visit.kit).toEqual({ id: 'WK4-KIT-1', source, status: 'CONSUMED', location: 'TABLE', sealsIntact: false, consumedWeek: s.week });
      expect(s.witchKing.ritual.expert).toEqual(expert); expect(s.witchKing.ritual.playerLocation).toBe('OUTSIDE');
      expect(canConsumeWitchKingRitual(s)).toBe(false); expect(hasWitchKingRitualLock(s)).toBe(false); expect(validateWitchKingRitualState(s)).toBe(true);
      if (sequence === 5) {
        buy(s, 1); rejectDose(s, 1); s.actionsRemaining = 1; const history = structuredClone(visit);
        act(s, { type: 'BOOK_RITUAL' }); expect(currentWitchKingVisit(s)!.kit.id).toBe('WK4-KIT-2');
        expect(s.witchKing.ritual.visits[0]).toEqual(history); reject(s, { type: 'BEGIN_RITUAL' });
      }
    },
  );

  it('cannot claim actual kit consumption just by supplying an unconsumed or differently bound bottle ID', () => {
    const s = ready(); qualify(s); const bottle = s.witchKing.bottles[0]!, before = structuredClone(s);
    expect(() => closeWitchKingRitual(s, bottle.id)).toThrow(); expect(s).toEqual(before);
    bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.ritualId = 'WK4-RITUAL-999'; bottle.ritualWindowWeek = s.week;
    const wrongBinding = structuredClone(s); expect(() => closeWitchKingRitual(s, bottle.id)).toThrow(); expect(s).toEqual(wrongBinding);
    expect(currentWitchKingVisit(s)!.kit.status).toBe('SEALED');
  });

  it.each(['past-week', 'outside', 'different-city', 'no-consent', 'no-check', 'not-prepared', 'wrong-expert', 'wrong-kit', 'wrong-source'] as const)(
    'refuses stale or forged current preparation: %s', change => {
      const s = ready(); qualify(s); const visit = currentWitchKingVisit(s)!;
      if (change === 'past-week') s.week += 1;
      if (change === 'outside') s.witchKing.ritual.playerLocation = 'OUTSIDE';
      if (change === 'different-city') s.world.city = 'ELSEWHERE';
      if (change === 'no-consent') visit.proceedConfirmed = false;
      if (change === 'no-check') visit.checkedWeek = null;
      if (change === 'not-prepared') visit.preparedWeek = null;
      if (change === 'wrong-expert') visit.preparedById = 'ERIN';
      if (change === 'wrong-kit') visit.kit.id = 'WK4-KIT-OLD';
      if (change === 'wrong-source') visit.kit.source = 'free replacement from nowhere';
      expect(canConsumeWitchKingRitual(s)).toBe(false); expect(validateWitchKingRitualState(s)).toBe(false); rejectDose(s);
    },
  );

  it('keeps closed history valid when the expert later dies, withdraws consent or leaves her hall', () => {
    const s = ready(); qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.witchKing.bottles[0]!.id, confirmed: true });
    const history = structuredClone(s.witchKing.ritual.visits);
    s.witchKing.ritual.expert.alive = false; s.witchKing.ritual.expert.willing = false; s.witchKing.ritual.expert.location = 'AWAY';
    expect(validateWitchKingRitualState(s)).toBe(true); expect(s.witchKing.ritual.visits).toEqual(history);
    expect(projectWitchKingRitual(s).expert).toMatchObject({ alive: false, willing: false });
    expect(projectWitchKingRitual(s).visits[0]!.summary).toContain('过往到场记录不证明');
    expect(projectWitchKingRitual(s).visits[0]!.summary).toContain('均已实际耗尽');
  });

  it('serializes sourceful history and rejects forged prices, duplicate kits, reverse dates and hidden extra fields', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateWitchKingRitualState(restored)).toBe(true);
    for (const change of [
      (v: SliceState) => { v.witchKing.ritual.expert.source = 'assumed powerful Erin'; },
      (v: SliceState) => { v.witchKing.ritual.expert.age = 14; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.paidPennies = 0; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.plannedWeek = 77; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.preparedWeek = 77; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.closedWeek = 79; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.kit.status = 'CONSUMED'; },
      (v: SliceState) => { v.witchKing.ritual.visits[0]!.consumedBottleId = v.witchKing.bottles[0]!.id; },
      (v: SliceState) => { Object.assign(v.witchKing.ritual.visits[0]!, { freeRitual: true }); },
      (v: SliceState) => { Object.assign(v.witchKing.ritual.visits[0]!, { kit: null }); },
    ]) { const invalid = structuredClone(restored); change(invalid); expect(validateWitchKingRitualState(invalid)).toBe(false); }
    act(s, { type: 'BOOK_RITUAL' }); currentWitchKingVisit(s)!.kit.id = 'WK4-KIT-1'; expect(validateWitchKingRitualState(s)).toBe(false);
  });

  it('states the unknown complete canon ritual, G workflow, independent original expert and non-bypass boundary', () => {
    const s = ready(); enter(s); const view = projectWitchKingRitual(s);
    expect(view.boundary).toBe(WITCH_KING_RITUAL_BOUNDARY); expect(view.boundary).toContain('完整配方与完整仪式步骤尚未核实');
    expect(view.boundary).toContain('方案G'); expect(view.boundary).toContain('不是血族免仪式'); expect(view.consequence).toBe(WITCH_KING_RITUAL_CONSEQUENCE);
    expect(view.expert).toMatchObject({ id: WITCH_KING_EXPERT_ID, age: 214, sequence: 4, adultAppearance: true }); expect(view.expert!.source).toContain('不把艾琳推定为半神');
    view.expert!.willing = false; view.visits[0]!.kit.source = 'mutated projection';
    expect(s.witchKing.ritual.expert.willing).toBe(true); expect(currentWitchKingVisit(s)!.kit.source).not.toBe('mutated projection');
    for (const action of witchKingRitualActions(s)) expect(validateWitchKingRitualCommand(action.command)).toBe(true);
    for (const command of [{ type: 'SUMMON_EXPERT' }, { type: 'SET_EXPERT', willing: true }, { type: 'BOOK_RITUAL', kitId: 'old' }, { type: 'BEGIN_RITUAL', location: WITCH_KING_HALL_ID }, { type: 'CONSUME_KIT' }, null, []]) expect(validateWitchKingRitualCommand(command)).toBe(false);
  });
});
