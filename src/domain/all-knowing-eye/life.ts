import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { WisdomAngelLifeState } from '../wisdom-angel/life.js';

/** Finite original design. The source papers, person and exhausted device remain
 * authoritative in wisdomAngel.life; this journal audits their actual movement,
 * never replacing their old history with a rewritten current-stage account. */
export const ALL_KNOWING_EYE_CASE_IDS = ['original-paper-check', 'pending-slider', 'changed-conditions'] as const;
export type AllKnowingEyeCaseId = typeof ALL_KNOWING_EYE_CASE_IDS[number];
export type AllKnowingEyeOriginals = Pick<WisdomAngelLifeState, 'playerLocation' | 'playerTravelMetres' | 'clockSeconds' | 'room' | 'mara' | 'papers' | 'device'>;
export type AllKnowingEyeConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type AllKnowingEyeWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'CHECK_FAILED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
const STEPS = ['BUY_RIG', 'WALK_TO_ROOM', 'READ_SOURCE', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_PAPERS', 'READ_FIRST', 'READ_SECOND', 'OBSERVE_HANDOVER', 'BOUNDED_INSIGHT', 'VERIFY_HANDOVER', 'MANUAL_COMPARE', 'PLACE_RIG', 'COCK_SLIDER', 'OBSERVE_SLIDER', 'PENDING_FORECAST', 'CATCH_SLIDER', 'CHANGE_CONDITIONS', 'CLEAR_SIGHTLINE', 'HAND_STOP', 'RETRIEVE_SLIDER', 'STOP_METHOD', 'WAIT_WINDOW', 'RETURN_PAPERS', 'RETURN_RIG', 'EXIT_ROOM', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type AllKnowingEyeActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: AllKnowingEyeCaseId }
  | { type: 'INVITE'; caseId: AllKnowingEyeCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'OWNER' | 'TECHNICIAN' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface AllKnowingEyeAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: AllKnowingEyeWindow; remainingSeconds: number; conditionVersion: number | null;
}
export interface AllKnowingEyeAttempt {
  week: number; method: Method; closed: boolean; result: Result; elapsedSeconds: number;
  playerTravelMetres: number; maraTravelMetres: number; irenaTravelMetres: number; spiritualitySpent: number; mindSpent: number;
  permission: { owner: AllKnowingEyeConsent; technician: AllKnowingEyeConsent; ability: AllKnowingEyeConsent }; permissionVersion: number;
  sourceRead: boolean; returnAgreed: boolean; entered: boolean; exited: boolean;
  papersTaken: boolean; papersReturned: boolean; readFirst: boolean; readSecond: boolean;
  handoverObserved: boolean; handoverObservation: string | null; handoverAttempted: boolean; handoverTier: PublicResolutionTier | null; handoverVerified: boolean; manualCompared: boolean;
  rigPlaced: boolean; rigReturned: boolean; sliderCocked: boolean; observedVersions: number[];
  catchAttempted: boolean; catchTier: PublicResolutionTier | null; catchSucceeded: boolean; conditionChanged: boolean; sightlineCleared: boolean; handStopped: boolean; sliderRetrieved: boolean;
  insight: AllKnowingEyeAbilityUse; forecast: AllKnowingEyeAbilityUse;
}
export interface AllKnowingEyeLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: Result; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: AllKnowingEyeAttempt[];
}
export interface AllKnowingEyeLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface AllKnowingEyeLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: AllKnowingEyeActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: AllKnowingEyeLifeBudget; after: AllKnowingEyeLifeBudget;
  elapsedSeconds: number; playerWalkedMetres: number; maraWalkedMetres: number; irenaWalkedMetres: number;
  originalsBefore: AllKnowingEyeOriginals; originalsAfter: AllKnowingEyeOriginals;
  source: { caseId: AllKnowingEyeCaseId; atSeconds: number; conditionVersion: number; permissionVersion: number; paperIds: string[]; handoverObserved: boolean; sliderId: string | null; sightline: 'CLEAR' | 'SHUTTERED' | null; movement: 'COCKED' | null; bonus: 0 | 10 } | null;
  sliderTransitions: ('HAND_COCK' | 'RELEASE' | 'CATCH' | 'MISS' | 'HAND_STOP' | 'RETRIEVE' | 'CHANGE_DIRECTION' | 'SHUTTER' | 'CLEAR')[];
}
export interface AllKnowingEyeLifeState {
  sourceWeek: number | null; activeCase: AllKnowingEyeCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: 'OUTSIDE' | 'EXIT' | 'TABLE'; playerTravelMetres: number; maraPresent: boolean;
  irena: { id: 'AE1-IRENA-VALE'; name: '伊蕾娜·韦尔'; age: 41; alive: true; health: 100; mind: 100; present: boolean; location: 'AWAY' | 'EXIT' | 'TABLE'; travelMetres: number };
  rig: { id: 'AE1-SLIDER-1'; stopBlockId: 'AE1-STOP-1'; owner: 'AE1-IRENA-VALE' | 'PLAYER'; price: 30; purchasedWeek: number | null; location: 'SUPPLIER' | 'PLAYER' | 'TABLE'; powered: false;
    sliderLocation: 'RIG' | 'STOP_BLOCK' | 'FLOOR'; stopBlockLocation: 'RIG'; motion: 'IDLE' | 'COCKED' | 'STOPPED'; direction: 'LEFT' | 'RIGHT'; sightline: 'CLEAR' | 'SHUTTERED'; conditionVersion: number; movements: number; catches: number; manualStops: number };
  pending: { kind: 'INSIGHT' | 'FORECAST'; caseId: AllKnowingEyeCaseId; createdAt: number; expiresAt: number; conditionVersion: number; permissionVersion: number; bonus: 10 } | null;
  cases: Record<AllKnowingEyeCaseId, AllKnowingEyeLifeCase>; journal: AllKnowingEyeLifeReceipt[];
}
export interface AllKnowingEyeLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AllKnowingEyeActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface AllKnowingEyeLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: AllKnowingEyeCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: AllKnowingEyeLifeState['playerLocation']; playerTravelMetres: number;
  room: AllKnowingEyeOriginals['room']; mara: AllKnowingEyeOriginals['mara'] & { present: boolean }; papers: AllKnowingEyeOriginals['papers']; device: AllKnowingEyeOriginals['device'];
  irena: AllKnowingEyeLifeState['irena']; rig: AllKnowingEyeLifeState['rig']; pending: AllKnowingEyeLifeState['pending']; currentAttempt: AllKnowingEyeAttempt | null;
  cases: { id: AllKnowingEyeCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: AllKnowingEyeAttempt[] }[];
  ledger: AllKnowingEyeLifeReceipt[]; actions: AllKnowingEyeLifeAction[];
}
const INSIGHT = 'reader.s1.bounded-insight', FORECAST = 'reader.s1.pending-forecast';
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 1;
const budget = (s: SliceState): AllKnowingEyeLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is AllKnowingEyeLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): AllKnowingEyeAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null });
const freshCase = (): AllKnowingEyeLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method): AllKnowingEyeAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, maraTravelMetres: 0, irenaTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0,
    permission: { owner: 'UNASKED', technician: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0, sourceRead: false, returnAgreed: false, entered: false, exited: false,
    papersTaken: false, papersReturned: false, readFirst: false, readSecond: false, handoverObserved: false, handoverObservation: null, handoverAttempted: false, handoverTier: null, handoverVerified: false, manualCompared: false,
    rigPlaced: false, rigReturned: false, sliderCocked: false, observedVersions: [], catchAttempted: false, catchTier: null, catchSucceeded: false, conditionChanged: false, sightlineCleared: false, handStopped: false, sliderRetrieved: false,
    insight: freshUse(), forecast: freshUse() };
}
export function createAllKnowingEyeLifeState(): AllKnowingEyeLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE', playerTravelMetres: 0, maraPresent: false,
    irena: { id: 'AE1-IRENA-VALE', name: '伊蕾娜·韦尔', age: 41, alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 0 },
    rig: { id: 'AE1-SLIDER-1', stopBlockId: 'AE1-STOP-1', owner: 'AE1-IRENA-VALE', price: 30, purchasedWeek: null, location: 'SUPPLIER', powered: false, sliderLocation: 'RIG', stopBlockLocation: 'RIG', motion: 'IDLE', direction: 'LEFT', sightline: 'CLEAR', conditionVersion: 1, movements: 0, catches: 0, manualStops: 0 },
    pending: null, cases: { 'original-paper-check': freshCase(), 'pending-slider': freshCase(), 'changed-conditions': freshCase() }, journal: [] };
}
export function allKnowingEyeOriginalSnapshot(s: SliceState): AllKnowingEyeOriginals {
  const l = s.wisdomAngel.life; return structuredClone({ playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, clockSeconds: l.clockSeconds, room: l.room, mara: l.mara, papers: l.papers, device: l.device });
}
function freshLife(week: number, originals: AllKnowingEyeOriginals): AllKnowingEyeLifeState { const l = createAllKnowingEyeLifeState(); l.sourceWeek = week; l.clockSeconds = originals.clockSeconds; return l; }
export function initializeAllKnowingEyeLifeState(s: SliceState): void {
  const source = s.allKnowingEye.sourceScene?.originals;
  if (!active(s) || !source || !same(s.allKnowingEye.life, createAllKnowingEyeLifeState()) || !same(allKnowingEyeOriginalSnapshot(s), source) || source.device.charges !== 0 || source.device.filter !== 'AMBER' || source.device.conditionVersion !== 2 || source.device.demonstrations !== 2 || source.device.filterChanges !== 1 || source.playerLocation !== 'EXIT' || source.mara.location !== 'EXIT' || source.papers.some(p => p.location !== 'TABLE') || source.device.location !== 'TABLE') throw new Error('须保留原玛拉、已读原纸和耗尽的同一原器具，再开始本次现场。');
  s.allKnowingEye.life = freshLife(s.week, source);
}
export function validateAllKnowingEyeActivityCommand(v: unknown): v is AllKnowingEyeActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && ALL_KNOWING_EYE_CASE_IDS.includes(v.caseId as AllKnowingEyeCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && ALL_KNOWING_EYE_CASE_IDS.includes(v.caseId as AllKnowingEyeCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'TECHNICIAN', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isAllKnowingEyeActivityCommand = validateAllKnowingEyeActivityCommand;
const current = (l: AllKnowingEyeLifeState): AllKnowingEyeAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: AllKnowingEyeLifeState) => l.activeCase !== null || l.playerLocation !== 'OUTSIDE' || l.maraPresent || l.irena.present || l.pending !== null || l.rig.location === 'TABLE' || l.rig.motion === 'COCKED' || l.rig.sliderLocation !== 'RIG';
export const hasAllKnowingEyeLifeLock = (s: SliceState): boolean => !!s.allKnowingEye?.life && locked(s.allKnowingEye.life);
interface Model { life: AllKnowingEyeLifeState; originals: AllKnowingEyeOriginals }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: AllKnowingEyeActivityCommand) => c.type === 'BOUNDED_INSIGHT' || c.type === 'PENDING_FORECAST';
const isCheck = (c: AllKnowingEyeActivityCommand) => isPower(c) || c.type === 'VERIFY_HANDOVER' || c.type === 'CATCH_SLIDER';
function checkSpec(m: Model, c: AllKnowingEyeActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  const catchStep = c.type === 'CATCH_SLIDER', forecast = c.type === 'PENDING_FORECAST';
  return { ability: catchStep || forecast ? 'perception' : 'knowledge', difficulty: isPower(c) ? 18 : 20,
    modifiers: !isPower(c) && validPending(m, catchStep ? 'FORECAST' : 'INSIGHT') ? [{ source: catchStep ? '本次可见滑块的有限预判' : '本次原纸核验的有限洞察', value: 10 }] : [] };
}
function audit(s: SliceState, c: AllKnowingEyeActivityCommand): Audit {
  const checked = isCheck(c), perception = c.type === 'PENDING_FORECAST' || c.type === 'CATCH_SLIDER';
  return { date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null, randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[perception ? 'perception' : 'knowledge'] : null, check: null };
}
function validPending(m: Model, kind: 'INSIGHT' | 'FORECAST'): boolean {
  const l = m.life, a = current(l), p = l.pending;
  return !!p && !!a && p.kind === kind && p.caseId === l.activeCase && l.clockSeconds + 4 <= p.expiresAt && p.conditionVersion === l.rig.conditionVersion && p.permissionVersion === a.permissionVersion && a.permission.owner === 'GRANTED' && a.permission.technician === 'GRANTED' && a.permission.ability === 'GRANTED' && l.playerLocation === 'TABLE' && (kind === 'INSIGHT' ? a.readFirst && a.readSecond && a.handoverObserved && m.originals.papers.every(paper => paper.location === 'PLAYER') : l.rig.motion === 'COCKED' && l.rig.sightline === 'CLEAR' && a.observedVersions.includes(l.rig.conditionVersion));
}
function transition(input: Model, c: AllKnowingEyeActivityCommand, week: number, outcome: PublicResolutionTier | null, before: AllKnowingEyeLifeBudget, clock: Audit): { model: Model; receipt: AllKnowingEyeLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  let a = current(l);
  const receipt: AllKnowingEyeLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, maraWalkedMetres: 0, irenaWalkedMetres: 0, originalsBefore: structuredClone(o), originalsAfter: structuredClone(o), source: isCheck(c) && a && id ? { caseId: id, atSeconds: l.clockSeconds, conditionVersion: l.rig.conditionVersion, permissionVersion: a.permissionVersion, paperIds: o.papers.filter((_, i) => i === 0 ? a!.readFirst : a!.readSecond).map(p => p.id), handoverObserved: a.handoverObserved, sliderId: a.rigPlaced && !a.rigReturned ? l.rig.id : null, sightline: a.observedVersions.includes(l.rig.conditionVersion) ? l.rig.sightline : null, movement: l.rig.motion === 'COCKED' && a.observedVersions.includes(l.rig.conditionVersion) ? 'COCKED' : null, bonus: !isPower(c) && validPending(m, c.type === 'CATCH_SLIDER' ? 'FORECAST' : 'INSIGHT') ? 10 : 0 } : null, sliderTransitions: [] };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const end = (state: AllKnowingEyeWindow) => { if (l.pending && a) { const use = l.pending.kind === 'INSIGHT' ? a.insight : a.forecast; use.state = state; use.remainingSeconds = 0; l.pending = null; } };
  const move = (to: 'OUTSIDE' | 'EXIT' | 'TABLE') => {
    if (l.playerLocation === to) return;
    receipt.playerWalkedMetres += 4; receipt.elapsedSeconds += 4;
    if (l.playerLocation === 'TABLE' || to === 'TABLE') { o.playerTravelMetres += 4; o.playerLocation = to === 'TABLE' ? 'TABLE' : 'EXIT'; }
    l.playerLocation = to;
  };
  const companions = (to: 'EXIT' | 'TABLE') => {
    if (o.mara.location !== to) { o.mara.location = to; o.mara.travelMetres += 4; receipt.maraWalkedMetres += 4; }
    if (l.irena.location !== to) { l.irena.location = to; receipt.irenaWalkedMetres += 4; }
  };
  const putPapers = () => { if (o.papers.some(p => p.location === 'PLAYER')) { for (const p of o.papers) p.location = 'TABLE'; a!.papersReturned = true; receipt.elapsedSeconds += 2; } };
  const handStop = () => { if (l.rig.motion === 'COCKED') { l.rig.motion = 'STOPPED'; l.rig.sliderLocation = 'STOP_BLOCK'; l.rig.manualStops++; a!.handStopped = true; receipt.sliderTransitions.push('HAND_STOP'); receipt.elapsedSeconds += 1; } end('STOPPED'); };
  const retrieve = () => { if (l.rig.sliderLocation !== 'RIG') { receipt.elapsedSeconds += l.rig.sliderLocation === 'FLOOR' ? 4 : 2; l.rig.sliderLocation = 'RIG'; a!.sliderRetrieved = true; receipt.sliderTransitions.push('RETRIEVE'); } };
  const returnRig = () => { if (l.rig.location === 'TABLE') { l.rig.location = 'PLAYER'; a!.rigReturned = true; receipt.elapsedSeconds += 2; } };
  const leave = () => { l.irena.present = false; l.irena.location = 'AWAY'; receipt.irenaWalkedMetres += 4; l.maraPresent = false; move('OUTSIDE'); l.activeCase = null; r!.contactOpen = false; r!.returned = true; a!.closed = true; for (const key of ['owner', 'technician', 'ability'] as const) a!.permission[key] = 'CLOSED'; };
  const physical = !!a && !!r && r.status === 'ACTIVE' && a.week === week && l.irena.present && l.maraPresent;
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  const table = physical && a!.entered && !a!.exited && l.playerLocation === 'TABLE' && o.playerLocation === 'TABLE' && o.mara.location === 'TABLE' && l.irena.location === 'TABLE';
  const permitted = table && a!.permission.owner === 'GRANTED' && a!.permission.technician === 'GRANTED';
  switch (c.type) {
    case 'BUY_RIG':
      if (locked(l) || l.rig.purchasedWeek !== null || l.rig.location !== 'SUPPLIER' || l.cases['original-paper-check'].status === 'AVAILABLE') return null;
      pay(1, 30); l.rig.owner = 'PLAYER'; l.rig.purchasedWeek = week; l.rig.location = 'PLAYER'; receipt.elapsedSeconds = 2; break;
    case 'OBSERVE': {
      const index = ALL_KNOWING_EYE_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[ALL_KNOWING_EYE_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'WALK_TO_ROOM':
      if (locked(l) || l.rig.location !== 'PLAYER' || !Object.values(l.cases).some(x => x.status === 'OBSERVED' || x.status === 'PAUSED')) return null;
      move('EXIT'); break;
    case 'INVITE':
      if (l.activeCase || l.playerLocation !== 'EXIT' || l.irena.present || l.maraPresent || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!) || l.rig.location !== 'PLAYER') return null;
      pay(1, 10); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method)); a = r!.attempts.at(-1)!;
      l.activeCase = c.caseId; l.maraPresent = true; l.irena.present = true; l.irena.location = 'EXIT'; receipt.irenaWalkedMetres = 4; receipt.elapsedSeconds = 4; break;
    case 'READ_SOURCE':
      if (!physical || a!.sourceRead || a!.entered) return null;
      a!.sourceRead = true; receipt.elapsedSeconds = 2; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'TECHNICIAN' ? 'technician' : 'ability';
      if (!physical || !a!.sourceRead || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      if (id === 'changed-conditions' && c.type === 'WITHDRAW_CONSENT' && key === 'owner' && a!.entered && !a!.conditionChanged) return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (c.type !== 'CONSENT') end('STOPPED'); receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 2; break;
    }
    case 'AGREE_RETURN':
      if (!physical || a!.returnAgreed || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED' || a!.permission.ability === 'UNASKED') return null;
      a!.returnAgreed = true; receipt.elapsedSeconds = 2; break;
    case 'ENTER_ROOM':
      if (!physical || a!.entered || !a!.returnAgreed || l.playerLocation !== 'EXIT' || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED') return null;
      move('TABLE'); companions('TABLE'); a!.entered = true; break;
    case 'TAKE_PAPERS':
      if (!permitted || a!.papersTaken || o.papers.some(p => p.location !== 'TABLE')) return null;
      for (const p of o.papers) p.location = 'PLAYER'; a!.papersTaken = true; receipt.elapsedSeconds = 2; break;
    case 'READ_FIRST': case 'READ_SECOND': {
      const key = c.type === 'READ_FIRST' ? 'readFirst' : 'readSecond';
      if (!permitted || !a!.papersTaken || a!.papersReturned || a![key]) return null;
      a![key] = true; receipt.elapsedSeconds = 4; break;
    }
    case 'OBSERVE_HANDOVER':
      if (!permitted || id !== 'original-paper-check' || !a!.readFirst || !a!.readSecond || a!.papersReturned || a!.handoverObserved) return null;
      a!.handoverObserved = true; a!.handoverObservation = '眼前同两张原纸仍由本人持有，玛拉站在原桌旁；纸面归还计划尚不等于本次实际交回。'; receipt.elapsedSeconds = 2; break;
    case 'BOUNDED_INSIGHT': case 'PENDING_FORECAST': {
      const insight = c.type === 'BOUNDED_INSIGHT', key = insight ? 'insight' : 'forecast';
      if (!permitted || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || l.pending || r!.attempts.some(x => x[key].attempts > 0)) return null;
      if (insight ? id !== 'original-paper-check' || !a!.readFirst || !a!.readSecond || !a!.handoverObserved || a!.papersReturned || a!.handoverAttempted || a!.handoverVerified : id === 'original-paper-check' || !a!.rigPlaced || a!.rigReturned || l.rig.motion !== 'COCKED' || l.rig.sightline !== 'CLEAR' || !a!.observedVersions.includes(l.rig.conditionVersion) || a!.catchAttempted || a!.conditionChanged) return null;
      pay(0, 0, insight ? 6 : 8, insight ? 2 : 3); receipt.elapsedSeconds = 2; a!.spiritualitySpent += insight ? 6 : 8; a!.mindSpent += insight ? 2 : 3;
      const use = a![key]; use.attempts = 1; use.successes = success(outcome) ? 1 : 0; use.tier = outcome; use.state = success(outcome) ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = success(outcome) ? 30 : 0; use.conditionVersion = l.rig.conditionVersion;
      if (success(outcome)) l.pending = { kind: insight ? 'INSIGHT' : 'FORECAST', caseId: id!, createdAt: l.clockSeconds + 2, expiresAt: l.clockSeconds + 32, conditionVersion: l.rig.conditionVersion, permissionVersion: a!.permissionVersion, bonus: 10 };
      break;
    }
    case 'VERIFY_HANDOVER': {
      if (!permitted || id !== 'original-paper-check' || !a!.readFirst || !a!.readSecond || !a!.handoverObserved || a!.papersReturned || a!.handoverVerified || r!.attempts.some(x => x.handoverAttempted)) return null;
      const helped = validPending(m, 'INSIGHT'); a!.handoverAttempted = true; a!.handoverTier = outcome; a!.handoverVerified = success(outcome); receipt.elapsedSeconds = 4;
      if (helped && success(outcome)) { a!.insight.effects = 1; end('APPLIED'); } else end(helped ? 'CHECK_FAILED' : 'EXPIRED');
      if (success(outcome)) a!.result = helped ? 'ABILITY' : 'ORDINARY'; break;
    }
    case 'MANUAL_COMPARE':
      if (!permitted || id !== 'original-paper-check' || !a!.readFirst || !a!.readSecond || !a!.handoverObserved || a!.papersReturned || a!.handoverVerified || a!.manualCompared) return null;
      end('STOPPED'); a!.manualCompared = true; a!.handoverVerified = true; a!.result = 'ORDINARY'; receipt.elapsedSeconds = 6; break;
    case 'PLACE_RIG':
      if (!permitted || id === 'original-paper-check' || !a!.readFirst || !a!.readSecond || a!.rigPlaced || l.rig.location !== 'PLAYER') return null;
      l.rig.location = 'TABLE'; a!.rigPlaced = true; receipt.elapsedSeconds = 2; break;
    case 'COCK_SLIDER':
      if (!permitted || !a!.rigPlaced || a!.rigReturned || a!.sliderCocked || l.rig.motion === 'COCKED' || l.rig.sliderLocation !== 'RIG' || l.rig.sightline !== 'CLEAR') return null;
      l.rig.motion = 'COCKED'; a!.sliderCocked = true; receipt.sliderTransitions.push('HAND_COCK'); receipt.elapsedSeconds = 2; break;
    case 'OBSERVE_SLIDER':
      if (!permitted || !a!.rigPlaced || a!.rigReturned || l.rig.motion !== 'COCKED' || l.rig.sightline !== 'CLEAR' || a!.observedVersions.includes(l.rig.conditionVersion)) return null;
      a!.observedVersions.push(l.rig.conditionVersion); receipt.elapsedSeconds = 2; break;
    case 'CATCH_SLIDER': {
      if (!permitted || id !== 'pending-slider' || !a!.rigPlaced || a!.rigReturned || l.rig.motion !== 'COCKED' || l.rig.sightline !== 'CLEAR' || !a!.observedVersions.includes(l.rig.conditionVersion) || r!.attempts.some(x => x.catchAttempted)) return null;
      const helped = validPending(m, 'FORECAST'); a!.catchAttempted = true; a!.catchTier = outcome; a!.catchSucceeded = success(outcome); receipt.elapsedSeconds = 4;
      l.rig.movements++; l.rig.motion = 'STOPPED'; l.rig.sliderLocation = success(outcome) ? 'STOP_BLOCK' : 'FLOOR'; receipt.sliderTransitions.push('RELEASE', success(outcome) ? 'CATCH' : 'MISS');
      if (success(outcome)) { l.rig.catches++; a!.result = helped ? 'ABILITY' : 'ORDINARY'; }
      if (helped && success(outcome)) { a!.forecast.effects = 1; end('APPLIED'); } else end(helped ? 'CHECK_FAILED' : 'EXPIRED');
      break;
    }
    case 'CHANGE_CONDITIONS':
      if (!permitted || id !== 'changed-conditions' || !a!.rigPlaced || a!.rigReturned || a!.conditionChanged || l.rig.motion !== 'COCKED' || !a!.observedVersions.includes(l.rig.conditionVersion)) return null;
      end('INVALIDATED'); l.rig.direction = l.rig.direction === 'LEFT' ? 'RIGHT' : 'LEFT'; l.rig.sightline = 'SHUTTERED'; l.rig.conditionVersion++; a!.conditionChanged = true; receipt.sliderTransitions.push('CHANGE_DIRECTION', 'SHUTTER'); receipt.elapsedSeconds = 2; break;
    case 'CLEAR_SIGHTLINE':
      if (!table || l.rig.location !== 'TABLE' || l.rig.sightline !== 'SHUTTERED' || !a!.conditionChanged) return null;
      end('INVALIDATED'); l.rig.sightline = 'CLEAR'; l.rig.conditionVersion++; a!.sightlineCleared = true; receipt.sliderTransitions.push('CLEAR'); receipt.elapsedSeconds = 1; break;
    case 'HAND_STOP':
      if (!table || !a!.rigPlaced || a!.rigReturned || l.rig.motion !== 'COCKED') return null;
      handStop(); if (id === 'pending-slider') a!.result = 'ORDINARY'; break;
    case 'RETRIEVE_SLIDER':
      if (!table || !a!.rigPlaced || a!.rigReturned || l.rig.motion === 'COCKED' || l.rig.sliderLocation === 'RIG') return null;
      retrieve(); if (id === 'pending-slider' && a!.result === 'NONE') a!.result = 'ORDINARY'; break;
    case 'STOP_METHOD':
      if (!physical || !l.pending) return null;
      end('STOPPED'); break;
    case 'WAIT_WINDOW':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); end('EXPIRED'); break;
    case 'RETURN_PAPERS':
      if (!table || !a!.papersTaken || a!.papersReturned) return null;
      end('STOPPED'); putPapers(); break;
    case 'RETURN_RIG':
      if (!table || !a!.rigPlaced || a!.rigReturned || l.rig.motion === 'COCKED' || l.rig.sliderLocation !== 'RIG' || l.rig.sightline !== 'CLEAR') return null;
      end('STOPPED'); returnRig(); break;
    case 'EXIT_ROOM':
      if (!table || l.pending || o.papers.some(p => p.location !== 'TABLE') || l.rig.location !== 'PLAYER' || l.rig.motion === 'COCKED' || l.rig.sliderLocation !== 'RIG' || l.rig.sightline !== 'CLEAR') return null;
      move('EXIT'); companions('EXIT'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || l.playerLocation !== 'EXIT' || o.mara.location !== 'EXIT' || l.pending || o.papers.some(p => p.location !== 'TABLE') || l.rig.location !== 'PLAYER' || l.rig.motion === 'COCKED' || l.rig.sliderLocation !== 'RIG' || l.rig.sightline !== 'CLEAR') return null;
      if (id === 'changed-conditions' && a!.conditionChanged && a!.permission.owner === 'WITHDRAWN' && a!.handStopped && a!.sliderRetrieved && a!.sightlineCleared) a!.result = 'ORDINARY';
      if (a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED') a!.result = 'ORDINARY';
      if (a!.result === 'NONE') return null;
      r!.result = a!.result; r!.status = 'EXAMINED'; leave(); break;
    case 'ABORT':
      // This is one atomic public command, with every actual safe movement and
      // return cost recorded. No AP, new consent, refund or hidden teleport.
      if (!physical) { if (l.playerLocation !== 'EXIT' || l.activeCase || l.irena.present || l.maraPresent) return null; move('OUTSIDE'); break; }
      end('STOPPED');
      if (l.playerLocation === 'TABLE') {
        handStop(); retrieve(); if (l.rig.sightline === 'SHUTTERED') { l.rig.sightline = 'CLEAR'; l.rig.conditionVersion++; a!.sightlineCleared = true; receipt.sliderTransitions.push('CLEAR'); receipt.elapsedSeconds++; }
        putPapers(); returnRig(); move('EXIT'); companions('EXIT'); a!.exited = true;
      }
      if (a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED') a!.result = 'ORDINARY';
      if (id === 'changed-conditions' && a!.conditionChanged && a!.permission.owner === 'WITHDRAWN' && a!.handStopped && a!.sliderRetrieved && a!.sightlineCleared) a!.result = 'ORDINARY';
      r!.result = a!.result; r!.status = a!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; leave(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || o.papers.some(p => p.location !== 'TABLE') || o.mara.location !== 'EXIT') return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !ALL_KNOWING_EYE_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 5; break;
  }
  if (!validBudget(receipt.after)) return null;
  l.clockSeconds += receipt.elapsedSeconds; l.elapsedSeconds += receipt.elapsedSeconds; o.clockSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.irena.travelMetres += receipt.irenaWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.maraTravelMetres += receipt.maraWalkedMetres; a.irenaTravelMetres += receipt.irenaWalkedMetres; }
  if (l.pending && a) { const use = l.pending.kind === 'INSIGHT' ? a.insight : a.forecast; use.remainingSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); if (use.remainingSeconds === 0) end('EXPIRED'); }
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: AllKnowingEyeLifeState, s: SliceState): Model | null {
  const source = s.allKnowingEye.sourceScene?.originals;
  if (!source || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 500) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: AllKnowingEyeLifeReceipt | null = null, lastWeek = l.sourceWeek, lastRandomAfter = s.allKnowingEye.sourceScene!.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'elapsedSeconds', 'playerWalkedMetres', 'maraWalkedMetres', 'irenaWalkedMetres', 'originalsBefore', 'originalsAfter', 'source', 'sliderTransitions']) || !validateAllKnowingEyeActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.allKnowingEye.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (locked(model.life) && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      const spec = checkSpec(model, entry.command);
      if (entry.checkBase !== s.character.coreStats[spec.ability] || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const rng = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ...spec, baseAbility: entry.checkBase, roll: rng.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.outcome !== null || entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry);
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; model.life.journal.push(structuredClone(entry)); previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function allKnowingEyeExpectedOriginals(s: SliceState): AllKnowingEyeOriginals | null {
  const l = s.allKnowingEye.life;
  if (l.sourceWeek === null) return s.allKnowingEye.sourceScene ? structuredClone(s.allKnowingEye.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function allKnowingEyeLifeMasteryGains(s: SliceState): Record<typeof INSIGHT | typeof FORECAST, number> {
  const result = { [INSIGHT]: 0, [FORECAST]: 0 };
  for (const id of ALL_KNOWING_EYE_CASE_IDS) {
    const r = s.allKnowingEye.life.cases[id]; if (r.status !== 'RESOLVED' || id === 'changed-conditions') continue;
    if (r.attempts.some(a => a.insight.effects === 1)) result[INSIGHT] += 8;
    if (r.attempts.some(a => a.forecast.effects === 1)) result[FORECAST] += 8;
  }
  return result;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.wisdomAngel.life.activeCase !== null || Object.values(s.wisdomAngel.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.wisdomAngel.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.wisdomAngel.encounter.status) || s.insightScholar.life.activeCase !== null || s.insightScholar.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.insightScholar.encounter.status);
}
export function validateAllKnowingEyeLifeState(s: SliceState): boolean {
  try {
    const l = s.allKnowingEye?.life;
    if (!record(l) || !shape(l, Object.keys(createAllKnowingEyeLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, ALL_KNOWING_EYE_CASE_IDS)) return false;
    if (s.allKnowingEye.promotionWeek === null) return same(l, createAllKnowingEyeLifeState());
    const source = s.allKnowingEye.sourceScene?.originals, history = s.allKnowingEye.sourceHistory?.wisdomAngel.life;
    if (!source || !history || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.allKnowingEye.promotionWeek || source.device.charges !== 0 || source.device.conditionVersion !== 2 || source.device.filter !== 'AMBER' || source.device.demonstrations !== 2 || source.device.filterChanges !== 1 || !same(s.wisdomAngel.life.cases, history.cases) || !same(s.wisdomAngel.life.journal, history.journal)) return false;
    if (!same(source, { playerLocation: history.playerLocation, playerTravelMetres: history.playerTravelMetres, clockSeconds: history.clockSeconds, room: history.room, mara: history.mara, papers: history.papers, device: history.device })) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(allKnowingEyeOriginalSnapshot(s), replay.originals)) return false;
    const gains = allKnowingEyeLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of ALL_KNOWING_EYE_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `all-knowing-eye-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'all-knowing-eye-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[INSIGHT] ?? 0) < gains[INSIGHT] || (s.progression.mastery[FORECAST] ?? 0) < gains[FORECAST]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.allKnowingEye.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.allKnowingEye.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.after.actions > 0 && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    return true;
  } catch { return false; }
}
export const validateAllKnowingEyeLife = validateAllKnowingEyeLifeState;
export function blockAllKnowingEyeLife(s: SliceState, c: AllKnowingEyeActivityCommand): string | null {
  if (!validateAllKnowingEyeActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为全知之眼。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.allKnowingEye.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.allKnowingEye.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateAllKnowingEyeLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.allKnowingEye.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成所需实际步骤，并核对当前许可、位置、现金与行动。失败不能重抽；停止、还物和退出不耗行动。';
  return null;
}
export const blockAllKnowingEyeActivity = blockAllKnowingEyeLife;
/** Update only live source fields in their existing objects. Neither the old
 * cases nor the old journal is replaced, appended to, or retroactively edited. */
function writeOriginals(s: SliceState, o: AllKnowingEyeOriginals): void {
  const live = s.wisdomAngel.life; live.playerLocation = o.playerLocation; live.playerTravelMetres = o.playerTravelMetres; live.clockSeconds = o.clockSeconds;
  Object.assign(live.room, o.room); Object.assign(live.mara, o.mara); Object.assign(live.device, o.device);
  for (let i = 0; i < 2; i++) Object.assign(live.papers[i]!, o.papers[i]!);
}
export function applyAllKnowingEyeLifeCommand(s: SliceState, c: AllKnowingEyeActivityCommand, ctx: SeerContext): void {
  const reason = blockAllKnowingEyeLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.allKnowingEye.life, s)!, before = budget(s), clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock)!;
  const l = next.model.life; l.journal.push(next.receipt); s.allKnowingEye.life = l; writeOriginals(s, next.model.originals);
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`all-knowing-eye-case:${c.caseId}`);
    if (c.caseId !== 'changed-conditions') for (const [ability, key] of [[INSIGHT, 'insight'], [FORECAST, 'forecast']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('all-knowing-eye-reflection'); }
  const checked = check ? `本次${check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS' ? '成功' : '失败'}；实际检定与已付代价保留。` : '';
  ctx.note(LABELS[c.type], `${DETAILS[c.type]}${checked}本步实耗${next.receipt.elapsedSeconds}秒；原示范器仍为0储能，同两张纸的原文与首次阅读记录不变。`);
}
export const applyAllKnowingEyeActivity = applyAllKnowingEyeLifeCommand;
const CASES = [
  { id: 'original-paper-check', title: '原纸与眼前交接', story: '回到玛拉的同一资料室，重新询问这一次许可。亲手读同两张原纸，再观察当前持有位置。现场洞察只帮助下一次独立核验；还须实际核对，不能据此判断罪责。' },
  { id: 'pending-slider', title: '尚未发生的一次滑动', story: '伊蕾娜把同一非动力滑块放到原桌。先亲手上弦，再看清方向与挡块。先机预判只为这一次实际接取提供有限帮助；仍须独立检定，失手后同一滑块会落在桌边地面，须亲手捡回。' },
  { id: 'changed-conditions', title: '条件改变与当前撤回', story: '仍是原滑块与同一人。伊蕾娜亲手改变方向、关闭遮片，旧预判即刻失效。玛拉随后撤回本次许可；普通停住滑块、打开遮片、取回部件、还纸与步行离场仍可完成。' },
] as const;
const LABELS: Record<AllKnowingEyeActivityCommand['type'], string> = {
  OBSERVE: '查看本案来源与普通退路', BUY_RIG: '购买唯一非动力滑块与挡块', WALK_TO_ROOM: '沿四米通路走到原资料室入口', INVITE: '重新付费邀请伊蕾娜参加本案', READ_SOURCE: '当面核对原人、原纸与耗尽器具', CONSENT: '确认这一项当前许可', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可', AGREE_RETURN: '约定普通归还与随时停止', ENTER_ROOM: '三人沿原四米路走至原桌', TAKE_PAPERS: '亲手取同两张原纸', READ_FIRST: '重新实读第一张原纸', READ_SECOND: '重新实读第二张原纸', OBSERVE_HANDOVER: '观察眼前原纸持有位置', BOUNDED_INSIGHT: '尝试一次现场洞察', VERIFY_HANDOVER: '独立核验当前交接', MANUAL_COMPARE: '普通逐项比较并当面核对', PLACE_RIG: '亲手放下同一滑块与挡块', COCK_SLIDER: '亲手设置一次待发滑动', OBSERVE_SLIDER: '亲眼观察当前滑块方向与视线', PENDING_FORECAST: '尝试一次先机预判', CATCH_SLIDER: '实际放开并独立接取原滑块', CHANGE_CONDITIONS: '伊蕾娜实际改变方向并关闭遮片', CLEAR_SIGHTLINE: '普通打开同一遮片', HAND_STOP: '亲手把待发滑块停在原挡块', RETRIEVE_SLIDER: '亲手取回同一原滑块', STOP_METHOD: '停止未使用的有限帮助', WAIT_WINDOW: '实际等到当前窗口到期', RETURN_PAPERS: '亲手归还同两张原纸', RETURN_RIG: '亲手收回自己的原滑块与挡块', EXIT_ROOM: '三人沿原四米路退出', LEAVE: '结束接触并实际步行离开', ABORT: '安全停住、还物并普通离开', REPORT: '报告真实结果与归还', REFLECT: '反思当前证据、条件和许可',
};
const DETAILS: Record<AllKnowingEyeActivityCommand['type'], string> = {
  OBSERVE: '本案先说明实际来源、费用和可用的普通做法。', BUY_RIG: '实付30便士和1行动，取得唯一滑块与挡块；没有电池、自动供能或新的旧器具。', WALK_TO_ROOM: '本人携已购买的原滑块沿四米通路走到原入口。', INVITE: '实付10便士和1行动。41岁的伊蕾娜沿四米通路到场；玛拉和她的当前许可都须重新询问。', READ_SOURCE: '43岁的原玛拉、同两张原纸和桌上耗尽的同一器具均当面核对；旧案许可没有沿用。', CONSENT: '当前本人只同意这一项说明过的用途，可以随时撤回。', DECLINE_CONSENT: '拒绝已记录，不会用能力覆盖；仍可安全归还退出。', WITHDRAW_CONSENT: '当前许可立即结束，未用窗口停止，不退还实耗。', AGREE_RETURN: '已经约定随时停止，原物须亲手归还，三人须沿原路退出。', ENTER_ROOM: '三人各走原四米通路到桌旁；原纸和耗尽器具原先仍在原桌。', TAKE_PAPERS: '同两张原纸从原桌交到本人手中，所有权不变。', READ_FIRST: '重新读同一第一张原纸；没有改写原文或过去首次阅读日期。', READ_SECOND: '重新读同一第二张原纸；没有改写原文或过去首次阅读日期。', OBSERVE_HANDOVER: '眼前两纸仍由本人持有，玛拉在原桌旁；纸面计划不证明当前已交回，也不判定谁有罪。', BOUNDED_INSIGHT: '实付6灵性、2精神。知识18的一次施用，成功仅为30秒内下一次真实核验加值10；尚未完成核验。', VERIFY_HANDOVER: '另作一次知识20的当前核验，仅有效窗口加值10。失败不重抽，可逐项普通比较。', MANUAL_COMPARE: '亲手逐行比较并与眼前持有位置对应，完成当前普通核对。未使用能力不计能力掌握。', PLACE_RIG: '本人在原桌亲手放下已购买的同一非动力滑块和挡块。', COCK_SLIDER: '用手设置一次实际待发滑动；没有启动旧示范器或补充储能。', OBSERVE_SLIDER: '亲眼观察当前方向、挡块和清晰视线，只记录当前条件版本。', PENDING_FORECAST: '实付8灵性、3精神。感知18的一次施用，成功仅为30秒内同一可见待发滑动的独立接取加值10；不自动控制滑块。', CATCH_SLIDER: '本人实际放开滑块，再作独立感知20接取。有效窗口只加值10；失败保留，原滑块落至桌边地面，仍须普通取回。', CHANGE_CONDITIONS: '伊蕾娜亲手改变原滑块方向并关闭同一遮片，条件版本增加，旧预测立即失效，没有能力奖励。', CLEAR_SIGHTLINE: '亲手打开遮片，条件版本再次增加；旧预测不会恢复。', HAND_STOP: '用手将当前待发滑块停在同一挡块上。普通控制仍须本人实际操作。', RETRIEVE_SLIDER: '本人从实际挡块或桌边地面取回唯一原滑块；失手造成的用时和施术成本不退。', STOP_METHOD: '只终止未使用的有限窗口，不移动物品，也不退款。', WAIT_WINDOW: '真实时钟推进至本次窗口终点，失效后不能追认或续窗。', RETURN_PAPERS: '在原桌亲手放回同两张原纸，所有权、原文和过去阅读记录不变。', RETURN_RIG: '确认滑块已停止并实际取回后，收回自己的同一原滑块与挡块。', EXIT_ROOM: '三人各沿原四米通路走回入口，没有隔空移动原物。', LEAVE: '伊蕾娜实际走四米离场，玛拉的当前接触关闭，本人携原滑块步行四米离开。', ABORT: '先在实际位置停住滑块、拾回同一部件并打开遮片，亲手还纸取物，再沿原四米路和门外四米路退出。失败和已付费用保留；未完成内容以后仅可普通续办。', REPORT: '实付1行动，真实报告增加25扮演。只有施术成功且独立核验或接取实际成功应用，才增加对应新能力掌握8。', REFLECT: '三案真实报告后实付1行动，增加25扮演。认识证据不等于真相，预判不会替代动作或当前许可。',
};
const COSTS: Partial<Record<AllKnowingEyeActivityCommand['type'], string>> = {
  OBSERVE: '1行动 · 5秒', BUY_RIG: '1行动 · 30便士 · 唯一原滑块与挡块', INVITE: '1行动 · 每次10便士 · 伊蕾娜步行4米', WALK_TO_ROOM: '0行动 · 本人4米、4秒', ENTER_ROOM: '0行动 · 三人各4米、4秒', EXIT_ROOM: '0行动 · 三人各4米、4秒', LEAVE: '0行动 · 本人与伊蕾娜各4米、4秒', BOUNDED_INSIGHT: '0行动 · 6灵性＋2精神 · 知识18 · 最长30秒', PENDING_FORECAST: '0行动 · 8灵性＋3精神 · 感知18 · 最长30秒', VERIFY_HANDOVER: '0行动 · 知识20 · 4秒 · 一次独立检定', CATCH_SLIDER: '0行动 · 感知20 · 4秒 · 一次独立检定', MANUAL_COMPARE: '0行动 · 6秒 · 普通核对', READ_FIRST: '0行动 · 4秒', READ_SECOND: '0行动 · 4秒', HAND_STOP: '0行动 · 1秒 · 手动停住', RETRIEVE_SLIDER: '0行动 · 挡块2秒／落地4秒', CLEAR_SIGHTLINE: '0行动 · 1秒 · 新条件版本', WITHDRAW_CONSENT: '0行动0秒 · 即刻停止当前窗口', STOP_METHOD: '0行动0秒 · 不退款', ABORT: '0行动 · 实际停住、取还原物与步行', REPORT: '1行动 · 扮演25 · 实际应用才掌握8', REFLECT: '1行动 · 扮演25',
};
export function allKnowingEyeLifeActions(s: SliceState): AllKnowingEyeLifeAction[] {
  if (!active(s)) return [];
  const l = s.allKnowingEye.life, a = current(l), out: AllKnowingEyeLifeAction[] = [];
  const add = (command: AllKnowingEyeActivityCommand, preferred = false, cleanup = false, label?: string) => { const reason = blockAllKnowingEyeLife(s, command); out.push({ id: `all-knowing-eye-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label: label ?? LABELS[command.type], cost: command.type === 'WAIT_WINDOW' ? `0行动 · 真实等待${Math.max(0, (l.pending?.expiresAt ?? l.clockSeconds) - l.clockSeconds)}秒` : COSTS[command.type] ?? '0行动 · 实际2秒', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup }); };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (l.playerLocation === 'EXIT' && next) { const r = l.cases[next.id]; if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, true, false, '实付10便士，邀请伊蕾娜并说明有限能力'); add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED', false, r.status === 'PAUSED' ? '跨周实付10便士，重新邀请普通续办' : '实付10便士，邀请伊蕾娜作普通核对'); step('ABORT', false, true); return out; }
    if (next) { const r = l.cases[next.id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, true); else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true); else if (l.rig.purchasedWeek === null) step('BUY_RIG'); else if (r.status === 'PAUSED' && s.week <= r.invitationWeeks.at(-1)!) add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, false, false, '下周可付费重新邀请，只作普通续办'); else step('WALK_TO_ROOM'); }
    else if (!l.reflected) step('REFLECT');
    return out;
  }
  const id = l.activeCase!;
  const resultReady = a.result !== 'NONE' || id === 'changed-conditions' && a.conditionChanged && a.permission.owner === 'WITHDRAWN' && a.handStopped && a.sliderRetrieved && a.sightlineCleared;
  const denied = a.permission.owner === 'DECLINED' || a.permission.technician === 'DECLINED';
  const withdrawn = a.permission.owner === 'WITHDRAWN' || a.permission.technician === 'WITHDRAWN';
  if (!a.sourceRead) step('READ_SOURCE');
  else if (denied && !a.entered) step('LEAVE', true, true);
  else if (!a.entered) {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.technician === 'UNASKED' ? 'TECHNICIAN' : a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) { if (permission !== 'ABILITY' || a.method === 'ABILITY') add({ type: 'CONSENT', permission }, true, false, permission === 'OWNER' ? '重新询问玛拉本案借纸与现场许可' : permission === 'TECHNICIAN' ? '询问伊蕾娜本人这一次参与意愿' : '说明并询问这一次有限能力许可'); add({ type: 'DECLINE_CONSENT', permission }, permission === 'ABILITY' && a.method === 'ORDINARY', true, '尊重这一次拒绝，保留普通退路'); }
    else if (!a.returnAgreed) step('AGREE_RETURN'); else step('ENTER_ROOM');
  } else if (resultReady) {
    if (l.rig.sliderLocation !== 'RIG') step('RETRIEVE_SLIDER', true, true);
    else if (a.papersTaken && !a.papersReturned) step('RETURN_PAPERS', true, true);
    else if (a.rigPlaced && !a.rigReturned) step('RETURN_RIG', true, true);
    else if (!a.exited) step('EXIT_ROOM', true, true); else step('LEAVE', true, true);
  } else if (withdrawn && id !== 'changed-conditions') step('ABORT', true, true);
  else if (!a.papersTaken) step('TAKE_PAPERS');
  else if (!a.readFirst) step('READ_FIRST');
  else if (!a.readSecond) step('READ_SECOND');
  else if (id === 'original-paper-check') {
    if (!a.handoverObserved) step('OBSERVE_HANDOVER');
    else { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.insight.attempts)) step('BOUNDED_INSIGHT'); if (!l.cases[id].attempts.some(x => x.handoverAttempted)) step('VERIFY_HANDOVER', a.insight.state === 'ACTIVE'); step('MANUAL_COMPARE', a.method === 'ORDINARY' || a.handoverAttempted, true); }
  } else if (!a.rigPlaced) step('PLACE_RIG');
  else if (!a.sliderCocked) step('COCK_SLIDER');
  else if (!a.observedVersions.length) step('OBSERVE_SLIDER');
  else if (id === 'changed-conditions' && a.conditionChanged) {
    if (a.permission.owner === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, true, true, '玛拉撤回本案当前许可');
    else if (l.rig.motion === 'COCKED') step('HAND_STOP', true, true);
    else if (l.rig.sightline === 'SHUTTERED') step('CLEAR_SIGHTLINE', true, true);
    else if (l.rig.sliderLocation !== 'RIG') step('RETRIEVE_SLIDER', true, true);
  } else if (l.rig.sliderLocation !== 'RIG') step('RETRIEVE_SLIDER', true, true);
  else {
    if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.forecast.attempts)) step('PENDING_FORECAST');
    if (id === 'changed-conditions') step('CHANGE_CONDITIONS', a.forecast.attempts > 0 || a.method === 'ORDINARY');
    else { if (!l.cases[id].attempts.some(x => x.catchAttempted)) step('CATCH_SLIDER', a.forecast.state === 'ACTIVE'); step('HAND_STOP', a.method === 'ORDINARY', true); }
  }
  if (l.pending) { step('WAIT_WINDOW', false, true); step('STOP_METHOD', false, true); }
  if (a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true, '撤回本次有限能力许可');
  step('ABORT', false, true);
  return out;
}
export function projectAllKnowingEyeLife(s: SliceState): AllKnowingEyeLifeProjection {
  const l = s.allKnowingEye.life, originals = allKnowingEyeOriginalSnapshot(s), actions = allKnowingEyeLifeActions(s);
  return { title: '原纸、待发滑块与普通归还', story: '现场洞察与先机预判都只帮助下一次实际行动。成功施用不等于完成核验；失败、过期、条件改变和撤回都保留真实结果。三案报告各25扮演，反思25；每案对应新能力只有成功且实际应用才增加8掌握。', source: '同一玛拉、原资料室、两张实读原纸与已耗尽的原示范器；另付费购买唯一非动力滑块。', environment: '门外通路4米，原资料室入口至原桌4米，出口始终开放。原玛拉43岁，伊蕾娜·韦尔41岁且每案重新邀请。滑块与挡块30便士、1行动；每次邀请10便士、1行动，费用支付后不退。旧示范器保持0储能、琥珀滤片与原条件版本2。', activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, room: originals.room, mara: { ...originals.mara, present: l.maraPresent }, papers: originals.papers, device: originals.device, irena: structuredClone(l.irena), rig: structuredClone(l.rig), pending: structuredClone(l.pending), currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '普通核对和必要归还有效；能力不会判断罪责、自动移动物体或恢复旧储能。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限帮助已通过后续独立实际行动应用；原物仍须真实归还。' : '普通完成，保留原施术与独立行动的真实失败或失效，没有能力掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }), ledger: structuredClone(l.journal), actions };
}
