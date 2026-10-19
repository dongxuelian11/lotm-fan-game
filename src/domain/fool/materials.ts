import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { AttendantMysteriesState, AttendantMysteriesAcquisitionEvent, AttendantMysteriesBatch } from '../attendant-mysteries/types.js';
import { validateAttendantMysteriesAcquisitionJournal } from '../attendant-mysteries/index.js';
import type { SliceState } from '../slice/types.js';

/** Private 208 candidate. Original numerical content, not novel rules.
 * This module owns ONLY the later disposition of three existing characteristics
 * and one uniqueness. Never add its quantities to the frozen S1 acquisition root.
 * The controller must atomically commit returned state/cost with its host journal,
 * close every old BUY/BREW/CONSUME/RESUPPLY inventory path after this bridge,
 * and supply independently verified origin, host, world and consumption receipts.
 * These are controller capabilities, NEVER deserialized from a player command.
 * No check, probability, ritual qualification, death protection or resurrection
 * is decided here. A DEAD outcome is terminal even if a residue can be located.
 */
export const FOOL_SOURCE_MATERIAL_IDS: readonly string[] = Object.freeze([1, 2, 3].map(n => `attendant-mysteries-batch-${n}:characteristic`));
export const FOOL_UNIQUENESS_ID = 'fool-uniqueness:legacy-1652';
export const FOOL_COMPOUND_SERVICE_ID = 'fool-compound-service';
export const FOOL_COMPOUND_INPUT_ROLES = Object.freeze(['CARRIER_FLUID', 'ISOLATION_MATERIAL', 'EMPTY_BOTTLE'] as const);
export interface FoolCompoundInput { id: string; role: typeof FOOL_COMPOUND_INPUT_ROLES[number] }
export const FOOL_SUCCESSION = Object.freeze({ eventId: 'fool-original-predecessor-fall-1652', year: 1652, uniquenessId: FOOL_UNIQUENESS_ID });
export interface FoolMaterialCost { cash: number; actions: number; spirituality: number }
const cost = (cash: number, actions: number, spirituality = 0): Readonly<FoolMaterialCost> => Object.freeze({ cash, actions, spirituality });
/** Fixed candidate content approved for implementation review, not client prices.
 * The uniqueness charges are archive inspection and secure transport services;
 * they are not a purchase price for the uniqueness or a grant of ownership.
 * Supplier work reduces only this new, separately priced main-material balance.
 * No old nine auxiliaries, bottle, expense or injury is refunded. Carrier fluid,
 * seal material and empty bottle are ordinary game-design disposables, NOT the
 * novel's supplementary requirement of controlling one quarter of history fog.
 * COMPOUND_SUPPLY is tied to a real supplier batch, dated handoff and 240 paid
 * in the atomic controller transaction. The controller starts with three ordinary
 * batches; any later purchase needs a distinct actual next-week supplier receipt.
 * This ledger never creates a supplier batch or independent extraordinary item.
 */
export const FOOL_MATERIAL_COSTS = Object.freeze({
  TRACE_REJECTION: cost(60, 1), EXTRACT_RESIDUE: cost(180, 1, 6), SEAL_RESIDUE: cost(120, 1, 4),
  SUPPLIER_WORK: cost(0, 1), SUPPLIER_HANDOFF: cost(900, 1), SUPPLIER_LABOUR_BALANCE: cost(90, 1),
  TRANSFER_INHERITED: cost(0, 1), INSPECT_UNIQUENESS: cost(80, 1), TAKE_UNIQUENESS: cost(120, 1),
  PREPARE_COMPOUND: cost(240, 1, 6),
});
export const FOOL_SUPPLIER_WORK = Object.freeze([
  '核对原遗产封签与取得账', '逐项整理原供应保管交接簿', '检查原特性外封完整性',
  '重整同一原物的防污染运输容器', '完成原保管人和接收人的交付复核',
] as const);
const ZERO: FoolMaterialCost = { cash: 0, actions: 0, spirituality: 0 };
const digest = (v: unknown): string => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: object, expected: readonly string[]): boolean => same(Object.keys(v).sort(), [...expected].sort());
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw Error(message); }
const win = (v: string | null): boolean => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const member = (id: string): boolean => FOOL_SOURCE_MATERIAL_IDS.includes(id) || id === FOOL_UNIQUENESS_ID;

export type FoolS1SourceSnapshot = Pick<AttendantMysteriesState,
  'guidanceKnown' | 'guidanceWeek' | 'sourceHistoryDigest' | 'batches' | 'bottles' | 'resupply' |
  'promotionWeek' | 'miracleWorkerActingAtPromotion' | 'preparation' | 'acquisitionJournal'>;
export function snapshotFoolS1Source(a: AttendantMysteriesState): FoolS1SourceSnapshot {
  return structuredClone({ guidanceKnown: a.guidanceKnown, guidanceWeek: a.guidanceWeek,
    sourceHistoryDigest: a.sourceHistoryDigest, batches: a.batches, bottles: a.bottles, resupply: a.resupply,
    promotionWeek: a.promotionWeek, miracleWorkerActingAtPromotion: a.miracleWorkerActingAtPromotion,
    preparation: a.preparation, acquisitionJournal: a.acquisitionJournal });
}
export const foolS1SnapshotDigest = (source: FoolS1SourceSnapshot): string => digest(source);
export interface FoolMaterialStamp { week: number; date: PublicGameDate; revision: number }
export interface FoolUniquenessCustodyRecord extends FoolMaterialStamp {
  id: string; sourceEventId: string; previousRecordId: string | null;
  uniquenessId: typeof FOOL_UNIQUENESS_ID; sealId: string; custodianId: string; locationId: string;
}
export interface FoolMaterialsOrigin {
  version: 1; actorId: string; checkpoint: FoolMaterialStamp;
  /** Full S1 acquisition snapshot, including all original events, costs and RNG.
   * sourceHistoryDigest alone only binds S9..S2 and MUST NOT be substituted. */
  sourceSnapshot: FoolS1SourceSnapshot; snapshotDigest: string;
  uniquenessCustody: FoolUniquenessCustodyRecord[];
}
export type FoolMaterialDisposition = 'INTEGRATED_PLAYER' | 'UNLOCATED_REJECTION' | 'RESIDUE_LOCATED' |
  'PLAYER_DIRTY' | 'PLAYER_HELD' | 'SUPPLIER' | 'LEGACY_HELD' | 'LEGACY_BOTTLED' |
  'SEALED_EXTERNAL' | 'COMMITTED' | 'UNAVAILABLE';
export interface FoolMaterialItem {
  id: string; kind: 'CHARACTERISTIC' | 'UNIQUENESS'; disposition: FoolMaterialDisposition;
  sourceBatchId: string | null; legacySourceId: string | null; sourceBottleId: string | null;
  sourceConsumption: { eventId: string; week: number; date: PublicGameDate; revision: number; outcome: string; regionId: string; locationId: string } | null;
  lastKnownLocationId: string | null; locationId: string | null; containerId: string | null;
  /** A location is not proof of a complete recoverable characteristic. */
  completeAndRecoverable: boolean; extractionWeek: number | null; treatmentWeek: number | null;
  supplierWork: { step: number; eventId: string; proofId: string }[];
  sealInspectedRecordId: string | null; lastProofId: string | null;
}
export interface FoolCompound {
  id: string; externalMaterialIds: string[]; integratedMaterialId: string; uniquenessId: string;
  originalContainerIds: { itemId: string; containerId: string | null }[];
  /** Ordinary ingredients are consumed on preparation; this one original empty
   * bottle becomes the compound and is permanently CONSUMED on either outcome. */
  supplyReceiptId: string; supplyBatchId: string; supplyProviderId: string; disposableInputs: FoolCompoundInput[];
  preparedWeek: number; preparedLocationId: string; locationId: string; status: 'PREPARED' | 'CONSUMED'; consumptionReceiptId: string | null;
}
export type FoolMaterialCommand =
  | { type: 'TRACE_REJECTION' | 'EXTRACT_RESIDUE' | 'SEAL_RESIDUE' | 'SUPPLIER_WORK' | 'SUPPLIER_HANDOFF' | 'TRANSFER_INHERITED'; itemId: string; proofId: string }
  | { type: 'INSPECT_UNIQUENESS' | 'TAKE_UNIQUENESS'; proofId: string }
  | { type: 'PREPARE_COMPOUND'; proofId: string };
export function validateFoolMaterialCommand(v: unknown): v is FoolMaterialCommand {
  if (!record(v)) return false;
  if (v.type === 'PREPARE_COMPOUND') return keys(v, ['type', 'proofId']) && text(v.proofId);
  if (v.type === 'INSPECT_UNIQUENESS' || v.type === 'TAKE_UNIQUENESS') return keys(v, ['type', 'proofId']) && text(v.proofId);
  return ['TRACE_REJECTION', 'EXTRACT_RESIDUE', 'SEAL_RESIDUE', 'SUPPLIER_WORK', 'SUPPLIER_HANDOFF', 'TRANSFER_INHERITED'].includes(String(v.type)) &&
    keys(v, ['type', 'itemId', 'proofId']) && text(v.itemId) && member(v.itemId) && text(v.proofId);
}
interface ProofBase extends FoolMaterialStamp {
  id: string; originDigest: string; actorId: string; itemId: string; locationId: string; sourceEventId: string;
}
export type FoolMaterialWorldReceipt =
  | ProofBase & { kind: 'TRACE'; result: 'LOCATED' | 'NOT_FOUND' | 'UNAVAILABLE'; foundAt: string | null; completeAndRecoverable: boolean }
  | ProofBase & { kind: 'EXTRACT'; result: 'EXTRACTED' | 'FAILED' | 'UNAVAILABLE'; containerId: string | null }
  | ProofBase & { kind: 'SEAL'; result: 'SEALED' | 'FAILED' | 'UNAVAILABLE'; containerId: string }
  | ProofBase & { kind: 'SUPPLIER_WORK'; step: number; task: string }
  | ProofBase & { kind: 'HANDOFF'; from: string; sourceContainerId: string | null; sealId: string | null }
  | ProofBase & { kind: 'UNIQUENESS_INSPECTION'; custodyDigest: string; sealId: string }
  | ProofBase & { kind: 'COMPOUND_SUPPLY'; providerId: string; batchId: string; chargedCash: 240; inputs: FoolCompoundInput[] };
export interface FoolMaterialHost extends FoolMaterialStamp {
  eventId: string; witnessId: string; actorId: string; status: 'ACTIVE' | 'DEAD'; sequence: 1 | 0;
  health: number; mind: number; locationId: string; resources: FoolMaterialCost;
  /** At most the one independently recorded receipt for this command. */
  proof: FoolMaterialWorldReceipt | null;
}
export interface FoolMaterialDestination {
  itemId: string; disposition: 'INTEGRATED_PLAYER' | 'RESIDUE_LOCATED' | 'UNLOCATED_REJECTION' | 'UNAVAILABLE';
  locationId: string | null; completeAndRecoverable: boolean;
}
/** Internal controller receipt, never a member of FoolMaterialCommand. The
 * verifier must look it up in the actual central consumption journal, including
 * its resolved ritual/check, actor consequences and original physical IDs. */
export interface FoolMaterialConsumptionReceipt extends FoolMaterialStamp {
  id: string; originDigest: string; actorId: string; compoundId: string; locationId: string;
  sourceMaterialIds: string[]; uniquenessId: string; outcome: 'SUCCESS' | 'FAILURE';
  actorAfter: { status: 'ACTIVE' | 'DEAD'; health: number; mind: number; sequence: 1 | 0 };
  destinations: FoolMaterialDestination[];
}
/** Internal physical travel receipt, independently derived from an already
 * replayed central FOG TRAVEL. The same bottle is carried by the original actor;
 * travel fees/time are charged by that central transaction, never a second time. */
export interface FoolMaterialTransportReceipt extends FoolMaterialStamp {
  id: string; originDigest: string; actorId: string; sourceEventId: string; compoundId: string;
  containedItemIds: string[]; fromLocationId: string; toLocationId: string;
  startSecond: number; endSecond: number;
  resourcesBefore: FoolMaterialCost; resourcesAfter: FoolMaterialCost;
}
export interface FoolMaterialAuthority {
  /** Verify original S1 acquisition replay and the approved independent 1652
   * custody chain against the authenticated host save, not merely this digest. */
  verifyOrigin(origin: Readonly<FoolMaterialsOrigin>): boolean;
  verifyHost(host: Readonly<FoolMaterialHost>): boolean;
  verifyWorldReceipt(proof: Readonly<FoolMaterialWorldReceipt>, host: Readonly<FoolMaterialHost>): boolean;
  verifyConsumption(receipt: Readonly<FoolMaterialConsumptionReceipt>, host: Readonly<FoolMaterialHost>): boolean;
  /** Omission denies transport; existing authorities do not gain this power. */
  verifyTransport?(receipt: Readonly<FoolMaterialTransportReceipt>, arrivalHost: Readonly<FoolMaterialHost>): boolean;
}
export interface FoolMaterialEvent {
  id: string; kind: 'COMMAND' | 'CONSUMPTION' | 'TRANSPORT'; command: FoolMaterialCommand | null;
  consumption: FoolMaterialConsumptionReceipt | null; host: FoolMaterialHost;
  transport?: FoolMaterialTransportReceipt;
  cost: FoolMaterialCost; resourcesAfter: FoolMaterialCost; beforeDigest: string; afterDigest: string;
  previousEventDigest: string; eventDigest: string;
}
export interface FoolMaterialsState {
  version: 1; origin: FoolMaterialsOrigin; originDigest: string; status: 'ACTIVE' | 'DEAD';
  items: FoolMaterialItem[]; compounds: FoolCompound[]; journal: FoolMaterialEvent[];
}
export interface FoolMaterialTransition { state: FoolMaterialsState; cost: FoolMaterialCost; event: FoolMaterialEvent; duplicate: boolean }
function validStamp(s: FoolMaterialStamp): boolean { return integer(s.week) && integer(s.revision) && isValidGameDate(s.date); }
function laterOrSame(a: FoolMaterialStamp, b: FoolMaterialStamp): boolean {
  return validStamp(a) && validStamp(b) && b.week >= a.week && b.revision >= a.revision && gameDaysBetween(a.date, b.date) === (b.week - a.week) * 7;
}
function consumptionSource(e: AttendantMysteriesAcquisitionEvent, bottleId: string): string { return `s1-acquisition:${e.revision}:CONSUME:${bottleId}`; }
function basicItem(id: string, kind: FoolMaterialItem['kind']): FoolMaterialItem {
  return { id, kind, disposition: 'UNAVAILABLE', sourceBatchId: null, legacySourceId: null, sourceBottleId: null,
    sourceConsumption: null, lastKnownLocationId: null, locationId: null, containerId: null,
    completeAndRecoverable: false, extractionWeek: null, treatmentWeek: null, supplierWork: [], sealInspectedRecordId: null, lastProofId: null };
}
/** Bind the full original host needed by the existing S1 replay validator.
 * Pass the archived S1 checkpoint, not a later mutable S0/player save. An
 * authority must call this (or the same existing validator plus exact binding)
 * before accepting origin; the separate lineage checks below are not a replay
 * substitute. Recovery records may repeat an identity, never mint another one. */
export function verifyFoolS1SourceReplay(origin: FoolMaterialsOrigin, source: SliceState): boolean {
  try {
    return source.status === 'ACTIVE' && source.progression.pathwayId === 'diviner' && source.progression.sequence === 1 &&
      same(origin.checkpoint, { week: source.week, date: source.date, revision: source.revision }) &&
      same(origin.sourceSnapshot, snapshotFoolS1Source(source.attendantMysteries)) &&
      origin.snapshotDigest === foolS1SnapshotDigest(origin.sourceSnapshot) && validateAttendantMysteriesAcquisitionJournal(source);
  } catch { return false; }
}
function readOriginalItems(origin: FoolMaterialsOrigin): FoolMaterialItem[] {
  const a = origin.sourceSnapshot;
  assert(a && keys(a, ['guidanceKnown', 'guidanceWeek', 'sourceHistoryDigest', 'batches', 'bottles', 'resupply', 'promotionWeek', 'miracleWorkerActingAtPromotion', 'preparation', 'acquisitionJournal']), 'S1_SNAPSHOT_SHAPE');
  assert(origin.snapshotDigest === foolS1SnapshotDigest(a), 'S1_SNAPSHOT_DIGEST_MISMATCH');
  assert(Array.isArray(a.batches) && a.batches.length >= 3 && a.batches.length <= 4096, 'UNSUPPORTED_S1_LINEAGE: three originals plus explicitly verified same-original recovery only');
  assert(a.guidanceKnown && integer(a.promotionWeek) && a.preparation === null && a.resupply.requestedWeek === null && a.resupply.recovery === undefined, 'S1_SOURCE_NOT_COMPLETED');
  assert(Array.isArray(a.bottles) && a.bottles.length <= a.batches.length && new Set(a.bottles.map(b => b.id)).size === a.bottles.length, 'S1_BOTTLE_DUPLICATE');
  assert(Array.isArray(a.acquisitionJournal) && a.acquisitionJournal.length > 0 && a.acquisitionJournal.length <= 4096, 'S1_SOURCE_JOURNAL');
  const guide = a.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  assert(guide && guide.date.year > FOOL_SUCCESSION.year, 'SUCCESSION_MUST_PRECEDE_ORIGINAL_DELIVERY');
  let previous: FoolMaterialStamp | null = null;
  for (const e of a.acquisitionJournal) {
    assert(validStamp(e) && laterOrSame(e, origin.checkpoint) && (!previous || laterOrSame(previous, e) && e.revision > previous.revision), 'S1_EVENT_TIME');
    previous = e;
  }
  const roots = FOOL_SOURCE_MATERIAL_IDS.map((id, index) => {
    const batchId = `attendant-mysteries-batch-${index + 1}`, b = a.batches.find(b => b.id === batchId);
    assert(b && b.recovery === undefined && b.materials.length === 10 && b.materials[0]?.id === id && integer(b.stockedWeek), 'S1_ORIGINAL_BATCH_MISSING');
    const m = b.materials[0]!;
    assert(m.name === '诡秘侍者非凡特性' && m.source.includes(`独立封存遗产AM1-LEGACY-${index + 1}，`), 'S1_SOURCE_SEAL_MISMATCH');
    return b;
  });
  assert(new Set(a.batches.map(b => b.id)).size === a.batches.length &&
    same(a.batches.map(b => b.id).sort(), Array.from({ length: a.batches.length }, (_, n) => `attendant-mysteries-batch-${n + 1}`).sort()), 'UNSUPPORTED_S1_LINEAGE: duplicate or noncanonical batch');
  const originalRows = new Map(roots.map(b => [b.materials[0]!.id, b.materials[0]!]));
  assert(a.batches.every(b => roots.includes(b) || b.recovery !== undefined), 'UNSUPPORTED_S1_LINEAGE: preserve and report any unmarked fourth original');
  const ordinaryIds = a.batches.flatMap(b => b.materials.slice(1).map(m => m.id));
  assert(ordinaryIds.length === a.batches.length * 9 && new Set(ordinaryIds).size === ordinaryIds.length && ordinaryIds.every(id => !FOOL_SOURCE_MATERIAL_IDS.includes(id)), 'S1_ORIGINAL_INPUT_IDENTITIES');
  const nodes = new Map<string, { batch: AttendantMysteriesBatch; item: FoolMaterialItem }>();
  const consumptionEvents = new Map<string, AttendantMysteriesAcquisitionEvent>();
  for (const b of a.batches) {
    const m = b.materials[0], root = m && originalRows.get(m.id);
    assert(m && root && (roots.includes(b) || b.recovery !== undefined), 'UNSUPPORTED_S1_LINEAGE: preserve and report any independent fourth original');
    assert(m.name === root.name && m.unit === root.unit && m.source === root.source && b.materials.length === 10 && integer(b.stockedWeek), 'S1_RECOVERY_ORIGINAL_IDENTITY');
    assert(same(b.materials.map(m => m.id).sort(), [m.id, ...Array.from({ length: 9 }, (_, i) => `${b.id}:spirit-specialty-${i + 1}`)].sort()), 'S1_ORIGINAL_INPUT_IDS');
    const sourceIndex = FOOL_SOURCE_MATERIAL_IDS.indexOf(m.id), item = basicItem(m.id, 'CHARACTERISTIC');
    item.sourceBatchId = roots[sourceIndex]!.id; item.legacySourceId = `AM1-LEGACY-${sourceIndex + 1}`;
    const bottles = a.bottles.filter(p => p.batchId === b.id); assert(bottles.length <= 1, 'S1_DUPLICATE_BOTTLE');
    const p = bottles[0];
    if (!p) {
      assert(b.brewedWeek === null && m.quantity === 1 && (m.holder === 'SUPPLIER' || m.holder === 'PLAYER'), 'S1_UNBREWED_CUSTODY');
      assert(b.recovery ? m.holder === 'PLAYER' : (m.holder === 'SUPPLIER') === (b.acquiredWeek === null), 'S1_UNBREWED_OWNERSHIP');
      assert(b.materials.slice(1).every(aux => aux.quantity === 1 && aux.holder === (b.acquiredWeek === null ? 'SUPPLIER' : 'PLAYER')), 'S1_UNBREWED_AUXILIARY_CUSTODY');
      item.disposition = m.holder === 'SUPPLIER' ? 'SUPPLIER' : 'LEGACY_HELD';
      item.lastKnownLocationId = m.holder === 'SUPPLIER' ? 'base' : b.recovery?.plot ?? null;
    } else {
      assert(p.id === `${b.id}:bottle` && p.inputIds[0] === m.id && p.brewedWeek === b.brewedWeek && same([...p.inputIds].sort(), b.materials.map(m => m.id).sort()) &&
        b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0), 'S1_BOTTLE_MATERIAL_CONSERVATION');
      item.sourceBottleId = p.id;
      const events = a.acquisitionJournal.filter(e => e.command.type === 'CONSUME' && e.command.bottleId === p.id);
      if (p.status === 'PREPARED') {
        assert(p.outcome === null && p.consumedWeek === null && p.regionId === null && events.length === 0, 'S1_PREPARED_BOTTLE_OUTCOME');
        item.disposition = 'LEGACY_BOTTLED'; item.containerId = p.id;
      } else {
        assert(p.status === 'CONSUMED' && events.length === 1, 'S1_CONSUMPTION_RECEIPT_MISSING');
        const e = events[0]!, t = e.townEvidence;
        assert(integer(p.consumedWeek) && p.consumedWeek === e.week && p.outcome === e.check?.tier &&
          ['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(p.outcome ?? '') && t && text(t.plot) && t.operatorAt === t.plot && t.region?.id === p.regionId, 'S1_CONSUMPTION_PLACE_TIME');
        assert(e.before.sequence === 2 && e.after.sequence === (win(p.outcome) ? 1 : 2), 'S1_CONSUMPTION_IDENTITY');
        item.sourceConsumption = { eventId: consumptionSource(e, p.id), week: e.week, date: structuredClone(e.date), revision: e.revision,
          outcome: p.outcome!, regionId: p.regionId!, locationId: t.plot };
        item.lastKnownLocationId = t.plot; item.disposition = win(p.outcome) ? 'INTEGRATED_PLAYER' : 'UNLOCATED_REJECTION';
        if (win(p.outcome)) assert(a.promotionWeek === e.week, 'S1_PROMOTION_WEEK');
        consumptionEvents.set(p.id, e);
      }
    }
    nodes.set(b.id, { batch: b, item });
  }
  assert(a.bottles.every(p => nodes.get(p.batchId)?.item.sourceBottleId === p.id), 'S1_FOREIGN_BOTTLE');
  assert(consumptionEvents.size === a.acquisitionJournal.filter(e => e.command.type === 'CONSUME').length, 'S1_UNBOUND_CONSUMPTION');
  const nextBatch = new Map<string, string>(), usedRequestRevisions = new Set<number>(), usedRecoveryRevisions = new Set<number>();
  for (const b of a.batches.filter(b => b.recovery !== undefined)) {
    const r = b.recovery!;
    assert(keys(r, ['version', 'sourceBottleId', 'characteristicId', 'regionId', 'plot', 'requestedWeek', 'recoveredWeek']) && r.version === 1 &&
      integer(r.requestedWeek) && integer(r.recoveredWeek) && r.recoveredWeek > r.requestedWeek && b.stockedWeek === r.recoveredWeek && r.characteristicId === b.materials[0]!.id, 'S1_RECOVERY_MAPPING');
    const sourceBottle = a.bottles.find(p => p.id === r.sourceBottleId), source = sourceBottle && nodes.get(sourceBottle.batchId), consumed = consumptionEvents.get(r.sourceBottleId);
    assert(source && source.item.id === r.characteristicId && source.item.disposition === 'UNLOCATED_REJECTION' && consumed &&
      consumed.week <= r.requestedWeek && source.item.sourceConsumption?.regionId === r.regionId && source.item.sourceConsumption.locationId === r.plot &&
      !nextBatch.has(source.batch.id), 'S1_RECOVERY_SOURCE_MUST_BE_LATEST_SINGLE_FAILED_ORIGINAL');
    const requests = a.acquisitionJournal.filter(e => e.command.type === 'REQUEST_RECOVERY_V1' && e.command.bottleId === r.sourceBottleId && e.week === r.requestedWeek);
    const recoveries = a.acquisitionJournal.filter(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1' && e.command.bottleId === r.sourceBottleId && e.week === r.recoveredWeek);
    assert(requests.length === 1 && recoveries.length === 1, 'S1_RECOVERY_REQUEST_AND_HANDOFF_REQUIRED');
    const request = requests[0]!, recovery = recoveries[0]!;
    assert(consumed.revision < request.revision && request.revision < recovery.revision && !usedRequestRevisions.has(request.revision) && !usedRecoveryRevisions.has(recovery.revision), 'S1_RECOVERY_EVENT_ORDER');
    const sameSite = (e: AttendantMysteriesAcquisitionEvent): boolean => !!e.townEvidence && [e.townEvidence.region, ...e.townEvidence.retiredRegions].some(region =>
      region?.id === r.regionId && region.plot === r.plot && region.epoch === consumed.townEvidence!.region!.epoch);
    assert(request.townEvidence?.operatorAt === 'base' && recovery.townEvidence?.operatorAt === r.plot && sameSite(request) && sameSite(recovery), 'S1_RECOVERY_REAL_ORIGINAL_SITE');
    assert(request.check === null && recovery.check === null && request.randomAfter === request.randomBefore && recovery.randomAfter === recovery.randomBefore &&
      same(request.after, { ...request.before, actions: request.before.actions - 1, cash: request.before.cash - 120 }) &&
      same(recovery.after, { ...recovery.before, actions: recovery.before.actions - 1 }), 'S1_RECOVERY_REAL_COSTS');
    assert(b.acquiredWeek === null || b.acquiredWeek >= r.recoveredWeek, 'S1_RECOVERY_PURCHASE_TIME');
    assert(b.brewedWeek === null || b.brewedWeek >= r.recoveredWeek, 'S1_RECOVERY_BREW_TIME');
    const firstBatchUse = a.acquisitionJournal.find(e => 'batchId' in e.command && e.command.batchId === b.id);
    assert(!firstBatchUse || firstBatchUse.revision > recovery.revision, 'S1_RECOVERY_BEFORE_BATCH_USE');
    nextBatch.set(source.batch.id, b.id); usedRequestRevisions.add(request.revision); usedRecoveryRevisions.add(recovery.revision);
  }
  assert(usedRecoveryRevisions.size === a.acquisitionJournal.filter(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1').length &&
    usedRequestRevisions.size === a.acquisitionJournal.filter(e => e.command.type === 'REQUEST_RECOVERY_V1').length, 'S1_UNBOUND_RECOVERY_EVENT');
  const visited = new Set<string>(), result = roots.map(root => {
    let node = nodes.get(root.id)!;
    for (;;) {
      assert(!visited.has(node.batch.id), 'S1_RECOVERY_CYCLE_OR_SHARED_LINEAGE'); visited.add(node.batch.id);
      const next = nextBatch.get(node.batch.id); if (!next) return node.item;
      assert(node.item.disposition === 'UNLOCATED_REJECTION', 'S1_DUPLICATE_LIVE_ORIGINAL'); node = nodes.get(next)!;
    }
  });
  assert(visited.size === a.batches.length, 'S1_DISCONNECTED_RECOVERY_LINEAGE');
  assert([...nodes.values()].filter(n => n.item.disposition === 'INTEGRATED_PLAYER').length === 1 && result.filter(i => i.disposition === 'INTEGRATED_PLAYER').length === 1, 'S1_REQUIRES_EXACTLY_ONE_INTEGRATED_ORIGINAL');
  return result;
}
function checkCustody(origin: FoolMaterialsOrigin): void {
  const chain = origin.uniquenessCustody;
  assert(Array.isArray(chain) && chain.length > 0 && chain.length <= 100 && new Set(chain.map(c => c.id)).size === chain.length, 'UNIQUENESS_CUSTODY_CHAIN');
  for (let n = 0; n < chain.length; n++) {
    const c = chain[n]!, previous = chain[n - 1];
    assert(!origin.sourceSnapshot.batches.some(b => b.materials.some(m => m.id === c.sealId)) &&
      !origin.sourceSnapshot.bottles.some(b => b.id === c.sealId) && c.sealId !== FOOL_UNIQUENESS_ID, 'UNIQUENESS_DISTINCT_ORIGINAL_SEAL');
    assert(validStamp(c) && laterOrSame(c, origin.checkpoint) && text(c.id) && text(c.custodianId) && text(c.locationId) && text(c.sealId) && c.uniquenessId === FOOL_UNIQUENESS_ID, 'UNIQUENESS_CUSTODY_FACT');
    assert(n === 0 ? c.previousRecordId === null && c.sourceEventId === FOOL_SUCCESSION.eventId && c.date.year === 1652 :
      c.previousRecordId === previous!.id && c.sourceEventId === previous!.id && laterOrSame(previous!, c) && c.sealId === previous!.sealId, 'UNIQUENESS_CUSTODY_PROVENANCE');
  }
}
export function createFoolMaterials(origin: FoolMaterialsOrigin, authority: FoolMaterialAuthority): FoolMaterialsState {
  assert(origin.version === 1 && text(origin.actorId) && validStamp(origin.checkpoint), 'MATERIAL_ORIGIN');
  assert(authority.verifyOrigin(origin), 'UNVERIFIED_MATERIAL_ORIGIN');
  const items = readOriginalItems(origin); checkCustody(origin);
  const c = origin.uniquenessCustody.at(-1)!, uniqueness = basicItem(FOOL_UNIQUENESS_ID, 'UNIQUENESS');
  uniqueness.disposition = 'SEALED_EXTERNAL'; uniqueness.locationId = c.locationId; uniqueness.lastKnownLocationId = c.locationId; uniqueness.containerId = c.sealId;
  items.push(uniqueness);
  return { version: 1, origin: structuredClone(origin), originDigest: digest(origin), status: 'ACTIVE', items, compounds: [], journal: [] };
}
function livePart(s: FoolMaterialsState): unknown { return { status: s.status, items: s.items, compounds: s.compounds }; }
function requireHost(s: FoolMaterialsState, h: FoolMaterialHost, authority: FoolMaterialAuthority): void {
  assert(authority.verifyHost(h), 'UNVERIFIED_HOST_WITNESS');
  assert(h.actorId === s.origin.actorId && text(h.eventId) && text(h.witnessId) && text(h.locationId) && validStamp(h), 'MATERIAL_HOST');
  assert(s.status === 'ACTIVE' && h.status === 'ACTIVE' && integer(h.health) && integer(h.mind) && h.health > 0 && h.mind > 0 && h.sequence === 1, 'LIVING_S1_REQUIRED');
  assert(keys(h.resources, ['cash', 'actions', 'spirituality']) && Object.values(h.resources).every(integer), 'MATERIAL_HOST_BUDGET');
  const previous = s.journal.at(-1)?.host ?? s.origin.checkpoint;
  assert(laterOrSame(previous, h) && h.revision > previous.revision, 'MATERIAL_EVENT_TIME');
  assert(s.journal.length < 4096, 'MATERIAL_JOURNAL_LIMIT');
}
function requireProof(s: FoolMaterialsState, h: FoolMaterialHost, id: string, itemId: string, authority: FoolMaterialAuthority): FoolMaterialWorldReceipt {
  const p = h.proof;
  assert(p && p.id === id && p.itemId === itemId && p.originDigest === s.originDigest && p.actorId === h.actorId && p.locationId === h.locationId &&
    validStamp(p) && p.week === h.week && same(p.date, h.date) && p.revision <= h.revision && text(p.sourceEventId), 'MATERIAL_PROOF_BINDING');
  assert(!s.journal.some(e => e.host.proof?.id === p.id || e.consumption?.id === p.id || e.transport?.id === p.id), 'MATERIAL_PROOF_ALREADY_SPENT');
  assert(authority.verifyWorldReceipt(p, h), 'UNVERIFIED_WORLD_RECEIPT');
  return p;
}
function requireCost(h: FoolMaterialHost, c: FoolMaterialCost): void {
  assert(h.resources.cash >= c.cash && h.resources.actions >= c.actions && h.resources.spirituality >= c.spirituality, 'MATERIAL_INSUFFICIENT_RESOURCES');
}
function append(s: FoolMaterialsState, before: FoolMaterialsState, h: FoolMaterialHost, command: FoolMaterialCommand | null,
  consumption: FoolMaterialConsumptionReceipt | null, paid: FoolMaterialCost, transport?: FoolMaterialTransportReceipt): FoolMaterialTransition {
  const event: FoolMaterialEvent = { id: h.eventId, kind: transport ? 'TRANSPORT' : command ? 'COMMAND' : 'CONSUMPTION', command: structuredClone(command), consumption: structuredClone(consumption),
    ...(transport ? { transport: structuredClone(transport) } : {}),
    host: structuredClone(h), cost: { ...paid }, resourcesAfter: { cash: h.resources.cash - paid.cash, actions: h.resources.actions - paid.actions, spirituality: h.resources.spirituality - paid.spirituality },
    beforeDigest: digest(livePart(before)), afterDigest: digest(livePart(s)), previousEventDigest: before.journal.at(-1)?.eventDigest ?? before.originDigest, eventDigest: '' };
  const { eventDigest: _, ...body } = event; event.eventDigest = digest(body); s.journal.push(event);
  return { state: s, cost: { ...paid }, event: structuredClone(event), duplicate: false };
}
function duplicate(s: FoolMaterialsState, id: string, command: FoolMaterialCommand | null, receipt: FoolMaterialConsumptionReceipt | null, transport?: FoolMaterialTransportReceipt): FoolMaterialTransition | null {
  const e = s.journal.find(e => e.id === id); if (!e) return null;
  assert(same(e.command, command) && same(e.consumption, receipt) && same(e.transport ?? null, transport ?? null), 'MATERIAL_EVENT_ID_CONFLICT');
  return { state: structuredClone(s), cost: { ...ZERO }, event: structuredClone(e), duplicate: true };
}
function reduceCommand(before: FoolMaterialsState, command: FoolMaterialCommand, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  assert(validateFoolMaterialCommand(command), 'INVALID_MATERIAL_COMMAND');
  const old = duplicate(before, host.eventId, command, null); if (old) return old;
  requireHost(before, host, authority);
  assert(!before.compounds.some(c => c.status === 'PREPARED'), 'ORIGINAL_COMPOUND_ALREADY_COMMITTED');
  const s = structuredClone(before);
  let paid: FoolMaterialCost;
  if (command.type === 'PREPARE_COMPOUND') {
    const p = requireProof(s, host, command.proofId, FOOL_COMPOUND_SERVICE_ID, authority);
    assert(p.kind === 'COMPOUND_SUPPLY' && text(p.providerId) && text(p.batchId) && p.chargedCash === FOOL_MATERIAL_COSTS.PREPARE_COMPOUND.cash && Array.isArray(p.inputs) && p.inputs.length === 3 &&
      same(p.inputs.map(i => i.role).sort(), [...FOOL_COMPOUND_INPUT_ROLES].sort()) && p.inputs.every(i => text(i.id) && keys(i, ['id', 'role'])) &&
      new Set(p.inputs.map(i => i.id)).size === 3, 'ACTUAL_COMPOUND_CONSUMABLE_SUPPLY_REQUIRED');
    const historicalIds = new Set([...s.origin.sourceSnapshot.batches.flatMap(b => b.materials.map(m => m.id)),
      ...s.origin.sourceSnapshot.bottles.map(b => b.id), ...s.items.map(i => i.id), ...s.items.flatMap(i => i.containerId ? [i.containerId] : []),
      ...s.compounds.flatMap(c => [...c.disposableInputs.map(i => i.id), ...c.originalContainerIds.flatMap(i => i.containerId ? [i.containerId] : [])])]);
    assert(p.inputs.every(i => !historicalIds.has(i.id)) && !s.compounds.some(c => c.supplyBatchId === p.batchId), 'ORDINARY_SUPPLY_ALREADY_SPENT_OR_ORIGINAL_INPUT');
    const integrated = s.items.filter(i => i.kind === 'CHARACTERISTIC' && i.disposition === 'INTEGRATED_PLAYER');
    const held = s.items.filter(i => i.kind === 'CHARACTERISTIC' && i.disposition === 'PLAYER_HELD');
    const unique = s.items.find(i => i.id === FOOL_UNIQUENESS_ID)!;
    assert(integrated.length === 1 && held.length === 2 && unique.disposition === 'PLAYER_HELD', 'NEED_TWO_EXTERNAL_ORIGINALS_AND_UNIQUENESS_IN_HAND');
    paid = { ...FOOL_MATERIAL_COSTS.PREPARE_COMPOUND }; requireCost(host, paid);
    const compound: FoolCompound = { id: p.inputs.find(i => i.role === 'EMPTY_BOTTLE')!.id, externalMaterialIds: held.map(i => i.id), integratedMaterialId: integrated[0]!.id,
      uniquenessId: unique.id, originalContainerIds: [...held, unique].map(i => ({ itemId: i.id, containerId: i.containerId })),
      supplyReceiptId: p.id, supplyBatchId: p.batchId, supplyProviderId: p.providerId, disposableInputs: structuredClone(p.inputs), preparedWeek: host.week,
      preparedLocationId: host.locationId, locationId: host.locationId, status: 'PREPARED', consumptionReceiptId: null };
    for (const item of [...held, unique]) { item.disposition = 'COMMITTED'; item.locationId = host.locationId; item.containerId = compound.id; item.completeAndRecoverable = false; }
    s.compounds.push(compound);
  } else {
    const itemId = 'itemId' in command ? command.itemId : FOOL_UNIQUENESS_ID;
    const item = s.items.find(i => i.id === itemId)!;
    assert(item, 'UNKNOWN_ORIGINAL_ITEM');
    const p = requireProof(s, host, command.proofId, itemId, authority);
    paid = { ...FOOL_MATERIAL_COSTS[command.type] };
    if (command.type === 'SUPPLIER_HANDOFF' && item.supplierWork.length === 5) paid = { ...FOOL_MATERIAL_COSTS.SUPPLIER_LABOUR_BALANCE };
    requireCost(host, paid);
    if (command.type === 'TRACE_REJECTION') {
      assert(item.disposition === 'UNLOCATED_REJECTION' && host.locationId === item.lastKnownLocationId && p.kind === 'TRACE', 'TRACE_ORIGINAL_LAST_SITE_REQUIRED');
      assert(p.sourceEventId === (item.lastProofId ?? item.sourceConsumption?.eventId), 'TRACE_SAME_ORIGINAL_REQUIRED');
      assert(['LOCATED', 'NOT_FOUND', 'UNAVAILABLE'].includes(p.result), 'TRACE_RESULT');
      if (p.result === 'LOCATED') { assert(text(p.foundAt) && typeof p.completeAndRecoverable === 'boolean', 'TRACE_LOCATION_REQUIRED'); item.disposition = 'RESIDUE_LOCATED'; item.locationId = p.foundAt; item.completeAndRecoverable = p.completeAndRecoverable; }
      else { assert(p.foundAt === null && p.completeAndRecoverable === false, 'TRACE_CANNOT_GRANT_MATERIAL'); if (p.result === 'UNAVAILABLE') item.disposition = 'UNAVAILABLE'; }
    } else if (command.type === 'EXTRACT_RESIDUE') {
      assert(item.disposition === 'RESIDUE_LOCATED' && item.completeAndRecoverable && host.locationId === item.locationId && p.kind === 'EXTRACT' && p.sourceEventId === item.lastProofId, 'EXTRACT_LOCATED_COMPLETE_ORIGINAL_REQUIRED');
      assert(['EXTRACTED', 'FAILED', 'UNAVAILABLE'].includes(p.result), 'EXTRACTION_RESULT');
      if (p.result === 'EXTRACTED') {
        const usedContainers = new Set([...s.origin.sourceSnapshot.bottles.map(b => b.id), ...s.items.map(i => i.id),
          ...s.items.filter(i => i.id !== item.id).flatMap(i => i.containerId ? [i.containerId] : []),
          ...s.compounds.flatMap(c => [...c.disposableInputs.map(i => i.id), ...c.originalContainerIds.flatMap(i => i.containerId ? [i.containerId] : [])])]);
        assert(text(p.containerId) && !usedContainers.has(p.containerId), 'ORIGINAL_RESIDUE_CONTAINER_REQUIRED'); item.disposition = 'PLAYER_DIRTY'; item.locationId = null; item.containerId = p.containerId; item.extractionWeek = host.week; item.treatmentWeek = host.week; }
      else { assert(p.containerId === null, 'FAILED_EXTRACTION_CANNOT_GRANT_CONTAINER'); if (p.result === 'UNAVAILABLE') { item.disposition = 'UNAVAILABLE'; item.completeAndRecoverable = false; } }
    } else if (command.type === 'SEAL_RESIDUE') {
      assert(item.disposition === 'PLAYER_DIRTY' && item.treatmentWeek !== null && host.week > item.treatmentWeek && p.kind === 'SEAL' && p.sourceEventId === item.lastProofId && p.containerId === item.containerId, 'SEAL_SAME_RESIDUE_NEXT_WEEK_REQUIRED');
      assert(['SEALED', 'FAILED', 'UNAVAILABLE'].includes(p.result), 'SEAL_RESULT'); item.treatmentWeek = host.week;
      if (p.result === 'SEALED') { item.disposition = 'PLAYER_HELD'; item.completeAndRecoverable = true; }
      else if (p.result === 'UNAVAILABLE') { item.disposition = 'UNAVAILABLE'; item.completeAndRecoverable = false; item.locationId = null; }
    } else if (command.type === 'SUPPLIER_WORK') {
      assert(item.kind === 'CHARACTERISTIC' && item.disposition === 'SUPPLIER' && host.locationId === 'base' && p.kind === 'SUPPLIER_WORK' && item.supplierWork.length < 5,
        'SUPPLIER_CUSTODY_WORK_REQUIRED');
      const step = item.supplierWork.length;
      assert(p.step === step && p.task === FOOL_SUPPLIER_WORK[step] && p.sourceEventId === item.legacySourceId, 'SUPPLIER_WORK_STEP_MISMATCH');
      item.supplierWork.push({ step, eventId: host.eventId, proofId: p.id });
    } else if (command.type === 'SUPPLIER_HANDOFF') {
      assert(item.kind === 'CHARACTERISTIC' && item.disposition === 'SUPPLIER' && host.locationId === 'base' && p.kind === 'HANDOFF' && p.from === 'ORIGINAL_SUPPLIER' && p.sourceEventId === item.legacySourceId && p.sourceContainerId === null && p.sealId === null, 'ORIGINAL_SUPPLIER_HANDOFF_REQUIRED');
      item.disposition = 'PLAYER_HELD'; item.locationId = null; item.completeAndRecoverable = true;
    } else if (command.type === 'TRANSFER_INHERITED') {
      assert((item.disposition === 'LEGACY_HELD' || item.disposition === 'LEGACY_BOTTLED') && p.kind === 'HANDOFF' && p.from === host.actorId && p.sourceEventId === item.legacySourceId && p.sourceContainerId === item.containerId && p.sealId === null, 'ORIGINAL_CARRIED_ITEM_TRANSFER_REQUIRED');
      item.disposition = 'PLAYER_HELD'; item.locationId = null; item.completeAndRecoverable = true;
    } else {
      const custody = s.origin.uniquenessCustody.at(-1)!;
      assert(item.disposition === 'SEALED_EXTERNAL' && host.locationId === custody.locationId && p.sourceEventId === custody.id, 'UNIQUENESS_ORIGINAL_CUSTODY_LOCATION_REQUIRED');
      if (command.type === 'INSPECT_UNIQUENESS') {
        assert(item.sealInspectedRecordId === null && p.kind === 'UNIQUENESS_INSPECTION' && p.custodyDigest === digest(s.origin.uniquenessCustody) && p.sealId === custody.sealId, 'UNIQUENESS_ORIGINAL_SEAL_AND_CHAIN_REQUIRED');
        item.sealInspectedRecordId = custody.id;
      } else {
        assert(item.sealInspectedRecordId === custody.id && p.kind === 'HANDOFF' && p.from === custody.custodianId && p.sealId === custody.sealId && p.sourceContainerId === custody.sealId, 'UNIQUENESS_ACTUAL_CUSTODIAN_HANDOFF_REQUIRED');
        item.disposition = 'PLAYER_HELD'; item.locationId = null; item.completeAndRecoverable = true;
      }
    }
    item.lastProofId = p.id;
  }
  return append(s, before, host, command, null, paid);
}
function reduceConsumption(before: FoolMaterialsState, receipt: FoolMaterialConsumptionReceipt, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  const old = duplicate(before, host.eventId, null, receipt); if (old) return old;
  requireHost(before, host, authority);
  assert(host.proof === null && authority.verifyConsumption(receipt, host), 'UNVERIFIED_CENTRAL_CONSUMPTION');
  assert(!before.journal.some(e => e.consumption?.id === receipt.id || e.host.proof?.id === receipt.id || e.transport?.id === receipt.id), 'CONSUMPTION_RECEIPT_ALREADY_SPENT');
  const s = structuredClone(before), compound = s.compounds.find(c => c.id === receipt.compoundId);
  assert(compound?.status === 'PREPARED' && host.locationId === compound.locationId, 'SAME_PREPARED_COMPOUND_REQUIRED');
  assert(text(receipt.id) && receipt.actorId === host.actorId && receipt.originDigest === s.originDigest && receipt.locationId === host.locationId &&
    validStamp(receipt) && receipt.week === host.week && receipt.revision === host.revision && same(receipt.date, host.date) && receipt.uniquenessId === FOOL_UNIQUENESS_ID &&
    same([...receipt.sourceMaterialIds].sort(), [...FOOL_SOURCE_MATERIAL_IDS].sort()), 'CENTRAL_CONSUMPTION_BINDING');
  assert(receipt.outcome === 'SUCCESS' || receipt.outcome === 'FAILURE', 'CENTRAL_CONSUMPTION_OUTCOME');
  assert(receipt.destinations.length === 4 && same(receipt.destinations.map(d => d.itemId).sort(), [...FOOL_SOURCE_MATERIAL_IDS, FOOL_UNIQUENESS_ID].sort()), 'ALL_ORIGINAL_DESTINATIONS_REQUIRED');
  const after = receipt.actorAfter;
  assert(integer(after.health) && integer(after.mind) && (after.status === 'ACTIVE' || after.status === 'DEAD') && (after.sequence === 0 || after.sequence === 1), 'CENTRAL_ACTOR_OUTCOME');
  assert(after.status !== 'ACTIVE' || after.health > 0 && after.mind > 0, 'CENTRAL_LIVING_OUTCOME');
  if (receipt.outcome === 'SUCCESS') assert(after.status === 'ACTIVE' && after.sequence === 0 && receipt.destinations.every(d => d.disposition === 'INTEGRATED_PLAYER'), 'CENTRAL_SUCCESS_INTEGRATION');
  else {
    assert(after.sequence === 1, 'CENTRAL_FAILURE_SEQUENCE');
    for (const d of receipt.destinations) {
      assert(after.status !== 'ACTIVE' || (d.itemId === compound.integratedMaterialId ? d.disposition === 'INTEGRATED_PLAYER' : d.disposition !== 'INTEGRATED_PLAYER'), 'FAILURE_CANNOT_GRANT_ADDITIONAL_INTEGRATION');
      assert(after.status !== 'DEAD' || d.disposition !== 'INTEGRATED_PLAYER', 'DEAD_BODY_DESTINATIONS_REQUIRED');
    }
  }
  for (const d of receipt.destinations) {
    assert(['INTEGRATED_PLAYER', 'RESIDUE_LOCATED', 'UNLOCATED_REJECTION', 'UNAVAILABLE'].includes(d.disposition) && typeof d.completeAndRecoverable === 'boolean', 'CENTRAL_ITEM_DESTINATION');
    assert(d.disposition === 'RESIDUE_LOCATED' ? text(d.locationId) : d.locationId === null && d.completeAndRecoverable === false, 'CENTRAL_PHYSICAL_LOCATION_REQUIRED');
    const item = s.items.find(i => i.id === d.itemId)!;
    item.disposition = d.disposition; item.locationId = d.locationId; item.lastKnownLocationId = host.locationId;
    item.completeAndRecoverable = d.completeAndRecoverable; item.containerId = null;
    item.extractionWeek = null; item.treatmentWeek = null; item.lastProofId = receipt.id;
  }
  compound.status = 'CONSUMED'; compound.consumptionReceiptId = receipt.id; s.status = after.status;
  return append(s, before, host, null, receipt, ZERO);
}
function reduceTransport(before: FoolMaterialsState, receipt: FoolMaterialTransportReceipt, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  const old = duplicate(before, host.eventId, null, null, receipt); if (old) return old;
  requireHost(before, host, authority);
  assert(host.proof === null && authority.verifyTransport?.(receipt, host) === true, 'UNVERIFIED_CENTRAL_TRANSPORT');
  assert(!before.journal.some(e => e.host.proof?.id === receipt.id || e.consumption?.id === receipt.id ||
    e.transport?.id === receipt.id || e.transport?.sourceEventId === receipt.sourceEventId), 'TRANSPORT_RECEIPT_ALREADY_SPENT');
  assert(text(receipt.id) && receipt.sourceEventId === host.eventId && receipt.actorId === host.actorId && receipt.originDigest === before.originDigest &&
    validStamp(receipt) && receipt.week === host.week && receipt.revision === host.revision && same(receipt.date, host.date) &&
    text(receipt.fromLocationId) && receipt.toLocationId === host.locationId && receipt.fromLocationId !== receipt.toLocationId &&
    integer(receipt.startSecond) && integer(receipt.endSecond) && receipt.endSecond > receipt.startSecond, 'CENTRAL_TRANSPORT_BINDING');
  for (const budget of [receipt.resourcesBefore, receipt.resourcesAfter]) assert(keys(budget, ['cash', 'actions', 'spirituality']) && Object.values(budget).every(integer), 'CENTRAL_TRANSPORT_BUDGET');
  assert(same(host.resources, receipt.resourcesAfter) && Object.keys(receipt.resourcesBefore).every(k =>
    receipt.resourcesAfter[k as keyof FoolMaterialCost] <= receipt.resourcesBefore[k as keyof FoolMaterialCost]), 'CENTRAL_TRANSPORT_ALREADY_PAID');
  const previous = before.journal.filter(e => e.kind === 'TRANSPORT').at(-1)?.transport;
  assert(!previous || receipt.startSecond >= previous.endSecond, 'CENTRAL_TRANSPORT_TIME_ORDER');
  const s = structuredClone(before), compound = s.compounds.find(c => c.id === receipt.compoundId);
  assert(compound?.status === 'PREPARED' && compound.locationId === receipt.fromLocationId, 'SAME_PREPARED_TRANSPORT_BOTTLE_REQUIRED');
  const ids = [...compound.externalMaterialIds, compound.uniquenessId];
  assert(Array.isArray(receipt.containedItemIds) && same([...receipt.containedItemIds].sort(), [...ids].sort()), 'SAME_ORIGINAL_BOTTLE_CONTENTS_REQUIRED');
  for (const id of ids) {
    const item = s.items.find(i => i.id === id);
    assert(item && item.disposition === 'COMMITTED' && item.containerId === compound.id && item.locationId === receipt.fromLocationId, 'SAME_COMMITTED_ORIGINALS_REQUIRED');
    item.locationId = receipt.toLocationId;
  }
  compound.locationId = receipt.toLocationId;
  return append(s, before, host, null, null, ZERO, receipt);
}
/** Sequential reconstruction owned by ONE synchronous central replay. This
 * accepts an original source, never a saved material state or an already-verified
 * flag. Every advance still runs the actual reducer and checks its freshly
 * derived host/proof/receipt authority. No state or receipt reference escapes.
 * Private owned sessions may retain it and fork for every isolated candidate.
 * Independent saved-state entry points below always replay the complete prefix.
 */
export interface FoolMaterialReplayCursor {
  snapshot(): FoolMaterialsState;
  fork(): FoolMaterialReplayCursor;
  command(command: FoolMaterialCommand, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition;
  consume(receipt: FoolMaterialConsumptionReceipt, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition;
  transport(receipt: FoolMaterialTransportReceipt, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition;
}
export function createFoolMaterialReplayCursor(origin: FoolMaterialsOrigin, authority: FoolMaterialAuthority): FoolMaterialReplayCursor {
  stableStringify(origin);
  return ownFoolMaterialReplayCursor(createFoolMaterials(structuredClone(origin), authority));
}
function ownFoolMaterialReplayCursor(initial: FoolMaterialsState): FoolMaterialReplayCursor {
  let state = initial;
  const advance = (next: FoolMaterialTransition): FoolMaterialTransition => {
    assert(!next.duplicate, 'MATERIAL_REPLAY_MISMATCH');
    // The next prefix remains private even when central state/frames keep the
    // returned copy. Failed reductions and repeated events never advance it.
    const result = structuredClone(next); state = next.state; return result;
  };
  return Object.freeze({
    snapshot: () => structuredClone(state),
    fork: () => ownFoolMaterialReplayCursor(structuredClone(state)),
    command: (command: FoolMaterialCommand, host: FoolMaterialHost, current: FoolMaterialAuthority) => advance(reduceCommand(state, command, host, current)),
    consume: (receipt: FoolMaterialConsumptionReceipt, host: FoolMaterialHost, current: FoolMaterialAuthority) => advance(reduceConsumption(state, receipt, host, current)),
    transport: (receipt: FoolMaterialTransportReceipt, host: FoolMaterialHost, current: FoolMaterialAuthority) => advance(reduceTransport(state, receipt, host, current)),
  });
}

export function replayFoolMaterials(origin: FoolMaterialsOrigin, events: readonly FoolMaterialEvent[], authority: FoolMaterialAuthority): FoolMaterialsState {
  assert(Array.isArray(events) && events.length <= 4096, 'MATERIAL_REPLAY_LIMIT');
  let state = createFoolMaterials(origin, authority);
  for (const event of events) {
    assert(event.id === event.host.eventId && (event.kind === 'COMMAND' ? event.command !== null && event.consumption === null && event.transport === undefined :
      event.kind === 'CONSUMPTION' ? event.command === null && event.consumption !== null && event.transport === undefined :
      event.kind === 'TRANSPORT' && event.command === null && event.consumption === null && event.transport !== undefined), 'MATERIAL_EVENT_SHAPE');
    const next = event.kind === 'COMMAND' ? reduceCommand(state, event.command!, event.host, authority) : event.kind === 'CONSUMPTION' ?
      reduceConsumption(state, event.consumption!, event.host, authority) : reduceTransport(state, event.transport!, event.host, authority);
    assert(!next.duplicate && same(next.event, event), 'MATERIAL_REPLAY_MISMATCH'); state = next.state;
  }
  return state;
}
export function validateFoolMaterials(state: FoolMaterialsState, authority: FoolMaterialAuthority): boolean {
  try { return same(state, replayFoolMaterials(state.origin, state.journal, authority)); } catch { return false; }
}
export function applyFoolMaterialCommand(state: FoolMaterialsState, command: FoolMaterialCommand, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  assert(validateFoolMaterials(state, authority), 'INVALID_MATERIAL_LEDGER');
  return reduceCommand(state, command, host, authority);
}
/** Internal API only. No exported public command accepts outcome or success. */
export function applyVerifiedFoolConsumption(state: FoolMaterialsState, receipt: FoolMaterialConsumptionReceipt, host: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  assert(validateFoolMaterials(state, authority), 'INVALID_MATERIAL_LEDGER');
  return reduceConsumption(state, receipt, host, authority);
}
/** Central travel hook only; not a public material command. Atomic with FOG
 * TRAVEL, including each real circuit leg. Returns zero additional charge. */
export function applyVerifiedFoolTransport(state: FoolMaterialsState, receipt: FoolMaterialTransportReceipt, arrivalHost: FoolMaterialHost, authority: FoolMaterialAuthority): FoolMaterialTransition {
  assert(validateFoolMaterials(state, authority), 'INVALID_MATERIAL_LEDGER');
  return reduceTransport(state, receipt, arrivalHost, authority);
}
export function projectFoolMaterials(state: FoolMaterialsState) {
  const names: Record<FoolMaterialDisposition, string> = { INTEGRATED_PLAYER: '已整合于本人', UNLOCATED_REJECTION: '原失败去向尚未查明', RESIDUE_LOCATED: '已定位污染残余',
    PLAYER_DIRTY: '已提取，尚待隔周付费清理封存', PLAYER_HELD: '本人实持，可投入原物', SUPPLIER: '原供应方保管', LEGACY_HELD: '原随身材料待核交',
    LEGACY_BOTTLED: '原未用瓶待同物转交', SEALED_EXTERNAL: '原封由保管人持有', COMMITTED: '同一原物已独占投入本瓶', UNAVAILABLE: '无法取得，保留原事实' };
  return { status: state.status, integratedCharacteristics: state.items.filter(i => i.kind === 'CHARACTERISTIC' && i.disposition === 'INTEGRATED_PLAYER').length,
    heldExternalCharacteristics: state.items.filter(i => i.kind === 'CHARACTERISTIC' && i.disposition === 'PLAYER_HELD').length,
    uniquenessHeld: state.items.some(i => i.kind === 'UNIQUENESS' && i.disposition === 'PLAYER_HELD'),
    items: state.items.map(i => ({ id: i.id, name: i.kind === 'UNIQUENESS' ? '愚者唯一性' : '原诡秘侍者特性', status: names[i.disposition],
      location: i.locationId, lastKnownLocation: i.lastKnownLocationId, recoverable: i.completeAndRecoverable,
      workCompleted: i.supplierWork.length, workRequired: i.disposition === 'SUPPLIER' ? 5 : 0 })),
    costs: structuredClone(FOOL_MATERIAL_COSTS), supplierWork: [...FOOL_SUPPLIER_WORK],
    notice: '只认这三份原特性和唯一的一件唯一性。失败后是否生还、残余是否可定位回收以实际结果为准；原瓶、普通耗材和已付费用不返还。唯一性相关费用仅为查封与运输服务。普通配制耗材不能代替四分之一历史迷雾与真实仪式。' };
}
