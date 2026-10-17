import { princeOfAbolitionInheritedView, validatePrinceOfAbolitionSource } from '../prince-of-abolition/index.js';
import { validateEntropyDukeSourceFrenzyMageLife } from '../entropy-duke/life.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasFrenzyMageOldPractice, hasFrenzyMageRitualLock } from './index.js';

export const FRENZY_MAGE_CASE_IDS = ['courier-route', 'withdrawn-route', 'own-throw'] as const;
export type FrenzyMageCaseId = typeof FRENZY_MAGE_CASE_IDS[number];
export type FrenzyMageLocation = 'START' | 'A' | 'B' | 'C' | 'OUTSIDE';
export type FrenzyMageConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'ORDINARY';
type SceneType = 'GO_A' | 'CHECK_OBJECT' | 'PERFORM' | 'ORDINARY_CHECK' | 'EXECUTE_ACTION' | 'STOP_INPUT' | 'WAIT_EFFECT' | 'WITHDRAW_CONSENT' | 'WALK_RESULT' | 'READ_RESULT' | 'RETURN_PERSON' | 'TAKE_OBJECT' | 'RETURN_A' | 'RETURN_OBJECT' | 'RECORD_OUTCOME' | 'RETURN_START';
export type FrenzyMageActivityCommand =
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | 'WITHDRAW' | SceneType; caseId: FrenzyMageCaseId }
  | { type: 'PREPARE'; caseId: FrenzyMageCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONFIRM_LIMITED'; caseId: 'own-throw'; claim: 'LIMITED' | 'GUARANTEED' }
  | { type: 'REFLECT' };
export interface FrenzyMageMovement { from: FrenzyMageLocation; to: FrenzyMageLocation; mode: 'WALK' | 'THROW'; metres: 4; seconds: 4; itemIds: string[] }
export interface FrenzyMageEvidence { sourceId: string; text: string; atSecond: number }
export interface FrenzyMageLifeStep { type: SceneType | 'CONFIRM_LIMITED'; atSecond: number; check: PublicCheckResult | null; willing: boolean; claim: 'LIMITED' | 'GUARANTEED' | null }
export interface FrenzyMageAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; initialKnowledge: number;
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: FrenzyMageMovement[]; guideMoves: FrenzyMageMovement[]; personMoves: FrenzyMageMovement[]; objectMoves: FrenzyMageMovement[]; steps: FrenzyMageLifeStep[];
  resolutionPaid: boolean; resolutionActions: number; spiritualitySpent: number; mindSpent: number;
  objectChecked: boolean; consent: FrenzyMageConsent; consentWithdrawn: boolean; expressedAction: 'WALK_A_TO_B' | 'THROW_A_TO_B' | null;
  abilityCheck: PublicCheckResult | null; abilityTier: PublicResolutionTier | null; abilitySourceId: string | null; abilityAtSecond: number | null;
  inputActive: boolean; stopped: boolean; pendingRemainingSeconds: number; modifierApplied: boolean; modifierCancelled: boolean; modifierExpired: boolean; waitedSeconds: number; waitCompleted: boolean;
  actionExecutions: number; actionResult: 'B' | 'C' | null; actionAtSecond: number | null; actionSourceId: string | null;
  resultRead: boolean; paperRead: boolean; objectTaken: boolean; limitedConfirmed: boolean; rejectedClaims: number; objectsReturned: boolean; ordinaryChecked: boolean;
  evidence: FrenzyMageEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface FrenzyMageCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: FrenzyMageAttempt[];
}
export interface FrenzyMageLifeState {
  siteId: 'FM3-DELIVERY-PRACTICE'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: FrenzyMageCaseId | null;
  playerLocation: FrenzyMageLocation; playerTravelMetres: number; guideTravelMetres: number; clockSeconds: number;
  guide: { id: 'GUIDE'; name: '米蕾·沃德'; location: 'START' | 'A' | 'OUTSIDE' };
  volunteer: { id: 'FM3-DARIAN'; name: '达里安·维尔'; age: 42; alive: true; independentMind: true; willing: boolean; location: 'A' | 'B' | 'C' | 'OUTSIDE'; health: 100; mind: 100; injuries: [] };
  parcel: { id: 'FM3-PARCEL'; owner: 'GUIDE'; quantity: 1; massGrams: 400; sealed: true; confidential: false; holder: 'GUIDE' | 'DARIAN'; location: FrenzyMageLocation; handovers: number; returns: number };
  ball: { id: 'FM3-PRACTICE-BALL'; owner: 'GUIDE'; quantity: 1; massGrams: 80; soft: true; holder: 'GUIDE' | 'PLAYER' | 'PAD' | 'AIRBORNE'; location: FrenzyMageLocation; throws: number; returns: number };
  paper: { id: 'FM3-ROUTE-PAPER'; owner: 'GUIDE'; quantity: 1; holder: 'GUIDE' | 'PLAYER'; location: FrenzyMageLocation; text: '从A到B' };
  pads: { id: 'FM3-PAD-B' | 'FM3-PAD-C'; location: 'B' | 'C'; padded: true; people: 0 }[];
  cases: Record<FrenzyMageCaseId, FrenzyMageCaseState>; reflected: boolean;
}
export interface FrenzyMageLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FrenzyMageActivityCommand }
export interface FrenzyMageLifeProjection extends Omit<FrenzyMageLifeState, 'cases'> {
  title: string; story: string; summary: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: FrenzyMageAttempt | null;
  cases: { id: FrenzyMageCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: FrenzyMageAttempt[] }[];
  actions: FrenzyMageLifeAction[];
}
const ABILITY = 'black-emperor.s3.ordered-deviation' as const;
export const FRENZY_MAGE_LIFE_STORY = '序列3狂乱法师的名称与编号有原著直接依据；完整配方、晋升仪式及本阶新增通用机制仍未知。以下三场、一次既有动作偏转、30秒、费用与数值完全为本作原创G有限延伸。只能影响当时已经明确但尚未执行的一次动作，不改原纸或过去，不强迫长期意愿，不复制原人原物，不使用幸运、第二事件检定、船只灵界跳跃或天使权能。';
export const FRENZY_MAGE_LIFE_ENVIRONMENT = '协会净空投递演练房；START到A4米，A到B/C各4米，B/C独立空垫、轨迹无旁人。观察、准备、实施、报告每案各1行动，三案加反思共13行动。能力实付5灵性2精神，知识20四档检定一次；成功仅待用30秒，后来真实行走或本人实际投球才应用。普通0灵性0精神且不检定，能力失败后的普通收束不再收行动。待用取消、过期及失败不退费，不奖掌握；实际成功应用的报告掌握+8。原纸永久写从A到B，所有原物须真正归主、本人和导引实走回START才能退出。';
const CASES = [
  { id: 'courier-route', title: 'G · 同一信差已声明的下一步', story: '42岁达里安本人在A自主同意本次有限试验，持唯一400克演练封包，明确下一步按原纸从A走到B。成功施术只预备30秒；另行执行时本人实际普通走4米至C，失败或普通仍走B。你必须实走实际终点核本人、原包和同一原纸，再随达里安带原包普通返回A，交还原物后实走退出。' },
  { id: 'withdrawn-route', title: 'G · 撤回当前许可后的普通路线', story: '仍是同一达里安、同一原包、同一原纸与A到B的明确待行动作。他在本次实际施术后立即撤回能力参与，必须STOP_INPUT清除未用偏转，然后只按他当前普通意愿走4米至B。成功检定不是已改行为；实际往返、归还与撤回记录保留，取消不奖掌握。' },
  { id: 'own-throw', title: 'G · 本人真实投出的同一软布球', story: '你在A亲手取原80克软布球，读原纸B并确认两个空垫，明确本人待执行的一次普通投球。成功偏转使随后这一真实投球飞4米落C，失败或普通落B。你须实走终点亲读原球和随身同一原纸，亲手取回原球、带回A交原导引；不再投、不召唤、不改写首次结果。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'CHECK_OBJECT', 'PERFORM', 'ORDINARY_CHECK', 'EXECUTE_ACTION', 'STOP_INPUT', 'WAIT_EFFECT', 'WITHDRAW_CONSENT', 'WALK_RESULT', 'READ_RESULT', 'RETURN_PERSON', 'TAKE_OBJECT', 'RETURN_A', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 3;
const sourceFor = (id: FrenzyMageCaseId) => `frenzy-mage-life-${id}`;
const freshCase = (): FrenzyMageCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): FrenzyMageAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, initialKnowledge: s.character.coreStats.knowledge,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], personMoves: [], objectMoves: [], steps: [], resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0,
    objectChecked: false, consent: 'UNASKED', consentWithdrawn: false, expressedAction: null, abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, inputActive: false, stopped: false,
    pendingRemainingSeconds: 0, modifierApplied: false, modifierCancelled: false, modifierExpired: false, waitedSeconds: 0, waitCompleted: false, actionExecutions: 0, actionResult: null, actionAtSecond: null, actionSourceId: null,
    resultRead: false, paperRead: false, objectTaken: false, limitedConfirmed: false, rejectedClaims: 0, objectsReturned: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createFrenzyMageLifeState(): FrenzyMageLifeState {
  return { siteId: 'FM3-DELIVERY-PRACTICE', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, guideTravelMetres: 0, clockSeconds: 0,
    guide: { id: 'GUIDE', name: '米蕾·沃德', location: 'START' }, volunteer: { id: 'FM3-DARIAN', name: '达里安·维尔', age: 42, alive: true, independentMind: true, willing: true, location: 'A', health: 100, mind: 100, injuries: [] },
    parcel: { id: 'FM3-PARCEL', owner: 'GUIDE', quantity: 1, massGrams: 400, sealed: true, confidential: false, holder: 'GUIDE', location: 'START', handovers: 0, returns: 0 },
    ball: { id: 'FM3-PRACTICE-BALL', owner: 'GUIDE', quantity: 1, massGrams: 80, soft: true, holder: 'GUIDE', location: 'START', throws: 0, returns: 0 },
    paper: { id: 'FM3-ROUTE-PAPER', owner: 'GUIDE', quantity: 1, holder: 'GUIDE', location: 'START', text: '从A到B' }, pads: [{ id: 'FM3-PAD-B', location: 'B', padded: true, people: 0 }, { id: 'FM3-PAD-C', location: 'C', padded: true, people: 0 }],
    cases: { 'courier-route': freshCase(), 'withdrawn-route': freshCase(), 'own-throw': freshCase() }, reflected: false };
}
export function validateFrenzyMageActivityCommand(v: unknown): v is FrenzyMageActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!FRENZY_MAGE_CASE_IDS.includes(v.caseId as FrenzyMageCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONFIRM_LIMITED') return v.caseId === 'own-throw' && shape(v, ['type', 'caseId', 'claim']) && ['LIMITED', 'GUARANTEED'].includes(String(v.claim));
  if (!shape(v, ['type', 'caseId'])) return false;
  if (['RETURN_PERSON', 'WITHDRAW_CONSENT'].includes(v.type) && v.caseId === 'own-throw' || ['TAKE_OBJECT', 'RETURN_A'].includes(v.type) && v.caseId !== 'own-throw') return false;
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', 'WITHDRAW', ...SCENES].includes(v.type);
}
export const currentFrenzyMageAttempt = (s: SliceState) => s.frenzyMage.life.activeCase ? s.frenzyMage.life.cases[s.frenzyMage.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.frenzyMage.life, a = currentFrenzyMageAttempt(s);
  if (a?.inputActive || (a?.pendingRemainingSeconds ?? 0) > 0) return '须STOP_INPUT清除未应用偏转；已经发生的动作不能复原。';
  if (l.volunteer.location !== 'A' || l.parcel.holder !== 'GUIDE' || l.ball.holder !== 'GUIDE' || l.paper.holder !== 'GUIDE') return '须信差本人带原包普通回A，或本人实际取原球回A；在场亲交同一原物与原纸给导引。';
  return l.playerLocation !== 'START' || l.guide.location !== 'START' || l.parcel.location !== 'START' || l.ball.location !== 'START' || l.paper.location !== 'START' ? '本人和导引须沿原路实走回START，导引亲带原物，不可瞬移退出。' : null;
}
export const hasFrenzyMageLifeLock = (s: SliceState): boolean => {
  if (s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 1) {
    const prince = s.princeOfAbolition;
    // Only the actual completed S1 channel may read its frozen S2 checkpoint.
    // Current people and objects are owned by the new scene; old actions stay closed.
    if (!prince?.guidanceKnown || prince.promotionWeek === null || prince.entropyDukeActingAtPromotion !== 100 ||
      !prince.acquisitionJournal.some(e => e.command.type === 'CONSUME' && e.after.sequence === 1 && e.before.sequence === 2 && e.week === prince.promotionWeek) ||
      !validatePrinceOfAbolitionSource(s)) return true;
    return hasFrenzyMageLifeLock(princeOfAbolitionInheritedView(s));
  }
  if (s.entropyDuke?.life.source != null) {
    // During settlement the shared weekly pulse has not run yet. Check only the
    // immutable inherited scene here; full S2 replay is enforced by state validation.
    if (s.progression.pathwayId !== 'black-emperor' || s.progression.sequence !== 2 || s.entropyDuke.promotionWeek === null || s.entropyDuke.frenzyMageActingAtPromotion !== 100) return true;
    const original = s.entropyDuke.life.source.snapshot;
    const inherited = { ...s, progression: { ...s.progression, sequence: 3 as const, acting: s.entropyDuke.frenzyMageActingAtPromotion }, frenzyMage: { ...s.frenzyMage, life: original } };
    if (!validateFrenzyMageLifeOriginal(inherited)) return true;
    return original.activeCase !== null || Object.values(original.cases).some(r => r.status === 'PREPARED') || cleanupBlock(inherited) !== null;
  }
  return s.frenzyMage.life.activeCase !== null || Object.values(s.frenzyMage.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
};
function sceneReason(s: SliceState, id: FrenzyMageCaseId, type: SceneType | 'CONFIRM_LIMITED'): string | null {
  const l = s.frenzyMage.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation, item = id === 'own-throw' ? l.ball : l.parcel;
  if (type === 'STOP_INPUT') return a.abilityTier !== null && !a.stopped ? null : '没有尚未停止的本次能力尝试。';
  if (type === 'WITHDRAW_CONSENT') return a.objectChecked && a.consent === 'GRANTED' && a.actionExecutions === 0 ? null : '只可撤回尚未执行动作的当前一次同意；不撤销已经行走的事实。';
  if (type === 'WAIT_EFFECT') return a.abilityTier !== null && !a.waitCompleted && !a.actionExecutions && !a.stopped && !a.consentWithdrawn ? null : '只等待尚未执行且尚未取消的本次剩余时间；撤回同意须立即停止。';
  if (type === 'RETURN_START') return at === 'A' && a.objectsReturned && a.outcomeRecorded && !a.inputActive ? null : '须原物归主、如实记录后，本人和导引实走4米返回START。';
  if (a.outcomeRecorded) return '本次已记录，只可真正退出，不能重演原动作。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 ? null : '须且只可本人从START普通走4米到A一次。';
  if (type === 'CHECK_OBJECT') return at === 'A' && !a.objectChecked && l.guide.location === 'A' ? null : '先本人和导引到A，当面核原物、原纸及当前许可。';
  if (type === 'PERFORM' || type === 'ORDINARY_CHECK') {
    if (a.resolutionPaid || !a.objectChecked || a.expressedAction === null || at !== 'A') return '须在A已核原物并明确待行动作，且尚未付费实施；失败不能重检。';
    if (s.actionsRemaining < 1) return '首次实施需要1行动；准备时须留够。';
    if (type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') return null;
    if (id !== 'own-throw' && (a.consent !== 'GRANTED' || !l.volunteer.willing)) return '达里安没有本次当前许可，可普通完成，不能施术或重复索取同意。';
    return s.spirituality < 5 ? '能力需要实际5灵性；不足可普通完成。' : s.mind < 2 ? '能力需要实际2精神；不足可普通完成。' : null;
  }
  if (type === 'EXECUTE_ACTION') {
    if (at !== 'A' || !a.resolutionPaid || a.actionExecutions !== 0 || a.expressedAction === null) return '须已付本次实施、本人在A且原明确动作尚未执行；每案只执行一次。';
    if (id !== 'own-throw' && a.abilityTier !== null && (a.consentWithdrawn || !l.volunteer.willing) && (!a.stopped || a.pendingRemainingSeconds !== 0)) return '本人当前已撤回，须STOP_INPUT清除未用偏转后才可依本人普通意愿行走。';
    return null;
  }
  if (type === 'WALK_RESULT') return at === 'A' && a.actionExecutions === 1 && (item.location === 'B' || item.location === 'C') && !a.resultRead ? null : '先执行唯一一次真实动作，再走4米到实际终点。';
  if (type === 'READ_RESULT') return a.actionExecutions === 1 && !a.resultRead && at === item.location && (at === 'B' || at === 'C') && l.paper.holder === 'PLAYER' && l.paper.location === at ? null : '本人必须在实际原人原包或原球旁，亲读随身同一原纸与真实结果。';
  if (type === 'RETURN_PERSON') return a.resultRead && (at === 'B' || at === 'C') && at === l.volunteer.location && at === l.parcel.location ? null : '先实走终点核本人原包，再由信差自主带包、双方同路普通回A。';
  if (type === 'TAKE_OBJECT') return a.resultRead && at === l.ball.location && l.ball.holder === 'PAD' ? null : '须本人到实际原软球旁并核过结果，才可亲手取这一只球。';
  if (type === 'RETURN_A') return (at === 'B' || at === 'C') && a.objectTaken && l.ball.holder === 'PLAYER' && l.ball.location === at ? null : '须已亲手取原球，才可带同一球普通走4米回A。';
  if (type === 'CONFIRM_LIMITED') return at === 'A' && a.resultRead && a.paperRead && a.objectTaken && !a.limitedConfirmed ? null : '须已亲读原纸及真实结果、带原球回A，才可确认有限结论。';
  if (type === 'RETURN_OBJECT') return at === 'A' && a.resultRead && a.paperRead && !a.objectsReturned && !a.inputActive && a.pendingRemainingSeconds === 0 && item.location === 'A' && l.guide.location === 'A' && (id === 'own-throw' ? l.ball.holder === 'PLAYER' : l.volunteer.location === 'A') ? null : '须本人和原物实际回A、同一原纸仍在手中、导引在场，才可亲交原物。';
  if (type === 'RECORD_OUTCOME') return at === 'A' && a.objectsReturned && a.resolutionPaid && a.resultRead && a.actionExecutions === 1 && !a.inputActive ? null : '先完成一次真实动作、亲核结果和原纸、实际归还，才能如实记录。';
  return '本案不支持此动作。';
}
export function frenzyMageActivityReason(s: SliceState, c: FrenzyMageActivityCommand): string | null {
  if (!validateFrenzyMageActivityCommand(c)) return '狂乱法师命令无效、字段多余或不属于本案。';
  if (!promoted(s)) return '先实际晋升狂乱法师序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '同一本体已死亡或周目结束，不能操作、复活或代办归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.frenzyMage.encounter.status)) return '先处理当前事件或战斗，同一本体不能在两处。';
  if (s.world.city !== 'BACKLUND') return '须实际回贝克兰德协会净空演练房。';
  const l = s.frenzyMage.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只可取消尚未开始的准备；现场可以普通收束，已发事实不能回滚。';
  if (c.type === 'LEAVE_CASE') return r?.contactOpen && l.activeCase === c.caseId && r.attempts.at(-1)?.outcomeRecorded ? cleanupBlock(s) : '须归还原物、如实记录并真正回START。';
  if (SCENES.includes(c.type as SceneType) || c.type === 'CONFIRM_LIMITED') return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType | 'CONFIRM_LIMITED') : '先START_CASE打开实际现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先处理本案当前动作、原物与实际返回。';
  if (Object.entries(l.cases).some(([id, item]) => item.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消当前准备。';
  if (hasFrenzyMageOldPractice(s) || hasFrenzyMageRitualLock(s)) return '须先实际收束旧接触、原物、旧战斗与服药准备。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '新行动须有精神与1行动；已付现场收束不额外收费。';
  if (c.type === 'REFLECT') return l.reflected ? '反思已完成。' : FRENZY_MAGE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份实际报告。';
  if (!('caseId' in c) || !r || r.status === 'RESOLVED') return '本案报告已经完成。';
  const i = FRENZY_MAGE_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[FRENZY_MAGE_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成上一份真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '同一原案只观察一次。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原人原物与边界。' : s.actionsRemaining < 2 ? '准备需要1行动，并保留1行动首次实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先选择能力或普通准备。';
  return r.status === 'EXAMINED' && r.attempts.at(-1)?.outcomeRecorded && !r.contactOpen ? null : '须真正完成、归还及退出后才可报告。';
}
export const blockFrenzyMageLife = frenzyMageActivityReason;
export function advanceFrenzyMageClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.frenzyMage.life.clockSeconds + seconds)) throw new Error('原演练房累计时钟无效。');
  s.frenzyMage.life.clockSeconds += seconds;
}
export const advanceFrenzyMageLifeClock = advanceFrenzyMageClock;
function elapse(s: SliceState, a: FrenzyMageAttempt, seconds: number) {
  a.elapsedSeconds += seconds; advanceFrenzyMageClock(s, seconds);
  if (a.pendingRemainingSeconds > 0) { a.pendingRemainingSeconds = Math.max(0, a.pendingRemainingSeconds - seconds); if (!a.pendingRemainingSeconds && !a.modifierApplied && !a.modifierCancelled) a.modifierExpired = true; }
}
const movement = (from: FrenzyMageLocation, to: FrenzyMageLocation, itemIds: string[], mode: 'WALK' | 'THROW' = 'WALK'): FrenzyMageMovement => ({ from, to, mode, metres: 4, seconds: 4, itemIds });
function playerMove(s: SliceState, a: FrenzyMageAttempt, to: FrenzyMageLocation) {
  const l = s.frenzyMage.life, ids = [ ...(l.paper.holder === 'PLAYER' ? [l.paper.id] : []), ...(l.ball.holder === 'PLAYER' ? [l.ball.id] : []) ];
  const m = movement(l.playerLocation, to, ids); a.playerMoves.push(m); if (ids.length) a.objectMoves.push(structuredClone(m));
  l.playerLocation = to; a.playerTravelMetres += 4; l.playerTravelMetres += 4;
  if (l.paper.holder === 'PLAYER') l.paper.location = to; if (l.ball.holder === 'PLAYER') l.ball.location = to; elapse(s, a, 4);
}
/** Guide walks concurrently with the player, carrying exactly the originals needed by this scene. */
function guideMove(s: SliceState, a: FrenzyMageAttempt, id: FrenzyMageCaseId, to: 'A' | 'START') {
  const l = s.frenzyMage.life, item = id === 'own-throw' ? l.ball : l.parcel, m = movement(l.guide.location, to, [item.id, l.paper.id]);
  a.guideMoves.push(m); a.objectMoves.push(structuredClone(m)); l.guide.location = to; l.guideTravelMetres += 4; item.location = to; l.paper.location = to;
}
function startAttempt(s: SliceState, id: FrenzyMageCaseId) { const l = s.frenzyMage.life, r = l.cases[id]; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = id; }
function evidence(a: FrenzyMageAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function applyScene(s: SliceState, id: FrenzyMageCaseId, step: FrenzyMageLifeStep) {
  const l = s.frenzyMage.life, a = l.cases[id].attempts.at(-1)!; a.steps.push(structuredClone(step));
  switch (step.type) {
    case 'GO_A': guideMove(s, a, id, 'A'); playerMove(s, a, 'A'); break;
    case 'CHECK_OBJECT':
      a.objectChecked = true; a.paperRead = true; l.paper.holder = 'PLAYER'; elapse(s, a, 2);
      if (id === 'own-throw') { l.ball.holder = 'PLAYER'; a.consent = 'ORDINARY'; a.expressedAction = 'THROW_A_TO_B'; evidence(a, l.ball.id, '本人在A亲手接唯一80克软布球，核B/C空垫，明确下一步普通投球到B；同一本体实际投球，不远程搬物。'); }
      else { l.parcel.holder = 'DARIAN'; l.parcel.handovers++; a.consent = a.method === 'ORDINARY' ? 'ORDINARY' : l.volunteer.willing ? 'GRANTED' : 'DECLINED'; a.expressedAction = 'WALK_A_TO_B'; evidence(a, l.volunteer.id, `原42岁达里安亲接唯一400克演练原包，当前能力许可${a.consent}；他自己明确下一步沿原纸从A普通走到B，仍可拒绝本次能力。`); }
      evidence(a, l.paper.id, `亲手接同一原纸，亲读永久文字“${l.paper.text}”；只携原件核对，绝不改纸。`); break;
    case 'PERFORM': case 'ORDINARY_CHECK':
      s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions = 1; elapse(s, a, 2);
      if (step.type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') { a.ordinaryChecked = true; evidence(a, l.paper.id, '首次实施实付1行动，普通保留已声明A到B动作；不施术、不检定、不支出灵性精神，动作尚未执行。'); break; }
      s.spirituality -= 5; s.mind -= 2; a.spiritualitySpent = 5; a.mindSpent = 2; a.abilityCheck = structuredClone(step.check); a.abilityTier = step.check!.tier; a.abilitySourceId = id === 'own-throw' ? 'PLAYER_ORIGINAL' : l.volunteer.id;
      a.abilityAtSecond = a.elapsedSeconds; a.inputActive = true; a.pendingRemainingSeconds = passed(a.abilityTier) ? 30 : 0;
      if (id === 'withdrawn-route') { a.consent = 'REVOKED'; a.consentWithdrawn = true; l.volunteer.willing = false; evidence(a, l.volunteer.id, '这次尝试后本人立即撤回能力许可；须STOP_INPUT清未用偏转，之后他自主按原纸普通走B。'); }
      evidence(a, a.abilitySourceId, `知识20四档检定${a.abilityTier}；实付5灵性2精神，仅准备30秒内这一次已明确的下一动作，尚无移动或投球结果。`); break;
    case 'WITHDRAW_CONSENT': a.consent = 'REVOKED'; a.consentWithdrawn = true; l.volunteer.willing = false; evidence(a, l.volunteer.id, '本人撤回当前一次能力同意；不能再施术，尚未应用的偏转须立即停止。'); break;
    case 'STOP_INPUT': a.inputActive = false; a.stopped = true; if (a.pendingRemainingSeconds > 0) a.modifierCancelled = true; a.pendingRemainingSeconds = 0; break;
    case 'WAIT_EFFECT': { const seconds = a.pendingRemainingSeconds; a.waitCompleted = true; a.waitedSeconds += seconds; elapse(s, a, seconds); a.inputActive = false; break; }
    case 'EXECUTE_ACTION': {
      // Consume once at the actual start of the expressed action, then enact its finite physical path.
      a.modifierApplied = a.pendingRemainingSeconds > 0 && !a.stopped && (id === 'own-throw' || a.consent === 'GRANTED' && l.volunteer.willing);
      a.actionResult = a.modifierApplied ? 'C' : 'B'; a.pendingRemainingSeconds = 0; a.inputActive = false; a.actionExecutions = 1; a.actionSourceId = id === 'own-throw' ? l.ball.id : l.volunteer.id;
      if (id === 'own-throw') { a.objectMoves.push(movement('A', a.actionResult, [l.ball.id], 'THROW')); l.ball.location = a.actionResult; l.ball.holder = 'PAD'; l.ball.throws++; }
      else { const m = movement('A', a.actionResult, [l.parcel.id]); a.personMoves.push(m); a.objectMoves.push(structuredClone(m)); l.volunteer.location = a.actionResult; l.parcel.location = a.actionResult; }
      elapse(s, a, 4); a.actionAtSecond = a.elapsedSeconds;
      evidence(a, a.actionSourceId, `已经明确的${id === 'own-throw' ? '本人实际投球' : '达里安本人自主行走'}只执行一次，原${id === 'own-throw' ? '球' : '人和原包'}实际经过4米4秒到${a.actionResult}；${a.modifierApplied ? '本次未发生动作的有限偏转实际应用' : '普通保留原B路线'}。没有第二事件检定，原纸仍写从A到B。`); break;
    }
    case 'WALK_RESULT': playerMove(s, a, a.actionResult!); break;
    case 'READ_RESULT': a.resultRead = true; elapse(s, a, 1); evidence(a, id === 'own-throw' ? l.ball.id : l.parcel.id, `本人实到${l.playerLocation}，亲核同一${id === 'own-throw' ? '原球' : '达里安和他携带的原包'}；随身原纸${l.paper.id}仍“${l.paper.text}”，实际结果${a.actionResult}，不改写或重演。`); break;
    case 'RETURN_PERSON': { const m = movement(l.volunteer.location, 'A', [l.parcel.id]); a.personMoves.push(m); a.objectMoves.push(structuredClone(m)); l.volunteer.location = 'A'; l.parcel.location = 'A'; playerMove(s, a, 'A'); break; }
    case 'TAKE_OBJECT': l.ball.holder = 'PLAYER'; a.objectTaken = true; elapse(s, a, 1); evidence(a, l.ball.id, '本人在实际空垫亲手拾起同一只原软球；不召回、不制造副本。'); break;
    case 'RETURN_A': playerMove(s, a, 'A'); break;
    case 'CONFIRM_LIMITED': if (step.claim === 'GUARANTEED') a.rejectedClaims++; else a.limitedConfirmed = true; break;
    case 'RETURN_OBJECT':
      a.objectsReturned = true; l.paper.holder = 'GUIDE'; if (id === 'own-throw') { l.ball.holder = 'GUIDE'; l.ball.returns++; } else { l.parcel.holder = 'GUIDE'; l.parcel.returns++; } elapse(s, a, 2);
      evidence(a, id === 'own-throw' ? l.ball.id : l.parcel.id, '在A当面亲交同一原物和同一原纸给实际在场原米蕾；信差仍为同一独立成人，既成动作不撤销。'); break;
    case 'RECORD_OUTCOME':
      a.outcomeRecorded = true; a.limitedConfirmed = true; a.result = a.modifierApplied ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result; elapse(s, a, 1);
      a.outcome = `检定${a.abilityTier ?? '未施术'}；已表达下一步A到B，后来仅执行一次真实动作到${a.actionResult}，原纸永久仍B。${a.modifierApplied ? '一次有限偏转确实用于尚未发生动作' : a.consentWithdrawn ? '当前许可撤回，未用影响已清，无能力掌握' : '失败、取消、过期或普通完成，无能力掌握'}。原人原物实际往返、原件归主；已付不退，既发事实不回滚，不保证未来。`; break;
    case 'RETURN_START': guideMove(s, a, id, 'START'); playerMove(s, a, 'START'); break;
  }
}
export function applyFrenzyMageActivity(s: SliceState, c: FrenzyMageActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = frenzyMageActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.frenzyMage.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('frenzy-mage-reflection'); ctx.note('G · 反思已表达动作与当前许可', '三份真实报告后扮演+25。成功检定不等于动作已改变；取消、过期或失败不奖掌握，原纸与全部旧历史保留。'); return; }
  const r = l.cases[c.caseId], spec = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备实付1行动；${c.method === 'ABILITY' ? '施术另1行动5灵性2精神，知识20一次' : '普通实施另1行动，不检定、不耗灵性精神'}。此时尚未取当前同意、未施术或移动原物。`); return; }
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消未开始的准备', '0行动，已付不退，原人原物没有改变。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, '0行动打开实际现场并锁住；本人与导引仍在START，达里安仍在A，原物尚未移动。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `${r.attempts[0]!.outcome} 真实报告扮演+25；${r.result === 'ABILITY' ? '实际成功应用新掌握+8' : '未实际应用，无新掌握'}。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('已真正离开原演练现场', '本人和导引已沿原路回START，同一原物与未改原纸由导引实际带回，达里安在A保持独立心智；费用不退，不补资源。'); return; }
  const check = c.type === 'PERFORM' && a.method === 'ABILITY' ? ctx.check('knowledge', 20) : null;
  applyScene(s, c.caseId, { type: c.type, atSecond: a.elapsedSeconds, check, willing: l.volunteer.willing, claim: c.type === 'CONFIRM_LIMITED' ? c.claim : null });
  ctx.note(`G · ${c.type}`, `${c.type === 'RECORD_OUTCOME' ? a.outcome : c.type === 'CONFIRM_LIMITED' && c.claim === 'GUARANTEED' ? '保证未来的主张被拒绝；保留首次真实结果，不重抽。' : '只处理原人原物、本次当前许可与实际动作。'} 本人${l.playerLocation}；本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，待用偏转${a.pendingRemainingSeconds}秒，动作${a.actionExecutions}次。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人和导引实走到A', '0行动 · 各4米4秒 · 导引携原物'], CHECK_OBJECT: ['当面核原人原物、原纸与已明确下一步', '0行动 · 2秒'], PERFORM: ['实际实施本次方案', '1行动 · 能力5灵性2精神 · 知识20一次'], ORDINARY_CHECK: ['改用普通方案保留A到B', '首次1行动 · 0灵性0精神 · 不检定'], EXECUTE_ACTION: ['实际执行已明确的那一次动作', '0行动 · 真实4米4秒 · 不再检定'], STOP_INPUT: ['停止未用偏转，已发事实保持', '0行动0秒 · 已付不退'], WAIT_EFFECT: ['实际等到本次待用偏转到期', '0行动 · 原剩余秒数'], WITHDRAW_CONSENT: ['本人撤回当前一次能力许可', '0行动 · 未用影响须停止'], WALK_RESULT: ['本人实走实际终点', '0行动 · 4米4秒'], READ_RESULT: ['当面核原人原物与随身同一原纸', '0行动 · 1秒'], RETURN_PERSON: ['达里安带原包、双方普通走回A', '0行动 · 各4米4秒'], TAKE_OBJECT: ['本人亲手取回原软布球', '0行动 · 1秒'], RETURN_A: ['本人携同一原球与原纸走回A', '0行动 · 4米4秒'], RETURN_OBJECT: ['当面归还同一原物与原纸', '0行动 · 2秒'], RECORD_OUTCOME: ['如实记录实际结果、许可及有限结论', '0行动 · 1秒'], RETURN_START: ['本人和导引实走回START', '0行动 · 各4米4秒 · 原物随导引'],
};
export function frenzyMageLifeActions(s: SliceState): FrenzyMageLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.frenzyMage.life, actions: FrenzyMageLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: FrenzyMageActivityCommand) => { const reason = frenzyMageActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[FRENZY_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原人原物及边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备一次有限动作偏转', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备完全普通的原路线', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案实际现场', '0行动', { type: 'START_CASE', caseId: id }); add(`${id}-withdraw`, '取消未开始的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of SCENES) { const c = { type, caseId: id } as FrenzyMageActivityCommand; if (!validateFrenzyMageActivityCommand(c)) continue; const waitingAbility = type === 'PERFORM' && a.method === 'ABILITY' && a.objectChecked && !a.resolutionPaid; if (frenzyMageActivityReason(s, c) === null || waitingAbility) add(`${id}-${type.toLowerCase()}`, type === 'EXECUTE_ACTION' ? id === 'own-throw' ? '本人实际投出同一原软球一次' : '由达里安本人实际走出已声明的下一步' : LABELS[type][0], type === 'PERFORM' && a.method === 'ORDINARY' ? '1行动 · 0灵性0精神 · 不检定' : LABELS[type][1], c); }
      if (id === 'own-throw' && frenzyMageActivityReason(s, { type: 'CONFIRM_LIMITED', caseId: id, claim: 'LIMITED' }) === null) for (const claim of ['LIMITED', 'GUARANTEED'] as const) add(`${id}-${claim.toLowerCase()}`, claim === 'LIMITED' ? '确认只有本次动作的有限结论' : '声称保证未来（当面拒绝）', '0行动 · 不重做', { type: 'CONFIRM_LIMITED', caseId: id, claim });
      if (cleanupBlock(s) === null && a.outcomeRecorded) add(`${id}-leave`, '关闭已实际退出的现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告真实动作、当前许可与原物归还', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '实际应用掌握+8' : '无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && FRENZY_MAGE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('frenzy-mage-reflect', '反思有限动作与当前同意', '1行动 · 扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectFrenzyMageLife(s: SliceState): FrenzyMageLifeProjection {
  const l = s.frenzyMage.life, a = currentFrenzyMageAttempt(s), actions = frenzyMageLifeActions(s), inside = hasFrenzyMageLifeLock(s);
  const next = actions.find(v => v.enabled && !['WITHDRAW', 'ORDINARY_CHECK', 'WAIT_EFFECT', 'WITHDRAW_CONSENT', 'STOP_INPUT', 'CONFIRM_LIMITED'].includes(v.command.type)) ?? actions.find(v => v.enabled);
  const summary = `本人${l.playerLocation}，普通步行${l.playerTravelMetres}米；原导引${l.guide.location}、实走${l.guideTravelMetres}米，生命周期原时钟${l.clockSeconds}秒。`;
  return { ...structuredClone(l), title: '狂乱法师 · 有限的既有动作偏转', story: FRENZY_MAGE_LIFE_STORY, summary, environment: FRENZY_MAGE_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : '三份有限报告完成，可以继续普通生活。', facts: [summary, `同一42岁达里安${l.volunteer.id}在${l.volunteer.location}，健康100、精神100，独立心智和本人去留不变；当前能力参与意愿${l.volunteer.willing ? '愿意' : '已拒绝或撤回'}。`, `唯一400克${l.parcel.id}在${l.parcel.location}、持有${l.parcel.holder}、原件归还${l.parcel.returns}次；所有权始终GUIDE，无真实机密。`, `唯一80克原软布球${l.ball.id}在${l.ball.location}、持有${l.ball.holder}，实际投出${l.ball.throws}次、原件归还${l.ball.returns}次；B/C独立空垫。`, `同一原纸${l.paper.id}在${l.paper.location}、由${l.paper.holder}持有，永久文字“${l.paper.text}”；从不改写。`, a ? `已声明动作${a.expressedAction ?? '尚未当面声明'}；知识20检定${a.abilityTier ?? '未施术'}，待用偏转${a.pendingRemainingSeconds}秒，实际应用${a.modifierApplied ? '是' : '否'}；当前许可${a.consent}，真实动作${a.actionExecutions}次、终点${a.actionResult ?? '尚未执行'}。` : '成功检定只准备影响；后来实际行走或投球才应用，取消或过期不奖掌握。', a?.outcome ?? '不使用幸运储备，不增加事件重掷，不把名称推成万能能力。'],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.attempts[0]?.outcome ?? null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

/** Replays the sole ability check and each original actor/object movement; no event draw exists. */
export function validateFrenzyMageLifeOriginal(s: SliceState): boolean {
  const l = s.frenzyMage.life, initial = createFrenzyMageLifeState(), promotion = s.frenzyMage.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, FRENZY_MAGE_CASE_IDS) || !record(l.volunteer) || typeof l.volunteer.willing !== 'boolean' || !integer(l.clockSeconds)) return false;
  let externalSeconds: number = s.frenzyMage.encounter.exitSeconds;
  if (!integer(externalSeconds, 0, 4) || ![0, 4].includes(externalSeconds)) return false;
  for (const round of s.combatHistory) { const outcome = round.frenzyMageOutcome; if (outcome) { if (outcome.elapsedSeconds !== 60) return false; externalSeconds += outcome.elapsedSeconds; } }
  if (!integer(externalSeconds)) return false;
  const replay = createFrenzyMageLifeState(); replay.clockSeconds = externalSeconds; replay.volunteer.willing = l.volunteer.willing;
  if (promotion === null) return externalSeconds === 0 && stableStringify(l) === stableStringify(replay);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(replay) && (!promoted(s) || s.progression.acting === 0 && (s.progression.mastery[ABILITY] ?? 0) === 0);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['courier-route'].observedWeek !== l.introducedWeek) return false;
  replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, frenzyMage: { ...s.frenzyMage, life: replay } };
  let open = 0, prepared = 0, resolved = 0, mastery = 0, lastAttemptWeek = promotion;
  for (const [index, id] of FRENZY_MAGE_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[FRENZY_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') { if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false; if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue; }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, Math.max(r.observedWeek, lastAttemptWeek), s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !integer(a.initialKnowledge, 0, 500) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    lastAttemptWeek = a.week; shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind; shadow.actionsRemaining = 100; shadow.character = { ...s.character, coreStats: { ...s.character.coreStats, knowledge: a.initialKnowledge } };
    replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [], status: 'PREPARED', contactOpen: false, closes: 0, returned: false };
    startAttempt(shadow, id); const expected = replay.cases[id].attempts[0]!;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'atSecond', 'check', 'willing', 'claim']) || typeof step.willing !== 'boolean' || step.atSecond !== expected.elapsedSeconds) return false;
      const casting = step.type === 'PERFORM' && a.method === 'ABILITY';
      if (casting) { if (!record(step.check) || !integer(step.check.roll, 1, 100) || stableStringify(step.check) !== stableStringify(resolveNormalCheck({ ability: 'knowledge', baseAbility: a.initialKnowledge, difficulty: 20, modifiers: [], roll: step.check.roll }))) return false; } else if (step.check !== null) return false;
      const command = step.type === 'CONFIRM_LIMITED' ? { type: step.type, caseId: id, claim: step.claim } : { type: step.type, caseId: id };
      if (step.type !== 'CONFIRM_LIMITED' && step.claim !== null || !SCENES.includes(step.type as SceneType) && step.type !== 'CONFIRM_LIMITED' || !validateFrenzyMageActivityCommand(command)) return false;
      replay.volunteer.willing = step.willing;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.outcomeRecorded || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (a.modifierApplied) mastery += 8; }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3 || prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.volunteer.willing = l.volunteer.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  const inherited=s.progression.pathwayId==='black-emperor'&&s.progression.sequence===2;
  return !(promoted(s)||inherited) || (inherited?s.entropyDuke.frenzyMageActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) === mastery;
}

export function validateFrenzyMageLife(s: SliceState): boolean { try { return s.entropyDuke?.life?.source != null ? validateEntropyDukeSourceFrenzyMageLife(s) : validateFrenzyMageLifeOriginal(s); } catch { return false; } }
