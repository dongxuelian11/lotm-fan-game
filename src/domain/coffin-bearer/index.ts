import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../biologist/types.js';
import { DRUID_ABILITY_IDS } from '../druid/types.js';
import { ANCIENT_ALCHEMIST_ABILITY_IDS } from '../ancient-alchemist/types.js';
import { hasBiologistOpenPractice } from '../biologist/encounter.js';
import { druidInside } from '../druid/life.js';
import { hasAncientAlchemistLifeLock } from '../ancient-alchemist/life.js';
import { hasAncientAlchemistEncounterLock } from '../ancient-alchemist/encounter.js';
import { createCoffinBearerLifeState, applyCoffinBearerActivity, projectCoffinBearerLife, coffinBearerLifeActions, validateCoffinBearerLife, validateCoffinBearerActivityCommand, hasCoffinBearerLifeLock } from './life.js';
import { createCoffinBearerEncounterState, applyCoffinBearerEncounterCommand, projectCoffinBearerEncounter, coffinBearerEncounterActions, validateCoffinBearerEncounter, validateCoffinBearerEncounterCommand, hasCoffinBearerEncounterLock } from './encounter.js';
import { COFFIN_BEARER_ABILITIES, COFFIN_BEARER_BOTTLE_IDS, COFFIN_BEARER_CONSUMPTION_RISK, COFFIN_BEARER_FORMULA_STATUS, COFFIN_BEARER_GUIDE, COFFIN_BEARER_LABOUR_STEPS, COFFIN_BEARER_LABOUR_TASKS, COFFIN_BEARER_MIN_ANCIENT_ALCHEMIST_WEEKS, COFFIN_BEARER_POTION_SOURCES, COFFIN_BEARER_PREPARATIONS, COFFIN_BEARER_PRICES, COFFIN_BEARER_SOURCE_STATUS } from './content.js';
import { COFFIN_BEARER_ABILITY_IDS, COFFIN_BEARER_PREPARATION_IDS, type CoffinBearerAcquisitionCommand, type CoffinBearerAction, type CoffinBearerBottle, type CoffinBearerCommand, type CoffinBearerProjection, type CoffinBearerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): CoffinBearerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createCoffinBearerState(): CoffinBearerState {
  return { guidanceKnown: false, bottles: COFFIN_BEARER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, ancientAlchemistActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createCoffinBearerLifeState(), encounter: createCoffinBearerEncounterState() };
}
export const isCoffinBearer = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 3;
export const hasCoffinBearerHistory = (s: SliceState) => s.progression.pathwayId === 'mother' && [3,2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'mother' && [4, 3, 2].includes(s.progression.sequence ?? 0)
  && s.cultivator.discovered && s.cultivator.guidanceKnown && s.physician.guidanceKnown && s.harvestpriest.guidanceKnown
  && s.biologist.guidanceKnown && s.druid.guidanceKnown && s.ancientAlchemist.guidanceKnown && s.ancientAlchemist.promotionWeek !== null;
/** Older people, originals and history are owned by their original stage. */
export const hasCoffinBearerOldPractice = (s: SliceState): boolean => hasBiologistOpenPractice(s)
  || druidInside(s) || hasAncientAlchemistLifeLock(s) || hasAncientAlchemistEncounterLock(s)
  || s.biologist.encounter.status === 'FIGHTING' || s.druid.encounter.status === 'FIGHTING'
  || s.druid.practice.marker !== 'BOX' || s.druid.practice.seedlings !== 'RESTING' || s.druid.practice.note === 'WRITTEN'
  || s.ancientAlchemist.encounter.guardReady !== null
  || s.ancientAlchemist.life.matrices.some(matrix => matrix.state === 'ACTIVE' || matrix.remainingSeconds > 0)
  || [s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'))
  || Object.values(s.ancientAlchemist.life.cases).some(value => value.status === 'PREPARED');
export const hasCoffinBearerRitualLock = (s: SliceState): boolean => s.coffinBearer.preparedWeek !== null;
export const hasCoffinBearerLock = (s: SliceState): boolean => hasCoffinBearerRitualLock(s) || hasCoffinBearerLifeLock(s) || hasCoffinBearerEncounterLock(s);
const bottleNumber = (b: Pick<CoffinBearerBottle, 'id'>) => Number(b.id.slice('coffin-bearer-potion-'.length));
const potionPrice = (b: CoffinBearerBottle) => COFFIN_BEARER_PRICES.potion - (b.labourSteps === COFFIN_BEARER_LABOUR_STEPS ? COFFIN_BEARER_PRICES.labourCredit : 0);
const ancientAlchemistWeeks = (s: SliceState) => Math.max(0, (s.coffinBearer.promotionWeek ?? s.week) - (s.ancientAlchemist.promotionWeek ?? s.week));
const exhaustedSupply = (state: CoffinBearerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${COFFIN_BEARER_GUIDE}介绍的独立抬棺人成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶coffin-bearer-potion-${number}；非古代炼金师或更早原瓶改装。抬棺人序列3名称与编号有直接原核，完整配方和原著晋升仪式未披露，专业准备另行实际完成且全部为G。`;
const hasPreparations = (s: SliceState) => COFFIN_BEARER_PREPARATION_IDS.every(id => s.coffinBearer.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `古代炼金师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.ancientAlchemist.promotionWeek === null || ancientAlchemistWeeks(s) < COFFIN_BEARER_MIN_ANCIENT_ALCHEMIST_WEEKS) return `成为古代炼金师后已过${ancientAlchemistWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有母亲路线记录核对、有限活性与当前许可边界核验、普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateCoffinBearerAcquisitionCommand(v: unknown): v is CoffinBearerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && COFFIN_BEARER_PREPARATION_IDS.includes(v.taskId as typeof COFFIN_BEARER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^coffin-bearer-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isCoffinBearerAcquisitionCommand = validateCoffinBearerAcquisitionCommand;
export function validateCoffinBearerCommand(v: unknown): v is CoffinBearerCommand {
  return validateCoffinBearerAcquisitionCommand(v) || validateCoffinBearerActivityCommand(v) || validateCoffinBearerEncounterCommand(v);
}
export function coffinBearerAcquisitionBlock(s: SliceState, command: CoffinBearerAcquisitionCommand): string | null {
  if (!validateCoffinBearerAcquisitionCommand(command)) return '抬棺人准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasCoffinBearerOldPractice(s) || hasCoffinBearerLifeLock(s) || hasCoffinBearerEncounterLock(s)) return '先实际结束旧接触、演练、待生效影响，归还原物并收束旧准备和当前实践；旧人物、伤势与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原苗圃旁CB3-QUIET-ROOM独立安静房间。';
  if (!knownChannel(s)) return '实际成为古代炼金师并保留原指导渠道后，才能了解抬棺人之路。';
  if (hasCoffinBearerHistory(s)) return '已经真实晋升抬棺人3，不能重复准备或服药；未服原瓶保留。';
  const state = s.coffinBearer;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < COFFIN_BEARER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的抬棺人原瓶。';
    return s.cash < COFFIN_BEARER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批抬棺人原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的抬棺人准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选抬棺人独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= COFFIN_BEARER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyCoffinBearerAcquisition(s: SliceState, command: CoffinBearerAcquisitionCommand, ctx: SeerContext): void {
  const reason = coffinBearerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.coffinBearer;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= COFFIN_BEARER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取抬棺人独立成品与专业准备指导', `花1行动、500便士。${COFFIN_BEARER_GUIDE}说明原渠道记录。${COFFIN_BEARER_FORMULA_STATUS}${COFFIN_BEARER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = COFFIN_BEARER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原古代炼金师晋升周${s.ancientAlchemist.promotionWeek}、原奥斯里克${s.ancientAlchemist.encounter.targetId}的实际伤势与${s.ancientAlchemist.encounter.enemyStatus}结局、原活茎原盆、惰性基质、原报告和旧护腕各段；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= COFFIN_BEARER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(COFFIN_BEARER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('抬棺人独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、原物、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批抬棺人成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < COFFIN_BEARER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`coffin-bearer-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶抬棺人原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.ancientAlchemistActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of COFFIN_BEARER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为抬棺人', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；古代炼金师消化100与全部旧掌握保留，只新增mother.s3.finite-preservation一项掌握从0开始。灵性上限120，当前不补满；全部六个旧阶段原瓶、劳务、原人物、原物与实战历史保留。原奥斯里克的伤势、原灵性与实际投降不重开；原AA4-STEM-1活茎、AA4-POT-1原盆、已失活基质、已交诺拉的原报告和原AA4护腕及三段状态全部不改，不返能、不移动或复制。原身体、年龄、性别不变；序列3名称编号有原核，新机制均为G，不授复活、造魂、死人操纵或棺材免死。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '抬棺人魔药严重排异' : '抬棺人魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为古代炼金师，旧消化、掌握、原人物历史与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyCoffinBearerCommand(s: SliceState, command: CoffinBearerCommand, ctx: SeerContext): void {
  if (!validateCoffinBearerCommand(command)) throw new Error('抬棺人命令无效。');
  if (validateCoffinBearerAcquisitionCommand(command)) return applyCoffinBearerAcquisition(s, command, ctx);
  if (validateCoffinBearerActivityCommand(command)) return applyCoffinBearerActivity(s, command, ctx);
  if (validateCoffinBearerEncounterCommand(command)) return applyCoffinBearerEncounterCommand(s, command, ctx);
  throw new Error('未知抬棺人命令。');
}

export function projectCoffinBearer(s: SliceState): CoffinBearerProjection {
  const state = s.coffinBearer, available = knownChannel(s), promoted = hasCoffinBearerHistory(s), actions: CoffinBearerAction[] = [];
  const add = (id: string, label: string, cost: string, command: CoffinBearerAcquisitionCommand) => { const reason = coffinBearerAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-coffin-bearer-guidance', '听取抬棺人成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of COFFIN_BEARER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`coffin-bearer-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-coffin-bearer-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-coffin-bearer-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-coffin-bearer-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-coffin-bearer-supply', '申请下一批独立抬棺人成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${COFFIN_BEARER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶抬棺人魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 古代炼金师消化${s.progression.acting}/100 · ${ancientAlchemistWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: CoffinBearerAction[] = available ? [...actions, ...coffinBearerLifeActions(s), ...coffinBearerEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '抬棺人与有限活性转运', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${COFFIN_BEARER_FORMULA_STATUS}${COFFIN_BEARER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完古代炼金师之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 抬棺人成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为古代炼金师' : '排异，仍为古代炼金师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? COFFIN_BEARER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? COFFIN_BEARER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===2?s.barrenMatriarch.coffinBearerActingAtPromotion??100:s.progression.acting) : 0, digestion: promoted ? `古代炼金师消化${state.ancientAlchemistActingAtPromotion}/100留存；抬棺人扮演${s.progression.sequence===2?s.barrenMatriarch.coffinBearerActingAtPromotion:s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖fresh-transfer成功且真实限时保全、原样实际交付后的报告8、最大8；撤回、枯样、普通、失败或未实际交付均不给新掌握。和平100不保证原著安全消化。` : available ? `古代炼金师需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${ancientAlchemistWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完古代炼金师之路。',
    pollution: s.seer.pollution, risk: available ? COFFIN_BEARER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `旧原活茎${s.ancientAlchemist.life.stem.id}仍在${s.ancientAlchemist.life.stem.potId}原盆、${s.ancientAlchemist.life.stem.position}原处，由${s.ancientAlchemist.life.stem.holder}保管，损伤状态${s.ancientAlchemist.life.stem.damage}；原${s.ancientAlchemist.life.record.id}报告由${s.ancientAlchemist.life.record.holder}持有。旧护腕${s.ancientAlchemist.life.guards.map(g => `${g.id}由${g.holder}持有，三原段已耗${g.segments.filter(x => x.spentWeek !== null).length}/${g.segments.length}`).join('；') || '尚未制作'}；原材料、已用段与惰性原件不移入新库、不复制、不返还灵性。新CB3-GUARD须另以新原材料实际制作。` : '',
    inheritedHistory: available ? [
      `古代炼金师第${s.ancientAlchemist.promotionWeek}周真实晋升；${promoted ? `原消化${state.ancientAlchemistActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '耕种者、医师、丰收祭司、生物学家、德鲁伊与古代炼金师六个阶段的全部原ID、掌握、原瓶、劳务、原人物、原物、许可与拒绝记录全字段冻结，旧掌握0仍为0。晋升不修改身份、性别、年龄或原物所有权。',
      `原奥斯里克${s.ancientAlchemist.encounter.targetId}：${s.ancientAlchemist.encounter.enemyStatus}，健康${s.ancientAlchemist.encounter.enemyHealth}/100、精神${s.ancientAlchemist.encounter.enemyMind}/100、灵性${s.ancientAlchemist.encounter.enemySpirituality}，原伤势${s.ancientAlchemist.encounter.enemyInjuries.length}处（轻伤${s.ancientAlchemist.encounter.enemyInjuries.filter(i => i.severity === 'LIGHT').length}、重伤${s.ancientAlchemist.encounter.enemyInjuries.filter(i => i.severity === 'HEAVY').length}），累计风险${s.ancientAlchemist.encounter.enemyRisk}；实际弧光${s.ancientAlchemist.encounter.powerUses.ARC_BOLT}次、护术${s.ancientAlchemist.encounter.powerUses.WARD}次、普通整理${s.ancientAlchemist.encounter.powerUses.COMPOSE}次，旧护腕实际尝试${s.ancientAlchemist.encounter.guardAttempts}次。原战斗与旧马伦历史保留，晋升和离场不治疗、重开或复活旧对手。`,
      `原AA4-STEM-1与原AA4-POT-1仍由原导师伊芙·莫兰保管，原AA4-RECORD-1仍在${s.ancientAlchemist.life.record.holder}。新CB3-LIVE-1、CB3-LIVE-2与CB3-DRY-1是各有原培养或自然枯萎记录的不同原样本；新CB3-ADA艾达、CB3-LENA莉娜和原敌CB3-NOLAN诺兰各有自己的身体，不是旧原人换皮。`,
    ] : [],
    life: projectCoffinBearerLife(s), encounter: projectCoffinBearerEncounter(s), insideCase: hasCoffinBearerLock(s),
    environment: available ? '原创G净空原苗圃转运路线：START至A4米、A至B4米，均普通步行；46岁成年自主苗圃所有者CB3-ADA艾达·芬恩在A，39岁成年自主接收照料者CB3-LENA莉娜·肖在B，健康和精神各100，当前许可可撤回。两个不同原活盆CB3-LIVE-1/2各0.5千克、原活性50/100，原枯样CB3-DRY-1为0.1千克、活性0且不复活。唯一原转运匣CB3-CASE仅承重1千克且容一个样本，原观察牌CB3-TAG及三片原衬片须另付1行动90便士真实购入；原纸CB3-RECORD永久固定三个样本ID。能力1行动5灵性2精神及一原衬片、知识20四档，成功只保全60秒，把本次暴露衰减由每10秒1点减慢为每20秒1点，不增加原活性或改变死亡；失败照付。枯样只可普通记录。每案原人实际携同一原样往返，当前拒绝就停止未用效果并交还艾达；成功交给莉娜后由她正式照料，停止本批测试计时，不赠活性。原匣、牌和用后惰性片实际交还，不能离开时瞬移归物。完整配方、仪式与本阶原著新增能力未知，全部新增玩法、物件、人物和数值均G。' : '', 


  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateCoffinBearerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.coffinBearer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'ancientAlchemistActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as CoffinBearerState, promoted = hasCoffinBearerHistory(s), firstWeek = s.ancientAlchemist.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + COFFIN_BEARER_MIN_ANCIENT_ALCHEMIST_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !COFFIN_BEARER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasCoffinBearerOldPractice(s) || hasCoffinBearerLifeLock(s) || hasCoffinBearerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.ancientAlchemist.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.ancientAlchemistActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS, ...ANCIENT_ALCHEMIST_ABILITY_IDS, ...COFFIN_BEARER_ABILITY_IDS,...(s.progression.sequence===2?BARREN_MATRIARCH_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.ancientAlchemistActingAtPromotion !== null || COFFIN_BEARER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `coffin-bearer-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== COFFIN_BEARER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.ancientAlchemist.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateCoffinBearerLife(s) && validateCoffinBearerEncounter(s);
}
export { COFFIN_BEARER_ABILITIES } from './content.js';
export { COFFIN_BEARER_ABILITY_IDS } from './types.js';
export type * from './types.js';
export * from './encounter.js';
export * from './combat.js';
