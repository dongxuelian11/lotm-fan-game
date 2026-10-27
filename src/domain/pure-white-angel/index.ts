import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { BARD_ABILITY_IDS } from '../bard/types.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_ABILITY_IDS } from '../sunpriest/types.js';
import { NOTARY_ABILITY_IDS } from '../notary/types.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS } from '../priest-of-light/types.js';
import { UNSHADOWED_ABILITY_IDS } from '../unshadowed/types.js';
import { JUSTICE_MENTOR_ABILITY_IDS } from '../justice-mentor/types.js';
import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import { validateBardState } from '../bard/index.js';
import { validateLightprayerState } from '../lightprayer/index.js';
import { validateSunpriestState } from '../sunpriest/index.js';
import { validateNotaryState } from '../notary/index.js';
import { validatePriestOfLightState } from '../priest-of-light/index.js';
import { validateUnshadowedState } from '../unshadowed/index.js';
import { validateJusticeMentorState } from '../justice-mentor/index.js';
import { validateLightSeekerState, hasLightSeekerLock, hasLightSeekerOldSceneLock } from '../light-seeker/index.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { validateLightSeekerSiteState } from '../light-seeker/resources.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createPureWhiteAngelLifeState, initializePureWhiteAngelLifeState, applyPureWhiteAngelLifeCommand, projectPureWhiteAngelLife, pureWhiteAngelLifeActions, validatePureWhiteAngelLifeState, validatePureWhiteAngelActivityCommand, hasPureWhiteAngelLifeLock, pureWhiteAngelExpectedOriginals, pureWhiteAngelLifeMasteryGains } from './life.js';
import { createPureWhiteAngelEncounterState, applyPureWhiteAngelEncounterCommand, projectPureWhiteAngelEncounter, pureWhiteAngelEncounterActions, validatePureWhiteAngelEncounterState, validatePureWhiteAngelEncounterCommand, hasPureWhiteAngelEncounterLock, pureWhiteAngelEncounterOriginalEvents } from './encounter.js';
import { PURE_WHITE_ANGEL_ABILITIES, PURE_WHITE_ANGEL_INHERITED_ABILITIES, PURE_WHITE_ANGEL_BOTTLE_IDS, PURE_WHITE_ANGEL_CONSUMPTION_RISK, PURE_WHITE_ANGEL_FORMULA_STATUS, PURE_WHITE_ANGEL_GUIDE, PURE_WHITE_ANGEL_LABOUR_STEPS, PURE_WHITE_ANGEL_LABOUR_TASKS, PURE_WHITE_ANGEL_MIN_LIGHT_SEEKER_WEEKS, PURE_WHITE_ANGEL_POTION_SOURCES, PURE_WHITE_ANGEL_PREPARATIONS, PURE_WHITE_ANGEL_PRICES, PURE_WHITE_ANGEL_RECOVERY_SCHEMA_VERSION, PURE_WHITE_ANGEL_RECOVERY_SITE_ID, PURE_WHITE_ANGEL_SOURCE_STATUS } from './content.js';
import { PURE_WHITE_ANGEL_ABILITY_IDS, PURE_WHITE_ANGEL_PREPARATION_IDS, PURE_WHITE_ANGEL_SOURCE_KEYS, type PureWhiteAngelOriginals, type PureWhiteAngelSourceHistory, type PureWhiteAngelAcquisitionBudget, type PureWhiteAngelAcquisitionEvent, type PureWhiteAngelAcquisitionCommand, type PureWhiteAngelAction, type PureWhiteAngelBottle, type PureWhiteAngelCommand, type PureWhiteAngelProjection, type PureWhiteAngelState, type PureWhiteAngelRecoveryRequest, type PureWhiteAngelOriginalCharacteristics, type PureWhiteAngelRecoverySite } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS = [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS, ...NOTARY_ABILITY_IDS, ...PRIEST_OF_LIGHT_ABILITY_IDS, ...UNSHADOWED_ABILITY_IDS, ...JUSTICE_MENTOR_ABILITY_IDS, ...LIGHT_SEEKER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): PureWhiteAngelBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createPureWhiteAngelState(): PureWhiteAngelState {
  return { guidanceKnown: false, bottles: PURE_WHITE_ANGEL_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, lightSeekerActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createPureWhiteAngelLifeState(), encounter: createPureWhiteAngelEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isPureWhiteAngel = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 1;
export const isPureWhiteAngelAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 2;
export const hasPureWhiteAngelHistory = (s: SliceState) => isPureWhiteAngel(s) && s.pureWhiteAngel.promotionWeek !== null;
/** Source stages retain their real purchase, brewing and ritual shapes. Detailed
 * predecessor validators run on the frozen S2 source, never an invented history. */
function sourceHistory(s: SliceState): boolean {
  if (!s.bard.discovered || !s.bard.guidanceKnown || !integer(s.progression.promotionWeek, 1, s.week)) return false;
  const bought = (bottles: readonly { status: string; outcome: string | null; acquiredWeek: number | null; consumedWeek: number | null }[], from: number, promoted: number) => {
    const won = bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    return won.length === 1 && won[0]!.consumedWeek === promoted && integer(won[0]!.acquiredWeek, from, promoted);
  };
  if (!bought(s.bard.bottles, 1, s.progression.promotionWeek)) return false;
  let previous = s.progression.promotionWeek;
  if (!s.lightprayer.guidanceKnown || !integer(s.lightprayer.promotionWeek, previous, s.week) ||
      !bought(s.lightprayer.bottles, previous, s.lightprayer.promotionWeek)) return false;
  previous = s.lightprayer.promotionWeek;
  for (const stage of [s.sunpriest, s.notary]) {
    if (!stage.formulaKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const won = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (won.length !== 1 || !integer(won[0]!.brewedWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  const priest = s.priestOfLight;
  if (!priest.formulaKnown || !integer(priest.promotionWeek, previous, s.week)) return false;
  const priestBottle = priest.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (priestBottle.length !== 1 || priestBottle[0]!.consumedWeek !== priest.promotionWeek ||
      !integer(priestBottle[0]!.brewedWeek, previous, priest.promotionWeek) ||
      !priest.ritual.history.some(v => v.number === priestBottle[0]!.ritualVisit && v.consumedBottleId === priestBottle[0]!.id &&
        v.entered && v.returned && v.visitWeek === priest.promotionWeek)) return false;
  previous = priest.promotionWeek;
  const unshadowed = s.unshadowed;
  if (!unshadowed.formulaKnown || !integer(unshadowed.promotionWeek, previous, s.week)) return false;
  const completed = unshadowed.ritual.visits.filter(v => v.finishedSuccess);
  if (completed.length !== 1 || completed[0]!.closedWeek !== unshadowed.promotionWeek) return false;
  const unshadowedBottle = unshadowed.bottles.find(b => b.id === completed[0]!.pendingBottleId);
  if (!unshadowedBottle || unshadowedBottle.status !== 'CONSUMED' || !success(unshadowedBottle.outcome) ||
      unshadowedBottle.ritualId !== completed[0]!.id || unshadowedBottle.consumedWeek !== completed[0]!.consumedWeek ||
      !integer(unshadowedBottle.brewedWeek, previous, unshadowed.promotionWeek)) return false;
  previous = unshadowed.promotionWeek;
  for (const stage of [s.justiceMentor, s.lightSeeker]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week) || !bought(stage.bottles, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.lightprayer.bardActingAtPromotion === 100 && s.sunpriest.lightprayerActingAtPromotion === 100 &&
    s.notary.sunpriestActingAtPromotion === 100 && s.priestOfLight.notaryActingAtPromotion === 100 &&
    s.unshadowed.priestOfLightActingAtPromotion === 100 && s.justiceMentor.unshadowedActingAtPromotion === 100 &&
    s.lightSeeker.justiceMentorActingAtPromotion === 100;
}
export function pureWhiteAngelSourceHistory(s: SliceState): PureWhiteAngelSourceHistory {
  return Object.fromEntries(PURE_WHITE_ANGEL_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as PureWhiteAngelSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.pureWhiteAngel.sourceHistory ?? pureWhiteAngelSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isPureWhiteAngelAcquisitionStage(s) || isPureWhiteAngel(s)) && sourceHistory(s);
/** Once guidance freezes the source, old commands close and completed records stay exact. */
export function hasPureWhiteAngelOldPractice(s: SliceState): boolean {
  return hasLightSeekerOldSceneLock(s) || hasLightSeekerLock(s);
}
const lightSeekerReportsComplete = (s: SliceState) => s.lightSeeker.life.reflected &&
  Object.keys(s.lightSeeker.life.cases).length === 3 && Object.values(s.lightSeeker.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.attempts.length > 0 && c.attempts.every(attempt => attempt.week <= s.week) &&
    c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected && c.attempts.at(-1)!.siteAtClose?.playerLocation === 'ENTRY' && c.attempts.at(-1)!.siteAtClose?.light.mode === 'OFF');
export const pureWhiteAngelOriginals = (s: SliceState): PureWhiteAngelOriginals => structuredClone(s.lightSeeker.life.site);
export const hasPureWhiteAngelOldSceneLock = hasPureWhiteAngelOldPractice;
export const hasPureWhiteAngelRitualLock = (s: SliceState): boolean => s.pureWhiteAngel.preparedWeek !== null;
export const hasPureWhiteAngelLock = (s: SliceState): boolean => hasPureWhiteAngelRitualLock(s) || hasPureWhiteAngelLifeLock(s) || hasPureWhiteAngelEncounterLock(s);
const bottleNumber = (b: Pick<PureWhiteAngelBottle, 'id'>) => Number(b.id.slice('pure-white-angel-potion-'.length));
const potionPrice = (b: PureWhiteAngelBottle) => b.recovery
  ? b.labourSteps === PURE_WHITE_ANGEL_LABOUR_STEPS ? PURE_WHITE_ANGEL_PRICES.recoveryLabourBalance : PURE_WHITE_ANGEL_PRICES.recoveryDrug
  : PURE_WHITE_ANGEL_PRICES.potion - (b.labourSteps === PURE_WHITE_ANGEL_LABOUR_STEPS ? PURE_WHITE_ANGEL_PRICES.labourCredit : 0);
const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
const characteristicId = (bottleId: string) => `${bottleId}:characteristic`;
const recoverySourceText = (id: string, recovery: PureWhiteAngelRecoveryRequest, week: number) => `玛拉在原采光廊入口核验${recovery.sourceBottleId}排异后遗留的同一份纯白天使特性${recovery.characteristicId}，核对同次原失败回执及原保管人玛拉取得本次许可后当面交接，第${week}周回收封存到重配瓶${id}。原特性来自${recovery.originalBottleId}；新普通药物与调配服务另付，旧原瓶及其实际结果不改写。`;
/** Follow actual vessel ancestry without treating an attempt number as a fourth original. */
function originalBottleId(state: PureWhiteAngelState, bottle: PureWhiteAngelBottle): string | null {
  const seen = new Set<string>(); let current = bottle;
  while (current.recovery) {
    if (seen.has(current.id)) return null; seen.add(current.id);
    const r = current.recovery, previous = state.bottles.find(b => b.id === r.sourceBottleId);
    if (!previous || r.siteId !== PURE_WHITE_ANGEL_RECOVERY_SITE_ID || r.custodian !== 'LS2-MARA' || !integer(r.sourceReceiptRevision) || bottleNumber(previous) >= bottleNumber(current) || r.version !== 1 ||
      !PURE_WHITE_ANGEL_BOTTLE_IDS.includes(r.originalBottleId as typeof PURE_WHITE_ANGEL_BOTTLE_IDS[number]) || r.characteristicId !== characteristicId(r.originalBottleId) ||
      previous.status !== 'CONSUMED' || !failed(previous.outcome) || previous.consumedWeek === null || previous.consumedWeek > r.requestedWeek ||
      r.recoveredWeek <= r.requestedWeek || current.stockedWeek !== r.recoveredWeek) return null;
    if (previous.recovery && (previous.recovery.originalBottleId !== r.originalBottleId || previous.recovery.characteristicId !== r.characteristicId)) return null;
    if (!previous.recovery && previous.id !== r.originalBottleId) return null;
    current = previous;
  }
  return PURE_WHITE_ANGEL_BOTTLE_IDS.includes(current.id as typeof PURE_WHITE_ANGEL_BOTTLE_IDS[number]) ? current.id : null;
}
function recoverySource(state: PureWhiteAngelState, bottleId: string) {
  const bottle = state.bottles.find(b => b.id === bottleId);
  if (state.bottles.slice(3).some(b => !b.recovery)) return null;
  if (!bottle || bottle.status !== 'CONSUMED' || !failed(bottle.outcome) || bottle.consumedWeek === null) return null;
  const original = originalBottleId(state, bottle);
  if (!original || state.bottles.some(b => b.recovery?.sourceBottleId === bottleId)) return null;
  // Earlier consumed rows are receipts. A live vessel or an embodied original cannot be recovered again.
  if (state.bottles.some(b => originalBottleId(state, b) === original && (b.status !== 'CONSUMED' || success(b.outcome)))) return null;
  const consumed = state.acquisitionJournal.filter(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId);
  if (consumed.length !== 1 || consumed[0]!.week !== bottle.consumedWeek || consumed[0]!.check?.tier !== bottle.outcome || consumed[0]!.after.sequence !== 2) return null;
  return { bottle, receipt: consumed[0]!, originalBottleId: original, characteristicId: characteristicId(original) };
}
/** The reachable original ENTRY remains authoritative during S2 acquisition.
 * No closed S2 activity is reopened and no original object is moved or restored. */
function recoveryPlaceAvailable(o: PureWhiteAngelOriginals): boolean {
  return validateLightSeekerSiteState(o) && o.playerLocation === 'ENTRY' && o.ordinaryExit === 'OPEN' &&
    o.light.mode === 'OFF' && o.operatorId === 'LS2-MARA' && o.operatorAge === 46 && o.operatorLocation === 'SIDE' &&
    o.spiritLocation === 'SIDE' && o.cover.position === 'OWNER_STAND' && o.board.location === 'FAR_STAND' && o.board.owner === 'LS2-MARA';
}
function recoverySiteReceipt(s: SliceState, command: PureWhiteAngelAcquisitionCommand): PureWhiteAngelRecoverySite | undefined {
  if (!recoveryCommand(command) || !('bottleId' in command)) return undefined;
  const source = recoverySource(s.pureWhiteAngel, command.bottleId);
  if (!source || !recoveryPlaceAvailable(pureWhiteAngelOriginals(s))) throw new Error('原采光廊与同一份失败特性尚未核实。');
  return { siteId: PURE_WHITE_ANGEL_RECOVERY_SITE_ID, originals: pureWhiteAngelOriginals(s),
    permission: { personId: 'LS2-MARA', week: s.week, revision: s.revision, purpose: command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER' },
    originalBottleId: source.originalBottleId, sourceBottleId: source.bottle.id, characteristicId: source.characteristicId, sourceReceiptRevision: source.receipt.revision,
    custodyBefore: 'FAILED_REMNANT', custodyAfter: command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SUPPLIER' };
}
function validRecoverySite(event: PureWhiteAngelAcquisitionEvent, state: PureWhiteAngelState): boolean {
  if (!recoveryCommand(event.command)) return !Object.hasOwn(event, 'recoverySite');
  const site = event.recoverySite, command = event.command;
  if (!('bottleId' in command) || !record(site) || !shape(site, ['siteId', 'originals', 'permission', 'originalBottleId', 'sourceBottleId', 'characteristicId', 'sourceReceiptRevision', 'custodyBefore', 'custodyAfter']) ||
    site.siteId !== PURE_WHITE_ANGEL_RECOVERY_SITE_ID || !recoveryPlaceAvailable(site.originals) ||
    !record(site.permission) || !shape(site.permission, ['personId', 'week', 'revision', 'purpose']) || site.permission.personId !== site.originals.operatorId ||
    site.permission.week !== event.week || site.permission.revision !== event.revision || site.permission.purpose !== (command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER') ||
    site.custodyBefore !== 'FAILED_REMNANT' || site.custodyAfter !== (command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SUPPLIER')) return false;
  const source = recoverySource(state, command.bottleId), previous = state.acquisitionJournal.find(e => e.recoverySite)?.recoverySite;
  return !!source && site.originalBottleId === source.originalBottleId && site.sourceBottleId === command.bottleId && site.characteristicId === source.characteristicId && site.sourceReceiptRevision === source.receipt.revision &&
    (!previous || same(previous.originals, site.originals));
}
const lightSeekerWeeks = (s: SliceState) => Math.max(0, (s.pureWhiteAngel.promotionWeek ?? s.week) - (s.lightSeeker.promotionWeek ?? s.week));
const exhaustedSupply = (state: PureWhiteAngelState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const originalSupplyFailed = (state: PureWhiteAngelState) => state.bottles.length >= 3 && state.bottles.slice(0, 3).every((b, index) => b.id === PURE_WHITE_ANGEL_BOTTLE_IDS[index] && !b.recovery && b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${PURE_WHITE_ANGEL_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1纯白天使成品，独立封存编号pure-white-angel-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => PURE_WHITE_ANGEL_PREPARATION_IDS.every(id => s.pureWhiteAngel.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `逐光者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.lightSeeker.promotionWeek === null || lightSeekerWeeks(s) < PURE_WHITE_ANGEL_MIN_LIGHT_SEEKER_WEEKS) return `成为逐光者后已过${lightSeekerWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!lightSeekerReportsComplete(s)) return '先完成逐光者的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与既往报告、已见目标位置与有限能力边界和普通返回路线；领取药瓶不能代做专业准备。';
}
function validateAcquisitionCommand(v: unknown, historicalReplay = false): v is PureWhiteAngelAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (legacySupply(v as { type: string })) return historicalReplay && shape(v, ['type']);
  if (['LEARN_GUIDANCE', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && PURE_WHITE_ANGEL_PREPARATION_IDS.includes(v.taskId as typeof PURE_WHITE_ANGEL_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^pure-white-angel-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export function validatePureWhiteAngelAcquisitionCommand(v: unknown): v is PureWhiteAngelAcquisitionCommand { return validateAcquisitionCommand(v); }
export const isPureWhiteAngelAcquisitionCommand = validatePureWhiteAngelAcquisitionCommand;
export function validatePureWhiteAngelCommand(v: unknown): v is PureWhiteAngelCommand {
  return validatePureWhiteAngelAcquisitionCommand(v) || validatePureWhiteAngelActivityCommand(v) || validatePureWhiteAngelEncounterCommand(v);
}
export function pureWhiteAngelAcquisitionBlock(s: SliceState, command: PureWhiteAngelAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: PureWhiteAngelAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAcquisitionCommand(command, historicalReplay)) return '纯白天使准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasPureWhiteAngelOldPractice(s)) || hasPureWhiteAngelLifeLock(s) || hasPureWhiteAngelEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原采光廊旁的安静交接处。';
  if (s.lightSeeker.life.site.playerLocation !== 'ENTRY' || s.lightSeeker.life.site.light.mode !== 'OFF') return '先实际回到原采光廊入口并停光，再进行服药交接。';
  if (!knownChannel(s)) return '实际成为逐光者并保留原指导渠道后，才能了解纯白天使之路。';
  if (!isPureWhiteAngelAcquisitionStage(s)) return '已经晋升纯白天使1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '歌颂者至逐光者的20项掌握记录不完整，暂不能继续晋升。';
  const state = s.pureWhiteAngel;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (!historicalReplay && state.bottles.slice(3).some(b => !b.recovery)) return '存在历史独立第4份及以后原特性，来源总量未解决；旧记录完整只读，不能改标成回收件或继续本入口。';
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !lightSeekerReportsComplete(s)) return '先完成逐光者三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < PURE_WHITE_ANGEL_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    if (state.resupply.recovery) return '先完成已付费的原特性调查回收，再准备本次服药。';
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的纯白天使原瓶。';
    return s.cash < PURE_WHITE_ANGEL_PRICES.preparation ? '当次场地检查需要150便士。' : null;
  }
  if (command.type === 'REQUEST_RECOVERY_V1' || command.type === 'RECOVER_CHARACTERISTIC_V1') {
    if (s.schemaVersion < PURE_WHITE_ANGEL_RECOVERY_SCHEMA_VERSION) return '这一原特性回收协议须使用对应的新版本存档。';
    if (!recoveryPlaceAvailable(pureWhiteAngelOriginals(s)) || !state.sourceScene || !same(pureWhiteAngelOriginals(s), state.sourceScene.originals)) return '须本人在贝克兰德原采光廊的畅通入口，与原保管人玛拉在侧路本人当面核验；原遮板、灯、屏板与字牌保持当前实物状态，本次许可重新取得，不能使用旧位置或旧许可。';
    const source = recoverySource(state, command.bottleId), pending = state.resupply.recovery;
    if (!originalSupplyFailed(state)) return '最初三瓶须实际耗尽失败，才能调查并回收同一份原特性。';
    if (!source) return '须核验真实失败原瓶、同一原特性与实际服药记录；已回收或仍被持有的特性不能重复取得。';
    if (command.type === 'REQUEST_RECOVERY_V1') return pending ? '已有指定失败原瓶的调查委托，须先完成回收。' : s.cash < PURE_WHITE_ANGEL_PRICES.recovery ? '调查原特性需要1行动、120便士；旧费用不退。' : null;
    if (!pending || pending.version !== 1 || pending.sourceBottleId !== command.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.requestedWeek !== state.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== PURE_WHITE_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'LS2-MARA') return '先支付对应失败原瓶的调查委托，不能更换原特性。';
    return s.week <= pending.requestedWeek ? '调查后须隔一真实周，再到原采光廊的畅通入口核验并封存同一份原特性。' : null;
  }
  if (legacySupply(command) && (state.resupply.recovery || state.bottles.some(b => b.recovery) || state.acquisitionJournal.some(e => recoveryCommand(e.command)))) return '已经开始原特性回收，不能续接独立新原瓶的旧供货记录。';
  if (command.type === 'REQUEST_SUPPLY' && s.cash < PURE_WHITE_ANGEL_PRICES.resupply) return '申请下一批需要100便士实际费用。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批纯白天使原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的纯白天使准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选纯白天使独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与150便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PURE_WHITE_ANGEL_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: PureWhiteAngelAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.pureWhiteAngel;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = pureWhiteAngelSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: acquisitionBudget(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: pureWhiteAngelOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= PURE_WHITE_ANGEL_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取纯白天使独立成品与专业准备指导', `花1行动、500便士。${PURE_WHITE_ANGEL_GUIDE}说明原渠道记录。${PURE_WHITE_ANGEL_FORMULA_STATUS}${PURE_WHITE_ANGEL_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = PURE_WHITE_ANGEL_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= PURE_WHITE_ANGEL_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、150便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与150便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      if (bottle.recovery) ctx.note('核验同一原特性的本次新药调配', `实际完成重配瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本次新普通药物与调配服务810便士，余款90便士；旧劳务不转用，原特性不复制。`);
      else ctx.note(PURE_WHITE_ANGEL_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款1100便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      if (bottle.recovery) ctx.note('同一原特性的新药实际重配交付', `0行动、${paid}便士支付本次新普通药物与调配服务，领取${bottle.id}；其中原特性仍为${bottle.recovery.characteristicId}。当周场地检查仍须另付。`);
      else ctx.note('纯白天使独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_RECOVERY_V1': {
      const source = recoverySource(state, command.bottleId)!;
      s.actionsRemaining--; s.cash -= PURE_WHITE_ANGEL_PRICES.recovery; state.resupply.requestedWeek = s.week;
      state.resupply.recovery = { version: 1, sourceBottleId: command.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: s.week, sourceReceiptRevision: source.receipt.revision, siteId: PURE_WHITE_ANGEL_RECOVERY_SITE_ID, custodian: 'LS2-MARA' as const };
      ctx.note('调查失败原瓶遗留的同一份特性', `1行动、120便士，本人在原采光廊入口重新向46岁的玛拉询问本次许可，获准后当面按第${source.receipt.week}周同次真实失败回执逐一核对，实际辨认并登记仍由玛拉留存保管的${source.characteristicId}，本次尚未交付。此项是现在发生的调查，不改写旧失败记载。隔一真实周再到同一原处当面复核、封存交接；原出口受阻或玛拉不在原处时不能回收。旧原瓶、失败、费用与伤势全部保留，不退款。`); return;
    }
    case 'RECOVER_CHARACTERISTIC_V1': {
      const recovery = { ...state.resupply.recovery!, recoveredWeek: s.week }, id = `pure-white-angel-potion-${state.bottles.length + 1}`;
      s.actionsRemaining--;
      state.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, s.week), s.week), recovery });
      state.resupply.deliveries++; state.resupply.requestedWeek = null; delete state.resupply.recovery;
      ctx.note('原处回收封存同一份纯白天使特性', `再次当面取得玛拉本次交接许可，以1行动将${recovery.characteristicId}封存到重配瓶${id}，没有新增原特性。新普通药物与调配服务须另付900便士，五项新劳务后90便士；之后仍须1行动、150便士检查本次场地。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= PURE_WHITE_ANGEL_PRICES.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批纯白天使成品', `原瓶全部失败耗尽，花1行动与100便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < PURE_WHITE_ANGEL_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`pure-white-angel-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶纯白天使原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6600便士或对应五项劳动后1100便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.lightSeekerActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('sun-s1')) s.seer.completedSources.push('sun-s1');
        initializePureWhiteAngelLifeState(s);
        for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为纯白天使', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；逐光者消化100与原20项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。性别、姓名、年龄、性格与取向不改写。旧伤、原人及受托物、过去八阶的原瓶、劳务与实际结果全部留存。旧敌人的死亡或投降不重开，原遮板、油灯、遮罩、屏板与字牌不复制、不修复，玛拉与芦影已消耗的精力不会恢复；晋升不会治疗本人或旧人。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '纯白天使魔药严重排异' : '纯白天使魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为逐光者，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、150便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): PureWhiteAngelAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: PureWhiteAngelState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, lightSeekerActingAtPromotion: state.lightSeekerActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyPureWhiteAngelAcquisition(s: SliceState, command: PureWhiteAngelAcquisitionCommand, ctx: SeerContext): void {
  const reason = pureWhiteAngelAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = acquisitionBudget(s), actor: PureWhiteAngelAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'sun',
    lightSeekerPromotionWeek: s.lightSeeker.promotionWeek!, bardPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  const recoverySite = recoverySiteReceipt(s, command);
  applyAcquisitionMutation(s, command, recording);
  s.pureWhiteAngel.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result, ...(recoverySite ? { recoverySite } : {}) });
}
function validAcquisitionBudget(v: unknown): v is PureWhiteAngelAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? PURE_WHITE_ANGEL_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validatePureWhiteAngelAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.pureWhiteAngel.acquisitionJournal, expected = createPureWhiteAngelState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    if (s.schemaVersion < PURE_WHITE_ANGEL_RECOVERY_SCHEMA_VERSION && (s.pureWhiteAngel.resupply.recovery || s.pureWhiteAngel.bottles.some(b => b.recovery) || journal.some(e => recoveryCommand(e.command) || Object.hasOwn(e, 'recoverySite')))) return false;
    let previous: PureWhiteAngelAcquisitionEvent | null = null, nextCursor = s.pureWhiteAngel.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !integer(raw.week, s.lightSeeker.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'lightSeekerPromotionWeek', 'bardPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'sun' || raw.actor.lightSeekerPromotionWeek !== s.lightSeeker.promotionWeek || raw.actor.bardPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as PureWhiteAngelAcquisitionEvent;
      if (!validRecoverySite(event, expected)) return false;
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
      const shadow: SliceState = { ...s, ...(s.pureWhiteAngel.sourceHistory ? structuredClone(s.pureWhiteAngel.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.pureWhiteAngel.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'sun', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, pureWhiteAngel: expected };
      let checks = 0;
      const context: SeerContext = { note() {}, roll() { throw new Error('购药准备没有额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || event.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30 ||
          !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) throw new Error('服药随机来源不一致。');
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: 'will', baseAbility: b.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || random.cursor !== event.randomAfter) throw new Error('服药结果与原随机记录不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return check;
      } };
      if (recoveryCommand(event.command) && !same(recoverySiteReceipt(shadow, event.command), event.recoverySite)) return false;
      applyAcquisitionMutation(shadow, event.command, context, true);
      if (!same(acquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      expected.acquisitionJournal.push(event);
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.pureWhiteAngel))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isPureWhiteAngel(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.pureWhiteAngel.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isPureWhiteAngel(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !PURE_WHITE_ANGEL_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.pureWhiteAngel.lightSeekerActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.pureWhiteAngel.guidanceKnown || isPureWhiteAngel(s)) return false;
    return true;
  } catch { return false; }
}

/** Snapshot-only custody replay for later stages. The enclosing source validator
 * owns actor/root authenticity and deterministic RNG; this replay independently
 * proves vessel genealogy, exact drug costs, failed-remain custody and timing. */
export function resolvePureWhiteAngelOriginalsSnapshot(snapshot: Pick<PureWhiteAngelState, 'bottles' | 'acquisitionJournal' | 'resupply'>): PureWhiteAngelOriginalCharacteristics | null {
  try {
    if (!record(snapshot) || !Array.isArray(snapshot.bottles) || !Array.isArray(snapshot.acquisitionJournal) || snapshot.acquisitionJournal.length > 10000 || !record(snapshot.resupply)) return null;
    const expected = createPureWhiteAngelState(); let previous: PureWhiteAngelAcquisitionEvent | null = null;
    for (const raw of snapshot.acquisitionJournal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !integer(raw.week, 1) || !integer(raw.revision) || !isValidGameDate(raw.date) || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'lightSeekerPromotionWeek', 'bardPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || !integer(raw.actor.age, 1) ||
        !integer(raw.actor.bardPromotionWeek, 1, raw.actor.lightSeekerPromotionWeek as number) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'sun' || raw.actor.gender !== raw.before.gender || !integer(raw.actor.lightSeekerPromotionWeek, 1, raw.week) ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceIdentityDigest)) return null;
      const e = raw as unknown as PureWhiteAngelAcquisitionEvent, c = e.command, budget = structuredClone(e.before);
      if (!validRecoverySite(e, expected)) return null;
      if (!integer(e.cursorBefore, previous?.cursorAfter ?? 0) || e.cursorAfter !== e.cursorBefore + (c.type === 'CONSUME' ? 1 : 0) ||
          c.type === 'CONSUME' && (e.randomBefore !== e.cursorBefore || e.randomAfter !== e.cursorAfter)) return null;
      if (previous && (e.revision <= previous.revision || e.week < previous.week || compareGameDates(e.date, previous.date) < 0 || previous.after.sequence === 1 ||
        e.actor.sourceIdentityDigest !== previous.actor.sourceIdentityDigest || e.actor.name !== previous.actor.name || e.actor.gender !== previous.actor.gender || e.actor.age !== previous.actor.age ||
        e.actor.lightSeekerPromotionWeek !== previous.actor.lightSeekerPromotionWeek || e.actor.bardPromotionWeek !== previous.actor.bardPromotionWeek ||
        INHERITED_ABILITY_IDS.some(id => e.before.mastery[id] !== previous!.after.mastery[id]) || !same(e.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources) ||
        expected.preparedWeek !== null && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after)) ||
        e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0 && (!same(e.before, previous.after) || e.cursorBefore !== previous.cursorAfter))) return null;
      if (e.after.gender !== e.before.gender || e.actor.sourceHistoryDigest !== null && e.actor.sourceHistoryDigest !== (previous ? expected.acquisitionJournal[0]!.actor.sourceHistoryDigest : e.actor.sourceHistoryDigest)) return null;
      if (expected.preparedWeek !== null && !['CONSUME', 'LEAVE_PREPARATION'].includes(c.type)) return null;
      if (c.type !== 'LEARN_GUIDANCE' && !expected.guidanceKnown) return null;
      if (c.type === 'LEARN_GUIDANCE') {
        if (expected.guidanceKnown) return null;
        expected.guidanceKnown = true; budget.actions--; budget.cash -= PURE_WHITE_ANGEL_PRICES.guidance;
      } else if (c.type === 'PREPARE_TASK') {
        if (expected.preparations.some(p => p.taskId === c.taskId)) return null;
        expected.preparations.push({ taskId: c.taskId, completedWeek: e.week }); budget.actions--;
      } else if (c.type === 'PREPARE_PROMOTION') {
        if (expected.resupply.recovery || expected.preparations.length !== 3 || !expected.bottles.some(b => b.status === 'PLAYER') ||
          budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 || e.week < e.actor.lightSeekerPromotionWeek + PURE_WHITE_ANGEL_MIN_LIGHT_SEEKER_WEEKS) return null;
        expected.preparedWeek = e.week; budget.actions--; budget.cash -= PURE_WHITE_ANGEL_PRICES.preparation;
      } else if (c.type === 'LEAVE_PREPARATION') {
        if (expected.preparedWeek === null) return null; expected.preparedWeek = null;
      } else if (c.type === 'REQUEST_SUPPLY') {
        // A pending archived commission may be superseded by the explicit paid investigation.
        if (!exhaustedSupply(expected) || expected.resupply.requestedWeek !== null || expected.bottles.some(b => b.recovery) || expected.acquisitionJournal.some(j => recoveryCommand(j.command))) return null;
        budget.actions--; budget.cash -= PURE_WHITE_ANGEL_PRICES.resupply; expected.resupply.requestedWeek = e.week;
      } else if (c.type === 'RECEIVE_SUPPLY') return null; // A fourth independent original is a conservation conflict.
      else if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
        const source = recoverySource(expected, c.bottleId), pending = expected.resupply.recovery;
        if (!originalSupplyFailed(expected) || !source) return null;
        budget.actions--;
        if (c.type === 'REQUEST_RECOVERY_V1') {
          if (pending) return null; budget.cash -= PURE_WHITE_ANGEL_PRICES.recovery; expected.resupply.requestedWeek = e.week;
          expected.resupply.recovery = { version: 1, sourceBottleId: c.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: e.week, sourceReceiptRevision: source.receipt.revision, siteId: PURE_WHITE_ANGEL_RECOVERY_SITE_ID, custodian: 'LS2-MARA' as const };
        } else {
          if (!pending || pending.sourceBottleId !== c.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || e.week <= pending.requestedWeek || pending.requestedWeek !== expected.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== PURE_WHITE_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'LS2-MARA') return null;
          const recovery = { ...pending, recoveredWeek: e.week }, id = `pure-white-angel-potion-${expected.bottles.length + 1}`;
          expected.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, e.week), e.week), recovery });
          expected.resupply.deliveries++; expected.resupply.requestedWeek = null; delete expected.resupply.recovery;
        }
      } else {
        if (!('bottleId' in c)) return null;
        const bottle = expected.bottles.find(b => b.id === c.bottleId); if (!bottle) return null;
        if (c.type === 'POTION_WORK') {
          if (bottle.status !== 'SUPPLIER' || bottle.labourSteps >= PURE_WHITE_ANGEL_LABOUR_STEPS) return null;
          bottle.labourSteps++; budget.actions--;
        } else if (c.type === 'BUY_POTION') {
          if (bottle.status !== 'SUPPLIER') return null;
          budget.cash -= potionPrice(bottle); bottle.status = 'PLAYER'; bottle.acquiredWeek = e.week;
        } else if (c.type === 'CONSUME') {
          if (bottle.status !== 'PLAYER' || expected.preparedWeek !== e.week || !e.check || (!failed(e.check.tier) && !success(e.check.tier)) ||
            !integer(e.randomBefore) || e.randomAfter !== e.randomBefore + 1 || budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100) return null;
          if (!same(e.check, resolveNormalCheck({ ability: 'will', baseAbility: budget.coreStats.will, difficulty: 30, modifiers: [], roll: e.check.roll }))) return null;
          bottle.status = 'CONSUMED'; bottle.outcome = e.check.tier; bottle.consumedWeek = e.week; bottle.preparationWeek = e.week; expected.preparedWeek = null;
          if (success(e.check.tier)) {
            expected.promotionWeek = e.week; expected.lightSeekerActingAtPromotion = budget.acting; budget.sequence = 1; budget.acting = 0;
            budget.mind = Math.max(1, budget.mind - (e.check.tier === 'GREAT_SUCCESS' ? 8 : 15));
            if (!budget.completedSources.includes('sun-s1')) budget.completedSources.push('sun-s1');
            for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) budget.mastery[id] = 0;
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
    const characteristics: PureWhiteAngelOriginalCharacteristics['characteristics'] = [];
    for (const id of PURE_WHITE_ANGEL_BOTTLE_IDS) {
      const attempts = expected.bottles.filter(b => originalBottleId(expected, b) === id), latest = attempts.at(-1);
      if (!latest || attempts[0]!.id !== id) return null;
      characteristics.push({ characteristicId: characteristicId(id), originalBottleId: id, latestBottleId: latest.id,
        holder: latest.status === 'CONSUMED' ? success(latest.outcome) ? 'EMBODIED' : 'FAILED_REMNANT' : latest.status,
        consumptionHistory: expected.acquisitionJournal.filter(e => { const c = e.command; return c.type === 'CONSUME' && attempts.some(b => b.id === c.bottleId); }).map(e => ({ bottleId: (e.command as Extract<PureWhiteAngelAcquisitionCommand, { type: 'CONSUME' }>).bottleId, revision: e.revision, week: e.week, outcome: e.check!.tier })) });
    }
    const embodied = characteristics.filter(c => c.holder === 'EMBODIED');
    if (embodied.length > 1 || (expected.promotionWeek !== null) !== (embodied.length === 1)) return null;
    return { characteristics, embodiedOriginalBottleId: embodied[0]?.originalBottleId ?? null, embodiedBottleId: embodied[0]?.latestBottleId ?? null };
  } catch { return null; }
}

/** Read-only conservation view. Full acquisition validation owns the original
 * source, identity and RNG before the same snapshot custody replay is used. */
export function resolvePureWhiteAngelOriginals(s: SliceState): PureWhiteAngelOriginalCharacteristics | null {
  return validatePureWhiteAngelSource(s) && validatePureWhiteAngelAcquisitionJournal(s) ? resolvePureWhiteAngelOriginalsSnapshot(s.pureWhiteAngel) : null;
}

export function applyPureWhiteAngelCommand(s: SliceState, command: PureWhiteAngelCommand, ctx: SeerContext): void {
  if (!validatePureWhiteAngelCommand(command)) throw new Error('纯白天使命令无效。');
  if (validatePureWhiteAngelAcquisitionCommand(command)) return applyPureWhiteAngelAcquisition(s, command, ctx);
  if (validatePureWhiteAngelActivityCommand(command)) return applyPureWhiteAngelLifeCommand(s, command, ctx);
  if (validatePureWhiteAngelEncounterCommand(command)) return applyPureWhiteAngelEncounterCommand(s, command, ctx);
  throw new Error('未知纯白天使命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function pureWhiteAngelAcquisitionActions(s: SliceState): PureWhiteAngelAction[] {
  if (!knownChannel(s) || isPureWhiteAngel(s)) return [];
  const state = s.pureWhiteAngel, actions: PureWhiteAngelAction[] = [];
  const add = (id: string, label: string, cost: string, command: PureWhiteAngelAcquisitionCommand) => {
    const reason = pureWhiteAngelAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-pure-white-angel-guidance', '听取纯白天使成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of PURE_WHITE_ANGEL_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`pure-white-angel-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-pure-white-angel-promotion', '实际检查本次服药场地', '1行动 · 150便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-pure-white-angel-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.recovery) add('recover-pure-white-angel-characteristic', `回原采光廊入口封存${state.resupply.recovery.characteristicId}`, `1行动 · 最早第${state.resupply.recovery.requestedWeek + 1}周 · 新药另付`, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: state.resupply.recovery.sourceBottleId });
    else if (originalSupplyFailed(state)) for (const bottle of state.bottles) if (recoverySource(state, bottle.id)) add(`request-recovery-${bottle.id}`, `调查${bottle.id}的同一份原特性`, '1行动 · 120便士 · 隔周原处回收 · 旧费用不退', { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < PURE_WHITE_ANGEL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${bottle.recovery ? `核验同一原特性本次第${bottle.labourSteps + 1}项新药调配` : PURE_WHITE_ANGEL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${bottle.recovery ? 810 : 5500}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶${bottle.recovery ? '同一原特性重配' : '纯白天使'}魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶纯白天使魔药`, `0行动 · 逐光者消化${s.progression.acting}/100 · ${lightSeekerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredPureWhiteAngelAction(s: SliceState, actions: PureWhiteAngelAction[]): PureWhiteAngelAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectPureWhiteAngelLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectPureWhiteAngel(s: SliceState): PureWhiteAngelProjection {
  const state = s.pureWhiteAngel, available = knownChannel(s), promoted = isPureWhiteAngel(s);
  const actions = available ? [...pureWhiteAngelAcquisitionActions(s), ...pureWhiteAngelLifeActions(s), ...pureWhiteAngelEncounterActions(s)] : [];
  const preferred = preferredPureWhiteAngelAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '纯白天使·太阳序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${PURE_WHITE_ANGEL_FORMULA_STATUS}${PURE_WHITE_ANGEL_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。初始原瓶每瓶6600便士或本瓶五工后1100；只调查三份原特性的最新真实失败载体，120便士、1行动，隔一真实周在原采光廊入口另1行动核验封存。新普通药液与调配服务900便士或五项新劳动后90便士，当周准备仍150便士、1行动。旧独立额外原瓶记录只读，来源总量未解决时不能进入太阳材料流程。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成逐光者的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · ${b.recovery ? '同一原特性重配' : '纯白天使成品魔药'}`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为逐光者' : '排异，仍为逐光者'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? PURE_WHITE_ANGEL_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...PURE_WHITE_ANGEL_INHERITED_ABILITIES, ...PURE_WHITE_ANGEL_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `逐光者消化${state.lightSeekerActingAtPromotion}/100留存；纯白天使扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `逐光者需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${lightSeekerWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成逐光者的实际经历。',
    pollution: s.seer.pollution, risk: available ? PURE_WHITE_ANGEL_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: state.acquisitionJournal[0]?.before.gender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '同一六米采光廊、原遮板、油灯、遮罩、屏板与字牌保留当前状态。玛拉和芦影仍是同一位原参与者，旧许可不代替本次回答；原精力与损耗不会恢复。' : '',
    inheritedHistory: available ? [
      `逐光者在第${s.lightSeeker.promotionWeek}周实际晋升；${promoted ? `原消化${state.lightSeekerActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。最初歌颂者晋升仍为第${s.progression.promotionWeek}周。`,
      '前八阶20项技巧保持原值，未掌握的项目仍从零起步；成功晋升只新增两项零掌握。',
      `原油灯剩${s.lightSeeker.life.site.lamp.oil}份油；遮板耐久${s.lightSeeker.life.site.shutter.durability}，原屏板耐久${s.lightSeeker.life.site.screen.durability}；玛拉精力${s.lightSeeker.life.site.operatorEnergy}，芦影精力${s.lightSeeker.life.site.spiritEnergy}。`,
      '过去原人物的死亡、伤势、投降和离场都保留。欧文的实际结果不重开；新接触需要独立的成年参与者与当前许可。',
    ] : [],
    life: projectPureWhiteAngelLife(s), encounter: projectPureWhiteAngelEncounter(s), insideCase: hasPureWhiteAngelLock(s),
    environment: available ? '同一原采光廊长六米，须亲自往返，重新取得玛拉和伊文的当次许可，并尊重芦影的当前选择。成年人实际避开作用线后才可施术；遮挡或撤回会取消旧窗口，仍可普通停止、打开原遮板、收回同一样本与护片，再沿开放路线离开。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validatePureWhiteAngelJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.pureWhiteAngel.acquisitionJournal;
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
    type SharedBudget = Pick<PureWhiteAngelAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.pureWhiteAngel.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.pureWhiteAngel.encounter, preparation = encounter.preparation;
    const reflection = s.pureWhiteAngel.life.journal.find(event => event.command.type === 'REFLECT');
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


/** Freeze all eight predecessor roots. Only audited original-site movement,
 * operator effort and clock changes may differ from the genuine source. */
export function validatePureWhiteAngelSource(s: SliceState): boolean {
  try {
    const state = s.pureWhiteAngel, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, PURE_WHITE_ANGEL_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !validateLightSeekerSiteState(scene.originals) || scene.originals.playerLocation !== 'ENTRY' || scene.originals.light.mode !== 'OFF' ||
      !same(scene.originals, pureWhiteAngelOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const historical = pureWhiteAngelInheritedView(s);
    if (![validateBardState, validateLightprayerState, validateSunpriestState, validateNotaryState, validatePriestOfLightState,
      validateUnshadowedState, validateJusticeMentorState, validateLightSeekerState].every(validate => validate(historical))) return false;
    const current = pureWhiteAngelSourceHistory(s);
    current.lightSeeker.life.site = structuredClone(scene.originals);
    if (!same(current, history)) return false;
    const expectedOriginals = isPureWhiteAngel(s) ? pureWhiteAngelExpectedOriginals(s) : scene.originals;
    if (!expectedOriginals || !same(expectedOriginals, pureWhiteAngelOriginals(s))) return false;
    // The independent forecourt encounter cannot spend or repair the old gallery's originals.
    return pureWhiteAngelEncounterOriginalEvents(s).length === 0;
  } catch { return false; }
}

export const validatePureWhiteAngelInheritedState = validatePureWhiteAngelSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function pureWhiteAngelInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.pureWhiteAngel;
  if ((!isPureWhiteAngel(s) && !isPureWhiteAngelAcquisitionStage(s)) || !s.pureWhiteAngel.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'sun', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), pureWhiteAngel: createPureWhiteAngelState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validatePureWhiteAngelState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.pureWhiteAngel;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'lightSeekerActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries', ...(Object.hasOwn(raw.resupply, 'recovery') ? ['recovery'] : [])]) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as PureWhiteAngelState, promoted = isPureWhiteAngel(s), acquisitionStage = isPureWhiteAngelAcquisitionStage(s);
  const recoveryDeliveries = state.bottles.filter(b => record(b) && Object.hasOwn(b, 'recovery')).length;
  const legacyDeliveries = state.resupply.deliveries - recoveryDeliveries;
  if (!integer(legacyDeliveries) || state.bottles.length !== 3 + legacyDeliveries * 3 + recoveryDeliveries) return false;
  const validRecovery = (r: unknown, recovered: boolean): r is PureWhiteAngelRecoveryRequest => record(r) &&
    shape(r, ['version', 'sourceBottleId', 'originalBottleId', 'characteristicId', 'requestedWeek', 'sourceReceiptRevision', 'siteId', 'custodian', ...(recovered ? ['recoveredWeek'] : [])]) &&
    r.version === 1 && integer(r.sourceReceiptRevision) && r.siteId === PURE_WHITE_ANGEL_RECOVERY_SITE_ID && r.custodian === 'LS2-MARA' && typeof r.sourceBottleId === 'string' && /^pure-white-angel-potion-[1-9]\d{0,14}$/.test(r.sourceBottleId) &&
    PURE_WHITE_ANGEL_BOTTLE_IDS.includes(r.originalBottleId as typeof PURE_WHITE_ANGEL_BOTTLE_IDS[number]) && r.characteristicId === characteristicId(String(r.originalBottleId)) &&
    integer(r.requestedWeek, s.lightSeeker.promotionWeek ?? s.week, s.week) && (!recovered || integer(r.recoveredWeek, r.requestedWeek + 1, s.week));
  if (Object.hasOwn(state.resupply, 'recovery') && !validRecovery(state.resupply.recovery, false)) return false;
  const firstWeek = s.lightSeeker.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + PURE_WHITE_ANGEL_MIN_LIGHT_SEEKER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validatePureWhiteAngelSource(s))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > PURE_WHITE_ANGEL_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !PURE_WHITE_ANGEL_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasPureWhiteAngelOldPractice(s) || hasPureWhiteAngelLifeLock(s) || hasPureWhiteAngelEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.lightSeeker.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.lightSeekerActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !lightSeekerReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...PURE_WHITE_ANGEL_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.lightSeekerActingAtPromotion !== null || PURE_WHITE_ANGEL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome', ...(Object.hasOwn(b, 'recovery') ? ['recovery'] : [])]) || b.id !== `pure-white-angel-potion-${index + 1}` || !integer(b.labourSteps, 0, PURE_WHITE_ANGEL_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < PURE_WHITE_ANGEL_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== PURE_WHITE_ANGEL_POTION_SOURCES[index]!.source || Object.hasOwn(b, 'recovery')) return false;
    } else if (b.recovery) {
      if (!validRecovery(b.recovery, true) || !state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.recovery.recoveredWeek !== b.stockedWeek || b.source !== recoverySourceText(b.id, b.recovery, b.stockedWeek) || !originalBottleId(state, b)) return false;
      const prefix = { ...state, bottles: state.bottles.slice(0, index) };
      const source = recoverySource(prefix, b.recovery.sourceBottleId);
      if (!originalSupplyFailed(prefix) || !source || source.originalBottleId !== b.recovery.originalBottleId || source.characteristicId !== b.recovery.characteristicId || source.receipt.revision !== b.recovery.sourceReceiptRevision || source.bottle.consumedWeek! > b.recovery.requestedWeek) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % PURE_WHITE_ANGEL_BOTTLE_IDS.length;
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
        if (!integer(s.lightSeeker.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !(state.resupply.recovery ? originalSupplyFailed(state) : exhaustedSupply(state)))) return false;
  if (state.resupply.recovery) {
    const pending = state.resupply.recovery, source = recoverySource(state, pending.sourceBottleId);
    if (!source || pending.requestedWeek !== state.resupply.requestedWeek || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== PURE_WHITE_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'LS2-MARA' || source.bottle.consumedWeek! > pending.requestedWeek) return false;
  } else if (state.resupply.requestedWeek !== null && state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!)) return false;
  if (successes !== (promoted ? 1 : 0) || !validatePureWhiteAngelAcquisitionJournal(s) || !validatePureWhiteAngelJournalContinuity(s) || !validatePureWhiteAngelLifeState(s) || !validatePureWhiteAngelEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('sun-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(pureWhiteAngelLifeMasteryGains(s))) {
      if (!PURE_WHITE_ANGEL_ABILITY_IDS.includes(id as typeof PURE_WHITE_ANGEL_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.pureWhiteAngelOutcome) {
      for (const action of [...round.pureWhiteAngelOutcome.playerActions, ...round.pureWhiteAngelOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('sun-s1')) return false;
  return true;
}
export { PURE_WHITE_ANGEL_ABILITIES } from './content.js';
export { PURE_WHITE_ANGEL_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handlePureWhiteAngel = applyPureWhiteAngelCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validatePureWhiteAngelHistory = validatePureWhiteAngelState;
