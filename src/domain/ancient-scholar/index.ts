import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates } from '../game-calendar.js';
import { ANCIENT_SCHOLAR_ABILITIES, ANCIENT_SCHOLAR_BOUNDARY, ANCIENT_SCHOLAR_CONSUMPTION_RISK, ANCIENT_SCHOLAR_FORMULA, ANCIENT_SCHOLAR_LABOUR_STEPS, ANCIENT_SCHOLAR_PRICES as PRICE, ANCIENT_SCHOLAR_SOURCE } from './content.js';
import { ANCIENT_SCHOLAR_ABILITY_IDS, ANCIENT_SCHOLAR_RECORD_IDS, type AncientScholarAcquisitionCommand, type AncientScholarAction, type AncientScholarBatch, type AncientScholarCommand, type AncientScholarProjection, type AncientScholarState } from './types.js';
import { ancientScholarRitualActions, applyAncientScholarRitual, canConsumeAncientScholar, createAncientScholarRitualState, currentAncientScholarVisit, hasAncientScholarEraClosure, hasAncientScholarLock, insideAncientScholarIsolation, projectAncientScholarRitual, validateAncientScholarRitualCommand, validateAncientScholarRitualState } from './ritual.js';
import { ancientScholarLifeActions, applyAncientScholarActivity, createAncientScholarLifeState, hasAncientScholarLifeLock, projectAncientScholarLife, validateAncientScholarActivityCommand, validateAncientScholarLife } from './life.js';
import { ancientScholarEncounterActions, applyAncientScholarEncounter, createAncientScholarEncounterState, hasAncientScholarEncounterLock, projectAncientScholarEncounter, validateAncientScholarEncounterCommand, validateAncientScholarEncounter } from './encounter.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export const isAncientScholar = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 3;
const available = (s: SliceState) => s.progression.pathwayId === 'diviner' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.bizarroSorcerer.promotionWeek !== null;
const price = (batch: AncientScholarBatch) => batch.labourSteps === ANCIENT_SCHOLAR_LABOUR_STEPS ? PRICE.labourMaterial : PRICE.material;
const source = (number: number, week: number | null) => `AS3-ARCHIVE持照材料渠道本作G第${number}批原封材料，${week === null ? '初始原库存' : `第${week}周实际到货`}；独立原件不由旧死敌人自动掉落。`;
function createBatch(number: number, stockedWeek: number | null): AncientScholarBatch {
  const id = `ancient-scholar-batch-${number}`;
  return { id, stockedWeek, labourSteps: 0, acquiredWeek: null, brewedWeek: null,
    materials: ANCIENT_SCHOLAR_FORMULA.map(f => ({ id: `${id}:${f.id}`, name: f.name, quantity: f.quantity, unit: f.unit, source: source(number, stockedWeek), holder: 'SUPPLIER', recordIds: [] })) };
}
export function createAncientScholarState(): AncientScholarState {
  return { formulaKnown: false, batches: [1, 2, 3].map(n => createBatch(n, null)), bottles: [], resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, bizarroActingAtPromotion: null,
    ritual: createAncientScholarRitualState(), life: createAncientScholarLifeState(), encounter: createAncientScholarEncounterState() };
}
const failedBatch = (a: AncientScholarState, b: AncientScholarBatch) => b.brewedWeek !== null && a.bottles.some(p => p.batchId === b.id && p.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(p.outcome ?? ''));
const exhausted = (a: AncientScholarState) => a.batches.length >= 3 && a.batches.every(b => failedBatch(a, b));
export function validateAncientScholarAcquisitionCommand(v: unknown): v is AncientScholarAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'CONSUME') return shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true && typeof v.bottleId === 'string' && /^ancient-scholar-batch-[1-9]\d{0,14}:bottle$/.test(v.bottleId);
  return ['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'].includes(String(v.type)) && shape(v, ['type', 'batchId']) && typeof v.batchId === 'string' && /^ancient-scholar-batch-[1-9]\d{0,14}$/.test(v.batchId);
}
export const isAncientScholarAcquisitionCommand = validateAncientScholarAcquisitionCommand;
export function ancientScholarAcquisitionBlock(s: SliceState, c: AncientScholarAcquisitionCommand): string | null {
  if (!validateAncientScholarAcquisitionCommand(c)) return '古代学者核心材料命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || !available(s)) return '须本人仍活着，实际完成诡法师晋升；普通死亡不能恢复。';
  if (s.activeEvent || s.combat || hasAncientScholarLifeLock(s) || hasAncientScholarEncounterLock(s)) return '先处理当前事件、战斗或正在进行的实践。';
  if (isAncientScholar(s)) return '已经真实晋升古代学者3，不能重复调配或服药。';
  const a = s.ancientScholar, r = a.ritual, ap = ['LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW'].includes(c.type) ? 1 : 0;
  if (c.type !== 'CONSUME') {
    if (insideAncientScholarIsolation(s)) return '完全隔绝封室内不能向外购买、申请或补给，只有入舱登记原瓶可用。';
    if (hasAncientScholarEraClosure(s) && r.location !== 'RECEPTION') return '须本人实际在当代接待处办理新材料。';
    if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原封室机构。';
  }
  if (s.actionsRemaining < ap) return '本次实际工作需要1行动。';
  if (c.type === 'LEARN_FORMULA') return a.formulaKnown ? '已经学过已核核心材料与未知余项边界。' : s.cash < PRICE.formula ? '实际来源与风险指导需要180便士。' : null;
  if (!a.formulaKnown) return '先了解核心配方、至少300年完全隔绝与G支持设施。';
  if (c.type === 'CONSUME') {
    const bottle = a.bottles.find(b => b.id === c.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选同一原瓶不存在或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药要求健康>20、精神>40；可有限耗用原恢复包或退出重筹。';
    if (s.progression.acting !== 100) return '原诡法师消化必须为100。';
    return canConsumeAncientScholar(s, bottle.id) ? null : '须本人仍在封室、同体与无通信连续隔绝已本地核验，且本瓶实际登记受保护；外界旧窗口不能使用。';
  }
  if (c.type === 'REQUEST_SUPPLY') return a.resupply.requestedWeek !== null ? '已经申请，下一真实周起才能领取新批次。' : exhausted(a) ? null : '现有全部独立原瓶须真实失败耗尽，不能无限补给。';
  if (c.type === 'RECEIVE_SUPPLY') return a.resupply.requestedWeek === null ? '先实际申请下一批三份原材料。' : s.week <= a.resupply.requestedWeek ? '须等待下一真实周才能到货。' : exhausted(a) ? null : '现有材料或原瓶未全部耗尽失败。';
  if (!('batchId' in c)) return '未知原材料命令。';
  const batch = a.batches.find(b => b.id === c.batchId); if (!batch) return '原材料批次不存在。';
  if (c.type === 'MATERIAL_WORK') return batch.acquiredWeek !== null ? '已交付的批次不能追溯劳动抵扣。' : batch.labourSteps >= 3 ? '本批三项实际材料劳动已经完成。' : null;
  if (c.type === 'BUY_MATERIALS') {
    if (batch.acquiredWeek !== null) return '本批材料已经实际交付。';
    if (r.records.some(a => a.verifiedDate === null)) return '先实际取得、核验三份古代原档案，才能为本批制作有来源的独立史料誊本。';
    return s.cash < price(batch) ? `这一整批原核心材料需${price(batch)}便士；三项实际劳动后180便士。` : null;
  }
  if (batch.acquiredWeek === null || batch.brewedWeek !== null) return '须实际取得尚未调配的这一整批原材料。';
  return s.cash < PRICE.brewing ? '实际调配需要60便士。' : null;
}
export function applyAncientScholarAcquisition(s: SliceState, c: AncientScholarAcquisitionCommand, ctx: SeerContext): void {
  const reason = ancientScholarAcquisitionBlock(s, c); if (reason) throw new Error(reason);
  const a = s.ancientScholar;
  if (c.type === 'LEARN_FORMULA') { s.actionsRemaining -= 1; s.cash -= PRICE.formula; a.formulaKnown = true; ctx.note('原机构实际指导古代学者核心配方与隔绝', `花1行动、180便士，原46岁玛拉·森与持照配药员说明：${ANCIENT_SCHOLAR_SOURCE}${ANCIENT_SCHOLAR_BOUNDARY}本次既未取得材料，也未满足隔绝。`); return; }
  if (c.type === 'REQUEST_SUPPLY') { s.actionsRemaining -= 1; a.resupply.requestedWeek = s.week; ctx.note('真实申请下一批三份独立材料', `全部旧原瓶已失败耗尽，花1行动申请，第${s.week + 1}周起实际到货。此刻不生成原瓶，不退失败成本。`); return; }
  if (c.type === 'RECEIVE_SUPPLY') { const first = a.batches.length + 1; for (let i = 0; i < 3; i += 1) a.batches.push(createBatch(first + i, s.week)); a.resupply.deliveries += 1; a.resupply.requestedWeek = null; ctx.note('三份新的原材料实际到货', `第${s.week}周，原批次${first}至${first + 2}进入当代供应方库存，仍须逐批真实采购/劳动与调配；旧失败原瓶、原料和真实年月不重置。`); return; }
  if (c.type === 'CONSUME') {
    const bottle = a.bottles.find(b => b.id === c.bottleId)!, visit = currentAncientScholarVisit(s)!, result = ctx.check('will', 30);
    bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier; bottle.visitId = visit.id;
    if (success(result.tier)) {
      const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15; s.mind = Math.max(1, s.mind - mindCost);
      a.bizarroActingAtPromotion = s.progression.acting; a.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
      for (const id of ANCIENT_SCHOLAR_ABILITY_IDS) s.progression.mastery[id] = 0;
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
      visit.result = 'PROMOTED';
      ctx.note('仍在完全隔绝封室内真实晋升古代学者3', `${bottle.id}在${visit.id}本地核验后实际耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}，四属性各+1，原诡法师消化100与全部旧掌握保留。三个新掌握0，当前灵性不补满，有限共同上限120G。没有自动获得全历史、未知秘密或天使库；尚需本人沿普通出口离舱，旧死者不复活。`);
    } else {
      const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25;
      s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
      ctx.note(severe ? '原瓶严重排异，仍为诡法师' : '原瓶排异，仍为诡法师', `${bottle.id}实际耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${severe ? 60 : 30}。G静封室原预置专业支持只使本次药败保底1，不保护普通战死。原消化100、300年履历及所有失败保留；仍完全隔绝，可耗有限原恢复包并用已登记备用瓶重试，或实际退出后新准备14天G重审。`);
    } return;
  }
  if (!('batchId' in c)) throw new Error('未知原材料命令。');
  const batch = a.batches.find(b => b.id === c.batchId)!;
  if (c.type === 'MATERIAL_WORK') { s.actionsRemaining -= 1; batch.labourSteps += 1; ctx.note(['核对本批两项主材原封签', '量取本批100mL原血与30g白霜', '准备本批史料誊录台与余项原封包'][batch.labourSteps - 1]!, `花1行动为${batch.id}完成第${batch.labourSteps}/3项实际材料劳动；三项后本批1500降至180便士，不送魔药、完整未知配方或已完成仪式。`); return; }
  if (c.type === 'BUY_MATERIALS') { const paid = price(batch); s.cash -= paid; batch.acquiredWeek = s.week; for (const material of batch.materials) { material.holder = 'PLAYER'; if (material.id.endsWith(':verified-history')) material.recordIds = [...ANCIENT_SCHOLAR_RECORD_IDS]; } ctx.note('整批原核心材料与本批史料实际交付', `支付${paid}便士，取得${batch.id}六项独立原件，含两主材、实量100mL原血和30g白霜、三原档案核验后的本批大量誊页及未知余项G原封包。没有假造主材重量；核验副本留存。一次整批采购，不重复点碎片。`); return; }
  s.actionsRemaining -= 1; s.cash -= PRICE.brewing; batch.brewedWeek = s.week;
  for (const m of batch.materials) { m.holder = 'CONSUMED'; m.quantity = 0; }
  a.bottles.push({ id: `${batch.id}:bottle`, batchId: batch.id, inputIds: batch.materials.map(m => m.id), brewedWeek: s.week, status: 'PREPARED', consumedWeek: null, outcome: null, visitId: null });
  ctx.note('独立古代学者原瓶实际调配完成', `花1行动、60便士，实际消耗${batch.id}全部原材料与本批药用史料誊页，留下三原档案与可读核验副本。产生唯一原瓶${batch.id}:bottle；尚未饮用，只有登记入舱原瓶可受固定设施保护。`);
}
export function validateAncientScholarCommand(v: unknown): v is AncientScholarCommand { return validateAncientScholarAcquisitionCommand(v) || validateAncientScholarRitualCommand(v) || validateAncientScholarActivityCommand(v) || validateAncientScholarEncounterCommand(v); }
export function applyAncientScholarCommand(s: SliceState, c: AncientScholarCommand, ctx: SeerContext): void {
  if (validateAncientScholarAcquisitionCommand(c)) return applyAncientScholarAcquisition(s, c, ctx);
  if (validateAncientScholarRitualCommand(c)) return applyAncientScholarRitual(s, c, ctx);
  if (validateAncientScholarActivityCommand(c)) return applyAncientScholarActivity(s, c, ctx);
  if (validateAncientScholarEncounterCommand(c)) return applyAncientScholarEncounter(s, c, ctx);
  throw new Error('古代学者命令无效。');
}
// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
const historicallyAvailable = (s: SliceState) => available(s) || hasAttendantHistory(s) && s.bizarroSorcerer.promotionWeek !== null;
const historicallyPromoted = (s: SliceState) => isAncientScholar(s) ||
  s.progression.pathwayId === 'diviner' && s.progression.sequence === 2 || hasAttendantHistory(s);
export function projectAncientScholar(s: SliceState): AncientScholarProjection {
  const a = s.ancientScholar, discovered = historicallyAvailable(s), promoted = a.promotionWeek !== null, actions: AncientScholarAction[] = [];
  const add = (id: string, label: string, cost: string, command: AncientScholarAcquisitionCommand) => { const reason = ancientScholarAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (discovered && !promoted) {
    if (!a.formulaKnown) add('as3-learn-formula', '了解古代学者核心配方、隔绝与原设施', '1行动 · 180便士 · 不冒称完整未知配方', { type: 'LEARN_FORMULA' });
    else if (!insideAncientScholarIsolation(s)) {
      if (a.resupply.requestedWeek !== null) add('as3-receive-supply', '接收下一真实周的新三批材料', `0行动 · 最早第${a.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhausted(a)) add('as3-request-supply', '申请下一批三份原材料', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const batch of a.batches) {
        if (batch.acquiredWeek === null) { if (batch.labourSteps < 3) add(`as3-work-${batch.id}`, `${batch.id} · 原材料劳动${batch.labourSteps}/3`, '1行动 · 三次后本批降至180便士', { type: 'MATERIAL_WORK', batchId: batch.id }); add(`as3-buy-${batch.id}`, `整批取得${batch.id}原核心材料`, `${price(batch)}便士 · 0行动 · 需真实核验三史料`, { type: 'BUY_MATERIALS', batchId: batch.id }); }
        else if (batch.brewedWeek === null) add(`as3-brew-${batch.id}`, `调配${batch.id}独立原瓶`, '1行动 · 60便士 · 原料和药用史料实际耗尽', { type: 'BREW', batchId: batch.id });
      }
    }
    if (a.formulaKnown) for (const bottle of a.bottles.filter(b => b.status === 'PREPARED')) add(`as3-consume-${bottle.id}`, `在原封室中饮用${bottle.id}`, '0行动 · 独立确认 · 需本地核验隔绝', { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }), ritual = projectAncientScholarRitual(s);
  return { title: promoted ? '古代学者 · 序列3' : '古代学者之路 · 真实300年隔绝', discovered, formulaKnown: a.formulaKnown, promoted,
    formula: a.formulaKnown ? ANCIENT_SCHOLAR_FORMULA.map(f => ({ name: f.name, quantity: f.quantity, unit: f.unit, ...('note' in f ? { note: f.note } : {}) })) : [],
    story: `${ANCIENT_SCHOLAR_SOURCE}${ANCIENT_SCHOLAR_BOUNDARY}`, supplies: `现有${a.batches.length}批独立原材料；已调配${a.bottles.length}瓶，未用${a.bottles.filter(b => b.status === 'PREPARED').length}瓶，耗尽${a.bottles.filter(b => b.status === 'CONSUMED').length}瓶。后续实际到货${a.resupply.deliveries}批；不在300年中自动累积补给。`,
    actions: discovered ? [...actions, ...ancientScholarRitualActions(s), ...ancientScholarLifeActions(s), ...ancientScholarEncounterActions(s)] : [],
    bottles: a.formulaKnown ? a.bottles.map(b => ({ id: b.id, title: b.id, source: `${b.batchId}的六项原件实际消耗调配；第${b.brewedWeek}周。${b.visitId ? `实际在${b.visitId}消耗。` : '尚未服用。'}`, status: b.status === 'PREPARED' ? '同一原瓶未用；只有入舱登记者受保护' : `原瓶耗尽 · ${b.outcome}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    abilities: promoted ? ANCIENT_SCHOLAR_ABILITIES.map(b => ({ ...b, mastery: s.progression.mastery[b.id] ?? 0 })) : [], acting: promoted ? ((s.progression.sequence===2||hasAttendantHistory(s))?s.miracleWorker.ancientActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `诡法师原消化${a.bizarroActingAtPromotion}/100保留；古代学者${hasAttendantHistory(s)?s.miracleWorker.ancientActingAtPromotion??100:s.progression.acting}/100，三个真实不同实践后反思为本作G。300年没有自动送消化。` : `须先诡法师100消化（当前${s.progression.acting}/100）；可以保持序列4。`, pollution: s.seer.pollution, risk: ANCIENT_SCHOLAR_CONSUMPTION_RISK,
    eraClosed: hasAncientScholarEraClosure(s), locked: hasAncientScholarLock(s), insideIsolation: insideAncientScholarIsolation(s), insideCase: insideAncientScholarIsolation(s) || hasAncientScholarLifeLock(s) || hasAncientScholarEncounterLock(s), environment: ritual.summary,
    ritual, life: projectAncientScholarLife(s), encounter: projectAncientScholarEncounter(s) };
}
export function validateAncientScholarState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const a = s.ancientScholar;
  if (!record(a) || !shape(a, ['formulaKnown', 'batches', 'bottles', 'resupply', 'promotionWeek', 'bizarroActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof a.formulaKnown !== 'boolean' || !record(a.resupply) || !shape(a.resupply, ['requestedWeek', 'deliveries']) || !integer(a.resupply.deliveries) || a.resupply.requestedWeek !== null && !integer(a.resupply.requestedWeek, 1, s.week)) return false;
  if (a.formulaKnown && !historicallyAvailable(s) || !Array.isArray(a.batches) || a.batches.length !== 3 * (a.resupply.deliveries + 1) || !Array.isArray(a.bottles) || new Set(a.bottles.map(b => b.id)).size !== a.bottles.length) return false;
  for (const [i, b] of a.batches.entries()) {
    const base = createBatch(i + 1, b.stockedWeek);
    if (!record(b) || !shape(b, Object.keys(base)) || b.id !== base.id || !integer(b.labourSteps, 0, 3) || ![b.stockedWeek, b.acquiredWeek, b.brewedWeek].every(w => w === null || integer(w, 1, s.week)) || !Array.isArray(b.materials) || b.materials.length !== ANCIENT_SCHOLAR_FORMULA.length) return false;
    if (i < 3 ? b.stockedWeek !== null : b.stockedWeek === null) return false;
    if (b.acquiredWeek !== null && b.stockedWeek !== null && b.acquiredWeek < b.stockedWeek || b.brewedWeek !== null && (b.acquiredWeek === null || b.brewedWeek < b.acquiredWeek) || !a.formulaKnown && (b.labourSteps || b.acquiredWeek !== null)) return false;
    for (const [j, m] of b.materials.entries()) {
      const expected = base.materials[j]!;
      if (!record(m) || !shape(m, Object.keys(expected)) || m.id !== expected.id || m.name !== expected.name || m.source !== expected.source || m.unit !== expected.unit || m.quantity !== (b.brewedWeek !== null ? 0 : expected.quantity) || m.holder !== (b.brewedWeek !== null ? 'CONSUMED' : b.acquiredWeek !== null ? 'PLAYER' : 'SUPPLIER')) return false;
      if (!same(m.recordIds, m.id.endsWith(':verified-history') && b.acquiredWeek !== null ? ANCIENT_SCHOLAR_RECORD_IDS : [])) return false;
    }
    if (a.bottles.filter(p => p.batchId === b.id).length !== (b.brewedWeek === null ? 0 : 1)) return false;
  }
  let wins = 0;
  for (const b of a.bottles) {
    if (!record(b) || !shape(b, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'consumedWeek', 'outcome', 'visitId'])) return false;
    const batch = a.batches.find(x => x.id === b.batchId); if (!batch || b.id !== `${batch.id}:bottle` || batch.brewedWeek !== b.brewedWeek || !same(b.inputIds, batch.materials.map(m => m.id))) return false;
    if (b.status === 'PREPARED') { if (b.outcome !== null || b.consumedWeek !== null || b.visitId !== null) return false; }
    else if (b.status === 'CONSUMED') {
      const v = a.ritual.visits.find(v => v.id === b.visitId);
      if (!integer(b.consumedWeek, b.brewedWeek, s.week) || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !v || v.qualifiedDate === null || v.verifiedDate === null || !v.registeredBottleIds.includes(b.id) || compareGameDates(v.verifiedDate, v.targetDate) < 0) return false;
      if (success(b.outcome)) { wins += 1; if (b.consumedWeek !== a.promotionWeek || v.result !== 'PROMOTED') return false; }
    } else return false;
  }
  if (historicallyPromoted(s)) {
    if (!a.formulaKnown || !integer(a.promotionWeek, 1, s.week) || a.bizarroActingAtPromotion !== 100 || wins !== 1 || ANCIENT_SCHOLAR_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], 0, 500))) return false;
  } else if (a.promotionWeek !== null || a.bizarroActingAtPromotion !== null || wins || ANCIENT_SCHOLAR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  if (!a.batches.slice(0, a.resupply.deliveries * 3).every(b => failedBatch(a, b)) || a.resupply.requestedWeek !== null && (!exhausted(a) || isAncientScholar(s) || hasAttendantHistory(s))) return false;
  if (a.batches.some(b => b.acquiredWeek !== null) && a.ritual.records.some(r => r.verifiedDate === null)) return false;
  return validateAncientScholarRitualState(s) && validateAncientScholarLife(s) && validateAncientScholarEncounter(s);
}
export { hasAncientScholarEraClosure, hasAncientScholarLock, insideAncientScholarIsolation } from './ritual.js';
export const validAncientScholarCommand = validateAncientScholarCommand;
export const validAncientScholarState = validateAncientScholarState;
export type * from './types.js';
