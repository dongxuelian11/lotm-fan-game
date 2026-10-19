import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { UnagingDemonessLifeState } from '../unaging-demoness/life.js';
import { hasCalamityDemonessOldPractice } from './index.js';

export const CALAMITY_DEMONESS_CASE_IDS = ['mirror-screen', 'black-flame-channel', 'revoked-window'] as const;
export const CALAMITY_DEMONESS_ACTIVITY_CASE_IDS = CALAMITY_DEMONESS_CASE_IDS;
export const ACTIVITY_CASE_IDS = CALAMITY_DEMONESS_CASE_IDS;
export type CalamityDemonessCaseId = typeof CALAMITY_DEMONESS_CASE_IDS[number];
export type CalamityDemonessLifeAbilityId = 'assassin.s2.mirror-screen' | 'assassin.s2.black-flame-channel';
export type CalamityDemonessLocation = 'ENTRY' | 'A' | 'BOX' | 'B' | 'OUTSIDE' | 'YARD';
export type CalamityDemonessConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export type CalamityDemonessWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'APPLIED' | 'STOPPED';
const STEPS = ['OBSERVE', 'ARRIVE_VERA', 'ARRIVE_MARCUS', 'CONSENT_OPERATOR', 'CONSENT_OWNER', 'INSTALL_PLATE', 'REMOVE_PLATE', 'SCREEN_MIRROR', 'APPLY_LOAD', 'CLOSE_BOX', 'MOVE_ADULTS_OUTSIDE', 'CHANNEL_BLACK_FLAME', 'COLLECT_RESIDUE', 'SEALED_HANDOVER', 'RETURN_ADULTS', 'WITHDRAW_PERMISSION', 'ORDINARY_ROUTE', 'RETURN_ROUTE', 'RETURN_PLATE', 'STOP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type CalamityDemonessActivityCommand =
  | { type: typeof STEPS[number]; caseId: CalamityDemonessCaseId }
  | { type: 'PREPARE'; caseId: CalamityDemonessCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WALK'; caseId: CalamityDemonessCaseId; to: Exclude<CalamityDemonessLocation, 'YARD'> }
  | { type: 'REFLECT' };
export interface CalamityDemonessSceneSource {
  root: 'unagingDemoness.life'; promotionWeek: number; introducedWeek: number;
  /** An immutable provenance snapshot, never an additional present body or inventory. */
  snapshot: Pick<UnagingDemonessLifeState, 'siteId' | 'vera' | 'marcus' | 'mirrorA' | 'mirrorB' | 'playerLocation' | 'playerTravelMetres' | 'clockSeconds' | 'entry' | 'shutter'>;
}
export interface CalamityDemonessMirror { id: 'UD3-MIRROR-A' | 'UD3-MIRROR-B'; owner: 'UD3-VERA'; quantity: 1; location: 'A' | 'B'; intact: boolean }
export interface CalamityDemonessAdult {
  id: 'UD3-VERA' | 'UD3-MARCUS'; name: '维瑞娜·肖' | '马库斯·赫尔'; age: 46 | 41; alive: true; willing: boolean;
  location: 'SOURCE_START' | 'SOURCE_B' | 'ENTRY' | 'OUTSIDE'; energy: number; travelMetres: number;
  mirrorConsent: CalamityDemonessConsent; boxConsent: CalamityDemonessConsent;
}
export interface CalamityDemonessPlate {
  id: 'CD2-PLATE-1' | 'CD2-PLATE-2' | 'CD2-PLATE-3'; caseId: CalamityDemonessCaseId; ownerId: 'PLAYER'; quantity: 1;
  status: 'SUPPLY' | 'PLAYER' | 'INSTALLED' | 'CONSUMED' | 'RETURNED'; location: 'SUPPLY' | 'PLAYER' | 'A' | 'BOX' | 'CUSTODIAN';
  charges: 0 | 1; wear: number; scorched: boolean; paidPennies: 0 | 20; preparedWeek: number | null;
}
export interface CalamityDemonessResidue {
  id: 'CD2-RESIDUE-1'; ownerId: 'UD3-MARCUS'; quantity: 1; fictional: true; biological: false;
  origin: 'ADULT_WORKSHOP_CUSTODIAN'; acquiredWithPlateId: 'CD2-PLATE-2'; sealed: true;
  status: 'CONTAINED' | 'CONSUMED' | 'HANDED_OVER'; location: 'BOX' | 'PLAYER' | 'CUSTODIAN'; acquiredWeek: number;
}
export interface CalamityDemonessMovement {
  from: CalamityDemonessLocation | 'SOURCE_START' | 'SOURCE_B'; to: CalamityDemonessLocation;
  mode: 'WALK' | 'SOURCE_ARRIVAL' | 'ORDINARY_OUTER_ROUTE'; metres: number; seconds: number;
  actorId: 'PLAYER' | 'UD3-VERA' | 'UD3-MARCUS';
}
export interface CalamityDemonessSiteState {
  siteId: 'CD2-GALLERY-ANNEX'; introducedWeek: number | null; introducedDate: PublicGameDate | null;
  clockSeconds: number; playerLocation: CalamityDemonessLocation; playerTravelMetres: number; playerEnergy: number;
  source: CalamityDemonessSceneSource | null; vera: CalamityDemonessAdult | null; marcus: CalamityDemonessAdult | null;
  mirrorA: CalamityDemonessMirror | null; mirrorB: CalamityDemonessMirror | null;
  load: { id: 'CD2-TEST-LOAD'; location: 'A'; enclosed: true; initialForce: 12; remainingLoads: 0 | 1; appliedLoads: 0 | 1; finalForce: 12 | 7; bufferedForce: 0 | 5 };
  box: { id: 'CD2-BOX'; ownerId: 'UD3-MARCUS'; location: 'BOX'; state: 'OPEN' | 'CLOSED'; scorched: boolean; pulses: 0 | 1; pulseSeconds: 0 | 10; handovers: 0 | 1 };
  residue: CalamityDemonessResidue | null;
  screen: { active: boolean; mirrorId: 'UD3-MIRROR-A'; expiresAt: number | null; plateId: 'CD2-PLATE-1' | null };
  plates: CalamityDemonessPlate[]; actorMoves: CalamityDemonessMovement[];
}
export interface CalamityDemonessAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; stopped: boolean; inspected: boolean; permissionWithdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; energySpent: number; spiritualitySpent: number; penniesSpent: 20;
  operatorConsent: CalamityDemonessConsent; ownerConsent: CalamityDemonessConsent; routeConsent: CalamityDemonessConsent; consentWeek: number;
  plateId: CalamityDemonessPlate['id']; plateInstalled: boolean; plateReturned: boolean; abilityTier: PublicResolutionTier | null; window: CalamityDemonessWindow; windowExpiresAt: number | null;
  loadApplied: boolean; bufferedForce: number; plateWear: number; pulseApplied: boolean; residueHandedOver: boolean; boxClosed: boolean; clearanceConfirmed: boolean; adultsReturned: boolean;
  routeWalked: boolean; routeReturned: boolean; waits: number; appliedAbilityIds: CalamityDemonessLifeAbilityId[];
  playerMoves: CalamityDemonessMovement[]; actorMoves: CalamityDemonessMovement[]; siteAtStart: CalamityDemonessSiteState; siteAtClose: CalamityDemonessSiteState | null;
}
export interface CalamityDemonessCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  operatorConsentWeek: number | null; ownerConsentWeek: number | null; preparations: number; closes: number; withdrawals: number;
  observation: { mirrorAId: 'UD3-MIRROR-A'; mirrorBId: 'UD3-MIRROR-B'; mirrorAIntact: boolean; mirrorBIntact: boolean; loadId: 'CD2-TEST-LOAD'; remainingLoads: number; boxId: 'CD2-BOX'; walkedMetres: 8 } | null;
  attempts: CalamityDemonessAttempt[];
}
export interface CalamityDemonessCheckSource {
  caseId: CalamityDemonessCaseId; abilityId: CalamityDemonessLifeAbilityId; cost: 6; difficulty: 20; coreStat: 'knowledge'; baseAbility: number;
  actor: { pathwayId: 'demoness'; sequence: 2; name: string; gender: string }; operatorConsentWeek: number; ownerConsentWeek: number;
  at: number; site: CalamityDemonessSiteState;
}
export interface CalamityDemonessLifeCost { actions: number; spirituality: number; pennies: number; health: 0; energy: number; cashGained: 0 }
export interface CalamityDemonessLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number; energyBefore: number; energyAfter: number }
export interface CalamityDemonessLifeEvent {
  week: number; date: PublicGameDate; command: CalamityDemonessActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: CalamityDemonessCheckSource | null; inheritedScene: CalamityDemonessSceneSource | null;
  paid: CalamityDemonessLifeCost; budget: CalamityDemonessLifeBudget;
}
export interface CalamityDemonessLifeState { activeCase: CalamityDemonessCaseId | null; reflected: boolean; site: CalamityDemonessSiteState; cases: Record<CalamityDemonessCaseId, CalamityDemonessCaseState>; journal: CalamityDemonessLifeEvent[] }
export interface CalamityDemonessLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CalamityDemonessActivityCommand }
export interface CalamityDemonessLifeProjection {
  title: string; story: string; environment: string; activeCase: CalamityDemonessCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: CalamityDemonessPublicSite; historicalScene?: CalamityDemonessPublicHistory; clockSeconds: number; playerLocation: CalamityDemonessLocation; playerTravelMetres: number; currentAttempt: CalamityDemonessPublicAttempt | null;
  cases: { id: CalamityDemonessCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: CalamityDemonessPublicAttempt[] }[];
  actions: CalamityDemonessLifeAction[];
}
/** Public projections enumerate known facts. Internal roots and replay provenance never cross this boundary. */
type PublicScalarKey<T> = { [K in keyof T]-?: T[K] extends string | number | boolean | null | undefined ? K : never }[keyof T];
export function projectDemonessPublicFields<T, K extends PublicScalarKey<T>>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;
}
export function projectDemonessPublicCheck(c: PublicCheckResult | null): PublicCheckResult | null {
  return c ? { ...projectDemonessPublicFields(c, ['ability', 'baseAbility', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier']),
    modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })) } : null;
}
export const projectDemonessPublicDate = (d: PublicGameDate): PublicGameDate => ({ epoch: d.epoch, year: d.year, month: d.month, day: d.day });
export const projectDemonessPublicInjury = (i: SliceState['injuries'][number]): SliceState['injuries'][number] =>
  ({ id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision });
/** Only the already-known historical display facts, separate from current bodies and private provenance. */
export interface CalamityDemonessPublicHistory {
  clockSeconds: number; playerLocation: UnagingDemonessLifeState['playerLocation']; playerTravelMetres: number;
  vera: Pick<UnagingDemonessLifeState['vera'], 'name' | 'age' | 'location'>;
  marcus: Pick<UnagingDemonessLifeState['marcus'], 'name' | 'age' | 'location'>;
  mirrorA: Pick<UnagingDemonessLifeState['mirrorA'], 'id' | 'intact'>;
  mirrorB: Pick<UnagingDemonessLifeState['mirrorB'], 'id' | 'intact'>;
  entry: Pick<UnagingDemonessLifeState['entry'], 'held'>;
  shutter: Pick<UnagingDemonessLifeState['shutter'], 'state'>;
}
export function projectCalamityDemonessHistory(source: CalamityDemonessSceneSource | null): CalamityDemonessPublicHistory | undefined {
  if (!source) return undefined;
  const p = source.snapshot;
  return { clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres,
    vera: projectDemonessPublicFields(p.vera, ['name', 'age', 'location']), marcus: projectDemonessPublicFields(p.marcus, ['name', 'age', 'location']),
    mirrorA: { id: p.mirrorA.id, intact: p.mirrorA.intact }, mirrorB: { id: p.mirrorB.id, intact: p.mirrorB.intact },
    entry: { held: p.entry.held }, shutter: { state: p.shutter.state } };
}
export type CalamityDemonessPublicSite = Omit<CalamityDemonessSiteState, 'source'>;
export type CalamityDemonessPublicAttempt = Omit<CalamityDemonessAttempt, 'siteAtStart' | 'siteAtClose'> &
  { siteAtStart: CalamityDemonessPublicSite; siteAtClose: CalamityDemonessPublicSite | null };
const publicMovement = (m: CalamityDemonessMovement): CalamityDemonessMovement =>
  projectDemonessPublicFields(m, ['from', 'to', 'mode', 'metres', 'seconds', 'actorId']);
export function projectCalamityDemonessPublicSite(p: CalamityDemonessSiteState): CalamityDemonessPublicSite {
  const adult = (a: CalamityDemonessAdult | null) => a ? projectDemonessPublicFields(a,
    ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'mirrorConsent', 'boxConsent']) : null;
  const mirror = (m: CalamityDemonessMirror | null) => m ? projectDemonessPublicFields(m, ['id', 'owner', 'quantity', 'location', 'intact']) : null;
  return { ...projectDemonessPublicFields(p, ['siteId', 'introducedWeek', 'clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy']),
    introducedDate: p.introducedDate ? projectDemonessPublicDate(p.introducedDate) : null,
    vera: adult(p.vera), marcus: adult(p.marcus), mirrorA: mirror(p.mirrorA), mirrorB: mirror(p.mirrorB),
    load: projectDemonessPublicFields(p.load, ['id', 'location', 'enclosed', 'initialForce', 'remainingLoads', 'appliedLoads', 'finalForce', 'bufferedForce']),
    box: projectDemonessPublicFields(p.box, ['id', 'ownerId', 'location', 'state', 'scorched', 'pulses', 'pulseSeconds', 'handovers']),
    residue: p.residue ? projectDemonessPublicFields(p.residue, ['id', 'ownerId', 'quantity', 'fictional', 'biological', 'origin', 'acquiredWithPlateId', 'sealed', 'status', 'location', 'acquiredWeek']) : null,
    screen: projectDemonessPublicFields(p.screen, ['active', 'mirrorId', 'expiresAt', 'plateId']),
    plates: p.plates.map(a => projectDemonessPublicFields(a, ['id', 'caseId', 'ownerId', 'quantity', 'status', 'location', 'charges', 'wear', 'scorched', 'paidPennies', 'preparedWeek'])),
    actorMoves: p.actorMoves.map(publicMovement) };
}
export function projectCalamityDemonessPublicAttempt(a: CalamityDemonessAttempt): CalamityDemonessPublicAttempt {
  return { ...projectDemonessPublicFields(a, ['week', 'method', 'closed', 'result', 'stopped', 'inspected', 'permissionWithdrawn',
    'elapsedSeconds', 'playerTravelMetres', 'energySpent', 'spiritualitySpent', 'penniesSpent', 'operatorConsent', 'ownerConsent', 'routeConsent', 'consentWeek',
    'plateId', 'plateInstalled', 'plateReturned', 'abilityTier', 'window', 'windowExpiresAt', 'loadApplied', 'bufferedForce', 'plateWear', 'pulseApplied',
    'residueHandedOver', 'boxClosed', 'clearanceConfirmed', 'adultsReturned', 'routeWalked', 'routeReturned', 'waits']),
    appliedAbilityIds: [...a.appliedAbilityIds], playerMoves: a.playerMoves.map(publicMovement), actorMoves: a.actorMoves.map(publicMovement),
    siteAtStart: projectCalamityDemonessPublicSite(a.siteAtStart), siteAtClose: a.siteAtClose ? projectCalamityDemonessPublicSite(a.siteAtClose) : null };
}
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITION: Record<CalamityDemonessLocation, number> = { ENTRY: 0, A: 4, BOX: 8, B: 12, OUTSIDE: -2, YARD: -4 };
const LOCATIONS = ['ENTRY', 'A', 'BOX', 'B', 'OUTSIDE'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 2;
const distance = (from: CalamityDemonessLocation, to: CalamityDemonessLocation) => Math.abs(POSITION[from] - POSITION[to]);
const plateId = (id: CalamityDemonessCaseId): CalamityDemonessPlate['id'] => id === 'mirror-screen' ? 'CD2-PLATE-1' : id === 'black-flame-channel' ? 'CD2-PLATE-2' : 'CD2-PLATE-3';
const freshCase = (): CalamityDemonessCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, operatorConsentWeek: null, ownerConsentWeek: null, preparations: 0, closes: 0, withdrawals: 0, observation: null, attempts: [] });
export function createCalamityDemonessSiteState(): CalamityDemonessSiteState {
  return { siteId: 'CD2-GALLERY-ANNEX', introducedWeek: null, introducedDate: null, clockSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, playerEnergy: 100,
    source: null, vera: null, marcus: null, mirrorA: null, mirrorB: null,
    load: { id: 'CD2-TEST-LOAD', location: 'A', enclosed: true, initialForce: 12, remainingLoads: 1, appliedLoads: 0, finalForce: 12, bufferedForce: 0 },
    box: { id: 'CD2-BOX', ownerId: 'UD3-MARCUS', location: 'BOX', state: 'CLOSED', scorched: false, pulses: 0, pulseSeconds: 0, handovers: 0 }, residue: null,
    screen: { active: false, mirrorId: 'UD3-MIRROR-A', expiresAt: null, plateId: null },
    plates: CALAMITY_DEMONESS_CASE_IDS.map(caseId => ({ id: plateId(caseId), caseId, ownerId: 'PLAYER', quantity: 1, status: 'SUPPLY', location: 'SUPPLY', charges: 1, wear: 0, scorched: false, paidPennies: 0, preparedWeek: null })), actorMoves: [] };
}
export function createCalamityDemonessLifeState(): CalamityDemonessLifeState { return { activeCase: null, reflected: false, site: createCalamityDemonessSiteState(), cases: { 'mirror-screen': freshCase(), 'black-flame-channel': freshCase(), 'revoked-window': freshCase() }, journal: [] }; }
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', id: CalamityDemonessCaseId, p: CalamityDemonessSiteState): CalamityDemonessAttempt {
  return { week, method, closed: false, result: 'NONE', stopped: false, inspected: false, permissionWithdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0, energySpent: 0, spiritualitySpent: 0, penniesSpent: 20,
    operatorConsent: 'GRANTED', ownerConsent: 'GRANTED', routeConsent: 'GRANTED', consentWeek: week, plateId: plateId(id), plateInstalled: false, plateReturned: false, abilityTier: null, window: 'NONE', windowExpiresAt: null,
    loadApplied: false, bufferedForce: 0, plateWear: 0, pulseApplied: false, residueHandedOver: false, boxClosed: false, clearanceConfirmed: false, adultsReturned: false, routeWalked: false, routeReturned: false, waits: 0,
    appliedAbilityIds: [], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null };
}
const current = (l: CalamityDemonessLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: CalamityDemonessLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const originalAdultsReady = (p: CalamityDemonessSiteState) => p.vera?.location === 'ENTRY' && p.marcus?.location === 'ENTRY';
const currentPlate = (p: CalamityDemonessSiteState, a: CalamityDemonessAttempt) => p.plates.find(x => x.id === a.plateId)!;
function cleanupBlock(l: CalamityDemonessLifeState): string | null {
  const p = l.site;
  if (p.screen.active) return '先停止尚未结束的有限镜幕。';
  if (p.source && !originalAdultsReady(p)) return '同一维瑞娜与马库斯须沿普通道路实际来到或回到门口。';
  if (p.box.state !== 'CLOSED' || p.residue?.status === 'CONTAINED') return '须实际合箱，并把仍封装的同一残留物按普通方法交回保管者。';
  if (p.plates.some(x => x.status !== 'SUPPLY' && x.status !== 'RETURNED')) return '本案同一护片须卸下，亲自携回门口交还；消耗后的原片仍须归还。';
  return p.playerLocation === 'ENTRY' ? null : '本人须沿普通道路实际回到门口；关闭不传送。';
}
export const hasCalamityDemonessLifeLock = (s: SliceState): boolean => contactOpen(s.calamityDemoness.life) || s.calamityDemoness.encounter.status === 'AVAILABLE' && cleanupBlock(s.calamityDemoness.life) !== null;
export const calamityDemonessInside = hasCalamityDemonessLifeLock;
export const calamityDemonessLifeClosed = (s: SliceState): boolean => !contactOpen(s.calamityDemoness.life) && !cleanupBlock(s.calamityDemoness.life) && Object.values(s.calamityDemoness.life.cases).every(r => r.status === 'RESOLVED');
export function validateCalamityDemonessActivityCommand(v: unknown): v is CalamityDemonessActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!CALAMITY_DEMONESS_CASE_IDS.includes(v.caseId as CalamityDemonessCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && LOCATIONS.includes(v.to as typeof LOCATIONS[number]);
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isCalamityDemonessActivityCommand = validateCalamityDemonessActivityCommand;
export const isCalamityDemonessActivity = validateCalamityDemonessActivityCommand;
const consent = (a: CalamityDemonessAttempt, week: number) => a.operatorConsent === 'GRANTED' && a.ownerConsent === 'GRANTED' && a.consentWeek === week && !a.stopped;
const screenApplies = (p: CalamityDemonessSiteState) => p.screen.active && p.screen.expiresAt !== null && p.screen.expiresAt - p.clockSeconds >= 4;
function localBlock(l: CalamityDemonessLifeState, c: CalamityDemonessActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !contactOpen(l) && !cleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先真实收尾并报告三案，再完成一次反思。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = CALAMITY_DEMONESS_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'AVAILABLE' && p.playerEnergy >= 8 && (index === 0 || l.cases[CALAMITY_DEMONESS_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '依次实地核对原镜与实际退路，换案不恢复精力、物品或同意。';
  if (c.type === 'ARRIVE_VERA' || c.type === 'ARRIVE_MARCUS') {
    const who = c.type === 'ARRIVE_VERA' ? p.vera : p.marcus, metres = c.type === 'ARRIVE_VERA' ? 2 : 24;
    return c.caseId === 'mirror-screen' && r.status === 'OBSERVED' && !contactOpen(l) && who?.location === (c.type === 'ARRIVE_VERA' ? 'SOURCE_START' : 'SOURCE_B') && who.energy >= metres ? null : '须先读取原人真实旧位置，再由她或他本人沿普通旧廊走来；不得重复生成或免费到场。';
  }
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') {
    if (contactOpen(l) || cleanupBlock(l) || r.status !== 'OBSERVED' || !originalAdultsReady(p)) return '须先观察，两名原成人已实际来到门口，再询问本案当前许可。';
    if (!(c.type === 'CONSENT_OPERATOR' ? p.marcus?.willing : p.vera?.willing)) return '当事人没有给出当前自愿许可。';
    return (c.type === 'CONSENT_OPERATOR' ? r.operatorConsentWeek : r.ownerConsentWeek) === week ? '本周本案的明确答复已记录。' : null;
  }
  if (c.type === 'PREPARE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 && r.operatorConsentWeek === week && r.ownerConsentWeek === week && p.playerEnergy >= (c.caseId === 'mirror-screen' ? 13 : c.caseId === 'black-flame-channel' ? 16 : 8) && p.plates[index]?.status === 'SUPPLY' ? null : '须有双方本周本案的明确许可、唯一未领护片与普通返程余力；每案只准备一次。';
  if (c.type === 'REPORT') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'EXAMINED' ? null : '先真实收尾、携原物回门口，再如实报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一案。';
  const plate = currentPlate(p, a);
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l) ?? (!a.inspected ? '先核实实际结果；取消也须真实收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止本次尝试。' : null);
  if (a.inspected) return '本案已核实，请结束接触后报告。';
  if (c.type === 'STOP') return a.stopped ? '已经停止，已付成本不退。' : null;
  if (c.type === 'WALK') {
    if (c.to === p.playerLocation) return '你已经在这里。';
    if (a.routeWalked && !a.routeReturned) return '须沿实际8米普通路返回A，再走向门口。';
    const installedAt = plate.location === 'A' || plate.location === 'BOX' ? plate.location : null;
    const reserve = installedAt ? distance(c.to, installedAt) + distance(installedAt, 'ENTRY') : distance(c.to, 'ENTRY');
    return p.playerEnergy >= distance(p.playerLocation, c.to) + reserve ? null : '这段步行会用掉原物回收和普通返回的必要精力。';
  }
  if (c.type === 'WAIT_10') return a.abilityTier !== null && a.waits < 4 ? null : '施术后最多等待四次10秒，不续窗、不补物资。';
  if (c.type === 'CLOSE_BOX') return c.caseId === 'black-flame-channel' && p.playerLocation === 'BOX' && p.box.state === 'OPEN' ? null : '须本人实际走到收容箱前，箱盖确实尚开。';
  if (c.type === 'MOVE_ADULTS_OUTSIDE') return c.caseId === 'black-flame-channel' && p.playerLocation === 'ENTRY' && originalAdultsReady(p) && !a.clearanceConfirmed && p.vera!.energy >= 4 && p.marcus!.energy >= 4 ? null : '须在门口当面请同一两名成人各走2米到接触区外，并为两人各保留2米返回精力。';
  if (c.type === 'RETURN_ADULTS') return c.caseId === 'black-flame-channel' && p.playerLocation === 'ENTRY' && p.box.state === 'CLOSED' && (p.residue?.status !== 'CONTAINED' || p.residue.location === 'PLAYER') && p.vera?.location === 'OUTSIDE' && p.marcus?.location === 'OUTSIDE' ? null : '须箱盖已闭、残留已消耗或由你封装携回，你在门口才可让原两人各步行2米返回。';
  if (c.type === 'COLLECT_RESIDUE') return c.caseId === 'black-flame-channel' && p.playerLocation === 'BOX' && p.box.state === 'CLOSED' && p.residue?.status === 'CONTAINED' && p.residue.location === 'BOX' && (a.abilityTier !== null || a.method === 'ORDINARY' || a.stopped) ? null : '须在已闭原箱前，实际取回仍然封装的同一残留物；不是远程清除。';
  if (c.type === 'SEALED_HANDOVER') return c.caseId === 'black-flame-channel' && p.playerLocation === 'ENTRY' && p.marcus?.location === 'ENTRY' && p.box.state === 'CLOSED' && p.residue?.status === 'CONTAINED' && p.residue.location === 'PLAYER' && (a.method === 'ORDINARY' || a.abilityTier !== null || a.stopped) ? null : '须本人携同一封装残留物回门口，并让原保管者实际返回，才当面交回；失败也不释放或删除它。';
  if (c.type === 'REMOVE_PLATE') return (plate.location === 'A' && p.playerLocation === 'A' || plate.location === 'BOX' && p.playerLocation === 'BOX') && !p.screen.active && (c.caseId !== 'black-flame-channel' || p.box.state === 'CLOSED' && (p.residue?.status !== 'CONTAINED' || p.residue.location === 'PLAYER')) ? null : '须在原片实际安装处，停止镜幕、封箱并处理残留后亲手取下。';
  if (c.type === 'RETURN_PLATE') return p.playerLocation === 'ENTRY' && plate.location === 'PLAYER' && !a.plateReturned && !p.screen.active && (a.stopped || a.loadApplied || a.pulseApplied || a.residueHandedOver || a.permissionWithdrawn) ? null : '须本人持同一片在门口，完成或明确停止尝试后交回。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'revoked-window' && !a.permissionWithdrawn && a.abilityTier === null && p.playerLocation === 'ENTRY' && p.vera?.location === 'ENTRY' ? null : '须在门口当面听维瑞娜撤回本案镜面许可，尚未施术。';
  if (c.type === 'ORDINARY_ROUTE') return c.caseId === 'revoked-window' && a.permissionWithdrawn && a.stopped && !a.routeWalked && a.routeConsent === 'GRANTED' && p.playerLocation === 'A' && p.playerEnergy >= 20 ? null : '须先尊重撤回并停止施术；本人在A，按独立许可实走8米普通外路至B，另留8米回A和4米回门。';
  if (c.type === 'RETURN_ROUTE') return c.caseId === 'revoked-window' && a.routeWalked && !a.routeReturned && p.playerLocation === 'B' && p.playerEnergy >= 12 ? null : '须本人确在B，实际走8米外路回A并留4米返回门口。';
  if (c.type === 'INSPECT') return cleanupBlock(l) ?? (c.caseId === 'revoked-window' && (!a.permissionWithdrawn || !a.stopped) ? '先读取当面撤回并停止施术。' : !a.loadApplied && !a.pulseApplied && !a.residueHandedOver && !a.stopped ? '先实际使用原测试或明确停止，不把未做的事记作完成。' : null);
  if (!consent(a, week) || a.plateReturned) return '能力许可已撤回或本次已停止；普通收尾和返回仍可进行。';
  if (c.type === 'INSTALL_PLATE') return c.caseId !== 'revoked-window' && !a.plateInstalled && plate.status === 'PLAYER' && p.playerLocation === (c.caseId === 'mirror-screen' ? 'A' : 'BOX') && (c.caseId === 'mirror-screen' ? p.mirrorA?.intact && p.vera?.mirrorConsent === 'GRANTED' : p.residue?.status === 'CONTAINED' && p.residue.location === 'PLAYER' && p.marcus?.boxConsent === 'GRANTED') ? null : '须到原镜A前或原箱前，在当前许可下亲手安装本案唯一护片。';
  if (c.type === 'SCREEN_MIRROR') return c.caseId === 'mirror-screen' && a.method === 'ABILITY' && a.abilityTier === null && p.playerLocation === 'A' && plate.status === 'INSTALLED' && plate.charges === 1 && p.mirrorA?.intact && p.vera?.mirrorConsent === 'GRANTED' ? null : '须原镜完好且原主本案当前许可有效，护片确在镜前；只能作一次6灵性、知识20尝试。';
  if (c.type === 'APPLY_LOAD') return c.caseId === 'mirror-screen' && p.playerLocation === 'A' && plate.status === 'INSTALLED' && plate.charges === 1 && p.load.remainingLoads === 1 && (a.method === 'ORDINARY' || a.abilityTier !== null) && p.playerEnergy >= distance('A', 'ENTRY') + (screenApplies(p) ? 0 : 5) ? null : '须原封闭负载和原护片都尚有一次，完成所选尝试并保留普通承接及返门余力。';
  if (c.type === 'CHANNEL_BLACK_FLAME') return c.caseId === 'black-flame-channel' && a.method === 'ABILITY' && a.abilityTier === null && p.playerLocation === 'BOX' && p.box.state === 'CLOSED' && plate.status === 'INSTALLED' && plate.charges === 1 && p.residue?.status === 'CONTAINED' && a.clearanceConfirmed && p.vera?.location === 'OUTSIDE' && p.marcus?.location === 'OUTSIDE' && p.marcus.boxConsent === 'GRANTED' ? null : '须本人在已闭原箱前、同一护片已装、原残留仍封装，两名成人已实际走出接触区；只能尝试一次10秒黑焰导流。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: CalamityDemonessLifeState, c: CalamityDemonessActivityCommand): CalamityDemonessLifeCost {
  const a = 'caseId' in c ? l.cases[c.caseId].attempts.at(-1) : undefined;
  const ordinaryWork = c.type === 'APPLY_LOAD' && a?.method === 'ORDINARY' || c.type === 'SEALED_HANDOVER' && a?.method === 'ORDINARY' && !a.stopped || c.type === 'ORDINARY_ROUTE';
  return { actions: ['OBSERVE', 'PREPARE', 'SCREEN_MIRROR', 'CHANNEL_BLACK_FLAME', 'REPORT', 'REFLECT'].includes(c.type) || ordinaryWork ? 1 : 0,
    spirituality: c.type === 'SCREEN_MIRROR' || c.type === 'CHANNEL_BLACK_FLAME' ? 6 : 0, pennies: c.type === 'PREPARE' ? 20 : 0, health: 0,
    energy: c.type === 'OBSERVE' ? 8 : c.type === 'WALK' ? distance(l.site.playerLocation, c.to) : c.type === 'ORDINARY_ROUTE' || c.type === 'RETURN_ROUTE' ? 8 : c.type === 'APPLY_LOAD' && !screenApplies(l.site) ? 5 : 0, cashGained: 0 };
}
export function blockCalamityDemonessLife(s: SliceState, c: CalamityDemonessActivityCommand): string | null {
  if (!validateCalamityDemonessActivityCommand(c)) return '灾难魔女生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已成为灾难魔女。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德馆舍附廊。';
  if (hasCalamityDemonessOldPractice(s) || s.calamityDemoness.preparedWeek !== null) return '先收束旧实践、旧遭遇与服药准备。';
  if (s.calamityDemoness.encounter.status !== 'AVAILABLE') return '现场已进入后续遭遇，不能重开原案或补原物。';
  const reason = localBlock(s.calamityDemoness.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.calamityDemoness.life, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备另留1行动，普通取消和收尾不需行动。';
  if (s.cash < cost.pennies) return '本案唯一护片须实付20便士。';
  if (s.spirituality < cost.spirituality || cost.spirituality > 0 && s.mind <= 0) return '灵性或精神不足以施术；仍可普通收尾。';
  if (s.calamityDemoness.life.site.playerEnergy < cost.energy) return '本场精力不足，换案不补。';
  return null;
}
function elapse(l: CalamityDemonessLifeState, seconds: number, a: CalamityDemonessAttempt | null = current(l)): void {
  const p = l.site; p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (p.screen.active && p.screen.expiresAt !== null && p.clockSeconds >= p.screen.expiresAt) { p.screen.active = false; p.screen.expiresAt = null; p.screen.plateId = null; if (a?.window === 'ACTIVE') a.window = 'EXPIRED'; }
}
function walk(l: CalamityDemonessLifeState, to: CalamityDemonessLocation, a: CalamityDemonessAttempt | null = current(l), mode: CalamityDemonessMovement['mode'] = 'WALK', metres = distance(l.site.playerLocation, to)): void {
  const p = l.site, from = p.playerLocation; p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres;
  if (a) { a.playerTravelMetres += metres; a.energySpent += metres; a.playerMoves.push({ from, to, mode, metres, seconds: metres, actorId: 'PLAYER' }); } elapse(l, metres, a);
}
function moveAdult(l: CalamityDemonessLifeState, who: 'vera' | 'marcus', to: 'ENTRY' | 'OUTSIDE', metres: number, mode: CalamityDemonessMovement['mode'], a: CalamityDemonessAttempt | null): void {
  const actor = l.site[who]!;
  const move: CalamityDemonessMovement = { from: actor.location, to, mode, metres, seconds: metres, actorId: actor.id };
  actor.location = to; actor.energy -= metres; actor.travelMetres += metres; l.site.actorMoves.push(move); if (a) a.actorMoves.push(structuredClone(move)); elapse(l, metres, a);
}
function checkSource(l: CalamityDemonessLifeState, c: CalamityDemonessActivityCommand, baseAbility: number, name: string, gender: string): CalamityDemonessCheckSource | null {
  if (c.type !== 'SCREEN_MIRROR' && c.type !== 'CHANNEL_BLACK_FLAME') return null;
  const r = l.cases[c.caseId]; return { caseId: c.caseId, abilityId: c.type === 'SCREEN_MIRROR' ? 'assassin.s2.mirror-screen' : 'assassin.s2.black-flame-channel', cost: 6, difficulty: 20, coreStat: 'knowledge', baseAbility,
    actor: { pathwayId: 'demoness', sequence: 2, name, gender }, operatorConsentWeek: r.operatorConsentWeek!, ownerConsentWeek: r.ownerConsentWeek!, at: l.site.clockSeconds, site: structuredClone(l.site) };
}
function sceneHandoff(s: SliceState, week: number): CalamityDemonessSceneSource {
  const l = s.unagingDemoness.life;
  return { root: 'unagingDemoness.life', promotionWeek: s.unagingDemoness.promotionWeek!, introducedWeek: week,
    snapshot: structuredClone({ siteId: l.siteId, vera: l.vera, marcus: l.marcus, mirrorA: l.mirrorA, mirrorB: l.mirrorB, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, clockSeconds: l.clockSeconds, entry: l.entry, shutter: l.shutter }) };
}
function closeScreen(p: CalamityDemonessSiteState): void { p.screen.active = false; p.screen.expiresAt = null; p.screen.plateId = null; }
function evolve(l: CalamityDemonessLifeState, c: CalamityDemonessActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, inheritedScene: CalamityDemonessSceneSource | null): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, 10, null); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    if (p.introducedWeek === null) {
      if (!inheritedScene) throw new Error('缺少原镜与原成人的真实来源。');
      p.introducedWeek = week; p.introducedDate = structuredClone(date); p.source = structuredClone(inheritedScene);
      p.mirrorA = structuredClone(inheritedScene.snapshot.mirrorA); p.mirrorB = structuredClone(inheritedScene.snapshot.mirrorB);
      p.vera = { ...structuredClone(inheritedScene.snapshot.vera), location: 'SOURCE_START', energy: 100, travelMetres: 0, mirrorConsent: 'UNASKED', boxConsent: 'UNASKED' };
      p.marcus = { ...structuredClone(inheritedScene.snapshot.marcus), location: 'SOURCE_B', energy: 100, travelMetres: 0, mirrorConsent: 'UNASKED', boxConsent: 'UNASKED' };
    }
    walk(l, 'A', null); elapse(l, 4, null); walk(l, 'ENTRY', null);
    r.observation = { mirrorAId: 'UD3-MIRROR-A', mirrorBId: 'UD3-MIRROR-B', mirrorAIntact: p.mirrorA!.intact, mirrorBIntact: p.mirrorB!.intact, loadId: p.load.id, remainingLoads: p.load.remainingLoads, boxId: p.box.id, walkedMetres: 8 };
    r.status = 'OBSERVED'; r.observedWeek = week; return;
  }
  if (c.type === 'ARRIVE_VERA' || c.type === 'ARRIVE_MARCUS') { moveAdult(l, c.type === 'ARRIVE_VERA' ? 'vera' : 'marcus', 'ENTRY', c.type === 'ARRIVE_VERA' ? 2 : 24, 'SOURCE_ARRIVAL', null); return; }
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') {
    const who = c.type === 'CONSENT_OPERATOR' ? p.marcus! : p.vera!;
    if (c.type === 'CONSENT_OPERATOR') r.operatorConsentWeek = week; else r.ownerConsentWeek = week;
    if (c.caseId === 'black-flame-channel') who.boxConsent = 'GRANTED'; else who.mirrorConsent = 'GRANTED'; elapse(l, 2, null); return;
  }
  if (c.type === 'PREPARE') {
    const a = freshAttempt(week, c.method, c.caseId, p); r.attempts.push(a); r.preparations++; r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId;
    const plate = currentPlate(p, a); plate.status = 'PLAYER'; plate.location = 'PLAYER'; plate.paidPennies = 20; plate.preparedWeek = week;
    if (c.caseId === 'black-flame-channel') p.residue = { id: 'CD2-RESIDUE-1', ownerId: 'UD3-MARCUS', quantity: 1, fictional: true, biological: false, origin: 'ADULT_WORKSHOP_CUSTODIAN', acquiredWithPlateId: 'CD2-PLATE-2', sealed: true, status: 'CONTAINED', location: 'PLAYER', acquiredWeek: week };
    elapse(l, 4, a); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, 4, null); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) {
    a.closed = true; a.operatorConsent = 'CLOSED'; if (a.ownerConsent !== 'WITHDRAWN') a.ownerConsent = 'CLOSED'; a.routeConsent = 'CLOSED';
    if (c.caseId === 'black-flame-channel') { p.vera!.boxConsent = 'CLOSED'; p.marcus!.boxConsent = 'CLOSED'; }
    else { if (p.vera!.mirrorConsent !== 'WITHDRAWN') p.vera!.mirrorConsent = 'CLOSED'; p.marcus!.mirrorConsent = 'CLOSED'; }
    r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, 2, a); a.siteAtClose = structuredClone(p); l.activeCase = null; return;
  }
  const plate = currentPlate(p, a);
  switch (c.type) {
    case 'WALK': walk(l, c.to, a); break;
    case 'INSTALL_PLATE':
      plate.status = 'INSTALLED'; plate.location = c.caseId === 'mirror-screen' ? 'A' : 'BOX'; a.plateInstalled = true;
      if (c.caseId === 'black-flame-channel') { p.residue!.location = 'BOX'; p.box.state = 'OPEN'; } elapse(l, 4, a); break;
    case 'REMOVE_PLATE': plate.location = 'PLAYER'; if (plate.charges === 1) plate.status = 'PLAYER'; elapse(l, 2, a); break;
    case 'SCREEN_MIRROR':
      a.abilityTier = tier; a.spiritualitySpent += 6; r.status = 'ACTIVE'; elapse(l, 4, a); a.window = success(tier) ? 'ACTIVE' : 'FAILED';
      if (success(tier)) { a.windowExpiresAt = p.clockSeconds + 30; p.screen = { active: true, mirrorId: 'UD3-MIRROR-A', expiresAt: a.windowExpiresAt, plateId: 'CD2-PLATE-1' }; } break;
    case 'APPLY_LOAD': {
      const protectedLoad = screenApplies(p); p.load.remainingLoads = 0; p.load.appliedLoads = 1; p.load.bufferedForce = protectedLoad ? 5 : 0; p.load.finalForce = protectedLoad ? 7 : 12;
      plate.charges = 0; plate.status = 'CONSUMED'; plate.wear = 5; a.loadApplied = true; a.plateWear = 5;
      if (protectedLoad) { a.bufferedForce = 5; a.appliedAbilityIds.push('assassin.s2.mirror-screen'); a.window = 'APPLIED'; }
      else { p.playerEnergy -= 5; a.energySpent += 5; if (a.window === 'ACTIVE') a.window = 'EXPIRED'; }
      closeScreen(p); elapse(l, 4, a); r.status = 'ACTIVE'; break;
    }
    case 'CLOSE_BOX': p.box.state = 'CLOSED'; a.boxClosed = true; elapse(l, 2, a); break;
    case 'MOVE_ADULTS_OUTSIDE': moveAdult(l, 'vera', 'OUTSIDE', 2, 'WALK', a); moveAdult(l, 'marcus', 'OUTSIDE', 2, 'WALK', a); a.clearanceConfirmed = true; break;
    case 'CHANNEL_BLACK_FLAME':
      a.abilityTier = tier; a.spiritualitySpent += 6; r.status = 'ACTIVE'; a.window = success(tier) ? 'APPLIED' : 'FAILED'; elapse(l, 10, a);
      if (success(tier)) { p.residue!.status = 'CONSUMED'; plate.charges = 0; plate.status = 'CONSUMED'; plate.scorched = true; p.box.scorched = true; p.box.pulses = 1; p.box.pulseSeconds = 10; a.pulseApplied = true; a.appliedAbilityIds.push('assassin.s2.black-flame-channel'); } break;
    case 'COLLECT_RESIDUE': p.residue!.location = 'PLAYER'; elapse(l, 2, a); break;
    case 'SEALED_HANDOVER': p.residue!.status = 'HANDED_OVER'; p.residue!.location = 'CUSTODIAN'; p.box.handovers = 1; a.residueHandedOver = true; elapse(l, 2, a); break;
    case 'RETURN_ADULTS': moveAdult(l, 'vera', 'ENTRY', 2, 'WALK', a); moveAdult(l, 'marcus', 'ENTRY', 2, 'WALK', a); a.adultsReturned = true; break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.ownerConsent = 'WITHDRAWN'; p.vera!.mirrorConsent = 'WITHDRAWN'; elapse(l, 2, a); break;
    case 'ORDINARY_ROUTE': walk(l, 'B', a, 'ORDINARY_OUTER_ROUTE', 8); a.routeWalked = true; r.status = 'ACTIVE'; break;
    case 'RETURN_ROUTE': walk(l, 'A', a, 'ORDINARY_OUTER_ROUTE', 8); a.routeReturned = true; break;
    case 'RETURN_PLATE': plate.status = 'RETURNED'; plate.location = 'CUSTODIAN'; a.plateReturned = true; elapse(l, 2, a); break;
    case 'STOP': a.stopped = true; closeScreen(p); if (a.window === 'ACTIVE') a.window = 'STOPPED'; elapse(l, 1, a); break;
    case 'WAIT_10': a.waits++; elapse(l, 10, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, 2, a); break;
  }
}
export function applyCalamityDemonessActivity(s: SliceState, c: CalamityDemonessActivityCommand, ctx: SeerContext): void {
  const reason = blockCalamityDemonessLife(s, c); if (reason) throw new Error(reason);
  const l = s.calamityDemoness.life, source = checkSource(l, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), paid = commandCost(l, c);
  const inheritedScene = c.type === 'OBSERVE' && l.site.introducedWeek === null ? sceneHandoff(s, s.week) : null;
  const budget: CalamityDemonessLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality,
    cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind, energyBefore: l.site.playerEnergy, energyAfter: l.site.playerEnergy - paid.energy };
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  evolve(l, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); }
  else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const p = l.site; ctx.note(`馆舍附廊：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATION_LABELS[p.playerLocation]}，本场精力余${p.playerEnergy}。同一原镜与两名原成人的位置、当前许可、护片磨损及实际成本均保留。${c.type === 'WITHDRAW_PERMISSION' ? '维瑞娜当面撤回镜面许可，不得强行施术。' : c.type === 'CHANNEL_BLACK_FLAME' && success(tier) ? '只在已闭原箱内进行10秒脉冲；原片和箱体焦痕保留，未清除任何人的身体、记忆或灵魂。' : ''}`);
}
export const applyCalamityDemonessLife = applyCalamityDemonessActivity;
export const handleCalamityDemonessLife = applyCalamityDemonessActivity;
const LOCATION_LABELS: Record<CalamityDemonessLocation, string> = { ENTRY: '附廊门口', A: '原镜A前', BOX: '原收容箱前', B: '原镜B前', OUTSIDE: '接触区外', YARD: '独立后院' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<CalamityDemonessActivityCommand['type'], string> = {
  OBSERVE: '实地核对原镜、原箱与普通退路', ARRIVE_VERA: '维瑞娜从原START实走2米来到附廊', ARRIVE_MARCUS: '马库斯从原B沿旧廊实走24米来到附廊', CONSENT_OPERATOR: '当面询问原保管者本案当前许可', CONSENT_OWNER: '当面询问原主本案当前许可', PREPARE: '实付20便士领取本案唯一护片', WALK: '沿普通道路步行', INSTALL_PLATE: '亲手安装同一原片', REMOVE_PLATE: '亲手取下同一原片', SCREEN_MIRROR: '在原镜A前尝试有限镜幕', APPLY_LOAD: '施加唯一封闭测试负载', CLOSE_BOX: '在原箱前实际合上箱盖', MOVE_ADULTS_OUTSIDE: '请同一两名成人各实走2米到区外', CHANNEL_BLACK_FLAME: '向已闭原箱尝试10秒黑焰导流', COLLECT_RESIDUE: '亲手取回仍封装的原残留物', SEALED_HANDOVER: '当面交回同一封装残留物', RETURN_ADULTS: '请原两人各实走2米返回门口', WITHDRAW_PERMISSION: '听取维瑞娜当面撤回镜面许可', ORDINARY_ROUTE: '从A实走8米普通外路到B', RETURN_ROUTE: '从B沿8米普通外路回A', RETURN_PLATE: '在门口交回同一护片', STOP: '停止新的能力使用', WAIT_10: '实际等待10秒', INSPECT: '核实实际结果与收尾', LEAVE: '结束已收束的接触', CLOSE: '结束已收束的接触', WITHDRAW: '如实取消并结束接触', REPORT: '如实报告本案', REFLECT: '反思三次实践',
};
export const CALAMITY_DEMONESS_LIFE_STORY = '同一维瑞娜46岁、马库斯41岁与两面原镜延续此前经历。两人须从旧位置沿普通路真正走来，按本案重新给出当前许可。每案实付20便士领取一枚唯一护片，换案不补精力。镜幕6灵性、知识20，成功窗口30秒；只有实际抵去5单位封闭负载才记作应用，护片仍磨损5并消耗。黑焰导流6灵性、知识20，只对已闭原箱内的一份封装虚构残留进行10秒脉冲，箱体与原片焦痕保留。撤回案不施术，未用原片归还。三报告各25扮演、反思25，真实应用并报告的两项技巧各增8掌握。';
const CASES = [
  { id: 'mirror-screen', title: '原镜前的一次有限减势', story: '取得原主对安装护片的当前许可。本人走到原镜A前亲手安装同一护片，尝试镜幕后施加唯一12单位封闭测试负载。成功窗口内实际将力减为7，护片磨损5并消耗；失败或到期由同一普通护片承接，仍消耗并另付5精力。原镜不自动修复。' },
  { id: 'black-flame-channel', title: '闭箱内的一份真实残留', story: '原成人保管者在20便士准备中交出唯一封装虚构残留。请两人各普通走2米到区外，本人携原残留走8米到箱前、装片并实际闭箱，再尝试10秒有限导流。失败后原残留仍封装在箱中，须亲取并携回门口，待原保管者走回后当面交还；不感染人、不净化灵魂、不消除场上全部污染。' },
  { id: 'revoked-window', title: '撤回后的普通八米路线', story: '付费准备后，原维瑞娜当面撤回镜面使用许可。停止施术，交回未使用原片；也可按独立普通路线许可，实走A与B之间各8米往返，再回门口。这里不进入镜内，不产生任意镜面传送，也不给未施术的能力掌握。' },
] as const;
function costLabel(l: CalamityDemonessLifeState, c: CalamityDemonessActivityCommand): string {
  const cost = commandCost(l, c), items = [`${cost.actions}行动`]; if (cost.pennies) items.push(`${cost.pennies}便士`); if (cost.spirituality) items.push(`${cost.spirituality}灵性`); if (cost.energy) items.push(`${cost.energy}精力`);
  if (c.type === 'SCREEN_MIRROR') items.push('知识20', '成功后30秒'); if (c.type === 'CHANNEL_BLACK_FLAME') items.push('知识20', '闭箱脉冲10秒'); if (c.type === 'APPLY_LOAD') items.push('耗原片1', '实际磨损5');
  if (c.type === 'WALK') items.push(`${distance(l.site.playerLocation, c.to)}米/秒`); if (c.type === 'ORDINARY_ROUTE' || c.type === 'RETURN_ROUTE') items.push('8米/秒'); if (c.type === 'ARRIVE_VERA') items.push('原成人2米/秒'); if (c.type === 'ARRIVE_MARCUS') items.push('原成人24米/秒'); return items.join(' · ');
}
export function calamityDemonessLifeActions(s: SliceState): CalamityDemonessLifeAction[] {
  if (!promoted(s) || s.calamityDemoness.encounter.status !== 'AVAILABLE') return [];
  const l = s.calamityDemoness.life, out: CalamityDemonessLifeAction[] = [];
  const add = (command: CalamityDemonessActivityCommand) => { const reason = blockCalamityDemonessLife(s, command); out.push({ id: `CD2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: `${LABELS[command.type]}${command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方案）' : '（普通方案）' : command.type === 'WALK' ? `：${LOCATION_LABELS[command.to]}` : ''}`, cost: costLabel(l, command), enabled: reason === null, reason, command }); };
  const caseId = l.activeCase ?? CALAMITY_DEMONESS_CASE_IDS.find(id => l.cases[id].status !== 'RESOLVED');
  if (caseId) {
    const r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') {
      if (l.site.vera?.location === 'SOURCE_START') add({ type: 'ARRIVE_VERA', caseId }); if (l.site.marcus?.location === 'SOURCE_B') add({ type: 'ARRIVE_MARCUS', caseId });
      add({ type: 'CONSENT_OPERATOR', caseId }); add({ type: 'CONSENT_OWNER', caseId }); add({ type: 'PREPARE', caseId, method: 'ABILITY' }); if (caseId !== 'revoked-window') add({ type: 'PREPARE', caseId, method: 'ORDINARY' });
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (r.contactOpen && a) {
      if (a.inspected) add({ type: 'LEAVE', caseId });
      else {
        if (caseId !== 'revoked-window' && !a.plateInstalled && !a.plateReturned) add({ type: 'INSTALL_PLATE', caseId });
        if (caseId === 'mirror-screen' && !a.loadApplied) { if (a.method === 'ABILITY' && a.abilityTier === null) add({ type: 'SCREEN_MIRROR', caseId }); add({ type: 'APPLY_LOAD', caseId }); }
        if (caseId === 'black-flame-channel') {
          if (!a.clearanceConfirmed) add({ type: 'MOVE_ADULTS_OUTSIDE', caseId }); if (l.site.box.state === 'OPEN') add({ type: 'CLOSE_BOX', caseId });
          if (a.method === 'ABILITY' && a.abilityTier === null) add({ type: 'CHANNEL_BLACK_FLAME', caseId });
          if (l.site.residue?.status === 'CONTAINED') { if (l.site.residue.location === 'BOX') add({ type: 'COLLECT_RESIDUE', caseId }); add({ type: 'SEALED_HANDOVER', caseId }); }
          if (l.site.vera?.location === 'OUTSIDE') add({ type: 'RETURN_ADULTS', caseId });
        }
        if (caseId === 'revoked-window') { if (!a.permissionWithdrawn) add({ type: 'WITHDRAW_PERMISSION', caseId }); if (!a.routeWalked) add({ type: 'ORDINARY_ROUTE', caseId }); else if (!a.routeReturned) add({ type: 'RETURN_ROUTE', caseId }); }
        const plate = currentPlate(l.site, a); if (plate.location === 'A' || plate.location === 'BOX') add({ type: 'REMOVE_PLATE', caseId }); if (!a.plateReturned) add({ type: 'RETURN_PLATE', caseId });
        if (a.abilityTier !== null && a.waits < 4) add({ type: 'WAIT_10', caseId }); for (const to of LOCATIONS) if (to !== l.site.playerLocation) add({ type: 'WALK', caseId, to });
        if (!a.stopped) add({ type: 'STOP', caseId }); add({ type: 'INSPECT', caseId });
      }
    }
  } else if (!l.reflected) add({ type: 'REFLECT' }); return out;
}
export function projectCalamityDemonessLife(s: SliceState): CalamityDemonessLifeProjection {
  const l = s.calamityDemoness.life, p = s.calamityDemoness.encounter.currentSite ?? l.site;
  return { title: '原馆舍附廊的有限镜幕与闭箱', story: CALAMITY_DEMONESS_LIFE_STORY, environment: '门口0米，原镜A4米，收容箱8米，原镜B12米，区外−2米，后院−4米。附廊普通A至B路线8米；旧馆外廊18米仍是既往记录。初始精力100，普通步行每米耗1，换案不补。两名原成人各有独立位置与有限精力；既往素描、封包、登记和旧遭遇不改。',
    activeCase: l.activeCase, inside: hasCalamityDemonessLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected, site: projectCalamityDemonessPublicSite(p), ...(p.source ? { historicalScene: projectCalamityDemonessHistory(p.source)! } : {}), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: current(l) ? projectCalamityDemonessPublicAttempt(current(l)!) : null,
    cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story,
      observations: [ ...(r.observation ? ['已普通步行8米核对两面原镜、原箱和现实退路。'] : []), ...(a ? [`本案实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性，步行${a.playerTravelMetres}米、经过${a.elapsedSeconds}秒，耗${a.energySpent}精力。`, ...(a.abilityTier ? [`检定${TIER_LABELS[a.abilityTier]}；实际应用${a.appliedAbilityIds.length}项技巧。`] : []), ...(a.loadApplied ? [`封闭负载已使用，实际减势${a.bufferedForce}；原护片磨损${a.plateWear}并消耗。`] : []), ...(a.pulseApplied ? ['同一封装残留经过10秒脉冲，原护片和箱体焦痕持久保留。'] : []), ...(a.residueHandedOver ? ['同一封装残留已由本人携回并当面交还原保管者。'] : []), ...(a.permissionWithdrawn ? ['当前镜面许可已撤回，普通路线许可独立记录；未施术。'] : [])] : []) ],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力已真实应用，原人原物与实际成本保留。' : '按普通方法或停止结果收尾，不增加未应用能力的掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(projectCalamityDemonessPublicAttempt) }; }), actions: calamityDemonessLifeActions(s) };
}
export function validateCalamityDemonessSceneSource(v: unknown): v is CalamityDemonessSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'unagingDemoness.life' || !integer(v.promotionWeek, 1) || !integer(v.introducedWeek, v.promotionWeek) || !record(v.snapshot)) return false;
    const p = v.snapshot;
    if (!shape(p, ['siteId', 'vera', 'marcus', 'mirrorA', 'mirrorB', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'entry', 'shutter']) || p.siteId !== 'UD3-GALLERY' || p.playerLocation !== 'START' || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    for (const key of ['vera', 'marcus'] as const) {
      const a = p[key];
      if (!record(a) || !shape(a, ['id', 'name', 'age', 'alive', 'willing', 'location']) || typeof a.willing !== 'boolean' || !same(a, key === 'vera' ? { id: 'UD3-VERA', name: '维瑞娜·肖', age: 46, alive: true, willing: a.willing, location: 'START' } : { id: 'UD3-MARCUS', name: '马库斯·赫尔', age: 41, alive: true, willing: a.willing, location: 'B' })) return false;
    }
    for (const key of ['mirrorA', 'mirrorB'] as const) {
      const m = p[key], endpoint = key === 'mirrorA' ? 'A' : 'B';
      if (!record(m) || !shape(m, ['id', 'owner', 'quantity', 'location', 'intact']) || typeof m.intact !== 'boolean' || !same(m, { id: `UD3-MIRROR-${endpoint}`, owner: 'UD3-VERA', quantity: 1, location: endpoint, intact: m.intact })) return false;
    }
    if (!same(p.entry, { mirrorId: 'UD3-MIRROR-A', held: false, returnStepsRemaining: 0 }) || !record(p.shutter) || !shape(p.shutter, ['id', 'operator', 'location', 'state', 'remainingTests', 'closures', 'reopenings'])) return false;
    const b = p.shutter;
    return integer(b.remainingTests, 0, 1) && integer(b.closures, 0, 1) && integer(b.reopenings, 0, 1) && b.remainingTests + b.closures === 1 && b.closures === b.reopenings && same(b, { id: 'UD3-SHUTTER', operator: 'UD3-MARCUS', location: 'B', state: 'OPEN', remainingTests: b.remainingTests, closures: b.closures, reopenings: b.reopenings });
  } catch { return false; }
}
/** Structural scene checks also accept the separately validated encounter continuation. */
export function validateCalamityDemonessSiteState(v: unknown): v is CalamityDemonessSiteState {
  try {
    const initial = createCalamityDemonessSiteState(); if (!record(v) || !shape(v, Object.keys(initial))) return false; const p = v as unknown as CalamityDemonessSiteState;
    if (p.siteId !== initial.siteId || !integer(p.clockSeconds) || !integer(p.playerTravelMetres) || !integer(p.playerEnergy, 0, 100) || ![...LOCATIONS, 'YARD'].includes(p.playerLocation)) return false;
    if (p.introducedWeek === null) return same(p, initial);
    if (!integer(p.introducedWeek, 1) || !isValidGameDate(p.introducedDate) || !validateCalamityDemonessSceneSource(p.source) || p.source.introducedWeek !== p.introducedWeek) return false;
    if (!same(p.mirrorA, p.source.snapshot.mirrorA) || !same(p.mirrorB, p.source.snapshot.mirrorB)) return false;
    if (!Array.isArray(p.actorMoves) || p.actorMoves.length > 20) return false;
    for (const key of ['vera', 'marcus'] as const) {
      const a = p[key], source = p.source.snapshot[key];
      if (!record(a) || !shape(a, ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'mirrorConsent', 'boxConsent']) || !['SOURCE_START', 'SOURCE_B', 'ENTRY', 'OUTSIDE'].includes(String(a.location)) || !integer(a.energy, 0, 100) || !integer(a.travelMetres, 0, 100) || a.energy + a.travelMetres !== 100 || !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(a.mirrorConsent) || !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(a.boxConsent)) return false;
      if (!same(a, { ...source, location: a.location, energy: a.energy, travelMetres: a.travelMetres, mirrorConsent: a.mirrorConsent, boxConsent: a.boxConsent })) return false;
      let at: string = key === 'vera' ? 'SOURCE_START' : 'SOURCE_B', travel = 0;
      for (const m of p.actorMoves.filter(move => move.actorId === a.id)) {
        if (!record(m) || !shape(m, ['from', 'to', 'mode', 'metres', 'seconds', 'actorId']) || m.from !== at || m.seconds !== m.metres) return false;
        if (m.mode === 'SOURCE_ARRIVAL') { if (at !== (key === 'vera' ? 'SOURCE_START' : 'SOURCE_B') || m.to !== 'ENTRY' || m.metres !== (key === 'vera' ? 2 : 24)) return false; }
        else if (m.mode !== 'WALK' || m.metres !== 2 || !(at === 'ENTRY' && m.to === 'OUTSIDE' || at === 'OUTSIDE' && m.to === 'ENTRY')) return false;
        at = m.to; travel += m.metres;
      }
      if (at !== a.location || travel !== a.travelMetres) return false;
    }
    if (p.actorMoves.some(m => !record(m) || !['UD3-VERA', 'UD3-MARCUS'].includes(m.actorId))) return false;
    for (const key of ['load', 'box', 'screen'] as const) if (!record(p[key]) || !shape(p[key], Object.keys(initial[key]))) return false;
    const load = p.load;
    if (!integer(load.remainingLoads, 0, 1) || !integer(load.appliedLoads, 0, 1) || load.remainingLoads + load.appliedLoads !== 1 || ![0, 5].includes(load.bufferedForce) || load.finalForce !== 12 - load.bufferedForce || load.bufferedForce > 0 && load.appliedLoads !== 1 || !same(load, { ...initial.load, remainingLoads: load.remainingLoads, appliedLoads: load.appliedLoads, finalForce: load.finalForce, bufferedForce: load.bufferedForce })) return false;
    if (p.playerEnergy !== 100 - p.playerTravelMetres - (load.appliedLoads === 1 && load.bufferedForce === 0 ? 5 : 0) || p.clockSeconds < p.playerTravelMetres + p.vera!.travelMetres + p.marcus!.travelMetres) return false;
    const box = p.box;
    if (!['OPEN', 'CLOSED'].includes(box.state) || typeof box.scorched !== 'boolean' || !integer(box.pulses, 0, 1) || box.pulseSeconds !== box.pulses * 10 || box.scorched !== (box.pulses === 1) || !integer(box.handovers, 0, 1) || !same(box, { ...initial.box, state: box.state, scorched: box.scorched, pulses: box.pulses, pulseSeconds: box.pulseSeconds, handovers: box.handovers })) return false;
    if (!Array.isArray(p.plates) || p.plates.length !== 3) return false;
    for (let i = 0; i < p.plates.length; i++) {
      const plate = p.plates[i]!, original = initial.plates[i]!;
      if (!record(plate) || !shape(plate, Object.keys(original)) || !['SUPPLY', 'PLAYER', 'INSTALLED', 'CONSUMED', 'RETURNED'].includes(plate.status) || !['SUPPLY', 'PLAYER', 'A', 'BOX', 'CUSTODIAN'].includes(plate.location) || ![0, 1].includes(plate.charges) || ![0, 5].includes(plate.wear) || typeof plate.scorched !== 'boolean') return false;
      if (!same(plate, { ...original, status: plate.status, location: plate.location, charges: plate.charges, wear: plate.wear, scorched: plate.scorched, paidPennies: plate.paidPennies, preparedWeek: plate.preparedWeek })) return false;
      if (plate.status === 'SUPPLY') { if (!same(plate, original)) return false; }
      else if (plate.paidPennies !== 20 || !integer(plate.preparedWeek, p.introducedWeek) || plate.status === 'PLAYER' && (plate.location !== 'PLAYER' || plate.charges !== 1) || plate.status === 'INSTALLED' && (plate.location !== (i === 0 ? 'A' : 'BOX') || plate.charges !== 1 || i === 2) || plate.status === 'CONSUMED' && (plate.charges !== 0 || !['A', 'BOX', 'PLAYER'].includes(plate.location)) || plate.status === 'RETURNED' && plate.location !== 'CUSTODIAN') return false;
      if (plate.wear !== (i === 0 ? load.appliedLoads * 5 : 0) || plate.scorched !== (i === 1 && box.scorched) || plate.charges !== (i === 0 ? 1 - load.appliedLoads : i === 1 ? 1 - box.pulses : 1)) return false;
    }
    const residue = p.residue;
    if (p.plates[1]!.paidPennies === 0) { if (residue !== null || !same(box, initial.box)) return false; }
    else {
      if (!record(residue) || !shape(residue, ['id', 'ownerId', 'quantity', 'fictional', 'biological', 'origin', 'acquiredWithPlateId', 'sealed', 'status', 'location', 'acquiredWeek']) || !['CONTAINED', 'CONSUMED', 'HANDED_OVER'].includes(residue.status) || !['BOX', 'PLAYER', 'CUSTODIAN'].includes(residue.location) || residue.acquiredWeek !== p.plates[1]!.preparedWeek) return false;
      if (!same(residue, { id: 'CD2-RESIDUE-1', ownerId: 'UD3-MARCUS', quantity: 1, fictional: true, biological: false, origin: 'ADULT_WORKSHOP_CUSTODIAN', acquiredWithPlateId: 'CD2-PLATE-2', sealed: true, status: residue.status, location: residue.location, acquiredWeek: residue.acquiredWeek })) return false;
      if (residue.status === 'CONSUMED' ? box.pulses !== 1 || residue.location !== 'BOX' || box.state !== 'CLOSED' : box.pulses !== 0) return false;
      if (residue.status === 'HANDED_OVER' ? box.handovers !== 1 || residue.location !== 'CUSTODIAN' || box.state !== 'CLOSED' : box.handovers !== 0 || residue.location === 'CUSTODIAN') return false;
      if (box.state === 'OPEN' && (residue.status !== 'CONTAINED' || residue.location !== 'BOX')) return false;
    }
    if (p.screen.mirrorId !== 'UD3-MIRROR-A' || typeof p.screen.active !== 'boolean') return false;
    if (p.screen.active ? !integer(p.screen.expiresAt, p.clockSeconds + 1) || p.screen.plateId !== 'CD2-PLATE-1' || p.plates[0]!.status !== 'INSTALLED' || p.vera!.mirrorConsent !== 'GRANTED' || !p.mirrorA!.intact : p.screen.expiresAt !== null || p.screen.plateId !== null) return false;
    return true;
  } catch { return false; }
}
function validBudget(b: CalamityDemonessLifeBudget, cost: CalamityDemonessLifeCost, c: CalamityDemonessActivityCommand, energy: number): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'])) return false;
  for (const key of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[key])) return false;
  for (const key of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[key], 0, 120)) return false;
  for (const key of ['healthBefore', 'healthAfter'] as const) if (!integer(b[key], 1, 100)) return false;
  for (const key of ['mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'] as const) if (!integer(b[key], 0, 100)) return false;
  if (b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || b.cashAfter !== b.cashBefore - cost.pennies || b.healthAfter !== b.healthBefore || b.mindAfter !== b.mindBefore || b.energyBefore !== energy || b.energyAfter !== energy - cost.energy) return false;
  if (c.type === 'PREPARE' && b.actionsBefore < 2 || cost.spirituality > 0 && b.mindBefore <= 0) return false;
  return true;
}
export function validateCalamityDemonessLife(s: SliceState): boolean {
  try {
    const l = s.calamityDemoness?.life, promotion = s.calamityDemoness?.promotionWeek, expected = createCalamityDemonessLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, CALAMITY_DEMONESS_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateCalamityDemonessSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week) || !integer(s.unagingDemoness.promotionWeek, 1, promotion)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: CalamityDemonessLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateCalamityDemonessActivityCommand(raw.command)) return false;
      const event = raw as unknown as CalamityDemonessLifeEvent, c = event.command, wasOpen = contactOpen(expected), cost = commandCost(expected, c), b = event.budget;
      if (wasOpen && (event.week !== lastWeek || previous && !same(event.date, previous.date)) || localBlock(expected, c, event.week) || !same(event.paid, cost) || !validBudget(b, cost, c, expected.site.playerEnergy)) return false;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter || b.energyBefore !== old.energyAfter) return false; }
      const handoff = c.type === 'OBSERVE' && expected.site.introducedWeek === null ? sceneHandoff(s, event.week) : null;
      if (!same(event.inheritedScene, handoff) || handoff !== null && !validateCalamityDemonessSceneSource(handoff)) return false;
      const base = record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0;
      const name = record(event.source) && record(event.source.actor) && typeof event.source.actor.name === 'string' ? event.source.actor.name : '';
      const gender = record(event.source) && record(event.source.actor) && typeof event.source.actor.gender === 'string' ? event.source.actor.gender : '';
      const source = checkSource(expected, c, base, name, gender); if (!same(event.source, source)) return false;
      if (source) {
        if (name !== s.character.name || gender !== s.character.gender || source.baseAbility !== s.character.coreStats.knowledge || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: base, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || event.tier !== check.tier || random.cursor !== event.randomAfter) return false; nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.date, event.tier, handoff);
      if (!validateCalamityDemonessSiteState(expected.site) || expected.site.playerEnergy !== b.energyAfter) return false;
      expected.journal.push(structuredClone(event)); previous = event; lastWeek = event.week;
    }
    // The finished life scene stays immutable. Encounter owns its current continuation and validates its own full replay.
    if (!same(l, expected)) return false;
    if (s.calamityDemoness.encounter.status !== 'AVAILABLE' && (contactOpen(l) || !l.reflected || cleanupBlock(l) || !Object.values(l.cases).every(r => r.status === 'RESOLVED'))) return false;
    if (contactOpen(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.calamityDemoness.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return false;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter || l.site.playerEnergy !== b.energyAfter) return false;
    }
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['assassin.s2.mirror-screen', 'assassin.s2.black-flame-channel'] as const) { const earned = reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0); if (s.progression.mastery[id] !== earned) return false; }
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
export const validateCalamityDemonessLifeState = validateCalamityDemonessLife;
