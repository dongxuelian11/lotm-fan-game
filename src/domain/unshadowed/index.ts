import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import {JUSTICE_MENTOR_ABILITY_IDS} from '../justice-mentor/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../notary/types.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS } from '../priest-of-light/types.js';
import { priestOfLightInside } from '../priest-of-light/life.js';
import { notaryInside } from '../notary/life.js';
import { createUnshadowedRitualState, currentUnshadowedVisit, hasUnshadowedRitualLock, canConsumeUnshadowedRitual, recordUnshadowedRitualDrink, validateUnshadowedRitualState, validateUnshadowedRitualCommand, applyUnshadowedRitualCommand, unshadowedRitualActions, projectUnshadowedRitual } from './ritual.js';
import { createUnshadowedLifeState, validateUnshadowedLife, projectUnshadowedLife, unshadowedLifeActions, hasUnshadowedLifeLock, validateUnshadowedActivityCommand } from './life.js';
import { createUnshadowedEncounterState, validateUnshadowedEncounter, projectUnshadowedEncounter, unshadowedEncounterActions, hasUnshadowedEncounterLock, validateUnshadowedEncounterCommand, applyUnshadowedEncounter } from './encounter.js';
import { UNSHADOWED_ABILITIES, UNSHADOWED_BATCH_IDS, UNSHADOWED_FORMULA, UNSHADOWED_PRICES, UNSHADOWED_LABOUR_STEPS, UNSHADOWED_LABOUR_TASKS, UNSHADOWED_MIN_PRIEST_OF_LIGHT_WEEKS, UNSHADOWED_FORMULA_SOURCE, UNSHADOWED_RITUAL_SOURCE, UNSHADOWED_SOURCE_STATUS, UNSHADOWED_CONSUMPTION_RISK } from './content.js';
import { UNSHADOWED_ABILITY_IDS, type UnshadowedAcquisitionCommand, type UnshadowedAction, type UnshadowedBatch, type UnshadowedCommand, type UnshadowedProjection, type UnshadowedState } from './types.js';
const batchSource = (n: number) => `原UD4-HALL调配室无暗者备料第${n}批；尾羽与神圣光辉石替代方案的六项独立原材料，本作G供货渠道。`;
function freshBatch(n: number, stockedWeek: number | null): UnshadowedBatch {
  const id = `unshadowed-batch-${n}`;
  return { id, stockedWeek, labourSteps: 0, acquired: false, acquiredWeek: null, brewed: false, materials: UNSHADOWED_FORMULA.map(m => ({ id: `${id}:${m.id}`, name: m.name, quantity: m.quantity, unit: m.unit, source: batchSource(n), holder: 'SUPPLIER' })) };
}
export function createUnshadowedState(): UnshadowedState { return { formulaKnown: false, batches: UNSHADOWED_BATCH_IDS.map((_, i) => freshBatch(i + 1, null)), bottles: [], resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, priestOfLightActingAtPromotion: null, ritual: createUnshadowedRitualState(), life: createUnshadowedLifeState(), encounter: createUnshadowedEncounterState() }; }
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isUnshadowed = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 4;
const hasUnshadowedHistory = (s:SliceState) => isUnshadowed(s)||(s.progression.pathwayId==='sun'&&(s.progression.sequence===3||s.progression.sequence===2));
const isPriestOfLight = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.bard.discovered && s.bard.guidanceKnown && s.lightprayer.guidanceKnown && s.sunpriest.formulaKnown && s.notary.formulaKnown && s.priestOfLight.formulaKnown && s.priestOfLight.promotionWeek !== null && (isPriestOfLight(s) || hasUnshadowedHistory(s));
const numberOf = (b: { id: string }) => Number(b.id.slice('unshadowed-batch-'.length));
const batchPrice = (b: UnshadowedBatch) => UNSHADOWED_PRICES.mainMaterials + UNSHADOWED_PRICES.auxiliaryMaterials - (b.labourSteps === UNSHADOWED_LABOUR_STEPS ? UNSHADOWED_PRICES.labourCredit : 0);
const priestOfLightWeeks = (s: SliceState) => Math.max(0, (s.unshadowed.promotionWeek ?? s.week) - (s.priestOfLight.promotionWeek ?? s.week));
/** Exhaustion includes raw successes whose actual ritual was explicitly aborted. */
const exhaustedSupply = (m: UnshadowedState) => m.promotionWeek === null && m.ritual.activeVisitId === null && m.batches.length >= 3 && m.batches.every(batch => batch.brewed && m.bottles.some(b => b.batchId === batch.id && b.status === 'CONSUMED'));
function actualBatch(b: UnshadowedBatch): boolean {
  return b.materials.length === 6 && b.materials.every((m, i) => { const f = UNSHADOWED_FORMULA[i]!; return m.id === `${b.id}:${f.id}` && m.name === f.name && m.unit === f.unit && m.source === batchSource(numberOf(b)) && m.quantity === (b.brewed ? 0 : f.quantity) && m.holder === (b.brewed ? 'CONSUMED' : b.acquired ? 'PLAYER' : 'SUPPLIER'); });
}
export function unshadowedAcquisitionBlock(s: SliceState, command: UnshadowedAcquisitionCommand): string | null {
  const m = s.unshadowed, ap = ['LEARN_FORMULA', 'POTION_WORK', 'BREW', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '本人须仍活着且能够行动。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (priestOfLightInside(s) || notaryInside(s) || hasUnshadowedLifeLock(s) || hasUnshadowedEncounterLock(s)) return '先实际结束旧现场、停止效果并回到原处。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须本人实际返回贝克兰德的原渠道。';
  if (!knownChannel(s)) return '先成为光之祭司并保有原米瑞尔的长期指导渠道。';
  if (hasUnshadowedHistory(s)) return '已经实际完成无暗者晋升；未用六料或原瓶保留，不能重复服药。';
  if (hasUnshadowedRitualLock(s) && command.type !== 'CONSUME') return '仍在本次原情感仪式厅，须实际回输并退出后再筹备。';
  if (command.type === 'LEARN_FORMULA') return m.formulaKnown ? '已经了解完整六料方案、已知神血替代及仪式风险。' : s.cash < 520 ? '本次指导需要520便士。' : null;
  if (!m.formulaKnown) return '先了解无暗者完整配方与真实情感仪式。';
  if (command.type === 'REQUEST_SUPPLY') return m.resupply.requestedWeek !== null ? '已经申请，须等下一真实周。' : exhaustedSupply(m) ? null : '全部现有六料须已调配且原瓶已耗，本场已实际退出且尚未晋升，才能申请后三批。';
  if (command.type === 'RECEIVE_SUPPLY') return m.resupply.requestedWeek === null ? '尚未申请后三批原材料。' : s.week <= m.resupply.requestedWeek ? '须等下一真实周原材料实际到货。' : exhaustedSupply(m) ? null : '旧原批与本场尚未结清，不能补货。';
  if (command.type === 'CONSUME') {
    const b = m.bottles.find(b => b.id === command.bottleId);
    if (command.confirmed !== true) return '声明情感及分离的确认不等于饮药，须独立确认原瓶。';
    if (!b || b.status !== 'PREPARED') return '所选真实原瓶未调配或已耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20、精神>40，可以先实际回输并退出休养。';
    if (s.progression.acting !== 100) return `光之祭司须消化100，当前${s.progression.acting}/100。`;
    if (priestOfLightWeeks(s) < UNSHADOWED_MIN_PRIEST_OF_LIGHT_WEEKS) return `光之祭司晋升后仅${priestOfLightWeeks(s)}/12整周。`;
    return canConsumeUnshadowedRitual(s) ? null : '须原声明情感本周实际分离在本次同一原载体内，原导师、专业者与原包当前真实可用。';
  }
  const b = m.batches.find(b => b.id === command.batchId);
  if (!b) return '该原批材料不存在。';
  if (!actualBatch(b)) return '同一原批六项实际名称、数量、来源或持有人不符，不能以替代或虚构库存继续。';
  if (command.type === 'BREW') return !b.acquired ? '先实际取得本批六项原材料。' : b.brewed ? '本批材料已全部耗尽，不能重复调配。' : s.cash < 100 ? '原调配服务需要100便士。' : null;
  if (b.acquired || b.brewed) return '本批已经实际交付，不能重复购买或追溯劳动抵扣。';
  if (command.type === 'POTION_WORK') return b.labourSteps >= 5 ? '本批五次实际工作已完成。' : null;
  return s.cash < batchPrice(b) ? `本批六料需要${batchPrice(b)}便士。` : null;
}
export function applyUnshadowedAcquisition(s: SliceState, command: UnshadowedAcquisitionCommand, c: SeerContext): void {
  rule(validateUnshadowedAcquisitionCommand(command), '无暗者筹备命令无效。');
  const blocked = unshadowedAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法筹备。');
  const m = s.unshadowed;
  switch (command.type) {
    case 'LEARN_FORMULA': s.actionsRemaining--; s.cash -= 520; m.formulaKnown = true; c.note('学习无暗者完整材料方案与仪式', `1行动520便士。${UNSHADOWED_FORMULA_SOURCE}${UNSHADOWED_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': { const b = m.batches.find(b => b.id === command.batchId)!; s.actionsRemaining--; b.labourSteps++; c.note(UNSHADOWED_LABOUR_TASKS[b.labourSteps - 1]!, `1行动，为原${b.id}完成第${b.labourSteps}/5次实际工作；五次只抵本批5700便士，六料仍需900便士，不跨批转移或折现。`); return; }
    case 'BUY_MATERIALS': { const b = m.batches.find(b => b.id === command.batchId)!, price = batchPrice(b); s.cash -= price; b.acquired = true; b.acquiredWeek = s.week; for (const item of b.materials) item.holder = 'PLAYER'; c.note('同一原批六项材料实际交付', `0行动支付${price}便士，实际取得${b.id}：${b.materials.map(v => `${v.name}${v.quantity}${v.unit}`).join('、')}。没有额外太阳神血液，没有附送成品原瓶。`); return; }
    case 'BREW': { const b = m.batches.find(b => b.id === command.batchId)!; s.actionsRemaining--; s.cash -= 100; const inputIds = b.materials.map(v => v.id); for (const item of b.materials) { item.quantity = 0; item.holder = 'CONSUMED'; } b.brewed = true; m.bottles.push({ id: `${b.id}:bottle`, batchId: b.id, inputIds, brewedWeek: s.week, status: 'PREPARED', outcome: null, consumedWeek: null, ritualId: null }); c.note('六项同批原材料实际调配成一原瓶', `1行动100便士，按本作G导师规程耗尽${b.id}六项原用量，仅得到同批${b.id}:bottle。无额外材料或已核投料顺序主张；尚未饮药或分离情感。`); return; }
    case 'REQUEST_SUPPLY': s.actionsRemaining--; m.resupply.requestedWeek = s.week; c.note('申请后三批独立六料', `1行动，旧三批原料和原瓶均已耗尽、各场实际退出，最早第${s.week + 1}周实际到货。失败或明确放弃后的原瓶不会复原。`); return;
    case 'RECEIVE_SUPPLY': { const start = m.batches.length + 1; for (let i = 0; i < 3; i++) m.batches.push(freshBatch(start + i, s.week)); m.resupply.deliveries++; m.resupply.requestedWeek = null; c.note('后三批原材料实际到供应方', `0行动，第${start}至${start + 2}批六料真实入库，每批仍需独立劳动或支付原价、另行实际调配；旧瓶与原情感回输历史全部保留。`); return; }
    case 'CONSUME': {
      const b = m.bottles.find(b => b.id === command.bottleId)!, v = currentUnshadowedVisit(s)!, result = c.check('will', 28), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
      b.status = 'CONSUMED'; b.outcome = result.tier; b.consumedWeek = s.week; b.ritualId = v.id;
      const healthCost = success ? 0 : result.tier === 'GREAT_FAILURE' ? 25 : 15, mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : result.tier === 'SUCCESS' ? 15 : result.tier === 'GREAT_FAILURE' ? 45 : 25;
      s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); if (!success) s.seer.pollution = Math.min(100, s.seer.pollution + (result.tier === 'GREAT_FAILURE' ? 60 : 30));
      recordUnshadowedRitualDrink(s, b.id);
      c.note(success ? '原瓶药效成功，原情感仍离身且尚未晋升' : '原瓶排异失败，原情感仍须实际回输', `0行动、意志${result.roll}/${result.chance}，原始药效${result.tier}；原${b.id}与${v.kit.id}耗尽，健康−${healthCost}、精神−${mindCost}。仍为序列5、旧扮演100和旧掌握不变，同一原${v.vessel.id}仍盛有原${v.anchor!.id}。${success ? '须当前原人员实际把同一原情感回输才能晋4；若选择放弃并回输退出则仍5。' : '回输只恢复这份原情感，不使失败晋升、不治疗或退还费用。'}`); return;
    }
  }
}
/** Sole promotion boundary: actual return of the original declared emotion, never the raw bottle roll. */
function finalizePromotion(s: SliceState, c: SeerContext): void {
  const m = s.unshadowed, v = currentUnshadowedVisit(s);
  if (!v || v.phase !== 'RETURNED' || v.finishedSuccess || v.rawOutcome !== 'SUCCESS' && v.rawOutcome !== 'GREAT_SUCCESS') return;
  rule(isPriestOfLight(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.progression.acting === 100 && m.promotionWeek === null && v.anchor?.location === 'RETURNED' && v.anchor.felt && v.anchor.returnedFromVesselId === v.vessel.id && v.anchor.returnedWeek === s.week && v.vessel.status === 'EMPTY' && v.vessel.anchorId === null && v.vessel.returnedWeek === s.week && v.kit.status === 'CONSUMED' && v.abortedReason === null, '须本场成功药效后真实回输同一原载体内的原情感才能晋升。');
  v.finishedSuccess = true; m.promotionWeek = s.week; m.priestOfLightActingAtPromotion = s.progression.acting; s.progression.sequence = 4; s.progression.acting = 0;
  for (const id of UNSHADOWED_ABILITY_IDS) s.progression.mastery[id] = 0;
  for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
  c.note('原情感实际回输，完成无暗者晋升', `本次${v.id}原始药效${v.rawOutcome}，同一${v.anchor.id}已从同一${v.vessel.id}回到本人，才在本周晋升序列4。原导师、记忆与人性保留；四属性各+1、三项新掌握0、扮演0，旧五阶全部掌握及光之祭司消化100保留。灵性上限120但当前不补满、身体性别不变。仍在原厅，须实际走出。`);
}
export function applyUnshadowedCommand(s: SliceState, command: UnshadowedCommand, c: SeerContext): void {
  rule(validateUnshadowedCommand(command), '无暗者命令无效。');
  if (validateUnshadowedAcquisitionCommand(command)) return applyUnshadowedAcquisition(s, command, c);
  if (validateUnshadowedRitualCommand(command)) { rule(!hasUnshadowedLifeLock(s) && !hasUnshadowedEncounterLock(s), '先实际结束当前原实践或相遇。'); applyUnshadowedRitualCommand(s, command, c); finalizePromotion(s, c); return; }
  if (validateUnshadowedEncounterCommand(command)) return applyUnshadowedEncounter(s, command, c);
  throw new Error('无暗者生活实践须由共享入口结算实际掌握与消化。');
}
export function projectUnshadowed(s: SliceState): UnshadowedProjection {
  const m = s.unshadowed, available = knownChannel(s), known = available && m.formulaKnown, promoted = hasUnshadowedHistory(s), actions: UnshadowedAction[] = [];
  const add = (id: string, label: string, cost: string, command: UnshadowedAcquisitionCommand) => { const reason = unshadowedAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!known) add('learn-unshadowed-formula', '学习无暗者完整六料方案与情感仪式', '1行动 · 520便士', { type: 'LEARN_FORMULA' });
    else {
      if (m.resupply.requestedWeek !== null) add('receive-unshadowed-supply', '接收后三批实际到货的六料', `0行动 · 最早第${m.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(m)) add('request-unshadowed-supply', '申请后三批独立六料', '1行动 · 下一真实周实到', { type: 'REQUEST_SUPPLY' });
      for (const b of m.batches) {
        if (!b.acquired) { if (b.labourSteps < 5) add(`work-${b.id}`, `第${numberOf(b)}批 · ${UNSHADOWED_LABOUR_TASKS[b.labourSteps]}`, `1行动 · 劳动${b.labourSteps}/5`, { type: 'POTION_WORK', batchId: b.id }); add(`buy-${b.id}`, `实际领取第${numberOf(b)}批完整六料`, `0行动 · ${batchPrice(b)}便士`, { type: 'BUY_MATERIALS', batchId: b.id }); }
        else if (!b.brewed) add(`brew-${b.id}`, `以第${numberOf(b)}批同一六料实际调配一原瓶`, '1行动 · 100便士 · 耗尽六料', { type: 'BREW', batchId: b.id });
      }
      for (const b of m.bottles) if (b.status === 'PREPARED') add(`consume-${b.id}`, `独立确认在原情感分离期间饮用第${numberOf({ id: b.batchId })}原瓶`, `0行动 · 光之祭司${s.progression.acting}/100 · ${priestOfLightWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return { title: promoted ? '无暗者 · 序列4' : '无暗者之路', discovered: available, formulaKnown: known, promoted, formula: known ? UNSHADOWED_FORMULA.map(m => ({ name: m.name, quantity: m.quantity, unit: m.unit })) : [],
    actions: available && ![3, 2].includes(s.progression.sequence ?? 0) ? [...actions, ...unshadowedRitualActions(s), ...unshadowedLifeActions(s), ...unshadowedEncounterActions(s)] : [],
    batches: known ? m.batches.map(b => ({ id: b.id, title: `第${numberOf(b)}批 · 原六料`, status: b.brewed ? '六项原用量已全部耗尽' : b.acquired ? '六项原材料由你实际持有' : '六项原材料仍在供应方', labourSteps: b.labourSteps, materials: structuredClone(b.materials) })) : [],
    bottles: known ? m.bottles.map(b => { const v = m.ritual.visits.find(v => v.id === b.ritualId); return { id: b.id, title: `第${numberOf({ id: b.batchId })}批 · 无暗者原瓶`, source: `第${b.brewedWeek}周在原调配室由同一${b.batchId}六项原材料实际调配，原瓶${b.id}。${v ? `第${b.consumedWeek}周在原${v.siteId}/${v.id}实际饮用。` : ''}`, status: b.status === 'PREPARED' ? '你实际持有，未饮用' : `原瓶已耗 · 原始药效${b.outcome} · ${v?.finishedSuccess ? '原情感真实回输后已晋升' : v?.phase === 'DRUNK' ? '原情感仍离身，尚未晋升' : '本次未完成晋升'}`, chance, command: { type: 'CONSUME' as const, bottleId: b.id, confirmed: true as const } }; }) : [],
    abilities: promoted ? UNSHADOWED_ABILITIES.filter(a => Object.hasOwn(s.progression.mastery, a.id)).map(a => ({ ...a, mastery: s.progression.mastery[a.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.justiceMentor.unshadowedActingAtPromotion??100:s.progression.acting) : 0, digestion: promoted ? `光之祭司消化${m.priestOfLightActingAtPromotion}/100与旧掌握保留；无暗者扮演${(s.progression.sequence===3||s.progression.sequence===2)?s.justiceMentor.unshadowedActingAtPromotion:s.progression.acting}/100。` : available ? `光之祭司需消化100（当前${s.progression.acting}/100），满12整周（${priestOfLightWeeks(s)}/12）；原瓶药效成功后还须实际回输原情感。` : '先完成光之祭司之路。',
    pollution: s.seer.pollution, risk: known ? UNSHADOWED_CONSUMPTION_RISK : '先经原米瑞尔了解本阶材料与仪式风险。', supplies: known ? `供应方剩余${m.batches.filter(b => !b.acquired).length}批实际六料，你有${m.bottles.filter(b => b.status === 'PREPARED').length}未用原瓶；后续已实到${m.resupply.deliveries}轮，每轮3批。${m.resupply.requestedWeek === null ? '' : `第${m.resupply.requestedWeek}周申请，下一真实周起实到。`}只供应尾羽与神圣光辉石方案；太阳神血液替代已知但当前不可获得。` : '',
    ...(available ? { story: UNSHADOWED_FORMULA_SOURCE + UNSHADOWED_RITUAL_SOURCE + UNSHADOWED_SOURCE_STATUS } : {}), ritual: projectUnshadowedRitual(s), life: projectUnshadowedLife(s), encounter: projectUnshadowedEncounter(s), insideCase: hasUnshadowedRitualLock(s) || hasUnshadowedLifeLock(s) || hasUnshadowedEncounterLock(s), environment: available ? '原米瑞尔的旧指导与旧案、原灯与灵体、原不融冰全部保留；新持照原仪式厅与有限原练习场各用真实原物，没有免费原物复制或实体无暗墙。' : '' };
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateUnshadowedAcquisitionCommand(v: unknown): v is UnshadowedAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_FORMULA', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (['POTION_WORK', 'BUY_MATERIALS', 'BREW'].includes(String(v.type))) return shape(v, ['type', 'batchId']) && typeof v.batchId === 'string' && /^unshadowed-batch-[1-9]\d{0,14}$/.test(v.batchId);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && typeof v.bottleId === 'string' && /^unshadowed-batch-[1-9]\d{0,14}:bottle$/.test(v.bottleId) && v.confirmed === true;
}
export const isUnshadowedAcquisitionCommand = validateUnshadowedAcquisitionCommand;
export function validateUnshadowedCommand(v: unknown): v is UnshadowedCommand { return validateUnshadowedAcquisitionCommand(v) || validateUnshadowedRitualCommand(v) || validateUnshadowedActivityCommand(v) || validateUnshadowedEncounterCommand(v); }
export function validateUnshadowedState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.unshadowed;
  if (!record(raw) || !shape(raw, ['formulaKnown', 'batches', 'bottles', 'resupply', 'promotionWeek', 'priestOfLightActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.formulaKnown !== 'boolean' || !record(s.progression) || !record(s.progression.mastery) || !record(s.priestOfLight)) return false;
  const first = s.priestOfLight.promotionWeek ?? s.week, earliest = first + 12;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliest)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliest, s.week) || !Array.isArray(raw.batches) || raw.batches.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length) return false;
  const m = raw as unknown as UnshadowedState, promoted = hasUnshadowedHistory(s), latest = m.promotionWeek ?? s.week;
  if (m.formulaKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!m.formulaKnown || !integer(m.promotionWeek, earliest, s.week) || m.priestOfLightActingAtPromotion !== 100 || !shape(s.progression.mastery, [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS, ...PRIEST_OF_LIGHT_ABILITY_IDS, ...UNSHADOWED_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?JUSTICE_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?LIGHT_SEEKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(n => integer(n, 0, 500))) return false;
  } else if (m.promotionWeek !== null || m.priestOfLightActingAtPromotion !== null || UNSHADOWED_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [i, batch] of m.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'stockedWeek', 'labourSteps', 'acquired', 'acquiredWeek', 'brewed']) || batch.id !== `unshadowed-batch-${i + 1}` || !integer(batch.labourSteps, 0, 5) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== 6 || batch.materials.some(material => !record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder'])) || !actualBatch(batch)) return false;
    if (batch.brewed && !batch.acquired || !m.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    if (i < 3) { if (batch.stockedWeek !== null) return false; }
    else {
      if (!m.formulaKnown || !integer(batch.stockedWeek, earliest + 1, latest)) return false;
      const start = Math.floor(i / 3) * 3;
      if (batch.stockedWeek !== m.batches[start]!.stockedWeek || m.batches.slice(0, start).some(old => !old.brewed || !m.bottles.some(b => b.batchId === old.id && b.status === 'CONSUMED' && integer(b.consumedWeek, earliest, batch.stockedWeek! - 1) && m.ritual.visits.some(v => v.id === b.ritualId && !v.finishedSuccess && integer(v.closedWeek, b.consumedWeek!, batch.stockedWeek! - 1))))) return false;
    }
    if (batch.acquired ? !integer(batch.acquiredWeek, batch.stockedWeek ?? first, latest) : batch.acquiredWeek !== null) return false;
    if (m.bottles.filter(b => b.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  }
  const used = new Set<string>();
  for (const b of m.bottles) {
    if (!record(b) || !shape(b, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome', 'consumedWeek', 'ritualId']) || !Array.isArray(b.inputIds)) return false;
    const batch = m.batches.find(batch => batch.id === b.batchId);
    if (!batch || !batch.brewed || b.id !== `${batch.id}:bottle` || !integer(b.brewedWeek, batch.acquiredWeek!, latest) || b.inputIds.length !== 6 || b.inputIds.some((id, i) => id !== batch.materials[i]!.id)) return false;
    if (b.status === 'PREPARED') { if (b.outcome !== null || b.consumedWeek !== null || b.ritualId !== null) return false; }
    else if (b.status === 'CONSUMED') {
      if (!integer(b.consumedWeek, Math.max(earliest, b.brewedWeek), latest) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !promoted && s.progression.acting !== 100 || typeof b.ritualId !== 'string' || used.has(b.ritualId)) return false;
      used.add(b.ritualId); const v = m.ritual.visits.find(v => v.id === b.ritualId); if (!v || v.pendingBottleId !== b.id || v.rawOutcome !== b.outcome || v.consumedWeek !== b.consumedWeek) return false;
    } else return false;
  }
  if (m.resupply.requestedWeek !== null && (!m.formulaKnown || promoted || !exhaustedSupply(m) || m.bottles.some(b => b.consumedWeek! > m.resupply.requestedWeek!) || m.ritual.visits.some(v => v.closedWeek! > m.resupply.requestedWeek!))) return false;
  return validateUnshadowedRitualState(s) && validateUnshadowedLife(s) && validateUnshadowedEncounter(s);
}
export const validUnshadowedState = validateUnshadowedState;
export const validUnshadowedCommand = validateUnshadowedCommand;
export { UNSHADOWED_ABILITIES } from './content.js';
export { createUnshadowedRitualState, currentUnshadowedVisit, hasUnshadowedRitualLock, canConsumeUnshadowedRitual, validateUnshadowedRitualState, validateUnshadowedRitualCommand, applyUnshadowedRitualCommand, unshadowedRitualActions, projectUnshadowedRitual } from './ritual.js';
export { applyUnshadowedActivity } from './life.js';
export type * from './types.js';
