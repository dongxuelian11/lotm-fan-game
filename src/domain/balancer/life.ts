import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createChaosHunterLifeState, validateChaosHunterLifeOriginal, type ChaosHunterLifeState } from '../chaos-hunter/life.js';
import { replayBalancerEncounterRoot, replayBalancerEncounterGuardPlate } from './encounter.js';

export const BALANCER_CASE_IDS = ['visible-imbalance', 'withdrawn-inspection', 'measured-impact'] as const;
export const BALANCER_ACTIVITY_CASE_IDS = BALANCER_CASE_IDS;
export const ACTIVITY_CASE_IDS = BALANCER_CASE_IDS;
export type BalancerCaseId = typeof BALANCER_CASE_IDS[number];
export type BalancerLifeAbilityId = 'justiciar.s2.imbalance-sensing' | 'justiciar.s2.measured-resistance';
export type BalancerLocation = 'START' | 'A' | 'B';
export type BalancerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
/** The original room and original objects, widened only for an actual exit and placing the original paper on its table. */
export interface BalancerSceneRoot extends Omit<ChaosHunterLifeState, 'guide' | 'volunteer' | 'parcel' | 'paper' | 'line' | 'playerLocation'> {
  playerLocation: BalancerLocation;
  guide: Omit<ChaosHunterLifeState['guide'], 'location'> & { location: BalancerLocation | 'OUTSIDE' };
  volunteer: Omit<ChaosHunterLifeState['volunteer'], 'location'> & { location: 'A' | 'B' | 'OUTSIDE' };
  parcel: Omit<ChaosHunterLifeState['parcel'], 'location'> & { location: BalancerLocation | 'OUTSIDE' };
  paper: Omit<ChaosHunterLifeState['paper'], 'location' | 'holder'> & { location: BalancerLocation | 'OUTSIDE'; holder: 'GUIDE' | 'PLAYER' | 'TABLE' };
  line: Omit<ChaosHunterLifeState['line'], 'location'> & { location: 'START' | 'A' | 'OUTSIDE' };
}
export type BalancerPhysicalState = BalancerSceneRoot;
export interface BalancerGuardPlate { id: 'BA2-GUARD-PLATE'; owner: 'GUIDE' | 'PLAYER'; holder: 'GUIDE' | 'PLAYER' | 'GROUND'; location: BalancerLocation | 'OUTSIDE'; integrity: number; acquiredWeek: number | null }
export interface BalancerSceneSource { root: 'chaosHunter.life'; promotionWeek: number; introducedWeek: number; snapshot: ChaosHunterLifeState; guardPlate: BalancerGuardPlate }
const STEPS = ['OBSERVE', 'CHECK_ORIGINALS', 'CONSENT_MIRA', 'DECLINE_PERMISSION', 'SETUP_OBJECTS', 'IMBALANCE_SENSING', 'WITHDRAW_PERMISSION', 'REMOVE_COVER', 'MANUAL_INSPECTION', 'TAKE_PARCEL', 'MEASURED_RESISTANCE', 'APPLY_IMPACT', 'ORDINARY_BRACE', 'TAKE_OBJECT', 'RETURN_OBJECTS', 'WAIT_EFFECT', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type BalancerActivityCommand = { type: typeof STEPS[number]; caseId: BalancerCaseId } | { type: 'PREPARE'; caseId: BalancerCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: BalancerCaseId; to: BalancerLocation } | { type: 'REFLECT' } | { type: 'BUY_GUARD_PLATE' };
export interface BalancerMovement { from: BalancerLocation; to: BalancerLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
/** Physical truth is produced by guide movement, never by a successful check or an answer string. */
export interface BalancerPhysicalTruth { objectId: 'CH3-PARCEL'; location: 'B'; tableId: 'CH3-TABLE-B'; referenceOffsetMm: 0; displacementMm: 120; obscuredByPaper: boolean; placedAt: number }
export interface BalancerObservation { kind: 'UNRESOLVED' | 'VISIBLE_DEVIATION' | 'OBSCURED'; displacementMm: number | null; at: number }
export interface BalancerResistanceEffect { actor: 'PLAYER'; target: 'PLAYER'; plateId: 'BA2-GUARD-PLATE'; objectId: 'CH3-PARCEL'; createdAt: number; expiresAt: number; remainingUses: 1; sourceCaseId: 'measured-impact' }
export interface BalancerImpact { actor: 'PLAYER'; target: 'PLAYER'; objectId: 'CH3-PARCEL'; massGrams: 350; visible: true; at: number; mode: 'IMPACT' | 'ORDINARY_BRACE'; baseHealthLoss: 5; healthLoss: 0 | 2 | 5; plateWear: 0 | 15; resistanceApplied: boolean }
export interface BalancerOperationState { door: 'OPEN'; truth: BalancerPhysicalTruth | null; effect: BalancerResistanceEffect | null }
export interface BalancerAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: BalancerConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  originalsChecked: boolean; objectsSetup: boolean; parcelTaken: boolean; sensingTier: PublicResolutionTier | null; resistanceTier: PublicResolutionTier | null;
  sensingAnswer: BalancerObservation | null; verifiedOffsetMm: number | null; coverRemoved: boolean; impact: BalancerImpact | null; effectExpired: boolean; effectStopped: boolean;
  resultRead: boolean; objectRetrieved: boolean; objectsReturned: boolean; inspected: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number; waitedSeconds: number;
  appliedAbilityIds: BalancerLifeAbilityId[]; playerMoves: BalancerMovement[]; guideMoves: BalancerMovement[]; evidence: string[];
}
export interface BalancerCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: BalancerAttempt[] }
export interface BalancerLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: number; cashGained: 0 }
export interface BalancerLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface BalancerCheckSource { caseId: BalancerCaseId; abilityId: BalancerLifeAbilityId; cost: 5 | 6; difficulty: 20; coreStat: 'perception' | 'knowledge'; baseAbility: number; actor: { pathwayId: 'justiciar'; sequence: 2; name: string; gender: string }; at: number; actorLocation: 'A'; currentConsent: 'GRANTED'; volunteerId: 'CH3-MIRA'; volunteerLocation: 'A'; objectId: 'CH3-PARCEL'; objectLocation: 'A' | 'B'; distanceMetres: 0 | 4; physicalTruth: BalancerPhysicalTruth | null; guardPlate: BalancerGuardPlate | null; nextOwnVisibleImpulseOnly: boolean }
export interface BalancerLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: BalancerActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: BalancerCheckSource | null; inheritedScene: BalancerSceneSource | null; clockBefore: number; clockAfter: number; plateBefore: BalancerGuardPlate; plateAfter: BalancerGuardPlate; paid: BalancerLifeCost; budget: BalancerLifeBudget }
export interface BalancerLifeState { source: BalancerSceneSource | null; activeCase: BalancerCaseId | null; reflected: boolean; operation: BalancerOperationState; guardPlate: BalancerGuardPlate; cases: Record<BalancerCaseId, BalancerCaseState>; journal: BalancerLifeEvent[] }
export interface BalancerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BalancerActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface BalancerAttemptProjection { method: 'ABILITY' | 'ORDINARY'; consent: BalancerConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean; sensingTier: PublicResolutionTier | null; resistanceTier: PublicResolutionTier | null; sensingAnswer: string | null; verifiedOffsetMm: number | null; effectRemainingSeconds: number; impact: Pick<BalancerImpact, 'at' | 'mode' | 'healthLoss' | 'plateWear' | 'resistanceApplied'> | null; resultRead: boolean; objectsReturned: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number; evidence: string[] }
export interface BalancerLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: BalancerCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: BalancerLocation; playerTravelMetres: number; currentAttempt: BalancerAttemptProjection | null; guardPlate: { title: string; owner: string; holder: string; location: string; integrity: number; acquired: boolean }; site: { title: string; guide: string; volunteer: string; parcel: string; paper: string; line: string }; cases: { id: BalancerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: BalancerAttemptProjection[] }[]; actions: BalancerLifeAction[] }
const SENSE = 'justiciar.s2.imbalance-sensing' as const, RESIST = 'justiciar.s2.measured-resistance' as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 2;
const site = (s: SliceState): BalancerSceneRoot => s.chaosHunter.life as BalancerSceneRoot;
const freshPlate = (): BalancerGuardPlate => ({ id: 'BA2-GUARD-PLATE', owner: 'GUIDE', holder: 'GUIDE', location: 'START', integrity: 65, acquiredWeek: null });
const freshCase = (): BalancerCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createBalancerLifeState(): BalancerLifeState { return { source: null, activeCase: null, reflected: false, operation: { door: 'OPEN', truth: null, effect: null }, guardPlate: freshPlate(), cases: { 'visible-imbalance': freshCase(), 'withdrawn-inspection': freshCase(), 'measured-impact': freshCase() }, journal: [] }; }
const current = (l: BalancerLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: BalancerLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
function cleanupBlock(l: BalancerLifeState, p: BalancerSceneRoot): string | null {
  if (l.operation.effect) return '须实际停止或等候这一次有限护持结束。';
  if (p.parcel.holder !== 'GUIDE' || p.paper.holder !== 'GUIDE' || p.line.holder !== 'GUIDE') return '须亲自取回并当面归还同一原封包、原纸和原标条。';
  if (p.playerLocation !== 'START' || p.guide.location !== 'START' || p.parcel.location !== 'START' || p.paper.location !== 'START' || p.line.location !== 'START') return '本人和薇娜须沿四米原路实际回到门口，并亲携同一原物。';
  if (l.guardPlate.location !== 'START' || l.guardPlate.holder !== l.guardPlate.owner) return '唯一护板须随它的实际持有人回到门口。';
  return p.volunteer.location !== 'A' ? '米拉本人须仍在四米处的安全旁位。' : null;
}
export const hasBalancerLifeLock = (s: SliceState): boolean => open(s.balancer.life);
export const balancerInside = hasBalancerLifeLock;
export const balancerLifeClosed = (s: SliceState): boolean => !open(s.balancer.life) && !!s.balancer.life.source && Object.values(s.balancer.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.balancer.life, site(s));
export function validateBalancerActivityCommand(v: unknown): v is BalancerActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT' || v.type === 'BUY_GUARD_PLATE') return shape(v, ['type']);
  if (!BALANCER_CASE_IDS.includes(v.caseId as BalancerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isBalancerActivityCommand = validateBalancerActivityCommand;
export const isBalancerActivity = validateBalancerActivityCommand;
function localBlock(l: BalancerLifeState, p: BalancerSceneRoot, c: BalancerActivityCommand, week: number): string | null {
  if (c.type === 'BUY_GUARD_PLATE') return !open(l) && !cleanupBlock(l, p) && same(l.guardPlate, freshPlate()) ? null : '只有薇娜门口库存中的这一块原护板可购买一次，不能补发、复制或恢复磨损。';
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并归还原物。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = BALANCER_CASE_IDS.indexOf(c.caseId), impact = c.caseId === 'measured-impact';
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[BALANCER_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再观察同一原房间。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '每案只准备一次，先观察，不能重置结果。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && !!a?.resultRead ? null : '须亲核真实结果、归物退出后才能报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实本次实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '本次已经核实，只须结束接触。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止能力方案，仍可普通完成并归还，成本不退。';
  if (c.type === 'WAIT_EFFECT') return l.operation.effect ? null : '没有仍未用完的有限护持。';
  if (c.type === 'WITHDRAW_PERMISSION') return p.playerLocation === 'A' && a.consent === 'GRANTED' && !a.permissionWithdrawn ? null : '须有本案当面取得、尚未撤回的当前许可。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!a.resultRead || !a.objectsReturned ? '先亲核真实结果并归还同一原物。' : null);
  if (c.type === 'WALK') {
    if (p.playerLocation === 'START' && c.to === 'A') return !a.playerMoves.length ? null : '每案只从门口进入一次。';
    if (p.playerLocation === 'A' && c.to === 'B') return a.objectsSetup && !a.resultRead && (impact ? a.parcelTaken : c.caseId !== 'withdrawn-inspection' || a.method !== 'ABILITY' || a.consent !== 'GRANTED') ? null : '先真实布置原物；撤回案须先接受本案明确撤回，冲击案须先亲取原包。';
    if (p.playerLocation === 'B' && c.to === 'A') return a.objectRetrieved && p.parcel.holder === 'PLAYER' && p.paper.holder === 'PLAYER' ? null : '先亲核并取回同一原包和原纸，再实走回薇娜身旁。';
    if (p.playerLocation === 'A' && c.to === 'START') return a.objectsReturned && !l.operation.effect ? null : '先归还原物并真正结束有限效果，再普通返回。';
    return '只可沿门口、四米处和原桌之间实际步行。';
  }
  if (c.type === 'CHECK_ORIGINALS') return p.playerLocation === 'A' && p.guide.location === 'A' && p.volunteer.location === 'A' && !a.originalsChecked ? null : '本人和薇娜须先实走到米拉旁，当面核对原人原物。';
  if (c.type === 'CONSENT_MIRA' || c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'A' && a.originalsChecked && a.consent === 'UNASKED' ? null : '每案重新询问可撤回许可，不复用旧同意或再次索取已拒绝的许可。';
  if (c.type === 'SETUP_OBJECTS') return p.playerLocation === 'A' && p.guide.location === 'A' && a.originalsChecked && a.consent !== 'UNASKED' && !a.objectsSetup ? null : '先当面核对并接受本次选择，再由薇娜亲自布置同一原物。';
  if (c.type === 'RETURN_OBJECTS') return p.playerLocation === 'A' && p.guide.location === 'A' && a.resultRead && a.objectRetrieved && !a.objectsReturned && !l.operation.effect && p.parcel.holder === 'PLAYER' && p.paper.holder === 'PLAYER' && p.line.holder === 'FLOOR' ? null : '须携同一原物实走回薇娜身旁，效果结束后当面归还并收起原标条。';
  if (c.type === 'REMOVE_COVER') return !impact && p.playerLocation === 'B' && a.objectsSetup && !!l.operation.truth?.obscuredByPaper && p.paper.holder === 'TABLE' && p.paper.location === 'B' ? null : '须本人实走到原桌旁，才能亲手移开遮住轮廓的同一原纸。';
  if (c.type === 'MANUAL_INSPECTION') return p.playerLocation === 'B' && a.objectsSetup && !a.resultRead && p.parcel.holder === 'TABLE' && p.parcel.location === 'B' && (impact ? !!a.impact : !!l.operation.truth && !l.operation.truth.obscuredByPaper) ? null : '须实走到原包旁，先解除真实遮挡或完成本次安全放置，再普通亲核。';
  if (c.type === 'TAKE_OBJECT') return p.playerLocation === 'B' && a.resultRead && !a.objectRetrieved && p.parcel.holder === 'TABLE' ? null : '须先在原桌旁核实，再亲手取回唯一原包。';
  if (c.type === 'TAKE_PARCEL') return impact && p.playerLocation === 'A' && a.objectsSetup && !a.parcelTaken && p.parcel.holder === 'GUIDE' ? null : '仅本案由薇娜当面交出同一350克原封包。';
  if (c.type === 'ORDINARY_BRACE') return impact && p.playerLocation === 'B' && a.parcelTaken && !a.impact && p.parcel.holder === 'PLAYER' ? null : '须本人携原包实到原桌旁；一次普通承托平放便可安全完成，不需护板或施术。';
  if (a.stopped) return '已停止后续能力，只可等候、普通核实、承托放置、归物和退出。';
  if (c.type === 'IMBALANCE_SENSING') return !impact && a.method === 'ABILITY' && a.consent === 'GRANTED' && p.volunteer.willing && p.playerLocation === 'A' && a.objectsSetup && a.sensingTier === null && !!l.operation.truth ? null : '仅在本案许可下，从四米内尝试一次有限辨察；不能透过原纸读出隐藏位移或读取人心。';
  if (c.type === 'MEASURED_RESISTANCE') return impact && a.method === 'ABILITY' && a.consent === 'GRANTED' && p.volunteer.willing && p.playerLocation === 'A' && a.parcelTaken && a.resistanceTier === null && !l.operation.effect && l.guardPlate.owner === 'PLAYER' && l.guardPlate.holder === 'PLAYER' && l.guardPlate.location === 'A' && l.guardPlate.integrity >= 15 ? null : '须亲持已购买且完整度至少15的唯一原护板，只护持自己接下来一次可见物理冲击，最多三十秒且不可叠加。';
  if (c.type === 'APPLY_IMPACT') return impact && a.method === 'ABILITY' && a.consent === 'GRANTED' && p.volunteer.willing && p.playerLocation === 'B' && a.parcelTaken && a.resistanceTier !== null && !a.impact && p.parcel.holder === 'PLAYER' && l.guardPlate.owner === 'PLAYER' && l.guardPlate.holder === 'PLAYER' && l.guardPlate.location === 'B' && l.guardPlate.integrity >= 15 ? null : '仅本人自愿以同一原包测试一次可见冲击；耗原护板15完整度，成功护持受2健康，否则受5健康，可改普通承托避免受伤。';
  return '本案不支持此步骤。';
}
function commandCost(c: BalancerActivityCommand, tier: PublicResolutionTier | null = null, l?: BalancerLifeState): BalancerLifeCost {
  const cast = c.type === 'IMBALANCE_SENSING' || c.type === 'MEASURED_RESISTANCE';
  return { actions: cast || ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'IMBALANCE_SENSING' ? 5 : c.type === 'MEASURED_RESISTANCE' ? 6 : 0, mind: cast ? tier !== null && !passed(tier) ? 4 : 2 : 0, pennies: c.type === 'BUY_GUARD_PLATE' ? 30 : 0, health: c.type === 'APPLY_IMPACT' ? l?.operation.effect ? 2 : 5 : 0, cashGained: 0 };
}
const reserve = (c: BalancerActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? 1 : 0;
function makeSource(s: SliceState): BalancerSceneSource { return { root: 'chaosHunter.life', promotionWeek: s.balancer.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(s.chaosHunter.life), guardPlate: freshPlate() }; }
export function blockBalancerLife(s: SliceState, c: BalancerActivityCommand): string | null {
  if (!validateBalancerActivityCommand(c)) return '平衡者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已经成为平衡者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回到贝克兰德原演练房。';
  if (s.balancer.preparedWeek !== null || s.balancer.encounter.status !== 'AVAILABLE' || s.balancer.encounter.preparation) return '先收束晋升准备；后续遭遇开始后不能重开原案。';
  if (s.balancer.life.source === null && !validateBalancerSceneSource(makeSource(s), s)) return '须完整保留旧三案、原人的独立意愿和原物收尾，不能另造来源。';
  const reason = localBlock(s.balancer.life, site(s), c, s.week); if (reason) return reason;
  const cost = commandCost(c, null, s.balancer.life);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '须预留本次准备和有限施术所需行动；普通核实与收尾始终不耗行动。';
  if (s.cash < cost.pennies) return '购买这一块原护板须实付30便士；可以先用普通方法完成。';
  if (s.spirituality < cost.spirituality || s.mind < (cost.spirituality ? 4 : 0)) return '本次资源不足以支付能力及失败成本，可以普通核实并安全收尾。';
  if (cost.health && s.health <= 5) return '当前身体不能安全承受本次冲击，请用普通承托平放。';
  return null;
}
export const balancerActivityReason = blockBalancerLife;
export function advanceBalancerLifeClock(l: BalancerLifeState, p: BalancerSceneRoot, seconds: number, a: BalancerAttempt | null = current(l)): void {
  if (!integer(seconds) || !Number.isSafeInteger(p.clockSeconds + seconds)) throw new Error('实际经过的秒数无效。');
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (l.operation.effect && p.clockSeconds >= l.operation.effect.expiresAt) { l.operation.effect = null; if (a) a.effectExpired = true; }
}
const elapse = advanceBalancerLifeClock;
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY'): BalancerAttempt { return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, originalsChecked: false, objectsSetup: false, parcelTaken: false, sensingTier: null, resistanceTier: null, sensingAnswer: null, verifiedOffsetMm: null, coverRemoved: false, impact: null, effectExpired: false, effectStopped: false, resultRead: false, objectRetrieved: false, objectsReturned: false, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, healthLost: 0, waitedSeconds: 0, appliedAbilityIds: [], playerMoves: [], guideMoves: [], evidence: [] }; }
function checkSource(l: BalancerLifeState, p: BalancerSceneRoot, c: BalancerActivityCommand, baseAbility: number, name: string, gender: string): BalancerCheckSource | null {
  if (c.type !== 'IMBALANCE_SENSING' && c.type !== 'MEASURED_RESISTANCE') return null;
  const sense = c.type === 'IMBALANCE_SENSING';
  return { caseId: c.caseId, abilityId: sense ? SENSE : RESIST, cost: sense ? 5 : 6, difficulty: 20, coreStat: sense ? 'perception' : 'knowledge', baseAbility, actor: { pathwayId: 'justiciar', sequence: 2, name, gender }, at: p.clockSeconds, actorLocation: 'A', currentConsent: 'GRANTED', volunteerId: p.volunteer.id, volunteerLocation: 'A', objectId: p.parcel.id, objectLocation: sense ? 'B' : 'A', distanceMetres: sense ? 4 : 0, physicalTruth: sense ? structuredClone(l.operation.truth) : null, guardPlate: sense ? null : structuredClone(l.guardPlate), nextOwnVisibleImpulseOnly: !sense };
}
function guideWalk(l: BalancerLifeState, p: BalancerSceneRoot, a: BalancerAttempt, to: BalancerLocation): void {
  const from = p.guide.location as BalancerLocation, originals = [p.parcel, p.paper, p.line].filter(x => x.holder === 'GUIDE');
  a.guideMoves.push({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [...originals.map(x => x.id), ...(l.guardPlate.holder === 'GUIDE' ? [l.guardPlate.id] : [])] });
  p.guide.location = to; p.guideTravelMetres += 4; for (const x of originals) x.location = to as 'START' | 'A'; if (l.guardPlate.holder === 'GUIDE') l.guardPlate.location = to;
  elapse(l, p, 4, a);
}
function move(l: BalancerLifeState, p: BalancerSceneRoot, a: BalancerAttempt, to: BalancerLocation): void {
  const from = p.playerLocation, items = [p.parcel, p.paper].filter(x => x.holder === 'PLAYER');
  a.playerMoves.push({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [...items.map(x => x.id), ...(l.guardPlate.holder === 'PLAYER' ? [l.guardPlate.id] : [])] });
  for (const x of items) x.location = to; if (l.guardPlate.holder === 'PLAYER') l.guardPlate.location = to;
  p.playerLocation = to; p.playerTravelMetres += 4; a.playerTravelMetres += 4;
  // On this segment both people walk concurrently. The guide movement is real, not an extra four seconds.
  if (from === 'START' || to === 'START') { const before = p.clockSeconds; guideWalk(l, p, a, to); if (p.clockSeconds !== before + 4) throw new Error('原路步行时钟不符。'); } else elapse(l, p, 4, a);
}
function stopEffect(l: BalancerLifeState, a: BalancerAttempt): void { if (l.operation.effect) a.effectStopped = true; l.operation.effect = null; }
function evolve(l: BalancerLifeState, p: BalancerSceneRoot, c: BalancerActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: BalancerSceneSource | null): void {
  if (l.source === null) { if (!source) throw new Error('缺少原房间与原库存的实际交接。'); l.source = structuredClone(source); }
  if (c.type === 'BUY_GUARD_PLATE') { l.guardPlate.owner = 'PLAYER'; l.guardPlate.holder = 'PLAYER'; l.guardPlate.acquiredWeek = week; elapse(l, p, 2); return; }
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.method); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; l.operation.truth = null; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; p.volunteer.willing = false; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': move(l, p, a, c.to); break;
    case 'CHECK_ORIGINALS': a.originalsChecked = true; a.evidence.push('当面核对43岁的米拉、薇娜、350克原封包、同一原纸、原标条与空原桌。米拉健康和精神各100，始终保有独立意愿。'); elapse(l, p, 2, a); break;
    case 'CONSENT_MIRA': a.consent = 'GRANTED'; r.consentWeek = week; p.volunteer.willing = true; a.evidence.push('米拉和物主薇娜明确同意本案有限演练，可随时撤回；不控制米拉身体，不读心，也不会使她承受冲击。'); elapse(l, p, 1, a); break;
    case 'DECLINE_PERMISSION': a.consent = 'DECLINED'; p.volunteer.willing = false; a.evidence.push('接受本案能力参与的拒绝；仍可在物主协助下普通检查与安全承托，不再索取施术许可。'); elapse(l, p, 1, a); break;
    case 'SETUP_OBJECTS': {
      a.objectsSetup = true; r.status = 'ACTIVE'; p.line.holder = 'FLOOR'; p.line.location = 'A';
      if (c.caseId !== 'measured-impact') {
        guideWalk(l, p, a, 'B'); p.parcel.holder = 'TABLE';
        const covered = c.caseId === 'withdrawn-inspection'; if (covered) p.paper.holder = 'TABLE';
        l.operation.truth = { objectId: p.parcel.id, location: 'B', tableId: p.table.id, referenceOffsetMm: 0, displacementMm: 120, obscuredByPaper: covered, placedAt: p.clockSeconds };
        elapse(l, p, 1, a); guideWalk(l, p, a, 'A');
        if (!covered) { p.paper.holder = 'PLAYER'; p.paper.location = 'A'; }
        a.evidence.push(covered ? '薇娜亲携同一原包和原纸去原桌布置，并实走回来；原纸实际遮住包裹轮廓，四米外尚不能确认被遮的位移。' : '薇娜亲携同一原包去原桌布置后实走回来；原包轮廓可见，物主把同一原纸交给本人核对。');
      } else { p.paper.holder = 'PLAYER'; a.evidence.push('原标条放在脚边，同一原纸由本人持有。只测试本人可见的一次轻小物理冲击，普通承托平放同样可以完成。'); elapse(l, p, 1, a); }
      break;
    }
    case 'IMBALANCE_SENSING': {
      a.sensingTier = tier; a.spiritualitySpent += 5; a.mindSpent += passed(tier) ? 2 : 4;
      const truth = l.operation.truth!; a.sensingAnswer = { kind: !passed(tier) ? 'UNRESOLVED' : truth.obscuredByPaper ? 'OBSCURED' : 'VISIBLE_DEVIATION', displacementMm: passed(tier) && !truth.obscuredByPaper ? truth.displacementMm : null, at: p.clockSeconds };
      a.evidence.push(!passed(tier) ? '本次有限辨察未能确认，五灵性和失败精神成本照付；仍须普通走近核实。' : truth.obscuredByPaper ? '只察觉真实遮挡，不能隔着原纸得知隐藏位移；没有透视、读心或判定幕后原因。' : '在四米内辨出可见轮廓偏离原参考位置120毫米；只是当前物理差异，仍须实走过去亲核。'); elapse(l, p, 1, a); break;
    }
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.volunteer.willing = false; stopEffect(l, a); a.evidence.push('米拉明确撤回本案能力参与，当即终止未用护持并停止新施术；已付成本、原物位置和已经发生的事实不回滚。'); elapse(l, p, 1, a); break;
    case 'REMOVE_COVER': l.operation.truth!.obscuredByPaper = false; p.paper.holder = 'PLAYER'; p.paper.location = 'B'; a.coverRemoved = true; a.evidence.push('本人实到原桌旁，亲手移开并拿起同一原纸，物理遮挡才真正消失。'); elapse(l, p, 1, a); break;
    case 'MANUAL_INSPECTION': a.resultRead = true; if (c.caseId !== 'measured-impact') { a.verifiedOffsetMm = l.operation.truth!.displacementMm; if (a.sensingAnswer?.kind === 'VISIBLE_DEVIATION' && a.sensingAnswer.displacementMm === a.verifiedOffsetMm) a.appliedAbilityIds.push(SENSE); a.evidence.push(`本人在原桌旁普通核对原包与未修改的原纸，确认实际偏移${a.verifiedOffsetMm}毫米；这是新取得的近处观察，不是事先透过遮挡知道。`); } else a.evidence.push('本人在原桌旁核实同一原包、自己实际承受的结果和原护板磨损；米拉没有受伤，未用能力不会获得掌握。'); elapse(l, p, 2, a); break;
    case 'TAKE_PARCEL': a.parcelTaken = true; p.parcel.holder = 'PLAYER'; p.parcel.handovers++; a.evidence.push('薇娜当面把唯一350克原封包交到本人手中，所有权仍属她。'); elapse(l, p, 1, a); break;
    case 'MEASURED_RESISTANCE': a.resistanceTier = tier; a.spiritualitySpent += 6; a.mindSpent += passed(tier) ? 2 : 4; elapse(l, p, 1, a); if (passed(tier)) l.operation.effect = { actor: 'PLAYER', target: 'PLAYER', plateId: l.guardPlate.id, objectId: p.parcel.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 30, remainingUses: 1, sourceCaseId: 'measured-impact' }; a.evidence.push(passed(tier) ? '只护持本人接下来一次可见原包冲击，三十秒内有效且不可叠加；护板仍是同一块实物，尚未发生冲击不算掌握。' : '本次护持未成，六灵性和失败精神成本照付；仍可普通承托平放，避免受伤。'); break;
    case 'APPLY_IMPACT': case 'ORDINARY_BRACE': {
      const ordinary = c.type === 'ORDINARY_BRACE', resisted = !ordinary && !!l.operation.effect, healthLoss = ordinary ? 0 : resisted ? 2 : 5;
      a.impact = { actor: 'PLAYER', target: 'PLAYER', objectId: p.parcel.id, massGrams: 350, visible: true, at: p.clockSeconds, mode: ordinary ? 'ORDINARY_BRACE' : 'IMPACT', baseHealthLoss: 5, healthLoss, plateWear: ordinary ? 0 : 15, resistanceApplied: resisted };
      if (resisted) a.appliedAbilityIds.push(RESIST); a.healthLost += healthLoss; if (!ordinary) l.guardPlate.integrity -= 15; else stopEffect(l, a); l.operation.effect = null; p.parcel.holder = 'TABLE'; p.parcel.location = 'B';
      a.evidence.push(ordinary ? '本人普通承托并把同一原包平放在原桌，没有冲击、健康损失或护板磨损，也没有能力掌握。' : `本人自愿让同一350克原包对亲持原护板发生一次可见轻小冲击；自己实际损失${healthLoss}健康，原护板磨损15。米拉不承受伤害，护持立即用尽。`); elapse(l, p, 1, a); break;
    }
    case 'TAKE_OBJECT': a.objectRetrieved = true; p.parcel.holder = 'PLAYER'; if (!a.parcelTaken) p.parcel.handovers++; elapse(l, p, 1, a); break;
    case 'RETURN_OBJECTS': p.parcel.holder = 'GUIDE'; p.paper.holder = 'GUIDE'; p.line.holder = 'GUIDE'; p.parcel.returns++; p.line.returns++; a.objectsReturned = true; l.operation.truth = null; a.evidence.push('本人携同一原包和原纸实际走回薇娜身旁，当面归还并收起原标条；唯一护板仍归当前实际所有人，磨损不恢复。'); elapse(l, p, 2, a); break;
    case 'WAIT_EFFECT': { const seconds = l.operation.effect!.expiresAt - p.clockSeconds; a.waitedSeconds += seconds; elapse(l, p, seconds, a); a.evidence.push(`实际等待剩余${seconds}秒，未用护持到时消散，成本不退，也没有应用掌握。`); break; }
    case 'STOP': a.stopped = true; stopEffect(l, a); a.evidence.push('取消后续能力并结束尚未用的护持；已付成本不退，原物仍须普通检查、亲取并归还。'); elapse(l, p, 1, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyBalancerActivity(s: SliceState, c: BalancerActivityCommand, ctx: SeerContext): void {
  const reason = blockBalancerLife(s, c); if (reason) throw new Error(reason);
  const l = s.balancer.life, p = site(s), stat = c.type === 'IMBALANCE_SENSING' ? 'perception' : 'knowledge', source = checkSource(l, p, c, s.character.coreStats[stat], s.character.name, s.character.gender), inheritedScene = l.source === null ? makeSource(s) : null;
  const clockBefore = p.clockSeconds, plateBefore = structuredClone(l.guardPlate), randomCursor = s.random.cursor; let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check(stat, 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier, l), budget: BalancerLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health - paid.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.health = budget.healthAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, clockBefore, clockAfter: p.clockSeconds, plateBefore, plateAfter: structuredClone(l.guardPlate), paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原演练房：${LABELS[c.type]}`, `${tier ? `检定${TIERS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}，原房时钟${p.clockSeconds}秒。原人、同一原物、真实成本与已发生后果继续保留。`);
}
export const applyBalancerLife = applyBalancerActivity;
export const applyBalancerLifeCommand = applyBalancerActivity;
export const handleBalancerLife = applyBalancerActivity;
const LOCATIONS = { START: '原房门口', A: '四米处原标线', B: '同一原桌旁', OUTSIDE: '房间外' } as const;
const TIERS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<BalancerActivityCommand['type'], string> = { BUY_GUARD_PLATE: '付30便士购买薇娜现有的唯一原护板', OBSERVE: '观察原房间和普通退路', PREPARE: '准备本次有限实践', WALK: '沿原路普通步行', CHECK_ORIGINALS: '当面核对同一原人原物', CONSENT_MIRA: '询问本案可随时撤回的许可', DECLINE_PERMISSION: '接受本案拒绝并普通完成', SETUP_OBJECTS: '由薇娜亲自布置同一原物', IMBALANCE_SENSING: '在四米内有限辨察物理差异或遮挡', WITHDRAW_PERMISSION: '接受米拉明确撤回本案许可', REMOVE_COVER: '在原桌旁亲手移开同一原纸', MANUAL_INSPECTION: '在近处普通核实实际结果', TAKE_PARCEL: '从薇娜手中亲取同一原包', MEASURED_RESISTANCE: '护持自己接下来一次可见物理冲击', APPLY_IMPACT: '自愿测试一次原包冲击（受2或5健康、护板磨损15）', ORDINARY_BRACE: '普通承托平放原包（不受伤）', TAKE_OBJECT: '亲手取回原桌上的同一原包', RETURN_OBJECTS: '当面归还原包、原纸并收起原标条', WAIT_EFFECT: '实际等候本次未用护持到期', STOP: '停止能力并普通安全收尾', INSPECT: '核实原物归还与实际返回', LEAVE: '结束已收束的本案接触', CLOSE: '结束已收束的本案接触', WITHDRAW: '如实取消并退出', REPORT: '报告真正发生的有限结果', REFLECT: '反思三次有限实践' };
export const BALANCER_LIFE_STORY = '薇娜·贝尔与43岁的米拉·佩恩仍在原演练房，原封包仍是350克，同一原纸和原标条没有变成新的库存。辨察只针对近处可见物理差异或遮挡，不能读心或隔物获知答案；护持只作用于本人接下来一次可见物理冲击。米拉始终自主，每案重新征求许可，可拒绝或撤回。';
export const BALANCER_LIFE_ENVIRONMENT = '门口到原标线、原标线到原桌各四米，普通步行各四秒。辨察实付5灵性和1行动，感知难度20；护持实付6灵性和1行动，知识难度20，两者成功耗2精神、失败耗4精神。唯一原护板30便士、初始完整度65；一次自愿原包冲击磨损15，自己损失5健康，有效护持降为2。护持最多三十秒、一次用尽、不叠加。普通承托平放不受伤，不要求购买护板或施术。停止、等候、亲核、取回和归还均不耗行动，成本不退。';
const CASES: { id: BalancerCaseId; title: string; story: string }[] = [
  { id: 'visible-imbalance', title: '可见轮廓的真实偏差', story: '薇娜亲自布置原包，有限辨察只能得到当前可见差异；本人仍须实走过去，用未修改的原纸亲核，再亲取归还。' },
  { id: 'withdrawn-inspection', title: '遮挡与撤回后的普通核实', story: '同一原纸真实遮住包裹轮廓。即使辨察成功也只知道存在遮挡；米拉撤回后停止能力，本人普通走近、亲手移纸才可核实。' },
  { id: 'measured-impact', title: '只承受自己的一次冲击', story: '本人亲持同一原护板，只可有限减轻接下来一次可见原包冲击；实际承受、磨损与时限都保留。也可普通承托平放，安全完成并保留未应用技巧的零掌握。' },
];
function preferred(s: SliceState, actions: BalancerLifeAction[]): BalancerLifeAction | undefined {
  const l = s.balancer.life, p = site(s), a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: BalancerActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = (to: BalancerLocation) => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!a) return pick('OBSERVE') ?? (l.cases['measured-impact'].status === 'OBSERVED' && l.guardPlate.owner !== 'PLAYER' ? pick('BUY_GUARD_PLATE') : undefined) ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (p.playerLocation === 'START') return walk('A') ?? pick('INSPECT');
  if (p.playerLocation === 'B') return pick('REMOVE_COVER') ?? (!a.impact && l.activeCase === 'measured-impact' ? l.operation.effect ? pick('APPLY_IMPACT') : pick('ORDINARY_BRACE') : undefined) ?? pick('MANUAL_INSPECTION') ?? pick('TAKE_OBJECT') ?? walk('A');
  if (!a.objectsSetup) return pick('CHECK_ORIGINALS') ?? pick('CONSENT_MIRA') ?? pick('SETUP_OBJECTS');
  if (a.objectRetrieved) return pick('STOP') ?? pick('RETURN_OBJECTS') ?? walk('START');
  if (l.activeCase === 'measured-impact') return pick('TAKE_PARCEL') ?? pick('MEASURED_RESISTANCE') ?? walk('B');
  return pick('IMBALANCE_SENSING') ?? (l.activeCase === 'withdrawn-inspection' && a.consent === 'GRANTED' ? pick('WITHDRAW_PERMISSION') : undefined) ?? walk('B');
}
export function balancerLifeActions(s: SliceState): BalancerLifeAction[] {
  if (!promoted(s) || s.balancer.encounter.status !== 'AVAILABLE' || s.balancer.encounter.preparation) return [];
  const l = s.balancer.life, p = site(s), out: BalancerLifeAction[] = [], id = l.activeCase ?? BALANCER_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: BalancerActivityCommand) => { const reason = blockBalancerLife(s, command), cost = commandCost(command, null, l), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', command.type === 'IMBALANCE_SENSING' ? '感知20' : '知识20'); if (cost.pennies) values.push(`${cost.pennies}便士`); if (command.type === 'APPLY_IMPACT') values.push(`本人${cost.health}健康`, '原护板15完整度'); if (command.type === 'WAIT_EFFECT') values.push(`${Math.max(0, (l.operation.effect?.expiresAt ?? p.clockSeconds) - p.clockSeconds)}秒`); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `BA2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command, cleanup: cost.actions === 0 && command.type !== 'BUY_GUARD_PLATE' }); };
  if (!open(l) && l.guardPlate.acquiredWeek === null) add({ type: 'BUY_GUARD_PLATE' });
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id }); if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); } if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) { for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const c: BalancerActivityCommand = { type, caseId: id }; if (!localBlock(l, p, c, s.week)) add(c); } for (const to of ['START', 'A', 'B'] as const) { const c: BalancerActivityCommand = { type: 'WALK', caseId: id, to }; if (!localBlock(l, p, c, s.week)) add(c); } }
  return out;
}
function projectAttempt(a: BalancerAttempt, l: BalancerLifeState, p: BalancerSceneRoot): BalancerAttemptProjection { const effect = current(l) === a ? l.operation.effect : null; return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, permissionWithdrawn: a.permissionWithdrawn, sensingTier: a.sensingTier, resistanceTier: a.resistanceTier, sensingAnswer: a.sensingAnswer ? a.sensingAnswer.kind === 'VISIBLE_DEVIATION' ? `可见轮廓偏离${a.sensingAnswer.displacementMm}毫米` : a.sensingAnswer.kind === 'OBSCURED' ? '存在遮挡，隐藏位移未知' : '尚未确认' : null, verifiedOffsetMm: a.verifiedOffsetMm, effectRemainingSeconds: effect ? Math.max(0, effect.expiresAt - p.clockSeconds) : 0, impact: a.impact ? { at: a.impact.at, mode: a.impact.mode, healthLoss: a.impact.healthLoss, plateWear: a.impact.plateWear, resistanceApplied: a.impact.resistanceApplied } : null, resultRead: a.resultRead, objectsReturned: a.objectsReturned, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, healthLost: a.healthLost, evidence: [...a.evidence] }; }
export function projectBalancerLife(s: SliceState): BalancerLifeProjection {
  const l = s.balancer.life, p = site(s), a = current(l), actions = balancerLifeActions(s), next = preferred(s, actions), plate = l.guardPlate;
  return { title: '原演练房的有限辨察与护持', story: BALANCER_LIFE_STORY, environment: BALANCER_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原物、已付成本和护板磨损继续保留。' : '先支付必要成本或完成普通收尾。'), preferredActionId: next?.id ?? null, facts: [`米拉仍为43岁，健康${p.volunteer.health}、精神${p.volunteer.mind}，身处${LOCATIONS[p.volunteer.location]}并保有独立意愿。`, `原包仍为350克，原纸仍写“${p.paper.text}”；原标条不是墙。`, `本人累计普通步行${p.playerTravelMetres}米，原房时钟${p.clockSeconds}秒。`, `唯一原护板完整度${plate.integrity}/65，${plate.owner === 'PLAYER' ? '已由本人实际付费取得' : '仍属于薇娜原库存'}；不能免费补发或恢复磨损。`, '遮挡只会得到遮挡结论；物理偏差不能证明动机。护持只作用于自己的一次可见物理冲击，不能取消全部力量。'], activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: a ? projectAttempt(a, l, p) : null, guardPlate: { title: '唯一原护板', owner: plate.owner === 'PLAYER' ? '本人' : '薇娜', holder: plate.holder === 'PLAYER' ? '本人亲持' : plate.holder === 'GUIDE' ? '薇娜亲持' : '地上', location: LOCATIONS[plate.location], integrity: plate.integrity, acquired: plate.acquiredWeek !== null }, site: { title: '原净空演练房', guide: `薇娜·贝尔在${LOCATIONS[p.guide.location]}`, volunteer: `米拉·佩恩在${LOCATIONS[p.volunteer.location]}`, parcel: `同一350克原封包在${LOCATIONS[p.parcel.location]}，${p.parcel.holder === 'GUIDE' ? '薇娜亲持' : p.parcel.holder === 'PLAYER' ? '本人亲持' : '放在原桌上'}`, paper: `同一原纸在${LOCATIONS[p.paper.location]}`, line: `同一原标条在${LOCATIONS[p.line.location]}` }, cases: CASES.map(d => { const r = l.cases[d.id]; return { ...d, observations: r.attempts.flatMap(x => [...x.evidence]), status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已经亲核真实有限应用，原物实际归还。' : '普通核实并安全收束；未应用能力不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => projectAttempt(x, l, p)) }; }), actions };
}
export function validateBalancerSceneSource(v: unknown, s: SliceState): v is BalancerSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot', 'guardPlate']) || v.root !== 'chaosHunter.life' || v.promotionWeek !== s.balancer.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot) || !same(v.guardPlate, freshPlate())) return false;
    const p = v.snapshot as unknown as ChaosHunterLifeState, initial = createChaosHunterLifeState();
    if (!shape(p, Object.keys(initial)) || p.siteId !== initial.siteId || p.playerLocation !== 'START' || p.guide?.id !== 'GUIDE' || p.guide.name !== '薇娜·贝尔' || p.guide.location !== 'START' || p.volunteer?.id !== 'CH3-MIRA' || p.volunteer.name !== '米拉·佩恩' || p.volunteer.age !== 43 || p.volunteer.location !== 'A' || p.volunteer.willing !== false || p.volunteer.alive !== true || p.volunteer.independentMind !== true || p.volunteer.health !== 100 || p.volunteer.mind !== 100 || !same(p.volunteer.injuries, []) || p.parcel?.id !== 'CH3-PARCEL' || p.parcel.massGrams !== 350 || p.parcel.quantity !== 1 || p.parcel.owner !== 'GUIDE' || p.paper?.id !== 'CH3-RULE-PAPER' || p.paper.text !== '本次从A到B的越线' || p.paper.quantity !== 1 || p.paper.owner !== 'GUIDE' || p.line?.id !== 'CH3-LINE' || p.line.owner !== 'GUIDE' || p.line.quantity !== 1 || p.line.isWall !== false || !same(p.table, initial.table) || cleanupBlock(createBalancerLifeState(), p as BalancerSceneRoot) || p.activeCase !== null || !p.reflected || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    return validateChaosHunterLifeOriginal({ ...s, week: v.introducedWeek, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, chaosHunter: { ...s.chaosHunter, life: structuredClone(p) } });
  } catch { return false; }
}
function validBudget(b: BalancerLifeBudget, cost: BalancerLifeCost, c: BalancerActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  return b.actionsBefore >= cost.actions + reserve(c) && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore - cost.pennies && b.healthAfter === b.healthBefore - cost.health && b.mindAfter === b.mindBefore - cost.mind && !(cost.spirituality && b.mindBefore < 4) && !(cost.health && b.healthBefore <= 5);
}
function follows(a: BalancerLifeBudget, b: BalancerLifeBudget): boolean { return b.actionsBefore === a.actionsAfter && b.spiritualityBefore === a.spiritualityAfter && b.cashBefore === a.cashAfter && b.healthBefore === a.healthAfter && b.mindBefore === a.mindAfter; }
function currentBudget(s: SliceState, b: BalancerLifeBudget): boolean { return s.actionsRemaining === b.actionsAfter && s.spirituality === b.spiritualityAfter && s.cash === b.cashAfter && s.health === b.healthAfter && s.mind === b.mindAfter; }
/** Strict replay keeps original physical truth, observed knowledge, one-use effects and paid consequences independent. */
function replayLife(s: SliceState): { root: BalancerSceneRoot; guardPlate: BalancerGuardPlate } | null {
  try {
    const l = s.balancer?.life, expected = createBalancerLifeState(), promotion = s.balancer?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, BALANCER_CASE_IDS) || !Array.isArray(l.journal) || !l.journal.length || l.journal.length > 250 || !integer(promotion, 1, s.week) || !validateBalancerSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot) as BalancerSceneRoot; let previous: BalancerLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'clockBefore', 'clockAfter', 'plateBefore', 'plateAfter', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateBalancerActivityCommand(raw.command)) return null;
      const e = raw as unknown as BalancerLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(c, e.tier, expected), b = e.budget;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor) || e.clockBefore !== p.clockSeconds || !same(e.plateBefore, expected.guardPlate)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && e.week === previous.week && previous.budget.actionsAfter > 0) && e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      const acquisition = s.balancer.acquisitionJournal.at(-1); if (!previous && acquisition && e.revision === acquisition.revision + 1 && e.week === acquisition.week && acquisition.after.actions > 0 && (e.randomCursor !== acquisition.randomAfter || b.actionsBefore !== acquisition.after.actions || b.healthBefore !== acquisition.after.health || b.mindBefore !== acquisition.after.mind || b.spiritualityBefore !== acquisition.after.spirituality || b.cashBefore !== acquisition.after.cash)) return null;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, p, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && previous.budget.actionsAfter > 0) && !follows(previous.budget, b)) return null;
      const handoff = expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0, stat = c.type === 'IMBALANCE_SENSING' ? 'perception' : 'knowledge';
      if (e.source !== null && base > s.character.coreStats[stat]) return null;
      const source = checkSource(expected, p, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return null;
      if (source) {
        if (!['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: source.coreStat, baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); if (e.clockAfter !== p.clockSeconds || !same(e.plateAfter, expected.guardPlate)) return null; expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    const comparable = { ...l, guardPlate: expected.guardPlate }; if (!same(comparable, expected)) return null;
    if (!s.balancer.encounter.preparation && !same(l.guardPlate, expected.guardPlate)) return null;
    if (open(l)) { if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.balancer.encounter.status !== 'AVAILABLE' || s.balancer.encounter.preparation || current(l)?.week !== s.week || !previous || !same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget)) return null; }
    if (previous && s.revision === previous.revision + 1 && s.week === previous.week && previous.budget.actionsAfter > 0 && (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget))) return null;
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'), lifeMastery = s.balancer.encounter.preparation?.before.mastery ?? s.progression.mastery; for (const id of [SENSE, RESIST]) if ((lifeMastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return { root: p, guardPlate: structuredClone(expected.guardPlate) };
  } catch { return null; }
}
export function replayBalancerLifeRoot(s: SliceState): BalancerSceneRoot | null { return replayLife(s)?.root ?? null; }
export function replayBalancerLifeGuardPlate(s: SliceState): BalancerGuardPlate | null { return replayLife(s)?.guardPlate ?? null; }
export function validateBalancerLifeState(s: SliceState): boolean {
  try { const l = s.balancer?.life; if (l?.source === null) return same(l, createBalancerLifeState()); const replay = replayLife(s); if (!replay) return false; if (!s.balancer.encounter.preparation) return same(site(s), replay.root) && same(l.guardPlate, replay.guardPlate); if (open(l) || !l.reflected || cleanupBlock({ ...l, guardPlate: replay.guardPlate }, replay.root) || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false; const actual = replayBalancerEncounterRoot(s, replay.root), plate = replayBalancerEncounterGuardPlate(s, replay.guardPlate); return !!actual && !!plate && same(actual, site(s)) && same(plate, l.guardPlate); } catch { return false; }
}
export const validateBalancerLife = validateBalancerLifeState;
export function reconstructBalancerOriginalRoot(s: SliceState): ChaosHunterLifeState | null { if (!s.balancer || !validateBalancerLifeState(s)) return null; return structuredClone(s.balancer.life.source?.snapshot ?? s.chaosHunter.life); }
export function validateBalancerSourceChaosHunterLife(s: SliceState): boolean {
  try { if (s.balancer?.life.source === null) return validateChaosHunterLifeOriginal(s); if (!promoted(s) || s.balancer.chaosHunterActingAtPromotion !== 100) return false; const original = reconstructBalancerOriginalRoot(s); if (!original) return false; return validateChaosHunterLifeOriginal({ ...s, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, chaosHunter: { ...s.chaosHunter, life: original } }); } catch { return false; }
}
