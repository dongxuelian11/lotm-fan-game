import { SAGE_ABILITY_IDS } from '../sage/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { MYSTIC_ABILITY_IDS } from '../mystic/types.js';
import { hasMysticOldPracticeLock, hasMysticRitualLock } from '../mystic/ritual.js';
import { hasMysticEncounterLock } from '../mystic/encounter.js';
import { hasMysticLifeLock } from '../mystic/life.js';
import { createProphecyMasterLifeState, applyProphecyMasterActivity, projectProphecyMasterLife, prophecyMasterLifeActions, validateProphecyMasterLife, validateProphecyMasterActivityCommand, hasProphecyMasterLifeLock } from './life.js';
import { createProphecyMasterEncounterState, applyProphecyMasterEncounterCommand, projectProphecyMasterEncounter, prophecyMasterEncounterActions, validateProphecyMasterEncounter, validateProphecyMasterEncounterCommand, hasProphecyMasterEncounterLock } from './encounter.js';
import { PROPHECY_MASTER_ABILITIES, PROPHECY_MASTER_BOTTLE_IDS, PROPHECY_MASTER_CONSUMPTION_RISK, PROPHECY_MASTER_FORMULA_STATUS, PROPHECY_MASTER_GUIDE, PROPHECY_MASTER_LABOUR_STEPS, PROPHECY_MASTER_LABOUR_TASKS, PROPHECY_MASTER_MIN_MYSTIC_WEEKS, PROPHECY_MASTER_POTION_SOURCES, PROPHECY_MASTER_PREPARATIONS, PROPHECY_MASTER_PRICES, PROPHECY_MASTER_SOURCE_STATUS } from './content.js';
import { PROPHECY_MASTER_ABILITY_IDS, PROPHECY_MASTER_PREPARATION_IDS, type ProphecyMasterAcquisitionCommand, type ProphecyMasterAction, type ProphecyMasterBottle, type ProphecyMasterCommand, type ProphecyMasterProjection, type ProphecyMasterState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): ProphecyMasterBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createProphecyMasterState(): ProphecyMasterState {
  return { guidanceKnown: false, bottles: PROPHECY_MASTER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, mysticActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createProphecyMasterLifeState(), encounter: createProphecyMasterEncounterState() };
}
export const isProphecyMaster = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 3;
/** Historical membership is separate from permission to replay the old stage. */
export const hasProphecyMasterHistory = (s: SliceState) => s.progression.pathwayId === 'hermit' && [3, 2].includes(s.progression.sequence ?? 0);
export const prophecyMasterActing = (s: SliceState): number => s.progression.sequence === 2 ? s.sage?.prophecyMasterActingAtPromotion ?? 0 : s.progression.acting;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'hermit' && [4, 3, 2].includes(s.progression.sequence ?? 0) && (s.progression.sequence !== 2 || integer(s.sage?.promotionWeek, 1, s.week) && integer(s.prophecyMaster.promotionWeek, 1, s.sage.promotionWeek!)) && s.pryer.discovered && s.pryer.guidanceKnown && s.combatScholar.guidanceKnown && s.wizard.guidanceKnown && s.scrollProfessor.guidanceKnown && s.starMystic.guidanceKnown && s.mystic.guidanceKnown && s.mystic.promotionWeek !== null;
export const hasProphecyMasterOldPractice = (s: SliceState): boolean => hasMysticOldPracticeLock(s) || hasMysticRitualLock(s) || hasMysticLifeLock(s) || hasMysticEncounterLock(s)
  || Object.values(s.pryer.cases).some(value => value.readingOpen) || Object.values(s.combatScholar.cases).some(value => value.exerciseOpen)
  || Object.values(s.mystic.life.cases).some(value => value.status === 'PREPARED')
  || s.starMystic.encounter.status === 'FIGHTING' || s.scrollProfessor.encounter.status === 'FIGHTING'
  || s.starMystic.encounter.focused || s.starMystic.encounter.cageReady || s.mystic.encounter.focused || s.mystic.encounter.cageReady || s.mystic.encounter.echoReady;
export const hasProphecyMasterRitualLock = (s: SliceState): boolean => s.prophecyMaster.preparedWeek !== null;
export const hasProphecyMasterLock = (s: SliceState): boolean => hasProphecyMasterRitualLock(s) || hasProphecyMasterLifeLock(s) || hasProphecyMasterEncounterLock(s);
const bottleNumber = (b: Pick<ProphecyMasterBottle, 'id'>) => Number(b.id.slice('prophecy-master-potion-'.length));
const potionPrice = (b: ProphecyMasterBottle) => PROPHECY_MASTER_PRICES.potion - (b.labourSteps === PROPHECY_MASTER_LABOUR_STEPS ? PROPHECY_MASTER_PRICES.labourCredit : 0);
const mysticWeeks = (s: SliceState) => Math.max(0, (s.prophecyMaster.promotionWeek ?? s.week) - (s.mystic.promotionWeek ?? s.week));
const exhaustedSupply = (state: ProphecyMasterState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${PROPHECY_MASTER_GUIDE}介绍的独立预言大师成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶prophecy-master-potion-${number}；非神秘学家或更早原瓶改装。序列3预言大师已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => PROPHECY_MASTER_PREPARATION_IDS.every(id => s.prophecyMaster.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `神秘学家魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.mystic.promotionWeek === null || mysticWeeks(s) < PROPHECY_MASTER_MIN_MYSTIC_WEEKS) return `成为神秘学家后已过${mysticWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有预兆记录核对、能力边界核验与普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateProphecyMasterAcquisitionCommand(v: unknown): v is ProphecyMasterAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && PROPHECY_MASTER_PREPARATION_IDS.includes(v.taskId as typeof PROPHECY_MASTER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^prophecy-master-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isProphecyMasterAcquisitionCommand = validateProphecyMasterAcquisitionCommand;
export function validateProphecyMasterCommand(v: unknown): v is ProphecyMasterCommand {
  return validateProphecyMasterAcquisitionCommand(v) || validateProphecyMasterActivityCommand(v) || validateProphecyMasterEncounterCommand(v);
}
export function prophecyMasterAcquisitionBlock(s: SliceState, command: ProphecyMasterAcquisitionCommand): string | null {
  if (!validateProphecyMasterAcquisitionCommand(command)) return '预言大师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasProphecyMasterOldPractice(s) || hasProphecyMasterLifeLock(s) || hasProphecyMasterEncounterLock(s)) return '先实际结束旧窥视、演练、原血样分析与原能力效果，归还原物并收束旧准备和当前实践；旧人物、伤势、故事与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德PM3-WAREHOUSE旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为神秘学家并保留原指导渠道后，才能了解预言大师之路。';
  if (hasProphecyMasterHistory(s)) return '已经真实晋升预言大师3，不能重复准备或服药；未服原瓶保留。';
  const state = s.prophecyMaster;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < PROPHECY_MASTER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的预言大师原瓶。';
    return s.cash < PROPHECY_MASTER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批预言大师原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的预言大师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选预言大师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PROPHECY_MASTER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyProphecyMasterAcquisition(s: SliceState, command: ProphecyMasterAcquisitionCommand, ctx: SeerContext): void {
  const reason = prophecyMasterAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.prophecyMaster;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= PROPHECY_MASTER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取预言大师独立成品与专业准备指导', `花1行动、500便士。${PROPHECY_MASTER_GUIDE}说明原渠道记录。${PROPHECY_MASTER_FORMULA_STATUS}${PROPHECY_MASTER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = PROPHECY_MASTER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原神秘学家晋升周${s.mystic.promotionWeek}、已归还的原血样及本人既往故事研究和公开记录；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= PROPHECY_MASTER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(PROPHECY_MASTER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('预言大师独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、免费故事、命运之蛇血、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批预言大师成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < PROPHECY_MASTER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`prophecy-master-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶预言大师原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.mysticActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of PROPHECY_MASTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为预言大师', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；神秘学家消化100与全部旧掌握保留，唯一新能力hermit.s3.prophetic-glimpse掌握从0开始。灵性上限120，当前不补满；原眼镜、原卷和本人已知故事不补发。窥秘人至神秘学家的全部原瓶、劳务、原物、原滴与原敌伤势或死亡均保留；原故事已公开的105名知情者与15%效力不会回收，不送新故事库或命运血能力，不具备贤者2的信息化或阻止高位灾难仪式。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '预言大师魔药严重排异' : '预言大师魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为神秘学家，旧消化、掌握、原故事与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyProphecyMasterCommand(s: SliceState, command: ProphecyMasterCommand, ctx: SeerContext): void {
  if (!validateProphecyMasterCommand(command)) throw new Error('预言大师命令无效。');
  if (validateProphecyMasterAcquisitionCommand(command)) return applyProphecyMasterAcquisition(s, command, ctx);
  if (validateProphecyMasterActivityCommand(command)) return applyProphecyMasterActivity(s, command, ctx);
  if (validateProphecyMasterEncounterCommand(command)) return applyProphecyMasterEncounterCommand(s, command, ctx);
  throw new Error('未知预言大师命令。');
}

export function projectProphecyMaster(s: SliceState): ProphecyMasterProjection {
  const state = s.prophecyMaster, available = knownChannel(s), promoted = hasProphecyMasterHistory(s), actions: ProphecyMasterAction[] = [];
  const add = (id: string, label: string, cost: string, command: ProphecyMasterAcquisitionCommand) => { const reason = prophecyMasterAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-prophecy-master-guidance', '听取预言大师成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of PROPHECY_MASTER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`prophecy-master-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-prophecy-master-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-prophecy-master-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-prophecy-master-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-prophecy-master-supply', '申请下一批独立预言大师成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${PROPHECY_MASTER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶预言大师魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 神秘学家消化${s.progression.acting}/100 · ${mysticWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: ProphecyMasterAction[] = available ? [...actions, ...prophecyMasterLifeActions(s), ...prophecyMasterEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '预言大师·隐者序列3（有限预兆G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${PROPHECY_MASTER_FORMULA_STATUS}${PROPHECY_MASTER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完神秘学家之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 预言大师成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为神秘学家' : '排异，仍为神秘学家'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? PROPHECY_MASTER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? PROPHECY_MASTER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? prophecyMasterActing(s) : 0, digestion: promoted ? `神秘学家消化${state.mysticActingAtPromotion}/100留存；预言大师扮演${prophecyMasterActing(s)}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `神秘学家需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${mysticWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完神秘学家之路。',
    pollution: s.seer.pollution, risk: available ? PROPHECY_MASTER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `原厚镜片眼镜SM5-LENS-1：${s.starMystic.practice.lenses}。旧工坊现有原卷${s.scrollProfessor.workshop.scrolls.filter(scroll => scroll.status === 'HELD').length}张、已耗${s.scrollProfessor.workshop.scrolls.filter(scroll => scroll.status === 'USED').length}张；全部原材料、制作序列与刻录掌握保持，使用仍须实际消耗本人现存且已授权的同一原卷。` : '',
    inheritedHistory: available ? [
      `神秘学家第${s.mystic.promotionWeek}周真实晋升；${promoted ? `原消化${state.mysticActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '窥秘人、格斗学者、巫师、卷轴教授、星象师与神秘学家的全部原ID、掌握、原瓶、原材料、原物、许可与拒绝记录保留，旧掌握0仍为0。新预言需要解释和后续核实，不自动写入真相。',
      `原滴${s.mystic.ritual.sample.id}：${s.mystic.ritual.sample.status}，既有分析与归还记录保留。命运之蛇血是嘉德丽雅的个别准备，不成为本次通用3阶仪式或新免费能力；不再要求另一滴。`,
      `原故事${s.mystic.life.story.id}：实际知情者${s.mystic.life.story.readerIds.length}人，${s.mystic.life.publicDisclosed ? '已经公开，后续迟钟回声效力仍为15%，不能回收他人已知信息' : '尚未公开，仍按原访问范围和实际已学内容使用'}；不附赠新的神秘再现故事库。`,
      `原卢坎${s.mystic.encounter.targetId}：${s.mystic.encounter.enemyStatus}，健康${s.mystic.encounter.enemyHealth}/100、精神${s.mystic.encounter.enemyMind}/100、灵性${s.mystic.encounter.enemySpirituality}，原伤势${s.mystic.encounter.enemyInjuries.length}处；晋升和离场不治疗、重开或复活旧对手。`,
    ] : [],
    life: projectProphecyMasterLife(s), encounter: projectProphecyMasterEncounter(s), insideCase: hasProphecyMasterLock(s),
    environment: available ? '原创G仓库PM3-WAREHOUSE的三处有限原场：本人从START到A实际步行6米，A到B普通侧路12米，返程按同一路径逐段实际走回。原排班册、原铃、800克封包、原签收、原遮帘与封存教学件均各有实体和位置；借还原页、参与者逐案同意和普通核验不由预兆代办，0行动收束不传送。全部新人物、范围、成本、道具与具体情节均为G。' : '',

  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateProphecyMasterState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.prophecyMaster;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'mysticActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as ProphecyMasterState, promoted = hasProphecyMasterHistory(s), firstWeek = s.mystic.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + PROPHECY_MASTER_MIN_MYSTIC_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !PROPHECY_MASTER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasProphecyMasterOldPractice(s) || hasProphecyMasterLifeLock(s) || hasProphecyMasterEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.mystic.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.mysticActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS, ...MYSTIC_ABILITY_IDS, ...PROPHECY_MASTER_ABILITY_IDS, ...(s.progression.sequence === 2 ? SAGE_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.mysticActingAtPromotion !== null || PROPHECY_MASTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `prophecy-master-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== PROPHECY_MASTER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.mystic.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateProphecyMasterLife(s) && validateProphecyMasterEncounter(s);
}
export { PROPHECY_MASTER_ABILITIES } from './content.js';
export { PROPHECY_MASTER_ABILITY_IDS } from './types.js';
export type * from './types.js';
