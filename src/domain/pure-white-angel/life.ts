import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { LIGHT_SEEKER_POSITION_METRES, validateLightSeekerSiteState } from '../light-seeker/resources.js';
import { pureWhiteAngelCompletedBudgetMatches, pureWhiteAngelEncounterBudget, pureWhiteAngelFinanceSnapshot,
  type PureWhiteAngelEncounterBudget, type PureWhiteAngelFinanceSnapshot } from './encounter.js';

export const PURE_WHITE_ANGEL_CASE_IDS = ['residue-trace', 'personal-impact', 'screened-return'] as const;
export type PureWhiteAngelCaseId = typeof PURE_WHITE_ANGEL_CASE_IDS[number];
export type PureWhiteAngelOriginals = SliceState['lightSeeker']['life']['site'];
export type PureWhiteAngelConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
export type PureWhiteAngelWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'CHECK_FAILED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
type Method = 'ABILITY' | 'ORDINARY';
const STEPS = ['BUY_SAMPLE', 'BUY_PAD', 'WALK_TO_GALLERY', 'READ_SOURCE', 'ASK_SPIRIT', 'ACKNOWLEDGE_REFUSAL', 'AGREE_RETURN', 'MOVE_OWNER_SIDE', 'MOVE_TECHNICIAN_SIDE', 'ENTER_GALLERY', 'OPEN_SHUTTER', 'PLACE_SAMPLE', 'OBSERVE_SAMPLE', 'FOCUSED_PURIFICATION', 'CLEANSE_SAMPLE', 'MANUAL_CONTAIN', 'WEAR_PAD', 'DECLARE_IMPACT', 'WARM_RADIANCE_GUARD', 'RELEASE_IMPACT', 'HANDLE_RESET', 'CHANGE_CONDITIONS', 'STOP', 'WAIT_WINDOW', 'RETRIEVE_SAMPLE', 'RETRIEVE_PAD', 'EXIT_GALLERY', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type PureWhiteAngelActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: PureWhiteAngelCaseId }
  | { type: 'INVITE'; caseId: PureWhiteAngelCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: 'OWNER' | 'TECHNICIAN' | 'ABILITY' }
  | { type: typeof STEPS[number] };
export interface PureWhiteAngelAbilityUse { attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null; state: PureWhiteAngelWindow; remainingSeconds: number; conditionVersion: number | null }
export interface PureWhiteAngelAttempt {
  week: number; method: Method; closed: boolean; result: 'NONE' | Method; elapsedSeconds: number;
  playerTravelMetres: number; maraTravelMetres: number; ivanTravelMetres: number; ownerEnergySpent: number; spiritualitySpent: number; mindSpent: number;
  permission: { owner: PureWhiteAngelConsent; technician: PureWhiteAngelConsent; ability: PureWhiteAngelConsent }; permissionVersion: number;
  sourceRead: boolean; spiritAsked: boolean; spiritAnswer: 'UNASKED' | 'DECLINED'; refusalAcknowledged: boolean; returnAgreed: boolean;
  entered: boolean; exited: boolean; samplePlaced: boolean; sampleRetrieved: boolean; observedSampleVersions: number[];
  cleanseAttempted: boolean; cleanseTier: PublicResolutionTier | null; sampleHandled: boolean; manualContained: boolean;
  padWorn: boolean; padRetrieved: boolean; impactDeclared: boolean; impactReleased: boolean; impactReset: boolean; healthPrevented: number;
  conditionChanged: boolean; shutterReopened: boolean; stopped: boolean; focused: PureWhiteAngelAbilityUse; guard: PureWhiteAngelAbilityUse;
}
export interface PureWhiteAngelLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: PureWhiteAngelAttempt[];
}
export type PureWhiteAngelLifeBudget = PureWhiteAngelEncounterBudget;
export interface PureWhiteAngelLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: PureWhiteAngelActivityCommand; randomCursor: number;
  randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: PureWhiteAngelLifeBudget; after: PureWhiteAngelLifeBudget; finance: PureWhiteAngelFinanceSnapshot;
  elapsedSeconds: number; playerWalkedMetres: number; maraWalkedMetres: number; ivanWalkedMetres: number; ownerEnergySpent: number;
  originalsBefore: PureWhiteAngelOriginals; originalsAfter: PureWhiteAngelOriginals;
  source: { caseId: PureWhiteAngelCaseId; atSeconds: number; conditionVersion: number; permissionVersion: number; sampleId: string | null; sampleVersion: number | null; residueUnits: number; padId: string | null; impact: 0 | 5; shutter: PureWhiteAngelOriginals['shutter']['state']; bonus: 0 | 10 } | null;
  transitions: ('PLACE_SAMPLE' | 'CLEANSE' | 'CONTAIN' | 'WEAR_PAD' | 'DECLARE_IMPACT' | 'RELEASE_IMPACT' | 'HANDLE_RESET' | 'CLOSE_SHUTTER' | 'OPEN_SHUTTER' | 'SHUTTER_BROKEN' | 'RETRIEVE_SAMPLE' | 'RETRIEVE_PAD')[];
}
export interface PureWhiteAngelLifeState {
  sourceWeek: number | null; activeCase: PureWhiteAngelCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: 'OUTSIDE' | 'ENTRY' | 'FAR'; playerTravelMetres: number; maraPresent: boolean; conditionVersion: number;
  ivan: { id: 'PW1-IVAN-MERROW'; name: '伊文·梅罗'; age: 43; alive: true; health: 100; mind: 100; present: boolean; location: 'AWAY' | 'ENTRY' | 'SIDE' | 'SCREEN'; travelMetres: number };
  sample: { id: 'PW1-RESIDUE-1'; owner: 'SUPPLIER' | 'PLAYER'; price: 40; purchasedWeek: number | null; location: 'SUPPLIER' | 'PLAYER' | 'FAR'; residueUnits: 0 | 1; contained: boolean; version: number };
  pad: { id: 'PW1-PAD-1'; owner: 'SUPPLIER' | 'PLAYER'; price: 20; purchasedWeek: number | null; location: 'SUPPLIER' | 'PLAYER' | 'WORN'; durability: number; impacts: number; resets: number };
  pending: { kind: 'FOCUSED' | 'GUARD'; caseId: PureWhiteAngelCaseId; createdAt: number; expiresAt: number; conditionVersion: number; permissionVersion: number; sampleVersion: number | null } | null;
  cases: Record<PureWhiteAngelCaseId, PureWhiteAngelLifeCase>; journal: PureWhiteAngelLifeReceipt[];
}
export interface PureWhiteAngelLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PureWhiteAngelActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface PureWhiteAngelLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: PureWhiteAngelCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; conditionVersion: number; playerLocation: PureWhiteAngelLifeState['playerLocation']; playerTravelMetres: number;
  site: PureWhiteAngelOriginals; originals: PureWhiteAngelOriginals; maraPresent: boolean; ivan: PureWhiteAngelLifeState['ivan']; sample: PureWhiteAngelLifeState['sample']; pad: PureWhiteAngelLifeState['pad']; pending: PureWhiteAngelLifeState['pending']; currentAttempt: PureWhiteAngelAttempt | null;
  cases: { id: PureWhiteAngelCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: PureWhiteAngelAttempt[] }[];
  ledger: PureWhiteAngelLifeReceipt[]; actions: PureWhiteAngelLifeAction[];
}
const FOCUSED = 'sun.s1.focused-purification', GUARD = 'sun.s1.warm-radiance-guard';
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 1;
const freshUse = (): PureWhiteAngelAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null });
const freshCase = (): PureWhiteAngelLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method): PureWhiteAngelAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, maraTravelMetres: 0, ivanTravelMetres: 0, ownerEnergySpent: 0, spiritualitySpent: 0, mindSpent: 0,
    permission: { owner: 'UNASKED', technician: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0, sourceRead: false, spiritAsked: false, spiritAnswer: 'UNASKED', refusalAcknowledged: false, returnAgreed: false,
    entered: false, exited: false, samplePlaced: false, sampleRetrieved: false, observedSampleVersions: [], cleanseAttempted: false, cleanseTier: null, sampleHandled: false, manualContained: false,
    padWorn: false, padRetrieved: false, impactDeclared: false, impactReleased: false, impactReset: false, healthPrevented: 0, conditionChanged: false, shutterReopened: false, stopped: false, focused: freshUse(), guard: freshUse() };
}
export function createPureWhiteAngelLifeState(): PureWhiteAngelLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE', playerTravelMetres: 0, maraPresent: false, conditionVersion: 1,
    ivan: { id: 'PW1-IVAN-MERROW', name: '伊文·梅罗', age: 43, alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 0 },
    sample: { id: 'PW1-RESIDUE-1', owner: 'SUPPLIER', price: 40, purchasedWeek: null, location: 'SUPPLIER', residueUnits: 1, contained: false, version: 1 },
    pad: { id: 'PW1-PAD-1', owner: 'SUPPLIER', price: 20, purchasedWeek: null, location: 'SUPPLIER', durability: 100, impacts: 0, resets: 0 },
    pending: null, cases: { 'residue-trace': freshCase(), 'personal-impact': freshCase(), 'screened-return': freshCase() }, journal: [] };
}
export function pureWhiteAngelOriginalSnapshot(s: SliceState): PureWhiteAngelOriginals { return structuredClone(s.lightSeeker.life.site); }
const initialQuiescent = (o: PureWhiteAngelOriginals) => validateLightSeekerSiteState(o) && o.playerLocation === 'ENTRY' && o.light.mode === 'OFF' && o.light.expiresAt === null;
function freshLife(week: number, originals: PureWhiteAngelOriginals): PureWhiteAngelLifeState { const l = createPureWhiteAngelLifeState(); l.sourceWeek = week; l.clockSeconds = originals.elapsedSeconds; return l; }
export function initializePureWhiteAngelLifeState(s: SliceState): void {
  const source = s.pureWhiteAngel.sourceScene?.originals;
  if (!active(s) || !source || !initialQuiescent(source) || !same(s.pureWhiteAngel.life, createPureWhiteAngelLifeState()) || !same(pureWhiteAngelOriginalSnapshot(s), source)) throw new Error('须保留真实原采光廊，原人原物不复原；本人在入口且原光已灭。');
  s.pureWhiteAngel.life = freshLife(s.week, source);
}
export function validatePureWhiteAngelActivityCommand(v: unknown): v is PureWhiteAngelActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && PURE_WHITE_ANGEL_CASE_IDS.includes(v.caseId as PureWhiteAngelCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && PURE_WHITE_ANGEL_CASE_IDS.includes(v.caseId as PureWhiteAngelCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'TECHNICIAN', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isPureWhiteAngelActivityCommand = validatePureWhiteAngelActivityCommand;
export const isPureWhiteAngelActivity = validatePureWhiteAngelActivityCommand;
const current = (l: PureWhiteAngelLifeState): PureWhiteAngelAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: PureWhiteAngelLifeState) => l.activeCase !== null || l.playerLocation !== 'OUTSIDE' || l.maraPresent || l.ivan.present || l.pending !== null || l.sample.location === 'FAR' || l.pad.location === 'WORN';
export const hasPureWhiteAngelLifeLock = (s: SliceState): boolean => !!s.pureWhiteAngel?.life && locked(s.pureWhiteAngel.life);
export const pureWhiteAngelInside = hasPureWhiteAngelLifeLock;
interface Model { life: PureWhiteAngelLifeState; originals: PureWhiteAngelOriginals }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; finance: PureWhiteAngelFinanceSnapshot }
const isPower = (c: PureWhiteAngelActivityCommand) => c.type === 'FOCUSED_PURIFICATION' || c.type === 'WARM_RADIANCE_GUARD';
const isCheck = (c: PureWhiteAngelActivityCommand) => isPower(c) || c.type === 'CLEANSE_SAMPLE';
function validPending(m: Model, kind: 'FOCUSED' | 'GUARD'): boolean {
  const l = m.life, a = current(l), p = l.pending, o = m.originals;
  return !!p && !!a && p.kind === kind && p.caseId === l.activeCase && l.clockSeconds + 4 <= p.expiresAt && p.conditionVersion === l.conditionVersion && p.permissionVersion === a.permissionVersion &&
    a.permission.owner === 'GRANTED' && a.permission.technician === 'GRANTED' && a.permission.ability === 'GRANTED' && l.playerLocation === 'FAR' && o.playerLocation === 'FAR' && o.shutter.state === 'OPEN' && o.shutter.durability > 0 && o.operatorLocation === 'SIDE' && o.spiritLocation === 'SIDE' && l.ivan.location === 'SIDE' &&
    (kind === 'FOCUSED' ? l.sample.location === 'FAR' && l.sample.residueUnits === 1 && !l.sample.contained && p.sampleVersion === l.sample.version && a.observedSampleVersions.includes(l.sample.version) : l.pad.location === 'WORN' && a.impactDeclared && !a.impactReleased && !a.impactReset);
}
function checkSpec(m: Model, c: PureWhiteAngelActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  return { ability: c.type === 'WARM_RADIANCE_GUARD' ? 'knowledge' : 'will', difficulty: 18, modifiers: c.type === 'CLEANSE_SAMPLE' && validPending(m, 'FOCUSED') ? [{ source: '同一已观察残留的有限净光', value: 10 }] : [] };
}
function audit(s: SliceState, c: PureWhiteAngelActivityCommand): Audit {
  const checked = isCheck(c), ability = c.type === 'WARM_RADIANCE_GUARD' ? 'knowledge' : 'will';
  return { date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null, randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[ability] : null, check: null, finance: pureWhiteAngelFinanceSnapshot(s) };
}
function validBudget(v: PureWhiteAngelLifeBudget): boolean {
  return record(v) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000) && v.sequence === 1 && integer(v.acting, 0, 100) && record(v.mastery) && Array.isArray(v.completedSources);
}
function transition(input: Model, c: PureWhiteAngelActivityCommand, week: number, outcome: PublicResolutionTier | null, before: PureWhiteAngelLifeBudget, clock: Audit): { model: Model; receipt: PureWhiteAngelLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  let a = current(l);
  const receipt: PureWhiteAngelLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, maraWalkedMetres: 0, ivanWalkedMetres: 0, ownerEnergySpent: 0, originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: isCheck(c) && a && id ? { caseId: id, atSeconds: l.clockSeconds, conditionVersion: l.conditionVersion, permissionVersion: a.permissionVersion, sampleId: a.samplePlaced && !a.sampleRetrieved ? l.sample.id : null, sampleVersion: a.observedSampleVersions.includes(l.sample.version) ? l.sample.version : null, residueUnits: l.sample.residueUnits, padId: l.pad.location === 'WORN' ? l.pad.id : null, impact: a.impactDeclared && !a.impactReleased && !a.impactReset ? 5 : 0, shutter: o.shutter.state, bonus: c.type === 'CLEANSE_SAMPLE' && validPending(m, 'FOCUSED') ? 10 : 0 } : null, transitions: [] };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const end = (state: PureWhiteAngelWindow) => { if (l.pending && a) { const use = l.pending.kind === 'FOCUSED' ? a.focused : a.guard; use.state = state; use.remainingSeconds = 0; l.pending = null; } };
  const move = (to: 'OUTSIDE' | 'ENTRY' | 'FAR') => {
    if (l.playerLocation === to) return;
    const metres = l.playerLocation === 'OUTSIDE' || to === 'OUTSIDE' ? 4 : 6;
    receipt.playerWalkedMetres += metres; receipt.elapsedSeconds += metres;
    if (l.playerLocation === 'FAR' || to === 'FAR') { o.playerMetres += metres; o.playerLocation = to === 'FAR' ? 'FAR' : 'ENTRY'; }
    l.playerLocation = to;
  };
  const moveIvan = (to: 'ENTRY' | 'SIDE' | 'SCREEN' | 'AWAY') => {
    if (l.ivan.location === to) return;
    const position = { ENTRY: 0, SIDE: 9, SCREEN: 3, AWAY: -4 };
    const from = l.ivan.location, metres = from === 'SIDE' || to === 'SIDE' ? position[from] + position[to] : Math.abs(position[from] - position[to]);
    receipt.ivanWalkedMetres += metres; receipt.elapsedSeconds += metres; l.ivan.location = to;
  };
  const shutter = (opening: boolean) => {
    if (o.shutter.state === 'BROKEN' || o.shutter.durability === 0 || o.shutter.state === (opening ? 'OPEN' : 'CLOSED')) return;
    o.shutter.operations++; o.shutter.durability--; o.shutter.state = o.shutter.durability === 0 ? 'BROKEN' : opening ? 'OPEN' : 'CLOSED';
    l.conditionVersion++; receipt.transitions.push(o.shutter.state === 'BROKEN' ? 'SHUTTER_BROKEN' : opening ? 'OPEN_SHUTTER' : 'CLOSE_SHUTTER'); receipt.elapsedSeconds++; end('INVALIDATED');
  };
  const openShutter = () => {
    if (o.shutter.state !== 'CLOSED' || o.shutter.durability <= 0) return;
    // Walk from the actual entry or far end to the original 3m shutter and back.
    receipt.playerWalkedMetres += 6; o.playerMetres += 6; receipt.elapsedSeconds += 6; shutter(true); if (a) a.shutterReopened = true;
  };
  const reset = () => { if (a?.impactDeclared && !a.impactReleased && !a.impactReset) { l.pad.durability -= 10; l.pad.resets++; a.impactReset = true; receipt.transitions.push('HANDLE_RESET'); receipt.elapsedSeconds += 2; } end('STOPPED'); };
  const retrieve = () => {
    if (l.sample.location === 'FAR') { if (l.sample.residueUnits === 1 && !l.sample.contained) { l.sample.contained = true; l.sample.version++; receipt.transitions.push('CONTAIN'); receipt.elapsedSeconds += 4; } l.sample.location = 'PLAYER'; if (a) a.sampleRetrieved = true; receipt.transitions.push('RETRIEVE_SAMPLE'); receipt.elapsedSeconds += 2; }
    if (l.pad.location === 'WORN') { l.pad.location = 'PLAYER'; if (a) a.padRetrieved = true; receipt.transitions.push('RETRIEVE_PAD'); receipt.elapsedSeconds += 2; }
  };
  const leave = () => {
    if (l.ivan.location === 'SIDE') moveIvan('ENTRY');
    moveIvan('AWAY'); l.ivan.present = false; l.maraPresent = false; move('OUTSIDE'); l.activeCase = null;
    r!.contactOpen = false; r!.returned = true; a!.closed = true;
  };
  const physical = !!a && !!r && r.status === 'ACTIVE' && a.week === week && l.ivan.present && l.maraPresent;
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  const far = physical && a!.entered && !a!.exited && l.playerLocation === 'FAR' && o.playerLocation === 'FAR';
  const permitted = far && a!.permission.owner === 'GRANTED' && a!.permission.technician === 'GRANTED';
  const clear = o.shutter.state === 'OPEN' && o.shutter.durability > 0;
  switch (c.type) {
    case 'OBSERVE': {
      const i = PURE_WHITE_ANGEL_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || r!.status !== 'AVAILABLE' || i > 0 && l.cases[PURE_WHITE_ANGEL_CASE_IDS[i - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'BUY_SAMPLE': case 'BUY_PAD': {
      const item = c.type === 'BUY_SAMPLE' ? l.sample : l.pad;
      if (locked(l) || item.purchasedWeek !== null || item.location !== 'SUPPLIER' || l.cases['residue-trace'].status === 'AVAILABLE') return null;
      pay(1, item.price); item.owner = 'PLAYER'; item.location = 'PLAYER'; item.purchasedWeek = week; receipt.elapsedSeconds = 2; break;
    }
    case 'WALK_TO_GALLERY':
      if (locked(l) || l.sample.location !== 'PLAYER' || l.pad.location !== 'PLAYER' || !Object.values(l.cases).some(x => x.status === 'OBSERVED' || x.status === 'PAUSED')) return null;
      move('ENTRY'); break;
    case 'INVITE':
      if (l.activeCase || l.playerLocation !== 'ENTRY' || l.ivan.present || l.maraPresent || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitationWeeks.at(-1)!) || l.sample.location !== 'PLAYER' || l.pad.location !== 'PLAYER') return null;
      pay(1, 10); r!.status = 'ACTIVE'; r!.method = c.method; r!.contactOpen = true; r!.returned = false; r!.invitationWeeks.push(week); r!.attempts.push(freshAttempt(week, c.method)); a = r!.attempts.at(-1)!;
      l.activeCase = c.caseId; l.maraPresent = true; l.ivan.present = true; moveIvan('ENTRY'); break;
    case 'READ_SOURCE':
      if (!physical || a!.sourceRead || a!.entered) return null;
      a!.sourceRead = true; receipt.elapsedSeconds = 2; break;
    case 'ASK_SPIRIT':
      if (!physical || !a!.sourceRead || a!.spiritAsked || l.playerLocation !== 'ENTRY' || o.spiritLocation !== 'SIDE') return null;
      a!.spiritAsked = true; a!.spiritAnswer = 'DECLINED'; o.spiritConsent = 'DECLINED'; o.spiritConsentWeek = week; receipt.elapsedSeconds = 2; break;
    case 'ACKNOWLEDGE_REFUSAL':
      if (!physical || !a!.spiritAsked || a!.refusalAcknowledged || a!.spiritAnswer !== 'DECLINED') return null;
      a!.refusalAcknowledged = true; receipt.elapsedSeconds = 1; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'TECHNICIAN' ? 'technician' : 'ability';
      if (!physical || !a!.sourceRead || (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'ability' && a!.method !== 'ABILITY') return null;
      if (c.type === 'CONSENT' && key === 'owner') { if (o.operatorEnergy < 2) return null; o.operatorEnergy -= 2; receipt.ownerEnergySpent = 2; }
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (key === 'owner') { o.operatorConsent = a!.permission.owner; o.operatorConsentWeek = week; }
      if (c.type !== 'CONSENT') end('STOPPED'); receipt.elapsedSeconds = c.type === 'WITHDRAW_CONSENT' ? 0 : 2; break;
    }
    case 'AGREE_RETURN':
      if (!physical || a!.returnAgreed || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED' || a!.permission.ability === 'UNASKED') return null;
      a!.returnAgreed = true; receipt.elapsedSeconds = 2; break;
    case 'MOVE_OWNER_SIDE': {
      if (!physical || a!.permission.owner !== 'GRANTED' || o.operatorLocation === 'SIDE' || o.operatorEnergy < 2) return null;
      const metres = LIGHT_SEEKER_POSITION_METRES[o.operatorLocation] + 9;
      o.operatorLocation = 'SIDE'; o.operatorMetres += metres; o.operatorEnergy -= 2; receipt.ownerEnergySpent += 2; receipt.maraWalkedMetres += metres; receipt.elapsedSeconds += metres; break;
    }
    case 'MOVE_TECHNICIAN_SIDE':
      if (!physical || !a!.returnAgreed || a!.permission.technician !== 'GRANTED' || l.ivan.location !== 'ENTRY') return null;
      moveIvan('SIDE'); break;
    case 'ENTER_GALLERY':
      if (!physical || a!.entered || !a!.returnAgreed || l.playerLocation !== 'ENTRY' || a!.permission.owner !== 'GRANTED' || a!.permission.technician !== 'GRANTED' || l.ivan.location !== 'SIDE') return null;
      move('FAR'); a!.entered = true; break;
    case 'OPEN_SHUTTER':
      if (!physical || !['ENTRY', 'FAR'].includes(l.playerLocation) || o.shutter.state !== 'CLOSED' || o.shutter.durability <= 0) return null;
      openShutter(); break;
    case 'PLACE_SAMPLE':
      if (!permitted || id !== 'residue-trace' || a!.samplePlaced || l.sample.location !== 'PLAYER') return null;
      l.sample.location = 'FAR'; a!.samplePlaced = true; receipt.transitions.push('PLACE_SAMPLE'); receipt.elapsedSeconds = 2; break;
    case 'OBSERVE_SAMPLE':
      if (!permitted || !a!.samplePlaced || l.sample.location !== 'FAR' || !clear || a!.observedSampleVersions.includes(l.sample.version)) return null;
      a!.observedSampleVersions.push(l.sample.version); receipt.elapsedSeconds = 2; break;
    case 'FOCUSED_PURIFICATION': case 'WARM_RADIANCE_GUARD': {
      const focused = c.type === 'FOCUSED_PURIFICATION', key = focused ? 'focused' : 'guard';
      if (!permitted || a!.method !== 'ABILITY' || a!.permission.ability !== 'GRANTED' || !clear || o.operatorLocation !== 'SIDE' || o.spiritLocation !== 'SIDE' || l.ivan.location !== 'SIDE' || l.pending || r!.attempts.some(x => x[key].attempts > 0)) return null;
      if (focused ? id !== 'residue-trace' || l.sample.location !== 'FAR' || l.sample.residueUnits !== 1 || l.sample.contained || !a!.observedSampleVersions.includes(l.sample.version) || a!.cleanseAttempted : id === 'residue-trace' || l.pad.location !== 'WORN' || !a!.impactDeclared || a!.impactReleased || a!.impactReset || a!.conditionChanged) return null;
      pay(0, 0, focused ? 8 : 6, 2); receipt.elapsedSeconds = 2; a!.spiritualitySpent += focused ? 8 : 6; a!.mindSpent += 2;
      const use = a![key]; use.attempts = 1; use.successes = success(outcome) ? 1 : 0; use.tier = outcome; use.state = success(outcome) ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = success(outcome) ? 30 : 0; use.conditionVersion = l.conditionVersion;
      if (success(outcome)) l.pending = { kind: focused ? 'FOCUSED' : 'GUARD', caseId: id!, createdAt: l.clockSeconds + 2, expiresAt: l.clockSeconds + 32, conditionVersion: l.conditionVersion, permissionVersion: a!.permissionVersion, sampleVersion: focused ? l.sample.version : null };
      break;
    }
    case 'CLEANSE_SAMPLE': {
      if (!permitted || id !== 'residue-trace' || l.sample.location !== 'FAR' || l.sample.residueUnits !== 1 || l.sample.contained || !clear || !a!.observedSampleVersions.includes(l.sample.version) || r!.attempts.some(x => x.cleanseAttempted)) return null;
      const helped = validPending(m, 'FOCUSED'); a!.cleanseAttempted = true; a!.cleanseTier = outcome; receipt.elapsedSeconds = 4;
      if (success(outcome)) { l.sample.residueUnits = 0; l.sample.version++; a!.sampleHandled = true; receipt.transitions.push('CLEANSE'); a!.result = helped ? 'ABILITY' : 'ORDINARY'; }
      if (helped && success(outcome)) { a!.focused.effects = 1; end('APPLIED'); } else end(helped ? 'CHECK_FAILED' : 'EXPIRED'); break;
    }
    case 'MANUAL_CONTAIN':
      if (!permitted || id !== 'residue-trace' || l.sample.location !== 'FAR' || a!.sampleHandled) return null;
      end('STOPPED'); if (l.sample.residueUnits === 1 && !l.sample.contained) { l.sample.contained = true; l.sample.version++; receipt.transitions.push('CONTAIN'); }
      a!.manualContained = l.sample.residueUnits === 1; a!.sampleHandled = true; a!.result = 'ORDINARY'; receipt.elapsedSeconds = 6; break;
    case 'WEAR_PAD':
      if (!permitted || id === 'residue-trace' || a!.padWorn || l.pad.location !== 'PLAYER' || l.pad.durability < 10) return null;
      l.pad.location = 'WORN'; a!.padWorn = true; receipt.transitions.push('WEAR_PAD'); receipt.elapsedSeconds = 2; break;
    case 'DECLARE_IMPACT':
      if (!permitted || id === 'residue-trace' || l.pad.location !== 'WORN' || a!.impactDeclared || l.pad.durability < 10) return null;
      a!.impactDeclared = true; receipt.transitions.push('DECLARE_IMPACT'); receipt.elapsedSeconds = 2; break;
    case 'RELEASE_IMPACT': {
      if (!permitted || id !== 'personal-impact' || !a!.impactDeclared || a!.impactReleased || a!.impactReset || l.pad.location !== 'WORN' || l.pad.durability < 10) return null;
      const helped = validPending(m, 'GUARD'); if (!helped && before.health <= 5) return null;
      a!.impactReleased = true; l.pad.durability -= 10; l.pad.impacts++; receipt.transitions.push('RELEASE_IMPACT'); receipt.elapsedSeconds = 4;
      if (helped) { a!.guard.effects = 1; a!.healthPrevented = 5; end('APPLIED'); } else { receipt.after.health -= 5; end('EXPIRED'); }
      a!.result = helped ? 'ABILITY' : 'ORDINARY'; break;
    }
    case 'HANDLE_RESET':
      if (!far || !a!.impactDeclared || a!.impactReleased || a!.impactReset || l.pad.location !== 'WORN' || l.pad.durability < 10) return null;
      reset(); if (id === 'personal-impact' || id === 'screened-return' && a!.permission.owner === 'WITHDRAWN') a!.result = 'ORDINARY'; break;
    case 'CHANGE_CONDITIONS':
      if (!permitted || id !== 'screened-return' || !a!.impactDeclared || a!.impactReleased || a!.impactReset || a!.conditionChanged || l.ivan.location !== 'SIDE' || !clear) return null;
      moveIvan('SCREEN'); shutter(false); moveIvan('SIDE'); a!.conditionChanged = true; break;
    case 'STOP':
      if (!physical || a!.stopped && !l.pending) return null;
      end('STOPPED'); a!.stopped = true; break;
    case 'WAIT_WINDOW':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); end('EXPIRED'); break;
    case 'RETRIEVE_SAMPLE':
      if (!far || l.sample.location !== 'FAR' || l.pending || l.sample.residueUnits === 1 && !l.sample.contained) return null;
      retrieve(); break;
    case 'RETRIEVE_PAD':
      if (!far || l.pad.location !== 'WORN' || l.pending || a!.impactDeclared && !a!.impactReleased && !a!.impactReset) return null;
      retrieve(); break;
    case 'EXIT_GALLERY':
      if (!far || l.pending || l.sample.location !== 'PLAYER' || l.pad.location !== 'PLAYER' || a!.impactDeclared && !a!.impactReleased && !a!.impactReset) return null;
      move('ENTRY'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || l.playerLocation !== 'ENTRY' || l.pending || l.sample.location !== 'PLAYER' || l.pad.location !== 'PLAYER') return null;
      if (a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED') a!.result = 'ORDINARY';
      if (a!.result === 'NONE') return null;
      r!.result = a!.result; r!.status = 'EXAMINED'; leave(); break;
    case 'ABORT':
      if (!physical) { if (l.playerLocation !== 'ENTRY' || l.activeCase || l.ivan.present || l.maraPresent) return null; move('OUTSIDE'); break; }
      end('STOPPED'); a!.stopped = true;
      if (l.playerLocation === 'FAR') { reset(); openShutter(); retrieve(); move('ENTRY'); a!.exited = true; }
      if (a!.permission.owner === 'DECLINED' || a!.permission.technician === 'DECLINED' || id === 'screened-return' && a!.permission.owner === 'WITHDRAWN' && a!.impactReset) a!.result = 'ORDINARY';
      r!.result = a!.result; r!.status = a!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; leave(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || o.playerLocation !== 'ENTRY' || o.light.mode !== 'OFF') return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; receipt.after.acting = Math.min(100, receipt.after.acting + 25); receipt.after.completedSources.push(`pure-white-angel-case:${c.caseId}`);
      for (const [ability, key] of [[FOCUSED, 'focused'], [GUARD, 'guard']] as const) if (r!.attempts.some(x => x[key].effects === 1)) receipt.after.mastery[ability] = Math.min(500, (receipt.after.mastery[ability] ?? 0) + 8); break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !PURE_WHITE_ANGEL_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED')) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 5; receipt.after.acting = Math.min(100, receipt.after.acting + 25); receipt.after.completedSources.push('pure-white-angel-reflection'); break;
  }
  if (!validBudget(receipt.after) || l.pad.durability < 0) return null;
  l.clockSeconds += receipt.elapsedSeconds; l.elapsedSeconds += receipt.elapsedSeconds; o.elapsedSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.ivan.travelMetres += receipt.ivanWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.maraTravelMetres += receipt.maraWalkedMetres; a.ivanTravelMetres += receipt.ivanWalkedMetres; a.ownerEnergySpent += receipt.ownerEnergySpent; }
  if (l.pending && a) { const use = l.pending.kind === 'FOCUSED' ? a.focused : a.guard; use.remainingSeconds = Math.max(0, l.pending.expiresAt - l.clockSeconds); if (use.remainingSeconds === 0) end('EXPIRED'); }
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
function replayLife(l: PureWhiteAngelLifeState, s: SliceState): Model | null {
  const scene = s.pureWhiteAngel.sourceScene, source = scene?.originals;
  if (!source || !initialQuiescent(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 500) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: PureWhiteAngelLifeReceipt | null = null, lastWeek = l.sourceWeek, lastRandomAfter = scene!.random.cursor;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'maraWalkedMetres', 'ivanWalkedMetres', 'ownerEnergySpent', 'originalsBefore', 'originalsAfter', 'source', 'transitions']) || !validatePureWhiteAngelActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : scene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (locked(model.life) && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || !same(entry.finance, previous.finance) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      const spec = checkSpec(model, entry.command);
      if (entry.checkBase !== s.character.coreStats[spec.ability] || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const rng = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ...spec, baseAbility: entry.checkBase, roll: rng.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.outcome !== null || entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || !same(entry.finance, previous.finance) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry);
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; model.life.journal.push(structuredClone(entry)); previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function pureWhiteAngelExpectedOriginals(s: SliceState): PureWhiteAngelOriginals | null {
  const l = s.pureWhiteAngel.life;
  if (l.sourceWeek === null) return s.pureWhiteAngel.sourceScene ? structuredClone(s.pureWhiteAngel.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function pureWhiteAngelLifeMasteryGains(s: SliceState): Record<typeof FOCUSED | typeof GUARD, number> {
  const result = { [FOCUSED]: 0, [GUARD]: 0 };
  for (const id of PURE_WHITE_ANGEL_CASE_IDS) { const r = s.pureWhiteAngel.life.cases[id]; if (r.status !== 'RESOLVED') continue; if (r.attempts.some(a => a.focused.effects === 1)) result[FOCUSED] += 8; if (r.attempts.some(a => a.guard.effects === 1)) result[GUARD] += 8; }
  return result;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.lightSeeker.life.activeCase !== null || Object.values(s.lightSeeker.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.lightSeeker.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.lightSeeker.encounter.status) || s.justiceMentor.life.activeCase !== null || s.justiceMentor.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.justiceMentor.encounter.status);
}
export function validatePureWhiteAngelLifeState(s: SliceState): boolean {
  try {
    const l = s.pureWhiteAngel?.life;
    if (!record(l) || !shape(l, Object.keys(createPureWhiteAngelLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, PURE_WHITE_ANGEL_CASE_IDS)) return false;
    if (s.pureWhiteAngel.promotionWeek === null) return same(l, createPureWhiteAngelLifeState());
    const source = s.pureWhiteAngel.sourceScene?.originals, history = s.pureWhiteAngel.sourceHistory?.lightSeeker.life;
    if (!source || !history || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.pureWhiteAngel.promotionWeek || !initialQuiescent(source) || !same(source, history.site) || !same(s.lightSeeker.life.cases, history.cases) || !same(s.lightSeeker.life.journal, history.journal)) return false;
    // The old validator proves only the frozen initial history. New owner work
    // is not an old-trip equation: ordered receipts prove every new mutation.
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(pureWhiteAngelOriginalSnapshot(s), replay.originals)) return false;
    const gains = pureWhiteAngelLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of PURE_WHITE_ANGEL_CASE_IDS) { const resolved = l.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `pure-white-angel-case:${id}`).length !== (resolved ? 1 : 0)) return false; if (resolved) acting += 25; }
    if (s.seer.completedSources.filter(x => x === 'pure-white-angel-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[FOCUSED] ?? 0) < gains[FOCUSED] || (s.progression.mastery[GUARD] ?? 0) < gains[GUARD]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.pureWhiteAngel.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.pureWhiteAngel.encounter.status) || !last || last.week !== s.week || !same(pureWhiteAngelEncounterBudget(s), last.after) || !same(pureWhiteAngelFinanceSnapshot(s), last.finance) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && !locked(l) && last.revision === s.revision - 1 && !pureWhiteAngelCompletedBudgetMatches(s, last.after, last.finance, last.week, last.date, s.revision, last.randomAfter ?? last.randomCursor, LABELS[last.command.type])) return false;
    return true;
  } catch { return false; }
}
export const validatePureWhiteAngelLife = validatePureWhiteAngelLifeState;
export function blockPureWhiteAngelLife(s: SliceState, c: PureWhiteAngelActivityCommand): string | null {
  if (!validatePureWhiteAngelActivityCommand(c)) return '纯白天使现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为纯白天使。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.pureWhiteAngel.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.pureWhiteAngel.encounter.status)) return '先收束旧现场、服药准备或独立遭遇。';
  if (!validatePureWhiteAngelLifeState(s)) return '原人原物、身体成本或实际回执不一致。';
  const model = replayLife(s.pureWhiteAngel.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, pureWhiteAngelEncounterBudget(s), audit(s, c))) return '先完成实际步骤，核对本次独立许可、原物余量、位置、现金与行动。失败不重抽；普通停止、收物和退出仍为0行动。';
  return null;
}
export const blockPureWhiteAngelActivity = blockPureWhiteAngelLife;
function writeOriginals(s: SliceState, o: PureWhiteAngelOriginals): void {
  const live = s.lightSeeker.life.site;
  for (const key of ['shutter', 'lamp', 'cover', 'screen', 'light', 'board'] as const) Object.assign(live[key], o[key]);
  for (const key of Object.keys(o) as (keyof PureWhiteAngelOriginals)[]) if (typeof o[key] !== 'object') Object.assign(live, { [key]: o[key] });
}
export function applyPureWhiteAngelLifeCommand(s: SliceState, c: PureWhiteAngelActivityCommand, ctx: SeerContext): void {
  const reason = blockPureWhiteAngelLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.pureWhiteAngel.life, s)!, before = pureWhiteAngelEncounterBudget(s), clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock)!;
  next.model.life.journal.push(next.receipt); s.pureWhiteAngel.life = next.model.life; writeOriginals(s, next.model.originals);
  const after = next.receipt.after;
  Object.assign(s, { health: after.health, mind: after.mind, spirituality: after.spirituality, cash: after.cash, actionsRemaining: after.actions });
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(LABELS[c.type], `${DETAILS[c.type] ?? '本步使用当前原物与实际位置，旧许可不代替本次回答。'}${check ? `本次检定${check.tier}，失败照付且不重抽。` : ''}本步实耗${next.receipt.elapsedSeconds}秒；原样本余${next.model.life.sample.residueUnits}份，原垫耐久${next.model.life.pad.durability}；原灯油、屏、遮罩与旧字牌未补充。`);
}
export const applyPureWhiteAngelActivity = applyPureWhiteAngelLifeCommand;
const CASES = [
  { id: 'residue-trace', title: '同一份残留', story: '买来的唯一原样本有1单位超自然残留。亲手放在原廊6米尽头并近距离观察；净光仅开30秒辅助窗，随后独立意志18净除才可能消耗1→0。普通密封仍保留1单位，不伪称已净化。' },
  { id: 'personal-impact', title: '本人原垫与一次小冲击', story: '穿戴唯一原垫并声明一次本人5健康的小规模冲击。温光仅为下一次实际释放挡5健康，原垫仍损10耐久；没有有效护持仍损5健康，须正常休养。普通手动复位同样损原垫10，不损健康。' },
  { id: 'screened-return', title: '原遮板改变与当前撤回', story: '仍穿同一原垫，声明冲击后可尝试温光。伊文从侧路实走到原3米遮板，亲手关闭并原路退回。改变条件使窗失效，随后撤回当前许可；只普通复位、开板、取回原物、实走退出，不释放冲击或补发残留。' },
] as const;
const LABELS: Record<PureWhiteAngelActivityCommand['type'], string> = {
  OBSERVE: '核对本案来源、费用与普通退路', BUY_SAMPLE: '购买唯一原超自然残留样本', BUY_PAD: '购买唯一原个人护垫', WALK_TO_GALLERY: '步行至原采光廊入口', INVITE: '实付邀请伊文参加本案', READ_SOURCE: '核对原玛拉、芦影与同一原廊', ASK_SPIRIT: '询问原芦影这一次探访意愿', ACKNOWLEDGE_REFUSAL: '明确尊重芦影留在侧路的拒绝', CONSENT: '确认这一项当前许可', DECLINE_CONSENT: '记录这一项当前拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可', AGREE_RETURN: '约定普通停止和归还退路', MOVE_OWNER_SIDE: '玛拉实际沿原路退到侧路', MOVE_TECHNICIAN_SIDE: '伊文实际步行9米至侧路', ENTER_GALLERY: '本人沿原6米廊走至尽头', OPEN_SHUTTER: '实走至原遮板，亲手开启再返回', PLACE_SAMPLE: '亲手放置唯一原样本', OBSERVE_SAMPLE: '近距离观察当前原样本版本', FOCUSED_PURIFICATION: '尝试净光定向', CLEANSE_SAMPLE: '独立检定，实际净除当前残留', MANUAL_CONTAIN: '普通近身密封原样本', WEAR_PAD: '实际穿戴同一原护垫', DECLARE_IMPACT: '声明一次本人5健康的小型冲击', WARM_RADIANCE_GUARD: '尝试温光护持', RELEASE_IMPACT: '实际释放一次本人冲击', HANDLE_RESET: '普通手动复位，原垫仍损10耐久', CHANGE_CONDITIONS: '伊文实走并关闭原遮板后退回', STOP: '明确停止未用窗口', WAIT_WINDOW: '真实等待至窗口到期', RETRIEVE_SAMPLE: '亲手取回同一原样本', RETRIEVE_PAD: '亲手卸下同一原护垫', EXIT_GALLERY: '沿原6米廊实际返回入口', LEAVE: '结束接触并实际离场', ABORT: '普通安全收物并沿原路退出', REPORT: '报告真实结果与退场', REFLECT: '反思有限净光、护持与当前许可',
};
const DETAILS: Partial<Record<PureWhiteAngelActivityCommand['type'], string>> = {
  BUY_SAMPLE: '实付40便士和1行动购买唯一1单位超自然残留，无补发。', BUY_PAD: '实付20便士和1行动购买唯一100耐久个人护垫；后续损耗不刷新。', INVITE: '43岁伊文每案实收10便士和1行动，并步行4米到原入口，费用不退。', CONSENT: '玛拉本案新同意需本人真实2精力；她可安全留在原侧路，不强迫穿过光路。', ASK_SPIRIT: '同一LS2-REED芦影明确拒绝本次探访，仍在原侧路，不移动、不扣精力、不赠能力。', FOCUSED_PURIFICATION: '8灵性2精神、意志18；成功只开同一已观察版本30秒窗口。没有净除、没有立即掌握。', CLEANSE_SAMPLE: '另作意志18独立检定，有效净光加10。成功才消耗原残留1→0；失败不退款，可普通密封。', WARM_RADIANCE_GUARD: '6灵性2精神、知识18；成功只开30秒窗口，尚未挡住任何冲击。', RELEASE_IMPACT: '原垫必损10耐久；有效护持实际挡5健康，否则本人实损5健康，须普通休养。', HANDLE_RESET: '普通手动停止待发冲击，原垫仍损10耐久；不伤身体，不奖励能力。', CHANGE_CONDITIONS: '伊文沿侧路9米与廊3米实走往返24米，原遮板损1耐久、操作次数加1；损坏如实记为损坏，不伪称关闭。旧窗立即失效。', ABORT: '0行动普通停止、手动复位、实走开板、密封取回原样本及卸垫、本人和伊文实际步行退出；不退款、不补物、不自动治疗。', REPORT: '1行动，扮演25。新技能仅成功开窗且实际应用后各最多8掌握；未应用、失效、失败不奖励。',
};
const COSTS: Partial<Record<PureWhiteAngelActivityCommand['type'], string>> = {
  OBSERVE: '1行动 · 5秒', BUY_SAMPLE: '1行动 · 40便士 · 唯一1单位原样本', BUY_PAD: '1行动 · 20便士 · 唯一100耐久原垫', INVITE: '1行动 · 每案10便士 · 伊文实走4米', WALK_TO_GALLERY: '0行动 · 本人4米4秒', CONSENT: '0行动 · 2秒 · 玛拉同意另实耗2精力', MOVE_OWNER_SIDE: '0行动 · 原位置经入口至9米侧路 · 2精力', MOVE_TECHNICIAN_SIDE: '0行动 · 伊文9米9秒', ENTER_GALLERY: '0行动 · 本人6米6秒', EXIT_GALLERY: '0行动 · 本人6米6秒', OPEN_SHUTTER: '0行动 · 本人往返6米 · 原遮板耐久−1，操作+1', FOCUSED_PURIFICATION: '0行动 · 8灵性＋2精神 · 意志18 · 最多30秒', CLEANSE_SAMPLE: '0行动 · 独立意志18 · 4秒 · 成功原残留1→0', MANUAL_CONTAIN: '0行动 · 6秒 · 原残留仍1，普通密封', WARM_RADIANCE_GUARD: '0行动 · 6灵性＋2精神 · 知识18 · 最多30秒', RELEASE_IMPACT: '0行动 · 4秒 · 原垫−10；无有效护持本人健康−5', HANDLE_RESET: '0行动 · 2秒 · 原垫−10；健康不损、无掌握', CHANGE_CONDITIONS: '0行动 · 伊文往返24米＋操作1秒 · 原遮板−1', WITHDRAW_CONSENT: '0行动0秒 · 立即停窗，不退款', STOP: '0行动0秒 · 不移动原物', ABORT: '0行动 · 真实步行和收物；有待发冲击原垫−10', LEAVE: '0行动 · 伊文实际返回入口再走4米，本人4米', REPORT: '1行动 · 扮演25 · 真实应用才掌握8', REFLECT: '1行动 · 扮演25',
};
export function pureWhiteAngelLifeActions(s: SliceState): PureWhiteAngelLifeAction[] {
  if (!active(s)) return [];
  const l = s.pureWhiteAngel.life, a = current(l), o = s.lightSeeker.life.site, out: PureWhiteAngelLifeAction[] = [];
  const add = (command: PureWhiteAngelActivityCommand, preferred = false, cleanup = false, label?: string) => { const reason = blockPureWhiteAngelLife(s, command); out.push({ id: `pure-white-angel-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label: label ?? LABELS[command.type], cost: command.type === 'WAIT_WINDOW' ? `0行动 · 真实等待${Math.max(0, (l.pending?.expiresAt ?? l.clockSeconds) - l.clockSeconds)}秒` : COSTS[command.type] ?? '0行动 · 真实操作和用时', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup }); };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    if (l.playerLocation === 'ENTRY' && next) { const r = l.cases[next.id]; if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, true); add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED'); step('ABORT', false, true); return out; }
    if (next) { const r = l.cases[next.id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, true); else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true); else if (l.sample.purchasedWeek === null) step('BUY_SAMPLE'); else if (l.pad.purchasedWeek === null) step('BUY_PAD'); else if (r.status === 'PAUSED' && s.week <= r.invitationWeeks.at(-1)!) add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, false, false, '下周重新实付邀请，只作普通续办'); else step('WALK_TO_GALLERY'); }
    else if (!l.reflected) step('REFLECT'); return out;
  }
  const id = l.activeCase!, denied = a.permission.owner === 'DECLINED' || a.permission.technician === 'DECLINED';
  const withdrawn = a.permission.owner === 'WITHDRAWN' || a.permission.technician === 'WITHDRAWN';
  if (!a.sourceRead) step('READ_SOURCE');
  else if (denied && !a.entered) step('LEAVE', true, true);
  else if (!a.entered) {
    if (!a.spiritAsked && o.spiritLocation === 'SIDE') step('ASK_SPIRIT');
    else if (a.spiritAsked && !a.refusalAcknowledged) step('ACKNOWLEDGE_REFUSAL');
    else {
      const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.technician === 'UNASKED' ? 'TECHNICIAN' : a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
      if (permission) { if (permission !== 'ABILITY' || a.method === 'ABILITY') add({ type: 'CONSENT', permission }, true); add({ type: 'DECLINE_CONSENT', permission }, permission === 'ABILITY' && a.method === 'ORDINARY', true); }
      else if (!a.returnAgreed) step('AGREE_RETURN'); else if (o.operatorLocation !== 'SIDE') step('MOVE_OWNER_SIDE'); else if (l.ivan.location === 'ENTRY') step('MOVE_TECHNICIAN_SIDE'); else step('ENTER_GALLERY');
    }
  } else if (a.result !== 'NONE') {
    if (l.pending) step('STOP', true, true); else if (o.shutter.state === 'CLOSED') step('OPEN_SHUTTER', true, true); else if (l.sample.location === 'FAR') step('RETRIEVE_SAMPLE', true, true); else if (l.pad.location === 'WORN') step('RETRIEVE_PAD', true, true); else if (!a.exited) step('EXIT_GALLERY', true, true); else step('LEAVE', true, true);
  } else if (withdrawn) { if (!a.stopped) step('STOP', true, true); else if (a.impactDeclared && !a.impactReleased && !a.impactReset) step('HANDLE_RESET', true, true); else step('ABORT', true, true); }
  else if (id === 'residue-trace') {
    if (!a.samplePlaced) step('PLACE_SAMPLE');
    else if (o.shutter.state === 'CLOSED') step('OPEN_SHUTTER');
    else if (!a.observedSampleVersions.includes(l.sample.version) && o.shutter.state === 'OPEN') step('OBSERVE_SAMPLE');
    else { if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.focused.attempts) && l.sample.residueUnits && !l.sample.contained) step('FOCUSED_PURIFICATION'); if (!l.cases[id].attempts.some(x => x.cleanseAttempted) && l.sample.residueUnits && !l.sample.contained) step('CLEANSE_SAMPLE', a.focused.state === 'ACTIVE'); step('MANUAL_CONTAIN', a.method === 'ORDINARY' || a.cleanseAttempted || l.sample.contained || l.sample.residueUnits === 0 || o.shutter.state === 'BROKEN', true); }
  } else if (!a.padWorn) step('WEAR_PAD');
  else if (!a.impactDeclared) step('DECLARE_IMPACT');
  else if (id === 'screened-return' && (a.conditionChanged || o.shutter.state === 'BROKEN')) add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, true, true);
  else if (o.shutter.state === 'CLOSED') step('OPEN_SHUTTER');
  else {
    if (a.method === 'ABILITY' && a.permission.ability === 'GRANTED' && !l.cases[id].attempts.some(x => x.guard.attempts)) step('WARM_RADIANCE_GUARD');
    if (id === 'screened-return') step('CHANGE_CONDITIONS', a.guard.attempts > 0 || a.method === 'ORDINARY');
    else { step('RELEASE_IMPACT', a.guard.state === 'ACTIVE'); step('HANDLE_RESET', a.method === 'ORDINARY' || a.guard.state === 'FAILED', true); }
  }
  if (l.pending) { step('WAIT_WINDOW', false, true); step('STOP', false, true); }
  if (a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true);
  if (!out.some(x => x.command.type === 'ABORT')) step('ABORT', false, true);
  return out;
}
export function projectPureWhiteAngelLife(s: SliceState): PureWhiteAngelLifeProjection {
  const l = s.pureWhiteAngel.life, site = pureWhiteAngelOriginalSnapshot(s), actions = pureWhiteAngelLifeActions(s);
  return { title: '原采光廊、有限净光与个人护持', story: '在原采光廊练习定向净除与个人护持。先开启短暂窗口，再完成实际操作，报告时按应用结果增长掌握；芦影可自行决定是否参加。', source: '原LS2-GALLERY六米采光廊、玛拉46岁、同一芦影、旧字牌、灯、屏、遮罩和遮板全部保留；新买唯一1单位残留与原护垫。', environment: '门外通路4米，原廊入口至尽头6米，遮板在3米，安全侧路距入口9米，普通出口始终开放。43岁伊文每案实付10便士1行动邀请；玛拉每次新同意实耗2精力。灯油和旧原物不补发，芦影可明确拒绝并留侧路。', activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: l.clockSeconds, elapsedSeconds: l.elapsedSeconds, conditionVersion: l.conditionVersion, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, site, originals: structuredClone(site), maraPresent: l.maraPresent, ivan: structuredClone(l.ivan), sample: structuredClone(l.sample), pad: structuredClone(l.pad), pending: structuredClone(l.pending), currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '同意可随时撤回；失败照付，普通完成有效。原身体损伤须正常治疗或休养。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限窗口已经由后续真实动作实际应用；完成收物退出后才可报告成长。' : '普通完成，保留失败、失效和原物损耗，无未应用能力掌握。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }), ledger: structuredClone(l.journal), actions };
}
