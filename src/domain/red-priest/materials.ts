import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import {
  RED_PRIEST_CHARACTERISTIC_IDS, RED_PRIEST_COMPOUND_INPUT_ROLES, RED_PRIEST_MATERIAL_COSTS,
  RED_PRIEST_MATERIAL_IDS, RED_PRIEST_MATERIAL_LOCATIONS,
  RED_PRIEST_RELIC_CUSTODY, RED_PRIEST_SOURCE_BOTTLES, RED_PRIEST_SUPPLIER_LEADS, RED_PRIEST_UNIQUENESS_ID,
  redPriestCompoundSupply,
  type RedPriestCompoundInput, type RedPriestMaterialCost, type RedPriestRelicCustody,
} from './material-content.js';

/** Independent 209 material prototype. The authenticated host must validate the
 * original S1 save once, close its older supply/consume paths, and atomically
 * commit this state, the returned expense receipt and its real consequences.
 * This module never changes the prior source/bottles/acquisitionJournal, creates
 * cash, decides promotion checks, supplies war achievements, protects life, or
 * promises recoverability. Authority functions are server capabilities, never
 * reconstructed from player commands or save data. */
export interface RedPriestMaterialStamp { week: number; revision: number }
export interface RedPriestPriorBottleReceipt extends RedPriestMaterialStamp {
  bottleId: string; eventId: string; sourceDigest: string; acquisitionEventDigest: string;
  status: 'CONSUMED' | 'SUPPLIER' | 'PLAYER'; outcome: 'FAILURE' | 'GREAT_FAILURE' | 'SUCCESS' | 'GREAT_SUCCESS' | null; roll: number | null; chance: number | null;
  integratedActorId: string | null;
}
export interface RedPriestMaterialsOrigin {
  version: 1; caseId: string; actorId: string;
  sourceSnapshotDigest: string;
  /** Separately bind all three immutable roots, not only a prior-stage digest. */
  sourceDigest: string; bottlesDigest: string; acquisitionJournalDigest: string;
  checkpoint: RedPriestMaterialStamp & { locationId: string };
  bottles: RedPriestPriorBottleReceipt[];
  uniqueness: { id: typeof RED_PRIEST_UNIQUENESS_ID; incumbentActorId: null; custody: RedPriestRelicCustody[] };
}
export interface RedPriestMaterialActor {
  status: 'ACTIVE' | 'DEAD'; sequence: number | null; health: number; mind: number;
  pollution: number; injuryIds: string[];
}
export type RedPriestMaterialDisposition = 'UNLOCATED' | 'SUPPLIER_BOTTLED' | 'LOCATED_SEALED' | 'LOCATED_DIRTY' | 'VERIFIED_DIRTY' |
  'CLEAN_SEALED' | 'PLAYER_HELD' | 'INTEGRATED_PLAYER' | 'SEALED_RELIC' |
  'INSPECTED_RELIC' | 'VERIFIED_RELIC' | 'IN_COMPOUND' | 'INTEGRATED_S0' | 'UNAVAILABLE';
export interface RedPriestMaterialItem {
  id: string; kind: 'CHARACTERISTIC' | 'UNIQUENESS'; sourceBottleId: string | null;
  sourceEventId: string; disposition: RedPriestMaterialDisposition; holderId: string | null;
  locationId: string | null; containerId: string | null; contamination: number | null;
  recoverable: boolean; tracedWeek: number | null; verifiedWeek: number | null;
  purifiedWeek: number | null; lastReceiptId: string | null;
}
export type RedPriestMaterialCommand =
  | { type: 'TRACE_DISPOSITION' | 'VERIFY_CONTAINER' | 'PURIFY_REMAINS' | 'TRANSFER_CUSTODY'; itemId: string }
  | { type: 'INSPECT_RELIC' | 'VERIFY_RELIC' | 'TRANSFER_RELIC' | 'PREPARE_COMPOUND' };
interface EvidenceBase extends RedPriestMaterialStamp {
  id: string; originDigest: string; actorId: string; locationId: string; eventId: string;
}
/** These receipts describe events already independently checked by the host.
 * No public intent can send a proof, outcome, destination or cost. */
export interface RedPriestMaterialCheckReceipt extends EvidenceBase {
  kind: 'MATERIAL_CHECK'; action: Exclude<RedPriestMaterialCommand['type'], 'PREPARE_COMPOUND'>;
  itemId: string; sourceEventId: string; checkReceiptId: string;
  result: 'SUCCESS' | 'FAILURE' | 'UNAVAILABLE';
  containerId: string | null; materialLocationId: string | null; custodianId: string | null;
  contaminationBefore: number | null; contaminationAfter: number | null;
  recoverable: boolean; custodyRecordId: string | null; actorAfter: RedPriestMaterialActor;
}
export interface RedPriestMaterialSupplyReceipt extends EvidenceBase {
  kind: 'COMPOUND_SUPPLY'; batchId: string; providerId: string; chargedCash: number;
  inputs: RedPriestCompoundInput[];
}
export type RedPriestMaterialEvidence = RedPriestMaterialCheckReceipt | RedPriestMaterialSupplyReceipt;
export interface RedPriestMaterialFrame extends RedPriestMaterialStamp {
  eventId: string; actorId: string; originDigest: string; locationId: string;
  actor: RedPriestMaterialActor; resources: RedPriestMaterialCost;
  evidence: RedPriestMaterialEvidence | null;
}
export interface RedPriestMaterialAuthority {
  /** Verify against the frozen authenticated source, including full original S1
   * validation. Matching these small digests alone is NOT source verification. */
  verifyOrigin(origin: Readonly<RedPriestMaterialsOrigin>): boolean;
  verifyHost(frame: Readonly<RedPriestMaterialFrame>): boolean;
  verifyEvidence(evidence: Readonly<RedPriestMaterialEvidence>, frame: Readonly<RedPriestMaterialFrame>): boolean;
  /** Also verify current original custody and absence of another incumbent in
   * the host world; an old origin check cannot prove current exclusivity. */
  verifyConsumption(receipt: Readonly<RedPriestMaterialConsumptionReceipt>, frame: Readonly<RedPriestMaterialFrame>): boolean;
  verifyTransport(receipt: Readonly<RedPriestMaterialTransportReceipt>, frame: Readonly<RedPriestMaterialFrame>): boolean;
}
export interface RedPriestMaterialHost extends RedPriestMaterialFrame { authority: RedPriestMaterialAuthority }
export interface RedPriestMaterialCompound {
  id: string; locationId: string; preparedWeek: number; status: 'PREPARED' | 'CONSUMED';
  integratedMaterialId: string; externalMaterialIds: string[]; uniquenessId: string;
  sourceContainers: { itemId: string; containerId: string }[];
  supplyReceiptId: string; batchId: string; inputs: RedPriestCompoundInput[];
  consumedReceiptId: string | null;
}
export interface RedPriestMaterialDestination {
  itemId: string; disposition: 'INTEGRATED_PLAYER' | 'INTEGRATED_S0' | 'LOCATED_DIRTY' | 'UNAVAILABLE';
  locationId: string | null; containerId: string | null; holderId: string | null;
  contamination: number | null; recoverable: boolean;
}
/** Real central consumption journal result, not an intent. Formula and war
 * receipt IDs must be resolved by verifyConsumption against authenticated host
 * history, including the actual continent-wide war and actual final check. */
export interface RedPriestMaterialConsumptionReceipt extends EvidenceBase {
  compoundId: string; itemIds: string[]; outcome: 'SUCCESS' | 'FAILURE';
  formulaReceiptId: string; warAchievementReceiptId: string; checkReceiptId: string;
  actorBefore: RedPriestMaterialActor; actorAfter: RedPriestMaterialActor;
  destinations: RedPriestMaterialDestination[];
}
/** The host has already executed and paid for this physical journey. All carried
 * originals (including the body) travel together, with their original containers. */
export interface RedPriestMaterialTransportReceipt extends EvidenceBase {
  sourceTravelReceiptId: string; fromLocationId: string; toLocationId: string;
  departedWeek: number; arrivedWeek: number;
  carried: { itemId: string; containerId: string }[];
}
export interface RedPriestMaterialEvent {
  id: string; kind: 'COMMAND' | 'CONSUMPTION' | 'TRANSPORT';
  command: RedPriestMaterialCommand | null; frame: RedPriestMaterialFrame;
  consumption: RedPriestMaterialConsumptionReceipt | null; transport: RedPriestMaterialTransportReceipt | null;
  cost: RedPriestMaterialCost; resourcesAfter: RedPriestMaterialCost;
  beforeDigest: string; afterDigest: string;
}
export interface RedPriestMaterialsState {
  version: 1; origin: RedPriestMaterialsOrigin; originDigest: string;
  status: 'ACTIVE' | 'DEAD' | 'BLOCKED' | 'ASCENDED'; incumbentActorId: string | null;
  items: RedPriestMaterialItem[]; compounds: RedPriestMaterialCompound[]; journal: RedPriestMaterialEvent[];
}
export interface RedPriestMaterialTransition {
  state: RedPriestMaterialsState;
  /** Apply precisely once in the same host transaction. No credit/income fields. */
  receipt: RedPriestMaterialEvent;
  cost: RedPriestMaterialCost;
  consumedInputIds: string[];
  actorAfter: RedPriestMaterialActor;
}
const ZERO: RedPriestMaterialCost = { cash: 0, actions: 0, spirituality: 0 };
const hash = (v: unknown): string => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300;
const nat = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const exact = (v: object, keys: readonly string[]): boolean => same(Object.keys(v).sort(), [...keys].sort());
function assert(v: unknown, code: string): asserts v { if (!v) throw new Error(code); }
function stamp(v: RedPriestMaterialStamp): boolean { return nat(v.week) && nat(v.revision); }
function actor(v: RedPriestMaterialActor): boolean {
  return rec(v) && exact(v, ['status', 'sequence', 'health', 'mind', 'pollution', 'injuryIds']) &&
    (v.status === 'ACTIVE' || v.status === 'DEAD') && (v.sequence === null || nat(v.sequence) && v.sequence <= 9) &&
    nat(v.health) && nat(v.mind) && nat(v.pollution) && Array.isArray(v.injuryIds) &&
    v.injuryIds.every(str) && new Set(v.injuryIds).size === v.injuryIds.length &&
    (v.status === 'DEAD' || v.health > 0 && v.mind > 0);
}
function resources(v: RedPriestMaterialCost): boolean {
  return rec(v) && exact(v, ['cash', 'actions', 'spirituality']) && nat(v.cash) && nat(v.actions) && nat(v.spirituality);
}
function bodyId(actorId: string): string { return `body:${actorId}`; }
function integratedId(state: RedPriestMaterialsState): string {
  return `${state.origin.bottles.find(b => b.integratedActorId === state.origin.actorId)!.bottleId}:characteristic`;
}
function image(s: RedPriestMaterialsState): unknown {
  return { version: s.version, originDigest: s.originDigest, status: s.status,
    incumbentActorId: s.incumbentActorId, items: s.items, compounds: s.compounds };
}
function hostFrame(host: RedPriestMaterialHost): RedPriestMaterialFrame {
  const { authority: _authority, ...frame } = host;
  return structuredClone(frame);
}
function failure(error: unknown): string { return error instanceof Error ? error.message : 'MATERIAL_INVALID'; }
export function validateRedPriestMaterialCommand(v: unknown): v is RedPriestMaterialCommand {
  if (!rec(v)) return false;
  if (['INSPECT_RELIC', 'VERIFY_RELIC', 'TRANSFER_RELIC', 'PREPARE_COMPOUND'].includes(String(v.type))) return exact(v, ['type']);
  return ['TRACE_DISPOSITION', 'VERIFY_CONTAINER', 'PURIFY_REMAINS', 'TRANSFER_CUSTODY'].includes(String(v.type)) &&
    exact(v, ['type', 'itemId']) && typeof v.itemId === 'string' && RED_PRIEST_MATERIAL_IDS.includes(v.itemId);
}
function initial(origin: RedPriestMaterialsOrigin, authority: RedPriestMaterialAuthority): RedPriestMaterialsState {
  assert(rec(origin) && exact(origin, ['version', 'caseId', 'actorId', 'sourceSnapshotDigest', 'sourceDigest', 'bottlesDigest', 'acquisitionJournalDigest', 'checkpoint', 'bottles', 'uniqueness']), 'MATERIAL_ORIGIN_SHAPE');
  assert(origin.version === 1 && str(origin.caseId) && digest(origin.sourceSnapshotDigest) &&
    str(origin.actorId) && [origin.sourceDigest, origin.bottlesDigest, origin.acquisitionJournalDigest].every(digest), 'MATERIAL_ORIGIN_IDENTITY');
  assert(rec(origin.checkpoint) && exact(origin.checkpoint, ['week', 'revision', 'locationId']) && stamp(origin.checkpoint) &&
    origin.checkpoint.week > 0 && origin.checkpoint.revision > 0 && str(origin.checkpoint.locationId), 'MATERIAL_ORIGIN_CHECKPOINT');
  assert(Array.isArray(origin.bottles) && origin.bottles.length === 3, 'UNSUPPORTED_PRIOR_SOURCE: exactly three identified original bottles required');
  assert(new Set(origin.bottles.map(b => b.eventId)).size === 3, 'MATERIAL_DUPLICATE_SOURCE_EVENT');
  const successes = origin.bottles.filter(b => b.status === 'CONSUMED' && (b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS'));
  assert(successes.length === 1, 'MATERIAL_REQUIRES_ONE_ACTUAL_S1_PROMOTION');
  const successReceipt = successes[0]!;
  const items = RED_PRIEST_SOURCE_BOTTLES.map((bottleId, index): RedPriestMaterialItem => {
    const b = origin.bottles[index];
    assert(b && exact(b, ['bottleId', 'eventId', 'sourceDigest', 'acquisitionEventDigest', 'week', 'revision', 'status', 'outcome', 'roll', 'chance', 'integratedActorId']), 'MATERIAL_PRIOR_RECEIPT_SHAPE');
    assert(b.bottleId === bottleId && stamp(b) && b.week <= origin.checkpoint.week && b.revision <= origin.checkpoint.revision &&
      str(b.eventId) && digest(b.sourceDigest) && digest(b.acquisitionEventDigest), 'UNSUPPORTED_PRIOR_SOURCE: do not rename or remap an unrelated original');
    const integrated = b === successReceipt;
    if (b.status === 'CONSUMED') {
      assert(['FAILURE', 'GREAT_FAILURE', 'SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? '') && nat(b.roll) && b.roll >= 1 && b.roll <= 100 &&
        nat(b.chance) && b.chance <= 100 && b.week <= successReceipt.week && b.revision <= successReceipt.revision, 'MATERIAL_PRIOR_CONSUMPTION');
    } else assert((b.status === 'SUPPLIER' || b.status === 'PLAYER') && b.outcome === null && b.roll === null && b.chance === null, 'MATERIAL_UNCONSUMED_IS_NOT_REJECTION');
    assert(b.integratedActorId === (integrated ? origin.actorId : null), 'MATERIAL_PRIOR_INTEGRATION');
    const held = b.status === 'PLAYER';
    return { id: RED_PRIEST_CHARACTERISTIC_IDS[index]!, kind: 'CHARACTERISTIC', sourceBottleId: b.bottleId,
      sourceEventId: b.eventId, disposition: integrated ? 'INTEGRATED_PLAYER' : held ? 'PLAYER_HELD' : b.status === 'SUPPLIER' ? 'SUPPLIER_BOTTLED' : 'UNLOCATED',
      holderId: integrated || held ? origin.actorId : b.status === 'SUPPLIER' ? 'supplier:professional-handoff-keeper' : null,
      locationId: integrated || held ? origin.checkpoint.locationId : b.status === 'SUPPLIER' ? RED_PRIEST_MATERIAL_LOCATIONS.archive : null,
      containerId: integrated ? bodyId(origin.actorId) : held || b.status === 'SUPPLIER' ? b.bottleId : null,
      contamination: integrated || held || b.status === 'SUPPLIER' ? 0 : null,
      recoverable: false, tracedWeek: null, verifiedWeek: null, purifiedWeek: null, lastReceiptId: null };
  });
  assert(rec(origin.uniqueness) && exact(origin.uniqueness, ['id', 'incumbentActorId', 'custody']) &&
    origin.uniqueness.id === RED_PRIEST_UNIQUENESS_ID && origin.uniqueness.incumbentActorId === null &&
    same(origin.uniqueness.custody, RED_PRIEST_RELIC_CUSTODY), 'MATERIAL_UNIQUENESS_CUSTODY');
  assert(authority.verifyOrigin(origin), 'MATERIAL_UNVERIFIED_ORIGIN');
  const custody = origin.uniqueness.custody.at(-1)!;
  items.push({ id: RED_PRIEST_UNIQUENESS_ID, kind: 'UNIQUENESS', sourceBottleId: null, sourceEventId: custody.id,
    disposition: 'SEALED_RELIC', holderId: custody.toCustodianId, locationId: custody.locationId,
    containerId: custody.containerId, contamination: 0, recoverable: false,
    tracedWeek: null, verifiedWeek: null, purifiedWeek: null, lastReceiptId: null });
  return { version: 1, origin: structuredClone(origin), originDigest: hash(origin), status: 'ACTIVE',
    incumbentActorId: null, items, compounds: [], journal: [] };
}
export function createRedPriestMaterials(origin: RedPriestMaterialsOrigin, authority: RedPriestMaterialAuthority): RedPriestMaterialsState {
  return initial(origin, authority);
}
function checkFrame(state: RedPriestMaterialsState, host: RedPriestMaterialHost, allowArrival = false): RedPriestMaterialFrame {
  const f = hostFrame(host), last = state.journal.at(-1)?.frame ?? state.origin.checkpoint;
  assert(exact(f, ['eventId', 'actorId', 'originDigest', 'locationId', 'actor', 'resources', 'evidence', 'week', 'revision']) &&
    stamp(f) && str(f.eventId) && str(f.locationId) && actor(f.actor) && resources(f.resources), 'MATERIAL_HOST_SHAPE');
  // Only transport may move an already ascended body. Acquisition, preparation
  // and another consumption remain closed after the successful final outcome.
  const ascendedTransport = allowArrival && state.status === 'ASCENDED';
  assert(state.status === 'ACTIVE' || ascendedTransport, state.status === 'DEAD' ? 'MATERIAL_ACTOR_DEAD' : 'MATERIAL_NOT_ACTIVE');
  assert(f.actorId === state.origin.actorId && f.originDigest === state.originDigest && f.actor.status === 'ACTIVE' &&
    f.actor.sequence === (ascendedTransport ? 0 : 1), 'MATERIAL_HOST_ACTOR');
  assert(f.week >= last.week && f.revision > last.revision && !state.journal.some(e => e.id === f.eventId), 'MATERIAL_STALE_OR_DUPLICATE_EVENT');
  assert(host.authority.verifyHost(f), 'MATERIAL_UNVERIFIED_HOST');
  if (ascendedTransport) {
    assert(state.incumbentActorId === f.actorId && state.items.length === 4 &&
      same(state.items.map(i => i.id).sort(), [...RED_PRIEST_MATERIAL_IDS].sort()) &&
      state.items.every(i => i.disposition === 'INTEGRATED_S0' && i.holderId === f.actorId &&
        i.containerId === bodyId(f.actorId) && str(i.locationId) && i.locationId === state.items[0]!.locationId &&
        i.contamination === 0 && !i.recoverable) && state.compounds.every(c => c.status === 'CONSUMED'),
    'MATERIAL_ASCENDED_ORIGINAL_BODY_REQUIRED');
  } else {
    const body = state.items.find(i => i.disposition === 'INTEGRATED_PLAYER');
    assert(body && body.id === integratedId(state) && body.holderId === f.actorId &&
      (allowArrival || body.locationId === f.locationId), 'MATERIAL_BODY_NOT_AT_LOCATION');
  }
  return f;
}
function bindEvidence(e: EvidenceBase, frame: RedPriestMaterialFrame): void {
  assert(str(e.id) && e.eventId === frame.eventId && e.actorId === frame.actorId && e.originDigest === frame.originDigest &&
    e.week === frame.week && e.revision === frame.revision && e.locationId === frame.locationId, 'MATERIAL_EVIDENCE_BINDING');
}
function checkProof(state: RedPriestMaterialsState, command: RedPriestMaterialCommand, host: RedPriestMaterialHost,
  f: RedPriestMaterialFrame): RedPriestMaterialCheckReceipt {
  const r = f.evidence;
  assert(r?.kind === 'MATERIAL_CHECK' && exact(r, ['kind', 'id', 'originDigest', 'actorId', 'locationId', 'eventId', 'week', 'revision',
    'action', 'itemId', 'sourceEventId', 'checkReceiptId', 'result', 'containerId', 'materialLocationId', 'custodianId',
    'contaminationBefore', 'contaminationAfter', 'recoverable', 'custodyRecordId', 'actorAfter']), 'MATERIAL_CHECK_RECEIPT_SHAPE');
  bindEvidence(r, f);
  const itemId = 'itemId' in command ? command.itemId : RED_PRIEST_UNIQUENESS_ID;
  assert(r.action === command.type && r.itemId === itemId && str(r.sourceEventId) && str(r.checkReceiptId) &&
    ['SUCCESS', 'FAILURE', 'UNAVAILABLE'].includes(r.result) && typeof r.recoverable === 'boolean' && actor(r.actorAfter), 'MATERIAL_CHECK_RECEIPT_ACTION');
  assert([r.containerId, r.materialLocationId, r.custodianId, r.custodyRecordId].every(v => v === null || str(v)) &&
    [r.contaminationBefore, r.contaminationAfter].every(v => v === null || nat(v)), 'MATERIAL_CHECK_RECEIPT_VALUES');
  assert(r.actorAfter.health <= f.actor.health && r.actorAfter.mind <= f.actor.mind &&
    f.actor.injuryIds.every(id => r.actorAfter.injuryIds.includes(id)), 'MATERIAL_CHECK_CANNOT_ERASE_DAMAGE');
  assert(!state.journal.some(e => e.frame.evidence?.id === r.id ||
    e.frame.evidence?.kind === 'MATERIAL_CHECK' && e.frame.evidence.checkReceiptId === r.checkReceiptId), 'MATERIAL_REUSED_CHECK');
  assert(host.authority.verifyEvidence(r, f), 'MATERIAL_UNVERIFIED_CHECK');
  return r;
}
function pay(frame: RedPriestMaterialFrame, cost: RedPriestMaterialCost): RedPriestMaterialCost {
  assert(frame.resources.cash >= cost.cash && frame.resources.actions >= cost.actions &&
    frame.resources.spirituality >= cost.spirituality, 'MATERIAL_INSUFFICIENT_RESOURCES');
  return { cash: frame.resources.cash - cost.cash, actions: frame.resources.actions - cost.actions,
    spirituality: frame.resources.spirituality - cost.spirituality };
}
function statusAfter(state: RedPriestMaterialsState, after: RedPriestMaterialActor): void {
  if (after.status === 'DEAD') state.status = 'DEAD';
  else if (after.sequence !== 1) state.status = 'BLOCKED';
}
function finish(before: RedPriestMaterialsState, next: RedPriestMaterialsState, frame: RedPriestMaterialFrame,
  kind: RedPriestMaterialEvent['kind'], command: RedPriestMaterialCommand | null, cost: RedPriestMaterialCost,
  after: RedPriestMaterialActor, consumption: RedPriestMaterialConsumptionReceipt | null = null,
  transport: RedPriestMaterialTransportReceipt | null = null, consumedInputIds: string[] = []): RedPriestMaterialTransition {
  const event: RedPriestMaterialEvent = { id: frame.eventId, kind, command: structuredClone(command), frame,
    consumption: structuredClone(consumption), transport: structuredClone(transport), cost: structuredClone(cost),
    resourcesAfter: pay(frame, cost), beforeDigest: hash(image(before)), afterDigest: hash(image(next)) };
  next.journal.push(event);
  return { state: next, receipt: structuredClone(event), cost: structuredClone(cost), consumedInputIds,
    actorAfter: structuredClone(after) };
}
function applyCommand(state: RedPriestMaterialsState, command: RedPriestMaterialCommand, host: RedPriestMaterialHost): RedPriestMaterialTransition {
  assert(validateRedPriestMaterialCommand(command), 'MATERIAL_INVALID_COMMAND');
  const f = checkFrame(state, host), next = structuredClone(state), cost = RED_PRIEST_MATERIAL_COSTS[command.type];
  pay(f, cost);
  if (command.type === 'PREPARE_COMPOUND') {
    assert(f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.workshop && !next.compounds.some(c => c.status === 'PREPARED'), 'MATERIAL_COMPOUND_LOCATION_OR_DUPLICATE');
    const integrated = next.items.find(i => i.id === integratedId(state))!;
    const external = next.items.filter(i => i.id !== integrated.id);
    assert(integrated.disposition === 'INTEGRATED_PLAYER' && external.length === 3 && external.every(i =>
      i.disposition === 'PLAYER_HELD' && i.holderId === f.actorId && i.locationId === f.locationId && str(i.containerId) && i.contamination === 0), 'MATERIAL_REQUIRES_TWO_EXTERNAL_AND_ONE_UNIQUENESS');
    const r = f.evidence, supply = redPriestCompoundSupply(next.compounds.length + 1, state.origin.checkpoint.week);
    assert(supply && r?.kind === 'COMPOUND_SUPPLY' && exact(r, ['kind', 'id', 'originDigest', 'actorId', 'locationId', 'eventId', 'week', 'revision', 'batchId', 'providerId', 'chargedCash', 'inputs']), 'MATERIAL_SUPPLY_EXHAUSTED_OR_INVALID');
    bindEvidence(r, f);
    assert(r.batchId === supply.batchId && r.providerId === supply.providerId && r.chargedCash === cost.cash &&
      f.week >= supply.availableWeek && same(r.inputs, supply.inputs) && r.inputs.length === RED_PRIEST_COMPOUND_INPUT_ROLES.length &&
      !state.compounds.some(c => c.batchId === r.batchId || c.supplyReceiptId === r.id || c.inputs.some(i => r.inputs.some(j => i.id === j.id))), 'MATERIAL_SUPPLY_REUSED_OR_UNPAID');
    assert(host.authority.verifyEvidence(r, f), 'MATERIAL_UNVERIFIED_SUPPLY');
    const bottle = r.inputs.find(i => i.role === 'EMPTY_BOTTLE')!;
    const compound: RedPriestMaterialCompound = { id: bottle.id, locationId: f.locationId, preparedWeek: f.week, status: 'PREPARED',
      integratedMaterialId: integrated.id, externalMaterialIds: RED_PRIEST_CHARACTERISTIC_IDS.filter(id => id !== integrated.id), uniquenessId: RED_PRIEST_UNIQUENESS_ID,
      sourceContainers: external.map(i => ({ itemId: i.id, containerId: i.containerId! })),
      supplyReceiptId: r.id, batchId: r.batchId, inputs: structuredClone(r.inputs), consumedReceiptId: null };
    for (const item of external) { item.disposition = 'IN_COMPOUND'; item.containerId = bottle.id; item.lastReceiptId = r.id; item.recoverable = false; }
    next.compounds.push(compound);
    return finish(state, next, f, 'COMMAND', command, cost, f.actor, null, null, r.inputs.map(i => i.id));
  }
  const r = checkProof(state, command, host, f), item = next.items.find(i => i.id === r.itemId)!;
  assert(item && r.sourceEventId === item.sourceEventId, 'MATERIAL_ORIGINAL_SOURCE_EVENT');
  const passed = r.result === 'SUCCESS';
  const lead = RED_PRIEST_SUPPLIER_LEADS.find(l => l.itemId === item.id);
  if (command.type === 'TRACE_DISPOSITION') {
    const bottled = item.disposition === 'SUPPLIER_BOTTLED';
    const source = next.origin.bottles.find(b => b.bottleId === item.sourceBottleId);
    assert(source && item.id !== integratedId(state) && item.sourceEventId === source.eventId &&
      (bottled || lead && item.disposition === 'UNLOCATED') && f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.archive,
    'MATERIAL_TRACE_REQUIRES_ORIGINAL_SUPPLIER_OR_FAILURE');
    if (passed && bottled) {
      assert(r.materialLocationId === item.locationId && r.containerId === item.containerId && r.custodianId === item.holderId &&
        r.contaminationBefore === 0 && r.contaminationAfter === 0 && r.recoverable && r.custodyRecordId === source.eventId,
      'MATERIAL_SUPPLIER_ORIGINAL_UNCONSUMED_BOTTLE');
      item.disposition = 'LOCATED_SEALED'; item.recoverable = true; item.tracedWeek = f.week;
    } else if (passed) {
      assert(lead && r.materialLocationId === lead.locationId && r.containerId === lead.containerId && r.custodianId === lead.custodianId &&
        nat(r.contaminationAfter) && r.contaminationAfter > 0 && r.recoverable && r.custodyRecordId === lead.leadId, 'MATERIAL_TRACE_ORIGINAL_CONTAINER');
      Object.assign(item, { disposition: 'LOCATED_DIRTY', holderId: r.custodianId, locationId: r.materialLocationId,
        containerId: r.containerId, contamination: r.contaminationAfter, recoverable: true, tracedWeek: f.week });
    }
  } else if (command.type === 'VERIFY_CONTAINER' || command.type === 'PURIFY_REMAINS' || command.type === 'TRANSFER_CUSTODY') {
    const sealedBottle = item.disposition === 'LOCATED_SEALED';
    const required = command.type === 'VERIFY_CONTAINER' ? (sealedBottle ? 'LOCATED_SEALED' : 'LOCATED_DIRTY') : command.type === 'PURIFY_REMAINS' ? 'VERIFIED_DIRTY' : 'CLEAN_SEALED';
    assert(item.id !== integratedId(state) && item.disposition === required && item.recoverable && item.locationId === f.locationId &&
      r.materialLocationId === item.locationId && r.containerId === item.containerId && r.custodianId === item.holderId &&
      r.contaminationBefore === item.contamination && (r.recoverable || r.result === 'UNAVAILABLE'), 'MATERIAL_ORIGINAL_SEALED_ITEM_REQUIRED');
    if (command.type === 'VERIFY_CONTAINER') {
      assert(item.tracedWeek !== null && f.week > item.tracedWeek, 'MATERIAL_INVESTIGATION_REQUIRES_LATER_WEEK');
      if (passed) {
        assert(r.contaminationAfter === item.contamination, 'MATERIAL_VERIFICATION_CANNOT_PURIFY');
        item.disposition = sealedBottle ? 'CLEAN_SEALED' : 'VERIFIED_DIRTY'; item.verifiedWeek = f.week;
        if (sealedBottle) item.purifiedWeek = f.week;
      }
    } else if (command.type === 'PURIFY_REMAINS') {
      assert(item.verifiedWeek !== null && f.week > item.verifiedWeek, 'MATERIAL_PURIFICATION_REQUIRES_LATER_WEEK');
      if (passed) { assert(r.contaminationAfter === 0, 'MATERIAL_POLLUTION_REMAINS'); item.disposition = 'CLEAN_SEALED'; item.contamination = 0; item.purifiedWeek = f.week; }
    } else {
      assert(item.contamination === 0 && item.purifiedWeek !== null && r.contaminationAfter === 0, 'MATERIAL_DIRTY_HANDOFF');
      if (passed) { item.disposition = 'PLAYER_HELD'; item.holderId = f.actorId; item.recoverable = false; }
    }
  } else {
    const custody = next.origin.uniqueness.custody.at(-1)!;
    assert(item.id === RED_PRIEST_UNIQUENESS_ID && r.custodyRecordId === custody.id && item.sourceEventId === custody.id &&
      r.containerId === custody.containerId && r.materialLocationId === custody.locationId && r.custodianId === custody.toCustodianId &&
      r.contaminationBefore === 0 && r.contaminationAfter === 0, 'MATERIAL_RELIC_ORIGINAL_CUSTODY');
    if (command.type === 'INSPECT_RELIC') {
      assert(item.disposition === 'SEALED_RELIC' && f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.relicArchive, 'MATERIAL_RELIC_ARCHIVE');
      if (passed) { item.disposition = 'INSPECTED_RELIC'; item.tracedWeek = f.week; }
    } else if (command.type === 'VERIFY_RELIC') {
      assert(item.disposition === 'INSPECTED_RELIC' && item.tracedWeek !== null && f.week > item.tracedWeek &&
        f.locationId === custody.locationId, 'MATERIAL_RELIC_IN_PERSON_NEXT_WEEK');
      if (passed) { item.disposition = 'VERIFIED_RELIC'; item.verifiedWeek = f.week; }
    } else {
      assert(command.type === 'TRANSFER_RELIC' && item.disposition === 'VERIFIED_RELIC' && item.verifiedWeek !== null &&
        f.week > item.verifiedWeek && f.locationId === custody.locationId, 'MATERIAL_RELIC_HANDOFF_NEXT_WEEK');
      if (passed) { item.disposition = 'PLAYER_HELD'; item.holderId = f.actorId; }
    }
  }
  if (!passed && r.result === 'UNAVAILABLE') {
    item.disposition = 'UNAVAILABLE'; item.recoverable = false;
  }
  if (!passed && r.result === 'FAILURE') {
    // Failed attempts can worsen residue, never silently cleanse it.
    assert(r.contaminationAfter === null || item.contamination === null || r.contaminationAfter >= item.contamination, 'MATERIAL_FAILED_CHECK_CANNOT_CLEAN');
    if (item.contamination !== null && r.contaminationAfter !== null) item.contamination = r.contaminationAfter;
  }
  item.lastReceiptId = r.id;
  statusAfter(next, r.actorAfter);
  return finish(state, next, f, 'COMMAND', command, cost, r.actorAfter);
}
function consume(state: RedPriestMaterialsState, host: RedPriestMaterialHost, r: RedPriestMaterialConsumptionReceipt): RedPriestMaterialTransition {
  const f = checkFrame(state, host), next = structuredClone(state);
  assert(f.evidence === null && exact(r, ['id', 'originDigest', 'actorId', 'locationId', 'eventId', 'week', 'revision', 'compoundId', 'itemIds', 'outcome',
    'formulaReceiptId', 'warAchievementReceiptId', 'checkReceiptId', 'actorBefore', 'actorAfter', 'destinations']), 'MATERIAL_CONSUMPTION_SHAPE');
  bindEvidence(r, f);
  assert(str(r.formulaReceiptId) && str(r.warAchievementReceiptId) && str(r.checkReceiptId) &&
    actor(r.actorBefore) && actor(r.actorAfter) && same(r.actorBefore, f.actor) &&
    r.actorBefore.injuryIds.every(id => r.actorAfter.injuryIds.includes(id)) &&
    (r.outcome === 'SUCCESS' || r.outcome === 'FAILURE') &&
    Array.isArray(r.itemIds) && same([...r.itemIds].sort(), [...RED_PRIEST_MATERIAL_IDS].sort()), 'MATERIAL_CONSUMPTION_ACTUAL_ACHIEVEMENTS');
  assert(!state.journal.some(e => e.consumption?.id === r.id || e.consumption?.checkReceiptId === r.checkReceiptId), 'MATERIAL_DOUBLE_CONSUMPTION');
  const compound = next.compounds.find(c => c.id === r.compoundId);
  assert(compound?.status === 'PREPARED' && compound.locationId === f.locationId && compound.preparedWeek <= f.week &&
    next.items.filter(i => i.id !== compound.integratedMaterialId).every(i => i.disposition === 'IN_COMPOUND' && i.containerId === compound.id && i.locationId === f.locationId), 'MATERIAL_ORIGINAL_COMPOUND_REQUIRED');
  assert(Array.isArray(r.destinations) && r.destinations.length === 4 &&
    same(r.destinations.map(d => d.itemId).sort(), [...RED_PRIEST_MATERIAL_IDS].sort()), 'MATERIAL_FOUR_ORIGINAL_DESTINATIONS');
  assert(host.authority.verifyConsumption(r, f), 'MATERIAL_UNVERIFIED_CONSUMPTION');
  for (const d of r.destinations) {
    assert(exact(d, ['itemId', 'disposition', 'locationId', 'containerId', 'holderId', 'contamination', 'recoverable']) &&
      typeof d.recoverable === 'boolean' && [d.locationId, d.containerId, d.holderId].every(v => v === null || str(v)) &&
      (d.contamination === null || nat(d.contamination)), 'MATERIAL_DESTINATION_SHAPE');
    const item = next.items.find(i => i.id === d.itemId)!;
    if (r.outcome === 'SUCCESS') {
      assert(r.actorAfter.status === 'ACTIVE' && r.actorAfter.sequence === 0 && d.disposition === 'INTEGRATED_S0' &&
        d.locationId === f.locationId && d.containerId === bodyId(f.actorId) && d.holderId === f.actorId &&
        d.contamination === 0 && !d.recoverable, 'MATERIAL_SUCCESS_ONE_BODY_ONLY');
    } else if (d.disposition === 'INTEGRATED_PLAYER') {
      assert(item.id === integratedId(state) && r.actorAfter.status === 'ACTIVE' && r.actorAfter.sequence === 1 &&
        d.holderId === f.actorId && d.containerId === bodyId(f.actorId) && d.locationId === f.locationId && !d.recoverable,
      'MATERIAL_PERSONAL_CHARACTERISTIC_NOT_INVENTORY');
    } else if (d.disposition === 'LOCATED_DIRTY') {
      assert(str(d.locationId) && str(d.containerId) && d.containerId !== compound.id && d.containerId !== bodyId(f.actorId) &&
        str(d.holderId) && nat(d.contamination) && d.contamination > 0 && d.recoverable, 'MATERIAL_RECOVERY_REQUIRES_ACTUAL_SEALED_RESIDUE');
    } else assert(d.disposition === 'UNAVAILABLE' && !d.recoverable, 'MATERIAL_FAILURE_NO_GUARANTEED_RECOVERY');
    Object.assign(item, d, { sourceEventId: r.id, lastReceiptId: r.id,
      tracedWeek: d.disposition === 'LOCATED_DIRTY' ? f.week : null, verifiedWeek: null, purifiedWeek: null });
  }
  // Different loose residues must have different original containers. Items in
  // the single body or prepared potion are the only permitted shared containers.
  const residues = next.items.filter(i => i.disposition === 'LOCATED_DIRTY');
  assert(new Set(residues.map(i => i.containerId)).size === residues.length, 'MATERIAL_DUPLICATE_RESIDUE_CONTAINER');
  compound.status = 'CONSUMED'; compound.consumedReceiptId = r.id;
  if (r.outcome === 'SUCCESS') { next.status = 'ASCENDED'; next.incumbentActorId = f.actorId; }
  else { statusAfter(next, r.actorAfter); if (!next.items.some(i => i.disposition === 'INTEGRATED_PLAYER') && next.status === 'ACTIVE') next.status = 'BLOCKED'; }
  return finish(state, next, f, 'CONSUMPTION', null, ZERO, r.actorAfter, r);
}
function transport(state: RedPriestMaterialsState, host: RedPriestMaterialHost, r: RedPriestMaterialTransportReceipt): RedPriestMaterialTransition {
  const f = checkFrame(state, host, true), next = structuredClone(state);
  assert(f.evidence === null && exact(r, ['id', 'originDigest', 'actorId', 'locationId', 'eventId', 'week', 'revision', 'sourceTravelReceiptId',
    'fromLocationId', 'toLocationId', 'departedWeek', 'arrivedWeek', 'carried']), 'MATERIAL_TRANSPORT_SHAPE');
  bindEvidence(r, f);
  assert(str(r.sourceTravelReceiptId) && str(r.fromLocationId) && r.toLocationId === f.locationId && r.fromLocationId !== r.toLocationId &&
    nat(r.departedWeek) && nat(r.arrivedWeek) && r.departedWeek >= (state.journal.at(-1)?.frame.week ?? state.origin.checkpoint.week) &&
    r.arrivedWeek === f.week && r.arrivedWeek >= r.departedWeek && Array.isArray(r.carried), 'MATERIAL_ACTUAL_TRANSPORT_TIME');
  const transportable = next.status === 'ASCENDED' ? ['INTEGRATED_S0'] : ['INTEGRATED_PLAYER', 'PLAYER_HELD', 'IN_COMPOUND'];
  const carried = next.items.filter(i => i.holderId === f.actorId && transportable.includes(i.disposition));
  assert(carried.length > 0 && carried.every(i => i.locationId === r.fromLocationId && str(i.containerId)) &&
    same(r.carried, carried.map(i => ({ itemId: i.id, containerId: i.containerId! }))), 'MATERIAL_TRANSPORT_ALL_ORIGINALS');
  assert(!state.journal.some(e => e.transport?.id === r.id || e.transport?.sourceTravelReceiptId === r.sourceTravelReceiptId) &&
    host.authority.verifyTransport(r, f), 'MATERIAL_UNVERIFIED_OR_REUSED_TRANSPORT');
  for (const item of carried) item.locationId = r.toLocationId;
  for (const compound of next.compounds.filter(c => c.status === 'PREPARED')) {
    assert(compound.locationId === r.fromLocationId, 'MATERIAL_COMPOUND_TRANSPORT_ORIGIN'); compound.locationId = r.toLocationId;
  }
  return finish(state, next, f, 'TRANSPORT', null, ZERO, f.actor, null, r);
}
/** Replay uses only small receipts, never the large prior save. The authority
 * must support verification of historical receipts, not only the current turn. */
export function validateRedPriestMaterials(value: unknown, authority: RedPriestMaterialAuthority): value is RedPriestMaterialsState {
  try {
    assert(rec(value) && exact(value, ['version', 'origin', 'originDigest', 'status', 'incumbentActorId', 'items', 'compounds', 'journal']), 'MATERIAL_STATE_SHAPE');
    const state = value as unknown as RedPriestMaterialsState;
    assert(Array.isArray(state.journal) && state.journal.length <= 512, 'MATERIAL_JOURNAL_LIMIT');
    let replay = initial(state.origin, authority);
    for (const e of state.journal) {
      assert(rec(e) && exact(e, ['id', 'kind', 'command', 'frame', 'consumption', 'transport', 'cost', 'resourcesAfter', 'beforeDigest', 'afterDigest']), 'MATERIAL_EVENT_SHAPE');
      const host = { ...e.frame, authority };
      let result: RedPriestMaterialTransition;
      if (e.kind === 'COMMAND' && e.command !== null && e.consumption === null && e.transport === null) result = applyCommand(replay, e.command, host);
      else if (e.kind === 'CONSUMPTION' && e.command === null && e.consumption !== null && e.transport === null) result = consume(replay, host, e.consumption);
      else if (e.kind === 'TRANSPORT' && e.command === null && e.consumption === null && e.transport !== null) result = transport(replay, host, e.transport);
      else throw new Error('MATERIAL_EVENT_KIND');
      assert(same(result.receipt, e), 'MATERIAL_EVENT_REPLAY_MISMATCH'); replay = result.state;
    }
    return same(replay, state);
  } catch { return false; }
}
/** Fast invariant guard for ordinary host transactions. Full replay is an
 * explicit load/audit operation, not repeated for each player action. The host
 * owns this state; clients can submit only validateRedPriestMaterialCommand. */
function verified(state: RedPriestMaterialsState, _authority: RedPriestMaterialAuthority): void {
  assert(rec(state) && exact(state, ['version', 'origin', 'originDigest', 'status', 'incumbentActorId', 'items', 'compounds', 'journal']) &&
    state.version === 1 && state.originDigest === hash(state.origin) && Array.isArray(state.items) && state.items.length === 4 &&
    same(state.items.map(i => i.id).sort(), [...RED_PRIEST_MATERIAL_IDS].sort()) && Array.isArray(state.compounds) &&
    state.compounds.length <= 3 && new Set(state.compounds.map(c => c.id)).size === state.compounds.length &&
    Array.isArray(state.journal) && state.journal.length < 512, 'MATERIAL_INVALID_STATE');
  const tail = state.journal.at(-1);
  if (tail) assert(tail.afterDigest === hash(image(state)), 'MATERIAL_STATE_DIGEST_MISMATCH');
  else {
    // Initial state is tiny; this catches inventory edits before the first action.
    const recreated = initial(state.origin, { ..._authority, verifyOrigin: () => true });
    assert(same(state, recreated), 'MATERIAL_INITIAL_STATE_MISMATCH');
  }
}
export function reduceRedPriestMaterials(state: RedPriestMaterialsState, command: RedPriestMaterialCommand, host: RedPriestMaterialHost): RedPriestMaterialTransition {
  verified(state, host.authority); return applyCommand(state, command, host);
}
/** Read-only action availability, before the host spends resources or resolves
 * its actual check. No invented evidence receipt is needed to render a button. */
export function redPriestMaterialBlock(state: RedPriestMaterialsState, command: unknown, host: RedPriestMaterialHost): string | null {
  try {
    assert(validateRedPriestMaterialCommand(command), 'MATERIAL_INVALID_COMMAND');
    verified(state, host.authority);
    const f = checkFrame(state, host);
    pay(f, RED_PRIEST_MATERIAL_COSTS[command.type]);
    const item = state.items.find(i => i.id === ('itemId' in command ? command.itemId : RED_PRIEST_UNIQUENESS_ID))!;
    if (command.type === 'PREPARE_COMPOUND') {
      assert(f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.workshop && !state.compounds.some(c => c.status === 'PREPARED'), 'MATERIAL_COMPOUND_LOCATION_OR_DUPLICATE');
      assert(state.items.filter(i => i.id !== integratedId(state)).every(i => i.disposition === 'PLAYER_HELD' && i.holderId === f.actorId &&
        i.locationId === f.locationId && i.contamination === 0), 'MATERIAL_REQUIRES_TWO_EXTERNAL_AND_ONE_UNIQUENESS');
      assert(redPriestCompoundSupply(state.compounds.length + 1, state.origin.checkpoint.week), 'MATERIAL_SUPPLY_EXHAUSTED_OR_INVALID');
    } else if (command.type === 'TRACE_DISPOSITION') {
      assert(item.id !== integratedId(state) && (item.disposition === 'SUPPLIER_BOTTLED' ||
        item.disposition === 'UNLOCATED' && RED_PRIEST_SUPPLIER_LEADS.some(l => l.itemId === item.id)) &&
        f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.archive, 'MATERIAL_TRACE_REQUIRES_ORIGINAL_SUPPLIER_OR_FAILURE');
    } else if (command.type === 'VERIFY_CONTAINER') {
      assert(item.id !== integratedId(state) && ['LOCATED_DIRTY', 'LOCATED_SEALED'].includes(item.disposition) && item.recoverable &&
        item.locationId === f.locationId, 'MATERIAL_ORIGINAL_SEALED_ITEM_REQUIRED');
      assert(item.tracedWeek !== null && f.week > item.tracedWeek, 'MATERIAL_INVESTIGATION_REQUIRES_LATER_WEEK');
    } else if (command.type === 'PURIFY_REMAINS') {
      assert(item.id !== integratedId(state) && item.disposition === 'VERIFIED_DIRTY' && item.recoverable && item.locationId === f.locationId, 'MATERIAL_ORIGINAL_SEALED_ITEM_REQUIRED');
      assert(item.verifiedWeek !== null && f.week > item.verifiedWeek, 'MATERIAL_PURIFICATION_REQUIRES_LATER_WEEK');
    } else if (command.type === 'TRANSFER_CUSTODY') {
      assert(item.id !== integratedId(state) && item.disposition === 'CLEAN_SEALED' && item.recoverable && item.contamination === 0 &&
        item.locationId === f.locationId, 'MATERIAL_ORIGINAL_SEALED_ITEM_REQUIRED');
    } else if (command.type === 'INSPECT_RELIC') {
      assert(item.disposition === 'SEALED_RELIC' && f.locationId === RED_PRIEST_MATERIAL_LOCATIONS.relicArchive, 'MATERIAL_RELIC_ARCHIVE');
    } else if (command.type === 'VERIFY_RELIC') {
      assert(item.disposition === 'INSPECTED_RELIC' && item.tracedWeek !== null && f.week > item.tracedWeek &&
        f.locationId === item.locationId, 'MATERIAL_RELIC_IN_PERSON_NEXT_WEEK');
    } else assert(item.disposition === 'VERIFIED_RELIC' && item.verifiedWeek !== null && f.week > item.verifiedWeek &&
      f.locationId === item.locationId, 'MATERIAL_RELIC_HANDOFF_NEXT_WEEK');
    return null;
  } catch (error) { return failure(error); }
}
export function applyRedPriestMaterialConsumption(state: RedPriestMaterialsState, host: RedPriestMaterialHost,
  receipt: RedPriestMaterialConsumptionReceipt): RedPriestMaterialTransition {
  verified(state, host.authority); return consume(state, host, receipt);
}
export function transportRedPriestMaterials(state: RedPriestMaterialsState, host: RedPriestMaterialHost,
  receipt: RedPriestMaterialTransportReceipt): RedPriestMaterialTransition {
  verified(state, host.authority); return transport(state, host, receipt);
}
const dispositionLabels: Record<RedPriestMaterialDisposition, string> = {
  UNLOCATED: '去向待查', SUPPLIER_BOTTLED: '供应方保管的未服原瓶', LOCATED_SEALED: '已定位的未服原瓶', LOCATED_DIRTY: '已定位的污染封存物', VERIFIED_DIRTY: '原件已核验，仍需净化',
  CLEAN_SEALED: '已净化，尚未交接', PLAYER_HELD: '本人持有原件', INTEGRATED_PLAYER: '已融合于本人',
  SEALED_RELIC: '独立封存遗物', INSPECTED_RELIC: '已查保管记录', VERIFIED_RELIC: '原封遗物已核验',
  IN_COMPOUND: '在本次调配药液中', INTEGRATED_S0: '已融入本人晋升结果', UNAVAILABLE: '当前无法取回',
};
/** Public projection omits hidden leads, exact unrevealed sites, source hashes,
 * private checks and authority capabilities. No player-facing development tags. */
export function projectRedPriestMaterials(state: RedPriestMaterialsState) {
  return {
    title: '红祭司晋升材料', status: state.status === 'ASCENDED' ? '晋升已完成' : state.status === 'DEAD' ? '周目已结束' : state.status === 'BLOCKED' ? '当前无法继续' : '筹备中',
    rule: '本人已融合的一份征服者特性与两份外在原件，以及独立封存的唯一性。原件只会移动，原瓶与旧账不会补回。',
    preparation: '辅助药材与调配准备采用有限的本地方案；完整原书辅料未披露。大陆战争与晋升条件另行核验。',
    items: state.items.map(i => ({ id: i.id, title: i.kind === 'UNIQUENESS' ? '唯一性封存遗物' : i.id === integratedId(state) ? '本人已融合的征服者特性' : `第${RED_PRIEST_CHARACTERISTIC_IDS.indexOf(i.id) + 1}瓶对应原特性`,
      status: dispositionLabels[i.disposition], locationId: ['UNLOCATED', 'SEALED_RELIC', 'UNAVAILABLE'].includes(i.disposition) ? null : i.locationId,
      contaminated: i.contamination !== null && i.contamination > 0 })),
    compounds: state.compounds.map(c => ({ id: c.id, status: c.status === 'PREPARED' ? '已调配，尚未饮用' : '已耗尽', locationId: c.locationId })),
    spent: state.journal.reduce((sum, e) => ({ cash: sum.cash + e.cost.cash, actions: sum.actions + e.cost.actions,
      spirituality: sum.spirituality + e.cost.spirituality }), { ...ZERO }),
    risk: '调查与净化可能失败并留下损伤。服药结果由真实判定决定；死亡不可继续，失败也不保证原件可回收。',
  };
}
