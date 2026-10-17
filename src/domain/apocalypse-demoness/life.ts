import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { ApocalypseDemonessFinanceSnapshot } from './types.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { validateCalamityDemonessSiteState, type CalamityDemonessSiteState, type CalamityDemonessLocation } from '../calamity-demoness/life.js';
import type { CalamityDemonessCombatPlate } from '../calamity-demoness/encounter.js';
import { apocalypseDemonessEncounterOriginalEvents } from './encounter.js';

export const APOCALYPSE_DEMONESS_CASE_IDS = ['pulse-containment', 'mirror-buffer', 'withdrawn-window'] as const;
export const APOCALYPSE_DEMONESS_ACTIVITY_CASE_IDS = APOCALYPSE_DEMONESS_CASE_IDS;
export type ApocalypseDemonessCaseId = typeof APOCALYPSE_DEMONESS_CASE_IDS[number];
/** These are historical provenance at acquisition, and the one current original
 * body/site thereafter. The old eight roots are never written by this module. */
export interface ApocalypseDemonessOriginals { site: CalamityDemonessSiteState; combatPlate: CalamityDemonessCombatPlate | null }
export type ApocalypseDemonessConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type ApocalypseDemonessWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'OPERATOR' | 'PARTICIPANT' | 'ABILITY';
const STEPS = ['RECOVER_ENERGY', 'APPROACH', 'BUY_RESIDUE', 'RECEIVE_RESIDUE', 'START_PULSE', 'INSTALL_PLATE', 'REMOVE_PLATE', 'RETURN_PLATE', 'PULSE_CONTAINMENT', 'APPLY_PULSE', 'ORDINARY_SEAL', 'BUY_LOAD', 'RECEIVE_LOAD', 'PREPARE_LOAD', 'MIRROR_BUFFER', 'APPLY_LOAD', 'ORDINARY_INSPECTION', 'OCCLUDE_WINDOW', 'WAIT_10', 'STOP_METHOD', 'EXIT_ROOM', 'LEAVE', 'ABORT', 'REFLECT'] as const;
export type ApocalypseDemonessActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: ApocalypseDemonessCaseId }
  | { type: 'PREPARE'; caseId: ApocalypseDemonessCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'WITHDRAW_CONSENT'; permission: Permission }
  | { type: 'WALK'; to: Exclude<CalamityDemonessLocation, 'YARD'> }
  | { type: typeof STEPS[number] };
export interface ApocalypseDemonessAbilityUse { attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null; state: ApocalypseDemonessWindow }
export interface ApocalypseDemonessResidue {
  id: 'AD1-RESIDUE-1'; ownerId: 'UD3-MARCUS'; quantity: 1; fictional: true; biological: false; origin: 'ADULT_WORKSHOP_CUSTODIAN';
  paidPennies: 50; boughtWeek: number; location: 'SUPPLIER' | 'BOX' | 'CUSTODIAN'; sealed: true; receivedAt: number | null;
  remaining: 0 | 1; consumed: 0 | 1; pendingAt: number | null; appliedAt: number | null; suppressed: 0 | 1; ordinarySealed: boolean;
}
export interface ApocalypseDemonessLoad {
  id: 'AD1-IMPACT-1'; ownerId: 'UD3-VERA'; paidPennies: 30; boughtWeek: number; location: 'SUPPLIER' | 'A';
  arrivedAt: number | null; preparedAt: number | null; remaining: 0 | 1; consumed: 0 | 1; appliedAt: number | null; safetyStop: 'ENGAGED';
}
export interface ApocalypseDemonessPlate {
  id: 'AD1-PLATE-1' | 'AD1-PLATE-2' | 'AD1-PLATE-3'; caseId: ApocalypseDemonessCaseId; ownerId: 'PLAYER'; quantity: 1; paidPennies: 20;
  boughtWeek: number; status: 'PLAYER' | 'INSTALLED' | 'RETURNED'; location: 'PLAYER' | 'A' | 'BOX' | 'CUSTODIAN'; charges: 0 | 1; wear: number; scorched: boolean;
  installedAt: number | null; removedAt: number | null; returnedAt: number | null;
}
export interface ApocalypseDemonessAttempt {
  week: number; method: Method; closed: boolean; result: 'NONE' | Method; elapsedSeconds: number;
  playerTravelMetres: number; veraTravelMetres: number; marcusTravelMetres: number; playerEnergySpent: number;
  penniesSpent: number; spiritualitySpent: number; mindSpent: number; healthSpent: number;
  permission: { owner: ApocalypseDemonessConsent; operator: ApocalypseDemonessConsent; participant: ApocalypseDemonessConsent; ability: ApocalypseDemonessConsent }; permissionVersion: number;
  siteAtStart: CalamityDemonessSiteState; approached: boolean; stopped: boolean; exited: boolean; visibleLine: boolean; occluded: boolean;
  plate: ApocalypseDemonessPlate; inspectionAt: number | null; pulseApplied: boolean; pulseSuppressed: boolean; ordinarySealed: boolean; boxScorchRecorded: boolean;
  loadApplied: boolean; impactDamage: number; impactReduction: number; containment: ApocalypseDemonessAbilityUse; buffer: ApocalypseDemonessAbilityUse;
}
export interface ApocalypseDemonessLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; invitationWeeks: number[]; attempts: ApocalypseDemonessAttempt[];
}
export interface ApocalypseDemonessLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface ApocalypseDemonessLifeMovement { actor: 'PLAYER' | 'VERA' | 'MARCUS'; from: CalamityDemonessLocation; to: CalamityDemonessLocation; mode: 'WALK'; metres: number; seconds: number; originalBody: true }
export interface ApocalypseDemonessLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: ApocalypseDemonessActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: ApocalypseDemonessLifeBudget; after: ApocalypseDemonessLifeBudget; finance: ApocalypseDemonessFinanceSnapshot; elapsedSeconds: number;
  playerWalkedMetres: number; veraWalkedMetres: number; marcusWalkedMetres: number; playerEnergySpent: number; veraEnergySpent: number; marcusEnergySpent: number; playerEnergyRecovered: number; moves: ApocalypseDemonessLifeMovement[];
  originalsBefore: ApocalypseDemonessOriginals; originalsAfter: ApocalypseDemonessOriginals;
  source: { caseId: ApocalypseDemonessCaseId; atSeconds: number; permissionVersion: number; siteId: 'CD2-GALLERY-ANNEX'; boxId: 'CD2-BOX'; mirrorAId: 'UD3-MIRROR-A'; mirrorBId: 'UD3-MIRROR-B';
    playerLocation: CalamityDemonessLocation; veraLocation: CalamityDemonessSiteState['vera']; marcusLocation: CalamityDemonessSiteState['marcus']; resourceId: 'AD1-RESIDUE-1' | 'AD1-IMPACT-1'; plateId: ApocalypseDemonessPlate['id']; mastery: number } | null;
}
export interface ApocalypseDemonessLifeState {
  sourceWeek: number | null; activeCase: ApocalypseDemonessCaseId | null; reflected: boolean; site: CalamityDemonessSiteState | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: CalamityDemonessLocation; playerTravelMetres: number; veraTravelMetres: number; marcusTravelMetres: number;
  residue: ApocalypseDemonessResidue | null; load: ApocalypseDemonessLoad | null;
  pending: { kind: 'CONTAINMENT' | 'BUFFER'; caseId: ApocalypseDemonessCaseId; createdAt: number; expiresAt: number; permissionVersion: number; resourceId: 'AD1-RESIDUE-1' | 'AD1-IMPACT-1'; plateId: ApocalypseDemonessPlate['id']; location: 'A' | 'BOX' } | null;
  cases: Record<ApocalypseDemonessCaseId, ApocalypseDemonessLifeCase>; journal: ApocalypseDemonessLifeReceipt[];
}
export interface ApocalypseDemonessLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ApocalypseDemonessActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface ApocalypseDemonessLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: ApocalypseDemonessCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  clockSeconds: number; elapsedSeconds: number; playerLocation: CalamityDemonessLocation; playerTravelMetres: number; veraTravelMetres: number; marcusTravelMetres: number;
  site: CalamityDemonessSiteState | null; residue: ApocalypseDemonessResidue | null; load: ApocalypseDemonessLoad | null; pending: ApocalypseDemonessLifeState['pending']; pendingUsable: boolean; pendingRemainingSeconds: number; currentAttempt: ApocalypseDemonessAttempt | null;
  cases: { id: ApocalypseDemonessCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; contactOpen: boolean; returned: boolean; attempts: ApocalypseDemonessAttempt[] }[];
  ledger: ApocalypseDemonessLifeReceipt[]; actions: ApocalypseDemonessLifeAction[];
}
const CONTAINMENT = 'assassin.s1.pulse-containment', BUFFER = 'assassin.s1.mirror-buffer';
const POSITION: Record<CalamityDemonessLocation, number> = { OUTSIDE: -2, ENTRY: 0, A: 4, BOX: 8, B: 12, YARD: -4 };
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 1;
const distance = (from: CalamityDemonessLocation, to: CalamityDemonessLocation) => Math.abs(POSITION[from] - POSITION[to]);
const budget = (s: SliceState): ApocalypseDemonessLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const validBudget = (v: unknown): v is ApocalypseDemonessLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
const freshUse = (): ApocalypseDemonessAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' });
const freshCase = (): ApocalypseDemonessLifeCase => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, invitationWeeks: [], attempts: [] });
function freshAttempt(week: number, method: Method, id: ApocalypseDemonessCaseId, p: CalamityDemonessSiteState): ApocalypseDemonessAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, veraTravelMetres: 0, marcusTravelMetres: 0, playerEnergySpent: 0,
    penniesSpent: 20, spiritualitySpent: 0, mindSpent: 0, healthSpent: 0, permission: { owner: 'UNASKED', operator: 'UNASKED', participant: 'UNASKED', ability: 'UNASKED' }, permissionVersion: 0,
    siteAtStart: structuredClone(p), approached: false, stopped: false, exited: false, visibleLine: true, occluded: false,
    plate: { id: id === 'pulse-containment' ? 'AD1-PLATE-1' : id === 'mirror-buffer' ? 'AD1-PLATE-2' : 'AD1-PLATE-3', caseId: id, ownerId: 'PLAYER', quantity: 1, paidPennies: 20, boughtWeek: week,
      status: 'PLAYER', location: 'PLAYER', charges: 1, wear: 0, scorched: false, installedAt: null, removedAt: null, returnedAt: null },
    inspectionAt: null, pulseApplied: false, pulseSuppressed: false, ordinarySealed: false, boxScorchRecorded: false, loadApplied: false, impactDamage: 0, impactReduction: 0, containment: freshUse(), buffer: freshUse() };
}
export function createApocalypseDemonessLifeState(): ApocalypseDemonessLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: null, clockSeconds: 0, elapsedSeconds: 0, playerLocation: 'OUTSIDE', playerTravelMetres: 0, veraTravelMetres: 0, marcusTravelMetres: 0,
    residue: null, load: null, pending: null, cases: { 'pulse-containment': freshCase(), 'mirror-buffer': freshCase(), 'withdrawn-window': freshCase() }, journal: [] };
}
/** Never fall back to historical life.site: after S2's encounter it is stale. */
export function apocalypseDemonessOriginalSnapshot(s: SliceState): ApocalypseDemonessOriginals {
  const site = s.apocalypseDemoness.life.site ?? s.calamityDemoness.encounter.currentSite;
  if (!site) throw new Error('尚无原附室的实际当前身体记录。');
  return { site: structuredClone(site), combatPlate: structuredClone(s.apocalypseDemoness.sourceScene?.originals.combatPlate ?? s.calamityDemoness.encounter.plate) };
}
function freshLife(week: number, originals: ApocalypseDemonessOriginals): ApocalypseDemonessLifeState {
  const l = createApocalypseDemonessLifeState(); l.sourceWeek = week; l.site = structuredClone(originals.site); l.clockSeconds = originals.site.clockSeconds; l.playerLocation = originals.site.playerLocation; return l;
}
function validSource(o: ApocalypseDemonessOriginals): boolean {
  const p = o?.site;
  return record(o) && shape(o, ['site', 'combatPlate']) && validateCalamityDemonessSiteState(p) && p.introducedWeek !== null && p.playerLocation === 'OUTSIDE' &&
    p.vera?.location === 'OUTSIDE' && p.marcus?.location === 'OUTSIDE' && p.vera.alive && p.marcus.alive && p.mirrorA !== null && p.mirrorB !== null &&
    !p.screen.active && p.box.state === 'CLOSED' && p.residue !== null && ['CONSUMED', 'HANDED_OVER'].includes(p.residue.status) && p.plates.every(x => x.status === 'RETURNED' && x.location === 'CUSTODIAN') &&
    (o.combatPlate === null || o.combatPlate.id === 'CD2-COMBAT-PLATE' && o.combatPlate.ownerId === 'PLAYER' && o.combatPlate.quantity === 1 && o.combatPlate.location === 'PLAYER' && o.combatPlate.initialCharges === 3 && integer(o.combatPlate.charges, 0, 3) && o.combatPlate.paidPennies === 20);
}
export function initializeApocalypseDemonessLifeState(s: SliceState): void {
  const source = s.apocalypseDemoness.sourceScene?.originals;
  if (!active(s) || !source || !validSource(source) || !same(s.apocalypseDemoness.life, createApocalypseDemonessLifeState()) || !same(apocalypseDemonessOriginalSnapshot(s), source)) throw new Error('须接续原附室的实际当前位置、精力、原镜和焦箱；晋升不会补货、治疗或搬动历史身体。');
  s.apocalypseDemoness.life = freshLife(s.week, source);
}
export function validateApocalypseDemonessActivityCommand(v: unknown): v is ApocalypseDemonessActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && APOCALYPSE_DEMONESS_CASE_IDS.includes(v.caseId as ApocalypseDemonessCaseId);
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && APOCALYPSE_DEMONESS_CASE_IDS.includes(v.caseId as ApocalypseDemonessCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'WITHDRAW_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'OPERATOR', 'PARTICIPANT', 'ABILITY'].includes(String(v.permission));
  if (v.type === 'WALK') return shape(v, ['type', 'to']) && ['ENTRY', 'A', 'BOX', 'B', 'OUTSIDE'].includes(String(v.to));
  return shape(v, ['type']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isApocalypseDemonessActivityCommand = validateApocalypseDemonessActivityCommand;
const current = (l: ApocalypseDemonessLifeState): ApocalypseDemonessAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const locked = (l: ApocalypseDemonessLifeState) => l.activeCase !== null || l.pending !== null;
export const hasApocalypseDemonessLifeLock = (s: SliceState): boolean => !!s.apocalypseDemoness?.life && locked(s.apocalypseDemoness.life);
export const apocalypseDemonessLifeHasLock = hasApocalypseDemonessLifeLock;
interface Model { life: ApocalypseDemonessLifeState; originals: ApocalypseDemonessOriginals }
interface Audit { date: PublicGameDate; revision: number; finance: ApocalypseDemonessFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isCheck = (c: ApocalypseDemonessActivityCommand) => c.type === 'PULSE_CONTAINMENT' || c.type === 'MIRROR_BUFFER';
const allOutside = (p: CalamityDemonessSiteState) => p.playerLocation === 'OUTSIDE' && p.vera?.location === 'OUTSIDE' && p.marcus?.location === 'OUTSIDE';
const permitted = (a: ApocalypseDemonessAttempt | null) => !!a && a.permission.owner === 'GRANTED' && a.permission.operator === 'GRANTED' && a.permission.participant === 'GRANTED';
const powerPermitted = (a: ApocalypseDemonessAttempt | null) => permitted(a) && a!.permission.ability === 'GRANTED' && a!.method === 'ABILITY' && !a!.stopped;
const target = (id: ApocalypseDemonessCaseId | null): 'A' | 'BOX' => id === 'mirror-buffer' ? 'A' : 'BOX';
function validPending(m: Model, kind: 'CONTAINMENT' | 'BUFFER'): boolean {
  const l = m.life, a = current(l), w = l.pending, p = m.originals.site;
  return !!w && w.kind === kind && w.caseId === l.activeCase && !!a && w.permissionVersion === a.permissionVersion && powerPermitted(a) && a.visibleLine &&
    p.playerLocation === w.location && p.vera?.location === 'ENTRY' && p.marcus?.location === 'ENTRY' && a.plate.status === 'INSTALLED' && a.plate.charges === 1 && a.plate.id === w.plateId &&
    p.clockSeconds + 1 < w.expiresAt && (kind === 'CONTAINMENT' ? l.residue?.remaining === 1 && l.residue.pendingAt !== null && l.residue.location === 'BOX' : l.load?.remaining === 1 && l.load.preparedAt !== null && p.mirrorA?.intact === true && p.mirrorB?.intact === true);
}
function masteryAt(l: ApocalypseDemonessLifeState, key: 'containment' | 'buffer'): number {
  return APOCALYPSE_DEMONESS_CASE_IDS.reduce((n, id) => n + (l.cases[id].status === 'RESOLVED' && l.cases[id].attempts.some(a => a[key].effects === 1) ? 8 : 0), 0);
}
function checkSpec(m: Model, c: ApocalypseDemonessActivityCommand): { ability: PublicCoreStatKey; difficulty: number; modifiers: { source: string; value: number }[] } {
  const containment = c.type === 'PULSE_CONTAINMENT';
  return { ability: containment ? 'knowledge' : 'will', difficulty: 18, modifiers: [{ source: containment ? '脉冲收束掌握' : '镜面缓冲掌握', value: Math.floor(masteryAt(m.life, containment ? 'containment' : 'buffer') / 10) }] };
}
function audit(s: SliceState, c: ApocalypseDemonessActivityCommand): Audit {
  const checked = isCheck(c), stat = c.type === 'MIRROR_BUFFER' ? 'will' : 'knowledge';
  return { date: structuredClone(s.date), revision: s.revision, finance: financeSnapshot(s), randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null,
    randomAfter: checked ? s.random.cursor + 1 : null, checkBase: checked ? s.character.coreStats[stat] : null, check: null };
}
function transition(input: Model, c: ApocalypseDemonessActivityCommand, week: number, outcome: PublicResolutionTier | null, before: ApocalypseDemonessLifeBudget, clock: Audit): { model: Model; receipt: ApocalypseDemonessLifeReceipt } | null {
  if (!validBudget(before)) return null;
  const m = structuredClone(input), l = m.life, o = m.originals, p = o.site, id = 'caseId' in c ? c.caseId : l.activeCase, r = id ? l.cases[id] : null;
  l.site = p; l.clockSeconds = p.clockSeconds; l.playerLocation = p.playerLocation;
  let a = current(l);
  const receipt: ApocalypseDemonessLifeReceipt = { week, date: structuredClone(clock.date), revision: clock.revision, finance: structuredClone(clock.finance), randomCursor: clock.randomCursor,
    randomBefore: clock.randomBefore, randomAfter: clock.randomAfter, checkBase: clock.checkBase, check: structuredClone(clock.check), command: structuredClone(c), outcome,
    before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, veraWalkedMetres: 0, marcusWalkedMetres: 0,
    playerEnergySpent: 0, veraEnergySpent: 0, marcusEnergySpent: 0, playerEnergyRecovered: 0, moves: [], originalsBefore: structuredClone(o), originalsAfter: structuredClone(o),
    source: isCheck(c) && a && id ? { caseId: id, atSeconds: p.clockSeconds, permissionVersion: a.permissionVersion, siteId: p.siteId, boxId: p.box.id, mirrorAId: 'UD3-MIRROR-A', mirrorBId: 'UD3-MIRROR-B',
      playerLocation: p.playerLocation, veraLocation: structuredClone(p.vera), marcusLocation: structuredClone(p.marcus), resourceId: c.type === 'PULSE_CONTAINMENT' ? 'AD1-RESIDUE-1' : 'AD1-IMPACT-1', plateId: a.plate.id,
      mastery: masteryAt(l, c.type === 'PULSE_CONTAINMENT' ? 'containment' : 'buffer') } : null };
  const pay = (actions: number, cash = 0, spirituality = 0, mind = 0) => { receipt.after.actions -= actions; receipt.after.cash -= cash; receipt.after.spirituality -= spirituality; receipt.after.mind -= mind; };
  const stop = (state: ApocalypseDemonessWindow) => { if (l.pending && a) { const u = l.pending.kind === 'CONTAINMENT' ? a.containment : a.buffer; if (u.effects === 0) u.state = state; l.pending = null; } };
  const walk = (actor: 'PLAYER' | 'VERA' | 'MARCUS', to: CalamityDemonessLocation) => {
    const adult = actor === 'VERA' ? p.vera : actor === 'MARCUS' ? p.marcus : null;
    const from = actor === 'PLAYER' ? p.playerLocation : adult!.location as CalamityDemonessLocation;
    if (from === to) return;
    stop('STOPPED'); const metres = distance(from, to); receipt.elapsedSeconds += metres;
    receipt.moves.push({ actor, from, to, mode: 'WALK', metres, seconds: metres, originalBody: true });
    if (actor === 'PLAYER') { p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres; receipt.playerWalkedMetres += metres; receipt.playerEnergySpent += metres; }
    else {
      if (to !== 'ENTRY' && to !== 'OUTSIDE') throw new Error('两位成人只沿约定入口步行。');
      adult!.location = to; adult!.travelMetres += metres; adult!.energy -= metres;
      p.actorMoves.push({ actorId: adult!.id, from, to, mode: 'WALK', metres, seconds: metres });
      if (actor === 'VERA') { receipt.veraWalkedMetres += metres; receipt.veraEnergySpent += metres; } else { receipt.marcusWalkedMetres += metres; receipt.marcusEnergySpent += metres; }
    }
  };
  const effort = () => { p.playerEnergy--; receipt.playerEnergySpent++; };
  const wearPlate = (scorched: boolean) => { a!.plate.charges = 0; a!.plate.wear += 5; if (scorched) a!.plate.scorched = true; };
  const removePlate = () => {
    if (a!.plate.status === 'INSTALLED') { a!.plate.status = 'PLAYER'; a!.plate.location = 'PLAYER'; a!.plate.removedAt = p.clockSeconds + receipt.elapsedSeconds + 1; receipt.elapsedSeconds++; }
  };
  const returnPlate = () => { a!.plate.status = 'RETURNED'; a!.plate.location = 'CUSTODIAN'; a!.plate.returnedAt = p.clockSeconds + receipt.elapsedSeconds + 1; receipt.elapsedSeconds++; };
  const ordinarySeal = () => {
    stop('STOPPED'); effort(); receipt.elapsedSeconds += 5; a!.ordinarySealed = true; a!.inspectionAt = p.clockSeconds + receipt.elapsedSeconds;
    if (l.residue?.pendingAt !== null && l.residue?.pendingAt !== undefined) {
      l.residue.remaining = 0; l.residue.consumed = 1; l.residue.pendingAt = null; l.residue.appliedAt = p.clockSeconds + receipt.elapsedSeconds; l.residue.ordinarySealed = true;
      a!.pulseApplied = true; a!.boxScorchRecorded = true; p.box.scorched = true;
      if (a!.plate.status === 'INSTALLED' && a!.plate.charges === 1) wearPlate(true);
    }
    if (l.residue?.location === 'BOX' && l.residue.remaining === 1) { l.residue.location = 'CUSTODIAN'; l.residue.ordinarySealed = true; }
    p.box.state = 'CLOSED'; if (a!.result === 'NONE') a!.result = 'ORDINARY';
  };
  const close = () => {
    a!.closed = true; r!.contactOpen = false; r!.returned = true; l.activeCase = null;
    for (const k of ['owner', 'operator', 'participant', 'ability'] as const) if (['UNASKED', 'GRANTED'].includes(a!.permission[k])) a!.permission[k] = 'CLOSED';
    if (p.vera!.mirrorConsent === 'GRANTED' || p.vera!.mirrorConsent === 'UNASKED') p.vera!.mirrorConsent = 'CLOSED';
    if (p.marcus!.boxConsent === 'GRANTED' || p.marcus!.boxConsent === 'UNASKED') p.marcus!.boxConsent = 'CLOSED';
  };
  const physical = !!a && !!r && r.status === 'ACTIVE' && !a.closed && a.week === week;
  const refused = () => !!a && Object.values(a.permission).some(v => v === 'DECLINED' || v === 'WITHDRAWN');
  const completed = () => !!a && (a.inspectionAt !== null || a.pulseApplied || a.loadApplied || refused() || a.stopped);
  const atTarget = () => p.playerLocation === target(id) && p.vera?.location === 'ENTRY' && p.marcus?.location === 'ENTRY';
  if (l.activeCase && (!physical || 'caseId' in c && c.caseId !== l.activeCase)) return null;
  switch (c.type) {
    case 'RECOVER_ENERGY':
      if (locked(l) || !allOutside(p) || p.playerEnergy >= 100) return null;
      pay(1, 15); receipt.elapsedSeconds = 60; receipt.playerEnergyRecovered = Math.min(20, 100 - p.playerEnergy); p.playerEnergy += receipt.playerEnergyRecovered; break;
    case 'OBSERVE': {
      const index = APOCALYPSE_DEMONESS_CASE_IDS.indexOf(c.caseId);
      if (locked(l) || !allOutside(p) || r!.status !== 'AVAILABLE' || index > 0 && l.cases[APOCALYPSE_DEMONESS_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 2; break;
    }
    case 'PREPARE':
      if (locked(l) || !allOutside(p) || r!.status !== 'OBSERVED' || r!.attempts.length !== 0 || p.playerEnergy < distance('OUTSIDE', target(id)) * 2 + 1 || p.vera!.energy < 4 || p.marcus!.energy < 4) return null;
      pay(1, 20); receipt.elapsedSeconds = 2; a = freshAttempt(week, c.method, c.caseId, p); r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; r!.invitationWeeks.push(week); l.activeCase = c.caseId;
      p.vera!.mirrorConsent = 'UNASKED'; p.marcus!.boxConsent = 'UNASKED'; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'WITHDRAW_CONSENT': {
      if (!physical || a!.exited) return null;
      const key = c.permission.toLowerCase() as keyof ApocalypseDemonessAttempt['permission'];
      if (c.type === 'WITHDRAW_CONSENT' ? a!.permission[key] !== 'GRANTED' : a!.permission[key] !== 'UNASKED') return null;
      if (c.type === 'CONSENT' && (a!.stopped || refused() || !p.vera!.willing || !p.marcus!.willing || key === 'ability' && a!.method !== 'ABILITY')) return null;
      a!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; a!.permissionVersion++;
      if (key === 'owner') p.vera!.mirrorConsent = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'CLOSED' : 'WITHDRAWN';
      if (key === 'operator') p.marcus!.boxConsent = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'CLOSED' : 'WITHDRAWN';
      if (c.type === 'CONSENT') receipt.elapsedSeconds = 1; else { stop('STOPPED'); a!.stopped = true; }
      break;
    }
    case 'APPROACH':
      if (!physical || a!.approached || !permitted(a) || !allOutside(p)) return null;
      walk('VERA', 'ENTRY'); walk('MARCUS', 'ENTRY'); walk('PLAYER', target(id)); a!.approached = true; break;
    case 'WALK':
      if (!physical || !a!.approached || a!.exited || p.playerLocation === c.to) return null;
      walk('PLAYER', c.to); break;
    case 'BUY_RESIDUE':
      if (!physical || id === 'mirror-buffer' || !permitted(a) || !atTarget() || l.residue || a!.stopped) return null;
      pay(0, 50); receipt.elapsedSeconds = 1; a!.penniesSpent += 50;
      l.residue = { id: 'AD1-RESIDUE-1', ownerId: 'UD3-MARCUS', quantity: 1, fictional: true, biological: false, origin: 'ADULT_WORKSHOP_CUSTODIAN', paidPennies: 50, boughtWeek: week, location: 'SUPPLIER', sealed: true,
        receivedAt: null, remaining: 1, consumed: 0, pendingAt: null, appliedAt: null, suppressed: 0, ordinarySealed: false }; break;
    case 'RECEIVE_RESIDUE':
      if (!physical || id === 'mirror-buffer' || !permitted(a) || !atTarget() || !l.residue || l.residue.remaining !== 1 || !['SUPPLIER', 'CUSTODIAN'].includes(l.residue.location) || a!.stopped) return null;
      receipt.elapsedSeconds = 3; l.residue.location = 'BOX'; l.residue.receivedAt = p.clockSeconds + 3; break;
    case 'INSTALL_PLATE':
      if (!physical || !permitted(a) || !atTarget() || a!.stopped || a!.plate.status !== 'PLAYER' || a!.plate.installedAt !== null ||
        (id === 'mirror-buffer' && (!p.mirrorA?.intact || !p.mirrorB?.intact))) return null;
      a!.plate.status = 'INSTALLED'; a!.plate.location = target(id); a!.plate.installedAt = p.clockSeconds + 1; receipt.elapsedSeconds = 1; break;
    case 'START_PULSE':
      if (!physical || id === 'mirror-buffer' || !permitted(a) || !atTarget() || a!.stopped || a!.plate.status !== 'INSTALLED' || a!.plate.charges !== 1 || !l.residue || l.residue.location !== 'BOX' || l.residue.remaining !== 1 || l.residue.pendingAt !== null || l.residue.appliedAt !== null || p.box.state !== 'CLOSED') return null;
      l.residue.pendingAt = p.clockSeconds + 1; receipt.elapsedSeconds = 1; break;
    case 'PULSE_CONTAINMENT': case 'MIRROR_BUFFER': {
      const containment = c.type === 'PULSE_CONTAINMENT', use = containment ? a?.containment : a?.buffer;
      if (!physical || !powerPermitted(a) || !atTarget() || !a!.visibleLine || !use || use.attempts !== 0 || l.pending || a!.plate.status !== 'INSTALLED' || a!.plate.charges !== 1 ||
        (containment ? id === 'mirror-buffer' || l.residue?.remaining !== 1 || l.residue.pendingAt === null || l.residue.location !== 'BOX' : id !== 'mirror-buffer' || l.load?.remaining !== 1 || l.load.preparedAt === null || !p.mirrorA?.intact || !p.mirrorB?.intact)) return null;
      pay(0, 0, 8, 2); receipt.elapsedSeconds = 1; a!.spiritualitySpent += 8; a!.mindSpent += 2;
      use.attempts = 1; use.tier = outcome; use.successes = success(outcome) ? 1 : 0; use.state = success(outcome) ? 'ACTIVE' : 'FAILED';
      if (success(outcome)) l.pending = { kind: containment ? 'CONTAINMENT' : 'BUFFER', caseId: id!, createdAt: p.clockSeconds + 1, expiresAt: p.clockSeconds + 21, permissionVersion: a!.permissionVersion,
        resourceId: containment ? 'AD1-RESIDUE-1' : 'AD1-IMPACT-1', plateId: a!.plate.id, location: target(id) }; break;
    }
    case 'APPLY_PULSE': {
      if (!physical || id === 'mirror-buffer' || !permitted(a) || !atTarget() || a!.stopped || a!.pulseApplied || a!.plate.status !== 'INSTALLED' || a!.plate.charges !== 1 || l.residue?.remaining !== 1 || l.residue.pendingAt === null || l.residue.location !== 'BOX') return null;
      const helped = validPending(m, 'CONTAINMENT'); effort(); receipt.elapsedSeconds = 1; l.residue.remaining = 0; l.residue.consumed = 1; l.residue.pendingAt = null; l.residue.appliedAt = p.clockSeconds + 1; l.residue.suppressed = helped ? 1 : 0;
      wearPlate(true); p.box.scorched = true; a!.pulseApplied = true; a!.pulseSuppressed = helped; a!.boxScorchRecorded = true; a!.result = helped ? 'ABILITY' : 'ORDINARY';
      if (helped) { a!.containment.effects = 1; a!.containment.state = 'APPLIED'; } stop('APPLIED'); break;
    }
    case 'ORDINARY_SEAL':
      if (!physical || id === 'mirror-buffer' || p.playerLocation !== 'BOX' || a!.ordinarySealed) return null;
      ordinarySeal(); break;
    case 'BUY_LOAD':
      if (!physical || id !== 'mirror-buffer' || !permitted(a) || !atTarget() || l.load || a!.stopped) return null;
      pay(0, 30); receipt.elapsedSeconds = 1; a!.penniesSpent += 30;
      l.load = { id: 'AD1-IMPACT-1', ownerId: 'UD3-VERA', paidPennies: 30, boughtWeek: week, location: 'SUPPLIER', arrivedAt: null, preparedAt: null, remaining: 1, consumed: 0, appliedAt: null, safetyStop: 'ENGAGED' }; break;
    case 'RECEIVE_LOAD':
      if (!physical || id !== 'mirror-buffer' || !permitted(a) || !atTarget() || !l.load || l.load.location !== 'SUPPLIER' || a!.stopped) return null;
      receipt.elapsedSeconds = 3; l.load.location = 'A'; l.load.arrivedAt = p.clockSeconds + 3; break;
    case 'PREPARE_LOAD':
      if (!physical || id !== 'mirror-buffer' || !permitted(a) || !atTarget() || !l.load || l.load.location !== 'A' || l.load.arrivedAt === null || l.load.preparedAt !== null || a!.stopped) return null;
      receipt.elapsedSeconds = 1; l.load.preparedAt = p.clockSeconds + 1; break;
    case 'APPLY_LOAD': {
      if (!physical || id !== 'mirror-buffer' || !permitted(a) || !atTarget() || a!.stopped || a!.loadApplied || !l.load || l.load.location !== 'A' || l.load.preparedAt === null || l.load.remaining !== 1 ||
        a!.plate.status !== 'INSTALLED' || a!.plate.charges !== 1 || !p.mirrorA?.intact || !p.mirrorB?.intact || before.health <= 6) return null;
      const helped = validPending(m, 'BUFFER'); effort(); receipt.elapsedSeconds = 1; l.load.remaining = 0; l.load.consumed = 1; l.load.appliedAt = p.clockSeconds + 1; wearPlate(false);
      a!.loadApplied = true; a!.impactReduction = helped ? 3 : 0; a!.impactDamage = 6 - a!.impactReduction; receipt.after.health -= a!.impactDamage; a!.healthSpent += a!.impactDamage; a!.result = helped ? 'ABILITY' : 'ORDINARY';
      if (helped) { a!.buffer.effects = 1; a!.buffer.state = 'APPLIED'; } stop('APPLIED'); break;
    }
    case 'ORDINARY_INSPECTION':
      if (!physical || !atTarget() || !permitted(a) || a!.inspectionAt !== null || a!.pulseApplied || a!.loadApplied || l.residue?.pendingAt !== null && l.residue?.pendingAt !== undefined) return null;
      stop('STOPPED'); effort(); receipt.elapsedSeconds = 1; a!.inspectionAt = p.clockSeconds + 1; a!.result = 'ORDINARY'; break;
    case 'REMOVE_PLATE':
      if (!physical || a!.plate.status !== 'INSTALLED' || p.playerLocation !== a!.plate.location || l.pending || l.residue?.pendingAt !== null && l.residue?.pendingAt !== undefined) return null;
      removePlate(); break;
    case 'RETURN_PLATE':
      if (!physical || !allOutside(p) || !a!.exited || a!.plate.status !== 'PLAYER' || l.pending) return null;
      returnPlate(); break;
    case 'OCCLUDE_WINDOW':
      if (!physical || !l.pending || a!.occluded || !atTarget()) return null;
      a!.occluded = true; a!.visibleLine = false; receipt.elapsedSeconds = 1; stop('STOPPED'); break;
    case 'WAIT_10':
      if (!physical || !l.pending) return null;
      receipt.elapsedSeconds = 10; break;
    case 'STOP_METHOD':
      if (!physical || a!.stopped) return null;
      stop('STOPPED'); a!.stopped = true; break;
    case 'EXIT_ROOM':
      if (!physical || a!.exited || !completed() || l.pending || a!.plate.status === 'INSTALLED' || l.residue?.location === 'BOX' && l.residue.remaining === 1) return null;
      walk('VERA', 'OUTSIDE'); walk('MARCUS', 'OUTSIDE'); walk('PLAYER', 'OUTSIDE'); a!.exited = true; break;
    case 'LEAVE':
      if (!physical || !a!.exited || !allOutside(p) || l.pending || !completed() || a!.plate.status !== 'RETURNED' || l.residue?.location === 'BOX' && l.residue.remaining === 1) return null;
      if (a!.result === 'NONE') a!.result = 'ORDINARY'; r!.result = a!.result; r!.status = 'EXAMINED'; receipt.elapsedSeconds = 1; close(); break;
    case 'ABORT':
      if (!physical) return null;
      stop('STOPPED'); a!.stopped = true;
      if (l.residue?.pendingAt !== null && l.residue?.pendingAt !== undefined) { walk('PLAYER', 'BOX'); ordinarySeal(); }
      if (a!.plate.status === 'INSTALLED') { walk('PLAYER', a!.plate.location as 'A' | 'BOX'); removePlate(); }
      if (l.residue?.location === 'BOX' && l.residue.remaining === 1) { walk('PLAYER', 'BOX'); if (!a!.ordinarySealed) ordinarySeal(); }
      walk('VERA', 'OUTSIDE'); walk('MARCUS', 'OUTSIDE'); walk('PLAYER', 'OUTSIDE'); a!.exited = true;
      if (a!.plate.status !== 'RETURNED') returnPlate(); if (a!.result === 'NONE') a!.result = 'ORDINARY'; r!.result = a!.result; r!.status = 'EXAMINED'; close(); break;
    case 'REPORT':
      if (locked(l) || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !allOutside(p)) return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 2; break;
    case 'REFLECT':
      if (locked(l) || l.reflected || !APOCALYPSE_DEMONESS_CASE_IDS.every(key => l.cases[key].status === 'RESOLVED') || !allOutside(p)) return null;
      pay(1); l.reflected = true; receipt.elapsedSeconds = 2; break;
  }
  if (!validBudget(receipt.after) || !integer(p.playerEnergy, 0, 100) || !integer(p.vera!.energy, 0, 100) || !integer(p.marcus!.energy, 0, 100)) return null;
  // Every reachable case retains an affordable ordinary return, including a real
  // pending pulse's one-energy cleanup. Weekly REST never changes this reserve.
  const unsettled = !!l.residue && l.residue.location === 'BOX' && l.residue.remaining === 1;
  const installedAt = a?.plate.status === 'INSTALLED' ? a.plate.location as 'A' | 'BOX' : null;
  const reserve = unsettled ? distance(p.playerLocation, 'BOX') + 1 + distance('BOX', 'OUTSIDE') : installedAt ? distance(p.playerLocation, installedAt) + distance(installedAt, 'OUTSIDE') : distance(p.playerLocation, 'OUTSIDE');
  if (p.playerEnergy < reserve || p.vera!.energy < distance(p.vera!.location as CalamityDemonessLocation, 'OUTSIDE') || p.marcus!.energy < distance(p.marcus!.location as CalamityDemonessLocation, 'OUTSIDE')) return null;
  p.clockSeconds += receipt.elapsedSeconds; l.clockSeconds = p.clockSeconds; l.playerLocation = p.playerLocation; l.elapsedSeconds += receipt.elapsedSeconds;
  l.playerTravelMetres += receipt.playerWalkedMetres; l.veraTravelMetres += receipt.veraWalkedMetres; l.marcusTravelMetres += receipt.marcusWalkedMetres;
  if (a) { a.elapsedSeconds += receipt.elapsedSeconds; a.playerTravelMetres += receipt.playerWalkedMetres; a.veraTravelMetres += receipt.veraWalkedMetres; a.marcusTravelMetres += receipt.marcusWalkedMetres; a.playerEnergySpent += receipt.playerEnergySpent; }
  if (l.pending && l.clockSeconds >= l.pending.expiresAt) stop('EXPIRED');
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}

function financeSnapshot(s: ApocalypseDemonessFinanceSnapshot): ApocalypseDemonessFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
function validFinance(v: unknown, week: number): v is ApocalypseDemonessFinanceSnapshot {
  if (!record(v) || !shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) || !integer(v.weeklyBudget, 1, 100) ||
    typeof v.lifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.lifeTier) || typeof v.nextLifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.nextLifeTier) ||
    !integer(v.missedWeeks) || !['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) || !Array.isArray(v.debts)) return false;
  return new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d => record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
    typeof d.id === 'string' && d.id.length > 0 && typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** The same ordinary BILL/DEBTS resolver used by the main weekly pulse. An open
 * practice never advances the week, even after its invitation spends the last AP. */
function lifeBoundary(e: ApocalypseDemonessLifeReceipt, isLocked: boolean) {
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
function completedLifeBudgetMatches(s: SliceState, e: ApocalypseDemonessLifeReceipt, isLocked: boolean): boolean {
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
function replayLife(l: ApocalypseDemonessLifeState, s: SliceState): Model | null {
  const source = s.apocalypseDemoness.sourceScene?.originals;
  if (!source || !validSource(source) || l.sourceWeek === null || !Array.isArray(l.journal) || l.journal.length > 250) return null;
  let model: Model = { life: freshLife(l.sourceWeek, source), originals: structuredClone(source) };
  let previous: ApocalypseDemonessLifeReceipt | null = null, previousLocked = false, lastWeek = l.sourceWeek, lastRandomAfter = s.apocalypseDemoness.sourceScene!.random.cursor;
  const combatEvents = apocalypseDemonessEncounterOriginalEvents(s);
  if (!Array.isArray(combatEvents)) return null;
  const merged = [
    ...l.journal.map(entry => ({ order: entry.revision, life: entry, combat: null })),
    ...combatEvents.map(entry => ({ order: entry.revision - 1, life: null, combat: entry })),
  ].sort((a, b) => a.order - b.order);
  if (new Set(merged.map(e => e.order)).size !== merged.length) return null;
  for (const event of merged) {
    if (event.combat) {
      const e = event.combat, from = model.originals.site, to = e.after?.site;
      if (locked(model.life) || !model.life.reflected || !integer(e.revision, s.apocalypseDemoness.sourceScene!.revision, s.revision) || !integer(e.week, lastWeek, s.week) || !same(e.before, model.originals) || !to ||
        !integer(to.clockSeconds, from.clockSeconds) || !integer(to.playerTravelMetres, from.playerTravelMetres) || !integer(to.playerEnergy, 0, from.playerEnergy) || !same(e.after.combatPlate, e.before.combatPlate) ||
        !same(to, { ...from, clockSeconds: to.clockSeconds, playerTravelMetres: to.playerTravelMetres, playerEnergy: to.playerEnergy }) || to.playerTravelMetres - from.playerTravelMetres !== from.playerEnergy - to.playerEnergy) return null;
      model.originals = structuredClone(e.after); model.life.site = structuredClone(to); model.life.clockSeconds = to.clockSeconds; model.life.playerLocation = to.playerLocation;
      previous = null; lastWeek = e.week; continue;
    }
    const entry = event.life!;
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'elapsedSeconds', 'playerWalkedMetres', 'veraWalkedMetres', 'marcusWalkedMetres', 'playerEnergySpent', 'veraEnergySpent', 'marcusEnergySpent', 'playerEnergyRecovered', 'moves', 'originalsBefore', 'originalsAfter', 'source']) || !validateApocalypseDemonessActivityCommand(entry.command) ||
      !integer(entry.week, lastWeek, s.week) || !validFinance(entry.finance, entry.week) || !integer(entry.revision, previous ? previous.revision + 1 : s.apocalypseDemoness.sourceScene!.revision, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
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
export function apocalypseDemonessExpectedOriginals(s: SliceState): ApocalypseDemonessOriginals | null {
  const l = s.apocalypseDemoness.life;
  if (l.sourceWeek === null) return s.apocalypseDemoness.sourceScene ? structuredClone(s.apocalypseDemoness.sourceScene.originals) : null;
  const replay = replayLife(l, s); return replay ? structuredClone(replay.originals) : null;
}
export function apocalypseDemonessLifeMasteryGains(s: SliceState): Record<typeof CONTAINMENT | typeof BUFFER, number> {
  return { [CONTAINMENT]: masteryAt(s.apocalypseDemoness.life, 'containment'), [BUFFER]: masteryAt(s.apocalypseDemoness.life, 'buffer') };
}
export const apocalypseDemonessMasteryGains = apocalypseDemonessLifeMasteryGains;
function oldSceneOpen(s: SliceState): boolean {
  return s.calamityDemoness.life.activeCase !== null || Object.values(s.calamityDemoness.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.calamityDemoness.preparedWeek !== null ||
    ['READY', 'FIGHTING'].includes(s.calamityDemoness.encounter.status) || s.unagingDemoness.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.unagingDemoness.encounter.status);
}
/** Structural guard only. Authenticity comes from the bounded exact life and
 * encounter folds; the S2 validator is used solely for immutable source input. */
export function validApocalypseDemonessOriginals(v: unknown): v is ApocalypseDemonessOriginals {
  try {
    if (!record(v) || !shape(v, ['site', 'combatPlate']) || !record(v.site)) return false;
    const p = v.site as unknown as CalamityDemonessSiteState;
    if (!shape(p, ['siteId', 'introducedWeek', 'introducedDate', 'clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy', 'source', 'vera', 'marcus', 'mirrorA', 'mirrorB', 'load', 'box', 'residue', 'screen', 'plates', 'actorMoves']) ||
      p.siteId !== 'CD2-GALLERY-ANNEX' || !integer(p.introducedWeek, 1) || !isValidGameDate(p.introducedDate) || !integer(p.clockSeconds) || !integer(p.playerEnergy, 0, 100) || !integer(p.playerTravelMetres) || !Object.hasOwn(POSITION, p.playerLocation) || !p.source) return false;
    for (const key of ['vera', 'marcus'] as const) {
      const a = p[key], source = p.source.snapshot[key];
      if (!a || !shape(a, ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'mirrorConsent', 'boxConsent']) || !['ENTRY', 'OUTSIDE'].includes(a.location) || !integer(a.energy, 0, 100) || !integer(a.travelMetres, 0, 100) || a.energy + a.travelMetres !== 100 ||
        !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(a.mirrorConsent) || !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(a.boxConsent) ||
        !same(a, { ...source, location: a.location, energy: a.energy, travelMetres: a.travelMetres, mirrorConsent: a.mirrorConsent, boxConsent: a.boxConsent })) return false;
    }
    if (!same(p.mirrorA, p.source.snapshot.mirrorA) || !same(p.mirrorB, p.source.snapshot.mirrorB) || !Array.isArray(p.actorMoves) || p.actorMoves.length > 40 ||
      !p.actorMoves.every(move => shape(move, ['from', 'to', 'mode', 'metres', 'seconds', 'actorId']) && ['UD3-VERA', 'UD3-MARCUS'].includes(move.actorId) && integer(move.metres, 1, 24) && move.seconds === move.metres)) return false;
    if (!record(p.load) || !shape(p.load, ['id', 'location', 'enclosed', 'initialForce', 'remainingLoads', 'appliedLoads', 'finalForce', 'bufferedForce']) || p.load.id !== 'CD2-TEST-LOAD' || p.load.remainingLoads + p.load.appliedLoads !== 1 ||
      !record(p.box) || !shape(p.box, ['id', 'ownerId', 'location', 'state', 'scorched', 'pulses', 'pulseSeconds', 'handovers']) || p.box.id !== 'CD2-BOX' || !['CLOSED', 'OPEN'].includes(p.box.state) ||
      !same(p.screen, { active: false, mirrorId: 'UD3-MIRROR-A', expiresAt: null, plateId: null }) || !Array.isArray(p.plates) || p.plates.length !== 3 || !p.plates.every(plate => plate.status === 'RETURNED' && plate.location === 'CUSTODIAN')) return false;
    if (v.combatPlate !== null) {
      const plate = v.combatPlate;
      if (!record(plate) || !shape(plate, ['id', 'ownerId', 'quantity', 'location', 'initialCharges', 'charges', 'paidPennies']) || !integer(plate.charges, 0, 3) ||
        !same(plate, { id: 'CD2-COMBAT-PLATE', ownerId: 'PLAYER', quantity: 1, location: 'PLAYER', initialCharges: 3, charges: plate.charges, paidPennies: 20 })) return false;
    }
    return true;
  } catch { return false; }
}
export const validateApocalypseDemonessOriginals = validApocalypseDemonessOriginals;
export function validateApocalypseDemonessLifeState(s: SliceState): boolean {
  try {
    const l = s.apocalypseDemoness?.life;
    if (!record(l) || !shape(l, Object.keys(createApocalypseDemonessLifeState())) || !Array.isArray(l.journal) || !record(l.cases) || !shape(l.cases, APOCALYPSE_DEMONESS_CASE_IDS)) return false;
    if (s.apocalypseDemoness.promotionWeek === null) return same(l, createApocalypseDemonessLifeState());
    const source = s.apocalypseDemoness.sourceScene?.originals, history = s.apocalypseDemoness.sourceHistory;
    if (!source || !history || !validSource(source) || !integer(l.sourceWeek, 1, s.week) || l.sourceWeek !== s.apocalypseDemoness.promotionWeek ||
      !same(source.site, history.calamityDemoness.encounter.currentSite) || !same(source.combatPlate, history.calamityDemoness.encounter.plate)) return false;
    for (const key of ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness', 'calamityDemoness'] as const) if (!same(s[key], history[key])) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l, replay.life) || !same(apocalypseDemonessOriginalSnapshot(s), replay.originals) || !validApocalypseDemonessOriginals(replay.originals)) return false;
    const gains = apocalypseDemonessLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of APOCALYPSE_DEMONESS_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED';
      if (s.seer.completedSources.filter(x => x === `apocalypse-demoness-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'apocalypse-demoness-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting || (s.progression.mastery[CONTAINMENT] ?? 0) < gains[CONTAINMENT] || (s.progression.mastery[BUFFER] ?? 0) < gains[BUFFER]) return false;
    const last = l.journal.at(-1);
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.apocalypseDemoness.preparedWeek !== null ||
      ['READY', 'FIGHTING'].includes(s.apocalypseDemoness.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !completedLifeBudgetMatches(s, last, locked(l))) return false;
    return true;
  } catch { return false; }
}
export const validateApocalypseDemonessLife = validateApocalypseDemonessLifeState;
export function blockApocalypseDemonessLife(s: SliceState, c: ApocalypseDemonessActivityCommand): string | null {
  if (!validateApocalypseDemonessActivityCommand(c)) return '现场命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为末日魔女。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (oldSceneOpen(s) || s.apocalypseDemoness.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.apocalypseDemoness.encounter.status)) return '先收束开放的旧现场、晋升准备或遭遇。';
  if (!validateApocalypseDemonessLifeState(s)) return '原人、原物、当前成本或实际记录不一致。';
  const model = replayLife(s.apocalypseDemoness.life, s);
  if (!model || !transition(model, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先核对本案当前许可、位置、有限物资与返程精力。旧残留、负载和护片不可补回；每案只能尝试一次，普通收尾不耗行动。';
  return null;
}
export const blockApocalypseDemonessActivity = blockApocalypseDemonessLife;
export function applyApocalypseDemonessLifeCommand(s: SliceState, c: ApocalypseDemonessActivityCommand, ctx: SeerContext): void {
  const reason = blockApocalypseDemonessLife(s, c); if (reason) throw new Error(reason);
  const model = replayLife(s.apocalypseDemoness.life, s)!, before = budget(s), clock = audit(s, c); let check: PublicCheckResult | null = null;
  if (isCheck(c)) { const spec = checkSpec(model, c); check = resolveNormalCheck({ ...spec, baseAbility: clock.checkBase!, roll: ctx.roll(1, 100) }); s.lastCheck = check; clock.check = structuredClone(check); clock.randomAfter = s.random.cursor; }
  const next = transition(model, c, s.week, check?.tier ?? null, before, clock);
  if (!next) throw new Error('本次真实结果不能改变已记录的现场前提。');
  const l = next.model.life; l.journal.push(next.receipt); s.apocalypseDemoness.life = l;
  Object.assign(s, { health: next.receipt.after.health, mind: next.receipt.after.mind, spirituality: next.receipt.after.spirituality, cash: next.receipt.after.cash, actionsRemaining: next.receipt.after.actions });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`apocalypse-demoness-case:${c.caseId}`);
    for (const [ability, key] of [[CONTAINMENT, 'containment'], [BUFFER, 'buffer']] as const) if (l.cases[c.caseId].attempts.some(a => a[key].effects === 1)) s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8);
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('apocalypse-demoness-reflection'); }
  ctx.note(LABELS[c.type], `${DETAILS[c.type]}${check ? `本次${success(check.tier) ? '成功' : '失败'}，检定和实付代价均保留。` : ''}本步实际经过${next.receipt.elapsedSeconds}秒；本人步行${next.receipt.playerWalkedMetres}米，维瑞娜${next.receipt.veraWalkedMetres}米，马库斯${next.receipt.marcusWalkedMetres}米。`);
}
export const applyApocalypseDemonessActivity = applyApocalypseDemonessLifeCommand;
export const applyApocalypseDemonessActivityCommand = applyApocalypseDemonessLifeCommand;
const CASES = [
  { id: 'pulse-containment', title: '原焦箱与一份新封存物', story: '原箱保留焦痕。另付50便士购买一份虚构非生物残留，真实送达原箱后只产生一次待处理脉冲；脉冲收束最多抑制这一次，不清除已有损伤。' },
  { id: 'mirror-buffer', title: '原镜前的一次本人受力', story: '重新征得原镜主人许可，另付30便士取得一次新负载。镜面缓冲只减轻下一次可见的本人受力；原镜、旧负载与旧护片都不会补回。' },
  { id: 'withdrawn-window', title: '当前许可撤回后的普通收尾', story: '同一成人可以拒绝或撤回本案许可。立即停止新的施术；如仍有真实待处理脉冲，普通封存后才卸片离开。已经用尽的残留不会再生，也不会为撤回虚构第二次施术。' },
] as const;
const LABELS: Record<ApocalypseDemonessActivityCommand['type'], string> = {
  RECOVER_ENERGY: '在室外实付休整并恢复20精力', OBSERVE: '核对原人、原物与本案普通做法', PREPARE: '实付20便士领取本案唯一新护片',
  CONSENT: '询问并记录本案当前同意', DECLINE_CONSENT: '尊重这一项拒绝', WITHDRAW_CONSENT: '撤回这一项当前许可', APPROACH: '原成人走到入口，本人走到本案原物前', WALK: '沿普通路线实际步行',
  BUY_RESIDUE: '实付50便士购入唯一新非生物残留', RECEIVE_RESIDUE: '等候同一封装残留实际送达原箱', START_PULSE: '确认同一封装来源的一次待处理脉冲',
  INSTALL_PLATE: '亲手安装本案新护片', REMOVE_PLATE: '亲手卸下同一护片', RETURN_PLATE: '把同一护片交回保管者', PULSE_CONTAINMENT: '尝试脉冲收束', APPLY_PULSE: '实际处理这一次有限脉冲', ORDINARY_SEAL: '以普通方法安全封存原箱',
  BUY_LOAD: '实付30便士购入一次新负载', RECEIVE_LOAD: '等候同一新负载实际送达', PREPARE_LOAD: '准备已经送达的一次新负载', MIRROR_BUFFER: '尝试镜面缓冲', APPLY_LOAD: '施加这一次可见的本人受力', ORDINARY_INSPECTION: '用普通检查记录当前状况',
  OCCLUDE_WINDOW: '遮挡本案视线并使窗口失效', WAIT_10: '实际等待十秒', STOP_METHOD: '停止本次未用能力', EXIT_ROOM: '成人与本人沿普通道路实际离场', LEAVE: '结束已经收尾的本案', ABORT: '停止、真实清理并普通离场', REPORT: '如实报告本案结果', REFLECT: '反思有限效果、真实损耗与当前许可',
};
const DETAILS: Record<ApocalypseDemonessActivityCommand['type'], string> = {
  RECOVER_ENERGY: '本人在室外实付15便士与1行动，休整60秒恢复20精力，至多100；原成人不会凭空恢复。', OBSERVE: '核对当前同一原镜、焦箱与成人；旧残留、旧负载和旧护片都保留实际余量与位置。', PREPARE: '实付20便士与1行动，领取本案唯一一片一次护片；重新逐项询问本案许可。',
  CONSENT: '分别询问维瑞娜的原镜用途、马库斯的原箱操作、两人的当次路线及这一次能力用途；旧同意不沿用。', DECLINE_CONSENT: '如实记录拒绝，停止新施术，普通归还与退出仍开放。', WITHDRAW_CONSENT: '当前许可撤回，未用窗口立即停止；已经发生的损耗、付款与时间不会撤销。', APPROACH: '维瑞娜和马库斯各从室外走2米到入口，本人走到原镜A或原箱；每米各耗1精力和1秒。', WALK: '本人按实际位置普通步行；移动立即使尚未应用的窗口失效，并预留清理与返程精力。',
  BUY_RESIDUE: '实付50便士取得独立编号AD1-RESIDUE-1的一份虚构非生物封装物；全程只有一次脉冲。', RECEIVE_RESIDUE: '同一封装物经过3秒实际送达原箱，交付记录与已支付成本保留。', START_PULSE: '同一封装物出现一次真实待处理脉冲，既不会补充旧残留，也不能重复启动已用尽来源。',
  INSTALL_PLATE: '在当前许可和原物位置前安装已实付的本案护片，旧片不被取用。', REMOVE_PLATE: '窗口与待处理脉冲都已收束，在原位亲手卸下同一护片，磨损和焦痕继续保留。', RETURN_PLATE: '本人已普通走到室外，将本案同一护片交回保管者；用尽的护片也须归还。',
  PULSE_CONTAINMENT: '实付8灵性与2精神，以知识18检定，经过1秒；成功只开启最多20秒的一次脉冲收束，未实际应用没有掌握收益。', APPLY_PULSE: '真实消费新来源唯一一次脉冲，耗1精力和1秒，护片消耗一次并磨损5、留下焦痕；原箱旧焦痕不消失。', ORDINARY_SEAL: '以1精力和5秒普通封存；如有真实待处理脉冲就实际消耗该脉冲和已装护片，没有新能力收益。',
  BUY_LOAD: '实付30便士购入独立编号AD1-IMPACT-1的一次新负载，旧负载仍保留原余量。', RECEIVE_LOAD: '新负载经过3秒实际送到原镜A前。', PREPARE_LOAD: '花1秒准备已经到场的一次负载，安全挡始终在位。', MIRROR_BUFFER: '实付8灵性与2精神，以意志18检定，经过1秒；成功最多20秒，只减少下一次可见本人受力的3点伤害。', APPLY_LOAD: '真实消耗唯一新负载和本案新护片的一次，护片磨损5；耗1精力，通常受6伤害，有效缓冲减少3点，仍会受伤。', ORDINARY_INSPECTION: '本人用1精力和1秒如实检查，不虚构脉冲、负载或能力应用。',
  OCCLUDE_WINDOW: '本案遮挡使视线立即失效；既付能力成本不退还，原镜并未损坏。', WAIT_10: '现场时钟实际推进10秒；只在尚有有限窗口时允许等待，不能无限续窗或免费刷周。', STOP_METHOD: '立即停止本次未用能力，保留真实成本；待处理脉冲仍须普通封存。', EXIT_ROOM: '两位成人先各走2米到室外，本人再按实际位置走出；不会关闭窗口后传送。', LEAVE: '确认原成人与本人都在室外、护片已经归还后结束本案。', ABORT: '停止窗口，实际处理未了脉冲，在原位卸片，再让原成人与本人按自己的精力普通走出并归还同一护片。', REPORT: '实付1行动，增加25扮演；只有真正应用过有限效果的能力才增加8掌握。', REFLECT: '三案如实报告后实付1行动，增加25扮演；伤势、损耗和旧历史均继续保留。',
};
const COSTS: Partial<Record<ApocalypseDemonessActivityCommand['type'], string>> = {
  RECOVER_ENERGY: '1行动 · 15便士 · 60秒 · +20精力（至多100）', OBSERVE: '0行动 · 2秒', PREPARE: '1行动 · 20便士 · 一片一次护片', CONSENT: '0行动 · 1秒', DECLINE_CONSENT: '0行动 · 立即拒绝', WITHDRAW_CONSENT: '0行动 · 立即撤回 · 不退成本',
  APPROACH: '0行动 · 本人6或10米 · 两成人各2米 · 每米1精力、1秒', WALK: '0行动 · 每米1精力、1秒', BUY_RESIDUE: '0行动 · 50便士 · 全程仅一份', RECEIVE_RESIDUE: '0行动 · 3秒', START_PULSE: '0行动 · 1秒 · 仅一次来源',
  INSTALL_PLATE: '0行动 · 1秒', REMOVE_PLATE: '0行动 · 1秒', RETURN_PLATE: '0行动 · 1秒', PULSE_CONTAINMENT: '0行动 · 8灵性＋2精神 · 知识18 · 1秒／窗口20秒', APPLY_PULSE: '0行动 · 一次来源＋一片次数 · 1精力 · 1秒', ORDINARY_SEAL: '0行动 · 1精力 · 5秒 · 真实清理待处理脉冲',
  BUY_LOAD: '0行动 · 30便士 · 一次新负载', RECEIVE_LOAD: '0行动 · 3秒', PREPARE_LOAD: '0行动 · 1秒', MIRROR_BUFFER: '0行动 · 8灵性＋2精神 · 意志18 · 1秒／窗口20秒', APPLY_LOAD: '0行动 · 一次负载＋一片次数 · 1精力 · 6伤害（有效缓冲减3）', ORDINARY_INSPECTION: '0行动 · 1精力 · 1秒',
  OCCLUDE_WINDOW: '0行动 · 1秒 · 窗口失效', WAIT_10: '0行动 · 实际10秒', STOP_METHOD: '0行动 · 立即停止', EXIT_ROOM: '0行动 · 各人每米1精力、1秒', LEAVE: '0行动 · 1秒', ABORT: '0行动 · 实际清理、归还与步行', REPORT: '1行动 · 2秒 · 扮演25', REFLECT: '1行动 · 2秒 · 扮演25',
};
export function apocalypseDemonessLifeActions(s: SliceState): ApocalypseDemonessLifeAction[] {
  if (!active(s)) return [];
  const l = s.apocalypseDemoness.life, p = l.site, a = current(l), out: ApocalypseDemonessLifeAction[] = [];
  if (!p) return [];
  const add = (command: ApocalypseDemonessActivityCommand, preferred = false, cleanup = false, label?: string) => {
    const reason = blockApocalypseDemonessLife(s, command);
    out.push({ id: `apocalypse-demoness-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}`,
      label: label ?? LABELS[command.type], cost: COSTS[command.type] ?? '0行动', enabled: reason === null, reason, command, preferredAction: preferred && reason === null, cleanup });
  };
  const step = (type: typeof STEPS[number], preferred = true, cleanup = false) => add({ type }, preferred, cleanup);
  const select = () => {
    // At most one recommended next step, including deterministic safe fallback.
    const chosen = out.find(x => x.enabled && x.preferredAction) ?? out.find(x => x.enabled && x.cleanup) ?? out.find(x => x.enabled);
    for (const action of out) action.preferredAction = action === chosen; return out;
  };
  const next = CASES.find(d => l.cases[d.id].status !== 'RESOLVED');
  if (!a) {
    const need = next ? distance('OUTSIDE', target(next.id)) * 2 + 1 : 8;
    if (p.playerEnergy < 100) step('RECOVER_ENERGY', !!next && l.cases[next.id].status !== 'EXAMINED' && p.playerEnergy < need, true);
    if (!next) { if (!l.reflected) step('REFLECT'); return select(); }
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, p.playerEnergy >= need);
    else if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, true);
    else { add({ type: 'PREPARE', caseId: next.id, method: 'ABILITY' }, p.playerEnergy >= need); add({ type: 'PREPARE', caseId: next.id, method: 'ORDINARY' }, false, false, '实付本案护片费，选择普通方法'); }
    return select();
  }
  const unresolvedSource = l.residue?.location === 'BOX' && l.residue.remaining === 1;
  const cleanup = () => {
    if ((unresolvedSource || l.activeCase === 'withdrawn-window' && a.approached) && !a.ordinarySealed) {
      if (p.playerLocation !== 'BOX') add({ type: 'WALK', to: 'BOX' }, true, true); else step('ORDINARY_SEAL', true, true);
    } else if (a.plate.status === 'INSTALLED') step('REMOVE_PLATE', true, true);
    else if (!a.exited) step('EXIT_ROOM', true, true);
    else if (a.plate.status !== 'RETURNED') step('RETURN_PLATE', true, true);
    else step('LEAVE', true, true);
  };
  if (a.exited || a.stopped || Object.values(a.permission).some(v => v === 'DECLINED' || v === 'WITHDRAWN') || a.inspectionAt !== null || a.pulseApplied || a.loadApplied) cleanup();
  else {
    const permission = a.permission.owner === 'UNASKED' ? 'OWNER' : a.permission.operator === 'UNASKED' ? 'OPERATOR' : a.permission.participant === 'UNASKED' ? 'PARTICIPANT' : a.method === 'ABILITY' && a.permission.ability === 'UNASKED' ? 'ABILITY' : null;
    if (permission) {
      add({ type: 'CONSENT', permission }, true, false, permission === 'OWNER' ? '询问维瑞娜本案原镜用途' : permission === 'OPERATOR' ? '询问马库斯本案原箱用途' : permission === 'PARTICIPANT' ? '询问两位原成人的当次参与和路线' : '询问这一次有限能力用途');
      add({ type: 'DECLINE_CONSENT', permission }, false, true);
    } else if (!a.approached) step('APPROACH');
    else if (p.playerLocation !== target(l.activeCase)) add({ type: 'WALK', to: target(l.activeCase) }, true);
    else if (l.activeCase === 'mirror-buffer') {
      if (!l.load) step('BUY_LOAD'); else if (l.load.location === 'SUPPLIER') step('RECEIVE_LOAD'); else if (l.load.preparedAt === null) step('PREPARE_LOAD');
      else if (a.plate.status !== 'INSTALLED') step('INSTALL_PLATE'); else if (a.method === 'ABILITY' && a.buffer.attempts === 0 && a.visibleLine) step('MIRROR_BUFFER'); else step('APPLY_LOAD');
    } else if (l.activeCase === 'withdrawn-window' && l.residue?.remaining === 0) {
      if (a.plate.status !== 'INSTALLED') step('INSTALL_PLATE'); else add({ type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' }, true, true, '原成人撤回本案许可；不对用尽来源再施术');
    } else if (!l.residue) step('BUY_RESIDUE');
    else if (l.residue.location !== 'BOX') step('RECEIVE_RESIDUE');
    else if (a.plate.status !== 'INSTALLED') step('INSTALL_PLATE');
    else if (l.residue.pendingAt === null) step('START_PULSE');
    else if (a.method === 'ABILITY' && a.containment.attempts === 0 && a.visibleLine) step('PULSE_CONTAINMENT');
    else if (l.activeCase === 'withdrawn-window') add({ type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' }, true, true);
    else if (a.containment.state === 'FAILED') step('ORDINARY_SEAL', true, true);
    else step('APPLY_PULSE');
  }
  if (!a.exited && !a.pulseApplied && !a.loadApplied && a.inspectionAt === null && p.playerLocation === target(l.activeCase)) {
    if (l.activeCase !== 'mirror-buffer' && !a.ordinarySealed && !out.some(x => x.command.type === 'ORDINARY_SEAL')) step('ORDINARY_SEAL', false, true);
    else if (l.activeCase === 'mirror-buffer') step('ORDINARY_INSPECTION', false, true);
  }
  if (l.pending) { step('STOP_METHOD', false, true); step('WAIT_10', false); step('OCCLUDE_WINDOW', false); add({ type: 'WALK', to: 'ENTRY' }, false); }
  if (!a.exited) for (const permission of ['OWNER', 'OPERATOR', 'PARTICIPANT', 'ABILITY'] as const) {
    if (a.permission[permission.toLowerCase() as keyof ApocalypseDemonessAttempt['permission']] === 'GRANTED' && !out.some(x => x.command.type === 'WITHDRAW_CONSENT' && x.command.permission === permission)) {
      add({ type: 'WITHDRAW_CONSENT', permission }, false, true, permission === 'OWNER' ? '维瑞娜撤回本案原镜许可' : permission === 'OPERATOR' ? '马库斯撤回本案原箱许可' : permission === 'PARTICIPANT' ? '原成人撤回本案参与与路线许可' : '撤回这一次有限能力许可');
    }
  }
  step('ABORT', false, true); return select();
}
export const apocalypseDemonessActivityActions = apocalypseDemonessLifeActions;
export function projectApocalypseDemonessLife(s: SliceState): ApocalypseDemonessLifeProjection {
  const l = s.apocalypseDemoness.life, p = l.site ?? s.calamityDemoness.encounter.currentSite, actions = apocalypseDemonessLifeActions(s), a = current(l);
  const originals = p ? apocalypseDemonessOriginalSnapshot(s) : null, model = originals ? { life: l, originals } : null;
  return { title: '原附室、同一成人与一次有限来源', story: '脉冲收束只处理真实来源的下一次有限脉冲；镜面缓冲只减轻下一次可见的本人受力。失败、到期、移动、遮挡和撤回都保留真实成本，旧损伤不会抹去。',
    source: `同一46岁维瑞娜、41岁马库斯与原展廊附室。旧负载剩${p?.load.remainingLoads ?? 0}次；旧残留${p?.residue?.status === 'CONSUMED' ? '已经用尽' : '按原记录封存'}，旧护片已经归还。新来源须另付50便士，新负载另付30便士，每案新护片20便士。`,
    environment: '室外负2米、入口0米、原镜A4米、原箱8米、原镜B12米。两位成人只在室外与入口之间各走2米；本人按实际位置往返，始终保留普通清理及退出精力。',
    activeCase: l.activeCase, inside: locked(l), insideCase: locked(l), reflected: l.reflected, preferredActionId: actions.find(x => x.preferredAction)?.id ?? null,
    clockSeconds: p?.clockSeconds ?? 0, elapsedSeconds: l.elapsedSeconds, playerLocation: p?.playerLocation ?? 'OUTSIDE', playerTravelMetres: l.playerTravelMetres, veraTravelMetres: l.veraTravelMetres, marcusTravelMetres: l.marcusTravelMetres,
    site: structuredClone(p), residue: structuredClone(l.residue), load: structuredClone(l.load), pending: structuredClone(l.pending), pendingUsable: !!model && !!l.pending && validPending(model, l.pending.kind), pendingRemainingSeconds: l.pending && p ? Math.max(0, l.pending.expiresAt - p.clockSeconds) : 0,
    currentAttempt: structuredClone(a), cases: CASES.map(def => { const r = l.cases[def.id]; return { id: def.id, title: def.title, story: def.story, observations: r.observedWeek === null ? [] : [def.story, '原人普通往返，旧残留、旧负载和旧护片不补回；未实际应用的能力没有掌握奖励。'],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限效果已实际应用；真实成本、损耗和普通离场记录均保留。' : '如实完成普通处理、失败、拒绝或撤回；没有未应用的能力奖励。', contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }),
    ledger: structuredClone(l.journal), actions };
}
