import { ELDER_INHERITED_ABILITY_IDS, hasElderOldPractice, hasElderLock, validateElderState } from '../elder/index.js';
import { ELDER_ABILITY_IDS } from '../elder/types.js';
import { validateSecretSupplicantState } from '../secret-supplicant/index.js';
import { validateListenerState } from '../listener/index.js';
import { validateShadowAsceticState } from '../shadow-ascetic/index.js';
import { validateRoseBishopState } from '../rose-bishop/index.js';
import { validateShepherdState } from '../shepherd/index.js';
import { validateBlackKnightState } from '../black-knight/index.js';
import { validateThreeHeadedTemplarState } from '../three-headed-templar/index.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { darkAngelFinanceSnapshot, darkAngelCompletedBudgetMatches, initializeDarkAngelEncounterState } from './encounter.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createDarkAngelLifeState, initializeDarkAngelLifeState, applyDarkAngelLifeCommand, projectDarkAngelLife, darkAngelLifeActions, validateDarkAngelLifeState, validateDarkAngelActivityCommand, hasDarkAngelLifeLock, darkAngelLifeMasteryGains } from './life.js';
import { createDarkAngelEncounterState, applyDarkAngelEncounterCommand, projectDarkAngelEncounter, darkAngelEncounterActions, validateDarkAngelEncounterState, validateDarkAngelEncounterCommand, hasDarkAngelEncounterLock } from './encounter.js';
import { DARK_ANGEL_PROMOTION_SUPPORT, DARK_ANGEL_CURRENT_CONSUMPTION_RISK, DARK_ANGEL_RECOVERY_PRICES, DARK_ANGEL_RECOVERY_SCHEMA_VERSION, DARK_ANGEL_RECOVERY_SITE_ID, DARK_ANGEL_ABILITIES, DARK_ANGEL_INHERITED_ABILITIES, DARK_ANGEL_BOTTLE_IDS, DARK_ANGEL_FORMULA_STATUS, DARK_ANGEL_LABOUR_STEPS, DARK_ANGEL_LABOUR_TASKS, DARK_ANGEL_MIN_ELDER_WEEKS, DARK_ANGEL_POTION_SOURCES, DARK_ANGEL_PREPARATIONS, darkAngelPrices, darkAngelSourceLabel, darkAngelPotionSource, darkAngelConsumptionRisk, DARK_ANGEL_SOURCE_STATUS } from './content.js';
import { DARK_ANGEL_ABILITY_IDS, DARK_ANGEL_PREPARATION_IDS, DARK_ANGEL_SOURCE_KEYS, type DarkAngelRecoveryRequest, type DarkAngelRecoverySite, type DarkAngelOriginalCharacteristics, type DarkAngelFinance, type DarkAngelOriginals, type DarkAngelSourceHistory, type DarkAngelAcquisitionBudget, type DarkAngelAcquisitionEvent, type DarkAngelAcquisitionCommand, type DarkAngelAction, type DarkAngelBottle, type DarkAngelCommand, type DarkAngelProjection, type DarkAngelState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const DARK_ANGEL_INHERITED_ABILITY_IDS = [...ELDER_INHERITED_ABILITY_IDS, ...ELDER_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = DARK_ANGEL_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): DarkAngelBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createDarkAngelState(): DarkAngelState {
  return { guidanceKnown: false, sourceWeek: null, bottles: DARK_ANGEL_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, elderActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createDarkAngelLifeState(), encounter: createDarkAngelEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isDarkAngel = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 1;
export const isDarkAngelAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 2;
export const hasDarkAngelHistory = (s: SliceState) => isDarkAngel(s) && s.darkAngel.promotionWeek !== null;
/** Source stages retain their real purchase, brewing and ritual shapes. Detailed
 * predecessor validators run on the frozen S2 source, never an invented history. */
function sourceHistory(s: SliceState): boolean {
  if (!s.secretSupplicant.discovered || !s.secretSupplicant.guidanceKnown) return false;
  const first = s.secretSupplicant.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.listener, s.shadowAscetic, s.roseBishop, s.shepherd, s.blackKnight, s.threeHeadedTemplar, s.elder]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.listener.secretSupplicantActingAtPromotion === 100 && s.shadowAscetic.listenerActingAtPromotion === 100 &&
    s.roseBishop.shadowAsceticActingAtPromotion === 100 && s.shepherd.roseBishopActingAtPromotion === 100 &&
    s.blackKnight.shepherdActingAtPromotion === 100 && s.threeHeadedTemplar.blackKnightActingAtPromotion === 100 && s.elder.threeHeadedTemplarActingAtPromotion === 100;
}
export function darkAngelSourceHistory(s: SliceState): DarkAngelSourceHistory {
  return Object.fromEntries(DARK_ANGEL_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as DarkAngelSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.darkAngel.sourceHistory ?? darkAngelSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isDarkAngelAcquisitionStage(s) || isDarkAngel(s)) && sourceHistory(s);
/** Once guidance freezes the source, old commands close and completed records stay exact. */
export function hasDarkAngelOldPractice(s: SliceState): boolean {
  return hasElderOldPractice(s) || hasElderLock(s);
}
const elderReportsComplete = (s: SliceState) => s.elder.life.reflected &&
  Object.keys(s.elder.life.cases).length === 3 && Object.values(s.elder.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 && c.attempts.length > 0 &&
    c.attempts.every(a => a.week <= s.week) && c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected);
export const darkAngelOriginals = (s: SliceState): DarkAngelOriginals => ({
  site: structuredClone(s.threeHeadedTemplar.life), operation: structuredClone(s.elder.life.operation),
  grazing: structuredClone(s.shepherd.grazing), reserve: structuredClone(s.roseBishop.reserve), shepherdPromotionWeek: s.shepherd.promotionWeek,
});
/** The actual old body is at START after the old retreat. It is never reset to
 * an encounter's earlier startRoot or teleported to an invented outside site. */
function sourceClosed(originals: DarkAngelOriginals): boolean {
  const { site, operation } = originals;
  return site.playerLocation === 'START' && site.owner.location === 'OUTSIDE' && site.activeCase === null &&
    site.card.location === 'TABLE' && !site.lamp.on && site.shutter.state === 'CLOSED' &&
    Object.values(site.spirits).every(spirit => spirit.status !== 'GRAZED' || spirit.location === 'INTERNAL') &&
    operation.contained && operation.residualPressure === 3 && operation.focus === null && operation.suppressedUntil === null &&
    operation.materials.every(material => material.status === 'RETURNED' && material.location === 'OWNER');
}
export const hasDarkAngelOldSceneLock = hasDarkAngelOldPractice;
export const hasDarkAngelRitualLock = (s: SliceState): boolean => s.darkAngel.preparedWeek !== null;
export const hasDarkAngelLock = (s: SliceState): boolean => hasDarkAngelRitualLock(s) || hasDarkAngelLifeLock(s) || hasDarkAngelEncounterLock(s);
/** The paid support is a receipt, not a reusable root flag. Closing or consuming
 * the preparation makes it unavailable; a new preparation needs a fresh payment. */
function preparedSupport(state: DarkAngelState, week: number): DarkAngelAcquisitionEvent | null {
  const event = state.acquisitionJournal.at(-1);
  return state.preparedWeek === week && event?.command.type === 'STABILIZE_PROMOTION' && event.week === week ? event : null;
}
function supportModifiers(state: DarkAngelState, bottleId: string, week: number, actorDigest: string, sourceDigest: string) {
  const event = preparedSupport(state, week);
  return event?.command.type === 'STABILIZE_PROMOTION' && event.command.bottleId === bottleId &&
    event.actor.sourceIdentityDigest === actorDigest && event.actor.sourceHistoryDigest === sourceDigest
    ? [{ source: '同瓶同场当周有价支持', value: DARK_ANGEL_PROMOTION_SUPPORT.bonus }] : [];
}
export function darkAngelPromotionModifiers(s: SliceState, bottleId: string) {
  return s.schemaVersion >= DARK_ANGEL_RECOVERY_SCHEMA_VERSION && s.world.city === 'BACKLUND' &&
    sourceClosed(darkAngelOriginals(s)) && s.darkAngel.sourceScene && same(darkAngelOriginals(s), s.darkAngel.sourceScene.originals)
    ? supportModifiers(s.darkAngel, bottleId, s.week, sourceIdentityDigest(s), sourceHistoryDigest(s)) : [];
}
const bottleNumber = (b: Pick<DarkAngelBottle, 'id'>) => Number(b.id.split('-').at(-1));
export const darkAngelOriginalBottlePrice = (b: DarkAngelBottle) => b.recovery
  ? b.labourSteps === DARK_ANGEL_LABOUR_STEPS ? DARK_ANGEL_RECOVERY_PRICES.recoveryLabourBalance : DARK_ANGEL_RECOVERY_PRICES.recoveryDrug
  : darkAngelPrices().potion - (b.labourSteps === DARK_ANGEL_LABOUR_STEPS ? darkAngelPrices().labourCredit : 0);
const potionPrice = darkAngelOriginalBottlePrice;
const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
export const darkAngelCharacteristicId = (bottleId: string): string => {
  const index = DARK_ANGEL_BOTTLE_IDS.findIndex(id => id === bottleId);
  if (index < 0) throw Error('未知原特性身份。');
  return `DA223-CHAR-${index + 1}`;
};
const characteristicId = darkAngelCharacteristicId;
const recoveryBottleId = (state: DarkAngelState) => `dark-angel-recovery-${state.bottles.filter(b => b.recovery).length + 1}`;
const recoverySourceText = (id: string, recovery: DarkAngelRecoveryRequest, week: number) => `交接处保管方在原服药准备与支持交接处核验${recovery.sourceBottleId}排异后遗留的同一份暗天使特性${recovery.characteristicId}，核对同次原失败回执及原交接处保管方取得本次许可后当面交接，第${week}周回收封存到重配瓶${id}。原特性来自${recovery.originalBottleId}；新普通药物与调配服务另付，旧原瓶及其实际结果不改写。`;
/** Follow actual vessel ancestry without treating an attempt number as a fourth original. */
function originalBottleId(state: DarkAngelState, bottle: DarkAngelBottle): string | null {
  const seen = new Set<string>(); let current = bottle;
  while (current.recovery) {
    if (seen.has(current.id)) return null; seen.add(current.id);
    const r = current.recovery, previous = state.bottles.find(b => b.id === r.sourceBottleId);
    if (!previous || r.siteId !== DARK_ANGEL_RECOVERY_SITE_ID || r.custodian !== 'TG223-DARK-ANGEL-SUPPLIER' || !integer(r.sourceReceiptRevision) || state.bottles.indexOf(previous) >= state.bottles.indexOf(current) || r.version !== 1 ||
      !DARK_ANGEL_BOTTLE_IDS.includes(r.originalBottleId as typeof DARK_ANGEL_BOTTLE_IDS[number]) || r.characteristicId !== characteristicId(r.originalBottleId) ||
      previous.status !== 'CONSUMED' || !failed(previous.outcome) || previous.consumedWeek === null || previous.consumedWeek > r.requestedWeek ||
      r.recoveredWeek <= r.requestedWeek || current.stockedWeek !== r.recoveredWeek) return null;
    if (previous.recovery && (previous.recovery.originalBottleId !== r.originalBottleId || previous.recovery.characteristicId !== r.characteristicId)) return null;
    if (!previous.recovery && previous.id !== r.originalBottleId) return null;
    current = previous;
  }
  return DARK_ANGEL_BOTTLE_IDS.includes(current.id as typeof DARK_ANGEL_BOTTLE_IDS[number]) ? current.id : null;
}
function recoverySource(state: DarkAngelState, bottleId: string) {
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
/** The original ordinary handover route remains authoritative during S2 acquisition.
 * No closed registry practice is reopened and no original object is moved or restored. */
function recoveryPlaceAvailable(o: DarkAngelOriginals): boolean {
  return record(o) && shape(o, ['site', 'operation', 'grazing', 'reserve', 'shepherdPromotionWeek']) && sourceClosed(o);
}
function recoverySiteReceipt(s: SliceState, command: DarkAngelAcquisitionCommand): DarkAngelRecoverySite | undefined {
  if (!recoveryCommand(command) || !('bottleId' in command)) return undefined;
  const source = recoverySource(s.darkAngel, command.bottleId);
  if (!source || !recoveryPlaceAvailable(darkAngelOriginals(s))) throw new Error('原服药准备与支持交接处与同一份失败特性尚未核实。');
  return { siteId: DARK_ANGEL_RECOVERY_SITE_ID, originals: darkAngelOriginals(s),
    permission: { personId: 'TG223-DARK-ANGEL-SUPPLIER', week: s.week, revision: s.revision, purpose: command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER' },
    originalBottleId: source.originalBottleId, sourceBottleId: source.bottle.id, characteristicId: source.characteristicId, sourceReceiptRevision: source.receipt.revision,
    custodyBefore: command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SEALED_WITH_CUSTODIAN', custodyAfter: command.type === 'REQUEST_RECOVERY_V1' ? 'SEALED_WITH_CUSTODIAN' : 'SUPPLIER' };
}
function validRecoverySite(event: DarkAngelAcquisitionEvent, state: DarkAngelState): boolean {
  if (!recoveryCommand(event.command)) return !Object.hasOwn(event, 'recoverySite');
  const site = event.recoverySite, command = event.command;
  if (!('bottleId' in command) || !record(site) || !shape(site, ['siteId', 'originals', 'permission', 'originalBottleId', 'sourceBottleId', 'characteristicId', 'sourceReceiptRevision', 'custodyBefore', 'custodyAfter']) ||
    site.siteId !== DARK_ANGEL_RECOVERY_SITE_ID || !recoveryPlaceAvailable(site.originals) ||
    !record(site.permission) || !shape(site.permission, ['personId', 'week', 'revision', 'purpose']) || site.permission.personId !== 'TG223-DARK-ANGEL-SUPPLIER' ||
    site.permission.week !== event.week || site.permission.revision !== event.revision || site.permission.purpose !== (command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER') ||
    site.custodyBefore !== (command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SEALED_WITH_CUSTODIAN') || site.custodyAfter !== (command.type === 'REQUEST_RECOVERY_V1' ? 'SEALED_WITH_CUSTODIAN' : 'SUPPLIER')) return false;
  const source = recoverySource(state, command.bottleId), previous = state.acquisitionJournal.find(e => e.recoverySite)?.recoverySite;
  return !!source && site.originalBottleId === source.originalBottleId && site.sourceBottleId === command.bottleId && site.characteristicId === source.characteristicId && site.sourceReceiptRevision === source.receipt.revision &&
    (!previous || same(previous.originals, site.originals));
}
const elderWeeks = (s: SliceState) => Math.max(0, (s.darkAngel.promotionWeek ?? s.week) - (s.elder.promotionWeek ?? s.week));
const exhaustedSupply = (state: DarkAngelState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const originalSupplyFailed = (state: DarkAngelState) => state.bottles.length >= 3 && state.bottles.slice(0, 3).every((b, index) => b.id === DARK_ANGEL_BOTTLE_IDS[index] && !b.recovery && b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (s: SliceState, number: number, week: number) => darkAngelPotionSource(number, week);
const hasPreparations = (s: SliceState) => DARK_ANGEL_PREPARATION_IDS.every(id => s.darkAngel.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `秽语长老魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.elder.promotionWeek === null || elderWeeks(s) < DARK_ANGEL_MIN_ELDER_WEEKS) return `成为秽语长老后已过${elderWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!elderReportsComplete(s)) return '先完成秽语长老的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与同一原物、现存原灵与已选方法和普通返回路线；领取药瓶不能代做专业准备。';
}
function validateAcquisitionCommand(v: unknown, historicalReplay = false): v is DarkAngelAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (legacySupply(v as { type: string })) return historicalReplay && shape(v, ['type']);
  if (['LEARN_GUIDANCE', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && DARK_ANGEL_PREPARATION_IDS.includes(v.taskId as typeof DARK_ANGEL_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^dark-angel-(?:potion|recovery)-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'STABILIZE_PROMOTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export function validateDarkAngelAcquisitionCommand(v: unknown): v is DarkAngelAcquisitionCommand { return validateAcquisitionCommand(v); }
export const isDarkAngelAcquisitionCommand = validateDarkAngelAcquisitionCommand;
export function validateDarkAngelCommand(v: unknown): v is DarkAngelCommand {
  return validateDarkAngelAcquisitionCommand(v) || validateDarkAngelActivityCommand(v) || validateDarkAngelEncounterCommand(v);
}
export function darkAngelAcquisitionBlock(s: SliceState, command: DarkAngelAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: DarkAngelAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAcquisitionCommand(command, historicalReplay)) return '暗天使准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasDarkAngelOldPractice(s)) || hasDarkAngelLifeLock(s) || hasDarkAngelEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德当前时代的独立交接处。';
  if (!sourceClosed(darkAngelOriginals(s))) return '先实际收束封存院，归还同一原卡和旧耗材、关闭原灯遮板，让本人在入口、玛拉在院外，再进行服药交接。';
  if (!knownChannel(s)) return '实际成为秽语长老并保留当前时代真实指导渠道后，才能了解暗天使之路。';
  if (!isDarkAngelAcquisitionStage(s)) return '已经晋升暗天使1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '秘祈人至秽语长老的15项掌握记录不完整，暂不能继续晋升。';
  const state = s.darkAngel, prices = darkAngelPrices();
  if (!historicalReplay && state.bottles.slice(3).some(b => !b.recovery)) return '历史独立第4份及以后原特性存在守恒冲突；旧记录只读，不能改标为回收件或继续本入口。';
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && !['CONSUME', 'STABILIZE_PROMOTION'].includes(command.type)) return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !elderReportsComplete(s)) return '先完成秽语长老三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < prices.guidance ? `本次专业指导需要${prices.guidance}便士。` : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    if (state.resupply.recovery) return '先完成已付费的同一原特性调查交接，再准备本次服药。';
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的暗天使原瓶。';
    return s.cash < prices.preparation ? `当次场地检查需要${prices.preparation}便士。` : null;
  }
  if (command.type === 'STABILIZE_PROMOTION') {
    if (s.schemaVersion < DARK_ANGEL_RECOVERY_SCHEMA_VERSION) return '本次有价支持须使用对应新版本，旧服药履历不补写。';
    if (state.preparedWeek !== s.week || !state.sourceScene || !same(darkAngelOriginals(s), state.sourceScene.originals)) return '先实际检查本周服药场地，并仍在同一原交接处。';
    if (state.bottles.find(b => b.id === command.bottleId)?.status !== 'PLAYER') return '须指定本人当前持有且尚未服用的同一药瓶。';
    if (preparedSupport(state, s.week)) return '本次场地检查已有指定药瓶支持，不能换瓶、叠加或重复收费。';
    const p = DARK_ANGEL_PROMOTION_SUPPORT;
    return s.cash < p.cash || s.spirituality < p.spirituality || s.mind <= p.mind + 40
      ? '同瓶支持另需60便士、8灵性、6精神，支付后仍须精神>40。' : null;
  }
  if (command.type === 'REQUEST_RECOVERY_V1' || command.type === 'RECOVER_CHARACTERISTIC_V1') {
    if (s.schemaVersion < DARK_ANGEL_RECOVERY_SCHEMA_VERSION) return '这一原特性回收协议须使用对应的新版本存档。';
    if (!recoveryPlaceAvailable(darkAngelOriginals(s)) || !state.sourceScene || !same(darkAngelOriginals(s), state.sourceScene.originals)) return '须本人在贝克兰德原服药准备与支持交接处，与原交接处保管方当面核验同一失败记录及原物；本次许可重新取得。玛拉、原卡、原箱、原封条、原灯、遮板与原灵保持原状态。';
    const source = recoverySource(state, command.bottleId), pending = state.resupply.recovery;
    if (!originalSupplyFailed(state)) return '最初三瓶须实际耗尽失败，才能调查并回收同一份原特性。';
    if (!source) return '须核验真实失败原瓶、同一原特性与实际服药记录；已回收或仍被持有的特性不能重复取得。';
    if (command.type === 'REQUEST_RECOVERY_V1') return pending ? '已有指定失败原瓶的调查委托，须先完成回收。' : s.cash < DARK_ANGEL_RECOVERY_PRICES.recovery ? '调查原特性需要1行动、120便士；旧费用不退。' : null;
    if (!pending || pending.version !== 1 || pending.sourceBottleId !== command.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.requestedWeek !== state.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== DARK_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'TG223-DARK-ANGEL-SUPPLIER') return '先支付对应失败原瓶的调查委托，不能更换原特性。';
    return s.week <= pending.requestedWeek ? '调查封存后须隔一真实周，再回原准备处核验并交接同一份原特性。' : s.cash < DARK_ANGEL_RECOVERY_PRICES.recoveryHandover ? '原物封存交接须实付30便士。' : null;
  }
  if (legacySupply(command) && (state.resupply.recovery || state.bottles.some(b => b.recovery) || state.acquisitionJournal.some(e => recoveryCommand(e.command)))) return '已经开始原特性回收，不能续接独立新原瓶的旧供货记录。';
  if (command.type === 'REQUEST_SUPPLY' && s.cash < prices.resupply) return `申请下一批需要${prices.resupply}便士实际费用。`;
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批暗天使原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的暗天使准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选暗天使独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : `须另付1行动与${prices.preparation}便士完成本周当次场地检查；旧准备不能使用。`;
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= DARK_ANGEL_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: DarkAngelAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.darkAngel, prices = darkAngelPrices();
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = darkAngelSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: darkAngelAcquisitionBudget(s), finance: darkAngelFinanceSnapshot(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: darkAngelOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= prices.guidance; state.guidanceKnown = true; state.sourceWeek = s.week;
      state.bottles.forEach((b, i) => { b.stockedWeek = s.week; b.source = darkAngelPotionSource(i + 1, s.week); });
      ctx.note('听取暗天使独立成品与专业准备指导', `花1行动、${prices.guidance}便士。${darkAngelSourceLabel()}说明当前渠道记录。${DARK_ANGEL_FORMULA_STATUS}${!historicalReplay && s.schemaVersion >= DARK_ANGEL_RECOVERY_SCHEMA_VERSION ? DARK_ANGEL_CURRENT_CONSUMPTION_RISK : darkAngelConsumptionRisk()}`); return;
    case 'PREPARE_TASK': {
      const task = DARK_ANGEL_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', `花1行动、${prices.preparation}便士，按三项真实专业准备检查本周场地。须另外确认饮用所选原瓶；退出不退款、不治疗。`); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', `0行动实际退出，未服原瓶保留，已用行动与${prices.preparation}便士不返。可以继续真实生活休养。`); return;
    case 'STABILIZE_PROMOTION': {
      const support = DARK_ANGEL_PROMOTION_SUPPORT;
      s.cash -= support.cash; s.spirituality -= support.spirituality; s.mind -= support.mind;
      ctx.note('为指定原瓶实际准备当周支持', `另付60便士、8灵性、6精神，0行动；仅${command.bottleId}本周在同一原交接处服用时意志临时+13。仍可能失败；换瓶、退出、跨周或服用后失效，已付成本不退。`); return;
    }
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      if (bottle.recovery) { ctx.note('同一原特性的新普通药物调配劳动', `本次重配载体${bottle.id}第${bottle.labourSteps}/5项劳动，花1行动；五项抵810便士，余款90便士。原特性不复制，旧成本不退。`); return; }
      ctx.note(DARK_ANGEL_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶${prices.labourCredit}便士，余款${prices.labourBalance}便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      if (bottle.recovery) { ctx.note('同一原特性重配交付', `实付${paid}便士取得${bottle.id}，其中仍是${bottle.recovery.characteristicId}；须另做当周准备。`); return; }
      ctx.note('暗天使独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? `本瓶五项劳务抵${prices.labourCredit}便士。` : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_RECOVERY_V1': {
      const source = recoverySource(state, command.bottleId)!;
      const supersededLegacyRequest = state.resupply.requestedWeek !== null && !state.resupply.recovery;
      s.actionsRemaining--; s.cash -= DARK_ANGEL_RECOVERY_PRICES.recovery; state.resupply.requestedWeek = s.week;
      state.resupply.recovery = { version: 1, sourceBottleId: command.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: s.week, sourceReceiptRevision: source.receipt.revision, siteId: DARK_ANGEL_RECOVERY_SITE_ID, custodian: 'TG223-DARK-ANGEL-SUPPLIER' as const };
      ctx.note('调查失败原瓶遗留的同一份特性', `1行动、120便士，本人在原服药准备与支持交接处重新向交接处保管方询问本次许可，获准后当面按第${source.receipt.week}周同次真实失败回执逐一核对，现在调查遗留原物的归属与位置，在原准备处实际找到并检查${source.characteristicId}，独立核验原封签，经本次许可才交由交接处保管方新封存，本次尚未交付。此项是现在发生的调查，不改写旧失败记载。隔一真实周再到同一原处当面复核、交接同一封存原件；原出口受阻或交接处保管方不在原处时不能回收。旧原瓶、失败、费用与伤势全部保留，不退款。${supersededLegacyRequest ? '本次同原特性调查明确接替先前尚未交付的旧供货申请，原100便士与申请回执保留，不再接收独立新特性。' : ''}`); return;
    }
    case 'RECOVER_CHARACTERISTIC_V1': {
      const recovery = { ...state.resupply.recovery!, recoveredWeek: s.week }, id = recoveryBottleId(state);
      s.actionsRemaining--; s.cash -= DARK_ANGEL_RECOVERY_PRICES.recoveryHandover;
      state.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, s.week), s.week), recovery });
      state.resupply.deliveries++; state.resupply.requestedWeek = null; delete state.resupply.recovery;
      ctx.note('原处回收封存同一份暗天使特性', `再次当面取得交接处保管方本次交接许可，以1行动和30便士将${recovery.characteristicId}封存到重配瓶${id}，没有新增原特性。新普通药物与调配服务须另付900便士，五项新劳务后90便士；之后仍须1行动、180便士检查本次场地。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= prices.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批暗天使成品', `原瓶全部失败耗尽，花1行动与${prices.resupply}便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < DARK_ANGEL_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`dark-angel-potion-${number}`, deliverySource(s, number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶暗天使原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶${prices.potion}便士或对应五项劳动后${prices.labourBalance}便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.elderActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('hanged-man-s1')) s.seer.completedSources.push('hanged-man-s1');
        initializeDarkAngelLifeState(s);
        initializeDarkAngelEncounterState(s);
        for (const id of DARK_ANGEL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为暗天使', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；秽语长老消化100与原15项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。姓名、性别、年龄、既有性格与旧伤不改写。同一封存院原人原物继续留存，旧原灵资源、血肉储备和已用耗材不补回，旧巴斯蒂安和布拉姆的撤退结果不变。本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '暗天使魔药严重排异' : '暗天使魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为秽语长老，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、${prices.preparation}便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function validFinance(v: unknown, week: number): v is DarkAngelFinance {
  return record(v) && shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) &&
    integer(v.weeklyBudget, 1, 100) && typeof v.lifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.lifeTier) &&
    typeof v.nextLifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) &&
    ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) && Array.isArray(v.debts) && v.debts.every(d =>
      record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 &&
      typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** Between adjacent public inputs the only unlocked automatic change is the
 * existing weekly bill/debt transition. No new economy or free recovery exists. */
function adjacentAcquisitionMatches(previous: DarkAngelAcquisitionEvent, event: DarkAngelAcquisitionEvent): boolean {
  if (event.cursorBefore !== previous.cursorAfter) return false;
  if (previous.after.actions > 0 || ['PREPARE_PROMOTION', 'STABILIZE_PROMOTION'].includes(previous.command.type)) return event.week === previous.week &&
    same(event.date, previous.date) && same(event.before, previous.after) && same(event.finance, previous.finance);
  const result = resolveSliceWeeklyFinance({ ...previous.finance, cash: previous.after.cash, week: previous.week,
    revision: previous.revision, pulse: 'BILL', billAmount: 0 });
  if (result.eventId !== null || result.state.pulse !== 'ADVANCE') return false;
  const finance = darkAngelFinanceSnapshot({ ...previous.finance, ...result.state,
    weeklyBudget: previous.finance.weeklyBudget, lifeTier: result.state.nextLifeTier });
  return event.week === previous.week + 1 && same(event.date, addGameWeeks(previous.date, 1)) && same(event.finance, finance) &&
    same(event.before, { ...previous.after, cash: result.state.cash, actions: previous.finance.weeklyBudget });
}
function acquisitionTitle(event: DarkAngelAcquisitionEvent, state: DarkAngelState): string {
  const command = event.command;
  if (command.type === 'PREPARE_TASK') return DARK_ANGEL_PREPARATIONS.find(p => p.id === command.taskId)!.title;
  if (command.type === 'STABILIZE_PROMOTION') return '为指定原瓶实际准备当周支持';
  if (command.type === 'REQUEST_RECOVERY_V1') return '调查失败原瓶遗留的同一份特性';
  if (command.type === 'RECOVER_CHARACTERISTIC_V1') return '原处回收封存同一份暗天使特性';
  if (command.type === 'BUY_POTION' && state.bottles.find(b => b.id === command.bottleId)?.recovery) return '同一原特性重配交付';
  if (command.type === 'POTION_WORK' && state.bottles.find(b => b.id === command.bottleId)?.recovery) return '同一原特性的新普通药物调配劳动';
  if (command.type === 'POTION_WORK') return DARK_ANGEL_LABOUR_TASKS[state.bottles.find(b => b.id === command.bottleId)!.labourSteps - 1]!;
  if (command.type === 'CONSUME') return event.check?.tier === 'GREAT_FAILURE' ? '暗天使魔药严重排异' : event.check?.tier === 'FAILURE' ? '暗天使魔药排异' : '实际成为暗天使';
  return ({ LEARN_GUIDANCE: '听取暗天使独立成品与专业准备指导', BUY_POTION: '暗天使独立原瓶实际交付',
    PREPARE_PROMOTION: '实际检查本周服药场地', LEAVE_PREPARATION: '沿原出口结束本次服药准备',
    REQUEST_SUPPLY: '实际申请下一批暗天使成品', RECEIVE_SUPPLY: '新的三瓶暗天使原瓶实际到货' } as const)[command.type];
}
export function darkAngelAcquisitionBudget(s: SliceState): DarkAngelAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: DarkAngelState) {
  return { guidanceKnown: state.guidanceKnown, sourceWeek: state.sourceWeek, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, elderActingAtPromotion: state.elderActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyDarkAngelAcquisition(s: SliceState, command: DarkAngelAcquisitionCommand, ctx: SeerContext): void {
  const reason = darkAngelAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = darkAngelAcquisitionBudget(s), actor: DarkAngelAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME', 'STABILIZE_PROMOTION'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'hanged-man',
    elderPromotionWeek: s.elder.promotionWeek!, secretSupplicantPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; const raw = ctx.check(ability, difficulty);
    result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats.will, difficulty, modifiers: darkAngelPromotionModifiers(s, command.bottleId), roll: raw.roll }); randomAfter = s.random.cursor;
    return result;
  } };
  const recoverySite = recoverySiteReceipt(s, command);
  applyAcquisitionMutation(s, command, recording);
  s.darkAngel.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: darkAngelAcquisitionBudget(s), finance: darkAngelFinanceSnapshot(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result, ...(recoverySite ? { recoverySite } : {}) });
}
/** Display the resolved dose receipt only while it owns this exact latest check.
 * Historical private lastCheck, the acquisition journal and RNG stay untouched. */
export function projectDarkAngelLastCheck(s: SliceState): PublicCheckResult | null {
  const current = s.lastCheck, event = [...s.darkAngel.acquisitionJournal].reverse().find(e => e.command.type === 'CONSUME');
  if (!current || !event?.check || event.revision >= s.revision ||
    event.randomBefore === null || event.randomBefore !== event.cursorBefore ||
    event.randomAfter !== event.randomBefore + 1 || event.randomAfter !== event.cursorAfter || event.randomAfter !== s.random.cursor)
    return structuredClone(current);
  const raw = resolveNormalCheck({ ability: 'will', baseAbility: event.before.coreStats.will, difficulty: 30,
    modifiers: [], roll: event.check.roll });
  return structuredClone(same(current, raw) ? event.check : current);
}
function validAcquisitionBudget(v: unknown): v is DarkAngelAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? DARK_ANGEL_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateDarkAngelAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.darkAngel.acquisitionJournal, expected = createDarkAngelState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    if (s.schemaVersion < DARK_ANGEL_RECOVERY_SCHEMA_VERSION && (s.darkAngel.resupply.recovery || s.darkAngel.bottles.some(b => b.recovery) || journal.some(e => recoveryCommand(e.command) || e.command.type === 'STABILIZE_PROMOTION' || Object.hasOwn(e, 'recoverySite')))) return false;
    let previous: DarkAngelAcquisitionEvent | null = null, nextCursor = s.darkAngel.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !integer(raw.week, s.elder.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || !validFinance(raw.finance, raw.week) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'elderPromotionWeek', 'secretSupplicantPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME', 'STABILIZE_PROMOTION'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'hanged-man' || raw.actor.elderPromotionWeek !== s.elder.promotionWeek || raw.actor.secretSupplicantPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as DarkAngelAcquisitionEvent;
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
        if (event.revision === previous.revision + 1 && !adjacentAcquisitionMatches(previous, event)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.darkAngel.sourceHistory ? structuredClone(s.darkAngel.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.darkAngel.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        ...structuredClone(event.finance), world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'hanged-man', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, darkAngel: expected };
      let checks = 0;
      const context: SeerContext = { note() {}, roll() { throw new Error('购药准备没有额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || event.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30 ||
          !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) throw new Error('服药随机来源不一致。');
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: 'will', baseAbility: b.coreStats.will, difficulty: 30, modifiers: darkAngelPromotionModifiers(shadow, event.command.bottleId), roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || random.cursor !== event.randomAfter) throw new Error('服药结果与原随机记录不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return check;
      } };
      if (recoveryCommand(event.command) && !same(recoverySiteReceipt(shadow, event.command), event.recoverySite)) return false;
      applyAcquisitionMutation(shadow, event.command, context, true);
      expected.acquisitionJournal.push(event);
      if (!same(darkAngelAcquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.darkAngel))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isDarkAngel(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.darkAngel.preparedWeek !== null && (!same(darkAngelAcquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (s.revision === previous.revision + 1 && s.darkAngel.preparedWeek === null &&
        !darkAngelCompletedBudgetMatches(s, previous.after, previous.finance, previous.week, previous.date,
          s.revision, previous.cursorAfter, acquisitionTitle(previous, s.darkAngel))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(darkAngelAcquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isDarkAngel(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !DARK_ANGEL_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.darkAngel.elderActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.darkAngel.guidanceKnown || isDarkAngel(s)) return false;
    return true;
  } catch { return false; }
}

/** Lineage-only view of genuine acquisition receipts; source admission separately verifies historical state and random evidence. */
export function resolveDarkAngelOriginalsSnapshot(snapshot: Pick<DarkAngelState, 'bottles' | 'acquisitionJournal' | 'resupply'>): DarkAngelOriginalCharacteristics | null {
  try {
    if (!record(snapshot) || !Array.isArray(snapshot.bottles) || !Array.isArray(snapshot.acquisitionJournal) || snapshot.acquisitionJournal.length > 10000 || !record(snapshot.resupply)) return null;
    const expected = createDarkAngelState(); let previous: DarkAngelAcquisitionEvent | null = null;
    for (const raw of snapshot.acquisitionJournal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !validateAcquisitionCommand(raw.command, true) || !validFinance(raw.finance, raw.week as number) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !integer(raw.week, 1) || !integer(raw.revision) || !isValidGameDate(raw.date) || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'elderPromotionWeek', 'secretSupplicantPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || !integer(raw.actor.age, 1) ||
        !integer(raw.actor.secretSupplicantPromotionWeek, 1, raw.actor.elderPromotionWeek as number) ||
        (['LEARN_GUIDANCE', 'CONSUME', 'STABILIZE_PROMOTION'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'hanged-man' || raw.actor.gender !== raw.before.gender || !integer(raw.actor.elderPromotionWeek, 1, raw.week) ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceIdentityDigest)) return null;
      const e = raw as unknown as DarkAngelAcquisitionEvent, c = e.command, budget = structuredClone(e.before);
      if (!validRecoverySite(e, expected)) return null;
      if (!integer(e.cursorBefore, previous?.cursorAfter ?? 0) || e.cursorAfter !== e.cursorBefore + (c.type === 'CONSUME' ? 1 : 0) ||
          c.type === 'CONSUME' && (e.randomBefore !== e.cursorBefore || e.randomAfter !== e.cursorAfter)) return null;
      if (previous && (e.revision <= previous.revision || e.week < previous.week || compareGameDates(e.date, previous.date) < 0 || previous.after.sequence === 1 ||
        e.actor.sourceIdentityDigest !== previous.actor.sourceIdentityDigest || e.actor.name !== previous.actor.name || e.actor.gender !== previous.actor.gender || e.actor.age !== previous.actor.age ||
        e.actor.elderPromotionWeek !== previous.actor.elderPromotionWeek || e.actor.secretSupplicantPromotionWeek !== previous.actor.secretSupplicantPromotionWeek ||
        INHERITED_ABILITY_IDS.some(id => e.before.mastery[id] !== previous!.after.mastery[id]) || !same(e.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources) ||
        expected.preparedWeek !== null && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after) || !same(e.finance, previous.finance)) ||
        e.revision === previous.revision + 1 && !adjacentAcquisitionMatches(previous, e))) return null;
      if (e.after.gender !== e.before.gender || e.actor.sourceHistoryDigest !== null && e.actor.sourceHistoryDigest !== (previous ? expected.acquisitionJournal[0]!.actor.sourceHistoryDigest : e.actor.sourceHistoryDigest)) return null;
      if (expected.preparedWeek !== null && !['CONSUME', 'LEAVE_PREPARATION', 'STABILIZE_PROMOTION'].includes(c.type)) return null;
      if (c.type !== 'LEARN_GUIDANCE' && !expected.guidanceKnown) return null;
      if (c.type === 'LEARN_GUIDANCE') {
        if (expected.guidanceKnown) return null;
        expected.guidanceKnown = true; expected.sourceWeek = e.week; budget.actions--; budget.cash -= darkAngelPrices().guidance;
        expected.bottles.forEach((b, i) => { b.stockedWeek = e.week; b.source = darkAngelPotionSource(i + 1, e.week); });
      } else if (c.type === 'PREPARE_TASK') {
        if (expected.preparations.some(p => p.taskId === c.taskId)) return null;
        expected.preparations.push({ taskId: c.taskId, completedWeek: e.week }); budget.actions--;
      } else if (c.type === 'PREPARE_PROMOTION') {
        if (expected.resupply.recovery || expected.preparations.length !== 3 || !expected.bottles.some(b => b.status === 'PLAYER') ||
          budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 || e.week < e.actor.elderPromotionWeek + DARK_ANGEL_MIN_ELDER_WEEKS) return null;
        expected.preparedWeek = e.week; budget.actions--; budget.cash -= darkAngelPrices().preparation;
      } else if (c.type === 'LEAVE_PREPARATION') {
        if (expected.preparedWeek === null) return null; expected.preparedWeek = null;
      } else if (c.type === 'STABILIZE_PROMOTION') {
        if (expected.preparedWeek !== e.week || expected.bottles.find(b => b.id === c.bottleId)?.status !== 'PLAYER' ||
          preparedSupport(expected, e.week) || budget.spirituality < DARK_ANGEL_PROMOTION_SUPPORT.spirituality || budget.mind <= 40 + DARK_ANGEL_PROMOTION_SUPPORT.mind) return null;
        budget.cash -= DARK_ANGEL_PROMOTION_SUPPORT.cash; budget.spirituality -= DARK_ANGEL_PROMOTION_SUPPORT.spirituality; budget.mind -= DARK_ANGEL_PROMOTION_SUPPORT.mind;
      } else if (c.type === 'REQUEST_SUPPLY') {
        // A pending archived commission may be superseded by the explicit paid investigation.
        if (!exhaustedSupply(expected) || expected.resupply.requestedWeek !== null || expected.bottles.some(b => b.recovery) || expected.acquisitionJournal.some(j => recoveryCommand(j.command))) return null;
        budget.actions--; budget.cash -= darkAngelPrices().resupply; expected.resupply.requestedWeek = e.week;
      } else if (c.type === 'RECEIVE_SUPPLY') return null; // A fourth independent original is a conservation conflict.
      else if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
        const source = recoverySource(expected, c.bottleId), pending = expected.resupply.recovery;
        if (!originalSupplyFailed(expected) || !source) return null;
        budget.actions--;
        if (c.type === 'REQUEST_RECOVERY_V1') {
          if (pending) return null; budget.cash -= DARK_ANGEL_RECOVERY_PRICES.recovery; expected.resupply.requestedWeek = e.week;
          expected.resupply.recovery = { version: 1, sourceBottleId: c.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: e.week, sourceReceiptRevision: source.receipt.revision, siteId: DARK_ANGEL_RECOVERY_SITE_ID, custodian: 'TG223-DARK-ANGEL-SUPPLIER' as const };
        } else {
          if (!pending || pending.sourceBottleId !== c.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || e.week <= pending.requestedWeek || pending.requestedWeek !== expected.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== DARK_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'TG223-DARK-ANGEL-SUPPLIER') return null;
          const recovery = { ...pending, recoveredWeek: e.week }, id = recoveryBottleId(expected);
          budget.cash -= DARK_ANGEL_RECOVERY_PRICES.recoveryHandover;
          expected.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, e.week), e.week), recovery });
          expected.resupply.deliveries++; expected.resupply.requestedWeek = null; delete expected.resupply.recovery;
        }
      } else {
        if (!('bottleId' in c)) return null;
        const bottle = expected.bottles.find(b => b.id === c.bottleId); if (!bottle) return null;
        if (c.type === 'POTION_WORK') {
          if (bottle.status !== 'SUPPLIER' || bottle.labourSteps >= DARK_ANGEL_LABOUR_STEPS) return null;
          bottle.labourSteps++; budget.actions--;
        } else if (c.type === 'BUY_POTION') {
          if (bottle.status !== 'SUPPLIER') return null;
          budget.cash -= potionPrice(bottle); bottle.status = 'PLAYER'; bottle.acquiredWeek = e.week;
        } else if (c.type === 'CONSUME') {
          if (bottle.status !== 'PLAYER' || expected.preparedWeek !== e.week || !e.check || (!failed(e.check.tier) && !success(e.check.tier)) ||
            !integer(e.randomBefore) || e.randomAfter !== e.randomBefore + 1 || budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100) return null;
          if (!same(e.check, resolveNormalCheck({ ability: 'will', baseAbility: budget.coreStats.will, difficulty: 30, modifiers: supportModifiers(expected, c.bottleId, e.week, e.actor.sourceIdentityDigest, e.actor.sourceHistoryDigest!), roll: e.check.roll }))) return null;
          bottle.status = 'CONSUMED'; bottle.outcome = e.check.tier; bottle.consumedWeek = e.week; bottle.preparationWeek = e.week; expected.preparedWeek = null;
          if (success(e.check.tier)) {
            expected.promotionWeek = e.week; expected.elderActingAtPromotion = budget.acting; budget.sequence = 1; budget.acting = 0;
            budget.mind = Math.max(1, budget.mind - (e.check.tier === 'GREAT_SUCCESS' ? 8 : 15));
            if (!budget.completedSources.includes('hanged-man-s1')) budget.completedSources.push('hanged-man-s1');
            for (const id of DARK_ANGEL_ABILITY_IDS) budget.mastery[id] = 0;
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
    const characteristics: DarkAngelOriginalCharacteristics['characteristics'] = [];
    for (const id of DARK_ANGEL_BOTTLE_IDS) {
      const attempts = expected.bottles.filter(b => originalBottleId(expected, b) === id), latest = attempts.at(-1);
      if (!latest || attempts[0]!.id !== id) return null;
      characteristics.push({ characteristicId: characteristicId(id), originalBottleId: id, latestBottleId: latest.id,
        holder: latest.status === 'CONSUMED' ? success(latest.outcome) ? 'EMBODIED' : 'FAILED_REMNANT' : latest.status,
        consumptionHistory: expected.acquisitionJournal.filter(e => { const c = e.command; return c.type === 'CONSUME' && attempts.some(b => b.id === c.bottleId); }).map(e => ({ bottleId: (e.command as Extract<DarkAngelAcquisitionCommand, { type: 'CONSUME' }>).bottleId, revision: e.revision, week: e.week, outcome: e.check!.tier })) });
    }
    const embodied = characteristics.filter(c => c.holder === 'EMBODIED');
    if (embodied.length > 1 || (expected.promotionWeek !== null) !== (embodied.length === 1)) return null;
    return { characteristics, embodiedOriginalBottleId: embodied[0]?.originalBottleId ?? null, embodiedBottleId: embodied[0]?.latestBottleId ?? null };
  } catch { return null; }
}

/** Read-only conservation view. Full acquisition validation owns the original
 * source, identity and RNG before the same snapshot custody replay is used. */
export function resolveDarkAngelOriginals(s: SliceState): DarkAngelOriginalCharacteristics | null {
  return validateDarkAngelState(s) ? resolveDarkAngelOriginalsSnapshot(s.darkAngel) : null;
}

export function applyDarkAngelCommand(s: SliceState, command: DarkAngelCommand, ctx: SeerContext): void {
  if (!validateDarkAngelCommand(command)) throw new Error('暗天使命令无效。');
  if (validateDarkAngelAcquisitionCommand(command)) return applyDarkAngelAcquisition(s, command, ctx);
  if (validateDarkAngelActivityCommand(command)) return applyDarkAngelLifeCommand(s, command, ctx);
  if (validateDarkAngelEncounterCommand(command)) return applyDarkAngelEncounterCommand(s, command, ctx);
  throw new Error('未知暗天使命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function darkAngelAcquisitionActions(s: SliceState): DarkAngelAction[] {
  if (!knownChannel(s) || isDarkAngel(s)) return [];
  const state = s.darkAngel, prices = darkAngelPrices(), actions: DarkAngelAction[] = [];
  const add = (id: string, label: string, cost: string, command: DarkAngelAcquisitionCommand) => {
    const reason = darkAngelAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-dark-angel-guidance', '听取暗天使成品与专业准备指导', `1行动 · ${prices.guidance}便士`, { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of DARK_ANGEL_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`dark-angel-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-dark-angel-promotion', '实际检查本次服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
    else add('leave-dark-angel-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.recovery) add('recover-dark-angel-characteristic', `原处交接${state.resupply.recovery.characteristicId}`, `1行动 · 30便士 · 最早第${state.resupply.recovery.requestedWeek + 1}周 · 新药另付`, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: state.resupply.recovery.sourceBottleId });
    else if (originalSupplyFailed(state)) for (const bottle of state.bottles) if (recoverySource(state, bottle.id)) add(`request-recovery-${bottle.id}`, `调查并封存${bottle.id}的同一原特性`, '1行动 · 120便士 · 核验归属位置 · 隔周当面交接 · 旧费用不退', { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < DARK_ANGEL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${bottle.recovery ? `同一原特性重配第${bottle.labourSteps + 1}项劳动` : DARK_ANGEL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${bottle.recovery ? 810 : prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}${bottle.recovery ? '次同原特性重配药' : '瓶暗天使魔药'}`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') {
        if (state.preparedWeek === s.week && s.schemaVersion >= DARK_ANGEL_RECOVERY_SCHEMA_VERSION) add(`stabilize-${bottle.id}`, '为本瓶准备同场当周支持', '0行动 · 60便士 · 8灵性 · 6精神 · 意志+13', { type: 'STABILIZE_PROMOTION', bottleId: bottle.id });
        add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}${bottle.recovery ? '次同原特性重配药' : '瓶暗天使魔药'}`, `0行动 · 秽语长老消化${s.progression.acting}/100 · ${elderWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  return actions;
}
function preferredDarkAngelAction(s: SliceState, actions: DarkAngelAction[]): DarkAngelAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectDarkAngelLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectDarkAngel(s: SliceState): DarkAngelProjection {
  const state = s.darkAngel, available = knownChannel(s), promoted = isDarkAngel(s), prices = darkAngelPrices();
  const actions = available ? [...darkAngelAcquisitionActions(s), ...darkAngelLifeActions(s), ...darkAngelEncounterActions(s)] : [];
  const preferred = preferredDarkAngelAction(s, actions);
  return {
    title: '暗天使·倒吊人序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceLabel: available ? darkAngelSourceLabel() : '', prices: available ? prices : null,
    formulaKnown: false, formula: [], ...(available ? { story: `${DARK_ANGEL_FORMULA_STATUS}${DARK_ANGEL_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶${prices.potion}便士，或为本瓶完成五项真实劳动后支付${prices.labourBalance}便士；最初三瓶全部失败后可调查同一原特性，隔周付费交接；新普通药物900便士，或五项新劳动后90便士。当周场地检查另付180便士，不增加第四份原特性。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成秽语长老的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}${b.recovery ? '次同原特性重配药' : '瓶 · 暗天使成品魔药'}`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为秽语长老' : '排异，仍为秽语长老'}`,
      chance: computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: darkAngelPromotionModifiers(s, b.id) }), command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? DARK_ANGEL_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...DARK_ANGEL_INHERITED_ABILITIES, ...DARK_ANGEL_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `秽语长老消化${state.elderActingAtPromotion}/100留存；暗天使扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `秽语长老需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${elderWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成秽语长老的实际经历。',
    pollution: s.seer.pollution, risk: available ? DARK_ANGEL_CURRENT_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '八阶原瓶、伊芮斯、赫莲娜、罗兰、原卡、原箱、原灯与遮板逐一保留来源。塞德里克永久释放，旧失控影体保持独立；放牧至多7位、外放至多2位、本人同时借1灵不变。血肉储备与旧材料不补回，新实践重新征得可撤回许可。' : '',
    inheritedHistory: available ? [
      `秽语长老在第${s.elder.promotionWeek}周实际晋升；${promoted ? `原消化${state.elderActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从这次晋升计算。`,
      '前八阶15项掌握保持原值，原零项不补齐；成功晋升只增加两项零掌握。',
      `旧封存院本人实际步行${darkAngelOriginals(s).site.playerTravelMetres}米、原卡移动${darkAngelOriginals(s).site.card.travelMetres}米；原封条磨损${darkAngelOriginals(s).operation.sealWear}，旧材料的已耗用与磨损留存。`,
      '原远端残留继续封存，旧人物的身体与释放结果不改写。巴斯蒂安和布拉姆已撤退的旧争议不重开，新遭遇有自己的成年人和有限物资。',
    ] : [],
    life: projectDarkAngelLife(s), encounter: projectDarkAngelEncounter(s), insideCase: hasDarkAngelLock(s),
    environment: available ? DARK_ANGEL_SOURCE_STATUS : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateDarkAngelJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.darkAngel.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
        if (['PREPARE_PROMOTION', 'STABILIZE_PROMOTION'].includes(previous.command.type) && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION', 'STABILIZE_PROMOTION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
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
    type SharedBudget = Pick<DarkAngelAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.darkAngel.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.darkAngel.encounter, preparation = encounter.preparation;
    const reflection = s.darkAngel.life.journal.find(event => event.command.type === 'REFLECT');
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
      (!same(s.date, tail.date) || !same(shared(darkAngelAcquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** All eight predecessor roots remain exact. The separately cloned new site
 * and inventory are the only live continuation after promotion. */
export function validateDarkAngelSource(s: SliceState): boolean {
  try {
    const state = s.darkAngel, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, DARK_ANGEL_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city', 'finance']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !shape(scene.originals, ['site', 'operation', 'grazing', 'reserve', 'shepherdPromotionWeek']) || !sourceClosed(scene.originals) || !validFinance(scene.finance, scene.week) || !same(scene.finance, first.finance) ||
      !same(scene.originals, darkAngelOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const historical = darkAngelInheritedView(s);
    if (![validateSecretSupplicantState, validateListenerState, validateShadowAsceticState, validateRoseBishopState, validateShepherdState,
      validateBlackKnightState, validateThreeHeadedTemplarState, validateElderState].every(validate => validate(historical))) return false;
    return same(darkAngelSourceHistory(s), history) && same(darkAngelOriginals(s), scene.originals);

  } catch { return false; }
}

export const validateDarkAngelInheritedState = validateDarkAngelSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function darkAngelInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.darkAngel;
  if ((!isDarkAngel(s) && !isDarkAngelAcquisitionStage(s)) || !s.darkAngel.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    ...structuredClone(scene.finance), world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'hanged-man', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), darkAngel: createDarkAngelState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateDarkAngelState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.darkAngel;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'sourceWeek', 'bottles', 'resupply', 'promotionWeek', 'elderActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries', ...(Object.hasOwn(raw.resupply, 'recovery') ? ['recovery'] : [])]) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as DarkAngelState, promoted = isDarkAngel(s), acquisitionStage = isDarkAngelAcquisitionStage(s);
  const recoveryDeliveries = state.bottles.filter(b => record(b) && Object.hasOwn(b, 'recovery')).length;
  const legacyDeliveries = state.resupply.deliveries - recoveryDeliveries;
  if (!integer(legacyDeliveries) || state.bottles.length !== 3 + legacyDeliveries * 3 + recoveryDeliveries) return false;
  const validRecovery = (r: unknown, recovered: boolean): r is DarkAngelRecoveryRequest => record(r) &&
    shape(r, ['version', 'sourceBottleId', 'originalBottleId', 'characteristicId', 'requestedWeek', 'sourceReceiptRevision', 'siteId', 'custodian', ...(recovered ? ['recoveredWeek'] : [])]) &&
    r.version === 1 && integer(r.sourceReceiptRevision) && r.siteId === DARK_ANGEL_RECOVERY_SITE_ID && r.custodian === 'TG223-DARK-ANGEL-SUPPLIER' && typeof r.sourceBottleId === 'string' && /^dark-angel-(?:potion|recovery)-[1-9]\d{0,14}$/.test(r.sourceBottleId) &&
    DARK_ANGEL_BOTTLE_IDS.includes(r.originalBottleId as typeof DARK_ANGEL_BOTTLE_IDS[number]) && r.characteristicId === characteristicId(String(r.originalBottleId)) &&
    integer(r.requestedWeek, s.elder.promotionWeek ?? s.week, s.week) && (!recovered || integer(r.recoveredWeek, r.requestedWeek + 1, s.week));
  if (Object.hasOwn(state.resupply, 'recovery') && !validRecovery(state.resupply.recovery, false)) return false;
  const firstWeek = s.elder.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + DARK_ANGEL_MIN_ELDER_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateDarkAngelSource(s) || !integer(state.sourceWeek, firstWeek, lastAcquisitionWeek))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null || state.sourceWeek !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > DARK_ANGEL_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !DARK_ANGEL_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasDarkAngelOldPractice(s) || hasDarkAngelLifeLock(s) || hasDarkAngelEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.elder.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.elderActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !elderReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...DARK_ANGEL_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.elderActingAtPromotion !== null || DARK_ANGEL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome', ...(Object.hasOwn(b, 'recovery') ? ['recovery'] : [])]) || b.id !== (b.recovery ? `dark-angel-recovery-${state.bottles.slice(0, index).filter(previous => previous.recovery).length + 1}` : `dark-angel-potion-${index + 1}`) || !integer(b.labourSteps, 0, DARK_ANGEL_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < DARK_ANGEL_BOTTLE_IDS.length) {
      if (Object.hasOwn(b, 'recovery')) return false;
      if (state.guidanceKnown ? b.stockedWeek !== state.sourceWeek || b.source !== darkAngelPotionSource(index + 1, state.sourceWeek!) : b.stockedWeek !== null || b.source !== DARK_ANGEL_POTION_SOURCES[index]!.source) return false;
    } else if (b.recovery) {
      if (!validRecovery(b.recovery, true) || !state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.recovery.recoveredWeek !== b.stockedWeek || b.source !== recoverySourceText(b.id, b.recovery, b.stockedWeek) || !originalBottleId(state, b)) return false;
      const prefix = { ...state, bottles: state.bottles.slice(0, index) };
      const source = recoverySource(prefix, b.recovery.sourceBottleId);
      if (!originalSupplyFailed(prefix) || !source || source.originalBottleId !== b.recovery.originalBottleId || source.characteristicId !== b.recovery.characteristicId || source.receipt.revision !== b.recovery.sourceReceiptRevision || source.bottle.consumedWeek! > b.recovery.requestedWeek) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(s, index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % DARK_ANGEL_BOTTLE_IDS.length;
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
        if (!integer(s.elder.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !(state.resupply.recovery ? originalSupplyFailed(state) : exhaustedSupply(state)))) return false;
  if (state.resupply.recovery) {
    const pending = state.resupply.recovery, source = recoverySource(state, pending.sourceBottleId);
    if (!source || pending.requestedWeek !== state.resupply.requestedWeek || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== DARK_ANGEL_RECOVERY_SITE_ID || pending.custodian !== 'TG223-DARK-ANGEL-SUPPLIER' || source.bottle.consumedWeek! > pending.requestedWeek) return false;
  } else if (state.resupply.requestedWeek !== null && state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!)) return false;
  if (successes !== (promoted ? 1 : 0) || !validateDarkAngelAcquisitionJournal(s) || !validateDarkAngelJournalContinuity(s) || !validateDarkAngelLifeState(s) || !validateDarkAngelEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('hanged-man-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(darkAngelLifeMasteryGains(s))) {
      if (!DARK_ANGEL_ABILITY_IDS.includes(id as typeof DARK_ANGEL_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.darkAngelOutcome) {
      for (const action of [...round.darkAngelOutcome.playerActions, ...round.darkAngelOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('hanged-man-s1')) return false;
  return true;
}
export { DARK_ANGEL_ABILITIES } from './content.js';
export { DARK_ANGEL_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleDarkAngel = applyDarkAngelCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateDarkAngelHistory = validateDarkAngelState;
