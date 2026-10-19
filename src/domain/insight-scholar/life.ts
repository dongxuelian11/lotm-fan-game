import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasProphetLifeLock } from '../prophet/life.js';

export const INSIGHT_SCHOLAR_CASE_IDS = ['copy-discrepancy', 'known-method', 'revised-route'] as const;
export type InsightScholarCaseId = typeof INSIGHT_SCHOLAR_CASE_IDS[number];
export type InsightScholarLocation = 'EXIT' | 'DESK' | 'BENCH' | 'JUNCTION' | 'STORE';
export type InsightScholarConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export type InsightScholarHypothesis = 'COPY_ERROR' | 'MISSING_DELIVERY';
export type InsightScholarPrediction = 'LIT' | 'DARK';
export interface InsightScholarAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: InsightScholarConsent; ownerConsentWeek: number | null; recorderConsent: InsightScholarConsent; recorderConsentWeek: number | null;
  readBoth: boolean; compared: boolean; manualCompared: boolean; hypothesis: InsightScholarHypothesis | null; hypothesisHistory: InsightScholarHypothesis[];
  ownerEvidenceRead: boolean; verified: boolean; papersReturned: boolean;
  recordRead: boolean; firstDemoSeen: boolean; secondDemoSeen: boolean; demonstrationsPerformed: number;
  prediction: InsightScholarPrediction | null; observedResult: boolean; revised: boolean; boxReturned: boolean;
  oldRouteRead: boolean; scouted: boolean; route: 'SHORT' | 'SIDE' | null; routeHistory: ('SHORT' | 'SIDE')[];
  shortBlocked: boolean; parcelTaken: boolean; parcelReturned: boolean; inspected: boolean; refused: boolean;
}
export interface InsightScholarCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: InsightScholarAttempt[];
}
export interface InsightScholarLifeState {
  archiveId: 'IS3-ARCHIVE'; activeCase: InsightScholarCaseId | null; playerLocation: InsightScholarLocation; playerTravelMetres: number; clockSeconds: number;
  fenna: { id: 'IS3-FENNA'; name: '芬娜'; age: 42; alive: true; willing: boolean; location: 'EXIT' };
  osric: { id: 'IS3-OSRIC'; name: '奥斯里克'; age: 51; alive: true; willing: boolean; present: boolean; location: 'BENCH' };
  original: { id: 'IS3-ORIGINAL'; owner: 'IS3-FENNA'; location: 'DESK' | 'PLAYER' };
  copy: { id: 'IS3-COPY'; owner: 'IS3-FENNA'; location: 'DESK' | 'PLAYER' };
  box: { id: 'IS3-BOX'; owner: 'IS3-FENNA'; location: 'OWNER' | 'BENCH'; charges: number; selector: 'LIGHT' | 'DARK'; output: InsightScholarPrediction; demonstrations: number };
  routeRecord: { id: 'IS3-ROUTE'; owner: 'IS3-FENNA'; location: 'DESK' };
  barrier: { id: 'IS3-BARRIER'; location: 'JUNCTION'; state: 'CLOSED' };
  parcel: { id: 'IS3-PARCEL'; owner: 'IS3-FENNA'; location: 'STORE' | 'PLAYER' | 'OWNER' };
  cases: Record<InsightScholarCaseId, InsightScholarCaseState>; reflected: boolean;
}
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'RETURN_PLAYER' | 'INSPECT';
type CopyCommand = 'READ_BOTH' | 'COMPARE' | 'MANUAL_COMPARE' | 'ASK_OWNER' | 'VERIFY' | 'RETURN_PAPERS';
type MethodCommand = 'READ_RECORD' | 'CONSENT_RECORDER' | 'DEMONSTRATE_FIRST' | 'ANALYZE' | 'DEMONSTRATE_SECOND' | 'OBSERVE_RESULT' | 'REVISE' | 'RETURN_BOX';
type RouteCommand = 'READ_ROUTE' | 'SCOUT' | 'INFER' | 'TAKE_PARCEL' | 'RETURN_PARCEL';
export type InsightScholarActivityCommand =
  | { type: CommonCommand; caseId: InsightScholarCaseId }
  | { type: CopyCommand; caseId: 'copy-discrepancy' }
  | { type: MethodCommand; caseId: 'known-method' }
  | { type: RouteCommand; caseId: 'revised-route' }
  | { type: 'PREPARE'; caseId: InsightScholarCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'HYPOTHESIZE'; caseId: 'copy-discrepancy'; hypothesis: InsightScholarHypothesis }
  | { type: 'PREDICT'; caseId: 'known-method'; prediction: InsightScholarPrediction }
  | { type: 'CHOOSE_ROUTE'; caseId: 'revised-route'; route: 'SHORT' | 'SIDE' }
  | { type: 'REFLECT' };
export interface InsightScholarLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: InsightScholarActivityCommand }
export interface InsightScholarLifeProjection {
  title: string; story: string; environment: string; activeCase: InsightScholarCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: InsightScholarLocation; playerTravelMetres: number; currentAttempt: InsightScholarAttempt | null;
  fenna: InsightScholarLifeState['fenna']; osric: InsightScholarLifeState['osric']; original: InsightScholarLifeState['original']; copy: InsightScholarLifeState['copy'];
  box: InsightScholarLifeState['box']; routeRecord: InsightScholarLifeState['routeRecord']; barrier: InsightScholarLifeState['barrier']; parcel: InsightScholarLifeState['parcel'];
  cases: { id: InsightScholarCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: InsightScholarAttempt[] }[];
  actions: InsightScholarLifeAction[];
}
export const INSIGHT_SCHOLAR_LIFE_STORY = '洞悉者·阅读者序列3候选（G扩展）。名称与序列对应、新能力和下列三案、人物、物件、数值均未作原著证实。观察、准备、实施、报告各1行动；准备须余2行动。子步0行动但真实耗秒与走路。每案能力仅判定一次，失败普通核对仍可完成；三报告各扮演25，反思25，实际成功对应新掌握8。有限证据关联与方法辨析不读取后台真相，不自动复制或学会新能力。';
const CASES = [
  { id: 'copy-discrepancy', title: 'G · 两张原纸与待证假说', story: '42岁校档员芬娜允许核对她的两张原纸。先亲手取读和比较，写下一个尚未证实的解释，再当面问她查看原交接签注；新证据可修正先前错误，不能把关联当作谁说谎的结论。' },
  { id: 'known-method', title: 'G · 同一示范匣的两次实做', story: '原低强示范匣只有2格储能。取得芬娜与在场51岁记录员奥斯里克本次同意，读原操作记录，亲眼看第一次操作，再预测拨至另一位置后会亮还是暗。必须实际再做、观察并复核；没有补充储能或永久学法。' },
  { id: 'revised-route', title: 'G · 旧路线与眼前封栏', story: '芬娜委托从原库房取回唯一原包。先读旧路线，再亲自到转角察看当下通路；可坚持试短廊，也可据现场证据改走真实6米旁路。原封栏不会因推断打开，原包内容不拆读。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 3;
const freshCase = (): InsightScholarCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', previous?: InsightScholarAttempt): InsightScholarAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, recorderConsent: 'UNASKED', recorderConsentWeek: null,
    readBoth: false, compared: false, manualCompared: false, hypothesis: null, hypothesisHistory: [], ownerEvidenceRead: false, verified: false, papersReturned: false,
    recordRead: false, firstDemoSeen: previous?.firstDemoSeen ?? false, secondDemoSeen: previous?.secondDemoSeen ?? false, demonstrationsPerformed: 0,
    prediction: previous?.prediction ?? null, observedResult: previous?.observedResult ?? false, revised: previous?.revised ?? false, boxReturned: false,
    oldRouteRead: false, scouted: false, route: null, routeHistory: [], shortBlocked: false, parcelTaken: false, parcelReturned: false, inspected: false, refused: false };
}
export function createInsightScholarLifeState(): InsightScholarLifeState {
  return { archiveId: 'IS3-ARCHIVE', activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 0, clockSeconds: 0,
    fenna: { id: 'IS3-FENNA', name: '芬娜', age: 42, alive: true, willing: true, location: 'EXIT' },
    osric: { id: 'IS3-OSRIC', name: '奥斯里克', age: 51, alive: true, willing: true, present: true, location: 'BENCH' },
    original: { id: 'IS3-ORIGINAL', owner: 'IS3-FENNA', location: 'DESK' }, copy: { id: 'IS3-COPY', owner: 'IS3-FENNA', location: 'DESK' },
    box: { id: 'IS3-BOX', owner: 'IS3-FENNA', location: 'OWNER', charges: 2, selector: 'LIGHT', output: 'DARK', demonstrations: 0 },
    routeRecord: { id: 'IS3-ROUTE', owner: 'IS3-FENNA', location: 'DESK' }, barrier: { id: 'IS3-BARRIER', location: 'JUNCTION', state: 'CLOSED' },
    parcel: { id: 'IS3-PARCEL', owner: 'IS3-FENNA', location: 'STORE' }, cases: { 'copy-discrepancy': freshCase(), 'known-method': freshCase(), 'revised-route': freshCase() }, reflected: false };
}
export const hasInsightScholarLifeLock = (s: SliceState): boolean => { const l = s.insightScholar.life; return l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED') || l.playerLocation !== 'EXIT' || l.original.location !== 'DESK' || l.copy.location !== 'DESK' || l.box.location !== 'OWNER' || l.parcel.location === 'PLAYER'; };
export const insightScholarInside = hasInsightScholarLifeLock;
const currentAttempt = (s: SliceState): InsightScholarAttempt | null => { const l = s.insightScholar.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
function elapse(s: SliceState, a: InsightScholarAttempt, seconds: number) { a.elapsedSeconds += seconds; s.insightScholar.life.clockSeconds += seconds; }
function walk(s: SliceState, a: InsightScholarAttempt, to: InsightScholarLocation, metres: number) { const l = s.insightScholar.life; l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres); }
function setResult(s: SliceState, id: InsightScholarCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.insightScholar.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
const COMMON = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'RETURN_PLAYER', 'INSPECT'];
const SPECIFIC: Record<InsightScholarCaseId, readonly string[]> = { 'copy-discrepancy': ['READ_BOTH', 'COMPARE', 'MANUAL_COMPARE', 'ASK_OWNER', 'VERIFY', 'RETURN_PAPERS'], 'known-method': ['READ_RECORD', 'CONSENT_RECORDER', 'DEMONSTRATE_FIRST', 'ANALYZE', 'DEMONSTRATE_SECOND', 'OBSERVE_RESULT', 'REVISE', 'RETURN_BOX'], 'revised-route': ['READ_ROUTE', 'SCOUT', 'INFER', 'TAKE_PARCEL', 'RETURN_PARCEL'] };
export function validateInsightScholarActivityCommand(v: unknown): v is InsightScholarActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!INSIGHT_SCHOLAR_CASE_IDS.includes(v.caseId as InsightScholarCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'HYPOTHESIZE') return v.caseId === 'copy-discrepancy' && shape(v, ['type', 'caseId', 'hypothesis']) && ['COPY_ERROR', 'MISSING_DELIVERY'].includes(String(v.hypothesis));
  if (v.type === 'PREDICT') return v.caseId === 'known-method' && shape(v, ['type', 'caseId', 'prediction']) && ['LIT', 'DARK'].includes(String(v.prediction));
  if (v.type === 'CHOOSE_ROUTE') return v.caseId === 'revised-route' && shape(v, ['type', 'caseId', 'route']) && ['SHORT', 'SIDE'].includes(String(v.route));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as InsightScholarCaseId].includes(String(v.type)));
}
export const isInsightScholarActivityCommand = validateInsightScholarActivityCommand;
export const isInsightScholarActivity = validateInsightScholarActivityCommand;
const ownerConsents = (s: SliceState, a: InsightScholarAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.insightScholar.life.fenna.willing;
const recorderConsents = (s: SliceState, a: InsightScholarAttempt) => a.recorderConsent === 'GRANTED' && a.recorderConsentWeek === s.week && s.insightScholar.life.osric.willing && s.insightScholar.life.osric.present;
function cleanupBlock(s: SliceState): string | null {
  const l = s.insightScholar.life;
  if (l.original.location !== 'DESK' || l.copy.location !== 'DESK') return '先把同一两张原纸亲手放回原桌。';
  if (l.box.location !== 'OWNER') return '先把同一原匣交还芬娜；已经耗掉的储能不恢复。';
  if (l.parcel.location === 'PLAYER') return '先把同一原包亲手交还芬娜。';
  return l.playerLocation === 'EXIT' ? null : '本人须沿普通原路实际回到出口。';
}
export function blockInsightScholarLife(s: SliceState, c: InsightScholarActivityCommand): string | null {
  if (!validateInsightScholarActivityCommand(c)) return '洞悉者候选G生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已晋升阅读者序列3候选。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原校档室。';
  if (['READY', 'FIGHTING'].includes(s.insightScholar.encounter.status)) return '先结束或和平离开原庭遭遇。';
  const l = s.insightScholar.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return !r?.contactOpen || !a || l.activeCase !== c.caseId ? '没有本次开放现场。' : cleanupBlock(s) ?? (a.inspected ? null : '先核实原物和本人真实退出。');
  if (r?.contactOpen && a && !a.closed && 'caseId' in c && l.activeCase === c.caseId) {
    // Physical return and all ordinary evidence work remain free at zero AP/spirituality.
    if (c.type === 'RETURN_PLAYER') return l.playerLocation !== 'EXIT' ? null : '本人已在出口。';
    if (c.type === 'RETURN_PAPERS') return l.original.location === 'PLAYER' && l.copy.location === 'PLAYER' && ['DESK', 'EXIT'].includes(l.playerLocation) ? null : '须在原桌或相连出口，持同一两张原纸才能真实放回。';
    if (c.type === 'RETURN_BOX') return l.box.location === 'BENCH' && ['BENCH', 'EXIT'].includes(l.playerLocation) ? null : '须从原校验台沿3米普通路把同一原匣还给主人。';
    if (c.type === 'RETURN_PARCEL') return l.playerLocation === 'EXIT' && l.parcel.location === 'PLAYER' ? null : '须携同一原包实际回到原主人面前。';
    if (c.type === 'INSPECT') return a.inspected ? '本次已检查，请结束。' : cleanupBlock(s);
    if (a.inspected) return '本次已核实退出，请结束现场。';
    if (c.type === 'CONSENT_OWNER') return a.ownerConsent === 'UNASKED' && l.playerLocation === 'EXIT' ? null : '须在原入口当面询问芬娜本次具体用途，旧许可不能代替。';
    if (!ownerConsents(s, a)) return '须原主人本次仍有效的许可；拒绝或撤回时可归还并普通退出。';
    if (c.type === 'READ_BOTH') return !a.readBoth && l.playerLocation === 'EXIT' && l.original.location === 'DESK' && l.copy.location === 'DESK' ? null : '从入口真实走2米取读同一原件与抄件。';
    if (c.type === 'MANUAL_COMPARE') return a.readBoth && !a.compared && l.playerLocation === 'DESK' && l.original.location === 'PLAYER' ? null : '须在原桌持有并已读两原纸，逐行人工对照一次。';
    if (c.type === 'HYPOTHESIZE') return !a.compared || a.verified ? '先比较实读原纸；核实后不再改写本案。' : a.hypothesis === null ? null : a.ownerEvidenceRead && c.hypothesis !== a.hypothesis && a.hypothesisHistory.length < 2 ? null : '先写一次假说；须取得原主新签注证据后才能修正一次，旧选择保留。';
    if (c.type === 'ASK_OWNER') return a.hypothesis !== null && !a.ownerEvidenceRead && l.original.location === 'PLAYER' && ['DESK', 'EXIT'].includes(l.playerLocation) ? null : '先写假说，再持原纸当面向原主询问交接签注。';
    if (c.type === 'VERIFY') return !a.ownerEvidenceRead ? '须先持原纸当面询问芬娜，实际取得交接签注证据。' : a.verified ? '本案已经核实。' : a.hypothesis !== 'COPY_ERROR' ? '已亲见签注记12份交齐、抄件漏2份；请据此修正原假说再核实。' : l.playerLocation === 'EXIT' ? null : '须在原主人面前核实。';
    if (c.type === 'READ_RECORD') return !a.recordRead && l.playerLocation === 'EXIT' && l.box.location === 'OWNER' ? null : '须取得本次许可，从原主人处取同一示范匣，走3米到校验台读其原记录。';
    if (c.type === 'CONSENT_RECORDER') return a.recordRead && a.recorderConsent === 'UNASKED' && l.playerLocation === 'BENCH' ? null : '须到原校验台读过记录，再询问奥斯里克本人本次意愿。';
    if (c.type === 'DEMONSTRATE_FIRST') return recorderConsents(s, a) && a.recordRead && !a.firstDemoSeen && l.playerLocation === 'BENCH' && l.box.location === 'BENCH' && l.box.charges === 2 ? null : '须原记录员当前同意且在场，亲眼看同一2格原匣第一次操作。';
    if (c.type === 'PREDICT') return a.firstDemoSeen && !a.secondDemoSeen && a.prediction === null && l.playerLocation === 'BENCH' ? null : '须亲见第一次实做，在第二次操作前写一次亮暗预测；不能事后改写。';
    if (c.type === 'DEMONSTRATE_SECOND') return recorderConsents(s, a) && a.firstDemoSeen && !a.secondDemoSeen && a.prediction !== null && l.playerLocation === 'BENCH' && l.box.location === 'BENCH' && l.box.charges === 1 ? null : '须先亲见第一轮并写预测，再由当前同意的原记录员切换位置实际操作。';
    if (c.type === 'OBSERVE_RESULT') return a.secondDemoSeen && !a.observedResult && l.playerLocation === 'BENCH' && l.box.demonstrations === 2 ? null : '必须实际做过第二次，才可在原台观察真实结果。';
    if (c.type === 'REVISE') return a.observedResult && !a.revised && l.playerLocation === 'BENCH' ? null : '先亲眼核实第二次真实结果，再复核原先预测一次。';
    if (c.type === 'READ_ROUTE') return !a.oldRouteRead && l.playerLocation === 'EXIT' ? null : '须在本次委托内，走到原桌读旧路线再实际返回入口。';
    if (c.type === 'SCOUT') return a.oldRouteRead && l.playerLocation === 'EXIT' && !a.parcelReturned ? null : '须先读旧记录，从入口沿2米普通路实际到转角。';
    if (c.type === 'CHOOSE_ROUTE') return !a.scouted || l.playerLocation !== 'JUNCTION' ? '须本人已到转角亲见当前封栏。' : c.route === 'SHORT' && a.shortBlocked ? '已经亲试同一封栏，不能重复撞栏；可改走6米旁路。' : a.route === 'SIDE' ? '已经选择并走过旁路，不能重复刷行程。' : null;
    if (c.type === 'TAKE_PARCEL') return l.playerLocation === 'STORE' && a.route === 'SIDE' && l.parcel.location === 'STORE' && !a.parcelTaken ? null : '须本人真实走到库房，在委托内亲取唯一原包；不读取内容。';
    if (c.type === 'COMPARE' || c.type === 'ANALYZE' || c.type === 'INFER') {
      if (a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null)) return '本案能力只判定一次；失败成本保留，可改普通核对。';
      if (s.health <= 0 || s.mind <= 0) return '身心不足以施术；普通核对和退出不受灵性限制。';
      if (c.type === 'COMPARE' && (!a.readBoth || a.compared || l.playerLocation !== 'DESK' || l.original.location !== 'PLAYER')) return '先实际取读两原纸，尚未完成比较。';
      if (c.type === 'ANALYZE' && (!a.recordRead || !a.firstDemoSeen || a.secondDemoSeen || !recorderConsents(s, a) || l.playerLocation !== 'BENCH')) return '须读原记录且亲见本匣第一次操作，再在第二次实做前辨析；不得读取未做结果。';
      if (c.type === 'INFER' && (!a.oldRouteRead || !a.scouted || l.playerLocation !== 'JUNCTION' || a.route !== null)) return '须亲读旧记录并到转角亲见当前封栏，尚未走路。';
      return s.spirituality >= (c.type === 'ANALYZE' ? 5 : 6) ? null : '灵性不足；仍可逐行比对、亲看实做或走普通旁路。';
    }
    return '请按当前实见证据继续，或归还原物后退出。';
  }
  if (hasInsightScholarLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消已准备实践，或收束当前现场。';
  if (hasProphetLifeLock(s) || Object.values(s.prophet.life.cases).some(x => x.status === 'PREPARED') || s.prophet.ritual.playerLocation === 'HALL' || ['READY', 'FIGHTING'].includes(s.prophet.encounter.status) || s.insightScholar.preparedWeek !== null || Object.values(s.mysticismMagister.cases).some(x => x.contactOpen || x.status === 'PREPARED') || s.mysticismMagister.practice.dreamOpen || s.mysticismMagister.practice.token !== 'OWNER') return '先收束原预言家、秘术导师现场和服药准备；不覆盖旧同意、旧原物。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '本步骤需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : INSIGHT_SCHOLAR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个实际报告。' : null;
  if (!r || !('caseId' in c)) return '未知实践。';
  const index = INSIGHT_SCHOLAR_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本案已经报告，不能重复刷成长。';
  if (index > 0 && l.cases[INSIGHT_SCHOLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告前一项真实实践。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案。' : r.attempts.at(-1)?.week === s.week ? '本周实际成本保留，下一真实周才可重新准备。' : c.method === 'ABILITY' && r.attempts.some(x => x.abilityTier !== null) ? '本案已检定一次，后续只能普通续办，不重骰。' : s.actionsRemaining < 2 ? '准备至少余2行动，留1行动实施，避免困在最后1行动。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须真实复核、归还原物并普通退出后报告。';
  return '没有本案开放现场。';
}
export const blockInsightScholarActivity = blockInsightScholarLife;

export function applyInsightScholarActivity(s: SliceState, c: InsightScholarActivityCommand, ctx: SeerContext): void {
  const reason = blockInsightScholarLife(s, c); if (reason) throw new Error(reason);
  const l = s.insightScholar.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('G · 证据、修正与有限知识', '三案真实报告后扮演+25。原先错误假说与预测保留；证据只来自原纸、当面签注、两次实做与亲自走过的路。不凭此永久学会示范匣能力。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动退出；已付1行动不退，尚未取得本次同意或移动原物。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '一次有限G能力' : '普通核对'}，尚未取得本次许可。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!, r.attempts.at(-1))); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动进入原校档室。子步0行动，秒数、路程、原件和真实失败分别保留；旧示范如已亲见则仍是过去实见，原匣不会复充。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'known-method' ? 'reader.s3.method-analysis' : 'reader.s3.evidence-link'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `真实核对与普通退出已完成，G扮演+25。${r.result === 'ABILITY' ? '本次实际成功的新能力掌握+8。' : '普通收口无能力掌握奖励。'}旧假说、预测、实耗及原物去向不抹除。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = 'CLOSED'; a.recorderConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('结束真实原现场', '0行动。本人已在EXIT，两纸在原桌、原匣归原主，原包不在本人手中；能力成本、原匣储能与失败保留，未完成的内容下周可普通续办。'); return; }
  switch (c.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.fenna.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; a.refused ||= a.ownerConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('芬娜当面回答本次请求', a.ownerConsent === 'GRANTED' ? `2秒。原42岁芬娜同意本次${c.caseId === 'copy-discrepancy' ? '借读原纸并询问交接签注' : c.caseId === 'known-method' ? '借用同一两格示范匣，须另问原记录员本人' : '按现场通路取回同一原包，不能拆读内容'}；所有权不变。` : '2秒。芬娜本次拒绝，原物留原处；尊重拒绝、检查并普通退出。'); return;
    case 'READ_BOTH': walk(s, a, 'DESK', 2); l.original.location = 'PLAYER'; l.copy.location = 'PLAYER'; a.readBoth = true; elapse(s, a, 4); ctx.note('亲手取读同一两张原纸', '实际2米、另4秒：IS3-ORIGINAL第二行记12份，IS3-COPY第二行记10份，两纸均属芬娜。仅凭两种数量，尚不能判断抄漏、交付差异或任何人说谎。'); return;
    case 'MANUAL_COMPARE': a.compared = true; a.manualCompared = true; elapse(s, a, 6); ctx.note('逐行人工对照原件与抄件', '6秒核对，第二行数量12与10不一致，其他所列行一致；原因尚待原主出示交接签注。普通核对不消耗灵性。'); return;
    case 'HYPOTHESIZE': a.hypothesis = c.hypothesis; a.hypothesisHistory.push(c.hypothesis); elapse(s, a, 1); ctx.note(a.hypothesisHistory.length > 1 ? '依据新签注修正原假说' : '写下仍待证实的解释', `1秒记录：${c.hypothesis === 'COPY_ERROR' ? '可能是抄件漏写' : '可能是交付短缺'}。${a.ownerEvidenceRead ? '已经亲见的新交接签注可以检验解释，原先选择仍在记录中。' : '这只是玩家假说，能力没有读取后台事实或裁定说谎者。'}`); return;
    case 'ASK_OWNER': if (l.playerLocation === 'DESK') walk(s, a, 'EXIT', 2); a.ownerEvidenceRead = true; elapse(s, a, 3); ctx.note('芬娜当面展开原交接签注', '持同一原纸实际来到芬娜面前，另3秒查看原件已有签注：“12份已逐项交齐”；她当面指出抄录时第二行漏写2份。新证据支持抄漏，可以修正先前假说；没有凭能力生成签注或读心。'); return;
    case 'VERIFY': a.verified = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('用当面证据核实抄漏', '2秒将已亲读的12/10差异、原交接签注和现假说对应，确认本案为COPY_ERROR。不能由此断言某人说谎；原两纸尚须真实放回桌上。'); return;
    case 'RETURN_PAPERS': if (l.playerLocation === 'EXIT') walk(s, a, 'DESK', 2); l.original.location = 'DESK'; l.copy.location = 'DESK'; a.papersReturned = true; elapse(s, a, 1); ctx.note('亲手把两张原纸放回原桌', '必要时从出口走2米到DESK，再1秒放回同一IS3-ORIGINAL与IS3-COPY，所有权不变；本人仍在DESK，须走2米返回出口。'); return;
    case 'READ_RECORD': walk(s, a, 'BENCH', 3); l.box.location = 'BENCH'; a.recordRead = true; elapse(s, a, 4); ctx.note('把同一原匣带到校验台并读记录', '实际3米、另4秒。原记录写明每次操作消耗1格，拨柄两位控制亮暗，不同位置须实测比较；不得补充储能。原匣属于芬娜，不是新造光源，也不是获得可永久施放的新技能。'); return;
    case 'CONSENT_RECORDER': a.recorderConsent = l.osric.willing && l.osric.present ? 'GRANTED' : 'DECLINED'; a.recorderConsentWeek = s.week; a.refused ||= a.recorderConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('询问原奥斯里克本次意愿', a.recorderConsent === 'GRANTED' ? '2秒。原51岁记录员当面自愿做本次两次低强示范，可随时拒绝继续；原主许可不代替他的意愿。' : '2秒。原记录员拒绝或不在原台，不能替他操作或凭空换一个人；可归还原匣并普通退出。'); return;
    case 'DEMONSTRATE_FIRST': l.box.charges--; l.box.selector = 'LIGHT'; l.box.output = 'LIT'; l.box.demonstrations++; a.demonstrationsPerformed++; a.firstDemoSeen = true; elapse(s, a, 2); ctx.note('原记录员实际完成第一次示范', '2秒，奥斯里克在原校验台将同一IS3-BOX置亮位操作；实际储能2→1，原匣亮起，玩家亲眼见到。第二次尚未发生，不能把未来结果当成实见。'); return;
    case 'PREDICT': a.prediction = c.prediction; elapse(s, a, 1); ctx.note('在第二次实做前写预测', `1秒。预测拨至另一位置后${c.prediction === 'LIT' ? '仍然亮起' : '变暗'}，只是待测预测；不改变原匣真实运作，之后不回写这次选择。`); return;
    case 'DEMONSTRATE_SECOND': l.box.charges--; l.box.selector = 'DARK'; l.box.output = 'DARK'; l.box.demonstrations++; a.demonstrationsPerformed++; a.secondDemoSeen = true; elapse(s, a, 2); ctx.note('原记录员实际完成第二次示范', '2秒，当前仍同意的奥斯里克切到原匣暗位并实际操作；同一原匣储能1→0，输出DARK。这个结果来自真实操作，不由预测或能力成败决定；须自己观察复核。'); return;
    case 'OBSERVE_RESULT': a.observedResult = true; elapse(s, a, 2); ctx.note('亲眼观察第二次实做结果', '2秒核实：同一原匣在暗位实际DARK、储能0，原亮灯已经熄灭。以当下可见状态核对先前预测，不生成新光源或读取后台技能。'); return;
    case 'REVISE': a.revised = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note(a.prediction === 'DARK' ? '实测支持原预测' : '实测纠正原预测', `2秒。原预测${a.prediction}仍保留，已见结果DARK；${a.prediction === 'DARK' ? '这一次预测与实测一致' : '据真实新证据修正理解'}。只理解此匣已经展示的方法，不自动学会能力，原匣0储能仍须归还。`); return;
    case 'RETURN_BOX': if (l.playerLocation === 'EXIT') walk(s, a, 'BENCH', 3); walk(s, a, 'EXIT', 3); l.box.location = 'OWNER'; a.boxReturned = true; elapse(s, a, 1); ctx.note('沿原路把同一匣交还芬娜', `从原台实际走3米、另1秒交还IS3-BOX；若本人先回入口，则另走3米去取。原匣剩${l.box.charges}格，仍属芬娜，绝不免费复充。`); return;
    case 'READ_ROUTE': walk(s, a, 'DESK', 2); a.oldRouteRead = true; elapse(s, a, 4); walk(s, a, 'EXIT', 2); ctx.note('实际到原桌查旧路线再回入口', '往返4米、另4秒。IS3-ROUTE旧记录写短廊可走，旁路长6米也通原库房；这是旧记录，当前通行情况须本人到转角查看。原图仍放原桌，不远观包内物。'); return;
    case 'SCOUT': walk(s, a, 'JUNCTION', 2); a.scouted = true; elapse(s, a, 2); ctx.note('本人到转角亲见当下原封栏', '实际2米、另2秒。眼前IS3-BARRIER仍CLOSED，旁路入口可见并畅通。原旧记录没有载明本次封栏；尚未进入库房，不知道原包内容。'); return;
    case 'CHOOSE_ROUTE': a.route = c.route; a.routeHistory.push(c.route); if (c.route === 'SHORT') { a.shortBlocked = true; elapse(s, a, 2); ctx.note('短廊实际受阻，仍在原转角', '2秒尝试可见短廊入口，被同一CLOSED封栏阻住；路程0米，本人仍JUNCTION。原栏没打开、原包没移动；可依据这个实见结果改走SIDE。'); } else { walk(s, a, 'STORE', 6); ctx.note('本人实际走过六米普通旁路', '6米、6秒从JUNCTION到STORE，不扣灵性。封栏仍CLOSED，原包仍待亲手拿取；推断没有使人瞬移。'); } return;
    case 'TAKE_PARCEL': l.parcel.location = 'PLAYER'; a.parcelTaken = true; elapse(s, a, 1); ctx.note('亲手取同一委托原包', '1秒拿起IS3-PARCEL，仍归芬娜，内容不拆读。本人仍在STORE，必须沿实际6米旁路和2米入口段返回。'); return;
    case 'RETURN_PARCEL': l.parcel.location = 'OWNER'; a.parcelReturned = true; elapse(s, a, 1); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('把原包亲手交给芬娜', '1秒交还同一IS3-PARCEL，所有权不变。旧图仍在桌上，原封栏仍CLOSED；不是能力遥取或免费开门。'); return;
    case 'RETURN_PLAYER': { const metres = l.playerLocation === 'STORE' ? 8 : l.playerLocation === 'BENCH' ? 3 : 2; walk(s, a, 'EXIT', metres); ctx.note('本人沿实际普通路回原出口', `真实${metres}米、${metres}秒，0行动0灵性。${l.parcel.location === 'PLAYER' ? '同一原包随本人返回，尚须亲手交还。' : '未隔空移动留在原处的物件。'}从STORE的路程包括旁路6米和入口2米。`); return; }
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (r.result === 'NONE' && (a.ownerConsent === 'DECLINED' || a.ownerConsent === 'GRANTED' && !l.fenna.willing || c.caseId === 'known-method' && (a.recorderConsent === 'DECLINED' || a.recorderConsent === 'GRANTED' && (!l.osric.willing || !l.osric.present)))) { a.refused = true; setResult(s, c.caseId, 'ORDINARY'); } ctx.note('核实原件、成本与真实退出', `2秒：本人EXIT，两原纸DESK，原匣OWNER/剩${l.box.charges}格，原包${l.parcel.location}。尊重当事人拒绝可如实普通报告；未完成且无人拒绝的中止不伪称完成。`); return;
    case 'COMPARE': case 'ANALYZE': case 'INFER': {
      const cost = c.type === 'ANALYZE' ? 5 : 6; s.spirituality -= cost; a.spiritualitySpent += cost; a.abilityTier = ctx.check('knowledge', 18).tier; elapse(s, a, 2);
      if (c.type === 'COMPARE' && success(a.abilityTier)) a.compared = true;
      const hint = c.type === 'COMPARE' ? '仅将已读两原纸第二行的12/10对应起来；原因仍须写假说并当面问原签注，不判谁说谎。' : c.type === 'ANALYZE' ? '仅指出已实见第一次亮灯与当时亮位相对应，原记录说明拨柄参与切换；另一个位置须先预测再实做检验。' : '仅指出亲见的本次CLOSED封栏没有记在旧记录中；真实6米旁路仍须本人走，不遥知库房物件。';
      ctx.note(success(a.abilityTier) ? 'G有限关联或方法辨析得到提示' : 'G有限关联或方法辨析失败', `${cost}灵性与2秒实耗，知识18，本案以后不重骰。${success(a.abilityTier) ? hint : '没有额外提示，也不改变原事实；可继续普通逐行核对、实看操作或走原旁路。'}`); return;
    }
  }
}

export function insightScholarLifeActions(s: SliceState): InsightScholarLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.insightScholar.life, out: InsightScholarLifeAction[] = [];
  const add = (label: string, cost: string, command: InsightScholarActivityCommand) => { const reason = blockInsightScholarLife(s, command); out.push({ id: `IS3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'hypothesis' in command ? `:${command.hypothesis}` : ''}${'prediction' in command ? `:${command.prediction}` : ''}${'route' in command ? `:${command.route}` : ''}`, label, cost, enabled: reason === null, reason, command }); };
  for (const caseId of INSIGHT_SCHOLAR_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add('观察本案原人、原物与普通出口', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备一次有限G能力' : '准备普通真实核对', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('进入原校档室实施', '1行动 · 后续子步0行动', { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 不退已付行动', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告实际证据、修正与退出', '1行动 · G扮演25 · 实成功新掌握8', { type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    add('当面询问芬娜本次用途许可', '0行动 · 2秒 · 原主人可拒绝', { type: 'CONSENT_OWNER', caseId });
    if (caseId === 'copy-discrepancy') {
      add('走到原桌亲手取读两张原纸', '0行动 · 2米6秒', { type: 'READ_BOTH', caseId });
      if (r.method === 'ABILITY') add('G有限关联已读两原纸', '0行动 · 6灵性 · 知识18 · 2秒 · 本案一次', { type: 'COMPARE', caseId });
      add('逐行人工比对两原纸', '0行动 · 6秒 · 失败或低灵性可继续', { type: 'MANUAL_COMPARE', caseId });
      add('假说：抄件漏写', '0行动 · 1秒 · 新证据后可修正', { type: 'HYPOTHESIZE', caseId, hypothesis: 'COPY_ERROR' });
      add('假说：交付短缺', '0行动 · 1秒 · 可能错误，原选择保留', { type: 'HYPOTHESIZE', caseId, hypothesis: 'MISSING_DELIVERY' });
      add('持原纸当面问芬娜并看交接签注', '0行动 · 从桌边2米加3秒查看', { type: 'ASK_OWNER', caseId });
      add('按亲见签注复核现假说', '0行动 · 2秒 · 不读心或断言说谎', { type: 'VERIFY', caseId });
      add('把同一两纸亲手放回原桌', '0行动 · 至多2米加1秒 · 本人仍须回出口', { type: 'RETURN_PAPERS', caseId });
    } else if (caseId === 'known-method') {
      add('携同一原匣到校验台读原记录', '0行动 · 3米7秒', { type: 'READ_RECORD', caseId });
      add('询问原记录员本次是否自愿示范', '0行动 · 2秒 · 不替原人同意', { type: 'CONSENT_RECORDER', caseId });
      add('亲看原记录员第一次实际操作', '0行动 · 2秒 · 原匣2→1格', { type: 'DEMONSTRATE_FIRST', caseId });
      if (r.method === 'ABILITY') add('G辨析已实见原匣方法', '0行动 · 5灵性 · 知识18 · 2秒 · 本案一次', { type: 'ANALYZE', caseId });
      for (const prediction of ['LIT', 'DARK'] as const) add(`事先预测另一位置后${prediction === 'LIT' ? '仍亮' : '变暗'}`, '0行动 · 1秒 · 实做前记录，不能回写', { type: 'PREDICT', caseId, prediction });
      add('请原记录员切换并第二次实际操作', '0行动 · 2秒 · 原匣1→0格', { type: 'DEMONSTRATE_SECOND', caseId });
      add('亲眼观察第二次实际结果', '0行动 · 2秒', { type: 'OBSERVE_RESULT', caseId });
      add('依据实测复核或修正原预测', '0行动 · 2秒 · 保留原预测', { type: 'REVISE', caseId });
      add('沿原路把同一原匣还给芬娜', '0行动 · 3米4秒 · 若先离台须另走3米取匣', { type: 'RETURN_BOX', caseId });
    } else {
      add('到原桌读旧路线再回入口', '0行动 · 往返4米8秒 · 原图仍留桌', { type: 'READ_ROUTE', caseId });
      add('本人到转角察看当前通路', '0行动 · 2米4秒', { type: 'SCOUT', caseId });
      if (r.method === 'ABILITY') add('G关联旧记录与亲见当前现场', '0行动 · 6灵性 · 知识18 · 2秒 · 本案一次', { type: 'INFER', caseId });
      add('尝试旧记录中的短廊', '0行动 · 实际阻挡时留转角 · 2秒', { type: 'CHOOSE_ROUTE', caseId, route: 'SHORT' });
      add('选择并实际走过普通旁路', '0行动 · 6米6秒 · 不开原封栏', { type: 'CHOOSE_ROUTE', caseId, route: 'SIDE' });
      add('亲手取唯一委托原包', '0行动 · 1秒 · 不拆读内容', { type: 'TAKE_PARCEL', caseId });
      add('把同一原包亲手交还芬娜', '0行动 · 1秒 · 须本人携包在原出口', { type: 'RETURN_PARCEL', caseId });
    }
    add('本人沿普通原路返回出口', '0行动 · 桌或转角2米，校验台3米，库房6+2米', { type: 'RETURN_PLAYER', caseId });
    add('核实原物与本人真实退出', '0行动 · 2秒', { type: 'INSPECT', caseId });
    add('结束本次原现场', '0行动 · 须真实还物、走出并检查', { type: 'CLOSE', caseId });
    add('退出本次实践并保留实际进度', '0行动 · 已耗成本不退，不重骰', { type: 'WITHDRAW', caseId });
  }
  if (!l.reflected) add('反思有限证据与错误修正', '1行动 · 三报告后G扮演25', { type: 'REFLECT' });
  return out;
}
function observations(id: InsightScholarCaseId, a: InsightScholarAttempt | undefined): string[] {
  if (!a) return [];
  const out: string[] = [];
  if (a.ownerConsent !== 'UNASKED') out.push(`本次原主答复：${a.ownerConsent}；许可周${a.ownerConsentWeek ?? '无'}。`);
  if (id === 'copy-discrepancy') {
    if (a.readBoth) out.push('已亲读：原件第二行12份、抄件第二行10份，其他所列行一致；数量差异本身不证明交付短缺或有人说谎。');
    if (a.hypothesis !== null) out.push(`玩家假说：${a.hypothesis}；原选择序列${a.hypothesisHistory.join(' → ')}。`);
    if (a.ownerEvidenceRead) out.push('新实见证据：芬娜当面展开同一原件已有交接签注“12份已逐项交齐”，指出抄件漏写2份。');
    if (a.verified) out.push('已按亲见原签注核实为抄漏；原两纸仍各只有一张。');
  } else if (id === 'known-method') {
    if (a.recordRead) out.push('已读原操作记录：每次实做消耗1格，拨柄两位控制亮暗；本次只能两次，不复充、不授新技能。');
    if (a.firstDemoSeen) out.push('已亲见第一次实际操作：亮位LIT，原匣储能2→1。');
    if (a.prediction !== null) out.push(`第二次实做前写的原预测：${a.prediction}。`);
    if (a.secondDemoSeen) out.push('第二次已实际操作：暗位DARK，原匣1→0。');
    if (a.observedResult) out.push('已亲眼复核第二次真实结果DARK。');
    if (a.revised) out.push(a.prediction === 'DARK' ? '实测支持这一次预测；不等于永久学法。' : '原LIT预测错误，已根据实见DARK修正理解；原选择仍保留。');
  } else {
    if (a.oldRouteRead) out.push('已读旧路线：短廊曾可走，原旁路6米也通库房；旧记录不代表此刻现场。');
    if (a.scouted) out.push('已亲走2米到转角：当前原封栏CLOSED，旁路入口畅通。');
    if (a.shortBlocked) out.push('实际尝试SHORT被同一原封栏挡住，当时人留转角；此后可改SIDE。');
    if (a.route === 'SIDE') out.push('本人已经真实走过6米旁路；库房返回还要6米旁路加2米入口段。');
    if (a.parcelReturned) out.push('唯一原包已由本人携回并亲手还给芬娜，内容未拆读。');
  }
  if (a.abilityTier !== null) out.push(`G能力本案检定${a.abilityTier}，已实耗${a.spiritualitySpent}灵性，不重骰。`);
  return out;
}
export function projectInsightScholarLife(s: SliceState): InsightScholarLifeProjection {
  const l = s.insightScholar.life;
  return { title: '洞悉者·阅读者序列3候选（G扩展）', story: INSIGHT_SCHOLAR_LIFE_STORY, environment: '原创G校档室IS3-ARCHIVE：原入口EXIT、原桌距入口2米、校验台3米、转角2米；转角至原库房STORE有6米普通旁路。所有实际走路记秒/米，无追逐，普通出口始终开放。', activeCase: l.activeCase, inside: hasInsightScholarLifeLock(s), insideCase: hasInsightScholarLifeLock(s), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, currentAttempt: structuredClone(currentAttempt(s)), fenna: { ...l.fenna }, osric: { ...l.osric }, original: { ...l.original }, copy: { ...l.copy }, box: { ...l.box }, routeRecord: { ...l.routeRecord }, barrier: { ...l.barrier }, parcel: { ...l.parcel },
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: observations(x.id, r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '真实工作尚未完成，成本和已见事实保留。' : r.result === 'ABILITY' ? '有限G能力成功，已用后续真实证据完成核对。' : '通过普通核对或尊重本次拒绝收束，不授能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: insightScholarLifeActions(s) };
}

/** Validate the finite original objects, paid checks, witnessed operations and physical exits. */
export function validateInsightScholarLife(s: SliceState): boolean {
  const l = s.insightScholar?.life, initial = createInsightScholarLifeState(), promotion = s.insightScholar?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, INSIGHT_SCHOLAR_CASE_IDS)) return false;
  for (const key of ['fenna', 'osric', 'original', 'copy', 'box', 'routeRecord', 'barrier', 'parcel'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.archiveId !== 'IS3-ARCHIVE' || !['EXIT', 'DESK', 'BENCH', 'JUNCTION', 'STORE'].includes(l.playerLocation) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.activeCase !== null && !INSIGHT_SCHOLAR_CASE_IDS.includes(l.activeCase)) return false;
  if (l.fenna.id !== 'IS3-FENNA' || l.fenna.name !== '芬娜' || l.fenna.age !== 42 || l.fenna.alive !== true || l.fenna.location !== 'EXIT' || typeof l.fenna.willing !== 'boolean') return false;
  if (l.osric.id !== 'IS3-OSRIC' || l.osric.name !== '奥斯里克' || l.osric.age !== 51 || l.osric.alive !== true || l.osric.location !== 'BENCH' || typeof l.osric.willing !== 'boolean' || typeof l.osric.present !== 'boolean') return false;
  for (const key of ['original', 'copy'] as const) if (l[key].id !== initial[key].id || l[key].owner !== 'IS3-FENNA' || !['DESK', 'PLAYER'].includes(l[key].location)) return false;
  if (l.original.location !== l.copy.location || stableStringify(l.routeRecord) !== stableStringify(initial.routeRecord) || stableStringify(l.barrier) !== stableStringify(initial.barrier)) return false;
  if (l.box.id !== 'IS3-BOX' || l.box.owner !== 'IS3-FENNA' || !['OWNER', 'BENCH'].includes(l.box.location) || !integer(l.box.charges, 0, 2) || !integer(l.box.demonstrations, 0, 2) || l.box.charges !== 2 - l.box.demonstrations || l.box.selector !== (l.box.demonstrations === 2 ? 'DARK' : 'LIGHT') || l.box.output !== (l.box.demonstrations === 1 ? 'LIT' : 'DARK')) return false;
  if (l.parcel.id !== 'IS3-PARCEL' || l.parcel.owner !== 'IS3-FENNA' || !['STORE', 'PLAYER', 'OWNER'].includes(l.parcel.location)) return false;
  let open = 0, prepared = 0, resolved = 0, seconds = 0, metres = 0, demonstrations = 0, parcelReturned = false;
  for (const [index, id] of INSIGHT_SCHOLAR_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[INSIGHT_SCHOLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let previousWeek = r.observedWeek - 1, checks = 0, seenDemonstrations = 0;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, previousWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !integer(a.elapsedSeconds) || !integer(a.playerTravelMetres) || a.elapsedSeconds < a.playerTravelMetres || !integer(a.spiritualitySpent, 0, 6) || !integer(a.demonstrationsPerformed, 0, 2)) return false;
      for (const key of ['closed', 'readBoth', 'compared', 'manualCompared', 'ownerEvidenceRead', 'verified', 'papersReturned', 'recordRead', 'firstDemoSeen', 'secondDemoSeen', 'observedResult', 'revised', 'boxReturned', 'oldRouteRead', 'scouted', 'shortBlocked', 'parcelTaken', 'parcelReturned', 'inspected', 'refused'] as const) if (typeof a[key] !== 'boolean') return false;
      for (const [consent, week] of [[a.ownerConsent, a.ownerConsentWeek], [a.recorderConsent, a.recorderConsentWeek]] as const) if (!['UNASKED', 'GRANTED', 'DECLINED', 'CLOSED'].includes(consent) || week !== null && week !== a.week || consent === 'UNASKED' && week !== null || ['GRANTED', 'DECLINED'].includes(consent) && week === null) return false;
      if (a.abilityTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.abilityTier) || !Array.isArray(a.hypothesisHistory) || a.hypothesisHistory.length > 2 || a.hypothesisHistory.some(h => !['COPY_ERROR', 'MISSING_DELIVERY'].includes(h)) || a.hypothesis !== (a.hypothesisHistory.at(-1) ?? null) || !Array.isArray(a.routeHistory) || a.routeHistory.length > 2 || a.routeHistory.some(route => !['SHORT', 'SIDE'].includes(route)) || a.route !== (a.routeHistory.at(-1) ?? null) || a.prediction !== null && !['LIT', 'DARK'].includes(a.prediction)) return false;
      if (a.abilityTier !== null) { checks++; if (a.method !== 'ABILITY' || a.spiritualitySpent !== (id === 'known-method' ? 5 : 6) || a.ownerConsentWeek === null || (id === 'copy-discrepancy' ? !a.readBoth : id === 'known-method' ? !a.recordRead || !a.firstDemoSeen || a.recorderConsentWeek === null : !a.oldRouteRead || !a.scouted)) return false; }
      else if (a.spiritualitySpent !== 0) return false;
      if (a.compared && (!a.readBoth || !a.manualCompared && !success(a.abilityTier)) || a.manualCompared && !a.compared || a.hypothesis !== null && !a.compared || a.ownerEvidenceRead && a.hypothesis === null || a.hypothesisHistory.length > 1 && !a.ownerEvidenceRead || a.verified && (!a.ownerEvidenceRead || a.hypothesis !== 'COPY_ERROR') || a.papersReturned && !a.readBoth) return false;
      seenDemonstrations += a.demonstrationsPerformed;
      if (id === 'known-method' && (a.firstDemoSeen !== (seenDemonstrations >= 1) || a.secondDemoSeen !== (seenDemonstrations === 2))) return false;
      if (a.demonstrationsPerformed > 0 && (!a.recordRead || a.recorderConsentWeek === null) || a.prediction !== null && !a.firstDemoSeen || a.secondDemoSeen && a.prediction === null || a.observedResult && !a.secondDemoSeen || a.revised && !a.observedResult || a.boxReturned && !a.recordRead) return false;
      if (a.scouted && !a.oldRouteRead || a.route !== null && !a.scouted || a.shortBlocked !== a.routeHistory.includes('SHORT') || a.routeHistory.length > 1 && a.routeHistory.join('|') !== 'SHORT|SIDE' || a.parcelTaken && a.route !== 'SIDE' || a.parcelReturned && !a.parcelTaken) return false;
      if (id !== 'copy-discrepancy' && (a.readBoth || a.compared || a.hypothesis !== null || a.ownerEvidenceRead || a.verified || a.papersReturned) || id !== 'known-method' && (a.recordRead || a.firstDemoSeen || a.secondDemoSeen || a.demonstrationsPerformed || a.prediction !== null || a.observedResult || a.revised || a.boxReturned || a.recorderConsentWeek !== null) || id !== 'revised-route' && (a.oldRouteRead || a.scouted || a.route !== null || a.parcelTaken || a.parcelReturned)) return false;
      const completed = id === 'copy-discrepancy' ? a.verified : id === 'known-method' ? a.revised : a.parcelReturned;
      if (a.result === 'ABILITY' && (!success(a.abilityTier) || !completed) || a.result === 'ORDINARY' && !completed && !a.refused || a.refused && a.ownerConsentWeek === null) return false;
      if (a.closed && (!a.inspected || a.ownerConsent !== 'CLOSED' || a.recorderConsent !== 'CLOSED' || a.readBoth && !a.papersReturned || a.recordRead && !a.boxReturned || a.parcelTaken && !a.parcelReturned) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      if (a.readBoth && a.playerTravelMetres < 2 || a.ownerEvidenceRead && a.playerTravelMetres < 4 || a.papersReturned && a.ownerEvidenceRead && a.playerTravelMetres < 6 || a.recordRead && a.playerTravelMetres < 3 || a.boxReturned && a.playerTravelMetres < 6 || a.oldRouteRead && a.playerTravelMetres < 4 || a.scouted && a.playerTravelMetres < 6 || a.route === 'SIDE' && a.playerTravelMetres < 12 || a.parcelReturned && a.playerTravelMetres < 20) return false;
      previousWeek = a.week; seconds += a.elapsedSeconds; metres += a.playerTravelMetres; demonstrations += a.demonstrationsPerformed; parcelReturned ||= a.parcelReturned;
    }
    if (checks > 1 || r.closes !== r.attempts.filter(a => a.closed).length || r.result !== (r.attempts.at(-1)?.result ?? 'NONE')) return false;
    const a = r.attempts.at(-1);
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen || a?.week === s.week) return false; }
    if (r.status === 'ACTIVE') { open++; if (!a || a.closed || !r.contactOpen || l.activeCase !== id || a.week !== s.week || a.method !== r.method || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (r.contactOpen) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!a?.closed || !r.returned || r.result === 'NONE' || r.method !== a.method)) return false;
    if (r.status === 'RESOLVED') resolved++;
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.clockSeconds < seconds || l.playerTravelMetres !== metres || l.box.demonstrations !== demonstrations || (l.parcel.location === 'OWNER') !== parcelReturned || l.reflected && resolved !== 3) return false;
  if (!open && cleanupBlock(s) !== null) return false;
  if (open) {
    const a = currentAttempt(s)!;
    if ((l.original.location === 'PLAYER') !== (l.activeCase === 'copy-discrepancy' && a.readBoth && !a.papersReturned) || (l.box.location === 'BENCH') !== (l.activeCase === 'known-method' && a.recordRead && !a.boxReturned) || (l.parcel.location === 'PLAYER') !== (l.activeCase === 'revised-route' && a.parcelTaken && !a.parcelReturned)) return false;
  }
  if (s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2) return s.wisdomAngel.insightScholarActingAtPromotion === 100 && resolved === 3 && l.reflected && !hasInsightScholarLifeLock(s) && s.wisdomAngel.insightScholarActingAtPromotion === resolved * 25 + (l.reflected ? 25 : 0);
  return !promoted(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
}
