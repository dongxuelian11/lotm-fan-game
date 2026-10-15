import { CATASTROPHE_ABILITY_IDS } from '../catastrophe/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAILOR_ABILITY_IDS } from '../sailor/types.js';
import { RAGER_ABILITY_IDS } from '../rager/types.js';
import { NAVIGATOR_ABILITY_IDS } from '../navigator/types.js';
import { WIND_BLESSED_ABILITY_IDS } from '../wind-blessed/types.js';
import { OCEAN_SINGER_ABILITY_IDS } from '../ocean-singer/types.js';
import { CATACLYSM_PRIEST_ABILITY_IDS } from '../cataclysm-priest/types.js';
import { oceanSingerInside } from '../ocean-singer/life.js';
import { windBlessedInside } from '../wind-blessed/life.js';
import { hasCataclysmPriestRitualLock } from '../cataclysm-priest/ritual.js';
import { hasCataclysmPriestLifeLock } from '../cataclysm-priest/life.js';
import { hasCataclysmPriestEncounterLock } from '../cataclysm-priest/encounter.js';
import { createSeaKingLifeState, applySeaKingActivity, projectSeaKingLife, seaKingLifeActions, validateSeaKingLife, validateSeaKingActivityCommand, hasSeaKingLifeLock } from './life.js';
import { createSeaKingEncounterState, applySeaKingEncounterCommand, projectSeaKingEncounter, seaKingEncounterActions, validateSeaKingEncounter, validateSeaKingEncounterCommand, hasSeaKingEncounterLock } from './encounter.js';
import { SEA_KING_ABILITIES, SEA_KING_BOTTLE_IDS, SEA_KING_CONSUMPTION_RISK, SEA_KING_FORMULA_STATUS, SEA_KING_GUIDE, SEA_KING_LABOUR_STEPS, SEA_KING_LABOUR_TASKS, SEA_KING_MIN_CATACLYSM_PRIEST_WEEKS, SEA_KING_POTION_SOURCES, SEA_KING_PREPARATIONS, SEA_KING_PRICES, SEA_KING_SOURCE_STATUS } from './content.js';
import { SEA_KING_ABILITY_IDS, SEA_KING_PREPARATION_IDS, type SeaKingAcquisitionCommand, type SeaKingAction, type SeaKingBottle, type SeaKingCommand, type SeaKingProjection, type SeaKingState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): SeaKingBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createSeaKingState(): SeaKingState {
  return { guidanceKnown: false, bottles: SEA_KING_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, cataclysmPriestActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createSeaKingLifeState(), encounter: createSeaKingEncounterState() };
}
export const isSeaKing = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 3;
export const hasSeaKingHistory = (s: SliceState) => s.progression.pathwayId === 'tyrant' && [3, 2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'tyrant' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.sailor.discovered && s.cataclysmPriest.guidanceKnown && s.cataclysmPriest.promotionWeek !== null;
export const hasSeaKingLock = (s: SliceState): boolean => s.seaKing.preparedWeek !== null || hasSeaKingLifeLock(s) || hasSeaKingEncounterLock(s);
const bottleNumber = (b: Pick<SeaKingBottle, 'id'>) => Number(b.id.slice('sea-king-potion-'.length));
const potionPrice = (b: SeaKingBottle) => SEA_KING_PRICES.potion - (b.labourSteps === SEA_KING_LABOUR_STEPS ? SEA_KING_PRICES.labourCredit : 0);
const cataclysmPriestWeeks = (s: SliceState) => Math.max(0, (s.seaKing.promotionWeek ?? s.week) - (s.cataclysmPriest.promotionWeek ?? s.week));
const exhaustedSupply = (state: SeaKingState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${SEA_KING_GUIDE}介绍的独立海王成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶sea-king-potion-${number}；非灾难主祭或更早原瓶改装。序列3海王已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => SEA_KING_PREPARATION_IDS.every(id => s.seaKing.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `灾难主祭魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.cataclysmPriest.promotionWeek === null || cataclysmPriestWeeks(s) < SEA_KING_MIN_CATACLYSM_PRIEST_WEEKS) return `成为灾难主祭后已过${cataclysmPriestWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成原海图核对、边界实测与普通返程演练；购买原瓶不能代做专业准备。';
}
export function validateSeaKingAcquisitionCommand(v: unknown): v is SeaKingAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && SEA_KING_PREPARATION_IDS.includes(v.taskId as typeof SEA_KING_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^sea-king-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isSeaKingAcquisitionCommand = validateSeaKingAcquisitionCommand;
export function validateSeaKingCommand(v: unknown): v is SeaKingCommand {
  return validateSeaKingAcquisitionCommand(v) || validateSeaKingActivityCommand(v) || validateSeaKingEncounterCommand(v);
}
export function seaKingAcquisitionBlock(s: SliceState, command: SeaKingAcquisitionCommand): string | null {
  if (!validateSeaKingAcquisitionCommand(command)) return '海王准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasCataclysmPriestRitualLock(s) || s.cataclysmPriest.ritual.activeVisitId !== null || hasCataclysmPriestLifeLock(s) || hasCataclysmPriestEncounterLock(s) ||
      Object.values(s.cataclysmPriest.life.cases).some(v => v.status === 'PREPARED') ||
      oceanSingerInside(s) || windBlessedInside(s) ||
      Object.values(s.oceanSinger.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.windBlessed.cases).some(v => v.status === 'PREPARED') ||
      hasSeaKingLifeLock(s) || hasSeaKingEncounterLock(s)) return '先实际收束旧灾难主祭地震海啸、原物与遭遇，以及旧海洋歌者与风眷者的接触、飞行和准备；不能沿用旧同意或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原码头维修站旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为灾难主祭并保留原指导渠道后，才能了解海王之路。';
  if (hasSeaKingHistory(s)) return '已经真实晋升海王3，不能重复准备或服药；未服原瓶保留。';
  const state = s.seaKing;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < SEA_KING_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的海王原瓶。';
    return s.cash < SEA_KING_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批海王原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的海王准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选海王独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= SEA_KING_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applySeaKingAcquisition(s: SliceState, command: SeaKingAcquisitionCommand, ctx: SeerContext): void {
  const reason = seaKingAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.seaKing;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= SEA_KING_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取海王独立成品与专业准备指导', `花1行动、500便士。${SEA_KING_GUIDE}说明原渠道记录。${SEA_KING_FORMULA_STATUS}${SEA_KING_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = SEA_KING_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= SEA_KING_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(SEA_KING_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('海王独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠海域掌控、海生物、信徒、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批海王成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < SEA_KING_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`sea-king-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶海王原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.cataclysmPriestActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of SEA_KING_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为海王', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；灾难主祭消化100与全部旧掌握保留，三项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；旧本尼迪克特的原伤势、死亡记录与原棍去向、原西尔瓦、浮具、原绳损耗与海岸损毁保留；晋升不创建全海眼线、免费海生物或信徒库。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '海王魔药严重排异' : '海王魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为灾难主祭，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applySeaKingCommand(s: SliceState, command: SeaKingCommand, ctx: SeerContext): void {
  if (!validateSeaKingCommand(command)) throw new Error('海王命令无效。');
  if (validateSeaKingAcquisitionCommand(command)) return applySeaKingAcquisition(s, command, ctx);
  if (validateSeaKingActivityCommand(command)) return applySeaKingActivity(s, command, ctx);
  if (validateSeaKingEncounterCommand(command)) return applySeaKingEncounterCommand(s, command, ctx);
  throw new Error('未知海王命令。');
}

export function projectSeaKing(s: SliceState): SeaKingProjection {
  const state = s.seaKing, available = knownChannel(s), promoted = hasSeaKingHistory(s), actions: SeaKingAction[] = [];
  const acting = promoted ? (s.progression.sequence === 2 ? s.catastrophe.seaKingActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SeaKingAcquisitionCommand) => { const reason = seaKingAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-sea-king-guidance', '听取海王成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of SEA_KING_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`sea-king-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-sea-king-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-sea-king-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-sea-king-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-sea-king-supply', '申请下一批独立海王成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${SEA_KING_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶海王魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 灾难主祭消化${s.progression.acting}/100 · ${cataclysmPriestWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '海王·暴君序列3（有限海域G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${SEA_KING_FORMULA_STATUS}${SEA_KING_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...seaKingLifeActions(s), ...seaKingEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 海王成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为灾难主祭' : '排异，仍为灾难主祭'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? SEA_KING_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? SEA_KING_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `灾难主祭消化${state.cataclysmPriestActingAtPromotion}/100留存；海王扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `灾难主祭需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${cataclysmPriestWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完灾难主祭之路。',
    pollution: s.seer.pollution, risk: available ? SEA_KING_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `灾难主祭第${s.cataclysmPriest.promotionWeek}周真实晋升；${promoted ? `原消化${state.cataclysmPriestActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '水手至灾难主祭的全部原ID、掌握、原瓶、原海怪访问、原船员与真实人物后果保留；海王3与下一天灾2有原文依据，全部有限场景和定量为G。身体性别不改变，晋升不赠全海监控、免费生物或信徒库。',
      `原西尔瓦${s.cataclysmPriest.life.ally.id}：${s.cataclysmPriest.life.ally.alive ? '仍活着' : '已死亡'}，仍在${s.cataclysmPriest.life.ally.location}，真实往返${s.cataclysmPriest.life.ally.moves}/${s.cataclysmPriest.life.ally.returns}次；旧同意不代替新案许可。`,
      `原浮具${s.cataclysmPriest.life.float.id}仍在${s.cataclysmPriest.life.float.location}；原绳${s.cataclysmPriest.life.rope.id}耐久${s.cataclysmPriest.life.rope.durability}，原布${s.cataclysmPriest.life.tarp.id}${s.cataclysmPriest.life.tarp.deployed ? '仍展开' : '已收回'}。`,
      `原盘${s.cataclysmPriest.life.tray.id}实存${s.cataclysmPriest.life.tray.capturedUnits}水单位；原石${s.cataclysmPriest.life.stone.id}保留${s.cataclysmPriest.life.stone.scorchMarks}处焦痕，不删除水或修复原物。`,
      ...(s.cataclysmPriest.encounter.approachWeek === null ? [] : [`原本尼迪克特CP4-BENEDICT：健康${s.cataclysmPriest.encounter.enemy.health}/100、精神${s.cataclysmPriest.encounter.enemy.mind}/100；${s.cataclysmPriest.encounter.enemy.status === 'DEAD' ? '已死亡，不会复活' : s.cataclysmPriest.encounter.enemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : '仍为独立原人'}。原棍${s.cataclysmPriest.encounter.enemy.weaponId}${s.cataclysmPriest.encounter.enemy.weaponLocation === 'HAND' ? '仍在他手中' : '仍在原码头QUAY地面'}，不因新晋升复原。`]),
      ...s.cataclysmPriest.ritual.visits.map(visit => `原序列4海岸${visit.site.id}：原潮尺${visit.site.gaugeId}为${visit.site.gauge}，原下步道${visit.site.walkwayId}为${visit.site.lowerWalkway}；原包${visit.kit.id}为${visit.kit.status}，经历${visit.elapsedSeconds}秒。原地震海啸后果保留，不能改作序列3仪式。`),
    ] : [],
    life: projectSeaKingLife(s), encounter: projectSeaKingEncounter(s), insideCase: hasSeaKingLock(s),
    environment: available ? '原创G原海湾SK3-COVE有真实海水、普通干燥岸路、44岁保管员塞尔玛SK3-SELMA与39岁助手奥林SK3-ORIN。原海图与两原浮标实测界定96米有限练习水域；普通所有权不等于魔法掌控，须当前同意、边界与资源充足。入口EXIT至PIER及LEDGE各4米，至观察台3米；同一原艇沿真实水路60米到原浮标后真实返岸。全部有限距离、水量、成本与人物原物为G，不外推资深考特曼的范围和强度。' : '',

  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateSeaKingState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.seaKing;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'cataclysmPriestActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as SeaKingState, promoted = hasSeaKingHistory(s), firstWeek = s.cataclysmPriest.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + SEA_KING_MIN_CATACLYSM_PRIEST_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !SEA_KING_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasSeaKingLifeLock(s) || hasSeaKingEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.cataclysmPriest.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.cataclysmPriestActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS, ...OCEAN_SINGER_ABILITY_IDS, ...CATACLYSM_PRIEST_ABILITY_IDS, ...SEA_KING_ABILITY_IDS, ...(s.progression.sequence === 2 ? CATASTROPHE_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.cataclysmPriestActingAtPromotion !== null || SEA_KING_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `sea-king-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== SEA_KING_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.cataclysmPriest.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateSeaKingLife(s) && validateSeaKingEncounter(s);
}
export { SEA_KING_ABILITIES } from './content.js';
export { SEA_KING_ABILITY_IDS } from './types.js';
export type * from './types.js';
