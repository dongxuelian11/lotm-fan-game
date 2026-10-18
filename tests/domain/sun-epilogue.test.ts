import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SunEffect, SunHost } from '../../src/domain/sun/ports.js';
import { applySunServices, createSunServices, type SunServiceCommand } from '../../src/domain/sun/services.js';
import { applySunEpilogue, createSunEpilogue, getSunEpilogueActions, projectSunEpilogue, sunEpilogueBlock, validateSunEpilogueCommand, validateSunEpilogueState, type SunEpilogueCommand } from '../../src/domain/sun/epilogue.js';
const RADIANCE = 'sun.s0.directed-solar-radiance', WARD = 'sun.s0.bounded-radiance-ward';

/** Both original services are performed by their real reducer. S0 host and
 * named rolls are controlled component inputs, not a natural promotion. */
function scene() {
  const h: SunHost = { eventId: 'sun-1', revision: 1, week: 200, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }, actorId: 'sun-incident-actor', sourceDigest: 'component-only',
    location: 'SUN0-WASHHOUSE', nowSecond: 36000, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 200, actions: 20, health: 100, mind: 100, spirituality: 120, check: null, serviceReceipts: [], legacyAccess: null, succession: null };
  const advance = (e: SunEffect) => { h.cash -= e.cashCost; h.actions -= e.actions; h.health = Math.max(0, h.health - e.health); h.mind = Math.max(0, h.mind - e.mind); h.spirituality -= e.spirituality; h.nowSecond += e.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; } if (h.health === 0 || h.mind === 0) h.status = 'DEAD'; h.revision++; h.eventId = `sun-${h.revision}`; h.check = null; };
  let services = createSunServices('sun-incident-component', h.actorId, h.week, h.nowSecond);
  const service = (command: SunServiceCommand) => { const result = applySunServices(services, command, h); services = result.state; advance(result.effect); };
  for (const type of ['SURVEY', 'STOP_SERVICE', 'BUY_SUPPLIES', 'COOL_AND_FIT', 'RUN_HEAT_SERVICE', 'VERIFY_SERVICE'] as const) service({ type, serviceId: 'washhouse-heat' });
  h.location = 'SUN0-STAIR'; for (const type of ['SURVEY', 'BUY_SUPPLIES', 'CLEAR_STAIR', 'CARRY_RESIDENT', 'VERIFY_SERVICE'] as const) service({ type, serviceId: 'stair-evacuation' });
  const serviceBytes = JSON.stringify(services); h.sequence = 0; h.location = 'SUN0-WASHHOUSE'; h.actions = 3;
  let state = createSunEpilogue(services, { week: h.week, nowSecond: h.nowSecond, actorId: h.actorId });
  const mastery: Record<string, number> = { [RADIANCE]: 0, [WARD]: 0, 'sun.s1.warm-radiance-guard': 0, 'sun.s1.focused-purification': 8 };
  const step = (type: SunEpilogueCommand['type'], roll = 20) => {
    h.check = type === 'DIRECTED_RADIANCE' ? resolveNormalCheck({ ability: 'will', baseAbility: 30, difficulty: 50, modifiers: [{ source: 'bounded local support', value: 30 }], roll }) : type === 'RADIANCE_WARD' ? resolveNormalCheck({ ability: 'knowledge', baseAbility: 25, difficulty: 45, modifiers: [{ source: 'bounded local support', value: 30 }], roll }) : null;
    const before = structuredClone(state), host = structuredClone(h), result = applySunEpilogue(state, { type }, h);
    expect(state).toEqual(before); expect(h).toEqual(host); expect(JSON.stringify(services)).toBe(serviceBytes); expect(result.effect.cashGain).toBe(0);
    state = result.state; for (const [id, value] of Object.entries(result.masteryGains)) mastery[id] = (mastery[id] ?? 0) + value; advance(result.effect); return result;
  };
  const block = (type: SunEpilogueCommand['type']) => sunEpilogueBlock(state, { type }, h);
  return { h, services, serviceBytes, step, block, mastery, get state() { return state; } };
}

describe('Sun finite heat incident and genuine ordinary rescue', () => {
  it('reuses the exact completed boiler, remaining fuel and residents without teleporting Lena back', () => {
    const r = scene(), original = r.services.sites[0]!;
    expect(r.state.heat).toMatchObject({ id: original.heat!.id, condition: original.heat!.condition - 10, repairedJoint: true, installedGasketIds: ['SUN0-GASKET-1', 'SUN0-GASKET-2'] });
    expect(r.state.heat.fuel.every(f => f.holder === 'BURNED')).toBe(true); expect(r.state.heat.cassette).toMatchObject({ contained: 0, exposed: 4, neutralized: 0, total: 4 });
    expect(r.state.resident).toMatchObject({ id: original.resident.id, position: 8, travelledMeters: original.resident.travelledMeters + 8, consent: 'UNASKED' });
    expect(r.state.shelteredResident).toEqual(r.services.sites[1]!.resident); expect(r.state.shelteredResident.injuries).toHaveLength(1);
    expect(() => createSunEpilogue(createSunServices('empty', r.h.actorId, 200, 0), { week: 200, nowSecond: 0 })).toThrow();
    expect(() => createSunEpilogue(r.services, { week: r.h.week, nowSecond: r.h.nowSecond, actorId: 'wrong' })).toThrow();
    expect(validateSunEpilogueState(r.state)).toBe(true);
  });

  it('provides full ordinary rescue with zero AP and cash while keeping all four residues physically sealed', () => {
    const r = scene(); r.h.actions = 0; r.h.cash = 0;
    r.step('OBSERVE'); expect(r.block('DIRECTED_RADIANCE')).not.toBeNull(); expect(r.block('RADIANCE_WARD')).not.toBeNull();
    r.step('CUTOFF_AND_SEAL'); expect(r.state.heat).toMatchObject({ cutoffClosed: true, pressure: 0, cassette: { contained: 4, exposed: 0, neutralized: 0 } });
    r.step('ORDINARY_EXIT'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', reported: true, resident: { position: 0, health: 100 }, arrival: { route: 'SIDE', residentMeters: 18, thermalHealthLoss: 0 } });
    expect(r.mastery).toEqual({ [RADIANCE]: 0, [WARD]: 0, 'sun.s1.warm-radiance-guard': 0, 'sun.s1.focused-purification': 8 });
    expect(r.h).toMatchObject({ cash: 0, actions: 0 }); expect(validateSunEpilogueState(r.state)).toBe(true);
  });

  it('pays for a successful directed window before separately purifying the same four original units', () => {
    const r = scene(); r.step('OBSERVE'); expect(r.block('DIRECTED_RADIANCE')).not.toBeNull(); r.step('OPEN_SIGHT_SLOT');
    const cash = r.h.cash, spiritual = r.h.spirituality; r.step('DIRECTED_RADIANCE');
    expect(r.h.cash).toBe(cash - 8); expect(r.h.spirituality).toBe(spiritual - 14); expect(r.mastery[RADIANCE]).toBe(0); expect(r.state.heat.cassette.exposed).toBe(4);
    expect(r.state.supplies.focus).toMatchObject({ stock: 0, purchased: true, spent: true }); expect(r.state.radiance.expiresSecond).toBe(r.h.nowSecond + 30);
    const applied = r.step('APPLY_PURIFICATION'); expect(applied.masteryGains).toEqual({ [RADIANCE]: 8 }); expect(r.state.heat.cassette).toMatchObject({ exposed: 0, neutralized: 4 });
    expect(r.block('DIRECTED_RADIANCE')).not.toBeNull(); expect(r.block('APPLY_PURIFICATION')).not.toBeNull(); expect(r.state.resident.position).toBe(8);
    r.step('CUTOFF_AND_SEAL'); r.step('ORDINARY_EXIT'); expect(r.state.heat.cassette.contained).toBe(0); expect(validateSunEpilogueState(r.state)).toBe(true);
  });

  it('has a physical opaque-shutter countermeasure invalidate an otherwise successful cast', () => {
    const r = scene(); r.step('OBSERVE'); r.step('OPEN_SIGHT_SLOT'); r.step('DIRECTED_RADIANCE'); const version = r.state.conditionVersion;
    r.step('CLOSE_SHUTTER'); expect(r.state.conditionVersion).toBe(version + 1); expect(r.state.radiance.expiresSecond).toBeNull(); expect(r.block('APPLY_PURIFICATION')).not.toBeNull();
    expect(r.mastery[RADIANCE]).toBe(0); expect(r.state.heat.cassette.exposed).toBe(4); expect(r.block('OPEN_SIGHT_SLOT')).not.toBeNull();
    r.h.actions = 0; r.h.cash = 0; r.step('CUTOFF_AND_SEAL'); r.step('ORDINARY_EXIT'); expect(r.state.resident.position).toBe(0);
  });

  it('does not give mastery for successful effects which expire before application', () => {
    const r = scene(); r.step('OBSERVE'); r.step('OPEN_SIGHT_SLOT'); r.step('DIRECTED_RADIANCE'); r.step('WAIT_STEAM');
    expect(r.block('APPLY_PURIFICATION')).not.toBeNull(); expect(r.state.radiance.passed).toBe(true); expect(r.mastery[RADIANCE]).toBe(0);
    r.step('RADIANCE_WARD'); r.step('WAIT_STEAM'); expect(r.state.ward.passed).toBe(true); expect(r.state.ward.expiresSecond).toBeNull();
    r.step('CUTOFF_AND_SEAL'); r.step('ORDINARY_EXIT'); expect(r.mastery[WARD]).toBe(0); expect(r.state.resident.health).toBe(100);
  });

  it('grants ward mastery only for one actual declared thermal hit during a real crossing', () => {
    const r = scene(); r.step('OBSERVE'); const cast = r.step('RADIANCE_WARD');
    expect(cast.effect).toMatchObject({ actions: 1, cashCost: 6, spirituality: 12, mind: 6 }); expect(r.mastery[WARD]).toBe(0);
    const crossing = r.step('GUIDE_SHORT_ROUTE'); expect(crossing.masteryGains).toEqual({ [WARD]: 8 });
    expect(r.state).toMatchObject({ resident: { position: 0, health: 100 }, arrival: { route: 'SHORT', residentMeters: 8, thermalHealthLoss: 0 }, ward: { applied: true } });
    expect(r.state.shield.condition).toBe(75); expect(r.block('GUIDE_SHORT_ROUTE')).not.toBeNull(); r.step('CUTOFF_AND_SEAL'); r.step('REPORT');
    expect(r.mastery['sun.s1.warm-radiance-guard']).toBe(0); expect(validateSunEpilogueState(r.state)).toBe(true);
  });

  it('charges failures, keeps injuries and consumed stock, and still permits zero-budget ordinary rescue', () => {
    const r = scene(); r.step('OBSERVE'); r.step('OPEN_SIGHT_SLOT'); const before = { cash: r.h.cash, health: r.h.health, spirit: r.h.spirituality };
    r.step('DIRECTED_RADIANCE', 90); r.step('RADIANCE_WARD', 90);
    expect(r.h.cash).toBe(before.cash - 14); expect(r.h.spirituality).toBe(before.spirit - 26); expect(r.h.health).toBeLessThan(before.health); expect(r.state.playerInjuries).toHaveLength(2);
    expect(r.block('DIRECTED_RADIANCE')).not.toBeNull(); expect(r.block('RADIANCE_WARD')).not.toBeNull(); expect(r.mastery[RADIANCE]).toBe(0); expect(r.mastery[WARD]).toBe(0);
    r.h.cash = 0; r.h.actions = 0; r.step('CUTOFF_AND_SEAL'); r.step('ORDINARY_EXIT'); r.step('REPORT');
    expect(r.state.heat.cassette.contained).toBe(4); expect(r.state.resident.position).toBe(0); expect(r.state.playerInjuries).toHaveLength(2); expect(validateSunEpilogueState(r.state)).toBe(true);
  });

  it('does not disguise an unprotected short route or withdrawal as an unharmed rescue', () => {
    const r = scene(); r.step('OBSERVE'); r.step('GUIDE_SHORT_ROUTE');
    expect(r.state.resident).toMatchObject({ position: 0, health: 92, injuries: [expect.stringContaining('烫伤')] }); expect(r.mastery[WARD]).toBe(0);
    const alone = scene(); alone.step('OBSERVE'); alone.h.actions = 0; alone.h.cash = 0; alone.step('WITHDRAW'); alone.step('REPORT');
    expect(alone.state).toMatchObject({ status: 'WITHDRAWN', resident: { position: 8 }, arrival: null, heat: { cutoffClosed: true, pressure: 0 } });
    expect(projectSunEpilogue(alone.state).story).toContain('仍在原8米');
  });

  it('preserves real death when a failed ability exhausts health and blocks further control', () => {
    const r = scene(); r.step('OBSERVE'); r.h.health = 1; r.step('RADIANCE_WARD', 100);
    expect(r.h.status).toBe('DEAD'); expect(r.state.status).toBe('WITHDRAWN'); expect(r.state.resident.position).toBe(8); expect(r.block('CUTOFF_AND_SEAL')).not.toBeNull(); expect(r.block('REPORT')).not.toBeNull();
    expect(r.state.supplies.strip.stock).toBe(0); expect(r.state.playerInjuries[0]!.severity).toBe('HEAVY');
  });

  it('supports later paid repair of the same boiler without replenishing fuel, residue or old injuries', () => {
    const r = scene(); r.step('OBSERVE'); r.step('WITHDRAW'); r.step('REPORT'); const beforeFuel = structuredClone(r.state.heat.fuel), residue = structuredClone(r.state.heat.cassette), sheltered = structuredClone(r.state.shelteredResident);
    r.h.cash = 0; r.h.actions = 0; expect(r.block('REPAIR_BOILER')).not.toBeNull(); r.h.cash = 12; r.h.actions = 1; // Explicit later-work component budget.
    r.step('REPAIR_BOILER'); expect(r.h.cash).toBe(0); expect(r.h.actions).toBe(0); expect(r.state.heat.condition).toBe(r.state.origin.heat.condition);
    expect(r.state.heat.fuel).toEqual(beforeFuel); expect(r.state.heat.cassette).toEqual(residue); expect(r.state.shelteredResident).toEqual(sheltered); expect(r.state.resident.position).toBe(8); expect(r.block('REPAIR_BOILER')).not.toBeNull();
  });

  it('rejects forged command fields, duplicated residues, invented rescue and overwritten application history', () => {
    expect(validateSunEpilogueCommand({ type: 'OBSERVE' })).toBe(true);
    for (const extra of [{ success: true }, { roll: 1 }, { permission: true }, { targetId: 'someone-else' }]) expect(validateSunEpilogueCommand({ type: 'RADIANCE_WARD', ...extra })).toBe(false);
    const r = scene(); r.step('OBSERVE'); r.step('CUTOFF_AND_SEAL'); r.step('ORDINARY_EXIT');
    for (const change of [(s: typeof r.state) => { s.heat.cassette.exposed = 4; }, (s: typeof r.state) => { s.ward.applied = true; }, (s: typeof r.state) => { s.resident.position = 8; }, (s: typeof r.state) => { s.heat.fuel[1]!.holder = 'OWNER'; }]) { const changed = structuredClone(r.state); change(changed); expect(validateSunEpilogueState(changed)).toBe(false); }
    expect(JSON.stringify(projectSunEpilogue(r.state))).not.toContain('sourceDigest');
  });

  it('keeps visible affordable safety actions after a failed cast', () => {
    const r = scene(); r.step('OBSERVE'); r.step('RADIANCE_WARD', 90); r.h.actions = 0; r.h.cash = 0;
    const actions = getSunEpilogueActions(r.state, r.h);
    expect(actions.find(a => a.command.type === 'CUTOFF_AND_SEAL')).toMatchObject({ enabled: true }); expect(actions.find(a => a.command.type === 'WITHDRAW')).toMatchObject({ enabled: true });
    expect(actions.find(a => a.command.type === 'STOP_EFFECTS')).toMatchObject({ enabled: true });
  });
});
