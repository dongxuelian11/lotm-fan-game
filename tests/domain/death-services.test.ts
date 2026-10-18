import { describe, expect, it } from 'vitest';
import type { DeathHost } from '../../src/domain/death/ports.js';
import type { DeathServiceCommand, DeathServiceId } from '../../src/domain/death/types.js';
import { applyDeathServices, canLeaveDeathServices, createDeathServices, deathServicesBlock,
  deathServiceVerifiedReceipts, deathServiceRequiredResources, leaveDeathServices, nextDeathServiceCommand, projectDeathServices,
  validateDeathServiceCommand } from '../../src/domain/death/services.js';

/** Directed module inputs, never an admitted save or a natural campaign. */
function scene() {
  const h: DeathHost = { eventId: 'service-1', revision: 1, week: 3331,
    date: { epoch: 'FIFTH_EPOCH', year: 1413, month: 4, day: 28 }, actorId: 'finite-actor', sourceDigest: 'component', sourceEra: 'POST_CYCLE',
    location: 'DE0-RESIDUE-ROOM', nowSecond: 0, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 100, actions: 8,
    health: 90, mind: 90, spirituality: 100, check: null, serviceReceipts: [], legacyAccess: null, succession: null,
    uniquenessCustodianPresent: false, recoveryPermission: null };
  let state = createDeathServices('finite-service', h.actorId, h.week, h.nowSecond);
  const step = (command: DeathServiceCommand) => {
    const before = structuredClone(state), hb = structuredClone(h), result = applyDeathServices(state, command, h);
    expect(state).toEqual(before); expect(h).toEqual(hb);
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions; h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    h.revision++; h.eventId = `service-${h.revision}`; return result;
  };
  const run = (types: DeathServiceCommand['type'][], serviceId: DeathServiceId) => {
    for (const type of types) step({ type, serviceId } as DeathServiceCommand);
  };
  const residue = () => run(['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER', 'VERIFY_SERVICE'], 'residue-sealing');
  const wharf = (reverse = false) => {
    h.location = 'DE0-OLD-WHARF';
    run(['ASK_PERMISSION', 'SURVEY', 'BUY_SUPPLIES', 'LAY_ROPE', 'SUPPORT_BRIDGE'], 'old-wharf-exit');
    for (const workerId of (reverse ? ['DE0-WHARF-WORKER-2', 'DE0-WHARF-WORKER-1'] : ['DE0-WHARF-WORKER-1', 'DE0-WHARF-WORKER-2']) as ('DE0-WHARF-WORKER-1' | 'DE0-WHARF-WORKER-2')[])
      step({ type: 'ESCORT_WORKER', serviceId: 'old-wharf-exit', workerId });
    step({ type: 'VERIFY_SERVICE', serviceId: 'old-wharf-exit' });
  };
  return { h, step, run, residue, wharf, get state() { return state; } };
}

describe('Death finite original services', () => {
  it('accepts only exact commands and starts with no permission', () => {
    const r = scene(); expect(r.state.residue.custodian.consent).toBeNull();
    expect(r.state.wharf.workers.every(p => p.consent === null)).toBe(true);
    expect(validateDeathServiceCommand({ type: 'SURVEY', serviceId: 'residue-sealing' })).toBe(true);
    for (const extra of [{ check: {} }, { cash: 999 }, { permission: true }, { health: 100 }, { success: true }])
      expect(validateDeathServiceCommand({ type: 'SURVEY', serviceId: 'residue-sealing', ...extra })).toBe(false);
    expect(deathServicesBlock(r.state, { type: 'SURVEY', serviceId: 'residue-sealing' }, r.h)).not.toBeNull();
  });
  it('seals and returns the same four portions for 4p, 2AP, 24m and 594 seconds', () => {
    const r = scene(), original = structuredClone(r.state.residue); r.residue();
    expect(r.h).toMatchObject({ cash: 96, actions: 6, nowSecond: 594, health: 90, mind: 90, spirituality: 100 });
    expect(r.state.residue.residue).toMatchObject({ id: original.residue.id, intelligent: false, total: 4, exposed: 0, contained: 4, dissipated: 0 });
    expect(r.state.residue.apparatus).toMatchObject({ containerId: original.apparatus.containerId, lid: 'CLOSED', seal: 'INTACT', containerPosition: 0, screenPosition: 6 });
    expect(r.state.residue.supply).toMatchObject({ stock: 0, holder: 'USED' });
    expect(deathServiceRequiredResources(r.state, 'DE0-RECEPTION')).toMatchObject({ serviceId: 'old-wharf-exit', cash: 4, actions: 1 });
    expect(r.state.journal.flatMap(e => e.movements).filter(m => m.actorId === r.h.actorId).reduce((n, m) => n + m.metres, 0)).toBe(24);
    expect(deathServiceVerifiedReceipts(r.state)).toHaveLength(1);
    expect(deathServicesBlock(r.state, { type: 'BUY_SUPPLIES', serviceId: 'residue-sealing' }, r.h)).not.toBeNull();
  });
  it.each([false, true])('escorts each original body independently, reverse=%s', reverse => {
    const r = scene(); r.wharf(reverse);
    expect(r.h).toMatchObject({ cash: 96, actions: 6, nowSecond: 660 });
    expect(r.state.wharf.workers.map(p => [p.position, p.health, p.energy, p.travelledMetres, p.elapsedSeconds])).toEqual([[12, 100, 74, 12, 12], [12, 100, 68, 12, 12]]);
    expect(r.state.wharf.workers[1].injuries).toContain('DE0-WHARF-WORKER-2:OLD-ANKLE-SPRAIN');
    expect(r.state.wharf.bridge.condition).toBe(48); expect(r.state.wharf.rope.condition).toBe(85);
    expect(r.state.wharf.arrivals).toHaveLength(2); expect(deathServiceVerifiedReceipts(r.state)).toHaveLength(1);
    expect(deathServicesBlock(r.state, { type: 'ESCORT_WORKER', serviceId: 'old-wharf-exit', workerId: 'DE0-WHARF-WORKER-1' }, r.h)).not.toBeNull();
  });
  it('does not reset refusal across stop, departure or the next week', () => {
    const r = scene(); r.state.residue.custodian.willingness = 'REFUSED';
    r.step({ type: 'ASK_PERMISSION', serviceId: 'residue-sealing' });
    r.step({ type: 'RETURN_ON_FOOT', serviceId: 'residue-sealing' });
    const departed = leaveDeathServices(r.state, r.h.location, 'DE0-RECEPTION', 'depart');
    r.h.week++; r.h.weekAnchor += 604800; r.h.nowSecond += 604800;
    expect(departed.residue.custodian.consent?.status).toBe('REFUSED');
    expect(deathServicesBlock(departed, { type: 'ASK_PERMISSION', serviceId: 'residue-sealing' }, r.h)).not.toBeNull();
    expect(deathServicesBlock(departed, { type: 'SURVEY', serviceId: 'residue-sealing' }, r.h)).not.toBeNull();
  });
  it('keeps paid stock during zero-cash exit and permits a fresh real visit', () => {
    const r = scene(); r.run(['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES'], 'residue-sealing');
    const bought = r.state.residue.supply.boughtEventId; r.h.cash = 0; r.h.actions = 0;
    r.step({ type: 'RETURN_ON_FOOT', serviceId: 'residue-sealing' });
    expect(canLeaveDeathServices(r.state, r.h.location)).toBe(true);
    expect(r.state.residue.supply).toMatchObject({ boughtEventId: bought, holder: 'PLAYER', position: 6, stock: 1 });
    expect(nextDeathServiceCommand(r.state, r.h)?.type).toBe('POSITION_SCREEN');
    r.h.actions = 2; r.run(['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER', 'VERIFY_SERVICE'], 'residue-sealing');
    expect(r.h.cash).toBe(0); expect(deathServiceVerifiedReceipts(r.state)).toHaveLength(1);
  });
  it('uses actual crossed-week timestamps and preserves completed receipts after departure', () => {
    const r = scene(); r.run(['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER'], 'residue-sealing');
    r.h.nowSecond = 604790; r.step({ type: 'RETURN_CONTAINER', serviceId: 'residue-sealing' }); r.step({ type: 'VERIFY_SERVICE', serviceId: 'residue-sealing' });
    const receipts = deathServiceVerifiedReceipts(r.state); expect(receipts[0]).toMatchObject({ passedWeek: 3332, reviewedWeek: 3332 });
    const away = leaveDeathServices(r.state, r.h.location, 'DE0-RECEPTION', 'depart');
    expect(deathServiceVerifiedReceipts(away)).toEqual(receipts);
    r.h.location = 'DE0-RECEPTION'; expect(nextDeathServiceCommand(away, r.h)).toEqual({ type: 'ASK_PERMISSION', serviceId: 'old-wharf-exit' });
    expect(projectDeathServices(away).lines.join('')).toContain('十八米公共岸路');
  });
  it('does not loop fresh permission and local exit when the next principal action is unaffordable', () => {
    const r = scene(); r.run(['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES'], 'residue-sealing');
    r.h.actions = 0;
    expect(nextDeathServiceCommand(r.state, r.h)?.type).toBe('RETURN_ON_FOOT');
    r.step({ type: 'RETURN_ON_FOOT', serviceId: 'residue-sealing' });
    expect(nextDeathServiceCommand(r.state, r.h)).toEqual({ type: 'POSITION_SCREEN', serviceId: 'residue-sealing' });
    expect(deathServiceRequiredResources(r.state, 'DE0-RECEPTION')).toMatchObject({ serviceId: 'residue-sealing', cash: 0, actions: 1 });
    expect(deathServicesBlock(r.state, nextDeathServiceCommand(r.state, r.h)!, r.h)).not.toBeNull();
    r.h.cash = 0; r.h.location = 'DE0-OLD-WHARF';
    expect(nextDeathServiceCommand(r.state, r.h)).toEqual({ type: 'BUY_SUPPLIES', serviceId: 'old-wharf-exit' });
  });
  it('keeps a real ordinary retreat when the original bridge is damaged', () => {
    const r = scene(); r.h.location = 'DE0-OLD-WHARF'; r.step({ type: 'ASK_PERMISSION', serviceId: 'old-wharf-exit' });
    r.state.wharf.bridge.passable = false; r.state.wharf.bridge.condition = 0; r.h.cash = 0; r.h.actions = 0;
    const result = r.step({ type: 'RETURN_ON_FOOT', serviceId: 'old-wharf-exit' });
    expect(result.effect).toMatchObject({ cashCost: 0, actions: 0, seconds: 23 });
    expect(r.state.wharf.playerPosition).toBe(12); expect(r.state.wharf.workers.every(p => p.position === 0)).toBe(true);
  });
});
