import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { StarKeyFinanceSnapshot } from './types.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { projectPlaneswalkerSite } from '../planeswalker/life.js';
import { projectStarKeyCheck } from './combat.js';
import { PLANESWALKER_POSITION_METRES, validatePlaneswalkerSiteState, type PlaneswalkerSiteState, type PlaneswalkerLocalLocation } from '../planeswalker/resources.js';

/** Finite original design. The original PW2 site stays authoritative. This
 * journal changes its current physical fields, never its old cases/history,
 * remote inventory, archived protection, lamp oil or screen demonstrations. */
export const STAR_KEY_CASE_IDS = ['endpoint-verification', 'anchor-transfer', 'withdrawn-return'] as const;
export type StarKeyCaseId = typeof STAR_KEY_CASE_IDS[number];
export interface StarKeyOriginals { site: PlaneswalkerSiteState }
export type StarKeyConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type StarKeyWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'CHECK_FAILED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
const STEPS = ['WALK_TO_ROOM', 'READ_SOURCE', 'AGREE_RETURN', 'OPEN_DOOR', 'CLOSE_DOOR', 'INSPECT_PADS', 'READ_RETURN_MARKER', 'TAKE_PARCEL', 'WALK_NEAR', 'OBSERVE_ENDPOINT', 'ENDPOINT_LOCATION', 'WALK_VERIFY', 'MANUAL_VERIFY', 'ANCHOR_MAINTENANCE', 'WALK_CARRY', 'WALK_ENTRY', 'RETURN_PARCEL', 'STOP_METHOD', 'WAIT_WINDOW', 'EXIT_ROOM', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type StarKeyActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: StarKeyCaseId }
  | { type: 'INVITE'; caseId: StarKeyCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'OWNER' | 'OPERATOR' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface StarKeyAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: StarKeyWindow; remainingSeconds: number; conditionVersion: number | null; clue: string | null;
}
export interface StarKeyEndpointObservation {
  atSeconds: number; conditionVersion: number; from: 'NEAR'; to: 'FAR'; distanceMetres: 4;
  parcelId: 'PW2-PARCEL'; doorOperations: number;
}
export interface StarKeyAttempt {
  week: number; method: Method; closed: boolean; result: Result; elapsedSeconds: number;
  playerTravelMetres: number; maraTravelMetres: number; operatorEnergySpent: number; penniesSpent: number; spiritualitySpent: number; mindSpent: number;
  permission: { owner: StarKeyConsent; operator: StarKeyConsent; ability: StarKeyConsent }; permissionVersion: number;
  sourceRead: boolean; returnAgreed: boolean; padsChecked: boolean; returnMarkerChecked: boolean;
  parcelTaken: boolean; parcelReturned: boolean; doorOperations: number; observedVersions: number[]; endpointObservation: StarKeyEndpointObservation | null;
  walkVerifyAttempted: boolean; verifyTier: PublicResolutionTier | null; walkVerified: boolean; manualVerified: boolean;
  walkCarryAttempted: boolean; carryTier: PublicResolutionTier | null; walkCarried: boolean; exited: boolean;
  endpoint: StarKeyAbilityUse; anchor: StarKeyAbilityUse;
}
export interface StarKeyLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: Result; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: StarKeyAttempt[];
}
export interface StarKeyLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface StarKeyLifeMovement {
  actor: 'PLAYER' | 'MARA'; from: PlaneswalkerLocalLocation; to: PlaneswalkerLocalLocation;
  mode: 'WALK'; metres: number; seconds: number; originalBody: true; parcelId: 'PW2-PARCEL' | null;
}
export interface StarKeyLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: StarKeyActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: StarKeyLifeBudget; after: StarKeyLifeBudget; finance: StarKeyFinanceSnapshot; elapsedSeconds: number;
  playerWalkedMetres: number; maraWalkedMetres: number; operatorEnergySpent: number; moves: StarKeyLifeMovement[];
  originalsBefore: StarKeyOriginals; originalsAfter: StarKeyOriginals;
  source: { caseId: StarKeyCaseId; atSeconds: number; conditionVersion: number; permissionVersion: number; siteId: 'PW2-TRANSIT-HALL'; parcelId: 'PW2-PARCEL';
    playerLocation: PlaneswalkerLocalLocation; operatorLocation: PlaneswalkerLocalLocation; doorState: PlaneswalkerSiteState['door']['state']; observation: StarKeyEndpointObservation | null; bonus: 0 | 10 } | null;
}
export interface StarKeyLifeState {
  sourceWeek: number | null; activeCase: StarKeyCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: PlaneswalkerLocalLocation; playerTravelMetres: number; maraTravelMetres: number; conditionVersion: number;
  pending: { kind: 'ENDPOINT' | 'ANCHOR'; caseId: StarKeyCaseId; createdAt: number; expiresAt: number; conditionVersion: number; permissionVersion: number;
    from: 'NEAR'; to: 'FAR'; parcelId: 'PW2-PARCEL'; bonus: 10 } | null;
  cases: Record<StarKeyCaseId, StarKeyLifeCase>; journal: StarKeyLifeReceipt[];
}
export interface StarKeyLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: StarKeyActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface StarKeyLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: StarKeyCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: PlaneswalkerLocalLocation; playerTravelMetres: number; maraTravelMetres: number; conditionVersion: number;
  site: PlaneswalkerSiteState; maraPresent: boolean; pending: StarKeyLifeState['pending']; pendingUsable: boolean; pendingRemainingSeconds: number; currentAttempt: StarKeyAttempt | null;
  cases: { id: StarKeyCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: StarKeyAttempt[] }[];
  ledger: StarKeyPublicLifeReceipt[]; actions: StarKeyLifeAction[];
}
const ENDPOINT = 'door.s1.endpoint-location', ANCHOR = 'door.s1.anchor-maintenance';
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 1;
const budget = (s: SliceState): StarKeyLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is StarKeyLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): StarKeyAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null, clue: null });
const freshCase = (): StarKeyLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method): StarKeyAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, maraTravelMetres: 0, operatorEnergySpent: 0, penniesSpent: 10, spiritualitySpent: 0, mindSpent: 0,
    permission: { owner: 'UNASKED', operator: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0, sourceRead: false, returnAgreed: false, padsChecked: false, returnMarkerChecked: false,
    parcelTaken: false, parcelReturned: false, doorOperations: 0, observedVersions: [], endpointObservation: null,
    walkVerifyAttempted: false, verifyTier: null, walkVerified: false, manualVerified: false, walkCarryAttempted: false, carryTier: null, walkCarried: false, exited: false,
    endpoint: freshUse(), anchor: freshUse() };
}
export function createStarKeyLifeState(): StarKeyLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, maraTravelMetres: 0, conditionVersion: 1,
    pending: null, cases: { 'endpoint-verification': freshCase(), 'anchor-transfer': freshCase(), 'withdrawn-return': freshCase() }, journal: [] };
}
export function starKeyOriginalSnapshot(s: SliceState): StarKeyOriginals { return { site: structuredClone(s.planeswalker.life.site) }; }
function freshLife(week: number, originals: StarKeyOriginals): StarKeyLifeState {
  const l = createStarKeyLifeState(); l.sourceWeek = week; l.clockSeconds = originals.site.elapsedSeconds;
  if (originals.site.playerLocation === 'REMOTE') throw new Error('须本人已真实返回原通行室。');
  l.playerLocation = originals.site.playerLocation; return l;
}
function validSource(o: StarKeyOriginals): boolean {
  const p = o.site;
  return record(o) && shape(o, ['site']) && validatePlaneswalkerSiteState(p) && p.elapsedSeconds === 211 && p.playerLocation === 'ENTRY' && p.playerMetres === 40 && p.playerAstralLegs === 2 &&
    p.operatorLocation === 'ENTRY' && p.operatorMetres === 0 && p.operatorEnergy === 94 && p.operatorConsent === 'WITHDRAWN' && p.operatorConsentWeek === 198 &&
    p.door.state === 'CLOSED' && p.door.operations === 8 && p.parcel.location === 'ENTRY_STAND' && p.parcel.ordinaryMetres === 8 && p.parcel.astralLegs === 2 &&
    p.lamp.oilRemaining === 2 && p.lamp.patternKnown && p.lamp.shows === 1 && p.screen.state === 'BLANK' && p.screen.applications === 0 && p.effect.mode === 'OFF' &&
    p.kits['symbolic-transit'].status === 'ARCHIVED' && p.kits['symbolic-transit'].protectionSeconds === 70 && p.kits['withdrawn-transit'].status === 'ARCHIVED' && p.kits['withdrawn-transit'].protectionSeconds === 90;
}
export function initializeStarKeyLifeState(s: SliceState): void {
  const source = s.starKey.sourceScene?.originals;
  if (!active(s) || !source || !validSource(source) || !same(s.starKey.life, createStarKeyLifeState()) || !same(starKeyOriginalSnapshot(s), source)) throw new Error('须保留原通行室、玛拉的实际94精力、原封包和已归档护具，再开始这一次现场。');
  s.starKey.life = freshLife(s.week, source);
}
export function validateStarKeyActivityCommand(v: unknown): v is StarKeyActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && STAR_KEY_CASE_IDS.includes(v.caseId as StarKeyCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && STAR_KEY_CASE_IDS.includes(v.caseId as StarKeyCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'OPERATOR', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isStarKeyActivityCommand = validateStarKeyActivityCommand;
const current = (l: StarKeyLifeState): StarKeyAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: StarKeyLifeState) => l.activeCase !== null || l.pending !== null;
export const hasStarKeyLifeLock = (s: SliceState): boolean => !!s.starKey?.life && locked(s.starKey.life);
interface Model { life: StarKeyLifeState; originals: StarKeyOriginals }
interface Audit { date: PublicGameDate; revision: number; finance: StarKeyFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: StarKeyActivityCommand) => c.type === 'ENDPOINT_LOCATION' || c.type === 'ANCHOR_MAINTENANCE';
const isCheck = (c: StarKeyActivityCommand) => isPower(c) || c.type === 'WALK_VERIFY' || c.type === 'WALK_CARRY';
function observationCurrent(m: Model): boolean {
  const a = current(m.life), p = m.originals.site, observed = a?.endpointObservation;
  return !!a && !!observed && a.padsChecked && a.returnMarkerChecked && a.parcelTaken && !a.parcelReturned && observed.conditionVersion === m.life.conditionVersion &&
    observed.doorOperations === p.door.operations && p.door.state === 'OPEN' && p.playerLocation === 'NEAR' && p.operatorLocation === 'NEAR' && p.parcel.location === 'PLAYER';
}
function validPending(m: Model, kind: 'ENDPOINT' | 'ANCHOR'): boolean {
  const l = m.life, a = current(l), p = l.pending;
  return !!p && !!a && p.kind === kind && p.caseId === l.activeCase && l.clockSeconds + 4 <= p.expiresAt && p.conditionVersion === l.conditionVersion &&
    p.permissionVersion === a.permissionVersion && a.permission.owner === 'GRANTED' && a.permission.operator === 'GRANTED' && a.permission.ability === 'GRANTED' &&
    m.originals.site.operatorConsent === 'GRANTED' && m.originals.site.operatorConsentWeek === a.week && observationCurrent(m);
}
function checkSpec(m: Model, c: StarKeyActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  const endpoint = c.type === 'ENDPOINT_LOCATION' || c.type === 'WALK_VERIFY';
  return { ability: endpoint ? 'perception' : 'knowledge', difficulty: isPower(c) ? 18 : 20,
    modifiers: !isPower(c) && validPending(m, endpoint ? 'ENDPOINT' : 'ANCHOR') ? [{ source: endpoint ? '本次已观察端点的有限线索' : '本次已知两端的有限维系', value: 10 }] : [] };
}
function audit(s: SliceState, c: StarKeyActivityCommand): Audit {
  const checked = isCheck(c), perception = c.type === 'ENDPOINT_LOCATION' || c.type === 'WALK_VERIFY';
  return { date: structuredClone(s.date), revision: s.revision, finance: financeSnapshot(s), randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null,
    randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[perception ? 'perception' : 'knowledge'] : null, check: null };
}
function transition(input: Model, c: StarKeyActivityCommand, week: number, outcome: PublicResolutionTier | null, before: StarKeyLifeBudget, clock: Audit): { model: Model; receipt: StarKeyLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, p = o.site, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  if (p.playerLocation === 'REMOTE') return null;
  let a = current(l);
  const receipt: StarKeyLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before),
    elapsedSeconds: 0, playerWalkedMetres: 0, maraWalkedMetres: 0, operatorEnergySpent: 0, moves: [], originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: isCheck(c) && a && id ? { caseId: id, atSeconds: l.clockSeconds, conditionVersion: l.conditionVersion, permissionVersion: a.permissionVersion,
      siteId: p.id, parcelId: p.parcel.id, playerLocation: p.playerLocation, operatorLocation: p.operatorLocation, doorState: p.door.state,
      observation: structuredClone(a.endpointObservation), bonus: !isPower(c) && validPending(m, c.type === 'WALK_VERIFY' ? 'ENDPOINT' : 'ANCHOR') ? 10 : 0 } : null };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const end = (state: StarKeyWindow) => { if (l.pending && a) { const use = l.pending.kind === 'ENDPOINT' ? a.endpoint : a.anchor; use.state = state; use.remainingSeconds = 0; l.pending = null; } };
  const change = () => { end('INVALIDATED'); l.conditionVersion++; };
  const walk = (actor: 'PLAYER' | 'MARA', to: PlaneswalkerLocalLocation) => {
    const from = actor === 'PLAYER' ? p.playerLocation : p.operatorLocation;
    if (from === 'REMOTE' || from === to) return;
    const metres = Math.abs(PLANESWALKER_POSITION_METRES[from] - PLANESWALKER_POSITION_METRES[to]);
    const parcelId = actor === 'PLAYER' && p.parcel.location === 'PLAYER' ? p.parcel.id : null;
    change(); receipt.elapsedSeconds += metres; receipt.moves.push({ actor, from, to, mode: 'WALK', metres, seconds: metres, originalBody: true, parcelId });
    if (actor === 'PLAYER') { p.playerLocation = to; l.playerLocation = to; p.playerMetres += metres; receipt.playerWalkedMetres += metres; if (parcelId) p.parcel.ordinaryMetres += metres; }
    else { p.operatorLocation = to; p.operatorMetres += metres; receipt.maraWalkedMetres += metres; const energy = Math.ceil(metres / 2); p.operatorEnergy -= energy; receipt.operatorEnergySpent += energy; }
  };
  const door = (state: 'OPEN' | 'CLOSED') => {
    const from = p.playerLocation; if (from !== 'ENTRY' && from !== 'NEAR') return false;
    walk('PLAYER', 'NEAR'); change(); p.door.state = state; p.door.operations++; if (a) a.doorOperations++; receipt.elapsedSeconds += 2;
    if (from === 'ENTRY') walk('PLAYER', 'ENTRY'); return true;
  };
  const returnParcel = () => { if (p.parcel.location === 'PLAYER' && p.playerLocation === 'ENTRY') { change(); p.parcel.location = 'ENTRY_STAND'; if (a) a.parcelReturned = true; receipt.elapsedSeconds += 2; } };
  const closeContact = () => {
    if (!a || !r) return;
    a.closed = true; r.contactOpen = false; r.returned = true; l.activeCase = null;
    for (const key of ['owner', 'operator', 'ability'] as const) if (a.permission[key] === 'GRANTED' || a.permission[key] === 'UNASKED') a.permission[key] = 'CLOSED';
    if (p.operatorConsent === 'GRANTED' || p.operatorConsent === 'UNASKED') { p.operatorConsent = 'CLOSED'; p.operatorConsentWeek = week; }
  };
  const physical = !!a && !!r && r.status === 'ACTIVE' && !a.closed && a.week === week;
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  const permitted = physical && !a!.exited && a!.permission.owner === 'GRANTED' && a!.permission.operator === 'GRANTED' && p.operatorConsent === 'GRANTED' && p.operatorConsentWeek === week;
  const declined = () => !!a && (a.permission.owner === 'DECLINED' || a.permission.operator === 'DECLINED');
  const withdrawn = () => !!a && (a.permission.owner === 'WITHDRAWN' || a.permission.operator === 'WITHDRAWN');
  switch (c.type) {
    case 'OBSERVE': {
      const index = STAR_KEY_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || r!.status !== 'AVAILABLE' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED' || index > 0 && l.cases[STAR_KEY_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'WALK_TO_ROOM':
      if (locked(l) || p.playerLocation !== 'OUTSIDE' || p.parcel.location !== 'ENTRY_STAND' || !Object.values(l.cases).some(x => x.status === 'OBSERVED' || x.status === 'PAUSED')) return null;
      walk('PLAYER', 'ENTRY'); break;
    case 'INVITE':
      if (locked(l) || p.playerLocation !== 'ENTRY' || !['ENTRY', 'OUTSIDE'].includes(p.operatorLocation) || p.operatorEnergy < 5 || !['OBSERVED', 'PAUSED'].includes(r!.status) ||
        r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!) || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED') return null;
      pay(1, 10); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method));
      a = r!.attempts.at(-1)!; l.activeCase = c.caseId; p.operatorConsent = 'UNASKED'; p.operatorConsentWeek = null; walk('MARA', 'ENTRY'); receipt.elapsedSeconds += 2; break;
    case 'READ_SOURCE':
      if (!physical || a!.sourceRead || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY') return null;
      a!.sourceRead = true; receipt.elapsedSeconds = 2; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'OPERATOR' ? 'operator' : 'ability';
      if (!physical || !a!.sourceRead || a!.exited || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') ||
        c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (key === 'operator') { p.operatorConsent = a!.permission[key]; p.operatorConsentWeek = week; }
      if (c.type !== 'CONSENT') end('STOPPED'); receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 2; break;
    }
    case 'AGREE_RETURN':
      if (!permitted || a!.returnAgreed || a!.permission.ability === 'UNASKED' || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY') return null;
      a!.returnAgreed = true; receipt.elapsedSeconds = 2; break;
    case 'OPEN_DOOR':
      if (!permitted || !a!.returnAgreed || p.door.state !== 'CLOSED' || a!.doorOperations >= 8 || !door('OPEN')) return null;
      break;
    case 'CLOSE_DOOR':
      if (!physical || a!.exited || p.door.state !== 'OPEN' || !door('CLOSED')) return null;
      break;
    case 'INSPECT_PADS':
      if (!permitted || !a!.returnAgreed || a!.padsChecked || p.playerLocation !== 'ENTRY' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'OPEN') return null;
      walk('PLAYER', 'NEAR'); receipt.elapsedSeconds++; walk('PLAYER', 'FAR'); receipt.elapsedSeconds++; walk('PLAYER', 'ENTRY'); a!.padsChecked = true; break;
    case 'READ_RETURN_MARKER':
      if (!permitted || !a!.padsChecked || a!.returnMarkerChecked || p.playerLocation !== 'ENTRY') return null;
      // This is the existing LOCAL marker; the old remote-marker flag is not rewritten.
      a!.returnMarkerChecked = true; receipt.elapsedSeconds = 2; break;
    case 'TAKE_PARCEL':
      if (!permitted || !a!.returnMarkerChecked || a!.parcelTaken || p.playerLocation !== 'ENTRY' || p.parcel.location !== 'ENTRY_STAND') return null;
      change(); p.parcel.location = 'PLAYER'; a!.parcelTaken = true; receipt.elapsedSeconds += 2; break;
    case 'WALK_NEAR':
      if (!permitted || !a!.parcelTaken || a!.parcelReturned || a!.walkVerifyAttempted || a!.walkCarryAttempted || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY' || p.parcel.location !== 'PLAYER' || p.door.state !== 'OPEN' || p.operatorEnergy < 4) return null;
      walk('PLAYER', 'NEAR'); walk('MARA', 'NEAR'); break;
    case 'OBSERVE_ENDPOINT':
      if (!permitted || !a!.padsChecked || !a!.returnMarkerChecked || p.playerLocation !== 'NEAR' || p.operatorLocation !== 'NEAR' || p.parcel.location !== 'PLAYER' || p.door.state !== 'OPEN' || a!.observedVersions.includes(l.conditionVersion) || p.operatorEnergy < 3) return null;
      a!.observedVersions.push(l.conditionVersion); a!.endpointObservation = { atSeconds: l.clockSeconds, conditionVersion: l.conditionVersion, from: 'NEAR', to: 'FAR', distanceMetres: 4, parcelId: p.parcel.id, doorOperations: p.door.operations };
      p.operatorEnergy--; receipt.operatorEnergySpent++; receipt.elapsedSeconds = 2; break;
    case 'ENDPOINT_LOCATION': case 'ANCHOR_MAINTENANCE': {
      const endpoint = c.type === 'ENDPOINT_LOCATION', key = endpoint ? 'endpoint' : 'anchor';
      if (!permitted || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || l.pending || !observationCurrent(m) || r!.attempts.some(x => x[key].attempts > 0) ||
        (endpoint ? id !== 'endpoint-verification' || a!.walkVerifyAttempted : id === 'endpoint-verification' || a!.walkCarryAttempted)) return null;
      pay(0, 0, endpoint ? 8 : 7, 2); receipt.elapsedSeconds = 2; a!.spiritualitySpent += endpoint ? 8 : 7; a!.mindSpent += 2;
      const use = a![key]; use.attempts = 1; use.successes = success(outcome) ? 1 : 0; use.tier = outcome; use.state = success(outcome) ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = success(outcome) ? 20 : 0; use.conditionVersion = l.conditionVersion;
      use.clue = endpoint && success(outcome) ? '本次所见远垫位于近垫前方四米；只有亲自走到原垫并核对，才能确认这条当前线索。' : null;
      if (success(outcome)) l.pending = { kind: endpoint ? 'ENDPOINT' : 'ANCHOR', caseId: id!, createdAt: l.clockSeconds + 2, expiresAt: l.clockSeconds + 22, conditionVersion: l.conditionVersion, permissionVersion: a!.permissionVersion, from: 'NEAR', to: 'FAR', parcelId: p.parcel.id, bonus: 10 };
      break;
    }
    case 'WALK_VERIFY': case 'WALK_CARRY': {
      const verify = c.type === 'WALK_VERIFY';
      if (!permitted || !observationCurrent(m) || (verify ? id !== 'endpoint-verification' || a!.walkVerifyAttempted : id !== 'anchor-transfer' || a!.walkCarryAttempted)) return null;
      const helped = validPending(m, verify ? 'ENDPOINT' : 'ANCHOR'), use = verify ? a!.endpoint : a!.anchor;
      if (helped && success(outcome)) { use.effects = 1; end('APPLIED'); } else end(helped ? 'CHECK_FAILED' : 'EXPIRED');
      // The independent check tests the bounded practice. The original body and
      // original held parcel still really walk all four metres even on failure.
      walk('PLAYER', 'FAR');
      if (verify) { a!.walkVerifyAttempted = true; a!.verifyTier = outcome; a!.walkVerified = success(outcome); if (success(outcome)) a!.result = helped ? 'ABILITY' : 'ORDINARY'; }
      else { a!.walkCarryAttempted = true; a!.carryTier = outcome; a!.walkCarried = true; a!.result = helped && success(outcome) ? 'ABILITY' : 'ORDINARY'; }
      break;
    }
    case 'MANUAL_VERIFY':
      if (!permitted || id !== 'endpoint-verification' || !a!.walkVerifyAttempted || a!.walkVerified || a!.manualVerified || p.playerLocation !== 'FAR' || p.parcel.location !== 'PLAYER' || p.door.state !== 'OPEN') return null;
      end('STOPPED'); a!.manualVerified = true; a!.walkVerified = true; a!.result = 'ORDINARY'; receipt.elapsedSeconds = 6; break;
    case 'STOP_METHOD':
      if (!physical || !l.pending) return null;
      end('STOPPED'); break;
    case 'WAIT_WINDOW':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); end('EXPIRED'); break;
    case 'WALK_ENTRY':
      if (!physical || a!.exited || !['NEAR', 'FAR'].includes(p.playerLocation) && p.operatorLocation !== 'NEAR') return null;
      end('STOPPED'); walk('PLAYER', 'ENTRY'); walk('MARA', 'ENTRY'); break;
    case 'RETURN_PARCEL':
      if (!physical || a!.exited || p.playerLocation !== 'ENTRY' || p.parcel.location !== 'PLAYER' || !a!.parcelTaken || a!.parcelReturned) return null;
      end('STOPPED'); returnParcel(); break;
    case 'EXIT_ROOM':
      if (!physical || a!.exited || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED' || l.pending) return null;
      walk('PLAYER', 'OUTSIDE'); walk('MARA', 'OUTSIDE'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || !a!.exited || p.playerLocation !== 'OUTSIDE' || p.operatorLocation !== 'OUTSIDE' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED' || l.pending) return null;
      if (declined() || withdrawn()) a!.result = a!.result === 'ABILITY' ? 'ABILITY' : 'ORDINARY';
      if (a!.result === 'NONE') return null;
      r!.result = a!.result; r!.status = 'EXAMINED'; receipt.elapsedSeconds = 2; closeContact(); break;
    case 'ABORT':
      if (!physical) {
        if (locked(l) || p.playerLocation !== 'ENTRY' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED') return null;
        walk('PLAYER', 'OUTSIDE'); break;
      }
      // One public command records every ordinary movement, hand operation,
      // elapsed second and Mara energy debit. No effect can return an object.
      end('STOPPED');
      if (!a!.exited) {
        walk('PLAYER', 'ENTRY'); walk('MARA', 'ENTRY'); returnParcel();
        if (p.door.state === 'OPEN' && !door('CLOSED')) return null;
        if (p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED') return null;
        walk('PLAYER', 'OUTSIDE'); walk('MARA', 'OUTSIDE'); a!.exited = true;
      }
      if (declined() || withdrawn()) a!.result = a!.result === 'ABILITY' ? 'ABILITY' : 'ORDINARY';
      r!.result = a!.result; r!.status = a!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; closeContact(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || p.playerLocation !== 'OUTSIDE' || p.operatorLocation !== 'OUTSIDE' || p.parcel.location !== 'ENTRY_STAND' || p.door.state !== 'CLOSED') return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !STAR_KEY_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED') || p.playerLocation !== 'OUTSIDE' || p.operatorLocation !== 'OUTSIDE') return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 5; break;
  }
  if (!validBudget(receipt.after) || !integer(p.operatorEnergy, 0, 94)) return null;
  l.clockSeconds += receipt.elapsedSeconds; l.elapsedSeconds += receipt.elapsedSeconds; p.elapsedSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.maraTravelMetres += receipt.maraWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.maraTravelMetres += receipt.maraWalkedMetres; a.operatorEnergySpent += receipt.operatorEnergySpent; }
  if (l.pending && a) { const use = l.pending.kind === 'ENDPOINT' ? a.endpoint : a.anchor; use.remainingSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); if (use.remainingSeconds === 0) end('EXPIRED'); }
  if (!validatePlaneswalkerSiteState(p)) return null;
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}

function financeSnapshot(s: StarKeyFinanceSnapshot): StarKeyFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: unknown, week: number): v is StarKeyFinanceSnapshot {
  if (!record(v) || !shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) || !integer(v.weeklyBudget, 1, 100) ||
    typeof v.lifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.lifeTier) || typeof v.nextLifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.nextLifeTier) ||
    !integer(v.missedWeeks) || !['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) || !Array.isArray(v.debts)) return false;
  return new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d => record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
    typeof d.id === 'string' && d.id.length > 0 && typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** The same ordinary BILL/DEBTS resolver used by the main weekly pulse. An open
 * practice never advances the week, even after its invitation spends the last AP. */
function lifeBoundary(e: StarKeyLifeReceipt, isLocked: boolean) {
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
function completedLifeBudgetMatches(s: SliceState, e: StarKeyLifeReceipt, isLocked: boolean): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(budget(s), expected.budget) || !same(financeSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null) return false;
  if (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: StarKeyLifeState, s: SliceState): Model | null {
  const source = s.starKey.sourceScene?.originals;
  if (!source || !validSource(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 700) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: StarKeyLifeReceipt | null = null, previousLocked = false, lastWeek = l.sourceWeek, lastRandomAfter = s.starKey.sourceScene!.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'maraWalkedMetres', 'operatorEnergySpent', 'moves', 'originalsBefore', 'originalsAfter', 'source']) || !validateStarKeyActivityCommand(entry.command) ||
      !integer(entry.week, lastWeek, s.week) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.starKey.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
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
export function starKeyExpectedOriginals(s: SliceState): StarKeyOriginals | null {
  const l = s.starKey.life;
  if (l.sourceWeek === null) return s.starKey.sourceScene ? structuredClone(s.starKey.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function starKeyLifeMasteryGains(s: SliceState): Record<typeof ENDPOINT | typeof ANCHOR, number> {
  const result = { [ENDPOINT]: 0, [ANCHOR]: 0 };
  for (const id of STAR_KEY_CASE_IDS) {
    const r = s.starKey.life.cases[id]; if (r.status !== 'RESOLVED' || id === 'withdrawn-return') continue;
    if (r.attempts.some(a => a.endpoint.effects === 1)) result[ENDPOINT] += 8;
    if (r.attempts.some(a => a.anchor.effects === 1)) result[ANCHOR] += 8;
  }
  return result;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.planeswalker.life.activeCase !== null || Object.values(s.planeswalker.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.planeswalker.preparedWeek !== null ||
    s.planeswalker.ritual.activeVisitId !== null || ['READY', 'FIGHTING'].includes(s.planeswalker.encounter.status) || s.wanderer.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.wanderer.encounter.status);
}
export function validateStarKeyLifeState(s: SliceState): boolean {
  try {
    const l = s.starKey?.life;
    if (!record(l) || !shape(l, Object.keys(createStarKeyLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, STAR_KEY_CASE_IDS)) return false;
    if (s.starKey.promotionWeek === null) return same(l, createStarKeyLifeState());
    const source = s.starKey.sourceScene?.originals, history = s.starKey.sourceHistory?.planeswalker.life;
    if (!source || !history || !validSource(source) || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.starKey.promotionWeek ||
      !same(source.site, history.site) || !same(s.planeswalker.life.cases, history.cases) || !same(s.planeswalker.life.journal, history.journal) ||
      s.planeswalker.life.activeCase !== history.activeCase || s.planeswalker.life.reflected !== history.reflected) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(starKeyOriginalSnapshot(s), replay.originals)) return false;
    const gains = starKeyLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of STAR_KEY_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `star-key-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'star-key-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[ENDPOINT] ?? 0) < gains[ENDPOINT] || (s.progression.mastery[ANCHOR] ?? 0) < gains[ANCHOR]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.starKey.preparedWeek !== null ||
      ['READY', 'FIGHTING'].includes(s.starKey.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !completedLifeBudgetMatches(s, last, locked(l))) return false;
    return true;
  } catch { return false; }
}
export const validateStarKeyLife = validateStarKeyLifeState;
export function blockStarKeyLife(s: SliceState, c: StarKeyActivityCommand): string | null {
  if (!validateStarKeyActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为星之匙。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.starKey.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.starKey.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateStarKeyLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.starKey.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成所需实际步骤，核对当前许可、位置、精力、现金与行动。失败不能重抽；停止、归还和退出不耗行动。';
  return null;
}
export const blockStarKeyActivity = blockStarKeyLife;
/** Only live fields are assigned. The original old case/journal and frozen
 * sourceHistory remain byte-for-byte independent of this new record. */
function writeOriginals(s: SliceState, o: StarKeyOriginals): void {
  const live = s.planeswalker.life.site, next = o.site;
  live.elapsedSeconds = next.elapsedSeconds; live.playerLocation = next.playerLocation; live.playerMetres = next.playerMetres;
  live.operatorLocation = next.operatorLocation; live.operatorMetres = next.operatorMetres; live.operatorEnergy = next.operatorEnergy;
  live.operatorConsent = next.operatorConsent; live.operatorConsentWeek = next.operatorConsentWeek;
  Object.assign(live.door, next.door); Object.assign(live.parcel, next.parcel);
}
export function applyStarKeyLifeCommand(s: SliceState, c: StarKeyActivityCommand, ctx: SeerContext): void {
  const reason = blockStarKeyLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.starKey.life, s)!, before = budget(s), clock = audit(s, c); let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock);
  if (!next) throw new Error('本次真实结果不能改变已冻结的现场前提。');
  const l = next.model.life; l.journal.push(next.receipt); s.starKey.life = l; writeOriginals(s, next.model.originals);
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`star-key-case:${c.caseId}`);
    if (c.caseId !== 'withdrawn-return') for (const [ability, key] of [[ENDPOINT, 'endpoint'], [ANCHOR, 'anchor']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('star-key-reflection'); }
  const checked = check ? `本次${success(check.tier) ? '成功' : '失败'}；实际检定与已付代价保留。` : '';
  ctx.note(LABELS[c.type], `${DETAILS[c.type]}${checked}本步实耗${next.receipt.elapsedSeconds}秒，本人步行${next.receipt.playerWalkedMetres}米、玛拉步行${next.receipt.maraWalkedMetres}米并消耗${next.receipt.operatorEnergySpent}精力。`);
}
export const applyStarKeyActivity = applyStarKeyLifeCommand;
const CASES = [
  { id: 'endpoint-verification', title: '亲见两端，再走四米核验', story: '从原通行室入口重新付费邀请玛拉，取得这一次许可。亲手打开原遮门，实走检查近垫、远垫和本地返回标记，拿起自己的唯一原封包。端点定位只提供眼前四米线索，成功后仍须亲自走到原远垫独立核验；普通核验也要真实步行。' },
  { id: 'anchor-transfer', title: '同一封包的普通四米搬运', story: '再问同一玛拉的本案许可，观察同一已知近远垫。锚点维系只帮助下一次四米搬运的稳定检定，原身体须实际行走，同一封包始终在本人手中；失败后仍记录普通搬运，不会得到能力奖励。' },
  { id: 'withdrawn-return', title: '付过代价，也随当前撤回停止', story: '同一原人、原包和近远垫。观察并尝试维系后，玛拉可即时撤回本案许可，未用窗口立即停止。本人须普通步行带原包回入口原架、亲手关好遮门，再与玛拉分别步行离场；失效不会替你返回。' },
] as const;
const LABELS: Record<StarKeyActivityCommand['type'], string> = {
  OBSERVE: '查看本案来源与普通退路', WALK_TO_ROOM: '沿两米普通通路回到原入口', INVITE: '付费邀请玛拉参加本案', READ_SOURCE: '当面核对原通行室、玛拉和唯一原封包', CONSENT: '确认这一项当前许可', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可', AGREE_RETURN: '约定普通归还与随时停止', OPEN_DOOR: '亲手打开原遮门', CLOSE_DOOR: '亲手关好原遮门', INSPECT_PADS: '实走检查近垫和远垫，再回入口', READ_RETURN_MARKER: '在入口亲读同一本地返回标记', TAKE_PARCEL: '从原架亲手拿起唯一原封包', WALK_NEAR: '携原包与玛拉分别走到近垫', OBSERVE_ENDPOINT: '亲眼观察四米远垫与当前视线', ENDPOINT_LOCATION: '尝试一次端点定位', WALK_VERIFY: '携原包实际走四米并独立核验', MANUAL_VERIFY: '在实际远垫逐项普通核对', ANCHOR_MAINTENANCE: '尝试一次锚点维系', WALK_CARRY: '亲自携原包走四米并检验稳定性', WALK_ENTRY: '携原包与玛拉分别沿普通路回入口', RETURN_PARCEL: '亲手把唯一原封包放回原架', STOP_METHOD: '停止未使用的有限窗口', WAIT_WINDOW: '实际等到当前窗口到期', EXIT_ROOM: '两人分别走两米退出通行室', LEAVE: '结束本案接触', ABORT: '普通归还原包、关门并安全离场', REPORT: '报告真实结果与归还', REFLECT: '反思端点、实际行动与当前许可',
};
const DETAILS: Record<StarKeyActivityCommand['type'], string> = {
  OBSERVE: '本案先说明实际来源、费用和可用的普通做法。', WALK_TO_ROOM: '本人从门外沿两米普通通路走回原入口。', INVITE: '实付10便士和1行动；玛拉若在门外，须实际步行两米到入口并消耗1精力。旧许可没有沿用，已有精力不补满。', READ_SOURCE: '同一42岁玛拉、原通行室和属于本人的唯一原封包均当面核对。', CONSENT: '只同意本案这一项说明过的用途，可以随时撤回。', DECLINE_CONSENT: '拒绝已记录；仍可安全归还退出。', WITHDRAW_CONSENT: '当前许可立即结束，未用窗口停止，不退还实耗。', AGREE_RETURN: '约定随时停止，同一原包须普通带回原架，两人须实际步行退出。', OPEN_DOOR: '到原遮门旁亲手打开，改变视线条件；旧线索不会因此恢复。', CLOSE_DOOR: '到原遮门旁亲手关闭，旧窗口立即失效，普通出口仍开放。', INSPECT_PADS: '本人从入口走到近垫，再走四米到远垫，逐项察看后走回入口，共12米、14秒。', READ_RETURN_MARKER: '在入口亲读已有本地标记，未改写过去的异星回程记录。', TAKE_PARCEL: '唯一原封包从入口原架交到本人手中，所有权不变。', WALK_NEAR: '本人携同一原包走两米，玛拉也实走两米并消耗1精力。', OBSERVE_ENDPOINT: '在近垫亲见四米外原远垫，玛拉实际核对视线并消耗1精力；没有从不可见处生成目标位置。', ENDPOINT_LOCATION: '实付8灵性、2精神，感知18。成功只得到最长20秒、供下一次实际四米核验使用的一条有限线索。', WALK_VERIFY: '本人和手持原包实走四米，再作感知20独立核验；有效当前窗口只加值10。核验失败仍已走到远垫，可在当地普通核对。', MANUAL_VERIFY: '本人已实际到达原远垫，再花6秒逐项核对；不增加能力掌握。', ANCHOR_MAINTENANCE: '实付7灵性、2精神，知识18。成功只在20秒内维系当前已知两端，帮助下一次真实四米搬运。', WALK_CARRY: '本人携唯一原包普通走四米，知识20检验这次稳定性；有效当前窗口只加值10。没有瞬移、复制或额外负重。', WALK_ENTRY: '从当前实际位置沿普通路带原包回入口，玛拉也沿原路返回；费用和走过的路保留。', RETURN_PARCEL: '在原入口亲手放回同一原封包。', STOP_METHOD: '只终止未使用的有限窗口，不移动任何人或原物，不退款。', WAIT_WINDOW: '真实时钟推进至本次窗口终点，原身体与原封包保持当前实际位置。', EXIT_ROOM: '本人和玛拉各自从入口走两米到门外；玛拉消耗1精力。', LEAVE: '原物已经归还、原遮门已经关闭，两人已经实际退出，结束这一次接触。', ABORT: '停止窗口，从实际位置普通返回、亲手归还同一原包，到遮门旁关好原门，再分别步行退出。失败与费用保留。', REPORT: '实付1行动，如实报告增加25扮演；对应能力须成功且经下一次实际行动有效应用，才增加8掌握。', REFLECT: '三案真实报告后实付1行动，增加25扮演。有限线索需要核验，维系需要实际搬运，当前撤回始终有效。',
};
const COSTS: Partial<Record<StarKeyActivityCommand['type'], string>> = {
  OBSERVE: '1行动 · 5秒', INVITE: '1行动 · 每次10便士 · 玛拉实际到场', WALK_TO_ROOM: '0行动 · 本人2米、2秒', INSPECT_PADS: '0行动 · 本人12米、14秒',
  WALK_NEAR: '0行动 · 两人各2米 · 合计4秒 · 玛拉1精力', OBSERVE_ENDPOINT: '0行动 · 2秒 · 玛拉1精力',
  ENDPOINT_LOCATION: '0行动 · 8灵性＋2精神 · 感知18 · 施用2秒／窗口20秒', ANCHOR_MAINTENANCE: '0行动 · 7灵性＋2精神 · 知识18 · 施用2秒／窗口20秒',
  WALK_VERIFY: '0行动 · 本人和原包4米、4秒 · 感知20', WALK_CARRY: '0行动 · 本人和原包4米、4秒 · 知识20', MANUAL_VERIFY: '0行动 · 6秒 · 普通核对',
  OPEN_DOOR: '0行动 · 原入口往返4米＋手动2秒／近垫手动2秒', CLOSE_DOOR: '0行动 · 原入口往返4米＋手动2秒／近垫手动2秒',
  WALK_ENTRY: '0行动 · 按实际位置普通步行 · 玛拉每2米1精力', WITHDRAW_CONSENT: '0行动0秒 · 即刻停止当前窗口', STOP_METHOD: '0行动0秒 · 不退款',
  EXIT_ROOM: '0行动 · 两人各2米 · 合计4秒 · 玛拉1精力', ABORT: '0行动 · 实际普通归还、关门与步行', REPORT: '1行动 · 扮演25 · 实际应用才掌握8', REFLECT: '1行动 · 扮演25',
};
export function starKeyLifeActions(s: SliceState): StarKeyLifeAction[] {
  if (!active(s)) return [];
  const l = s.starKey.life, p = s.planeswalker.life.site, a = current(l), out: StarKeyLifeAction[] = [];
  const add = (command: StarKeyActivityCommand, preferred = false, cleanup = false, label?: string) => {
    const reason = blockStarKeyLife(s, command);
    out.push({ id: `star-key-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`,
      label: label ?? LABELS[command.type], cost: command.type === 'WAIT_WINDOW' ? `0行动 · 真实等待${Math.max(0, (l.pending?.expiresAt ?? l.clockSeconds) - l.clockSeconds)}秒` : COSTS[command.type] ?? '0行动 · 实际2秒', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup });
  };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (!next) { if (!l.reflected) step('REFLECT'); return out; }
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, true);
    else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true);
    else if (p.playerLocation === 'OUTSIDE') step('WALK_TO_ROOM');
    else {
      if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, true, false, '实付10便士，重新邀请玛拉并说明有限能力');
      add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED', false, r.status === 'PAUSED' ? '跨周实付10便士，重新邀请普通续办' : '实付10便士，邀请玛拉作普通练习');
      step('ABORT', false, true);
    }
    return out;
  }
  const id = l.activeCase!, blockedPermission = a.permission.owner === 'DECLINED' || a.permission.operator === 'DECLINED' || a.permission.owner === 'WITHDRAWN' || a.permission.operator === 'WITHDRAWN';
  const withdrawalFinished = id === 'withdrawn-return' && a.permission.operator === 'WITHDRAWN';
  const resultReady = a.result !== 'NONE' || blockedPermission || withdrawalFinished;
  if (!a.sourceRead) step('READ_SOURCE');
  else if (resultReady) {
    if (l.pending) step('STOP_METHOD', true, true);
    else if (!['ENTRY', 'OUTSIDE'].includes(p.playerLocation) || p.operatorLocation === 'NEAR') step('WALK_ENTRY', true, true);
    else if (p.parcel.location === 'PLAYER') step('RETURN_PARCEL', true, true);
    else if (p.door.state === 'OPEN') step('CLOSE_DOOR', true, true);
    else if (!a.exited) step('EXIT_ROOM', true, true); else step('LEAVE', true, true);
  } else if (!a.returnAgreed) {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.operator === 'UNASKED' ? 'OPERATOR' : a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) {
      if (permission !== 'ABILITY' || a.method === 'ABILITY') add({ type: 'CONSENT', permission }, true, false, permission === 'OWNER' ? '确认本人原封包本案用途' : permission === 'OPERATOR' ? '重新询问玛拉这一次参与意愿' : '说明并询问这一次有限能力许可');
      add({ type: 'DECLINE_CONSENT', permission }, permission === 'ABILITY' && a.method === 'ORDINARY', true, '尊重这一项拒绝，保留普通退路');
    } else step('AGREE_RETURN');
  } else if (p.door.state === 'CLOSED') step('OPEN_DOOR');
  else if (!a.padsChecked) step('INSPECT_PADS');
  else if (!a.returnMarkerChecked) step('READ_RETURN_MARKER');
  else if (!a.parcelTaken) step('TAKE_PARCEL');
  else if (p.playerLocation === 'ENTRY') step('WALK_NEAR');
  else if (id === 'endpoint-verification' && a.walkVerifyAttempted && !a.walkVerified) step('MANUAL_VERIFY', true, true);
  else if (!observationCurrent({ life: l, originals: { site: p } })) step('OBSERVE_ENDPOINT');
  else if (id === 'endpoint-verification') {
    const canCast = a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.endpoint.attempts > 0);
    if (canCast) step('ENDPOINT_LOCATION');
    step('WALK_VERIFY', !canCast, a.method === 'ORDINARY');
  } else {
    const canCast = a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.anchor.attempts > 0);
    if (canCast) step('ANCHOR_MAINTENANCE');
    if (id === 'withdrawn-return') add({ type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }, !canCast, true, '玛拉撤回本案当前许可');
    else step('WALK_CARRY', !canCast, a.method === 'ORDINARY');
  }
  if (l.pending) { step('WAIT_WINDOW', false, true); step('STOP_METHOD', false, true); if (p.door.state === 'OPEN') step('CLOSE_DOOR', false, true); }
  if (!a.exited && a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true, '撤回本次有限能力许可');
  if (!a.exited && a.permission.operator === 'GRANTED' && !out.some(x => x.command.type === 'WITHDRAW_CONSENT' && x.command.permission === 'OPERATOR')) add({ type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }, false, true, '尊重玛拉随时撤回的决定');
  step('ABORT', false, true);
  return out;
}
/** Historical costs and physical evidence are public; replay roots and finances are not. */
const publicStarKeyLifeCommand = (c: StarKeyActivityCommand): StarKeyActivityCommand => {
  switch (c.type) {
    case 'OBSERVE': case 'REPORT': return { type: c.type, caseId: c.caseId };
    case 'INVITE': return { type: c.type, caseId: c.caseId, method: c.method };
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': return { type: c.type, permission: c.permission };
    default: return { type: c.type };
  }
};
const publicStarKeyBudget = (b: StarKeyLifeBudget) => ({ health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions });
const publicStarKeyObservation = (o: StarKeyEndpointObservation | null): StarKeyEndpointObservation | null => o ? ({
  atSeconds: o.atSeconds, conditionVersion: o.conditionVersion, from: o.from, to: o.to, distanceMetres: o.distanceMetres, parcelId: o.parcelId, doorOperations: o.doorOperations,
}) : null;
const publicStarKeyAbilityUse = (a: StarKeyAbilityUse): StarKeyAbilityUse => ({
  attempts: a.attempts, successes: a.successes, effects: a.effects, tier: a.tier, state: a.state,
  remainingSeconds: a.remainingSeconds, conditionVersion: a.conditionVersion, clue: a.clue,
});
const publicStarKeyLifePending = (p: StarKeyLifeState['pending']): StarKeyLifeState['pending'] => p ? ({
  kind: p.kind, caseId: p.caseId, createdAt: p.createdAt, expiresAt: p.expiresAt, conditionVersion: p.conditionVersion,
  permissionVersion: p.permissionVersion, from: p.from, to: p.to, parcelId: p.parcelId, bonus: p.bonus,
}) : null;
export function projectStarKeyAttempt(a: StarKeyAttempt): StarKeyAttempt { return {
  week: a.week, method: a.method, closed: a.closed, result: a.result, elapsedSeconds: a.elapsedSeconds,
  playerTravelMetres: a.playerTravelMetres, maraTravelMetres: a.maraTravelMetres, operatorEnergySpent: a.operatorEnergySpent,
  penniesSpent: a.penniesSpent, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent,
  permission: { owner: a.permission.owner, operator: a.permission.operator, ability: a.permission.ability }, permissionVersion: a.permissionVersion,
  sourceRead: a.sourceRead, returnAgreed: a.returnAgreed, padsChecked: a.padsChecked, returnMarkerChecked: a.returnMarkerChecked,
  parcelTaken: a.parcelTaken, parcelReturned: a.parcelReturned, doorOperations: a.doorOperations,
  observedVersions: [...a.observedVersions], endpointObservation: publicStarKeyObservation(a.endpointObservation),
  walkVerifyAttempted: a.walkVerifyAttempted, verifyTier: a.verifyTier, walkVerified: a.walkVerified, manualVerified: a.manualVerified,
  walkCarryAttempted: a.walkCarryAttempted, carryTier: a.carryTier, walkCarried: a.walkCarried, exited: a.exited,
  endpoint: publicStarKeyAbilityUse(a.endpoint), anchor: publicStarKeyAbilityUse(a.anchor),
}; }
export function projectStarKeyLifeReceipt(e: StarKeyLifeReceipt) { return {
  week: e.week, date: { epoch: e.date.epoch, year: e.date.year, month: e.date.month, day: e.date.day }, revision: e.revision,
  command: publicStarKeyLifeCommand(e.command), checkBase: e.checkBase, check: projectStarKeyCheck(e.check), outcome: e.outcome,
  before: publicStarKeyBudget(e.before), after: publicStarKeyBudget(e.after), elapsedSeconds: e.elapsedSeconds,
  playerWalkedMetres: e.playerWalkedMetres, maraWalkedMetres: e.maraWalkedMetres, operatorEnergySpent: e.operatorEnergySpent,
  moves: e.moves.map(m => ({ actor: m.actor, from: m.from, to: m.to, mode: m.mode, metres: m.metres, seconds: m.seconds, originalBody: m.originalBody, parcelId: m.parcelId })),
  originalsBefore: { site: projectPlaneswalkerSite(e.originalsBefore.site) }, originalsAfter: { site: projectPlaneswalkerSite(e.originalsAfter.site) },
}; }
export type StarKeyPublicLifeReceipt = ReturnType<typeof projectStarKeyLifeReceipt>;

export function projectStarKeyLife(s: SliceState): StarKeyLifeProjection {
  const l = s.starKey.life, originals = starKeyOriginalSnapshot(s), actions = starKeyLifeActions(s), model = { life: l, originals };
  return { title: '原通行室、四米端点与普通归还', story: '端点定位与锚点维系都只帮助下一次实际行动。施用成功后仍须本人真实走四米；失败、过期、视线改变和撤回保留真实结果。三案报告各25扮演，反思25；对应新能力只有成功且实际应用才增加8掌握。',
    source: '同一42岁玛拉、PW2原通行室与属于本人的唯一原封包。原灯油2份，原屏仍为空白，两套归档护具保留70秒和90秒。',
    environment: '本地入口0米、近垫2米、远垫6米、门外负2米；近远垫相隔4米。每次邀请10便士、1行动；普通步行每米1秒，玛拉每走2米消耗1精力，实际核对视线另耗1精力。门外出口始终开放。',
    activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, maraTravelMetres: l.maraTravelMetres, conditionVersion: l.conditionVersion,
    site: projectPlaneswalkerSite(originals.site), maraPresent: originals.site.operatorLocation !== 'OUTSIDE', pending: publicStarKeyLifePending(l.pending), pendingUsable: !!l.pending && validPending(model, l.pending.kind),
    pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - l.clockSeconds) : 0, currentAttempt: current(l) ? projectStarKeyAttempt(current(l)!) : null,
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '原人原物保持连续位置；窗口不会代替走路、恢复精力或补充旧资源。'], status: r.status, method: r.method,
      result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限帮助已在下一次真实四米行动中应用；同一原包已实际归还。' : '以普通动作完成或尊重当前拒绝、撤回；保留真实失败和失效，没有未应用的能力奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: r.attempts.map(projectStarKeyAttempt) }; }),
    ledger: l.journal.map(projectStarKeyLifeReceipt), actions };
}
