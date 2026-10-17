import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { createAncientEvilLifeState, type AncientEvilOperationState } from '../ancient-evil/life.js';
import { createSilentDiscipleLifeState } from '../silent-disciple/life.js';
import type { AbominationOriginals, AbominationSite } from './types.js';
export type { AbominationOriginals, AbominationSite } from './types.js';
import { abominationEncounterBudget, abominationFinanceSnapshot, validateAbominationFinanceSnapshot, type AbominationEncounterBudget, type AbominationFinanceSnapshot } from './encounter.js';

export const ABOMINATION_CASE_IDS = ['tray-pulse', 'spoken-hesitation', 'withdrawn-input'] as const;
export type AbominationCaseId = typeof ABOMINATION_CASE_IDS[number];
export type AbominationLifeAbilityId = 'chained.s1.spirit-barrier' | 'chained.s1.brief-cry';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'INVITE', 'WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'PLACE_PIECE', 'PREPARE_PULSE', 'SPIRIT_BARRIER', 'PERFORM_PULSE', 'PREPARE_CUE', 'BRIEF_CRY', 'PERFORM_CUE', 'WAIT_1', 'WAIT_10', 'STOP_METHOD', 'TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'REPORT', 'OCCLUDE', 'RESTORE_VIEW'] as const;
export type AbominationActivityCommand =
  | { type: typeof STEPS[number]; caseId: AbominationCaseId }
  | { type: 'PREPARE'; caseId: AbominationCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: AbominationCaseId; permission: Permission }
  | { type: 'REFLECT' };
export interface AbominationPiece {
  id: string; caseId: AbominationCaseId; kind: 'ward-piece' | 'voice-piece'; ownerId: 'PLAYER'; quantity: 1;
  status: 'PLAYER' | 'RETURNED'; location: 'HAND' | 'TRAY' | 'RETURNED'; charges: 0 | 1; wear: number; paidPennies: 20; boughtWeek: number; travelMetres: number;
  testSourceId: string; testCharges: 0 | 1; testUses: 0 | 1;
}
export interface AbominationPulse { id: string; pieceId: string; sourceId: string; targetId: 'PLAYER'; kind: 'MENTAL'; pressure: 45; createdAt: number; consumedAt: number | null; resolved: boolean }
export interface AbominationCue { id: string; pieceId: string; sourceId: string; actorId: 'SD3-ELSA'; bodyId: 'SD3-ELSA'; kind: 'VISIBLE_HAND_CUE'; location: 'A'; createdAt: number; delayImposedSeconds: 0 | 3; delayRemainingSeconds: number; executed: boolean; executedAt: number | null }
export interface AbominationLifeWindow {
  abilityId: 'chained.s1.spirit-barrier'; caseId: AbominationCaseId; pieceId: string; trayId: 'SD3-TRAY'; sourceId: string; targetId: 'PLAYER';
  location: 'A'; permissionVersion: number; conditionVersion: number; createdAt: number; expiresAt: number; pulseId: string;
}
export interface AbominationAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; volunteerTravelMetres: number; spiritualitySpent: number; mindSpent: number; volunteerEffortSpent: 0 | 3; penniesSpent: 20; pieceId: string;
  readTray: boolean; readOriginal: boolean; piecePlaced: boolean; pulsePrepared: boolean; cuePrepared: boolean;
  castTier: PublicResolutionTier | null; resistanceRoll: number | null; resisted: boolean; checkTier: PublicResolutionTier | null; checkBase: number | null;
  baselinePressure: 0 | 45; feltPressure: 0 | 15 | 45; applicationDone: boolean; verified: boolean; manual: boolean; appliedAbilityIds: AbominationLifeAbilityId[]; waits: number;
  windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'RESISTED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN' | 'OCCLUDED' | 'CONDITION_CHANGED';
  result: 'NONE' | Method; siteAtStart: AbominationSite; siteAtClose: AbominationSite | null;
}
export interface AbominationLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED' | 'CANCELLED'; observedWeek: number | null; invited: boolean;
  permission: Record<Permission, Consent>; permissionWeek: Record<Permission, number | null>; permissionVersion: number; consentWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: AbominationAttempt[];
}
export interface AbominationLifeCost { actions: number; pennies: number; spirituality: number; mind: number; volunteerEffort: number; pieceCharges: number; testCharges: number }
export interface AbominationLifeMovement { actorId: 'PLAYER' | 'SD3-ELSA'; from: AbominationSite['playerLocation']; to: AbominationSite['playerLocation']; metres: number; seconds: number; itemIds: string[] }
export interface AbominationLifeSource {
  caseId: AbominationCaseId; at: number; trayId: 'SD3-TRAY'; noteId: 'SD3-NOTE'; location: AbominationSite['playerLocation']; volunteerLocation: AbominationSite['volunteer']['location']; permissionVersion: number; conditionVersion: number;
  piece: AbominationPiece; pulse: AbominationPulse | null; cue: AbominationCue | null; window: AbominationLifeWindow | null;
}
export interface AbominationLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: AbominationActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; resistanceRoll: number | null; outcome: PublicResolutionTier | null;
  before: AbominationEncounterBudget; after: AbominationEncounterBudget; finance: AbominationFinanceSnapshot; paid: AbominationLifeCost;
  elapsedSeconds: number; moves: AbominationLifeMovement[]; siteBefore: AbominationSite; siteAfter: AbominationSite;
  operationBefore: AncientEvilOperationState; operationAfter: AncientEvilOperationState; source: AbominationLifeSource | null;
}
export interface AbominationLifeState {
  sourceWeek: number | null; activeCase: AbominationCaseId | null; reflected: boolean; site: AbominationSite; operation: AncientEvilOperationState;
  volunteerEffortSpent: number; conditionVersion: number; viewBlocked: boolean; pulse: AbominationPulse | null; cue: AbominationCue | null;
  pieces: AbominationPiece[]; pending: AbominationLifeWindow | null; cases: Record<AbominationCaseId, AbominationLifeCase>; journal: AbominationLifeReceipt[];
}
export interface AbominationLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AbominationActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface AbominationLifeProjection {
  title: string; story: string; source: string; environment: string; nextStep: string; activeCase: AbominationCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  site: AbominationSite; operation: AncientEvilOperationState; clockSeconds: number; playerLocation: AbominationSite['playerLocation']; playerTravelMetres: number;
  volunteerEffortSpent: number; conditionVersion: number; viewBlocked: boolean; pulse: AbominationPulse | null; cue: AbominationCue | null;
  pieces: AbominationPiece[]; pending: AbominationLifeWindow | null; pendingRemainingSeconds: number; currentAttempt: AbominationAttempt | null;
  cases: { id: AbominationCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: AbominationAttempt[] }[];
  ledger: AbominationLifeReceipt[]; actions: AbominationLifeAction[];
}
const BARRIER: AbominationLifeAbilityId = 'chained.s1.spirit-barrier', CRY: AbominationLifeAbilityId = 'chained.s1.brief-cry';
const POSITION: Record<AbominationSite['playerLocation'], number> = { START: 0, A: 4, B: 8, YARD: -4, OUTSIDE: -4 };
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 1;
const distance = (from: AbominationSite['playerLocation'], to: AbominationSite['playerLocation']) => Math.abs(POSITION[to] - POSITION[from]);
const freshCase = (): AbominationLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invited: false, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED' }, permissionWeek: { OWNER: null, ABILITY: null }, permissionVersion: 0, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createAbominationLifeState(): AbominationLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: createSilentDiscipleLifeState(), operation: createAncientEvilLifeState().operation,
    volunteerEffortSpent: 0, conditionVersion: 0, viewBlocked: false, pulse: null, cue: null, pieces: [], pending: null,
    cases: { 'tray-pulse': freshCase(), 'spoken-hesitation': freshCase(), 'withdrawn-input': freshCase() }, journal: [] };
}
const freshLife = (week: number, originals: AbominationOriginals): AbominationLifeState => ({ ...createAbominationLifeState(), sourceWeek: week, site: structuredClone(originals.site), operation: structuredClone(originals.operation) });
const closedSite = (p: AbominationSite) => p.playerLocation === 'START' && ['A', 'OUTSIDE'].includes(p.volunteer.location) && p.volunteer.form === 'HUMAN' && p.clothing.location === 'ELSA' && p.clothing.worn && p.bag.location === 'ELSA' && p.guide.location === 'OUTSIDE';
export function initializeAbominationLifeState(s: SliceState): void {
  const originals = s.abomination.sourceScene?.originals;
  if (!active(s) || !originals || !same(originals.site, s.silentDisciple.life) || !same(originals.operation, s.ancientEvil.life.operation) || !closedSite(originals.site) ||
    !same(s.abomination.life, createAbominationLifeState())) throw new Error('须只继承一次同一原室、埃尔莎、原托盘和已停止的原操作。');
  s.abomination.life = freshLife(s.week, originals);
}
export const getAbominationCurrentSite = (s: SliceState): AbominationSite => s.abomination.encounter.currentSite ?? s.abomination.life.site;
const projectedSite = (s: SliceState): AbominationSite => s.abomination.life.sourceWeek === null ? s.abomination.sourceScene?.originals.site ?? s.silentDisciple.life : getAbominationCurrentSite(s);
const current = (l: AbominationLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const delayed = (l: AbominationLifeState) => !!l.cue && !l.cue.executed && l.cue.delayRemainingSeconds > 0;
const locked = (l: AbominationLifeState) => l.activeCase !== null || l.pending !== null || delayed(l) || ABOMINATION_CASE_IDS.some(id => l.cases[id].status === 'OBSERVED');
export const hasAbominationLifeLock = (s: SliceState) => !!s.abomination?.life && locked(s.abomination.life);
export const abominationLifeClosed = (s: SliceState) => !hasAbominationLifeLock(s) && closedSite(s.abomination.life.site) && s.abomination.life.site.volunteer.location === 'A' && !s.abomination.life.viewBlocked && ABOMINATION_CASE_IDS.every(id => s.abomination.life.cases[id].status === 'RESOLVED');
export function validateAbominationActivityCommand(v: unknown): v is AbominationActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!ABOMINATION_CASE_IDS.includes(v.caseId as AbominationCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isAbominationActivityCommand = validateAbominationActivityCommand;
const isPower = (c: AbominationActivityCommand) => c.type === 'SPIRIT_BARRIER' || c.type === 'BRIEF_CRY';
const isChecked = (c: AbominationActivityCommand) => isPower(c) || c.type === 'PERFORM_PULSE';
const pieceFor = (l: AbominationLifeState, id: AbominationCaseId) => l.pieces.find(n => n.caseId === id);
function pendingUsable(l: AbominationLifeState, id: AbominationCaseId): boolean {
  const w = l.pending, r = l.cases[id], piece = pieceFor(l, id), p = l.site;
  return !!w && w.caseId === id && w.abilityId === BARRIER && w.expiresAt > p.clockSeconds && w.location === p.playerLocation && !l.viewBlocked &&
    w.pieceId === piece?.id && piece.location === 'TRAY' && piece.charges === 1 && piece.testCharges === 1 && w.trayId === p.tray.id &&
    w.permissionVersion === r.permissionVersion && w.conditionVersion === l.conditionVersion && r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' &&
    p.volunteer.willing && p.volunteer.location === 'A' && !!l.pulse && !l.pulse.resolved && w.pulseId === l.pulse.id && w.sourceId === piece.testSourceId;
}
function localBlock(l: AbominationLifeState, c: AbominationActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !locked(l) && closedSite(p) && !l.reflected && ABOMINATION_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三案真实操作、归还与报告。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], piece = pieceFor(l, id), index = ABOMINATION_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && closedSite(p) && r.status === 'AVAILABLE' && (index === 0 || ['RESOLVED', 'CANCELLED'].includes(l.cases[ABOMINATION_CASE_IDS[index - 1]!].status)) ? null : '先收尾前案，核对同一原室与普通门路。';
  if (c.type === 'CONSENT') return l.activeCase === null && closedSite(p) && r.status === 'OBSERVED' && (r.permission[c.permission] === 'UNASKED' || r.permission[c.permission] === 'GRANTED' && r.permissionWeek[c.permission] !== week) && p.volunteer.alive && p.volunteer.willing ? null : '须重新分别取得本案原物与具体能力许可；旧许可与撤回不重置。';
  if (c.type === 'INVITE') return !a && r.status === 'OBSERVED' && closedSite(p) && !r.invited && p.volunteer.location === 'OUTSIDE' && p.volunteer.alive && p.volunteer.willing && r.permission.OWNER === 'GRANTED' ? null : '仅向仍在室外的同一成年埃尔莎询问本案入室意愿；须再实际步行，不能瞬移。';
  if (c.type === 'WITHDRAW_CONSENT' && !a && r.status === 'OBSERVED') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '可以拒绝未给出的许可或撤回本案有效许可，不能恢复已撤回许可。';
  if (c.type === 'ABORT' && !a && r.status === 'OBSERVED' && l.activeCase === null && closedSite(p)) return null;
  if (c.type === 'PREPARE') return l.activeCase === null && closedSite(p) && r.status === 'OBSERVED' && !a && r.permissionWeek.OWNER === week && r.permission.OWNER === 'GRANTED' && (p.volunteer.location === 'A' || r.invited) &&
    (c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED' && r.permissionWeek.ABILITY === week) ? null : '先取得本周原物许可与实际入室意愿；每案只购一件，普通方法不要求能力许可。';
  if (c.type === 'REPORT') return !locked(l) && closedSite(p) && !l.viewBlocked && r.status === 'EXAMINED' && a?.closed && a.returned && a.verified ? null : '须实际完成唯一事件并归件退出；提前取消不能领取报告成果。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周正在进行的同一现场，不能复用旧许可或刷新耗材。';
  if (c.type === 'WITHDRAW_CONSENT') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '只能拒绝或撤回本案尚未关闭的许可。';
  if (c.type === 'WAIT_1') return delayed(l) ? null : '只有实际已施加而尚未走完的三秒迟滞需要等待；不续时、不重施。';
  if (c.type === 'ABORT') return delayed(l) ? '先用零行动等待走完已施加的真实三秒，让原定手势实际执行一次，再普通退出。' : null;
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已停止；已付成本和已施加的迟滞仍保留。';
  if (c.type === 'RESTORE_VIEW') return l.viewBlocked ? null : '视线未被遮挡。';
  if (c.type === 'RETURN_TO_A') return p.playerLocation === 'B' ? null : '须本人从B沿4米原路返回原托盘所在A。';
  if (c.type === 'TAKE_PIECE') return p.playerLocation === 'A' && piece?.location === 'TRAY' && (a.verified || a.stopped) && !delayed(l) ? null : '先完成或停止，等原手势真实执行，再从A原托盘取回同一件耗材。';
  if (c.type === 'RETURN_TO_ENTRY') return p.playerLocation === 'A' && piece?.location === 'HAND' && !delayed(l) && (a.verified || a.stopped) ? null : '先取回同一件耗材并走完已施加的三秒，再沿4米普通路回入口。';
  if (c.type === 'RETURN_PIECE') return p.playerLocation === 'START' && piece?.location === 'HAND' && !delayed(l) && (a.verified || a.stopped) ? null : '须本人回入口后交回同一件新耗材，已付费用不退。';
  if (c.type === 'LEAVE') return closedSite(p) && !l.viewBlocked && piece?.location === 'RETURNED' && !delayed(l) && (a.verified || a.stopped) ? null : '先完成或停止、归还耗材，并走完已施加三秒，沿普通门路退出。';
  if (c.type === 'WAIT_10') return l.pending && a.waits < 2 ? null : '只等待当前20秒束障窗口，不续时、不退费。';
  if (c.type === 'OCCLUDE') return p.playerLocation === 'A' && !!l.pending && !l.viewBlocked ? null : '须有实际未用束障，再用自己的手遮挡视线。';
  if (a.verified) return '本案唯一事件已实际结束，只能普通收尾。';
  if (r.permission.OWNER !== 'GRANTED' || !p.volunteer.willing) return '原物许可已停止，只能等待已有迟滞并普通返回归还。';
  if (c.type === 'WALK_TO_A') return p.playerLocation === 'START' && !a.readTray && (p.volunteer.location === 'A' || r.invited && p.volunteer.location === 'OUTSIDE') ? null : '须从入口实走4米到A；埃尔莎在室外时须先获邀请同意并真实走8米。';
  if (c.type === 'WALK_TO_B') return p.playerLocation === 'A' && a.readTray && (piece?.location === 'HAND' || piece?.location === 'TRAY') ? null : '先亲见原托盘，再沿4米路到B原纸；移动会结束未用束障，已施加迟滞仍真实经过。';
  if (c.type === 'READ_ORIGINAL') return p.playerLocation === 'B' && !a.readOriginal && a.readTray && (a.volunteerEffortSpent > 0 || l.volunteerEffortSpent + 3 <= 12) ? null : '须在B亲读唯一原纸；本阶段实际协作耗力不得超过12。';
  if (p.playerLocation !== 'A' || p.volunteer.location !== 'A' || !a.readOriginal || !a.readTray || l.viewBlocked) return '须亲读原托盘与B原纸后返回A，当面核验同一埃尔莎并保持视线。';
  if (c.type === 'PLACE_PIECE') return piece?.location === 'HAND' && !a.piecePlaced ? null : '本案唯一付费耗材只可亲手放入同一原托盘一次。';
  if (piece?.location !== 'TRAY') return '须先把本案同一付费耗材实际放在原托盘。';
  if (c.type === 'PREPARE_PULSE') return id !== 'spoken-hesitation' && !a.pulsePrepared && piece.testCharges === 1 && !a.stopped ? null : '每件束障耗材仅含一次有限精神测试脉冲，不能凭空再发射。';
  if (c.type === 'PREPARE_CUE') return id === 'spoken-hesitation' && !a.cuePrepared && piece.testCharges === 1 && !a.stopped ? null : '同一埃尔莎只准备一次本人自愿的可见手势；不是控制动作或思想。';
  if (c.type === 'PERFORM_PULSE') return id !== 'spoken-hesitation' && a.pulsePrepared && !!l.pulse && !l.pulse.resolved && piece.testCharges === 1 && !a.applicationDone && (id !== 'withdrawn-input' || a.method === 'ORDINARY' || a.withdrawn) ? null : '只实际触发当前一次精神脉冲并知识20观察；撤回案先撤回能力许可。';
  if (c.type === 'PERFORM_CUE') return id === 'spoken-hesitation' && a.cuePrepared && !!l.cue && !l.cue.executed && l.cue.delayImposedSeconds === 0 && piece.testCharges === 1 && !a.applicationDone ? null : '失败或普通方法可直接执行同一待发生手势一次；已施加迟滞须等待真实三秒。';
  if (isPower(c)) {
    if (a.method !== 'ABILITY' || a.stopped || r.permission.ABILITY !== 'GRANTED' || r.permissionWeek.ABILITY !== week || l.pending || a.castTier !== null || piece.charges !== 1 || piece.testCharges !== 1) return '须本案新鲜具体能力许可、未用耗材和唯一施术机会；不能重施或退费。';
    if (c.type === 'SPIRIT_BARRIER') return id !== 'spoken-hesitation' && a.pulsePrepared && !!l.pulse && !l.pulse.resolved && !a.applicationDone ? null : '须已知道同一耗材内待触发的一次局部精神脉冲；不能抵挡身体攻击。';
    return id === 'spoken-hesitation' && p.volunteer.alive && p.volunteer.bodyId === 'SD3-ELSA' && p.volunteer.form === 'HUMAN' && a.cuePrepared && !!l.cue && !l.cue.executed && !a.applicationDone ? null : '须同一活着且当前同意的埃尔莎在A，已准备而尚未执行的可见手势。';
  }
  return '当前阶段不能进行这一步。';
}
function cost(c: AbominationActivityCommand, l?: AbominationLifeState): AbominationLifeCost {
  return { actions: ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, pennies: c.type === 'PREPARE' ? 20 : 0,
    spirituality: isPower(c) ? 8 : 0, mind: isPower(c) ? 2 : c.type === 'PERFORM_PULSE' ? l && pendingUsable(l, c.caseId) ? 1 : 3 : 0, volunteerEffort: 0, pieceCharges: 0, testCharges: 0 };
}
function validBudget(b: AbominationEncounterBudget): boolean {
  return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) &&
    integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 &&
    integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) &&
    Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk);
}
interface Audit { date: PublicGameDate; revision: number; finance: AbominationFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; resistanceRoll: number | null }
const checkBaseFor = (_l: AbominationLifeState, c: AbominationActivityCommand, b: AbominationEncounterBudget) => isPower(c) ? b.coreStats.will : c.type === 'PERFORM_PULSE' ? b.coreStats.knowledge : null;
const audit = (s: SliceState, c: AbominationActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, finance: abominationFinanceSnapshot(s), randomCursor: s.random.cursor, randomBefore: isChecked(c) ? s.random.cursor : null, randomAfter: null, checkBase: checkBaseFor(s.abomination.life, c, abominationEncounterBudget(s)), check: null, resistanceRoll: null });
function transition(initial: AbominationLifeState, c: AbominationActivityCommand, week: number, before: AbominationEncounterBudget, clock: Audit) {
  if (!validateAbominationActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(c, l), after = structuredClone(before);
  const resisted = c.type === 'BRIEF_CRY' && success(clock.check?.tier ?? null) && clock.resistanceRoll !== null && clock.resistanceRoll <= 45;
  if (isPower(c) && (!success(clock.check?.tier ?? null) || resisted)) paid.mind = 4;
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < (isPower(c) ? 4 : paid.mind)) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null; let a = r?.attempts[0] ?? null;
  const piece = id ? pieceFor(l, id) ?? null : null;
  const source: AbominationLifeSource | null = id && piece ? {
    caseId: id, at: p.clockSeconds, trayId: p.tray.id, noteId: p.note.id, location: p.playerLocation, volunteerLocation: p.volunteer.location, permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion,
    piece: structuredClone(piece), pulse: structuredClone(l.pulse), cue: structuredClone(l.cue), window: structuredClone(l.pending) } : null;
  const receipt: AbominationLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome: clock.check?.tier ?? null, before: structuredClone(before), after, paid,
    elapsedSeconds: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), operationBefore: structuredClone(l.operation), operationAfter: structuredClone(l.operation), source };
  const clear = (why: AbominationAttempt['windowEnd']) => { if (l.pending && a) a.windowEnd = why; l.pending = null; };
  const changeCondition = (why: AbominationAttempt['windowEnd']) => { clear(why); l.conditionVersion++; };
  const consumeTest = () => { const n = pieceFor(l, id!)!; n.testCharges = 0; n.testUses = 1; paid.testCharges = 1; };
  const executeCue = () => { consumeTest(); l.cue!.executed = true; l.cue!.executedAt = p.clockSeconds; l.cue!.delayRemainingSeconds = 0; a!.applicationDone = true; a!.verified = true; a!.manual = !a!.appliedAbilityIds.includes(CRY); };
  const tick = (seconds: number) => {
    const oldClock = p.clockSeconds, outstanding = l.cue && !l.cue.executed ? l.cue.delayRemainingSeconds : 0;
    p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds;
    if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED');
    if (l.cue && outstanding > 0) {
      l.cue.delayRemainingSeconds = Math.max(0, outstanding - seconds);
      if (l.cue.delayRemainingSeconds === 0) { executeCue(); l.cue.executedAt = oldClock + outstanding; }
    }
  };
  const move = (to: 'START' | 'A' | 'B') => {
    changeCondition('MOVED'); const from = p.playerLocation, metres = distance(from, to), held = id ? pieceFor(l, id) : null, itemIds: string[] = [];
    p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
    if (held?.location === 'HAND') { held.travelMetres += metres; itemIds.push(held.id); }
    receipt.moves.push({ actorId: 'PLAYER', from, to, metres, seconds: metres, itemIds }); tick(metres);
  };
  const bringVolunteer = () => {
    if (p.volunteer.location !== 'OUTSIDE') return;
    for (const to of ['START', 'A'] as const) {
      const from = p.volunteer.location, metres = distance(from, to); p.volunteer.location = to; a!.volunteerTravelMetres += metres;
      receipt.moves.push({ actorId: p.volunteer.id, from, to, metres, seconds: metres, itemIds: [p.clothing.id, p.bag.id] }); tick(metres);
    }
  };
  const takePiece = () => { pieceFor(l, id!)!.location = 'HAND'; changeCondition('MOVED'); tick(1); };
  const returnPiece = () => { const held = pieceFor(l, id!)!; held.status = 'RETURNED'; held.location = 'RETURNED'; a!.returned = true; r!.returned = true; tick(1); };
  // Stopping new input never rewinds an already applied three-second cue.
  const clearInput = (why: AbominationAttempt['windowEnd']) => { changeCondition(why); };
  const close = () => {
    if (delayed(l)) throw new Error('已施加的三秒必须真实走完。');
    clearInput('STOPPED'); l.viewBlocked = false; a!.closed = true; a!.result = a!.verified ? a!.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY' : 'NONE'; r!.result = a!.result;
    r!.contactOpen = false; r!.status = a!.verified ? 'EXAMINED' : 'CANCELLED'; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED';
    a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  const collaborate = () => { if (a!.volunteerEffortSpent === 0) { l.volunteerEffortSpent += 3; a!.volunteerEffortSpent = 3; paid.volunteerEffort = 3; } };
  const applyPiece = (abilityId: AbominationLifeAbilityId) => { piece!.charges = 0; piece!.wear++; paid.pieceCharges = 1; a!.appliedAbilityIds.push(abilityId); a!.windowEnd = 'APPLIED'; clear('APPLIED'); };
  switch (c.type) {
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionWeek[c.permission] = week; r!.permissionVersion++; r!.consentWeek = week; tick(1); break;
    case 'INVITE': r!.invited = true; tick(1); break;
    case 'PREPARE': {
      const pieceId = `AB1-PIECE-${ABOMINATION_CASE_IDS.indexOf(c.caseId) + 1}`;
      a = { week, method: c.method, closed: false, stopped: false, returned: false, withdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0, volunteerTravelMetres: 0,
        spiritualitySpent: 0, mindSpent: 0, volunteerEffortSpent: 0, penniesSpent: 20, pieceId, readTray: false, readOriginal: false, piecePlaced: false, pulsePrepared: false, cuePrepared: false,
        castTier: null, resistanceRoll: null, resisted: false, checkTier: null, checkBase: null, baselinePressure: 0, feltPressure: 0, applicationDone: false, verified: false, manual: false, appliedAbilityIds: [], waits: 0,
        windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = c.caseId; l.pulse = null; l.cue = null;
      l.pieces.push({ id: pieceId, caseId: c.caseId, kind: c.caseId === 'spoken-hesitation' ? 'voice-piece' : 'ward-piece', ownerId: 'PLAYER', quantity: 1, status: 'PLAYER', location: 'HAND', charges: 1, wear: 0, paidPennies: 20, boughtWeek: week, travelMetres: 0, testSourceId: `${pieceId}-TEST`, testCharges: 1, testUses: 0 }); tick(2); break;
    }
    case 'WALK_TO_A': bringVolunteer(); move('A'); a!.readTray = true; break;
    case 'RETURN_TO_A': move('A'); break;
    case 'WALK_TO_B': move('B'); break;
    case 'RETURN_TO_ENTRY': move('START'); break;
    case 'TAKE_PIECE': takePiece(); break;
    case 'RETURN_PIECE': returnPiece(); break;
    case 'LEAVE': close(); break;
    case 'READ_ORIGINAL': a!.readOriginal = true; collaborate(); tick(3); break;
    case 'PLACE_PIECE': piece!.location = 'TRAY'; a!.piecePlaced = true; tick(1); break;
    case 'PREPARE_PULSE':
      a!.pulsePrepared = true; l.pulse = { id: `${piece!.testSourceId}-PULSE`, pieceId: piece!.id, sourceId: piece!.testSourceId, targetId: 'PLAYER', kind: 'MENTAL', pressure: 45, createdAt: p.clockSeconds, consumedAt: null, resolved: false }; tick(1); break;
    case 'PREPARE_CUE':
      a!.cuePrepared = true; l.cue = { id: `${piece!.testSourceId}-CUE`, pieceId: piece!.id, sourceId: piece!.testSourceId, actorId: p.volunteer.id, bodyId: p.volunteer.bodyId, kind: 'VISIBLE_HAND_CUE', location: 'A', createdAt: p.clockSeconds, delayImposedSeconds: 0, delayRemainingSeconds: 0, executed: false, executedAt: null }; tick(1); break;
    case 'SPIRIT_BARRIER': case 'BRIEF_CRY': {
      const tier = clock.check?.tier ?? null; if (!tier || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(tier)) return null;
      if (c.type === 'BRIEF_CRY' && success(tier) ? !integer(clock.resistanceRoll, 1, 100) : clock.resistanceRoll !== null) return null;
      a!.spiritualitySpent += 8; a!.mindSpent += paid.mind; a!.castTier = tier; a!.resistanceRoll = clock.resistanceRoll; a!.resisted = resisted; tick(1);
      a!.windowEnd = !success(tier) ? 'FAILED' : resisted ? 'RESISTED' : 'ACTIVE';
      if (success(tier) && !resisted) {
        if (c.type === 'SPIRIT_BARRIER') l.pending = { abilityId: 'chained.s1.spirit-barrier', caseId: id!, pieceId: piece!.id, trayId: p.tray.id, sourceId: piece!.testSourceId, targetId: 'PLAYER', location: 'A', permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, pulseId: l.pulse!.id };
        else { applyPiece(CRY); a!.applicationDone = true; l.cue!.delayImposedSeconds = 3; l.cue!.delayRemainingSeconds = 3; }
      }
      break;
    }
    case 'PERFORM_PULSE': {
      if (!clock.check || clock.checkBase === null) return null;
      const applied = pendingUsable(l, id!); if (applied) applyPiece(BARRIER);
      consumeTest(); a!.checkBase = clock.checkBase; a!.checkTier = clock.check.tier; a!.baselinePressure = 45; a!.feltPressure = applied ? 15 : 45;
      a!.mindSpent += paid.mind; a!.applicationDone = true; a!.verified = true; a!.manual = !applied; l.pulse!.resolved = true; l.pulse!.consumedAt = p.clockSeconds;
      changeCondition('CONDITION_CHANGED'); tick(2); break;
    }
    case 'PERFORM_CUE': executeCue(); tick(1); break;
    case 'OCCLUDE': l.viewBlocked = true; changeCondition('OCCLUDED'); tick(1); break;
    case 'RESTORE_VIEW': l.viewBlocked = false; changeCondition('CONDITION_CHANGED'); tick(1); break;
    case 'WAIT_1': a!.waits++; tick(1); break;
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'WITHDRAW_CONSENT':
      r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++; if (a) { a.withdrawn = true; a.stopped = true; } clearInput('WITHDRAWN'); tick(1); break;
    case 'STOP_METHOD': a!.stopped = true; clearInput('STOPPED'); tick(1); break;
    case 'ABORT':
      if (!a) { r!.status = 'CANCELLED'; r!.returned = true; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED'; tick(1); break; }
      a.stopped = true; clearInput('STOPPED'); l.viewBlocked = false; tick(1);
      if (p.playerLocation === 'B') move('A'); if (pieceFor(l, id!)!.location === 'TRAY') takePiece(); if (p.playerLocation === 'A') move('START');
      if (pieceFor(l, id!)!.location === 'HAND') returnPiece(); close(); break;
    case 'REPORT': {
      const marker = `abomination-case:${id}`; if (after.completedSources.includes(marker)) return null;
      r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const abilityId of a!.appliedAbilityIds) after.mastery[abilityId] = Math.min(500, (after.mastery[abilityId] ?? 0) + 8); tick(4); break;
    }
    case 'REFLECT': if (after.completedSources.includes('abomination-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('abomination-reflection'); tick(4); break;
  }
  receipt.siteAfter = structuredClone(p); receipt.operationAfter = structuredClone(l.operation); if (!validBudget(after) || l.volunteerEffortSpent > 12) return null;
  return { life: l, receipt };
}
/** Preserve every historical object and body field; only replayed physical positions and clocks can differ. */
export function validateAbominationCurrentSite(v: unknown, originals: AbominationOriginals): v is AbominationSite {
  try {
    if (!record(v) || !shape(v, Object.keys(originals.site))) return false;
    const p = v as unknown as AbominationSite, old = originals.site;
    return Object.hasOwn(POSITION, p.playerLocation) && integer(p.playerTravelMetres, old.playerTravelMetres) && integer(p.clockSeconds, old.clockSeconds) &&
      same(p, { ...old, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, clockSeconds: p.clockSeconds, volunteer: p.volunteer }) &&
      ['A', 'START', 'OUTSIDE'].includes(p.volunteer.location) && same(p.volunteer, { ...old.volunteer, location: p.volunteer.location });
  } catch { return false; }
}
function lifeBoundary(e: AbominationLifeReceipt, isLocked: boolean) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || isLocked) return { budget, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: abominationFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function abominationCompletedLifeBudgetMatches(s: SliceState, e: AbominationLifeReceipt, isLocked = hasAbominationLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(abominationEncounterBudget(s), expected.budget) || !same(abominationFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null ||
    (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): AbominationLifeState | null {
  const life = s.abomination.life, source = s.abomination.sourceScene;
  if (!source || life.sourceWeek === null) return null;
  let model = freshLife(life.sourceWeek, source.originals), previous: AbominationLifeReceipt | null = null, lastWeek = life.sourceWeek, cursor = source.random.cursor;
  for (const e of life.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'resistanceRoll', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'moves', 'siteBefore', 'siteAfter', 'operationBefore', 'operationAfter', 'source']) ||
      !validateAbominationActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) ||
      !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) || !integer(e.randomCursor, cursor, s.random.cursor) || !validateAbominationFinanceSnapshot(e.finance, e.week) || !validBudget(e.before)) return null;
    if (locked(model) && (!previous || e.week !== lastWeek || e.revision !== previous.revision + 1 || !same(e.before, previous.after) || !same(e.finance, previous.finance) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (previous && e.revision === previous.revision + 1) {
      const expected = lifeBoundary(previous, locked(model));
      if (e.week !== expected.week || !same(e.date, expected.date) || !same(e.before, expected.budget) || !same(e.finance, expected.finance) || expected.eventId !== null || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
    }
    if (isChecked(e.command)) {
      if (e.checkBase !== checkBaseFor(model, e.command, e.before) || !same(e.before.coreStats, s.character.coreStats) || e.checkBase === null || !record(e.check) || e.randomBefore !== e.randomCursor || !integer(e.randomAfter, cursor, s.random.cursor)) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomCursor), expected = resolveNormalCheck({ ability: isPower(e.command) ? 'will' : 'knowledge', baseAbility: e.checkBase, difficulty: isPower(e.command) ? 18 : 20, modifiers: [], roll: random.nextInt(1, 100) });
      const resistance = e.command.type === 'BRIEF_CRY' && success(expected.tier) ? random.nextInt(1, 100) : null;
      if (!same(e.check, expected) || e.outcome !== expected.tier || e.resistanceRoll !== resistance || random.cursor !== e.randomAfter) return null;
    } else if (e.randomBefore !== null || e.randomAfter !== null || e.checkBase !== null || e.check !== null || e.outcome !== null || e.resistanceRoll !== null) return null;
    const next = transition(model, e.command, e.week, e.before, { date: e.date, revision: e.revision, finance: e.finance, randomCursor: e.randomCursor, randomBefore: e.randomBefore, randomAfter: e.randomAfter, checkBase: e.checkBase, check: e.check, resistanceRoll: e.resistanceRoll });
    if (!next || !same(next.receipt, e) || !validateAbominationCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor;
  }
  return model;
}
export function abominationLifeMasteryGains(s: SliceState): Record<AbominationLifeAbilityId, number> {
  const gains: Record<AbominationLifeAbilityId, number> = { [BARRIER]: 0, [CRY]: 0 } as Record<AbominationLifeAbilityId, number>;
  for (const id of ABOMINATION_CASE_IDS) { const r = s.abomination.life.cases[id]; if (r.status === 'RESOLVED') for (const abilityId of r.attempts[0]!.appliedAbilityIds) gains[abilityId] += 8; }
  return gains;
}
export function validateAbominationLifeState(s: SliceState): boolean {
  try {
    const life = s.abomination?.life, source = s.abomination?.sourceScene;
    if (!record(life) || !shape(life, Object.keys(createAbominationLifeState())) || !record(life.cases) || !shape(life.cases, ABOMINATION_CASE_IDS) || !Array.isArray(life.journal) || life.journal.length > 250) return false;
    if (s.abomination.promotionWeek === null) return same(life, createAbominationLifeState());
    if (!source || life.sourceWeek !== s.abomination.promotionWeek || !same(source.originals.site, s.silentDisciple.life) || !same(source.originals.operation, s.ancientEvil.life.operation) ||
      !closedSite(source.originals.site) || !validateAbominationCurrentSite(life.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(life, replay)) return false;
    const gains = abominationLifeMasteryGains(s); let acting = life.reflected ? 25 : 0;
    for (const id of ABOMINATION_CASE_IDS) {
      const resolved = life.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `abomination-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'abomination-reflection').length !== (life.reflected ? 1 : 0) || active(s) && s.progression.acting < acting ||
      (s.progression.mastery[BARRIER] ?? 0) < gains[BARRIER] || (s.progression.mastery[CRY] ?? 0) < gains[CRY]) return false;
    const last = life.journal.at(-1), encounter = s.abomination.encounter;
    if (locked(life) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.abomination.preparedWeek !== null ||
      encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(abominationEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !abominationCompletedLifeBudgetMatches(s, last, locked(life))) return false;
    return true;
  } catch { return false; }
}
export const validateAbominationLife = validateAbominationLifeState;
export function blockAbominationLife(s: SliceState, c: AbominationActivityCommand): string | null {
  if (!validateAbominationActivityCommand(c)) return '有限束障与短促震声实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已实际晋升神孽。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.abomination.preparedWeek !== null) return '先处理当前事件、战斗或晋升准备，并回到贝克兰德原室。';
  if (s.abomination.encounter.status !== 'AVAILABLE' || s.abomination.encounter.preparation !== null) return '现场已交给独立遭遇；原室实践保留为历史。';
  if (!validateAbominationLifeState(s)) return '同一原人原物、实付成本、真实条件或历史收据不一致。';
  const reason = localBlock(s.abomination.life, c, s.week); if (reason) return reason;
  const paid = cost(c, s.abomination.life);
  if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < (isPower(c) ? 4 : paid.mind)) return '行动、费用、灵性或失败所需精神不足；可普通完成或无费用归还退出。';
  return null;
}
export const getAbominationActivityBlock = blockAbominationLife;
export function applyAbominationLifeCommand(s: SliceState, c: AbominationActivityCommand, ctx: SeerContext): void {
  const reason = blockAbominationLife(s, c); if (reason) throw new Error(reason);
  const clock = audit(s, c), before = abominationEncounterBudget(s);
  if (isChecked(c)) {
    const ability = isPower(c) ? 'will' : 'knowledge', difficulty = isPower(c) ? 18 : 20;
    const actual = ctx.check(ability, difficulty);
    clock.check = resolveNormalCheck({ ability, baseAbility: clock.checkBase!, difficulty, modifiers: [], roll: actual.roll });
    s.lastCheck = structuredClone(clock.check);
    if (c.type === 'BRIEF_CRY' && success(clock.check.tier)) clock.resistanceRoll = ctx.roll(1, 100);
    clock.randomAfter = s.random.cursor;
  }
  const next = transition(s.abomination.life, c, s.week, before, clock); if (!next) throw new Error('同一原室的有限现场转移失败。');
  s.abomination.life = next.life; s.abomination.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality;
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  const a = current(next.life), cue = next.life.cue;
  ctx.note(`原室有限实践：${LABELS[c.type]}`, `${clock.check ? `${isPower(c) ? '意志18' : '知识20'}检定${TIER_LABELS[clock.check.tier]}。` : ''}${clock.resistanceRoll !== null ? `埃尔莎真实抵抗骰${clock.resistanceRoll}/100，45及以下抵抗成功。` : ''}${isPower(c) ? `实付8灵性、${next.receipt.paid.mind}精神。` : ''}本人在${LOCATION_LABELS[next.life.site.playerLocation]}，原室时钟${next.life.site.clockSeconds}秒。${c.type === 'PERFORM_PULSE' ? `本件唯一精神脉冲45，本次压力${a?.feltPressure}，精神实耗${next.receipt.paid.mind}，一次测试来源已消耗。` : c.type === 'BRIEF_CRY' && cue?.delayImposedSeconds === 3 ? '已对原定手势实际施加三秒迟滞，须真实等待后执行一次。' : c.type === 'WITHDRAW_CONSENT' ? `指定许可已撤回，未用束障立即失效；既有迟滞仍余${cue?.delayRemainingSeconds ?? 0}秒。` : c.type === 'WALK_TO_A' && a?.volunteerTravelMetres ? '埃尔莎已沿室外、入口、A原路实走8米，同一原衣与原包随本人。' : '原身体、原衣、原包、原托盘与普通门路持续保留。'}累计本阶段真实协作耗力${next.life.volunteerEffortSpent}/12。`);
}
export const applyAbominationActivity = applyAbominationLifeCommand;
export const applyAbominationLife = applyAbominationLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATION_LABELS: Record<AbominationSite['playerLocation'], string> = { START: '原入口', A: '四米处原托盘旁', B: '八米处原纸旁', YARD: '独立邻院', OUTSIDE: '室外' };
const LABELS: Record<AbominationActivityCommand['type'], string> = {
  OBSERVE: '核对原室、原人和普通退路', INVITE: '询问室外埃尔莎本案入室意愿', PREPARE: '购买本案唯一含一次测试来源的耗材', CONSENT: '重新询问本案许可', WITHDRAW_CONSENT: '拒绝或撤回本案许可',
  WALK_TO_A: '实际同行到四米处并亲见唯一原托盘', WALK_TO_B: '沿4米路走到八米处原纸', READ_ORIGINAL: '亲读八米处唯一原纸', RETURN_TO_A: '沿4米原路返回原托盘', PLACE_PIECE: '把同一件新耗材放在原托盘',
  PREPARE_PULSE: '核实本件唯一待触发精神脉冲', SPIRIT_BARRIER: '灵性束障：只护下一次局部精神脉冲', PERFORM_PULSE: '实际触发唯一脉冲并作知识20观察',
  PREPARE_CUE: '埃尔莎自愿准备一次可见手势', BRIEF_CRY: '短促震声：尝试让原定手势迟滞三秒', PERFORM_CUE: '普通执行原定可见手势一次',
  WAIT_1: '实际等待1秒，保留原定手势', WAIT_10: '实际等待10秒', STOP_METHOD: '停止本次新能力输入', TAKE_PIECE: '从原托盘取回同一新耗材', RETURN_TO_ENTRY: '沿4米普通路回入口',
  RETURN_PIECE: '亲手交还同一新耗材，不退费用', LEAVE: '结束接触，确认普通退出', ABORT: '停止并沿普通路归件退出', REPORT: '报告已收尾的实际结果', REFLECT: '反思三案的许可与有限代价',
  OCCLUDE: '用自己的手遮住视线', RESTORE_VIEW: '移开自己的手，恢复普通视线',
};
const CASES: { id: AbominationCaseId; title: string; story: string }[] = [
  { id: 'tray-pulse', title: '原托盘上的一次精神脉冲', story: '先亲见原托盘、实走到八米处读原纸并返回托盘，再放入唯一付费束障件。20秒束障仅令这件耗材的一次局部精神脉冲45降至15，精神代价由3降至1；不是身体护盾。知识20观察如实保留成败。' },
  { id: 'spoken-hesitation', title: '同一成年埃尔莎的原定手势', story: '本案当前具体同意后，埃尔莎准备一次可见手势。意志18成功后还须面对45%实际抵抗；成功只施加三秒迟滞，零行动真实等待后原手势执行一次。本人身体、位置与想法不受控制。' },
  { id: 'withdrawn-input', title: '撤回未用束障，普通完成', story: '尝试束障后实际撤回能力许可，再触发同一有限脉冲。未用束障立即结束，实付成本不退，普通观察与归件仍可完成；没有未应用的掌握奖励。' },
];
const CLEANUP = ['WAIT_1', 'STOP_METHOD', 'RETURN_TO_A', 'TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'RESTORE_VIEW', 'WITHDRAW_CONSENT'];
export function abominationLifeActions(s: SliceState): AbominationLifeAction[] {
  if (!active(s) || s.abomination.encounter.status !== 'AVAILABLE' || s.abomination.encounter.preparation !== null) return [];
  const l = s.abomination.life, id = l.activeCase ?? ABOMINATION_CASE_IDS.find(key => !['RESOLVED', 'CANCELLED'].includes(l.cases[key].status)), out: AbominationLifeAction[] = [];
  const add = (command: AbominationActivityCommand) => {
    const reason = blockAbominationLife(s, command), paid = cost(command, l);
    out.push({ id: `AB1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : ''}`,
      label: LABELS[command.type] + ('permission' in command ? command.permission === 'OWNER' ? '（原物与普通操作）' : '（本案具体能力）' : command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : ''),
      cost: [`${paid.actions}行动`, ...(paid.pennies ? [`${paid.pennies}便士，一件一测试源`] : []), ...(isPower(command) ? ['8灵性、2精神（检定失败或抵抗成功均总4精神）', '意志18', command.type === 'BRIEF_CRY' ? '再独立检验45%抵抗；成功真实迟滞3秒' : '20秒单次精神束障'] : command.type === 'PERFORM_PULSE' ? [`${paid.mind}精神，知识20，消耗一次测试源`] : command.type === 'WAIT_1' ? ['真实1秒，不退款、不刷新'] : [])].join(' · '), enabled: reason === null, reason, command, cleanup: CLEANUP.includes(command.type) });
  };
  if (!id) { if (!l.reflected && ABOMINATION_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) add({ type: 'REFLECT' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const r = l.cases[id], a = r.attempts[0];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') {
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED' || r.permission[permission] === 'GRANTED' && r.permissionWeek[permission] !== s.week) add({ type: 'CONSENT', caseId: id, permission });
    if (l.site.volunteer.location === 'OUTSIDE' && !r.invited) add({ type: 'INVITE', caseId: id });
    add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (a && r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'ABORT', 'INVITE'].includes(type) && localBlock(l, { type, caseId: id }, s.week) === null) add({ type, caseId: id });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  let preferred: AbominationLifeAction | undefined;
  const choose = (type: AbominationActivityCommand['type']) => out.find(v => v.enabled && v.command.type === type);
  if (delayed(l)) preferred = choose('WAIT_1');
  if (a && !a.verified) {
    if (l.viewBlocked) preferred ??= choose('RESTORE_VIEW');
    if (r.permission.OWNER !== 'GRANTED') preferred ??= choose('ABORT');
    if (a.method === 'ABILITY' && id === 'withdrawn-input' && !a.withdrawn && (a.castTier !== null || a.pulsePrepared && !choose('SPIRIT_BARRIER'))) preferred ??= out.find(v => v.enabled && v.command.type === 'WITHDRAW_CONSENT' && v.command.permission === 'ABILITY');
    if (a.method === 'ABILITY' && !a.stopped) preferred ??= choose(id === 'spoken-hesitation' ? 'BRIEF_CRY' : 'SPIRIT_BARRIER');
    preferred ??= choose('PERFORM_PULSE') ?? choose('PERFORM_CUE');
    preferred ??= choose('WALK_TO_A') ?? (!a.readOriginal ? choose('WALK_TO_B') ?? choose('READ_ORIGINAL') : undefined) ?? choose('RETURN_TO_A') ?? choose('PLACE_PIECE') ?? choose('PREPARE_PULSE') ?? choose('PREPARE_CUE');
  }
  if (a?.verified) preferred ??= choose('TAKE_PIECE') ?? choose('RETURN_TO_ENTRY') ?? choose('RETURN_PIECE') ?? choose('LEAVE');
  preferred ??= out.find(v => v.enabled && ![...CLEANUP, 'WAIT_10', 'OCCLUDE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'OCCLUDE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled);
  if (preferred) preferred.preferredAction = true;
  return out;
}
export function projectAbominationLife(s: SliceState): AbominationLifeProjection {
  const l = s.abomination.life, site = projectedSite(s), actions = abominationLifeActions(s), preferred = actions.find(a => a.preferredAction) ?? actions.find(a => a.enabled);
  return { title: '原安静室的有限灵性束障与短促震声', story: '继续使用43岁的同一埃尔莎、室外哈伦、原衣、原包、原托盘与原纸。先取得本案邀请和许可，再实际走入原室；每案只购一件新耗材与一次有限测试来源。',
    source: '当前原室来自沉默门徒的实际现场；古代邪物旧交接快照保留为历史。原三块已耗木块不刷新，新耗材独立购买。原记录没有能量余额，只累计本阶段真实协作耗力。',
    environment: '埃尔莎原在室外，先邀请，再经入口实走8米到原托盘，同一原衣与包随本人；本人从入口走4米到原托盘，再走4米到原纸并原路返回。8灵性2精神，检定失败或抵抗成功总4精神。束障20秒仅护一次局部精神脉冲；震声三秒迟滞一旦施加，撤回、停止和移动均不能抹去。普通归件与零行动等待持续开放。',
    nextStep: preferred?.label ?? (l.reflected ? '三案已收尾，可自行决定是否前往独立邻院。' : '当前没有待执行的原室操作。'), preferredActionId: preferred?.id ?? null,
    activeCase: l.activeCase, inside: hasAbominationLifeLock(s), insideCase: hasAbominationLifeLock(s), reflected: l.reflected,
    site: structuredClone(site), operation: structuredClone(l.sourceWeek === null ? s.abomination.sourceScene?.originals.operation ?? s.ancientEvil.life.operation : l.operation), clockSeconds: site.clockSeconds, playerLocation: site.playerLocation, playerTravelMetres: site.playerTravelMetres,
    volunteerEffortSpent: l.volunteerEffortSpent, conditionVersion: l.conditionVersion, viewBlocked: l.viewBlocked, pulse: structuredClone(l.pulse), cue: structuredClone(l.cue),
    pieces: structuredClone(l.pieces), pending: structuredClone(l.pending), pendingRemainingSeconds: l.cue && !l.cue.executed ? l.cue.delayRemainingSeconds : l.pending ? Math.max(0, l.pending.expiresAt - site.clockSeconds) : 0,
    currentAttempt: structuredClone(current(l)), cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info,
      observations: a ? [`实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性/${a.mindSpent}精神；本案真实协作耗力${a.volunteerEffortSpent}，本人走${a.playerTravelMetres}米，埃尔莎走${a.volunteerTravelMetres}米。`,
        ...(a.checkTier ? [`本次知识20观察${TIER_LABELS[a.checkTier]}，原知识基础${a.checkBase}，不伪造加成。`] : []), ...(a.baselinePressure ? [`唯一精神脉冲基线45，本次压力${a.feltPressure}，该测试来源已消耗。`] : []), ...(a.resistanceRoll !== null ? [`本次真实抵抗骰${a.resistanceRoll}/100：${a.resisted ? '抵抗成功，未施加迟滞' : '未抵抗，已实际施加三秒迟滞'}。`] : []), ...(a.withdrawn ? ['本案指定许可已撤回；未用束障失效，已施加迟滞照常走完。'] : [])] : [],
      status: r.status, method: r.method, result: r.status === 'CANCELLED' ? '已普通退出，未完成的操作不领取报告成果。' : r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限作用已实际应用并记录。' : '已普通完成；没有未应用的能力奖励。',
      permission: structuredClone(r.permission), permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }),
    ledger: structuredClone(l.journal), actions };
}
