import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createFrenzyMageLifeState, validateFrenzyMageLifeOriginal, type FrenzyMageLifeState } from '../frenzy-mage/life.js';
import { replayEntropyDukeEncounterRoot } from './encounter.js';

export const ENTROPY_DUKE_CASE_IDS = ['measured-throw', 'withdrawn-flight', 'lasting-flight'] as const;
export const ENTROPY_DUKE_ACTIVITY_CASE_IDS = ENTROPY_DUKE_CASE_IDS;
export const ACTIVITY_CASE_IDS = ENTROPY_DUKE_CASE_IDS;
export type EntropyDukeCaseId = typeof ENTROPY_DUKE_CASE_IDS[number];
export type EntropyDukeLifeAbilityId = 'black-emperor.s2.action-amplification' | 'black-emperor.s2.effect-prolongation';
export type EntropyDukeLocation = 'START' | 'A' | 'B' | 'C';
export type EntropyDukeConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
/** This is the original room. Widening allows actual flight and the later ordinary exit, not replacement actors or items. */
export interface EntropyDukeSceneRoot extends Omit<FrenzyMageLifeState, 'playerLocation' | 'guide' | 'volunteer' | 'parcel' | 'ball' | 'paper'> {
  playerLocation: EntropyDukeLocation;
  guide: Omit<FrenzyMageLifeState['guide'], 'location'> & { location: 'START' | 'A' | 'OUTSIDE' };
  volunteer: Omit<FrenzyMageLifeState['volunteer'], 'location'> & { location: 'A' | 'B' | 'C' | 'OUTSIDE' };
  parcel: Omit<FrenzyMageLifeState['parcel'], 'location'> & { location: EntropyDukeLocation | 'OUTSIDE' };
  ball: Omit<FrenzyMageLifeState['ball'], 'location' | 'holder'> & { location: EntropyDukeLocation | 'OUTSIDE'; holder: 'GUIDE' | 'PLAYER' | 'PAD' | 'AIRBORNE' };
  paper: Omit<FrenzyMageLifeState['paper'], 'location'> & { location: EntropyDukeLocation | 'OUTSIDE' };
}
export type EntropyDukePhysicalState = EntropyDukeSceneRoot;
const STEPS = ['OBSERVE', 'CHECK_ORIGINALS', 'CONSENT_DARIAN', 'DECLINE_PERMISSION', 'TAKE_BALL', 'ACTION_AMPLIFICATION', 'ORDINARY_THROW', 'EFFECT_PROLONGATION', 'WITHDRAW_PERMISSION', 'STOP_INPUT', 'WAIT_FLIGHT', 'READ_RESULT', 'TAKE_RESULT', 'RETURN_OBJECTS', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type EntropyDukeActivityCommand = { type: typeof STEPS[number]; caseId: EntropyDukeCaseId } | { type: 'PREPARE'; caseId: EntropyDukeCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: EntropyDukeCaseId; to: EntropyDukeLocation } | { type: 'REFLECT' };
export interface EntropyDukeSceneSource { root: 'frenzyMage.life'; promotionWeek: number; introducedWeek: number; snapshot: FrenzyMageLifeState }
export interface EntropyDukeFlight {
  objectId: 'FM3-PRACTICE-BALL'; actor: 'PLAYER'; sourceCaseId: EntropyDukeCaseId; sourceAction: 'OWN_THROW'; from: 'A'; to: 'B'; distanceMm: 4000;
  launchedAt: number; originalLandAt: number; landsAt: number; segmentStartAt: number; segmentStartMm: number; positionMm: number;
  amplificationApplied: boolean; prolongationApplied: boolean; prolongations: 0 | 1;
}
export interface EntropyDukeOperationState { door: 'OPEN'; inputActive: boolean; flight: EntropyDukeFlight | null }
export interface EntropyDukeMovement { from: EntropyDukeLocation; to: EntropyDukeLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
export interface EntropyDukeAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: EntropyDukeConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  originalsChecked: boolean; ballTaken: boolean; throwStarted: boolean; throwCompleted: boolean; amplificationTier: PublicResolutionTier | null; prolongationTier: PublicResolutionTier | null;
  ownFlight: EntropyDukeFlight | null; landingAt: number | null; resultRead: boolean; ballRetrieved: boolean; objectsReturned: boolean; inspected: boolean;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; waitedSeconds: number;
  appliedAbilityIds: EntropyDukeLifeAbilityId[]; playerMoves: EntropyDukeMovement[]; guideMoves: EntropyDukeMovement[]; evidence: string[];
}
export interface EntropyDukeCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: EntropyDukeAttempt[] }
export interface EntropyDukeLifeCost { actions: number; spirituality: number; mind: number; pennies: 0; health: 0; cashGained: 0 }
export interface EntropyDukeLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface EntropyDukeCheckSource { caseId: EntropyDukeCaseId; abilityId: EntropyDukeLifeAbilityId; cost: 6 | 4; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'black-emperor'; sequence: 2; name: string; gender: string }; at: number; actorLocation: 'A'; currentConsent: 'GRANTED'; volunteerId: 'FM3-DARIAN'; volunteerLocation: 'A'; objectId: 'FM3-PRACTICE-BALL'; objectHolder: 'PLAYER' | 'AIRBORNE'; ownAction: 'CURRENT_THROW' | 'CURRENT_AIRBORNE_BALL'; flight: EntropyDukeFlight | null; paperId: 'FM3-ROUTE-PAPER'; paperText: '从A到B'; padsClear: true }
export interface EntropyDukeLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: EntropyDukeActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: EntropyDukeCheckSource | null; inheritedScene: EntropyDukeSceneSource | null; paid: EntropyDukeLifeCost; budget: EntropyDukeLifeBudget }
export interface EntropyDukeLifeState { source: EntropyDukeSceneSource | null; activeCase: EntropyDukeCaseId | null; reflected: boolean; operation: EntropyDukeOperationState; cases: Record<EntropyDukeCaseId, EntropyDukeCaseState>; journal: EntropyDukeLifeEvent[] }
export interface EntropyDukeLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: EntropyDukeActivityCommand }
export interface EntropyDukeAttemptProjection { method: 'ABILITY' | 'ORDINARY'; consent: EntropyDukeConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean; amplificationTier: PublicResolutionTier | null; prolongationTier: PublicResolutionTier | null; flightRemainingSeconds: number; flightDistanceMetres: number; throwCompleted: boolean; resultRead: boolean; objectsReturned: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; evidence: string[] }
export interface EntropyDukeLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: EntropyDukeCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: EntropyDukeLocation; playerTravelMetres: number; currentAttempt: EntropyDukeAttemptProjection | null; site: { title: string; guide: string; volunteer: string; parcel: string; ball: string; paper: string; pads: string[] }; cases: { id: EntropyDukeCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: EntropyDukeAttemptProjection[] }[]; actions: EntropyDukeLifeAction[] }
const AMPLIFY = 'black-emperor.s2.action-amplification' as const, PROLONG = 'black-emperor.s2.effect-prolongation' as const;
/** G: numerical practice bounds, not claims of universal canonical strength or duration. */
const MAX_FLIGHT_SECONDS = 30;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 2;
const site = (s: SliceState): EntropyDukeSceneRoot => s.frenzyMage.life as EntropyDukeSceneRoot;
const freshCase = (): EntropyDukeCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createEntropyDukeLifeState(): EntropyDukeLifeState { return { source: null, activeCase: null, reflected: false, operation: { door: 'OPEN', inputActive: false, flight: null }, cases: { 'measured-throw': freshCase(), 'withdrawn-flight': freshCase(), 'lasting-flight': freshCase() }, journal: [] }; }
const current = (l: EntropyDukeLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: EntropyDukeLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
function cleanupBlock(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot): string | null {
  if (l.operation.inputActive || l.operation.flight || p.ball.holder === 'AIRBORNE') return '须先停止新输入，并实际等候同一原球落垫；不会撤销已发生的投球。';
  if (p.ball.holder !== 'GUIDE' || p.paper.holder !== 'GUIDE' || p.parcel.holder !== 'GUIDE') return '须亲手取回同一原球，并当面交还原球和原纸。';
  if (p.playerLocation !== 'START' || p.guide.location !== 'START' || p.ball.location !== 'START' || p.paper.location !== 'START' || p.parcel.location !== 'START') return '本人和米蕾须沿四米原路实走回门口，原物由她亲自带回。';
  return p.volunteer.location !== 'A' ? '达里安本人应仍在四米处的安全旁位。' : null;
}
export const hasEntropyDukeLifeLock = (s: SliceState): boolean => open(s.entropyDuke.life);
export const entropyDukeInside = hasEntropyDukeLifeLock;
export const entropyDukeLifeClosed = (s: SliceState): boolean => !open(s.entropyDuke.life) && !!s.entropyDuke.life.source && Object.values(s.entropyDuke.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.entropyDuke.life, site(s));
export function validateEntropyDukeActivityCommand(v: unknown): v is EntropyDukeActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!ENTROPY_DUKE_CASE_IDS.includes(v.caseId as EntropyDukeCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B', 'C'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isEntropyDukeActivityCommand = validateEntropyDukeActivityCommand;
export const isEntropyDukeActivity = validateEntropyDukeActivityCommand;
function localBlock(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, c: EntropyDukeActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并归还原物。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = ENTROPY_DUKE_CASE_IDS.indexOf(c.caseId), op = l.operation;
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[ENTROPY_DUKE_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对同一原房间。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '每案只准备一次，先观察，结果不可重置。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && !!a && a.throwCompleted && a.resultRead ? null : '须真实投出、亲核落点、归物退出；提前取消不能领取成果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '本次已核实，只须结束接触。';
  if (c.type === 'STOP') return !a.stopped ? null : '方案已经停止，成本不会退还。';
  if (c.type === 'STOP_INPUT') return op.inputActive ? null : '没有继续的输入；已投出的原球仍须实际落垫。';
  if (c.type === 'WAIT_FLIGHT') return op.flight && op.flight.sourceCaseId === c.caseId && !op.inputActive && (c.caseId !== 'withdrawn-flight' || a.method !== 'ABILITY' || a.permissionWithdrawn || a.consent !== 'GRANTED') ? null : '先停止新输入并记录必要的撤回，再等候这一次原球的实际剩余时间。';
  if (c.type === 'WITHDRAW_PERMISSION') return p.playerLocation === 'A' && a.consent === 'GRANTED' && !a.permissionWithdrawn && (c.caseId !== 'withdrawn-flight' || a.throwStarted) ? null : '须有本案当前许可；撤回案须先真实尝试投球。';
  if (c.type === 'RETURN_OBJECTS') return p.playerLocation === 'A' && p.guide.location === 'A' && !op.flight && !op.inputActive && !a.objectsReturned && (a.resultRead && a.ballRetrieved || a.stopped && !a.throwStarted) && (p.ball.holder === 'PLAYER' || !a.ballTaken && p.ball.holder === 'GUIDE') && p.ball.location === 'A' ? null : '须亲取原球回到米蕾身旁，效果已结束后当面归还。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!(a.resultRead || a.stopped) ? '先亲核真实落点或明确取消。' : c.caseId === 'withdrawn-flight' && a.method === 'ABILITY' && a.throwStarted && a.consent === 'GRANTED' ? '本案先记录达里安明确撤回。' : null);
  if (c.type === 'WALK') {
    if (p.playerLocation === 'START' && c.to === 'A') return !a.playerMoves.length && !a.stopped ? null : '每案只从门口进入一次。';
    if (p.playerLocation === 'A' && c.to === 'B') return a.throwCompleted && !a.resultRead && !op.flight && !op.inputActive ? null : '须等同一原球真实落垫后，再走四米亲核。';
    if (p.playerLocation === 'B' && c.to === 'A') return a.resultRead && a.ballRetrieved && p.ball.holder === 'PLAYER' ? null : '先亲读原纸、亲取同一原球，再带回。';
    if (p.playerLocation === 'A' && c.to === 'START') return a.objectsReturned && !op.flight && !op.inputActive ? null : '原物须先当面归主，再沿四米原路退出。';
    return '本案只沿门口、四米处和原纸指定的接球垫实际步行。';
  }
  if (c.type === 'READ_RESULT') return a.throwCompleted && p.playerLocation === 'B' && p.ball.location === 'B' && p.ball.holder === 'PAD' && p.paper.holder === 'PLAYER' && p.paper.location === 'B' && !a.resultRead ? null : '须本人实走到原球旁，亲读随身同一原纸与实际落点。';
  if (c.type === 'TAKE_RESULT') return p.playerLocation === 'B' && a.resultRead && !a.ballRetrieved && p.ball.holder === 'PAD' ? null : '先亲核落点，再亲手拾回同一原球。';
  if (a.stopped) return '已经取消后续能力，只可等候、核实、归物与普通退出。';
  if (c.type === 'CHECK_ORIGINALS') return p.playerLocation === 'A' && p.guide.location === 'A' && p.volunteer.location === 'A' && !a.originalsChecked ? null : '本人和原导引须先走到四米处，当面核对同一原人、球、包和纸。';
  if (c.type === 'CONSENT_DARIAN' || c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'A' && a.originalsChecked && a.consent === 'UNASKED' && a.method === 'ABILITY' ? null : '先当面核对原物，仅询问本次可撤回许可，不复用旧同意。';
  if (c.type === 'TAKE_BALL') return p.playerLocation === 'A' && a.originalsChecked && !a.ballTaken && p.ball.holder === 'GUIDE' && (a.method === 'ORDINARY' || a.consent !== 'UNASKED') ? null : '先核对原物和本次选择，由米蕾亲交同一原球和原纸。';
  if (c.type === 'ORDINARY_THROW' || c.type === 'ACTION_AMPLIFICATION') {
    if (!a.ballTaken || a.throwStarted || p.playerLocation !== 'A' || p.ball.holder !== 'PLAYER' || p.ball.location !== 'A' || op.flight) return '只可本人在四米处亲持同一原球，实际投出一次；不增幅旁人的动作或已经完成的投球。';
    if (c.type === 'ACTION_AMPLIFICATION') return a.method === 'ABILITY' && a.consent === 'GRANTED' && p.volunteer.willing && a.amplificationTier === null ? null : '增幅只用于本人此刻的一次真实投球，须有当前明确许可。';
    return null;
  }
  if (c.type === 'EFFECT_PROLONGATION') return c.caseId === 'lasting-flight' && a.method === 'ABILITY' && a.consent === 'GRANTED' && p.volunteer.willing && p.playerLocation === 'A' && a.prolongationTier === null && op.flight?.actor === 'PLAYER' && op.flight.sourceCaseId === c.caseId && op.flight.objectId === p.ball.id && p.ball.holder === 'AIRBORNE' && op.flight.prolongations === 0 && op.flight.landsAt > p.clockSeconds + 1 ? null : '只可延长自己本案仍在空中的原球一次，最迟投出后三十秒落垫；不能叠加、延长他人效果或改写已落地事件。';
  return '当前阶段不能进行这一步。';
}
function commandCost(c: EntropyDukeActivityCommand, tier: PublicResolutionTier | null = null): EntropyDukeLifeCost {
  const cast = c.type === 'ACTION_AMPLIFICATION' || c.type === 'EFFECT_PROLONGATION';
  return { actions: cast || ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'ACTION_AMPLIFICATION' ? 6 : c.type === 'EFFECT_PROLONGATION' ? 4 : 0, mind: cast ? tier !== null && !passed(tier) ? 4 : 2 : 0, pennies: 0, health: 0, cashGained: 0 };
}
const reserve = (c: EntropyDukeActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? c.caseId === 'lasting-flight' ? 2 : 1 : 0;
function makeSource(s: SliceState): EntropyDukeSceneSource { return { root: 'frenzyMage.life', promotionWeek: s.entropyDuke.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(s.frenzyMage.life) }; }
export function blockEntropyDukeLife(s: SliceState, c: EntropyDukeActivityCommand): string | null {
  if (!validateEntropyDukeActivityCommand(c)) return '熵之公爵生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已经成为熵之公爵。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际来到贝克兰德原演练房。';
  if (s.entropyDuke.preparedWeek !== null || s.entropyDuke.encounter.status !== 'AVAILABLE' || s.entropyDuke.encounter.preparation) return '先完成晋升准备；后续遭遇开始后不能重开原案。';
  if (s.entropyDuke.life.source === null && !validateEntropyDukeSceneSource(makeSource(s), s)) return '原房间的旧实践与原物收尾须完整，不能另造一套来源。';
  const reason = localBlock(s.entropyDuke.life, site(s), c, s.week); if (reason) return reason;
  const cost = commandCost(c);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '本周须预留准备和本案有限施术的行动；普通收尾始终不耗行动。';
  if (s.spirituality < cost.spirituality || s.mind < (cost.spirituality ? 4 : 0)) return '资源不足以支付本次真实成本及失败精神消耗，可改用普通方法或安全收尾。';
  return null;
}
export const entropyDukeActivityReason = blockEntropyDukeLife;
/** Each elapsed second moves the one airborne original. Landing never returns it to a hand. */
export function advanceEntropyDukeLifeClock(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, seconds: number, a: EntropyDukeAttempt | null = current(l)): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。');
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  const f = l.operation.flight; if (!f) return;
  f.positionMm = Math.min(4000, f.segmentStartMm + Math.floor((4000 - f.segmentStartMm) * (p.clockSeconds - f.segmentStartAt) / (f.landsAt - f.segmentStartAt)));
  if (p.clockSeconds >= f.landsAt) {
    if (a) { a.throwCompleted = true; a.landingAt = f.landsAt; a.ownFlight = structuredClone(f); if (f.amplificationApplied) a.appliedAbilityIds.push(AMPLIFY); if (f.prolongationApplied && f.landsAt > f.originalLandAt) a.appliedAbilityIds.push(PROLONG); a.evidence.push(`同一原球实际飞过四米，在投出后${f.landsAt - f.launchedAt}秒落到原纸指定的空垫；没有再投或改写旧结果。`); }
    p.ball.holder = 'PAD'; p.ball.location = 'B'; l.operation.flight = null;
  }
}
const elapse = advanceEntropyDukeLifeClock;
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY'): EntropyDukeAttempt { return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, originalsChecked: false, ballTaken: false, throwStarted: false, throwCompleted: false, amplificationTier: null, prolongationTier: null, ownFlight: null, landingAt: null, resultRead: false, ballRetrieved: false, objectsReturned: false, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, waitedSeconds: 0, appliedAbilityIds: [], playerMoves: [], guideMoves: [], evidence: [] }; }
function checkSource(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, c: EntropyDukeActivityCommand, baseAbility: number, name: string, gender: string): EntropyDukeCheckSource | null {
  if (c.type !== 'ACTION_AMPLIFICATION' && c.type !== 'EFFECT_PROLONGATION') return null;
  return { caseId: c.caseId, abilityId: c.type === 'ACTION_AMPLIFICATION' ? AMPLIFY : PROLONG, cost: c.type === 'ACTION_AMPLIFICATION' ? 6 : 4, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'black-emperor', sequence: 2, name, gender }, at: p.clockSeconds, actorLocation: 'A', currentConsent: 'GRANTED', volunteerId: p.volunteer.id, volunteerLocation: 'A', objectId: p.ball.id, objectHolder: c.type === 'ACTION_AMPLIFICATION' ? 'PLAYER' : 'AIRBORNE', ownAction: c.type === 'ACTION_AMPLIFICATION' ? 'CURRENT_THROW' : 'CURRENT_AIRBORNE_BALL', flight: structuredClone(l.operation.flight), paperId: p.paper.id, paperText: p.paper.text, padsClear: true };
}
function move(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, a: EntropyDukeAttempt, to: EntropyDukeLocation): void {
  const from = p.playerLocation, items = [p.ball, p.paper].filter(x => x.holder === 'PLAYER').map(x => x.id);
  a.playerMoves.push({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: items });
  if (from === 'START' || to === 'START') { const originals = [p.parcel, p.ball, p.paper].filter(x => x.holder === 'GUIDE'); a.guideMoves.push({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: originals.map(x => x.id) }); p.guide.location = to as 'START' | 'A'; p.guideTravelMetres += 4; for (const x of originals) x.location = to; }
  for (const x of [p.ball, p.paper]) if (x.holder === 'PLAYER') x.location = to;
  p.playerLocation = to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; elapse(l, p, 4, a);
}
function launch(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, a: EntropyDukeAttempt, id: EntropyDukeCaseId, amplified: boolean): void {
  const at = p.clockSeconds, landsAt = at + (amplified ? 2 : 4);
  const f: EntropyDukeFlight = { objectId: p.ball.id, actor: 'PLAYER', sourceCaseId: id, sourceAction: 'OWN_THROW', from: 'A', to: 'B', distanceMm: 4000, launchedAt: at, originalLandAt: landsAt, landsAt, segmentStartAt: at, segmentStartMm: 0, positionMm: 0, amplificationApplied: amplified, prolongationApplied: false, prolongations: 0 };
  l.operation.flight = f; a.ownFlight = structuredClone(f); a.throwStarted = true; p.ball.holder = 'AIRBORNE'; p.ball.throws++;
}
function evolve(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot, c: EntropyDukeActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: EntropyDukeSceneSource | null): void {
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6); return; }
  const r = l.cases[c.caseId], op = l.operation;
  if (c.type === 'OBSERVE') { if (l.source === null) { if (!source) throw new Error('缺少原房间的真实交接记录。'); l.source = structuredClone(source); } r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.method); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': move(l, p, a, c.to); break;
    case 'CHECK_ORIGINALS': a.originalsChecked = true; a.evidence.push('当面核对42岁的原达里安、米蕾、400克原封包、80克原软球、同一原纸和两块空垫；原纸仍写从A到B。'); elapse(l, p, 2, a); break;
    case 'CONSENT_DARIAN': a.consent = 'GRANTED'; r.consentWeek = week; p.volunteer.willing = true; a.evidence.push('达里安与原物主人米蕾当面同意本案的有限演练，可随时撤回；能力只涉及本人投出的原球，不控制旁人的身体或意愿。'); elapse(l, p, 1, a); break;
    case 'DECLINE_PERMISSION': a.consent = 'DECLINED'; p.volunteer.willing = false; a.evidence.push('听取本案拒绝，不再索取能力许可；仍可普通投球并亲自归还原物。'); elapse(l, p, 1, a); break;
    case 'TAKE_BALL': a.ballTaken = true; p.ball.holder = 'PLAYER'; p.paper.holder = 'PLAYER'; a.evidence.push('米蕾当面交来唯一原软球与同一原纸，所有权不变，原封包仍由她持有。'); elapse(l, p, 1, a); break;
    case 'ACTION_AMPLIFICATION': a.amplificationTier = tier; a.spiritualitySpent += 6; a.mindSpent += passed(tier) ? 2 : 4; r.status = 'ACTIVE'; elapse(l, p, 1, a); launch(l, p, a, c.caseId, passed(tier)); op.inputActive = passed(tier); a.evidence.push(passed(tier) ? '本人当下的这一次真实投球获得有限增幅，原球沿四米净空轨迹飞出；成功不是重写过去或控制别人。' : '本次增幅未成，六灵性与失败精神成本照付；本人仍真实投出同一原球，按普通四秒飞行。'); break;
    case 'ORDINARY_THROW': r.status = 'ACTIVE'; elapse(l, p, 1, a); launch(l, p, a, c.caseId, false); a.evidence.push('本人普通投出同一原球，四米轨迹需四秒；没有能力检定或额外随机事件。'); break;
    case 'EFFECT_PROLONGATION': {
      a.prolongationTier = tier; a.spiritualitySpent += 4; a.mindSpent += passed(tier) ? 2 : 4; elapse(l, p, 1, a);
      const f = op.flight!; if (passed(tier)) { f.segmentStartAt = p.clockSeconds; f.segmentStartMm = f.positionMm; f.landsAt = f.launchedAt + MAX_FLIGHT_SECONDS; f.prolongationApplied = true; f.prolongations = 1; op.inputActive = true; a.ownFlight = structuredClone(f); a.evidence.push('只延长自己这一次仍在空中的同一原球，当前实际位置不变；它继续前行，最迟投出后三十秒落垫，不可再延长。'); } else a.evidence.push('延长未成，四灵性与失败精神成本照付；同一原球保持原定落垫时间，不重新投出。'); break;
    }
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.volunteer.willing = false; op.inputActive = false; a.evidence.push('达里安明确撤回本案能力参与，立即停止一切新输入；已经飞出的原球保留真实轨迹和有限时限，不会倒回手中。'); elapse(l, p, 1, a); break;
    case 'STOP_INPUT': op.inputActive = false; a.evidence.push('停止新的能力输入；同一原球继续按现有限期前行，停止不能抹去已经投出的事实。'); elapse(l, p, 1, a); break;
    case 'WAIT_FLIGHT': { const seconds = op.flight!.landsAt - p.clockSeconds; a.waitedSeconds += seconds; elapse(l, p, seconds, a); a.evidence.push(`实际等待剩余${seconds}秒，原球留在原垫，仍须本人走过去取回。`); break; }
    case 'READ_RESULT': a.resultRead = true; a.evidence.push('本人实际走到原垫，亲见同一原球并比对随身原纸，确认这一真实投球的终点和经过秒数。'); elapse(l, p, 2, a); break;
    case 'TAKE_RESULT': a.ballRetrieved = true; p.ball.holder = 'PLAYER'; elapse(l, p, 1, a); break;
    case 'RETURN_OBJECTS': p.ball.holder = 'GUIDE'; p.paper.holder = 'GUIDE'; if (a.ballTaken) p.ball.returns++; a.objectsReturned = true; a.evidence.push('本人携同一原球和原纸实走回米蕾身旁，当面交还；原封包与两块垫始终未被复制或替换。'); elapse(l, p, 2, a); break;
    case 'STOP': a.stopped = true; op.inputActive = false; a.evidence.push('停止后续方案，成本保留；已投出的原球仍须真正落垫、核实并亲手归还。'); elapse(l, p, 1, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.resultRead && a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyEntropyDukeActivity(s: SliceState, c: EntropyDukeActivityCommand, ctx: SeerContext): void {
  const reason = blockEntropyDukeLife(s, c); if (reason) throw new Error(reason);
  const l = s.entropyDuke.life, p = site(s), source = checkSource(l, p, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene = c.type === 'OBSERVE' && l.source === null ? makeSource(s) : null;
  const randomCursor = s.random.cursor; let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier), budget: EntropyDukeLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原演练房：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}，同一原球${opDescription(l, p)}。原人、原物、实际秒数和已付成本全部保留。`);
}
export const applyEntropyDukeLife = applyEntropyDukeActivity;
export const handleEntropyDukeLife = applyEntropyDukeActivity;
const LOCATIONS = { START: '原房门口', A: '四米处投球线', B: '原纸指定的接球垫', C: '另一块空垫', OUTSIDE: '房间外' } as const;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<EntropyDukeActivityCommand['type'], string> = { OBSERVE: '核对原房间与普通退路', PREPARE: '准备本次有限演练', WALK: '沿原路普通步行', CHECK_ORIGINALS: '当面核对同一原人和原物', CONSENT_DARIAN: '询问本次可随时撤回的许可', DECLINE_PERMISSION: '接受本次拒绝并改用普通方法', TAKE_BALL: '从米蕾手中亲取原球和原纸', ACTION_AMPLIFICATION: '增幅本人当下这一次真实投球', ORDINARY_THROW: '普通投出同一原软球', EFFECT_PROLONGATION: '延长自己仍在空中的原球一次', WITHDRAW_PERMISSION: '听取达里安明确撤回本案许可', STOP_INPUT: '停止新输入并保留已发生的轨迹', WAIT_FLIGHT: '实际等待原球剩余飞行时间', READ_RESULT: '亲读原纸并核对真实原球落点', TAKE_RESULT: '亲手拾回原垫上同一原球', RETURN_OBJECTS: '当面向米蕾归还原球与原纸', STOP: '取消后续方案并安全收尾', INSPECT: '核实原物归还与普通退出', LEAVE: '结束已收束的本次接触', CLOSE: '结束已收束的本次接触', WITHDRAW: '如实取消并退出', REPORT: '报告真正发生的有限结果', REFLECT: '反思三次有限实践' };
export const ENTROPY_DUKE_LIFE_STORY = '米蕾·沃德仍带着原封包、软布球和路线纸；42岁的达里安·维尔在原演练房四米处的安全旁位。本人只能增幅自己此刻的真实投球，或延长自己仍在空中的这只原球一次。不能控制旁人的动作、改写已落地的结果，或把一段短效果无限续接。';
export const ENTROPY_DUKE_LIFE_ENVIRONMENT = '门口到投球线四米，投球线到两块原空垫各四米，普通步行每米一秒。原纸始终写从A到B；本次只向指定空垫投球。普通飞行四秒，成功增幅后两秒；延长成功也最迟投出后三十秒落垫。增幅实付六灵性，延长实付四灵性，各耗一行动、成功二精神或失败四精神，知识难度二十。停止、等候、取回和归还不耗行动或灵性，旧伤不会因此恢复。';
const CASES: { id: EntropyDukeCaseId; title: string; story: string }[] = [
  { id: 'measured-throw', title: '本人当下的一次投球', story: '亲取同一原球，在净空轨迹真实投出；有限增幅只改变本人这一次出手。本人须等球落垫、实走亲核，再取原球归主。' },
  { id: 'withdrawn-flight', title: '撤回后的真实轨迹', story: '达里安在本次真实投球后撤回能力参与。立即停止新输入；已经飞出的原球不会倒回手中，只能等它真实落垫，再普通核实归还。' },
  { id: 'lasting-flight', title: '仍在空中的短暂效果', story: '只在自己的这次原球尚未落垫时尝试延长一次，保留当前真实位置并继续前行。总飞行最迟三十秒，不可叠加；失败保持原时限和已付成本。' },
];
function opDescription(l: EntropyDukeLifeState, p: EntropyDukeSceneRoot): string { return l.operation.flight ? `在四米轨迹上飞过${l.operation.flight.positionMm / 1000}米，剩余${l.operation.flight.landsAt - p.clockSeconds}秒` : p.ball.holder === 'PAD' ? '已落在原垫，尚未归还' : p.ball.holder === 'PLAYER' ? '由本人亲持' : `由米蕾亲持，位于${LOCATIONS[p.ball.location]}`; }
function preferred(s: SliceState, actions: EntropyDukeLifeAction[]): EntropyDukeLifeAction | undefined {
  const l = s.entropyDuke.life, p = site(s), a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: EntropyDukeActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = (to: EntropyDukeLocation) => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!a) return pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (a.stopped) return (l.activeCase === 'withdrawn-flight' && a.throwStarted && a.consent === 'GRANTED' ? pick('WITHDRAW_PERMISSION') : undefined) ?? pick('STOP_INPUT') ?? pick('WAIT_FLIGHT') ?? walk('B') ?? pick('READ_RESULT') ?? pick('TAKE_RESULT') ?? walk('A') ?? pick('RETURN_OBJECTS') ?? walk('START') ?? pick('INSPECT');
  if (l.activeCase === 'withdrawn-flight' && a.method === 'ABILITY' && a.throwStarted && a.consent === 'GRANTED') return pick('WITHDRAW_PERMISSION');
  if (p.playerLocation === 'START') return walk('A') ?? pick('INSPECT');
  if (p.playerLocation === 'B') return pick('READ_RESULT') ?? pick('TAKE_RESULT') ?? walk('A');
  if (!a.throwStarted) return pick('CHECK_ORIGINALS') ?? pick('CONSENT_DARIAN') ?? pick('TAKE_BALL') ?? pick('ACTION_AMPLIFICATION') ?? pick('ORDINARY_THROW') ?? pick('STOP');
  return pick('EFFECT_PROLONGATION') ?? pick('STOP_INPUT') ?? pick('WAIT_FLIGHT') ?? walk('B') ?? pick('RETURN_OBJECTS') ?? walk('START') ?? pick('INSPECT');
}
export function entropyDukeLifeActions(s: SliceState): EntropyDukeLifeAction[] {
  if (!promoted(s) || s.entropyDuke.encounter.status !== 'AVAILABLE' || s.entropyDuke.encounter.preparation) return [];
  const l = s.entropyDuke.life, p = site(s), out: EntropyDukeLifeAction[] = [], id = l.activeCase ?? ENTROPY_DUKE_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: EntropyDukeActivityCommand) => { const reason = blockEntropyDukeLife(s, command), cost = commandCost(command), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); if (command.type === 'WAIT_FLIGHT') values.push(`${Math.max(0, (l.operation.flight?.landsAt ?? p.clockSeconds) - p.clockSeconds)}秒`); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `ED2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id }); if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); } if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) { for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const c: EntropyDukeActivityCommand = { type, caseId: id }; if (!localBlock(l, p, c, s.week)) add(c); } for (const to of ['START', 'A', 'B', 'C'] as const) { const c: EntropyDukeActivityCommand = { type: 'WALK', caseId: id, to }; if (!localBlock(l, p, c, s.week)) add(c); } }
  return out;
}
function projectAttempt(a: EntropyDukeAttempt, l: EntropyDukeLifeState, p: EntropyDukeSceneRoot): EntropyDukeAttemptProjection {
  const f = l.operation.flight?.sourceCaseId && current(l) === a ? l.operation.flight : null;
  return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, permissionWithdrawn: a.permissionWithdrawn, amplificationTier: a.amplificationTier, prolongationTier: a.prolongationTier, flightRemainingSeconds: f ? Math.max(0, f.landsAt - p.clockSeconds) : 0, flightDistanceMetres: f ? f.positionMm / 1000 : a.throwCompleted ? 4 : 0, throwCompleted: a.throwCompleted, resultRead: a.resultRead, objectsReturned: a.objectsReturned, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, evidence: [...a.evidence] };
}
export function projectEntropyDukeLife(s: SliceState): EntropyDukeLifeProjection {
  const l = s.entropyDuke.life, p = site(s), a = current(l), actions = entropyDukeLifeActions(s), next = preferred(s, actions);
  return { title: '原演练房的有限增幅与延长', story: ENTROPY_DUKE_LIFE_STORY, environment: ENTROPY_DUKE_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原物与实际消耗继续保留。' : '先支付必要成本或完成普通收尾。'), preferredActionId: next?.id ?? null, facts: [`同一42岁的达里安在${LOCATIONS[p.volunteer.location]}，健康与精神仍各为${p.volunteer.health}和${p.volunteer.mind}。`, `同一原球${opDescription(l, p)}；两块原垫仍净空。`, `原封包仍为400克、原软球仍为80克，所有权均属米蕾；同一原纸文字没有变化。`, `本人累计普通步行${p.playerTravelMetres}米，原房时钟${p.clockSeconds}秒。`, '只可改变本人当下动作或自己仍存的短暂效果；失败照付，停止不退费，不能重演已经完成的事件。'], activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: a ? projectAttempt(a, l, p) : null, site: { title: '原协会净空投递演练房', guide: `米蕾·沃德在${LOCATIONS[p.guide.location]}`, volunteer: `42岁的达里安·维尔在${LOCATIONS[p.volunteer.location]}，保持独立意愿`, parcel: `原400克封包由米蕾持有，位于${LOCATIONS[p.parcel.location]}`, ball: `原80克软布球${opDescription(l, p)}`, paper: `同一原纸仍写“${p.paper.text}”，位于${LOCATIONS[p.paper.location]}`, pads: ['原纸指定的接球垫净空', '另一块原垫净空'] }, cases: CASES.map(d => { const r = l.cases[d.id]; return { ...d, observations: r.attempts.flatMap(x => [...x.evidence]), status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已亲核真实有限应用，并归还同一原物。' : '已普通核实收束，未应用的技巧不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => projectAttempt(x, l, p)) }; }), actions };
}

export function validateEntropyDukeSceneSource(v: unknown, s: SliceState): v is EntropyDukeSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'frenzyMage.life' || v.promotionWeek !== s.entropyDuke.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot)) return false;
    const p = v.snapshot as unknown as FrenzyMageLifeState, initial = createFrenzyMageLifeState();
    if (!shape(p, Object.keys(initial)) || p.siteId !== initial.siteId || p.playerLocation !== 'START' || p.guide?.id !== 'GUIDE' || p.guide.name !== '米蕾·沃德' || p.guide.location !== 'START' || p.volunteer?.id !== 'FM3-DARIAN' || p.volunteer.name !== '达里安·维尔' || p.volunteer.age !== 42 || p.volunteer.location !== 'A' || p.volunteer.alive !== true || p.volunteer.independentMind !== true || p.volunteer.health !== 100 || p.volunteer.mind !== 100 || !same(p.volunteer.injuries, []) || p.ball?.id !== 'FM3-PRACTICE-BALL' || p.ball.massGrams !== 80 || p.ball.quantity !== 1 || p.ball.owner !== 'GUIDE' || p.parcel?.id !== 'FM3-PARCEL' || p.parcel.massGrams !== 400 || p.parcel.quantity !== 1 || p.parcel.owner !== 'GUIDE' || p.paper?.id !== 'FM3-ROUTE-PAPER' || p.paper.text !== '从A到B' || p.paper.quantity !== 1 || p.paper.owner !== 'GUIDE' || !same(p.pads, initial.pads) || cleanupBlock(createEntropyDukeLifeState(), p as EntropyDukeSceneRoot) || p.activeCase !== null || !p.reflected || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    return validateFrenzyMageLifeOriginal({ ...s, week: v.introducedWeek, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, frenzyMage: { ...s.frenzyMage, life: structuredClone(p) } });
  } catch { return false; }
}
function validBudget(b: EntropyDukeLifeBudget, cost: EntropyDukeLifeCost, c: EntropyDukeActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  return b.actionsBefore >= cost.actions + reserve(c) && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind && !(cost.spirituality && b.mindBefore < 4);
}
/** Reconstruct every actual clock tick, original object position, check and cost on the inherited room. */
export function replayEntropyDukeLifeRoot(s: SliceState): EntropyDukeSceneRoot | null {
  try {
    const l = s.entropyDuke?.life, expected = createEntropyDukeLifeState(), promotion = s.entropyDuke?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, ENTROPY_DUKE_CASE_IDS) || !Array.isArray(l.journal) || !l.journal.length || l.journal.length > 200 || !integer(promotion, 1, s.week) || !validateEntropyDukeSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot) as EntropyDukeSceneRoot; let previous: EntropyDukeLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateEntropyDukeActivityCommand(raw.command)) return null;
      const e = raw as unknown as EntropyDukeLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(c, e.tier), b = e.budget;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1) && e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      const acquisition = s.entropyDuke.acquisitionJournal.at(-1); if (!previous && acquisition && e.revision === acquisition.revision + 1 && e.randomCursor !== acquisition.randomAfter) return null;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, p, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c)) return null;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter) return null; }
      const handoff = c.type === 'OBSERVE' && expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && base > s.character.coreStats.knowledge) return null;
      const prior = expected.journal.find(old => old.source !== null && 'caseId' in c && old.source.caseId === c.caseId); if (e.source !== null && prior?.source && prior.source.baseAbility !== base) return null;
      const source = checkSource(expected, p, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return null;
      if (source) {
        if (!['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return null;
    if (open(l)) { if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.entropyDuke.encounter.status !== 'AVAILABLE' || s.entropyDuke.encounter.preparation || current(l)?.week !== s.week || !previous || !same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor)) return null; const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null; }
    if (previous && s.revision === previous.revision + 1 && s.week === previous.week && previous.budget.actionsAfter > 0) { const b = previous.budget; if (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null; }
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'), lifeMastery = s.entropyDuke.encounter.preparation?.before.mastery ?? s.progression.mastery; for (const id of [AMPLIFY, PROLONG]) if ((lifeMastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return p;
  } catch { return null; }
}
export function validateEntropyDukeLifeState(s: SliceState): boolean {
  try { const l = s.entropyDuke?.life; if (l?.source === null) return same(l, createEntropyDukeLifeState()); const p = replayEntropyDukeLifeRoot(s); if (!p) return false; if (!s.entropyDuke.encounter.preparation) return same(site(s), p); if (open(l) || !l.reflected || cleanupBlock(l, p) || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false; const actual = replayEntropyDukeEncounterRoot(s, p); return !!actual && same(actual, site(s)); } catch { return false; }
}
export const validateEntropyDukeLife = validateEntropyDukeLifeState;
export function reconstructEntropyDukeOriginalRoot(s: SliceState): FrenzyMageLifeState | null { if (!s.entropyDuke || !validateEntropyDukeLifeState(s)) return null; return structuredClone(s.entropyDuke.life.source?.snapshot ?? s.frenzyMage.life); }
export function validateEntropyDukeSourceFrenzyMageLife(s: SliceState): boolean {
  try { if (s.entropyDuke?.life.source === null) return validateFrenzyMageLifeOriginal(s); if (!promoted(s) || s.entropyDuke.frenzyMageActingAtPromotion !== 100) return false; const original = reconstructEntropyDukeOriginalRoot(s); if (!original) return false; return validateFrenzyMageLifeOriginal({ ...s, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, frenzyMage: { ...s.frenzyMage, life: original } }); } catch { return false; }
}
