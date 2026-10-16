import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasFearBishopLifeLock } from '../fear-bishop/life.js';

export const CONCEALMENT_SERVANT_CASE_IDS = ['consented-box', 'withdrawn-consent', 'blocked-door'] as const;
export type ConcealmentServantCaseId = typeof CONCEALMENT_SERVANT_CASE_IDS[number];
export type ConcealmentServantConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'CLOSED';
export type ConcealmentServantWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED' | 'COUNTERED';
const STEP_TYPES = ['READ_SOURCE', 'CHECK_DOOR', 'CONSENT_OWNER', 'DECLINE_OWNER', 'CONSENT_PARTICIPANT', 'DECLINE_PARTICIPANT', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_BOX', 'CONCEAL', 'TRACE_VEIL', 'MOVE_BOX', 'WEAK_SEARCH', 'LIGHT_ANCHOR', 'SWITCH_OFF_ANCHOR', 'RELEASE_CONCEALMENT', 'RETURN_BOX', 'BLOCK_DOOR', 'UNBOLT_DOOR', 'EXIT_ROOM', 'WAIT_20', 'INSPECT'] as const;
export type ConcealmentServantStep = typeof STEP_TYPES[number];
export type ConcealmentServantActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | ConcealmentServantStep; caseId: ConcealmentServantCaseId }
  | { type: 'PREPARE'; caseId: ConcealmentServantCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WITHDRAW_CONSENT'; caseId: ConcealmentServantCaseId; actor: 'ERIN' | 'PLAYER' }
  | { type: 'REFLECT' };
export interface ConcealmentServantAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: ConcealmentServantWindow; remainingSeconds: number;
}
export interface ConcealmentServantAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; erinTravelMetres: number; boxTravelMetres: number; spiritualitySpent: number;
  ownerConsent: ConcealmentServantConsent; ownerConsentWeek: number | null;
  participantConsent: ConcealmentServantConsent; participantConsentWeek: number | null;
  sourceRead: boolean; doorChecked: boolean; returnAgreed: boolean; entered: boolean; exited: boolean;
  boxTaken: boolean; boxMoved: boolean; boxReturned: boolean; inspected: boolean;
  stoppedBy: 'ERIN' | 'PLAYER' | null; doorBlocked: boolean; releasedAfterBlock: boolean; doorUnbolted: boolean;
  lightUsed: boolean; waits: number;
  concealment: ConcealmentServantAbilityUse; traceVeil: ConcealmentServantAbilityUse;
  search: { requestedAt: number; completedAt: number; delayedSeconds: number; result: 'LOCATED' | 'ROOM_CONCEALED' } | null;
}
export interface ConcealmentServantCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: ConcealmentServantAttempt[];
}
export interface ConcealmentServantLifeEvent {
  week: number; command: ConcealmentServantActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null;
}
export interface ConcealmentServantLifeState {
  activeCase: ConcealmentServantCaseId | null; reflected: boolean;
  playerLocation: 'EXIT' | 'ROOM'; playerTravelMetres: number; clockSeconds: number;
  erin: { id: 'CS2-ERIN'; name: '艾琳'; age: 38; alive: true; health: 100; mind: 100; location: 'EXIT' | 'ROOM'; travelMetres: number };
  room: { id: 'CS2-ROOM'; lengthMetres: 6; doorId: 'CS2-DOOR'; doorBlocked: boolean; concealed: boolean; remainingSeconds: number };
  box: { id: 'CS2-CASE-1'; owner: 'CS2-ERIN'; location: 'START' | 'PLAYER' | 'TABLE'; travelMetres: number };
  page: { id: 'CS2-PAGE-1'; owner: 'CS2-ERIN'; location: 'ROOM'; text: string };
  trace: { id: 'CS2-TRACE-1'; source: string; alive: false; conscious: false; exists: true; searches: number; delayedSearches: number; totalDelaySeconds: number };
  anchorLight: { id: 'CS2-ANCHOR-LIGHT'; owner: 'CS2-ERIN'; location: 'ROOM'; on: boolean };
  cases: Record<ConcealmentServantCaseId, ConcealmentServantCaseState>; journal: ConcealmentServantLifeEvent[];
}
export interface ConcealmentServantLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ConcealmentServantActivityCommand }
export interface ConcealmentServantLifeProjection {
  title: string; story: string; environment: string; activeCase: ConcealmentServantCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: ConcealmentServantLifeState['playerLocation']; playerTravelMetres: number;
  erin: ConcealmentServantLifeState['erin']; room: ConcealmentServantLifeState['room']; box: ConcealmentServantLifeState['box']; page: ConcealmentServantLifeState['page']; trace: ConcealmentServantLifeState['trace']; anchorLight: ConcealmentServantLifeState['anchorLight'];
  currentAttempt: ConcealmentServantAttempt | null;
  cases: { id: ConcealmentServantCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ConcealmentServantAttempt[] }[];
  actions: ConcealmentServantLifeAction[];
}
export const CONCEALMENT_SERVANT_TRACE_SOURCE = '原创G登记CS2-PAGE-1：原封签盒上同一无生命弱追踪标记CS2-TRACE-1，仅本场主动检索；不是原灵、物种或全知观测，原标记与既有记录始终保留。';
export const CONCEALMENT_SERVANT_LIFE_STORY = '已核有可解除的隐秘世界；“隐秘之仆”对应序列2为高置信推断，并非原文直接编号。下述人物、6米房间、60秒隐秘、20秒遮踪、成本、检定与成长均为原创G。身体、原物、所有权、纸面记录和真实伤势始终存在。三案报告各25扮演、反思25；每案各新技能仅实际应用后+8掌握，检定成功但未应用不计。';
const PAGE_TEXT = 'CS2-CASE-1归艾琳；只在本次当面同意下移动，撤回即停止。CS2-ROOM长6米，仅CS2-DOOR一扇原门；门闩受阻先解除隐秘，再普通解闩，沿原路离场。弱标记只检索一次。';
const CASES = [
  { id: 'consented-box', title: '当次同意下的原盒', story: '38岁原保管员艾琳分别以物主与参与者身份回答本次邀请。双方走原6米入口，移动同一原盒并核对一次弱检索，最后归还原盒、解除并普通退出。' },
  { id: 'withdrawn-consent', title: '撤回后停止与归还', story: '另一次现场重新取得两项当前许可。艾琳可撤回尚未应用的窗口；停止不退款，须亲手归还手中原盒，原人沿原门离场。旧许可不续用。' },
  { id: 'blocked-door', title: '受阻原门与普通返程', story: '双方在原房间内实际放下同一原门闩。隐秘不绕过门；先明确解除，再普通解闩、还物，双方沿原6米路退出。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 2;
const freshUse = (): ConcealmentServantAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0 });
const freshCase = (): ConcealmentServantCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): ConcealmentServantAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, erinTravelMetres: 0, boxTravelMetres: 0, spiritualitySpent: 0,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, participantConsent: 'UNASKED', participantConsentWeek: null, sourceRead: false, doorChecked: false, returnAgreed: false, entered: false, exited: false,
    boxTaken: false, boxMoved: false, boxReturned: false, inspected: false, stoppedBy: null, doorBlocked: false, releasedAfterBlock: false, doorUnbolted: false, lightUsed: false, waits: 0,
    concealment: freshUse(), traceVeil: freshUse(), search: null };
}
export function createConcealmentServantLifeState(): ConcealmentServantLifeState {
  return { activeCase: null, reflected: false, playerLocation: 'EXIT', playerTravelMetres: 0, clockSeconds: 0,
    erin: { id: 'CS2-ERIN', name: '艾琳', age: 38, alive: true, health: 100, mind: 100, location: 'EXIT', travelMetres: 0 },
    room: { id: 'CS2-ROOM', lengthMetres: 6, doorId: 'CS2-DOOR', doorBlocked: false, concealed: false, remainingSeconds: 0 },
    box: { id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'START', travelMetres: 0 }, page: { id: 'CS2-PAGE-1', owner: 'CS2-ERIN', location: 'ROOM', text: PAGE_TEXT },
    trace: { id: 'CS2-TRACE-1', source: CONCEALMENT_SERVANT_TRACE_SOURCE, alive: false, conscious: false, exists: true, searches: 0, delayedSearches: 0, totalDelaySeconds: 0 },
    anchorLight: { id: 'CS2-ANCHOR-LIGHT', owner: 'CS2-ERIN', location: 'ROOM', on: false },
    cases: { 'consented-box': freshCase(), 'withdrawn-consent': freshCase(), 'blocked-door': freshCase() }, journal: [] };
}
const current = (l: ConcealmentServantLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const lockedLife = (l: ConcealmentServantLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED') || l.playerLocation !== 'EXIT' || l.erin.location !== 'EXIT' || l.box.location !== 'START' || l.room.concealed || l.room.doorBlocked || l.anchorLight.on;
export const hasConcealmentServantLifeLock = (s: SliceState): boolean => lockedLife(s.concealmentServant.life);
export const concealmentServantInside = hasConcealmentServantLifeLock;
export function validateConcealmentServantActivityCommand(v: unknown): v is ConcealmentServantActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!CONCEALMENT_SERVANT_CASE_IDS.includes(v.caseId as ConcealmentServantCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'actor']) && ['ERIN', 'PLAYER'].includes(String(v.actor));
  return shape(v, ['type', 'caseId']) && [...STEP_TYPES, 'OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isConcealmentServantActivityCommand = validateConcealmentServantActivityCommand;
export const isConcealmentServantActivity = validateConcealmentServantActivityCommand;
const permitted = (a: ConcealmentServantAttempt, week: number) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === week && a.participantConsent === 'GRANTED' && a.participantConsentWeek === week && a.stoppedBy === null;
function cleanupBlock(l: ConcealmentServantLifeState): string | null {
  if (l.room.concealed || current(l)?.traceVeil.state === 'ACTIVE') return '先解除本次有限窗口；解除不移动原人原物。';
  if (l.room.doorBlocked) return '原门真实受阻：先明确解除隐秘，再普通解闩。';
  if (l.box.location !== 'START') return '先亲手归还同一原盒到原处，所有权不变。';
  if (l.anchorLight.on) return '先普通关闭本次原锚定灯。';
  return l.playerLocation !== 'EXIT' || l.erin.location !== 'EXIT' ? '双方须沿原6米普通路真正走出原门。' : null;
}
/** All local gates also drive replay validation; resource gates are added by the public wrapper. */
function localBlock(l: ConcealmentServantLifeState, c: ConcealmentServantActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !lockedLife(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先真实收束并报告三案，反思只计一次。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = CONCEALMENT_SERVANT_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !lockedLife(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[CONCEALMENT_SERVANT_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案，先收束上一现场。';
  if (c.type === 'PREPARE') return !lockedLife(l) && r.status === 'OBSERVED' && r.preparations < 16 ? null : '须本案已观察且没有占用现场；本案最多16次准备，不重置原历史。';
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') return null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && l.activeCase === null && r.attempts.length === 0 ? null : '须本案已经准备；每案只实施一次，不重骰。';
  if (c.type === 'REPORT') return !lockedLife(l) && r.status === 'EXAMINED' ? null : '先检查、归还并实际关闭现场才能报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本案本周实际进行中的原现场。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return cleanupBlock(l) ?? (a.inspected ? null : '先检查原人原物与普通出口。');
  if (c.type === 'RELEASE_CONCEALMENT') return l.room.concealed || a.traceVeil.state === 'ACTIVE' || a.doorBlocked && !a.releasedAfterBlock ? null : '当前没有待解除窗口或尚待确认的受阻原门。';
  if (c.type === 'WITHDRAW_CONSENT') return a.stoppedBy === null && (a.ownerConsent === 'GRANTED' || a.participantConsent === 'GRANTED') ? null : '本次许可已结束或尚未取得，不能重复撤回。';
  if (c.type === 'RETURN_BOX') return a.boxTaken && !a.boxReturned && l.playerLocation === 'ROOM' ? null : '须在原房间亲手归还本次已经拿起的同一原盒。';
  if (c.type === 'SWITCH_OFF_ANCHOR') return l.anchorLight.on && l.playerLocation === 'ROOM' ? null : '本次原灯尚未打开。';
  if (c.type === 'UNBOLT_DOOR') return l.playerLocation === 'ROOM' && l.room.doorBlocked && a.releasedAfterBlock && !l.room.concealed ? null : '原门受阻时须先明确解除，再普通解开同一门闩。';
  if (c.type === 'EXIT_ROOM') return a.entered && !a.exited && l.box.location === 'START' && !l.room.doorBlocked && !l.room.concealed && a.traceVeil.state !== 'ACTIVE' && !l.anchorLight.on ? null : '先还原盒、解除窗口、关闭锚灯；受阻原门须先解除再普通解闩。';
  if (c.type === 'INSPECT') {
    if (a.inspected) return '本次已经核实。';
    const cleanup = cleanupBlock(l); if (cleanup) return cleanup;
    const declined = a.ownerConsent === 'DECLINED' || a.participantConsent === 'DECLINED';
    if (!a.sourceRead || !a.entered && !declined && a.stoppedBy === null) return '先核来源并尊重当次回答，或实际进入后完成普通退出。';
    if (declined || a.stoppedBy !== null) return null;
    if (c.caseId === 'withdrawn-consent') return '本案须实际尊重当次撤回；普通拒绝也可如实记录。';
    if (c.caseId === 'blocked-door' && (!a.doorBlocked || !a.releasedAfterBlock || !a.doorUnbolted)) return '须保留本次原门受阻、明确解除与普通解闩的真实步骤。';
    return a.boxMoved && a.boxReturned && a.search !== null ? null : '先完成原盒实际移动、一次原弱检索与普通归还。';
  }
  if (a.inspected) return '已检查完毕，请关闭现场。';
  if (c.type === 'READ_SOURCE') return !a.sourceRead && !a.entered ? null : '须本次在入口核对一次原纸与原盒来源。';
  if (c.type === 'CHECK_DOOR') return a.sourceRead && !a.doorChecked && !a.entered ? null : '先核来源，再从入口核对同一原门及门闩。';
  if (c.type === 'CONSENT_OWNER' || c.type === 'DECLINE_OWNER') return a.sourceRead && a.ownerConsent === 'UNASKED' && !a.entered ? null : '须当面分别询问本次物主用途许可一次。';
  if (c.type === 'CONSENT_PARTICIPANT' || c.type === 'DECLINE_PARTICIPANT') return a.sourceRead && a.participantConsent === 'UNASKED' && !a.entered ? null : '须当面分别询问原艾琳本次参与意愿一次。';
  if (c.type === 'AGREE_RETURN') return permitted(a, week) && a.doorChecked && !a.returnAgreed ? null : '须两项本次同意及原门检查，才能约定随时停止与普通归还。';
  if (c.type === 'ENTER_ROOM') return permitted(a, week) && a.returnAgreed && !a.entered && !l.room.doorBlocked ? null : '须当前双方同意、原门开放，才可一起步行进入6米原房间。';
  if (!permitted(a, week) || !a.entered || a.exited || l.playerLocation !== 'ROOM') return '当前同意不成立；只可停止、还物、解闩与普通退出，不能继续施术或搬运。';
  if (c.type === 'TAKE_BOX') return !a.boxTaken && l.box.location === 'START' ? null : '同一原盒本次只能实际拿起一次。';
  if (c.type === 'CONCEAL' || c.type === 'TRACE_VEIL') {
    const use = c.type === 'CONCEAL' ? a.concealment : a.traceVeil;
    return a.method === 'ABILITY' && a.boxTaken && !a.boxReturned && !use.attempts && !l.anchorLight.on && !a.doorBlocked ? null : '须本次有限能力准备、当前许可和手中原盒；每技能每案一次，强锚或门阻后不再施术。';
  }
  if (c.type === 'MOVE_BOX') return a.boxTaken && !a.boxMoved && !a.boxReturned && l.box.location === 'PLAYER' && !l.room.doorBlocked ? null : '须实际携原盒走2米到原桌；门阻或归还后不再搬运。';
  if (c.type === 'WEAK_SEARCH') return a.boxTaken && !a.boxReturned && a.search === null ? null : '本案只实际触发一次原弱标记检索，须原盒仍在本次现场。';
  if (c.type === 'LIGHT_ANCHOR') return !a.lightUsed && !l.anchorLight.on ? null : '本案原锚灯只实际开一次，不倒改已完成效果。';
  if (c.type === 'BLOCK_DOOR') return c.caseId === 'blocked-door' && !a.doorBlocked && a.boxTaken && !a.boxReturned ? null : '仅原门案在双方场内实际放下一次同一门闩。';
  if (c.type === 'WAIT_20') return a.waits < 3 ? null : '本案已经等待三次20秒，有限窗口不续期。';
  return '未知的本次现场步骤。';
}
export function blockConcealmentServantLife(s: SliceState, c: ConcealmentServantActivityCommand): string | null {
  if (!validateConcealmentServantActivityCommand(c)) return '隐秘之仆生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE') return '须本人仍活着且当前确为黑夜候选序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原房间。';
  if (hasFearBishopLifeLock(s) || ['READY', 'FIGHTING'].includes(s.concealmentServant.encounter.status)) return '先实际收束旧现场或当前原敌接触。';
  const reason = localBlock(s.concealmentServant.life, c, s.week); if (reason) return reason;
  const ap = ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0;
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : ap)) return '本周行动不足；准备须保留至少1行动实际实施。';
  if (c.type === 'CONCEAL' && s.spirituality < 6) return '本次需要6灵性；仍可免费停止并普通还物退出。';
  if (c.type === 'TRACE_VEIL' && s.spirituality < 5) return '本次需要5灵性；仍可免费停止并普通还物退出。';
  return null;
}
function stopWindows(l: ConcealmentServantLifeState, a: ConcealmentServantAttempt, state: 'STOPPED' | 'COUNTERED') {
  for (const use of [a.concealment, a.traceVeil]) if (use.state === 'ACTIVE') { use.state = state; use.remainingSeconds = 0; }
  l.room.concealed = false; l.room.remainingSeconds = 0;
}
function elapse(l: ConcealmentServantLifeState, a: ConcealmentServantAttempt, seconds: number) {
  l.clockSeconds += seconds; a.elapsedSeconds += seconds;
  for (const use of [a.concealment, a.traceVeil]) if (use.state === 'ACTIVE') {
    use.remainingSeconds = Math.max(0, use.remainingSeconds - seconds);
    if (use.remainingSeconds === 0) use.state = 'EXPIRED';
  }
  l.room.concealed = a.concealment.state === 'ACTIVE'; l.room.remainingSeconds = a.concealment.remainingSeconds;
}
/** Small scene-only reducer. Never writes old people, old objects, spirits, player body or RNG. */
function evolve(l: ConcealmentServantLifeState, c: ConcealmentServantActivityCommand, week: number, tier: PublicResolutionTier | null) {
  if (c.type === 'REFLECT') { l.reflected = true; return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; r.preparations++; return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; return; }
  if (c.type === 'PERFORM') { r.status = 'ACTIVE'; r.contactOpen = true; l.activeCase = c.caseId; r.attempts.push(freshAttempt(week, r.method!)); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = 'CLOSED'; a.participantConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = 'EXAMINED'; l.activeCase = null; return; }
  switch (c.type) {
    case 'READ_SOURCE': a.sourceRead = true; elapse(l, a, 4); break;
    case 'CHECK_DOOR': a.doorChecked = true; elapse(l, a, 2); break;
    case 'CONSENT_OWNER': case 'DECLINE_OWNER': a.ownerConsent = c.type === 'CONSENT_OWNER' ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = week; elapse(l, a, 2); break;
    case 'CONSENT_PARTICIPANT': case 'DECLINE_PARTICIPANT': a.participantConsent = c.type === 'CONSENT_PARTICIPANT' ? 'GRANTED' : 'DECLINED'; a.participantConsentWeek = week; elapse(l, a, 2); break;
    case 'AGREE_RETURN': a.returnAgreed = true; elapse(l, a, 2); break;
    case 'ENTER_ROOM': a.entered = true; l.playerLocation = 'ROOM'; l.erin.location = 'ROOM'; l.playerTravelMetres += 6; a.playerTravelMetres += 6; l.erin.travelMetres += 6; a.erinTravelMetres += 6; elapse(l, a, 6); break;
    case 'TAKE_BOX': a.boxTaken = true; l.box.location = 'PLAYER'; elapse(l, a, 1); break;
    case 'CONCEAL': case 'TRACE_VEIL': {
      const use = c.type === 'CONCEAL' ? a.concealment : a.traceVeil, cost = c.type === 'CONCEAL' ? 6 : 5;
      elapse(l, a, 2); a.spiritualitySpent += cost; use.attempts = 1; use.tier = tier; use.successes = successful(tier) ? 1 : 0;
      use.state = successful(tier) ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = successful(tier) ? c.type === 'CONCEAL' ? 60 : 20 : 0;
      l.room.concealed = a.concealment.state === 'ACTIVE'; l.room.remainingSeconds = a.concealment.remainingSeconds; break;
    }
    case 'MOVE_BOX':
      // The real two-metre move, not merely opening a successful window, applies concealment.
      if (a.concealment.state === 'ACTIVE' && a.concealment.remainingSeconds >= 2 && !l.anchorLight.on) a.concealment.effects = 1;
      a.boxMoved = true; l.box.location = 'TABLE'; l.box.travelMetres += 2; a.boxTravelMetres += 2; l.playerTravelMetres += 2; a.playerTravelMetres += 2; elapse(l, a, 2); break;
    case 'WEAK_SEARCH': {
      const requestedAt = l.clockSeconds, delay = a.traceVeil.state === 'ACTIVE' && !l.anchorLight.on ? 20 : 0;
      if (delay) { a.traceVeil.effects = 1; a.traceVeil.state = 'APPLIED'; a.traceVeil.remainingSeconds = 0; l.trace.delayedSearches++; l.trace.totalDelaySeconds += 20; }
      l.trace.searches++; elapse(l, a, 1 + delay);
      if (l.room.concealed) a.concealment.effects = 1;
      a.search = { requestedAt, completedAt: l.clockSeconds, delayedSeconds: delay, result: l.room.concealed ? 'ROOM_CONCEALED' : 'LOCATED' }; break;
    }
    case 'LIGHT_ANCHOR': a.lightUsed = true; l.anchorLight.on = true; stopWindows(l, a, 'COUNTERED'); elapse(l, a, 1); break;
    case 'SWITCH_OFF_ANCHOR': l.anchorLight.on = false; elapse(l, a, 1); break;
    case 'WITHDRAW_CONSENT': a.stoppedBy = c.actor; a.participantConsent = 'REVOKED'; if (c.actor === 'ERIN') a.ownerConsent = 'REVOKED'; stopWindows(l, a, 'STOPPED'); break;
    case 'RELEASE_CONCEALMENT': stopWindows(l, a, 'STOPPED'); if (a.doorBlocked) a.releasedAfterBlock = true; break;
    case 'RETURN_BOX': {
      const distance = a.boxMoved ? 2 : 0; l.box.location = 'START'; a.boxReturned = true; l.box.travelMetres += distance; a.boxTravelMetres += distance; l.playerTravelMetres += distance; a.playerTravelMetres += distance; elapse(l, a, 2 + distance); break;
    }
    case 'BLOCK_DOOR': l.room.doorBlocked = true; a.doorBlocked = true; a.releasedAfterBlock = false; l.erin.travelMetres += 12; a.erinTravelMetres += 12; elapse(l, a, 13); break;
    case 'UNBOLT_DOOR': l.room.doorBlocked = false; a.doorUnbolted = true; l.erin.travelMetres += 12; a.erinTravelMetres += 12; elapse(l, a, 14); break;
    case 'EXIT_ROOM': a.exited = true; l.playerLocation = 'EXIT'; l.erin.location = 'EXIT'; l.playerTravelMetres += 6; a.playerTravelMetres += 6; l.erin.travelMetres += 6; a.erinTravelMetres += 6; elapse(l, a, 6); break;
    case 'WAIT_20': a.waits++; elapse(l, a, 20); break;
    case 'INSPECT': a.inspected = true; a.result = a.concealment.effects || a.traceVeil.effects ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2); break;
  }
}
export function applyConcealmentServantActivity(s: SliceState, c: ConcealmentServantActivityCommand, ctx: SeerContext): void {
  const reason = blockConcealmentServantLife(s, c); if (reason) throw new Error(reason);
  const l = s.concealmentServant.life;
  let tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null, check: PublicCheckResult | null = null;
  if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type)) s.actionsRemaining--;
  if (c.type === 'CONCEAL' || c.type === 'TRACE_VEIL') {
    s.spirituality -= c.type === 'CONCEAL' ? 6 : 5; randomBefore = s.random.cursor;
    check = structuredClone(ctx.check(c.type === 'CONCEAL' ? 'knowledge' : 'will', 18)); tier = check.tier; randomAfter = s.random.cursor;
  }
  evolve(l, c, s.week, tier);
  l.journal.push({ week: s.week, command: structuredClone(c), tier, randomBefore, randomAfter, check });
  if (c.type === 'REPORT') {
    const a = l.cases[c.caseId].attempts.at(-1)!; s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const [id, use] of [['darkness.s2.bounded-concealment', a.concealment], ['darkness.s2.trace-veil', a.traceVeil]] as const) if (use.effects > 0) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null);
  ctx.note(`有限原房间：${LABELS[c.type] ?? c.type}`, `原创G；本次${tier ?? '普通实际步骤'}。当前灵性${s.spirituality}/120，原房间${l.room.concealed ? `隐秘余${l.room.remainingSeconds}秒` : '正常可见'}，原门${l.room.doorBlocked ? '门闩真实受阻' : '开放'}；本人${l.playerLocation}，艾琳${l.erin.location}，原盒${l.box.location}。${a ? `本次已耗${a.spiritualitySpent}灵性、${a.elapsedSeconds}秒；隐秘尝试/成功/实际应用${a.concealment.attempts}/${a.concealment.successes}/${a.concealment.effects}，遮踪${a.traceVeil.attempts}/${a.traceVeil.successes}/${a.traceVeil.effects}。` : ''}原人、物权、纸面记录、弱标记与旧伤保留；解除不是传送或删除存在。`);
}
const LABELS: Record<string, string> = {
  OBSERVE: '观察原房间、成人与来源', PREPARE: '准备本次有限实践', PERFORM: '开始本次实际现场', REPORT: '报告真实结果', REFLECT: '反思当前许可与普通返程', CLOSE: '结束已收束现场', WITHDRAW: '退出本次准备或已收束现场',
  READ_SOURCE: '亲自核对原纸与原盒', CHECK_DOOR: '检查唯一原门及门闩', CONSENT_OWNER: '物主当面同意本次用途', DECLINE_OWNER: '尊重物主本次拒绝', CONSENT_PARTICIPANT: '艾琳本人同意本次参与', DECLINE_PARTICIPANT: '尊重艾琳本次不参与', AGREE_RETURN: '约定立即停止与普通归还', ENTER_ROOM: '双方沿原路步行进入', TAKE_BOX: '亲手拿起同一原盒', CONCEAL: '尝试有限房间隐秘', TRACE_VEIL: '尝试一次有限遮踪', MOVE_BOX: '实际携原盒走2米到原桌', WEAK_SEARCH: '实际触发一次原弱标记检索', LIGHT_ANCHOR: '打开原固定锚定灯', SWITCH_OFF_ANCHOR: '普通关闭原锚灯', WITHDRAW_CONSENT: '本次参与者立即撤回', RELEASE_CONCEALMENT: '明确解除有限隐秘与遮踪', RETURN_BOX: '亲手归还同一原盒', BLOCK_DOOR: '实际放下原门闩', UNBOLT_DOOR: '解除后普通解开原门闩', EXIT_ROOM: '双方沿原6米路步行退出', WAIT_20: '实际等待20秒，不续窗', INSPECT: '检查原人原物与普通出口',
};
const COSTS: Partial<Record<string, string>> = { READ_SOURCE: '0行动 · 核对4秒G', CHECK_DOOR: '0行动 · 检查2秒G', CONSENT_OWNER: '0行动 · 当面2秒G', DECLINE_OWNER: '0行动 · 当面2秒G', CONSENT_PARTICIPANT: '0行动 · 当面2秒G', DECLINE_PARTICIPANT: '0行动 · 当面2秒G', AGREE_RETURN: '0行动 · 当面2秒G', TAKE_BOX: '0行动 · 亲手1秒G', LIGHT_ANCHOR: '0行动 · 原固定灯1秒G', SWITCH_OFF_ANCHOR: '0行动 · 原固定灯1秒G', BLOCK_DOOR: '0行动 · 艾琳普通往返12米并放闩，共13秒G', UNBOLT_DOOR: '0行动 · 先解除；艾琳普通往返12米并解闩，共14秒G', INSPECT: '0行动 · 核对2秒G', CLOSE: '0行动0秒 · 只结束已实际收束现场', WITHDRAW: '0行动0秒 · 须先物理收束，不退已耗成本', CONCEAL: '0行动 · 6灵性 · 知识18 · 成功最多60秒G · 每案一次', TRACE_VEIL: '0行动 · 5灵性 · 意志18 · 下一次原弱检索实际暂缓20秒G · 每案一次', ENTER_ROOM: '0行动 · 双方各6米，共6秒G', MOVE_BOX: '0行动 · 本人和同一原盒各2米2秒G', EXIT_ROOM: '0行动 · 双方各6米6秒G · 门阻先解除再解闩', WEAK_SEARCH: '0行动 · 普通1秒；遮踪实际应用另延20秒G', WITHDRAW_CONSENT: '0行动0秒 · 立即停窗 · 不退原实耗', RELEASE_CONCEALMENT: '0行动0秒 · 不移动原人原物', RETURN_BOX: '0行动 · 原桌返物2米4秒；未移动原盒则2秒G · 撤回后仍可', WAIT_20: '0行动 · 20秒G · 最多三次', REPORT: '1行动 · 扮演25 · 实际应用的新技能各+8G', REFLECT: '1行动 · 三真实报告后扮演25G' };
export function concealmentServantLifeActions(s: SliceState): ConcealmentServantLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.concealmentServant.life, out: ConcealmentServantLifeAction[] = [];
  const add = (command: ConcealmentServantActivityCommand) => { const reason = blockConcealmentServantLife(s, command); out.push({ id: `CS2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'actor' in command ? `:${command.actor}` : ''}`, label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通对照）' : ''}${'actor' in command ? `（${command.actor === 'ERIN' ? '艾琳' : '本人'}）` : ''}`, cost: COSTS[command.type] ?? (['OBSERVE', 'PERFORM'].includes(command.type) ? '1行动' : command.type === 'PREPARE' ? '1行动 · 须至少剩2行动' : '0行动 · 真实普通步骤及用时G'), enabled: reason === null, reason, command }); };
  for (const caseId of CONCEALMENT_SERVANT_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId }); add({ type: 'WITHDRAW', caseId }); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    for (const type of STEP_TYPES) if (!(r.method === 'ORDINARY' && ['CONCEAL', 'TRACE_VEIL'].includes(type))) add({ type, caseId });
    for (const actor of ['ERIN', 'PLAYER'] as const) add({ type: 'WITHDRAW_CONSENT', caseId, actor });
    add({ type: 'CLOSE', caseId }); add({ type: 'WITHDRAW', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectConcealmentServantLife(s: SliceState): ConcealmentServantLifeProjection {
  const l = s.concealmentServant.life;
  return { title: '有限原房间与普通返程', story: CONCEALMENT_SERVANT_LIFE_STORY, environment: '原创G：CS2-ROOM原房间6米，仅一扇CS2-DOOR；原盒起点在门内6米，原桌在起点向门方向2米（门内4米）。艾琳每次操作门闩均实际往返12米，放闩共13秒、解闩共14秒，不隔空移动门。原艾琳38岁、健康精神各100；原纸/原盒归她。原固定锚定灯可令当前有限窗口失效，不能倒改已经完成的原动作。', activeCase: l.activeCase, inside: lockedLife(l), insideCase: lockedLife(l), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres,
    erin: { ...l.erin }, room: { ...l.room }, box: { ...l.box }, page: { ...l.page }, trace: { ...l.trace }, anchorLight: { ...l.anchorLight }, currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, CONCEALMENT_SERVANT_TRACE_SOURCE, '有限能力可以失败、到期、撤回或被强锚反制；原人原物始终在原处，必须普通返程。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '至少一项新技能实际应用；尝试、成功与应用分别保留。' : '已实际普通收束；没有未应用技能的掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: concealmentServantLifeActions(s) };
}
/** Rebuild only this small scene from its finite command evidence, never copy the giant campaign state. */
export function validateConcealmentServantLife(s: SliceState): boolean {
  const l = s.concealmentServant?.life, promotion = s.concealmentServant?.promotionWeek, expected = createConcealmentServantLifeState();
  if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 400) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(expected);
  if (!integer(promotion, 1, s.week)) return false;
  let lastWeek = promotion, cursor = -1;
  for (const event of l.journal) {
    if (!record(event) || !shape(event, ['week', 'command', 'tier', 'randomBefore', 'randomAfter', 'check']) || !integer(event.week, lastWeek, s.week) || !validateConcealmentServantActivityCommand(event.command)) return false;
    const c = event.command, cast = c.type === 'CONCEAL' || c.type === 'TRACE_VEIL';
    if (cast) {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, cursor + 1, s.random.cursor) || !integer(event.randomAfter, event.randomBefore + 1, s.random.cursor) || event.randomAfter !== event.randomBefore + 1) return false;
      if (!record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
      const ability = c.type === 'CONCEAL' ? 'knowledge' : 'will';
      // Preserve the exact small normal-check result and verify its original RNG draw.
      // Later ordinary growth can change current stats, so replay the recorded actual input.
      const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
      const check = resolveNormalCheck({ ability, baseAbility: event.check.baseAbility, difficulty: 18, modifiers: [], roll: random.nextInt(1, 100) });
      if (stableStringify(check) !== stableStringify(event.check) || check.tier !== event.tier || random.cursor !== event.randomAfter) return false;
      cursor = event.randomBefore;
    } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
    if (lockedLife(expected) && event.week !== lastWeek) return false;
    if (localBlock(expected, c, event.week)) return false;
    evolve(expected, c, event.week, event.tier as PublicResolutionTier | null);
    expected.journal.push(structuredClone(event) as unknown as ConcealmentServantLifeEvent); lastWeek = event.week;
  }
  if (stableStringify(l) !== stableStringify(expected)) return false;
  if (lockedLife(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND')) return false;
  const a = current(l); if (a && a.week !== s.week) return false;
  const resolved = Object.values(l.cases).filter(r => r.status === 'RESOLVED').length;
  if (promoted(s)) {
    const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
    if (s.progression.mastery['darkness.s2.bounded-concealment'] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.concealment.effects > 0 ? 8 : 0), 0) ||
        s.progression.mastery['darkness.s2.trace-veil'] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.traceVeil.effects > 0 ? 8 : 0), 0)) return false;
    return s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
  }
  return true;
}
