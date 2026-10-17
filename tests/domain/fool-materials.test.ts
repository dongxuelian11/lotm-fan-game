import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createFoolState, createOwnedFoolReplayCanonical } from '../../src/domain/fool/engine.js';
import { createFoolSource } from '../../src/domain/fool/source.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { AttendantMysteriesCommand } from '../../src/domain/attendant-mysteries/types.js';
import { applyAttendantMysteriesCommand, validateAttendantMysteriesAcquisitionJournal } from '../../src/domain/attendant-mysteries/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  FOOL_SOURCE_MATERIAL_IDS, FOOL_UNIQUENESS_ID, FOOL_COMPOUND_SERVICE_ID, FOOL_SUCCESSION, FOOL_SUPPLIER_WORK, FOOL_MATERIAL_COSTS,
  snapshotFoolS1Source, foolS1SnapshotDigest, verifyFoolS1SourceReplay, createFoolMaterials, applyFoolMaterialCommand, applyVerifiedFoolConsumption, applyVerifiedFoolTransport,
  replayFoolMaterials, validateFoolMaterials, validateFoolMaterialCommand, projectFoolMaterials, createFoolMaterialReplayCursor,
  type FoolMaterialsOrigin, type FoolMaterialsState, type FoolMaterialAuthority, type FoolMaterialHost,
  type FoolMaterialCommand, type FoolMaterialWorldReceipt, type FoolMaterialConsumptionReceipt, type FoolMaterialTransportReceipt, type FoolMaterialCost,
} from '../../src/domain/fool/materials.js';

/** NOT RUN: candidate tests only. The real natural-battle source is read-only.
 * All synthetic identity permutations and corruption are confined to clones.
 * Registry mocks model independent controller journals, not a trusted=true field
 * supplied by a public player command. Production must use real journal lookups. */
const hash = (v: unknown): string => sha256Hex(stableStringify(v));
let saved: SliceState | undefined;
const original = (): SliceState => saved ??= readObjectEntry<SliceState>('tests/fixtures/attendant-mysteries-v01860/natural-battle.json', 'final');
function origin(): FoolMaterialsOrigin {
  const s = original(), sourceSnapshot = snapshotFoolS1Source(s.attendantMysteries);
  return { version: 1, actorId: 'unit-test-original-player', checkpoint: { week: s.week, date: structuredClone(s.date), revision: s.revision },
    sourceSnapshot, snapshotDigest: foolS1SnapshotDigest(sourceSnapshot), uniquenessCustody: [{ id: 'test-original-vault-record',
      sourceEventId: FOOL_SUCCESSION.eventId, previousRecordId: null, uniquenessId: FOOL_UNIQUENESS_ID,
      sealId: 'test-one-original-uniqueness-seal', custodianId: 'test-independent-vault-keeper', locationId: 'test-original-vault',
      week: 15837, date: { epoch: 'FIFTH_EPOCH', year: 1652, month: 12, day: 30 }, revision: 1 }] };
}
/** Directed host-unit history: real S1 reducers, actual deterministic checks and
 * their real acquisition replay. Provisioned test-host resources/stats and extra
 * independent rolls do not alter the saved fixture, seed or any old receipt.
 * This is not a natural end-to-end capture and must not be presented as one. */
let recoverySourceCache: SliceState | undefined;
function recoveredSuccessfulSource(): SliceState {
  if (recoverySourceCache) return structuredClone(recoverySourceCache);
  const s = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/attendant-mysteries-v01860/boundary-attendant-mysteries-batch-1_bottle-actual-consumption-result.json', 'final'));
  const ctx: SeerContext = {
    note() {},
    roll(min, max) { const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = rng.nextInt(min, max); s.random.cursor = rng.cursor; return roll; },
    check(ability, difficulty) { return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: this.roll(1, 100) }); },
  };
  const issue = (command: AttendantMysteriesCommand): void => { s.revision++; applyAttendantMysteriesCommand(s, command, ctx); };
  const travel = (to: 'base' | 'new-alder-clearing'): void => issue({ type: 'TOWN', command: { type: 'TRAVEL', to } });
  s.cash = 100_000; s.actionsRemaining = 10; s.character.coreStats.will = 0;
  for (const n of [2, 3]) {
    s.actionsRemaining = 10; s.health = 100; s.mind = 100; travel('base');
    const batchId = `attendant-mysteries-batch-${n}`, bottleId = `${batchId}:bottle`;
    issue({ type: 'BUY_MATERIALS', batchId }); issue({ type: 'BREW', batchId }); travel('new-alder-clearing');
    while (new DeterministicActionRandomStream(s.random.seed, s.random.cursor).nextInt(1, 100) <= 5) ctx.roll(1, 100);
    issue({ type: 'PREPARE_PROMOTION', bottleId }); issue({ type: 'CONSUME', bottleId, confirmed: true });
    expect(s.attendantMysteries.bottles.at(-1)!.outcome).toMatch(/FAILURE/);
  }
  expect(s.attendantMysteries.bottles).toHaveLength(3);
  expect(s.attendantMysteries.bottles.every(p => p.status === 'CONSUMED' && p.outcome?.includes('FAILURE'))).toBe(true);
  travel('base'); issue({ type: 'REQUEST_RECOVERY_V1', bottleId: 'attendant-mysteries-batch-1:bottle' });
  s.week++; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 10;
  travel('new-alder-clearing'); issue({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'attendant-mysteries-batch-1:bottle' });
  travel('base'); issue({ type: 'BUY_MATERIALS', batchId: 'attendant-mysteries-batch-4' }); issue({ type: 'BREW', batchId: 'attendant-mysteries-batch-4' });
  s.health = 100; s.mind = 100; s.character.coreStats.will = 500; travel('new-alder-clearing');
  while (new DeterministicActionRandomStream(s.random.seed, s.random.cursor).nextInt(1, 100) > 95) ctx.roll(1, 100);
  issue({ type: 'PREPARE_PROMOTION', bottleId: 'attendant-mysteries-batch-4:bottle' });
  issue({ type: 'CONSUME', bottleId: 'attendant-mysteries-batch-4:bottle', confirmed: true });
  expect(s.progression.sequence).toBe(1); expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  recoverySourceCache = structuredClone(s); return s;
}
function recoveryOrigin(source: SliceState): FoolMaterialsOrigin {
  const o = origin(); o.checkpoint = { week: source.week, date: structuredClone(source.date), revision: source.revision };
  o.sourceSnapshot = snapshotFoolS1Source(source.attendantMysteries); o.snapshotDigest = foolS1SnapshotDigest(o.sourceSnapshot); return o;
}
class Harness {
  readonly origins = new Set<string>(); readonly hosts = new Map<string, string>(); readonly proofs = new Map<string, string>(); readonly outcomes = new Map<string, string>(); readonly transports = new Map<string, string>();
  readonly authority: FoolMaterialAuthority = {
    verifyOrigin: o => this.origins.has(hash(o)),
    verifyHost: h => this.hosts.get(h.witnessId) === hash(h),
    verifyWorldReceipt: p => this.proofs.get(p.id) === hash(p),
    verifyConsumption: r => this.outcomes.get(r.id) === hash(r),
    verifyTransport: r => this.transports.get(r.id) === hash(r),
  };
  state: FoolMaterialsState; revision: number; week: number;
  resources: FoolMaterialCost = { cash: 100_000, actions: 1_000, spirituality: 1_000 };
  constructor(readonly source: FoolMaterialsOrigin = origin()) {
    this.origins.add(hash(source)); this.state = createFoolMaterials(source, this.authority); this.revision = source.checkpoint.revision; this.week = source.checkpoint.week;
  }
  trustOrigin(source: FoolMaterialsOrigin): void { this.origins.add(hash(source)); }
  advance(weeks = 1): void { this.week += weeks; }
  host(locationId = 'new-alder-clearing', proof: FoolMaterialWorldReceipt | null = null): FoolMaterialHost {
    this.revision++;
    const h: FoolMaterialHost = { week: this.week, date: addGameWeeks(this.source.checkpoint.date, this.week - this.source.checkpoint.week), revision: this.revision,
      eventId: `event-${this.revision}`, witnessId: `host-${this.revision}`, actorId: this.source.actorId, status: 'ACTIVE', sequence: 1,
      health: 80, mind: 75, locationId, resources: { ...this.resources }, proof };
    this.registerHost(h); return h;
  }
  registerHost(h: FoolMaterialHost): void { this.hosts.set(h.witnessId, hash(h)); }
  proof(itemId: string, details: Record<string, unknown>, locationId: string): FoolMaterialWorldReceipt {
    const p = { week: this.week, date: addGameWeeks(this.source.checkpoint.date, this.week - this.source.checkpoint.week), revision: this.revision + 1,
      id: `proof-${this.revision + 1}`, originDigest: this.state.originDigest, actorId: this.source.actorId, itemId, locationId, ...details } as unknown as FoolMaterialWorldReceipt;
    this.proofs.set(p.id, hash(p)); return p;
  }
  act(type: FoolMaterialCommand['type'], itemId?: string, details?: Record<string, unknown>, locationId = 'new-alder-clearing') {
    if (type === 'PREPARE_COMPOUND' && !details) details = { kind: 'COMPOUND_SUPPLY', sourceEventId: `test-finite-warehouse-delivery-${this.revision + 1}`, providerId: 'test-compound-workshop', batchId: `ordinary-batch-${this.revision + 1}`, chargedCash: 240,
      inputs: [{ id: `fluid-${this.revision + 1}`, role: 'CARRIER_FLUID' }, { id: `isolation-${this.revision + 1}`, role: 'ISOLATION_MATERIAL' }, { id: `bottle-${this.revision + 1}`, role: 'EMPTY_BOTTLE' }] };
    const p = details ? this.proof(type === 'PREPARE_COMPOUND' ? FOOL_COMPOUND_SERVICE_ID : itemId ?? FOOL_UNIQUENESS_ID, details, locationId) : null;
    const command = type === 'PREPARE_COMPOUND' ? { type, proofId: p!.id } : type === 'INSPECT_UNIQUENESS' || type === 'TAKE_UNIQUENESS' ?
      { type, proofId: p!.id } : { type, itemId: itemId!, proofId: p!.id };
    const host = this.host(locationId, p), r = applyFoolMaterialCommand(this.state, command as FoolMaterialCommand, host, this.authority);
    this.state = r.state; this.resources = { ...r.event.resourcesAfter }; return r;
  }
  item(id: string) { return this.state.items.find(i => i.id === id)!; }
  recover(id: string): void {
    const item = this.item(id), site = item.lastKnownLocationId!;
    this.act('TRACE_REJECTION', id, { kind: 'TRACE', sourceEventId: item.lastProofId ?? item.sourceConsumption!.eventId,
      result: 'LOCATED', foundAt: site, completeAndRecoverable: true }, site);
    this.extractAndSeal(id);
  }
  extractAndSeal(id: string): void {
    const site = this.item(id).locationId!;
    this.act('EXTRACT_RESIDUE', id, { kind: 'EXTRACT', sourceEventId: this.item(id).lastProofId,
      result: 'EXTRACTED', containerId: `test-residue-container:${id}:${this.revision}` }, site);
    this.advance();
    this.act('SEAL_RESIDUE', id, { kind: 'SEAL', sourceEventId: this.item(id).lastProofId, result: 'SEALED', containerId: this.item(id).containerId });
  }
  supply(id: string, work = false): void {
    if (work) for (let step = 0; step < 5; step++) this.act('SUPPLIER_WORK', id,
      { kind: 'SUPPLIER_WORK', sourceEventId: this.item(id).legacySourceId, step, task: FOOL_SUPPLIER_WORK[step] }, 'base');
    this.act('SUPPLIER_HANDOFF', id, { kind: 'HANDOFF', sourceEventId: this.item(id).legacySourceId, from: 'ORIGINAL_SUPPLIER', sourceContainerId: null, sealId: null }, 'base');
  }
  takeUnique(): void {
    const c = this.source.uniquenessCustody.at(-1)!;
    this.act('INSPECT_UNIQUENESS', undefined, { kind: 'UNIQUENESS_INSPECTION', sourceEventId: c.id,
      custodyDigest: hash(this.source.uniquenessCustody), sealId: c.sealId }, c.locationId);
    this.act('TAKE_UNIQUENESS', undefined, { kind: 'HANDOFF', sourceEventId: c.id, from: c.custodianId, sealId: c.sealId, sourceContainerId: c.sealId }, c.locationId);
  }
  prepare(locationId = 'new-alder-clearing'): void {
    for (const item of [...this.state.items]) {
      if (item.disposition === 'UNLOCATED_REJECTION') this.recover(item.id);
      if (item.disposition === 'SUPPLIER') this.supply(item.id);
    }
    this.takeUnique(); this.act('PREPARE_COMPOUND', undefined, undefined, locationId);
  }
  transport(toLocationId: string): { receipt: FoolMaterialTransportReceipt; host: FoolMaterialHost } {
    const resourcesBefore = { ...this.resources }, compound = this.state.compounds.at(-1)!;
    const host = this.host(toLocationId);
    // Unit registry stands for an independently replayed paid central journey.
    // These records do not replace real FOG replay in production.
    host.resources.actions--; this.registerHost(host);
    const previous = this.state.journal.filter(e => e.kind === 'TRANSPORT').at(-1)?.transport;
    const startSecond = previous?.endSecond ?? 604_800;
    const receipt: FoolMaterialTransportReceipt = { id: `transport-${host.revision}`, sourceEventId: host.eventId,
      originDigest: this.state.originDigest, actorId: host.actorId, compoundId: compound.id,
      containedItemIds: [...compound.externalMaterialIds, compound.uniquenessId],
      fromLocationId: compound.locationId, toLocationId, startSecond, endSecond: startSecond + 120,
      week: host.week, date: structuredClone(host.date), revision: host.revision,
      resourcesBefore, resourcesAfter: { ...host.resources } };
    this.transports.set(receipt.id, hash(receipt)); return { receipt, host };
  }
  outcome(result: 'SUCCESS' | 'FAILURE', dead = false): { receipt: FoolMaterialConsumptionReceipt; host: FoolMaterialHost } {
    const host = this.host(), compound = this.state.compounds.at(-1)!;
    const receipt: FoolMaterialConsumptionReceipt = { id: `central-consumption-${host.revision}`, originDigest: this.state.originDigest, actorId: host.actorId,
      compoundId: compound.id, locationId: host.locationId, week: host.week, date: structuredClone(host.date), revision: host.revision,
      sourceMaterialIds: [...FOOL_SOURCE_MATERIAL_IDS], uniquenessId: FOOL_UNIQUENESS_ID, outcome: result,
      actorAfter: { status: dead ? 'DEAD' : 'ACTIVE', health: dead ? 0 : 30, mind: dead ? 0 : 25, sequence: result === 'SUCCESS' ? 0 : 1 },
      destinations: this.state.items.map(i => ({ itemId: i.id,
        disposition: result === 'SUCCESS' || !dead && i.id === compound.integratedMaterialId ? 'INTEGRATED_PLAYER' : 'RESIDUE_LOCATED',
        locationId: result === 'SUCCESS' || !dead && i.id === compound.integratedMaterialId ? null : host.locationId,
        completeAndRecoverable: !(result === 'SUCCESS' || !dead && i.id === compound.integratedMaterialId) })) };
    this.outcomes.set(receipt.id, hash(receipt)); return { receipt, host };
  }
  settle(result: 'SUCCESS' | 'FAILURE', dead = false) {
    const { receipt, host } = this.outcome(result, dead), next = applyVerifiedFoolConsumption(this.state, receipt, host, this.authority);
    this.state = next.state; return next;
  }
}

describe('208 strict original material identity ledger, candidate NOT_RUN', () => {
  it('initializes no retrieved material and binds the complete S1 snapshot rather than the older sourceHistoryDigest', () => {
    const h = new Harness(), a = h.source.sourceSnapshot;
    expect(h.state.items.map(i => i.disposition)).toEqual(['UNLOCATED_REJECTION', 'INTEGRATED_PLAYER', 'SUPPLIER', 'SEALED_EXTERNAL']);
    expect(projectFoolMaterials(h.state).heldExternalCharacteristics).toBe(0);
    expect(projectFoolMaterials(h.state).uniquenessHeld).toBe(false);
    expect(h.state.items[0]!.sourceConsumption).toMatchObject({ week: 15941, outcome: 'FAILURE', locationId: 'new-alder-clearing' });
    expect(h.state.items[1]!.sourceConsumption).toMatchObject({ week: 15962, outcome: 'SUCCESS', locationId: 'new-alder-clearing' });
    const bad = structuredClone(h.source); bad.snapshotDigest = a.sourceHistoryDigest!; h.trustOrigin(bad);
    expect(() => createFoolMaterials(bad, h.authority)).toThrow('S1_SNAPSHOT_DIGEST_MISMATCH');
  });
  it('preserves frozen original costs, losses, nine auxiliaries, bottles and RNG while only the new ledger becomes spendable', () => {
    const h = new Harness(), old = stableStringify(h.source.sourceSnapshot); h.prepare();
    expect(stableStringify(h.state.origin.sourceSnapshot)).toBe(old);
    expect(stableStringify(h.source.sourceSnapshot)).toBe(old);
    expect(h.source.sourceSnapshot.batches[2]!.materials[0]).toMatchObject({ holder: 'SUPPLIER', quantity: 1 });
    expect(h.item(FOOL_SOURCE_MATERIAL_IDS[2]!)).toMatchObject({ disposition: 'COMMITTED' });
    for (const b of h.source.sourceSnapshot.batches.slice(0, 2)) expect(b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(h.state.items).toHaveLength(4); expect(h.state.compounds[0]!.externalMaterialIds).toHaveLength(2);
  });
  it.each([1, 3])('reads the actual successful source when original slot %s succeeds, with no seed or fixed second-slot branch', (slot) => {
    const base = origin();
    // Synthetic alternate history only; never written to the real old capture.
    const swap = (s: string): string => s.replaceAll(`batch-${slot}`, 'batch-TEMP').replaceAll('batch-2', `batch-${slot}`).replaceAll('batch-TEMP', 'batch-2')
      .replaceAll(`LEGACY-${slot}`, 'LEGACY-TEMP').replaceAll('LEGACY-2', `LEGACY-${slot}`).replaceAll('LEGACY-TEMP', 'LEGACY-2')
      .replaceAll(`EXPEDITION-${slot}-`, 'EXPEDITION-TEMP-').replaceAll('EXPEDITION-2-', `EXPEDITION-${slot}-`).replaceAll('EXPEDITION-TEMP-', 'EXPEDITION-2-');
    base.sourceSnapshot = JSON.parse(swap(JSON.stringify(base.sourceSnapshot))) as typeof base.sourceSnapshot;
    base.snapshotDigest = foolS1SnapshotDigest(base.sourceSnapshot);
    const h = new Harness(base);
    expect(h.state.items.filter(i => i.disposition === 'INTEGRATED_PLAYER').map(i => i.id)).toEqual([FOOL_SOURCE_MATERIAL_IDS[slot - 1]]);
    h.prepare(); expect(h.state.compounds[0]!.integratedMaterialId).toBe(FOOL_SOURCE_MATERIAL_IDS[slot - 1]);
  });
  it('explicitly refuses fourth independent originals without rewriting the old record', () => {
    const h = new Harness(), bad = structuredClone(h.source), oldFourth = structuredClone(bad.sourceSnapshot.batches[2]!);
    oldFourth.id = 'attendant-mysteries-batch-4'; bad.sourceSnapshot.batches.push(oldFourth); bad.snapshotDigest = foolS1SnapshotDigest(bad.sourceSnapshot); h.trustOrigin(bad);
    const bytes = stableStringify(bad);
    expect(() => createFoolMaterials(bad, h.authority)).toThrow('UNSUPPORTED_S1_LINEAGE'); expect(stableStringify(bad)).toBe(bytes);
  });
  it('rejects forged digest/consumption evidence and preserves the source under all failed operations', () => {
    const h = new Harness(), before = stableStringify(h.state), bad = structuredClone(h.source);
    const forgedEvent = bad.sourceSnapshot.acquisitionJournal[9]!;
    forgedEvent.check = { ...forgedEvent.check!, tier: 'SUCCESS' }; bad.snapshotDigest = foolS1SnapshotDigest(bad.sourceSnapshot);
    expect(() => createFoolMaterials(bad, h.authority)).toThrow('UNVERIFIED_MATERIAL_ORIGIN');
    h.trustOrigin(bad); expect(() => createFoolMaterials(bad, h.authority)).toThrow('S1_CONSUMPTION_PLACE_TIME');
    expect(stableStringify(h.state)).toBe(before);
  });
  it('requires the independent 1652 uniqueness custody chain and rejects an invented fourth source identity', () => {
    const h = new Harness(), bad = structuredClone(h.source);
    bad.uniquenessCustody[0]!.sourceEventId = 'unrelated-box-or-purchased-uniqueness'; h.trustOrigin(bad);
    expect(() => createFoolMaterials(bad, h.authority)).toThrow('UNIQUENESS_CUSTODY_PROVENANCE');
    expect(validateFoolMaterialCommand({ type: 'SUPPLIER_HANDOFF', itemId: 'attendant-mysteries-batch-4:characteristic', proofId: 'invented' })).toBe(false);
    expect(validateFoolMaterialCommand({ type: 'SUPPLIER_HANDOFF', itemId: FOOL_SOURCE_MATERIAL_IDS[2], proofId: 'receipt', price: 0 })).toBe(false);
  });
  it('requires actual original-location trace and authoritative identity evidence', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[0]!;
    expect(() => h.act('TRACE_REJECTION', id, { kind: 'TRACE', sourceEventId: h.item(id).sourceConsumption!.eventId,
      result: 'LOCATED', foundAt: 'base', completeAndRecoverable: true }, 'base')).toThrow('TRACE_ORIGINAL_LAST_SITE_REQUIRED');
    const p = h.proof(id, { kind: 'TRACE', sourceEventId: h.item(id).sourceConsumption!.eventId, result: 'LOCATED', foundAt: 'new-alder-clearing', completeAndRecoverable: true }, 'new-alder-clearing');
    h.proofs.delete(p.id);
    expect(() => applyFoolMaterialCommand(h.state, { type: 'TRACE_REJECTION', itemId: id, proofId: p.id }, h.host('new-alder-clearing', p), h.authority)).toThrow('UNVERIFIED_WORLD_RECEIPT');
  });
  it('charges investigation without promising a find or a complete recoverable unit', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[0]!, cash = h.resources.cash;
    h.act('TRACE_REJECTION', id, { kind: 'TRACE', sourceEventId: h.item(id).sourceConsumption!.eventId, result: 'NOT_FOUND', foundAt: null, completeAndRecoverable: false });
    expect(h.resources.cash).toBe(cash - 60); expect(h.item(id).disposition).toBe('UNLOCATED_REJECTION');
    h.act('TRACE_REJECTION', id, { kind: 'TRACE', sourceEventId: h.item(id).lastProofId, result: 'LOCATED', foundAt: 'new-alder-clearing', completeAndRecoverable: false });
    expect(() => h.act('EXTRACT_RESIDUE', id, { kind: 'EXTRACT', sourceEventId: h.item(id).lastProofId, result: 'EXTRACTED', containerId: 'fake-full-unit' })).toThrow('EXTRACT_LOCATED_COMPLETE_ORIGINAL_REQUIRED');
  });
  it('requires paid extraction and a later week before paid same-container sealing', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[0]!;
    h.act('TRACE_REJECTION', id, { kind: 'TRACE', sourceEventId: h.item(id).sourceConsumption!.eventId, result: 'LOCATED', foundAt: 'new-alder-clearing', completeAndRecoverable: true });
    expect(() => h.act('EXTRACT_RESIDUE', id, { kind: 'EXTRACT', sourceEventId: h.item(id).lastProofId, result: 'EXTRACTED', containerId: h.item(id).sourceBottleId })).toThrow('ORIGINAL_RESIDUE_CONTAINER_REQUIRED');
    h.act('EXTRACT_RESIDUE', id, { kind: 'EXTRACT', sourceEventId: h.item(id).lastProofId, result: 'EXTRACTED', containerId: 'same-dirty-container' });
    expect(h.item(id).disposition).toBe('PLAYER_DIRTY');
    expect(() => h.act('SEAL_RESIDUE', id, { kind: 'SEAL', sourceEventId: h.item(id).lastProofId, result: 'SEALED', containerId: 'same-dirty-container' })).toThrow('SEAL_SAME_RESIDUE_NEXT_WEEK_REQUIRED');
    h.advance(); const paid = h.act('SEAL_RESIDUE', id, { kind: 'SEAL', sourceEventId: h.item(id).lastProofId, result: 'SEALED', containerId: 'same-dirty-container' });
    expect(paid.cost).toEqual(FOOL_MATERIAL_COSTS.SEAL_RESIDUE); expect(h.item(id).disposition).toBe('PLAYER_HELD');
  });
  it('requires five real ordered custody work records to reduce supplier balance, never granting materials from labour', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[2]!, before = h.resources.cash;
    for (let step = 0; step < 5; step++) {
      h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step, task: FOOL_SUPPLIER_WORK[step] }, 'base');
      expect(h.item(id).disposition).toBe('SUPPLIER');
    }
    expect(h.resources.cash).toBe(before); expect(h.item(id).supplierWork).toHaveLength(5);
    const workActions = h.state.journal.reduce((n, e) => n + e.cost.actions, 0); expect(workActions).toBe(5);
    h.supply(id); expect(h.resources.cash).toBe(before - 90);
    expect(h.source.sourceSnapshot.batches[2]!.materials.slice(1).every(m => m.holder === 'SUPPLIER')).toBe(true);
    expect(() => h.supply(id)).toThrow('ORIGINAL_SUPPLIER_HANDOFF_REQUIRED');
  });
  it('rejects repeated/out-of-order or contentless supplier work', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[2]!;
    expect(() => h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step: 4, task: FOOL_SUPPLIER_WORK[4] }, 'base')).toThrow('SUPPLIER_WORK_STEP_MISMATCH');
    expect(() => h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step: 0, task: '' }, 'base')).toThrow('SUPPLIER_WORK_STEP_MISMATCH');
  });
  it('treats uniqueness inspection and actual custodian handoff as distinct services with one physical original', () => {
    const h = new Harness(), c = h.source.uniquenessCustody[0]!;
    expect(() => h.act('TAKE_UNIQUENESS', undefined, { kind: 'HANDOFF', sourceEventId: c.id, from: c.custodianId, sealId: c.sealId, sourceContainerId: c.sealId }, c.locationId)).toThrow('UNIQUENESS_ACTUAL_CUSTODIAN_HANDOFF_REQUIRED');
    h.takeUnique(); expect(h.item(FOOL_UNIQUENESS_ID).disposition).toBe('PLAYER_HELD');
    expect(h.state.journal.map(e => e.cost.cash)).toEqual([80, 120]);
    expect(h.state.items.filter(i => i.kind === 'UNIQUENESS')).toHaveLength(1);
  });
  it('requires both distinct external originals and uniqueness, and commits them exclusively to one compound', () => {
    const h = new Harness(); expect(() => h.act('PREPARE_COMPOUND')).toThrow('NEED_TWO_EXTERNAL_ORIGINALS_AND_UNIQUENESS_IN_HAND');
    h.prepare(); const c = h.state.compounds[0]!;
    expect(c.externalMaterialIds).toEqual([FOOL_SOURCE_MATERIAL_IDS[0], FOOL_SOURCE_MATERIAL_IDS[2]]);
    expect(c.integratedMaterialId).toBe(FOOL_SOURCE_MATERIAL_IDS[1]);
    expect(projectFoolMaterials(h.state).heldExternalCharacteristics).toBe(0);
    expect(() => h.act('PREPARE_COMPOUND')).toThrow('ORIGINAL_COMPOUND_ALREADY_COMMITTED');
  });
  it('refuses public success/outcome/price commands, trusting only independently verified central consumption', () => {
    const h = new Harness(); h.prepare();
    expect(validateFoolMaterialCommand({ type: 'CONSUME', outcome: 'SUCCESS' })).toBe(false);
    expect(validateFoolMaterialCommand({ type: 'PREPARE_COMPOUND', cash: 0 })).toBe(false);
    const { receipt, host } = h.outcome('SUCCESS'); h.outcomes.delete(receipt.id);
    expect(() => applyVerifiedFoolConsumption(h.state, receipt, host, h.authority)).toThrow('UNVERIFIED_CENTRAL_CONSUMPTION');
    h.outcomes.set(receipt.id, hash(receipt)); const result = applyVerifiedFoolConsumption(h.state, receipt, host, h.authority); h.state = result.state;
    expect(h.state.items.every(i => i.disposition === 'INTEGRATED_PLAYER')).toBe(true);
    expect(projectFoolMaterials(h.state).integratedCharacteristics).toBe(3); expect(projectFoolMaterials(h.state).heldExternalCharacteristics).toBe(0);
  });
  it('rejects central receipts with another bottle, duplicate original identities or unsupported free integration', () => {
    const h = new Harness(); h.prepare(); const { receipt, host } = h.outcome('FAILURE');
    const wrongBottle = structuredClone(receipt); wrongBottle.compoundId = 'another-bottle'; h.outcomes.set(wrongBottle.id, hash(wrongBottle));
    expect(() => applyVerifiedFoolConsumption(h.state, wrongBottle, host, h.authority)).toThrow('SAME_PREPARED_COMPOUND_REQUIRED');
    const duplicated = structuredClone(receipt); duplicated.sourceMaterialIds[2] = duplicated.sourceMaterialIds[0]!; h.outcomes.set(duplicated.id, hash(duplicated));
    expect(() => applyVerifiedFoolConsumption(h.state, duplicated, host, h.authority)).toThrow('CENTRAL_CONSUMPTION_BINDING');
    const free = structuredClone(receipt); const destination = free.destinations.find(d => d.itemId === FOOL_SOURCE_MATERIAL_IDS[0])!;
    destination.disposition = 'INTEGRATED_PLAYER'; destination.locationId = null; destination.completeAndRecoverable = false; h.outcomes.set(free.id, hash(free));
    expect(() => applyVerifiedFoolConsumption(h.state, free, host, h.authority)).toThrow('FAILURE_CANNOT_GRANT_ADDITIONAL_INTEGRATION');
  });
  it('places failed originals in actual contaminated locations and charges later-week recovery of the same identities', () => {
    const h = new Harness(); h.prepare(); const spent = h.resources.cash; h.settle('FAILURE');
    expect(h.resources.cash).toBe(spent); expect(h.item(FOOL_SOURCE_MATERIAL_IDS[1]!).disposition).toBe('INTEGRATED_PLAYER');
    for (const id of [FOOL_SOURCE_MATERIAL_IDS[0]!, FOOL_SOURCE_MATERIAL_IDS[2]!, FOOL_UNIQUENESS_ID]) h.extractAndSeal(id);
    h.act('PREPARE_COMPOUND'); expect(h.state.compounds).toHaveLength(2);
    expect(h.state.compounds[0]!.status).toBe('CONSUMED'); expect(h.state.compounds[1]!.status).toBe('PREPARED');
    expect(h.resources.cash).toBe(spent - 3 * (180 + 120) - 240);
    expect(h.state.items.map(i => i.id)).toEqual([...FOOL_SOURCE_MATERIAL_IDS, FOOL_UNIQUENESS_ID]);
  });
  it('requires a real paid ordinary supply batch and never replenishes old liquid, isolation material or the consumed empty bottle', () => {
    const h = new Harness(); h.prepare(); const first = structuredClone(h.state.compounds[0]!); h.settle('FAILURE');
    for (const id of [FOOL_SOURCE_MATERIAL_IDS[0]!, FOOL_SOURCE_MATERIAL_IDS[2]!, FOOL_UNIQUENESS_ID]) h.extractAndSeal(id);
    const remainingCash = h.resources.cash;
    expect(() => h.act('PREPARE_COMPOUND', undefined, { kind: 'COMPOUND_SUPPLY', sourceEventId: 'duplicate-warehouse-claim',
      providerId: first.supplyProviderId, batchId: first.supplyBatchId, chargedCash: 240, inputs: first.disposableInputs })).toThrow('ORDINARY_SUPPLY_ALREADY_SPENT_OR_ORIGINAL_INPUT');
    expect(h.resources.cash).toBe(remainingCash);
    expect(() => h.act('PREPARE_COMPOUND', undefined, { kind: 'COMPOUND_SUPPLY', sourceEventId: 'undercharged-warehouse-claim',
      providerId: first.supplyProviderId, batchId: 'new-batch', chargedCash: 0, inputs: first.disposableInputs })).toThrow('ACTUAL_COMPOUND_CONSUMABLE_SUPPLY_REQUIRED');
    h.act('PREPARE_COMPOUND');
    expect(h.state.compounds[0]!.status).toBe('CONSUMED');
    expect(h.state.compounds[1]!.id).not.toBe(first.id);
    expect(h.state.compounds[1]!.supplyBatchId).not.toBe(first.supplyBatchId);
    expect(h.resources.cash).toBe(remainingCash - 240);
  });
  it('does not guarantee recovery, and all actions remain closed after actual death', () => {
    const h = new Harness(); h.prepare(); const { receipt, host } = h.outcome('FAILURE');
    const missing = receipt.destinations.find(d => d.itemId === FOOL_SOURCE_MATERIAL_IDS[0])!;
    missing.disposition = 'UNAVAILABLE'; missing.locationId = null; missing.completeAndRecoverable = false; h.outcomes.set(receipt.id, hash(receipt));
    h.state = applyVerifiedFoolConsumption(h.state, receipt, host, h.authority).state;
    expect(h.item(FOOL_SOURCE_MATERIAL_IDS[0]!).disposition).toBe('UNAVAILABLE');
    expect(() => h.recover(FOOL_SOURCE_MATERIAL_IDS[0]!)).toThrow('TRACE_ORIGINAL_LAST_SITE_REQUIRED');
    const dead = new Harness(); dead.prepare(); dead.settle('FAILURE', true);
    expect(dead.state.status).toBe('DEAD'); expect(() => dead.act('PREPARE_COMPOUND')).toThrow('LIVING_S1_REQUIRED');
  });
  it('makes duplicate intent delivery free, rejects conflicts and refuses spending the same world proof twice', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[2]!;
    const first = h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step: 0, task: FOOL_SUPPLIER_WORK[0] }, 'base');
    const retry = applyFoolMaterialCommand(h.state, first.event.command!, first.event.host, h.authority);
    expect(retry.duplicate).toBe(true); expect(retry.cost).toEqual({ cash: 0, actions: 0, spirituality: 0 }); expect(retry.state).toEqual(h.state);
    expect(() => applyFoolMaterialCommand(h.state, { type: 'PREPARE_COMPOUND', proofId: 'different-intent' }, first.event.host, h.authority)).toThrow('MATERIAL_EVENT_ID_CONFLICT');
    const otherHost = h.host('base', first.event.host.proof);
    expect(() => applyFoolMaterialCommand(h.state, first.event.command!, otherHost, h.authority)).toThrow('MATERIAL_PROOF_ALREADY_SPENT');
  });
  it('rejects insufficient resources, unauthorized host facts, backward time and mutated replay receipts atomically', () => {
    const h = new Harness(), id = FOOL_SOURCE_MATERIAL_IDS[2]!; h.resources.cash = 0;
    const before = stableStringify(h.state);
    expect(() => h.supply(id)).toThrow('MATERIAL_INSUFFICIENT_RESOURCES'); expect(stableStringify(h.state)).toBe(before);
    const host = h.host(); host.resources.cash = 1_000_000;
    expect(() => applyFoolMaterialCommand(h.state, { type: 'PREPARE_COMPOUND', proofId: 'unused-proof' }, host, h.authority)).toThrow('UNVERIFIED_HOST_WITNESS');
    h.resources.cash = 100_000; h.prepare();
    expect(validateFoolMaterials(h.state, h.authority)).toBe(true);
    expect(replayFoolMaterials(h.source, h.state.journal, h.authority)).toEqual(h.state);
    const corrupted = structuredClone(h.state); corrupted.journal[0]!.cost.cash = 0;
    expect(validateFoolMaterials(corrupted, h.authority)).toBe(false);
    const invented = structuredClone(h.state); invented.items[0]!.disposition = 'PLAYER_HELD';
    expect(validateFoolMaterials(invented, h.authority)).toBe(false);
    const badHost = h.host(); badHost.week--; badHost.date = addGameWeeks(h.source.checkpoint.date, badHost.week - h.source.checkpoint.week); h.registerHost(badHost);
    expect(() => applyVerifiedFoolConsumption(h.state, h.outcome('FAILURE').receipt, badHost, h.authority)).toThrow('MATERIAL_EVENT_TIME');
  });
  it('bridges three real failed S1 command receipts then recovery of original one and successful new bottle, without a fourth characteristic', () => {
    const source = recoveredSuccessfulSource(), o = recoveryOrigin(source), frozen = stableStringify(o.sourceSnapshot);
    expect(verifyFoolS1SourceReplay(o, source)).toBe(true);
    const h = new Harness(o); h.authority.verifyOrigin = value => h.origins.has(hash(value)) && verifyFoolS1SourceReplay(value, source);
    h.state = createFoolMaterials(o, h.authority);
    expect(h.state.items.slice(0, 3).map(i => i.disposition)).toEqual(['INTEGRATED_PLAYER', 'UNLOCATED_REJECTION', 'UNLOCATED_REJECTION']);
    expect(h.item(FOOL_SOURCE_MATERIAL_IDS[0]!)).toMatchObject({ sourceBatchId: 'attendant-mysteries-batch-1', sourceBottleId: 'attendant-mysteries-batch-4:bottle',
      sourceConsumption: { outcome: source.attendantMysteries.bottles.at(-1)!.outcome } });
    expect(new Set(h.state.items.filter(i => i.kind === 'CHARACTERISTIC').map(i => i.id)).size).toBe(3);
    expect(h.state.origin.sourceSnapshot.batches).toHaveLength(4); expect(h.state.origin.sourceSnapshot.bottles).toHaveLength(4);
    expect(h.state.origin.sourceSnapshot.batches.slice(0, 3).every(b => b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0))).toBe(true);
    h.prepare(); expect(h.state.compounds[0]!.integratedMaterialId).toBe(FOOL_SOURCE_MATERIAL_IDS[0]);
    expect(stableStringify(h.state.origin.sourceSnapshot)).toBe(frozen);
  }, 30_000);
  it('rejects forged recovery mapping through both existing acquisition replay and independent identity-chain checks', () => {
    const good = recoveredSuccessfulSource();
    const mutations: Array<(s: SliceState) => void> = [
      s => { s.attendantMysteries.batches[3]!.recovery!.characteristicId = FOOL_SOURCE_MATERIAL_IDS[1]!; },
      s => { s.attendantMysteries.batches[3]!.recovery!.sourceBottleId = 'attendant-mysteries-batch-2:bottle'; },
      s => { s.attendantMysteries.batches[3]!.recovery!.plot = 'new-flint-clearing'; },
      s => { s.attendantMysteries.batches[3]!.recovery!.recoveredWeek = s.attendantMysteries.batches[3]!.recovery!.requestedWeek; },
      s => { s.attendantMysteries.acquisitionJournal.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!.after.cash++; },
      s => { s.attendantMysteries.acquisitionJournal.find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!.townEvidence = null; },
      s => { s.attendantMysteries.batches[0]!.materials[0]!.holder = 'PLAYER'; s.attendantMysteries.batches[0]!.materials[0]!.quantity = 1; },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(good); mutate(bad); const o = recoveryOrigin(bad);
      expect(validateAttendantMysteriesAcquisitionJournal(bad)).toBe(false); expect(verifyFoolS1SourceReplay(o, bad)).toBe(false);
      // Also exercise the independent structural checks, even with a deliberately
      // permissive test registry. Production must never skip the replay above.
      expect(() => new Harness(o)).toThrow();
    }
  }, 30_000);
  it('rejects recovery forks and unsupported independent LEGACY-4 without silently renaming any original', () => {
    const source = recoveredSuccessfulSource(), o = recoveryOrigin(source), h = new Harness(o);
    const fork = structuredClone(o), copied = structuredClone(fork.sourceSnapshot.batches[3]!);
    copied.id = 'attendant-mysteries-batch-5'; copied.acquiredWeek = null; copied.brewedWeek = null;
    copied.materials = copied.materials.map((m, i) => ({ ...m, id: i === 0 ? m.id : `attendant-mysteries-batch-5:spirit-specialty-${i}`,
      holder: i === 0 ? 'PLAYER' as const : 'SUPPLIER' as const, quantity: 1 }));
    fork.sourceSnapshot.batches.push(copied); fork.snapshotDigest = foolS1SnapshotDigest(fork.sourceSnapshot); h.trustOrigin(fork);
    expect(() => createFoolMaterials(fork, h.authority)).toThrow('S1_RECOVERY_SOURCE_MUST_BE_LATEST_SINGLE_FAILED_ORIGINAL');
    const legacy = structuredClone(o); delete legacy.sourceSnapshot.batches[3]!.recovery;
    const originalBytes = stableStringify(legacy.sourceSnapshot); legacy.snapshotDigest = foolS1SnapshotDigest(legacy.sourceSnapshot); h.trustOrigin(legacy);
    expect(() => createFoolMaterials(legacy, h.authority)).toThrow('UNSUPPORTED_S1_LINEAGE');
    expect(stableStringify(legacy.sourceSnapshot)).toBe(originalBytes);
  }, 30_000);
  it('carries the same base-prepared bottle through actual registered legs before consuming at new alder', () => {
    const h = new Harness(); h.prepare('base');
    const originalBytes = stableStringify(h.state.origin), bottle = h.state.compounds[0]!, bottleId = bottle.id;
    const missingTravel = h.outcome('SUCCESS');
    expect(() => applyVerifiedFoolConsumption(h.state, missingTravel.receipt, missingTravel.host, h.authority)).toThrow('SAME_PREPARED_COMPOUND_REQUIRED');
    for (const to of ['quarry', 'new-alder-clearing']) {
      const { receipt, host } = h.transport(to), next = applyVerifiedFoolTransport(h.state, receipt, host, h.authority);
      expect(next.cost).toEqual({ cash: 0, actions: 0, spirituality: 0 });
      expect(next.event.resourcesAfter).toEqual(receipt.resourcesAfter);
      h.state = next.state; h.resources = { ...next.event.resourcesAfter };
      expect(h.state.compounds).toHaveLength(1);
      expect(h.state.compounds[0]).toMatchObject({ id: bottleId, preparedLocationId: 'base', locationId: to, status: 'PREPARED' });
      expect(h.state.items.filter(i => i.disposition === 'COMMITTED')).toHaveLength(3);
      expect(h.state.items.filter(i => i.disposition === 'COMMITTED').every(i => i.containerId === bottleId && i.locationId === to)).toBe(true);
      expect(h.state.items.filter(i => i.disposition === 'INTEGRATED_PLAYER')).toHaveLength(1);
    }
    const result = h.settle('SUCCESS');
    expect(result.state.compounds[0]).toMatchObject({ id: bottleId, preparedLocationId: 'base', locationId: 'new-alder-clearing', status: 'CONSUMED' });
    expect(stableStringify(result.state.origin)).toBe(originalBytes);
    expect(replayFoolMaterials(h.source, h.state.journal, h.authority)).toEqual(h.state);
  });
  it('does not authorize an unregistered travel, omitted verifier, or a public coordinate-changing command', () => {
    const h = new Harness(); h.prepare('base'); const { receipt, host } = h.transport('new-alder-clearing');
    const unauthorized = structuredClone(receipt); unauthorized.endSecond++;
    expect(() => applyVerifiedFoolTransport(h.state, unauthorized, host, h.authority)).toThrow('UNVERIFIED_CENTRAL_TRANSPORT');
    const { verifyTransport: _, ...oldAuthority } = h.authority;
    expect(() => applyVerifiedFoolTransport(h.state, receipt, host, oldAuthority)).toThrow('UNVERIFIED_CENTRAL_TRANSPORT');
    expect(validateFoolMaterialCommand({ type: 'TRANSPORT', compoundId: receipt.compoundId, to: 'new-alder-clearing' })).toBe(false);
    expect(h.state.compounds[0]!.locationId).toBe('base');
  });
  it('rejects forged origin, actor, bottle, departure, contents, time and paid-resource bindings even in a permissive unit registry', () => {
    const h = new Harness(); h.prepare('base'); const { receipt, host } = h.transport('new-alder-clearing');
    const mutations: ((r: FoolMaterialTransportReceipt) => void)[] = [
      r => { r.originDigest = 'other-origin'; }, r => { r.actorId = 'other-body'; },
      r => { r.sourceEventId = 'other-travel'; }, r => { r.compoundId = 'copied-bottle'; },
      r => { r.fromLocationId = 'unvisited-place'; }, r => { r.toLocationId = 'wrong-arrival'; },
      r => { r.containedItemIds[0] = h.state.compounds[0]!.integratedMaterialId; },
      r => { r.containedItemIds.push(r.containedItemIds[0]!); }, r => { r.endSecond = r.startSecond; },
      r => { r.resourcesAfter.actions++; }, r => { r.resourcesBefore.cash = r.resourcesAfter.cash - 1; },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(receipt); mutate(bad); h.transports.set(bad.id, hash(bad));
      expect(() => applyVerifiedFoolTransport(h.state, bad, host, h.authority)).toThrow();
      expect(h.state.compounds[0]!.locationId).toBe('base');
    }
  });
  it('records transport once and rejects a changed retry, reused receipt or journal-only coordinate rewrite', () => {
    const h = new Harness(); h.prepare('base'); const { receipt, host } = h.transport('new-alder-clearing');
    const next = applyVerifiedFoolTransport(h.state, receipt, host, h.authority); h.state = next.state; h.resources = { ...next.event.resourcesAfter };
    const retry = applyVerifiedFoolTransport(h.state, receipt, host, h.authority);
    expect(retry.duplicate).toBe(true); expect(retry.cost).toEqual({ cash: 0, actions: 0, spirituality: 0 });
    expect(retry.state).toEqual(h.state);
    const conflict = structuredClone(receipt); conflict.endSecond++;
    expect(() => applyVerifiedFoolTransport(h.state, conflict, host, h.authority)).toThrow('MATERIAL_EVENT_ID_CONFLICT');
    const second = h.transport('base'); second.receipt.id = receipt.id; h.transports.set(second.receipt.id, hash(second.receipt));
    // Restore the original receipt's registry entry so the historical replay is
    // valid; an otherwise permissive verifier still cannot reuse the identity.
    h.transports.set(receipt.id, hash(receipt));
    expect(() => applyVerifiedFoolTransport(h.state, second.receipt, second.host, { ...h.authority, verifyTransport: () => true })).toThrow('TRANSPORT_RECEIPT_ALREADY_SPENT');
    const edited = structuredClone(h.state); edited.compounds[0]!.preparedLocationId = 'new-alder-clearing';
    expect(validateFoolMaterials(edited, h.authority)).toBe(false);
    edited.compounds[0]!.preparedLocationId = 'base'; edited.compounds[0]!.locationId = 'base';
    expect(validateFoolMaterials(edited, h.authority)).toBe(false);
  });
  it('cannot transport a consumed bottle or move after the central actor actually dies', () => {
    for (const dead of [false, true]) {
      const h = new Harness(); h.prepare(); h.settle('FAILURE', dead);
      const { receipt, host } = h.transport('base');
      expect(() => applyVerifiedFoolTransport(h.state, receipt, host, h.authority)).toThrow(dead ? 'LIVING_S1_REQUIRED' : 'SAME_PREPARED_TRANSPORT_BOTTLE_REQUIRED');
    }
  });
  it('projects natural visible material facts and prices without seed, die, private source history or controller authorization', () => {
    const h = new Harness(), view = JSON.stringify(projectFoolMaterials(h.state));
    for (const hidden of ['sourceSnapshot', 'snapshotDigest', 'randomBefore', 'randomAfter', 'roll', 'seed', 'verifyConsumption', 'sourceHistoryDigest']) expect(view).not.toContain(hidden);
    expect(view).toContain('原失败去向尚未查明'); expect(view).toContain('查封与运输服务');
  });
});


/** Serialization-only carrier around the existing directed material harness.
 * These roots are not natural central replay states or campaign evidence. */
describe('Fool replay canonical bytes across existing material constructions', () => {
  it('matches strings and SHA after each success/failure service, transport and consumption', () => {
    const originalSource = createFoolSource(migrateSliceState(structuredClone(original())));
    for (const outcome of [{ result: 'SUCCESS', dead: false }, { result: 'FAILURE', dead: false }, { result: 'FAILURE', dead: true }] as const) {
      const h = new Harness(), carrier = createFoolState();
      carrier.source = structuredClone(originalSource); carrier.materials = h.state;
      const serialize = createOwnedFoolReplayCanonical(carrier);
      const check = (): void => {
        carrier.materials = h.state;
        const { journal: _journal, ...rest } = carrier, expected = stableStringify(rest), actual = serialize();
        expect(actual).toBe(expected); expect(sha256Hex(actual)).toBe(sha256Hex(expected));
      };
      check();
      const act = h.act.bind(h);
      h.act = (...args: Parameters<Harness['act']>) => { const result = act(...args); check(); return result; };
      const rejected = h.state.items.find(item => item.disposition === 'UNLOCATED_REJECTION')!;
      h.act('TRACE_REJECTION', rejected.id, { kind: 'TRACE', sourceEventId: rejected.sourceConsumption!.eventId,
        result: 'NOT_FOUND', foundAt: null, completeAndRecoverable: false }, rejected.lastKnownLocationId!);
      h.prepare('base'); // Existing successful trace/extract/seal, handoffs and preparation.
      for (const to of ['quarry', 'new-alder-clearing']) {
        const { receipt, host } = h.transport(to), next = applyVerifiedFoolTransport(h.state, receipt, host, h.authority);
        h.state = next.state; h.resources = { ...next.event.resourcesAfter }; check();
      }
      h.settle(outcome.result, outcome.dead); check();
      expect(h.state.compounds[0]!.status).toBe('CONSUMED');
      expect(h.state.status).toBe(outcome.dead ? 'DEAD' : 'ACTIVE');
      expect(replayFoolMaterials(h.source, h.state.journal, h.authority)).toEqual(h.state);
    }
  }, 90_000);
});


describe('Fool one-replay material cursor, directed equivalence only', () => {
  const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
  const compareHistory = (h: Harness): void => {
    const cursor = createFoolMaterialReplayCursor(h.source, h.authority);
    let strict = createFoolMaterials(h.source, h.authority);
    for (const entry of h.state.journal) {
      const inputs = structuredClone(entry);
      const expected = entry.kind === 'COMMAND' ? applyFoolMaterialCommand(strict, entry.command!, entry.host, h.authority) :
        entry.kind === 'CONSUMPTION' ? applyVerifiedFoolConsumption(strict, entry.consumption!, entry.host, h.authority) :
        applyVerifiedFoolTransport(strict, entry.transport!, entry.host, h.authority);
      const actual = entry.kind === 'COMMAND' ? cursor.command(entry.command!, entry.host, h.authority) :
        entry.kind === 'CONSUMPTION' ? cursor.consume(entry.consumption!, entry.host, h.authority) :
        cursor.transport(entry.transport!, entry.host, h.authority);
      same(actual, expected); same(actual.event, entry); same(entry, inputs);
      strict = expected.state; same(cursor.snapshot(), strict);
    }
    same(cursor.snapshot(), h.state); expect(validateFoolMaterials(cursor.snapshot(), h.authority)).toBe(true);
    same(replayFoolMaterials(h.source, h.state.journal, h.authority), h.state);
  };

  it.each([['SUCCESS', false], ['FAILURE', false], ['FAILURE', true]] as const)(
    'matches every strict state, fee and receipt through transport and %s (dead=%s)', (outcome, dead) => {
      const h = new Harness(), originalSource = structuredClone(h.source);
      // Paid failure and successful original-residue recovery both use the same
      // real material reducer. These registry facts are directed test data only.
      const item = h.item(FOOL_SOURCE_MATERIAL_IDS[0]!);
      h.act('TRACE_REJECTION', item.id, { kind: 'TRACE', sourceEventId: item.sourceConsumption!.eventId,
        result: 'NOT_FOUND', foundAt: null, completeAndRecoverable: false }, item.lastKnownLocationId!);
      h.supply(FOOL_SOURCE_MATERIAL_IDS[2]!, true); h.prepare();
      for (const place of ['quarry', 'new-alder-clearing']) {
        const { receipt, host } = h.transport(place), next = applyVerifiedFoolTransport(h.state, receipt, host, h.authority);
        h.state = next.state; h.resources = { ...next.event.resourcesAfter };
        expect(next.cost).toEqual({ cash: 0, actions: 0, spirituality: 0 });
      }
      h.settle(outcome, dead); compareHistory(h); same(h.source, originalSource);
      const labourHandoff = h.state.journal.find(e => e.command?.type === 'SUPPLIER_HANDOFF')!;
      expect(labourHandoff.cost).toEqual(FOOL_MATERIAL_COSTS.SUPPLIER_LABOUR_BALANCE);
    }, 15_000);

  it('accepts only verified original construction and imports no saved-state prefix', () => {
    const h = new Harness(), source = structuredClone(h.source), cursor = createFoolMaterialReplayCursor(source, h.authority);
    expect(Object.isFrozen(cursor)).toBe(true); same(cursor.snapshot(), h.state);
    expect(() => createFoolMaterialReplayCursor(h.state as unknown as FoolMaterialsOrigin, h.authority)).toThrow();
    expect(() => createFoolMaterialReplayCursor(source, { ...h.authority, verifyOrigin: () => false })).toThrow('UNVERIFIED_MATERIAL_ORIGIN');
    source.sourceSnapshot.batches[0]!.materials[0]!.id = 'forged-fourth-original';
    expect(() => createFoolMaterialReplayCursor(source, h.authority)).toThrow('UNVERIFIED_MATERIAL_ORIGIN');
    same(cursor.snapshot(), h.state);
    h.supply(FOOL_SOURCE_MATERIAL_IDS[2]!);
    const fresh = createFoolMaterialReplayCursor(h.source, h.authority);
    expect(fresh.snapshot().journal).toHaveLength(0); same(fresh.snapshot(), cursor.snapshot());
  });

  it('checks each current host, receipt, ordering and duplicate without advancing on rejection', () => {
    const h = new Harness(), cursor = createFoolMaterialReplayCursor(h.source, h.authority), id = FOOL_SOURCE_MATERIAL_IDS[2]!;
    h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step: 0, task: FOOL_SUPPLIER_WORK[0] }, 'base');
    const first = h.state.journal[0]!, before = cursor.snapshot();
    const badHost = structuredClone(first.host); badHost.resources.cash++;
    expect(() => cursor.command(first.command!, badHost, h.authority)).toThrow('UNVERIFIED_HOST_WITNESS');
    expect(() => cursor.command(first.command!, first.host, { ...h.authority, verifyWorldReceipt: () => false })).toThrow('UNVERIFIED_WORLD_RECEIPT');
    same(cursor.snapshot(), before);
    cursor.command(first.command!, first.host, h.authority); const accepted = cursor.snapshot();
    expect(() => cursor.command(first.command!, first.host, h.authority)).toThrow('MATERIAL_REPLAY_MISMATCH');
    expect(() => cursor.command({ ...first.command!, proofId: 'different-proof' }, first.host, h.authority)).toThrow('MATERIAL_EVENT_ID_CONFLICT');
    h.act('SUPPLIER_WORK', id, { kind: 'SUPPLIER_WORK', sourceEventId: h.item(id).legacySourceId, step: 1, task: FOOL_SUPPLIER_WORK[1] }, 'base');
    const second = h.state.journal[1]!, oldHost = structuredClone(second.host); oldHost.revision = first.host.revision; h.registerHost(oldHost);
    expect(() => cursor.command(second.command!, oldHost, h.authority)).toThrow('MATERIAL_EVENT_TIME');
    h.registerHost(second.host);
    expect(() => cursor.command(second.command!, second.host, { ...h.authority, verifyHost: () => false })).toThrow('UNVERIFIED_HOST_WITNESS');
    same(cursor.snapshot(), accepted); same(cursor.command(second.command!, second.host, h.authority).state, h.state);
  });

  it('never exposes the owned prefix through caller inputs, snapshots or returned transitions', () => {
    const h = new Harness(), cursor = createFoolMaterialReplayCursor(h.source, h.authority), id = FOOL_SOURCE_MATERIAL_IDS[2]!;
    h.supply(id); const entry = structuredClone(h.state.journal[0]!);
    const result = cursor.command(entry.command!, entry.host, h.authority), expected = cursor.snapshot();
    result.state.origin.sourceSnapshot.batches[0]!.materials[0]!.id = 'forged-result-origin';
    result.state.items.length = 0; result.state.journal.length = 0; result.event.cost.cash++; result.cost.actions++;
    entry.host.proof!.id = 'forged-proof'; entry.host.resources.cash++; entry.command!.proofId = 'forged-command';
    const snapshot = cursor.snapshot(); snapshot.journal[0]!.host.resources.cash++; snapshot.origin.actorId = 'another-actor';
    same(cursor.snapshot(), expected);
    const fresh = createFoolMaterialReplayCursor(h.source, h.authority); expect(fresh.snapshot().journal).toHaveLength(0);
  });

  it('leaves all standalone saved-state APIs strict after a cursor call', () => {
    const h = new Harness(); h.prepare(); compareHistory(h);
    const { receipt, host } = h.outcome('FAILURE'), travel = h.transport('quarry');
    const mutations: Array<(state: FoolMaterialsState) => void> = [
      state => { state.journal[0]!.host.resources.cash++; },
      state => { state.items[0]!.lastProofId = 'forged'; },
      state => { state.origin.snapshotDigest = 'forged'; },
      state => { state.journal.reverse(); },
      state => { state.journal.push(structuredClone(state.journal[0]!)); },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(h.state); mutate(bad);
      expect(validateFoolMaterials(bad, h.authority)).toBe(false);
      expect(() => applyFoolMaterialCommand(bad, { type: 'PREPARE_COMPOUND', proofId: 'unused' }, host, h.authority)).toThrow('INVALID_MATERIAL_LEDGER');
      expect(() => applyVerifiedFoolConsumption(bad, receipt, host, h.authority)).toThrow('INVALID_MATERIAL_LEDGER');
      expect(() => applyVerifiedFoolTransport(bad, travel.receipt, travel.host, h.authority)).toThrow('INVALID_MATERIAL_LEDGER');
    }
    expect(validateFoolMaterials(h.state, h.authority)).toBe(true);
  });
});
