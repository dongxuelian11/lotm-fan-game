/** Directed unit candidates only. NOT RUN: no natural 1868-command continuation,
 * compilation, fixture generation or live-product edits are claimed here. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  activeWormCount, canFogCommand, controlUnits, controlUnitIds, createFogState,
  fogConsumptionBlock, fogConsumptionEvidence, fogPreparedEvidenceMatches,
  fogProjection, fogActionProjection, fogTravelMetres, FOG_ROUTE, FOG_ROUTE_METRES,
  replayFog, transitionFog, validateFogCommand, validateFogState,
  type FogCommand, type FogHostFacts, type FogState,
} from '../../src/domain/fool/fog.js';
import { FOG_STATION_IDS, WORLD_HISTORY_DENOMINATOR, WORLD_HISTORY_DOMAINS, type FogStationId } from '../../src/domain/fool/fog-content.js';

const host = (): FogHostFacts => ({
  bodyId: 'player-body', week: 15971, nowSecond: 0, location: 'base', active: true, sequence: 1,
  health: 90, mind: 95, spirituality: 106, cash: 1000, actions: 100,
  controlPower: 100, activityEpoch: 0, townEpoch: 1, townRegionId: 'town-spirit-region-1',
  townPlot: 'new-alder-clearing', townOperatorAt: 'base',
  townResidents: Array.from({ length: 24 }, (_, i) => ({ bodyId: `town-being-${i + 1}:body`, wormId: `town-worm-${i + 1}`, location: 'new-alder-clearing' as const, controlled: true, health: 100 })),
  externalLiveWormIds: Array.from({ length: 24 }, (_, i) => `town-worm-${i + 1}`),
  cart: { id: 'town-cart-1', hired: true, holder: 'PLAYER', location: 'base', freeCapacityKg: 600 }, rolls: null, eventId: null,
});
class Driver {
  state: FogState; host: FogHostFacts;
  constructor(state?: FogState, facts = host()) { this.host = structuredClone(facts); this.state = state ? structuredClone(state) : createFogState(this.host); }
  act(command: FogCommand, rolls: number[] | null = null) {
    this.host.rolls = rolls;
    const r = transitionFog(this.state, command, this.host); this.state = r.state;
    this.host.actions -= r.cost.actions; this.host.cash -= r.cost.cash;
    this.host.spirituality -= r.cost.spirituality; this.host.mind = Math.max(0, this.host.mind - r.cost.mind); this.host.health = Math.max(0, this.host.health - r.cost.health);
    this.host.nowSecond += r.elapsedSeconds; this.host.location = r.location; this.host.townOperatorAt = r.location; this.host.cart.location = r.cartLocation;
    this.host.rolls = null; this.host.eventId = null; return r;
  }
  reject(command: FogCommand, match?: RegExp, rolls: number[] | null = null) {
    const before = structuredClone(this.state); this.host.rolls = rolls; const originalHost = structuredClone(this.host);
    if (match) assert.throws(() => transitionFog(this.state, command, this.host), match); else assert.throws(() => transitionFog(this.state, command, this.host)); assert.deepEqual(this.state, before); assert.deepEqual(this.host, originalHost); this.host.rolls = null;
  }
  week() { this.host.week++; this.host.nowSecond += 604800; this.host.activityEpoch++; this.host.actions = 100; this.act({ type: 'SYNC_HOST' }); }
  travel(to: FogHostFacts['location']) { return this.act({ type: 'TRAVEL', to }); }
  buy(stationId: FogStationId, maintenance = true) { this.act({ type: 'BUY_ANCHOR_KIT', stationId }); if (maintenance) this.act({ type: 'BUY_MAINTENANCE', stationId }); }
  prepare(stationId: FogStationId, rolls = [1, 1, 1, 1]) { this.travel(stationId); this.act({ type: 'DELIVER_STATION', stationId }); return this.act({ type: 'PREPARE_STATION', stationId }, rolls); }
}
let preparedCache: Driver | undefined;
function prepared(): Driver {
  if (!preparedCache) {
    const d = new Driver(); for (const at of FOG_STATION_IDS) d.buy(at);
    for (const at of FOG_STATION_IDS) d.prepare(at);
    d.travel('base'); preparedCache = d;
  }
  return new Driver(preparedCache.state, preparedCache.host);
}
function activated(returnToTown = true): Driver {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' });
  for (const stationId of FOG_STATION_IDS) { d.travel(stationId); d.act({ type: 'ACTIVATE_STATION', stationId }); }
  if (returnToTown) d.travel('new-alder-clearing'); return d;
}
const domainAt = (stationId: FogStationId, index = 0) => WORLD_HISTORY_DOMAINS.filter(d => d.stationId === stationId)[index]!.id;

test('01 full 64-domain world retains all 4096 units, 48 inaccessible domains and zero gifted worms/control', () => {
  const d = new Driver(); assert.equal(WORLD_HISTORY_DOMAINS.length, 64); assert.equal(WORLD_HISTORY_DENOMINATOR, 4096);
  assert.equal(new Set(WORLD_HISTORY_DOMAINS.flatMap(x => [...x.unitIds])).size, 4096);
  assert.equal(WORLD_HISTORY_DOMAINS.filter(x => !x.reachable).reduce((n, x) => n + x.units, 0), 3072);
  assert.equal(new Set(WORLD_HISTORY_DOMAINS.filter(x => x.reachable).map(x => x.sourceId)).size, 16);
  for (const at of FOG_STATION_IDS) assert.equal(WORLD_HISTORY_DOMAINS.filter(x => x.stationId === at).length, 4);
  assert.ok(WORLD_HISTORY_DOMAINS.every(x => x.spaceBoundary && x.timeBoundary && x.sourceDescription && x.seamIds.length === 5));
  assert.equal(activeWormCount(d.state), 0); assert.equal(controlUnits(d.state, d.host), 0); assert.equal(d.state.items.length, 0);
  assert.equal(d.state.sourceOriginals.length, 16); assert.ok(d.state.sourceOriginals.every(x => x.location.kind === 'SUPPLIER' && x.carrierItemId === null));
  assert.ok(validateFogState(d.state));
});

test('02 exact finite commands reject read-to-control, forged unit totals, rolls, seed and success input', () => {
  for (const command of [{ type: 'READ_HISTORY', units: 1024 }, { type: 'SET_CONTROL', ratio: .25 }, { type: 'PREPARE_STATION', stationId: 'quarry', success: true }, { type: 'ACTIVATE_STATION', stationId: 'quarry', roll: 1 }, { type: 'START_CIRCUIT', seed: 'good' }]) assert.equal(validateFogCommand(command), false);
  const d = new Driver(); assert.equal(canFogCommand(d.state, { type: 'START_CIRCUIT' }, d.host), false); assert.equal(controlUnits(d.state, d.host), 0);
});

test('03 original 25p cannot buy a 48p kit; no free original cart, capacity or materials', () => {
  const d = new Driver(); d.host.cash = 25; d.reject({ type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }, /money/);
  d.host.cash = 1000; d.host.cart.hired = false; d.reject({ type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }, /original town-cart/);
  d.host.cart.hired = true; d.host.cart.freeCapacityKg = 19; d.reject({ type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }, /capacity/);
  d.host.cart.freeCapacityKg = 20; const r = d.act({ type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }); assert.equal(r.cost.cash, 48);
  assert.equal(d.state.items.length, 5); assert.equal(d.state.sourceOriginals.filter(x => x.location.kind === 'CART').length, 4);
  d.reject({ type: 'BUY_MAINTENANCE', stationId: 'quarry' }, /capacity/);
});

test('04 money and reading do not deliver original packs or put the original body at a station', () => {
  const d = new Driver(); d.buy('quarry'); d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /actual original station/, [1, 1, 1, 1]);
  d.travel('quarry'); d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /base/, [1, 1, 1, 1]);
  d.act({ type: 'DELIVER_STATION', stationId: 'quarry' }); d.host.actions = 2;
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /actions/, [1, 1, 1, 1]);
  assert.equal(activeWormCount(d.state), 0); assert.equal(controlUnits(d.state, d.host), 0);
});

test('05 preparation pays exactly 48 spirituality and 32 mind for 16 real new worms, retains original 24', () => {
  const d = prepared(); assert.equal(activeWormCount(d.state), 16); assert.equal(d.host.externalLiveWormIds.length, 24);
  assert.equal(d.host.spirituality, 106 - 48); assert.equal(d.host.mind, 95 - 32); assert.equal(d.host.cash, 1000 - 4 * 48 - 4 * 8);
  assert.equal(controlUnits(d.state, d.host), 0); assert.equal(d.state.attempts.length, 16);
  for (const a of d.state.attempts) {
    assert.equal(a.traces.filter(t => t.kind === 'SPLIT').length, 1);
    assert.equal(a.traces.filter(t => t.kind === 'MOVE').length, 4);
    assert.deepEqual(a.traces.filter(t => t.kind === 'MOVE').map(t => Number(t.to.split(':').at(-1))), [16, 32, 48, 64]);
    assert.ok(a.success); assert.ok(a.traces.some(t => t.kind === 'SOURCE_MOUNT'));
  }
  assert.ok(d.state.worms.every(w => w.bodyId === 'player-body' && w.status === 'DORMANT'));
  assert.ok(d.state.journeys.every(j => j.bodyId === 'player-body' && j.endSecond - j.startSecond >= j.metres));
  assert.ok(validateFogState(d.state));
});

test('06 actual twenty-four town bodies, true operator location and shared fifty-worm capacity are mandatory', () => {
  const d = new Driver(); d.buy('quarry'); d.travel('quarry'); d.act({ type: 'DELIVER_STATION', stationId: 'quarry' });
  d.host.externalLiveWormIds.push(...Array.from({ length: 23 }, (_, i) => `old-other-${i}`));
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /fifty-worm/, [1, 1, 1, 1]);
  d.host.externalLiveWormIds.splice(24); d.host.townResidents[0]!.controlled = false;
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /twenty-four/, [1, 1, 1, 1]);
  d.host.townResidents[0]!.controlled = true; d.host.townOperatorAt = 'base';
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /position disagree/, [1, 1, 1, 1]);
});

test('07 a four-corridor batch commits all four rolls, worms and costs; one failure cannot erase its history', () => {
  const d = new Driver(); d.buy('quarry'); const r = d.prepare('quarry', [100, 1, 1, 1]);
  assert.equal(r.cost.actions, 3); assert.equal(r.cost.spirituality, 12); assert.equal(r.cost.mind, 8);
  assert.equal(d.state.attempts.length, 4); assert.equal(d.state.attempts.filter(a => !a.success).length, 1);
  assert.equal(activeWormCount(d.state), 4); assert.equal(d.state.worms.filter(w => w.status === 'TRAPPED').length, 1);
  assert.equal(d.state.items.filter(i => i.condition === 'DAMAGED').length, 1); assert.equal(controlUnits(d.state, d.host), 0);
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /same week/, [1]);
  assert.deepEqual(replayFog(d.state.origin, d.state.journal), d.state);
});

test('08 later repair only retries failed original corridor, reuses its real worm and migrates its single source original', () => {
  const d = new Driver(); d.buy('quarry'); d.prepare('quarry', [100, 1, 1, 1]);
  const oldFailed = structuredClone(d.state.attempts[0]!), oldSources = d.state.sourceOriginals.map(s => s.id);
  const successful = d.state.attempts.filter(a => a.success).map(a => a.id);
  d.travel('base'); d.week(); d.buy('quarry', false); d.travel('quarry'); d.act({ type: 'DELIVER_STATION', stationId: 'quarry' });
  const r = d.act({ type: 'PREPARE_STATION', stationId: 'quarry' }, [1]);
  assert.equal(r.cost.actions, 1); assert.equal(r.cost.spirituality, 0); assert.equal(r.cost.mind, 0); assert.equal(activeWormCount(d.state), 4);
  assert.equal(d.state.attempts.at(-1)!.wormId, oldFailed.wormId); assert.notEqual(d.state.attempts.at(-1)!.anchorItemId, oldFailed.anchorItemId);
  assert.ok(d.state.attempts.at(-1)!.traces.some(t => t.kind === 'EXIT'));
  assert.deepEqual(d.state.sourceOriginals.map(s => s.id), oldSources); assert.deepEqual(d.state.attempts[0], oldFailed);
  assert.ok(successful.every(id => d.state.corridors.some(c => c.proofAttemptId === id)));
  assert.equal(d.state.items.find(i => i.id === oldFailed.anchorItemId)!.condition, 'DAMAGED'); assert.ok(validateFogState(d.state));
});

test('09 exact private roll count is required before any irreversible batch cost or split', () => {
  const d = new Driver(); d.buy('quarry'); d.travel('quarry'); d.act({ type: 'DELIVER_STATION', stationId: 'quarry' });
  d.reject({ type: 'PREPARE_STATION', stationId: 'quarry' }, /Exact private rolls/, [1, 1, 1]);
  assert.equal(activeWormCount(d.state), 0); assert.equal(d.state.attempts.length, 0);
});

test('10 one original 946m circuit costs one action, four 4S/8p maintenance packs and 480 on-site seconds', () => {
  const d = prepared(), beforeSecond = d.host.nowSecond, beforeSpirit = d.host.spirituality, beforeActions = d.host.actions, beforeJourneys = d.state.journeys.length;
  d.act({ type: 'START_CIRCUIT' });
  for (let i = 0; i < 4; i++) {
    const stationId = FOG_STATION_IDS[i]!; d.travel(stationId); d.act({ type: 'ACTIVATE_STATION', stationId });
    assert.equal(controlUnits(d.state, d.host), (i + 1) * 256);
  }
  d.travel('new-alder-clearing'); assert.equal(FOG_ROUTE_METRES, 946); assert.equal(d.host.nowSecond - beforeSecond, 946 + 480);
  assert.equal(d.host.actions, beforeActions - 1); assert.equal(d.host.spirituality, beforeSpirit - 16);
  assert.equal(d.state.journeys.slice(beforeJourneys).reduce((n, j) => n + j.metres, 0), 946);
  assert.equal(d.state.items.filter(i => i.kind === 'MAINTENANCE' && i.condition === 'CONSUMED').length, 4);
  assert.equal(controlUnits(d.state, d.host), 1024); assert.equal(new Set(controlUnitIds(d.state, d.host)).size, 1024);
  assert.equal(fogConsumptionBlock(d.state, d.host), null);
});

test('11 route cannot teleport, skip a station or grant control by arriving there', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.reject({ type: 'TRAVEL', to: 'rain-ruin' }, /next leg/);
  d.travel('quarry'); assert.equal(controlUnits(d.state, d.host), 0);
  d.reject({ type: 'TRAVEL', to: 'reed-cave' }, /activate/);
  d.reject({ type: 'ACTIVATE_STATION', stationId: 'reed-cave' }, /current actual station/);
  assert.equal(d.state.worms.length, 16);
});

test('12 an actual changed corridor blocks deterministic maintenance without hiding the event or spending uncommitted costs', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.travel('quarry');
  d.act({ type: 'ACTIVATE_STATION', stationId: 'quarry' }); d.travel('reed-cave');
  d.host.eventId = 'reed-current-history-changed'; d.act({ type: 'APPLY_EVENT', eventId: 'reed-current-history-changed' });
  const before = structuredClone(d.state), spirit = d.host.spirituality, second = d.host.nowSecond;
  d.reject({ type: 'ACTIVATE_STATION', stationId: 'reed-cave' }, /must still be prepared/);
  assert.deepEqual(d.state, before); assert.equal(d.host.spirituality, spirit); assert.equal(d.host.nowSecond, second);
  assert.equal(controlUnits(d.state, d.host), 256); assert.equal(d.state.appliedEvents.length, 1);
  assert.equal(d.state.items.filter(i => i.kind === 'MAINTENANCE' && i.condition === 'CONSUMED').length, 1);
  d.act({ type: 'CANCEL_CIRCUIT' }); assert.equal(controlUnits(d.state, d.host), 0);
  const back = d.travel('base'); assert.equal(back.cost.actions, 0); assert.equal(activeWormCount(d.state), 16);
});

test('13 one real lost worm drops 1024 to 960, charges full original 10 mind/10 pollution and never respawns', () => {
  const d = activated(false); d.host.eventId = 'rain-worm-lost';
  assert.equal(controlUnits(d.state, d.host), 0, 'pending original events must resolve before drinking');
  const r = d.act({ type: 'APPLY_EVENT', eventId: 'rain-worm-lost' });
  assert.equal(r.cost.mind, 10); assert.equal(r.cost.pollution, 10); assert.equal(activeWormCount(d.state), 15); assert.equal(controlUnits(d.state, d.host), 960);
  assert.equal(d.state.worms.filter(w => w.status === 'LOST').length, 1); d.host.eventId = 'rain-worm-lost'; d.reject({ type: 'APPLY_EVENT', eventId: 'rain-worm-lost' }, /once/);
});

test('14 real recall costs 2S, walks back, merges into same body and removes only that 64-unit corridor', () => {
  const d = activated(false), domainId = domainAt('rain-ruin'); const r = d.act({ type: 'RECALL_WORM', domainId });
  assert.equal(r.cost.spirituality, 2); assert.equal(r.elapsedSeconds, 120); assert.equal(controlUnits(d.state, d.host), 960); assert.equal(activeWormCount(d.state), 15);
  assert.equal(d.state.worms.filter(w => w.status === 'RECALLED').length, 1); assert.equal(d.state.recalls.at(-1)!.at(-1)!.to, 'body:player-body');
});

test('15 expiry, rest, real week, original town change and consciousness interruption revoke current control', () => {
  for (const mutate of [
    (d: Driver) => { d.host.nowSecond = d.state.circuits.at(-1)!.deadlineSecond!; },
    (d: Driver) => { d.host.activityEpoch++; },
    (d: Driver) => { d.host.week++; d.host.nowSecond += 604800; },
    (d: Driver) => { d.host.townEpoch++; },
    (d: Driver) => { d.host.mind = 0; },
    (d: Driver) => { d.host.townResidents[0]!.controlled = false; },
  ]) { const d = activated(); mutate(d); assert.equal(controlUnits(d.state, d.host), 0); d.act({ type: 'SYNC_HOST' }); assert.equal(controlUnits(d.state, d.host), 0); assert.equal(activeWormCount(d.state), 16); assert.ok(validateFogState(d.state)); }
});

test('16 epoch event invalidates the actual corresponding proof and prepared snapshot without resetting old routes', () => {
  const d = activated(), evidence = fogConsumptionEvidence(d.state, d.host), attemptCount = d.state.attempts.length;
  assert.equal(fogPreparedEvidenceMatches(d.state, d.host, evidence), true);
  d.host.eventId = 'quarry-seam-reordered'; d.act({ type: 'APPLY_EVENT', eventId: 'quarry-seam-reordered' });
  assert.equal(controlUnits(d.state, d.host), 960); assert.equal(fogPreparedEvidenceMatches(d.state, d.host, evidence), false); assert.equal(d.state.attempts.length, attemptCount);
  d.reject({ type: 'ADVANCE_FOR_CONSUMPTION' }, /1024/);
});

test('17 original hardware erosion invalidates one corridor but retains its unique real source and all live worms', () => {
  const d = activated(), sources = structuredClone(d.state.sourceOriginals); d.host.eventId = 'salt-anchor-eroded'; d.act({ type: 'APPLY_EVENT', eventId: 'salt-anchor-eroded' });
  assert.equal(controlUnits(d.state, d.host), 960); assert.equal(activeWormCount(d.state), 16); assert.deepEqual(d.state.sourceOriginals, sources);
  assert.equal(d.state.items.filter(i => i.condition === 'DAMAGED').length, 1);
});

test('18 actual consumption must fit the full next 60 seconds; equality at expired deadline does not count', () => {
  const d = activated(); d.host.nowSecond = d.state.circuits.at(-1)!.deadlineSecond! - 60;
  assert.notEqual(fogConsumptionBlock(d.state, d.host), null); d.reject({ type: 'ADVANCE_FOR_CONSUMPTION' }, /60秒/);
  const other = activated(); other.host.nowSecond = other.state.circuits.at(-1)!.deadlineSecond! - 61;
  const r = other.act({ type: 'ADVANCE_FOR_CONSUMPTION' }); assert.equal(r.elapsedSeconds, 60); assert.equal(controlUnits(other.state, other.host), 1024);
  assert.equal(other.state.consumptionIntervals.length, 1); assert.ok(validateFogState(other.state));
});

test('19 replay rejects tampered costs, hosts, movements, state, source duplication and journal deletion', () => {
  const original = prepared().state;
  for (const change of [
    (s: FogState) => { s.journal[0]!.cost.cash = 0; },
    (s: FogState) => { s.journal[0]!.host.bodyId = 'copied-player'; },
    (s: FogState) => { s.attempts[0]!.traces.find(t => t.kind === 'MOVE')!.to = 'fake:64'; },
    (s: FogState) => { s.sourceOriginals.push(structuredClone(s.sourceOriginals[0]!)); },
    (s: FogState) => { s.journal.pop(); },
    (s: FogState) => { s.nowSecond = 0; },
  ]) { const tampered = structuredClone(original); change(tampered); assert.equal(validateFogState(tampered), false); assert.equal(controlUnits(tampered, prepared().host), 0); }
  assert.deepEqual(replayFog(original.origin, original.journal), original);
});

test('20 projection exposes four natural station cards, live ratio and timer, never private rolls or journal', () => {
  const d = activated(), projection = fogProjection(d.state, d.host), json = JSON.stringify(projection);
  assert.equal(projection.stations.length, 4); assert.equal(projection.ratio, .25); assert.equal(projection.totalSharedWorms, 40);
  assert.ok(projection.remainingSeconds > 60); assert.equal(projection.routeMetres, 946);
  for (const privateKey of ['"rolls":', '"seed":', '"journal":', '"host":', '"traces":']) assert.equal(json.includes(privateKey), false);
  const before = structuredClone(d.state); fogProjection(d.state, d.host); assert.deepEqual(d.state, before);
});

test('21 cancel is a normal zero-cost retreat with dormant worms retained, not a controller reset', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.travel('quarry'); d.act({ type: 'ACTIVATE_STATION', stationId: 'quarry' });
  d.host.spirituality = 0; const r = d.act({ type: 'CANCEL_CIRCUIT' }); assert.equal(r.cost.spirituality, 0); assert.equal(controlUnits(d.state, d.host), 0);
  const back = d.travel('base'); assert.equal(back.cost.actions, 0); assert.equal(activeWormCount(d.state), 16); assert.equal(d.state.attempts.length, 16);
  d.reject({ type: 'START_CIRCUIT' }, /already attempted/);
});

test('22 real position, original cart cargo and original game time cannot silently teleport or freeze', () => {
  const d = new Driver(); d.buy('quarry'); d.host.location = 'quarry'; d.host.townOperatorAt = 'quarry'; d.host.nowSecond += 190; d.host.cart.location = 'quarry';
  d.reject({ type: 'SYNC_HOST' }, /recorded travel/);
  const e = new Driver(); e.host.week++; e.reject({ type: 'SYNC_HOST' }, /real week/);
  assert.equal(FOG_ROUTE.slice(1).reduce((n, to, i) => n + fogTravelMetres(FOG_ROUTE[i]!, to), 0), 946);
});


test('23 a real new-week four-action budget covers one original outbound trip plus the three-action station batch', () => {
  const d = new Driver(); d.host.actions = 4; d.buy('quarry');
  const travel = d.travel('quarry'); assert.equal(travel.cost.actions, 1); assert.equal(d.host.actions, 3);
  d.act({ type: 'DELIVER_STATION', stationId: 'quarry' });
  const prepare = d.act({ type: 'PREPARE_STATION', stationId: 'quarry' }, [1, 1, 1, 1]);
  assert.equal(prepare.cost.actions, 3); assert.equal(d.host.actions, 0);
  const retreat = d.travel('base'); assert.equal(retreat.cost.actions, 0); assert.equal(d.host.actions, 0);
  assert.equal(d.state.worms.length, 4); assert.equal(controlUnits(d.state, d.host), 0);
});


test('24 a displaced real anchor and its unique source move together; no old 64-unit claim survives', () => {
  const d = activated(), domainId = domainAt('salt-vault');
  const original = structuredClone(d.state.sourceOriginals.find(x => x.domainId === domainId)!);
  d.host.eventId = 'salt-anchor-displaced'; d.act({ type: 'APPLY_EVENT', eventId: 'salt-anchor-displaced' });
  const source = d.state.sourceOriginals.find(x => x.domainId === domainId)!;
  assert.equal(source.id, original.id); assert.equal(source.carrierItemId, original.carrierItemId);
  assert.deepEqual(source.location, { kind: 'HISTORY', domainId, offset: 48 });
  assert.equal(controlUnits(d.state, d.host), 960); assert.equal(activeWormCount(d.state), 16); assert.ok(validateFogState(d.state));
});

test('25 the finite current-history event targets a genuinely open current-and-undated domain', () => {
  const d = activated(); d.host.eventId = 'reed-current-history-changed';
  d.act({ type: 'APPLY_EVENT', eventId: 'reed-current-history-changed' });
  const event = d.state.appliedEvents.at(-1)!;
  assert.equal(WORLD_HISTORY_DOMAINS.find(x => x.id === event.domainId)!.eraId, 'current-and-undated');
  assert.equal(event.nextEpoch, event.previousEpoch + 1); assert.equal(controlUnits(d.state, d.host), 960);
});


test('26 displaced then damaged original source is picked up at48 and physically carried on new hardware to64', () => {
  const d = activated(), domainId = domainAt('salt-vault');
  const sourceId = d.state.sourceOriginals.find(x => x.domainId === domainId)!.id;
  for (const eventId of ['salt-anchor-displaced', 'salt-anchor-eroded'] as const) { d.host.eventId = eventId; d.act({ type: 'APPLY_EVENT', eventId }); }
  d.act({ type: 'CANCEL_CIRCUIT' }); d.travel('base'); d.week(); d.buy('salt-vault', false);
  d.travel('salt-vault'); d.act({ type: 'DELIVER_STATION', stationId: 'salt-vault' });
  d.act({ type: 'PREPARE_STATION', stationId: 'salt-vault' }, [1]);
  const attempt = d.state.attempts.at(-1)!;
  assert.ok(attempt.traces.some(t => t.kind === 'PICKUP' && t.objectId === sourceId && t.from === `${domainId}:48`));
  assert.ok(attempt.traces.some(t => t.kind === 'MOVE' && t.from === `${domainId}:48` && t.to === `${domainId}:64` && t.carriedObjectIds.includes(sourceId) && t.carriedObjectIds.includes(attempt.anchorItemId)));
  assert.equal(attempt.traces.find(t => t.kind === 'SOURCE_MOUNT')!.from, `${domainId}:64`);
  assert.equal(d.state.sourceOriginals.filter(s => s.id === sourceId).length, 1); assert.ok(validateFogState(d.state));
});

test('27 a real town-control failure cancels fog but still allows ordinary physical retreat to base without spirituality', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.travel('quarry');
  d.act({ type: 'ACTIVATE_STATION', stationId: 'quarry' });
  d.host.townResidents[0]!.controlled = false; d.host.spirituality = 0;
  const r = d.travel('base'); assert.equal(r.cost.actions, 0); assert.equal(r.cost.spirituality, 0);
  assert.equal(controlUnits(d.state, d.host), 0); assert.equal(d.host.townResidents[0]!.controlled, false); assert.equal(activeWormCount(d.state), 16);
});


test('28 final station maintenance consumes zero RNG and rejects all private rolls, even favourable ones', () => {
  const d = prepared(); d.host.controlPower = 0; d.act({ type: 'START_CIRCUIT' });
  for (const stationId of FOG_STATION_IDS) {
    d.travel(stationId);
    d.reject({ type: 'ACTIVATE_STATION', stationId }, /consumes no private random rolls/, [1, 1, 1, 1]);
    d.reject({ type: 'ACTIVATE_STATION', stationId }, /consumes no private random rolls/, [100]);
    d.host.rolls = [1, 1, 1, 1]; assert.equal(canFogCommand(d.state, { type: 'ACTIVATE_STATION', stationId }, d.host), false); d.host.rolls = null;
    d.act({ type: 'ACTIVATE_STATION', stationId });
  }
  d.travel('new-alder-clearing'); assert.equal(controlUnits(d.state, d.host), 1024);
  const activations = d.state.journal.filter(e => e.command.type === 'ACTIVATE_STATION');
  assert.equal(activations.length, 4); assert.ok(activations.every(e => e.host.rolls === null));
  assert.equal(d.state.maintenance.flatMap(m => m.results).length, 16);
  assert.ok(d.state.maintenance.every(m => m.results.every(r => r.success))); assert.ok(validateFogState(d.state));
});

test('29 deterministic activation still requires actual 4S and locally delivered original maintenance material', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.travel('quarry'); d.host.spirituality = 3;
  d.reject({ type: 'ACTIVATE_STATION', stationId: 'quarry' }, /spirituality/);
  assert.equal(d.state.maintenance.length, 0); assert.equal(d.state.items.filter(i => i.condition === 'CONSUMED').length, 0);
  d.host.spirituality = 4; const r = d.act({ type: 'ACTIVATE_STATION', stationId: 'quarry' });
  assert.equal(r.cost.spirituality, 4); assert.equal(r.elapsedSeconds, 120); assert.equal(d.host.spirituality, 0);
  assert.equal(d.state.items.filter(i => i.kind === 'MAINTENANCE' && i.condition === 'CONSUMED').length, 1);
  assert.equal(controlUnits(d.state, d.host), 256);
});

test('30 deterministic activation still cannot fit its120 seconds on or after the common expiration boundary', () => {
  const d = prepared(); d.act({ type: 'START_CIRCUIT' }); d.travel('quarry'); d.act({ type: 'ACTIVATE_STATION', stationId: 'quarry' }); d.travel('reed-cave');
  d.host.nowSecond = d.state.circuits.at(-1)!.deadlineSecond! - 120;
  d.reject({ type: 'ACTIVATE_STATION', stationId: 'reed-cave' }, /whole station visit/);
  assert.equal(d.state.maintenance.length, 1); assert.equal(d.host.rolls, null);
  d.host.nowSecond += 120; assert.equal(controlUnits(d.state, d.host), 0); d.act({ type: 'SYNC_HOST' });
  assert.equal(d.state.circuits.at(-1)!.status, 'EXPIRED'); assert.ok(validateFogState(d.state));
});


test('31 the same ascended body cancels its old circuit, travels normally and actually recalls all16 original fog worms', () => {
  const d = activated(); d.act({ type: 'ADVANCE_FOR_CONSUMPTION' });
  // Directed boundary fixture: the central potion transaction, not fog, makes S0.
  d.host.sequence = 0;
  const wormIds = d.state.worms.map(w => w.id), sources = structuredClone(d.state.sourceOriginals);
  const residentIds = d.host.townResidents.map(r => r.bodyId), externalWormIds = [...d.host.externalLiveWormIds];
  const spirit = d.host.spirituality, health = d.host.health, mind = d.host.mind;
  assert.equal(controlUnits(d.state, d.host), 0);
  d.reject({ type: 'TRAVEL', to: 'base' }, /sequence-one/);
  d.act({ type: 'CANCEL_CIRCUIT' }); const back = d.travel('base'); assert.equal(back.cost.actions, 0);
  for (const stationId of FOG_STATION_IDS) {
    const journey = d.travel(stationId); assert.equal(journey.cost.actions, 1);
    for (const domain of WORLD_HISTORY_DOMAINS.filter(x => x.stationId === stationId)) {
      const recalled = d.act({ type: 'RECALL_WORM', domainId: domain.id });
      assert.equal(recalled.cost.spirituality, 2); assert.equal(recalled.elapsedSeconds, 120);
      assert.equal(controlUnits(d.state, d.host), 0);
    }
  }
  d.travel('base'); assert.equal(d.host.bodyId, 'player-body'); assert.equal(d.host.sequence, 0);
  assert.equal(activeWormCount(d.state), 0); assert.deepEqual(d.state.worms.map(w => w.id), wormIds);
  assert.ok(d.state.worms.every(w => w.status === 'RECALLED' && w.location.kind === 'BODY' && w.location.bodyId === 'player-body'));
  assert.equal(d.host.spirituality, spirit - 32); assert.equal(d.host.health, health); assert.equal(d.host.mind, mind);
  assert.deepEqual(d.host.townResidents.map(r => r.bodyId), residentIds); assert.deepEqual(d.host.externalLiveWormIds, externalWormIds);
  assert.deepEqual(d.state.sourceOriginals, sources); assert.equal(d.state.attempts.length, 16); assert.ok(validateFogState(d.state));
});

test('32 S0 recovery grants no new preparation, activation, purchase, deployment, circuit or fog potion eligibility', () => {
  const d = activated(); d.host.sequence = 0;
  const commands: FogCommand[] = [
    { type: 'PREPARE_STATION', stationId: 'quarry' }, { type: 'ACTIVATE_STATION', stationId: 'quarry' },
    { type: 'BUY_ANCHOR_KIT', stationId: 'quarry' }, { type: 'BUY_MAINTENANCE', stationId: 'quarry' },
    { type: 'DELIVER_STATION', stationId: 'quarry' }, { type: 'START_CIRCUIT' }, { type: 'ADVANCE_FOR_CONSUMPTION' },
  ];
  for (const command of commands) {
    d.reject(command, /sequence-one/, command.type === 'PREPARE_STATION' ? [1, 1, 1, 1] : null);
    assert.equal(canFogCommand(d.state, command, d.host), false);
  }
  assert.equal(controlUnits(d.state, d.host), 0); assert.notEqual(fogConsumptionBlock(d.state, d.host), null);
  assert.throws(() => fogConsumptionEvidence(d.state, d.host)); assert.equal(activeWormCount(d.state), 16);
});

test('33 ascended recovery still rejects another body, a non-S0/S1 actor and a nonexistent original worm', () => {
  const d = activated(); d.host.sequence = 0; d.act({ type: 'CANCEL_CIRCUIT' }); d.travel('base'); d.travel('quarry');
  const domainId = domainAt('quarry'); d.host.sequence = 2;
  d.reject({ type: 'RECALL_WORM', domainId }, /original living/);
  d.host.sequence = 0; d.host.bodyId = 'replacement-player-body';
  d.reject({ type: 'RECALL_WORM', domainId }, /Original body/);
  const missing = new Driver(); missing.host.sequence = 0; missing.travel('quarry');
  missing.reject({ type: 'RECALL_WORM', domainId }, /actual living historical worm/);
  assert.equal(activeWormCount(missing.state), 0); assert.equal(activeWormCount(d.state), 16);
});


test('34 one validated projection equals independent public gates and keeps every original byte', () => {
  for (const d of [new Driver(), prepared(), activated()]) {
    const before = structuredClone(d.state), hostBefore = structuredClone(d.host), projection = fogProjection(d.state, d.host);
    assert.equal(projection.controlledUnits, controlUnits(d.state, d.host));
    assert.equal(projection.consumptionBlocker, fogConsumptionBlock(d.state, d.host));
    for (const station of projection.stations) for (const action of [station.prepare, station.activate]) {
      assert.deepEqual(action, fogActionProjection(d.state, action.command, d.host, action.label));
    }
    for (const action of [projection.startCircuit, projection.cancelCircuit]) assert.deepEqual(action, fogActionProjection(d.state, action.command, d.host, action.label));
    assert.deepEqual(d.state, before); assert.deepEqual(d.host, hostBefore);
  }
});

test('35 projection-local reuse never accepts a changed journal or a previously verified later call', () => {
  const d = prepared(), original = structuredClone(d.state), h = structuredClone(d.host);
  fogProjection(d.state, h);
  d.state.journal[0]!.cost.cash++;
  assert.throws(() => fogProjection(d.state, h), /invalid fog journal/);
  const independent = fogActionProjection(d.state, { type: 'START_CIRCUIT' }, h, '开始');
  assert.equal(independent.available, false); assert.equal(independent.blocker, 'Invalid replayed fog state.');
  assert.equal(controlUnits(d.state, h), 0);
  assert.equal(fogConsumptionBlock(d.state, h), '迷雾记录未通过原历史严格重放。');
  assert.deepEqual(h, d.host); assert.notDeepEqual(d.state, original);
});
