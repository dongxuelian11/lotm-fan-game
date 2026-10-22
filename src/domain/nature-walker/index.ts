import { hasBarrenMatriarchOldPractice, hasBarrenMatriarchLock, validateBarrenMatriarchState } from '../barren-matriarch/index.js';
import { validateCultivatorState } from '../cultivator/index.js';
import { validatePhysicianState } from '../physician/index.js';
import { validateHarvestpriestState } from '../harvestpriest/index.js';
import { validateBiologistState } from '../biologist/index.js';
import { validateDruidState } from '../druid/index.js';
import { validateAncientAlchemistState } from '../ancient-alchemist/index.js';
import { validateCoffinBearerState } from '../coffin-bearer/index.js';
import type { BarrenMatriarchSceneRoot } from '../barren-matriarch/life.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { natureWalkerFinanceSnapshot, natureWalkerCompletedBudgetMatches, initializeNatureWalkerEncounterState } from './encounter.js';
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
import { createNatureWalkerLifeState, initializeNatureWalkerLifeState, applyNatureWalkerLifeCommand, projectNatureWalkerLife, natureWalkerLifeActions, validateNatureWalkerLifeState, validateNatureWalkerActivityCommand, hasNatureWalkerLifeLock, natureWalkerLifeMasteryGains } from './life.js';
import { createNatureWalkerEncounterState, applyNatureWalkerEncounterCommand, projectNatureWalkerEncounter, natureWalkerEncounterActions, validateNatureWalkerEncounterState, validateNatureWalkerEncounterCommand, hasNatureWalkerEncounterLock } from './encounter.js';
import { NATURE_WALKER_ABILITIES, NATURE_WALKER_INHERITED_ABILITIES, NATURE_WALKER_BOTTLE_IDS, NATURE_WALKER_FORMULA_STATUS, NATURE_WALKER_LABOUR_STEPS, NATURE_WALKER_LABOUR_TASKS, NATURE_WALKER_MIN_BARREN_MATRIARCH_WEEKS, NATURE_WALKER_POTION_SOURCES, NATURE_WALKER_PREPARATIONS, natureWalkerPrices, natureWalkerSourceLabel, natureWalkerPotionSource, natureWalkerConsumptionRisk, NATURE_WALKER_SOURCE_STATUS, NATURE_WALKER_RECOVERY_PRICES, NATURE_WALKER_RECOVERY_SCHEMA_VERSION, NATURE_WALKER_RECOVERY_SITE_ID, NATURE_WALKER_CURRENT_CONSUMPTION_RISK } from './content.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_INHERITED_ABILITY_IDS, NATURE_WALKER_PREPARATION_IDS, NATURE_WALKER_SOURCE_KEYS, type NatureWalkerFinance, type NatureWalkerOriginals, type NatureWalkerSourceHistory, type NatureWalkerAcquisitionBudget, type NatureWalkerAcquisitionEvent, type NatureWalkerAcquisitionCommand, type NatureWalkerAction, type NatureWalkerBottle, type NatureWalkerCommand, type NatureWalkerProjection, type NatureWalkerState, type NatureWalkerRecoveryRequest, type NatureWalkerRecoverySite, type NatureWalkerOriginalCharacteristics } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export { NATURE_WALKER_INHERITED_ABILITY_IDS } from './types.js';
const INHERITED_ABILITY_IDS = NATURE_WALKER_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): NatureWalkerBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createNatureWalkerState(): NatureWalkerState {
  return { guidanceKnown: false, sourceWeek: null, bottles: NATURE_WALKER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, barrenMatriarchActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createNatureWalkerLifeState(), encounter: createNatureWalkerEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isNatureWalker = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 1;
export const isNatureWalkerAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 2;
export const hasNatureWalkerHistory = (s: SliceState) => isNatureWalker(s) && s.natureWalker.promotionWeek !== null;
/** Source stages retain their real purchase, brewing and ritual shapes. Detailed
 * predecessor validators run on the frozen S2 source, never an invented history. */
function sourceHistory(s: SliceState): boolean {
  if (!s.cultivator.discovered || !s.cultivator.guidanceKnown) return false;
  const first = s.cultivator.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.physician, s.harvestpriest, s.biologist, s.druid, s.ancientAlchemist, s.coffinBearer, s.barrenMatriarch]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.physician.cultivatorActingAtPromotion === 100 && s.harvestpriest.physicianActingAtPromotion === 100 &&
    s.biologist.harvestpriestActingAtPromotion === 100 && s.druid.biologistActingAtPromotion === 100 &&
    s.ancientAlchemist.druidActingAtPromotion === 100 && s.coffinBearer.ancientAlchemistActingAtPromotion === 100 && s.barrenMatriarch.coffinBearerActingAtPromotion === 100;
}
export function natureWalkerSourceHistory(s: SliceState): NatureWalkerSourceHistory {
  return Object.fromEntries(NATURE_WALKER_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as NatureWalkerSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.natureWalker.sourceHistory ?? natureWalkerSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isNatureWalkerAcquisitionStage(s) || isNatureWalker(s)) && sourceHistory(s);
/** Once guidance freezes the source, old commands close and completed records stay exact. */
export function hasNatureWalkerOldPractice(s: SliceState): boolean {
  return hasBarrenMatriarchOldPractice(s) || hasBarrenMatriarchLock(s);
}
const barrenMatriarchReportsComplete = (s: SliceState) => s.barrenMatriarch.life.reflected &&
  Object.keys(s.barrenMatriarch.life.cases).length === 3 && Object.values(s.barrenMatriarch.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 && c.attempts.length > 0 &&
    c.attempts.every(a => a.week <= s.week) && c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected);
export const natureWalkerOriginals = (s: SliceState): NatureWalkerOriginals => ({
  site: structuredClone(s.coffinBearer.life) as unknown as BarrenMatriarchSceneRoot, operation: structuredClone(s.barrenMatriarch.life.operation),
  rootPad: structuredClone(s.barrenMatriarch.life.rootPad),
});
/** The actual final nursery is authoritative, never barrenMatriarch.life.source.snapshot. */
function sourceClosed(originals: NatureWalkerOriginals): boolean {
  const { site, operation, rootPad } = originals;
  return site.siteId === 'CB3-NURSERY-TRANSFER' && site.playerLocation === 'START' && site.activeCase === null &&
    site.owner.id === 'CB3-ADA' && site.owner.age === 46 && site.owner.alive && site.owner.independentMind && site.owner.location === 'OUTSIDE' &&
    site.recipient.id === 'CB3-LENA' && site.recipient.age === 39 && site.recipient.alive && site.recipient.independentMind && site.recipient.location === 'OUTSIDE' &&
    site.samples.length === 3 && ['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1'].every(id => site.samples.some(sample => sample.id === id && sample.location === 'OUTSIDE' && sample.holder !== 'CASE')) &&
    site.samples.filter(sample => sample.originalAlive).every(sample => sample.alive === (sample.vitality > 0) && integer(sample.vitality, 0, sample.originalVitality)) &&
    site.samples.some(sample => sample.id === 'CB3-DRY-1' && !sample.originalAlive && !sample.alive && sample.vitality === 0) &&
    site.paper.id === 'CB3-RECORD' && site.paper.owner === 'OWNER' && site.paper.holder === 'OWNER' && site.paper.location === 'OUTSIDE' &&
    site.box.id === 'CB3-CASE' && site.box.quantity === 1 && site.box.holder === 'OWNER' && site.box.location === 'OUTSIDE' && site.box.sampleId === null &&
    site.tag.id === 'CB3-TAG' && site.tag.quantity === 1 && site.tag.holder === 'OWNER' && site.tag.location === 'OUTSIDE' &&
    site.pads.length === 3 && site.pads.every(pad => pad.holder === 'OWNER' && pad.location === 'OUTSIDE') &&
    !Object.values(site.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE') &&
    operation.dormancy === null && operation.buffer === null &&
    rootPad.id === 'BM2-ROOT-PAD' && rootPad.sourceId === 'BM2-ROOT-FIBRE-STOCK' && rootPad.material === 'PLANT_FIBRE' && rootPad.quantity === 1 &&
    rootPad.owner === 'PLAYER' && rootPad.holder === 'PLAYER' && rootPad.location === 'START' && integer(rootPad.integrity, 0, 65) && integer(rootPad.acquiredWeek, 1);
}
export { getNatureWalkerCurrentSite } from './life.js';
export const hasNatureWalkerOldSceneLock = hasNatureWalkerOldPractice;
export const hasNatureWalkerRitualLock = (s: SliceState): boolean => s.natureWalker.preparedWeek !== null;
export const hasNatureWalkerLock = (s: SliceState): boolean => hasNatureWalkerRitualLock(s) || hasNatureWalkerLifeLock(s) || hasNatureWalkerEncounterLock(s);
const bottleNumber = (b: Pick<NatureWalkerBottle, 'id'>) => Number(b.id.split('-').at(-1));
export const natureWalkerOriginalBottlePrice = (b: NatureWalkerBottle) => b.recovery
  ? b.labourSteps === NATURE_WALKER_LABOUR_STEPS ? NATURE_WALKER_RECOVERY_PRICES.recoveryLabourBalance : NATURE_WALKER_RECOVERY_PRICES.recoveryDrug
  : natureWalkerPrices().potion - (b.labourSteps === NATURE_WALKER_LABOUR_STEPS ? natureWalkerPrices().labourCredit : 0);
const potionPrice = natureWalkerOriginalBottlePrice;
const legacySupply = (c: { type: string }) => c.type === 'REQUEST_SUPPLY' || c.type === 'RECEIVE_SUPPLY';
const recoveryCommand = (c: { type: string }) => c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1';
export const natureWalkerCharacteristicId = (bottleId: string): string => {
  const index = NATURE_WALKER_BOTTLE_IDS.findIndex(id => id === bottleId);
  if (index < 0) throw Error('未知原特性身份。');
  return `NW229-CHAR-${index + 1}`;
};
const characteristicId = natureWalkerCharacteristicId;
const recoveryBottleId = (state: NatureWalkerState) => `nature-walker-recovery-${state.bottles.filter(b => b.recovery).length + 1}`;
const recoverySourceText = (id: string, recovery: NatureWalkerRecoveryRequest, week: number) => `交接处保管方在原服药准备与支持交接处核验${recovery.sourceBottleId}排异后遗留的同一份自然行者特性${recovery.characteristicId}，核对同次原失败回执及原交接处保管方取得本次许可后当面交接，第${week}周回收封存到重配瓶${id}。原特性来自${recovery.originalBottleId}；新普通药物与调配服务另付，旧原瓶及其实际结果不改写。`;
/** Follow actual vessel ancestry without treating an attempt number as a fourth original. */
function originalBottleId(state: NatureWalkerState, bottle: NatureWalkerBottle): string | null {
  const seen = new Set<string>(); let current = bottle;
  while (current.recovery) {
    if (seen.has(current.id)) return null; seen.add(current.id);
    const r = current.recovery, previous = state.bottles.find(b => b.id === r.sourceBottleId);
    if (!previous || r.siteId !== NATURE_WALKER_RECOVERY_SITE_ID || r.custodian !== 'MO229-NATURE-WALKER-SUPPLIER' || !integer(r.sourceReceiptRevision) || state.bottles.indexOf(previous) >= state.bottles.indexOf(current) || r.version !== 1 ||
      !NATURE_WALKER_BOTTLE_IDS.includes(r.originalBottleId as typeof NATURE_WALKER_BOTTLE_IDS[number]) || r.characteristicId !== characteristicId(r.originalBottleId) ||
      previous.status !== 'CONSUMED' || !failed(previous.outcome) || previous.consumedWeek === null || previous.consumedWeek > r.requestedWeek ||
      r.recoveredWeek <= r.requestedWeek || current.stockedWeek !== r.recoveredWeek) return null;
    if (previous.recovery && (previous.recovery.originalBottleId !== r.originalBottleId || previous.recovery.characteristicId !== r.characteristicId)) return null;
    if (!previous.recovery && previous.id !== r.originalBottleId) return null;
    current = previous;
  }
  return NATURE_WALKER_BOTTLE_IDS.includes(current.id as typeof NATURE_WALKER_BOTTLE_IDS[number]) ? current.id : null;
}
function recoverySource(state: NatureWalkerState, bottleId: string) {
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
function recoveryPlaceAvailable(o: NatureWalkerOriginals): boolean {
  return record(o) && shape(o, ['site', 'operation', 'rootPad']) && sourceClosed(o);
}
function recoverySiteReceipt(s: SliceState, command: NatureWalkerAcquisitionCommand): NatureWalkerRecoverySite | undefined {
  if (!recoveryCommand(command) || !('bottleId' in command)) return undefined;
  const source = recoverySource(s.natureWalker, command.bottleId);
  if (!source || !recoveryPlaceAvailable(natureWalkerOriginals(s))) throw new Error('原服药准备与支持交接处与同一份失败特性尚未核实。');
  return { siteId: NATURE_WALKER_RECOVERY_SITE_ID, originals: natureWalkerOriginals(s),
    permission: { personId: 'MO229-NATURE-WALKER-SUPPLIER', week: s.week, revision: s.revision, purpose: command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER' },
    originalBottleId: source.originalBottleId, sourceBottleId: source.bottle.id, characteristicId: source.characteristicId, sourceReceiptRevision: source.receipt.revision,
    custodyBefore: command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SEALED_WITH_CUSTODIAN', custodyAfter: command.type === 'REQUEST_RECOVERY_V1' ? 'SEALED_WITH_CUSTODIAN' : 'SUPPLIER' };
}
function validRecoverySite(event: NatureWalkerAcquisitionEvent, state: NatureWalkerState): boolean {
  if (!recoveryCommand(event.command)) return !Object.hasOwn(event, 'recoverySite');
  const site = event.recoverySite, command = event.command;
  if (!('bottleId' in command) || !record(site) || !shape(site, ['siteId', 'originals', 'permission', 'originalBottleId', 'sourceBottleId', 'characteristicId', 'sourceReceiptRevision', 'custodyBefore', 'custodyAfter']) ||
    site.siteId !== NATURE_WALKER_RECOVERY_SITE_ID || !recoveryPlaceAvailable(site.originals) ||
    !record(site.permission) || !shape(site.permission, ['personId', 'week', 'revision', 'purpose']) || site.permission.personId !== 'MO229-NATURE-WALKER-SUPPLIER' ||
    site.permission.week !== event.week || site.permission.revision !== event.revision || site.permission.purpose !== (command.type === 'REQUEST_RECOVERY_V1' ? 'INVESTIGATE' : 'RECOVER') ||
    site.custodyBefore !== (command.type === 'REQUEST_RECOVERY_V1' ? 'FAILED_REMNANT' : 'SEALED_WITH_CUSTODIAN') || site.custodyAfter !== (command.type === 'REQUEST_RECOVERY_V1' ? 'SEALED_WITH_CUSTODIAN' : 'SUPPLIER')) return false;
  const source = recoverySource(state, command.bottleId), previous = state.acquisitionJournal.find(e => e.recoverySite)?.recoverySite;
  return !!source && site.originalBottleId === source.originalBottleId && site.sourceBottleId === command.bottleId && site.characteristicId === source.characteristicId && site.sourceReceiptRevision === source.receipt.revision &&
    (!previous || same(previous.originals, site.originals));
}
const barrenMatriarchWeeks = (s: SliceState) => Math.max(0, (s.natureWalker.promotionWeek ?? s.week) - (s.barrenMatriarch.promotionWeek ?? s.week));
const exhaustedSupply = (state: NatureWalkerState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const originalSupplyFailed = (state: NatureWalkerState) => state.bottles.length >= 3 && state.bottles.slice(0, 3).every((b, index) => b.id === NATURE_WALKER_BOTTLE_IDS[index] && !b.recovery && b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (s: SliceState, number: number, week: number) => natureWalkerPotionSource(number, week);
const hasPreparations = (s: SliceState) => NATURE_WALKER_PREPARATION_IDS.every(id => s.natureWalker.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `荒芜主母魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.barrenMatriarch.promotionWeek === null || barrenMatriarchWeeks(s) < NATURE_WALKER_MIN_BARREN_MATRIARCH_WEEKS) return `成为荒芜主母后已过${barrenMatriarchWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!barrenMatriarchReportsComplete(s)) return '先完成荒芜主母的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与同一原物、活苗回应和本人可见冲量的有限边界、普通返回路线；领取药瓶不能代做专业准备。';
}
function validateAcquisitionCommand(v: unknown, historicalReplay = false): v is NatureWalkerAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (legacySupply(v as { type: string })) return historicalReplay && shape(v, ['type']);
  if (['LEARN_GUIDANCE', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && NATURE_WALKER_PREPARATION_IDS.includes(v.taskId as typeof NATURE_WALKER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^nature-walker-(?:potion|recovery)-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export function validateNatureWalkerAcquisitionCommand(v: unknown): v is NatureWalkerAcquisitionCommand { return validateAcquisitionCommand(v); }
export const isNatureWalkerAcquisitionCommand = validateNatureWalkerAcquisitionCommand;
export function validateNatureWalkerCommand(v: unknown): v is NatureWalkerCommand {
  return validateNatureWalkerAcquisitionCommand(v) || validateNatureWalkerActivityCommand(v) || validateNatureWalkerEncounterCommand(v);
}
export function natureWalkerAcquisitionBlock(s: SliceState, command: NatureWalkerAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: NatureWalkerAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAcquisitionCommand(command, historicalReplay)) return '自然行者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasNatureWalkerOldPractice(s)) || hasNatureWalkerLifeLock(s) || hasNatureWalkerEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德当前时代的独立交接处。';
  if (!sourceClosed(natureWalkerOriginals(s))) return '先收束原苗圃，停止旧效力并归还原苗、枯样、原匣、原牌与原纸。本人在门口，艾达与莉娜及原物在室外，原根垫由本人持有后再进行服药交接。';
  if (!knownChannel(s)) return '实际成为荒芜主母并保留当前时代真实指导渠道后，才能了解自然行者之路。';
  if (!isNatureWalkerAcquisitionStage(s)) return '已经晋升自然行者1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '耕种者至荒芜主母的15项掌握记录不完整，暂不能继续晋升。';
  const state = s.natureWalker, prices = natureWalkerPrices();
  if (!historicalReplay && state.bottles.slice(3).some(b => !b.recovery)) return '历史独立第4份及以后原特性存在守恒冲突；旧记录只读，不能改标为回收件或继续本入口。';
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !barrenMatriarchReportsComplete(s)) return '先完成荒芜主母三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < prices.guidance ? `本次专业指导需要${prices.guidance}便士。` : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    if (state.resupply.recovery) return '先完成已付费的同一原特性调查交接，再准备本次服药。';
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的自然行者原瓶。';
    return s.cash < prices.preparation ? `当次场地检查需要${prices.preparation}便士。` : null;
  }
  if (command.type === 'REQUEST_RECOVERY_V1' || command.type === 'RECOVER_CHARACTERISTIC_V1') {
    if (s.schemaVersion < NATURE_WALKER_RECOVERY_SCHEMA_VERSION) return '这一原特性回收协议须使用对应的新版本存档。';
    if (!recoveryPlaceAvailable(natureWalkerOriginals(s)) || !state.sourceScene || !same(natureWalkerOriginals(s), state.sourceScene.originals)) return '须本人在贝克兰德原服药准备与支持交接处，与原交接处保管方当面核验同一失败记录及原物；本次许可重新取得。艾达、莉娜、两株原活苗、原枯样、原匣牌纸、护腕与本人原根垫保持原状态。';
    const source = recoverySource(state, command.bottleId), pending = state.resupply.recovery;
    if (!originalSupplyFailed(state)) return '最初三瓶须实际耗尽失败，才能调查并回收同一份原特性。';
    if (!source) return '须核验真实失败原瓶、同一原特性与实际服药记录；已回收或仍被持有的特性不能重复取得。';
    if (command.type === 'REQUEST_RECOVERY_V1') return pending ? '已有指定失败原瓶的调查委托，须先完成回收。' : s.cash < NATURE_WALKER_RECOVERY_PRICES.recovery ? '调查原特性需要1行动、120便士；旧费用不退。' : null;
    if (!pending || pending.version !== 1 || pending.sourceBottleId !== command.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.requestedWeek !== state.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== NATURE_WALKER_RECOVERY_SITE_ID || pending.custodian !== 'MO229-NATURE-WALKER-SUPPLIER') return '先支付对应失败原瓶的调查委托，不能更换原特性。';
    return s.week <= pending.requestedWeek ? '调查封存后须隔一真实周，再回原准备处核验并交接同一份原特性。' : s.cash < NATURE_WALKER_RECOVERY_PRICES.recoveryHandover ? '原物封存交接须实付30便士。' : null;
  }
  if (legacySupply(command) && (state.resupply.recovery || state.bottles.some(b => b.recovery) || state.acquisitionJournal.some(e => recoveryCommand(e.command)))) return '已经开始原特性回收，不能续接独立新原瓶的旧供货记录。';
  if (command.type === 'REQUEST_SUPPLY' && s.cash < prices.resupply) return `申请下一批需要${prices.resupply}便士实际费用。`;
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批自然行者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的自然行者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选自然行者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : `须另付1行动与${prices.preparation}便士完成本周当次场地检查；旧准备不能使用。`;
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= NATURE_WALKER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: NatureWalkerAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.natureWalker, prices = natureWalkerPrices();
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = natureWalkerSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: natureWalkerAcquisitionBudget(s), finance: natureWalkerFinanceSnapshot(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: natureWalkerOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= prices.guidance; state.guidanceKnown = true; state.sourceWeek = s.week;
      state.bottles.forEach((b, i) => { b.stockedWeek = s.week; b.source = natureWalkerPotionSource(i + 1, s.week); });
      ctx.note('听取自然行者独立成品与专业准备指导', `花1行动、${prices.guidance}便士。${natureWalkerSourceLabel()}说明当前渠道记录。${NATURE_WALKER_FORMULA_STATUS}${historicalReplay || s.schemaVersion < NATURE_WALKER_RECOVERY_SCHEMA_VERSION ? natureWalkerConsumptionRisk() : NATURE_WALKER_CURRENT_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = NATURE_WALKER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', `花1行动、${prices.preparation}便士，按三项真实专业准备检查本周场地。须另外确认饮用所选原瓶；退出不退款、不治疗。`); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', `0行动实际退出，未服原瓶保留，已用行动与${prices.preparation}便士不返。可以继续真实生活休养。`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      if (bottle.recovery) { ctx.note('同一原特性的新普通药物调配劳动', `本次重配载体${bottle.id}第${bottle.labourSteps}/5项劳动，花1行动；五项抵810便士，余款90便士。原特性不复制，旧成本不退。`); return; }
      ctx.note(NATURE_WALKER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶${prices.labourCredit}便士，余款${prices.labourBalance}便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      if (bottle.recovery) { ctx.note('同一原特性重配交付', `实付${paid}便士取得${bottle.id}，其中仍是${bottle.recovery.characteristicId}；须另做当周准备。`); return; }
      ctx.note('自然行者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? `本瓶五项劳务抵${prices.labourCredit}便士。` : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_RECOVERY_V1': {
      const source = recoverySource(state, command.bottleId)!;
      const supersededLegacyRequest = state.resupply.requestedWeek !== null && !state.resupply.recovery;
      s.actionsRemaining--; s.cash -= NATURE_WALKER_RECOVERY_PRICES.recovery; state.resupply.requestedWeek = s.week;
      state.resupply.recovery = { version: 1, sourceBottleId: command.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: s.week, sourceReceiptRevision: source.receipt.revision, siteId: NATURE_WALKER_RECOVERY_SITE_ID, custodian: 'MO229-NATURE-WALKER-SUPPLIER' as const };
      ctx.note('调查失败原瓶遗留的同一份特性', `1行动、120便士，本人在原服药准备与支持交接处重新向交接处保管方询问本次许可，获准后当面按第${source.receipt.week}周同次真实失败回执逐一核对，现在调查遗留原物的归属与位置，在原准备处实际找到并检查${source.characteristicId}，独立核验原封签，经本次许可才交由交接处保管方新封存，本次尚未交付。此项是现在发生的调查，不改写旧失败记载。隔一真实周再到同一原处当面复核、交接同一封存原件；原出口受阻或交接处保管方不在原处时不能回收。旧原瓶、失败、费用与伤势全部保留，不退款。${supersededLegacyRequest ? '本次同原特性调查明确接替先前尚未交付的旧供货申请，原100便士与申请回执保留，不再接收独立新特性。' : ''}`); return;
    }
    case 'RECOVER_CHARACTERISTIC_V1': {
      const recovery = { ...state.resupply.recovery!, recoveredWeek: s.week }, id = recoveryBottleId(state);
      s.actionsRemaining--; s.cash -= NATURE_WALKER_RECOVERY_PRICES.recoveryHandover;
      state.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, s.week), s.week), recovery });
      state.resupply.deliveries++; state.resupply.requestedWeek = null; delete state.resupply.recovery;
      ctx.note('原处回收封存同一份自然行者特性', `再次当面取得交接处保管方本次交接许可，以1行动和30便士将${recovery.characteristicId}封存到重配瓶${id}，没有新增原特性。新普通药物与调配服务须另付900便士，五项新劳务后90便士；之后仍须1行动、180便士检查本次场地。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= prices.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批自然行者成品', `原瓶全部失败耗尽，花1行动与${prices.resupply}便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < NATURE_WALKER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`nature-walker-potion-${number}`, deliverySource(s, number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶自然行者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶${prices.potion}便士或对应五项劳动后${prices.labourBalance}便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.barrenMatriarchActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('mother-s1')) s.seer.completedSources.push('mother-s1');
        initializeNatureWalkerLifeState(s);
        initializeNatureWalkerEncounterState(s);
        for (const id of NATURE_WALKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为自然行者', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；荒芜主母消化100与原15项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。姓名、性别、年龄、既有性格与旧伤不改写。同一原苗圃、艾达、莉娜、原活苗与枯样、原匣牌纸、护腕及原根垫继续留存；原活性与原根垫完整度不恢复，旧人物伤势、生死及投降不改写。本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '自然行者魔药严重排异' : '自然行者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为荒芜主母，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、${prices.preparation}便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function validFinance(v: unknown, week: number): v is NatureWalkerFinance {
  return record(v) && shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) &&
    integer(v.weeklyBudget, 1, 100) && typeof v.lifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.lifeTier) &&
    typeof v.nextLifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) &&
    ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) && Array.isArray(v.debts) && new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d =>
      record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 &&
      typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** Between adjacent public inputs the only unlocked automatic change is the
 * existing weekly bill/debt transition. No new economy or free recovery exists. */
function adjacentAcquisitionMatches(previous: NatureWalkerAcquisitionEvent, event: NatureWalkerAcquisitionEvent): boolean {
  if (event.cursorBefore !== previous.cursorAfter) return false;
  if (previous.after.actions > 0 || previous.command.type === 'PREPARE_PROMOTION') return event.week === previous.week &&
    same(event.date, previous.date) && same(event.before, previous.after) && same(event.finance, previous.finance);
  const result = resolveSliceWeeklyFinance({ ...previous.finance, cash: previous.after.cash, week: previous.week,
    revision: previous.revision, pulse: 'BILL', billAmount: 0 });
  if (result.eventId !== null || result.state.pulse !== 'ADVANCE') return false;
  const finance = natureWalkerFinanceSnapshot({ ...previous.finance, ...result.state,
    weeklyBudget: previous.finance.weeklyBudget, lifeTier: result.state.nextLifeTier });
  return event.week === previous.week + 1 && same(event.date, addGameWeeks(previous.date, 1)) && same(event.finance, finance) &&
    same(event.before, { ...previous.after, cash: result.state.cash, actions: previous.finance.weeklyBudget });
}
function acquisitionTitle(event: NatureWalkerAcquisitionEvent, state: NatureWalkerState): string {
  const command = event.command;
  if (command.type === 'BUY_POTION' && state.bottles.find(b => b.id === command.bottleId)?.recovery) return '同一原特性重配交付';
  if (command.type === 'POTION_WORK' && state.bottles.find(b => b.id === command.bottleId)?.recovery) return '同一原特性的新普通药物调配劳动';
  if (command.type === 'PREPARE_TASK') return NATURE_WALKER_PREPARATIONS.find(p => p.id === command.taskId)!.title;
  if (command.type === 'POTION_WORK') return NATURE_WALKER_LABOUR_TASKS[state.bottles.find(b => b.id === command.bottleId)!.labourSteps - 1]!;
  if (command.type === 'CONSUME') return event.check?.tier === 'GREAT_FAILURE' ? '自然行者魔药严重排异' : event.check?.tier === 'FAILURE' ? '自然行者魔药排异' : '实际成为自然行者';
  return ({ LEARN_GUIDANCE: '听取自然行者独立成品与专业准备指导', BUY_POTION: '自然行者独立原瓶实际交付',
    PREPARE_PROMOTION: '实际检查本周服药场地', LEAVE_PREPARATION: '沿原出口结束本次服药准备',
    REQUEST_RECOVERY_V1: '调查失败原瓶遗留的同一份特性', RECOVER_CHARACTERISTIC_V1: '原处回收封存同一份自然行者特性',
    REQUEST_SUPPLY: '实际申请下一批自然行者成品', RECEIVE_SUPPLY: '新的三瓶自然行者原瓶实际到货' } as const)[command.type];
}
export function natureWalkerAcquisitionBudget(s: SliceState): NatureWalkerAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: NatureWalkerState) {
  return { guidanceKnown: state.guidanceKnown, sourceWeek: state.sourceWeek, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, barrenMatriarchActingAtPromotion: state.barrenMatriarchActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyNatureWalkerAcquisition(s: SliceState, command: NatureWalkerAcquisitionCommand, ctx: SeerContext): void {
  const reason = natureWalkerAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = natureWalkerAcquisitionBudget(s), actor: NatureWalkerAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'mother',
    barrenMatriarchPromotionWeek: s.barrenMatriarch.promotionWeek!, cultivatorPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  const recoverySite = recoverySiteReceipt(s, command);
  applyAcquisitionMutation(s, command, recording);
  s.natureWalker.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: natureWalkerAcquisitionBudget(s), finance: natureWalkerFinanceSnapshot(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result, ...(recoverySite ? { recoverySite } : {}) });
}
function validAcquisitionBudget(v: unknown): v is NatureWalkerAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? NATURE_WALKER_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateNatureWalkerAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.natureWalker.acquisitionJournal, expected = createNatureWalkerState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    if (s.schemaVersion < NATURE_WALKER_RECOVERY_SCHEMA_VERSION && (s.natureWalker.resupply.recovery || s.natureWalker.bottles.some(b => b.recovery) || journal.some(e => recoveryCommand(e.command) || Object.hasOwn(e, 'recoverySite')))) return false;
    let previous: NatureWalkerAcquisitionEvent | null = null, nextCursor = s.natureWalker.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !integer(raw.week, s.barrenMatriarch.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAcquisitionCommand(raw.command, true) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || !validFinance(raw.finance, raw.week) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'barrenMatriarchPromotionWeek', 'cultivatorPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'mother' || raw.actor.barrenMatriarchPromotionWeek !== s.barrenMatriarch.promotionWeek || raw.actor.cultivatorPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as NatureWalkerAcquisitionEvent;
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
      const shadow: SliceState = { ...s, ...(s.natureWalker.sourceHistory ? structuredClone(s.natureWalker.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.natureWalker.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        ...structuredClone(event.finance), world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'mother', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, natureWalker: expected };
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
      expected.acquisitionJournal.push(event);
      if (!same(natureWalkerAcquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.natureWalker))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isNatureWalker(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.natureWalker.preparedWeek !== null && (!same(natureWalkerAcquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (s.revision === previous.revision + 1 && s.natureWalker.preparedWeek === null &&
        !natureWalkerCompletedBudgetMatches(s, previous.after, previous.finance, previous.week, previous.date,
          s.revision, previous.cursorAfter, acquisitionTitle(previous, s.natureWalker))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(natureWalkerAcquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isNatureWalker(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !NATURE_WALKER_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.natureWalker.barrenMatriarchActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.natureWalker.guidanceKnown || isNatureWalker(s)) return false;
    return true;
  } catch { return false; }
}

/** Lineage-only view of genuine acquisition receipts; source admission separately verifies historical state and random evidence. */
export function resolveNatureWalkerOriginalsSnapshot(snapshot: Pick<NatureWalkerState, 'bottles' | 'acquisitionJournal' | 'resupply'>): NatureWalkerOriginalCharacteristics | null {
  try {
    if (!record(snapshot) || !Array.isArray(snapshot.bottles) || !Array.isArray(snapshot.acquisitionJournal) || snapshot.acquisitionJournal.length > 10000 || !record(snapshot.resupply)) return null;
    const expected = createNatureWalkerState(); let previous: NatureWalkerAcquisitionEvent | null = null;
    for (const raw of snapshot.acquisitionJournal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !validateAcquisitionCommand(raw.command, true) || !validFinance(raw.finance, raw.week as number) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !integer(raw.week, 1) || !integer(raw.revision) || !isValidGameDate(raw.date) || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'barrenMatriarchPromotionWeek', 'cultivatorPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || !integer(raw.actor.age, 1) ||
        !integer(raw.actor.cultivatorPromotionWeek, 1, raw.actor.barrenMatriarchPromotionWeek as number) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'mother' || raw.actor.gender !== raw.before.gender || !integer(raw.actor.barrenMatriarchPromotionWeek, 1, raw.week) ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceIdentityDigest)) return null;
      const e = raw as unknown as NatureWalkerAcquisitionEvent, c = e.command, budget = structuredClone(e.before);
      if (!validRecoverySite(e, expected)) return null;
      if (!integer(e.cursorBefore, previous?.cursorAfter ?? 0) || e.cursorAfter !== e.cursorBefore + (c.type === 'CONSUME' ? 1 : 0) ||
          c.type === 'CONSUME' && (e.randomBefore !== e.cursorBefore || e.randomAfter !== e.cursorAfter)) return null;
      if (previous && (e.revision <= previous.revision || e.week < previous.week || compareGameDates(e.date, previous.date) < 0 || previous.after.sequence === 1 ||
        e.actor.sourceIdentityDigest !== previous.actor.sourceIdentityDigest || e.actor.name !== previous.actor.name || e.actor.gender !== previous.actor.gender || e.actor.age !== previous.actor.age ||
        e.actor.barrenMatriarchPromotionWeek !== previous.actor.barrenMatriarchPromotionWeek || e.actor.cultivatorPromotionWeek !== previous.actor.cultivatorPromotionWeek ||
        INHERITED_ABILITY_IDS.some(id => e.before.mastery[id] !== previous!.after.mastery[id]) || !same(e.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources) ||
        expected.preparedWeek !== null && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after) || !same(e.finance, previous.finance)) ||
        e.revision === previous.revision + 1 && !adjacentAcquisitionMatches(previous, e))) return null;
      if (e.after.gender !== e.before.gender || e.actor.sourceHistoryDigest !== null && e.actor.sourceHistoryDigest !== (previous ? expected.acquisitionJournal[0]!.actor.sourceHistoryDigest : e.actor.sourceHistoryDigest)) return null;
      if (expected.preparedWeek !== null && !['CONSUME', 'LEAVE_PREPARATION'].includes(c.type)) return null;
      if (c.type !== 'LEARN_GUIDANCE' && !expected.guidanceKnown) return null;
      if (c.type === 'LEARN_GUIDANCE') {
        if (expected.guidanceKnown) return null;
        expected.guidanceKnown = true; expected.sourceWeek = e.week; budget.actions--; budget.cash -= natureWalkerPrices().guidance;
        expected.bottles.forEach((b, i) => { b.stockedWeek = e.week; b.source = natureWalkerPotionSource(i + 1, e.week); });
      } else if (c.type === 'PREPARE_TASK') {
        if (expected.preparations.some(p => p.taskId === c.taskId)) return null;
        expected.preparations.push({ taskId: c.taskId, completedWeek: e.week }); budget.actions--;
      } else if (c.type === 'PREPARE_PROMOTION') {
        if (expected.resupply.recovery || expected.preparations.length !== 3 || !expected.bottles.some(b => b.status === 'PLAYER') ||
          budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 || e.week < e.actor.barrenMatriarchPromotionWeek + NATURE_WALKER_MIN_BARREN_MATRIARCH_WEEKS) return null;
        expected.preparedWeek = e.week; budget.actions--; budget.cash -= natureWalkerPrices().preparation;
      } else if (c.type === 'LEAVE_PREPARATION') {
        if (expected.preparedWeek === null) return null; expected.preparedWeek = null;
      } else if (c.type === 'REQUEST_SUPPLY') {
        // A pending archived commission may be superseded by the explicit paid investigation.
        if (!exhaustedSupply(expected) || expected.resupply.requestedWeek !== null || expected.bottles.some(b => b.recovery) || expected.acquisitionJournal.some(j => recoveryCommand(j.command))) return null;
        budget.actions--; budget.cash -= natureWalkerPrices().resupply; expected.resupply.requestedWeek = e.week;
      } else if (c.type === 'RECEIVE_SUPPLY') return null; // A fourth independent original is a conservation conflict.
      else if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
        const source = recoverySource(expected, c.bottleId), pending = expected.resupply.recovery;
        if (!originalSupplyFailed(expected) || !source) return null;
        budget.actions--;
        if (c.type === 'REQUEST_RECOVERY_V1') {
          if (pending) return null; budget.cash -= NATURE_WALKER_RECOVERY_PRICES.recovery; expected.resupply.requestedWeek = e.week;
          expected.resupply.recovery = { version: 1, sourceBottleId: c.bottleId, originalBottleId: source.originalBottleId, characteristicId: source.characteristicId, requestedWeek: e.week, sourceReceiptRevision: source.receipt.revision, siteId: NATURE_WALKER_RECOVERY_SITE_ID, custodian: 'MO229-NATURE-WALKER-SUPPLIER' as const };
        } else {
          if (!pending || pending.sourceBottleId !== c.bottleId || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || e.week <= pending.requestedWeek || pending.requestedWeek !== expected.resupply.requestedWeek || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== NATURE_WALKER_RECOVERY_SITE_ID || pending.custodian !== 'MO229-NATURE-WALKER-SUPPLIER') return null;
          const recovery = { ...pending, recoveredWeek: e.week }, id = recoveryBottleId(expected);
          budget.cash -= NATURE_WALKER_RECOVERY_PRICES.recoveryHandover;
          expected.bottles.push({ ...freshBottle(id, recoverySourceText(id, recovery, e.week), e.week), recovery });
          expected.resupply.deliveries++; expected.resupply.requestedWeek = null; delete expected.resupply.recovery;
        }
      } else {
        if (!('bottleId' in c)) return null;
        const bottle = expected.bottles.find(b => b.id === c.bottleId); if (!bottle) return null;
        if (c.type === 'POTION_WORK') {
          if (bottle.status !== 'SUPPLIER' || bottle.labourSteps >= NATURE_WALKER_LABOUR_STEPS) return null;
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
            expected.promotionWeek = e.week; expected.barrenMatriarchActingAtPromotion = budget.acting; budget.sequence = 1; budget.acting = 0;
            budget.mind = Math.max(1, budget.mind - (e.check.tier === 'GREAT_SUCCESS' ? 8 : 15));
            if (!budget.completedSources.includes('mother-s1')) budget.completedSources.push('mother-s1');
            for (const id of NATURE_WALKER_ABILITY_IDS) budget.mastery[id] = 0;
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
    const characteristics: NatureWalkerOriginalCharacteristics['characteristics'] = [];
    for (const id of NATURE_WALKER_BOTTLE_IDS) {
      const attempts = expected.bottles.filter(b => originalBottleId(expected, b) === id), latest = attempts.at(-1);
      if (!latest || attempts[0]!.id !== id) return null;
      characteristics.push({ characteristicId: characteristicId(id), originalBottleId: id, latestBottleId: latest.id,
        holder: latest.status === 'CONSUMED' ? success(latest.outcome) ? 'EMBODIED' : 'FAILED_REMNANT' : latest.status,
        consumptionHistory: expected.acquisitionJournal.filter(e => { const c = e.command; return c.type === 'CONSUME' && attempts.some(b => b.id === c.bottleId); }).map(e => ({ bottleId: (e.command as Extract<NatureWalkerAcquisitionCommand, { type: 'CONSUME' }>).bottleId, revision: e.revision, week: e.week, outcome: e.check!.tier })) });
    }
    const embodied = characteristics.filter(c => c.holder === 'EMBODIED');
    if (embodied.length > 1 || (expected.promotionWeek !== null) !== (embodied.length === 1)) return null;
    return { characteristics, embodiedOriginalBottleId: embodied[0]?.originalBottleId ?? null, embodiedBottleId: embodied[0]?.latestBottleId ?? null };
  } catch { return null; }
}

/** Read-only conservation view. Full acquisition validation owns the original
 * source, identity and RNG before the same snapshot custody replay is used. */
export function resolveNatureWalkerOriginals(s: SliceState): NatureWalkerOriginalCharacteristics | null {
  return validateNatureWalkerState(s) ? resolveNatureWalkerOriginalsSnapshot(s.natureWalker) : null;
}

export function applyNatureWalkerCommand(s: SliceState, command: NatureWalkerCommand, ctx: SeerContext): void {
  if (!validateNatureWalkerCommand(command)) throw new Error('自然行者命令无效。');
  if (validateNatureWalkerAcquisitionCommand(command)) return applyNatureWalkerAcquisition(s, command, ctx);
  if (validateNatureWalkerActivityCommand(command)) return applyNatureWalkerLifeCommand(s, command, ctx);
  if (validateNatureWalkerEncounterCommand(command)) return applyNatureWalkerEncounterCommand(s, command, ctx);
  throw new Error('未知自然行者命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function natureWalkerAcquisitionActions(s: SliceState): NatureWalkerAction[] {
  if (!knownChannel(s) || isNatureWalker(s)) return [];
  const state = s.natureWalker, prices = natureWalkerPrices(), actions: NatureWalkerAction[] = [];
  const add = (id: string, label: string, cost: string, command: NatureWalkerAcquisitionCommand) => {
    const reason = natureWalkerAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-natureWalker-guidance', '听取自然行者成品与专业准备指导', `1行动 · ${prices.guidance}便士`, { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of NATURE_WALKER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`natureWalker-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-natureWalker-promotion', '实际检查本次服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
    else add('leave-natureWalker-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.recovery) add('recover-nature-walker-characteristic', `原处交接${state.resupply.recovery.characteristicId}`, `1行动 · 30便士 · 最早第${state.resupply.recovery.requestedWeek + 1}周 · 新药另付`, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: state.resupply.recovery.sourceBottleId });
    else if (originalSupplyFailed(state)) for (const bottle of state.bottles) if (recoverySource(state, bottle.id)) add(`request-recovery-${bottle.id}`, `调查并封存${bottle.id}的同一原特性`, '1行动 · 120便士 · 核验归属位置 · 隔周当面交接 · 旧费用不退', { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < NATURE_WALKER_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${bottle.recovery ? `同一原特性重配第${bottle.labourSteps + 1}项劳动` : NATURE_WALKER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${bottle.recovery ? 810 : prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}${bottle.recovery ? '次同原特性重配药' : '瓶自然行者魔药'}`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') {
        add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}${bottle.recovery ? '次同原特性重配药' : '瓶自然行者魔药'}`, `0行动 · 荒芜主母消化${s.progression.acting}/100 · ${barrenMatriarchWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  return actions;
}
function preferredNatureWalkerAction(s: SliceState, actions: NatureWalkerAction[]): NatureWalkerAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectNatureWalkerLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectNatureWalker(s: SliceState): NatureWalkerProjection {
  const state = s.natureWalker, available = knownChannel(s), promoted = isNatureWalker(s), prices = natureWalkerPrices();
  const currentSite = promoted && state.life.site ? state.life.site : s.coffinBearer.life;
  const actions = available ? [...natureWalkerAcquisitionActions(s), ...natureWalkerLifeActions(s), ...natureWalkerEncounterActions(s)] : [];
  const preferred = preferredNatureWalkerAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '自然行者·母亲序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceLabel: available ? natureWalkerSourceLabel() : '', prices: available ? prices : null,
    formulaKnown: false, formula: [], ...(available ? { story: `${NATURE_WALKER_FORMULA_STATUS}${NATURE_WALKER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶${prices.potion}便士，或为本瓶完成五项真实劳动后支付${prices.labourBalance}便士；最初三瓶全部失败后可调查同一原特性，隔周付费交接；新普通药物900便士，或五项新劳动后90便士。当周场地检查另付180便士，不增加第四份原特性。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成荒芜主母的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}${b.recovery ? '次同原特性重配药' : '瓶 · 自然行者成品魔药'}`, source: `${b.source.replaceAll(b.id, `第${bottleNumber(b)}号`)}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为荒芜主母' : '排异，仍为荒芜主母'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? NATURE_WALKER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: available ? [...NATURE_WALKER_INHERITED_ABILITIES, ...(promoted ? NATURE_WALKER_ABILITIES : [])].map(a => ({ id: a.id, label: a.label, description: a.description, mastery: s.progression.mastery[a.id]! })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `荒芜主母消化${state.barrenMatriarchActingAtPromotion}/100留存；自然行者扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `荒芜主母需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${barrenMatriarchWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成荒芜主母的实际经历。',
    pollution: s.seer.pollution, risk: available ? NATURE_WALKER_CURRENT_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? `同一原匣、原牌、原纸、两株原活苗和原枯样保留真实持有人与位置。本人唯一原根垫当前完整度${promoted && state.life.rootPad ? state.life.rootPad.integrity : s.barrenMatriarch.life.rootPad.integrity}/65，晋升不修复；旧护腕已耗${currentSite.guard.segments.filter(segment => segment.status === 'SPENT').length}段、未用${currentSite.guard.segments.filter(segment => segment.status === 'UNUSED').length}段，只从同一实物继续耗用。近旁两处新标记和有限支撑片须另行支付、实际设置。` : '',
    inheritedHistory: available ? [
      `荒芜主母在第${s.barrenMatriarch.promotionWeek}周实际晋升；${promoted ? `原消化${state.barrenMatriarchActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从这次晋升计算。`,
      '前八阶15项掌握保持原值，原零项不补齐；成功晋升只增加两项零掌握。',
      `开始本阶准备时，本人已在原现场实际步行${natureWalkerOriginals(s).site.playerTravelMetres}米，现场时间${natureWalkerOriginals(s).site.clockSeconds}秒；艾达与莉娜在室外，同一原活苗、原枯样、原匣、原牌和原纸均按真实持有人交存。`,
      '原诺兰与马丁的投降、伤势、生死、旧现场和旧原物去向保留。新的独立遭遇不重开旧战斗；性别不会再改变。',
    ] : [],
    life: projectNatureWalkerLife(s), encounter: projectNatureWalkerEncounter(s), insideCase: hasNatureWalkerLock(s),
    environment: available ? NATURE_WALKER_SOURCE_STATUS : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateNatureWalkerJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.natureWalker.acquisitionJournal;
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
    type SharedBudget = Pick<NatureWalkerAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null; maxDraws?: number };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.natureWalker.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor, maxDraws: 1 });
    }
    const encounter = s.natureWalker.encounter, preparation = encounter.preparation;
    const reflection = s.natureWalker.life.journal.find(event => event.command.type === 'REFLECT');
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
        if (!integer(event.randomBefore, cursor, s.random.cursor) || !integer(event.randomAfter, event.randomBefore + 1, event.randomBefore + (event.maxDraws ?? 1)) || !integer(event.randomAfter, 0, s.random.cursor) || exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (!same(s.date, tail.date) || !same(shared(natureWalkerAcquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** All eight predecessor roots remain exact. The separately cloned new site
 * and inventory are the only live continuation after promotion. */
export function validateNatureWalkerSource(s: SliceState): boolean {
  try {
    const state = s.natureWalker, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, NATURE_WALKER_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city', 'finance']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !shape(scene.originals, ['site', 'operation', 'rootPad']) || !sourceClosed(scene.originals) || !validFinance(scene.finance, scene.week) || !same(scene.finance, first.finance) ||
      !same(scene.originals, natureWalkerOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const historical = natureWalkerInheritedView(s);
    if (![validateCultivatorState, validatePhysicianState, validateHarvestpriestState, validateBiologistState, validateDruidState,
      validateAncientAlchemistState, validateCoffinBearerState, validateBarrenMatriarchState].every(validate => validate(historical))) return false;
    return same(natureWalkerSourceHistory(s), history) && same(natureWalkerOriginals(s), scene.originals);

  } catch { return false; }
}

export const validateNatureWalkerInheritedState = validateNatureWalkerSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function natureWalkerInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.natureWalker;
  if ((!isNatureWalker(s) && !isNatureWalkerAcquisitionStage(s)) || !s.natureWalker.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
    ...structuredClone(scene.finance), world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'mother', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), natureWalker: createNatureWalkerState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateNatureWalkerState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  if (s.progression.pathwayId === 'mother' && (s.progression.sequence as number | null) === 0) return false;
  const raw: unknown = s.natureWalker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'sourceWeek', 'bottles', 'resupply', 'promotionWeek', 'barrenMatriarchActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries', ...(Object.hasOwn(raw.resupply, 'recovery') ? ['recovery'] : [])]) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as NatureWalkerState, promoted = isNatureWalker(s), acquisitionStage = isNatureWalkerAcquisitionStage(s);
  const recoveryDeliveries = state.bottles.filter(b => record(b) && Object.hasOwn(b, 'recovery')).length;
  const legacyDeliveries = state.resupply.deliveries - recoveryDeliveries;
  if (!integer(legacyDeliveries) || state.bottles.length !== 3 + legacyDeliveries * 3 + recoveryDeliveries) return false;
  const validRecovery = (r: unknown, recovered: boolean): r is NatureWalkerRecoveryRequest => record(r) &&
    shape(r, ['version', 'sourceBottleId', 'originalBottleId', 'characteristicId', 'requestedWeek', 'sourceReceiptRevision', 'siteId', 'custodian', ...(recovered ? ['recoveredWeek'] : [])]) &&
    r.version === 1 && integer(r.sourceReceiptRevision) && r.siteId === NATURE_WALKER_RECOVERY_SITE_ID && r.custodian === 'MO229-NATURE-WALKER-SUPPLIER' && typeof r.sourceBottleId === 'string' && /^nature-walker-(?:potion|recovery)-[1-9]\d{0,14}$/.test(r.sourceBottleId) &&
    NATURE_WALKER_BOTTLE_IDS.includes(r.originalBottleId as typeof NATURE_WALKER_BOTTLE_IDS[number]) && r.characteristicId === characteristicId(String(r.originalBottleId)) &&
    integer(r.requestedWeek, s.barrenMatriarch.promotionWeek ?? s.week, s.week) && (!recovered || integer(r.recoveredWeek, r.requestedWeek + 1, s.week));
  if (Object.hasOwn(state.resupply, 'recovery') && !validRecovery(state.resupply.recovery, false)) return false;
  if ((promoted || acquisitionStage) && !validFinance(natureWalkerFinanceSnapshot(s), s.week)) return false;
  const firstWeek = s.barrenMatriarch.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + NATURE_WALKER_MIN_BARREN_MATRIARCH_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateNatureWalkerSource(s) || !integer(state.sourceWeek, firstWeek, lastAcquisitionWeek))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null || state.sourceWeek !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > NATURE_WALKER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !NATURE_WALKER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasNatureWalkerOldPractice(s) || hasNatureWalkerLifeLock(s) || hasNatureWalkerEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.barrenMatriarch.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.barrenMatriarchActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !barrenMatriarchReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...NATURE_WALKER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.barrenMatriarchActingAtPromotion !== null || NATURE_WALKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome', ...(Object.hasOwn(b, 'recovery') ? ['recovery'] : [])]) || b.id !== (b.recovery ? `nature-walker-recovery-${state.bottles.slice(0, index).filter(previous => previous.recovery).length + 1}` : `nature-walker-potion-${index + 1}`) || !integer(b.labourSteps, 0, NATURE_WALKER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < NATURE_WALKER_BOTTLE_IDS.length) {
      if (Object.hasOwn(b, 'recovery')) return false;
      if (state.guidanceKnown ? b.stockedWeek !== state.sourceWeek || b.source !== natureWalkerPotionSource(index + 1, state.sourceWeek!) : b.stockedWeek !== null || b.source !== NATURE_WALKER_POTION_SOURCES[index]!.source) return false;
    } else if (b.recovery) {
      if (!validRecovery(b.recovery, true) || !state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.recovery.recoveredWeek !== b.stockedWeek || b.source !== recoverySourceText(b.id, b.recovery, b.stockedWeek) || !originalBottleId(state, b)) return false;
      const prefix = { ...state, bottles: state.bottles.slice(0, index) };
      const source = recoverySource(prefix, b.recovery.sourceBottleId);
      if (!originalSupplyFailed(prefix) || !source || source.originalBottleId !== b.recovery.originalBottleId || source.characteristicId !== b.recovery.characteristicId || source.receipt.revision !== b.recovery.sourceReceiptRevision || source.bottle.consumedWeek! > b.recovery.requestedWeek) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(s, index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % NATURE_WALKER_BOTTLE_IDS.length;
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
        if (!integer(s.barrenMatriarch.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !(state.resupply.recovery ? originalSupplyFailed(state) : exhaustedSupply(state)))) return false;
  if (state.resupply.recovery) {
    const pending = state.resupply.recovery, source = recoverySource(state, pending.sourceBottleId);
    if (!source || pending.requestedWeek !== state.resupply.requestedWeek || pending.originalBottleId !== source.originalBottleId || pending.characteristicId !== source.characteristicId || pending.sourceReceiptRevision !== source.receipt.revision || pending.siteId !== NATURE_WALKER_RECOVERY_SITE_ID || pending.custodian !== 'MO229-NATURE-WALKER-SUPPLIER' || source.bottle.consumedWeek! > pending.requestedWeek) return false;
  } else if (state.resupply.requestedWeek !== null && state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!)) return false;
  if (successes !== (promoted ? 1 : 0) || !validateNatureWalkerAcquisitionJournal(s) || !validateNatureWalkerJournalContinuity(s) || !validateNatureWalkerLifeState(s) || !validateNatureWalkerEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('mother-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(natureWalkerLifeMasteryGains(s))) {
      if (!NATURE_WALKER_ABILITY_IDS.includes(id as typeof NATURE_WALKER_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.natureWalkerOutcome) {
      for (const action of [...round.natureWalkerOutcome.playerActions, ...round.natureWalkerOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('mother-s1')) return false;
  return true;
}
export { NATURE_WALKER_ABILITIES } from './content.js';
export { NATURE_WALKER_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleNatureWalker = applyNatureWalkerCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateNatureWalkerHistory = validateNatureWalkerState;
