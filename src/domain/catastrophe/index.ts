import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAILOR_ABILITY_IDS } from '../sailor/types.js';
import { RAGER_ABILITY_IDS } from '../rager/types.js';
import { NAVIGATOR_ABILITY_IDS } from '../navigator/types.js';
import { WIND_BLESSED_ABILITY_IDS } from '../wind-blessed/types.js';
import { OCEAN_SINGER_ABILITY_IDS } from '../ocean-singer/types.js';
import { CATACLYSM_PRIEST_ABILITY_IDS } from '../cataclysm-priest/types.js';
import { SEA_KING_ABILITY_IDS } from '../sea-king/types.js';
import { oceanSingerInside } from '../ocean-singer/life.js';
import { windBlessedInside } from '../wind-blessed/life.js';
import { hasCataclysmPriestRitualLock } from '../cataclysm-priest/ritual.js';
import { hasCataclysmPriestLifeLock } from '../cataclysm-priest/life.js';
import { hasCataclysmPriestEncounterLock } from '../cataclysm-priest/encounter.js';
import { hasSeaKingLifeLock } from '../sea-king/life.js';
import { hasSeaKingEncounterLock } from '../sea-king/encounter.js';
import { createCatastropheLifeState, applyCatastropheActivity, projectCatastropheLife, catastropheLifeActions, validateCatastropheLife, validateCatastropheActivityCommand, hasCatastropheLifeLock } from './life.js';
import { createCatastropheEncounterState, applyCatastropheEncounterCommand, projectCatastropheEncounter, catastropheEncounterActions, validateCatastropheEncounter, validateCatastropheEncounterCommand, hasCatastropheEncounterLock } from './encounter.js';
import { CATASTROPHE_ABILITIES, CATASTROPHE_BOTTLE_IDS, CATASTROPHE_CONSUMPTION_RISK, CATASTROPHE_FORMULA_STATUS, CATASTROPHE_GUIDE, CATASTROPHE_LABOUR_STEPS, CATASTROPHE_LABOUR_TASKS, CATASTROPHE_MIN_SEA_KING_WEEKS, CATASTROPHE_POTION_SOURCES, CATASTROPHE_PREPARATIONS, CATASTROPHE_PRICES, CATASTROPHE_SOURCE_STATUS } from './content.js';
import { CATASTROPHE_ABILITY_IDS, CATASTROPHE_PREPARATION_IDS, type CatastropheAcquisitionCommand, type CatastropheAction, type CatastropheBottle, type CatastropheCommand, type CatastropheProjection, type CatastropheState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
const INHERITED_ABILITY_IDS = [...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS, ...OCEAN_SINGER_ABILITY_IDS, ...CATACLYSM_PRIEST_ABILITY_IDS, ...SEA_KING_ABILITY_IDS];
const freshBottle = (id: string, source: string, stockedWeek: number | null): CatastropheBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createCatastropheState(): CatastropheState {
  return { guidanceKnown: false, bottles: CATASTROPHE_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, seaKingActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createCatastropheLifeState(), encounter: createCatastropheEncounterState() };
}
/** Historical membership never broadens the exact current-stage action guards. */
export const isCatastrophe = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 2;
export const isCatastropheAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 3;
export const hasCatastropheHistory = (s: SliceState) => isCatastrophe(s) && s.catastrophe.promotionWeek !== null;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'tyrant' && [3, 2].includes(s.progression.sequence ?? 0) && s.sailor.discovered && s.seaKing.guidanceKnown && s.seaKing.promotionWeek !== null;
export const hasCatastropheLock = (s: SliceState): boolean => s.catastrophe.preparedWeek !== null || hasCatastropheLifeLock(s) || hasCatastropheEncounterLock(s);
const bottleNumber = (b: Pick<CatastropheBottle, 'id'>) => Number(b.id.slice('catastrophe-potion-'.length));
const potionPrice = (b: CatastropheBottle) => CATASTROPHE_PRICES.potion - (b.labourSteps === CATASTROPHE_LABOUR_STEPS ? CATASTROPHE_PRICES.labourCredit : 0);
const seaKingWeeks = (s: SliceState) => Math.max(0, (s.catastrophe.promotionWeek ?? s.week) - (s.seaKing.promotionWeek ?? s.week));
const exhaustedSupply = (state: CatastropheState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${CATASTROPHE_GUIDE}介绍的独立天灾成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶catastrophe-potion-${number}；非海王或更早原瓶改装。天灾2名称编号已核实，完整配方、原著晋升仪式与新权能精确边界仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => CATASTROPHE_PREPARATION_IDS.every(id => s.catastrophe.preparations.some(p => p.taskId === id));
/** Read only the real old scene state: no stage widening, reset, repair or inherited source reward. */
export function hasCatastropheOldSceneLock(s: SliceState): boolean {
  return s.seaKing.preparedWeek !== null || hasSeaKingLifeLock(s) || hasSeaKingEncounterLock(s) ||
    Object.values(s.seaKing.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasCataclysmPriestRitualLock(s) || s.cataclysmPriest.ritual.activeVisitId !== null || hasCataclysmPriestLifeLock(s) || hasCataclysmPriestEncounterLock(s) ||
    Object.values(s.cataclysmPriest.life.cases).some(v => v.status === 'PREPARED') ||
    oceanSingerInside(s) || windBlessedInside(s) ||
    Object.values(s.oceanSinger.cases).some(v => v.status === 'PREPARED') ||
    Object.values(s.windBlessed.cases).some(v => v.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.oceanSinger.encounter.status) || ['READY', 'FIGHTING'].includes(s.windBlessed.encounter.status);
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以退出本次准备后正常休养，未服原瓶保留，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `海王魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.seaKing.promotionWeek === null || seaKingWeeks(s) < CATASTROPHE_MIN_SEA_KING_WEEKS) return `从海王实际晋升周起已过${seaKingWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成原水来源核验、有限边界与许可核对、停止回流和普通返程演练；购买原瓶不能代做专业准备。';
}
export function validateCatastropheAcquisitionCommand(v: unknown): v is CatastropheAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CATASTROPHE_PREPARATION_IDS.includes(v.taskId as typeof CATASTROPHE_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^catastrophe-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isCatastropheAcquisitionCommand = validateCatastropheAcquisitionCommand;
export function validateCatastropheCommand(v: unknown): v is CatastropheCommand {
  return validateCatastropheAcquisitionCommand(v) || validateCatastropheActivityCommand(v) || validateCatastropheEncounterCommand(v);
}
export function catastropheAcquisitionBlock(s: SliceState, command: CatastropheAcquisitionCommand): string | null {
  if (!validateCatastropheAcquisitionCommand(command)) return '天灾准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasCatastropheOldSceneLock(s) || hasCatastropheLifeLock(s) || hasCatastropheEncounterLock(s)) return '先实际收束旧海王和更早原场的准备、接触、原水、原艇、借持原物与遭遇；不能沿用旧许可或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德艾洛·芬奇原维修站旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为海王并保留原指导渠道后，才能了解天灾之路。';
  if (!isCatastropheAcquisitionStage(s)) return '已晋升天灾2，不能凭继承的海王历史重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '须保留水手至海王全部20项原掌握与合法原值，不能补造或删除条目取得新晋升。';
  const state = s.catastrophe;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '本周已实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取独立来源、未知配方与仪式边界以及本次四档风险。' : s.cash < CATASTROPHE_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的天灾原瓶。';
    return s.cash < CATASTROPHE_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批天灾原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知天灾准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选天灾独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CATASTROPHE_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application commits this working-copy mutation through the existing transaction. */
export function applyCatastropheAcquisition(s: SliceState, command: CatastropheAcquisitionCommand, ctx: SeerContext): void {
  const reason = catastropheAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.catastrophe;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= CATASTROPHE_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取天灾独立成品与专业准备指导', `花1行动、500便士。${CATASTROPHE_GUIDE}说明原渠道记录。${CATASTROPHE_FORMULA_STATUS}${CATASTROPHE_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CATASTROPHE_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CATASTROPHE_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周天灾服药场地', '花1行动、120便士，按三项真实专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留，可以正常生活休养；下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CATASTROPHE_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800；部分劳动不折现、不转给别瓶，不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('天灾独立原瓶实际交付', `0行动、${paid}便士，领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}原瓶尚未服用，不附赠海水、原物、人物许可、能力窗口、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批天灾成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CATASTROPHE_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`catastrophe-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新三瓶天灾原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind -= mentalCost; state.seaKingActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of CATASTROPHE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为天灾·暴君序列2', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；冻结原海王消化100，全部旧20项掌握与七阶历史原值保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变，旧伤势与累计风险不治疗、不重置；原本尼迪克特、昆廷的实际生死与原棍、旧瓶失败、海王原奥林精力与原轮具损耗均保持。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '天灾魔药严重排异' : '天灾魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将此次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为海王，旧消化、全部原掌握与三项真实专业经历保留；本人沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyCatastropheCommand(s: SliceState, command: CatastropheCommand, ctx: SeerContext): void {
  if (!validateCatastropheCommand(command)) throw new Error('天灾命令无效。');
  if (validateCatastropheAcquisitionCommand(command)) return applyCatastropheAcquisition(s, command, ctx);
  if (!isCatastrophe(s) || !hasCatastropheHistory(s)) throw new Error('新天灾实践与遭遇只向当前暴君序列2开放，旧海王历史不能代替当前资格。');
  if (hasCatastropheOldSceneLock(s)) throw new Error('先实际收束旧七阶现场与准备，不能用新场覆盖旧原人原物。');
  if (validateCatastropheActivityCommand(command)) return applyCatastropheActivity(s, command, ctx);
  if (validateCatastropheEncounterCommand(command)) return applyCatastropheEncounterCommand(s, command, ctx);
  throw new Error('未知天灾命令。');
}

export function projectCatastrophe(s: SliceState): CatastropheProjection {
  const state = s.catastrophe, available = knownChannel(s), promoted = isCatastrophe(s), actions: CatastropheAction[] = [];
  const add = (id: string, label: string, cost: string, command: CatastropheAcquisitionCommand) => {
    const reason = catastropheAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isCatastropheAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-catastrophe-guidance', '听取天灾成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of CATASTROPHE_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`catastrophe-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-catastrophe-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-catastrophe-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-catastrophe-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-catastrophe-supply', '申请下一批独立天灾成品', '1行动 · 下一真实周起收货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < CATASTROPHE_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CATASTROPHE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶天灾魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 海王消化${s.progression.acting}/100 · ${seaKingWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '天灾 · 暴君序列2' : '天灾之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${CATASTROPHE_FORMULA_STATUS}${CATASTROPHE_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或本瓶五项真实劳动后800便士；现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available ? [...actions, ...(promoted ? [...catastropheLifeActions(s), ...catastropheEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 天灾独立成品魔药`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为海王' : '排异，仍为海王'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? CATASTROPHE_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? CATASTROPHE_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `海王消化${state.seaKingActingAtPromotion}/100留存；天灾扮演${s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；每项新能力每案只在真实应用后最多增加8掌握，成功开窗而未使用不奖。旧三案与旧反思不重复记为本阶经历。` : available ? `海王需消化100（当前${s.progression.acting}/100）、从其实际晋升周起12整周（当前${seaKingWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完海王之路。',
    pollution: s.seer.pollution, risk: available ? CATASTROPHE_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `海王第${s.seaKing.promotionWeek}周真实晋升；${promoted ? `原消化${state.seaKingActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。首次水手晋升周${s.progression.promotionWeek}与灾难主祭晋升周${s.cataclysmPriest.promotionWeek}不作为本阶十二周起点。`,
      `七旧阶消化快照：水手${s.rager.sailorActingAtPromotion}、暴怒之民${s.navigator.ragerActingAtPromotion}、航海家${s.windBlessed.navigatorActingAtPromotion}、风眷者${s.oceanSinger.windBlessedActingAtPromotion}、海洋歌者${s.cataclysmPriest.oceanSingerActingAtPromotion}、灾难主祭${s.seaKing.cataclysmPriestActingAtPromotion}、海王${promoted ? state.seaKingActingAtPromotion : s.progression.acting}。各旧域保存自己的原历史，本阶不重初始化。`,
      `水手至海王全部20个原ID和原掌握（含0值）保留：${INHERITED_ABILITY_IDS.map(id => `${id}=${s.progression.mastery[id] ?? 0}`).join('，')}。天灾仅增加两项原创G能力，不重发旧来源奖励。`,
      `本人健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；伤势记录${s.injuries.length}项、未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项、累计风险${s.injuryRisk}。晋升不治疗、不清风险。`,
      `原海王海湾SK3-COVE的奥林SK3-ORIN仍在${s.seaKing.life.orin.location}，精力${s.seaKing.life.orin.energy}、累计实际行程${s.seaKing.life.orin.travelMetres}米；原艇在${s.seaKing.life.dinghy.location}、原卷具耐久${s.seaKing.life.windlass.durability}，原凹槽水${s.seaKing.life.recess.waterUnits}、已移入原湾水${s.seaKing.life.recess.displacedToCove}，不移作CT2新小湾的免费资源。`,
      ...(s.cataclysmPriest.encounter.approachWeek === null ? [] : [`原本尼迪克特CP4-BENEDICT：${s.cataclysmPriest.encounter.enemy.status}，健康${s.cataclysmPriest.encounter.enemy.health}/100、精神${s.cataclysmPriest.encounter.enemy.mind}/100；原棍在${s.cataclysmPriest.encounter.enemy.weaponLocation}，原结局不重开。`]),
      ...(s.seaKing.encounter.approachWeek === null ? [] : [`原昆廷SK3-QUENTIN：${s.seaKing.encounter.enemyStatus}，健康${s.seaKing.encounter.enemyHealth}/100、精神${s.seaKing.encounter.enemyMind}/100、灵性${s.seaKing.encounter.enemySpirituality}/120；原棍在${s.seaKing.encounter.weaponLocation}，原伤亡、投降或退场保持，不因新增维尔而复原。`]),
      '七旧域所有独立原瓶来源、失败、劳务、专业准备、原场许可、撤回、失败检定、错误假说、实际物品位置与磨损均保留；已消耗旧仪式包不恢复，旧尸体不复活，旧人物同意不延伸到新诺拉或维尔。',
    ] : [],
    life: projectCatastropheLife(s), encounter: projectCatastropheEncounter(s), insideCase: hasCatastropheLock(s),
    environment: available ? '原创G：同一CT2-COVE原小湾，12米有限边界、CT2-WATER初始20抽象单位真实海水，只有BAY和CHANNEL相连水路；原闸、原浮标、原系索、原回收轮具和原工作轮各一件。诺拉45岁须每案当次许可、实际6米干路往返并每程付2精力；本人和原物不能瞬移。三案和可选维尔47岁独立冲突共用同一水量、闸与耐久，报告和进战不补水、不修物。' : '',
  };
}

/** Exact sources and bounded week chronology. Old modules remain authoritative for their own histories. */
export function validateCatastropheState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.catastrophe;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'seaKingActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as CatastropheState, promoted = isCatastrophe(s), acquisitionStage = isCatastropheAcquisitionStage(s);
  const firstWeek = s.seaKing.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CATASTROPHE_MIN_SEA_KING_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !integer(s.seaKing.promotionWeek, 1, s.week))) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > CATASTROPHE_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CATASTROPHE_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || hasCatastropheOldSceneLock(s) || hasCatastropheLifeLock(s) || hasCatastropheEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.seaKing.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.seaKingActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || hasCatastropheOldSceneLock(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...CATASTROPHE_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.seaKingActingAtPromotion !== null || CATASTROPHE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `catastrophe-potion-${index + 1}` || !integer(b.labourSteps, 0, CATASTROPHE_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < CATASTROPHE_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== CATASTROPHE_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % CATASTROPHE_BOTTLE_IDS.length;
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
        if (!integer(s.seaKing.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateCatastropheLife(s) || !validateCatastropheEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { CATASTROPHE_ABILITIES } from './content.js';
export { CATASTROPHE_ABILITY_IDS } from './types.js';
export type * from './types.js';
