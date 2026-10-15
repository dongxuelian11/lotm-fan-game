import { PURE_WHITE_ANGEL_ABILITY_IDS } from '../pure-white-angel/types.js';
import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../notary/types.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS } from '../priest-of-light/types.js';
import { UNSHADOWED_ABILITY_IDS } from '../unshadowed/types.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';
import { notaryInside } from '../notary/life.js';
import { hasUnshadowedRitualLock } from '../unshadowed/ritual.js';
import { hasUnshadowedLifeLock } from '../unshadowed/life.js';
import { hasUnshadowedEncounterLock } from '../unshadowed/encounter.js';
import { createJusticeMentorLifeState, applyJusticeMentorActivity, projectJusticeMentorLife, justiceMentorLifeActions, validateJusticeMentorLife, validateJusticeMentorActivityCommand, hasJusticeMentorLifeLock } from './life.js';
import { createJusticeMentorEncounterState, applyJusticeMentorEncounterCommand, projectJusticeMentorEncounter, justiceMentorEncounterActions, validateJusticeMentorEncounter, validateJusticeMentorEncounterCommand, hasJusticeMentorEncounterLock } from './encounter.js';
import { JUSTICE_MENTOR_ABILITIES, JUSTICE_MENTOR_BOTTLE_IDS, JUSTICE_MENTOR_CONSUMPTION_RISK, JUSTICE_MENTOR_FORMULA_STATUS, JUSTICE_MENTOR_GUIDE, JUSTICE_MENTOR_LABOUR_STEPS, JUSTICE_MENTOR_LABOUR_TASKS, JUSTICE_MENTOR_MIN_UNSHADOWED_WEEKS, JUSTICE_MENTOR_POTION_SOURCES, JUSTICE_MENTOR_PREPARATIONS, JUSTICE_MENTOR_PRICES, JUSTICE_MENTOR_SOURCE_STATUS } from './content.js';
import { JUSTICE_MENTOR_ABILITY_IDS, JUSTICE_MENTOR_PREPARATION_IDS, type JusticeMentorAcquisitionCommand, type JusticeMentorAction, type JusticeMentorBottle, type JusticeMentorCommand, type JusticeMentorProjection, type JusticeMentorState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): JusticeMentorBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createJusticeMentorState(): JusticeMentorState {
  return { guidanceKnown: false, bottles: JUSTICE_MENTOR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, unshadowedActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createJusticeMentorLifeState(), encounter: createJusticeMentorEncounterState() };
}
export const isJusticeMentor = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 3;
export const hasJusticeMentorHistory = (s: SliceState) => s.progression.pathwayId === 'sun' && [3, 2, 1].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'sun' && [4, 3, 2, 1].includes(s.progression.sequence ?? 0) && s.bard.discovered && s.unshadowed.formulaKnown && s.unshadowed.promotionWeek !== null;
export const hasJusticeMentorLock = (s: SliceState): boolean => s.justiceMentor.preparedWeek !== null || hasJusticeMentorLifeLock(s) || hasJusticeMentorEncounterLock(s);
const bottleNumber = (b: Pick<JusticeMentorBottle, 'id'>) => Number(b.id.slice('justice-mentor-potion-'.length));
const potionPrice = (b: JusticeMentorBottle) => JUSTICE_MENTOR_PRICES.potion - (b.labourSteps === JUSTICE_MENTOR_LABOUR_STEPS ? JUSTICE_MENTOR_PRICES.labourCredit : 0);
const unshadowedWeeks = (s: SliceState) => Math.max(0, (s.justiceMentor.promotionWeek ?? s.week) - (s.unshadowed.promotionWeek ?? s.week));
const exhaustedSupply = (state: JusticeMentorState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${JUSTICE_MENTOR_GUIDE}介绍的独立正义导师成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶justice-mentor-potion-${number}；非无暗者或更早原瓶改装。序列3正义导师已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => JUSTICE_MENTOR_PREPARATION_IDS.every(id => s.justiceMentor.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `无暗者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.unshadowed.promotionWeek === null || unshadowedWeeks(s) < JUSTICE_MENTOR_MIN_UNSHADOWED_WEEKS) return `成为无暗者后已过${unshadowedWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成条件核对、边界复核与普通返程演练；购买原瓶不能代做专业准备。';
}
export function validateJusticeMentorAcquisitionCommand(v: unknown): v is JusticeMentorAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && JUSTICE_MENTOR_PREPARATION_IDS.includes(v.taskId as typeof JUSTICE_MENTOR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^justice-mentor-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isJusticeMentorAcquisitionCommand = validateJusticeMentorAcquisitionCommand;
export function validateJusticeMentorCommand(v: unknown): v is JusticeMentorCommand {
  return validateJusticeMentorAcquisitionCommand(v) || validateJusticeMentorActivityCommand(v) || validateJusticeMentorEncounterCommand(v);
}
export function justiceMentorAcquisitionBlock(s: SliceState, command: JusticeMentorAcquisitionCommand): string | null {
  if (!validateJusticeMentorAcquisitionCommand(command)) return '正义导师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasUnshadowedRitualLock(s) || s.unshadowed.ritual.activeVisitId !== null || hasUnshadowedLifeLock(s) || hasUnshadowedEncounterLock(s) ||
      Object.values(s.unshadowed.life.cases).some(v => v.status === 'PREPARED') ||
      hasPriestOfLightOpenPractice(s) || notaryInside(s) ||
      Object.values(s.priestOfLight.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.notary.cases).some(v => v.status === 'PREPARED') ||
      hasJusticeMentorLifeLock(s) || hasJusticeMentorEncounterLock(s)) return '先实际收束旧无暗者情感仪式、净化与耀斑、原物及遭遇，以及旧光之祭司与公证人的接触、原契约和准备；已回输的原情感不能重新剥离，新案不能沿用旧同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原公共音乐室旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为无暗者并保留原指导渠道后，才能了解正义导师之路。';
  if (hasJusticeMentorHistory(s)) return '已经真实晋升正义导师3，不能重复准备或服药；未服原瓶保留。';
  const state = s.justiceMentor;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < JUSTICE_MENTOR_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的正义导师原瓶。';
    return s.cash < JUSTICE_MENTOR_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批正义导师原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的正义导师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选正义导师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= JUSTICE_MENTOR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyJusticeMentorAcquisition(s: SliceState, command: JusticeMentorAcquisitionCommand, ctx: SeerContext): void {
  const reason = justiceMentorAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.justiceMentor;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= JUSTICE_MENTOR_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取正义导师独立成品与专业准备指导', `花1行动、500便士。${JUSTICE_MENTOR_GUIDE}说明原渠道记录。${JUSTICE_MENTOR_FORMULA_STATUS}${JUSTICE_MENTOR_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = JUSTICE_MENTOR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= JUSTICE_MENTOR_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(JUSTICE_MENTOR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('正义导师独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠强制契约、善恶判断、法律身份、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批正义导师成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < JUSTICE_MENTOR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`justice-mentor-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶正义导师原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.unshadowedActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of JUSTICE_MENTOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为正义导师', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；无暗者消化100与全部旧掌握保留，两项本作G新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；旧埃德蒙的原伤势、投降或死亡记录与原棍去向、原奥尔登、原特性污染、原石板焦痕和冷却记录保留；同一原情感已回输的事实不改写，不创建善恶雷达或强制契约。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '正义导师魔药严重排异' : '正义导师魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为无暗者，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyJusticeMentorCommand(s: SliceState, command: JusticeMentorCommand, ctx: SeerContext): void {
  if (!validateJusticeMentorCommand(command)) throw new Error('正义导师命令无效。');
  if (validateJusticeMentorAcquisitionCommand(command)) return applyJusticeMentorAcquisition(s, command, ctx);
  if (validateJusticeMentorActivityCommand(command)) return applyJusticeMentorActivity(s, command, ctx);
  if (validateJusticeMentorEncounterCommand(command)) return applyJusticeMentorEncounterCommand(s, command, ctx);
  throw new Error('未知正义导师命令。');
}

export function projectJusticeMentor(s: SliceState): JusticeMentorProjection {
  const state = s.justiceMentor, available = knownChannel(s), promoted = hasJusticeMentorHistory(s), actions: JusticeMentorAction[] = [];
  const acting = promoted ? ((s.progression.sequence === 2||s.progression.sequence===1) ? s.lightSeeker.justiceMentorActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: JusticeMentorAcquisitionCommand) => { const reason = justiceMentorAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-justice-mentor-guidance', '听取正义导师成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of JUSTICE_MENTOR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`justice-mentor-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-justice-mentor-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-justice-mentor-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-justice-mentor-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-justice-mentor-supply', '申请下一批独立正义导师成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${JUSTICE_MENTOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶正义导师魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 无暗者消化${s.progression.acting}/100 · ${unshadowedWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '正义导师·太阳序列3（合作与核实G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${JUSTICE_MENTOR_FORMULA_STATUS}${JUSTICE_MENTOR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available && s.progression.sequence!==1 ? [...actions, ...justiceMentorLifeActions(s), ...justiceMentorEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 正义导师成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为无暗者' : '排异，仍为无暗者'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? JUSTICE_MENTOR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? JUSTICE_MENTOR_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `无暗者消化${state.unshadowedActingAtPromotion}/100留存；正义导师扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `无暗者需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${unshadowedWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完无暗者之路。',
    pollution: s.seer.pollution, risk: available ? JUSTICE_MENTOR_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `无暗者第${s.unshadowed.promotionWeek}周真实晋升；${promoted ? `原消化${state.unshadowedActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      (s.progression.sequence === 2||s.progression.sequence===1) ? '歌颂者至正义导师的旧能力、掌握、原瓶与真实经历保留。正义导师消化100已经留存；已回输的原情感、原人物与原物仍按各自的真实结果保存，旧实践与旧遭遇只供回看。' : '歌颂者至无暗者的全部原ID、掌握、原瓶、同一原情感与回输记录、原人物原物及真实后果保留。正义导师3名称有原文依据，两项新增玩法与全部定量为本作G；下一逐光者2仅作者卷末总结名称已核，本阶段不开放。身体性别不改变，没有善恶雷达、强制契约或法律身份。',
      `原奥尔登${s.unshadowed.life.ally.id}：${s.unshadowed.life.ally.alive ? '仍活着' : '已死亡'}，仍在${s.unshadowed.life.ally.location}，真实退出/返回${s.unshadowed.life.ally.moves}/${s.unshadowed.life.ally.returns}次；旧同意不代替新案许可。`,
      `原特性${s.unshadowed.life.characteristic.id}数量${s.unshadowed.life.characteristic.quantity}、归${s.unshadowed.life.characteristic.owner}，污染${s.unshadowed.life.characteristic.contamination}；原盒${s.unshadowed.life.characteristic.boxId}封存状态${s.unshadowed.life.characteristic.containment}。`,
      `原石板${s.unshadowed.life.tile.id}保留${s.unshadowed.life.tile.scorchMarks}处焦痕、已实际冷却${s.unshadowed.life.tile.coolingSeconds}秒，当前${s.unshadowed.life.tile.heat}；原门${s.unshadowed.life.room.doorId}仍为普通通路，曾实际出入${s.unshadowed.life.room.stepsOut}/${s.unshadowed.life.room.stepsIn}次。`,
      ...(s.unshadowed.encounter.approachWeek === null ? [] : [`原埃德蒙UD4-EDMUND：健康${s.unshadowed.encounter.enemy.health}/100、精神${s.unshadowed.encounter.enemy.mind}/100；${s.unshadowed.encounter.enemy.status === 'DEAD' ? '已死亡，不会复活' : s.unshadowed.encounter.enemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : '仍为独立原人'}。原棍${s.unshadowed.encounter.enemy.weaponId}${s.unshadowed.encounter.enemy.weaponLocation === 'HAND' ? '仍在他手中' : '仍在原院COURTYARD地面'}，不因新晋升复原或成为新敌。`]),
      ...s.unshadowed.ritual.visits.map(visit => `原序列4情感场${visit.id}：${visit.anchor ? `同一原情感${visit.anchor.id}仍为${visit.anchor.location}，记忆保留${visit.anchor.memoriesRetained ? '是' : '否'}` : '未声明原情感'}；同一载体${visit.vessel.id}为${visit.vessel.status}，原包${visit.kit.id}为${visit.kit.status}，第${visit.closedWeek ?? '尚未'}周退出。已回输的原情感不重新剥离，不能把旧4仪式改作序列3仪式。`),
    ] : [],
    life: projectJusticeMentorLife(s), encounter: projectJusticeMentorEncounter(s), insideCase: hasJusticeMentorLock(s),
    environment: available ? '原创G原工作院JM3-WORKCOURT，48岁业主塞尔比JM3-SELBY、37岁助手阿娅JM3-AYA与44岁助手尼文JM3-NIVEN均为独立原人。原普通门开放，二人须当前自愿沿8米干燥平路运输同一原小工具箱后真实空手返回；原登记牌、交接册、灯与放大镜供许可核实，字形不自动等于事实。原封装低强超自然残留和原友善灵榆音为第三案原件与既存旁观者，太阳能力不保证友方免疫。全部人物、距离、强度与消耗为G。' : '',


  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateJusticeMentorState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.justiceMentor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'unshadowedActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as JusticeMentorState, promoted = hasJusticeMentorHistory(s), firstWeek = s.unshadowed.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + JUSTICE_MENTOR_MIN_UNSHADOWED_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !JUSTICE_MENTOR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasJusticeMentorLifeLock(s) || hasJusticeMentorEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.unshadowed.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.unshadowedActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?PURE_WHITE_ANGEL_ABILITY_IDS:[]),...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS, ...PRIEST_OF_LIGHT_ABILITY_IDS, ...UNSHADOWED_ABILITY_IDS, ...JUSTICE_MENTOR_ABILITY_IDS, ...((s.progression.sequence === 2||s.progression.sequence===1) ? LIGHT_SEEKER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.unshadowedActingAtPromotion !== null || JUSTICE_MENTOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `justice-mentor-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== JUSTICE_MENTOR_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.unshadowed.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateJusticeMentorLife(s) && validateJusticeMentorEncounter(s);
}
export { JUSTICE_MENTOR_ABILITIES } from './content.js';
export { JUSTICE_MENTOR_ABILITY_IDS } from './types.js';
export type * from './types.js';
