import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { MYSTIC_ABILITY_IDS } from '../mystic/types.js';
import { PROPHECY_MASTER_ABILITY_IDS } from '../prophecy-master/types.js';
import { hasProphecyMasterOldPractice, hasProphecyMasterRitualLock } from '../prophecy-master/index.js';
import { hasProphecyMasterLifeLock } from '../prophecy-master/life.js';
import { hasProphecyMasterEncounterLock } from '../prophecy-master/encounter.js';
import { createSageRitualState, applySageRitualCommand, projectSageRitual, sageRitualActions, validateSageRitualState, validateSageRitualCommand, hasSageRitualSceneLock, hasSageStoppedDisaster, reconstructSageRitualState } from './ritual.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createSageLifeState, handleSageLife, projectSageLife, sageLifeActions, validateSageLifeState, validateSageActivityCommand, hasSageLifeLock } from './life.js';
import { createSageEncounterState, applySageEncounterCommand, projectSageEncounter, sageEncounterActions, validateSageEncounter, validateSageEncounterCommand, hasSageEncounterLock } from './encounter.js';
import { SAGE_ABILITIES, SAGE_INHERITED_ABILITIES, SAGE_BOTTLE_IDS, SAGE_CONSUMPTION_RISK, SAGE_FORMULA_STATUS, SAGE_GUIDE, SAGE_LABOUR_STEPS, SAGE_LABOUR_TASKS, SAGE_MIN_PROPHECY_MASTER_WEEKS, SAGE_POTION_SOURCES, SAGE_PREPARATIONS, SAGE_PRICES, SAGE_SOURCE_STATUS } from './content.js';
import { SAGE_ABILITY_IDS, SAGE_PREPARATION_IDS, type SageAcquisitionBudget, type SageAcquisitionEvent, type SageAcquisitionCommand, type SageAction, type SageBottle, type SageCommand, type SageProjection, type SageState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const SAGE_INHERITED_ABILITY_IDS = [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS, ...MYSTIC_ABILITY_IDS, ...PROPHECY_MASTER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = SAGE_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): SageBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createSageState(): SageState {
  return { guidanceKnown: false, bottles: SAGE_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, prophecyMasterActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], ritual: createSageRitualState(), life: createSageLifeState(), encounter: createSageEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isSage = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 2;
export const isSageAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 3;
export const hasSageHistory = (s: SliceState) => (isSage(s) || (s.progression.pathwayId === 'hermit' && s.progression.sequence === 1 && s.knowledgeEmperor?.promotionWeek != null)) && s.sage.promotionWeek !== null;
/** The seven actual Hermit finished-potion histories retain their distinct original bottles. */
function sourceHistory(s: SliceState): boolean {
  if (!s.pryer.discovered || !s.pryer.guidanceKnown) return false;
  const first = s.pryer.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.combatScholar, s.wizard, s.scrollProfessor, s.starMystic, s.mystic, s.prophecyMaster]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.combatScholar.pryerActingAtPromotion === 100 && s.wizard.combatScholarActingAtPromotion === 100 &&
    s.scrollProfessor.wizardActingAtPromotion === 100 && s.starMystic.scrollProfessorActingAtPromotion === 100 &&
    s.mystic.starMysticActingAtPromotion === 100 && s.prophecyMaster.mysticActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isSageAcquisitionStage(s) || hasSageHistory(s)) && sourceHistory(s);
/** These remain historical locks; none widens the exact-stage predecessor command gates. */
export function hasSageOldPractice(s: SliceState): boolean {
  return hasProphecyMasterOldPractice(s) || hasProphecyMasterRitualLock(s) || hasProphecyMasterLifeLock(s) || hasProphecyMasterEncounterLock(s) ||
    s.prophecyMaster.life.playerLocation !== 'START' || Object.values(s.prophecyMaster.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE');
}
const prophecyMasterReportsComplete = (s: SliceState) => s.prophecyMaster.life.reflected &&
  Object.values(s.prophecyMaster.life.cases).length === 3 && Object.values(s.prophecyMaster.life.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1);
export const hasSageOldSceneLock = hasSageOldPractice;
export const hasSageRitualLock = (s: SliceState): boolean => s.sage.preparedWeek !== null || hasSageRitualSceneLock(s);
export const hasSageLock = (s: SliceState): boolean => hasSageRitualLock(s) || hasSageLifeLock(s) || hasSageEncounterLock(s);
const bottleNumber = (b: Pick<SageBottle, 'id'>) => Number(b.id.slice('sage-potion-'.length));
const potionPrice = (b: SageBottle) => SAGE_PRICES.potion - (b.labourSteps === SAGE_LABOUR_STEPS ? SAGE_PRICES.labourCredit : 0);
const prophecyMasterWeeks = (s: SliceState) => Math.max(0, (s.sage.promotionWeek ?? s.week) - (s.prophecyMaster.promotionWeek ?? s.week));
const exhaustedSupply = (state: SageState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${SAGE_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2贤者成品，独立封存编号sage-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => SAGE_PREPARATION_IDS.every(id => s.sage.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `预言大师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.prophecyMaster.promotionWeek === null || prophecyMasterWeeks(s) < SAGE_MIN_PROPHECY_MASTER_WEEKS) return `成为预言大师后已过${prophecyMasterWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!prophecyMasterReportsComplete(s)) return '先完成预言大师的三份实际报告与反思，并收好旧训练现场。';
  if (!hasSageStoppedDisaster(s)) return '必须本人先阻止玻璃名录高层次信息灾难并完成原记录专业复核；疏散、撤退和导师支持不能代替。';
  return hasPreparations(s) ? null : '先分别核对本人阻止灾难的记录、自我锚定与普通离场路线；领取药瓶不能代做专业准备。';
}
export function validateSageAcquisitionCommand(v: unknown): v is SageAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && SAGE_PREPARATION_IDS.includes(v.taskId as typeof SAGE_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^sage-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isSageAcquisitionCommand = validateSageAcquisitionCommand;
export function validateSageCommand(v: unknown): v is SageCommand {
  return validateSageAcquisitionCommand(v) || validateSageRitualCommand(v) || validateSageActivityCommand(v) || validateSageEncounterCommand(v);
}
export function sageAcquisitionBlock(s: SliceState, command: SageAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: SageAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateSageAcquisitionCommand(command)) return '贤者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasSageOldPractice(s)) || hasSageLifeLock(s) || hasSageEncounterLock(s)) return '先停止旧窥视、演练和原场接触，归还借物并沿普通路线离开；当前实践也须收尾。旧人物、故事、原物与伤势继续保留。';
  if (hasSageRitualSceneLock(s)) return '先沿原档案馆普通通道实际回到馆外；灾害未停仍会保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德贤者专业交接处。';
  if (!knownChannel(s)) return '实际成为预言大师并保留原指导渠道后，才能了解贤者之路。';
  if (!isSageAcquisitionStage(s)) return '已经晋升贤者2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '窥秘人至预言大师的11项掌握记录不完整，暂不能继续晋升。';
  const state = s.sage;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < SAGE_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : command.taskId === 'REVIEW_DISASTER' && !hasSageStoppedDisaster(s) ? '必须先亲自停止原灾难、实际离场并完成专业复核，才可核对成功记录。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的贤者原瓶。';
    return s.cash < SAGE_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批贤者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的贤者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选贤者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= SAGE_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: SageAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.sage;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= SAGE_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取贤者独立成品与专业准备指导', `花1行动、500便士。${SAGE_GUIDE}说明原渠道记录。${SAGE_FORMULA_STATUS}${SAGE_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = SAGE_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= SAGE_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(SAGE_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('贤者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批贤者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < SAGE_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`sage-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶贤者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.prophecyMasterActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of SAGE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为贤者', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；预言大师消化100与原11项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满；身体性别和旧伤保持。过去七阶的原瓶、卷轴、材料、原血样、旧公开故事、许可与拒绝、人物身体和原敌伤亡记录全部留存。本人阻止原档案馆灾难与专业复核记录继续保存。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '贤者魔药严重排异' : '贤者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为预言大师，旧消化、掌握、身体、已阻止原灾难、专业复核与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): SageAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: SageState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, prophecyMasterActingAtPromotion: state.prophecyMasterActingAtPromotion,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applySageAcquisition(s: SliceState, command: SageAcquisitionCommand, ctx: SeerContext): void {
  const reason = sageAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: SageAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, pathwayId: 'hermit',
    prophecyMasterPromotionWeek: s.prophecyMaster.promotionWeek!, pryerPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.sage.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, ritualEvents: s.sage.ritual.journal.length, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is SageAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    (v.sequence !== 3 && v.sequence !== 2) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 2 ? SAGE_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateSageAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.sage.acquisitionJournal, expected = createSageState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: SageAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'ritualEvents', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.prophecyMaster.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !integer(raw.ritualEvents, 0, s.sage.ritual.journal.length) || !validateSageAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 3 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'prophecyMasterPromotionWeek', 'pryerPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== s.character.gender ||
        raw.actor.pathwayId !== 'hermit' || raw.actor.prophecyMasterPromotionWeek !== s.prophecyMaster.promotionWeek || raw.actor.pryerPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as SageAcquisitionEvent;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 2) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous!.after.mastery[id]!) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
      }
      const ritual = reconstructSageRitualState(s, event.ritualEvents);
      if (!ritual || ritual.journal.some(e => e.revision >= event.revision || e.week > event.week || compareGameDates(e.date, event.date) > 0) ||
        s.sage.ritual.journal.slice(event.ritualEvents).some(e => e.revision < event.revision)) return false;
      expected.ritual = ritual;
      const b = event.before;
      const shadow: SliceState = { ...s, status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.randomBefore ?? 0 },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'hermit', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, sage: expected };
      let checks = 0;
      const context: SeerContext = { note() {}, roll() { throw new Error('购药准备没有额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || event.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30 ||
          !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) throw new Error('服药随机来源不一致。');
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: 'will', baseAbility: b.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || random.cursor !== event.randomAfter) throw new Error('服药结果与原随机记录不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return check;
      } };
      applyAcquisitionMutation(shadow, event.command, context, true);
      if (!same(acquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.sage))) return false;
    if (previous) {
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.sage.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (isSage(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 2 || previous.after.acting !== 0 ||
        !SAGE_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.sage.prophecyMasterActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.sage.guidanceKnown || isSage(s)) return false;
    return true;
  } catch { return false; }
}

export function applySageCommand(s: SliceState, command: SageCommand, ctx: SeerContext): void {
  if (!validateSageCommand(command)) throw new Error('贤者命令无效。');
  if (validateSageAcquisitionCommand(command)) return applySageAcquisition(s, command, ctx);
  if (validateSageRitualCommand(command)) return applySageRitualCommand(s, command, ctx);
  if (validateSageActivityCommand(command)) return handleSageLife(s, command, ctx);
  if (validateSageEncounterCommand(command)) return applySageEncounterCommand(s, command, ctx);
  throw new Error('未知贤者命令。');
}

/** Recommend an actual forward step without treating cancel/permission withdrawal
 * as the ordinary next action merely because its zero-cost button is listed first. */
function preferredSageAction(s: SliceState, actions: SageAction[]): SageAction | undefined {
  const enabled = actions.filter(a => a.enabled), pick = (type: SageCommand['type']) => enabled.find(a => a.command.type === type);
  const walk = (to: 'ENTRY' | 'A' | 'B') => enabled.find(a => a.command.type === 'WALK' && a.command.to === to);
  const l = s.sage.life, id = l.activeCase, attempt = id ? l.cases[id].attempts.at(-1) : null;
  if (isSage(s) && id && attempt) {
    const p = l.site;
    if (p.body === 'INFORMATION') return (!attempt.traversed ? pick('TRAVERSE_CONDUIT') : undefined) ?? pick('REASSEMBLE') ?? pick('STOP');
    const complete = id === 'information-route' ? attempt.traversed && attempt.reassembled || attempt.verified : attempt.verified;
    const closing = complete || attempt.stopped || attempt.permissionWithdrawn || attempt.consent !== 'GRANTED';
    let next: SageAction | undefined;
    if (closing) {
      if (p.playerLocation === 'B') next = walk('A');
      else if (p.playerLocation === 'A') next = pick('REMOVE_ANCHOR') ?? walk('ENTRY');
      else if (p.playerLocation === 'ENTRY') next = pick('RETURN_OWNER') ?? pick('RETURN_ITEMS') ?? pick('INSPECT') ?? pick('LEAVE');
    } else if (p.playerLocation === 'ENTRY') next = pick('INVITE_OWNER') ?? walk('A');
    else if (p.playerLocation === 'A') next = pick('INSTALL_ANCHOR') ?? pick('INFORMATION_FORM') ?? walk('B');
    else if (p.playerLocation === 'B') next = pick('SIFT_INFORMATION') ?? pick('READ_ARCHIVE') ?? pick('VERIFY_INFORMATION');
    if (next) return next;
    return pick('STOP') ?? enabled[0];
  }
  return enabled.find(a => !['RITUAL_RETREAT', 'LEAVE_PREPARATION', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_10'].includes(a.command.type)) ?? enabled[0];
}

export function projectSage(s: SliceState): SageProjection {
  const state = s.sage, available = knownChannel(s), promoted = hasSageHistory(s), actions: SageAction[] = [];
  const add = (id: string, label: string, cost: string, command: SageAcquisitionCommand) => { const reason = sageAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-sage-guidance', '听取贤者成品与灾难仪式指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of SAGE_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`sage-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-sage-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-sage-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-sage-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-sage-supply', '申请下一批独立贤者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${SAGE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶贤者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 预言大师消化${s.progression.acting}/100 · ${prophecyMasterWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions = available ? [...sageRitualActions(s), ...actions, ...sageLifeActions(s), ...sageEncounterActions(s)] : [];
  const preferred = preferredSageAction(s, allActions);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '贤者·隐者序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${SAGE_FORMULA_STATUS}${SAGE_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : allActions.find(a => a.reason)?.reason ?? (promoted ? '已完成的记录保留，可继续正常生活。' : '先走完预言大师之路。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 贤者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为预言大师' : '排异，仍为预言大师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? SAGE_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...SAGE_INHERITED_ABILITIES, ...SAGE_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `预言大师消化${state.prophecyMasterActingAtPromotion}/100留存；贤者扮演${s.progression.acting}/100。晋升后三项生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。原灾难仪式不替代生活报告。` : available ? `预言大师需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${prophecyMasterWeeks(s)}/12），完成三份旧报告和反思；还须本人阻止真实高层次灾难、专业复核、三项准备与当周场地检查。` : '先走完预言大师之路。',
    pollution: s.seer.pollution, risk: available ? SAGE_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender, appearanceRecord: available ? `原创建年龄${s.character.age}岁、当前性别${s.character.gender}。本次晋升不改写身体、外观与旧伤。` : '',
    inheritedTools: available ? `原厚镜片眼镜SM5-LENS-1：${s.starMystic.practice.lenses}。旧工坊现有原卷${s.scrollProfessor.workshop.scrolls.filter(scroll => scroll.status === 'HELD').length}张、已耗${s.scrollProfessor.workshop.scrolls.filter(scroll => scroll.status === 'USED').length}张；原材料、制作序列与掌握保留，使用仍须实际消耗同一现存原卷。` : '',
    inheritedHistory: available ? [
      `预言大师在第${s.prophecyMaster.promotionWeek}周实际晋升；${promoted ? `当时消化${state.prophecyMasterActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：窥秘人${s.combatScholar.pryerActingAtPromotion}、格斗学者${s.wizard.combatScholarActingAtPromotion}、巫师${s.scrollProfessor.wizardActingAtPromotion}、卷轴教授${s.starMystic.scrollProfessorActingAtPromotion}、星象师${s.mystic.starMysticActingAtPromotion}、神秘学家${s.prophecyMaster.mysticActingAtPromotion}、预言大师${promoted ? state.prophecyMasterActingAtPromotion : s.progression.acting}。`,
      '前七阶11项技巧保持原ID与掌握，两项新技巧从0开始，共13项。旧掌握0仍为0，不因晋升自动精熟。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实诊疗和休养。`,
      `原滴${s.mystic.ritual.sample.id}：${s.mystic.ritual.sample.status}，原分析与归还记录留存，不另赠另一滴或命运能力。`,
      `原故事${s.mystic.life.story.id}：实际知情者${s.mystic.life.story.readerIds.length}人；${s.mystic.life.publicDisclosed ? '已公开，迟钟回声效力继续15%，不能收回已知信息' : '按原访问范围与实际已学内容使用'}，不赠新故事库。`,
      `原卢坎${s.mystic.encounter.targetId}：${s.mystic.encounter.enemyStatus}，健康${s.mystic.encounter.enemyHealth}/100、精神${s.mystic.encounter.enemyMind}/100，伤势${s.mystic.encounter.enemyInjuries.length}处；旧战果不重开。`,
      `原奥斯里克：${s.prophecyMaster.encounter.enemyStatus}，健康${s.prophecyMaster.encounter.enemyHealth}/100、精神${s.prophecyMaster.encounter.enemyMind}/100、灵性${s.prophecyMaster.encounter.enemySpirituality}，原伤势${s.prophecyMaster.encounter.enemyInjuries.length}处；晋升不治疗或复活旧对手。`,
      '预言大师原仓库的成年人、原页、排班册、原铃、封包、签收与封存教学件继续保留；旧许可不能代替新案同意。',
    ] : [],
    ritual: projectSageRitual(s), life: projectSageLife(s), encounter: projectSageEncounter(s), insideCase: hasSageLock(s),
    environment: available ? '原旧档案馆：馆外0米、门厅6米、刻印板间12米、索引间16米、唯一原核心间22米。每次沿实际通道走回，原馆保持封闭；两名成年人有各自身体与原伤。贤者生活练习只在成功晋升后开放，使用独立实践场地。' : '',
  };
}

/** The two independently replayed journals also share one real resource/RNG timeline. */
export function validateSageJournalContinuity(s: SliceState): boolean {
  try {
    const events = [...s.sage.acquisitionJournal, ...s.sage.ritual.journal].sort((a, b) => a.revision - b.revision);
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 2) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous.after.mastery[id]!) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    return true;
  } catch { return false; }
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateSageState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.sage;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'prophecyMasterActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== SAGE_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as SageState, promoted = isSage(s), acquisitionStage = isSageAcquisitionStage(s);
  const firstWeek = s.prophecyMaster.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + SAGE_MIN_PROPHECY_MASTER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > SAGE_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !SAGE_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasSageOldPractice(s) || hasSageRitualSceneLock(s) || !hasSageStoppedDisaster(s) || hasSageLifeLock(s) || hasSageEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.prophecyMaster.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.prophecyMasterActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !prophecyMasterReportsComplete(s) || !hasSageStoppedDisaster(s) || hasSageOldPractice(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...SAGE_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.prophecyMasterActingAtPromotion !== null || SAGE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `sage-potion-${index + 1}` || !integer(b.labourSteps, 0, SAGE_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < SAGE_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== SAGE_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % SAGE_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek || state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.prophecyMaster.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateSageAcquisitionJournal(s) || !validateSageRitualState(s) || !validateSageJournalContinuity(s) || !validateSageLifeState(s) || !validateSageEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { SAGE_ABILITIES } from './content.js';
export { SAGE_ABILITY_IDS } from './types.js';
export type * from './types.js';

export { applySageRitualCommand, validateSageRitualCommand, validateSageRitualState, hasSageStoppedDisaster } from './ritual.js';
