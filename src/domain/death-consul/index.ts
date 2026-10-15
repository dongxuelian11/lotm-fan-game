import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../spirit-guide/types.js';
import { GATEKEEPER_ABILITY_IDS } from '../gatekeeper/types.js';
import { UNDYING_ABILITY_IDS } from '../undying/types.js';
import { FERRYMAN_ABILITY_IDS } from '../ferryman/types.js';
import { FERRYMAN_PROVIDERS } from '../ferryman/content.js';
import { hasUndyingRitualLock } from '../undying/ritual.js';
import { hasUndyingLifeLock, hasUndyingOldPractice } from '../undying/life.js';
import { hasUndyingEncounterLock } from '../undying/encounter.js';
import { activeFerrymanChannel, hasFerrymanRitualLock } from '../ferryman/index.js';
import { hasFerrymanLifeLock } from '../ferryman/life.js';
import { hasFerrymanEncounterLock } from '../ferryman/encounter.js';
import { projectFerrymanEra } from '../ferryman/era.js';
import { createDeathConsulLifeState, applyDeathConsulActivity, projectDeathConsulLife, deathConsulLifeActions, validateDeathConsulLife, validateDeathConsulActivityCommand, hasDeathConsulLifeLock } from './life.js';
import { createDeathConsulEncounterState, applyDeathConsulEncounterCommand, projectDeathConsulEncounter, deathConsulEncounterActions, validateDeathConsulEncounter, validateDeathConsulEncounterCommand, hasDeathConsulEncounterLock } from './encounter.js';
import { DEATH_CONSUL_ABILITIES, DEATH_CONSUL_BOTTLE_IDS, DEATH_CONSUL_FORMULA_STATUS, DEATH_CONSUL_LABOUR_STEPS, DEATH_CONSUL_LABOUR_TASKS, DEATH_CONSUL_MIN_FERRYMAN_WEEKS, DEATH_CONSUL_POTION_SOURCES, DEATH_CONSUL_PREPARATIONS, DEATH_CONSUL_SOURCE_STATUS, deathConsulConsumptionRisk, deathConsulPotionSource, deathConsulPrices, deathConsulSourceLabel } from './content.js';
import { DEATH_CONSUL_ABILITY_IDS, DEATH_CONSUL_PREPARATION_IDS, type DeathConsulAcquisitionCommand, type DeathConsulAction, type DeathConsulBottle, type DeathConsulCommand, type DeathConsulProjection, type DeathConsulSourceEra, type DeathConsulState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const DEATH_CONSUL_INHERITED_ABILITY_IDS = [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS, ...UNDYING_ABILITY_IDS, ...FERRYMAN_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = DEATH_CONSUL_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): DeathConsulBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createDeathConsulState(): DeathConsulState {
  return { guidanceKnown: false, sourceEra: null, sourceWeek: null,
    bottles: DEATH_CONSUL_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, ferrymanActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createDeathConsulLifeState(), encounter: createDeathConsulEncounterState() };
}
/** Historical membership never broadens an old stage's playable actions. */
export const isDeathConsul = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 2;
export const isDeathConsulAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 3;
export const hasDeathConsulHistory = (s: SliceState) => isDeathConsul(s) && s.deathConsul.promotionWeek !== null;
/** The public era availability is the same authority used by the current S3 life channel. */
export const currentDeathConsulSourceEra = (s: SliceState): DeathConsulSourceEra => projectFerrymanEra(s).available ? 'POST_CYCLE' : 'ORIGINAL';
function realChannelMatches(s: SliceState, era: DeathConsulSourceEra): boolean {
  const c = activeFerrymanChannel(s), provider = FERRYMAN_PROVIDERS[era];
  return currentDeathConsulSourceEra(s) === era && s.ferryman.channels.filter(v => v.agreementClosedDate === null).length === 1 && c !== null && c.id === era &&
    c.provider.id === provider.id && c.provider.name === provider.name && c.provider.ageAtIntroduction === provider.ageAtIntroduction &&
    integer(c.introducedWeek, 1, s.week) && integer(s.ferryman.promotionWeek, c.introducedWeek, s.week) &&
    c.bottles.filter(b => success(b.outcome) && b.status === 'CONSUMED' && b.consumedWeek === s.ferryman.promotionWeek).length === 1;
}
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'death' && [3, 2].includes(s.progression.sequence ?? 0) && s.corpsecollector.discovered && s.ferryman.guidanceKnown && s.ferryman.promotionWeek !== null && realChannelMatches(s, currentDeathConsulSourceEra(s));
export const hasDeathConsulLock = (s: SliceState): boolean => s.deathConsul.preparedWeek !== null || hasDeathConsulLifeLock(s) || hasDeathConsulEncounterLock(s);
const bottleNumber = (b: Pick<DeathConsulBottle, 'id'>) => Number(b.id.slice('death-consul-potion-'.length));
const sourceEraFor = (s: SliceState) => s.deathConsul.sourceEra ?? currentDeathConsulSourceEra(s);
const potionPrice = (s: SliceState, b: DeathConsulBottle) => { const prices = deathConsulPrices(sourceEraFor(s)); return prices.potion - (b.labourSteps === DEATH_CONSUL_LABOUR_STEPS ? prices.labourCredit : 0); };
const ferrymanWeeks = (s: SliceState) => Math.max(0, (s.deathConsul.promotionWeek ?? s.week) - (s.ferryman.promotionWeek ?? s.week));
const exhaustedSupply = (state: DeathConsulState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const hasPreparations = (s: SliceState) => DEATH_CONSUL_PREPARATION_IDS.every(id => s.deathConsul.preparations.some(p => p.taskId === id));
/** Only actual unfinished old scenes block entry. Neither old people nor old spirits are reintroduced or reset. */
export function hasDeathConsulOldSceneLock(s: SliceState): boolean {
  return hasFerrymanRitualLock(s) || hasFerrymanLifeLock(s) || hasFerrymanEncounterLock(s) ||
    Object.values(s.ferryman.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasUndyingRitualLock(s) || s.undying.ritual.activeVisitId !== null || hasUndyingLifeLock(s) || hasUndyingEncounterLock(s) ||
    hasUndyingOldPractice(s);
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以退出本次准备后实际休养，未服原瓶保留，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `摆渡人魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.ferryman.promotionWeek === null || ferrymanWeeks(s) < DEATH_CONSUL_MIN_FERRYMAN_WEEKS) return `从摆渡人实际晋升周起已过${ferrymanWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别完成两端锚点检查、残余边界复核和停止返程演练；购买药瓶不能代替这些准备。';
}
export function validateDeathConsulAcquisitionCommand(v: unknown): v is DeathConsulAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && DEATH_CONSUL_PREPARATION_IDS.includes(v.taskId as typeof DEATH_CONSUL_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^death-consul-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isDeathConsulAcquisitionCommand = validateDeathConsulAcquisitionCommand;
export function validateDeathConsulCommand(v: unknown): v is DeathConsulCommand {
  return validateDeathConsulAcquisitionCommand(v) || validateDeathConsulActivityCommand(v) || validateDeathConsulEncounterCommand(v);
}
export function deathConsulAcquisitionBlock(s: SliceState, command: DeathConsulAcquisitionCommand): string | null {
  if (!validateDeathConsulAcquisitionCommand(command)) return '死亡执政官准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if (hasDeathConsulOldSceneLock(s) || hasDeathConsulLifeLock(s) || hasDeathConsulEncounterLock(s)) return '先实际收束旧仪式、准备、原物与遭遇，以及本次现场，再到独立指导场。';
  if (s.world.city !== 'BACKLUND') return '须本人实际回到贝克兰德当前渠道的独立指导场。';
  if (!knownChannel(s)) return '须实际成为摆渡人，并保留与当前时代一致的真实成品渠道，才能了解死亡执政官之路。';
  if (!isDeathConsulAcquisitionStage(s)) return '已晋升死亡执政官2，不能凭继承的摆渡人历史重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return `收尸人至摆渡人的${INHERITED_ABILITY_IDS.length}项已有掌握记录不完整，暂不能继续晋升。`;
  const state = s.deathConsul, era = currentDeathConsulSourceEra(s), prices = deathConsulPrices(state.sourceEra ?? era);
  if (state.guidanceKnown && (state.sourceEra !== era || !realChannelMatches(s, state.sourceEra!))) return '已经登记的成品来源与当前真实渠道不一致；不能更换时代、供应人或套用另一渠道费用。';
  if (era === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION') return '先沿真实12米普通道路进入当代接待处，再听取指导或使用本渠道成品。';
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '本周已实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经登记本时代成品来源、准备要求与四档风险。' : state.sourceEra !== null || state.sourceWeek !== null ? '来源登记不完整，不能重复创建或替换当前渠道。' : s.cash < prices.guidance ? `本次专业指导需要${prices.guidance}便士。` : null;
  if (!state.guidanceKnown) return '先听当前指导者说明成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的死亡执政官原瓶。';
    return s.cash < prices.preparation ? `当次场地检查需要${prices.preparation}便士。` : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批死亡执政官原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部失败耗尽。';
  if (!('bottleId' in command)) return '未知死亡执政官准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选死亡执政官独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : `须另付1行动与${prices.preparation}便士完成本周当次场地检查；旧准备不能使用。`;
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= DEATH_CONSUL_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(s, bottle) ? `领取本瓶需要${potionPrice(s, bottle)}便士。` : null;
}

/** The application commits this working-copy mutation through the existing transaction. */
export function applyDeathConsulAcquisition(s: SliceState, command: DeathConsulAcquisitionCommand, ctx: SeerContext): void {
  const reason = deathConsulAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.deathConsul, era = sourceEraFor(s), prices = deathConsulPrices(era);
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= prices.guidance; state.guidanceKnown = true; state.sourceEra = era; state.sourceWeek = s.week;
      state.bottles.forEach((b, i) => { b.source = deathConsulPotionSource(era, i + 1, s.week); b.stockedWeek = s.week; });
      ctx.note('听取死亡执政官独立成品与专业准备指导', `花1行动、${prices.guidance}便士。第${s.week}周实际登记${deathConsulSourceLabel(era)}，本次时代与来源记录固定。${DEATH_CONSUL_FORMULA_STATUS}${deathConsulConsumptionRisk(era)}`); return;
    case 'PREPARE_TASK': {
      const task = DEATH_CONSUL_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物记录保留。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周死亡执政官服药场地', `花1行动、${prices.preparation}便士，按三项准备检查本次服药场地。尚未服药，须另行确认饮用所选药瓶。退出需要0行动，本次检查随即失效，费用不退，未服药瓶保留。`); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', `0行动实际退出，未服原瓶保留，已用行动与${prices.preparation}便士不返。三项真实专业经历保留，可以正常生活休养；下次须重新检查场地。`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(DEATH_CONSUL_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶${prices.labourCredit}便士，余款${prices.labourBalance}便士；部分劳动不折现、不转给别瓶，不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(s, bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('死亡执政官独立原瓶实际交付', `0行动、${paid}便士，领取${bottle.id}。${bottle.labourSteps === DEATH_CONSUL_LABOUR_STEPS ? `本瓶五项劳务抵${prices.labourCredit}便士。` : '未满五项劳动不部分抵扣。'}药瓶尚未服用；三项专业准备和当周服药场地检查另行完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批死亡执政官成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < DEATH_CONSUL_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`death-consul-potion-${number}`, deathConsulPotionSource(era, number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新三瓶死亡执政官原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入已登记供应方库存，0行动。尚未交付，仍须逐瓶${prices.potion}便士或对应五项劳动后${prices.labourBalance}便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind -= mentalCost; state.ferrymanActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of DEATH_CONSUL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为死亡执政官·死神序列2', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；留存摆渡人消化100与${INHERITED_ABILITY_IDS.length}项已有掌握，两项新掌握从0开始。灵性上限120，当前灵性保持；身体性别、伤势与累计风险保持。过去药瓶与人物、物品的记录保留。本次药瓶与场地准备已经用尽；已结束的旧周期不会重开。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '死亡执政官魔药严重排异' : '死亡执政官魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。现场专业照护使本次排异后的健康与精神最低为1；普通生活和战斗中的死亡风险仍需承担。仍为摆渡人，旧消化、全部原掌握与三项真实专业经历保留；本人沿原出口实际离开，可休养重筹另一原瓶与1行动、${prices.preparation}便士当次检查。`);
      }
      return;
    }
  }
}
export function applyDeathConsulCommand(s: SliceState, command: DeathConsulCommand, ctx: SeerContext): void {
  if (!validateDeathConsulCommand(command)) throw new Error('死亡执政官命令无效。');
  if (validateDeathConsulAcquisitionCommand(command)) return applyDeathConsulAcquisition(s, command, ctx);
  if (!isDeathConsul(s) || !hasDeathConsulHistory(s)) throw new Error('新死亡执政官实践与遭遇只向当前死神序列2开放，旧摆渡人历史不能代替当前资格。');
  if (hasDeathConsulOldSceneLock(s)) throw new Error('先实际收束此前现场与准备，再进入双室封存场。');
  if (!s.deathConsul.sourceEra || !realChannelMatches(s, s.deathConsul.sourceEra)) throw new Error('本次专业来源须与当前真实时代渠道一致。');
  if (validateDeathConsulActivityCommand(command)) return applyDeathConsulActivity(s, command, ctx);
  if (validateDeathConsulEncounterCommand(command)) return applyDeathConsulEncounterCommand(s, command, ctx);
  throw new Error('未知死亡执政官命令。');
}

export function projectDeathConsul(s: SliceState): DeathConsulProjection {
  const state = s.deathConsul, available = knownChannel(s), promoted = isDeathConsul(s), actions: DeathConsulAction[] = [];
  const era = sourceEraFor(s), prices = deathConsulPrices(era);
  const add = (id: string, label: string, cost: string, command: DeathConsulAcquisitionCommand) => {
    const reason = deathConsulAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isDeathConsulAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-death-consul-guidance', '听取死亡执政官成品与专业准备指导', `1行动 · ${prices.guidance}便士`, { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of DEATH_CONSUL_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`death-consul-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-death-consul-promotion', '实际检查本次服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
      else add('leave-death-consul-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-death-consul-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-death-consul-supply', '申请下一批独立死亡执政官成品', '1行动 · 下一真实周起收货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < DEATH_CONSUL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${DEATH_CONSUL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶死亡执政官魔药`, `0行动 · ${potionPrice(s, bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 摆渡人消化${s.progression.acting}/100 · ${ferrymanWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '死亡执政官 · 死神序列2' : '死亡执政官之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceEra: available ? state.sourceEra : null,
    sourceLabel: available ? `${deathConsulSourceLabel(era)}${state.sourceWeek === null ? '；尚未购买本次专业指导' : `；第${state.sourceWeek}周实际登记`}` : '',
    prices: available ? { ...prices } : null,
    formulaKnown: false, formula: [],
    ...(available ? { story: `${DEATH_CONSUL_FORMULA_STATUS}${DEATH_CONSUL_SOURCE_STATUS}` } : {}),
    supplies: available ? `${state.guidanceKnown ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。` : '本次专业介绍后登记三瓶独立成品；现在尚未交付。'}每瓶${prices.potion}便士或本瓶五项真实劳动后${prices.labourBalance}便士；现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available ? [...actions, ...(promoted ? [...deathConsulLifeActions(s), ...deathConsulEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 死亡执政官独立成品魔药`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `${state.guidanceKnown ? '供应方保管' : '待专业介绍'} · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为摆渡人' : '排异，仍为摆渡人'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? DEATH_CONSUL_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? DEATH_CONSUL_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `摆渡人消化${state.ferrymanActingAtPromotion}/100留存；死亡执政官扮演${s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；每项新能力每案只在真实应用后最多增加8掌握，成功开窗而未使用不奖。旧三案与旧反思不重复记为本阶经历。` : available ? `摆渡人需消化100（当前${s.progression.acting}/100）、从其实际晋升周起12整周（当前${ferrymanWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完摆渡人之路。',
    pollution: s.seer.pollution, risk: available ? deathConsulConsumptionRisk(era) : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `摆渡人在第${s.ferryman.promotionWeek}周晋升；${promoted ? `当时消化${state.ferrymanActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。死亡执政官的十二整周从该周计算。`,
      `历阶消化：收尸人${s.gravedigger.corpsecollectorActingAtPromotion}、掘墓人${s.spiritmedium.gravediggerActingAtPromotion}、通灵者${s.spiritGuide.spiritmediumActingAtPromotion}、死灵导师${s.gatekeeper.spiritGuideActingAtPromotion}、看门人${s.undying.gatekeeperActingAtPromotion}、不死者${s.ferryman.undyingActingAtPromotion}、摆渡人${promoted ? state.ferrymanActingAtPromotion : s.progression.acting}。`,
      `${INHERITED_ABILITY_IDS.length}项已有掌握保持原值：${INHERITED_ABILITY_IDS.map(id => `${id}=${s.progression.mastery[id] ?? 0}`).join('，')}。两项死亡执政官技巧从0开始，只有本阶实际应用并报告才增加掌握。`,
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；伤势记录${s.injuries.length}项，未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项，累计风险${s.injuryRisk}。`,
      `摆渡人原灵芦羽（${s.ferryman.life.reed.id}）的原记录保持：精力${s.ferryman.life.reed.energy}、实际行程${s.ferryman.life.reed.travelMetres}米、最后记录位置${s.ferryman.life.reed.location}。本场成人与封存残余均有另行当面登记的独立来源。`,
      `摆渡人既有遭遇记录：${s.ferryman.encounter.status}；不死者旧遭遇记录：${s.undying.encounter.status}。这些历史终局和原武器去向不因晋升重开。`,
      ...(era === 'POST_CYCLE' ? ['已经发生的六十年周期、有限寻回与当代交接记录保留。旧人物只按旧记载展示；当代工作、休整、医疗与七天推进继续在真实当代接待处进行。'] : ['仍处于原时代，现有普通生活与未耗原物按原记录继续；晋升不会制造新的周期。']),
      '过去的药瓶耗用、失败、劳务、准备、许可与撤回记录继续保留。双室封存场要重新核对当代参与者的当前意愿，并按实际位置、精力与原物损耗行动。',
    ] : [],
    life: projectDeathConsulLife(s), encounter: projectDeathConsulEncounter(s), insideCase: hasDeathConsulLock(s),
    environment: available ? 'DC2-CHAMBERS有两间相隔6米的真实房间、12米普通迂回路、一扇可开闭或受阻的原门。首次到场时当面介绍本时代的一名独立成人和唯一原封存物；许可、精力、位置、残余强度、焦痕与余热随后持续保留。封材只有一份，须实际购买；三次实践与可选遭遇共享同一现场。' : '',
  };
}

/** Exact sources and bounded week chronology. Old modules remain authoritative for their own histories. */
export function validateDeathConsulState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.deathConsul;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'sourceEra', 'sourceWeek', 'bottles', 'resupply', 'promotionWeek', 'ferrymanActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as DeathConsulState, promoted = isDeathConsul(s), acquisitionStage = isDeathConsulAcquisitionStage(s);
  const firstWeek = s.ferryman.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + DEATH_CONSUL_MIN_FERRYMAN_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown) {
    if (!knownChannel(s) || !['ORIGINAL', 'POST_CYCLE'].includes(state.sourceEra ?? '') || !integer(state.sourceWeek, firstWeek, lastAcquisitionWeek) || !realChannelMatches(s, state.sourceEra!)) return false;
    const channel = activeFerrymanChannel(s)!;
    if (state.sourceWeek < channel.introducedWeek || state.sourceEra === 'POST_CYCLE' && (s.longChapter.handoff === null || state.sourceWeek < s.longChapter.handoff.week)) return false;
  } else if (state.sourceEra !== null || state.sourceWeek !== null) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > DEATH_CONSUL_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !DEATH_CONSUL_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, state.sourceWeek ?? firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, Math.max(firstConsumptionWeek, state.sourceWeek ?? firstWeek), s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasDeathConsulOldSceneLock(s) || hasDeathConsulLifeLock(s) || hasDeathConsulEncounterLock(s) || state.sourceEra === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION')) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.ferryman.promotionWeek, 1, s.week) || !integer(state.promotionWeek, Math.max(firstConsumptionWeek, state.sourceWeek ?? firstWeek), s.week) || state.ferrymanActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || hasDeathConsulOldSceneLock(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...DEATH_CONSUL_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.ferrymanActingAtPromotion !== null || DEATH_CONSUL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `death-consul-potion-${index + 1}` || !integer(b.labourSteps, 0, DEATH_CONSUL_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < DEATH_CONSUL_BOTTLE_IDS.length) {
      if (state.guidanceKnown) {
        if (b.stockedWeek !== state.sourceWeek || b.source !== deathConsulPotionSource(state.sourceEra!, index + 1, state.sourceWeek!)) return false;
      } else if (b.stockedWeek !== null || b.source !== DEATH_CONSUL_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, Math.max(firstConsumptionWeek, state.sourceWeek ?? firstWeek) + 1, lastAcquisitionWeek) || b.source !== deathConsulPotionSource(state.sourceEra!, index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % DEATH_CONSUL_BOTTLE_IDS.length;
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
        if (!integer(s.ferryman.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, Math.max(firstConsumptionWeek, state.sourceWeek ?? firstWeek), s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateDeathConsulLife(s) || !validateDeathConsulEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { DEATH_CONSUL_ABILITIES } from './content.js';
export { DEATH_CONSUL_ABILITY_IDS } from './types.js';
export type * from './types.js';
