import type { MisfortuneKnightState, MisfortuneKnightAcquisitionEvent } from '../misfortune-knight/types.js';
import { resolveMisfortuneKnightOriginalCharacteristicsSnapshot } from '../misfortune-knight/index.js';
import { stableStringify } from '../canonical.js';
import { DARKNESS_MATERIAL_LOCATIONS as LOC, DARKNESS_CHARACTERISTIC_BOTTLES, DARKNESS_LABOUR_TASKS,
  DARKNESS_CARRIER_BATCHES, DARKNESS_UNIQUENESS_ID, DARKNESS_UNIQUENESS_SEAL, DARKNESS_FUTURE_BRANCH,
  DARKNESS_LEGACY_SITE_ID, DARKNESS_GUIDE_ID, darknessSuccessionAt, type DarknessSuccessionFacts } from './material-content.js';
import { emptyDarknessMaterialEffect, type DarknessMaterialHost, type DarknessMaterialEffect, type DarknessMaterialResult } from './material-ports.js';

export type DarknessOriginalBottleId = typeof DARKNESS_CHARACTERISTIC_BOTTLES[number];
export type DarknessLabourId = typeof DARKNESS_LABOUR_TASKS[number];
export type DarknessCarrierId = typeof DARKNESS_CARRIER_BATCHES[number]['id'];
export type DarknessMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: DarknessOriginalBottleId; taskId: DarknessLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'INVESTIGATE_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: DarknessOriginalBottleId }
  | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'COMPOSE_POTION'; batchId: DarknessCarrierId }
  | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export interface DarknessMaterialOrigin extends Pick<MisfortuneKnightState, 'bottles' | 'resupply' | 'acquisitionJournal'> {
  actorId: string; sourceDigest: string; inheritanceLocation: string; consumption: MisfortuneKnightAcquisitionEvent;
}
export type DarknessMaterialHolder = 'EMBODIED' | 'SUPPLIER' | 'PLAYER' | 'UNLOCATED' | 'LOCATED' | 'UNVERIFIED' | 'CUSTODIAN' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED';
export interface DarknessCharacteristic {
  id: string; originBottleId: DarknessOriginalBottleId; latestBottleId: string; holder: DarknessMaterialHolder;
  location: string | null; compoundId: string | null; inheritedLabourSteps: number; freshCarrier: boolean;
  labour: { taskId: DarknessLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface DarknessLegacyRemains {
  originalBottleId: DarknessOriginalBottleId; latestBottleId: string; originalConsumeRevision: number; originalConsumeWeek: number;
  custodyId: string; physicalLocation: string; custodianId: string; residualPresent: boolean;
  investigatedEventId: string | null; investigatedWeek: number | null; investigatedSecond: number | null;
  recoveredEventId: string | null;
}
export interface DarknessUniqueness {
  id: typeof DARKNESS_UNIQUENESS_ID; seal: typeof DARKNESS_UNIQUENESS_SEAL; holder: DarknessMaterialHolder;
  location: string | null; compoundId: string | null; incumbentActorId: string | null; custodianActorId: string | null;
  succession: DarknessSuccessionFacts | null; checks: { step: 'CHAIN' | 'VACANCY'; eventId: string; week: number }[];
  acquiredEventId: string | null; deliveryRecord: { eventId: string; week: number; seal: string; vacancyRechecked: true } | null;
}
export interface DarknessCarrier { id: DarknessCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT'; location: string; acquiredEventId: string | null; uses: 0 | 1 }
export interface DarknessCompound {
  id: string; batchId: DarknessCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; characteristicIds: string[]; uniquenessId: string; preparedEventId: string; preparedWeek: number;
  consumedWeek: number | null; sealedWeek: number | null; settlementEventId: string | null; sealedEventId: string | null;
  recoveredEventId: string | null; evacuationReceipts: string[];
}
export interface DarknessMaterialSettlement { eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string }
export interface DarknessMaterialsState {
  version: 1; origin: DarknessMaterialOrigin; embodiedOriginalBottleId: DarknessOriginalBottleId;
  characteristics: DarknessCharacteristic[]; legacyRemains: DarknessLegacyRemains[]; uniqueness: DarknessUniqueness;
  batches: DarknessCarrier[]; compounds: DarknessCompound[];
  receipts: { eventId: string; revision: number; week: number; command: DarknessMaterialCommand; location: string; effect: DarknessMaterialEffect }[];
  settlements: DarknessMaterialSettlement[];
}
const clone = <T>(v: T): T => structuredClone(v);
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const character = (s: DarknessMaterialsState, id: string): DarknessCharacteristic => s.characteristics.find(x => x.originBottleId === id)!;
const external = (s: DarknessMaterialsState): DarknessCharacteristic[] => s.characteristics.filter(x => x.originBottleId !== s.embodiedOriginalBottleId);
const originalId = (v: unknown): v is DarknessOriginalBottleId => DARKNESS_CHARACTERISTIC_BOTTLES.some(x => x === v);
const carrierId = (v: unknown): v is DarknessCarrierId => DARKNESS_CARRIER_BATCHES.some(x => x.id === v);
const validCompoundId = (v: unknown): v is string => typeof v === 'string' && /^darkness-compound-[1-3]$/.test(v);
export function validateDarknessMaterialCommand(value: unknown): value is DarknessMaterialCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>, keys = Object.keys(c).sort().join('|');
  if (c.type === 'MATERIAL_LABOUR') return keys === 'bottleId|taskId|type' && originalId(c.bottleId) && DARKNESS_LABOUR_TASKS.some(x => x === c.taskId);
  if (['ACQUIRE_CHARACTERISTIC', 'INVESTIGATE_LEGACY_REMAINS', 'RECOVER_LEGACY_REMAINS'].includes(String(c.type))) return keys === 'bottleId|type' && originalId(c.bottleId);
  if (c.type === 'VERIFY_UNIQUENESS') return keys === 'step|type' && (c.step === 'CHAIN' || c.step === 'VACANCY');
  if (c.type === 'ACQUIRE_UNIQUENESS') return keys === 'type';
  if (c.type === 'BUY_COMPOUND' || c.type === 'COMPOSE_POTION') return keys === 'batchId|type' && carrierId(c.batchId);
  return (c.type === 'SEAL_REMAINS' || c.type === 'RECOVER_SEALED') && keys === 'compoundId|type' && validCompoundId(c.compoundId);
}
/** Strict source validation belongs to the parent before this snapshot parser.
 * A success in a recovered vessel still resolves to its original 1/2/3 ID.
 * Legacy independent fourth bottles are never reclassified or erased. */
export function createDarknessMaterials(origin: DarknessMaterialOrigin): DarknessMaterialsState {
  const originals = resolveMisfortuneKnightOriginalCharacteristicsSnapshot(origin);
  if (!originals || !originalId(originals.embodiedOriginalBottleId) || !originals.embodiedBottleId || originals.characteristics.length !== 3 ||
      origin.consumption.command.type !== 'CONSUME' || origin.consumption.command.bottleId !== originals.embodiedBottleId ||
      !['SUCCESS', 'GREAT_SUCCESS'].includes(origin.consumption.check?.tier ?? '') ||
      !origin.acquisitionJournal.some(e => same(e, origin.consumption))) throw Error('三份原特性来源总量未解决，或本人实际成功服药记录不一致。');
  const embodiedOriginalBottleId = originals.embodiedOriginalBottleId;
  return { version: 1, origin: clone(origin), embodiedOriginalBottleId,
    characteristics: originals.characteristics.map(c => {
      const b = origin.bottles.find(x => x.id === c.latestBottleId);
      if (!b || !originalId(c.originalBottleId)) throw Error('原特性与最新真实载体不一致。');
      return { id: c.characteristicId, originBottleId: c.originalBottleId, latestBottleId: c.latestBottleId,
        holder: c.holder === 'FAILED_REMAINS' ? 'UNLOCATED' : c.holder,
        location: c.holder === 'SUPPLIER' ? LOC.supplier : c.holder === 'PLAYER' ? origin.inheritanceLocation : c.holder === 'EMBODIED' ? origin.actorId : null,
        compoundId: null, inheritedLabourSteps: b.labourSteps, freshCarrier: !!b.recovery, labour: [], acquiredEventId: null };
    }),
    legacyRemains: originals.characteristics.filter(c => c.holder === 'FAILED_REMAINS').map(c => {
      const e = origin.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === c.latestBottleId);
      if (!e || !['FAILURE', 'GREAT_FAILURE'].includes(e.check?.tier ?? '') || !originalId(c.originalBottleId)) throw Error('最新失败残留与实际原回执不一致。');
      // This bounded private original scene is authored now from the actual
      // failure, not inserted into the old record or granted to the player.
      return { originalBottleId: c.originalBottleId, latestBottleId: c.latestBottleId, originalConsumeRevision: e.revision, originalConsumeWeek: e.week,
        custodyId: `${c.latestBottleId}:remains:${e.revision}`, physicalLocation: LOC.originalRoom, custodianId: DARKNESS_GUIDE_ID,
        residualPresent: true, investigatedEventId: null, investigatedWeek: null, investigatedSecond: null, recoveredEventId: null };
    }),
    uniqueness: { id: DARKNESS_UNIQUENESS_ID, seal: DARKNESS_UNIQUENESS_SEAL, holder: 'UNVERIFIED', location: null,
      compoundId: null, incumbentActorId: null, custodianActorId: null, succession: null, checks: [], acquiredEventId: null, deliveryRecord: null },
    batches: DARKNESS_CARRIER_BATCHES.map(b => ({ id: b.id, status: 'SUPPLIER', location: LOC.supplier, uses: 0, acquiredEventId: null })),
    compounds: [], receipts: [], settlements: [] };
}
function successionBlock(h: DarknessMaterialHost): string | null {
  const expected = darknessSuccessionAt(h.date), actual = h.succession;
  if (!expected) return '真实日期尚未到达前任容纳终止、析出与次日保管交接；不能跳年或提前交付。';
  if (!actual || !same(actual, expected)) return '同一唯一性的实际容纳终止、析出、非容纳保管、空位或许可缺环，不能交付。';
  return null;
}
function legacyBlock(s: DarknessMaterialsState, bottleId: DarknessOriginalBottleId, h: DarknessMaterialHost, recover: boolean): string | null {
  const r = s.legacyRemains.find(x => x.originalBottleId === bottleId), a = h.legacyAccess;
  if (!r || !r.residualPresent || r.recoveredEventId || r.latestBottleId !== character(s, bottleId).latestBottleId) return '同一最新失败残留尚未证实在场或已经转移，不能凭回执领料。';
  if (h.location !== r.physicalLocation || !a || a.siteId !== DARKNESS_LEGACY_SITE_ID || !a.roomAccessible ||
      a.custodianId !== r.custodianId || !a.custodianAtSite) return '须本人回实际原场，原门畅通，并由同一在场保管人核对原残留。';
  if ((recover ? a.handover : a.investigation) !== 'ALLOW') return '原场保管人尚未许可或明确拒绝；可以离开，不能以证明书替代实地交接。';
  return null;
}
export function darknessMaterialEffect(s: DarknessMaterialsState, c: DarknessMaterialCommand): DarknessMaterialEffect {
  const e = emptyDarknessMaterialEffect(); e.actions = 1;
  if (c.type === 'ACQUIRE_CHARACTERISTIC') {
    const item = character(s, c.bottleId), five = item.inheritedLabourSteps + item.labour.length === 5;
    e.cashCost = item.holder === 'PLAYER' ? 0 : item.freshCarrier ? five ? 90 : 900 : five ? 1100 : 6600;
  }
  if (c.type === 'INVESTIGATE_LEGACY_REMAINS' || c.type === 'RECOVER_SEALED') e.cashCost = 120;
  if (c.type === 'VERIFY_UNIQUENESS') e.cashCost = 30;
  if (c.type === 'ACQUIRE_UNIQUENESS') e.cashCost = 240;
  if (c.type === 'BUY_COMPOUND') { e.actions = 0; e.cashCost = DARKNESS_CARRIER_BATCHES.find(b => b.id === c.batchId)!.price; }
  if (c.type === 'COMPOSE_POTION') { e.cashCost = 120; e.seconds = 3600; }
  if (c.type === 'SEAL_REMAINS') { e.actions = 0; e.seconds = 300; }
  return e;
}
/** Cheap invariant for the owned hot path, not an import validator. Cold input
 * must recreate this module and replay the enclosing private history once. */
export function darknessMaterialConservationBlock(s: DarknessMaterialsState): string | null {
  if (s.characteristics.length !== 3 || !originalId(s.embodiedOriginalBottleId) ||
      !same(s.characteristics.map(c => c.originBottleId), DARKNESS_CHARACTERISTIC_BOTTLES) ||
      s.characteristics.some(c => c.id !== `${c.originBottleId}:characteristic`) ||
      s.uniqueness.id !== DARKNESS_UNIQUENESS_ID || s.uniqueness.seal !== DARKNESS_UNIQUENESS_SEAL ||
      s.batches.length !== 3 || s.compounds.length > 3 || !same(s.batches.map(b => b.id), DARKNESS_CARRIER_BATCHES.map(b => b.id))) return '原特性、唯一性或有限载体总量冲突。';
  if (s.compounds.some((p, index) => p.id !== `darkness-compound-${index + 1}` || !same(p.characteristicIds, s.characteristics.map(c => c.id)) || p.uniquenessId !== s.uniqueness.id) ||
      s.batches.some(b => b.uses !== s.compounds.filter(p => p.batchId === b.id).length || b.uses > 1)) return '同一原物不能被第二份载体重复引用或补发。';
  const current = s.compounds.filter(p => p.status !== 'RECOVERED');
  if (current.length > 1) return '尚有未结清的同一原物。';
  const p = current[0];
  if (p) {
    const expected: Record<Exclude<DarknessCompound['status'], 'RECOVERED'>, DarknessMaterialHolder> = {
      PREPARED: 'COMPOUND', SUCCESS: 'FUSED', FAILED_EXPOSED: 'EXPOSED', FAILED_SEALED: 'SEALED', FAILED_LOST: 'LOST',
    };
    const holder = expected[p.status as Exclude<DarknessCompound['status'], 'RECOVERED'>], location = holder === 'FUSED' ? s.origin.actorId : p.location;
    if ([...external(s), s.uniqueness].some(c => c.holder !== holder || c.compoundId !== p.id || c.location !== location)) return '当前承载物的两份外部特性或唯一性位置冲突。';
    const embodied = character(s, s.embodiedOriginalBottleId), ownHolder = p.status === 'SUCCESS' ? 'FUSED' : p.status === 'FAILED_LOST' ? 'LOST' : 'EMBODIED';
    if (embodied.holder !== ownHolder || embodied.location !== (ownHolder === 'LOST' ? p.location : s.origin.actorId)) return '本人原特性已被重复发放或移出真实位置。';
  } else if (character(s, s.embodiedOriginalBottleId).holder !== 'EMBODIED' || external(s).some(c => !['SUPPLIER', 'PLAYER', 'UNLOCATED', 'LOCATED'].includes(c.holder))) return '本人或外部原特性保管关系冲突。';
  return null;
}
export function darknessMaterialBlock(s: DarknessMaterialsState, c: DarknessMaterialCommand, h: DarknessMaterialHost): string | null {
  if (!validateDarknessMaterialCommand(c) || h.status !== 'ACTIVE' || h.sequence !== 1 || h.actorId !== s.origin.actorId || h.sourceDigest !== s.origin.sourceDigest) return '须由仍活着的同一厄难骑士本人处理原物。';
  const conservation = darknessMaterialConservationBlock(s); if (conservation) return conservation;
  if (s.receipts.some(r => r.eventId === h.eventId) || s.settlements.some(r => r.eventId === h.eventId)) return '同一意图已经实际结算，不能再次收费或领料。';
  let place: string = LOC.supplier;
  if ('bottleId' in c) {
    const item = character(s, c.bottleId);
    if (c.type === 'MATERIAL_LABOUR') {
      if (item.holder !== 'SUPPLIER' || DARKNESS_LABOUR_TASKS[item.inheritedLabourSteps + item.labour.length] !== c.taskId) return '只做这份原物尚未完成的下一项真实劳务；旧劳动不能抵新的回收载体。';
    } else if (c.type === 'ACQUIRE_CHARACTERISTIC') {
      if (!['SUPPLIER', 'PLAYER'].includes(item.holder) || item.acquiredEventId !== null) return '这份原特性不是尚待实际交接的库存，不能重复购买本人已融合的一份。';
      if (item.holder === 'PLAYER') place = item.location!;
    } else {
      const reason = legacyBlock(s, c.bottleId, h, c.type === 'RECOVER_LEGACY_REMAINS'); if (reason) return reason;
      const r = s.legacyRemains.find(x => x.originalBottleId === c.bottleId)!; place = r.physicalLocation;
      if (c.type === 'INVESTIGATE_LEGACY_REMAINS' && (item.holder !== 'UNLOCATED' || r.investigatedEventId)) return '已定位的同一残留不能重复调查出新原物。';
      if (c.type === 'RECOVER_LEGACY_REMAINS' && (item.holder !== 'LOCATED' || r.investigatedWeek === null || r.investigatedSecond === null || h.week <= r.investigatedWeek || h.nowSecond <= r.investigatedSecond)) return '先付费查到同一残留，再经过下一真实周回原地封存交接。';
    }
  } else if (c.type === 'VERIFY_UNIQUENESS' || c.type === 'ACQUIRE_UNIQUENESS') {
    const reason = successionBlock(h); if (reason) return reason;
    const u = s.uniqueness;
    if (!['UNVERIFIED', 'CUSTODIAN'].includes(u.holder) || u.incumbentActorId !== null) return '同一唯一性已经移交或正在容纳，不能领取第二次。';
    place = c.type === 'VERIFY_UNIQUENESS' && c.step === 'CHAIN' ? LOC.archive : LOC.vault;
    if (c.type === 'VERIFY_UNIQUENESS') {
      if (c.step === 'CHAIN' && u.checks.length > 0 || c.step === 'VACANCY' && !u.checks.some(x => x.step === 'CHAIN')) return '先核对真实终止、析出及同一原件的非容纳保管链，再现场核空位和许可。';
      if (c.step === 'VACANCY' && u.checks.some(x => x.step === 'VACANCY' && x.week === h.week)) return '这周已经现场核过同一空位与封签。';
    } else if (u.holder !== 'CUSTODIAN' || u.checks.length !== 2 || u.checks.at(-1)!.week !== h.week || !same(u.succession, h.succession)) return '须有完整保管链，且本周在交付现场重新核验空位、原件和许可。';
  } else if ('batchId' in c) {
    const b = s.batches.find(x => x.id === c.batchId)!;
    if (c.type === 'BUY_COMPOUND') {
      if (b.status !== 'SUPPLIER' || s.batches.find(x => x.status === 'SUPPLIER')?.id !== b.id) return '只依次出售这三件有限普通载体，耗尽后没有免费或无限补货。';
    } else {
      place = LOC.workshop;
      if (h.verifiedReceipts.length === 0) return '四名居民的实际夜间到达与本人亲走返程尚未完成。';
      if (b.status !== 'PLAYER' || b.location !== place || s.compounds.some(p => p.status !== 'RECOVERED')) return '须实际持有未耗载体，并先处理同一旧成药或失败残留。';
      if (character(s, s.embodiedOriginalBottleId).holder !== 'EMBODIED' || [...external(s), s.uniqueness].some(x => x.holder !== 'PLAYER' || x.location !== place || !x.acquiredEventId) || s.uniqueness.incumbentActorId !== null) return '本人一份只引用；另外两份和独立唯一性必须已实际交接并在同一现场。';
    }
  } else {
    const p = s.compounds.find(x => x.id === c.compoundId); if (!p) return '没有这份实际配制物。'; place = p.location;
    if (c.type === 'SEAL_REMAINS' && p.status !== 'FAILED_EXPOSED') return '只能封住本人仍在原处的真实失败残留。';
    if (c.type === 'RECOVER_SEALED' && (p.status !== 'FAILED_SEALED' || p.sealedWeek === null || h.week <= p.sealedWeek)) return '至少到下一真实周，再回实际封存原处付费清理；封存本身不等于回收。';
  }
  if (h.location !== place) return '须本人沿实际道路到达同一原物所在地点。';
  const e = darknessMaterialEffect(s, c);
  return h.actions < e.actions ? `需要${e.actions}次实际行动。` : h.cash < e.cashCost ? `需要${e.cashCost}便士。` : null;
}
export function applyDarknessMaterial(s: DarknessMaterialsState, c: DarknessMaterialCommand, h: DarknessMaterialHost): DarknessMaterialResult<DarknessMaterialsState> {
  const reason = darknessMaterialBlock(s, c, h); if (reason) throw Error(reason);
  const n = clone(s), e = darknessMaterialEffect(s, c), notes: string[] = [];
  if (c.type === 'MATERIAL_LABOUR') { character(n, c.bottleId).labour.push({ taskId: c.taskId, eventId: h.eventId, week: h.week }); notes.push('只为同一当前载体完成这一项实际劳务；第五项完成前仍按全价，旧劳动不转移。'); }
  else if (c.type === 'ACQUIRE_CHARACTERISTIC') { Object.assign(character(n, c.bottleId), { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); notes.push(`实付${e.cashCost}便士并当面交接同一原物；原先已经付费持有者不再收购一次。`); }
  else if (c.type === 'INVESTIGATE_LEGACY_REMAINS' || c.type === 'RECOVER_LEGACY_REMAINS') {
    const item = character(n, c.bottleId), r = n.legacyRemains.find(x => x.originalBottleId === c.bottleId)!;
    if (c.type === 'INVESTIGATE_LEGACY_REMAINS') {
      Object.assign(item, { holder: 'LOCATED', location: r.physicalLocation }); Object.assign(r, { investigatedEventId: h.eventId, investigatedWeek: h.week, investigatedSecond: h.nowSecond });
      notes.push(`付120便士和1行动，赛琳在实际原场按第${r.originalConsumeWeek}周的同次最新失败回执，逐一核对现存残留和同一保管链；已定位，尚未交付。旧回执未被补写。`);
    } else { Object.assign(item, { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); r.recoveredEventId = h.eventId; r.residualPresent = false; notes.push('隔真实周回原处，再核同一残留、封存并当面移交；原保管处不再持有副本，原消耗瓶和失败仍原样保留。'); }
  } else if (c.type === 'VERIFY_UNIQUENESS') {
    if (c.step === 'VACANCY') n.uniqueness.checks = n.uniqueness.checks.filter(x => x.step !== 'VACANCY');
    n.uniqueness.checks.push({ step: c.step, eventId: h.eventId, week: h.week });
    Object.assign(n.uniqueness, { holder: 'CUSTODIAN', location: LOC.vault, custodianActorId: DARKNESS_FUTURE_BRANCH.custodianId, succession: clone(h.succession) });
    notes.push(c.step === 'CHAIN' ? DARKNESS_FUTURE_BRANCH.story : '本人和露西娅当场核对同一原件、空位、封签及交付许可；缺环、仍有容纳者或第二件原物均不交付。');
  } else if (c.type === 'ACQUIRE_UNIQUENESS') {
    Object.assign(n.uniqueness, { holder: 'PLAYER', location: h.location, custodianActorId: null, acquiredEventId: h.eventId,
      deliveryRecord: { eventId: h.eventId, week: h.week, seal: DARKNESS_UNIQUENESS_SEAL, vacancyRechecked: true } });
    notes.push('付240便士和1行动，露西娅当场再核空位后交付同一原件；这是保管权移交，尚未容纳。');
  } else if ('batchId' in c) {
    const b = n.batches.find(x => x.id === c.batchId)!;
    if (c.type === 'BUY_COMPOUND') { Object.assign(b, { status: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); notes.push(`付${e.cashCost}便士取得这件普通药液与容器；全章只此三件，不增非凡原物。`); }
    else {
      const id = `darkness-compound-${n.compounds.length + 1}`; b.status = 'IN_COMPOUND'; b.uses = 1;
      for (const item of [...external(n), n.uniqueness]) Object.assign(item, { holder: 'COMPOUND', location: h.location, compoundId: id });
      n.compounds.push({ id, batchId: b.id, status: 'PREPARED', location: h.location, characteristicIds: n.characteristics.map(x => x.id), uniquenessId: n.uniqueness.id,
        preparedEventId: h.eventId, preparedWeek: h.week, consumedWeek: null, sealedWeek: null, settlementEventId: null, sealedEventId: null, recoveredEventId: null, evacuationReceipts: [...h.verifiedReceipts] });
      notes.push('付120便士和1行动实际配制；本人融合的一份只被引用，另两份和同一唯一性实际放入载体，不把第三份再次装瓶。');
    }
  } else if ('compoundId' in c) {
    const p = n.compounds.find(x => x.id === c.compoundId)!;
    if (c.type === 'SEAL_REMAINS') { p.status = 'FAILED_SEALED'; p.sealedWeek = h.week; p.sealedEventId = h.eventId; for (const x of [...external(n), n.uniqueness]) x.holder = 'SEALED'; notes.push('原地花5分钟封住同一残留，0行动、0便士；没有回收原物、退费、补药或治疗。'); }
    else { p.status = 'RECOVERED'; p.recoveredEventId = h.eventId; for (const x of [...external(n), n.uniqueness]) Object.assign(x, { holder: 'PLAYER', location: h.location, compoundId: null }); notes.push('下一真实周回同一封存处付120便士和1行动，只清理取回两份外部原特性与同一唯一性；本人S1原件一直在本人，普通药液不恢复。'); }
  }
  n.receipts.push({ eventId: h.eventId, revision: h.revision, week: h.week, command: clone(c), location: h.location, effect: clone(e) });
  const invariant = darknessMaterialConservationBlock(n); if (invariant) throw Error(invariant);
  return { state: n, effect: e, notes };
}
/** Call only for an actual committed physical movement. Exposed/sealed/lost
 * remnants and uncollected inventory never follow the player. */
export function transportDarknessMaterials(s: DarknessMaterialsState, from: string, to: string): DarknessMaterialsState {
  const n = clone(s);
  for (const x of [...n.characteristics, n.uniqueness]) if (x.holder === 'PLAYER' && x.location === from) x.location = to;
  for (const b of n.batches) if (b.status === 'PLAYER' && b.location === from) b.location = to;
  for (const p of n.compounds) if (p.status === 'PREPARED' && p.location === from) {
    p.location = to; n.batches.find(b => b.id === p.batchId)!.location = to;
    for (const x of [...external(n), n.uniqueness]) if (x.compoundId === p.id) x.location = to;
  }
  return n;
}
export function settleDarknessConsumption(s: DarknessMaterialsState, input: DarknessMaterialSettlement): DarknessMaterialsState {
  const n = clone(s), p = n.compounds.find(x => x.id === input.compoundId);
  if (!p || p.status !== 'PREPARED' || p.location !== input.location || input.week < p.preparedWeek || input.success && !input.alive ||
      n.settlements.some(x => x.eventId === input.eventId) || n.receipts.some(x => x.eventId === input.eventId)) throw Error('同一原物的服药结算不一致或已经结算。');
  p.status = input.success ? 'SUCCESS' : input.alive ? 'FAILED_EXPOSED' : 'FAILED_LOST'; p.consumedWeek = input.week; p.settlementEventId = input.eventId;
  n.batches.find(b => b.id === p.batchId)!.status = 'SPENT';
  for (const x of [...external(n), n.uniqueness]) Object.assign(x, { holder: input.success ? 'FUSED' : input.alive ? 'EXPOSED' : 'LOST', location: input.success ? n.origin.actorId : input.location });
  if (input.success) { Object.assign(character(n, n.embodiedOriginalBottleId), { holder: 'FUSED', compoundId: p.id }); n.uniqueness.incumbentActorId = n.origin.actorId; }
  if (!input.alive) { Object.assign(character(n, n.embodiedOriginalBottleId), { holder: 'LOST', location: input.location, compoundId: p.id }); n.uniqueness.incumbentActorId = null; }
  n.settlements.push(clone(input)); const invariant = darknessMaterialConservationBlock(n); if (invariant) throw Error(invariant); return n;
}
export function getDarknessMaterialActions(s: DarknessMaterialsState, h: DarknessMaterialHost) {
  const commands: { label: string; command: DarknessMaterialCommand }[] = [];
  for (const x of s.characteristics) {
    const task = DARKNESS_LABOUR_TASKS[x.inheritedLabourSteps + x.labour.length];
    if (x.holder === 'SUPPLIER' && task) commands.push({ label: `第${x.originBottleId.slice(-1)}份原特性：完成下一项劳务`, command: { type: 'MATERIAL_LABOUR', bottleId: x.originBottleId, taskId: task } });
    if (['SUPPLIER', 'PLAYER'].includes(x.holder) && !x.acquiredEventId) commands.push({ label: `第${x.originBottleId.slice(-1)}份原特性：实际交接`, command: { type: 'ACQUIRE_CHARACTERISTIC', bottleId: x.originBottleId } });
    if (x.holder === 'UNLOCATED' || x.holder === 'LOCATED') commands.push({ label: x.holder === 'UNLOCATED' ? '回原场付费调查同一失败残留' : '隔周回原场封存交接同一残留', command: { type: x.holder === 'UNLOCATED' ? 'INVESTIGATE_LEGACY_REMAINS' : 'RECOVER_LEGACY_REMAINS', bottleId: x.originBottleId } });
  }
  if (['UNVERIFIED', 'CUSTODIAN'].includes(s.uniqueness.holder)) commands.push(
    { label: '核查实际容纳终止、析出与非容纳保管链', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } },
    { label: '现场核查空位、封签与交付许可', command: { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } },
    { label: '当面交接同一黑暗唯一性', command: { type: 'ACQUIRE_UNIQUENESS' } });
  for (const b of s.batches) if (b.status === 'SUPPLIER' || b.status === 'PLAYER') commands.push({ label: `${DARKNESS_CARRIER_BATCHES.find(x => x.id === b.id)!.label}：${b.status === 'SUPPLIER' ? '购买' : '实际配制'}`, command: { type: b.status === 'SUPPLIER' ? 'BUY_COMPOUND' : 'COMPOSE_POTION', batchId: b.id } });
  for (const p of s.compounds) if (p.status === 'FAILED_EXPOSED' || p.status === 'FAILED_SEALED') commands.push({ label: p.status === 'FAILED_EXPOSED' ? '0行动原地安全封存' : '隔周付费原地回收', command: { type: p.status === 'FAILED_EXPOSED' ? 'SEAL_REMAINS' : 'RECOVER_SEALED', compoundId: p.id } });
  return commands.map(x => { const e = darknessMaterialEffect(s, x.command), reason = darknessMaterialBlock(s, x.command, h); return { ...x, cost: `${e.actions}行动、${e.cashCost}便士；${e.seconds}秒`, enabled: reason === null, reason }; });
}
export function projectDarknessMaterials(s: DarknessMaterialsState) {
  const labels: Record<DarknessMaterialHolder, string> = {
    EMBODIED: '融入同一本人', SUPPLIER: '原供应方持有', PLAYER: '本人实际持有', UNLOCATED: '最新失败残留尚待调查',
    LOCATED: '已实地定位，尚未接回', UNVERIFIED: '未来事件与保管现状尚待核实', CUSTODIAN: '由原保管人独立封存',
    COMPOUND: '已实际放入同一成药', EXPOSED: '原处真实残留，尚未封存', SEALED: '原处已封存，尚未回收',
    LOST: '留在原处，已脱离本人控制', FUSED: '融合在同一本人体内',
  };
  const location = (item: DarknessCharacteristic | DarknessUniqueness) => ['EMBODIED', 'FUSED'].includes(item.holder) ? '本人' :
    ['UNLOCATED', 'UNVERIFIED'].includes(item.holder) ? '尚未实地查明去向' : item.location ?? '尚未核实地点';
  return { title: '三份原特性与同一黑暗唯一性', lines: [
    ...s.characteristics.map(c => `第${c.originBottleId.slice(-1)}份原特性：${labels[c.holder]}；${location(c)}；劳务${c.inheritedLabourSteps + c.labour.length}/5。`),
    `同一唯一性：${labels[s.uniqueness.holder]}；${location(s.uniqueness)}。`,
    `有限普通载体剩余${s.batches.filter(b => b.status === 'SUPPLIER').length}件；无补货、修复或重发入口。`,
    '本人已融合的一份留在本人，另两份实际入药；已耗瓶、旧失败与所有已付成本保留。成药还须在调配室完成本瓶稳定准备，失败可能重伤或死亡。',
  ] };
}
