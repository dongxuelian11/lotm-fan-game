import { ARCANE_SCHOLAR_ABILITY_IDS } from '../arcane-scholar/types.js';
import { hasArcaneScholarLock } from '../arcane-scholar/index.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import { APPRAISER_ABILITY_IDS } from '../appraiser/types.js';
import { ARTISAN_ABILITY_IDS } from '../artisan/types.js';
import { ASTRONOMER_ABILITY_IDS } from '../astronomer/types.js';
import { ALCHEMIST_ABILITY_IDS } from '../alchemist/types.js';
import { hasAlchemistRitualLock } from '../alchemist/ritual.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { hasAlchemistEncounterLock } from '../alchemist/encounter.js';
import { createKnowledgeMentorLifeState, applyKnowledgeMentorActivity, projectKnowledgeMentorLife, knowledgeMentorLifeActions, validateKnowledgeMentorLife, validateKnowledgeMentorActivityCommand, hasKnowledgeMentorLifeLock } from './life.js';
import { createKnowledgeMentorEncounterState, applyKnowledgeMentorEncounterCommand, projectKnowledgeMentorEncounter, knowledgeMentorEncounterActions, validateKnowledgeMentorEncounter, validateKnowledgeMentorEncounterCommand, hasKnowledgeMentorEncounterLock } from './encounter.js';
import { KNOWLEDGE_MENTOR_ABILITIES, KNOWLEDGE_MENTOR_BOTTLE_IDS, KNOWLEDGE_MENTOR_CONSUMPTION_RISK, KNOWLEDGE_MENTOR_FORMULA_STATUS, KNOWLEDGE_MENTOR_GUIDE, KNOWLEDGE_MENTOR_LABOUR_STEPS, KNOWLEDGE_MENTOR_LABOUR_TASKS, KNOWLEDGE_MENTOR_MIN_ARCANE_SCHOLAR_WEEKS, KNOWLEDGE_MENTOR_POTION_SOURCES, KNOWLEDGE_MENTOR_PREPARATIONS, KNOWLEDGE_MENTOR_PRICES, KNOWLEDGE_MENTOR_SOURCE_STATUS } from './content.js';
import { KNOWLEDGE_MENTOR_ABILITY_IDS, KNOWLEDGE_MENTOR_PREPARATION_IDS, type KnowledgeMentorAcquisitionCommand, type KnowledgeMentorAction, type KnowledgeMentorBottle, type KnowledgeMentorCommand, type KnowledgeMentorProjection, type KnowledgeMentorState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): KnowledgeMentorBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createKnowledgeMentorState(): KnowledgeMentorState {
  return { guidanceKnown: false, bottles: KNOWLEDGE_MENTOR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, arcaneScholarActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createKnowledgeMentorLifeState(), encounter: createKnowledgeMentorEncounterState() };
}
export const isKnowledgeMentor = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 2;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'paragon' && [3, 2].includes(s.progression.sequence ?? 0) && s.savant.discovered && s.arcaneScholar.guidanceKnown && s.arcaneScholar.promotionWeek !== null;
export const hasKnowledgeMentorLock = (s: SliceState): boolean => s.knowledgeMentor.preparedWeek !== null || hasKnowledgeMentorLifeLock(s) || hasKnowledgeMentorEncounterLock(s);
const bottleNumber = (b: Pick<KnowledgeMentorBottle, 'id'>) => Number(b.id.slice('knowledge-mentor-potion-'.length));
const potionPrice = (b: KnowledgeMentorBottle) => KNOWLEDGE_MENTOR_PRICES.potion - (b.labourSteps === KNOWLEDGE_MENTOR_LABOUR_STEPS ? KNOWLEDGE_MENTOR_PRICES.labourCredit : 0);
const arcaneScholarWeeks = (s: SliceState) => Math.max(0, (s.knowledgeMentor.promotionWeek ?? s.week) - (s.arcaneScholar.promotionWeek ?? s.week));
const exhaustedSupply = (state: KnowledgeMentorState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${KNOWLEDGE_MENTOR_GUIDE}的独立知识导师候选G成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶knowledge-mentor-potion-${number}；非奥秘学者或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => KNOWLEDGE_MENTOR_PREPARATION_IDS.every(id => s.knowledgeMentor.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `奥秘学者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.arcaneScholar.promotionWeek === null || arcaneScholarWeeks(s) < KNOWLEDGE_MENTOR_MIN_ARCANE_SCHOLAR_WEEKS) return `成为奥秘学者后已过${arcaneScholarWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成原记录查阅、原物与本人状态核对、中止返回演练；购买原瓶不能代做专业准备。';
}
export function validateKnowledgeMentorAcquisitionCommand(v: unknown): v is KnowledgeMentorAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && KNOWLEDGE_MENTOR_PREPARATION_IDS.includes(v.taskId as typeof KNOWLEDGE_MENTOR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^knowledge-mentor-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isKnowledgeMentorAcquisitionCommand = validateKnowledgeMentorAcquisitionCommand;
export function validateKnowledgeMentorCommand(v: unknown): v is KnowledgeMentorCommand {
  return validateKnowledgeMentorAcquisitionCommand(v) || validateKnowledgeMentorActivityCommand(v) || validateKnowledgeMentorEncounterCommand(v);
}
export function knowledgeMentorAcquisitionBlock(s: SliceState, command: KnowledgeMentorAcquisitionCommand): string | null {
  if (!validateKnowledgeMentorAcquisitionCommand(command)) return '知识导师候选G准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasArcaneScholarLock(s) || hasAlchemistRitualLock(s) || hasAlchemistLifeLock(s) || hasAlchemistEncounterLock(s) ||
      Object.values(s.alchemist.life.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.astronomer.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      s.alchemist.life.creations.some(v => v.active || v.location !== 'PLAYER') ||
      s.alchemist.life.parcel.custodian !== 'AL4-HELENA' || s.alchemist.life.parcel.location !== 'OWNER' ||
      s.alchemist.life.entrustedMaterial.custodian !== 'AL4-HELENA' || s.alchemist.life.entrustedMaterial.location !== 'OWNER' ||
      hasKnowledgeMentorLifeLock(s) || hasKnowledgeMentorEncounterLock(s)) return '先实际收束旧研究园、原造物、原受托物与现场接触；不能同时占用原场或沿用旧同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原指导室与原工作台。';
  if (!knownChannel(s)) return '实际成为奥秘学者并保留原指导渠道后，才能了解知识导师候选G之路。';
  if (isKnowledgeMentor(s)) return '已经真实晋升知识导师候选G2，不能重复准备或服药；未服原瓶保留。';
  const state = s.knowledgeMentor;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < KNOWLEDGE_MENTOR_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的知识导师候选G原瓶。';
    return s.cash < KNOWLEDGE_MENTOR_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批知识导师候选G原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的知识导师候选G准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选知识导师候选G独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= KNOWLEDGE_MENTOR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyKnowledgeMentorAcquisition(s: SliceState, command: KnowledgeMentorAcquisitionCommand, ctx: SeerContext): void {
  const reason = knowledgeMentorAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.knowledgeMentor;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= KNOWLEDGE_MENTOR_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取知识导师候选G独立成品与专业准备指导', `花1行动、500便士。${KNOWLEDGE_MENTOR_GUIDE}说明原渠道记录。${KNOWLEDGE_MENTOR_FORMULA_STATUS}${KNOWLEDGE_MENTOR_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = KNOWLEDGE_MENTOR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= KNOWLEDGE_MENTOR_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(KNOWLEDGE_MENTOR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('知识导师候选G独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠造物、储能、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批知识导师候选G成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < KNOWLEDGE_MENTOR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`knowledge-mentor-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶知识导师候选G原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.arcaneScholarActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of KNOWLEDGE_MENTOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为知识导师候选G', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；奥秘学者消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；原造物不充能或修复，旧园地死植、沙化与干涸保留，原奥斯里克不会复活。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '知识导师候选G魔药严重排异' : '知识导师候选G魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为奥秘学者，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyKnowledgeMentorCommand(s: SliceState, command: KnowledgeMentorCommand, ctx: SeerContext): void {
  if (!validateKnowledgeMentorCommand(command)) throw new Error('知识导师候选G命令无效。');
  if (validateKnowledgeMentorAcquisitionCommand(command)) return applyKnowledgeMentorAcquisition(s, command, ctx);
  if (validateKnowledgeMentorActivityCommand(command)) return applyKnowledgeMentorActivity(s, command, ctx);
  if (validateKnowledgeMentorEncounterCommand(command)) return applyKnowledgeMentorEncounterCommand(s, command, ctx);
  throw new Error('未知知识导师候选G命令。');
}

export function projectKnowledgeMentor(s: SliceState): KnowledgeMentorProjection {
  const state = s.knowledgeMentor, available = knownChannel(s), promoted = isKnowledgeMentor(s), actions: KnowledgeMentorAction[] = [];
  const add = (id: string, label: string, cost: string, command: KnowledgeMentorAcquisitionCommand) => { const reason = knowledgeMentorAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-knowledge-mentor-guidance', '听取知识导师候选G成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of KNOWLEDGE_MENTOR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`knowledge-mentor-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-knowledge-mentor-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-knowledge-mentor-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-knowledge-mentor-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-knowledge-mentor-supply', '申请下一批独立知识导师候选G成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${KNOWLEDGE_MENTOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶知识导师候选G魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 奥秘学者消化${s.progression.acting}/100 · ${arcaneScholarWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '知识导师（候选G） · 序列2' : '知识导师候选G之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${KNOWLEDGE_MENTOR_FORMULA_STATUS}${KNOWLEDGE_MENTOR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...knowledgeMentorLifeActions(s), ...knowledgeMentorEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 知识导师候选G成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为奥秘学者' : '排异，仍为奥秘学者'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? KNOWLEDGE_MENTOR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? KNOWLEDGE_MENTOR_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `奥秘学者消化${state.arcaneScholarActingAtPromotion}/100留存；知识导师候选G扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `奥秘学者需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${arcaneScholarWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完奥秘学者之路。',
    pollution: s.seer.pollution, risk: available ? KNOWLEDGE_MENTOR_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `奥秘学者第${s.arcaneScholar.promotionWeek}周真实晋升；${promoted ? `原消化${state.arcaneScholarActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '通识者至奥秘学者17项原ID与掌握、原记录和全部失败原瓶保留；本次不改变身体性别。',
      ...s.alchemist.ritual.plots.filter(p => p.drainedWeek !== null).map(p => `原园地${p.id}的死植、沙化原土和干涸原池保持实际状态，晋升不复绿。`),
      ...s.alchemist.life.creations.map(o => `唯一原件${o.id}：储能${o.charge}/3、耐久${o.durability}/100、所在${o.location}；资源只保存在原制造记录，不复制或暗补。`),
      `原奥斯里克：${s.alchemist.encounter.enemy.status}，健康${s.alchemist.encounter.enemy.health}；原科尔温：${s.arcaneScholar.encounter.enemyStatus}，健康${s.arcaneScholar.encounter.enemyHealth}、灵性${s.arcaneScholar.encounter.enemySpirituality}。原棍和各自结局不改写。`,
      '原海伦娜包裹/黄铜片、内尔测试纸、回收熔片与两次测量均保留；旧同意不延伸到本次维拉或新原件。',
    ] : [],
    life: projectKnowledgeMentorLife(s), encounter: projectKnowledgeMentorEncounter(s), insideCase: hasKnowledgeMentorLock(s),
    environment: available ? '原工作台AL4-WORKBENCH-1的2米路线与1米护架标记。新有限指令片必须实际取得并只适配原盒/原架，维拉（KM2-VERA，39岁）当前同意；原物实际返回，全部新能力、步骤、时间和费用为G。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateKnowledgeMentorState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.knowledgeMentor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'arcaneScholarActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as KnowledgeMentorState, promoted = isKnowledgeMentor(s), firstWeek = s.arcaneScholar.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + KNOWLEDGE_MENTOR_MIN_ARCANE_SCHOLAR_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !KNOWLEDGE_MENTOR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasKnowledgeMentorLifeLock(s) || hasKnowledgeMentorEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.arcaneScholar.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.arcaneScholarActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS, ...ASTRONOMER_ABILITY_IDS, ...ALCHEMIST_ABILITY_IDS, ...ARCANE_SCHOLAR_ABILITY_IDS, ...KNOWLEDGE_MENTOR_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.arcaneScholarActingAtPromotion !== null || KNOWLEDGE_MENTOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `knowledge-mentor-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== KNOWLEDGE_MENTOR_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.arcaneScholar.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateKnowledgeMentorLife(s) && validateKnowledgeMentorEncounter(s);
}
export { KNOWLEDGE_MENTOR_ABILITIES } from './content.js';
export { KNOWLEDGE_MENTOR_ABILITY_IDS } from './types.js';
export type * from './types.js';
