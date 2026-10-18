/** 0.208 private candidate. All fog geometry, entry, costs and timing are authored
 * game rules, not a claim about canon. This module never creates a player body.
 * The host adapter supplies the existing body, town, cart, clock and resource ledger.
 * Apply returned cost/location/cart/clock changes atomically with this state.
 * Private journal hosts (including rolls) must never be sent to the renderer. */
import { computeCheckChance } from '../../resolution/normal-check.js';
import { COORDINATES, type Place } from '../attendant-mysteries/town.js';
import {
  FOG_STATION_IDS, FOG_STATION_CONTENT, WORLD_HISTORY_DOMAINS,
  WORLD_HISTORY_MANIFEST_ID, WORLD_HISTORY_DENOMINATOR, type FogStationId,
} from './fog-content.js';
export type { FogStationId } from './fog-content.js';

export const FOG_WORM_CAPACITY = 50;
export const FOG_WINDOW_SECONDS = 1800;
export const FOG_CONSUMPTION_SECONDS = 60;
export const FOG_ROUTE = ['base', ...FOG_STATION_IDS, 'new-alder-clearing'] as const;
export interface FogCost { actions: number; cash: number; spirituality: number; mind: number; health: number; pollution: number }
export interface FogTownResident { bodyId: string; wormId: string; location: Place; controlled: boolean; health: number }
export type FogEventId = 'quarry-seam-reordered' | 'reed-current-history-changed' | 'salt-anchor-eroded' | 'salt-anchor-displaced' | 'rain-worm-lost';
/** All facts come from the authoritative transaction, never from command input.
 * activityEpoch increments on work, rest, other scenes, loss of consciousness and
 * other interruption. A real week also advances nowSecond by >=604800 seconds.
 * cart.freeCapacityKg is capacity remaining AFTER all non-fog original cargo. */
export interface FogHostFacts {
  bodyId: string; week: number; nowSecond: number; location: Place; active: boolean; sequence: number;
  health: number; mind: number; spirituality: number; cash: number; actions: number;
  controlPower: number; activityEpoch: number; townEpoch: number; townRegionId: string;
  townPlot: Place; townOperatorAt: Place; townResidents: FogTownResident[];
  externalLiveWormIds: string[];
  cart: { id: 'town-cart-1'; hired: boolean; holder: 'PLAYER' | 'SUPPLIER'; location: Place; freeCapacityKg: number };
  /** Preparation only: exactly one private roll per attempted corridor, in frozen station order. All maintenance commands require null. */
  rolls: number[] | null;
  /** A finite authored external event that the root is actually resolving. */
  eventId: FogEventId | null;
}
export interface FogOrigin {
  bodyId: string; week: number; nowSecond: number; location: Place;
  townEpoch: number; townRegionId: string; townPlot: 'new-alder-clearing';
  roster: { bodyId: string; wormId: string }[];
}
export type FogObjectLocation =
  | { kind: 'CART' | 'STATION'; at: Place }
  | { kind: 'HISTORY'; domainId: string; offset: number };
export interface FogItem {
  id: string; lotId: string; stationId: FogStationId; domainId: string | null;
  kind: 'BASE' | 'ANCHOR' | 'MAINTENANCE'; condition: 'INTACT' | 'DAMAGED' | 'CONSUMED';
  location: FogObjectLocation; weightKg: number;
}
export interface FogSourceOriginal { id: string; domainId: string; sourceId: string; historicalAnchorId: string; carrierItemId: string | null; location: FogObjectLocation | { kind: 'SUPPLIER' } }
export interface FogLot { id: string; kind: 'ANCHOR' | 'MAINTENANCE'; stationId: FogStationId; paidPence: number; boughtWeek: number; objectIds: string[]; supplierOriginalId: string }
export interface FogWorm {
  id: string; bodyId: string; domainId: string; splitWeek: number; splitSecond: number;
  status: 'DORMANT' | 'TRAPPED' | 'ACTIVE' | 'RECALLED' | 'LOST';
  location: { kind: 'HISTORY'; domainId: string; offset: number } | { kind: 'BODY'; bodyId: string } | { kind: 'LOST'; domainId: string; offset: number };
}
export interface FogTrace {
  kind: 'SPLIT' | 'ENTER' | 'EXIT' | 'MOVE' | 'PICKUP' | 'SOURCE_MOUNT' | 'ANCHOR' | 'RESIST' | 'MERGE' | 'LOSS';
  wormId: string; objectId: string | null; carriedObjectIds: string[]; sourceId: string;
  from: string; to: string; startSecond: number; endSecond: number; success: boolean;
}
export interface FogAttempt {
  id: string; domainId: string; week: number; epoch: number; wormId: string; anchorItemId: string;
  startSecond: number; endSecond: number; success: boolean; traces: FogTrace[];
}
export interface FogCorridor {
  domainId: string; stationId: FogStationId; historyEpoch: number; wormId: string | null; anchorItemId: string | null;
  proofAttemptId: string | null; lastAttemptWeek: number | null;
  activeCircuitId: string | null; maintainedEpoch: number | null;
}
export interface FogStation { id: FogStationId; baseItemId: string | null }
export interface FogCircuit {
  id: string; week: number; townEpoch: number; activityEpoch: number;
  status: 'RUNNING' | 'ARRIVED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  routeIndex: number; startedSecond: number | null; deadlineSecond: number | null;
  activatedStations: FogStationId[]; endedReason: string | null;
}
export interface FogJourney { source: 'FOG_ACTION' | 'HOST_SYNC'; bodyId: string; from: Place; to: Place; metres: number; startSecond: number; endSecond: number; objectIds: string[] }
export interface FogMaintenance { circuitId: string; stationId: FogStationId; itemId: string; startSecond: number; endSecond: number; results: { domainId: string; wormId: string; anchorItemId: string; epoch: number; success: boolean }[] }
export type FogCommand =
  | { type: 'BUY_ANCHOR_KIT' | 'BUY_MAINTENANCE' | 'DELIVER_STATION' | 'PREPARE_STATION' | 'ACTIVATE_STATION'; stationId: FogStationId }
  | { type: 'TRAVEL'; to: Place }
  | { type: 'START_CIRCUIT' | 'CANCEL_CIRCUIT' | 'SYNC_HOST' | 'ADVANCE_FOR_CONSUMPTION' }
  | { type: 'RECALL_WORM'; domainId: string }
  | { type: 'APPLY_EVENT'; eventId: FogEventId };
export interface FogJournalEntry { command: FogCommand; host: FogHostFacts; cost: FogCost; elapsedSeconds: number; location: Place; cartLocation: Place; transportObjectIds: string[] }
export interface FogState {
  schema: 1; manifestId: string; origin: FogOrigin; revision: number; week: number; nowSecond: number; location: Place;
  lastActivityEpoch: number; stations: FogStation[]; corridors: FogCorridor[]; worms: FogWorm[];
  items: FogItem[]; sourceOriginals: FogSourceOriginal[]; lots: FogLot[]; attempts: FogAttempt[]; recalls: FogTrace[][];
  journeys: FogJourney[]; maintenance: FogMaintenance[]; circuits: FogCircuit[];
  appliedEvents: { id: FogEventId; atSecond: number; domainId: string; previousEpoch: number; nextEpoch: number }[];
  invalidations: { atSecond: number; reason: string; circuitId: string }[];
  consumptionIntervals: { startSecond: number; endSecond: number; circuitId: string; units: number }[];
  journal: FogJournalEntry[];
}
export interface FogTransition { state: FogState; cost: FogCost; elapsedSeconds: number; location: Place; cartLocation: Place; transportObjectIds: string[] }

const zero = (): FogCost => ({ actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, pollution: 0 });
const ensure: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); };
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const keys = (x: object, expected: readonly string[]): boolean => Object.keys(x).sort().join('|') === [...expected].sort().join('|');
const id = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,159}$/.test(x);
const place = (x: unknown): x is Place => typeof x === 'string' && Object.prototype.hasOwnProperty.call(COORDINATES, x);
const stationId = (x: unknown): x is FogStationId => (FOG_STATION_IDS as readonly unknown[]).includes(x);
const events: readonly FogEventId[] = ['quarry-seam-reordered', 'reed-current-history-changed', 'salt-anchor-eroded', 'salt-anchor-displaced', 'rain-worm-lost'];
const canonical = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (record(x)) return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
  ensure(x === null || typeof x === 'string' || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x)), 'Non-JSON state value.');
  return JSON.stringify(x);
};
const domainsFor = (station: FogStationId) => WORLD_HISTORY_DOMAINS.filter(d => d.stationId === station);
const domainFor = (domainId: string) => { const d = WORLD_HISTORY_DOMAINS.find(x => x.id === domainId && x.reachable); ensure(d, 'Unknown playable historical domain.'); return d; };
const corridorFor = (s: FogState, domainId: string) => { const c = s.corridors.find(x => x.domainId === domainId); ensure(c, 'Unknown corridor.'); return c; };
const stationFor = (s: FogState, station: FogStationId) => { const value = s.stations.find(x => x.id === station); ensure(value, 'Unknown station.'); return value; };
const wormFor = (s: FogState, c: FogCorridor) => s.worms.find(w => w.id === c.wormId);
const itemFor = (s: FogState, itemId: string | null) => s.items.find(i => i.id === itemId);
const sourceFor = (s: FogState, domainId: string): FogSourceOriginal => { const source = s.sourceOriginals.find(x => x.domainId === domainId); ensure(source, 'Missing unique original historical source.'); return source; };
const liveWorm = (w: FogWorm) => w.status !== 'RECALLED' && w.status !== 'LOST';
export const activeWormCount = (s: FogState): number => s.worms.filter(liveWorm).length;
export const fogTravelMetres = (from: Place, to: Place): number => Math.ceil(Math.hypot(COORDINATES[from][0] - COORDINATES[to][0], COORDINATES[from][1] - COORDINATES[to][1]));
export const FOG_ROUTE_METRES = FOG_ROUTE.slice(1).reduce((n, to, i) => n + fogTravelMetres(FOG_ROUTE[i]!, to), 0);
const currentCircuit = (s: FogState) => s.circuits.at(-1);
const running = (c: FogCircuit | undefined): c is FogCircuit => !!c && (c.status === 'RUNNING' || c.status === 'ARRIVED');
const cargo = (s: FogState) => s.items.filter(i => i.location.kind === 'CART' && i.condition !== 'CONSUMED');
const atStation = (item: FogItem, at: FogStationId) => item.location.kind === 'STATION' && item.location.at === at && item.condition === 'INTACT';

export function validateFogCommand(x: unknown): x is FogCommand {
  if (!record(x) || typeof x.type !== 'string') return false;
  if (['BUY_ANCHOR_KIT', 'BUY_MAINTENANCE', 'DELIVER_STATION', 'PREPARE_STATION', 'ACTIVATE_STATION'].includes(x.type)) return keys(x, ['type', 'stationId']) && stationId(x.stationId);
  if (x.type === 'TRAVEL') return keys(x, ['type', 'to']) && place(x.to);
  if (['START_CIRCUIT', 'CANCEL_CIRCUIT', 'SYNC_HOST', 'ADVANCE_FOR_CONSUMPTION'].includes(x.type)) return keys(x, ['type']);
  if (x.type === 'RECALL_WORM') return keys(x, ['type', 'domainId']) && WORLD_HISTORY_DOMAINS.some(d => d.id === x.domainId && d.reachable);
  if (x.type === 'APPLY_EVENT') return keys(x, ['type', 'eventId']) && events.includes(x.eventId as FogEventId);
  return false;
}
function assertHost(h: unknown): asserts h is FogHostFacts {
  ensure(record(h) && keys(h, ['bodyId', 'week', 'nowSecond', 'location', 'active', 'sequence', 'health', 'mind', 'spirituality', 'cash', 'actions', 'controlPower', 'activityEpoch', 'townEpoch', 'townRegionId', 'townPlot', 'townOperatorAt', 'townResidents', 'externalLiveWormIds', 'cart', 'rolls', 'eventId']), 'Invalid authoritative fog host shape.');
  ensure(id(h.bodyId) && id(h.townRegionId) && integer(h.week, 1) && integer(h.nowSecond) && place(h.location) && place(h.townPlot) && place(h.townOperatorAt), 'Invalid original body, town or clock.');
  ensure(typeof h.active === 'boolean' && integer(h.sequence, 0, 9), 'Invalid life/sequence facts.');
  for (const n of [h.health, h.mind, h.spirituality, h.cash, h.actions, h.controlPower, h.activityEpoch, h.townEpoch]) ensure(integer(n), 'Invalid authoritative resources or epoch.');
  ensure(integer(h.controlPower, 0, 500) && Array.isArray(h.externalLiveWormIds) && h.externalLiveWormIds.length <= 50 && h.externalLiveWormIds.every(id) && new Set(h.externalLiveWormIds).size === h.externalLiveWormIds.length, 'Invalid external original worm ledger.');
  ensure(Array.isArray(h.townResidents) && h.townResidents.length <= 24, 'Invalid actual town roster.');
  for (const r of h.townResidents) ensure(record(r) && keys(r, ['bodyId', 'wormId', 'location', 'controlled', 'health']) && id(r.bodyId) && id(r.wormId) && place(r.location) && typeof r.controlled === 'boolean' && integer(r.health), 'Invalid actual resident.');
  ensure(record(h.cart) && keys(h.cart, ['id', 'hired', 'holder', 'location', 'freeCapacityKg']) && h.cart.id === 'town-cart-1' && typeof h.cart.hired === 'boolean' && (h.cart.holder === 'PLAYER' || h.cart.holder === 'SUPPLIER') && place(h.cart.location) && integer(h.cart.freeCapacityKg, 0, 600), 'Invalid original cart facts.');
  ensure(h.rolls === null || (Array.isArray(h.rolls) && h.rolls.length <= 4 && h.rolls.every(r => integer(r, 1, 100))), 'Invalid private recorded corridor rolls.');
  ensure(h.eventId === null || events.some(event => event === h.eventId), 'Unknown authored host event.');
}
function assertManifest(): void {
  ensure(WORLD_HISTORY_DOMAINS.length === 64 && WORLD_HISTORY_DENOMINATOR === 4096, 'Full world denominator must be frozen.');
  ensure(new Set(WORLD_HISTORY_DOMAINS.map(d => d.id)).size === 64 && WORLD_HISTORY_DOMAINS.every(d => d.units === 64 && d.unitIds.length === 64 && d.seamIds.length === 5), 'Invalid world partitions.');
  const units = WORLD_HISTORY_DOMAINS.flatMap(d => [...d.unitIds]);
  ensure(units.length === 4096 && new Set(units).size === 4096, 'World history units overlap or disappear.');
  ensure(WORLD_HISTORY_DOMAINS.filter(d => d.reachable).length === 16 && FOG_STATION_IDS.every(at => domainsFor(at).length === 4), 'Exactly sixteen fixed corridors are required.');
}
function fromOrigin(origin: FogOrigin): FogState {
  assertManifest();
  ensure(record(origin) && keys(origin, ['bodyId', 'week', 'nowSecond', 'location', 'townEpoch', 'townRegionId', 'townPlot', 'roster']) && id(origin.bodyId) && integer(origin.week, 1) && integer(origin.nowSecond) && place(origin.location) && integer(origin.townEpoch) && id(origin.townRegionId) && origin.townPlot === 'new-alder-clearing', 'Invalid immutable fog origin.');
  ensure(Array.isArray(origin.roster) && origin.roster.length === 24 && origin.roster.every(r => record(r) && keys(r, ['bodyId', 'wormId']) && id(r.bodyId) && id(r.wormId)) && new Set(origin.roster.map(r => r.bodyId)).size === 24 && new Set(origin.roster.map(r => r.wormId)).size === 24, 'Original twenty-four bodies and worms must be retained.');
  return { schema: 1, manifestId: WORLD_HISTORY_MANIFEST_ID, origin: structuredClone(origin), revision: 0, week: origin.week, nowSecond: origin.nowSecond, location: origin.location, lastActivityEpoch: 0,
    stations: FOG_STATION_IDS.map(id => ({ id, baseItemId: null })),
    corridors: WORLD_HISTORY_DOMAINS.filter(d => d.reachable).map(d => ({ domainId: d.id, stationId: d.stationId!, historyEpoch: 0, wormId: null, anchorItemId: null, proofAttemptId: null, lastAttemptWeek: null, activeCircuitId: null, maintainedEpoch: null })),
    worms: [], items: [], sourceOriginals: WORLD_HISTORY_DOMAINS.filter(d => d.reachable).map<FogSourceOriginal>(d => ({ id: `${d.sourceId}:original-object`, domainId: d.id, sourceId: d.sourceId, historicalAnchorId: d.historicalAnchorId, carrierItemId: null, location: { kind: 'SUPPLIER' } })), lots: [], attempts: [], recalls: [], journeys: [], maintenance: [], circuits: [], appliedEvents: [], invalidations: [], consumptionIntervals: [], journal: [] };
}
export function createFogState(host: FogHostFacts): FogState {
  assertHost(host);
  ensure(host.townPlot === 'new-alder-clearing', 'This finite route uses the original New Alder town.');
  const s = fromOrigin({ bodyId: host.bodyId, week: host.week, nowSecond: host.nowSecond, location: host.location, townEpoch: host.townEpoch, townRegionId: host.townRegionId, townPlot: host.townPlot,
    roster: host.townResidents.map(r => ({ bodyId: r.bodyId, wormId: r.wormId })) });
  ensure(townValid(s, host), 'The original twenty-four town bodies must still be controlled.');
  // No free resources, worms, materials, health or action points are initialized.
  return s;
}
function townValid(s: FogState, h: FogHostFacts, at: Place = h.location): boolean {
  if (h.bodyId !== s.origin.bodyId || h.townOperatorAt !== h.location || h.townPlot !== s.origin.townPlot || h.townEpoch !== s.origin.townEpoch || h.townRegionId !== s.origin.townRegionId || h.townResidents.length !== 24) return false;
  if (new Set(h.townResidents.map(r => r.bodyId)).size !== 24 || new Set(h.townResidents.map(r => r.wormId)).size !== 24) return false;
  return s.origin.roster.every(o => h.townResidents.some(r => r.bodyId === o.bodyId && r.wormId === o.wormId && r.controlled && r.health > 0 && r.location === h.townPlot && h.externalLiveWormIds.includes(r.wormId) && fogTravelMetres(at, r.location) <= 1000));
}
function sharedCapacityValid(s: FogState, h: FogHostFacts): boolean {
  const live = s.worms.filter(liveWorm).map(w => w.id);
  return live.length + h.externalLiveWormIds.length <= FOG_WORM_CAPACITY && !live.some(id => h.externalLiveWormIds.includes(id));
}
function proofReady(s: FogState, c: FogCorridor): boolean {
  const proof = s.attempts.find(a => a.id === c.proofAttemptId), worm = wormFor(s, c), anchor = itemFor(s, c.anchorItemId), base = itemFor(s, stationFor(s, c.stationId).baseItemId), source = sourceFor(s, c.domainId);
  return !!proof && proof.success && proof.epoch === c.historyEpoch && proof.domainId === c.domainId && proof.wormId === c.wormId && proof.anchorItemId === c.anchorItemId
    && !!worm && liveWorm(worm) && worm.bodyId === s.origin.bodyId && worm.domainId === c.domainId && worm.location.kind === 'HISTORY' && worm.location.domainId === c.domainId && worm.location.offset === 64
    && !!anchor && anchor.kind === 'ANCHOR' && anchor.domainId === c.domainId && anchor.condition === 'INTACT' && anchor.location.kind === 'HISTORY' && anchor.location.domainId === c.domainId && anchor.location.offset === 64
    && source.carrierItemId === anchor.id && source.location.kind === 'HISTORY' && source.location.domainId === c.domainId && source.location.offset === 64
    && !!base && base.kind === 'BASE' && atStation(base, c.stationId)
    && proof.traces.filter(t => t.kind === 'MOVE' && t.success && Number(t.to.split(':').at(-1)) > Number(t.from.split(':').at(-1))).length === 4;
}
/** Derived at the current authoritative instant. Reading never grants control. */
function deriveControlUnitIds(s: FogState, h: FogHostFacts): string[] {
  try {
    assertHost(h);
    const circuit = currentCircuit(s);
    if (h.eventId !== null || h.location !== s.location || !h.active || h.sequence !== 1 || h.health <= 0 || h.mind <= 0 || h.nowSecond < s.nowSecond || h.week !== s.week || !townValid(s, h) || !sharedCapacityValid(s, h) || !running(circuit) || circuit.deadlineSecond === null || h.nowSecond >= circuit.deadlineSecond || circuit.week !== h.week || circuit.activityEpoch !== h.activityEpoch || circuit.townEpoch !== h.townEpoch) return [];
    const units = new Set<string>();
    for (const c of s.corridors) if (c.activeCircuitId === circuit.id && c.maintainedEpoch === c.historyEpoch && proofReady(s, c) && wormFor(s, c)?.status === 'ACTIVE') for (const unit of domainFor(c.domainId).unitIds) units.add(unit);
    return [...units].sort();
  } catch { return []; }
}
export const controlUnitIds = (s: FogState, h: FogHostFacts): string[] => validateFogState(s) ? deriveControlUnitIds(s, h) : [];
export const controlUnits = (s: FogState, h: FogHostFacts): number => controlUnitIds(s, h).length;
export const meetsQuarter = (s: FogState, h: FogHostFacts): boolean => controlUnits(s, h) * 4 >= WORLD_HISTORY_DENOMINATOR;
function invalidateCorridor(s: FogState, c: FogCorridor): void {
  c.activeCircuitId = null; c.maintainedEpoch = null;
  const w = wormFor(s, c); if (w?.status === 'ACTIVE') w.status = 'DORMANT';
}
function endCircuit(s: FogState, reason: string, status: 'CANCELLED' | 'EXPIRED' | 'FAILED'): void {
  const circuit = currentCircuit(s); if (!running(circuit)) return;
  circuit.status = status; circuit.endedReason = reason;
  for (const c of s.corridors) invalidateCorridor(s, c);
  s.invalidations.push({ atSecond: s.nowSecond, reason, circuitId: circuit.id });
}
function synchronize(s: FogState, h: FogHostFacts, command: FogCommand): void {
  ensure(h.bodyId === s.origin.bodyId && h.nowSecond >= s.nowSecond && h.week >= s.week && h.activityEpoch >= s.lastActivityEpoch, 'Original body or monotonic authoritative clock mismatch.');
  if (h.week > s.week) ensure(h.nowSecond - s.nowSecond >= (h.week - s.week) * 604800, 'A real week cannot freeze the fog clock.');
  const priorSecond = s.nowSecond; s.nowSecond = h.nowSecond;
  const circuit = currentCircuit(s);
  if (running(circuit)) {
    if (h.week !== circuit.week || h.activityEpoch !== circuit.activityEpoch || !h.active || h.health <= 0 || h.mind <= 0 || !townValid(s, h) || !sharedCapacityValid(s, h)) endCircuit(s, '原身体、镇民或专注状态已改变，旧维持休眠。', 'CANCELLED');
    else if (circuit.deadlineSecond !== null && h.nowSecond >= circuit.deadlineSecond) endCircuit(s, '共同维持时限已到。', 'EXPIRED');
  }
  if (h.location !== s.location) {
    ensure(command.type === 'SYNC_HOST' && !running(currentCircuit(s)) && cargo(s).length === 0, 'Actual movement with fog cargo or an active circuit must use the recorded travel transaction.');
    const metres = fogTravelMetres(s.location, h.location);
    ensure(h.nowSecond - priorSecond >= metres, 'External movement must include its real travel time.');
    s.journeys.push({ source: 'HOST_SYNC', bodyId: h.bodyId, from: s.location, to: h.location, metres, startSecond: priorSecond, endSecond: h.nowSecond, objectIds: [] });
    s.location = h.location;
  }
  ensure(h.townOperatorAt === h.location, 'The original town operator and real player position disagree.');
  s.week = h.week; s.lastActivityEpoch = h.activityEpoch;
}
function requirePlayable(s: FogState, h: FogHostFacts, allowAscendedRecovery = false): void {
  ensure(h.active && (h.sequence === 1 || (allowAscendedRecovery && h.sequence === 0)) && h.health > 0 && h.mind > 0, allowAscendedRecovery ? 'The original living sequence-one or ascended body must be able to recover its own originals.' : 'The original living sequence-one body must be able to act.');
  ensure(townValid(s, h), 'All original twenty-four town bodies, worms, range and epoch must remain valid.');
  ensure(sharedCapacityValid(s, h), 'Shared original worm capacity or identity is invalid.');
}
function afford(h: FogHostFacts, cost: FogCost): void {
  ensure(h.actions >= cost.actions, 'Not enough original actions; prepare at the reception and return in a later week.');
  ensure(h.cash >= cost.cash && h.spirituality >= cost.spirituality && h.mind > cost.mind, 'Not enough original money, spirituality or conscious mind.');
}
function requireCart(s: FogState, h: FogHostFacts, extraKg = 0): void {
  ensure(h.cart.hired && h.cart.holder === 'PLAYER' && h.cart.location === h.location, 'The actually hired original town-cart-1 must be here.');
  ensure(cargo(s).every(i => i.location.kind === 'CART' && i.location.at === h.location) && cargo(s).reduce((n, i) => n + i.weightKg, 0) + extraKg <= h.cart.freeCapacityKg, 'Original cart capacity or actual cargo position is insufficient.');
}
function privateRolls(h: FogHostFacts, count: number): number[] { ensure(h.rolls !== null && h.rolls.length === count, 'Exact private rolls for these actual corridors are required.'); return h.rolls; }
function chance(h: FogHostFacts): number { return computeCheckChance({ baseAbility: h.controlPower, difficulty: 45, modifiers: [] }); }
function candidates(s: FogState, station: FogStationId): FogCorridor[] { return domainsFor(station).map(d => corridorFor(s, d.id)).filter(c => !proofReady(s, c)); }
export function fogPreparationRollCount(s: FogState, station: FogStationId): number { return candidates(s, station).length; }
function anchorForAttempt(s: FogState, c: FogCorridor): FogItem | undefined {
  const old = itemFor(s, c.anchorItemId);
  if (old?.condition === 'INTACT' && old.location.kind === 'HISTORY' && old.location.domainId === c.domainId && [0, 16, 32, 48, 64].includes(old.location.offset)) return old;
  return s.items.find(i => i.kind === 'ANCHOR' && i.domainId === c.domainId && atStation(i, c.stationId));
}
function trace(s: FogTrace[], kind: FogTrace['kind'], worm: FogWorm, objectId: string | null, sourceId: string, from: string, to: string, startSecond: number, seconds: number, success = true, carriedObjectIds: string[] = objectId ? [objectId] : []): number {
  s.push({ kind, wormId: worm.id, objectId, carriedObjectIds, sourceId, from, to, startSecond, endSecond: startSecond + seconds, success }); return startSecond + seconds;
}
function performPreparation(s: FogState, c: FogCorridor, h: FogHostFacts, roll: number): void {
  const domain = domainFor(c.domainId), anchor = anchorForAttempt(s, c)!, source = sourceFor(s, c.domainId);
  let worm = wormFor(s, c), at = s.nowSecond;
  const traces: FogTrace[] = [];
  if (!worm || !liveWorm(worm)) {
    worm = { id: `fog-worm-${s.worms.length + 1}`, bodyId: h.bodyId, domainId: c.domainId, splitWeek: h.week, splitSecond: at, status: 'DORMANT', location: { kind: 'BODY', bodyId: h.bodyId } };
    s.worms.push(worm); c.wormId = worm.id;
    at = trace(traces, 'SPLIT', worm, null, domain.sourceId, `body:${h.bodyId}`, `body:${h.bodyId}:split`, at, 0);
  } else if (worm.location.kind === 'HISTORY') {
    // A trapped/dormant original walks the same four segments back; no reset teleport.
    for (let offset = worm.location.offset; offset > 0; offset -= 16) at = trace(traces, 'MOVE', worm, null, domain.sourceId, `${c.domainId}:${offset}`, `${c.domainId}:${offset - 16}`, at, 20);
    at = trace(traces, 'EXIT', worm, null, domain.sourceId, `${c.domainId}:0`, `station:${c.stationId}`, at, 10);
  }
  let anchorCarried = anchor.location.kind === 'STATION';
  let sourceCarried = source.location.kind === 'STATION';
  const carriedIds = () => [...(anchorCarried ? [anchor.id] : []), ...(sourceCarried ? [source.id] : [])];
  at = trace(traces, 'ENTER', worm, anchorCarried ? anchor.id : null, domain.sourceId, `station:${c.stationId}`, `${c.domainId}:0`, at, 10, true, carriedIds());
  if (anchorCarried) anchor.location = { kind: 'HISTORY', domainId: c.domainId, offset: 0 };
  if (sourceCarried) source.location = { kind: 'HISTORY', domainId: c.domainId, offset: 0 };
  for (let segment = 0; segment < 4; segment++) {
    const offset = segment * 16;
    if (!anchorCarried && anchor.location.kind === 'HISTORY' && anchor.location.offset === offset) {
      at = trace(traces, 'PICKUP', worm, anchor.id, domain.sourceId, `${c.domainId}:${offset}`, `${c.domainId}:${offset}`, at, 0);
      anchorCarried = true;
    }
    if (!sourceCarried && source.location.kind === 'HISTORY' && source.location.offset === offset) {
      // In particular, a displaced source at 48 is actually taken off its old
      // damaged hardware before the same original travels the final 16 units.
      at = trace(traces, 'PICKUP', worm, source.id, domain.sourceId, `${c.domainId}:${offset}`, `${c.domainId}:${offset}`, at, 0);
      sourceCarried = true; source.carrierItemId = anchor.id;
    }
    at = trace(traces, 'MOVE', worm, anchorCarried ? anchor.id : null, `${domain.sourceId}:${domain.seamIds[segment]}:${domain.seamIds[segment + 1]}`, `${c.domainId}:${offset}`, `${c.domainId}:${offset + 16}`, at, 20, true, carriedIds());
    if (anchorCarried) anchor.location = { kind: 'HISTORY', domainId: c.domainId, offset: offset + 16 };
    if (sourceCarried) source.location = { kind: 'HISTORY', domainId: c.domainId, offset: offset + 16 };
  }
  at = trace(traces, 'SOURCE_MOUNT', worm, source.id, domain.sourceId, `${c.domainId}:64`, `${domain.historicalAnchorId}:${c.domainId}:64`, at, 5);
  at = trace(traces, 'ANCHOR', worm, anchor.id, domain.sourceId, `${c.domainId}:64`, `${domain.historicalAnchorId}:${c.domainId}:64`, at, 5);
  source.carrierItemId = anchor.id; source.location = { kind: 'HISTORY', domainId: c.domainId, offset: 64 };
  const success = roll <= chance(h);
  at = trace(traces, 'RESIST', worm, anchor.id, domain.sourceId, `${c.domainId}:64`, `${c.domainId}:64`, at, 20, success);
  worm.location = { kind: 'HISTORY', domainId: c.domainId, offset: 64 }; worm.status = success ? 'DORMANT' : 'TRAPPED';
  anchor.location = { kind: 'HISTORY', domainId: c.domainId, offset: 64 }; if (!success) anchor.condition = 'DAMAGED';
  const attempt: FogAttempt = { id: `fog-attempt-${s.attempts.length + 1}`, domainId: c.domainId, week: h.week, epoch: c.historyEpoch, wormId: worm.id, anchorItemId: anchor.id, startSecond: s.nowSecond, endSecond: at, success, traces };
  s.attempts.push(attempt); c.anchorItemId = anchor.id; c.proofAttemptId = success ? attempt.id : null; c.lastAttemptWeek = h.week; invalidateCorridor(s, c); s.nowSecond = at;
}
/** The main potion transaction must independently check original bottle, traits,
 * uniqueness, digestion, fate proof and original body. This gate grants none. */
function deriveConsumptionBlock(s: FogState, h: FogHostFacts): string | null {
  if (h.location !== s.origin.townPlot || h.townOperatorAt !== h.location) return '必须真实返回原白榆镇服药点。';
  if (deriveControlUnitIds(s, h).length < 1024) return '当前完整世界控制不足1024/4096。';
  const endHost = { ...h, nowSecond: h.nowSecond + FOG_CONSUMPTION_SECONDS };
  if (deriveControlUnitIds(s, endHost).length < 1024) return '当前共同窗口不能覆盖完整60秒服药。';
  return null;
}
export function fogConsumptionBlock(s: FogState, h: FogHostFacts): string | null { return validateFogState(s) ? deriveConsumptionBlock(s, h) : '迷雾记录未通过原历史严格重放。'; }
export interface FogConsumptionEvidence { manifestId: string; bodyId: string; location: Place; revision: number; circuitId: string; deadlineSecond: number; townEpoch: number; corridorEvidence: string[]; originalTownBodyIds: string[]; allLiveWormIds: string[] }
export function fogConsumptionEvidence(s: FogState, h: FogHostFacts): FogConsumptionEvidence {
  const reason = fogConsumptionBlock(s, h); ensure(reason === null, reason ?? 'Invalid consumption state.');
  return deriveConsumptionEvidence(s, h);
}
function deriveConsumptionEvidence(s: FogState, h: FogHostFacts): FogConsumptionEvidence {
  const reason = deriveConsumptionBlock(s, h); ensure(reason === null, reason ?? 'Invalid consumption state.');
  const c = currentCircuit(s)!;
  return { manifestId: s.manifestId, bodyId: h.bodyId, location: h.location, revision: s.revision, circuitId: c.id, deadlineSecond: c.deadlineSecond!, townEpoch: h.townEpoch,
    corridorEvidence: s.corridors.map(x => `${x.domainId}|${x.historyEpoch}|${x.wormId}|${x.anchorItemId}|${x.proofAttemptId}`).sort(), originalTownBodyIds: h.townResidents.map(r => r.bodyId).sort(), allLiveWormIds: [...h.externalLiveWormIds, ...s.worms.filter(liveWorm).map(w => w.id)].sort() };
}
export function fogPreparedEvidenceMatches(s: FogState, h: FogHostFacts, prepared: FogConsumptionEvidence): boolean { try { return canonical(fogConsumptionEvidence(s, h)) === canonical(prepared); } catch { return false; } }

function applyCore(input: FogState, command: FogCommand, host: FogHostFacts): FogTransition {
  ensure(validateFogCommand(command), 'Unknown or non-exact fog command.'); assertHost(host);
  ensure(command.type === 'APPLY_EVENT' || host.eventId === null, 'Resolve the pending original fog event before any other action.');
  ensure(command.type === 'PREPARE_STATION' || host.rolls === null, 'This command consumes no private random rolls.');
  const s = structuredClone(input), h = structuredClone(host), start = h.nowSecond, cost = zero();
  synchronize(s, h, command);
  let cartLocation = h.cart.location; const transportObjectIds: string[] = [];
  if (!['SYNC_HOST', 'CANCEL_CIRCUIT', 'APPLY_EVENT', 'TRAVEL'].includes(command.type)) requirePlayable(s, h, command.type === 'RECALL_WORM');
  const circuit = currentCircuit(s);
  if (running(circuit)) ensure(['TRAVEL', 'ACTIVATE_STATION', 'CANCEL_CIRCUIT', 'SYNC_HOST', 'RECALL_WORM', 'APPLY_EVENT', 'ADVANCE_FOR_CONSUMPTION'].includes(command.type), 'Cancel the current focused circuit before other work.');
  if (command.type === 'BUY_ANCHOR_KIT' || command.type === 'BUY_MAINTENANCE') {
    ensure(h.location === 'base', 'Buy original material packs at the original reception supplier.');
    const kit = command.type === 'BUY_ANCHOR_KIT'; cost.cash = kit ? 48 : 8; requireCart(s, h, kit ? 20 : 1); afford(h, cost);
    const lotId = `fog-lot-${s.lots.length + 1}`, make = (kind: FogItem['kind'], suffix: string, domainId: string | null, weightKg: number): FogItem => ({ id: `${lotId}:${suffix}`, lotId, stationId: command.stationId, domainId, kind, condition: 'INTACT', location: { kind: 'CART', at: 'base' }, weightKg });
    const items = kit ? [make('BASE', 'base', null, 4), ...domainsFor(command.stationId).map((d, i) => make('ANCHOR', `anchor-${i + 1}`, d.id, 4))] : [make('MAINTENANCE', 'maintenance', null, 1)];
    s.items.push(...items);
    for (const item of items.filter(i => i.kind === 'ANCHOR')) {
      const source = sourceFor(s, item.domainId!);
      if (source.location.kind === 'SUPPLIER') { source.carrierItemId = item.id; source.location = { kind: 'CART', at: 'base' }; }
    }
    s.lots.push({ id: lotId, kind: kit ? 'ANCHOR' : 'MAINTENANCE', stationId: command.stationId, paidPence: cost.cash, boughtWeek: h.week, objectIds: items.map(i => i.id), supplierOriginalId: `reception-fog-supplier:${lotId}` }); s.nowSecond += 30;
  } else if (command.type === 'DELIVER_STATION') {
    ensure(h.location === command.stationId, 'The real body must be at the actual original station.'); requireCart(s, h);
    const items = cargo(s).filter(i => i.stationId === command.stationId); ensure(items.length > 0, 'No actual original pack is on the original cart for this station.');
    for (const item of items) { item.location = { kind: 'STATION', at: command.stationId }; transportObjectIds.push(item.id);
      for (const source of s.sourceOriginals.filter(x => x.carrierItemId === item.id)) { source.location = { kind: 'STATION', at: command.stationId }; transportObjectIds.push(source.id); }
    } s.nowSecond += 30;
  } else if (command.type === 'TRAVEL') {
    ensure(command.to !== h.location, 'Travel requires a different real place.');
    ensure(h.active && h.health > 0 && h.mind > 0, 'The original body must be conscious and able to walk.');
    if (command.to === 'base' && !running(circuit)) {
      // A real town-control failure must not lock the ordinary physical retreat.
      // This does not restore any broken town body, worm, capacity or fog control.
      ensure(h.townResidents.filter(r => r.controlled && r.health > 0).every(r => fogTravelMetres(command.to, r.location) <= 1000), 'Retreat would sever a still-live original town control line.');
    } else { requirePlayable(s, h, !running(circuit)); ensure(townValid(s, h, command.to), 'This move would break the actual thousand-metre town control line.'); }
    if (running(circuit)) {
      ensure(circuit.status === 'RUNNING' && FOG_ROUTE[circuit.routeIndex + 1] === command.to, 'Follow the actual next leg, or cancel and leave normally.');
      ensure(circuit.routeIndex === 0 || circuit.activatedStations.length === circuit.routeIndex, 'Actually activate this station before the next circuit leg.');
    } else cost.actions = command.to === 'base' ? 0 : 1;
    afford(h, cost); const carried = cargo(s); if (carried.length > 0 || h.cart.hired) requireCart(s, h);
    const metres = fogTravelMetres(h.location, command.to); for (const item of carried) { item.location = { kind: 'CART', at: command.to }; transportObjectIds.push(item.id);
      for (const source of s.sourceOriginals.filter(x => x.carrierItemId === item.id)) { source.location = { kind: 'CART', at: command.to }; transportObjectIds.push(source.id); }
    }
    if (h.cart.hired) { cartLocation = command.to; transportObjectIds.unshift(h.cart.id); }
    s.journeys.push({ source: 'FOG_ACTION', bodyId: h.bodyId, from: h.location, to: command.to, metres, startSecond: s.nowSecond, endSecond: s.nowSecond + metres, objectIds: [...transportObjectIds] }); s.location = command.to; s.nowSecond += metres;
    if (running(circuit)) { circuit.routeIndex++; if (circuit.routeIndex === FOG_ROUTE.length - 1) circuit.status = 'ARRIVED'; }
  } else if (command.type === 'PREPARE_STATION') {
    ensure(h.location === command.stationId, 'Prepare only at the actual original station.');
    const targets = candidates(s, command.stationId); ensure(targets.length > 0, 'Every original corridor here is already prepared.');
    ensure(targets.every(c => c.lastAttemptWeek === null || c.lastAttemptWeek < h.week), 'A failed original corridor cannot reroll in the same week.');
    const station = stationFor(s, command.stationId), base = itemFor(s, station.baseItemId) ?? s.items.find(i => i.kind === 'BASE' && atStation(i, command.stationId));
    ensure(base && atStation(base, command.stationId), 'Deliver an actual intact paid original station base.');
    ensure(targets.every(c => { const source = sourceFor(s, c.domainId); return (source.location.kind === 'STATION' && source.location.at === c.stationId) || (source.location.kind === 'HISTORY' && source.location.domainId === c.domainId && [0, 16, 32, 48, 64].includes(source.location.offset)); }), 'Each unique historical source original must really be at its station or original history endpoint.');
    ensure(targets.every(c => anchorForAttempt(s, c)), 'Each failed or missing original anchor needs its independently paid, actually delivered replacement.');
    const splits = targets.filter(c => { const w = wormFor(s, c); return !w || !liveWorm(w); }).length;
    ensure(Array.from({ length: splits }, (_, i) => `fog-worm-${s.worms.length + i + 1}`).every(id => !h.externalLiveWormIds.includes(id)), 'A new worm ID cannot reuse any original external worm.');
    ensure(activeWormCount(s) + h.externalLiveWormIds.length + splits <= FOG_WORM_CAPACITY, 'The real split would exceed the shared fifty-worm capacity.');
    // Approved budget: original outward travel costs 1 AP, on-site batch up to 3 AP.
    // A later partial repair pays only its actual remaining corridor count, capped at 3.
    cost.actions = Math.min(3, targets.length); cost.spirituality = splits * 3; cost.mind = splits * 2; afford(h, cost); const rolls = privateRolls(h, targets.length);
    // All preconditions are checked before commitment. From here every corridor
    // resolves and records success/failure; no mid-batch failure throws away cost.
    station.baseItemId = base.id; targets.forEach((c, i) => performPreparation(s, c, h, rolls[i]!));
  } else if (command.type === 'START_CIRCUIT') {
    ensure(h.location === 'base', 'The actual maintenance route starts at base.');
    ensure(s.corridors.every(c => proofReady(s, c)), 'All sixteen original corridors must be prepared and still closed.');
    ensure(!s.circuits.some(c => c.week === h.week), 'The paid circuit already attempted this week cannot refresh.');
    ensure(FOG_STATION_IDS.every(at => s.items.some(i => i.kind === 'MAINTENANCE' && atStation(i, at))), 'Actually deliver one unused paid maintenance pack to each station first.');
    cost.actions = 1; afford(h, cost);
    s.circuits.push({ id: `fog-circuit-${s.circuits.length + 1}`, week: h.week, townEpoch: h.townEpoch, activityEpoch: h.activityEpoch, status: 'RUNNING', routeIndex: 0, startedSecond: null, deadlineSecond: null, activatedStations: [], endedReason: null });
  } else if (command.type === 'ACTIVATE_STATION') {
    ensure(running(circuit) && circuit.status === 'RUNNING' && circuit.routeIndex > 0 && FOG_ROUTE[circuit.routeIndex] === command.stationId && h.location === command.stationId, 'Activate the current actual station on the one real circuit.');
    ensure(!circuit.activatedStations.includes(command.stationId), 'A station cannot activate twice in this circuit.');
    const targets = domainsFor(command.stationId).map(d => corridorFor(s, d.id)); ensure(targets.every(c => proofReady(s, c)), 'Every actual original corridor must still be prepared.');
    const supply = s.items.find(i => i.kind === 'MAINTENANCE' && atStation(i, command.stationId)); ensure(supply, 'The paid maintenance material must already be at this station.');
    ensure(circuit.deadlineSecond === null || s.nowSecond + 120 < circuit.deadlineSecond, 'The existing common window cannot cover this whole station visit.');
    cost.spirituality = 4; afford(h, cost);
    if (circuit.startedSecond === null) { circuit.startedSecond = s.nowSecond; circuit.deadlineSecond = s.nowSecond + FOG_WINDOW_SECONDS; }
    // All current original facts were checked above. Maintenance is deterministic;
    // the actual preparation already resolved each corridor's private check.
    supply.condition = 'CONSUMED'; const results = targets.map(c => ({ domainId: c.domainId, wormId: c.wormId!, anchorItemId: c.anchorItemId!, epoch: c.historyEpoch, success: true }));
    s.maintenance.push({ circuitId: circuit.id, stationId: command.stationId, itemId: supply.id, startSecond: s.nowSecond, endSecond: s.nowSecond + 120, results }); s.nowSecond += 120;
    circuit.activatedStations.push(command.stationId);
    for (const c of targets) { c.activeCircuitId = circuit.id; c.maintainedEpoch = c.historyEpoch; wormFor(s, c)!.status = 'ACTIVE'; }
  } else if (command.type === 'CANCEL_CIRCUIT') {
    ensure(running(circuit), 'No live maintenance circuit is running.'); endCircuit(s, '已撤回本次集中维持，可沿普通道路回去休养。', 'CANCELLED');
  } else if (command.type === 'RECALL_WORM') {
    const c = corridorFor(s, command.domainId), w = wormFor(s, c); ensure(h.location === c.stationId, 'Recall at this original real station.'); ensure(w && liveWorm(w) && w.location.kind === 'HISTORY', 'Only an actual living historical worm can return.');
    cost.spirituality = 2; afford(h, cost); const domain = domainFor(c.domainId), traces: FogTrace[] = [];
    for (let offset = w.location.offset; offset > 0; offset -= 16) s.nowSecond = trace(traces, 'MOVE', w, null, domain.sourceId, `${c.domainId}:${offset}`, `${c.domainId}:${offset - 16}`, s.nowSecond, 20);
    s.nowSecond = trace(traces, 'MERGE', w, null, domain.sourceId, `${c.domainId}:0`, `body:${h.bodyId}`, s.nowSecond, 40); w.status = 'RECALLED'; w.location = { kind: 'BODY', bodyId: h.bodyId }; c.proofAttemptId = null; invalidateCorridor(s, c); s.recalls.push(traces);
  } else if (command.type === 'APPLY_EVENT') {
    ensure(h.eventId === command.eventId && !s.appliedEvents.some(e => e.id === command.eventId), 'Resolve only the pending original authored event, once.');
    const at: FogStationId = command.eventId.startsWith('quarry') ? 'quarry' : command.eventId.startsWith('reed') ? 'reed-cave' : command.eventId.startsWith('salt') ? 'salt-vault' : 'rain-ruin';
    const domain = command.eventId === 'reed-current-history-changed' ? domainsFor(at).find(d => d.eraId === 'current-and-undated')! : domainsFor(at)[command.eventId === 'rain-worm-lost' ? 3 : 0]!, c = corridorFor(s, domain.id), previousEpoch = c.historyEpoch;
    if (command.eventId === 'salt-anchor-displaced') {
      const anchor = itemFor(s, c.anchorItemId), source = sourceFor(s, c.domainId);
      ensure(anchor && anchor.location.kind === 'HISTORY' && anchor.location.offset === 64 && source.carrierItemId === anchor.id && source.location.kind === 'HISTORY', 'The actual original anchored assembly must exist at the boundary before displacement.');
      // A bounded root-authored seam displacement moves the same real assembly,
      // never a replacement or a historical image. The original endpoint is lost.
      anchor.location = { kind: 'HISTORY', domainId: c.domainId, offset: 48 }; source.location = { kind: 'HISTORY', domainId: c.domainId, offset: 48 };
    } else if (command.eventId === 'salt-anchor-eroded') {
      const anchor = itemFor(s, c.anchorItemId); ensure(anchor && anchor.condition === 'INTACT' && anchor.location.kind === 'HISTORY', 'The original installed anchor must exist for this erosion.'); anchor.condition = 'DAMAGED';
    } else if (command.eventId === 'rain-worm-lost') {
      const w = wormFor(s, c); ensure(w && liveWorm(w) && w.location.kind === 'HISTORY', 'The actual original worm must exist before it can be lost.');
      // Involuntary original loss is not blocked by an inability to afford damage.
      // The shared body adapter applies the full 10 mind / 10 pollution consequence.
      cost.mind = 10; cost.pollution = 10;
      s.recalls.push([{ kind: 'LOSS', wormId: w.id, objectId: null, carriedObjectIds: [], sourceId: domain.sourceId, from: `${domain.id}:${w.location.offset}`, to: `${domain.id}:lost`, startSecond: s.nowSecond, endSecond: s.nowSecond, success: false }]);
      w.location = { kind: 'LOST', domainId: domain.id, offset: w.location.offset }; w.status = 'LOST';
    } else c.historyEpoch++;
    c.proofAttemptId = null; invalidateCorridor(s, c); s.appliedEvents.push({ id: command.eventId, atSecond: s.nowSecond, domainId: domain.id, previousEpoch, nextEpoch: c.historyEpoch });
  } else if (command.type === 'ADVANCE_FOR_CONSUMPTION') {
    const blocker = deriveConsumptionBlock(s, h); ensure(blocker === null, blocker ?? 'Invalid actual consumption window.');
    s.consumptionIntervals.push({ startSecond: s.nowSecond, endSecond: s.nowSecond + FOG_CONSUMPTION_SECONDS, circuitId: currentCircuit(s)!.id, units: deriveControlUnitIds(s, h).length }); s.nowSecond += FOG_CONSUMPTION_SECONDS;
  }
  const finalCircuit = currentCircuit(s);
  if (running(finalCircuit) && finalCircuit.deadlineSecond !== null && s.nowSecond >= finalCircuit.deadlineSecond) endCircuit(s, '实际经过时间已超过共同窗口。', 'EXPIRED');
  const result = { cost, elapsedSeconds: s.nowSecond - start, location: s.location, cartLocation, transportObjectIds };
  s.revision++; s.journal.push({ command: structuredClone(command), host: h, ...structuredClone(result) }); return { state: s, ...result };
}
/** Strict materialized-state replay; forged traces, cost, timers and ratios fail.
 * Root must ALSO replay each recorded host against the contemporaneous original
 * player/town/worm ledger prefix. Current fog worms must not enter old town hosts. */
export function replayFog(origin: FogOrigin, journal: readonly FogJournalEntry[]): FogState {
  ensure(Array.isArray(journal) && journal.length <= 10000, 'Invalid bounded fog journal.'); let s = fromOrigin(origin);
  for (const entry of journal) {
    ensure(record(entry) && keys(entry, ['command', 'host', 'cost', 'elapsedSeconds', 'location', 'cartLocation', 'transportObjectIds']), 'Non-exact fog receipt.');
    ensure(validateFogCommand(entry.command), 'Invalid fog replay command.'); assertHost(entry.host);
    const result = applyCore(s, entry.command, entry.host);
    ensure(canonical(result.state.journal.at(-1)) === canonical(entry), 'Fog journal receipt does not replay exactly.'); s = result.state;
  }
  return s;
}
export function validateFogState(value: unknown): value is FogState {
  try { if (!record(value) || !record(value.origin) || !Array.isArray(value.journal)) return false; const s = value as unknown as FogState; return canonical(replayFog(s.origin, s.journal)) === canonical(s); } catch { return false; }
}
export function transitionFog(s: FogState, command: FogCommand, host: FogHostFacts): FogTransition {
  ensure(validateFogState(s), 'Fog state is not an exact replay of its original journal.'); return applyCore(s, command, host);
}
/** A central replay owns this capability from its independently verified original
 * host. It cannot import a saved state, skip flag, or supplied journal prefix.
 * Public saved-state entry points above and below keep their strict full replay. */
export interface FogReplayCursor {
  snapshot(): FogState;
  matches(candidate: unknown): boolean;
  fork(): FogReplayCursor;
  block(command: FogCommand, host: FogHostFacts): string | null;
  advance(command: FogCommand, host: FogHostFacts): FogTransition;
  project(host: FogHostFacts): ReturnType<typeof fogProjection>;
  actionProjection(command: FogCommand, host: FogHostFacts, label: string): FogActionProjection;
  consumptionBlock(host: FogHostFacts): string | null;
  consumptionEvidence(host: FogHostFacts): FogConsumptionEvidence;
}
export function createFogReplayCursor(originalHost: FogHostFacts): FogReplayCursor {
  return ownFogReplayCursor(createFogState(originalHost));
}
/** Only the original constructor and an existing owned cursor can enter here.
 * Neither snapshots nor transition results expose the mutable owned state. */
function ownFogReplayCursor(initial: FogState): FogReplayCursor {
  let current = initial;
  return Object.freeze({
    snapshot: (): FogState => structuredClone(current),
    matches: (candidate: unknown): boolean => {
      try { return canonical(current) === canonical(candidate); } catch { return false; }
    },
    fork: (): FogReplayCursor => ownFogReplayCursor(structuredClone(current)),
    project: (host: FogHostFacts) => {
      ensure(current.journal.length <= 10000, 'Cannot project an invalid fog journal.');
      return structuredClone(projectVerifiedFog(current, host));
    },
    actionProjection: (command: FogCommand, host: FogHostFacts, label: string) => current.journal.length <= 10000
      ? structuredClone(projectVerifiedFogAction(current, command, host, label))
      : { command: structuredClone(command), label, available: false, blocker: 'Invalid replayed fog state.', cost: null, elapsedSeconds: null },
    consumptionBlock: (host: FogHostFacts) => current.journal.length <= 10000 ? deriveConsumptionBlock(current, host) : '迷雾记录未通过原历史严格重放。',
    consumptionEvidence: (host: FogHostFacts) => {
      ensure(current.journal.length <= 10000, 'Invalid consumption state.');
      return deriveConsumptionEvidence(current, host);
    },
    block: (command: FogCommand, host: FogHostFacts): string | null => {
      try {
        ensure(current.journal.length <= 10000, 'Invalid replayed fog state.');
        applyCore(current, command, previewHost(current, command, host)); return null;
      } catch (error) { return error instanceof Error ? error.message : 'Fog action is unavailable.'; }
    },
    advance: (command: FogCommand, host: FogHostFacts): FogTransition => {
      // Match transitionFog's INPUT limit: length 10000 can append once; the
      // resulting 10001 prefix cannot be used by another transition or preview.
      ensure(current.journal.length <= 10000, 'Fog state is not an exact replay of its original journal.');
      const next = applyCore(current, command, host), result = structuredClone(next);
      current = next.state; return result;
    },
  });
}
/** Prediction uses a private successful placeholder only to inspect preconditions;
 * it does not consume RNG, reveal a die, mutate state, or promise success. */
function previewHost(s: FogState, command: FogCommand, host: FogHostFacts): FogHostFacts {
  const h = structuredClone(host); if (command.type === 'PREPARE_STATION') h.rolls = candidates(s, command.stationId).map(() => 1); return h;
}
export function fogCommandBlock(s: FogState, command: FogCommand, host: FogHostFacts): string | null { try { ensure(validateFogState(s), 'Invalid replayed fog state.'); applyCore(s, command, previewHost(s, command, host)); return null; } catch (error) { return error instanceof Error ? error.message : 'Fog action is unavailable.'; } }
export const canFogCommand = (s: FogState, c: FogCommand, h: FogHostFacts): boolean => fogCommandBlock(s, c, h) === null;
export interface FogActionProjection { command: FogCommand; label: string; available: boolean; blocker: string | null; cost: FogCost | null; elapsedSeconds: number | null }
/** Private reuse within one projection only. The public entry points above and
 * below still fully validate the unmodified original journal on every call. */
function projectVerifiedFogAction(s: FogState, command: FogCommand, h: FogHostFacts, label: string): FogActionProjection {
  try {
    const r = applyCore(s, command, previewHost(s, command, h));
    return { command, label, available: true, blocker: null, cost: r.cost, elapsedSeconds: r.elapsedSeconds };
  } catch (error) {
    const blocker = error instanceof Error ? error.message : 'Fog action is unavailable.';
    return { command, label, available: false, blocker, cost: null, elapsedSeconds: null };
  }
}
export function fogActionProjection(s: FogState, command: FogCommand, h: FogHostFacts, label: string): FogActionProjection {
  if (!validateFogState(s)) return { command, label, available: false, blocker: 'Invalid replayed fog state.', cost: null, elapsedSeconds: null };
  return projectVerifiedFogAction(s, command, h, label);
}
export function fogProjection(s: FogState, h: FogHostFacts) {
  ensure(validateFogState(s), 'Cannot project an invalid fog journal.'); return projectVerifiedFog(s, h);
}
function projectVerifiedFog(s: FogState, h: FogHostFacts) {
  assertHost(h);
  const units = deriveControlUnitIds(s, h).length, circuit = currentCircuit(s), remainingSeconds = running(circuit) && circuit.deadlineSecond !== null && h.week === circuit.week && h.activityEpoch === circuit.activityEpoch ? Math.max(0, circuit.deadlineSecond - h.nowSecond) : 0;
  return {
    manifestId: WORLD_HISTORY_MANIFEST_ID, controlledUnits: units, totalUnits: WORLD_HISTORY_DENOMINATOR, ratio: units / WORLD_HISTORY_DENOMINATOR, meetsQuarter: units >= 1024,
    activeWormCount: activeWormCount(s), totalSharedWorms: activeWormCount(s) + h.externalLiveWormIds.length, wormCapacity: FOG_WORM_CAPACITY, remainingSeconds,
    routeMetres: FOG_ROUTE_METRES, location: h.location,
    stations: FOG_STATION_CONTENT.map(content => {
      const corridors = s.corridors.filter(c => c.stationId === content.id), prepared = corridors.filter(c => proofReady(s, c)).length;
      return { id: content.id, title: content.title, preparedCorridors: prepared, totalCorridors: 4, status: prepared < 4 ? '筹备中' : corridors.every(c => c.activeCircuitId === circuit?.id) && units > 0 ? '正在维持' : '已准备，休眠中',
        prepare: projectVerifiedFogAction(s, { type: 'PREPARE_STATION', stationId: content.id }, h, '准备本站四条原廊'), activate: projectVerifiedFogAction(s, { type: 'ACTIVATE_STATION', stationId: content.id }, h, '现场启用本站') };
    }),
    startCircuit: projectVerifiedFogAction(s, { type: 'START_CIRCUIT' }, h, '开始一次巡回维护'),
    cancelCircuit: projectVerifiedFogAction(s, { type: 'CANCEL_CIRCUIT' }, h, '撤回维持并正常离开'),
    consumptionBlocker: deriveConsumptionBlock(s, h),
  };
}
