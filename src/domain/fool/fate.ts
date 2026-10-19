import type { PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import {
  FATE_COMMISSIONS, FATE_CONTENT_VERSION, FATE_ORIGIN, FATE_PURSUIT_TABLE, FATE_RULES,
  type FateCommissionId, type FateProbeBranch,
} from './fate-content.js';

/** All seconds are absolute host-world seconds, never wall-clock/UI time. */
export type FatePlace = 'BERTH' | 'MAIN_CHANNEL' | 'SIDE_CHANNEL' | 'GATE' | 'WELL' | 'REFUGE' | 'DOCK';
export type FateCrewPlace = FatePlace | 'BOAT_DECK' | 'RIGGING';
export type FatePhase = 'DISCOVER' | 'PREPARE' | 'TRANSIT' | 'ACTIVE' | 'VERIFY' | 'CLOSED';
export type FateVerdict = 'VERIFIED_DEVIATION' | 'ORDINARY_SURVIVAL' | 'FAILED' | 'INCOMPLETE';
export interface FateCrewOriginal { id: string; bodyId: string; adult: true; willingToEvacuate: boolean; }
export interface FateInitial {
  version: typeof FATE_CONTENT_VERSION;
  runId: string;
  commissionId: FateCommissionId;
  instanceId: string;
  /** The host registry, not createFateState(), owns all original entity IDs. */
  originals: {
    boatId: string; crateId: string; ownerId: string; saddleId: string; wellId: string;
    sealId: string; cargoIds: readonly string[]; commercialRegisterReceipt: string;
    boatContinuityReceipt: string; crateContinuityReceipt: string;
  };
  actorId: string;
  crew: readonly [FateCrewOriginal, FateCrewOriginal];
  /** Earliest independently registered commercial availability, not a running deadline. */
  availableAt: number;
  binding: {
    id: string; createdAt: number; originReceipt: string; artifactId: typeof FATE_ORIGIN.artifactId;
    mechanism: typeof FATE_ORIGIN.mechanism; provenanceKind: typeof FATE_ORIGIN.provenanceKind;
    chainVersion: typeof FATE_ORIGIN.chainVersion; channelId: string;
    boatId: string; crateId: string; saddleId: string;
    clockRule: 'FIRST_REAL_DEPARTURE_PLUS_180_SECONDS'; lockedOutcome: 'ORIGINAL_STRUCTURE_BROKEN';
    contribution: 40; structuralFailureAt: 35;
    pursuitTable: typeof FATE_PURSUIT_TABLE;
  };
  /** Original relic traces and measured load, not a prophecy or witness claim. */
  preexistingTrace: { receipt: string; recordedAt: number; saddleId: string; measuredLoad: number; tetherId: string; };
  well: { capacity: number; integrity: 'SOUND'; occupants: readonly string[]; };
  /** Only a reference. This domain never reads, moves, awards or destroys uniqueness. */
  independentUniquenessCustodyReceipt: string;
}
export interface FateResources {
  actionPoints: number; spirituality: number; mental: number; pennies: number;
  /** Real, purchased, unspent inventory item IDs. Their prices are provenance, not another debit. */
  inspectionKits: readonly string[]; preparationKits: readonly string[];
}
export interface FateCost {
  actionPoints: number; spirituality: number; mental: number; pennies: number;
  consumedItemIds: string[];
}
export type FateKnowledgeCheck = PublicCheckResult;
export interface FateCheckReceipt {
  id: string; actorId: string; ability: 'S1_PHYSICAL_GRAFT'; skill: 'KNOWLEDGE';
  result: FateKnowledgeCheck; rngBeforeRef: string; rngAfterRef: string;
}
export type FateWorldFact =
  | { id: string; at: number; type: 'WELL_OCCUPANCY'; occupantIds: string[] }
  | { id: string; at: number; type: 'ENDPOINT_INVALIDATED'; endpoint: 'SOURCE' | 'WELL' }
  | { id: string; at: number; type: 'ORIGINAL_DAMAGE'; target: 'BOAT' | 'CRATE' | 'SEAL' | 'CARGO'; reason: string }
  | { id: string; at: number; type: 'BODY_INJURED' | 'BODY_DIED'; subjectId: string; injuryReceipt: string }
  | { id: string; at: number; type: 'SOURCE_CANCELLED' | 'BINDING_RELEASED'; causeReceipt: string };
/** Exact pre-command central health, authenticated with the whole receipt. No new health bank. */
export interface FateBodyHealth { actor: number; crew: Readonly<Record<string, number>>; }
export interface FateHostReceipt {
  /** Host-authoritative receipt; must be committed atomically with returned effects. */
  id: string; ledgerRevision: string; commandId: string; command: FateCommand; expectedRevision: number; now: number;
  actorId: string; actorAlive: boolean; actorConscious: boolean;
  bodyHealth: FateBodyHealth;
  resources: FateResources;
  otherComplexGraftActive: boolean;
  check?: FateCheckReceipt;
  /** Actual external occurrences only. Private future branches/seed never reach projection. */
  worldFacts: readonly FateWorldFact[];
}
export type FateCommand =
  | { id: string; type: 'INSPECT_CONSTRAINT'; branch: FateProbeBranch; kitId: string }
  | { id: string; type: 'PREPARE_ENDPOINTS'; kitId: string }
  | { id: string; type: 'TRANSIT'; route: 'MAIN' | 'SIDE' }
  | { id: string; type: 'RESCUE'; crewId: string }
  | { id: string; type: 'GRAFT' }
  | { id: string; type: 'WAIT'; seconds: number }
  | { id: string; type: 'ADVANCE_WORLD'; seconds: number }
  | { id: string; type: 'ARRIVE_AND_VERIFY' }
  | { id: string; type: 'WITHDRAW' }
  | { id: string; type: 'RETURN_TO_BERTH' }
  | { id: string; type: 'ANCHOR' };
export interface FateEvent {
  sequence: number; at: number; type: string;
  data: Record<string, unknown>;
}
export interface FateScene {
  now: number; departureAt: number | null; thirdBellAt: number | null; actorPlace: FatePlace; actorAlive: boolean;
  boatPlace: FatePlace; crateSlot: 'SADDLE' | 'AFT_HOLD';
  hullWear: number; shieldWear: number; shieldFitted: boolean;
  boatIntact: boolean; crateIntact: boolean; sealIntact: boolean; cargoIntact: boolean;
  /** Once true, remains true even if a later host repair restores usability. */
  everDamaged: boolean;
  crew: { id: string; bodyId: string; place: FateCrewPlace; alive: boolean; injuries: string[]; willingToEvacuate: boolean }[];
  actorInjuries: string[];
  route: 'MAIN' | 'SIDE' | null;
  sourceActivated: boolean; sourceCancelled: boolean; bindingReleased: boolean;
  bellOccurred: boolean; departed: boolean; anchored: boolean; handedOver: boolean; withdrawn: boolean;
  forceToWell: number; forceToOriginal: number;
}
export interface FateState {
  instance: { id: string; initial: FateInitial; initialDigest: string };
  constraint: null | { sealedAt: number; evidenceEventSequences: number[]; digest: string };
  phase: FatePhase;
  scene: FateScene;
  endpoints: {
    preparedAt: number | null; sourceLocated: boolean; wellLocated: boolean;
    distanceMetres: number; wellCapacity: number; wellOccupants: string[]; wellWear: number;
  };
  effect: null | {
    sourceId: string; originalTargetId: string; receiverId: string; actorId: string;
    castAt: number; expiresAt: number; remainingUses: 0 | 1; capacity: number;
    paymentEventSequence: number; checkReceiptId: string;
  };
  journal: FateEvent[];
}
export interface FateAuthority {
  /** Must come from the host's pinned world registry, never from the incoming save. */
  initial: FateInitial;
  /** Host singleton registry check; an already registered instance cannot be opened afresh. */
  instanceAlreadyRegistered: boolean;
  /** Pinned once by the host on this original case's first actual entry. */
  entryAt: number;
  /** Full host receipt bytes checked here, not just membership of a user-editable ID. */
  receiptIsAuthentic: (receipt: FateHostReceipt) => boolean;
}
export interface FateConsequence {
  subjectId: string; kind: 'STRUCTURAL_CRUSH_INJURY'; eventSequence: number;
  at: number; injuryReceipt: string; healthBefore: number; healthAfter: number; died: boolean;
}
export interface FateTransition {
  ok: boolean; state: FateState; blockedReason?: string; cost: FateCost; elapsedSeconds: number;
  consequences: FateConsequence[];
  /** Atomic host commit applies these locations to the existing entities. */
  positions: { actor: FatePlace; boat: FatePlace; crate: { boatId: string; slot: 'SADDLE' | 'AFT_HOLD' }; crew: { id: string; place: FateCrewPlace }[] };
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const canonical = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
};
/** Diagnostic checksum only. Security comes from trusted initial/receipt comparison. */
const digest = (v: unknown): string => {
  const s = canonical(v); let n = 2166136261;
  for (let i = 0; i < s.length; i += 1) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return `f208-${(n >>> 0).toString(16)}`;
};
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const finiteInt = (v: number): boolean => Number.isSafeInteger(v);
const emptyCost = (): FateCost => ({ actionPoints: 0, spirituality: 0, mental: 0, pennies: 0, consumedItemIds: [] });
const event = (s: FateState, at: number, type: string, data: Record<string, unknown> = {}): FateEvent => {
  const e = { sequence: s.journal.length, at, type, data }; s.journal.push(e); return e;
};
const initialErrors = (i: FateInitial): string[] => {
  const errors: string[] = [];
  const c = FATE_COMMISSIONS.find(x => x.id === i.commissionId);
  if (!c || i.version !== FATE_CONTENT_VERSION || !nonempty(i.runId)) return ['UNKNOWN_AUTHORED_COMMISSION'];
  const original = (id: string): string => `${i.runId}:${id}`;
  if (i.instanceId !== original(c.id)) errors.push('INSTANCE_ID_CHANGED');
  for (const [actual, expected] of [
    [i.originals.boatId, c.boat], [i.originals.crateId, c.crate], [i.originals.ownerId, c.owner],
    [i.originals.saddleId, c.saddle], [i.originals.wellId, c.well], [i.binding.id, c.binding],
  ] as const) if (actual !== original(expected)) errors.push('ORIGINAL_ID_CHANGED');
  if (i.binding.boatId !== i.originals.boatId || i.binding.crateId !== i.originals.crateId || i.binding.saddleId !== i.originals.saddleId) errors.push('BINDING_TARGET_MISMATCH');
  if (i.binding.artifactId !== FATE_ORIGIN.artifactId || i.binding.mechanism !== FATE_ORIGIN.mechanism || i.binding.provenanceKind !== FATE_ORIGIN.provenanceKind || i.binding.chainVersion !== FATE_ORIGIN.chainVersion || i.binding.lockedOutcome !== 'ORIGINAL_STRUCTURE_BROKEN') errors.push('NO_OBJECTIVE_FATE_ORIGIN');
  if (canonical(i.binding.pursuitTable) !== canonical(FATE_PURSUIT_TABLE)) errors.push('PURSUIT_TABLE_CHANGED');
  if (!finiteInt(i.availableAt) || !finiteInt(i.binding.createdAt) || i.binding.createdAt >= i.availableAt || i.binding.clockRule !== 'FIRST_REAL_DEPARTURE_PLUS_180_SECONDS') errors.push('BINDING_NOT_PREEXISTING_OR_DEADLINE_CHANGED');
  if (i.binding.contribution !== 40 || i.binding.structuralFailureAt !== 35) errors.push('UNAPPROVED_STRUCTURE_RULE');
  if (i.preexistingTrace.saddleId !== i.originals.saddleId || !finiteInt(i.preexistingTrace.recordedAt) || !Number.isFinite(i.preexistingTrace.measuredLoad) || i.preexistingTrace.recordedAt >= i.availableAt || i.preexistingTrace.recordedAt < i.binding.createdAt || !(i.preexistingTrace.measuredLoad > 0)) errors.push('NO_PREEXISTING_PHYSICAL_TRACE');
  const refs = [i.binding.originReceipt, i.binding.channelId, i.preexistingTrace.receipt, i.preexistingTrace.tetherId, i.originals.sealId, i.originals.commercialRegisterReceipt, i.originals.boatContinuityReceipt, i.originals.crateContinuityReceipt, i.actorId, i.independentUniquenessCustodyReceipt];
  if (refs.some(x => !nonempty(x)) || i.originals.cargoIds.length === 0 || i.originals.cargoIds.some(x => !nonempty(x))) errors.push('MISSING_ORIGINAL_PROVENANCE');
  const ids = [i.originals.boatId, i.originals.crateId, i.originals.ownerId, i.originals.saddleId, i.originals.wellId, i.originals.sealId, ...i.originals.cargoIds, i.actorId, ...i.crew.map(x => x.id), ...i.crew.map(x => x.bodyId)];
  if (new Set(ids).size !== ids.length) errors.push('DUPLICATED_ORIGINAL_ENTITY');
  if (i.crew.length !== 2 || i.crew.some(x => x.adult !== true || !nonempty(x.id) || !nonempty(x.bodyId))) errors.push('INVALID_ORIGINAL_CREW');
  if (!finiteInt(i.well.capacity) || i.well.capacity < 0 || i.well.integrity !== 'SOUND') errors.push('INVALID_WELL');
  return errors;
};
function buildFateState(initial: FateInitial, authority: FateAuthority): FateState {
  if (canonical(initial) !== canonical(authority.initial)) throw new Error('F208: UNTRUSTED_INITIAL');
  const errors = initialErrors(initial); if (errors.length) throw new Error(`F208: ${errors.join(',')}`);
  if (!finiteInt(authority.entryAt) || authority.entryAt < initial.availableAt) throw new Error('F208: INVALID_FIRST_ENTRY_TIME');
  const i = clone(initial);
  const s: FateState = {
    instance: { id: i.instanceId, initial: i, initialDigest: digest(i) }, constraint: null, phase: 'DISCOVER',
    scene: { now: authority.entryAt, departureAt: null, thirdBellAt: null, actorPlace: 'BERTH', actorAlive: true, boatPlace: 'BERTH', crateSlot: 'SADDLE', hullWear: 0, shieldWear: 0, shieldFitted: false, boatIntact: true, crateIntact: true, sealIntact: true, cargoIntact: true, everDamaged: false,
      crew: i.crew.map(x => ({ ...x, place: 'BOAT_DECK', alive: true, injuries: [] })), actorInjuries: [], route: null,
      sourceActivated: false, sourceCancelled: false, bindingReleased: false, bellOccurred: false, departed: false, anchored: false, handedOver: false, withdrawn: false, forceToWell: 0, forceToOriginal: 0 },
    endpoints: { preparedAt: null, sourceLocated: false, wellLocated: false, distanceMetres: 6, wellCapacity: i.well.capacity, wellOccupants: [...i.well.occupants], wellWear: 0 },
    effect: null, journal: [],
  };
  event(s, i.binding.createdAt, 'BINDING_CREATED', { binding: clone(i.binding), trace: clone(i.preexistingTrace), originals: clone(i.originals) });
  event(s, authority.entryAt, 'SCENE_OPENED', { instanceId: i.instanceId, originalCrew: clone(i.crew), uniquenessCustody: i.independentUniquenessCustodyReceipt });
  return s;
}
export function createFateState(initial: FateInitial, authority: FateAuthority): FateState {
  if (authority.instanceAlreadyRegistered) throw new Error('F208: ORIGINAL_INSTANCE_ALREADY_REGISTERED');
  return buildFateState(initial, authority);
}
export function isFateEffectLiveAt(effect: FateState['effect'], at: number): boolean {
  return effect !== null && effect.remainingUses === 1 && effect.castAt <= at && at < effect.expiresAt;
}
export function resolveFateLoad(contribution: number, availableCapacity: number, threshold: number): { transferred: number; residual: number; breaksStructure: boolean } {
  if (![contribution, availableCapacity, threshold].every(Number.isFinite) || contribution < 0 || availableCapacity < 0 || threshold <= 0) throw new Error('INVALID_LOAD');
  const transferred = Math.min(contribution, availableCapacity);
  const residual = contribution - transferred;
  return { transferred, residual, breaksStructure: residual >= threshold };
}
const allIntact = (s: FateState): boolean => s.scene.boatIntact && s.scene.crateIntact && s.scene.sealIntact && s.scene.cargoIntact && !s.scene.everDamaged;
const phase = (s: FateState): void => {
  s.phase = !s.scene.actorAlive || (s.scene.withdrawn && s.scene.bellOccurred) || (s.scene.handedOver && s.scene.bellOccurred) ? 'CLOSED'
    : s.scene.bellOccurred ? 'VERIFY' : s.scene.sourceActivated ? 'ACTIVE' : s.scene.departed ? 'TRANSIT' : s.constraint ? 'PREPARE' : 'DISCOVER';
};
const positions = (s: FateState): FateTransition['positions'] => ({ actor: s.scene.actorPlace, boat: s.scene.boatPlace, crate: { boatId: s.instance.initial.originals.boatId, slot: s.scene.crateSlot }, crew: s.scene.crew.map(x => ({ id: x.id, place: x.place })) });
const blocked = (s: FateState, reason: string): FateTransition => ({ ok: false, state: s, blockedReason: reason, cost: emptyCost(), elapsedSeconds: 0, consequences: [], positions: positions(s) });
const passedCheck = (check: FateCheckReceipt): boolean => check.result.tier === 'SUCCESS' || check.result.tier === 'GREAT_SUCCESS';
/** Delegate percentile verification to the existing standard; the host owns RNG. */
function validKnowledgeCheck(r: FateKnowledgeCheck): boolean {
  try {
    if (!r || r.ability !== 'knowledge' || r.difficulty !== 20) return false;
    return canonical(resolveNormalCheck({ ability: 'knowledge', baseAbility: r.baseAbility, difficulty: 20, modifiers: r.modifiers, roll: r.roll })) === canonical(r);
  } catch { return false; }
}
const requirementCost = (c: FateCommand, check?: FateCheckReceipt): FateCost => {
  const cost = emptyCost();
  if (c.type === 'INSPECT_CONSTRAINT' || c.type === 'PREPARE_ENDPOINTS') { cost.actionPoints = 1; cost.consumedItemIds = [c.kitId]; }
  if (c.type === 'GRAFT') { cost.actionPoints = 1; cost.spirituality = 8; cost.mental = check && !passedCheck(check) ? 4 : 2; }
  return cost;
};
const duration = (s: FateState, c: FateCommand): number => {
  switch (c.type) {
    case 'INSPECT_CONSTRAINT': return 20;
    case 'PREPARE_ENDPOINTS': return 30;
    case 'TRANSIT': return c.route === 'MAIN' ? 40 : 55;
    case 'RESCUE': return 20;
    case 'GRAFT': return 5;
    case 'WAIT':
    case 'ADVANCE_WORLD': return c.seconds;
    case 'ARRIVE_AND_VERIFY': return 25;
    case 'WITHDRAW': return Math.max(20, (s.scene.thirdBellAt ?? s.scene.now) - s.scene.now);
    case 'RETURN_TO_BERTH': return 20;
    case 'ANCHOR': return 5;
  }
};
function canPerform(s: FateState, c: FateCommand, h: FateHostReceipt, preview = false): string | null {
  if (!nonempty(c.id) || !nonempty(h.id) || !nonempty(h.ledgerRevision) || h.commandId !== c.id || canonical(h.command) !== canonical(c) || h.expectedRevision !== s.journal.length || h.now !== s.scene.now || h.actorId !== s.instance.initial.actorId) return 'HOST_CONTEXT_MISMATCH';
  if (s.journal.some(e => e.type === 'COMMAND' && (e.data.command as FateCommand).id === c.id)) return 'COMMAND_ALREADY_COMMITTED';
  if (s.journal.some(e => e.type === 'COMMAND' && (e.data.host as FateHostReceipt).id === h.id)) return 'HOST_RECEIPT_ALREADY_COMMITTED';
  if (c.type !== 'ADVANCE_WORLD') {
    if (!h.actorAlive || !s.scene.actorAlive) return 'PLAYER_DEAD';
    if (!h.actorConscious) return 'PLAYER_UNCONSCIOUS';
    if (s.phase === 'CLOSED') return 'CASE_CLOSED_ORIGINALS_PRESERVED';
  }
  const health = h.bodyHealth;
  if (!health || !finiteInt(health.actor) || health.actor < 0 || health.actor > 100 || !health.crew ||
    !s.instance.initial.crew.every(c => finiteInt(health.crew[c.id]!) && health.crew[c.id]! >= 0 && health.crew[c.id]! <= 100) ||
    h.actorAlive !== (health.actor > 0)) return 'AUTHENTIC_ORIGINAL_BODY_HEALTH_REQUIRED';
  const r = h.resources;
  if (![r.actionPoints, r.spirituality, r.mental, r.pennies].every(x => finiteInt(x) && x >= 0)) return 'INVALID_HOST_RESOURCES';
  const cost = requirementCost(c);
  const spentItems = s.journal.filter(e => e.type === 'COST_PAID').flatMap(e => (e.data.cost as FateCost).consumedItemIds);
  if (cost.consumedItemIds.some(id => spentItems.includes(id))) return 'MATERIAL_ALREADY_CONSUMED';
  if (r.actionPoints < cost.actionPoints || r.spirituality < cost.spirituality || (c.type === 'GRAFT' ? r.mental < 4 : r.mental < cost.mental)) return 'INSUFFICIENT_ACTION_OR_ABILITY_RESOURCES';
  if (c.type === 'INSPECT_CONSTRAINT') {
    if (s.constraint || s.scene.departed || s.scene.sourceActivated) return 'CONSTRAINT_MUST_BE_EXAMINED_BEFORE_INTERVENTION';
    if (!FATE_PURSUIT_TABLE.some(x => x.branch === c.branch)) return 'UNKNOWN_ORDINARY_BRANCH';
    if (!r.inspectionKits.includes(c.kitId)) return 'REAL_INSPECTION_KIT_REQUIRED';
    if (s.scene.actorPlace !== 'BERTH' || s.scene.boatPlace !== 'BERTH') return 'INSPECTION_REQUIRES_ORIGINAL_BERTH';
  }
  if (c.type === 'PREPARE_ENDPOINTS') {
    if (!s.constraint || s.scene.departed || s.scene.sourceActivated || s.scene.actorPlace !== 'BERTH') return 'EXAMINE_FIRST_AND_PREPARE_BEFORE_DEPARTURE';
    if (!r.preparationKits.includes(c.kitId)) return 'REAL_PREPARATION_KIT_REQUIRED';
    if (s.endpoints.wellOccupants.length || s.endpoints.wellCapacity < FATE_RULES.contribution) return 'WELL_NOT_CLEAR_OR_INSUFFICIENT_CAPACITY';
  }
  if (c.type === 'TRANSIT') {
    if (s.scene.departed || s.scene.actorPlace !== 'BERTH' || s.scene.boatPlace !== 'BERTH') return 'ALREADY_DEPARTED_OR_NOT_ABOARD';
    if (c.route !== 'MAIN' && c.route !== 'SIDE') return 'UNKNOWN_ROUTE';
  }
  if (c.type === 'ANCHOR' && (!s.scene.departed || s.scene.anchored || s.scene.actorPlace !== s.scene.boatPlace || s.scene.boatPlace === 'DOCK')) return 'ANCHOR_REQUIRES_REAL_ORIGINAL_BOAT_ACCESS';
  if (c.type === 'WITHDRAW' && s.scene.withdrawn && s.scene.actorPlace === 'REFUGE') return 'ALREADY_WITHDRAWN';
  if (c.type === 'RETURN_TO_BERTH' && (s.scene.departed || s.scene.actorPlace !== 'REFUGE' || !s.scene.withdrawn)) return 'ONLY_THE_SAME_UNDEPARTED_COMMISSION_CAN_BE_RESUMED';
  if (c.type === 'RESCUE') {
    const crew = s.scene.crew.find(x => x.id === c.crewId);
    if (!crew || !crew.alive) return 'NO_LIVING_ORIGINAL_CREW_TO_RESCUE';
    if (!crew.willingToEvacuate) return 'CREW_DOES_NOT_CONSENT_TO_EVACUATION';
    if (crew.place === 'REFUGE' || crew.place === 'DOCK') return 'CREW_ALREADY_SAFE';
    if (!['BERTH', 'GATE'].includes(s.scene.actorPlace) || s.scene.actorPlace !== s.scene.boatPlace) return 'RESCUE_REQUIRES_REAL_BOAT_ACCESS';
  }
  if (c.type === 'GRAFT') {
    if (!s.constraint || s.endpoints.preparedAt === null) return 'OBJECTIVE_CONSTRAINT_AND_BOTH_ENDPOINTS_REQUIRED';
    if (!s.scene.sourceActivated || s.scene.sourceCancelled || s.scene.bindingReleased || s.scene.bellOccurred) return 'SOURCE_NOT_CURRENTLY_ACTIVE_AND_UNSETTLED';
    if (s.scene.actorPlace !== 'GATE' || s.scene.boatPlace !== 'GATE') return 'PLAYER_AND_ORIGINAL_SOURCE_MUST_BE_AT_GATE';
    if (!s.endpoints.sourceLocated || !s.endpoints.wellLocated || s.endpoints.distanceMetres > 6 || s.endpoints.wellOccupants.length || s.endpoints.wellCapacity < 40) return 'ENDPOINTS_NOT_CURRENTLY_SAFE_AND_REACHABLE';
    if (s.effect && s.effect.remainingUses > 0 || h.otherComplexGraftActive) return 'AN_EXISTING_COMPLEX_GRAFT_MUST_END_FIRST';
    if (!preview) {
    const k = h.check;
    if (!k || k.actorId !== h.actorId || k.ability !== 'S1_PHYSICAL_GRAFT' || k.skill !== 'KNOWLEDGE' || !validKnowledgeCheck(k.result) || !nonempty(k.rngBeforeRef) || !nonempty(k.rngAfterRef) || k.rngBeforeRef === k.rngAfterRef || !nonempty(k.id)) return 'AUTHENTIC_KNOWLEDGE_CHECK_REQUIRED';
    if (s.journal.some(e => e.type === 'GRAFT_PAID_AND_CAST' && e.data.checkReceiptId === k.id)) return 'RNG_RECEIPT_ALREADY_CONSUMED';
    }
  }
  if (c.type === 'WAIT' && (!finiteInt(c.seconds) || c.seconds <= 0 || c.seconds > 3600)) return 'WAIT_MUST_ADVANCE_REAL_BOUNDED_TIME';
  if (c.type === 'ADVANCE_WORLD' && (!finiteInt(c.seconds) || c.seconds < 0 || (c.seconds === 0 && h.worldFacts.length === 0))) return 'HOST_WORLD_ADVANCE_REQUIRES_TIME_OR_ACTUAL_FACTS';
  if (c.type === 'ARRIVE_AND_VERIFY' && !s.scene.boatIntact) return 'DAMAGED_BOAT_REQUIRES_REAL_SALVAGE_NOT_FREE_TRANSPORT';
  if (c.type === 'ARRIVE_AND_VERIFY' && (!s.scene.bellOccurred || s.scene.boatPlace !== 'GATE' || s.scene.actorPlace !== 'GATE' || s.scene.withdrawn)) return 'BELL_MUST_RESOLVE_AND_PLAYER_MUST_ESCORT_ORIGINALS';
  return null;
}
function applyWorldFact(s: FateState, f: FateWorldFact): void {
  const e = event(s, f.at, 'WORLD_FACT', { fact: clone(f) });
  if (f.type === 'WELL_OCCUPANCY') s.endpoints.wellOccupants = [...f.occupantIds];
  if (f.type === 'ENDPOINT_INVALIDATED') { if (f.endpoint === 'SOURCE') s.endpoints.sourceLocated = false; else s.endpoints.wellLocated = false; }
  if (f.type === 'ORIGINAL_DAMAGE') {
    s.scene.everDamaged = true;
    if (f.target === 'BOAT') s.scene.boatIntact = false;
    if (f.target === 'CRATE') s.scene.crateIntact = false;
    if (f.target === 'SEAL') s.scene.sealIntact = false;
    if (f.target === 'CARGO') s.scene.cargoIntact = false;
  }
  if (f.type === 'BODY_INJURED' || f.type === 'BODY_DIED') {
    if (f.subjectId === s.instance.initial.actorId) {
      if (!s.scene.actorInjuries.includes(f.injuryReceipt)) s.scene.actorInjuries.push(f.injuryReceipt);
      if (f.type === 'BODY_DIED') { s.scene.actorAlive = false; s.effect = null; event(s, f.at, 'PLAYER_DEATH_RETAINED', { receipt: f.injuryReceipt, originalEvent: e.sequence }); }
    } else {
      const c = s.scene.crew.find(x => x.id === f.subjectId);
      if (!c) throw new Error('WORLD_FACT_UNKNOWN_BODY');
      if (!c.injuries.includes(f.injuryReceipt)) c.injuries.push(f.injuryReceipt); if (f.type === 'BODY_DIED') c.alive = false;
    }
  }
  if (f.type === 'SOURCE_CANCELLED') { s.scene.sourceCancelled = true; s.effect = null; }
  if (f.type === 'BINDING_RELEASED') { s.scene.bindingReleased = true; s.effect = null; }
}
function thirdBell(s: FateState, at: number, consequences: FateConsequence[], health: FateBodyHealth): void {
  const i = s.instance.initial;
  s.scene.bellOccurred = true;
  event(s, at, 'THIRD_BELL', { bindingId: i.binding.id, boatId: i.originals.boatId, crateId: i.originals.crateId, chainVersion: i.binding.chainVersion, departureAt: s.scene.departureAt, thirdBellAt: s.scene.thirdBellAt });
  if (s.scene.sourceCancelled || s.scene.bindingReleased || !s.scene.sourceActivated) {
    event(s, at, 'SOURCE_DID_NOT_DELIVER', { cancelled: s.scene.sourceCancelled, released: s.scene.bindingReleased }); return;
  }
  const legal = isFateEffectLiveAt(s.effect, at) && s.endpoints.sourceLocated && s.endpoints.wellLocated && s.endpoints.wellOccupants.length === 0 && s.scene.boatPlace === 'GATE' && s.endpoints.distanceMetres <= 6;
  const capacity = legal && s.effect ? Math.min(s.effect.capacity, s.endpoints.wellCapacity) : 0;
  const result = resolveFateLoad(i.binding.contribution, capacity, i.binding.structuralFailureAt);
  event(s, at, 'SOURCE_FORCE_EMITTED', { sourceId: i.originals.saddleId, contribution: 40, originalTargetId: i.originals.crateId });
  s.scene.forceToWell += result.transferred; s.scene.forceToOriginal += result.residual;
  if (result.transferred > 0) {
    s.endpoints.wellCapacity -= result.transferred; s.endpoints.wellWear += result.transferred;
    event(s, at, 'FORCE_DELIVERED_TO_WELL', { wellId: i.originals.wellId, contribution: result.transferred, wear: result.transferred, paymentEventSequence: s.effect?.paymentEventSequence });
  }
  if (s.effect) s.effect.remainingUses = 0;
  if (result.residual > 0) event(s, at, 'FORCE_DELIVERED_TO_ORIGINAL', { crateId: i.originals.crateId, contribution: result.residual });
  if (result.breaksStructure) {
    s.scene.boatIntact = false; s.scene.crateIntact = false; s.scene.sealIntact = false; s.scene.cargoIntact = false; s.scene.everDamaged = true;
    event(s, at, 'ORIGINAL_STRUCTURE_BROKEN', { boatId: i.originals.boatId, crateId: i.originals.crateId, cargoIds: [...i.originals.cargoIds], residual: result.residual, threshold: 35 });
    const exposed = s.scene.crew.filter(c => c.alive && (c.place === 'BOAT_DECK' || c.place === 'RIGGING')).map(c => c.id);
    if (s.scene.actorAlive && s.scene.actorPlace === s.scene.boatPlace && !['REFUGE', 'DOCK'].includes(s.scene.actorPlace)) exposed.push(i.actorId);
    for (const subjectId of exposed) {
      const injury = event(s, at, 'STRUCTURAL_CRUSH_INJURY', { subjectId, sourceId: i.originals.saddleId });
      const receipt = `${s.instance.id}:injury:${injury.sequence}`;
      if (subjectId === i.actorId) s.scene.actorInjuries.push(receipt); else s.scene.crew.find(c => c.id === subjectId)?.injuries.push(receipt);
      const healthBefore = subjectId === i.actorId ? health.actor : health.crew[subjectId]!;
      const healthAfter = Math.max(0, healthBefore - 35), died = healthAfter === 0;
      // Resolve this real body's death before any same-second rescue/cast/movement completion.
      if (died) {
        if (subjectId === i.actorId) { s.scene.actorAlive = false; s.effect = null; }
        else s.scene.crew.find(c => c.id === subjectId)!.alive = false;
      }
      event(s, at, died ? 'BODY_DIED' : 'BODY_INJURED', { subjectId, injuryReceipt: receipt, causeEventSequence: injury.sequence, healthBefore, healthAfter, damage: 35 });
      consequences.push({ subjectId, kind: 'STRUCTURAL_CRUSH_INJURY', eventSequence: injury.sequence, at, injuryReceipt: receipt, healthBefore, healthAfter, died });
    }
  }
}
interface ScheduledStep { at: number; order: number; apply: () => void; }
/** Physical/world facts, activation, expiry and bell precede action completion at equal time. */
function advance(s: FateState, end: number, facts: readonly FateWorldFact[], steps: ScheduledStep[], consequences: FateConsequence[], health: FateBodyHealth): void {
  const start = s.scene.now, i = s.instance.initial;
  const queue: ScheduledStep[] = [...steps];
  for (const fact of facts) queue.push({ at: fact.at, order: 0, apply: () => applyWorldFact(s, fact) });
  const bellAt = s.scene.thirdBellAt;
  const activeAt = bellAt === null ? null : bellAt - 30;
  if (activeAt !== null && !s.scene.sourceActivated && activeAt >= start && activeAt <= end) queue.push({ at: activeAt, order: 10, apply: () => {
    if (!s.scene.sourceCancelled && !s.scene.bindingReleased) { s.scene.sourceActivated = true; event(s, activeAt, 'SOURCE_ACTIVATED', { sourceId: i.originals.saddleId, originalTargetId: i.originals.crateId, contribution: 40 }); }
  } });
  if (s.effect && s.effect.remainingUses && s.effect.expiresAt >= start && s.effect.expiresAt <= end) {
    const expiresAt = s.effect.expiresAt;
    queue.push({ at: expiresAt, order: 20, apply: () => { if (s.effect && s.effect.remainingUses) { s.effect.remainingUses = 0; event(s, expiresAt, 'GRAFT_EXPIRED', { sourceId: s.effect.sourceId }); } } });
  }
  if (bellAt !== null && !s.scene.bellOccurred && bellAt >= start && bellAt <= end) queue.push({ at: bellAt, order: 30, apply: () => thirdBell(s, bellAt, consequences, health) });
  queue.sort((a, b) => a.at - b.at || a.order - b.order);
  for (const step of queue) { s.scene.now = step.at; step.apply(); }
  s.scene.now = end; phase(s);
}
function executeUnchecked(state: FateState, command: FateCommand, host: FateHostReceipt): FateTransition {
  const reason = canPerform(state, command, host); if (reason) return blocked(state, reason);
  const cost = requirementCost(command, host.check), elapsed = duration(state, command), start = state.scene.now, end = start + elapsed;
  if (!finiteInt(end)) return blocked(state, 'INVALID_END_TIME');
  const usedFacts = state.journal.filter(e => e.type === 'WORLD_FACT').map(e => (e.data.fact as FateWorldFact).id);
  if (host.worldFacts.some(f => !nonempty(f.id) || !finiteInt(f.at) || f.at < start || f.at > end || usedFacts.includes(f.id)) || new Set(host.worldFacts.map(f => f.id)).size !== host.worldFacts.length) return blocked(state, 'INVALID_OR_REUSED_WORLD_FACT');
  const s = clone(state), i = s.instance.initial, consequences: FateConsequence[] = [], steps: ScheduledStep[] = [];
  event(s, start, 'COMMAND', { command: clone(command), host: clone(host), expectedCost: clone(cost), duration: elapsed });
  const paid = event(s, start, 'COST_PAID', { receiptId: host.id, commandId: command.id, cost: clone(cost) });
  if (cost.mental > 0 && host.resources.mental - cost.mental <= 0) {
    s.scene.actorAlive = false; s.effect = null;
    event(s, start, 'PLAYER_DIED_FROM_PAID_MENTAL_COST', { actorId: i.actorId, paymentEventSequence: paid.sequence, mentalBefore: host.resources.mental, mentalAfter: 0 });
  }
  const schedule = (at: number, apply: () => void): void => { steps.push({ at, order: 40, apply }); };
  const move = (at: number, actor: FatePlace, boat?: FatePlace): void => {
    event(s, at, 'ACTUAL_MOVEMENT', { actorId: i.actorId, actorFrom: s.scene.actorPlace, actorTo: actor, ...(boat ? { boatId: i.originals.boatId, crateId: i.originals.crateId, boatFrom: s.scene.boatPlace, boatTo: boat } : {}) });
    s.scene.actorPlace = actor; if (boat) s.scene.boatPlace = boat;
  };
  if (command.type === 'INSPECT_CONSTRAINT') {
    const inspected = event(s, start, 'ORIGINALS_INSPECTED', { originals: clone(i.originals), originalCrew: clone(i.crew), originReceipt: i.binding.originReceipt, traceReceipt: i.preexistingTrace.receipt });
    if (command.branch === 'SHIELD_MAIN') { s.scene.shieldFitted = true; event(s, start, 'SHIELD_ACTUALLY_FITTED', { boatId: i.originals.boatId, materialId: command.kitId }); }
    if (command.branch === 'SIDE_CHANNEL') { move(start, 'SIDE_CHANNEL', 'SIDE_CHANNEL'); }
    if (command.branch === 'HOLD_OR_MOVE') { s.scene.crateSlot = 'AFT_HOLD'; event(s, start, 'ORIGINAL_CRATE_MOVED_INBOARD', { crateId: i.originals.crateId, from: 'SADDLE', to: 'AFT_HOLD', tetherId: i.preexistingTrace.tetherId }); }
    event(s, start, 'ORDINARY_PROBE_STARTED', { branch: command.branch, materialId: command.kitId, materialsConsumed: true });
    schedule(end, () => {
      if (!s.scene.actorAlive) return;
      if (command.branch === 'SIDE_CHANNEL') move(end, 'BERTH', 'BERTH');
      if (s.scene.sourceCancelled || s.scene.bindingReleased) { event(s, end, 'ORDINARY_PROBE_SOURCE_ALREADY_REMOVED'); return; }
      const pursued = event(s, end, 'ORDINARY_INTERVENTION_ACTUALLY_PURSUED', { branch: command.branch, bindingId: i.binding.id, originalTargetId: i.originals.crateId, sourceId: i.originals.saddleId, measuredLoadContinues: i.preexistingTrace.measuredLoad, materialWear: 1, implementation: FATE_PURSUIT_TABLE.find(x => x.branch === command.branch)?.implementation });
      if (s.scene.sourceActivated || s.scene.bellOccurred || s.scene.sourceCancelled || s.scene.bindingReleased) { event(s, end, 'CONSTRAINT_SEAL_TOO_LATE_OR_RELEASED'); return; }
      const evidence = [0, inspected.sequence, pursued.sequence];
      const sealed = event(s, end, 'CONSTRAINT_SEALED', { evidence, bindingDigest: digest(i.binding), noGraftResidual: 40, noGraftBreaksStructure: true });
      s.constraint = { sealedAt: end, evidenceEventSequences: [...evidence, sealed.sequence], digest: digest({ binding: i.binding, evidence }) };
    });
  }
  if (command.type === 'PREPARE_ENDPOINTS') {
    event(s, start, 'SOURCE_ENDPOINT_INSPECTED', { saddleId: i.originals.saddleId, materialId: command.kitId });
    schedule(start + 10, () => { if (s.scene.actorAlive) move(start + 10, 'WELL'); });
    schedule(start + 20, () => { if (s.scene.actorAlive) event(s, start + 20, 'WELL_PHYSICALLY_INSPECTED', { wellId: i.originals.wellId, occupants: [...s.endpoints.wellOccupants], capacity: s.endpoints.wellCapacity }); });
    schedule(end, () => {
      if (!s.scene.actorAlive) return; move(end, 'BERTH');
      if (s.endpoints.wellOccupants.length || s.endpoints.wellCapacity < 40 || s.scene.sourceActivated || s.scene.sourceCancelled || s.scene.bindingReleased) { event(s, end, 'ENDPOINT_PREPARATION_FAILED', { materialConsumed: command.kitId }); return; }
      s.endpoints.preparedAt = end; s.endpoints.sourceLocated = true; s.endpoints.wellLocated = true;
      event(s, end, 'ENDPOINTS_PREPARED', { sourceId: i.originals.saddleId, wellId: i.originals.wellId, distanceMetres: 6, clear: true, capacity: s.endpoints.wellCapacity, materialId: command.kitId });
    });
  }
  if (command.type === 'TRANSIT') {
    s.scene.departed = true; s.scene.route = command.route;
    s.scene.departureAt = start; s.scene.thirdBellAt = start + 180;
    event(s, start, 'DEPARTURE_CLOCK_FIXED', { bindingId: i.binding.id, boatId: i.originals.boatId, crateId: i.originals.crateId, departureAt: start, thirdBellAt: start + 180, clockRule: i.binding.clockRule });
    event(s, start, 'TRANSIT', { route: command.route, boatId: i.originals.boatId, crateId: i.originals.crateId });
    schedule(start + 10, () => {
      if (!s.scene.actorAlive) return;
      const routePlace = command.route === 'MAIN' ? 'MAIN_CHANNEL' : 'SIDE_CHANNEL'; move(start + 10, routePlace, routePlace);
      if (command.route === 'MAIN') {
        if (s.scene.shieldFitted) { s.scene.shieldWear += 1; event(s, start + 10, 'SHIELD_ABSORBED_ORDINARY_SPRAY', { actualWear: 1, hullWearPrevented: 1 }); }
        else { s.scene.hullWear += 1; event(s, start + 10, 'HULL_SURFACE_WEAR', { actualWear: 1, structuralIntegrityUnchanged: true }); }
      } else event(s, start + 10, 'SIDE_ROUTE_AVOIDED_ORDINARY_SPRAY', { extraTravelSeconds: 15 });
      const crew = s.scene.crew.find(c => c.alive && c.place === 'BOAT_DECK');
      if (crew) { crew.place = 'RIGGING'; event(s, start + 10, 'CREW_NEEDS_RESCUE', { crewId: crew.id, bodyId: crew.bodyId, cause: 'existing-loose-mooring-line' }); }
      if (!s.scene.sourceCancelled && !s.scene.bindingReleased) event(s, start + 10, 'BOUND_PURSUIT_CONTINUES', { sourceId: i.originals.saddleId, crateId: i.originals.crateId, route: command.route });
    });
    schedule(end, () => { if (s.scene.actorAlive) move(end, 'GATE', 'GATE'); });
  }
  if (command.type === 'RESCUE') {
    const returnPlace = s.scene.boatPlace;
    schedule(start + 10, () => {
      const crew = s.scene.crew.find(c => c.id === command.crewId);
      if (!s.scene.actorAlive || !crew?.alive) { event(s, start + 10, 'RESCUE_INTERRUPTED', { crewId: command.crewId }); return; }
      move(start + 10, 'REFUGE'); crew.place = 'REFUGE';
      event(s, start + 10, 'ORIGINAL_CREW_RESCUED', { crewId: crew.id, bodyId: crew.bodyId, destination: 'REFUGE', injuriesRetained: [...crew.injuries] });
    });
    schedule(end, () => { if (s.scene.actorAlive) move(end, returnPlace); });
  }
  if (command.type === 'GRAFT') {
    const check = host.check as FateCheckReceipt;
    event(s, start, 'GRAFT_PAID_AND_CAST', { sourceId: i.originals.saddleId, actorId: i.actorId, paymentEventSequence: paid.sequence, checkReceiptId: check.id, knowledgeDifficulty: 20, checkTier: check.result.tier, capacity: 45 });
    schedule(end, () => {
      const valid = s.scene.actorAlive && s.scene.sourceActivated && !s.scene.bellOccurred && !s.scene.sourceCancelled && !s.scene.bindingReleased && s.endpoints.sourceLocated && s.endpoints.wellLocated && s.endpoints.wellOccupants.length === 0 && s.scene.actorPlace === 'GATE' && s.scene.boatPlace === 'GATE';
      if (!passedCheck(check) || !valid) { event(s, end, 'GRAFT_FAILED', { checkReceiptId: check.id, reason: !passedCheck(check) ? 'KNOWLEDGE_CHECK_FAILED' : 'SOURCE_OR_ENDPOINT_CHANGED_DURING_CAST', paymentRetained: paid.sequence }); return; }
      s.effect = { sourceId: i.originals.saddleId, originalTargetId: i.originals.crateId, receiverId: i.originals.wellId, actorId: i.actorId, castAt: end, expiresAt: end + 30, remainingUses: 1, capacity: 45, paymentEventSequence: paid.sequence, checkReceiptId: check.id };
      event(s, end, 'GRAFT_CONNECTION_ESTABLISHED', { effect: clone(s.effect) });
    });
  }
  if (command.type === 'ARRIVE_AND_VERIFY') {
    schedule(end, () => {
      if (!s.scene.actorAlive) return;
      if (s.scene.anchored) { s.scene.anchored = false; event(s, end, 'ORIGINAL_ANCHOR_RAISED_FOR_FINAL_ESCORT', { boatId: i.originals.boatId }); }
      move(end, 'DOCK', 'DOCK');
      for (const crew of s.scene.crew) if (crew.alive && (crew.place === 'BOAT_DECK' || crew.place === 'RIGGING')) { event(s, end, 'ORIGINAL_CREW_HELPED_ASHORE', { crewId: crew.id, bodyId: crew.bodyId, from: crew.place, to: 'DOCK', assistanceIncludedInEscortSeconds: 25, injuriesRetained: [...crew.injuries] }); crew.place = 'DOCK'; }
      event(s, end, 'ORIGINAL_TARGET_INSPECTED', { boatId: i.originals.boatId, crateId: i.originals.crateId, sealId: i.originals.sealId, cargoIds: [...i.originals.cargoIds], allIntact: allIntact(s), everDamaged: s.scene.everDamaged });
      s.scene.handedOver = true;
      event(s, end, 'ORIGINALS_ARRIVED_AND_HANDED_OVER', { ownerId: i.originals.ownerId, boatId: i.originals.boatId, crateId: i.originals.crateId, allIntact: allIntact(s), injuriesRetained: true });
    });
  }
  if (command.type === 'ANCHOR') schedule(end, () => { if (s.scene.actorAlive) { s.scene.anchored = true; event(s, end, 'ORIGINAL_BOAT_ANCHORED', { boatId: i.originals.boatId, at: s.scene.boatPlace, crateId: i.originals.crateId, thirdBellAtUnchanged: s.scene.thirdBellAt, pursuitStillActive: !s.scene.sourceCancelled && !s.scene.bindingReleased }); } });
  if (command.type === 'RETURN_TO_BERTH') schedule(end, () => { if (s.scene.actorAlive) { move(end, 'BERTH'); s.scene.withdrawn = false; event(s, end, 'ORIGINAL_UNDEPARTED_COMMISSION_RESUMED', { boatId: i.originals.boatId, crateId: i.originals.crateId, costsRetained: true }); } });
  if (command.type === 'WITHDRAW') {
    if (s.effect) { event(s, start, 'GRAFT_ENDED_ON_WITHDRAWAL', { sourceId: s.effect.sourceId }); s.effect = null; }
    schedule(start + 20, () => {
      if (!s.scene.actorAlive) return; move(start + 20, 'REFUGE'); s.scene.withdrawn = true;
      for (const crew of s.scene.crew) if (crew.alive && crew.willingToEvacuate && crew.place !== 'REFUGE' && crew.place !== 'DOCK') { crew.place = 'REFUGE'; event(s, start + 20, 'ORIGINAL_CREW_EVACUATED', { crewId: crew.id, bodyId: crew.bodyId, injuriesRetained: [...crew.injuries] }); }
      event(s, start + 20, 'ORDINARY_WITHDRAWAL', { boatStayedAt: s.scene.boatPlace, crateId: i.originals.crateId, clockContinuesTo: end });
    });
  }
  advance(s, end, host.worldFacts, steps, consequences, host.bodyHealth);
  event(s, end, 'COMMAND_COMPLETED', { commandId: command.id, elapsedSeconds: elapsed });
  phase(s);
  return { ok: true, state: s, cost, elapsedSeconds: elapsed, consequences, positions: positions(s) };
}
/** Rebuild from trusted original provenance and authentic host receipts. Never trust cached phase/result. */
export function replayFate(initial: FateInitial, journal: readonly FateEvent[], authority: FateAuthority): FateState {
  let s = buildFateState(initial, authority);
  for (const e of journal) {
    if (e.type !== 'COMMAND') continue;
    const command = e.data.command as FateCommand, host = e.data.host as FateHostReceipt;
    if (!host || !authority.receiptIsAuthentic(host)) throw new Error('F208: UNAUTHENTIC_HOST_RECEIPT');
    const result = executeUnchecked(s, command, host);
    if (!result.ok) throw new Error(`F208: ILLEGAL_REPLAY_COMMAND:${result.blockedReason}`);
    s = result.state;
  }
  if (canonical(s.journal) !== canonical(journal)) throw new Error('F208: JOURNAL_NOT_CANONICAL_REPLAY');
  return s;
}
export function validateFate(state: FateState, authority: FateAuthority): { valid: boolean; errors: string[] } {
  try {
    if (state.instance.initialDigest !== digest(authority.initial) || canonical(state.instance.initial) !== canonical(authority.initial)) return { valid: false, errors: ['TRUSTED_ORIGINALS_OR_BINDING_CHANGED'] };
    const rebuilt = replayFate(state.instance.initial, state.journal, authority);
    if (canonical(rebuilt) !== canonical(state)) return { valid: false, errors: ['CACHE_OR_RECORD_CHANGED'] };
    return { valid: true, errors: [] };
  } catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'INVALID_FATE_STATE'] }; }
}
/** Check current permissions/resources without drawing or inspecting a future random result. */
export function blockFateCommand(state: FateState, command: FateCommand, host: Omit<FateHostReceipt, 'check'>, authority: FateAuthority): string | null {
  const valid = validateFate(state, authority);
  return valid.valid ? canPerform(state, command, host, true) : valid.errors.join(',');
}
export function applyFateCommand(state: FateState, command: FateCommand, host: FateHostReceipt, authority: FateAuthority): FateTransition {
  const valid = validateFate(state, authority); if (!valid.valid) return blocked(state, valid.errors.join(','));
  if (!authority.receiptIsAuthentic(host)) return blocked(state, 'UNAUTHENTIC_HOST_RECEIPT');
  return executeUnchecked(state, command, host);
}
/** Original-born case authority. Snapshots and effects are detached; only a
 * successful real reducer advances the private prefix. No saved state, supplied
 * prepared result, or verification flag can enter this constructor. */
export interface FateReplayCursor {
  snapshot(): FateState;
  fork(): FateReplayCursor;
  block(command: FateCommand, host: Omit<FateHostReceipt, 'check'>): string | null;
  advance(command: FateCommand, host: FateHostReceipt, authority: FateAuthority): FateTransition;
  project(host: Parameters<typeof projectFate>[1]): FatePublicView;
  evaluate(): FateEvaluation;
}
const ownedFateCases = new WeakMap<FateReplayCursor, () => FateState>();
export function createFateReplayCursor(initial: FateInitial, authority: FateAuthority): FateReplayCursor {
  stableStringify(initial);
  return ownFateReplayCursor(createFateState(clone(initial), authority), authority.entryAt);
}
function ownFateReplayCursor(initial: FateState, entryAt: number): FateReplayCursor {
  let state = initial;
  const cursor: FateReplayCursor = Object.freeze({
    snapshot: () => clone(state),
    fork: () => ownFateReplayCursor(clone(state), entryAt),
    block: (command: FateCommand, host: Omit<FateHostReceipt, 'check'>) => canPerform(state, command, host, true),
    advance: (command: FateCommand, host: FateHostReceipt, authority: FateAuthority): FateTransition => {
      const c = clone(command), h = clone(host);
      if (authority.entryAt !== entryAt || canonical(authority.initial) !== canonical(state.instance.initial)) return clone(blocked(state, 'TRUSTED_ORIGINALS_OR_BINDING_CHANGED'));
      if (!authority.receiptIsAuthentic(h)) return clone(blocked(state, 'UNAUTHENTIC_HOST_RECEIPT'));
      const next = executeUnchecked(state, c, h), result = clone(next);
      if (next.ok) state = next.state;
      return result;
    },
    project: (host: Parameters<typeof projectFate>[1]) => clone(projectVerifiedFate(state, host)),
    evaluate: () => clone(evaluateVerifiedFate(state)),
  });
  ownedFateCases.set(cursor, () => state);
  return cursor;
}
export interface FateEvaluation { verdict: FateVerdict; reasons: string[]; evidence: number[]; }
export function evaluateFate(state: FateState, authority: FateAuthority): FateEvaluation {
  const valid = validateFate(state, authority);
  if (!valid.valid) return { verdict: 'INCOMPLETE', reasons: valid.errors, evidence: [] };
  return evaluateVerifiedFate(state);
}
function evaluateVerifiedFate(state: FateState): FateEvaluation {
  const s = state, j = s.journal, evidence: number[] = [];
  if (s.scene.everDamaged || !s.scene.actorAlive || s.scene.withdrawn) return { verdict: 'FAILED', reasons: [!s.scene.actorAlive ? 'PLAYER_DIED_NO_REVIVAL' : s.scene.withdrawn ? 'ORDINARY_WITHDRAWAL_RECORDED' : 'ORIGINAL_DAMAGE_IS_PERMANENT'], evidence: j.filter(e => ['ORIGINAL_STRUCTURE_BROKEN', 'WORLD_FACT', 'ORDINARY_WITHDRAWAL', 'PLAYER_DEATH_RETAINED'].includes(e.type)).map(e => e.sequence) };
  if (!s.scene.bellOccurred || !s.scene.handedOver) return { verdict: 'INCOMPLETE', reasons: [!s.scene.bellOccurred ? 'THIRD_BELL_NOT_YET_OCCURRED' : 'SAME_ORIGINALS_NOT_YET_HANDED_OVER'], evidence: [] };
  const chain = ['BINDING_CREATED', 'ORIGINALS_INSPECTED', 'ORDINARY_INTERVENTION_ACTUALLY_PURSUED', 'CONSTRAINT_SEALED', 'ENDPOINTS_PREPARED', 'DEPARTURE_CLOCK_FIXED', 'TRANSIT', 'SOURCE_ACTIVATED', 'GRAFT_PAID_AND_CAST', 'THIRD_BELL', 'FORCE_DELIVERED_TO_WELL', 'ORIGINAL_TARGET_INSPECTED', 'ORIGINALS_ARRIVED_AND_HANDED_OVER'];
  let after = -1;
  for (const kind of chain) { const e = j.find(x => x.sequence > after && x.type === kind); if (!e) return { verdict: 'ORDINARY_SURVIVAL', reasons: [`MISSING_REAL_EVENT:${kind}`], evidence }; evidence.push(e.sequence); after = e.sequence; }
  if (s.scene.sourceCancelled || s.scene.bindingReleased || s.scene.forceToWell !== 40 || s.scene.forceToOriginal >= 35 || !allIntact(s)) return { verdict: 'ORDINARY_SURVIVAL', reasons: ['UNALTERED_BINDING_AND_ACTUAL_SAFE_DELIVERY_NOT_ESTABLISHED'], evidence };
  return { verdict: 'VERIFIED_DEVIATION', reasons: ['UNALTERED_BINDING', 'REAL_FORCE_DELIVERED_TO_EMPTY_WELL', 'SAME_ORIGINALS_INTACT_AND_HANDED_OVER'], evidence };
}

export interface FatePublicAction {
  type: Exclude<FateCommand['type'], 'ADVANCE_WORLD'>;
  label: string; recommended: boolean; enabled: boolean; blockedReason?: string;
  seconds: number; cost: FateCost; warning?: string; crewId?: string;
}
export interface FatePublicView {
  title: string; phase: FatePhase; now: number; secondsToBell: number | null;
  boat: { name: string; place: FatePlace; intact: boolean; hullWear: number; shieldWear: number };
  crate: { name: string; boatName: string; slot: 'SADDLE' | 'AFT_HOLD'; intact: boolean };
  actorPlace: FatePlace;
  crew: { name: string; place: FateCrewPlace; alive: boolean; injuries: number }[];
  explanation: string[];
  costsBeforeDeparture: { actions: number; spirituality: number; mental: number; failureMental: number; preparationPennies: number; inspectionPennies: number; note: string };
  actions: FatePublicAction[];
  evaluation?: { verdict: FateVerdict; reasons: string[] };
}
const publicBlock = (code: string): string => {
  const known: Record<string, string> = {
    INSUFFICIENT_ACTION_OR_ABILITY_RESOURCES: '施术需1次行动、8灵性和至少4精神；实际成功耗2、失败耗4精神。',
    REAL_INSPECTION_KIT_REQUIRED: '缺少已经购入的勘验耗材。', REAL_PREPARATION_KIT_REQUIRED: '缺少已经购入的定位耗材。',
    WELL_NOT_CLEAR_OR_INSUFFICIENT_CAPACITY: '井内尚有人或剩余承接容量不足。',
    ENDPOINTS_NOT_CURRENTLY_SAFE_AND_REACHABLE: '原端或井口定位失效、井内有人，或距离不合。',
    AN_EXISTING_COMPLEX_GRAFT_MUST_END_FIRST: '须先按原规则结束现有复杂嫁接。',
    OBJECTIVE_CONSTRAINT_AND_BOTH_ENDPOINTS_REQUIRED: '尚未查明真实约束并准备两端。',
    SOURCE_NOT_CURRENTLY_ACTIVE_AND_UNSETTLED: '致毁来源尚未激活，或已经结算、解除。',
    PLAYER_AND_ORIGINAL_SOURCE_MUST_BE_AT_GATE: '本人和原船须实际到达闸口。',
    PLAYER_DEAD: '本周目死亡已记录。', PLAYER_UNCONSCIOUS: '本人当前无法清醒行动。',
    CASE_CLOSED_ORIGINALS_PRESERVED: '此案已经终止，原物和旧损失仍然保留。',
  };
  return known[code] ?? '当前位置、原物状态或所需前置步骤不满足。';
};
/** Explicit allow-list projection. Never return initial, journal, die, RNG references or hidden branches. */
export function projectFate(state: FateState, host: Omit<FateHostReceipt, 'id' | 'ledgerRevision' | 'commandId' | 'command' | 'expectedRevision' | 'check' | 'worldFacts'>, authority: FateAuthority): FatePublicView {
  const valid = validateFate(state, authority);
  if (!valid.valid) throw new Error('F208: Refusing public projection of invalid save');
  return projectVerifiedFate(state, host);
}
function projectVerifiedFate(state: FateState, host: Parameters<typeof projectFate>[1]): FatePublicView {
  const s = state, title = FATE_COMMISSIONS.find(c => c.id === s.instance.initial.commissionId)?.label ?? '原船撤运';
  const result: FatePublicView = {
    title, phase: s.phase, now: s.scene.now, secondsToBell: s.scene.thirdBellAt === null ? null : Math.max(0, s.scene.thirdBellAt - s.scene.now),
    boat: { name: '登记原船', place: s.scene.boatPlace, intact: s.scene.boatIntact, hullWear: s.scene.hullWear, shieldWear: s.scene.shieldWear },
    crate: { name: '登记原箱', boatName: '登记原船', slot: s.scene.crateSlot, intact: s.scene.crateIntact && s.scene.sealIntact && s.scene.cargoIntact }, actorPlace: s.scene.actorPlace,
    crew: s.scene.crew.map((c, index) => ({ name: `船工${index + 1}`, place: c.place, alive: c.alive, injuries: c.injuries.length })),
    explanation: [], costsBeforeDeparture: { actions: 3, spirituality: 8, mental: 2, failureMental: 4, preparationPennies: 12, inspectionPennies: 4, note: '勘验与准备各消耗一份实物耗材及一次行动；嫁接另用一次行动、8灵性、成功2精神／失败4精神。已购物料不重复扣款；失败费用不退。精神仅4时施术失败会死亡。救人、等待、撤离不花行动。' }, actions: [],
  };
  if (s.scene.thirdBellAt === null) result.explanation.push('原绑定锁定首次真实开航后的第三钟；尚未开航，180秒窗口尚未开始。');
  if (s.constraint) result.explanation.push('已实查原船、原箱与遗留束缚；正常干预后，同一传导仍追索原箱。');
  else result.explanation.push('原箱出现受压迹象。尚未核实其来源，旁人的预言不能代替实查。');
  if (s.scene.sourceActivated && !s.scene.bellOccurred) result.explanation.push(`原承力端已实际激活。已确认载荷40，有限嫁接容量45；距井口6米。剩余${result.secondsToBell}秒。`);
  if (s.effect && s.effect.remainingUses === 1) result.explanation.push(`接线已经建立，尚未承接载荷；${Math.max(0, s.effect.expiresAt - s.scene.now)}秒后到期。`);
  if (s.scene.bellOccurred) result.explanation.push(`第三钟已响：空井承接${s.scene.forceToWell}，原结构实际承受${s.scene.forceToOriginal}。`);
  if (s.scene.everDamaged) result.explanation.push('原船箱已有真实损伤；修理或换箱都不能补成这一案的完整原物结果。');
  if (s.phase === 'CLOSED') {
    const evaluation = evaluateVerifiedFate(s);
    result.evaluation = { verdict: evaluation.verdict, reasons: evaluation.verdict === 'VERIFIED_DEVIATION' ? ['原绑定未改。', '致毁传导在空井留下真实撞击。', '同一原船、原箱和货物已完整交接。'] : ['此案的真实结果已保留；尚不能作为一次命运偏离的充分证明。'] };
    return result;
  }
  const add = (command: FateCommand, label: string, recommended: boolean, warning?: string): void => {
    const projectedHost: FateHostReceipt = { ...host, id: 'public-preview', ledgerRevision: 'public-preview', commandId: command.id, command, expectedRevision: s.journal.length, worldFacts: [] };
    const reason = canPerform(s, command, projectedHost, true);
    if (command.type === 'ADVANCE_WORLD') return;
    result.actions.push({ type: command.type, label, recommended, enabled: reason === null, ...(reason ? { blockedReason: publicBlock(reason) } : {}), seconds: duration(s, command), cost: requirementCost(command), ...(warning ? { warning } : {}), ...(command.type === 'RESCUE' ? { crewId: command.crewId } : {}) });
  };
  const actionId = `preview-${s.journal.length}`;
  const atBoat = s.scene.actorPlace === s.scene.boatPlace && ['BERTH', 'GATE'].includes(s.scene.actorPlace);
  const rescue = atBoat ? s.scene.crew.find(c => c.alive && c.willingToEvacuate && c.place !== 'REFUGE' && c.place !== 'DOCK') : undefined;
  if (s.scene.withdrawn && !s.scene.departed) add({ id: actionId, type: 'RETURN_TO_BERTH' }, '回到原船继续准备', true);
  else if (!s.constraint && !s.scene.departed && !s.scene.sourceActivated) add({ id: actionId, type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: host.resources.inspectionKits[0] ?? '' }, '查明约束', true);
  else if (s.endpoints.preparedAt === null && !s.scene.departed && !s.scene.sourceActivated) add({ id: actionId, type: 'PREPARE_ENDPOINTS', kitId: host.resources.preparationKits[0] ?? '' }, '准备两端', true);
  else if (!s.scene.departed) add({ id: actionId, type: 'TRANSIT', route: 'MAIN' }, '护送原箱', true);
  else if (s.scene.bellOccurred) add({ id: actionId, type: 'ARRIVE_AND_VERIFY' }, '护送抵岸并查验', true);
  else if (s.scene.sourceActivated && !s.effect) add({ id: actionId, type: 'GRAFT' }, '接入空井', true, (result.secondsToBell ?? 0) <= 5 ? '施术需5秒，已无法赶在第三钟前完成；费用仍会消耗。' : undefined);
  else if (rescue) add({ id: actionId, type: 'RESCUE', crewId: rescue.id }, '先救人', true);
  else add({ id: actionId, type: 'WAIT', seconds: Math.max(1, (s.scene.sourceActivated ? (s.scene.thirdBellAt ?? s.scene.now + 1) : (s.scene.thirdBellAt ?? s.scene.now + 31) - 30) - s.scene.now) }, '守住原物，等待传导', true);
  if (rescue && result.actions[0]?.type !== 'RESCUE') add({ id: `${actionId}-rescue`, type: 'RESCUE', crewId: rescue.id }, '先救人', false, result.secondsToBell !== null && result.secondsToBell <= 20 ? '救人需要20秒，可能错过接线窗口。' : undefined);
  if (result.actions.length < 3) add({ id: `${actionId}-withdraw`, type: 'WITHDRAW' }, '普通撤离', false, '离场不会暂停第三钟，也不会恢复原物和伤势。');
  return result;
}

/** Finite recovery registry. The host owns calendar, cash, inventory and saved case states. */
export interface FateRecoveryInitial { runId: string; registeredAt: number; commissions: readonly FateInitial[]; }
export interface FateRecoveryReceipt {
  id: string; type: 'INVESTIGATE' | 'VERIFY'; targetCommissionId: FateCommissionId;
  week: number; now: number; actorId: string; actorAlive: boolean; penniesAvailable: number;
  previousCaseId: string; previousCaseJournalDigest: string;
  /** Actual independent merchant/archive/physical checks, supplied by authenticated host. */
  checks?: { registerReceipt: string; boatContinuityReceipt: string; crateContinuityReceipt: string; originReceipt: string; originalsDigest: string; inspectedAt: number };
}
export interface FateRecoveryState { initial: FateRecoveryInitial; journal: FateRecoveryReceipt[]; }
export interface FateRecoveryAuthority {
  initial: FateRecoveryInitial;
  receiptIsAuthentic: (receipt: FateRecoveryReceipt) => boolean;
  /** All earlier cases remain in the campaign. They are never overwritten by a new case. */
  priorCases: readonly { state: FateState; authority: FateAuthority }[];
}
export function fateCaseJournalDigest(state: FateState): string { return digest(state.journal); }
export function fateOriginalsDigest(initial: FateInitial): string { return digest(initial.originals); }
export function createFateRecovery(initial: FateRecoveryInitial, authority: FateRecoveryAuthority): FateRecoveryState {
  if (canonical(initial) !== canonical(authority.initial) || initial.commissions.length !== 3 || !finiteInt(initial.registeredAt)) throw new Error('F208: UNTRUSTED_FINITE_RECOVERY_REGISTRY');
  const ids: string[] = [];
  for (const i of initial.commissions) {
    if (initialErrors(i).length || i.runId !== initial.runId || i.binding.createdAt >= initial.registeredAt || initial.registeredAt >= i.availableAt) throw new Error('F208: COMMISSION_NOT_PREEXISTING');
    ids.push(i.instanceId, i.originals.boatId, i.originals.crateId, i.originals.ownerId, i.binding.id, i.originals.saddleId, i.originals.wellId, i.originals.sealId, ...i.originals.cargoIds, ...i.crew.map(c => c.id), ...i.crew.map(c => c.bodyId));
  }
  if (new Set(initial.commissions.map(i => i.commissionId)).size !== 3 || new Set(ids).size !== ids.length) throw new Error('F208: RECOVERY_REUSES_ORIGINALS_OR_BINDING');
  return { initial: clone(initial), journal: [] };
}
export interface FateRecoveryTransition {
  ok: boolean; state: FateRecoveryState; penniesSpent: number; blockedReason?: string;
  /** Existing original manifest, never a minted replacement. Host advances it to now before play. */
  eligibleInitial?: FateInitial; eligibleEntryAt?: number;
}
function recoveryStep(state: FateRecoveryState, receipt: FateRecoveryReceipt, authority: FateRecoveryAuthority, replaying = false, ownedCases?: ReadonlyMap<string, FateState>): FateRecoveryTransition {
  const fail = (blockedReason: string): FateRecoveryTransition => ({ ok: false, state, penniesSpent: 0, blockedReason });
  if (!authority.receiptIsAuthentic(receipt)) return fail('UNAUTHENTIC_RECOVERY_RECEIPT');
  if (!receipt.actorAlive || !finiteInt(receipt.week) || !finiteInt(receipt.now) || !finiteInt(receipt.penniesAvailable) || receipt.penniesAvailable < 0) return fail('INVALID_LIVING_HOST_OR_CALENDAR');
  if (state.journal.some(r => r.id === receipt.id)) return fail('RECOVERY_RECEIPT_ALREADY_USED');
  const previous = authority.priorCases.find(p => p.state.instance.id === receipt.previousCaseId);
  const owned = ownedCases?.get(receipt.previousCaseId), previousState = owned ?? previous?.state;
  if (!previousState || (!owned && (!previous || !validateFate(previous.state, previous.authority).valid)) || fateCaseJournalDigest(previousState) !== receipt.previousCaseJournalDigest) return fail('PREVIOUS_REAL_CASE_AND_LOSSES_REQUIRED');
  const verdict = owned ? evaluateVerifiedFate(owned).verdict : evaluateFate(previous!.state, previous!.authority).verdict;
  if (verdict !== 'FAILED' && verdict !== 'ORDINARY_SURVIVAL') return fail('PREVIOUS_CASE_IS_NOT_A_SETTLED_FAILURE');
  if (!previousState.scene.actorAlive || receipt.actorId !== previousState.instance.initial.actorId) return fail('DEATH_CANNOT_CREATE_A_FREE_RETRY');
  if (!previousState.scene.bellOccurred || receipt.now < previousState.scene.now) return fail('OLD_CASE_HAS_NOT_SETTLED_IN_REAL_TIME');
  const target = state.initial.commissions.find(i => i.commissionId === receipt.targetCommissionId);
  if (!target || target.commissionId === 'F208-COMMISSION-1' || target.actorId !== receipt.actorId || (!replaying && (ownedCases ? ownedCases.has(target.instanceId) : authority.priorCases.some(p => p.state.instance.id === target.instanceId)))) return fail('NO_UNUSED_PREEXISTING_COMMISSION');
  if (state.journal.some(r => r.type === 'VERIFY' && r.targetCommissionId === target.commissionId)) return fail('COMMISSION_ALREADY_USED');
  const prior = state.journal.filter(r => r.targetCommissionId === target.commissionId);
  if (receipt.type === 'INVESTIGATE') {
    if (prior.length) return fail('INVESTIGATION_ALREADY_PAID_NO_REROLL');
    if (receipt.penniesAvailable < 18) return fail('PAID_INVESTIGATION_REQUIRES_18_PENNIES');
    return { ok: true, state: { initial: state.initial, journal: [...state.journal, clone(receipt)] }, penniesSpent: 18 };
  }
  const investigation = prior.find(r => r.type === 'INVESTIGATE');
  if (!investigation || receipt.week < investigation.week + 1 || receipt.now <= investigation.now) return fail('INDEPENDENT_VERIFICATION_REQUIRES_NEXT_WEEK');
  if (receipt.previousCaseId !== investigation.previousCaseId || receipt.previousCaseJournalDigest !== investigation.previousCaseJournalDigest) return fail('RECOVERY_PREVIOUS_CASE_CHANGED');
  const checks = receipt.checks;
  if (!checks || checks.registerReceipt !== target.originals.commercialRegisterReceipt || checks.boatContinuityReceipt !== target.originals.boatContinuityReceipt || checks.crateContinuityReceipt !== target.originals.crateContinuityReceipt || checks.originReceipt !== target.binding.originReceipt || checks.originalsDigest !== fateOriginalsDigest(target) || checks.inspectedAt !== receipt.now) return fail('ACTUAL_ORIGINALS_AND_INDEPENDENT_BINDING_NOT_VERIFIED');
  if (receipt.now < target.availableAt) return fail('REAL_DEPARTURE_WINDOW_NOT_OPEN');
  return { ok: true, state: { initial: state.initial, journal: [...state.journal, clone(receipt)] }, penniesSpent: 0, eligibleInitial: clone(target), eligibleEntryAt: receipt.now };
}
export function validateFateRecovery(state: FateRecoveryState, authority: FateRecoveryAuthority): { valid: boolean; errors: string[] } {
  try {
    let replayed = createFateRecovery(state.initial, authority);
    for (const receipt of state.journal) { const r = recoveryStep(replayed, receipt, authority, true); if (!r.ok) throw new Error(r.blockedReason); replayed = r.state; }
    if (canonical(replayed) !== canonical(state)) throw new Error('RECOVERY_STATE_CHANGED');
    return { valid: true, errors: [] };
  } catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'INVALID_RECOVERY_STATE'] }; }
}
export function applyFateRecovery(state: FateRecoveryState, receipt: FateRecoveryReceipt, authority: FateRecoveryAuthority): FateRecoveryTransition {
  const valid = validateFateRecovery(state, authority);
  if (!valid.valid) return { ok: false, state, penniesSpent: 0, blockedReason: valid.errors.join(',') };
  return recoveryStep(state, receipt, authority);
}

/** Finite recovery starts from its strict original registry and consumes only
 * genuine original-born case cursors. A lookalike cursor cannot prove a loss. */
export interface FateRecoveryReplayCursor {
  snapshot(): FateRecoveryState;
  fork(): FateRecoveryReplayCursor;
  advance(receipt: FateRecoveryReceipt, authority: Omit<FateRecoveryAuthority, 'priorCases'>, priorCases: readonly FateReplayCursor[]): FateRecoveryTransition;
}
export function createFateRecoveryReplayCursor(initial: FateRecoveryInitial, authority: FateRecoveryAuthority): FateRecoveryReplayCursor {
  stableStringify(initial);
  return ownFateRecoveryReplayCursor(createFateRecovery(clone(initial), authority));
}
function ownFateRecoveryReplayCursor(initial: FateRecoveryState): FateRecoveryReplayCursor {
  let state = initial;
  return Object.freeze({
    snapshot: () => clone(state),
    fork: () => ownFateRecoveryReplayCursor(clone(state)),
    advance: (receipt: FateRecoveryReceipt, authority: Omit<FateRecoveryAuthority, 'priorCases'>, priorCases: readonly FateReplayCursor[]): FateRecoveryTransition => {
      if (canonical(authority.initial) !== canonical(state.initial)) throw new Error('F208: UNTRUSTED_FINITE_RECOVERY_REGISTRY');
      const cases = new Map<string, FateState>();
      for (const cursor of priorCases) {
        const current = ownedFateCases.get(cursor)?.();
        if (!current || cases.has(current.instance.id) || !state.initial.commissions.some(original => canonical(original) === canonical(current.instance.initial))) throw new Error('F208: AUTHENTIC_ORIGINAL_CASE_CURSOR_REQUIRED');
        cases.set(current.instance.id, current);
      }
      const next = recoveryStep(state, clone(receipt), { ...authority, priorCases: [] }, false, cases), result = clone(next);
      if (next.ok) state = next.state;
      return result;
    },
  });
}
