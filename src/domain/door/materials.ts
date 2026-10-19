import { stableStringify } from '../canonical.js';
import { compareGameDates, isValidGameDate } from '../game-calendar.js';
import { starKeyCharacteristicId } from '../star-key/index.js';
import { validatePlaneswalkerSiteState } from '../planeswalker/resources.js';
import { resolveDoorOriginals, isDoorOriginal } from './originals.js';
import type { StarKeyOriginals } from '../star-key/types.js';
import { DOOR_ORIGINAL_IDS, DOOR_CARRIER_IDS, DOOR_UNIQUENESS_ID, DOOR_LABOUR_IDS,
  type DoorMaterialsState, type DoorMaterialCommand, type DoorMaterialHost, type DoorMaterialPolicy,
  type DoorMaterialEffect, type DoorMaterialSettlement, type DoorCharacteristic, type DoorHolder,
  type DoorCompound, type DoorOriginalId, type DoorServiceReceipt } from './types.js';
const clone = <T>(v: T): T => structuredClone(v);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 300;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const character = (s: DoorMaterialsState, id: string) => s.characteristics.find(c => c.originBottleId === id)!;
const external = (s: DoorMaterialsState) => s.characteristics.filter(c => c.originBottleId !== s.embodiedOriginalBottleId);
const compoundId = (v: unknown) => typeof v === 'string' && /^door-compound-[1-3]$/.test(v);
export function validateDoorMaterialCommand(v: unknown): v is DoorMaterialCommand {
  if (!record(v)) return false;
  const keys = Object.keys(v).sort().join('|');
  if (v.type === 'MATERIAL_LABOUR') return keys === 'bottleId|taskId|type' && isDoorOriginal(v.bottleId) && DOOR_LABOUR_IDS.some(x => x === v.taskId);
  if (['ACQUIRE_CHARACTERISTIC', 'ASK_LEGACY_PERMISSION', 'INVESTIGATE_LEGACY_REMAINS', 'SEAL_LEGACY_REMAINS', 'RECOVER_LEGACY_REMAINS'].includes(String(v.type))) return keys === 'bottleId|type' && isDoorOriginal(v.bottleId);
  if (v.type === 'VERIFY_UNIQUENESS') return keys === 'step|type' && (v.step === 'CHAIN' || v.step === 'VACANCY');
  if (v.type === 'ACQUIRE_UNIQUENESS') return keys === 'type';
  if (v.type === 'BUY_COMPOUND' || v.type === 'COMPOSE_POTION') return keys === 'batchId|type' && DOOR_CARRIER_IDS.some(x => x === v.batchId);
  return (v.type === 'SEAL_REMAINS' || v.type === 'RECOVER_SEALED') && keys === 'compoundId|type' && compoundId(v.compoundId);
}
/** Call at private content initialization, not on every owned transition. */
export function validateDoorMaterialPolicy(p: DoorMaterialPolicy): boolean {
  try {
    const u = p.succession;
    return text(p.id) && [p.supplierLocation, p.workshopLocation, p.archiveLocation, p.legacyLocation].every(text) &&
      same(Object.keys(p.carrierPrices).sort(), [...DOOR_CARRIER_IDS].sort()) && Object.values(p.carrierPrices).every(positive) &&
      [p.investigateFee, p.legacyRecoveryFee, p.uniquenessCheckFee, p.uniquenessHandoverFee, p.composeFee,
        p.sealedRecoveryFee, p.recoveredVesselFullPrice, p.recoveredVesselLabourPrice, p.operationSeconds, p.composeSeconds, p.sealSeconds].every(positive) &&
      p.recoveredVesselLabourPrice <= p.recoveredVesselFullPrice && p.serviceIds.length === 3 && new Set(p.serviceIds).size === 3 && p.serviceIds.every(text) &&
      u.uniquenessId === DOOR_UNIQUENESS_ID && u.objectCount === 1 && text(u.branchId) && text(u.seal) &&
      text(u.predecessorId) && u.predecessorStillEmbodied === false && u.incumbentActorId === null &&
      text(u.custodianActorId) && u.custodianActorId !== u.predecessorId && u.custodianEmbodied === false && text(u.location) &&
      u.permission === 'ALLOW' && positive(u.conditionVersion) && u.termination.cause === 'ACTUAL_DEATH' &&
      [u.termination.eventId, u.separation.eventId, u.transfer.eventId].every(text) &&
      new Set([u.termination.eventId, u.separation.eventId, u.transfer.eventId]).size === 3 &&
      [u.termination.date, u.separation.date, u.transfer.date].every(isValidGameDate) &&
      compareGameDates(u.termination.date, u.separation.date) <= 0 && compareGameDates(u.separation.date, u.transfer.date) <= 0 &&
      u.separation.objectId === DOOR_UNIQUENESS_ID && u.transfer.objectId === DOOR_UNIQUENESS_ID &&
      u.transfer.toActorId === u.custodianActorId && u.transfer.custodyOnly === true &&
      u.characteristicCustody.length === 3 && same(u.characteristicCustody.map(c => c.originalBottleId), DOOR_ORIGINAL_IDS) &&
      new Set(u.characteristicCustody.flatMap(c => [c.separation.eventId, c.transfer.eventId])).size === 6 &&
      u.characteristicCustody.every(c => c.characteristicId === starKeyCharacteristicId(c.originalBottleId) &&
        [c.separation.eventId, c.transfer.eventId, c.transfer.toActorId].every(text) &&
        isValidGameDate(c.separation.date) && isValidGameDate(c.transfer.date) &&
        compareGameDates(u.termination.date, c.separation.date) <= 0 &&
        compareGameDates(c.separation.date, c.transfer.date) <= 0 &&
        compareGameDates(c.transfer.date, u.transfer.date) <= 0);
  } catch { return false; }
}
export function createDoorMaterials(origin: DoorMaterialsState['origin'], policy: DoorMaterialPolicy, originals: StarKeyOriginals): DoorMaterialsState {
  if (!validateDoorMaterialPolicy(policy)) throw Error('有价有限材料政策或唯一原件的真实未来保管链尚未定齐。');
  const resolved = resolveDoorOriginals(origin); if (!resolved) throw Error('三份原特性来源或本人成功原份尚未核清。');
  return { version: 1, origin: clone(origin), embodiedOriginalBottleId: resolved.embodiedOriginalBottleId,
    characteristics: resolved.characteristics.map(c => {
      const bottle = origin.bottles.find(b => b.id === c.latestBottleId)!;
      return { id: c.id, originBottleId: c.originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMAINS' ? 'UNLOCATED' : c.holder,
        location: c.holder === 'SUPPLIER' ? policy.supplierLocation : c.holder === 'PLAYER' ? origin.inheritanceLocation : c.holder === 'EMBODIED' ? origin.actorId : null,
        compoundId: null, inheritedLabourSteps: bottle.labourSteps, recoveredVessel: !!bottle.recovery, labour: [], acquiredEventId: null };
    }),
    legacySites: resolved.characteristics.filter(c => c.holder === 'FAILED_REMAINS').map(c => ({
      originalBottleId: c.originalBottleId, latestBottleId: c.latestBottleId, consumeRevision: c.consumeRevision!,
      sceneId: 'BACKLUND_ORIGINAL_STAR_KEY_PREPARATION', location: policy.legacyLocation,
      custodianId: 'DR0-HURST', custodianPresent: true,
      accessible: validatePlaneswalkerSiteState(originals.site) && originals.site.ordinaryExit === 'OPEN',
      // Newly authored present custody at the preparation/support place. The old
      // failure receipt establishes identity only, never prior player possession.
      residualPresent: true, physicalVersion: 1,
      investigation: 'UNASKED', handover: 'UNASKED', permissionEventId: null, permissionWeek: null,
    })),
    legacyRemains: resolved.characteristics.filter(c => c.holder === 'FAILED_REMAINS').map(c => ({
      originalBottleId: c.originalBottleId, latestBottleId: c.latestBottleId, consumeRevision: c.consumeRevision!,
      sceneId: null, location: null, custodianId: null, physicalVersion: null,
      investigatedEventId: null, sealedEventId: null, sealedWeek: null, sealedSecond: null, recoveredEventId: null,
    })),
    uniqueness: { id: DOOR_UNIQUENESS_ID, holder: 'UNVERIFIED', location: null, compoundId: null,
      incumbentActorId: null, custodianActorId: null, succession: null, checks: [], acquiredEventId: null },
    batches: DOOR_CARRIER_IDS.map(id => ({ id, status: 'SUPPLIER', location: policy.supplierLocation, acquiredEventId: null, uses: 0 })),
    compounds: [], receipts: [], settlements: [] };
}
/** Constant-sized original/custody invariant, not a raw-load validator. */
export function doorMaterialConservationBlock(s: DoorMaterialsState): string | null {
  if (s.version !== 1 || !isDoorOriginal(s.embodiedOriginalBottleId) || s.characteristics.length !== 3 ||
      !same(s.characteristics.map(c => c.originBottleId), DOOR_ORIGINAL_IDS) ||
      s.characteristics.some(c => c.id !== starKeyCharacteristicId(c.originBottleId)) || s.uniqueness.id !== DOOR_UNIQUENESS_ID ||
      s.batches.length !== 3 || !same(s.batches.map(b => b.id), DOOR_CARRIER_IDS) || s.compounds.length > 3) return '三份原特性、唯一原件或三件有限载体总量冲突。';
  if (s.compounds.some((p, i) => p.id !== `door-compound-${i + 1}` || p.uniquenessId !== s.uniqueness.id ||
      !same(p.characteristicIds, s.characteristics.map(c => c.id))) ||
      s.batches.some(b => b.uses !== s.compounds.filter(p => p.batchId === b.id).length || b.uses > 1)) return '同一特性不能用第二载体重复领取。';
  const active = s.compounds.filter(p => p.status !== 'RECOVERED'); if (active.length > 1) return '上一份同原件成药或残余尚未结清。';
  const p = active[0], own = character(s, s.embodiedOriginalBottleId);
  if (p) {
    const holders: Record<Exclude<DoorCompound['status'], 'RECOVERED'>, DoorHolder> = {
      PREPARED: 'COMPOUND', SUCCESS: 'FUSED', FAILED_EXPOSED: 'EXPOSED', FAILED_SEALED: 'SEALED', FAILED_LOST: 'LOST' };
    const holder = holders[p.status as Exclude<DoorCompound['status'], 'RECOVERED'>];
    if ([...external(s), s.uniqueness].some(x => x.holder !== holder || x.compoundId !== p.id || x.location !== (holder === 'FUSED' ? s.origin.actorId : p.location))) return '同一成药中的两份外部特性或唯一性去向冲突。';
    // Failed but living consumption never extracts the already embodied S1 original.
    const dead = p.status === 'FAILED_LOST' && s.settlements.find(x => x.compoundId === p.id)?.alive === false;
    const expected = p.status === 'SUCCESS' ? 'FUSED' : dead ? 'LOST' : 'EMBODIED';
    if (own.holder !== expected || own.location !== (dead ? p.location : s.origin.actorId)) return '本人已融合原份被重复发放或移出实际身体。';
  } else if (own.holder !== 'EMBODIED' || own.location !== s.origin.actorId || external(s).some(c =>
      !['SUPPLIER', 'PLAYER', 'UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(c.holder)) ||
      !['UNVERIFIED', 'CUSTODIAN', 'PLAYER'].includes(s.uniqueness.holder)) return '原物尚未配制时的持有关系冲突。';
  return null;
}
export function doorMaterialEffect(s: DoorMaterialsState, c: DoorMaterialCommand, p: DoorMaterialPolicy): DoorMaterialEffect {
  const e = { actions: 1, cashCost: 0, seconds: p.operationSeconds };
  if (c.type === 'ASK_LEGACY_PERMISSION') { e.actions = 0; e.seconds = 30; }
  if (c.type === 'ACQUIRE_CHARACTERISTIC') {
    const item = character(s, c.bottleId), completed = item.inheritedLabourSteps + item.labour.length === 5;
    e.cashCost = item.holder === 'PLAYER' ? 0 : item.recoveredVessel ? completed ? p.recoveredVesselLabourPrice : p.recoveredVesselFullPrice : completed ? 1100 : 6600;
  }
  if (c.type === 'INVESTIGATE_LEGACY_REMAINS') e.cashCost = p.investigateFee;
  if (c.type === 'RECOVER_LEGACY_REMAINS') e.cashCost = p.legacyRecoveryFee;
  if (c.type === 'VERIFY_UNIQUENESS') e.cashCost = c.step === 'CHAIN' ? p.uniquenessCheckFee : 0;
  if (c.type === 'ACQUIRE_UNIQUENESS') e.cashCost = p.uniquenessHandoverFee;
  if (c.type === 'BUY_COMPOUND') { e.actions = 0; e.cashCost = p.carrierPrices[c.batchId]; }
  if (c.type === 'COMPOSE_POTION') { e.cashCost = p.composeFee; e.seconds = p.composeSeconds; }
  if (c.type === 'SEAL_REMAINS' || c.type === 'SEAL_LEGACY_REMAINS') { e.actions = 0; e.seconds = p.sealSeconds; }
  if (c.type === 'RECOVER_SEALED') e.cashCost = p.sealedRecoveryFee;
  return e;
}
function legacyBlock(s: DoorMaterialsState, id: DoorOriginalId, h: DoorMaterialHost): string | null {
  const a = h.legacyAccess, r = s.legacyRemains.find(r => r.originalBottleId === id);
  if (!a || !r || r.recoveredEventId || a.originalBottleId !== id || a.latestBottleId !== r.latestBottleId ||
      a.consumeRevision !== r.consumeRevision || a.location !== h.location || !a.accessible || !a.custodianPresent ||
      !a.residualPresent || !text(a.sceneId) || !text(a.custodianId) || !positive(a.physicalVersion)) return '须本人到同次失败的实际原场，核实同一残余尚在、通路开放且保管人在场。';
  if (r.investigatedEventId && (r.sceneId !== a.sceneId || r.location !== a.location || r.custodianId !== a.custodianId || r.physicalVersion !== a.physicalVersion)) return '原残余、保管人或现场条件已改变，旧调查不能代替当前核验。';
  return null;
}
function successionBlock(h: DoorMaterialHost, p: DoorMaterialPolicy): string | null {
  if (compareGameDates(h.date, p.succession.transfer.date) < 0) return '实际日期尚未到达前任终止、同一原件析出和非容纳保管交接。';
  return !h.succession || !same(h.succession, p.succession) ? '真实空位、原封签、同件保管链或当前交付许可缺环。' : null;
}
export function doorServiceReceiptsComplete(receipts: DoorServiceReceipt[], policy: DoorMaterialPolicy, week: number): boolean {
  return receipts.length === 3 && same(receipts.map(r => r.serviceId).sort(), [...policy.serviceIds].sort()) &&
    new Set(receipts.map(r => r.residentId)).size === 3 && new Set(receipts.map(r => r.apparatusId)).size === 3 &&
    new Set(receipts.flatMap(r => [r.passedEventId, r.reviewedEventId])).size === 6 &&
    receipts.every(r => [r.serviceId, r.residentId, r.apparatusId, r.passedEventId, r.reviewedEventId].every(text) &&
      positive(r.passedWeek) && positive(r.reviewedWeek) && r.reviewedWeek >= r.passedWeek && r.reviewedWeek <= week);
}
export function doorMaterialBlock(s: DoorMaterialsState, c: DoorMaterialCommand, h: DoorMaterialHost, p: DoorMaterialPolicy): string | null {
  if (!validateDoorMaterialCommand(c) || h.status !== 'ACTIVE' || h.sequence !== 1 || h.actorId !== s.origin.actorId || h.sourceDigest !== s.origin.sourceDigest) return '须由同一仍活着的星之匙本人处置原物。';
  const invariant = doorMaterialConservationBlock(s); if (invariant) return invariant;
  if (s.receipts.some(r => r.eventId === h.eventId) || s.settlements.some(r => r.eventId === h.eventId)) return '同一动作已结算，不能重复收费、领料或增加载体。';
  let place = p.supplierLocation;
  if ('bottleId' in c) {
    const item = character(s, c.bottleId);
    if (c.type === 'MATERIAL_LABOUR') {
      if (item.holder !== 'SUPPLIER' || DOOR_LABOUR_IDS[item.inheritedLabourSteps + item.labour.length] !== c.taskId) return '须完成这一原件当前载体下一项真实劳动，不能复用其他瓶的劳动。';
    } else if (c.type === 'ACQUIRE_CHARACTERISTIC') {
      if (!['SUPPLIER', 'PLAYER'].includes(item.holder) || item.acquiredEventId !== null) return '本人原份不可再买，已交接原件不能重复领取。';
      if (item.holder === 'PLAYER') place = item.location!;
    } else {
      const reason = legacyBlock(s, c.bottleId, h); if (reason) return reason;
      const r = s.legacyRemains.find(r => r.originalBottleId === c.bottleId)!, a = h.legacyAccess!; place = a.location;
      const site = s.legacySites.find(site => site.originalBottleId === c.bottleId)!;
      if (c.type === 'ASK_LEGACY_PERMISSION') {
        if (!['UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder) || site.permissionWeek === h.week && site.investigation === 'ALLOW' && site.handover === 'ALLOW') return '须本人在原准备交接处，向当场的赫斯特取得这次许可，现有有效答复不重复。';
      } else if (site.permissionWeek !== h.week || site.permissionEventId === null) return '须在本周此次到访时，当面向原处赫斯特重新询问同一残余的调查和交付许可。';
      else if (c.type === 'INVESTIGATE_LEGACY_REMAINS') {
        if (item.holder !== 'UNLOCATED' || r.investigatedEventId || a.investigation !== 'ALLOW') return '尚无当前原场调查许可，或已经实际查过同一残余。';
      } else if (c.type === 'SEAL_LEGACY_REMAINS') {
        if (item.holder !== 'LOCATED' || r.sealedEventId || a.handover !== 'ALLOW') return '须先定位当前实际残余并取得封存许可。';
      } else if (item.holder !== 'LEGACY_SEALED' || r.sealedWeek === null || r.sealedSecond === null ||
          h.week <= r.sealedWeek || h.nowSecond <= r.sealedSecond || a.handover !== 'ALLOW') return '先封存同一原残余，至少下一真实周回原处付费交接。';
    }
  } else if (c.type === 'VERIFY_UNIQUENESS' || c.type === 'ACQUIRE_UNIQUENESS') {
    const reason = successionBlock(h, p); if (reason) return reason;
    const u = s.uniqueness;
    if (!['UNVERIFIED', 'CUSTODIAN'].includes(u.holder) || u.incumbentActorId !== null) return '同一唯一性已转移或容纳，不能再次领取。';
    place = c.type === 'VERIFY_UNIQUENESS' && c.step === 'CHAIN' ? p.archiveLocation : p.succession.location;
    if (c.type === 'VERIFY_UNIQUENESS') {
      if (c.step === 'CHAIN' && u.checks.some(x => x.step === 'CHAIN') || c.step === 'VACANCY' && !u.checks.some(x => x.step === 'CHAIN')) return '须先核对实际终止、析出、非容纳保管链，再现场核空位。';
      if (c.step === 'VACANCY' && u.checks.some(x => x.step === 'VACANCY' && x.week === h.week)) return '本周已经现场复核同一空位和封签。';
    } else if (u.checks.length !== 2 || u.checks.at(-1)!.step !== 'VACANCY' || u.checks.at(-1)!.week !== h.week ||
        !same(u.succession, h.succession)) return '须持有本周实际现场复核，交付前再次核准当前原件与空位。';
  } else if ('batchId' in c) {
    const b = s.batches.find(b => b.id === c.batchId)!;
    if (c.type === 'BUY_COMPOUND') {
      if (b.status !== 'SUPPLIER' || s.batches.find(b => b.status === 'SUPPLIER')?.id !== b.id) return '仅依次出售三件有价普通载体；没有第四件或免费补货。';
    } else {
      place = p.workshopLocation;
      if (!doorServiceReceiptsComplete(h.serviceReceipts, p, h.week)) return '须先完成三件居民服务的真实交接和现场核验。';
      if (b.status !== 'PLAYER' || b.location !== place || s.compounds.some(p => p.status !== 'RECOVERED')) return '须实际持有未耗载体，并先结清同原件旧药或失败残余。';
      if (character(s, s.embodiedOriginalBottleId).holder !== 'EMBODIED' || [...external(s), s.uniqueness].some(x => x.holder !== 'PLAYER' || x.location !== place || !x.acquiredEventId)) return '本人已有一份仍在本人；另外两份和唯一性须真实持有并带到同一现场。';
    }
  } else {
    const prepared = s.compounds.find(p => p.id === c.compoundId); if (!prepared) return '没有这一份实际成药。'; place = prepared.location;
    if (c.type === 'SEAL_REMAINS' && prepared.status !== 'FAILED_EXPOSED') return '只能原地封存仍在场的真实失败残余。';
    if (c.type === 'RECOVER_SEALED' && (prepared.status !== 'FAILED_SEALED' || prepared.sealedWeek === null ||
        prepared.sealedSecond === null || h.week <= prepared.sealedWeek || h.nowSecond <= prepared.sealedSecond)) return '须至少下一真实周回同一封存原处，再付费回收原两份及同一唯一性。';
  }
  if (h.location !== place) return '须本人沿实际通路到达原件所在地点。';
  const e = doorMaterialEffect(s, c, p);
  return h.actions < e.actions ? `须有${e.actions}行动。` : h.cash < e.cashCost ? `须实付${e.cashCost}便士。` : null;
}
export function applyDoorMaterial(s: DoorMaterialsState, c: DoorMaterialCommand, h: DoorMaterialHost, policy: DoorMaterialPolicy) {
  const reason = doorMaterialBlock(s, c, h, policy); if (reason) throw Error(reason);
  const n = clone(s), effect = doorMaterialEffect(s, c, policy), notes: string[] = [];
  const endSecond = h.nowSecond + effect.seconds;
  const endWeek = h.week + Math.floor((endSecond - h.weekAnchor) / 604800);
  if (c.type === 'MATERIAL_LABOUR') character(n, c.bottleId).labour.push({ taskId: c.taskId, eventId: h.eventId, week: h.week });
  else if (c.type === 'ACQUIRE_CHARACTERISTIC') Object.assign(character(n, c.bottleId), { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId });
  else if ('bottleId' in c) {
    const item = character(n, c.bottleId), r = n.legacyRemains.find(r => r.originalBottleId === c.bottleId)!, a = h.legacyAccess!;
    if (c.type === 'ASK_LEGACY_PERMISSION') {
      const site = n.legacySites.find(site => site.originalBottleId === c.bottleId)!;
      Object.assign(site, { investigation: 'ALLOW', handover: 'ALLOW', permissionEventId: h.eventId, permissionWeek: endWeek });
      notes.push('本人亲到原服药准备与支持交接处，向赫斯特当面询问本次调查、封存与交付许可。另行核对原服药记录、见证和现存物件；旧瓶仍耗尽，玛拉的撤回、原封包、遮门、油灯、护具和旧敌人均不改变。');
    } else if (c.type === 'INVESTIGATE_LEGACY_REMAINS') {
      Object.assign(item, { holder: 'LOCATED', location: h.location });
      Object.assign(r, { sceneId: a.sceneId, location: a.location, custodianId: a.custodianId, physicalVersion: a.physicalVersion, investigatedEventId: h.eventId });
    } else if (c.type === 'SEAL_LEGACY_REMAINS') {
      item.holder = 'LEGACY_SEALED'; Object.assign(r, { sealedEventId: h.eventId, sealedWeek: endWeek, sealedSecond: endSecond });
    } else { Object.assign(item, { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); r.recoveredEventId = h.eventId; n.legacySites.find(site => site.originalBottleId === c.bottleId)!.residualPresent = false; }
  } else if (c.type === 'VERIFY_UNIQUENESS') {
    if (c.step === 'VACANCY') n.uniqueness.checks = n.uniqueness.checks.filter(x => x.step !== 'VACANCY');
    n.uniqueness.checks.push({ step: c.step, eventId: h.eventId, week: endWeek, conditionVersion: h.succession!.conditionVersion });
    Object.assign(n.uniqueness, { holder: 'CUSTODIAN', location: h.succession!.location, custodianActorId: h.succession!.custodianActorId, succession: clone(h.succession) });
  } else if (c.type === 'ACQUIRE_UNIQUENESS') {
    Object.assign(n.uniqueness, { holder: 'PLAYER', location: h.location, custodianActorId: null, acquiredEventId: h.eventId });
  } else if ('batchId' in c) {
    const b = n.batches.find(b => b.id === c.batchId)!;
    if (c.type === 'BUY_COMPOUND') Object.assign(b, { status: 'PLAYER', location: h.location, acquiredEventId: h.eventId });
    else {
      const id = `door-compound-${n.compounds.length + 1}`; b.status = 'IN_COMPOUND'; b.uses = 1;
      for (const x of [...external(n), n.uniqueness]) Object.assign(x, { holder: 'COMPOUND', location: h.location, compoundId: id });
      n.compounds.push({ id, batchId: b.id, status: 'PREPARED', location: h.location,
        characteristicIds: n.characteristics.map(x => x.id), uniquenessId: n.uniqueness.id, preparedEventId: h.eventId,
        preparedWeek: endWeek, consumedWeek: null, sealedWeek: null, sealedSecond: null, settlementEventId: null,
        sealedEventId: null, recoveredEventId: null, serviceReceipts: clone(h.serviceReceipts) });
    }
  } else {
    const p = n.compounds.find(p => p.id === c.compoundId)!;
    if (c.type === 'SEAL_REMAINS') {
      Object.assign(p, { status: 'FAILED_SEALED', sealedWeek: endWeek, sealedSecond: endSecond, sealedEventId: h.eventId });
      for (const x of [...external(n), n.uniqueness]) x.holder = 'SEALED';
    } else {
      p.status = 'RECOVERED'; p.recoveredEventId = h.eventId;
      for (const x of [...external(n), n.uniqueness]) Object.assign(x, { holder: 'PLAYER', location: h.location, compoundId: null });
    }
  }
  notes.push(`本次实付${effect.cashCost}便士、${effect.actions}行动；只移动同一原件，旧瓶、旧失败和已付成本不变。`);
  n.receipts.push({ eventId: h.eventId, revision: h.revision, week: h.week, location: h.location, command: clone(c), effect: clone(effect) });
  const invariant = doorMaterialConservationBlock(n); if (invariant) throw Error(invariant);
  return { state: n, effect, notes };
}
/** Only call after committed player travel; abandoned and sealed items stay. */
export function transportDoorMaterials(s: DoorMaterialsState, from: string, to: string): DoorMaterialsState {
  const n = clone(s);
  if (from !== to) for (const site of n.legacySites) if (site.location === from) {
    site.investigation = 'UNASKED'; site.handover = 'UNASKED'; site.permissionWeek = null;
  }
  for (const x of [...n.characteristics, n.uniqueness]) if (x.holder === 'PLAYER' && x.location === from) x.location = to;
  for (const b of n.batches) if (b.status === 'PLAYER' && b.location === from) b.location = to;
  for (const p of n.compounds) if (p.status === 'PREPARED' && p.location === from) {
    p.location = to; n.batches.find(b => b.id === p.batchId)!.location = to;
    for (const x of [...external(n), n.uniqueness]) if (x.compoundId === p.id) x.location = to;
  }
  return n;
}
/** Only the private engine's one committed normal check may supply outcome.
 * Material code never rolls, restores resources, grants survival or replays. */
export function settleDoorConsumption(s: DoorMaterialsState, input: DoorMaterialSettlement): DoorMaterialsState {
  const n = clone(s), p = n.compounds.find(p => p.id === input.compoundId);
  if (!p || p.status !== 'PREPARED' || p.location !== input.location || input.week < p.preparedWeek ||
      input.success && !input.alive || n.settlements.some(x => x.eventId === input.eventId) || n.receipts.some(x => x.eventId === input.eventId)) throw Error('同一成药服用结算缺失、重复或位置不一致。');
  const remains = !input.success && input.alive && input.residualPresent;
  p.status = input.success ? 'SUCCESS' : remains ? 'FAILED_EXPOSED' : 'FAILED_LOST'; p.consumedWeek = input.week; p.settlementEventId = input.eventId;
  n.batches.find(b => b.id === p.batchId)!.status = 'SPENT';
  for (const x of [...external(n), n.uniqueness]) Object.assign(x, { holder: input.success ? 'FUSED' : remains ? 'EXPOSED' : 'LOST', location: input.success ? n.origin.actorId : input.location });
  if (input.success) { Object.assign(character(n, n.embodiedOriginalBottleId), { holder: 'FUSED', compoundId: p.id }); n.uniqueness.incumbentActorId = n.origin.actorId; }
  if (!input.alive) { Object.assign(character(n, n.embodiedOriginalBottleId), { holder: 'LOST', location: input.location, compoundId: p.id }); n.uniqueness.incumbentActorId = null; }
  n.settlements.push(clone(input));
  const invariant = doorMaterialConservationBlock(n); if (invariant) throw Error(invariant); return n;
}
export function projectDoorMaterials(s: DoorMaterialsState) {
  const labels: Record<DoorHolder, string> = { EMBODIED: '本人已融合', SUPPLIER: '原供应方库存', PLAYER: '本人持有',
    UNLOCATED: '须实地查残余', LOCATED: '已定位尚未封存', LEGACY_SEALED: '原处封存待隔周交接', UNVERIFIED: '保管现状待核',
    CUSTODIAN: '唯一原件由非容纳保管人持有', COMPOUND: '同一成药中', EXPOSED: '原处残余尚未封存', SEALED: '原处封存待隔周回收', LOST: '脱离本人控制', FUSED: '同一本人融合' };
  return { title: '三份原特性与同一门唯一性', lines: [
    ...s.characteristics.map(c => `${c.originBottleId}：${labels[c.holder]}；${c.holder === 'UNLOCATED' ? '地点尚未核实' : c.location === s.origin.actorId ? '本人' : c.location}；当前载体劳动${c.inheritedLabourSteps + c.labour.length}/5。`),
    `${DOOR_UNIQUENESS_ID}：${labels[s.uniqueness.holder]}。`,
    `三件普通载体尚有${s.batches.filter(b => b.uses === 0).length}件未使用；已用普通药液不补回。`,
    '本人已有一份计入三份总量。成品渠道只提供同一批有价载体与调配服务，不会凭纸面记录补出原件。',
  ] };
}

/** Intents only. Every enabled state is checked by the private chapter host. */
export function getDoorMaterialActions(s: DoorMaterialsState, policy: DoorMaterialPolicy) {
  const out: { command: DoorMaterialCommand; label: string; cost: string }[] = [];
  const add = (command: DoorMaterialCommand, label: string) => {
    const e = doorMaterialEffect(s, command, policy);
    out.push({ command, label, cost: `${e.actions}行动、${e.cashCost}便士，实际${e.seconds}秒` });
  };
  for (const item of external(s)) {
    if (item.holder === 'SUPPLIER') {
      const taskId = DOOR_LABOUR_IDS[item.inheritedLabourSteps + item.labour.length];
      if (taskId) add({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId }, `完成原件${DOOR_ORIGINAL_IDS.indexOf(item.originBottleId) + 1}当前载体的下一项劳动`);
    }
    if (['SUPPLIER', 'PLAYER'].includes(item.holder) && !item.acquiredEventId)
      add({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId }, `当面交接原件${DOOR_ORIGINAL_IDS.indexOf(item.originBottleId) + 1}`);
    if (['UNLOCATED', 'LOCATED', 'LEGACY_SEALED'].includes(item.holder)) {
      add({ type: 'ASK_LEGACY_PERMISSION', bottleId: item.originBottleId }, '到原准备交接处当面询问赫斯特本次许可');
      add({ type: item.holder === 'UNLOCATED' ? 'INVESTIGATE_LEGACY_REMAINS' : item.holder === 'LOCATED' ? 'SEAL_LEGACY_REMAINS' : 'RECOVER_LEGACY_REMAINS', bottleId: item.originBottleId }, item.holder === 'UNLOCATED' ? '付费实查同次原失败残余' : item.holder === 'LOCATED' ? '原地实际封存同一原残余' : '隔周回原处付费交接同一原残余');
    }
  }
  if (['UNVERIFIED', 'CUSTODIAN'].includes(s.uniqueness.holder)) {
    if (!s.uniqueness.checks.some(c => c.step === 'CHAIN')) add({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }, '到档案室核对同一原件真实保管链');
    else { add({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }, '当面复核同一封签与当前空位'); add({ type: 'ACQUIRE_UNIQUENESS' }, '付费当面接过同一唯一性原件'); }
  }
  const next = s.batches.find(b => b.status === 'SUPPLIER');
  if (next) add({ type: 'BUY_COMPOUND', batchId: next.id }, `购买第${DOOR_CARRIER_IDS.indexOf(next.id) + 1}件有价普通载体`);
  for (const b of s.batches.filter(b => b.status === 'PLAYER')) add({ type: 'COMPOSE_POTION', batchId: b.id }, '在调配室付费配制同一批实际原件');
  for (const p of s.compounds) {
    if (p.status === 'FAILED_EXPOSED') add({ type: 'SEAL_REMAINS', compoundId: p.id }, '原处封存同次失败后仍在的残余');
    if (p.status === 'FAILED_SEALED') add({ type: 'RECOVER_SEALED', compoundId: p.id }, '隔周回原处付费回收原两份与同一唯一性');
  }
  return out;
}
