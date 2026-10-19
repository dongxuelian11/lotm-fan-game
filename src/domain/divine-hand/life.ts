import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { DivineHandFinanceSnapshot } from './types.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { validateGlorySiteState, type GlorySiteState, type GloryLocation } from '../glory/life.js';
import { divineHandEncounterOriginalEvents } from './encounter.js';
import { projectGloryPublicSite } from '../glory/index.js';

/** The authoritative repair-room objects are never recreated. New load metadata
 * identifies one paid delivery; it cannot replenish the exhausted original rig. */
export const DIVINE_HAND_CASE_IDS = ['beam-support', 'armor-window', 'withdrawn-support'] as const;
export type DivineHandCaseId = typeof DIVINE_HAND_CASE_IDS[number];
export interface DivineHandOriginals { site: GlorySiteState }
export type DivineHandConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type DivineHandWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'OPERATOR' | 'PARTICIPANT' | 'ABILITY';
const STEPS = ['RECOVER_ENERGY', 'APPROACH', 'CONTACT_BEAM', 'BEAM_STABILIZE', 'MANUAL_INSPECTION', 'BUY_LOAD', 'RECEIVE_LOAD', 'PREPARE_LOAD', 'WEAR_PAD', 'REMOVE_PAD', 'ARMOR_CONVERGENCE', 'APPLY_LOAD', 'ORDINARY_INSPECTION', 'WAIT_10', 'STOP_METHOD', 'EXIT_ROOM', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type DivineHandActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: DivineHandCaseId }
  | { type: 'PREPARE'; caseId: DivineHandCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: Permission }
  | { type: typeof STEPS[number] };
export interface DivineHandAbilityUse { attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null; state: DivineHandWindow }
export interface DivineHandLoad {
  id: string; ownerId: 'GL2-CELIA'; paidPennies: 30; boughtWeek: number; location: 'SUPPLIER' | 'BENCH';
  arrivedAt: number | null; preparedAt: number | null; kilograms: 12; remaining: 0 | 1; consumed: 0 | 1; appliedAt: number | null; safetyStop: 'ENGAGED';
}
export interface DivineHandAttempt {
  week: number; method: Method; closed: boolean; result: 'NONE' | Method; elapsedSeconds: number;
  playerTravelMetres: number; celiaTravelMetres: number; evanTravelMetres: number;
  playerEnergySpent: number; penniesSpent: number; spiritualitySpent: number; mindSpent: number; healthSpent: number;
  permission: { owner: DivineHandConsent; operator: DivineHandConsent; participant: DivineHandConsent; ability: DivineHandConsent }; permissionVersion: number;
  siteAtStart: GlorySiteState; approached: boolean; contact: boolean; stopped: boolean; exited: boolean;
  inspectionAt: number | null; inspectionTier: PublicResolutionTier | null; inspectionBonus: 0 | 8;
  load: DivineHandLoad | null; padRetrieved: boolean; padReturned: boolean; armorWear: number; impactDamage: number; impactReduction: number;
  beam: DivineHandAbilityUse; armor: DivineHandAbilityUse;
}
export interface DivineHandLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: DivineHandAttempt[];
}
export interface DivineHandLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface DivineHandLifeMovement { actor: 'PLAYER' | 'CELIA' | 'EVAN'; from: GloryLocation; to: 'BENCH' | 'OUTSIDE'; mode: 'WALK'; metres: number; seconds: number; originalBody: true }
export interface DivineHandLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: DivineHandActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: DivineHandLifeBudget; after: DivineHandLifeBudget; finance: DivineHandFinanceSnapshot; elapsedSeconds: number;
  playerWalkedMetres: number; celiaWalkedMetres: number; evanWalkedMetres: number;
  playerEnergySpent: number; celiaEnergySpent: number; evanEnergySpent: number; playerEnergyRecovered: number; moves: DivineHandLifeMovement[];
  originalsBefore: DivineHandOriginals; originalsAfter: DivineHandOriginals;
  source: { caseId: DivineHandCaseId; atSeconds: number; permissionVersion: number; siteId: 'GL2-REPAIR-ROOM'; bridgeId: 'GL2-BRIDGE'; armorId: 'SK3-LIFE-ARMOR';
    playerLocation: GloryLocation; celiaLocation: GlorySiteState['celia']['location']; evanLocation: GlorySiteState['evan']['location']; contact: boolean; mastery: number; bonus: 0 | 8 } | null;
}
export interface DivineHandLifeState {
  sourceWeek: number | null; activeCase: DivineHandCaseId | null; reflected: boolean;
  clockSeconds: number; elapsedSeconds: number; playerLocation: GloryLocation;
  playerTravelMetres: number; celiaTravelMetres: number; evanTravelMetres: number;
  pending: { kind: 'BEAM' | 'ARMOR'; caseId: DivineHandCaseId; createdAt: number; expiresAt: number; permissionVersion: number; bridgeId: 'GL2-BRIDGE'; armorId: 'SK3-LIFE-ARMOR' } | null;
  cases: Record<DivineHandCaseId, DivineHandLifeCase>; journal: DivineHandLifeReceipt[];
}
export interface DivineHandLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DivineHandActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface DivineHandLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: DivineHandCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: GloryLocation; playerTravelMetres: number; celiaTravelMetres: number; evanTravelMetres: number;
  site: GlorySiteState; pending: DivineHandLifeState['pending']; pendingUsable: boolean; pendingRemainingSeconds: number; currentAttempt: DivineHandAttempt | null;
  cases: { id: DivineHandCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: DivineHandAttempt[] }[];
  ledger: DivineHandPublicLifeReceipt[]; actions: DivineHandLifeAction[];
}
const BEAM = 'warrior.s1.beam-stabilize', ARMOR = 'warrior.s1.armor-convergence';
const POSITION: Record<GloryLocation, number> = { OUTSIDE: -2, ENTRY: 0, BENCH: 2, BRIDGE: 8, YARD: -4 };
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 1;
const budget = (s: SliceState): DivineHandLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is DivineHandLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): DivineHandAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' });
const freshCase = (): DivineHandLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method, p: GlorySiteState): DivineHandAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, celiaTravelMetres: 0, evanTravelMetres: 0,
    playerEnergySpent: 0, penniesSpent: 20, spiritualitySpent: 0, mindSpent: 0, healthSpent: 0,
    permission: { owner: 'UNASKED', operator: 'UNASKED', participant: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0,
    siteAtStart: structuredClone(p), approached: false, contact: false, stopped: false, exited: false, inspectionAt: null, inspectionTier: null, inspectionBonus: 0,
    load: null, padRetrieved: false, padReturned: false, armorWear: 0, impactDamage: 0, impactReduction: 0, beam: freshUse(), armor: freshUse() };
}
export function createDivineHandLifeState(): DivineHandLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE',
    playerTravelMetres: 0, celiaTravelMetres: 0, evanTravelMetres: 0, pending: null,
    cases: { 'beam-support': freshCase(), 'armor-window': freshCase(), 'withdrawn-support': freshCase() }, journal: [] };
}
export function divineHandOriginalSnapshot(s: SliceState): DivineHandOriginals { return { site: structuredClone(s.glory.life.site) }; }
function freshLife(week: number, originals: DivineHandOriginals): DivineHandLifeState {
  const l = createDivineHandLifeState(); l.sourceWeek = week; l.clockSeconds = originals.site.clockSeconds; l.playerLocation = originals.site.playerLocation; return l;
}
function validSource(o: DivineHandOriginals): boolean {
  const p = o?.site;
  return record(o) && shape(o, ['site']) && validateGlorySiteState(p) && p.introducedWeek !== null && p.playerLocation === 'OUTSIDE' && p.celia.location === 'OUTSIDE' && p.evan.location === 'OUTSIDE' &&
    !!p.armor && !p.armor.active && p.armor.remainingSeconds === 0 && !p.temper.active && !p.guard.active &&
    !p.pads.worn && p.pads.location === 'BENCH' && p.plates.every(x => x.location === 'BENCH');
}
export function initializeDivineHandLifeState(s: SliceState): void {
  const source = s.divineHand.sourceScene?.originals;
  if (!active(s) || !source || !validSource(source) || !same(s.divineHand.life, createDivineHandLifeState()) || !same(divineHandOriginalSnapshot(s), source)) throw new Error('须保留原修理室、同一银甲、实际精力与已经离场的两位成人；晋升不会补货或修复。');
  s.divineHand.life = freshLife(s.week, source);
}
export function validateDivineHandActivityCommand(v: unknown): v is DivineHandActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && DIVINE_HAND_CASE_IDS.includes(v.caseId as DivineHandCaseId);
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && DIVINE_HAND_CASE_IDS.includes(v.caseId as DivineHandCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'OPERATOR', 'PARTICIPANT', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isDivineHandActivityCommand = validateDivineHandActivityCommand;
const current = (l: DivineHandLifeState): DivineHandAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: DivineHandLifeState) => l.activeCase !== null || l.pending !== null;
export const hasDivineHandLifeLock = (s: SliceState): boolean => !!s.divineHand?.life && locked(s.divineHand.life);
export const divineHandLifeHasLock = hasDivineHandLifeLock;
interface Model { life: DivineHandLifeState; originals: DivineHandOriginals }
interface Audit { date: PublicGameDate; revision: number; finance: DivineHandFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: DivineHandActivityCommand) => c.type === 'BEAM_STABILIZE' || c.type === 'ARMOR_CONVERGENCE';
const isCheck = (c: DivineHandActivityCommand) => isPower(c) || c.type === 'MANUAL_INSPECTION';
const allOutside = (p: GlorySiteState) => p.playerLocation === 'OUTSIDE' && p.celia.location === 'OUTSIDE' && p.evan.location === 'OUTSIDE';
const atBench = (p: GlorySiteState) => p.playerLocation === 'BENCH' && p.celia.location === 'BENCH' && p.evan.location === 'BENCH';
const permitted = (a: DivineHandAttempt | null) => !!a && a.permission.owner === 'GRANTED' && a.permission.operator === 'GRANTED' && a.permission.participant === 'GRANTED';
const powerPermitted = (a: DivineHandAttempt | null) => permitted(a) && a!.permission.ability === 'GRANTED' && a!.method === 'ABILITY' && !a!.stopped;
function validPending(m: Model, kind: 'BEAM' | 'ARMOR'): boolean {
  const a = current(m.life), p = m.life.pending;
  return !!p && p.kind === kind && p.caseId === m.life.activeCase && !!a && p.permissionVersion === a.permissionVersion && powerPermitted(a) && atBench(m.originals.site) &&
    (kind === 'BEAM' ? a.contact : m.originals.site.armorWorn && m.originals.site.pads.worn) && m.originals.site.clockSeconds + 1 < p.expiresAt;
}
function masteryAt(l: DivineHandLifeState, key: 'beam' | 'armor'): number {
  return DIVINE_HAND_CASE_IDS.reduce((n, id) => n + (l.cases[id].status === 'RESOLVED' && l.cases[id].attempts.some(a => a[key].effects === 1) ? 8 : 0), 0);
}
function checkSpec(m: Model, c: DivineHandActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  if (c.type === 'BEAM_STABILIZE') return { ability: 'knowledge', difficulty: 18, modifiers: [{ source: '接触稳持掌握', value: Math.floor(masteryAt(m.life, 'beam') / 10) }] };
  if (c.type === 'ARMOR_CONVERGENCE') return { ability: 'will', difficulty: 18, modifiers: [{ source: '护甲合势掌握', value: Math.floor(masteryAt(m.life, 'armor') / 10) }] };
  return { ability: 'knowledge', difficulty: 16, modifiers: validPending(m, 'BEAM') ? [{ source: '本人接触原梁进行这一次手动检查', value: 8 }] : [] };
}
function audit(s: SliceState, c: DivineHandActivityCommand): Audit {
  const checked = isCheck(c), stat = c.type === 'ARMOR_CONVERGENCE' ? 'will' : 'knowledge';
  return { date: structuredClone(s.date), revision: s.revision, finance: financeSnapshot(s), randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null,
    randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[stat] : null, check: null };
}
function transition(input: Model, c: DivineHandActivityCommand, week: number, outcome: PublicResolutionTier | null, before: DivineHandLifeBudget, clock: Audit): { model: Model; receipt: DivineHandLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, p = o.site, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  l.clockSeconds = p.clockSeconds; l.playerLocation = p.playerLocation;
  let a = current(l);
  const receipt: DivineHandLifeReceipt = { week, date: structuredClone(clock.date), revision: clock.revision, finance: structuredClone(clock.finance), randomCursor: clock.randomCursor,
    randomBefore: clock.randomBefore, randomAfter: clock.randomAfter, checkBase: clock.checkBase, check: structuredClone(clock.check), command: structuredClone(c), outcome,
    before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, celiaWalkedMetres: 0, evanWalkedMetres: 0,
    playerEnergySpent: 0, celiaEnergySpent: 0, evanEnergySpent: 0, playerEnergyRecovered: 0, moves: [], originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: isCheck(c) && a && id ? { caseId: id, atSeconds: l.clockSeconds, permissionVersion: a.permissionVersion, siteId: p.siteId, bridgeId: p.bridge.id, armorId: 'SK3-LIFE-ARMOR',
      playerLocation: p.playerLocation, celiaLocation: p.celia.location, evanLocation: p.evan.location, contact: a.contact,
      mastery: isPower(c) ? masteryAt(l, c.type === 'BEAM_STABILIZE' ? 'beam' : 'armor') : 0, bonus: c.type === 'MANUAL_INSPECTION' && validPending(m, 'BEAM') ? 8 : 0 } : null };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const stop = (state: DivineHandWindow) => { if (l.pending && a) { const u = l.pending.kind === 'BEAM' ? a.beam : a.armor; if (u.effects === 0) u.state = state; l.pending = null; } };
  const walk = (actor: 'PLAYER' | 'CELIA' | 'EVAN', to: 'BENCH' | 'OUTSIDE') => {
    const from = actor === 'PLAYER' ? p.playerLocation : actor === 'CELIA' ? p.celia.location : p.evan.location;
    if (from === to) return;
    const metres = Math.abs(POSITION[from] - POSITION[to]); receipt.elapsedSeconds += metres;
    receipt.moves.push({ actor, from, to, mode: 'WALK', metres, seconds: metres, originalBody: true });
    if (actor === 'PLAYER') { p.playerLocation = to; l.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres; receipt.playerWalkedMetres += metres; receipt.playerEnergySpent += metres; }
    else if (actor === 'CELIA') { p.celia.location = to; p.celia.travelMetres += metres; p.celia.energy -= metres; receipt.celiaWalkedMetres += metres; receipt.celiaEnergySpent += metres; }
    else { p.evan.location = to; p.evan.travelMetres += metres; p.evan.energy -= metres; receipt.evanWalkedMetres += metres; receipt.evanEnergySpent += metres; }
  };
  const close = () => {
    a!.closed = true; r!.contactOpen = false; r!.returned = true; l.activeCase = null;
    for (const k of ['owner', 'operator', 'participant', 'ability'] as const) if (['UNASKED', 'GRANTED'].includes(a!.permission[k])) a!.permission[k] = 'CLOSED';
  };
  const removePad = () => { if (a?.padRetrieved && !a.padReturned) { p.pads.location = 'BENCH'; p.pads.worn = false; a.padReturned = true; receipt.elapsedSeconds++; } };
  const physical = !!a && !!r && r.status === 'ACTIVE' && !a.closed && a.week === week;
  const refused = () => !!a && Object.values(a.permission).some(v => v === 'DECLINED' || v === 'WITHDRAWN');
  const completed = () => !!a && (a.inspectionAt !== null || a.load?.consumed === 1 || refused() || a.stopped || a.beam.state === 'FAILED' || a.armor.state === 'FAILED');
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  switch (c.type) {
    case 'RECOVER_ENERGY':
      if (locked(l) || !allOutside(p) || p.playerEnergy >= 100) return null;
      pay(1, 15); receipt.elapsedSeconds = 60; receipt.playerEnergyRecovered = Math.min(20, 100 - p.playerEnergy); p.playerEnergy += receipt.playerEnergyRecovered; break;
    case 'OBSERVE': {
      const index = DIVINE_HAND_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || !allOutside(p) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[DIVINE_HAND_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 2; break;
    }
    case 'PREPARE':
      if (locked(l) || !allOutside(p) || r!.status !== 'OBSERVED' || r!.attempts.length !== 0 || p.playerEnergy < 9 || p.celia.energy < 8 || p.evan.energy < 8) return null;
      pay(1, 20); receipt.elapsedSeconds = 2; a = freshAttempt(week, c.method, p); r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; r!.invitationWeeks.push(week); l.activeCase = c.caseId; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      if (!physical || a!.exited) return null;
      const key = c.permission.toLowerCase() as keyof DivineHandAttempt['permission'];
      if (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') return null;
      if (c.type === 'CONSENT' && (a!.stopped || refused() || key === 'ability' && a!.method !== 'ABILITY')) return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (c.type === 'CONSENT') receipt.elapsedSeconds = 1;
      else { stop('STOPPED'); a!.contact = false; a!.stopped = true; }
      break;
    }
    case 'APPROACH':
      if (!physical || a!.approached || !permitted(a) || !allOutside(p)) return null;
      walk('PLAYER', 'BENCH'); walk('CELIA', 'BENCH'); walk('EVAN', 'BENCH'); a!.approached = true; break;
    case 'CONTACT_BEAM':
      if (!physical || id === 'armor-window' || !permitted(a) || !atBench(p) || a!.contact || a!.stopped || a!.inspectionAt !== null) return null;
      a!.contact = true; receipt.elapsedSeconds = 1; break;
    case 'BEAM_STABILIZE': case 'ARMOR_CONVERGENCE': {
      const beam = c.type === 'BEAM_STABILIZE', use = beam ? a?.beam : a?.armor;
      if (!physical || !powerPermitted(a) || !atBench(p) || !use || use.attempts !== 0 || l.pending || p.playerEnergy < 5 ||
        (beam ? id === 'armor-window' || !a!.contact || a!.inspectionAt !== null : id !== 'armor-window' || !p.armorWorn || !p.pads.worn || p.pads.remaining < 1 || !a!.load?.preparedAt || a!.load.remaining !== 1 || !p.armor || p.armor.integrity < 5)) return null;
      pay(0, 0, 8, 2); receipt.elapsedSeconds = 1; a!.spiritualitySpent += 8; a!.mindSpent += 2;
      use.attempts = 1; use.tier = outcome; use.successes = success(outcome) ? 1 : 0; use.state = success(outcome) ? 'ACTIVE' : 'FAILED';
      if (success(outcome)) l.pending = { kind: beam ? 'BEAM' : 'ARMOR', caseId: id!, createdAt: l.clockSeconds + 1, expiresAt: l.clockSeconds + 21, permissionVersion: a!.permissionVersion, bridgeId: 'GL2-BRIDGE', armorId: 'SK3-LIFE-ARMOR' }; break;
    }
    case 'MANUAL_INSPECTION': {
      if (!physical || id === 'armor-window' || !permitted(a) || !atBench(p) || !a!.contact || a!.inspectionAt !== null || p.playerEnergy < 5) return null;
      const helped = validPending(m, 'BEAM'); receipt.elapsedSeconds = 1; p.playerEnergy--; receipt.playerEnergySpent++;
      a!.inspectionAt = l.clockSeconds + 1; a!.inspectionTier = outcome; a!.inspectionBonus = helped ? 8 : 0; a!.result = helped ? 'ABILITY' : 'ORDINARY';
      if (helped) { a!.beam.effects = 1; a!.beam.state = 'APPLIED'; } stop('APPLIED'); a!.contact = false; break;
    }
    case 'BUY_LOAD':
      if (!physical || id !== 'armor-window' || !permitted(a) || !atBench(p) || a!.load || a!.inspectionAt !== null || a!.stopped) return null;
      pay(0, 30); receipt.elapsedSeconds = 1; a!.penniesSpent += 30;
      a!.load = { id: `DH1-LOAD:${id}:1`, ownerId: 'GL2-CELIA', paidPennies: 30, boughtWeek: week, location: 'SUPPLIER', arrivedAt: null, preparedAt: null, kilograms: 12, remaining: 1, consumed: 0, appliedAt: null, safetyStop: 'ENGAGED' }; break;
    case 'RECEIVE_LOAD':
      if (!physical || !permitted(a) || !atBench(p) || !a!.load || a!.load.location !== 'SUPPLIER' || a!.stopped) return null;
      receipt.elapsedSeconds = 3; a!.load.location = 'BENCH'; a!.load.arrivedAt = l.clockSeconds + 3; break;
    case 'PREPARE_LOAD':
      if (!physical || !permitted(a) || !atBench(p) || !a!.load || a!.load.location !== 'BENCH' || a!.load.arrivedAt === null || a!.load.preparedAt !== null || a!.stopped) return null;
      receipt.elapsedSeconds = 1; a!.load.preparedAt = l.clockSeconds + 1; break;
    case 'WEAR_PAD':
      if (!physical || id !== 'armor-window' || !permitted(a) || !atBench(p) || a!.padRetrieved || p.pads.worn || p.pads.location !== 'BENCH' || p.pads.remaining < 1 || a!.stopped || !p.armorWorn) return null;
      p.pads.location = 'PLAYER'; p.pads.worn = true; a!.padRetrieved = true; receipt.elapsedSeconds = 1; break;
    case 'REMOVE_PAD':
      if (!physical || !atBench(p) || !a!.padRetrieved || a!.padReturned || l.pending) return null;
      removePad(); break;
    case 'APPLY_LOAD': {
      const load = a?.load;
      if (!physical || id !== 'armor-window' || !permitted(a) || !atBench(p) || !load || load.location !== 'BENCH' || load.preparedAt === null || load.remaining !== 1 || load.consumed !== 0 ||
        !p.pads.worn || p.pads.remaining < 1 || !p.armorWorn || !p.armor || p.armor.integrity < 5 || a!.inspectionAt !== null || a!.stopped || p.playerEnergy < 5 || before.health <= 6) return null;
      const helped = validPending(m, 'ARMOR'); receipt.elapsedSeconds = 1; load.remaining = 0; load.consumed = 1; load.appliedAt = l.clockSeconds + 1;
      p.pads.remaining--; p.pads.consumed++; p.armor.integrity -= 5; a!.armorWear = 5; a!.impactReduction = helped ? 3 : 0; a!.impactDamage = 6 - a!.impactReduction;
      receipt.after.health -= a!.impactDamage; a!.healthSpent += a!.impactDamage; p.playerEnergy--; receipt.playerEnergySpent++;
      a!.result = helped ? 'ABILITY' : 'ORDINARY'; if (helped) { a!.armor.effects = 1; a!.armor.state = 'APPLIED'; } stop('APPLIED'); break;
    }
    case 'ORDINARY_INSPECTION':
      if (!physical || !atBench(p) || !permitted(a) || a!.inspectionAt !== null || a!.load?.consumed === 1 || p.playerEnergy < 5) return null;
      stop('STOPPED'); a!.contact = false; receipt.elapsedSeconds = 1; p.playerEnergy--; receipt.playerEnergySpent++;
      a!.inspectionAt = l.clockSeconds + 1; a!.result = 'ORDINARY'; break;
    case 'WAIT_10':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = 10; break;
    case 'STOP_METHOD':
      if (!physical || a!.stopped) return null;
      stop('STOPPED'); a!.contact = false; a!.stopped = true; break;
    case 'EXIT_ROOM':
      if (!physical || a!.exited || !completed() || l.pending || p.pads.worn || a!.contact) return null;
      walk('PLAYER', 'OUTSIDE'); walk('CELIA', 'OUTSIDE'); walk('EVAN', 'OUTSIDE'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || !a!.exited || !allOutside(p) || l.pending || !completed()) return null;
      if (a!.result === 'NONE') a!.result = 'ORDINARY'; r!.result = a!.result; r!.status = 'EXAMINED'; receipt.elapsedSeconds = 1; close(); break;
    case 'ABORT':
      if (!physical) return null;
      stop('STOPPED'); a!.contact = false; a!.stopped = true; removePad(); walk('PLAYER', 'OUTSIDE'); walk('CELIA', 'OUTSIDE'); walk('EVAN', 'OUTSIDE'); a!.exited = true;
      if (a!.result === 'NONE') a!.result = 'ORDINARY'; r!.result = a!.result; r!.status = 'EXAMINED'; close(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !allOutside(p)) return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 2; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !DIVINE_HAND_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED') || !allOutside(p)) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 2; break;
  }
  if (!validBudget(receipt.after) || !integer(p.playerEnergy, 0, 100) || !integer(p.celia.energy, 0, 100) || !integer(p.evan.energy, 0, 100)) return null;
  // No command may consume the ordinary exit reserve, even at zero AP.
  if (p.playerEnergy < Math.abs(POSITION[p.playerLocation] - POSITION.OUTSIDE) || p.celia.energy < Math.abs(POSITION[p.celia.location] - POSITION.OUTSIDE) || p.evan.energy < Math.abs(POSITION[p.evan.location] - POSITION.OUTSIDE)) return null;
  p.clockSeconds += receipt.elapsedSeconds; l.clockSeconds = p.clockSeconds; l.elapsedSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.celiaTravelMetres += receipt.celiaWalkedMetres; l.evanTravelMetres += receipt.evanWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.celiaTravelMetres += receipt.celiaWalkedMetres; a.evanTravelMetres += receipt.evanWalkedMetres; a.playerEnergySpent += receipt.playerEnergySpent; }
  if (l.pending && l.clockSeconds >= l.pending.expiresAt) stop('EXPIRED');
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}

function financeSnapshot(s: DivineHandFinanceSnapshot): DivineHandFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: unknown, week: number): v is DivineHandFinanceSnapshot {
  if (!record(v) || !shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) || !integer(v.weeklyBudget, 1, 100) ||
    typeof v.lifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.lifeTier) || typeof v.nextLifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.nextLifeTier) ||
    !integer(v.missedWeeks) || !['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) || !Array.isArray(v.debts)) return false;
  return new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d => record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
    typeof d.id === 'string' && d.id.length > 0 && typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** The same ordinary BILL/DEBTS resolver used by the main weekly pulse. An open
 * practice never advances the week, even after its invitation spends the last AP. */
function lifeBoundary(e: DivineHandLifeReceipt, isLocked: boolean) {
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
function completedLifeBudgetMatches(s: SliceState, e: DivineHandLifeReceipt, isLocked: boolean): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(budget(s), expected.budget) || !same(financeSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null) return false;
  if (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
function dateMatches(from: PublicGameDate, weeks: number, to: PublicGameDate): boolean { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } }
/** Replay the one authoritative site in public revision order. The encounter
 * owns authentication of its deterministic combat records; this fold also
 * constrains their allowed original-body changes and exact before/after chain. */
function replayLife(l: DivineHandLifeState, s: SliceState): Model | null {
  const source = s.divineHand.sourceScene?.originals;
  if (!source || !validSource(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 250) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: DivineHandLifeReceipt | null = null, previousLocked = false, lastWeek = l.sourceWeek, lastRandomAfter = s.divineHand.sourceScene!.random.cursor;
  const combatEvents = divineHandEncounterOriginalEvents(s);
  if (!Array.isArray(combatEvents)) return null;
  const merged = [
    ...l.journal.map(entry => ({ order: entry.revision, life: entry, combat: null })),
    ...combatEvents.map(entry => ({ order: entry.revision - 1, life: null, combat: entry })),
  ].sort((a, b) => a.order - b.order);
  if (new Set(merged.map(e => e.order)).size !== merged.length) return null;
  for (const event of merged) {
    if (event.combat) {
      const e = event.combat, from = model.originals.site, to = e.after?.site;
      if (locked(model.life) || !model.life.reflected || !integer(e.revision, s.divineHand.sourceScene!.revision, s.revision) || !integer(e.week, lastWeek, s.week) || !same(e.before, model.originals) || !to ||
        !integer(to.clockSeconds, from.clockSeconds) || !integer(to.playerTravelMetres, from.playerTravelMetres) || !integer(to.playerEnergy, 0, from.playerEnergy) || !from.armor || !to.armor ||
        !integer(to.armor.integrity, 0, from.armor.integrity) || !same(to, { ...from, clockSeconds: to.clockSeconds, playerTravelMetres: to.playerTravelMetres, playerEnergy: to.playerEnergy, armor: { ...from.armor, integrity: to.armor.integrity } })) return null;
      model.originals = structuredClone(e.after); previous = null; lastWeek = e.week; continue;
    }
    const entry = event.life!;
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'celiaWalkedMetres', 'evanWalkedMetres', 'playerEnergySpent', 'celiaEnergySpent', 'evanEnergySpent', 'playerEnergyRecovered', 'moves', 'originalsBefore', 'originalsAfter', 'source']) || !validateDivineHandActivityCommand(entry.command) ||
      !integer(entry.week, lastWeek, s.week) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.divineHand.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
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
export function divineHandExpectedOriginals(s: SliceState): DivineHandOriginals | null {
  const l = s.divineHand.life;
  if (l.sourceWeek === null) return s.divineHand.sourceScene ? structuredClone(s.divineHand.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function divineHandLifeMasteryGains(s: SliceState): Record<typeof BEAM | typeof ARMOR, number> {
  return { [BEAM]: masteryAt(s.divineHand.life, 'beam'), [ARMOR]: masteryAt(s.divineHand.life, 'armor') };
}
export const divineHandMasteryGains = divineHandLifeMasteryGains;
function oldSceneOpen(s: SliceState): boolean {
  return s.glory.life.activeCase !== null || Object.values(s.glory.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.glory.preparedWeek !== null ||
    ['READY', 'FIGHTING'].includes(s.glory.encounter.status) || s.silverKnight.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.silverKnight.encounter.status);
}
export function validateDivineHandLifeState(s: SliceState): boolean {
  try {
    const l = s.divineHand?.life;
    if (!record(l) || !shape(l, Object.keys(createDivineHandLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, DIVINE_HAND_CASE_IDS)) return false;
    if (s.divineHand.promotionWeek === null) return same(l, createDivineHandLifeState());
    const source = s.divineHand.sourceScene?.originals, history = s.divineHand.sourceHistory?.glory.life;
    if (!source || !history || !validSource(source) || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.divineHand.promotionWeek ||
      !same(source.site, history.site) || !same(s.glory.life.cases, history.cases) || !same(s.glory.life.journal, history.journal) ||
      s.glory.life.activeCase !== history.activeCase || s.glory.life.reflected !== history.reflected) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(divineHandOriginalSnapshot(s), replay.originals)) return false;
    const gains = divineHandLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of DIVINE_HAND_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `divine-hand-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'divine-hand-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[BEAM] ?? 0) < gains[BEAM] || (s.progression.mastery[ARMOR] ?? 0) < gains[ARMOR]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.divineHand.preparedWeek !== null ||
      ['READY', 'FIGHTING'].includes(s.divineHand.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !completedLifeBudgetMatches(s, last, locked(l))) return false;
    return true;
  } catch { return false; }
}
export const validateDivineHandLife = validateDivineHandLifeState;
export function blockDivineHandLife(s: SliceState, c: DivineHandActivityCommand): string | null {
  if (!validateDivineHandActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为神明之手。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.divineHand.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.divineHand.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateDivineHandLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.divineHand.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先核对本案当前许可、实际接触、有限物资与返程精力。旧负载保留原有余量，每案只能尝试一次；普通退出不耗行动。';
  return null;
}
export const blockDivineHandActivity = blockDivineHandLife;
function writeOriginals(s: SliceState, o: DivineHandOriginals): void {
  const live = s.glory.life.site, next = o.site;
  live.clockSeconds = next.clockSeconds; live.playerLocation = next.playerLocation; live.playerTravelMetres = next.playerTravelMetres; live.playerEnergy = next.playerEnergy;
  for (const key of ['celia', 'evan'] as const) { live[key].location = next[key].location; live[key].travelMetres = next[key].travelMetres; live[key].energy = next[key].energy; }
  if (live.armor && next.armor) live.armor.integrity = next.armor.integrity;
  live.pads.location = next.pads.location; live.pads.worn = next.pads.worn; live.pads.remaining = next.pads.remaining; live.pads.consumed = next.pads.consumed;
}
export function applyDivineHandLifeCommand(s: SliceState, c: DivineHandActivityCommand, ctx: SeerContext): void {
  const reason = blockDivineHandLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.divineHand.life, s)!, before = budget(s), clock = audit(s, c); let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock);
  if (!next) throw new Error('本次真实结果不能改变已记录的现场前提。');
  const l = next.model.life; l.journal.push(next.receipt); s.divineHand.life = l; writeOriginals(s, next.model.originals);
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`divine-hand-case:${c.caseId}`);
    for (const [ability, key] of [[BEAM, 'beam'], [ARMOR, 'armor']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('divine-hand-reflection'); }
  ctx.note(LABELS[c.type], `${DETAILS[c.type]}${check ? `本次${success(check.tier) ? '成功' : '失败'}，检定和实付代价均保留。` : ''}本步实际经过${next.receipt.elapsedSeconds}秒；本人步行${next.receipt.playerWalkedMetres}米，西莉娅${next.receipt.celiaWalkedMetres}米，埃文${next.receipt.evanWalkedMetres}米。`);
}
export const applyDivineHandActivity = applyDivineHandLifeCommand;
export const applyDivineHandActivityCommand = applyDivineHandLifeCommand;
const CASES = [
  { id: 'beam-support', title: '接触原梁完成一次检查', story: '重新邀请西莉娅和埃文，逐项说明本案意愿。三人实际走到原工作台，你亲手接触原桥支梁；有限稳持只帮助下一次在时限内完成的手动检查，普通检查仍然可行。' },
  { id: 'armor-window', title: '同一银甲与一次新负载', story: '原甲保留当前磨损。先征得原主同意并亲手领取剩余安全垫；另付30便士购买唯一新负载，等它实际送达，由西莉娅准备后才能做一次本人受力试验。' },
  { id: 'withdrawn-support', title: '许可撤回后停止接触', story: '原人可以撤回当前许可。未用的稳持立即停止，已经支付的灵性、精神、费用和经过的时间不返还。三人仍须用自己的精力沿普通出口离场。' },
] as const;
const LABELS: Record<DivineHandActivityCommand['type'], string> = {
  RECOVER_ENERGY: '在室外实付休整并恢复20精力', OBSERVE: '核对本案原物与普通做法', PREPARE: '支付准备费并分别邀请原成人',
  CONSENT: '询问并记录本案当前同意', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可',
  APPROACH: '三人各走四米回到原工作台', CONTACT_BEAM: '亲手接触原桥支梁', BEAM_STABILIZE: '尝试接触稳持', MANUAL_INSPECTION: '亲手完成一次原梁检查',
  BUY_LOAD: '支付30便士购买一次新负载', RECEIVE_LOAD: '等候同一付费负载实际送达', PREPARE_LOAD: '请西莉娅准备已送达的负载', WEAR_PAD: '经原主同意领取并穿戴剩余安全垫', REMOVE_PAD: '在工作台脱下并归还原安全垫',
  ARMOR_CONVERGENCE: '尝试护甲合势', APPLY_LOAD: '施加这一次可见的有限负载', ORDINARY_INSPECTION: '以普通手动检查完成本案',
  WAIT_10: '实际等待十秒', STOP_METHOD: '停止本次未用能力与接触', EXIT_ROOM: '三人沿普通出口实际离场', LEAVE: '结束本案接触', ABORT: '停止、归还安全垫并普通离场', REPORT: '如实报告本案结果', REFLECT: '反思接触、本人负担与当前许可',
};
const DETAILS: Record<DivineHandActivityCommand['type'], string> = {
  RECOVER_ENERGY: '本人在室外实付15便士与1行动，休整60秒恢复20精力，至多100；两位成人不会凭空恢复。', OBSERVE: '核对同一原甲、剩余安全垫、原桥与旧负载的实际余量；没有重领物品。', PREPARE: '实付20便士与1行动，只准备这一次场地与交流；旧许可不沿用。',
  CONSENT: '分别取得原主西莉娅、操作人员西莉娅、参与者埃文及本次能力用途的当前同意，均可撤回。', DECLINE_CONSENT: '拒绝已记录，未来施术停止，普通退出仍开放。', WITHDRAW_CONSENT: '当前许可撤回，未用能力和接触立即停止；不返还既付费用、伤害、磨损或时间。',
  APPROACH: '三人分别从室外步行四米，各耗4精力和4秒；始终保留普通返程精力。', CONTACT_BEAM: '本人在工作台实际接触同一原桥的支梁，未进行过桥。', BEAM_STABILIZE: '实付8灵性与2精神，知识18加实际掌握，经过1秒；成功仅开启20秒、一次有效手动检查的帮助。', MANUAL_INSPECTION: '本人耗1精力和1秒，以知识16实际检查。有效稳持仅在检查结束严格早于到期时加8；无论检查成败，这一次帮助都用尽。',
  BUY_LOAD: '实付30便士购入独立编号的一次新负载；还在供货方，旧负载不会重置。', RECEIVE_LOAD: '等候3秒，新负载实际到达原工作台；付款本身不等于到货。', PREPARE_LOAD: '西莉娅按当前同意花1秒准备已到货的一次负载，安全挡始终在位。', WEAR_PAD: '原主当前同意后，亲手从工作台取用同一个剩余安全垫；来源与已消费数量保留。', REMOVE_PAD: '停止有限窗口后在工作台实际归还同一安全垫，消耗不会恢复。',
  ARMOR_CONVERGENCE: '实付8灵性与2精神，意志18加实际掌握，经过1秒；成功仅对20秒内下一次可见的本人受力减少3点伤害。', APPLY_LOAD: '只施加已到货并准备好的一次新负载。真实消费1垫、磨损5银甲、耗1精力；通常承受6伤害，有效合势减少3点，仍会受伤。', ORDINARY_INSPECTION: '停止能力，以1精力、1秒做普通手动检查；不会虚构负载、材料或掌握收益。',
  WAIT_10: '当地时钟真实前进10秒，不续窗、不补充行动。', STOP_METHOD: '停止未用窗口与接触；当前负载、物品和所有实际成本仍保留。', EXIT_ROOM: '三人按实际位置普通步行到室外，每米各耗1精力和1秒。', LEAVE: '原人都已在室外，有限窗口已关闭，结束本案当前接触。', ABORT: '停止能力，在原工作台归还已取用的安全垫，再各自普通步行退出；实际付款与耗损不抹去。', REPORT: '实付1行动并增加25扮演；只有真正应用过有限效果的能力每案增加8掌握。', REFLECT: '三案如实报告后实付1行动，增加25扮演；原历史、伤病和物资来源继续保留。',
};
const COSTS: Partial<Record<DivineHandActivityCommand['type'], string>> = {
  RECOVER_ENERGY: '1行动 · 15便士 · 60秒 · +20精力（上限100）', OBSERVE: '0行动 · 2秒', PREPARE: '1行动 · 20便士 · 2秒', CONSENT: '0行动 · 1秒',
  DECLINE_CONSENT: '0行动 · 立即拒绝', WITHDRAW_CONSENT: '0行动 · 立即撤回 · 不退成本', APPROACH: '0行动 · 三人各4米、4精力 · 共12秒', CONTACT_BEAM: '0行动 · 1秒',
  BEAM_STABILIZE: '0行动 · 8灵性＋2精神 · 知识18 · 1秒／窗口20秒', MANUAL_INSPECTION: '0行动 · 1精力 · 1秒 · 知识16 · 有效帮助+8',
  BUY_LOAD: '0行动 · 30便士 · 1秒 · 一次负载', RECEIVE_LOAD: '0行动 · 实际3秒', PREPARE_LOAD: '0行动 · 1秒', WEAR_PAD: '0行动 · 1秒 · 原主当前许可', REMOVE_PAD: '0行动 · 1秒',
  ARMOR_CONVERGENCE: '0行动 · 8灵性＋2精神 · 意志18 · 1秒／窗口20秒', APPLY_LOAD: '0行动 · 1新负载＋1原垫＋5银甲 · 1精力 · 6伤害（有效合势减3）', ORDINARY_INSPECTION: '0行动 · 1精力 · 1秒', WAIT_10: '0行动 · 实际10秒',
  STOP_METHOD: '0行动 · 立即停止', EXIT_ROOM: '0行动 · 每人每米1精力、1秒', LEAVE: '0行动 · 1秒', ABORT: '0行动 · 实际归还与步行', REPORT: '1行动 · 2秒 · 扮演25', REFLECT: '1行动 · 2秒 · 扮演25',
};
export function divineHandLifeActions(s: SliceState): DivineHandLifeAction[] {
  if (!active(s)) return [];
  const l = s.divineHand.life, p = s.glory.life.site, a = current(l), out: DivineHandLifeAction[] = [];
  const add = (command: DivineHandActivityCommand, preferred = false, cleanup = false, label?: string) => {
    const reason = blockDivineHandLife(s, command);
    out.push({ id: `divine-hand-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`,
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
    else { add({ type: 'PREPARE', caseId: next.id, method: 'ABILITY' }, p.playerEnergy >= 9); add({ type: 'PREPARE', caseId: next.id, method: 'ORDINARY' }, false, false, '支付准备费，以普通方式完成本案'); }
    return out;
  }
  if (a.exited) step('LEAVE', true, true);
  else if (Object.values(a.permission).some(v => v === 'DECLINED' || v === 'WITHDRAWN') || a.stopped) {
    if (p.pads.worn) step('REMOVE_PAD', true, true); else step('EXIT_ROOM', true, true);
  } else {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.operator === 'UNASKED' ? 'OPERATOR' : a.permission.participant === 'UNASKED' ? 'PARTICIPANT' : a.method === 'ABILITY' && a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) {
      add({ type: 'CONSENT', permission }, true, false, permission === 'OWNER' ? '询问西莉娅本案原物用途' : permission === 'OPERATOR' ? '邀请西莉娅操作本案并记录答复' : permission === 'PARTICIPANT' ? '邀请埃文参与本案并记录答复' : '询问这一次有限能力用途');
      add({ type: 'DECLINE_CONSENT', permission }, false, true);
    } else if (!a.approached) step('APPROACH');
    else if (a.inspectionAt !== null || a.load?.consumed === 1) {
      if (p.pads.worn) step('REMOVE_PAD', true, true); else step('EXIT_ROOM', true, true);
    } else if (a.method === 'ORDINARY') step('ORDINARY_INSPECTION');
    else if (l.activeCase === 'armor-window') {
      if (!a.load) step('BUY_LOAD'); else if (a.load.location === 'SUPPLIER') step('RECEIVE_LOAD'); else if (a.load.preparedAt === null) step('PREPARE_LOAD');
      else if (!a.padRetrieved) step('WEAR_PAD'); else if (a.armor.attempts === 0) step('ARMOR_CONVERGENCE'); else step('APPLY_LOAD');
    } else if (!a.contact) step('CONTACT_BEAM');
    else if (a.beam.attempts === 0) step('BEAM_STABILIZE');
    else if (l.activeCase === 'withdrawn-support') add({ type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' }, true, true, '埃文撤回本案参与和能力许可');
    else step('MANUAL_INSPECTION');
  }
  if (l.pending) { step('STOP_METHOD', false, true); step('WAIT_10', false, true); }
  if (!a.exited && atBench(p) && !a.stopped && a.inspectionAt === null && a.load?.consumed !== 1 && !out.some(x => x.command.type === 'ORDINARY_INSPECTION')) step('ORDINARY_INSPECTION', false);
  if (!a.exited && a.permission.ability === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, false, true);
  if (!a.exited && a.permission.owner === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, false, true);
  step('ABORT', false, true); return out;
}
export const divineHandActivityActions = divineHandLifeActions;
export type DivineHandPublicLifeReceipt = Omit<DivineHandLifeReceipt, 'source' | 'randomCursor' | 'randomBefore' | 'randomAfter'>;
/** Resolved checks and physical costs are public; check inputs and random-stream positions are not. */
export function projectDivineHandLifeReceipt(r: DivineHandLifeReceipt): DivineHandPublicLifeReceipt {
  const budget = (b: DivineHandLifeBudget) => ({ health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions });
  const c = r.command, command: DivineHandActivityCommand = 'method' in c ? { type: c.type, caseId: c.caseId, method: c.method }
    : 'permission' in c ? { type: c.type, permission: c.permission } : 'caseId' in c ? { type: c.type, caseId: c.caseId } : { type: c.type };
  const check = r.check;
  return {
    week: r.week, date: { epoch: r.date.epoch, year: r.date.year, month: r.date.month, day: r.date.day }, revision: r.revision, command,
    checkBase: r.checkBase, check: check ? { ability: check.ability, baseAbility: check.baseAbility, modifiers: check.modifiers.map(m => ({ source: m.source, value: m.value })), effectiveAbility: check.effectiveAbility, difficulty: check.difficulty, chance: check.chance, roll: check.roll, tier: check.tier } : null, outcome: r.outcome,
    before: budget(r.before), after: budget(r.after),
    finance: { weeklyBudget: r.finance.weeklyBudget, lifeTier: r.finance.lifeTier, nextLifeTier: r.finance.nextLifeTier,
      debts: r.finance.debts.map(d => ({ id: d.id, source: d.source, remaining: d.remaining, weeklyPayment: d.weeklyPayment, createdWeek: d.createdWeek })), missedWeeks: r.finance.missedWeeks, credit: r.finance.credit },
    elapsedSeconds: r.elapsedSeconds, playerWalkedMetres: r.playerWalkedMetres, celiaWalkedMetres: r.celiaWalkedMetres, evanWalkedMetres: r.evanWalkedMetres,
    playerEnergySpent: r.playerEnergySpent, celiaEnergySpent: r.celiaEnergySpent, evanEnergySpent: r.evanEnergySpent, playerEnergyRecovered: r.playerEnergyRecovered,
    moves: r.moves.map(m => ({ actor: m.actor, from: m.from, to: m.to, mode: m.mode, metres: m.metres, seconds: m.seconds, originalBody: m.originalBody })),
    originalsBefore: { site: projectGloryPublicSite(r.originalsBefore.site) }, originalsAfter: { site: projectGloryPublicSite(r.originalsAfter.site) },
  };
}
function projectDivineHandPublicAttempt(a: DivineHandAttempt): DivineHandAttempt {
  const use = (u: DivineHandAbilityUse) => ({ attempts: u.attempts, successes: u.successes, effects: u.effects, tier: u.tier, state: u.state });
  const l = a.load;
  return {
    week: a.week, method: a.method, closed: a.closed, result: a.result, elapsedSeconds: a.elapsedSeconds,
    playerTravelMetres: a.playerTravelMetres, celiaTravelMetres: a.celiaTravelMetres, evanTravelMetres: a.evanTravelMetres,
    playerEnergySpent: a.playerEnergySpent, penniesSpent: a.penniesSpent, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, healthSpent: a.healthSpent,
    permission: { owner: a.permission.owner, operator: a.permission.operator, participant: a.permission.participant, ability: a.permission.ability }, permissionVersion: a.permissionVersion,
    siteAtStart: projectGloryPublicSite(a.siteAtStart), approached: a.approached, contact: a.contact, stopped: a.stopped, exited: a.exited,
    inspectionAt: a.inspectionAt, inspectionTier: a.inspectionTier, inspectionBonus: a.inspectionBonus,
    load: l ? { id: l.id, ownerId: l.ownerId, paidPennies: l.paidPennies, boughtWeek: l.boughtWeek, location: l.location, arrivedAt: l.arrivedAt, preparedAt: l.preparedAt, kilograms: l.kilograms, remaining: l.remaining, consumed: l.consumed, appliedAt: l.appliedAt, safetyStop: l.safetyStop } : null,
    padRetrieved: a.padRetrieved, padReturned: a.padReturned, armorWear: a.armorWear, impactDamage: a.impactDamage, impactReduction: a.impactReduction, beam: use(a.beam), armor: use(a.armor),
  };
}
export function projectDivineHandLife(s: SliceState): DivineHandLifeProjection {
  const l = s.divineHand.life, originals = divineHandOriginalSnapshot(s), actions = divineHandLifeActions(s), model = { life: l, originals }, a = current(l);
  return { title: '原修理室、同一银甲与有限接触', story: '本人接触原梁后的有限稳持只帮助下一次实际检查；护甲合势只减轻下一次可见的本人受力。失败、到期和撤回均保留代价，磨损与耗材不会复原。',
    source: `同一41岁西莉娅、36岁埃文与原修理室。银甲当前完整度${originals.site.armor?.integrity ?? 0}，首次记录为${originals.site.armorSource?.snapshot.integrity ?? 0}。旧负载尚余${originals.site.load.remainingLoads}次、已用${originals.site.load.appliedLoads}次；原安全垫还剩${originals.site.pads.remaining}份，取用须获当前许可。`,
    environment: '室外负2米、入口0米、工作台2米、原桥另一端8米。三人各走四米到工作台；本次检查不算过桥，原桥通行计数不变。普通出口始终开放。',
    activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: originals.site.clockSeconds, elapsedSeconds: l.elapsedSeconds, playerLocation: originals.site.playerLocation, playerTravelMetres: l.playerTravelMetres, celiaTravelMetres: l.celiaTravelMetres, evanTravelMetres: l.evanTravelMetres,
    site: projectGloryPublicSite(originals.site), pending: l.pending ? { kind: l.pending.kind, caseId: l.pending.caseId, createdAt: l.pending.createdAt, expiresAt: l.pending.expiresAt, permissionVersion: l.pending.permissionVersion, bridgeId: l.pending.bridgeId, armorId: l.pending.armorId } : null, pendingUsable: !!l.pending && validPending(model, l.pending.kind), pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - originals.site.clockSeconds) : 0,
    currentAttempt: a ? projectDivineHandPublicAttempt(a) : null, cases: CASES.map(def => { const r = l.cases[def.id]; return { id: def.id, title: def.title, story: def.story,
      observations: r.observedWeek === null ? [] : [def.story, '使用同一原物，旧负载不重置，原甲不修复；未实际应用的能力没有掌握奖励。'], status: r.status, method: r.method,
      result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限效果已实际应用；原人普通离场，代价与磨损保留。' : '完成普通操作，或如实记录失败、拒绝、停止与撤回；没有未应用的能力奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: r.attempts.map(projectDivineHandPublicAttempt) }; }),
    ledger: l.journal.map(projectDivineHandLifeReceipt), actions };
}
