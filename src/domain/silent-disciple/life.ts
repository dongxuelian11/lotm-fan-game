import { validateAncientEvilSourceSilentDiscipleLife } from '../ancient-evil/life.js';
import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasAncientEvilContinuation, hasSilentDiscipleOldPractice, hasSilentDiscipleRitualLock } from './index.js';

export const SILENT_DISCIPLE_CASE_IDS = ['original-body', 'revoked-form', 'measured-link'] as const;
export type SilentDiscipleCaseId = typeof SILENT_DISCIPLE_CASE_IDS[number];
export type SilentDiscipleLocation = 'START' | 'A' | 'B';
export type SilentDiscipleConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED';
type SceneType = 'GO_A' | 'READ_IDENTITY' | 'STORE_ITEMS' | 'CONSENT_ELSA' | 'PERFORM' | 'STOP_INPUT' | 'WALK_B' | 'READ_NOTE' | 'RETURN_A' | 'COMPARE_IDENTITY' | 'WAIT_FORM' | 'RELEASE_FORM' | 'DROP_LINK' | 'WAIT_LINK' | 'RETURN_ITEMS' | 'ORDINARY_CHECK' | 'RECORD_OUTCOME' | 'RETURN_START' | 'WITHDRAW';
type MoonType = 'READ_MOON_NOTICE' | 'GUIDED_REST' | 'ENDURE_REST' | 'WAIT_MOON';
export type SilentDiscipleActivityCommand =
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | SceneType; caseId: SilentDiscipleCaseId }
  | { type: 'PREPARE'; caseId: SilentDiscipleCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' | MoonType };
export interface SilentDiscipleMovement { from: SilentDiscipleLocation; to: SilentDiscipleLocation; mode: 'WALK'; metres: number; seconds: number; itemIds: string[] }
export interface SilentDiscipleEvidence { sourceId: string; text: string; atSecond: number }
export interface SilentDiscipleLifeStep { type: SceneType; tier: PublicResolutionTier | null; atSecond: number; volunteerWilling: boolean }
export interface SilentDiscipleAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; elapsedSeconds: number; playerTravelMetres: number; playerMoves: SilentDiscipleMovement[]; steps: SilentDiscipleLifeStep[];
  spiritualitySpent: number; mindSpent: number; resolutionPaid: boolean; resolutionActions: number;
  consent: SilentDiscipleConsent; withdrawn: boolean; identityRead: boolean; noteRead: boolean; identityCompared: boolean; comparedForm: 'HUMAN' | 'RABBIT' | null;
  itemsStored: boolean; itemsReturned: boolean; abilityTier: PublicResolutionTier | null; abilitySourceId: 'SD3-ELSA' | null; abilityAtSecond: number | null;
  inputActive: boolean; stopped: boolean; formRemainingSeconds: number; linkRemainingSeconds: number; linkState: 'NONE' | 'LINKED';
  waitedSeconds: number; waitCompleted: boolean; released: boolean; ordinaryChecked: boolean;
  evidence: SilentDiscipleEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface SilentDiscipleCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: SilentDiscipleAttempt[];
}
export interface SilentDiscipleMoonState {
  id: 'SD3-OBSERVATORY-NOTICE'; status: 'UNREAD' | 'ANNOUNCED' | 'RESTING' | 'RESOLVED'; announcedWeek: number | null;
  choice: 'GUIDED_REST' | 'ENDURE_REST' | null; startedWeek: number | null; initialMind: number | null; initialCash: number | null;
  mindSpent: number; cashSpent: number; remainingSeconds: number; elapsedSeconds: number;
}
export interface SilentDiscipleLifeState {
  siteId: 'SD3-QUIET-ROOM'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: SilentDiscipleCaseId | null;
  playerLocation: SilentDiscipleLocation; playerTravelMetres: number; clockSeconds: number;
  volunteer: { id: 'SD3-ELSA'; name: '埃尔莎·莫尔'; age: 43; alive: true; willing: boolean; location: 'A' | 'START' | 'OUTSIDE'; bodyId: 'SD3-ELSA'; form: 'HUMAN' | 'RABBIT'; health: 100; mind: 100; spirituality: 100; injuries: [] };
  guide: { id: 'HARLAN'; name: '哈伦·维斯'; location: 'START' | 'OUTSIDE' };
  clothing: { id: 'SD3-CLOTHES'; owner: 'SD3-ELSA'; quantity: 1; location: 'ELSA' | 'TRAY'; worn: boolean };
  bag: { id: 'SD3-BAG'; owner: 'SD3-ELSA'; quantity: 1; location: 'ELSA' | 'TRAY' };
  tray: { id: 'SD3-TRAY'; location: 'A'; privacy: 'PRIVATE' };
  note: { id: 'SD3-NOTE'; quantity: 1; location: 'B'; records: { caseId: SilentDiscipleCaseId; text: string }[] };
  cases: Record<SilentDiscipleCaseId, SilentDiscipleCaseState>; reflected: boolean; moon: SilentDiscipleMoonState;
}
export interface SilentDiscipleLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilentDiscipleActivityCommand }
export interface SilentDiscipleLifeProjection extends Omit<SilentDiscipleLifeState, 'cases'> {
  title: string; story: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: SilentDiscipleAttempt | null;
  cases: { id: SilentDiscipleCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: SilentDiscipleAttempt[] }[];
  actions: SilentDiscipleLifeAction[];
}
const FORM_ABILITY = 'chained.s3.short-transfiguration' as const;
const LINK_ABILITY = 'chained.s3.measured-curse' as const;
export const SILENT_DISCIPLE_LIFE_STORY = '原著确认序列3沉默门徒古称诅咒之物，变形诅咒有方向依据，但完整配方、仪式与本阶具体月圆规则仍未知。以下成年志愿者、兔形、60秒、有限联系、所有数值与安全程序均为原创G；职业名称不赋予自动沉默。埃尔莎始终只有同一原身体，原衣物与包不随形态复制。当前同意仅限一次试验，可拒绝或撤回；本生活联系明确不允许伤害、反射或身体控制。和平扮演100是有限G替代，不保证无风险消化，不清旧伤或月相历史。';
export const SILENT_DISCIPLE_LIFE_ENVIRONMENT = '三案各观察1行动、准备1行动、首次实际实施1行动、真实报告1行动，反思1行动，共13行动。START_CASE0行动只开场。变形另5灵性2精神、知识20，联系另4灵性1精神、知识18；失败照付。START0米、A4米、B8米，实走1米/秒，每案普通往返16米。WAIT_FORM等待当下真实剩余60秒，RELEASE_FORM另2灵性；复原后须在A私下穿回原衣并归还原包，不能瞬间配装。';
const CASES = [
  { id: 'original-body', title: 'G · 同一身体与原衣物', story: '43岁的原成年埃尔莎在A，只允许一次原创G兔形60秒短试验。先看原身份，私下把同一套原衣与原包放进A的原私密托盘，再核当前许可。成功只改变她的同一身体，健康、精神、灵性与伤势不变；本人实走到B读原记录再返A核同一身体，实际等复原后私下归物穿衣，沿4米原门路退出。' },
  { id: 'revoked-form', title: 'G · 撤回许可后的实际复原', story: '埃尔莎只可能先允许一次初始短试验；实际尝试后立即明确撤回。必须停止新输入，不得复用旧许可。原兔形不会因撤回瞬间消失，可付2灵性有限解除或真实等待剩余秒数；没灵性也总能等待。原身体恢复HUMAN后再私下穿回同一原衣，原包归她，不能把兔形志愿者留在原地后离场。' },
  { id: 'measured-link', title: 'G · 非伤害的有限联系', story: '埃尔莎仅允许一次近身非伤害联系，明确不允许自伤反射、伤害她或控制身体。本人在A与她实际近距接触后才能付费检定，成功30秒有限LINKED；必须真实DROP_LINK或等到结束。再亲走B核同一原纸并回A比较身份，普通退出。没有自伤、伤害退款或反射掌握。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'READ_IDENTITY', 'STORE_ITEMS', 'CONSENT_ELSA', 'PERFORM', 'STOP_INPUT', 'WALK_B', 'READ_NOTE', 'RETURN_A', 'COMPARE_IDENTITY', 'WAIT_FORM', 'RELEASE_FORM', 'DROP_LINK', 'WAIT_LINK', 'RETURN_ITEMS', 'ORDINARY_CHECK', 'RECORD_OUTCOME', 'RETURN_START', 'WITHDRAW'];
const MOON_TYPES: readonly MoonType[] = ['READ_MOON_NOTICE', 'GUIDED_REST', 'ENDURE_REST', 'WAIT_MOON'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 3;
const sourceFor = (id: SilentDiscipleCaseId) => `silent-disciple-life-${id}`;
const abilityFor = (id: SilentDiscipleCaseId) => id === 'measured-link' ? LINK_ABILITY : FORM_ABILITY;
const freshCase = (): SilentDiscipleCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): SilentDiscipleAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, mindSpent: 0, resolutionPaid: false, resolutionActions: 0,
    consent: 'UNASKED', withdrawn: false, identityRead: false, noteRead: false, identityCompared: false, comparedForm: null, itemsStored: false, itemsReturned: false, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, inputActive: false, stopped: false, formRemainingSeconds: 0, linkRemainingSeconds: 0, linkState: 'NONE', waitedSeconds: 0, waitCompleted: false, released: false, ordinaryChecked: false, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createSilentDiscipleLifeState(): SilentDiscipleLifeState {
  return { siteId: 'SD3-QUIET-ROOM', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    volunteer: { id: 'SD3-ELSA', name: '埃尔莎·莫尔', age: 43, alive: true, willing: true, location: 'A', bodyId: 'SD3-ELSA', form: 'HUMAN', health: 100, mind: 100, spirituality: 100, injuries: [] },
    guide: { id: 'HARLAN', name: '哈伦·维斯', location: 'START' }, clothing: { id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true }, bag: { id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' }, tray: { id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' }, note: { id: 'SD3-NOTE', quantity: 1, location: 'B', records: [] },
    cases: { 'original-body': freshCase(), 'revoked-form': freshCase(), 'measured-link': freshCase() }, reflected: false,
    moon: { id: 'SD3-OBSERVATORY-NOTICE', status: 'UNREAD', announcedWeek: null, choice: null, startedWeek: null, initialMind: null, initialCash: null, mindSpent: 0, cashSpent: 0, remainingSeconds: 0, elapsedSeconds: 0 } };
}
export function validateSilentDiscipleActivityCommand(v: unknown): v is SilentDiscipleActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT' || MOON_TYPES.includes(v.type as MoonType)) return shape(v, ['type']);
  if (typeof v.caseId !== 'string' || !SILENT_DISCIPLE_CASE_IDS.includes(v.caseId as SilentDiscipleCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (!shape(v, ['type', 'caseId'])) return false;
  if (['STORE_ITEMS', 'RETURN_ITEMS', 'WAIT_FORM', 'RELEASE_FORM'].includes(v.type) && v.caseId === 'measured-link') return false;
  if (['DROP_LINK', 'WAIT_LINK'].includes(v.type) && v.caseId !== 'measured-link') return false;
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', ...SCENES].includes(v.type);
}
export const currentSilentDiscipleAttempt = (s: SliceState) => s.silentDisciple.life.activeCase ? s.silentDisciple.life.cases[s.silentDisciple.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.silentDisciple.life, a = currentSilentDiscipleAttempt(s);
  if (a?.inputActive) return '先STOP_INPUT停止新输入；撤回或关闭页面不代办停止。';
  if (l.volunteer.form !== 'HUMAN' || (a?.formRemainingSeconds ?? 0) > 0) return '同一埃尔莎仍为兔形；须WAIT_FORM实际等待或付2灵性RELEASE_FORM，不能丢下她。';
  if (a?.linkState === 'LINKED' || (a?.linkRemainingSeconds ?? 0) > 0) return '须DROP_LINK实际断开或WAIT_LINK等原联系结束。';
  if (l.clothing.location !== 'ELSA' || !l.clothing.worn || l.bag.location !== 'ELSA') return '须本人在A待同一身体复原后RETURN_ITEMS，私下穿回原衣并归还原包。';
  return l.playerLocation !== 'START' ? '须本人从B走4米返A，再走4米回START，不能传送或假报退出。' : null;
}
export const hasSilentDiscipleLifeLock = (s: SliceState): boolean => !hasAncientEvilContinuation(s) && (['ANNOUNCED', 'RESTING'].includes(s.silentDisciple.life.moon.status) || s.silentDisciple.life.activeCase !== null || Object.values(s.silentDisciple.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null);
const evidenceComplete = (a: SilentDiscipleAttempt) => a.identityRead && a.noteRead && a.identityCompared;
function sceneReason(s: SliceState, id: SilentDiscipleCaseId, type: SceneType): string | null {
  const l = s.silentDisciple.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation;
  if (type === 'WITHDRAW') return a.withdrawn ? '本次已撤回；仍须真实等待、归物与退出。' : null;
  if (type === 'STOP_INPUT') return a.abilityTier !== null && !a.stopped ? null : '须确有实际能力尝试且尚未停止，普通路线没有虚构输入可停。';
  if (type === 'WAIT_FORM' || type === 'WAIT_LINK') return at === 'A' && a.abilityTier !== null && a.stopped && !a.waitCompleted && !a.released ? null : '须本人在A停止实际输入后等待本次真实剩余时间；失败可记录0秒，不造效果。';
  if (type === 'RELEASE_FORM') return at !== 'A' || !a.stopped || l.volunteer.form !== 'RABBIT' || a.formRemainingSeconds <= 0 ? '须在A已停止输入，且同一身体仍有真实兔形。' : s.spirituality < 2 ? '有限解除实耗2灵性；没灵性仍可WAIT_FORM实际等候。' : null;
  if (type === 'DROP_LINK') return at === 'A' && a.stopped && a.linkState === 'LINKED' ? null : '须本人在A停止输入后断开本次已实际建立的原联系。';
  if (type === 'RETURN_ITEMS') return at === 'A' && a.itemsStored && !a.itemsReturned && l.volunteer.form === 'HUMAN' && !a.inputActive && l.clothing.location === 'TRAY' && l.bag.location === 'TRAY' ? null : '须在A、停止输入并实际复原，再从原私密托盘取回同一原衣与原包；没有新衣物。';
  if (type === 'RETURN_START') return at === 'A' && l.volunteer.form === 'HUMAN' && l.clothing.location === 'ELSA' && l.clothing.worn && l.bag.location === 'ELSA' && !a.inputActive && a.linkState === 'NONE' && (a.outcomeRecorded || a.withdrawn) ? null : '须先让同一身体真正复原、原物归主、实际断开联系并如实记录或撤回，再走4米退出。';
  if (type === 'RETURN_A') return at === 'B' && (a.noteRead || a.withdrawn) ? null : '须已在B读原记录或明确撤回，再实走4米返A。';
  if (a.outcomeRecorded) return '本次真实结果已经记录，只可处理实际归物与退出。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 ? null : '本次只从START沿4米普通路线进入A一次。';
  if (type === 'READ_IDENTITY') return at === 'A' && !a.identityRead && l.volunteer.form === 'HUMAN' ? null : '须本人先到A面对原埃尔莎，记录她同一原身份与实际身体。';
  if (type === 'STORE_ITEMS') return at === 'A' && a.identityRead && a.method === 'ABILITY' && !a.resolutionPaid && !a.itemsStored && !a.withdrawn && l.clothing.location === 'ELSA' && l.bag.location === 'ELSA' ? null : '能力形态试验前，须在A私下存放同一套原衣和原包；普通路线不脱换。';
  if (type === 'CONSENT_ELSA') return at === 'A' && a.identityRead && (id === 'measured-link' || a.itemsStored) && a.method === 'ABILITY' && a.consent === 'UNASKED' && !a.withdrawn && !a.resolutionPaid ? null : '须在A完成原身份与实际准备，再问一次当前许可；拒绝、撤回或已尝试后不重复索取。';
  if (type === 'WALK_B') return at === 'A' && a.identityRead && !a.noteRead && !a.inputActive ? null : '先亲见原身份并停止实际输入，再实走4米到B读原纸。';
  if (type === 'READ_NOTE') return at === 'B' && a.identityRead && !a.noteRead ? null : '本人须已实际走到B，亲读同一SD3-NOTE。';
  if (type === 'COMPARE_IDENTITY') return at === 'A' && a.noteRead && !a.identityCompared ? null : '须已实走回A，用B的真实原记录核同一埃尔莎与当前身体；不能遥看。';
  if (type === 'PERFORM') {
    if (a.resolutionPaid || a.withdrawn) return '首次实施已付或方案已撤回，不得重新施术或重复付费。';
    if (a.method === 'ORDINARY') return at !== 'A' || !evidenceComplete(a) ? '须亲见原身体，实际往返B读取原纸，再返A普通核对。' : s.actionsRemaining < 1 ? '首次普通实施需1行动。' : null;
    if (at !== 'A' || !a.identityRead || a.consent !== 'GRANTED' || !l.volunteer.willing || a.stopped || (id !== 'measured-link' && (!a.itemsStored || l.clothing.location !== 'TRAY' || l.bag.location !== 'TRAY'))) return '仅本人在A、当前明确同意的近身一次试验可用；原衣先存妥，不复用旧许可。';
    const sc = id === 'measured-link' ? 4 : 5, mc = id === 'measured-link' ? 1 : 2;
    return s.actionsRemaining < 1 ? '实际实施需要1行动。' : s.spirituality < sc ? `需要${sc}灵性，失败实耗；可转普通核验。` : s.mind < mc ? `需要${mc}精神，失败实耗。` : null;
  }
  if (type === 'ORDINARY_CHECK') return at !== 'A' || !evidenceComplete(a) || a.ordinaryChecked || a.inputActive || l.volunteer.form !== 'HUMAN' || a.linkState !== 'NONE' ? '须在A完成原身份与原纸核对，停止输入并实际复原或断开；普通补查不伪称能力成功。' : !a.resolutionPaid && s.actionsRemaining < 1 ? '未曾实施的普通核对需1行动，失败后补查0行动。' : null;
  if (type === 'RECORD_OUTCOME') return at === 'A' && evidenceComplete(a) && a.resolutionPaid && !a.inputActive && l.volunteer.form === 'HUMAN' && a.linkState === 'NONE' && (a.abilityTier === null || a.waitCompleted || a.released) && (success(a.abilityTier) || a.ordinaryChecked) && (!a.itemsStored || a.itemsReturned) && (id !== 'revoked-form' || a.abilityTier === null || a.consent === 'REVOKED') ? null : '须完整往返核原身份与原纸、真实实施、停止并复原/断开、归还原物，再如实报告；失败不能冒充成功。';
  return '本案不支持此动作。';
}
function moonReason(s: SliceState, type: MoonType): string | null {
  const l = s.silentDisciple.life, m = l.moon;
  if (l.activeCase !== null || Object.values(l.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) || hasSilentDiscipleOldPractice(s) || hasSilentDiscipleRitualLock(s)) return '须先真实结束现有实践、原形态/联系与服药准备。';
  if (type === 'READ_MOON_NOTICE') return m.status !== 'UNREAD' ? '同一观测告示只能领取一次，不循环刷新。' : s.silentDisciple.promotionWeek === null || s.week < s.silentDisciple.promotionWeek + 2 ? '晋升满2周后当地观测所才公布本次原创G告示，不以周数模4伪造月相。' : null;
  if (type === 'WAIT_MOON') return m.status === 'RESTING' ? null : '先明确选择本次守望或独处，才可实际等待3600秒。';
  if (m.status !== 'ANNOUNCED') return '须先亲读本次原观测告示，不能重复处理。';
  return s.actionsRemaining < 1 ? '本次休息需要1行动。' : type === 'GUIDED_REST' && s.cash < 60 ? '守望休息实付60便士；可选不付钱、精神代价较高的独处。' : null;
}
export function silentDiscipleActivityReason(s: SliceState, c: SilentDiscipleActivityCommand): string | null {
  if (!validateSilentDiscipleActivityCommand(c)) return '沉默门徒命令无效、额外字段或不属于本案。';
  if (!promoted(s)) return '先实际晋升沉默门徒序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '同一本体已死亡或周目结束，不能操作、复活或代办归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.silentDisciple.encounter.status)) return '先处理当前事件或实际战斗，同一本体不能同时在两处。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回贝克兰德原安静室。';
  if (MOON_TYPES.includes(c.type as MoonType)) return moonReason(s, c.type as MoonType);
  const l = s.silentDisciple.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (['ANNOUNCED', 'RESTING'].includes(l.moon.status)) return '已亲读本次原创G月相告示，须先真实处理并等待完毕，不能取消退款或叠加旧诅咒。';
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'LEAVE_CASE') return !r || l.activeCase !== c.caseId || !r.contactOpen ? '没有本案开放现场。' : cleanupBlock(s) ?? (r.attempts.at(-1)!.outcomeRecorded || r.attempts.at(-1)!.withdrawn ? null : '先如实记录结果，或明确撤回未完成方案。');
  if (SCENES.includes(c.type as SceneType)) return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType) : '先START_CASE打开本案实际现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先停止、实际等待复原/断开、归还原物并沿原路退出。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一案准备。';
  if (hasSilentDiscipleOldPractice(s) || hasSilentDiscipleRitualLock(s)) return '先结束旧实践、旧月相、原形态/联系与服药准备。';
  if (s.mind <= 0) return '先恢复精神再开始新实践；已开始的实际收束不另收资源。';
  if (s.actionsRemaining < 1) return '需要保有1行动，真实收束后可跨周。';
  if (c.type === 'REFLECT') return l.reflected ? '本次反思已完成。' : SILENT_DISCIPLE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!('caseId' in c) || !r || r.status === 'RESOLVED') return '本案有限报告已经完成。';
  const i = SILENT_DISCIPLE_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[SILENT_DISCIPLE_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成上一案真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已经观察，不重复领取。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原身体与原物。' : s.actionsRemaining < 2 ? '准备需1行动，并另留1行动首次实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先选择能力或普通准备。';
  return r.status === 'EXAMINED' && !r.contactOpen && r.attempts.at(-1)?.outcomeRecorded ? null : '必须完整核验、如实记录并真正退出后才能报告；放弃不能冒充完成。';
}
export const blockSilentDiscipleLife = silentDiscipleActivityReason;
export function advanceSilentDiscipleLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.silentDisciple.life.clockSeconds + seconds)) throw new Error('原安静室累计秒数无效。');
  s.silentDisciple.life.clockSeconds += seconds;
}
function elapse(s: SliceState, a: SilentDiscipleAttempt, seconds: number) {
  a.elapsedSeconds += seconds; advanceSilentDiscipleLifeClock(s, seconds);
  a.formRemainingSeconds = Math.max(0, a.formRemainingSeconds - seconds); a.linkRemainingSeconds = Math.max(0, a.linkRemainingSeconds - seconds);
  if (a.formRemainingSeconds === 0) s.silentDisciple.life.volunteer.form = 'HUMAN';
  if (a.linkRemainingSeconds === 0) a.linkState = 'NONE';
}
function move(s: SliceState, a: SilentDiscipleAttempt, to: SilentDiscipleLocation, metres: number) {
  const l = s.silentDisciple.life; a.playerMoves.push({ from: l.playerLocation, to, mode: 'WALK', metres, seconds: metres, itemIds: [] });
  l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres);
}
function startAttempt(s: SliceState, id: SilentDiscipleCaseId) { const l = s.silentDisciple.life, r = l.cases[id]; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = id; }
function addEvidence(a: SilentDiscipleAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function payResolution(s: SliceState, a: SilentDiscipleAttempt) { if (!a.resolutionPaid) { s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions++; } }
function applyScene(s: SliceState, id: SilentDiscipleCaseId, step: SilentDiscipleLifeStep): void {
  const l = s.silentDisciple.life, a = l.cases[id].attempts.at(-1)!; a.steps.push({ ...step });
  switch (step.type) {
    case 'GO_A': move(s, a, 'A', 4); break;
    case 'READ_IDENTITY': a.identityRead = true; elapse(s, a, 1); addEvidence(a, l.volunteer.id, '当面核原成年埃尔莎与同一SD3-ELSA身体，当前HUMAN，原衣与包都归本人；不创建备用人身。'); break;
    case 'STORE_ITEMS': l.clothing.location = 'TRAY'; l.clothing.worn = false; l.bag.location = 'TRAY'; a.itemsStored = true; elapse(s, a, 3); addEvidence(a, l.tray.id, '私下完成换装准备，唯一原衣SD3-CLOTHES和原包SD3-BAG实际放在A的原私密托盘；不描写身体、不生成替换物。'); break;
    case 'CONSENT_ELSA': a.consent = l.volunteer.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 1); addEvidence(a, l.volunteer.id, a.consent === 'DECLINED' ? '埃尔莎当前明确拒绝，不重问、不施术，保留普通核验路线。' : id === 'measured-link' ? '本人当前只同意一次近身30秒非伤害联系，明确禁止伤害、反射与控制。' : '本人当前只同意一次60秒兔形短试验，可随时撤回；先前或别案同意不能复用。'); break;
    case 'PERFORM':
      payResolution(s, a);
      if (a.method === 'ORDINARY') { a.ordinaryChecked = true; elapse(s, a, 2); addEvidence(a, l.note.id, '普通完成原身份、原身体与原纸比较，没有施术或虚构联系。'); break; }
      { const link = id === 'measured-link', sc = link ? 4 : 5, mc = link ? 1 : 2;
        s.spirituality -= sc; s.mind -= mc; a.spiritualitySpent += sc; a.mindSpent += mc; a.abilityTier = step.tier; a.abilitySourceId = l.volunteer.id; a.inputActive = true; elapse(s, a, 2); a.abilityAtSecond = a.elapsedSeconds;
        if (success(step.tier)) { if (link) { a.linkState = 'LINKED'; a.linkRemainingSeconds = 30; } else { l.volunteer.form = 'RABBIT'; a.formRemainingSeconds = 60; } }
        addEvidence(a, l.volunteer.id, success(step.tier) ? link ? '当前本人同意且实际在A近身接触，建立原创G30秒有限联系；没有伤害、自伤、反射或控制。' : '同一SD3-ELSA原身体现为原创G兔形60秒，原健康、精神、灵性与伤势不变，原衣与包仍在原托盘。' : `实际检定失败，${sc}灵性${mc}精神与1行动已耗，没有建立形态或联系。`);
        if (id === 'revoked-form') { a.consent = 'REVOKED'; addEvidence(a, l.volunteer.id, '实际尝试后埃尔莎明确撤回本次许可；立即禁止新施术，已有兔形仍须真实解除或等待。'); }
      } break;
    case 'STOP_INPUT': a.inputActive = false; a.stopped = true; break;
    case 'WALK_B': move(s, a, 'B', 4); break;
    case 'READ_NOTE': { a.noteRead = true; elapse(s, a, 2); const text = '本人在B亲读唯一原纸SD3-NOTE：埃尔莎只拥有同一原身体，原衣与包各一份、归她；当前许可与实际形态必须回A当面核验，原记录不授予控制权。'; addEvidence(a, l.note.id, text); l.note.records.push({ caseId: id, text }); break; }
    case 'RETURN_A': move(s, a, 'A', 4); break;
    case 'COMPARE_IDENTITY': a.identityCompared = true; a.comparedForm = l.volunteer.form; addEvidence(a, l.volunteer.id, `本人返A当面比对原纸与同一SD3-ELSA，实际当前${l.volunteer.form}；没有同时存在第二人身，旧许可不覆盖当前拒绝。`); elapse(s, a, 1); break;
    case 'WAIT_FORM': case 'WAIT_LINK': { const seconds = step.type === 'WAIT_FORM' ? a.formRemainingSeconds : a.linkRemainingSeconds; a.waitedSeconds += seconds; elapse(s, a, seconds); a.waitCompleted = true; break; }
    case 'RELEASE_FORM': s.spirituality -= 2; a.spiritualitySpent += 2; a.formRemainingSeconds = 0; l.volunteer.form = 'HUMAN'; a.released = true; addEvidence(a, l.volunteer.id, '已停止后实付2灵性执行已知原创G有限解除，同一身体恢复HUMAN；不治疗、不自动穿回原衣。'); break;
    case 'DROP_LINK': a.linkState = 'NONE'; a.linkRemainingSeconds = 0; a.released = true; addEvidence(a, l.volunteer.id, '实际断开当前原联系，没有造成伤害、返还资源或练习反射。'); break;
    case 'RETURN_ITEMS': l.clothing.location = 'ELSA'; l.clothing.worn = true; l.bag.location = 'ELSA'; a.itemsReturned = true; elapse(s, a, 3); addEvidence(a, l.clothing.id, '同一身体已HUMAN，在A私下从原托盘取回并穿回唯一原衣，唯一原包归埃尔莎持有；复原和穿衣为两次真实步骤。'); break;
    case 'ORDINARY_CHECK': payResolution(s, a); a.ordinaryChecked = true; elapse(s, a, 2); addEvidence(a, l.note.id, '普通比较同一原纸、当面身份与当前答复，能力失败不冒充成功；已付实施行动不再收取。'); break;
    case 'RECORD_OUTCOME':
      a.outcomeRecorded = true; a.result = success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'; a.outcome = `${a.result === 'ABILITY' ? id === 'measured-link' ? '实际成功建立一次有限非伤害联系，已真实断开' : '实际成功改变同一原身体，现已实际恢复HUMAN并私下归物穿衣' : a.abilityTier === null ? '完全普通核验，无能力成功' : '实际能力失败保留成本，已完成普通补查'}；本人亲走B核原纸并返A比较身份。${id === 'revoked-form' && a.abilityTier !== null ? '本案撤回许可永久保留，不得再施术。' : '当前许可只属于本案一次试验。'}须本人再实走4米退出。`;
      l.cases[id].result = a.result; elapse(s, a, 1); break;
    case 'RETURN_START': move(s, a, 'START', 4); break;
    case 'WITHDRAW': a.withdrawn = true; if (a.consent === 'GRANTED') a.consent = 'REVOKED'; a.inputActive = false; if (a.abilityTier !== null) a.stopped = true; l.cases[id].withdrawals++; if (a.linkState === 'LINKED') { a.linkState = 'NONE'; a.linkRemainingSeconds = 0; a.released = true; } break;
  }
}
function applyMoon(s: SliceState, type: MoonType): void {
  const m = s.silentDisciple.life.moon;
  if (type === 'READ_MOON_NOTICE') { m.status = 'ANNOUNCED'; m.announcedWeek = s.week; return; }
  if (type === 'WAIT_MOON') { advanceSilentDiscipleLifeClock(s, m.remainingSeconds); m.elapsedSeconds += m.remainingSeconds; m.remainingSeconds = 0; m.status = 'RESOLVED'; return; }
  m.choice = type; m.startedWeek = s.week; m.initialMind = s.mind; m.initialCash = s.cash; m.mindSpent = Math.min(s.mind, type === 'GUIDED_REST' ? 8 : 18); m.cashSpent = type === 'GUIDED_REST' ? 60 : 0;
  s.actionsRemaining--; s.mind -= m.mindSpent; s.cash -= m.cashSpent; m.remainingSeconds = 3600; m.status = 'RESTING';
}
export function applySilentDiscipleActivity(s: SliceState, c: SilentDiscipleActivityCommand, ctx: SeerContext, _award?: (id: typeof FORM_ABILITY | typeof LINK_ABILITY, amount?: number) => void): void {
  const reason = silentDiscipleActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.silentDisciple.life;
  if (MOON_TYPES.includes(c.type as MoonType)) { applyMoon(s, c.type as MoonType); ctx.note('G · 当地观测所一次告示', c.type === 'READ_MOON_NOTICE' ? '本次原创G告示已亲读，后续须明确选择：守望1行动60便士至多8精神，或独处1行动至多18精神；两者真实等待3600秒，无健康治疗，不冒充原著本阶月圆规则。' : c.type === 'WAIT_MOON' ? '实际3600秒已过去，本次告示结束；既付精神与现金不退，旧历史与伤势不变。' : `实际扣1行动、${l.moon.cashSpent}便士、${l.moon.mindSpent}精神；还需真正等待3600秒，不退款、不治疗。`); return; }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('silent-disciple-reflection'); ctx.note('G · 同一身体与当前边界反思', '三份真实报告后扮演+25；普通完成不给能力掌握，不清旧伤、旧诅咒记录或现实成本。'); return; }
  if (!('caseId' in c)) throw new Error('沉默门徒现场缺少原案标识。');
  const r = l.cases[c.caseId], spec = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备1行动已付，${c.method === 'ORDINARY' ? '普通实施另1行动0灵性0精神' : c.caseId === 'measured-link' ? '首次联系另1行动4灵性1精神、知识18' : '首次变形另1行动5灵性2精神、知识20'}；不自动取得许可或施术。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施准备', '0行动取消，准备成本不退，原人原物没有变化。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, '0行动只开本案，本人仍在START；埃尔莎、原衣与原包仍在A，未取得本案许可、未付实施或施术。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[abilityFor(c.caseId)] = Math.min(500, (s.progression.mastery[abilityFor(c.caseId)] ?? 0) + 8); ctx.note(spec.title, `真实报告扮演+25；${r.result === 'ABILITY' ? '本次付费能力实际成功且真实收束，对应新能力掌握+8' : '普通核验或失败后补查，不给能力掌握'}。原成本、拒绝与旧历史完整保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('实际退出原安静室', '本人已回START，原埃尔莎同一身体HUMAN、原衣已穿回、原包归主，联系已结束；不补血、不补灵。'); return; }
  const tier = c.type === 'PERFORM' && a.method === 'ABILITY' ? ctx.check('knowledge', c.caseId === 'measured-link' ? 18 : 20).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, atSecond: a.elapsedSeconds, volunteerWilling: l.volunteer.willing });
  ctx.note(`G · ${c.type}`, `${c.type === 'PERFORM' && a.method === 'ABILITY' ? `真实付费检定${tier}，${success(tier) ? '只出现本案有限效果' : '失败无效果，成本不退'}。` : c.type === 'RECORD_OUTCOME' ? a.outcome : '只处理原身体、原物、当前许可或实际经过时间，不制造副本、不治疗。'} 本人${l.playerLocation}，原埃尔莎${l.volunteer.form}，本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，形态剩余${a.formRemainingSeconds}秒，联系剩余${a.linkRemainingSeconds}秒。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人实走到A', '0行动 · 4米4秒'], READ_IDENTITY: ['当面核同一原身份与人身', '0行动 · 1秒'], STORE_ITEMS: ['在A私下把原衣与原包存入原托盘', '0行动 · 3秒 · 原物各一份'], CONSENT_ELSA: ['当面询问埃尔莎当前一次有限许可', '0行动 · 1秒 · 拒绝不重问'], PERFORM: ['实际实施本案一次方案', '首次1行动 · 能力另付真实灵性与精神'], STOP_INPUT: ['停止新输入，保留原效果剩余时间', '0行动0秒 · 不瞬间复原'], WALK_B: ['本人普通步行到B', '0行动 · 4米4秒'], READ_NOTE: ['在B亲读同一原纸SD3-NOTE', '0行动 · 2秒'], RETURN_A: ['本人从B实走回A', '0行动 · 4米4秒'], COMPARE_IDENTITY: ['当面比较原记录与同一身体当前形态', '0行动 · 1秒'], WAIT_FORM: ['等待同一身体实际复原', '0行动0灵性 · 实际当前剩余秒数'], RELEASE_FORM: ['付费有限解除当前兔形', '0行动 · 2灵性 · 不自动穿衣'], DROP_LINK: ['实际断开当前有限联系', '0行动0灵性 · 无伤害或资源退款'], WAIT_LINK: ['等待原有限联系实际结束', '0行动0灵性 · 实际当前剩余秒数'], RETURN_ITEMS: ['在A私下穿回原衣并归还原包', '0行动 · 3秒 · 须已恢复HUMAN'], ORDINARY_CHECK: ['普通核对真实原纸、身份与当前答复', '首次1行动；已付实施后的补查0行动 · 2秒'], RECORD_OUTCOME: ['如实记录当前结果与真实收束', '0行动 · 1秒'], RETURN_START: ['本人从A沿普通门路退出', '0行动 · 4米4秒'], WITHDRAW: ['撤回能力方案并停止新输入', '0行动 · 原兔形仍须实际解除或等候'],
};
export function silentDiscipleLifeActions(s: SliceState): SilentDiscipleLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.silentDisciple.life, actions: SilentDiscipleLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: SilentDiscipleActivityCommand) => { const reason = silentDiscipleActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[SILENT_DISCIPLE_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原身体、原物与边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备一次有限能力与实际收束', `1行动 · 另留实施1行动 · ${id === 'measured-link' ? '4灵性1精神、知识18' : '5灵性2精神、知识20'}`, { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备完全普通的原纸与身份核验', '1行动 · 另留实施1行动 · 0灵性0精神', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案实际现场', '0行动 · 不自动施术或取得同意', { type: 'START_CASE', caseId: id }); add(`${id}-cancel`, '取消尚未实施的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of SCENES) { const c = { type, caseId: id } as SilentDiscipleActivityCommand; if (!validateSilentDiscipleActivityCommand(c)) continue;
        const awaitingAbility = type === 'PERFORM' && a.method === 'ABILITY' && l.playerLocation === 'A' && a.consent === 'GRANTED' && !a.resolutionPaid && !a.withdrawn;
        if (silentDiscipleActivityReason(s, c) === null || awaitingAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], type === 'PERFORM' ? a.method === 'ORDINARY' ? '1行动 · 0灵性0精神 · 2秒' : id === 'measured-link' ? '1行动 · 4灵性1精神 · 知识18 · 成功30秒' : '1行动 · 5灵性2精神 · 知识20 · 成功60秒' : LABELS[type][1], c);
      }
      if (cleanupBlock(s) === null && (a.outcomeRecorded || a.withdrawn)) add(`${id}-leave`, '关闭已经实际退出的本案现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告实际结果、当前许可与原物归还', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '对应新能力掌握+8' : '普通结果无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && SILENT_DISCIPLE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('silent-disciple-reflect', '反思同一身体、当前许可和有代价边界', '1行动 · 扮演+25', { type: 'REFLECT' });
  if (l.moon.status === 'UNREAD' && s.silentDisciple.promotionWeek !== null && s.week >= s.silentDisciple.promotionWeek + 2) add('silent-disciple-moon-notice', '亲读当地观测所本次原创G告示（可选）', '0行动 · 阅读后须处理本次告示', { type: 'READ_MOON_NOTICE' });
  if (l.moon.status === 'ANNOUNCED') { add('silent-disciple-guided-rest', '在原导师守望下休息', '1行动 · 60便士 · 至多8精神 · 另等3600秒', { type: 'GUIDED_REST' }); add('silent-disciple-endure-rest', '独处承受本次原创G月相影响', '1行动 · 至多18精神 · 另等3600秒', { type: 'ENDURE_REST' }); }
  if (l.moon.status === 'RESTING') add('silent-disciple-wait-moon', '实际等待本次休息3600秒结束', '0行动0灵性 · 不退款、不治疗', { type: 'WAIT_MOON' });
  return actions;
}
export function projectSilentDiscipleLife(s: SliceState): SilentDiscipleLifeProjection {
  const l = s.silentDisciple.life, a = currentSilentDiscipleAttempt(s), actions = silentDiscipleLifeActions(s), inside = hasSilentDiscipleLifeLock(s);
  const next = actions.find(v => v.enabled && v.command.type !== 'WITHDRAW' && !(v.command.type === 'ORDINARY_CHECK' && a?.method === 'ABILITY' && !a.resolutionPaid && a.consent !== 'DECLINED' && !a.withdrawn)) ?? actions.find(v => v.enabled);
  return { ...structuredClone(l), title: '沉默门徒 · 同一身体的有限变形', story: SILENT_DISCIPLE_LIFE_STORY, environment: SILENT_DISCIPLE_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : l.reflected ? '三份真实报告与反思完成；原物、拒绝、失败成本和旧历史保留，可继续普通生活。' : '先晋升或完成当前实际条件。',
    facts: [
      `本人在${l.playerLocation}，累计普通步行${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒；START0米、A4米、B8米，每案必须实际往返16米。`,
      `原成年埃尔莎·莫尔/${l.volunteer.id}/43岁，唯一原身体${l.volunteer.bodyId}现实际在${l.volunteer.location}，当前${l.volunteer.form}，健康${l.volunteer.health}、精神${l.volunteer.mind}、灵性${l.volunteer.spirituality}不因变形恢复。${a ? `当前许可${a.consent}，新输入${a.inputActive ? '尚未停止' : '已停止或未开始'}。` : '每案都需新的当前许可。'}`,
      `同一原衣${l.clothing.id}归埃尔莎，现${l.clothing.location}，${l.clothing.worn ? '实际穿着' : '尚未穿回'}；同一原包${l.bag.id}现${l.bag.location}。唯一私密托盘${l.tray.id}在A，唯一原纸${l.note.id}在B。`,
      a ? `本次实际来源${a.abilitySourceId ?? '尚未施术'}，形态剩余${a.formRemainingSeconds}秒，联系${a.linkState}/剩余${a.linkRemainingSeconds}秒；实际已等${a.waitedSeconds}秒。` : '没有免费形态、第二身体、远程物品归还或生活伤害反射。',
      a?.outcome ?? '尚未记录本案真实结果，不提前宣称成功或持续同意。',
      `原导师哈伦现实际在${l.guide.location}，只按明确G程序提供现场安全准备；不会凭身份瞬间解咒。停止或撤回后，已有兔形仍须实际等待或付费解除，复原不等于穿衣。`,
      `可选${l.moon.id}为当地观测所一次原创G告示：晋升+2周后亲读才产生；守望1行动60便士至多8精神/独处1行动至多18精神，两者等3600秒。当前${l.moon.status}；原著沉默门徒具体月圆规则仍未知，不叠收旧阶段月圆、不回血。`,
    ], cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '实际付费能力成功、原身份核验与收束完成；报告对应掌握+8' : '实际普通完成或失败后补查；无能力掌握', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

/** Rebuild every same-body change, original item, consent, source, paid cost and real second. */
export function validateSilentDiscipleLifeOriginal(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
/** S2 changes are accepted only by replaying the same frozen original S3 source. */
export function validateSilentDiscipleLife(s: SliceState): boolean {
  try {
    return s.ancientEvil?.life?.source != null
      ? validateAncientEvilSourceSilentDiscipleLife(s)
      : validateSilentDiscipleLifeOriginal(s);
  } catch { return false; }
}
function validMoon(s: SliceState): boolean {
  const m = s.silentDisciple.life.moon, initial = createSilentDiscipleLifeState().moon, p = s.silentDisciple.promotionWeek;
  if (!record(m) || !shape(m, Object.keys(initial))) return false;
  if (m.status === 'UNREAD') return stableStringify(m) === stableStringify(initial);
  if (p === null || !integer(m.announcedWeek, p + 2, s.week) || m.id !== initial.id) return false;
  if (m.status === 'ANNOUNCED') return stableStringify(m) === stableStringify({ ...initial, status: 'ANNOUNCED', announcedWeek: m.announcedWeek });
  if (!['RESTING', 'RESOLVED'].includes(m.status) || !['GUIDED_REST', 'ENDURE_REST'].includes(String(m.choice)) || !integer(m.startedWeek, m.announcedWeek, s.week) || !integer(m.initialMind, 0, 100) || !integer(m.initialCash)) return false;
  if (m.status === 'RESTING' && m.startedWeek !== s.week) return false;
  const cash = m.choice === 'GUIDED_REST' ? 60 : 0, mind = Math.min(m.initialMind, m.choice === 'GUIDED_REST' ? 8 : 18);
  return m.initialCash >= cash && m.cashSpent === cash && m.mindSpent === mind && m.remainingSeconds === (m.status === 'RESTING' ? 3600 : 0) && m.elapsedSeconds === (m.status === 'RESOLVED' ? 3600 : 0);
}
function validateLife(s: SliceState): boolean {
  const l = s.silentDisciple?.life, initial = createSilentDiscipleLifeState(), promotion = s.silentDisciple?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, SILENT_DISCIPLE_CASE_IDS) || !validMoon(s)) return false;
  if (['ANNOUNCED', 'RESTING'].includes(l.moon.status) && (l.activeCase !== null || Object.values(l.cases).some(r => r.status === 'PREPARED') || s.combat || s.activeEvent || s.world.city !== 'BACKLUND' || ['READY', 'FIGHTING'].includes(s.silentDisciple.encounter.status) || hasSilentDiscipleOldPractice(s) || hasSilentDiscipleRitualLock(s))) return false;
  let externalSeconds = l.moon.elapsedSeconds;
  for (const round of s.combatHistory) { const seconds = round.silentDiscipleOutcome?.elapsedSeconds ?? 0; if (!integer(seconds)) return false; externalSeconds += seconds; }
  const encounter = s.silentDisciple.encounter;
  if (encounter.status === 'RESOLVED' && encounter.startHistoryIndex === null && encounter.scene.playerPosition === 'EXIT') externalSeconds += 4;
  if (!integer(externalSeconds) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.siteId !== initial.siteId || !['START', 'A', 'B'].includes(l.playerLocation) || l.activeCase !== null && !SILENT_DISCIPLE_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['volunteer', 'guide', 'clothing', 'bag', 'tray', 'note'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (typeof l.volunteer.willing !== 'boolean' || !['HUMAN', 'RABBIT'].includes(l.volunteer.form) || stableStringify(l.volunteer) !== stableStringify({ ...initial.volunteer, willing: l.volunteer.willing, form: l.volunteer.form })) return false;
  if (s.seer.completedSources.filter(source => source === 'silent-disciple-reflection').length !== Number(l.reflected)) return false;
  for (const id of SILENT_DISCIPLE_CASE_IDS) if (s.seer.completedSources.filter(source => source === sourceFor(id)).length !== Number(l.cases[id].status === 'RESOLVED')) return false;
  const pristine = { ...initial, clockSeconds: externalSeconds, moon: structuredClone(l.moon), volunteer: { ...initial.volunteer, willing: l.volunteer.willing } };
  if (promotion === null) return l.moon.status === 'UNREAD' && stableStringify(l) === stableStringify(pristine);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(pristine);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['original-body'].observedWeek !== l.introducedWeek) return false;
  const replay = createSilentDiscipleLifeState(); replay.clockSeconds = externalSeconds; replay.moon = structuredClone(l.moon); replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, silentDisciple: { ...s.silentDisciple, life: replay } };
  let open = 0, prepared = 0, resolved = 0, formMastery = 0, linkMastery = 0;
  for (const [index, id] of SILENT_DISCIPLE_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[SILENT_DISCIPLE_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
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
      if (!record(step) || !shape(step, ['type', 'tier', 'atSecond', 'volunteerWilling']) || typeof step.volunteerWilling !== 'boolean' || step.atSecond !== expected.elapsedSeconds) return false;
      const casting = step.type === 'PERFORM' && a.method === 'ABILITY';
      if (!casting && step.tier !== null || casting && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (!SCENES.includes(step.type) || !validateSilentDiscipleActivityCommand({ type: step.type, caseId: id })) return false;
      replay.volunteer.willing = step.volunteerWilling;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if ((!expected.outcomeRecorded && !expected.withdrawn) || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed || replay.cases[id].withdrawals !== r.withdrawals) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (r.result === 'ABILITY') { if (id === 'measured-link') linkMastery += 8; else formMastery += 8; } }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if ((prepared || ['ANNOUNCED', 'RESTING'].includes(l.moon.status)) && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  if (['ANNOUNCED', 'RESTING'].includes(l.moon.status) && (open || prepared)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.volunteer.willing = l.volunteer.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[FORM_ABILITY] ?? 0) >= formMastery && (s.progression.mastery[LINK_ABILITY] ?? 0) >= linkMastery;
}
