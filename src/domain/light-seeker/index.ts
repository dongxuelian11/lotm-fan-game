import { PURE_WHITE_ANGEL_ABILITY_IDS } from '../pure-white-angel/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../notary/types.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS } from '../priest-of-light/types.js';
import { UNSHADOWED_ABILITY_IDS } from '../unshadowed/types.js';
import { JUSTICE_MENTOR_ABILITY_IDS } from '../justice-mentor/types.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';
import { notaryInside } from '../notary/life.js';
import { hasUnshadowedRitualLock } from '../unshadowed/ritual.js';
import { hasUnshadowedLifeLock } from '../unshadowed/life.js';
import { hasUnshadowedEncounterLock } from '../unshadowed/encounter.js';
import { hasJusticeMentorLifeLock } from '../justice-mentor/life.js';
import { hasJusticeMentorEncounterLock } from '../justice-mentor/encounter.js';
import { createLightSeekerLifeState, applyLightSeekerActivity, projectLightSeekerLife, lightSeekerLifeActions, validateLightSeekerLife, validateLightSeekerActivityCommand, hasLightSeekerLifeLock } from './life.js';
import { createLightSeekerEncounterState, applyLightSeekerEncounterCommand, projectLightSeekerEncounter, lightSeekerEncounterActions, validateLightSeekerEncounter, validateLightSeekerEncounterCommand, hasLightSeekerEncounterLock } from './encounter.js';
import { LIGHT_SEEKER_ABILITIES, LIGHT_SEEKER_BOTTLE_IDS, LIGHT_SEEKER_CONSUMPTION_RISK, LIGHT_SEEKER_FORMULA_STATUS, LIGHT_SEEKER_GUIDE, LIGHT_SEEKER_LABOUR_STEPS, LIGHT_SEEKER_LABOUR_TASKS, LIGHT_SEEKER_MIN_JUSTICE_MENTOR_WEEKS, LIGHT_SEEKER_POTION_SOURCES, LIGHT_SEEKER_PREPARATIONS, LIGHT_SEEKER_PRICES, LIGHT_SEEKER_SOURCE_STATUS } from './content.js';
import { LIGHT_SEEKER_ABILITY_IDS, LIGHT_SEEKER_PREPARATION_IDS, type LightSeekerAcquisitionCommand, type LightSeekerAction, type LightSeekerBottle, type LightSeekerCommand, type LightSeekerProjection, type LightSeekerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const LIGHT_SEEKER_INHERITED_ABILITY_IDS = [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS, ...PRIEST_OF_LIGHT_ABILITY_IDS, ...UNSHADOWED_ABILITY_IDS, ...JUSTICE_MENTOR_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = LIGHT_SEEKER_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): LightSeekerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createLightSeekerState(): LightSeekerState {
  return { guidanceKnown: false, bottles: LIGHT_SEEKER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, justiceMentorActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createLightSeekerLifeState(), encounter: createLightSeekerEncounterState() };
}
/** Historical membership never broadens the exact current-stage action guards. */
export const isLightSeeker = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 2;
export const isLightSeekerAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 3;
export const hasLightSeekerHistory = (s: SliceState) => (isLightSeeker(s)||(s.progression.pathwayId==='sun'&&s.progression.sequence===1)) && s.lightSeeker.promotionWeek !== null;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'sun' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.bard.discovered && s.justiceMentor.guidanceKnown && s.justiceMentor.promotionWeek !== null;
export const hasLightSeekerLock = (s: SliceState): boolean => s.progression.pathwayId==='sun' && [3,2].includes(s.progression.sequence??0) && (s.lightSeeker.preparedWeek !== null || hasLightSeekerLifeLock(s) || hasLightSeekerEncounterLock(s));
const bottleNumber = (b: Pick<LightSeekerBottle, 'id'>) => Number(b.id.slice('light-seeker-potion-'.length));
const potionPrice = (b: LightSeekerBottle) => LIGHT_SEEKER_PRICES.potion - (b.labourSteps === LIGHT_SEEKER_LABOUR_STEPS ? LIGHT_SEEKER_PRICES.labourCredit : 0);
const justiceMentorWeeks = (s: SliceState) => Math.max(0, (s.lightSeeker.promotionWeek ?? s.week) - (s.justiceMentor.promotionWeek ?? s.week));
const exhaustedSupply = (state: LightSeekerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${LIGHT_SEEKER_GUIDE}介绍的逐光者成品渠道，第${Math.ceil(number / 3)}批、第${week}周到货，独立封存药瓶light-seeker-potion-${number}。本瓶费用与专业准备分别结算。`;
const hasPreparations = (s: SliceState) => LIGHT_SEEKER_PREPARATION_IDS.every(id => s.lightSeeker.preparations.some(p => p.taskId === id));
/** Read only the real old scene state: no stage widening, reset, repair or inherited source reward. */
export function hasLightSeekerOldSceneLock(s: SliceState): boolean {
  return s.justiceMentor.preparedWeek !== null || hasJusticeMentorLifeLock(s) || hasJusticeMentorEncounterLock(s) ||
    Object.values(s.justiceMentor.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasUnshadowedRitualLock(s) || s.unshadowed.ritual.activeVisitId !== null || hasUnshadowedLifeLock(s) || hasUnshadowedEncounterLock(s) ||
    Object.values(s.unshadowed.life.cases).some(v => v.status === 'PREPARED') ||
    hasPriestOfLightOpenPractice(s) || notaryInside(s) ||
    Object.values(s.priestOfLight.cases).some(v => v.status === 'PREPARED') ||
    Object.values(s.notary.cases).some(v => v.status === 'PREPARED');
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以退出本次准备后正常休养，未服原瓶保留，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `正义导师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.justiceMentor.promotionWeek === null || justiceMentorWeeks(s) < LIGHT_SEEKER_MIN_JUSTICE_MENTOR_WEEKS) return `从正义导师实际晋升周起已过${justiceMentorWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别完成光路检查、照射风险复核和停止返程演练；购买药瓶不能代替这些准备。';
}
export function validateLightSeekerAcquisitionCommand(v: unknown): v is LightSeekerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && LIGHT_SEEKER_PREPARATION_IDS.includes(v.taskId as typeof LIGHT_SEEKER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^light-seeker-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isLightSeekerAcquisitionCommand = validateLightSeekerAcquisitionCommand;
export function validateLightSeekerCommand(v: unknown): v is LightSeekerCommand {
  return validateLightSeekerAcquisitionCommand(v) || validateLightSeekerActivityCommand(v) || validateLightSeekerEncounterCommand(v);
}
export function lightSeekerAcquisitionBlock(s: SliceState, command: LightSeekerAcquisitionCommand): string | null {
  if (!validateLightSeekerAcquisitionCommand(command)) return '逐光者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasLightSeekerOldSceneLock(s) || hasLightSeekerLifeLock(s) || hasLightSeekerEncounterLock(s)) return '先收束正义导师和更早现场的准备、接触、借物与遭遇，再来采光廊。';
  if (s.world.city !== 'BACKLUND') return '须先回到贝克兰德公共音乐室旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为正义导师并保留原指导渠道后，才能了解逐光者之路。';
  if (!isLightSeekerAcquisitionStage(s)) return '已晋升逐光者2，不能凭继承的正义导师历史重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '歌颂者至正义导师的十八项已有掌握记录不完整，暂不能继续晋升。';
  const state = s.lightSeeker;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '本周已实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、准备要求与四档风险。' : s.cash < LIGHT_SEEKER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听指导者说明成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的逐光者原瓶。';
    return s.cash < LIGHT_SEEKER_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批逐光者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知逐光者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选逐光者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= LIGHT_SEEKER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application commits this working-copy mutation through the existing transaction. */
export function applyLightSeekerAcquisition(s: SliceState, command: LightSeekerAcquisitionCommand, ctx: SeerContext): void {
  const reason = lightSeekerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.lightSeeker;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= LIGHT_SEEKER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取逐光者独立成品与专业准备指导', `花1行动、500便士。${LIGHT_SEEKER_GUIDE}说明原渠道记录。${LIGHT_SEEKER_FORMULA_STATUS}${LIGHT_SEEKER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = LIGHT_SEEKER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= LIGHT_SEEKER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周逐光者服药场地', '花1行动、120便士，按三项准备检查本次服药场地。尚未服药，须另行确认饮用所选药瓶。退出需要0行动，本次检查随即失效，费用不退，未服药瓶保留。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留，可以正常生活休养；下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(LIGHT_SEEKER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800；部分劳动不折现、不转给别瓶，不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('逐光者独立原瓶实际交付', `0行动、${paid}便士，领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用；三项专业准备和当周服药场地检查另行完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批逐光者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < LIGHT_SEEKER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`light-seeker-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新三瓶逐光者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind -= mentalCost; state.justiceMentorActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of LIGHT_SEEKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为逐光者·太阳序列2', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；留存正义导师消化100与十八项已有掌握，两项新掌握从0开始。灵性上限120，当前灵性保持；身体性别、伤势与累计风险均保持。过去药瓶与人物、物品的记录保留。本次药瓶与场地准备已经用尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '逐光者魔药严重排异' : '逐光者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。现场专业照护使本次排异后的健康与精神最低为1；普通生活和战斗中的死亡风险仍需承担。仍为正义导师，旧消化、全部原掌握与三项真实专业经历保留；本人沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyLightSeekerCommand(s: SliceState, command: LightSeekerCommand, ctx: SeerContext): void {
  if (!validateLightSeekerCommand(command)) throw new Error('逐光者命令无效。');
  if (validateLightSeekerAcquisitionCommand(command)) return applyLightSeekerAcquisition(s, command, ctx);
  if (!isLightSeeker(s) || !hasLightSeekerHistory(s)) throw new Error('新逐光者实践与遭遇只向当前太阳序列2开放，旧正义导师历史不能代替当前资格。');
  if (hasLightSeekerOldSceneLock(s)) throw new Error('先收束此前现场与准备，再进入采光廊。');
  if (validateLightSeekerActivityCommand(command)) return applyLightSeekerActivity(s, command, ctx);
  if (validateLightSeekerEncounterCommand(command)) return applyLightSeekerEncounterCommand(s, command, ctx);
  throw new Error('未知逐光者命令。');
}

export function projectLightSeeker(s: SliceState): LightSeekerProjection {
  const state = s.lightSeeker, available = knownChannel(s), promoted = hasLightSeekerHistory(s), actions: LightSeekerAction[] = [];
  const add = (id: string, label: string, cost: string, command: LightSeekerAcquisitionCommand) => {
    const reason = lightSeekerAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isLightSeekerAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-light-seeker-guidance', '听取逐光者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of LIGHT_SEEKER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`light-seeker-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-light-seeker-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-light-seeker-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-light-seeker-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-light-seeker-supply', '申请下一批独立逐光者成品', '1行动 · 下一真实周起收货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < LIGHT_SEEKER_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${LIGHT_SEEKER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶逐光者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 正义导师消化${s.progression.acting}/100 · ${justiceMentorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '逐光者 · 太阳序列2' : '逐光者之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${LIGHT_SEEKER_FORMULA_STATUS}${LIGHT_SEEKER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或本瓶五项真实劳动后800便士；现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available && s.progression.sequence!==1 ? [...actions, ...(promoted ? [...lightSeekerLifeActions(s), ...lightSeekerEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 逐光者独立成品魔药`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为正义导师' : '排异，仍为正义导师'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? LIGHT_SEEKER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? LIGHT_SEEKER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===1?s.pureWhiteAngel.lightSeekerActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `正义导师消化${state.justiceMentorActingAtPromotion}/100留存；逐光者扮演${s.progression.sequence===1?s.pureWhiteAngel.lightSeekerActingAtPromotion:s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；每项新能力每案只在真实应用后最多增加8掌握，成功开窗而未使用不奖。旧三案与旧反思不重复记为本阶经历。` : available ? `正义导师需消化100（当前${s.progression.acting}/100）、从其实际晋升周起12整周（当前${justiceMentorWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完正义导师之路。',
    pollution: s.seer.pollution, risk: available ? LIGHT_SEEKER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `正义导师在第${s.justiceMentor.promotionWeek}周晋升；${promoted ? `当时消化${state.justiceMentorActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。逐光者的十二整周从该周计算。`,
      `历阶消化：歌颂者${s.lightprayer.bardActingAtPromotion}、祈光人${s.sunpriest.lightprayerActingAtPromotion}、太阳神官${s.notary.sunpriestActingAtPromotion}、公证人${s.priestOfLight.notaryActingAtPromotion}、光之祭司${s.unshadowed.priestOfLightActingAtPromotion}、无暗者${s.justiceMentor.unshadowedActingAtPromotion}、正义导师${promoted ? state.justiceMentorActingAtPromotion : s.progression.acting}。`,
      `十八项已有掌握保持原值：${INHERITED_ABILITY_IDS.map(id => `${id}=${s.progression.mastery[id] ?? 0}`).join('，')}。两项逐光者技巧从0开始，只有实际应用并报告才增加掌握。`,
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；伤势记录${s.injuries.length}项，未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项，累计风险${s.injuryRisk}。`,
      `工作院的友善灵${s.justiceMentor.life.elm.id}榆音仍在${s.justiceMentor.life.elm.location}，已沿普通路行进${s.justiceMentor.life.elm.travelMetres}米；它与采光廊的芦影是不同的灵。`,
      `奥尔登${s.unshadowed.life.ally.id}${s.unshadowed.life.ally.alive ? '仍活着' : '已死亡'}，位置${s.unshadowed.life.ally.location}。原特性${s.unshadowed.life.characteristic.id}的污染${s.unshadowed.life.characteristic.contamination}，石板已有${s.unshadowed.life.tile.scorchMarks}处焦痕。`,
      ...(s.justiceMentor.encounter.approachWeek === null ? [] : [`科温JM3-CORWIN：${s.justiceMentor.encounter.enemyStatus}，健康${s.justiceMentor.encounter.enemyHealth}/100、精神${s.justiceMentor.encounter.enemyMind}/100、灵性${s.justiceMentor.encounter.enemySpirituality}/120；原棍位置${s.justiceMentor.encounter.weaponLocation}，已有遭遇结局保持。`]),
      ...(s.unshadowed.encounter.approachWeek === null ? [] : [`埃德蒙UD4-EDMUND：${s.unshadowed.encounter.enemy.status}，健康${s.unshadowed.encounter.enemy.health}/100、精神${s.unshadowed.encounter.enemy.mind}/100；原棍位置${s.unshadowed.encounter.enemy.weaponLocation}。`]),
      ...s.unshadowed.ritual.visits.map(visit => `情感场${visit.id}：${visit.anchor ? `同一情感${visit.anchor.id}仍为${visit.anchor.location}，记忆${visit.anchor.memoriesRetained ? '保留' : '未保留'}` : '没有声明情感'}；原载体${visit.vessel.id}状态${visit.vessel.status}，原包${visit.kit.id}状态${visit.kit.status}。`),
      '过去的药瓶耗用、失败、劳务、准备、许可与撤回记录继续保留。采光廊要重新询问玛拉与芦影的当前意愿，并按它们实际的位置和资源行动。',
    ] : [],
    life: projectLightSeekerLife(s), encounter: projectLightSeekerEncounter(s), insideCase: hasLightSeekerLock(s),
    environment: available ? 'LS2-GALLERY是一段6米有顶直廊，普通出口开放。玛拉46岁，芦影是她已联系的友善灵；两者都有独立精力和当前意愿。廊内只有一扇遮光闸、一盏油灯、一块NORTH_ARCH刻字板、一个遮罩和一块屏板。三次实践与可选的欧文遭遇共用这些原物；步行、灯油与磨损均按实际保留。' : '',
  };
}

/** Exact sources and bounded week chronology. Old modules remain authoritative for their own histories. */
export function validateLightSeekerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.lightSeeker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'justiceMentorActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as LightSeekerState, promoted = hasLightSeekerHistory(s), acquisitionStage = isLightSeekerAcquisitionStage(s);
  const firstWeek = s.justiceMentor.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + LIGHT_SEEKER_MIN_JUSTICE_MENTOR_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !integer(s.justiceMentor.promotionWeek, 1, s.week))) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > LIGHT_SEEKER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !LIGHT_SEEKER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || hasLightSeekerOldSceneLock(s) || hasLightSeekerLifeLock(s) || hasLightSeekerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.justiceMentor.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.justiceMentorActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || hasLightSeekerOldSceneLock(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?PURE_WHITE_ANGEL_ABILITY_IDS:[]), ...INHERITED_ABILITY_IDS, ...LIGHT_SEEKER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.justiceMentorActingAtPromotion !== null || LIGHT_SEEKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `light-seeker-potion-${index + 1}` || !integer(b.labourSteps, 0, LIGHT_SEEKER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < LIGHT_SEEKER_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== LIGHT_SEEKER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % LIGHT_SEEKER_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek) return false;
      if (state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.justiceMentor.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateLightSeekerLife(s) || !validateLightSeekerEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { LIGHT_SEEKER_ABILITIES } from './content.js';
export { LIGHT_SEEKER_ABILITY_IDS } from './types.js';
export type * from './types.js';
