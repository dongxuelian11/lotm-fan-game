import { BEAUTY_GODDESS_ABILITY_IDS } from '../beauty-goddess/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../potion-professor/types.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS } from '../crimson-scholar/types.js';
import { WITCH_KING_ABILITY_IDS } from '../witch-king/types.js';
import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import { hasWitchKingRitualLock } from '../witch-king/ritual.js';
import { hasWitchKingLifeLock } from '../witch-king/life.js';
import { hasWitchKingEncounterLock } from '../witch-king/encounter.js';
import { createSummoningMasterLifeState, applySummoningMasterActivity, projectSummoningMasterLife, summoningMasterLifeActions, validateSummoningMasterLife, validateSummoningMasterActivityCommand, hasSummoningMasterLifeLock } from './life.js';
import { createSummoningMasterEncounterState, applySummoningMasterEncounterCommand, projectSummoningMasterEncounter, summoningMasterEncounterActions, validateSummoningMasterEncounter, validateSummoningMasterEncounterCommand, hasSummoningMasterEncounterLock } from './encounter.js';
import { SUMMONING_MASTER_ABILITIES, SUMMONING_MASTER_BOTTLE_IDS, SUMMONING_MASTER_CONSUMPTION_RISK, SUMMONING_MASTER_FORMULA_STATUS, SUMMONING_MASTER_GUIDE, SUMMONING_MASTER_LABOUR_STEPS, SUMMONING_MASTER_LABOUR_TASKS, SUMMONING_MASTER_MIN_WITCH_KING_WEEKS, SUMMONING_MASTER_POTION_SOURCES, SUMMONING_MASTER_PREPARATIONS, SUMMONING_MASTER_PRICES, SUMMONING_MASTER_SOURCE_STATUS } from './content.js';
import { SUMMONING_MASTER_ABILITY_IDS, SUMMONING_MASTER_PREPARATION_IDS, type SummoningMasterAcquisitionCommand, type SummoningMasterAction, type SummoningMasterBottle, type SummoningMasterCommand, type SummoningMasterProjection, type SummoningMasterState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): SummoningMasterBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createSummoningMasterState(): SummoningMasterState {
  return { guidanceKnown: false, bottles: SUMMONING_MASTER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, witchKingActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createSummoningMasterLifeState(), encounter: createSummoningMasterEncounterState() };
}
export const isSummoningMaster = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 3;
const hasSummoningMasterHistory = (s: SliceState) => s.progression.pathwayId === 'moon' && [3, 2, 1].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'moon' && [4, 3, 2, 1].includes(s.progression.sequence ?? 0) && s.apothecary.discovered && s.witchKing.guidanceKnown && s.witchKing.promotionWeek !== null;
export const hasSummoningMasterLock = (s: SliceState): boolean => s.summoningMaster.preparedWeek !== null || hasSummoningMasterLifeLock(s) || hasSummoningMasterEncounterLock(s);
const bottleNumber = (b: Pick<SummoningMasterBottle, 'id'>) => Number(b.id.slice('summoning-master-potion-'.length));
const potionPrice = (b: SummoningMasterBottle) => SUMMONING_MASTER_PRICES.potion - (b.labourSteps === SUMMONING_MASTER_LABOUR_STEPS ? SUMMONING_MASTER_PRICES.labourCredit : 0);
const witchKingWeeks = (s: SliceState) => Math.max(0, (s.summoningMaster.promotionWeek ?? s.week) - (s.witchKing.promotionWeek ?? s.week));
const exhaustedSupply = (state: SummoningMasterState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${SUMMONING_MASTER_GUIDE}的独立召唤大师成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶summoning-master-potion-${number}；非巫王或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => SUMMONING_MASTER_PREPARATION_IDS.every(id => s.summoningMaster.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `巫王魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.witchKing.promotionWeek === null || witchKingWeeks(s) < SUMMONING_MASTER_MIN_WITCH_KING_WEEKS) return `成为巫王后已过${witchKingWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成联系来源核对、原地点与返回路线检查、关门撤离演练；购买原瓶不能代做专业准备。';
}
export function validateSummoningMasterAcquisitionCommand(v: unknown): v is SummoningMasterAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && SUMMONING_MASTER_PREPARATION_IDS.includes(v.taskId as typeof SUMMONING_MASTER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^summoning-master-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isSummoningMasterAcquisitionCommand = validateSummoningMasterAcquisitionCommand;
export function validateSummoningMasterCommand(v: unknown): v is SummoningMasterCommand {
  return validateSummoningMasterAcquisitionCommand(v) || validateSummoningMasterActivityCommand(v) || validateSummoningMasterEncounterCommand(v);
}
export function summoningMasterAcquisitionBlock(s: SliceState, command: SummoningMasterAcquisitionCommand): string | null {
  if (!validateSummoningMasterAcquisitionCommand(command)) return '召唤大师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasWitchKingRitualLock(s) || hasWitchKingLifeLock(s) || hasWitchKingEncounterLock(s) ||
      Object.values(s.witchKing.life.cases).some(v => v.status === 'PREPARED') ||
      s.crimsonScholar.ritual.activeVisitId !== null ||
      Object.values(s.crimsonScholar.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' ||
      Object.values(s.potionProfessor.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      Object.values(s.potionProfessor.laboratory.effects).some(Boolean) || s.tamer.companionId !== null ||
      hasSummoningMasterLifeLock(s) || hasSummoningMasterEncounterLock(s)) return '先实际收束旧仪式、月光场、原物实践与现场接触，并让同行原动物回原主人处；不能同时占用原场或沿用旧同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原私人仪式厅旁的指导场。';
  if (!knownChannel(s)) return '实际成为巫王并保留原指导渠道后，才能了解召唤大师之路。';
  if (hasSummoningMasterHistory(s)) return '已经真实晋升召唤大师3，不能重复准备或服药；未服原瓶保留。';
  const state = s.summoningMaster;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < SUMMONING_MASTER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的召唤大师原瓶。';
    return s.cash < SUMMONING_MASTER_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批召唤大师原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的召唤大师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选召唤大师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= SUMMONING_MASTER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applySummoningMasterAcquisition(s: SliceState, command: SummoningMasterAcquisitionCommand, ctx: SeerContext): void {
  const reason = summoningMasterAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.summoningMaster;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= SUMMONING_MASTER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取召唤大师独立成品与专业准备指导', `花1行动、500便士。${SUMMONING_MASTER_GUIDE}说明原渠道记录。${SUMMONING_MASTER_FORMULA_STATUS}${SUMMONING_MASTER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = SUMMONING_MASTER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= SUMMONING_MASTER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(SUMMONING_MASTER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('召唤大师独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠来客、灵魂、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批召唤大师成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < SUMMONING_MASTER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`summoning-master-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶召唤大师原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.witchKingActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of SUMMONING_MASTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为召唤大师', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；巫王消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；原血食、驯兽动物、旧原瓶、灵材与原纸保留，旧靶仍破损，原多里安既有伤势和原棍去向不变。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '召唤大师魔药严重排异' : '召唤大师魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为巫王，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applySummoningMasterCommand(s: SliceState, command: SummoningMasterCommand, ctx: SeerContext): void {
  if (!validateSummoningMasterCommand(command)) throw new Error('召唤大师命令无效。');
  if (validateSummoningMasterAcquisitionCommand(command)) return applySummoningMasterAcquisition(s, command, ctx);
  if (validateSummoningMasterActivityCommand(command)) return applySummoningMasterActivity(s, command, ctx);
  if (validateSummoningMasterEncounterCommand(command)) return applySummoningMasterEncounterCommand(s, command, ctx);
  throw new Error('未知召唤大师命令。');
}

export function projectSummoningMaster(s: SliceState): SummoningMasterProjection {
  const state = s.summoningMaster, available = knownChannel(s), promoted = hasSummoningMasterHistory(s), actions: SummoningMasterAction[] = [];
  const acting = promoted ? ((s.progression.sequence === 2||s.progression.sequence===1) ? s.lifeGiver.summoningMasterActingAtPromotion ?? 0 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SummoningMasterAcquisitionCommand) => { const reason = summoningMasterAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-summoning-master-guidance', '听取召唤大师成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of SUMMONING_MASTER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`summoning-master-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-summoning-master-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-summoning-master-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-summoning-master-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-summoning-master-supply', '申请下一批独立召唤大师成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${SUMMONING_MASTER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶召唤大师魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 巫王消化${s.progression.acting}/100 · ${witchKingWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '召唤大师 · 序列3' : '召唤大师之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${SUMMONING_MASTER_FORMULA_STATUS}${SUMMONING_MASTER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...summoningMasterLifeActions(s), ...summoningMasterEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 召唤大师成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为巫王' : '排异，仍为巫王'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? SUMMONING_MASTER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? SUMMONING_MASTER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `巫王消化${state.witchKingActingAtPromotion}/100留存；召唤大师扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `巫王需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${witchKingWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完巫王之路。',
    pollution: s.seer.pollution, risk: available ? SUMMONING_MASTER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `巫王第${s.witchKing.promotionWeek}周真实晋升；${promoted ? `原消化${state.witchKingActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '药师至巫王的全部原ID与掌握、原实践、原血食、驯兽动物、旧瓶与原灵材保留；本次不改变身体性别。',
      ...s.witchKing.life.papers.map(p => `唯一原纸${p.id}：${p.status === 'CONSUMED' ? '已耗尽，不补回' : p.status === 'PREPARED' ? '已明确准备，未耗尽' : '实际持有，尚未准备'}；旧交付与使用周记录保留。`),
      `原靶${s.witchKing.life.target.id}：${s.witchKing.life.target.status === 'BROKEN' ? '已经破损，不重置' : s.witchKing.life.target.status === 'MARKED' ? '保留原命中痕迹' : '原靶完整'}。原案夹${s.witchKing.life.practice.folio.id}仍在${s.witchKing.life.practice.folio.location}。`,
      ...(s.witchKing.encounter.approachWeek === null ? [] : [`原多里安WK4-DORIAN：健康${s.witchKing.encounter.enemy.health}/100、精神${s.witchKing.encounter.enemy.mind}/100；${s.witchKing.encounter.enemy.status === 'DEAD' ? '已死亡，不会复活' : s.witchKing.encounter.enemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : '仍为独立原人'}。原棍${s.witchKing.encounter.enemy.weaponId}${s.witchKing.encounter.enemy.weaponLocation === 'HAND' ? '仍在他手中' : '仍在原院地面'}，不因新晋升复原。`]),
      `原伊尔玛WK4-IRMA${s.witchKing.life.instructor.alive ? '仍活着' : '已经死亡'}、原格蕾丝WK4-GRACE${s.witchKing.ritual.expert.alive ? '仍活着' : '已经死亡'}，旧身份与本人状态不复制、不替换；新来客流灯须由本人当面核实并逐次同意，不是旧动物改名。`,
    ] : [],
    life: projectSummoningMasterLife(s), encounter: projectSummoningMasterEncounter(s), insideCase: hasSummoningMasterLock(s),
    environment: available ? '贝克兰德原私人仪式厅WK4-HALL旁的独立玻璃暖房SM3-GLASS-ROOM与30米外小石院，实际普通小径和原出口开放。唯一原创G低强成年来客SM3-LUMEN流灯已有自己的居处与原声片SM3-CHIME；39岁成年艾达SM3-ADA39的唯一测试牌只有200克。联系、开门、合作、同意与返程均须实际完成。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateSummoningMasterState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.summoningMaster;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'witchKingActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as SummoningMasterState, promoted = hasSummoningMasterHistory(s), firstWeek = s.witchKing.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + SUMMONING_MASTER_MIN_WITCH_KING_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !SUMMONING_MASTER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasSummoningMasterLifeLock(s) || hasSummoningMasterEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.witchKing.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.witchKingActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?BEAUTY_GODDESS_ABILITY_IDS:[]),...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS, ...WITCH_KING_ABILITY_IDS, ...SUMMONING_MASTER_ABILITY_IDS, ...((s.progression.sequence === 2||s.progression.sequence===1) ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.witchKingActingAtPromotion !== null || SUMMONING_MASTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `summoning-master-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== SUMMONING_MASTER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.witchKing.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateSummoningMasterLife(s) && validateSummoningMasterEncounter(s);
}
export { SUMMONING_MASTER_ABILITIES } from './content.js';
export { SUMMONING_MASTER_ABILITY_IDS } from './types.js';
export type * from './types.js';
