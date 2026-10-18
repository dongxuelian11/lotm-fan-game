import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../zombie/types.js';
import { WRAITH_ABILITY_IDS } from '../wraith/types.js';
import { PUPPET_ABILITY_IDS } from '../puppet/types.js';
import { SILENT_DISCIPLE_ABILITY_IDS } from '../silent-disciple/types.js';
import { hasSilentDiscipleOldPractice, hasSilentDiscipleRitualLock } from '../silent-disciple/index.js';
import { hasSilentDiscipleLifeLock } from '../silent-disciple/life.js';
import { hasSilentDiscipleEncounterLock } from '../silent-disciple/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createAncientEvilLifeState, handleAncientEvilLife, projectAncientEvilLife, ancientEvilLifeActions, validateAncientEvilLifeState, validateAncientEvilActivityCommand, hasAncientEvilLifeLock } from './life.js';
import { createAncientEvilEncounterState, applyAncientEvilEncounterCommand, projectAncientEvilEncounter, ancientEvilEncounterActions, validateAncientEvilEncounter, validateAncientEvilEncounterCommand, hasAncientEvilEncounterLock } from './encounter.js';
import { ANCIENT_EVIL_ABILITIES, ANCIENT_EVIL_INHERITED_ABILITIES, ANCIENT_EVIL_BOTTLE_IDS, ANCIENT_EVIL_CONSUMPTION_RISK, ANCIENT_EVIL_FORMULA_STATUS, ANCIENT_EVIL_GUIDE, ANCIENT_EVIL_LABOUR_STEPS, ANCIENT_EVIL_LABOUR_TASKS, ANCIENT_EVIL_MIN_SILENT_DISCIPLE_WEEKS, ANCIENT_EVIL_POTION_SOURCES, ANCIENT_EVIL_PREPARATIONS, ANCIENT_EVIL_PRICES, ANCIENT_EVIL_SOURCE_STATUS } from './content.js';
import { ANCIENT_EVIL_ABILITY_IDS, ANCIENT_EVIL_PREPARATION_IDS, type AncientEvilAcquisitionBudget, type AncientEvilAcquisitionEvent, type AncientEvilAcquisitionCommand, type AncientEvilAction, type AncientEvilBottle, type AncientEvilCommand, type AncientEvilProjection, type AncientEvilState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const ANCIENT_EVIL_INHERITED_ABILITY_IDS = [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS, ...ZOMBIE_ABILITY_IDS, ...WRAITH_ABILITY_IDS, ...PUPPET_ABILITY_IDS, ...SILENT_DISCIPLE_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = ANCIENT_EVIL_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): AncientEvilBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createAncientEvilState(): AncientEvilState {
  return { guidanceKnown: false, bottles: ANCIENT_EVIL_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, silentDiscipleActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], life: createAncientEvilLifeState(), encounter: createAncientEvilEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isAncientEvil = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 2;
export const isAncientEvilAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 3;
export const hasAncientEvilHistory = (s: SliceState) => isAncientEvil(s) && s.ancientEvil.promotionWeek !== null;
/** Seven actual Chained finished-potion histories retain their distinct original bottles. */
function sourceHistory(s: SliceState): boolean {
  if (!s.prisoner.discovered || !s.prisoner.guidanceKnown) return false;
  const first = s.prisoner.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.madman, s.werewolf, s.zombie, s.wraith, s.puppet, s.silentDisciple]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.madman.prisonerActingAtPromotion === 100 && s.werewolf.madmanActingAtPromotion === 100 &&
    s.zombie.werewolfActingAtPromotion === 100 && s.wraith.zombieActingAtPromotion === 100 &&
    s.puppet.wraithActingAtPromotion === 100 && s.silentDisciple.puppetActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isAncientEvilAcquisitionStage(s) || isAncientEvil(s)) && sourceHistory(s);
/** These remain historical locks; none widens the exact-stage predecessor command gates. */
export function hasAncientEvilOldPractice(s: SliceState): boolean {
  return hasSilentDiscipleOldPractice(s) || hasSilentDiscipleRitualLock(s) || hasSilentDiscipleLifeLock(s) || hasSilentDiscipleEncounterLock(s) ||
    s.silentDisciple.life.playerLocation !== 'START' || Object.values(s.silentDisciple.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE');
}
const silentDiscipleReportsComplete = (s: SliceState) => s.silentDisciple.life.reflected &&
  Object.values(s.silentDisciple.life.cases).length === 3 && Object.entries(s.silentDisciple.life.cases).every(([id, c]) => c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 &&
    c.attempts.every(attempt => attempt.week <= s.week) && s.seer.completedSources.includes(`silent-disciple-life-${id}`)) &&
  s.seer.completedSources.includes('silent-disciple-reflection');
export const hasAncientEvilOldSceneLock = hasAncientEvilOldPractice;
export const hasAncientEvilRitualLock = (s: SliceState): boolean => s.ancientEvil.preparedWeek !== null;
export const hasAncientEvilLock = (s: SliceState): boolean => hasAncientEvilRitualLock(s) || hasAncientEvilLifeLock(s) || hasAncientEvilEncounterLock(s);
const bottleNumber = (b: Pick<AncientEvilBottle, 'id'>) => Number(b.id.slice('ancient-evil-potion-'.length));
const potionPrice = (b: AncientEvilBottle) => ANCIENT_EVIL_PRICES.potion - (b.labourSteps === ANCIENT_EVIL_LABOUR_STEPS ? ANCIENT_EVIL_PRICES.labourCredit : 0);
const silentDiscipleWeeks = (s: SliceState) => Math.max(0, (s.ancientEvil.promotionWeek ?? s.week) - (s.silentDisciple.promotionWeek ?? s.week));
const exhaustedSupply = (state: AncientEvilState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${ANCIENT_EVIL_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2古代邪物成品，独立封存编号ancient-evil-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => ANCIENT_EVIL_PREPARATION_IDS.every(id => s.ancientEvil.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `沉默门徒魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.silentDisciple.promotionWeek === null || silentDiscipleWeeks(s) < ANCIENT_EVIL_MIN_SILENT_DISCIPLE_WEEKS) return `成为沉默门徒后已过${silentDiscipleWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!silentDiscipleReportsComplete(s)) return '先完成沉默门徒的三份实际报告与反思，并收好旧训练现场。';
  return hasPreparations(s) ? null : '先分别核对七阶原瓶与既往记录、持续变形及同源解咒和普通离场路线；领取药瓶不能代做专业准备。';
}
export function validateAncientEvilAcquisitionCommand(v: unknown): v is AncientEvilAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && ANCIENT_EVIL_PREPARATION_IDS.includes(v.taskId as typeof ANCIENT_EVIL_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^ancient-evil-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isAncientEvilAcquisitionCommand = validateAncientEvilAcquisitionCommand;
export function validateAncientEvilCommand(v: unknown): v is AncientEvilCommand {
  return validateAncientEvilAcquisitionCommand(v) || validateAncientEvilActivityCommand(v) || validateAncientEvilEncounterCommand(v);
}
export function ancientEvilAcquisitionBlock(s: SliceState, command: AncientEvilAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: AncientEvilAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAncientEvilAcquisitionCommand(command)) return '古代邪物准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasAncientEvilOldPractice(s)) || hasAncientEvilLifeLock(s) || hasAncientEvilEncounterLock(s)) return '先收束旧接触、原身体形态和诅咒联系，归还原衣物与原包，处理旧月相并沿普通路线离开；当前实践也须收尾。旧人物、原物、伤势与旧后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原旧工坊旁的安静房间与专业交接处。';
  if (!knownChannel(s)) return '实际成为沉默门徒并保留原指导渠道后，才能了解古代邪物之路。';
  if (!isAncientEvilAcquisitionStage(s)) return '已经晋升古代邪物2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '囚犯至沉默门徒的17项掌握记录不完整，暂不能继续晋升。';
  const state = s.ancientEvil;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < ANCIENT_EVIL_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的古代邪物原瓶。';
    return s.cash < ANCIENT_EVIL_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批古代邪物原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的古代邪物准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选古代邪物独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ANCIENT_EVIL_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: AncientEvilAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.ancientEvil;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= ANCIENT_EVIL_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取古代邪物独立成品与专业准备指导', `花1行动、500便士。${ANCIENT_EVIL_GUIDE}说明原渠道记录。${ANCIENT_EVIL_FORMULA_STATUS}${ANCIENT_EVIL_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = ANCIENT_EVIL_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= ANCIENT_EVIL_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(ANCIENT_EVIL_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('古代邪物独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批古代邪物成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < ANCIENT_EVIL_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`ancient-evil-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶古代邪物原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.silentDiscipleActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of ANCIENT_EVIL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为古代邪物', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；沉默门徒消化100与原17项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满；身体性别和旧伤保持。过去七阶的原瓶、劳务、许可与拒绝、人物身体、原物和原敌伤亡记录全部留存。原身体、人物、衣物、旧月相和诅咒后果保留；新能力仍须抵抗与解除，不免费取消全部能力、不治疗或复活。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '古代邪物魔药严重排异' : '古代邪物魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为沉默门徒，旧消化、掌握、身体与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): AncientEvilAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: AncientEvilState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, silentDiscipleActingAtPromotion: state.silentDiscipleActingAtPromotion,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyAncientEvilAcquisition(s: SliceState, command: AncientEvilAcquisitionCommand, ctx: SeerContext): void {
  const reason = ancientEvilAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: AncientEvilAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, pathwayId: 'chained',
    silentDisciplePromotionWeek: s.silentDisciple.promotionWeek!, prisonerPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.ancientEvil.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is AncientEvilAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    (v.sequence !== 3 && v.sequence !== 2) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 2 ? ANCIENT_EVIL_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateAncientEvilAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.ancientEvil.acquisitionJournal, expected = createAncientEvilState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: AncientEvilAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.silentDisciple.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAncientEvilAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 3 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'silentDisciplePromotionWeek', 'prisonerPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== s.character.gender ||
        raw.actor.pathwayId !== 'chained' || raw.actor.silentDisciplePromotionWeek !== s.silentDisciple.promotionWeek || raw.actor.prisonerPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as AncientEvilAcquisitionEvent;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 2) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous!.after.mastery[id]!) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.randomBefore ?? 0 },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'chained', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, ancientEvil: expected };
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
    if (!same(acquisitionState(expected), acquisitionState(s.ancientEvil))) return false;
    if (previous) {
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.ancientEvil.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || previous.randomAfter !== null && s.random.cursor !== previous.randomAfter)) return false;
      if (isAncientEvil(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 2 || previous.after.acting !== 0 ||
        !ANCIENT_EVIL_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.ancientEvil.silentDiscipleActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.ancientEvil.guidanceKnown || isAncientEvil(s)) return false;
    return true;
  } catch { return false; }
}

export function applyAncientEvilCommand(s: SliceState, command: AncientEvilCommand, ctx: SeerContext): void {
  if (!validateAncientEvilCommand(command)) throw new Error('古代邪物命令无效。');
  if (validateAncientEvilAcquisitionCommand(command)) return applyAncientEvilAcquisition(s, command, ctx);
  if (validateAncientEvilActivityCommand(command)) return handleAncientEvilLife(s, command, ctx);
  if (validateAncientEvilEncounterCommand(command)) return applyAncientEvilEncounterCommand(s, command, ctx);
  throw new Error('未知古代邪物命令。');
}

/** Prefer the open scene's own concrete next step, otherwise a forward action. */
function preferredAncientEvilAction(s: SliceState, actions: AncientEvilAction[]): AncientEvilAction | undefined {
  const enabled = actions.filter(action => action.enabled);
  const life = projectAncientEvilLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.id === preferredId) ?? enabled.find(action => !['LEAVE_PREPARATION', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_FORM', 'BUY_BLOCKS'].includes(action.command.type)) ?? enabled[0];
}

export function projectAncientEvil(s: SliceState): AncientEvilProjection {
  const state = s.ancientEvil, available = knownChannel(s), promoted = isAncientEvil(s), actions: AncientEvilAction[] = [];
  const add = (id: string, label: string, cost: string, command: AncientEvilAcquisitionCommand) => { const reason = ancientEvilAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-ancient-evil-guidance', '听取古代邪物成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of ANCIENT_EVIL_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`ancient-evil-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-ancient-evil-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-ancient-evil-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-ancient-evil-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-ancient-evil-supply', '申请下一批独立古代邪物成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${ANCIENT_EVIL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶古代邪物魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 沉默门徒消化${s.progression.acting}/100 · ${silentDiscipleWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions = available ? [...actions, ...ancientEvilLifeActions(s), ...ancientEvilEncounterActions(s)] : [];
  const preferred = preferredAncientEvilAction(s, allActions);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '古代邪物·被缚者序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${ANCIENT_EVIL_FORMULA_STATUS}${ANCIENT_EVIL_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : allActions.find(a => a.reason)?.reason ?? (promoted ? '已完成的记录保留，可继续正常生活。' : '先走完沉默门徒之路。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 古代邪物成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为沉默门徒' : '排异，仍为沉默门徒'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? ANCIENT_EVIL_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...ANCIENT_EVIL_INHERITED_ABILITIES, ...ANCIENT_EVIL_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `沉默门徒消化${state.silentDiscipleActingAtPromotion}/100留存；古代邪物扮演${s.progression.acting}/100。晋升后三项生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。晋升准备不替代生活报告。` : available ? `沉默门徒需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${silentDiscipleWeeks(s)}/12），完成三份旧报告和反思；另须三项专业准备与当周场地检查。` : '先走完沉默门徒之路。',
    pollution: s.seer.pollution, risk: available ? ANCIENT_EVIL_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender, appearanceRecord: available ? `原创建年龄${s.character.age}岁、当前性别${s.character.gender}。本次晋升不改写身体、外观与旧伤。` : '',
    inheritedTools: available ? `原安静房间、埃尔莎的原衣物与原包、私密原盘与原纸继续使用。原衣物当前${s.silentDisciple.life.clothing.location === 'ELSA' ? '由埃尔莎本人穿持' : '在原盘上'}，原包当前${s.silentDisciple.life.bag.location === 'ELSA' ? '由埃尔莎本人持有' : '在原盘上'}。原身体形态与诅咒联系须实际收束；晋升不复制、返还或补满任何资源。` : '',
    inheritedHistory: available ? [
      `沉默门徒在第${s.silentDisciple.promotionWeek}周实际晋升；${promoted ? `原消化${state.silentDiscipleActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：囚犯${s.madman.prisonerActingAtPromotion}、疯子${s.werewolf.madmanActingAtPromotion}、狼人${s.zombie.werewolfActingAtPromotion}、活尸${s.wraith.zombieActingAtPromotion}、怨魂${s.puppet.wraithActingAtPromotion}、木偶${s.silentDisciple.puppetActingAtPromotion}、沉默门徒${promoted ? state.silentDiscipleActingAtPromotion : s.progression.acting}。`,
      '前七阶17项技巧保持原ID与掌握，两项新技巧从0开始，共19项。旧掌握0仍为0，不因晋升自动精熟。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实诊疗和休养。`,
      `原埃德林：${s.puppet.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.puppet.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍有抵抗能力'}，健康${s.puppet.encounter.enemyHealth}/100、精神${s.puppet.encounter.enemyMind}/100、灵性${s.puppet.encounter.enemySpirituality}，原伤势${s.puppet.encounter.enemyInjuries.length}处。`,
      `原卡尔德：${s.silentDisciple.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.silentDisciple.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍有抵抗能力'}，健康${s.silentDisciple.encounter.enemyHealth}/100、精神${s.silentDisciple.encounter.enemyMind}/100、灵性${s.silentDisciple.encounter.enemySpirituality}，原伤势${s.silentDisciple.encounter.enemyInjuries.length}处。晋升不治疗、重开或复活旧对手。`,
      '同一埃尔莎、原导师哈伦、原衣物、原包、原盘与原纸继续保留；旧许可不能代替新案同意，拒绝仍须尊重。旧月相经历保留，本阶段不会重复收取旧发作的代价。',
    ] : [],
    life: projectAncientEvilLife(s), encounter: projectAncientEvilEncounter(s), insideCase: hasAncientEvilLock(s),
    environment: available ? '同一安静房间：从门口到四米处，再向前四米抵达八米处。本人沿原路实际步行，埃尔莎43岁、原导师哈伦、原衣物、原包、原盘与原纸保持同一实体。生活练习须成功晋升后逐案重新征得同意，有限施用后真实还原、归物并离场；普通核对始终可行。' : '',
  };
}

/** Acquisition uses one chronological resource/RNG timeline, never a fabricated successful bottle. */
export function validateAncientEvilJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.ancientEvil.acquisitionJournal;
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
    // Acquisition and life independently replay, but must share the same resources
    // and random stream at every directly adjacent commit across the boundary.
    type SharedBudget = Pick<AncientEvilAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { phase: 'ACQUISITION' | 'LIFE' | 'ENCOUNTER'; week: number; date: PublicGameDate | null; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (b: SharedBudget): SharedBudget => ({ actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash });
    const timeline: Timeline[] = events.map(event => ({ phase: 'ACQUISITION', week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null }));
    const promotion = events.find(event => event.after.sequence === 2);
    for (const event of s.ancientEvil.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      const b = event.budget;
      timeline.push({ phase: 'LIFE', week: event.week, date: event.date, revision: event.revision,
        before: { actions: b.actionsBefore, health: b.healthBefore, mind: b.mindBefore, spirituality: b.spiritualityBefore, cash: b.cashBefore },
        after: { actions: b.actionsAfter, health: b.healthAfter, mind: b.mindAfter, spirituality: b.spiritualityAfter, cash: b.cashAfter },
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null });
    }
    const purchase = s.ancientEvil.encounter.blockPurchase;
    if (purchase) {
      const lastLife = s.ancientEvil.life.journal.at(-1);
      if (!promotion || !lastLife || purchase.revision - 1 <= lastLife.revision || purchase.week < lastLife.week ||
        purchase.randomBefore !== purchase.randomAfter) return false;
      timeline.push({ phase: 'ENCOUNTER', week: purchase.week, date: purchase.date, revision: purchase.revision - 1,
        before: shared(purchase.before), after: shared(purchase.after), randomBefore: null, randomAfter: null, recordedCursor: purchase.randomAfter });
    }
    const prep = s.ancientEvil.encounter.preparation;
    if (prep) {
      const lastLife = s.ancientEvil.life.journal.at(-1);
      // Encounter stores the resulting commit revision; acquisition/life store its input.
      if (!promotion || !lastLife || prep.revision - 1 <= lastLife.revision || prep.week < lastLife.week) return false;
      timeline.push({ phase: 'ENCOUNTER', week: prep.week, date: prep.date, revision: prep.revision - 1,
        before: shared(prep.before), after: shared(prep.after), randomBefore: null, randomAfter: null, recordedCursor: prep.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0; let exactCursor: number | null = null;
    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i]!, previous = timeline[i - 1];
      const adjacent = !!previous && event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0;
      if (!adjacent) exactCursor = null;
      if (previous && (event.revision <= previous.revision || event.week < previous.week || event.date !== null && previous.date !== null && compareGameDates(event.date, previous.date) < 0 ||
        event.phase === 'ACQUISITION' && previous.phase !== 'ACQUISITION' || event.phase === 'LIFE' && previous.phase === 'ENCOUNTER' ||
        adjacent && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) ||
          exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (tail.date !== null && !same(s.date, tail.date) || !same(shared(acquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateAncientEvilState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.ancientEvil;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'silentDiscipleActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== ANCIENT_EVIL_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as AncientEvilState, promoted = isAncientEvil(s), acquisitionStage = isAncientEvilAcquisitionStage(s);
  const firstWeek = s.silentDisciple.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + ANCIENT_EVIL_MIN_SILENT_DISCIPLE_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > ANCIENT_EVIL_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !ANCIENT_EVIL_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasAncientEvilOldPractice(s) || hasAncientEvilLifeLock(s) || hasAncientEvilEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.silentDisciple.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.silentDiscipleActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !silentDiscipleReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...ANCIENT_EVIL_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.silentDiscipleActingAtPromotion !== null || ANCIENT_EVIL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `ancient-evil-potion-${index + 1}` || !integer(b.labourSteps, 0, ANCIENT_EVIL_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < ANCIENT_EVIL_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== ANCIENT_EVIL_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % ANCIENT_EVIL_BOTTLE_IDS.length;
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
        if (!integer(s.silentDisciple.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateAncientEvilAcquisitionJournal(s) || !validateAncientEvilJournalContinuity(s) || !validateAncientEvilLifeState(s) || !validateAncientEvilEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { ANCIENT_EVIL_ABILITIES } from './content.js';
export { ANCIENT_EVIL_ABILITY_IDS } from './types.js';
export type * from './types.js';
