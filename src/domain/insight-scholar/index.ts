import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import { POLYMATH_ABILITY_IDS } from '../polymath/types.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS } from '../mysticism-magister/types.js';
import { PROPHET_ABILITY_IDS } from '../prophet/types.js';
import { applyProphetInheritedFlash, blockProphetInheritedFlash } from '../mysticism-magister/life.js';
import { hasProphetRitualLock } from '../prophet/ritual.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasProphetEncounterLock } from '../prophet/encounter.js';
import { createInsightScholarLifeState, applyInsightScholarActivity, projectInsightScholarLife, insightScholarLifeActions, validateInsightScholarLife, validateInsightScholarActivityCommand, hasInsightScholarLifeLock } from './life.js';
import { createInsightScholarEncounterState, applyInsightScholarEncounterCommand, projectInsightScholarEncounter, insightScholarEncounterActions, validateInsightScholarEncounter, validateInsightScholarEncounterCommand, hasInsightScholarEncounterLock } from './encounter.js';
import { INSIGHT_SCHOLAR_ABILITIES, INSIGHT_SCHOLAR_BOTTLE_IDS, INSIGHT_SCHOLAR_CONSUMPTION_RISK, INSIGHT_SCHOLAR_FORMULA_STATUS, INSIGHT_SCHOLAR_GUIDE, INSIGHT_SCHOLAR_LABOUR_STEPS, INSIGHT_SCHOLAR_LABOUR_TASKS, INSIGHT_SCHOLAR_MIN_PROPHET_WEEKS, INSIGHT_SCHOLAR_POTION_SOURCES, INSIGHT_SCHOLAR_PREPARATIONS, INSIGHT_SCHOLAR_PRICES, INSIGHT_SCHOLAR_SOURCE_STATUS } from './content.js';
import { INSIGHT_SCHOLAR_ABILITY_IDS, INSIGHT_SCHOLAR_PREPARATION_IDS, type InsightScholarAcquisitionCommand, type InsightScholarAction, type InsightScholarBottle, type InsightScholarCommand, type InsightScholarProjection, type InsightScholarState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): InsightScholarBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createInsightScholarState(): InsightScholarState {
  return { guidanceKnown: false, bottles: INSIGHT_SCHOLAR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, prophetActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createInsightScholarLifeState(), encounter: createInsightScholarEncounterState() };
}
export const isInsightScholar = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 3;
export const hasInsightScholarHistory = (s: SliceState) => s.progression.pathwayId === 'white-tower' && [3, 2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'white-tower' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.reader.discovered && s.prophet.guidanceKnown && s.prophet.promotionWeek !== null;
export const hasInsightScholarLock = (s: SliceState): boolean => s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s);
const bottleNumber = (b: Pick<InsightScholarBottle, 'id'>) => Number(b.id.slice('insight-scholar-potion-'.length));
const potionPrice = (b: InsightScholarBottle) => INSIGHT_SCHOLAR_PRICES.potion - (b.labourSteps === INSIGHT_SCHOLAR_LABOUR_STEPS ? INSIGHT_SCHOLAR_PRICES.labourCredit : 0);
const prophetWeeks = (s: SliceState) => Math.max(0, (s.insightScholar.promotionWeek ?? s.week) - (s.prophet.promotionWeek ?? s.week));
const exhaustedSupply = (state: InsightScholarState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${INSIGHT_SCHOLAR_GUIDE}介绍的独立洞悉者候选成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3候选原瓶insight-scholar-potion-${number}；非预言家或更早原瓶改装。候选名称、能力、配方和原著仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => INSIGHT_SCHOLAR_PREPARATION_IDS.every(id => s.insightScholar.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `预言家魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.prophet.promotionWeek === null || prophetWeeks(s) < INSIGHT_SCHOLAR_MIN_PROPHET_WEEKS) return `成为预言家后已过${prophetWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成原记录核对、已见方法比较与普通退出演练；购买原瓶不能代做专业准备。';
}
export function validateInsightScholarAcquisitionCommand(v: unknown): v is InsightScholarAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && INSIGHT_SCHOLAR_PREPARATION_IDS.includes(v.taskId as typeof INSIGHT_SCHOLAR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^insight-scholar-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isInsightScholarAcquisitionCommand = validateInsightScholarAcquisitionCommand;
export function validateInsightScholarCommand(v: unknown): v is InsightScholarCommand {
  return record(v) && v.type === 'MAKE_INHERITED_FLASH' && shape(v, ['type']) || validateInsightScholarAcquisitionCommand(v) || validateInsightScholarActivityCommand(v) || validateInsightScholarEncounterCommand(v);
}
export function insightScholarAcquisitionBlock(s: SliceState, command: InsightScholarAcquisitionCommand): string | null {
  if (!validateInsightScholarAcquisitionCommand(command)) return '洞悉者候选准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s) ||
      Object.values(s.prophet.life.cases).some(v => v.status === 'PREPARED') || s.prophet.life.pages.location !== 'TABLE' ||
      Object.values(s.mysticismMagister.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen ||
      Object.values(s.polymath.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s)) return '先实际收束旧预言家准备室、有限片段与原物现场，并归还旧秘术导师的同一原衣角；不能沿用旧同意或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原会馆旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为预言家并保留原指导渠道后，才能了解洞悉者候选之路。';
  if (hasInsightScholarHistory(s)) return '已经真实晋升洞悉者候选3，不能重复准备或服药；未服原瓶保留。';
  const state = s.insightScholar;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < INSIGHT_SCHOLAR_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的洞悉者候选原瓶。';
    return s.cash < INSIGHT_SCHOLAR_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批洞悉者候选原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的洞悉者候选准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选洞悉者候选独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= INSIGHT_SCHOLAR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyInsightScholarAcquisition(s: SliceState, command: InsightScholarAcquisitionCommand, ctx: SeerContext): void {
  const reason = insightScholarAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.insightScholar;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= INSIGHT_SCHOLAR_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取洞悉者候选独立成品与专业准备指导', `花1行动、500便士。${INSIGHT_SCHOLAR_GUIDE}说明原渠道记录。${INSIGHT_SCHOLAR_FORMULA_STATUS}${INSIGHT_SCHOLAR_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = INSIGHT_SCHOLAR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= INSIGHT_SCHOLAR_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(INSIGHT_SCHOLAR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('洞悉者候选独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠证据、任意弱点、技能、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批洞悉者候选成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < INSIGHT_SCHOLAR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`insight-scholar-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶洞悉者候选原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.prophetActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of INSIGHT_SCHOLAR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为洞悉者候选', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；预言家消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；原FLASH/FROST/COURAGE样本和微光片保留，原哈罗德已有伤势与原棍去向、诺拉等原人及原物不变；晋升不创建证据或新技能库。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '洞悉者候选魔药严重排异' : '洞悉者候选魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为预言家，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function insightScholarInheritedFlashBlock(s: SliceState): string | null {
  if (!isInsightScholar(s)) return '须已实际成为阅读者序列3候选，才能从本页延用旧制作入口。';
  if (hasInsightScholarLock(s) || hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s)) return '先实际离开当前原物现场、准备室或遭遇，再到旧工作台付费制作。';
  return blockProphetInheritedFlash(s);
}
export function applyInsightScholarCommand(s: SliceState, command: InsightScholarCommand, ctx: SeerContext): void {
  if (!validateInsightScholarCommand(command)) throw new Error('洞悉者候选命令无效。');
  if (command.type === 'MAKE_INHERITED_FLASH') { const reason = insightScholarInheritedFlashBlock(s); if (reason) throw new Error(reason); return applyProphetInheritedFlash(s, ctx); }
  if (validateInsightScholarAcquisitionCommand(command)) return applyInsightScholarAcquisition(s, command, ctx);
  if (validateInsightScholarActivityCommand(command)) return applyInsightScholarActivity(s, command, ctx);
  if (validateInsightScholarEncounterCommand(command)) return applyInsightScholarEncounterCommand(s, command, ctx);
  throw new Error('未知洞悉者候选命令。');
}

export function projectInsightScholar(s: SliceState): InsightScholarProjection {
  const state = s.insightScholar, available = knownChannel(s), promoted = hasInsightScholarHistory(s), actions: InsightScholarAction[] = [];
  const acting = promoted ? (s.progression.sequence === 2 ? s.wisdomAngel.insightScholarActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: InsightScholarAcquisitionCommand) => { const reason = insightScholarAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-insight-scholar-guidance', '听取洞悉者候选成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of INSIGHT_SCHOLAR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`insight-scholar-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-insight-scholar-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-insight-scholar-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-insight-scholar-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-insight-scholar-supply', '申请下一批独立洞悉者候选成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${INSIGHT_SCHOLAR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶洞悉者候选魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 预言家消化${s.progression.acting}/100 · ${prophetWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  if (isInsightScholar(s)) {
    const reason = insightScholarInheritedFlashBlock(s);
    actions.push({ id: 'insight-scholar-inherited-flash', label: '沿旧工艺另买原材料尝试一枚微光片', cost: '1行动 · 160便士 · 4灵性 · 知识16 · 每真实周一次', command: { type: 'MAKE_INHERITED_FLASH' }, enabled: reason === null, reason });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '洞悉者·阅读者序列3候选（G扩展）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${INSIGHT_SCHOLAR_FORMULA_STATUS}${INSIGHT_SCHOLAR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...insightScholarLifeActions(s), ...insightScholarEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 洞悉者候选成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为预言家' : '排异，仍为预言家'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? INSIGHT_SCHOLAR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? INSIGHT_SCHOLAR_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `预言家消化${state.prophetActingAtPromotion}/100留存；洞悉者候选扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `预言家需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${prophetWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完预言家之路。',
    pollution: s.seer.pollution, risk: available ? INSIGHT_SCHOLAR_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `预言家第${s.prophet.promotionWeek}周真实晋升；${promoted ? `原消化${state.prophetActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '阅读者至预言家的全部原ID、掌握、原瓶、旧仪式与原实践保留；本次不改变身体性别，不把候选名称与原创G能力冒充已核实原著。旧预言仍是需要解释的有限片段。',
      ...(['FLASH', 'FROST', 'COURAGE'] as const).map(id => { const sample = s.polymath.samples[id]; return `原博学者样本${id}：观察周${sample.observedWeek ?? '无'}、理解周${sample.understoodWeek ?? '无'}、实际学会周${sample.learnedWeek ?? '尚未'}；不随候选晋升免费解锁。`; }),
      ...s.mysticismMagister.crafts.map(craft => `原微光片${craft.id}：来自${craft.sourceKitId}、第${craft.createdWeek}周实际制造，当前${craft.status}、实用周${craft.usedWeek ?? '尚未'}、原效力${craft.power}；不补片、不改ID或来源。`),
      `原窗${s.prophet.life.shutter.id}销仍为${s.prophet.life.shutter.pin}，原页${s.prophet.life.pages.id}仍在${s.prophet.life.pages.location}；原包${s.prophet.life.parcel.id}仍在${s.prophet.life.parcel.location}，原钳${s.prophet.life.pliers.id}仍归${s.prophet.life.pliers.location}。`,
      ...(s.prophet.encounter.approachWeek === null ? [] : [`原哈罗德PF4-HAROLD：健康${s.prophet.encounter.enemy.health}/100、精神${s.prophet.encounter.enemy.mind}/100；${s.prophet.encounter.enemy.status === 'DEAD' ? '已死亡，不会复活' : s.prophet.encounter.enemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : '仍为独立原人'}。原棍${s.prophet.encounter.enemy.weaponId}${s.prophet.encounter.enemy.weaponLocation === 'HAND' ? '仍在他手中' : '仍在原院地面'}，不因新晋升复原。`]),
      ...(['PF4-NORA', 'PF4-EDWIN', 'PF4-JONAS'] as const).map(id => s.prophet.life.people[id]).map(person => `原${person.name}${person.id}：${person.alive ? '仍活着' : '已经死亡'}、仍在${person.location}，当面访谈周${person.metWeek ?? '尚未'}、实际请求周${person.askedWeek ?? '尚未'}；旧答复与原身体不复制。`),
      `原专业人员${s.prophet.ritual.expert.id}${s.prophet.ritual.expert.alive ? '仍活着' : '已经死亡'}；序列4原封装包及已消耗记录保留，不改装为序列3准备。`,
    ] : [],
    life: projectInsightScholarLife(s), encounter: projectInsightScholarEncounter(s), insideCase: hasInsightScholarLock(s),
    environment: available ? '原创G原档案室IS3-ARCHIVE：42岁校档员IS3-FENNA芬娜持有自己的真实原件，51岁记录员IS3-OSRIC奥斯里克须本人在场自愿才演示原匣。入口EXIT到原桌DESK为2米、到校验台BENCH为3米、到转角JUNCTION为2米，旁路另6米到STORE。原封栏保持CLOSED；能力不创造证据、开栏、移动原物或读取未知包裹。本人沿真实普通路线往返与退出，所有名称、场景、距离和数值均为G候选扩展。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateInsightScholarState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.insightScholar;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'prophetActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as InsightScholarState, promoted = hasInsightScholarHistory(s), firstWeek = s.prophet.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + INSIGHT_SCHOLAR_MIN_PROPHET_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !INSIGHT_SCHOLAR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.prophet.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.prophetActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS, ...PROPHET_ABILITY_IDS, ...INSIGHT_SCHOLAR_ABILITY_IDS, ...(s.progression.sequence === 2 ? WISDOM_ANGEL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.prophetActingAtPromotion !== null || INSIGHT_SCHOLAR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `insight-scholar-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== INSIGHT_SCHOLAR_POTION_SOURCES[index]!.source) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, state.promotionWeek ?? s.week) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % 3;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek || state.bottles.slice(batchStart - 3, batchStart).some(previous => previous.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(previous.outcome ?? '') || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') { if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, state.promotionWeek ?? s.week)) return false;
      if (b.status === 'PLAYER') { if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false; }
      else if (b.status === 'CONSUMED') {
        if (!integer(s.prophet.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateInsightScholarLife(s) && validateInsightScholarEncounter(s);
}
export { INSIGHT_SCHOLAR_ABILITIES } from './content.js';
export { INSIGHT_SCHOLAR_ABILITY_IDS } from './types.js';
export type * from './types.js';
