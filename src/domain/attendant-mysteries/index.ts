import { createAttendantMysteriesReceptionState, validateAttendantMysteriesReceptionCommand, blockAttendantMysteriesReception, applyAttendantMysteriesReception, attendantMysteriesReceptionActions, projectAttendantMysteriesReception, validateAttendantMysteriesReception } from './reception.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SEER_ABILITIES } from '../seer/content.js';
import { CLOWN_ABILITIES } from '../clown/content.js';
import { MAGICIAN_ABILITIES } from '../magician/content.js';
import { FACELESS_ABILITIES } from '../faceless/content.js';
import { MARIONETTIST_ABILITIES } from '../marionettist/content.js';
import { BIZARRO_SORCERER_ABILITIES } from '../bizarro-sorcerer/content.js';
import { ANCIENT_SCHOLAR_ABILITIES } from '../ancient-scholar/content.js';
import { MIRACLE_WORKER_ABILITIES } from '../miracle-worker/content.js';
import { hasMiracleWorkerLock } from '../miracle-worker/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck, computeCheckChance } from '../../resolution/normal-check.js';
import { isValidGameDate, compareGameDates, gameDaysBetween } from '../game-calendar.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import { createTownState, validateTownCommand, validateTownState, hasUsableTownRegion, type TownState } from './town.js';
import { createAttendantMysteriesLifeState, applyAttendantMysteriesActivity, validateAttendantMysteriesActivityCommand, blockAttendantMysteriesActivity, projectAttendantMysteriesLife, attendantMysteriesLifeActions, validateAttendantMysteriesLife, hasAttendantMysteriesLifeLock, attendantMysteriesLifeRewards } from './life.js';
import { createAttendantMysteriesEncounterState, applyAttendantMysteriesEncounterCommand, validateAttendantMysteriesEncounterCommand, blockAttendantMysteriesEncounter, projectAttendantMysteriesEncounter, attendantMysteriesEncounterActions, validateAttendantMysteriesEncounter, hasAttendantMysteriesEncounterLock } from './encounter.js';
import { ATTENDANT_MYSTERIES_PLACES, attendantMysteriesBudget, validAttendantMysteriesBudget, attendantMysteriesSourceDigest, attendantMysteriesTownBlock, applyAttendantMysteriesTown, projectAttendantMysteriesTown, validateAttendantMysteriesTown, hasAttendantMysteriesTownLock } from './ritual.js';
import { ATTENDANT_MYSTERIES_GUIDE, ATTENDANT_MYSTERIES_PRICES as PRICES, ATTENDANT_MYSTERIES_LABOUR_STEPS, ATTENDANT_MYSTERIES_FORMULA, ATTENDANT_MYSTERIES_STORY, ATTENDANT_MYSTERIES_BOUNDARY, ATTENDANT_MYSTERIES_RISK, ATTENDANT_MYSTERIES_ABILITIES } from './content.js';
import { ATTENDANT_MYSTERIES_ABILITY_IDS, type AttendantMysteriesState, type AttendantMysteriesBatch, type AttendantMysteriesCommand, type AttendantMysteriesAcquisitionCommand, type AttendantMysteriesAcquisitionEvent, type AttendantMysteriesAction, type AttendantMysteriesProjection } from './types.js';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, k: readonly string[]) => Object.keys(v).sort().join('|') === [...k].sort().join('|');
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const int = (v: unknown, a = 0, b = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= a && (v as number) <= b;
const win = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const ORIGIN = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 } as const;
export const ATTENDANT_MYSTERIES_INHERITED_ABILITIES = [...SEER_ABILITIES, ...CLOWN_ABILITIES, ...MAGICIAN_ABILITIES, ...FACELESS_ABILITIES, ...MARIONETTIST_ABILITIES, ...BIZARRO_SORCERER_ABILITIES, ...ANCIENT_SCHOLAR_ABILITIES, ...MIRACLE_WORKER_ABILITIES];
export const ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS = ATTENDANT_MYSTERIES_INHERITED_ABILITIES.map(a => a.id);
const freshBatch = (n: number, stockedWeek: number | null): AttendantMysteriesBatch => {
  const id = `attendant-mysteries-batch-${n}`;
  return { id, stockedWeek, labourSteps: 0, acquiredWeek: null, brewedWeek: null, materials: ATTENDANT_MYSTERIES_FORMULA.map((m, index) => ({ id: `${id}:${m.id}`, name: m.name, quantity: m.quantity, unit: m.unit,
    source: index === 0 ? `${ATTENDANT_MYSTERIES_GUIDE}核验的独立封存遗产AM1-LEGACY-${n}，原诡秘侍者特性一份。` : `灵界采集队原封AM1-EXPEDITION-${n}-${index}，本批不同特产原样；须实际购买、调配耗用。`, holder: 'SUPPLIER' })) };
};
export function createAttendantMysteriesState(): AttendantMysteriesState {
  return { guidanceKnown: false, guidanceWeek: null, sourceHistoryDigest: null, batches: [1, 2, 3].map(n => freshBatch(n, null)), bottles: [], resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, miracleWorkerActingAtPromotion: null,
    preparation: null, acquisitionJournal: [], town: null, townJournal: [], reception: createAttendantMysteriesReceptionState(), life: createAttendantMysteriesLifeState(), encounter: createAttendantMysteriesEncounterState() };
}
export const isAttendantMysteries = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 1 && s.attendantMysteries.promotionWeek !== null;
const eligible = (s: SliceState) => s.progression.pathwayId === 'diviner' && [2, 1].includes(s.progression.sequence ?? 0) && s.miracleWorker.promotionWeek !== null && s.ancientScholar.ritual.location === 'RECEPTION';
const oldReports = (s: SliceState) => s.miracleWorker.life.reflected && s.miracleWorker.life.activeCase === null && Object.values(s.miracleWorker.life.cases).every(c => c.status === 'RESOLVED') && s.seer.completedSources.includes('miracle-worker-reflection');
export const hasAttendantMysteriesLock = (s: SliceState) => s.attendantMysteries.preparation !== null || hasAttendantMysteriesTownLock(s) || hasAttendantMysteriesLifeLock(s) || hasAttendantMysteriesEncounterLock(s);
// Recovery pays only for nine new auxiliary samples; the recovered original is never sold twice.
const price = (b: AttendantMysteriesBatch) => b.recovery ? (b.labourSteps === ATTENDANT_MYSTERIES_LABOUR_STEPS ? 90 : 900) : b.labourSteps === ATTENDANT_MYSTERIES_LABOUR_STEPS ? PRICES.labourBalance : PRICES.materials;
const exhausted = (a: AttendantMysteriesState) => a.batches.every(b => a.bottles.some(p => p.batchId === b.id && p.status === 'CONSUMED' && !win(p.outcome)));
const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
const townEvidenceCommand = (c: { type: string }) => recoveryCommand(c) || ['PREPARE_PROMOTION', 'CONSUME', 'LEAVE_PREPARATION'].includes(c.type);
function recoverySource(a: AttendantMysteriesState, bottleId: string) {
  const bottle = a.bottles.find(b => b.id === bottleId), batch = a.batches.find(b => b.id === bottle?.batchId);
  if (!bottle || !batch || bottle.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '') || !bottle.regionId) return null;
  const original = batch.materials[0];
  if (!original || original.holder !== 'CONSUMED' || original.quantity !== 0 || bottle.inputIds[0] !== original.id || a.batches.some(b => b.recovery?.sourceBottleId === bottleId)) return null;
  // Old consumed material rows are immutable history. Only the latest failed bottle
  // can return this characteristic; any live batch/bottle already holding it blocks recovery.
  if (a.batches.some(b => b.materials[0]?.id === original.id && (b.materials[0].holder !== 'CONSUMED' || a.bottles.some(p => p.batchId === b.id && (p.status === 'PREPARED' || win(p.outcome)))))) return null;
  const consumed = a.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId);
  const region = consumed?.townEvidence?.region;
  if (!consumed || consumed.week !== bottle.consumedWeek || consumed.check?.tier !== bottle.outcome || !region || region.id !== bottle.regionId || consumed.townEvidence?.operatorAt !== region.plot) return null;
  // Relocating the town does not move a failed original. Its retired region still identifies its site.
  const retained = a.town?.region?.id === region.id ? a.town.region : a.town?.retiredRegions.find(r => r.id === region.id);
  if (!retained || retained.plot !== region.plot || retained.epoch !== region.epoch) return null;
  return { bottle, original, region };
}
function validateAcquisitionCommand(v: unknown, replayLegacySupply = false): v is AttendantMysteriesAcquisitionCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (legacySupply(v as { type: string })) return replayLegacySupply && shape(v, ['type']);
  if (['LEARN_GUIDANCE', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (recoveryCommand(v as { type: string })) return shape(v, ['type', 'bottleId']) && typeof v.bottleId === 'string' && /^attendant-mysteries-batch-[1-9]\d{0,5}:bottle$/.test(v.bottleId);
  if (['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(v.type)) return shape(v, ['type', 'batchId']) && typeof v.batchId === 'string' && /^attendant-mysteries-batch-[1-9]\d{0,5}$/.test(v.batchId);
  if (v.type === 'PREPARE_PROMOTION') return shape(v, ['type', 'bottleId']) && typeof v.bottleId === 'string' && /^attendant-mysteries-batch-[1-9]\d{0,5}:bottle$/.test(v.bottleId);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true && typeof v.bottleId === 'string' && /^attendant-mysteries-batch-[1-9]\d{0,5}:bottle$/.test(v.bottleId);
}
export function validateAttendantMysteriesAcquisitionCommand(v: unknown): v is AttendantMysteriesAcquisitionCommand {
  return validateAcquisitionCommand(v);
}
export function validateAttendantMysteriesCommand(v: unknown): v is AttendantMysteriesCommand {
  return validateAttendantMysteriesReceptionCommand(v) || validateAttendantMysteriesAcquisitionCommand(v) || object(v) && v.type === 'TOWN' && shape(v, ['type', 'command']) && validateTownCommand(v.command) || validateAttendantMysteriesActivityCommand(v) || validateAttendantMysteriesEncounterCommand(v);
}
function acquisitionBlock(s: SliceState, c: AttendantMysteriesAcquisitionCommand, replayLegacySupply = false): string | null {
  if (legacySupply(c) && !replayLegacySupply) return '旧独立供货命令仅供历史回放；须调查并追回真实失败原特性。';
  if (!eligible(s) || s.status !== 'ACTIVE' || s.progression.sequence !== 2) return '须是仍活着的奇迹师，且本阶尚未晋升。';
  const a = s.attendantMysteries;
  if (c.type === 'LEAVE_PREPARATION') return a.preparation ? null : '当前没有未收束的服药准备。';
  if (a.preparation && c.type !== 'CONSUME') return '先处理或取消当前所选原瓶的服药准备。';
  if (c.type === 'LEARN_GUIDANCE') return a.guidanceKnown ? '指导已经取得。' : !oldReports(s) || hasMiracleWorkerLock(s) ? '先完成奇迹师三案反思，并从原现场真实收束。' : s.actionsRemaining < 1 || s.cash < PRICES.guidance ? `指导需要1行动、${PRICES.guidance}便士。` : null;
  if (!a.guidanceKnown || !a.town) return '先学习配方与真实城镇要求。';
  if (c.type === 'PREPARE_PROMOTION' || c.type === 'CONSUME') {
    const b = a.bottles.find(b => b.id === c.bottleId), t = a.town;
    if (!b || b.status !== 'PREPARED') return '这一原瓶尚未调成或已经耗尽。';
    if (s.progression.acting !== 100 || !oldReports(s)) return '奇迹师消化须达100，并完成原生活报告与反思。';
    if (s.health <= 20 || s.mind <= 40) return '本次饮药须健康>20且精神>40；可以先取消准备再真实休养。';
    if (!t.plot || t.operatorAt !== t.plot || !hasUsableTownRegion(t, s.week)) return '须本人在具有有效新生灵界区域的原镇内，原居民和往来仍合格。';
    if (c.type === 'PREPARE_PROMOTION') return s.actionsRemaining < 1 || s.cash < PRICES.prepare ? `检查本次服药场地需要1行动、${PRICES.prepare}便士。` : null;
    const p = a.preparation;
    return !p || p.week !== s.week || p.bottleId !== b.id || p.regionId !== t.region!.id || p.epoch !== t.epoch || p.townJournalLength !== t.journal.length || p.evidenceDigest !== sha256Hex(stableStringify(t)) ? '本周所选原瓶与原镇状态没有完成对应准备。' : null;
  }
  if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
    const source = recoverySource(a, c.bottleId), pending = a.resupply.recovery;
    if (!exhausted(a)) return '已有原批仍可使用，须先耗尽现有原瓶后调查原特性。';
    if (!source) return '须有可核验的原失败瓶、原特性与失败现场；同一份不能重复持有或回收。';
    if (c.type === 'REQUEST_RECOVERY_V1') return pending ? '已有指定原瓶的调查委托，须先完成原处回收。' : a.town.operatorAt !== 'base' ? '须本人沿原路回接待处调查失败原瓶的去向。' : s.actionsRemaining < 1 || s.cash < PRICES.resupply ? '调查原特性需要1行动、120便士；既往费用不退。' : null;
    if (!pending || pending.version !== 1 || pending.sourceBottleId !== c.bottleId || pending.characteristicId !== source.original.id || pending.regionId !== source.region.id || pending.plot !== source.region.plot || pending.requestedWeek !== a.resupply.requestedWeek) return '须先为这一真实失败原瓶支付对应调查委托。';
    if (s.week <= pending.requestedWeek) return '调查后至少隔一真实周才能回收。';
    if (a.town.operatorAt !== pending.plot) return `须本人回到失败原处${ATTENDANT_MYSTERIES_PLACES[pending.plot]}，不能在接待处或迁址后新镇远程回收。`;
    return s.actionsRemaining < 1 ? '原处核验、回收并封存需要1行动。' : null;
  }
  if (a.town.operatorAt !== 'base') return '材料交接和供货委托须本人沿原路回到接待处。';
  if (c.type === 'REQUEST_SUPPLY') return !exhausted(a) ? '已有原批仍可使用，不能提前刷新材料。' : a.resupply.requestedWeek !== null ? '本次新原批已经委托，须隔周核验。' : s.actionsRemaining < 1 || s.cash < PRICES.resupply ? '另行供货委托需要1行动、120便士。' : null;
  if (c.type === 'RECEIVE_SUPPLY') return a.resupply.requestedWeek === null || s.week <= a.resupply.requestedWeek ? '须实际委托并隔周核验新原批。' : s.actionsRemaining < 1 ? '核验新批需要1行动。' : null;
  if (!('batchId' in c)) return '无效原批。'; const b = a.batches.find(b => b.id === c.batchId);
  if (!b || b.stockedWeek === null) return '这一原批尚未实际到货。';
  if (c.type === 'MATERIAL_WORK') return b.acquiredWeek !== null || b.labourSteps >= ATTENDANT_MYSTERIES_LABOUR_STEPS ? '这一批劳动已完或原料已经交付。' : s.actionsRemaining < 1 ? '核验原批劳动需要1行动。' : null;
  if (c.type === 'BUY_MATERIALS') return b.acquiredWeek !== null ? '这一原批已经交付。' : s.cash < price(b) ? `这一${b.recovery ? '重配批九种新辅料' : '原批'}需要${price(b)}便士；五次真实劳动后${b.recovery ? 90 : 900}便士。` : null;
  return b.acquiredWeek === null || b.brewedWeek !== null ? '须持有尚未调配的这一整批原料。' : s.actionsRemaining < 1 || s.cash < PRICES.brew ? '调配需要1行动、120便士。' : null;
}
export function attendantMysteriesAcquisitionBlock(s: SliceState, c: AttendantMysteriesAcquisitionCommand): string | null {
  return acquisitionBlock(s, c);
}
function mutateAcquisition(s: SliceState, c: AttendantMysteriesAcquisitionCommand, ctx: SeerContext, replayLegacySupply = false): void {
  const reason = acquisitionBlock(s, c, replayLegacySupply); if (reason) throw Error(reason); const a = s.attendantMysteries;
  if (c.type === 'LEARN_GUIDANCE') { s.actionsRemaining--; s.cash -= PRICES.guidance; a.guidanceKnown = true; a.guidanceWeek = s.week; a.sourceHistoryDigest = attendantMysteriesSourceDigest(s); a.town = createTownState(s.week); a.batches.forEach(b => b.stockedWeek = s.week); ctx.note('取得诡秘侍者配方与城镇指导', ATTENDANT_MYSTERIES_STORY + ATTENDANT_MYSTERIES_BOUNDARY); return; }
  if (c.type === 'LEAVE_PREPARATION') { a.preparation = null; ctx.note('取消本次服药准备', '原瓶仍在，已经支付的场地检查费不返还；原城镇和既往经历不重置。'); return; }
  if (c.type === 'REQUEST_SUPPLY') { s.actionsRemaining--; s.cash -= PRICES.resupply; a.resupply.requestedWeek = s.week; ctx.note('实际委托新的独立原批', '120便士和1行动已付；至少隔一周核验新封签，旧瓶仍耗尽。'); return; }
  if (c.type === 'RECEIVE_SUPPLY') { s.actionsRemaining--; a.batches.push(freshBatch(a.batches.length + 1, s.week)); a.resupply.deliveries++; a.resupply.requestedWeek = null; ctx.note('新原批真实到货', `${a.batches.at(-1)!.id}单独供货记录已核，仍须劳动或足价取得并调配。`); return; }
  if (c.type === 'REQUEST_RECOVERY_V1') {
    const source = recoverySource(a, c.bottleId)!; s.actionsRemaining--; s.cash -= PRICES.resupply;
    a.resupply.requestedWeek = s.week;
    a.resupply.recovery = { version: 1, sourceBottleId: c.bottleId, characteristicId: source.original.id, regionId: source.region.id, plot: source.region.plot, requestedWeek: s.week };
    ctx.note('调查真实失败原特性的去向', `${c.bottleId}的${source.original.id}仍在原失败现场${ATTENDANT_MYSTERIES_PLACES[source.region.plot]}。120便士和1行动已付；隔周本人回原处回收，旧瓶、伤势与既往费用不重置。`); return;
  }
  if (c.type === 'RECOVER_CHARACTERISTIC_V1') {
    const source = recoverySource(a, c.bottleId)!, recovery = { ...a.resupply.recovery!, recoveredWeek: s.week };
    const id = `attendant-mysteries-batch-${a.batches.length + 1}`;
    s.actionsRemaining--;
    a.batches.push({ id, stockedWeek: s.week, labourSteps: 0, acquiredWeek: null, brewedWeek: null, recovery,
      materials: [{ ...source.original, quantity: 1, holder: 'PLAYER' }, ...ATTENDANT_MYSTERIES_FORMULA.slice(1).map((m, index) => ({ id: `${id}:${m.id}`, name: m.name, quantity: m.quantity, unit: m.unit,
        source: `灵界采集队新辅料AM1-RECOVERY-${a.batches.length + 1}-${index + 1}，只补这一重配批的不同特产，须另行真实付费交付。`, holder: 'SUPPLIER' as const }))] });
    a.resupply.deliveries++; a.resupply.requestedWeek = null; delete a.resupply.recovery;
    ctx.note('在原失败现场回收并封存同一份特性', `${source.original.id}原ID不变，已回收封存到${id}。旧原瓶仍耗尽；九种新辅料另付900便士，完成五项真实核验劳动后90便士，调配另付120便士和1行动。`); return;
  }
  if (c.type === 'PREPARE_PROMOTION') { const t = a.town!; s.actionsRemaining--; s.cash -= PRICES.prepare; a.preparation = { week: s.week, bottleId: c.bottleId, regionId: t.region!.id, epoch: t.epoch, townJournalLength: t.journal.length, evidenceDigest: sha256Hex(stableStringify(t)) }; ctx.note('镇内检查本次原瓶和重组准备', `${c.bottleId}绑定当前原城镇及${t.region!.id}。确认后服药会耗尽此瓶；城镇原人原物仍在。`); return; }
  if (c.type === 'CONSUME') {
    const b = a.bottles.find(b => b.id === c.bottleId)!, result = ctx.check('will', 30); b.status = 'CONSUMED'; b.consumedWeek = s.week; b.outcome = result.tier; b.regionId = a.preparation!.regionId; a.preparation = null;
    if (win(result.tier)) { a.promotionWeek = s.week; a.miracleWorkerActingAtPromotion = 100; s.progression.sequence = 1; s.progression.acting = 0; s.mind = Math.max(1, s.mind - (result.tier === 'GREAT_SUCCESS' ? 8 : 15)); for (const id of ATTENDANT_MYSTERIES_ABILITY_IDS) s.progression.mastery[id] = 0; for (const k of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[k] = Math.min(500, s.character.coreStats[k] + 1); ctx.note('原秘偶城镇在灵界的投影帮助重组，晋升诡秘侍者', `本次${result.roll}/${result.chance}，${result.tier}。原瓶耗尽；旧31项掌握、原灵之虫、死者与四次复起账本保留，三项新掌握从0开始。`); }
    else { const severe = result.tier === 'GREAT_FAILURE'; s.health = Math.max(1, s.health - (severe ? 25 : 15)); s.mind = Math.max(1, s.mind - (severe ? 45 : 25)); s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30)); ctx.note('本瓶排异未晋升，原城镇仍在', `${result.roll}/${result.chance}，${result.tier}。原瓶真实耗尽，身心损害与排异保留；可以取消后续尝试、沿路离开，或恢复后筹新药并重新检查仍存在的原镇。`); }
    return;
  }
  if (!('batchId' in c)) throw Error('无效原批命令。');
  const b = a.batches.find(b => b.id === c.batchId)!;
  if (c.type === 'MATERIAL_WORK') { s.actionsRemaining--; b.labourSteps++; ctx.note('完成这一原批的实际核验劳动', `${b.id}第${b.labourSteps}/5项：${[b.recovery ? '核同一失败原特性的回收封签与原ID' : '核原特性封签与独立遗产', '核前三种不同灵界特产', '核中间三种原特产', '核最后三种原特产', '核全批运输和交付凭据'][b.labourSteps - 1]}。旧材料不重复生成。`); }
  else if (c.type === 'BUY_MATERIALS') { s.cash -= price(b); b.acquiredWeek = s.week; b.materials.forEach(m => m.holder = 'PLAYER'); ctx.note(b.recovery ? '本批九种新辅料实际交付' : '本批主料与九种辅料实际交付', b.recovery ? `${b.id}支付${price(b)}便士取得九种新辅料；原特性${b.materials[0]!.id}来自已付费追回的同一失败原瓶，不重新生成。` : `${b.id}支付${price(b)}便士；十项原料各有独立封存来源。`); }
  else { s.actionsRemaining--; s.cash -= PRICES.brew; b.brewedWeek = s.week; b.materials.forEach(m => { m.holder = 'CONSUMED'; m.quantity = 0; }); a.bottles.push({ id: `${b.id}:bottle`, batchId: b.id, inputIds: b.materials.map(m => m.id), brewedWeek: s.week, status: 'PREPARED', consumedWeek: null, outcome: null, regionId: null }); ctx.note('原料真实调成诡秘侍者原瓶', `${b.id}十项原料全部耗用，唯一原瓶已在手；这不代替城镇仪式。`); }
}
export function applyAttendantMysteriesAcquisition(s: SliceState, c: AttendantMysteriesAcquisitionCommand, ctx: SeerContext): void {
  const before = attendantMysteriesBudget(s), randomBefore = s.random.cursor, townEvidence = townEvidenceCommand(c) ? structuredClone(s.attendantMysteries.town) : null;
  let check: PublicCheckResult | null = null;
  const recording: SeerContext = { ...ctx, check(k, difficulty) { if (check || c.type !== 'CONSUME' || k !== 'will' || difficulty !== 30) throw Error('本次检定来源不符。'); check = structuredClone(ctx.check(k, difficulty)); return check; } };
  const actor: AttendantMysteriesAcquisitionEvent['actor'] = { name: s.character.name, gender: s.character.gender, age: s.character.age, pathwayId: 'diviner', miracleWorkerPromotionWeek: s.miracleWorker.promotionWeek!, sourceHistoryDigest: attendantMysteriesSourceDigest(s) };
  mutateAcquisition(s, c, recording);
  s.attendantMysteries.acquisitionJournal.push({ week: s.week, date: { ...s.date }, revision: s.revision, command: structuredClone(c), actor, before, after: attendantMysteriesBudget(s), randomBefore, randomAfter: s.random.cursor, check, townEvidence });
}
function acquisitionPart(a: AttendantMysteriesState) { return { guidanceKnown: a.guidanceKnown, guidanceWeek: a.guidanceWeek, sourceHistoryDigest: a.sourceHistoryDigest, batches: a.batches, bottles: a.bottles, resupply: a.resupply, promotionWeek: a.promotionWeek, miracleWorkerActingAtPromotion: a.miracleWorkerActingAtPromotion, preparation: a.preparation }; }
export function validateAttendantMysteriesAcquisitionJournal(s: SliceState): boolean {
  try {
    const a = s.attendantMysteries, expected = createAttendantMysteriesState(); if (!Array.isArray(a.acquisitionJournal) || a.acquisitionJournal.length > 4096) return false;
    let previous: AttendantMysteriesAcquisitionEvent | null = null;
    for (const e of a.acquisitionJournal) {
      if (!object(e) || !shape(e, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check', 'townEvidence']) || !validateAcquisitionCommand(e.command, true) || !validAttendantMysteriesBudget(e.before) || !validAttendantMysteriesBudget(e.after) || e.before.sequence !== 2 ||
        !int(e.week, s.miracleWorker.promotionWeek ?? s.week, s.week) || !int(e.revision, (previous?.revision ?? -1) + 1, s.revision) || !isValidGameDate(e.date) || compareGameDates(e.date, s.date) > 0 || gameDaysBetween(ORIGIN, e.date) !== 7 * (e.week - 1) + s.ancientScholar.ritual.calendarRemainderDays ||
        !same(e.actor, { name: s.character.name, gender: s.character.gender, age: s.character.age, pathwayId: 'diviner', miracleWorkerPromotionWeek: s.miracleWorker.promotionWeek, sourceHistoryDigest: attendantMysteriesSourceDigest(s) }) ||
        !int(e.randomBefore, previous?.randomAfter ?? 0, s.random.cursor) || !int(e.randomAfter, e.randomBefore, s.random.cursor) ||
        !shape(e.before.mastery, ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS) || !shape(e.after.mastery, [...ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS, ...(e.after.sequence === 1 ? ATTENDANT_MYSTERIES_ABILITY_IDS : [])])) return false;
      if (previous && (e.week < previous.week || previous.after.sequence === 1 || expected.preparation && (!same(e.before, previous.after) || e.week !== previous.week))) return false;
      if (e.townEvidence) { if (!validateTownState(e.townEvidence) || !a.town || e.townEvidence.originWeek !== a.guidanceWeek || !same(e.townEvidence.journal, a.town.journal.slice(0, e.townEvidence.journal.length))) return false; expected.town = structuredClone(e.townEvidence); }
      else if (townEvidenceCommand(e.command)) return false;
      else if (expected.guidanceKnown) expected.town = createTownState(expected.guidanceWeek!);
      const b = e.before, shadow: SliceState = { ...s, status: 'ACTIVE', week: e.week, date: { ...e.date }, revision: e.revision, health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, activeEvent: null, combat: null, random: { seed: s.random.seed, cursor: e.randomBefore }, character: { ...s.character, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'diviner', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } }, seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, attendantMysteries: expected };
      let checks = 0;
      const ctx: SeerContext = { note() {}, roll() { throw Error('材料筹备没有额外骰。'); }, check(ability, difficulty) { if (++checks !== 1 || e.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw Error('检定参数不符'); const rng = new DeterministicActionRandomStream(s.random.seed, e.randomBefore); const result = resolveNormalCheck({ ability, baseAbility: b.coreStats.will, difficulty, modifiers: [], roll: rng.nextInt(1, 100) }); if (!same(result, e.check)) throw Error('检定不符'); shadow.random.cursor = rng.cursor; return result; } };
      mutateAcquisition(shadow, e.command, ctx, true);
      if (!same(attendantMysteriesBudget(shadow), e.after) || shadow.random.cursor !== e.randomAfter || (e.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || e.check !== null)) return false;
      expected.acquisitionJournal.push(e);
      previous = e;
    }
    if (!same(acquisitionPart(expected), acquisitionPart(a))) return false;
    if (a.preparation && (!previous || !same(attendantMysteriesBudget(s), previous.after) || previous.week !== s.week || !a.town || a.preparation.evidenceDigest !== sha256Hex(stableStringify(a.town)))) return false;
    return true;
  } catch { return false; }
}
export function attendantMysteriesCommandBlock(s: SliceState, c: AttendantMysteriesCommand): string | null {
  if (legacySupply(c)) return '旧独立供货命令仅供历史回放；须调查并追回真实失败原特性。';
  if (!eligible(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.combat || (s.activeEvent && c.type !== 'LEAVE_ENCOUNTER') || hasMiracleWorkerLock(s)) return '先活着完成原奇迹师现场、当前战斗或事件。';
  if (hasAttendantMysteriesEncounterLock(s) && !validateAttendantMysteriesEncounterCommand(c)) return '先从当前真实交涉现场退出。';
  if (hasAttendantMysteriesLifeLock(s) && !validateAttendantMysteriesActivityCommand(c)) return '先解除本次效果、归还原物并普通退出工房。';
  if (validateAttendantMysteriesAcquisitionCommand(c)) return attendantMysteriesAcquisitionBlock(s, c);
  if (c.type === 'TOWN') return attendantMysteriesTownBlock(s, c.command);
  if (hasAttendantMysteriesTownLock(s) || s.attendantMysteries.preparation) return '先结束当前准备并沿原路回接待处，再去工房。';
  if (validateAttendantMysteriesReceptionCommand(c)) return blockAttendantMysteriesReception(s, c);
  if (validateAttendantMysteriesActivityCommand(c)) return blockAttendantMysteriesActivity(s, c);
  return blockAttendantMysteriesEncounter(s, c);
}
export function applyAttendantMysteriesCommand(s: SliceState, c: AttendantMysteriesCommand, ctx: SeerContext): void {
  const reason = attendantMysteriesCommandBlock(s, c); if (reason) throw Error(reason);
  if (validateAttendantMysteriesReceptionCommand(c)) return applyAttendantMysteriesReception(s, c, ctx);
  if (validateAttendantMysteriesAcquisitionCommand(c)) return applyAttendantMysteriesAcquisition(s, c, ctx);
  if (c.type === 'TOWN') return applyAttendantMysteriesTown(s, c.command, ctx);
  if (validateAttendantMysteriesActivityCommand(c)) return applyAttendantMysteriesActivity(s, c, ctx);
  return applyAttendantMysteriesEncounterCommand(s, c, ctx);
}
export function projectAttendantMysteries(s: SliceState): AttendantMysteriesProjection {
  const a = s.attendantMysteries, discovered = eligible(s), promoted = isAttendantMysteries(s), town = projectAttendantMysteriesTown(s), actions: AttendantMysteriesAction[] = [];
  const add = (label: string, command: AttendantMysteriesCommand, cost: string, cleanup = false) => { const reason = attendantMysteriesCommandBlock(s, command); actions.push({ id: `AM1:${stableStringify(command)}`, label, command, cost, enabled: reason === null, reason, cleanup, irreversible: command.type === 'CONSUME' }); };
  if (discovered && !promoted) {
    if (!a.guidanceKnown) add('学习配方与真实秘偶城镇要求', { type: 'LEARN_GUIDANCE' }, '1行动，500便士');
    else {
      for (const b of a.batches) if (b.acquiredWeek === null) { if (b.labourSteps < ATTENDANT_MYSTERIES_LABOUR_STEPS) add(`${b.id} 原批劳动 ${b.labourSteps}/5`, { type: 'MATERIAL_WORK', batchId: b.id }, '1行动'); add(`取得 ${b.id} ${b.recovery ? '九种新辅料（同一原特性已回收）' : '主料和九种辅料'}`, { type: 'BUY_MATERIALS', batchId: b.id }, `${price(b)}便士`); }
      else if (b.brewedWeek === null) add(`调配 ${b.id} 原瓶`, { type: 'BREW', batchId: b.id }, '1行动，120便士');
      if (exhausted(a)) {
        const pending = a.resupply.recovery;
        if (pending) add(`隔周到${ATTENDANT_MYSTERIES_PLACES[pending.plot]}追回并封存 ${pending.characteristicId}`, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: pending.sourceBottleId }, '1行动，须本人在原失败现场');
        else for (const bottle of a.bottles) if (recoverySource(a, bottle.id)) add(`调查并追回 ${bottle.id} 的同一原特性`, { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id }, '1行动，120便士，旧委托费不退；隔周原处回收，九种新辅料另付');
      }
      for (const b of a.bottles.filter(b => b.status === 'PREPARED')) add(a.preparation?.bottleId === b.id ? `确认饮用 ${b.id}` : `在镇内为 ${b.id} 准备`, a.preparation?.bottleId === b.id ? { type: 'CONSUME', bottleId: b.id, confirmed: true } : { type: 'PREPARE_PROMOTION', bottleId: b.id }, a.preparation?.bottleId === b.id ? '0行动，耗尽同一原瓶，接受排异风险' : '1行动，140便士');
      if (a.preparation) add('取消本次原瓶准备', { type: 'LEAVE_PREPARATION' }, '0行动，已付检查费不返还', true);
    }
  }
  if (discovered) for (const action of [...town.actions, ...attendantMysteriesReceptionActions(s), ...attendantMysteriesLifeActions(s), ...attendantMysteriesEncounterActions(s)]) { const reason = attendantMysteriesCommandBlock(s, action.command); actions.push({ ...action, enabled: reason === null, reason }); }
  const life = projectAttendantMysteriesLife(s), encounter = projectAttendantMysteriesEncounter(s);
  const next = a.preparation ? actions.find(x => x.enabled && x.command.type === 'CONSUME') : !a.guidanceKnown ? actions.find(x => x.enabled) : !promoted ? actions.find(x => x.enabled && recoveryCommand(x.command)) ?? actions.find(x => x.id === town.preferredActionId && x.enabled) ?? actions.find(x => x.enabled && !x.cleanup) : actions.find(x => x.enabled && x.command.type !== 'TOWN' && x.preferredAction) ?? actions.find(x => x.enabled && x.command.type !== 'TOWN');
  return { title: promoted ? '诡秘侍者 · 序列1' : '诡秘侍者之路 · 活在历史中的秘偶城镇', discovered, promoted, guidanceKnown: a.guidanceKnown, formulaKnown: a.guidanceKnown,
    formula: a.guidanceKnown ? ATTENDANT_MYSTERIES_FORMULA.map(x => ({ ...x })) : [], story: ATTENDANT_MYSTERIES_STORY, boundary: ATTENDANT_MYSTERIES_BOUNDARY, risk: ATTENDANT_MYSTERIES_RISK,
    supplies: `${new Set(a.batches.map(b => b.materials[0]!.id)).size}份原特性，${a.batches.length}批配料记录（含同一原特性回收重配），${a.bottles.length}瓶已调配，${a.bottles.filter(b => b.status === 'CONSUMED').length}瓶已耗尽。`, nextStep: next?.label ?? town.nextStep, preferredActionId: next?.id ?? null, actions,
    bottles: a.bottles.map(b => ({ id: b.id, title: b.id, source: a.batches.find(x => x.id === b.batchId)!.materials[0]!.source, status: b.status === 'CONSUMED' ? `已耗尽，${b.outcome}` : '同一原瓶在手', chance: computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }), command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })),
    abilities: promoted ? [...ATTENDANT_MYSTERIES_INHERITED_ABILITIES, ...ATTENDANT_MYSTERIES_ABILITIES].map(x => ({ ...x, mastery: s.progression.mastery[x.id] ?? 0 })) : [], acting: promoted ? s.progression.acting : 0,
    digestion: `奇迹师原消化${a.miracleWorkerActingAtPromotion ?? s.progression.acting}/100；新阶通过真实有限实践和反思消化。`, pollution: s.seer.pollution,
    resources: discovered ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    injuries: s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })), injuryRisk: s.injuryRisk,
    inheritedHistory: ['旧31项能力的真实掌握，包括0掌握，继续保留。', `旧灵之虫实际分出${s.bizarroSorcerer.life.worms.split}，回收${s.bizarroSorcerer.life.worms.recalled}，丢失${s.bizarroSorcerer.life.worms.lost}。`, `原奇迹师四次复起已用${s.miracleWorker.revival.used}次；本阶段未新增可复起死亡来源。`, '原多恩死亡、已放生原鼠、既往投降、旧原瓶和长期时代记录不变。'],
    insideCase: hasAttendantMysteriesLock(s), environment: town.summary, reception: projectAttendantMysteriesReception(s), town, life, encounter };
}
export function validateAttendantMysteriesState(s: SliceState): boolean {
  try {
    const a = s.attendantMysteries, empty = createAttendantMysteriesState();
    if (!object(a) || !shape(a, Object.keys(empty)) || !Array.isArray(a.townJournal) || a.townJournal.length > 1024 || !validateAttendantMysteriesAcquisitionJournal(s)) return false;
    if (!a.guidanceKnown) return same({ ...a, reception: empty.reception }, empty) && validateAttendantMysteriesReception(s);
    if (!eligible(s) || !int(a.guidanceWeek, s.miracleWorker.promotionWeek!, s.week) || a.sourceHistoryDigest !== attendantMysteriesSourceDigest(s) || !validateAttendantMysteriesTown(s)) return false;
    if (a.promotionWeek !== null) { if (!isAttendantMysteries(s) || !int(a.promotionWeek, a.guidanceWeek!, s.week) || a.miracleWorkerActingAtPromotion !== 100 || a.bottles.filter(b => win(b.outcome)).length !== 1 || !shape(s.progression.mastery, [...ATTENDANT_MYSTERIES_INHERITED_ABILITY_IDS, ...ATTENDANT_MYSTERIES_ABILITY_IDS])) return false; }
    else if (s.progression.sequence !== 2 || a.miracleWorkerActingAtPromotion !== null || ATTENDANT_MYSTERIES_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (!validateAttendantMysteriesReception(s) || !validateAttendantMysteriesLife(s) || !validateAttendantMysteriesEncounter(s)) return false;
    if (a.promotionWeek !== null) {
      const promotion = a.acquisitionJournal.find(e => e.command.type === 'CONSUME' && win(e.check?.tier ?? null));
      if (!promotion || !same(s.character.coreStats, promotion.after.coreStats)) return false;
      const reward = attendantMysteriesLifeRewards(a.life), expectedMastery = { ...promotion.after.mastery };
      for (const id of ATTENDANT_MYSTERIES_ABILITY_IDS) expectedMastery[id] = reward.mastery[id];
      const first = s.combatHistory.find(r => r.attendantMysteriesOutcome)?.attendantMysteriesOutcome;
      const last = s.combatHistory.filter(r => r.attendantMysteriesOutcome).at(-1)?.attendantMysteriesOutcome;
      if (first && !same(first.source.mastery, expectedMastery)) return false;
      if (!same(s.progression.mastery, last?.masteryAfter ?? expectedMastery) || s.progression.acting !== reward.acting ||
        !same(s.seer.completedSources, [...promotion.after.completedSources, ...a.life.completedSources])) return false;
    }
    return true;
  } catch { return false; }
}
export type * from './types.js';
