import { BEAUTY_GODDESS_ABILITY_IDS } from '../beauty-goddess/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../potion-professor/types.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS } from '../crimson-scholar/types.js';
import { WITCH_KING_ABILITY_IDS } from '../witch-king/types.js';
import { SUMMONING_MASTER_ABILITY_IDS } from '../summoning-master/types.js';
import { hasSummoningMasterLock } from '../summoning-master/index.js';
import { hasWitchKingRitualLock } from '../witch-king/ritual.js';
import { hasWitchKingLifeLock } from '../witch-king/life.js';
import { hasWitchKingEncounterLock } from '../witch-king/encounter.js';
import { initializeLifeGiverLife, createLifeGiverLifeState, applyLifeGiverActivity, projectLifeGiverLife, lifeGiverLifeActions, validateLifeGiverLife, validateLifeGiverActivityCommand, hasLifeGiverLifeLock } from './life.js';
import { createLifeGiverEncounterState, applyLifeGiverEncounterCommand, projectLifeGiverEncounter, lifeGiverEncounterActions, validateLifeGiverEncounter, validateLifeGiverEncounterCommand, hasLifeGiverEncounterLock } from './encounter.js';
import { LIFE_GIVER_ABILITIES, LIFE_GIVER_BOTTLE_IDS, LIFE_GIVER_CONSUMPTION_RISK, LIFE_GIVER_FORMULA_STATUS, LIFE_GIVER_GUIDE, LIFE_GIVER_LABOUR_STEPS, LIFE_GIVER_LABOUR_TASKS, LIFE_GIVER_MIN_SUMMONING_MASTER_WEEKS, LIFE_GIVER_POTION_SOURCES, LIFE_GIVER_PREPARATIONS, LIFE_GIVER_PRICES, LIFE_GIVER_SOURCE_STATUS } from './content.js';
import { LIFE_GIVER_ABILITY_IDS, LIFE_GIVER_PREPARATION_IDS, type LifeGiverAcquisitionCommand, type LifeGiverAction, type LifeGiverBottle, type LifeGiverCommand, type LifeGiverProjection, type LifeGiverState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): LifeGiverBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createLifeGiverState(): LifeGiverState {
  return { guidanceKnown: false, bottles: LIFE_GIVER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, summoningMasterActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createLifeGiverLifeState(), encounter: createLifeGiverEncounterState() };
}
/** Current-stage checks never grant acquisition from an inherited S3 history. */
export const isLifeGiver = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 2;
export const isLifeGiverAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 3;
const hasSummoningMasterHistory = (s: SliceState) => s.progression.pathwayId === 'moon' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.apothecary.discovered && s.summoningMaster.guidanceKnown && s.summoningMaster.promotionWeek !== null;
export const hasLifeGiverHistory = (s: SliceState) => (isLifeGiver(s)||(s.progression.pathwayId==='moon'&&s.progression.sequence===1)) && s.lifeGiver.promotionWeek !== null;
const knownChannel = hasSummoningMasterHistory;
export const hasLifeGiverLock = (s: SliceState): boolean => s.lifeGiver.preparedWeek !== null || hasLifeGiverLifeLock(s) || hasLifeGiverEncounterLock(s);
const bottleNumber = (b: Pick<LifeGiverBottle, 'id'>) => Number(b.id.slice('life-giver-potion-'.length));
const potionPrice = (b: LifeGiverBottle) => LIFE_GIVER_PRICES.potion - (b.labourSteps === LIFE_GIVER_LABOUR_STEPS ? LIFE_GIVER_PRICES.labourCredit : 0);
const summoningMasterWeeks = (s: SliceState) => Math.max(0, (s.lifeGiver.promotionWeek ?? s.week) - (s.summoningMaster.promotionWeek ?? s.week));
const exhaustedSupply = (state: LifeGiverState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${LIFE_GIVER_GUIDE}的独立创生者成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶life-giver-potion-${number}；非召唤大师或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => LIFE_GIVER_PREPARATION_IDS.every(id => s.lifeGiver.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `召唤大师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.summoningMaster.promotionWeek === null || summoningMasterWeeks(s) < LIFE_GIVER_MIN_SUMMONING_MASTER_WEEKS) return `成为召唤大师后已过${summoningMasterWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成独立来源核对、原身体与原物检查、中止和普通撤离演练；购买原瓶不能代做专业准备。';
}
export function validateLifeGiverAcquisitionCommand(v: unknown): v is LifeGiverAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && LIFE_GIVER_PREPARATION_IDS.includes(v.taskId as typeof LIFE_GIVER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^life-giver-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isLifeGiverAcquisitionCommand = validateLifeGiverAcquisitionCommand;
export function validateLifeGiverCommand(v: unknown): v is LifeGiverCommand {
  return validateLifeGiverAcquisitionCommand(v) || validateLifeGiverActivityCommand(v) || validateLifeGiverEncounterCommand(v);
}
export function lifeGiverAcquisitionBlock(s: SliceState, command: LifeGiverAcquisitionCommand): string | null {
  if (!validateLifeGiverAcquisitionCommand(command)) return '创生者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasSummoningMasterLock(s) || hasWitchKingRitualLock(s) || hasWitchKingLifeLock(s) || hasWitchKingEncounterLock(s) ||
      Object.values(s.witchKing.life.cases).some(v => v.status === 'PREPARED') ||
      s.crimsonScholar.ritual.activeVisitId !== null ||
      Object.values(s.crimsonScholar.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' ||
      Object.values(s.potionProfessor.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      Object.values(s.potionProfessor.laboratory.effects).some(Boolean) || s.tamer.companionId !== null ||
      Object.values(s.tamer.animals).some(v => v.location !== 'HOME') ||
      (s.summoningMaster.life.partner.status === 'ALIVE' && s.summoningMaster.life.partner.location !== 'HOME') ||
      hasLifeGiverLifeLock(s) || hasLifeGiverEncounterLock(s)) return '先实际收束旧召唤、原仪式、月场、原物实践与现场接触；同行原动物和活来客须普通回原居处，不能沿用旧同意。死亡原来客与原声片保留原处，不会被归还动作删除。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原私人仪式厅旁的指导场。';
  if (!knownChannel(s)) return '实际成为召唤大师并保留原指导渠道后，才能了解创生者之路。';
  if (!isLifeGiverAcquisitionStage(s)) return '当前已为创生者2，不能凭继承的召唤大师历史重复准备或服药；未服原瓶保留。';
  const state = s.lifeGiver;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < LIFE_GIVER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的创生者原瓶。';
    return s.cash < LIFE_GIVER_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批创生者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的创生者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选创生者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= LIFE_GIVER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyLifeGiverAcquisition(s: SliceState, command: LifeGiverAcquisitionCommand, ctx: SeerContext): void {
  const reason = lifeGiverAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.lifeGiver;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= LIFE_GIVER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取创生者独立成品与专业准备指导', `花1行动、500便士。${LIFE_GIVER_GUIDE}说明原渠道记录。${LIFE_GIVER_FORMULA_STATUS}${LIFE_GIVER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = LIFE_GIVER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= LIFE_GIVER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(LIFE_GIVER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('创生者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠生命、灵魂、来客库存、专业准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批创生者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < LIFE_GIVER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`life-giver-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶创生者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.summoningMasterActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        initializeLifeGiverLife(s);
        for (const id of LIFE_GIVER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为创生者', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；召唤大师消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；本人伤势与累计风险不治疗、不重置；原血食、动物、纸张与既有药瓶原样保留，原流灯同一身体及原声片、旧埃德温和多里安的伤亡与原棍去向不改写。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '创生者魔药严重排异' : '创生者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为召唤大师，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyLifeGiverCommand(s: SliceState, command: LifeGiverCommand, ctx: SeerContext): void {
  if (!validateLifeGiverCommand(command)) throw new Error('创生者命令无效。');
  if (validateLifeGiverAcquisitionCommand(command)) return applyLifeGiverAcquisition(s, command, ctx);
  if (!isLifeGiver(s)) throw new Error('新创生者实践与遭遇只向当前月亮序列2开放，继承的旧阶段历史不能代替当前资格。');
  if (validateLifeGiverActivityCommand(command)) return applyLifeGiverActivity(s, command, ctx);
  if (validateLifeGiverEncounterCommand(command)) return applyLifeGiverEncounterCommand(s, command, ctx);
  throw new Error('未知创生者命令。');
}

export function projectLifeGiver(s: SliceState): LifeGiverProjection {
  const state = s.lifeGiver, available = knownChannel(s), promoted = hasLifeGiverHistory(s), actions: LifeGiverAction[] = [];
  const add = (id: string, label: string, cost: string, command: LifeGiverAcquisitionCommand) => { const reason = lifeGiverAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && isLifeGiverAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-life-giver-guidance', '听取创生者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of LIFE_GIVER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`life-giver-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-life-giver-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-life-giver-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-life-giver-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-life-giver-supply', '申请下一批独立创生者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${LIFE_GIVER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶创生者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 召唤大师消化${s.progression.acting}/100 · ${summoningMasterWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '创生者 · 序列2' : '创生者之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${LIFE_GIVER_FORMULA_STATUS}${LIFE_GIVER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available && s.progression.sequence!==1 ? [...actions, ...(promoted ? [...lifeGiverLifeActions(s), ...lifeGiverEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 创生者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为召唤大师' : '排异，仍为召唤大师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? LIFE_GIVER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? LIFE_GIVER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===1?s.beautyGoddess.lifeGiverActingAtPromotion??100:s.progression.acting) : 0, digestion: promoted ? `召唤大师消化${state.summoningMasterActingAtPromotion}/100留存；创生者扮演${s.progression.sequence===1?s.beautyGoddess.lifeGiverActingAtPromotion:s.progression.acting}/100。新阶段按实际完成的G情境积累扮演，普通完成与能力实测分别记账；旧三案与旧反思不能重复记为本阶经历。` : available ? `召唤大师需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${summoningMasterWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完召唤大师之路。',
    pollution: s.seer.pollution, risk: available ? LIFE_GIVER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `召唤大师第${s.summoningMaster.promotionWeek}周真实晋升；${promoted ? `原消化${state.summoningMasterActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。通用首次晋升周${s.progression.promotionWeek}不作本阶十二周起点。`,
      '药师至召唤大师七阶19项原ID、包括0值的掌握、原瓶失败与全部实践记录保留；创生者2不改变身体性别。美神1才涉及该变化，当前尚未开放。',
      `本人当前健康${s.health}/100、精神${s.mind}/100；旧轻重伤与累计伤势风险依实际记录保留，晋升不治疗、不回灵。`,
      `唯一原来客${s.summoningMaster.life.partner.id}、原身体${s.summoningMaster.life.partner.bodyId}、原声片${s.summoningMaster.life.partner.chime.id}：${s.summoningMaster.life.partner.status}，健康${s.summoningMaster.life.partner.health}、精神${s.summoningMaster.life.partner.mind}、精力${s.summoningMaster.life.partner.stamina}，仍在${s.summoningMaster.life.partner.location}；不复制、不复活、不暗补。`,
      `原牌${s.summoningMaster.life.token.id}仍在${s.summoningMaster.life.token.location}，实际保管者${s.summoningMaster.life.token.custodian}；原遮板${s.summoningMaster.life.shutter.id}保持${s.summoningMaster.life.shutter.location}。旧生活同意与旧埃德温援助许可均不延伸到新现场。`,
      ...s.witchKing.life.papers.map(p => `唯一原纸${p.id}：${p.status === 'CONSUMED' ? '已耗尽，不补回' : p.status === 'PREPARED' ? '已明确准备，尚未耗尽' : '实际持有，尚未准备'}；原取得、准备、使用周记录不改写。`),
      ...(s.summoningMaster.encounter.approachWeek === null ? [] : [`原埃德温SM3-EDWIN：${s.summoningMaster.encounter.enemyStatus}，健康${s.summoningMaster.encounter.enemyHealth}、精神${s.summoningMaster.encounter.enemyMind}、灵性${s.summoningMaster.encounter.enemySpirituality}；原棍SM3-EDWIN-CLUB仍在${s.summoningMaster.encounter.weaponLocation}，不因本次晋升重开遭遇或转给玩家。`]),
      ...(s.witchKing.encounter.approachWeek === null ? [] : [`原多里安WK4-DORIAN：${s.witchKing.encounter.enemy.status}、健康${s.witchKing.encounter.enemy.health}，原棍仍在${s.witchKing.encounter.enemy.weaponLocation}；原靶${s.witchKing.life.target.id}保持${s.witchKing.life.target.status}。`]),
    ] : [],
    life: projectLifeGiverLife(s), encounter: projectLifeGiverEncounter(s), insideCase: hasLifeGiverLock(s),
    environment: available ? '贝克兰德原私人仪式厅WK4-HALL旁指导场、SM3-GLASS-ROOM暖房与原小石院及30米普通小径。原流灯、艾达、原牌、原遮板、原桌与原声片继续使用唯一既存状态；新G有限支持须本人在场和当次同意，失败可停用并普通撤离，不发免费生命或灵魂。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateLifeGiverState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.lifeGiver;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'summoningMasterActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as LifeGiverState, promoted = hasLifeGiverHistory(s), firstWeek = s.summoningMaster.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + LIFE_GIVER_MIN_SUMMONING_MASTER_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (isLifeGiverAcquisitionStage(s) && (!shape(s.progression.mastery, [...(s.progression.sequence===1?BEAUTY_GODDESS_ABILITY_IDS:[]),...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS, ...WITCH_KING_ABILITY_IDS, ...SUMMONING_MASTER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !LIFE_GIVER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !isLifeGiverAcquisitionStage(s) || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasLifeGiverLifeLock(s) || hasLifeGiverEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.summoningMaster.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.summoningMasterActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?BEAUTY_GODDESS_ABILITY_IDS:[]),...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS, ...WITCH_KING_ABILITY_IDS, ...SUMMONING_MASTER_ABILITY_IDS, ...LIFE_GIVER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.summoningMasterActingAtPromotion !== null || LIFE_GIVER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `life-giver-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== LIFE_GIVER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.summoningMaster.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!isLifeGiverAcquisitionStage(s) || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !isLifeGiverAcquisitionStage(s) || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateLifeGiverLife(s) && validateLifeGiverEncounter(s);
}
export { LIFE_GIVER_ABILITIES } from './content.js';
export { LIFE_GIVER_ABILITY_IDS } from './types.js';
export type * from './types.js';
