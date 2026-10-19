import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { WinnerLuck } from '../winner/types.js';
import { createChaosWalkerLifeState, validateChaosWalkerLifeOriginal, type ChaosWalkerLifeState, type ChaosWalkerLocation } from '../chaos-walker/life.js';
import { validateChaosWalkerLuckHistoryOriginal } from '../chaos-walker/index.js';
import { replayFateProphetEncounterRoot } from './encounter.js';

export const FATE_PROPHET_CASE_IDS = ['cart-omen', 'changed-condition', 'finite-disc'] as const;
export const FATE_PROPHET_ACTIVITY_CASE_IDS = FATE_PROPHET_CASE_IDS;
export const ACTIVITY_CASE_IDS = FATE_PROPHET_CASE_IDS;
export type FateProphetCaseId = typeof FATE_PROPHET_CASE_IDS[number];
export type FateProphetLifeAbilityId = 'wheel.s2.event-foresight' | 'wheel.s2.hazard-adjustment';
export type FateProphetLocation = ChaosWalkerLocation;
export type FateProphetConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'CONSENT_VERA', 'DECLINE_PERMISSION', 'WITHDRAW_PERMISSION', 'EVENT_FORESIGHT', 'HAZARD_ADJUSTMENT', 'MANUAL_INSPECTION', 'RELEASE_CART', 'SPIN_DISC', 'READ_RECORD', 'RETURN_CART', 'RETURN_OBJECT', 'STOP', 'WAIT_EFFECT', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type FateProphetActivityCommand = { type: typeof STEPS[number]; caseId: FateProphetCaseId } | { type: 'PREPARE'; caseId: FateProphetCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: FateProphetCaseId; to: FateProphetLocation } | { type: 'ACCUMULATE' } | { type: 'REFLECT' };
/** Preparation changes this same original object's finite physical configuration.
 * The preparation draw is not an event draw and is never a preview of future RNG. */
export interface FateProphetMechanicalState { caseId: FateProphetCaseId; preparedAt: number; preparationRoll: number; bias: 'B' | 'C'; version: 1 | 2 }
export type FateProphetPhysicalState = ChaosWalkerLifeState;
export type FateProphetSceneRoot = ChaosWalkerLifeState;
export interface FateProphetSceneSource { root: 'chaosWalker.life'; promotionWeek: number; introducedWeek: number; snapshot: ChaosWalkerLifeState; luck: WinnerLuck }
export interface FateProphetForecast { objectId: 'CW3-CART' | 'CW3-DISC'; version: 1 | 2; bias: 'B' | 'C'; castAt: number; expiresAt: number; valid: boolean }
export interface FateProphetCorrection { objectId: 'CW3-CART' | 'CW3-DISC'; version: 1 | 2; castAt: number; expiresAt: number; percentagePoints: 15 }
export interface FateProphetOperationState { door: 'OPEN'; mechanical: ({ objectId: 'CW3-CART' | 'CW3-DISC' } & FateProphetMechanicalState) | null; forecast: FateProphetForecast | null; correction: FateProphetCorrection | null }
export interface FateProphetMovement { from: FateProphetLocation; to: FateProphetLocation; mode: 'WALK' | 'PUSH' | 'ROLL'; metres: 4; seconds: 4; itemIds: string[] }
export interface FateProphetAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: FateProphetConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  preparedObjectId: 'CW3-CART' | 'CW3-DISC'; preparationRoll: number; originalBias: 'B' | 'C'; conditionChanged: boolean; manualInspected: boolean; revealedBias: 'B' | 'C' | null;
  foresightTier: PublicResolutionTier | null; adjustmentTier: PublicResolutionTier | null; forecastInvalidated: boolean; correctionCancelled: boolean; correctionExpired: boolean; correctionApplied: boolean;
  eventDraws: 0 | 1; eventRoll: number | null; eventChance: number | null; eventResult: 'B' | 'C' | null; resultRead: boolean; recordRead: boolean; objectsReturned: boolean; inspected: boolean;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; luckSpent: number;
  appliedAbilityIds: FateProphetLifeAbilityId[]; playerMoves: FateProphetMovement[]; objectMoves: FateProphetMovement[]; evidence: string[];
}
export interface FateProphetCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: FateProphetAttempt[] }
export interface FateProphetLifeCost { actions: number; spirituality: number; mind: number; luck: number; pennies: 0; health: 0; cashGained: 0 }
export interface FateProphetLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number; luckBefore: WinnerLuck; luckAfter: WinnerLuck }
export interface FateProphetCheckSource { caseId: FateProphetCaseId; abilityId: FateProphetLifeAbilityId; cost: 5; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'wheel'; sequence: 2; name: string; gender: string }; at: number; actorLocation: 'A'; subjectId: 'CW3-VERA'; currentConsent: 'GRANTED'; objectId: 'CW3-CART' | 'CW3-DISC'; mechanicalState: FateProphetMechanicalState; eventDraws: 0; forecast: FateProphetForecast | null; luck: WinnerLuck }
export interface FateProphetLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: FateProphetActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; physicalRoll: number | null; source: FateProphetCheckSource | null; inheritedScene: FateProphetSceneSource | null; paid: FateProphetLifeCost; budget: FateProphetLifeBudget }
export interface FateProphetLifeState { source: FateProphetSceneSource | null; activeCase: FateProphetCaseId | null; reflected: boolean; operation: FateProphetOperationState; cases: Record<FateProphetCaseId, FateProphetCaseState>; journal: FateProphetLifeEvent[] }
export interface FateProphetLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateProphetActivityCommand }
/** Deliberately allowlisted. No raw source, attempt, mechanical state or RNG is public. */
export interface FateProphetAttemptProjection { method: 'ABILITY' | 'ORDINARY'; consent: FateProphetConsent; closed: boolean; stopped: boolean; conditionChanged: boolean; foresightTier: PublicResolutionTier | null; adjustmentTier: PublicResolutionTier | null; clue: string | null; forecastValid: boolean; correctionRemainingSeconds: number; eventResult: string | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; luckSpent: number; evidence: string[] }
export interface FateProphetLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: FateProphetCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: FateProphetLocation; playerTravelMetres: number; luck: WinnerLuck & { capacity: 3 }; currentAttempt: FateProphetAttemptProjection | null; site: { title: string; volunteer: string; guide: string; cart: string; parcel: string; disc: string; record: string; pouch: string }; cases: { id: FateProphetCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: FateProphetAttemptProjection[] }[]; actions: FateProphetLifeAction[] }
const FORESIGHT = 'wheel.s2.event-foresight' as const, ADJUSTMENT = 'wheel.s2.hazard-adjustment' as const;
/** These are finite practice bounds, not universal canon numbers. */
const EFFECT_SECONDS = 30;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 2;
const validLuck = (v: WinnerLuck): boolean => record(v) && shape(v, ['stored', 'lastAccumulateWeek', 'accumulated', 'spent']) && integer(v.stored, 0, 3) && integer(v.accumulated) && integer(v.spent, 0, v.accumulated) && v.accumulated - v.spent === v.stored && (v.lastAccumulateWeek === null || integer(v.lastAccumulateWeek, 1));
const freshCase = (): FateProphetCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createFateProphetLifeState(): FateProphetLifeState { return { source: null, activeCase: null, reflected: false, operation: { door: 'OPEN', mechanical: null, forecast: null, correction: null }, cases: { 'cart-omen': freshCase(), 'changed-condition': freshCase(), 'finite-disc': freshCase() }, journal: [] }; }
export const freshFateProphetLife = createFateProphetLifeState;
const current = (l: FateProphetLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: FateProphetLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const object = (p: FateProphetPhysicalState, id: FateProphetCaseId) => id === 'finite-disc' ? p.disc : p.cart;
const mechanism = (l: FateProphetLifeState) => l.operation.mechanical!;
function cleanupBlock(l: FateProphetLifeState, p: FateProphetPhysicalState): string | null {
  if (l.operation.correction !== null) return '先停止或实际等候尚未使用的修正；成本不退。';
  if (p.cart.location !== 'A' || p.cart.control !== 'GUIDE' || p.disc.control !== 'GUIDE') return '须走到原物旁，把同一原车和包推回，再交还原物控制权。';
  if (p.playerLocation !== 'START') return '须本人沿四米原路走回工坊门口。';
  return p.volunteer.location !== 'A' || p.guide.location !== 'START' || p.tags.some(t => t.location !== 'POUCH') ? '原人在原位，原签仍须在薇拉自己的袋中。' : null;
}
export const hasFateProphetLifeLock = (s: SliceState): boolean => open(s.fateProphet.life);
export const hasFateProphetUnsettledLife = hasFateProphetLifeLock;
export const fateProphetLifeLocksTime = hasFateProphetLifeLock;
export const fateProphetInside = hasFateProphetLifeLock;
export const fateProphetLifeClosed = (s: SliceState): boolean => !open(s.fateProphet.life) && s.fateProphet.life.source !== null && Object.values(s.fateProphet.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.fateProphet.life, s.chaosWalker.life);
export function validateFateProphetActivityCommand(v: unknown): v is FateProphetActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT' || v.type === 'ACCUMULATE') return shape(v, ['type']);
  if (!FATE_PROPHET_CASE_IDS.includes(v.caseId as FateProphetCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B', 'C'].includes(String(v.to));
  if (v.type === 'SPIN_DISC' && v.caseId !== 'finite-disc' || ['RELEASE_CART', 'RETURN_CART'].includes(String(v.type)) && v.caseId === 'finite-disc') return false;
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isFateProphetActivityCommand = validateFateProphetActivityCommand;
export const isFateProphetActivity = validateFateProphetActivityCommand;
function localBlock(l: FateProphetLifeState, p: FateProphetPhysicalState, luck: WinnerLuck, c: FateProphetActivityCommand, week: number): string | null {
  if (c.type === 'ACCUMULATE') return !open(l) && !cleanupBlock(l, p) && luck.stored < 3 && luck.lastAccumulateWeek !== week ? null : '只可在现场收束后积运；每真实周一次，原储备最多三份。';
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并收好原工坊。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = FATE_PROPHET_CASE_IDS.indexOf(c.caseId), op = l.operation;
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[FATE_PROPHET_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对同一原工坊的人、物与普通退路。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '须先观察，每案只准备一次，结果不能重置。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && !!a && a.eventDraws === 1 && a.resultRead ? null : '须有一次真实事件及实际观察，并归物退出；提前取消不能领取报告成果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一原工坊现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '已经核实，只须结束接触并报告。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止，已付成本不退。';
  if (c.type === 'WAIT_EFFECT') return op.correction !== null && !a.eventDraws ? null : '只有本次尚未使用的修正可以实际等候到期。';
  if (c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'A' && a.consent === 'UNASKED' ? null : '本案只能在首次询问时听取拒绝。';
  if (c.type === 'WITHDRAW_PERMISSION') return p.playerLocation === 'A' && a.consent === 'GRANTED' && !a.eventDraws && (c.caseId !== 'changed-condition' || a.foresightTier !== null) ? null : '须有本案当前许可；条件改变案在首次预感尝试后才记录撤回。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!(a.eventDraws && a.resultRead || a.stopped) ? '先观察真实结果或明确取消。' : null);
  if (c.type === 'RETURN_OBJECT') return p.playerLocation === 'A' && !op.correction && !a.objectsReturned && (a.stopped || a.eventDraws && a.resultRead && (c.caseId !== 'finite-disc' || a.recordRead)) && (c.caseId === 'finite-disc' || p.cart.location === 'A') ? null : '须核实真实结果或停止方案，原车和包回到四米处后，才交还同一原物控制权。';
  if (c.type === 'RETURN_CART') return c.caseId !== 'finite-disc' && a.eventDraws === 1 && a.resultRead && p.playerLocation === p.cart.location && p.cart.location !== 'A' ? null : '须本人走到真实终点亲见原车，再推同一车与密封包四米回去。';
  if (c.type === 'WALK') {
    if (p.playerLocation === 'A' && c.to === 'START') return a.objectsReturned && !op.correction ? null : '须原物归主且修正已收束，再沿四米路离开。';
    if (p.playerLocation === 'A' && (c.to === 'B' || c.to === 'C')) return c.caseId === 'finite-disc' ? c.to === 'B' && a.eventDraws === 1 && !a.recordRead && !a.stopped ? null : '转盘只需走到八米处读原记录。' : a.eventDraws === 1 && c.to === p.cart.location && !a.resultRead ? null : '须沿真实岔路走到同一原车的终点。';
    if (p.playerLocation === 'B' && c.to === 'A' && c.caseId === 'finite-disc') return a.recordRead || a.stopped ? null : '先亲读原记录或明确取消，再沿四米路返回。';
    return '只能沿工坊门口、四米原物处与相邻终点普通步行；不会瞬移归物。';
  }
  if (c.type === 'READ_RECORD') return c.caseId === 'finite-disc' && p.playerLocation === 'B' && !a.recordRead ? null : '须本人走到八米处，亲读同一原记录，比较此次有限结果。';
  if (a.stopped) return '方案已停止，只可归物、核实与普通退出；不能恢复能力或重抽。';
  if (c.type === 'MANUAL_INSPECTION') return p.playerLocation === 'A' && !a.manualInspected && !a.eventDraws ? null : '须在原物旁、事件尚未发生时普通拆看准备好的机械条件。';
  if (c.type === 'CONSENT_VERA') return p.playerLocation === 'A' && a.method === 'ABILITY' && a.consent === 'UNASKED' && p.volunteer.willing ? null : '只能当面询问薇拉此次可撤回许可；拒绝或撤回后不反复索取。';
  if (c.type === 'EVENT_FORESIGHT' || c.type === 'HAZARD_ADJUSTMENT') {
    if (a.method !== 'ABILITY' || p.playerLocation !== 'A' || a.consent !== 'GRANTED' || !p.volunteer.willing || a.eventDraws || a.conditionChanged) return '须有本次当前明确许可和未发生的同一原物事件；改变条件或撤回后不能再施术。';
    if (c.type === 'EVENT_FORESIGHT') return a.foresightTier === null && !a.manualInspected ? null : '每案预感只尝试一次；普通看清条件后不再把已知事实冒充预感。';
    return a.adjustmentTier === null && a.foresightTier !== null && c.caseId !== 'changed-condition' && luck.stored > 0 ? null : '修正只尝试一次，须先尝试有限预感并有一份原幸运；条件改变案不能继续修正。';
  }
  if (c.type === 'RELEASE_CART' || c.type === 'SPIN_DISC') return p.playerLocation === 'A' && !a.eventDraws && (a.foresightTier !== null || a.manualInspected) && (c.caseId !== 'changed-condition' || a.foresightTier === null || a.permissionWithdrawn && a.conditionChanged) ? null : '先有限预感或普通检查；条件改变案须先听取撤回并记录真实变动，然后只发生一次普通事件。';
  return '当前步骤不适用于本案。';
}
function commandCost(c: FateProphetActivityCommand): FateProphetLifeCost {
  const casting = c.type === 'EVENT_FORESIGHT' || c.type === 'HAZARD_ADJUSTMENT';
  return { actions: casting || ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT', 'ACCUMULATE'].includes(c.type) ? 1 : 0, spirituality: casting ? 5 : 0, mind: casting ? 1 : 0, luck: c.type === 'HAZARD_ADJUSTMENT' ? 1 : 0, pennies: 0, health: 0, cashGained: 0 };
}
function makeSceneSource(s: SliceState): FateProphetSceneSource { return { root: 'chaosWalker.life', promotionWeek: s.fateProphet.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(s.chaosWalker.life), luck: structuredClone(s.winner.luck) }; }
export function blockFateProphetLife(s: SliceState, c: FateProphetActivityCommand): string | null {
  if (!validateFateProphetActivityCommand(c)) return '先知生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已经成为先知。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际来到贝克兰德原工坊。';
  if (s.fateProphet.preparedWeek !== null || s.fateProphet.encounter.status !== 'AVAILABLE' || s.fateProphet.encounter.preparation !== null) return '先完成服药准备；后续遭遇开始后不能重开原案。';
  if (s.fateProphet.life.source === null && !validateFateProphetSceneSource(makeSceneSource(s), s)) return '原工坊的旧实践与收尾记录须完整，不能凭空接出另一间房。';
  const reason = localBlock(s.fateProphet.life, s.chaosWalker.life, s.winner.luck, c, s.week); if (reason) return reason;
  const cost = commandCost(c), reserve = c.type === 'PREPARE' && c.method === 'ABILITY' ? 2 : 0;
  if (s.actionsRemaining < cost.actions + reserve) return '本周须预留准备及两次有限施术的行动；普通收尾不耗行动。';
  if (s.spirituality < cost.spirituality || s.mind < cost.mind || s.winner.luck.stored < cost.luck) return '当前资源不足以支付真实成本；失败同样支付，停止与归物总能免费进行。';
  return null;
}
export const fateProphetActivityReason = blockFateProphetLife;
export function advanceFateProphetLifeClock(l: FateProphetLifeState, p: FateProphetPhysicalState, seconds: number, a: FateProphetAttempt | null = current(l)): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。');
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (l.operation.forecast && l.operation.forecast.expiresAt <= p.clockSeconds) { l.operation.forecast.valid = false; if (a) a.forecastInvalidated = true; }
  if (l.operation.correction && l.operation.correction.expiresAt <= p.clockSeconds) { l.operation.correction = null; if (a) a.correctionExpired = true; }
}
const elapse = advanceFateProphetLifeClock;
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY', id: FateProphetCaseId, roll: number): FateProphetAttempt {
  return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, preparedObjectId: id === 'finite-disc' ? 'CW3-DISC' : 'CW3-CART', preparationRoll: roll, originalBias: roll <= 50 ? 'B' : 'C', conditionChanged: false, manualInspected: false, revealedBias: null, foresightTier: null, adjustmentTier: null, forecastInvalidated: false, correctionCancelled: false, correctionExpired: false, correctionApplied: false, eventDraws: 0, eventRoll: null, eventChance: null, eventResult: null, resultRead: false, recordRead: false, objectsReturned: false, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, luckSpent: 0, appliedAbilityIds: [], playerMoves: [], objectMoves: [], evidence: [] };
}
function move(l: FateProphetLifeState, p: FateProphetPhysicalState, a: FateProphetAttempt, to: FateProphetLocation, push = false): void {
  const ids = push ? [p.cart.id, p.parcel.id] : [];
  a.playerMoves.push({ from: p.playerLocation, to, mode: push ? 'PUSH' : 'WALK', metres: 4, seconds: 4, itemIds: ids });
  if (push) { a.objectMoves.push({ from: p.cart.location, to, mode: 'PUSH', metres: 4, seconds: 4, itemIds: ids }); p.cart.location = to as 'A' | 'B' | 'C'; p.cart.returns++; }
  p.playerLocation = to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; elapse(l, p, 4, a);
}
function checkSource(l: FateProphetLifeState, p: FateProphetPhysicalState, luck: WinnerLuck, c: FateProphetActivityCommand, baseAbility: number, name: string, gender: string): FateProphetCheckSource | null {
  if (c.type !== 'EVENT_FORESIGHT' && c.type !== 'HAZARD_ADJUSTMENT') return null;
  return { caseId: c.caseId, abilityId: c.type === 'EVENT_FORESIGHT' ? FORESIGHT : ADJUSTMENT, cost: 5, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'wheel', sequence: 2, name, gender }, at: p.clockSeconds, actorLocation: 'A', subjectId: p.volunteer.id, currentConsent: 'GRANTED', objectId: object(p, c.caseId).id, mechanicalState: structuredClone(mechanism(l)), eventDraws: 0, forecast: structuredClone(l.operation.forecast), luck: structuredClone(luck) };
}
function cancel(l: FateProphetLifeState, a: FateProphetAttempt): void {
  if (l.operation.forecast) { l.operation.forecast.valid = false; a.forecastInvalidated = true; }
  if (l.operation.correction) { l.operation.correction = null; a.correctionCancelled = true; }
}
function evolve(l: FateProphetLifeState, p: FateProphetPhysicalState, c: FateProphetActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, roll: number | null, source: FateProphetSceneSource | null): void {
  if (source) l.source = structuredClone(source);
  if (c.type === 'ACCUMULATE') { elapse(l, p, 4); return; }
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 4); return; }
  const r = l.cases[c.caseId], op = l.operation;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 2); return; }
  if (c.type === 'PREPARE') {
    const a = freshAttempt(week, date, c.method, c.caseId, roll!); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; op.forecast = null; op.correction = null;
    move(l, p, a, 'A'); object(p, c.caseId).control = 'PLAYER'; op.mechanical = { objectId: a.preparedObjectId, caseId: c.caseId, preparedAt: p.clockSeconds, preparationRoll: roll!, bias: a.originalBias, version: 1 };
    a.evidence.push('本人普通走四米到原物旁，核实唯一原物后实际完成封闭机械准备；此时尚未预感，也没有放车或转盘。'); elapse(l, p, 2, a); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 2); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (!['WITHDRAWN', 'DECLINED'].includes(a.consent)) a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; op.forecast = null; elapse(l, p, 1, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'CONSENT_VERA': a.consent = 'GRANTED'; r.consentWeek = week; a.evidence.push('薇拉当面同意仅这一次有限预感和机械试验；她保留拒绝与随时撤回的权利。'); elapse(l, p, 1, a); break;
    case 'DECLINE_PERMISSION': a.consent = 'DECLINED'; cancel(l, a); a.evidence.push('听取薇拉拒绝本次能力试验；不再次索取许可，仍可普通检查原机械或停止离开。'); elapse(l, p, 1, a); break;
    case 'WITHDRAW_PERMISSION': {
      a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; cancel(l, a);
      if (c.caseId === 'changed-condition') { const m = mechanism(l); m.bias = m.bias === 'B' ? 'C' : 'B'; m.version = 2; a.conditionChanged = true; a.revealedBias = null; }
      a.evidence.push(c.caseId === 'changed-condition' ? '薇拉明确撤回；本人停止能力输入，并按普通约定翻转同一车的机械挡片。原条件已经改变，旧预感作废，之后只普通放车一次。' : '薇拉明确撤回当前许可；尚未使用的预感和修正取消，不再施术，已付成本不退。'); elapse(l, p, 2, a); break;
    }
    case 'EVENT_FORESIGHT': a.foresightTier = tier; a.spiritualitySpent += 5; a.mindSpent++; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) { const m = mechanism(l); op.forecast = { objectId: a.preparedObjectId, version: m.version, bias: m.bias, castAt: p.clockSeconds, expiresAt: p.clockSeconds + EFFECT_SECONDS, valid: true }; a.revealedBias = m.bias; a.evidence.push(`预感只察觉当前机械偏向${m.bias === 'B' ? '左侧软挡' : '右侧软挡'}；事件仍未发生，不能知道下一次放车或转盘的结果。`); } else a.evidence.push('预感未成，没有得到隐藏条件或未来结果；五灵性、一精神和一行动已经支付。'); break;
    case 'HAZARD_ADJUSTMENT': a.adjustmentTier = tier; a.spiritualitySpent += 5; a.mindSpent++; a.luckSpent++; elapse(l, p, 2, a); if (successful(tier)) { op.correction = { objectId: a.preparedObjectId, version: mechanism(l).version, castAt: p.clockSeconds, expiresAt: p.clockSeconds + EFFECT_SECONDS, percentagePoints: 15 }; a.evidence.push('有限修正等待这一次尚未发生的事件：左侧结果机会增加十五个百分点，最高八成，三十秒后失效；仍可能落到另一侧。'); } else a.evidence.push('修正未成；五灵性、一精神、一行动及一份原幸运均已支付，没有退款或保底结果。'); break;
    case 'MANUAL_INSPECTION': a.manualInspected = true; a.revealedBias = mechanism(l).bias; a.evidence.push(`普通拆看原机械，亲见当前偏向${a.revealedBias === 'B' ? '左侧软挡' : '右侧软挡'}；这只是现况，仍须另行放车或转盘才有结果。`); elapse(l, p, 2, a); break;
    case 'RELEASE_CART': case 'SPIN_DISC': {
      const m = mechanism(l), correction = op.correction, forecast = op.forecast;
      const adjusted = !!correction && correction.version === m.version && correction.objectId === a.preparedObjectId && correction.expiresAt > p.clockSeconds && a.consent === 'GRANTED';
      a.eventChance = Math.min(80, (m.bias === 'B' ? 65 : 35) + (adjusted ? 15 : 0)); a.eventRoll = roll; a.eventResult = roll! <= a.eventChance ? 'B' : 'C'; a.eventDraws = 1;
      if (forecast?.valid && forecast.version === m.version && forecast.objectId === a.preparedObjectId && forecast.expiresAt > p.clockSeconds && a.consent === 'GRANTED') a.appliedAbilityIds.push(FORESIGHT);
      if (adjusted) { a.correctionApplied = true; a.appliedAbilityIds.push(ADJUSTMENT); } op.correction = null; if (op.forecast) op.forecast.valid = false;
      if (c.type === 'RELEASE_CART') { p.cart.location = a.eventResult; p.cart.releases++; a.objectMoves.push({ from: 'A', to: a.eventResult, mode: 'ROLL', metres: 4, seconds: 4, itemIds: [p.cart.id, p.parcel.id] }); elapse(l, p, 4, a); }
      else { p.disc.pointer = a.eventResult === 'B' ? 'B' : 'A'; p.disc.spins++; a.resultRead = true; elapse(l, p, 2, a); }
      a.evidence.push('现在才实际放车或转动同一原盘，另外产生一次独立机械结果；结果已固定，不能回放、重抽或事后预感。'); break;
    }
    case 'WALK': move(l, p, a, c.to); if (c.caseId !== 'finite-disc' && c.to === p.cart.location && c.to !== 'A') { a.resultRead = true; a.evidence.push(`本人沿真实岔路走四米，亲见同一原车与密封包在${c.to === 'B' ? '左侧' : '右侧'}软挡，未复制或换包。`); } break;
    case 'RETURN_CART': move(l, p, a, 'A', true); a.evidence.push('本人手推同一原车和唯一四百克密封包四米回到原位；包始终留在原车上。'); break;
    case 'READ_RECORD': a.recordRead = true; a.evidence.push('本人在八米处亲读薇拉的原记录与艾妲的原说明，核对本次原指针：旧纸仍属原主人，本次结果不能证明未来必然相同。'); elapse(l, p, 2, a); break;
    case 'RETURN_OBJECT': object(p, c.caseId).control = 'GUIDE'; if (c.caseId === 'finite-disc') p.disc.returns++; a.objectsReturned = true; a.evidence.push('在同一原物旁交回控制权；原物和原记录的所有权、数量均不改变。'); elapse(l, p, 1, a); break;
    case 'STOP': a.stopped = true; cancel(l, a); a.evidence.push('明确停止后续方案，尚未使用的效果作废；已经发生的结果与已付成本保留，只继续普通收尾。'); elapse(l, p, 1, a); break;
    case 'WAIT_EFFECT': { const seconds = Math.max(0, op.correction!.expiresAt - p.clockSeconds); elapse(l, p, seconds, a); a.evidence.push(`实际等候${seconds}秒，尚未使用的修正到期；原车未释放、原盘未转动，不退款。`); break; }
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 1, a); break;
  }
}
export function applyFateProphetActivity(s: SliceState, c: FateProphetActivityCommand, ctx: SeerContext): void {
  const reason = blockFateProphetLife(s, c); if (reason) throw new Error(reason);
  const l = s.fateProphet.life, p = s.chaosWalker.life as FateProphetPhysicalState, source = checkSource(l, p, s.winner.luck, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene = l.source === null ? makeSceneSource(s) : null;
  const randomCursor = s.random.cursor; let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, physicalRoll: number | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  else if (['PREPARE', 'RELEASE_CART', 'SPIN_DISC'].includes(c.type)) { randomBefore = s.random.cursor; physicalRoll = ctx.roll(1, 100); randomAfter = s.random.cursor; }
  const paid = commandCost(c), luckBefore = structuredClone(s.winner.luck), luckAfter = structuredClone(luckBefore);
  if (c.type === 'ACCUMULATE') { luckAfter.stored++; luckAfter.accumulated++; luckAfter.lastAccumulateWeek = s.week; }
  if (paid.luck) { luckAfter.stored--; luckAfter.spent++; }
  const budget: FateProphetLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind, luckBefore, luckAfter };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.mind = budget.mindAfter; s.winner.luck = structuredClone(luckAfter);
  evolve(l, p, c, s.week, s.date, tier, physicalRoll, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, physicalRoll, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原工坊：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}。当次许可、真实走路、原物归还与已付成本均有记录；未发生的结果仍然未知。`);
}
export const applyFateProphetLife = applyFateProphetActivity;
export const handleFateProphetLife = applyFateProphetActivity;
const LOCATIONS = { START: '工坊门口', A: '四米处原物旁', B: '左侧八米软挡与原记录旁', C: '右侧八米软挡旁' } as const;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<FateProphetActivityCommand['type'], string> = { OBSERVE: '查看原工坊与普通退路', PREPARE: '走到原物旁，准备一次机械试验', CONSENT_VERA: '询问薇拉本次可撤回许可', DECLINE_PERMISSION: '听取薇拉拒绝本次试验', WITHDRAW_PERMISSION: '听取撤回，取消旧预感', EVENT_FORESIGHT: '尝试预感当前条件下的有限征兆', HAZARD_ADJUSTMENT: '用一份原幸运尝试有限修正', MANUAL_INSPECTION: '普通拆看当前机械条件', RELEASE_CART: '实际放开原车一次', SPIN_DISC: '实际转动原盘一次', WALK: '沿原路步行并查看', READ_RECORD: '亲读原记录，核对有限结论', RETURN_CART: '手推同一原车与密封包返回', RETURN_OBJECT: '交还同一原物控制权', STOP: '停止方案，保留成本并普通收尾', WAIT_EFFECT: '实际等候尚未使用的修正到期', INSPECT: '核实原物、真实结果与退出', LEAVE: '结束已经收束的接触', CLOSE: '结束已经收束的接触', WITHDRAW: '如实取消并结束接触', REPORT: '报告一次真实有限结果', REFLECT: '反思三次有限实践', ACCUMULATE: '用一次行动积存原幸运' };
export const FATE_PROPHET_LIFE_STORY = '39岁的薇拉与艾妲仍在原机械工坊，原车载着唯一四百克密封包，原盘、原袋、原签与原记录仍属原主人。准备先改变同一原机械的隐藏偏向，预感只提供当时条件下的有限线索；后来放车或转盘才产生另一次独立结果。薇拉可以拒绝或撤回，普通检查与退出始终存在。';
export const FATE_PROPHET_LIFE_ENVIRONMENT = '每案观察、准备、报告各一行动；能力准备须再留两行动。预感与修正各耗一行动、五灵性、一精神，知识难度二十，失败同付；修正另耗唯一原幸运一份。原机械左侧机会为六成五或三成五；一次修正只加十五个百分点、最高八成，三十秒到期，绝不保证。门口到原物四米，原物到左右终点各四米；普通走路、放车、归物、停止与退出不耗行动。积运每真实周一次，上限三份。';
const CASES: { id: FateProphetCaseId; title: string; story: string }[] = [
  { id: 'cart-omen', title: '原车尚未发生的岔路', story: '先准备同一原车的封闭机械条件，再有限预感或普通查看。真正放车时另出一次结果；本人走到真实软挡，把同一车和包手推回来。' },
  { id: 'changed-condition', title: '条件改变，旧预感作废', story: '第一次预感尝试后，薇拉明确撤回；本人停止能力并实际翻转原机械挡片。旧线索已经失效，不再施术，只作一次普通放车并如实收尾。' },
  { id: 'finite-disc', title: '原转盘仍可能给出反例', story: '同一原盘只转一次。有限预感和待用修正都不能保证结果；本人实际往返原记录，将这次指针与有限结论比对，最后交还控制权。' },
];
function preferred(s: SliceState, actions: FateProphetLifeAction[]): FateProphetLifeAction | undefined {
  const l = s.fateProphet.life, p = s.chaosWalker.life, a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: FateProphetActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = (to: FateProphetLocation) => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!a) { if (l.cases['finite-disc'].status === 'OBSERVED' && s.winner.luck.stored === 0) return pick('ACCUMULATE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ORDINARY'); return pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT'); }
  if (a.inspected) return pick('LEAVE');
  if (a.stopped) return pick('RETURN_CART') ?? (l.activeCase !== 'finite-disc' && p.cart.location !== 'A' && p.playerLocation === 'A' ? walk(p.cart.location) : undefined) ?? (p.playerLocation === 'B' ? walk('A') : undefined) ?? pick('RETURN_OBJECT') ?? walk('START') ?? pick('INSPECT');
  if (l.activeCase === 'changed-condition' && a.foresightTier !== null && !a.permissionWithdrawn) return pick('WITHDRAW_PERMISSION');
  if (a.eventDraws) return pick('RETURN_CART') ?? (!a.resultRead ? walk(p.cart.location) : undefined) ?? (l.activeCase === 'finite-disc' && !a.recordRead ? walk('B') ?? pick('READ_RECORD') : undefined) ?? (p.playerLocation === 'B' ? walk('A') : undefined) ?? pick('RETURN_OBJECT') ?? walk('START') ?? pick('INSPECT');
  if (a.method === 'ABILITY' && !['WITHDRAWN', 'DECLINED'].includes(a.consent)) return pick('CONSENT_VERA') ?? pick('EVENT_FORESIGHT') ?? (l.activeCase === 'finite-disc' ? pick('HAZARD_ADJUSTMENT') : undefined) ?? pick('RELEASE_CART') ?? pick('SPIN_DISC') ?? pick('MANUAL_INSPECTION') ?? pick('STOP');
  return pick('MANUAL_INSPECTION') ?? pick('RELEASE_CART') ?? pick('SPIN_DISC') ?? pick('STOP');
}
export function fateProphetLifeActions(s: SliceState): FateProphetLifeAction[] {
  if (!promoted(s) || s.fateProphet.encounter.status !== 'AVAILABLE' || s.fateProphet.encounter.preparation !== null) return [];
  const l = s.fateProphet.life, p = s.chaosWalker.life, out: FateProphetLifeAction[] = [], id = l.activeCase ?? FATE_PROPHET_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: FateProphetActivityCommand) => { const reason = blockFateProphetLife(s, command), cost = commandCost(command), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push('5灵性', '1精神', '知识20'); if (cost.luck) values.push('1份原幸运'); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `FP2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!open(l)) add({ type: 'ACCUMULATE' });
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const c: FateProphetActivityCommand = { type, caseId: id }; if (validateFateProphetActivityCommand(c) && localBlock(l, p, s.winner.luck, c, s.week) === null) add(c); }
    for (const to of ['START', 'A', 'B', 'C'] as const) { const c: FateProphetActivityCommand = { type: 'WALK', caseId: id, to }; if (localBlock(l, p, s.winner.luck, c, s.week) === null) add(c); }
  }
  return out;
}
function publicAttempt(l: FateProphetLifeState, p: FateProphetPhysicalState, a: FateProphetAttempt): FateProphetAttemptProjection {
  const forecast = l.operation.forecast, active = current(l) === a;
  return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, conditionChanged: a.conditionChanged, foresightTier: a.foresightTier, adjustmentTier: a.adjustmentTier, clue: a.revealedBias === null ? null : `当时机械偏向${a.revealedBias === 'B' ? '左侧' : '右侧'}，不是未来结果。`, forecastValid: active && !!forecast?.valid && !a.forecastInvalidated, correctionRemainingSeconds: active && l.operation.correction ? Math.max(0, l.operation.correction.expiresAt - p.clockSeconds) : 0, eventResult: a.resultRead ? a.preparedObjectId === 'CW3-DISC' ? `原指针停在${a.eventResult === 'B' ? '乙' : '甲'}侧。` : `原车停在${a.eventResult === 'B' ? '左侧' : '右侧'}软挡。` : null, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, luckSpent: a.luckSpent, evidence: [...a.evidence] };
}
export function projectFateProphetLife(s: SliceState): FateProphetLifeProjection {
  const l = s.fateProphet.life, p = s.chaosWalker.life, actions = fateProphetLifeActions(s), next = preferred(s, actions), a = current(l);
  return { title: '原工坊的有限预感与修正', story: FATE_PROPHET_LIFE_STORY, environment: FATE_PROPHET_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，旧经历、原物和所有实际消耗继续保留。' : '先补足必要行动或完成当前普通收尾。'), preferredActionId: next?.id ?? null, facts: ['薇拉仍是同一位39岁成年人；旧人的生死与旧报告完整保留。', '预感只读当前已准备的有限条件；放车或转盘时才产生另一次结果。', `本人累计普通步行${p.playerTravelMetres}米，原工坊时钟${p.clockSeconds}秒。`, `原幸运现存${s.winner.luck.stored}份，上限三份；没有第二个储备。`], activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, luck: { ...s.winner.luck, capacity: 3 }, currentAttempt: a ? publicAttempt(l, p, a) : null, site: { title: '同一机械工坊', volunteer: p.volunteer.location === 'A' ? '薇拉在四米处，可拒绝或撤回本案许可。' : '薇拉已亲自沿原路走到室外，自己的原袋和原签仍由她持有。', guide: p.guide.location === 'START' ? '艾妲仍在工坊门口。' : '艾妲已亲自沿原路走到室外。', cart: p.cart.control === 'GUIDE' ? '原车已归原主人控制。' : '同一原车正在本次有限试验中。', parcel: '唯一四百克密封包始终在原车上。', disc: p.disc.control === 'GUIDE' ? '原盘由原主人控制。' : '同一原盘正在本次有限试验中。', record: '原记录与原说明仍在八米处，所有权不变。', pouch: '薇拉持有自己的同一不透明袋与两枚原签。' }, cases: CASES.map(d => { const r = l.cases[d.id]; return { ...d, observations: r.attempts.flatMap(x => x.evidence), status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力已真实应用；结果仍不保证。' : '普通核对或取消，未使用的修正不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => publicAttempt(l, p, x)) }; }), actions };
}

/** Old physical facts and the entire old lifecycle are authenticated before continuation. */
export function validateFateProphetSceneSource(v: unknown, s: SliceState): v is FateProphetSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot', 'luck']) || v.root !== 'chaosWalker.life' || v.promotionWeek !== s.fateProphet.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot) || !validLuck(v.luck as WinnerLuck)) return false;
    const p = v.snapshot as unknown as ChaosWalkerLifeState, initial = createChaosWalkerLifeState();
    if (!shape(p, Object.keys(initial)) || p.siteId !== initial.siteId || p.playerLocation !== 'START' || p.volunteer?.id !== 'CW3-VERA' || p.volunteer.name !== '薇拉·霍尔' || p.volunteer.age !== 39 || p.volunteer.alive !== true || p.volunteer.location !== 'A' || p.volunteer.health !== 100 || p.volunteer.mind !== 100 || p.volunteer.spirituality !== 100 || !same(p.volunteer.injuries, []) || !same(p.guide, initial.guide) || !shape(p.cart, Object.keys(initial.cart)) || !shape(p.disc, Object.keys(initial.disc)) || p.cart.id !== 'CW3-CART' || p.cart.owner !== 'GUIDE' || p.cart.quantity !== 1 || p.cart.location !== 'A' || p.cart.control !== 'GUIDE' || p.disc.id !== 'CW3-DISC' || p.disc.owner !== 'GUIDE' || p.disc.quantity !== 1 || p.disc.control !== 'GUIDE' || !same(p.parcel, initial.parcel) || !same(p.record, initial.record) || !same(p.forecast, initial.forecast) || !same(p.tags, initial.tags) || p.activeCase !== null || !p.reflected || !record(p.cases) || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    const original: SliceState = { ...s, week: v.introducedWeek, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, winner: { ...s.winner, luck: structuredClone(v.luck as WinnerLuck) }, chaosWalker: { ...s.chaosWalker, life: structuredClone(p) } };
    return validateChaosWalkerLifeOriginal(original) && validateChaosWalkerLuckHistoryOriginal(original);
  } catch { return false; }
}
function validBudget(b: FateProphetLifeBudget, cost: FateProphetLifeCost, c: FateProphetActivityCommand, week: number): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter', 'luckBefore', 'luckAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  if (!validLuck(b.luckBefore) || !validLuck(b.luckAfter) || (b.luckBefore.lastAccumulateWeek ?? 0) > week || (b.luckAfter.lastAccumulateWeek ?? 0) > week) return false;
  const luck = structuredClone(b.luckBefore); if (c.type === 'ACCUMULATE') { if (luck.stored >= 3 || luck.lastAccumulateWeek === week) return false; luck.stored++; luck.accumulated++; luck.lastAccumulateWeek = week; } if (cost.luck) { luck.stored--; luck.spent++; }
  return same(b.luckAfter, luck) && b.actionsBefore >= cost.actions + (c.type === 'PREPARE' && c.method === 'ABILITY' ? 2 : 0) && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind;
}
function adjacentBudget(b: FateProphetLifeBudget, old: FateProphetLifeBudget): boolean { return b.actionsBefore === old.actionsAfter && b.spiritualityBefore === old.spiritualityAfter && b.cashBefore === old.cashAfter && b.healthBefore === old.healthAfter && b.mindBefore === old.mindAfter && same(b.luckBefore, old.luckAfter); }
function finalBudget(s: SliceState, b: FateProphetLifeBudget): boolean { return s.actionsRemaining === b.actionsAfter && s.spirituality === b.spiritualityAfter && s.cash === b.cashAfter && s.health === b.healthAfter && s.mind === b.mindAfter && same(s.winner.luck, b.luckAfter); }
/** Every physical mutation, preparation draw, cast and later event draw replays in order. */
export function replayFateProphetLifeRoot(s: SliceState): FateProphetPhysicalState | null {
  try {
    const l = s.fateProphet?.life, expected = createFateProphetLifeState(), promotion = s.fateProphet?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, FATE_PROPHET_CASE_IDS) || !Array.isArray(l.journal) || !l.journal.length || l.journal.length > 200 || !integer(promotion, 1, s.week) || !validateFateProphetSceneSource(l.source, s)) return null;
    const p: FateProphetPhysicalState = structuredClone(l.source.snapshot); let luck = structuredClone(l.source.luck), previous: FateProphetLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    const acquisition = s.fateProphet.acquisitionJournal.find(e => e.after.sequence === 2);
    if (!acquisition || !same(l.source.luck, acquisition.after.luck)) return null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'physicalRoll', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || raw.revision <= acquisition.revision || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || compareGameDates(raw.date, acquisition.date) < 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateFateProphetActivityCommand(raw.command)) return null;
      const e = raw as unknown as FateProphetLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(c), b = e.budget;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor)) return null;
      if (previous && (wasOpen || e.week === previous.week && previous.budget.actionsAfter > 0 && e.revision === previous.revision + 1) && e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      if (!previous && e.week === acquisition.week && acquisition.after.actions > 0 && e.revision === acquisition.revision + 1 && (e.randomCursor !== acquisition.randomAfter || b.actionsBefore !== acquisition.after.actions || b.healthBefore !== acquisition.after.health || b.mindBefore !== acquisition.after.mind || b.spiritualityBefore !== acquisition.after.spirituality || b.cashBefore !== acquisition.after.cash || !same(b.luckBefore, acquisition.after.luck))) return null;
      if (wasOpen && (e.week !== lastWeek || previous && (!same(e.date, previous.date) || e.revision !== previous.revision + 1)) || localBlock(expected, p, luck, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c, e.week) || !same(b.luckBefore, luck)) return null;
      if (previous && (wasOpen || e.week === previous.week && previous.budget.actionsAfter > 0 && e.revision === previous.revision + 1) && !adjacentBudget(b, previous.budget)) return null;
      const handoff = expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (!['OBSERVE', 'ACCUMULATE'].includes(c.type) || e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && base > s.character.coreStats.knowledge) return null;
      const priorCast = expected.journal.find(old => old.source !== null && 'caseId' in c && old.source.caseId === c.caseId);
      if (e.source !== null && priorCast?.source && priorCast.source.baseAbility !== base) return null;
      const source = checkSource(expected, p, luck, c, base, s.character.name, s.character.gender);
      if (!same(e.source, source)) return null;
      const physical = ['PREPARE', 'RELEASE_CART', 'SPIN_DISC'].includes(c.type);
      if (source || physical) {
        if (e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), roll = random.nextInt(1, 100);
        if (source) { const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll }); if (!same(check, e.check) || e.tier !== check.tier || e.physicalRoll !== null) return null; }
        else if (e.physicalRoll !== roll || e.tier !== null || e.check !== null) return null;
        nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null || e.physicalRoll !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, e.physicalRoll, handoff); luck = structuredClone(b.luckAfter); expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return null;
    const encounterPreparation = s.fateProphet.encounter.preparation;
    if (encounterPreparation ? !same(encounterPreparation.before.luck, luck) : !same(s.winner.luck, luck)) return null;
    if (open(l)) { if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.fateProphet.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date) || s.revision !== previous.revision + 1 || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !finalBudget(s, previous.budget)) return null; }
    if (previous && s.revision === previous.revision + 1 && s.week === previous.week && previous.budget.actionsAfter > 0 && (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !finalBudget(s, previous.budget))) return null;
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'); for (const id of [FORESIGHT, ADJUSTMENT]) if ((s.progression.mastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return p;
  } catch { return null; }
}
export const replayFateProphetLife = replayFateProphetLifeRoot;
export function validateFateProphetLifeState(s: SliceState): boolean {
  try {
    const l = s.fateProphet?.life; if (l?.source === null) return same(l, createFateProphetLifeState());
    const p = replayFateProphetLifeRoot(s); if (!p) return false;
    if (!s.fateProphet.encounter.preparation) return same(s.chaosWalker.life, p);
    if (open(l) || !l.reflected || cleanupBlock(l, p) || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false;
    const actual = replayFateProphetEncounterRoot(s, p); return !!actual && same(actual, s.chaosWalker.life);
  } catch { return false; }
}
export const validateFateProphetLife = validateFateProphetLifeState;
export function reconstructFateProphetOriginalRoot(s: SliceState): ChaosWalkerLifeState | null {
  if (!s.fateProphet || !validateFateProphetLifeState(s)) return null;
  return structuredClone(s.fateProphet.life.source?.snapshot ?? s.chaosWalker.life);
}
export function validateFateProphetSourceChaosWalkerLife(s: SliceState): boolean {
  try {
    if (s.fateProphet?.life.source === null) return validateChaosWalkerLifeOriginal(s);
    if (s.progression.pathwayId !== 'wheel' || s.progression.sequence !== 2 || s.fateProphet.chaosWalkerActingAtPromotion !== 100) return false;
    const original = reconstructFateProphetOriginalRoot(s); if (!original) return false;
    return validateChaosWalkerLifeOriginal({ ...s, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, winner: { ...s.winner, luck: structuredClone(s.fateProphet.life.source!.luck) }, chaosWalker: { ...s.chaosWalker, life: original } });
  } catch { return false; }
}
