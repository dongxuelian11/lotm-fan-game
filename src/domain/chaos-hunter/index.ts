import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../judge/types.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS } from '../punishment-knight/types.js';
import { IMPERATIVE_MAGE_ABILITY_IDS } from '../imperative-mage/types.js';
import { hasJudgeOpenPractice } from '../judge/encounter.js';
import { punishmentKnightInside } from '../punishment-knight/life.js';
import { hasImperativeMageLifeLock } from '../imperative-mage/life.js';
import { hasImperativeMageEncounterLock } from '../imperative-mage/encounter.js';
import { createChaosHunterLifeState, applyChaosHunterActivity, projectChaosHunterLife, chaosHunterLifeActions, validateChaosHunterLife, validateChaosHunterActivityCommand, hasChaosHunterLifeLock } from './life.js';
import { createChaosHunterEncounterState, applyChaosHunterEncounterCommand, projectChaosHunterEncounter, chaosHunterEncounterActions, validateChaosHunterEncounter, validateChaosHunterEncounterCommand, hasChaosHunterEncounterLock } from './encounter.js';
import { CHAOS_HUNTER_ABILITIES, CHAOS_HUNTER_BOTTLE_IDS, CHAOS_HUNTER_CONSUMPTION_RISK, CHAOS_HUNTER_FORMULA_STATUS, CHAOS_HUNTER_GUIDE, CHAOS_HUNTER_LABOUR_STEPS, CHAOS_HUNTER_LABOUR_TASKS, CHAOS_HUNTER_MIN_IMPERATIVE_MAGE_WEEKS, CHAOS_HUNTER_POTION_SOURCES, CHAOS_HUNTER_PREPARATIONS, CHAOS_HUNTER_PRICES, CHAOS_HUNTER_SOURCE_STATUS } from './content.js';
import { CHAOS_HUNTER_ABILITY_IDS, CHAOS_HUNTER_PREPARATION_IDS, type ChaosHunterAcquisitionCommand, type ChaosHunterAction, type ChaosHunterBottle, type ChaosHunterCommand, type ChaosHunterProjection, type ChaosHunterState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): ChaosHunterBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createChaosHunterState(): ChaosHunterState {
  return { guidanceKnown: false, bottles: CHAOS_HUNTER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, imperativeMageActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createChaosHunterLifeState(), encounter: createChaosHunterEncounterState() };
}
export const isChaosHunter = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 3;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'justiciar' && [4, 3].includes(s.progression.sequence ?? 0)
  && s.arbiter.discovered && s.arbiter.guidanceKnown && s.sheriff.guidanceKnown && s.interrogator.guidanceKnown
  && s.judge.guidanceKnown && s.punishmentKnight.guidanceKnown && s.imperativeMage.guidanceKnown && s.imperativeMage.promotionWeek !== null;
/** Older people, originals and history are owned by their original stage. */
export const hasChaosHunterOldPractice = (s: SliceState): boolean => hasJudgeOpenPractice(s)
  || punishmentKnightInside(s) || hasImperativeMageLifeLock(s) || hasImperativeMageEncounterLock(s)
  || s.judge.encounter.status === 'FIGHTING' || s.punishmentKnight.encounter.status === 'FIGHTING'
  || s.imperativeMage.life.attention.consented || s.imperativeMage.life.partner.consented
  || s.imperativeMage.encounter.intimidationReady || s.imperativeMage.encounter.deprivationReady || s.imperativeMage.encounter.composureReady
  || [s.arbiter, s.sheriff, s.interrogator, s.judge, s.punishmentKnight].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'))
  || Object.values(s.imperativeMage.life.cases).some(value => value.status === 'PREPARED');
export const hasChaosHunterRitualLock = (s: SliceState): boolean => s.chaosHunter.preparedWeek !== null;
export const hasChaosHunterLock = (s: SliceState): boolean => hasChaosHunterRitualLock(s) || hasChaosHunterLifeLock(s) || hasChaosHunterEncounterLock(s);
const bottleNumber = (b: Pick<ChaosHunterBottle, 'id'>) => Number(b.id.slice('chaos-hunter-potion-'.length));
const potionPrice = (b: ChaosHunterBottle) => CHAOS_HUNTER_PRICES.potion - (b.labourSteps === CHAOS_HUNTER_LABOUR_STEPS ? CHAOS_HUNTER_PRICES.labourCredit : 0);
const imperativeMageWeeks = (s: SliceState) => Math.max(0, (s.chaosHunter.promotionWeek ?? s.week) - (s.imperativeMage.promotionWeek ?? s.week));
const exhaustedSupply = (state: ChaosHunterState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${CHAOS_HUNTER_GUIDE}介绍的独立混乱猎手成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶chaos-hunter-potion-${number}；非律令法师或更早原瓶改装。混乱猎手序列3名称与编号有直接原核，完整配方和原著晋升仪式未披露，专业准备另行实际完成且全部为G。`;
const hasPreparations = (s: SliceState) => CHAOS_HUNTER_PREPARATION_IDS.every(id => s.chaosHunter.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `律令法师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.imperativeMage.promotionWeek === null || imperativeMageWeeks(s) < CHAOS_HUNTER_MIN_IMPERATIVE_MAGE_WEEKS) return `成为律令法师后已过${imperativeMageWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有审判者记录核对、双方规则与当前许可边界核验、普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateChaosHunterAcquisitionCommand(v: unknown): v is ChaosHunterAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CHAOS_HUNTER_PREPARATION_IDS.includes(v.taskId as typeof CHAOS_HUNTER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^chaos-hunter-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isChaosHunterAcquisitionCommand = validateChaosHunterAcquisitionCommand;
export function validateChaosHunterCommand(v: unknown): v is ChaosHunterCommand {
  return validateChaosHunterAcquisitionCommand(v) || validateChaosHunterActivityCommand(v) || validateChaosHunterEncounterCommand(v);
}
export function chaosHunterAcquisitionBlock(s: SliceState, command: ChaosHunterAcquisitionCommand): string | null {
  if (!validateChaosHunterAcquisitionCommand(command)) return '混乱猎手准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasChaosHunterOldPractice(s) || hasChaosHunterLifeLock(s) || hasChaosHunterEncounterLock(s)) return '先实际结束旧接触、演练、待生效影响，归还原物并收束旧准备和当前实践；旧人物、伤势与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原调解处旁CH3-QUIET-ROOM独立安静房间。';
  if (!knownChannel(s)) return '实际成为律令法师并保留原指导渠道后，才能了解混乱猎手之路。';
  if (isChaosHunter(s)) return '已经真实晋升混乱猎手3，不能重复准备或服药；未服原瓶保留。';
  const state = s.chaosHunter;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < CHAOS_HUNTER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的混乱猎手原瓶。';
    return s.cash < CHAOS_HUNTER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批混乱猎手原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的混乱猎手准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选混乱猎手独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CHAOS_HUNTER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyChaosHunterAcquisition(s: SliceState, command: ChaosHunterAcquisitionCommand, ctx: SeerContext): void {
  const reason = chaosHunterAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.chaosHunter;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= CHAOS_HUNTER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取混乱猎手独立成品与专业准备指导', `花1行动、500便士。${CHAOS_HUNTER_GUIDE}说明原渠道记录。${CHAOS_HUNTER_FORMULA_STATUS}${CHAOS_HUNTER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CHAOS_HUNTER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原律令法师晋升周${s.imperativeMage.promotionWeek}、原罗温${s.imperativeMage.encounter.targetId}的实际伤势与${s.imperativeMage.encounter.enemyStatus}结局、原阿伦与原埃尔登、原卡原罩原线和原标记片；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CHAOS_HUNTER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CHAOS_HUNTER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('混乱猎手独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、原物、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批混乱猎手成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CHAOS_HUNTER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`chaos-hunter-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶混乱猎手原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.imperativeMageActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of CHAOS_HUNTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为混乱猎手', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；律令法师消化100与全部旧掌握保留，只新增justiciar.s3.bounded-order一项掌握从0开始。灵性上限120，当前不补满；全部六个旧阶段原瓶、劳务、原人物、原物与实战历史保留。原罗温的伤势、原灵性与实际投降不重开；原阿伦和原埃尔登保留独立心智、原位置与已耗灵性，原卡原罩原线和原标记片的所有权、位置与实际历史完全不改，不返能、不移动或复制。原身体、年龄、性别不变；序列3名称编号有原核，新机制均为G，不授追改、传送、永久服从或必定成功。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '混乱猎手魔药严重排异' : '混乱猎手魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为律令法师，旧消化、掌握、原人物历史与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyChaosHunterCommand(s: SliceState, command: ChaosHunterCommand, ctx: SeerContext): void {
  if (!validateChaosHunterCommand(command)) throw new Error('混乱猎手命令无效。');
  if (validateChaosHunterAcquisitionCommand(command)) return applyChaosHunterAcquisition(s, command, ctx);
  if (validateChaosHunterActivityCommand(command)) return applyChaosHunterActivity(s, command, ctx);
  if (validateChaosHunterEncounterCommand(command)) return applyChaosHunterEncounterCommand(s, command, ctx);
  throw new Error('未知混乱猎手命令。');
}

export function projectChaosHunter(s: SliceState): ChaosHunterProjection {
  const state = s.chaosHunter, available = knownChannel(s), promoted = isChaosHunter(s), actions: ChaosHunterAction[] = [];
  const add = (id: string, label: string, cost: string, command: ChaosHunterAcquisitionCommand) => { const reason = chaosHunterAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-chaos-hunter-guidance', '听取混乱猎手成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of CHAOS_HUNTER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`chaos-hunter-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-chaos-hunter-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-chaos-hunter-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-chaos-hunter-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-chaos-hunter-supply', '申请下一批独立混乱猎手成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CHAOS_HUNTER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶混乱猎手魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 律令法师消化${s.progression.acting}/100 · ${imperativeMageWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: ChaosHunterAction[] = available ? [...actions, ...chaosHunterLifeActions(s), ...chaosHunterEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '混乱猎手与有限规则', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${CHAOS_HUNTER_FORMULA_STATUS}${CHAOS_HUNTER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完律令法师之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 混乱猎手成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为律令法师' : '排异，仍为律令法师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? CHAOS_HUNTER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? CHAOS_HUNTER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `律令法师消化${state.imperativeMageActingAtPromotion}/100留存；混乱猎手扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖成功且真正拦停的双方案或本人案，每案8、最大16；撤回案不给新掌握；撤回、取消、失败或未实际应用均不给新掌握。和平100不保证原著安全消化。` : available ? `律令法师需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${imperativeMageWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完律令法师之路。',
    pollution: s.seer.pollution, risk: available ? CHAOS_HUNTER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `旧原阿伦仍在原椅桌旁，既有效果${s.imperativeMage.life.attention.effect}；旧原埃尔登${s.imperativeMage.life.partner.id}仍在${s.imperativeMage.life.partner.position}，原灵性${s.imperativeMage.life.partner.spirituality}/${s.imperativeMage.life.partner.maxSpirituality}，FLASH可用${s.imperativeMage.life.partner.abilityAvailable ? '是' : '否'}。原${s.imperativeMage.life.light.cardId}卡与原${s.imperativeMage.life.light.hoodId}罩由${s.imperativeMage.life.light.holder}保管，在${s.imperativeMage.life.light.positionMetres}米处；原${s.imperativeMage.life.line.id}标线由${s.imperativeMage.life.line.holder}保管，原${s.imperativeMage.life.line.tokenId}标记片由${s.imperativeMage.life.line.tokenHolder}持有。全部旧原物与原人不移入新场，不复制、不返能。` : '',
    inheritedHistory: available ? [
      `律令法师第${s.imperativeMage.promotionWeek}周真实晋升；${promoted ? `原消化${state.imperativeMageActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '仲裁人、治安官、审讯者、法官、惩戒骑士与律令法师六个阶段的全部原ID、掌握、原瓶、劳务、原人物、原物、许可与拒绝记录全字段冻结，旧掌握0仍为0。晋升不修改身份、性别、年龄或原物所有权。',
      `原罗温${s.imperativeMage.encounter.targetId}：${s.imperativeMage.encounter.enemyStatus}，健康${s.imperativeMage.encounter.enemyHealth}/100、精神${s.imperativeMage.encounter.enemyMind}/100、灵性${s.imperativeMage.encounter.enemySpirituality}，原伤势${s.imperativeMage.encounter.enemyInjuries.length}处（轻伤${s.imperativeMage.encounter.enemyInjuries.filter(i => i.severity === 'LIGHT').length}、重伤${s.imperativeMage.encounter.enemyInjuries.filter(i => i.severity === 'HEAVY').length}），累计风险${s.imperativeMage.encounter.enemyRisk}；实际弧光${s.imperativeMage.encounter.powerUses.ARC_BOLT}次、护术${s.imperativeMage.encounter.powerUses.WARD}次、凝神${s.imperativeMage.encounter.powerUses.COMPOSE}次。原战斗与旧埃文历史保留，晋升和离场不治疗、重开或复活旧对手。`,
      `旧自主伙伴${s.imperativeMage.life.partner.id}埃尔登当前原灵性${s.imperativeMage.life.partner.spirituality}/${s.imperativeMage.life.partner.maxSpirituality}，已付原FLASH成本不退；新志愿者CH3-MIRA米拉与新原敌CH3-EDRIC埃德里克各有自己的身体，均不是旧罗温、阿伦或埃尔登换皮。`,
    ] : [],
    life: projectChaosHunterLife(s), encounter: projectChaosHunterEncounter(s), insideCase: hasChaosHunterLock(s),
    environment: available ? '原创G净空标线演练房CH3-LINE-ROOM：START至A4米，A至B空桌4米，没有旁人。43岁成年自主志愿者米拉·佩恩CH3-MIRA有自己的身体、健康100与精神100，通常在A；原导师薇娜亲携唯一350g原包CH3-PARCEL到B放下再返回A，唯一CH3-LINE标条不是墙。原CH3-RULE-PAPER永久写本次从A到B的越线，不追改原文。知识20四档成功只预备20秒内双方各一次待用试走约束，两人之后分别亲身尝试才产生止步或普通走4米的事实；本人不自动豁免，米拉当前许可可撤回。能力5灵性2精神，失败、取消、撤回或过期不退；普通核验无检定无精神灵性成本。已经走过不回滚，同伴自主返A，本人实际取包、带回A并交还原包原纸与标条，伙伴留在A，最后本人与导师沿普通路回START再退出报告。完整配方与仪式未知，新增场景、规则、概率、数值和专业准备均G。' : '', 


  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateChaosHunterState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.chaosHunter;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'imperativeMageActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as ChaosHunterState, promoted = isChaosHunter(s), firstWeek = s.imperativeMage.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CHAOS_HUNTER_MIN_IMPERATIVE_MAGE_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CHAOS_HUNTER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasChaosHunterOldPractice(s) || hasChaosHunterLifeLock(s) || hasChaosHunterEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.imperativeMage.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.imperativeMageActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS, ...IMPERATIVE_MAGE_ABILITY_IDS, ...CHAOS_HUNTER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.imperativeMageActingAtPromotion !== null || CHAOS_HUNTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `chaos-hunter-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== CHAOS_HUNTER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.imperativeMage.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateChaosHunterLife(s) && validateChaosHunterEncounter(s);
}
export { CHAOS_HUNTER_ABILITIES } from './content.js';
export { CHAOS_HUNTER_ABILITY_IDS } from './types.js';
export type * from './types.js';
export * from './encounter.js';
export * from './combat.js';
