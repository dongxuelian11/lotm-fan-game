import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../barbarian/types.js';
import { BRIBER_ABILITY_IDS } from '../briber/types.js';
import { CORRUPTION_BARON_ABILITY_IDS } from '../corruption-baron/types.js';
import { MENTOR_DISORDER_ABILITY_IDS } from '../mentor-disorder/types.js';
import { FALLEN_EARL_ABILITY_IDS } from '../fallen-earl/types.js';
import { hasMentorDisorderOpenPractice } from '../mentor-disorder/encounter.js';
import { hasFallenEarlLifeLock } from '../fallen-earl/life.js';
import { hasFallenEarlEncounterLock } from '../fallen-earl/encounter.js';
import { createFrenzyMageLifeState, applyFrenzyMageActivity, projectFrenzyMageLife, frenzyMageLifeActions, validateFrenzyMageLife, validateFrenzyMageActivityCommand, hasFrenzyMageLifeLock } from './life.js';
import { createFrenzyMageEncounterState, applyFrenzyMageEncounterCommand, projectFrenzyMageEncounter, frenzyMageEncounterActions, validateFrenzyMageEncounter, validateFrenzyMageEncounterCommand, hasFrenzyMageEncounterLock } from './encounter.js';
import { FRENZY_MAGE_ABILITIES, FRENZY_MAGE_BOTTLE_IDS, FRENZY_MAGE_CONSUMPTION_RISK, FRENZY_MAGE_FORMULA_STATUS, FRENZY_MAGE_GUIDE, FRENZY_MAGE_LABOUR_STEPS, FRENZY_MAGE_LABOUR_TASKS, FRENZY_MAGE_MIN_FALLEN_EARL_WEEKS, FRENZY_MAGE_POTION_SOURCES, FRENZY_MAGE_PREPARATIONS, FRENZY_MAGE_PRICES, FRENZY_MAGE_SOURCE_STATUS } from './content.js';
import { FRENZY_MAGE_ABILITY_IDS, FRENZY_MAGE_PREPARATION_IDS, type FrenzyMageAcquisitionCommand, type FrenzyMageAction, type FrenzyMageBottle, type FrenzyMageCommand, type FrenzyMageProjection, type FrenzyMageState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): FrenzyMageBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createFrenzyMageState(): FrenzyMageState {
  return { guidanceKnown: false, bottles: FRENZY_MAGE_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, fallenEarlActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createFrenzyMageLifeState(), encounter: createFrenzyMageEncounterState() };
}
export const isFrenzyMage = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 3;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && [4, 3].includes(s.progression.sequence ?? 0)
  && s.lawyer.discovered && s.lawyer.guidanceKnown && s.barbarian.formulaKnown && s.briber.formulaKnown
  && s.corruptionBaron.guidanceKnown && s.mentorDisorder.guidanceKnown && s.fallenEarl.guidanceKnown && s.fallenEarl.promotionWeek !== null;
/** Older people, originals and history are owned by their original stage. */
export const hasFrenzyMageOldPractice = (s: SliceState): boolean => hasMentorDisorderOpenPractice(s)
  || hasFallenEarlLifeLock(s) || hasFallenEarlEncounterLock(s)
  || s.corruptionBaron.encounter.status === 'FIGHTING' || s.mentorDisorder.encounter.status === 'FIGHTING'
  || s.fallenEarl.life.clerk.consented || s.fallenEarl.encounter.bestowReady || s.fallenEarl.encounter.composureReady
  || [s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.mentorDisorder].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'))
  || Object.values(s.fallenEarl.life.cases).some(value => value.status === 'PREPARED');
export const hasFrenzyMageRitualLock = (s: SliceState): boolean => s.frenzyMage.preparedWeek !== null;
export const hasFrenzyMageLock = (s: SliceState): boolean => hasFrenzyMageRitualLock(s) || hasFrenzyMageLifeLock(s) || hasFrenzyMageEncounterLock(s);
const bottleNumber = (b: Pick<FrenzyMageBottle, 'id'>) => Number(b.id.slice('frenzy-mage-potion-'.length));
const potionPrice = (b: FrenzyMageBottle) => FRENZY_MAGE_PRICES.potion - (b.labourSteps === FRENZY_MAGE_LABOUR_STEPS ? FRENZY_MAGE_PRICES.labourCredit : 0);
const fallenEarlWeeks = (s: SliceState) => Math.max(0, (s.frenzyMage.promotionWeek ?? s.week) - (s.fallenEarl.promotionWeek ?? s.week));
const exhaustedSupply = (state: FrenzyMageState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${FRENZY_MAGE_GUIDE}介绍的独立狂乱法师成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶frenzy-mage-potion-${number}；非堕落伯爵或更早原瓶改装。狂乱法师序列3名称与编号有直接原核，完整配方和原著晋升仪式未披露，专业准备另行实际完成且全部为G。`;
const hasPreparations = (s: SliceState) => FRENZY_MAGE_PREPARATION_IDS.every(id => s.frenzyMage.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `堕落伯爵魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.fallenEarl.promotionWeek === null || fallenEarlWeeks(s) < FRENZY_MAGE_MIN_FALLEN_EARL_WEEKS) return `成为堕落伯爵后已过${fallenEarlWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有黑皇帝记录核对、有限动作与当前许可边界核验、普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateFrenzyMageAcquisitionCommand(v: unknown): v is FrenzyMageAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && FRENZY_MAGE_PREPARATION_IDS.includes(v.taskId as typeof FRENZY_MAGE_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^frenzy-mage-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isFrenzyMageAcquisitionCommand = validateFrenzyMageAcquisitionCommand;
export function validateFrenzyMageCommand(v: unknown): v is FrenzyMageCommand {
  return validateFrenzyMageAcquisitionCommand(v) || validateFrenzyMageActivityCommand(v) || validateFrenzyMageEncounterCommand(v);
}
export function frenzyMageAcquisitionBlock(s: SliceState, command: FrenzyMageAcquisitionCommand): string | null {
  if (!validateFrenzyMageAcquisitionCommand(command)) return '狂乱法师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasFrenzyMageOldPractice(s) || hasFrenzyMageLifeLock(s) || hasFrenzyMageEncounterLock(s)) return '先实际结束旧接触、演练、待生效影响，归还原物并收束旧准备和当前实践；旧人物、伤势与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原契约铺旁FM3-QUIET-ROOM独立安静房间。';
  if (!knownChannel(s)) return '实际成为堕落伯爵并保留原指导渠道后，才能了解狂乱法师之路。';
  if (isFrenzyMage(s)) return '已经真实晋升狂乱法师3，不能重复准备或服药；未服原瓶保留。';
  const state = s.frenzyMage;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < FRENZY_MAGE_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的狂乱法师原瓶。';
    return s.cash < FRENZY_MAGE_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批狂乱法师原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的狂乱法师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选狂乱法师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= FRENZY_MAGE_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyFrenzyMageAcquisition(s: SliceState, command: FrenzyMageAcquisitionCommand, ctx: SeerContext): void {
  const reason = frenzyMageAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.frenzyMage;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= FRENZY_MAGE_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取狂乱法师独立成品与专业准备指导', `花1行动、500便士。${FRENZY_MAGE_GUIDE}说明原渠道记录。${FRENZY_MAGE_FORMULA_STATUS}${FRENZY_MAGE_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = FRENZY_MAGE_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原堕落伯爵晋升周${s.fallenEarl.promotionWeek}、原马洛${s.fallenEarl.encounter.targetId}的实际伤势与${s.fallenEarl.encounter.enemyStatus}结局、原箱与原垫及唯一briber.gifts的${s.briber.gifts.length}件原礼物记录；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= FRENZY_MAGE_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(FRENZY_MAGE_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('狂乱法师独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、礼物、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批狂乱法师成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < FRENZY_MAGE_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`frenzy-mage-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶狂乱法师原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.fallenEarlActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of FRENZY_MAGE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为狂乱法师', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；堕落伯爵消化100与全部旧掌握保留，只新增black-emperor.s3.ordered-deviation一项掌握从0开始。灵性上限120，当前不补满；全部六个旧阶段原瓶、劳务、原人物、原物与实战历史保留。原马洛的伤势和真实死亡不重开；唯一briber.gifts的旧原礼物数量、持有者、已赠去向与时间完全不改，不补充或回收。原身体、年龄、性别不变；序列3名称编号有原核，新机制均为G，不授追改、传送、永久服从或必定成功。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '狂乱法师魔药严重排异' : '狂乱法师魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为堕落伯爵，旧消化、掌握、原人物历史与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyFrenzyMageCommand(s: SliceState, command: FrenzyMageCommand, ctx: SeerContext): void {
  if (!validateFrenzyMageCommand(command)) throw new Error('狂乱法师命令无效。');
  if (validateFrenzyMageAcquisitionCommand(command)) return applyFrenzyMageAcquisition(s, command, ctx);
  if (validateFrenzyMageActivityCommand(command)) return applyFrenzyMageActivity(s, command, ctx);
  if (validateFrenzyMageEncounterCommand(command)) return applyFrenzyMageEncounterCommand(s, command, ctx);
  throw new Error('未知狂乱法师命令。');
}

export function projectFrenzyMage(s: SliceState): FrenzyMageProjection {
  const state = s.frenzyMage, available = knownChannel(s), promoted = isFrenzyMage(s), actions: FrenzyMageAction[] = [];
  const add = (id: string, label: string, cost: string, command: FrenzyMageAcquisitionCommand) => { const reason = frenzyMageAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-frenzy-mage-guidance', '听取狂乱法师成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of FRENZY_MAGE_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`frenzy-mage-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-frenzy-mage-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-frenzy-mage-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-frenzy-mage-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-frenzy-mage-supply', '申请下一批独立狂乱法师成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${FRENZY_MAGE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶狂乱法师魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 堕落伯爵消化${s.progression.acting}/100 · ${fallenEarlWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: FrenzyMageAction[] = available ? [...actions, ...frenzyMageLifeActions(s), ...frenzyMageEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '狂乱法师与有限次序', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${FRENZY_MAGE_FORMULA_STATUS}${FRENZY_MAGE_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完堕落伯爵之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 狂乱法师成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为堕落伯爵' : '排异，仍为堕落伯爵'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? FRENZY_MAGE_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? FRENZY_MAGE_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `堕落伯爵消化${state.fallenEarlActingAtPromotion}/100留存；狂乱法师扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖成功且真正应用于已明确、尚未执行的那一次动作的能力；撤回、取消、失败或未实际应用均不给新掌握。和平100不保证原著安全消化。` : available ? `堕落伯爵需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${fallenEarlWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完堕落伯爵之路。',
    pollution: s.seer.pollution, risk: available ? FRENZY_MAGE_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `原FE4-CRATE-1箱由${s.fallenEarl.life.crate.holder}持有，在${s.fallenEarl.life.crate.positionMetres}米处；原FE4-PAD-1垫由${s.fallenEarl.life.pad.holder}保管，原身体${s.fallenEarl.life.pad.bodyState}；原伊芙仍在原桌旁，既有心理影响${s.fallenEarl.life.clerk.effect}。唯一briber.gifts共${s.briber.gifts.length}件原礼物：仍在PLAYER的${s.briber.gifts.filter(g => g.location === 'PLAYER').length}件，已经GIVEN的${s.briber.gifts.filter(g => g.location === 'GIVEN').length}件。只有实际仍持有的旧礼物可在新战给出，永久留在新院；没有新库存、复制、回收或晋升赠送。` : '',
    inheritedHistory: available ? [
      `堕落伯爵第${s.fallenEarl.promotionWeek}周真实晋升；${promoted ? `原消化${state.fallenEarlActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '律师、野蛮人、贿赂者、腐化男爵、混乱导师与堕落伯爵六个阶段的全部原ID、掌握、原瓶、劳务、原人物、原物、许可与拒绝记录保留，旧掌握0仍为0。晋升不修改身份、性别、年龄或原物所有权。',
      `唯一briber.gifts原礼物记录：${s.briber.gifts.map(g => `${g.id}：${g.location}${g.destination === null ? '' : `，原去向${g.destination}，第${g.givenWeek}周实际给出`}`).join('；')}。已GIVEN原礼物不归还，旧去向与原给出周不改；本阶只有从PLAYER实际给出这一项允许变化。`,
      `原马洛${s.fallenEarl.encounter.targetId}：${s.fallenEarl.encounter.enemyStatus}，健康${s.fallenEarl.encounter.enemyHealth}/100、精神${s.fallenEarl.encounter.enemyMind}/100、灵性${s.fallenEarl.encounter.enemySpirituality}，原伤势${s.fallenEarl.encounter.enemyInjuries.length}处；原战斗与原里斯历史保留，晋升和离场不治疗、重开或复活旧对手。`,
    ] : [],
    life: projectFrenzyMageLife(s), encounter: projectFrenzyMageEncounter(s), insideCase: hasFrenzyMageLock(s),
    environment: available ? '原创G协会净空投递演练房FM3-DELIVERY-ROOM：入口START距原工位A4米，两张独立空置有垫接收台B/C各距A4米，轨迹没有其他人。42岁成年自主信差达里安·维尔FM3-DARIAN在A持唯一400g演练封包FM3-PARCEL，当前同意可撤回；原FM3-ROUTE-PAPER永久写从A到B。唯一80g软布球FM3-PRACTICE-BALL只由本人亲手投出。知识20四档成功只预备30秒内一次既有待行动作的有限偏转；本人或达里安之后实际执行才产生行走或投球的事实。能力5灵性2精神，失败、取消、撤回或过期不退。普通方法无检定、无精神灵性成本；原纸不变，原物必须实际归主，本人普通行走退出才能报告。完整配方与仪式未知，全部新场景、技能、概率、数值与专业准备为G。' : '',


  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateFrenzyMageState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.frenzyMage;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'fallenEarlActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as FrenzyMageState, promoted = isFrenzyMage(s), firstWeek = s.fallenEarl.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + FRENZY_MAGE_MIN_FALLEN_EARL_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !FRENZY_MAGE_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasFrenzyMageOldPractice(s) || hasFrenzyMageLifeLock(s) || hasFrenzyMageEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.fallenEarl.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.fallenEarlActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS, ...MENTOR_DISORDER_ABILITY_IDS, ...FALLEN_EARL_ABILITY_IDS, ...FRENZY_MAGE_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.fallenEarlActingAtPromotion !== null || FRENZY_MAGE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `frenzy-mage-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== FRENZY_MAGE_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.fallenEarl.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateFrenzyMageLife(s) && validateFrenzyMageEncounter(s);
}
export { FRENZY_MAGE_ABILITIES } from './content.js';
export { FRENZY_MAGE_ABILITY_IDS } from './types.js';
export type * from './types.js';
export * from './encounter.js';
export * from './combat.js';
