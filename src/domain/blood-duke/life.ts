import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createBlathererLifeState, validateBlathererLifeOriginal, type BlathererLifeState } from '../blatherer/life.js';
import { hasBloodDukeOldPractice } from './index.js';
import { replayBloodDukeEncounterRoot } from './encounter.js';

export const BLOOD_DUKE_CASE_IDS = ['door-restraint', 'bell-hesitation', 'withdrawn-rehearsal'] as const;
export const BLOOD_DUKE_ACTIVITY_CASE_IDS = BLOOD_DUKE_CASE_IDS;
export const ACTIVITY_CASE_IDS = BLOOD_DUKE_CASE_IDS;
export type BloodDukeCaseId = typeof BLOOD_DUKE_CASE_IDS[number];
export type BloodDukeLifeAbilityId = 'abyss.s2.self-restraint' | 'abyss.s2.emotion-interference';
export type BloodDukeLocation = 'START' | 'A' | 'B';
export type BloodDukeConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'CONSENT_NORA', 'TAKE_CARD', 'RETURN_CARD', 'READ_NOTE', 'REHEARSE_BELL', 'CONFIRM_EMOTION', 'NOTICE_IMPULSE', 'SELF_RESTRAINT', 'EMOTION_INTERFERENCE', 'PERFORM_OPERATION', 'MANUAL_OPERATION', 'END_FOCUS', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_6', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type BloodDukeActivityCommand = { type: typeof STEPS[number]; caseId: BloodDukeCaseId } | { type: 'PREPARE'; caseId: BloodDukeCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: BloodDukeCaseId; to: BloodDukeLocation } | { type: 'REFLECT' };
/** A fully validated historical handoff. The live room remains blatherer.life. */
export interface BloodDukeSceneSource { root: 'blatherer.life'; promotionWeek: number; introducedWeek: number; snapshot: BlathererLifeState }
export interface BloodDukeOperationState {
  door: 'OPEN'; inputActive: boolean;
  impulse: { actor: 'PLAYER'; kind: 'RUSH_TO_DOOR'; observedAt: number; expiresAt: number } | null;
  emotion: { subjectId: 'BL3-NORA'; triggerId: 'BL3-BELL'; kind: 'STRONG_TENSION'; triggeredAt: number; confirmedAt: number | null; expiresAt: number } | null;
  restraintUntil: number | null; hesitationUntil: number | null;
  bellRehearsals: number;
}
export interface BloodDukeMovement { from: BloodDukeLocation; to: BloodDukeLocation; metres: 4; seconds: 4; itemIds: string[] }
export interface BloodDukeAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: BloodDukeConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  cardTaken: boolean; cardReturned: boolean; reachedBell: boolean; noteRead: boolean; rehearsed: boolean; confirmedEmotion: boolean; noticedImpulse: boolean;
  selfRestraintTier: PublicResolutionTier | null; emotionTier: PublicResolutionTier | null;
  performed: boolean; manual: boolean; expired: boolean; waits: number; inspected: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; penniesSpent: 0;
  appliedAbilityIds: BloodDukeLifeAbilityId[]; playerMoves: BloodDukeMovement[]; evidence: string[];
}
export interface BloodDukeCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: BloodDukeAttempt[] }
export interface BloodDukeLifeCost { actions: number; spirituality: number; mind: number; pennies: 0; health: 0; cashGained: 0 }
export interface BloodDukeLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface BloodDukeCheckSource {
  caseId: BloodDukeCaseId; abilityId: BloodDukeLifeAbilityId; cost: 6; difficulty: 20; coreStat: 'knowledge'; baseAbility: number;
  actor: { pathwayId: 'abyss'; sequence: 2; name: string; gender: string }; consentWeek: number; at: number;
  actorLocation: BloodDukeLocation; listenerId: 'BL3-NORA' | null; listenerLocation: 'A' | null; currentConsent: 'GRANTED';
  impulse: BloodDukeOperationState['impulse']; emotion: BloodDukeOperationState['emotion']; bellId: 'BL3-BELL'; noteId: 'BL3-NOTE';
}
export interface BloodDukeLifeEvent { week: number; date: PublicGameDate; revision: number; command: BloodDukeActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: BloodDukeCheckSource | null; inheritedScene: BloodDukeSceneSource | null; paid: BloodDukeLifeCost; budget: BloodDukeLifeBudget }
export interface BloodDukeLifeState { source: BloodDukeSceneSource | null; activeCase: BloodDukeCaseId | null; reflected: boolean; operation: BloodDukeOperationState; cases: Record<BloodDukeCaseId, BloodDukeCaseState>; journal: BloodDukeLifeEvent[] }
export interface BloodDukeLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BloodDukeActivityCommand }
export interface BloodDukeLifeProjection {
  title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: BloodDukeCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: BlathererLifeState; operation: BloodDukeOperationState; clockSeconds: number; playerLocation: BlathererLifeState['playerLocation']; playerTravelMetres: number; currentAttempt: BloodDukeAttempt | null;
  cases: { id: BloodDukeCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: BloodDukeAttempt[] }[];
  actions: BloodDukeLifeAction[];
}
const RESTRAINT: BloodDukeLifeAbilityId = 'abyss.s2.self-restraint', EMOTION: BloodDukeLifeAbilityId = 'abyss.s2.emotion-interference';
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 2;
const freshCase = (): BloodDukeCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createBloodDukeLifeState(): BloodDukeLifeState { return { source: null, activeCase: null, reflected: false, operation: { door: 'OPEN', inputActive: false, impulse: null, emotion: null, restraintUntil: null, hesitationUntil: null, bellRehearsals: 0 }, cases: { 'door-restraint': freshCase(), 'bell-hesitation': freshCase(), 'withdrawn-rehearsal': freshCase() }, journal: [] }; }
const current = (l: BloodDukeLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: BloodDukeLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const windows = (l: BloodDukeLifeState) => l.operation.restraintUntil !== null || l.operation.hesitationUntil !== null;
function cleanupBlock(l: BloodDukeLifeState, p: BlathererLifeState): string | null {
  if (l.operation.inputActive || windows(l)) return '先停止作用并实际等候当前短暂余留结束。';
  if (p.playerLocation !== 'START') return '须本人沿四米、四米普通路走回原门口。';
  if (p.volunteer.location !== 'A' || p.card.location !== 'NORA') return '同一原卡须在四米处当面归还诺拉。';
  if (p.guide.location !== 'OUTSIDE') return '原罗安仍须处于室外；不得把旁人复制或隔空移走。';
  return null;
}
export const hasBloodDukeLifeLock = (s: SliceState): boolean => open(s.bloodDuke.life);
export const bloodDukeInside = hasBloodDukeLifeLock;
export const bloodDukeLifeClosed = (s: SliceState): boolean => !open(s.bloodDuke.life) && s.bloodDuke.life.source !== null && Object.values(s.bloodDuke.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.bloodDuke.life, s.blatherer.life);
export function validateBloodDukeActivityCommand(v: unknown): v is BloodDukeActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!BLOOD_DUKE_CASE_IDS.includes(v.caseId as BloodDukeCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isBloodDukeActivityCommand = validateBloodDukeActivityCommand;
export const isBloodDukeActivity = validateBloodDukeActivityCommand;
function localBlock(l: BloodDukeLifeState, p: BlathererLifeState, c: BloodDukeActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并收好原安静室。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = BLOOD_DUKE_CASE_IDS.indexOf(c.caseId), op = l.operation;
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[BLOOD_DUKE_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对同一原室的人、物与普通退路。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '须先观察，每案只可准备一次。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && !!a && (a.performed || a.manual) ? null : '须有实际有限应用或普通核对，并真实归卡退出；提前取消不能领取报告成果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一原室现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '已经核实，只须结束接触并报告。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.consent === 'GRANTED' && !a.permissionWithdrawn ? null : '须本案当前仍有许可；撤回后不重问。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止，已付成本不退。';
  if (c.type === 'END_FOCUS') return op.inputActive ? null : '没有仍在进行的作用输入；已有余留须实际等待。';
  if (c.type === 'WAIT_6') return (windows(l) || op.emotion !== null || op.impulse !== null) && a.waits < 4 ? null : '只可等待当前有限状态，不会续时或补充资源。';
  if (c.type === 'RETURN_CARD') return p.playerLocation === 'A' && p.card.location === 'PLAYER' && !op.inputActive && !windows(l) && (a.performed || a.manual || a.stopped) ? null : '先停输入、等余留，再在四米处当面归还同一原卡。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!(a.performed || a.manual || a.stopped) ? '先完成有限操作或明确停止。' : c.caseId === 'withdrawn-rehearsal' && a.consent === 'GRANTED' ? '本案须听取诺拉明确撤回，再核实退出。' : null);
  if (c.type === 'WALK') {
    if (op.inputActive || windows(l)) return '先停止作用并等有限余留结束，再普通行走。';
    if (p.playerLocation === 'START' && c.to === 'A') return !a.playerMoves.length && !a.stopped ? null : '本案只沿原路往返一次。';
    if (p.playerLocation === 'A' && c.to === 'B') return !a.reachedBell && !a.stopped && a.consent === 'GRANTED' && p.card.location === 'PLAYER' ? null : '先当面取得本案许可和同一原卡，再走向原铃。';
    if (p.playerLocation === 'B' && c.to === 'A') return a.noteRead || a.stopped ? null : '先亲读原铃旁同一记录，或明确停止。';
    if (p.playerLocation === 'A' && c.to === 'START') return p.card.location === 'NORA' && (a.performed || a.manual || a.stopped) ? null : '先归还同一原卡，再沿四米普通路回门口。';
    return '只能沿门口至诺拉四米、诺拉至原铃四米的实际道路行走。';
  }
  if (c.type === 'CONSENT_NORA') return p.playerLocation === 'A' && a.consent === 'UNASKED' && !a.stopped && p.volunteer.willing ? null : '须本人到四米处，向当前自愿的诺拉询问本案独立、可撤回许可。';
  if (a.stopped || a.consent !== 'GRANTED' || !p.volunteer.willing || p.volunteer.location !== 'A') return '许可已经停止或撤回；仍可停止、等待、普通返回与归卡。';
  if (c.type === 'TAKE_CARD') return p.playerLocation === 'A' && p.card.location === 'NORA' && !a.cardTaken ? null : '须本人在诺拉面前，临时借取同一原卡。';
  if (c.type === 'READ_NOTE') return p.playerLocation === 'B' && p.card.location === 'PLAYER' && !a.noteRead ? null : '须携原卡到八米处，亲读同一原铃与原记录。';
  if (c.type === 'REHEARSE_BELL') return c.caseId !== 'door-restraint' && a.method === 'ABILITY' && p.playerLocation === 'B' && a.noteRead && !a.rehearsed && p.guide.location === 'OUTSIDE' ? null : '只可按诺拉本案自愿许可，亲手轻敲同一原铃一次；没有不知情旁听者。';
  if (c.type === 'CONFIRM_EMOTION') return p.playerLocation === 'A' && op.emotion !== null && op.emotion.expiresAt > p.clockSeconds + 1 && !a.confirmedEmotion ? null : '须回到诺拉面前，询问铃声后此刻是否仍有强烈情绪；旧情绪不是当前来源。';
  if (c.type === 'NOTICE_IMPULSE') return c.caseId !== 'bell-hesitation' && a.method === 'ABILITY' && p.playerLocation === 'A' && a.noteRead && !a.noticedImpulse ? null : '须核完原记录后，记录自己此刻想匆忙穿过原门的实际冲动。';
  if (c.type === 'SELF_RESTRAINT') return c.caseId !== 'bell-hesitation' && a.method === 'ABILITY' && a.selfRestraintTier === null && p.playerLocation === 'A' && op.impulse !== null && op.impulse.expiresAt > p.clockSeconds + 2 ? null : '只可短暂约束本人刚记录且此刻仍在的冲动，不能替别人自律。';
  if (c.type === 'EMOTION_INTERFERENCE') return c.caseId !== 'door-restraint' && a.method === 'ABILITY' && a.emotionTier === null && p.playerLocation === 'A' && op.emotion !== null && op.emotion.confirmedAt !== null && op.emotion.expiresAt > p.clockSeconds + 2 && p.guide.location === 'OUTSIDE' && (c.caseId !== 'withdrawn-rehearsal' || a.selfRestraintTier !== null) ? null : '只可对面前此刻明确同意、刚确认强烈紧张的诺拉尝试一次；旧同意、旧情绪或远处目标均不能代替。';
  if (c.type === 'PERFORM_OPERATION') return p.playerLocation === 'A' && a.noteRead && p.card.location === 'PLAYER' && !a.performed && !a.manual && op.inputActive && (c.caseId === 'door-restraint' ? op.restraintUntil !== null : c.caseId === 'bell-hesitation' ? op.hesitationUntil !== null : op.restraintUntil !== null && op.hesitationUntil !== null) ? null : '须在本案真实短窗内，核对原卡并保留当事人的当前选择。';
  if (c.type === 'MANUAL_OPERATION') return p.playerLocation === 'A' && a.noteRead && p.card.location === 'PLAYER' && !op.inputActive && !windows(l) && !a.performed && !a.manual ? null : '须已普通往返核对原记录，并停止、等候已有作用后，才可按普通方法完成。';
  return '当前阶段不能进行这一步。';
}
function commandCost(_l: BloodDukeLifeState, c: BloodDukeActivityCommand, tier: PublicResolutionTier | null = null): BloodDukeLifeCost {
  const cast = c.type === 'SELF_RESTRAINT' || c.type === 'EMOTION_INTERFERENCE';
  return { actions: ['OBSERVE', 'PREPARE', 'SELF_RESTRAINT', 'EMOTION_INTERFERENCE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: cast ? 6 : 0, mind: cast ? tier !== null && !successful(tier) ? 4 : 2 : 0, pennies: 0, health: 0, cashGained: 0 };
}
export function blockBloodDukeLife(s: SliceState, c: BloodDukeActivityCommand): string | null {
  if (!validateBloodDukeActivityCommand(c)) return '鲜血大公生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已经成为鲜血大公。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际来到贝克兰德原安静室。';
  if (s.bloodDuke.preparedWeek !== null || s.bloodDuke.encounter.status !== 'AVAILABLE') return '先完成服药准备；后续遭遇开始后不能重开原案。';
  if (s.bloodDuke.life.source === null && hasBloodDukeOldPractice(s)) return '先收束此前原室中的全部接触与物品。';
  if (s.bloodDuke.life.source === null && !validateBloodDukeSceneSource({ root: 'blatherer.life', promotionWeek: s.bloodDuke.promotionWeek, introducedWeek: s.week, snapshot: s.blatherer.life }, s)) return '原安静室的旧实践和收尾记录须完整，不能凭空接出另一个现场。';
  const reason = localBlock(s.bloodDuke.life, s.blatherer.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.bloodDuke.life, c), casts = c.type === 'PREPARE' && c.method === 'ABILITY' ? c.caseId === 'withdrawn-rehearsal' ? 2 : 1 : 0;
  if (s.actionsRemaining < cost.actions + casts) return '本周须预留准备及全部有限施术的行动；普通收尾不耗行动。';
  if (s.spirituality < cost.spirituality || s.mind < (c.type === 'SELF_RESTRAINT' || c.type === 'EMOTION_INTERFERENCE' ? 4 : cost.mind)) return '当前资源不足以支付真实成本及可能的失败冲击。';
  return null;
}
function elapse(l: BloodDukeLifeState, p: BlathererLifeState, seconds: number, a: BloodDukeAttempt | null): void {
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  for (const key of ['restraintUntil', 'hesitationUntil'] as const) if (l.operation[key] !== null && l.operation[key]! <= p.clockSeconds) { l.operation[key] = null; if (a) a.expired = true; }
  if (l.operation.impulse && l.operation.impulse.expiresAt <= p.clockSeconds) l.operation.impulse = null;
  if (l.operation.emotion && l.operation.emotion.expiresAt <= p.clockSeconds) l.operation.emotion = null;
  if (!windows(l)) l.operation.inputActive = false;
}
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY'): BloodDukeAttempt { return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, cardTaken: false, cardReturned: false, reachedBell: false, noteRead: false, rehearsed: false, confirmedEmotion: false, noticedImpulse: false, selfRestraintTier: null, emotionTier: null, performed: false, manual: false, expired: false, waits: 0, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, penniesSpent: 0, appliedAbilityIds: [], playerMoves: [], evidence: [] }; }
function checkSource(l: BloodDukeLifeState, p: BlathererLifeState, c: BloodDukeActivityCommand, baseAbility: number, name: string, gender: string): BloodDukeCheckSource | null {
  if (c.type !== 'SELF_RESTRAINT' && c.type !== 'EMOTION_INTERFERENCE') return null;
  return { caseId: c.caseId, abilityId: c.type === 'SELF_RESTRAINT' ? RESTRAINT : EMOTION, cost: 6, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'abyss', sequence: 2, name, gender }, consentWeek: l.cases[c.caseId].consentWeek!, at: p.clockSeconds, actorLocation: p.playerLocation, listenerId: c.type === 'EMOTION_INTERFERENCE' ? 'BL3-NORA' : null, listenerLocation: c.type === 'EMOTION_INTERFERENCE' ? 'A' : null, currentConsent: 'GRANTED', impulse: structuredClone(l.operation.impulse), emotion: structuredClone(l.operation.emotion), bellId: p.bell.id, noteId: p.note.id };
}
function evolve(l: BloodDukeLifeState, p: BlathererLifeState, c: BloodDukeActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: BloodDukeSceneSource | null): void {
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6, null); return; }
  const r = l.cases[c.caseId], op = l.operation;
  if (c.type === 'OBSERVE') { if (l.source === null) { if (!source) throw new Error('缺少同一原室的交接记录。'); l.source = structuredClone(source); } r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4, null); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.method); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4, null); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent !== 'WITHDRAWN') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': { const move: BloodDukeMovement = { from: p.playerLocation, to: c.to, metres: 4, seconds: 4, itemIds: p.card.location === 'PLAYER' ? [p.card.id] : [] }; p.playerLocation = c.to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; if (p.card.location === 'PLAYER') p.card.travelMetres += 4; a.playerMoves.push(move); if (c.to === 'B') a.reachedBell = true; elapse(l, p, 4, a); break; }
    case 'CONSENT_NORA': a.consent = 'GRANTED'; r.consentWeek = week; a.evidence.push('在诺拉面前取得本案独立许可：可借原卡核对；铃声排演与一次短暂情绪试验均可立即拒绝或撤回，原邀请仍由她自己决定。'); elapse(l, p, 1, a); break;
    case 'TAKE_CARD': p.card.location = 'PLAYER'; a.cardTaken = true; elapse(l, p, 1, a); break;
    case 'RETURN_CARD': p.card.location = 'NORA'; a.cardReturned = true; a.evidence.push('本人在四米处将同一原卡当面交还诺拉，所有权从未改变。'); elapse(l, p, 1, a); break;
    case 'READ_NOTE': a.noteRead = true; a.evidence.push('本人到八米处亲读原铃与原记录，再与手中同一原卡核对：铃声不能替代当前同意，原门仍可普通通过。'); elapse(l, p, 2, a); break;
    case 'REHEARSE_BELL': a.rehearsed = true; op.bellRehearsals++; elapse(l, p, 1, a); op.emotion = { subjectId: 'BL3-NORA', triggerId: 'BL3-BELL', kind: 'STRONG_TENSION', triggeredAt: p.clockSeconds, confirmedAt: null, expiresAt: p.clockSeconds + 12 }; a.evidence.push('按刚取得的自愿许可轻敲同一原铃一次；诺拉在四米外明确说铃声使她此刻强烈紧张，仍须本人走回当面确认。'); break;
    case 'CONFIRM_EMOTION': a.confirmedEmotion = true; elapse(l, p, 1, a); if (op.emotion) op.emotion.confirmedAt = p.clockSeconds; a.evidence.push('回到诺拉面前，她明确回答：此刻仍因刚才排演铃声感到强烈紧张，并仍同意本次短试验；这不是推测隐藏情绪。'); break;
    case 'NOTICE_IMPULSE': a.noticedImpulse = true; elapse(l, p, 1, a); op.impulse = { actor: 'PLAYER', kind: 'RUSH_TO_DOOR', observedAt: p.clockSeconds, expiresAt: p.clockSeconds + 12 }; a.evidence.push('核对相互冲突的原卡和铃声记录后，本人察觉自己现在想匆忙穿过原门；只记录这个当下的自身冲动。'); break;
    case 'SELF_RESTRAINT': a.selfRestraintTier = tier; a.spiritualitySpent += 6; a.mindSpent += successful(tier) ? 2 : 4; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) { op.restraintUntil = p.clockSeconds + 8; op.inputActive = true; } break;
    case 'EMOTION_INTERFERENCE': a.emotionTier = tier; a.spiritualitySpent += 6; a.mindSpent += successful(tier) ? 2 : 4; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) { op.hesitationUntil = p.clockSeconds + 6; op.inputActive = true; } break;
    case 'PERFORM_OPERATION': a.performed = true; if (op.restraintUntil !== null) a.appliedAbilityIds.push(RESTRAINT); if (op.hesitationUntil !== null) a.appliedAbilityIds.push(EMOTION); a.evidence.push('在真实短窗内核对同一原卡与刚亲读的记录：本人暂停匆忙举动；诺拉若有短暂迟疑，仍自行决定拒绝原邀请，门路保持开放。'); elapse(l, p, 2, a); break;
    case 'MANUAL_OPERATION': a.manual = true; a.evidence.push('以普通停顿、原卡和亲读的原记录完成核对，尊重诺拉自己的当前答复；没有把普通结果记为能力应用。'); elapse(l, p, 4, a); break;
    case 'END_FOCUS': op.inputActive = false; a.evidence.push('停止继续作用；当前有限余留仍按实际时间消退，已付成本不退。'); elapse(l, p, 1, a); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.consent = 'WITHDRAWN'; a.stopped = true; op.inputActive = false; a.evidence.push('诺拉明确撤回本案许可，立即停止任何进一步应用；她不接受原邀请，已有短暂余留仍须实际等待。'); elapse(l, p, 1, a); break;
    case 'STOP': a.stopped = true; op.inputActive = false; elapse(l, p, 1, a); break;
    case 'WAIT_6': a.waits++; elapse(l, p, 6, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyBloodDukeActivity(s: SliceState, c: BloodDukeActivityCommand, ctx: SeerContext): void {
  const reason = blockBloodDukeLife(s, c); if (reason) throw new Error(reason);
  const l = s.bloodDuke.life, p = s.blatherer.life, source = checkSource(l, p, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene: BloodDukeSceneSource | null = c.type === 'OBSERVE' && l.source === null ? { root: 'blatherer.life', promotionWeek: s.bloodDuke.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(p) } : null;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(l, c, tier), budget: BloodDukeLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原安静室：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}。同一原卡仍属诺拉；当前许可、实际等待和原路归还均有记录，已付成本与旧伤保留。`);
}
export const applyBloodDukeLife = applyBloodDukeActivity;
export const handleBloodDukeLife = applyBloodDukeActivity;
const LOCATIONS = { START: '原室门口', A: '四米处诺拉身旁', B: '八米处原铃旁' } as const;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<BloodDukeActivityCommand['type'], string> = { OBSERVE: '核对原室的人、物与普通退路', PREPARE: '准备本案有限核对', WALK: '沿原路普通步行', CONSENT_NORA: '当面询问诺拉本案当前许可', TAKE_CARD: '当面临时借取同一原卡', RETURN_CARD: '当面归还同一原卡', READ_NOTE: '亲读原铃旁同一记录', REHEARSE_BELL: '按当前许可轻敲原铃排演一次', CONFIRM_EMOTION: '当面确认铃声后的当前强烈情绪', NOTICE_IMPULSE: '记录自己此刻匆忙出门的冲动', SELF_RESTRAINT: '短暂约束自己当前的冲动', EMOTION_INTERFERENCE: '对当前同意且情绪强烈的诺拉作短试验', PERFORM_OPERATION: '在真实短窗内核对原卡与当前选择', MANUAL_OPERATION: '以普通停顿和原物核对完成', END_FOCUS: '停止继续作用并保留实际余留', WITHDRAW_PERMISSION: '听取诺拉撤回本案许可', STOP: '明确停止本次方案', WAIT_6: '实际等待六秒', INSPECT: '核实实际结果与归还退出', LEAVE: '结束已收束接触', CLOSE: '结束已收束接触', WITHDRAW: '如实取消并结束接触', REPORT: '报告实际发生的有限结果', REFLECT: '反思三次有限实践' };
export const BLOOD_DUKE_LIFE_STORY = '46岁的诺拉·温特仍在原安静室四米处，罗安留在室外。同一原卡、原铃和原记录各只有一份。每案须本人当面取得可撤回许可，再实际往返核对。短暂自我约束只作用于自己刚察觉的冲动；情绪干涉必须先有自愿铃声排演，再由诺拉当面明确确认此刻仍有强烈紧张，只可能产生短暂迟疑。';
export const BLOOD_DUKE_LIFE_ENVIRONMENT = '门口至诺拉四米，诺拉至原铃四米，每米步行一秒。两种能力每次都需一行动、六灵性，成功损二精神，失败损四精神；自我约束至多八秒，情绪迟疑至多六秒。停止或撤回立即禁止继续应用，已有余留按实际等待结束。普通方法也可完成三份报告与反思；只有真实应用才增加相应掌握。';
const CASES: { id: BloodDukeCaseId; title: string; story: string }[] = [
  { id: 'door-restraint', title: '原门前的一次自我约束', story: '向诺拉借原卡，实际到原铃旁读原记录，再走回她身旁。发现自己当下想匆忙出门后，可付费短暂压住自己的冲动，核对原卡后停止并等待；也可普通停顿完成。' },
  { id: 'bell-hesitation', title: '自愿铃声后的短暂迟疑', story: '诺拉可同意一次轻铃排演。本人亲手敲原铃，走回当面确认她此刻仍强烈紧张且仍同意，才可试一次短暂情绪干涉；原邀请是否接受始终由她决定。' },
  { id: 'withdrawn-rehearsal', title: '撤回许可后的实际收尾', story: '分别核实本人当前冲动与诺拉当前强烈情绪，再作两次各自付费的短试验，或全程普通核对。诺拉明确撤回后立即停止进一步应用，真实等待、当面归卡并沿原路出门。' },
];
function preferred(s: SliceState, actions: BloodDukeLifeAction[]): BloodDukeLifeAction | undefined {
  const l = s.bloodDuke.life, p = s.blatherer.life, a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: BloodDukeActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = (to: BloodDukeLocation) => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!a) return pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (a.performed || a.manual || a.stopped) return (l.activeCase === 'withdrawn-rehearsal' && !a.permissionWithdrawn ? pick('WITHDRAW_PERMISSION') : undefined) ?? pick('END_FOCUS') ?? (windows(l) ? pick('WAIT_6') : undefined) ?? pick('RETURN_CARD') ?? (p.playerLocation === 'B' ? walk('A') : walk('START')) ?? pick('INSPECT');
  if (p.playerLocation === 'START') return walk('A');
  if (p.playerLocation === 'B') return pick('READ_NOTE') ?? pick('REHEARSE_BELL') ?? walk('A');
  if (!a.reachedBell) return pick('CONSENT_NORA') ?? pick('TAKE_CARD') ?? walk('B');
  if (a.method === 'ORDINARY') return pick('MANUAL_OPERATION') ?? pick('STOP');
  return pick('CONFIRM_EMOTION') ?? pick('NOTICE_IMPULSE') ?? pick('SELF_RESTRAINT') ?? pick('EMOTION_INTERFERENCE') ?? pick('PERFORM_OPERATION') ?? pick('END_FOCUS') ?? (windows(l) ? pick('WAIT_6') : undefined) ?? pick('MANUAL_OPERATION') ?? pick('STOP');
}
export function bloodDukeLifeActions(s: SliceState): BloodDukeLifeAction[] {
  if (!promoted(s) || s.bloodDuke.encounter.status !== 'AVAILABLE') return [];
  const l = s.bloodDuke.life, p = s.blatherer.life, out: BloodDukeLifeAction[] = [], id = l.activeCase ?? BLOOD_DUKE_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: BloodDukeActivityCommand) => { const reason = blockBloodDukeLife(s, command), cost = commandCost(l, command), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `BD2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const command: BloodDukeActivityCommand = { type, caseId: id }; if (localBlock(l, p, command, s.week) === null) add(command); }
    for (const to of ['START', 'A', 'B'] as const) { const command: BloodDukeActivityCommand = { type: 'WALK', caseId: id, to }; if (localBlock(l, p, command, s.week) === null) add(command); }
  }
  return out;
}
export function projectBloodDukeLife(s: SliceState): BloodDukeLifeProjection {
  const l = s.bloodDuke.life, p = s.blatherer.life, actions = bloodDukeLifeActions(s), next = preferred(s, actions);
  return { title: '原安静室的有限约束与当前情绪', story: BLOOD_DUKE_LIFE_STORY, environment: BLOOD_DUKE_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原成人、原物与所有实际消耗继续保留。' : '先支付必要成本或收束当前接触。'), preferredActionId: next?.id ?? null,
    facts: [`同一位46岁的诺拉${p.volunteer.location === 'A' ? '仍在四米处' : '已按实际记录离开原位置'}，原罗安${p.guide.location === 'OUTSIDE' ? '在室外' : '在原走廊'}。`, `原卡${p.card.location === 'NORA' ? '由诺拉持有' : '由本人临时保管'}，原铃与原记录仍在八米处；本人实际累计步行${p.playerTravelMetres}米，原室时钟${p.clockSeconds}秒。`, `原门保持开放；本次累计自愿轻铃排演${l.operation.bellRehearsals}次。`, l.operation.restraintUntil !== null ? `自己的有限约束还剩${Math.max(0, l.operation.restraintUntil - p.clockSeconds)}秒。` : '当前没有自己的约束余留。', l.operation.hesitationUntil !== null ? `当前听者的短暂迟疑还剩${Math.max(0, l.operation.hesitationUntil - p.clockSeconds)}秒；这不授予服从或原卡所有权。` : '当前没有听者迟疑余留。', '旧伤、旧恶意、紧绷和良知后果继续保留，生活实践不能治伤、吸血或复活。'], activeCase: l.activeCase, inside: hasBloodDukeLifeLock(s), insideCase: open(l), reflected: l.reflected, site: structuredClone(p), operation: structuredClone(l.operation), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: structuredClone(current(l)), cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { ...d, observations: a ? [`实付${a.spiritualitySpent}灵性、${a.mindSpent}精神；本人步行${a.playerTravelMetres}米，实际经过${a.elapsedSeconds}秒。`, ...a.evidence] : [], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已保留真实短暂应用、当前许可与归还记录。' : '普通完成或明确停止，未应用技巧不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions };
}
/** Full old lifecycle replay is required, not merely a plausible-looking room. */
export function validateBloodDukeSceneSource(v: unknown, s: SliceState): v is BloodDukeSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'blatherer.life' || v.promotionWeek !== s.bloodDuke.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot)) return false;
    const p = v.snapshot as unknown as BlathererLifeState;
    if (!shape(p, Object.keys(createBlathererLifeState())) || p.siteId !== 'BL3-QUIET-ROOM' || p.playerLocation !== 'START' || p.volunteer?.id !== 'BL3-NORA' || p.volunteer.name !== '诺拉·温特' || p.volunteer.age !== 46 || p.volunteer.alive !== true || p.volunteer.location !== 'A' || p.guide?.id !== 'ROAN' || p.guide.location !== 'OUTSIDE' || p.card?.id !== 'BL3-CARD' || p.card.owner !== 'BL3-NORA' || p.card.quantity !== 1 || p.card.location !== 'NORA' || p.bell?.id !== 'BL3-BELL' || p.bell.location !== 'B' || p.note?.id !== 'BL3-NOTE' || p.note.location !== 'B' || p.activeCase !== null || !p.reflected || !record(p.cases) || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    return validateBlathererLifeOriginal({ ...s, blatherer: { ...s.blatherer, life: structuredClone(p) } });
  } catch { return false; }
}
function validBudget(b: BloodDukeLifeBudget, cost: BloodDukeLifeCost, c: BloodDukeActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  const reserved = c.type === 'PREPARE' && c.method === 'ABILITY' ? c.caseId === 'withdrawn-rehearsal' ? 2 : 1 : 0;
  return b.actionsBefore >= cost.actions + reserved && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind && !((c.type === 'SELF_RESTRAINT' || c.type === 'EMOTION_INTERFERENCE') && b.mindBefore < 4);
}
/** Replay the finite continuation into the original room; never mutate old case history. */
export function replayBloodDukeLifeRoot(s: SliceState): BlathererLifeState | null {
  try {
    const l = s.bloodDuke?.life, expected = createBloodDukeLifeState(), promotion = s.bloodDuke?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, BLOOD_DUKE_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 240 || !integer(promotion, 1, s.week) || !validateBloodDukeSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot); let previous: BloodDukeLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateBloodDukeActivityCommand(raw.command)) return null;
      const e = raw as unknown as BloodDukeLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(expected, c, e.tier), b = e.budget;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, p, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c)) return null;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter) return null; }
      const handoff = c.type === 'OBSERVE' && expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const recordedBase = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && recordedBase > s.character.coreStats.knowledge) return null;
      const priorCast = expected.journal.find(old => old.source !== null && 'caseId' in c && old.source.caseId === c.caseId);
      if (e.source !== null && priorCast?.source && priorCast.source.baseAbility !== recordedBase) return null;
      const source = checkSource(expected, p, c, recordedBase, s.character.name, s.character.gender);
      if (!same(e.source, source)) return null;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || e.tier !== check.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return null;
    if (open(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.bloodDuke.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return null;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null;
    }
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'); for (const id of [RESTRAINT, EMOTION]) if ((s.progression.mastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return p;
  } catch { return null; }
}
export function validateBloodDukeLifeState(s: SliceState): boolean {
  try {
    const l = s.bloodDuke?.life;
    if (l?.source === null) return same(l, createBloodDukeLifeState());
    const p = replayBloodDukeLifeRoot(s); if (!p) return false;
    if (s.bloodDuke.encounter.status === 'AVAILABLE') return same(s.blatherer.life, p);
    return !open(l) && l.reflected && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED');
  } catch { return false; }
}
export const validateBloodDukeLife = validateBloodDukeLifeState;
/** Old validation may use its snapshot only after every new mutation has been replayed. */
export function reconstructBloodDukeOriginalRoot(s: SliceState): BlathererLifeState | null {
  if (!s.bloodDuke || !validateBloodDukeLifeState(s)) return null;
  if (s.bloodDuke.life.source === null) return s.bloodDuke.encounter.status === 'AVAILABLE' ? structuredClone(s.blatherer.life) : null;
  const lifeEnd = replayBloodDukeLifeRoot(s); if (!lifeEnd) return null;
  const actual = replayBloodDukeEncounterRoot(s, lifeEnd);
  if (!actual || !same(actual, s.blatherer.life)) return null;
  return structuredClone(s.bloodDuke.life.source.snapshot);
}
