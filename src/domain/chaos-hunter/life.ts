import { validateBalancerSourceChaosHunterLife } from '../balancer/life.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasChaosHunterOldPractice, hasChaosHunterRitualLock } from './index.js';

export const CHAOS_HUNTER_CASE_IDS = ['paired-line', 'withdrawn-line', 'own-line'] as const;
export type ChaosHunterCaseId = typeof CHAOS_HUNTER_CASE_IDS[number];
export type ChaosHunterLocation = 'START' | 'A' | 'B' | 'OUTSIDE';
export type ChaosHunterConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'ORDINARY';
type SceneType = 'GO_A' | 'CHECK_OBJECT' | 'PERFORM' | 'ORDINARY_CHECK' | 'TRY_PLAYER' | 'TRY_PARTNER' | 'READ_RESULT' | 'STOP_RULE' | 'WAIT_EFFECT' | 'WITHDRAW_CONSENT' | 'RETURN_PERSON' | 'WALK_B' | 'TAKE_OBJECT' | 'RETURN_A' | 'RETURN_OBJECT' | 'RECORD_OUTCOME' | 'RETURN_START';
export type ChaosHunterActivityCommand =
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | 'WITHDRAW' | SceneType; caseId: ChaosHunterCaseId }
  | { type: 'PREPARE'; caseId: ChaosHunterCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONFIRM_LIMITED'; caseId: 'own-line'; claim: 'LIMITED' | 'GUARANTEED' }
  | { type: 'REFLECT' };
export interface ChaosHunterMovement { from: ChaosHunterLocation; to: ChaosHunterLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
export interface ChaosHunterEvidence { sourceId: string; text: string; atSecond: number }
export interface ChaosHunterLifeStep { type: SceneType | 'CONFIRM_LIMITED'; atSecond: number; check: PublicCheckResult | null; willing: boolean; claim: 'LIMITED' | 'GUARANTEED' | null }
export interface ChaosHunterAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; initialKnowledge: number; initialWilling: boolean;
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: ChaosHunterMovement[]; guideMoves: ChaosHunterMovement[]; personMoves: ChaosHunterMovement[]; objectMoves: ChaosHunterMovement[]; steps: ChaosHunterLifeStep[];
  resolutionPaid: boolean; resolutionActions: number; spiritualitySpent: number; mindSpent: number;
  objectChecked: boolean; consent: ChaosHunterConsent; consentWithdrawn: boolean; selfConsent: boolean; expressedAction: 'WALK_A_TO_B' | null;
  abilityCheck: PublicCheckResult | null; abilityTier: PublicResolutionTier | null; abilitySourceId: string | null; abilityAtSecond: number | null;
  ruleActive: boolean; stopped: boolean; pendingRemainingSeconds: number; ruleCancelled: boolean; ruleExpired: boolean; waitedSeconds: number; waitCompleted: boolean;
  playerAttempted: boolean; partnerAttempted: boolean; playerResult: 'A' | 'B' | null; partnerResult: 'A' | 'B' | null;
  playerBlocked: boolean; partnerBlocked: boolean; playerAtSecond: number | null; partnerAtSecond: number | null;
  resultRead: boolean; paperRead: boolean; objectTaken: boolean; limitedConfirmed: boolean; rejectedClaims: number; objectsReturned: boolean; ordinaryChecked: boolean;
  evidence: ChaosHunterEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface ChaosHunterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: ChaosHunterAttempt[];
}
export interface ChaosHunterLifeState {
  siteId: 'CH3-LINE-PRACTICE'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: ChaosHunterCaseId | null;
  playerLocation: ChaosHunterLocation; playerTravelMetres: number; guideTravelMetres: number; clockSeconds: number;
  guide: { id: 'GUIDE'; name: '薇娜·贝尔'; location: ChaosHunterLocation };
  volunteer: { id: 'CH3-MIRA'; name: '米拉·佩恩'; age: 43; alive: true; independentMind: true; willing: boolean; location: 'A' | 'B' | 'OUTSIDE'; health: 100; mind: 100; injuries: [] };
  parcel: { id: 'CH3-PARCEL'; owner: 'GUIDE'; quantity: 1; massGrams: 350; sealed: true; confidential: false; holder: 'GUIDE' | 'TABLE' | 'PLAYER'; location: ChaosHunterLocation; handovers: number; returns: number };
  line: { id: 'CH3-LINE'; owner: 'GUIDE'; quantity: 1; holder: 'GUIDE' | 'FLOOR'; location: 'START' | 'A' | 'OUTSIDE'; isWall: false; returns: number };
  paper: { id: 'CH3-RULE-PAPER'; owner: 'GUIDE'; quantity: 1; holder: 'GUIDE' | 'PLAYER' | 'TABLE'; location: ChaosHunterLocation; text: '本次从A到B的越线' };
  table: { id: 'CH3-TABLE-B'; location: 'B'; thirdParties: 0 };
  cases: Record<ChaosHunterCaseId, ChaosHunterCaseState>; reflected: boolean;
}
export interface ChaosHunterLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosHunterActivityCommand }
export interface ChaosHunterLifeProjection extends Omit<ChaosHunterLifeState, 'cases'> {
  title: string; story: string; summary: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: ChaosHunterAttempt | null;
  cases: { id: ChaosHunterCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ChaosHunterAttempt[] }[];
  actions: ChaosHunterLifeAction[];
}
const ABILITY = 'justiciar.s3.bounded-order' as const;
export const CHAOS_HUNTER_LIFE_STORY = '序列3混乱猎手名称编号有原著直接依据；完整配方、晋升仪式和本阶新增通用机制仍未知。以下三场、双方各一次A到B试走、20秒和全部数值为本作原创G有限规则。标条不是墙；本人也受同一规则，不能自动豁免。固定合作演练没有额外随机抵抗，不意味着真实敌人必服；不改纸、不追改过去、不鉴定罪恶、不强迫真话或永久同意，不使用幸运或天使权能。';
export const CHAOS_HUNTER_LIFE_ENVIRONMENT = '原净空标线演练房，START到A4米、A到B4米，B只有空桌和唯一350克原包，通路无旁人。原薇娜亲携原包从A走到B放下，再走回A。各案观察、准备、实施、报告各1行动，三案加反思共13行动；能力实付5灵性2精神、知识20四档一次，成功只预备20秒，每人随后独立尝试一次；每次尝试1秒，普通走到B另4秒4米。普通不检定不耗灵性精神。停止、撤回、过期和失败不退费；归还原包、原纸、原标条和实际走回START均0行动。成功实际拦停的配对案或本人案报告掌握+8，撤回案始终0。';
const CASES = [
  { id: 'paired-line', title: 'G · 同一标线同时约束双方', story: '43岁米拉与本人分别同意本次有限规则。唯一原包已由薇娜亲放B桌，同一原纸永久写“本次从A到B的越线”。施术后两人分别亲身试走，各一次且顺序任意；成功有效时各自在A止步，否则各自普通走4米至B。核实际位置与原纸后停止规则，再由本人亲取原包、真实归还和离场。' },
  { id: 'withdrawn-line', title: 'G · 当前许可撤回，原身体普通行走', story: '米拉在本次付费施术后立即撤回规则许可。必须先停止未用规则，才由两人按当前普通意愿分别走4米至B。已付费用、原检定与撤回记录保留，不得因曾经同意而继续控制，不奖掌握。米拉自主回A，玩家不随她自动移动，仍须亲取原包、归还并真实离场。' },
  { id: 'own-line', title: 'G · 本人不能自动豁免', story: '米拉在A自愿看守，本案不参与试走、完全不受效果。本人明确自己受同一条有限规则，随后只亲身试走一次。成功止A，失败或普通已到B；停止后本人亲取原包、带回A交还原物，并承认仅有本次有限结论，不保证未来或追改过去。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'CHECK_OBJECT', 'PERFORM', 'ORDINARY_CHECK', 'TRY_PLAYER', 'TRY_PARTNER', 'READ_RESULT', 'STOP_RULE', 'WAIT_EFFECT', 'WITHDRAW_CONSENT', 'RETURN_PERSON', 'WALK_B', 'TAKE_OBJECT', 'RETURN_A', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 3;
const sourceFor = (id: ChaosHunterCaseId) => `chaos-hunter-life-${id}`;
const freshCase = (): ChaosHunterCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): ChaosHunterAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, initialKnowledge: s.character.coreStats.knowledge, initialWilling: s.chaosHunter.life.volunteer.willing,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], personMoves: [], objectMoves: [], steps: [], resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0,
    objectChecked: false, consent: 'UNASKED', consentWithdrawn: false, selfConsent: false, expressedAction: null, abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null,
    ruleActive: false, stopped: false, pendingRemainingSeconds: 0, ruleCancelled: false, ruleExpired: false, waitedSeconds: 0, waitCompleted: false,
    playerAttempted: false, partnerAttempted: false, playerResult: null, partnerResult: null, playerBlocked: false, partnerBlocked: false, playerAtSecond: null, partnerAtSecond: null,
    resultRead: false, paperRead: false, objectTaken: false, limitedConfirmed: false, rejectedClaims: 0, objectsReturned: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createChaosHunterLifeState(): ChaosHunterLifeState {
  return { siteId: 'CH3-LINE-PRACTICE', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, guideTravelMetres: 0, clockSeconds: 0,
    guide: { id: 'GUIDE', name: '薇娜·贝尔', location: 'START' }, volunteer: { id: 'CH3-MIRA', name: '米拉·佩恩', age: 43, alive: true, independentMind: true, willing: true, location: 'A', health: 100, mind: 100, injuries: [] },
    parcel: { id: 'CH3-PARCEL', owner: 'GUIDE', quantity: 1, massGrams: 350, sealed: true, confidential: false, holder: 'GUIDE', location: 'START', handovers: 0, returns: 0 },
    line: { id: 'CH3-LINE', owner: 'GUIDE', quantity: 1, holder: 'GUIDE', location: 'START', isWall: false, returns: 0 },
    paper: { id: 'CH3-RULE-PAPER', owner: 'GUIDE', quantity: 1, holder: 'GUIDE', location: 'START', text: '本次从A到B的越线' }, table: { id: 'CH3-TABLE-B', location: 'B', thirdParties: 0 },
    cases: { 'paired-line': freshCase(), 'withdrawn-line': freshCase(), 'own-line': freshCase() }, reflected: false };
}
export function validateChaosHunterActivityCommand(v: unknown): v is ChaosHunterActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!CHAOS_HUNTER_CASE_IDS.includes(v.caseId as ChaosHunterCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONFIRM_LIMITED') return v.caseId === 'own-line' && shape(v, ['type', 'caseId', 'claim']) && ['LIMITED', 'GUARANTEED'].includes(String(v.claim));
  if (!shape(v, ['type', 'caseId']) || ['TRY_PARTNER', 'RETURN_PERSON', 'WITHDRAW_CONSENT'].includes(v.type) && v.caseId === 'own-line') return false;
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', 'WITHDRAW', ...SCENES].includes(v.type);
}
export const currentChaosHunterAttempt = (s: SliceState) => s.chaosHunter.life.activeCase ? s.chaosHunter.life.cases[s.chaosHunter.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.chaosHunter.life, a = currentChaosHunterAttempt(s);
  if (a?.ruleActive || (a?.pendingRemainingSeconds ?? 0) > 0) return '须停止本次未用规则，已发生的止步或行走不回滚。';
  if (l.volunteer.location !== 'A' || l.parcel.holder !== 'GUIDE' || l.paper.holder !== 'GUIDE' || l.line.holder !== 'GUIDE') return '米拉须自主走回A；本人须亲取原包并当面归还原包、原纸及原标条。';
  return l.playerLocation !== 'START' || l.guide.location !== 'START' || l.parcel.location !== 'START' || l.paper.location !== 'START' || l.line.location !== 'START' ? '本人和薇娜须真正走回START，导引亲携全部原物。' : null;
}
export const hasChaosHunterLifeLock = (s: SliceState): boolean => {
  if (s.balancer?.life.source != null) {
    // Weekly settlement validates its final budget later; this lock only checks the inherited original scene.
    if (s.progression.pathwayId !== 'justiciar' || s.progression.sequence !== 2 || s.balancer.promotionWeek === null || s.balancer.chaosHunterActingAtPromotion !== 100) return true;
    const original = s.balancer.life.source.snapshot;
    const inherited = { ...s, progression: { ...s.progression, sequence: 3 as const, acting: s.balancer.chaosHunterActingAtPromotion }, chaosHunter: { ...s.chaosHunter, life: original } };
    if (!validateChaosHunterLifeOriginal(inherited)) return true;
    return original.activeCase !== null || Object.values(original.cases).some(r => r.status === 'PREPARED') || cleanupBlock(inherited) !== null;
  }
  return s.chaosHunter.life.activeCase !== null || Object.values(s.chaosHunter.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
};
const attemptsDone = (a: ChaosHunterAttempt, id: ChaosHunterCaseId) => a.playerAttempted && (id === 'own-line' || a.partnerAttempted);
function sceneReason(s: SliceState, id: ChaosHunterCaseId, type: SceneType | 'CONFIRM_LIMITED'): string | null {
  const l = s.chaosHunter.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation;
  if (type === 'STOP_RULE') return a.objectChecked && !a.stopped && (a.resolutionPaid || a.consentWithdrawn) ? null : '没有尚未停止的本次方案；停止不移动原身体或归还原物。';
  if (type === 'WITHDRAW_CONSENT') return a.objectChecked && a.consent === 'GRANTED' && !a.playerAttempted && !a.partnerAttempted ? null : '只可在双方尚未尝试前撤回当前一次许可；既发事实不能抹去。';
  if (type === 'WAIT_EFFECT') return a.ruleActive && a.pendingRemainingSeconds > 0 && !a.waitCompleted && !a.stopped && !a.consentWithdrawn ? null : '只可等待本次仍有的剩余效力，撤回后须立即停止；不能重复凭空推进时间。';
  if (type === 'RETURN_START') return at === 'A' && a.objectsReturned && a.outcomeRecorded && a.stopped && l.guide.location === 'A' ? null : '须先归还全部原物并如实记录，再由本人和薇娜普通返回START。';
  if (a.outcomeRecorded) return '本次已记录，只可实际离开；不能重做或重抽。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 && l.guide.location === 'START' ? null : '本人和薇娜只可从START到A一次，再由薇娜亲送原包去B并走回。';
  if (type === 'CHECK_OBJECT') return at === 'A' && !a.objectChecked && l.guide.location === 'A' && l.volunteer.location === 'A' && l.parcel.location === 'B' && l.parcel.holder === 'TABLE' && l.paper.holder === 'GUIDE' && l.line.location === 'A' ? null : '先实到A，确认米拉、B原包、当前许可、原标条和原纸。';
  if (type === 'PERFORM' || type === 'ORDINARY_CHECK') {
    if (a.resolutionPaid || !a.objectChecked || !a.selfConsent || at !== 'A') return '须在A核过原人原物和当前规则，且尚未付本次实施；失败不重抽。';
    if (s.actionsRemaining < 1) return '首次实施需要1行动；准备必须保留这一行动。';
    if (type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') return null;
    if (a.stopped || id !== 'own-line' && (a.consent !== 'GRANTED' || !l.volunteer.willing)) return '当前没有双方规则许可，可普通完成，不得再次索取或施术。';
    return s.spirituality < 5 ? '能力需要实际5灵性；可选择普通实施。' : s.mind < 2 ? '能力需要实际2精神；可选择普通实施。' : null;
  }
  if (type === 'TRY_PLAYER' || type === 'TRY_PARTNER') {
    if (!a.resolutionPaid || a.resultRead || type === 'TRY_PLAYER' && (a.playerAttempted || at !== 'A') || type === 'TRY_PARTNER' && (a.partnerAttempted || l.volunteer.location !== 'A')) return '须先实施；本人和米拉各只亲身尝试一次，不能重做已发生动作。';
    if (a.consentWithdrawn && !a.stopped) return '当前许可已经撤回，必须先STOP_RULE清除本次未用规则。';
    return null;
  }
  if (type === 'READ_RESULT') return attemptsDone(a, id) && !a.resultRead && l.paper.holder === 'PLAYER' && l.paper.location === at ? null : '须先完成本案每一位参与者的真实一次试走，亲核位置与随身原纸。';
  if (type === 'RETURN_PERSON') return a.resultRead && a.stopped && l.volunteer.location === 'B' ? null : '核过双方结果并停止规则后，由米拉本人自主走4米回A；玩家不随她自动移动。';
  if (type === 'WALK_B') return a.resultRead && a.stopped && at === 'A' && l.volunteer.location === 'A' && !a.objectTaken ? null : '停止规则且米拉已在A后，仍在A的本人才能普通走4米去B亲取原包。';
  if (type === 'TAKE_OBJECT') return a.resultRead && a.stopped && at === 'B' && l.volunteer.location === 'A' && l.parcel.location === 'B' && l.parcel.holder === 'TABLE' && !a.objectTaken ? null : '本人须在B原桌旁、米拉在A且规则停止，才能亲取唯一原包。';
  if (type === 'RETURN_A') return a.objectTaken && at === 'B' && l.parcel.holder === 'PLAYER' && l.parcel.location === at ? null : '须亲取原包，再由本人带同一原包和原纸走4米回A。';
  if (type === 'RETURN_OBJECT') return at === 'A' && a.resultRead && a.paperRead && a.objectTaken && !a.objectsReturned && a.stopped && !a.ruleActive && a.pendingRemainingSeconds === 0 && l.parcel.holder === 'PLAYER' && l.parcel.location === 'A' && l.paper.holder === 'PLAYER' && l.paper.location === 'A' && l.line.holder === 'FLOOR' && l.line.location === 'A' && l.guide.location === 'A' && l.volunteer.location === 'A' ? null : '本人、米拉、薇娜和同一原物须真正回A，再亲交原包、原纸并收起原标条。';
  if (type === 'CONFIRM_LIMITED') return at === 'A' && a.objectsReturned && !a.limitedConfirmed ? null : '先亲核结果、归还全部原物，再确认本人受同一规则且只能作有限结论。';
  if (type === 'RECORD_OUTCOME') return at === 'A' && a.objectsReturned && a.resolutionPaid && a.resultRead && attemptsDone(a, id) && a.stopped && (id !== 'own-line' || a.limitedConfirmed) ? null : '先完成真实试走、停止规则、归还原物，并确认本案所需有限结论。';
  return '本案不支持此动作。';
}
export function chaosHunterActivityReason(s: SliceState, c: ChaosHunterActivityCommand): string | null {
  if (!validateChaosHunterActivityCommand(c)) return '混乱猎手命令无效、字段多余或不属于本案。';
  if (!promoted(s)) return '先实际晋升混乱猎手序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '本人已死亡或周目结束，不能操作、复活或代办归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.chaosHunter.encounter.status)) return '先处理当前事件或战斗，同一本体不能在两处。';
  if (s.world.city !== 'BACKLUND') return '须实际回贝克兰德原净空演练房。';
  const l = s.chaosHunter.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只取消尚未开始的准备；已付不退，已开现场必须真实收束。';
  if (c.type === 'LEAVE_CASE') return r?.contactOpen && l.activeCase === c.caseId && r.attempts.at(-1)?.outcomeRecorded ? cleanupBlock(s) : '须真实归还、记录并走回START。';
  if (SCENES.includes(c.type as SceneType) || c.type === 'CONFIRM_LIMITED') return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType | 'CONFIRM_LIMITED') : '先START_CASE打开实际现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先处理本案当前规则、原身体、原物与实际返回。';
  if (Object.entries(l.cases).some(([id, item]) => item.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消当前准备。';
  if (hasChaosHunterOldPractice(s) || hasChaosHunterRitualLock(s)) return '先实际收束旧接触、原物、战斗与服药准备。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '新行动须有精神和1行动；已付现场的真实收束不额外收费。';
  if (c.type === 'REFLECT') return l.reflected ? '反思已完成。' : CHAOS_HUNTER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份实际报告。';
  if (!('caseId' in c) || !r || r.status === 'RESOLVED') return '本案报告已经完成。';
  const index = CHAOS_HUNTER_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[CHAOS_HUNTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一份真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '同一原案只观察一次。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原人原物和边界。' : s.actionsRemaining < 2 ? '准备需要1行动，并另留1行动首次实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先选择能力或普通准备。';
  return r.status === 'EXAMINED' && r.attempts.at(-1)?.outcomeRecorded && !r.contactOpen ? null : '须真正完成、归还及退出后才可报告。';
}
export const blockChaosHunterLife = chaosHunterActivityReason;
/** External 60-second combat rounds and four-second exits are backed by their original outcome/exit records. */
export function advanceChaosHunterClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.chaosHunter.life.clockSeconds + seconds)) throw new Error('原演练房累计时钟无效。');
  s.chaosHunter.life.clockSeconds += seconds;
}
export const advanceChaosHunterLifeClock = advanceChaosHunterClock;
function elapse(s: SliceState, a: ChaosHunterAttempt, seconds: number) {
  a.elapsedSeconds += seconds; advanceChaosHunterClock(s, seconds);
  if (a.pendingRemainingSeconds > 0) {
    a.pendingRemainingSeconds = Math.max(0, a.pendingRemainingSeconds - seconds);
    if (!a.pendingRemainingSeconds) { a.ruleActive = false; if (!a.stopped) a.ruleExpired = true; }
  }
}
const movement = (from: ChaosHunterLocation, to: ChaosHunterLocation, itemIds: string[]): ChaosHunterMovement => ({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds });
function playerMove(s: SliceState, a: ChaosHunterAttempt, to: ChaosHunterLocation) {
  const l = s.chaosHunter.life, ids = [...(l.paper.holder === 'PLAYER' ? [l.paper.id] : []), ...(l.parcel.holder === 'PLAYER' ? [l.parcel.id] : [])], m = movement(l.playerLocation, to, ids);
  a.playerMoves.push(m); if (ids.length) a.objectMoves.push(structuredClone(m)); l.playerLocation = to; a.playerTravelMetres += 4; l.playerTravelMetres += 4;
  if (l.paper.holder === 'PLAYER') l.paper.location = to; if (l.parcel.holder === 'PLAYER') l.parcel.location = to; elapse(s, a, 4);
}
function guideMove(s: SliceState, a: ChaosHunterAttempt, to: ChaosHunterLocation, ids: string[], concurrent = false) {
  const l = s.chaosHunter.life, m = movement(l.guide.location, to, ids); a.guideMoves.push(m); if (ids.length) a.objectMoves.push(structuredClone(m)); l.guide.location = to; l.guideTravelMetres += 4;
  if (ids.includes(l.parcel.id)) l.parcel.location = to;
  if (ids.includes(l.paper.id)) l.paper.location = to;
  if (ids.includes(l.line.id)) l.line.location = to as 'START' | 'A';
  if (!concurrent) elapse(s, a, 4);
}
function personMove(s: SliceState, a: ChaosHunterAttempt, to: 'A' | 'B') {
  const l = s.chaosHunter.life; a.personMoves.push(movement(l.volunteer.location, to, [])); l.volunteer.location = to; elapse(s, a, 4);
}
function startAttempt(s: SliceState, id: ChaosHunterCaseId) { const l = s.chaosHunter.life, r = l.cases[id]; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = id; }
function evidence(a: ChaosHunterAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function applyScene(s: SliceState, id: ChaosHunterCaseId, step: ChaosHunterLifeStep) {
  const l = s.chaosHunter.life, a = l.cases[id].attempts.at(-1)!; a.steps.push(structuredClone(step));
  switch (step.type) {
    case 'GO_A':
      guideMove(s, a, 'A', [l.parcel.id, l.paper.id, l.line.id], true); playerMove(s, a, 'A');
      guideMove(s, a, 'B', [l.parcel.id]); l.parcel.holder = 'TABLE'; l.parcel.handovers++; guideMove(s, a, 'A', []);
      evidence(a, l.parcel.id, '薇娜携原物与本人同行START至A4米，亲携同一350克原包再走4米去B放桌，并本人走4米回A；纸和标条留A。'); break;
    case 'CHECK_OBJECT':
      a.objectChecked = true; a.paperRead = true; a.selfConsent = true; a.expressedAction = 'WALK_A_TO_B'; l.paper.holder = 'PLAYER'; l.line.holder = 'FLOOR'; elapse(s, a, 2);
      a.consent = id === 'own-line' || a.method === 'ORDINARY' ? 'ORDINARY' : l.volunteer.willing ? 'GRANTED' : 'DECLINED';
      evidence(a, l.volunteer.id, id === 'own-line' ? '米拉本人自愿留A看守，不参与且不受效果；本人明确自己受同一有限规则，不自动豁免。' : `同一43岁米拉在A，当前规则许可${a.consent}；双方各明确下一次亲身普通A到B试走，许可随时可在尝试前撤回。`);
      evidence(a, l.paper.id, `亲读同一原纸永久文字“${l.paper.text}”；B仍是原包，A标条只是原物、并非墙，不改字不追改过去。`); break;
    case 'PERFORM': case 'ORDINARY_CHECK':
      s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions = 1; elapse(s, a, 2);
      if (step.type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') { a.ordinaryChecked = true; evidence(a, l.paper.id, '普通实施实付1行动，不检定不耗灵性精神，尚无人试走。'); break; }
      s.spirituality -= 5; s.mind -= 2; a.spiritualitySpent = 5; a.mindSpent = 2; a.abilityCheck = structuredClone(step.check); a.abilityTier = step.check!.tier;
      a.abilitySourceId = id === 'own-line' ? 'PLAYER_ORIGINAL' : 'PLAYER_AND_CH3-MIRA'; a.abilityAtSecond = a.elapsedSeconds;
      a.ruleActive = passed(a.abilityTier); a.pendingRemainingSeconds = a.ruleActive ? 20 : 0;
      if (id === 'withdrawn-line') { a.consent = 'REVOKED'; a.consentWithdrawn = true; l.volunteer.willing = false; evidence(a, l.volunteer.id, '米拉当场立即撤回本次规则许可，须先STOP_RULE，再依两人当前普通意愿试走；已付保留。'); }
      evidence(a, a.abilitySourceId, `知识20四档${a.abilityTier}，实付5灵性2精神；仅预备20秒内本案参与者各一次真实试走，尚未发生止步或移动。`); break;
    case 'WITHDRAW_CONSENT': a.consent = 'REVOKED'; a.consentWithdrawn = true; l.volunteer.willing = false; evidence(a, l.volunteer.id, '米拉在双方尝试前撤回本次许可，须停止规则；不会取消费用、复位身体或归还原物。'); break;
    case 'STOP_RULE':
      if (a.pendingRemainingSeconds > 0 && (!a.playerAttempted || id !== 'own-line' && !a.partnerAttempted)) a.ruleCancelled = true;
      a.ruleActive = false; a.pendingRemainingSeconds = 0; a.stopped = true; break;
    case 'WAIT_EFFECT': { const seconds = a.pendingRemainingSeconds; a.waitCompleted = true; a.waitedSeconds += seconds; elapse(s, a, seconds); break; }
    case 'TRY_PLAYER': case 'TRY_PARTNER': {
      const player = step.type === 'TRY_PLAYER', blocked = a.ruleActive && a.pendingRemainingSeconds > 0 && !a.stopped && !a.consentWithdrawn;
      elapse(s, a, 1);
      if (player) { a.playerAttempted = true; a.playerBlocked = blocked; a.playerResult = blocked ? 'A' : 'B'; if (!blocked) playerMove(s, a, 'B'); a.playerAtSecond = a.elapsedSeconds; }
      else { a.partnerAttempted = true; a.partnerBlocked = blocked; a.partnerResult = blocked ? 'A' : 'B'; if (!blocked) personMove(s, a, 'B'); a.partnerAtSecond = a.elapsedSeconds; }
      evidence(a, player ? 'PLAYER_ORIGINAL' : l.volunteer.id, `${player ? '本人' : '米拉本人'}仅尝试一次，实际用1秒${blocked ? '在A止步，身体未移动' : '再普通走4米4秒到B'}；不替另一人尝试，不额外随机抵抗，不改已发生结果。`); break;
    }
    case 'READ_RESULT': a.resultRead = true; elapse(s, a, 1); evidence(a, l.paper.id, `本人在${l.playerLocation}亲核本次位置：本人${a.playerResult}、米拉${id === 'own-line' ? '仍A且未参与' : a.partnerResult}；净空4米通路可见，随身原纸仍“${l.paper.text}”，不重做或遥取原包。`); break;
    case 'RETURN_PERSON': personMove(s, a, 'A'); evidence(a, l.volunteer.id, '米拉本人从B普通走4米4秒回A；玩家身体与原纸留在自己的原位置。'); break;
    case 'WALK_B': playerMove(s, a, 'B'); break;
    case 'TAKE_OBJECT': l.parcel.holder = 'PLAYER'; l.parcel.handovers++; a.objectTaken = true; elapse(s, a, 1); evidence(a, l.parcel.id, '本人在B原桌亲取唯一350克原包，不召回、不复制。'); break;
    case 'RETURN_A': playerMove(s, a, 'A'); break;
    case 'RETURN_OBJECT':
      l.parcel.holder = 'GUIDE'; l.parcel.handovers++; l.parcel.returns++; l.paper.holder = 'GUIDE'; l.line.holder = 'GUIDE'; l.line.returns++; a.objectsReturned = true; elapse(s, a, 2);
      evidence(a, l.parcel.id, '本人在A当面交原包和同一原纸给薇娜，收起同一原标条归GUIDE；米拉仍是A的独立本人，身体与既发结果未回滚。'); break;
    case 'CONFIRM_LIMITED': if (step.claim === 'GUARANTEED') a.rejectedClaims++; else a.limitedConfirmed = true; break;
    case 'RECORD_OUTCOME':
      a.outcomeRecorded = true; a.limitedConfirmed = true; a.result = id !== 'withdrawn-line' && !a.consentWithdrawn && (a.playerBlocked || a.partnerBlocked) ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result; elapse(s, a, 1);
      a.outcome = `检定${a.abilityTier ?? '未施术'}；本人真实一次试走${a.playerResult}，米拉${id === 'own-line' ? '未参与、留A' : `真实一次试走${a.partnerResult}`}；原纸永久“${l.paper.text}”。${a.result === 'ABILITY' ? '本次有限规则实际拦停，报告可获掌握' : a.consentWithdrawn ? '当前许可撤回，规则清除，无掌握' : '普通、失败、取消或过期，无掌握'}。原包、原纸、原标条亲交原主，已付不退，过去不重写，不保证未来。`; break;
    case 'RETURN_START': guideMove(s, a, 'START', [l.parcel.id, l.paper.id, l.line.id], true); playerMove(s, a, 'START'); break;
  }
}
export function applyChaosHunterActivity(s: SliceState, c: ChaosHunterActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = chaosHunterActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.chaosHunter.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('chaos-hunter-reflection'); ctx.note('G · 反思双方身体与当前许可', '三份真实报告后扮演+25。自己也受同一规则，当前许可撤回后立即停止；不改原纸、过去或全部旧六阶历史。'); return; }
  const r = l.cases[c.caseId], spec = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备实付1行动；${c.method === 'ABILITY' ? '实施另1行动5灵性2精神、知识20四档' : '普通实施另1行动，无灵性精神或检定'}。原身体与原物尚未移动，当前许可尚未取得。`); return; }
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消未开始的准备', '0行动，已付不退，原身体与原物原位保留；以后重新准备也不会退费。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, '0行动打开实际现场并锁住，本人与薇娜仍START，米拉仍A，原物仍由薇娜保管。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `${r.attempts[0]!.outcome} 报告扮演+25，${r.result === 'ABILITY' ? '实际拦停掌握+8' : '无能力掌握'}。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('真正离开原标线现场', '本人和薇娜已经普通走回START，原物由薇娜亲带，米拉在A仍有自主身体；未补资源或重置历史。'); return; }
  const check = c.type === 'PERFORM' && a.method === 'ABILITY' ? ctx.check('knowledge', 20) : null;
  applyScene(s, c.caseId, { type: c.type, atSecond: a.elapsedSeconds, check, willing: l.volunteer.willing, claim: c.type === 'CONFIRM_LIMITED' ? c.claim : null });
  ctx.note(`G · ${c.type}`, `${c.type === 'RECORD_OUTCOME' ? a.outcome : c.type === 'CONFIRM_LIMITED' && c.claim === 'GUARANTEED' ? '保证未来的主张被拒绝，不改变真实首次结果或重抽。' : '仅处理原身体、原物、当前许可与本次有限规则。'} 本人${l.playerLocation}，米拉${l.volunteer.location}；本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，剩余${a.pendingRemainingSeconds}秒。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人到A，薇娜亲送原包到B再回A', '0行动 · 本人4米、导师12米 · 实际12秒'], CHECK_OBJECT: ['核双方当前许可、原包、标条与同一原纸', '0行动 · 2秒'], PERFORM: ['实际实施本次有限方案', '1行动 · 能力5灵性2精神 · 知识20一次'], ORDINARY_CHECK: ['普通实施本次A到B试走', '首次1行动 · 无灵性精神 · 不检定'],
  TRY_PLAYER: ['本人亲身尝试越过同一标线一次', '0行动 · 尝试1秒 · 若行走另4米4秒'], TRY_PARTNER: ['由米拉本人亲身尝试一次', '0行动 · 尝试1秒 · 若行走另4米4秒'], READ_RESULT: ['亲核双方实际位置与随身原纸', '0行动 · 1秒'], STOP_RULE: ['停止未用规则，已发事实保持', '0行动0秒 · 已付不退'], WAIT_EFFECT: ['实际等完本次规则剩余时间', '0行动 · 只等待仍有的剩余秒数'], WITHDRAW_CONSENT: ['米拉撤回当前一次规则许可', '0行动 · 尝试前可撤回'],
  RETURN_PERSON: ['由米拉本人普通走回A', '0行动 · 4米4秒 · 玩家不移动'], WALK_B: ['本人普通走到B原桌取包', '0行动 · 4米4秒'], TAKE_OBJECT: ['本人在B亲取唯一350克原包', '0行动 · 1秒'], RETURN_A: ['本人携原包与原纸普通走回A', '0行动 · 4米4秒'], RETURN_OBJECT: ['亲交原包和原纸，收起原标条归主', '0行动 · 2秒'], RECORD_OUTCOME: ['如实记录双方动作与有限结论', '0行动 · 1秒'], RETURN_START: ['本人和薇娜携原物实走回START', '0行动 · 各4米4秒'],
};
export function chaosHunterLifeActions(s: SliceState): ChaosHunterLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.chaosHunter.life, actions: ChaosHunterLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: ChaosHunterActivityCommand) => { const reason = chaosHunterActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[CHAOS_HUNTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原身体、原物及边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备本次有限双方规则', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备完全普通试走', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案实际标线现场', '0行动', { type: 'START_CASE', caseId: id }); add(`${id}-withdraw`, '取消未开始的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of SCENES) {
        const c = { type, caseId: id } as ChaosHunterActivityCommand; if (!validateChaosHunterActivityCommand(c)) continue;
        const waitingAbility = type === 'PERFORM' && a.method === 'ABILITY' && a.objectChecked && !a.resolutionPaid;
        if (chaosHunterActivityReason(s, c) === null || waitingAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], type === 'PERFORM' && a.method === 'ORDINARY' ? '1行动 · 不检定不耗灵性精神' : LABELS[type][1], c);
      }
      if (id === 'own-line' && chaosHunterActivityReason(s, { type: 'CONFIRM_LIMITED', caseId: id, claim: 'LIMITED' }) === null) for (const claim of ['LIMITED', 'GUARANTEED'] as const) add(`${id}-${claim.toLowerCase()}`, claim === 'LIMITED' ? '承认本人也受规则且只有本次有限结论' : '声称自动豁免或保证未来（拒绝）', '0行动 · 不重抽', { type: 'CONFIRM_LIMITED', caseId: id, claim });
      if (cleanupBlock(s) === null && a.outcomeRecorded) add(`${id}-leave`, '关闭已经实际退出的现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告真实身体动作、许可和原物归还', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '实际拦停掌握+8' : '无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && CHAOS_HUNTER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('chaos-hunter-reflect', '反思双方同一规则与当前许可', '1行动 · 扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectChaosHunterLife(s: SliceState): ChaosHunterLifeProjection {
  const l = s.chaosHunter.life, a = currentChaosHunterAttempt(s), actions = chaosHunterLifeActions(s), inside = hasChaosHunterLifeLock(s);
  const next = actions.find(v => v.enabled && !['WITHDRAW', 'ORDINARY_CHECK', 'WAIT_EFFECT', 'WITHDRAW_CONSENT', 'STOP_RULE', 'CONFIRM_LIMITED'].includes(v.command.type)) ?? actions.find(v => v.enabled && v.command.type !== 'WAIT_EFFECT' && v.command.type !== 'WITHDRAW_CONSENT') ?? actions.find(v => v.enabled);
  const summary = `本人${l.playerLocation}，真实步行${l.playerTravelMetres}米；原薇娜${l.guide.location}，真实步行${l.guideTravelMetres}米；生命周期时钟${l.clockSeconds}秒。`;
  return { ...structuredClone(l), title: '混乱猎手 · 同一原标线与双方实际行动', story: CHAOS_HUNTER_LIFE_STORY, summary, environment: CHAOS_HUNTER_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : '三份有限报告完成，可以继续普通生活。',
    facts: [summary, `同一43岁米拉${l.volunteer.id}在${l.volunteer.location}，H100/M100、独立心智和身体不变；当前规则意愿${l.volunteer.willing ? '愿意' : '已拒绝或撤回'}。`, `唯一350克${l.parcel.id}在${l.parcel.location}、持有${l.parcel.holder}，实际归还${l.parcel.returns}次；原主始终GUIDE。`, `同一原标条${l.line.id}在${l.line.location}、持有${l.line.holder}，不是墙，实际收起归还${l.line.returns}次。`, `同一原纸${l.paper.id}在${l.paper.location}，由${l.paper.holder}持有，永久文字“${l.paper.text}”。`,
      a ? `知识20四档${a.abilityTier ?? '未施术'}，规则${a.ruleActive ? '有效' : '无效'}，剩余${a.pendingRemainingSeconds}秒；当前许可${a.consent}。本人${a.playerAttempted ? `已试一次至${a.playerResult}${a.playerBlocked ? '，真实止步' : ''}` : '尚未尝试'}；米拉${l.activeCase === 'own-line' ? '不参与' : a.partnerAttempted ? `已试一次至${a.partnerResult}${a.partnerBlocked ? '，真实止步' : ''}` : '尚未尝试'}。` : '双方分别亲身尝试，本人不能自动豁免；固定合作演练不保证真实敌人服从。', a?.outcome ?? '不使用幸运，不增加第二事件盘，不重写过去、原纸或六阶历史。'],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.attempts[0]?.outcome ?? null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

/** Strictly replays the single paid check, consent transitions, each body, every original item, and the finite clock. */
export function validateChaosHunterLifeOriginal(s: SliceState): boolean {
  try { return validateLife(s); } catch { return false; }
}
function validateLife(s: SliceState): boolean {
  const l = s.chaosHunter.life, initial = createChaosHunterLifeState(), promotion = s.chaosHunter.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, CHAOS_HUNTER_CASE_IDS) || !record(l.volunteer) || typeof l.volunteer.willing !== 'boolean' || !integer(l.clockSeconds)) return false;
  let externalSeconds: number = s.chaosHunter.encounter.exitSeconds;
  if (![0, 4].includes(externalSeconds)) return false;
  for (const round of s.combatHistory) { const outcome = round.chaosHunterOutcome; if (outcome) { if (outcome.elapsedSeconds !== 60) return false; externalSeconds += outcome.elapsedSeconds; } }
  if (!integer(externalSeconds)) return false;
  const replay = createChaosHunterLifeState(); replay.clockSeconds = externalSeconds;
  if (promotion === null) return externalSeconds === 0 && same(l, replay);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && same(l, replay) && (!promoted(s) || s.progression.acting === 0 && (s.progression.mastery[ABILITY] ?? 0) === 0);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['paired-line'].observedWeek !== l.introducedWeek) return false;
  replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, chaosHunter: { ...s.chaosHunter, life: replay } };
  let open = 0, prepared = 0, resolved = 0, mastery = 0, lastAttemptWeek = promotion;
  for (const [index, id] of CHAOS_HUNTER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (!same(r, freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[CHAOS_HUNTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') { if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false; if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue; }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, Math.max(r.observedWeek, lastAttemptWeek), s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !integer(a.initialKnowledge, 0, 500) || typeof a.initialWilling !== 'boolean' || a.initialWilling !== replay.volunteer.willing || !Array.isArray(a.steps)) return false;
    lastAttemptWeek = a.week; shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind; shadow.actionsRemaining = 100; shadow.character = { ...s.character, coreStats: { ...s.character.coreStats, knowledge: a.initialKnowledge } };
    replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [], status: 'PREPARED', contactOpen: false, closes: 0, returned: false };
    startAttempt(shadow, id); const expected = replay.cases[id].attempts[0]!;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'atSecond', 'check', 'willing', 'claim']) || step.willing !== replay.volunteer.willing || step.atSecond !== expected.elapsedSeconds) return false;
      const casting = step.type === 'PERFORM' && a.method === 'ABILITY';
      if (casting) { if (!record(step.check) || !integer(step.check.roll, 1, 100) || !same(step.check, resolveNormalCheck({ ability: 'knowledge', baseAbility: a.initialKnowledge, difficulty: 20, modifiers: [], roll: step.check.roll }))) return false; } else if (step.check !== null) return false;
      const command = step.type === 'CONFIRM_LIMITED' ? { type: step.type, caseId: id, claim: step.claim } : { type: step.type, caseId: id };
      if (step.type !== 'CONFIRM_LIMITED' && step.claim !== null || !SCENES.includes(step.type as SceneType) && step.type !== 'CONFIRM_LIMITED' || !validateChaosHunterActivityCommand(command) || sceneReason(shadow, id, step.type)) return false;
      applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.outcomeRecorded || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (!same(a, expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (a.result === 'ABILITY') mastery += 8; }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3 || prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected;
  if (!same(replay, l) || !open && cleanupBlock(s) !== null) return false;
  const inherited=s.progression.pathwayId==='justiciar'&&s.progression.sequence===2;
  return !(promoted(s)||inherited) || (inherited?s.balancer.chaosHunterActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) === mastery;
}

export function validateChaosHunterLife(s: SliceState): boolean {
  return s.balancer?.life.source != null ? validateBalancerSourceChaosHunterLife(s) : validateChaosHunterLifeOriginal(s);
}
