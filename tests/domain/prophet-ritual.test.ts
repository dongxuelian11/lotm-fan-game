import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyProphetCommand, createProphetState } from '../../src/domain/prophet/index.js';
import type { ProphetAcquisitionCommand } from '../../src/domain/prophet/types.js';
import {
  PROPHET_EXPERT_ID, PROPHET_EXPERT_SOURCE, PROPHET_HALL_ID, PROPHET_HALL_SOURCE,
  PROPHET_RITUAL_BOUNDARY, PROPHET_RITUAL_CONSEQUENCE, PROPHET_RITUAL_PRICE,
  applyProphetRitualCommand, canConsumeProphetRitual, closeProphetRitual, createProphetRitualState,
  currentProphetVisit, hasProphetRitualLock, projectProphetRitual, validateProphetRitualCommand,
  validateProphetRitualState, prophetRitualActions, type ProphetRitualCommand,
} from '../../src/domain/prophet/ritual.js';

/** Actual S5 replay history with deliberate unit-test week, resources and check stats. */
function magister(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/mysticism-magister-v01010/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior);
  s.activeEvent = null; s.eventQueue = []; s.week = 77; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  s.prophet = createProphetState(); s.prophet.guidanceKnown = true;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: ProphetRitualCommand) { const c = context(s); applyProphetRitualCommand(s, command, c); return c; }
function acquire(s: SliceState, command: ProphetAcquisitionCommand, roll = 1) { const c = context(s, roll); applyProphetCommand(s, command, c); return c; }
function buy(s: SliceState, index = 0) { const bottle = s.prophet.bottles[index]!; acquire(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function ready() { const s = magister(); buy(s); return s; }
function enter(s: SliceState) { act(s, { type: 'BOOK_RITUAL' }); s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); }
function qualify(s: SliceState) { enter(s); act(s, { type: 'CHECK_PREPARATION', confirmed: true }); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyProphetRitualCommand(s, command as ProphetRitualCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
}
function rejectDose(s: SliceState, index = 0) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyProphetCommand(s, { type: 'CONSUME', bottleId: s.prophet.bottles[index]!.id, confirmed: true }, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Prophet actual professional G preparation and finite original kits', () => {
  it('starts outside with no kit, visit or window, hides unknown knowledge and creates independent state', () => {
    const s = createSliceRun('prophet-hidden', sliceDefaultCreationSelection, 'prophet-hidden');
    expect(s.prophet.ritual).toMatchObject({ playerLocation: 'OUTSIDE', activeVisitId: null, visits: [] });
    expect(s.prophet.ritual.expert).toEqual({ id: PROPHET_EXPERT_ID, name: '玛莎·维尔', age: 64, adultAppearance: true, sequence: 4, source: PROPHET_EXPERT_SOURCE, alive: true, willing: true, location: PROPHET_HALL_ID });
    expect(validateProphetRitualState(s)).toBe(true); expect(hasProphetRitualLock(s)).toBe(false); expect(canConsumeProphetRitual(s)).toBe(false);
    expect(projectProphetRitual(s)).toMatchObject({ visits: [], expert: null, boundary: '', source: '', consequence: '', currentVisitId: null, windowOpen: false });
    expect(prophetRitualActions(s)).toEqual([]);
    const a = createProphetRitualState(), b = createProphetRitualState();
    a.expert.willing = false; a.activeVisitId = 'PF4-RITUAL-1';
    expect(b.expert.willing).toBe(true); expect(b.activeVisitId).toBeNull(); expect(b.visits).toEqual([]);
  });

  it('actually pays for one next-week appointment and unique original kit held by the supplier', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining, expert = structuredClone(s.prophet.ritual.expert);
    const c = act(s, { type: 'BOOK_RITUAL' }), visit = currentProphetVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - PROPHET_RITUAL_PRICE, ap - 1]);
    expect(visit).toMatchObject({ id: 'PF4-RITUAL-1', source: PROPHET_HALL_SOURCE, hallId: PROPHET_HALL_ID, expertId: PROPHET_EXPERT_ID, paidPennies: 240, status: 'BOOKED', bookedWeek: 77, plannedWeek: 78, enteredWeek: null, preparedWeek: null, preparedById: null, checkedWeek: null, proceedConfirmed: false, windowWeek: null });
    expect(visit.kit).toMatchObject({ id: 'PF4-KIT-1', location: 'SUPPLIER', status: 'SEALED', sealsIntact: true, consumedWeek: null });
    expect(visit.kit.source).toContain(visit.kit.id); expect(visit.kit.source).toContain('原创G');
    expect(s.prophet.ritual.expert).toEqual(expert); expect(s.prophet.ritual.playerLocation).toBe('OUTSIDE');
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(hasProphetRitualLock(s)).toBe(false); expect(canConsumeProphetRitual(s)).toBe(false);
    expect(validateProphetRitualState(s)).toBe(true); reject(s, { type: 'BOOK_RITUAL' });
  });

  it('requires a living guided sequence5 player, actual held bottle, money and one action', () => {
    const s = magister(); reject(s, { type: 'BOOK_RITUAL' }); buy(s);
    s.prophet.guidanceKnown = false; reject(s, { type: 'BOOK_RITUAL' }); s.prophet.guidanceKnown = true;
    s.progression.sequence = 4; reject(s, { type: 'BOOK_RITUAL' }); s.progression.sequence = 5;
    s.cash = 239; reject(s, { type: 'BOOK_RITUAL' }); s.cash = 240;
    s.actionsRemaining = 0; reject(s, { type: 'BOOK_RITUAL' }); s.actionsRemaining = 1;
    s.health = 0; reject(s, { type: 'BOOK_RITUAL' }); s.health = 100;
    s.mind = 0; reject(s, { type: 'BOOK_RITUAL' }); s.mind = 100;
    s.mysticismMagister.practice.token = 'PLAYER'; reject(s, { type: 'BOOK_RITUAL' }); s.mysticismMagister.practice.token = 'OWNER';
    s.mysticismMagister.practice.dreamOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.mysticismMagister.practice.dreamOpen = false;
    s.mysticismMagister.cases['linked-dream']!.contactOpen = true; reject(s, { type: 'BOOK_RITUAL' }); s.mysticismMagister.cases['linked-dream']!.contactOpen = false;
    s.polymath.cases['flash-study']!.status = 'PREPARED'; reject(s, { type: 'BOOK_RITUAL' }); s.polymath.cases['flash-study']!.status = 'RESOLVED';
    act(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('requires the next real week and an actual one-action visit; the expert is not teleported', () => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); const expert = structuredClone(s.prophet.ritual.expert);
    reject(s, { type: 'BEGIN_RITUAL' }); reject(s, { type: 'CHECK_PREPARATION', confirmed: true }); rejectDose(s);
    expect(hasProphetRitualLock(s)).toBe(false);
    s.week += 1; s.actionsRemaining = 0; reject(s, { type: 'BEGIN_RITUAL' }); s.actionsRemaining = 1;
    const cash = s.cash, c = act(s, { type: 'BEGIN_RITUAL' }), visit = currentProphetVisit(s)!;
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(visit).toMatchObject({ status: 'OPEN', enteredWeek: 78, preparedWeek: 78, preparedById: PROPHET_EXPERT_ID, checkedWeek: null, windowWeek: null });
    expect(visit.kit).toMatchObject({ location: 'TABLE', status: 'SEALED', sealsIntact: true });
    expect(s.prophet.ritual.playerLocation).toBe('HALL'); expect(s.prophet.ritual.expert).toEqual(expert);
    expect(hasProphetRitualLock(s)).toBe(true); expect(canConsumeProphetRitual(s)).toBe(false);
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(validateProphetRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('opens only an explicitly confirmed current-week preparation window without rolls or free resources', () => {
    const s = ready(); enter(s); const kit = structuredClone(currentProphetVisit(s)!.kit), resources = [s.cash, s.health, s.mind, s.spirituality];
    s.actionsRemaining = 0;
    for (const command of [{ type: 'CHECK_PREPARATION' }, { type: 'CHECK_PREPARATION', confirmed: false }, { type: 'CHECK_PREPARATION', confirmed: 'true' }, { type: 'CHECK_PREPARATION', confirmed: true, expertWilling: true }]) reject(s, command);
    const c = act(s, { type: 'CHECK_PREPARATION', confirmed: true }), visit = currentProphetVisit(s)!;
    expect(visit).toMatchObject({ checkedWeek: s.week, proceedConfirmed: true, windowWeek: s.week });
    expect(visit.kit).toEqual(kit); expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.prophet.bottles[0]!.status).toBe('PLAYER'); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(PROPHET_RITUAL_BOUNDARY));
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(PROPHET_RITUAL_CONSEQUENCE));
    expect(canConsumeProphetRitual(s)).toBe(true); expect(validateProphetRitualState(s)).toBe(true);
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
  });

  it.each(['BOOKED', 'ENTERED', 'CHECKED'] as const)('allows zero-action exit from %s without refund, moving the expert or giving the unused kit to the player', stage => {
    const s = ready();
    if (stage === 'BOOKED') act(s, { type: 'BOOK_RITUAL' }); else if (stage === 'ENTERED') enter(s); else qualify(s);
    const visit = currentProphetVisit(s)!, kit = structuredClone(visit.kit), expert = structuredClone(s.prophet.ritual.expert), bottle = structuredClone(s.prophet.bottles[0]);
    s.actionsRemaining = 0; s.health = 59; s.mind = 64; const resources = [s.cash, s.health, s.mind, s.spirituality];
    const action = prophetRitualActions(s).find(value => ['END_RITUAL', 'CANCEL_RITUAL'].includes(value.command.type)); expect(action?.enabled).toBe(true);
    act(s, { type: stage === 'BOOKED' ? 'CANCEL_RITUAL' : 'END_RITUAL' });
    expect(visit.status).toBe(stage === 'BOOKED' ? 'CANCELLED' : 'CLOSED'); expect(visit.closedWeek).toBe(s.week);
    expect(visit.kit).toEqual(kit); expect(s.prophet.ritual.expert).toEqual(expert); expect(s.prophet.bottles[0]).toEqual(bottle);
    expect([s.cash, s.health, s.mind, s.spirituality]).toEqual(resources); expect(s.actionsRemaining).toBe(0);
    expect(s.prophet.ritual.playerLocation).toBe('OUTSIDE'); expect(s.prophet.ritual.activeVisitId).toBeNull();
    expect(hasProphetRitualLock(s)).toBe(false); expect(canConsumeProphetRitual(s)).toBe(false); expect(validateProphetRitualState(s)).toBe(true);
    reject(s, { type: 'BEGIN_RITUAL' }); rejectDose(s);
  });

  it('never restores health, mind or a missing expert as part of a zero-action safety exit', () => {
    const s = ready(); qualify(s); s.actionsRemaining = 0; s.health = 0; s.mind = 0;
    s.prophet.ritual.expert.alive = false; s.prophet.ritual.expert.willing = false; s.prophet.ritual.expert.location = 'AWAY';
    expect(prophetRitualActions(s).find(value => value.command.type === 'END_RITUAL')?.enabled).toBe(true);
    act(s, { type: 'END_RITUAL' });
    expect([s.actionsRemaining, s.health, s.mind]).toEqual([0, 0, 0]);
    expect(s.prophet.ritual.expert).toMatchObject({ alive: false, willing: false, location: 'AWAY' });
    expect(hasProphetRitualLock(s)).toBe(false);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('preserves current %s facts and refuses actual entry, while cancellation remains available', change => {
    const s = ready(); act(s, { type: 'BOOK_RITUAL' }); s.week += 1;
    if (change === 'dead') s.prophet.ritual.expert.alive = false;
    if (change === 'unwilling') s.prophet.ritual.expert.willing = false;
    if (change === 'away') s.prophet.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') currentProphetVisit(s)!.kit.location = 'MISSING';
    if (change === 'broken-seals') currentProphetVisit(s)!.kit.sealsIntact = false;
    expect(validateProphetRitualState(s)).toBe(true); reject(s, { type: 'BEGIN_RITUAL' });
    const expert = structuredClone(s.prophet.ritual.expert), kit = structuredClone(currentProphetVisit(s)!.kit);
    s.actionsRemaining = 0; act(s, { type: 'CANCEL_RITUAL' });
    expect(s.prophet.ritual.expert).toEqual(expert); expect(s.prophet.ritual.visits[0]!.kit).toEqual(kit);
    expect(validateProphetRitualState(s)).toBe(true);
  });

  it.each(['dead', 'unwilling', 'away', 'missing-kit', 'broken-seals'] as const)('rechecks %s at both preparation confirmation and potion consumption, preserving past actual entry', change => {
    const s = ready(); qualify(s); const visit = currentProphetVisit(s)!;
    if (change === 'dead') s.prophet.ritual.expert.alive = false;
    if (change === 'unwilling') s.prophet.ritual.expert.willing = false;
    if (change === 'away') s.prophet.ritual.expert.location = 'AWAY';
    if (change === 'missing-kit') visit.kit.location = 'MISSING';
    if (change === 'broken-seals') visit.kit.sealsIntact = false;
    expect(canConsumeProphetRitual(s)).toBe(false); expect(validateProphetRitualState(s)).toBe(true); rejectDose(s);
    visit.checkedWeek = null; visit.proceedConfirmed = false; visit.windowWeek = null;
    reject(s, { type: 'CHECK_PREPARATION', confirmed: true });
    const history = structuredClone(visit); act(s, { type: 'END_RITUAL' });
    expect(visit.enteredWeek).toBe(history.enteredWeek); expect(visit.preparedWeek).toBe(history.preparedWeek); expect(visit.kit).toEqual(history.kit);
    expect(validateProphetRitualState(s)).toBe(true);
  });

  it('pays for a distinct new original kit and another actual week after canceling or leaving an old unused one', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const old = structuredClone(s.prophet.ritual.visits[0]), cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'BOOK_RITUAL' }); const next = currentProphetVisit(s)!;
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(next.id).toBe('PF4-RITUAL-2'); expect(next.kit.id).toBe('PF4-KIT-2'); expect(next.kit.location).toBe('SUPPLIER');
    expect(next.plannedWeek).toBe(s.week + 1); expect(s.prophet.ritual.visits[0]).toEqual(old);
    expect(hasProphetRitualLock(s)).toBe(false); reject(s, { type: 'BEGIN_RITUAL' });
    s.week += 1; act(s, { type: 'BEGIN_RITUAL' }); act(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(canConsumeProphetRitual(s)).toBe(true); expect(s.prophet.ritual.visits[0]).toEqual(old); expect(validateProphetRitualState(s)).toBe(true);
  });

  it.each([[1, 'GREAT_SUCCESS', 4], [30, 'SUCCESS', 4], [90, 'FAILURE', 5], [100, 'GREAT_FAILURE', 5]] as const)(
    'potion roll %s consumes the same sourceful kit and bottle even on %s, then actually exits', (roll, tier, sequence) => {
      const s = ready(); qualify(s); s.actionsRemaining = 0;
      const visit = currentProphetVisit(s)!, expert = structuredClone(s.prophet.ritual.expert), bottle = s.prophet.bottles[0]!, source = visit.kit.source;
      const c = acquire(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledTimes(1); expect(c.check).toHaveBeenCalledWith('will', 28);
      expect(s.progression.sequence).toBe(sequence); expect(s.actionsRemaining).toBe(0);
      expect(bottle).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: visit.id, ritualWindowWeek: s.week });
      expect(visit).toMatchObject({ status: 'CLOSED', consumedBottleId: bottle.id, closedWeek: s.week });
      expect(visit.kit).toEqual({ id: 'PF4-KIT-1', source, status: 'CONSUMED', location: 'TABLE', sealsIntact: false, consumedWeek: s.week });
      expect(s.prophet.ritual.expert).toEqual(expert); expect(s.prophet.ritual.playerLocation).toBe('OUTSIDE');
      expect(canConsumeProphetRitual(s)).toBe(false); expect(hasProphetRitualLock(s)).toBe(false); expect(validateProphetRitualState(s)).toBe(true);
      if (sequence === 5) {
        buy(s, 1); rejectDose(s, 1); s.actionsRemaining = 1; const history = structuredClone(visit);
        act(s, { type: 'BOOK_RITUAL' }); expect(currentProphetVisit(s)!.kit.id).toBe('PF4-KIT-2');
        expect(s.prophet.ritual.visits[0]).toEqual(history); reject(s, { type: 'BEGIN_RITUAL' });
      }
    },
  );

  it('preserves all prior Reader history, original cloth, learned samples and actual crafted items through preparation and promotion', () => {
    const s = ready(), original = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister]);
    const gender = s.character.gender;
    qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.prophet.bottles[0]!.id, confirmed: true });
    expect(s.progression.sequence).toBe(4);
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister]).toEqual(original);
    expect(s.character.gender).toBe(gender);
    expect(s.mysticismMagister.practice).toMatchObject({ token: 'OWNER', dreamOpen: false, kitsUsed: 3 });
    expect(s.mysticismMagister.crafts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'MM5-FLASH-1', status: 'CONSUMED' }),
      expect.objectContaining({ id: 'MM5-FLASH-3', status: 'PLAYER' }),
    ]));
  });

  it('cannot claim actual kit consumption just by supplying an unconsumed or differently bound bottle ID', () => {
    const s = ready(); qualify(s); const bottle = s.prophet.bottles[0]!, before = structuredClone(s);
    expect(() => closeProphetRitual(s, bottle.id)).toThrow(); expect(s).toEqual(before);
    bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.ritualId = 'PF4-RITUAL-999'; bottle.ritualWindowWeek = s.week;
    const wrongBinding = structuredClone(s); expect(() => closeProphetRitual(s, bottle.id)).toThrow(); expect(s).toEqual(wrongBinding);
    expect(currentProphetVisit(s)!.kit.status).toBe('SEALED');
  });

  it.each(['past-week', 'outside', 'different-city', 'no-consent', 'no-check', 'not-prepared', 'wrong-expert', 'wrong-kit', 'wrong-source'] as const)(
    'refuses stale or forged current preparation: %s', change => {
      const s = ready(); qualify(s); const visit = currentProphetVisit(s)!;
      if (change === 'past-week') s.week += 1;
      if (change === 'outside') s.prophet.ritual.playerLocation = 'OUTSIDE';
      if (change === 'different-city') s.world.city = 'ELSEWHERE';
      if (change === 'no-consent') visit.proceedConfirmed = false;
      if (change === 'no-check') visit.checkedWeek = null;
      if (change === 'not-prepared') visit.preparedWeek = null;
      if (change === 'wrong-expert') visit.preparedById = 'SAMUEL';
      if (change === 'wrong-kit') visit.kit.id = 'PF4-KIT-OLD';
      if (change === 'wrong-source') visit.kit.source = 'free replacement from nowhere';
      expect(canConsumeProphetRitual(s)).toBe(false); expect(validateProphetRitualState(s)).toBe(false); rejectDose(s);
    },
  );

  it('keeps closed history valid when the expert later dies, withdraws consent or leaves her hall', () => {
    const s = ready(); qualify(s); acquire(s, { type: 'CONSUME', bottleId: s.prophet.bottles[0]!.id, confirmed: true });
    const history = structuredClone(s.prophet.ritual.visits);
    s.prophet.ritual.expert.alive = false; s.prophet.ritual.expert.willing = false; s.prophet.ritual.expert.location = 'AWAY';
    expect(validateProphetRitualState(s)).toBe(true); expect(s.prophet.ritual.visits).toEqual(history);
    expect(projectProphetRitual(s).expert).toMatchObject({ alive: false, willing: false });
    expect(projectProphetRitual(s).visits[0]!.summary).toContain('过往到场记录不证明');
    expect(projectProphetRitual(s).visits[0]!.summary).toContain('均已实际耗尽');
  });

  it('serializes sourceful history and rejects forged prices, duplicate kits, reverse dates and hidden extra fields', () => {
    const s = ready(); qualify(s); act(s, { type: 'END_RITUAL' });
    const restored = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateProphetRitualState(restored)).toBe(true);
    for (const change of [
      (v: SliceState) => { v.prophet.ritual.expert.source = 'assumed powerful Samuel'; },
      (v: SliceState) => { v.prophet.ritual.expert.age = 14; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.paidPennies = 0; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.plannedWeek = 77; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.preparedWeek = 77; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.closedWeek = 79; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.kit.status = 'CONSUMED'; },
      (v: SliceState) => { v.prophet.ritual.visits[0]!.consumedBottleId = v.prophet.bottles[0]!.id; },
      (v: SliceState) => { Object.assign(v.prophet.ritual.visits[0]!, { freeRitual: true }); },
      (v: SliceState) => { Object.assign(v.prophet.ritual.visits[0]!, { kit: null }); },
    ]) { const invalid = structuredClone(restored); change(invalid); expect(validateProphetRitualState(invalid)).toBe(false); }
    act(s, { type: 'BOOK_RITUAL' }); currentProphetVisit(s)!.kit.id = 'PF4-KIT-1'; expect(validateProphetRitualState(s)).toBe(false);
  });

  it('states the unknown complete canon ritual, G workflow, independent original expert and non-bypass boundary', () => {
    const s = ready(); enter(s); const view = projectProphetRitual(s);
    expect(view.boundary).toBe(PROPHET_RITUAL_BOUNDARY); expect(view.boundary).toContain('完整配方与完整仪式步骤尚未核实');
    expect(view.boundary).toContain('方案G'); expect(view.boundary).toContain('不声称预言家免仪式'); expect(view.consequence).toBe(PROPHET_RITUAL_CONSEQUENCE);
    expect(view.expert).toMatchObject({ id: PROPHET_EXPERT_ID, age: 64, sequence: 4, adultAppearance: true }); expect(view.expert!.source).toContain('不把塞缪尔推定为半神');
    view.expert!.willing = false; view.visits[0]!.kit.source = 'mutated projection';
    expect(s.prophet.ritual.expert.willing).toBe(true); expect(currentProphetVisit(s)!.kit.source).not.toBe('mutated projection');
    for (const action of prophetRitualActions(s)) expect(validateProphetRitualCommand(action.command)).toBe(true);
    for (const command of [{ type: 'SUMMON_EXPERT' }, { type: 'SET_EXPERT', willing: true }, { type: 'BOOK_RITUAL', kitId: 'old' }, { type: 'BEGIN_RITUAL', location: PROPHET_HALL_ID }, { type: 'CONSUME_KIT' }, null, []]) expect(validateProphetRitualCommand(command)).toBe(false);
  });
});
