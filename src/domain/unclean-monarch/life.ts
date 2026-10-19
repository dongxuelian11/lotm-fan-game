import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { createBloodDukeLifeState, type BloodDukeOperationState } from '../blood-duke/life.js';
import { createBlathererLifeState } from '../blatherer/life.js';
import type { UncleanMonarchOriginals, UncleanMonarchSite } from './types.js';
export type { UncleanMonarchOriginals, UncleanMonarchSite } from './types.js';
import { uncleanMonarchEncounterBudget, uncleanMonarchFinanceSnapshot, validateUncleanMonarchFinanceSnapshot, type UncleanMonarchEncounterBudget, type UncleanMonarchFinanceSnapshot } from './encounter.js';

export const UNCLEAN_MONARCH_CASE_IDS = ['measured-reading', 'observed-tension', 'withdrawn-input'] as const;
export type UncleanMonarchCaseId = typeof UNCLEAN_MONARCH_CASE_IDS[number];
export type UncleanMonarchLifeAbilityId = 'abyss.s1.impulse-binding' | 'abyss.s1.focused-interference';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'APPROACH', 'WALK_TO_A', 'WALK_TO_B', 'TAKE_CARD', 'READ_ORIGINAL', 'NOTICE_IMPULSE', 'REHEARSE_BELL', 'CONFIRM_EMOTION', 'IMPULSE_BINDING', 'FOCUSED_INTERFERENCE', 'CHECK_ORIGINAL', 'PERFORM_OPERATION', 'MANUAL_OPERATION', 'WAIT_10', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'REPORT', 'OCCLUDE', 'RESTORE_VIEW'] as const;
export type UncleanMonarchActivityCommand =
  | { type: typeof STEPS[number]; caseId: UncleanMonarchCaseId }
  | { type: 'PREPARE'; caseId: UncleanMonarchCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: UncleanMonarchCaseId; permission: Permission }
  | { type: 'REFLECT' };
export interface UncleanMonarchPiece {
  id: string; caseId: UncleanMonarchCaseId; kind: 'impulse-piece' | 'interference-piece'; ownerId: 'PLAYER'; quantity: 1;
  status: 'PLAYER' | 'RETURNED'; location: 'PLAYER' | 'OWNER'; charges: 0 | 1; wear: number; paidPennies: 20; boughtWeek: number; travelMetres: number;
}
export interface UncleanMonarchImpulse { actorId: 'PLAYER'; kind: 'RUSH_CARD_CHECK'; cardId: 'BL3-CARD'; observedAt: number; expiresAt: number }
export interface UncleanMonarchEmotion { subjectId: 'BL3-NORA'; triggerId: 'BL3-BELL'; kind: 'STRONG_TENSION'; triggeredAt: number; confirmedAt: number | null; expiresAt: number }
export interface UncleanMonarchPulse { sourceId: 'BL3-NORA'; kind: 'VISIBLE_TAPPING_INTERRUPTION'; pressure: 45; createdAt: number; resolved: boolean }
export interface UncleanMonarchLifeWindow {
  abilityId: UncleanMonarchLifeAbilityId; caseId: UncleanMonarchCaseId; pieceId: string; cardId: 'BL3-CARD'; sourceId: 'PLAYER' | 'BL3-NORA'; targetId: 'PLAYER' | 'BL3-NORA';
  location: 'B'; permissionVersion: number; conditionVersion: number; createdAt: number; expiresAt: number;
  impulse: UncleanMonarchImpulse | null; emotion: UncleanMonarchEmotion | null;
}
export interface UncleanMonarchAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; volunteerEffortSpent: 0 | 3; penniesSpent: 20; pieceId: string;
  cardTaken: boolean; cardReturned: boolean; readOriginal: boolean; noticedImpulse: boolean; rehearsed: boolean; confirmedEmotion: boolean;
  castTier: PublicResolutionTier | null; checkTier: PublicResolutionTier | null; checkBase: number | null; checkBonus: 0 | 35;
  baselinePressure: 0 | 45; feltPressure: 0 | 15 | 45; applicationDone: boolean; verified: boolean; manual: boolean; appliedAbilityIds: UncleanMonarchLifeAbilityId[]; waits: number;
  windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN' | 'OCCLUDED' | 'CONDITION_CHANGED';
  result: 'NONE' | Method; siteAtStart: UncleanMonarchSite; siteAtClose: UncleanMonarchSite | null;
}
export interface UncleanMonarchLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED' | 'CANCELLED'; observedWeek: number | null;
  permission: Record<Permission, Consent>; permissionWeek: Record<Permission, number | null>; permissionVersion: number; consentWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: UncleanMonarchAttempt[];
}
export interface UncleanMonarchLifeCost { actions: number; pennies: number; spirituality: number; mind: number; volunteerEffort: number; pieceCharges: number }
export interface UncleanMonarchLifeMovement { actorId: 'PLAYER'; from: UncleanMonarchSite['playerLocation']; to: UncleanMonarchSite['playerLocation']; metres: number; seconds: number; itemIds: string[] }
export interface UncleanMonarchLifeSource {
  caseId: UncleanMonarchCaseId; at: number; cardId: 'BL3-CARD'; bellId: 'BL3-BELL'; noteId: 'BL3-NOTE'; location: 'B'; volunteerLocation: 'A'; permissionVersion: number; conditionVersion: number;
  piece: UncleanMonarchPiece; impulse: UncleanMonarchImpulse | null; emotion: UncleanMonarchEmotion | null; pulse: UncleanMonarchPulse | null; window: UncleanMonarchLifeWindow | null;
}
export interface UncleanMonarchLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: UncleanMonarchActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: UncleanMonarchEncounterBudget; after: UncleanMonarchEncounterBudget; finance: UncleanMonarchFinanceSnapshot; paid: UncleanMonarchLifeCost;
  elapsedSeconds: number; moves: UncleanMonarchLifeMovement[]; siteBefore: UncleanMonarchSite; siteAfter: UncleanMonarchSite;
  operationBefore: BloodDukeOperationState; operationAfter: BloodDukeOperationState; source: UncleanMonarchLifeSource | null;
}
export interface UncleanMonarchLifeState {
  sourceWeek: number | null; activeCase: UncleanMonarchCaseId | null; reflected: boolean; site: UncleanMonarchSite; operation: BloodDukeOperationState;
  volunteerEffortSpent: number; conditionVersion: number; viewBlocked: boolean; impulse: UncleanMonarchImpulse | null; emotion: UncleanMonarchEmotion | null; pulse: UncleanMonarchPulse | null;
  pieces: UncleanMonarchPiece[]; pending: UncleanMonarchLifeWindow | null; cases: Record<UncleanMonarchCaseId, UncleanMonarchLifeCase>; journal: UncleanMonarchLifeReceipt[];
}
export interface UncleanMonarchLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UncleanMonarchActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface UncleanMonarchLifeProjection {
  title: string; story: string; source: string; environment: string; nextStep: string; activeCase: UncleanMonarchCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  site: UncleanMonarchSite; operation: BloodDukeOperationState; clockSeconds: number; playerLocation: UncleanMonarchSite['playerLocation']; playerTravelMetres: number;
  volunteerEffortSpent: number; conditionVersion: number; viewBlocked: boolean; impulse: UncleanMonarchImpulse | null; emotion: UncleanMonarchEmotion | null; pulse: UncleanMonarchPulse | null;
  pieces: UncleanMonarchPiece[]; pending: UncleanMonarchLifeWindow | null; pendingRemainingSeconds: number; currentAttempt: UncleanMonarchAttempt | null;
  cases: { id: UncleanMonarchCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: UncleanMonarchAttempt[] }[];
  ledger: UncleanMonarchLifeReceipt[]; actions: UncleanMonarchLifeAction[];
}
const BINDING: UncleanMonarchLifeAbilityId = 'abyss.s1.impulse-binding', INTERFERENCE: UncleanMonarchLifeAbilityId = 'abyss.s1.focused-interference';
const POSITION: Record<UncleanMonarchSite['playerLocation'], number> = { START: 0, A: 4, B: 8, YARD: -4, OUTSIDE: -4 };
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 1;
const distance = (from: UncleanMonarchSite['playerLocation'], to: UncleanMonarchSite['playerLocation']) => Math.abs(POSITION[to] - POSITION[from]);
const freshCase = (): UncleanMonarchLifeCase => ({ status: 'AVAILABLE', observedWeek: null, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED' }, permissionWeek: { OWNER: null, ABILITY: null }, permissionVersion: 0, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createUncleanMonarchLifeState(): UncleanMonarchLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: createBlathererLifeState(), operation: createBloodDukeLifeState().operation,
    volunteerEffortSpent: 0, conditionVersion: 0, viewBlocked: false, impulse: null, emotion: null, pulse: null, pieces: [], pending: null,
    cases: { 'measured-reading': freshCase(), 'observed-tension': freshCase(), 'withdrawn-input': freshCase() }, journal: [] };
}
const freshLife = (week: number, originals: UncleanMonarchOriginals): UncleanMonarchLifeState => ({ ...createUncleanMonarchLifeState(), sourceWeek: week, site: structuredClone(originals.site), operation: structuredClone(originals.operation) });
export function initializeUncleanMonarchLifeState(s: SliceState): void {
  const originals = s.uncleanMonarch.sourceScene?.originals;
  if (!active(s) || !originals || !same(originals.site, s.blatherer.life) || !same(originals.operation, s.bloodDuke.life.operation) || !closedSite(originals.site) ||
    !same(s.uncleanMonarch.life, createUncleanMonarchLifeState())) throw new Error('须只继承一次同一原室、诺拉、原卡与已结束的原操作。');
  s.uncleanMonarch.life = freshLife(s.week, originals);
}
/** The post-handoff canonical live room. Prepromotion projection reads the original separately. */
export const getUncleanMonarchCurrentSite = (s: SliceState): UncleanMonarchSite => s.uncleanMonarch.encounter.currentSite ?? s.uncleanMonarch.life.site;
const projectedSite = (s: SliceState): UncleanMonarchSite => s.uncleanMonarch.life.sourceWeek === null ? s.uncleanMonarch.sourceScene?.originals.site ?? s.blatherer.life : getUncleanMonarchCurrentSite(s);
const current = (l: UncleanMonarchLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const locked = (l: UncleanMonarchLifeState) => l.activeCase !== null || l.pending !== null || UNCLEAN_MONARCH_CASE_IDS.some(id => l.cases[id].status === 'OBSERVED');
const closedSite = (p: UncleanMonarchSite) => p.playerLocation === 'START' && p.volunteer.location === 'A' && p.card.location === 'NORA' && p.guide.location === 'OUTSIDE';
export const hasUncleanMonarchLifeLock = (s: SliceState) => !!s.uncleanMonarch?.life && locked(s.uncleanMonarch.life);
export const uncleanMonarchLifeClosed = (s: SliceState) => !hasUncleanMonarchLifeLock(s) && closedSite(s.uncleanMonarch.life.site) && !s.uncleanMonarch.life.viewBlocked && UNCLEAN_MONARCH_CASE_IDS.every(id => s.uncleanMonarch.life.cases[id].status === 'RESOLVED');
export function validateUncleanMonarchActivityCommand(v: unknown): v is UncleanMonarchActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!UNCLEAN_MONARCH_CASE_IDS.includes(v.caseId as UncleanMonarchCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isUncleanMonarchActivityCommand = validateUncleanMonarchActivityCommand;
const isPower = (c: UncleanMonarchActivityCommand) => c.type === 'IMPULSE_BINDING' || c.type === 'FOCUSED_INTERFERENCE';
const isChecked = (c: UncleanMonarchActivityCommand) => isPower(c) || c.type === 'CHECK_ORIGINAL';
const pieceFor = (l: UncleanMonarchLifeState, id: UncleanMonarchCaseId) => l.pieces.find(n => n.caseId === id);
function pendingUsable(l: UncleanMonarchLifeState, id: UncleanMonarchCaseId, abilityId: UncleanMonarchLifeAbilityId): boolean {
  const w = l.pending, r = l.cases[id], piece = pieceFor(l, id), p = l.site;
  if (!w || w.caseId !== id || w.abilityId !== abilityId || w.expiresAt <= p.clockSeconds || w.location !== p.playerLocation || l.viewBlocked ||
    w.pieceId !== piece?.id || piece.location !== 'PLAYER' || piece.charges !== 1 || w.cardId !== p.card.id || p.card.location !== 'PLAYER' ||
    w.permissionVersion !== r.permissionVersion || w.conditionVersion !== l.conditionVersion || r.permission.OWNER !== 'GRANTED' || r.permission.ABILITY !== 'GRANTED' || !p.volunteer.willing || p.volunteer.location !== 'A') return false;
  return abilityId === BINDING ? !!l.impulse && l.impulse.expiresAt > p.clockSeconds && same(l.impulse, w.impulse) :
    !!l.emotion && l.emotion.confirmedAt !== null && l.emotion.expiresAt > p.clockSeconds && same(l.emotion, w.emotion) && !!l.pulse && !l.pulse.resolved;
}
function localBlock(l: UncleanMonarchLifeState, c: UncleanMonarchActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !locked(l) && closedSite(p) && !l.reflected && UNCLEAN_MONARCH_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三案真实核验、归还与报告。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], index = UNCLEAN_MONARCH_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && closedSite(p) && r.status === 'AVAILABLE' && (index === 0 || ['RESOLVED', 'CANCELLED'].includes(l.cases[UNCLEAN_MONARCH_CASE_IDS[index - 1]!].status)) ? null : '先收尾前案，核对同一原室与普通退路。';
  if (c.type === 'CONSENT') return l.activeCase === null && closedSite(p) && r.status === 'OBSERVED' && (r.permission[c.permission] === 'UNASKED' || r.permission[c.permission] === 'GRANTED' && r.permissionWeek[c.permission] !== week) && p.volunteer.willing ? null : '须重新分别取得本案原物与能力许可；旧许可与撤回不重置。';
  if (c.type === 'WITHDRAW_CONSENT' && !a && r.status === 'OBSERVED') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '可以拒绝未给出的许可或撤回本案有效许可，不能恢复已撤回许可。';
  if (c.type === 'ABORT' && !a && r.status === 'OBSERVED' && l.activeCase === null && closedSite(p)) return null;
  if (c.type === 'PREPARE') return l.activeCase === null && closedSite(p) && r.status === 'OBSERVED' && !a && r.permissionWeek.OWNER === week && r.permission.OWNER === 'GRANTED' &&
    (c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED' && r.permissionWeek.ABILITY === week) ? null : '须本周原物许可，每案只买一件真实耗材；普通方法不要求能力许可。';
  if (c.type === 'REPORT') return !locked(l) && closedSite(p) && !l.viewBlocked && r.status === 'EXAMINED' && a?.closed && a.returned && a.verified ? null : '须有实际核验或普通操作并已归卡归件退出；提前取消不能报告成果。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周正在进行的同一现场，不能复用旧许可或刷新原物。';
  if (c.type === 'WITHDRAW_CONSENT') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '只能拒绝或撤回本案尚未关闭的这一项许可。';
  if (c.type === 'ABORT') return null;
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已停止；已付成本仍保留。';
  if (c.type === 'RESTORE_VIEW') return l.viewBlocked ? null : '视线未被遮挡。';
  if (c.type === 'RETURN_TO_A') return p.playerLocation === 'B' ? null : '须本人从B沿4米原路返回诺拉所在A。';
  if (c.type === 'RETURN_CARD') return p.playerLocation === 'A' && p.volunteer.location === 'A' && p.card.location === 'PLAYER' ? null : '须携同一原卡回A，当面归还原主诺拉。';
  if (c.type === 'RETURN_TO_ENTRY') return p.playerLocation === 'A' && p.card.location === 'NORA' ? null : '先归还原卡，再沿4米路回入口。';
  if (c.type === 'RETURN_PIECE') return p.playerLocation === 'START' && p.card.location === 'NORA' && pieceFor(l, id)?.location === 'PLAYER' && (a.verified || a.stopped) ? null : '须本人回到入口，原卡已归还，再交回同一件新耗材。';
  if (c.type === 'LEAVE') return closedSite(p) && !l.viewBlocked && pieceFor(l, id)?.location === 'OWNER' && (a.verified || a.stopped) ? null : '先完成或停止、归还原卡和耗材，沿普通路回入口。';
  if (c.type === 'WAIT_10') return l.pending && a.waits < 2 ? null : '只等待当前20秒窗口，不续时、不退费。';
  if (c.type === 'OCCLUDE') return p.playerLocation === 'B' && !!l.pending && !l.viewBlocked ? null : '须有实际窗口，再用自己的手遮住视线；未用窗口立即结束。';
  if (a.verified) return '本案实际核验已结束，只能普通收尾。';
  if (r.permission.OWNER !== 'GRANTED' || !p.volunteer.willing) return '原物许可已停止，只能普通返回归还。';
  if (c.type === 'APPROACH') return p.playerLocation === 'OUTSIDE' ? null : '本人已在原室入口，无须重复进入。';
  if (c.type === 'WALK_TO_A') return p.playerLocation === 'START' && !a.cardTaken ? null : '须从入口沿4米路到同一诺拉面前。';
  if (c.type === 'TAKE_CARD') return p.playerLocation === 'A' && p.volunteer.location === 'A' && p.card.location === 'NORA' && !a.cardTaken ? null : '只可在A借取诺拉持有的同一张原卡一次。';
  if (c.type === 'WALK_TO_B') return p.playerLocation === 'A' && p.card.location === 'PLAYER' && !a.readOriginal ? null : '须本人持原卡沿4米路到原铃与记录旁。';
  if (p.playerLocation !== 'B' || p.card.location !== 'PLAYER' || pieceFor(l, id)?.location !== 'PLAYER' || l.viewBlocked) return '须本人持原卡和本案耗材，实际在B并有无遮挡视线。';
  if (c.type === 'READ_ORIGINAL') return !a.readOriginal && (a.volunteerEffortSpent > 0 || l.volunteerEffortSpent + 3 <= 12) ? null : '同一原卡和原记录只实际读一次；本阶段真实协作耗力不能超过12。';
  if (c.type === 'NOTICE_IMPULSE') return id !== 'observed-tension' && a.readOriginal && !a.noticedImpulse && !a.applicationDone && !a.stopped ? null : '先亲读原卡，才能注意到本人急于略过核对的实际冲动；不能凭空制造或重置。';
  if (c.type === 'REHEARSE_BELL') return id === 'observed-tension' && a.readOriginal && !a.rehearsed && !a.stopped && r.permission.ABILITY === 'GRANTED' && p.volunteer.location === 'A' && (a.volunteerEffortSpent > 0 || l.volunteerEffortSpent + 3 <= 12) ? null : '先读原物，并取得诺拉本案自愿能力许可，才可实际轻试同一原铃一次。';
  if (c.type === 'CONFIRM_EMOTION') return !!l.emotion && l.emotion.confirmedAt === null && l.emotion.expiresAt > p.clockSeconds && a.rehearsed && !a.stopped && r.permission.ABILITY === 'GRANTED' ? null : '只能核实原铃实际引出的当前强烈紧张，不猜想或改写他人思想。';
  if (c.type === 'CHECK_ORIGINAL') return id !== 'observed-tension' && a.readOriginal && !a.applicationDone && (id !== 'withdrawn-input' || a.method === 'ORDINARY' || a.withdrawn) ? null : '只作下一次真实知识20核对；撤回案须先撤回能力许可。';
  if (c.type === 'PERFORM_OPERATION') return id === 'observed-tension' && a.confirmedEmotion && !!l.pulse && !l.pulse.resolved && !a.applicationDone && r.permission.ABILITY === 'GRANTED' ? null : '须当前自愿且确实观察到的一次敲指打断事件；操作会结束该事件，不能刷取。';
  if (c.type === 'MANUAL_OPERATION') return a.readOriginal && (!a.applicationDone || !a.verified) && (id !== 'withdrawn-input' || a.method === 'ORDINARY' || a.withdrawn) ? null : '须先读原卡和原记录；普通逐项核对可在能力失败、停止或撤回后完成。';
  if (isPower(c)) {
    if (a.method !== 'ABILITY' || a.stopped || r.permission.ABILITY !== 'GRANTED' || l.pending || a.castTier !== null || pieceFor(l, id)?.charges !== 1) return '须本案能力许可、未用耗材及唯一施术机会；不能重施或续时。';
    if (c.type === 'IMPULSE_BINDING') return id !== 'observed-tension' && !!l.impulse && l.impulse.expiresAt > p.clockSeconds && a.noticedImpulse && !a.applicationDone ? null : '须实际注意到本人核对原卡时的冲动；只能服务下一次核对。';
    return id === 'observed-tension' && a.confirmedEmotion && !!l.emotion && l.emotion.confirmedAt !== null && l.emotion.expiresAt > p.clockSeconds && !!l.pulse && !l.pulse.resolved && !a.applicationDone ? null : '须诺拉当前明确同意，且已经实际观察并确认同一强烈紧张和待发生的可见打断。';
  }
  return '当前阶段不能进行这一步。';
}
function cost(c: UncleanMonarchActivityCommand): UncleanMonarchLifeCost {
  return { actions: ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, pennies: c.type === 'PREPARE' ? 20 : 0,
    spirituality: isPower(c) ? 8 : 0, mind: isPower(c) ? 2 : 0, volunteerEffort: 0, pieceCharges: 0 };
}
function validBudget(b: UncleanMonarchEncounterBudget): boolean {
  return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) &&
    integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 &&
    integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) &&
    Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk);
}
interface Audit { date: PublicGameDate; revision: number; finance: UncleanMonarchFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const checkBaseFor = (l: UncleanMonarchLifeState, c: UncleanMonarchActivityCommand, b: UncleanMonarchEncounterBudget) => isPower(c) ? b.coreStats.will : c.type === 'CHECK_ORIGINAL' ? Math.min(500, b.coreStats.knowledge + (pendingUsable(l, c.caseId, BINDING) ? 35 : 0)) : null;
const audit = (s: SliceState, c: UncleanMonarchActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, finance: uncleanMonarchFinanceSnapshot(s), randomCursor: s.random.cursor, randomBefore: isChecked(c) ? s.random.cursor : null, randomAfter: null, checkBase: checkBaseFor(s.uncleanMonarch.life, c, uncleanMonarchEncounterBudget(s)), check: null });
function transition(initial: UncleanMonarchLifeState, c: UncleanMonarchActivityCommand, week: number, before: UncleanMonarchEncounterBudget, clock: Audit) {
  if (!validateUncleanMonarchActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(c), after = structuredClone(before);
  if (isPower(c) && !success(clock.check?.tier ?? null)) paid.mind = 4;
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < paid.mind) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null; let a = r?.attempts[0] ?? null;
  const piece = id ? pieceFor(l, id) ?? null : null;
  const source: UncleanMonarchLifeSource | null = id && piece && p.playerLocation === 'B' && (isChecked(c) || ['READ_ORIGINAL', 'REHEARSE_BELL', 'CONFIRM_EMOTION', 'PERFORM_OPERATION', 'MANUAL_OPERATION', 'OCCLUDE'].includes(c.type)) ? {
    caseId: id, at: p.clockSeconds, cardId: p.card.id, bellId: p.bell.id, noteId: p.note.id, location: 'B', volunteerLocation: 'A', permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion,
    piece: structuredClone(piece), impulse: structuredClone(l.impulse), emotion: structuredClone(l.emotion), pulse: structuredClone(l.pulse), window: structuredClone(l.pending) } : null;
  const receipt: UncleanMonarchLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome: clock.check?.tier ?? null, before: structuredClone(before), after, paid,
    elapsedSeconds: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), operationBefore: structuredClone(l.operation), operationAfter: structuredClone(l.operation), source };
  const clear = (why: UncleanMonarchAttempt['windowEnd']) => { if (l.pending && a) a.windowEnd = why; l.pending = null; };
  const changeCondition = (why: UncleanMonarchAttempt['windowEnd']) => { clear(why); l.conditionVersion++; };
  const tick = (seconds: number) => {
    p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds;
    if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED');
    if (l.impulse && l.impulse.expiresAt <= p.clockSeconds) { l.impulse = null; changeCondition('EXPIRED'); }
    if (l.emotion && l.emotion.expiresAt <= p.clockSeconds) { l.emotion = null; changeCondition('EXPIRED'); }
  };
  const move = (to: 'START' | 'A' | 'B') => {
    changeCondition('MOVED'); const from = p.playerLocation, metres = distance(from, to), held = id ? pieceFor(l, id) : null, itemIds: string[] = [];
    p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
    if (p.card.location === 'PLAYER') { p.card.travelMetres += metres; itemIds.push(p.card.id); }
    if (held?.location === 'PLAYER') { held.travelMetres += metres; itemIds.push(held.id); }
    receipt.moves.push({ actorId: 'PLAYER', from, to, metres, seconds: metres, itemIds }); tick(metres);
  };
  const returnCard = () => { p.card.location = 'NORA'; a!.cardReturned = true; tick(1); };
  const returnPiece = () => { const held = pieceFor(l, id!)!; held.status = 'RETURNED'; held.location = 'OWNER'; a!.returned = true; r!.returned = true; tick(1); };
  const clearInput = (why: UncleanMonarchAttempt['windowEnd']) => { changeCondition(why); l.impulse = null; l.emotion = null; if (l.pulse) l.pulse.resolved = true; };
  const close = () => {
    clearInput('STOPPED'); l.viewBlocked = false; a!.closed = true; a!.result = a!.appliedAbilityIds.length ? 'ABILITY' : a!.verified ? 'ORDINARY' : 'NONE'; r!.result = a!.result;
    r!.contactOpen = false; r!.status = a!.verified ? 'EXAMINED' : 'CANCELLED'; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED';
    a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  const collaborate = () => { if (a!.volunteerEffortSpent === 0) { l.volunteerEffortSpent += 3; a!.volunteerEffortSpent = 3; paid.volunteerEffort = 3; } };
  const applyWindow = (abilityId: UncleanMonarchLifeAbilityId): boolean => {
    if (!pendingUsable(l, id!, abilityId)) return false;
    piece!.charges = 0; piece!.wear++; paid.pieceCharges = 1; a!.appliedAbilityIds.push(abilityId); clear('APPLIED'); return true;
  };
  switch (c.type) {
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionWeek[c.permission] = week; r!.permissionVersion++; r!.consentWeek = week; tick(1); break;
    case 'PREPARE': {
      const pieceId = `UM1-PIECE-${UNCLEAN_MONARCH_CASE_IDS.indexOf(c.caseId) + 1}`;
      a = { week, method: c.method, closed: false, stopped: false, returned: false, withdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0,
        spiritualitySpent: 0, mindSpent: 0, volunteerEffortSpent: 0, penniesSpent: 20, pieceId, cardTaken: false, cardReturned: false, readOriginal: false, noticedImpulse: false, rehearsed: false, confirmedEmotion: false,
        castTier: null, checkTier: null, checkBase: null, checkBonus: 0, baselinePressure: 0, feltPressure: 0, applicationDone: false, verified: false, manual: false, appliedAbilityIds: [], waits: 0,
        windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = c.caseId;
      l.pieces.push({ id: pieceId, caseId: c.caseId, kind: c.caseId === 'observed-tension' ? 'interference-piece' : 'impulse-piece', ownerId: 'PLAYER', quantity: 1, status: 'PLAYER', location: 'PLAYER', charges: 1, wear: 0, paidPennies: 20, boughtWeek: week, travelMetres: 0 }); tick(2); break;
    }
    case 'APPROACH': move('START'); break;
    case 'WALK_TO_A': case 'RETURN_TO_A': move('A'); break;
    case 'WALK_TO_B': move('B'); break;
    case 'RETURN_TO_ENTRY': move('START'); break;
    case 'TAKE_CARD': p.card.location = 'PLAYER'; a!.cardTaken = true; tick(1); break;
    case 'RETURN_CARD': returnCard(); break;
    case 'RETURN_PIECE': returnPiece(); break;
    case 'LEAVE': close(); break;
    case 'READ_ORIGINAL': a!.readOriginal = true; collaborate(); tick(3); break;
    case 'NOTICE_IMPULSE':
      changeCondition('CONDITION_CHANGED'); a!.noticedImpulse = true; l.impulse = { actorId: 'PLAYER', kind: 'RUSH_CARD_CHECK', cardId: p.card.id, observedAt: p.clockSeconds, expiresAt: p.clockSeconds + 40 }; tick(1); break;
    case 'REHEARSE_BELL':
      changeCondition('CONDITION_CHANGED'); collaborate(); a!.rehearsed = true; l.operation.bellRehearsals++;
      l.emotion = { subjectId: p.volunteer.id, triggerId: p.bell.id, kind: 'STRONG_TENSION', triggeredAt: p.clockSeconds, confirmedAt: null, expiresAt: p.clockSeconds + 40 };
      l.pulse = { sourceId: p.volunteer.id, kind: 'VISIBLE_TAPPING_INTERRUPTION', pressure: 45, createdAt: p.clockSeconds, resolved: false }; tick(2); break;
    case 'CONFIRM_EMOTION': changeCondition('CONDITION_CHANGED'); l.emotion!.confirmedAt = p.clockSeconds; a!.confirmedEmotion = true; tick(1); break;
    case 'IMPULSE_BINDING': case 'FOCUSED_INTERFERENCE': {
      const tier = clock.check?.tier ?? null; if (!tier || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(tier)) return null;
      a!.spiritualitySpent += 8; a!.mindSpent += paid.mind; a!.castTier = tier; tick(1); a!.windowEnd = success(tier) ? 'ACTIVE' : 'FAILED';
      l.pending = success(tier) ? { abilityId: c.type === 'IMPULSE_BINDING' ? BINDING : INTERFERENCE, caseId: id!, pieceId: piece!.id, cardId: p.card.id,
        sourceId: c.type === 'IMPULSE_BINDING' ? 'PLAYER' : 'BL3-NORA', targetId: c.type === 'IMPULSE_BINDING' ? 'PLAYER' : 'BL3-NORA', location: 'B',
        permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, impulse: structuredClone(l.impulse), emotion: structuredClone(l.emotion) } : null; break;
    }
    case 'CHECK_ORIGINAL': {
      if (!clock.check || clock.checkBase === null) return null;
      const applied = applyWindow(BINDING); a!.checkBonus = applied ? 35 : 0; a!.checkBase = clock.checkBase; a!.checkTier = clock.check.tier;
      a!.applicationDone = true; a!.verified = success(clock.check.tier); l.impulse = null; changeCondition('CONDITION_CHANGED'); tick(2); break;
    }
    case 'PERFORM_OPERATION': {
      const applied = applyWindow(INTERFERENCE); a!.baselinePressure = 45; a!.feltPressure = applied ? 15 : 45; a!.applicationDone = true; a!.verified = true;
      l.pulse!.resolved = true; l.emotion = null; changeCondition('CONDITION_CHANGED'); tick(2); break;
    }
    case 'MANUAL_OPERATION': a!.manual = true; a!.applicationDone = true; a!.verified = true; clearInput('STOPPED'); tick(4); break;
    case 'OCCLUDE': l.viewBlocked = true; changeCondition('OCCLUDED'); tick(1); break;
    case 'RESTORE_VIEW': l.viewBlocked = false; changeCondition('CONDITION_CHANGED'); tick(1); break;
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'WITHDRAW_CONSENT':
      r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++; if (a) { a.withdrawn = true; a.stopped = true; } clearInput('WITHDRAWN'); tick(1); break;
    case 'STOP_METHOD': a!.stopped = true; clearInput('STOPPED'); tick(1); break;
    case 'ABORT':
      if (!a) { r!.status = 'CANCELLED'; r!.returned = true; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED'; tick(1); break; }
      a.stopped = true; clearInput('STOPPED'); l.viewBlocked = false; tick(1);
      if (p.playerLocation === 'B') move('A'); if (p.card.location === 'PLAYER') returnCard(); if (p.playerLocation === 'A') move('START');
      if (pieceFor(l, id!)!.location === 'PLAYER') returnPiece(); close(); break;
    case 'REPORT': {
      const marker = `unclean-monarch-case:${id}`; if (after.completedSources.includes(marker)) return null;
      r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const abilityId of a!.appliedAbilityIds) after.mastery[abilityId] = Math.min(500, (after.mastery[abilityId] ?? 0) + 8); tick(4); break;
    }
    case 'REFLECT': if (after.completedSources.includes('unclean-monarch-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('unclean-monarch-reflection'); tick(4); break;
  }
  receipt.siteAfter = structuredClone(p); receipt.operationAfter = structuredClone(l.operation); if (!validBudget(after) || l.volunteerEffortSpent > 12) return null;
  return { life: l, receipt };
}
/** Exact historical object shapes are retained. Life/encounter replays establish every movement. No original energy field is introduced. */
export function validateUncleanMonarchCurrentSite(v: unknown, originals: UncleanMonarchOriginals): v is UncleanMonarchSite {
  try {
    if (!record(v) || !shape(v, Object.keys(originals.site))) return false;
    const p = v as unknown as UncleanMonarchSite, old = originals.site;
    return Object.hasOwn(POSITION, p.playerLocation) && integer(p.playerTravelMetres, old.playerTravelMetres) && integer(p.clockSeconds, old.clockSeconds) &&
      same(p, { ...old, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, clockSeconds: p.clockSeconds, volunteer: p.volunteer, card: p.card }) &&
      ['A', 'START', 'OUTSIDE'].includes(p.volunteer.location) && same(p.volunteer, { ...old.volunteer, location: p.volunteer.location }) &&
      ['NORA', 'PLAYER'].includes(p.card.location) && integer(p.card.travelMetres, old.card.travelMetres) && same(p.card, { ...old.card, location: p.card.location, travelMetres: p.card.travelMetres });
  } catch { return false; }
}
function lifeBoundary(e: UncleanMonarchLifeReceipt, isLocked: boolean) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || isLocked) return { budget, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: uncleanMonarchFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function uncleanMonarchCompletedLifeBudgetMatches(s: SliceState, e: UncleanMonarchLifeReceipt, isLocked = hasUncleanMonarchLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(uncleanMonarchEncounterBudget(s), expected.budget) || !same(uncleanMonarchFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null ||
    (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): UncleanMonarchLifeState | null {
  const life = s.uncleanMonarch.life, source = s.uncleanMonarch.sourceScene;
  if (!source || life.sourceWeek === null) return null;
  let model = freshLife(life.sourceWeek, source.originals), previous: UncleanMonarchLifeReceipt | null = null, lastWeek = life.sourceWeek, cursor = source.random.cursor;
  for (const e of life.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'moves', 'siteBefore', 'siteAfter', 'operationBefore', 'operationAfter', 'source']) ||
      !validateUncleanMonarchActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) ||
      !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) || !integer(e.randomCursor, cursor, s.random.cursor) || !validateUncleanMonarchFinanceSnapshot(e.finance, e.week) || !validBudget(e.before)) return null;
    if (locked(model) && (!previous || e.week !== lastWeek || e.revision !== previous.revision + 1 || !same(e.before, previous.after) || !same(e.finance, previous.finance) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (previous && e.revision === previous.revision + 1) {
      const expected = lifeBoundary(previous, locked(model));
      if (e.week !== expected.week || !same(e.date, expected.date) || !same(e.before, expected.budget) || !same(e.finance, expected.finance) || expected.eventId !== null || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
    }
    if (isChecked(e.command)) {
      if (e.checkBase !== checkBaseFor(model, e.command, e.before) || !same(e.before.coreStats, s.character.coreStats) || e.checkBase === null || !record(e.check) || e.randomBefore !== e.randomCursor || e.randomAfter !== e.randomCursor + 1 || !integer(e.randomAfter, cursor, s.random.cursor)) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomCursor), expected = resolveNormalCheck({ ability: isPower(e.command) ? 'will' : 'knowledge', baseAbility: e.checkBase, difficulty: isPower(e.command) ? 18 : 20, modifiers: [], roll: random.nextInt(1, 100) });
      if (!same(e.check, expected) || e.outcome !== expected.tier || random.cursor !== e.randomAfter) return null;
    } else if (e.randomBefore !== null || e.randomAfter !== null || e.checkBase !== null || e.check !== null || e.outcome !== null) return null;
    const next = transition(model, e.command, e.week, e.before, { date: e.date, revision: e.revision, finance: e.finance, randomCursor: e.randomCursor, randomBefore: e.randomBefore, randomAfter: e.randomAfter, checkBase: e.checkBase, check: e.check });
    if (!next || !same(next.receipt, e) || !validateUncleanMonarchCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor;
  }
  return model;
}
export function uncleanMonarchLifeMasteryGains(s: SliceState): Record<UncleanMonarchLifeAbilityId, number> {
  const gains: Record<UncleanMonarchLifeAbilityId, number> = { [BINDING]: 0, [INTERFERENCE]: 0 } as Record<UncleanMonarchLifeAbilityId, number>;
  for (const id of UNCLEAN_MONARCH_CASE_IDS) { const r = s.uncleanMonarch.life.cases[id]; if (r.status === 'RESOLVED') for (const abilityId of r.attempts[0]!.appliedAbilityIds) gains[abilityId] += 8; }
  return gains;
}
export function validateUncleanMonarchLifeState(s: SliceState): boolean {
  try {
    const life = s.uncleanMonarch?.life, source = s.uncleanMonarch?.sourceScene;
    if (!record(life) || !shape(life, Object.keys(createUncleanMonarchLifeState())) || !record(life.cases) || !shape(life.cases, UNCLEAN_MONARCH_CASE_IDS) || !Array.isArray(life.journal) || life.journal.length > 250) return false;
    if (s.uncleanMonarch.promotionWeek === null) return same(life, createUncleanMonarchLifeState());
    if (!source || life.sourceWeek !== s.uncleanMonarch.promotionWeek || !same(source.originals.site, s.blatherer.life) || !same(source.originals.operation, s.bloodDuke.life.operation) ||
      !closedSite(source.originals.site) || !validateUncleanMonarchCurrentSite(life.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(life, replay)) return false;
    const gains = uncleanMonarchLifeMasteryGains(s); let acting = life.reflected ? 25 : 0;
    for (const id of UNCLEAN_MONARCH_CASE_IDS) {
      const resolved = life.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `unclean-monarch-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'unclean-monarch-reflection').length !== (life.reflected ? 1 : 0) || active(s) && s.progression.acting < acting ||
      (s.progression.mastery[BINDING] ?? 0) < gains[BINDING] || (s.progression.mastery[INTERFERENCE] ?? 0) < gains[INTERFERENCE]) return false;
    const last = life.journal.at(-1), encounter = s.uncleanMonarch.encounter;
    if (locked(life) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.uncleanMonarch.preparedWeek !== null ||
      encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(uncleanMonarchEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !uncleanMonarchCompletedLifeBudgetMatches(s, last, locked(life))) return false;
    return true;
  } catch { return false; }
}
export const validateUncleanMonarchLife = validateUncleanMonarchLifeState;
export function blockUncleanMonarchLife(s: SliceState, c: UncleanMonarchActivityCommand): string | null {
  if (!validateUncleanMonarchActivityCommand(c)) return '有限冲动与情绪实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已实际晋升污秽君王。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.uncleanMonarch.preparedWeek !== null) return '先处理当前事件、战斗或晋升准备，并回到贝克兰德原室。';
  if (s.uncleanMonarch.encounter.status !== 'AVAILABLE' || s.uncleanMonarch.encounter.preparation !== null) return '现场已交给独立遭遇；原室实践保留为历史。';
  if (!validateUncleanMonarchLifeState(s)) return '同一原人原物、实付成本、真实条件或历史收据不一致。';
  const reason = localBlock(s.uncleanMonarch.life, c, s.week); if (reason) return reason;
  const paid = cost(c);
  if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < (isPower(c) ? 4 : paid.mind)) return '行动、费用、灵性或失败所需精神不足；可普通完成或无费用归还退出。';
  return null;
}
export const getUncleanMonarchActivityBlock = blockUncleanMonarchLife;
export function applyUncleanMonarchLifeCommand(s: SliceState, c: UncleanMonarchActivityCommand, ctx: SeerContext): void {
  const reason = blockUncleanMonarchLife(s, c); if (reason) throw new Error(reason);
  const clock = audit(s, c), before = uncleanMonarchEncounterBudget(s);
  if (isChecked(c)) {
    const ability = isPower(c) ? 'will' : 'knowledge', difficulty = isPower(c) ? 18 : 20;
    const actual = ctx.check(ability, difficulty);
    // The public check consumes exactly one original-seed roll. Only this actual
    // next card check may receive the bounded +35 base; no stat is overwritten.
    clock.check = resolveNormalCheck({ ability, baseAbility: clock.checkBase!, difficulty, modifiers: [], roll: actual.roll });
    s.lastCheck = structuredClone(clock.check); clock.randomAfter = s.random.cursor;
  }
  const next = transition(s.uncleanMonarch.life, c, s.week, before, clock); if (!next) throw new Error('同一原室的有限现场转移失败。');
  s.uncleanMonarch.life = next.life; s.uncleanMonarch.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality;
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  const a = current(next.life);
  ctx.note(`原室有限实践：${LABELS[c.type]}`, `${clock.check ? `${isPower(c) ? '意志18' : '知识20'}检定${TIER_LABELS[clock.check.tier]}。` : ''}${isPower(c) ? `实付8灵性、${next.receipt.paid.mind}精神。` : ''}本人在${LOCATION_LABELS[next.life.site.playerLocation]}，原室时钟${next.life.site.clockSeconds}秒。${c.type === 'CHECK_ORIGINAL' ? `这一次实际核对基础${clock.checkBase}，${a?.checkBonus ? '包含已应用冲动收束35；仍可失败。' : '未使用能力加成。'}` : c.type === 'PERFORM_OPERATION' ? `原敲指打断基线45，本次可见压力${a?.feltPressure}；当前事件已经结束。` : c.type === 'WITHDRAW_CONSENT' ? '本案指定许可已撤回，未用窗口立即失效，成本保留。' : '原卡仍属诺拉；原铃、原记录与普通门路持续保留。'}累计本阶段协作耗力${next.life.volunteerEffortSpent}/12。`);
}
export const applyUncleanMonarchActivity = applyUncleanMonarchLifeCommand;
export const applyUncleanMonarchLife = applyUncleanMonarchLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATION_LABELS: Record<UncleanMonarchSite['playerLocation'], string> = { START: '原入口', A: '四米处诺拉面前', B: '八米处原铃和记录旁', YARD: '独立邻院', OUTSIDE: '室外' };
const LABELS: Record<UncleanMonarchActivityCommand['type'], string> = {
  OBSERVE: '核对原室、原人和普通退路', PREPARE: '购买本案唯一耗材', CONSENT: '重新询问本案许可', WITHDRAW_CONSENT: '拒绝或撤回本案许可',
  APPROACH: '沿4米路回入口', WALK_TO_A: '沿4米路走到诺拉面前', TAKE_CARD: '借取同一张原卡', WALK_TO_B: '持原卡走4米到原铃', READ_ORIGINAL: '亲读原卡并核对同一原记录',
  NOTICE_IMPULSE: '注意本人急于略过核对的冲动', REHEARSE_BELL: '自愿进行一次真实原铃练习', CONFIRM_EMOTION: '核实诺拉当前可见的强烈紧张',
  IMPULSE_BINDING: '冲动收束：准备下一次真实核对', FOCUSED_INTERFERENCE: '定向扰动：准备一次可见打断', CHECK_ORIGINAL: '实际核对原卡一次', PERFORM_OPERATION: '实际处理当前一次可见打断', MANUAL_OPERATION: '用普通方法逐项完成核对',
  WAIT_10: '实际等待10秒', STOP_METHOD: '停止本次能力方法', RETURN_TO_A: '沿4米原路回诺拉面前', RETURN_CARD: '把同一原卡当面归还诺拉', RETURN_TO_ENTRY: '沿4米原路回入口',
  RETURN_PIECE: '亲手交还同一新耗材', LEAVE: '结束接触，确认普通退出', ABORT: '停止并沿普通路归还退出', REPORT: '报告已收尾的实际结果', REFLECT: '反思三案的许可与有限代价',
  OCCLUDE: '用自己的手遮住视线', RESTORE_VIEW: '移开自己的手，恢复普通视线',
};
const CASES: { id: UncleanMonarchCaseId; title: string; story: string }[] = [
  { id: 'measured-reading', title: '本人冲动与下一次原卡核对', story: '亲读同一原卡和记录，注意本人急于跳过核对的冲动。付费收束成功后，20秒内下一次知识20核对的基础至多增加35，仍可能失败；普通逐项核对始终可用。' },
  { id: 'observed-tension', title: '自愿原铃练习中的一次可见打断', story: '诺拉当前明确同意一次原铃练习，并确实出现强烈紧张。核实后才可尝试定向扰动，使下一次可见敲指打断的压力45降至15；不是改变想法、邀请答复或人格。' },
  { id: 'withdrawn-input', title: '撤回未用窗口，普通完成', story: '先明确取得本案许可，尝试收束后听取能力许可撤回。窗口立即结束、费用不退，仍在原物许可下普通核对与归还；未实际应用的能力没有掌握奖励。' },
];
const CLEANUP = ['STOP_METHOD', 'RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'RESTORE_VIEW', 'WITHDRAW_CONSENT'];
export function uncleanMonarchLifeActions(s: SliceState): UncleanMonarchLifeAction[] {
  if (!active(s) || s.uncleanMonarch.encounter.status !== 'AVAILABLE' || s.uncleanMonarch.encounter.preparation !== null) return [];
  const l = s.uncleanMonarch.life, id = l.activeCase ?? UNCLEAN_MONARCH_CASE_IDS.find(key => !['RESOLVED', 'CANCELLED'].includes(l.cases[key].status)), out: UncleanMonarchLifeAction[] = [];
  const add = (command: UncleanMonarchActivityCommand) => {
    const reason = blockUncleanMonarchLife(s, command), paid = cost(command);
    out.push({ id: `UM1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : ''}`,
      label: LABELS[command.type] + ('permission' in command ? command.permission === 'OWNER' ? '（原物）' : '（能力）' : command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : ''),
      cost: [`${paid.actions}行动`, ...(paid.pennies ? [`${paid.pennies}便士`] : []), ...(isPower(command) ? ['8灵性、2精神（失败总4精神）', '意志18', '20秒单次窗口'] : command.type === 'CHECK_ORIGINAL' ? ['知识20，真实单次检定'] : [])].join(' · '), enabled: reason === null, reason, command, cleanup: CLEANUP.includes(command.type) });
  };
  if (!id) { if (!l.reflected && UNCLEAN_MONARCH_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) add({ type: 'REFLECT' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const r = l.cases[id], a = r.attempts[0];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') {
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED' || r.permission[permission] === 'GRANTED' && r.permissionWeek[permission] !== s.week) add({ type: 'CONSENT', caseId: id, permission });
    add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (a && r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'ABORT'].includes(type) && localBlock(l, { type, caseId: id }, s.week) === null) add({ type, caseId: id });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  let preferred: UncleanMonarchLifeAction | undefined;
  const choose = (type: UncleanMonarchActivityCommand['type']) => out.find(v => v.enabled && v.command.type === type);
  if (a && !a.verified) {
    if (l.viewBlocked) preferred = choose('RESTORE_VIEW');
    if (r.permission.OWNER !== 'GRANTED') preferred ??= choose('ABORT');
    if (a.method === 'ABILITY' && id === 'withdrawn-input' && a.readOriginal && !a.withdrawn && (a.castTier !== null || !out.some(v => v.enabled && isPower(v.command)) && a.noticedImpulse)) preferred ??= out.find(v => v.enabled && v.command.type === 'WITHDRAW_CONSENT' && v.command.permission === 'ABILITY');
    if (a.method === 'ABILITY' && !a.stopped) {
      if (id !== 'observed-tension') preferred ??= choose('NOTICE_IMPULSE') ?? choose('IMPULSE_BINDING');
      else preferred ??= choose('REHEARSE_BELL') ?? choose('CONFIRM_EMOTION') ?? choose('FOCUSED_INTERFERENCE');
    }
    if (!preferred && a.readOriginal) preferred = id === 'observed-tension' && a.method === 'ABILITY' && !a.stopped ? choose('PERFORM_OPERATION') : choose('CHECK_ORIGINAL') ?? choose('MANUAL_OPERATION');
  }
  preferred ??= out.find(v => v.enabled && ![...CLEANUP, 'WAIT_10', 'OCCLUDE', 'MANUAL_OPERATION'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'OCCLUDE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled);
  if (preferred) preferred.preferredAction = true;
  return out;
}
export function projectUncleanMonarchLife(s: SliceState): UncleanMonarchLifeProjection {
  const l = s.uncleanMonarch.life, site = projectedSite(s), actions = uncleanMonarchLifeActions(s), preferred = actions.find(a => a.preferredAction) ?? actions.find(a => a.enabled);
  return { title: '原安静室的有限冲动与情绪实践', story: '继续使用46岁诺拉、罗安和同一张原卡、原铃、原记录。每案只买一件耗材；许可、行走、实际代价和普通退路逐步留存。',
    source: '当前原室来自呓语者原现场；鲜血大公旧快照只保留历史。诺拉原记录没有能量余额，本阶段仅累计新发生的协作耗力。',
    environment: '入口到诺拉4米，再到原铃4米，每米1秒；原卡须原路当面归还。施术8灵性2精神，失败总4精神，意志18。20秒窗口只应用一次，移动、停止、撤回、遮挡和到期立即取消；耗材仅实际应用时消耗。',
    nextStep: preferred?.label ?? (l.reflected ? '三案已收尾，可自行决定是否前往独立邻院。' : '当前没有待执行的原室操作。'), preferredActionId: preferred?.id ?? null,
    activeCase: l.activeCase, inside: hasUncleanMonarchLifeLock(s), insideCase: hasUncleanMonarchLifeLock(s), reflected: l.reflected,
    site: structuredClone(site), operation: structuredClone(l.sourceWeek === null ? s.uncleanMonarch.sourceScene?.originals.operation ?? s.bloodDuke.life.operation : l.operation), clockSeconds: site.clockSeconds, playerLocation: site.playerLocation, playerTravelMetres: site.playerTravelMetres,
    volunteerEffortSpent: l.volunteerEffortSpent, conditionVersion: l.conditionVersion, viewBlocked: l.viewBlocked, impulse: structuredClone(l.impulse), emotion: structuredClone(l.emotion), pulse: structuredClone(l.pulse),
    pieces: structuredClone(l.pieces), pending: structuredClone(l.pending), pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - site.clockSeconds) : 0,
    currentAttempt: structuredClone(current(l)), cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info,
      observations: a ? [`实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性/${a.mindSpent}精神；本案真实协作耗力${a.volunteerEffortSpent}，本人走${a.playerTravelMetres}米。`,
        ...(a.checkTier ? [`原卡实际核对${TIER_LABELS[a.checkTier]}，基础${a.checkBase}，本次收束加成${a.checkBonus}。`] : []), ...(a.baselinePressure ? [`原事件可见打断基线45，本次压力${a.feltPressure}，该事件已结束。`] : []), ...(a.withdrawn ? ['本案许可已真实撤回，未用窗口不恢复。'] : [])] : [],
      status: r.status, method: r.method, result: r.status === 'CANCELLED' ? '已普通退出，未完成的操作不领取报告成果。' : r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限作用已实际应用并记录。' : '已普通完成；没有未应用的能力奖励。',
      permission: structuredClone(r.permission), permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }),
    ledger: structuredClone(l.journal), actions };
}
