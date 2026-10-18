import { describe, expect, it } from 'vitest';
import type { DoorHost, DoorModuleResult } from '../../src/domain/door/ports.js';
import { DOOR_JOBS, applyDoorService, applyDoorSiteChange, canLeaveDoorServices,
  createDoorServices, doorServiceLocation, doorServiceVerifiedReceipts, doorServicesBlock,
  doorServicesComplete, getDoorServiceActions, nextDoorServiceCommand, projectDoorServices,
  validateDoorServiceCommand, validateDoorServicesState,
  type DoorJobId, type DoorServiceCommand, type DoorServicesState, type DoorSiteChange,
} from '../../src/domain/door/services.js';
import { DOOR_JOB_IDS } from '../../src/domain/door/service-types.js';

/** Pure component hosts. These explicit resources and site changes are not a
 * claim of natural campaign travel, weekly settlement or completed promotion. */
function scene(id: DoorJobId = 'ledger-threshold') {
  const h: DoorHost = { eventId: 'door-service-1', revision: 1, week: 218,
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 8, day: 25 }, actorId: 'door-service-actor',
    sourceDigest: 'component-only', location: doorServiceLocation(id), nowSecond: 36000,
    weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 100, actions: 20,
    health: 80, mind: 98, spirituality: 120, check: null, serviceReceipts: [], legacyAccess: null, succession: null };
  let state = createDoorServices('door-service-component', h.actorId, h.week, h.nowSecond);
  const accept = (result: DoorModuleResult<DoorServicesState>) => {
    expect(result.effect).toMatchObject({ cashGain: 0, health: 0, mind: 0, spirituality: 0, toLocation: null });
    expect(result.effect.seconds).toBeGreaterThan(0);
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions;
    h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    h.revision++; h.eventId = `door-service-${h.revision}`;
    return result;
  };
  const step = (command: DoorServiceCommand) => {
    const before = structuredClone(state), hostBefore = structuredClone(h);
    const result = applyDoorService(state, command, h);
    expect(state).toEqual(before); expect(h).toEqual(hostBefore);
    return accept(result);
  };
  const world = (change: DoorSiteChange) => {
    const before = structuredClone(state), hostBefore = structuredClone(h);
    const result = applyDoorSiteChange(state, change, h);
    expect(state).toEqual(before); expect(h).toEqual(hostBefore);
    return accept(result);
  };
  const walk = (end: 'FROM' | 'TO', jobId = id) => step({ type: 'WALK_BYPASS', jobId, end });
  const askAndSurvey = (jobId = id) => {
    step({ type: 'ENTER', jobId }); step({ type: 'ASK_PERSON', jobId, role: 'OWNER' });
    if (jobId === 'courtyard-stair') step({ type: 'ASK_PERSON', jobId, role: 'TRAVELLER' });
    step({ type: 'SURVEY_END', jobId, end: 'FROM' }); walk('TO', jobId);
    step({ type: 'ASK_PERSON', jobId, role: 'RECEIVER' }); step({ type: 'SURVEY_END', jobId, end: 'TO' }); walk('FROM', jobId);
  };
  const repairCommand = (jobId = id) => ({ type: DOOR_JOBS[jobId].repair, jobId }) as DoorServiceCommand;
  const transferCommand = (jobId = id) => ({ type: DOOR_JOBS[jobId].transfer, jobId }) as DoorServiceCommand;
  const prepare = (jobId = id) => { askAndSurvey(jobId); step({ type: 'BUY_SUPPLIES', jobId }); step(repairCommand(jobId)); };
  const resurvey = (jobId = id) => {
    step({ type: 'SURVEY_END', jobId, end: 'FROM' }); walk('TO', jobId);
    step({ type: 'SURVEY_END', jobId, end: 'TO' }); walk('FROM', jobId);
  };
  const arrive = (jobId = id) => { prepare(jobId); resurvey(jobId); step(transferCommand(jobId)); };
  const verify = (jobId = id) => {
    if (jobId === 'courtyard-stair') step({ type: 'ASK_PERSON', jobId, role: 'TRAVELLER' });
    step({ type: 'VERIFY_ARRIVAL', jobId });
  };
  const leave = (jobId = id) => {
    if (state.playerPosition === 'TO') step({ type: 'RETURN_ON_FOOT', jobId });
    step({ type: 'LEAVE', jobId });
  };
  const block = (command: DoorServiceCommand) => doorServicesBlock(state, command, h);
  return { h, step, world, walk, askAndSurvey, prepare, resurvey, arrive, verify, leave,
    repairCommand, transferCommand, block, get state() { return state; } };
}

describe('Door three finite ordinary services', () => {
  it('accepts only concrete intents, never supplied permissions, bodies, outcomes or world changes', () => {
    const command = { type: 'ENTER', jobId: 'ledger-threshold' } as const;
    expect(validateDoorServiceCommand(command)).toBe(true);
    for (const extra of [{ success: true }, { cash: 999 }, { consent: true }, { check: null }, { arrival: true }, { host: {} }])
      expect(validateDoorServiceCommand({ ...command, ...extra })).toBe(false);
    expect(validateDoorServiceCommand({ type: 'FIT_THRESHOLD', jobId: 'warehouse-gate' })).toBe(false);
    expect(validateDoorServiceCommand({ type: 'ASK_PERSON', jobId: 'ledger-threshold', role: 'TRAVELLER' })).toBe(false);
    expect(validateDoorServiceCommand({ type: 'SURVEY_END', jobId: 'ledger-threshold', end: 'REMOTE' })).toBe(false);
    expect(validateDoorServiceCommand({ type: 'PERSON_DECISION', jobId: 'courtyard-stair', role: 'TRAVELLER', response: 'ALLOW' })).toBe(false);
    expect(validateDoorServiceCommand({ type: 'ENTER', jobId: 'PW2-PARCEL' })).toBe(false);
  });

  it.each(DOOR_JOB_IDS)('completes %s using its original people, endpoints, finite kit and actual payload', id => {
    const r = scene(id), original = structuredClone(r.state.jobs[id]), d = DOOR_JOBS[id];
    r.arrive();
    expect(r.state.jobs[id].review).toBeNull(); expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
    expect(r.state.playerPosition).toBe('TO');
    expect(r.state.jobs[id].route).toMatchObject({ id: original.route.id, condition: d.initialCondition - 1,
      oldPartId: original.route.oldPartId, oldPartPosition: 'ASIDE', repaired: true });
    expect(r.state.jobs[id].supply).toMatchObject({ id: original.supply.id, units: 0, holder: 'INSTALLED' });
    const arrival = r.state.jobs[id].arrivals[0]!;
    expect(arrival).toMatchObject({ fromId: original.ends.FROM.id, toId: original.ends.TO.id,
      metres: d.directMetres, seconds: d.directMetres });
    const transit = r.state.journal.at(-1)!;
    expect(transit.effect).toMatchObject({ actions: 1, cashCost: 0, randomDraws: 0, seconds: d.handlingSeconds + d.directMetres });
    expect(transit.movements.map(m => [m.fromId, m.toId, m.metres])).toEqual([
      [d.ends.FROM.id, d.ends.TO.id, d.directMetres], [d.ends.FROM.id, d.ends.TO.id, d.directMetres],
    ]);
    const payload = r.state.jobs[id].payload;
    if (payload.kind === 'PERSON') {
      expect(payload.person).toMatchObject({ id: 'DR0-BEN', bodyId: 'DR0-BEN-BODY', position: 'TO',
        health: 100, energy: 76, travelledMetres: 10, injuries: [] });
      expect(r.block({ type: 'VERIFY_ARRIVAL', jobId: id })).toMatch(/重新询问/);
    } else expect(payload).toMatchObject({ id: original.payload.kind === 'CARGO' ? original.payload.id : '',
      units: 1, ownerId: d.owner.id, holderId: r.h.actorId, position: 'TO' });
    r.verify(); r.leave();
    expect(r.h).toMatchObject({ cash: 100 - d.pricePennies, actions: 18, health: 80, mind: 98, spirituality: 120 });
    expect(doorServiceVerifiedReceipts(r.state)).toEqual([expect.objectContaining({ serviceId: id,
      passedEventId: arrival.eventId, reviewedEventId: r.state.jobs[id].review!.eventId, passedWeek: 218, reviewedWeek: 218 })]);
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(true);
    expect(validateDoorServicesState(r.state)).toBe(true);
  });

  it('offers a finite playable route through all three jobs for exactly six AP and 24p', () => {
    const r = scene();
    for (let count = 0; count < 120; count++) {
      const next = nextDoorServiceCommand(r.state, r.h.location, r.h);
      if (!next) break;
      if (r.state.activeJobId === null) r.h.location = doorServiceLocation(next.jobId);
      expect(r.block(next)).toBeNull(); r.step(next);
    }
    expect(doorServicesComplete(r.state)).toBe(true); expect(r.state.activeJobId).toBeNull();
    expect(r.h).toMatchObject({ cash: 76, actions: 14, health: 80, mind: 98, spirituality: 120, week: 218 });
    // Ledger 563s + courtyard 727s + warehouse 761s, including both survey walks and exits.
    expect(r.h.nowSecond - 36000).toBe(2051);
    expect(r.state.journal.reduce((sum, e) => sum + e.effect.actions, 0)).toBe(6);
    expect(r.state.journal.every(e => e.effect.randomDraws === 0 && e.effect.cashGain === 0)).toBe(true);
    expect(r.state.journal.flatMap(e => e.consumedIds)).toEqual(DOOR_JOB_IDS.map(id => DOOR_JOBS[id].supplyId));
    expect(doorServiceVerifiedReceipts(r.state)).toHaveLength(3); expect(validateDoorServicesState(r.state)).toBe(true);
  });

  it('requires face-to-face separate permissions and a fresh physical survey of both ends after repair', () => {
    const r = scene(), jobId = 'ledger-threshold';
    r.step({ type: 'ENTER', jobId });
    expect(r.block({ type: 'ASK_PERSON', jobId, role: 'RECEIVER' })).toMatch(/当面/);
    r.step({ type: 'ASK_PERSON', jobId, role: 'OWNER' }); r.step({ type: 'SURVEY_END', jobId, end: 'FROM' });
    expect(r.state.jobs[jobId].permission.RECEIVER).toBeNull();
    expect(r.block({ type: 'BUY_SUPPLIES', jobId })).toMatch(/两端原人/);
    r.walk('TO'); r.step({ type: 'ASK_PERSON', jobId, role: 'RECEIVER' });
    expect(r.block({ type: 'SURVEY_END', jobId, end: 'FROM' })).toMatch(/走到/);
    r.step({ type: 'SURVEY_END', jobId, end: 'TO' }); r.walk('FROM');
    r.step({ type: 'BUY_SUPPLIES', jobId }); r.step(r.repairCommand());
    expect(r.state.jobs[jobId].surveyed).toEqual({ FROM: null, TO: null });
    expect(r.block(r.transferCommand())).toMatch(/重查/);
    r.step({ type: 'SURVEY_END', jobId, end: 'FROM' }); expect(r.block(r.transferCommand())).toMatch(/重查/);
    r.walk('TO'); r.step({ type: 'SURVEY_END', jobId, end: 'TO' }); r.walk('FROM');
    expect(r.block(r.transferCommand())).toBeNull();
  });

  it('leaves both input and host untouched on insufficient cash or AP, including post-mutation resource checks', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.askAndSurvey(); r.h.cash = 7;
    let before = structuredClone(r.state), host = structuredClone(r.h);
    expect(() => r.step({ type: 'BUY_SUPPLIES', jobId })).toThrow(/现金或行动不足/);
    expect(r.state).toEqual(before); expect(r.h).toEqual(host);
    r.h.cash = 8; r.step({ type: 'BUY_SUPPLIES', jobId }); r.h.actions = 0;
    before = structuredClone(r.state); host = structuredClone(r.h);
    expect(() => r.step(r.repairCommand())).toThrow(/现金或行动不足/);
    expect(r.state).toEqual(before); expect(r.h).toEqual(host);
    r.h.actions = 1; r.step(r.repairCommand()); r.resurvey();
    before = structuredClone(r.state); host = structuredClone(r.h);
    expect(() => r.step(r.transferCommand())).toThrow(/现金或行动不足/);
    expect(r.state).toEqual(before); expect(r.h).toEqual(host);
    expect(r.state.jobs[jobId].arrivals).toEqual([]);
  });

  it('never reissues bought or installed kits and does not restore original apparatus condition', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.prepare(); const supply = structuredClone(r.state.jobs[jobId].supply);
    expect(r.block({ type: 'BUY_SUPPLIES', jobId })).not.toBeNull();
    r.resurvey(); expect(r.block(r.repairCommand())).not.toBeNull();
    r.step({ type: 'STOP', jobId }); r.leave(); r.askAndSurvey();
    expect(r.state.jobs[jobId].supply).toEqual(supply);
    expect(r.state.jobs[jobId].route.condition).toBe(65);
    expect(r.block({ type: 'BUY_SUPPLIES', jobId })).not.toBeNull();
    expect(r.block(r.repairCommand())).not.toBeNull();
    expect(r.block(r.transferCommand())).toBeNull();
  });

  it('keeps ordinary cancellation and exit available with zero cash and AP before transport', () => {
    const r = scene('courtyard-stair'), jobId = 'courtyard-stair'; r.prepare(); r.walk('TO');
    r.h.cash = 0; r.h.actions = 0;
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(false);
    const stop = nextDoorServiceCommand(r.state, r.h.location, r.h)!; expect(stop.type).toBe('STOP'); r.step(stop);
    const before = r.h.nowSecond; const returned = r.step({ type: 'RETURN_ON_FOOT', jobId });
    expect(returned.effect).toMatchObject({ actions: 0, cashCost: 0, seconds: 26 });
    expect(r.h.nowSecond - before).toBe(26); r.step({ type: 'LEAVE', jobId });
    expect(r.state.jobs[jobId].payload).toMatchObject({ kind: 'PERSON', person: { position: 'FROM', energy: 80 } });
    expect(r.state.jobs[jobId].arrivals).toEqual([]); expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(true);
    expect(nextDoorServiceCommand(r.state, r.h.location, r.h)).toBeNull();
  });

  it('physically returns an unverified original chest after cancellation, without refund or copied stock', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.arrive(); const arrival = structuredClone(r.state.jobs[jobId].arrivals[0]);
    const supply = structuredClone(r.state.jobs[jobId].supply); r.h.cash = 0; r.h.actions = 0;
    r.step({ type: 'STOP', jobId }); r.leave();
    expect(r.state.jobs[jobId].payload).toMatchObject({ kind: 'CARGO', id: 'DR0-LEDGER-CHEST', units: 1,
      ownerId: 'DR0-ADA', holderId: 'DR0-ADA', position: 'FROM' });
    expect(r.state.jobs[jobId].arrivals).toEqual([arrival]); expect(r.state.jobs[jobId].supply).toEqual(supply);
    expect(r.state.jobs[jobId].route.condition).toBe(64); expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
    r.h.actions = 1; r.askAndSurvey(); r.step(r.transferCommand()); r.verify(); r.leave();
    expect(r.state.jobs[jobId].arrivals).toHaveLength(2); expect(r.state.jobs[jobId].route.condition).toBe(63);
    expect(r.state.journal.reduce((sum, e) => sum + e.effect.actions, 0)).toBe(3);
    expect(r.state.jobs[jobId].supply).toEqual(supply); expect(r.h.cash).toBe(0);
    expect(doorServiceVerifiedReceipts(r.state)).toHaveLength(1);
  });

  it('leaves the adult at his actual arrival after cancellation and later verifies that same arrival', () => {
    const r = scene('courtyard-stair'), jobId = 'courtyard-stair'; r.arrive();
    const arrived = structuredClone(r.state.jobs[jobId].payload), arrival = r.state.jobs[jobId].arrivals[0]!;
    r.h.cash = 0; r.h.actions = 0; r.step({ type: 'STOP', jobId }); r.leave();
    expect(r.state.jobs[jobId].payload).toEqual(arrived); expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
    r.step({ type: 'ENTER', jobId }); r.step({ type: 'ASK_PERSON', jobId, role: 'OWNER' });
    r.step({ type: 'SURVEY_END', jobId, end: 'FROM' }); r.walk('TO');
    r.step({ type: 'ASK_PERSON', jobId, role: 'RECEIVER' }); r.step({ type: 'SURVEY_END', jobId, end: 'TO' });
    r.verify(); r.leave();
    expect(r.state.jobs[jobId].payload).toEqual(arrived); expect(r.state.jobs[jobId].arrivals).toEqual([arrival]);
    expect(r.state.journal.reduce((sum, e) => sum + e.effect.actions, 0)).toBe(2);
    expect(doorServiceVerifiedReceipts(r.state)[0]!.passedEventId).toBe(arrival.eventId);
  });

  it('records refusal without turning it into consent and keeps zero-resource withdrawal possible', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.arrive();
    r.world({ type: 'PERSON_DECISION', jobId, role: 'RECEIVER', response: 'WITHDRAWN' });
    expect(r.state.jobs[jobId].permission.RECEIVER).toBeNull();
    r.step({ type: 'ASK_PERSON', jobId, role: 'RECEIVER' });
    expect(r.state.jobs[jobId].permission.RECEIVER!.response).toBe('WITHDRAWN');
    expect(r.state.jobs[jobId].receiver.willingness).toBe('WITHDRAWN');
    expect(r.block({ type: 'VERIFY_ARRIVAL', jobId })).toMatch(/两端原人/);
    r.h.cash = 0; r.h.actions = 0; r.step({ type: 'STOP', jobId }); r.leave();
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(true); expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
  });

  it('requires a new face-to-face request after permission changes, even when the new answer is ALLOW', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.askAndSurvey();
    const receiver = structuredClone(r.state.jobs[jobId].permission.RECEIVER);
    r.world({ type: 'PERSON_DECISION', jobId, role: 'OWNER', response: 'REFUSED' });
    r.world({ type: 'PERSON_DECISION', jobId, role: 'OWNER', response: 'ALLOW' });
    expect(r.state.jobs[jobId].permission.OWNER).toBeNull(); expect(r.state.jobs[jobId].permission.RECEIVER).toEqual(receiver);
    expect(r.block({ type: 'BUY_SUPPLIES', jobId })).toMatch(/两端原人/);
    r.step({ type: 'ASK_PERSON', jobId, role: 'OWNER' }); expect(r.block({ type: 'BUY_SUPPLIES', jobId })).toBeNull();
  });

  it('invalidates old endpoint permissions and surveys, and blocks a newly obstructed direct route', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.prepare(); r.resurvey();
    r.world({ type: 'END_CHANGED', jobId, end: 'TO', access: 'CLOSED' });
    expect(r.state.jobs[jobId].permission).toEqual({ OWNER: null, RECEIVER: null, TRAVELLER: null });
    expect(r.state.jobs[jobId].surveyed).toEqual({ FROM: null, TO: null });
    expect(r.block(r.transferCommand())).not.toBeNull();
    r.world({ type: 'END_CHANGED', jobId, end: 'TO', access: 'OPEN' });
    expect(r.block(r.transferCommand())).not.toBeNull();
    r.step({ type: 'STOP', jobId }); r.leave(); r.askAndSurvey();
    r.world({ type: 'DIRECT_ROUTE_BLOCKED', jobId }); expect(r.block(r.transferCommand())).not.toBeNull();
    r.h.cash = 0; r.h.actions = 0; r.step({ type: 'STOP', jobId }); r.leave();
    expect(r.state.jobs[jobId].route).toMatchObject({ repaired: true, passable: false, condition: 65 });
    expect(r.state.jobs[jobId].supply).toMatchObject({ units: 0, holder: 'INSTALLED' });
  });

  it('rejects stale person versions, absent or dead receivers, and forged original identities', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.arrive();
    const mutations: ((s: DoorServicesState) => void)[] = [
      s => { s.jobs[jobId].receiver.version++; },
      s => { s.jobs[jobId].receiver.position = 'AWAY'; },
      s => { s.jobs[jobId].receiver.status = 'DEAD'; },
      s => { s.jobs[jobId].receiver.bodyId = 'another-body'; },
      s => { const p = s.jobs[jobId].payload; if (p.kind === 'CARGO') p.id = 'PW2-PARCEL'; },
      s => { const p = s.jobs[jobId].payload; if (p.kind === 'CARGO') p.ownerId = r.h.actorId; },
    ];
    for (const mutate of mutations) {
      const invalid = structuredClone(r.state); mutate(invalid); const before = structuredClone(invalid);
      expect(() => applyDoorService(invalid, { type: 'VERIFY_ARRIVAL', jobId }, r.h)).toThrow();
      expect(invalid).toEqual(before); expect(validateDoorServicesState(invalid)).toBe(false);
    }
    const porter = scene('courtyard-stair'); porter.arrive();
    const wrongBody = structuredClone(porter.state), payload = wrongBody.jobs['courtyard-stair'].payload;
    if (payload.kind === 'PERSON') payload.person.bodyId = 'DR0-ADA-BODY';
    expect(() => applyDoorService(wrongBody, { type: 'ASK_PERSON', jobId: 'courtyard-stair', role: 'TRAVELLER' }, porter.h)).toThrow();
  });

  it('preserves completed historical receipts after later endpoint or permission changes', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.arrive(); r.verify(); r.leave();
    const receipt = structuredClone(doorServiceVerifiedReceipts(r.state));
    r.world({ type: 'END_CHANGED', jobId, end: 'TO', access: 'CLOSED' });
    r.world({ type: 'PERSON_DECISION', jobId, role: 'RECEIVER', response: 'WITHDRAWN' });
    r.world({ type: 'DIRECT_ROUTE_BLOCKED', jobId });
    expect(doorServiceVerifiedReceipts(r.state)).toEqual(receipt);
    expect(r.block({ type: 'ENTER', jobId })).not.toBeNull();
    expect(r.state.jobs[jobId].payload).toMatchObject({ position: 'TO', holderId: 'DR0-NELL', ownerId: 'DR0-ADA' });
    expect(validateDoorServicesState(r.state)).toBe(true);
  });

  it('binds identity, current physical location, unique events, revisions and actual time', () => {
    const r = scene(), jobId = 'ledger-threshold', enter = { type: 'ENTER', jobId } as const;
    for (const changed of [{ actorId: 'other' }, { location: 'REMOTE' }, { health: 0 }, { status: 'DEAD' as const },
      { nowSecond: 35999 }, { weekAnchor: 40000 }, { cash: -1 }, { actions: -1 }]) {
      expect(() => applyDoorService(r.state, enter, { ...r.h, ...changed })).toThrow();
    }
    r.step(enter); const original = r.state.journal[0]!;
    expect(() => applyDoorService(r.state, { type: 'STOP', jobId }, { ...r.h, eventId: original.id })).toThrow();
    expect(() => applyDoorService(r.state, { type: 'STOP', jobId }, { ...r.h, revision: original.revision })).toThrow();
    expect(() => applyDoorService(r.state, { type: 'STOP', jobId }, { ...r.h, nowSecond: original.beforeSecond })).toThrow();
    r.h.location = doorServiceLocation('warehouse-gate');
    expect(r.block({ type: 'ENTER', jobId: 'warehouse-gate' })).not.toBeNull();
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(false);
  });

  it('records the real arrival week when transport crosses a week boundary', () => {
    const r = scene(), jobId = 'ledger-threshold'; r.prepare(); r.resurvey(); r.h.nowSecond = 604790;
    r.step(r.transferCommand()); expect(r.h.week).toBe(219); r.verify();
    expect(doorServiceVerifiedReceipts(r.state)[0]).toMatchObject({ passedWeek: 219, reviewedWeek: 219 });
    expect(r.state.jobs[jobId].arrivals[0]!.second).toBe(604826);
    expect(validateDoorServicesState(r.state)).toBe(true);
  });

  it('reconstructs saved services and rejects forged results, materials, journal hosts or event order', () => {
    const r = scene(); r.arrive(); r.verify(); r.leave();
    const mutations: ((s: DoorServicesState) => void)[] = [
      s => { s.jobs['ledger-threshold'].route.condition = 65; },
      s => { s.jobs['ledger-threshold'].supply.units = 1; },
      s => { s.jobs['ledger-threshold'].review!.arrivalEventId = 'invented-arrival'; },
      s => { s.journal[0]!.host.cash = -1; },
      s => { s.journal.reverse(); },
    ];
    for (const mutate of mutations) {
      const invalid = structuredClone(r.state); mutate(invalid); expect(validateDoorServicesState(invalid)).toBe(false);
    }
  });

  it('does not repeatedly recommend entering a job whose participants have withdrawn', () => {
    const r = scene();
    r.world({ type: 'PERSON_DECISION', jobId: 'ledger-threshold', role: 'OWNER', response: 'WITHDRAWN' });
    expect(nextDoorServiceCommand(r.state, r.h.location, r.h)).toEqual({ type: 'ENTER', jobId: 'courtyard-stair' });
    r.world({ type: 'PERSON_DECISION', jobId: 'courtyard-stair', role: 'TRAVELLER', response: 'REFUSED' });
    r.world({ type: 'PERSON_DECISION', jobId: 'warehouse-gate', role: 'RECEIVER', response: 'WITHDRAWN' });
    expect(nextDoorServiceCommand(r.state, r.h.location, r.h)).toBeNull();
    expect(canLeaveDoorServices(r.state, r.h.location)).toBe(true);
    expect(doorServiceVerifiedReceipts(r.state)).toEqual([]);
  });

  it('projects current-site actions and natural public descriptions without private host data', () => {
    const r = scene();
    expect(getDoorServiceActions(r.state, r.h).every(a => a.command.jobId === 'ledger-threshold')).toBe(true);
    expect(getDoorServiceActions(r.state, r.h).filter(a => a.preferredAction).map(a => a.command)).toEqual([{ type: 'ENTER', jobId: 'ledger-threshold' }]);
    const snapshot = structuredClone(r.state); getDoorServiceActions(r.state, r.h); expect(r.state).toEqual(snapshot);
    const projected = JSON.stringify(projectDoorServices(r.state));
    expect(projected).toContain('三处普通交接'); expect(projected).toContain('24便士');
    for (const privateText of ['sourceDigest', 'candidate', 'STATIC', '仪式', 'randomCursor', 'host', 'PW2-PARCEL', 'WN3-PACKET', 'Rowan'])
      expect(projected).not.toContain(privateText);
  });
});
