import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasProphecyMasterOldPractice, hasProphecyMasterRitualLock } from './index.js';

export const PROPHECY_MASTER_CASE_IDS = ['bell-schedule', 'covered-door', 'bounded-source'] as const;
export type ProphecyMasterCaseId = typeof PROPHECY_MASTER_CASE_IDS[number];
export type ProphecyMasterLocation = 'START' | 'A' | 'B';
export type ProphecyMasterConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export type ProphecyMasterHypothesis = 'ALARM' | 'HANDOVER';
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'TAKE_RECORD' | 'GLIMPSE' | 'GO_A' | 'COMPARE_EVIDENCE' | 'RETURN_START' | 'RETURN_RECORD' | 'INSPECT';
type BellCommand = 'READ_SCHEDULE' | 'WITNESS_BELL';
type DoorCommand = 'CHECK_DOOR' | 'WALK_B' | 'DELIVER_PARCEL' | 'READ_DELIVERY' | 'RETURN_A';
type BoundedCommand = 'CHECK_WARNING' | 'CLOSE_SHUTTER' | 'STOP_INQUIRY' | 'ORDINARY_CHECK';
export type ProphecyMasterActivityCommand =
  | { type: CommonCommand; caseId: ProphecyMasterCaseId }
  | { type: BellCommand; caseId: 'bell-schedule' }
  | { type: DoorCommand; caseId: 'covered-door' }
  | { type: BoundedCommand; caseId: 'bounded-source' }
  | { type: 'STATE_HYPOTHESIS'; caseId: 'bell-schedule' | 'covered-door'; hypothesis: ProphecyMasterHypothesis }
  | { type: 'PREPARE'; caseId: ProphecyMasterCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
type SceneType = Exclude<ProphecyMasterActivityCommand['type'], 'OBSERVE' | 'PREPARE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'REFLECT'>;
export interface ProphecyMasterMovement { from: ProphecyMasterLocation; to: ProphecyMasterLocation; mode: 'WALK'; metres: number; seconds: number; itemIds: string[] }
export interface ProphecyMasterEvidence { sourceId: string; text: string; atSecond: number }
export interface ProphecyMasterLifeStep { type: SceneType; tier: PublicResolutionTier | null; hypothesis: ProphecyMasterHypothesis | null; atSecond: number; ownerWilling: boolean; keeperWilling: boolean; receiverWilling: boolean }
export interface ProphecyMasterAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; elapsedSeconds: number; playerTravelMetres: number; playerMoves: ProphecyMasterMovement[]; steps: ProphecyMasterLifeStep[]; spiritualitySpent: number; mindSpent: number;
  ownerConsent: ProphecyMasterConsent; keeperConsent: ProphecyMasterConsent; receiverConsent: ProphecyMasterConsent; withdrawn: boolean; stopped: boolean; inspected: boolean; recordTaken: boolean; recordReturned: boolean;
  glimpseTier: PublicResolutionTier | null; glimpseText: string | null; glimpseAtSecond: number | null; hypothesis: ProphecyMasterHypothesis | null; hypothesisAtSecond: number | null;
  scheduleRead: boolean; bellWitnessed: boolean; doorChecked: boolean; delivered: boolean; deliveryRead: boolean; warningRead: boolean; shutterClosed: boolean; ordinaryChecked: boolean;
  evidence: ProphecyMasterEvidence[]; compared: boolean; correction: string | null; comparedAtSecond: number | null;
}
export interface ProphecyMasterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: ProphecyMasterAttempt[];
}
interface OriginalItem { id: string; owner: 'PM3-IRIS'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'RECEIVER'; travelMetres: number }
export interface ProphecyMasterLifeState {
  siteId: 'PM3-WAREHOUSE'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: ProphecyMasterCaseId | null;
  playerLocation: ProphecyMasterLocation; playerTravelMetres: number; clockSeconds: number;
  owner: { id: 'PM3-IRIS'; name: '艾瑞丝·沃德'; age: 49; alive: true; willing: boolean; location: 'START' };
  keeper: { id: 'PM3-NELL'; name: '内尔·肖'; age: 44; alive: true; willing: boolean; location: 'A' };
  receiver: { id: 'PM3-TOMAS'; name: '托马斯·里德'; age: 37; alive: true; willing: boolean; location: 'B' };
  records: Record<ProphecyMasterCaseId, OriginalItem>;
  bell: { id: 'PM3-BELL'; owner: 'PM3-IRIS'; quantity: 1; location: 'A'; rackId: 'PM3-BELL-RACK'; support: 'RACK'; rings: number; handling: { from: 'RACK' | 'KEEPER'; to: 'RACK' | 'KEEPER'; atSecond: number }[]; witnessedEvent: 'HANDOVER' | null };
  schedule: { id: 'PM3-SCHEDULE'; owner: 'PM3-IRIS'; quantity: 1; location: 'A' };
  door: { id: 'PM3-DOOR'; location: 'A'; locked: true; inspected: boolean };
  curtain: { id: 'PM3-CURTAIN'; owner: 'PM3-IRIS'; quantity: 1; location: 'A'; state: 'COVERING'; purposeRead: boolean };
  parcel: OriginalItem & { id: 'PM3-PARCEL'; massGrams: 800; sealed: true };
  receipt: OriginalItem & { id: 'PM3-RECEIPT'; signed: boolean };
  instrument: { id: 'PM3-SEALED-ECHO'; owner: 'PM3-IRIS'; quantity: 1; location: 'A'; coreSealed: true; residualLevel: 1; checked: boolean };
  shutter: { id: 'PM3-SHUTTER'; owner: 'PM3-IRIS'; quantity: 1; location: 'A'; state: 'OPEN' | 'CLOSED'; closures: number };
  cases: Record<ProphecyMasterCaseId, ProphecyMasterCaseState>; reflected: boolean;
}
export interface ProphecyMasterLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphecyMasterActivityCommand }
/** The door's hidden condition is not part of the public view until physically inspected. */
export interface ProphecyMasterLifeProjection extends Omit<ProphecyMasterLifeState, 'cases' | 'door' | 'curtain'> {
  door: Omit<ProphecyMasterLifeState['door'], 'locked'> & { locked: true | null };
  curtain: Omit<ProphecyMasterLifeState['curtain'], 'state'> & { state: 'COVERING' | null };
  title: string; story: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: ProphecyMasterAttempt | null;
  cases: { id: ProphecyMasterCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ProphecyMasterAttempt[] }[];
  actions: ProphecyMasterLifeAction[];
}
const ABILITY = 'hermit.s3.prophetic-glimpse' as const;
export const PROPHECY_MASTER_LIFE_ENVIRONMENT = '三项原创G有限实践：观察、准备、实施、报告各1行动，末次反思1行动，共13行动。每案最多一次预兆，6灵性、2精神、知识18；失败同样付费。实际成功且完成物证核对并报告才掌握+8；每报告扮演25，反思25。START↔A6米6秒，A↔B12米12秒，全部步行，无瞬移。';
export const PROPHECY_MASTER_LIFE_STORY = '原著已核序列3预言大师与模糊命运画面需解释、受位格限制和可能判断错误的边界。本作人物、场景、画面、参数均为G；没有点击真相、必然改命或阻止所有灾难。完整原著配方与仪式未核，旧神话血和旧公开故事不新增；信息生命与阻止高位灾难的仪式属于下一阶2贤者。';
const CASES = [
  { id: 'bell-schedule', title: 'G · 两种相似铃声', story: '艾瑞丝49岁在START保管本案原记录页，内尔44岁在A原铃架旁。先独立写下模糊画面与ALARM警报或HANDOVER交接假说；实际6米到A读原排班册，再亲眼等待原铃事件发生，最后比较。假说可以错误，未来事件发生前不提供结果。' },
  { id: 'covered-door', title: 'G · 遮暗的门与原封包', story: 'START原主独立借出本案原记录页和同一800克封包。模糊画面不能代替开门或送件；本人到A实际查门，再沿12米普通侧道到B，当面问37岁托马斯是否仍愿接收、实际交原包并核原签收，持原页和原回执走12米回A、6米回START。' },
  { id: 'bounded-source', title: 'G · 明确止步的低强度残响', story: '原主明确说明：A原封存件是原创G低强度残响教学，许可仅及可观测外壳。模糊预兆成功也不知全部来源，失败可立即停用；本人实走6米读原警示、关闭原遮盖、明确停止探查，再普通核对既有说明。核心始终封存，不继续探高位来源，也不把停查说成驱散污染。' },
] as const;
const COMMON: readonly string[] = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'TAKE_RECORD', 'GLIMPSE', 'GO_A', 'COMPARE_EVIDENCE', 'RETURN_START', 'RETURN_RECORD', 'INSPECT'];
const SPECIFIC: Record<ProphecyMasterCaseId, readonly string[]> = { 'bell-schedule': ['READ_SCHEDULE', 'WITNESS_BELL'], 'covered-door': ['CHECK_DOOR', 'WALK_B', 'DELIVER_PARCEL', 'READ_DELIVERY', 'RETURN_A'], 'bounded-source': ['CHECK_WARNING', 'CLOSE_SHUTTER', 'STOP_INQUIRY', 'ORDINARY_CHECK'] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'hermit' && [3, 2].includes(s.progression.sequence ?? 0);
const sourceFor = (id: ProphecyMasterCaseId) => `prophecy-master-life-${id}`;
const freshCase = (): ProphecyMasterCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): ProphecyMasterAttempt {
  return { week: s.week, date: { ...s.date }, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, mindSpent: 0,
    ownerConsent: 'UNASKED', keeperConsent: 'UNASKED', receiverConsent: 'UNASKED', withdrawn: false, stopped: false, inspected: false, recordTaken: false, recordReturned: false,
    glimpseTier: null, glimpseText: null, glimpseAtSecond: null, hypothesis: null, hypothesisAtSecond: null, scheduleRead: false, bellWitnessed: false, doorChecked: false, delivered: false, deliveryRead: false, warningRead: false, shutterClosed: false, ordinaryChecked: false,
    evidence: [], compared: false, correction: null, comparedAtSecond: null };
}
export function createProphecyMasterLifeState(): ProphecyMasterLifeState {
  const item = { owner: 'PM3-IRIS', quantity: 1, location: 'OWNER', travelMetres: 0 } as const;
  return { siteId: 'PM3-WAREHOUSE', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    owner: { id: 'PM3-IRIS', name: '艾瑞丝·沃德', age: 49, alive: true, willing: true, location: 'START' }, keeper: { id: 'PM3-NELL', name: '内尔·肖', age: 44, alive: true, willing: true, location: 'A' }, receiver: { id: 'PM3-TOMAS', name: '托马斯·里德', age: 37, alive: true, willing: true, location: 'B' },
    records: { 'bell-schedule': { ...item, id: 'PM3-BELL-RECORD' }, 'covered-door': { ...item, id: 'PM3-DOOR-RECORD' }, 'bounded-source': { ...item, id: 'PM3-BOUNDARY-RECORD' } },
    bell: { id: 'PM3-BELL', owner: 'PM3-IRIS', quantity: 1, location: 'A', rackId: 'PM3-BELL-RACK', support: 'RACK', rings: 0, handling: [], witnessedEvent: null }, schedule: { id: 'PM3-SCHEDULE', owner: 'PM3-IRIS', quantity: 1, location: 'A' },
    door: { id: 'PM3-DOOR', location: 'A', locked: true, inspected: false }, curtain: { id: 'PM3-CURTAIN', owner: 'PM3-IRIS', quantity: 1, location: 'A', state: 'COVERING', purposeRead: false },
    parcel: { ...item, id: 'PM3-PARCEL', massGrams: 800, sealed: true }, receipt: { ...item, id: 'PM3-RECEIPT', location: 'RECEIVER', signed: false },
    instrument: { id: 'PM3-SEALED-ECHO', owner: 'PM3-IRIS', quantity: 1, location: 'A', coreSealed: true, residualLevel: 1, checked: false }, shutter: { id: 'PM3-SHUTTER', owner: 'PM3-IRIS', quantity: 1, location: 'A', state: 'OPEN', closures: 0 },
    cases: { 'bell-schedule': freshCase(), 'covered-door': freshCase(), 'bounded-source': freshCase() }, reflected: false };
}
export function validateProphecyMasterActivityCommand(v: unknown): v is ProphecyMasterActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (typeof v.caseId !== 'string' || !PROPHECY_MASTER_CASE_IDS.includes(v.caseId as ProphecyMasterCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && typeof v.method === 'string' && ['ORDINARY', 'ABILITY'].includes(v.method);
  if (v.type === 'STATE_HYPOTHESIS') return v.caseId !== 'bounded-source' && shape(v, ['type', 'caseId', 'hypothesis']) && typeof v.hypothesis === 'string' && ['ALARM', 'HANDOVER'].includes(v.hypothesis);
  return shape(v, ['type', 'caseId']) && (COMMON.includes(v.type) || SPECIFIC[v.caseId as ProphecyMasterCaseId].includes(v.type));
}
export const isProphecyMasterActivityCommand = validateProphecyMasterActivityCommand;
const currentAttempt = (s: SliceState) => s.prophecyMaster.life.activeCase ? s.prophecyMaster.life.cases[s.prophecyMaster.life.activeCase].attempts.at(-1) ?? null : null;
const carriedItems = (l: ProphecyMasterLifeState) => [...PROPHECY_MASTER_CASE_IDS.map(id => l.records[id]), l.parcel, l.receipt].filter(item => item.location === 'PLAYER');
const ownerConsents = (s: SliceState, a: ProphecyMasterAttempt) => a.ownerConsent === 'GRANTED' && s.prophecyMaster.life.owner.willing && !a.withdrawn;
function cleanupBlock(s: SliceState): string | null {
  const l = s.prophecyMaster.life;
  if (l.playerLocation !== 'START') return '本人须从B普通12米回A，再6米回START；关闭不能代替真实返回。';
  if (carriedItems(l).length) return '须在START交还本人实持的同一原记录页、未交原包或原回执，远处原物不会传来。';
  return null;
}
export const hasProphecyMasterLifeLock = (s: SliceState): boolean => s.prophecyMaster.life.activeCase !== null || Object.values(s.prophecyMaster.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
function evidenceComplete(id: ProphecyMasterCaseId, a: ProphecyMasterAttempt): boolean {
  return id === 'bell-schedule' ? a.scheduleRead && a.bellWitnessed : id === 'covered-door' ? a.doorChecked && a.delivered && a.deliveryRead : a.warningRead && a.shutterClosed && a.stopped && a.ordinaryChecked;
}
function sceneReason(s: SliceState, id: ProphecyMasterCaseId, type: SceneType): string | null {
  const l = s.prophecyMaster.life, a = l.cases[id].attempts.at(-1)!, at = l.playerLocation, page = l.records[id];
  if (s.health <= 0 || s.status === 'DEAD') return '同一本体已死亡；预兆不能复活或代办原路返回。';
  if (a.inspected) return '已经实际检查收口，只可关闭现场。';
  if (type === 'WITHDRAW') return a.withdrawn ? '已撤回；仍须依当前真实位置归还原物。' : null;
  if (type === 'STOP_INQUIRY') return a.stopped ? '已停止能力探查，不重复领取。' : null;
  if (type === 'RETURN_A') return at === 'B' && (a.compared || a.withdrawn) ? null : '须在B完成物证比较或明确撤回，再沿12米普通原路回A。';
  if (type === 'RETURN_START') return at === 'A' && (a.compared || a.withdrawn) ? null : '须先完成真实比较或明确撤回，在A沿6米普通原路返回；B不能直返。';
  if (type === 'RETURN_RECORD') return at === 'START' && carriedItems(l).length > 0 ? null : '须本人已携原物回START，才可实际归还；不会复制或远程回收。';
  if (type === 'INSPECT') return cleanupBlock(s) ?? (a.compared || a.withdrawn ? null : '先核对本案实际证据，或明确撤回并如实保留未完成。');
  if (a.withdrawn) return '本案许可已撤回；仅可真实返回、归还原物和收口。';
  if (s.mind <= 0) return '精神不足；可0行动停止、撤回和按实际位置归还。';
  if (type === 'CONSENT_OWNER') return at === 'START' && a.ownerConsent === 'UNASKED' ? null : '须在START当面询问本案独立许可；回答不重掷。';
  if (!ownerConsents(s, a)) return '原主尚未同意本案或已撤回；可明确撤回并实际归物。';
  if (type === 'TAKE_RECORD') return at === 'START' && !a.recordTaken && page.location === 'OWNER' && (id !== 'covered-door' || l.parcel.location === 'OWNER') ? null : '须本案原页确在原主处且未借取；送件案还须同一原包在START。';
  if (type === 'GLIMPSE') {
    if (at !== 'START' || page.location !== 'PLAYER' || a.method !== 'ABILITY' || a.glimpseTier !== null || a.hypothesis !== null || a.playerMoves.length || a.stopped) return '仅能力方案在出发前持原页可独立尝试一次；不能读过物证再补写预兆。';
    return s.spirituality < 6 ? '需要6灵性，失败也实耗；不足可普通核查。' : s.mind < 2 ? '需要2精神，失败也实耗；不足可普通核查。' : null;
  }
  if (type === 'STATE_HYPOTHESIS') return at === 'START' && page.location === 'PLAYER' && a.hypothesis === null && !a.playerMoves.length ? null : '须出发前持原页独立写一种待验证解释；看见后不能重写原假说。';
  if (type === 'GO_A') return at === 'START' && page.location === 'PLAYER' && !a.playerMoves.length && (id === 'bounded-source' || a.hypothesis !== null) ? null : '须先借到同一原页；前两案先保存独立假说，再从START实走6米到A。';
  if (page.location !== 'PLAYER') return '须本人实持本案原记录页，不能远程写入原件。';
  if (type === 'READ_SCHEDULE') return at === 'A' && !a.scheduleRead ? null : '须本人在A亲读同一原排班册，并当面询问内尔是否同意观察。';
  if (type === 'WITNESS_BELL') return at === 'A' && a.scheduleRead && !a.bellWitnessed && a.keeperConsent === 'GRANTED' && l.keeper.willing ? null : '须本人在A、已读原册且内尔仍同意；实际等待观察后才能知道这次发生了什么。';
  if (type === 'CHECK_DOOR') return at === 'A' && !a.doorChecked ? null : '须本人实际到A检查原门和原帘；画面不能代替观察或开锁。';
  if (type === 'WALK_B') return at === 'A' && a.doorChecked && !a.delivered && l.parcel.location === 'PLAYER' ? null : '须已实际查过A原门，并携同一原包沿12米普通侧道到B。';
  if (type === 'DELIVER_PARCEL') return at === 'B' && !a.delivered && a.receiverConsent === 'UNASKED' && l.parcel.location === 'PLAYER' && l.receipt.location === 'RECEIVER' ? null : '须本人在B持原包，当面问托马斯本次是否仍愿意；只有本人同意才能实际交接。';
  if (type === 'READ_DELIVERY') return at === 'B' && a.delivered && !a.deliveryRead && l.receipt.location === 'PLAYER' && a.receiverConsent === 'GRANTED' && l.receiver.willing ? null : '须真实交接后在B持原签收、托马斯仍同意，当面核对原帘用途；不读心。';
  if (type === 'CHECK_WARNING') return at === 'A' && !a.warningRead ? null : '须实际到A读原警示，只了解已有说明所列边界。';
  if (type === 'CLOSE_SHUTTER') return at === 'A' && a.warningRead && !a.shutterClosed && l.shutter.state === 'OPEN' ? null : '先在A读原警示，再手动关闭同一原遮盖；不会带走封存件。';
  if (type === 'ORDINARY_CHECK') return at === 'A' && a.warningRead && a.shutterClosed && a.stopped && !a.ordinaryChecked ? null : '须在A原遮盖实际关闭且已经明确停止能力探查，再普通核对外壳与既有说明。';
  if (type === 'COMPARE_EVIDENCE') return !a.compared && evidenceComplete(id, a) && at === (id === 'covered-door' ? 'B' : 'A') ? null : '先在真实现场取得本案所需物证，再与原画面及原假说比较；按钮不提供未观察的答案。';
  return '本案不支持这一现场动作。';
}
export function prophecyMasterActivityReason(s: SliceState, c: ProphecyMasterActivityCommand): string | null {
  if (!validateProphecyMasterActivityCommand(c)) return '预言大师命令无效或不属于本案。';
  if (!promoted(s)) return '先真实晋升预言大师序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '当前周目已结束或身体已死亡；预兆不提供复活。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.prophecyMaster.encounter.status)) return '先处理当前事件或真实战斗，同一本体不能在两处。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回贝克兰德原仓库。';
  const l = s.prophecyMaster.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.attempts.at(-1)?.inspected) {
    if (!r || l.activeCase !== c.caseId || !r.contactOpen) return '没有本案开放现场。';
    return cleanupBlock(s) ?? (!r.attempts.at(-1)!.inspected ? '先实际核对本人位置与原物收口。' : c.type === 'WITHDRAW' && !r.attempts.at(-1)!.withdrawn ? '先明确撤回本案。' : null);
  }
  if (!['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type)) return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType) : '先实施本案，再操作同一原现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先按真实位置返回、归还原物并收束当前现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一案准备。';
  if (hasProphecyMasterOldPractice(s) || hasProphecyMasterRitualLock(s)) return '先真实结束旧实践和当次服药准备，不能跨场地挪动原人原物。';
  if (s.mind <= 0) return '先恢复精神后再开始新实践；现场收口不收新资源。';
  if (s.actionsRemaining < 1) return '需要1行动；真实收口后可以跨周。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成本次反思。' : PROPHECY_MASTER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!r || r.status === 'RESOLVED') return '本案有限报告已完成。';
  const i = PROPHECY_MASTER_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[PROPHECY_MASTER_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成上一案真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已经观察本案，不重复领取。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原现场。' : s.actionsRemaining < 2 ? '准备需1行动并保留另1行动实施，避免准备锁住跨周。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' ? null : '先选择本案能力或普通准备。';
  return r.status === 'EXAMINED' && !r.contactOpen ? null : '先实际收口再报告；关闭不代办归还。';
}
export const blockProphecyMasterLife = prophecyMasterActivityReason;
export function advanceProphecyMasterLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.prophecyMaster.life.clockSeconds + seconds)) throw new Error('原仓库累计秒数无效。');
  s.prophecyMaster.life.clockSeconds += seconds;
}
function elapse(s: SliceState, a: ProphecyMasterAttempt, seconds: number) { a.elapsedSeconds += seconds; advanceProphecyMasterLifeClock(s, seconds); }
function move(s: SliceState, a: ProphecyMasterAttempt, to: ProphecyMasterLocation, metres: number) {
  const l = s.prophecyMaster.life, carried = carriedItems(l);
  a.playerMoves.push({ from: l.playerLocation, to, mode: 'WALK', metres, seconds: metres, itemIds: carried.map(item => item.id) });
  for (const item of carried) item.travelMetres += metres;
  l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres);
}
function addEvidence(a: ProphecyMasterAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function applyScene(s: SliceState, id: ProphecyMasterCaseId, step: ProphecyMasterLifeStep): void {
  const l = s.prophecyMaster.life, a = l.cases[id].attempts.at(-1)!; a.steps.push({ ...step });
  switch (step.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.owner.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 2); break;
    case 'TAKE_RECORD': l.records[id].location = 'PLAYER'; if (id === 'covered-door') l.parcel.location = 'PLAYER'; a.recordTaken = true; elapse(s, a, 1); break;
    case 'GLIMPSE':
      a.glimpseTier = step.tier; s.spirituality -= 6; s.mind -= 2; a.spiritualitySpent += 6; a.mindSpent += 2; elapse(s, a, 2); a.glimpseAtSecond = a.elapsedSeconds;
      a.glimpseText = !success(step.tier) ? '未得到可靠画面；不形成来源或事件结论。' : id === 'bell-schedule' ? '两声回响，原架暂空。含义不明，不能据此断定警报或交接。' : id === 'covered-door' ? '遮暗的门，一线亮光。原因、通路与当事人意图未明。' : '过亮的边缘，未辨来源。仅低强度可观测边缘，不足以判断核心或高位秘密。';
      break;
    case 'STATE_HYPOTHESIS': a.hypothesis = step.hypothesis; elapse(s, a, 1); a.hypothesisAtSecond = a.elapsedSeconds; break;
    case 'GO_A': move(s, a, 'A', 6); break;
    case 'READ_SCHEDULE':
      a.scheduleRead = true; a.keeperConsent = l.keeper.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 2);
      addEvidence(a, l.schedule.id, '实际读到原册分别列有警报与清点交接两种相似铃声；仅凭两声或暂空的架不能确定下一次是哪一种。'); break;
    case 'WITNESS_BELL': {
      const start = a.elapsedSeconds; l.bell.handling.push({ from: 'RACK', to: 'KEEPER', atSecond: start + 2 }); elapse(s, a, 12);
      l.bell.handling.push({ from: 'KEEPER', to: 'RACK', atSecond: a.elapsedSeconds }); l.bell.rings += 2; l.bell.witnessedEvent = 'HANDOVER'; a.bellWitnessed = true;
      addEvidence(a, l.bell.id, '在A真实等候12秒，内尔按原排班执行清点：取下同一原铃，敲两声后放回原架，并当面说明本次交接。实际发生的是HANDOVER，未发生警报。'); break;
    }
    case 'CHECK_DOOR': a.doorChecked = true; l.door.inspected = true; elapse(s, a, 2); addEvidence(a, l.door.id, '本人在A实查：原门已锁，原帘遮住门面；门下有一线日光。画面没有打开锁，也不能让身体穿门。'); break;
    case 'WALK_B': move(s, a, 'B', 12); break;
    case 'DELIVER_PARCEL':
      a.receiverConsent = l.receiver.willing ? 'GRANTED' : 'DECLINED'; elapse(s, a, 2);
      if (l.receiver.willing) { l.parcel.location = 'RECEIVER'; l.receipt.location = 'PLAYER'; l.receipt.signed = true; a.delivered = true; addEvidence(a, l.parcel.id, '本人在B当面询问，托马斯明确同意后接到同一800克原封包；同一原回执实际签收并交到本人手中。'); }
      break;
    case 'READ_DELIVERY': a.deliveryRead = true; l.curtain.purposeRead = true; elapse(s, a, 2); addEvidence(a, l.receipt.id, '在B实际核原签收，托马斯当面说明原帘用于遮光保管；本次是普通交接，并非原假说自动成为事实。'); break;
    case 'CHECK_WARNING': a.warningRead = true; elapse(s, a, 2); addEvidence(a, l.instrument.id, '本人在A读原警示：封存的是原创G低强度残响；许可仅及外壳与已有说明，禁止开启核心或继续探高位来源。'); break;
    case 'CLOSE_SHUTTER': a.shutterClosed = true; l.shutter.state = 'CLOSED'; l.shutter.closures++; elapse(s, a, 2); break;
    case 'STOP_INQUIRY': a.stopped = true; elapse(s, a, 1); break;
    case 'ORDINARY_CHECK': a.ordinaryChecked = true; l.instrument.checked = true; elapse(s, a, 2); addEvidence(a, l.instrument.id, '在A停用能力后普通核原外壳与既有说明：封存状态未破坏，残响仍为原低强度1；没有打开核心，来源未进一步查明，停止不等于驱散。'); break;
    case 'COMPARE_EVIDENCE':
      a.compared = true; elapse(s, a, 2); a.comparedAtSecond = a.elapsedSeconds;
      a.correction = id === 'bell-schedule' ? `保留当时${a.hypothesis}假说。原排班与本人后来亲见的清点交接支持HANDOVER；${a.hypothesis === 'ALARM' ? '原警报解释已被真实证据否定并修正' : '原交接解释经实际事件核对才得到支持'}。预兆自身从未写入这个答案。` : id === 'covered-door' ? `保留当时${a.hypothesis}假说。后来本人查原门、携原包走侧道、当面交接并核原回执，才确认普通保管与交接；原帘不是预兆替人开出的通道。` : '保留当时有限画面或失败记录。后来的原警示、手动关闭、明确停查与普通外壳核对只证明许可范围内的封存状态；来源仍未查明，不写高位秘密或净化成功。';
      break;
    case 'RETURN_A': move(s, a, 'A', 12); break;
    case 'RETURN_START': move(s, a, 'START', 6); break;
    case 'RETURN_RECORD': for (const item of carriedItems(l)) item.location = 'OWNER'; a.recordReturned = true; elapse(s, a, 1); break;
    case 'WITHDRAW': a.withdrawn = true; a.stopped = true; l.cases[id].withdrawals++; elapse(s, a, 1); break;
    case 'INSPECT':
      a.inspected = true; a.result = !a.withdrawn && a.compared && evidenceComplete(id, a) && success(a.glimpseTier) ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result; elapse(s, a, 2); break;
  }
}
export function applyProphecyMasterActivity(s: SliceState, c: ProphecyMasterActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = prophecyMasterActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.prophecyMaster.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('prophecy-master-reflection'); ctx.note('G · 模糊预兆与真实证据反思', '三份真实报告后扮演+25；原错误假说、实际行动和已付成本全部保留。预兆需解释，来源有边界，不能保证阻止所有灾难。'); return; }
  const r = l.cases[c.caseId], spec = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备1行动已付，选择${c.method === 'ABILITY' ? '可另付6灵性和2精神作一次有限预兆' : '普通核对'}；不自动施术，不代替成年当事人的独立许可。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施准备', '0行动；已付行动不退，原人原物没有移动。'); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = c.caseId; ctx.note(spec.title, '实施1行动已付；本人仍在START，未施术。须逐步询问、领取原件、记录假说并真实行走。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `如实报告扮演+25；${r.result === 'ABILITY' ? '本次付费预兆实际成功，且后来亲历行动、核原证据并真实收口，预兆掌握+8' : '普通核对、预兆失败或实际撤回不加能力掌握'}。原假说与原成本不改写。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && a.inspected) { a.closed = true; a.ownerConsent = a.keeperConsent = a.receiverConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('收束真实原仓库现场', '本人实际回START，原页与本人所持借物或回执已归还；若原包已交付，仍在B托马斯处。没有瞬移、复制、补灵或补精神。'); return; }
  const tier = c.type === 'GLIMPSE' ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, hypothesis: c.type === 'STATE_HYPOTHESIS' ? c.hypothesis : null, atSecond: a.elapsedSeconds, ownerWilling: l.owner.willing, keeperWilling: l.keeper.willing, receiverWilling: l.receiver.willing });
  const detail = c.type === 'GLIMPSE' ? `已实耗6灵性、2精神，知识18结果${tier}。${a.glimpseText}` : c.type === 'STATE_HYPOTHESIS' ? `已独立保存${c.hypothesis}待验证假说，允许判断错误，未来核对不会抹去它。` : c.type === 'COMPARE_EVIDENCE' ? a.correction : c.type === 'WITHDRAW' ? '已停止能力并明确撤回；本人与原物仍在当前真实位置，须逐步归还。' : c.type === 'STOP_INQUIRY' ? '已明确停止能力探查；不再探高位来源，接下来仍需实际关闭与普通原件核对。' : '本步只记录本人现场取得的证据和实际行动；许可来自成年当事人的回答，不由骰子强迫。';
  ctx.note(`G · ${c.type}`, `${detail} 本人${l.playerLocation}，本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，已耗${a.spiritualitySpent}灵性/${a.mindSpent}精神。`);
}
const LABELS: Record<Exclude<SceneType, 'STATE_HYPOTHESIS'>, [string, string]> = {
  CONSENT_OWNER: ['当面询问艾瑞丝本案独立许可', '2秒'], TAKE_RECORD: ['领取本案原记录页及约定原物', '1秒 · 送件案实际另领800克原包'], GLIMPSE: ['在事件发生前独立尝试模糊预兆', '6灵性+2精神 · 知识18 · 2秒 · 本案仅一次'], GO_A: ['携同一原物从START实走到A', '6米6秒'],
  READ_SCHEDULE: ['在A读原排班册并询问内尔许可', '2秒 · 不预填未来结果'], WITNESS_BELL: ['留在A亲眼等待原铃事件实际发生', '12秒 · 事件后才记录结果'], CHECK_DOOR: ['本人在A实际查看原门与原帘', '2秒'], WALK_B: ['携同一原包沿普通侧道走到B', '12米12秒'], DELIVER_PARCEL: ['在B问托马斯是否愿意，再交同一原包', '2秒 · 实际交接才取原回执'], READ_DELIVERY: ['在B核原签收并听本人说明', '2秒 · 普通核对'],
  CHECK_WARNING: ['在A亲读原封存件的范围警示', '2秒'], CLOSE_SHUTTER: ['在A手动关闭同一原遮盖', '2秒'], STOP_INQUIRY: ['明确停止能力探查，拒绝继续探高位来源', '1秒 · 不等于驱散'], ORDINARY_CHECK: ['停查后普通核原外壳与已有说明', '2秒 · 核心不打开'], COMPARE_EVIDENCE: ['将原画面、原假说与后来亲见证据比较', '2秒 · 保留原错误记录'], RETURN_A: ['本人从B沿普通原路回A', '12米12秒'], RETURN_START: ['本人从A沿普通原路回START', '6米6秒'], RETURN_RECORD: ['在START归还同一原页及本人实持原物', '1秒'], INSPECT: ['实际检查本人返回、原物归属与记录', '2秒'], WITHDRAW: ['停止并撤回本次，按真实位置归还', '1秒 · 已付不退'],
};
const SCENE_ORDER: readonly SceneType[] = ['CONSENT_OWNER', 'TAKE_RECORD', 'GLIMPSE', 'STATE_HYPOTHESIS', 'GO_A', 'READ_SCHEDULE', 'WITNESS_BELL', 'CHECK_DOOR', 'WALK_B', 'DELIVER_PARCEL', 'READ_DELIVERY', 'CHECK_WARNING', 'CLOSE_SHUTTER', 'STOP_INQUIRY', 'ORDINARY_CHECK', 'COMPARE_EVIDENCE', 'RETURN_A', 'RETURN_START', 'RETURN_RECORD', 'INSPECT', 'WITHDRAW'];
export function prophecyMasterLifeActions(s: SliceState): ProphecyMasterLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.prophecyMaster.life, actions: ProphecyMasterLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: ProphecyMasterActivityCommand) => { const reason = prophecyMasterActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id], index = PROPHECY_MASTER_CASE_IDS.indexOf(id);
    if (index > 0 && l.cases[PROPHECY_MASTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原人、原物与边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add(`${id}-ability`, '准备一次有限预兆及真实核对', '1行动 · 另留1行动实施 · 施术另付6灵性+2精神', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add(`${id}-ordinary`, '准备普通原件核对与实际行动', '1行动 · 另留1行动实施 · 0灵性', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add(`${id}-perform`, '实施本次原仓库实践', '1行动 · 不自动施术', { type: 'PERFORM', caseId: id }); add(`${id}-withdraw-preparation`, '取消尚未实施的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      if (a.inspected) { add(`${id}-close`, '关闭已经真实收口的现场', '0行动', { type: 'CLOSE', caseId: id }); if (a.withdrawn) add(`${id}-withdraw`, '确认撤回并保留原成本', '0行动', { type: 'WITHDRAW', caseId: id }); }
      else for (const type of SCENE_ORDER) {
        if (type === 'STATE_HYPOTHESIS') { if (id === 'bounded-source') continue; for (const hypothesis of ['ALARM', 'HANDOVER'] as const) { const command: ProphecyMasterActivityCommand = { type, caseId: id, hypothesis }; if (prophecyMasterActivityReason(s, command) === null) add(`${id}-hypothesis-${hypothesis}`, `独立记录${hypothesis === 'ALARM' ? '警报' : '交接'}假说（待验证）`, '0行动 · 1秒 · 允许错误', command); } continue; }
        const command = { type, caseId: id } as ProphecyMasterActivityCommand;
        if (!validateProphecyMasterActivityCommand(command)) continue;
        const awaitingAbility = type === 'GLIMPSE' && a.method === 'ABILITY' && a.glimpseTier === null && a.recordTaken && l.playerLocation === 'START' && a.hypothesis === null && !a.withdrawn && !a.stopped;
        if (prophecyMasterActivityReason(s, command) === null || awaitingAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], `0行动 · ${LABELS[type][1]}`, command);
      }
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '如实报告原画面、假说、证据与实际行动', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '实际成功预兆与核查掌握+8' : '无能力掌握奖励'}`, { type: 'REPORT', caseId: id });
  }
  if (!l.reflected && PROPHECY_MASTER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('prophecy-master-reflect', '反思模糊预兆、错误解释与来源边界', '1行动 · 扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectProphecyMasterLife(s: SliceState): ProphecyMasterLifeProjection {
  const l = s.prophecyMaster.life, actions = prophecyMasterLifeActions(s), a = currentAttempt(s), inside = hasProphecyMasterLifeLock(s);
  const next = actions.find(v => v.enabled && v.command.type !== 'WITHDRAW' && !(v.command.type === 'STOP_INQUIRY' && !a?.shutterClosed)) ?? actions.find(v => v.enabled);
  return { ...structuredClone(l), door: { ...l.door, locked: l.door.inspected ? true : null }, curtain: { ...l.curtain, state: l.door.inspected ? 'COVERING' : null }, title: '预言大师 · 模糊预兆与真实证据', story: PROPHECY_MASTER_LIFE_STORY, environment: PROPHECY_MASTER_LIFE_ENVIRONMENT, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : l.reflected ? '三份报告与反思已完成；原物、错误假说和真实消耗保留，可继续普通生活。' : '先晋升并处理当前事件，或查看尚未满足的真实条件。',
    facts: [
      `同一本体在${l.playerLocation}，累计步行${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒（含实际战斗）。START↔A6米，普通A↔B12米；B须先实际回A，不能直接回START。`,
      `原主${l.owner.name}/${l.owner.id}/49岁在START，当前${l.owner.willing ? '愿意' : '拒绝'}；原保管人${l.keeper.name}/${l.keeper.id}/44岁在A；原接收人${l.receiver.name}/${l.receiver.id}/37岁在B。每案原主独立许可；内尔在读原册时、托马斯在实际交接前亲自回答，任何一人可撤回。`,
      `三张不同原页：${PROPHECY_MASTER_CASE_IDS.map(id => `${l.records[id].id}@${l.records[id].location}/${l.records[id].travelMetres}米`).join('；')}。原预兆、原假说和后来取得的证据逐步写入原页记录，不回改过去。`,
      l.bell.witnessedEvent === null ? 'A原铃尚无本场亲见事件记录；预兆和原假说都不是事件结果。' : `A同一原铃已实际敲${l.bell.rings}声并放回原架；本人已亲见的本次结果为清点交接。原架暂空只在保管人实际取铃的时段发生。`,
      l.door.inspected ? '本人已实查A原锁与遮帘；通往B的12米普通侧道实际可走，预兆没有开锁、透门或传送。' : 'A原门与原帘的当前情况尚未亲自核实，不从模糊画面提供隐藏状态。',
      `同一${l.parcel.id}一件800克、封口保持，在${l.parcel.location}，实际随身${l.parcel.travelMetres}米；同一${l.receipt.id}在${l.receipt.location}，${l.receipt.signed ? '已真实签收' : '尚未签收'}，实际随身${l.receipt.travelMetres}米。RECEIVER是B的原托马斯。`,
      `原封存件${l.instrument.id}一直留A，核心始终封存；原遮盖${l.shutter.id}@A为${l.shutter.state}，实际关闭${l.shutter.closures}次。仅原创G低强度残响教学，不探索高位来源，停止不等于驱散。`,
      '成功画面也不直接判真；失败不补费、不重抽，不要求三个预兆全部成功。只有成功能力与后来完整的真实核查一起报告才加掌握，普通完成仍可获得真实扮演。',
    ],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '付费预兆成功且后来亲历、核证、收口；报告掌握+8' : '普通完成、能力失败或真实撤回；无能力掌握', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }),
  };
}

/** Replay the finite ordered scenes, including costs, uncertainty, original objects and actual later evidence. */
export function validateProphecyMasterLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.prophecyMaster?.life, initial = createProphecyMasterLifeState(), promotion = s.prophecyMaster?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, PROPHECY_MASTER_CASE_IDS) || !record(l.records) || !shape(l.records, PROPHECY_MASTER_CASE_IDS)) return false;
  let combatSeconds = 0;
  for (const round of s.combatHistory) { const seconds = round.prophecyMasterOutcome?.elapsedSeconds ?? 0; if (!integer(seconds)) return false; combatSeconds += seconds; }
  const encounter = s.prophecyMaster.encounter;
  if (encounter.status === 'RESOLVED' && encounter.startHistoryIndex === null && encounter.scene.playerPosition === 'EXIT') combatSeconds += 4;
  if (!integer(combatSeconds) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.siteId !== initial.siteId || !['START', 'A', 'B'].includes(l.playerLocation) || l.activeCase !== null && !PROPHECY_MASTER_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['owner', 'keeper', 'receiver', 'bell', 'schedule', 'door', 'curtain', 'parcel', 'receipt', 'instrument', 'shutter'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  for (const id of PROPHECY_MASTER_CASE_IDS) if (!record(l.records[id]) || !shape(l.records[id], Object.keys(initial.records[id]))) return false;
  for (const key of ['owner', 'keeper', 'receiver'] as const) if (typeof l[key].willing !== 'boolean' || stableStringify(l[key]) !== stableStringify({ ...initial[key], willing: l[key].willing })) return false;
  if (s.seer.completedSources.filter(source => source === 'prophecy-master-reflection').length !== Number(l.reflected)) return false;
  for (const id of PROPHECY_MASTER_CASE_IDS) if (s.seer.completedSources.filter(source => source === sourceFor(id)).length !== Number(l.cases[id].status === 'RESOLVED')) return false;
  const pristine = { ...initial, clockSeconds: combatSeconds, owner: { ...initial.owner, willing: l.owner.willing }, keeper: { ...initial.keeper, willing: l.keeper.willing }, receiver: { ...initial.receiver, willing: l.receiver.willing } };
  if (promotion === null) return stableStringify(l) === stableStringify(pristine);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(pristine);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['bell-schedule'].observedWeek !== l.introducedWeek) return false;
  const replay = createProphecyMasterLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, activeEvent: null, combat: null, prophecyMaster: { ...s.prophecyMaster, life: replay } };
  let open = 0, prepared = 0, resolved = 0, masteryEarned = 0;
  for (const [index, id] of PROPHECY_MASTER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[PROPHECY_MASTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind;
    const expected = freshAttempt(shadow, a.method); replay.activeCase = id; replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [expected], status: 'ACTIVE', contactOpen: true, closes: 0, returned: false, withdrawals: r.withdrawals - Number(a.withdrawn) };
    if (!integer(replay.cases[id].withdrawals)) return false;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'hypothesis', 'atSecond', 'ownerWilling', 'keeperWilling', 'receiverWilling']) || typeof step.ownerWilling !== 'boolean' || typeof step.keeperWilling !== 'boolean' || typeof step.receiverWilling !== 'boolean' || step.atSecond !== expected.elapsedSeconds || step.type !== 'GLIMPSE' && step.tier !== null || step.type === 'GLIMPSE' && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (step.type !== 'STATE_HYPOTHESIS' && step.hypothesis !== null) return false;
      const command = step.type === 'STATE_HYPOTHESIS' ? { type: step.type, caseId: id, hypothesis: step.hypothesis } : { type: step.type, caseId: id };
      if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'CLOSE', 'REFLECT'].includes(step.type) || !validateProphecyMasterActivityCommand(command)) return false;
      replay.owner.willing = step.ownerWilling; replay.keeper.willing = step.keeperWilling; replay.receiver.willing = step.receiverWilling;
      if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.inspected || cleanupBlock(shadow)) return false; expected.closed = true; expected.ownerConsent = expected.keeperConsent = expected.receiverConsent = 'CLOSED'; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed || replay.cases[id].withdrawals !== r.withdrawals) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') { resolved++; if (r.result === 'ABILITY') masteryEarned += 8; } replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.owner.willing = l.owner.willing; replay.keeper.willing = l.keeper.willing; replay.receiver.willing = l.receiver.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !hasHistory(s) || (s.progression.sequence === 2 ? s.sage?.prophecyMasterActingAtPromotion : s.progression.acting) === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) >= masteryEarned;
}
