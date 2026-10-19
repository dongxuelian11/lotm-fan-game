import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SunHost } from '../../src/domain/sun/ports.js';
import { SUN_SERVICES, applySunServices, canLeaveSunServices, createSunServices, getSunServiceActions, nextSunServiceCommand, projectSunServices, sunServiceVerifiedReceipts, sunServicesBlock, sunServicesComplete, validateSunServiceCommand, validateSunServicesState, type SunServiceCommand, type SunServiceId } from '../../src/domain/sun/services.js';

/** Directed pure-module fixtures only. Host budgets/time/location are explicit
 * component inputs, never a claimed natural campaign or admitted S0 save. */
function scene() {
  const h: SunHost = { eventId: 'service-1', revision: 1, week: 196, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 3, day: 24 }, actorId: 'sun-component-actor', sourceDigest: 'component-only',
    location: 'SUN0-WASHHOUSE', nowSecond: 36000, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 100, actions: 8, health: 100, mind: 98, spirituality: 106, check: null, serviceReceipts: [], legacyAccess: null, succession: null };
  let state = createSunServices('sun-service-component', h.actorId, h.week, h.nowSecond);
  const step = (type: SunServiceCommand['type'], serviceId: SunServiceId = 'washhouse-heat') => {
    const before = structuredClone(state), hostBefore = structuredClone(h), result = applySunServices(state, { type, serviceId }, h);
    expect(state).toEqual(before); expect(h).toEqual(hostBefore); expect(result.injuries).toEqual([]); expect(result.effect).toMatchObject({ cashGain: 0, health: 0, mind: 0, spirituality: 0 });
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions; h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    h.revision++; h.eventId = `service-${h.revision}`; return result;
  };
  const heat = () => { for (const type of ['SURVEY', 'STOP_SERVICE', 'BUY_SUPPLIES', 'COOL_AND_FIT', 'RUN_HEAT_SERVICE', 'VERIFY_SERVICE'] as const) step(type); };
  const stair = () => { h.location = 'SUN0-STAIR'; for (const type of ['SURVEY', 'BUY_SUPPLIES', 'CLEAR_STAIR', 'CARRY_RESIDENT', 'VERIFY_SERVICE'] as const) step(type, 'stair-evacuation'); };
  const block = (type: SunServiceCommand['type'], serviceId: SunServiceId = 'washhouse-heat') => sunServicesBlock(state, { type, serviceId }, h);
  return { h, step, heat, stair, block, get state() { return state; } };
}

describe('Sun two deterministic resident services', () => {
  it('allows exact bounded intent only, with no supplied check, consent or material count', () => {
    const c = { type: 'SURVEY', serviceId: 'washhouse-heat' } as const;
    expect(validateSunServiceCommand(c)).toBe(true);
    for (const extra of [{ roll: 1 }, { success: true }, { consent: true }, { residentPosition: 0 }, { supplies: 999 }]) expect(validateSunServiceCommand({ ...c, ...extra })).toBe(false);
    expect(validateSunServiceCommand({ type: 'CARRY_RESIDENT', serviceId: 'washhouse-heat' })).toBe(false);
    expect(validateSunServiceCommand({ type: 'RUN_HEAT_SERVICE', serviceId: 'stair-evacuation' })).toBe(false);
    expect(validateSunServiceCommand({ type: 'BUILD', serviceId: 'washhouse-heat' })).toBe(false);
    const r = scene(); r.h.check = resolveNormalCheck({ baseAbility: 25, difficulty: 45, modifiers: [], roll: 1 });
    expect(() => r.step('SURVEY')).toThrow(/不接收/);
  });

  it('physically repairs the original heat joint and serves two original bundles for 18p and two AP', () => {
    const r = scene(), original = structuredClone(r.state.sites[0]!);
    r.step('SURVEY'); expect(r.block('RUN_HEAT_SERVICE')).not.toBeNull(); expect(canLeaveSunServices(r.state, r.h.location)).toBe(false);
    r.step('STOP_SERVICE'); r.step('BUY_SUPPLIES'); expect(r.h.cash).toBe(82);
    expect(r.state.sites[0]!.heat).toMatchObject({ id: original.heat!.id, repairedJoint: false, installedGasketIds: [] });
    r.step('COOL_AND_FIT'); expect(r.state.sites[0]!.heat).toMatchObject({ pressure: 0, oldGasketsWaste: 2, installedGasketIds: ['SUN0-GASKET-1', 'SUN0-GASKET-2'], repairedJoint: true });
    expect(r.state.sites[0]!.heat!.bundles.every(b => !b.washed)).toBe(true); expect(sunServiceVerifiedReceipts(r.state)).toEqual([]);
    r.step('RUN_HEAT_SERVICE'); expect(r.h.actions).toBe(6); expect(r.state.sites[0]!.heat!.fuel.map(f => f.holder)).toEqual(['BURNED', 'OWNER']);
    expect(r.state.sites[0]!.heat!.bundles.map(b => [b.id, b.washed, b.location])).toEqual([['SUN0-CLOTH-1', true, 'COURTYARD'], ['SUN0-CLOTH-2', true, 'COURTYARD']]);
    expect(r.state.sites[0]!.heat!.cassette).toEqual(original.heat!.cassette); expect(r.state.sites[0]!.resident).toMatchObject({ id: original.resident.id, position: 0, travelledMeters: 16 });
    expect(sunServiceVerifiedReceipts(r.state)).toEqual([]); r.step('VERIFY_SERVICE'); expect(sunServiceVerifiedReceipts(r.state)).toHaveLength(1);
    expect(r.block('BUY_SUPPLIES')).not.toBeNull(); expect(r.block('RUN_HEAT_SERVICE')).not.toBeNull(); expect(validateSunServicesState(r.state)).toBe(true);
  });

  it('clears the same ash cart before carrying the same injured adult to the courtyard', () => {
    const r = scene(); r.h.location = 'SUN0-STAIR'; const id = 'stair-evacuation', originalInjuries = [...r.state.sites[1]!.resident.injuries];
    r.step('SURVEY', id); r.step('BUY_SUPPLIES', id); expect(r.h.cash).toBe(88); expect(r.block('CARRY_RESIDENT', id)).not.toBeNull();
    r.step('CLEAR_STAIR', id); expect(r.state.sites[1]!.stair).toMatchObject({ cartId: 'SUN0-ASH-CART', cartPosition: -2, cartCleared: true });
    expect(r.state.sites[1]!.resident.position).toBe(12); expect(r.state.sites[1]!.completion).toBeNull(); expect(r.block('VERIFY_SERVICE', id)).not.toBeNull();
    r.step('CARRY_RESIDENT', id); expect(r.state.sites[1]!.resident).toMatchObject({ id: 'SUN0-LENA', position: 0, travelledMeters: 12, injuries: originalInjuries });
    expect(r.state.sites[1]!.stair!.slingInstalledId).toBe('SUN0-SLING-1'); expect(r.state.sites[1]!.apparatus).toMatchObject({ id: 'SUN0-STRETCHER-1', condition: 88 });
    r.step('VERIFY_SERVICE', id); expect(sunServiceVerifiedReceipts(r.state)[0]).toMatchObject({ serviceId: id, passedWeek: 196, reviewedWeek: 196 });
    expect(r.h.actions).toBe(6); expect(validateSunServicesState(r.state)).toBe(true);
  });

  it('finishes both jobs without any rolls, a new week or ability/mastery spending', () => {
    const r = scene(); r.heat(); r.stair();
    expect(r.h).toMatchObject({ cash: 70, actions: 4, health: 100, mind: 98, spirituality: 106, week: 196 });
    expect(sunServicesComplete(r.state)).toBe(true); expect(sunServiceVerifiedReceipts(r.state)).toHaveLength(2); expect(nextSunServiceCommand(r.state)).toBeNull();
    expect(r.state.journal.every(j => j.host.check === null)).toBe(true); expect(r.state.journal.reduce((sum, j) => sum + j.effect.actions, 0)).toBe(4);
    expect(new Set(r.state.journal.flatMap(j => j.consumedIds))).toEqual(new Set(['SUN0-GASKET-1', 'SUN0-GASKET-2', 'SUN0-OWNER-FUEL-1', 'SUN0-SLING-1']));
    expect(projectSunServices(r.state).lines.join('')).toContain('脚踝扭伤'); expect(validateSunServicesState(r.state)).toBe(true);
  });

  it('permits stop/return with no money or AP and resumes the same paid supplies later', () => {
    const r = scene(); r.step('SURVEY'); r.step('BUY_SUPPLIES'); const bought = r.state.sites[0]!.supplies.boughtEventId;
    r.h.cash = 0; r.h.actions = 0; expect(r.block('COOL_AND_FIT')).not.toBeNull(); r.step('RETURN_ON_FOOT');
    expect(canLeaveSunServices(r.state, r.h.location)).toBe(true); expect(r.state.sites[0]!.supplies.boughtEventId).toBe(bought); expect(r.state.sites[0]!.supplies.usedEventId).toBeNull();
    r.h.actions = 2; // Explicit component host, not a claim of free campaign recovery.
    r.step('COOL_AND_FIT'); r.step('RUN_HEAT_SERVICE'); r.step('VERIFY_SERVICE');
    expect(r.h.cash).toBe(0); expect(sunServiceVerifiedReceipts(r.state)).toHaveLength(1); expect(r.state.sites[0]!.supplies.boughtEventId).toBe(bought);
  });

  it('does not falsely evacuate someone when leaving before the actual carry', () => {
    const r = scene(); r.h.location = 'SUN0-STAIR'; const id = 'stair-evacuation';
    r.step('SURVEY', id); r.step('BUY_SUPPLIES', id); r.step('CLEAR_STAIR', id); r.h.cash = 0; r.h.actions = 0;
    r.step('STOP_SERVICE', id); r.step('RETURN_ON_FOOT', id);
    expect(r.state.sites[1]!.resident.position).toBe(12); expect(r.state.sites[1]!.completion).toBeNull(); expect(sunServiceVerifiedReceipts(r.state)).toEqual([]);
    expect(r.state.sites[1]!.supplies).toMatchObject({ stock: 0, boughtEventId: expect.any(String), usedEventId: null });
  });

  it('uses actual boundary-crossing completion time and allows same-day verification after it', () => {
    const r = scene(); r.step('SURVEY'); r.step('STOP_SERVICE'); r.step('BUY_SUPPLIES'); r.step('COOL_AND_FIT');
    r.h.nowSecond = 604790; r.step('RUN_HEAT_SERVICE'); expect(r.h.week).toBe(197); r.step('VERIFY_SERVICE');
    expect(sunServiceVerifiedReceipts(r.state)[0]).toMatchObject({ passedWeek: 197, reviewedWeek: 197 });
  });

  it('rejects forged final positions, invented material stock, reordered commands and replayed event IDs', () => {
    const r = scene(); r.heat(); r.stair();
    for (const change of [(s: typeof r.state) => { s.sites[1]!.resident.position = 12; }, (s: typeof r.state) => { s.sites[0]!.supplies.stock = 2; }, (s: typeof r.state) => { s.sites[0]!.heat!.fuel[1]!.holder = 'BURNED'; }, (s: typeof r.state) => { s.journal.reverse(); }]) {
      const altered = structuredClone(r.state); change(altered); expect(validateSunServicesState(altered)).toBe(false);
    }
    r.h.eventId = r.state.journal[0]!.id; expect(r.block('RETURN_ON_FOOT', 'stair-evacuation')).not.toBeNull();
  });

  it('exposes only the current site actions and a concrete next task without authority data in projection', () => {
    const r = scene(); expect(nextSunServiceCommand(r.state)).toEqual({ type: 'SURVEY', serviceId: 'washhouse-heat' });
    expect(getSunServiceActions(r.state, r.h).filter(a => a.preferredAction).map(a => a.command)).toEqual([{ type: 'SURVEY', serviceId: 'washhouse-heat' }]);
    expect(getSunServiceActions(r.state, r.h).filter(a => a.command.serviceId === 'stair-evacuation').every(a => !a.enabled)).toBe(true);
    expect(JSON.stringify(projectSunServices(r.state))).not.toContain('sourceDigest');
    expect(SUN_SERVICES.map(p => p.location)).toEqual(['SUN0-WASHHOUSE', 'SUN0-STAIR']);
  });
});
