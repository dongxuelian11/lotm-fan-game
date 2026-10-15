import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { WinnerLuck } from '../winner/types.js';
import { MONSTER_ABILITY_IDS } from '../monster/types.js';
import { MACHINE_ABILITY_IDS } from '../machine/types.js';
import { LUCKY_ABILITY_IDS } from '../lucky/types.js';
import { CALAMITY_PRIEST_ABILITY_IDS } from '../calamity-priest/types.js';
import { WINNER_ABILITY_IDS } from '../winner/types.js';
import { MISFORTUNE_MAGE_ABILITY_IDS } from '../misfortune-mage/types.js';
import { monsterInside } from '../monster/life.js';
import { machineInside } from '../machine/life.js';
import { calamityPriestInside } from '../calamity-priest/life.js';
import { winnerInside } from '../winner/life.js';
import { hasMisfortuneMageLifeLock } from '../misfortune-mage/life.js';
import { hasMisfortuneMageEncounterLock } from '../misfortune-mage/encounter.js';
import { createChaosWalkerLifeState, applyChaosWalkerActivity, projectChaosWalkerLife, chaosWalkerLifeActions, validateChaosWalkerLife, validateChaosWalkerActivityCommand, hasChaosWalkerLifeLock } from './life.js';
import { createChaosWalkerEncounterState, applyChaosWalkerEncounterCommand, projectChaosWalkerEncounter, chaosWalkerEncounterActions, validateChaosWalkerEncounter, validateChaosWalkerEncounterCommand, hasChaosWalkerEncounterLock } from './encounter.js';
import { CHAOS_WALKER_ABILITIES, CHAOS_WALKER_BOTTLE_IDS, CHAOS_WALKER_CONSUMPTION_RISK, CHAOS_WALKER_FORMULA_STATUS, CHAOS_WALKER_GUIDE, CHAOS_WALKER_LABOUR_STEPS, CHAOS_WALKER_LABOUR_TASKS, CHAOS_WALKER_MIN_MISFORTUNE_MAGE_WEEKS, CHAOS_WALKER_POTION_SOURCES, CHAOS_WALKER_PREPARATIONS, CHAOS_WALKER_PRICES, CHAOS_WALKER_SOURCE_STATUS } from './content.js';
import { CHAOS_WALKER_ABILITY_IDS, CHAOS_WALKER_PREPARATION_IDS, type ChaosWalkerAcquisitionCommand, type ChaosWalkerAction, type ChaosWalkerBottle, type ChaosWalkerCommand, type ChaosWalkerProjection, type ChaosWalkerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): ChaosWalkerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createChaosWalkerState(): ChaosWalkerState {
  return { guidanceKnown: false, bottles: CHAOS_WALKER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, misfortuneMageActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createChaosWalkerLifeState(), encounter: createChaosWalkerEncounterState() };
}
export const isChaosWalker = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 3;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'wheel' && [4, 3].includes(s.progression.sequence ?? 0)
  && s.monster.discovered && s.monster.guidanceKnown && s.machine.guidanceKnown && s.lucky.guidanceKnown
  && s.calamityPriest.guidanceKnown && s.winner.guidanceKnown && s.misfortuneMage.guidanceKnown && s.misfortuneMage.promotionWeek !== null;
/** Old history stays owned by its original stage; unfinished original scenes must really be closed. */
export const hasChaosWalkerOldPractice = (s: SliceState): boolean => monsterInside(s) || machineInside(s)
  || Object.values(s.lucky.cases).some(value => value.contactOpen) || calamityPriestInside(s) || winnerInside(s)
  || hasMisfortuneMageLifeLock(s) || hasMisfortuneMageEncounterLock(s)
  || s.calamityPriest.practice.board === 'UNSTABLE' || s.calamityPriest.practice.board === 'FALLEN'
  || s.calamityPriest.practice.contact === 'FOCUSED'
  || s.winner.practice.counter !== 'GUIDE' || s.winner.practice.ring !== 'OWNER' || s.winner.practice.note === 'WRITTEN'
  || s.winner.encounter.status === 'FIGHTING' || s.winner.encounter.staggerReady
  || s.misfortuneMage.life.weight.permission || s.misfortuneMage.life.bag.consented
  || s.misfortuneMage.encounter.staggerReady || s.misfortuneMage.encounter.composureReady
  || [s.monster, s.machine, s.lucky, s.calamityPriest, s.winner].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'))
  || Object.values(s.misfortuneMage.life.cases).some(value => value.status === 'PREPARED');
export const hasChaosWalkerRitualLock = (s: SliceState): boolean => s.chaosWalker.preparedWeek !== null;
export const hasChaosWalkerLock = (s: SliceState): boolean => hasChaosWalkerRitualLock(s) || hasChaosWalkerLifeLock(s) || hasChaosWalkerEncounterLock(s);
const bottleNumber = (b: Pick<ChaosWalkerBottle, 'id'>) => Number(b.id.slice('chaos-walker-potion-'.length));
const potionPrice = (b: ChaosWalkerBottle) => CHAOS_WALKER_PRICES.potion - (b.labourSteps === CHAOS_WALKER_LABOUR_STEPS ? CHAOS_WALKER_PRICES.labourCredit : 0);
const misfortuneMageWeeks = (s: SliceState) => Math.max(0, (s.chaosWalker.promotionWeek ?? s.week) - (s.misfortuneMage.promotionWeek ?? s.week));
const exhaustedSupply = (state: ChaosWalkerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${CHAOS_WALKER_GUIDE}介绍的独立混乱行者成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶chaos-walker-potion-${number}；非厄运法师或更早原瓶改装。混乱行者序列3仍为候选G映射，完整配方和原著晋升仪式未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => CHAOS_WALKER_PREPARATION_IDS.every(id => s.chaosWalker.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `厄运法师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.misfortuneMage.promotionWeek === null || misfortuneMageWeeks(s) < CHAOS_WALKER_MIN_MISFORTUNE_MAGE_WEEKS) return `成为厄运法师后已过${misfortuneMageWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有命运之轮记录核对、有限概率与唯一旧幸运边界核验、普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateChaosWalkerAcquisitionCommand(v: unknown): v is ChaosWalkerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CHAOS_WALKER_PREPARATION_IDS.includes(v.taskId as typeof CHAOS_WALKER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^chaos-walker-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isChaosWalkerAcquisitionCommand = validateChaosWalkerAcquisitionCommand;
export function validateChaosWalkerCommand(v: unknown): v is ChaosWalkerCommand {
  return validateChaosWalkerAcquisitionCommand(v) || validateChaosWalkerActivityCommand(v) || validateChaosWalkerEncounterCommand(v);
}
export function chaosWalkerAcquisitionBlock(s: SliceState, command: ChaosWalkerAcquisitionCommand): string | null {
  if (!validateChaosWalkerAcquisitionCommand(command)) return '混乱行者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasChaosWalkerOldPractice(s) || hasChaosWalkerLifeLock(s) || hasChaosWalkerEncounterLock(s)) return '先实际结束旧接触、演练、待生效影响，归还原物并收束旧准备和当前实践；旧人物、伤势与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原报时铺旁CW3-QUIET-ROOM独立安静房间。';
  if (!knownChannel(s)) return '实际成为厄运法师并保留原指导渠道后，才能了解混乱行者之路。';
  if (isChaosWalker(s)) return '已经真实晋升混乱行者3，不能重复准备或服药；未服原瓶保留。';
  const state = s.chaosWalker;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < CHAOS_WALKER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的混乱行者原瓶。';
    return s.cash < CHAOS_WALKER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批混乱行者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的混乱行者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选混乱行者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CHAOS_WALKER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyChaosWalkerAcquisition(s: SliceState, command: ChaosWalkerAcquisitionCommand, ctx: SeerContext): void {
  const reason = chaosWalkerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.chaosWalker;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= CHAOS_WALKER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取混乱行者独立成品与专业准备指导', `花1行动、500便士。${CHAOS_WALKER_GUIDE}说明原渠道记录。${CHAOS_WALKER_FORMULA_STATUS}${CHAOS_WALKER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CHAOS_WALKER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原厄运法师晋升周${s.misfortuneMage.promotionWeek}、原费里斯的实际伤势与结局、原豆袋和原记录纸、唯一winner.luck积累${s.winner.luck.accumulated}与实耗${s.winner.luck.spent}记录；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CHAOS_WALKER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CHAOS_WALKER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('混乱行者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、幸运、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批混乱行者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CHAOS_WALKER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`chaos-walker-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶混乱行者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.misfortuneMageActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of CHAOS_WALKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为混乱行者', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；厄运法师消化100与全部旧掌握保留，新增wheel.s3.deviation-buffer与wheel.s3.future-impediment两项掌握从0开始。灵性上限120，当前不补满；全部六个旧阶段原瓶、劳务、原人物、原物与实战历史保留。原费里斯的伤势、投降或死亡不重开；唯一winner.luck原储备、累计积累、实际支出与上次积累周完全不改，不补满、不复制、不附加等量厄运债。原身体、年龄、性别不变；候选映射与新机制均为G，不授重抽、回溯或必定成功。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '混乱行者魔药严重排异' : '混乱行者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为厄运法师，旧消化、掌握、原人物历史与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyChaosWalkerCommand(s: SliceState, command: ChaosWalkerCommand, ctx: SeerContext): void {
  if (!validateChaosWalkerCommand(command)) throw new Error('混乱行者命令无效。');
  if (validateChaosWalkerAcquisitionCommand(command)) return applyChaosWalkerAcquisition(s, command, ctx);
  if (validateChaosWalkerActivityCommand(command)) return applyChaosWalkerActivity(s, command, ctx);
  if (validateChaosWalkerEncounterCommand(command)) return applyChaosWalkerEncounterCommand(s, command, ctx);
  throw new Error('未知混乱行者命令。');
}

export function projectChaosWalker(s: SliceState): ChaosWalkerProjection {
  const state = s.chaosWalker, available = knownChannel(s), promoted = isChaosWalker(s), actions: ChaosWalkerAction[] = [];
  const add = (id: string, label: string, cost: string, command: ChaosWalkerAcquisitionCommand) => { const reason = chaosWalkerAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-chaos-walker-guidance', '听取混乱行者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of CHAOS_WALKER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`chaos-walker-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-chaos-walker-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-chaos-walker-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-chaos-walker-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-chaos-walker-supply', '申请下一批独立混乱行者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CHAOS_WALKER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶混乱行者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 厄运法师消化${s.progression.acting}/100 · ${misfortuneMageWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: ChaosWalkerAction[] = available ? [...actions, ...chaosWalkerLifeActions(s), ...chaosWalkerEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '混乱行者与有限概率', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${CHAOS_WALKER_FORMULA_STATUS}${CHAOS_WALKER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完厄运法师之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 混乱行者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为厄运法师' : '排异，仍为厄运法师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? CHAOS_WALKER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? CHAOS_WALKER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `厄运法师消化${state.misfortuneMageActingAtPromotion}/100留存；混乱行者扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖成功且真正应用于后续一次物理事件的能力；撤回、取消、失败或未实际应用均不给新掌握。和平100不保证原著安全消化。` : available ? `厄运法师需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${misfortuneMageWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完厄运法师之路。',
    pollution: s.seer.pollution, risk: available ? CHAOS_WALKER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `原MM4-WEIGHT-1砝码与MM4-CORD-1绳由${s.misfortuneMage.life.weight.cordHolder}持有，砝码在${s.misfortuneMage.life.weight.position}；原MM4-BAG-1仍属${s.misfortuneMage.life.bag.owner}，在${s.misfortuneMage.life.bag.position}，既有效果${s.misfortuneMage.life.bag.effectActive ? '尚在' : '已结束'}；原MM4-NOTE-1纸由${s.misfortuneMage.life.note.holder}保管。旧WN5-COUNTER-1、WN5-RING-1与WN5-NOTE-1保留原状态。只有winner.luck可由后续实际积运和施术成本改变；没有新幸运池或晋升赠送。` : '',
    inheritedHistory: available ? [
      `候选厄运法师第${s.misfortuneMage.promotionWeek}周真实晋升；${promoted ? `原消化${state.misfortuneMageActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '怪物、机器、幸运者、灾祸教士、赢家与厄运法师六个阶段的全部原ID、掌握、原瓶、劳务、原人物、原物、许可与拒绝记录保留，旧掌握0仍为0。晋升不修改身份、性别、年龄或原物所有权。',
      `原winner.luck为唯一幸运账本：当前${s.winner.luck.stored}/3、累计积累${s.winner.luck.accumulated}、实耗${s.winner.luck.spent}、上次实际积运周${s.winner.luck.lastAccumulateWeek ?? '尚无'}。晋升不补满，后续每次积运或消耗均留新事实回执，不能重写旧记录。`,
      `原费里斯${s.misfortuneMage.encounter.targetId}：${s.misfortuneMage.encounter.enemyStatus}，健康${s.misfortuneMage.encounter.enemyHealth}/100、精神${s.misfortuneMage.encounter.enemyMind}/100、灵性${s.misfortuneMage.encounter.enemySpirituality}，原伤势${s.misfortuneMage.encounter.enemyInjuries.length}处；原战斗与原奥德里历史保留，晋升和离场不治疗、重开或复活旧对手。`,
    ] : [],
    life: projectChaosWalkerLife(s), encounter: projectChaosWalkerEncounter(s), insideCase: hasChaosWalkerLock(s),
    environment: available ? '原创G原机械试场CW3-WORKSHOP：入口START距原工位A4米，两段独立原轨道各从A延伸4米至B或C并有原软挡块。原车CW3-CART载唯一封存400g原包CW3-PARCEL；原盘CW3-DISC、原预测纸CW3-FORECAST各有唯一主人。39岁成年薇拉·霍尔CW3-VERA自主使用自己的两原签和原袋，施术后当场撤回许可，必须停止输入再由她亲手按普通50%抽取。知识20成功只预备最长30秒的一次有限修正；之后另一个真实物理事件才各取一次新1至100点，75%或25%均可能不如预期。能力5灵性1精神并实耗1份唯一旧幸运，失败、取消、撤回或过期不退。三案全有普通路径，原物实际归还、本人普通行走退出才可报告。完整配方与仪式仍未知，候选序列映射和所有新数值、技能及场景均为G。' : '',

  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateChaosWalkerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.chaosWalker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'misfortuneMageActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as ChaosWalkerState, promoted = isChaosWalker(s), firstWeek = s.misfortuneMage.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CHAOS_WALKER_MIN_MISFORTUNE_MAGE_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CHAOS_WALKER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasChaosWalkerOldPractice(s) || hasChaosWalkerLifeLock(s) || hasChaosWalkerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.misfortuneMage.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.misfortuneMageActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS, ...CALAMITY_PRIEST_ABILITY_IDS, ...WINNER_ABILITY_IDS, ...MISFORTUNE_MAGE_ABILITY_IDS, ...CHAOS_WALKER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.misfortuneMageActingAtPromotion !== null || CHAOS_WALKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `chaos-walker-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== CHAOS_WALKER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.misfortuneMage.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateChaosWalkerLife(s) && validateChaosWalkerEncounter(s) && validateChaosWalkerLuckHistory(s);
}
/** Read-only receipts for the original reserve, never a second spendable pool.
 * Each actual mutation advances accumulated + spent by exactly one. That cumulative
 * ordering also orders same-week scene, accumulation and battle receipts without
 * guessing their RNG results or relying on object insertion order. */
export function validateChaosWalkerLuckHistory(s: SliceState): boolean {
  try {
    const luck = s.winner.luck, life = s.chaosWalker.life;
    const valid = (l: WinnerLuck) => integer(l.stored, 0, 3) && integer(l.accumulated) && integer(l.spent, 0, l.accumulated)
      && l.stored === l.accumulated - l.spent && (l.lastAccumulateWeek === null ? l.accumulated === 0 : integer(l.lastAccumulateWeek, 1, s.week));
    if (!valid(luck)) return false;
    type Point = Pick<WinnerLuck, 'stored' | 'accumulated' | 'spent'> & { lastAccumulateWeek?: number | null };
    type Receipt = { week: number; before: Point; after: Point; kind: 'ACCUMULATE' | 'SPEND' };
    const points: Point[] = [], receipts: Receipt[] = [];
    const equal = (a: Point, b: Point) => a.stored === b.stored && a.accumulated === b.accumulated && a.spent === b.spent
      && (a.lastAccumulateWeek === undefined || b.lastAccumulateWeek === undefined || a.lastAccumulateWeek === b.lastAccumulateWeek);
    const order = (p: Point) => p.accumulated + p.spent;
    const snapshot = (l: WinnerLuck): Point => ({ ...l });
    let newSpent = 0;
    for (const r of life.accumulations) receipts.push({ week: r.week, kind: 'ACCUMULATE',
      before: { stored: r.storedBefore, accumulated: r.accumulatedAfter - 1, spent: r.spentAtTime },
      after: { stored: r.storedAfter, accumulated: r.accumulatedAfter, spent: r.spentAtTime, lastAccumulateWeek: r.week } });
    for (const scene of Object.values(life.cases)) for (const a of scene.attempts) {
      if (!valid(a.initialLuck)) return false;
      points.push(snapshot(a.initialLuck));
      if (a.luckSpent) {
        if (a.luckSpent !== 1 || !a.luckBefore || !a.luckAfter || !valid(a.luckBefore) || !valid(a.luckAfter)) return false;
        receipts.push({ week: a.week, kind: 'SPEND', before: snapshot(a.luckBefore), after: snapshot(a.luckAfter) }); newSpent++;
      } else if (a.luckBefore !== null || a.luckAfter !== null) return false;
    }
    for (const round of s.combatHistory) {
      const o = round.chaosWalkerOutcome; if (!o) continue;
      const before: WinnerLuck = { stored: o.source.luckStored, accumulated: o.source.luckAccumulated, spent: o.source.luckSpent, lastAccumulateWeek: o.source.lastAccumulateWeek };
      const after: WinnerLuck = { ...before, stored: o.luckStoredAfter, spent: o.luckSpentAfter };
      if (!valid(before) || !valid(after)) return false;
      points.push(snapshot(before), snapshot(after));
      const paid = o.playerActions.reduce((n, a) => n + a.luckCost, 0);
      if (paid === 1) { receipts.push({ week: o.source.week, kind: 'SPEND', before: snapshot(before), after: snapshot(after) }); newSpent++; }
      else if (paid !== 0 || !equal(before, after)) return false;
    }
    receipts.sort((a, b) => order(a.before) - order(b.before));
    let previous: Receipt | undefined;
    for (const r of receipts) {
      if (!integer(r.week, s.chaosWalker.promotionWeek ?? s.week, s.week) || order(r.after) !== order(r.before) + 1) return false;
      if (r.kind === 'SPEND' ? r.after.spent !== r.before.spent + 1 || r.after.accumulated !== r.before.accumulated || r.after.stored !== r.before.stored - 1
        : r.after.accumulated !== r.before.accumulated + 1 || r.after.spent !== r.before.spent || r.after.stored !== r.before.stored + 1) return false;
      if (previous && (r.week < previous.week || !equal(previous.after, r.before))) return false;
      if (r.kind === 'ACCUMULATE' && previous?.after.lastAccumulateWeek !== undefined && previous.after.lastAccumulateWeek !== null && previous.after.lastAccumulateWeek >= r.week) return false;
      previous = r;
    }
    if (previous && !equal(previous.after, luck)) return false;
    // Every initial scene or round snapshot must be one real state along that same chain.
    const chain: Point[] = receipts.length ? [receipts[0]!.before, ...receipts.map(r => r.after)] : [luck];
    if (points.some(p => !chain.some(c => equal(p, c)))) return false;
    const oldWinnerLife = Object.values(s.winner.cases).filter(c => c.method === 'ABILITY' && c.attemptWeek !== null && c.status !== 'PREPARED').length;
    const oldWinnerCombat = s.combatHistory.reduce((n, r) => n + r.moves.filter(m => m.actor === 'PLAYER' && ['有限好运自保：', '有限敌方厄运成功：', '有限敌方厄运失败：'].some(prefix => m.label.startsWith(prefix))).length, 0);
    const oldMageLife = Object.values(s.misfortuneMage.life.cases).reduce((n, c) => n + c.attempts.reduce((m, a) => m + a.luckSpent, 0), 0);
    const oldMageCombat = s.combatHistory.reduce((n, r) => n + (r.misfortuneMageOutcome?.playerActions.reduce((m, a) => m + a.luckCost, 0) ?? 0), 0);
    if (luck.spent < oldWinnerLife + oldWinnerCombat + oldMageLife + oldMageCombat + newSpent || luck.accumulated < life.accumulations.length) return false;
    // Frozen older receipts cannot postdate or exceed the first new mutation's source.
    const baseline = receipts[0]?.before ?? luck;
    for (const r of s.misfortuneMage.life.accumulations) if (r.accumulatedAfter > baseline.accumulated || r.spentAtTime > baseline.spent) return false;
    for (const r of s.combatHistory) if (r.misfortuneMageOutcome && (r.misfortuneMageOutcome.source.luckAccumulated > baseline.accumulated || r.misfortuneMageOutcome.luckSpentAfter > baseline.spent)) return false;
    return true;
  } catch { return false; }
}
export { CHAOS_WALKER_ABILITIES } from './content.js';
export { CHAOS_WALKER_ABILITY_IDS } from './types.js';
export type * from './types.js';
export * from './encounter.js';
export * from './combat.js';
