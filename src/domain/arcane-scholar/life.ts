import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { AlchemistCreation } from '../alchemist/life.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

export const ARCANE_SCHOLAR_CASE_IDS = ['tolerance-map', 'timed-transfer', 'fault-isolation'] as const;
export const ARCANE_SCHOLAR_OBJECT_IDS = ['AL4-BOX-1', 'AL4-FRAME-1'] as const;
export type ArcaneScholarCaseId = typeof ARCANE_SCHOLAR_CASE_IDS[number];
export type ArcaneScholarObjectId = typeof ARCANE_SCHOLAR_OBJECT_IDS[number];
export type ArcaneScholarActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT' | 'READ_RECORDS' | 'MEASURE_BASELINE' | 'ANALYZE' | 'COMPARE_READINGS' | 'TAKE_NOTE' | 'START_LINK' | 'MOVE_NOTE' | 'CARRY_NOTE' | 'RETURN_NOTE' | 'TRIGGER_LOAD' | 'STOP_LOAD' | 'MANUAL_STOP' | 'STOP_LINK' | 'RECYCLE_FUSE' | 'RETURN_ORIGINALS'; caseId: ArcaneScholarCaseId }
  | { type: 'PREPARE'; caseId: ArcaneScholarCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'RECHARGE'; objectId: ArcaneScholarObjectId }
  | { type: 'REFLECT' };
export interface ArcaneScholarBaseline { sample: 1 | 2; boxTravelMetres: 4; transferSeconds: 8 | 9; openingMm: 18 | 17 }
export interface ArcaneScholarAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; consented: boolean; closed: boolean;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; ownerTravelMetres: number; boxTravelMetres: number;
  recordsRead: boolean; baselines: ArcaneScholarBaseline[]; analysisTier: PublicResolutionTier | null; boundedSetting: string | null;
  linkTier: PublicResolutionTier | null; linkRemainingSeconds: number; linkStopped: boolean;
  noteTaken: boolean; noteDelivered: boolean; noteReturned: boolean;
  loadTriggered: boolean; loadStopped: boolean; manualStop: boolean; fuseId: string | null;
  spiritualitySpent: number; boxChargeSpent: number; frameChargeSpent: number; frameDurabilityLost: number; originalsReturned: boolean;
}
export interface ArcaneScholarCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: ArcaneScholarAttempt[];
}
export interface ArcaneScholarFuse {
  id: string; source: string; paidPennies: 20; week: number; attempt: number; consumed: boolean; location: 'LOAD_DEVICE' | 'RECYCLING_BOX';
}
export interface ArcaneScholarRecharge {
  id: string; materialId: string; source: string; objectId: ArcaneScholarObjectId; week: number;
  paidPennies: 40; spiritualitySpent: 3; previousCharge: number; resultingCharge: 3; durabilityBefore: number; durabilityAfter: number; materialConsumed: true;
}
export interface ArcaneScholarLifeState {
  workbenchId: 'AL4-WORKBENCH-1'; objectIds: ['AL4-BOX-1', 'AL4-FRAME-1']; activeCase: ArcaneScholarCaseId | null;
  ownerNode: 'BENCH_START' | 'BENCH_END';
  note: { id: 'AR3-TEST-NOTE'; owner: 'AR3-NELL'; custodian: 'AR3-NELL' | 'PLAYER' | 'AL4-BOX-1'; location: 'OWNER' | 'BENCH_START' | 'BENCH_END' };
  load: { deviceId: 'AL4-PAD-1'; handleId: 'AR3-LOAD-HANDLE'; status: 'IDLE' | 'ARMED' | 'RUNNING' | 'STOPPED' };
  recyclingBoxId: 'AR3-RECYCLE-BOX'; fuses: ArcaneScholarFuse[]; recharges: ArcaneScholarRecharge[];
  cases: Record<ArcaneScholarCaseId, ArcaneScholarCaseState>; reflected: boolean;
}
export interface ArcaneScholarLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ArcaneScholarActivityCommand }
export interface ArcaneScholarLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  workbenchId: string; ownerNode: ArcaneScholarLifeState['ownerNode']; creations: AlchemistCreation[];
  note: ArcaneScholarLifeState['note']; load: ArcaneScholarLifeState['load']; fuses: ArcaneScholarFuse[]; recharges: ArcaneScholarRecharge[];
  currentAttempt: ArcaneScholarAttempt | null; activeCase: ArcaneScholarCaseId | null;
  cases: { id: ArcaneScholarCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ArcaneScholarAttempt[] }[];
  actions: ArcaneScholarLifeAction[];
}
const ANALYSIS_ID = 'paragon.s3.bounded-analysis', LINK_ID = 'paragon.s3.construct-coordination';
const SETTING = '原创G：只对这两件原物采用8秒移送、原护架17毫米开口；不外推到未见结构。';
const CASES = [
  { id: 'tolerance-map', title: '原制造记录与两次基准', story: '在原两米工作台AL4-WORKBENCH-1，把自己制造的唯一原盒放在起点、原护架放在一米标记。实际阅读原材料和装配记录，再亲手让原盒两次往返并读原架开口。解析只比较这些可见数据。（原创G）', facts: ['每次基准沿2米原路线推出并带回，共4米；读数分别为8秒/18毫米和9秒/17毫米。', '有限解析仅一次：4灵性、知识16；失败保成本，可直接普通比较已有读数，不重骰。'] },
  { id: 'timed-transfer', title: '同一原测试纸的两米协同', story: '新的知情成年人内尔（AR3-NELL，38岁）在原起点持有唯一测试纸AR3-TEST-NOTE。本次先征得她同意，再借原纸。原盒沿眼前2米原台到终点，原架在一米标记短时支撑开口；本人仍须取回原纸交她。（原创G）', facts: ['协同5灵性、两原件各1次储能、知识18，已付一次窗口30秒、限眼前6米，不增加行动者或装备。', '失败或原件坏掉可由本人手持同纸走2米送达，再沿原路归还；旧海伦娜的包裹与黄铜片保持已归还。'] },
  { id: 'fault-isolation', title: '已知低载荷失配与真实停止', story: '内尔同意在原软垫限位装置AL4-PAD-1进行一次提前告知的机械失配。20便士原熔片装入既有装置，触发后实际耗用；无人站在负载内。先明确触发，再研究停止，失败也有眼前原手柄可立即断开。（原创G）', facts: ['能力停止5灵性、两原件各1次储能、知识18，仅一次；失败原架耐久−5，原熔片与灵性不退。', '普通原手柄0行动直接停止，不重骰、不伤旁人。停后须把同一熔片拆入AR3-RECYCLE-BOX并取回两原件。'] },
] as const;
export const ARCANE_SCHOLAR_LIFE_SOURCE = '奥秘学者的序列3编号仅跨段推定，完整新增能力表本次未直接核实。以下有限结构解析、双原造物协同及所有人物、场地参数和费用均为原创G；序列4注魂自制物与抽区域生命仪式仍属于旧阶段。';
export const ARCANE_SCHOLAR_LIFE_ENVIRONMENT = '观察、准备、实施、报告各1行动，准备须至少余2行动。实际子步骤0行动但逐次耗时；无无意义等待或同次重骰。报告各扮演25、三案反思25，成功仅给对应新能力掌握8。原件只引用旧池，补能1行动/40便士/3灵性至3，不修耐久，不复活坏件。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 3;
const freshCase = (): ArcaneScholarCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const freshAttempt = (week: number, method: 'ABILITY' | 'ORDINARY'): ArcaneScholarAttempt => ({ week, method, consented: false, closed: false, result: 'NONE', elapsedSeconds: 0, ownerTravelMetres: 0, boxTravelMetres: 0, recordsRead: false, baselines: [], analysisTier: null, boundedSetting: null, linkTier: null, linkRemainingSeconds: 0, linkStopped: false, noteTaken: false, noteDelivered: false, noteReturned: false, loadTriggered: false, loadStopped: false, manualStop: false, fuseId: null, spiritualitySpent: 0, boxChargeSpent: 0, frameChargeSpent: 0, frameDurabilityLost: 0, originalsReturned: false });
export function createArcaneScholarLifeState(): ArcaneScholarLifeState {
  return { workbenchId: 'AL4-WORKBENCH-1', objectIds: ['AL4-BOX-1', 'AL4-FRAME-1'], activeCase: null, ownerNode: 'BENCH_START', note: { id: 'AR3-TEST-NOTE', owner: 'AR3-NELL', custodian: 'AR3-NELL', location: 'OWNER' }, load: { deviceId: 'AL4-PAD-1', handleId: 'AR3-LOAD-HANDLE', status: 'IDLE' }, recyclingBoxId: 'AR3-RECYCLE-BOX', fuses: [], recharges: [], cases: { 'tolerance-map': freshCase(), 'timed-transfer': freshCase(), 'fault-isolation': freshCase() }, reflected: false };
}
/** Returns the existing object, never a copy or a replacement resource pool. */
export function findArcaneScholarOriginalCreation(s: SliceState, id: ArcaneScholarObjectId): AlchemistCreation | null {
  const old = s.alchemist.life, index = ARCANE_SCHOLAR_OBJECT_IDS.indexOf(id), kit = old.materials[index];
  const matches = old.creations.filter(x => x.id === id), x = matches[0];
  if (matches.length !== 1 || !x || !kit || kit.status !== 'CONSUMED' || x.kind !== (index === 0 ? 'MESSENGER_BOX' : 'GUARD_FRAME') || x.madeBy !== s.runId || x.owner !== 'PLAYER' || x.custodian !== 'PLAYER' || x.source !== kit.source || stableStringify(x.componentIds) !== stableStringify(kit.componentIds) || old.pieceRecords.filter(v => v === id).length !== 1) return null;
  return x;
}
export const hasArcaneScholarLifeLock = (s: SliceState): boolean => Object.values(s.arcaneScholar.life.cases).some(r => r.contactOpen || r.status === 'PREPARED');
export const arcaneScholarInside = hasArcaneScholarLifeLock;
const currentAttempt = (s: SliceState): ArcaneScholarAttempt | null => { const l = s.arcaneScholar.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
function elapse(a: ArcaneScholarAttempt, seconds: number) { a.elapsedSeconds += seconds; if (a.linkRemainingSeconds > 0) { a.linkRemainingSeconds = Math.max(0, a.linkRemainingSeconds - seconds); if (!a.linkRemainingSeconds) a.linkStopped = true; } }
function result(s: SliceState, id: ArcaneScholarCaseId, value: 'ABILITY' | 'ORDINARY') { const r = s.arcaneScholar.life.cases[id]; r.result = value; r.attempts.at(-1)!.result = value; }
const caseCommands = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT', 'READ_RECORDS', 'MEASURE_BASELINE', 'ANALYZE', 'COMPARE_READINGS', 'TAKE_NOTE', 'START_LINK', 'MOVE_NOTE', 'CARRY_NOTE', 'RETURN_NOTE', 'TRIGGER_LOAD', 'STOP_LOAD', 'MANUAL_STOP', 'STOP_LINK', 'RECYCLE_FUSE', 'RETURN_ORIGINALS'];
export function validateArcaneScholarActivityCommand(v: unknown): v is ArcaneScholarActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (v.type === 'RECHARGE') return shape(v, ['type', 'objectId']) && ARCANE_SCHOLAR_OBJECT_IDS.includes(v.objectId as ArcaneScholarObjectId);
  if (!ARCANE_SCHOLAR_CASE_IDS.includes(v.caseId as ArcaneScholarCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && caseCommands.includes(String(v.type));
}
export const isArcaneScholarActivityCommand = validateArcaneScholarActivityCommand;
export const isArcaneScholarActivity = validateArcaneScholarActivityCommand;
function pair(s: SliceState) { return ARCANE_SCHOLAR_OBJECT_IDS.map(id => findArcaneScholarOriginalCreation(s, id)); }
function linkBlock(s: SliceState, a: ArcaneScholarAttempt): string | null {
  if (a.method !== 'ABILITY' || a.linkTier !== null) return '本次须选择能力方法且尚未尝试协同；失败不能重骰。';
  const [box, frame] = pair(s);
  if (!box || !frame || box.location !== 'BENCH_START' || frame.location !== 'GUARD_MARK' || box.active || frame.active || box.durability <= 0 || frame.durability <= 0 || box.charge < 1 || frame.charge < 1) return '须眼前两件真实原物均完好、停止旧赋灵且各有1储能；可普通完成或退出。';
  return s.spirituality < 5 ? '协同须5灵性，原物储能各1；普通路径仍可用。' : null;
}
function cleanupBlock(s: SliceState, id: ArcaneScholarCaseId): string | null {
  const l = s.arcaneScholar.life, r = l.cases[id], a = r.attempts.at(-1);
  if (!r.contactOpen || !a) return '没有本项尚未结束的原现场。';
  if (a.linkRemainingSeconds > 0 || l.load.status === 'RUNNING') return '先明确停止协同窗口或用原手柄停止负载。';
  if (l.note.location !== 'OWNER') return '先把同一原测试纸亲手还给内尔。';
  if (a.fuseId && l.fuses.find(f => f.id === a.fuseId)?.location !== 'RECYCLING_BOX') return '先拆下本次原熔片，放入原回收盒。';
  if (!a.originalsReturned || !r.returned || pair(s).some(x => !x || x.location !== 'PLAYER' || x.active) || l.ownerNode !== 'BENCH_START') return '先沿普通原路亲手取回两件原物；退出不能搬动物品。';
  return null;
}
export function blockArcaneScholarActivity(s: SliceState, c: ArcaneScholarActivityCommand): string | null {
  if (!validateArcaneScholarActivityCommand(c)) return '奥秘学者生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已成为奥秘学者候选序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原工坊。';
  if (['READY', 'FIGHTING'].includes(s.arcaneScholar.encounter.status)) return '先沿原出口结束工院遭遇。';
  const l = s.arcaneScholar.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return cleanupBlock(s, c.caseId);
  const atScene = !!r?.contactOpen && l.activeCase === ('caseId' in c ? c.caseId : null) && !!a && !a.closed;
  if (c.type === 'STOP_LINK') return atScene && a!.linkRemainingSeconds > 0 ? null : '没有本次仍在持续的有限协同窗口。';
  if (c.type === 'MANUAL_STOP') return atScene && c.caseId === 'fault-isolation' && l.load.status === 'RUNNING' ? null : '没有本次正在运行的原低载荷装置。';
  if (c.type === 'RETURN_NOTE') return atScene && c.caseId === 'timed-transfer' && a!.noteTaken && !a!.noteReturned && a!.linkRemainingSeconds === 0 ? null : '须已借同一原纸，先停止协同，再本人取还。';
  if (c.type === 'RECYCLE_FUSE') return atScene && !!a!.fuseId && l.load.status !== 'RUNNING' && a!.linkRemainingSeconds === 0 && l.fuses.find(f => f.id === a!.fuseId)?.location === 'LOAD_DEVICE' ? null : '先停止原装置与协同，再拆下本次仍装在原位的熔片。';
  if (c.type === 'RETURN_ORIGINALS') return !atScene || a!.originalsReturned ? '没有本次尚待取回的两原件。' : a!.linkRemainingSeconds > 0 || l.load.status === 'RUNNING' || l.note.location !== 'OWNER' || a!.fuseId && l.fuses.find(f => f.id === a!.fuseId)?.location !== 'RECYCLING_BOX' ? '先停止、归还原纸并拆回原熔片。' : pair(s).some(x => !x || x.active || !['BENCH_START', 'BENCH_END', 'GUARD_MARK'].includes(x.location)) ? '须原工作台两件同一原物已停止。' : null;
  if (s.health <= 0 || s.mind <= 0) return '身体或精神不足；已开始现场的停止、取还和退出仍可0行动完成。';
  if (atScene && a && 'caseId' in c) {
    if (a.originalsReturned) return '原件已取回，须结束现场；不能重新放回重做。';
    if (c.type === 'CONSENT') return c.caseId !== 'tolerance-map' && !a.consented ? null : '本案无需本次同意或已经取得。';
    if (c.type === 'READ_RECORDS') return c.caseId === 'tolerance-map' && !a.recordsRead ? null : '只能实际阅读本案尚未读过的两份原制造记录。';
    if (c.type === 'MEASURE_BASELINE') return c.caseId === 'tolerance-map' && a.recordsRead && a.baselines.length < 2 ? null : '先读原记录；只做两次不同基准，不空刷。';
    if (c.type === 'ANALYZE') return c.caseId !== 'tolerance-map' || !a.recordsRead || a.baselines.length !== 2 || a.method !== 'ABILITY' || a.analysisTier !== null || a.result !== 'NONE' ? '须本案实际两次基准并选择能力，仅尝试一次。' : s.spirituality < 4 ? '有限解析需要4灵性；可普通比较读数。' : null;
    if (c.type === 'COMPARE_READINGS') return c.caseId === 'tolerance-map' && a.recordsRead && a.baselines.length === 2 && a.result === 'NONE' ? null : '须实际读原记录并取得两次基准；结果只能完成一次。';
    if (c.type === 'TAKE_NOTE') return c.caseId === 'timed-transfer' && a.consented && !a.noteTaken && l.note.custodian === 'AR3-NELL' ? null : '先取得内尔本次同意，原纸只能借一次。';
    if (c.type === 'START_LINK') return c.caseId === 'timed-transfer' && a.noteTaken && !a.noteDelivered && !a.noteReturned ? linkBlock(s, a) : '须借到本次原纸且尚未移送或归还。';
    if (c.type === 'MOVE_NOTE') return c.caseId === 'timed-transfer' && a.noteTaken && !a.noteDelivered && !a.noteReturned && success(a.linkTier) && !a.linkStopped && a.linkRemainingSeconds >= 8 && l.note.location === 'BENCH_START' ? null : '须有本次已付费成功协同窗口，且同纸仍在起点。';
    if (c.type === 'CARRY_NOTE') return c.caseId === 'timed-transfer' && a.noteTaken && !a.noteDelivered && !a.noteReturned && a.linkRemainingSeconds === 0 ? null : '先停止协同，本人可将尚未送达的同纸普通步行2米。';
    if (c.type === 'TRIGGER_LOAD') return c.caseId === 'fault-isolation' && a.consented && !a.loadTriggered && l.load.status === 'ARMED' ? null : '须本次知情同意且原熔片已装好；只能触发一次。';
    if (c.type === 'STOP_LOAD') return c.caseId === 'fault-isolation' && a.loadTriggered && !a.loadStopped && l.load.status === 'RUNNING' ? linkBlock(s, a) : '先明确触发本次原低载荷失配。';
    return '当前现场须按可见原物完成步骤，或0行动退出。';
  }
  if (hasArcaneScholarLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消已付准备，或收束当前原现场。';
  if (c.type === 'RECHARGE') { const x = findArcaneScholarOriginalCreation(s, c.objectId); return !x || x.location !== 'PLAYER' || x.active || x.durability <= 0 ? '须本人持有已停止且未损坏的同一原件；不能复活坏件。' : x.charge >= 3 ? '储能已满3次，不重复购买耗材。' : s.actionsRemaining < 1 || s.cash < 40 || s.spirituality < 3 ? '补能需要1行动、40便士和3灵性；不修耐久。' : null; }
  if (c.type === 'REFLECT') return l.reflected ? '已经反思，不能重复成长。' : ARCANE_SCHOLAR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : s.actionsRemaining < 1 ? '反思需要1行动。' : null;
  if (!r || !('caseId' in c)) return '未知原研究。';
  const index = ARCANE_SCHOLAR_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[ARCANE_SCHOLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一案的实际报告。';
  if (s.actionsRemaining < 1) return '本步骤需要1行动；已有准备可0行动取消。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已经观察本案，不重复花行动。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原现场。' : s.actionsRemaining < 2 ? '准备须至少余2行动，为真正实施留1行动。' : r.attempts.at(-1)?.week === s.week ? '本周已经实际尝试；下一真实周才可重新准备。' : null;
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' ? '先准备本案。' : pair(s).some(x => !x || x.location !== 'PLAYER' || x.active) ? '须实际随身持有已停止的两件本人原成品；不能复制或凭空取回。' : c.caseId === 'fault-isolation' && s.cash < 20 ? '本次须20便士购入并装上独立原熔片；可0行动取消。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先完成真实用途、停止取还并结束现场。';
  return '此步骤仅在本案原现场内可用。';
}
export const blockArcaneScholarLife = blockArcaneScholarActivity;
export function applyArcaneScholarActivity(s: SliceState, c: ArcaneScholarActivityCommand, ctx: SeerContext): void {
  const reason = blockArcaneScholarActivity(s, c); if (reason) throw new Error(reason);
  const l = s.arcaneScholar.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  const [box, frame] = pair(s);
  if (c.type === 'WITHDRAW' && r!.status === 'PREPARED') { r!.status = 'OBSERVED'; r!.method = null; r!.withdrawals++; ctx.note('取消尚未实施的研究准备', '已花准备行动保留；原件仍随身，未借纸、未购熔片、未补能。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a!.closed = true; r!.contactOpen = false; r!.closes++; if (c.type === 'WITHDRAW') r!.withdrawals++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; l.load.status = 'IDLE'; ctx.note('沿普通出口结束原工坊研究', '本人已停止并亲手取还原物；成本、读数和失败保留，没有瞬移、退款或原地重骰。'); return; }
  if (c.type === 'STOP_LINK') { elapse(a!, 2); a!.linkRemainingSeconds = 0; a!.linkStopped = true; ctx.note('明确停止已付费有限协同', '2秒内解除这两件原物间的本次协调；已付5灵性与各1储能保留，不重赋旧序列4生命。'); return; }
  if (c.type === 'MANUAL_STOP') { elapse(a!, 2); a!.loadStopped = true; a!.manualStop = true; a!.linkRemainingSeconds = 0; if (a!.linkTier !== null) a!.linkStopped = true; l.load.status = 'STOPPED'; result(s, c.caseId, 'ORDINARY'); ctx.note('用眼前原手柄普通停止', '本人在原台旁2秒内拉下AR3-LOAD-HANDLE，原低载荷装置真实停下，不检验、不耗灵性、不补储能。已有原架耐久损失与20便士原熔片消耗保留。'); return; }
  if (c.type === 'RETURN_NOTE') {
    const travel = l.note.location === 'BENCH_END' ? l.ownerNode === 'BENCH_START' ? 4 : 2 : 0;
    a!.ownerTravelMetres += travel; elapse(a!, travel * 2 + 2); l.ownerNode = 'BENCH_START'; l.note.custodian = 'AR3-NELL'; l.note.location = 'OWNER'; a!.noteReturned = true;
    ctx.note('本人取回并归还唯一原测试纸', `本人普通步行${travel}米，亲手把AR3-TEST-NOTE交回起点原主人内尔；纸未复制，原盒仍留在它实际到达的位置。`); return;
  }
  if (c.type === 'RECYCLE_FUSE') { const fuse = l.fuses.find(f => f.id === a!.fuseId)!; fuse.location = 'RECYCLING_BOX'; elapse(a!, 4); ctx.note('拆下同一原熔片入原回收盒', `4秒拆下${fuse.id}放入AR3-RECYCLE-BOX；${fuse.consumed ? '本次已消耗熔片不能再用' : '未触发的已购原熔片也实物收存，不能变出退款'}，20便士成本保留。`); return; }
  if (c.type === 'RETURN_ORIGINALS') {
    const travel = box!.location === 'BENCH_END' ? 4 : 2; a!.ownerTravelMetres += travel; elapse(a!, travel * 2 + 4);
    box!.location = 'PLAYER'; frame!.location = 'PLAYER'; l.ownerNode = 'BENCH_START'; a!.originalsReturned = true; r!.returned = true;
    ctx.note('本人沿原路取回两件原成品', `本人实际步行${travel}米把AL4-BOX-1与AL4-FRAME-1取回随身；原储能${box!.charge}/${frame!.charge}、原耐久${box!.durability}/${frame!.durability}均不变，没有复制或自动补能。`); return;
  }
  if (c.type === 'CONSENT') { a!.consented = true; elapse(a!, 2); ctx.note('内尔确认本次有限研究', `38岁原内尔AR3-NELL明确同意本次${c.caseId === 'timed-transfer' ? '借用并归还唯一原测试纸，进行原台2米移送' : '提前告知的低载荷机械失配与停止演示'}；同意只记在这次现场，不沿用旧海伦娜许可。`); return; }
  if (c.type === 'READ_RECORDS') { a!.recordsRead = true; elapse(a!, 12); ctx.note('实际阅读两份既有制造记录', `本人用12秒核对原记录：${box!.id}由${box!.componentIds.join('、')}装配，制造周${box!.manufacturedWeek}；${frame!.id}由${frame!.componentIds.join('、')}装配，制造周${frame!.manufacturedWeek}。制造者均为本人${s.runId}；没有读到隐藏真相。`); return; }
  if (c.type === 'MEASURE_BASELINE') {
    const first = a!.baselines.length === 0; a!.baselines.push({ sample: first ? 1 : 2, boxTravelMetres: 4, transferSeconds: first ? 8 : 9, openingMm: first ? 18 : 17 });
    a!.ownerTravelMetres += 4; a!.boxTravelMetres += 4; elapse(a!, first ? 18 : 20);
    ctx.note(`第${a!.baselines.length}次真实普通基准`, `本人手推同一惰性原盒到2米终点并带回起点，来回共4米；${first ? '移送8秒、原架开口18毫米' : '移送9秒、原架开口17毫米'}（原创G可见测量）。原架仍在一米标记，0灵性、0储能，无能力检验。`); return;
  }
  if (c.type === 'ANALYZE') { s.spirituality -= 4; a!.spiritualitySpent += 4; a!.analysisTier = ctx.check('knowledge', 16).tier; elapse(a!, 6); if (success(a!.analysisTier)) { a!.boundedSetting = SETTING; result(s, c.caseId, 'ABILITY'); } ctx.note('只分析已读原记录与两次可见数据', success(a!.analysisTier) ? `4灵性已付；${SETTING}有限设置来自这次实际对比，不制造新物或新知识。` : '4灵性与本次失败保留；没有得到可靠新设置。可普通比较两次已见读数，或取回退出，不能本次重骰。'); return; }
  if (c.type === 'COMPARE_READINGS') { elapse(a!, 6); result(s, c.caseId, 'ORDINARY'); ctx.note('普通比较两次实际基准', '本人比较8/9秒与18/17毫米原读数，认出有限偏差；0灵性，无额外检验，不授予能力设置或能力掌握。'); return; }
  if (c.type === 'TAKE_NOTE') { l.note.custodian = 'PLAYER'; l.note.location = 'BENCH_START'; a!.noteTaken = true; elapse(a!, 2); ctx.note('亲手借到这一张原测试纸', '内尔在原起点把AR3-TEST-NOTE交到本人手中；原盒与原架仍是旧两件实物，旧包裹和旧黄铜片仍归海伦娜。'); return; }
  if (c.type === 'START_LINK' || c.type === 'STOP_LOAD') {
    s.spirituality -= 5; box!.charge--; frame!.charge--; a!.spiritualitySpent += 5; a!.boxChargeSpent = 1; a!.frameChargeSpent = 1;
    a!.linkTier = ctx.check('knowledge', 18).tier;
    if (success(a!.linkTier)) { a!.linkRemainingSeconds = 30; a!.linkStopped = false; if (c.type === 'STOP_LOAD') { a!.loadStopped = true; l.load.status = 'STOPPED'; result(s, c.caseId, 'ABILITY'); } }
    else if (c.type === 'STOP_LOAD') { const loss = Math.min(5, frame!.durability); frame!.durability -= loss; a!.frameDurabilityLost = loss; }
    elapse(a!, c.type === 'STOP_LOAD' ? 5 : 2);
    ctx.note(c.type === 'STOP_LOAD' ? '尝试以原两件协同停止已触发负载' : '建立两原件的一次有限协同窗口', success(a!.linkTier) ? `5灵性、两件各1储能已真实消耗；${c.type === 'STOP_LOAD' ? '原盒作短程顶持、原架卸载，5秒内原装置确实停止。' : '已付30秒/6米窗口成立，仍须明确移送同纸2米。'}这不是重置旧4赋灵；原储能现${box!.charge}/${frame!.charge}，没有第二行动者。` : `5灵性及各1储能照耗，协调失败；${c.type === 'STOP_LOAD' ? `原架真实耐久−${a!.frameDurabilityLost}，原熔片已消耗，仍须用原手柄0行动停止。` : '可本人普通持纸2米送达。'}本次不能再次尝试，不退款。`); return;
  }
  if (c.type === 'MOVE_NOTE') { l.note.custodian = 'AL4-BOX-1'; l.note.location = 'BENCH_END'; box!.location = 'BENCH_END'; a!.boxTravelMetres += 2; a!.noteDelivered = true; elapse(a!, 8); result(s, c.caseId, 'ABILITY'); ctx.note('同一原盒实际移送原纸2米', '8秒内原盒从BENCH_START沿原台走到BENCH_END，带同一AR3-TEST-NOTE；原护架留在GUARD_MARK同步支撑原开口。此次用途已付各1储能，不二次收费、不生成队友；须明确停止并由本人取还。'); return; }
  if (c.type === 'CARRY_NOTE') { l.note.custodian = 'PLAYER'; l.note.location = 'BENCH_END'; l.ownerNode = 'BENCH_END'; a!.ownerTravelMetres += 2; a!.noteDelivered = true; elapse(a!, 4); result(s, c.caseId, 'ORDINARY'); ctx.note('本人普通持原纸走到2米终点', '本人用4秒手持同一测试纸沿普通原台走2米到终点；原盒仍在起点、原架仍在标记，不给能力掌握。仍须持同纸走回并归还内尔。'); return; }
  if (c.type === 'TRIGGER_LOAD') { a!.loadTriggered = true; l.load.status = 'RUNNING'; l.fuses.find(f => f.id === a!.fuseId)!.consumed = true; elapse(a!, 2); ctx.note('明确触发已知原机械低载荷失配', '本人2秒内在原限位装置触发一次事先公示的低载荷，原20便士熔片真实耗用。内尔在负载之外；现在须能力停止或0行动拉原手柄，不能把尚未发生的失配当已研究。'); return; }
  s.actionsRemaining--;
  if (c.type === 'RECHARGE') {
    const x = findArcaneScholarOriginalCreation(s, c.objectId)!, n = l.recharges.length + 1;
    l.recharges.push({ id: `AR3-RECHARGE-${n}`, materialId: `AR3-CHARGE-MATERIAL-${n}`, source: '原创G：原工坊本次实际交付并用尽的40便士补能耗材，只进入指定同一原件。', objectId: x.id, week: s.week, paidPennies: 40, spiritualitySpent: 3, previousCharge: x.charge, resultingCharge: 3, durabilityBefore: x.durability, durabilityAfter: x.durability, materialConsumed: true });
    s.cash -= 40; s.spirituality -= 3; x.charge = 3;
    ctx.note('为同一原件付费补有限储能', `1行动、40便士和3灵性已付，AR3-CHARGE-MATERIAL-${n}实际耗尽；${x.id}储能至3、耐久仍${x.durability}，旧赋灵仍停止。不是修复或坏件复活。`); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('有限知识与原物责任', '三案报告与真实归还已完成，反思扮演+25。只有已读结构与有限两件原物，不把推定编号或原创G当原著完整能力。'); return; }
  if (!('caseId' in c)) throw new Error('研究事项缺失。');
  const p = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; ctx.note(p.title, `已花1行动准备${c.method === 'ABILITY' ? '一次有限能力研究，失败可普通完成' : '普通实物研究，不抽能力骰'}，另留1行动真正实施；尚未部署、借纸、购熔片或补能。`); return; }
  if (c.type === 'REPORT') { r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r!.result === 'ABILITY') { const id = c.caseId === 'tolerance-map' ? ANALYSIS_ID : LINK_ID; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(p.title, `实际研究、停止、取还与退出已核实，报告扮演+25。${r!.result === 'ABILITY' ? '本次成功对应的新能力掌握+8，不抽旧能力池。' : '普通完成不加能力掌握。'}`); return; }
  const next = freshAttempt(s.week, r!.method!); r!.attempts.push(next); r!.status = 'ACTIVE'; r!.contactOpen = true; r!.returned = false; r!.result = 'NONE'; l.activeCase = c.caseId; l.ownerNode = 'BENCH_START'; box!.location = 'BENCH_START'; frame!.location = 'GUARD_MARK';
  if (c.caseId === 'fault-isolation') { const id = `AR3-FUSE-${l.fuses.length + 1}`; s.cash -= 20; l.fuses.push({ id, source: '原创G：原工坊本次实际交付的20便士低载荷熔片，装入既有AL4-PAD-1；不是赠送储能或修理件。', paidPennies: 20, week: s.week, attempt: r!.attempts.length, consumed: false, location: 'LOAD_DEVICE' }); next.fuseId = id; l.load.status = 'ARMED'; }
  elapse(next, 6); ctx.note(p.title, `实施1行动已付，本人用6秒把同一原盒放BENCH_START、原架放GUARD_MARK。${c.caseId === 'fault-isolation' ? '另付20便士原熔片已实际装上，但未触发负载；须先确认本次同意。' : '尚未使用能力、取得新知识或借原纸。'}资源仍属于旧两原件唯一份额，可0行动收束退出。`);
}
export function arcaneScholarLifeActions(s: SliceState): ArcaneScholarLifeAction[] {
  if (!promoted(s)) return [];
  const out: ArcaneScholarLifeAction[] = [], l = s.arcaneScholar.life;
  const add = (label: string, cost: string, command: ArcaneScholarActivityCommand) => { const reason = blockArcaneScholarActivity(s, command); out.push({ id: `arcane-scholar-${command.type}${'caseId' in command ? `-${command.caseId}` : ''}${'method' in command ? `-${command.method}` : ''}${'objectId' in command ? `-${command.objectId}` : ''}`, label, cost, enabled: reason === null, reason, command }); };
  for (const p of CASES) {
    const r = l.cases[p.id], a = r.attempts.at(-1), caseId = p.id;
    if (r.contactOpen && a) {
      if (caseId !== 'tolerance-map' && !a.consented) add('询问内尔本次明确同意', '0行动 · 2秒 · 仅本次', { type: 'CONSENT', caseId });
      if (caseId === 'tolerance-map') {
        if (!a.recordsRead) add('实际阅读两份原制造记录', '0行动 · 12秒', { type: 'READ_RECORDS', caseId });
        if (a.baselines.length < 2) add(`实际做第${a.baselines.length + 1}次普通基准`, '0行动 · 原盒2米往返 · 18/20秒', { type: 'MEASURE_BASELINE', caseId });
        if (a.analysisTier === null && a.method === 'ABILITY' && a.result === 'NONE') add('仅分析这两次原读数', '0行动 · 6秒 · 4灵性 · 知识16 · 一次', { type: 'ANALYZE', caseId });
        if (a.result === 'NONE') add('普通比较已有两次读数', '0行动 · 6秒 · 无重骰', { type: 'COMPARE_READINGS', caseId });
      }
      if (caseId === 'timed-transfer') {
        if (!a.noteTaken) add('本人借唯一原测试纸', '0行动 · 2秒 · 本次同意', { type: 'TAKE_NOTE', caseId });
        if (a.linkTier === null && a.method === 'ABILITY' && !a.noteDelivered && !a.noteReturned) add('启动两原件有限协同', '0行动 · 5灵性 · 原件各1储能 · 知识18', { type: 'START_LINK', caseId });
        if (!a.noteDelivered && !a.noteReturned) { if (success(a.linkTier)) add('原盒实际带原纸移送2米', '0行动 · 8秒 · 原架同步支撑 · 已付窗口', { type: 'MOVE_NOTE', caseId }); add('本人普通持同紙步行2米', '0行动 · 4秒 · 不耗灵性储能', { type: 'CARRY_NOTE', caseId }); }
        if (a.noteTaken && !a.noteReturned) add('本人取回并归还同一原纸', '0行动 · 普通实际往返 · 先停协同', { type: 'RETURN_NOTE', caseId });
      }
      if (caseId === 'fault-isolation') {
        if (!a.loadTriggered) add('明确触发已知低载荷失配', '0行动 · 2秒 · 原20便士熔片消耗', { type: 'TRIGGER_LOAD', caseId });
        if (a.loadTriggered && !a.loadStopped) { if (a.linkTier === null && a.method === 'ABILITY') add('双原件协同停止本次负载', '0行动 · 5秒 · 5灵性 · 各1储能 · 知识18', { type: 'STOP_LOAD', caseId }); add('立即拉原手柄普通停止', '0行动 · 2秒 · 不检验、不耗灵性', { type: 'MANUAL_STOP', caseId }); }
        if (l.fuses.find(f => f.id === a.fuseId)?.location === 'LOAD_DEVICE') add('拆下本次原熔片入回收盒', '0行动 · 4秒 · 先停止', { type: 'RECYCLE_FUSE', caseId });
      }
      if (a.linkRemainingSeconds > 0) add('明确停止本次有限协同', '0行动 · 2秒 · 不退款', { type: 'STOP_LINK', caseId });
      if (!a.originalsReturned) add('本人实际取回两件原物', '0行动 · 沿原路 · 不补储能或耐久', { type: 'RETURN_ORIGINALS', caseId });
      add('结束本次原工坊现场', '0行动 · 先停止取还', { type: 'CLOSE', caseId });
      add('退出并保留本次成本', '0行动 · 先停止取还 · 无原地重骰', { type: 'WITHDRAW', caseId });
    } else if (r.status === 'AVAILABLE') add(`观察：${p.title}`, '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') { add('准备一次有限能力研究', '1行动 · 至少余2行动', { type: 'PREPARE', caseId, method: 'ABILITY' }); add('准备普通实物研究', '1行动 · 至少余2行动', { type: 'PREPARE', caseId, method: 'ORDINARY' }); }
    else if (r.status === 'PREPARED') { add('实际进入原现场部署两原件', `1行动 · 6秒${caseId === 'fault-isolation' ? ' · 20便士原熔片' : ''}`, { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 准备成本保留', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告实际结果与原物归还', '1行动 · 扮演25', { type: 'REPORT', caseId });
  }
  if (!l.reflected) add('反思三次有限研究', '1行动 · 扮演25', { type: 'REFLECT' });
  for (const objectId of ARCANE_SCHOLAR_OBJECT_IDS) if (findArcaneScholarOriginalCreation(s, objectId)) add(`付费补能同一${objectId === 'AL4-BOX-1' ? '原盒' : '原护架'}`, '1行动 · 40便士 · 3灵性 · 不修耐久', { type: 'RECHARGE', objectId });
  return out;
}
export function projectArcaneScholarLife(s: SliceState): ArcaneScholarLifeProjection {
  const l = s.arcaneScholar.life;
  return { title: '原记录、有限解析与双件协同（原创G）', source: ARCANE_SCHOLAR_LIFE_SOURCE, environment: ARCANE_SCHOLAR_LIFE_ENVIRONMENT, insideCase: hasArcaneScholarLifeLock(s), reflected: l.reflected, workbenchId: l.workbenchId, ownerNode: l.ownerNode,
    creations: structuredClone(l.objectIds.flatMap(id => { const x = findArcaneScholarOriginalCreation(s, id); return x ? [x] : []; })), note: { ...l.note }, load: { ...l.load }, fuses: structuredClone(l.fuses), recharges: structuredClone(l.recharges), currentAttempt: structuredClone(currentAttempt(s)), activeCase: l.activeCase,
    cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], status: r.status, method: r.method, result: r.result === 'NONE' ? null : `${r.result === 'ABILITY' ? '本次对应有限能力实际成功' : '普通实际完成'}；${r.returned ? '两原件已取回' : '还须停止取还'}。`, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: arcaneScholarLifeActions(s) };
}
function validAttempt(a: ArcaneScholarAttempt, id: ArcaneScholarCaseId, promotion: number, week: number): boolean {
  if (!record(a) || !shape(a, Object.keys(freshAttempt(0, 'ORDINARY'))) || !integer(a.week, promotion, week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result)) return false;
  for (const key of ['consented', 'closed', 'recordsRead', 'linkStopped', 'noteTaken', 'noteDelivered', 'noteReturned', 'loadTriggered', 'loadStopped', 'manualStop', 'originalsReturned'] as const) if (typeof a[key] !== 'boolean') return false;
  if (![a.elapsedSeconds, a.ownerTravelMetres, a.boxTravelMetres, a.spiritualitySpent, a.boxChargeSpent, a.frameChargeSpent, a.frameDurabilityLost].every(v => integer(v)) || !integer(a.linkRemainingSeconds, 0, 30) || !Array.isArray(a.baselines) || a.baselines.length > 2) return false;
  if ([a.analysisTier, a.linkTier].some(t => t !== null && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(t))) return false;
  if (a.elapsedSeconds < 6 || a.elapsedSeconds > 120 || a.ownerTravelMetres > 16 || a.boxTravelMetres > 8) return false;
  for (let i = 0; i < a.baselines.length; i++) { const b = a.baselines[i]; if (!b || !shape(b, ['sample', 'boxTravelMetres', 'transferSeconds', 'openingMm']) || b.sample !== i + 1 || b.boxTravelMetres !== 4 || b.transferSeconds !== (i === 0 ? 8 : 9) || b.openingMm !== (i === 0 ? 18 : 17)) return false; }
  if (a.method === 'ORDINARY' && (a.analysisTier !== null || a.linkTier !== null || a.result === 'ABILITY')) return false;
  if (a.spiritualitySpent !== (a.analysisTier === null ? 0 : 4) + (a.linkTier === null ? 0 : 5) || a.boxChargeSpent !== (a.linkTier === null ? 0 : 1) || a.frameChargeSpent !== a.boxChargeSpent) return false;
  if (a.linkRemainingSeconds > 0 && (!success(a.linkTier) || a.linkStopped || a.closed || a.originalsReturned)) return false;
  if (a.linkStopped && !success(a.linkTier) && !a.manualStop) return false;
  if (a.closed && (!a.originalsReturned || a.linkRemainingSeconds > 0)) return false;
  if (a.noteReturned && !a.noteTaken || a.noteDelivered && !a.noteTaken || a.noteTaken && !a.consented || a.loadTriggered && !a.consented || a.loadStopped && !a.loadTriggered || a.manualStop && !a.loadStopped) return false;
  if (id === 'tolerance-map') {
    if (a.consented || a.linkTier !== null || a.noteTaken || a.noteDelivered || a.noteReturned || a.loadTriggered || a.loadStopped || a.manualStop || a.fuseId !== null || a.frameDurabilityLost !== 0) return false;
    if (a.baselines.length > 0 && !a.recordsRead || a.analysisTier !== null && a.baselines.length !== 2 || a.boxTravelMetres !== a.baselines.length * 4) return false;
    if (a.boundedSetting !== (success(a.analysisTier) ? SETTING : null) || a.result === 'ABILITY' !== success(a.analysisTier)) return false;
    if (a.result !== 'NONE' && (!a.recordsRead || a.baselines.length !== 2)) return false;
  } else {
    if (a.recordsRead || a.baselines.length || a.analysisTier !== null || a.boundedSetting !== null) return false;
    if (id === 'timed-transfer') {
      if (a.loadTriggered || a.loadStopped || a.manualStop || a.fuseId !== null || a.frameDurabilityLost !== 0 || a.boxTravelMetres !== (a.result === 'ABILITY' ? 2 : 0)) return false;
      if (a.linkTier !== null && !a.noteTaken || (a.result !== 'NONE') !== a.noteDelivered || a.result === 'ABILITY' && !success(a.linkTier) || a.originalsReturned && a.noteTaken && !a.noteReturned) return false;
    } else {
      if (a.noteTaken || a.noteDelivered || a.noteReturned || typeof a.fuseId !== 'string' || a.boxTravelMetres !== 0) return false;
      if (a.linkTier !== null && !a.loadTriggered || (a.result !== 'NONE') !== a.loadStopped || a.result === 'ABILITY' && (!success(a.linkTier) || a.manualStop) || a.result === 'ORDINARY' && !a.manualStop) return false;
      const failed = a.linkTier !== null && !success(a.linkTier); if (failed ? !integer(a.frameDurabilityLost, 1, 5) : a.frameDurabilityLost !== 0) return false;
      if (a.originalsReturned && a.loadTriggered && !a.loadStopped) return false;
    }
  }
  return true;
}
export function validateArcaneScholarLife(s: SliceState): boolean {
  const l = s.arcaneScholar?.life, fresh = createArcaneScholarLifeState();
  if (!record(l) || !shape(l, Object.keys(fresh)) || !record(l.cases) || !shape(l.cases, ARCANE_SCHOLAR_CASE_IDS) || !record(l.note) || !record(l.load) || !Array.isArray(l.fuses) || !Array.isArray(l.recharges) || typeof l.reflected !== 'boolean' || l.workbenchId !== fresh.workbenchId || l.recyclingBoxId !== fresh.recyclingBoxId || stableStringify(l.objectIds) !== stableStringify(fresh.objectIds)) return false;
  if (!promoted(s) && !(s.progression.pathwayId==='paragon'&&(s.progression.sequence===2||s.progression.sequence===1))) return stableStringify(l) === stableStringify(fresh);
  const promotion = s.arcaneScholar.promotionWeek; if (promotion === null || !integer(promotion, 0, s.week)) return false;
  if (!['BENCH_START', 'BENCH_END'].includes(l.ownerNode) || l.activeCase !== null && !ARCANE_SCHOLAR_CASE_IDS.includes(l.activeCase)) return false;
  if (!shape(l.note, Object.keys(fresh.note)) || l.note.id !== 'AR3-TEST-NOTE' || l.note.owner !== 'AR3-NELL' || !['AR3-NELL', 'PLAYER', 'AL4-BOX-1'].includes(l.note.custodian) || !['OWNER', 'BENCH_START', 'BENCH_END'].includes(l.note.location) || (l.note.custodian === 'AR3-NELL') !== (l.note.location === 'OWNER')) return false;
  if (!shape(l.load, Object.keys(fresh.load)) || l.load.deviceId !== 'AL4-PAD-1' || l.load.handleId !== 'AR3-LOAD-HANDLE' || !['IDLE', 'ARMED', 'RUNNING', 'STOPPED'].includes(l.load.status)) return false;
  let open = 0, prepared = 0;
  for (const id of ARCANE_SCHOLAR_CASE_IDS) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !Array.isArray(r.attempts) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || r.observedWeek !== null && !integer(r.observedWeek, promotion, s.week)) return false;
    if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(freshCase())) return false;
    if (r.status !== 'AVAILABLE' && r.observedWeek === null) return false;
    const previous = ARCANE_SCHOLAR_CASE_IDS.indexOf(id) - 1; if (r.status !== 'AVAILABLE' && previous >= 0 && l.cases[ARCANE_SCHOLAR_CASE_IDS[previous]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') prepared++;
    if (r.contactOpen) { open++; if (l.activeCase !== id || r.status !== 'ACTIVE') return false; } else if (r.status === 'ACTIVE') return false;
    if (['PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) && r.method === null) return false;
    for (let i = 0; i < r.attempts.length; i++) { const a = r.attempts[i]!; if (!validAttempt(a, id, promotion, s.week) || a.week < r.observedWeek! || i > 0 && a.week <= r.attempts[i - 1]!.week || i < r.attempts.length - 1 && !a.closed || a.closed !== (i < r.attempts.length - 1 || !r.contactOpen)) return false; }
    const a = r.attempts.at(-1);
    if (r.closes !== r.attempts.filter(v => v.closed).length || a && (r.returned !== a.originalsReturned || r.result !== a.result) || !a && (r.returned || r.result !== 'NONE')) return false;
    if (r.contactOpen && (!a || a.method !== r.method)) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!a?.closed || !r.returned || r.result === 'NONE')) return false;
    if (r.status === 'OBSERVED' && a && !a.closed) return false;
  }
  if (open > 1 || prepared > 1 || open + prepared > 1 || (l.activeCase === null) !== (open === 0) || l.reflected && ARCANE_SCHOLAR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED')) return false;
  const a = currentAttempt(s), [box, frame] = pair(s);
  if (a) {
    if (!box || !frame || box.active || frame.active) return false;
    if (a.originalsReturned ? box.location !== 'PLAYER' || frame.location !== 'PLAYER' : box.location !== (l.activeCase === 'timed-transfer' && a.result === 'ABILITY' ? 'BENCH_END' : 'BENCH_START') || frame.location !== 'GUARD_MARK') return false;
    if (l.activeCase === 'timed-transfer') {
      if (!a.noteTaken || a.noteReturned) { if (l.note.location !== 'OWNER') return false; }
      else if (l.note.location !== (a.noteDelivered ? 'BENCH_END' : 'BENCH_START') || l.note.custodian !== (a.result === 'ABILITY' ? 'AL4-BOX-1' : 'PLAYER')) return false;
      if (l.ownerNode !== (a.result === 'ORDINARY' && !a.noteReturned ? 'BENCH_END' : 'BENCH_START')) return false;
    } else if (l.note.location !== 'OWNER' || l.ownerNode !== 'BENCH_START') return false;
    if (l.load.status !== (l.activeCase !== 'fault-isolation' ? 'IDLE' : a.loadStopped ? 'STOPPED' : a.loadTriggered ? 'RUNNING' : 'ARMED')) return false;
  } else if (l.note.location !== 'OWNER' || l.ownerNode !== 'BENCH_START' || l.load.status !== 'IDLE') return false;
  const faults = l.cases['fault-isolation'].attempts; if (l.fuses.length !== faults.length) return false;
  for (let i = 0; i < l.fuses.length; i++) {
    const f = l.fuses[i]!, attempt = faults[i]!;
    if (!record(f) || !shape(f, ['id', 'source', 'paidPennies', 'week', 'attempt', 'consumed', 'location']) || f.id !== `AR3-FUSE-${i + 1}` || f.source !== '原创G：原工坊本次实际交付的20便士低载荷熔片，装入既有AL4-PAD-1；不是赠送储能或修理件。' || f.paidPennies !== 20 || f.week !== attempt.week || f.attempt !== i + 1 || f.consumed !== attempt.loadTriggered || !['LOAD_DEVICE', 'RECYCLING_BOX'].includes(f.location) || attempt.fuseId !== f.id || attempt.originalsReturned && f.location !== 'RECYCLING_BOX') return false;
  }
  for (let i = 0; i < l.recharges.length; i++) {
    const e = l.recharges[i]!;
    if (!record(e) || !shape(e, ['id', 'materialId', 'source', 'objectId', 'week', 'paidPennies', 'spiritualitySpent', 'previousCharge', 'resultingCharge', 'durabilityBefore', 'durabilityAfter', 'materialConsumed']) || e.id !== `AR3-RECHARGE-${i + 1}` || e.materialId !== `AR3-CHARGE-MATERIAL-${i + 1}` || e.source !== '原创G：原工坊本次实际交付并用尽的40便士补能耗材，只进入指定同一原件。' || !ARCANE_SCHOLAR_OBJECT_IDS.includes(e.objectId) || !integer(e.week, promotion, s.week) || i > 0 && e.week < l.recharges[i - 1]!.week || e.paidPennies !== 40 || e.spiritualitySpent !== 3 || !integer(e.previousCharge, 0, 2) || e.resultingCharge !== 3 || !integer(e.durabilityBefore, 1, 100) || e.durabilityAfter !== e.durabilityBefore || e.materialConsumed !== true) return false;
  }
  return true;
}
