import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { createFoolSource, foolSourceView, validateFoolSource, type FoolBudget, type FoolSource } from './source.js';
import { foolCompoundSupply, foolUniquenessCustody, foolWorldDigest, FOOL_VAULT } from './world.js';
import { fogTravelMetres, type FogJourney, type FogJournalEntry } from './fog.js';
import {
  FOOL_COMPOUND_SERVICE_ID, FOOL_MATERIAL_COSTS, FOOL_SUPPLIER_WORK, FOOL_UNIQUENESS_ID,
  validateFoolMaterialCommand, verifyFoolS1SourceReplay,
  type FoolMaterialAuthority, type FoolMaterialCommand, type FoolMaterialConsumptionReceipt,
  type FoolMaterialHost, type FoolMaterialsState, type FoolMaterialWorldReceipt, type FoolMaterialTransportReceipt,
} from './materials.js';

/** Private adapter candidate, NOT RUN. It does not own a root game state,
 * perform a draw, charge money, create a material state, or decide ascension.
 *
 * CENTRAL REPLAY CONTRACT:
 * 1. Validate the archived S1 source with the existing source validators.
 * 2. Replay the full central journal from source.budget, including travel,
 *    money, injury/death, weekly time and every RNG-consuming operation.
 * 3. At each material action, build this frame from that independently replayed
 *    BEFORE state. Never deserialize a saved frame and call it verified.
 * 4. Give the root-resolved check and resulting cursor to this helper; it
 *    independently recomputes the expected standard check from the original seed.
 * 5. Derive the host/receipt, compare to the stored central event, then apply the
 *    material kernel with the resulting authority. Apply its returned cost ONCE.
 * 6. Retain the verified historical frames plus the current real before-frame
 *    when validating the material journal. Future frames are never authorized.
 *
 * No generic signature scheme or trusted=true switch is provided. The authority
 * compares complete independently derived values, not just supplied receipt IDs.
 */
interface FrameBase {
  eventId: string; witnessId: string; revision: number; locationId: string;
  before: FoolBudget; materialsBefore: FoolMaterialsState;
  randomBefore: number; randomAfter: number;
}
export interface FoolMaterialCommandReplayFrame extends FrameBase {
  kind: 'MATERIAL_COMMAND'; command: FoolMaterialCommand; check: PublicCheckResult | null;
}
export interface FoolMaterialConsumptionReplayFrame extends FrameBase {
  kind: 'CENTRAL_CONSUMPTION';
  /** Produced only by the root's independently replayed confirmed consumption,
   * including ritual eligibility, its check, all consequences and physical
   * destinations. This adapter cannot authorize a client-supplied outcome. */
  consumption: FoolMaterialConsumptionReceipt;
}
/** Built ONLY after the central reducer independently replays one FOG TRAVEL.
 * locationId is the actual arrival, before/after are the travel budgets. Copy
 * journey and fogTravel from that fresh FOG transition, not a saved client frame.
 * Include every real leg while a prepared bottle is carried, even on a circuit. */
export interface FoolMaterialTransportReplayFrame extends FrameBase {
  kind: 'CENTRAL_TRANSPORT'; after: FoolBudget; journey: FogJourney; fogTravel: FogJournalEntry;
}
export type FoolMaterialReplayFrame = FoolMaterialCommandReplayFrame | FoolMaterialConsumptionReplayFrame | FoolMaterialTransportReplayFrame;
const hash = (v: unknown): string => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
function assert(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(reason); }
const whole = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300;
const wins = (c: PublicCheckResult): boolean => c.tier === 'SUCCESS' || c.tier === 'GREAT_SUCCESS';
function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

/** Original game-balance checks approved for the three paid physical services.
 * Failure means the service did not complete; it does not destroy the original.
 * The central controller remains responsible for any real health/death effects. */
export function foolMaterialCheckSpec(command: FoolMaterialCommand): { ability: PublicCoreStatKey; difficulty: 20 } | null {
  if (command.type === 'TRACE_REJECTION') return { ability: 'perception', difficulty: 20 };
  if (command.type === 'EXTRACT_RESIDUE') return { ability: 'knowledge', difficulty: 20 };
  if (command.type === 'SEAL_RESIDUE') return { ability: 'will', difficulty: 20 };
  return null;
}
function verifyCommandCheck(source: FoolSource, frame: FoolMaterialCommandReplayFrame): PublicCheckResult | null {
  const spec = foolMaterialCheckSpec(frame.command);
  if (!spec) {
    assert(frame.check === null && frame.randomAfter === frame.randomBefore, 'MATERIAL_SERVICE_UNEXPECTED_RNG'); return null;
  }
  assert(frame.check !== null, 'MATERIAL_SERVICE_CHECK_REQUIRED');
  const rng = new DeterministicActionRandomStream(source.random.seed, frame.randomBefore);
  const expected = resolveNormalCheck({ ability: spec.ability, baseAbility: frame.before.coreStats[spec.ability], difficulty: spec.difficulty,
    modifiers: [], roll: rng.nextInt(1, 100) });
  assert(frame.randomAfter === rng.cursor && same(frame.check, expected), 'MATERIAL_SERVICE_CHECK_REPLAY_MISMATCH');
  return expected;
}
interface MaterialOriginIdentity { readonly canonical: string; readonly digest: string }
function materialOriginIdentity(source: FoolSource): MaterialOriginIdentity {
  const canonical = stableStringify(source.materialsOrigin);
  return { canonical, digest: sha256Hex(canonical) };
}
function requireFrame(source: FoolSource, frame: FoolMaterialReplayFrame, expectedOrigin?: MaterialOriginIdentity): void {
  const b = frame.before, origin = source.materialsOrigin;
  assert(nonempty(frame.eventId) && nonempty(frame.witnessId) && nonempty(frame.locationId) && whole(frame.revision) && frame.revision > source.revision, 'MATERIAL_FRAME_ID');
  assert(whole(b.week) && b.week >= origin.checkpoint.week && isValidGameDate(b.date) &&
    gameDaysBetween(origin.checkpoint.date, b.date) === (b.week - origin.checkpoint.week) * 7, 'MATERIAL_FRAME_ORIGINAL_CLOCK');
  assert(b.status === 'ACTIVE' && b.sequence === 1 && whole(b.health) && b.health > 0 && whole(b.mind) && b.mind > 0 &&
    whole(b.actions) && whole(b.cash) && whole(b.spirituality), 'MATERIAL_FRAME_REAL_LIVING_BUDGET');
  assert(whole(frame.randomBefore) && whole(frame.randomAfter) && frame.randomBefore >= source.random.cursor && frame.randomAfter >= frame.randomBefore, 'MATERIAL_FRAME_RNG_CURSOR');
  const expected = expectedOrigin ?? materialOriginIdentity(source);
  // Only the immutable expected side is reused. The caller's candidate origin
  // is serialized afresh on EVERY check, even if its object identity repeats.
  assert(frame.materialsBefore.originDigest === expected.digest &&
    stableStringify(frame.materialsBefore.origin) === expected.canonical, 'MATERIAL_FRAME_SAME_SOURCE');
  const previous = frame.materialsBefore.journal.at(-1);
  assert(!previous || previous.host.revision < frame.revision && previous.host.week <= b.week, 'MATERIAL_FRAME_PRIOR_MATERIAL_PREFIX');
}
/** Derivation is pure. In particular, a failed check still leads to a material
 * kernel transaction with its normal fixed cost; this helper charges nothing. */
export function deriveFoolMaterialHost(source: FoolSource, frame: FoolMaterialReplayFrame): FoolMaterialHost {
  // Public derivation always reconstructs the expected identity from this call.
  return deriveMaterialHost(source, frame);
}
function deriveMaterialHost(source: FoolSource, frame: FoolMaterialReplayFrame, expectedOrigin?: MaterialOriginIdentity): FoolMaterialHost {
  requireFrame(source, frame, expectedOrigin);
  if (frame.kind === 'CENTRAL_TRANSPORT') deriveMaterialTransportReceipt(source, frame, expectedOrigin);
  const b = frame.kind === 'CENTRAL_TRANSPORT' ? frame.after : frame.before;
  const host: FoolMaterialHost = { eventId: frame.eventId, witnessId: frame.witnessId, actorId: source.actorId,
    week: b.week, date: structuredClone(b.date), revision: frame.revision, status: 'ACTIVE', sequence: 1,
    health: b.health, mind: b.mind, locationId: frame.locationId,
    resources: { cash: b.cash, actions: b.actions, spirituality: b.spirituality }, proof: null };
  if (frame.kind === 'CENTRAL_TRANSPORT') return host;
  if (frame.kind === 'CENTRAL_CONSUMPTION') {
    const r = frame.consumption;
    assert(r.actorId === source.actorId && r.originDigest === frame.materialsBefore.originDigest && r.revision === frame.revision &&
      r.week === b.week && same(r.date, b.date) && r.locationId === frame.locationId, 'MATERIAL_CENTRAL_RECEIPT_FRAME_BINDING');
    return host;
  }
  const command = frame.command, state = frame.materialsBefore;
  assert(validateFoolMaterialCommand(command), 'MATERIAL_FRAME_COMMAND');
  const check = verifyCommandCheck(source, frame);
  const itemId = 'itemId' in command ? command.itemId : command.type === 'PREPARE_COMPOUND' ? FOOL_COMPOUND_SERVICE_ID : FOOL_UNIQUENESS_ID;
  const item = state.items.find(i => i.id === itemId);
  const base = { id: command.proofId, originDigest: state.originDigest, actorId: source.actorId, itemId,
    week: b.week, date: structuredClone(b.date), revision: frame.revision, locationId: frame.locationId };
  let proof: FoolMaterialWorldReceipt;
  if (command.type === 'PREPARE_COMPOUND') {
    // Three initial ordinary batches, then world-authored later-week deliveries.
    // No bottle/material ID is generated by the player's command or a die.
    const supply = foolCompoundSupply(state.compounds.length + 1, source.materialsOrigin.checkpoint.week);
    assert(frame.locationId === FOOL_VAULT.location && b.week >= supply.availableWeek, 'MATERIAL_REAL_WORKSHOP_BATCH_NOT_AVAILABLE');
    proof = { ...base, kind: 'COMPOUND_SUPPLY', sourceEventId: supply.id, providerId: supply.providerId,
      batchId: supply.id, chargedCash: FOOL_MATERIAL_COSTS.PREPARE_COMPOUND.cash as 240, inputs: structuredClone(supply.inputs) };
  } else if (command.type === 'INSPECT_UNIQUENESS' || command.type === 'TAKE_UNIQUENESS') {
    const chain = foolUniquenessCustody(source.materialsOrigin.checkpoint), custody = chain.at(-1)!;
    assert(same(chain, source.materialsOrigin.uniquenessCustody) && frame.locationId === custody.locationId, 'MATERIAL_REAL_VAULT_LOCATION');
    proof = command.type === 'INSPECT_UNIQUENESS' ?
      { ...base, kind: 'UNIQUENESS_INSPECTION', sourceEventId: custody.id, custodyDigest: hash(chain), sealId: custody.sealId } :
      { ...base, kind: 'HANDOFF', sourceEventId: custody.id, from: custody.custodianId, sourceContainerId: custody.sealId, sealId: custody.sealId };
  } else {
    assert(item, 'MATERIAL_FRAME_ORIGINAL_ID');
    if (command.type === 'TRACE_REJECTION') {
      const sourceEventId = item.lastProofId ?? item.sourceConsumption?.eventId;
      assert(check && sourceEventId && item.disposition === 'UNLOCATED_REJECTION' && frame.locationId === item.lastKnownLocationId, 'MATERIAL_TRACE_ACTUAL_LAST_SITE');
      proof = { ...base, kind: 'TRACE', sourceEventId, result: wins(check) ? 'LOCATED' : 'NOT_FOUND',
        foundAt: wins(check) ? frame.locationId : null, completeAndRecoverable: wins(check) };
    } else if (command.type === 'EXTRACT_RESIDUE') {
      assert(check && item.lastProofId && item.disposition === 'RESIDUE_LOCATED' && item.completeAndRecoverable && frame.locationId === item.locationId, 'MATERIAL_EXTRACT_ACTUAL_LOCATED_ORIGINAL');
      proof = { ...base, kind: 'EXTRACT', sourceEventId: item.lastProofId, result: wins(check) ? 'EXTRACTED' : 'FAILED',
        // This is only the ordinary paid extraction container's unique service
        // record. Its content remains item.id; the container is never a fourth
        // characteristic and can never resurrect an old consumed potion bottle.
        containerId: wins(check) ? `F208-RESIDUE-CONTAINER:${frame.eventId}:${item.id}` : null };
    } else if (command.type === 'SEAL_RESIDUE') {
      assert(check && item.lastProofId && item.containerId && item.disposition === 'PLAYER_DIRTY' &&
        item.treatmentWeek !== null && b.week > item.treatmentWeek, 'MATERIAL_SEAL_SAME_RESIDUE_LATER_WEEK');
      proof = { ...base, kind: 'SEAL', sourceEventId: item.lastProofId, result: wins(check) ? 'SEALED' : 'FAILED', containerId: item.containerId };
    } else if (command.type === 'SUPPLIER_WORK') {
      const step = item.supplierWork.length;
      assert(frame.locationId === 'base' && item.disposition === 'SUPPLIER' && item.legacySourceId && step < FOOL_SUPPLIER_WORK.length, 'MATERIAL_SUPPLIER_REAL_WORK');
      proof = { ...base, kind: 'SUPPLIER_WORK', sourceEventId: item.legacySourceId, step, task: FOOL_SUPPLIER_WORK[step]! };
    } else if (command.type === 'SUPPLIER_HANDOFF') {
      assert(frame.locationId === 'base' && item.disposition === 'SUPPLIER' && item.legacySourceId, 'MATERIAL_SUPPLIER_REAL_HANDOFF');
      proof = { ...base, kind: 'HANDOFF', sourceEventId: item.legacySourceId, from: 'ORIGINAL_SUPPLIER', sourceContainerId: null, sealId: null };
    } else {
      assert(item.legacySourceId && (item.disposition === 'LEGACY_HELD' || item.disposition === 'LEGACY_BOTTLED'), 'MATERIAL_EXISTING_CARRIED_ORIGINAL');
      proof = { ...base, kind: 'HANDOFF', sourceEventId: item.legacySourceId, from: source.actorId, sourceContainerId: item.containerId, sealId: null };
    }
  }
  host.proof = proof;
  return host;
}

/** Pure receipt derivation from the original actor's real FOG journey. This
 * neither teleports the bottle nor charges travel; applyVerifiedFoolTransport
 * appends the separate same-bottle custody event atomically with central travel. */
export function deriveFoolMaterialTransportReceipt(source: FoolSource, frame: FoolMaterialTransportReplayFrame): FoolMaterialTransportReceipt {
  return deriveMaterialTransportReceipt(source, frame);
}
function deriveMaterialTransportReceipt(source: FoolSource, frame: FoolMaterialTransportReplayFrame, expectedOrigin?: MaterialOriginIdentity): FoolMaterialTransportReceipt {
  requireFrame(source, frame, expectedOrigin);
  const b = frame.before, after = frame.after, j = frame.journey, t = frame.fogTravel, h = t.host;
  assert(t.command.type === 'TRAVEL' && j.source === 'FOG_ACTION' && j.bodyId === source.actorId && h.bodyId === source.actorId &&
    j.from === h.location && j.to === t.command.to && j.to === t.location && j.to === frame.locationId && j.from !== j.to,
  'MATERIAL_TRANSPORT_ACTUAL_ORIGINAL_JOURNEY');
  assert(h.active && h.sequence === 1 && h.week === b.week && h.health === b.health && h.mind === b.mind &&
    h.actions === b.actions && h.cash === b.cash && h.spirituality === b.spirituality && h.rolls === null && h.eventId === null,
  'MATERIAL_TRANSPORT_DEPARTURE_BUDGET');
  assert(whole(j.startSecond) && whole(j.endSecond) && j.startSecond === h.nowSecond && j.metres === fogTravelMetres(j.from, j.to) &&
    j.metres > 0 && j.endSecond - j.startSecond === j.metres && t.elapsedSeconds === j.metres && same(j.objectIds, t.transportObjectIds) &&
    frame.randomBefore === frame.randomAfter, 'MATERIAL_TRANSPORT_REAL_TIME_AND_DISTANCE');
  assert((t.cost.actions === 0 || t.cost.actions === 1) && t.cost.cash === 0 && t.cost.spirituality === 0 &&
    t.cost.mind === 0 && t.cost.health === 0 && t.cost.pollution === 0 && b.actions >= t.cost.actions &&
    same(after, { ...b, actions: b.actions - t.cost.actions }), 'MATERIAL_TRANSPORT_ACTUAL_PAID_BUDGET');
  const prepared = frame.materialsBefore.compounds.filter(c => c.status === 'PREPARED');
  assert(prepared.length === 1 && prepared[0]!.locationId === j.from, 'MATERIAL_TRANSPORT_SAME_CARRIED_BOTTLE');
  const compound = prepared[0]!;
  return { id: `${frame.eventId}:compound-transport`, sourceEventId: frame.eventId,
    actorId: source.actorId, originDigest: frame.materialsBefore.originDigest, compoundId: compound.id,
    containedItemIds: [...compound.externalMaterialIds, compound.uniquenessId],
    fromLocationId: j.from, toLocationId: j.to, startSecond: j.startSecond, endSecond: j.endSecond,
    week: after.week, date: structuredClone(after.date), revision: frame.revision,
    resourcesBefore: { cash: b.cash, actions: b.actions, spirituality: b.spirituality },
    resourcesAfter: { cash: after.cash, actions: after.actions, spirituality: after.spirituality } };
}

/** Call only with frames built by the central replay loop, plus at most its
 * current independently resolved pending action. A raw saved material journal
 * or a list of supplied proofs is NOT a valid input to this capability.
 * The host/proof maps contain newly derived values and cannot be extended by a
 * player command. Kernel replay thus matches actual central event identity,
 * original checkpoint, location, budget, check and complete physical receipt. */
export function createFoolMaterialAuthorityFactory(source: FoolSource, archivedS1Host: SliceState): (replayedFrames: readonly FoolMaterialReplayFrame[]) => FoolMaterialAuthority {
  // Bind an independent immutable source, including the verified original S1
  // snapshotDigest. Neither caller-owned object can change this capability after
  // construction; the large archived host itself is not retained by the closure.
  const boundSource = freezeSnapshot(structuredClone(source));
  assert(validateFoolSource(archivedS1Host, boundSource) && verifyFoolS1SourceReplay(boundSource.materialsOrigin, archivedS1Host) &&
    boundSource.worldDigest === foolWorldDigest(boundSource.materialsOrigin.checkpoint), 'MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  return materialAuthorityForVerifiedSource(boundSource);
}

/** Strict per-call entry point. A supplied source is bound to the CURRENT host;
 * reconstruction still verifies the complete archived S1 state and acquisition
 * journal. The result is local to one central replay, never a cross-save cache. */
export function createFoolReplayOrigin(current: SliceState, supplied?: FoolSource): {
  source: FoolSource; archived: SliceState;
  materialAuthority: (replayedFrames: readonly FoolMaterialReplayFrame[]) => FoolMaterialAuthority;
} {
  const source = freezeSnapshot(structuredClone(supplied === undefined ? createFoolSource(current) : supplied));
  if (supplied !== undefined) assert(validateFoolSource(current, source), 'MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  const archived = foolSourceView(current, source);
  assert(verifyFoolS1SourceReplay(source.materialsOrigin, archived) &&
    source.worldDigest === foolWorldDigest(source.materialsOrigin.checkpoint), 'MATERIAL_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  return { source, archived, materialAuthority: materialAuthorityForVerifiedSource(source) };
}

/** Private constructor; only the strict entry points above can supply a source.
 * No player-supplied flag, callback or token can bypass original verification. */
function materialAuthorityForVerifiedSource(boundSource: FoolSource): (replayedFrames: readonly FoolMaterialReplayFrame[]) => FoolMaterialAuthority {
  // Scope this factory to ONE central replay/projection. Recreate it for a new
  // root state. Only original-source verification is shared, never frame checks,
  // authority maps, mutable material state or a previous authorization result.
  // Both strict constructors cloned, deeply froze and verified boundSource.
  // Retain only its expected canonical bytes/digest for this replay invocation.
  const expectedOrigin = materialOriginIdentity(boundSource);
  return replayedFrames => {
    const hosts = new Map<string, FoolMaterialHost>();
    const proofs = new Map<string, { host: FoolMaterialHost; proof: FoolMaterialWorldReceipt }>();
    const consumptions = new Map<string, { host: FoolMaterialHost; receipt: FoolMaterialConsumptionReceipt }>();
    const transports = new Map<string, { host: FoolMaterialHost; receipt: FoolMaterialTransportReceipt }>();
    const eventIds = new Set<string>(); let previousRevision = boundSource.revision, previousRandom = boundSource.random.cursor;
    for (const frame of replayedFrames) {
      assert(frame.revision > previousRevision && frame.randomBefore >= previousRandom && !eventIds.has(frame.eventId) && !hosts.has(frame.witnessId), 'MATERIAL_AUTHORITY_EVENT_ORDER');
      const host = deriveMaterialHost(boundSource, frame, expectedOrigin); hosts.set(host.witnessId, structuredClone(host)); eventIds.add(host.eventId);
      if (host.proof) {
        assert(!proofs.has(host.proof.id) && !consumptions.has(host.proof.id) && !transports.has(host.proof.id), 'MATERIAL_AUTHORITY_DUPLICATE_RECEIPT');
        proofs.set(host.proof.id, { host: structuredClone(host), proof: structuredClone(host.proof) });
      }
      if (frame.kind === 'CENTRAL_CONSUMPTION') {
        assert(!consumptions.has(frame.consumption.id) && !proofs.has(frame.consumption.id) && !transports.has(frame.consumption.id), 'MATERIAL_AUTHORITY_DUPLICATE_RECEIPT');
        consumptions.set(frame.consumption.id, { host: structuredClone(host), receipt: structuredClone(frame.consumption) });
      }
      if (frame.kind === 'CENTRAL_TRANSPORT') {
        const receipt = deriveMaterialTransportReceipt(boundSource, frame, expectedOrigin);
        assert(!transports.has(receipt.id) && !proofs.has(receipt.id) && !consumptions.has(receipt.id), 'MATERIAL_AUTHORITY_DUPLICATE_RECEIPT');
        transports.set(receipt.id, { host: structuredClone(host), receipt: structuredClone(receipt) });
      }
      previousRevision = frame.revision; previousRandom = frame.randomAfter;
    }
    return {
      verifyOrigin: candidate => stableStringify(candidate) === expectedOrigin.canonical,
      verifyHost: host => { const expected = hosts.get(host.witnessId); return !!expected && same(expected, host); },
      verifyWorldReceipt: (proof, host) => { const expected = proofs.get(proof.id); return !!expected && same(expected.host, host) && same(expected.proof, proof); },
      verifyConsumption: (receipt, host) => { const expected = consumptions.get(receipt.id); return !!expected && same(expected.host, host) && same(expected.receipt, receipt); },
      verifyTransport: (receipt, host) => { const expected = transports.get(receipt.id); return !!expected && same(expected.host, host) && same(expected.receipt, receipt); },
    };
  };
}

/** Compatibility entry point. Callers that build several authorities inside one
 * central replay/projection should create and reuse the scoped factory instead. */
export function createFoolMaterialAuthority(source: FoolSource, archivedS1Host: SliceState, replayedFrames: readonly FoolMaterialReplayFrame[]): FoolMaterialAuthority {
  return createFoolMaterialAuthorityFactory(source, archivedS1Host)(replayedFrames);
}
