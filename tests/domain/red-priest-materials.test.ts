import { describe, expect, it } from 'vitest';
import {
  applyRedPriestMaterialConsumption, createRedPriestMaterials, projectRedPriestMaterials,
  redPriestMaterialBlock, reduceRedPriestMaterials, transportRedPriestMaterials,
  validateRedPriestMaterialCommand, validateRedPriestMaterials,
  type RedPriestMaterialActor, type RedPriestMaterialAuthority, type RedPriestMaterialCheckReceipt,
  type RedPriestMaterialCommand, type RedPriestMaterialConsumptionReceipt, type RedPriestMaterialDestination,
  type RedPriestMaterialFrame, type RedPriestMaterialHost, type RedPriestMaterialsOrigin,
  type RedPriestMaterialTransportReceipt, type RedPriestMaterialsState,
} from '../../src/domain/red-priest/materials.js';
import {
  RED_PRIEST_CHARACTERISTIC_IDS as IDS, RED_PRIEST_MATERIAL_IDS as ALL_IDS,
  RED_PRIEST_MATERIAL_LOCATIONS as LOC, RED_PRIEST_PRIOR_CONSUMPTIONS,
  RED_PRIEST_RELIC_CUSTODY, RED_PRIEST_SOURCE_CASE, RED_PRIEST_SOURCE_SHA256,
  RED_PRIEST_SUPPLIER_LEADS, RED_PRIEST_UNIQUENESS_ID as UNIQUE,
  redPriestCompoundSupply,
} from '../../src/domain/red-priest/material-content.js';

const clone = <T>(v: T): T => structuredClone(v);
const key = (v: unknown): string => JSON.stringify(v);
const hash = 'a'.repeat(64);
const ACTOR = 'original-player';
const actor = (): RedPriestMaterialActor => ({ status: 'ACTIVE', sequence: 1, health: 80, mind: 100, pollution: 0, injuryIds: ['old-light-1', 'old-light-2'] });
/** Small receipts derived from the supplied 187795 checkpoint facts. No large
 * save, original prose, fixture mutation, or invented fourth source is loaded. */
function origin(): RedPriestMaterialsOrigin {
  return { version: 1, caseId: RED_PRIEST_SOURCE_CASE, actorId: ACTOR, sourceSnapshotDigest: hash,
    sourceDigest: hash, bottlesDigest: hash, acquisitionJournalDigest: hash,
    checkpoint: { week: 200, revision: 780, locationId: LOC.archive },
    bottles: RED_PRIEST_PRIOR_CONSUMPTIONS.map((p, i) => ({ ...p, eventId: `original-consumption:${p.revision}`, sourceDigest: hash,
      acquisitionEventDigest: hash, status: 'CONSUMED' as const, integratedActorId: i === 2 ? ACTOR : null })),
    uniqueness: { id: UNIQUE, incumbentActorId: null, custody: clone([...RED_PRIEST_RELIC_CUSTODY]) } };
}
class Host {
  state: RedPriestMaterialsState;
  readonly authority: RedPriestMaterialAuthority;
  readonly knownFrames = new Set<string>();
  readonly knownEvidence = new Set<string>();
  readonly knownConsumptions = new Set<string>();
  readonly knownTravel = new Set<string>();
  week: number; revision: number; location: string;
  currentActor = actor();
  budget = { cash: 2400, actions: 100, spirituality: 120 };
  constructor(readonly original = origin()) {
    const frozen = key(original);
    this.authority = {
      verifyOrigin: v => key(v) === frozen,
      verifyHost: f => this.knownFrames.has(key(f)),
      verifyEvidence: r => this.knownEvidence.has(key(r)),
      verifyConsumption: r => this.knownConsumptions.has(key(r)),
      verifyTransport: r => this.knownTravel.has(key(r)),
    };
    this.state = createRedPriestMaterials(original, this.authority);
    this.week = original.checkpoint.week; this.revision = original.checkpoint.revision; this.location = original.checkpoint.locationId;
  }
  frame(): RedPriestMaterialFrame {
    return { week: this.week, revision: ++this.revision, eventId: `event:${this.revision}`, actorId: ACTOR,
      originDigest: this.state.originDigest, locationId: this.location, actor: clone(this.currentActor), resources: clone(this.budget), evidence: null };
  }
  trusted(f: RedPriestMaterialFrame): RedPriestMaterialHost {
    this.knownFrames.add(key(f)); if (f.evidence) this.knownEvidence.add(key(f.evidence));
    return { ...clone(f), authority: this.authority };
  }
  base(f: RedPriestMaterialFrame) {
    return { id: `receipt:${f.eventId}`, eventId: f.eventId, originDigest: f.originDigest, actorId: f.actorId,
      locationId: f.locationId, week: f.week, revision: f.revision };
  }
  later() { this.week++; this.budget.actions = 100; }
  travel(to: string) {
    if (to === this.location) return;
    const from = this.location; this.location = to;
    const f = this.frame();
    const r: RedPriestMaterialTransportReceipt = { ...this.base(f), sourceTravelReceiptId: `travel:${f.eventId}`,
      fromLocationId: from, toLocationId: to, departedWeek: this.week, arrivedWeek: this.week,
      carried: this.state.items.filter(i => i.holderId === ACTOR && ['INTEGRATED_PLAYER', 'PLAYER_HELD', 'IN_COMPOUND', 'INTEGRATED_S0'].includes(i.disposition))
        .map(i => ({ itemId: i.id, containerId: i.containerId! })) };
    this.knownTravel.add(key(r));
    const result = transportRedPriestMaterials(this.state, this.trusted(f), r);
    this.state = result.state;
    return { f, r, result };
  }
  check(command: RedPriestMaterialCommand, change: Partial<RedPriestMaterialCheckReceipt> = {}) {
    if (command.type === 'PREPARE_COMPOUND') throw new Error('check requires a material action');
    const f = this.frame(), item = this.state.items.find(i => i.id === ('itemId' in command ? command.itemId : UNIQUE))!;
    const custody = RED_PRIEST_RELIC_CUSTODY.at(-1)!;
    const lead = RED_PRIEST_SUPPLIER_LEADS.find(l => l.itemId === item.id);
    let materialLocationId = item.locationId, containerId = item.containerId, custodianId = item.holderId;
    let contaminationAfter = item.contamination, custodyRecordId: string | null = null;
    if (command.type === 'TRACE_DISPOSITION' && item.disposition === 'UNLOCATED') {
      materialLocationId = lead!.locationId; containerId = lead!.containerId; custodianId = lead!.custodianId;
      contaminationAfter = 30; custodyRecordId = lead!.leadId;
    } else if (command.type === 'TRACE_DISPOSITION') custodyRecordId = item.sourceEventId;
    if (command.type === 'PURIFY_REMAINS') contaminationAfter = 0;
    if (['INSPECT_RELIC', 'VERIFY_RELIC', 'TRANSFER_RELIC'].includes(command.type)) custodyRecordId = custody.id;
    const r: RedPriestMaterialCheckReceipt = { ...this.base(f), kind: 'MATERIAL_CHECK', action: command.type,
      itemId: item.id, sourceEventId: item.sourceEventId, checkReceiptId: `check:${f.eventId}`, result: 'SUCCESS',
      containerId, materialLocationId, custodianId, contaminationBefore: item.contamination, contaminationAfter,
      recoverable: true, custodyRecordId, actorAfter: clone(this.currentActor), ...clone(change) };
    f.evidence = r;
    return { f, r, host: this.trusted(f) };
  }
  act(command: RedPriestMaterialCommand, change: Partial<RedPriestMaterialCheckReceipt> = {}) {
    let host: RedPriestMaterialHost;
    if (command.type === 'PREPARE_COMPOUND') {
      const f = this.frame(), supply = redPriestCompoundSupply(this.state.compounds.length + 1, this.original.checkpoint.week)!;
      f.evidence = { ...this.base(f), kind: 'COMPOUND_SUPPLY', batchId: supply.batchId, providerId: supply.providerId, chargedCash: 120, inputs: supply.inputs };
      host = this.trusted(f);
    } else host = this.check(command, change).host;
    const result = reduceRedPriestMaterials(this.state, command, host);
    this.state = result.state; this.budget = clone(result.receipt.resourcesAfter); this.currentActor = clone(result.actorAfter);
    return result;
  }
  recoverOriginal(id: string) {
    this.travel(LOC.archive); this.act({ type: 'TRACE_DISPOSITION', itemId: id }); this.later();
    this.travel(this.state.items.find(i => i.id === id)!.locationId!);
    this.act({ type: 'VERIFY_CONTAINER', itemId: id });
    if (this.state.items.find(i => i.id === id)!.disposition === 'VERIFIED_DIRTY') {
      this.later(); this.act({ type: 'PURIFY_REMAINS', itemId: id });
    }
    this.act({ type: 'TRANSFER_CUSTODY', itemId: id });
  }
  acquireAll() {
    for (const item of [...this.state.items].filter(i => i.kind === 'CHARACTERISTIC' && !['INTEGRATED_PLAYER', 'PLAYER_HELD'].includes(i.disposition))) this.recoverOriginal(item.id);
    this.travel(LOC.relicArchive); this.act({ type: 'INSPECT_RELIC' }); this.later();
    this.travel(LOC.relicVault); this.act({ type: 'VERIFY_RELIC' }); this.later(); this.act({ type: 'TRANSFER_RELIC' });
    this.travel(LOC.workshop);
  }
  consumption(outcome: 'SUCCESS' | 'FAILURE', death = false) {
    const f = this.frame(), compound = this.state.compounds.at(-1)!;
    const after: RedPriestMaterialActor = outcome === 'SUCCESS' ? { ...clone(f.actor), sequence: 0, mind: f.actor.mind - 15 } :
      { ...clone(f.actor), health: death ? 0 : 45, mind: death ? 0 : 60, pollution: 30, injuryIds: [...f.actor.injuryIds, 'actual-promotion-injury'], status: death ? 'DEAD' : 'ACTIVE' };
    const destinations: RedPriestMaterialDestination[] = this.state.items.map(item => outcome === 'SUCCESS' ?
      { itemId: item.id, disposition: 'INTEGRATED_S0', locationId: this.location, containerId: `body:${ACTOR}`, holderId: ACTOR, contamination: 0, recoverable: false } :
      item.disposition === 'INTEGRATED_PLAYER' && !death ?
        { itemId: item.id, disposition: 'INTEGRATED_PLAYER', locationId: this.location, containerId: `body:${ACTOR}`, holderId: ACTOR, contamination: 0, recoverable: false } :
        { itemId: item.id, disposition: 'LOCATED_DIRTY', locationId: this.location, containerId: `actual-residue:${f.eventId}:${item.id}`, holderId: 'workshop:keeper', contamination: 30, recoverable: true });
    const r: RedPriestMaterialConsumptionReceipt = { ...this.base(f), compoundId: compound.id, itemIds: [...ALL_IDS], outcome,
      formulaReceiptId: 'actual-formula-investigation:completed', warAchievementReceiptId: 'actual-continental-war:won',
      checkReceiptId: `real-promotion-check:${f.eventId}`, actorBefore: clone(f.actor), actorAfter: after, destinations };
    this.knownConsumptions.add(key(r));
    return { f, r, host: this.trusted(f) };
  }
  consume(outcome: 'SUCCESS' | 'FAILURE', death = false) {
    const evidence = this.consumption(outcome, death);
    const result = applyRedPriestMaterialConsumption(this.state, evidence.host, evidence.r);
    this.state = result.state; this.currentActor = clone(result.actorAfter);
    return { ...evidence, result };
  }
}

describe('Red Priest original material conservation prototype', () => {
  it('starts with two unknown failures and one integrated original, without altering old receipts', () => {
    const o = origin(), before = key(o), h = new Host(o);
    expect(RED_PRIEST_SOURCE_SHA256).toBe('469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973');
    expect(h.state.items.map(i => i.disposition)).toEqual(['UNLOCATED', 'UNLOCATED', 'INTEGRATED_PLAYER', 'SEALED_RELIC']);
    expect(h.state.items.filter(i => i.holderId === ACTOR)).toHaveLength(1);
    expect(key(o)).toBe(before);
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
    const publicText = key(projectRedPriestMaterials(h.state));
    expect(publicText).not.toContain(hash); expect(publicText).not.toContain(LOC.firstSeal); expect(publicText).not.toContain(LOC.relicVault);
  });
  it('rejects player proofs, prices, fourth IDs and making the personal characteristic inventory', () => {
    expect(validateRedPriestMaterialCommand({ type: 'TRACE_DISPOSITION', itemId: IDS[0], proof: true })).toBe(false);
    expect(validateRedPriestMaterialCommand({ type: 'PREPARE_COMPOUND', cash: 0 })).toBe(false);
    expect(validateRedPriestMaterialCommand({ type: 'CONSUME', outcome: 'SUCCESS' })).toBe(false);
    expect(validateRedPriestMaterialCommand({ type: 'TRACE_DISPOSITION', itemId: 'conqueror-potion-4:characteristic' })).toBe(false);
    const h = new Host(), f = h.frame();
    expect(redPriestMaterialBlock(h.state, { type: 'TRACE_DISPOSITION', itemId: IDS[2] }, h.trusted(f))).toContain('ORIGINAL_SUPPLIER_OR_FAILURE');
    const fake = clone(h.state); fake.items[2]!.disposition = 'PLAYER_HELD';
    expect(validateRedPriestMaterials(fake, h.authority)).toBe(false);
    fake.items.push(clone(fake.items[0]!));
    expect(() => reduceRedPriestMaterials(fake, { type: 'TRACE_DISPOSITION', itemId: IDS[0]! }, h.trusted(f))).toThrow('INVALID_STATE');
  });
  it('requires actual original-site checks, later weeks, pollution cleanup and an unrepeated handoff', () => {
    const h = new Host(); h.budget.cash = 536;
    const f = h.frame();
    expect(redPriestMaterialBlock(h.state, { type: 'TRACE_DISPOSITION', itemId: IDS[0] }, h.trusted(f))).toBeNull();
    h.act({ type: 'TRACE_DISPOSITION', itemId: IDS[0]! });
    expect(h.state.items[0]!.holderId).not.toBe(ACTOR); expect(h.budget.cash).toBe(506);
    h.travel(LOC.firstSeal);
    expect(() => h.act({ type: 'VERIFY_CONTAINER', itemId: IDS[0]! })).toThrow('LATER_WEEK');
    h.later(); h.act({ type: 'VERIFY_CONTAINER', itemId: IDS[0]! });
    expect(() => h.act({ type: 'TRANSFER_CUSTODY', itemId: IDS[0]! })).toThrow('SEALED_ITEM');
    expect(() => h.act({ type: 'PURIFY_REMAINS', itemId: IDS[0]! })).toThrow('LATER_WEEK');
    h.later(); h.act({ type: 'PURIFY_REMAINS', itemId: IDS[0]! });
    const wrong = h.check({ type: 'TRANSFER_CUSTODY', itemId: IDS[0]! }, { containerId: 'replacement-container' });
    expect(() => reduceRedPriestMaterials(h.state, { type: 'TRANSFER_CUSTODY', itemId: IDS[0]! }, wrong.host)).toThrow('ORIGINAL_SEALED');
    h.act({ type: 'TRANSFER_CUSTODY', itemId: IDS[0]! });
    expect(h.state.items[0]!.containerId).toBe(RED_PRIEST_SUPPLIER_LEADS[0]!.containerId);
    expect(h.budget.cash).toBe(376);
    expect(() => h.act({ type: 'TRANSFER_CUSTODY', itemId: IDS[0]! })).toThrow('ORIGINAL_SEALED');
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('does not accept unverified receipts, remote purification or free costs', () => {
    const h = new Host(); const c = { type: 'TRACE_DISPOSITION', itemId: IDS[0]! } as const;
    const generated = h.check(c); h.knownEvidence.clear();
    expect(() => reduceRedPriestMaterials(h.state, c, generated.host)).toThrow('UNVERIFIED_CHECK');
    h.budget.cash = 29; expect(() => h.act(c)).toThrow('INSUFFICIENT_RESOURCES');
    h.budget.cash = 536; h.act(c); h.later();
    expect(() => h.act({ type: 'VERIFY_CONTAINER', itemId: IDS[0]! })).toThrow('ORIGINAL_SEALED');
    expect(h.state.items[0]!.disposition).toBe('LOCATED_DIRTY');
  });
  it('supports another legal seed and a first-bottle promotion without inventing failed residues', () => {
    const o = origin(); o.caseId = 'another-legitimate-save'; o.checkpoint = { week: 240, revision: 1200, locationId: LOC.archive };
    o.bottles[0] = { ...o.bottles[0]!, week: 220, revision: 1050, outcome: 'GREAT_SUCCESS', roll: 2, chance: 67, integratedActorId: ACTOR };
    o.bottles[1] = { ...o.bottles[1]!, week: 210, revision: 1001, status: 'SUPPLIER', outcome: null, roll: null, chance: null, integratedActorId: null };
    o.bottles[2] = { ...o.bottles[2]!, week: 215, revision: 1020, status: 'PLAYER', outcome: null, roll: null, chance: null, integratedActorId: null };
    const h = new Host(o);
    expect(h.state.items.map(i => i.disposition)).toEqual(['INTEGRATED_PLAYER', 'SUPPLIER_BOTTLED', 'PLAYER_HELD', 'SEALED_RELIC']);
    expect(h.state.items[2]!.containerId).toBe('conqueror-potion-3');
    h.recoverOriginal(IDS[1]!);
    expect(h.state.items[1]!.containerId).toBe('conqueror-potion-2');
    expect(h.state.journal.some(e => e.command?.type === 'PURIFY_REMAINS')).toBe(false);
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('explicitly refuses an unrelated failure, fourth independent bottle, broken custody or second incumbent', () => {
    const o = origin(); o.bottles.push({ ...o.bottles[0]!, bottleId: 'conqueror-potion-4', eventId: 'different-failure' });
    expect(() => new Host(o)).toThrow('UNSUPPORTED_PRIOR_SOURCE');
    const unrelated = origin(); unrelated.bottles[0]!.bottleId = 'some-other-failed-potion';
    expect(() => new Host(unrelated)).toThrow('UNSUPPORTED_PRIOR_SOURCE');
    const broken = origin(); broken.uniqueness.custody[1]!.previousId = 'another-relic';
    expect(() => new Host(broken)).toThrow('UNIQUENESS_CUSTODY');
    const incumbent = origin(); (incumbent.uniqueness as { incumbentActorId: string | null }).incumbentActorId = 'existing-god';
    expect(() => new Host(incumbent)).toThrow('UNIQUENESS_CUSTODY');
  });
  it('moves the same sealed originals and compound, never teleports or omits a carried item', () => {
    const h = new Host(); h.acquireAll(); h.act({ type: 'PREPARE_COMPOUND' });
    const before = clone(h.state), moved = h.travel('continental-front:actual-ritual-site')!;
    expect(h.state.compounds[0]!.id).toBe(before.compounds[0]!.id);
    expect(h.state.items.map(i => i.containerId)).toEqual(before.items.map(i => i.containerId));
    expect(h.state.items.every(i => i.locationId === h.location)).toBe(true);
    const omitted = clone(moved.r); omitted.carried.pop(); h.knownTravel.add(key(omitted));
    expect(() => transportRedPriestMaterials(before, h.trusted(moved.f), omitted)).toThrow('TRANSPORT_ALL_ORIGINALS');
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('consumes exactly the original three characteristics plus uniqueness into one successful terminal body', () => {
    const h = new Host(), frozen = key(h.original); h.acquireAll();
    const prepared = h.act({ type: 'PREPARE_COMPOUND' });
    expect(prepared.consumedInputIds).toHaveLength(3);
    expect(h.state.items.filter(i => i.disposition === 'IN_COMPOUND')).toHaveLength(3);
    const before = clone(h.state), real = h.consumption('SUCCESS');
    const fake = clone(real.r); fake.warAchievementReceiptId = 'player-says-war-won';
    expect(() => applyRedPriestMaterialConsumption(before, real.host, fake)).toThrow('UNVERIFIED_CONSUMPTION');
    const result = applyRedPriestMaterialConsumption(before, real.host, real.r); h.state = result.state;
    expect(h.state.status).toBe('ASCENDED'); expect(h.state.incumbentActorId).toBe(ACTOR);
    expect(h.state.items).toHaveLength(4); expect(new Set(h.state.items.map(i => i.id)).size).toBe(4);
    expect(h.state.items.every(i => i.disposition === 'INTEGRATED_S0' && i.containerId === `body:${ACTOR}`)).toBe(true);
    expect(h.state.compounds[0]!.status).toBe('CONSUMED');
    expect(() => applyRedPriestMaterialConsumption(h.state, real.host, real.r)).toThrow('NOT_ACTIVE');
    expect(key(h.original)).toBe(frozen); expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('transports all four ascended originals in the same living body while leaving consumed potion history at the actual consumption site', () => {
    const h = new Host(); h.acquireAll(); h.act({ type: 'PREPARE_COMPOUND' }); h.consume('SUCCESS');
    const before = clone(h.state), compoundHistory = clone(h.state.compounds), originHistory = clone(h.state.origin);
    const moved = h.travel('continental-front:original-return-route')!;
    expect(h.state.status).toBe('ASCENDED'); expect(h.currentActor.sequence).toBe(0);
    expect(h.state.items.map(i => i.id)).toEqual(before.items.map(i => i.id));
    expect(h.state.items.every(i => i.disposition === 'INTEGRATED_S0' && i.holderId === ACTOR &&
      i.containerId === `body:${ACTOR}` && i.locationId === h.location)).toBe(true);
    expect(h.state.compounds).toEqual(compoundHistory); expect(h.state.compounds[0]!.locationId).toBe(LOC.workshop);
    expect(h.state.origin).toEqual(originHistory); expect(moved.result.cost).toEqual({ cash: 0, actions: 0, spirituality: 0 });
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
    const frame = h.frame();
    expect(redPriestMaterialBlock(h.state, { type: 'PREPARE_COMPOUND' }, h.trusted(frame))).toBe('MATERIAL_NOT_ACTIVE');
    expect(() => reduceRedPriestMaterials(h.state, { type: 'PREPARE_COMPOUND' }, h.trusted(frame))).toThrow('NOT_ACTIVE');
    expect(() => transportRedPriestMaterials(h.state, h.trusted(moved.f), moved.r)).toThrow('STALE_OR_DUPLICATE');

    const rejectReceipt = (change: (r: RedPriestMaterialTransportReceipt) => void, expected: string) => {
      const r = clone(moved.r); change(r); h.knownTravel.add(key(r));
      expect(() => transportRedPriestMaterials(before, h.trusted(moved.f), r)).toThrow(expected);
    };
    rejectReceipt(r => { r.carried.pop(); }, 'TRANSPORT_ALL_ORIGINALS');
    rejectReceipt(r => { r.carried[3] = clone(r.carried[0]!); }, 'TRANSPORT_ALL_ORIGINALS');
    rejectReceipt(r => { r.carried[0]!.itemId = 'conqueror-potion-4:characteristic'; }, 'TRANSPORT_ALL_ORIGINALS');
    rejectReceipt(r => { r.carried[0]!.containerId = 'body:substitute-player'; }, 'TRANSPORT_ALL_ORIGINALS');
    rejectReceipt(r => { r.fromLocationId = 'unvisited:fake-source'; }, 'TRANSPORT_ALL_ORIGINALS');
    rejectReceipt(r => { r.actorId = 'substitute-player'; }, 'EVIDENCE_BINDING');
    rejectReceipt(r => { r.originDigest = 'b'.repeat(64); }, 'EVIDENCE_BINDING');
    for (const change of [
      (f: RedPriestMaterialFrame) => { f.actor.status = 'DEAD'; f.actor.health = 0; },
      (f: RedPriestMaterialFrame) => { f.actor.sequence = 1; },
      (f: RedPriestMaterialFrame) => { f.actorId = 'substitute-player'; },
    ]) {
      const f = clone(moved.f); change(f);
      expect(() => transportRedPriestMaterials(before, h.trusted(f), moved.r)).toThrow('HOST_ACTOR');
    }
    const forged = clone(before); forged.status = 'ACTIVE';
    expect(() => transportRedPriestMaterials(forged, h.trusted(moved.f), moved.r)).toThrow('STATE_DIGEST_MISMATCH');
    const lost = clone(before); lost.items.pop();
    expect(() => transportRedPriestMaterials(lost, h.trusted(moved.f), moved.r)).toThrow('INVALID_STATE');
  });
  it('rejects a forged ascension label or a dead terminal actor before any S0 transport', () => {
    const h = new Host(), forged = clone(h.state); forged.status = 'ASCENDED';
    h.currentActor.sequence = 0; h.location = 'continental-front:forged-arrival';
    const f = h.frame(), r: RedPriestMaterialTransportReceipt = { ...h.base(f), sourceTravelReceiptId: 'fake-travel',
      fromLocationId: LOC.archive, toLocationId: h.location, departedWeek: h.week, arrivedWeek: h.week,
      carried: ALL_IDS.map(itemId => ({ itemId, containerId: `body:${ACTOR}` })) };
    h.knownTravel.add(key(r));
    expect(() => transportRedPriestMaterials(forged, h.trusted(f), r)).toThrow('INITIAL_STATE_MISMATCH');
    const dead = new Host(); dead.acquireAll(); dead.act({ type: 'PREPARE_COMPOUND' }); dead.consume('FAILURE', true);
    dead.location = 'continental-front:dead-arrival'; const df = dead.frame();
    const dr: RedPriestMaterialTransportReceipt = { ...dead.base(df), sourceTravelReceiptId: 'dead-travel',
      fromLocationId: LOC.workshop, toLocationId: dead.location, departedWeek: dead.week, arrivedWeek: dead.week, carried: [] };
    dead.knownTravel.add(key(dr));
    expect(() => transportRedPriestMaterials(dead.state, dead.trusted(df), dr)).toThrow('ACTOR_DEAD');
  });
  it('keeps failed potion, expenses and injuries permanent; real recoverable residues need fresh cleanup and paid supplies', () => {
    const h = new Host(); h.acquireAll(); h.act({ type: 'PREPARE_COMPOUND' });
    const cash = h.budget.cash, firstBottle = h.state.compounds[0]!.id;
    h.consume('FAILURE'); expect(h.currentActor.injuryIds).toContain('actual-promotion-injury'); expect(h.currentActor.health).toBe(45);
    expect(h.state.compounds[0]!.status).toBe('CONSUMED'); expect(h.budget.cash).toBe(cash);
    expect(() => h.act({ type: 'PREPARE_COMPOUND' })).toThrow('TWO_EXTERNAL');
    h.later();
    const residues = h.state.items.filter(i => i.disposition === 'LOCATED_DIRTY'); expect(residues).toHaveLength(3);
    for (const item of residues) h.act({ type: 'VERIFY_CONTAINER', itemId: item.id });
    h.later();
    for (const item of residues) { h.act({ type: 'PURIFY_REMAINS', itemId: item.id }); h.act({ type: 'TRANSFER_CUSTODY', itemId: item.id }); }
    h.act({ type: 'PREPARE_COMPOUND' });
    expect(h.state.compounds).toHaveLength(2); expect(h.state.compounds[1]!.id).not.toBe(firstBottle);
    expect(h.state.compounds[0]!.status).toBe('CONSUMED'); expect(h.budget.cash).toBe(cash - 3 * 130 - 120);
    expect(h.currentActor.injuryIds).toContain('actual-promotion-injury');
    expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('cannot clean up after actual death, and does not promise that all failed materials can be located', () => {
    const h = new Host(); h.acquireAll(); h.act({ type: 'PREPARE_COMPOUND' }); h.consume('FAILURE', true);
    expect(h.state.status).toBe('DEAD'); h.later();
    expect(() => h.act({ type: 'VERIFY_CONTAINER', itemId: IDS[0]! })).toThrow('ACTOR_DEAD');
    expect(h.state.compounds[0]!.status).toBe('CONSUMED'); expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
    const alive = new Host(); alive.acquireAll(); alive.act({ type: 'PREPARE_COMPOUND' });
    const evidence = alive.consumption('FAILURE');
    const missing = evidence.r.destinations.find(d => d.itemId === IDS[0])!;
    Object.assign(missing, { disposition: 'UNAVAILABLE', locationId: null, containerId: null, holderId: null, contamination: null, recoverable: false });
    alive.knownConsumptions.add(key(evidence.r)); alive.state = applyRedPriestMaterialConsumption(alive.state, evidence.host, evidence.r).state;
    expect(alive.state.items[0]!.disposition).toBe('UNAVAILABLE');
    expect(() => alive.act({ type: 'TRACE_DISPOSITION', itemId: IDS[0]! })).toThrow('ORIGINAL_SUPPLIER_OR_FAILURE');
    expect(alive.state.items).toHaveLength(4);
  });
  it('accepts a real non-S1 failure only as blocked, without forcing safe retention or duplicating the body share', () => {
    const h = new Host(); h.acquireAll(); h.act({ type: 'PREPARE_COMPOUND' });
    const actual = h.consumption('FAILURE'); actual.r.actorAfter.sequence = 2;
    const personal = actual.r.destinations.find(d => d.itemId === IDS[2])!;
    Object.assign(personal, { disposition: 'UNAVAILABLE', locationId: null, containerId: null, holderId: null, contamination: null, recoverable: false });
    h.knownConsumptions.add(key(actual.r));
    h.state = applyRedPriestMaterialConsumption(h.state, actual.host, actual.r).state;
    expect(h.state.status).toBe('BLOCKED'); expect(h.state.items.filter(i => i.disposition === 'INTEGRATED_PLAYER')).toHaveLength(0);
    expect(h.state.items).toHaveLength(4); expect(validateRedPriestMaterials(h.state, h.authority)).toBe(true);
  });
  it('failed purification charges once and retains the actual worsening and injuries', () => {
    const h = new Host(); h.act({ type: 'TRACE_DISPOSITION', itemId: IDS[0]! }); h.later(); h.travel(LOC.firstSeal);
    h.act({ type: 'VERIFY_CONTAINER', itemId: IDS[0]! }); h.later();
    const before = clone(h.state), cash = h.budget.cash;
    const check = h.check({ type: 'PURIFY_REMAINS', itemId: IDS[0]! }, { result: 'FAILURE', contaminationAfter: 50,
      actorAfter: { ...actor(), health: 60, injuryIds: [...actor().injuryIds, 'cleaning-burn'] } });
    const result = reduceRedPriestMaterials(before, { type: 'PURIFY_REMAINS', itemId: IDS[0]! }, check.host);
    expect(result.receipt.resourcesAfter.cash).toBe(cash - 70); expect(result.actorAfter.health).toBe(60);
    expect(result.state.items[0]!.disposition).toBe('VERIFIED_DIRTY'); expect(result.state.items[0]!.contamination).toBe(50);
    expect(() => reduceRedPriestMaterials(result.state, { type: 'PURIFY_REMAINS', itemId: IDS[0]! }, check.host)).toThrow('STALE_OR_DUPLICATE');
    expect(validateRedPriestMaterials(result.state, h.authority)).toBe(true);
  });
});
