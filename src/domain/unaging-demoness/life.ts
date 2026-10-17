import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasUnagingDemonessOldPractice, hasUnagingDemonessRitualLock } from './index.js';

export const UNAGING_DEMONESS_CASE_IDS = ['dated-record', 'mirror-parcel', 'blocked-exit'] as const;
export type UnagingDemonessCaseId = typeof UNAGING_DEMONESS_CASE_IDS[number];
export type UnagingDemonessLocation = 'START' | 'A' | 'B' | 'INNER_A' | 'INNER_B';
export type UnagingDemonessConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'TAKE_ITEM' | 'GO_A' | 'STOP_CONTACT' | 'RETURN_START' | 'RETURN_ITEM' | 'INSPECT';
type MirrorCommand = 'CONSENT_OBSERVER' | 'CHECK_MIRRORS' | 'ENTER_A' | 'WALK_INNER_B' | 'RETURN_INNER_A' | 'RETURN_ENTRY' | 'WALK_B' | 'RETURN_A';
type DatedCommand = 'READ_OLD' | 'LISTEN_CURRENT' | 'WRITE_RECORD';
type ParcelCommand = 'EXIT_B' | 'DELIVER_PARCEL' | 'TAKE_BACK_PARCEL';
type BlockedCommand = 'CLOSE_SHUTTER' | 'CHECK_BLOCKED' | 'OPEN_SHUTTER';
export type UnagingDemonessActivityCommand =
  | { type: CommonCommand; caseId: UnagingDemonessCaseId }
  | { type: MirrorCommand; caseId: 'mirror-parcel' | 'blocked-exit' }
  | { type: DatedCommand; caseId: 'dated-record' }
  | { type: ParcelCommand; caseId: 'mirror-parcel' }
  | { type: BlockedCommand; caseId: 'blocked-exit' }
  | { type: 'PREPARE'; caseId: UnagingDemonessCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
type SceneType = Exclude<UnagingDemonessActivityCommand['type'], 'OBSERVE' | 'PREPARE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'REFLECT'>;
export interface UnagingDemonessMovement { from: UnagingDemonessLocation; to: UnagingDemonessLocation; mode: 'WALK' | 'MIRROR_STEP'; metres: number; seconds: number; itemIds: string[] }
export interface UnagingDemonessLifeStep { type: SceneType; tier: PublicResolutionTier | null; veraWilling: boolean; marcusWilling: boolean }
export interface UnagingDemonessAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; elapsedSeconds: number; playerTravelMetres: number; playerMoves: UnagingDemonessMovement[]; steps: UnagingDemonessLifeStep[]; spiritualitySpent: number;
  ownerConsent: UnagingDemonessConsent; observerConsent: UnagingDemonessConsent; stopped: boolean; inspected: boolean; itemTaken: boolean; itemReturned: boolean;
  oldRead: boolean; currentHeard: boolean; recordWritten: boolean; mirrorsChecked: boolean; entryTier: PublicResolutionTier | null; exitTier: PublicResolutionTier | null;
  entered: boolean; innerBVisited: boolean; exitedB: boolean; returnedViaEntry: boolean; delivered: boolean; handovers: number; parcelRetrievals: number;
  shutterClosed: boolean; blockedObserved: boolean; shutterOpened: boolean;
}
export interface UnagingDemonessCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: UnagingDemonessAttempt[];
}
interface OriginalItem { id: string; owner: 'UD3-VERA'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'RECEIVER'; travelMetres: number }
export interface UnagingDemonessLifeState {
  siteId: 'UD3-GALLERY'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: UnagingDemonessCaseId | null;
  playerLocation: UnagingDemonessLocation; playerTravelMetres: number; clockSeconds: number;
  vera: { id: 'UD3-VERA'; name: '维瑞娜·肖'; age: 46; alive: true; willing: boolean; location: 'START' };
  marcus: { id: 'UD3-MARCUS'; name: '马库斯·赫尔'; age: 41; alive: true; willing: boolean; location: 'B' };
  portrait: OriginalItem & { id: 'UD3-PORTRAIT'; subject: '维瑞娜·肖'; dated: PublicGameDate };
  register: { id: 'UD3-REGISTER'; owner: 'UD3-VERA'; quantity: 1; location: 'A'; written: boolean; writtenDate: PublicGameDate | null; oldNameRead: string | null; oldDateRead: PublicGameDate | null; currentStatement: string | null; conclusion: string | null };
  parcel: OriginalItem & { id: 'UD3-PARCEL'; massGrams: 800; sealed: true };
  receipt: OriginalItem & { id: 'UD3-RECEIPT'; signed: boolean };
  testSign: OriginalItem & { id: 'UD3-TEST-SIGN'; signed: boolean };
  mirrorA: { id: 'UD3-MIRROR-A'; owner: 'UD3-VERA'; quantity: 1; location: 'A'; intact: true };
  mirrorB: { id: 'UD3-MIRROR-B'; owner: 'UD3-VERA'; quantity: 1; location: 'B'; intact: true };
  shutter: { id: 'UD3-SHUTTER'; operator: 'UD3-MARCUS'; location: 'B'; state: 'OPEN' | 'CLOSED'; remainingTests: number; closures: number; reopenings: number };
  entry: { mirrorId: 'UD3-MIRROR-A'; held: boolean; returnStepsRemaining: number };
  cases: Record<UnagingDemonessCaseId, UnagingDemonessCaseState>; reflected: boolean;
}
export interface UnagingDemonessLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnagingDemonessActivityCommand }
export interface UnagingDemonessLifeProjection extends Omit<UnagingDemonessLifeState, 'cases'> {
  title: string; story: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: UnagingDemonessAttempt | null;
  cases: { id: UnagingDemonessCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: UnagingDemonessAttempt[] }[];
  actions: UnagingDemonessLifeAction[];
}
const MIRROR_ABILITY = 'assassin.s3.mirror-passage' as const;
export const UNAGING_DEMONESS_LIFE_ENVIRONMENT = '三项原创G有限实践：观察、准备、实施、报告各1行动，末次反思1行动，共13行动；报告各扮演25、反思25。第一案仅普通事实登记，无能力奖励。后两案仅实际成功的本体镜路并报告才镜面通行掌握+8。原人、原物与每步距离保存，关闭不传送、不补灵。';
export const UNAGING_DEMONESS_LIFE_STORY = '不老与镜中世界通行方向已核；年轻容貌不重写出生、原始创建年龄或既往选择。原著高位者仍能截留镜中本体；本场熟悉镜路、单次保留入口只是受控G撤回条件，不是全球镜网、通用逃脱、真空免疫或复活。';
const CASES = [
  { id: 'dated-record', title: 'G · 旧素描与当下的真实登记', story: '维瑞娜·肖46岁许可后，在START读同一旧素描UD3-PORTRAIT的人名和第五纪1330年5月14日日期，再当面听她说明。携原画实走4米到A原桌，将两个来源和当日日期写入唯一UD3-REGISTER；回4米归画。外貌不能证明过去改变，也不能证明永远安全。' },
  { id: 'mirror-parcel', title: 'G · 同一本体与同一原封包过镜', story: '借同一800克封包，到A后沿无遮挡18米廊道目视两原镜，听B原接收人马库斯自愿确认。A入口一次6灵性/知识18，成功本体携原包跨1米镜槛入INNER_A，再实走6米至INNER_B；独立6灵性/知识18尝试跨1米从B退出。失败留在真实原位；可走回6米，再从仍保持原入口实际一步退出。普通A至B18米也能交原包；原回执须携18米回A、4米回START归还。' },
  { id: 'blocked-exit', title: 'G · 原封板与真实回撤', story: '原观察员B现场操作UD3-SHUTTER，仅一份测试资源；提前同意后真实关闭B，A原入口仍可供本次一次返身。若入镜，必须本人实走6米到INNER_B看见封板、原路6米回INNER_A并实际跨出1米。再普通走18米到B当面请马库斯开启原板、签同一试验签，18米回A及4米回START。普通方案直接走外路核板。没有必死倒计时，关闭按钮也不替原人开板。' },
] as const;
const COMMON: readonly string[] = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'TAKE_ITEM', 'GO_A', 'STOP_CONTACT', 'RETURN_START', 'RETURN_ITEM', 'INSPECT'];
const MIRROR: readonly string[] = ['CONSENT_OBSERVER', 'CHECK_MIRRORS', 'ENTER_A', 'WALK_INNER_B', 'RETURN_INNER_A', 'RETURN_ENTRY', 'WALK_B', 'RETURN_A'];
const SPECIFIC: Record<UnagingDemonessCaseId, readonly string[]> = { 'dated-record': ['READ_OLD', 'LISTEN_CURRENT', 'WRITE_RECORD'], 'mirror-parcel': [...MIRROR, 'EXIT_B', 'DELIVER_PARCEL', 'TAKE_BACK_PARCEL'], 'blocked-exit': [...MIRROR, 'CLOSE_SHUTTER', 'CHECK_BLOCKED', 'OPEN_SHUTTER'] };
const ABILITY_STEPS: readonly string[] = ['ENTER_A', 'EXIT_B'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 3;
const sourceFor = (id: UnagingDemonessCaseId) => `unaging-demoness-life-${id}`;
const freshCase = (): UnagingDemonessCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): UnagingDemonessAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0,
    ownerConsent: 'UNASKED', observerConsent: 'UNASKED', stopped: false, inspected: false, itemTaken: false, itemReturned: false, oldRead: false, currentHeard: false, recordWritten: false, mirrorsChecked: false,
    entryTier: null, exitTier: null, entered: false, innerBVisited: false, exitedB: false, returnedViaEntry: false, delivered: false, handovers: 0, parcelRetrievals: 0, shutterClosed: false, blockedObserved: false, shutterOpened: false };
}
export function createUnagingDemonessLifeState(): UnagingDemonessLifeState {
  const item = { owner: 'UD3-VERA', quantity: 1, location: 'OWNER', travelMetres: 0 } as const;
  return { siteId: 'UD3-GALLERY', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    vera: { id: 'UD3-VERA', name: '维瑞娜·肖', age: 46, alive: true, willing: true, location: 'START' }, marcus: { id: 'UD3-MARCUS', name: '马库斯·赫尔', age: 41, alive: true, willing: true, location: 'B' },
    portrait: { ...item, id: 'UD3-PORTRAIT', subject: '维瑞娜·肖', dated: { epoch: 'FIFTH_EPOCH', year: 1330, month: 5, day: 14 } },
    register: { id: 'UD3-REGISTER', owner: 'UD3-VERA', quantity: 1, location: 'A', written: false, writtenDate: null, oldNameRead: null, oldDateRead: null, currentStatement: null, conclusion: null },
    parcel: { ...item, id: 'UD3-PARCEL', massGrams: 800, sealed: true }, receipt: { ...item, id: 'UD3-RECEIPT', location: 'RECEIVER', signed: false }, testSign: { ...item, id: 'UD3-TEST-SIGN', signed: false },
    mirrorA: { id: 'UD3-MIRROR-A', owner: 'UD3-VERA', quantity: 1, location: 'A', intact: true }, mirrorB: { id: 'UD3-MIRROR-B', owner: 'UD3-VERA', quantity: 1, location: 'B', intact: true },
    shutter: { id: 'UD3-SHUTTER', operator: 'UD3-MARCUS', location: 'B', state: 'OPEN', remainingTests: 1, closures: 0, reopenings: 0 }, entry: { mirrorId: 'UD3-MIRROR-A', held: false, returnStepsRemaining: 0 },
    cases: { 'dated-record': freshCase(), 'mirror-parcel': freshCase(), 'blocked-exit': freshCase() }, reflected: false };
}
export function validateUnagingDemonessActivityCommand(v: unknown): v is UnagingDemonessActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!UNAGING_DEMONESS_CASE_IDS.includes(v.caseId as UnagingDemonessCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && (v.method === 'ORDINARY' || v.method === 'ABILITY' && v.caseId !== 'dated-record');
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as UnagingDemonessCaseId].includes(String(v.type)));
}
export const isUnagingDemonessActivityCommand = validateUnagingDemonessActivityCommand;
const currentAttempt = (s: SliceState) => s.unagingDemoness.life.activeCase ? s.unagingDemoness.life.cases[s.unagingDemoness.life.activeCase].attempts.at(-1) ?? null : null;
const borrowed = (l: UnagingDemonessLifeState, id: UnagingDemonessCaseId) => id === 'dated-record' ? l.portrait : id === 'mirror-parcel' ? l.parcel : l.testSign;
const ownerConsents = (s: SliceState, a: UnagingDemonessAttempt) => a.ownerConsent === 'GRANTED' && s.unagingDemoness.life.vera.willing && !a.stopped;
const observerConsents = (s: SliceState, a: UnagingDemonessAttempt) => a.observerConsent === 'GRANTED' && s.unagingDemoness.life.marcus.willing && !a.stopped;
function cleanupBlock(s: SliceState): string | null {
  const l = s.unagingDemoness.life;
  if (l.entry.held || l.playerLocation === 'INNER_A' || l.playerLocation === 'INNER_B') return '本人仍在镜路，须实际走回INNER_A并从本次原入口跨出；收束不传送。';
  if (l.shutter.state === 'CLOSED') return 'B原封板仍关闭；须普通走到B当面请原操作者实际开启。';
  if (l.playerLocation !== 'START') return '本人须从B普通18米回A，再4米回START；不能远程回收。';
  if ([l.portrait, l.parcel, l.receipt, l.testSign].some(item => item.location === 'PLAYER')) return '先在START将同一原借物或原回执实际交还维瑞娜。';
  return null;
}
export const hasUnagingDemonessLifeLock = (s: SliceState): boolean => s.unagingDemoness.life.activeCase !== null || Object.values(s.unagingDemoness.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
function taskComplete(id: UnagingDemonessCaseId, a: UnagingDemonessAttempt): boolean { return id === 'dated-record' ? a.recordWritten : id === 'mirror-parcel' ? a.delivered : a.blockedObserved && a.shutterOpened; }
function sceneReason(s: SliceState, id: UnagingDemonessCaseId, type: SceneType): string | null {
  const l = s.unagingDemoness.life, a = l.cases[id].attempts.at(-1)!, item = borrowed(l, id), at = l.playerLocation;
  if (s.health <= 0 || s.status === 'DEAD') return '原身体已经死亡，不能移动、归物或靠镜路复活。';
  if (a.inspected) return '已核实收口，只可关闭本次现场。';
  if (type === 'STOP_CONTACT') return a.stopped ? '本次已经停止，仍须原路收口。' : null;
  if (type === 'RETURN_INNER_A') return at === 'INNER_B' && l.entry.held ? null : '须本人确在INNER_B，沿唯一6米原路返回INNER_A。';
  if (type === 'RETURN_ENTRY') return at === 'INNER_A' && l.entry.held && l.entry.returnStepsRemaining === 1 ? null : '只有走回INNER_A，才能用第一次6灵性保持的同一入口实际跨出1米一次；不是远程传送。';
  if (type === 'OPEN_SHUTTER') return at === 'B' && l.shutter.state === 'CLOSED' && a.shutterClosed && (a.blockedObserved || a.stopped) ? null : '须本人普通走到B，原马库斯才依这次预先同意的收口约定实际开启原板。';
  if (type === 'WALK_B') return at === 'A' && !l.entry.held && (a.stopped ? l.shutter.state === 'CLOSED' : ownerConsents(s, a) && observerConsents(s, a) && a.mirrorsChecked && !taskComplete(id, a) && (id !== 'blocked-exit' || a.shutterClosed)) ? null : '须本人在A，沿现实18米净空外路到B；镜内先原路退出。';
  if (type === 'RETURN_A') return at === 'B' && l.shutter.state === 'OPEN' && (taskComplete(id, a) || a.stopped) ? null : '先在B完成交接或停止演练，并让原板实际打开，再普通18米回A。';
  if (type === 'RETURN_START') return at === 'A' && !l.entry.held && l.shutter.state === 'OPEN' && (taskComplete(id, a) || a.stopped) ? null : '须在A、原板已开且完成或停止本案，才能实际4米回START；B与镜内不能直返。';
  if (type === 'RETURN_ITEM') return at === 'START' && [l.portrait, l.parcel, l.receipt, l.testSign].some(v => v.location === 'PLAYER') ? null : '须本人携同一原物回START再交还，远处原包不会传来。';
  if (type === 'INSPECT') return cleanupBlock(s) ?? (taskComplete(id, a) || a.stopped ? null : '先完成原事实核查、交接或封板核实；也可明确停止并如实报告未完成。');
  if (a.stopped) return '本次已停止；仍可实际走回、退原入口、开启原板并归还原物。';
  if (s.mind <= 0) return '精神已不足，只能停止本次并按实际位置收口。';
  if (type === 'CONSENT_OWNER') return at === 'START' && a.ownerConsent === 'UNASKED' ? null : '须在START当面询问本案独立许可，已有回答不重掷。';
  if (!ownerConsents(s, a)) return '原主尚未同意本案或已撤回；请尊重回答、停止并真实归还。';
  if (type === 'TAKE_ITEM') return at === 'START' && !a.itemTaken && item.location === 'OWNER' ? null : '须原物确在START原主处，且本案尚未领取。';
  if (type === 'GO_A') return at === 'START' && item.location === 'PLAYER' && !a.playerMoves.length && (id !== 'dated-record' || a.currentHeard) ? null : '须先借到同一原物，才从START实际走4米到A。';
  if (type === 'READ_OLD') return at === 'START' && l.portrait.location === 'PLAYER' && !a.oldRead ? null : '须在START持有同一旧素描，实际先读原人名与旧日期。';
  if (type === 'LISTEN_CURRENT') return at === 'START' && a.oldRead && !a.currentHeard ? null : '先读原画旧日期，再当面听维瑞娜自己的当前说明；不读心。';
  if (type === 'WRITE_RECORD') return at === 'A' && l.portrait.location === 'PLAYER' && a.oldRead && a.currentHeard && !l.register.written ? null : '须携原画到A原桌，已读旧日期且听当面说明后才写唯一原登记。';
  if (type === 'CONSENT_OBSERVER') return at === 'A' && a.observerConsent === 'UNASKED' ? null : '须到A，在现实无遮挡18米廊道听B马库斯本人确认，不通过镜面猜测同意。';
  if (!observerConsents(s, a)) return 'B原观察员尚未同意本案或已撤回；可停止并按原位返回。';
  if (type === 'CHECK_MIRRORS') return at === 'A' && !a.mirrorsChecked && l.shutter.state === 'OPEN' ? null : '须在A沿无遮挡现实廊道实际确认两原镜、B原人和未封出口。';
  if (type === 'CLOSE_SHUTTER') return at === 'A' && a.mirrorsChecked && !a.shutterClosed && l.shutter.state === 'OPEN' && l.shutter.remainingTests === 1 ? null : '须两端已核、双方已同意，由B原马库斯实际关闭一次原板；测试资源不补。';
  if (type === 'ENTER_A') {
    if (at !== 'A' || !a.mirrorsChecked || item.location !== 'PLAYER' || a.entryTier !== null || a.method !== 'ABILITY' || l.entry.held) return '须本人携本案原物在已核A，仅能力方案可作本次唯一进入尝试。';
    if (id === 'blocked-exit' && !a.shutterClosed || id === 'mirror-parcel' && l.shutter.state !== 'OPEN') return '本案原出口条件尚未实际准备好。';
    return s.spirituality >= 6 ? null : '进入需6灵性；不足可走现实18米外路，不自动补灵。';
  }
  if (type === 'WALK_INNER_B') return at === 'INNER_A' && a.entered && !a.innerBVisited && l.entry.held ? null : '须已实际进入INNER_A，才能沿唯一已知6米镜内道路走到INNER_B。';
  if (type === 'EXIT_B') return at !== 'INNER_B' || l.shutter.state !== 'OPEN' || !a.entered || a.exitTier !== null ? '须本体在INNER_B且原B未封，只能独立尝试一次退出；失败仍留原位。' : s.spirituality < 6 ? '退出另需6灵性；不足可先6米回INNER_A，再从原保持入口跨出，不补灵。' : null;
  if (type === 'DELIVER_PARCEL') return at === 'B' && l.parcel.location === 'PLAYER' && l.receipt.location === 'RECEIVER' && !a.delivered ? null : '须本人在B把同一原包交给实际马库斯，才能拿到同一原回执。';
  if (type === 'TAKE_BACK_PARCEL') return at === 'B' && a.delivered && l.parcel.location === 'RECEIVER' && l.receipt.location === 'PLAYER' ? null : '须本人仍在B，将原回执交回原接收人后才能领回同一原包。';
  if (type === 'CHECK_BLOCKED') return (at === 'B' || at === 'INNER_B') && l.shutter.state === 'CLOSED' && a.shutterClosed && !a.blockedObserved ? null : '须真实到B外侧或INNER_B镜侧，亲见本次原封板关闭；不能隔远自动知道。';
  return '本次原场景不支持该动作。';
}
export function unagingDemonessActivityReason(s: SliceState, c: UnagingDemonessActivityCommand): string | null {
  if (!validateUnagingDemonessActivityCommand(c)) return '不老魔女命令无效；首案仅普通登记，不能冒领施术。';
  if (!promoted(s)) return '先完成不老魔女序列3晋升。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '当前周目已结束或原身体已死亡；镜路不提供复活。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.unagingDemoness.encounter.status)) return '先处理当前事件或真实小院战斗；原身体不能同时在两处。';
  if (s.world.city !== 'BACKLUND') return '须回贝克兰德同一原馆舍。';
  const l = s.unagingDemoness.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (!r || l.activeCase !== c.caseId || !r.contactOpen) return '没有本案开放现场。';
    return cleanupBlock(s) ?? (!r.attempts.at(-1)!.inspected ? '先实际核对原位置与原物收口。' : c.type === 'WITHDRAW' && !r.attempts.at(-1)!.stopped ? '先明确停止本次接触。' : null);
  }
  if (!['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type)) return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType) : '先实施本案，再操作同一原现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先实际原路返回、归还原物并收束当前现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (hasUnagingDemonessOldPractice(s) || hasUnagingDemonessRitualLock(s)) return '先真实收束旧实践与本次服药准备，不能跨场地移动原人原物。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；不能靠新术绕过死亡。';
  if (s.actionsRemaining < 1) return '需要1行动；实际收口后可休养跨周。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成本次有限反思。' : UNAGING_DEMONESS_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!r || r.status === 'RESOLVED') return '本项有限报告已完成。';
  const i = UNAGING_DEMONESS_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[UNAGING_DEMONESS_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成上一项原现场报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已观察本案，不重复领取。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本次原现场。' : s.actionsRemaining < 2 ? '准备需1行动并保留另1行动实施，避免本次准备锁住跨周。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' ? null : '先选本案普通或有限能力方案。';
  return r.status === 'EXAMINED' && !r.contactOpen ? null : '先真实收口再报告，关闭不会代办返回。';
}
export const blockUnagingDemonessLife = unagingDemonessActivityReason;
export function advanceUnagingDemonessLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.unagingDemoness.life.clockSeconds + seconds)) throw new Error('原馆舍秒数无效。');
  s.unagingDemoness.life.clockSeconds += seconds;
}
function elapse(s: SliceState, a: UnagingDemonessAttempt, seconds: number) { a.elapsedSeconds += seconds; advanceUnagingDemonessLifeClock(s, seconds); }
function move(s: SliceState, a: UnagingDemonessAttempt, to: UnagingDemonessLocation, metres: number, mode: UnagingDemonessMovement['mode'] = 'WALK') {
  const l = s.unagingDemoness.life, carried = [l.portrait, l.parcel, l.receipt, l.testSign].filter(item => item.location === 'PLAYER');
  a.playerMoves.push({ from: l.playerLocation, to, mode, metres, seconds: metres, itemIds: carried.map(item => item.id) });
  for (const item of carried) item.travelMetres += metres;
  l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres);
}
function applyScene(s: SliceState, id: UnagingDemonessCaseId, step: UnagingDemonessLifeStep): void {
  const l = s.unagingDemoness.life, a = l.cases[id].attempts.at(-1)!; a.steps.push({ ...step });
  switch (step.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.vera.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 2); break;
    case 'CONSENT_OBSERVER': a.observerConsent = l.marcus.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 2); break;
    case 'TAKE_ITEM': borrowed(l, id).location = 'PLAYER'; a.itemTaken = true; elapse(s, a, 1); break;
    case 'GO_A': move(s, a, 'A', 4); break;
    case 'READ_OLD': a.oldRead = true; elapse(s, a, 2); break;
    case 'LISTEN_CURRENT': a.currentHeard = true; elapse(s, a, 2); break;
    case 'WRITE_RECORD': a.recordWritten = true; l.register.written = true; l.register.writtenDate = { ...a.date }; l.register.oldNameRead = l.portrait.subject; l.register.oldDateRead = { ...l.portrait.dated }; l.register.currentStatement = '维瑞娜当面说明：这是她本人旧画，登记只保留旧日期与今天自己的说明。'; l.register.conclusion = '外貌年轻不证明出生或过去已改，也不证明永远安全。'; elapse(s, a, 2); break;
    case 'CHECK_MIRRORS': a.mirrorsChecked = true; elapse(s, a, 2); break;
    case 'CLOSE_SHUTTER': a.shutterClosed = true; l.shutter.state = 'CLOSED'; l.shutter.remainingTests--; l.shutter.closures++; elapse(s, a, 2); break;
    case 'ENTER_A':
      a.entryTier = step.tier; s.spirituality -= 6; a.spiritualitySpent += 6;
      if (success(step.tier)) { a.entered = true; l.entry.held = true; l.entry.returnStepsRemaining = 1; move(s, a, 'INNER_A', 1, 'MIRROR_STEP'); } else elapse(s, a, 1);
      break;
    case 'WALK_INNER_B': a.innerBVisited = true; move(s, a, 'INNER_B', 6); break;
    case 'EXIT_B':
      a.exitTier = step.tier; s.spirituality -= 6; a.spiritualitySpent += 6;
      if (success(step.tier)) { a.exitedB = true; l.entry.held = false; l.entry.returnStepsRemaining = 0; move(s, a, 'B', 1, 'MIRROR_STEP'); } else elapse(s, a, 1);
      break;
    case 'RETURN_INNER_A': move(s, a, 'INNER_A', 6); break;
    case 'RETURN_ENTRY': a.returnedViaEntry = true; l.entry.held = false; l.entry.returnStepsRemaining = 0; move(s, a, 'A', 1, 'MIRROR_STEP'); break;
    case 'WALK_B': move(s, a, 'B', 18); break;
    case 'RETURN_A': move(s, a, 'A', 18); break;
    case 'RETURN_START': move(s, a, 'START', 4); break;
    case 'DELIVER_PARCEL': l.parcel.location = 'RECEIVER'; l.receipt.location = 'PLAYER'; l.receipt.signed = true; a.delivered = true; a.handovers++; elapse(s, a, 2); break;
    case 'TAKE_BACK_PARCEL': l.parcel.location = 'PLAYER'; l.receipt.location = 'RECEIVER'; a.delivered = false; a.parcelRetrievals++; elapse(s, a, 2); break;
    case 'CHECK_BLOCKED': a.blockedObserved = true; elapse(s, a, 2); break;
    case 'OPEN_SHUTTER': l.shutter.state = 'OPEN'; l.shutter.reopenings++; a.shutterOpened = true; if (l.testSign.location === 'PLAYER') l.testSign.signed = true; elapse(s, a, 2); break;
    case 'STOP_CONTACT': a.stopped = true; elapse(s, a, 1); break;
    case 'RETURN_ITEM': for (const item of [l.portrait, l.parcel, l.receipt, l.testSign]) if (item.location === 'PLAYER') item.location = 'OWNER'; a.itemReturned = true; elapse(s, a, 1); break;
    case 'INSPECT':
      a.inspected = true; a.result = !a.stopped && (id === 'mirror-parcel' && a.exitedB && a.delivered || id === 'blocked-exit' && a.entered && a.innerBVisited && a.blockedObserved && a.returnedViaEntry && a.shutterOpened) ? 'ABILITY' : 'ORDINARY';
      l.cases[id].result = a.result; elapse(s, a, 2); break;
  }
}
export function applyUnagingDemonessActivity(s: SliceState, c: UnagingDemonessActivityCommand, ctx: SeerContext, _award?: (id: typeof MIRROR_ABILITY, amount?: number) => void): void {
  const reason = unagingDemonessActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.unagingDemoness.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('unaging-demoness-reflection'); ctx.note('G · 原身份与有限镜路反思', '三份真实报告后扮演+25。旧日期与出生履历不改；原包未复制，原封板测试已耗，高位镜内截留仍可能发生。没有复活或必然逃脱。'); return; }
  const r = l.cases[c.caseId], spec = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `已付1行动准备${c.method === 'ABILITY' ? '有限原镜路' : '普通原路'}；并不代替当事人独立许可。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('撤回尚未实施的准备', '0行动；原人原物尚未移动，已付行动不退。'); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = c.caseId; ctx.note(spec.title, '实施1行动已付，本人仍在START，下一步当面询问原主。现场操作0行动，但真实累计秒数、路程与灵性。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[MIRROR_ABILITY] = Math.min(500, (s.progression.mastery[MIRROR_ABILITY] ?? 0) + 8); ctx.note(spec.title, `实际报告扮演+25；${r.result === 'ABILITY' ? '同一本体实际完成有限镜路且收口，镜面通行掌握+8。' : '普通事实、普通送件、失败或尊重退出不加能力掌握。'}原成本、位置和旧日期保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = a.observerConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('实际收束原馆舍', '本人已沿原路回START，借物或回执已交还，原封板确已打开；同一原包若已交付仍在B接收人处。没有瞬移、自动开板或回补。'); return; }
  const tier = ABILITY_STEPS.includes(c.type) ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, veraWilling: l.vera.willing, marcusWilling: l.marcus.willing });
  const detail = c.type === 'ENTER_A' ? `6灵性进入检定${tier}，${a.entered ? '同一本体与同一原物确已在INNER_A；仅保留本次原路返身一步' : '未进入，本人和原物仍在A，可走现实外路'}。` : c.type === 'EXIT_B' ? `独立6灵性退出检定${tier}，${a.exitedB ? '同一本体与原包确在B' : '本人和原包仍在INNER_B，须6米走回原入口再实际跨出'}。` : c.type === 'CLOSE_SHUTTER' ? '马库斯本人在B关闭同一原板，唯一测试资源1→0，原路回撤仍须本人实际行走。' : c.type === 'OPEN_SHUTTER' ? '本人已到B，马库斯依预先约定实际开回同一原板，测试资源不补。' : c.type === 'RETURN_ENTRY' ? '本人走回INNER_A后，用第一次6灵性支持的同一入口实际跨出一步；单次窗口已关闭，未另补灵或开远程口。' : c.type === 'STOP_CONTACT' ? '已停止本次接触；本人、原物、原板仍保持真实当前状态，须逐步收口。' : '依同一原人原物的位置完成本步；同意来自本人的普通回答，不靠检定强迫。';
  ctx.note(`G · ${c.type}`, `${detail} 本人${l.playerLocation}，本案${a.elapsedSeconds}秒、实际${a.playerTravelMetres}米、已耗${a.spiritualitySpent}灵性。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  CONSENT_OWNER: ['当面询问维瑞娜本案许可', '2秒'], TAKE_ITEM: ['领取本案同一原物', '1秒'], READ_OLD: ['先读同一旧画的人名与旧日期', '2秒 · 普通核查'], LISTEN_CURRENT: ['当面听原主当前说明', '2秒 · 不读心'], GO_A: ['携同一原物从START实走到A', '4米4秒'], WRITE_RECORD: ['在A原桌写下旧日期、当前说明与当日登记', '2秒 · 无施术奖励'],
  CONSENT_OBSERVER: ['在无遮挡廊道听B原观察员独立许可', '2秒 · 普通可闻回答'], CHECK_MIRRORS: ['实际核两原镜、B本人及出口未封', '2秒 · 现实18米直视廊道'], CLOSE_SHUTTER: ['请B马库斯实际关闭原封板作本次测试', '2秒 · 唯一测试1→0'], ENTER_A: ['从原镜A尝试本体进入', '6灵性 · 知识18 · 1秒 · 成功跨1米'], WALK_INNER_B: ['本体沿已知镜内原路走到INNER_B', '6米6秒'], EXIT_B: ['从原镜B独立尝试本体退出', '另6灵性 · 知识18 · 1秒 · 成功跨1米'],
  CHECK_BLOCKED: ['在原封板旁亲见B出口关闭', '2秒 · 无法强行穿过'], RETURN_INNER_A: ['本体沿镜内原路走回INNER_A', '6米6秒 · 0灵性'], RETURN_ENTRY: ['从仍保持的原入口A实际跨出一步', '1米1秒 · 首次6灵性支持 · 仅本次返身一次'], WALK_B: ['本体沿现实净空外路走到B', '18米18秒 · 0灵性'], DELIVER_PARCEL: ['在B交同一原包，领同一原回执', '2秒'], TAKE_BACK_PARCEL: ['在B交回原回执，实际取回同一原包', '2秒 · 可重新交付'], OPEN_SHUTTER: ['到B当面请马库斯实际开回原封板', '2秒 · 原试验签实签 · 不补测试'], RETURN_A: ['从B沿现实原路走回A', '18米18秒'], RETURN_START: ['从A实际走回START', '4米4秒'], RETURN_ITEM: ['在START归还同一借物或原回执', '1秒'], INSPECT: ['实际核对本人返回、原物归属及原板开启', '2秒'], STOP_CONTACT: ['停止本次接触，按真实位置收口', '1秒 · 不传送、不自动开板'],
};
const SCENE_ORDER: readonly SceneType[] = ['CONSENT_OWNER', 'TAKE_ITEM', 'READ_OLD', 'LISTEN_CURRENT', 'GO_A', 'WRITE_RECORD', 'CONSENT_OBSERVER', 'CHECK_MIRRORS', 'CLOSE_SHUTTER', 'ENTER_A', 'WALK_INNER_B', 'EXIT_B', 'CHECK_BLOCKED', 'DELIVER_PARCEL', 'OPEN_SHUTTER', 'RETURN_INNER_A', 'RETURN_ENTRY', 'WALK_B', 'RETURN_A', 'RETURN_START', 'RETURN_ITEM', 'INSPECT', 'TAKE_BACK_PARCEL', 'STOP_CONTACT'];
export function unagingDemonessLifeActions(s: SliceState): UnagingDemonessLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.unagingDemoness.life, actions: UnagingDemonessLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: UnagingDemonessActivityCommand) => { const reason = unagingDemonessActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id], index = UNAGING_DEMONESS_CASE_IDS.indexOf(id);
    if (index > 0 && l.cases[UNAGING_DEMONESS_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原人、原物与边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') {
      if (id !== 'dated-record') add(`${id}-ability`, '准备本案有限原镜通行', '1行动 · 另留1行动实施 · 每次进入或B退出各6灵性', { type: 'PREPARE', caseId: id, method: 'ABILITY' });
      add(`${id}-ordinary`, id === 'dated-record' ? '准备普通日期与原身份核查' : '准备普通外路核查与交接', '1行动 · 另留1行动实施 · 0灵性', { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') { add(`${id}-perform`, '实施本次原馆舍实践', '1行动 · 本人仍在START', { type: 'PERFORM', caseId: id }); add(`${id}-withdraw-preparation`, '取消本次尚未实施准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      if (a.inspected) { add(`${id}-close`, '关闭已经真实收口的现场', '0行动 · 不改变原位置', { type: 'CLOSE', caseId: id }); if (a.stopped) add(`${id}-withdraw`, '确认撤回本次并保留原成本', '0行动 · 无施术奖励', { type: 'WITHDRAW', caseId: id }); }
      else {
        for (const type of SCENE_ORDER) {
          const command = { type, caseId: id } as UnagingDemonessActivityCommand;
          if (!validateUnagingDemonessActivityCommand(command)) continue;
          const reason = unagingDemonessActivityReason(s, command);
          const awaitingAbility = type === 'ENTER_A' && a.method === 'ABILITY' && a.entryTier === null && l.playerLocation === 'A' && a.mirrorsChecked && (id !== 'blocked-exit' || a.shutterClosed) || type === 'EXIT_B' && l.playerLocation === 'INNER_B' && a.exitTier === null;
          if (reason === null || awaitingAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], `0行动 · ${LABELS[type][1]}`, command);
        }
      }
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告实际原位置、原物与有限结果', `1行动 · G扮演+25 · ${r.result === 'ABILITY' ? '实际镜路掌握+8' : '无能力掌握奖励'}`, { type: 'REPORT', caseId: id });
  }
  if (!l.reflected && UNAGING_DEMONESS_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('unaging-demoness-reflect', '反思真实身份、原镜路径与高位截留风险', '1行动 · 三报告后扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectUnagingDemonessLife(s: SliceState): UnagingDemonessLifeProjection {
  const l = s.unagingDemoness.life, actions = unagingDemonessLifeActions(s), a = currentAttempt(s), inside = hasUnagingDemonessLifeLock(s);
  const next = actions.find(v => v.enabled && v.command.type !== 'STOP_CONTACT' && v.command.type !== 'TAKE_BACK_PARCEL') ?? actions.find(v => v.enabled);
  return { ...structuredClone(l), title: '不老魔女 · 原身份与有限镜路', story: UNAGING_DEMONESS_LIFE_STORY, environment: UNAGING_DEMONESS_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : l.reflected ? '三项报告与反思已完成；原人物、原物及消耗保留，可继续普通生活。' : '先晋升并处理当前事件，或查看具体未满足条件。',
    facts: [
      `同一本体实际在${l.playerLocation}；累计实际行走/跨槛${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒（含实际战斗）。START↔A4米，现实A↔B18米；镜内仅INNER_A↔INNER_B6米，每次实际跨镜槛1米。普通外廊一直净空，未把关闭B板写成封死所有出口。`,
      `维瑞娜·肖UD3-VERA/46岁在START，当前${l.vera.willing ? '愿意' : '拒绝'}；马库斯·赫尔UD3-MARCUS/41岁实际在B，当前${l.marcus.willing ? '愿意' : '拒绝'}。本次许可：原主${a?.ownerConsent ?? '无开放接触'}，观察员${a?.observerConsent ?? '无开放接触'}；每案独立询问，普通回答不读心、不由骰子控制。`,
      `唯一旧画${l.portrait.id}在${l.portrait.location}，走过${l.portrait.travelMetres}米；原登记${l.register.id}一直在A原桌，${l.register.written ? '已经分别记下旧日期、当前本人说明和当日日期' : '尚未写入'}。原始创建年龄/出生履历未因年轻外观重置；旧画不是你的新造过去。`,
      `同一原封包${l.parcel.id}仅1件、800克（本场≤1千克边界），封口${l.parcel.sealed ? '保持' : '改变'}，实际在${l.parcel.location}，累计随身${l.parcel.travelMetres}米；同一${l.receipt.id}在${l.receipt.location}，${l.receipt.signed ? '已实际签收' : '未签收'}，走过${l.receipt.travelMetres}米。RECEIVER就是B的原马库斯，不是远程收物格。`,
      `两原镜${l.mirrorA.id}@A与${l.mirrorB.id}@B均原主维瑞娜所有、各1面完好。A本次原入口${l.entry.held ? `仍保持，余${l.entry.returnStepsRemaining}次原路返身跨出` : '未开放或本次已关闭'}；须本人实际在INNER_A，不能从INNER_B免费远程退出，B退出需独立6灵性。`,
      `原封板${l.shutter.id}@B实际${l.shutter.state}，操作者${l.shutter.operator}本人在B；测试余${l.shutter.remainingTests}，实际关闭${l.shutter.closures}/开回${l.shutter.reopenings}。同一试验签${l.testSign.id}在${l.testSign.location}、已走${l.testSign.travelMetres}米。停止/收束不会自动开原板，须现实18米走到B当面操作。`,
      '能力失败保留真实位置、原物和6灵性成本；原路回撤仅本场预先控制的熟悉入口，不保证逃过原著高位镜内陷阱。没有任意镜网、复制、回魂、伤势恢复或免死。',
    ],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '同一本体实际成功完成有限镜路；收束报告后掌握+8' : '普通事实或普通原路完成/真实停止，无能力掌握', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }),
  };
}

/** Narrow finite-scene replay: original identities, physical steps, two paid rolls and shutter operations. */
export function validateUnagingDemonessLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.unagingDemoness?.life, initial = createUnagingDemonessLifeState(), promotion = s.unagingDemoness?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, UNAGING_DEMONESS_CASE_IDS)) return false;
  let combatSeconds = 0;
  for (const round of s.combatHistory) { const seconds = round.unagingDemonessOutcome?.elapsedSeconds ?? 0; if (!integer(seconds)) return false; combatSeconds += seconds; }
  if (!integer(combatSeconds) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.siteId !== initial.siteId || !['START', 'A', 'B', 'INNER_A', 'INNER_B'].includes(l.playerLocation) || l.activeCase !== null && !UNAGING_DEMONESS_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['vera', 'marcus', 'portrait', 'register', 'parcel', 'receipt', 'testSign', 'mirrorA', 'mirrorB', 'shutter', 'entry'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (typeof l.vera.willing !== 'boolean' || typeof l.marcus.willing !== 'boolean' || stableStringify(l.vera) !== stableStringify({ ...initial.vera, willing: l.vera.willing }) || stableStringify(l.marcus) !== stableStringify({ ...initial.marcus, willing: l.marcus.willing })) return false;
  if (s.seer.completedSources.filter(source => source === 'unaging-demoness-reflection').length !== Number(l.reflected)) return false;
  for (const id of UNAGING_DEMONESS_CASE_IDS) if (s.seer.completedSources.filter(source => source === sourceFor(id)).length !== Number(l.cases[id].status === 'RESOLVED')) return false;
  const pristine = { ...initial, clockSeconds: combatSeconds, vera: { ...initial.vera, willing: l.vera.willing }, marcus: { ...initial.marcus, willing: l.marcus.willing } };
  if (promotion === null) return stableStringify(l) === stableStringify(pristine);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(pristine);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['dated-record'].observedWeek !== l.introducedWeek) return false;
  const replay = createUnagingDemonessLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, activeEvent: null, combat: null, unagingDemoness: { ...s.unagingDemoness, life: replay } };
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of UNAGING_DEMONESS_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || id === 'dated-record' && r.method === 'ABILITY' || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[UNAGING_DEMONESS_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality;
    const expected = freshAttempt(shadow, a.method); replay.activeCase = id; replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [expected], status: 'ACTIVE', contactOpen: true, closes: 0, returned: false };
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'veraWilling', 'marcusWilling']) || typeof step.veraWilling !== 'boolean' || typeof step.marcusWilling !== 'boolean' || !ABILITY_STEPS.includes(step.type) && step.tier !== null || ABILITY_STEPS.includes(step.type) && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'REFLECT'].includes(step.type) || !validateUnagingDemonessActivityCommand({ type: step.type, caseId: id })) return false;
      replay.vera.willing = step.veraWilling; replay.marcus.willing = step.marcusWilling;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.inspected || cleanupBlock(shadow)) return false; expected.closed = true; expected.ownerConsent = expected.observerConsent = 'CLOSED'; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') resolved++; replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.vera.willing = l.vera.willing; replay.marcus.willing = l.marcus.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !(promoted(s) || s.progression.pathwayId === 'demoness' && s.progression.sequence === 2) || (s.progression.sequence === 2 ? s.calamityDemoness.unagingDemonessActingAtPromotion : s.progression.acting) === resolved * 25 + Number(l.reflected) * 25;
}
