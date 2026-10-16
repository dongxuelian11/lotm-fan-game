import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { WinnerLuck } from '../winner/types.js';
import { createChaosWalkerLifeState } from '../chaos-walker/life.js';
import { createFateProphetLifeState, type FateProphetOperationState } from '../fate-prophet/life.js';
import type { MercurySnakeOriginals, MercurySnakeSite } from './types.js';
import { mercurySnakeEncounterBudget, mercurySnakeFinanceSnapshot, validateMercurySnakeFinanceSnapshot, type MercurySnakeEncounterBudget, type MercurySnakeFinanceSnapshot } from './encounter.js';
export type { MercurySnakeOriginals, MercurySnakeSite } from './types.js';

export const MERCURY_SNAKE_CASE_IDS = ['cart-return', 'maintained-contact', 'withdrawn-contact'] as const;
export type MercurySnakeCaseId = typeof MERCURY_SNAKE_CASE_IDS[number];
export type MercurySnakeLifeAbilityId = 'wheel.s1.local-restart' | 'wheel.s1.moment-anchor';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'INVITE', 'START_ORDINARY', 'WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'PLACE_PIECE', 'CAPTURE_MOMENT', 'RELEASE_CART', 'LOCAL_RESTART', 'MOMENT_ANCHOR', 'WAIT_10', 'STOP_METHOD', 'TAKE_PIECE', 'RETURN_OBJECT', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'REPORT', 'OCCLUDE', 'RESTORE_VIEW', 'STEP_BACK', 'REMOVE_PARCEL', 'RETURN_PARCEL', 'PUSH_BACK'] as const;
export type MercurySnakeActivityCommand =
  | { type: typeof STEPS[number]; caseId: MercurySnakeCaseId }
  | { type: 'PREPARE'; caseId: MercurySnakeCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: MercurySnakeCaseId; permission: Permission }
  | { type: 'REFLECT' } | { type: 'ACCUMULATE' };
export interface MercurySnakePiece {
  id: string; caseId: MercurySnakeCaseId; kind: 'linking-piece'; ownerId: 'PLAYER'; quantity: 1; status: 'PLAYER' | 'RETURNED';
  location: 'HAND' | 'STAND' | 'RETURNED'; initialCharges: 1 | 2; charges: number; wear: number; paidPennies: 20; boughtWeek: number; travelMetres: number;
  returnUses: 0 | 1; anchorUses: 0 | 1;
}
/** A finite record of two objects. It deliberately contains no body, resources,
 * world time, memories, calendar, RNG, fees, inventories or old history. */
export interface MercurySnakeCapturedRelation {
  id: string; caseId: MercurySnakeCaseId; pieceId: string; capturedAt: number; expiresAt: number;
  conditionVersion: number; permissionVersion: number; valid: boolean; capturedLocation: 'A';
  cart: Pick<MercurySnakeSite['cart'], 'id' | 'owner' | 'quantity' | 'releases' | 'returns'>;
  parcel: Pick<MercurySnakeSite['parcel'], 'id' | 'owner' | 'quantity' | 'massGrams' | 'sealed'>;
  parcelLocation: 'CW3-CART';
}
export interface MercurySnakeLifeWindow {
  abilityId: 'wheel.s1.moment-anchor'; caseId: MercurySnakeCaseId; pieceId: string; relationId: string;
  createdAt: number; expiresAt: number; conditionVersion: number; permissionVersion: number; location: 'A';
}
export interface MercurySnakeAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; guideTravelMetres: number; volunteerTravelMetres: number;
  spiritualitySpent: number; mindSpent: number; volunteerMindSpent: 0 | 1; penniesSpent: 0 | 20; pieceId: string | null;
  readCart: boolean; readOriginal: boolean; piecePlaced: boolean; captured: boolean; released: boolean; releaseAt: number | null;
  restartTier: PublicResolutionTier | null; anchorTier: PublicResolutionTier | null; restartApplied: boolean; anchorApplied: boolean;
  returnKind: 'NONE' | 'ORDINARY' | 'RESTART'; verified: boolean; objectsReturned: boolean; appliedAbilityIds: MercurySnakeLifeAbilityId[]; waits: number;
  windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN' | 'OCCLUDED' | 'CONDITION_CHANGED';
  result: 'NONE' | Method; siteAtStart: MercurySnakeSite; siteAtClose: MercurySnakeSite | null;
}
export interface MercurySnakeLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED' | 'CANCELLED'; observedWeek: number | null; invited: boolean;
  permission: Record<Permission, Consent>; permissionWeek: Record<Permission, number | null>; permissionVersion: number; consentWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: MercurySnakeAttempt[];
}
export interface MercurySnakeLifeCost { actions: number; pennies: number; spirituality: number; mind: number; volunteerMind: number; pieceCharges: number; luck: number }
export interface MercurySnakeLifeMovement {
  actorId: 'PLAYER' | 'GUIDE' | 'CW3-VERA' | 'CW3-CART' | 'CW3-PARCEL'; from: MercurySnakeSite['playerLocation']; to: MercurySnakeSite['playerLocation'];
  mode: 'WALK' | 'ROLL' | 'PUSH' | 'CARRY' | 'RESTART'; metres: number; seconds: number; itemIds: string[];
}
export interface MercurySnakeLifeSource {
  caseId: MercurySnakeCaseId; at: number; location: MercurySnakeSite['playerLocation']; permissionVersion: number; conditionVersion: number;
  piece: MercurySnakePiece | null; relation: MercurySnakeCapturedRelation | null; window: MercurySnakeLifeWindow | null;
  cart: MercurySnakeSite['cart']; parcel: MercurySnakeSite['parcel'];
}
export interface MercurySnakeLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: MercurySnakeActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: MercurySnakeEncounterBudget; after: MercurySnakeEncounterBudget; finance: MercurySnakeFinanceSnapshot; paid: MercurySnakeLifeCost;
  elapsedSeconds: number; moves: MercurySnakeLifeMovement[]; siteBefore: MercurySnakeSite; siteAfter: MercurySnakeSite;
  operationBefore: FateProphetOperationState; operationAfter: FateProphetOperationState; source: MercurySnakeLifeSource | null;
}
export interface MercurySnakeLifeState {
  sourceWeek: number | null; activeCase: MercurySnakeCaseId | null; reflected: boolean; site: MercurySnakeSite; operation: FateProphetOperationState;
  volunteerMindSpent: number; conditionVersion: number; viewBlocked: boolean; captured: MercurySnakeCapturedRelation | null;
  pieces: MercurySnakePiece[]; pending: MercurySnakeLifeWindow | null; cases: Record<MercurySnakeCaseId, MercurySnakeLifeCase>; journal: MercurySnakeLifeReceipt[];
}
export interface MercurySnakeLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MercurySnakeActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export type MercurySnakePublicLifeReceipt = Pick<MercurySnakeLifeReceipt, 'week' | 'date' | 'revision' | 'command' | 'paid' | 'elapsedSeconds' | 'moves' | 'check' | 'outcome'>;
export interface MercurySnakeLifeProjection {
  title: string; story: string; source: string; environment: string; nextStep: string; activeCase: MercurySnakeCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  site: MercurySnakeSite; operation: Pick<FateProphetOperationState, 'door'>; clockSeconds: number; playerLocation: MercurySnakeSite['playerLocation']; playerTravelMetres: number;
  volunteerMindSpent: number; conditionVersion: number; viewBlocked: boolean; pieces: MercurySnakePiece[]; captured: MercurySnakeCapturedRelation | null; pending: MercurySnakeLifeWindow | null;
  pendingRemainingSeconds: number; currentAttempt: MercurySnakeAttempt | null; luck: WinnerLuck & { capacity: 3 };
  cases: { id: MercurySnakeCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: MercurySnakeAttempt[] }[];
  ledger: MercurySnakePublicLifeReceipt[]; actions: MercurySnakeLifeAction[];
}
const RESTART: MercurySnakeLifeAbilityId = 'wheel.s1.local-restart', ANCHOR: MercurySnakeLifeAbilityId = 'wheel.s1.moment-anchor';
/** Private practice bounds, not assertions about universal source-canon costs. */
const CAPTURE_SECONDS = 10, ANCHOR_SECONDS = 20;
const POSITION: Record<MercurySnakeSite['playerLocation'], number> = { START: 0, A: 4, B: 8, C: 8, YARD: -4, OUTSIDE: -4 };
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 1;
const distance = (from: MercurySnakeSite['playerLocation'], to: MercurySnakeSite['playerLocation']) => Math.abs(POSITION[to] - POSITION[from]);
const freshCase = (): MercurySnakeLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invited: false, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED' }, permissionWeek: { OWNER: null, ABILITY: null }, permissionVersion: 0, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createMercurySnakeLifeState(): MercurySnakeLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: createChaosWalkerLifeState(), operation: createFateProphetLifeState().operation,
    volunteerMindSpent: 0, conditionVersion: 0, viewBlocked: false, captured: null, pieces: [], pending: null,
    cases: { 'cart-return': freshCase(), 'maintained-contact': freshCase(), 'withdrawn-contact': freshCase() }, journal: [] };
}
const freshLife = (week: number, originals: MercurySnakeOriginals): MercurySnakeLifeState => ({ ...createMercurySnakeLifeState(), sourceWeek: week, site: structuredClone(originals.site), operation: structuredClone(originals.operation) });
const closedSite = (p: MercurySnakeSite) => p.playerLocation === 'START' && ['A', 'OUTSIDE'].includes(p.volunteer.location) && ['A', 'OUTSIDE'].includes(p.guide.location) && p.cart.location === 'A' && p.cart.control === 'GUIDE' && p.parcel.location === 'CW3-CART' && p.tags.every(t => t.location === 'POUCH');
export function initializeMercurySnakeLifeState(s: SliceState): void {
  const originals = s.mercurySnake.sourceScene?.originals;
  if (!active(s) || !originals || !same(originals.site, s.chaosWalker.life) || !same(originals.operation, s.fateProphet.life.operation) || !closedSite(originals.site) || !same(s.mercurySnake.life, createMercurySnakeLifeState())) throw new Error('须只继承一次原工坊、原人、同一车包和已经结束的旧操作。');
  s.mercurySnake.life = freshLife(s.week, originals);
}
export const getMercurySnakeCurrentSite = (s: SliceState): MercurySnakeSite => s.mercurySnake.encounter.currentSite ?? s.mercurySnake.life.site;
const projectedSite = (s: SliceState): MercurySnakeSite => s.mercurySnake.life.sourceWeek === null ? s.mercurySnake.sourceScene?.originals.site ?? s.chaosWalker.life : getMercurySnakeCurrentSite(s);
const current = (l: MercurySnakeLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const locked = (l: MercurySnakeLifeState) => l.activeCase !== null || l.pending !== null || MERCURY_SNAKE_CASE_IDS.some(id => l.cases[id].status === 'OBSERVED');
export const hasMercurySnakeLifeLock = (s: SliceState) => !!s.mercurySnake?.life && locked(s.mercurySnake.life);
export const mercurySnakeLifeClosed = (s: SliceState) => !hasMercurySnakeLifeLock(s) && closedSite(s.mercurySnake.life.site) && !s.mercurySnake.life.viewBlocked && MERCURY_SNAKE_CASE_IDS.every(id => s.mercurySnake.life.cases[id].status === 'RESOLVED');
export function validateMercurySnakeActivityCommand(v: unknown): v is MercurySnakeActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT' || v.type === 'ACCUMULATE') return shape(v, ['type']);
  if (!MERCURY_SNAKE_CASE_IDS.includes(v.caseId as MercurySnakeCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isMercurySnakeActivityCommand = validateMercurySnakeActivityCommand;
const isPower = (c: MercurySnakeActivityCommand) => c.type === 'LOCAL_RESTART' || c.type === 'MOMENT_ANCHOR';
const pieceFor = (l: MercurySnakeLifeState, id: MercurySnakeCaseId) => l.pieces.find(n => n.caseId === id);
function identityMatches(l: MercurySnakeLifeState, id: MercurySnakeCaseId): boolean {
  const q = l.captured, p = l.site, r = l.cases[id], n = pieceFor(l, id);
  return !!q && !!n && q.valid && q.caseId === id && q.pieceId === n.id && n.location === 'STAND' && q.conditionVersion === l.conditionVersion && q.permissionVersion === r.permissionVersion &&
    same(q.cart, { id: p.cart.id, owner: p.cart.owner, quantity: p.cart.quantity, releases: q.cart.releases, returns: p.cart.returns }) &&
    same(q.parcel, { id: p.parcel.id, owner: p.parcel.owner, quantity: p.parcel.quantity, massGrams: p.parcel.massGrams, sealed: p.parcel.sealed }) && p.parcel.location === q.parcelLocation &&
    r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' && p.guide.location === 'A' && p.volunteer.location === 'A' && p.volunteer.alive && p.volunteer.willing && !l.viewBlocked;
}
function anchorUsable(l: MercurySnakeLifeState, id: MercurySnakeCaseId): boolean {
  const w = l.pending, q = l.captured, n = pieceFor(l, id);
  return !!w && !!q && !!n && identityMatches(l, id) && w.caseId === id && w.relationId === q.id && w.pieceId === n.id && w.conditionVersion === l.conditionVersion && w.permissionVersion === l.cases[id].permissionVersion &&
    w.expiresAt > l.site.clockSeconds && l.site.playerLocation === w.location && n.initialCharges === 2 && n.charges >= 2 && n.anchorUses === 0;
}
function restartUsable(l: MercurySnakeLifeState, id: MercurySnakeCaseId): boolean {
  const q = l.captured, p = l.site, n = pieceFor(l, id);
  return !!q && identityMatches(l, id) && !!n && n.charges >= 1 && n.returnUses === 0 && p.cart.location === 'B' && p.cart.releases === q.cart.releases + 1 &&
    p.playerLocation === 'A' && distance(p.playerLocation, p.cart.location) === 4 && (q.expiresAt > p.clockSeconds || anchorUsable(l, id));
}
function localBlock(l: MercurySnakeLifeState, c: MercurySnakeActivityCommand, week: number, luck: WinnerLuck): string | null {
  const p = l.site;
  if (c.type === 'ACCUMULATE') return !locked(l) && closedSite(p) && luck.stored < 3 && luck.lastAccumulateWeek !== week ? null : '只可在收束后积存幸运，每真实周一次，最多三份。';
  if (c.type === 'REFLECT') return !locked(l) && closedSite(p) && !l.reflected && MERCURY_SNAKE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三案真实操作、归还与报告。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], n = pieceFor(l, id), index = MERCURY_SNAKE_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && closedSite(p) && r.status === 'AVAILABLE' && (index === 0 || ['RESOLVED', 'CANCELLED'].includes(l.cases[MERCURY_SNAKE_CASE_IDS[index - 1]!].status)) ? null : '先收尾前案，再核对同一工坊与普通门路。';
  if (c.type === 'CONSENT') return !a && closedSite(p) && r.status === 'OBSERVED' && (r.permission[c.permission] === 'UNASKED' || r.permission[c.permission] === 'GRANTED' && r.permissionWeek[c.permission] !== week) && p.volunteer.alive && p.volunteer.willing ? null : '须分别取得本案原物操作与具体能力的当前许可；撤回后不重复索取。';
  if (c.type === 'INVITE') return !a && r.status === 'OBSERVED' && closedSite(p) && !r.invited && r.permission.OWNER === 'GRANTED' && p.volunteer.willing ? null : '先取得本案原物许可，再询问艾妲和薇拉是否愿意实际同行。';
  if (c.type === 'WITHDRAW_CONSENT' && !a && r.status === 'OBSERVED') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '可以拒绝或撤回本案许可，不能恢复已经撤回的许可。';
  if (c.type === 'ABORT' && !a && r.status === 'OBSERVED' && closedSite(p)) return null;
  if (c.type === 'PREPARE' || c.type === 'START_ORDINARY') return !a && r.status === 'OBSERVED' && closedSite(p) && r.invited && r.permission.OWNER === 'GRANTED' && r.permissionWeek.OWNER === week &&
    (c.type === 'START_ORDINARY' || c.type === 'PREPARE' && c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED' && r.permissionWeek.ABILITY === week) ? null : '先取得本周原物许可和同行意愿；付费能力方法还须具体能力许可，每案只购一次。';
  if (c.type === 'REPORT') return !locked(l) && closedSite(p) && !l.viewBlocked && r.status === 'EXAMINED' && a?.closed && a.returned && a.verified ? null : '须实际放车、核实返回并归件退出；提前取消不能领取报告成果。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周正在进行的同一现场，不能复用旧许可或补充耗材。';
  if (c.type === 'WITHDRAW_CONSENT') return ['UNASKED', 'GRANTED'].includes(r.permission[c.permission]) ? null : '本案该项许可已经关闭。';
  if (c.type === 'ABORT') return null;
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已经停止；真实返回与已付成本仍然保留。';
  if (c.type === 'RESTORE_VIEW') return l.viewBlocked ? null : '视线没有被遮挡。';
  if (c.type === 'RETURN_TO_A') return p.playerLocation === 'B' ? null : '须从八米处沿四米原路返回。';
  if (c.type === 'WALK_TO_A') return p.playerLocation === 'START' && (r.invited || p.guide.location === 'A' && p.volunteer.location === 'A') ? null : '须从入口实际走四米到原车旁。';
  if (c.type === 'WALK_TO_B') return p.playerLocation === 'A' ? null : '须从原车处沿四米路走到原记录或同一车旁。';
  if (c.type === 'STEP_BACK') return p.playerLocation === 'A' && !a.verified ? null : '须从原车处实际退四米到入口；未用联系会结束。';
  if (c.type === 'PUSH_BACK') return p.cart.location === 'B' && p.playerLocation === 'B' && p.cart.id === 'CW3-CART' && p.cart.quantity === 1 ? null : '须本人到八米处，才能推回仍在那里的同一车；只带走实际在车上的物件。';
  if (c.type === 'REMOVE_PARCEL') return p.playerLocation === 'B' && p.cart.location === 'B' && p.parcel.location === 'CW3-CART' && r.permission.OWNER === 'GRANTED' && !a.verified ? null : '须在同一车旁，按原物许可把原包实际卸在八米处。';
  if (c.type === 'RETURN_PARCEL') return p.playerLocation === 'B' && p.parcel.location === 'B' && p.cart.location === 'A' && p.parcel.id === 'CW3-PARCEL' && p.parcel.quantity === 1 ? null : '须亲见仍在八米处的同一包，才能亲手提四米并放回原车；不能生成缺失的包。';
  if (c.type === 'RETURN_OBJECT') return p.playerLocation === 'A' && p.cart.location === 'A' && p.parcel.location === 'CW3-CART' && !a.objectsReturned && (a.verified || a.stopped || a.released) ? null : '先把同一车包实际归位，再在原主人面前交还控制权。';
  if (c.type === 'TAKE_PIECE') return p.playerLocation === 'A' && n?.location === 'STAND' && (a.verified || a.stopped) ? null : '完成或停止后，须在原台旁取回同一耗材。';
  if (c.type === 'RETURN_TO_ENTRY') return p.playerLocation === 'A' && a.objectsReturned && (!n || n.location === 'HAND') && (a.verified || a.stopped) ? null : '先归物并拿回耗材，再沿四米普通路回入口。';
  if (c.type === 'RETURN_PIECE') return p.playerLocation === 'START' && n?.location === 'HAND' && a.objectsReturned && (a.verified || a.stopped) ? null : '须亲手把同一耗材交回入口，不退款。';
  if (c.type === 'LEAVE') return closedSite(p) && !l.viewBlocked && (!n || n.location === 'RETURNED') && a.objectsReturned && (a.verified || a.stopped) ? null : '先普通归物、归件并回到入口，才能结束接触。';
  if (c.type === 'WAIT_10') return !!l.captured && !a.verified && a.waits < 3 ? null : '只可实际等候本案有限联系，不刷新、不退款。';
  if (c.type === 'OCCLUDE') return !!l.captured && !l.viewBlocked && !a.verified ? null : '须已有本案联系，才可用自己的手遮住视线。';
  if (a.verified) return '唯一返回已经核实，只能普通收尾。';
  if (c.type === 'LOCAL_RESTART') return a.method === 'ABILITY' && !a.stopped && a.captured && a.released && a.restartTier === null && n?.location === 'STAND' && n.returnUses === 0 && n.charges > 0 && r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' && r.permissionWeek.ABILITY === week && id !== 'withdrawn-contact' ? null : '每案只尝试一次，须已经亲见并放开同一车包、持有当前许可；失效的联系不会返回物件。';
  if (r.permission.OWNER !== 'GRANTED' || !p.volunteer.willing) return '原物许可已停止，只能普通归还与退出。';
  if (c.type === 'READ_ORIGINAL') return p.playerLocation === 'B' && a.readCart && !a.readOriginal && p.volunteer.mind > 0 ? null : '须本人亲读八米处原记录，薇拉本次真实说明耗一精神。';
  if (p.playerLocation !== 'A' || p.guide.location !== 'A' || p.volunteer.location !== 'A' || !a.readCart || !a.readOriginal) return '须先亲见同一车包、走到原记录读清，再返回原车旁。';
  if (c.type === 'PLACE_PIECE') return n?.location === 'HAND' && !a.piecePlaced && !a.stopped ? null : '本案唯一新耗材只放一次，不能替换或续充。';
  if (c.type === 'RELEASE_CART') return !a.released && p.cart.location === 'A' && p.parcel.location === 'CW3-CART' && (a.method === 'ORDINARY' || a.captured || a.stopped) && (id !== 'withdrawn-contact' || a.method === 'ORDINARY' || a.withdrawn) ? null : '只普通放开同一车包一次；撤回案须先撤回能力许可。';
  if (a.stopped || a.method !== 'ABILITY' || r.permission.ABILITY !== 'GRANTED' || r.permissionWeek.ABILITY !== week || l.viewBlocked || n?.location !== 'STAND') return '能力方法已停止、许可失效或视线不通；普通归还仍可进行。';
  if (c.type === 'CAPTURE_MOMENT') return !a.captured && !a.released && p.cart.location === 'A' && p.parcel.location === 'CW3-CART' && p.cart.id === 'CW3-CART' && p.parcel.id === 'CW3-PARCEL' && p.cart.owner === 'GUIDE' && p.parcel.owner === 'GUIDE' && p.cart.quantity === 1 && p.parcel.quantity === 1 && p.parcel.massGrams === 400 && p.parcel.sealed ? null : '只记录当前亲见的同一车与唯一四百克密封包在此处的关系，不记录身体或资源。';
  if (c.type === 'MOMENT_ANCHOR') return id !== 'cart-return' && a.captured && !a.released && a.anchorTier === null && !l.pending && l.captured!.expiresAt > p.clockSeconds && identityMatches(l, id) && n.charges > 0 ? null : '只尝试维系一次当前真实联系二十秒；另一次重启仍须独立付费和有限次数。';
  return '当前步骤不适用于本案。';
}
function cost(c: MercurySnakeActivityCommand): MercurySnakeLifeCost {
  return { actions: ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT', 'ACCUMULATE'].includes(c.type) ? 1 : 0, pennies: c.type === 'PREPARE' ? 20 : 0, spirituality: isPower(c) ? 8 : 0, mind: isPower(c) ? 2 : 0, volunteerMind: 0, pieceCharges: 0, luck: 0 };
}
const validLuck = (b: WinnerLuck) => record(b) && shape(b, ['stored', 'lastAccumulateWeek', 'accumulated', 'spent']) && integer(b.stored, 0, 3) && integer(b.accumulated) && integer(b.spent) && b.accumulated - b.spent === b.stored && (b.lastAccumulateWeek === null || integer(b.lastAccumulateWeek, 1));
function validBudget(b: MercurySnakeEncounterBudget): boolean {
  return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'luck']) &&
    integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 &&
    integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) &&
    Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk) && validLuck(b.luck);
}
interface Audit { date: PublicGameDate; revision: number; finance: MercurySnakeFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
function transition(initial: MercurySnakeLifeState, c: MercurySnakeActivityCommand, week: number, before: MercurySnakeEncounterBudget, audit: Audit) {
  if (!validateMercurySnakeActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week, before.luck)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(c), after = structuredClone(before), id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null;
  let a = r?.attempts[0] ?? null;
  const n = id ? pieceFor(l, id) ?? null : null;
  const usable = c.type === 'LOCAL_RESTART' ? restartUsable(l, c.caseId) : c.type === 'MOMENT_ANCHOR' ? identityMatches(l, c.caseId) : true;
  if (isPower(c) && (!success(audit.check?.tier ?? null) || !usable)) paid.mind = 4;
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < (isPower(c) ? 4 : paid.mind)) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const source: MercurySnakeLifeSource | null = id ? { caseId: id, at: p.clockSeconds, location: p.playerLocation, permissionVersion: r!.permissionVersion, conditionVersion: l.conditionVersion,
    piece: structuredClone(n), relation: structuredClone(l.captured), window: structuredClone(l.pending), cart: structuredClone(p.cart), parcel: structuredClone(p.parcel) } : null;
  const receipt: MercurySnakeLifeReceipt = { week, ...structuredClone(audit), command: structuredClone(c), outcome: audit.check?.tier ?? null, before: structuredClone(before), after, paid,
    elapsedSeconds: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), operationBefore: structuredClone(l.operation), operationAfter: structuredClone(l.operation), source };
  const clear = (why: MercurySnakeAttempt['windowEnd']) => { if (a && (l.pending || l.captured?.valid)) a.windowEnd = why; l.pending = null; if (l.captured) l.captured.valid = false; };
  const condition = (why: MercurySnakeAttempt['windowEnd']) => { clear(why); l.conditionVersion++; };
  const tick = (seconds: number) => {
    p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds;
    if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED');
    else if (l.captured?.valid && l.captured.expiresAt <= p.clockSeconds && !l.pending) clear('EXPIRED');
  };
  const move = (to: 'START' | 'A' | 'B', mode: 'WALK' | 'PUSH' | 'CARRY' = 'WALK', itemIds: string[] = []) => {
    condition('MOVED'); const from = p.playerLocation, metres = distance(from, to), held = id ? pieceFor(l, id) : null;
    p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
    if (held?.location === 'HAND') { held.travelMetres += metres; itemIds = [...itemIds, held.id]; }
    receipt.moves.push({ actorId: 'PLAYER', from, to, mode, metres, seconds: metres, itemIds }); tick(metres);
  };
  const bringAdults = () => {
    for (const actor of ['guide', 'volunteer'] as const) {
      if (p[actor].location !== 'OUTSIDE') continue;
      for (const to of ['START', 'A'] as const) {
        const from = p[actor].location, metres = distance(from, to); p[actor].location = to;
        if (actor === 'guide') { p.guideTravelMetres += metres; a!.guideTravelMetres += metres; } else a!.volunteerTravelMetres += metres;
        receipt.moves.push({ actorId: p[actor].id, from, to, mode: 'WALK', metres, seconds: metres, itemIds: actor === 'volunteer' ? [p.pouch.id, ...p.tags.map(t => t.id)] : [] }); tick(metres);
      }
    }
  };
  const push = () => {
    const attached = p.parcel.location === 'CW3-CART', items = [p.cart.id, ...(attached ? [p.parcel.id] : [])];
    receipt.moves.push({ actorId: 'CW3-CART', from: 'B', to: 'A', mode: 'PUSH', metres: 4, seconds: 4, itemIds: items }); p.cart.location = 'A'; p.cart.returns++; move('A', 'PUSH', items);
    a!.returnKind = 'ORDINARY'; a!.verified = attached && a!.released;
  };
  const carryParcel = () => { receipt.moves.push({ actorId: 'CW3-PARCEL', from: 'B', to: 'A', mode: 'CARRY', metres: 4, seconds: 4, itemIds: [p.parcel.id] }); move('A', 'CARRY', [p.parcel.id]); p.parcel.location = 'CW3-CART'; a!.verified = a!.released; };
  const take = () => { pieceFor(l, id!)!.location = 'HAND'; condition('MOVED'); tick(1); };
  const returnObject = () => { p.cart.control = 'GUIDE'; a!.objectsReturned = true; tick(1); };
  const returnPiece = () => { const held = pieceFor(l, id!)!; held.status = 'RETURNED'; held.location = 'RETURNED'; tick(1); };
  const close = () => {
    clear('STOPPED'); l.viewBlocked = false; a!.returned = true; r!.returned = true; a!.closed = true; a!.result = a!.verified ? a!.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY' : 'NONE'; r!.result = a!.result;
    r!.contactOpen = false; r!.status = a!.verified ? 'EXAMINED' : 'CANCELLED'; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED';
    a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  switch (c.type) {
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionWeek[c.permission] = week; r!.permissionVersion++; r!.consentWeek = week; tick(1); break;
    case 'INVITE': r!.invited = true; tick(1); break;
    case 'PREPARE': case 'START_ORDINARY': {
      const bought = c.type === 'PREPARE', pieceId = bought ? `MS1-PIECE-${MERCURY_SNAKE_CASE_IDS.indexOf(c.caseId) + 1}` : null;
      a = { week, method: bought ? c.method : 'ORDINARY', closed: false, stopped: false, returned: false, withdrawn: false,
        elapsedSeconds: 0, playerTravelMetres: 0, guideTravelMetres: 0, volunteerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, volunteerMindSpent: 0, penniesSpent: bought ? 20 : 0, pieceId,
        readCart: false, readOriginal: false, piecePlaced: false, captured: false, released: false, releaseAt: null, restartTier: null, anchorTier: null, restartApplied: false, anchorApplied: false,
        returnKind: 'NONE', verified: false, objectsReturned: false, appliedAbilityIds: [], waits: 0, windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = a.method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = c.caseId; l.captured = null; l.pending = null;
      if (bought) { const charges = c.caseId === 'maintained-contact' ? 2 : 1; l.pieces.push({ id: pieceId!, caseId: c.caseId, kind: 'linking-piece', ownerId: 'PLAYER', quantity: 1, status: 'PLAYER', location: 'HAND', initialCharges: charges, charges, wear: 0, paidPennies: 20, boughtWeek: week, travelMetres: 0, returnUses: 0, anchorUses: 0 }); }
      tick(2); break;
    }
    case 'WALK_TO_A': bringAdults(); move('A'); a!.readCart = true; break;
    case 'WALK_TO_B': move('B'); break;
    case 'RETURN_TO_A': move('A'); break;
    case 'STEP_BACK': move('START'); break;
    case 'READ_ORIGINAL': a!.readOriginal = true; a!.volunteerMindSpent = 1; l.volunteerMindSpent++; p.volunteer.mind--; paid.volunteerMind = 1; tick(2); break;
    case 'PLACE_PIECE': n!.location = 'STAND'; a!.piecePlaced = true; tick(1); break;
    case 'CAPTURE_MOMENT': {
      tick(1); a!.captured = true; p.cart.control = 'PLAYER';
      l.captured = { id: `${n!.id}-RELATION`, caseId: id!, pieceId: n!.id, capturedAt: p.clockSeconds, expiresAt: p.clockSeconds + CAPTURE_SECONDS, conditionVersion: l.conditionVersion,
        permissionVersion: r!.permissionVersion, valid: true, capturedLocation: 'A', cart: { id: p.cart.id, owner: p.cart.owner, quantity: p.cart.quantity, releases: p.cart.releases, returns: p.cart.returns },
        parcel: { id: p.parcel.id, owner: p.parcel.owner, quantity: p.parcel.quantity, massGrams: p.parcel.massGrams, sealed: p.parcel.sealed }, parcelLocation: 'CW3-CART' }; break;
    }
    case 'MOMENT_ANCHOR': {
      if (!audit.check) return null; a!.anchorTier = audit.check.tier; a!.spiritualitySpent += 8; a!.mindSpent += paid.mind; tick(1);
      if (success(audit.check.tier) && usable) { l.pending = { abilityId: 'wheel.s1.moment-anchor', caseId: id!, pieceId: n!.id, relationId: l.captured!.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + ANCHOR_SECONDS, conditionVersion: l.conditionVersion, permissionVersion: r!.permissionVersion, location: 'A' }; a!.windowEnd = 'ACTIVE'; }
      else a!.windowEnd = 'FAILED'; break;
    }
    case 'RELEASE_CART':
      p.cart.control = 'PLAYER'; p.cart.location = 'B'; p.cart.releases++; a!.released = true; a!.releaseAt = p.clockSeconds;
      receipt.moves.push({ actorId: 'CW3-CART', from: 'A', to: 'B', mode: 'ROLL', metres: 4, seconds: 4, itemIds: [p.cart.id, p.parcel.id] }); tick(4); break;
    case 'LOCAL_RESTART': {
      if (!audit.check) return null; a!.restartTier = audit.check.tier; a!.spiritualitySpent += 8; a!.mindSpent += paid.mind;
      if (success(audit.check.tier) && usable) {
        const assisted = l.captured!.expiresAt <= p.clockSeconds && anchorUsable(l, id!);
        // Only position and finite use history change. No snapshot assignment is allowed here.
        p.cart.location = 'A'; p.cart.returns++; n!.charges--; n!.wear++; n!.returnUses = 1; paid.pieceCharges++;
        a!.restartApplied = true; a!.appliedAbilityIds.push(RESTART); a!.returnKind = 'RESTART'; a!.verified = true;
        if (assisted) { n!.charges--; n!.wear++; n!.anchorUses = 1; paid.pieceCharges++; a!.anchorApplied = true; a!.appliedAbilityIds.push(ANCHOR); }
        receipt.moves.push({ actorId: 'CW3-CART', from: 'B', to: 'A', mode: 'RESTART', metres: 4, seconds: 1, itemIds: [p.cart.id, p.parcel.id] }); clear('APPLIED'); a!.windowEnd = 'APPLIED';
      } else { clear('FAILED'); a!.windowEnd = 'FAILED'; }
      tick(1); break;
    }
    case 'REMOVE_PARCEL': p.parcel.location = 'B'; condition('CONDITION_CHANGED'); tick(1); break;
    case 'RETURN_PARCEL': carryParcel(); break;
    case 'PUSH_BACK': push(); break;
    case 'RETURN_OBJECT': returnObject(); break;
    case 'TAKE_PIECE': take(); break;
    case 'RETURN_TO_ENTRY': move('START'); break;
    case 'RETURN_PIECE': returnPiece(); break;
    case 'LEAVE': close(); break;
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'OCCLUDE': l.viewBlocked = true; condition('OCCLUDED'); tick(1); break;
    case 'RESTORE_VIEW': l.viewBlocked = false; condition('CONDITION_CHANGED'); tick(1); break;
    case 'WITHDRAW_CONSENT': r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++; if (a) { a.withdrawn = true; a.stopped = true; } condition('WITHDRAWN'); tick(1); break;
    case 'STOP_METHOD': a!.stopped = true; condition('STOPPED'); tick(1); break;
    case 'ABORT':
      if (!a) { r!.status = 'CANCELLED'; r!.returned = true; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED'; tick(1); break; }
      a.stopped = true; condition('STOPPED'); l.viewBlocked = false; tick(1);
      if (p.cart.location === 'B') { if (p.playerLocation === 'START') move('A'); if (p.playerLocation === 'A') move('B'); if (p.playerLocation !== 'B' || p.cart.id !== 'CW3-CART' || p.cart.quantity !== 1) return null; push(); }
      if (p.parcel.location === 'B') { if (p.playerLocation === 'START') move('A'); if (p.playerLocation === 'A') move('B'); if (p.parcel.id !== 'CW3-PARCEL' || p.parcel.quantity !== 1) return null; carryParcel(); }
      if (p.playerLocation === 'B') move('A'); if (p.playerLocation === 'START' && (!a.objectsReturned || n?.location === 'STAND')) move('A');
      if (p.cart.location !== 'A' || p.parcel.location !== 'CW3-CART') return null;
      if (!a.objectsReturned) returnObject(); if (pieceFor(l, id!)?.location === 'STAND') take(); if (p.playerLocation === 'A') move('START'); if (pieceFor(l, id!)?.location === 'HAND') returnPiece(); close(); break;
    case 'REPORT': {
      const marker = `mercury-snake-case:${id}`; if (after.completedSources.includes(marker)) return null;
      r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const ability of a!.appliedAbilityIds) after.mastery[ability] = Math.min(500, (after.mastery[ability] ?? 0) + 8); tick(2); break;
    }
    case 'REFLECT': if (after.completedSources.includes('mercury-snake-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('mercury-snake-reflection'); tick(3); break;
    case 'ACCUMULATE': after.luck.stored++; after.luck.accumulated++; after.luck.lastAccumulateWeek = week; tick(4); break;
  }
  receipt.siteAfter = structuredClone(p); receipt.operationAfter = structuredClone(l.operation);
  return { life: l, receipt };
}
export function blockMercurySnakeLife(s: SliceState, c: MercurySnakeActivityCommand): string | null {
  if (!validateMercurySnakeActivityCommand(c)) return '水银之蛇生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已成为水银之蛇；本段不能复活。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.mercurySnake.preparedWeek !== null || s.mercurySnake.encounter.status !== 'AVAILABLE' || s.mercurySnake.encounter.preparation !== null || s.mercurySnake.life.sourceWeek === null) return '先结束当前事件或准备，再实际来到同一原工坊。';
  const reason = localBlock(s.mercurySnake.life, c, s.week, s.mercurySnake.luck); if (reason) return reason;
  const paid = cost(c); if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < (isPower(c) ? 4 : paid.mind)) return '当前资源不足；每次尝试保留真实成本，普通归还与退出不耗行动。';
  return null;
}
export function applyMercurySnakeLifeCommand(s: SliceState, c: MercurySnakeActivityCommand, ctx: SeerContext): void {
  const reason = blockMercurySnakeLife(s, c); if (reason) throw new Error(reason);
  const before = mercurySnakeEncounterBudget(s), audit: Audit = { date: structuredClone(s.date), revision: s.revision, finance: mercurySnakeFinanceSnapshot(s), randomCursor: s.random.cursor,
    randomBefore: isPower(c) ? s.random.cursor : null, randomAfter: null, checkBase: isPower(c) ? before.coreStats.knowledge : null, check: null };
  if (isPower(c)) { audit.check = structuredClone(ctx.check('knowledge', 20)); audit.randomAfter = s.random.cursor; }
  const next = transition(s.mercurySnake.life, c, s.week, before, audit); if (!next) throw new Error('同一原工坊的有限返回转移失败。');
  s.mercurySnake.life = next.life; s.mercurySnake.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality; s.mercurySnake.luck = structuredClone(after.luck);
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(`原工坊：${LABELS[c.type]}`, `${audit.check ? `知识二十检定${TIER_LABELS[audit.check.tier]}，实付八灵性、${next.receipt.paid.mind}精神。` : ''}本人在${LOCATIONS[next.life.site.playerLocation]}，工坊时钟${next.life.site.clockSeconds}秒。${c.type === 'LOCAL_RESTART' && current(next.life)?.restartApplied ? '同一原车与原包确已返回先前位置，费用、精神、已发生的放车和经过的时间保留。' : '原人、原物和已经发生的事实保留，普通归还与退出仍在。'}`);
}
export const applyMercurySnakeActivity = applyMercurySnakeLifeCommand;
export const applyMercurySnakeLife = applyMercurySnakeLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATIONS: Record<MercurySnakeSite['playerLocation'], string> = { START: '原入口', A: '四米处原车旁', B: '八米处原记录旁', C: '原右侧软挡', YARD: '独立邻院', OUTSIDE: '室外' };
const LABELS: Record<MercurySnakeActivityCommand['type'], string> = {
  OBSERVE: '核对原车包、原人和普通退路', INVITE: '邀请艾妲与薇拉本案同行', START_ORDINARY: '不购耗材，普通进行本案', PREPARE: '购买本案有限联结件', CONSENT: '询问本案当前许可', WITHDRAW_CONSENT: '拒绝或撤回本案许可',
  WALK_TO_A: '实际走到四米处原车旁', WALK_TO_B: '实际走四米到原记录与软挡', READ_ORIGINAL: '亲读原记录并听取本次说明', RETURN_TO_A: '沿四米原路返回原车旁', PLACE_PIECE: '把同一新联结件放在原台', CAPTURE_MOMENT: '亲见并记录同一车包此刻的位置关系',
  RELEASE_CART: '普通放开同一车包，实际滚动四米', LOCAL_RESTART: '局部重启：尝试让同一车包回到先前位置', MOMENT_ANCHOR: '片刻维系：保持这次真实联系二十秒', WAIT_10: '实际等待十秒', STOP_METHOD: '停止本次能力输入', TAKE_PIECE: '从原台拿回同一联结件',
  RETURN_OBJECT: '当面交还同一车包的控制权', RETURN_TO_ENTRY: '沿四米普通路返回入口', RETURN_PIECE: '交还同一联结件，不退费用', LEAVE: '确认普通退出并结束接触', ABORT: '停止并沿普通路归物退出', REPORT: '如实报告这次有限返回', REFLECT: '反思三案的许可与真实代价',
  OCCLUDE: '用自己的手遮住视线', RESTORE_VIEW: '移开手，恢复普通视线', STEP_BACK: '实际退回入口，结束未用联系', REMOVE_PARCEL: '亲手把原包卸在八米处', RETURN_PARCEL: '把仍在八米处的原包亲手提回原车', PUSH_BACK: '手推仍在八米处的原车回来', ACCUMULATE: '用一次行动积存幸运',
};
const CASES: { id: MercurySnakeCaseId; title: string; story: string }[] = [
  { id: 'cart-return', title: '同一车包返回先前位置', story: '亲见同一原车和唯一四百克密封包，记录它们在原台的位置，再普通放车四米。局部重启只尝试让这两个原物回到刚才的位置；费用、放车记录和真实时钟不会回退。' },
  { id: 'maintained-contact', title: '维系联系，再独立尝试返回', story: '本案购买明确含两次用量的同一件联结件。片刻维系只延长这次真实联系二十秒；实际等待后，还须另付一次重启成本。只有维系确实帮助后来的返回时，才额外消耗它的一次用量。' },
  { id: 'withdrawn-contact', title: '撤回之后，普通推回', story: '尝试维系后撤回本案能力许可，未用联系立即结束。随后普通放车、走到同一车旁并手推回来；已经支付的成本保留，普通返回不会算作能力掌握。' },
];
const CLEANUP = ['STOP_METHOD', 'RETURN_TO_A', 'PUSH_BACK', 'RETURN_PARCEL', 'RETURN_OBJECT', 'TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'ABORT', 'RESTORE_VIEW', 'WITHDRAW_CONSENT'];
export function mercurySnakeLifeActions(s: SliceState): MercurySnakeLifeAction[] {
  if (!active(s) || s.mercurySnake.encounter.status !== 'AVAILABLE' || s.mercurySnake.encounter.preparation !== null) return [];
  const l = s.mercurySnake.life, id = l.activeCase ?? MERCURY_SNAKE_CASE_IDS.find(key => !['RESOLVED', 'CANCELLED'].includes(l.cases[key].status)), out: MercurySnakeLifeAction[] = [];
  const add = (command: MercurySnakeActivityCommand) => {
    const reason = blockMercurySnakeLife(s, command), paid = cost(command), count = 'caseId' in command && command.caseId === 'maintained-contact' ? 2 : 1;
    out.push({ id: `MS1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : ''}`,
      label: LABELS[command.type] + ('permission' in command ? command.permission === 'OWNER' ? '（原物与普通操作）' : '（本案具体能力）' : command.type === 'PREPARE' ? `（${command.method === 'ABILITY' ? '能力' : '普通'}方法，${count}次用量）` : ''),
      cost: [`${paid.actions}行动`, ...(paid.pennies ? [`二十便士，一件${count}次用量`] : []), ...(isPower(command) ? ['八灵性、二精神，未成功应用时总四精神', '知识二十', command.type === 'MOMENT_ANCHOR' ? '维系二十秒，重启另付' : '同一车包，四米内，一次返回'] : command.type === 'READ_ORIGINAL' ? ['薇拉本次一精神'] : command.type === 'WAIT_10' ? ['真实十秒，不续时'] : [])].join(' · '),
      enabled: reason === null, reason, command, cleanup: CLEANUP.includes(command.type) });
  };
  if (!id) {
    if (!l.reflected && MERCURY_SNAKE_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) add({ type: 'REFLECT' });
    add({ type: 'ACCUMULATE' }); if (out[0]?.enabled && out[0].command.type === 'REFLECT') out[0].preferredAction = true; return out;
  }
  const r = l.cases[id], a = r.attempts[0], n = pieceFor(l, id);
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') {
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED' || r.permission[permission] === 'GRANTED' && r.permissionWeek[permission] !== s.week) add({ type: 'CONSENT', caseId: id, permission });
    if (!r.invited) add({ type: 'INVITE', caseId: id });
    add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); add({ type: 'START_ORDINARY', caseId: id });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (a && r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'ABORT', 'INVITE', 'START_ORDINARY'].includes(type) && localBlock(l, { type, caseId: id }, s.week, s.mercurySnake.luck) === null) add({ type, caseId: id });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (['UNASKED', 'GRANTED'].includes(r.permission[permission])) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  const choose = (type: MercurySnakeActivityCommand['type']) => out.find(v => v.enabled && v.command.type === type);
  let preferred: MercurySnakeLifeAction | undefined;
  if (a) {
    if (l.viewBlocked) preferred = choose('RESTORE_VIEW');
    if (!a.readCart) preferred ??= choose('WALK_TO_A');
    else if (!a.readOriginal) preferred ??= choose('WALK_TO_B') ?? choose('READ_ORIGINAL');
    else if (!a.verified) {
      if (a.released) {
        if (a.method === 'ABILITY' && !a.stopped && a.restartTier === null && id !== 'withdrawn-contact') preferred ??= choose('LOCAL_RESTART');
        if (pinnedParcel(l)) preferred ??= choose('RETURN_PARCEL');
        if (pinnedCart(l)) preferred ??= choose('PUSH_BACK') ?? choose('WALK_TO_B') ?? choose('WALK_TO_A');
        if (l.site.parcel.location === 'B' && l.site.cart.location === 'A') preferred ??= choose('WALK_TO_B');
      } else {
        preferred ??= choose('RETURN_TO_A');
        if (a.method === 'ABILITY' && !a.stopped) {
          if (!a.piecePlaced) preferred ??= choose('PLACE_PIECE');
          if (!a.captured) preferred ??= choose('CAPTURE_MOMENT');
          if (id !== 'cart-return' && a.anchorTier === null) preferred ??= choose('MOMENT_ANCHOR');
          if (id === 'withdrawn-contact' && a.anchorTier !== null && !a.withdrawn) preferred ??= out.find(v => v.enabled && v.command.type === 'WITHDRAW_CONSENT' && v.command.permission === 'ABILITY');
          if (id === 'maintained-contact' && l.pending && a.waits === 0) preferred ??= choose('WAIT_10');
        }
        preferred ??= choose('RELEASE_CART');
      }
    }
    if (a.verified || a.stopped && !a.released) preferred ??= choose('RETURN_TO_A') ?? choose('RETURN_OBJECT') ?? (n ? choose('TAKE_PIECE') : undefined) ?? choose('RETURN_TO_ENTRY') ?? (n ? choose('RETURN_PIECE') : undefined) ?? choose('LEAVE');
  }
  preferred ??= out.find(v => v.enabled && ![...CLEANUP, 'WAIT_10', 'OCCLUDE', 'STEP_BACK', 'REMOVE_PARCEL', 'START_ORDINARY'].includes(v.command.type));
  preferred ??= choose('START_ORDINARY') ?? choose('ABORT');
  if (preferred) preferred.preferredAction = true;
  return out;
}
const pinnedCart = (l: MercurySnakeLifeState) => l.site.cart.location === 'B';
const pinnedParcel = (l: MercurySnakeLifeState) => l.site.parcel.location === 'B' && l.site.cart.location === 'A' && l.site.playerLocation === 'B';
export function projectMercurySnakeLife(s: SliceState): MercurySnakeLifeProjection {
  const l = s.mercurySnake.life, site = projectedSite(s), actions = mercurySnakeLifeActions(s), preferred = actions.find(a => a.preferredAction);
  return { title: '原工坊的有限局部重启', story: '同一位三十九岁的薇拉、艾妲、原车和唯一四百克密封包继续留在原工坊。先分别询问本案许可，再实际同行、读原记录和准备有限耗材。返回只触及这两个亲见原物的先前位置。',
    source: '沿用实际已经收尾的原工坊。原车和原包仍归艾妲，原袋和两枚原签仍归薇拉。旧报告、旧伤与已经投降的人继续保留。',
    environment: '室外到入口再到原车共八米；本人从入口走四米到原车，再走四米读原记录并返回。每案观察一行动；能力准备一行动、二十便士。第一和第三案一件一次用量，第二案明确购买两次用量。每次施术八灵性、二精神，失败总四精神；重启不退资源、不回退时钟，片刻维系最多二十秒。普通放车、推回和退出始终不耗行动。',
    nextStep: preferred?.label ?? (l.reflected ? '三案已收尾，可自行决定是否前往独立邻院。' : '当前没有待执行的工坊操作。'), preferredActionId: preferred?.id ?? null, activeCase: l.activeCase,
    inside: hasMercurySnakeLifeLock(s), insideCase: hasMercurySnakeLifeLock(s), reflected: l.reflected, site: structuredClone(site), operation: { door: (l.sourceWeek === null ? s.mercurySnake.sourceScene?.originals.operation ?? s.fateProphet.life.operation : l.operation).door },
    clockSeconds: site.clockSeconds, playerLocation: site.playerLocation, playerTravelMetres: site.playerTravelMetres, volunteerMindSpent: l.volunteerMindSpent, conditionVersion: l.conditionVersion, viewBlocked: l.viewBlocked,
    pieces: structuredClone(l.pieces), captured: structuredClone(l.captured), pending: structuredClone(l.pending), pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - site.clockSeconds) : l.captured?.valid ? Math.max(0, l.captured.expiresAt - site.clockSeconds) : 0,
    currentAttempt: structuredClone(current(l)), luck: { ...(l.sourceWeek === null ? s.winner.luck : s.mercurySnake.luck), capacity: 3 },
    cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info, status: r.status, method: r.method,
      observations: a ? [`实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性、${a.mindSpent}精神；本人走${a.playerTravelMetres}米，艾妲走${a.guideTravelMetres}米，薇拉走${a.volunteerTravelMetres}米。`,
        ...(a.restartTier ? [`本次重启检定${TIER_LABELS[a.restartTier]}，${a.restartApplied ? '同一车包实际返回。' : '没有发生能力返回。'}`] : []), ...(a.anchorTier ? [`本次维系检定${TIER_LABELS[a.anchorTier]}，${a.anchorApplied ? '确实维持了稍后返回所需的关系。' : '尚未帮助完成返回。'}`] : []),
        ...(a.returnKind === 'ORDINARY' ? ['本人实际推车或提包返回，这不是成功的局部重启。'] : []), ...(a.withdrawn ? ['本案指定许可已撤回，未用联系失效；成本与已经完成的返回保留。'] : [])] : [],
      result: r.status === 'CANCELLED' ? '已普通退出，未完成的操作不领取报告。' : r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限返回已经真实发生并记录。' : '已普通完成，没有未应用的能力奖励。',
      permission: structuredClone(r.permission), permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }), ledger: l.journal.map(e => ({ week: e.week, date: { ...e.date }, revision: e.revision, command: structuredClone(e.command), paid: { ...e.paid }, elapsedSeconds: e.elapsedSeconds, moves: structuredClone(e.moves), check: structuredClone(e.check), outcome: e.outcome })), actions };
}
/** The mutable continuation allows only real motion, releases/returns and the
 * adult's recorded new effort. All original identities, ownership and history
 * remain exact, including old case clocks and old event outcomes. */
export function validateMercurySnakeCurrentSite(p: MercurySnakeSite, originals: MercurySnakeOriginals): boolean {
  try {
    const old = originals.site;
    return Object.hasOwn(POSITION, p.playerLocation) && integer(p.playerTravelMetres, old.playerTravelMetres) && integer(p.guideTravelMetres, old.guideTravelMetres) && integer(p.clockSeconds, old.clockSeconds) &&
      same(p, { ...old, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, guideTravelMetres: p.guideTravelMetres, clockSeconds: p.clockSeconds, volunteer: p.volunteer, guide: p.guide, cart: p.cart, parcel: p.parcel }) &&
      ['A', 'START', 'OUTSIDE'].includes(p.volunteer.location) && integer(p.volunteer.mind, 0, old.volunteer.mind) && same(p.volunteer, { ...old.volunteer, location: p.volunteer.location, mind: p.volunteer.mind }) &&
      ['A', 'START', 'OUTSIDE'].includes(p.guide.location) && same(p.guide, { ...old.guide, location: p.guide.location }) &&
      ['A', 'B'].includes(p.cart.location) && ['GUIDE', 'PLAYER'].includes(p.cart.control) && integer(p.cart.releases, old.cart.releases) && integer(p.cart.returns, old.cart.returns) &&
      same(p.cart, { ...old.cart, location: p.cart.location, control: p.cart.control, releases: p.cart.releases, returns: p.cart.returns }) && ['CW3-CART', 'B'].includes(p.parcel.location) && same(p.parcel, { ...old.parcel, location: p.parcel.location });
  } catch { return false; }
}
function lifeBoundary(e: MercurySnakeLifeReceipt, isLocked: boolean) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || isLocked) return { budget, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 }, finance: mercurySnakeFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date, pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function mercurySnakeCompletedLifeBudgetMatches(s: SliceState, e: MercurySnakeLifeReceipt, isLocked = hasMercurySnakeLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(mercurySnakeEncounterBudget(s), expected.budget) || !same(mercurySnakeFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) || s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null || (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): MercurySnakeLifeState | null {
  const life = s.mercurySnake.life, source = s.mercurySnake.sourceScene;
  if (!source || life.sourceWeek === null) return null;
  let model = freshLife(life.sourceWeek, source.originals), previous: MercurySnakeLifeReceipt | null = null, lastWeek = life.sourceWeek, cursor = source.random.cursor;
  let luck = structuredClone(source.originals.luck);
  for (const e of life.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'moves', 'siteBefore', 'siteAfter', 'operationBefore', 'operationAfter', 'source']) ||
      !validateMercurySnakeActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) || !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) ||
      !integer(e.randomCursor, cursor, s.random.cursor) || !validateMercurySnakeFinanceSnapshot(e.finance, e.week) || !validBudget(e.before) || !same(e.before.luck, luck)) return null;
    if (locked(model) && (!previous || e.week !== lastWeek || e.revision !== previous.revision + 1 || !same(e.before, previous.after) || !same(e.finance, previous.finance) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (previous && e.revision === previous.revision + 1) {
      const expected = lifeBoundary(previous, locked(model));
      if (e.week !== expected.week || !same(e.date, expected.date) || !same(e.before, expected.budget) || !same(e.finance, expected.finance) || expected.eventId !== null || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
    }
    if (isPower(e.command)) {
      if (e.checkBase !== e.before.coreStats.knowledge || !same(e.before.coreStats, s.character.coreStats) || e.checkBase === null || !record(e.check) || e.randomBefore !== e.randomCursor || !integer(e.randomAfter, cursor, s.random.cursor)) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomCursor), expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: e.checkBase, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
      if (!same(e.check, expected) || e.outcome !== expected.tier || random.cursor !== e.randomAfter) return null;
    } else if (e.randomBefore !== null || e.randomAfter !== null || e.checkBase !== null || e.check !== null || e.outcome !== null) return null;
    const next = transition(model, e.command, e.week, e.before, { date: e.date, revision: e.revision, finance: e.finance, randomCursor: e.randomCursor, randomBefore: e.randomBefore, randomAfter: e.randomAfter, checkBase: e.checkBase, check: e.check });
    if (!next || !same(next.receipt, e) || !validateMercurySnakeCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor; luck = structuredClone(e.after.luck);
  }
  const expectedLuck = s.mercurySnake.encounter.preparation?.before.luck ?? s.mercurySnake.luck;
  return same(luck, expectedLuck) ? model : null;
}
export const replayMercurySnakeLifeRoot = replayLife;
export function mercurySnakeLifeMasteryGains(s: SliceState): Record<MercurySnakeLifeAbilityId, number> {
  const gains: Record<MercurySnakeLifeAbilityId, number> = { [RESTART]: 0, [ANCHOR]: 0 } as Record<MercurySnakeLifeAbilityId, number>;
  for (const id of MERCURY_SNAKE_CASE_IDS) { const r = s.mercurySnake.life.cases[id]; if (r.status === 'RESOLVED') for (const abilityId of r.attempts[0]!.appliedAbilityIds) gains[abilityId] += 8; } return gains;
}
export function validateMercurySnakeLifeState(s: SliceState): boolean {
  try {
    const life = s.mercurySnake?.life, source = s.mercurySnake?.sourceScene;
    if (!record(life) || !shape(life, Object.keys(createMercurySnakeLifeState())) || !record(life.cases) || !shape(life.cases, MERCURY_SNAKE_CASE_IDS) || !Array.isArray(life.journal) || life.journal.length > 300) return false;
    if (s.mercurySnake.promotionWeek === null) return same(life, createMercurySnakeLifeState());
    if (!source || life.sourceWeek !== s.mercurySnake.promotionWeek || !same(source.originals.site, s.chaosWalker.life) || !same(source.originals.operation, s.fateProphet.life.operation) || !closedSite(source.originals.site) || !validateMercurySnakeCurrentSite(life.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(life, replay)) return false;
    const gains = mercurySnakeLifeMasteryGains(s); let acting = life.reflected ? 25 : 0;
    for (const id of MERCURY_SNAKE_CASE_IDS) { const resolved = life.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `mercury-snake-case:${id}`).length !== (resolved ? 1 : 0)) return false; if (resolved) acting += 25; }
    if (s.seer.completedSources.filter(x => x === 'mercury-snake-reflection').length !== (life.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[RESTART] ?? 0) < gains[RESTART] || (s.progression.mastery[ANCHOR] ?? 0) < gains[ANCHOR]) return false;
    const last = life.journal.at(-1), encounter = s.mercurySnake.encounter;
    if (locked(life) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.mercurySnake.preparedWeek !== null || encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(mercurySnakeEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !mercurySnakeCompletedLifeBudgetMatches(s, last, locked(life))) return false;
    return true;
  } catch { return false; }
}
export const validateMercurySnakeLife = validateMercurySnakeLifeState;
