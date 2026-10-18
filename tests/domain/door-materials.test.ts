import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { starKeyOriginals } from '../../src/domain/star-key/index.js';
import { DOOR_FUTURE_BRANCH, DOOR_MATERIAL_LOCATIONS as LOC, DOOR_MATERIAL_POLICY as POLICY, doorSuccessionAt } from '../../src/domain/door/material-content.js';
import { applyDoorMaterial, createDoorMaterials, getDoorMaterialActions, projectDoorMaterials, settleDoorConsumption,
  transportDoorMaterials, validateDoorMaterialCommand, validateDoorMaterialPolicy, doorMaterialBlock,
  doorMaterialConservationBlock, doorMaterialEffect, doorServiceReceiptsComplete } from '../../src/domain/door/materials.js';
import { createDoorSource, doorAcquisitionSnapshot, doorSourceBlock, validateDoorSource } from '../../src/domain/door/source.js';
import { resolveDoorOriginals } from '../../src/domain/door/originals.js';
import { DOOR_CARRIER_IDS, DOOR_LABOUR_IDS, DOOR_ORIGINAL_IDS, DOOR_UNIQUENESS_ID,
  type DoorCarrierId, type DoorMaterialCommand, type DoorMaterialHost, type DoorMaterialPolicy,
  type DoorMaterialsState, type DoorMaterialSettlement, type DoorOriginalId, type DoorServiceReceipt } from '../../src/domain/door/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const PATH = 'tests/fixtures/star-key-v01960/natural.json';
let cache: SliceState | undefined;
const actual = () => structuredClone(cache ??= readObjectEntry<SliceState>(PATH, 'final'));
const original = (n: 1 | 2 | 3): DoorOriginalId => `star-key-potion-${n}`;
const services = (): DoorServiceReceipt[] => POLICY.serviceIds.map((serviceId, i) => ({ serviceId,
  residentId: `component-resident-${i}`, apparatusId: `component-apparatus-${i}`,
  passedEventId: `component-passed-${i}`, reviewedEventId: `component-reviewed-${i}`, passedWeek: 218, reviewedWeek: 218 }));
/** Component-only host passage/budget inputs. Natural integration must derive
 * every host fact from committed chapter events; these are not public tokens. */
function harness() {
  const source = actual(), acquisition = doorAcquisitionSnapshot(source);
  const origin: DoorMaterialsState['origin'] = { ...acquisition, actorId: `${source.runId}:original-player`,
    sourceDigest: sha256Hex(stableStringify(acquisition)), inheritanceLocation: 'component-home' };
  let state = createDoorMaterials(origin, POLICY, starKeyOriginals(source)), revision = 2000;
  const host: DoorMaterialHost = { eventId: `component-${revision}`, revision, week: 218, date: { ...source.date },
    actorId: origin.actorId, sourceDigest: origin.sourceDigest, location: 'component-home', nowSecond: 36000, weekAnchor: 0,
    sequence: 1, status: 'ACTIVE', cash: 50000, actions: 100, serviceReceipts: services(), legacyAccess: null, succession: doorSuccessionAt(source.date) };
  const sync = () => { host.legacyAccess = structuredClone(state.legacySites.find(s => s.location === host.location && s.residualPresent) ?? null); };
  const run = (command: DoorMaterialCommand) => {
    sync(); const result = applyDoorMaterial(state, command, host, POLICY); state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds;
    host.revision = ++revision; host.eventId = `component-${revision}`; sync(); return result;
  };
  const move = (to: string) => { state = transportDoorMaterials(state, host.location, to); host.location = to; sync(); };
  const laterWeek = () => { host.week++; host.date = addGameWeeks(host.date, 1); host.nowSecond += 604800; host.weekAnchor += 604800; host.actions = 100; };
  const acquire = () => {
    move(LOC.supplier); for (const taskId of DOOR_LABOUR_IDS) run({ type: 'MATERIAL_LABOUR', bottleId: original(3), taskId });
    run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(3) });
    move(LOC.originalRoom); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: original(1) }); run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: original(1) });
    run({ type: 'SEAL_LEGACY_REMAINS', bottleId: original(1) }); laterWeek(); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: original(1) }); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: original(1) });
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); run({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = (batchId: DoorCarrierId = DOOR_CARRIER_IDS[0]) => { move(LOC.supplier); run({ type: 'BUY_COMPOUND', batchId }); move(LOC.workshop); run({ type: 'COMPOSE_POTION', batchId }); };
  const settle = (success: boolean, alive: boolean, residualPresent = true) => {
    const input: DoorMaterialSettlement = { eventId: host.eventId, compoundId: state.compounds.at(-1)!.id, week: host.week, location: host.location, success, alive, residualPresent };
    state = settleDoorConsumption(state, input); host.revision = ++revision; host.eventId = `component-${revision}`; return input;
  };
  return { get state() { return state; }, host, source, run, move, laterWeek, acquire, compose, settle };
}

describe('Door R218 original material conservation', () => {
  it('pins natural823 and admits the untouched W218 living original with all17 mastery entries', () => {
    const bytes = readFileSync(PATH); expect(createHash('sha256').update(bytes).digest('hex')).toBe('d9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d');
    const s = actual(), before = stableStringify(s), source = createDoorSource(s);
    expect(doorSourceBlock(s)).toBeNull(); expect(validateDoorSource(s, source, 'HANDOFF')).toBe(true);
    expect(source.budget).toMatchObject({ week: 218, health: 80, mind: 98, spirituality: 120, cash: 3900, actions: 3, injuryRisk: 1, sequence: 1 });
    expect(source.budget.injuries).toHaveLength(2); expect(Object.keys(source.budget.mastery)).toHaveLength(17);
    expect(Object.values(source.budget.mastery).filter(n => n === 0)).toHaveLength(8);
    expect(source.acquisition.promotionWeek).toBe(208); expect(s.progression.promotionWeek).toBe(5);
    expect(source.random).toEqual({ seed: 'secrets-sorcerer-directed-24', cursor: 205 });
    expect(source.originalCharacteristics.embodiedOriginalBottleId).toBe(original(2));
    expect(source.originalCharacteristics.characteristics.map(c => c.holder)).toEqual(['FAILED_REMAINS', 'EMBODIED', 'SUPPLIER']);
    expect(source.originals.gallery.site).toMatchObject({ operatorLocation: 'OUTSIDE', operatorEnergy: 80, operatorConsent: 'WITHDRAWN', parcel: { location: 'ENTRY_STAND' }, lamp: { oilRemaining: 2 }, door: { state: 'CLOSED', operations: 14 } });
    expect(stableStringify(s)).toBe(before);
  }, 60000);
  it('starts the failed original unlocated with no inherited ownership or backfilled investigation', () => {
    const r = harness(); expect(r.state.characteristics.map(c => [c.id, c.holder])).toEqual([
      ['DR0-SK-CHAR-1', 'UNLOCATED'], ['DR0-SK-CHAR-2', 'EMBODIED'], ['DR0-SK-CHAR-3', 'SUPPLIER']]);
    expect(r.state.legacyRemains[0]).toMatchObject({ sceneId: null, location: null, investigatedEventId: null, sealedEventId: null, recoveredEventId: null });
    expect(r.state.characteristics[0]!.location).toBeNull(); expect(r.state.characteristics[1]!.location).toBe(r.host.actorId);
    expect(r.state.legacySites[0]).toMatchObject({ custodianId: 'DR0-HURST', investigation: 'UNASKED', handover: 'UNASKED' });
    expect(doorMaterialConservationBlock(r.state)).toBeNull();
  });
  it('charges original3 full6600 or five independent labour steps plus1100', () => {
    const r = harness(), command = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(3) } as const; r.move(LOC.supplier);
    expect(doorMaterialEffect(r.state, command, POLICY).cashCost).toBe(6600);
    expect(doorMaterialBlock(r.state, command, { ...r.host, cash: 6599 }, POLICY)).not.toBeNull();
    for (const taskId of DOOR_LABOUR_IDS) r.run({ type: 'MATERIAL_LABOUR', bottleId: original(3), taskId });
    expect(doorMaterialEffect(r.state, command, POLICY).cashCost).toBe(1100); r.run(command);
    expect(r.state.characteristics[2]).toMatchObject({ latestBottleId: original(3), holder: 'PLAYER' });
    expect(doorMaterialBlock(r.state, command, r.host, POLICY)).not.toBeNull();
    expect(doorMaterialBlock(r.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) }, r.host, POLICY)).not.toBeNull();
  });
  it('requires current permission, actual original investigation and sealed later-week handover', () => {
    const r = harness(), id = original(1), inspect = { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id } as const;
    const before = stableStringify(starKeyOriginals(r.source)); r.move(LOC.originalRoom);
    expect(doorMaterialBlock(r.state, inspect, r.host, POLICY)).not.toBeNull();
    for (const patch of [{ residualPresent: false }, { custodianPresent: false }, { accessible: false }, { consumeRevision: -1 }])
      expect(doorMaterialBlock(r.state, { type: 'ASK_LEGACY_PERMISSION', bottleId: id }, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, ...patch } }, POLICY)).not.toBeNull();
    r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); expect(r.run(inspect).effect.cashCost).toBe(120);
    const seal = { type: 'SEAL_LEGACY_REMAINS', bottleId: id } as const;
    expect(doorMaterialBlock(r.state, seal, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, handover: 'WITHDRAWN' } }, POLICY)).not.toBeNull();
    r.host.actions = 0; expect(r.run(seal).effect.actions).toBe(0);
    const recover = { type: 'RECOVER_LEGACY_REMAINS', bottleId: id } as const;
    expect(doorMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
    r.move(LOC.supplier); r.move(LOC.originalRoom); expect(r.host.legacyAccess?.investigation).toBe('UNASKED');
    r.laterWeek(); expect(doorMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
    r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); expect(r.run(recover).effect.cashCost).toBe(30);
    expect(r.state.characteristics[0]!.holder).toBe('PLAYER'); expect(r.state.legacySites[0]!.residualPresent).toBe(false);
    expect(stableStringify(starKeyOriginals(r.source))).toBe(before); expect(r.state.origin.bottles[0]!.status).toBe('CONSUMED');
  });
  it('uses one independent April21/22 succession, charged180 chain verification and200 handover', () => {
    expect(validateDoorMaterialPolicy(POLICY)).toBe(true);
    expect(DOOR_FUTURE_BRANCH.terminationDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 });
    expect(DOOR_FUTURE_BRANCH.transferDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 22 });
    expect(doorSuccessionAt(DOOR_FUTURE_BRANCH.terminationDate)).toBeNull();
    const r = harness(); r.move(LOC.archive); expect(r.run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }).effect.cashCost).toBe(180);
    expect(r.run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }).effect.cashCost).toBe(0);
    const command = { type: 'ACQUIRE_UNIQUENESS' } as const; r.laterWeek(); expect(doorMaterialBlock(r.state, command, r.host, POLICY)).not.toBeNull();
    r.run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); expect(r.run(command).effect.cashCost).toBe(200);
    expect(r.state.uniqueness).toMatchObject({ id: DOOR_UNIQUENESS_ID, holder: 'PLAYER', incumbentActorId: null, custodianActorId: null });
    for (const mutate of [(p: DoorMaterialPolicy) => { p.succession.predecessorStillEmbodied = true as false; },
      (p: DoorMaterialPolicy) => { p.succession.transfer.objectId = 'COPY' as typeof DOOR_UNIQUENESS_ID; },
      (p: DoorMaterialPolicy) => { p.succession.characteristicCustody.pop(); },
      (p: DoorMaterialPolicy) => { p.succession.transfer.date.day = 20; }]) {
      const p = structuredClone(POLICY); mutate(p); expect(validateDoorMaterialPolicy(p)).toBe(false);
    }
  });
  it('requires all three distinct services and rejects commands supplying private custody tokens', () => {
    expect(doorServiceReceiptsComplete(services(), POLICY, 218)).toBe(true);
    expect(doorServiceReceiptsComplete(services().slice(0, 2), POLICY, 218)).toBe(false);
    const duplicate = services(); duplicate[2]!.residentId = duplicate[0]!.residentId; expect(doorServiceReceiptsComplete(duplicate, POLICY, 218)).toBe(false);
    for (const c of [{ type: 'BUY_COMPOUND', batchId: 'door-carrier-4' }, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'star-key-potion-4' },
      { type: 'COMPOSE_POTION', batchId: DOOR_CARRIER_IDS[0], serviceReceipts: services() }, { type: 'ACQUIRE_UNIQUENESS', succession: POLICY.succession }]) expect(validateDoorMaterialCommand(c)).toBe(false);
    const r = harness(); for (const action of getDoorMaterialActions(r.state, POLICY)) expect(validateDoorMaterialCommand(action.command)).toBe(true);
  });
  it('composes only actual handed-over originals and keeps the embodied second characteristic in its body', () => {
    const r = harness(); r.acquire(); r.move(LOC.supplier); r.run({ type: 'BUY_COMPOUND', batchId: DOOR_CARRIER_IDS[0] }); r.move(LOC.workshop);
    const c = { type: 'COMPOSE_POTION', batchId: DOOR_CARRIER_IDS[0] } as const;
    expect(doorMaterialBlock(r.state, c, { ...r.host, serviceReceipts: [] }, POLICY)).not.toBeNull();
    const duplicated = structuredClone(r.state); duplicated.characteristics[1]!.holder = 'PLAYER'; expect(doorMaterialConservationBlock(duplicated)).not.toBeNull();
    expect(r.run(c).effect.cashCost).toBe(40); expect(r.state.characteristics.map(c => c.holder)).toEqual(['COMPOUND', 'EMBODIED', 'COMPOUND']);
    expect(r.state.compounds[0]!.characteristicIds).toEqual(['DR0-SK-CHAR-1', 'DR0-SK-CHAR-2', 'DR0-SK-CHAR-3']);
  });
  it('keeps living failure, sealing and later paid recovery on the same identities and finite carriers', () => {
    const r = harness(); r.acquire(); const identities = r.state.characteristics.map(c => c.id), origin = structuredClone(r.state.origin);
    for (const batchId of DOOR_CARRIER_IDS) {
      r.compose(batchId); const input = r.settle(false, true);
      expect(r.state.characteristics.map(c => c.holder)).toEqual(['EXPOSED', 'EMBODIED', 'EXPOSED']);
      r.host.actions = 0; expect(r.run({ type: 'SEAL_REMAINS', compoundId: input.compoundId }).effect.actions).toBe(0);
      r.move(LOC.archive); expect(r.state.uniqueness.location).toBe(LOC.workshop); r.move(LOC.workshop);
      const c = { type: 'RECOVER_SEALED', compoundId: input.compoundId } as const;
      expect(doorMaterialBlock(r.state, c, r.host, POLICY)).not.toBeNull(); r.laterWeek(); expect(r.run(c).effect.cashCost).toBe(60);
      expect(r.state.characteristics.map(c => c.id)).toEqual(identities); expect(r.state.uniqueness.id).toBe(DOOR_UNIQUENESS_ID);
    }
    expect(r.state.origin).toEqual(origin); expect(r.state.batches.map(b => [b.status, b.uses])).toEqual([['SPENT', 1], ['SPENT', 1], ['SPENT', 1]]);
    expect(r.state.receipts.filter(r => r.command.type === 'BUY_COMPOUND').map(r => r.effect.cashCost)).toEqual([50, 70, 90]);
    expect(getDoorMaterialActions(r.state, POLICY).some(a => ['BUY_COMPOUND', 'COMPOSE_POTION'].includes(a.command.type))).toBe(false);
  });
  it.each([{ success: true, alive: true, residualPresent: false }, { success: false, alive: false, residualPresent: true },
    { success: false, alive: true, residualPresent: false }])('accounts for every input after $success/$alive/$residualPresent', ({ success, alive, residualPresent }) => {
    const r = harness(); r.acquire(); r.compose(); const event = r.settle(success, alive, residualPresent);
    expect(doorMaterialConservationBlock(r.state)).toBeNull(); expect(() => settleDoorConsumption(r.state, event)).toThrow();
    expect(r.state.characteristics[1]!.holder).toBe(success ? 'FUSED' : alive ? 'EMBODIED' : 'LOST');
    expect(r.state.uniqueness.holder).toBe(success ? 'FUSED' : 'LOST');
    expect(r.state.batches[0]!.status).toBe('SPENT');
    expect(doorMaterialBlock(r.state, { type: 'RECOVER_SEALED', compoundId: event.compoundId }, r.host, POLICY)).not.toBeNull();
  });
  it('does not expose unlocated physical sites or private actor tokens in material projection', () => {
    const r = harness(), text = stableStringify(projectDoorMaterials(r.state));
    expect(text).not.toContain(r.host.actorId); expect(text).not.toContain('BACKLUND_ORIGINAL_STAR_KEY_PREPARATION'); expect(text).not.toContain('consumeRevision');
    expect(text).toContain('地点尚未核实'); expect(resolveDoorOriginals(doorAcquisitionSnapshot(r.source))).not.toBeNull();
    expect(DOOR_ORIGINAL_IDS).toHaveLength(3);
  });
});
