import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import { POLYMATH_ABILITY_IDS } from '../polymath/types.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS } from '../mysticism-magister/types.js';
import { PROPHET_ABILITY_IDS } from '../prophet/types.js';
import { INSIGHT_SCHOLAR_ABILITY_IDS } from '../insight-scholar/types.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import { hasWisdomAngelLock } from '../wisdom-angel/index.js';
import { hasProphetRitualLock } from '../prophet/ritual.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasProphetEncounterLock } from '../prophet/encounter.js';
import { hasInsightScholarLifeLock } from '../insight-scholar/life.js';
import { hasInsightScholarEncounterLock } from '../insight-scholar/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createAllKnowingEyeLifeState, initializeAllKnowingEyeLifeState, applyAllKnowingEyeLifeCommand, projectAllKnowingEyeLife, allKnowingEyeLifeActions, validateAllKnowingEyeLifeState, validateAllKnowingEyeActivityCommand, hasAllKnowingEyeLifeLock, allKnowingEyeExpectedOriginals, allKnowingEyeLifeMasteryGains } from './life.js';
import { createAllKnowingEyeEncounterState, applyAllKnowingEyeEncounterCommand, projectAllKnowingEyeEncounter, allKnowingEyeEncounterActions, validateAllKnowingEyeEncounterState, validateAllKnowingEyeEncounterCommand, hasAllKnowingEyeEncounterLock, allKnowingEyeEncounterOriginalEvents } from './encounter.js';
import { ALL_KNOWING_EYE_ABILITIES, ALL_KNOWING_EYE_INHERITED_ABILITIES, ALL_KNOWING_EYE_BOTTLE_IDS, ALL_KNOWING_EYE_CONSUMPTION_RISK, ALL_KNOWING_EYE_FORMULA_STATUS, ALL_KNOWING_EYE_GUIDE, ALL_KNOWING_EYE_LABOUR_STEPS, ALL_KNOWING_EYE_LABOUR_TASKS, ALL_KNOWING_EYE_MIN_WISDOM_ANGEL_WEEKS, ALL_KNOWING_EYE_POTION_SOURCES, ALL_KNOWING_EYE_PREPARATIONS, ALL_KNOWING_EYE_PRICES, ALL_KNOWING_EYE_SOURCE_STATUS } from './content.js';
import { ALL_KNOWING_EYE_ABILITY_IDS, ALL_KNOWING_EYE_PREPARATION_IDS, ALL_KNOWING_EYE_SOURCE_KEYS, type AllKnowingEyeOriginals, type AllKnowingEyeSourceHistory, type AllKnowingEyeAcquisitionBudget, type AllKnowingEyeAcquisitionEvent, type AllKnowingEyeAcquisitionCommand, type AllKnowingEyeAction, type AllKnowingEyeBottle, type AllKnowingEyeCommand, type AllKnowingEyeProjection, type AllKnowingEyeState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const ALL_KNOWING_EYE_INHERITED_ABILITY_IDS = [...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS, ...PROPHET_ABILITY_IDS, ...INSIGHT_SCHOLAR_ABILITY_IDS, ...WISDOM_ANGEL_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = ALL_KNOWING_EYE_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): AllKnowingEyeBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createAllKnowingEyeState(): AllKnowingEyeState {
  return { guidanceKnown: false, bottles: ALL_KNOWING_EYE_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, wisdomAngelActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createAllKnowingEyeLifeState(), encounter: createAllKnowingEyeEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isAllKnowingEye = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 1;
export const isAllKnowingEyeAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2;
export const hasAllKnowingEyeHistory = (s: SliceState) => isAllKnowingEye(s) && s.allKnowingEye.promotionWeek !== null;
/** Validate each actual predecessor's consumed independent bottle without inventing past play. */
function sourceHistory(s: SliceState): boolean {
  if (!s.reader.discovered || !s.reader.guidanceKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const first = s.reader.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || first[0]!.consumedWeek !== s.progression.promotionWeek || !integer(first[0]!.acquiredWeek, 1, s.progression.promotionWeek)) return false;
  let previous = s.progression.promotionWeek;
  for (const stage of [s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet, s.insightScholar, s.wisdomAngel]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.reasoner.readerActingAtPromotion === 100 && s.detective.reasonerActingAtPromotion === 100 &&
    s.polymath.detectiveActingAtPromotion === 100 && s.mysticismMagister.polymathActingAtPromotion === 100 &&
    s.prophet.mysticismMagisterActingAtPromotion === 100 && s.insightScholar.prophetActingAtPromotion === 100 && s.wisdomAngel.insightScholarActingAtPromotion === 100;
}
export function allKnowingEyeSourceHistory(s: SliceState): AllKnowingEyeSourceHistory {
  return Object.fromEntries(ALL_KNOWING_EYE_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as AllKnowingEyeSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.allKnowingEye.sourceHistory ?? allKnowingEyeSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isAllKnowingEyeAcquisitionStage(s) || isAllKnowingEye(s)) && sourceHistory(s);
/** Old commands close at S1; their completed records are retained exactly. */
export function hasAllKnowingEyeOldPractice(s: SliceState): boolean {
  return hasWisdomAngelLock(s) || s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s) ||
    Object.values(s.insightScholar.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s) ||
    Object.values(s.prophet.life.cases).some(v => v.contactOpen || v.effectActive || v.status === 'PREPARED') ||
    s.prophet.life.pages.location !== 'TABLE' ||
    Object.values(s.mysticismMagister.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
    s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen || s.mysticismMagister.encounter.status === 'FIGHTING' ||
    Object.values(s.polymath.cases).some(v => v.contactOpen || v.status === 'PREPARED') || s.polymath.encounter.status === 'FIGHTING';
}
const wisdomAngelReportsComplete = (s: SliceState) => s.wisdomAngel.life.reflected &&
  Object.keys(s.wisdomAngel.life.cases).length === 3 && Object.values(s.wisdomAngel.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected && c.attempts.at(-1)!.papersReturned &&
    (!c.attempts.at(-1)!.deviceTaken || c.attempts.at(-1)!.deviceReturned) && c.attempts.at(-1)!.exited);
export const allKnowingEyeOriginals = (s: SliceState): AllKnowingEyeOriginals => {
  const l = s.wisdomAngel.life;
  return structuredClone({ playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, clockSeconds: l.clockSeconds,
    room: l.room, mara: l.mara, papers: l.papers, device: l.device });
};
export const hasAllKnowingEyeOldSceneLock = hasAllKnowingEyeOldPractice;
export const hasAllKnowingEyeRitualLock = (s: SliceState): boolean => s.allKnowingEye.preparedWeek !== null;
export const hasAllKnowingEyeLock = (s: SliceState): boolean => hasAllKnowingEyeRitualLock(s) || hasAllKnowingEyeLifeLock(s) || hasAllKnowingEyeEncounterLock(s);
const bottleNumber = (b: Pick<AllKnowingEyeBottle, 'id'>) => Number(b.id.slice('all-knowing-eye-potion-'.length));
const potionPrice = (b: AllKnowingEyeBottle) => ALL_KNOWING_EYE_PRICES.potion - (b.labourSteps === ALL_KNOWING_EYE_LABOUR_STEPS ? ALL_KNOWING_EYE_PRICES.labourCredit : 0);
const wisdomAngelWeeks = (s: SliceState) => Math.max(0, (s.allKnowingEye.promotionWeek ?? s.week) - (s.wisdomAngel.promotionWeek ?? s.week));
const exhaustedSupply = (state: AllKnowingEyeState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${ALL_KNOWING_EYE_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1全知之眼成品，独立封存编号all-knowing-eye-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => ALL_KNOWING_EYE_PREPARATION_IDS.every(id => s.allKnowingEye.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `智慧天使魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.wisdomAngel.promotionWeek === null || wisdomAngelWeeks(s) < ALL_KNOWING_EYE_MIN_WISDOM_ANGEL_WEEKS) return `成为智慧天使后已过${wisdomAngelWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!wisdomAngelReportsComplete(s)) return '先完成智慧天使的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与既往报告、待发生动作及有限能力边界和普通返回路线；领取药瓶不能代做专业准备。';
}
export function validateAllKnowingEyeAcquisitionCommand(v: unknown): v is AllKnowingEyeAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && ALL_KNOWING_EYE_PREPARATION_IDS.includes(v.taskId as typeof ALL_KNOWING_EYE_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^all-knowing-eye-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isAllKnowingEyeAcquisitionCommand = validateAllKnowingEyeAcquisitionCommand;
export function validateAllKnowingEyeCommand(v: unknown): v is AllKnowingEyeCommand {
  return validateAllKnowingEyeAcquisitionCommand(v) || validateAllKnowingEyeActivityCommand(v) || validateAllKnowingEyeEncounterCommand(v);
}
export function allKnowingEyeAcquisitionBlock(s: SliceState, command: AllKnowingEyeAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: AllKnowingEyeAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAllKnowingEyeAcquisitionCommand(command)) return '全知之眼准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasAllKnowingEyeOldPractice(s)) || hasAllKnowingEyeLifeLock(s) || hasAllKnowingEyeEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原房间旁的安静交接处。';
  if (!knownChannel(s)) return '实际成为智慧天使并保留原指导渠道后，才能了解全知之眼之路。';
  if (!isAllKnowingEyeAcquisitionStage(s)) return '已经晋升全知之眼1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '阅读者至智慧天使的19项掌握记录不完整，暂不能继续晋升。';
  const state = s.allKnowingEye;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !wisdomAngelReportsComplete(s)) return '先完成智慧天使三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < ALL_KNOWING_EYE_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的全知之眼原瓶。';
    return s.cash < ALL_KNOWING_EYE_PRICES.preparation ? '当次场地检查需要150便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY' && s.cash < ALL_KNOWING_EYE_PRICES.resupply) return '申请下一批需要100便士实际费用。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批全知之眼原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的全知之眼准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选全知之眼独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与150便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ALL_KNOWING_EYE_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: AllKnowingEyeAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.allKnowingEye;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = allKnowingEyeSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: acquisitionBudget(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: allKnowingEyeOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= ALL_KNOWING_EYE_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取全知之眼独立成品与专业准备指导', `花1行动、500便士。${ALL_KNOWING_EYE_GUIDE}说明原渠道记录。${ALL_KNOWING_EYE_FORMULA_STATUS}${ALL_KNOWING_EYE_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = ALL_KNOWING_EYE_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= ALL_KNOWING_EYE_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、150便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与150便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(ALL_KNOWING_EYE_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款1100便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('全知之眼独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= ALL_KNOWING_EYE_PRICES.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批全知之眼成品', `原瓶全部失败耗尽，花1行动与100便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < ALL_KNOWING_EYE_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`all-knowing-eye-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶全知之眼原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6600便士或对应五项劳动后1100便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.wisdomAngelActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('white-tower-s1')) s.seer.completedSources.push('white-tower-s1');
        initializeAllKnowingEyeLifeState(s);
        for (const id of ALL_KNOWING_EYE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为全知之眼', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；智慧天使消化100与原19项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。性别、姓名、年龄、性格与取向不改写。旧伤、原人及受托物、过去八阶的原瓶、劳务与实际结果全部留存。旧敌人的死亡或投降不重开，两张原纸不复制，耗尽的原示范器不充能，旧微光片和材料不补充；晋升不会治疗本人或旧人。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '全知之眼魔药严重排异' : '全知之眼魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为智慧天使，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、150便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): AllKnowingEyeAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: AllKnowingEyeState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, wisdomAngelActingAtPromotion: state.wisdomAngelActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyAllKnowingEyeAcquisition(s: SliceState, command: AllKnowingEyeAcquisitionCommand, ctx: SeerContext): void {
  const reason = allKnowingEyeAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = acquisitionBudget(s), actor: AllKnowingEyeAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'white-tower',
    wisdomAngelPromotionWeek: s.wisdomAngel.promotionWeek!, readerPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.allKnowingEye.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is AllKnowingEyeAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? ALL_KNOWING_EYE_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateAllKnowingEyeAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.allKnowingEye.acquisitionJournal, expected = createAllKnowingEyeState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: AllKnowingEyeAcquisitionEvent | null = null, nextCursor = s.allKnowingEye.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.wisdomAngel.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAllKnowingEyeAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'wisdomAngelPromotionWeek', 'readerPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'white-tower' || raw.actor.wisdomAngelPromotionWeek !== s.wisdomAngel.promotionWeek || raw.actor.readerPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as AllKnowingEyeAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous!.after.mastery[id]) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.allKnowingEye.sourceHistory ? structuredClone(s.allKnowingEye.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.allKnowingEye.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'white-tower', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, allKnowingEye: expected };
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
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.allKnowingEye))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isAllKnowingEye(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.allKnowingEye.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isAllKnowingEye(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !ALL_KNOWING_EYE_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.allKnowingEye.wisdomAngelActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.allKnowingEye.guidanceKnown || isAllKnowingEye(s)) return false;
    return true;
  } catch { return false; }
}

export function applyAllKnowingEyeCommand(s: SliceState, command: AllKnowingEyeCommand, ctx: SeerContext): void {
  if (!validateAllKnowingEyeCommand(command)) throw new Error('全知之眼命令无效。');
  if (validateAllKnowingEyeAcquisitionCommand(command)) return applyAllKnowingEyeAcquisition(s, command, ctx);
  if (validateAllKnowingEyeActivityCommand(command)) return applyAllKnowingEyeLifeCommand(s, command, ctx);
  if (validateAllKnowingEyeEncounterCommand(command)) return applyAllKnowingEyeEncounterCommand(s, command, ctx);
  throw new Error('未知全知之眼命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function allKnowingEyeAcquisitionActions(s: SliceState): AllKnowingEyeAction[] {
  if (!knownChannel(s) || isAllKnowingEye(s)) return [];
  const state = s.allKnowingEye, actions: AllKnowingEyeAction[] = [];
  const add = (id: string, label: string, cost: string, command: AllKnowingEyeAcquisitionCommand) => {
    const reason = allKnowingEyeAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-all-knowing-eye-guidance', '听取全知之眼成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of ALL_KNOWING_EYE_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`all-knowing-eye-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-all-knowing-eye-promotion', '实际检查本次服药场地', '1行动 · 150便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-all-knowing-eye-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-all-knowing-eye-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-all-knowing-eye-supply', '申请下一批独立全知之眼成品', '1行动 · 100便士 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < ALL_KNOWING_EYE_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${ALL_KNOWING_EYE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶全知之眼魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶全知之眼魔药`, `0行动 · 智慧天使消化${s.progression.acting}/100 · ${wisdomAngelWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredAllKnowingEyeAction(s: SliceState, actions: AllKnowingEyeAction[]): AllKnowingEyeAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectAllKnowingEyeLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectAllKnowingEye(s: SliceState): AllKnowingEyeProjection {
  const state = s.allKnowingEye, available = knownChannel(s), promoted = isAllKnowingEye(s);
  const actions = available ? [...allKnowingEyeAcquisitionActions(s), ...allKnowingEyeLifeActions(s), ...allKnowingEyeEncounterActions(s)] : [];
  const preferred = preferredAllKnowingEyeAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '全知之眼·白塔序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${ALL_KNOWING_EYE_FORMULA_STATUS}${ALL_KNOWING_EYE_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6600便士，或为本瓶完成五项真实劳动后支付1100便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成智慧天使的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 全知之眼成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为智慧天使' : '排异，仍为智慧天使'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? ALL_KNOWING_EYE_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...ALL_KNOWING_EYE_INHERITED_ABILITIES, ...ALL_KNOWING_EYE_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `智慧天使消化${state.wisdomAngelActingAtPromotion}/100留存；全知之眼扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `智慧天使需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${wisdomAngelWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成智慧天使的实际经历。',
    pollution: s.seer.pollution, risk: available ? ALL_KNOWING_EYE_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '玛拉的两张原纸仍保留原文、最初阅读周和归属；原示范器电量为零，不自动补充。已学会的闪光样本和实际持有的旧微光片可按原条件使用，耗尽原件不会补回。' : '',
    inheritedHistory: available ? [
      `智慧天使在第${s.wisdomAngel.promotionWeek}周实际晋升；${promoted ? `原消化${state.wisdomAngelActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      '前八阶19项技巧保持原值，未掌握的项目仍从零起步；成功晋升只新增两项零掌握。',
      `原微光片仍逐件保留：${s.mysticismMagister.crafts.map(c => `${c.id}${c.status === 'PLAYER' ? '尚持有' : '已耗尽'}`).join('、')}。`,
      '原携铃者与伊恩的死亡、罗文与哈罗德的投降、阿尔顿和平离场都保留。维克托尚未接触，不会因新篇章自动开战。',
    ] : [],
    life: projectAllKnowingEyeLife(s), encounter: projectAllKnowingEyeEncounter(s), insideCase: hasAllKnowingEyeLock(s),
    environment: available ? '玛拉的原资料室从出口到桌边四米，出口保持开放。须重新取得她对原纸的当次许可；伊蕾娜使用自己有偿提供的无动力滑块。撤回后仍可普通停下、拾取、还物并沿原路离开。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateAllKnowingEyeJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.allKnowingEye.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous.after.mastery[id]) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    // The three independent replays still share one public command sequence,
    // resource budget and random stream. Gaps permit actual ordinary play;
    // directly adjacent commits cannot manufacture recovery or another draw.
    type SharedBudget = Pick<AllKnowingEyeAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.allKnowingEye.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.allKnowingEye.encounter, preparation = encounter.preparation;
    const reflection = s.allKnowingEye.life.journal.find(event => event.command.type === 'REFLECT');
    if (preparation) {
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week || compareGameDates(preparation.date, reflection.date) < 0) return false;
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


/** Freeze all eight predecessor roots. Current room movements and finite original
 * craft consumption must separately reconcile with their new actual journals. */
export function validateAllKnowingEyeSource(s: SliceState): boolean {
  try {
    const state = s.allKnowingEye, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, ALL_KNOWING_EYE_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !same(scene.originals, allKnowingEyeOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const current = allKnowingEyeSourceHistory(s);
    for (const key of ['playerLocation', 'playerTravelMetres', 'clockSeconds', 'room', 'mara', 'papers', 'device'] as const) {
      Object.assign(current.wisdomAngel.life, { [key]: structuredClone(scene.originals[key]) });
    }
    current.mysticismMagister.crafts = structuredClone(history.mysticismMagister.crafts);
    if (!same(current, history)) return false;
    const expectedOriginals = isAllKnowingEye(s) ? allKnowingEyeExpectedOriginals(s) : scene.originals;
    if (!expectedOriginals || !same(expectedOriginals, allKnowingEyeOriginals(s))) return false;
    let crafts = structuredClone(history.mysticismMagister.crafts), revision = scene.revision;
    for (const event of allKnowingEyeEncounterOriginalEvents(s)) {
      if (!integer(event.revision, revision + 1, s.revision) || !integer(event.week, scene.week, s.week) || !same(event.before, crafts)) return false;
      crafts = structuredClone(event.after); revision = event.revision;
    }
    return same(crafts, s.mysticismMagister.crafts);
  } catch { return false; }
}

export const validateAllKnowingEyeInheritedState = validateAllKnowingEyeSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function allKnowingEyeInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.allKnowingEye;
  if (!isAllKnowingEye(s) || !s.allKnowingEye.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'white-tower', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), allKnowingEye: createAllKnowingEyeState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateAllKnowingEyeState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.allKnowingEye;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'wisdomAngelActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== ALL_KNOWING_EYE_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as AllKnowingEyeState, promoted = isAllKnowingEye(s), acquisitionStage = isAllKnowingEyeAcquisitionStage(s);
  const firstWeek = s.wisdomAngel.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + ALL_KNOWING_EYE_MIN_WISDOM_ANGEL_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateAllKnowingEyeSource(s))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > ALL_KNOWING_EYE_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !ALL_KNOWING_EYE_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasAllKnowingEyeOldPractice(s) || hasAllKnowingEyeLifeLock(s) || hasAllKnowingEyeEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.wisdomAngel.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.wisdomAngelActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !wisdomAngelReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...ALL_KNOWING_EYE_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.wisdomAngelActingAtPromotion !== null || ALL_KNOWING_EYE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `all-knowing-eye-potion-${index + 1}` || !integer(b.labourSteps, 0, ALL_KNOWING_EYE_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < ALL_KNOWING_EYE_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== ALL_KNOWING_EYE_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % ALL_KNOWING_EYE_BOTTLE_IDS.length;
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
        if (!integer(s.wisdomAngel.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateAllKnowingEyeAcquisitionJournal(s) || !validateAllKnowingEyeJournalContinuity(s) || !validateAllKnowingEyeLifeState(s) || !validateAllKnowingEyeEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('white-tower-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(allKnowingEyeLifeMasteryGains(s))) {
      if (!ALL_KNOWING_EYE_ABILITY_IDS.includes(id as typeof ALL_KNOWING_EYE_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.allKnowingEyeOutcome) {
      for (const action of [...round.allKnowingEyeOutcome.playerActions, ...round.allKnowingEyeOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('white-tower-s1')) return false;
  return true;
}
export { ALL_KNOWING_EYE_ABILITIES } from './content.js';
export { ALL_KNOWING_EYE_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleAllKnowingEye = applyAllKnowingEyeCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateAllKnowingEyeHistory = validateAllKnowingEyeState;
