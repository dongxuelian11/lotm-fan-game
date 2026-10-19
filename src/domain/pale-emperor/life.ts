import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { validateDeathConsulSiteState } from '../death-consul/resources.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { paleEmperorEncounterBudget, paleEmperorFinanceSnapshot, paleEmperorCompletedBudgetMatches,
  type PaleEmperorEncounterBudget, type PaleEmperorFinanceSnapshot } from './encounter.js';
import { paleEmperorEraGapMatches } from './index.js';

export const PALE_EMPEROR_CASE_IDS = ['quiet-lid', 'guarded-carry', 'withdrawn-return'] as const;
export type PaleEmperorCaseId = typeof PALE_EMPEROR_CASE_IDS[number];
export type PaleEmperorOriginals = SliceState['deathConsul']['life']['site'];
export type PaleEmperorConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
export type PaleEmperorWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
type Method = 'ABILITY' | 'ORDINARY';
type Bench = 'NEAR' | 'FAR';
const STEPS = ['WALK_TO_ANNEX', 'BUY_SEALS', 'PREPARE_VESSEL', 'OBSERVE_VESSEL', 'RESIDUAL_QUIETING', 'SPIRITUAL_INTERDICTION', 'FIT_LID', 'ORDINARY_FIT', 'CARRY_VESSEL', 'SCREENED_CARRY', 'RESEAL', 'MANUAL_RETURN', 'RETURN_LOAN', 'CLOSE_DOOR', 'OPEN_DOOR', 'DEPLOY_SCREEN', 'STOP', 'WAIT_WINDOW', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type PaleEmperorActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: PaleEmperorCaseId }
  | { type: 'INVITE'; caseId: PaleEmperorCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'CUSTODIAN' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface PaleEmperorAbilityUse { attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null; state: PaleEmperorWindow; remainingSeconds: number }
export interface PaleEmperorAttempt {
  week: number; method: Method; closed: boolean; result: 'NONE' | Method; elapsedSeconds: number;
  playerTravelMetres: number; noraTravelMetres: number; noraEnergySpent: number; vesselTravelMetres: number; spiritualitySpent: number; mindSpent: number;
  permission: { custodian: PaleEmperorConsent; ability: PaleEmperorConsent }; permissionVersion: number;
  prepared: boolean; observedVersion: number | null; lidFitted: boolean; carried: boolean; resealed: boolean; manualReturned: boolean; loanReturned: boolean;
  quieting: PaleEmperorAbilityUse; interdiction: PaleEmperorAbilityUse;
}
export interface PaleEmperorLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: PaleEmperorAttempt[];
}
export interface PaleEmperorAnnex {
  id: 'PE1-ANNEX'; introducedWeek: number; introducedDate: PublicGameDate; lengthMetres: 4; ordinaryRoadMetres: 12; ordinaryExit: 'OPEN';
  vessel: { id: 'PE1-VESSEL-1'; nature: 'NON_SENTIENT_RESIDUAL'; quantity: 1; owner: 'ANNEX'; source: 'ANNEX_ORIGINAL_LOAN';
    /** Holder is responsible custody; the location records the actual bench. */
    holder: 'ANNEX' | 'PLAYER'; location: Bench; agitation: 0 | 2; lid: 'OPEN' | 'CLOSED'; seal: 'NONE' | 'INTACT' | 'BROKEN'; scuffs: number; travelledMetres: number; version: number };
  lid: { id: 'PE1-LID-1'; location: 'VESSEL' | Bench; operations: number; travelledMetres: number };
  screen: { id: 'PE1-SCREEN-1'; state: 'DEPLOYED' | 'RETRACTED'; location: Bench; operations: number; travelledMetres: number };
  door: { id: 'PE1-DOOR-1'; location: 'NEAR'; state: 'OPEN' | 'CLOSED'; operations: number };
  box: { id: 'PE1-BOX-1'; location: Bench; closed: boolean; operations: number; travelledMetres: number };
  loan: { custodianId: 'PE1-NORA'; terms: 'RETURN_SAME_VESSEL_AND_LID'; grantedWeek: number | null; returnedWeek: number | null; grants: number; returns: number };
  seals: { id: string; price: 4; state: 'SUPPLIER' | 'PLAYER' | 'USED'; purchasedWeek: number | null; usedWeek: number | null }[];
}
export interface PaleEmperorNora {
  id: 'PE1-NORA'; name: '诺拉·贝尔'; age: 42; source: 'CONTEMPORARY_ANNEX_CUSTODIAN'; alive: true; health: 100; mind: 100;
  energy: number; present: boolean; location: 'AWAY' | Bench; travelMetres: number;
}
export type PaleEmperorLifeBudget = PaleEmperorEncounterBudget;
export interface PaleEmperorLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: PaleEmperorActivityCommand; randomCursor: number;
  randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: PaleEmperorLifeBudget; after: PaleEmperorLifeBudget; finance: PaleEmperorFinanceSnapshot;
  elapsedSeconds: number; playerWalkedMetres: number; noraWalkedMetres: number; noraEnergySpent: number; vesselCarriedMetres: number;
  siteBefore: PaleEmperorAnnex | null; siteAfter: PaleEmperorAnnex | null;
  source: { vesselId: 'PE1-VESSEL-1'; vesselVersion: number; conditionVersion: number; permissionVersion: number; atSeconds: number; line: [Bench, Bench] | null } | null;
  applications: ('QUIET_LID' | 'BLOCKED_PROPAGATION')[];
}
export interface PaleEmperorLifeState {
  sourceWeek: number | null; activeCase: PaleEmperorCaseId | null; reflected: boolean; clockSeconds: number; elapsedSeconds: number;
  playerLocation: 'RECEPTION' | Bench; playerTravelMetres: number; conditionVersion: number; visits: number;
  site: PaleEmperorAnnex | null; nora: PaleEmperorNora | null;
  pending: { kind: 'QUIETING' | 'INTERDICTION'; caseId: PaleEmperorCaseId; vesselId: 'PE1-VESSEL-1'; vesselVersion: number; conditionVersion: number; permissionVersion: number; createdAt: number; expiresAt: number; line: [Bench, Bench] | null } | null;
  cases: Record<PaleEmperorCaseId, PaleEmperorLifeCase>; journal: PaleEmperorLifeReceipt[];
}
export interface PaleEmperorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PaleEmperorActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface PaleEmperorLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: PaleEmperorCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; conditionVersion: number; playerLocation: PaleEmperorLifeState['playerLocation']; playerTravelMetres: number;
  site: PaleEmperorAnnex | null; originals: PaleEmperorOriginals; nora: PaleEmperorNora | null; pending: PaleEmperorLifeState['pending']; currentAttempt: PaleEmperorAttempt | null;
  cases: { id: PaleEmperorCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: PaleEmperorAttempt[] }[];
  ledger: PaleEmperorPublicLifeReceipt[]; actions: PaleEmperorLifeAction[];
}
const QUIETING = 'death.s1.residual-quieting', INTERDICTION = 'death.s1.spiritual-interdiction';
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 1;
const freshUse = (): PaleEmperorAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0 });
const freshCase = (): PaleEmperorLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method): PaleEmperorAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, noraTravelMetres: 0, noraEnergySpent: 0, vesselTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0,
    permission: { custodian: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0, prepared: false, observedVersion: null, lidFitted: false, carried: false, resealed: false, manualReturned: false, loanReturned: false, quieting: freshUse(), interdiction: freshUse() };
}
export function createPaleEmperorLifeState(): PaleEmperorLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'RECEPTION', playerTravelMetres: 0, conditionVersion: 1, visits: 0, site: null, nora: null, pending: null,
    cases: { 'quiet-lid': freshCase(), 'guarded-carry': freshCase(), 'withdrawn-return': freshCase() }, journal: [] };
}
function introduce(week: number, date: PublicGameDate): PaleEmperorAnnex {
  return { id: 'PE1-ANNEX', introducedWeek: week, introducedDate: structuredClone(date), lengthMetres: 4, ordinaryRoadMetres: 12, ordinaryExit: 'OPEN',
    vessel: { id: 'PE1-VESSEL-1', nature: 'NON_SENTIENT_RESIDUAL', quantity: 1, owner: 'ANNEX', source: 'ANNEX_ORIGINAL_LOAN', holder: 'ANNEX', location: 'NEAR', agitation: 2, lid: 'OPEN', seal: 'NONE', scuffs: 0, travelledMetres: 0, version: 1 },
    lid: { id: 'PE1-LID-1', location: 'NEAR', operations: 0, travelledMetres: 0 }, screen: { id: 'PE1-SCREEN-1', state: 'DEPLOYED', location: 'NEAR', operations: 0, travelledMetres: 0 }, door: { id: 'PE1-DOOR-1', location: 'NEAR', state: 'OPEN', operations: 0 }, box: { id: 'PE1-BOX-1', location: 'NEAR', closed: true, operations: 0, travelledMetres: 0 },
    loan: { custodianId: 'PE1-NORA', terms: 'RETURN_SAME_VESSEL_AND_LID', grantedWeek: null, returnedWeek: null, grants: 0, returns: 0 },
    seals: [1, 2].map(i => ({ id: `PE1-SEAL-${i}`, price: 4, state: 'SUPPLIER', purchasedWeek: null, usedWeek: null })) };
}
const freshNora = (): PaleEmperorNora => ({ id: 'PE1-NORA', name: '诺拉·贝尔', age: 42, source: 'CONTEMPORARY_ANNEX_CUSTODIAN', alive: true, health: 100, mind: 100, energy: 100, present: false, location: 'AWAY', travelMetres: 0 });
export function paleEmperorOriginalSnapshot(s: SliceState): PaleEmperorOriginals { return structuredClone(s.deathConsul.life.site); }
const initialQuiescent = (o: PaleEmperorOriginals) => validateDeathConsulSiteState(o) && o.effect.mode === 'OFF' && o.effect.expiresAt === null;
function freshLife(week: number): PaleEmperorLifeState { const l = createPaleEmperorLifeState(); l.sourceWeek = week; return l; }
export function initializePaleEmperorLifeState(s: SliceState): void {
  const original = s.paleEmperor.sourceScene?.originals;
  if (!active(s) || !original || !initialQuiescent(original) || !same(s.paleEmperor.life, createPaleEmperorLifeState()) || !same(paleEmperorOriginalSnapshot(s), original)) throw new Error('先收束原封存室，再从接待处前往新附室；旧人旧物仍保留在原处。');
  s.paleEmperor.life = freshLife(s.week);
}
export function validatePaleEmperorActivityCommand(v: unknown): v is PaleEmperorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && PALE_EMPEROR_CASE_IDS.includes(v.caseId as PaleEmperorCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && PALE_EMPEROR_CASE_IDS.includes(v.caseId as PaleEmperorCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['CUSTODIAN', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isPaleEmperorActivityCommand = validatePaleEmperorActivityCommand;
export const isPaleEmperorActivity = validatePaleEmperorActivityCommand;
const current = (l: PaleEmperorLifeState): PaleEmperorAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: PaleEmperorLifeState) => l.activeCase !== null || l.playerLocation !== 'RECEPTION' || l.nora?.present === true || l.pending !== null || l.site?.vessel.holder === 'PLAYER';
export const hasPaleEmperorLifeLock = (s: SliceState): boolean => !!s.paleEmperor?.life && locked(s.paleEmperor.life);
export const paleEmperorInside = hasPaleEmperorLifeLock;
/** Input revisions, matching the ordinary-era journal. Full life replay proves
 * these opening/closing commands and their physical cleanup independently. */
export function paleEmperorLifeLockedAtRevision(s: SliceState, revision: number): boolean {
  let inside = false;
  for (const entry of s.paleEmperor.life.journal) { if (entry.revision >= revision) break; if (entry.command.type === 'WALK_TO_ANNEX') inside = true; else if (entry.command.type === 'LEAVE' || entry.command.type === 'ABORT') inside = false; }
  return inside;
}
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; finance: PaleEmperorFinanceSnapshot }
const isCheck = (c: PaleEmperorActivityCommand) => c.type === 'RESIDUAL_QUIETING' || c.type === 'SPIRITUAL_INTERDICTION';
function checkSpec(c: PaleEmperorActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: never[] } { return { ability: c.type === 'SPIRITUAL_INTERDICTION' ? 'knowledge' : 'will', difficulty: 18, modifiers: [] }; }
function audit(s: SliceState, c: PaleEmperorActivityCommand): Audit {
  return { date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: isCheck(c) ? s.random.cursor : null, randomAfter: isCheck(c) ? s.random.cursor + 1 : null, checkBase: isCheck(c) ? s.character.coreStats[checkSpec(c).ability] : null, check: null, finance: paleEmperorFinanceSnapshot(s) };
}
function validBudget(v: PaleEmperorLifeBudget): boolean {
  return record(v) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000) && v.sequence === 1 && integer(v.acting, 0, 100) && record(v.mastery) && Array.isArray(v.completedSources);
}
function validPending(l: PaleEmperorLifeState, kind: 'QUIETING' | 'INTERDICTION', seconds: number): boolean {
  const p = l.pending, a = current(l), site = l.site;
  return !!p && !!a && !!site && p.kind === kind && p.caseId === l.activeCase && p.vesselId === site.vessel.id && p.vesselVersion === site.vessel.version && p.conditionVersion === l.conditionVersion && p.permissionVersion === a.permissionVersion &&
    l.clockSeconds + seconds <= p.expiresAt && a.permission.custodian === 'GRANTED' && a.permission.ability === 'GRANTED' && l.nora?.present === true && l.nora.location === l.playerLocation && l.playerLocation === site.vessel.location &&
    site.door.state === 'OPEN' && site.screen.state === 'RETRACTED' && site.vessel.lid === 'OPEN' && !site.box.closed && a.observedVersion === site.vessel.version && (kind === 'QUIETING' || same(p.line, [site.vessel.location, site.vessel.location === 'NEAR' ? 'FAR' : 'NEAR']));
}
function transition(input: PaleEmperorLifeState, c: PaleEmperorActivityCommand, week: number, outcome: PublicResolutionTier | null, before: PaleEmperorLifeBudget, clock: Audit): { life: PaleEmperorLifeState; receipt: PaleEmperorLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const l = structuredClone(input), id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  let a = current(l), site = l.site, nora = l.nora;
  const receipt: PaleEmperorLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, noraWalkedMetres: 0, noraEnergySpent: 0, vesselCarriedMetres: 0,
    siteBefore: structuredClone(site), siteAfter: null, source: isCheck(c) && a && site ? { vesselId: site.vessel.id, vesselVersion: site.vessel.version, conditionVersion: l.conditionVersion, permissionVersion: a.permissionVersion, atSeconds: l.clockSeconds, line: c.type === 'SPIRITUAL_INTERDICTION' ? [site.vessel.location, site.vessel.location === 'NEAR' ? 'FAR' : 'NEAR'] : null } : null, applications: [] };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const end = (state: PaleEmperorWindow) => { if (l.pending && a) { const use = l.pending.kind === 'QUIETING' ? a.quieting : a.interdiction; use.state = state; use.remainingSeconds = 0; l.pending = null; } if (site) site.vessel.agitation = 2; };
  const playerWalk = (to: PaleEmperorLifeState['playerLocation']) => { if (l.playerLocation !== to) { const metres = l.playerLocation === 'RECEPTION' || to === 'RECEPTION' ? 12 : 4; receipt.playerWalkedMetres += metres; receipt.elapsedSeconds += metres; l.playerLocation = to; } };
  const noraWalk = (to: PaleEmperorNora['location']) => { if (nora && nora.location !== to) { const position = { AWAY: -4, NEAR: 0, FAR: 4 }, metres = Math.abs(position[to] - position[nora.location]); nora.location = to; nora.energy -= metres / 2; receipt.noraEnergySpent += metres / 2; receipt.noraWalkedMetres += metres; receipt.elapsedSeconds += metres; } };
  const bringScreen = () => { if (site && site.screen.location !== site.vessel.location) { playerWalk(site.screen.location); playerWalk(site.vessel.location); site.screen.location = site.vessel.location; site.screen.travelledMetres += 4; } };
  const screen = () => { if (site) { bringScreen(); if (site.screen.state !== 'DEPLOYED') { site.screen.state = 'DEPLOYED'; site.screen.operations++; l.conditionVersion++; receipt.elapsedSeconds++; end('INVALIDATED'); } } };
  const fit = (ordinary: boolean) => { site!.vessel.lid = 'CLOSED'; site!.lid.location = 'VESSEL'; site!.lid.operations++; site!.vessel.version++; if (ordinary) { site!.vessel.scuffs++; receipt.elapsedSeconds += 12; } else receipt.elapsedSeconds += 4; if (a) a.lidFitted = true; };
  const box = () => { screen(); if (site!.vessel.lid === 'OPEN') fit(true); if (!site!.box.closed) { site!.box.closed = true; site!.box.operations++; receipt.elapsedSeconds += 2; } };
  const carry = (to: Bench, accompanied: boolean, ordinary: boolean) => {
    if (l.playerLocation !== site!.vessel.location) playerWalk(site!.vessel.location);
    if (accompanied && nora!.location !== site!.vessel.location) noraWalk(site!.vessel.location);
    if (site!.vessel.location !== to) { const from = site!.vessel.location; playerWalk(to); if (accompanied) { const prior = receipt.elapsedSeconds; noraWalk(to); receipt.elapsedSeconds = prior; } site!.vessel.location = to; site!.vessel.travelledMetres += 4; receipt.vesselCarriedMetres += 4; site!.vessel.version++;
      site!.box.location = to; site!.box.travelledMetres += 4; if (site!.lid.location !== 'VESSEL') site!.lid.location = to; site!.lid.travelledMetres += 4;
      if (site!.screen.state === 'DEPLOYED' && site!.screen.location === from) { site!.screen.location = to; site!.screen.travelledMetres += 4; }
    }
    if (ordinary) { site!.vessel.scuffs++; receipt.elapsedSeconds += 4; }
  };
  const returnLoan = () => { if (site!.vessel.holder === 'PLAYER') { site!.vessel.holder = 'ANNEX'; site!.loan.returnedWeek = week; site!.loan.returns++; receipt.elapsedSeconds += 2; } if (a) a.loanReturned = true; };
  const leave = () => { if (nora?.present) { noraWalk('AWAY'); nora.present = false; } if (l.playerLocation === 'FAR') playerWalk('NEAR'); playerWalk('RECEPTION'); l.activeCase = null; if (r && a) { r.contactOpen = false; r.returned = true; a.closed = true; r.result = a.result; r.status = a.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; } };
  const physical = !!a && !!r && !!site && !!nora && r.status === 'ACTIVE' && a.week === week && nora.present;
  const granted = physical && a!.permission.custodian === 'GRANTED';
  const withdrawn = physical && (a!.permission.custodian === 'WITHDRAWN' || a!.permission.ability === 'WITHDRAWN');
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  switch (c.type) {
    case 'OBSERVE': {
      const index = PALE_EMPEROR_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[PALE_EMPEROR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 2; break;
    }
    case 'WALK_TO_ANNEX':
      if (locked(l) || !Object.values(l.cases).some(x => x.status === 'OBSERVED' || x.status === 'PAUSED')) return null;
      pay(1); playerWalk('NEAR'); l.visits++; if (!site) { l.site = site = introduce(week, clock.date); l.nora = nora = freshNora(); } break;
    case 'BUY_SEALS':
      if (!site || l.playerLocation !== 'NEAR' || site.seals.some(x => x.state !== 'SUPPLIER') || l.pending) return null;
      pay(0, 8); for (const seal of site.seals) { seal.state = 'PLAYER'; seal.purchasedWeek = week; } receipt.elapsedSeconds = 2; break;
    case 'INVITE':
      if (!site || !nora || l.activeCase || l.playerLocation !== 'NEAR' || nora.present || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!)) return null;
      pay(1, 10); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method)); a = r!.attempts.at(-1)!; l.activeCase = c.caseId; nora.present = true; noraWalk('NEAR'); break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'CUSTODIAN' ? 'custodian' : 'ability';
      if (!physical || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (key === 'custodian' && c.type === 'CONSENT') { site!.loan.grantedWeek = week; site!.loan.returnedWeek = null; site!.loan.grants++; site!.vessel.holder = 'PLAYER'; }
      if (c.type !== 'CONSENT') end('STOPPED'); receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 1; break;
    }
    case 'PREPARE_VESSEL':
      if (!granted || a!.prepared || a!.permission.ability === 'UNASKED' || site!.vessel.holder !== 'PLAYER') return null;
      playerWalk(site!.vessel.location); noraWalk(site!.vessel.location);
      if (site!.door.state !== 'OPEN') { const place = l.playerLocation; playerWalk('NEAR'); site!.door.state = 'OPEN'; site!.door.operations++; receipt.elapsedSeconds++; playerWalk(place); }
      bringScreen();
      if (site!.screen.state !== 'RETRACTED') { site!.screen.state = 'RETRACTED'; site!.screen.operations++; receipt.elapsedSeconds++; }
      if (site!.box.closed) { site!.box.closed = false; site!.box.operations++; receipt.elapsedSeconds++; }
      if (site!.vessel.lid !== 'OPEN') { site!.vessel.lid = 'OPEN'; site!.lid.location = site!.vessel.location; site!.lid.operations++; site!.vessel.seal = site!.vessel.seal === 'INTACT' ? 'BROKEN' : site!.vessel.seal; site!.vessel.version++; receipt.elapsedSeconds += 2; }
      a!.prepared = true; l.conditionVersion++; receipt.elapsedSeconds += 2; break;
    case 'OBSERVE_VESSEL':
      if (!granted || !a!.prepared || a!.observedVersion === site!.vessel.version || l.playerLocation !== site!.vessel.location || site!.vessel.lid !== 'OPEN' || site!.screen.state !== 'RETRACTED' || site!.door.state !== 'OPEN' || site!.box.closed) return null;
      a!.observedVersion = site!.vessel.version; receipt.elapsedSeconds = 2; break;
    case 'RESIDUAL_QUIETING': case 'SPIRITUAL_INTERDICTION': {
      const quiet = c.type === 'RESIDUAL_QUIETING', use = quiet ? a?.quieting : a?.interdiction;
      if (!granted || !use || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || !a!.prepared || a!.observedVersion !== site!.vessel.version || site!.vessel.lid !== 'OPEN' || site!.box.closed || l.pending || site!.screen.state !== 'RETRACTED' || site!.door.state !== 'OPEN' || nora!.location !== l.playerLocation || l.playerLocation !== site!.vessel.location || (quiet ? id !== 'quiet-lid' : id === 'quiet-lid') || r!.attempts.some(x => (quiet ? x.quieting : x.interdiction).attempts > 0)) return null;
      pay(0, 0, quiet ? 8 : 7, 2); use.attempts++; use.tier = outcome;
      if (success(outcome)) { use.successes++; use.state = 'ACTIVE'; use.remainingSeconds = 20; l.pending = { kind: quiet ? 'QUIETING' : 'INTERDICTION', caseId: id!, vesselId: site!.vessel.id, vesselVersion: site!.vessel.version, conditionVersion: l.conditionVersion, permissionVersion: a!.permissionVersion, createdAt: l.clockSeconds, expiresAt: l.clockSeconds + 20, line: quiet ? null : [site!.vessel.location, site!.vessel.location === 'NEAR' ? 'FAR' : 'NEAR'] }; if (quiet) site!.vessel.agitation = 0; }
      else use.state = 'FAILED'; break;
    }
    case 'FIT_LID':
      if (!granted || id !== 'quiet-lid' || a!.lidFitted || !validPending(l, 'QUIETING', 4)) return null;
      fit(false); a!.quieting.effects++; receipt.applications.push('QUIET_LID'); a!.result = 'ABILITY'; end('APPLIED'); break;
    case 'ORDINARY_FIT':
      if (!physical || !a!.prepared || a!.lidFitted || site!.vessel.lid !== 'OPEN' || l.playerLocation !== site!.vessel.location || id === 'withdrawn-return' || id === 'guarded-carry' && !a!.carried) return null;
      end('STOPPED'); screen(); fit(true); if (a!.result === 'NONE') a!.result = 'ORDINARY'; break;
    case 'CARRY_VESSEL':
      if (!granted || id !== 'guarded-carry' || a!.carried || site!.vessel.location !== 'NEAR' || !validPending(l, 'INTERDICTION', 4)) return null;
      carry('FAR', true, false); a!.carried = true; a!.interdiction.effects++; receipt.applications.push('BLOCKED_PROPAGATION'); a!.result = 'ABILITY'; end('APPLIED'); break;
    case 'SCREENED_CARRY':
      if (!granted || id !== 'guarded-carry' || !a!.prepared || a!.carried || site!.vessel.location !== 'NEAR') return null;
      end('STOPPED'); screen(); carry('FAR', true, true); a!.carried = true; a!.result = 'ORDINARY'; break;
    case 'RESEAL': {
      const seal = site?.seals.find(x => x.state === 'PLAYER');
      if (!physical || !seal || !a!.lidFitted || a!.resealed || id === 'withdrawn-return' || site!.vessel.lid !== 'CLOSED' || site!.vessel.seal === 'INTACT' || l.playerLocation !== site!.vessel.location) return null;
      seal.state = 'USED'; seal.usedWeek = week; site!.vessel.seal = 'INTACT'; site!.vessel.version++; a!.resealed = true; receipt.elapsedSeconds = 2; break;
    }
    case 'MANUAL_RETURN':
      if (!physical || id !== 'withdrawn-return' || !a!.prepared || a!.manualReturned || !withdrawn) return null;
      end('STOPPED'); box(); carry('NEAR', false, true); a!.manualReturned = true; a!.result = 'ORDINARY'; break;
    case 'RETURN_LOAN':
      if (!physical || a!.loanReturned || a!.result === 'NONE' || (id === 'withdrawn-return' ? !a!.manualReturned : !a!.resealed) || l.playerLocation !== site!.vessel.location) return null;
      end('STOPPED'); box(); returnLoan(); break;
    case 'CLOSE_DOOR': case 'OPEN_DOOR':
      if (!physical || site!.door.state === (c.type === 'OPEN_DOOR' ? 'OPEN' : 'CLOSED')) return null;
      { const place = l.playerLocation; playerWalk('NEAR'); site!.door.state = c.type === 'OPEN_DOOR' ? 'OPEN' : 'CLOSED'; site!.door.operations++; l.conditionVersion++; receipt.elapsedSeconds++; end('INVALIDATED'); playerWalk(place); } break;
    case 'DEPLOY_SCREEN':
      if (!physical || site!.screen.state === 'DEPLOYED') return null;
      screen(); break;
    case 'STOP': if (!physical || !l.pending) return null; end('STOPPED'); break;
    case 'WAIT_WINDOW': if (!physical || !l.pending) return null; receipt.elapsedSeconds = l.pending.expiresAt - l.clockSeconds; end('EXPIRED'); break;
    case 'LEAVE':
      if (!site || l.playerLocation === 'RECEPTION' || l.pending || site.vessel.holder !== 'ANNEX' || !site.box.closed || site.vessel.lid !== 'CLOSED' && site.screen.state !== 'DEPLOYED' || a && !a.loanReturned && a.permission.custodian === 'GRANTED') return null;
      leave(); break;
    case 'ABORT':
      if (!site || l.playerLocation === 'RECEPTION') return null;
      end('STOPPED'); if (site.vessel.holder === 'PLAYER') { playerWalk(site.vessel.location); box(); if (!a?.resealed) carry('NEAR', false, false); returnLoan(); } if (a && !a.resealed && !a.manualReturned) a.result = 'NONE'; leave(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || !r!.attempts.some(x => x.closed && x.result !== 'NONE' && x.loanReturned) || before.completedSources.includes(`pale-emperor-case:${c.caseId}`)) return null;
      pay(1); r!.status = 'RESOLVED'; receipt.after.acting = Math.min(100, receipt.after.acting + 25); receipt.after.completedSources.push(`pale-emperor-case:${c.caseId}`);
      if (r!.attempts.some(x => x.quieting.effects === 1)) receipt.after.mastery[QUIETING] = Math.min(500, (receipt.after.mastery[QUIETING] ?? 0) + 8);
      if (r!.attempts.some(x => x.interdiction.effects === 1)) receipt.after.mastery[INTERDICTION] = Math.min(500, (receipt.after.mastery[INTERDICTION] ?? 0) + 8); receipt.elapsedSeconds = 2; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || PALE_EMPEROR_CASE_IDS.some(k => l.cases[k].status !== 'RESOLVED') || before.completedSources.includes('pale-emperor-reflection')) return null;
      pay(1); l.reflected = true; receipt.after.acting = Math.min(100, receipt.after.acting + 25); receipt.after.completedSources.push('pale-emperor-reflection'); receipt.elapsedSeconds = 2; break;
  }
  if (!validBudget(receipt.after) || nora && nora.energy < 0) return null;
  l.clockSeconds += receipt.elapsedSeconds; l.elapsedSeconds += receipt.elapsedSeconds; l.playerTravelMetres += receipt.playerWalkedMetres;
  if (nora) nora.travelMetres += receipt.noraWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.noraTravelMetres += receipt.noraWalkedMetres; a.noraEnergySpent += receipt.noraEnergySpent; a.vesselTravelMetres += receipt.vesselCarriedMetres; a.spiritualitySpent += before.spirituality - receipt.after.spirituality; a.mindSpent += before.mind - receipt.after.mind; }
  if (l.pending) { if (l.clockSeconds >= l.pending.expiresAt) end('EXPIRED'); else (l.pending.kind === 'QUIETING' ? a!.quieting : a!.interdiction).remainingSeconds = l.pending.expiresAt - l.clockSeconds; }
  receipt.siteAfter = structuredClone(site); return { life: l, receipt };
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: PaleEmperorLifeState, s: SliceState): PaleEmperorLifeState | null {
  const scene = s.paleEmperor.sourceScene;
  if (!scene || !initialQuiescent(scene.originals) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 500) return null;
  let model = freshLife(l.sourceWeek), previous: PaleEmperorLifeReceipt | null = null, lastWeek = l.sourceWeek, lastCursor = scene.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'noraWalkedMetres', 'noraEnergySpent', 'vesselCarriedMetres', 'siteBefore', 'siteAfter', 'source', 'applications']) || !validatePaleEmperorActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : scene.revision, s.revision) || !integer(entry.randomCursor, lastCursor, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (locked(model) && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || !same(entry.finance, previous.finance) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (s.paleEmperor.sourceEra === 'POST_CYCLE' && (!record(entry.finance) || entry.finance.sourceEra !== 'POST_CYCLE' || !same({ ...entry.finance, era: s.ferryman.era }, paleEmperorFinanceSnapshot(s)))) return null;
    if (!locked(model) && s.paleEmperor.sourceEra === 'POST_CYCLE') {
      const promotion = s.paleEmperor.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
      if (!previous && !promotion) return null;
      const prior = previous ?? promotion!;
      const cursor = previous ? previous.randomAfter ?? previous.randomCursor : promotion!.cursorAfter;
      const finance = previous?.finance ?? { sourceEra: 'POST_CYCLE' as const, era: promotion!.after.era };
      if (!paleEmperorEraGapMatches(s, prior.after, finance, prior.week, prior.date, prior.revision, entry.revision, cursor, entry.before, entry.finance, entry.week, entry.date, entry.randomCursor)) return null;
    }
    if (isCheck(entry.command)) {
      const spec = checkSpec(entry.command);
      if (entry.checkBase !== s.character.coreStats[spec.ability] || !record(entry.check) || entry.randomBefore !== entry.randomCursor || entry.randomAfter !== entry.randomCursor + 1 || entry.randomAfter > s.random.cursor) return null;
      const rng = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore), expected = resolveNormalCheck({ ...spec, baseAbility: entry.checkBase, roll: rng.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.outcome !== null || entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || !same(entry.finance, previous.finance) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry);
    if (!next || !same(next.receipt, entry)) return null;
    model = next.life; model.journal.push(structuredClone(entry)); previous = entry; lastWeek = entry.week; lastCursor = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function paleEmperorExpectedOriginals(s: SliceState): PaleEmperorOriginals | null { return s.paleEmperor.sourceScene ? structuredClone(s.paleEmperor.sourceScene.originals) : null; }
export function paleEmperorLifeMasteryGains(s: SliceState): Record<typeof QUIETING | typeof INTERDICTION, number> {
  const gains = { [QUIETING]: 0, [INTERDICTION]: 0 };
  for (const id of PALE_EMPEROR_CASE_IDS) { const r = s.paleEmperor.life.cases[id]; if (r.status !== 'RESOLVED') continue; if (r.attempts.some(a => a.quieting.effects === 1)) gains[QUIETING] += 8; if (r.attempts.some(a => a.interdiction.effects === 1)) gains[INTERDICTION] += 8; } return gains;
}
function oldSceneOpen(s: SliceState): boolean { return s.deathConsul.life.activeCase !== null || s.deathConsul.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.deathConsul.encounter.status) || s.ferryman.life.activeCase !== null || s.ferryman.channels.some(channel => channel.preparedWeek !== null) || ['READY', 'FIGHTING'].includes(s.ferryman.encounter.status); }
export function validatePaleEmperorLifeState(s: SliceState): boolean {
  try {
    const l = s.paleEmperor?.life;
    if (!record(l) || !shape(l, Object.keys(createPaleEmperorLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, PALE_EMPEROR_CASE_IDS)) return false;
    if (s.paleEmperor.promotionWeek === null) return same(l, createPaleEmperorLifeState());
    const source = s.paleEmperor.sourceScene?.originals, history = s.paleEmperor.sourceHistory?.deathConsul.life;
    if (!source || !history || l.sourceWeek !== s.paleEmperor.promotionWeek || !integer(l.sourceWeek, 1, s.week) || !initialQuiescent(source) || !same(source, history.site) || !same(s.deathConsul.life, history)) return false;
    const replay = replayLife(l, s); if (!replay || !same(l, replay)) return false;
    const gains = paleEmperorLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of PALE_EMPEROR_CASE_IDS) { const resolved = l.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `pale-emperor-case:${id}`).length !== (resolved ? 1 : 0)) return false; if (resolved) acting += 25; }
    if (s.seer.completedSources.filter(x => x === 'pale-emperor-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[QUIETING] ?? 0) < gains[QUIETING] || (s.progression.mastery[INTERDICTION] ?? 0) < gains[INTERDICTION]) return false;
    const last = l.journal.at(-1);
    if (!last && s.paleEmperor.sourceEra === 'POST_CYCLE') {
      const promotion = s.paleEmperor.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
      if (!promotion || !paleEmperorEraGapMatches(s, promotion.after, { sourceEra: 'POST_CYCLE', era: promotion.after.era }, promotion.week, promotion.date, promotion.revision, s.revision, promotion.cursorAfter, paleEmperorEncounterBudget(s), paleEmperorFinanceSnapshot(s), s.week, s.date, s.random.cursor)) return false;
    }
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.paleEmperor.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.paleEmperor.encounter.status) || !last || last.week !== s.week || !same(paleEmperorEncounterBudget(s), last.after) || !same(paleEmperorFinanceSnapshot(s), last.finance) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && !locked(l) && last.revision === s.revision - 1 && !paleEmperorCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, s.revision, last.randomAfter ?? last.randomCursor, LABELS[last.command.type])) return false;
    if (last && !locked(l) && s.paleEmperor.sourceEra === 'POST_CYCLE' && last.revision < s.revision - 1 && s.paleEmperor.encounter.preparation === null && !paleEmperorEraGapMatches(s, last.after, last.finance, last.week, last.date, last.revision, s.revision, last.randomAfter ?? last.randomCursor, paleEmperorEncounterBudget(s), paleEmperorFinanceSnapshot(s), s.week, s.date, s.random.cursor)) return false;
    return true;
  } catch { return false; }
}
export const validatePaleEmperorLife = validatePaleEmperorLifeState;
export function blockPaleEmperorLife(s: SliceState, c: PaleEmperorActivityCommand): string | null {
  if (!validatePaleEmperorActivityCommand(c)) return '附室行动无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍在世、清醒，并已成为苍白皇帝。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.paleEmperor.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.paleEmperor.encounter.status)) return '先收束当前现场、服药准备或遭遇。';
  if (s.paleEmperor.sourceEra === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION') return '先沿普通道路回到当代接待处。';
  if (!validatePaleEmperorLifeState(s)) return '原物、许可、身体消耗或收支记录不一致。';
  const model = replayLife(s.paleEmperor.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, paleEmperorEncounterBudget(s), audit(s, c))) return '先核对这次许可、位置、原物余量和费用；失败仍可普通收物并沿路退出。';
  return null;
}
export const blockPaleEmperorActivity = blockPaleEmperorLife;
export function applyPaleEmperorLifeCommand(s: SliceState, c: PaleEmperorActivityCommand, ctx: SeerContext): void {
  const reason = blockPaleEmperorLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.paleEmperor.life, s)!, before = paleEmperorEncounterBudget(s), clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isCheck(c)) { check = resolveNormalCheck({ ...checkSpec(c), baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock)!; next.life.journal.push(next.receipt); s.paleEmperor.life = next.life;
  const after = next.receipt.after; Object.assign(s, { health: after.health, mind: after.mind, spirituality: after.spirituality, cash: after.cash, actionsRemaining: after.actions });
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(LABELS[c.type], `${DETAILS[c.type] ?? '原容器、盖、屏和借还约定按这次实际操作保留。'}${check ? `检定${check.tier}，本次消耗已支付。` : ''}本步经过${next.receipt.elapsedSeconds}秒，实际步行${next.receipt.playerWalkedMetres}米。`);
}
export const applyPaleEmperorActivity = applyPaleEmperorLifeCommand;
const CASES = [
  { id: 'quiet-lid', title: '先安定，再合盖', story: '借用附室这一只残留容器。安定只维持20秒，须在窗口内亲手合上原盖，再消耗一条实购封条。也可用原屏普通合盖，多花时间并留下擦痕。' },
  { id: 'guarded-carry', title: '同一容器的四米搬运', story: '在标线内重新打开同一容器，观察近台至远台4米的传播线路。阻隔成功后仍须亲手搬运，诺拉同行消耗精力；普通屏护搬运同样可行。到远台实贴第二条封条。' },
  { id: 'withdrawn-return', title: '许可撤回后的普通归还', story: '走到远台重新借出同一容器。可尝试短暂阻隔，但诺拉在搬运前撤回许可，已付消耗保留。随后独自用屏和原箱安全收物，实搬4米回近台，无须第三条封条。' },
] as const;
const LABELS: Record<PaleEmperorActivityCommand['type'], string> = {
  OBSERVE: '了解本案和普通退路', WALK_TO_ANNEX: '步行十二米到附室', BUY_SEALS: '购买仅有的两条封条', INVITE: '付费邀请诺拉参加本案', CONSENT: '确认这一次许可', DECLINE_CONSENT: '记录这一次拒绝', WITHDRAW_CONSENT: '撤回这一次许可', PREPARE_VESSEL: '走到原台，打开同一容器', OBSERVE_VESSEL: '近看原残留和四米线路', RESIDUAL_QUIETING: '尝试残响安定', SPIRITUAL_INTERDICTION: '尝试灵迹阻隔', FIT_LID: '在安定窗口内亲手合盖', ORDINARY_FIT: '用原屏普通合盖', CARRY_VESSEL: '沿阻隔线路实搬四米', SCREENED_CARRY: '用原屏普通搬运四米', RESEAL: '消耗一条原封条重新封口', MANUAL_RETURN: '普通收物并实搬回近台', RETURN_LOAN: '安全装箱，归还同一原物', CLOSE_DOOR: '亲手关闭原门', OPEN_DOOR: '亲手打开原门', DEPLOY_SCREEN: '展开原屏', STOP: '停止尚未应用的窗口', WAIT_WINDOW: '等待窗口自然到期', LEAVE: '诺拉离开，本人沿路走回接待处', ABORT: '停止操作，安全收物并走回接待处', REPORT: '报告本案实际结果', REFLECT: '反思短暂窗口和当前许可',
};
const DETAILS: Partial<Record<PaleEmperorActivityCommand['type'], string>> = {
  WALK_TO_ANNEX: '实际花1行动，沿12米普通道路走12秒；首次到场才认识附室和42岁的诺拉。', BUY_SEALS: '8便士实购原封条两条，每条4便士，使用后不补发。', INVITE: '每次邀请实付10便士及1行动；诺拉实际走4米到近台，消耗2精力。', CONSENT: '保管许可与能力许可分开询问；借用的是同一非人、非灵魂的残留容器。', RESIDUAL_QUIETING: '支付8灵性2精神，意志18。成功只使这一份残留躁动暂由2降至0；尚未合盖便不计应用。', SPIRITUAL_INTERDICTION: '支付7灵性2精神，知识18。成功只为已观察的4米线路开20秒窗口；实际搬运才可能拦下一次传播。', FIT_LID: '实际4秒合盖才应用安定；原残留仍在，安定结束恢复躁动2，原盖不会自动打开。', CARRY_VESSEL: '本人、同一容器与诺拉一同实走4米4秒；诺拉消耗2精力，只拦下这一次传播。', WITHDRAW_CONSENT: '立即停止窗口，不退款、不搬运、不补充材料。', MANUAL_RETURN: '用原屏和原箱收物后独自搬回近台；原封条与擦痕保留，诺拉不被迫继续参与。', ABORT: '普通收物、归还原容器和盖，诺拉实走退出，本人沿12米道路返程；不治疗、不退费。', REPORT: '花1行动，扮演增加25；只有实际合盖或阻隔搬运才各获8掌握，每案一次。',
};
const COSTS: Partial<Record<PaleEmperorActivityCommand['type'], string>> = {
  WALK_TO_ANNEX: '1行动 · 12米/12秒', BUY_SEALS: '8便士 · 仅两条 · 2秒', INVITE: '1行动 · 10便士 · 诺拉4米/2精力', CONSENT: '1秒 · 逐项确认', RESIDUAL_QUIETING: '8灵性＋2精神 · 意志18 · 20秒', SPIRITUAL_INTERDICTION: '7灵性＋2精神 · 知识18 · 20秒', FIT_LID: '4秒 · 实际合盖', ORDINARY_FIT: '原屏 · 12秒 · 原容器擦痕＋1', CARRY_VESSEL: '本人及容器4米/4秒 · 诺拉4米/2精力', SCREENED_CARRY: '实搬4米 · 额外4秒 · 擦痕＋1', RESEAL: '消耗1条已购封条 · 2秒', MANUAL_RETURN: '原屏和箱 · 实搬4米 · 留下擦痕', WITHDRAW_CONSENT: '立即停窗 · 不退款', REPORT: '1行动 · 扮演＋25 · 已应用才掌握＋8', REFLECT: '1行动 · 扮演＋25', LEAVE: '0行动 · 实际步行返程12米及现场路程', ABORT: '0行动 · 真实收物与步行 · 不退款',
};
export function paleEmperorLifeActions(s: SliceState): PaleEmperorLifeAction[] {
  if (!active(s)) return [];
  const l = s.paleEmperor.life, a = current(l), site = l.site, actions: PaleEmperorLifeAction[] = [];
  const add = (command: PaleEmperorActivityCommand, preferred = false, cleanup = false) => { const reason = blockPaleEmperorLife(s, command); actions.push({ id: `pale-emperor-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label: LABELS[command.type], cost: COSTS[command.type] ?? '0行动 · 实际操作和用时', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup }); };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (l.playerLocation !== 'RECEPTION' && next) { if (site?.seals.every(x => x.state === 'SUPPLIER')) step('BUY_SEALS'); else { if (l.cases[next.id].status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, true); add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, l.cases[next.id].status === 'PAUSED'); } step('ABORT', false, true); }
    else if (next) { const r = l.cases[next.id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, true); else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true); else step('WALK_TO_ANNEX'); }
    else if (!l.reflected) step('REFLECT'); return actions;
  }
  const denied = a.permission.custodian === 'DECLINED', withdrawn = a.permission.custodian === 'WITHDRAWN' || a.permission.ability === 'WITHDRAWN';
  if (denied) step('ABORT', true, true);
  else if (a.loanReturned) step('LEAVE', true, true);
  else if (a.permission.custodian === 'UNASKED') { add({ type: 'CONSENT', permission: 'CUSTODIAN' }, true); add({ type: 'DECLINE_CONSENT', permission: 'CUSTODIAN' }, false, true); }
  else if (a.permission.ability === 'UNASKED') { if (a.method === 'ABILITY') add({ type: 'CONSENT', permission: 'ABILITY' }, true); add({ type: 'DECLINE_CONSENT', permission: 'ABILITY' }, a.method === 'ORDINARY', true); }
  else if (!a.prepared) step('PREPARE_VESSEL');
  else if (l.activeCase === 'withdrawn-return' && withdrawn) { if (!a.manualReturned) step('MANUAL_RETURN', true, true); else step('RETURN_LOAN', true, true); }
  else if (a.result !== 'NONE') { if (l.activeCase !== 'withdrawn-return' && !a.lidFitted) step('ORDINARY_FIT', true, true); else if (l.activeCase !== 'withdrawn-return' && !a.resealed) step('RESEAL', true, true); else step('RETURN_LOAN', true, true); }
  else if (a.observedVersion !== site!.vessel.version) step('OBSERVE_VESSEL');
  else if (l.activeCase === 'quiet-lid') { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !a.quieting.attempts) step('RESIDUAL_QUIETING'); if (l.pending?.kind === 'QUIETING') step('FIT_LID'); step('ORDINARY_FIT', a.method === 'ORDINARY' || a.quieting.attempts > 0 && !l.pending, true); }
  else if (l.activeCase === 'guarded-carry') { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !a.interdiction.attempts) step('SPIRITUAL_INTERDICTION'); if (l.pending?.kind === 'INTERDICTION') step('CARRY_VESSEL'); step('SCREENED_CARRY', a.method === 'ORDINARY' || a.interdiction.attempts > 0 && !l.pending, true); }
  else { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !a.interdiction.attempts) step('SPIRITUAL_INTERDICTION'); add({ type: 'WITHDRAW_CONSENT', permission: 'CUSTODIAN' }, a.method === 'ORDINARY' || a.interdiction.attempts > 0, true); }
  if (l.pending) { step('WAIT_WINDOW', false, true); step('STOP', false, true); step('CLOSE_DOOR', false, true); }
  if (a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true);
  if (!actions.some(x => x.command.type === 'ABORT')) step('ABORT', false, true);
  return actions;
}
/** Keep the full resolved ledger while withholding its replay source and stream offsets. */
const publicLifeDate = (d: PublicGameDate) => ({ epoch: d.epoch, year: d.year, month: d.month, day: d.day });
const publicLifeCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
}) : null;
const publicLifeCommand = (c: PaleEmperorActivityCommand): PaleEmperorActivityCommand => {
  switch (c.type) {
    case 'OBSERVE': case 'REPORT': return { type: c.type, caseId: c.caseId };
    case 'INVITE': return { type: c.type, caseId: c.caseId, method: c.method };
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': return { type: c.type, permission: c.permission };
    default: return { type: c.type };
  }
};
const publicLifeBudget = (b: PaleEmperorLifeBudget) => ({
  cash: b.cash, actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality, pollution: b.pollution, gender: b.gender, sequence: b.sequence, acting: b.acting, injuryRisk: b.injuryRisk,
  coreStats: { physique: b.coreStats.physique, perception: b.coreStats.perception, will: b.coreStats.will, knowledge: b.coreStats.knowledge },
  mastery: Object.fromEntries(PALE_EMPEROR_PUBLIC_LIFE_MASTERY.filter(id => Object.hasOwn(b.mastery, id)).map(id => [id, b.mastery[id]!])),
  completedSources: [...b.completedSources],
  injuries: b.injuries.map(i => ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision })),
});
const publicLifeFinance = (f: PaleEmperorFinanceSnapshot) => ({
  weeklyBudget: f.weeklyBudget, lifeTier: f.lifeTier, nextLifeTier: f.nextLifeTier, missedWeeks: f.missedWeeks, credit: f.credit, sourceEra: f.sourceEra,
  debts: f.debts.map(d => ({ id: d.id, source: d.source, remaining: d.remaining, weeklyPayment: d.weeklyPayment, createdWeek: d.createdWeek })),
  era: { location: f.era.location, elapsedSeconds: f.era.elapsedSeconds, travelledMetres: f.era.travelledMetres, works: f.era.works, rests: f.era.rests, weeksAdvanced: f.era.weeksAdvanced, income: f.era.income, expenses: f.era.expenses, emergencyWorks: f.era.emergencyWorks, emergencyWorkUsed: f.era.emergencyWorkUsed, treatments: f.era.treatments },
});
const publicLifeAnnex = (p: PaleEmperorAnnex | null) => p ? ({
  id: p.id, introducedWeek: p.introducedWeek, lengthMetres: p.lengthMetres, ordinaryRoadMetres: p.ordinaryRoadMetres, ordinaryExit: p.ordinaryExit, introducedDate: publicLifeDate(p.introducedDate),
  vessel: { id: p.vessel.id, nature: p.vessel.nature, quantity: p.vessel.quantity, owner: p.vessel.owner, source: p.vessel.source, holder: p.vessel.holder, location: p.vessel.location, agitation: p.vessel.agitation, lid: p.vessel.lid, seal: p.vessel.seal, scuffs: p.vessel.scuffs, travelledMetres: p.vessel.travelledMetres, version: p.vessel.version },
  lid: { id: p.lid.id, location: p.lid.location, operations: p.lid.operations, travelledMetres: p.lid.travelledMetres },
  screen: { id: p.screen.id, state: p.screen.state, location: p.screen.location, operations: p.screen.operations, travelledMetres: p.screen.travelledMetres },
  door: { id: p.door.id, location: p.door.location, state: p.door.state, operations: p.door.operations },
  box: { id: p.box.id, location: p.box.location, closed: p.box.closed, operations: p.box.operations, travelledMetres: p.box.travelledMetres },
  loan: { custodianId: p.loan.custodianId, terms: p.loan.terms, grantedWeek: p.loan.grantedWeek, returnedWeek: p.loan.returnedWeek, grants: p.loan.grants, returns: p.loan.returns },
  seals: p.seals.map(x => ({ id: x.id, price: x.price, state: x.state, purchasedWeek: x.purchasedWeek, usedWeek: x.usedWeek })),
}) : null;
const PALE_EMPEROR_PUBLIC_LIFE_MASTERY = [
  'death.s9.corpse-physique', 'death.s9.spiritual-sight', 'death.s9.undead-knowledge',
  'death.s8.death-eye', 'death.s8.spirit-contact', 'death.s7.spirit-ritual', 'death.s7.spirit-communication', 'death.s7.spirit-borrowing',
  'death.s6.spirit-recruitment', 'death.s6.dead-words', 'death.s5.inner-underworld', 'death.s5.underworld-door',
  'death.s4.underworld-seal', 'death.s3.bounded-ferry', 'death.s3.departure-ward', 'death.s2.pale-flame', 'death.s2.spirit-passage',
  'death.s1.residual-quieting', 'death.s1.spiritual-interdiction',
] as const;
export function projectPaleEmperorLifeReceipt(e: PaleEmperorLifeReceipt) { return {
  week: e.week, revision: e.revision, checkBase: e.checkBase, outcome: e.outcome, elapsedSeconds: e.elapsedSeconds, playerWalkedMetres: e.playerWalkedMetres, noraWalkedMetres: e.noraWalkedMetres, noraEnergySpent: e.noraEnergySpent, vesselCarriedMetres: e.vesselCarriedMetres,
  date: publicLifeDate(e.date), command: publicLifeCommand(e.command), check: publicLifeCheck(e.check),
  before: publicLifeBudget(e.before), after: publicLifeBudget(e.after), finance: publicLifeFinance(e.finance),
  siteBefore: publicLifeAnnex(e.siteBefore), siteAfter: publicLifeAnnex(e.siteAfter), applications: [...e.applications],
}; }
export type PaleEmperorPublicLifeReceipt = ReturnType<typeof projectPaleEmperorLifeReceipt>;

export function projectPaleEmperorLife(s: SliceState): PaleEmperorLifeProjection {
  const l = s.paleEmperor.life, actions = paleEmperorLifeActions(s);
  return { title: '附室里的同一只容器', story: '短暂安定残响，或阻住一条可见的传播线路。随后亲手合盖、搬运和归还；许可撤回后，普通收物与返程仍然可行。', source: '附室自有的一只非人、非灵魂残留容器，原盖、原屏、原门与原箱。诺拉·贝尔42岁，本次重新确认借用和能力许可；封条仅两条，实购实耗。', environment: '接待处至附室普通道路12米；两台相距4米。每次到场1行动，每次邀请10便士及1行动。原封存室、中转室和旧人旧物保持原状。', activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, conditionVersion: l.conditionVersion, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, site: structuredClone(l.site), originals: paleEmperorOriginalSnapshot(s), nora: structuredClone(l.nora), pending: structuredClone(l.pending), currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '原残留始终保留；到期只恢复躁动，不复原擦痕、封条、位置或身体。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '短暂窗口已经由实际动作应用；归还和离场后报告。' : '普通完成，保留已付费用和真实损耗，没有未应用能力奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }), ledger: l.journal.map(projectPaleEmperorLifeReceipt), actions };
}
