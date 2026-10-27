import { describe, expect, it } from 'vitest';
import { MOON_STATIONS } from '../../src/domain/moon/content.js';
import type { MoonHost } from '../../src/domain/moon/ports.js';
import {
  applyMoonService, createMoonServices, getMoonServiceActions, moonServiceBlock,
  moonVerifiedReceipts, moonWindow, nextMoonWindow, projectMoonServices, validateMoonServiceCommand,
  type MoonServiceCommand, type MoonStationId,
} from '../../src/domain/moon/services.js';

/** Bounded component host, not a natural playthrough or an authoritative save.
 * Later-week resource inputs are explicit; the reducer must never award wages,
 * healing or action points for waiting, signing, stopping or reaching shore. */
function serviceHost(stationId: MoonStationId = 'EAST', nowSecond = 0) {
  let state = createMoonServices('moon-service-component', 200), revision = 1000;
  const host: MoonHost = { actorId: 'same-living-player', eventId: 'service-1000', revision, week: 200,
    weekAnchor: 0, nowSecond, location: MOON_STATIONS.find(s => s.id === stationId)!.location,
    verifiedReceipts: [], sequence: 1, status: 'ACTIVE', cash: 200, actions: 3,
    health: 85, mind: 75, spirituality: 100, check: null };
  const station = () => state.stations.find(s => s.id === stationId)!;
  const command = (type: MoonServiceCommand['type']): MoonServiceCommand => ({ type, stationId });
  const step = (type: MoonServiceCommand['type']) => {
    host.eventId = `service-${revision}`; host.revision = revision++;
    const before = structuredClone(state), result = applyMoonService(state, command(type), host);
    expect(state).toEqual(before); expect(result.effect.cashGain).toBe(0);
    expect([result.effect.health, result.effect.mind, result.effect.spirituality]).toEqual([0, 0, 0]);
    state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds;
    return result;
  };
  const prepare = () => { step('INSPECT'); step('BUY_SUPPLIES'); step('FIT'); step('BOOK'); };
  const laterWeek = () => {
    host.week++; host.weekAnchor += 604800; host.nowSecond = host.weekAnchor;
    host.actions = 3; // Explicit next-week component input, not an effect of WAIT.
  };
  return { host, get state() { return state; }, station, command, step, prepare, laterWeek };
}

describe('Moon bounded night services: real adults, equipment, time and exits', () => {
  it('starts with exactly six distinct consenting adults at their own origin and three existing lamps/boats', () => {
    const r = serviceHost(), passengers = r.state.stations.flatMap(s => s.passengers);
    expect(passengers).toHaveLength(6); expect(new Set(passengers.map(p => p.id)).size).toBe(6);
    expect(new Set(passengers.map(p => p.name)).size).toBe(6);
    for (const p of passengers) expect(p).toMatchObject({ age: expect.any(Number), location: p.origin, status: 'WAITING', consent: true, injuries: [] });
    expect(passengers.every(p => p.age > 18 && p.origin !== p.destination)).toBe(true);
    for (const [index, s] of r.state.stations.entries()) {
      expect(s.lamp).toMatchObject({ id: MOON_STATIONS[index]!.lampId, condition: 54, lit: false });
      expect(s.boat).toMatchObject({ id: MOON_STATIONS[index]!.boatId, condition: 78 });
      expect(s.stock.oil).toEqual([]); expect(s.operations).toEqual([]);
    }
    expect(moonVerifiedReceipts(r.state)).toEqual([]);
    expect(moonServiceBlock(r.state, r.command('VERIFY'), r.host)).not.toBeNull();
  });

  it('pays finite fittings/oil and moves the same pair only through timed boarding and actual disembarkation', () => {
    const r = serviceHost(), original = structuredClone(r.station()); r.prepare();
    expect(r.host).toMatchObject({ cash: 164, actions: 1, nowSecond: 4260, health: 85, mind: 75, spirituality: 100 });
    expect(r.station().supplier.crates).toBe(0); expect(r.station().stock.oil).toHaveLength(2);
    expect(r.station().lamp.id).toBe(original.lamp.id); expect(r.station().boat.id).toBe(original.boat.id);
    expect(r.station().lamp.fittedGlassId).toBe(`${original.lamp.id}:glass-1`);
    expect(r.station().boat.fittedRopeId).toBe(`${original.boat.id}:rope-1`);
    expect(moonServiceBlock(r.state, r.command('BUY_SUPPLIES'), r.host)).not.toBeNull();
    const beforeWait = { ...r.host }, waiting = r.step('WAIT');
    expect(waiting.effect).toMatchObject({ seconds: 67740, actions: 0, cashCost: 0, cashGain: 0 });
    expect(r.host).toMatchObject({ cash: beforeWait.cash, actions: beforeWait.actions, nowSecond: 72000, week: 200 });
    const service = r.step('CONDUCT_SERVICE');
    expect(service.effect).toMatchObject({ seconds: 3600, actions: 1, cashCost: 0 });
    expect(r.station().operations.map(o => [o.phase, o.second])).toEqual([
      ['PREFLIGHT', 72000], ['IGNITION', 72060], ['BOARD', 72180], ['DEPARTURE', 72300], ['DISEMBARK', 74400],
    ]);
    expect(r.station().operations.find(o => o.phase === 'BOARD')!.positions.every(p => p.location === original.boat.id)).toBe(true);
    expect(r.station().operations.find(o => o.phase === 'DISEMBARK')!.positions).toEqual(original.passengers.map(p => ({ id: p.id, location: p.destination })));
    expect(r.station().passengers.map(p => p.id)).toEqual(original.passengers.map(p => p.id));
    expect(r.station().passengers.every(p => p.status === 'ARRIVED' && p.location === p.destination)).toBe(true);
    expect(r.station()).toMatchObject({ lamp: { condition: 87, lit: false }, boat: { condition: 76 } });
    expect(r.station().consumedOil).toEqual([`${original.lamp.id}:oil-1`]);
    const people = structuredClone(r.station().passengers); r.step('VERIFY');
    expect(r.host).toMatchObject({ actions: 0, cash: 164, nowSecond: 75660 }); expect(r.station().passengers).toEqual(people);
    expect(r.station().status).toBe('VERIFIED'); expect(moonVerifiedReceipts(r.state)).toEqual([]);
    expect(moonServiceBlock(r.state, r.command('CONDUCT_SERVICE'), r.host)).not.toBeNull();
  });

  it('uses fixed absolute night/weather windows and exposes the closed night plus its later clear alternate', () => {
    expect(moonWindow(1, 'EAST')).toMatchObject({ id: 'MOON-NIGHT:EAST:1', startSecond: 158400, endSecond: 172800, weather: 'DANGEROUS' });
    expect(nextMoonWindow(86400, 'EAST', true)).toEqual(moonWindow(2, 'EAST'));
    expect(nextMoonWindow(86400, 'EAST')).toEqual(nextMoonWindow(86400, 'EAST'));
    const r = serviceHost('EAST', 86400); r.prepare();
    expect(moonServiceBlock(r.state, r.command('CONDUCT_SERVICE'), r.host)).toContain('入夜');
    const view = JSON.stringify(projectMoonServices(r.state, r.host.nowSecond));
    expect(view).toContain('大风'); expect(view).toContain('第3天'); expect(view).not.toMatch(/seed|cursor|sourceDigest/);
    r.step('WAIT'); const oil = [...r.station().stock.oil], before = { ...r.host }; r.step('CONDUCT_SERVICE');
    expect(r.station().bookings[0]!.status).toBe('CLOSED'); expect(r.station().operations).toEqual([]);
    expect(r.station().stock.oil).toEqual(oil); expect(r.station().passengers.every(p => p.location === p.origin)).toBe(true);
    expect(r.host).toMatchObject({ cash: before.cash, actions: before.actions, nowSecond: before.nowSecond + 60 });
    expect(r.station().arrivalEventId).toBeNull(); expect(moonServiceBlock(r.state, r.command('VERIFY'), r.host)).not.toBeNull();
    r.step('BOOK'); expect(r.station().bookings[1]!.window).toEqual(moonWindow(2, 'EAST'));
    r.step('WAIT'); r.step('CONDUCT_SERVICE'); r.step('VERIFY');
    expect(r.station().bookings.map(b => b.status)).toEqual(['CLOSED', 'ARRIVED']);
  });

  it('rejects insufficient remaining duration without ignition, arrival credit, refund or an action charge', () => {
    const r = serviceHost(); r.prepare();
    r.host.nowSecond = r.station().bookings[0]!.window.endSecond - 3599; // Explicit late arrival component input.
    const before = { ...r.host }, oil = [...r.station().stock.oil]; r.step('CONDUCT_SERVICE');
    expect(r.station().bookings[0]!.status).toBe('MISSED'); expect(r.station().stock.oil).toEqual(oil);
    expect(r.station().operations).toEqual([]); expect(r.station().arrivalEventId).toBeNull();
    expect(r.host).toMatchObject({ cash: before.cash, actions: before.actions, nowSecond: before.nowSecond + 60 });
    expect(r.station().passengers.every(p => p.location === p.origin && p.status === 'WAITING')).toBe(true);
    expect(moonServiceBlock(r.state, r.command('VERIFY'), r.host)).not.toBeNull();
  });

  it('retains actual damage, burned oil and failed booking; a paid spare repairs the same lamp before a distinct retry', () => {
    const r = serviceHost('NORTH'), ids = r.station().passengers.map(p => p.id), lampId = r.station().lamp.id;
    r.prepare(); r.step('WAIT'); r.step('CONDUCT_SERVICE');
    expect(r.station()).toMatchObject({ damaged: true, status: 'SUSPENDED', arrivalEventId: null, lamp: { id: lampId, condition: 55 } });
    expect(r.station().bookings[0]).toMatchObject({ status: 'INTERRUPTED', serviceId: 'NORTH:service-1' });
    expect(r.station().operations.map(o => [o.phase, o.second])).toEqual([
      ['PREFLIGHT', 72000], ['IGNITION', 72060], ['BOARD', 72180], ['INTERRUPTION', 72240], ['SHORE_RETURN', 74040],
    ]);
    expect(r.station().passengers.every(p => p.location === p.origin)).toBe(true);
    expect(moonServiceBlock(r.state, r.command('VERIFY'), r.host)).not.toBeNull();
    expect(moonServiceBlock(r.state, r.command('REPAIR_DAMAGE'), r.host)).not.toBeNull();
    const failed = structuredClone(r.station().bookings[0]); r.laterWeek(); r.step('BUY_SPARE'); r.step('REPAIR_DAMAGE');
    expect(r.host.cash).toBe(152); expect(r.station().supplier.spares).toBe(1); expect(r.station().installedSpareIds).toHaveLength(1);
    expect(r.station().lamp).toMatchObject({ id: lampId, condition: 90 });
    r.step('BOOK'); r.step('WAIT'); r.step('CONDUCT_SERVICE'); r.step('VERIFY');
    expect(r.station().bookings[0]).toEqual(failed); expect(r.station().bookings[1]).toMatchObject({ status: 'ARRIVED', serviceId: 'NORTH:service-2' });
    expect(r.station().passengers.map(p => p.id)).toEqual(ids); expect(r.station().consumedOil).toHaveLength(2); expect(r.station().stock.oil).toEqual([]);
  });

  it('actually withdraws crew permission, stops before departure and requires fresh consent on a new booking', () => {
    const r = serviceHost('REED'); r.prepare(); r.step('WAIT'); r.step('CONDUCT_SERVICE');
    expect(r.station().crew.willing).toBe(false); expect(r.station().bookings[0]!.permission).toBe(false);
    expect(r.station().operations.some(o => o.phase === 'DEPARTURE' || o.phase === 'DISEMBARK')).toBe(false);
    expect(r.station().passengers.every(p => p.location === p.origin)).toBe(true);
    expect(r.station().consumedOil).toHaveLength(1); expect(r.station().arrivalEventId).toBeNull();
    expect(moonServiceBlock(r.state, r.command('CONDUCT_SERVICE'), r.host)).not.toBeNull();
    r.laterWeek(); r.step('BOOK'); expect(r.station().crew.willing).toBe(true);
    expect(r.station().bookings[0]!.permission).toBe(false); expect(r.station().bookings[1]!.permission).toBe(true);
    r.step('WAIT'); r.step('CONDUCT_SERVICE'); r.step('VERIFY'); expect(r.station().status).toBe('VERIFIED');
  });

  it('checks current crew/passenger permission and real oil at ignition rather than trusting a prior booking', () => {
    const r = serviceHost(); r.prepare(); r.step('WAIT');
    const inputs = [
      (s: typeof r.state) => { s.stations[2]!.crew.willing = false; },
      (s: typeof r.state) => { s.stations[2]!.bookings[0]!.permission = false; },
      (s: typeof r.state) => { s.stations[2]!.passengers[0]!.consent = false; },
      (s: typeof r.state) => { s.stations[2]!.passengers[0]!.location = 'a-different-shore'; },
      (s: typeof r.state) => { s.stations[2]!.stock.oil = []; },
    ];
    for (const change of inputs) {
      const state = structuredClone(r.state); change(state); const before = structuredClone(state);
      expect(moonServiceBlock(state, r.command('CONDUCT_SERVICE'), r.host)).not.toBeNull();
      expect(() => applyMoonService(state, r.command('CONDUCT_SERVICE'), r.host)).toThrow(); expect(state).toEqual(before);
    }
  });

  it('charges each finite replacement oil order, waits for a later real week and never grants duplicate delivery', () => {
    const r = serviceHost(); r.step('INSPECT'); const initialCash = r.host.cash;
    for (let n = 0; n < 4; n++) {
      const oldOil = [...r.station().stock.oil]; r.step('ORDER_OIL');
      expect(r.station().stock.oil).toEqual(oldOil); expect(moonServiceBlock(r.state, r.command('RECEIVE_OIL'), r.host)).not.toBeNull();
      r.laterWeek(); r.step('RECEIVE_OIL');
      expect(moonServiceBlock(r.state, r.command('RECEIVE_OIL'), r.host)).not.toBeNull();
      expect(r.station().oilOrders[n]).toMatchObject({ receivedEventId: expect.any(String) });
    }
    expect(r.host.cash).toBe(initialCash - 48); expect(r.station().supplier.oilDeliveryStock).toBe(0);
    expect(new Set(r.station().stock.oil).size).toBe(4); expect(moonServiceBlock(r.state, r.command('ORDER_OIL'), r.host)).not.toBeNull();
  });

  it.each(['SUSPEND', 'SHORE_RETURN'] as const)('keeps %s available with zero cash/AP and retains damage, expenses and unmet destinations', type => {
    const r = serviceHost('NORTH'); r.prepare(); r.step('WAIT'); r.step('CONDUCT_SERVICE');
    r.host.cash = 0; r.host.actions = 0; const before = structuredClone(r.station()), second = r.host.nowSecond;
    expect(getMoonServiceActions(r.state, r.host).find(a => a.command.type === type)!.enabled).toBe(true);
    const fullJournal = structuredClone(r.state); fullJournal.journal = Array.from({ length: 512 }, () => structuredClone(fullJournal.journal[0]!));
    expect(moonServiceBlock(fullJournal, r.command(type), r.host)).toBeNull();
    const result = r.step(type); expect(result.effect).toMatchObject({ actions: 0, cashCost: 0, cashGain: 0, seconds: 1800 });
    expect(r.host).toMatchObject({ cash: 0, actions: 0, health: 85, mind: 75, spirituality: 100, nowSecond: second + 1800 });
    expect(r.station().lamp).toEqual(before.lamp); expect(r.station().consumedOil).toEqual(before.consumedOil);
    expect(r.station().passengers).toEqual(before.passengers); expect(r.station().arrivalEventId).toBeNull(); expect(moonVerifiedReceipts(r.state)).toEqual([]);
  });

  it('accepts only small commands, never caller-supplied authority or fabricated outcomes', () => {
    const r = serviceHost(); expect(validateMoonServiceCommand(r.command('BOOK'))).toBe(true);
    for (const extra of [{ permission: true }, { arrivals: 2 }, { nowSecond: 72000 }, { cash: 999 }, { roll: 1 }]) {
      expect(validateMoonServiceCommand({ ...r.command('CONDUCT_SERVICE'), ...extra })).toBe(false);
    }
    expect(validateMoonServiceCommand({ type: 'BOOK', stationId: 'NEW_FOURTH_STATION' })).toBe(false);
  });
});
