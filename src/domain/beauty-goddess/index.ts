import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import { TAMER_ABILITY_IDS } from '../tamer/types.js';
import { VAMPIRE_ABILITY_IDS } from '../vampire/types.js';
import { POTION_PROFESSOR_ABILITY_IDS } from '../potion-professor/types.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS } from '../crimson-scholar/types.js';
import { WITCH_KING_ABILITY_IDS } from '../witch-king/types.js';
import { SUMMONING_MASTER_ABILITY_IDS } from '../summoning-master/types.js';
import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import { hasLifeGiverLock } from '../life-giver/index.js';
import { hasSummoningMasterLock } from '../summoning-master/index.js';
import { hasWitchKingRitualLock } from '../witch-king/ritual.js';
import { hasWitchKingLifeLock } from '../witch-king/life.js';
import { hasWitchKingEncounterLock } from '../witch-king/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createBeautyGoddessLifeState, initializeBeautyGoddessLife, applyBeautyGoddessActivity, projectBeautyGoddessLife, beautyGoddessLifeActions, validateBeautyGoddessLife, validateBeautyGoddessActivityCommand, hasBeautyGoddessLifeLock, beautyGoddessExpectedPartner } from './life.js';
import { createBeautyGoddessEncounterState, applyBeautyGoddessEncounterCommand, projectBeautyGoddessEncounter, beautyGoddessEncounterActions, validateBeautyGoddessEncounter, validateBeautyGoddessEncounterCommand, hasBeautyGoddessEncounterLock, beautyGoddessEncounterOriginalEvents } from './encounter.js';
import { BEAUTY_GODDESS_ABILITIES, BEAUTY_GODDESS_INHERITED_ABILITIES, BEAUTY_GODDESS_BOTTLE_IDS, BEAUTY_GODDESS_CONSUMPTION_RISK, BEAUTY_GODDESS_FORMULA_STATUS, BEAUTY_GODDESS_GUIDE, BEAUTY_GODDESS_LABOUR_STEPS, BEAUTY_GODDESS_LABOUR_TASKS, BEAUTY_GODDESS_MIN_LIFE_GIVER_WEEKS, BEAUTY_GODDESS_POTION_SOURCES, BEAUTY_GODDESS_PREPARATIONS, BEAUTY_GODDESS_PRICES, BEAUTY_GODDESS_SOURCE_STATUS } from './content.js';
import { BEAUTY_GODDESS_ABILITY_IDS, BEAUTY_GODDESS_PREPARATION_IDS, BEAUTY_GODDESS_SOURCE_KEYS, type BeautyGoddessSourceHistory, type BeautyGoddessAcquisitionBudget, type BeautyGoddessAcquisitionEvent, type BeautyGoddessAcquisitionCommand, type BeautyGoddessAction, type BeautyGoddessBottle, type BeautyGoddessCommand, type BeautyGoddessProjection, type BeautyGoddessState, type BeautyGoddessRecoveryRequest, type BeautyGoddessOriginalCharacteristics } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const BEAUTY_GODDESS_INHERITED_ABILITY_IDS = [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS, ...CRIMSON_SCHOLAR_ABILITY_IDS, ...WITCH_KING_ABILITY_IDS, ...SUMMONING_MASTER_ABILITY_IDS, ...LIFE_GIVER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = BEAUTY_GODDESS_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): BeautyGoddessBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createBeautyGoddessState(): BeautyGoddessState {
  return { transformation: { originalGender: null, decision: 'UNDECIDED', acknowledgedWeek: null, outcome: null }, guidanceKnown: false, bottles: BEAUTY_GODDESS_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, lifeGiverActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createBeautyGoddessLifeState(), encounter: createBeautyGoddessEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isBeautyGoddess = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 1;
export const isBeautyGoddessAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 2;
export const hasBeautyGoddessHistory = (s: SliceState) => isBeautyGoddess(s) && s.beautyGoddess.promotionWeek !== null;
/** Validate each actual predecessor's consumed independent bottle without inventing past play. */
function sourceHistory(s: SliceState): boolean {
  if (!s.apothecary.discovered || !s.apothecary.guidanceKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const first = s.apothecary.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || first[0]!.consumedWeek !== s.progression.promotionWeek || !integer(first[0]!.acquiredWeek, 1, s.progression.promotionWeek)) return false;
  let previous = s.progression.promotionWeek;
  for (const stage of [s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar, s.witchKing, s.summoningMaster, s.lifeGiver]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.tamer.apothecaryActingAtPromotion === 100 && s.vampire.tamerActingAtPromotion === 100 &&
    s.potionProfessor.vampireActingAtPromotion === 100 && s.crimsonScholar.potionProfessorActingAtPromotion === 100 &&
    s.witchKing.crimsonScholarActingAtPromotion === 100 && s.summoningMaster.witchKingActingAtPromotion === 100 && s.lifeGiver.summoningMasterActingAtPromotion === 100;
}
export function beautyGoddessSourceHistory(s: SliceState): BeautyGoddessSourceHistory {
  return Object.fromEntries(BEAUTY_GODDESS_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as BeautyGoddessSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.beautyGoddess.sourceHistory ?? beautyGoddessSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, gender: _gender, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isBeautyGoddessAcquisitionStage(s) || isBeautyGoddess(s)) && sourceHistory(s);
/** Old commands close at S1; their completed records are retained exactly. */
export function hasBeautyGoddessOldPractice(s: SliceState): boolean {
  return hasLifeGiverLock(s) || hasSummoningMasterLock(s) || hasWitchKingRitualLock(s) || hasWitchKingLifeLock(s) || hasWitchKingEncounterLock(s) ||
    Object.values(s.witchKing.life.cases).some(c => c.status === 'PREPARED') ||
    s.crimsonScholar.ritual.activeVisitId !== null || Object.values(s.crimsonScholar.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
    s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' ||
    Object.values(s.potionProfessor.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
    Object.values(s.potionProfessor.laboratory.effects).some(Boolean) || s.tamer.companionId !== null ||
    Object.values(s.tamer.animals).some(a => a.location !== 'HOME') ||
    s.summoningMaster.life.partner.status === 'ALIVE' && s.summoningMaster.life.partner.location !== 'HOME';
}
const lifeGiverReportsComplete = (s: SliceState) => s.lifeGiver.life.reflected &&
  Object.keys(s.lifeGiver.life.cases).length === 3 && Object.values(s.lifeGiver.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected && c.attempts.at(-1)!.tokenReturned && c.attempts.at(-1)!.guestReturned);
export const hasBeautyGoddessOldSceneLock = hasBeautyGoddessOldPractice;
export const hasBeautyGoddessRitualLock = (s: SliceState): boolean => s.beautyGoddess.preparedWeek !== null;
export const hasBeautyGoddessLock = (s: SliceState): boolean => hasBeautyGoddessRitualLock(s) || hasBeautyGoddessLifeLock(s) || hasBeautyGoddessEncounterLock(s);
const bottleNumber = (b: Pick<BeautyGoddessBottle, 'id'>) => Number(b.id.slice('beauty-goddess-potion-'.length));
const potionPrice = (b: BeautyGoddessBottle) => b.recovery
  ? b.labourSteps === BEAUTY_GODDESS_LABOUR_STEPS ? BEAUTY_GODDESS_PRICES.recoveryLabourBalance : BEAUTY_GODDESS_PRICES.recoveryDrug
  : BEAUTY_GODDESS_PRICES.potion - (b.labourSteps === BEAUTY_GODDESS_LABOUR_STEPS ? BEAUTY_GODDESS_PRICES.labourCredit : 0);
const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
const characteristicId = (bottleId: string) => `${bottleId}:characteristic`;
const recoverySourceText = (id: string, recovery: BeautyGoddessRecoveryRequest, week: number) => `${BEAUTY_GODDESS_GUIDE}在原玻璃暖房旁的安静交接处核验${recovery.sourceBottleId}排异后遗留的同一份美神特性${recovery.characteristicId}，第${week}周回收封存到重配瓶${id}。原特性来自${recovery.originalBottleId}；新普通药物与调配服务另付，旧原瓶及其实际结果不改写。`;
/** Follow actual vessel ancestry without treating an attempt number as a fourth original. */
function originalBottleId(state: BeautyGoddessState, bottle: BeautyGoddessBottle): string | null {
  const seen = new Set<string>(); let current = bottle;
  while (current.recovery) {
    if (seen.has(current.id)) return null; seen.add(current.id);
    const r = current.recovery, previous = state.bottles.find(b => b.id === r.sourceBottleId);
    if (!previous || bottleNumber(previous) >= bottleNumber(current) || r.version !== 1 ||
      !BEAUTY_GODDESS_BOTTLE_IDS.includes(r.originalBottleId as typeof BEAUTY_GODDESS_BOTTLE_IDS[number]) || r.characteristicId !== characteristicId(r.originalBottleId) ||
      previous.status !== 'CONSUMED' || !failed(previous.outcome) || previous.consumedWeek === null || previous.consumedWeek > r.requestedWeek ||
      r.recoveredWeek <= r.requestedWeek || current.stockedWeek !== r.recoveredWeek) return null;
    if (previous.recovery && (previous.recovery.originalBottleId !== r.originalBottleId || previous.recovery.characteristicId !== r.characteristicId)) return null;
    if (!previous.recovery && previous.id !== r.originalBottleId) return null;
    current = previous;
  }
  return BEAUTY_GODDESS_BOTTLE_IDS.includes(current.id as typeof BEAUTY_GODDESS_BOTTLE_IDS[number]) ? current.id : null;
}
function recoverySource(state: BeautyGoddessState, bottleId: string) {
  const bottle = state.bottles.find(b => b.id === bottleId);
  if (!bottle || bottle.status !== 'CONSUMED' || !failed(bottle.outcome) || bottle.consumedWeek === null) return null;
  const original = originalBottleId(state, bottle);
  if (!original || state.bottles.some(b => b.recovery?.sourceBottleId === bottleId)) return null;
  // Earlier consumed rows are receipts. A live vessel or an embodied original cannot be recovered again.
  if (state.bottles.some(b => originalBottleId(state, b) === original && (b.status !== 'CONSUMED' || success(b.outcome)))) return null;
  const consumed = state.acquisitionJournal.filter(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId);
  if (consumed.length !== 1 || consumed[0]!.week !== bottle.consumedWeek || consumed[0]!.check?.tier !== bottle.outcome || consumed[0]!.after.sequence !== 2) return null;
  return { bottle, originalBottleId: original, characteristicId: characteristicId(original) };
}
const lifeGiverWeeks = (s: SliceState) => Math.max(0, (s.beautyGoddess.promotionWeek ?? s.week) - (s.lifeGiver.promotionWeek ?? s.week));
const exhaustedSupply = (state: BeautyGoddessState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const originalSupplyFailed = (state: BeautyGoddessState) => state.bottles.length >= 3 && state.bottles.slice(0, 3).every((b, index) => b.id === BEAUTY_GODDESS_BOTTLE_IDS[index] && !b.recovery && b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${BEAUTY_GODDESS_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1美神成品，独立封存编号beauty-goddess-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => BEAUTY_GODDESS_PREPARATION_IDS.every(id => s.beautyGoddess.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.beautyGoddess.transformation.decision !== 'ACCEPTED') return '晋升成功时身体会成为女性，原本女性则仍为女性；请先单独知情确认，也可以选择继续作为创生者生活。';
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `创生者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.lifeGiver.promotionWeek === null || lifeGiverWeeks(s) < BEAUTY_GODDESS_MIN_LIFE_GIVER_WEEKS) return `成为创生者后已过${lifeGiverWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!lifeGiverReportsComplete(s)) return '先完成创生者的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与既往报告、本人身体变化及有限能力边界和普通返回路线；领取药瓶不能代做专业准备。';
}
function validateAcquisitionCommand(v: unknown, historicalReplay = false): v is BeautyGoddessAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (legacySupply(v as { type: string })) return historicalReplay && shape(v, ['type']);
  if (['LEARN_GUIDANCE', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'DECLINE_TRANSFORMATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'CONFIRM_TRANSFORMATION') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && BEAUTY_GODDESS_PREPARATION_IDS.includes(v.taskId as typeof BEAUTY_GODDESS_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^beauty-goddess-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export function validateBeautyGoddessAcquisitionCommand(v: unknown): v is BeautyGoddessAcquisitionCommand { return validateAcquisitionCommand(v); }
export const isBeautyGoddessAcquisitionCommand = validateBeautyGoddessAcquisitionCommand;
export function validateBeautyGoddessCommand(v: unknown): v is BeautyGoddessCommand {
  return validateBeautyGoddessAcquisitionCommand(v) || validateBeautyGoddessActivityCommand(v) || validateBeautyGoddessEncounterCommand(v);
}
export function beautyGoddessAcquisitionBlock(s: SliceState, command: BeautyGoddessAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: BeautyGoddessAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAcquisitionCommand(command, historicalReplay)) return '美神准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasBeautyGoddessOldPractice(s)) || hasBeautyGoddessLifeLock(s) || hasBeautyGoddessEncounterLock(s)) return '先停止负载并收回旧月光纸、受托原物和来客，沿普通路线离开旧现场；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德玻璃暖房旁的安静交接处。';
  if (!knownChannel(s)) return '实际成为创生者并保留原指导渠道后，才能了解美神之路。';
  if (!isBeautyGoddessAcquisitionStage(s)) return '已经晋升美神1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '药师至创生者的21项掌握记录不完整，暂不能继续晋升。';
  const state = s.beautyGoddess;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (command.type === 'DECLINE_TRANSFORMATION') return !state.guidanceKnown ? '先了解这次晋升的身体变化与风险。' : state.transformation.decision === 'DECLINED' ? '已经选择继续作为创生者生活；随时可以重新考虑。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !lifeGiverReportsComplete(s)) return '先完成创生者三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < BEAUTY_GODDESS_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'CONFIRM_TRANSFORMATION') return state.transformation.decision === 'ACCEPTED' ? '已经完成这项知情确认，不必重复。' : null;
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (state.resupply.recovery) return '先完成已付费的原特性调查回收，再准备本次服药。';
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的美神原瓶。';
    return s.cash < BEAUTY_GODDESS_PRICES.preparation ? '当次场地检查需要150便士。' : null;
  }
  if (command.type === 'REQUEST_RECOVERY_V1' || command.type === 'RECOVER_CHARACTERISTIC_V1') {
    if (s.schemaVersion < 209) return '这一原特性回收协议须使用对应的新版本存档。';
    const source = recoverySource(state, command.bottleId), pending = state.resupply.recovery;
    if (!originalSupplyFailed(state)) return '最初三瓶须实际耗尽失败，才能调查并回收同一份原特性。';
    if (!source) return '须核验真实失败原瓶、同一原特性与实际服药记录；已回收或仍被持有的特性不能重复取得。';
    if (command.type === 'REQUEST_RECOVERY_V1') return pending ? '已有指定失败原瓶的调查委托，须先完成回收。' : s.cash < BEAUTY_GODDESS_PRICES.recovery ? '调查原特性需要1行动、120便士；旧费用不退。' : null;
    if (!pending || pending.version !== 1 || pending.sourceBottleId !== command.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.requestedWeek !== state.resupply.requestedWeek) return '先支付对应失败原瓶的调查委托，不能更换原特性。';
    return s.week <= pending.requestedWeek ? '调查后须隔一真实周，再到原玻璃暖房旁的安静交接处核验并封存同一份原特性。' : null;
  }
  if (legacySupply(command) && (state.resupply.recovery || state.bottles.some(b => b.recovery) || state.acquisitionJournal.some(e => recoveryCommand(e.command)))) return '已经开始原特性回收，不能续接独立新原瓶的旧供货记录。';
  if (command.type === 'REQUEST_SUPPLY' && s.cash < BEAUTY_GODDESS_PRICES.resupply) return '申请下一批需要100便士实际费用。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批美神原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的美神准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选美神独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与150便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= BEAUTY_GODDESS_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: BeautyGoddessAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.beautyGoddess;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = beautyGoddessSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: acquisitionBudget(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), partner: structuredClone(s.summoningMaster.life.partner), papers: structuredClone(s.witchKing.life.papers), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= BEAUTY_GODDESS_PRICES.guidance; state.guidanceKnown = true; state.transformation.originalGender = s.character.gender;
      ctx.note('听取美神独立成品与专业准备指导', `花1行动、500便士。${BEAUTY_GODDESS_GUIDE}说明原渠道记录。${BEAUTY_GODDESS_FORMULA_STATUS}${BEAUTY_GODDESS_CONSUMPTION_RISK}`); return;
    case 'CONFIRM_TRANSFORMATION':
      state.transformation.decision = 'ACCEPTED'; state.transformation.acknowledgedWeek = s.week;
      ctx.note('知情确认美神晋升的身体变化', '0行动。晋升成功时身体会成为女性，原本女性则保持女性；失败仍保留服药前身体。姓名、年龄、性格与取向不会被魔药改写。现在尚未饮药，仍可撤回并继续作为创生者生活。'); return;
    case 'DECLINE_TRANSFORMATION':
      state.transformation.decision = 'DECLINED'; state.transformation.acknowledgedWeek = null; state.preparedWeek = null;
      ctx.note('选择继续作为创生者生活', '0行动。没有服药，身体未改变，未服原瓶仍保留；若已准备场地，实际结束本次准备，原费用与行动不退。以后可以重新考虑。'); return;
    case 'PREPARE_TASK': {
      const task = BEAUTY_GODDESS_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= BEAUTY_GODDESS_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、150便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与150便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      if (bottle.recovery) ctx.note('核验同一原特性的本次新药调配', `实际完成重配瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本次新普通药物与调配服务810便士，余款90便士；旧劳务不转用，原特性不复制。`);
      else ctx.note(BEAUTY_GODDESS_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款1100便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      if (bottle.recovery) ctx.note('同一原特性的新药实际重配交付', `0行动、${paid}便士支付本次新普通药物与调配服务，领取${bottle.id}；其中原特性仍为${bottle.recovery.characteristicId}。当周场地检查仍须另付。`);
      else ctx.note('美神独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_RECOVERY_V1': {
      const source = recoverySource(state, command.bottleId)!;
      s.actionsRemaining--; s.cash -= BEAUTY_GODDESS_PRICES.recovery; state.resupply.requestedWeek = s.week;
      state.resupply.recovery = { version: 1, sourceBottleId: command.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: s.week };
      ctx.note('调查失败原瓶遗留的同一份特性', `1行动、120便士，追查${command.bottleId}的${source.characteristicId}。隔一真实周再到原玻璃暖房旁的安静交接处核验回收；旧原瓶、失败、费用与伤势全部保留，不退款。`); return;
    }
    case 'RECOVER_CHARACTERISTIC_V1': {
      const recovery = { ...state.resupply.recovery!, recoveredWeek: s.week }, id = `beauty-goddess-potion-${state.bottles.length + 1}`;
      s.actionsRemaining--;
      state.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, s.week), s.week), recovery });
      state.resupply.deliveries++; state.resupply.requestedWeek = null; delete state.resupply.recovery;
      ctx.note('原处回收封存同一份美神特性', `1行动将${recovery.characteristicId}封存到重配瓶${id}，没有新增原特性。新普通药物与调配服务须另付900便士，五项新劳务后90便士；之后仍须1行动、150便士检查本次场地。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= BEAUTY_GODDESS_PRICES.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批美神成品', `原瓶全部失败耗尽，花1行动与100便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < BEAUTY_GODDESS_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`beauty-goddess-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶美神原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6600便士或对应五项劳动后1100便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.lifeGiverActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0; s.character.gender = 'FEMALE'; state.transformation.outcome = 'FEMALE';
        if (!s.seer.completedSources.includes('moon-s1')) s.seer.completedSources.push('moon-s1');
        initializeBeautyGoddessLife(s);
        for (const id of BEAUTY_GODDESS_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为美神', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；创生者消化100与原21项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。身体成为女性，原本女性仍保持女性；姓名、年龄、性格与取向不改写。旧伤、原来客及受托物、过去八阶的原瓶、劳务与实际结果全部留存。旧敌人的死亡或投降不重开，原来客不恢复精力，原材料不补充；晋升不会治疗本人或旧人。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '美神魔药严重排异' : '美神魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为创生者，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、150便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): BeautyGoddessAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: BeautyGoddessState) {
  return { transformation: state.transformation, guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, lifeGiverActingAtPromotion: state.lifeGiverActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyBeautyGoddessAcquisition(s: SliceState, command: BeautyGoddessAcquisitionCommand, ctx: SeerContext): void {
  const reason = beautyGoddessAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = acquisitionBudget(s), actor: BeautyGoddessAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'moon',
    lifeGiverPromotionWeek: s.lifeGiver.promotionWeek!, apothecaryPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.beautyGoddess.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is BeautyGoddessAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? BEAUTY_GODDESS_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateBeautyGoddessAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.beautyGoddess.acquisitionJournal, expected = createBeautyGoddessState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    if (s.schemaVersion < 209 && (s.beautyGoddess.resupply.recovery || s.beautyGoddess.bottles.some(b => b.recovery) || journal.some(e => recoveryCommand(e.command)))) return false;
    let previous: BeautyGoddessAcquisitionEvent | null = null, nextCursor = s.beautyGoddess.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.lifeGiver.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'lifeGiverPromotionWeek', 'apothecaryPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'moon' || raw.actor.lifeGiverPromotionWeek !== s.lifeGiver.promotionWeek || raw.actor.apothecaryPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as BeautyGoddessAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.gender !== (event.after.sequence === 1 ? 'FEMALE' : event.before.gender)) return false;
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
      const shadow: SliceState = { ...s, ...(s.beautyGoddess.sourceHistory ? structuredClone(s.beautyGoddess.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.beautyGoddess.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'moon', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, beautyGoddess: expected };
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
      expected.acquisitionJournal.push(event);
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.beautyGoddess))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isBeautyGoddess(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.beautyGoddess.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isBeautyGoddess(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !BEAUTY_GODDESS_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.beautyGoddess.lifeGiverActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.beautyGoddess.guidanceKnown || isBeautyGoddess(s)) return false;
    return true;
  } catch { return false; }
}

/** Snapshot-only custody replay for later stages. The enclosing source validator
 * owns actor/root authenticity and deterministic RNG; this replay independently
 * proves vessel genealogy, exact drug costs, failed-remain custody and timing. */
export function resolveBeautyGoddessOriginalCharacteristicsSnapshot(snapshot: Pick<BeautyGoddessState, 'bottles' | 'acquisitionJournal' | 'resupply'>): BeautyGoddessOriginalCharacteristics | null {
  try {
    if (!record(snapshot) || !Array.isArray(snapshot.bottles) || !Array.isArray(snapshot.acquisitionJournal) || snapshot.acquisitionJournal.length > 10000 || !record(snapshot.resupply)) return null;
    const expected = createBeautyGoddessState(); let previous: BeautyGoddessAcquisitionEvent | null = null;
    for (const raw of snapshot.acquisitionJournal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !integer(raw.week, 1) || !integer(raw.revision) || !isValidGameDate(raw.date) || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'lifeGiverPromotionWeek', 'apothecaryPromotionWeek']) ||
        raw.actor.pathwayId !== 'moon' || raw.actor.gender !== raw.before.gender || !integer(raw.actor.lifeGiverPromotionWeek, 1, raw.week) ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceIdentityDigest)) return null;
      const e = raw as unknown as BeautyGoddessAcquisitionEvent, c = e.command, budget = structuredClone(e.before);
      if (!integer(e.cursorBefore, previous?.cursorAfter ?? 0) || e.cursorAfter !== e.cursorBefore + (c.type === 'CONSUME' ? 1 : 0) ||
          c.type === 'CONSUME' && (e.randomBefore !== e.cursorBefore || e.randomAfter !== e.cursorAfter)) return null;
      if (previous && (e.revision <= previous.revision || e.week < previous.week || compareGameDates(e.date, previous.date) < 0 || previous.after.sequence === 1 ||
        e.actor.sourceIdentityDigest !== previous.actor.sourceIdentityDigest ||
        expected.preparedWeek !== null && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after)) ||
        e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0 && (!same(e.before, previous.after) || e.cursorBefore !== previous.cursorAfter))) return null;
      if (expected.preparedWeek !== null && !['CONSUME', 'LEAVE_PREPARATION', 'DECLINE_TRANSFORMATION'].includes(c.type)) return null;
      if (c.type !== 'LEARN_GUIDANCE' && !expected.guidanceKnown) return null;
      if (c.type === 'LEARN_GUIDANCE') {
        if (expected.guidanceKnown) return null;
        expected.guidanceKnown = true; expected.transformation.originalGender = budget.gender; budget.actions--; budget.cash -= BEAUTY_GODDESS_PRICES.guidance;
      } else if (c.type === 'CONFIRM_TRANSFORMATION') {
        if (expected.transformation.decision === 'ACCEPTED') return null;
        expected.transformation.decision = 'ACCEPTED'; expected.transformation.acknowledgedWeek = e.week;
      } else if (c.type === 'DECLINE_TRANSFORMATION') {
        if (expected.transformation.decision === 'DECLINED') return null;
        expected.transformation.decision = 'DECLINED'; expected.transformation.acknowledgedWeek = null; expected.preparedWeek = null;
      } else if (c.type === 'PREPARE_TASK') {
        if (expected.preparations.some(p => p.taskId === c.taskId)) return null;
        expected.preparations.push({ taskId: c.taskId, completedWeek: e.week }); budget.actions--;
      } else if (c.type === 'PREPARE_PROMOTION') {
        if (expected.transformation.decision !== 'ACCEPTED' || expected.resupply.recovery || expected.preparations.length !== 3 || !expected.bottles.some(b => b.status === 'PLAYER') ||
          budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 || e.week < e.actor.lifeGiverPromotionWeek + BEAUTY_GODDESS_MIN_LIFE_GIVER_WEEKS) return null;
        expected.preparedWeek = e.week; budget.actions--; budget.cash -= BEAUTY_GODDESS_PRICES.preparation;
      } else if (c.type === 'LEAVE_PREPARATION') {
        if (expected.preparedWeek === null) return null; expected.preparedWeek = null;
      } else if (c.type === 'REQUEST_SUPPLY') {
        // A pending archived commission may be superseded by the explicit paid investigation.
        if (!exhaustedSupply(expected) || expected.resupply.requestedWeek !== null || expected.bottles.some(b => b.recovery) || expected.acquisitionJournal.some(j => recoveryCommand(j.command))) return null;
        budget.actions--; budget.cash -= BEAUTY_GODDESS_PRICES.resupply; expected.resupply.requestedWeek = e.week;
      } else if (c.type === 'RECEIVE_SUPPLY') return null; // A fourth independent original is a conservation conflict.
      else if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
        const source = recoverySource(expected, c.bottleId), pending = expected.resupply.recovery;
        if (!originalSupplyFailed(expected) || !source) return null;
        budget.actions--;
        if (c.type === 'REQUEST_RECOVERY_V1') {
          if (pending) return null; budget.cash -= BEAUTY_GODDESS_PRICES.recovery; expected.resupply.requestedWeek = e.week;
          expected.resupply.recovery = { version: 1, sourceBottleId: c.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: e.week };
        } else {
          if (!pending || pending.sourceBottleId !== c.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || e.week <= pending.requestedWeek || pending.requestedWeek !== expected.resupply.requestedWeek) return null;
          const recovery = { ...pending, recoveredWeek: e.week }, id = `beauty-goddess-potion-${expected.bottles.length + 1}`;
          expected.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, e.week), e.week), recovery });
          expected.resupply.deliveries++; expected.resupply.requestedWeek = null; delete expected.resupply.recovery;
        }
      } else {
        if (!('bottleId' in c)) return null;
        const bottle = expected.bottles.find(b => b.id === c.bottleId); if (!bottle) return null;
        if (c.type === 'POTION_WORK') {
          if (bottle.status !== 'SUPPLIER' || bottle.labourSteps >= BEAUTY_GODDESS_LABOUR_STEPS) return null;
          bottle.labourSteps++; budget.actions--;
        } else if (c.type === 'BUY_POTION') {
          if (bottle.status !== 'SUPPLIER') return null;
          budget.cash -= potionPrice(bottle); bottle.status = 'PLAYER'; bottle.acquiredWeek = e.week;
        } else if (c.type === 'CONSUME') {
          if (expected.transformation.decision !== 'ACCEPTED' || bottle.status !== 'PLAYER' || expected.preparedWeek !== e.week || !e.check || (!failed(e.check.tier) && !success(e.check.tier)) ||
            !integer(e.randomBefore) || e.randomAfter !== e.randomBefore + 1 || budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100) return null;
          if (!same(e.check, resolveNormalCheck({ ability: 'will', baseAbility: budget.coreStats.will, difficulty: 30, modifiers: [], roll: e.check.roll }))) return null;
          bottle.status = 'CONSUMED'; bottle.outcome = e.check.tier; bottle.consumedWeek = e.week; bottle.preparationWeek = e.week; expected.preparedWeek = null;
          if (success(e.check.tier)) {
            expected.promotionWeek = e.week; expected.lifeGiverActingAtPromotion = budget.acting; budget.sequence = 1; budget.acting = 0; budget.gender = 'FEMALE'; expected.transformation.outcome = 'FEMALE';
            budget.mind = Math.max(1, budget.mind - (e.check.tier === 'GREAT_SUCCESS' ? 8 : 15));
            if (!budget.completedSources.includes('moon-s1')) budget.completedSources.push('moon-s1');
            for (const id of BEAUTY_GODDESS_ABILITY_IDS) budget.mastery[id] = 0;
            for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) budget.coreStats[stat] = Math.min(500, budget.coreStats[stat] + 1);
          } else {
            const severe = e.check.tier === 'GREAT_FAILURE'; budget.health = Math.max(1, budget.health - (severe ? 25 : 15));
            budget.mind = Math.max(1, budget.mind - (severe ? 45 : 25)); budget.pollution = Math.min(100, budget.pollution + (severe ? 60 : 30));
          }
        } else return null;
      }
      if (budget.actions < 0 || budget.cash < 0 || !same(budget, e.after) || c.type !== 'CONSUME' && (e.check !== null || e.randomBefore !== null || e.randomAfter !== null)) return null;
      expected.acquisitionJournal.push(e); previous = e;
    }
    if (!same(expected.bottles, snapshot.bottles) || !same(expected.resupply, snapshot.resupply)) return null;
    const characteristics: BeautyGoddessOriginalCharacteristics['characteristics'] = [];
    for (const id of BEAUTY_GODDESS_BOTTLE_IDS) {
      const attempts = expected.bottles.filter(b => originalBottleId(expected, b) === id), latest = attempts.at(-1);
      if (!latest || attempts[0]!.id !== id) return null;
      characteristics.push({ characteristicId: characteristicId(id), originalBottleId: id, latestBottleId: latest.id,
        holder: latest.status === 'CONSUMED' ? success(latest.outcome) ? 'EMBODIED' : 'FAILED_REMAINS' : latest.status });
    }
    const embodied = characteristics.filter(c => c.holder === 'EMBODIED');
    if (embodied.length > 1 || (expected.promotionWeek !== null) !== (embodied.length === 1)) return null;
    return { characteristics, embodiedOriginalBottleId: embodied[0]?.originalBottleId ?? null, embodiedBottleId: embodied[0]?.latestBottleId ?? null };
  } catch { return null; }
}

/** Read-only conservation view. Full acquisition validation owns the original
 * source, identity and RNG before the same snapshot custody replay is used. */
export function resolveBeautyGoddessOriginalCharacteristics(s: SliceState): BeautyGoddessOriginalCharacteristics | null {
  return validateBeautyGoddessAcquisitionJournal(s) ? resolveBeautyGoddessOriginalCharacteristicsSnapshot(s.beautyGoddess) : null;
}

export function applyBeautyGoddessCommand(s: SliceState, command: BeautyGoddessCommand, ctx: SeerContext): void {
  if (!validateBeautyGoddessCommand(command)) throw new Error('美神命令无效。');
  if (validateBeautyGoddessAcquisitionCommand(command)) return applyBeautyGoddessAcquisition(s, command, ctx);
  if (validateBeautyGoddessActivityCommand(command)) return applyBeautyGoddessActivity(s, command, ctx);
  if (validateBeautyGoddessEncounterCommand(command)) return applyBeautyGoddessEncounterCommand(s, command, ctx);
  throw new Error('未知美神命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function beautyGoddessAcquisitionActions(s: SliceState): BeautyGoddessAction[] {
  if (!knownChannel(s) || isBeautyGoddess(s)) return [];
  const state = s.beautyGoddess, actions: BeautyGoddessAction[] = [];
  const add = (id: string, label: string, cost: string, command: BeautyGoddessAcquisitionCommand) => {
    const reason = beautyGoddessAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION', 'DECLINE_TRANSFORMATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-beauty-goddess-guidance', '听取美神成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    if (state.transformation.decision !== 'ACCEPTED') add('confirm-beauty-goddess-transformation', '知情确认晋升成功后的女性身体', '0行动 · 姓名、年龄、性格与取向不变', { type: 'CONFIRM_TRANSFORMATION', confirmed: true });
    if (state.transformation.decision !== 'DECLINED') add('decline-beauty-goddess-transformation', '暂不接受身体变化，继续作为创生者生活', '0行动 · 不服药 · 已付费用不退', { type: 'DECLINE_TRANSFORMATION' });
    for (const task of BEAUTY_GODDESS_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`beauty-goddess-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-beauty-goddess-promotion', '实际检查本次服药场地', '1行动 · 150便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-beauty-goddess-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.recovery) add('recover-beauty-goddess-characteristic', `回原玻璃暖房旁的安静交接处封存${state.resupply.recovery.characteristicId}`, `1行动 · 最早第${state.resupply.recovery.requestedWeek + 1}周 · 新药另付`, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: state.resupply.recovery.sourceBottleId });
    else if (originalSupplyFailed(state)) for (const bottle of state.bottles) if (recoverySource(state, bottle.id)) add(`request-recovery-${bottle.id}`, `调查${bottle.id}的同一份原特性`, '1行动 · 120便士 · 隔周原处回收 · 旧费用不退', { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < BEAUTY_GODDESS_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${BEAUTY_GODDESS_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${bottle.recovery ? 810 : 5500}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶${bottle.recovery ? '同一原特性重配' : '美神'}魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶美神魔药`, `0行动 · 创生者消化${s.progression.acting}/100 · ${lifeGiverWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredBeautyGoddessAction(s: SliceState, actions: BeautyGoddessAction[]): BeautyGoddessAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectBeautyGoddessLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'DECLINE_TRANSFORMATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectBeautyGoddess(s: SliceState): BeautyGoddessProjection {
  const state = s.beautyGoddess, available = knownChannel(s), promoted = isBeautyGoddess(s);
  const actions = available ? [...beautyGoddessAcquisitionActions(s), ...beautyGoddessLifeActions(s), ...beautyGoddessEncounterActions(s)] : [];
  const preferred = preferredBeautyGoddessAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    transformation: structuredClone(state.transformation), title: '美神·月亮序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${BEAUTY_GODDESS_FORMULA_STATUS}${BEAUTY_GODDESS_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6600便士，或为本瓶完成五项真实劳动后支付1100便士。最初三份特性固定；全部失败后调查费120便士、1行动，隔周另花1行动回收同一份特性。新普通药物与调配服务900便士，或五项新劳动后90便士；当次场地另需150便士。旧独立供货记录只读保留，不再续发。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成创生者的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · ${b.recovery ? '同一原特性重配' : '美神成品魔药'}`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为创生者' : '排异，仍为创生者'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? BEAUTY_GODDESS_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...BEAUTY_GODDESS_INHERITED_ABILITIES, ...BEAUTY_GODDESS_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `创生者消化${state.lifeGiverActingAtPromotion}/100留存；美神扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `创生者需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${lifeGiverWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成创生者的实际经历。',
    pollution: s.seer.pollution, risk: available ? BEAUTY_GODDESS_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；原身体${(state.transformation.originalGender ?? s.character.gender) === 'MALE' ? '男性' : '女性'}，当前身体${s.character.gender === 'FEMALE' ? '女性' : '男性'}。只有成功晋升才成为女性；姓名、年龄、性格与取向不改变，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '原月光纸、动物、血食、药剂与旧月珠均保留实际状态和原主人。回收盘上的旧珠不能当作玩家库存；同一流灯保有自己的身体、精力与唯一原声片。' : '',
    inheritedHistory: available ? [
      `创生者在第${s.lifeGiver.promotionWeek}周实际晋升；${promoted ? `原消化${state.lifeGiverActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      '前八阶21项技巧保持原有掌握，两项新技巧从0开始，共23项。原掌握0仍为0；原35/25/25/15能力权重继续沿用。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实休养。`,
      `流灯仍为同一原身体与原声片：健康${s.summoningMaster.life.partner.health}、精神${s.summoningMaster.life.partner.mind}、精力${s.summoningMaster.life.partner.stamina}，所在${s.summoningMaster.life.partner.location==='HOME'?'原居玻璃屋':s.summoningMaster.life.partner.location==='YARD'?'原庭院':'原通道'}。`,
      `原艾德里安·维尔：${s.lifeGiver.encounter.enemyStatus==='DEAD'?'已经死亡':s.lifeGiver.encounter.enemyStatus==='SURRENDERED'?'已经停止抵抗':'仍有抵抗意愿'}，健康${s.lifeGiver.encounter.enemyHealth}；原埃德温：${s.summoningMaster.encounter.enemyStatus==='DEAD'?'已经死亡':s.summoningMaster.encounter.enemyStatus==='SURRENDERED'?'已经停止抵抗':'仍有抵抗意愿'}；原多里安：${s.witchKing.encounter.enemy.status==='DEAD'?'已经死亡':s.witchKing.encounter.enemy.status==='SURRENDERED'?'已经停止抵抗':'仍有抵抗意愿'}。旧人物的实际结局保留。`,
    ] : [],
    life: projectBeautyGoddessLife(s), encounter: projectBeautyGoddessEncounter(s), insideCase: hasBeautyGoddessLock(s),
    environment: available ? '原玻璃暖房旁的门廊有两米普通通路，家与门廊之间单程六十米。流灯与达莉娅分别决定是否参与；撤回后仍可普通拾取、归还原物和沿路离开。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateBeautyGoddessJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.beautyGoddess.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION', 'DECLINE_TRANSFORMATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
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
    type SharedBudget = Pick<BeautyGoddessAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.beautyGoddess.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.beautyGoddess.encounter, preparation = encounter.preparation;
    const reflection = s.beautyGoddess.life.journal.find(event => event.command.type === 'REFLECT');
    for (const event of encounter.purchases) {
      if (!promotion || !reflection || event.revision - 1 <= reflection.revision || event.week < reflection.week || compareGameDates(event.date, reflection.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision - 1,
        before: shared(event.before), after: shared(event.after), randomBefore: null, randomAfter: null, recordedCursor: event.randomCursor });
    }
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


/** Freeze all predecessor history. Only the authoritative live guest and genuinely spent
 * old paper can evolve, and each must reconcile through the new stage's receipts. */
export function validateBeautyGoddessSource(s: SliceState): boolean {
  try {
    const state = s.beautyGoddess, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, BEAUTY_GODDESS_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'partner', 'papers', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !same(scene.partner, history.summoningMaster.life.partner) || !same(scene.papers, history.witchKing.life.papers) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const current = beautyGoddessSourceHistory(s);
    current.summoningMaster.life.partner = structuredClone(scene.partner);
    current.witchKing.life.papers = structuredClone(scene.papers);
    if (!same(current, history)) return false;
    if (isBeautyGoddess(s) && !same(state.life.sourcePartner, scene.partner)) return false;
    const expectedPartner = isBeautyGoddess(s) ? beautyGoddessExpectedPartner(s) : scene.partner;
    if (!expectedPartner || !same(expectedPartner, s.summoningMaster.life.partner)) return false;
    let papers = structuredClone(scene.papers), revision = scene.revision;
    for (const event of beautyGoddessEncounterOriginalEvents(s)) {
      if (!integer(event.revision, revision + 1, s.revision) || !integer(event.week, scene.week, s.week) || !same(event.before, papers)) return false;
      papers = structuredClone(event.after); revision = event.revision;
    }
    return same(papers, s.witchKing.life.papers);
  } catch { return false; }
}

export const validateBeautyGoddessInheritedState = validateBeautyGoddessSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function beautyGoddessInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.beautyGoddess;
  if (!isBeautyGoddess(s) || !s.beautyGoddess.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'moon', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), beautyGoddess: createBeautyGoddessState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateBeautyGoddessState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.beautyGoddess;
  if (!record(raw) || !shape(raw, ['transformation', 'guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'lifeGiverActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.transformation) || !shape(raw.transformation, ['originalGender', 'decision', 'acknowledgedWeek', 'outcome']) || !['UNDECIDED', 'ACCEPTED', 'DECLINED'].includes(String(raw.transformation.decision)) ||
    raw.transformation.originalGender !== null && !['FEMALE', 'MALE'].includes(String(raw.transformation.originalGender)) || raw.transformation.outcome !== null && raw.transformation.outcome !== 'FEMALE') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries', ...(Object.hasOwn(raw.resupply, 'recovery') ? ['recovery'] : [])]) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as BeautyGoddessState, promoted = isBeautyGoddess(s), acquisitionStage = isBeautyGoddessAcquisitionStage(s);
  const recoveryDeliveries = state.bottles.filter(b => record(b) && Object.hasOwn(b, 'recovery')).length;
  const legacyDeliveries = state.resupply.deliveries - recoveryDeliveries;
  if (!integer(legacyDeliveries) || state.bottles.length !== 3 + legacyDeliveries * 3 + recoveryDeliveries) return false;
  const validRecovery = (r: unknown, recovered: boolean): r is BeautyGoddessRecoveryRequest => record(r) &&
    shape(r, ['version', 'sourceBottleId', 'originalBottleId', 'characteristicId', 'requestedWeek', ...(recovered ? ['recoveredWeek'] : [])]) &&
    r.version === 1 && typeof r.sourceBottleId === 'string' && /^beauty-goddess-potion-[1-9]\d{0,14}$/.test(r.sourceBottleId) &&
    BEAUTY_GODDESS_BOTTLE_IDS.includes(r.originalBottleId as typeof BEAUTY_GODDESS_BOTTLE_IDS[number]) && r.characteristicId === characteristicId(String(r.originalBottleId)) &&
    integer(r.requestedWeek, s.lifeGiver.promotionWeek ?? s.week, s.week) && (!recovered || integer(r.recoveredWeek, r.requestedWeek + 1, s.week));
  if (Object.hasOwn(state.resupply, 'recovery') && !validRecovery(state.resupply.recovery, false)) return false;
  const firstWeek = s.lifeGiver.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + BEAUTY_GODDESS_MIN_LIFE_GIVER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateBeautyGoddessSource(s))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > BEAUTY_GODDESS_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !BEAUTY_GODDESS_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasBeautyGoddessOldPractice(s) || hasBeautyGoddessLifeLock(s) || hasBeautyGoddessEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.lifeGiver.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.lifeGiverActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !lifeGiverReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...BEAUTY_GODDESS_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.lifeGiverActingAtPromotion !== null || BEAUTY_GODDESS_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome', ...(Object.hasOwn(b, 'recovery') ? ['recovery'] : [])]) || b.id !== `beauty-goddess-potion-${index + 1}` || !integer(b.labourSteps, 0, BEAUTY_GODDESS_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < BEAUTY_GODDESS_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== BEAUTY_GODDESS_POTION_SOURCES[index]!.source || Object.hasOwn(b, 'recovery')) return false;
    } else if (b.recovery) {
      if (!validRecovery(b.recovery, true) || !state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.recovery.recoveredWeek !== b.stockedWeek || b.source !== recoverySourceText(b.id, b.recovery, b.stockedWeek) || !originalBottleId(state, b)) return false;
      const prefix = { ...state, bottles: state.bottles.slice(0, index) };
      const source = recoverySource(prefix, b.recovery.sourceBottleId);
      if (!originalSupplyFailed(prefix) || !source || source.originalBottleId !== b.recovery.originalBottleId || source.characteristicId !== b.recovery.characteristicId || source.bottle.consumedWeek! > b.recovery.requestedWeek) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % BEAUTY_GODDESS_BOTTLE_IDS.length;
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
        if (!integer(s.lifeGiver.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !(state.resupply.recovery ? originalSupplyFailed(state) : exhaustedSupply(state)))) return false;
  if (state.resupply.recovery) {
    const pending = state.resupply.recovery, source = recoverySource(state, pending.sourceBottleId);
    if (!source || pending.requestedWeek !== state.resupply.requestedWeek || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || source.bottle.consumedWeek! > pending.requestedWeek) return false;
  } else if (state.resupply.requestedWeek !== null && state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!)) return false;
  if (successes !== (promoted ? 1 : 0) || !validateBeautyGoddessAcquisitionJournal(s) || !validateBeautyGoddessJournalContinuity(s) || !validateBeautyGoddessLife(s) || !validateBeautyGoddessEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('moon-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [caseId, ability] of [['steady-hands', BEAUTY_GODDESS_ABILITY_IDS[0]], ['lit-crossing', BEAUTY_GODDESS_ABILITY_IDS[1]]] as const) {
      const r = state.life.cases[caseId];
      if (r.status === 'RESOLVED' && r.abilityApplied && r.result === 'ABILITY') expectedMastery[ability] = Math.min(500, expectedMastery[ability]! + 8);
    }
    for (const round of s.combatHistory) if (round.beautyGoddessOutcome) {
      for (const action of [...round.beautyGoddessOutcome.playerActions, ...round.beautyGoddessOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('moon-s1')) return false;
  return true;
}
export { BEAUTY_GODDESS_ABILITIES } from './content.js';
export { BEAUTY_GODDESS_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleBeautyGoddess = applyBeautyGoddessCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateBeautyGoddessHistory = validateBeautyGoddessState;
