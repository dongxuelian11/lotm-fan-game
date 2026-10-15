import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { WinnerLuck } from '../winner/types.js';
import { CHAOS_WALKER_GUIDE } from './content.js';
import { hasChaosWalkerOldPractice, hasChaosWalkerRitualLock } from './index.js';

export const CHAOS_WALKER_CASE_IDS = ['cart-fork', 'revoked-draw', 'counterexample'] as const;
export type ChaosWalkerCaseId = typeof CHAOS_WALKER_CASE_IDS[number];
export type ChaosWalkerLocation = 'START' | 'A' | 'B' | 'C';
export type ChaosWalkerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'ORDINARY';
type SceneType = 'GO_A' | 'CHECK_OBJECT' | 'PERFORM' | 'ORDINARY_CHECK' | 'STOP_INPUT' | 'WAIT_EFFECT' | 'RELEASE_CART' | 'DRAW_TAG' | 'SPIN_DISC' | 'WALK_RESULT' | 'READ_RESULT' | 'RETURN_CART' | 'WALK_B' | 'READ_RECORD' | 'RETURN_A' | 'COMPARE_RESULT' | 'RETURN_OBJECT' | 'RECORD_OUTCOME' | 'RETURN_START';
export type ChaosWalkerActivityCommand =
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | 'WITHDRAW' | SceneType; caseId: ChaosWalkerCaseId }
  | { type: 'PREPARE'; caseId: ChaosWalkerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONFIRM_LIMITED'; caseId: 'counterexample'; claim: 'LIMITED' | 'GUARANTEED' }
  | { type: 'ACCUMULATE' | 'REFLECT' };
export interface ChaosWalkerMovement { from: ChaosWalkerLocation; to: ChaosWalkerLocation; mode: 'WALK' | 'PUSH' | 'ROLL'; metres: number; seconds: number; itemIds: string[] }
export interface ChaosWalkerEvidence { sourceId: string; text: string; atSecond: number }
export interface ChaosWalkerLifeStep { type: SceneType | 'CONFIRM_LIMITED'; atSecond: number; check: PublicCheckResult | null; eventRoll: number | null; willing: boolean; claim: 'LIMITED' | 'GUARANTEED' | null }
export interface ChaosWalkerAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; initialKnowledge: number; initialLuck: WinnerLuck;
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: ChaosWalkerMovement[]; guideMoves: ChaosWalkerMovement[]; objectMoves: ChaosWalkerMovement[]; steps: ChaosWalkerLifeStep[];
  resolutionPaid: boolean; resolutionActions: number; spiritualitySpent: number; mindSpent: number; luckSpent: number; luckBefore: WinnerLuck | null; luckAfter: WinnerLuck | null;
  objectChecked: boolean; consent: ChaosWalkerConsent; consentWithdrawn: boolean; abilityCheck: PublicCheckResult | null; abilityTier: PublicResolutionTier | null; abilitySourceId: string | null; abilityAtSecond: number | null;
  inputActive: boolean; stopped: boolean; pendingRemainingSeconds: number; modifierApplied: boolean; modifierCancelled: boolean; modifierExpired: boolean; waitedSeconds: number; waitCompleted: boolean;
  branchRoll: number | null; branchChance: 25 | 50 | 75 | null; branchResult: 'A' | 'B' | 'C' | null; eventDraws: number; eventAtSecond: number | null; eventSourceId: string | null;
  resultRead: boolean; recordRead: boolean; compared: boolean; limitedConfirmed: boolean; rejectedClaims: number; objectsReturned: boolean; ordinaryChecked: boolean;
  evidence: ChaosWalkerEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface ChaosWalkerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: ChaosWalkerAttempt[];
}
export interface ChaosWalkerAccumulation { week: number; actionCost: 1; storedBefore: number; storedAfter: number; accumulatedAfter: number; spentAtTime: number }
export interface ChaosWalkerLifeState {
  siteId: 'CW3-MECHANICAL-WORKSHOP'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: ChaosWalkerCaseId | null;
  playerLocation: ChaosWalkerLocation; playerTravelMetres: number; guideTravelMetres: number; clockSeconds: number;
  guide: { id: 'GUIDE'; name: string; location: 'START' | 'A' };
  volunteer: { id: 'CW3-VERA'; name: '薇拉·霍尔'; age: 39; alive: true; willing: boolean; location: 'A'; health: 100; mind: 100; spirituality: 100; injuries: [] };
  cart: { id: 'CW3-CART'; owner: 'GUIDE'; quantity: 1; location: 'A' | 'B' | 'C'; control: 'GUIDE' | 'PLAYER'; releases: number; returns: number };
  parcel: { id: 'CW3-PARCEL'; owner: 'GUIDE'; quantity: 1; massGrams: 400; sealed: true; location: 'CW3-CART' };
  stops: { id: 'CW3-STOP-B' | 'CW3-STOP-C'; location: 'B' | 'C'; padded: true }[];
  pouch: { id: 'CW3-POUCH'; owner: 'CW3-VERA'; quantity: 1; opaque: true; location: 'VERA'; draws: number; returns: number };
  tags: { id: 'CW3-TAG-A' | 'CW3-TAG-B'; owner: 'CW3-VERA'; quantity: 1; location: 'POUCH' | 'VERA_HAND' }[];
  disc: { id: 'CW3-DISC'; owner: 'GUIDE'; quantity: 1; location: 'A'; control: 'GUIDE' | 'PLAYER'; pointer: 'A' | 'B' | null; spins: number; returns: number };
  record: { id: 'CW3-RECORD'; owner: 'CW3-VERA'; quantity: 1; location: 'B'; text: string };
  forecast: { id: 'CW3-FORECAST'; owner: 'GUIDE'; quantity: 1; location: 'B'; text: string };
  cases: Record<ChaosWalkerCaseId, ChaosWalkerCaseState>; reflected: boolean; accumulations: ChaosWalkerAccumulation[];
}
export interface ChaosWalkerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosWalkerActivityCommand }
export interface ChaosWalkerLifeProjection extends Omit<ChaosWalkerLifeState, 'cases'> {
  title: string; story: string; summary: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: ChaosWalkerAttempt | null;
  luck: WinnerLuck & { capacity: 3 };
  cases: { id: ChaosWalkerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ChaosWalkerAttempt[] }[];
  actions: ChaosWalkerLifeAction[];
}
const BUFFER = 'wheel.s3.deviation-buffer' as const, IMPEDIMENT = 'wheel.s3.future-impediment' as const;
export const CHAOS_WALKER_LIFE_STORY = '序列3混乱行者是本作候选映射：原著混合封印物的试探称呼不直接证明编号、职业技能表或完整配方与仪式。以下三场、两项新实践、30秒与50%→75%/25%均为原创G。改变的是尚未发生的一次有限机械分支；检定成功不保证物理结果，不重抽、不改写过去、不强迫意志、不使用概率之骰或天使权能。';
export const CHAOS_WALKER_LIFE_ENVIRONMENT = '观察、准备、首次实施、报告各1行动，三案加反思共13行动。能力另实付5灵性1精神及唯一winner.luck原储备1份，知识20四级检定，失败不退；普通实施0灵性0精神0幸运。后续放车、本人抽签或转盘才另抽一次1..100机械分支。START到A4米，A到B或C各4米；原物真实归还，本人普通返回。积运额外1行动，每真实周一次、上限3，无补灵或治疗。';
const CASES = [
  { id: 'cart-fork', title: 'G · 同一原车的未发生岔路', story: '原CW3-CART载唯一密封400克CW3-PARCEL停A，两条真实4米轨道至B/C原软挡。实看车签和两原挡，成功仅把尚未释放的本次到B概率50%变75%。另行放车一次，仍可能到C；本人走到实际终点读原车签，再推同一车与原包4米回A，亲交原导师。' },
  { id: 'revoked-draw', title: 'G · 当前许可撤回后的原签', story: '39岁原成年薇拉在A持同一不透明原袋和A/B两原签。当面只问本次可撤回试验；实际尝试后她立刻撤回，要求普通抽签。须停止并丢弃待用修正，再由她自己亲手抽一次，A概率保持50%。读真实原签，本人往返B读同一原记录；原签放回同袋，仍归她。取消不退成本，也不给新掌握。' },
  { id: 'counterexample', title: 'G · 原转盘保留真实反例', story: '原CW3-DISC始终在A，原手写CW3-FORECAST在B说明没有保证。成功只能把本次后来转动的A概率50%变25%，仍可能真实停A。另行转同一盘一次、读原指针，再实走B读原预测并返A比较。原指针不重置、不重抽；拒绝GUARANTEED不重新判定，确认有限结论后把控制权亲交原导师。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'CHECK_OBJECT', 'PERFORM', 'RELEASE_CART', 'DRAW_TAG', 'SPIN_DISC', 'STOP_INPUT', 'WAIT_EFFECT', 'WALK_RESULT', 'READ_RESULT', 'RETURN_CART', 'WALK_B', 'READ_RECORD', 'RETURN_A', 'COMPARE_RESULT', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'ORDINARY_CHECK'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 3;
const sourceFor = (id: ChaosWalkerCaseId) => `chaos-walker-life-${id}`;
const abilityFor = (id: ChaosWalkerCaseId) => id === 'cart-fork' ? BUFFER : IMPEDIMENT;
const freshCase = (): ChaosWalkerCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): ChaosWalkerAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, initialKnowledge: s.character.coreStats.knowledge, initialLuck: { ...s.winner.luck }, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], guideMoves: [], objectMoves: [], steps: [], resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, luckSpent: 0, luckBefore: null, luckAfter: null, objectChecked: false, consent: 'UNASKED', consentWithdrawn: false, abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, inputActive: false, stopped: false, pendingRemainingSeconds: 0, modifierApplied: false, modifierCancelled: false, modifierExpired: false, waitedSeconds: 0, waitCompleted: false, branchRoll: null, branchChance: null, branchResult: null, eventDraws: 0, eventAtSecond: null, eventSourceId: null, resultRead: false, recordRead: false, compared: false, limitedConfirmed: false, rejectedClaims: 0, objectsReturned: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createChaosWalkerLifeState(): ChaosWalkerLifeState {
  return { siteId: 'CW3-MECHANICAL-WORKSHOP', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, guideTravelMetres: 0, clockSeconds: 0,
    guide: { id: 'GUIDE', name: CHAOS_WALKER_GUIDE, location: 'START' }, volunteer: { id: 'CW3-VERA', name: '薇拉·霍尔', age: 39, alive: true, willing: true, location: 'A', health: 100, mind: 100, spirituality: 100, injuries: [] },
    cart: { id: 'CW3-CART', owner: 'GUIDE', quantity: 1, location: 'A', control: 'GUIDE', releases: 0, returns: 0 }, parcel: { id: 'CW3-PARCEL', owner: 'GUIDE', quantity: 1, massGrams: 400, sealed: true, location: 'CW3-CART' }, stops: [{ id: 'CW3-STOP-B', location: 'B', padded: true }, { id: 'CW3-STOP-C', location: 'C', padded: true }],
    pouch: { id: 'CW3-POUCH', owner: 'CW3-VERA', quantity: 1, opaque: true, location: 'VERA', draws: 0, returns: 0 }, tags: [{ id: 'CW3-TAG-A', owner: 'CW3-VERA', quantity: 1, location: 'POUCH' }, { id: 'CW3-TAG-B', owner: 'CW3-VERA', quantity: 1, location: 'POUCH' }],
    disc: { id: 'CW3-DISC', owner: 'GUIDE', quantity: 1, location: 'A', control: 'GUIDE', pointer: null, spins: 0, returns: 0 }, record: { id: 'CW3-RECORD', owner: 'CW3-VERA', quantity: 1, location: 'B', text: 'CW3-VERA，39岁；原A/B两签各一、同一不透明袋。本次许可可撤回，撤回后只准普通抽签，A基准50%。' }, forecast: { id: 'CW3-FORECAST', owner: 'GUIDE', quantity: 1, location: 'B', text: '同一转盘A基准50%；一次成功且尚未到期的G修正仅降至25%，仍可能停A，任何结果都不保证未来。' },
    cases: { 'cart-fork': freshCase(), 'revoked-draw': freshCase(), counterexample: freshCase() }, reflected: false, accumulations: [] };
}
export function validateChaosWalkerActivityCommand(v: unknown): v is ChaosWalkerActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT' || v.type === 'ACCUMULATE') return shape(v, ['type']);
  if (!CHAOS_WALKER_CASE_IDS.includes(v.caseId as ChaosWalkerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONFIRM_LIMITED') return v.caseId === 'counterexample' && shape(v, ['type', 'caseId', 'claim']) && ['LIMITED', 'GUARANTEED'].includes(String(v.claim));
  if (!shape(v, ['type', 'caseId'])) return false;
  if (['RELEASE_CART', 'WALK_RESULT', 'RETURN_CART'].includes(v.type) && v.caseId !== 'cart-fork' || v.type === 'DRAW_TAG' && v.caseId !== 'revoked-draw' || ['SPIN_DISC', 'COMPARE_RESULT'].includes(v.type) && v.caseId !== 'counterexample' || ['WALK_B', 'READ_RECORD', 'RETURN_A'].includes(v.type) && v.caseId === 'cart-fork') return false;
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', 'WITHDRAW', ...SCENES].includes(v.type);
}
export const currentChaosWalkerAttempt = (s: SliceState) => s.chaosWalker.life.activeCase ? s.chaosWalker.life.cases[s.chaosWalker.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.chaosWalker.life, a = currentChaosWalkerAttempt(s);
  if (a?.inputActive || (a?.pendingRemainingSeconds ?? 0) > 0) return '须实际STOP_INPUT停止并取消尚未使用的修正；关页面不代办。';
  if (l.cart.location !== 'A' || l.cart.control !== 'GUIDE' || l.disc.control !== 'GUIDE' || l.tags.some(t => t.location !== 'POUCH')) return '须本人走到真实原物，原车推回A、原签放回同袋、原盘交回控制，不能远程归还。';
  return l.playerLocation !== 'START' || l.guide.location !== 'START' ? '须沿原路普通返回START，本人和导师都不能瞬移。' : null;
}
export const hasChaosWalkerLifeLock = (s: SliceState): boolean => s.chaosWalker.life.activeCase !== null || Object.values(s.chaosWalker.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
function sceneReason(s: SliceState, id: ChaosWalkerCaseId, type: SceneType | 'CONFIRM_LIMITED'): string | null {
  const l = s.chaosWalker.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation;
  if (type === 'STOP_INPUT') return a.abilityTier !== null && !a.stopped ? null : '没有尚未停止的本次真实能力尝试。';
  if (type === 'WAIT_EFFECT') return a.abilityTier !== null && !a.waitCompleted && !a.eventDraws && !a.stopped && id !== 'revoked-draw' ? null : '仅尚未发生事件、尚未停止的本次输入可实际等待；撤回许可须立即停止。';
  if (type === 'RETURN_START') return at === 'A' && a.objectsReturned && a.outcomeRecorded && !a.inputActive ? null : '须原物真正归主、停止输入并如实记录后，再实走4米回START。';
  if (a.outcomeRecorded) return '本次已如实记录，只可真正退出，不重演原结果。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 ? null : '本次须且只可从START普通走4米进入A一次。';
  if (type === 'CHECK_OBJECT') return at === 'A' && !a.objectChecked ? null : '须本人先到A，只核一次原物与当前许可。';
  if (type === 'PERFORM' || type === 'ORDINARY_CHECK') {
    if (a.resolutionPaid || !a.objectChecked || at !== 'A') return '須在A核过原物，且本次未曾付费实施；失败不能重抽。';
    if (s.actionsRemaining < 1) return '首次实际实施需要1行动。';
    if (type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') return null;
    if (id === 'revoked-draw' && (a.consent !== 'GRANTED' || !l.volunteer.willing)) return '薇拉没有本次当前明确同意，不能再问或施术；可以普通实施。';
    return s.spirituality < 5 ? '能力实耗5灵性，不能透支；可普通实施。' : s.mind < 1 ? '能力实耗1精神；可普通实施。' : s.winner.luck.stored < 1 ? '唯一原幸运储备不足1份；场内不能积运，可普通实施。' : null;
  }
  if (['RELEASE_CART', 'DRAW_TAG', 'SPIN_DISC'].includes(type)) {
    if (at !== 'A' || !a.resolutionPaid || a.eventDraws !== 0) return '须已付本次实施、本人在A且原物尚未发生这一次事件；严禁重抽。';
    return id === 'revoked-draw' && a.abilityTier !== null && (!a.stopped || a.consent !== 'REVOKED' || a.pendingRemainingSeconds !== 0) ? '薇拉已撤回许可，必须STOP_INPUT丢弃待用修正，再由她亲手普通抽签。' : null;
  }
  if (type === 'WALK_RESULT') return at === 'A' && a.eventDraws === 1 && !a.inputActive && (l.cart.location === 'B' || l.cart.location === 'C') && !a.resultRead ? null : '先真实放车并停止输入，才可沿实际岔路走4米到同一车。';
  if (type === 'READ_RESULT') return a.eventDraws === 1 && !a.resultRead && (id === 'cart-fork' ? at === l.cart.location && at !== 'A' : at === 'A') ? null : '本人须在实际原车、原签或原指针旁，亲读这一次不可重抽的结果。';
  if (type === 'RETURN_CART') return a.resultRead && (at === 'B' || at === 'C') && at === l.cart.location && !a.inputActive ? null : '须本人已走到原车并读原车签，再手推同一车与原包4米回A。';
  if (type === 'WALK_B') return at === 'A' && a.resultRead && !a.recordRead && !a.inputActive ? null : '须读真实结果且停止输入，再走4米到B读原记录。';
  if (type === 'READ_RECORD') return at === 'B' && !a.recordRead ? null : '本人必须真实走到B亲读唯一原纸。';
  if (type === 'RETURN_A') return at === 'B' && a.recordRead ? null : '先在B亲读原纸，再真实走4米返回A。';
  if (type === 'COMPARE_RESULT') return at === 'A' && a.resultRead && a.recordRead && !a.compared ? null : '须实走B读取原预测再返A，比较同一原指针；不重抽。';
  if (type === 'CONFIRM_LIMITED') return at === 'A' && a.compared && !a.limitedConfirmed ? null : '须已核原指针和原预测，才能确认一次有限结论。';
  if (type === 'RETURN_OBJECT') return at === 'A' && a.resultRead && !a.objectsReturned && !a.inputActive && a.pendingRemainingSeconds === 0 && (id === 'cart-fork' ? l.cart.location === 'A' && l.guide.location === 'A' : id === 'revoked-draw' ? a.recordRead : a.compared && l.guide.location === 'A') ? null : '须停止输入、核原物与原记录并回A，才可实际交还同一原物或控制权。';
  if (type === 'RECORD_OUTCOME') return at === 'A' && a.objectsReturned && a.resolutionPaid && a.resultRead && a.eventDraws === 1 && !a.inputActive && (id === 'cart-fork' || a.recordRead) && (id !== 'counterexample' || a.compared) ? null : '须一次真实事件、实际核查原结果和原纸、停止输入并原物归还，才能诚实记录有限结论。';
  return '本案不支持此动作。';
}
export function chaosWalkerActivityReason(s: SliceState, c: ChaosWalkerActivityCommand): string | null {
  if (!validateChaosWalkerActivityCommand(c)) return '混乱行者命令无效、字段多余或不属于本案。';
  if (!promoted(s)) return '先实际晋升候选混乱行者序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '同一本体已死亡或周目结束，不能操作、复活或代办归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.chaosWalker.encounter.status)) return '先处理当前事件或战斗，同一本体不能同时在两处。';
  if (s.world.city !== 'BACKLUND') return '须实际回贝克兰德原机械工坊。';
  const l = s.chaosWalker.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '仅可取消尚未开始的准备；场内可普通完成，已发生结果不能撤销。';
  if (c.type === 'LEAVE_CASE') return r?.contactOpen && l.activeCase === c.caseId && r.attempts.at(-1)?.outcomeRecorded ? cleanupBlock(s) : '须先完成真实事件、归还原物、如实记录并返回START。';
  if (SCENES.includes(c.type as SceneType) || c.type === 'CONFIRM_LIMITED') return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType | 'CONFIRM_LIMITED') : '先START_CASE打开本案实际现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '须先处理本案真实结果、原物与普通返回，不能场内积运。';
  if (Object.entries(l.cases).some(([id, item]) => item.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '须先实施或取消当前准备，不能准备中积运。';
  if (hasChaosWalkerOldPractice(s) || hasChaosWalkerRitualLock(s)) return '须先真实结束全部旧实践、接触与服药准备。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '新行动须有精神与1行动；已付现场的实际收束不额外收费。';
  if (c.type === 'ACCUMULATE') return s.winner.luck.stored >= 3 ? '唯一旧幸运储备已到3份上限。' : s.winner.luck.lastAccumulateWeek === s.week ? '本真实周已实际积运，须下一真实周。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '本次反思已完成。' : CHAOS_WALKER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!('caseId' in c) || !r || r.status === 'RESOLVED') return '本案有限报告已完成。';
  const i = CHAOS_WALKER_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[CHAOS_WALKER_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '须先完成上一份真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '同一原案只观察一次。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原物与边界。' : s.actionsRemaining < 2 ? '准备需1行动，并留1行动首次实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先选择能力或普通准备。';
  return r.status === 'EXAMINED' && r.attempts.at(-1)?.outcomeRecorded && !r.contactOpen ? null : '须实际完成本案、原物归主并真正退出才可报告。';
}
export const blockChaosWalkerLife = chaosWalkerActivityReason;
export function advanceChaosWalkerLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.chaosWalker.life.clockSeconds + seconds)) throw new Error('原机械工坊累计时钟无效。');
  s.chaosWalker.life.clockSeconds += seconds;
}
function elapse(s: SliceState, a: ChaosWalkerAttempt, seconds: number) {
  a.elapsedSeconds += seconds; advanceChaosWalkerLifeClock(s, seconds);
  if (a.pendingRemainingSeconds > 0) { a.pendingRemainingSeconds = Math.max(0, a.pendingRemainingSeconds - seconds); if (!a.pendingRemainingSeconds && !a.modifierApplied && !a.modifierCancelled) a.modifierExpired = true; }
}
function move(s: SliceState, a: ChaosWalkerAttempt, to: ChaosWalkerLocation, mode: 'WALK' | 'PUSH' = 'WALK') {
  const l = s.chaosWalker.life, itemIds = mode === 'PUSH' ? [l.cart.id, l.parcel.id] : [];
  const movement: ChaosWalkerMovement = { from: l.playerLocation, to, mode, metres: 4, seconds: 4, itemIds };
  a.playerMoves.push(movement); l.playerLocation = to; a.playerTravelMetres += 4; l.playerTravelMetres += 4; elapse(s, a, 4);
  if (mode === 'PUSH') { a.objectMoves.push({ ...movement, itemIds: [...itemIds] }); l.cart.location = 'A'; }
}
function guideMove(s: SliceState, a: ChaosWalkerAttempt, to: 'A' | 'START') { const l = s.chaosWalker.life; a.guideMoves.push({ from: l.guide.location, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [] }); l.guide.location = to; l.guideTravelMetres += 4; }
function startAttempt(s: SliceState, id: ChaosWalkerCaseId) { const l = s.chaosWalker.life, r = l.cases[id]; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = id; }
function evidence(a: ChaosWalkerAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function pay(s: SliceState, a: ChaosWalkerAttempt) { s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions = 1; }
function applyScene(s: SliceState, id: ChaosWalkerCaseId, step: ChaosWalkerLifeStep) {
  const l = s.chaosWalker.life, a = l.cases[id].attempts.at(-1)!; a.steps.push(structuredClone(step));
  switch (step.type) {
    case 'GO_A': if (id !== 'revoked-draw') guideMove(s, a, 'A'); move(s, a, 'A'); break;
    case 'CHECK_OBJECT':
      a.objectChecked = true; elapse(s, a, 2);
      if (id === 'cart-fork') { l.cart.control = 'PLAYER'; evidence(a, l.cart.id, '同一原车、唯一密封400克原包与B/C两原软挡均亲见；两条无人4米轨道，导师在A当面允许本次试验。'); }
      else if (id === 'revoked-draw') { a.consent = a.method === 'ORDINARY' ? 'ORDINARY' : l.volunteer.willing ? 'GRANTED' : 'DECLINED'; evidence(a, l.volunteer.id, `当面核原成年薇拉、同一原袋及两原签；仅本次许可${a.consent}，不复用旧同意、不重复索取。`); }
      else { l.disc.control = 'PLAYER'; evidence(a, l.disc.id, '同一原转盘在A，A/B两扇区与原指针亲见，原盘不离台；导师在A允许本次有限试验。'); }
      break;
    case 'PERFORM': case 'ORDINARY_CHECK':
      pay(s, a); elapse(s, a, 2);
      if (step.type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') { a.ordinaryChecked = true; evidence(a, id === 'revoked-draw' ? l.pouch.id : id === 'cart-fork' ? l.cart.id : l.disc.id, '实付首次1行动，普通检查原机构；没有能力检定、支出幸运或改变事件概率。'); break; }
      s.spirituality -= 5; s.mind -= 1; a.spiritualitySpent = 5; a.mindSpent = 1; a.luckSpent = 1; a.luckBefore = { ...s.winner.luck }; s.winner.luck.stored--; s.winner.luck.spent++; a.luckAfter = { ...s.winner.luck };
      a.abilityCheck = structuredClone(step.check); a.abilityTier = step.check!.tier; a.abilitySourceId = id === 'cart-fork' ? l.cart.id : id === 'revoked-draw' ? l.volunteer.id : l.disc.id; a.abilityAtSecond = a.elapsedSeconds; a.inputActive = true; a.pendingRemainingSeconds = passed(a.abilityTier) ? 30 : 0;
      if (id === 'revoked-draw') { a.consent = 'REVOKED'; a.consentWithdrawn = true; evidence(a, l.volunteer.id, '实际尝试刚结束，本人立即撤回本次能力许可，要求普通抽签；必须STOP_INPUT丢弃待用修正，成功检定也不许应用。'); }
      evidence(a, a.abilitySourceId, `知识20检定${a.abilityTier}；实际5灵性1精神及唯一旧幸运1份已付，只可能待用30秒，尚无物理分支结果。`); break;
    case 'STOP_INPUT': a.inputActive = false; a.stopped = true; if (a.pendingRemainingSeconds > 0) a.modifierCancelled = true; a.pendingRemainingSeconds = 0; break;
    case 'WAIT_EFFECT': { const seconds = a.pendingRemainingSeconds; a.waitCompleted = true; a.waitedSeconds += seconds; elapse(s, a, seconds); break; }
    case 'RELEASE_CART': case 'DRAW_TAG': case 'SPIN_DISC': {
      elapse(s, a, 6); a.modifierApplied = a.pendingRemainingSeconds > 0 && id !== 'revoked-draw'; a.branchChance = a.modifierApplied ? id === 'cart-fork' ? 75 : 25 : 50; a.pendingRemainingSeconds = 0;
      a.branchRoll = step.eventRoll!; a.branchResult = a.branchRoll <= a.branchChance ? id === 'cart-fork' ? 'B' : 'A' : id === 'cart-fork' ? 'C' : 'B'; a.eventDraws = 1; a.eventAtSecond = a.elapsedSeconds; a.eventSourceId = id === 'cart-fork' ? l.cart.id : id === 'revoked-draw' ? l.pouch.id : l.disc.id;
      if (id === 'cart-fork') { l.cart.location = a.branchResult as 'B' | 'C'; l.cart.releases++; a.objectMoves.push({ from: 'A', to: l.cart.location, mode: 'ROLL', metres: 4, seconds: 6, itemIds: [l.cart.id, l.parcel.id] }); }
      else if (id === 'revoked-draw') { l.pouch.draws++; l.tags.find(t => t.id === `CW3-TAG-${a.branchResult}`)!.location = 'VERA_HAND'; }
      else { l.disc.spins++; l.disc.pointer = a.branchResult as 'A' | 'B'; }
      evidence(a, a.eventSourceId, `原机械事件仅抽一次${a.branchRoll}/100；${id === 'cart-fork' ? 'B' : 'A'}阈值${a.branchChance}%，实际${a.branchResult}。检定与事件独立，真实结果不重抽、不倒改。`); break;
    }
    case 'WALK_RESULT': move(s, a, l.cart.location); break;
    case 'READ_RESULT': a.resultRead = true; elapse(s, a, 1); evidence(a, id === 'revoked-draw' ? `CW3-TAG-${a.branchResult}` : a.eventSourceId!, `本人在${l.playerLocation}亲读同一原物实际结果${a.branchResult}，没有远程读物或备用副本。`); break;
    case 'RETURN_CART': move(s, a, 'A', 'PUSH'); break;
    case 'WALK_B': move(s, a, 'B'); break;
    case 'READ_RECORD': a.recordRead = true; elapse(s, a, 2); evidence(a, id === 'revoked-draw' ? l.record.id : l.forecast.id, id === 'revoked-draw' ? l.record.text : l.forecast.text); break;
    case 'RETURN_A': move(s, a, 'A'); break;
    case 'COMPARE_RESULT': a.compared = true; elapse(s, a, 1); evidence(a, l.disc.id, `原指针仍${l.disc.pointer}；同一原预测说概率不是保证，真实结果无论A/B均保留。`); break;
    case 'CONFIRM_LIMITED': if (step.claim === 'GUARANTEED') a.rejectedClaims++; else a.limitedConfirmed = true; break;
    case 'RETURN_OBJECT':
      a.objectsReturned = true; elapse(s, a, 2);
      if (id === 'cart-fork') { l.cart.control = 'GUIDE'; l.cart.returns++; evidence(a, l.cart.id, '本人已推同一原车载同一封包回A，亲交在A的原导师；原物留A，不远程归还。'); }
      else if (id === 'revoked-draw') { l.tags.find(t => t.location === 'VERA_HAND')!.location = 'POUCH'; l.pouch.returns++; evidence(a, l.pouch.id, '当面见薇拉将亲手抽出的同一原签放回同一原袋，两原签及原袋仍归她，没有替换或新抽签。'); }
      else { l.disc.control = 'GUIDE'; l.disc.returns++; evidence(a, l.disc.id, '同一原盘始终留A，真实指针保持；本人在A亲交控制权给原导师。'); } break;
    case 'RECORD_OUTCOME':
      a.outcomeRecorded = true; if (id === 'counterexample') a.limitedConfirmed = true; a.result = a.modifierApplied ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result; elapse(s, a, 1);
      a.outcome = `检定${a.abilityTier ?? '未施术'}；原事件仅一次${a.branchRoll}/100，${id === 'cart-fork' ? 'B' : 'A'}概率${a.branchChance}%，实际${a.branchResult}。${a.modifierApplied ? '修正确已用于这一次未发生分支，仍无保证' : a.consentWithdrawn ? '本人当前许可已撤回，修正未应用，无能力掌握' : '普通事件或修正未实际应用，无能力掌握'}；原物实际归主，费用保留，已发生结果不重抽。`; break;
    case 'RETURN_START': if (id !== 'revoked-draw') guideMove(s, a, 'START'); move(s, a, 'START'); break;
  }
}
export function applyChaosWalkerActivity(s: SliceState, c: ChaosWalkerActivityCommand, ctx: SeerContext, _award?: (id: typeof BUFFER | typeof IMPEDIMENT, amount?: number) => void): void {
  const reason = chaosWalkerActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.chaosWalker.life;
  if (c.type === 'ACCUMULATE') { const luck = s.winner.luck, before = luck.stored; s.actionsRemaining--; luck.stored++; luck.accumulated++; luck.lastAccumulateWeek = s.week; l.accumulations.push({ week: s.week, actionCost: 1, storedBefore: before, storedAfter: luck.stored, accumulatedAfter: luck.accumulated, spentAtTime: luck.spent }); ctx.note('实际继续积累唯一旧幸运', `实付1行动，winner.luck原储备${before}→${luck.stored}/3；本真实周不能再积运，不补灵、不治疗、不创建新池。`); return; }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('chaos-walker-reflection'); ctx.note('G · 回看有限概率与当前许可', '三份真实报告后反思扮演+25。成功检定不是保证；取消或未应用不给能力掌握，不重置旧幸运与任何旧历史。'); return; }
  if (!('caseId' in c)) throw new Error('本场缺少原案标识。');
  const r = l.cases[c.caseId], spec = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备1行动已付；${c.method === 'ABILITY' ? '实际施术另付1行动5灵性1精神及1份唯一旧幸运' : '普通实施另1行动0灵性0精神0幸运'}。此时不施术、不取得未来结果或本人的当前同意。`); return; }
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未开始的准备', '准备成本不退，原人原物不变，不抽任何随机数。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, '0行动只打开现场，本人和原导师仍在START；原人原物没有移动，不自动取得当前同意。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[abilityFor(c.caseId)] = Math.min(500, (s.progression.mastery[abilityFor(c.caseId)] ?? 0) + 8); ctx.note(spec.title, `${r.attempts[0]!.outcome} 真实报告扮演+25；${r.result === 'ABILITY' ? '实际应用的一次修正对应新掌握+8' : '未应用修正，不给能力掌握'}。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('已真正退出原机械工坊', '本人和导师回START，原车载同一包停A，原盘留A且指针不重置，原签与原袋归薇拉；不退费用、不恢复资源。'); return; }
  const check = c.type === 'PERFORM' && a.method === 'ABILITY' ? ctx.check('knowledge', 20) : null;
  const eventRoll = ['RELEASE_CART', 'DRAW_TAG', 'SPIN_DISC'].includes(c.type) ? ctx.roll(1, 100) : null;
  applyScene(s, c.caseId, { type: c.type as SceneType | 'CONFIRM_LIMITED', atSecond: a.elapsedSeconds, check, eventRoll, willing: l.volunteer.willing, claim: c.type === 'CONFIRM_LIMITED' ? c.claim : null });
  ctx.note(`G · ${c.type}`, `${c.type === 'RECORD_OUTCOME' ? a.outcome : c.type === 'CONFIRM_LIMITED' && c.claim === 'GUARANTEED' ? 'GUARANTEED被拒绝，原结果、原物和费用保持，不重抽。' : '只处理本次原物、当前许可与真实时间。'} 本人${l.playerLocation}；本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，待用修正${a.pendingRemainingSeconds}秒，原事件次数${a.eventDraws}。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人实走到A', '0行动 · 4米4秒'], CHECK_OBJECT: ['亲核原物、原挡与本次当前许可', '0行动 · 2秒'], PERFORM: ['实际实施本案一次方案', '1行动 · 能力另5灵性1精神1旧幸运、知识20'], ORDINARY_CHECK: ['改用普通实施，保持50%原概率', '首次1行动 · 0灵性0精神0幸运'], STOP_INPUT: ['停止输入，丢弃尚未使用的修正', '0行动0秒 · 已付不退，已发生结果不变'], WAIT_EFFECT: ['实际等待本次剩余修正到期', '0行动0灵性 · 剩余真实秒数'], RELEASE_CART: ['真实释放同一原车一次', '0行动 · 6秒 · 新抽一次1..100'], DRAW_TAG: ['由薇拉本人亲手普通抽原签一次', '0行动 · 6秒 · A仍50%'], SPIN_DISC: ['真实转动同一原盘一次', '0行动 · 6秒 · 新抽一次1..100'], WALK_RESULT: ['沿实际岔路走到原车', '0行动 · 4米4秒'], READ_RESULT: ['亲读同一原物的真实结果', '0行动 · 1秒'], RETURN_CART: ['手推同一原车与原包回A', '0行动 · 4米4秒'], WALK_B: ['本人普通走到B', '0行动 · 4米4秒'], READ_RECORD: ['在B亲读同一原记录', '0行动 · 2秒'], RETURN_A: ['本人从B实走回A', '0行动 · 4米4秒'], COMPARE_RESULT: ['比较原预测与未重置的原指针', '0行动 · 1秒'], RETURN_OBJECT: ['在A实际归还同一原物或控制权', '0行动 · 2秒'], RECORD_OUTCOME: ['如实记录实际结果及不保证结论', '0行动 · 1秒'], RETURN_START: ['本人沿原路普通返回START', '0行动 · 4米4秒'],
};
export function chaosWalkerLifeActions(s: SliceState): ChaosWalkerLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.chaosWalker.life, actions: ChaosWalkerLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: ChaosWalkerActivityCommand) => { const reason = chaosWalkerActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[CHAOS_WALKER_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原物与概率边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备一次有限概率能力', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备完全普通的原物试验', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案实际现场', '0行动', { type: 'START_CASE', caseId: id }); add(`${id}-withdraw`, '取消尚未开始的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of SCENES) { const c = { type, caseId: id } as ChaosWalkerActivityCommand; if (!validateChaosWalkerActivityCommand(c)) continue; const waitingAbility = type === 'PERFORM' && a.method === 'ABILITY' && a.objectChecked && !a.resolutionPaid; if (chaosWalkerActivityReason(s, c) === null || waitingAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], type === 'PERFORM' && a.method === 'ORDINARY' ? '1行动 · 0灵性0精神0幸运 · 2秒' : LABELS[type][1], c); }
      if (id === 'counterexample' && a.compared && !a.limitedConfirmed) for (const claim of ['LIMITED', 'GUARANTEED'] as const) add(`${id}-${claim.toLowerCase()}`, claim === 'LIMITED' ? '确认本次概率只是有限结论' : '声称保证结果（当面拒绝）', '0行动 · 不重抽', { type: 'CONFIRM_LIMITED', caseId: id, claim });
      if (cleanupBlock(s) === null && a.outcomeRecorded) add(`${id}-leave`, '关闭已经真正退出的现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告实际分支、当前许可与原物归还', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '实际应用掌握+8' : '无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && CHAOS_WALKER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('chaos-walker-reflect', '反思未发生分支与当前同意', '1行动 · 扮演+25', { type: 'REFLECT' });
  add('chaos-walker-accumulate', '实际积累唯一旧幸运储备', '1行动 · 每真实周一次 · 上限3', { type: 'ACCUMULATE' });
  return actions;
}
export function projectChaosWalkerLife(s: SliceState): ChaosWalkerLifeProjection {
  const l = s.chaosWalker.life, a = currentChaosWalkerAttempt(s), actions = chaosWalkerLifeActions(s), inside = hasChaosWalkerLifeLock(s);
  const next = actions.find(v => v.enabled && !['WITHDRAW', 'ORDINARY_CHECK', 'WAIT_EFFECT', 'STOP_INPUT', 'ACCUMULATE', 'CONFIRM_LIMITED'].includes(v.command.type)) ?? actions.find(v => v.enabled);
  const summary = `本人${l.playerLocation}，普通步行${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒；唯一旧幸运${s.winner.luck.stored}/3，累计积累${s.winner.luck.accumulated}、实际支出${s.winner.luck.spent}。`;
  return { ...structuredClone(l), title: '混乱行者 · 有限的未发生分支', story: CHAOS_WALKER_LIFE_STORY, summary, environment: CHAOS_WALKER_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, luck: { ...s.winner.luck, capacity: 3 }, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : '本阶段真实报告完成，可继续普通生活。', facts: [summary, `原车${l.cart.id}在${l.cart.location}、控制${l.cart.control}；唯一密封400克${l.parcel.id}一直在同一车内；B/C两原软挡在各自4米支路。`, `39岁原成年薇拉${l.volunteer.id}在A，健康/精神/灵性均100；同一原袋${l.pouch.id}始终归她，原签${l.tags.map(t => `${t.id}:${t.location}`).join('、')}。`, `原盘${l.disc.id}始终在A，指针${l.disc.pointer ?? '尚未转动'}、控制${l.disc.control}；原记录${l.record.id}与原预测${l.forecast.id}在B，须本人实走亲读。`, `原导师${l.guide.name}现在${l.guide.location}，已实际步行${l.guideTravelMetres}米，交接不会召唤异地原主。`, a ? `知识20检定${a.abilityTier ?? '尚未施术'}；待用修正${a.pendingRemainingSeconds}秒，实际应用${a.modifierApplied ? '是' : '否'}，当前许可${a.consent}；后续原事件${a.eventDraws}次，抽数${a.branchRoll ?? '未发生'}，阈值${a.branchChance ?? '未发生'}%，真实结果${a.branchResult ?? '未发生'}。` : '检定成功仅能待用；独立机械事件才决定真实分支，取消与过期不退费也不给掌握。', a?.outcome ?? '没有保证未来、重抽或第二幸运池。'],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.attempts[0]?.outcome ?? null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

const validLuck = (v: unknown): v is WinnerLuck => record(v) && shape(v, ['stored', 'lastAccumulateWeek', 'accumulated', 'spent']) && integer(v.stored, 0, 3) && integer(v.accumulated) && integer(v.spent) && v.accumulated - v.spent === v.stored && (v.lastAccumulateWeek === null || integer(v.lastAccumulateWeek, 1));
/** Replays separate checks/events and every original movement; never trusts an outcome or cost label. */
export function validateChaosWalkerLife(s: SliceState): boolean {
  const l = s.chaosWalker.life, initial = createChaosWalkerLifeState(), promotion = s.chaosWalker.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, CHAOS_WALKER_CASE_IDS) || !record(l.volunteer) || typeof l.volunteer.willing !== 'boolean' || !Array.isArray(l.accumulations) || !integer(l.clockSeconds) || !validLuck(s.winner.luck)) return false;
  let previousWeek = 0, previousAccumulated = 0, previousSpent = 0;
  for (const receipt of l.accumulations) {
    if (!record(receipt) || !shape(receipt, ['week', 'actionCost', 'storedBefore', 'storedAfter', 'accumulatedAfter', 'spentAtTime']) || promotion === null || !integer(receipt.week, promotion, s.week) || receipt.week <= previousWeek || receipt.actionCost !== 1 || !integer(receipt.storedBefore, 0, 2) || receipt.storedAfter !== receipt.storedBefore + 1 || !integer(receipt.accumulatedAfter, previousAccumulated + 1, s.winner.luck.accumulated) || !integer(receipt.spentAtTime, previousSpent, s.winner.luck.spent) || receipt.accumulatedAfter - receipt.spentAtTime !== receipt.storedAfter || (s.winner.luck.lastAccumulateWeek ?? 0) < receipt.week) return false;
    previousWeek = receipt.week; previousAccumulated = receipt.accumulatedAfter; previousSpent = receipt.spentAtTime;
  }
  let externalSeconds: number = s.chaosWalker.encounter.exitSeconds;
  if (!integer(externalSeconds, 0, 4) || ![0, 4].includes(externalSeconds)) return false;
  for (const round of s.combatHistory) { const outcome = round.chaosWalkerOutcome; if (outcome) { if (outcome.elapsedSeconds !== 60) return false; externalSeconds += outcome.elapsedSeconds; } }
  if (!integer(externalSeconds)) return false;
  const replay = createChaosWalkerLifeState(); replay.clockSeconds = externalSeconds; replay.accumulations = structuredClone(l.accumulations); replay.volunteer.willing = l.volunteer.willing;
  if (promotion === null) return l.accumulations.length === 0 && stableStringify(l) === stableStringify(replay);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(replay);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['cart-fork'].observedWeek !== l.introducedWeek) return false;
  replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, winner: { ...s.winner, luck: { ...s.winner.luck } }, chaosWalker: { ...s.chaosWalker, life: replay } };
  let open = 0, prepared = 0, resolved = 0, bufferMastery = 0, impedimentMastery = 0, lastAttemptWeek = promotion;
  for (const [index, id] of CHAOS_WALKER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[CHAOS_WALKER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') { if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false; if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue; }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, Math.max(r.observedWeek, lastAttemptWeek), s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !integer(a.initialKnowledge, 0, 500) || !validLuck(a.initialLuck) || (a.initialLuck.lastAccumulateWeek ?? 0) > a.week || a.initialLuck.accumulated > s.winner.luck.accumulated || a.initialLuck.spent > s.winner.luck.spent || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    lastAttemptWeek = a.week; shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind; shadow.actionsRemaining = 100; shadow.character = { ...s.character, coreStats: { ...s.character.coreStats, knowledge: a.initialKnowledge } }; shadow.winner.luck = { ...a.initialLuck };
    replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [], status: 'PREPARED', contactOpen: false, closes: 0, returned: false };
    startAttempt(shadow, id); const expected = replay.cases[id].attempts[0]!;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'atSecond', 'check', 'eventRoll', 'willing', 'claim']) || typeof step.willing !== 'boolean' || step.atSecond !== expected.elapsedSeconds) return false;
      const casting = step.type === 'PERFORM' && a.method === 'ABILITY', event = ['RELEASE_CART', 'DRAW_TAG', 'SPIN_DISC'].includes(step.type);
      if (casting) { if (!record(step.check) || !integer(step.check.roll, 1, 100) || stableStringify(step.check) !== stableStringify(resolveNormalCheck({ ability: 'knowledge', baseAbility: a.initialKnowledge, difficulty: 20, modifiers: [], roll: step.check.roll }))) return false; } else if (step.check !== null) return false;
      if (event ? !integer(step.eventRoll, 1, 100) : step.eventRoll !== null) return false;
      const command = step.type === 'CONFIRM_LIMITED' ? { type: step.type, caseId: id, claim: step.claim } : { type: step.type, caseId: id };
      if (step.type !== 'CONFIRM_LIMITED' && step.claim !== null || !validateChaosWalkerActivityCommand(command)) return false;
      replay.volunteer.willing = step.willing;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.outcomeRecorded || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed || a.luckAfter && (a.luckAfter.accumulated > s.winner.luck.accumulated || a.luckAfter.spent > s.winner.luck.spent)) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || stableStringify(shadow.winner.luck) !== stableStringify(s.winner.luck)) return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (a.modifierApplied) { if (id === 'cart-fork') bufferMastery += 8; else impedimentMastery += 8; } }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3 || prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.volunteer.willing = l.volunteer.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[BUFFER] ?? 0) === bufferMastery && (s.progression.mastery[IMPEDIMENT] ?? 0) === impedimentMastery;
}
