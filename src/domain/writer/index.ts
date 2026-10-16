import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../audience/types.js';
import { MINDREADER_ABILITY_IDS } from '../mindreader/types.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../psychologist/types.js';
import { HYPNOTIST_ABILITY_IDS } from '../hypnotist/types.js';
import { DREAMWALKER_ABILITY_IDS } from '../dreamwalker/types.js';
import { MANIPULATOR_ABILITY_IDS } from '../manipulator/types.js';
import { DREAM_WEAVER_ABILITY_IDS } from '../dream-weaver/types.js';
import { DISCERNER_ABILITY_IDS } from '../discerner/types.js';
import { hasDiscernerLock } from '../discerner/index.js';
import { hasDreamWeaverLock } from '../dream-weaver/index.js';
import { hasManipulatorRitualLock } from '../manipulator/ritual.js';
import { manipulatorInside } from '../manipulator/life.js';
import { isInsideManipulatorEncounter } from '../manipulator/encounter.js';
import { dreamwalkerInside } from '../dreamwalker/life.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createWriterLifeState, initializeWriterLife, applyWriterActivity, projectWriterLife, writerLifeActions, validateWriterLife, validateWriterActivityCommand, hasWriterLifeLock } from './life.js';
import { createWriterEncounterState, applyWriterEncounterCommand, projectWriterEncounter, writerEncounterActions, validateWriterEncounter, validateWriterEncounterCommand, hasWriterEncounterLock } from './encounter.js';
import { WRITER_ABILITIES, WRITER_INHERITED_ABILITIES, WRITER_BOTTLE_IDS, WRITER_CONSUMPTION_RISK, WRITER_FORMULA_STATUS, WRITER_GUIDE, WRITER_LABOUR_STEPS, WRITER_LABOUR_TASKS, WRITER_MIN_DISCERNER_WEEKS, WRITER_POTION_SOURCES, WRITER_PREPARATIONS, WRITER_PRICES, WRITER_SOURCE_STATUS } from './content.js';
import { WRITER_ABILITY_IDS, WRITER_PREPARATION_IDS, type WriterAcquisitionBudget, type WriterAcquisitionEvent, type WriterAcquisitionCommand, type WriterAction, type WriterBottle, type WriterCommand, type WriterProjection, type WriterState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const WRITER_INHERITED_ABILITY_IDS = [...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS, ...DREAMWALKER_ABILITY_IDS, ...MANIPULATOR_ABILITY_IDS, ...DREAM_WEAVER_ABILITY_IDS, ...DISCERNER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = WRITER_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): WriterBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createWriterState(): WriterState {
  return { guidanceKnown: false, bottles: WRITER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, discernerActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceDiscerner: null, life: createWriterLifeState(), encounter: createWriterEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isWriter = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 1;
export const isWriterAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 2;
export const hasWriterHistory = (s: SliceState) => isWriter(s) && s.writer.promotionWeek !== null;
/** Validate the eight real Audience roots with their actual, distinct bottle schemas. */
function sourceHistory(s: SliceState): boolean {
  if (!s.audience.discovered || !s.audience.formulaKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const first = s.audience.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.brewedWeek, 1, s.progression.promotionWeek)) return false;
  const firstBatch = s.audience.batches.find(batch => batch.id === first[0]!.batchId);
  if (!firstBatch?.acquired || !firstBatch.brewed || firstBatch.materials.some(item => item.holder !== 'CONSUMED')) return false;
  let previous = s.progression.promotionWeek;
  if (!s.mindreader.formulaKnown || !integer(s.mindreader.promotionWeek, previous, s.week)) return false;
  const mindBottles = s.mindreader.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (mindBottles.length !== 1 || !integer(mindBottles[0]!.brewedWeek, previous, s.mindreader.promotionWeek)) return false;
  const mindBatch = s.mindreader.batches.find(batch => batch.id === mindBottles[0]!.batchId);
  if (!mindBatch?.acquired || !mindBatch.brewed || mindBatch.materials.some(item => item.holder !== 'CONSUMED')) return false;
  previous = s.mindreader.promotionWeek;
  for (const stage of [s.psychologist, s.hypnotist, s.dreamwalker]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  if (!s.manipulator.guidanceKnown || !integer(s.manipulator.promotionWeek, previous, s.week)) return false;
  const manipulated = s.manipulator.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (manipulated.length !== 1 || manipulated[0]!.consumedWeek !== s.manipulator.promotionWeek || !integer(manipulated[0]!.brewedWeek, previous, s.manipulator.promotionWeek)) return false;
  const batch = s.manipulator.batches.find(b => b.id === manipulated[0]!.batchId);
  if (!batch || batch.status !== 'BREWED' || batch.bottleId !== manipulated[0]!.id || !integer(batch.acquiredWeek, previous, manipulated[0]!.brewedWeek)) return false;
  previous = s.manipulator.promotionWeek;
  for (const stage of [s.dreamWeaver, s.discerner]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.mindreader.audienceActingAtPromotion === 100 && s.psychologist.mindreaderActingAtPromotion === 100 &&
    s.hypnotist.psychologistActingAtPromotion === 100 && s.dreamwalker.hypnotistActingAtPromotion === 100 &&
    s.manipulator.dreamwalkerActingAtPromotion === 100 && s.dreamWeaver.manipulatorActingAtPromotion === 100 && s.discerner.dreamWeaverActingAtPromotion === 100;
}
/** The first paid guidance freezes the complete S2 source. All eight roots,
 * including prior people, injuries, identities, objects and failed bottles,
 * remain sealed thereafter. Earlier source play is not manufactured or replayed. */
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker,
    s.manipulator, s.dreamWeaver, s.writer.sourceDiscerner ?? s.discerner]));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isWriterAcquisitionStage(s) || isWriter(s)) && sourceHistory(s);
/** Prior stages retain history without reopening their exact-stage commands. */
export function hasWriterOldPractice(s: SliceState): boolean {
  return hasDiscernerLock(s) || hasDreamWeaverLock(s) || hasManipulatorRitualLock(s) || manipulatorInside(s) ||
    isInsideManipulatorEncounter(s) || dreamwalkerInside(s) || s.dreamwalker.ritual.activeVisitId !== null ||
    Object.values(s.manipulator.life.cases).some(c => c.status === 'PREPARED') ||
    Object.values(s.dreamwalker.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
    Object.values(s.hypnotist.cases).some(c => c.contactOpen || c.status === 'PREPARED');
}
const discernerReportsComplete = (s: SliceState) => s.discerner.life.reflected &&
  Object.keys(s.discerner.life.cases).length === 3 && Object.entries(s.discerner.life.cases).every(([id, c]) =>
    c.status === 'RESOLVED' && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.steps.some(step => step.type === 'VERIFY') && c.attempts.at(-1)!.steps.at(-1)?.type === 'CLOSE' &&
    s.seer.completedSources.includes(`discerner-case:${id}`)) && s.seer.completedSources.includes('discerner-reflection');
export const hasWriterOldSceneLock = hasWriterOldPractice;
export const hasWriterRitualLock = (s: SliceState): boolean => s.writer.preparedWeek !== null;
export const hasWriterLock = (s: SliceState): boolean => hasWriterRitualLock(s) || hasWriterLifeLock(s) || hasWriterEncounterLock(s);
const bottleNumber = (b: Pick<WriterBottle, 'id'>) => Number(b.id.slice('writer-potion-'.length));
const potionPrice = (b: WriterBottle) => WRITER_PRICES.potion - (b.labourSteps === WRITER_LABOUR_STEPS ? WRITER_PRICES.labourCredit : 0);
const discernerWeeks = (s: SliceState) => Math.max(0, (s.writer.promotionWeek ?? s.week) - (s.discerner.promotionWeek ?? s.week));
const exhaustedSupply = (state: WriterState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${WRITER_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1作家成品，独立封存编号writer-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => WRITER_PREPARATION_IDS.every(id => s.writer.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `洞察者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.discerner.promotionWeek === null || discernerWeeks(s) < WRITER_MIN_DISCERNER_WEEKS) return `成为洞察者后已过${discernerWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!discernerReportsComplete(s)) return '先完成洞察者的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与既往报告、互知线索及合理安排边界和普通离场路线；领取药瓶不能代做专业准备。';
}
export function validateWriterAcquisitionCommand(v: unknown): v is WriterAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && WRITER_PREPARATION_IDS.includes(v.taskId as typeof WRITER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^writer-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isWriterAcquisitionCommand = validateWriterAcquisitionCommand;
export function validateWriterCommand(v: unknown): v is WriterCommand {
  return validateWriterAcquisitionCommand(v) || validateWriterActivityCommand(v) || validateWriterEncounterCommand(v);
}
export function writerAcquisitionBlock(s: SliceState, command: WriterAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: WriterAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateWriterAcquisitionCommand(command)) return '作家准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasWriterOldPractice(s)) || hasWriterLifeLock(s) || hasWriterEncounterLock(s)) return '先收束旧接触和待用影响，归还原卡和保护媒介，沿普通路线离开旧现场；当前实践也须收尾。旧人物、原物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德阅览室旁的安静房间与专业交接处。';
  if (!knownChannel(s)) return '实际成为洞察者并保留原指导渠道后，才能了解作家之路。';
  if (!isWriterAcquisitionStage(s)) return '已经晋升作家1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '观众至洞察者的23项掌握记录不完整，暂不能继续晋升。';
  const state = s.writer;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !discernerReportsComplete(s)) return '先完成洞察者三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < WRITER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的作家原瓶。';
    return s.cash < WRITER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批作家原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的作家准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选作家独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= WRITER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: WriterAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.writer;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= WRITER_PRICES.guidance; state.guidanceKnown = true;
      state.sourceDiscerner = structuredClone(s.discerner);
      ctx.note('听取作家独立成品与专业准备指导', `花1行动、500便士。${WRITER_GUIDE}说明原渠道记录。${WRITER_FORMULA_STATUS}${WRITER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = WRITER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= WRITER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(WRITER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('作家独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批作家成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < WRITER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`writer-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶作家原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.discernerActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('audience-s1')) s.seer.completedSources.push('audience-s1');
        initializeWriterLife(s);
        for (const id of WRITER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为作家', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；洞察者消化100与原23项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。角色性别与年龄不变，旧伤、原支持者的身体、外部身份和接触经历、过去八阶的原瓶、劳务与实际结果全部留存。旧敌人的死亡或投降不重开，原物不补充或复制；晋升不会治疗本人或原支持者。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '作家魔药严重排异' : '作家魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为洞察者，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): WriterAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: WriterState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, discernerActingAtPromotion: state.discernerActingAtPromotion, sourceDiscerner: state.sourceDiscerner,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyWriterAcquisition(s: SliceState, command: WriterAcquisitionCommand, ctx: SeerContext): void {
  const reason = writerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: WriterAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'audience',
    discernerPromotionWeek: s.discerner.promotionWeek!, audiencePromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.writer.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is WriterAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? WRITER_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateWriterAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.writer.acquisitionJournal, expected = createWriterState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: WriterAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.discerner.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateWriterAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'discernerPromotionWeek', 'audiencePromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'audience' || raw.actor.discernerPromotionWeek !== s.discerner.promotionWeek || raw.actor.audiencePromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as WriterAcquisitionEvent;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.sequence === 1 && event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
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
        progression: { ...s.progression, pathwayId: 'audience', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, writer: expected };
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
    if (!same(acquisitionState(expected), acquisitionState(s.writer))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.writer.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || previous.randomAfter !== null && s.random.cursor !== previous.randomAfter)) return false;
      if (isWriter(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !WRITER_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.writer.discernerActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.writer.guidanceKnown || isWriter(s)) return false;
    return true;
  } catch { return false; }
}

export function applyWriterCommand(s: SliceState, command: WriterCommand, ctx: SeerContext): void {
  if (!validateWriterCommand(command)) throw new Error('作家命令无效。');
  if (validateWriterAcquisitionCommand(command)) return applyWriterAcquisition(s, command, ctx);
  if (validateWriterActivityCommand(command)) return applyWriterActivity(s, command, ctx);
  if (validateWriterEncounterCommand(command)) return applyWriterEncounterCommand(s, command, ctx);
  throw new Error('未知作家命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function writerAcquisitionActions(s: SliceState): WriterAction[] {
  if (!knownChannel(s) || isWriter(s)) return [];
  const state = s.writer, actions: WriterAction[] = [];
  const add = (id: string, label: string, cost: string, command: WriterAcquisitionCommand) => {
    const reason = writerAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(command.type === 'LEAVE_PREPARATION' ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-writer-guidance', '听取作家成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of WRITER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`writer-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-writer-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-writer-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-writer-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-writer-supply', '申请下一批独立作家成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < WRITER_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${WRITER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶作家魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶作家魔药`, `0行动 · 洞察者消化${s.progression.acting}/100 · ${discernerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredWriterAction(s: SliceState, actions: WriterAction[]): WriterAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectWriterLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectWriter(s: SliceState): WriterProjection {
  const state = s.writer, available = knownChannel(s), promoted = isWriter(s);
  const actions = available ? [...writerAcquisitionActions(s), ...writerLifeActions(s), ...writerEncounterActions(s)] : [];
  const preferred = preferredWriterAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '作家·观众序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${WRITER_FORMULA_STATUS}${WRITER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士，或为本瓶完成五项真实劳动后支付900便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成洞察者的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 作家成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为洞察者' : '排异，仍为洞察者'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? WRITER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...WRITER_INHERITED_ABILITIES, ...WRITER_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `洞察者消化${state.discernerActingAtPromotion}/100留存；作家扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `洞察者需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${discernerWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成洞察者的实际经历。',
    pollution: s.seer.pollution, risk: available ? WRITER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁、当前角色性别${s.character.gender === 'FEMALE' ? '女性' : '男性'}。本次晋升不改变角色性别、年龄、特质或旧伤；原支持者、外部身份及其经历继续保留。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '旧原卡、保护媒介、七滴泪及各阶物件保持各自实际去向；原敌人的武器、伤亡、投降与感染不重置。新阅览室的原书、门、铃与邀请记录分别唯一，晋升不复制或补回任何原物。' : '',
    inheritedHistory: available ? [
      `洞察者在第${s.discerner.promotionWeek}周实际晋升；${promoted ? `原消化${state.discernerActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：观众${s.mindreader.audienceActingAtPromotion}、读心者${s.psychologist.mindreaderActingAtPromotion}、心理医生${s.hypnotist.psychologistActingAtPromotion}、催眠师${s.dreamwalker.hypnotistActingAtPromotion}、梦境行者${s.manipulator.dreamwalkerActingAtPromotion}、操纵师${s.dreamWeaver.manipulatorActingAtPromotion}、织梦人${s.discerner.dreamWeaverActingAtPromotion}、洞察者${promoted ? state.discernerActingAtPromotion : s.progression.acting}。`,
      '前八阶23项技巧保持原有掌握，两项新技巧从0开始，共25项。旧掌握0仍为0。原30/25/30/15能力权重继续沿用。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实诊疗和休养。`,
      `原阿尔里克·维尔：${s.discerner.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.discerner.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍有抵抗能力'}，健康${s.discerner.encounter.enemyHealth}/100、精神${s.discerner.encounter.enemyMind}/100、灵性${s.discerner.encounter.enemySpirituality}，原伤势${s.discerner.encounter.enemyInjuries.length}处。`,
      '原支持者、旧人格与外部身份、原卡及保护媒介保留各自的经历和去向。原人物不参加这次新阅览室练习，也不被当作新的对手。',
    ] : [],
    life: projectWriterLife(s), encounter: projectWriterEncounter(s), insideCase: hasWriterLock(s),
    environment: available ? '阅览室近远两端相隔六米。伊芙琳·赛尔与托马斯·里德分别决定是否参与，原书须实际拿取与归还。互知线索依赖对方真实知道的本人信息；合理安排只推动眼前已有原因的一次待发生还书事件。停止后成本与已发生事实保留，沿普通通道离场。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateWriterJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.writer.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous.after.mastery[id]!) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    // The three independent replays still share one public command sequence,
    // resource budget and random stream. Gaps permit actual ordinary play;
    // directly adjacent commits cannot manufacture recovery or another draw.
    type SharedBudget = Pick<WriterAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.writer.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null });
    }
    const encounter = s.writer.encounter, preparation = encounter.preparation;
    if (preparation) {
      const reflection = s.writer.life.journal.find(event => event.command.type === 'REFLECT');
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week) return false;
      timeline.push({ week: preparation.week, date: preparation.date, revision: preparation.revision - 1,
        before: shared(preparation.before), after: shared(preparation.after), randomBefore: null, randomAfter: null, recordedCursor: preparation.randomCursor });
      for (const event of encounter.journal) timeline.push({ week: event.week, date: event.date, revision: event.revision - 1,
        before: shared(event.before), after: shared(event.after), randomBefore: null, randomAfter: null, recordedCursor: event.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0; let exactCursor: number | null = null;
    for (let n = 0; n < timeline.length; n++) {
      const event = timeline[n]!, previous = timeline[n - 1];
      const adjacent = !!previous && event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0;
      if (!adjacent) exactCursor = null;
      if (previous && (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || adjacent && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (!same(s.date, tail.date) || !same(shared(acquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateWriterState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.writer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'discernerActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceDiscerner', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== WRITER_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as WriterState, promoted = isWriter(s), acquisitionStage = isWriterAcquisitionStage(s);
  const firstWeek = s.discerner.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + WRITER_MIN_DISCERNER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || state.sourceDiscerner === null || !same(state.sourceDiscerner, s.discerner))) return false;
  if (!state.guidanceKnown && state.sourceDiscerner !== null) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > WRITER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !WRITER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasWriterOldPractice(s) || hasWriterLifeLock(s) || hasWriterEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.discerner.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.discernerActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !discernerReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...WRITER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.discernerActingAtPromotion !== null || WRITER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `writer-potion-${index + 1}` || !integer(b.labourSteps, 0, WRITER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < WRITER_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== WRITER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % WRITER_BOTTLE_IDS.length;
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
        if (!integer(s.discerner.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateWriterAcquisitionJournal(s) || !validateWriterJournalContinuity(s) || !validateWriterLife(s) || !validateWriterEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('audience-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [caseId, ability] of [['mutual-clue', WRITER_ABILITY_IDS[0]], ['scheduled-return', WRITER_ABILITY_IDS[1]]] as const) {
      const r = state.life.cases[caseId];
      if (r.status === 'RESOLVED' && r.abilityApplied && r.result === 'ABILITY') expectedMastery[ability] = Math.min(500, expectedMastery[ability]! + 8);
    }
    for (const round of s.combatHistory) if (round.writerOutcome) {
      for (const action of [...round.writerOutcome.playerActions, ...round.writerOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('audience-s1')) return false;
  return true;
}
export { WRITER_ABILITIES } from './content.js';
export { WRITER_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleWriter = applyWriterCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateWriterHistory = validateWriterState;
