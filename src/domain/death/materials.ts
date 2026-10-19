/** R217 candidate material transitions. Not wired or executed.
 * Only the private engine may construct a host. This module neither admits a
 * save nor waives full historical/journal validation, owns RNG, or publishes a
 * draft before SQLite COMMIT. Public input consists only of exact intents. */
import { stableStringify } from '../canonical.js';
import { compareGameDates, isValidGameDate } from '../game-calendar.js';
import { resolveDeathOriginals } from './source.js';
import { DEATH_CONSUMPTION, DEATH_PROMOTION_STABILITY, DEATH_ORIGINAL_BOTTLE_PRICES,
  DEATH_S1_RECOVERY_PRICES, DEATH_CITY_PLACES } from './content.js';
import { createDeathLegacySites, deathSuccessionRecordIds, DEATH_LEGACY_LABOUR,
  DEATH_WORKSHOP_CUSTODIAN, type DeathMaterialRuntimePolicy } from './material-content.js';
import { emptyDeathEffect, type DeathHost, type DeathModuleResult } from './ports.js';
import { DEATH_ORIGINAL_IDS, DEATH_CARRIER_IDS, DEATH_UNIQUENESS_ID, DEATH_LABOUR_IDS,
  type DeathMaterialsState, type DeathMaterialCommand, type DeathMaterialEffect,
  type DeathMaterialSettlement, type DeathHolder, type DeathCompound,
  type DeathOriginalId, type DeathPermission, type DeathSuccession, type DeathServiceReceipt,
  type DeathPromotionPreparation } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 300;
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && (value as number) >= minimum;
const isOriginal = (value: unknown): value is DeathOriginalId => DEATH_ORIGINAL_IDS.some(id => id === value);
const isCompoundId = (value: unknown): value is string => typeof value === 'string' && /^death-compound-[1-3]$/.test(value);
const characteristic = (state: DeathMaterialsState, id: DeathOriginalId) => state.characteristics.find(item => item.originBottleId === id)!;
const external = (state: DeathMaterialsState) => state.characteristics.filter(item => item.originBottleId !== state.embodiedOriginalBottleId);
const liveCompound = (state: DeathMaterialsState) => state.compounds.find(item => item.status !== 'RECOVERED');
const WEEK_SECONDS = 604800;

/** Minimal scene evidence missing from the initial types/ports candidate.
 * The engine obtains it from its owned current world; never from a UI payload.
 * ARCHIVE means actual reading of each named record, not a custodian's claim. */
export interface DeathUniquenessObservation {
  observedEventId: string; revision: number; location: string; kind: 'ARCHIVE' | 'PHYSICAL';
  recordIds: string[]; objectId: typeof DEATH_UNIQUENESS_ID; seal: string; objectCount: 1;
  present: boolean; accessible: boolean; holderId: string; physicalVersion: number;
  incumbentActorId: string | null; predecessorStillEmbodied: boolean; custodianEmbodied: boolean;
}
export type DeathCompoundAccess = import('./types.js').DeathCompoundAccess;
export type DeathMaterialsRuntimeState = DeathMaterialsState;
export interface DeathMaterialRuntimeHost extends DeathHost {
  uniquenessObservation: DeathUniquenessObservation | null;
  compoundAccess: DeathCompoundAccess | null;
}
export interface DeathPreparationHost extends DeathMaterialRuntimeHost {
  acting: number; will: number; injuryCount: number; promotionWeek: number;
  conditionVersions: Record<string, number>; workshopPermission: DeathPermission | null;
}

export function validateDeathMaterialCommand(value: unknown): value is DeathMaterialCommand {
  if (!record(value)) return false;
  const keys = Object.keys(value).sort().join('|');
  if (value.type === 'MATERIAL_LABOUR') return keys === 'bottleId|taskId|type' && isOriginal(value.bottleId) && DEATH_LABOUR_IDS.some(id => id === value.taskId);
  if (['ACQUIRE_CHARACTERISTIC', 'ASK_LEGACY_PERMISSION', 'INVESTIGATE_LEGACY_REMAINS', 'SEAL_LEGACY_REMAINS',
    'LEGACY_LABOUR', 'RECOVER_LEGACY_REMAINS'].includes(String(value.type))) return keys === 'bottleId|type' && isOriginal(value.bottleId);
  if (value.type === 'VERIFY_UNIQUENESS') return keys === 'step|type' && (value.step === 'CHAIN' || value.step === 'VACANCY');
  if (value.type === 'ASK_UNIQUENESS_PERMISSION' || value.type === 'ACQUIRE_UNIQUENESS') return keys === 'type';
  if (value.type === 'BUY_COMPOUND' || value.type === 'COMPOSE_POTION') return keys === 'batchId|type' && DEATH_CARRIER_IDS.some(id => id === value.batchId);
  return ['SEAL_REMAINS', 'ASK_RECOVERY_PERMISSION', 'RECOVER_SEALED'].includes(String(value.type)) && keys === 'compoundId|type' && isCompoundId(value.compoundId);
}
function successionIdentity(value: DeathSuccession): unknown {
  const { permission: _permission, conditionVersion: _version, ...identity } = value;
  return identity;
}
export function validateDeathMaterialPolicy(policy: DeathMaterialRuntimePolicy): boolean {
  try {
    const s = policy.succession;
    return text(policy.id) && [policy.supplierLocation, policy.workshopLocation, policy.archiveLocation, policy.legacyLocation].every(text) &&
      same(policy.carrierPrices, { 'death-carrier-1': 12, 'death-carrier-2': 16, 'death-carrier-3': 20 }) &&
      policy.investigateFee === 4 && policy.legacyRecoveryFee === 12 && policy.legacyLabourCredit === 8 &&
      policy.uniquenessCheckFee === 4 && policy.uniquenessHandoverFee === 8 && policy.composeFee === 8 && policy.sealedRecoveryFee === 12 &&
      policy.operationSeconds === 1800 && policy.composeSeconds === 3600 && policy.stabilitySeconds === 3600 && policy.sealSeconds === 600 &&
      same([...policy.serviceIds].sort(), ['old-wharf-exit', 'residue-sealing']) && s.branchId === 'death-original-future-1412' &&
      s.uniquenessId === DEATH_UNIQUENESS_ID && s.objectCount === 1 && s.predecessorId === 'DE0-PREDECESSOR-1412' &&
      s.predecessorStillEmbodied === false && s.incumbentActorId === null && s.custodianEmbodied === false &&
      s.custodianActorId === 'DE0-UNIQUENESS-CUSTODIAN' && s.permission === null && integer(s.conditionVersion, 1) && text(s.seal) && text(s.location) &&
      s.termination.cause === 'ACTUAL_DEATH' && s.termination.status === 'DEAD' && s.termination.health === 0 &&
      same(s.termination.date, { epoch: 'FIFTH_EPOCH', year: 1412, month: 9, day: 8 }) &&
      same(s.separation.date, s.termination.date) && same(s.transfer.date, { epoch: 'FIFTH_EPOCH', year: 1412, month: 9, day: 9 }) &&
      s.separation.objectId === DEATH_UNIQUENESS_ID && s.transfer.objectId === DEATH_UNIQUENESS_ID &&
      s.transfer.toActorId === s.custodianActorId && s.transfer.custodyOnly === true &&
      same(s.characteristicCustody.map(item => item.originalBottleId), DEATH_ORIGINAL_IDS) &&
      s.characteristicCustody.every(item => item.characteristicId === `${item.originalBottleId}:characteristic` &&
        same(item.separation.date, s.separation.date) && same(item.transfer.date, s.transfer.date) && text(item.transfer.toActorId)) &&
      deathSuccessionRecordIds(s).every(text) && new Set(deathSuccessionRecordIds(s)).size === 9;
  } catch { return false; }
}
/** Full source admission must already have succeeded in the private engine.
 * Recompute lineage here as a consistency check; do not accept a caller's
 * claimed embodied index or infer it from bottle numbers/order. */
export function createDeathMaterials(origin: DeathMaterialsState['origin'], policy: DeathMaterialRuntimePolicy): DeathMaterialsRuntimeState {
  if (!validateDeathMaterialPolicy(policy)) throw Error('有限材料费用、真实时间或同一唯一性的封存链不完整。');
  const { sourceEra, bottles, acquisitionJournal, promotionWeek, resupply } = origin;
  const resolved = resolveDeathOriginals({ sourceEra, bottles, acquisitionJournal, promotionWeek, resupply });
  if (!resolved || !text(origin.actorId) || !text(origin.sourceDigest) || !text(origin.inheritanceLocation)) throw Error('三原份真实来源、本人或继承位置尚未核清。');
  const state: DeathMaterialsRuntimeState = {
    version: 1, origin: clone(origin), embodiedOriginalBottleId: resolved.embodiedOriginalBottleId,
    characteristics: resolved.characteristics.map(item => {
      const bottle = origin.bottles.find(b => b.id === item.latestBottleId);
      if (!bottle || !integer(bottle.labourSteps) || bottle.labourSteps > 5) throw Error('原瓶真实劳务或血缘缺失。');
      return { id: item.id, originBottleId: item.originalBottleId, latestBottleId: item.latestBottleId,
        holder: item.holder === 'FAILED_REMAINS' ? 'UNLOCATED' : item.holder,
        location: item.holder === 'SUPPLIER' ? policy.supplierLocation : item.holder === 'PLAYER' ? origin.inheritanceLocation : item.holder === 'EMBODIED' ? origin.actorId : null,
        compoundId: null, inheritedLabourSteps: bottle.labourSteps, recoveredVessel: !!bottle.recovery,
        labour: [], legacyLabour: null, acquiredEventId: null };
    }),
    legacySites: createDeathLegacySites(resolved), recoverySites: [],
    legacyRemains: resolved.characteristics.filter(item => item.holder === 'FAILED_REMAINS').map(item => ({
      originalBottleId: item.originalBottleId, latestBottleId: item.latestBottleId, characteristicId: item.id,
      consumeRevision: item.consumeRevision!, physicalId: null, sceneId: null, location: null, custodianId: null,
      physicalVersion: null, residualPresent: null, accessible: null, currentPermission: null,
      investigatedEventId: null, sealedEventId: null, sealedWeek: null, sealedSecond: null, recoveredEventId: null,
    })),
    uniqueness: { id: DEATH_UNIQUENESS_ID, holder: 'UNVERIFIED', location: null, compoundId: null,
      incumbentActorId: null, custodianActorId: null, succession: null, checks: [], acquiredEventId: null },
    batches: DEATH_CARRIER_IDS.map(id => ({ id, status: 'SUPPLIER', location: policy.supplierLocation,
      acquiredEventId: null, uses: 0, stopper: { id: `${id}:stopper`, status: 'SUPPLIER', usedEventId: null } })),
    compounds: [], receipts: [], settlements: [],
  };
  const reason = deathMaterialConservationBlock(state); if (reason) throw Error(reason);
  return state;
}

/** Bounded conservation guard on an already owned state. Intentionally not a
 * save validator: engine replays full source, physical acts, payments and RNG. */
export function deathMaterialConservationBlock(state: DeathMaterialsRuntimeState): string | null {
  if (state.version !== 1 || !isOriginal(state.embodiedOriginalBottleId) || state.characteristics.length !== 3 ||
    !same(state.characteristics.map(item => item.originBottleId), DEATH_ORIGINAL_IDS) ||
    state.characteristics.some(item => item.id !== `${item.originBottleId}:characteristic` ||
      !integer(item.inheritedLabourSteps) || item.inheritedLabourSteps + item.labour.length > 5 ||
      item.labour.some((entry, index) => entry.taskId !== DEATH_LABOUR_IDS[item.inheritedLabourSteps + index]) ||
      item.legacyLabour && (item.legacyLabour.credit !== 8 || !text(item.legacyLabour.eventId))) ||
    state.uniqueness.id !== DEATH_UNIQUENESS_ID || !same(state.batches.map(batch => batch.id), DEATH_CARRIER_IDS) ||
    state.compounds.length > 3 || state.legacyRemains.length > 2 || state.legacySites.length !== state.legacyRemains.length ||
    state.recoverySites.length > 3) return '三原份、单唯一性、有限载体或劳务份额冲突。';
  const ids = external(state).map(item => item.id);
  if (state.compounds.some((potion, index) => potion.id !== `death-compound-${index + 1}` ||
    !same(potion.characteristicIds, ids) || potion.uniquenessId !== DEATH_UNIQUENESS_ID ||
    potion.stopperId !== `${potion.batchId}:stopper` || !integer(potion.physicalVersion, 1)) ||
    state.batches.some(batch => batch.uses !== state.compounds.filter(potion => potion.batchId === batch.id).length ||
      batch.uses > 1 || batch.stopper.id !== `${batch.id}:stopper` ||
      (batch.stopper.status === 'USED') !== (batch.stopper.usedEventId !== null))) return '同一原特性不可重领，载体与单次塞不可重复使用。';
  if (new Set(state.legacySites.map(site => site.physicalId)).size !== state.legacySites.length ||
    state.legacyRemains.some(remains => !state.legacySites.some(site => site.originalBottleId === remains.originalBottleId &&
      site.latestBottleId === remains.latestBottleId && site.consumeRevision === remains.consumeRevision && site.characteristicId === remains.characteristicId)) ||
    state.recoverySites.some(site => !state.compounds.some(potion => potion.id === site.compoundId &&
      same(potion.characteristicIds, site.characteristicIds) && potion.uniquenessId === site.uniquenessId)) ||
    new Set(state.recoverySites.map(site => site.compoundId)).size !== state.recoverySites.length) return '现时残余必须逐项对应唯一的真实失败与原件。';
  const active = state.compounds.filter(potion => potion.status !== 'RECOVERED');
  if (active.length > 1) return '上一成药或原处残余未结清，不能并存第二份同原件成药。';
  const potion = active[0], own = characteristic(state, state.embodiedOriginalBottleId);
  if (potion) {
    const holders: Record<Exclude<DeathCompound['status'], 'RECOVERED'>, DeathHolder> = {
      PREPARED: 'COMPOUND', SUCCESS: 'FUSED', FAILED_EXPOSED: 'EXPOSED', FAILED_SEALED: 'SEALED', FAILED_LOST: 'LOST',
    };
    const holder = holders[potion.status as Exclude<DeathCompound['status'], 'RECOVERED'>];
    if ([...external(state), state.uniqueness].some(item => item.holder !== holder || item.compoundId !== potion.id ||
      item.location !== (holder === 'FUSED' ? state.origin.actorId : potion.location))) return '外置两原份或同一唯一性的现物位置与成药不一致。';
    if (own.holder !== (potion.status === 'SUCCESS' ? 'FUSED' : 'EMBODIED') || own.location !== state.origin.actorId ||
      own.compoundId !== (potion.status === 'SUCCESS' ? potion.id : null)) return '体内原份必须留在同一本人身体，死亡也不能变成库存。';
    if (potion.status === 'SUCCESS' ? state.uniqueness.incumbentActorId !== state.origin.actorId : state.uniqueness.incumbentActorId !== null) return '唯一性的实际容纳人冲突。';
  } else if (own.holder !== 'EMBODIED' || own.location !== state.origin.actorId || own.compoundId !== null ||
    external(state).some(item => !['SUPPLIER', 'PLAYER', 'UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder)) ||
    !['UNVERIFIED', 'CUSTODIAN', 'PLAYER'].includes(state.uniqueness.holder) || state.uniqueness.incumbentActorId !== null) return '尚未调配时的本人、供货者与保管物权冲突。';
  return null;
}

export function deathMaterialEffect(state: DeathMaterialsState, command: DeathMaterialCommand, policy: DeathMaterialRuntimePolicy): DeathMaterialEffect {
  const effect = { actions: 1, cashCost: 0, seconds: policy.operationSeconds as number };
  switch (command.type) {
    case 'ASK_LEGACY_PERMISSION': case 'ASK_UNIQUENESS_PERMISSION': case 'ASK_RECOVERY_PERMISSION': effect.actions = 0; break;
    case 'MATERIAL_LABOUR': case 'LEGACY_LABOUR': break;
    case 'ACQUIRE_CHARACTERISTIC': {
      const item = characteristic(state, command.bottleId), completed = item.inheritedLabourSteps + item.labour.length === 5;
      const era = state.origin.sourceEra;
      const prices = item.recoveredVessel ? DEATH_S1_RECOVERY_PRICES[era] : DEATH_ORIGINAL_BOTTLE_PRICES[era];
      effect.cashCost = item.holder === 'PLAYER' ? 0 : completed ? prices.afterLabour : prices.full;
      break;
    }
    case 'INVESTIGATE_LEGACY_REMAINS': effect.cashCost = policy.investigateFee; break;
    case 'RECOVER_LEGACY_REMAINS': {
      const credit = characteristic(state, command.bottleId).legacyLabour;
      effect.cashCost = policy.legacyRecoveryFee - (credit && !credit.spentEventId ? credit.credit : 0); break;
    }
    case 'VERIFY_UNIQUENESS': effect.cashCost = policy.uniquenessCheckFee; break;
    case 'ACQUIRE_UNIQUENESS': effect.actions = 0; effect.cashCost = policy.uniquenessHandoverFee; break;
    case 'BUY_COMPOUND': effect.actions = 0; effect.cashCost = policy.carrierPrices[command.batchId]; break;
    case 'COMPOSE_POTION': effect.cashCost = policy.composeFee; effect.seconds = policy.composeSeconds; break;
    case 'SEAL_LEGACY_REMAINS': case 'SEAL_REMAINS': effect.actions = 0; effect.seconds = policy.sealSeconds; break;
    case 'RECOVER_SEALED': effect.cashCost = policy.sealedRecoveryFee; break;
  }
  return effect;
}
function permissionMatches(permission: DeathPermission | null, purpose: DeathPermission['purpose'], host: DeathHost,
  personId: string, location: string, version: number, answerNow = false): boolean {
  return !!permission && permission.personId === personId && permission.actorId === host.actorId && permission.purpose === purpose &&
    permission.location === location && permission.conditionVersion === version && permission.week === host.week &&
    text(permission.eventId) && integer(permission.revision, 1) && permission.revision <= host.revision &&
    ['ALLOW', 'REFUSED', 'WITHDRAWN'].includes(permission.status) &&
    (!answerNow || permission.eventId === host.eventId && permission.revision === host.revision);
}
function currentPermission(permission: DeathPermission | null, purpose: DeathPermission['purpose'], host: DeathHost,
  personId: string, location: string, version: number): boolean {
  return permissionMatches(permission, purpose, host, personId, location, version) && permission!.status === 'ALLOW';
}
/** Workshop SERVICE consent belongs to the same uninterrupted visit, not to
 * the calendar's week number. Its original event/revision remain unchanged.
 * The engine clears allowed consent and invalidates preparation on departure;
 * current bound versions and withdrawal are still rechecked on every action.
 * Property investigation/handover permissions above remain current-week only. */
function currentWorkshopPermission(permission: DeathPermission | null, host: DeathPreparationHost): boolean {
  const version = host.conditionVersions['DE0-WORKSHOP'];
  return !!permission && permission.status === 'ALLOW' && permission.purpose === 'SERVICE' &&
    permission.personId === DEATH_WORKSHOP_CUSTODIAN.id && permission.actorId === host.actorId &&
    permission.location === host.location && integer(version, 1) && permission.conditionVersion === version &&
    integer(permission.week, 1) && permission.week <= host.week && text(permission.eventId) &&
    integer(permission.revision, 1) && permission.revision <= host.revision;
}
function hostBlock(state: DeathMaterialsRuntimeState, host: DeathHost): string | null {
  if (host.status !== 'ACTIVE' || host.sequence !== 1 || host.actorId !== state.origin.actorId || host.sourceDigest !== state.origin.sourceDigest ||
    host.sourceEra !== state.origin.sourceEra || !text(host.eventId) || !integer(host.revision, 1) || !integer(host.week, 1) ||
    !isValidGameDate(host.date) || !integer(host.nowSecond) || !integer(host.weekAnchor) ||
    host.nowSecond < host.weekAnchor || host.nowSecond >= host.weekAnchor + WEEK_SECONDS || !integer(host.actions) || !integer(host.cash)) return '须同一仍活着的苍白皇帝本人在当前真实时间处置原物。';
  const invariant = deathMaterialConservationBlock(state); if (invariant) return invariant;
  if (state.receipts.some(receipt => receipt.eventId === host.eventId) || state.settlements.some(receipt => receipt.eventId === host.eventId)) return '同一动作已经结算，不能重复付费、移动原件或获得抵扣。';
  return null;
}
function legacyBlock(state: DeathMaterialsRuntimeState, id: DeathOriginalId, host: DeathMaterialRuntimeHost): string | null {
  const access = host.legacyAccess, remains = state.legacyRemains.find(item => item.originalBottleId === id);
  const site = state.legacySites.find(item => item.originalBottleId === id);
  if (!access || !remains || !site || remains.recoveredEventId || access.originalBottleId !== id || access.latestBottleId !== remains.latestBottleId ||
    access.characteristicId !== remains.characteristicId || access.consumeRevision !== remains.consumeRevision || access.physicalId !== site.physicalId || access.physicalVersion !== site.physicalVersion || !site.residualPresent ||
    access.sceneId !== site.sceneId || access.location !== site.location || access.custodianId !== site.custodianId || access.location !== host.location ||
    !access.custodianPresent || !access.accessible || !access.residualPresent || !integer(access.physicalVersion, 1)) return '须亲到本次原失败的实际场地，确认同一残余仍在、可接近且现任成年保管人在场。';
  if (remains.investigatedEventId && (remains.physicalId !== access.physicalId || remains.sceneId !== access.sceneId ||
    remains.location !== access.location || remains.custodianId !== access.custodianId || remains.physicalVersion !== access.physicalVersion)) return '先前实查的原件或场地条件已变，旧记录不能代替当前现物。';
  return null;
}
function successionBlock(host: DeathMaterialRuntimeHost, policy: DeathMaterialRuntimePolicy): string | null {
  const succession = host.succession;
  if (compareGameDates(host.date, policy.succession.transfer.date) < 0 || !succession ||
    !same(successionIdentity(succession), successionIdentity(policy.succession)) || !integer(succession.conditionVersion, 1)) return '前任死亡、分离、三原份交接或同一唯一性封存链不完整，或存在冲突容纳人。';
  return null;
}
function uniquenessObserved(host: DeathMaterialRuntimeHost, policy: DeathMaterialRuntimePolicy, kind: 'ARCHIVE' | 'PHYSICAL', holderId: string): boolean {
  const observation = host.uniquenessObservation;
  return !!observation && observation.observedEventId === host.eventId && observation.revision === host.revision &&
    observation.kind === kind && observation.location === host.location && observation.objectId === DEATH_UNIQUENESS_ID &&
    observation.seal === policy.succession.seal && observation.objectCount === 1 && observation.incumbentActorId === null &&
    observation.predecessorStillEmbodied === false && observation.custodianEmbodied === false &&
    observation.physicalVersion === host.succession?.conditionVersion &&
    (kind === 'ARCHIVE' ? same([...observation.recordIds].sort(), deathSuccessionRecordIds(policy.succession).sort()) :
      observation.present && observation.accessible && observation.holderId === holderId);
}
function compoundAccessBlock(state: DeathMaterialsRuntimeState, potion: DeathCompound, host: DeathMaterialRuntimeHost): string | null {
  const access = host.compoundAccess, original = state.recoverySites.find(site => site.compoundId === potion.id);
  if (!access || !original || access.compoundId !== potion.id || access.physicalId !== original.physicalId ||
    access.sceneId !== original.sceneId || access.location !== potion.location || access.location !== host.location ||
    access.custodianId !== original.custodianId || !access.custodianPresent || !access.accessible || !access.residualPresent ||
    !potion.residualPresent || access.physicalVersion !== potion.physicalVersion || access.physicalVersion !== original.physicalVersion || !original.residualPresent || access.sealed !== (potion.status === 'FAILED_SEALED') ||
    !same(access.characteristicIds, potion.characteristicIds) || access.uniquenessId !== DEATH_UNIQUENESS_ID) return '须实查同一承接盘与原残余仍在、未灭失未被取走，且现场当前允许接近。';
  return null;
}
export function deathServiceReceiptsComplete(receipts: DeathServiceReceipt[], policy: DeathMaterialRuntimePolicy, week: number): boolean {
  return receipts.length === 2 && same(receipts.map(receipt => receipt.serviceId).sort(), [...policy.serviceIds].sort()) &&
    new Set(receipts.flatMap(receipt => [receipt.passedEventId, receipt.reviewedEventId])).size === 4 &&
    receipts.every(receipt => receipt.residentIds.length >= 1 && receipt.apparatusIds.length >= 1 &&
      [...receipt.residentIds, ...receipt.apparatusIds, receipt.passedEventId, receipt.reviewedEventId].every(text) &&
      new Set(receipt.residentIds).size === receipt.residentIds.length && new Set(receipt.apparatusIds).size === receipt.apparatusIds.length &&
      integer(receipt.passedWeek, 1) && integer(receipt.reviewedWeek, receipt.passedWeek) && receipt.reviewedWeek <= week &&
      Object.keys(receipt.conditionVersions).length > 0 && Object.values(receipt.conditionVersions).every(version => integer(version, 1))) &&
    receipts.find(receipt => receipt.serviceId === 'old-wharf-exit')!.residentIds.length === 2;
}

export function deathMaterialBlock(state: DeathMaterialsRuntimeState, command: DeathMaterialCommand, host: DeathMaterialRuntimeHost,
  policy: DeathMaterialRuntimePolicy): string | null {
  if (!validateDeathMaterialCommand(command)) return '材料动作只接受本次意图，不接受外部物权、许可、费用或回执。';
  const common = hostBlock(state, host); if (common) return common;
  let place = policy.supplierLocation;
  if ('bottleId' in command) {
    const item = characteristic(state, command.bottleId);
    if (command.type === 'MATERIAL_LABOUR') {
      if (item.holder !== 'SUPPLIER' || DEATH_LABOUR_IDS[item.inheritedLabourSteps + item.labour.length] !== command.taskId) return '只能补做这一真实原瓶尚缺的下一项劳务，不能重用已做或其他原瓶的劳动。';
    } else if (command.type === 'ACQUIRE_CHARACTERISTIC') {
      if (!['SUPPLIER', 'PLAYER'].includes(item.holder) || item.acquiredEventId) return '体内份不能领取；已交接原件不可重复买卖。';
      if (item.holder === 'PLAYER') place = item.location!;
    } else {
      const blocked = legacyBlock(state, command.bottleId, host); if (blocked) return blocked;
      const access = host.legacyAccess!, remains = state.legacyRemains.find(r => r.originalBottleId === command.bottleId)!;
      const site = state.legacySites.find(s => s.originalBottleId === command.bottleId)!; place = access.location;
      if (command.type === 'ASK_LEGACY_PERMISSION') {
        if (site.investigation && site.investigation.status !== 'ALLOW' && access.investigation?.status !== site.investigation.status ||
          site.handover && site.handover.status !== 'ALLOW' && access.handover?.status !== site.handover.status) return '已经拒绝或撤回的许可不能因再次询问自动变成同意。';
        if (site.investigation?.week === host.week && site.handover?.week === host.week &&
          site.investigation.conditionVersion === access.physicalVersion && site.handover.conditionVersion === access.physicalVersion) return '本次同一现场已经作出答复，不重复询问推进时间。';
        if (!['UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder) ||
          !permissionMatches(access.investigation, 'INVESTIGATE', host, access.custodianId, access.location, access.physicalVersion, true) ||
          !permissionMatches(access.handover, 'HANDOVER', host, access.custodianId, access.location, access.physicalVersion, true)) return '须由在场成年保管人作出本次调查和封存交接的真实答复；拒绝同样记入，不自动改为同意。';
      } else {
        const purpose = command.type === 'INVESTIGATE_LEGACY_REMAINS' || command.type === 'LEGACY_LABOUR' ? 'INVESTIGATE' : 'HANDOVER';
        const permission = purpose === 'INVESTIGATE' ? access.investigation : access.handover;
        const recorded = purpose === 'INVESTIGATE' ? site.investigation : site.handover;
        if (!currentPermission(permission, purpose, host, access.custodianId, access.location, access.physicalVersion) || !same(permission, recorded) ||
          !state.receipts.some(receipt => receipt.eventId === permission!.eventId && receipt.command.type === 'ASK_LEGACY_PERMISSION' && receipt.command.bottleId === command.bottleId)) return '须本次在场询问并取得仍有效的许可，旧许可、撤回或他物许可不可沿用。';
        if (command.type === 'INVESTIGATE_LEGACY_REMAINS' && (item.holder !== 'UNLOCATED' || remains.investigatedEventId)) return '已经实查的原残余不重复收费调查。';
        if (command.type === 'SEAL_LEGACY_REMAINS' && (item.holder !== 'LOCATED' || !remains.investigatedEventId || remains.sealedEventId)) return '先实查定位同一残余，再亲手封存。';
        if (command.type === 'LEGACY_LABOUR' && (!['LOCATED', 'LEGACY_SEALED'].includes(item.holder) || !remains.investigatedEventId || item.legacyLabour)) return '只可对已实查同一原件完成一次指定劳务；8便士抵扣不可复做、转移或提现。';
        if (command.type === 'RECOVER_LEGACY_REMAINS' && (item.holder !== 'LEGACY_SEALED' || remains.sealedWeek === null ||
          remains.sealedSecond === null || host.week <= remains.sealedWeek || host.nowSecond <= remains.sealedSecond)) return '须同一原物已经实际封存，至少下一真实周回原处付费交接。';
      }
    }
  } else if (command.type === 'VERIFY_UNIQUENESS' || command.type === 'ASK_UNIQUENESS_PERMISSION' || command.type === 'ACQUIRE_UNIQUENESS') {
    const blocked = successionBlock(host, policy); if (blocked) return blocked;
    const uniqueness = state.uniqueness, succession = host.succession!;
    if (!['UNVERIFIED', 'CUSTODIAN'].includes(uniqueness.holder) || uniqueness.incumbentActorId !== null) return '同一唯一性已转移或已被容纳，不能再次交付。';
    place = command.type === 'VERIFY_UNIQUENESS' && command.step === 'CHAIN' ? policy.archiveLocation : succession.location;
    if (command.type === 'VERIFY_UNIQUENESS' && command.step === 'CHAIN') {
      if (uniqueness.checks.some(check => check.step === 'CHAIN') || !uniquenessObserved(host, policy, 'ARCHIVE', succession.custodianActorId)) return '须逐一亲查前任死亡、分离、三原份与同一唯一性交接的九条档案；口头断言不能代替。';
    } else {
      if (!host.uniquenessCustodianPresent || !uniquenessObserved(host, policy, 'PHYSICAL', succession.custodianActorId)) return '须现场实查同一封签、原物位置、非容纳保管与当前神位空缺。';
      if (command.type === 'ASK_UNIQUENESS_PERMISSION') {
        const previous = uniqueness.succession?.permission;
        if (previous && previous.status !== 'ALLOW' && succession.permission?.status !== previous.status) return '唯一性保管人的拒绝或撤回不能自动重置。';
        if (previous?.week === host.week && previous.conditionVersion === succession.conditionVersion) return '同一现场本次已有答复，不重复询问。';
        if (!permissionMatches(succession.permission, 'HANDOVER', host, succession.custodianActorId, place, succession.conditionVersion, true)) return '保管人尚未在当前现场给出本次交付答复。';
      } else {
        if (!currentPermission(succession.permission, 'HANDOVER', host, succession.custodianActorId, place, succession.conditionVersion) ||
          !same(succession.permission, uniqueness.succession?.permission) || !state.receipts.some(receipt =>
            receipt.eventId === succession.permission!.eventId && receipt.command.type === 'ASK_UNIQUENESS_PERMISSION')) return '先取得当前在场保管人的本次交付许可。';
        if (command.type === 'VERIFY_UNIQUENESS') {
          if (!uniqueness.checks.some(check => check.step === 'CHAIN')) return '须先逐项核保管链，再现场核当前空位。';
          if (uniqueness.checks.some(check => check.step === 'VACANCY' && check.week === host.week && check.conditionVersion === succession.conditionVersion)) return '本周同一现物条件的空位已经实查。';
        } else if (!uniqueness.checks.some(check => check.step === 'CHAIN') || !uniqueness.checks.some(check =>
          check.step === 'VACANCY' && check.week === host.week && check.conditionVersion === succession.conditionVersion)) return '付费交接前须有本周同一现物条件的保管链和空位核验。';
      }
    }
  } else if ('batchId' in command) {
    const batch = state.batches.find(item => item.id === command.batchId)!;
    if (command.type === 'BUY_COMPOUND') {
      if (batch.status !== 'SUPPLIER' || batch.stopper.status !== 'SUPPLIER' || state.batches.find(item => item.status === 'SUPPLIER')?.id !== batch.id) return '仅依次购买三件普通载体及各自单次塞，不补出第四件。';
    } else {
      place = policy.workshopLocation;
      if (!deathServiceReceiptsComplete(host.serviceReceipts, policy, host.week)) return '须持有两件真实居民任务的完成与交接核验回执。';
      if (batch.status !== 'PLAYER' || batch.location !== place || batch.uses !== 0 || batch.stopper.status !== 'PLAYER' || liveCompound(state)) return '须带来自己未用载体，并先结清上一份同原件成药或失败残余。';
      if (characteristic(state, state.embodiedOriginalBottleId).holder !== 'EMBODIED' || [...external(state), state.uniqueness].some(item =>
        item.holder !== 'PLAYER' || item.location !== place || !item.acquiredEventId)) return '体内一份仍在本人；仅另外两原份与唯一性实际带入调配室。';
      const blocked = successionBlock(host, policy); if (blocked) return blocked;
      if (!uniquenessObserved(host, policy, 'PHYSICAL', host.actorId)) return '调配前须重新实查本人带来的同一唯一性与当前空位。';
    }
  } else {
    const potion = state.compounds.find(item => item.id === command.compoundId);
    if (!potion) return '没有这份真实成药。'; place = potion.location;
    const blocked = compoundAccessBlock(state, potion, host); if (blocked) return blocked;
    const access = host.compoundAccess!, site = state.recoverySites.find(item => item.compoundId === potion.id)!;
    if (command.type === 'SEAL_REMAINS') {
      const batch = state.batches.find(item => item.id === potion.batchId)!;
      if (potion.status !== 'FAILED_EXPOSED' || batch.stopper.status !== 'PLAYER' || batch.stopper.usedEventId) return '只可用已购本载体的未用单次塞，在原承接盘封存本次真实残余。';
    } else if (command.type === 'ASK_RECOVERY_PERMISSION') {
      if (site.handover && site.handover.status !== 'ALLOW' && access.handover?.status !== site.handover.status) return '残余交接被拒绝或撤回，不能自动恢复同意。';
      if (site.handover?.week === host.week && site.handover.conditionVersion === access.physicalVersion) return '本次残余交接已经得到答复，不重复询问。';
      if (potion.status !== 'FAILED_SEALED' || !permissionMatches(access.handover, 'HANDOVER', host, access.custodianId, place, access.physicalVersion, true) ||
        !same(access.handover, host.recoveryPermission)) return '须当面询问本次封存原物的交付许可，不能远程或用旧许可代替。';
    } else if (potion.status !== 'FAILED_SEALED' || potion.sealedWeek === null || potion.sealedSecond === null ||
      host.week <= potion.sealedWeek || host.nowSecond <= potion.sealedSecond || !currentPermission(access.handover, 'HANDOVER', host, access.custodianId, place, access.physicalVersion) ||
      !same(access.handover, site.handover) || !same(access.handover, host.recoveryPermission) || !state.receipts.some(receipt =>
        receipt.eventId === access.handover!.eventId && receipt.command.type === 'ASK_RECOVERY_PERMISSION' && receipt.command.compoundId === potion.id)) return '至少隔一真实周，回同一原处实查并取得本次许可，再付12便士与1行动回收。';
  }
  if (host.location !== place) return '本人须沿实际普通通路到达该原物所在位置。';
  const effect = deathMaterialEffect(state, command, policy);
  return host.actions < effect.actions ? `须有${effect.actions}行动。` : host.cash < effect.cashCost ? `须实付${effect.cashCost}便士。` : null;
}

export function applyDeathMaterial(state: DeathMaterialsRuntimeState, command: DeathMaterialCommand, host: DeathMaterialRuntimeHost,
  policy: DeathMaterialRuntimePolicy): DeathModuleResult<DeathMaterialsRuntimeState> {
  const reason = deathMaterialBlock(state, command, host, policy); if (reason) throw Error(reason);
  const next = clone(state), materialEffect = deathMaterialEffect(state, command, policy);
  const effect = { ...emptyDeathEffect(), ...materialEffect }, notes: string[] = [];
  const endSecond = host.nowSecond + effect.seconds;
  const endWeek = host.week + Math.floor((endSecond - host.weekAnchor) / WEEK_SECONDS);
  if (command.type === 'MATERIAL_LABOUR') {
    characteristic(next, command.bottleId).labour.push({ taskId: command.taskId, eventId: host.eventId, week: host.week });
    notes.push('只补做本原瓶原劳务序列中的下一项；历史已做劳务、付款和其他瓶均不改写。');
  } else if (command.type === 'ACQUIRE_CHARACTERISTIC') {
    const item = characteristic(next, command.bottleId), paidBefore = item.holder === 'PLAYER';
    Object.assign(item, { holder: 'PLAYER', location: host.location, acquiredEventId: host.eventId });
    notes.push(paidBefore ? '已付原瓶实际到场并转入本章材料账，不再购买或重做原劳务。' : '原供应方只交出这份同一原特性，按真实时代与未复用的劳务结清载体费用。');
  } else if ('bottleId' in command) {
    const item = characteristic(next, command.bottleId), remains = next.legacyRemains.find(r => r.originalBottleId === command.bottleId)!;
    const site = next.legacySites.find(s => s.originalBottleId === command.bottleId)!, access = host.legacyAccess!;
    if (command.type === 'ASK_LEGACY_PERMISSION') {
      Object.assign(site, clone(access));
      remains.currentPermission = clone(item.holder === 'UNLOCATED' ? access.investigation : access.handover);
      notes.push(`在原室当面询问当前保管人：调查${access.investigation!.status === 'ALLOW' ? '获准' : '未获准'}，封存交接${access.handover!.status === 'ALLOW' ? '获准' : '未获准'}；答复不等于已找到原物。`);
    } else if (command.type === 'INVESTIGATE_LEGACY_REMAINS') {
      Object.assign(item, { holder: 'LOCATED', location: host.location });
      Object.assign(remains, { physicalId: access.physicalId, sceneId: access.sceneId, location: access.location,
        custodianId: access.custodianId, physicalVersion: access.physicalVersion, residualPresent: true,
        accessible: true, currentPermission: clone(access.investigation), investigatedEventId: host.eventId });
      notes.push(`亲查${item.originBottleId}最后一次真实失败留下的同一现物；只从本次起记录现场，不补写旧失败回执。`);
    } else if (command.type === 'SEAL_LEGACY_REMAINS') {
      item.holder = 'LEGACY_SEALED';
      Object.assign(remains, { sealedEventId: host.eventId, sealedWeek: endWeek, sealedSecond: endSecond,
        currentPermission: clone(access.handover) });
      notes.push('同一原残余留在原处封存，尚未成为本人库存；最早下一真实周付费交接。');
    } else if (command.type === 'LEGACY_LABOUR') {
      item.legacyLabour = { eventId: host.eventId, week: host.week, credit: 8, spentEventId: null };
      notes.push(`${DEATH_LEGACY_LABOUR.label}；本原件一次劳务只抵其交接费8便士，不发现金、不代替其他瓶劳务。`);
    } else {
      Object.assign(item, { holder: 'PLAYER', location: host.location, acquiredEventId: host.eventId });
      if (item.legacyLabour) item.legacyLabour.spentEventId = host.eventId;
      Object.assign(remains, { recoveredEventId: host.eventId, residualPresent: false, currentPermission: clone(access.handover) });
      site.residualPresent = false; site.physicalVersion += 1; site.investigation = null; site.handover = null;
      notes.push('隔周在原现场交接同一原特性；原处实体已移走，一次劳务抵扣已经耗用。');
    }
  } else if (command.type === 'ASK_UNIQUENESS_PERMISSION') {
    Object.assign(next.uniqueness, { holder: 'CUSTODIAN', location: host.succession!.location,
      custodianActorId: host.succession!.custodianActorId, succession: clone(host.succession) });
    notes.push(host.succession!.permission!.status === 'ALLOW' ? '当面取得同一唯一性本次交付许可，仍须实查档案与当前空位。' : '保管人本次没有允许交付，未转移唯一性。');
  } else if (command.type === 'VERIFY_UNIQUENESS') {
    if (command.step === 'VACANCY') next.uniqueness.checks = next.uniqueness.checks.filter(check => check.step !== 'VACANCY');
    next.uniqueness.checks.push({ step: command.step, eventId: host.eventId, week: host.week, conditionVersion: host.succession!.conditionVersion });
    Object.assign(next.uniqueness, { holder: 'CUSTODIAN', location: host.succession!.location,
      custodianActorId: host.succession!.custodianActorId, succession: clone(host.succession) });
    notes.push(command.step === 'CHAIN' ? '逐项实查前任于1412年9月8日真实死亡与分离、9月9日三原份和同一唯一性的封存交接，九条档案全部对应。' :
      '现场逐项核对同一原封签、唯一实物、当前空位、原物位置与未容纳保管人；没有另造第二件唯一性。');
  } else if (command.type === 'ACQUIRE_UNIQUENESS') {
    Object.assign(next.uniqueness, { holder: 'PLAYER', location: host.location, custodianActorId: null, acquiredEventId: host.eventId });
    notes.push('实付8便士，当面接过同一DE0-U1；仅转移保管物权，没有生成另一件原物。');
  } else if ('batchId' in command) {
    const batch = next.batches.find(item => item.id === command.batchId)!;
    if (command.type === 'BUY_COMPOUND') {
      Object.assign(batch, { status: 'PLAYER', location: host.location, acquiredEventId: host.eventId });
      batch.stopper.status = 'PLAYER';
      notes.push('实购这一件普通载体和它唯一的单次封存塞。');
    } else {
      const id = `death-compound-${next.compounds.length + 1}`, outside = external(next);
      batch.status = 'IN_COMPOUND'; batch.uses = 1;
      for (const item of [...outside, next.uniqueness]) Object.assign(item, { holder: 'COMPOUND', location: host.location, compoundId: id });
      next.compounds.push({ id, batchId: batch.id, status: 'PREPARED', location: host.location,
        characteristicIds: [outside[0]!.id, outside[1]!.id], uniquenessId: DEATH_UNIQUENESS_ID,
        preparedEventId: host.eventId, preparedWeek: endWeek, consumedWeek: null, sealedWeek: null, sealedSecond: null,
        settlementEventId: null, sealedEventId: null, recoveredEventId: null, residualPresent: true, physicalVersion: 1,
        stopperId: batch.stopper.id, serviceReceipts: clone(host.serviceReceipts) });
      notes.push('仅将两份外置原特性与同一唯一性装入实购载体；本人已融合原份仍在同一本人身体。');
    }
  } else {
    const potion = next.compounds.find(item => item.id === command.compoundId)!;
    const site = next.recoverySites.find(item => item.compoundId === potion.id)!;
    if (command.type === 'SEAL_REMAINS') {
      const batch = next.batches.find(item => item.id === potion.batchId)!;
      Object.assign(potion, { status: 'FAILED_SEALED', sealedWeek: endWeek, sealedSecond: endSecond,
        sealedEventId: host.eventId, physicalVersion: potion.physicalVersion + 1 });
      batch.stopper.status = 'USED'; batch.stopper.usedEventId = host.eventId;
      Object.assign(site, { sealed: true, physicalVersion: potion.physicalVersion, handover: null });
      for (const item of [...external(next), next.uniqueness]) item.holder = 'SEALED';
      notes.push('幸存本人用本载体已买的单次塞实际封存600秒。原两份与唯一性留在原承接盘，本人体内份没有取出。');
    } else if (command.type === 'ASK_RECOVERY_PERMISSION') {
      site.handover = clone(host.compoundAccess!.handover);
      notes.push(site.handover!.status === 'ALLOW' ? '当面取得这次同一封存残余的交接许可。' : '本次残余交接未获准，原物留在原处。');
    } else {
      Object.assign(potion, { status: 'RECOVERED', recoveredEventId: host.eventId, residualPresent: false,
        physicalVersion: potion.physicalVersion + 1 });
      Object.assign(site, { residualPresent: false, physicalVersion: potion.physicalVersion, handover: null });
      for (const item of [...external(next), next.uniqueness]) Object.assign(item, { holder: 'PLAYER', location: host.location, compoundId: null });
      notes.push('隔周实付12便士与1行动，回收同一外置两份和唯一性；已耗载体、药液与封存塞不恢复。');
    }
  }
  next.receipts.push({ eventId: host.eventId, revision: host.revision, week: host.week, location: host.location,
    command: clone(command), effect: clone(materialEffect) });
  notes.push(`本次实付${effect.cashCost}便士、${effect.actions}行动，用时${effect.seconds}秒；所有资源由本章引擎一次结算。`);
  const invariant = deathMaterialConservationBlock(next); if (invariant) throw Error(invariant);
  return { state: next, effect, notes };
}

/** Only invoke inside the private travel draft, after validating the ordinary
 * route. Move carried objects only; never move custodians, sealed remnants or
 * the embodied original. Engine also invalidates all ready preparations. */
export function transportDeathMaterials(state: DeathMaterialsRuntimeState, from: string, to: string): DeathMaterialsRuntimeState {
  if (state.settlements.some(settlement => !settlement.alive)) throw Error('死亡后的物体留在真实原处，不能继续运输或回收。');
  const next = clone(state);
  if (from === to) return next;
  for (const site of next.legacySites) if (site.location === from) {
    if (site.investigation?.status === 'ALLOW') site.investigation = null;
    if (site.handover?.status === 'ALLOW') site.handover = null;
  }
  for (const remains of next.legacyRemains) if (remains.location === from) remains.currentPermission = null;
  for (const site of next.recoverySites) if (site.location === from && site.handover?.status === 'ALLOW') site.handover = null;
  if (next.uniqueness.succession?.permission?.location === from && next.uniqueness.succession.permission.status === 'ALLOW') next.uniqueness.succession.permission = null;
  for (const item of [...next.characteristics, next.uniqueness]) if (item.holder === 'PLAYER' && item.location === from) item.location = to;
  for (const batch of next.batches) if (batch.status === 'PLAYER' && batch.location === from) batch.location = to;
  for (const potion of next.compounds) if (potion.status === 'PREPARED' && potion.location === from) {
    potion.location = to; next.batches.find(batch => batch.id === potion.batchId)!.location = to;
    for (const item of [...external(next), next.uniqueness]) if (item.compoundId === potion.id) item.location = to;
  }
  const invariant = deathMaterialConservationBlock(next); if (invariant) throw Error(invariant);
  return next;
}
/** Called only after the private engine has made exactly one recorded normal
 * d100 check, charged consumption AP/spirituality, and applied its real bodily
 * outcome. Neither an arbitrary boolean nor a historical survival floor may
 * supply the outcome. Host here is the actual AFTER-damage body, same event. */
export function settleDeathConsumption(state: DeathMaterialsRuntimeState, input: DeathMaterialSettlement,
  host: DeathMaterialRuntimeHost): DeathMaterialsRuntimeState {
  const next = clone(state), potion = next.compounds.find(item => item.id === input.compoundId);
  const check = host.check, success = check?.tier === 'SUCCESS' || check?.tier === 'GREAT_SUCCESS';
  if (!potion || potion.status !== 'PREPARED' || potion.location !== input.location || host.location !== input.location ||
    host.actorId !== next.origin.actorId || host.sourceDigest !== next.origin.sourceDigest || host.eventId !== input.eventId || host.week !== input.week ||
    !check || success !== input.success || input.alive !== (host.status === 'ACTIVE' && host.health > 0 && host.mind > 0) ||
    input.success && !input.alive || check.tier === 'GREAT_FAILURE' && input.alive || input.week < potion.preparedWeek || !integer(input.physicalVersion, potion.physicalVersion + 1) ||
    next.settlements.some(entry => entry.eventId === input.eventId || entry.compoundId === input.compoundId) ||
    next.receipts.some(entry => entry.eventId === input.eventId)) throw Error('同一成药的真实检定、身体结局、时间或单次物权结算不一致。');
  const access = host.compoundAccess;
  if (!success && input.residualPresent && (!access || access.compoundId !== potion.id || access.location !== input.location ||
    access.sceneId !== 'DE0-WORKSHOP-RECEIVING-TRAY' || access.physicalId !== `${potion.id}:receiving-tray` ||
    access.custodianId !== DEATH_WORKSHOP_CUSTODIAN.id || !access.residualPresent || access.physicalVersion !== input.physicalVersion ||
    access.sealed || !same(access.characteristicIds, potion.characteristicIds) || access.uniquenessId !== DEATH_UNIQUENESS_ID)) throw Error('失败后没有同一原承接盘上的真实外置原物，不能凭失败字段生成可回收残余。');
  const recoverable = !success && input.alive && input.residualPresent;
  Object.assign(potion, { status: success ? 'SUCCESS' : recoverable ? 'FAILED_EXPOSED' : 'FAILED_LOST',
    consumedWeek: input.week, settlementEventId: input.eventId,
    residualPresent: !success && input.residualPresent, physicalVersion: input.physicalVersion });
  next.batches.find(batch => batch.id === potion.batchId)!.status = 'SPENT';
  for (const item of [...external(next), next.uniqueness]) Object.assign(item, {
    holder: success ? 'FUSED' : recoverable ? 'EXPOSED' : 'LOST', location: success ? next.origin.actorId : input.location,
  });
  if (success) {
    Object.assign(characteristic(next, next.embodiedOriginalBottleId), { holder: 'FUSED', compoundId: potion.id });
    next.uniqueness.incumbentActorId = next.origin.actorId;
  } else if (input.residualPresent) next.recoverySites.push({ ...clone(access!), handover: null });
  // On death the original already inside this body stays EMBODIED there. It is
  // not turned into loose inventory, recovered by a living view or resurrected.
  next.settlements.push(clone(input));
  const invariant = deathMaterialConservationBlock(next); if (invariant) throw Error(invariant);
  return next;
}

function preparationConditions(state: DeathMaterialsRuntimeState, host: DeathPreparationHost): Record<string, number> {
  const potion = liveCompound(state);
  return { ...host.conditionVersions, 'DE0-U1': host.succession!.conditionVersion,
    ...(potion ? { [potion.id]: potion.physicalVersion } : {}) };
}
function promotionBodyBlock(state: DeathMaterialsRuntimeState, id: string, host: DeathPreparationHost,
  policy: DeathMaterialRuntimePolicy, forPreparation: boolean): string | null {
  const common = hostBlock(state, host); if (common) return common;
  if (host.acting !== DEATH_CONSUMPTION.requiredActing || host.promotionWeek !== state.origin.promotionWeek ||
    host.week - host.promotionWeek < DEATH_CONSUMPTION.minimumS1Weeks) return '本人须已完整消化，并自真实晋升苍白皇帝起满十二整周；指导时间不重置此钟。';
  if (host.health < 80 || host.mind < (forPreparation ? 78 : 70) || host.injuryCount !== 0) return '须健康至少80、精神达到本次门槛且没有实际伤势；诊疗本身不等于痊愈。';
  if (!integer(host.will) || host.will > 500 || !record(host.conditionVersions) || Object.keys(host.conditionVersions).length === 0 ||
    !Object.values(host.conditionVersions).every(version => integer(version, 1))) return '当前意志和现场逐项条件尚未从真实本人、场地取得。';
  if (!deathServiceReceiptsComplete(host.serviceReceipts, policy, host.week)) return '两项居民服务的真实完成与核验回执不完整。';
  const potion = state.compounds.find(item => item.id === id);
  if (!potion || potion.status !== 'PREPARED' || potion.location !== host.location || host.location !== policy.workshopLocation ||
    !same(potion.serviceReceipts, host.serviceReceipts)) return '须本人携同一实物成药到原调配室，两服务完成回执须与调配时相同。';
  const succession = successionBlock(host, policy); if (succession) return succession;
  if (!uniquenessObserved(host, policy, 'PHYSICAL', host.actorId) || !state.uniqueness.checks.some(check => check.step === 'CHAIN') ||
    !state.uniqueness.checks.some(check => check.step === 'VACANCY' && check.conditionVersion === host.succession!.conditionVersion)) return '准备和饮用前均须实查同一唯一性、当前空位与原封存链。';
  if (!currentWorkshopPermission(host.workshopPermission, host)) return '原调配室本次许可未取得、已撤回或条件已改变。';
  if (host.actions < (forPreparation ? 2 : 1) || host.spirituality < (forPreparation ? 42 : 30)) return '须保留实际服药所需1行动与30灵性，准备还须另付1行动与12灵性。';
  if (forPreparation && host.cash < 12) return '本瓶稳定准备须实付12便士。';
  return null;
}
/** Pure dynamic preview; engine must use its ordinary recorded check resolver
 * with the same current will, difficulty57 and only a valid paid +40 modifier. */
export function deathPromotionChance(will: number, prepared: boolean): number {
  if (!integer(will) || will > 500) throw Error('当前意志无效。');
  return Math.max(5, Math.min(95, 50 + 2 * (will + (prepared ? DEATH_CONSUMPTION.bonus : 0) - DEATH_CONSUMPTION.difficulty)));
}
export function currentDeathPreparation(state: DeathMaterialsRuntimeState, preparations: DeathPromotionPreparation[], id: string,
  host: DeathPreparationHost, policy: DeathMaterialRuntimePolicy): DeathPromotionPreparation | null {
  const potion = state.compounds.find(item => item.id === id);
  if (!potion || promotionBodyBlock(state, id, host, policy, false)) return null;
  const serviceIds = host.serviceReceipts.flatMap(receipt => [receipt.passedEventId, receipt.reviewedEventId]);
  const uniquenessIds = state.uniqueness.checks.map(check => check.eventId);
  return preparations.find(preparation => preparation.status === 'READY' && preparation.compoundId === id &&
    preparation.actorId === host.actorId && preparation.sourceDigest === host.sourceDigest && preparation.compoundDigest === stableStringify(potion) &&
    preparation.location === host.location && host.nowSecond >= preparation.preparedSecond && host.nowSecond <= preparation.expiresSecond &&
    preparation.expiresSecond - preparation.preparedSecond === DEATH_PROMOTION_STABILITY.validSeconds &&
    same(preparation.serviceReceiptIds, serviceIds) && same(preparation.uniquenessVerificationIds, uniquenessIds) &&
    same(preparation.conditionVersions, preparationConditions(state, host))) ?? null;
}
export function prepareDeathPromotion(state: DeathMaterialsRuntimeState, preparations: DeathPromotionPreparation[], id: string,
  host: DeathPreparationHost, policy: DeathMaterialRuntimePolicy): DeathModuleResult<DeathPromotionPreparation[]> {
  const reason = promotionBodyBlock(state, id, host, policy, true); if (reason) throw Error(reason);
  if (currentDeathPreparation(state, preparations, id, host, policy)) throw Error('本瓶已有仍有效的实付准备，不重复收费。');
  if (preparations.some(preparation => preparation.eventId === host.eventId)) throw Error('同次准备已结算。');
  const potion = state.compounds.find(item => item.id === id)!;
  const next = clone(preparations);
  for (const preparation of next) if (preparation.status === 'READY') {
    preparation.status = 'INVALIDATED'; preparation.invalidatedEventId = host.eventId;
  }
  const preparedSecond = host.nowSecond + policy.stabilitySeconds;
  next.push({ id: `${host.eventId}:death-preparation`, eventId: host.eventId, compoundId: id,
    actorId: host.actorId, sourceDigest: host.sourceDigest, compoundDigest: stableStringify(potion), location: host.location,
    week: host.week + Math.floor((preparedSecond - host.weekAnchor) / WEEK_SECONDS), preparedSecond, expiresSecond: preparedSecond + DEATH_PROMOTION_STABILITY.validSeconds,
    serviceReceiptIds: host.serviceReceipts.flatMap(receipt => [receipt.passedEventId, receipt.reviewedEventId]),
    uniquenessVerificationIds: state.uniqueness.checks.map(check => check.eventId), conditionVersions: preparationConditions(state, host),
    status: 'READY', spentEventId: null, invalidatedEventId: null });
  return { state: next, effect: { ...emptyDeathEffect(), cashCost: 12, actions: 1, spirituality: 12, mind: 8, seconds: policy.stabilitySeconds },
    notes: ['实际支付12便士、1行动、12灵性与8精神，为同一本人同一瓶准备3600秒。准备完成后七真实天内有效，离室、换瓶、现场条件变化或许可撤回即失效，费用不退。',
      `当前意志${host.will}，本瓶实付准备40、难度57，当前成功率${deathPromotionChance(host.will, true)}%；实际饮用仍由引擎只掷一次d100。`] };
}
export function deathConsumeBlock(state: DeathMaterialsRuntimeState, preparations: DeathPromotionPreparation[], id: string,
  host: DeathPreparationHost, policy: DeathMaterialRuntimePolicy): string | null {
  const reason = promotionBodyBlock(state, id, host, policy, false); if (reason) return reason;
  return currentDeathPreparation(state, preparations, id, host, policy) ? null : '同一本人同一瓶尚无有效实付准备，或已过期、离室、换瓶、条件变化、许可撤回。';
}
/** Call on every private frame transition, including travel before the player
 * can return. Expiry and changed versions cannot be undone by later restoring
 * a location or condition. No resource refund is produced. */
export function invalidateDeathPreparations(preparations: DeathPromotionPreparation[], eventId: string,
  from: string, to: string, current: (preparation: DeathPromotionPreparation) => boolean): DeathPromotionPreparation[] {
  const next = clone(preparations);
  for (const preparation of next) if (preparation.status === 'READY' &&
    (from !== to || !current(preparation))) {
    preparation.status = 'INVALIDATED'; preparation.invalidatedEventId = eventId;
  }
  return next;
}
/** Only within the already validated private consumption draft. Material/body
 * settlement and this spend must publish together after the same COMMIT. */
export function spendDeathPreparation(preparations: DeathPromotionPreparation[], preparationId: string, eventId: string): DeathPromotionPreparation[] {
  const next = clone(preparations), preparation = next.find(item => item.id === preparationId);
  if (!preparation || preparation.status !== 'READY' || preparation.spentEventId || !text(eventId)) throw Error('本瓶同次准备不存在或已经使用。');
  preparation.status = 'SPENT'; preparation.spentEventId = eventId;
  return next;
}

export function projectDeathMaterials(state: DeathMaterialsRuntimeState, policy: DeathMaterialRuntimePolicy) {
  const place=(location:string|null)=>location===state.origin.actorId?'同一本人身体':DEATH_CITY_PLACES.find(p=>p.id===location)?.title??(location===null?'尚待核实':'原登记保管地点');
  const labels: Record<DeathHolder, string> = { EMBODIED: '同一本人已融合', SUPPLIER: '原供应方持有', PLAYER: '本人持有',
    UNLOCATED: '须现时实地调查', LOCATED: '已亲查定位，尚未封存', LEGACY_SEALED: '原处封存，待隔周交接',
    UNVERIFIED: '保管与空位待实查', CUSTODIAN: '非容纳保管人持有', COMPOUND: '同一成药中', EXPOSED: '原处真实残余，尚未封存',
    SEALED: '原处已封存，待隔周付费回收', LOST: '已脱离控制，不能付钱生成替代物', FUSED: '同一本人已经融合' };
  return { title: '三份原特性与同一死神唯一性', lines: [
    ...state.characteristics.map(item => {
      const price = item.holder === 'SUPPLIER' ? deathMaterialEffect(state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId }, policy).cashCost : 0;
      return `原第${DEATH_ORIGINAL_IDS.indexOf(item.originBottleId)+1}份特性：${labels[item.holder]}；${item.holder === 'UNLOCATED' ? '尚未亲查现时位置' : place(item.location)}。` +
        (item.holder === 'SUPPLIER' ? `本瓶真实劳务${item.inheritedLabourSteps + item.labour.length}/5，当前交接价${price}便士。` : '') +
        (item.holder === 'PLAYER' && !item.acquiredEventId ? '原瓶已付，不再购买；须实际带来交接入账。' : '') +
        (['UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder) ? `调查4便士，隔周交接${item.legacyLabour && !item.legacyLabour.spentEventId ? 4 : 12}便士；指定原件劳务仅一次抵8便士。` : '');
    }), `同一死神唯一性：${labels[state.uniqueness.holder]}；不能复制或重复交接。`,
    ...state.batches.map(batch => `第${DEATH_CARRIER_IDS.indexOf(batch.id)+1}件普通载体：${batch.uses ? '已用，不补货' : batch.status === 'PLAYER' ? '已购未用' : `未购，${policy.carrierPrices[batch.id]}便士`}；本件单次封存塞${batch.stopper.status === 'USED' ? '已耗用' : batch.stopper.status === 'PLAYER' ? '仍在' : '随本件购买'}。`),
    '本人原已融合一份始终留在体内；失败仅在本人仍活着且同一外置原物确实可封存时，才有隔周付费回收退路。死亡不能诊疗、回收或自动复活。',
  ] };
}
/** Intent suggestions only. The private host evaluates every action again. */
export function getDeathMaterialActions(state: DeathMaterialsRuntimeState, policy: DeathMaterialRuntimePolicy) {
  const actions: { command: DeathMaterialCommand; label: string; cost: string }[] = [];
  const add = (command: DeathMaterialCommand, label: string) => {
    const effect = deathMaterialEffect(state, command, policy);
    actions.push({ command, label, cost: `${effect.actions}行动、${effect.cashCost}便士、${effect.seconds}秒` });
  };
  for (const item of external(state)) {
    if (item.holder === 'SUPPLIER') {
      const taskId = DEATH_LABOUR_IDS[item.inheritedLabourSteps + item.labour.length];
      if (taskId) add({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId }, '补做本原瓶尚缺的下一项真实劳务');
    }
    if (['SUPPLIER', 'PLAYER'].includes(item.holder) && !item.acquiredEventId) add({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId }, item.holder === 'PLAYER' ? '带已付原瓶实际交接入账' : '付实际原价交接这一原瓶');
    if (['UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder)) {
      add({ type: 'ASK_LEGACY_PERMISSION', bottleId: item.originBottleId }, '到原室询问本次调查与交接许可');
      if (item.holder === 'UNLOCATED') add({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: item.originBottleId }, '付费实查同次原失败的现时残余');
      if (item.holder === 'LOCATED') add({ type: 'SEAL_LEGACY_REMAINS', bottleId: item.originBottleId }, '原地实际封存同一原残余');
      if (item.holder === 'LEGACY_SEALED') add({ type: 'RECOVER_LEGACY_REMAINS', bottleId: item.originBottleId }, '隔周回原处付费交接');
      if (item.holder !== 'UNLOCATED' && !item.legacyLabour) add({ type: 'LEGACY_LABOUR', bottleId: item.originBottleId }, '为本原件做一次真实劳务抵8便士');
    }
  }
  if (['UNVERIFIED', 'CUSTODIAN'].includes(state.uniqueness.holder)) {
    if (!state.uniqueness.checks.some(check => check.step === 'CHAIN')) add({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }, '逐项亲查死亡、分离与封存交接档案');
    add({ type: 'ASK_UNIQUENESS_PERMISSION' }, '当面询问同一唯一性的本次交付许可');
    add({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }, '实查同一原物、保管人与当前空位');
    add({ type: 'ACQUIRE_UNIQUENESS' }, '付费当面交接同一死神唯一性');
  }
  const next = state.batches.find(batch => batch.status === 'SUPPLIER');
  if (next) add({ type: 'BUY_COMPOUND', batchId: next.id }, '购买下一件普通载体及单次封存塞');
  for (const batch of state.batches.filter(item => item.status === 'PLAYER')) add({ type: 'COMPOSE_POTION', batchId: batch.id }, '在原室调配两外置原份与同一唯一性');
  for (const potion of state.compounds) {
    if (potion.status === 'FAILED_EXPOSED') add({ type: 'SEAL_REMAINS', compoundId: potion.id }, '幸存时原地使用本件单次塞封存');
    if (potion.status === 'FAILED_SEALED') {
      add({ type: 'ASK_RECOVERY_PERMISSION', compoundId: potion.id }, '回原处实查并询问本次残余交接许可');
      add({ type: 'RECOVER_SEALED', compoundId: potion.id }, '隔周付12便士回收同一原物');
    }
  }
  return actions;
}
