import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { hasArcaneScholarLifeLock } from '../arcane-scholar/life.js';
import { hasKnowledgeMentorLifeLock } from '../knowledge-mentor/life.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { CivilizationEnlightenerAction } from './types.js';

/** Original bounded design: the original text establishes the S1 title, not these
 * numerical exercises. No new machine, soul, energy or supernatural pupil skill
 * is supplied by either ability. The old manufacture ledger remains historical. */
export const CIVILIZATION_ENLIGHTENER_CASE_IDS = ['worn-bearing', 'taught-stop', 'withdrawn-operation'] as const;
export const CIVILIZATION_ENLIGHTENER_OBJECT_IDS = ['AL4-BOX-1', 'AL4-FRAME-1'] as const;
export type CivilizationEnlightenerCaseId = typeof CIVILIZATION_ENLIGHTENER_CASE_IDS[number];
export type CivilizationEnlightenerObjectId = typeof CIVILIZATION_ENLIGHTENER_OBJECT_IDS[number];
export type CivilizationEnlightenerNode = 'NEAR' | 'FAR';
export type CivilizationEnlightenerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
export type CivilizationEnlightenerActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: CivilizationEnlightenerCaseId }
  | { type: 'INVITE'; caseId: CivilizationEnlightenerCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; permission: 'ABILITY' | 'TEACHING' }
  | { type: 'MOVE'; to: CivilizationEnlightenerNode }
  | { type: 'BORROW_WRENCH' | 'ENTER_WORKSHOP' | 'PLACE_ORIGINALS' | 'READ_RECORDS' | 'INSPECT_FRAME' | 'PROCESS_ANALYSIS' | 'HAND_INSPECT' | 'BUY_SHIM' | 'REPAIR_FRAME' | 'DEMONSTRATE_STOP' | 'OPERATIONAL_GUIDANCE' | 'ARM_MANUAL_LOAD' | 'LEARNER_TRY' | 'WAIT_GUIDANCE' | 'MANUAL_STOP' | 'RETURN_ORIGINALS' | 'RETURN_WRENCH' | 'RETURN_HOME' | 'ABORT' | 'REFLECT' };
export interface CivilizationEnlightenerOriginalSnapshot {
  id: CivilizationEnlightenerObjectId; charge: number; durability: number; location: AlchemistCreation['location']; active: boolean;
}
export interface CivilizationEnlightenerOriginalEvent {
  revision: number; week: number; source: string; before: CivilizationEnlightenerOriginalSnapshot[]; after: CivilizationEnlightenerOriginalSnapshot[];
}
export interface CivilizationEnlightenerLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface CivilizationEnlightenerLifeReceipt {
  week: number; date: PublicGameDate; revision: number;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null;
  command: CivilizationEnlightenerActivityCommand; outcome: PublicResolutionTier | null;
  before: CivilizationEnlightenerLifeBudget; after: CivilizationEnlightenerLifeBudget;
  elapsedSeconds: number; ownerWalkedMetres: number; veraWalkedMetres: number; originalsCarriedMetres: number; wrenchCarriedMetres: number;
  originalsBefore: CivilizationEnlightenerOriginalSnapshot[]; originalsAfter: CivilizationEnlightenerOriginalSnapshot[];
  loadTransitions: ('HAND_START' | 'HAND_STOP' | 'LEARNER_STOP')[];
}
export interface CivilizationEnlightenerPublicLifeReceipt {
  week: number; date: PublicGameDate; revision: number;
  checkBase: number | null; check: PublicCheckResult | null;
  command: CivilizationEnlightenerActivityCommand; outcome: PublicResolutionTier | null;
  before: CivilizationEnlightenerLifeBudget; after: CivilizationEnlightenerLifeBudget;
  elapsedSeconds: number; ownerWalkedMetres: number; veraWalkedMetres: number; originalsCarriedMetres: number; wrenchCarriedMetres: number;
  originalsBefore: CivilizationEnlightenerOriginalSnapshot[]; originalsAfter: CivilizationEnlightenerOriginalSnapshot[];
  loadTransitions: ('HAND_START' | 'HAND_STOP' | 'LEARNER_STOP')[];
}
export interface CivilizationEnlightenerLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; invitedWeek: number | null; invitationWeeks: number[]; method: Method | null;
  permission: { ability: CivilizationEnlightenerConsent; teaching: CivilizationEnlightenerConsent }; permissionRevision: number;
  entered: boolean; contactOpen: boolean; originalsPlaced: boolean; originalsReturned: boolean;
  recordsRead: boolean; baselineInspected: boolean; defectKnown: boolean; handsInspected: boolean; repairDone: boolean;
  demonstrated: boolean; learnerWantsStep: boolean; learnerAttempted: boolean; learnerOutcome: PublicResolutionTier | null; ordinaryStepLearned: boolean;
  abilityAttempted: boolean; abilityApplied: boolean; outcome: PublicResolutionTier | null;
  guidanceEnd: 'NONE' | 'PENDING' | 'FAILED' | 'APPLIED' | 'LEARNER_FAILED' | 'WITHDRAWN' | 'EXPIRED' | 'CANCELLED';
  loadArmed: boolean; result: Result; returned: boolean;
}
export interface CivilizationEnlightenerLifeSourceRecord {
  workbenchId: 'AL4-WORKBENCH-1'; pieceRecords: string[]; frameManufactureDigest: string; boxManufactureDigest: string;
}
export interface CivilizationEnlightenerLifePractice {
  workbenchId: 'AL4-WORKBENCH-1'; activeCase: CivilizationEnlightenerCaseId | null;
  ownerNode: CivilizationEnlightenerNode; elapsedSeconds: number; ownerWalkedMetres: number;
  participant: { id: 'KM2-VERA'; name: '维拉'; age: 39; present: boolean; node: CivilizationEnlightenerNode; walkedMetres: number };
  parcel: { id: 'KM2-VERA-PARCEL'; owner: 'KM2-VERA'; holder: 'KM2-VERA'; location: 'OWNER' };
  stopBar: { id: 'KM2-STOP-BAR'; location: 'RACK'; loadRunning: boolean };
  handle: { id: 'AR3-LOAD-HANDLE'; node: 'FAR'; demonstrations: number; ordinaryStops: number; learnerStops: number };
  wrench: { id: 'CE1-WRENCH-1'; owner: 'EDWIN-WARD'; holder: 'RACK' | 'PLAYER'; node: CivilizationEnlightenerNode; loans: number; returns: number };
  shim: { id: 'CE1-SHIM-1'; source: 'WARD-WORKSHOP'; price: 40; status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; purchasedWeek: number | null; consumedWeek: number | null };
  pendingGuidance: { caseId: 'taught-stop'; createdAt: number; expiresAt: number; permissionRevision: number; bonus: 10 } | null;
  invitation: { caseId: CivilizationEnlightenerCaseId; week: number; method: Method }[];
  abilityUses: Record<'paragon.s1.process-analysis' | 'paragon.s1.operational-guidance', { attempts: number; successes: number; applied: number }>;
}
export interface CivilizationEnlightenerLifeState {
  sourceWeek: number | null; sourceRecord: CivilizationEnlightenerLifeSourceRecord | null;
  sourceOriginals: CivilizationEnlightenerOriginalSnapshot[]; practice: CivilizationEnlightenerLifePractice;
  cases: Record<CivilizationEnlightenerCaseId, CivilizationEnlightenerLifeCase>; reflected: boolean; journal: CivilizationEnlightenerLifeReceipt[];
}
export interface CivilizationEnlightenerLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  practice: CivilizationEnlightenerLifePractice; creations: AlchemistCreation[];
  currentConsents: { id: 'KM2-VERA'; consented: boolean; teachingConsented: boolean }[];
  cases: { id: CivilizationEnlightenerCaseId; title: string; story: string; observations: string[]; status: string;
    permission: CivilizationEnlightenerLifeCase['permission']; contactOpen: boolean; preparation: string | null; result: string | null; returned: boolean;
    attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; learnerOutcome: PublicResolutionTier | null;
      evidence: { abilityAttempted: boolean; abilityApplied: boolean; returned: boolean; result: Result; ordinaryStepLearned: boolean }; receipts: CivilizationEnlightenerPublicLifeReceipt[] }[] }[];
  ledger: CivilizationEnlightenerPublicLifeReceipt[];
}
const ANALYSIS = 'paragon.s1.process-analysis', GUIDANCE = 'paragon.s1.operational-guidance';
const ABILITIES = [ANALYSIS, GUIDANCE] as const;
const CASES = [
  { id: 'worn-bearing', title: '磨损轴承：理解之后还须亲手修理', story: '回到埃德温·沃德的原工作台。你的原护架耐久90，储能0；维拉只在本次重新受邀后到场。原制造记录和实际磨损都须当面核对。', facts: ['工艺析解仅尝试识别这一处既存轴承磨损：6灵性、2精神，知识18，一次机会；失败仍付费。', '无论是否使用能力，都须亲手检查，再购买40便士的唯一黄铜垫片、借用唯一普通扳手并明确修理。', '真实修理只让同一原架耐久增加5，最多100；不增加任何储能。两件原物与扳手都须实际取回归还。'] },
  { id: 'taught-stop', title: '示范停载：给普通学习一次有限帮助', story: '维拉想学的是拉下原手柄、停止一份低载荷的普通操作。她重新确认本案参与与能力许可，也可拒绝学习。你的原盒原架不会因授课而自行启动。', facts: ['先由本人亲手示范原手柄，再给愿意学习的维拉一次操作启示：8灵性、3精神，知识20，一次机会。', '成功只留下30秒内的一次普通尝试加值10；须另行手动加载，再由维拉实际尝试。她的普通知识12、难度20，失败会保留真实结果。', '施术或学习失败后可由本人拉原手柄普通停载；没有给她写入超凡能力。只有实际成功的引导操作才增加掌握。'] },
  { id: 'withdrawn-operation', title: '撤回操作：听见停止，照常还物', story: '这一次维拉到达原台边后撤回超凡许可。普通示范、本人手动停载和原物归还仍可完成；旧案同意不能代替眼前决定。', facts: ['撤回立即终止超凡作用，不能重新征得同案能力许可来重抽。', '只使用原手柄做普通停载，原挡条始终留在架上，原包裹始终属于维拉。', '停止负载、收回两件原物、归还扳手，身体再实际走回两米外入口；本案没有能力掌握奖励。'] },
] as const;
export const CIVILIZATION_ENLIGHTENER_LIFE_ENVIRONMENT = '同一沃德工坊AL4-WORKBENCH-1，近处入口到远端原台2米，步行实耗2秒。维拉39岁，逐案重新邀请和询问许可。观察1行动，邀请1行动20便士，报告1行动；唯一垫片40便士。每案25扮演，三案反思再25，仅实际成功应用对应能力的报告增加8掌握。暂停后最多两次跨周付费普通续办；保留已付代价、原失败、原垫片和已完成修理。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 1;
const budget = (s: SliceState): CivilizationEnlightenerLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const freshCase = (): CivilizationEnlightenerLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invitedWeek: null, invitationWeeks: [], method: null,
  permission: { ability: 'UNASKED', teaching: 'UNASKED' }, permissionRevision: 0, entered: false, contactOpen: false, originalsPlaced: false, originalsReturned: false,
  recordsRead: false, baselineInspected: false, defectKnown: false, handsInspected: false, repairDone: false, demonstrated: false, learnerWantsStep: false,
  learnerAttempted: false, learnerOutcome: null, ordinaryStepLearned: false, abilityAttempted: false, abilityApplied: false, outcome: null, guidanceEnd: 'NONE', loadArmed: false, result: 'NONE', returned: false });
const freshCases = (): Record<CivilizationEnlightenerCaseId, CivilizationEnlightenerLifeCase> => ({ 'worn-bearing': freshCase(), 'taught-stop': freshCase(), 'withdrawn-operation': freshCase() });
function freshPractice(): CivilizationEnlightenerLifePractice {
  return { workbenchId: 'AL4-WORKBENCH-1', activeCase: null, ownerNode: 'NEAR', elapsedSeconds: 0, ownerWalkedMetres: 0,
    participant: { id: 'KM2-VERA', name: '维拉', age: 39, present: false, node: 'NEAR', walkedMetres: 0 },
    parcel: { id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'KM2-VERA', location: 'OWNER' },
    stopBar: { id: 'KM2-STOP-BAR', location: 'RACK', loadRunning: false }, handle: { id: 'AR3-LOAD-HANDLE', node: 'FAR', demonstrations: 0, ordinaryStops: 0, learnerStops: 0 },
    wrench: { id: 'CE1-WRENCH-1', owner: 'EDWIN-WARD', holder: 'RACK', node: 'NEAR', loans: 0, returns: 0 },
    shim: { id: 'CE1-SHIM-1', source: 'WARD-WORKSHOP', price: 40, status: 'SUPPLIER', purchasedWeek: null, consumedWeek: null }, pendingGuidance: null,
    invitation: [], abilityUses: { [ANALYSIS]: { attempts: 0, successes: 0, applied: 0 }, [GUIDANCE]: { attempts: 0, successes: 0, applied: 0 } } };
}
export function createCivilizationEnlightenerLifeState(): CivilizationEnlightenerLifeState {
  return { sourceWeek: null, sourceRecord: null, sourceOriginals: [], practice: freshPractice(), cases: freshCases(), reflected: false, journal: [] };
}
export function findCivilizationEnlightenerOriginalCreation(s: SliceState, id: CivilizationEnlightenerObjectId): AlchemistCreation | null {
  return s.alchemist.life.creations.find(x => x.id === id) ?? null;
}
export function civilizationEnlightenerOriginalSnapshot(s: SliceState): CivilizationEnlightenerOriginalSnapshot[] {
  return CIVILIZATION_ENLIGHTENER_OBJECT_IDS.flatMap(id => { const x = findCivilizationEnlightenerOriginalCreation(s, id); return x ? [{ id, charge: x.charge, durability: x.durability, location: x.location, active: x.active }] : []; });
}
function sourceRecord(s: SliceState): CivilizationEnlightenerLifeSourceRecord | null {
  if (s.alchemist.life.workbenchId !== 'AL4-WORKBENCH-1' || s.alchemist.life.pieceRecords.length !== 2) return null;
  const box = findCivilizationEnlightenerOriginalCreation(s, 'AL4-BOX-1'), frame = findCivilizationEnlightenerOriginalCreation(s, 'AL4-FRAME-1');
  if (!box || !frame || box.madeBy !== s.runId || frame.madeBy !== s.runId || box.owner !== 'PLAYER' || frame.owner !== 'PLAYER') return null;
  const manufacture = (x: AlchemistCreation) => { const { location: _location, charge: _charge, durability: _durability, active: _active, ...fixed } = x; return sha256Hex(stableStringify(fixed)); };
  return { workbenchId: 'AL4-WORKBENCH-1', pieceRecords: [...s.alchemist.life.pieceRecords], frameManufactureDigest: manufacture(frame), boxManufactureDigest: manufacture(box) };
}
export function initializeCivilizationEnlightenerLife(s: SliceState): void {
  const l = s.civilizationEnlightener.life, source = sourceRecord(s), originals = civilizationEnlightenerOriginalSnapshot(s);
  if (!active(s) || !source || !same(l, createCivilizationEnlightenerLifeState()) || !same(originals, [
    { id: 'AL4-BOX-1', charge: 0, durability: 100, location: 'PLAYER', active: false }, { id: 'AL4-FRAME-1', charge: 0, durability: 90, location: 'PLAYER', active: false },
  ])) throw new Error('须保留亲手制造的同一原盒、耐久90的原架与原制造记录；本次没有免费补能或换件。');
  l.sourceWeek = s.week; l.sourceRecord = source; l.sourceOriginals = originals;
}
export function validateCivilizationEnlightenerActivityCommand(v: unknown): v is CivilizationEnlightenerActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && CIVILIZATION_ENLIGHTENER_CASE_IDS.includes(v.caseId as CivilizationEnlightenerCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && CIVILIZATION_ENLIGHTENER_CASE_IDS.includes(v.caseId as CivilizationEnlightenerCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'DECLINE_CONSENT' || v.type === 'REVOKE_CONSENT') return shape(v, ['type', 'permission']) && ['ABILITY', 'TEACHING'].includes(String(v.permission));
  if (v.type === 'MOVE') return shape(v, ['type', 'to']) && ['NEAR', 'FAR'].includes(String(v.to));
  return shape(v, ['type']) && ['BORROW_WRENCH', 'ENTER_WORKSHOP', 'PLACE_ORIGINALS', 'READ_RECORDS', 'INSPECT_FRAME', 'PROCESS_ANALYSIS', 'HAND_INSPECT', 'BUY_SHIM', 'REPAIR_FRAME', 'DEMONSTRATE_STOP', 'OPERATIONAL_GUIDANCE', 'ARM_MANUAL_LOAD', 'LEARNER_TRY', 'WAIT_GUIDANCE', 'MANUAL_STOP', 'RETURN_ORIGINALS', 'RETURN_WRENCH', 'RETURN_HOME', 'ABORT', 'REFLECT'].includes(String(v.type));
}
export const isCivilizationEnlightenerActivityCommand = validateCivilizationEnlightenerActivityCommand;
export const hasCivilizationEnlightenerLifeLock = (s: SliceState): boolean => !!s.civilizationEnlightener?.life && (s.civilizationEnlightener.life.practice.activeCase !== null || s.civilizationEnlightener.life.practice.participant.present || s.civilizationEnlightener.life.practice.wrench.holder === 'PLAYER' || s.civilizationEnlightener.life.practice.pendingGuidance !== null);
export const civilizationEnlightenerInside = hasCivilizationEnlightenerLifeLock;
interface ReplayModel { practice: CivilizationEnlightenerLifePractice; cases: Record<CivilizationEnlightenerCaseId, CivilizationEnlightenerLifeCase>; originals: CivilizationEnlightenerOriginalSnapshot[]; reflected: boolean }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: CivilizationEnlightenerActivityCommand) => c.type === 'PROCESS_ANALYSIS' || c.type === 'OPERATIONAL_GUIDANCE';
const isCheck = (c: CivilizationEnlightenerActivityCommand) => isPower(c) || c.type === 'LEARNER_TRY';
const audit = (s: SliceState, c: CivilizationEnlightenerActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor,
  randomBefore: isCheck(c) ? s.random.cursor : null, randomAfter: isCheck(c) ? s.random.cursor + 1 : null, checkBase: isCheck(c) ? c.type === 'LEARNER_TRY' ? 12 : s.character.coreStats.knowledge : null, check: null });
const validBudget = (v: unknown): v is CivilizationEnlightenerLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
function pendingValid(m: ReplayModel): boolean {
  const p = m.practice, r = m.cases['taught-stop'], g = p.pendingGuidance;
  return !!g && p.elapsedSeconds + 4 <= g.expiresAt && r.permission.ability === 'GRANTED' && r.permission.teaching === 'GRANTED' && r.permissionRevision === g.permissionRevision && r.learnerWantsStep;
}
function transition(input: ReplayModel, c: CivilizationEnlightenerActivityCommand, week: number, outcome: PublicResolutionTier | null, before: CivilizationEnlightenerLifeBudget, clock: Audit): { model: ReplayModel; receipt: CivilizationEnlightenerLifeReceipt } | null {
  if (!validateCivilizationEnlightenerActivityCommand(c) || !validBudget(before) || !integer(week) || (isCheck(c) ? !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(outcome)) : outcome !== null)) return null;
  const m = structuredClone(input), p = m.practice, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? m.cases[id] : null;
  const receipt: CivilizationEnlightenerLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0,
    ownerWalkedMetres: 0, veraWalkedMetres: 0, originalsCarriedMetres: 0, wrenchCarriedMetres: 0, originalsBefore: structuredClone(m.originals), originalsAfter: [], loadTransitions: [] };
  const pay = (ap: number, cash = 0, spirit = 0, mind = 0) => { receipt.after.actions -= ap; receipt.after.cash -= cash; receipt.after.spirituality -= spirit; receipt.after.mind -= mind; };
  const ownerMove = (to: CivilizationEnlightenerNode) => { if (p.ownerNode === to) return; p.ownerNode = to; receipt.ownerWalkedMetres += 2; receipt.elapsedSeconds += 2;
    receipt.originalsCarriedMetres += m.originals.filter(x => x.location === 'PLAYER').length * 2;
    if (p.wrench.holder === 'PLAYER') { p.wrench.node = to; receipt.wrenchCarriedMetres += 2; } };
  const veraMove = (to: CivilizationEnlightenerNode) => { if (p.participant.node === to) return; p.participant.node = to; receipt.veraWalkedMetres += 2; receipt.elapsedSeconds += 2; };
  const endGuidance = (reason: CivilizationEnlightenerLifeCase['guidanceEnd']) => { if (p.pendingGuidance) { m.cases['taught-stop'].guidanceEnd = reason; p.pendingGuidance = null; } };
  const ordinaryStop = () => { if (p.stopBar.loadRunning) { p.stopBar.loadRunning = false; p.handle.ordinaryStops++; receipt.loadTransitions.push('HAND_STOP'); receipt.elapsedSeconds++; } };
  const takeOriginals = () => { for (const x of m.originals) { if (x.location !== 'PLAYER') { x.location = 'PLAYER'; x.active = false; receipt.elapsedSeconds++; } } r!.originalsReturned = true; };
  const returnWrench = () => { if (p.wrench.holder === 'PLAYER') { p.wrench.holder = 'RACK'; p.wrench.node = 'NEAR'; p.wrench.returns++; receipt.elapsedSeconds++; } };
  const leave = () => { veraMove('NEAR'); p.participant.present = false; p.activeCase = null; r!.contactOpen = false; r!.returned = true; receipt.elapsedSeconds++; };
  const scene = p.activeCase !== null, physical = scene && !!r && r.status === 'ACTIVE' && r.invitedWeek === week && p.participant.present;
  if (scene && (!physical || 'caseId' in c && c.caseId !== p.activeCase)) return null;
  const entered = physical && r!.entered, bench = entered && p.ownerNode === 'FAR' && p.participant.node === 'FAR';
  const originalsReady = bench && r!.originalsPlaced && !r!.originalsReturned && m.originals.every(x => x.location === 'BENCH_END' && !x.active);
  switch (c.type) {
    case 'OBSERVE': {
      const index = CIVILIZATION_ENLIGHTENER_CASE_IDS.indexOf(c.caseId);
      if (scene || r!.status !== 'AVAILABLE' || index > 0 && m.cases[CIVILIZATION_ENLIGHTENER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'INVITE':
      if (scene || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitedWeek!) || p.ownerNode !== 'NEAR' || p.participant.present || p.wrench.holder !== 'RACK' || m.originals.some(x => x.location !== 'PLAYER' || x.active)) return null;
      pay(1, 20); r!.status = 'ACTIVE'; r!.invitedWeek = week; r!.invitationWeeks.push(week); r!.method = c.method; r!.entered = false; r!.returned = false; r!.contactOpen = true; r!.originalsPlaced = false; r!.originalsReturned = false;
      r!.permission = { ability: r!.permission.ability === 'WITHDRAWN' ? 'WITHDRAWN' : 'UNASKED', teaching: 'UNASKED' }; r!.permissionRevision++; r!.learnerWantsStep = false;
      // A prior abort really stopped the old load. Ordinary resumption may
      // physically apply one new load; the one cast and pupil draw remain spent.
      r!.loadArmed = false;
      p.activeCase = c.caseId; p.participant.present = true; p.invitation.push({ caseId: c.caseId, week, method: c.method }); receipt.elapsedSeconds = 5; break;
    case 'CONSENT':
    case 'DECLINE_CONSENT':
    case 'REVOKE_CONSENT': {
      const key = c.permission === 'ABILITY' ? 'ability' : 'teaching';
      if (!physical || (c.type === 'REVOKE_CONSENT' ? r!.permission[key] !== 'GRANTED' : r!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'ability' && r!.method !== 'ABILITY') return null;
      r!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; r!.permissionRevision++;
      if (key === 'teaching') r!.learnerWantsStep = c.type === 'CONSENT' && id === 'taught-stop';
      if (c.type !== 'CONSENT') endGuidance('WITHDRAWN'); receipt.elapsedSeconds = 1; break;
    }
    case 'BORROW_WRENCH':
      if (!physical || p.ownerNode !== 'NEAR' || p.wrench.holder !== 'RACK' || r!.entered) return null;
      p.wrench.holder = 'PLAYER'; p.wrench.node = 'NEAR'; p.wrench.loans++; receipt.elapsedSeconds = 1; break;
    case 'ENTER_WORKSHOP':
      if (!physical || r!.entered || p.ownerNode !== 'NEAR' || p.wrench.holder !== 'PLAYER' || r!.permission.teaching === 'UNASKED' || r!.permission.ability === 'UNASKED') return null;
      ownerMove('FAR'); veraMove('FAR'); r!.entered = true;
      if (id === 'withdrawn-operation') { r!.permission.ability = 'WITHDRAWN'; r!.permissionRevision++; endGuidance('WITHDRAWN'); }
      break;
    case 'MOVE':
      if (!entered || p.ownerNode === c.to) return null;
      ownerMove(c.to); break;
    case 'PLACE_ORIGINALS':
      if (!bench || r!.originalsPlaced || m.originals.some(x => x.location !== 'PLAYER' || x.active)) return null;
      for (const x of m.originals) x.location = 'BENCH_END'; r!.originalsPlaced = true; receipt.elapsedSeconds = 2; break;
    case 'READ_RECORDS':
      if (!originalsReady || id !== 'worn-bearing' || r!.recordsRead) return null;
      r!.recordsRead = true; receipt.elapsedSeconds = 12; break;
    case 'INSPECT_FRAME':
      if (!originalsReady || id !== 'worn-bearing' || !r!.recordsRead || r!.baselineInspected || m.originals[1]!.durability !== 90) return null;
      r!.baselineInspected = true; receipt.elapsedSeconds = 4; break;
    case 'PROCESS_ANALYSIS':
      if (!originalsReady || id !== 'worn-bearing' || !r!.baselineInspected || r!.defectKnown || r!.repairDone || r!.abilityAttempted || r!.method !== 'ABILITY' || r!.permission.ability !== 'GRANTED' || m.originals[1]!.durability !== 90) return null;
      pay(0, 0, 6, 2); receipt.elapsedSeconds = 2; r!.abilityAttempted = true; r!.outcome = outcome; p.abilityUses[ANALYSIS].attempts++;
      if (successful(outcome)) { r!.defectKnown = true; p.abilityUses[ANALYSIS].successes++; } break;
    case 'HAND_INSPECT':
      if (!originalsReady || id !== 'worn-bearing' || !r!.baselineInspected || r!.handsInspected || r!.repairDone || p.wrench.holder !== 'PLAYER' || p.wrench.node !== 'FAR') return null;
      r!.handsInspected = true; r!.defectKnown = true; receipt.elapsedSeconds = 10; break;
    case 'BUY_SHIM':
      if (!originalsReady || id !== 'worn-bearing' || !r!.handsInspected || p.shim.status !== 'SUPPLIER' || r!.repairDone) return null;
      pay(0, 40); p.shim.status = 'PLAYER'; p.shim.purchasedWeek = week; receipt.elapsedSeconds = 2; break;
    case 'REPAIR_FRAME':
      if (!originalsReady || id !== 'worn-bearing' || !r!.handsInspected || !r!.defectKnown || r!.repairDone || p.shim.status !== 'PLAYER' || p.wrench.holder !== 'PLAYER' || p.wrench.node !== 'FAR' || m.originals[1]!.durability !== 90) return null;
      // Only this explicit hands-on action consumes the purchased finite shim.
      m.originals[1]!.durability = Math.min(100, m.originals[1]!.durability + 5); p.shim.status = 'CONSUMED'; p.shim.consumedWeek = week; r!.repairDone = true; receipt.elapsedSeconds = 20;
      r!.abilityApplied = successful(r!.outcome); r!.result = r!.abilityApplied ? 'ABILITY' : 'ORDINARY'; if (r!.abilityApplied) p.abilityUses[ANALYSIS].applied++; break;
    case 'DEMONSTRATE_STOP':
      if (!originalsReady || id === 'worn-bearing' || r!.demonstrated || p.stopBar.loadRunning) return null;
      receipt.loadTransitions.push('HAND_START', 'HAND_STOP'); p.handle.demonstrations++; p.handle.ordinaryStops++; r!.demonstrated = true; receipt.elapsedSeconds = 4; break;
    case 'OPERATIONAL_GUIDANCE':
      if (!originalsReady || id !== 'taught-stop' || !r!.demonstrated || !r!.learnerWantsStep || r!.permission.teaching !== 'GRANTED' || r!.permission.ability !== 'GRANTED' || r!.method !== 'ABILITY' || r!.abilityAttempted || r!.learnerAttempted || r!.result !== 'NONE' || p.stopBar.loadRunning) return null;
      pay(0, 0, 8, 3); receipt.elapsedSeconds = 2; r!.abilityAttempted = true; r!.outcome = outcome; p.abilityUses[GUIDANCE].attempts++;
      if (successful(outcome)) { p.abilityUses[GUIDANCE].successes++; r!.guidanceEnd = 'PENDING'; p.pendingGuidance = { caseId: 'taught-stop', createdAt: p.elapsedSeconds + 2, expiresAt: p.elapsedSeconds + 32, permissionRevision: r!.permissionRevision, bonus: 10 }; }
      else r!.guidanceEnd = 'FAILED'; break;
    case 'ARM_MANUAL_LOAD':
      if (!originalsReady || id === 'worn-bearing' || !r!.demonstrated || r!.loadArmed || r!.result !== 'NONE' || p.stopBar.loadRunning) return null;
      p.stopBar.loadRunning = true; r!.loadArmed = true; receipt.loadTransitions.push('HAND_START'); receipt.elapsedSeconds = 2; break;
    case 'LEARNER_TRY': {
      if (!originalsReady || id !== 'taught-stop' || !r!.demonstrated || !r!.loadArmed || !p.stopBar.loadRunning || !r!.learnerWantsStep || r!.permission.teaching !== 'GRANTED' || r!.learnerAttempted || r!.result !== 'NONE') return null;
      const guided = pendingValid(m); r!.learnerAttempted = true; r!.learnerOutcome = outcome; receipt.elapsedSeconds = 4;
      if (successful(outcome)) {
        p.stopBar.loadRunning = false; p.handle.learnerStops++; receipt.loadTransitions.push('LEARNER_STOP'); r!.ordinaryStepLearned = true; r!.abilityApplied = guided; r!.result = guided ? 'ABILITY' : 'ORDINARY';
        if (guided) { p.abilityUses[GUIDANCE].applied++; endGuidance('APPLIED'); } else endGuidance('EXPIRED');
      } else endGuidance(guided ? 'LEARNER_FAILED' : 'EXPIRED');
      break;
    }
    case 'WAIT_GUIDANCE':
      if (!entered || !p.pendingGuidance) return null;
      receipt.elapsedSeconds = Math.max(0, p.pendingGuidance.expiresAt - p.elapsedSeconds); endGuidance('EXPIRED'); break;
    case 'MANUAL_STOP':
      if (!originalsReady || id === 'worn-bearing' || !r!.loadArmed || !p.stopBar.loadRunning || r!.result !== 'NONE') return null;
      ordinaryStop(); endGuidance('CANCELLED'); r!.result = 'ORDINARY'; break;
    case 'RETURN_ORIGINALS':
      if (!bench || !r!.originalsPlaced || r!.originalsReturned || p.stopBar.loadRunning || r!.result === 'NONE' || m.originals.some(x => x.location !== 'BENCH_END' || x.active)) return null;
      takeOriginals(); break;
    case 'RETURN_WRENCH':
      if (!entered || p.ownerNode !== 'NEAR' || p.wrench.holder !== 'PLAYER' || !r!.originalsReturned || p.stopBar.loadRunning) return null;
      returnWrench(); break;
    case 'RETURN_HOME':
      if (!entered || r!.result === 'NONE' || !r!.originalsReturned || p.pendingGuidance || p.stopBar.loadRunning || p.wrench.holder !== 'RACK' || p.ownerNode !== 'NEAR' || m.originals.some(x => x.location !== 'PLAYER' || x.active)) return null;
      leave(); r!.status = 'EXAMINED'; break;
    case 'ABORT':
      if (!physical) return null;
      endGuidance('CANCELLED');
      // Actual safe returns: reach the original bench before touching a load or
      // retrieving originals. Costs, prior failures and consumed material persist.
      if (p.stopBar.loadRunning || m.originals.some(x => x.location !== 'PLAYER')) { ownerMove('FAR'); ordinaryStop(); takeOriginals(); }
      else r!.originalsReturned = true;
      ownerMove('NEAR'); returnWrench(); leave(); r!.status = r!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; break;
    case 'REPORT':
      if (scene || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || p.participant.present || p.wrench.holder !== 'RACK' || p.stopBar.loadRunning || m.originals.some(x => x.location !== 'PLAYER' || x.active)) return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; break;
    case 'REFLECT':
      if (scene || m.reflected || !CIVILIZATION_ENLIGHTENER_CASE_IDS.every(caseId => m.cases[caseId].status === 'RESOLVED') || p.participant.present) return null;
      pay(1); m.reflected = true; receipt.elapsedSeconds = 5; break;
  }
  if (!validBudget(receipt.after)) return null;
  p.elapsedSeconds += receipt.elapsedSeconds; p.ownerWalkedMetres += receipt.ownerWalkedMetres; p.participant.walkedMetres += receipt.veraWalkedMetres;
  if (p.pendingGuidance && p.elapsedSeconds >= p.pendingGuidance.expiresAt) endGuidance('EXPIRED');
  receipt.originalsAfter = structuredClone(m.originals); return { model: m, receipt };
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate): boolean => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(l: CivilizationEnlightenerLifeState, s: SliceState): ReplayModel | null {
  if (!l.sourceRecord || l.sourceWeek === null || !Array.isArray(l.journal)) return null;
  let model: ReplayModel = { practice: freshPractice(), cases: freshCases(), originals: structuredClone(l.sourceOriginals), reflected: false };
  let lastRandomAfter = 0, lastWeek = l.sourceWeek; let previous: CivilizationEnlightenerLifeReceipt | null = null;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'command', 'outcome', 'before', 'after', 'elapsedSeconds', 'ownerWalkedMetres', 'veraWalkedMetres', 'originalsCarriedMetres', 'wrenchCarriedMetres', 'originalsBefore', 'originalsAfter', 'loadTransitions']) || !validateCivilizationEnlightenerActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : 0, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (model.practice.activeCase !== null && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      const learner = entry.command.type === 'LEARNER_TRY';
      if (entry.checkBase !== (learner ? 12 : s.character.coreStats.knowledge) || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: entry.checkBase, difficulty: entry.command.type === 'PROCESS_ANALYSIS' ? 18 : 20,
        modifiers: learner && pendingValid(model) ? [{ source: '同一次普通停载的有限操作启示', value: 10 }] : [], roll: random.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry);
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function civilizationEnlightenerLifeOriginalEvents(s: SliceState): CivilizationEnlightenerOriginalEvent[] {
  return s.civilizationEnlightener.life.journal.map(r => ({ revision: r.revision, week: r.week, source: `civilization-enlightener-life:${r.command.type}`, before: structuredClone(r.originalsBefore), after: structuredClone(r.originalsAfter) }));
}
export function civilizationEnlightenerLifeOriginalTail(s: SliceState): CivilizationEnlightenerOriginalSnapshot[] | null {
  const l = s.civilizationEnlightener.life; return l.sourceWeek === null ? null : structuredClone(l.journal.at(-1)?.originalsAfter ?? l.sourceOriginals);
}
function oldSceneOpen(s: SliceState): boolean {
  return hasAlchemistLifeLock(s) || hasArcaneScholarLifeLock(s) || hasKnowledgeMentorLifeLock(s) || s.knowledgeMentor.preparedWeek !== null || s.arcaneScholar.preparedWeek !== null ||
    ['READY', 'FIGHTING'].includes(s.alchemist.encounter.status) || ['READY', 'FIGHTING'].includes(s.arcaneScholar.encounter.status) || ['READY', 'FIGHTING'].includes(s.knowledgeMentor.encounter.status);
}
export function validateCivilizationEnlightenerLife(s: SliceState): boolean {
  try {
    const l = s.civilizationEnlightener?.life;
    if (!record(l) || !shape(l, ['sourceWeek', 'sourceRecord', 'sourceOriginals', 'practice', 'cases', 'reflected', 'journal']) || !Array.isArray(l.journal) || !record(l.practice) || !record(l.cases) || !shape(l.cases, CIVILIZATION_ENLIGHTENER_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.civilizationEnlightener.promotionWeek === null) return same(l, createCivilizationEnlightenerLifeState());
    if (!integer(l.sourceWeek, 0, s.week) || l.sourceWeek !== s.civilizationEnlightener.promotionWeek || !l.sourceRecord || !same(l.sourceRecord, sourceRecord(s)) || !same(l.sourceOriginals, [
      { id: 'AL4-BOX-1', charge: 0, durability: 100, location: 'PLAYER', active: false }, { id: 'AL4-FRAME-1', charge: 0, durability: 90, location: 'PLAYER', active: false },
    ])) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l.practice, replay.practice) || !same(l.cases, replay.cases) || l.reflected !== replay.reflected) return false;
    let acting = l.reflected ? 25 : 0;
    for (const id of CIVILIZATION_ENLIGHTENER_CASE_IDS) {
      const r = l.cases[id], resolved = r.status === 'RESOLVED';
      if (s.seer.completedSources.filter(source => source === `civilization-enlightener-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
      if (resolved && r.abilityApplied && r.result === 'ABILITY' && id !== 'withdrawn-operation' && (s.progression.mastery[id === 'worn-bearing' ? ANALYSIS : GUIDANCE] ?? 0) < 8) return false;
    }
    if (s.seer.completedSources.filter(source => source === 'civilization-enlightener-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting) return false;
    const last = l.journal.at(-1), locked = hasCivilizationEnlightenerLifeLock(s);
    if (locked && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.civilizationEnlightener.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.civilizationEnlightener.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.after.actions > 0 && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    // Encounter entry requires all three completed cases and reflection. After
    // entry its own receipts continue the same live resource chain.
    if ((!s.civilizationEnlightener.encounter.preparation || !l.reflected || locked || last?.revision === s.revision - 1) && !same(civilizationEnlightenerOriginalSnapshot(s), replay.originals)) return false;
    return true;
  } catch { return false; }
}
export function blockCivilizationEnlightenerActivity(s: SliceState, c: CivilizationEnlightenerActivityCommand): string | null {
  if (!validateCivilizationEnlightenerActivityCommand(c)) return '工坊实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已经实际成为文明启蒙者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回到贝克兰德原工坊。';
  if (oldSceneOpen(s) || s.civilizationEnlightener.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.civilizationEnlightener.encounter.status)) return '先收束仍开放的原现场、晋升准备或遭遇。';
  if (!validateCivilizationEnlightenerLife(s)) return '原人、原物、实际成本或历史记录不一致。';
  if (!transition(replayLife(s.civilizationEnlightener.life, s)!, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成真实前一步，确认这一次许可、原物位置和有限材料；已付成本、失败与修理不能重置。';
  return null;
}
const NOTES: Record<CivilizationEnlightenerActivityCommand['type'], [string, string]> = {
  OBSERVE: ['查看原工坊与两米普通通道', '原盒、原架、原制造记录和退出路径已经亲眼核对。'],
  INVITE: ['重新邀请维拉参加这一案', '实付1行动20便士。维拉在近处入口到场；本案学习与超凡许可必须分别重新询问，旧案许可没有沿用。'],
  CONSENT: ['维拉确认这一项当前许可', '只覆盖本次说明过的普通步骤或有限能力；维拉仍可拒绝或撤回。'],
  DECLINE_CONSENT: ['维拉拒绝这一项请求', '拒绝已经生效。她不会被要求尝试或接受超凡作用；本人仍可普通检查、示范、停载和还物。'],
  REVOKE_CONSENT: ['维拉撤回这一项当前许可', '未发生的能力帮助立即结束，已付成本与既有事实保留；普通安全停载、还物和步行离场仍可继续。'],
  BORROW_WRENCH: ['在入口借到同一把普通扳手', '沃德实际交付CE1-WRENCH-1，持有人变为本人；离场前须在近处入口亲手归还。'],
  ENTER_WORKSHOP: ['两人实际走到原台远端', '本人携两件原造物与借来扳手步行2米，维拉也沿原路步行2米。原包裹始终由她自己保管。'],
  PLACE_ORIGINALS: ['亲手放下两件原造物', '同一原盒原架实际放到原台远端，均保持停止。没有克隆、更换或补充储能。'],
  READ_RECORDS: ['实读两件原造物的制造记录', '花12秒核对本人制作的原盒与原架记录、材料和部件。'],
  INSPECT_FRAME: ['核对原架实际耐久90', '花4秒观察同一停止的原架；储能仍为0，磨损没有因查看而消失。'],
  PROCESS_ANALYSIS: ['尝试一次工艺析解', '实付6灵性、2精神和2秒，知识18；仅识别这处既存轴承磨损，不会修复物体或创造材料。'],
  HAND_INSPECT: ['用借来的扳手亲查磨损轴承', '花10秒在原台上亲手核对这一处轴承磨损。普通检查可在能力失败后取得同一个有限结论。'],
  BUY_SHIM: ['实际购买唯一黄铜垫片', '实付40便士，取得CE1-SHIM-1。它是有限实物，购买与修理不能生成第二片。'],
  REPAIR_FRAME: ['亲手安装垫片并修整原轴承', '花20秒真实工作，消耗同一垫片；同一原架耐久90变为95，储能不变。分析本身没有执行这项修理。'],
  DEMONSTRATE_STOP: ['本人亲手示范原停载手柄', '花4秒手动加上低载荷并拉AR3-LOAD-HANDLE停止。两件原造物保持停止，不消耗或增加储能。'],
  OPERATIONAL_GUIDANCE: ['尝试一次操作启示', '实付8灵性、3精神和2秒，知识20。成功只为愿意学习的维拉保留30秒内一次普通停载尝试加值10，此刻她尚未完成操作。'],
  ARM_MANUAL_LOAD: ['用手重新施加这一次低载荷', '花2秒设置实际普通练习负载。原挡条仍在架上，原造物没有被充能或自动启动。'],
  LEARNER_TRY: ['维拉亲自尝试原手柄停载', '维拉花4秒进行独立的普通操作检定：普通知识12，难度20。只在当前有限帮助有效时加值10；本案没有第二次抽取。'],
  WAIT_GUIDANCE: ['等到这次有限帮助到期', '实际等待剩余秒数。尚未使用的加值已经失效，不能退款、重施或追认成功。'],
  MANUAL_STOP: ['本人用原手柄普通停载', '本人亲手停止当前低载荷。普通完成保留原施术与学习失败，不产生能力掌握。'],
  RETURN_ORIGINALS: ['亲手收回两件停止的原造物', '本人就在原台远端，实际收回同一原盒与原架；耐久和储能保持真实结果。'],
  MOVE: ['沿两米原路实际步行', '本人走2米，实耗2秒；持有的原造物和借来扳手随身体移动。'],
  RETURN_WRENCH: ['在近处入口亲还借来的扳手', 'CE1-WRENCH-1真实回到沃德的原架，借用和归还次数逐一对应。'],
  RETURN_HOME: ['维拉沿原路离开，本人结束现场', '本人已实际走回近处入口；维拉也亲自沿两米原路走回并离开。原物都已收回，负载停止，扳手已归还。'],
  ABORT: ['安全停载、实还原物并中止本次现场', '必要时本人先走到原台停载和取回两件原物，再携物沿原路走回入口归还扳手；维拉也实际走回离场。已付成本、失败和耗材状态全部保留。'],
  REPORT: ['报告真正收束的一案', '实付1行动，扮演增加25。只有相关能力实际成功应用，才增加对应掌握8；施术成功本身不够。'],
  REFLECT: ['反思理解、亲手劳动与可撤回的学习', '三案都已真正完成，实付1行动，扮演增加25。理解结构不等于制造材料，给出帮助也不能替别人作出选择。'],
};
export function applyCivilizationEnlightenerActivity(s: SliceState, c: CivilizationEnlightenerActivityCommand, ctx: SeerContext): void {
  const reason = blockCivilizationEnlightenerActivity(s, c); if (reason) throw new Error(reason);
  const l = s.civilizationEnlightener.life, model = replayLife(l, s)!, id = 'caseId' in c ? c.caseId : l.practice.activeCase, clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isPower(c)) check = ctx.check('knowledge', c.type === 'PROCESS_ANALYSIS' ? 18 : 20);
  else if (c.type === 'LEARNER_TRY') { check = resolveNormalCheck({ ability: 'knowledge', baseAbility: 12, difficulty: 20, modifiers: pendingValid(model) ? [{ source: '同一次普通停载的有限操作启示', value: 10 }] : [], roll: ctx.roll(1, 100) }); s.lastCheck = check; }
  clock.check = check; if (isCheck(c)) clock.randomAfter = s.random.cursor;
  const next = transition(model, c, s.week, check?.tier ?? null, budget(s), clock)!;
  s.health = next.receipt.after.health; s.mind = next.receipt.after.mind; s.spirituality = next.receipt.after.spirituality; s.cash = next.receipt.after.cash; s.actionsRemaining = next.receipt.after.actions;
  l.practice = next.model.practice; l.cases = next.model.cases; l.reflected = next.model.reflected; l.journal.push(next.receipt);
  for (const resource of next.model.originals) { const x = findCivilizationEnlightenerOriginalCreation(s, resource.id)!; x.charge = resource.charge; x.durability = resource.durability; x.location = resource.location; x.active = resource.active; }
  if (c.type === 'REPORT') {
    const r = l.cases[c.caseId]; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`civilization-enlightener-case:${c.caseId}`);
    if (r.abilityApplied && r.result === 'ABILITY' && c.caseId !== 'withdrawn-operation') { const ability = c.caseId === 'worn-bearing' ? ANALYSIS : GUIDANCE; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('civilization-enlightener-reflection'); }
  const note = NOTES[c.type]; let detail = note[1];
  if (c.type === 'OBSERVE') { const entry = CASES.find(item => item.id === c.caseId)!; detail = entry.story + entry.facts.join(' '); }
  if (c.type === 'ENTER_WORKSHOP' && id === 'withdrawn-operation') detail += '维拉到台边后明确撤回超凡许可；这一次仅按普通方式完成。';
  if (isPower(c)) detail += successful(check?.tier ?? null) ? c.type === 'PROCESS_ANALYSIS' ? '本次确实识别了原轴承磨损，仍须亲手检查、采购和修理。' : '本次施术成功，仍须维拉另行真实尝试，尚无掌握奖励。' : '本次施术失败，代价已经支付；不能重抽，仍可普通完成。';
  if (c.type === 'LEARNER_TRY') detail += successful(check?.tier ?? null) ? '维拉实际拉下原手柄，负载已经停止；只记录这一项普通操作。' : '这次学习尝试失败，负载仍须由本人普通停止；失败和已付代价保留。';
  ctx.note(note[0], detail);
}
export function civilizationEnlightenerLifeActions(s: SliceState): CivilizationEnlightenerAction[] {
  if (!active(s)) return [];
  const out: CivilizationEnlightenerAction[] = [], l = s.civilizationEnlightener.life, p = l.practice;
  const add = (command: CivilizationEnlightenerActivityCommand, label: string, cost: string, cleanup = false, preferredAction = false) => {
    const reason = blockCivilizationEnlightenerActivity(s, command);
    out.push({ id: `civilization-enlightener-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason, cleanup, preferredAction });
  };
  if (p.activeCase) {
    const id = p.activeCase, r = l.cases[id];
    if (!r.entered) {
      if (r.permission.teaching === 'UNASKED') { add({ type: 'CONSENT', permission: 'TEACHING' }, id === 'taught-stop' ? '询问维拉是否想学这一项普通操作' : '询问维拉是否愿意观看本次普通实践', '0行动 · 本次单独许可', false, true); add({ type: 'DECLINE_CONSENT', permission: 'TEACHING' }, '维拉拒绝这次学习或观看邀请', '0行动 · 本人仍可普通完成', true); }
      else if (r.permission.ability === 'UNASKED') {
        if (r.method === 'ABILITY') add({ type: 'CONSENT', permission: 'ABILITY' }, '说明并询问本次有限超凡许可', '0行动 · 可随时撤回', false, true);
        add({ type: 'DECLINE_CONSENT', permission: 'ABILITY' }, '维拉选择不用超凡能力', '0行动', true, r.method === 'ORDINARY');
      } else if (p.wrench.holder === 'RACK') add({ type: 'BORROW_WRENCH' }, '从沃德手中借来唯一普通扳手', '0行动 · 须实物归还', false, true);
      else add({ type: 'ENTER_WORKSHOP' }, '两人携原物沿两米路走到台边', '0行动 · 两人各走2米', false, true);
    } else if (r.result !== 'NONE') {
      if (!r.originalsReturned) { if (p.ownerNode !== 'FAR') add({ type: 'MOVE', to: 'FAR' }, '走到原台远端取回原物', '0行动 · 2米', true, true); else add({ type: 'RETURN_ORIGINALS' }, '亲手收回同一原盒与原架', '0行动 · 原资源保持', true, true); }
      else if (p.ownerNode === 'FAR') add({ type: 'MOVE', to: 'NEAR' }, '携原物走2米回入口', '0行动 · 2秒', true, true);
      else if (p.wrench.holder === 'PLAYER') add({ type: 'RETURN_WRENCH' }, '把借来的原扳手亲还沃德', '0行动 · 1秒', true, true);
      else add({ type: 'RETURN_HOME' }, '维拉实际走回离开，结束现场', '0行动 · 实际还物离场', true, true);
    } else if (p.ownerNode !== 'FAR') add({ type: 'MOVE', to: 'FAR' }, '沿两米原路走回工作台', '0行动 · 2秒', true, true);
    else if (!r.originalsPlaced) add({ type: 'PLACE_ORIGINALS' }, '把原盒与原架实际放在原台', '0行动 · 保持停止', false, true);
    else if (id === 'worn-bearing') {
      if (!r.recordsRead) add({ type: 'READ_RECORDS' }, '核对本人两件原造物制造记录', '0行动 · 12秒', false, true);
      else if (!r.baselineInspected) add({ type: 'INSPECT_FRAME' }, '观察原护架实际耐久90', '0行动 · 4秒', false, true);
      else if (!r.handsInspected) {
        if (r.method === 'ABILITY' && r.permission.ability === 'GRANTED' && !r.abilityAttempted) add({ type: 'PROCESS_ANALYSIS' }, '对这处原磨损尝试一次工艺析解', '0行动 · 6灵性＋2精神 · 知识18', false, true);
        add({ type: 'HAND_INSPECT' }, '用原扳手亲查这一处磨损轴承', '0行动 · 10秒', false, out.every(a => !a.enabled));
      } else if (p.shim.status === 'SUPPLIER') add({ type: 'BUY_SHIM' }, '购买唯一修理黄铜垫片', '0行动 · 40便士', false, true);
      else add({ type: 'REPAIR_FRAME' }, '亲手安装原垫片，修理原护架', '0行动 · 20秒 · 耐久＋5，无储能', false, true);
    } else if (!r.demonstrated) add({ type: 'DEMONSTRATE_STOP' }, '本人亲手示范原手柄普通停载', '0行动 · 4秒', false, true);
    else if (!r.loadArmed) {
      if (id === 'taught-stop' && r.method === 'ABILITY' && r.permission.ability === 'GRANTED' && r.permission.teaching === 'GRANTED' && !r.abilityAttempted) add({ type: 'OPERATIONAL_GUIDANCE' }, '对一次普通停载尝试操作启示', '0行动 · 8灵性＋3精神 · 知识20', false, true);
      add({ type: 'ARM_MANUAL_LOAD' }, '亲手施加这一次普通练习负载', '0行动 · 2秒', false, out.every(a => !a.enabled));
    } else {
      if (id === 'taught-stop' && r.permission.teaching === 'GRANTED' && r.learnerWantsStep && !r.learnerAttempted) add({ type: 'LEARNER_TRY' }, '让维拉进行她自己的这一次实际尝试', '0行动 · 普通知识12，难度20 · 一次', false, true);
      add({ type: 'MANUAL_STOP' }, '本人拉原手柄，普通停止负载', '0行动 · 1秒', true, out.every(a => !a.enabled));
    }
    if (p.pendingGuidance) add({ type: 'WAIT_GUIDANCE' }, '等待这次有限帮助到期', `0行动 · ${Math.max(0, p.pendingGuidance.expiresAt - p.elapsedSeconds)}秒`, true);
    if (r.permission.ability === 'GRANTED') add({ type: 'REVOKE_CONSENT', permission: 'ABILITY' }, '维拉撤回本案超凡许可', '0行动 · 已付代价保留', true);
    if (r.permission.teaching === 'GRANTED') add({ type: 'REVOKE_CONSENT', permission: 'TEACHING' }, '维拉撤回参与这次学习的许可', '0行动 · 普通安全停载仍可进行', true);
    add({ type: 'ABORT' }, '实际停载还物、走回入口并中止', '0行动 · 失败和耗材保持', true); return out;
  }
  const next = CASES.find(item => l.cases[item.id].status !== 'RESOLVED');
  if (next) {
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, `观察：${next.title}`, '1行动', false, true);
    if (r.status === 'OBSERVED' || r.status === 'PAUSED') {
      if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, '重新邀请维拉，说明有限能力与普通退路', '1行动 · 20便士', false, true);
      add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED' ? '跨周付费重新邀请，只作普通续办' : '重新邀请维拉，只作普通实践', '1行动 · 20便士', false, r.status === 'PAUSED');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, '报告原物已还、两人已离场的真实结果', '1行动 · 扮演25 · 实际能力应用才掌握8', false, true);
  } else if (!l.reflected) add({ type: 'REFLECT' }, '反思结构、劳动、普通学习与撤回许可', '1行动 · 扮演25', false, true);
  return out;
}
const publicLifeBudget = (b: CivilizationEnlightenerLifeBudget): CivilizationEnlightenerLifeBudget => ({ health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions });
const publicOriginalSnapshot = (x: CivilizationEnlightenerOriginalSnapshot): CivilizationEnlightenerOriginalSnapshot => ({ id: x.id, charge: x.charge, durability: x.durability, location: x.location, active: x.active });
/** Material provenance remains public; only its known historical authoring prefix is display-only. */
export function projectCivilizationEnlightenerOriginalCreation(x: AlchemistCreation): AlchemistCreation {
  return { id: x.id, kind: x.kind, source: x.source.startsWith('原创G：') ? x.source.slice('原创G：'.length) : x.source,
    componentIds: [...x.componentIds], madeBy: x.madeBy, owner: x.owner, custodian: x.custodian, location: x.location,
    durability: x.durability, charge: x.charge, active: x.active, manufacturedWeek: x.manufacturedWeek };
}
function publicLifeCommand(c: CivilizationEnlightenerActivityCommand): CivilizationEnlightenerActivityCommand {
  switch (c.type) {
    case 'OBSERVE': case 'REPORT': return { type: c.type, caseId: c.caseId };
    case 'INVITE': return { type: c.type, caseId: c.caseId, method: c.method };
    case 'MOVE': return { type: c.type, to: c.to };
    case 'CONSENT': case 'DECLINE_CONSENT': case 'REVOKE_CONSENT': return { type: c.type, permission: c.permission };
    default: return { type: c.type };
  }
}
/** Resolved facts are public; the private journal keeps the unchanged replay inputs. */
export function projectCivilizationEnlightenerLifeReceipt(entry: CivilizationEnlightenerLifeReceipt): CivilizationEnlightenerPublicLifeReceipt {
  const check = entry.check;
  return {
    week: entry.week, date: { epoch: entry.date.epoch, year: entry.date.year, month: entry.date.month, day: entry.date.day }, revision: entry.revision,
    checkBase: entry.checkBase, check: check ? {
      ability: check.ability, baseAbility: check.baseAbility, modifiers: check.modifiers.map(modifier => ({ source: modifier.source, value: modifier.value })),
      effectiveAbility: check.effectiveAbility, difficulty: check.difficulty, chance: check.chance, roll: check.roll, tier: check.tier,
    } : null,
    command: publicLifeCommand(entry.command), outcome: entry.outcome,
    before: publicLifeBudget(entry.before), after: publicLifeBudget(entry.after), elapsedSeconds: entry.elapsedSeconds,
    ownerWalkedMetres: entry.ownerWalkedMetres, veraWalkedMetres: entry.veraWalkedMetres,
    originalsCarriedMetres: entry.originalsCarriedMetres, wrenchCarriedMetres: entry.wrenchCarriedMetres,
    originalsBefore: entry.originalsBefore.map(publicOriginalSnapshot), originalsAfter: entry.originalsAfter.map(publicOriginalSnapshot),
    loadTransitions: [...entry.loadTransitions],
  };
}
function projectAttempts(l: CivilizationEnlightenerLifeState, id: CivilizationEnlightenerCaseId): CivilizationEnlightenerLifeProjection['cases'][number]['attempts'] {
  let model: ReplayModel = { practice: freshPractice(), cases: freshCases(), originals: structuredClone(l.sourceOriginals), reflected: false };
  const result: CivilizationEnlightenerLifeProjection['cases'][number]['attempts'] = []; let current: typeof result[number] | null = null;
  for (const entry of l.journal) {
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry); if (!next) break; model = next.model;
    if (entry.command.type === 'INVITE' && entry.command.caseId === id) { current = { invitedWeek: entry.week, method: entry.command.method, outcome: null, learnerOutcome: null, evidence: { abilityAttempted: false, abilityApplied: false, returned: false, result: 'NONE', ordinaryStepLearned: false }, receipts: [] }; result.push(current); }
    if (current) { current.receipts.push(projectCivilizationEnlightenerLifeReceipt(entry)); const r = model.cases[id]; current.outcome = r.outcome; current.learnerOutcome = r.learnerOutcome; current.evidence = { abilityAttempted: r.abilityAttempted, abilityApplied: r.abilityApplied, returned: r.returned, result: r.result, ordinaryStepLearned: r.ordinaryStepLearned }; if (entry.command.type === 'RETURN_HOME' || entry.command.type === 'ABORT') current = null; }
  }
  return result;
}
export function projectCivilizationEnlightenerLife(s: SliceState): CivilizationEnlightenerLifeProjection {
  const l = s.civilizationEnlightener.life, actions = civilizationEnlightenerLifeActions(s), r = l.practice.activeCase ? l.cases[l.practice.activeCase] : null;
  return { title: '同一工作台上的理解、修理与普通学习', source: '原造物、原制造记录和真实材料都继续存在；维拉逐次决定是否接受帮助，亲手完成的普通动作才是实际结果。', environment: CIVILIZATION_ENLIGHTENER_LIFE_ENVIRONMENT,
    insideCase: hasCivilizationEnlightenerLifeLock(s), reflected: l.reflected, preferredActionId: actions.find(a => a.enabled && a.preferredAction)?.id ?? actions.find(a => a.enabled)?.id ?? null,
    practice: structuredClone(l.practice), creations: s.alchemist.life.creations.map(projectCivilizationEnlightenerOriginalCreation), currentConsents: [{ id: 'KM2-VERA', consented: r?.permission.ability === 'GRANTED', teachingConsented: r?.permission.teaching === 'GRANTED' }],
    cases: CASES.map(item => { const c = l.cases[item.id]; return { id: item.id, title: item.title, story: item.story, observations: c.status === 'AVAILABLE' ? [] : [...item.facts], status: c.status, permission: structuredClone(c.permission), contactOpen: c.contactOpen,
      preparation: c.status === 'OBSERVED' ? '等候本次重新邀请及逐项许可。' : c.status === 'PAUSED' ? '实际成本和失败保留；下一真实周可付费普通续办，最多两次。' : null,
      result: c.result !== 'NONE' ? `${c.result === 'ABILITY' ? '对应能力确实帮助完成了这一个实际步骤。' : '本人或维拉已按普通方法完成。'}${c.returned ? '原物已还，维拉已实际离场。' : '仍须停载还物，并沿原路走返。'}` : c.guidanceEnd === 'PENDING' ? '帮助窗口仍待真实的普通尝试，尚未完成或增加掌握。' : c.abilityAttempted ? '施术成本与结果已记录，剩余步骤可普通完成。' : null,
      returned: c.returned, attempts: projectAttempts(l, item.id) }; }), ledger: l.journal.map(projectCivilizationEnlightenerLifeReceipt) };
}
