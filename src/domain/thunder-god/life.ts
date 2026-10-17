import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { validateCatastropheSiteState } from '../catastrophe/resources.js';
import type { ThunderGodOriginals } from './types.js';
export type { ThunderGodOriginals } from './types.js';

/** A bounded fictional practice. The original cove remains authoritative;
 * this journal audits its actual walks, keeper effort and elapsed time only. */
export const THUNDER_GOD_CASE_IDS = ['located-target', 'personal-impact', 'obscured-return'] as const;
export type ThunderGodCaseId = typeof THUNDER_GOD_CASE_IDS[number];
export type ThunderGodConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type ThunderGodWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'CHECK_FAILED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
const STEPS = ['BUY_TARGET', 'BUY_PAD', 'WALK_TO_SITE', 'READ_SOURCE', 'AGREE_RETURN', 'ENTER_SITE', 'PLACE_TARGET', 'STEP_BACK', 'CLEAR_ADULTS', 'OBSERVE_TARGET', 'GUIDED_THUNDER', 'DISCHARGE_TARGET', 'MANUAL_INSPECT', 'WEAR_PAD', 'REGISTER_IMPACT', 'STORM_BRACE', 'RELEASE_IMPACT', 'HAND_RESET', 'CHANGE_CONDITIONS', 'STOP_PULSE', 'CLEAR_HOOD', 'RETRIEVE_TARGET', 'RETURN_PAD', 'WAIT_WINDOW', 'EXIT_SITE', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type ThunderGodActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: ThunderGodCaseId }
  | { type: 'INVITE'; caseId: ThunderGodCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'OWNER' | 'TECHNICIAN' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface ThunderGodAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: ThunderGodWindow; remainingSeconds: number; conditionVersion: number | null;
}
export interface ThunderGodAttempt {
  week: number; method: Method; closed: boolean; result: Result; elapsedSeconds: number;
  playerTravelMetres: number; keeperTravelMetres: number; finnTravelMetres: number; keeperEnergySpent: number; spiritualitySpent: number; mindSpent: number;
  permission: { owner: ThunderGodConsent; technician: ThunderGodConsent; ability: ThunderGodConsent }; permissionVersion: number;
  sourceRead: boolean; returnAgreed: boolean; entered: boolean; exited: boolean; adultsCleared: boolean;
  targetPlaced: boolean; targetRetrieved: boolean; observedTargetVersion: number | null; dischargeAttempted: boolean; dischargeTier: PublicResolutionTier | null; targetHit: boolean; manuallyInspected: boolean;
  padWorn: boolean; padReturned: boolean; impactRegistered: boolean; impactReleased: boolean; healthLost: number; healthPrevented: number; handReset: boolean;
  conditionChanged: boolean; pulseStopped: boolean; hoodCleared: boolean; guided: ThunderGodAbilityUse; guard: ThunderGodAbilityUse;
}
export interface ThunderGodLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: Result; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: ThunderGodAttempt[];
}
export interface ThunderGodLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface ThunderGodLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: ThunderGodActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: ThunderGodLifeBudget; after: ThunderGodLifeBudget;
  elapsedSeconds: number; playerWalkedMetres: number; keeperWalkedMetres: number; finnWalkedMetres: number; keeperEnergySpent: number;
  originalsBefore: ThunderGodOriginals; originalsAfter: ThunderGodOriginals;
  source: { caseId: ThunderGodCaseId; siteId: 'CT2-COVE'; atSeconds: number; conditionVersion: number; permissionVersion: number;
    playerPosition: ThunderGodLifeState['playerLocation']; targetId: string; targetPositionMetres: number; distanceMetres: number;
    keeperPosition: ThunderGodOriginals['keeper']['position']; finnPosition: ThunderGodLifeState['finn']['location']; line: 'CLEAR' | 'OBSCURED';
    bonus: 0 | 10; effectType: 'TARGET' | 'BODY'; rawHealthLoss: 0 | 5; preventedHealthLoss: 0 | 5 } | null;
  objectTransitions: ('PLACE' | 'OBSERVE' | 'TARGET_HIT' | 'TARGET_MISS' | 'MANUAL_INSPECT' | 'WEAR' | 'REGISTER' | 'IMPACT' | 'HAND_RESET' | 'CLOSE_HOOD' | 'STOP' | 'CLEAR_HOOD' | 'RETRIEVE_TARGET' | 'RETURN_PAD')[];
}
export interface ThunderGodLifeState {
  sourceWeek: number | null; activeCase: ThunderGodCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: 'OUTSIDE' | 'EXIT' | 'CONTROL' | 'TARGET'; playerTravelMetres: number; keeperPresent: boolean; keeperReturnPosition: 'CONTROL' | 'EXIT';
  finn: { id: 'TG1-FINN-COLE'; name: '芬恩·科尔'; age: 44; alive: true; health: 100; mind: 100; present: boolean; location: 'AWAY' | 'EXIT' | 'CONTROL' | 'TARGET'; travelMetres: number };
  target: { id: 'TG1-TARGET-1'; owner: 'TG1-FINN-COLE' | 'PLAYER'; price: 40; purchasedWeek: number | null; location: 'SUPPLIER' | 'PLAYER' | 'HOLDER'; durability: number; marks: number; conditionVersion: number; positionMetres: 12;
    holderId: 'TG1-HOLDER-1'; holderOwner: 'TG1-FINN-COLE'; hoodId: 'TG1-HOOD-1'; hoodOwner: 'TG1-FINN-COLE'; hood: 'OPEN' | 'CLOSED'; line: 'CLEAR' | 'OBSCURED'; pulse: 'IDLE' | 'ARMED' | 'STOPPED' | 'SPENT' };
  pad: { id: 'TG1-PAD-1'; owner: 'TG1-FINN-COLE' | 'PLAYER'; price: 20; purchasedWeek: number | null; location: 'SUPPLIER' | 'PLAYER' | 'WORN'; durability: number; registered: boolean; impacts: number; manualResets: number; conditionVersion: number };
  pending: { kind: 'GUIDED' | 'GUARD'; caseId: ThunderGodCaseId; createdAt: number; expiresAt: number; conditionVersion: number; permissionVersion: number; targetId: string; bonus: 0 | 10 } | null;
  cases: Record<ThunderGodCaseId, ThunderGodLifeCase>; journal: ThunderGodLifeReceipt[];
}
export interface ThunderGodLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ThunderGodActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface ThunderGodLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: ThunderGodCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: ThunderGodLifeState['playerLocation']; playerTravelMetres: number;
  site: ThunderGodOriginals; keeperPresent: boolean; finn: ThunderGodLifeState['finn']; target: ThunderGodLifeState['target']; pad: ThunderGodLifeState['pad']; pending: ThunderGodLifeState['pending']; currentAttempt: ThunderGodAttempt | null;
  cases: { id: ThunderGodCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: ThunderGodAttempt[] }[];
  ledger: ThunderGodLifeReceipt[]; actions: ThunderGodLifeAction[];
}
const GUIDED = 'tyrant.s1.guided-thunder', GUARD = 'tyrant.s1.storm-brace';
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 1;
const budget = (s: SliceState): ThunderGodLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is ThunderGodLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): ThunderGodAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null });
const freshCase = (): ThunderGodLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method): ThunderGodAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, keeperTravelMetres: 0, finnTravelMetres: 0, keeperEnergySpent: 0, spiritualitySpent: 0, mindSpent: 0,
    permission: { owner: 'UNASKED', technician: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0,
    sourceRead: false, returnAgreed: false, entered: false, exited: false, adultsCleared: false,
    targetPlaced: false, targetRetrieved: false, observedTargetVersion: null, dischargeAttempted: false, dischargeTier: null, targetHit: false, manuallyInspected: false,
    padWorn: false, padReturned: false, impactRegistered: false, impactReleased: false, healthLost: 0, healthPrevented: 0, handReset: false,
    conditionChanged: false, pulseStopped: false, hoodCleared: false, guided: freshUse(), guard: freshUse() };
}
export function createThunderGodLifeState(): ThunderGodLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE', playerTravelMetres: 0, keeperPresent: false, keeperReturnPosition: 'CONTROL',
    finn: { id: 'TG1-FINN-COLE', name: '芬恩·科尔', age: 44, alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 0 },
    target: { id: 'TG1-TARGET-1', owner: 'TG1-FINN-COLE', price: 40, purchasedWeek: null, location: 'SUPPLIER', durability: 100, marks: 0, conditionVersion: 1, positionMetres: 12, holderId: 'TG1-HOLDER-1', holderOwner: 'TG1-FINN-COLE', hoodId: 'TG1-HOOD-1', hoodOwner: 'TG1-FINN-COLE', hood: 'OPEN', line: 'CLEAR', pulse: 'IDLE' },
    pad: { id: 'TG1-PAD-1', owner: 'TG1-FINN-COLE', price: 20, purchasedWeek: null, location: 'SUPPLIER', durability: 100, registered: false, impacts: 0, manualResets: 0, conditionVersion: 1 },
    pending: null, cases: { 'located-target': freshCase(), 'personal-impact': freshCase(), 'obscured-return': freshCase() }, journal: [] };
}
export const thunderGodOriginalSnapshot = (s: SliceState): ThunderGodOriginals => structuredClone(s.catastrophe.life.site);
/** Capability/shape guard only. Frozen history and source digests separately
 * prove provenance; no particular test route's wear, clock or energy is pinned. */
export function isThunderGodReusableSite(o: unknown): o is ThunderGodOriginals {
  return validateCatastropheSiteState(o) && o.playerPosition === 'EXIT';
}
const validSource = isThunderGodReusableSite;
function freshLife(week: number, originals: ThunderGodOriginals): ThunderGodLifeState { const l = createThunderGodLifeState(); l.sourceWeek = week; l.clockSeconds = originals.clockSeconds; l.keeperReturnPosition = originals.keeper.position; return l; }
export function initializeThunderGodLifeState(s: SliceState): void {
  const source = s.thunderGod.sourceScene?.originals;
  if (!active(s) || !source || !validSource(source) || !same(s.thunderGod.life, createThunderGodLifeState()) || !same(thunderGodOriginalSnapshot(s), source)) throw new Error('须保留原诺拉、同一小湾、原水与原物的真实状态，才可开始本次现场。');
  s.thunderGod.life = freshLife(s.week, source);
}
export function validateThunderGodActivityCommand(v: unknown): v is ThunderGodActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && THUNDER_GOD_CASE_IDS.includes(v.caseId as ThunderGodCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && THUNDER_GOD_CASE_IDS.includes(v.caseId as ThunderGodCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'TECHNICIAN', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isThunderGodActivityCommand = validateThunderGodActivityCommand;
const current = (l: ThunderGodLifeState): ThunderGodAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: ThunderGodLifeState) => l.activeCase !== null || l.playerLocation !== 'OUTSIDE' || l.keeperPresent || l.finn.present || l.pending !== null || l.target.location === 'HOLDER' || l.target.pulse === 'ARMED' || l.target.hood !== 'OPEN' || l.pad.location === 'WORN' || l.pad.registered;
export const hasThunderGodLifeLock = (s: SliceState): boolean => !!s.thunderGod?.life && locked(s.thunderGod.life);
interface Model { life: ThunderGodLifeState; originals: ThunderGodOriginals }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: ThunderGodActivityCommand) => c.type === 'GUIDED_THUNDER' || c.type === 'STORM_BRACE';
const isCheck = (c: ThunderGodActivityCommand) => isPower(c) || c.type === 'DISCHARGE_TARGET';
const position = (p: ThunderGodLifeState['playerLocation'] | ThunderGodLifeState['finn']['location']) => p === 'TARGET' ? 12 : p === 'CONTROL' ? 6 : 0;
const adultsClear = (m: Model) => m.originals.keeper.position === 'EXIT' && m.life.finn.location === 'EXIT';
function validPending(m: Model, kind: 'GUIDED' | 'GUARD'): boolean {
  const l = m.life, a = current(l), p = l.pending;
  return !!p && !!a && p.kind === kind && p.caseId === l.activeCase && l.clockSeconds + 2 <= p.expiresAt && p.permissionVersion === a.permissionVersion &&
    a.permission.owner === 'GRANTED' && a.permission.technician === 'GRANTED' && a.permission.ability === 'GRANTED' && adultsClear(m) && !a.conditionChanged &&
    (kind === 'GUIDED' ? p.targetId === l.target.id && p.conditionVersion === l.target.conditionVersion && a.observedTargetVersion === l.target.conditionVersion && l.target.location === 'HOLDER' && l.target.pulse === 'ARMED' && l.target.line === 'CLEAR' && l.target.hood === 'OPEN' && l.playerLocation === 'CONTROL' :
      p.targetId === l.pad.id && p.conditionVersion === l.pad.conditionVersion && l.pad.location === 'WORN' && l.pad.registered && l.playerLocation === 'TARGET');
}
function checkSpec(m: Model, c: ThunderGodActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  return { ability: c.type === 'GUIDED_THUNDER' ? 'perception' : 'will', difficulty: 18,
    modifiers: c.type === 'DISCHARGE_TARGET' && validPending(m, 'GUIDED') ? [{ source: '同一已定位原靶的有限雷势引导', value: 10 }] : [] };
}
function audit(s: SliceState, c: ThunderGodActivityCommand): Audit {
  const checked = isCheck(c);
  return { date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null, randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[c.type === 'GUIDED_THUNDER' ? 'perception' : 'will'] : null, check: null };
}
function transition(input: Model, c: ThunderGodActivityCommand, week: number, outcome: PublicResolutionTier | null, before: ThunderGodLifeBudget, clock: Audit): { model: Model; receipt: ThunderGodLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  let a = current(l);
  const bodily = c.type === 'STORM_BRACE' || c.type === 'RELEASE_IMPACT';
  const receipt: ThunderGodLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, keeperWalkedMetres: 0, finnWalkedMetres: 0, keeperEnergySpent: 0,
    originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: (isCheck(c) || c.type === 'RELEASE_IMPACT') && a && id ? { caseId: id, siteId: o.id, atSeconds: l.clockSeconds, conditionVersion: bodily ? l.pad.conditionVersion : l.target.conditionVersion, permissionVersion: a.permissionVersion,
      playerPosition: l.playerLocation, targetId: bodily ? l.pad.id : l.target.id, targetPositionMetres: bodily ? position(l.playerLocation) : l.target.positionMetres, distanceMetres: bodily ? 0 : Math.abs(position(l.playerLocation) - l.target.positionMetres), keeperPosition: o.keeper.position, finnPosition: l.finn.location, line: l.target.line,
      bonus: c.type === 'DISCHARGE_TARGET' && validPending(m, 'GUIDED') ? 10 : 0, effectType: bodily ? 'BODY' : 'TARGET', rawHealthLoss: c.type === 'RELEASE_IMPACT' ? 5 : 0, preventedHealthLoss: c.type === 'RELEASE_IMPACT' && validPending(m, 'GUARD') ? 5 : 0 } : null, objectTransitions: [] };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const end = (state: ThunderGodWindow) => { if (l.pending && a) { const use = l.pending.kind === 'GUIDED' ? a.guided : a.guard; use.state = state; use.remainingSeconds = 0; l.pending = null; } };
  const move = (to: ThunderGodLifeState['playerLocation']) => {
    const metres = Math.abs(position(l.playerLocation) - position(to)); receipt.playerWalkedMetres += metres; receipt.elapsedSeconds += metres; l.playerLocation = to;
    o.playerTravelMetres += metres; o.playerPosition = to === 'TARGET' ? 'PLATFORM' : to === 'CONTROL' ? 'CONTROL' : 'EXIT';
  };
  const moveFinn = (to: ThunderGodLifeState['finn']['location']) => { const metres = Math.abs(position(l.finn.location) - position(to)); receipt.finnWalkedMetres += metres; receipt.elapsedSeconds += metres; l.finn.location = to; };
  const moveKeeper = (to: 'CONTROL' | 'EXIT') => { if (o.keeper.position !== to) { o.keeper.position = to; o.keeper.travelMetres += 6; receipt.keeperWalkedMetres += 6; receipt.elapsedSeconds += 6; } };
  const stop = () => { end('STOPPED'); if (l.target.pulse === 'ARMED' || l.pad.registered) { l.target.pulse = l.target.pulse === 'ARMED' ? 'STOPPED' : l.target.pulse; l.pad.registered = false; a!.pulseStopped = true; receipt.objectTransitions.push('STOP'); receipt.elapsedSeconds++; } };
  const clearHood = () => { if (l.target.hood === 'CLOSED') { move('TARGET'); l.target.hood = 'OPEN'; l.target.line = 'CLEAR'; l.target.conditionVersion++; a!.hoodCleared = true; receipt.objectTransitions.push('CLEAR_HOOD'); receipt.elapsedSeconds++; } };
  const retrieveTarget = () => { if (l.target.location === 'HOLDER') { move('TARGET'); l.target.location = 'PLAYER'; l.target.conditionVersion++; a!.targetRetrieved = true; receipt.objectTransitions.push('RETRIEVE_TARGET'); receipt.elapsedSeconds += 2; } };
  const returnPad = () => { if (l.pad.location === 'WORN') { l.pad.location = 'PLAYER'; l.pad.conditionVersion++; a!.padReturned = true; receipt.objectTransitions.push('RETURN_PAD'); receipt.elapsedSeconds += 2; } };
  const safeObjects = () => l.target.location === 'PLAYER' && l.target.pulse !== 'ARMED' && l.target.hood === 'OPEN' && l.pad.location === 'PLAYER' && !l.pad.registered && !l.pending;
  const withdrawalResult = () => id === 'obscured-return' && a!.conditionChanged && a!.permission.owner === 'WITHDRAWN' && a!.pulseStopped && a!.hoodCleared && a!.targetRetrieved;
  const leave = () => { moveFinn('AWAY'); l.finn.present = false; l.keeperPresent = false; move('OUTSIDE'); l.activeCase = null; r!.contactOpen = false; r!.returned = true; a!.closed = true; for (const key of ['owner', 'technician', 'ability'] as const) a!.permission[key] = 'CLOSED'; };
  const physical = !!a && !!r && r.status === 'ACTIVE' && a.week === week && l.finn.present && l.keeperPresent;
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  const inside = physical && a!.entered && !a!.exited && ['CONTROL', 'TARGET'].includes(l.playerLocation);
  const permitted = inside && a!.permission.owner === 'GRANTED' && a!.permission.technician === 'GRANTED';
  const targetReady = permitted && adultsClear(m) && l.playerLocation === 'CONTROL' && l.target.location === 'HOLDER' && l.target.pulse === 'ARMED' && l.target.hood === 'OPEN' && l.target.line === 'CLEAR' && a!.observedTargetVersion === l.target.conditionVersion && !a!.conditionChanged;
  switch (c.type) {
    case 'OBSERVE': {
      const index = THUNDER_GOD_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[THUNDER_GOD_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'BUY_TARGET': case 'BUY_PAD': {
      const object = c.type === 'BUY_TARGET' ? l.target : l.pad;
      if (locked(l) || object.purchasedWeek !== null || object.location !== 'SUPPLIER' || l.cases['located-target'].status === 'AVAILABLE') return null;
      pay(1, object.price); object.owner = 'PLAYER'; object.purchasedWeek = week; object.location = 'PLAYER'; receipt.elapsedSeconds = 2; break;
    }
    case 'WALK_TO_SITE':
      // The inherited player already stands at this very EXIT. Opening contact
      // does not invent a second exterior route or silently add travel.
      if (locked(l) || !safeObjects() || !Object.values(l.cases).some(x => x.status === 'OBSERVED' || x.status === 'PAUSED')) return null;
      move('EXIT'); break;
    case 'INVITE':
      if (l.activeCase || l.playerLocation !== 'EXIT' || l.finn.present || l.keeperPresent || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!) || !safeObjects()) return null;
      pay(1, 10); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method)); a = r!.attempts.at(-1)!;
      l.activeCase = c.caseId; l.keeperPresent = true; l.finn.present = true; l.finn.location = 'EXIT'; receipt.elapsedSeconds = 2; break;
    case 'READ_SOURCE':
      if (!physical || a!.sourceRead || a!.entered) return null;
      a!.sourceRead = true; receipt.elapsedSeconds = 2; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'TECHNICIAN' ? 'technician' : 'ability';
      if (!physical || !a!.sourceRead || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (c.type !== 'CONSENT') end('INVALIDATED'); receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 2; break;
    }
    case 'AGREE_RETURN':
      if (!physical || a!.returnAgreed || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED' || a!.permission.ability === 'UNASKED' || o.keeper.energy < 1) return null;
      a!.returnAgreed = true; o.keeper.energy--; a!.keeperEnergySpent++; receipt.keeperEnergySpent++; receipt.elapsedSeconds = 2; break;
    case 'ENTER_SITE':
      if (!physical || a!.entered || !a!.returnAgreed || l.playerLocation !== 'EXIT' || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED') return null;
      move('CONTROL'); moveFinn('CONTROL'); a!.entered = true; break;
    case 'PLACE_TARGET':
      if (!permitted || id === 'personal-impact' || a!.targetPlaced || l.target.location !== 'PLAYER' || l.target.durability < 5 || l.target.hood !== 'OPEN') return null;
      move('TARGET'); l.target.location = 'HOLDER'; l.target.conditionVersion++; a!.targetPlaced = true; receipt.objectTransitions.push('PLACE'); receipt.elapsedSeconds += 2; break;
    case 'STEP_BACK':
      if (!inside || l.playerLocation !== 'TARGET' || l.target.location !== 'HOLDER' || l.pending) return null;
      move('CONTROL'); break;
    case 'CLEAR_ADULTS':
      if (!permitted || a!.adultsCleared || l.finn.location !== 'CONTROL') return null;
      moveKeeper('EXIT'); moveFinn('EXIT'); a!.adultsCleared = true; break;
    case 'OBSERVE_TARGET':
      if (!permitted || id === 'personal-impact' || !adultsClear(m) || l.playerLocation !== 'CONTROL' || l.target.location !== 'HOLDER' || l.target.hood !== 'OPEN' || a!.observedTargetVersion !== null || a!.conditionChanged) return null;
      a!.observedTargetVersion = l.target.conditionVersion; l.target.pulse = 'ARMED'; receipt.objectTransitions.push('OBSERVE'); receipt.elapsedSeconds = 2; break;
    case 'WEAR_PAD':
      if (!permitted || id !== 'personal-impact' || a!.padWorn || l.pad.location !== 'PLAYER' || l.pad.durability < 10) return null;
      move('TARGET'); l.pad.location = 'WORN'; l.pad.conditionVersion++; a!.padWorn = true; receipt.objectTransitions.push('WEAR'); receipt.elapsedSeconds += 2; break;
    case 'REGISTER_IMPACT':
      if (!permitted || id !== 'personal-impact' || !adultsClear(m) || l.playerLocation !== 'TARGET' || l.pad.location !== 'WORN' || a!.impactRegistered) return null;
      a!.impactRegistered = true; l.pad.registered = true; l.pad.conditionVersion++; receipt.objectTransitions.push('REGISTER'); receipt.elapsedSeconds = 2; break;
    case 'GUIDED_THUNDER': case 'STORM_BRACE': {
      const guided = c.type === 'GUIDED_THUNDER', key = guided ? 'guided' : 'guard';
      if (!permitted || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || l.pending || r!.attempts.some(x => x[key].attempts > 0)) return null;
      if (guided ? !targetReady || id === 'personal-impact' || a!.dischargeAttempted : id !== 'personal-impact' || !adultsClear(m) || l.playerLocation !== 'TARGET' || l.pad.location !== 'WORN' || !l.pad.registered || a!.impactReleased || a!.handReset) return null;
      pay(0, 0, guided ? 8 : 6, 2); receipt.elapsedSeconds = 2; a!.spiritualitySpent += guided ? 8 : 6; a!.mindSpent += 2;
      const use = a![key], version = guided ? l.target.conditionVersion : l.pad.conditionVersion;
      use.attempts = 1; use.successes = success(outcome) ? 1 : 0; use.tier = outcome; use.state = success(outcome) ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = success(outcome) ? 30 : 0; use.conditionVersion = version;
      if (success(outcome)) l.pending = { kind: guided ? 'GUIDED' : 'GUARD', caseId: id!, createdAt: l.clockSeconds + 2, expiresAt: l.clockSeconds + 32, conditionVersion: version, permissionVersion: a!.permissionVersion, targetId: guided ? l.target.id : l.pad.id, bonus: guided ? 10 : 0 };
      break;
    }
    case 'DISCHARGE_TARGET': {
      if (!targetReady || id !== 'located-target' || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || r!.attempts.some(x => x.dischargeAttempted) || l.target.durability < 5) return null;
      const helped = validPending(m, 'GUIDED'); a!.dischargeAttempted = true; a!.dischargeTier = outcome; a!.targetHit = success(outcome); l.target.pulse = 'SPENT'; receipt.elapsedSeconds = 2;
      if (success(outcome)) { l.target.durability -= 5; l.target.marks++; a!.result = helped ? 'ABILITY' : 'ORDINARY'; receipt.objectTransitions.push('TARGET_HIT'); }
      else receipt.objectTransitions.push('TARGET_MISS');
      if (helped && success(outcome)) { a!.guided.effects = 1; end('APPLIED'); } else end(helped ? 'CHECK_FAILED' : 'EXPIRED'); break;
    }
    case 'MANUAL_INSPECT':
      if (!permitted || id !== 'located-target' || l.target.location !== 'HOLDER' || l.target.hood !== 'OPEN' || a!.observedTargetVersion === null || a!.targetHit || a!.manuallyInspected) return null;
      stop(); move('TARGET'); a!.manuallyInspected = true; a!.result = 'ORDINARY'; receipt.objectTransitions.push('MANUAL_INSPECT'); receipt.elapsedSeconds += 4; break;
    case 'RELEASE_IMPACT': {
      if (!permitted || id !== 'personal-impact' || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || !adultsClear(m) || l.playerLocation !== 'TARGET' || l.pad.location !== 'WORN' || !l.pad.registered || r!.attempts.some(x => x.impactReleased || x.handReset) || l.pad.durability < 10) return null;
      const helped = validPending(m, 'GUARD'); l.pad.durability -= 10; l.pad.impacts++; l.pad.registered = false; a!.impactReleased = true; a!.healthLost = helped ? 0 : 5; a!.healthPrevented = helped ? 5 : 0; receipt.after.health -= a!.healthLost; receipt.elapsedSeconds = 2; receipt.objectTransitions.push('IMPACT'); a!.result = helped ? 'ABILITY' : 'ORDINARY';
      if (helped) { a!.guard.effects = 1; end('APPLIED'); } else end('EXPIRED'); break;
    }
    case 'HAND_RESET':
      if (!inside || id !== 'personal-impact' || l.playerLocation !== 'TARGET' || l.pad.location !== 'WORN' || !l.pad.registered || r!.attempts.some(x => x.impactReleased || x.handReset) || l.pad.durability < 10) return null;
      end('STOPPED'); l.pad.durability -= 10; l.pad.manualResets++; l.pad.registered = false; a!.handReset = true; a!.result = 'ORDINARY'; receipt.objectTransitions.push('HAND_RESET'); receipt.elapsedSeconds = 3; break;
    case 'CHANGE_CONDITIONS':
      if (!targetReady || id !== 'obscured-return' || a!.conditionChanged || a!.method === 'ABILITY' && a!.permission.ability === 'GRANTED' && !a!.guided.attempts) return null;
      end('INVALIDATED'); moveFinn('TARGET'); l.target.hood = 'CLOSED'; l.target.line = 'OBSCURED'; l.target.conditionVersion++; a!.conditionChanged = true; receipt.objectTransitions.push('CLOSE_HOOD'); receipt.elapsedSeconds++; moveFinn('EXIT'); break;
    case 'STOP_PULSE':
      if (!physical || !l.pending && l.target.pulse !== 'ARMED' && !l.pad.registered) return null;
      stop(); break;
    case 'CLEAR_HOOD':
      if (!inside || l.target.hood !== 'CLOSED' || l.target.pulse === 'ARMED' || l.pending) return null;
      clearHood(); break;
    case 'RETRIEVE_TARGET':
      if (!inside || l.target.location !== 'HOLDER' || l.target.pulse === 'ARMED' || l.target.hood !== 'OPEN' || l.pending) return null;
      retrieveTarget(); break;
    case 'RETURN_PAD':
      if (!inside || l.pad.location !== 'WORN' || l.pad.registered || l.pending) return null;
      returnPad(); break;
    case 'WAIT_WINDOW':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); end('EXPIRED'); break;
    case 'EXIT_SITE':
      if (!inside || !safeObjects()) return null;
      move('EXIT'); moveFinn('EXIT'); moveKeeper(l.keeperReturnPosition); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || l.playerLocation !== 'EXIT' || o.keeper.position !== l.keeperReturnPosition || !safeObjects()) return null;
      if (withdrawalResult() || a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED') a!.result = 'ORDINARY';
      if (a!.result === 'NONE') return null;
      r!.result = a!.result; r!.status = 'EXAMINED'; leave(); break;
    case 'ABORT':
      // Atomic public cleanup records each real return and metre. No refund,
      // AP debit, replacement object or automatic health recovery is hidden.
      if (!physical) { if (l.playerLocation !== 'EXIT' || l.activeCase || l.finn.present || l.keeperPresent) return null; move('OUTSIDE'); break; }
      stop();
      if (inside) { clearHood(); retrieveTarget(); returnPad(); move('EXIT'); moveFinn('EXIT'); moveKeeper(l.keeperReturnPosition); a!.exited = true; }
      if (withdrawalResult() || a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED') a!.result = 'ORDINARY';
      r!.result = a!.result; r!.status = a!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; leave(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !safeObjects() || o.keeper.position !== l.keeperReturnPosition || o.playerPosition !== 'EXIT') return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !THUNDER_GOD_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 5; break;
  }
  if (!validBudget(receipt.after)) return null;
  l.clockSeconds += receipt.elapsedSeconds; l.elapsedSeconds += receipt.elapsedSeconds; o.clockSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.finn.travelMetres += receipt.finnWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.keeperTravelMetres += receipt.keeperWalkedMetres; a.finnTravelMetres += receipt.finnWalkedMetres; }
  if (l.pending && a) { const use = l.pending.kind === 'GUIDED' ? a.guided : a.guard; use.remainingSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); if (use.remainingSeconds === 0) end('EXPIRED'); }
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: ThunderGodLifeState, s: SliceState): Model | null {
  const source = s.thunderGod.sourceScene?.originals;
  if (!source || !validSource(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 500) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: ThunderGodLifeReceipt | null = null, lastWeek = l.sourceWeek, lastRandomAfter = s.thunderGod.sourceScene!.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'elapsedSeconds', 'playerWalkedMetres', 'keeperWalkedMetres', 'finnWalkedMetres', 'keeperEnergySpent', 'originalsBefore', 'originalsAfter', 'source', 'objectTransitions']) || !validateThunderGodActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.thunderGod.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
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
export function thunderGodExpectedOriginals(s: SliceState): ThunderGodOriginals | null {
  const l = s.thunderGod.life;
  if (l.sourceWeek === null) return s.thunderGod.sourceScene ? structuredClone(s.thunderGod.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function thunderGodLifeMasteryGains(s: SliceState): Record<typeof GUIDED | typeof GUARD, number> {
  const result = { [GUIDED]: 0, [GUARD]: 0 };
  for (const id of THUNDER_GOD_CASE_IDS) {
    const r = s.thunderGod.life.cases[id]; if (r.status !== 'RESOLVED' || id === 'obscured-return') continue;
    if (r.attempts.some(a => a.guided.effects === 1)) result[GUIDED] += 8;
    if (r.attempts.some(a => a.guard.effects === 1)) result[GUARD] += 8;
  }
  return result;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.catastrophe.life.activeCase !== null || Object.values(s.catastrophe.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.catastrophe.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.catastrophe.encounter.status) || s.seaKing.life.activeCase !== null || s.seaKing.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.seaKing.encounter.status);
}
export function validateThunderGodLifeState(s: SliceState): boolean {
  try {
    const l = s.thunderGod?.life;
    if (!record(l) || !shape(l, Object.keys(createThunderGodLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, THUNDER_GOD_CASE_IDS)) return false;
    if (s.thunderGod.promotionWeek === null) return same(l, createThunderGodLifeState());
    const source = s.thunderGod.sourceScene?.originals, history = s.thunderGod.sourceHistory?.catastrophe.life;
    if (!source || !history || !validSource(source) || !same(source, history.site) || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.thunderGod.promotionWeek) return false;
    const { site: _liveSite, ...liveHistory } = s.catastrophe.life, { site: _oldSite, ...oldHistory } = history;
    if (!same(liveHistory, oldHistory)) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(thunderGodOriginalSnapshot(s), replay.originals)) return false;
    const gains = thunderGodLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of THUNDER_GOD_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `thunder-god-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'thunder-god-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[GUIDED] ?? 0) < gains[GUIDED] || (s.progression.mastery[GUARD] ?? 0) < gains[GUARD]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.thunderGod.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.thunderGod.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.after.actions > 0 && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    return true;
  } catch { return false; }
}
export const validateThunderGodLife = validateThunderGodLifeState;
export function blockThunderGodLife(s: SliceState, c: ThunderGodActivityCommand): string | null {
  if (!validateThunderGodActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为雷神。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.thunderGod.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.thunderGod.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateThunderGodLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.thunderGod.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成实际步骤，并核对当前许可、位置、现金与行动。本人冲击耗护垫10耐久、无有效护持时耗5健康；可选普通手柄。停止、还物和退出不耗行动。';
  return null;
}
export const blockThunderGodActivity = blockThunderGodLife;
/** Update only permitted mutable fields in the same original site objects. */
function writeOriginals(s: SliceState, o: ThunderGodOriginals): void {
  const live = s.catastrophe.life.site; live.clockSeconds = o.clockSeconds; live.playerPosition = o.playerPosition; live.playerTravelMetres = o.playerTravelMetres;
  live.keeper.position = o.keeper.position; live.keeper.travelMetres = o.keeper.travelMetres; live.keeper.energy = o.keeper.energy;
}
export function applyThunderGodLifeCommand(s: SliceState, c: ThunderGodActivityCommand, ctx: SeerContext): void {
  const reason = blockThunderGodLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.thunderGod.life, s)!, before = budget(s), clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock)!;
  const l = next.model.life; l.journal.push(next.receipt); s.thunderGod.life = l; writeOriginals(s, next.model.originals);
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`thunder-god-case:${c.caseId}`);
    if (c.caseId !== 'obscured-return') for (const [ability, key] of [[GUIDED, 'guided'], [GUARD, 'guard']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('thunder-god-reflection'); }
  const checked = check ? `本次${success(check.tier) ? '成功' : '失败'}；实际检定与已付代价保留。` : '';
  const label = c.type === 'EXIT_SITE' ? '沿原路退出，让诺拉回到本案原位置' : LABELS[c.type];
  ctx.note(label, `${DETAILS[c.type] ?? label}${checked}本步实耗${next.receipt.elapsedSeconds}秒；同一原水、闸、浮标、系索、绞盘和轮具保持原状态。`);
}
export const applyThunderGodActivity = applyThunderGodLifeCommand;
const CASES = [
  { id: 'located-target', title: '眼前定位的同一原靶', story: '本人把已购买原靶放在小湾12米标位，再退至6米控制点。诺拉和芬恩沿干路走到出口避开靶线。感知18的雷势引导只开30秒窗口；随后另作意志18放出一次虚构雷势，有效窗口加值10，真正命中才留痕并耗靶5耐久。也可步行近前普通检查复位。' },
  { id: 'personal-impact', title: '本人承受的一次小冲击', story: '本人实际穿戴自有护垫，在12米点登记一次小型超自然练习冲击，其他成年人先离开作用线。释放必耗护垫10耐久，无有效护持时本人损失5健康；30秒内有效风雷护持只阻止这一次5健康损失。普通手柄复位同样耗护垫10耐久而不损健康，不增加能力掌握。' },
  { id: 'obscured-return', title: '遮蔽、撤回与普通归还', story: '同一原靶和遮罩。雷势窗口开启后，芬恩亲自走到12米点关闭原罩再退出，条件版本改变使旧窗口立即失效。诺拉撤回当次许可后不能再施术；仍可普通停止、打开原罩、步行取回原靶和沿原路离开。失败或未用成本不退。' },
] as const;
const LABELS: Record<ThunderGodActivityCommand['type'], string> = {
  OBSERVE: '查看本案来源、费用与普通退路', BUY_TARGET: '实付购买唯一原靶', BUY_PAD: '实付购买本人唯一护垫', WALK_TO_SITE: '在原小湾出口开始本次接触', INVITE: '付费邀请芬恩参与本案', READ_SOURCE: '当面核对原小湾与本次用途', CONSENT: '确认这一项当前许可', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可', AGREE_RETURN: '约定普通归还并支付保管员精力', ENTER_SITE: '沿原路走至六米控制点', PLACE_TARGET: '走至十二米处放置同一原靶', STEP_BACK: '实际退至六米控制点', CLEAR_ADULTS: '诺拉和芬恩实际走出作用线', OBSERVE_TARGET: '亲眼定位原靶和清晰靶线', GUIDED_THUNDER: '尝试一次雷势引导', DISCHARGE_TARGET: '独立检定并实际放出虚构雷势', MANUAL_INSPECT: '步行近前普通检查并复位原靶', WEAR_PAD: '走到十二米处实际穿戴原护垫', REGISTER_IMPACT: '登记本人一次小冲击及健康代价', STORM_BRACE: '尝试一次风雷护持', RELEASE_IMPACT: '释放本人冲击：护垫10，无有效护持时健康5', HAND_RESET: '普通手柄安全复位：护垫10，健康0', CHANGE_CONDITIONS: '芬恩走到原靶关闭原罩再退出', STOP_PULSE: '普通停止待发冲击与未用窗口', CLEAR_HOOD: '实际走近并打开同一原罩', RETRIEVE_TARGET: '实际走近取回同一原靶到背包', RETURN_PAD: '脱下同一原护垫放回背包', WAIT_WINDOW: '真实等到当前窗口到期', EXIT_SITE: '沿原路退出并让诺拉回到原控制点', LEAVE: '结束当次接触，芬恩离开', ABORT: '普通停止、取还原物并沿原路离开', REPORT: '如实报告结果与实际归还', REFLECT: '反思范围、条件、代价与许可',
};
const DETAILS: Partial<Record<ThunderGodActivityCommand['type'], string>> = {
  BUY_TARGET: '实付40便士与1行动，获得同一唯一原靶；原靶架及可拆原罩仍归芬恩所有。', BUY_PAD: '实付20便士与1行动，获得同一唯一本人护垫。', INVITE: '实付10便士与1行动邀请44岁的芬恩，本案各项许可重新询问。',
  AGREE_RETURN: '诺拉本案实耗1精力，绝不自动恢复。归还与普通退出始终保留。', GUIDED_THUNDER: '实耗8灵性、2精神，感知18。成功只开30秒同一已定位原靶窗口；后续实际独立放出雷势才可能应用。', STORM_BRACE: '实耗6灵性、2精神，意志18。成功只开30秒本人下一次已登记小冲击护持；不治疗，也不保护旁人或精神效果。',
  DISCHARGE_TARGET: '单独意志18检定，有效原靶窗口加值10。真正命中才使原靶留痕并磨损5耐久，失败保留，不能重抽。', RELEASE_IMPACT: '一次已登记的虚构本人冲击：同一护垫磨损10。没有有效护持则本人真实损失5健康，有效护持只阻止这5点；没有自动治疗。', HAND_RESET: '本人普通操作手柄复位，同一护垫真实磨损10，没有本人健康损失或能力掌握奖励。',
  CHANGE_CONDITIONS: '芬恩本人走到原罩处关闭，再沿同一路线退出；旧观察版本和窗口立即失效。', STOP_PULSE: '只停止当前待发作用，不退还实耗、不修复护垫或原靶。', MANUAL_INSPECT: '先停住待发作用，再实际走到原靶近前，亲手检查复位；不在远处免费完成。', ABORT: '普通停止并取还同一原物、实际沿原路退出；所有健康损失、磨损与费用保留。',
};
const COSTS: Partial<Record<ThunderGodActivityCommand['type'], string>> = {
  OBSERVE: '1行动 · 5秒', BUY_TARGET: '1行动 · 40便士', BUY_PAD: '1行动 · 20便士', INVITE: '1行动 · 每次10便士', WALK_TO_SITE: '0行动 · 原人已在原出口', ENTER_SITE: '0行动 · 本人与芬恩各走6米', PLACE_TARGET: '0行动 · 实走到12米标位再放置', STEP_BACK: '0行动 · 实走6米', CLEAR_ADULTS: '0行动 · 诺拉与芬恩各走6米', AGREE_RETURN: '0行动 · 诺拉1精力 · 2秒', GUIDED_THUNDER: '0行动 · 8灵性＋2精神 · 感知18 · 最长30秒', STORM_BRACE: '0行动 · 6灵性＋2精神 · 意志18 · 最长30秒', DISCHARGE_TARGET: '0行动 · 意志18 · 命中原靶耐久−5 · 2秒', RELEASE_IMPACT: '0行动 · 护垫耐久−10 · 无有效护持本人健康−5 · 2秒', HAND_RESET: '0行动 · 护垫耐久−10 · 本人健康0损失 · 3秒', MANUAL_INSPECT: '0行动 · 近前实际步行＋4秒检查', CHANGE_CONDITIONS: '0行动 · 芬恩实走24米＋1秒关罩', WITHDRAW_CONSENT: '0行动0秒 · 立即失效', STOP_PULSE: '0行动 · 普通停止 · 不退款', EXIT_SITE: '0行动 · 本人沿原路退出，诺拉实走6米返回', LEAVE: '0行动 · 结束当次接触', ABORT: '0行动 · 实际停止、取还原物与步行', REPORT: '1行动 · 扮演25 · 真正应用才掌握8', REFLECT: '1行动 · 扮演25',
};
export function thunderGodLifeActions(s: SliceState): ThunderGodLifeAction[] {
  if (!active(s)) return [];
  const l = s.thunderGod.life, a = current(l), out: ThunderGodLifeAction[] = [];
  const add = (command: ThunderGodActivityCommand, preferred = false, cleanup = false, label?: string) => { const reason = blockThunderGodLife(s, command); out.push({ id: `thunder-god-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label: label ?? (command.type === 'EXIT_SITE' ? '沿原路退出，让诺拉回到本案原位置' : LABELS[command.type]), cost: command.type === 'WAIT_WINDOW' ? `0行动 · 真实等待${Math.max(0, (l.pending?.expiresAt ?? l.clockSeconds) - l.clockSeconds)}秒` : command.type === 'CLEAR_ADULTS' ? `0行动 · 诺拉实走${s.catastrophe.life.site.keeper.position === 'EXIT' ? 0 : 6}米，芬恩实走6米` : command.type === 'EXIT_SITE' ? `0行动 · 本人实走${position(l.playerLocation)}米退出，诺拉实走${s.catastrophe.life.site.keeper.position === l.keeperReturnPosition ? 0 : 6}米返回原位置` : COSTS[command.type] ?? '0行动 · 实际操作与时间', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup }); };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (l.playerLocation === 'EXIT' && next) { const r = l.cases[next.id]; if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, true); add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED', false, '实付10便士邀请芬恩，选择普通做法'); step('ABORT', false, true); return out; }
    if (next) { const r = l.cases[next.id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, true); else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true); else if (l.target.purchasedWeek === null) step('BUY_TARGET'); else if (l.pad.purchasedWeek === null) step('BUY_PAD'); else if (r.status === 'PAUSED' && s.week <= r.invitationWeeks.at(-1)!) add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, false, false, '下周可付费重新邀请，只作普通续办'); else step('WALK_TO_SITE'); }
    else if (!l.reflected) step('REFLECT');
    return out;
  }
  const id = l.activeCase!, resultReady = a.result !== 'NONE' || id === 'obscured-return' && a.conditionChanged && a.permission.owner === 'WITHDRAWN' && a.pulseStopped && a.hoodCleared && a.targetRetrieved;
  const denied = a.permission.owner === 'DECLINED' || a.permission.technician === 'DECLINED', withdrawn = a.permission.owner === 'WITHDRAWN' || a.permission.technician === 'WITHDRAWN';
  if (!a.sourceRead) step('READ_SOURCE');
  else if (denied && !a.entered) step('LEAVE', true, true);
  else if (!a.entered) {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.technician === 'UNASKED' ? 'TECHNICIAN' : a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) { if (permission !== 'ABILITY' || a.method === 'ABILITY') add({ type: 'CONSENT', permission }, true); add({ type: 'DECLINE_CONSENT', permission }, permission === 'ABILITY' && a.method === 'ORDINARY', true); }
    else if (!a.returnAgreed) step('AGREE_RETURN'); else step('ENTER_SITE');
  } else if (resultReady) {
    if (l.target.pulse === 'ARMED' || l.pad.registered || l.pending) step('STOP_PULSE', true, true);
    else if (l.target.hood === 'CLOSED') step('CLEAR_HOOD', true, true);
    else if (l.target.location === 'HOLDER') step('RETRIEVE_TARGET', true, true);
    else if (l.pad.location === 'WORN') step('RETURN_PAD', true, true);
    else if (!a.exited) step('EXIT_SITE', true, true); else step('LEAVE', true, true);
  } else if (id === 'obscured-return' && a.conditionChanged) {
    if (a.permission.owner === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, true, true, '诺拉撤回本案当前许可');
    else if (l.target.pulse === 'ARMED') step('STOP_PULSE', true, true);
    else if (l.target.hood === 'CLOSED') step('CLEAR_HOOD', true, true);
    else if (l.target.location === 'HOLDER') step('RETRIEVE_TARGET', true, true);
    else step('ABORT', true, true);
  } else if (withdrawn) step('ABORT', true, true);
  else if (id === 'personal-impact') {
    if (!a.padWorn) step('WEAR_PAD');
    else if (!a.adultsCleared) step('CLEAR_ADULTS');
    else if (!a.impactRegistered) step('REGISTER_IMPACT');
    else if (!l.pad.registered) step('ABORT', true, true);
    else { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.guard.attempts)) step('STORM_BRACE'); if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED') step('RELEASE_IMPACT', a.guard.state === 'ACTIVE'); step('HAND_RESET', a.method === 'ORDINARY' || a.guard.state === 'FAILED', true); }
  } else if (!a.targetPlaced) step('PLACE_TARGET');
  else if (l.playerLocation === 'TARGET') step('STEP_BACK');
  else if (!a.adultsCleared) step('CLEAR_ADULTS');
  else if (a.observedTargetVersion === null) step('OBSERVE_TARGET');
  else {
    if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.guided.attempts)) step('GUIDED_THUNDER');
    if (id === 'obscured-return') step('CHANGE_CONDITIONS', a.guided.attempts > 0 || a.method === 'ORDINARY');
    else { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.dischargeAttempted)) step('DISCHARGE_TARGET', a.guided.state === 'ACTIVE'); step('MANUAL_INSPECT', a.method === 'ORDINARY' || a.dischargeAttempted, true); }
  }
  if (l.pending) step('WAIT_WINDOW', false, true);
  if (l.pending || l.target.pulse === 'ARMED' || l.pad.registered) { if (!out.some(x => x.command.type === 'STOP_PULSE')) step('STOP_PULSE', false, true); }
  for (const permission of ['OWNER', 'TECHNICIAN', 'ABILITY'] as const) { const key = permission === 'OWNER' ? 'owner' : permission === 'TECHNICIAN' ? 'technician' : 'ability'; if (a.permission[key] === 'GRANTED' && !out.some(x => x.command.type === 'WITHDRAW_CONSENT' && x.command.permission === permission)) add({ type: 'WITHDRAW_CONSENT', permission }, false, true); }
  if (!out.some(x => x.command.type === 'ABORT')) step('ABORT', false, true);
  return out;
}
export function projectThunderGodLife(s: SliceState): ThunderGodLifeProjection {
  const l = s.thunderGod.life, actions = thunderGodLifeActions(s);
  return { title: '原靶、本人护持与普通归还', story: '雷势引导与风雷护持都是有限虚构能力。施用成功只开窗口，真正后续应用才增加掌握；失效、拒绝、健康损失和原物磨损如实保留。三案报告各25扮演，反思25；两项能力分别仅有一次对应实际应用可得8掌握。', source: '同一诺拉45岁、原小湾和20单位原水；原闸、系索、绞盘、轮保持各自真实磨损。另有44岁的独立成年人芬恩、本人实付购得的唯一原靶及护垫。', environment: '原小湾边界12米；原出口0米、控制点6米、原靶位置12米。诺拉和芬恩须实际走到出口避开作用线。每案当前邀请10便士、1行动；原靶40便士、护垫20便士，各1行动。每次约定诺拉耗1精力。释放本人冲击耗护垫10耐久、无有效护持时本人5健康；普通手柄同耗10耐久但健康0损失。没有电气或现实工程施工。', activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, site: thunderGodOriginalSnapshot(s), keeperPresent: l.keeperPresent, finn: structuredClone(l.finn), target: structuredClone(l.target), pad: structuredClone(l.pad), pending: structuredClone(l.pending), currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '当前许可可撤回；普通停止、真实取还原物和沿原路离开始终保留。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限窗口已经通过后续真实作用应用；原物已实取归还。' : '普通完成，保留真实失败、失效和代价，没有能力掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }), ledger: structuredClone(l.journal), actions };
}
