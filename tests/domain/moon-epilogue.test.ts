import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { MOON_ABILITIES, MOON_ABILITY_IDS, MOON_STATIONS } from '../../src/domain/moon/content.js';
import type { MoonBudget } from '../../src/domain/moon/source.js';
import type { MoonHost } from '../../src/domain/moon/ports.js';
import { applyMoonService, createMoonServices, moonVerifiedReceipts, type MoonServiceCommand, type MoonStationId } from '../../src/domain/moon/services.js';
import { applyMoonEpilogue, createMoonEpilogue, getMoonEpilogueActions, moonEpilogueBlock, projectMoonEpilogue, validateMoonEpilogueCommand, type MoonEpilogueCommand } from '../../src/domain/moon/epilogue.js';

const controlledCheck = (roll: number) => resolveNormalCheck({ ability: 'will', baseAbility: 28, difficulty: 45,
  modifiers: [{ source: '已观察原水道、真实付费耗材与本人有限技巧', value: 30 }], roll });

/** Explicit finite component scene, not a natural S0 capture or a save accepted
 * by strict source validation. All people/equipment and service receipts below
 * come from the actual service reducer. Weekly AP, travel positions and the S0
 * budget are declared host inputs, never gifts from a technique or wait. */
function scene() {
  let services = createMoonServices('epilogue-component', 200), revision = 3000;
  const host: MoonHost = { actorId: 'same-original-player', eventId: 'service-3000', revision, week: 200, weekAnchor: 0,
    nowSecond: 0, location: MOON_STATIONS[0].location, verifiedReceipts: [], sequence: 1, status: 'ACTIVE',
    cash: 500, actions: 3, health: 85, mind: 90, spirituality: 100, check: null };
  const laterWeek = () => { host.week++; host.weekAnchor += 604800; host.nowSecond = host.weekAnchor; host.actions = 3; };
  const service = (stationId: MoonStationId, type: MoonServiceCommand['type']) => {
    host.eventId = `service-${revision}`; host.revision = revision++;
    const result = applyMoonService(services, { type, stationId }, host); services = result.state;
    host.actions -= result.effect.actions; host.cash -= result.effect.cashCost; host.nowSecond += result.effect.seconds;
  };
  for (const station of MOON_STATIONS) {
    host.location = station.location;
    if (station.id !== 'NORTH') laterWeek();
    for (const type of ['INSPECT', 'BUY_SUPPLIES', 'FIT', 'BOOK', 'WAIT', 'CONDUCT_SERVICE'] as const) service(station.id, type);
    if (station.incident !== 'NONE') {
      laterWeek();
      if (station.incident === 'DAMAGE') { service(station.id, 'BUY_SPARE'); service(station.id, 'REPAIR_DAMAGE'); }
      for (const type of ['BOOK', 'WAIT', 'CONDUCT_SERVICE'] as const) service(station.id, type);
    }
    service(station.id, 'VERIFY');
  }
  expect(moonVerifiedReceipts(services)).toHaveLength(6);
  const originalServices = structuredClone(services), b: MoonBudget = {
    week: host.week, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 1 }, actions: 3, cash: 100,
    health: 85, mind: 90, spirituality: 100, pollution: 10, injuries: [{ id: 'prior-ordinary-injury', severity: 'LIGHT', acquiredRevision: 2800, treatedRevision: null }],
    injuryRisk: 1, status: 'ACTIVE', sequence: 0, acting: 0,
    mastery: { 'moon.s1.beauty-form': 13, 'moon.s0.moonlit-channel': 0, 'moon.s0.gentle-crossing': 0 },
    coreStats: { physique: 33, perception: 29, will: 28, knowledge: 26 }, completedSources: ['moon-s1', 'moon-s0'],
  };
  let nowSecond = host.nowSecond, state = createMoonEpilogue(services, { week: b.week, nowSecond });
  const step = (type: MoonEpilogueCommand['type'], roll?: number) => {
    const beforeState = structuredClone(state), beforeServices = structuredClone(services);
    const result = applyMoonEpilogue(state, { type }, b, services, { eventId: `epilogue-${revision}`, revision: revision++, nowSecond, check: roll === undefined ? null : controlledCheck(roll) });
    expect(state).toEqual(beforeState); expect(services).toEqual(beforeServices);
    state = result.state; services = result.services; nowSecond += result.seconds; return result;
  };
  const east = () => services.stations.find(s => s.id === 'EAST')!;
  return { b, originalServices, get state() { return state; }, get services() { return services; }, get nowSecond() { return nowSecond; }, east, step };
}

describe('Moon finite S0 epilogue: original adults, paid objects and later real application', () => {
  it('adds exactly two bounded technique IDs and reuses the worn original boat, lamp, crew and six adults', () => {
    const r = scene(), old = r.originalServices.stations[2]!;
    expect(MOON_ABILITY_IDS).toEqual(['moon.s0.moonlit-channel', 'moon.s0.gentle-crossing']); expect(MOON_ABILITIES.map(a => a.id)).toEqual([...MOON_ABILITY_IDS]);
    expect(r.state).toMatchObject({ passengerIds: old.passengers.map(p => p.id), lampId: old.lamp.id, boatId: old.boat.id, crewId: old.crew.id, observed: false });
    expect(r.east().boat.condition).toBe(old.boat.condition - 4); expect(r.east().lamp).toEqual(old.lamp);
    expect(r.services.stations.flatMap(s => s.passengers)).toEqual(r.originalServices.stations.flatMap(s => s.passengers));
    expect(new Set(r.services.stations.flatMap(s => s.passengers.map(p => p.id))).size).toBe(6);
    expect(r.services.stations.slice(0, 2)).toEqual(r.originalServices.stations.slice(0, 2));
    expect(r.b.health).toBe(85); expect(r.b.injuries).toHaveLength(1); expect(controlledCheck(50).chance).toBe(76);
    for (const type of ['MOONLIT_CHANNEL', 'GENTLE_CROSSING'] as const) expect(moonEpilogueBlock(r.state, { type }, r.b, r.services, r.nowSecond)).not.toBeNull();
  });

  it('pays real oil/fitting and records successful checks without moving or healing anyone before actual transfer', () => {
    const r = scene(), people = structuredClone(r.east().passengers), injury = structuredClone(r.b.injuries), boat = r.east().boat.condition, start = r.nowSecond;
    expect(r.step('OBSERVE').seconds).toBe(300); r.step('MOONLIT_CHANNEL', 50);
    expect(r.state.channel).toMatchObject({ attempted: true, passed: true, active: true, actionsRemaining: 2, applied: false });
    expect(r.east().supplier.oilDeliveryStock).toBe(r.originalServices.stations[2]!.supplier.oilDeliveryStock - 1);
    expect(r.state.oilPurchased).toBe(1); expect(r.state.oilConsumedIds).toEqual([`${r.east().lamp.id}:epilogue-oil`]);
    expect(r.east().consumedOil).toContain(r.state.oilConsumedIds[0]); expect(r.east().passengers).toEqual(people);
    r.step('GENTLE_CROSSING', 50);
    expect(r.state.fitting).toEqual({ supplierStock: 0, purchased: 1, installed: 1, damaged: 0 });
    expect(r.state.crossing).toMatchObject({ attempted: true, passed: true, applied: false, expiresSecond: r.nowSecond + 60 });
    expect(r.state.channel.actionsRemaining).toBe(1);
    expect([r.b.cash, r.b.actions, r.b.health, r.b.spirituality, r.b.mind, r.b.pollution]).toEqual([80, 1, 85, 78, 76, 10]);
    expect(r.b.injuries).toEqual(injury); expect(r.east().boat.condition).toBe(boat); expect(r.east().passengers).toEqual(people);
    expect(r.b.mastery).toEqual({ 'moon.s1.beauty-form': 13, 'moon.s0.moonlit-channel': 0, 'moon.s0.gentle-crossing': 0 });
    expect(r.nowSecond).toBe(start + 360);
    expect(r.step('TRANSFER').seconds).toBe(30);
    expect(r.state).toMatchObject({ status: 'RESOLVED', transferred: true, channel: { applied: true, active: false }, crossing: { applied: true } });
    expect(r.east().passengers.map(p => p.id)).toEqual(people.map(p => p.id));
    expect(r.east().passengers.every(p => p.status === 'EVACUATED' && p.location === `${r.east().location}:inner-shore-refuge`)).toBe(true);
    expect(r.b.mastery).toEqual({ 'moon.s1.beauty-form': 13, 'moon.s0.moonlit-channel': 8, 'moon.s0.gentle-crossing': 8 });
    expect(r.east().boat.condition).toBe(boat - 1); expect(r.b.injuries).toEqual(injury); expect(r.b.actions).toBe(0);
    r.step('REPORT'); expect(r.state.reported).toBe(true); expect(r.state.journal.at(-1)!.summary).toContain('2名原乘客抵达');
    expect(moonEpilogueBlock(r.state, { type: 'REPORT' }, r.b, r.services, r.nowSecond)).not.toBeNull();
  });

  it('expires lighting after two actual scene actions and stability after sixty seconds without awarding mastery', () => {
    const r = scene(); r.step('OBSERVE'); r.step('MOONLIT_CHANNEL', 50); r.step('GENTLE_CROSSING', 50);
    const paid = [r.b.cash, r.b.actions, r.b.spirituality, r.b.mind];
    expect(r.step('MOOR').seconds).toBe(120);
    expect(r.state.channel).toMatchObject({ active: false, actionsRemaining: 0, applied: false });
    expect(r.state.crossing).toMatchObject({ expiresSecond: null, applied: false });
    expect([r.b.cash, r.b.actions, r.b.spirituality, r.b.mind]).toEqual(paid);
    expect(moonEpilogueBlock(r.state, { type: 'TRANSFER' }, r.b, r.services, r.nowSecond)).not.toBeNull();
    for (const type of ['MOONLIT_CHANNEL', 'GENTLE_CROSSING'] as const) expect(moonEpilogueBlock(r.state, { type }, r.b, r.services, r.nowSecond)).not.toBeNull();
    r.step('ORDINARY_LANTERN'); r.step('TRANSFER');
    expect(r.state.transferred).toBe(true); expect(r.b.mastery['moon.s0.moonlit-channel']).toBe(0); expect(r.b.mastery['moon.s0.gentle-crossing']).toBe(0);
    expect(r.state.oilConsumedIds).toHaveLength(2); expect(new Set(r.state.oilConsumedIds).size).toBe(2);
  });

  it('retains both failed checks, paid consumables, actual wounds and boat wear while ordinary zero-resource evacuation remains', () => {
    const r = scene(), oldPeople = structuredClone(r.east().passengers), oldBoat = r.east().boat.condition;
    r.step('OBSERVE'); r.step('MOONLIT_CHANNEL', 85); r.step('GENTLE_CROSSING', 85);
    expect(r.state.journal.filter(e => e.check).map(e => e.check!.tier)).toEqual(['FAILURE', 'FAILURE']);
    expect([r.b.cash, r.b.actions, r.b.health, r.b.spirituality, r.b.mind]).toEqual([80, 1, 69, 78, 70]);
    expect(r.state.fitting).toEqual({ supplierStock: 0, purchased: 1, installed: 0, damaged: 1 });
    expect(r.east().boat.condition).toBe(oldBoat - 4); expect(r.b.injuries).toHaveLength(3); expect(r.east().passengers).toEqual(oldPeople);
    r.b.cash = 0; r.b.actions = 0; const injury = structuredClone(r.b.injuries), second = r.nowSecond;
    for (const type of ['STOP_SERVICE', 'EVACUATE', 'WITHDRAW'] as const) expect(getMoonEpilogueActions(r.state, r.b, r.services, r.nowSecond).find(a => a.command.type === type)!.enabled).toBe(true);
    r.step('STOP_SERVICE'); r.step('EVACUATE'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', stopped: true, evacuated: true, transferred: false, reported: true });
    expect(r.nowSecond).toBe(second + 60 + 1800 + 30);
    expect([r.b.cash, r.b.actions, r.b.health, r.b.spirituality, r.b.mind]).toEqual([0, 0, 69, 78, 70]);
    expect(r.b.injuries).toEqual(injury); expect(r.east().boat.condition).toBe(oldBoat - 4);
    expect(r.b.mastery['moon.s0.moonlit-channel']).toBe(0); expect(r.b.mastery['moon.s0.gentle-crossing']).toBe(0);
    expect(r.east().passengers.map(p => p.id)).toEqual(oldPeople.map(p => p.id));
  });

  it('ends successful temporary effects on withdrawn permission and retains actual positions on ordinary departure', () => {
    const r = scene(); r.step('OBSERVE'); r.step('MOONLIT_CHANNEL', 50); r.step('GENTLE_CROSSING', 50);
    const people = structuredClone(r.east().passengers), paid = [r.b.cash, r.b.spirituality, r.b.mind], second = r.nowSecond;
    r.east().crew.willing = false; // Explicit current scene input: permission is actually withdrawn.
    expect(moonEpilogueBlock(r.state, { type: 'TRANSFER' }, r.b, r.services, r.nowSecond)).not.toBeNull();
    r.b.cash = 0; r.b.actions = 0; r.step('WITHDRAW');
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', transferred: false, evacuated: false, channel: { active: false, applied: false }, crossing: { expiresSecond: null, applied: false } });
    expect(r.nowSecond).toBe(second + 600); expect(r.east().passengers).toEqual(people);
    expect([r.b.spirituality, r.b.mind]).toEqual(paid.slice(1)); expect(r.b.health).toBe(85); expect(r.b.injuries).toHaveLength(1);
    r.step('REPORT'); expect(r.state.journal.at(-1)!.summary).toContain('0名原乘客抵达');
    expect(r.state.journal.at(-1)!.summary).toContain('2名仍在原彼岸');
    expect(r.b.mastery['moon.s0.moonlit-channel']).toBe(0); expect(r.b.mastery['moon.s0.gentle-crossing']).toBe(0);
  });

  it('requires real local oil and fitting stock and permits no free repeated attempt or caller outcome override', () => {
    const r = scene(); r.step('OBSERVE');
    const noOil = structuredClone(r.services); noOil.stations[2]!.supplier.oilDeliveryStock = 0;
    expect(moonEpilogueBlock(r.state, { type: 'MOONLIT_CHANNEL' }, r.b, noOil, r.nowSecond)).not.toBeNull();
    const noFitting = structuredClone(r.state); noFitting.fitting.supplierStock = 0;
    expect(moonEpilogueBlock(noFitting, { type: 'GENTLE_CROSSING' }, r.b, r.services, r.nowSecond)).not.toBeNull();
    expect(moonEpilogueBlock(r.state, { type: 'MOONLIT_CHANNEL' }, { ...r.b, cash: 11 }, r.services, r.nowSecond)).not.toBeNull();
    r.step('MOONLIT_CHANNEL', 85); r.step('GENTLE_CROSSING', 85);
    for (const type of ['MOONLIT_CHANNEL', 'GENTLE_CROSSING'] as const) expect(moonEpilogueBlock(r.state, { type }, r.b, r.services, r.nowSecond)).not.toBeNull();
    expect(validateMoonEpilogueCommand({ type: 'GENTLE_CROSSING' })).toBe(true);
    for (const extra of [{ roll: 1 }, { success: true }, { passengerIds: ['new-adult'] }, { free: true }]) expect(validateMoonEpilogueCommand({ type: 'GENTLE_CROSSING', ...extra })).toBe(false);
    const view = projectMoonEpilogue(r.state, r.services); expect(Object.keys(view).sort()).toEqual(['lines', 'nextStep', 'story']);
    expect(JSON.stringify(view)).not.toMatch(/seed|cursor|sourceDigest|beforeDigest|afterDigest|eventId/);
  });

  it('allows ordinary unobserved safe exit with zero cash/AP and never declares untransferred people rescued', () => {
    const r = scene(), people = structuredClone(r.east().passengers); r.b.cash = 0; r.b.actions = 0;
    r.step('WITHDRAW'); r.step('REPORT'); expect(r.state).toMatchObject({ observed: false, status: 'WITHDRAWN', reported: true });
    expect(r.east().passengers).toEqual(people); expect(r.state.channel.attempted).toBe(false); expect(r.state.crossing.attempted).toBe(false);
    expect(r.state.journal.at(-1)!.summary).toContain('0名原乘客抵达'); expect(r.b.health).toBe(85);
  });
});
