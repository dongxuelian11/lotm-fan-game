import { describe, expect, it } from 'vitest';
import { DEATH_CARRIER_IDS, type DeathMaterialCommand } from '../../src/domain/death/types.js';
import { deathMaterialConservationBlock, transportDeathMaterials } from '../../src/domain/death/materials.js';
import { deathMaterialScenario, policy } from '../helpers/death-material-scenario.js';

function failed(dead = false, present = true) { const r = deathMaterialScenario(); r.materials(); r.compose(); r.fail(dead, present); return r; }

describe('Death bounded same-compound recovery', () => {
  it('leaves two exterior originals and the uniqueness on the actual tray, keeping embodied original in body', () => {
    const r = failed(); expect(r.state.compounds[0]).toMatchObject({ status: 'FAILED_EXPOSED', residualPresent: true, physicalVersion: 2 });
    expect(r.state.recoverySites[0]).toMatchObject({ sceneId: 'DE0-WORKSHOP-RECEIVING-TRAY', physicalId: 'death-compound-1:receiving-tray', sealed: false, residualPresent: true, physicalVersion: 2 });
    expect(r.state.characteristics.map(x => x.holder)).toEqual(['EXPOSED', 'EXPOSED', 'EMBODIED']);
    expect(r.state.characteristics[2]!.location).toBe(r.h.actorId); expect(r.state.uniqueness.holder).toBe('EXPOSED');
    expect(deathMaterialConservationBlock(r.state)).toBeNull();
  });
  it('uses only the paid single stopper,600 real seconds and next-week12p/1AP recovery', () => {
    const r = failed(), compoundId = r.state.compounds[0]!.id;
    const seal = r.step({ type: 'SEAL_REMAINS', compoundId }); expect(seal.effect).toMatchObject({ cashCost: 0, actions: 0, seconds: 600 });
    expect(r.state.batches[0]!.stopper.status).toBe('USED'); expect(r.block({ type: 'SEAL_REMAINS', compoundId })).not.toBeNull();
    r.step({ type: 'ASK_RECOVERY_PERMISSION', compoundId }); expect(r.block({ type: 'RECOVER_SEALED', compoundId })).not.toBeNull();
    r.week(); expect(r.block({ type: 'RECOVER_SEALED', compoundId })).not.toBeNull();
    r.step({ type: 'ASK_RECOVERY_PERMISSION', compoundId }); const recovered = r.step({ type: 'RECOVER_SEALED', compoundId });
    expect(recovered.effect).toMatchObject({ cashCost: 12, actions: 1 });
    expect(r.state.compounds[0]!.status).toBe('RECOVERED'); expect(r.state.recoverySites[0]!.residualPresent).toBe(false);
    expect(r.state.characteristics.map(x => x.holder)).toEqual(['PLAYER', 'PLAYER', 'EMBODIED']);
    expect(r.block({ type: 'RECOVER_SEALED', compoundId })).not.toBeNull();
  });
  it('rejects mismatched, absent, inaccessible, moved, changed-version or refused original remnants', () => {
    const r = failed(), compoundId = r.state.compounds[0]!.id; r.step({ type: 'SEAL_REMAINS', compoundId }); r.week(); r.step({ type: 'ASK_RECOVERY_PERMISSION', compoundId });
    const command: DeathMaterialCommand = { type: 'RECOVER_SEALED', compoundId };
    for (const mutate of [
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.physicalId += ':other'; },
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.physicalVersion++; },
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.residualPresent = false; },
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.custodianPresent = false; },
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.accessible = false; },
      (h: ReturnType<typeof r.host>) => { h.compoundAccess!.handover!.status = 'WITHDRAWN'; h.recoveryPermission = h.compoundAccess!.handover; },
      (h: ReturnType<typeof r.host>) => { h.location = 'DE0-RECEPTION'; },
    ]) { const host = r.host(command); mutate(host); expect(r.block(command, host)).not.toBeNull(); }
  });
  it('allows exactly three paid carriers and same originals, with no fourth medicine or new characteristic', () => {
    const r = deathMaterialScenario(); r.materials();
    const originalIds = r.state.characteristics.map(x => x.id);
    for (const batchId of DEATH_CARRIER_IDS) {
      const p = r.compose(batchId); r.fail(); r.step({ type: 'SEAL_REMAINS', compoundId: p.id }); r.week();
      r.step({ type: 'ASK_RECOVERY_PERMISSION', compoundId: p.id }); r.step({ type: 'RECOVER_SEALED', compoundId: p.id });
      expect(r.state.characteristics.map(x => x.id)).toEqual(originalIds); expect(r.state.characteristics[2]!.holder).toBe('EMBODIED');
    }
    expect(r.state.batches.every(b => b.status === 'SPENT' && b.uses === 1 && b.stopper.status === 'USED')).toBe(true);
    expect(r.state.compounds).toHaveLength(3); expect(r.state.compounds.every(p => p.status === 'RECOVERED')).toBe(true);
    r.travel(policy.supplierLocation); for (const batchId of DEATH_CARRIER_IDS) expect(r.block({ type: 'BUY_COMPOUND', batchId })).not.toBeNull();
    expect(deathMaterialConservationBlock(r.state)).toBeNull();
  });
  it('does not replace a lost object with cash, a new carrier or a failure flag', () => {
    const r = failed(false, false), p = r.state.compounds[0]!;
    expect(p.status).toBe('FAILED_LOST'); expect(r.state.recoverySites).toEqual([]);
    expect(r.block({ type: 'SEAL_REMAINS', compoundId: p.id })).not.toBeNull();
    expect(r.block({ type: 'RECOVER_SEALED', compoundId: p.id })).not.toBeNull();
    r.travel(policy.supplierLocation); r.step({ type: 'BUY_COMPOUND', batchId: 'death-carrier-2' }); r.travel(policy.workshopLocation);
    expect(r.block({ type: 'COMPOSE_POTION', batchId: 'death-carrier-2' })).not.toBeNull();
  });
  it('hard-locks true severe death and never extracts the embodied characteristic', () => {
    const r = failed(true), p = r.state.compounds[0]!;
    expect(r.h.status).toBe('DEAD'); expect(p.status).toBe('FAILED_LOST');
    for (const command of [{ type: 'SEAL_REMAINS', compoundId: p.id }, { type: 'ASK_RECOVERY_PERMISSION', compoundId: p.id }, { type: 'RECOVER_SEALED', compoundId: p.id }] as DeathMaterialCommand[])
      expect(r.block(command)).not.toBeNull();
    expect(r.state.characteristics[2]).toMatchObject({ holder: 'EMBODIED', location: r.h.actorId, compoundId: null });
    expect(() => transportDeathMaterials(r.state, r.h.location, 'DE0-RECEPTION')).toThrow(/死亡/);
  });
});
