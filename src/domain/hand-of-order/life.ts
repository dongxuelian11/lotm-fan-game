import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { ChaosHunterLifeState } from '../chaos-hunter/life.js';
import type { BalancerGuardPlate, BalancerOperationState } from '../balancer/life.js';
import { replayHandOfOrderEncounterPhysical } from './encounter.js';

export const HAND_OF_ORDER_CASE_IDS = ['paired-handover', 'measured-aftermath', 'withdrawn-boundary'] as const;
export const HAND_OF_ORDER_ACTIVITY_CASE_IDS = HAND_OF_ORDER_CASE_IDS;
export const ACTIVITY_CASE_IDS = HAND_OF_ORDER_CASE_IDS;
export type HandOfOrderCaseId = typeof HAND_OF_ORDER_CASE_IDS[number];
export type HandOfOrderLifeAbilityId = 'justiciar.s1.battlefield-division' | 'justiciar.s1.aftermath-control';
export type HandOfOrderLocation = 'START' | 'A' | 'B' | 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B';
export type HandOfOrderConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
/** The old room is not cleared or replaced. Only current locations, a real recipient's hands,
 * and the volunteer's actual mental cost are widened; every old case and item survives. */
export interface HandOfOrderSceneRoot extends Omit<ChaosHunterLifeState, 'playerLocation' | 'guide' | 'volunteer' | 'parcel' | 'line' | 'paper'> {
  playerLocation: HandOfOrderLocation;
  guide: Omit<ChaosHunterLifeState['guide'], 'location'> & { location: HandOfOrderLocation };
  volunteer: Omit<ChaosHunterLifeState['volunteer'], 'location' | 'mind'> & { location: HandOfOrderLocation; mind: number };
  parcel: Omit<ChaosHunterLifeState['parcel'], 'location' | 'holder'> & { location: HandOfOrderLocation; holder: 'GUIDE' | 'PLAYER' | 'TABLE' | 'VOLUNTEER' };
  line: Omit<ChaosHunterLifeState['line'], 'location'> & { location: HandOfOrderLocation };
  paper: Omit<ChaosHunterLifeState['paper'], 'location'> & { location: HandOfOrderLocation };
}
export type HandOfOrderSite = HandOfOrderSceneRoot;
export type HandOfOrderPhysicalState = HandOfOrderSceneRoot;
export interface HandOfOrderGuardPlate extends Omit<BalancerGuardPlate, 'location'> { location: HandOfOrderLocation }
export interface HandOfOrderSceneSource {
  promotionWeek: number;
  originals: { site: ChaosHunterLifeState; operation: BalancerOperationState; guardPlate: BalancerGuardPlate };
}
export interface HandOfOrderPendingAction {
  id: string; caseId: HandOfOrderCaseId; kind: 'HANDOVER' | 'OWN_IMPULSE'; actor: 'GUIDE' | 'PLAYER';
  target: 'CH3-MIRA' | 'PLAYER'; objectId: 'CH3-PARCEL'; visible: true; createdAt: number;
  from: 'ANNEX_A'; to: 'ANNEX_A' | 'ANNEX_B'; metres: 0 | 4; status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}
export interface HandOfOrderEffect {
  abilityId: HandOfOrderLifeAbilityId; pendingId: string; createdAt: number; expiresAt: number;
  remainingUses: 1; sourceCaseId: HandOfOrderCaseId;
}
export interface HandOfOrderOperationState {
  door: 'OPEN'; truth: BalancerOperationState['truth']; effect: BalancerOperationState['effect'];
  pending: HandOfOrderPendingAction | null; division: HandOfOrderEffect | null; aftermath: HandOfOrderEffect | null;
}
export interface HandOfOrderAnnexClearance {
  week: number; guideId: 'GUIDE'; miraId: 'CH3-MIRA'; guideConsent: 'GRANTED'; miraConsent: 'GRANTED';
  guideLocation: 'OUTSIDE'; miraLocation: 'OUTSIDE'; carriedItemIds: string[];
}
export interface HandOfOrderAnnex {
  id: 'HO1-NEIGHBOR-ANNEX'; paidWeek: number | null; paidRevision: number | null;
  placementConsent: 'UNASKED' | 'GRANTED'; supportPieces: number;
  effortSpent: number; effortLimit: 9; volunteerTravelMetres: number; clearance: HandOfOrderAnnexClearance | null;
}
const STEPS = ['OBSERVE', 'CHECK_ORIGINALS', 'CONSENT_MIRA', 'DECLINE_PERMISSION', 'SETUP_OBJECTS', 'BATTLEFIELD_DIVISION', 'AFTERMATH_CONTROL', 'COMPLETE_HANDOVER', 'APPLY_IMPACT', 'ORDINARY_BRACE', 'CANCEL_IMPULSE', 'TAKE_OBJECT', 'RETURN_OBJECTS', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_EFFECT', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type HandOfOrderActivityCommand =
  | { type: typeof STEPS[number]; caseId: HandOfOrderCaseId }
  | { type: 'PREPARE'; caseId: HandOfOrderCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WALK'; caseId: HandOfOrderCaseId; to: 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B' }
  | { type: 'ATTEMPT_HANDOVER'; caseId: HandOfOrderCaseId; response: 'COOPERATE' | 'RESIST' }
  | { type: 'EXIT_ORIGINAL' } | { type: 'RENT_ANNEX' } | { type: 'REFLECT' };
export interface HandOfOrderMovement {
  actor: 'PLAYER' | 'GUIDE' | 'CH3-MIRA'; from: HandOfOrderLocation; to: HandOfOrderLocation;
  mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[];
}
export interface HandOfOrderImpact {
  actor: 'PLAYER'; target: 'PLAYER'; objectId: 'CH3-PARCEL'; plateId: 'BA2-GUARD-PLATE'; massGrams: 350;
  visible: true; at: number; mode: 'IMPACT' | 'ORDINARY_BRACE' | 'CANCELLED';
  baseHealthLoss: 5; healthLoss: 0 | 2 | 5; plateWear: 0 | 15; aftermathApplied: boolean;
}
export interface HandOfOrderAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: HandOfOrderConsent;
  closed: boolean; inspected: boolean; stopped: boolean; permissionWithdrawn: boolean;
  originalsChecked: boolean; objectsSetup: boolean; handoverCompleted: boolean; objectRetrieved: boolean;
  divisionTier: PublicResolutionTier | null; aftermathTier: PublicResolutionTier | null;
  divisionOutcome: 'STOPPED' | 'RESISTED' | 'PROCEEDED' | null; impact: HandOfOrderImpact | null;
  effectExpired: boolean; effectStopped: boolean; resultRead: boolean; objectsReturned: boolean;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number;
  spiritualitySpent: number; mindSpent: number; healthLost: number; effortSpent: number; volunteerMindSpent: number;
  waitedSeconds: number; appliedAbilityIds: HandOfOrderLifeAbilityId[]; movements: HandOfOrderMovement[]; evidence: string[];
}
export interface HandOfOrderCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number;
  attempts: HandOfOrderAttempt[];
}
export interface HandOfOrderLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: number; cashGained: 0 }
export interface HandOfOrderLifeBudget { actions: number; health: number; mind: number; spirituality: number; cash: number }
export interface HandOfOrderLifeCheckSource {
  abilityId: HandOfOrderLifeAbilityId; coreStat: 'knowledge'; difficulty: 18; baseAbility: number;
  actor: { name: string; gender: string; pathwayId: 'justiciar'; sequence: 1 };
  caseId: HandOfOrderCaseId; at: number; location: 'ANNEX_A'; consent: 'GRANTED'; pendingId: string;
  objectId: 'CH3-PARCEL'; plateId: 'BA2-GUARD-PLATE' | null; supportPiecesBefore: number;
}
export interface HandOfOrderLifeEvent {
  week: number; date: PublicGameDate; revision: number; command: HandOfOrderActivityCommand;
  before: HandOfOrderLifeBudget; after: HandOfOrderLifeBudget; paid: HandOfOrderLifeCost;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null;
  check: PublicCheckResult | null; tier: PublicResolutionTier | null; source: HandOfOrderLifeCheckSource | null;
  clockBefore: number; clockAfter: number; plateBefore: HandOfOrderGuardPlate; plateAfter: HandOfOrderGuardPlate;
}
export interface HandOfOrderLifeState {
  source: HandOfOrderSceneSource | null; site: HandOfOrderSite | null; guardPlate: HandOfOrderGuardPlate | null;
  operation: HandOfOrderOperationState; annex: HandOfOrderAnnex; activeCase: HandOfOrderCaseId | null;
  reflected: boolean; cases: Record<HandOfOrderCaseId, HandOfOrderCaseState>;
  movements: HandOfOrderMovement[]; journal: HandOfOrderLifeEvent[];
}
export interface HandOfOrderLifeAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null;
  command: HandOfOrderActivityCommand; cleanup?: boolean; preferredAction?: boolean;
}
export interface HandOfOrderAttemptProjection {
  method: 'ABILITY' | 'ORDINARY'; consent: HandOfOrderConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  divisionTier: PublicResolutionTier | null; aftermathTier: PublicResolutionTier | null;
  divisionOutcome: HandOfOrderAttempt['divisionOutcome']; effectRemainingSeconds: number;
  impact: Pick<HandOfOrderImpact, 'at' | 'mode' | 'healthLoss' | 'plateWear' | 'aftermathApplied'> | null;
  resultRead: boolean; objectsReturned: boolean; result: HandOfOrderAttempt['result']; elapsedSeconds: number;
  playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number;
  effortSpent: number; volunteerMindSpent: number; evidence: string[];
}
export interface HandOfOrderLifeProjection {
  title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[];
  activeCase: HandOfOrderCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: HandOfOrderLocation; playerTravelMetres: number;
  currentAttempt: HandOfOrderAttemptProjection | null;
  guardPlate: { title: string; owner: string; holder: string; location: string; integrity: number; acquired: boolean };
  site: { title: string; guide: string; volunteer: string; parcel: string; paper: string; line: string; table: string };
  annex: { title: string; paid: boolean; supportPieces: number; effortSpent: number; effortLimit: 9; volunteerMind: number; volunteerTravelMetres: number };
  pendingAction: string | null; effectRemainingSeconds: number;
  cases: { id: HandOfOrderCaseId; title: string; story: string; observations: string[]; status: string;
    method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean;
    closes: number; attempts: HandOfOrderAttemptProjection[] }[];
  actions: HandOfOrderLifeAction[];
}

const DIVISION = 'justiciar.s1.battlefield-division' as const;
const AFTERMATH = 'justiciar.s1.aftermath-control' as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 1;
const freshCase = (): HandOfOrderCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const freshOperation = (): HandOfOrderOperationState => ({ door: 'OPEN', truth: null, effect: null, pending: null, division: null, aftermath: null });
export function createHandOfOrderLifeState(): HandOfOrderLifeState {
  return { source: null, site: null, guardPlate: null, operation: freshOperation(),
    annex: { id: 'HO1-NEIGHBOR-ANNEX', paidWeek: null, paidRevision: null, placementConsent: 'UNASKED', supportPieces: 0, effortSpent: 0, effortLimit: 9, volunteerTravelMetres: 0, clearance: null },
    activeCase: null, reflected: false, cases: { 'paired-handover': freshCase(), 'measured-aftermath': freshCase(), 'withdrawn-boundary': freshCase() }, movements: [], journal: [] };
}
function fromSource(source: HandOfOrderSceneSource): HandOfOrderLifeState {
  const l = createHandOfOrderLifeState(); l.source = structuredClone(source);
  l.site = structuredClone(source.originals.site) as HandOfOrderSite;
  l.guardPlate = structuredClone(source.originals.guardPlate);
  l.operation = { ...structuredClone(source.originals.operation), pending: null, division: null, aftermath: null };
  return l;
}
/** Called once by successful acquisition; this is a snapshot, not travel or healing. */
export function initializeHandOfOrderLife(s: SliceState): void {
  if (s.handOfOrder.life.source !== null) throw new Error('新演练已经接续，不能重新领取原物或恢复磨损。');
  s.handOfOrder.life = fromSource({ promotionWeek: s.handOfOrder.promotionWeek ?? s.week,
    originals: { site: structuredClone(s.chaosHunter.life), operation: structuredClone(s.balancer.life.operation), guardPlate: structuredClone(s.balancer.life.guardPlate) } });
}
export const initializeHandOfOrderLifeState = initializeHandOfOrderLife;
export function getHandOfOrderCurrentSite(s: SliceState): HandOfOrderSite {
  return s.handOfOrder.life.site ?? s.chaosHunter.life as HandOfOrderSite;
}
const current = (l: HandOfOrderLifeState): HandOfOrderAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: HandOfOrderLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen);
const effects = (l: HandOfOrderLifeState) => l.operation.division ?? l.operation.aftermath;
function returnedAt(l: HandOfOrderLifeState, location: HandOfOrderLocation): boolean {
  const p = l.site, plate = l.guardPlate;
  return !!p && !!plate && p.playerLocation === location && p.guide.location === location && p.volunteer.location === location && !p.volunteer.willing
    && [p.parcel, p.line, p.paper].every(x => x.holder === 'GUIDE' && x.location === location)
    && plate.owner === 'PLAYER' && plate.holder === 'PLAYER' && plate.location === location && !effects(l);
}
export const hasHandOfOrderLifeLock = (s: SliceState): boolean => open(s.handOfOrder.life);
export const isHandOfOrderLifeLocked = hasHandOfOrderLifeLock;
export const handOfOrderInside = hasHandOfOrderLifeLock;
export const handOfOrderLifeClosed = (s: SliceState): boolean => !open(s.handOfOrder.life) && returnedAt(s.handOfOrder.life, 'OUTSIDE') && Object.values(s.handOfOrder.life.cases).every(r => r.status === 'RESOLVED');
export function validateHandOfOrderActivityCommand(v: unknown): v is HandOfOrderActivityCommand {
  if (!record(v)) return false;
  if (['EXIT_ORIGINAL', 'RENT_ANNEX', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!HAND_OF_ORDER_CASE_IDS.includes(v.caseId as HandOfOrderCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['OUTSIDE', 'ANNEX_A', 'ANNEX_B'].includes(String(v.to));
  if (v.type === 'ATTEMPT_HANDOVER') return shape(v, ['type', 'caseId', 'response']) && ['COOPERATE', 'RESIST'].includes(String(v.response));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isHandOfOrderLifeCommand = validateHandOfOrderActivityCommand;
export const isHandOfOrderActivityCommand = validateHandOfOrderActivityCommand;
export const isHandOfOrderActivity = validateHandOfOrderActivityCommand;
function localBlock(l: HandOfOrderLifeState, c: HandOfOrderActivityCommand, week: number): string | null {
  const p = l.site, plate = l.guardPlate;
  if (!p || !plate) return '须先完成本人的晋升并接续原现场。';
  if (c.type === 'EXIT_ORIGINAL') return !open(l) && l.annex.paidWeek === null && p.playerLocation === 'START' && p.guide.location === 'OUTSIDE' && p.volunteer.location === 'OUTSIDE' && plate.holder === 'PLAYER' && plate.location === 'START' ? null : '本人须从仍有原对手的旧房门口，实际走四米到外面；不能把旧房当作新场地。';
  if (c.type === 'RENT_ANNEX') return !open(l) && l.annex.paidWeek === null && returnedAt(l, 'OUTSIDE') ? null : '先与两位成年人及同一原物在房外会合；邻院只可付费布置一次。';
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && returnedAt(l, 'OUTSIDE') && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份如实报告，归物并实际离开邻院。';
  if (l.annex.paidWeek === null) return '须先实付40便士和1行动，取得新许可并实际布置邻院。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = HAND_OF_ORDER_CASE_IDS.indexOf(c.caseId), impulse = c.caseId === 'measured-aftermath';
  if (c.type === 'OBSERVE') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'AVAILABLE' && (index === 0 || l.cases[HAND_OF_ORDER_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先归物、离场并报告前案，再观察下一案。';
  if (c.type === 'PREPARE') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'OBSERVED' && r.attempts.length === 0 ? null : '每案只准备一次；不能重置许可、结果或有限材料。';
  if (c.type === 'REPORT') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'EXAMINED' && !!a?.closed && !!a.inspected && !!a.resultRead ? null : '须核实真实结果、当面归物、实际离场并结束本案接触。';
  if (!a || a.closed || l.activeCase !== c.caseId || !r.contactOpen || a.week !== week) return '须本周仍在进行的同一演练。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return returnedAt(l, 'OUTSIDE') && a.objectsReturned && a.inspected ? null : '可随时普通步行离开；结案前还须当面归物并核实收尾。';
  if (c.type === 'WALK') {
    const from = p.playerLocation, to = c.to;
    return (from === 'OUTSIDE' && to === 'ANNEX_A') || (from === 'ANNEX_A' && (to === 'OUTSIDE' || to === 'ANNEX_B')) || (from === 'ANNEX_B' && to === 'ANNEX_A') ? null : '只沿房外、邻院甲位、四米外乙位之间普通步行；旧房原桌不属于邻院。';
  }
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止施术，仍可普通完成、归物和离开。';
  if (c.type === 'WAIT_EFFECT') return effects(l) ? null : '没有仍在二十秒期限内的未用效果。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.consent === 'GRANTED' && !a.permissionWithdrawn && !a.resultRead ? null : '须有本案尚未撤回的当前许可；旧许可不能复用。';
  if (c.type === 'INSPECT') return returnedAt(l, 'OUTSIDE') && a.objectsReturned && a.resultRead && !a.inspected ? null : '须先亲核本案结果、归物并实际走出邻院。';
  if (a.inspected) return '本案已核实，只须结束接触并如实报告。';
  if (c.type === 'CHECK_ORIGINALS') return p.playerLocation === 'ANNEX_A' && p.guide.location === 'ANNEX_A' && p.volunteer.location === 'ANNEX_A' && !a.originalsChecked ? null : '先真实走到甲位，当面核对原人、原物及原护板。';
  if (c.type === 'CONSENT_MIRA' || c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'ANNEX_A' && a.originalsChecked && a.consent === 'UNASKED' ? null : '每案重新询问可撤回许可；不能复用旧同意或再次索取已拒绝的许可。';
  if (c.type === 'SETUP_OBJECTS') return p.playerLocation === 'ANNEX_A' && p.guide.location === 'ANNEX_A' && p.volunteer.location === 'ANNEX_A' && a.originalsChecked && a.consent !== 'UNASKED' && !a.objectsSetup && [p.parcel, p.paper, p.line].every(x => x.holder === 'GUIDE' && x.location === 'ANNEX_A') && l.annex.effortSpent + 3 <= 9 && p.volunteer.mind >= 1 ? null : '须当面核对并取得本案合作选择；每案合作消耗3额度和米拉1精神，三案总额度9。';
  if (c.type === 'RETURN_OBJECTS') return p.playerLocation === 'ANNEX_A' && p.guide.location === 'ANNEX_A' && a.resultRead && !a.objectsReturned && p.parcel.holder === 'PLAYER' && p.paper.holder === 'PLAYER' && p.parcel.location === 'ANNEX_A' && p.paper.location === 'ANNEX_A' && p.line.holder === 'FLOOR' && p.line.location === 'ANNEX_A' ? null : '须携同一原包与原纸实际回到甲位，再当面交还并收起标条。';
  if (c.type === 'TAKE_OBJECT') return !impulse && p.playerLocation === 'ANNEX_B' && p.volunteer.location === 'ANNEX_B' && a.handoverCompleted && !a.objectRetrieved && p.parcel.holder === 'VOLUNTEER' && p.parcel.location === 'ANNEX_B' ? null : '只有实际完成交接后，本人实走四米到乙位，才能从米拉手中亲取原包。';
  if (c.type === 'CANCEL_IMPULSE') return impulse && p.playerLocation === 'ANNEX_A' && a.objectsSetup && !a.impact && p.parcel.holder === 'PLAYER' ? null : '只可取消本人尚未发生的这一次冲击，普通收妥原包；不获得能力掌握。';
  if (c.type === 'ORDINARY_BRACE' || c.type === 'APPLY_IMPACT') {
    if (!impulse || p.playerLocation !== 'ANNEX_A' || !a.objectsSetup || a.impact || p.parcel.holder !== 'PLAYER' || plate.owner !== 'PLAYER' || plate.holder !== 'PLAYER' || plate.location !== 'ANNEX_A' || plate.integrity < 15) return '须本人亲持原包和至少15完整度的同一原护板；也可取消未发生的冲击并普通收尾。';
    if (c.type === 'APPLY_IMPACT' && (a.method !== 'ABILITY' || a.aftermathTier === null || a.consent !== 'GRANTED' || a.stopped || !p.volunteer.willing)) return '只能在本案当前许可下，自愿承受一次真实可见冲击；撤回后可普通支撑或取消。';
    return null;
  }
  if (c.type === 'COMPLETE_HANDOVER' || c.type === 'ATTEMPT_HANDOVER') {
    if (impulse || !a.objectsSetup || a.handoverCompleted || p.playerLocation !== 'ANNEX_A' || p.guide.location !== 'ANNEX_A' || p.volunteer.location !== 'ANNEX_B' || p.parcel.holder !== 'GUIDE' || p.parcel.location !== 'ANNEX_A' || l.operation.pending?.status !== 'PENDING') return '须是眼前仍未执行的同一原包交接；米拉自主在四米外乙位等待。';
    if (c.caseId === 'withdrawn-boundary' && a.consent === 'GRANTED') return '本案须先尊重米拉新近撤回的许可，再普通交接。';
    if (c.type === 'ATTEMPT_HANDOVER' && (a.divisionTier === null || a.divisionOutcome !== null || a.consent !== 'GRANTED' || a.stopped)) return '仅可在本案当前许可下，对已经付费尝试的同一步实际试行一次；之后仍可普通交接。';
    return null;
  }
  if (a.stopped || a.consent !== 'GRANTED' || !p.volunteer.willing) return '许可已撤回、拒绝或方案已停止；普通步行、等待、归物和退出仍可进行。';
  if (c.type === 'BATTLEFIELD_DIVISION' || c.type === 'AFTERMATH_CONTROL') {
    if (a.method !== 'ABILITY' || p.playerLocation !== 'ANNEX_A' || !a.objectsSetup || effects(l) || l.operation.pending?.status !== 'PENDING' || l.annex.supportPieces < 1) return '只可对甲位眼前的一项待执行动作施术；需要一份已付费的有限材料。';
    if (c.type === 'BATTLEFIELD_DIVISION') return !impulse && a.divisionTier === null && p.parcel.holder === 'GUIDE' && p.parcel.location === 'ANNEX_A' && p.guide.location === 'ANNEX_A' && p.volunteer.location === 'ANNEX_B' ? null : '只划分眼前这一次四米交接的跨界步骤，不能覆盖未来或未知物件。';
    return impulse && a.aftermathTier === null && plate.owner === 'PLAYER' && plate.holder === 'PLAYER' && plate.location === 'ANNEX_A' && plate.integrity >= 15 ? null : '只缓冲本人原护板接下来一次可见轻小冲击；原护板不足15完整度不能施术。';
  }
  return '本案不支持此步骤。';
}
function commandCost(c: HandOfOrderActivityCommand, tier: PublicResolutionTier | null = null, l?: HandOfOrderLifeState): HandOfOrderLifeCost {
  const cast = c.type === 'BATTLEFIELD_DIVISION' || c.type === 'AFTERMATH_CONTROL';
  return { actions: cast || ['RENT_ANNEX', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0,
    spirituality: cast ? 8 : 0, mind: cast ? tier !== null && !passed(tier) ? 4 : 2 : 0,
    pennies: c.type === 'RENT_ANNEX' ? 40 : 0,
    health: c.type === 'ORDINARY_BRACE' ? 2 : c.type === 'APPLY_IMPACT' ? l?.operation.aftermath ? 2 : 5 : 0, cashGained: 0 };
}
const reserve = (c: HandOfOrderActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? 1 : 0;
export function blockHandOfOrderLife(s: SliceState, c: HandOfOrderActivityCommand): string | null {
  if (!validateHandOfOrderActivityCommand(c)) return '秩序之手生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已成为秩序之手。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并回到贝克兰德。';
  if (s.handOfOrder.preparedWeek !== null || s.handOfOrder.encounter.preparation || s.handOfOrder.encounter.status !== 'AVAILABLE') return '先收束当前准备；后续遭遇开始后不重开三案。';
  const l = s.handOfOrder.life, reason = localBlock(l, c, s.week); if (reason) return reason;
  const cost = commandCost(c, null, l);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '须支付当前行动并预留一次有限施术；普通等待、走动、归物和取消不耗行动。';
  if (s.cash < cost.pennies) return '邻院及三份有限材料须一次实付40便士，没有免费场地或补发。';
  if (s.spirituality < cost.spirituality || cost.spirituality > 0 && s.mind < 4) return '资源不足以承担施术及失败成本；仍可普通完成和离场。';
  if ((cost.spirituality > 0 || cost.health > 0) && (s.health <= 5 || s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null))) return '先接受实际治疗并恢复到能承受演练的状态；现在可普通交接、取消冲击并归物。';
  return null;
}
export const handOfOrderActivityReason = blockHandOfOrderLife;
export function advanceHandOfOrderLifeClock(l: HandOfOrderLifeState, seconds: number): void {
  const p = l.site; if (!p || !integer(seconds) || !Number.isSafeInteger(p.clockSeconds + seconds)) throw new Error('实际现场时钟无效。');
  p.clockSeconds += seconds; const a = current(l); if (a) a.elapsedSeconds += seconds;
  for (const key of ['division', 'aftermath'] as const) if (l.operation[key] && p.clockSeconds >= l.operation[key]!.expiresAt) { l.operation[key] = null; if (a) a.effectExpired = true; }
}
function stopEffects(l: HandOfOrderLifeState): void { const a = current(l); if (effects(l) && a) a.effectStopped = true; l.operation.division = null; l.operation.aftermath = null; }
function walkActor(l: HandOfOrderLifeState, actor: HandOfOrderMovement['actor'], to: HandOfOrderLocation, countTime = true): void {
  const p = l.site!, plate = l.guardPlate!, a = current(l);
  const from = actor === 'PLAYER' ? p.playerLocation : actor === 'GUIDE' ? p.guide.location : p.volunteer.location;
  const holder = actor === 'CH3-MIRA' ? 'VOLUNTEER' : actor;
  const items = [p.parcel, p.paper, p.line].filter(x => x.holder === holder);
  const carriedPlate = plate.holder === actor;
  const m: HandOfOrderMovement = { actor, from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [...items.map(x => x.id), ...(carriedPlate ? [plate.id] : [])] };
  l.movements.push(m); if (a) a.movements.push(structuredClone(m));
  for (const item of items) item.location = to; if (carriedPlate) plate.location = to;
  if (actor === 'PLAYER') { p.playerLocation = to; p.playerTravelMetres += 4; if (a) a.playerTravelMetres += 4; }
  else if (actor === 'GUIDE') { p.guide.location = to; p.guideTravelMetres += 4; }
  else { p.volunteer.location = to; l.annex.volunteerTravelMetres += 4; }
  if (countTime) advanceHandOfOrderLifeClock(l, 4);
}
function walkTogether(l: HandOfOrderLifeState, to: HandOfOrderLocation): void {
  walkActor(l, 'GUIDE', to, false); walkActor(l, 'CH3-MIRA', to, false); walkActor(l, 'PLAYER', to);
}
function freshAttempt(week: number, date: PublicGameDate, method: HandOfOrderAttempt['method']): HandOfOrderAttempt {
  return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, inspected: false, stopped: false, permissionWithdrawn: false,
    originalsChecked: false, objectsSetup: false, handoverCompleted: false, objectRetrieved: false, divisionTier: null, aftermathTier: null, divisionOutcome: null, impact: null,
    effectExpired: false, effectStopped: false, resultRead: false, objectsReturned: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0,
    spiritualitySpent: 0, mindSpent: 0, healthLost: 0, effortSpent: 0, volunteerMindSpent: 0, waitedSeconds: 0, appliedAbilityIds: [], movements: [], evidence: [] };
}
function completeHandover(l: HandOfOrderLifeState, a: HandOfOrderAttempt): void {
  const p = l.site!; stopEffects(l); walkActor(l, 'GUIDE', 'ANNEX_B');
  p.parcel.holder = 'VOLUNTEER'; p.parcel.handovers++; a.handoverCompleted = true;
  l.operation.pending!.status = 'COMPLETED'; advanceHandOfOrderLifeClock(l, 1); walkActor(l, 'GUIDE', 'ANNEX_A');
  a.evidence.push('薇娜本人携唯一350克原包实走四米到乙位，米拉自主接过；薇娜再普通走回甲位。等待是米拉自己的合作选择。');
}
function evolve(l: HandOfOrderLifeState, c: HandOfOrderActivityCommand, week: number, date: PublicGameDate, revision: number, tier: PublicResolutionTier | null): void {
  const p = l.site!, plate = l.guardPlate!;
  if (c.type === 'EXIT_ORIGINAL') { walkActor(l, 'PLAYER', 'OUTSIDE'); return; }
  if (c.type === 'RENT_ANNEX') {
    l.annex.paidWeek = week; l.annex.paidRevision = revision; l.annex.placementConsent = 'GRANTED'; l.annex.supportPieces = 3;
    walkTogether(l, 'ANNEX_A'); walkActor(l, 'GUIDE', 'ANNEX_B'); walkActor(l, 'GUIDE', 'ANNEX_A'); walkTogether(l, 'OUTSIDE'); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; advanceHandOfOrderLifeClock(l, 6); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; advanceHandOfOrderLifeClock(l, 2); return; }
  if (c.type === 'PREPARE') { r.attempts.push(freshAttempt(week, date, c.method)); r.method = c.method; r.contactOpen = true; r.status = 'PREPARED'; l.activeCase = c.caseId; l.operation.pending = null; advanceHandOfOrderLifeClock(l, 2); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; advanceHandOfOrderLifeClock(l, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; advanceHandOfOrderLifeClock(l, 1); l.activeCase = null; l.operation.pending = null; return; }
  switch (c.type) {
    case 'WALK': {
      const firstEntry = p.playerLocation === 'OUTSIDE' && p.guide.location === 'OUTSIDE' && p.volunteer.location === 'OUTSIDE' && !a.objectsSetup;
      const groupExit = p.playerLocation === 'ANNEX_A' && c.to === 'OUTSIDE' && a.objectsReturned && p.guide.location === 'ANNEX_A' && p.volunteer.location === 'ANNEX_A';
      if (c.to === 'OUTSIDE') { stopEffects(l); if (a.objectsSetup) a.stopped = true; }
      if (firstEntry || groupExit) walkTogether(l, c.to); else walkActor(l, 'PLAYER', c.to);
      break;
    }
    case 'CHECK_ORIGINALS': a.originalsChecked = true; a.evidence.push('当面核对薇娜、43岁米拉、唯一350克原包、未改写的原纸、原标条和本人原护板；旧桌仍在旧房乙处，卡斯帕还在旧房里。'); advanceHandOfOrderLifeClock(l, 2); break;
    case 'CONSENT_MIRA': a.consent = 'GRANTED'; r.consentWeek = week; p.volunteer.willing = true; a.evidence.push('薇娜和米拉分别同意本案的有限演练，米拉可随时撤回；新许可不沿用旧房清场记录。'); advanceHandOfOrderLifeClock(l, 1); break;
    case 'DECLINE_PERMISSION': a.consent = 'DECLINED'; p.volunteer.willing = false; a.evidence.push('接受本案能力参与的拒绝；普通交接和安全收妥仍由各人自主合作。'); advanceHandOfOrderLifeClock(l, 1); break;
    case 'SETUP_OBJECTS': {
      a.objectsSetup = true; r.status = 'ACTIVE'; l.annex.effortSpent += 3; p.volunteer.mind -= 1; a.effortSpent = 3; a.volunteerMindSpent = 1;
      p.line.holder = 'FLOOR'; p.line.location = 'ANNEX_A'; p.paper.holder = 'PLAYER'; p.paper.location = 'ANNEX_A';
      const impulse = c.caseId === 'measured-aftermath';
      if (impulse) { p.parcel.holder = 'PLAYER'; p.parcel.handovers++; }
      else walkActor(l, 'CH3-MIRA', 'ANNEX_B');
      l.operation.pending = { id: `HO1:${c.caseId}:pending`, caseId: c.caseId, kind: impulse ? 'OWN_IMPULSE' : 'HANDOVER', actor: impulse ? 'PLAYER' : 'GUIDE', target: impulse ? 'PLAYER' : 'CH3-MIRA', objectId: 'CH3-PARCEL', visible: true, createdAt: p.clockSeconds, from: 'ANNEX_A', to: impulse ? 'ANNEX_A' : 'ANNEX_B', metres: impulse ? 0 : 4, status: 'PENDING' };
      a.evidence.push(impulse ? '薇娜当面交出原包，仅安排本人原护板上的一次轻小可见冲击；普通支撑也有2健康和15磨损的真实代价，可直接取消冲击。' : '米拉自主走四米到乙位等待；原包仍在甲位薇娜手中，眼前这一次交接尚未执行。原标条只是标记，不能挡住普通通行。');
      a.evidence.push('这次合作耗力3、精神1；三案合计最多耗力9，米拉可以随时停止。'); advanceHandOfOrderLifeClock(l, 1); break;
    }
    case 'BATTLEFIELD_DIVISION': case 'AFTERMATH_CONTROL': {
      const division = c.type === 'BATTLEFIELD_DIVISION'; if (division) a.divisionTier = tier; else a.aftermathTier = tier;
      a.spiritualitySpent += 8; a.mindSpent += passed(tier) ? 2 : 4; l.annex.supportPieces--; advanceHandOfOrderLifeClock(l, 1);
      if (passed(tier)) { const effect: HandOfOrderEffect = { abilityId: division ? DIVISION : AFTERMATH, pendingId: l.operation.pending!.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, remainingUses: 1, sourceCaseId: c.caseId }; if (division) l.operation.division = effect; else l.operation.aftermath = effect; }
      a.evidence.push(!passed(tier) ? '本次未成，8灵性、4精神和一份有限材料已实际消耗；普通方法仍然可行。' : division ? '只为眼前同一交接的下一步划出二十秒、一次有效的边界；尚未实际跨界，不算应用掌握。薇娜仍可抗拒并普通前行。' : '只为本人原护板接下来这一次可见轻小冲击留出二十秒缓冲；尚未发生冲击，不算应用掌握。'); break;
    }
    case 'ATTEMPT_HANDOVER': {
      const effective = !!l.operation.division && l.operation.division.pendingId === l.operation.pending!.id;
      if (effective && c.response === 'COOPERATE') { a.divisionOutcome = 'STOPPED'; l.operation.division = null; if (c.caseId === 'paired-handover') a.appliedAbilityIds.push(DIVISION); advanceHandOfOrderLifeClock(l, 1); a.evidence.push('薇娜实际尝试携原包跨界，这一次步骤在甲位止住；本人、薇娜和原包均未被搬到另一侧。一次效果已经用尽，随后仍可普通走过去完成交接。'); }
      else { a.divisionOutcome = effective && c.response === 'RESIST' ? 'RESISTED' : 'PROCEEDED'; a.evidence.push(a.divisionOutcome === 'RESISTED' ? '薇娜明确抗拒这一次有限边界，按自身动作普通携包越过；已付成本保留，没有成功应用掌握。' : '没有仍有效的边界，薇娜按当前普通动作继续携包交接。'); completeHandover(l, a); }
      break;
    }
    case 'COMPLETE_HANDOVER': completeHandover(l, a); break;
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.volunteer.willing = false; stopEffects(l); a.evidence.push('米拉明确撤回本案能力许可，未用效果立即结束且不能新施术；此前成本、真实位置和已经发生的行为不回滚。'); advanceHandOfOrderLifeClock(l, 1); break;
    case 'APPLY_IMPACT': case 'ORDINARY_BRACE': case 'CANCEL_IMPULSE': {
      const cancelled = c.type === 'CANCEL_IMPULSE', ordinary = c.type === 'ORDINARY_BRACE', applied = !cancelled && !ordinary && !!l.operation.aftermath;
      const healthLoss = cancelled ? 0 : ordinary || applied ? 2 : 5;
      a.impact = { actor: 'PLAYER', target: 'PLAYER', objectId: 'CH3-PARCEL', plateId: plate.id, massGrams: 350, visible: true, at: p.clockSeconds, mode: cancelled ? 'CANCELLED' : ordinary ? 'ORDINARY_BRACE' : 'IMPACT', baseHealthLoss: 5, healthLoss, plateWear: cancelled ? 0 : 15, aftermathApplied: applied };
      a.healthLost += healthLoss; if (!cancelled) plate.integrity -= 15; if (applied) a.appliedAbilityIds.push(AFTERMATH);
      stopEffects(l); l.operation.pending!.status = cancelled ? 'CANCELLED' : 'COMPLETED'; a.resultRead = true; a.objectRetrieved = true;
      a.evidence.push(cancelled ? '取消尚未发生的冲击，普通收妥原包；没有伤害、磨损或能力应用，也不把取消写成成功缓冲。' : `本人原包对亲持原护板发生一次可见轻小冲击，自己实际损失${healthLoss}健康、原护板磨损15；${applied ? '一次缓冲用尽' : ordinary ? '普通支撑减轻冲击，没有超凡掌握' : '没有有效缓冲，承担全部5健康后果'}，米拉没有受伤。`);
      advanceHandOfOrderLifeClock(l, 1); break;
    }
    case 'TAKE_OBJECT': p.parcel.holder = 'PLAYER'; p.parcel.handovers++; a.objectRetrieved = true; a.resultRead = true; a.evidence.push('本人实到四米外乙位，从米拉手中亲取同一原包，核实真实交接与当前所在；原纸没有被改写。'); advanceHandOfOrderLifeClock(l, 1); break;
    case 'RETURN_OBJECTS':
      stopEffects(l); p.parcel.holder = 'GUIDE'; p.paper.holder = 'GUIDE'; p.line.holder = 'GUIDE'; p.parcel.returns++; p.line.returns++; a.objectsReturned = true; p.volunteer.willing = false;
      if (p.volunteer.location === 'ANNEX_B') walkActor(l, 'CH3-MIRA', 'ANNEX_A');
      a.evidence.push('本人亲携同一原包和原纸走回甲位，当面归还薇娜并收起原标条；米拉自主回到甲位。原护板仍由本人持有，磨损不恢复。'); advanceHandOfOrderLifeClock(l, 2); break;
    case 'STOP': a.stopped = true; stopEffects(l); a.evidence.push('停止后续施术及未用效果；成本不退，尚未发生的交接仍可普通完成，原物仍须亲自归还。'); advanceHandOfOrderLifeClock(l, 1); break;
    case 'WAIT_EFFECT': { const seconds = effects(l)!.expiresAt - p.clockSeconds; a.waitedSeconds += seconds; advanceHandOfOrderLifeClock(l, seconds); a.evidence.push(`实际等待${seconds}秒至窗口到期，没有应用奖励或退款。`); break; }
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length > 0 ? 'ABILITY' : 'ORDINARY'; r.result = a.result; advanceHandOfOrderLifeClock(l, 2); break;
  }
}
function checkSource(l: HandOfOrderLifeState, c: HandOfOrderActivityCommand, knowledge: number, name: string, gender: string): HandOfOrderLifeCheckSource | null {
  if (c.type !== 'BATTLEFIELD_DIVISION' && c.type !== 'AFTERMATH_CONTROL') return null;
  return { abilityId: c.type === 'BATTLEFIELD_DIVISION' ? DIVISION : AFTERMATH, coreStat: 'knowledge', difficulty: 18, baseAbility: knowledge,
    actor: { name, gender, pathwayId: 'justiciar', sequence: 1 }, caseId: c.caseId, at: l.site!.clockSeconds,
    location: 'ANNEX_A', consent: 'GRANTED', pendingId: l.operation.pending!.id, objectId: 'CH3-PARCEL', plateId: c.type === 'AFTERMATH_CONTROL' ? 'BA2-GUARD-PLATE' : null, supportPiecesBefore: l.annex.supportPieces };
}
const budget = (s: SliceState): HandOfOrderLifeBudget => ({ actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash });
export function applyHandOfOrderActivity(s: SliceState, c: HandOfOrderActivityCommand, ctx: SeerContext): void {
  const reason = blockHandOfOrderLife(s, c); if (reason) throw new Error(reason);
  const l = s.handOfOrder.life, source = checkSource(l, c, s.character.coreStats.knowledge, s.character.name, s.character.gender);
  const before = budget(s), clockBefore = l.site!.clockSeconds, plateBefore = structuredClone(l.guardPlate!), randomCursor = s.random.cursor;
  let check: PublicCheckResult | null = null, tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 18)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier, l); s.actionsRemaining -= paid.actions; s.cash -= paid.pennies; s.health -= paid.health; s.mind -= paid.mind; s.spirituality -= paid.spirituality;
  evolve(l, c, s.week, s.date, s.revision, tier);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, command: structuredClone(c), before, after: budget(s), paid,
    randomCursor, randomBefore, randomAfter, check, tier, source, clockBefore, clockAfter: l.site!.clockSeconds, plateBefore, plateAfter: structuredClone(l.guardPlate!) });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); }
  else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`邻院演练：${LABELS[c.type]}`, `${tier ? `检定${TIERS[tier]}。` : ''}本人在${LOCATIONS[l.site!.playerLocation]}，时钟${l.site!.clockSeconds}秒。实际人、物、成本与已经发生的后果保留。`);
}
export const applyHandOfOrderLifeCommand = applyHandOfOrderActivity;
export const applyHandOfOrderLife = applyHandOfOrderActivity;
export const handleHandOfOrderLife = applyHandOfOrderActivity;

const LOCATIONS: Record<HandOfOrderLocation, string> = { START: '旧房门口', A: '旧房原标线', B: '旧房原桌旁', OUTSIDE: '房外通道', ANNEX_A: '邻院甲位', ANNEX_B: '四米外邻院乙位' };
const TIERS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<HandOfOrderActivityCommand['type'], string> = {
  EXIT_ORIGINAL: '实走四米离开旧房', RENT_ANNEX: '付费布置相邻演练区', OBSERVE: '观察本案', PREPARE: '准备本案', WALK: '普通步行',
  CHECK_ORIGINALS: '当面核对原人原物', CONSENT_MIRA: '重新询问本案许可', DECLINE_PERMISSION: '接受能力参与的拒绝', SETUP_OBJECTS: '实际安排本次交接或冲击',
  BATTLEFIELD_DIVISION: '尝试划分这一次跨界步骤', AFTERMATH_CONTROL: '尝试控制本人一次冲击的余波', ATTEMPT_HANDOVER: '实际试行这一次交接', COMPLETE_HANDOVER: '普通携包完成交接',
  APPLY_IMPACT: '自愿承受一次可见轻小冲击', ORDINARY_BRACE: '普通支撑原护板', CANCEL_IMPULSE: '取消未发生的冲击', TAKE_OBJECT: '当面亲取原包', RETURN_OBJECTS: '当面归还同一原物',
  WITHDRAW_PERMISSION: '尊重本案许可撤回', STOP: '停止后续施术', WAIT_EFFECT: '实际等待效果到期', INSPECT: '核实真实收尾', LEAVE: '结束本案接触', CLOSE: '结束本案接触', WITHDRAW: '结束本案接触', REPORT: '如实报告本案', REFLECT: '反思三案的真实边界',
};
export const HAND_OF_ORDER_LIFE_STORY = '同一身体先离开仍有原对手的旧房，再实付布置相邻场地。划分只影响眼前一次待执行的跨界步骤；余波控制只有限减轻本人原护板上的一次可见轻小冲击。真实人物始终保有独立意愿，普通方法和退出始终存在。';
export const HAND_OF_ORDER_LIFE_ENVIRONMENT = '邻院甲、乙两位相距四米，甲位到房外也是四米。新场地与三份有限材料实付40便士和1行动。每次施术另耗1行动、8灵性、成功2精神或失败4精神，知识18检定，只留二十秒一次窗口。每案合作另消耗3额度与米拉1精神，三案额度总计9；不凭施术增加掌握。';
const CASES: readonly { id: HandOfOrderCaseId; title: string; story: string }[] = [
  { id: 'paired-handover', title: '仍未执行的一次原包交接', story: '米拉自主在四米外等候，原包还在薇娜手中。只划分眼前一次跨界步骤；实际止步才算应用，抗拒或失败仍按普通动作继续。之后亲取、归物并报告。' },
  { id: 'measured-aftermath', title: '本人原护板的一次轻小余波', story: '可见冲击原本损失5健康；有效缓冲或普通支撑各损失2健康，实际发生都会磨损原护板15完整度。普通支撑没有超凡奖励，也可取消尚未发生的冲击。' },
  { id: 'withdrawn-boundary', title: '撤回许可后的普通交接', story: '米拉在本案交接尚未发生前撤回当前许可，未用效果立刻终止。各人随后按普通意愿交接和归物，不退此前成本，不给能力应用奖励。' },
];
function preferred(s: SliceState, actions: HandOfOrderLifeAction[]): HandOfOrderLifeAction | undefined {
  const l = s.handOfOrder.life, p = l.site, a = current(l), enabled = actions.filter(x => x.enabled);
  const pick = (type: HandOfOrderActivityCommand['type']) => enabled.find(x => x.command.type === type);
  const walk = (to: 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B') => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!p) return undefined;
  if (l.annex.paidWeek === null) return pick('EXIT_ORIGINAL') ?? pick('RENT_ANNEX');
  if (!a) return pick('REPORT') ?? pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (p.playerLocation === 'OUTSIDE') return a.objectsReturned ? pick('INSPECT') : walk('ANNEX_A');
  if (p.playerLocation === 'ANNEX_B') return pick('TAKE_OBJECT') ?? walk('ANNEX_A');
  if (!a.objectsSetup) return pick('CHECK_ORIGINALS') ?? pick('CONSENT_MIRA') ?? pick('SETUP_OBJECTS');
  if (a.objectsReturned) return walk('OUTSIDE');
  if (l.activeCase === 'measured-aftermath') {
    if (a.impact) return pick('RETURN_OBJECTS');
    return pick('AFTERMATH_CONTROL') ?? (l.operation.aftermath ? pick('APPLY_IMPACT') : undefined) ?? pick('ORDINARY_BRACE') ?? pick('CANCEL_IMPULSE');
  }
  if (a.objectRetrieved) return pick('RETURN_OBJECTS');
  if (a.handoverCompleted) return walk('ANNEX_B');
  if (l.activeCase === 'withdrawn-boundary' && a.consent === 'GRANTED') return pick('BATTLEFIELD_DIVISION') ?? pick('WITHDRAW_PERMISSION');
  return pick('BATTLEFIELD_DIVISION') ?? enabled.find(x => x.command.type === 'ATTEMPT_HANDOVER' && x.command.response === 'COOPERATE') ?? pick('COMPLETE_HANDOVER');
}
export function handOfOrderLifeActions(s: SliceState): HandOfOrderLifeAction[] {
  const l = s.handOfOrder.life;
  if (!promoted(s) || !l.site || s.handOfOrder.encounter.status !== 'AVAILABLE' || s.handOfOrder.encounter.preparation) return [];
  const out: HandOfOrderLifeAction[] = [];
  const add = (command: HandOfOrderActivityCommand) => {
    const reason = blockHandOfOrderLife(s, command), paid = commandCost(command, null, l), cost = [`${paid.actions}行动`];
    if (paid.pennies) cost.push(`${paid.pennies}便士`);
    if (paid.spirituality) cost.push('8灵性', '成功2精神／失败4精神', '知识18', '1份有限材料');
    if (paid.health) cost.push(`本人${paid.health}健康`, '原护板15完整度');
    if (command.type === 'SETUP_OBJECTS') cost.push('3合作额度', '米拉1精神');
    if (command.type === 'WALK' || command.type === 'EXIT_ORIGINAL') cost.push('实走4米／4秒');
    if (command.type === 'WAIT_EFFECT') cost.push(`${Math.max(0, (effects(l)?.expiresAt ?? l.site!.clockSeconds) - l.site!.clockSeconds)}秒`);
    const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : command.type === 'ATTEMPT_HANDOVER' ? command.response === 'COOPERATE' ? '（观察是否止步）' : '（薇娜自主抗拒）' : '';
    out.push({ id: `HO1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'WALK' ? `:${command.to}` : command.type === 'PREPARE' ? `:${command.method}` : command.type === 'ATTEMPT_HANDOVER' ? `:${command.response}` : ''}`,
      label: LABELS[command.type] + suffix, cost: cost.join(' · '), enabled: reason === null, reason, command,
      cleanup: ['WALK', 'STOP', 'WITHDRAW_PERMISSION', 'WAIT_EFFECT', 'CANCEL_IMPULSE', 'COMPLETE_HANDOVER', 'TAKE_OBJECT', 'RETURN_OBJECTS', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'EXIT_ORIGINAL'].includes(command.type) });
  };
  if (l.annex.paidWeek === null) { add({ type: l.site.playerLocation === 'START' ? 'EXIT_ORIGINAL' : 'RENT_ANNEX' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const id = l.activeCase ?? HAND_OF_ORDER_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const r = l.cases[id];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const c: HandOfOrderActivityCommand = { type, caseId: id }; if (!localBlock(l, c, s.week)) add(c); }
    for (const to of ['OUTSIDE', 'ANNEX_A', 'ANNEX_B'] as const) { const c: HandOfOrderActivityCommand = { type: 'WALK', caseId: id, to }; if (!localBlock(l, c, s.week)) add(c); }
    for (const response of ['COOPERATE', 'RESIST'] as const) { const c: HandOfOrderActivityCommand = { type: 'ATTEMPT_HANDOVER', caseId: id, response }; if (!localBlock(l, c, s.week)) add(c); }
  }
  const next = preferred(s, out); if (next) next.preferredAction = true;
  return out;
}
function projectAttempt(a: HandOfOrderAttempt, l: HandOfOrderLifeState): HandOfOrderAttemptProjection {
  const effect = current(l) === a ? effects(l) : null;
  return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, permissionWithdrawn: a.permissionWithdrawn,
    divisionTier: a.divisionTier, aftermathTier: a.aftermathTier, divisionOutcome: a.divisionOutcome,
    effectRemainingSeconds: effect ? Math.max(0, effect.expiresAt - l.site!.clockSeconds) : 0,
    impact: a.impact ? { at: a.impact.at, mode: a.impact.mode, healthLoss: a.impact.healthLoss, plateWear: a.impact.plateWear, aftermathApplied: a.impact.aftermathApplied } : null,
    resultRead: a.resultRead, objectsReturned: a.objectsReturned, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres,
    spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, healthLost: a.healthLost, effortSpent: a.effortSpent, volunteerMindSpent: a.volunteerMindSpent, evidence: [...a.evidence] };
}
export function projectHandOfOrderLife(s: SliceState): HandOfOrderLifeProjection {
  const l = s.handOfOrder.life, p: HandOfOrderSite = l.site ?? s.chaosHunter.life as HandOfOrderSite, plate = l.guardPlate ?? s.balancer.life.guardPlate;
  const a = current(l), actions = handOfOrderLifeActions(s), next = preferred(s, actions), pending = l.operation.pending, effect = effects(l);
  return { title: '邻院的有限划分与余波控制', story: HAND_OF_ORDER_LIFE_STORY, environment: HAND_OF_ORDER_LIFE_ENVIRONMENT,
    nextStep: next?.label ?? (l.reflected ? '三案已如实收束，原人的选择、原物、护板磨损与成本继续保留。' : '先支付必要行动或完成眼前普通收尾。'), preferredActionId: next?.id ?? null,
    facts: [`原身体在${LOCATIONS[p.playerLocation]}，累计普通步行${p.playerTravelMetres}米，时钟${p.clockSeconds}秒。`,
      `43岁米拉仍活着，健康${p.volunteer.health}、精神${p.volunteer.mind}；她保有独立意愿，当前在${LOCATIONS[p.volunteer.location]}。`,
      `旧桌仍留在旧房；卡斯帕仍在原处抵抗，埃德里克和罗文此前已自主停手。`,
      `同一350克原封包只有一个；原纸仍写“${p.paper.text}”，原标条不是墙。`,
      `本人原护板完整度${plate.integrity}/65；这块实际购买的原物没有补发或恢复磨损。`,
      `本阶段合作已用${l.annex.effortSpent}/9额度，已付费有限材料剩${l.annex.supportPieces}份。`,
      '每个二十秒窗口仅针对眼前同一项待执行动作；施术本身不奖掌握。撤回或失败后仍可普通行动。'],
    activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres,
    currentAttempt: a ? projectAttempt(a, l) : null,
    guardPlate: { title: '本人同一原护板', owner: plate.owner === 'PLAYER' ? '本人' : '薇娜', holder: plate.holder === 'PLAYER' ? '本人亲持' : plate.holder === 'GUIDE' ? '薇娜亲持' : '地上', location: LOCATIONS[plate.location], integrity: plate.integrity, acquired: plate.acquiredWeek !== null },
    site: { title: l.annex.paidWeek === null ? '旧房外与待布置邻院' : '实际付费布置的相邻演练区', guide: `薇娜·贝尔在${LOCATIONS[p.guide.location]}`, volunteer: `米拉·佩恩在${LOCATIONS[p.volunteer.location]}`,
      parcel: `唯一350克原包在${LOCATIONS[p.parcel.location]}，${p.parcel.holder === 'GUIDE' ? '薇娜亲持' : p.parcel.holder === 'PLAYER' ? '本人亲持' : p.parcel.holder === 'VOLUNTEER' ? '米拉亲持' : '放在旧房原桌上'}`,
      paper: `同一原纸在${LOCATIONS[p.paper.location]}`, line: `同一原标条在${LOCATIONS[p.line.location]}`, table: '旧房的同一原桌仍留在旧房乙处，没有移到邻院。' },
    annex: { title: '相邻演练区', paid: l.annex.paidWeek !== null, supportPieces: l.annex.supportPieces, effortSpent: l.annex.effortSpent, effortLimit: 9, volunteerMind: p.volunteer.mind, volunteerTravelMetres: l.annex.volunteerTravelMetres },
    pendingAction: pending?.status === 'PENDING' ? pending.kind === 'HANDOVER' ? '原包仍在薇娜手中，四米交接尚未完成。' : '本人原护板上的一次轻小可见冲击尚未发生。' : null,
    effectRemainingSeconds: effect ? Math.max(0, effect.expiresAt - p.clockSeconds) : 0,
    cases: CASES.map(d => { const r = l.cases[d.id]; return { ...d, observations: r.attempts.flatMap(x => [...x.evidence]), status: r.status, method: r.method,
      result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已经核实真实有限应用，原物实际归还。' : '如实记录普通完成或取消；未应用的能力不增加掌握。',
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => projectAttempt(x, l)) }; }), actions };
}

/** Checks immutable original identities/history and bounded current physical fields only.
 * Journal replay below establishes the actual positions and costs. */
export function validateHandOfOrderSceneOriginal(v: unknown, original?: ChaosHunterLifeState): v is HandOfOrderSite {
  try {
    if (!record(v)) return false; const p = v as unknown as HandOfOrderSite;
    if (p.siteId !== 'CH3-LINE-PRACTICE' || !integer(p.clockSeconds) || !integer(p.playerTravelMetres) || !integer(p.guideTravelMetres)
      || !Object.keys(LOCATIONS).includes(p.playerLocation) || !record(p.guide) || !record(p.volunteer) || !record(p.parcel) || !record(p.line) || !record(p.paper)
      || p.guide.id !== 'GUIDE' || p.guide.name !== '薇娜·贝尔' || p.volunteer.id !== 'CH3-MIRA' || p.volunteer.name !== '米拉·佩恩' || p.volunteer.age !== 43
      || p.volunteer.alive !== true || p.volunteer.independentMind !== true || p.volunteer.health !== 100 || !integer(p.volunteer.mind, 0, 100) || !same(p.volunteer.injuries, []) || typeof p.volunteer.willing !== 'boolean'
      || p.parcel.id !== 'CH3-PARCEL' || p.parcel.owner !== 'GUIDE' || p.parcel.quantity !== 1 || p.parcel.massGrams !== 350 || p.parcel.sealed !== true || p.parcel.confidential !== false
      || p.paper.id !== 'CH3-RULE-PAPER' || p.paper.owner !== 'GUIDE' || p.paper.quantity !== 1 || p.paper.text !== '本次从A到B的越线'
      || p.line.id !== 'CH3-LINE' || p.line.owner !== 'GUIDE' || p.line.quantity !== 1 || p.line.isWall !== false
      || !same(p.table, { id: 'CH3-TABLE-B', location: 'B', thirdParties: 0 }) || !integer(p.parcel.handovers) || !integer(p.parcel.returns) || !integer(p.line.returns)) return false;
    if (![p.guide, p.volunteer, p.parcel, p.line, p.paper].every(x => Object.keys(LOCATIONS).includes(x.location))) return false;
    if (!['GUIDE', 'PLAYER', 'TABLE', 'VOLUNTEER'].includes(p.parcel.holder) || !['GUIDE', 'PLAYER', 'TABLE'].includes(p.paper.holder) || !['GUIDE', 'FLOOR'].includes(p.line.holder)) return false;
    if (original) {
      if (!shape(p, Object.keys(original)) || !same(p.cases, original.cases) || p.reflected !== original.reflected || p.activeCase !== original.activeCase || p.introducedWeek !== original.introducedWeek || !same(p.introducedDate, original.introducedDate)) return false;
      for (const key of ['guide', 'volunteer', 'parcel', 'paper', 'line'] as const) if (!shape(p[key], Object.keys(original[key]))) return false;
      if (p.clockSeconds < original.clockSeconds || p.playerTravelMetres < original.playerTravelMetres || p.guideTravelMetres < original.guideTravelMetres || p.volunteer.mind > original.volunteer.mind || p.parcel.handovers < original.parcel.handovers || p.parcel.returns < original.parcel.returns || p.line.returns < original.line.returns) return false;
    }
    return true;
  } catch { return false; }
}
export const validateHandOfOrderSite = validateHandOfOrderSceneOriginal;
export function validateHandOfOrderSceneSource(v: unknown, s: SliceState): v is HandOfOrderSceneSource {
  try {
    if (!record(v) || !shape(v, ['promotionWeek', 'originals']) || v.promotionWeek !== s.handOfOrder.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !record(v.originals) || !shape(v.originals, ['site', 'operation', 'guardPlate'])) return false;
    const source = v as unknown as HandOfOrderSceneSource, p = source.originals.site as HandOfOrderSite, plate = source.originals.guardPlate;
    if (!same(source.originals.site, s.chaosHunter.life) || !same(source.originals.operation, s.balancer.life.operation) || !same(plate, s.balancer.life.guardPlate) || !validateHandOfOrderSceneOriginal(p, s.chaosHunter.life)) return false;
    return p.playerLocation === 'START' && p.guide.location === 'OUTSIDE' && p.volunteer.location === 'OUTSIDE' && p.volunteer.willing === false && p.volunteer.mind === 100
      && [p.parcel, p.paper, p.line].every(x => x.holder === 'GUIDE' && x.location === 'OUTSIDE')
      && plate.id === 'BA2-GUARD-PLATE' && plate.owner === 'PLAYER' && plate.holder === 'PLAYER' && plate.location === 'START' && integer(plate.integrity, 0, 65) && integer(plate.acquiredWeek, 1, s.week)
      && same(source.originals.operation, { door: 'OPEN', truth: null, effect: null });
  } catch { return false; }
}
function validBudget(before: HandOfOrderLifeBudget, after: HandOfOrderLifeBudget, paid: HandOfOrderLifeCost, c: HandOfOrderActivityCommand): boolean {
  const keys = ['actions', 'health', 'mind', 'spirituality', 'cash'];
  if (!record(before) || !record(after) || !shape(before, keys) || !shape(after, keys)) return false;
  for (const b of [before, after]) if (!integer(b.actions) || !integer(b.cash) || !integer(b.health, 1, 100) || !integer(b.mind, 0, 100) || !integer(b.spirituality, 0, 120)) return false;
  return before.actions >= paid.actions + reserve(c) && (!paid.spirituality || before.mind >= 4 && before.health > 5) && (!paid.health || before.health > 5)
    && after.actions === before.actions - paid.actions && after.health === before.health - paid.health && after.mind === before.mind - paid.mind && after.spirituality === before.spirituality - paid.spirituality && after.cash === before.cash - paid.pennies;
}
interface LifeReplay { root: HandOfOrderSite; guardPlate: HandOfOrderGuardPlate; life: HandOfOrderLifeState }
function replayLife(s: SliceState): LifeReplay | null {
  try {
    const l = s.handOfOrder?.life, blank = createHandOfOrderLifeState();
    if (!record(l) || !shape(l, Object.keys(blank)) || !validateHandOfOrderSceneSource(l.source, s) || !record(l.cases) || !shape(l.cases, HAND_OF_ORDER_CASE_IDS) || !Array.isArray(l.journal) || !Array.isArray(l.movements) || !validateHandOfOrderSceneOriginal(l.site, l.source.originals.site)) return null;
    const expected = fromSource(l.source); let previous: HandOfOrderLifeEvent | null = null, lastWeek = l.source.promotionWeek, revision = 0, cursor = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'before', 'after', 'paid', 'randomCursor', 'randomBefore', 'randomAfter', 'check', 'tier', 'source', 'clockBefore', 'clockAfter', 'plateBefore', 'plateAfter'])
        || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0
        || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateHandOfOrderActivityCommand(raw.command)) return null;
      const e = raw as unknown as HandOfOrderLifeEvent, c = e.command, wasOpen = open(expected), paid = commandCost(c, e.tier, expected);
      if (!integer(e.randomCursor, cursor, s.random.cursor) || e.clockBefore !== expected.site!.clockSeconds || !same(e.plateBefore, expected.guardPlate) || localBlock(expected, c, e.week) || !same(e.paid, paid) || !validBudget(e.before, e.after, paid, c)) return null;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date))) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0) && (!same(e.before, previous.after) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source && base > s.character.coreStats.knowledge) return null;
      const source = checkSource(expected, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return null;
      if (source) {
        if (e.randomBefore !== e.randomCursor || !integer(e.randomBefore, cursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: base, difficulty: 18, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return null;
      } else if (e.randomBefore !== null || e.randomAfter !== null || e.check !== null || e.tier !== null) return null;
      evolve(expected, c, e.week, e.date, e.revision, e.tier);
      if (e.clockAfter !== expected.site!.clockSeconds || !same(e.plateAfter, expected.guardPlate)) return null;
      expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision; cursor = e.randomAfter ?? e.randomCursor;
    }
    if (!same({ ...l, site: expected.site, guardPlate: expected.guardPlate }, expected)) return null;
    if (open(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.handOfOrder.encounter.preparation || s.handOfOrder.encounter.status !== 'AVAILABLE'
        || !previous || previous.week !== s.week || !same(previous.date, s.date) || s.random.cursor !== cursor || !same(budget(s), previous.after)) return null;
    }
    if (previous && !s.handOfOrder.encounter.preparation && s.revision === previous.revision + 1 && previous.week === s.week && previous.after.actions > 0 && (s.random.cursor !== cursor || !same(budget(s), previous.after))) return null;
    return { root: expected.site!, guardPlate: expected.guardPlate!, life: expected };
  } catch { return null; }
}
export function replayHandOfOrderLifeRoot(s: SliceState): HandOfOrderSite | null { return replayLife(s)?.root ?? null; }
export const replayHandOfOrderLifeSite = replayHandOfOrderLifeRoot;
export function replayHandOfOrderLifeGuardPlate(s: SliceState): HandOfOrderGuardPlate | null { return replayLife(s)?.guardPlate ?? null; }
export function getHandOfOrderLifeMasteryGains(l: HandOfOrderLifeState): Record<HandOfOrderLifeAbilityId, number> {
  const gains = { [DIVISION]: 0, [AFTERMATH]: 0 };
  for (const id of HAND_OF_ORDER_CASE_IDS) { const r = l.cases[id]; if (r.status === 'RESOLVED') for (const ability of r.attempts.at(-1)?.appliedAbilityIds ?? []) gains[ability] += 8; }
  return gains;
}
export const handOfOrderLifeMasteryGains = (s: SliceState): Record<HandOfOrderLifeAbilityId, number> => getHandOfOrderLifeMasteryGains(s.handOfOrder.life);
export function validateHandOfOrderLifeState(s: SliceState): boolean {
  try {
    const l = s.handOfOrder?.life;
    if (l?.source === null) return s.handOfOrder.promotionWeek === null && same(l, createHandOfOrderLifeState());
    const replay = replayLife(s); if (!replay) return false;
    if (!s.handOfOrder.encounter.preparation) return same(l.site, replay.root) && same(l.guardPlate, replay.guardPlate);
    if (open(l) || !l.reflected || !returnedAt(replay.life, 'OUTSIDE') || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false;
    const physical = replayHandOfOrderEncounterPhysical(s, replay.root, replay.guardPlate);
    return !!physical && same(l.site, physical.site) && same(l.guardPlate, physical.guardPlate);
  } catch { return false; }
}
export const validateHandOfOrderLife = validateHandOfOrderLifeState;
