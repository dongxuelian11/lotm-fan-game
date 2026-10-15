import { WRITER_ABILITY_IDS } from '../writer/types.js';
import { DREAM_WEAVER_ABILITY_IDS } from '../dream-weaver/types.js';
import { hasDreamWeaverLock } from '../dream-weaver/index.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../audience/types.js';
import { MINDREADER_ABILITY_IDS } from '../mindreader/types.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../psychologist/types.js';
import { HYPNOTIST_ABILITY_IDS } from '../hypnotist/types.js';
import { DREAMWALKER_ABILITY_IDS } from '../dreamwalker/types.js';
import { MANIPULATOR_ABILITY_IDS } from '../manipulator/types.js';
import { hasManipulatorRitualLock } from '../manipulator/ritual.js';
import { manipulatorInside } from '../manipulator/life.js';
import { isInsideManipulatorEncounter } from '../manipulator/encounter.js';
import { dreamwalkerInside } from '../dreamwalker/life.js';
import { createDiscernerLifeState, applyDiscernerActivity, projectDiscernerLife, discernerLifeActions, validateDiscernerLifeState, validateDiscernerActivityCommand, hasDiscernerLifeLock } from './life.js';
import { createDiscernerEncounterState, applyDiscernerEncounterCommand, projectDiscernerEncounter, discernerEncounterActions, validateDiscernerEncounter, validateDiscernerEncounterCommand, hasDiscernerEncounterLock } from './encounter.js';
import { DISCERNER_ABILITIES, DISCERNER_BOTTLE_IDS, DISCERNER_CONSUMPTION_RISK, DISCERNER_FORMULA_STATUS, DISCERNER_GUIDE, DISCERNER_LABOUR_STEPS, DISCERNER_LABOUR_TASKS, DISCERNER_MIN_DREAM_WEAVER_WEEKS, DISCERNER_POTION_SOURCES, DISCERNER_PREPARATIONS, DISCERNER_PRICES, DISCERNER_SOURCE_STATUS } from './content.js';
import { DISCERNER_ABILITY_IDS, DISCERNER_PREPARATION_IDS, type DiscernerAcquisitionCommand, type DiscernerAction, type DiscernerBottle, type DiscernerCommand, type DiscernerProjection, type DiscernerState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): DiscernerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createDiscernerState(): DiscernerState {
  return { guidanceKnown: false, bottles: DISCERNER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, dreamWeaverActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createDiscernerLifeState(), encounter: createDiscernerEncounterState() };
}
export const isDiscerner = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 2;
const hasDiscernerHistory = (s: SliceState) => isDiscerner(s) || (s.progression.pathwayId === 'audience' && s.progression.sequence === 1);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'audience' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.audience.discovered && s.dreamWeaver.guidanceKnown && s.dreamWeaver.promotionWeek !== null;
export const hasDiscernerLock = (s: SliceState): boolean => s.discerner.preparedWeek !== null || hasDiscernerLifeLock(s) || hasDiscernerEncounterLock(s);
const bottleNumber = (b: Pick<DiscernerBottle, 'id'>) => Number(b.id.slice('discerner-potion-'.length));
const potionPrice = (b: DiscernerBottle) => DISCERNER_PRICES.potion - (b.labourSteps === DISCERNER_LABOUR_STEPS ? DISCERNER_PRICES.labourCredit : 0);
const dreamWeaverWeeks = (s: SliceState) => Math.max(0, (s.discerner.promotionWeek ?? s.week) - (s.dreamWeaver.promotionWeek ?? s.week));
const exhaustedSupply = (state: DiscernerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${DISCERNER_GUIDE}的独立洞察者成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶discerner-potion-${number}；非织梦人或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => DISCERNER_PREPARATION_IDS.every(id => s.discerner.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `织梦人魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.dreamWeaver.promotionWeek === null || dreamWeaverWeeks(s) < DISCERNER_MIN_DREAM_WEAVER_WEEKS) return `成为织梦人后已过${dreamWeaverWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成路线踏查、原物与本人状态核对、中止返回演练；购买原瓶不能代做专业准备。';
}
export function validateDiscernerAcquisitionCommand(v: unknown): v is DiscernerAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && DISCERNER_PREPARATION_IDS.includes(v.taskId as typeof DISCERNER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^discerner-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isDiscernerAcquisitionCommand = validateDiscernerAcquisitionCommand;
export function validateDiscernerCommand(v: unknown): v is DiscernerCommand {
  return validateDiscernerAcquisitionCommand(v) || validateDiscernerActivityCommand(v) || validateDiscernerEncounterCommand(v);
}
export function discernerAcquisitionBlock(s: SliceState, command: DiscernerAcquisitionCommand): string | null {
  if (!validateDiscernerAcquisitionCommand(command)) return '洞察者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasDreamWeaverLock(s) || hasManipulatorRitualLock(s) || manipulatorInside(s) || isInsideManipulatorEncounter(s) || dreamwalkerInside(s) ||
      Object.values(s.manipulator.life.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.dreamwalker.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      Object.values(s.hypnotist.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      hasDiscernerLifeLock(s) || hasDiscernerEncounterLock(s)) return '先实际收束旧梦境、人格、原物、集会与现场接触，不能同时占用原场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原指导室与核验室。';
  if (!knownChannel(s)) return '实际成为织梦人并保留原指导渠道后，才能了解洞察者之路。';
  if (hasDiscernerHistory(s)) return '已经真实晋升洞察者2，不能重复准备或服药；未服原瓶保留。';
  const state = s.discerner;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < DISCERNER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的洞察者原瓶。';
    return s.cash < DISCERNER_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批洞察者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的洞察者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选洞察者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= DISCERNER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyDiscernerAcquisition(s: SliceState, command: DiscernerAcquisitionCommand, ctx: SeerContext): void {
  const reason = discernerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.discerner;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= DISCERNER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取洞察者独立成品与专业准备指导', `花1行动、500便士。${DISCERNER_GUIDE}说明原渠道记录。${DISCERNER_FORMULA_STATUS}${DISCERNER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = DISCERNER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= DISCERNER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(DISCERNER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('洞察者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠心灵秘密、外部身份、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批洞察者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < DISCERNER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`discerner-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶洞察者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.dreamWeaverActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of DISCERNER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为洞察者', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；织梦人消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；旧人格、七滴泪、万人集会、外部身份经历、原鲁兰与奥斯蒙德不重造或治疗。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '洞察者魔药严重排异' : '洞察者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为织梦人，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyDiscernerCommand(s: SliceState, command: DiscernerCommand, ctx: SeerContext): void {
  if (!validateDiscernerCommand(command)) throw new Error('洞察者命令无效。');
  if (validateDiscernerAcquisitionCommand(command)) return applyDiscernerAcquisition(s, command, ctx);
  if (validateDiscernerActivityCommand(command)) return applyDiscernerActivity(s, command, ctx);
  if (validateDiscernerEncounterCommand(command)) return applyDiscernerEncounterCommand(s, command, ctx);
  throw new Error('未知洞察者命令。');
}

export function projectDiscerner(s: SliceState): DiscernerProjection {
  const state = s.discerner, available = knownChannel(s), promoted = hasDiscernerHistory(s), actions: DiscernerAction[] = [];
  const add = (id: string, label: string, cost: string, command: DiscernerAcquisitionCommand) => { const reason = discernerAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-discerner-guidance', '听取洞察者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of DISCERNER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`discerner-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-discerner-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-discerner-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-discerner-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-discerner-supply', '申请下一批独立洞察者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${DISCERNER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶洞察者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 织梦人消化${s.progression.acting}/100 · ${dreamWeaverWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '洞察者 · 序列2' : '洞察者之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${DISCERNER_FORMULA_STATUS}${DISCERNER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available && s.progression.sequence !== 1 ? [...actions, ...discernerLifeActions(s), ...discernerEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 洞察者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为织梦人' : '排异，仍为织梦人'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? DISCERNER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? DISCERNER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===1?s.writer.discernerActingAtPromotion??100:s.progression.acting) : 0, digestion: promoted ? `织梦人消化${state.dreamWeaverActingAtPromotion}/100留存；洞察者扮演${s.progression.sequence===1?s.writer.discernerActingAtPromotion:s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `织梦人需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${dreamWeaverWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完织梦人之路。',
    pollution: s.seer.pollution, risk: available ? DISCERNER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [`织梦人第${s.dreamWeaver.promotionWeek}周真实晋升；${promoted ? `原消化${state.dreamWeaverActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`, '观众至织梦人全部21项原ID与掌握、原人格和外部身份、七滴泪与集会经历保留；本次不改变身体性别。', `原艾丽丝与欧文、DWV3-MESSAGE原纸和DWV3-BELL原铃均仍在原记录位置；欧文精神${s.dreamWeaver.life.practice.participants['DWV3-OWEN'].mind}/100不免费恢复。`, `原奥斯蒙德：健康${s.dreamWeaver.encounter.enemyHealth}/100、精神${s.dreamWeaver.encounter.enemyMind}/100，原棍DWV3-OSMOND-CLUB保持原持有者与地点，不重造或治疗。`, '三位本案成年人和三张原卡分别拥有独立来源；当次同意和原物手递不沿用旧案。'] : [],
    life: projectDiscernerLife(s), encounter: projectDiscernerEncounter(s), insideCase: hasDiscernerLock(s),
    environment: available ? '贝克兰德有限核验室DCR2-CARD-ROOM，近桌和远桌3米普通通路；本案成年人逐案当前同意，三张原卡各自唯一。全部具体印记、保护媒介、接触条件、时间与费用为原创G，不将印记当客观证词。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateDiscernerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.discerner;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'dreamWeaverActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as DiscernerState, promoted = hasDiscernerHistory(s), firstWeek = s.dreamWeaver.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + DISCERNER_MIN_DREAM_WEAVER_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !DISCERNER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasDiscernerLifeLock(s) || hasDiscernerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.dreamWeaver.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.dreamWeaverActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?WRITER_ABILITY_IDS:[]),...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS, ...DREAMWALKER_ABILITY_IDS, ...MANIPULATOR_ABILITY_IDS, ...DREAM_WEAVER_ABILITY_IDS, ...DISCERNER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.dreamWeaverActingAtPromotion !== null || DISCERNER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `discerner-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== DISCERNER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.dreamWeaver.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateDiscernerLifeState(s) && validateDiscernerEncounter(s);
}
export { DISCERNER_ABILITIES } from './content.js';
export { DISCERNER_ABILITY_IDS } from './types.js';
export type * from './types.js';
