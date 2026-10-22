import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { ProphecyMasterLifeState } from '../prophecy-master/life.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury } from '../slice/types.js';
import type { ScrollProfessorScroll, ScrollProfessorWorkshop } from '../scroll-professor/types.js';
import type { SliceState } from '../slice/types.js';
import { hasSageOldPractice } from './index.js';

export const SAGE_CASE_IDS = ['information-route', 'onsite-sift', 'joint-verification'] as const;
export const SAGE_ACTIVITY_CASE_IDS = SAGE_CASE_IDS;
export const ACTIVITY_CASE_IDS = SAGE_CASE_IDS;
export type SageCaseId = typeof SAGE_CASE_IDS[number];
export type SageLifeAbilityId = 'hermit.s2.information-form' | 'hermit.s2.information-sift';
export type SageLocation = 'ENTRY' | 'A' | 'B' | 'OUTSIDE' | 'YARD';
export type SageConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'CONSENT_OWNER', 'INVITE_OWNER', 'RETURN_OWNER', 'INSTALL_ANCHOR', 'REMOVE_ANCHOR', 'INFORMATION_FORM', 'TRAVERSE_CONDUIT', 'REASSEMBLE', 'SIFT_INFORMATION', 'READ_ARCHIVE', 'VERIFY_INFORMATION', 'WITHDRAW_PERMISSION', 'RETURN_ITEMS', 'STOP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type SageActivityCommand = { type: typeof STEPS[number]; caseId: SageCaseId } | { type: 'PREPARE'; caseId: SageCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: SageCaseId; to: 'ENTRY' | 'A' | 'B' } | { type: 'REFLECT' };
export interface SageSceneSource {
  root: 'prophecyMaster.life'; promotionWeek: number; introducedWeek: number;
  /** Historical provenance only. The site below is the sole continuation of these people and objects. */
  snapshot: Pick<ProphecyMasterLifeState, 'siteId' | 'owner' | 'playerLocation' | 'playerTravelMetres' | 'clockSeconds'> & { record: ProphecyMasterLifeState['records']['bounded-source'] };
}
export interface SageMovement { actorId: 'PLAYER' | 'PM3-IRIS'; from: SageLocation; to: SageLocation; mode: 'WALK' | 'INFORMATION_CONDUIT'; metres: number; seconds: number; itemIds?: string[] }
export interface SageMaterial { id: 'SG2-KIT-1' | 'SG2-KIT-2' | 'SG2-KIT-3'; caseId: SageCaseId; ownerId: 'PLAYER'; quantity: 1; status: 'SUPPLY' | 'PLAYER' | 'INSTALLED' | 'RETURNED'; location: 'SUPPLY' | 'PLAYER' | 'A' | 'OWNER'; wear: number; paidPennies: 0 | 20; preparedWeek: number | null }
export interface SageSiteState {
  siteId: 'SG2-ARCHIVE'; introducedWeek: number | null; introducedDate: PublicGameDate | null; source: SageSceneSource | null;
  clockSeconds: number; playerLocation: SageLocation; playerTravelMetres: number; playerEnergy: number; formEnergySpent: number; assimilationExposure: number;
  body: 'SOLID' | 'INFORMATION'; form: { active: boolean; expiresAt: number | null; anchorId: SageMaterial['id'] | null };
  iris: { id: 'PM3-IRIS'; name: '艾瑞丝·沃德'; age: 49; alive: true; willing: boolean; location: 'ENTRY' | 'A' | 'B' | 'OUTSIDE'; energy: number; travelMetres: number; consent: SageConsent } | null;
  record: { id: 'PM3-BOUNDARY-RECORD'; owner: 'PM3-IRIS'; quantity: 1; location: 'OWNER' | 'PLAYER'; travelMetres: number } | null;
  conduit: { id: 'SG2-CONDUIT'; from: 'A'; to: 'B'; metres: 4; connected: true; traversals: number };
  archive: { id: 'SG2-ARCHIVE-LEAF'; owner: 'PM3-IRIS'; quantity: 1; location: 'B'; readings: number; verifications: number };
  materials: SageMaterial[]; actorMoves: SageMovement[];
}
export interface SageAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; stopped: boolean; inspected: boolean; permissionWithdrawn: boolean; consent: SageConsent;
  elapsedSeconds: number; playerTravelMetres: number; energySpent: number; spiritualitySpent: number; mindSpent: number; penniesSpent: 20;
  materialId: SageMaterial['id']; itemsReturned: boolean; anchorInstalled: boolean; formTier: PublicResolutionTier | null; siftTier: PublicResolutionTier | null;
  traversed: boolean; reassembled: boolean; expired: boolean; waits: number; ownerAccompanied: boolean; ownerReturned: boolean;
  read: boolean; verified: boolean; information: string[]; correction: string | null; appliedAbilityIds: SageLifeAbilityId[];
  playerMoves: SageMovement[]; actorMoves: SageMovement[]; siteAtStart: SageSiteState; siteAtClose: SageSiteState | null;
}
export interface SageCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: SageAttempt[] }
export interface SageLifeCost { actions: number; spirituality: number; pennies: number; health: 0; mind: number; energy: number; cashGained: 0 }
export interface SageLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number; energyBefore: number; energyAfter: number }
export interface SageCheckSource { caseId: SageCaseId; abilityId: SageLifeAbilityId; cost: number; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'hermit'; sequence: 2; name: string; gender: string }; consentWeek: number; at: number; site: SageSiteState }
export interface SageLifeEvent { week: number; date: PublicGameDate; command: SageActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: SageCheckSource | null; inheritedScene: SageSceneSource | null; paid: SageLifeCost; budget: SageLifeBudget }
export interface SageLifeState { activeCase: SageCaseId | null; reflected: boolean; site: SageSiteState; cases: Record<SageCaseId, SageCaseState>; journal: SageLifeEvent[] }
export interface SageLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SageActivityCommand }
export interface SageLifeProjection { title: string; story: string; environment: string; activeCase: SageCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; site: SagePublicSite; clockSeconds: number; playerLocation: SageLocation; playerTravelMetres: number; currentAttempt: SagePublicAttempt | null; cases: { id: SageCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: SagePublicAttempt[] }[]; actions: SageLifeAction[] }
const FORM: SageLifeAbilityId = 'hermit.s2.information-form', SIFT: SageLifeAbilityId = 'hermit.s2.information-sift';
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITION: Record<SageLocation, number> = { ENTRY: 0, A: 6, B: 10, OUTSIDE: -2, YARD: -4 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 2;
const distance = (a: SageLocation, b: SageLocation) => Math.abs(POSITION[a] - POSITION[b]);
const materialId = (id: SageCaseId): SageMaterial['id'] => id === 'information-route' ? 'SG2-KIT-1' : id === 'onsite-sift' ? 'SG2-KIT-2' : 'SG2-KIT-3';
const freshCase = (): SageCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createSageSiteState(): SageSiteState {
  return { siteId: 'SG2-ARCHIVE', introducedWeek: null, introducedDate: null, source: null, clockSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, playerEnergy: 100, formEnergySpent: 0, assimilationExposure: 0,
    body: 'SOLID', form: { active: false, expiresAt: null, anchorId: null }, iris: null, record: null,
    conduit: { id: 'SG2-CONDUIT', from: 'A', to: 'B', metres: 4, connected: true, traversals: 0 }, archive: { id: 'SG2-ARCHIVE-LEAF', owner: 'PM3-IRIS', quantity: 1, location: 'B', readings: 0, verifications: 0 },
    materials: SAGE_CASE_IDS.map(caseId => ({ id: materialId(caseId), caseId, ownerId: 'PLAYER', quantity: 1, status: 'SUPPLY', location: 'SUPPLY', wear: 0, paidPennies: 0, preparedWeek: null })), actorMoves: [] };
}
export function createSageLifeState(): SageLifeState { return { activeCase: null, reflected: false, site: createSageSiteState(), cases: { 'information-route': freshCase(), 'onsite-sift': freshCase(), 'joint-verification': freshCase() }, journal: [] }; }
const current = (l: SageLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: SageLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const kit = (p: SageSiteState, a: SageAttempt) => p.materials.find(m => m.id === a.materialId)!;
function cleanupBlock(l: SageLifeState): string | null {
  const p = l.site;
  if (p.body !== 'SOLID' || p.form.active) return '先在本人当前实际位置重组，停止信息形态。';
  if (p.playerLocation !== 'ENTRY') return '须本人沿普通道路回到门口；收尾不会传送。';
  if (p.iris && p.iris.location !== 'ENTRY') return '艾瑞丝须沿普通道路亲自返回门口。';
  if (p.record?.location === 'PLAYER' || p.materials.some(m => !['SUPPLY', 'RETURNED'].includes(m.status))) return '须取回原锚，携同一原页和本案耗材回门口归还。';
  return null;
}
export const hasSageLifeLock = (s: SliceState): boolean => contactOpen(s.sage.life) || s.sage.encounter.status === 'AVAILABLE' && cleanupBlock(s.sage.life) !== null;
export const sageInside = hasSageLifeLock;
export const sageLifeClosed = (s: SliceState): boolean => !contactOpen(s.sage.life) && !cleanupBlock(s.sage.life) && Object.values(s.sage.life.cases).every(r => r.status === 'RESOLVED');
export function validateSageActivityCommand(v: unknown): v is SageActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!SAGE_CASE_IDS.includes(v.caseId as SageCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['ENTRY', 'A', 'B'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isSageActivityCommand = validateSageActivityCommand;
export const isSageActivity = validateSageActivityCommand;
function localBlock(l: SageLifeState, c: SageActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !l.reflected && !contactOpen(l) && !cleanupBlock(l) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三次实际收尾和报告。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), i = SAGE_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'AVAILABLE' && (i === 0 || l.cases[SAGE_CASE_IDS[i - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对本案原人、原页和有限普通退路。';
  if (c.type === 'CONSENT_OWNER') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'OBSERVED' && r.consentWeek !== week && p.iris?.willing ? null : '须在门口向仍自愿的原成年艾瑞丝重新询问本周本案许可。';
  if (c.type === 'PREPARE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'OBSERVED' && r.consentWeek === week && p.iris?.consent === 'GRANTED' && p.iris.willing && r.attempts.length === 0 && p.materials[i]!.status === 'SUPPLY' && p.playerEnergy >= 22 && (c.caseId !== 'joint-verification' || p.iris.energy >= 20) ? null : '须有当前独立许可、唯一未用耗材、原页和真实往返余力；每案只准备一次。';
  if (c.type === 'REPORT') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'EXAMINED' ? null : '先在门口归还原物并结束接触，再报告实际结果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l) ?? (!a.inspected ? '先核实结果；取消也须真实收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '已经核实，只须结束接触并报告。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.permissionWithdrawn ? '本案许可已经撤回。' : null;
  if (c.type === 'STOP') return a.stopped ? '已经停止，已付成本不退。' : null;
  if (c.type === 'REASSEMBLE') return p.body === 'INFORMATION' ? null : '本人已经是完整实体；不会重复恢复资源。';
  if (c.type === 'WAIT_10') return p.form.active && a.waits < 2 ? null : '只可在本次有限窗口等待，不会续时或恢复资源。';
  if (p.body !== 'SOLID' && c.type !== 'TRAVERSE_CONDUIT') return '信息形态只能沿这段已核实通路移动或原地重组；不能操作原物。';
  if (c.type === 'WALK') {
    if (a.itemsReturned) return '本案原物已经归还，请核实收尾并结束接触。';
    if (!(['ENTRY', 'A'].includes(p.playerLocation) && ['ENTRY', 'A'].includes(c.to) || ['A', 'B'].includes(p.playerLocation) && ['A', 'B'].includes(c.to)) || p.playerLocation === c.to) return '须逐段沿门口至锚位6米、锚位至档架4米普通路行走。';
    return p.playerEnergy >= distance(p.playerLocation, c.to) + POSITION[c.to] ? null : '须留下实际取回锚和回门口的步行精力。';
  }
  const m = kit(p, a);
  if (c.type === 'REMOVE_ANCHOR') return p.playerLocation === 'A' && m.status === 'INSTALLED' ? null : '须本人在锚位，已重组后亲手取下同一原锚。';
  if (c.type === 'RETURN_OWNER') return c.caseId === 'joint-verification' && a.ownerAccompanied && !a.ownerReturned && p.playerLocation === 'ENTRY' && p.iris?.location === 'B' && p.iris.energy >= 10 ? null : '本人回门口后，请原艾瑞丝沿4米、6米普通路返回。';
  if (c.type === 'RETURN_ITEMS') return p.playerLocation === 'ENTRY' && p.iris?.location === 'ENTRY' && p.record?.location === 'PLAYER' && m.location === 'PLAYER' && (a.stopped || a.traversed && a.reassembled || a.verified) ? null : '须本人携同一原页与原耗材回到原主面前，完成实际尝试或明确停止。';
  if (c.type === 'INSPECT') return cleanupBlock(l) ?? (a.stopped || (c.caseId === 'information-route' ? a.traversed && a.reassembled || a.verified : a.verified && (c.caseId !== 'joint-verification' || a.ownerAccompanied && a.ownerReturned)) ? null : '先完成本案真实通路或核验，或明确停止并记录未完成。');
  if (a.stopped || a.consent !== 'GRANTED' || !p.iris?.willing || p.iris.consent !== 'GRANTED' || a.itemsReturned) return '当前许可已停止或撤回；仍可普通返回和归还原物。';
  if (c.type === 'INVITE_OWNER') return c.caseId === 'joint-verification' && !a.ownerAccompanied && p.playerLocation === 'ENTRY' && p.iris.location === 'ENTRY' && p.iris.energy >= 20 ? null : '联合任务须先在门口取得本案许可，让原艾瑞丝亲自走10米到档架，并保留10米返回余力。';
  if (c.type === 'INSTALL_ANCHOR') return c.caseId !== 'onsite-sift' && a.method === 'ABILITY' && !a.anchorInstalled && p.playerLocation === 'A' && m.location === 'PLAYER' && (c.caseId !== 'joint-verification' || a.ownerAccompanied) ? null : '须本人到锚位，亲手安装本案唯一耗材；联合任务须原成人已真实到场。';
  if (c.type === 'INFORMATION_FORM') return c.caseId !== 'onsite-sift' && a.method === 'ABILITY' && a.formTier === null && m.status === 'INSTALLED' && p.playerLocation === 'A' && p.playerEnergy >= 16 ? null : '须同一实体持原页在锚位，原锚已装，且有通路与实体返回余力；只尝试一次。';
  if (c.type === 'TRAVERSE_CONDUIT') return p.form.active && p.playerLocation === 'A' && !a.traversed && p.form.expiresAt! - p.clockSeconds > 4 && p.playerEnergy >= 14 ? null : '仅能沿已核实4米连通导管从锚位到档架；窗口须足4秒并保留10米普通返回精力。';
  if (c.type === 'SIFT_INFORMATION') return c.caseId !== 'information-route' && a.method === 'ABILITY' && a.siftTier === null && !a.read && p.playerLocation === 'B' && (c.caseId !== 'joint-verification' || p.iris.location === 'B') ? null : '须本人实体在原档页旁，联合案原成人也须在场；只筛取这一页现有信息一次。';
  if (c.type === 'READ_ARCHIVE') return p.playerLocation === 'B' && !a.read && (c.caseId === 'information-route' ? a.method === 'ORDINARY' || a.formTier !== null : a.method === 'ORDINARY' || a.siftTier !== null && !success(a.siftTier)) && (c.caseId !== 'joint-verification' || p.iris.location === 'B') ? null : '须实际到档架，采用普通方法或付费失败后的普通核对。';
  if (c.type === 'VERIFY_INFORMATION') return p.playerLocation === 'B' && a.read && !a.verified && (c.caseId !== 'joint-verification' || p.iris.location === 'B') ? null : '先取得本页有限信息，再现场检查原格位；缺页不能凭能力补齐。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: SageLifeState, c: SageActivityCommand, tier: PublicResolutionTier | null = null): SageLifeCost {
  const cast = c.type === 'INFORMATION_FORM' || c.type === 'SIFT_INFORMATION';
  return { actions: ['OBSERVE', 'PREPARE', 'INFORMATION_FORM', 'SIFT_INFORMATION', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'INFORMATION_FORM' ? 8 : c.type === 'SIFT_INFORMATION' ? 6 : 0, pennies: c.type === 'PREPARE' ? 20 : 0, health: 0, mind: cast ? tier !== null && !success(tier) ? 4 : 2 : c.type === 'WAIT_10' && l.site.form.active && l.site.form.expiresAt! - l.site.clockSeconds <= 10 ? 2 : 0, energy: c.type === 'INFORMATION_FORM' ? 2 : c.type === 'TRAVERSE_CONDUIT' ? 4 : c.type === 'WALK' ? distance(l.site.playerLocation, c.to) : 0, cashGained: 0 };
}
export function blockSageLife(s: SliceState, c: SageActivityCommand): string | null {
  if (!validateSageActivityCommand(c)) return '贤者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已成为贤者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原仓库档区。';
  if (hasSageOldPractice(s) || s.sage.preparedWeek !== null) return '先收束旧现场与服药准备。';
  if (s.sage.encounter.status !== 'AVAILABLE') return '现场已经转入后续遭遇，不能重开原案。';
  const why = localBlock(s.sage.life, c, s.week); if (why) return why;
  const cost = commandCost(s.sage.life, c);
  if (s.actionsRemaining < Math.max(cost.actions, c.type === 'PREPARE' ? c.caseId === 'joint-verification' && c.method === 'ABILITY' ? 3 : 2 : 0)) return '本周行动不足；联合能力准备须留足3行动，其他准备须留足2行动，停止和普通返回不耗行动。';
  if (s.cash < cost.pennies) return '本案唯一锚纸与核验耗材须实付20便士。';
  if (s.spirituality < cost.spirituality || s.mind < (c.type === 'INFORMATION_FORM' || c.type === 'SIFT_INFORMATION' ? 4 : cost.mind)) return '施术灵性或精神不足；可以普通停止和收尾。';
  return s.sage.life.site.playerEnergy < cost.energy ? '本场精力不足，换案不恢复。' : null;
}
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', id: SageCaseId, p: SageSiteState): SageAttempt {
  return { week, method, closed: false, result: 'NONE', stopped: false, inspected: false, permissionWithdrawn: false, consent: 'GRANTED', elapsedSeconds: 0, playerTravelMetres: 0, energySpent: 0, spiritualitySpent: 0, mindSpent: 0, penniesSpent: 20,
    materialId: materialId(id), itemsReturned: false, anchorInstalled: false, formTier: null, siftTier: null, traversed: false, reassembled: false, expired: false, waits: 0, ownerAccompanied: false, ownerReturned: false, read: false, verified: false, information: [], correction: null, appliedAbilityIds: [], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null };
}
function reassemble(l: SageLifeState, a: SageAttempt | null, expired = false): void {
  const p = l.site; if (!p.form.active) return; p.body = 'SOLID'; p.form = { active: false, expiresAt: null, anchorId: null };
  if (a) { a.reassembled = true; a.expired ||= expired; if (a.traversed && !a.appliedAbilityIds.includes(FORM)) a.appliedAbilityIds.push(FORM); }
}
function elapse(l: SageLifeState, seconds: number, a: SageAttempt | null = current(l)): void { l.site.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds; if (l.site.form.active && l.site.clockSeconds >= l.site.form.expiresAt!) reassemble(l, a, true); }
function walk(l: SageLifeState, to: SageLocation, a: SageAttempt, mode: SageMovement['mode'] = 'WALK'): void {
  const p = l.site, metres = distance(p.playerLocation, to), itemIds = [p.record!.id, ...(kit(p, a).location === 'PLAYER' ? [a.materialId] : [])];
  a.playerMoves.push({ actorId: 'PLAYER', from: p.playerLocation, to, mode, metres, seconds: metres, itemIds }); p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres; p.record!.travelMetres += metres; a.playerTravelMetres += metres; a.energySpent += metres; elapse(l, metres, a);
}
function ownerWalk(l: SageLifeState, to: 'ENTRY' | 'A' | 'B', a: SageAttempt): void { const p = l.site, who = p.iris!, metres = distance(who.location, to), move: SageMovement = { actorId: who.id, from: who.location, to, mode: 'WALK', metres, seconds: metres }; who.location = to; who.energy -= metres; who.travelMetres += metres; p.actorMoves.push(move); a.actorMoves.push(structuredClone(move)); elapse(l, metres, a); }
function sceneHandoff(s: SliceState, week: number): SageSceneSource { const l = s.prophecyMaster.life; return { root: 'prophecyMaster.life', promotionWeek: s.prophecyMaster.promotionWeek!, introducedWeek: week, snapshot: structuredClone({ siteId: l.siteId, owner: l.owner, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, clockSeconds: l.clockSeconds, record: l.records['bounded-source'] }) }; }
function checkSource(l: SageLifeState, c: SageActivityCommand, baseAbility: number, name: string, gender: string): SageCheckSource | null { return c.type === 'INFORMATION_FORM' || c.type === 'SIFT_INFORMATION' ? { caseId: c.caseId, abilityId: c.type === 'INFORMATION_FORM' ? FORM : SIFT, cost: c.type === 'INFORMATION_FORM' ? 8 : 6, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'hermit', sequence: 2, name, gender }, consentWeek: l.cases[c.caseId].consentWeek!, at: l.site.clockSeconds, site: structuredClone(l.site) } : null; }
const FRAGMENTS = ['原档页第三栏写着“封存盒已盖”，只涉及眼前格位。', '一条旧旁注称第四格空置；这只是原页现有说法，可能错误。', '第四格正文已经缺失，没有可提取的文字，内容仍未知。'];
function evolve(l: SageLifeState, c: SageActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: SageSceneSource | null): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, 10, null); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    if (p.introducedWeek === null) { if (!source) throw new Error('缺少原人原页来源。'); p.introducedWeek = week; p.introducedDate = structuredClone(date); p.source = structuredClone(source); p.iris = { ...structuredClone(source.snapshot.owner), location: 'ENTRY', energy: 100, travelMetres: 0, consent: 'UNASKED' }; p.record = { ...structuredClone(source.snapshot.record), id: 'PM3-BOUNDARY-RECORD', location: 'OWNER' }; }
    r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, 4, null); return;
  }
  if (c.type === 'CONSENT_OWNER') { r.consentWeek = week; p.iris!.consent = 'GRANTED'; elapse(l, 2, null); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, c.method, c.caseId, p); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; p.record!.location = 'PLAYER'; const m = kit(p, a); m.status = 'PLAYER'; m.location = 'PLAYER'; m.paidPennies = 20; m.preparedWeek = week; elapse(l, 4, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, 4, null); return; }
  const a = r.attempts.at(-1)!, m = kit(p, a);
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent !== 'WITHDRAWN') a.consent = 'CLOSED'; if (p.iris!.consent !== 'WITHDRAWN') p.iris!.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, 2, a); a.siteAtClose = structuredClone(p); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': walk(l, c.to, a); break;
    case 'INVITE_OWNER': ownerWalk(l, 'A', a); ownerWalk(l, 'B', a); a.ownerAccompanied = true; break;
    case 'RETURN_OWNER': ownerWalk(l, 'A', a); ownerWalk(l, 'ENTRY', a); a.ownerReturned = true; break;
    case 'INSTALL_ANCHOR': m.status = 'INSTALLED'; m.location = 'A'; a.anchorInstalled = true; elapse(l, 2, a); break;
    case 'REMOVE_ANCHOR': m.status = 'PLAYER'; m.location = 'PLAYER'; elapse(l, 2, a); break;
    case 'INFORMATION_FORM': a.formTier = tier; a.spiritualitySpent += 8; a.mindSpent += success(tier) ? 2 : 4; a.energySpent += 2; p.playerEnergy -= 2; p.formEnergySpent += 2; p.assimilationExposure++; m.wear += 2; r.status = 'ACTIVE'; elapse(l, 4, a); if (success(tier)) { p.body = 'INFORMATION'; p.form = { active: true, expiresAt: p.clockSeconds + 20, anchorId: m.id }; } break;
    case 'TRAVERSE_CONDUIT': a.traversed = true; walk(l, 'B', a, 'INFORMATION_CONDUIT'); p.conduit.traversals++; break;
    case 'REASSEMBLE': reassemble(l, a); elapse(l, 2, a); break;
    case 'SIFT_INFORMATION': a.siftTier = tier; a.spiritualitySpent += 6; a.mindSpent += success(tier) ? 2 : 4; p.assimilationExposure++; m.wear++; r.status = 'ACTIVE'; elapse(l, 4, a); if (success(tier)) { a.read = true; a.information = [...FRAGMENTS]; p.archive.readings++; } break;
    case 'READ_ARCHIVE': a.read = true; a.information = [...FRAGMENTS]; p.archive.readings++; m.wear++; r.status = 'ACTIVE'; elapse(l, 6, a); break;
    case 'VERIFY_INFORMATION': a.verified = true; p.archive.verifications++; a.correction = '本人现场核实：第三格原盒确已盖；第四格实际放着一只空夹，旧旁注“空置”不准确。缺失正文无法复原，仍记未知。'; if (success(a.siftTier)) a.appliedAbilityIds.push(SIFT); elapse(l, 6, a); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.consent = 'WITHDRAWN'; p.iris!.consent = 'WITHDRAWN'; a.stopped = true; reassemble(l, a); elapse(l, 2, a); break;
    case 'STOP': a.stopped = true; reassemble(l, a); elapse(l, 2, a); break;
    case 'WAIT_10': a.waits++; if (p.form.active && p.form.expiresAt! - p.clockSeconds <= 10) { a.mindSpent += 2; p.assimilationExposure++; } elapse(l, 10, a); break;
    case 'RETURN_ITEMS': p.record!.location = 'OWNER'; m.status = 'RETURNED'; m.location = 'OWNER'; a.itemsReturned = true; elapse(l, 2, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, 2, a); break;
  }
}
export function applySageActivity(s: SliceState, c: SageActivityCommand, ctx: SeerContext): void {
  const reason = blockSageLife(s, c); if (reason) throw new Error(reason);
  const l = s.sage.life, source = checkSource(l, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene = c.type === 'OBSERVE' && l.site.introducedWeek === null ? sceneHandoff(s, s.week) : null;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(l, c, tier);
  const budget: SageLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind, energyBefore: l.site.playerEnergy, energyAfter: l.site.playerEnergy - paid.energy };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.mind = budget.mindAfter;
  evolve(l, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原仓库档区：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATION_LABELS[l.site.playerLocation]}，本场精力余${l.site.playerEnergy}。原成人、原页、实际移动和耗材磨损持续保留。${c.type === 'INFORMATION_FORM' ? '本次8灵性包含预付重组代价，另耗2精神与2精力，失败再受2精神同化冲击；窗口耗尽也另损2精神，预付重组不能消去冲击。锚只维持这20秒短路，不提供任意传送或免伤。' : c.type === 'SIFT_INFORMATION' ? '只读当前原页实际存在的信息，旧旁注可能错误，缺文仍未知；须普通核验。' : ''}`);
}
export const applySageLife = applySageActivity;
export const handleSageLife = applySageActivity;
const LOCATION_LABELS: Record<SageLocation, string> = { ENTRY: '原仓库门口', A: '六米锚位', B: '十米档架', OUTSIDE: '院外', YARD: '独立后院' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<SageActivityCommand['type'], string> = { OBSERVE: '核对原人原页与普通退路', CONSENT_OWNER: '询问艾瑞丝本案当前许可', PREPARE: '支付20便士并借取同一原页', WALK: '沿普通道路步行', INVITE_OWNER: '请艾瑞丝实际步行到档架', RETURN_OWNER: '请艾瑞丝沿普通路返回', INSTALL_ANCHOR: '亲手安装本案唯一锚纸', REMOVE_ANCHOR: '在锚位取回同一耗材', INFORMATION_FORM: '以同一本体尝试短暂信息化', TRAVERSE_CONDUIT: '沿连通导管实际前行4米', REASSEMBLE: '在当前原位置重组本体', SIFT_INFORMATION: '筛取眼前原档页现有信息', READ_ARCHIVE: '普通阅读同一原档页', VERIFY_INFORMATION: '实际检查格位并核对缺误', WITHDRAW_PERMISSION: '听取原成人撤回本案许可', RETURN_ITEMS: '当面交还原页和同一耗材', STOP: '停止施术并原地重组', WAIT_10: '实际等待10秒', INSPECT: '核实实际结果与收尾', LEAVE: '结束已收束接触', CLOSE: '结束已收束接触', WITHDRAW: '如实取消并结束接触', REPORT: '报告已实际发生的结果', REFLECT: '反思三次有限实践' };
export const SAGE_LIFE_STORY = '原成年艾瑞丝49岁与她的同一原记录页继续留在原仓库。每案重新取得可撤回许可，20便士只领一份有限锚纸和核验耗材。信息化把同一本体及实持原页变成信息形态，成功仅开放20秒、4米已核实连通导管；8灵性含重组预付，另耗2精神与2精力。筛取6灵性、2精神，只获得眼前档页实际信息，缺失与错误仍须普通核验。两种尝试失败均另损2精神；信息窗耗尽后原地重组另损2精神，不能无敌、补资源或任意传送。此处三案不代替晋升仪式。';
export const SAGE_LIFE_ENVIRONMENT = '门口至锚位6米，锚位至档架4米；普通道路始终可返回。原成人沿同一路步行。初始场地精力100，每米耗1，换案不恢复。原页始终只有一份，原物磨损和实际成本保留。';
const CASES: { id: SageCaseId; title: string; story: string }[] = [
  { id: 'information-route', title: '同一本体经过四米导管', story: '在原锚位尝试信息化，持同一原页沿实际4米连通导管前行，到达后原地重组，再普通步行回收原锚、归页。成功准备不等于实际应用；失败可普通步行核对或停止。' },
  { id: 'onsite-sift', title: '档页里确实存在的缺误', story: '本人携原页沿普通路走到档架，筛取原档页现有内容。旧旁注可能错误、缺页仍未知，必须亲自检查第三、第四格并保留修正，再普通返回归物。' },
  { id: 'joint-verification', title: '共同核验与随时停止', story: '艾瑞丝以本案独立许可亲自走到档架。你可沿有限导管信息化移动并重组，再筛取当前原页；双方核对现实格位。她可随时撤回，停止不会控制她、抹去记忆或改变原物，仍须各自实际返回。' },
];
export function sageLifeActions(s: SliceState): SageLifeAction[] {
  if (!promoted(s) || s.sage.encounter.status !== 'AVAILABLE') return [];
  const l = s.sage.life, out: SageLifeAction[] = [], id = l.activeCase ?? SAGE_CASE_IDS.find(id => l.cases[id].status !== 'RESOLVED');
  const add = (command: SageActivityCommand) => { const reason = blockSageLife(s, command), cost = commandCost(l, command), values = [`${cost.actions}行动`]; if (cost.pennies) values.push(`${cost.pennies}便士`); if (cost.spirituality) values.push(`${cost.spirituality}灵性`); if (cost.mind) values.push(`${cost.mind}精神`); if (cost.energy) values.push(`${cost.energy}精力`); if (command.type === 'INFORMATION_FORM' || command.type === 'SIFT_INFORMATION') values.push('知识20', '失败另损2精神'); out.push({ id: `SG2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + (command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATION_LABELS[command.to]}` : ''), cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id], a = r.attempts.at(-1);
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'CONSENT_OWNER', caseId: id }); add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen && a) {
    if (a.inspected) { add({ type: 'LEAVE', caseId: id }); return out; }
    for (const type of STEPS) { if (['OBSERVE', 'CONSENT_OWNER', 'REPORT', 'LEAVE', 'CLOSE', 'WITHDRAW'].includes(type)) continue; const command: SageActivityCommand = { type, caseId: id }; if (localBlock(l, command, s.week) === null) add(command); }
    for (const to of ['ENTRY', 'A', 'B'] as const) if (localBlock(l, { type: 'WALK', caseId: id, to }, s.week) === null) add({ type: 'WALK', caseId: id, to });
  }
  return out;
}
export function projectSageLife(s: SliceState): SageLifeProjection { const l = s.sage.life, p = s.sage.encounter.currentSite ?? l.site; return { title: '原仓库的有限信息实践', story: SAGE_LIFE_STORY, environment: SAGE_LIFE_ENVIRONMENT, activeCase: l.activeCase, inside: hasSageLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected, site: publicSageSite(p), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: current(l) ? publicSageAttempt(current(l)!) : null, cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { ...d, observations: a ? [`实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性、${a.mindSpent}精神；移动${a.playerTravelMetres}米、经过${a.elapsedSeconds}秒、耗${a.energySpent}精力。`, ...a.information, ...(a.correction ? [a.correction] : []), ...(a.permissionWithdrawn ? ['原成人已撤回当前许可，后续只可普通收尾。'] : []), `已实际应用并待如实报告的技巧：${a.appliedAbilityIds.length}项。`] : [], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '实际能力应用与核验记录已保留。' : '普通方法或明确停止，不增加未应用技巧的掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(publicSageAttempt) }; }), actions: sageLifeActions(s) }; }
export function validateSageSceneSource(v: unknown): v is SageSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'prophecyMaster.life' || !integer(v.promotionWeek, 1) || !integer(v.introducedWeek, v.promotionWeek) || !record(v.snapshot)) return false;
    const p = v.snapshot;
    if (!shape(p, ['siteId', 'owner', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'record']) || p.siteId !== 'PM3-WAREHOUSE' || p.playerLocation !== 'START' || !integer(p.playerTravelMetres) || !integer(p.clockSeconds) || !record(p.owner) || typeof p.owner.willing !== 'boolean') return false;
    if (!same(p.owner, { id: 'PM3-IRIS', name: '艾瑞丝·沃德', age: 49, alive: true, willing: p.owner.willing, location: 'START' }) || !record(p.record) || !integer(p.record.travelMetres)) return false;
    return same(p.record, { id: 'PM3-BOUNDARY-RECORD', owner: 'PM3-IRIS', quantity: 1, location: 'OWNER', travelMetres: p.record.travelMetres });
  } catch { return false; }
}
/** Site checks allow the separately replay-validated encounter continuation. Life itself is replayed exactly below. */
export function validateSageSiteState(v: unknown): v is SageSiteState {
  try {
    const initial = createSageSiteState(); if (!record(v) || !shape(v, Object.keys(initial))) return false; const p = v as unknown as SageSiteState;
    if (p.siteId !== initial.siteId || !integer(p.clockSeconds) || !integer(p.playerTravelMetres, 0, 100) || !integer(p.playerEnergy, 0, 100) || !integer(p.formEnergySpent, 0, 100) || p.playerEnergy + p.playerTravelMetres + p.formEnergySpent !== 100 || !integer(p.assimilationExposure, 0, 1000) || !Object.keys(POSITION).includes(p.playerLocation)) return false;
    if (p.introducedWeek === null) return same(p, initial);
    if (!integer(p.introducedWeek, 1) || !isValidGameDate(p.introducedDate) || !validateSageSceneSource(p.source) || p.source.introducedWeek !== p.introducedWeek) return false;
    const who = p.iris;
    if (!record(who) || !shape(who, ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'consent']) || !integer(who.energy, 0, 100) || !integer(who.travelMetres, 0, 100) || who.energy + who.travelMetres !== 100 || !['ENTRY', 'A', 'B', 'OUTSIDE'].includes(String(who.location)) || !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(String(who.consent)) || !same(who, { ...p.source.snapshot.owner, location: who.location, energy: who.energy, travelMetres: who.travelMetres, consent: who.consent })) return false;
    if (!Array.isArray(p.actorMoves) || p.actorMoves.length > 20) return false;
    let at: SageLocation = 'ENTRY', travel = 0;
    for (const move of p.actorMoves) {
      if (!record(move) || !shape(move, ['actorId', 'from', 'to', 'mode', 'metres', 'seconds']) || move.actorId !== 'PM3-IRIS' || move.mode !== 'WALK' || move.from !== at || !['ENTRY', 'A', 'B', 'OUTSIDE'].includes(move.to) || move.to === at || !integer(move.metres, 1, 10) || move.metres !== distance(at, move.to) || move.seconds !== move.metres) return false;
      if (!(['ENTRY', 'A'].includes(at) && ['ENTRY', 'A'].includes(move.to) || ['A', 'B'].includes(at) && ['A', 'B'].includes(move.to) || ['ENTRY', 'OUTSIDE'].includes(at) && ['ENTRY', 'OUTSIDE'].includes(move.to))) return false;
      at = move.to; travel += move.metres;
    }
    if (who.location !== at || who.travelMetres !== travel || p.clockSeconds < p.playerTravelMetres + who.travelMetres) return false;
    const page = p.record;
    if (!record(page) || !shape(page, ['id', 'owner', 'quantity', 'location', 'travelMetres']) || !['OWNER', 'PLAYER'].includes(page.location) || !integer(page.travelMetres, p.source.snapshot.record.travelMetres, p.source.snapshot.record.travelMetres + p.playerTravelMetres) || !same(page, { ...p.source.snapshot.record, location: page.location, travelMetres: page.travelMetres })) return false;
    if (!record(p.conduit) || !integer(p.conduit.traversals, 0, 2) || !same(p.conduit, { ...initial.conduit, traversals: p.conduit.traversals }) || !record(p.archive) || !integer(p.archive.readings, 0, 3) || !integer(p.archive.verifications, 0, p.archive.readings) || !same(p.archive, { ...initial.archive, readings: p.archive.readings, verifications: p.archive.verifications })) return false;
    if (!Array.isArray(p.materials) || p.materials.length !== 3) return false;
    for (let i = 0; i < p.materials.length; i++) {
      const m = p.materials[i]!, original = initial.materials[i]!;
      if (!record(m) || !shape(m, Object.keys(original)) || !['SUPPLY', 'PLAYER', 'INSTALLED', 'RETURNED'].includes(m.status) || !['SUPPLY', 'PLAYER', 'A', 'OWNER'].includes(m.location) || !integer(m.wear, 0, 4) || !same(m, { ...original, status: m.status, location: m.location, wear: m.wear, paidPennies: m.paidPennies, preparedWeek: m.preparedWeek })) return false;
      if (m.status === 'SUPPLY') { if (!same(m, original)) return false; }
      else if (m.paidPennies !== 20 || !integer(m.preparedWeek, p.introducedWeek) || m.status === 'PLAYER' && m.location !== 'PLAYER' || m.status === 'INSTALLED' && (m.location !== 'A' || i === 1) || m.status === 'RETURNED' && m.location !== 'OWNER') return false;
    }
    if (!record(p.form) || !shape(p.form, ['active', 'expiresAt', 'anchorId']) || typeof p.form.active !== 'boolean' || !['SOLID', 'INFORMATION'].includes(p.body)) return false;
    if (p.form.active) {
      if (p.body !== 'INFORMATION' || !['A', 'B'].includes(p.playerLocation) || !integer(p.form.expiresAt, p.clockSeconds + 1, p.clockSeconds + 20) || !p.materials.some(m => m.id === p.form.anchorId && m.status === 'INSTALLED') || who.consent !== 'GRANTED' || page.location !== 'PLAYER') return false;
    } else if (p.body !== 'SOLID' || p.form.expiresAt !== null || p.form.anchorId !== null) return false;
    return true;
  } catch { return false; }
}
function validBudget(b: SageLifeBudget, cost: SageLifeCost, c: SageActivityCommand, energy: number): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'])) return false;
  for (const key of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[key])) return false;
  for (const key of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[key], 0, 120)) return false;
  for (const key of ['healthBefore', 'healthAfter'] as const) if (!integer(b[key], 1, 100)) return false;
  for (const key of ['mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'] as const) if (!integer(b[key], 0, 100)) return false;
  return b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore - cost.pennies && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind && b.energyBefore === energy && b.energyAfter === energy - cost.energy && !(c.type === 'PREPARE' && b.actionsBefore < (c.caseId === 'joint-verification' && c.method === 'ABILITY' ? 3 : 2)) && !((c.type === 'INFORMATION_FORM' || c.type === 'SIFT_INFORMATION') && b.mindBefore < 4);
}
export function validateSageLife(s: SliceState): boolean {
  try {
    const l = s.sage?.life, promotion = s.sage?.promotionWeek, expected = createSageLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, SAGE_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 400 || !validateSageSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week) || !integer(s.prophecyMaster.promotionWeek, 1, promotion)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: SageLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateSageActivityCommand(raw.command)) return false;
      const event = raw as unknown as SageLifeEvent, c = event.command, wasOpen = contactOpen(expected), cost = commandCost(expected, c, event.tier), b = event.budget;
      if (wasOpen && (event.week !== lastWeek || previous && !same(event.date, previous.date)) || localBlock(expected, c, event.week) || !same(event.paid, cost) || !validBudget(b, cost, c, expected.site.playerEnergy)) return false;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter || b.energyBefore !== old.energyAfter) return false; }
      const handoff = c.type === 'OBSERVE' && expected.site.introducedWeek === null ? sceneHandoff(s, event.week) : null;
      if (!same(event.inheritedScene, handoff) || handoff !== null && !validateSageSceneSource(handoff)) return false;
      const base = record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0;
      const name = record(event.source) && record(event.source.actor) && typeof event.source.actor.name === 'string' ? event.source.actor.name : '';
      const gender = record(event.source) && record(event.source.actor) && typeof event.source.actor.gender === 'string' ? event.source.actor.gender : '';
      const source = checkSource(expected, c, base, name, gender); if (!same(event.source, source)) return false;
      if (source) {
        if (name !== s.character.name || gender !== s.character.gender || base !== s.character.coreStats.knowledge || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check)) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: base, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || event.tier !== check.tier || random.cursor !== event.randomAfter) return false; nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.date, event.tier, handoff);
      if (!validateSageSiteState(expected.site) || expected.site.playerEnergy !== b.energyAfter) return false;
      expected.journal.push(structuredClone(event)); previous = event; lastWeek = event.week;
    }
    if (!same(l, expected)) return false;
    if (s.sage.encounter.status !== 'AVAILABLE' && (contactOpen(l) || !l.reflected || cleanupBlock(l) || !Object.values(l.cases).every(r => r.status === 'RESOLVED'))) return false;
    if (contactOpen(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.sage.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return false;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter || l.site.playerEnergy !== b.energyAfter) return false;
    }
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of [FORM, SIFT]) { const earned = reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0); if (s.progression.mastery[id] !== earned) return false; }
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
export const validateSageLifeState = validateSageLife;

/** Positive public evidence helpers for the inherited Pryer chain. Never copy replay provenance. */
export function publicPryerFields<T, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;
}
export const publicPryerDate = (d: PublicGameDate): PublicGameDate => publicPryerFields(d, ['epoch', 'year', 'month', 'day']);
export const publicPryerInjury = (i: SliceInjury): SliceInjury => publicPryerFields(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']);
export const publicPryerCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ...publicPryerFields(c, ['ability', 'baseAbility', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier']),
  modifiers: c.modifiers.map(m => publicPryerFields(m, ['source', 'value'])),
}) : null;
export const publicPryerScroll = (s: Pick<ScrollProfessorScroll, 'id' | 'materialId' | 'makerSequence' | 'inscriptionMastery'>) =>
  publicPryerFields(s, ['id', 'materialId', 'makerSequence', 'inscriptionMastery']);
export const publicPryerWorkshop = (w: ScrollProfessorWorkshop): ScrollProfessorWorkshop => ({
  ...publicPryerFields(w, ['kitsBought', 'lastKitWeek', 'craftAttempts', 'craftFailures']),
  materials: w.materials.map(m => publicPryerFields(m, ['id', 'acquiredWeek', 'status', 'spentWeek'])),
  scrolls: w.scrolls.map(s => publicPryerFields(s, ['id', 'kind', 'makerSequence', 'inscriptionMastery', 'materialId', 'createdWeek', 'status', 'usedWeek', 'authorized'])),
});
export const publicSageMovement = (m: SageMovement): SageMovement => ({
  ...publicPryerFields(m, ['actorId', 'from', 'to', 'mode', 'metres', 'seconds']),
  ...(m.itemIds ? { itemIds: [...m.itemIds] } : {}),
});
export function publicSageSite(p: SageSiteState) { return {
  ...publicPryerFields(p, ['siteId', 'introducedWeek', 'clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy', 'formEnergySpent', 'assimilationExposure', 'body']),
  introducedDate: p.introducedDate ? publicPryerDate(p.introducedDate) : null,
  form: publicPryerFields(p.form, ['active', 'expiresAt', 'anchorId']),
  iris: p.iris ? publicPryerFields(p.iris, ['id', 'name', 'age', 'alive', 'willing', 'location', 'energy', 'travelMetres', 'consent']) : null,
  record: p.record ? publicPryerFields(p.record, ['id', 'owner', 'quantity', 'location', 'travelMetres']) : null,
  conduit: publicPryerFields(p.conduit, ['id', 'from', 'to', 'metres', 'connected', 'traversals']),
  archive: publicPryerFields(p.archive, ['id', 'owner', 'quantity', 'location', 'readings', 'verifications']),
  materials: p.materials.map(m => publicPryerFields(m, ['id', 'caseId', 'ownerId', 'quantity', 'status', 'location', 'wear', 'paidPennies', 'preparedWeek'])),
  actorMoves: p.actorMoves.map(publicSageMovement),
}; }
export type SagePublicSite = ReturnType<typeof publicSageSite>;
export function publicSageAttempt(a: SageAttempt) { return {
  ...publicPryerFields(a, ['week', 'method', 'closed', 'result', 'stopped', 'inspected', 'permissionWithdrawn', 'consent', 'elapsedSeconds', 'playerTravelMetres', 'energySpent', 'spiritualitySpent', 'mindSpent', 'penniesSpent', 'materialId', 'itemsReturned', 'anchorInstalled', 'formTier', 'siftTier', 'traversed', 'reassembled', 'expired', 'waits', 'ownerAccompanied', 'ownerReturned', 'read', 'verified', 'correction']),
  information: [...a.information], appliedAbilityIds: [...a.appliedAbilityIds], playerMoves: a.playerMoves.map(publicSageMovement), actorMoves: a.actorMoves.map(publicSageMovement),
  siteAtStart: publicSageSite(a.siteAtStart), siteAtClose: a.siteAtClose ? publicSageSite(a.siteAtClose) : null,
}; }
export type SagePublicAttempt = ReturnType<typeof publicSageAttempt>;
