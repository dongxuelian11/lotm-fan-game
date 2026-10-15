import { reconstructBloodDukeOriginalRoot } from '../blood-duke/life.js';
import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasBlathererOldPractice, hasBlathererRitualLock } from './index.js';

export const BLATHERER_CASE_IDS = ['conflicting-bell', 'withdrawn-invitation', 'open-corridor'] as const;
export type BlathererCaseId = typeof BLATHERER_CASE_IDS[number];
export type BlathererLocation = 'START' | 'A' | 'B';
export type BlathererConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED';
type SceneType = 'GO_A' | 'READ_CARD' | 'WALK_B' | 'READ_BELL' | 'RETURN_A' | 'CONSENT_NORA' | 'ASK_GUIDE_LEAVE' | 'WHISPER' | 'STOP_VOICE' | 'WAIT_CLEAR' | 'ASK_CURRENT_ANSWER' | 'ORDINARY_CHECK' | 'RECORD_OUTCOME' | 'RETURN_CARD' | 'RETURN_START' | 'WITHDRAW';
export type BlathererActivityCommand =
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | Exclude<SceneType, 'ASK_GUIDE_LEAVE' | 'ASK_CURRENT_ANSWER'>; caseId: BlathererCaseId }
  | { type: 'ASK_GUIDE_LEAVE'; caseId: 'open-corridor' }
  | { type: 'ASK_CURRENT_ANSWER'; caseId: 'withdrawn-invitation' }
  | { type: 'PREPARE'; caseId: BlathererCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface BlathererMovement { from: BlathererLocation; to: BlathererLocation; mode: 'WALK'; metres: number; seconds: number; itemIds: string[] }
export interface BlathererGuideMovement { caseId: 'open-corridor'; from: 'START' | 'B' | 'OUTSIDE'; to: 'START' | 'B' | 'OUTSIDE'; metres: number; seconds: number; atSecond: number }
export interface BlathererEvidence { sourceId: string; text: string; atSecond: number }
export interface BlathererLifeStep { type: SceneType; tier: PublicResolutionTier | null; atSecond: number; volunteerWilling: boolean }
export interface BlathererAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; elapsedSeconds: number; playerTravelMetres: number; playerMoves: BlathererMovement[]; steps: BlathererLifeStep[];
  spiritualitySpent: number; mindSpent: number; resolutionPaid: boolean; resolutionActions: number;
  consent: BlathererConsent; withdrawn: boolean; cardRead: boolean; cardTaken: boolean; cardReturned: boolean; bellRead: boolean; guideLeft: boolean;
  whisperTier: PublicResolutionTier | null; whisperSourceId: 'BL3-NORA' | null; whisperAtSecond: number | null; voiceActive: boolean; stopped: boolean;
  residualSeconds: number; waitedSeconds: number; waitCompleted: boolean; currentAnswer: 'DECLINED' | null; ordinaryChecked: boolean;
  evidence: BlathererEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface BlathererCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: BlathererAttempt[];
}
export interface BlathererLifeState {
  siteId: 'BL3-QUIET-ROOM'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: BlathererCaseId | null;
  playerLocation: BlathererLocation; playerTravelMetres: number; clockSeconds: number;
  volunteer: { id: 'BL3-NORA'; name: '诺拉·温特'; age: 46; alive: true; willing: boolean; location: 'A' | 'START' | 'OUTSIDE' };
  guide: { id: 'ROAN'; name: '罗安·费里'; location: 'OUTSIDE' | 'START' | 'B'; travelMetres: number; moves: BlathererGuideMovement[] };
  card: { id: 'BL3-CARD'; owner: 'BL3-NORA'; quantity: 1; location: 'NORA' | 'PLAYER'; travelMetres: number };
  bell: { id: 'BL3-BELL'; quantity: 1; location: 'B' };
  note: { id: 'BL3-NOTE'; quantity: 1; location: 'B'; records: { caseId: BlathererCaseId; text: string }[] };
  cases: Record<BlathererCaseId, BlathererCaseState>; reflected: boolean;
}
export interface BlathererLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BlathererActivityCommand }
export interface BlathererLifeProjection extends Omit<BlathererLifeState, 'cases'> {
  title: string; story: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: BlathererAttempt | null;
  cases: { id: BlathererCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: BlathererAttempt[] }[];
  actions: BlathererLifeAction[];
}
const ABILITY = 'abyss.s3.limited-murmur' as const;
export const BLATHERER_LIFE_STORY = '呓语者与序列3的对应仅有原著人物线索推断，完整配方、仪式与新增能力规则未核。本次有限低语、人物、物件、场景、听距和数值全部为原创G；笑声、血晶与推断祭坛不构成职业或必需仪式。没有天使污染、免费召唤、普遍疯狂或永久人格改写。和平扮演100只是有真实成本的G替代，不保证原著安全消化，不清除旧恶意、紧绷或良知后果。';
export const BLATHERER_LIFE_ENVIRONMENT = '三案各观察1行动、准备1行动、实际首次实施1行动、真实报告1行动，反思1行动，共13行动。START_CASE只开现场0行动；低语另实付4灵性1精神、知识18、2秒。失败保留成本，随后普通补查不再收实施行动。STOP_VOICE只停新输入；成功迟疑须实际WAIT_CLEAR30秒。原位置START0米、A4米、B8米，普通1米/秒；室外−4米，离A听者8米，超出原创G6米听距。';
const CASES = [
  { id: 'conflicting-bell', title: 'G · 原纸与冲突铃声', story: '诺拉·温特46岁在A，只允许当前本次短试验。本人先到A读她的同一BL3-CARD，再走4米到B核原铃BL3-BELL与原记录BL3-NOTE，走4米回A后才可询问许可并尝试。能力只可能出现一次轻微可见迟疑；失败后仍须普通核对，原卡归还本人后实走4米出门。' },
  { id: 'withdrawn-invitation', title: 'G · 当事人撤回后的原邀请', story: '诺拉只可能先同意一次短试验；实际尝试后明确撤回，不论成功失败都不能再试。BL3-CARD整案仍在她本人手里。必须停输入、等待实际残余消退，再当面询问她当前答复；她拒绝邀请，照实保留，不把曾经同意测试写成持续许可或接受邀请。' },
  { id: 'open-corridor', title: 'G · 有旁人的开放走廊', story: '原导师罗安真实从室外经START步行12米到B，处在A听者4米外的开放走廊中，是不参与试验的独立旁人。须实际请他走8米回START，再走4米到室外，才可对当面同意的诺拉作6米听距短试验；不能以熟人免疫代替离场。也可完全普通核对，导师不必离开。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'READ_CARD', 'WALK_B', 'READ_BELL', 'RETURN_A', 'ASK_GUIDE_LEAVE', 'CONSENT_NORA', 'WHISPER', 'STOP_VOICE', 'WAIT_CLEAR', 'ASK_CURRENT_ANSWER', 'ORDINARY_CHECK', 'RECORD_OUTCOME', 'RETURN_CARD', 'RETURN_START', 'WITHDRAW'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 3;
const sourceFor = (id: BlathererCaseId) => `blatherer-life-${id}`;
const freshCase = (): BlathererCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): BlathererAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, mindSpent: 0, resolutionPaid: false, resolutionActions: 0,
    consent: 'UNASKED', withdrawn: false, cardRead: false, cardTaken: false, cardReturned: false, bellRead: false, guideLeft: false, whisperTier: null, whisperSourceId: null, whisperAtSecond: null, voiceActive: false, stopped: false, residualSeconds: 0, waitedSeconds: 0, waitCompleted: false, currentAnswer: null, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createBlathererLifeState(): BlathererLifeState {
  return { siteId: 'BL3-QUIET-ROOM', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    volunteer: { id: 'BL3-NORA', name: '诺拉·温特', age: 46, alive: true, willing: true, location: 'A' }, guide: { id: 'ROAN', name: '罗安·费里', location: 'OUTSIDE', travelMetres: 0, moves: [] },
    card: { id: 'BL3-CARD', owner: 'BL3-NORA', quantity: 1, location: 'NORA', travelMetres: 0 }, bell: { id: 'BL3-BELL', quantity: 1, location: 'B' }, note: { id: 'BL3-NOTE', quantity: 1, location: 'B', records: [] },
    cases: { 'conflicting-bell': freshCase(), 'withdrawn-invitation': freshCase(), 'open-corridor': freshCase() }, reflected: false };
}
export function validateBlathererActivityCommand(v: unknown): v is BlathererActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (typeof v.caseId !== 'string' || !BLATHERER_CASE_IDS.includes(v.caseId as BlathererCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (!shape(v, ['type', 'caseId'])) return false;
  if (v.type === 'ASK_GUIDE_LEAVE') return v.caseId === 'open-corridor';
  if (v.type === 'ASK_CURRENT_ANSWER') return v.caseId === 'withdrawn-invitation';
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', ...SCENES].includes(v.type);
}
export const currentBlathererAttempt = (s: SliceState) => s.blatherer.life.activeCase ? s.blatherer.life.cases[s.blatherer.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.blatherer.life, a = currentBlathererAttempt(s);
  if (a?.voiceActive) return '先STOP_VOICE停止实际输入；关闭页面不会停声。';
  if (a && a.residualSeconds > 0) return '原听者仍有30秒有限迟疑，须实际WAIT_CLEAR；停止不是瞬间治愈。';
  if (l.card.location === 'PLAYER') return '须在A当面归还同一BL3-CARD，不能带走、复制或远程归还。';
  return l.playerLocation !== 'START' ? '本人须从B实走4米回A，再4米回START；关闭不代办实际退出。' : null;
}
export const hasBlathererLifeLock = (s: SliceState): boolean => !(s.progression.pathwayId === 'abyss' && s.progression.sequence === 2 && s.bloodDuke?.promotionWeek != null) && (s.blatherer.life.activeCase !== null || Object.values(s.blatherer.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null);
const evidenceComplete = (a: BlathererAttempt) => a.cardRead && a.bellRead;
function sceneReason(s: SliceState, id: BlathererCaseId, type: SceneType): string | null {
  const l = s.blatherer.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation;
  if (type === 'WITHDRAW') return a.withdrawn ? '已经撤回本次能力方案；仍须真实归物、退出。' : null;
  if (type === 'STOP_VOICE') return a.whisperTier !== null && !a.stopped ? null : '须确有本次实际尝试，且尚未停止；普通方案没有想象中的声音可停。';
  if (type === 'WAIT_CLEAR') return a.whisperTier !== null && a.stopped && !a.waitCompleted ? null : '须先停止本次实际输入，再实际等待；没有残余时记录0秒，不凭空造效果。';
  if (type === 'RETURN_CARD') return at === 'A' && l.card.location === 'PLAYER' && !a.voiceActive && a.residualSeconds === 0 && (a.outcomeRecorded || a.withdrawn) ? null : '须本人在A实持同一原卡，停输入并清除实际残余，再当面归还诺拉。';
  if (type === 'RETURN_START') return at === 'A' && l.card.location === 'NORA' && !a.voiceActive && a.residualSeconds === 0 && (a.outcomeRecorded || a.withdrawn) ? null : '须在A归还同一原卡、停输入并完成实际残余等待，再沿4米普通门路退出。';
  if (type === 'RETURN_A') return at === 'B' && (a.bellRead || a.withdrawn) ? null : '本人须在B读过原铃记录或明确撤回，再实际走4米回A。';
  if (a.outcomeRecorded) return '已经记录本次真实结果，只可归还同一原卡并实际退出。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 && !a.withdrawn ? null : '本次从START沿4米普通路线走到A；不瞬移或重复进入。';
  if (type === 'READ_CARD') return at === 'A' && !a.cardRead && l.card.location === 'NORA' && !a.withdrawn ? null : '须到A当面读诺拉持有的同一BL3-CARD，不能远读或造副本。';
  if (type === 'WALK_B') return at === 'A' && a.cardRead && !a.bellRead && !a.withdrawn ? null : '先在A亲读原卡，再沿4米普通路线到B。';
  if (type === 'READ_BELL') return at === 'B' && a.cardRead && !a.bellRead && !a.withdrawn ? null : '须本人已在B，实际读原铃及原BL3-NOTE对应记录。';
  if (type === 'ASK_GUIDE_LEAVE') return at === 'A' && evidenceComplete(a) && l.guide.location === 'B' && !a.guideLeft && !a.voiceActive ? null : '须在A已核原证据，当面请仍在B的原导师实际沿8米到START、再4米到室外。';
  if (type === 'CONSENT_NORA') return at === 'A' && evidenceComplete(a) && a.consent === 'UNASKED' && !a.withdrawn && !a.resolutionPaid ? null : '须返回A、核完本案原物，再当面问诺拉当前一次有限许可；撤回或已实施后不重问。';
  if (type === 'WHISPER') {
    if (at !== 'A' || !evidenceComplete(a) || a.method !== 'ABILITY' || a.consent !== 'GRANTED' || !l.volunteer.willing || a.withdrawn || a.whisperTier !== null || a.resolutionPaid || a.stopped) return '仅已实际返A的能力方案、诺拉当前明确同意的一次短试验可用；拒绝、撤回和旧许可不能强制持续。';
    if (id === 'open-corridor' && l.guide.location !== 'OUTSIDE') return '原导师仍在6米可听范围内；须实际离场，熟人不免疫，不扣费也不施术。';
    return s.actionsRemaining < 1 ? '需要1行动实施；没有免费能力。' : s.spirituality < 4 ? '需要4灵性，失败也实耗；可选择普通核对。' : s.mind < 1 ? '需要1精神，失败也实耗。' : null;
  }
  if (type === 'ASK_CURRENT_ANSWER') return at === 'A' && evidenceComplete(a) && a.currentAnswer === null && !a.voiceActive && a.residualSeconds === 0 && (a.whisperTier === null || a.waitCompleted) ? null : '须在A停输入并等实际残余消退后，当面询问诺拉当前答复；旧同意不代替当前选择。';
  if (type === 'ORDINARY_CHECK') {
    if (at !== 'A' || !evidenceComplete(a) || a.ordinaryChecked || a.voiceActive || a.residualSeconds > 0 || id === 'withdrawn-invitation' && a.currentAnswer === null) return '须本人在A完成原卡和原铃记录核对、停输入并等残余消退；邀请案另须询问本人当前答复。';
    return !a.resolutionPaid && s.actionsRemaining < 1 ? '首次普通实施需要1行动；只有真实付过实施行动的失败补查才0行动。' : null;
  }
  if (type === 'RECORD_OUTCOME') return at === 'A' && evidenceComplete(a) && a.resolutionPaid && !a.voiceActive && a.residualSeconds === 0 && (a.whisperTier === null || a.waitCompleted) && (success(a.whisperTier) || a.ordinaryChecked) && (id !== 'withdrawn-invitation' || a.currentAnswer === 'DECLINED') ? null : '须按实际来源核完证据、实施真实能力或普通核对，停止并等待实际残余，再如实记录；失败不能冒充成功。';
  return '本案不支持此动作。';
}
export function blathererActivityReason(s: SliceState, c: BlathererActivityCommand): string | null {
  if (!validateBlathererActivityCommand(c)) return '呓语者命令无效或不属于本案。';
  if (!promoted(s)) return '先真实晋升本作推断候选呓语者序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '同一本体已死亡或周目结束；低语不能复活或代办归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.blatherer.encounter.status)) return '先处理当前事件或真实战斗，同一本体不能在两处。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回贝克兰德原安静室。';
  const l = s.blatherer.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'LEAVE_CASE') return !r || l.activeCase !== c.caseId || !r.contactOpen ? '没有本案开放现场。' : cleanupBlock(s) ?? (r.attempts.at(-1)!.outcomeRecorded || r.attempts.at(-1)!.withdrawn ? null : '须先记录真实结果，或明确撤回未完成方案。');
  if (SCENES.includes(c.type as SceneType)) return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType) : '先START_CASE打开本案真实现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先实际停输入、等残余、归还原卡并步行退出当前现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一案准备。';
  if (hasBlathererOldPractice(s) || hasBlathererRitualLock(s)) return '先结束旧实践、原联系与服药准备，不挪动旧人旧物。';
  if (s.mind <= 0) return '先恢复精神再开始新实践；已经开始的实际收口不收新资源。';
  if (s.actionsRemaining < 1) return '需要保有1行动；先真实收口后可以跨周。';
  if (c.type === 'REFLECT') return l.reflected ? '本次反思已经完成。' : BLATHERER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!r || r.status === 'RESOLVED') return '本案有限报告已经完成。';
  const i = BLATHERER_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[BLATHERER_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成上一案真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已经观察本案，不重复领取。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原人原物。' : s.actionsRemaining < 2 ? '准备需1行动并另留1行动实际实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先选择能力或普通准备。';
  return r.status === 'EXAMINED' && !r.contactOpen && r.attempts.at(-1)?.outcomeRecorded ? null : '必须亲历完整原物核对、如实记录并真实退出后才能报告；取消不冒充完成。';
}
export const blockBlathererLife = blathererActivityReason;
export function advanceBlathererLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.blatherer.life.clockSeconds + seconds)) throw new Error('原安静室累计秒数无效。');
  s.blatherer.life.clockSeconds += seconds;
}
function elapse(s: SliceState, a: BlathererAttempt, seconds: number) { a.elapsedSeconds += seconds; advanceBlathererLifeClock(s, seconds); }
function move(s: SliceState, a: BlathererAttempt, to: BlathererLocation, metres: number) {
  const l = s.blatherer.life, ids = l.card.location === 'PLAYER' ? [l.card.id] : [];
  a.playerMoves.push({ from: l.playerLocation, to, mode: 'WALK', metres, seconds: metres, itemIds: ids });
  if (ids.length) l.card.travelMetres += metres;
  l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres);
}
function guideMove(s: SliceState, a: BlathererAttempt, to: BlathererLifeState['guide']['location'], metres: number) {
  const g = s.blatherer.life.guide; g.moves.push({ caseId: 'open-corridor', from: g.location, to, metres, seconds: metres, atSecond: a.elapsedSeconds }); g.location = to; g.travelMetres += metres; elapse(s, a, metres);
}
function startAttempt(s: SliceState, id: BlathererCaseId) {
  const l = s.blatherer.life, r = l.cases[id], a = freshAttempt(s, r.method!); r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(a); l.activeCase = id;
  if (id === 'open-corridor') { guideMove(s, a, 'START', 4); guideMove(s, a, 'B', 8); }
}
function addEvidence(a: BlathererAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function payResolution(s: SliceState, a: BlathererAttempt) { if (!a.resolutionPaid) { s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions++; } }
function applyScene(s: SliceState, id: BlathererCaseId, step: BlathererLifeStep): void {
  const l = s.blatherer.life, a = l.cases[id].attempts.at(-1)!; a.steps.push({ ...step });
  switch (step.type) {
    case 'GO_A': move(s, a, 'A', 4); break;
    case 'READ_CARD':
      a.cardRead = true; if (id !== 'withdrawn-invitation') { l.card.location = 'PLAYER'; a.cardTaken = true; } elapse(s, a, 1);
      addEvidence(a, l.card.id, id === 'withdrawn-invitation' ? '在A当面读诺拉持有的同一原邀请；原卡留在她手里，测试许可不等于答应邀请。' : '在A亲读同一原卡，诺拉只临时借出本案核对；原卡属她，不是低语取得的财物。'); break;
    case 'WALK_B': move(s, a, 'B', 4); break;
    case 'READ_BELL': {
      a.bellRead = true; elapse(s, a, 2);
      const text = '本人到B核同一BL3-BELL及BL3-NOTE已有记录：相似铃声可能来自普通交接；仅凭原纸与声音不能推定任何人同意邀请或服从。';
      addEvidence(a, l.bell.id, text); addEvidence(a, l.note.id, '亲读原记录后，保留来源与当前可见事实；不读隐藏内心。'); l.note.records.push({ caseId: id, text }); break;
    }
    case 'RETURN_A': move(s, a, 'A', 4); break;
    case 'ASK_GUIDE_LEAVE': guideMove(s, a, 'START', 8); guideMove(s, a, 'OUTSIDE', 4); a.guideLeft = true; break;
    case 'CONSENT_NORA': a.consent = l.volunteer.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 1); addEvidence(a, l.volunteer.id, a.consent === 'GRANTED' ? '本人在A当前明确只允许本案一次短试验，可随时撤回。' : '本人在A明确拒绝本次能力试验；不以检定强迫同意。'); break;
    case 'WHISPER':
      payResolution(s, a); s.spirituality -= 4; s.mind--; a.spiritualitySpent += 4; a.mindSpent++; a.whisperTier = step.tier; a.whisperSourceId = l.volunteer.id; a.voiceActive = true; elapse(s, a, 2); a.whisperAtSecond = a.elapsedSeconds;
      a.residualSeconds = success(step.tier) ? 30 : 0;
      addEvidence(a, l.volunteer.id, success(step.tier) ? '当前同意且实际听见2秒短低语后，只观察到原创G轻微迟疑；并无健康伤害、人格改写或服从承诺。' : '实际短试验失败；4灵性1精神及1行动已耗，没有可靠能力效果。');
      if (id === 'withdrawn-invitation') { a.consent = 'REVOKED'; addEvidence(a, l.volunteer.id, '这一次尝试后，诺拉当面明确撤回测试许可。旧同意立即失效；成功迟疑仍须真实等候，不会因拒绝瞬间消失。'); } break;
    case 'STOP_VOICE': a.voiceActive = false; a.stopped = true; break;
    case 'WAIT_CLEAR': a.waitedSeconds += a.residualSeconds; elapse(s, a, a.residualSeconds); a.residualSeconds = 0; a.waitCompleted = true; break;
    case 'ASK_CURRENT_ANSWER': a.currentAnswer = 'DECLINED'; if (a.consent === 'GRANTED') a.consent = 'REVOKED'; elapse(s, a, 1); addEvidence(a, l.volunteer.id, '停输入并等实际残余消退后当面询问：诺拉现在拒绝邀请。原卡仍归她，测试同意没有强迫她答应。'); break;
    case 'ORDINARY_CHECK': payResolution(s, a); a.ordinaryChecked = true; elapse(s, a, 2); addEvidence(a, l.note.id, '本人已往返A/B，普通比较亲读的原卡、原铃与原记录，并尊重当事人当前答复；未假称低语成功。'); break;
    case 'RECORD_OUTCOME':
      a.outcomeRecorded = true; a.result = success(a.whisperTier) ? 'ABILITY' : 'ORDINARY';
      a.outcome = `${a.result === 'ABILITY' ? '本次付费低语实际成功，只出现有限可见迟疑' : a.whisperTier === null ? '本次完全普通核对，没有施术或能力成功' : '本次付费低语失败，实际普通补查完成'}；原卡与原铃记录已亲自往返核对，输入停止且实际残余已结束。${id === 'withdrawn-invitation' ? '诺拉撤回测试许可并拒绝邀请，原卡始终由她持有。' : '原卡仍属诺拉，须当面归还后本人从普通门路离开。'}`;
      l.cases[id].result = a.result; elapse(s, a, 1); break;
    case 'RETURN_CARD': l.card.location = 'NORA'; a.cardReturned = true; elapse(s, a, 1); break;
    case 'RETURN_START': move(s, a, 'START', 4); break;
    case 'WITHDRAW': a.withdrawn = true; if (a.consent === 'GRANTED') a.consent = 'REVOKED'; a.voiceActive = false; if (a.whisperTier !== null) a.stopped = true; l.cases[id].withdrawals++; break;
  }
}
export function applyBlathererActivity(s: SliceState, c: BlathererActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = blathererActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.blatherer.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('blatherer-reflection'); ctx.note('G · 有限低语与当前许可反思', '三份真实报告后扮演+25；普通完成不加低语掌握，原恶意、紧绷、良知变化与旧成本全部保留。'); return; }
  const r = l.cases[c.caseId], spec = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备1行动已付，选择${c.method === 'ABILITY' ? '一次可失败的有限低语，实施另4灵性1精神1行动' : '普通核对，首次实施1行动0灵性'}；不会自动施术或取得许可。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施准备', '0行动，准备成本不退；原人原物没有复制或恢复。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, c.caseId === 'open-corridor' ? '0行动开场，本人仍在START；原罗安从室外真实4米到START、再8米到B，12秒12米已记录。他未同意听低语，须实际离场。' : '0行动打开本案；本人仍在START，未施术、未获得诺拉许可，也未领取原物。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `真实报告扮演+25；${r.result === 'ABILITY' ? '本案付费低语确实成功，且有原物核对、当前许可、实际等待及退出，掌握+8' : '普通核查或失败后普通补查不加能力掌握'}。已付成本、当事人拒绝和原历史不改写。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('真实退出原安静室', '本人已在START，原卡归诺拉，实际声输入与残余均结束；不补血、不补灵、不清旧风险。未完成撤回案不会冒充可报告成果。'); return; }
  const tier = c.type === 'WHISPER' ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, atSecond: a.elapsedSeconds, volunteerWilling: l.volunteer.willing });
  ctx.note(`G · ${c.type}`, `${c.type === 'WHISPER' ? `知识18结果${tier}，真实已耗4灵性1精神1行动；${success(tier) ? '只出现30秒有限可见迟疑' : '没有成功效果，成本不退'}。` : c.type === 'STOP_VOICE' ? '已停新输入，原成功迟疑仍须实际等待，不会瞬间治愈。' : c.type === 'RECORD_OUTCOME' ? a.outcome : '只记录此刻当面回答、同一原物或真实步行；没有远程施术和强迫接受。'} 本人${l.playerLocation}，本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，残余${a.residualSeconds}秒。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人从START实走到A', '0行动 · 4米4秒'], READ_CARD: ['在A当面亲读同一原卡', '0行动 · 1秒 · 邀请案原卡留诺拉手中'], WALK_B: ['本人沿普通路线走到B', '0行动 · 4米4秒'], READ_BELL: ['在B实核同一原铃与原记录', '0行动 · 2秒'], RETURN_A: ['本人从B普通走回A', '0行动 · 4米4秒'],
  ASK_GUIDE_LEAVE: ['请原罗安真实走出听距', '0行动 · B→START8米，再→室外4米 · 12秒'], CONSENT_NORA: ['在A询问诺拉当前一次短试验许可', '0行动 · 1秒 · 拒绝不重问'], WHISPER: ['向当前同意的诺拉尝试一次有限低语', '1行动 · 4灵性1精神 · 知识18 · 2秒 · G6米听距'], STOP_VOICE: ['停止实际声音输入，保留当前残余', '0行动0秒 · 不瞬间清除迟疑'], WAIT_CLEAR: ['实际等候当前有限迟疑结束', '0行动 · 成功残余30秒，无残余0秒'], ASK_CURRENT_ANSWER: ['当面问诺拉现在是否接受邀请', '0行动 · 1秒 · 本人当前答复'],
  ORDINARY_CHECK: ['普通比较原卡、原铃记录与当前答复', '首次1行动；已实际付实施行动的补查0行动 · 2秒'], RECORD_OUTCOME: ['如实记录本次真实结果与当前边界', '0行动 · 1秒'], RETURN_CARD: ['在A当面归还同一原卡给诺拉', '0行动 · 1秒'], RETURN_START: ['本人从A沿普通门路退出到START', '0行动 · 4米4秒'], WITHDRAW: ['撤回本次能力方案并停输入', '0行动 · 原残余仍需等待，原物须实际归还'],
};
export function blathererLifeActions(s: SliceState): BlathererLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.blatherer.life, actions: BlathererLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: BlathererActivityCommand) => { const reason = blathererActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[BLATHERER_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原人原物与听距边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备一次有限低语与真实收束', '1行动 · 另留1行动实施 · 施术另4灵性1精神', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备普通原物核对与当前答复', '1行动 · 另留1行动实施 · 0灵性', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案真实现场，不自动施术', '0行动 · 保留1行动实际实施', { type: 'START_CASE', caseId: id }); add(`${id}-cancel`, '取消尚未实施的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of SCENES) {
        const c = { type, caseId: id } as BlathererActivityCommand; if (!validateBlathererActivityCommand(c)) continue;
        const awaitingVoice = type === 'WHISPER' && a.method === 'ABILITY' && evidenceComplete(a) && l.playerLocation === 'A' && a.consent === 'GRANTED' && !a.resolutionPaid && !a.withdrawn;
        if (blathererActivityReason(s, c) === null || awaitingVoice) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], LABELS[type][1], c);
      }
      if (cleanupBlock(s) === null && (a.outcomeRecorded || a.withdrawn)) add(`${id}-leave`, '关闭已经真实退出的本案现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告本人核对、当前答复与真实收束', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '本次实际低语成功掌握+8' : '普通结果无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && BLATHERER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('blatherer-reflect', '反思有限低语、当前许可和旧风险', '1行动 · 扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectBlathererLife(s: SliceState): BlathererLifeProjection {
  const l = s.blatherer.life, a = currentBlathererAttempt(s), actions = blathererLifeActions(s), inside = hasBlathererLifeLock(s);
  const next = actions.find(v => v.enabled && v.command.type !== 'WITHDRAW' && !(v.command.type === 'ORDINARY_CHECK' && a?.method === 'ABILITY' && !a.resolutionPaid && actions.some(x => x.enabled && ['CONSENT_NORA', 'WHISPER', 'ASK_GUIDE_LEAVE'].includes(x.command.type)))) ?? actions.find(v => v.enabled);
  return { ...structuredClone(l), title: '呓语者 · 有限低语与当前听者', story: BLATHERER_LIFE_STORY, environment: BLATHERER_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : l.reflected ? '三份真实报告与反思完成；原物、拒绝、失败成本和旧风险保留，可继续普通生活。' : '先晋升或完成当前真实条件。',
    facts: [
      `同一本体在${l.playerLocation}，累计普通步行${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒（含实际战斗）。START0米、A4米、B8米；A↔B4米、A↔START4米，不能从B直接退出。`,
      `原成年诺拉·温特/${l.volunteer.id}/46岁现位于${l.volunteer.location}，${a ? `本案当前许可${a.consent}，当前声输入${a.voiceActive ? '尚未明确停止' : '已停止或未开始'}，残余${a.residualSeconds}秒` : '新案必须当面取得独立当前许可'}；本人可拒绝或撤回，检定不授予服从。`,
      `同一${l.card.id}归诺拉，现由${l.card.location === 'NORA' ? '她本人' : '玩家临时'}持有，随身累计${l.card.travelMetres}米；邀请案原卡始终留她手里。原${l.bell.id}与${l.note.id}留在B，旧魔鬼纸张不改装。`,
      `原罗安·费里在${l.guide.location}，实际步行${l.guide.travelMetres}米。B距A4米，属于G6米听距；室外位于−4米、距A8米，必须真正走出听距。熟人不免疫。`,
      a?.outcome ?? '尚未形成当前真实结果；不会提前给出能力成功或当事人接受。',
      '实际成功也只有有限轻微可见迟疑；STOP_VOICE0秒只停输入，WAIT_CLEAR成功30秒/失败0秒。没有健康损伤、永久精神疾病、物权转移或人格改写。',
      '普通三案与反思可得G扮演100，但不算新低语掌握，不消除旧恶意、紧绷、良知后果、受伤或失控风险。',
    ], cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '付费低语实际成功，原物核对与真实收束完成；报告掌握+8' : '实际普通完成或失败后普通补查；无能力掌握', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

/** Replay every finite original-object, listener, consent, cost, movement and residual event. */
export function validateBlathererLifeOriginal(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
/** New S2 movements must replay back to the same closed S3 source before its old history is validated. */
export function blathererHistoricalState(s: SliceState): SliceState | null {
  if (s.progression.pathwayId !== 'abyss' || s.progression.sequence !== 2) return s;
  if (s.bloodDuke?.blathererActingAtPromotion !== 100 || !integer(s.bloodDuke?.promotionWeek, s.blatherer.promotionWeek ?? s.week, s.week)) return null;
  const original = reconstructBloodDukeOriginalRoot(s);
  if (!original || original.activeCase !== null || !original.reflected || original.playerLocation !== 'START' || original.card.location !== 'NORA' || original.volunteer.location !== 'A') return null;
  return { ...s, week: s.bloodDuke.promotionWeek!, activeEvent: null, combat: null,
    progression: { ...s.progression, sequence: 3, acting: s.bloodDuke.blathererActingAtPromotion },
    blatherer: { ...s.blatherer, life: original } };
}
export function validateBlathererLife(s: SliceState): boolean { try {
  const historical = blathererHistoricalState(s);
  return historical !== null && validateBlathererLifeOriginal(historical);
} catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.blatherer?.life, initial = createBlathererLifeState(), promotion = s.blatherer?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, BLATHERER_CASE_IDS)) return false;
  let combatSeconds = 0;
  for (const round of s.combatHistory) { const seconds = round.blathererOutcome?.elapsedSeconds ?? 0; if (!integer(seconds)) return false; combatSeconds += seconds; }
  const encounter = s.blatherer.encounter;
  if (encounter.status === 'RESOLVED' && encounter.startHistoryIndex === null && encounter.scene.playerPosition === 'EXIT') combatSeconds += 4;
  if (!integer(combatSeconds) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.siteId !== initial.siteId || !['START', 'A', 'B'].includes(l.playerLocation) || l.activeCase !== null && !BLATHERER_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['volunteer', 'guide', 'card', 'bell', 'note'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (typeof l.volunteer.willing !== 'boolean' || stableStringify(l.volunteer) !== stableStringify({ ...initial.volunteer, willing: l.volunteer.willing })) return false;
  if (s.seer.completedSources.filter(source => source === 'blatherer-reflection').length !== Number(l.reflected)) return false;
  for (const id of BLATHERER_CASE_IDS) if (s.seer.completedSources.filter(source => source === sourceFor(id)).length !== Number(l.cases[id].status === 'RESOLVED')) return false;
  const pristine = { ...initial, clockSeconds: combatSeconds, volunteer: { ...initial.volunteer, willing: l.volunteer.willing } };
  if (promotion === null) return stableStringify(l) === stableStringify(pristine);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(pristine);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['conflicting-bell'].observedWeek !== l.introducedWeek) return false;
  const replay = createBlathererLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, blatherer: { ...s.blatherer, life: replay } };
  let open = 0, prepared = 0, resolved = 0, masteryEarned = 0;
  for (const [index, id] of BLATHERER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[BLATHERER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind; shadow.actionsRemaining = 100;
    replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [], status: 'PREPARED', contactOpen: false, closes: 0, returned: false, withdrawals: r.withdrawals - Number(a.withdrawn) };
    if (!integer(replay.cases[id].withdrawals)) return false;
    startAttempt(shadow, id); const expected = replay.cases[id].attempts[0]!;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'atSecond', 'volunteerWilling']) || typeof step.volunteerWilling !== 'boolean' || step.atSecond !== expected.elapsedSeconds || step.type !== 'WHISPER' && step.tier !== null || step.type === 'WHISPER' && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (!SCENES.includes(step.type) || !validateBlathererActivityCommand({ type: step.type, caseId: id })) return false;
      replay.volunteer.willing = step.volunteerWilling;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if ((!expected.outcomeRecorded && !expected.withdrawn) || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed || replay.cases[id].withdrawals !== r.withdrawals) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (r.result === 'ABILITY') masteryEarned += 8; }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.volunteer.willing = l.volunteer.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) >= masteryEarned;
}
