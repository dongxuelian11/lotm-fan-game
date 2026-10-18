import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { SliceState } from '../../src/domain/slice/types.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { deathAcquisitionSnapshot } from '../../src/domain/death/source.js';
import { createDeathMaterialScene, deathMaterialPermissionReply, deathSuccessionRecordIds,
  DEATH_RUNTIME_MATERIAL_POLICY as policy } from '../../src/domain/death/material-content.js';
import { DEATH_HOME } from '../../src/domain/death/content.js';
import { applyDeathServices, createDeathServices, deathServiceConditionVersions, deathServiceVerifiedReceipts } from '../../src/domain/death/services.js';
import { createDeathMaterials, applyDeathMaterial, deathMaterialBlock, transportDeathMaterials,
  prepareDeathPromotion, settleDeathConsumption, spendDeathPreparation,
  type DeathPreparationHost, type DeathMaterialRuntimeHost } from '../../src/domain/death/materials.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DEATH_ORIGINAL_IDS, type DeathMaterialCommand, type DeathPermission, type DeathOriginalId,
  type DeathCarrierId, type DeathServiceCommand, type DeathPromotionPreparation } from '../../src/domain/death/types.js';
import { readObjectEntry } from './read-object-entry.js';

const file = 'tests/fixtures/pale-emperor-v01950/natural.json';
let acquisition: ReturnType<typeof deathAcquisitionSnapshot> | undefined;
function acquisitionOnly() {
  if (!acquisition) {
    if (createHash('sha256').update(readFileSync(file)).digest('hex') !== '14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c') throw Error('Original195 fixture changed');
    acquisition = deathAcquisitionSnapshot(readObjectEntry<SliceState>(file, 'final'));
  }
  return structuredClone(acquisition);
}
/** Bounded material-domain fixtures only. The authentic acquisition snapshot
 * is resolved by the module, but this is explicitly NOT source admission,
 * campaign-body reconstruction, RNG authority, SQLite or a natural run. */
export function deathMaterialScenario() {
  const origin = acquisitionOnly(), scene = createDeathMaterialScene();
  let state = createDeathMaterials({ ...origin, actorId: 'material-component-actor', sourceDigest: 'component-only', inheritanceLocation: DEATH_HOME }, policy);
  let preparations: DeathPromotionPreparation[] = [], workshopPermission: DeathPermission | null = null;
  const h: DeathPreparationHost = { eventId: 'material-1', revision: 1, week: 3329,
    date: { epoch: 'FIFTH_EPOCH', year: 1413, month: 4, day: 14 }, actorId: state.origin.actorId, sourceDigest: state.origin.sourceDigest, sourceEra: 'POST_CYCLE',
    location: 'DE0-RESIDUE-ROOM', nowSecond: 0, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 1000, actions: 100,
    health: 100, mind: 100, spirituality: 120, check: null, serviceReceipts: [], legacyAccess: null, succession: null,
    uniquenessCustodianPresent: false, recoveryPermission: null, uniquenessObservation: null, compoundAccess: null,
    acting: 100, will: 27, injuryCount: 0, promotionWeek: origin.promotionWeek, conditionVersions: {}, workshopPermission: null };
  const tick = (seconds: number) => {
    h.nowSecond += seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; h.date = addGameDays(h.date, 7); }
    h.revision++; h.eventId = `material-${h.revision}`;
  };
  let services = createDeathServices('material-component', h.actorId, h.week, 0);
  const service = (c: DeathServiceCommand) => { const r = applyDeathServices(services, c, h); services = r.state; h.cash -= r.effect.cashCost; h.actions -= r.effect.actions; tick(r.effect.seconds); };
  for (const type of ['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER', 'VERIFY_SERVICE'] as const) service({ type, serviceId: 'residue-sealing' });
  h.location = 'DE0-OLD-WHARF';
  for (const type of ['ASK_PERMISSION', 'SURVEY', 'BUY_SUPPLIES', 'LAY_ROPE', 'SUPPORT_BRIDGE'] as const) service({ type, serviceId: 'old-wharf-exit' });
  for (const workerId of ['DE0-WHARF-WORKER-1', 'DE0-WHARF-WORKER-2'] as const) service({ type: 'ESCORT_WORKER', serviceId: 'old-wharf-exit', workerId });
  service({ type: 'VERIFY_SERVICE', serviceId: 'old-wharf-exit' });
  h.serviceReceipts = deathServiceVerifiedReceipts(services);
  h.conditionVersions = { ...deathServiceConditionVersions(services), 'DE0-WORKSHOP': scene.workshop.conditionVersion,
    'DE0-WORKSHOP-RECEIVING-TRAY': scene.receivingTray.conditionVersion };
  h.location = DEATH_HOME;
  const host = (command?: DeathMaterialCommand): DeathPreparationHost => {
    const out = structuredClone(h), unique = scene.uniqueness;
    out.legacyAccess = null; out.compoundAccess = null; out.recoveryPermission = null;
    out.succession = structuredClone(policy.succession); out.succession.conditionVersion = unique.physicalVersion;
    out.succession.permission = structuredClone(unique.permission);
    out.uniquenessCustodianPresent = unique.adult && unique.custodianPresent && unique.location === h.location;
    out.workshopPermission = structuredClone(workshopPermission);
    const archive = command?.type === 'VERIFY_UNIQUENESS' && command.step === 'CHAIN' && h.location === policy.archiveLocation;
    const carried = ['PLAYER', 'COMPOUND'].includes(state.uniqueness.holder) && state.uniqueness.location === h.location;
    const stored = ['UNVERIFIED', 'CUSTODIAN'].includes(state.uniqueness.holder) && unique.location === h.location && unique.present;
    out.uniquenessObservation = archive || carried || stored ? { observedEventId: h.eventId, revision: h.revision, location: h.location,
      kind: archive ? 'ARCHIVE' : 'PHYSICAL', recordIds: archive ? deathSuccessionRecordIds(out.succession) : [], objectId: unique.objectId,
      seal: unique.seal, objectCount: 1, present: archive || carried || stored, accessible: carried || unique.accessible,
      holderId: carried ? h.actorId : unique.custodianId, physicalVersion: unique.physicalVersion,
      incumbentActorId: unique.incumbentActorId, predecessorStillEmbodied: unique.predecessorStillEmbodied, custodianEmbodied: unique.custodianEmbodied } : null;
    if (command && 'bottleId' in command) {
      const found = state.legacySites.find(x => x.originalBottleId === command.bottleId && x.location === h.location);
      if (found) {
        out.legacyAccess = structuredClone(found);
        if (command.type === 'ASK_LEGACY_PERMISSION') for (const [key, purpose] of [['investigation', 'INVESTIGATE'], ['handover', 'HANDOVER']] as const)
          out.legacyAccess[key] = deathMaterialPermissionReply(scene.legacy.response, found[key], out, purpose, found.custodianId, found.location, found.physicalVersion);
      }
    }
    if (command?.type === 'ASK_UNIQUENESS_PERMISSION') out.succession.permission = deathMaterialPermissionReply(unique.response, unique.permission, out, 'HANDOVER', unique.custodianId, unique.location, unique.physicalVersion);
    if (command && 'compoundId' in command) {
      const access = state.recoverySites.find(x => x.compoundId === command.compoundId && x.location === h.location);
      if (access) {
        out.compoundAccess = structuredClone(access);
        if (command.type === 'ASK_RECOVERY_PERMISSION') out.compoundAccess.handover = deathMaterialPermissionReply(scene.workshop.response, access.handover, out, 'HANDOVER', access.custodianId, access.location, access.physicalVersion);
        out.recoveryPermission = structuredClone(out.compoundAccess.handover);
      }
    }
    return out;
  };
  const step = (command: DeathMaterialCommand) => {
    const current = host(command), r = applyDeathMaterial(state, command, current, policy); state = r.state;
    if (command.type === 'ASK_UNIQUENESS_PERMISSION') scene.uniqueness.permission = structuredClone(current.succession!.permission);
    if (command.type === 'ACQUIRE_UNIQUENESS') scene.uniqueness.present = false;
    h.cash -= r.effect.cashCost; h.actions -= r.effect.actions; tick(r.effect.seconds); return r;
  };
  const travel = (to: string) => {
    const from = h.location; state = transportDeathMaterials(state, from, to);
    if (scene.uniqueness.permission?.status === 'ALLOW' && scene.uniqueness.permission.location === from) scene.uniqueness.permission = null;
    if (from !== to) workshopPermission = null;
    h.location = to; tick(1800);
  };
  const week = () => tick(h.weekAnchor + 604800 - h.nowSecond);
  const locate = (bottleId: DeathOriginalId, labour = true) => {
    if (h.location !== policy.legacyLocation) travel(policy.legacyLocation);
    step({ type: 'ASK_LEGACY_PERMISSION', bottleId }); step({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId });
    step({ type: 'SEAL_LEGACY_REMAINS', bottleId }); if (labour) step({ type: 'LEGACY_LABOUR', bottleId });
  };
  const recoverOriginal = (bottleId: DeathOriginalId) => { step({ type: 'ASK_LEGACY_PERMISSION', bottleId }); return step({ type: 'RECOVER_LEGACY_REMAINS', bottleId }); };
  const materials = () => {
    for (const bottleId of DEATH_ORIGINAL_IDS.slice(0, 2)) locate(bottleId);
    week(); for (const bottleId of DEATH_ORIGINAL_IDS.slice(0, 2)) recoverOriginal(bottleId);
    travel(policy.archiveLocation); step({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
    travel(policy.succession.location); step({ type: 'ASK_UNIQUENESS_PERMISSION' });
    step({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); step({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = (batchId: DeathCarrierId = 'death-carrier-1') => {
    travel(policy.supplierLocation); step({ type: 'BUY_COMPOUND', batchId }); travel(policy.workshopLocation); step({ type: 'COMPOSE_POTION', batchId });
    return state.compounds.at(-1)!;
  };
  const prepare = (id = state.compounds.at(-1)!.id) => {
    workshopPermission = deathMaterialPermissionReply(scene.workshop.response, workshopPermission, h, 'SERVICE', scene.workshop.custodianId, scene.workshop.location, scene.workshop.conditionVersion);
    const r = prepareDeathPromotion(state, preparations, id, host(), policy); preparations = r.state;
    h.cash -= r.effect.cashCost; h.actions -= r.effect.actions; h.spirituality -= r.effect.spirituality; h.mind -= r.effect.mind; tick(r.effect.seconds); return r;
  };
  const fail = (dead = false, present = true) => {
    const p = state.compounds.at(-1)!, current: DeathMaterialRuntimeHost = host();
    // Explicit after-damage module host. Whole-engine damage/RNG is tested in
    // death-runtime; a material settlement cannot admit this as a Slice save.
    current.status = dead ? 'DEAD' : 'ACTIVE'; current.health = dead ? 0 : 55; current.mind = dead ? 0 : 52;
    current.check = resolveNormalCheck({ ability: 'will', baseAbility: 27, difficulty: 57, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }], roll: dead ? 100 : 90 });
    current.compoundAccess = present ? { compoundId: p.id, physicalId: `${p.id}:receiving-tray`, sceneId: 'DE0-WORKSHOP-RECEIVING-TRAY', location: h.location,
      characteristicIds: structuredClone(p.characteristicIds), uniquenessId: p.uniquenessId, custodianId: scene.workshop.custodianId,
      custodianPresent: true, accessible: true, residualPresent: true, physicalVersion: p.physicalVersion + 1, sealed: false, handover: null } : null;
    state = settleDeathConsumption(state, { eventId: h.eventId, week: h.week, compoundId: p.id, success: false, alive: !dead,
      location: h.location, residualPresent: present, physicalVersion: p.physicalVersion + 1 }, current);
    const active = preparations.find(x => x.status === 'READY'); if (active) preparations = spendDeathPreparation(preparations, active.id, h.eventId);
    h.status = current.status; h.health = current.health; h.mind = current.mind; tick(3600); return state;
  };
  return { h, scene, services, host, step, travel, tick, week, locate, recoverOriginal, materials, compose, prepare, fail,
    block: (command: DeathMaterialCommand, override?: DeathMaterialRuntimeHost) => deathMaterialBlock(state, command, override ?? host(command), policy),
    get state() { return state; }, get preparations() { return preparations; } };
}
export { policy };
