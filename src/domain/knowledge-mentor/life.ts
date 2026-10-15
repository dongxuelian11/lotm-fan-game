import type { PublicCheckResult } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { findArcaneScholarOriginalCreation, hasArcaneScholarLifeLock } from '../arcane-scholar/life.js';
import { hasAlchemistLifeLock } from '../alchemist/life.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

export const KNOWLEDGE_MENTOR_CASE_IDS = ['documented-cycle', 'consented-transfer', 'blocked-cycle'] as const;
export const KNOWLEDGE_MENTOR_OBJECT_IDS = ['AL4-BOX-1', 'AL4-FRAME-1'] as const;
export type KnowledgeMentorCaseId = typeof KNOWLEDGE_MENTOR_CASE_IDS[number];
export type KnowledgeMentorObjectId = typeof KNOWLEDGE_MENTOR_OBJECT_IDS[number];
export type KnowledgeMentorNode = 'BENCH_START' | 'BENCH_END';
export type KnowledgeMentorPermission = 'PROGRAM' | 'PARCEL';
export type KnowledgeMentorConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
type CaseStepType = 'PERFORM' | 'READ_RECORDS' | 'MEASURE_BASELINE' | 'BUY_PLATE' | 'BIND_PLATE' | 'INSTALL_PLATE' | 'START_PROGRAM' | 'PROGRAM_STEP' | 'MANUAL_STEP' | 'STOP_PROGRAM' | 'WAIT_PROGRAM' | 'TAKE_PARCEL' | 'LOAD_PARCEL' | 'COLLECT_PARCEL' | 'RETURN_PARCEL' | 'PLACE_STOP_BAR' | 'CALIBRATE' | 'MANUAL_STOP' | 'CLEAR_STOP_BAR' | 'RECYCLE_PLATE' | 'RETURN_ORIGINALS' | 'VERIFY' | 'CLOSE' | 'WITHDRAW';
export type KnowledgeMentorActivityCommand =
  | { type: CaseStepType | 'OBSERVE' | 'REPORT'; caseId: KnowledgeMentorCaseId }
  | { type: 'PREPARE'; caseId: KnowledgeMentorCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; caseId: KnowledgeMentorCaseId; permission: KnowledgeMentorPermission }
  | { type: 'MOVE'; caseId: KnowledgeMentorCaseId; to: KnowledgeMentorNode }
  | { type: 'RECHARGE'; objectId: KnowledgeMentorObjectId }
  | { type: 'REFLECT' | 'PREPARE_COMBAT_PLATE' };
export interface KnowledgeMentorOriginalSnapshot { id: KnowledgeMentorObjectId; charge: number; durability: number; location: AlchemistCreation['location']; active: boolean }
interface CostSource { cashBefore: number; spiritualityBefore: number; actionsBefore: number }
export type KnowledgeMentorStep = { revision: number } & (
  | { type: Exclude<CaseStepType, 'PERFORM' | 'BUY_PLATE' | 'BIND_PLATE' | 'START_PROGRAM' | 'CALIBRATE'> }
  | { type: 'PERFORM'; originalsBefore: KnowledgeMentorOriginalSnapshot[]; actionsBefore: number }
  | { type: 'BUY_PLATE'; cashBefore: number }
  | { type: 'BIND_PLATE' | 'START_PROGRAM' | 'CALIBRATE'; check: PublicCheckResult; spiritualityBefore: number }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; permission: KnowledgeMentorPermission }
  | { type: 'MOVE'; to: KnowledgeMentorNode }
);
export interface KnowledgeMentorAttempt { week: number; preparedRevision: number; method: 'ABILITY' | 'ORDINARY'; actionsBefore: number; steps: KnowledgeMentorStep[] }
export interface KnowledgeMentorCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; attempts: KnowledgeMentorAttempt[] }
export interface KnowledgeMentorPlate { id: string; source: string; createdWeek: number; paidPennies: 60; boundObjectIds: KnowledgeMentorObjectId[]; status: 'BLANK' | 'BOUND' | 'FAILED' | 'INSTALLED' | 'SPENT'; location: 'PLAYER' | 'CONTROL' | 'RECYCLE' }
export interface KnowledgeMentorCombatPlate extends CostSource {
  id: string; source: string; createdWeek: number; createdRevision: number; check: PublicCheckResult;
  boundObjectIds: ['AL4-BOX-1', 'AL4-FRAME-1']; status: 'READY' | 'FAILED' | 'SPENT'; location: 'PLAYER' | 'YARD' | 'RECYCLE';
  spentRevision: number | null; paidPennies: 60; spiritualitySpent: 4; actionsSpent: 1;
}
export interface KnowledgeMentorRecharge extends CostSource {
  id: string; materialId: string; source: string; objectId: KnowledgeMentorObjectId; week: number; revision: number;
  paidPennies: 40; spiritualitySpent: 3; actionsSpent: 1; materialConsumed: true;
  before: KnowledgeMentorOriginalSnapshot[]; after: KnowledgeMentorOriginalSnapshot[];
}
export interface KnowledgeMentorOriginalEvent { revision: number; week: number; source: string; before: KnowledgeMentorOriginalSnapshot[]; after: KnowledgeMentorOriginalSnapshot[] }
/** Immutable cost/physical-step evidence is replayed. Only alchemist.life.creations owns live original resources. */
export interface KnowledgeMentorLifeState {
  cases: Record<KnowledgeMentorCaseId, KnowledgeMentorCaseState>; reflected: boolean;
  combatPlates: KnowledgeMentorCombatPlate[]; recharges: KnowledgeMentorRecharge[];
  originalLedger: KnowledgeMentorOriginalEvent[];
}
export interface KnowledgeMentorAttemptProjection {
  week: number; method: 'ABILITY' | 'ORDINARY'; performed: boolean; closed: boolean; withdrawn: boolean; verified: boolean;
  elapsedSeconds: number; ownerTravelMetres: number; boxTravelMetres: number; ownerNode: KnowledgeMentorNode;
  recordsRead: boolean; baselines: { sample: 1 | 2; boxTravelMetres: 4; transferSeconds: 8 | 9; openingMm: 18 | 17 }[];
  programPermission: KnowledgeMentorConsent; parcelPermission: KnowledgeMentorConsent;
  plate: KnowledgeMentorPlate | null; bindCheck: PublicCheckResult | null; runCheck: PublicCheckResult | null; calibrationCheck: PublicCheckResult | null;
  programActive: boolean; programRemainingSeconds: number; programEnd: 'NONE' | 'FAILED' | 'COMPLETE' | 'STOPPED' | 'EXPIRED' | 'WITHDRAWN' | 'CALIBRATED';
  completedSteps: number; automaticSteps: number; stepHistory: string[];
  parcel: { id: 'KM2-VERA-PARCEL'; owner: 'KM2-VERA'; holder: 'KM2-VERA' | 'PLAYER' | 'AL4-BOX-1'; location: 'OWNER' | KnowledgeMentorNode; delivered: boolean; returned: boolean };
  stopBar: { id: 'KM2-STOP-BAR'; location: 'RACK' | 'ROUTE'; placed: boolean; triggered: boolean; loadRunning: boolean; cleared: boolean };
  spiritualitySpent: number; paidPennies: number; boxChargeSpent: number; frameChargeSpent: number; frameDurabilityLost: number;
  calibrationSucceeded: boolean; originalsReturned: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
}
export interface KnowledgeMentorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: KnowledgeMentorActivityCommand }
export interface KnowledgeMentorLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  workbenchId: 'AL4-WORKBENCH-1'; activeCase: KnowledgeMentorCaseId | null; ownerNode: KnowledgeMentorNode;
  creations: AlchemistCreation[]; currentAttempt: KnowledgeMentorAttemptProjection | null;
  practice: { workbenchId: 'AL4-WORKBENCH-1'; activeCase: KnowledgeMentorCaseId | null; ownerNode: KnowledgeMentorNode; participant: { id: 'KM2-VERA'; name: '维拉'; age: 39; node: 'BENCH_START' }; recyclingTrayId: 'KM2-RECYCLE-TRAY' };
  currentConsents: { id: 'KM2-VERA'; consented: boolean; materialConsented: boolean }[];
  combatPlates: KnowledgeMentorCombatPlate[]; recharges: KnowledgeMentorRecharge[];
  cases: { id: KnowledgeMentorCaseId; title: string; story: string; observations: string[]; preparation: string | null; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: KnowledgeMentorAttemptProjection[] }[];
  actions: KnowledgeMentorLifeAction[];
}
const PROTOCOL_ID = 'paragon.s2.protocol-binding', CALIBRATION_ID = 'paragon.s2.bounded-calibration';
export const KNOWLEDGE_MENTOR_PLATE_SOURCE = '原创G：沃德工坊实际售出的60便士唯一空白工序片，仅封装眼前原盒与原架的三步；不含新灵魂、储能或通用制造能力。';
export const KNOWLEDGE_MENTOR_COMBAT_PLATE_SOURCE = '原创G：沃德工坊每次实际售出60便士空白战斗工序片，另实付1行动及4灵性、知识18；只绑定本人两件原物，一次使用，失败原片进回收盘。';
const RECHARGE_SOURCE = '原创G：原工坊本次交付并实际耗尽的40便士补能耗材，仅给指定本人原件补至3储能，不修耐久、不生新件。';
export const KNOWLEDGE_MENTOR_LIFE_SOURCE = '知识导师的序列2编号、称号映射及新增能力本次未获原著逐字核实，完整配方与原著仪式仍未知。有限工序封装、现场有限校准、人物、步骤、秒数、费用与奖励均明确原创G。';
export const KNOWLEDGE_MENTOR_LIFE_ENVIRONMENT = '同一2米原工作台，仅三步：①原架打开既有17毫米开口2秒；②原盒沿原线走2米8秒；③原架关闭2秒。先读原制造记录12秒、做两次4米往返基准18/20秒。观察/准备/实施/报告各1行动，准备须余2行动。空片60便士；绑定4灵性、知识18且一案一次；启动5灵性、两原物各1储能、知识18且一案一次，成功窗口45秒。失败不退费不洗骰，可普通手控；同意撤回或到期仅停止影响，不传送人或原物。低载荷阻挡实际原架耐久−5；有限校准4灵性、知识18且一案一次，普通原手柄始终可停。各报告扮演25、反思25，仅实际成功对应能力掌握8。补能1行动40便士3灵性至3，不修耐久。以上全部数值原创G。';
const CASES = [
  { id: 'documented-cycle', title: '原记录与空盒三步工序', story: '读取自己两件原物的真实制造记录，亲手观察两次基准，付费购入唯一空片，只试眼前原盒和原架的有限三步。封装与启动各只有一次；能力失败仍能普通手控完成。（原创G）', facts: ['两次普通基准分别8秒/18毫米、9秒/17毫米；不外推到未知结构。', '付60便士空片不等于制造新法器。绑定4灵性知识18；启动5灵性并耗两原物各1储能、知识18。', '逐步公开原动作和45秒窗口；完成后亲手回收原片、取回原盒原架。'] },
  { id: 'consented-transfer', title: '维拉当前同意与同一原包裹', story: '新知情成年人维拉（KM2-VERA，39岁）在起点保管唯一KM2-VERA-PARCEL。本次程序许可与原包裹交接许可分别询问；旧海伦娜和内尔的许可与原物不沿用。（原创G）', facts: ['先本人在起点接同一原包裹，再装原盒；原盒实际走2米才能送达。', '本人须实际走到终点取包裹，再携同一物走回起点亲手归还。', '撤回程序许可立即停止有限影响；撤回交接也停止程序，已经拿到的原包裹仍必须普通归还。'] },
  { id: 'blocked-cycle', title: '原挡条、真实耐久与有限校准', story: '本人先把工坊已有KM2-STOP-BAR原挡条装在低载荷路线。第二步确实受阻，原护架耐久真实降低5；只研究眼前本次停止，不制造万能修复或删除挡条。（原创G）', facts: ['挡条是工坊既有惰性材料，不是赠送法器；放置、触发、停止、拆回原架都须真实动作。', '一次有限校准4灵性知识18，只能停止当前确实受阻的已启动程序；失败可拉原手柄。', '停止以后亲手拆回挡条，普通完成剩余动作，回收原片并取回两原物；储能和耐久损失保持。'] },
] as const;
const entryFor = (id: KnowledgeMentorCaseId) => CASES.find(e => e.id === id)!;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const equal = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 2;
const freshCase = (): KnowledgeMentorCaseState => ({ status: 'AVAILABLE', observedWeek: null, attempts: [] });
export function createKnowledgeMentorLifeState(): KnowledgeMentorLifeState { return { cases: { 'documented-cycle': freshCase(), 'consented-transfer': freshCase(), 'blocked-cycle': freshCase() }, reflected: false, combatPlates: [], recharges: [], originalLedger: [] }; }
export function findKnowledgeMentorOriginalCreation(s: SliceState, id: KnowledgeMentorObjectId): AlchemistCreation | null { return findArcaneScholarOriginalCreation(s, id); }
export function readyKnowledgeMentorPlate(s: SliceState, location?: 'PLAYER' | 'YARD'): KnowledgeMentorCombatPlate | null { return s.knowledgeMentor.life.combatPlates.find(p => p.status === 'READY' && (location ? p.location === location : p.location === 'PLAYER' || p.location === 'YARD')) ?? null; }
export function knowledgeMentorLifeOriginalTail(s: SliceState): KnowledgeMentorOriginalSnapshot[] | null { const last = s.knowledgeMentor.life.originalLedger.at(-1); return last ? structuredClone(last.after) : null; }
const pair = (s: SliceState) => KNOWLEDGE_MENTOR_OBJECT_IDS.map(id => findKnowledgeMentorOriginalCreation(s, id));
const snapshot = (s: SliceState): KnowledgeMentorOriginalSnapshot[] => pair(s).flatMap(x => x ? [{ id: x.id, charge: x.charge, durability: x.durability, location: x.location, active: x.active }] : []);
const selectedCase = (s: SliceState): KnowledgeMentorCaseId | null => KNOWLEDGE_MENTOR_CASE_IDS.find(id => ['PREPARED', 'ACTIVE'].includes(s.knowledgeMentor.life.cases[id].status)) ?? null;
export function hasKnowledgeMentorLifeLock(s: SliceState): boolean { return !!s.knowledgeMentor?.life && selectedCase(s) !== null; }
export const knowledgeMentorInside = hasKnowledgeMentorLifeLock;
interface Replay extends KnowledgeMentorAttemptProjection { originals: KnowledgeMentorOriginalSnapshot[]; originalEvents: KnowledgeMentorOriginalEvent[]; runAttempted: boolean; initialAutomaticRun: boolean }
function freshReplay(a: KnowledgeMentorAttempt): Replay {
  return { week: a.week, method: a.method, performed: false, closed: false, withdrawn: false, verified: false, elapsedSeconds: 0, ownerTravelMetres: 0, boxTravelMetres: 0, ownerNode: 'BENCH_START', recordsRead: false, baselines: [], programPermission: 'UNASKED', parcelPermission: 'UNASKED', plate: null, bindCheck: null, runCheck: null, calibrationCheck: null, programActive: false, programRemainingSeconds: 0, programEnd: 'NONE', completedSteps: 0, automaticSteps: 0, stepHistory: [], parcel: { id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'KM2-VERA', location: 'OWNER', delivered: false, returned: false }, stopBar: { id: 'KM2-STOP-BAR', location: 'RACK', placed: false, triggered: false, loadRunning: false, cleared: false }, spiritualitySpent: 0, paidPennies: 0, boxChargeSpent: 0, frameChargeSpent: 0, frameDurabilityLost: 0, calibrationSucceeded: false, originalsReturned: false, result: 'NONE', originals: [], originalEvents: [], runAttempted: false, initialAutomaticRun: false };
}
function stop(a: Replay, end: Replay['programEnd']): void { a.programActive = false; a.programRemainingSeconds = 0; a.programEnd = end; }
function elapse(a: Replay, seconds: number): void { a.elapsedSeconds += seconds; if (a.programActive) { a.programRemainingSeconds = Math.max(0, a.programRemainingSeconds - seconds); if (!a.programRemainingSeconds) stop(a, 'EXPIRED'); } }
const returned = (a: Replay) => a.ownerNode === 'BENCH_START' && !a.programActive && !a.stopBar.loadRunning && a.stopBar.location === 'RACK' && a.parcel.holder === 'KM2-VERA' && (!a.plate || a.plate.location === 'RECYCLE') && (!a.performed || a.originalsReturned);
function checkShape(c: unknown): c is PublicCheckResult {
  if (!record(c) || !shape(c, ['ability', 'baseAbility', 'modifiers', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier']) || c.ability !== 'knowledge' || c.difficulty !== 18 || !integer(c.baseAbility, 0, 500) || !integer(c.roll, 1, 100) || !Array.isArray(c.modifiers)) return false;
  try { return equal(c, resolveNormalCheck({ ability: 'knowledge', baseAbility: c.baseAbility, difficulty: 18, modifiers: c.modifiers, roll: c.roll })); } catch { return false; }
}
function snapshotsValid(v: unknown): v is KnowledgeMentorOriginalSnapshot[] { return Array.isArray(v) && v.length === 2 && v.every((x, i) => record(x) && shape(x, ['id', 'charge', 'durability', 'location', 'active']) && x.id === KNOWLEDGE_MENTOR_OBJECT_IDS[i] && integer(x.charge, 0, 3) && integer(x.durability, 0, 100) && ['PLAYER', 'BENCH_START', 'BENCH_END', 'GUARD_MARK', 'YARD'].includes(String(x.location)) && x.active === false); }
const plainSteps: readonly string[] = ['READ_RECORDS', 'MEASURE_BASELINE', 'INSTALL_PLATE', 'PROGRAM_STEP', 'MANUAL_STEP', 'STOP_PROGRAM', 'WAIT_PROGRAM', 'TAKE_PARCEL', 'LOAD_PARCEL', 'COLLECT_PARCEL', 'RETURN_PARCEL', 'PLACE_STOP_BAR', 'MANUAL_STOP', 'CLEAR_STOP_BAR', 'RECYCLE_PLATE', 'RETURN_ORIGINALS', 'VERIFY', 'CLOSE', 'WITHDRAW'];
function stepShape(v: unknown): v is KnowledgeMentorStep {
  if (!record(v) || !integer(v.revision, 1)) return false;
  if (plainSteps.includes(String(v.type))) return shape(v, ['type', 'revision']);
  if (v.type === 'PERFORM') return shape(v, ['type', 'revision', 'originalsBefore', 'actionsBefore']) && snapshotsValid(v.originalsBefore) && v.originalsBefore.every(x => x.location === 'PLAYER' && !x.active) && integer(v.actionsBefore, 1, 3);
  if (v.type === 'BUY_PLATE') return shape(v, ['type', 'revision', 'cashBefore']) && integer(v.cashBefore, 60);
  if (['BIND_PLATE', 'START_PROGRAM', 'CALIBRATE'].includes(String(v.type))) return shape(v, ['type', 'revision', 'check', 'spiritualityBefore']) && checkShape(v.check) && integer(v.spiritualityBefore, v.type === 'START_PROGRAM' ? 5 : 4, 120);
  if (v.type === 'MOVE') return shape(v, ['type', 'revision', 'to']) && ['BENCH_START', 'BENCH_END'].includes(String(v.to));
  return ['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type)) && shape(v, ['type', 'revision', 'permission']) && ['PROGRAM', 'PARCEL'].includes(String(v.permission));
}
interface PreviousAttempts { bind: boolean; run: boolean; calibration: boolean }
function stepBlock(id: KnowledgeMentorCaseId, a: Replay, c: KnowledgeMentorStep['type'], previous: PreviousAttempts, permission?: KnowledgeMentorPermission, to?: KnowledgeMentorNode): string | null {
  if (a.closed) return '本次原现场已结束。';
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(c)) {
    if (id !== 'consented-transfer' || !permission || a.verified) return '仅本案维拉的两份独立当前许可可更改，复核后不再更改。';
    const p = permission === 'PROGRAM' ? a.programPermission : a.parcelPermission;
    return c === 'REVOKE_CONSENT' ? p === 'GRANTED' ? null : '这份当前许可未生效。' : p === 'UNASKED' ? null : '这份许可已明确回应，拒绝或撤回后本次不重新同意。';
  }
  if (c === 'WITHDRAW' && !a.performed) return null;
  if (c === 'PERFORM') return a.performed ? '本次已实付实施行动。' : null;
  if (!a.performed) return '先实付1行动部署两件真实原物。';
  if (c === 'CLOSE' || c === 'WITHDRAW') return !returned(a) ? '先停止、归还同一包裹、拆回原挡条、回收原片并亲手取回两件原物；结束不会传送。' : a.result !== 'NONE' && !a.verified ? '先明确复核真实结果。' : null;
  if (c === 'STOP_PROGRAM') return a.programActive ? null : '没有尚在持续的工序窗口。';
  if (c === 'MANUAL_STOP') return a.programActive || a.stopBar.loadRunning ? null : '原程序和低载荷均已停止。';
  if (c === 'WAIT_PROGRAM') return a.programActive ? null : '没有可实际等待到期的45秒窗口。';
  if (c === 'RETURN_PARCEL') return a.ownerNode === 'BENCH_START' && a.parcel.holder === 'PLAYER' ? null : '本人须携同一原包裹走回起点，才能交回维拉；撤回后也允许归还。';
  if (c === 'COLLECT_PARCEL') return !a.programActive && !a.stopBar.loadRunning && a.parcel.holder === 'AL4-BOX-1' && a.parcel.location === a.ownerNode ? null : '先停止，并让本人实际到同一原盒旁取回原包裹；撤回后仍可收回归还。';
  if (a.verified) return '已完成真实复核，只可结束现场。';
  if (c === 'MOVE') return to && to !== a.ownerNode ? null : '本人目的地须不同于原位置；步行2米实耗2秒。';
  if (c === 'READ_RECORDS') return !a.recordsRead && a.ownerNode === 'BENCH_START' && !a.originalsReturned ? null : '在原起点实际阅读两份原制造记录一次。';
  if (c === 'MEASURE_BASELINE') return !a.recordsRead || a.baselines.length >= 2 || a.ownerNode !== 'BENCH_START' || a.completedSteps !== 0 || a.runAttempted || a.plate?.location === 'CONTROL' || a.parcel.holder !== 'KM2-VERA' || a.stopBar.placed || a.originalsReturned ? '先读原记录，空盒、原挡条未放置且本人在起点，按顺序亲手做两次普通基准。' : null;
  if (c === 'BUY_PLATE') return a.plate || !a.recordsRead || a.baselines.length !== 2 || a.ownerNode !== 'BENCH_START' || a.originalsReturned || a.completedSteps > 0 ? '读完记录和两次基准后，在起点购入本次唯一60便士原空片。' : null;
  if (c === 'BIND_PLATE') return a.method !== 'ABILITY' || previous.bind || a.bindCheck || a.plate?.status !== 'BLANK' || a.ownerNode !== 'BENCH_START' || a.originalsReturned || a.completedSteps > 0 ? '本案最多一次绑定，须手持已支付原空片并有当次记录和两次基准；失败不重骰。' : null;
  if (c === 'INSTALL_PLATE') return a.plate?.status === 'BOUND' && a.plate.location === 'PLAYER' && a.ownerNode === 'BENCH_START' && !a.originalsReturned && a.completedSteps === 0 ? null : '须本人在起点把同一成功绑定原片实际装入控制槽一次。';
  if (c === 'TAKE_PARCEL') return id !== 'consented-transfer' || a.baselines.length !== 2 || a.parcelPermission !== 'GRANTED' || a.parcel.holder !== 'KM2-VERA' || a.parcel.returned || a.ownerNode !== 'BENCH_START' || a.completedSteps > 0 || a.originalsReturned ? '须维拉本次另行同意，才可在起点接下她仍持有的同一原包裹。' : null;
  if (c === 'LOAD_PARCEL') return a.parcelPermission === 'GRANTED' && a.parcel.holder === 'PLAYER' && a.ownerNode === 'BENCH_START' && a.originals[0]?.location === 'BENCH_START' && a.completedSteps === 0 ? null : '当前交接许可须有效，本人与原盒都在起点，再把手中同一包裹装盒。';
  if (c === 'PLACE_STOP_BAR') return id === 'blocked-cycle' && !a.stopBar.placed && a.ownerNode === 'BENCH_START' && a.baselines.length === 2 && a.completedSteps === 0 && !a.originalsReturned ? null : '本案须在两次基准之后、启动之前，从工坊原架亲手把唯一挡条装入路线一次。';
  if (c === 'START_PROGRAM') {
    if (a.method !== 'ABILITY' || previous.run || a.runAttempted || a.plate?.status !== 'INSTALLED' || a.completedSteps !== 0 || a.ownerNode !== 'BENCH_START' || a.originalsReturned) return '本案只启动一次，须实际装好成功绑定原片且本人在起点；失败不返原片。';
    if (id === 'consented-transfer' && (a.programPermission !== 'GRANTED' || a.parcelPermission !== 'GRANTED' || a.parcel.holder !== 'AL4-BOX-1')) return '先取得维拉本次两份当前许可，并实际把同一原包裹装入原盒。';
    if (id === 'blocked-cycle' && !a.stopBar.placed) return '先实际放置已告知的原低载荷挡条。';
    return a.originals.some(x => x.charge < 1 || x.durability < 1) ? '两原件须各有1真实储能且尚未损坏；不足可普通手控。' : null;
  }
  if (c === 'PROGRAM_STEP' || c === 'MANUAL_STEP') {
    if (!a.recordsRead || a.baselines.length !== 2 || a.completedSteps >= 3 || a.originalsReturned || a.stopBar.loadRunning) return '先完成两次原基准，依次执行三步；受阻负载须先真实停止。';
    if (id === 'consented-transfer' && (a.parcelPermission !== 'GRANTED' || a.parcel.holder !== 'AL4-BOX-1')) return '同一原包裹须仍在原盒内且当前交接许可有效；撤回后请停止并普通归还。';
    if (id === 'blocked-cycle' && !a.stopBar.placed) return '先亲手放置原挡条，不能跳过受阻的真实来源。';
    if (a.completedSteps === 1 && a.stopBar.triggered && a.stopBar.location === 'ROUTE') return '同一低载荷已实际触发，先亲手拆回原挡条，再普通完成剩余步骤；不重复撞击。';
    if (c === 'PROGRAM_STEP') return !a.programActive || a.ownerNode !== 'BENCH_START' || a.programRemainingSeconds < (a.completedSteps === 1 ? 8 : 2) || id === 'consented-transfer' && a.programPermission !== 'GRANTED' ? '须本人在起点、当前许可有效、真实窗口仍足够；耗尽可普通手控。' : null;
    if (a.programActive) return '先明确停止有限程序，才能普通接管。';
    return a.ownerNode !== (a.completedSteps === 2 ? 'BENCH_END' : 'BENCH_START') ? '普通手控须本人实际在本步原位置：前两步起点，末步终点。' : null;
  }
  if (c === 'CALIBRATE') return id !== 'blocked-cycle' || a.method !== 'ABILITY' || previous.calibration || a.calibrationCheck || !a.programActive || a.programRemainingSeconds < 2 || !a.stopBar.loadRunning || !a.stopBar.triggered || a.ownerNode !== 'BENCH_START' ? '只可对眼前已启动且真实受阻的当前原程序校准一次；失败改用原手柄。' : null;
  if (c === 'CLEAR_STOP_BAR') return a.stopBar.location === 'ROUTE' && !a.stopBar.loadRunning && !a.programActive && a.ownerNode === 'BENCH_START' ? null : '先真实停止程序与低载荷，再由起点本人亲手拆回原挡条。';
  if (c === 'RECYCLE_PLATE') return a.plate && a.plate.location !== 'RECYCLE' && !a.programActive && !a.stopBar.loadRunning && a.ownerNode === 'BENCH_START' ? null : '先停止，再由起点本人把同一原片实际拆入回收盘；失败片同样保留实物。';
  if (c === 'RETURN_ORIGINALS') return a.originalsReturned || a.programActive || a.stopBar.loadRunning || a.stopBar.location !== 'RACK' || a.parcel.holder !== 'KM2-VERA' || a.plate && a.plate.location !== 'RECYCLE' || a.ownerNode !== a.originals[0]?.location ? '先停止、归还包裹、拆回挡条并回收原片，再让本人走到同一原盒旁亲手取还两件原物。' : null;
  if (c === 'VERIFY') return a.completedSteps !== 3 || id === 'consented-transfer' && (!a.parcel.delivered || !a.parcel.returned) || id === 'blocked-cycle' && (!a.stopBar.triggered || !a.stopBar.cleared) || !returned(a) ? '三步须真实完成，原物均实际取还；包裹送达归还、挡条真实触发拆回后才能复核。' : null;
  return '未知原场步骤。';
}
function applyStep(id: KnowledgeMentorCaseId, attemptIndex: number, stepIndex: number, a: Replay, c: KnowledgeMentorStep): void {
  const before = c.type === 'PERFORM' ? structuredClone(c.originalsBefore) : structuredClone(a.originals);
  switch (c.type) {
    case 'PERFORM': a.performed = true; a.originals = structuredClone(c.originalsBefore); a.originals[0]!.location = 'BENCH_START'; a.originals[1]!.location = 'GUARD_MARK'; elapse(a, 6); break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'REVOKE_CONSENT': {
      const value = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN';
      if (c.permission === 'PROGRAM') a.programPermission = value; else a.parcelPermission = value;
      if (c.type === 'REVOKE_CONSENT' && a.programActive) stop(a, 'WITHDRAWN');
      elapse(a, 2); break;
    }
    case 'READ_RECORDS': a.recordsRead = true; elapse(a, 12); break;
    case 'MEASURE_BASELINE': { const n = a.baselines.length; a.baselines.push({ sample: n === 0 ? 1 : 2, boxTravelMetres: 4, transferSeconds: n === 0 ? 8 : 9, openingMm: n === 0 ? 18 : 17 }); a.boxTravelMetres += 4; a.ownerTravelMetres += 4; elapse(a, n === 0 ? 18 : 20); break; }
    case 'BUY_PLATE': a.plate = { id: `KM2-PLATE-${KNOWLEDGE_MENTOR_CASE_IDS.indexOf(id) + 1}-${attemptIndex + 1}`, source: KNOWLEDGE_MENTOR_PLATE_SOURCE, createdWeek: a.week, paidPennies: 60, boundObjectIds: [], status: 'BLANK', location: 'PLAYER' }; a.paidPennies += 60; elapse(a, 2); break;
    case 'BIND_PLATE': a.bindCheck = structuredClone(c.check); a.spiritualitySpent += 4; a.plate!.status = success(c.check) ? 'BOUND' : 'FAILED'; if (success(c.check)) a.plate!.boundObjectIds = [...KNOWLEDGE_MENTOR_OBJECT_IDS]; elapse(a, 6); break;
    case 'INSTALL_PLATE': a.plate!.status = 'INSTALLED'; a.plate!.location = 'CONTROL'; elapse(a, 3); break;
    case 'TAKE_PARCEL': a.parcel.holder = 'PLAYER'; a.parcel.location = 'BENCH_START'; elapse(a, 1); break;
    case 'LOAD_PARCEL': a.parcel.holder = 'AL4-BOX-1'; elapse(a, 1); break;
    case 'PLACE_STOP_BAR': a.stopBar.placed = true; a.stopBar.location = 'ROUTE'; elapse(a, 2); break;
    case 'START_PROGRAM': {
      a.runAttempted = true; a.runCheck = structuredClone(c.check); a.spiritualitySpent += 5; a.boxChargeSpent++; a.frameChargeSpent++;
      a.originals[0]!.charge--; a.originals[1]!.charge--; a.plate!.status = 'SPENT'; elapse(a, 2);
      if (success(c.check)) { a.programActive = true; a.programRemainingSeconds = 45; a.initialAutomaticRun = true; } else stop(a, 'FAILED');
      break;
    }
    case 'PROGRAM_STEP': case 'MANUAL_STEP': {
      const automatic = c.type === 'PROGRAM_STEP', step = a.completedSteps + 1;
      if (step === 2 && a.stopBar.location === 'ROUTE') {
        a.stopBar.triggered = true; a.stopBar.loadRunning = true;
        const loss = Math.min(5, a.originals[1]!.durability); a.originals[1]!.durability -= loss; a.frameDurabilityLost += loss;
        a.stepHistory.push(`第2步${automatic ? '程序' : '普通'}低载荷实际受原挡条阻挡，未移动原盒；原架耐久−${loss}（G）。`); elapse(a, 8); break;
      }
      if (step === 2) {
        a.originals[0]!.location = 'BENCH_END'; a.boxTravelMetres += 2;
        if (a.parcel.holder === 'AL4-BOX-1') { a.parcel.location = 'BENCH_END'; a.parcel.delivered = true; }
        if (!automatic) { a.ownerNode = 'BENCH_END'; a.ownerTravelMetres += 2; }
      }
      a.completedSteps++; if (automatic) a.automaticSteps++;
      a.stepHistory.push(`第${step}步${automatic ? '程序' : '普通手控'}：${step === 1 ? '原架开口17毫米，2秒' : step === 2 ? '原盒沿原路线实际2米，8秒' : '原架关闭，2秒'}（G）。`);
      elapse(a, step === 2 ? 8 : 2); if (a.completedSteps === 3 && a.programActive) stop(a, 'COMPLETE'); break;
    }
    case 'CALIBRATE': a.calibrationCheck = structuredClone(c.check); a.spiritualitySpent += 4; elapse(a, 2); if (success(c.check)) { a.calibrationSucceeded = true; a.stopBar.loadRunning = false; stop(a, 'CALIBRATED'); } break;
    case 'MANUAL_STOP': a.stopBar.loadRunning = false; stop(a, 'STOPPED'); elapse(a, 1); break;
    case 'STOP_PROGRAM': stop(a, 'STOPPED'); break;
    case 'WAIT_PROGRAM': elapse(a, a.programRemainingSeconds); break;
    case 'CLEAR_STOP_BAR': a.stopBar.location = 'RACK'; a.stopBar.cleared = true; elapse(a, 2); break;
    case 'MOVE': a.ownerNode = c.to; a.ownerTravelMetres += 2; if (a.parcel.holder === 'PLAYER') a.parcel.location = c.to; elapse(a, 2); break;
    case 'COLLECT_PARCEL': a.parcel.holder = 'PLAYER'; elapse(a, 1); break;
    case 'RETURN_PARCEL': a.parcel.holder = 'KM2-VERA'; a.parcel.location = 'OWNER'; a.parcel.returned = true; elapse(a, 1); break;
    case 'RECYCLE_PLATE': a.plate!.location = 'RECYCLE'; elapse(a, 2); break;
    case 'RETURN_ORIGINALS': a.originals.forEach(x => { x.location = 'PLAYER'; x.active = false; }); a.ownerNode = 'BENCH_START'; a.ownerTravelMetres += 2; a.originalsReturned = true; elapse(a, 6); break;
    case 'VERIFY': a.verified = true; a.result = id === 'blocked-cycle' ? a.calibrationSucceeded ? 'ABILITY' : 'ORDINARY' : a.automaticSteps === 3 && success(a.bindCheck) && success(a.runCheck) ? 'ABILITY' : 'ORDINARY'; elapse(a, 1); break;
    case 'CLOSE': case 'WITHDRAW': a.closed = true; a.withdrawn = c.type === 'WITHDRAW'; break;
  }
  if (!equal(before, a.originals)) a.originalEvents.push({ revision: c.revision, week: a.week, source: `case:${id}:${attemptIndex + 1}:step:${stepIndex + 1}:${c.type}`, before, after: structuredClone(a.originals) });
}
function replayAttempt(id: KnowledgeMentorCaseId, attemptIndex: number, a: KnowledgeMentorAttempt, previous: PreviousAttempts): Replay {
  const out = freshReplay(a); let revision = a.preparedRevision, spirituality: number | null = null, cash: number | null = null;
  for (const [index, c] of a.steps.entries()) {
    if (!stepShape(c) || c.revision <= revision) throw new Error('原场步骤结构或真实顺序无效。');
    revision = c.revision;
    const reason = stepBlock(id, out, c.type, previous, 'permission' in c ? c.permission : undefined, 'to' in c ? c.to : undefined);
    if (reason) throw new Error(reason);
    if (c.type === 'PERFORM' && c.actionsBefore !== a.actionsBefore - 1) throw new Error('准备和实施行动来源不守恒。');
    if ('spiritualityBefore' in c) { if (spirituality !== null && spirituality !== c.spiritualityBefore) throw new Error('同一原场灵性来源被补回。'); spirituality = c.spiritualityBefore - (c.type === 'START_PROGRAM' ? 5 : 4); }
    if ('cashBefore' in c) { if (cash !== null && cash !== c.cashBefore) throw new Error('同一原场原片费用来源无效。'); cash = c.cashBefore - 60; }
    applyStep(id, attemptIndex, index, out, c);
  }
  return out;
}
function replays(s: SliceState, id: KnowledgeMentorCaseId): Replay[] { const out: Replay[] = [], previous: PreviousAttempts = { bind: false, run: false, calibration: false }; for (const [i, a] of s.knowledgeMentor.life.cases[id].attempts.entries()) { const view = replayAttempt(id, i, a, previous); out.push(view); previous.bind ||= !!view.bindCheck; previous.run ||= !!view.runCheck; previous.calibration ||= !!view.calibrationCheck; } return out; }
function publicAttempt(a: Replay): KnowledgeMentorAttemptProjection { const { originals: _originals, originalEvents: _events, runAttempted: _run, initialAutomaticRun: _auto, ...view } = a; return structuredClone(view); }
function current(s: SliceState): { id: KnowledgeMentorCaseId; state: KnowledgeMentorCaseState; attempt: KnowledgeMentorAttempt; view: Replay; previous: PreviousAttempts } | null {
  const id = selectedCase(s); if (!id) return null;
  const state = s.knowledgeMentor.life.cases[id], all = replays(s, id), old = all.slice(0, -1);
  return { id, state, attempt: state.attempts.at(-1)!, view: all.at(-1)!, previous: { bind: old.some(a => !!a.bindCheck), run: old.some(a => !!a.runCheck), calibration: old.some(a => !!a.calibrationCheck) } };
}
export function validateKnowledgeMentorActivityCommand(v: unknown): v is KnowledgeMentorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT' || v.type === 'PREPARE_COMBAT_PLATE') return shape(v, ['type']);
  if (v.type === 'RECHARGE') return shape(v, ['type', 'objectId']) && KNOWLEDGE_MENTOR_OBJECT_IDS.includes(v.objectId as KnowledgeMentorObjectId);
  if (!KNOWLEDGE_MENTOR_CASE_IDS.includes(v.caseId as KnowledgeMentorCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'MOVE') return shape(v, ['type', 'caseId', 'to']) && ['BENCH_START', 'BENCH_END'].includes(String(v.to));
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'caseId', 'permission']) && ['PROGRAM', 'PARCEL'].includes(String(v.permission));
  return [...plainSteps, 'PERFORM', 'BUY_PLATE', 'BIND_PLATE', 'START_PROGRAM', 'CALIBRATE', 'OBSERVE', 'REPORT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isKnowledgeMentorActivity = validateKnowledgeMentorActivityCommand;
export const isKnowledgeMentorActivityCommand = validateKnowledgeMentorActivityCommand;
function oldSceneOpen(s: SliceState): boolean { return hasArcaneScholarLifeLock(s) || hasAlchemistLifeLock(s) || s.arcaneScholar.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.arcaneScholar.encounter.status) || ['FIGHTING'].includes(s.alchemist.encounter.status) || Object.values(s.astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED'); }
export function blockKnowledgeMentorActivity(s: SliceState, c: KnowledgeMentorActivityCommand): string | null {
  if (!validateKnowledgeMentorActivityCommand(c)) return '知识导师候选G生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE') return '须本人仍活着且当前为通识者途径知识导师候选2（G）。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件或战斗，并实际回贝克兰德原工坊。';
  if (s.knowledgeMentor.preparedWeek !== null || oldSceneOpen(s)) return '先收束晋升准备和旧阶段原场。';
  if (s.knowledgeMentor.encounter.status !== 'AVAILABLE') return '本阶段有限工坊准备已在独立遭遇前结束；原战斗储能、原伤耗和结局保持，普通离开后可继续生活。';
  const live = current(s), l = s.knowledgeMentor.life;
  if (live) {
    if (!('caseId' in c) || c.caseId !== live.id || c.type === 'OBSERVE' || c.type === 'PREPARE' || c.type === 'REPORT') return '先真实收束本案原现场，不能在接触中补能或切换其他准备。';
    const reason = stepBlock(live.id, live.view, c.type, live.previous, 'permission' in c ? c.permission : undefined, 'to' in c ? c.to : undefined); if (reason) return reason;
    if (c.type === 'PERFORM') { const originals = pair(s); if (s.actionsRemaining < 1) return '实施仍须实付1行动。'; if (originals.some(x => !x || x.location !== 'PLAYER' || x.active)) return '须随身实际持有两件停止的本人唯一原物；不赠送替代物。'; }
    if (c.type === 'BUY_PLATE' && s.cash < 60) return '原空片实际售价60便士；资金不足仍可不购片普通手控。';
    if (['BIND_PLATE', 'START_PROGRAM', 'CALIBRATE'].includes(c.type) && s.spirituality < (c.type === 'START_PROGRAM' ? 5 : 4)) return '须支付本次真实灵性；不足可普通手控、停止和归还。';
    return null;
  }
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身体和精神。';
  if (s.actionsRemaining < 1) return '需要1行动；原场内普通停止、走返和取还始终0行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : KNOWLEDGE_MENTOR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先实际报告三案。' : null;
  if (c.type === 'RECHARGE') { const x = findKnowledgeMentorOriginalCreation(s, c.objectId); return pair(s).some(v => !v) || !x || x.location !== 'PLAYER' || x.active || x.durability <= 0 || x.charge >= 3 ? '补能仅限本人实际随身持有、停止、尚未损坏且不足3储能的同一原物，不修复耐久。' : s.cash < 40 || s.spirituality < 3 ? '需要1行动、40便士及3灵性；实付耗材只补同一原物。' : null; }
  if (c.type === 'PREPARE_COMBAT_PLATE') return !l.reflected ? '先完成三个真实报告与反思。' : l.combatPlates.length >= 3 ? '本阶段最多三次独立付费制片尝试；失败不重骰、不赠空片。' : pair(s).some(x => !x || x.location !== 'PLAYER' || x.active) ? '须实际随身持有停止的同一原盒、原架。' : s.cash < 60 || s.spirituality < 4 ? '每次须1行动、60便士及4灵性、知识18。' : null;
  if (!('caseId' in c)) return '先选择实际原场。';
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { const previous = KNOWLEDGE_MENTOR_CASE_IDS[KNOWLEDGE_MENTOR_CASE_IDS.indexOf(c.caseId) - 1]; return r.status !== 'AVAILABLE' ? '本项已观察。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先真实报告上一案。' : null; }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原工坊现场。' : s.actionsRemaining < 2 ? '准备须余2行动，留出实际实施行动。' : r.attempts.some(a => a.week === s.week && a.steps.some(step => step.type === 'PERFORM')) ? '本周已实施本案；保留原代价，下个真实周可普通重新完成。' : c.method === 'ABILITY' && r.attempts.some(a => a.steps.some(step => ['BIND_PLATE', 'START_PROGRAM', 'CALIBRATE'].includes(step.type))) ? '本案能力尝试已发生，重新准备仅可普通手控，不洗骰。' : pair(s).some(x => !x || x.location !== 'PLAYER' || x.active) ? '须实际持有两件停止的旧本人原物。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先完成三步、本人走返、取还复核并关闭原场。';
  return '当前没有可执行的本案子步骤。';
}
export function applyKnowledgeMentorActivity(s: SliceState, c: KnowledgeMentorActivityCommand, ctx: SeerContext): void {
  const reason = blockKnowledgeMentorActivity(s, c); if (reason) throw new Error(reason);
  const l = s.knowledgeMentor.life, live = current(s), revision = s.revision + 1;
  if (live) {
    let step: KnowledgeMentorStep;
    if (c.type === 'PERFORM') step = { type: c.type, revision, originalsBefore: snapshot(s), actionsBefore: s.actionsRemaining };
    else if (c.type === 'BUY_PLATE') step = { type: c.type, revision, cashBefore: s.cash };
    else if (c.type === 'BIND_PLATE' || c.type === 'START_PROGRAM' || c.type === 'CALIBRATE') step = { type: c.type, revision, check: structuredClone(ctx.check('knowledge', 18)), spiritualityBefore: s.spirituality };
    else if (c.type === 'MOVE') step = { type: c.type, revision, to: c.to };
    else if (c.type === 'CONSENT' || c.type === 'DECLINE_CONSENT' || c.type === 'REVOKE_CONSENT') step = { type: c.type, revision, permission: c.permission };
    else step = { type: c.type as Exclude<CaseStepType, 'PERFORM' | 'BUY_PLATE' | 'BIND_PLATE' | 'START_PROGRAM' | 'CALIBRATE'>, revision };
    const oldEvents = live.view.originalEvents.length, oldTime = live.view.elapsedSeconds, oldOwnerNode = live.view.ownerNode;
    live.attempt.steps.push(step); applyStep(live.id, live.state.attempts.length - 1, live.attempt.steps.length - 1, live.view, step);
    if (step.type === 'PERFORM') { s.actionsRemaining--; live.state.status = 'ACTIVE'; }
    if (step.type === 'BUY_PLATE') s.cash -= 60;
    if (step.type === 'BIND_PLATE' || step.type === 'CALIBRATE') s.spirituality -= 4;
    if (step.type === 'START_PROGRAM') s.spirituality -= 5;
    for (const x of live.view.originals) { const actual = findKnowledgeMentorOriginalCreation(s, x.id); if (!actual) throw new Error('唯一原物来源缺失。'); actual.charge = x.charge; actual.durability = x.durability; actual.location = x.location; actual.active = false; }
    l.originalLedger.push(...structuredClone(live.view.originalEvents.slice(oldEvents)));
    if (step.type === 'CLOSE' || step.type === 'WITHDRAW') live.state.status = live.view.result === 'NONE' ? 'OBSERVED' : 'EXAMINED';
    const a = live.view, notes: Partial<Record<KnowledgeMentorStep['type'], string>> = {
      PERFORM: '实付1行动，6秒亲手把唯一原盒放原起点、唯一原架放1米原标记；储能耐久未增加。',
      READ_RECORDS: '12秒实际阅读两份既有本人制造记录；没有读取未知结构或原著缺失配方。',
      MEASURE_BASELINE: `本人亲手推原盒2米再带回2米，第${a.baselines.length}次基准真实留下${a.baselines.at(-1)?.transferSeconds}秒/${a.baselines.at(-1)?.openingMm}毫米；本人和盒各走4米。`,
      BUY_PLATE: `实付60便士取得唯一${a.plate?.id}原空片；仍无新灵魂、新造物或储能。`,
      INSTALL_PLATE: '本人花3秒把同一成功绑定原片装入原控制槽，尚未启动，未耗原物储能。',
      START_PROGRAM: `一次实际支付5灵性、原盒和原架各1储能，原片成为已耗用实物；知识18检定${a.runCheck?.roll}/${a.runCheck?.chance}，${success(a.runCheck) ? '获得仅本次45秒窗口，三步还须逐一实际执行。' : '启动失败，原成本全部保留，可普通手控，无重骰。'}`,
      BIND_PLATE: `一次实付4灵性、知识18检定${a.bindCheck?.roll}/${a.bindCheck?.chance}，${success(a.bindCheck) ? '同一付费原片仅绑定已观察的两件原物与三步。' : '封装失败，原片保留且须亲手回收，可普通完成，无掌握奖励。'}`,
      PROGRAM_STEP: a.stepHistory.at(-1) ?? '', MANUAL_STEP: a.stepHistory.at(-1) ?? '',
      TAKE_PARCEL: '维拉按本次独立交接许可，在起点亲手交出唯一KM2-VERA-PARCEL，耗1秒；不借用海伦娜或内尔旧许可。',
      LOAD_PARCEL: '本人在起点把手中同一原包裹装入同一原盒，耗1秒；不是复制物。',
      COLLECT_PARCEL: '本人已实际到同一原盒旁，停止后耗1秒亲手取出原包裹；本人位置不变。',
      RETURN_PARCEL: '本人携同一原包裹实际回到起点，耗1秒亲手交还维拉；拒绝或撤回后也须归还。',
      PLACE_STOP_BAR: '本人从工坊原架取唯一KM2-STOP-BAR装入已知低载荷路线，2秒；不是凭空制造的法器。',
      CALIBRATE: `实付4灵性、知识18检定${a.calibrationCheck?.roll}/${a.calibrationCheck?.chance}，2秒；${success(a.calibrationCheck) ? '真实受阻的当前原程序被有限校准停止，原架耐久未修，挡条尚须亲手拆回。' : '校准失败且成本保留，须用眼前普通原手柄停负载；不洗骰。'}`,
      MANUAL_STOP: '本人拉眼前原手柄，1秒普通停止程序与低载荷，不检定、不耗灵性、不给能力掌握；挡条和原片都还在原位。',
      STOP_PROGRAM: '立即停止当次有限窗口，0秒；没有归还、传送、退款或修复。受阻机械负载仍须原手柄停止。',
      WAIT_PROGRAM: '真实等到本次45秒有限窗口结束；原身体、原物、原片仍在当前位置，受阻机械负载仍需原手柄。',
      CLEAR_STOP_BAR: '本人2秒亲手把同一原挡条从路线拆回工坊原架；已经损失的原架耐久不恢复。',
      RECYCLE_PLATE: `本人2秒亲手把同一${a.plate?.id}原片放KM2-RECYCLE-TRAY回收盘；成功、失败和未用片均不变回免费材料。`,
      RETURN_ORIGINALS: oldOwnerNode === 'BENCH_END' ? '本人已到终点原盒旁，携同一盒走2米回起点，途中取回1米标记的同一原架，共6秒；两件原物随身，储能耐久不恢复。' : '原盒仍在起点，本人先拿起同一原盒，再走到1米标记取同一原架并回起点，1米去＋1米回共2米、6秒；储能耐久不恢复。',
      VERIFY: `耗1秒核验三步及真实取还；${a.result === 'ABILITY' ? '本案对应有限能力确实成功。' : '普通手控完成不冒充能力成功。'}`,
      CLOSE: '原现场真实结束，所有原代价和动作证据保留；关闭未移动任何原物。', WITHDRAW: '结束本次已真实取还的尝试，成本、失败和已耗能力机会保留；无原地重骰。',
    };
    let note = notes[step.type] ?? '';
    if (step.type === 'MOVE') note = `本人沿同一开放原路线步行2米、2秒到${step.to === 'BENCH_START' ? '起点' : '终点'}；手持原包裹随本人，盒和架未自动跟随。`;
    if ('permission' in step) note = `维拉${step.type === 'CONSENT' ? '明确同意' : step.type === 'DECLINE_CONSENT' ? '明确拒绝' : '明确撤回'}本次${step.permission === 'PROGRAM' ? '原包裹有限程序移送' : '同一原包裹自愿交接与装盒'}许可，2秒。两份许可独立；撤回即停程序但不移动人、包裹或原物，普通归还始终可做。`;
    ctx.note(entryFor(live.id).title, `${note} 本次累计${a.elapsedSeconds}秒（本步${a.elapsedSeconds - oldTime}秒），窗口余${a.programRemainingSeconds}秒；均原创G。`); return;
  }
  const costs: CostSource = { cashBefore: s.cash, spiritualityBefore: s.spirituality, actionsBefore: s.actionsRemaining };
  s.actionsRemaining--;
  if (c.type === 'RECHARGE') {
    const before = snapshot(s), x = findKnowledgeMentorOriginalCreation(s, c.objectId)!; s.cash -= 40; s.spirituality -= 3; x.charge = 3;
    const after = snapshot(s), n = l.recharges.length + 1;
    l.recharges.push({ ...costs, id: `KM2-RECHARGE-${n}`, materialId: `KM2-CHARGE-MATERIAL-${n}`, source: RECHARGE_SOURCE, objectId: c.objectId, week: s.week, revision, paidPennies: 40, spiritualitySpent: 3, actionsSpent: 1, materialConsumed: true, before, after });
    l.originalLedger.push({ revision, week: s.week, source: `recharge:${n}`, before: structuredClone(before), after: structuredClone(after) });
    ctx.note('实付补能同一原物', `1行动、40便士、3灵性已实际支付并用尽唯一耗材，${c.objectId}补至3储能；耐久仍${x.durability}，不是修复或新物（G）。`); return;
  }
  if (c.type === 'PREPARE_COMBAT_PLATE') {
    s.cash -= 60; s.spirituality -= 4; const check = structuredClone(ctx.check('knowledge', 18)), ok = success(check), id = `KM2-COMBAT-PLATE-${l.combatPlates.length + 1}`;
    l.combatPlates.push({ ...costs, id, source: KNOWLEDGE_MENTOR_COMBAT_PLATE_SOURCE, createdWeek: s.week, createdRevision: revision, check, boundObjectIds: [...KNOWLEDGE_MENTOR_OBJECT_IDS], status: ok ? 'READY' : 'FAILED', location: ok ? 'PLAYER' : 'RECYCLE', spentRevision: null, paidPennies: 60, spiritualitySpent: 4, actionsSpent: 1 });
    ctx.note('实付准备一次性原战斗工序片', `${id}实际花1行动60便士4灵性，知识18：${check.roll}/${check.chance}，${ok ? '原片成功绑定随身两原物，仅一次READY额度；不充原物能量，不给制作掌握奖励。' : '失败原片实际保留在回收盘，不返成本、不凭空补片。'} 已用${l.combatPlates.length}/3次真实付费尝试（G）。`); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('knowledge-mentor-reflection'); ctx.note('反思有限工序与真实原物', '三项报告后扮演+25（G）；有限知识须有观察和原记录，普通手控与当前许可仍有效，不能制造未知能力、独立灵魂或免费资源。'); return; }
  if (!('caseId' in c)) throw new Error('未知原场命令。');
  const r = l.cases[c.caseId], entry = entryFor(c.caseId);
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(entry.title, entry.story + entry.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.attempts.push({ week: s.week, preparedRevision: revision, actionsBefore: costs.actionsBefore, method: c.method, steps: [] }); ctx.note('准备有限原工序与普通退路', '实付1行动，本次准备不赠材料、不充原物储能，尚未实施；能力或普通方式均须读原记录、做两次基准、实际取还。'); return; }
  if (c.type === 'REPORT') { const a = replays(s, c.caseId).at(-1)!; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`knowledge-mentor-case:${c.caseId}`); if (a.result === 'ABILITY') { const abilityId = c.caseId === 'blocked-cycle' ? CALIBRATION_ID : PROTOCOL_ID; s.progression.mastery[abilityId] = Math.min(500, (s.progression.mastery[abilityId] ?? 0) + 8); } ctx.note(entry.title, `已真实完成、取还并核验，扮演+25（G）；${a.result === 'ABILITY' ? `本案实际成功的${c.caseId === 'blocked-cycle' ? '现场有限校准' : '有限工序封装'}掌握+8。` : '普通完成没有能力掌握奖励，失败与原耗用记录保留。'}`); }
}
export function knowledgeMentorLifeActions(s: SliceState): KnowledgeMentorLifeAction[] {
  if (!active(s)) return [];
  const out: KnowledgeMentorLifeAction[] = [], l = s.knowledgeMentor.life;
  const add = (command: KnowledgeMentorActivityCommand, label: string, cost: string) => { const reason = blockKnowledgeMentorActivity(s, command); out.push({ id: `knowledge-mentor-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}${'objectId' in command ? '-' + command.objectId.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const entry of CASES) {
    const caseId = entry.id, r = l.cases[caseId], a = replays(s, caseId).at(-1);
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId }, `观察：${entry.title}`, '1行动');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId, method: 'ABILITY' }, '准备有限工序与普通退路', '1行动 · 须余2行动 · 每项能力本案只一次'); add({ type: 'PREPARE', caseId, method: 'ORDINARY' }, '准备普通手控原工序', '1行动 · 须余2行动 · 不耗灵性储能'); }
    if (r.status === 'PREPARED' || r.status === 'ACTIVE') {
      if (caseId === 'consented-transfer') for (const permission of ['PROGRAM', 'PARCEL'] as const) {
        const label = permission === 'PROGRAM' ? '原包裹有限程序移送' : '同一原包裹交接与装盒';
        add({ type: 'CONSENT', caseId, permission }, `询问维拉：本次${label}许可`, '0行动 · 2秒 · 两份许可独立');
        add({ type: 'DECLINE_CONSENT', caseId, permission }, `维拉拒绝本次${label}`, '0行动 · 2秒 · 不代表敌意');
        add({ type: 'REVOKE_CONSENT', caseId, permission }, `维拉撤回本次${label}许可`, '0行动 · 2秒 · 即停程序 · 原物不传送');
      }
      if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId }, '实际部署两件本人原物', '1行动 · 6秒 · 不补储能耐久'); add({ type: 'WITHDRAW', caseId }, '取消尚未实施的本次准备', '0行动 · 已付行动保留'); }
    }
    if (r.status === 'ACTIVE' && a) {
      const commands: { type: CaseStepType; label: string; cost: string }[] = [
        { type: 'READ_RECORDS', label: '实际阅读两份原制造记录', cost: '0行动 · 12秒 · 仅已知原物' },
        { type: 'MEASURE_BASELINE', label: `亲手完成第${Math.min(2, a.baselines.length + 1)}次普通基准`, cost: '0行动 · 原盒与本人各4米 · 18/20秒' },
        { type: 'BUY_PLATE', label: '购买本次唯一空白原工序片', cost: '0行动 · 60便士 · 2秒 · 可不购片普通完成' },
        { type: 'BIND_PLATE', label: '仅绑定两原物与已观察三步', cost: '0行动 · 4灵性 · 知识18 · 6秒 · 本案一次' },
        { type: 'INSTALL_PLATE', label: '把同一成功绑定原片装控制槽', cost: '0行动 · 3秒 · 尚未启动' },
        { type: 'START_PROGRAM', label: '尝试启动一次有限原工序', cost: '0行动 · 5灵性＋两原物各1储能 · 知识18 · 2秒 · 成功45秒窗口' },
        { type: 'PROGRAM_STEP', label: `执行程序第${Math.min(3, a.completedSteps + 1)}步`, cost: '0行动 · 开口2秒→移盒2米8秒→关闭2秒 · 无额外行动者' },
        { type: 'STOP_PROGRAM', label: '立即停止当前有限程序', cost: '0行动 · 0秒 · 不传送或退款' },
        { type: 'WAIT_PROGRAM', label: '真实等到有限程序窗口结束', cost: `0行动 · 实耗剩余${a.programRemainingSeconds}秒` },
        { type: 'MANUAL_STEP', label: `普通手控第${Math.min(3, a.completedSteps + 1)}步`, cost: '0行动 · 不检定/不耗灵性储能 · 原动作照实发生' },
        { type: 'MANUAL_STOP', label: '拉原手柄停止程序与低载荷', cost: '0行动 · 1秒 · 零灵性仍可用' },
      ];
      if (caseId === 'consented-transfer') commands.push(
        { type: 'TAKE_PARCEL', label: '在起点接维拉自愿交付的同一原包裹', cost: '0行动 · 1秒 · 需当前独立交接许可' },
        { type: 'LOAD_PARCEL', label: '把手中同一原包裹装入原盒', cost: '0行动 · 1秒 · 人与盒须实际在起点' },
        { type: 'COLLECT_PARCEL', label: '在同一原盒旁亲手取出原包裹', cost: '0行动 · 1秒 · 先停程序 · 撤回后也可取还' },
        { type: 'RETURN_PARCEL', label: '起点本人把同一原包裹交回维拉', cost: '0行动 · 1秒 · 须实际携回起点' });
      if (caseId === 'blocked-cycle') commands.push(
        { type: 'PLACE_STOP_BAR', label: '亲手把工坊同一原挡条放路线', cost: '0行动 · 2秒 · 本次受阻来源' },
        { type: 'CALIBRATE', label: '尝试有限校准停止当前真实受阻程序', cost: '0行动 · 4灵性 · 知识18 · 2秒 · 本案一次 · 不修耐久' },
        { type: 'CLEAR_STOP_BAR', label: '亲手拆同一原挡条回工坊原架', cost: '0行动 · 2秒 · 先停程序与低载荷' });
      commands.push(
        { type: 'RECYCLE_PLATE', label: '把同一原片实际拆入回收盘', cost: '0行动 · 2秒 · 本人在起点 · 失败原片也须回收' },
        { type: 'RETURN_ORIGINALS', label: '本人亲手取回原盒与原架', cost: '0行动 · 实走2米/6秒 · 先到原盒旁 · 不补能修复' },
        { type: 'VERIFY', label: '复核实际三步、当前许可与原物归还', cost: '0行动 · 1秒 · 不把普通完成算能力成功' },
        { type: 'CLOSE', label: '关闭已实际取还的原现场', cost: '0行动 · 不代替停止、走路或归还' },
        { type: 'WITHDRAW', label: '结束本次尝试并保留真实成本', cost: '0行动 · 须先停止走返取还 · 不重骰' });
      for (const c of commands) add({ type: c.type, caseId }, c.label, c.cost);
      for (const to of ['BENCH_END', 'BENCH_START'] as const) add({ type: 'MOVE', caseId, to }, `本人沿原路步行到${to === 'BENCH_END' ? '终点' : '起点'}`, '0行动 · 实走2米/2秒 · 手持原包裹随本人');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId }, '报告本案真实结果与原物取还', '1行动 · 扮演25 · 仅对应实际能力成功掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三个有限原工序', '1行动 · 三报告后扮演25（G）');
  for (const objectId of KNOWLEDGE_MENTOR_OBJECT_IDS) add({ type: 'RECHARGE', objectId }, `付费补能同一${objectId === 'AL4-BOX-1' ? '原盒' : '原架'}`, '1行动 · 40便士＋3灵性 · 至3储能 · 不修耐久');
  add({ type: 'PREPARE_COMBAT_PLATE' }, '实付尝试制作一张一次性原战斗工序片', `1行动 · 60便士＋4灵性 · 知识18 · 已尝试${l.combatPlates.length}/3 · 失败原片保留`);
  return out;
}
export function projectKnowledgeMentorLife(s: SliceState): KnowledgeMentorLifeProjection {
  const l = s.knowledgeMentor.life, id = selectedCase(s), a = id ? replays(s, id).at(-1)! : null;
  return { title: '有限工序、当前许可与同一原物（候选G）', source: KNOWLEDGE_MENTOR_LIFE_SOURCE, environment: KNOWLEDGE_MENTOR_LIFE_ENVIRONMENT,
    insideCase: hasKnowledgeMentorLifeLock(s), reflected: l.reflected, workbenchId: 'AL4-WORKBENCH-1', activeCase: id, ownerNode: a?.ownerNode ?? 'BENCH_START',
    creations: structuredClone(pair(s).flatMap(x => x ? [x] : [])), currentAttempt: a ? publicAttempt(a) : null,
    practice: { workbenchId: 'AL4-WORKBENCH-1', activeCase: id, ownerNode: a?.ownerNode ?? 'BENCH_START', participant: { id: 'KM2-VERA', name: '维拉', age: 39, node: 'BENCH_START' }, recyclingTrayId: 'KM2-RECYCLE-TRAY' },
    currentConsents: [{ id: 'KM2-VERA', consented: id === 'consented-transfer' && a?.programPermission === 'GRANTED' && !a.closed, materialConsented: id === 'consented-transfer' && a?.parcelPermission === 'GRANTED' && !a.closed }],
    combatPlates: structuredClone(l.combatPlates), recharges: structuredClone(l.recharges),
    cases: CASES.map(e => { const r = l.cases[e.id], attempts = replays(s, e.id), last = attempts.at(-1); return { id: e.id, title: e.title, story: e.story, observations: r.status === 'AVAILABLE' ? [] : [...e.facts], preparation: r.status === 'PREPARED' ? `本次${last!.method === 'ABILITY' ? '有限能力与普通退路' : '普通手控'}准备，实际原物、当前许可与费用仍须落实。` : null, status: r.status, method: last?.method ?? null, result: last?.result && last.result !== 'NONE' ? `${last.result === 'ABILITY' ? '本案对应有限能力实际成功' : '普通真实完成，无能力掌握奖励'}；同一原物已取还，耗用保留。` : null, contactOpen: r.status === 'ACTIVE', returned: !!last?.performed && returned(last), closes: attempts.filter(v => v.performed && v.closed).length, attempts: attempts.map(publicAttempt) }; }), actions: knowledgeMentorLifeActions(s) };
}
export function validateKnowledgeMentorCombatPlate(v: unknown, latestWeek: number, latestRevision: number): v is KnowledgeMentorCombatPlate {
  if (!record(v) || !shape(v, ['id', 'source', 'createdWeek', 'createdRevision', 'check', 'boundObjectIds', 'status', 'location', 'spentRevision', 'paidPennies', 'spiritualitySpent', 'actionsSpent', 'cashBefore', 'spiritualityBefore', 'actionsBefore']) || !/^KM2-COMBAT-PLATE-[1-3]$/.test(String(v.id)) || v.source !== KNOWLEDGE_MENTOR_COMBAT_PLATE_SOURCE || !integer(v.createdWeek, 1, latestWeek) || !integer(v.createdRevision, 1, latestRevision) || !checkShape(v.check) || !equal(v.boundObjectIds, KNOWLEDGE_MENTOR_OBJECT_IDS) || v.paidPennies !== 60 || v.spiritualitySpent !== 4 || v.actionsSpent !== 1 || !integer(v.cashBefore, 60) || !integer(v.spiritualityBefore, 4, 120) || !integer(v.actionsBefore, 1, 3)) return false;
  if (!success(v.check)) return v.status === 'FAILED' && v.location === 'RECYCLE' && v.spentRevision === null;
  if (!['PLAYER', 'YARD'].includes(String(v.location))) return false;
  return v.status === 'READY' ? v.spentRevision === null : v.status === 'SPENT' && integer(v.spentRevision, v.createdRevision + 1, latestRevision);
}
export function validateKnowledgeMentorLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
export const validateKnowledgeMentorLifeState = validateKnowledgeMentorLife;
function validateLife(s: SliceState): boolean {
  const raw: unknown = s.knowledgeMentor?.life, fresh = createKnowledgeMentorLifeState();
  if (!record(raw) || !shape(raw, Object.keys(fresh)) || !record(raw.cases) || !shape(raw.cases, KNOWLEDGE_MENTOR_CASE_IDS) || typeof raw.reflected !== 'boolean' || !Array.isArray(raw.combatPlates) || !Array.isArray(raw.recharges) || !Array.isArray(raw.originalLedger)) return false;
  const l = raw as unknown as KnowledgeMentorLifeState, promotion = s.knowledgeMentor.promotionWeek;
  if (promotion === null) return equal(l, fresh) && !s.seer.completedSources.some(v => v === 'knowledge-mentor-reflection' || v.startsWith('knowledge-mentor-case:'));
  if ((!active(s)&&!(s.progression.pathwayId==='paragon'&&s.progression.sequence===1)) || !integer(promotion, 1, s.week)) return false;
  let open = 0, resolved = 0, protocolAwards = 0, calibrationAwards = 0, lastRevision = 0;
  const expectedEvents: KnowledgeMentorOriginalEvent[] = [], allRevision = new Set<number>(), plateIds = new Set<string>();
  for (const [index, id] of KNOWLEDGE_MENTOR_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (!equal(r, freshCase())) return false; }
    else if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[KNOWLEDGE_MENTOR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let previousWeek = r.observedWeek ?? promotion, anyAbility = false;
    const views: Replay[] = [], performedWeeks = new Set<number>(), previous: PreviousAttempts = { bind: false, run: false, calibration: false };
    for (const [attemptIndex, attempt] of r.attempts.entries()) {
      if (!record(attempt) || !shape(attempt, ['week', 'preparedRevision', 'method', 'actionsBefore', 'steps']) || !integer(attempt.week, previousWeek, s.week) || !integer(attempt.preparedRevision, lastRevision + 1, s.revision) || !integer(attempt.actionsBefore, 2, 3) || !['ABILITY', 'ORDINARY'].includes(attempt.method) || !Array.isArray(attempt.steps) || anyAbility && attempt.method === 'ABILITY') return false;
      previousWeek = attempt.week; lastRevision = attempt.preparedRevision;
      if (allRevision.has(attempt.preparedRevision)) return false; allRevision.add(attempt.preparedRevision);
      const a = replayAttempt(id, attemptIndex, attempt, previous);
      for (const step of attempt.steps) { if (!integer(step.revision, lastRevision + 1, s.revision) || allRevision.has(step.revision)) return false; lastRevision = step.revision; allRevision.add(step.revision); }
      if (a.performed) { if (performedWeeks.has(a.week)) return false; performedWeeks.add(a.week); }
      if (a.closed && !returned(a) || a.verified && (a.result === 'NONE' || !returned(a)) || a.spiritualitySpent !== (a.bindCheck ? 4 : 0) + (a.runCheck ? 5 : 0) + (a.calibrationCheck ? 4 : 0) || a.boxChargeSpent !== (a.runCheck ? 1 : 0) || a.frameChargeSpent !== a.boxChargeSpent || a.paidPennies !== (a.plate ? 60 : 0)) return false;
      if (a.ownerTravelMetres % 2 || a.ownerTravelMetres > a.elapsedSeconds || a.boxTravelMetres !== a.baselines.length * 4 + (a.completedSteps >= 2 ? 2 : 0) || !integer(a.programRemainingSeconds, 0, 45) || a.method === 'ORDINARY' && (a.bindCheck || a.runCheck || a.calibrationCheck || a.result === 'ABILITY')) return false;
      if (id !== 'consented-transfer' && (a.programPermission !== 'UNASKED' || a.parcelPermission !== 'UNASKED' || a.parcel.holder !== 'KM2-VERA' || a.parcel.delivered || a.parcel.returned)) return false;
      if (id !== 'blocked-cycle' && (a.stopBar.placed || a.stopBar.triggered || a.stopBar.cleared || a.calibrationCheck || a.frameDurabilityLost)) return false;
      if (attemptIndex < r.attempts.length - 1 && (!a.closed || a.result !== 'NONE') || !a.closed && attemptIndex !== r.attempts.length - 1) return false;
      if (a.plate) { if (plateIds.has(a.plate.id)) return false; plateIds.add(a.plate.id); }
      expectedEvents.push(...a.originalEvents); previous.bind ||= !!a.bindCheck; previous.run ||= !!a.runCheck; previous.calibration ||= !!a.calibrationCheck; anyAbility ||= !!a.bindCheck || !!a.runCheck || !!a.calibrationCheck; views.push(a);
    }
    const last = views.at(-1);
    if (r.status === 'OBSERVED' && last && (!last.closed || last.result !== 'NONE')) return false;
    if (r.status === 'PREPARED' && (!last || last.performed || last.closed)) return false;
    if (r.status === 'ACTIVE' && (!last?.performed || last.closed)) return false;
    if (r.status === 'EXAMINED' || r.status === 'RESOLVED') { if (!last?.performed || !last.closed || !last.verified || last.result === 'NONE' || !returned(last)) return false; }
    if (r.status === 'PREPARED' || r.status === 'ACTIVE') {
      open++;
      if (!last || last.week !== s.week || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.activeEvent || s.combat || s.knowledgeMentor.preparedWeek !== null || s.knowledgeMentor.encounter.status !== 'AVAILABLE' || oldSceneOpen(s)) return false;
      const attempt = r.attempts.at(-1)!;
      if (s.actionsRemaining !== attempt.actionsBefore - 1 - (last.performed ? 1 : 0)) return false;
      const lastPaid = [...attempt.steps].reverse().find(step => 'cashBefore' in step), lastSpiritual = [...attempt.steps].reverse().find(step => 'spiritualityBefore' in step);
      if (lastPaid && 'cashBefore' in lastPaid && s.cash !== lastPaid.cashBefore - 60 || lastSpiritual && 'spiritualityBefore' in lastSpiritual && s.spirituality !== lastSpiritual.spiritualityBefore - (lastSpiritual.type === 'START_PROGRAM' ? 5 : 4)) return false;
    }
    if (r.status === 'RESOLVED') { resolved++; if (last?.result === 'ABILITY') { if (id === 'blocked-cycle') calibrationAwards++; else protocolAwards++; } }
    if (s.seer.completedSources.filter(v => v === `knowledge-mentor-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || l.reflected && resolved !== 3 || s.seer.completedSources.filter(v => v === 'knowledge-mentor-reflection').length !== (l.reflected ? 1 : 0)) return false;
  let previousRechargeWeek = promotion, previousRechargeRevision = 0;
  for (const [i, e] of l.recharges.entries()) {
    if (!record(e) || !shape(e, ['id', 'materialId', 'source', 'objectId', 'week', 'revision', 'paidPennies', 'spiritualitySpent', 'actionsSpent', 'materialConsumed', 'before', 'after', 'cashBefore', 'spiritualityBefore', 'actionsBefore']) || e.id !== `KM2-RECHARGE-${i + 1}` || e.materialId !== `KM2-CHARGE-MATERIAL-${i + 1}` || e.source !== RECHARGE_SOURCE || !KNOWLEDGE_MENTOR_OBJECT_IDS.includes(e.objectId) || !integer(e.week, previousRechargeWeek, s.week) || !integer(e.revision, previousRechargeRevision + 1, s.revision) || allRevision.has(e.revision) || e.paidPennies !== 40 || e.spiritualitySpent !== 3 || e.actionsSpent !== 1 || e.materialConsumed !== true || !integer(e.cashBefore, 40) || !integer(e.spiritualityBefore, 3, 120) || !integer(e.actionsBefore, 1, 3) || !snapshotsValid(e.before) || !snapshotsValid(e.after) || e.before.some(x => x.location !== 'PLAYER')) return false;
    const expected = structuredClone(e.before), x = expected.find(v => v.id === e.objectId)!; if (x.charge >= 3 || x.durability <= 0) return false; x.charge = 3; if (!equal(e.after, expected)) return false;
    expectedEvents.push({ revision: e.revision, week: e.week, source: `recharge:${i + 1}`, before: structuredClone(e.before), after: structuredClone(e.after) });
    previousRechargeWeek = e.week; previousRechargeRevision = e.revision; allRevision.add(e.revision);
    if (e.revision === s.revision && e.week === s.week && (s.cash !== e.cashBefore - 40 || s.spirituality !== e.spiritualityBefore - 3)) return false;
  }
  for (const id of KNOWLEDGE_MENTOR_CASE_IDS) for (const attempt of l.cases[id].attempts) {
    const end = attempt.steps.at(-1)?.revision ?? s.revision + 1;
    if (l.recharges.some(e => e.revision > attempt.preparedRevision && e.revision < end) || l.combatPlates.some(p => p.createdRevision > attempt.preparedRevision && p.createdRevision < end)) return false;
  }
  expectedEvents.sort((a, b) => a.revision - b.revision);
  if (!equal(l.originalLedger, expectedEvents)) return false;
  for (const [i, event] of expectedEvents.entries()) { if (!snapshotsValid(event.before) || !snapshotsValid(event.after) || i > 0 && (event.week < expectedEvents[i - 1]!.week || !equal(event.before, expectedEvents[i - 1]!.after))) return false; }
  if (expectedEvents.length && s.knowledgeMentor.encounter.status === 'AVAILABLE' && !equal(snapshot(s), expectedEvents.at(-1)!.after)) return false;
  if (l.combatPlates.length > 3 || l.combatPlates.length && !l.reflected) return false;
  let previousPlateRevision = lastRevision, previousPlateWeek = promotion;
  for (const [i, p] of l.combatPlates.entries()) {
    if (!validateKnowledgeMentorCombatPlate(p, s.week, s.revision) || p.id !== `KM2-COMBAT-PLATE-${i + 1}` || p.createdWeek < previousPlateWeek || p.createdWeek < promotion || p.createdRevision <= previousPlateRevision || allRevision.has(p.createdRevision)) return false;
    if (s.knowledgeMentor.encounter.status === 'AVAILABLE' && (p.status === 'SPENT' || p.location === 'YARD')) return false;
    previousPlateWeek = p.createdWeek; previousPlateRevision = p.createdRevision; allRevision.add(p.createdRevision);
    if (p.createdRevision === s.revision && p.createdWeek === s.week && (s.cash !== p.cashBefore - 60 || s.spirituality !== p.spiritualityBefore - 4)) return false;
  }
  return integer(s.progression.mastery[PROTOCOL_ID], protocolAwards * 8, 500) && integer(s.progression.mastery[CALIBRATION_ID], calibrationAwards * 8, 500) && (s.progression.sequence===1?s.civilizationEnlightener.knowledgeMentorActingAtPromotion??0:s.progression.acting) >= resolved * 25 + (l.reflected ? 25 : 0);
}
