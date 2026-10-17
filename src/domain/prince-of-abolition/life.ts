import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { createFrenzyMageLifeState, type FrenzyMageLifeState, type FrenzyMageLocation } from '../frenzy-mage/life.js';
import { createEntropyDukeLifeState, type EntropyDukeOperationState } from '../entropy-duke/life.js';
import type { PrinceOfAbolitionOriginals } from './types.js';
import { princeOfAbolitionEncounterBudget, princeOfAbolitionFinanceSnapshot, validatePrinceOfAbolitionFinanceSnapshot, type PrinceOfAbolitionEncounterBudget, type PrinceOfAbolitionFinanceSnapshot } from './encounter.js';

export type PrinceOfAbolitionLocation = FrenzyMageLocation | 'ANNEX' | 'RECEIVER' | 'YARD';
export interface PrinceOfAbolitionSite extends Omit<FrenzyMageLifeState, 'playerLocation' | 'guide' | 'volunteer' | 'parcel' | 'ball' | 'paper'> {
  playerLocation: PrinceOfAbolitionLocation;
  guide: Omit<FrenzyMageLifeState['guide'], 'location'> & { location: PrinceOfAbolitionLocation };
  volunteer: Omit<FrenzyMageLifeState['volunteer'], 'location' | 'mind'> & { location: PrinceOfAbolitionLocation; mind: number };
  parcel: Omit<FrenzyMageLifeState['parcel'], 'location'> & { location: PrinceOfAbolitionLocation };
  ball: Omit<FrenzyMageLifeState['ball'], 'location'> & { location: PrinceOfAbolitionLocation };
  paper: Omit<FrenzyMageLifeState['paper'], 'location'> & { location: PrinceOfAbolitionLocation };
}
export type PrinceOfAbolitionSceneRoot = PrinceOfAbolitionSite;
export const PRINCE_OF_ABOLITION_CASE_IDS = ['directed-throw', 'maintained-flight', 'withdrawn-input'] as const;
export type PrinceOfAbolitionCaseId = typeof PRINCE_OF_ABOLITION_CASE_IDS[number];
export type PrinceOfAbolitionLifeAbilityId = 'black-emperor.s1.directed-amplification' | 'black-emperor.s1.effect-maintenance';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY' | 'COOPERATION';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'START_ORDINARY', 'WALK_TO_ANNEX', 'INSPECT', 'TAKE_BALL', 'PREPARE_ACTION', 'DIRECTED_AMPLIFICATION', 'THROW_BALL', 'EFFECT_MAINTENANCE', 'WAIT_FLIGHT', 'WAIT_10', 'WALK_TO_RECEIVER', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RETURN_OBJECTS', 'LEAVE', 'ABORT', 'REPORT', 'STOP_METHOD', 'OCCLUDE', 'RESTORE_VIEW'] as const;
export type PrinceOfAbolitionActivityCommand =
  | { type: typeof STEPS[number]; caseId: PrinceOfAbolitionCaseId }
  | { type: 'PREPARE'; caseId: PrinceOfAbolitionCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: PrinceOfAbolitionCaseId; permission: Permission }
  | { type: 'EXIT_ROOM' | 'BUY_ANNEX' | 'REFLECT' };
export interface PrinceOfAbolitionAnnex { id: 'PA1-ANNEX'; paidPennies: 40; boughtWeek: number; surface: { id: 'PA1-RECEIVER'; location: 'RECEIVER'; padded: true; people: 0; placed: true; inspections: number } }
export interface PrinceOfAbolitionPiece { id: string; caseId: PrinceOfAbolitionCaseId; ownerId: 'PLAYER'; quantity: 1; location: 'HAND' | 'ANNEX' | 'RETURNED'; charges: 0 | 1; wear: 0 | 1; paidPennies: 20; boughtWeek: number; travelMetres: number }
export interface PrinceOfAbolitionFlight {
  id: string; caseId: PrinceOfAbolitionCaseId; objectId: 'FM3-PRACTICE-BALL'; actorId: 'PLAYER'; from: 'ANNEX'; to: 'RECEIVER'; distanceMm: 4000;
  launchedAt: number; originalLandAt: number; landsAt: number; segmentStartAt: number; segmentStartMm: number; positionMm: number; amplificationApplied: boolean; maintenanceApplied: boolean;
}
export interface PrinceOfAbolitionLifeWindow { abilityId: 'black-emperor.s1.directed-amplification'; caseId: PrinceOfAbolitionCaseId; pieceId: string; objectId: 'FM3-PRACTICE-BALL'; actionId: string; actorId: 'PLAYER'; location: 'ANNEX'; permissionVersion: number; conditionVersion: number; createdAt: number; expiresAt: number }
export interface PrinceOfAbolitionAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; cooperationEffortSpent: 0 | 3; volunteerMindSpent: 0 | 1; penniesSpent: 0 | 20; pieceId: string | null;
  inspected: boolean; ballTaken: boolean; actionId: string | null; thrown: boolean; landed: boolean; retrieved: boolean; verified: boolean;
  castTier: PublicResolutionTier | null; throwTier: PublicResolutionTier | null; amplification: 0 | 35; maintenanceSeconds: 0 | 20; appliedAbilityIds: PrinceOfAbolitionLifeAbilityId[];
  waits: number; windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN' | 'OCCLUDED'; result: 'NONE' | Method;
  siteAtStart: PrinceOfAbolitionSite; siteAtClose: PrinceOfAbolitionSite | null;
}
export interface PrinceOfAbolitionLifeCase { status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED' | 'CANCELLED'; observedWeek: number | null; permission: Record<Permission, Consent>; permissionWeek: Record<Permission, number | null>; permissionVersion: number; method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: PrinceOfAbolitionAttempt[] }
export interface PrinceOfAbolitionLifeCost { actions: number; pennies: number; spirituality: number; mind: number; cooperationEffort: number; volunteerMind: number; pieceCharges: number }
export interface PrinceOfAbolitionLifeMovement { actorId: 'PLAYER'; from: PrinceOfAbolitionLocation; to: PrinceOfAbolitionLocation; metres: number; seconds: number; itemIds: string[] }
export interface PrinceOfAbolitionLifeSource { caseId: PrinceOfAbolitionCaseId; at: number; location: PrinceOfAbolitionLocation; ball: PrinceOfAbolitionSite['ball']; paper: PrinceOfAbolitionSite['paper']; permissionVersion: number; conditionVersion: number; piece: PrinceOfAbolitionPiece | null; pending: PrinceOfAbolitionLifeWindow | null; flight: PrinceOfAbolitionFlight | null }
export interface PrinceOfAbolitionLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: PrinceOfAbolitionActivityCommand; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: PrinceOfAbolitionEncounterBudget; after: PrinceOfAbolitionEncounterBudget; finance: PrinceOfAbolitionFinanceSnapshot; paid: PrinceOfAbolitionLifeCost; elapsedSeconds: number; moves: PrinceOfAbolitionLifeMovement[];
  siteBefore: PrinceOfAbolitionSite; siteAfter: PrinceOfAbolitionSite; operationBefore: EntropyDukeOperationState; operationAfter: EntropyDukeOperationState; source: PrinceOfAbolitionLifeSource | null;
}
export interface PrinceOfAbolitionLifeState {
  sourceWeek: number | null; activeCase: PrinceOfAbolitionCaseId | null; reflected: boolean; site: PrinceOfAbolitionSite; operation: EntropyDukeOperationState; annex: PrinceOfAbolitionAnnex | null;
  cooperationEffortSpent: number; volunteerMindSpent: number; conditionVersion: number; viewBlocked: boolean; pieces: PrinceOfAbolitionPiece[]; pending: PrinceOfAbolitionLifeWindow | null; flight: PrinceOfAbolitionFlight | null;
  cases: Record<PrinceOfAbolitionCaseId, PrinceOfAbolitionLifeCase>; journal: PrinceOfAbolitionLifeReceipt[];
}
export interface PrinceOfAbolitionLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PrinceOfAbolitionActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface PrinceOfAbolitionAttemptProjection { method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; cooperationEffortSpent: number; volunteerMindSpent: number; penniesSpent: number; thrown: boolean; landed: boolean; verified: boolean; castTier: PublicResolutionTier | null; throwTier: PublicResolutionTier | null; amplification: number; maintenanceSeconds: number; appliedAbilityIds: PrinceOfAbolitionLifeAbilityId[]; result: 'NONE' | Method }
export interface PrinceOfAbolitionLifeProjection {
  title: string; story: string; source: string; environment: string; nextStep: string; preferredActionId: string | null; activeCase: PrinceOfAbolitionCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: { playerLocation: string; guide: string; volunteer: string; parcel: string; ball: string; paper: string; pads: string[] }; operation: { door: 'OPEN'; inputActive: boolean; flightActive: boolean }; clockSeconds: number; playerLocation: PrinceOfAbolitionLocation; playerTravelMetres: number;
  annex: PrinceOfAbolitionAnnex | null; cooperationEffortSpent: number; volunteerMindSpent: number; viewBlocked: boolean; pieces: PrinceOfAbolitionPiece[]; pending: { abilityId: PrinceOfAbolitionLifeAbilityId; remainingSeconds: number } | null; pendingRemainingSeconds: number;
  flight: { objectId: string; from: string; to: string; positionMetres: number; remainingSeconds: number; maintenanceSeconds: number } | null; currentAttempt: PrinceOfAbolitionAttemptProjection | null;
  cases: { id: PrinceOfAbolitionCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: PrinceOfAbolitionAttemptProjection[] }[];
  ledger: { week: number; label: string; actions: number; pennies: number; spirituality: number; mind: number; seconds: number; outcome: PublicResolutionTier | null }[]; actions: PrinceOfAbolitionLifeAction[];
}
const AMPLIFY = 'black-emperor.s1.directed-amplification' as const, MAINTAIN = 'black-emperor.s1.effect-maintenance' as const;
const POS: Record<PrinceOfAbolitionLocation, number> = { START: 0, A: 4, B: 8, C: 8, OUTSIDE: -4, ANNEX: -8, RECEIVER: -12, YARD: -8 };
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 1;
const freshCase = (): PrinceOfAbolitionLifeCase => ({ status: 'AVAILABLE', observedWeek: null, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED', COOPERATION: 'UNASKED' }, permissionWeek: { OWNER: null, ABILITY: null, COOPERATION: null }, permissionVersion: 0, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createPrinceOfAbolitionLifeState(): PrinceOfAbolitionLifeState { return { sourceWeek: null, activeCase: null, reflected: false, site: createFrenzyMageLifeState(), operation: createEntropyDukeLifeState().operation, annex: null, cooperationEffortSpent: 0, volunteerMindSpent: 0, conditionVersion: 0, viewBlocked: false, pieces: [], pending: null, flight: null, cases: { 'directed-throw': freshCase(), 'maintained-flight': freshCase(), 'withdrawn-input': freshCase() }, journal: [] }; }
const freshLife = (week: number, originals: PrinceOfAbolitionOriginals): PrinceOfAbolitionLifeState => ({ ...createPrinceOfAbolitionLifeState(), sourceWeek: week, site: structuredClone(originals.site), operation: structuredClone(originals.operation) });
const originalsReturned = (p: PrinceOfAbolitionSite) => p.guide.location === 'OUTSIDE' && p.volunteer.location === 'OUTSIDE' && p.parcel.holder === 'GUIDE' && p.parcel.location === 'OUTSIDE' && p.ball.holder === 'GUIDE' && p.ball.location === 'OUTSIDE' && p.paper.holder === 'GUIDE' && p.paper.location === 'OUTSIDE';
const closedSite = (p: PrinceOfAbolitionSite) => p.playerLocation === 'OUTSIDE' && originalsReturned(p);
const sourceClosed = (p: PrinceOfAbolitionSite) => p.playerLocation === 'START' && originalsReturned(p) && p.activeCase === null && Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned);
export function initializePrinceOfAbolitionLifeState(s: SliceState): void {
  const originals = s.princeOfAbolition.sourceScene?.originals;
  if (!active(s) || !originals || !same(originals.site, s.frenzyMage.life) || !same(originals.operation, s.entropyDuke.life.operation) || !sourceClosed(originals.site) || originals.operation.inputActive || originals.operation.flight !== null || !same(s.princeOfAbolition.life, createPrinceOfAbolitionLifeState())) throw new Error('须只继承一次实际原室和已经结束的旧操作。');
  s.princeOfAbolition.life = freshLife(s.week, originals);
}
export const getPrinceOfAbolitionCurrentSite = (s: SliceState): PrinceOfAbolitionSite => s.princeOfAbolition.life.sourceWeek === null ? s.princeOfAbolition.sourceScene?.originals.site ?? s.frenzyMage.life : s.princeOfAbolition.encounter.currentSite ?? s.princeOfAbolition.life.site;
const projectedSite = (s: SliceState): PrinceOfAbolitionSite => s.princeOfAbolition.life.sourceWeek === null ? s.princeOfAbolition.sourceScene?.originals.site ?? s.frenzyMage.life : getPrinceOfAbolitionCurrentSite(s);
const current = (l: PrinceOfAbolitionLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const pieceFor = (l: PrinceOfAbolitionLifeState, id: PrinceOfAbolitionCaseId) => l.pieces.find(p => p.caseId === id);
const locked = (l: PrinceOfAbolitionLifeState) => l.activeCase !== null || l.pending !== null || l.flight !== null || PRINCE_OF_ABOLITION_CASE_IDS.some(id => l.cases[id].status === 'OBSERVED');
export const hasPrinceOfAbolitionLifeLock = (s: SliceState) => !!s.princeOfAbolition?.life && locked(s.princeOfAbolition.life);
export const princeOfAbolitionLifeClosed = (s: SliceState) => !hasPrinceOfAbolitionLifeLock(s) && closedSite(s.princeOfAbolition.life.site) && !s.princeOfAbolition.life.viewBlocked && PRINCE_OF_ABOLITION_CASE_IDS.every(id => s.princeOfAbolition.life.cases[id].status === 'RESOLVED');
export function validatePrinceOfAbolitionActivityCommand(v: unknown): v is PrinceOfAbolitionActivityCommand {
  if (!record(v)) return false;
  if (['EXIT_ROOM', 'BUY_ANNEX', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!PRINCE_OF_ABOLITION_CASE_IDS.includes(v.caseId as PrinceOfAbolitionCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY', 'COOPERATION'].includes(String(v.permission));
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isPrinceOfAbolitionActivityCommand = validatePrinceOfAbolitionActivityCommand;
const isPower = (c: PrinceOfAbolitionActivityCommand) => c.type === 'DIRECTED_AMPLIFICATION' || c.type === 'EFFECT_MAINTENANCE';
const isChecked = (c: PrinceOfAbolitionActivityCommand) => isPower(c) || c.type === 'THROW_BALL';
function pendingUsable(l: PrinceOfAbolitionLifeState, id: PrinceOfAbolitionCaseId): boolean {
  const w = l.pending, r = l.cases[id], a = r.attempts[0], p = l.site;
  return !!w && w.caseId === id && w.expiresAt > p.clockSeconds && p.playerLocation === 'ANNEX' && p.ball.holder === 'PLAYER' && p.ball.location === 'ANNEX' && !l.viewBlocked &&
    w.permissionVersion === r.permissionVersion && w.conditionVersion === l.conditionVersion && r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' && r.permission.COOPERATION === 'GRANTED' &&
    w.actionId === a?.actionId && !a.thrown && !a.stopped && pieceFor(l, id)?.id === w.pieceId;
}
function localBlock(l: PrinceOfAbolitionLifeState, c: PrinceOfAbolitionActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'EXIT_ROOM') return !locked(l) && p.playerLocation === 'START' && originalsReturned(p) ? null : '须由本人沿原门路实际走四米到室外。';
  if (c.type === 'BUY_ANNEX') return !locked(l) && closedSite(p) && !l.annex ? null : '先真实走出原室；新接球小区和软垫只购买并放置一次。';
  if (c.type === 'REFLECT') return !locked(l) && closedSite(p) && !l.reflected && PRINCE_OF_ABOLITION_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三案实际归还和报告。';
  if (!('caseId' in c)) return '本案命令缺少场次。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], piece = pieceFor(l, id), index = PRINCE_OF_ABOLITION_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && closedSite(p) && !!l.annex && r.status === 'AVAILABLE' && (index === 0 || ['RESOLVED', 'CANCELLED'].includes(l.cases[PRINCE_OF_ABOLITION_CASE_IDS[index - 1]!].status)) ? null : '先在室外付费布置独立接球小区并收尾前案。';
  if (c.type === 'CONSENT') return !a && r.status === 'OBSERVED' && closedSite(p) && r.permission[c.permission] === 'UNASKED' && p.volunteer.alive && p.volunteer.willing ? null : '须逐项重新取得本案原物、具体能力和本人协作许可。';
  if (c.type === 'WITHDRAW_CONSENT' && !a && r.status === 'OBSERVED') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '已经撤回的许可不能重置。';
  if (c.type === 'ABORT' && !a && r.status === 'OBSERVED' && closedSite(p)) return null;
  if (c.type === 'PREPARE' || c.type === 'START_ORDINARY') return !a && r.status === 'OBSERVED' && closedSite(p) && !!l.annex && r.permission.OWNER === 'GRANTED' && r.permission.COOPERATION === 'GRANTED' && r.permissionWeek.OWNER === week && r.permissionWeek.COOPERATION === week &&
    (c.type === 'START_ORDINARY' || c.type === 'PREPARE' && c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED' && r.permissionWeek.ABILITY === week) ? null : '先取得当周原物和达里安本人的协作许可；普通方法不要求购买耗材或能力许可。';
  if (c.type === 'REPORT') return !locked(l) && closedSite(p) && r.status === 'EXAMINED' && a?.closed && a.verified && a.returned && !l.viewBlocked ? null : '真实落球、亲取和归还后才能报告；取消不领取成果。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周正在进行的同一场次，旧动作不能再演。';
  if (c.type === 'WITHDRAW_CONSENT') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '已撤回的许可不会恢复。';
  if (c.type === 'WAIT_FLIGHT') return l.flight ? null : '只等待这次已经投出的原球；不能生成另一次投球。';
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已停止新输入；既有轨迹仍继续。';
  if (c.type === 'WAIT_10') return l.pending && a.waits < 2 ? null : '只可等待当前二十秒窗口，不刷新。';
  if (c.type === 'OCCLUDE') return l.pending && !l.viewBlocked ? null : '须有尚未使用的加成窗口。';
  if (c.type === 'RESTORE_VIEW') return l.viewBlocked ? null : '视线已经通畅。';
  if (c.type === 'ABORT') return l.flight ? '先真实等到已投出的原球落下，再普通取回。' : null;
  if (c.type === 'WALK_TO_RECEIVER') return p.playerLocation === 'ANNEX' && (a.landed && p.ball.holder === 'PAD' || !!l.pending) ? null : '先等原球实际落在新接球垫，或走动结束未用窗口。';
  if (c.type === 'RETRIEVE_BALL') return p.playerLocation === 'RECEIVER' && p.ball.location === 'RECEIVER' && p.ball.holder === 'PAD' && a.landed && !a.retrieved ? null : '须亲自站在实际落点旁，取回同一只球。';
  if (c.type === 'RETURN_TO_ANNEX') return p.playerLocation === 'RECEIVER' && p.ball.holder !== 'PAD' && !l.flight ? null : '先拾回落在此处的原球，再走四米返回。';
  if (c.type === 'RETURN_TO_OUTSIDE') return p.playerLocation === 'ANNEX' && !l.flight && p.ball.holder !== 'PAD' ? null : '球落地后须亲自取回，再沿四米路回原主处。';
  if (c.type === 'RETURN_OBJECTS') return p.playerLocation === 'OUTSIDE' && p.guide.location === 'OUTSIDE' && p.ball.holder === 'PLAYER' && p.paper.holder === 'PLAYER' && !l.flight ? null : '须本人携原球和同一原纸实际回到米蕾身旁。';
  if (c.type === 'LEAVE') return closedSite(p) && !l.flight && !l.pending && !l.viewBlocked && (a.returned || !a.ballTaken) ? null : '先普通归还原球和原纸，实际回到室外。';
  if (a.verified) return '本案唯一投球已经完成，只能普通收尾。';
  if (r.permission.OWNER !== 'GRANTED' || r.permission.COOPERATION !== 'GRANTED' || !p.volunteer.willing) return '当前许可已停止；仍可等待、拾回和归还原物。';
  if (c.type === 'WALK_TO_ANNEX') return p.playerLocation === 'OUTSIDE' && a.ballTaken && !a.thrown ? null : '先在室外向原主亲取原球和原纸，再走四米进入新小区。';
  if (c.type === 'TAKE_BALL') return p.playerLocation === 'OUTSIDE' && originalsReturned(p) && !a.ballTaken ? null : '须本人站在室外原主旁，亲取唯一原球和原纸。';
  if (c.type === 'INSPECT') return p.playerLocation === 'ANNEX' && !a.inspected && !!l.annex && l.cooperationEffortSpent + 3 <= 9 && p.volunteer.mind >= 1 ? null : '须亲到新小区检查空垫和四米轨迹；协作耗力和精神实付且有限。';
  if (p.playerLocation !== 'ANNEX' || !a.inspected || l.viewBlocked || p.paper.holder !== 'PLAYER' || p.paper.location !== 'ANNEX') return '须在新小区亲读同一原纸、检查新接球垫并保持视线。';
  if (c.type === 'PREPARE_ACTION') return !a.actionId && !a.thrown && p.ball.holder === 'PLAYER' && p.ball.location === 'ANNEX' ? null : '仅明确本人尚未执行的一次投球，不改原纸或旧动作。';
  if (c.type === 'THROW_BALL') return !!a.actionId && !a.thrown && p.ball.holder === 'PLAYER' && (id !== 'withdrawn-input' || a.method === 'ORDINARY' || a.withdrawn) ? null : '只实际投出本案原球一次；撤回案先撤回能力许可。';
  if (isPower(c)) {
    if (a.method !== 'ABILITY' || a.stopped || a.castTier !== null || !piece || piece.charges !== 1 || r.permission.ABILITY !== 'GRANTED' || r.permissionWeek.ABILITY !== week) return '须新鲜具体许可和本案唯一未用耗材；失败也不能重施。';
    if (c.type === 'DIRECTED_AMPLIFICATION') return id !== 'maintained-flight' && !!a.actionId && !a.thrown && p.ball.holder === 'PLAYER' ? null : '只增强本人明确但尚未执行的一次投球。';
    return id === 'maintained-flight' && !!l.flight && l.flight.caseId === id && l.flight.landsAt > p.clockSeconds && !l.flight.maintenanceApplied && p.ball.holder === 'AIRBORNE' ? null : '必须是本人刚投出、仍在途且尚未结束的同一原球；旧轨迹不能恢复。';
  }
  return '当前不能进行这一步。';
}
function cost(c: PrinceOfAbolitionActivityCommand): PrinceOfAbolitionLifeCost { return { actions: ['BUY_ANNEX', 'OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, pennies: c.type === 'BUY_ANNEX' ? 40 : c.type === 'PREPARE' ? 20 : 0, spirituality: isPower(c) ? 8 : 0, mind: isPower(c) ? 2 : 0, cooperationEffort: 0, volunteerMind: 0, pieceCharges: 0 }; }
function validBudget(b: PrinceOfAbolitionEncounterBudget): boolean { return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'gifts']) && integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 && integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) && Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk) && Array.isArray(b.gifts); }
interface Audit { date: PublicGameDate; revision: number; finance: PrinceOfAbolitionFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const checkBaseFor = (c: PrinceOfAbolitionActivityCommand, b: PrinceOfAbolitionEncounterBudget) => isPower(c) ? b.coreStats.knowledge : c.type === 'THROW_BALL' ? b.coreStats.physique : null;
const modifiersFor = (l: PrinceOfAbolitionLifeState, c: PrinceOfAbolitionActivityCommand) => c.type === 'THROW_BALL' && pendingUsable(l, c.caseId) ? [{ source: AMPLIFY, value: 35 }] : [];
const audit = (s: SliceState, c: PrinceOfAbolitionActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, finance: princeOfAbolitionFinanceSnapshot(s), randomCursor: s.random.cursor, randomBefore: isChecked(c) ? s.random.cursor : null, randomAfter: null, checkBase: checkBaseFor(c, princeOfAbolitionEncounterBudget(s)), check: null });
function transition(initial: PrinceOfAbolitionLifeState, c: PrinceOfAbolitionActivityCommand, week: number, before: PrinceOfAbolitionEncounterBudget, clock: Audit) {
  if (!validatePrinceOfAbolitionActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(c), after = structuredClone(before);
  if (isPower(c) && !success(clock.check?.tier ?? null)) paid.mind = 4;
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < (isPower(c) ? 4 : paid.mind)) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null; let a = r?.attempts[0] ?? null;
  const source: PrinceOfAbolitionLifeSource | null = id ? { caseId: id, at: p.clockSeconds, location: p.playerLocation, ball: structuredClone(p.ball), paper: structuredClone(p.paper), permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion, piece: structuredClone(pieceFor(l, id) ?? null), pending: structuredClone(l.pending), flight: structuredClone(l.flight) } : null;
  const receipt: PrinceOfAbolitionLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome: clock.check?.tier ?? null, before: structuredClone(before), after, paid, elapsedSeconds: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), operationBefore: structuredClone(l.operation), operationAfter: structuredClone(l.operation), source };
  const clear = (why: PrinceOfAbolitionAttempt['windowEnd']) => { if (l.pending && a) a.windowEnd = why; l.pending = null; };
  const changed = (why: PrinceOfAbolitionAttempt['windowEnd']) => { clear(why); l.conditionVersion++; };
  const tick = (seconds: number) => {
    p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds;
    if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED');
    if (l.flight) {
      const f = l.flight;
      f.positionMm = Math.min(4000, f.segmentStartMm + Math.floor((4000 - f.segmentStartMm) * Math.max(0, p.clockSeconds - f.segmentStartAt) / (f.landsAt - f.segmentStartAt)));
      if (p.clockSeconds >= f.landsAt) { p.ball.holder = 'PAD'; p.ball.location = 'RECEIVER'; a!.landed = true; l.flight = null; }
    }
  };
  const move = (to: PrinceOfAbolitionLocation, extraItems: string[] = []) => {
    changed('MOVED'); const from = p.playerLocation, metres = Math.abs(POS[to] - POS[from]), items = [...extraItems];
    p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
    for (const object of [p.ball, p.paper]) if (object.holder === 'PLAYER') { object.location = to; items.push(object.id); }
    const piece = id ? pieceFor(l, id) : null; if (piece?.location === 'HAND') { piece.travelMetres += metres; items.push(piece.id); }
    receipt.moves.push({ actorId: 'PLAYER', from, to, metres, seconds: metres, itemIds: items }); tick(metres);
  };
  const retrieve = () => { p.ball.holder = 'PLAYER'; a!.retrieved = true; a!.verified = true; changed('MOVED'); tick(1); };
  const returnObjects = () => { p.ball.holder = 'GUIDE'; p.ball.location = 'OUTSIDE'; p.ball.returns++; p.paper.holder = 'GUIDE'; p.paper.location = 'OUTSIDE'; a!.returned = true; r!.returned = true; tick(1); };
  const close = () => {
    clear('STOPPED'); l.viewBlocked = false; const piece = pieceFor(l, id!); if (piece) piece.location = 'RETURNED';
    a!.closed = true; a!.returned = true; r!.returned = true; a!.result = a!.verified ? a!.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY' : 'NONE'; r!.result = a!.result;
    r!.status = a!.verified ? 'EXAMINED' : 'CANCELLED'; r!.contactOpen = false; for (const key of ['OWNER', 'ABILITY', 'COOPERATION'] as const) if (r!.permission[key] === 'GRANTED') r!.permission[key] = 'CLOSED';
    a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  switch (c.type) {
    case 'EXIT_ROOM': move('OUTSIDE'); break;
    case 'BUY_ANNEX':
      l.annex = { id: 'PA1-ANNEX', paidPennies: 40, boughtWeek: week, surface: { id: 'PA1-RECEIVER', location: 'RECEIVER', padded: true, people: 0, placed: true, inspections: 0 } };
      move('ANNEX', ['PA1-RECEIVER']); move('RECEIVER', ['PA1-RECEIVER']); tick(2); move('ANNEX'); move('OUTSIDE'); break;
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionWeek[c.permission] = week; r!.permissionVersion++; tick(1); break;
    case 'PREPARE':
    case 'START_ORDINARY': {
      const method: Method = c.type === 'PREPARE' ? c.method : 'ORDINARY', pieceId = c.type === 'PREPARE' ? `PA1-PIECE-${PRINCE_OF_ABOLITION_CASE_IDS.indexOf(id!) + 1}` : null;
      if (pieceId) l.pieces.push({ id: pieceId, caseId: id!, ownerId: 'PLAYER', quantity: 1, location: 'HAND', charges: 1, wear: 0, paidPennies: 20, boughtWeek: week, travelMetres: 0 });
      a = { week, method, closed: false, stopped: false, returned: false, withdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, cooperationEffortSpent: 0, volunteerMindSpent: 0, penniesSpent: pieceId ? 20 : 0, pieceId, inspected: false, ballTaken: false, actionId: null, thrown: false, landed: false, retrieved: false, verified: false, castTier: null, throwTier: null, amplification: 0, maintenanceSeconds: 0, appliedAbilityIds: [], waits: 0, windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = id; tick(2); break;
    }
    case 'TAKE_BALL': p.ball.holder = 'PLAYER'; p.paper.holder = 'PLAYER'; a!.ballTaken = true; changed('MOVED'); tick(1); break;
    case 'WALK_TO_ANNEX': move('ANNEX'); break;
    case 'INSPECT': a!.inspected = true; a!.cooperationEffortSpent = 3; a!.volunteerMindSpent = 1; l.cooperationEffortSpent += 3; l.volunteerMindSpent++; p.volunteer.mind--; paid.cooperationEffort = 3; paid.volunteerMind = 1; l.annex!.surface.inspections++; tick(2); break;
    case 'PREPARE_ACTION': a!.actionId = `PA1-${id}-OWN-THROW`; tick(1); break;
    case 'DIRECTED_AMPLIFICATION':
    case 'EFFECT_MAINTENANCE': {
      const piece = pieceFor(l, id!)!; piece.charges = 0; piece.wear = 1; paid.pieceCharges = 1; a!.castTier = clock.check!.tier; a!.spiritualitySpent += paid.spirituality; a!.mindSpent += paid.mind;
      if (!success(clock.check!.tier)) { a!.windowEnd = 'FAILED'; tick(1); break; }
      if (c.type === 'DIRECTED_AMPLIFICATION') { l.pending = { abilityId: AMPLIFY, caseId: id!, pieceId: piece.id, objectId: p.ball.id, actionId: a!.actionId!, actorId: 'PLAYER', location: 'ANNEX', permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion, createdAt: p.clockSeconds + 1, expiresAt: p.clockSeconds + 21 }; a!.windowEnd = 'ACTIVE'; }
      else {
        const f = l.flight!; f.segmentStartMm = f.positionMm; f.segmentStartAt = p.clockSeconds; f.landsAt += 20; f.maintenanceApplied = true;
        a!.maintenanceSeconds = 20; a!.appliedAbilityIds.push(MAINTAIN); a!.windowEnd = 'APPLIED';
      }
      tick(1); break;
    }
    case 'THROW_BALL': {
      const amplified = pendingUsable(l, id!); a!.amplification = amplified ? 35 : 0; if (amplified) a!.appliedAbilityIds.push(AMPLIFY); clear(amplified ? 'APPLIED' : 'STOPPED');
      a!.thrown = true; a!.throwTier = clock.check!.tier; p.ball.throws++; p.ball.holder = 'AIRBORNE'; p.ball.location = 'ANNEX';
      l.flight = { id: `${a!.actionId}-FLIGHT`, caseId: id!, objectId: p.ball.id, actorId: 'PLAYER', from: 'ANNEX', to: 'RECEIVER', distanceMm: 4000, launchedAt: p.clockSeconds, originalLandAt: p.clockSeconds + 4, landsAt: p.clockSeconds + 4, segmentStartAt: p.clockSeconds, segmentStartMm: 0, positionMm: 0, amplificationApplied: amplified, maintenanceApplied: false };
      // Launch is an instantaneous physical boundary; the next explicit wait, movement or cast advances it.
      break;
    }
    case 'WAIT_FLIGHT': a!.waits++; tick(Math.min(10, l.flight!.landsAt - p.clockSeconds)); break;
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'WALK_TO_RECEIVER': move('RECEIVER'); break;
    case 'RETRIEVE_BALL': retrieve(); break;
    case 'RETURN_TO_ANNEX': move('ANNEX'); break;
    case 'RETURN_TO_OUTSIDE': clear('STOPPED'); move('OUTSIDE'); break;
    case 'RETURN_OBJECTS': clear('STOPPED'); returnObjects(); break;
    case 'LEAVE': close(); tick(1); break;
    case 'WITHDRAW_CONSENT': r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++; if (a) { a.withdrawn = true; a.stopped = true; } changed('WITHDRAWN'); tick(1); break;
    case 'STOP_METHOD': a!.stopped = true; changed('STOPPED'); tick(1); break;
    case 'OCCLUDE': l.viewBlocked = true; changed('OCCLUDED'); tick(1); break;
    case 'RESTORE_VIEW': l.viewBlocked = false; changed('OCCLUDED'); tick(1); break;
    case 'ABORT':
      if (!a) { r!.status = 'CANCELLED'; r!.returned = true; for (const key of ['OWNER', 'ABILITY', 'COOPERATION'] as const) if (r!.permission[key] === 'GRANTED') r!.permission[key] = 'CLOSED'; tick(1); break; }
      a.stopped = true; changed('STOPPED'); l.viewBlocked = false;
      if (p.ball.holder === 'PAD') { if (p.playerLocation !== 'RECEIVER') move('RECEIVER'); retrieve(); }
      if (p.playerLocation === 'RECEIVER') move('ANNEX'); if (p.playerLocation === 'ANNEX') move('OUTSIDE');
      if (p.ball.holder === 'PLAYER') returnObjects(); close(); tick(1); break;
    case 'REPORT': {
      const marker = `prince-of-abolition-case:${id}`; if (after.completedSources.includes(marker)) return null; r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const abilityId of a!.appliedAbilityIds) after.mastery[abilityId] = Math.min(500, (after.mastery[abilityId] ?? 0) + 8); tick(4); break;
    }
    case 'REFLECT': if (after.completedSources.includes('prince-of-abolition-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('prince-of-abolition-reflection'); tick(4); break;
  }
  receipt.siteAfter = structuredClone(p); receipt.operationAfter = structuredClone(l.operation);
  if (!validBudget(after) || l.cooperationEffortSpent > 9 || l.volunteerMindSpent > 3) return null;
  return { life: l, receipt };
}
/** This guard permits only actual mutable positions/counters and recorded new collaboration cost. All predecessor history stays byte-for-byte intact. */
export function validatePrinceOfAbolitionCurrentSite(v: unknown, originals: PrinceOfAbolitionOriginals): v is PrinceOfAbolitionSite {
  try {
    if (!record(v) || !shape(v, Object.keys(originals.site))) return false;
    const p = v as unknown as PrinceOfAbolitionSite, old = originals.site;
    if (!Object.hasOwn(POS, p.playerLocation) || !integer(p.playerTravelMetres, old.playerTravelMetres) || !integer(p.clockSeconds, old.clockSeconds) || !integer(p.volunteer.mind, old.volunteer.mind - 3, old.volunteer.mind) || !integer(p.ball.throws, old.ball.throws, old.ball.throws + 3) || !integer(p.ball.returns, old.ball.returns, old.ball.returns + 3)) return false;
    if (!same(p, { ...old, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, clockSeconds: p.clockSeconds, volunteer: { ...old.volunteer, mind: p.volunteer.mind }, ball: p.ball, paper: p.paper })) return false;
    if (!same(p.ball, { ...old.ball, location: p.ball.location, holder: p.ball.holder, throws: p.ball.throws, returns: p.ball.returns }) || !same(p.paper, { ...old.paper, location: p.paper.location, holder: p.paper.holder })) return false;
    if (!['GUIDE', 'PLAYER', 'PAD', 'AIRBORNE'].includes(p.ball.holder) || !['GUIDE', 'PLAYER'].includes(p.paper.holder)) return false;
    if (!['OUTSIDE', 'ANNEX', 'RECEIVER', 'YARD'].includes(p.ball.location) || !['OUTSIDE', 'ANNEX', 'RECEIVER', 'YARD'].includes(p.paper.location)) return false;
    if (p.ball.holder === 'GUIDE' && p.ball.location !== p.guide.location || p.paper.holder === 'GUIDE' && p.paper.location !== p.guide.location) return false;
    if (p.ball.holder === 'PLAYER' && p.ball.location !== p.playerLocation || p.paper.holder === 'PLAYER' && p.paper.location !== p.playerLocation) return false;
    return p.ball.holder !== 'PAD' || p.ball.location === 'RECEIVER';
  } catch { return false; }
}
function lifeBoundary(e: PrinceOfAbolitionLifeReceipt, isLocked: boolean) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || isLocked) return { budget, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 }, finance: princeOfAbolitionFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }), week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date, pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function princeOfAbolitionCompletedLifeBudgetMatches(s: SliceState, e: PrinceOfAbolitionLifeReceipt, isLocked = hasPrinceOfAbolitionLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(princeOfAbolitionEncounterBudget(s), expected.budget) || !same(princeOfAbolitionFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) || s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null || (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): PrinceOfAbolitionLifeState | null {
  const life = s.princeOfAbolition.life, source = s.princeOfAbolition.sourceScene;
  if (!source || life.sourceWeek === null) return null;
  let model = freshLife(life.sourceWeek, source.originals), previous: PrinceOfAbolitionLifeReceipt | null = null, lastWeek = life.sourceWeek, cursor = source.random.cursor;
  for (const e of life.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'moves', 'siteBefore', 'siteAfter', 'operationBefore', 'operationAfter', 'source']) || !validatePrinceOfAbolitionActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) || !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) || !integer(e.randomCursor, cursor, s.random.cursor) || !validatePrinceOfAbolitionFinanceSnapshot(e.finance, e.week) || !validBudget(e.before)) return null;
    if (locked(model) && (!previous || e.week !== lastWeek || e.revision !== previous.revision + 1 || !same(e.before, previous.after) || !same(e.finance, previous.finance) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (previous && e.revision === previous.revision + 1) { const expected = lifeBoundary(previous, locked(model)); if (e.week !== expected.week || !same(e.date, expected.date) || !same(e.before, expected.budget) || !same(e.finance, expected.finance) || expected.eventId !== null || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null; }
    if (isChecked(e.command)) {
      if (e.checkBase !== checkBaseFor(e.command, e.before) || !same(e.before.coreStats, s.character.coreStats) || e.checkBase === null || !record(e.check) || e.randomBefore !== e.randomCursor || !integer(e.randomAfter, cursor, s.random.cursor)) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomCursor), expected = resolveNormalCheck({ ability: isPower(e.command) ? 'knowledge' : 'physique', baseAbility: e.checkBase, difficulty: isPower(e.command) ? 18 : 20, modifiers: modifiersFor(model, e.command), roll: random.nextInt(1, 100) });
      if (!same(e.check, expected) || e.outcome !== expected.tier || random.cursor !== e.randomAfter) return null;
    } else if (e.randomBefore !== null || e.randomAfter !== null || e.checkBase !== null || e.check !== null || e.outcome !== null) return null;
    const next = transition(model, e.command, e.week, e.before, { date: e.date, revision: e.revision, finance: e.finance, randomCursor: e.randomCursor, randomBefore: e.randomBefore, randomAfter: e.randomAfter, checkBase: e.checkBase, check: e.check });
    if (!next || !same(next.receipt, e) || !validatePrinceOfAbolitionCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor;
  }
  return model;
}
export function princeOfAbolitionLifeMasteryGains(s: SliceState): Record<PrinceOfAbolitionLifeAbilityId, number> {
  const gains: Record<PrinceOfAbolitionLifeAbilityId, number> = { [AMPLIFY]: 0, [MAINTAIN]: 0 } as Record<PrinceOfAbolitionLifeAbilityId, number>;
  for (const id of PRINCE_OF_ABOLITION_CASE_IDS) { const r = s.princeOfAbolition.life.cases[id]; if (r.status === 'RESOLVED') for (const abilityId of r.attempts[0]!.appliedAbilityIds) gains[abilityId] += 8; }
  return gains;
}
export function validatePrinceOfAbolitionLifeState(s: SliceState): boolean {
  try {
    const life = s.princeOfAbolition?.life, source = s.princeOfAbolition?.sourceScene;
    if (!record(life) || !shape(life, Object.keys(createPrinceOfAbolitionLifeState())) || !record(life.cases) || !shape(life.cases, PRINCE_OF_ABOLITION_CASE_IDS) || !Array.isArray(life.journal) || life.journal.length > 250) return false;
    if (s.princeOfAbolition.promotionWeek === null) return same(life, createPrinceOfAbolitionLifeState());
    if (!source || life.sourceWeek !== s.princeOfAbolition.promotionWeek || !same(source.originals.site, s.frenzyMage.life) || !same(source.originals.operation, s.entropyDuke.life.operation) || !sourceClosed(source.originals.site) || !validatePrinceOfAbolitionCurrentSite(life.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(life, replay)) return false;
    const gains = princeOfAbolitionLifeMasteryGains(s); let acting = life.reflected ? 25 : 0;
    for (const id of PRINCE_OF_ABOLITION_CASE_IDS) { const resolved = life.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `prince-of-abolition-case:${id}`).length !== (resolved ? 1 : 0)) return false; if (resolved) acting += 25; }
    if (s.seer.completedSources.filter(x => x === 'prince-of-abolition-reflection').length !== (life.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[AMPLIFY] ?? 0) < gains[AMPLIFY] || (s.progression.mastery[MAINTAIN] ?? 0) < gains[MAINTAIN]) return false;
    const last = life.journal.at(-1), encounter = s.princeOfAbolition.encounter;
    if (locked(life) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.princeOfAbolition.preparedWeek !== null || encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(princeOfAbolitionEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !princeOfAbolitionCompletedLifeBudgetMatches(s, last, locked(life))) return false;
    return true;
  } catch { return false; }
}
export const validatePrinceOfAbolitionLife = validatePrinceOfAbolitionLifeState;
/** One projection may reuse this validity result only while its input is unchanged. */
function blockLifeWithValidity(s: SliceState, c: PrinceOfAbolitionActivityCommand, validLife: boolean): string | null {
  if (!validatePrinceOfAbolitionActivityCommand(c)) return '有限投球实践命令无效或含多余字段。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已实际晋升弑序亲王。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.princeOfAbolition.preparedWeek !== null) return '先处理当前事件、战斗或晋升准备，并回到贝克兰德。';
  if (s.princeOfAbolition.encounter.status !== 'AVAILABLE' || s.princeOfAbolition.encounter.preparation !== null) return '现场已交给独立遭遇；已结束实践不能重新开始。';
  if (!validLife) return '原物、真实位置、实付成本或历史收据不一致。';
  const reason = localBlock(s.princeOfAbolition.life, c, s.week); if (reason) return reason;
  const paid = cost(c);
  if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < (isPower(c) ? 4 : paid.mind)) return '行动、费用、灵性或失败所需精神不足；普通取回与退出仍不收费。';
  return null;
}
export function blockPrinceOfAbolitionLife(s: SliceState, c: PrinceOfAbolitionActivityCommand): string | null {
  return blockLifeWithValidity(s, c, validatePrinceOfAbolitionLifeState(s));
}
export const getPrinceOfAbolitionActivityBlock = blockPrinceOfAbolitionLife;
export function applyPrinceOfAbolitionLifeCommand(s: SliceState, c: PrinceOfAbolitionActivityCommand, ctx: SeerContext): void {
  const reason = blockPrinceOfAbolitionLife(s, c); if (reason) throw new Error(reason);
  const clock = audit(s, c), before = princeOfAbolitionEncounterBudget(s);
  if (isChecked(c)) { const ability = isPower(c) ? 'knowledge' : 'physique', difficulty = isPower(c) ? 18 : 20, actual = ctx.check(ability, difficulty); clock.check = resolveNormalCheck({ ability, baseAbility: clock.checkBase!, difficulty, modifiers: modifiersFor(s.princeOfAbolition.life, c), roll: actual.roll }); s.lastCheck = structuredClone(clock.check); clock.randomAfter = s.random.cursor; }
  const next = transition(s.princeOfAbolition.life, c, s.week, before, clock); if (!next) throw new Error('同一原球的有限现场转移失败。');
  s.princeOfAbolition.life = next.life; s.princeOfAbolition.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality; s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(`小区投球实践：${LABELS[c.type]}`, `${clock.check ? `${isPower(c) ? '知识18' : '体魄20'}检定${TIER_LABELS[clock.check.tier]}。` : ''}${isPower(c) ? `实付8灵性、${next.receipt.paid.mind}精神及一件支持片使用次数。` : ''}本人在${LOCATION_LABELS[next.life.site.playerLocation]}，累计时钟${next.life.site.clockSeconds}秒。${c.type === 'THROW_BALL' ? `唯一原球已真实投出；${next.life.flight?.amplificationApplied ? '这一次体魄检定实际得到35加成。' : '本次没有能力加成。'}仍须等球落下、亲手拾回。` : c.type === 'EFFECT_MAINTENANCE' && success(clock.check?.tier ?? null) ? '只将当前未结束轨迹维持二十秒；既有费用和已经过去的时间不变。' : c.type === 'WITHDRAW_CONSENT' ? '指定许可已撤回，未用窗口停止；已投原球照常飞行并只落下一次。' : '原包和成人留在室外，旧B/C空垫仍在原室。'}达里安本阶段协作耗力${next.life.cooperationEffortSpent}/9、精神实耗${next.life.volunteerMindSpent}/3。`);
}
export const applyPrinceOfAbolitionActivity = applyPrinceOfAbolitionLifeCommand;
export const applyPrinceOfAbolitionLife = applyPrinceOfAbolitionLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATION_LABELS: Record<PrinceOfAbolitionLocation, string> = { START: '原室入口', A: '原室A', B: '原室B', C: '原室C', OUTSIDE: '原室外', ANNEX: '新租接球小区起点', RECEIVER: '新购四米接球垫', YARD: '独立邻院' };
const LABELS: Record<PrinceOfAbolitionActivityCommand['type'], string> = {
  EXIT_ROOM: '沿原门路实走四米到室外', BUY_ANNEX: '付费租用小区、搬置一张新接球垫', OBSERVE: '观察原物、成人及新小区的普通退路', CONSENT: '询问本案当前许可', WITHDRAW_CONSENT: '拒绝或撤回指定许可', PREPARE: '购买本案唯一支持片', START_ORDINARY: '不用支持片，开始普通投球',
  TAKE_BALL: '在室外向米蕾亲取原球和原纸', WALK_TO_ANNEX: '携原球和原纸实走四米到新小区', INSPECT: '检查新空垫、亲读原纸并确认当前协作', PREPARE_ACTION: '明确本人尚未执行的一次投球', DIRECTED_AMPLIFICATION: '定向放大本人下一次投球', THROW_BALL: '实际投出同一只球一次', EFFECT_MAINTENANCE: '维持本人当前未结束的在途作用二十秒', WAIT_FLIGHT: '实际等待原球继续飞行，最多十秒', WAIT_10: '实际等待十秒，不续窗口',
  WALK_TO_RECEIVER: '实走四米到新接球垫', RETRIEVE_BALL: '亲核落点并取回同一只原球', RETURN_TO_ANNEX: '带原球实走四米回小区起点', RETURN_TO_OUTSIDE: '携原物实走四米回到室外', RETURN_OBJECTS: '向米蕾亲还原球和同一原纸', LEAVE: '确认实际退出并结束接触', ABORT: '停止新输入、普通拾回归还并退出', REPORT: '报告本案真实结果', REFLECT: '反思三案的有限作用和真实代价', STOP_METHOD: '停止新的能力输入', OCCLUDE: '用自己的手遮挡视线', RESTORE_VIEW: '移开自己的手，恢复视线',
};
const CASES: { id: PrinceOfAbolitionCaseId; title: string; story: string }[] = [
  { id: 'directed-throw', title: '本人下一次真实投球', story: '原球仍是米蕾的一只80克软球，原纸仍写“从A到B”。在新小区亲核四米空轨迹，明确本人待执行动作。成功放大只给这一次体魄20投球检定加35，实际投出后才算使用；检定仍保留真实成败。' },
  { id: 'maintained-flight', title: '仍未结束的本人在途作用', story: '先真实投出同一原球，原本四秒落在新软垫。只有它仍在途时，才能尝试把这一未结束作用维持二十秒；已经结束的旧投球和旧能力不能恢复。必须真实等候、走到落点拾球并交还。' },
  { id: 'withdrawn-input', title: '撤回当前许可后普通完成', story: '尝试准备一次放大后，实际撤回本案能力许可。未用加成立即失效，原球随后普通投出、落地、拾回；成功准备不冒充实际应用，也不领取未用掌握。费用与已经经过的时间保留。' },
];
const CLEANUP: PrinceOfAbolitionActivityCommand['type'][] = ['EXIT_ROOM', 'WITHDRAW_CONSENT', 'WAIT_FLIGHT', 'STOP_METHOD', 'WALK_TO_RECEIVER', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RETURN_OBJECTS', 'LEAVE', 'ABORT', 'RESTORE_VIEW'];
export function princeOfAbolitionLifeActions(s: SliceState): PrinceOfAbolitionLifeAction[] {
  const l = s.princeOfAbolition.life, out: PrinceOfAbolitionLifeAction[] = [], validLife = validatePrinceOfAbolitionLifeState(s);
  const add = (command: PrinceOfAbolitionActivityCommand) => {
    const reason = blockLifeWithValidity(s, command, validLife), paid = cost(command);
    const permission = 'permission' in command ? { OWNER: '米蕾的原物与普通操作', ABILITY: '本案具体能力', COOPERATION: '达里安本人的有限协作' }[command.permission] : null;
    out.push({ id: `PA1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : ''}`, label: LABELS[command.type] + (permission ? `（${permission}）` : command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : ''), cost: [`${paid.actions}行动`, ...(paid.pennies ? [`${paid.pennies}便士，不退费`] : []), ...(command.type === 'BUY_ANNEX' ? ['本人搬垫实走16米，不移动原球或旧B/C垫'] : []), ...(isPower(command) ? ['8灵性、2精神，失败总4精神；知识18', '消耗本案一片支持片，不能重施', command.type === 'DIRECTED_AMPLIFICATION' ? '20秒内本人一次待执行体魄动作+35' : '只维持当前未结束作用20秒'] : []), ...(command.type === 'INSPECT' ? ['达里安实际1精神、本阶段协作耗力3'] : []), ...(command.type === 'THROW_BALL' ? ['体魄20；落球与检定成败分别记录'] : []), ...(command.type === 'WAIT_FLIGHT' ? ['实际等候最多10秒，轨迹只结算一次'] : [])].join(' · '), enabled: reason === null, reason, command, cleanup: CLEANUP.includes(command.type) });
  };
  if (l.site.playerLocation === 'START' && !locked(l)) add({ type: 'EXIT_ROOM' });
  else if (!l.annex && !locked(l)) add({ type: 'BUY_ANNEX' });
  else {
    const id = l.activeCase ?? PRINCE_OF_ABOLITION_CASE_IDS.find(key => !['RESOLVED', 'CANCELLED'].includes(l.cases[key].status));
    if (!id) { if (!l.reflected && PRINCE_OF_ABOLITION_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) add({ type: 'REFLECT' }); }
    else {
      const r = l.cases[id], a = r.attempts[0];
      if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
      if (r.status === 'OBSERVED') {
        for (const permission of ['OWNER', 'COOPERATION', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED') add({ type: 'CONSENT', caseId: id, permission });
        add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'START_ORDINARY', caseId: id });
        for (const permission of ['OWNER', 'ABILITY', 'COOPERATION'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
        add({ type: 'ABORT', caseId: id });
      }
      if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
      if (a && r.contactOpen) {
        for (const type of STEPS) if (!['OBSERVE', 'START_ORDINARY', 'REPORT', 'ABORT'].includes(type) && localBlock(l, { type, caseId: id }, s.week) === null) add({ type, caseId: id });
        for (const permission of ['OWNER', 'ABILITY', 'COOPERATION'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
        add({ type: 'ABORT', caseId: id });
      }
    }
  }
  const choose = (type: PrinceOfAbolitionActivityCommand['type']) => out.find(v => v.enabled && v.command.type === type), a = current(l), r = l.activeCase ? l.cases[l.activeCase] : null;
  let preferred: PrinceOfAbolitionLifeAction | undefined;
  if (l.flight) preferred = choose('EFFECT_MAINTENANCE') ?? choose('WAIT_FLIGHT');
  if (a && !a.verified) {
    if (l.viewBlocked) preferred ??= choose('RESTORE_VIEW');
    if (r!.permission.OWNER !== 'GRANTED' || r!.permission.COOPERATION !== 'GRANTED') preferred ??= choose('ABORT');
    // At the actual prepared-action boundary an unavailable cast must not send
    // the player back and forth between the annex and outside. A viable cast
    // still comes first; otherwise withdraw its permission and finish normally.
    if (l.activeCase === 'withdrawn-input' && a.method === 'ABILITY' && !a.withdrawn &&
      (a.castTier !== null || a.actionId !== null && !a.thrown && l.site.playerLocation === 'ANNEX' && !choose('DIRECTED_AMPLIFICATION')))
      preferred ??= out.find(v => v.enabled && v.command.type === 'WITHDRAW_CONSENT' && v.command.permission === 'ABILITY');
    preferred ??= choose('DIRECTED_AMPLIFICATION') ?? choose('THROW_BALL') ?? choose('TAKE_BALL') ?? choose('WALK_TO_ANNEX') ?? choose('INSPECT') ?? choose('PREPARE_ACTION');
    if (a.landed) preferred ??= choose('WALK_TO_RECEIVER') ?? choose('RETRIEVE_BALL');
    if (!preferred && l.site.playerLocation === 'RECEIVER') preferred = choose('RETURN_TO_ANNEX');
  }
  if (a?.verified) preferred ??= choose('RETURN_TO_ANNEX') ?? choose('RETURN_TO_OUTSIDE') ?? choose('RETURN_OBJECTS') ?? choose('LEAVE');
  preferred ??= out.find(v => v.enabled && ![...CLEANUP, 'WAIT_10', 'OCCLUDE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'OCCLUDE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled);
  if (preferred) preferred.preferredAction = true;
  return out;
}
function publicAttempt(a: PrinceOfAbolitionAttempt): PrinceOfAbolitionAttemptProjection {
  return { method: a.method, closed: a.closed, stopped: a.stopped, returned: a.returned, withdrawn: a.withdrawn, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, cooperationEffortSpent: a.cooperationEffortSpent, volunteerMindSpent: a.volunteerMindSpent, penniesSpent: a.penniesSpent, thrown: a.thrown, landed: a.landed, verified: a.verified, castTier: a.castTier, throwTier: a.throwTier, amplification: a.amplification, maintenanceSeconds: a.maintenanceSeconds, appliedAbilityIds: [...a.appliedAbilityIds], result: a.result };
}
export function projectPrinceOfAbolitionLife(s: SliceState): PrinceOfAbolitionLifeProjection {
  const l = s.princeOfAbolition.life, p = projectedSite(s), actions = princeOfAbolitionLifeActions(s), preferred = actions.find(a => a.preferredAction) ?? actions.find(a => a.enabled), op = l.sourceWeek === null ? s.princeOfAbolition.sourceScene?.originals.operation ?? s.entropyDuke.life.operation : l.operation;
  const label = (location: PrinceOfAbolitionLocation) => LOCATION_LABELS[location], holder = { GUIDE: '米蕾', PLAYER: '本人', PAD: '新接球垫', AIRBORNE: '仍在空中' }[p.ball.holder];
  return { title: '新接球小区的有限放大与维持', story: '从原室实际走到米蕾和42岁的达里安所在室外。另付40便士租小区并搬置新软垫；每案支持片20便士，也可以不买支持片普通完成。原球和原纸必须亲取、实走、实投、等候、拾回和归还。', source: '同一米蕾、达里安、唯一原包、原球与原纸继续保留；本阶段只记真实发生的协作耗力和精神消耗。', environment: '原入口到室外4米；室外到新小区4米，新起点到新接球垫4米。原室B/C旧垫仍在室内，不作为新垫。每个新支持片只有一次施术机会，成败均实耗；未用窗口过期、遮挡、走动或撤许可即失效。已投原球仍须落下一次，费用和过去时间不能倒退。', nextStep: preferred?.label ?? (l.reflected ? '三案已真实收尾，可自行决定是否前往独立邻院。' : !locked(l) && closedSite(p) ? '本人已在室外，可自由离开；没有必须购买的后续操作。' : '当前没有待执行的投球操作。'), preferredActionId: preferred?.id ?? null, activeCase: l.activeCase, inside: hasPrinceOfAbolitionLifeLock(s), insideCase: hasPrinceOfAbolitionLifeLock(s), reflected: l.reflected,
    site: { playerLocation: label(p.playerLocation), guide: `${p.guide.name}在${label(p.guide.location)}，仍为原物主人。`, volunteer: `${p.volunteer.name}，${p.volunteer.age}岁，在${label(p.volunteer.location)}；健康${p.volunteer.health}，精神${p.volunteer.mind}。`, parcel: `原400克封包1件，米蕾所有，${p.parcel.holder === 'GUIDE' ? '米蕾' : '达里安'}持有，在${label(p.parcel.location)}。`, ball: `原80克软球1只，米蕾所有，${holder}，在${label(p.ball.location)}；累计实投${p.ball.throws}次、归还${p.ball.returns}次。`, paper: `原纸1张，米蕾所有，${p.paper.holder === 'GUIDE' ? '米蕾' : '本人'}持有，在${label(p.paper.location)}；原文仍为“${p.paper.text}”。`, pads: p.pads.map(pad => `原${pad.location}空软垫仍在原室${pad.location}，${pad.people}人，未搬作新接球面。`) },
    operation: { door: op.door, inputActive: op.inputActive, flightActive: op.flight !== null }, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres,
    annex: l.annex ? { id: l.annex.id, paidPennies: l.annex.paidPennies, boughtWeek: l.annex.boughtWeek, surface: { id: l.annex.surface.id, location: l.annex.surface.location, padded: l.annex.surface.padded, people: l.annex.surface.people, placed: l.annex.surface.placed, inspections: l.annex.surface.inspections } } : null,
    cooperationEffortSpent: l.cooperationEffortSpent, volunteerMindSpent: l.volunteerMindSpent, viewBlocked: l.viewBlocked,
    pieces: l.pieces.map(piece => ({ id: piece.id, caseId: piece.caseId, ownerId: piece.ownerId, quantity: piece.quantity, location: piece.location, charges: piece.charges, wear: piece.wear, paidPennies: piece.paidPennies, boughtWeek: piece.boughtWeek, travelMetres: piece.travelMetres })),
    pending: l.pending ? { abilityId: l.pending.abilityId, remainingSeconds: Math.max(0, l.pending.expiresAt - p.clockSeconds) } : null, pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - p.clockSeconds) : 0,
    flight: l.flight ? { objectId: l.flight.objectId, from: label(l.flight.from), to: label(l.flight.to), positionMetres: l.flight.positionMm / 1000, remainingSeconds: Math.max(0, l.flight.landsAt - p.clockSeconds), maintenanceSeconds: l.flight.maintenanceApplied ? 20 : 0 } : null,
    currentAttempt: current(l) ? publicAttempt(current(l)!) : null,
    cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info, observations: a ? [`本案实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性/${a.mindSpent}精神，本人实走${a.playerTravelMetres}米；达里安本案协作耗力${a.cooperationEffortSpent}、精神实耗${a.volunteerMindSpent}。`, ...(a.castTier ? [`施术检定${TIER_LABELS[a.castTier]}。`] : []), ...(a.throwTier ? [`实际投球检定${TIER_LABELS[a.throwTier]}，实际加成${a.amplification}；这不改变已发生的投球。`] : []), ...(a.maintenanceSeconds ? ['同一未结束轨迹实际延长二十秒。'] : []), ...(a.withdrawn ? ['许可已撤回，未用窗口停止，已经发生的运动仍保留。'] : [])] : [], status: r.status, method: r.method, result: r.status === 'CANCELLED' ? '已普通退出，未完成事件不领取成果。' : r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力已实际应用；投球检定成败另行如实保留。' : '已普通完成，未使用的能力没有掌握奖励。', permission: { OWNER: r.permission.OWNER, ABILITY: r.permission.ABILITY, COOPERATION: r.permission.COOPERATION }, permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: r.attempts.map(publicAttempt) }; }),
    ledger: l.journal.map(e => ({ week: e.week, label: LABELS[e.command.type], actions: e.paid.actions, pennies: e.paid.pennies, spirituality: e.paid.spirituality, mind: e.paid.mind, seconds: e.elapsedSeconds, outcome: e.outcome })), actions,
  };
}
