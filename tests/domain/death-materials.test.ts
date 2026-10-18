import { describe, expect, it } from 'vitest';
import { DEATH_ORIGINAL_IDS, DEATH_CARRIER_IDS, type DeathMaterialCommand } from '../../src/domain/death/types.js';
import { deathMaterialConservationBlock, deathMaterialEffect, deathPromotionChance, currentDeathPreparation,
  deathConsumeBlock, invalidateDeathPreparations, spendDeathPreparation, validateDeathMaterialCommand } from '../../src/domain/death/materials.js';
import { deathMaterialScenario, policy } from '../helpers/death-material-scenario.js';

describe('Death material domain with authentic195 acquisition only', () => {
  it('keeps exactly three original characteristics, one uniqueness and three paid carriers', () => {
    const r = deathMaterialScenario();
    expect(r.state.embodiedOriginalBottleId).toBe(DEATH_ORIGINAL_IDS[2]);
    expect(r.state.characteristics.map(x => [x.id, x.holder])).toEqual(DEATH_ORIGINAL_IDS.map((id, i) => [`${id}:characteristic`, i === 2 ? 'EMBODIED' : 'UNLOCATED']));
    expect(r.state.batches.map(x => x.id)).toEqual(DEATH_CARRIER_IDS); expect(r.state.uniqueness.id).toBe('DE0-U1');
    expect(r.state.legacyRemains.map(x => x.consumeRevision)).toEqual([888, 923]);
    expect(r.state.legacyRemains.every(x => x.physicalId === null && x.location === null && x.currentPermission === null)).toBe(true);
    expect(new Set(r.state.legacySites.map(x => x.physicalId)).size).toBe(2);
    expect(deathMaterialConservationBlock(r.state)).toBeNull();
    const duplicate = structuredClone(r.state); duplicate.characteristics[1]!.id = duplicate.characteristics[0]!.id;
    expect(deathMaterialConservationBlock(duplicate)).not.toBeNull();
  });
  it('requires actual location, one failed receipt, matching physical version and current permission', () => {
    const r = deathMaterialScenario(), bottleId = DEATH_ORIGINAL_IDS[0], command: DeathMaterialCommand = { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId };
    expect(r.block(command)).not.toBeNull(); r.travel(policy.legacyLocation); expect(r.block(command)).not.toBeNull();
    r.step({ type: 'ASK_LEGACY_PERMISSION', bottleId }); expect(r.block(command)).toBeNull();
    for (const mutate of [
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.physicalId += ':other'; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.physicalVersion++; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.consumeRevision++; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.residualPresent = false; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.custodianPresent = false; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.accessible = false; },
      (h: ReturnType<typeof r.host>) => { h.legacyAccess!.investigation!.status = 'WITHDRAWN'; },
      (h: ReturnType<typeof r.host>) => { h.location = 'DE0-RECEPTION'; },
    ]) { const host = r.host(command); mutate(host); expect(r.block(command, host)).not.toBeNull(); }
    const before = structuredClone(r.state.origin); r.step(command);
    expect(r.state.origin).toEqual(before); expect(r.state.legacyRemains[0]!.physicalId).toBe(r.state.legacySites[0]!.physicalId);
  });
  it('gives each failed original one noncash8p labour credit, with next-week real handover', () => {
    const r = deathMaterialScenario(), cash = r.h.cash, actions = r.h.actions;
    for (const bottleId of DEATH_ORIGINAL_IDS.slice(0, 2)) {
      r.locate(bottleId);
      expect(r.block({ type: 'LEGACY_LABOUR', bottleId })).not.toBeNull();
      expect(r.block({ type: 'RECOVER_LEGACY_REMAINS', bottleId })).not.toBeNull();
      expect(deathMaterialEffect(r.state, { type: 'RECOVER_LEGACY_REMAINS', bottleId }, policy).cashCost).toBe(4);
    }
    expect(cash - r.h.cash).toBe(8); expect(actions - r.h.actions).toBe(4);
    r.week();
    for (const bottleId of DEATH_ORIGINAL_IDS.slice(0, 2)) {
      expect(r.block({ type: 'RECOVER_LEGACY_REMAINS', bottleId })).not.toBeNull();
      r.recoverOriginal(bottleId); expect(r.block({ type: 'RECOVER_LEGACY_REMAINS', bottleId })).not.toBeNull();
    }
    expect(cash - r.h.cash).toBe(16); expect(actions - r.h.actions).toBe(6);
    expect(r.state.characteristics.slice(0, 2).every(x => x.holder === 'PLAYER' && x.legacyLabour?.spentEventId)).toBe(true);
    expect(r.state.legacySites.every(x => !x.residualPresent && x.physicalVersion === 2)).toBe(true);
    expect(r.state.characteristics[2]!.holder).toBe('EMBODIED');
  });
  it('charges12p handover without that same original labour and never accepts external authority fields', () => {
    const r = deathMaterialScenario(), bottleId = DEATH_ORIGINAL_IDS[0]; r.locate(bottleId, false);
    expect(deathMaterialEffect(r.state, { type: 'RECOVER_LEGACY_REMAINS', bottleId }, policy).cashCost).toBe(12);
    r.week(); const paid = r.recoverOriginal(bottleId); expect(paid.effect).toMatchObject({ cashCost: 12, cashGain: 0, actions: 1 });
    expect(validateDeathMaterialCommand({ type: 'BUY_COMPOUND', batchId: 'death-carrier-4' })).toBe(false);
    for (const extra of [{ cash: 0 }, { permission: true }, { sourceDigest: 'claimed' }, { success: true }])
      expect(validateDeathMaterialCommand({ type: 'ASK_UNIQUENESS_PERMISSION', ...extra })).toBe(false);
  });
  it('checks nine archive records, same sealed object, current vacancy and custodian before transfer', () => {
    const r = deathMaterialScenario(), chain: DeathMaterialCommand = { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' };
    r.travel(policy.archiveLocation); const archive = r.host(chain); expect(archive.uniquenessObservation!.recordIds).toHaveLength(9);
    archive.uniquenessObservation!.recordIds.pop(); expect(r.block(chain, archive)).not.toBeNull(); r.step(chain);
    r.travel(policy.succession.location); expect(r.block({ type: 'ACQUIRE_UNIQUENESS' })).not.toBeNull();
    r.step({ type: 'ASK_UNIQUENESS_PERMISSION' });
    const vacancy: DeathMaterialCommand = { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' };
    for (const mutate of [
      (h: ReturnType<typeof r.host>) => { h.uniquenessObservation!.seal = 'other'; },
      (h: ReturnType<typeof r.host>) => { h.uniquenessObservation!.incumbentActorId = 'other-god'; },
      (h: ReturnType<typeof r.host>) => { h.uniquenessObservation!.physicalVersion++; },
      (h: ReturnType<typeof r.host>) => { h.uniquenessCustodianPresent = false; },
      (h: ReturnType<typeof r.host>) => { h.succession!.permission!.status = 'REFUSED'; },
    ]) { const host = r.host(vacancy); mutate(host); expect(r.block(vacancy, host)).not.toBeNull(); }
    r.step(vacancy); const paid = r.step({ type: 'ACQUIRE_UNIQUENESS' }); expect(paid.effect).toMatchObject({ cashCost: 8, actions: 0 });
    expect(r.state.uniqueness.holder).toBe('PLAYER'); expect(r.scene.uniqueness.present).toBe(false);
    expect(r.block({ type: 'ACQUIRE_UNIQUENESS' })).not.toBeNull();
  });
  it('requires both real services and keeps the embodied original in the same body', () => {
    const r = deathMaterialScenario(); r.materials(); r.travel(policy.supplierLocation); r.step({ type: 'BUY_COMPOUND', batchId: DEATH_CARRIER_IDS[0] }); r.travel(policy.workshopLocation);
    const command: DeathMaterialCommand = { type: 'COMPOSE_POTION', batchId: DEATH_CARRIER_IDS[0] }, missing = r.host(command); missing.serviceReceipts.pop();
    expect(r.block(command, missing)).not.toBeNull(); r.step(command);
    const p = r.state.compounds[0]!; expect(p.characteristicIds).toEqual(DEATH_ORIGINAL_IDS.slice(0, 2).map(id => `${id}:characteristic`));
    expect(r.state.characteristics[2]).toMatchObject({ holder: 'EMBODIED', location: r.h.actorId, compoundId: null });
    expect(r.state.batches[0]).toMatchObject({ uses: 1, status: 'IN_COMPOUND', stopper: { status: 'PLAYER' } });
    expect(r.block(command)).not.toBeNull(); expect(deathMaterialConservationBlock(r.state)).toBeNull();
  });
  it('accounts84p/16AP including guidance and consumption without granting those component resources', () => {
    const r = deathMaterialScenario(); r.materials(); r.compose(); r.prepare();
    expect(1000 - r.h.cash + 12).toBe(84); expect(100 - r.h.actions + 1 + 1).toBe(16);
    expect(deathPromotionChance(27, true)).toBe(70); expect(deathPromotionChance(27, false)).toBe(5); expect(deathPromotionChance(30, true)).toBe(76);
  });
  it('binds paid preparation to actor, source, bottle, permissions and current conditions', () => {
    const r = deathMaterialScenario(); r.materials(); const p = r.compose(); const cash = r.h.cash; r.prepare();
    expect(cash - r.h.cash).toBe(12); expect(deathConsumeBlock(r.state, r.preparations, p.id, r.host(), policy)).toBeNull();
    for (const mutate of [
      (h: ReturnType<typeof r.host>) => { h.actorId += ':other'; },
      (h: ReturnType<typeof r.host>) => { h.sourceDigest += ':other'; },
      (h: ReturnType<typeof r.host>) => { h.conditionVersions['DE0-WORKSHOP']!++; },
      (h: ReturnType<typeof r.host>) => { h.workshopPermission!.status = 'WITHDRAWN'; },
      (h: ReturnType<typeof r.host>) => { h.health = 79; },
      (h: ReturnType<typeof r.host>) => { h.injuryCount = 1; },
      (h: ReturnType<typeof r.host>) => { h.actions = 0; },
    ]) { const host = r.host(); mutate(host); expect(deathConsumeBlock(r.state, r.preparations, p.id, host, policy)).not.toBeNull(); }
    expect(currentDeathPreparation(r.state, r.preparations, 'death-compound-2', r.host(), policy)).toBeNull();
    expect(() => r.prepare()).toThrow();
    const spent = spendDeathPreparation(r.preparations, r.preparations[0]!.id, r.h.eventId);
    expect(currentDeathPreparation(r.state, spent, p.id, r.host(), policy)).toBeNull();
    expect(() => spendDeathPreparation(spent, spent[0]!.id, 'again')).toThrow();
  });
  it('keeps preparation through a calendar boundary but invalidates after seven real days or departure', () => {
    const r = deathMaterialScenario(); r.materials(); const p = r.compose(); r.prepare();
    const prepared = r.preparations[0]!, future = r.host();
    future.nowSecond = future.weekAnchor + 604800 + 1; future.weekAnchor += 604800; future.week++;
    expect(currentDeathPreparation(r.state, r.preparations, p.id, future, policy)).not.toBeNull();
    future.nowSecond = prepared.expiresSecond + 1; future.weekAnchor = Math.floor(future.nowSecond / 604800) * 604800;
    expect(currentDeathPreparation(r.state, r.preparations, p.id, future, policy)).toBeNull();
    const invalid = invalidateDeathPreparations(r.preparations, 'actual-departure', r.h.location, 'DE0-RECEPTION', () => true);
    r.travel('DE0-RECEPTION'); r.travel(policy.workshopLocation);
    expect(invalid[0]!.status).toBe('INVALIDATED'); expect(currentDeathPreparation(r.state, invalid, p.id, r.host(), policy)).toBeNull();
    expect(r.state.compounds[0]!.location).toBe(policy.workshopLocation);
  });
});
