import type { BeautyGoddessState, BeautyGoddessAcquisitionEvent } from '../beauty-goddess/types.js';
import { resolveBeautyGoddessOriginalCharacteristicsSnapshot } from '../beauty-goddess/index.js';
import { MOON_SUPPLIER, MOON_ARCHIVE, MOON_VAULT, MOON_WORKSHOP, MOON_UNIQUENESS_ID, MOON_UNIQUENESS_SEAL, MOON_FUTURE_BRANCH } from './content.js';
import { emptyMoonEffect, type MoonHost, type MoonEffect, type MoonModuleResult } from './ports.js';
export const MOON_CHARACTERISTIC_BOTTLES = ['beauty-goddess-potion-1','beauty-goddess-potion-2','beauty-goddess-potion-3'] as const;
export const MOON_LABOUR_TASKS = ['SEAL_REGISTER','CRATE_AUDIT','SUPPLY_LIST','TRANSIT_RECEIPT','DELIVERY_REVIEW'] as const;
export const MOON_CARRIER_BATCHES = [{ id: 'moon-carrier-1', label: '一号普通承载包', price: 360 }, { id: 'moon-carrier-2', label: '二号普通承载包', price: 390 }, { id: 'moon-carrier-3', label: '三号普通承载包', price: 420 }] as const;
export type MoonMaterialBottleId = typeof MOON_CHARACTERISTIC_BOTTLES[number];
export type MoonLabourId = typeof MOON_LABOUR_TASKS[number];
export type MoonCarrierId = typeof MOON_CARRIER_BATCHES[number]['id'];
export type MoonMaterialCommand =
 | { type: 'MATERIAL_LABOUR'; bottleId: MoonMaterialBottleId; taskId: MoonLabourId }
 | { type: 'ACQUIRE_CHARACTERISTIC' | 'INVESTIGATE_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: MoonMaterialBottleId }
 | { type: 'VERIFY_UNIQUENESS'; step: 'CHAIN' | 'VACANCY' }
 | { type: 'ACQUIRE_UNIQUENESS' }
 | { type: 'BUY_COMPOUND' | 'REQUEST_COMPOUND_REPAIR' | 'RECEIVE_COMPOUND_REPAIR' | 'COMPOSE_POTION'; batchId: MoonCarrierId }
 | { type: 'SEAL_REMAINS' | 'RECOVER_SEALED'; compoundId: string };
export interface MoonMaterialOrigin extends Pick<BeautyGoddessState, 'bottles'|'acquisitionJournal'|'resupply'> {
 actorId: string; sourceDigest: string; consumption: BeautyGoddessAcquisitionEvent; inheritanceLocation: string;
}
export type MoonMaterialHolder = 'EMBODIED'|'SUPPLIER'|'PLAYER'|'UNLOCATED'|'LOCATED'|'CUSTODIAN'|'COMPOUND'|'EXPOSED'|'SEALED'|'LOST'|'FUSED';
export interface MoonCharacteristic {
 id: string; originBottleId: MoonMaterialBottleId; latestBottleId: string; holder: MoonMaterialHolder; location: string | null; compoundId: string | null;
 inheritedLabourSteps: number; freshCarrier: boolean; labour: { taskId: MoonLabourId; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface MoonUniqueness { id: string; seal: string; holder: MoonMaterialHolder; location: string | null; compoundId: string | null;
 incumbentActorId: string | null; custodianActorId: string | null; currentObjectCount: 1; predecessorEmbodied: false;
 vacancyEventId: 'MOON-VACANCY-1353'; transferEventId: 'MOON-TRANSFER-01'; deliveryRecord: { id: 'MOON-DELIVERY-01'; eventId: string; week: number; seal: string; vacancyRechecked: true } | null;
 checks: { step: 'CHAIN'|'VACANCY'; eventId: string; week: number }[]; acquiredEventId: string | null;
}
export interface MoonCarrierBatch { id: MoonCarrierId; status: 'SUPPLIER'|'PLAYER'|'IN_COMPOUND'|'SPENT'|'REPAIR_ORDERED'; location: string; uses: number; acquiredEventId: string | null; orderedWeek: number | null; refillId: string | null }
export interface MoonCompound { id: string; batchId: MoonCarrierId; status: 'PREPARED'|'SUCCESS'|'FAILED_EXPOSED'|'FAILED_SEALED'|'FAILED_LOST'|'RECOVERED'; location: string; characteristicIds: string[]; uniquenessId: string; preparedEventId: string; preparedWeek: number; consumedWeek: number | null; sealedWeek: number | null; settlementEventId: string | null; sealedEventId: string | null; recoveredEventId: string | null; serviceReceipts: string[] }
export interface MoonMaterialsState { version: 1; origin: MoonMaterialOrigin; embodiedOriginalBottleId: string;
 characteristics: MoonCharacteristic[]; uniqueness: MoonUniqueness; batches: MoonCarrierBatch[]; compounds: MoonCompound[];
 legacyRemains: { originalBottleId: MoonMaterialBottleId; latestBottleId: string; originalConsumeRevision: number; originalConsumeWeek: number; custodyId: string; investigatedEventId: string | null; investigatedWeek: number | null; recoveredEventId: string | null }[];
 refills: { id: string; assignedBatchId: MoonCarrierId | null; orderEventId: string | null; deliveryEventId: string | null }[];
 receipts: { eventId: string; week: number; revision: number; command: MoonMaterialCommand; effect: MoonEffect; location: string }[];
 settlements: { eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const character = (s: MoonMaterialsState, id: string) => s.characteristics.find(c => c.originBottleId === id)!;
const external = (s: MoonMaterialsState) => s.characteristics.filter(c => c.originBottleId !== s.embodiedOriginalBottleId);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 300;
export function validateMoonMaterialCommand(v: unknown): v is MoonMaterialCommand {
 if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
 const c = v as Record<string, unknown>, exact = (keys: string[]) => Object.keys(c).sort().join('|') === keys.sort().join('|');
 if (c.type === 'MATERIAL_LABOUR') return exact(['type','bottleId','taskId']) && MOON_CHARACTERISTIC_BOTTLES.includes(c.bottleId as MoonMaterialBottleId) && MOON_LABOUR_TASKS.includes(c.taskId as MoonLabourId);
 if (['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(String(c.type))) return exact(['type','bottleId']) && MOON_CHARACTERISTIC_BOTTLES.includes(c.bottleId as MoonMaterialBottleId);
 if (c.type === 'VERIFY_UNIQUENESS') return exact(['type','step']) && ['CHAIN','VACANCY'].includes(String(c.step));
 if (c.type === 'ACQUIRE_UNIQUENESS') return exact(['type']);
 if (['BUY_COMPOUND','REQUEST_COMPOUND_REPAIR','RECEIVE_COMPOUND_REPAIR','COMPOSE_POTION'].includes(String(c.type))) return exact(['type','batchId']) && MOON_CARRIER_BATCHES.some(b => b.id === c.batchId);
 return ['SEAL_REMAINS','RECOVER_SEALED'].includes(String(c.type)) && exact(['type','compoundId']) && text(c.compoundId) && /^moon-compound-[1-9][0-9]?$/.test(c.compoundId);
}
/** Called only after the enclosing source's strict predecessor validation. The
 * exact full acquisition snapshot resolves ancestry; array position never does. */
export function createMoonMaterials(origin: MoonMaterialOrigin): MoonMaterialsState {
 const originals = resolveBeautyGoddessOriginalCharacteristicsSnapshot(origin);
 if (!originals || originals.characteristics.length !== 3 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId || origin.consumption.command.type !== 'CONSUME' || origin.consumption.command.bottleId !== originals.embodiedBottleId || !['SUCCESS','GREAT_SUCCESS'].includes(origin.consumption.check?.tier ?? '')) throw Error('三份原特性与实际成功服药记录不一致。');
 return { version: 1, origin: clone(origin), embodiedOriginalBottleId: originals.embodiedOriginalBottleId,
  characteristics: originals.characteristics.map(c => {
   const b = origin.bottles.find(b => b.id === c.latestBottleId)!;
   return { id: c.characteristicId, originBottleId: c.originalBottleId as MoonMaterialBottleId, latestBottleId: c.latestBottleId, holder: c.holder === 'FAILED_REMAINS' ? 'UNLOCATED' : c.holder,
    location: c.holder === 'SUPPLIER' ? MOON_SUPPLIER : c.holder === 'PLAYER' ? origin.inheritanceLocation : c.holder === 'EMBODIED' ? origin.actorId : null,
    compoundId: null, inheritedLabourSteps: b.labourSteps, freshCarrier: !!b.recovery, labour: [], acquiredEventId: null };
  }),
  uniqueness: { id: MOON_UNIQUENESS_ID, seal: MOON_UNIQUENESS_SEAL, holder: 'CUSTODIAN', location: MOON_VAULT, compoundId: null, incumbentActorId: null, custodianActorId: MOON_FUTURE_BRANCH.custodianId, currentObjectCount: 1, predecessorEmbodied: false, vacancyEventId: 'MOON-VACANCY-1353', transferEventId: 'MOON-TRANSFER-01', deliveryRecord: null, checks: [], acquiredEventId: null },
  batches: MOON_CARRIER_BATCHES.map(b => ({ id: b.id, status: 'SUPPLIER', location: MOON_SUPPLIER, uses: 0, acquiredEventId: null, orderedWeek: null, refillId: null })), compounds: [], receipts: [], settlements: [],
  legacyRemains: originals.characteristics.filter(c => c.holder === 'FAILED_REMAINS').map(c => {
   const receipt = origin.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === c.latestBottleId);
   if (!receipt || !['FAILURE','GREAT_FAILURE'].includes(receipt.check?.tier ?? '')) throw Error('同一旧失败原瓶的真实服药记录缺失。');
   return { originalBottleId: c.originalBottleId as MoonMaterialBottleId, latestBottleId: c.latestBottleId, originalConsumeRevision: receipt.revision, originalConsumeWeek: receipt.week, custodyId: `${c.latestBottleId}:remains:${receipt.revision}`, investigatedEventId: null, investigatedWeek: null, recoveredEventId: null };
  }), refills: ['moon-refill-1','moon-refill-2','moon-refill-3'].map(id => ({ id, assignedBatchId: null, orderEventId: null, deliveryEventId: null })),
 };
}
export function moonMaterialEffect(s: MoonMaterialsState, c: MoonMaterialCommand): MoonEffect {
 const e = emptyMoonEffect(); e.actions = 1;
 if (c.type === 'ACQUIRE_CHARACTERISTIC') { const item = character(s, c.bottleId), steps = item.inheritedLabourSteps + item.labour.length; e.cashCost = item.freshCarrier ? 900 - steps * 162 : 6600 - steps * 1100; }
 if (c.type === 'INVESTIGATE_LEGACY_REMAINS') e.cashCost = 120;
 if (c.type === 'VERIFY_UNIQUENESS') e.cashCost = 30;
 if (c.type === 'ACQUIRE_UNIQUENESS') e.cashCost = 240;
 if (c.type === 'BUY_COMPOUND') { e.actions = 0; e.cashCost = MOON_CARRIER_BATCHES.find(b => b.id === c.batchId)!.price; }
 if (c.type === 'REQUEST_COMPOUND_REPAIR') { e.cashCost = 390; e.actions = 0; }
 if (c.type === 'RECEIVE_COMPOUND_REPAIR') e.actions = 0;
 if (c.type === 'COMPOSE_POTION') { e.cashCost = 120; e.seconds = 3600; }
 if (c.type === 'SEAL_REMAINS') { e.actions = 0; e.seconds = 300; }
 if (c.type === 'RECOVER_SEALED') e.cashCost = 120;
 return e;
}
export function moonMaterialBlock(s: MoonMaterialsState, c: MoonMaterialCommand, h: MoonHost): string | null {
 if (!validateMoonMaterialCommand(c) || h.status !== 'ACTIVE' || h.sequence !== 1 || h.actorId !== s.origin.actorId) return '须由仍活着的美神本人处理同一批原物。';
 if (s.receipts.length >= 512 && c.type !== 'SEAL_REMAINS') return '当前材料保管账已满，不能继续交付；原地安全封存仍可进行。';
 let place: string = MOON_SUPPLIER;
 if ('bottleId' in c) {
  const item = character(s, c.bottleId);
  if (c.type === 'MATERIAL_LABOUR' || c.type === 'ACQUIRE_CHARACTERISTIC') {
   if (item.holder !== 'SUPPLIER') return '这份原物不在原供应处，不能再次购买或抵工。';
   if (c.type === 'MATERIAL_LABOUR' && MOON_LABOUR_TASKS[item.inheritedLabourSteps + item.labour.length] !== c.taskId) return '须依次完成尚未做过的五项真实劳务，旧瓶劳务不能抵新药液。';
  } else {
   const r = s.legacyRemains.find(r => r.originalBottleId === c.bottleId);
   if (!r) return '这份原特性没有可核对的最新失败原瓶。';
   if (c.type === 'INVESTIGATE_LEGACY_REMAINS' && (item.holder !== 'UNLOCATED' || r.investigatedEventId)) return '已经调查过这份同一残留，不能重复调查出新的特性。';
   if (c.type === 'RECOVER_LEGACY_REMAINS' && (item.holder !== 'LOCATED' || r.investigatedWeek === null || h.week <= r.investigatedWeek || r.recoveredEventId)) return '先付费实地调查，经过下一真实周，再封存并接回同一原特性。';
  }
 } else if (c.type === 'VERIFY_UNIQUENESS' || c.type === 'ACQUIRE_UNIQUENESS') {
  const u = s.uniqueness;
  if (u.holder !== 'CUSTODIAN' || u.incumbentActorId !== null || u.predecessorEmbodied || u.currentObjectCount !== 1 || u.custodianActorId !== MOON_FUTURE_BRANCH.custodianId || u.seal !== MOON_UNIQUENESS_SEAL) return '当前仍有容纳者、第二件原物或保管冲突，不能交接唯一性。';
  place = c.type === 'VERIFY_UNIQUENESS' && c.step === 'CHAIN' ? MOON_ARCHIVE : MOON_VAULT;
  if (c.type === 'VERIFY_UNIQUENESS') {
   if (c.step === 'CHAIN' && u.checks.length || c.step === 'VACANCY' && !u.checks.some(x => x.step === 'CHAIN')) return '先核对实际前任退出与同一原件转移，再当场核空位和许可。';
   if (c.step === 'VACANCY' && u.checks.some(x => x.step === 'VACANCY' && x.week === h.week)) return '本周已经当场核验过这份空位与封签。';
  } else if (u.checks.length !== 2 || u.checks.at(-1)!.week !== h.week) return '须先核保管链，并在实际交付这周复核空位与封签。';
 } else if ('batchId' in c) {
  const b = s.batches.find(b => b.id === c.batchId)!;
  if (c.type === 'BUY_COMPOUND' && b.status !== 'SUPPLIER') return '这一有限承载包已经交付。';
  if (c.type === 'REQUEST_COMPOUND_REPAIR' && (b.status !== 'SPENT' || b.location !== h.location || s.compounds.filter(p => p.batchId === b.id).at(-1)?.status !== 'RECOVERED' || !s.refills.some(r => !r.assignedBatchId))) return '须先回收同一容器的残留，且普通补给仍有有限余量。';
  if (c.type === 'RECEIVE_COMPOUND_REPAIR' && (b.status !== 'REPAIR_ORDERED' || b.orderedWeek === null || h.week <= b.orderedWeek)) return '付费预约后的下一真实周才能领取新的普通药液。';
  if (c.type === 'COMPOSE_POTION') {
   place = MOON_WORKSHOP;
   if (h.verifiedReceipts.length !== 6) return '须有三站六名原乘客的真实到达与核验。';
   if (b.status !== 'PLAYER' || b.location !== h.location || s.compounds.some(p => ['PREPARED','FAILED_EXPOSED','FAILED_SEALED'].includes(p.status))) return '须有已购原承载包，并先处理现有成药或残留。';
   if (character(s, s.embodiedOriginalBottleId).holder !== 'EMBODIED' || [...external(s), s.uniqueness].some(i => i.holder !== 'PLAYER' || i.location !== h.location) || s.uniqueness.incumbentActorId !== null) return '同一本人原有一份、两份外部原特性与独立唯一性必须实际在场。';
  }
 } else {
  const p = s.compounds.find(p => p.id === c.compoundId);
  if (!p) return '没有这份真实配制物。'; place = p.location;
  if (c.type === 'SEAL_REMAINS' && p.status !== 'FAILED_EXPOSED') return '只能封存本人仍在现场的真实失败残留。';
  if (c.type === 'RECOVER_SEALED' && (p.status !== 'FAILED_SEALED' || p.sealedWeek === null || h.week <= p.sealedWeek)) return '须先在原地封存，下一真实周再付费回收；原物不会自动回到手中。';
 }
 if (h.location !== place) return '须本人沿实际道路到达这批原物所在地点。';
 const e = moonMaterialEffect(s, c);
 return h.actions < e.actions ? `需要${e.actions}次实际行动。` : h.cash < e.cashCost ? `需要${e.cashCost}便士。` : null;
}
export function applyMoonMaterial(s: MoonMaterialsState, c: MoonMaterialCommand, h: MoonHost): MoonModuleResult<MoonMaterialsState> {
 const reason = moonMaterialBlock(s, c, h); if (reason) throw Error(reason);
 const n = clone(s), e = moonMaterialEffect(s, c), notes: string[] = [];
 if (c.type === 'MATERIAL_LABOUR') { character(n, c.bottleId).labour.push({ taskId: c.taskId, eventId: h.eventId, week: h.week }); notes.push('为这份实际原物完成一项尚未做过的劳务；费用只抵本次对应的原物或新药液，不增加特性。'); }
 else if (c.type === 'ACQUIRE_CHARACTERISTIC') { Object.assign(character(n, c.bottleId), { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); notes.push(`实付${e.cashCost}便士交接同一原特性。旧已付药液和已做劳务如实保留，旧耗用瓶没有恢复。`); }
 else if (c.type === 'INVESTIGATE_LEGACY_REMAINS' || c.type === 'RECOVER_LEGACY_REMAINS') {
  const item = character(n, c.bottleId), r = n.legacyRemains.find(r => r.originalBottleId === c.bottleId)!;
  if (c.type === 'INVESTIGATE_LEGACY_REMAINS') { item.holder = 'LOCATED'; item.location = MOON_SUPPLIER; r.investigatedEventId = h.eventId; r.investigatedWeek = h.week; notes.push(`实付120便士和一次行动，循第${r.originalConsumeWeek}周同一最新失败原瓶的原服药记录实地查到残留；原瓶仍记失败，尚未接回特性。`); }
  else { item.holder = 'PLAYER'; item.location = h.location; item.acquiredEventId = h.eventId; r.recoveredEventId = h.eventId; notes.push('在后一个真实周亲自辨识、封存并接回已查到的同一特性；没有调用旧阶服药或改写旧记录。'); }
 }
 else if (c.type === 'VERIFY_UNIQUENESS') { if (c.step === 'VACANCY') n.uniqueness.checks = n.uniqueness.checks.filter(x => x.step !== 'VACANCY'); n.uniqueness.checks.push({ step: c.step, eventId: h.eventId, week: h.week }); notes.push(c.step === 'CHAIN' ? MOON_FUTURE_BRANCH.story + '原件由两名见证人见证交予从未容纳的艾达·芬奇，封签连续。' : '本人和保管人当场核验原封匣：前任已不再容纳，没有在位者或第二件原物，交付许可只针对同一原件。'); }
 else if (c.type === 'ACQUIRE_UNIQUENESS') { Object.assign(n.uniqueness, { holder: 'PLAYER', custodianActorId: null, location: h.location, acquiredEventId: h.eventId, deliveryRecord: { id: 'MOON-DELIVERY-01', eventId: h.eventId, week: h.week, seal: MOON_UNIQUENESS_SEAL, vacancyRechecked: true } }); notes.push('实付240便士，艾达·芬奇当场再次核实空位与同一封签后交付这一件原物；保管权转移，仍未容纳成神。'); }
 else if ('batchId' in c) {
  const b = n.batches.find(b => b.id === c.batchId)!;
  if (c.type === 'BUY_COMPOUND') { Object.assign(b, { status: 'PLAYER', location: h.location, acquiredEventId: h.eventId }); notes.push(`实付${e.cashCost}便士取得这一份普通溶剂、洁净容器和密封耗材，没有购买新的非凡特性。`); }
  if (c.type === 'REQUEST_COMPOUND_REPAIR') { const refill = n.refills.find(r => !r.assignedBatchId)!; Object.assign(refill, { assignedBatchId: b.id, orderEventId: h.eventId }); Object.assign(b, { status: 'REPAIR_ORDERED', orderedWeek: h.week, refillId: refill.id }); notes.push('实付390便士订购一份有限普通新药液，原容器交回；下一真实周才能接收。'); }
  if (c.type === 'RECEIVE_COMPOUND_REPAIR') { b.status = 'PLAYER'; b.location = h.location; n.refills.find(r => r.id === b.refillId)!.deliveryEventId = h.eventId; notes.push('收到先前付费的这一份新普通药液；已耗批次仍耗尽，三份特性没有增加。'); }
  if (c.type === 'COMPOSE_POTION') {
   const id = `moon-compound-${n.compounds.length + 1}`; b.status = 'IN_COMPOUND'; b.uses++;
   for (const item of [...external(n), n.uniqueness]) Object.assign(item, { holder: 'COMPOUND', location: h.location, compoundId: id });
   n.compounds.push({ id, batchId: b.id, status: 'PREPARED', location: h.location, characteristicIds: n.characteristics.map(x => x.id), uniquenessId: n.uniqueness.id, preparedEventId: h.eventId, preparedWeek: h.week, consumedWeek: null, sealedWeek: null, settlementEventId: null, sealedEventId: null, recoveredEventId: null, serviceReceipts: [...h.verifiedReceipts] });
   notes.push('实付120便士与一次行动配制同一承载物；本人已融入的一份只作为同一原物被引用，另两份和唯一性真实放入药中。');
  }
 } else if (c.type === 'SEAL_REMAINS' || c.type === 'RECOVER_SEALED') {
  const p = n.compounds.find(p => p.id === c.compoundId)!;
  if (c.type === 'SEAL_REMAINS') { p.status = 'FAILED_SEALED'; p.sealedWeek = h.week; p.sealedEventId = h.eventId; for (const item of [...external(n), n.uniqueness]) item.holder = 'SEALED'; notes.push('利用原调配室已有的隔离器具，花五分钟封存同一残留；无需行动或现款，也没有回收、治疗或补发任何原物。'); }
  else { p.status = 'RECOVERED'; p.recoveredEventId = h.eventId; for (const item of [...external(n), n.uniqueness]) Object.assign(item, { holder: 'PLAYER', location: h.location, compoundId: null }); notes.push('在后一个真实周实付120便士和一次行动，清理并接回同一两份特性及唯一性；普通药液已耗尽，须另购新承载物。'); }
 }
 n.receipts.push({ eventId: h.eventId, week: h.week, revision: h.revision, command: clone(c), effect: clone(e), location: h.location });
 return { state: n, effect: e, notes };
}
export function transportMoonMaterials(s: MoonMaterialsState, from: string, to: string): MoonMaterialsState {
 const n = clone(s);
 for (const item of [...n.characteristics, n.uniqueness]) if (item.holder === 'PLAYER' && item.location === from) item.location = to;
 for (const b of n.batches) if ((b.status === 'PLAYER' || b.status === 'SPENT' && n.compounds.filter(p => p.batchId === b.id).at(-1)?.status === 'RECOVERED') && b.location === from) b.location = to;
 for (const p of n.compounds) if (p.status === 'PREPARED' && p.location === from) { p.location = to; n.batches.find(b => b.id === p.batchId)!.location = to; for (const item of [...external(n), n.uniqueness]) if (item.compoundId === p.id) item.location = to; }
 return n;
}
export function settleMoonConsumption(s: MoonMaterialsState, input: MoonMaterialsState['settlements'][number]): MoonMaterialsState {
 const n = clone(s), p = n.compounds.find(p => p.id === input.compoundId);
 if (!p || p.status !== 'PREPARED' || p.location !== input.location || n.settlements.some(x => x.eventId === input.eventId)) throw Error('同一服药原物的真实结算不一致。');
 p.status = input.success ? 'SUCCESS' : input.alive ? 'FAILED_EXPOSED' : 'FAILED_LOST'; p.consumedWeek = input.week; p.settlementEventId = input.eventId;
 n.batches.find(b => b.id === p.batchId)!.status = 'SPENT';
 for (const item of [...external(n), n.uniqueness]) { item.holder = input.success ? 'FUSED' : input.alive ? 'EXPOSED' : 'LOST'; item.location = input.success ? n.origin.actorId : input.location; }
 if (input.success) { character(n, n.embodiedOriginalBottleId).holder = 'FUSED'; n.uniqueness.incumbentActorId = n.origin.actorId; }
 if (!input.alive) { character(n, n.embodiedOriginalBottleId).holder = 'LOST'; character(n, n.embodiedOriginalBottleId).location = input.location; }
 n.settlements.push(clone(input)); return n;
}
export function getMoonMaterialActions(s: MoonMaterialsState, h: MoonHost) {
 const commands: { label: string; command: MoonMaterialCommand }[] = [];
 const labourLabels = ['核验封签','清点交接箱','校对供货清单','整理运输凭据','复核当面交付'];
 for (const b of s.characteristics) {
  if (b.holder === 'SUPPLIER') { const step = b.inheritedLabourSteps + b.labour.length; if (step < 5) commands.push({ label: `${b.originBottleId.slice(-1)}号原特性：${labourLabels[step]}`, command: { type: 'MATERIAL_LABOUR', bottleId: b.originBottleId, taskId: MOON_LABOUR_TASKS[step]! } }); commands.push({ label: `${b.originBottleId.slice(-1)}号原特性：付费实际取得`, command: { type: 'ACQUIRE_CHARACTERISTIC', bottleId: b.originBottleId } }); }
  if (b.holder === 'UNLOCATED') commands.push({ label: `${b.originBottleId.slice(-1)}号原特性：调查最新失败残留`, command: { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: b.originBottleId } });
  if (b.holder === 'LOCATED') commands.push({ label: `${b.originBottleId.slice(-1)}号原特性：隔周封存并接回`, command: { type: 'RECOVER_LEGACY_REMAINS', bottleId: b.originBottleId } });
 }
 if (s.uniqueness.holder === 'CUSTODIAN') commands.push({ label: '核对前任退出与同一原件转移', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } }, { label: '现场核验空位、封签与许可', command: { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } }, { label: '付费交接同一月亮唯一性', command: { type: 'ACQUIRE_UNIQUENESS' } });
 for (const b of s.batches) {
  const label = MOON_CARRIER_BATCHES.find(x => x.id === b.id)!.label;
  if (b.status === 'SUPPLIER') commands.push({ label: `购买${label}`, command: { type: 'BUY_COMPOUND', batchId: b.id } });
  if (b.status === 'PLAYER') commands.push({ label: `以${label}配制成药`, command: { type: 'COMPOSE_POTION', batchId: b.id } });
  if (b.status === 'SPENT') commands.push({ label: `为${label}订购新的普通药液`, command: { type: 'REQUEST_COMPOUND_REPAIR', batchId: b.id } });
  if (b.status === 'REPAIR_ORDERED') commands.push({ label: `隔周领取${label}的已付药液`, command: { type: 'RECEIVE_COMPOUND_REPAIR', batchId: b.id } });
 }
 for (const p of s.compounds) if (p.status === 'FAILED_EXPOSED' || p.status === 'FAILED_SEALED') commands.push({ label: p.status === 'FAILED_EXPOSED' ? '在原地安全封存同一残留' : '隔周付费清理同一残留', command: { type: p.status === 'FAILED_EXPOSED' ? 'SEAL_REMAINS' : 'RECOVER_SEALED', compoundId: p.id } });
 return commands.map(x => { const e = moonMaterialEffect(s, x.command), reason = moonMaterialBlock(s, x.command, h); return { ...x, cost: `${e.actions}行动、${e.cashCost}便士；实际${e.seconds / 60}分钟`, enabled: !reason, reason }; });
}
export function projectMoonMaterials(s: MoonMaterialsState) {
 const holder: Record<MoonMaterialHolder,string> = { EMBODIED: '融入同一本人', SUPPLIER: '仍在原供应处', PLAYER: '本人实际持有', UNLOCATED: '最新失败残留尚待调查', LOCATED: '已找到同一残留，尚未接回', CUSTODIAN: '原保管人封存', COMPOUND: '在同一成药中', EXPOSED: '原处残留，尚未封存', SEALED: '原处实际封存', LOST: '原处留存，已脱离本人控制', FUSED: '融合在同一本人体内' };
 return { title: '三份原特性与独立唯一性', lines: [
  ...s.characteristics.map(c => `${c.originBottleId.slice(-1)}号原特性：${holder[c.holder]}；实际劳务${c.inheritedLabourSteps + c.labour.length}/5。${c.freshCarrier ? '当前为同一原特性的新药液，按900便士或五项新劳务后90便士结算。' : ''}`),
  `同一月亮唯一性：${holder[s.uniqueness.holder]}；前任已不再容纳，实际原件始终一份。`,
  MOON_FUTURE_BRANCH.story,
  '艾达·芬奇仅保管原件，从未容纳；两名成年见证人的同一封匣交接记录仍在。交付当天另查空位、封签与当前唯一保管者。',
  ...s.batches.map(b => `${MOON_CARRIER_BATCHES.find(x => x.id === b.id)!.label}：${b.status === 'SUPPLIER' ? '未购买' : b.status === 'PLAYER' ? '已付费持有' : b.status === 'IN_COMPOUND' ? '在同一成药中' : b.status === 'REPAIR_ORDERED' ? '已付费待隔周到货' : '药液已耗尽'}。`),
  `有限普通补充物尚余${s.refills.filter(r => !r.assignedBatchId).length}份；它们没有新的非凡特性。`,
  '配制只引用本人已融合的一份，另外两份和独立唯一性才装入承载物。失败不退费用、不恢复旧瓶；死亡后原物留在现场。',
 ] };
}
