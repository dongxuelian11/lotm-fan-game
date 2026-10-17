import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { TimeWormFinanceSnapshot } from './types.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { validateFateTrojanSiteState, type FateTrojanSiteState, type FateTrojanLocation } from '../fate-trojan/life.js';

/** Only the current clock, original bodies' positions, travel and energy evolve.
 * The original parcel, paid carry, recognition, seals and old journals do not. */
export const TIME_WORM_CASE_IDS = ['delayed-observation', 'released-interval', 'withdrawn-delay'] as const;
export type TimeWormCaseId = typeof TIME_WORM_CASE_IDS[number];
export interface TimeWormOriginals { site: FateTrojanSiteState }
export type TimeWormConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type TimeWormWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
const STEPS = ['RECOVER_ENERGY', 'APPROACH', 'BASELINE_LOOK', 'DECLARE_LOOK', 'SHORT_TIME_THEFT', 'TIME_RELEASE', 'COMPARE_LABEL', 'EXECUTE_LOOK', 'CANCEL_LOOK', 'WAIT_1', 'WAIT_3', 'STOP_METHOD', 'EXIT_ROOM', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type TimeWormActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: TimeWormCaseId }
  | { type: 'PREPARE'; caseId: TimeWormCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'OWNER' | 'OBSERVER' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface TimeWormAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null; state: TimeWormWindow;
}
export interface TimeWormDeclaration {
  id: string; caseId: TimeWormCaseId; attempt: number; actionId: string;
  targetId: 'FT2-VICTOR'; parcelId: 'FT2-PARCEL'; action: 'LOOK_AT_ORIGINAL_LABEL';
  state: 'PENDING' | 'DELAYED' | 'EXECUTED' | 'CANCELLED'; declaredAt: number; baselineDueAt: number;
  delayStartedAt: number | null; dueAt: number; executedAt: number | null; cancelledAt: number | null; delayedSeconds: number;
}
export interface TimeWormAttempt {
  week: number; method: Method; closed: boolean; result: Result; elapsedSeconds: number;
  playerTravelMetres: number; linaTravelMetres: number; victorTravelMetres: number;
  playerEnergySpent: number; linaEnergySpent: number; victorEnergySpent: number; penniesSpent: number; spiritualitySpent: number; mindSpent: number;
  permission: { owner: TimeWormConsent; observer: TimeWormConsent; ability: TimeWormConsent }; permissionVersion: number;
  siteAtStart: FateTrojanSiteState; approached: boolean; baselineAt: number | null; declaration: TimeWormDeclaration | null;
  comparisonAttempted: boolean; comparisonAt: number | null; comparisonTier: PublicResolutionTier | null; comparisonBonus: 0 | 8;
  stopped: boolean; exited: boolean; theft: TimeWormAbilityUse; release: TimeWormAbilityUse;
}
export interface TimeWormLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: Result; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: TimeWormAttempt[];
}
export interface TimeWormLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface TimeWormLifeMovement {
  actor: 'PLAYER' | 'LINA'; from: FateTrojanLocation; to: 'DESK' | 'OUTSIDE'; mode: 'WALK'; metres: number; seconds: number; originalBody: true;
}
export interface TimeWormLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: TimeWormActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: TimeWormLifeBudget; after: TimeWormLifeBudget; finance: TimeWormFinanceSnapshot; elapsedSeconds: number;
  playerWalkedMetres: number; linaWalkedMetres: number; victorWalkedMetres: number;
  playerEnergySpent: number; linaEnergySpent: number; victorEnergySpent: number; playerEnergyRecovered: number; moves: TimeWormLifeMovement[];
  originalsBefore: TimeWormOriginals; originalsAfter: TimeWormOriginals;
  source: { caseId: TimeWormCaseId; atSeconds: number; permissionVersion: number; siteId: 'FT2-REGISTRY'; parcelId: 'FT2-PARCEL';
    playerLocation: FateTrojanLocation; targetLocation: FateTrojanSiteState['victor']['location']; observerLocation: FateTrojanSiteState['lina']['location'];
    declaration: TimeWormDeclaration | null; mastery: number; bonus: 0 | 8 } | null;
}
export interface TimeWormLifeState {
  sourceWeek: number | null; activeCase: TimeWormCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: FateTrojanLocation;
  playerTravelMetres: number; linaTravelMetres: number; victorTravelMetres: number;
  pending: { caseId: TimeWormCaseId; declarationId: string; createdAt: number; expiresAt: number; permissionVersion: number; state: 'STORED' | 'RELEASED'; bonus: 8 } | null;
  cases: Record<TimeWormCaseId, TimeWormLifeCase>; journal: TimeWormLifeReceipt[];
}
export interface TimeWormLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: TimeWormActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface TimeWormLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: TimeWormCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: FateTrojanLocation; playerTravelMetres: number; linaTravelMetres: number; victorTravelMetres: number;
  site: FateTrojanSiteState; declaration: TimeWormDeclaration | null; pending: TimeWormLifeState['pending']; pendingUsable: boolean; pendingRemainingSeconds: number; targetRemainingSeconds: number; currentAttempt: TimeWormAttempt | null;
  cases: { id: TimeWormCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: TimeWormAttempt[] }[];
  ledger: TimeWormLifeReceipt[]; actions: TimeWormLifeAction[];
}
const THEFT = 'error.s1.short-time-theft', RELEASE = 'error.s1.time-release';
const POSITION: Record<FateTrojanLocation, number> = { OUTSIDE: -2, ENTRY: 0, DESK: 2, CABINET: 6, YARD: -4 };
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 1;
const budget = (s: SliceState): TimeWormLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is TimeWormLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): TimeWormAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' });
const freshCase = (): TimeWormLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method, p: FateTrojanSiteState): TimeWormAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, linaTravelMetres: 0, victorTravelMetres: 0,
    playerEnergySpent: 0, linaEnergySpent: 0, victorEnergySpent: 0, penniesSpent: 20, spiritualitySpent: 0, mindSpent: 0,
    permission: { owner: 'UNASKED', observer: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0, siteAtStart: structuredClone(p),
    approached: false, baselineAt: null, declaration: null, comparisonAttempted: false, comparisonAt: null, comparisonTier: null, comparisonBonus: 0, stopped: false, exited: false, theft: freshUse(), release: freshUse() };
}
export function createTimeWormLifeState(): TimeWormLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE',
    playerTravelMetres: 0, linaTravelMetres: 0, victorTravelMetres: 0, pending: null,
    cases: { 'delayed-observation': freshCase(), 'released-interval': freshCase(), 'withdrawn-delay': freshCase() }, journal: [] };
}
export function timeWormOriginalSnapshot(s: SliceState): TimeWormOriginals { return { site: structuredClone(s.fateTrojan.life.site) }; }
function freshLife(week: number, originals: TimeWormOriginals): TimeWormLifeState {
  const l = createTimeWormLifeState(); l.sourceWeek = week; l.clockSeconds = originals.site.clockSeconds; l.playerLocation = originals.site.playerLocation; return l;
}
function validSource(o: TimeWormOriginals): boolean {
  const p = o?.site;
  return record(o) && shape(o, ['site']) && validateFateTrojanSiteState(p) && p.introducedWeek !== null && p.playerLocation === 'OUTSIDE' && p.lina.location === 'OUTSIDE' && p.victor.location === 'OUTSIDE' &&
    !p.cabinet.open && p.cabinet.recognitionHolder === 'OWNER' && p.link.holder === 'OWNER' && !p.link.returnPending && p.link.windowExpiresAt === null &&
    p.parcel.location === 'OUTSIDE' && p.fate.status === 'COMPLETED' && p.fate.escrowPennies === 0 &&
    p.seals.every(seal => seal.ownerId === 'FT2-LINA' && seal.location === 'DESK');
}
export function initializeTimeWormLifeState(s: SliceState): void {
  const source = s.timeWorm.sourceScene?.originals;
  if (!active(s) || !source || !validSource(source) || !same(s.timeWorm.life, createTimeWormLifeState()) || !same(timeWormOriginalSnapshot(s), source)) throw new Error('须保留实际原登记室、本人当前精力、原人和已在室外的唯一原包；晋升不补精力。');
  s.timeWorm.life = freshLife(s.week, source);
}
export function validateTimeWormActivityCommand(v: unknown): v is TimeWormActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && TIME_WORM_CASE_IDS.includes(v.caseId as TimeWormCaseId);
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && TIME_WORM_CASE_IDS.includes(v.caseId as TimeWormCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'OBSERVER', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isTimeWormActivityCommand = validateTimeWormActivityCommand;
const current = (l: TimeWormLifeState): TimeWormAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: TimeWormLifeState) => l.activeCase !== null || l.pending !== null;
export const hasTimeWormLifeLock = (s: SliceState): boolean => !!s.timeWorm?.life && locked(s.timeWorm.life);
interface Model { life: TimeWormLifeState; originals: TimeWormOriginals }
interface Audit { date: PublicGameDate; revision: number; finance: TimeWormFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: TimeWormActivityCommand) => c.type === 'SHORT_TIME_THEFT' || c.type === 'TIME_RELEASE';
const isCheck = (c: TimeWormActivityCommand) => isPower(c) || c.type === 'COMPARE_LABEL';
const allOutside = (p: FateTrojanSiteState) => p.playerLocation === 'OUTSIDE' && p.lina.location === 'OUTSIDE' && p.victor.location === 'OUTSIDE';
const lineVisible = (p: FateTrojanSiteState) => p.playerLocation === 'DESK' && p.lina.location === 'DESK' && p.victor.location === 'OUTSIDE' && p.parcel.location === 'OUTSIDE';
const permitted = (a: TimeWormAttempt | null) => !!a && a.permission.owner === 'GRANTED' && a.permission.observer === 'GRANTED';
const powerPermitted = (a: TimeWormAttempt | null) => permitted(a) && a!.permission.ability === 'GRANTED' && a!.method === 'ABILITY' && !a!.stopped;
function validPending(m: Model, state: 'STORED' | 'RELEASED'): boolean {
  const l = m.life, a = current(l), p = l.pending;
  return !!p && !!a?.declaration && p.state === state && p.caseId === l.activeCase && p.declarationId === a.declaration.id &&
    p.permissionVersion === a.permissionVersion && powerPermitted(a) && lineVisible(m.originals.site) && a.declaration.state === 'DELAYED' && l.clockSeconds + 1 < p.expiresAt;
}
function masteryAt(l: TimeWormLifeState, key: 'theft' | 'release'): number {
  return TIME_WORM_CASE_IDS.reduce((n, id) => n + (l.cases[id].status === 'RESOLVED' && l.cases[id].attempts.some(a => a[key].effects === 1) ? 8 : 0), 0);
}
function checkSpec(m: Model, c: TimeWormActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  if (c.type === 'SHORT_TIME_THEFT') return { ability: 'perception', difficulty: 18, modifiers: [{ source: '短时窃取掌握', value: Math.floor(masteryAt(m.life, 'theft') / 10) }] };
  if (c.type === 'TIME_RELEASE') return { ability: 'will', difficulty: 18, modifiers: [{ source: '暂存时段释放掌握', value: Math.floor(masteryAt(m.life, 'release') / 10) }] };
  return { ability: 'knowledge', difficulty: 16, modifiers: validPending(m, 'RELEASED') ? [{ source: '本次暂存时段用于真实标签比对', value: 8 }] : [] };
}
function audit(s: SliceState, c: TimeWormActivityCommand): Audit {
  const checked = isCheck(c), stat = c.type === 'SHORT_TIME_THEFT' ? 'perception' : c.type === 'TIME_RELEASE' ? 'will' : 'knowledge';
  return { date: structuredClone(s.date), revision: s.revision, finance: financeSnapshot(s), randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null,
    randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[stat] : null, check: null };
}
function transition(input: Model, c: TimeWormActivityCommand, week: number, outcome: PublicResolutionTier | null, before: TimeWormLifeBudget, clock: Audit): { model: Model; receipt: TimeWormLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, p = o.site, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  let a = current(l);
  const receipt: TimeWormLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before),
    elapsedSeconds: 0, playerWalkedMetres: 0, linaWalkedMetres: 0, victorWalkedMetres: 0, playerEnergySpent: 0, linaEnergySpent: 0, victorEnergySpent: 0, playerEnergyRecovered: 0, moves: [], originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: isCheck(c) && a && id ? { caseId: id, atSeconds: l.clockSeconds, permissionVersion: a.permissionVersion, siteId: p.siteId, parcelId: p.parcel.id,
      playerLocation: p.playerLocation, targetLocation: p.victor.location, observerLocation: p.lina.location, declaration: structuredClone(a.declaration),
      mastery: isPower(c) ? masteryAt(l, c.type === 'SHORT_TIME_THEFT' ? 'theft' : 'release') : 0, bonus: c.type === 'COMPARE_LABEL' && validPending(m, 'RELEASED') ? 8 : 0 } : null };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const endReserve = (state: TimeWormWindow) => { if (l.pending && a) { const use = l.pending.state === 'RELEASED' ? a.release : a.theft; if (use.effects === 0) use.state = state; l.pending = null; } };
  const spendEnergy = (actor: 'PLAYER' | 'LINA' | 'VICTOR', energy: number) => {
    if (actor === 'PLAYER') { p.playerEnergy -= energy; receipt.playerEnergySpent += energy; }
    else if (actor === 'LINA') { p.lina.energy -= energy; receipt.linaEnergySpent += energy; }
    else { p.victor.energy -= energy; receipt.victorEnergySpent += energy; }
  };
  const walk = (actor: 'PLAYER' | 'LINA', to: 'DESK' | 'OUTSIDE') => {
    const from = actor === 'PLAYER' ? p.playerLocation : p.lina.location;
    if (from === to) return;
    const metres = Math.abs(POSITION[from] - POSITION[to]);
    receipt.elapsedSeconds += metres; receipt.moves.push({ actor, from, to, mode: 'WALK', metres, seconds: metres, originalBody: true }); spendEnergy(actor, metres);
    if (actor === 'PLAYER') { p.playerLocation = to; l.playerLocation = to; p.playerTravelMetres += metres; receipt.playerWalkedMetres += metres; }
    else { p.lina.location = to; p.lina.travelMetres += metres; receipt.linaWalkedMetres += metres; }
  };
  const cancel = () => { if (a?.declaration && ['PENDING', 'DELAYED'].includes(a.declaration.state)) { a.declaration.state = 'CANCELLED'; a.declaration.cancelledAt = l.clockSeconds + receipt.elapsedSeconds; } };
  const finishContact = () => {
    if (!a || !r) return;
    a.closed = true; r.contactOpen = false; r.returned = true; l.activeCase = null;
    for (const key of ['owner', 'observer', 'ability'] as const) if (a.permission[key] === 'GRANTED' || a.permission[key] === 'UNASKED') a.permission[key] = 'CLOSED';
  };
  const physical = !!a && !!r && r.status === 'ACTIVE' && !a.closed && a.week === week;
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  const refusal = () => !!a && Object.values(a.permission).some(v => v === 'DECLINED' || v === 'WITHDRAWN');
  const resolvedAction = () => !!a && (a.declaration?.state === 'EXECUTED' || a.declaration?.state === 'CANCELLED' || refusal());
  switch (c.type) {
    case 'RECOVER_ENERGY':
      if (locked(l) || !allOutside(p) || p.playerEnergy >= 100) return null;
      pay(1, 15); receipt.elapsedSeconds = 60; receipt.playerEnergyRecovered = Math.min(20, 100 - p.playerEnergy); p.playerEnergy += receipt.playerEnergyRecovered; break;
    case 'OBSERVE': {
      const index = TIME_WORM_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || !allOutside(p) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[TIME_WORM_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 2; break;
    }
    case 'PREPARE':
      if (locked(l) || !allOutside(p) || p.playerEnergy < 9 || p.lina.energy < 9 || p.victor.energy < 2 || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 ||
        r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!)) return null;
      pay(1, 20); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method, p));
      a = r!.attempts.at(-1)!; l.activeCase = c.caseId; receipt.elapsedSeconds = 2; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'OBSERVER' ? 'observer' : 'ability';
      if (!physical || a!.exited || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') ||
        c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (c.type !== 'CONSENT') { endReserve('STOPPED'); if (key === 'owner') cancel(); }
      receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 1; break;
    }
    case 'APPROACH':
      if (!physical || !permitted(a) || a!.permission.ability === 'UNASKED' || a!.approached || !allOutside(p) || p.playerEnergy < 9 || p.lina.energy < 9) return null;
      walk('PLAYER', 'DESK'); walk('LINA', 'DESK'); a!.approached = true; break;
    case 'BASELINE_LOOK':
      if (!physical || !permitted(a) || !lineVisible(p) || a!.baselineAt !== null || a!.declaration || p.victor.energy < 2 || p.lina.energy < 5) return null;
      receipt.elapsedSeconds = 1; spendEnergy('VICTOR', 1); spendEnergy('LINA', 1); a!.baselineAt = l.clockSeconds + 1; break;
    case 'DECLARE_LOOK': {
      if (!physical || !permitted(a) || !lineVisible(p) || a!.baselineAt === null || a!.declaration || p.victor.energy < 1) return null;
      const number = r!.attempts.length, actionId = `TW1:${id}:${number}:look`;
      receipt.elapsedSeconds = 1; a!.declaration = { id: actionId, caseId: id!, attempt: number, actionId, targetId: 'FT2-VICTOR', parcelId: 'FT2-PARCEL', action: 'LOOK_AT_ORIGINAL_LABEL',
        state: 'PENDING', declaredAt: l.clockSeconds + 1, baselineDueAt: l.clockSeconds + 2, delayStartedAt: null, dueAt: l.clockSeconds + 2, executedAt: null, cancelledAt: null, delayedSeconds: 0 }; break;
    }
    case 'SHORT_TIME_THEFT': {
      const d = a?.declaration;
      if (!physical || !powerPermitted(a) || !lineVisible(p) || !d || d.state !== 'PENDING' || l.clockSeconds >= d.baselineDueAt || l.pending || r!.attempts.some(x => x.theft.attempts > 0)) return null;
      pay(0, 0, 8, 2); receipt.elapsedSeconds = 1; a!.spiritualitySpent += 8; a!.mindSpent += 2;
      a!.theft = { attempts: 1, successes: success(outcome) ? 1 : 0, effects: 0, tier: outcome, state: success(outcome) ? 'ACTIVE' : 'FAILED' };
      if (success(outcome)) { d.state = 'DELAYED'; d.delayStartedAt = l.clockSeconds + 1; d.dueAt = d.delayStartedAt + 3;
        l.pending = { caseId: id!, declarationId: d.id, createdAt: d.delayStartedAt, expiresAt: d.dueAt, permissionVersion: a!.permissionVersion, state: 'STORED', bonus: 8 }; }
      break;
    }
    case 'TIME_RELEASE':
      if (!physical || !validPending(m, 'STORED') || a!.release.attempts > 0) return null;
      pay(0, 0, 6, 2); receipt.elapsedSeconds = 1; a!.spiritualitySpent += 6; a!.mindSpent += 2;
      a!.release = { attempts: 1, successes: success(outcome) ? 1 : 0, effects: 0, tier: outcome, state: success(outcome) ? 'ACTIVE' : 'FAILED' };
      if (success(outcome)) l.pending!.state = 'RELEASED'; else endReserve('STOPPED'); break;
    case 'COMPARE_LABEL': {
      if (!physical || !permitted(a) || !lineVisible(p) || !a!.declaration || a!.declaration.state === 'CANCELLED' || a!.comparisonAttempted || p.playerEnergy < 5) return null;
      const helped = validPending(m, 'RELEASED'); receipt.elapsedSeconds = 1; spendEnergy('PLAYER', 1);
      a!.comparisonAttempted = true; a!.comparisonAt = l.clockSeconds + 1; a!.comparisonTier = outcome; a!.comparisonBonus = helped ? 8 : 0;
      if (helped) { a!.release.effects = 1; a!.release.state = 'APPLIED'; a!.result = 'ABILITY'; endReserve('APPLIED'); }
      break;
    }
    case 'EXECUTE_LOOK': {
      const d = a?.declaration;
      if (!physical || !d || !['PENDING', 'DELAYED'].includes(d.state) || a!.permission.owner !== 'GRANTED' || p.victor.location !== 'OUTSIDE' || p.victor.energy < 1 ||
        d.state === 'DELAYED' && l.clockSeconds < d.dueAt || d.state === 'PENDING' && l.clockSeconds + 1 < d.dueAt) return null;
      receipt.elapsedSeconds = 1; spendEnergy('VICTOR', 1); d.state = 'EXECUTED'; d.executedAt = l.clockSeconds + 1;
      if (d.delayStartedAt !== null && d.delayedSeconds > 0) { a!.theft.effects = 1; a!.theft.state = 'APPLIED'; a!.result = 'ABILITY'; }
      else if (a!.result === 'NONE') a!.result = 'ORDINARY'; endReserve('EXPIRED'); break;
    }
    case 'CANCEL_LOOK':
      if (!physical || !a!.declaration || !['PENDING', 'DELAYED'].includes(a!.declaration.state)) return null;
      endReserve('STOPPED'); cancel(); a!.result = a!.result === 'ABILITY' ? 'ABILITY' : 'ORDINARY'; break;
    case 'WAIT_1': case 'WAIT_3':
      if (!physical || !a!.declaration || a!.declaration.state !== 'DELAYED' || l.clockSeconds >= a!.declaration.dueAt) return null;
      receipt.elapsedSeconds = c.type === 'WAIT_1' ? 1 : 3; break;
    case 'STOP_METHOD':
      if (!physical || a!.stopped || !l.pending) return null;
      a!.stopped = true; endReserve('STOPPED'); break;
    case 'EXIT_ROOM':
      if (!physical || a!.exited || !resolvedAction() || l.pending || a!.declaration && ['PENDING', 'DELAYED'].includes(a!.declaration.state)) return null;
      walk('PLAYER', 'OUTSIDE'); walk('LINA', 'OUTSIDE'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || !a!.exited || !allOutside(p) || l.pending || !resolvedAction()) return null;
      if (a!.result === 'NONE') a!.result = 'ORDINARY'; r!.result = a!.result; r!.status = 'EXAMINED'; receipt.elapsedSeconds = 1; finishContact(); break;
    case 'ABORT':
      if (!physical) return null;
      endReserve('STOPPED'); cancel(); walk('PLAYER', 'OUTSIDE'); walk('LINA', 'OUTSIDE'); a!.exited = true;
      if (resolvedAction() && a!.result === 'NONE') a!.result = 'ORDINARY';
      r!.result = a!.result; r!.status = a!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; finishContact(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !allOutside(p)) return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 2; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !TIME_WORM_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED') || !allOutside(p)) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 2; break;
  }
  if (!validBudget(receipt.after) || !integer(p.playerEnergy, 0, 100) || !integer(p.lina.energy, 0, 100) || !integer(p.victor.energy, 0, 100)) return null;
  const endAt = l.clockSeconds + receipt.elapsedSeconds;
  if (a?.declaration?.delayStartedAt !== null && a?.declaration?.delayStartedAt !== undefined) {
    const d = a.declaration, actualEnd = d.cancelledAt === null ? endAt : Math.min(endAt, d.cancelledAt);
    d.delayedSeconds = Math.max(d.delayedSeconds, Math.max(0, Math.min(actualEnd, d.dueAt) - d.delayStartedAt!));
  }
  l.clockSeconds = endAt; l.elapsedSeconds += receipt.elapsedSeconds; p.clockSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.linaTravelMetres += receipt.linaWalkedMetres; l.victorTravelMetres += receipt.victorWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.linaTravelMetres += receipt.linaWalkedMetres; a.victorTravelMetres += receipt.victorWalkedMetres;
    a.playerEnergySpent += receipt.playerEnergySpent; a.linaEnergySpent += receipt.linaEnergySpent; a.victorEnergySpent += receipt.victorEnergySpent; }
  if (l.pending && l.clockSeconds >= l.pending.expiresAt) endReserve('EXPIRED');
  if (!validateFateTrojanSiteState(p)) return null;
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}

function financeSnapshot(s: TimeWormFinanceSnapshot): TimeWormFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: unknown, week: number): v is TimeWormFinanceSnapshot {
  if (!record(v) || !shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) || !integer(v.weeklyBudget, 1, 100) ||
    typeof v.lifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.lifeTier) || typeof v.nextLifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.nextLifeTier) ||
    !integer(v.missedWeeks) || !['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) || !Array.isArray(v.debts)) return false;
  return new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d => record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
    typeof d.id === 'string' && d.id.length > 0 && typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** The same ordinary BILL/DEBTS resolver used by the main weekly pulse. An open
 * practice never advances the week, even after its invitation spends the last AP. */
function lifeBoundary(e: TimeWormLifeReceipt, isLocked: boolean) {
  const b = structuredClone(e.after), finance = structuredClone(e.finance);
  if (b.actions > 0 || isLocked) return { budget: b, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: b.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...b, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: financeSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
function completedLifeBudgetMatches(s: SliceState, e: TimeWormLifeReceipt, isLocked: boolean): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(budget(s), expected.budget) || !same(financeSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null) return false;
  if (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: TimeWormLifeState, s: SliceState): Model | null {
  const source = s.timeWorm.sourceScene?.originals;
  if (!source || !validSource(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 700) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: TimeWormLifeReceipt | null = null, previousLocked = false, lastWeek = l.sourceWeek, lastRandomAfter = s.timeWorm.sourceScene!.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'linaWalkedMetres', 'victorWalkedMetres', 'playerEnergySpent', 'linaEnergySpent', 'victorEnergySpent', 'playerEnergyRecovered', 'moves', 'originalsBefore', 'originalsAfter', 'source']) || !validateTimeWormActivityCommand(entry.command) ||
      !integer(entry.week, lastWeek, s.week) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.timeWorm.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (locked(model.life) && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || !same(entry.finance, previous.finance) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      const spec = checkSpec(model, entry.command);
      if (entry.checkBase !== s.character.coreStats[spec.ability] || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const rng = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore), expected = resolveNormalCheck({ ...spec, baseAbility: entry.checkBase, roll: rng.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.outcome !== null || entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1) {
      const expected = lifeBoundary(previous, previousLocked);
      if (entry.week !== expected.week || !same(entry.date, expected.date) || !same(entry.before, expected.budget) || !same(entry.finance, expected.finance) || expected.eventId !== null || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
    }
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry);
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; model.life.journal.push(structuredClone(entry)); previous = entry; previousLocked = locked(model.life); lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function timeWormExpectedOriginals(s: SliceState): TimeWormOriginals | null {
  const l = s.timeWorm.life;
  if (l.sourceWeek === null) return s.timeWorm.sourceScene ? structuredClone(s.timeWorm.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function timeWormLifeMasteryGains(s: SliceState): Record<typeof THEFT | typeof RELEASE, number> {
  return { [THEFT]: masteryAt(s.timeWorm.life, 'theft'), [RELEASE]: masteryAt(s.timeWorm.life, 'release') };
}
function oldSceneOpen(s: SliceState): boolean {
  return s.fateTrojan.life.activeCase !== null || Object.values(s.fateTrojan.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.fateTrojan.preparedWeek !== null ||
    ['READY', 'FIGHTING'].includes(s.fateTrojan.encounter.status) || s.deceitMentor.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.deceitMentor.encounter.status);
}
export function validateTimeWormLifeState(s: SliceState): boolean {
  try {
    const l = s.timeWorm?.life;
    if (!record(l) || !shape(l, Object.keys(createTimeWormLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, TIME_WORM_CASE_IDS)) return false;
    if (s.timeWorm.promotionWeek === null) return same(l, createTimeWormLifeState());
    const source = s.timeWorm.sourceScene?.originals, history = s.timeWorm.sourceHistory?.fateTrojan.life;
    if (!source || !history || !validSource(source) || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.timeWorm.promotionWeek ||
      !same(source.site, history.site) || !same(s.fateTrojan.life.cases, history.cases) || !same(s.fateTrojan.life.journal, history.journal) ||
      s.fateTrojan.life.activeCase !== history.activeCase || s.fateTrojan.life.reflected !== history.reflected) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(timeWormOriginalSnapshot(s), replay.originals)) return false;
    const gains = timeWormLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of TIME_WORM_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `time-worm-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'time-worm-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[THEFT] ?? 0) < gains[THEFT] || (s.progression.mastery[RELEASE] ?? 0) < gains[RELEASE]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.timeWorm.preparedWeek !== null ||
      ['READY', 'FIGHTING'].includes(s.timeWorm.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !completedLifeBudgetMatches(s, last, locked(l))) return false;
    return true;
  } catch { return false; }
}
export const validateTimeWormLife = validateTimeWormLifeState;
export function blockTimeWormLife(s: SliceState, c: TimeWormActivityCommand): string | null {
  if (!validateTimeWormActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为时之虫。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.timeWorm.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.timeWorm.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateTimeWormLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.timeWorm.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先核对当前许可、实际位置、待执行动作、精力与成本。每个声明只能各尝试一次；目标仍须等到自己的时间，普通退出不耗行动。';
  return null;
}
export const blockTimeWormActivity = blockTimeWormLife;
function writeOriginals(s: SliceState, o: TimeWormOriginals): void {
  const live = s.fateTrojan.life.site, next = o.site;
  live.clockSeconds = next.clockSeconds; live.playerLocation = next.playerLocation; live.playerTravelMetres = next.playerTravelMetres; live.playerEnergy = next.playerEnergy;
  for (const key of ['lina', 'victor'] as const) { live[key].location = next[key].location; live[key].travelMetres = next[key].travelMetres; live[key].energy = next[key].energy; }
}
export function applyTimeWormLifeCommand(s: SliceState, c: TimeWormActivityCommand, ctx: SeerContext): void {
  const reason = blockTimeWormLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.timeWorm.life, s)!, before = budget(s), clock = audit(s, c); let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock);
  if (!next) throw new Error('本次真实结果不能改变已记录的现场前提。');
  const l = next.model.life; l.journal.push(next.receipt); s.timeWorm.life = l; writeOriginals(s, next.model.originals);
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`time-worm-case:${c.caseId}`);
    for (const [ability, key] of [[THEFT, 'theft'], [RELEASE, 'release']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('time-worm-reflection'); }
  ctx.note(LABELS[c.type], `${DETAILS[c.type]}${check ? `本次${success(check.tier) ? '成功' : '失败'}，实付代价与检定均保留。` : ''}本步实际经过${next.receipt.elapsedSeconds}秒，本人步行${next.receipt.playerWalkedMetres}米、莉娜步行${next.receipt.linaWalkedMetres}米。`);
}
export const applyTimeWormActivity = applyTimeWormLifeCommand;
const CASES = [
  { id: 'delayed-observation', title: '一次尚未执行的普通查看', story: '重新询问维克托与莉娜本案意愿。维克托留在室外原包旁，本人与莉娜各走四米到登记桌；先看一次普通基线，再声明另一次尚未执行的查看。短时窃取成功后，目标须真实等待三秒才能查看。' },
  { id: 'released-interval', title: '把本人的暂存时段用于一次比对', story: '仍是同一原成人和室外原包。只有本次真实取得而尚未用掉的三秒时段才能尝试释放；成功后，本人的下一次标签比对在到期前结束才获得8点帮助。比对仍耗精力和时间，目标原来的等待并未取消。' },
  { id: 'withdrawn-delay', title: '撤回后保留真实经过的时间', story: '当前许可可以撤回。未用的本人时段立即消散，已经流逝的时间、已付灵性与精神均不返还。原主可取消尚未执行的查看，本人与莉娜仍须各自普通步行离场，原包和已结清搬运保持原样。' },
] as const;
const LABELS: Record<TimeWormActivityCommand['type'], string> = {
  RECOVER_ENERGY: '在室外实付休整并恢复20精力', OBSERVE: '核对同一原人与本案普通做法', PREPARE: '支付本案准备费并重新询问意愿', CONSENT: '同意本案这一项用途', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可',
  APPROACH: '本人与莉娜各走四米到登记桌', BASELINE_LOOK: '维克托先普通查看同一原包标签', DECLARE_LOOK: '声明另一次尚未执行的查看', SHORT_TIME_THEFT: '尝试短时窃取这一次待执行查看', TIME_RELEASE: '尝试释放本人的未用暂存时段', COMPARE_LABEL: '亲自比对同一原包标签', EXECUTE_LOOK: '维克托实际执行已声明的普通查看', CANCEL_LOOK: '取消尚未执行的查看',
  WAIT_1: '实际等候一秒', WAIT_3: '实际等候三秒', STOP_METHOD: '停止本人尚未用掉的时段', EXIT_ROOM: '本人与莉娜沿普通道路实际退出', LEAVE: '结束本案接触', ABORT: '停止、取消待执行查看并普通离场', REPORT: '报告实际结果与普通退出', REFLECT: '反思有限时间、实际行动与当前许可',
};
const DETAILS: Record<TimeWormActivityCommand['type'], string> = {
  RECOVER_ENERGY: '本人须已在室外且无开放现场；实付15便士与1行动，真实休整60秒，恢复20精力至多100。', OBSERVE: '核对原柜、原主识别联系、唯一室外原包和已结清的12便士搬运；没有领取旧封签。', PREPARE: '实付20便士与1行动。本次许可重新询问，旧许可不沿用，没有新物品。', CONSENT: '只同意当前本案这一项用途，仍可撤回。', DECLINE_CONSENT: '拒绝已记录，普通退出仍可执行。', WITHDRAW_CONSENT: '未用时段立即停止；原主撤回时取消待执行查看，已流逝时间不返还。',
  APPROACH: '本人和莉娜分别走四米，各实耗4精力；维克托留在室外同一原包旁。', BASELINE_LOOK: '原主普通查看1秒并消耗1精力，莉娜实际观察消耗1精力。', DECLARE_LOOK: '当面声明同一原主的另一次普通查看；声明唯一，不能窃取已经发生的动作。', SHORT_TIME_THEFT: '实付8灵性、2精神并经过1秒，感知18加实际掌握。成功从施用结束起延迟这一次查看3秒；失败仍保留费用。', TIME_RELEASE: '实付6灵性、2精神并经过1秒，意志18加实际掌握。只使用自己的当前未用时段；失败也不能重抽。', COMPARE_LABEL: '本人实耗1精力和1秒，以知识16检定。有效释放只有在本次比对结束严格早于到期时才加8，成功或失败均算一次实际应用。', EXECUTE_LOOK: '原主实际查看1秒并消耗1精力；被延迟的查看须已经等到时限，不能抹去先前等待。', CANCEL_LOOK: '取消尚未执行的查看，未用时段消散，实际已过时间和费用仍保留。',
  WAIT_1: '本地时钟真实前进1秒，不增加行动或改变周历。', WAIT_3: '本地时钟真实前进3秒，不增加行动或改变周历。', STOP_METHOD: '停止本人未用时段，不取消目标仍在经历的三秒延迟，不返还时间或费用。', EXIT_ROOM: '本人和莉娜分别从当前实际位置普通步行到室外，各自扣除步行精力；维克托仍在原包旁。', LEAVE: '三人已在室外，待执行查看已经完成或取消，结束这次接触。', ABORT: '停止未用时段、取消尚未执行的查看，再按实际位置步行离场；不能传送或补充精力。', REPORT: '实付1行动并如实增加25扮演；短窃须目标实际延迟后执行，释放须真实比对收到帮助，对应掌握每案至多8。', REFLECT: '三案报告后实付1行动，增加25扮演。原人、原物和已付费用持续保留。',
};
const COSTS: Partial<Record<TimeWormActivityCommand['type'], string>> = {
  RECOVER_ENERGY: '1行动 · 15便士 · 60秒 · +20精力（上限100）', OBSERVE: '0行动 · 2秒', PREPARE: '1行动 · 20便士 · 2秒',
  CONSENT: '0行动 · 1秒', DECLINE_CONSENT: '0行动 · 1秒', WITHDRAW_CONSENT: '0行动 · 立即撤回 · 不返还时间与成本',
  APPROACH: '0行动 · 两人各4米、4精力 · 合计8秒', BASELINE_LOOK: '0行动 · 1秒 · 维克托与莉娜各1精力', DECLARE_LOOK: '0行动 · 1秒',
  SHORT_TIME_THEFT: '0行动 · 8灵性＋2精神 · 感知18＋掌握 · 1秒／延迟3秒', TIME_RELEASE: '0行动 · 6灵性＋2精神 · 意志18＋掌握 · 1秒',
  COMPARE_LABEL: '0行动 · 1精力 · 1秒 · 知识16 · 有效帮助+8', EXECUTE_LOOK: '0行动 · 维克托1精力 · 1秒', CANCEL_LOOK: '0行动 · 立即取消 · 不返还已过时间',
  WAIT_1: '0行动 · 实际1秒', WAIT_3: '0行动 · 实际3秒', STOP_METHOD: '0行动 · 立即停止本人时段 · 目标延迟保留',
  EXIT_ROOM: '0行动 · 实际步行 · 每人每米1精力、1秒', LEAVE: '0行动 · 1秒', ABORT: '0行动 · 按真实位置普通步行离场', REPORT: '1行动 · 2秒 · 扮演25', REFLECT: '1行动 · 2秒 · 扮演25',
};
export function timeWormLifeActions(s: SliceState): TimeWormLifeAction[] {
  if (!active(s)) return [];
  const l = s.timeWorm.life, p = s.fateTrojan.life.site, a = current(l), out: TimeWormLifeAction[] = [];
  const add = (command: TimeWormActivityCommand, preferred = false, cleanup = false, label?: string) => {
    const reason = blockTimeWormLife(s, command);
    out.push({ id: `time-worm-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`,
      label: label ?? LABELS[command.type], cost: COSTS[command.type] ?? '0行动', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup });
  };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (p.playerEnergy < 100) step('RECOVER_ENERGY', !!next && p.playerEnergy < 9, true);
    if (!next) { if (!l.reflected) step('REFLECT'); return out; }
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, p.playerEnergy >= 9);
    else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true);
    else {
      if (r.status !== 'PAUSED') add({ type: 'PREPARE', caseId: next.id, method: 'ABILITY' }, p.playerEnergy >= 9, false, '实付20便士，说明本案有限能力并重新询问意愿');
      add({ type: 'PREPARE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED' && p.playerEnergy >= 9, false, '实付20便士，以普通方式完成本案');
    }
    return out;
  }
  const d = a.declaration, id = l.activeCase!, declinedPeople = [a.permission.owner, a.permission.observer].some(v => v === 'DECLINED' || v === 'WITHDRAWN');
  if (a.exited) step('LEAVE', true, true);
  else if (declinedPeople || d?.state === 'CANCELLED' || d?.state === 'EXECUTED') {
    if (d && ['PENDING', 'DELAYED'].includes(d.state)) step('CANCEL_LOOK', true, true);
    else step('EXIT_ROOM', true, true);
  } else {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.observer === 'UNASKED' ? 'OBSERVER' : a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) {
      if (permission !== 'ABILITY' || a.method === 'ABILITY') add({ type: 'CONSENT', permission }, true, false, permission === 'OWNER' ? '询问维克托这一次查看与原包用途' : permission === 'OBSERVER' ? '询问莉娜这一次观察意愿' : '询问这一次短时窃取与释放许可');
      add({ type: 'DECLINE_CONSENT', permission }, permission === 'ABILITY' && a.method === 'ORDINARY', true);
    } else if (!a.approached) step('APPROACH');
    else if (a.baselineAt === null) step('BASELINE_LOOK');
    else if (!d) step('DECLARE_LOOK');
    else if (d.state === 'PENDING') {
      const canCast = powerPermitted(a) && a.theft.attempts === 0 && l.clockSeconds < d.baselineDueAt;
      if (canCast) step('SHORT_TIME_THEFT'); step('EXECUTE_LOOK', !canCast);
    } else if (d.state === 'DELAYED') {
      if (id === 'withdrawn-delay' && a.permission.owner === 'GRANTED' && a.permission.ability === 'GRANTED') {
        if (d.delayedSeconds === 0) step('WAIT_1'); else add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, true, true, '维克托撤回本案许可并取消待查看动作');
      } else if (id === 'released-interval' && l.pending?.state === 'STORED' && a.release.attempts === 0 && validPending({ life: l, originals: { site: p } }, 'STORED')) step('TIME_RELEASE');
      else if (l.pending?.state === 'RELEASED' && !a.comparisonAttempted) step('COMPARE_LABEL');
      else if (l.clockSeconds < d.dueAt) step(d.dueAt - l.clockSeconds === 3 ? 'WAIT_3' : 'WAIT_1', true, true);
      else step('EXECUTE_LOOK');
    }
  }
  if (!a.exited && a.declaration && !a.comparisonAttempted && !out.some(x => x.command.type === 'COMPARE_LABEL') && !declinedPeople && a.declaration.state !== 'CANCELLED') step('COMPARE_LABEL', false);
  if (l.pending) {
    step('STOP_METHOD', false, true);
    if (!out.some(x => x.command.type === 'WAIT_1')) step('WAIT_1', false, true);
    if (!out.some(x => x.command.type === 'WAIT_3')) step('WAIT_3', false, true);
  }
  if (!a.exited && a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true);
  if (!a.exited && a.permission.owner === 'GRANTED' && !out.some(x => x.command.type === 'WITHDRAW_CONSENT' && x.command.permission === 'OWNER')) add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, false, true);
  step('ABORT', false, true);
  return out;
}
export function projectTimeWormLife(s: SliceState): TimeWormLifeProjection {
  const l = s.timeWorm.life, originals = timeWormOriginalSnapshot(s), actions = timeWormLifeActions(s), model = { life: l, originals }, a = current(l), d = a?.declaration ?? null;
  return { title: '原登记室、一次待执行查看与三秒时间', story: '只改变同一成人的一次尚未执行动作。短窃成功后目标真实等待三秒，释放只帮助本人下一次在到期前结束的实际标签比对；失败、到期、停止和撤回都保留真实经过的时间与费用。',
    source: `同一39岁莉娜、43岁维克托与FT2原登记室。唯一原包仍在室外，原搬运已付${originals.site.fate.paidToPlayer}便士并结清；原柜、原主识别联系及莉娜的原封签均保留原状。`,
    environment: '室外负2米、入口0米、登记桌2米、原柜6米。本人与莉娜各走四米到登记桌，维克托留在室外同一原包旁。步行每米各耗1秒、1精力；门外普通出口始终开放。',
    activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, linaTravelMetres: l.linaTravelMetres, victorTravelMetres: l.victorTravelMetres,
    site: originals.site, declaration: structuredClone(d), pending: structuredClone(l.pending), pendingUsable: !!l.pending && validPending(model, l.pending.state), pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - l.clockSeconds) : 0,
    targetRemainingSeconds: d?.state === 'DELAYED' ? Math.max(0, d.dueAt - l.clockSeconds) : 0, currentAttempt: structuredClone(a),
    cases: CASES.map(def => { const r = l.cases[def.id]; return { id: def.id, title: def.title, story: def.story, observations: r.observedWeek === null ? [] : [def.story, '不复制原包、不重开搬运报酬、不挪用莉娜原封签；精力与当地时间连续。'], status: r.status, method: r.method,
      result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限效果已实际应用，原人仍沿普通道路离场；已付费用与等待保留。' : '以普通动作完成，或尊重当前拒绝、撤回与取消；没有未应用的能力奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }),
    ledger: structuredClone(l.journal), actions };
}
