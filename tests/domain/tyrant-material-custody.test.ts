import { describe, expect, it } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { resolveTyrantOriginals } from '../../src/domain/tyrant/originals.js';
import { TYRANT_MATERIAL_POLICY as POLICY, TYRANT_MATERIAL_LOCATIONS as LOC, tyrantSuccessionAt } from '../../src/domain/tyrant/material-content.js';
import { applyTyrantMaterial, createTyrantMaterials, getTyrantMaterialActions, projectTyrantMaterials, settleTyrantConsumption, settleTyrantDeath,
  transportTyrantMaterials, tyrantMaterialBlock, tyrantMaterialConservationBlock, tyrantPrecomposeReceiptsComplete,
  tyrantRitualReceiptsComplete, validateTyrantMaterialCommand, validateTyrantMaterialPolicy } from '../../src/domain/tyrant/materials.js';
import { TYRANT_ORIGINAL_IDS, TYRANT_CARRIER_IDS, type TyrantCarrierId, type TyrantMaterialHost,
  type TyrantMaterialCommand, type TyrantOriginalId, type TyrantRitualReceipt } from '../../src/domain/tyrant/material-types.js';
import { componentSource, originOf, original, thunderGodOriginals } from './tyrant-material-fixtures.js';

function harness(source = componentSource(1, 'SUPPLIER')) {
  const origin = originOf(source); let state = createTyrantMaterials(origin, POLICY, thunderGodOriginals(source)), revision = 2000;
  const host: TyrantMaterialHost = { actorId: origin.actorId, sourceDigest: origin.sourceDigest, eventId: `component:${revision}`, revision,
    week: 200, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }, nowSecond: 0, weekAnchor: 0,
    location: origin.inheritanceLocation, sequence: 1, status: 'ACTIVE', cash: 100000, actions: 100,
    ritualReceipts: (['COASTS', 'CHALLENGE'] as const).map((kind, i) => ({ kind, eventId: `component:gate:${i}`, week: 199, actorId: origin.actorId, conditionVersion: 1 })),
    legacyAccess: null, succession: tyrantSuccessionAt({ epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }) };
  const next = () => { host.revision = ++revision; host.eventId = `component:${revision}`; };
  const sync = (id: TyrantOriginalId) => { host.legacyAccess = structuredClone(state.legacySites.find(site => site.originalBottleId === id) ?? null); };
  const move = (to: string) => { state = transportTyrantMaterials(state, host.location, to); host.location = to; };
  const laterWeek = () => { host.week++; host.date = addGameWeeks(host.date, 1); host.nowSecond += 604800; host.weekAnchor += 604800; host.actions = 100; };
  const run = (command: TyrantMaterialCommand) => {
    if ('bottleId' in command) sync(command.bottleId);
    const before = stableStringify(state), result = applyTyrantMaterial(state, command, host, POLICY);
    expect(stableStringify(state)).toBe(before); state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds; next();
    expect(tyrantMaterialConservationBlock(state)).toBeNull(); return result;
  };
  const acquire = () => {
    for (const id of TYRANT_ORIGINAL_IDS) {
      const c = state.characteristics.find(c => c.originBottleId === id)!;
      if (c.holder === 'SUPPLIER' || c.holder === 'PLAYER') { move(c.location!); run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: id }); }
      else if (c.holder === 'UNLOCATED') {
        move(LOC.originalCove); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id });
        run({ type: 'SEAL_LEGACY_REMAINS', bottleId: id }); laterWeek(); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: id });
      }
    }
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); move(LOC.vault);
    run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); run({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = (batchId: TyrantCarrierId = TYRANT_CARRIER_IDS[0]) => {
    move(LOC.supplier); run({ type: 'BUY_COMPOUND', batchId }); move(LOC.workshop); run({ type: 'COMPOSE_POTION', batchId });
  };
  const settle = (success: boolean, alive: boolean, residualPresent = true) => {
    state = settleTyrantConsumption(state, { eventId: host.eventId, week: host.week, compoundId: state.compounds.at(-1)!.id,
      success, alive, residualPresent, location: host.location }); if (!alive) host.status = 'DEAD'; next();
  };
  return { source, host, get state() { return state; }, move, laterWeek, run, acquire, compose, settle, sync };
}

describe('Tyrant finite original materials: controlled component evidence, not a natural promotion', () => {
  it('places the original future succession before the first attested three-bottle supply', () => {
    const day = (month: number, day: number) => ({ epoch: 'FIFTH_EPOCH' as const, year: 1352, month, day });
    expect(tyrantSuccessionAt(day(1, 8))).toBeNull();
    const custody = tyrantSuccessionAt(day(1, 9));
    expect(custody).toMatchObject({ objectCount: 1, incumbentActorId: null, custodianEmbodied: false,
      vacancy: { date: day(1, 8) }, transfer: { date: day(1, 9), custodyOnly: true } });
    expect(tyrantSuccessionAt(day(2, 12))).toEqual(custody);
    expect(tyrantSuccessionAt(day(1, 9))).not.toBe(custody);
  });
  for (const n of [1, 2, 3] as const) for (const mode of ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS', 'RECOVERED_SUCCESS', 'RECOVERED_SUPPLIER'] as const) {
    it(`retains original${n} embodied with ${mode} external custody`, () => {
      const source = componentSource(n, mode), old = stableStringify(source), h = harness(source);
      expect(resolveTyrantOriginals(originOf(source))?.embodiedOriginalBottleId).toBe(original(n));
      expect(h.state.characteristics).toHaveLength(3); expect(h.state.embodiedOriginalBottleId).toBe(original(n));
      h.acquire(); h.compose(); expect(h.state.characteristics.filter(c => c.holder === 'COMPOUND')).toHaveLength(2);
      expect(h.state.characteristics[n - 1]!.holder).toBe('EMBODIED'); h.settle(true, true);
      expect(h.state.characteristics.every(c => c.holder === 'FUSED')).toBe(true);
      expect(h.state.uniqueness).toMatchObject({ id: 'TY0-U1', holder: 'FUSED', incumbentActorId: h.host.actorId });
      expect(stableStringify(source)).toBe(old);
    });
  }
  it('rejects forged fourth original, altered paid cost and duplicate lineage', () => {
    const source = componentSource(2, 'RECOVERED_SUCCESS'), baseline = originOf(source);
    for (const mutate of [
      (o: typeof baseline) => { delete o.bottles[3]!.recovery; },
      (o: typeof baseline) => { o.bottles[3]!.recovery!.originalBottleId = original(1); },
      (o: typeof baseline) => { o.acquisitionJournal.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!.after.cash++; },
      (o: typeof baseline) => { o.promotionWeek++; },
    ]) { const altered = structuredClone(baseline); mutate(altered); expect(resolveTyrantOriginals(altered)).toBeNull(); }
  });
  it('requires real source location, current permission and later-week recovery of original failure', () => {
    const h = harness(componentSource(1, 'FAILED_REMAINS')), id = original(2); h.move(LOC.originalCove); h.sync(id);
    expect(tyrantMaterialBlock(h.state, { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id }, h.host, POLICY)).not.toBeNull();
    h.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); h.run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id }); h.run({ type: 'SEAL_LEGACY_REMAINS', bottleId: id });
    h.sync(id); expect(tyrantMaterialBlock(h.state, { type: 'RECOVER_LEGACY_REMAINS', bottleId: id }, h.host, POLICY)).not.toBeNull();
    h.laterWeek(); h.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); h.run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: id });
    expect(h.state.characteristics[1]!.holder).toBe('PLAYER'); expect(h.state.origin).toEqual(originOf(h.source));
  });
  it('allows at most three paid ordinary carriers, preserving original identity through failures', () => {
    const h = harness(); h.acquire();
    for (const batchId of TYRANT_CARRIER_IDS) {
      h.compose(batchId); h.settle(false, true); const compoundId = h.state.compounds.at(-1)!.id;
      h.run({ type: 'SEAL_REMAINS', compoundId });
      expect(tyrantMaterialBlock(h.state, { type: 'RECOVER_SEALED', compoundId }, h.host, POLICY)).not.toBeNull();
      h.laterWeek(); h.run({ type: 'RECOVER_SEALED', compoundId });
    }
    expect(h.state.batches.every(b => b.uses === 1 && b.status === 'SPENT')).toBe(true);
    expect(getTyrantMaterialActions(h.state, POLICY).some(a => a.command.type === 'BUY_COMPOUND')).toBe(false);
    expect(h.state.characteristics.map(c => c.id)).toEqual(TYRANT_ORIGINAL_IDS.map(id => `${id}:characteristic`));
    expect(validateTyrantMaterialCommand({ type: 'BUY_COMPOUND', batchId: 'tyrant-carrier-4' })).toBe(false);
  });
  it.each([[false, false], [true, false]])('keeps inaccessible unique object real when alive=%s residue=%s', (alive, residue) => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, alive, residue);
    expect(h.state.uniqueness).toMatchObject({ id: 'TY0-U1', holder: 'UNAVAILABLE', location: LOC.workshop });
    expect(h.state.compounds[0]!.status).toBe('FAILED_UNAVAILABLE');
    expect(tyrantMaterialBlock(h.state, { type: 'RECOVER_SEALED', compoundId: 'tyrant-compound-1' }, h.host, POLICY)).not.toBeNull();
    expect(projectTyrantMaterials(h.state).lines.join('\n')).toContain('原物未毁灭');
  });
  it('requires exact current canonical gate types and exposes only display lines', () => {
    const h = harness(); expect(tyrantPrecomposeReceiptsComplete(h.host.ritualReceipts, h.host.week, h.host.actorId)).toBe(true);
    expect(tyrantRitualReceiptsComplete(h.host.ritualReceipts, h.host.week, h.host.actorId)).toBe(false);
    const full: TyrantRitualReceipt[] = [...h.host.ritualReceipts, { kind: 'ATMOSPHERE', eventId: 'component:atmosphere', week: 200, actorId: h.host.actorId, conditionVersion: 1 }];
    expect(tyrantRitualReceiptsComplete(full, h.host.week, h.host.actorId)).toBe(true);
    expect(tyrantRitualReceiptsComplete(full, h.host.week, 'different-actor')).toBe(false);
    expect(Object.keys(projectTyrantMaterials(h.state)).sort()).toEqual(['lines', 'title']);
    expect(validateTyrantMaterialPolicy(POLICY)).toBe(true);
  });
  it('records actual death before any compound without moving supplier originals', () => {
    const h = harness(), before = structuredClone(h.state);
    const dead = settleTyrantDeath(h.state, { eventId: 'component:death-before', week: h.host.week, location: 'component:sun-site' });
    expect(tyrantMaterialConservationBlock(dead)).toBeNull();
    expect(dead.characteristics[0]).toMatchObject({ holder: 'UNAVAILABLE', location: 'component:sun-site' });
    expect(dead.characteristics.slice(1)).toEqual(before.characteristics.slice(1)); expect(dead.uniqueness).toEqual(before.uniqueness);
    expect(dead.death!.dispositions).toHaveLength(1); expect(h.state).toEqual(before);
    expect(tyrantMaterialBlock(dead, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) }, h.host, POLICY)).not.toBeNull();
    expect(() => settleTyrantDeath(dead, { eventId: 'component:repeat', week: h.host.week, location: 'component:sun-site' })).toThrow();
  });
  it('records actual death carrying a prepared dose without inventing consumption', () => {
    const h = harness(); h.acquire(); h.compose(); h.move('component:death-site'); const before = structuredClone(h.state);
    const dead = settleTyrantDeath(h.state, { eventId: 'component:death-prepared', week: h.host.week, location: h.host.location });
    expect(tyrantMaterialConservationBlock(dead)).toBeNull(); expect(dead.death!.dispositions).toHaveLength(4);
    expect(dead.compounds).toEqual(before.compounds); expect(dead.compounds[0]!.consumedWeek).toBeNull();
    expect(dead.batches).toEqual(before.batches); expect(dead.settlements).toEqual([]);
    expect([...dead.characteristics, dead.uniqueness].every(x => x.holder === 'UNAVAILABLE' && x.location === h.host.location)).toBe(true);
  });
  it('preserves successful promotion history when the embodied S0 actor later dies elsewhere', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(true, true); const before = structuredClone(h.state);
    const dead = settleTyrantDeath(h.state, { eventId: 'component:death-after-s0', week: h.host.week + 1, location: 'component:rescue-site' });
    expect(tyrantMaterialConservationBlock(dead)).toBeNull(); expect(dead.compounds).toEqual(before.compounds);
    expect(dead.compounds[0]).toMatchObject({ status: 'SUCCESS', location: LOC.workshop });
    expect(dead.settlements).toEqual(before.settlements); expect(dead.uniqueness.incumbentActorId).toBeNull();
    expect([...dead.characteristics, dead.uniqueness].every(x => x.holder === 'UNAVAILABLE' && x.location === 'component:rescue-site')).toBe(true);
    // The source/engine replay also seals original compound history; the death
    // reducer itself never writes that historical location.
    expect(dead.death!.previousIncumbentActorId).toBe(h.host.actorId);
  });
  it.each([false, true])('leaves offsite failed remains unmoved on later death; sealed=%s', sealed => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, true);
    if (sealed) h.run({ type: 'SEAL_REMAINS', compoundId: h.state.compounds[0]!.id });
    const before = structuredClone(h.state); h.move('component:elsewhere');
    const dead = settleTyrantDeath(h.state, { eventId: `component:death-offsite:${sealed}`, week: h.host.week, location: h.host.location });
    expect(tyrantMaterialConservationBlock(dead)).toBeNull(); expect(dead.death!.dispositions).toHaveLength(1);
    expect(dead.characteristics.slice(1)).toEqual(before.characteristics.slice(1)); expect(dead.uniqueness).toEqual(before.uniqueness);
    expect(dead.compounds).toEqual(before.compounds);
  });

});
