import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasUndyingLifeLock, hasUndyingOldPractice } from '../undying/life.js';
import { hasUndyingRitualLock } from '../undying/ritual.js';

export const FERRYMAN_CASE_IDS = ['passage-out', 'quiet-jar', 'passage-return'] as const;
export type FerrymanCaseId = typeof FERRYMAN_CASE_IDS[number];
export type FerrymanLocation = 'START' | 'NEAR' | 'FAR';
export type FerrymanConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export interface FerrymanMovement { from: FerrymanLocation; to: FerrymanLocation; metres: number; seconds: number }
export interface FerrymanAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: FerrymanMovement[]; spiritualitySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: FerrymanConsent; ownerConsentWeek: number | null; spiritConsent: FerrymanConsent; spiritConsentWeek: number | null;
  siteVisited: boolean; recipientVisited: boolean; stopped: boolean; refused: boolean; inspected: boolean; playerReturned: boolean;
  endpointsChecked: boolean; effectActive: boolean; effectRemainingSeconds: number; effectStopped: boolean; effectExpired: boolean; waitedSeconds: number;
  materialsSpent: number; spiritCrossed: boolean; passageBenefit: boolean; spiritTravelMetres: number; spiritEnergySpent: number;
  tagTaken: boolean; tagHanded: boolean; tagDelivered: boolean; paperRecovered: boolean; paperReturned: boolean;
  replyWritten: boolean; replyTaken: boolean; replyDelivered: boolean;
  jarQuieted: boolean; jarSealed: boolean; sealBenefit: boolean; sealSpent: number; clampWear: number;
}
export interface FerrymanCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: FerrymanAttempt[];
}
export interface FerrymanLifeState {
  siteId: 'FR3-TRANSFER-HOUSE'; introducedWeek: number | null; introducedDate: PublicGameDate | null; channelId: 'ORIGINAL' | 'POST_CYCLE' | null;
  activeCase: FerrymanCaseId | null; playerLocation: FerrymanLocation; playerTravelMetres: number; clockSeconds: number;
  mara: { id: 'FR3-MARA'; name: '玛拉·柯恩'; age: 45; alive: true; willing: boolean; location: 'START' };
  ilan: { id: 'FR3-ILAN'; name: '伊兰·罗'; age: 33; alive: true; willing: boolean; location: 'FAR' };
  reed: { id: 'FR3-REED'; name: '芦羽'; source: 'CURRENT_TRANSFER_HOUSE'; friendly: true; willing: boolean; location: 'NEAR' | 'FAR'; energy: number; travelMetres: number };
  tag: { id: 'FR3-TAG'; owner: 'FR3-MARA'; quantity: 1; location: 'MARA' | 'PLAYER' | 'REED' | 'ILAN'; travelMetres: number };
  reply: { id: 'FR3-REPLY'; owner: 'FR3-ILAN'; quantity: 1; written: boolean; location: 'UNWRITTEN' | 'ILAN' | 'REED' | 'PLAYER' | 'MARA'; travelMetres: number };
  jar: { id: 'FR3-JAR'; owner: 'FR3-ILAN'; location: 'FAR'; quantity: 1; nature: 'LOW_INTENSITY_LOCAL_ECHO'; agitation: 0 | 2; residualEcho: 2; lidClosed: boolean; sealed: boolean; boxId: 'FR3-JAR-BOX' };
  materials: { id: 'FR3-PASSAGE-MATERIAL'; remaining: number }; seal: { id: 'FR3-SEAL'; remaining: number }; clamp: { id: 'FR3-CLAMP'; durability: number };
  endpoints: { nearId: 'FR3-NEAR'; farId: 'FR3-FAR'; nearLocation: 'NEAR'; farLocation: 'FAR'; nearIntact: boolean; farIntact: boolean; distanceMetres: 6; ordinarySpiritRouteMetres: 16 };
  door: { id: 'FR3-DOOR'; state: 'OPEN' | 'BLOCKED' }; cases: Record<FerrymanCaseId, FerrymanCaseState>; reflected: boolean;
}
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'GO_SITE' | 'RETURN_PLAYER' | 'INSPECT' | 'STOP_CONTACT' | 'STOP_EFFECT' | 'WAIT_WINDOW';
type PassageCommand = 'CHECK_ENDPOINTS' | 'CONSENT_SPIRIT' | 'OPEN_PASSAGE' | 'CROSS_SPIRIT' | 'GO_RECIPIENT' | 'RETURN_ITEMS';
export type FerrymanActivityCommand =
  | { type: CommonCommand; caseId: FerrymanCaseId }
  | { type: PassageCommand; caseId: 'passage-out' | 'passage-return' }
  | { type: 'HAND_TAG' | 'DELIVER_TAG'; caseId: 'passage-out' }
  | { type: 'WRITE_REPLY' | 'TAKE_REPLY' | 'DELIVER_REPLY'; caseId: 'passage-return' }
  | { type: 'QUIET_JAR' | 'SEAL_JAR'; caseId: 'quiet-jar' }
  | { type: 'PREPARE'; caseId: FerrymanCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface FerrymanLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FerrymanActivityCommand }
export interface FerrymanLifeProjection {
  title: string; story: string; environment: string; activeCase: FerrymanCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  introducedWeek: number | null; introducedDate: PublicGameDate | null; channelId: FerrymanLifeState['channelId'];
  clockSeconds: number; playerLocation: FerrymanLocation; playerTravelMetres: number; currentAttempt: FerrymanAttempt | null;
  mara: FerrymanLifeState['mara']; ilan: FerrymanLifeState['ilan']; reed: FerrymanLifeState['reed']; tag: FerrymanLifeState['tag']; reply: FerrymanLifeState['reply'];
  jar: FerrymanLifeState['jar']; materials: FerrymanLifeState['materials']; seal: FerrymanLifeState['seal']; clamp: FerrymanLifeState['clamp']; endpoints: FerrymanLifeState['endpoints']; door: FerrymanLifeState['door'];
  cases: { id: FerrymanCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: FerrymanAttempt[] }[];
  actions: FerrymanLifeAction[];
}
export const FERRYMAN_LIFE_STORY = '摆渡人·死神序列3。以下有限通道、短时护送安定、三案方法、原人原物、距离、秒数、精力与数值全部为本作原创G；不是原文已核新增技能清单。每案观察、准备、实施、报告各1行动，准备须余2行动；现场子步0行动仍实耗秒、米、灵性、原灵材、精力与封条。每案能力仅检一次6灵性，失败可普通收束，实际作用并报告才给对应掌握8。三个报告各扮演25、反思25，共13行动。只引导本次自愿的同一当地芦羽，不复活亡者、不传送玩家、不提供任意冥界入口；原灰羽与已故旧人不参与。';
const CASES = [
  { id: 'passage-out', title: 'G · 同一芦羽带同一原信签出去', story: '当前中转室玛拉45岁在START，伊兰33岁在FAR，已登记当地友善灵芦羽在NEAR。先问玛拉许可，本人携唯一FR3-TAG走4米到NEAR，核两原端点并询问芦羽当前自愿。一次6灵性/意志18耗原灵材1，可开20秒单灵通道；芦羽带原签6米6秒耗3精力，失败或过期则自愿绕行16米16秒耗6精力。本人另走普通6米到FAR交接，关闭通道，再走10米回START。芦羽真实留FAR。' },
  { id: 'quiet-jar', title: 'G · 同一原罐暂静，再真实封存', story: '本人普通10米到FAR，问原主伊兰许可。FR3-JAR本来装一份强度2的有限本地超自然回响。一次6灵性/知识18可使躁动2→0仅20秒；趁窗口合原盖、耗唯一原封条。失败仍2，原夹具普通合盖耗2耐久，同样实耗封条。停效后原回响仍2，只是同一原罐封存；不是净化、复活或现实病原处理。本人10米原路回START。' },
  { id: 'passage-return', title: 'G · 重新取得同意，带唯一原回信回来', story: '先向START的玛拉当面确认本次接回意愿，本人10米到FAR，再问仍在FAR的同一芦羽是否愿回NEAR。伊兰写成唯一FR3-REPLY，旧FR3-TAG留伊兰。第二份原灵材可开反向20秒通道，仍仅6灵性/意志18一次；芦羽6米6秒耗3精力或自愿普通绕行16米16秒耗6精力。本人独立普通6米回NEAR，取同一原回信，再4米到START交玛拉。拒绝可以真实留FAR，不强制召回，不成为永久战宠。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 3;
const freshCase = (): FerrymanCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): FerrymanAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], spiritualitySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, spiritConsent: 'UNASKED', spiritConsentWeek: null,
    siteVisited: false, recipientVisited: false, stopped: false, refused: false, inspected: false, playerReturned: false,
    endpointsChecked: false, effectActive: false, effectRemainingSeconds: 0, effectStopped: false, effectExpired: false, waitedSeconds: 0,
    materialsSpent: 0, spiritCrossed: false, passageBenefit: false, spiritTravelMetres: 0, spiritEnergySpent: 0,
    tagTaken: false, tagHanded: false, tagDelivered: false, paperRecovered: false, paperReturned: false,
    replyWritten: false, replyTaken: false, replyDelivered: false, jarQuieted: false, jarSealed: false, sealBenefit: false, sealSpent: 0, clampWear: 0 };
}
export function createFerrymanLifeState(): FerrymanLifeState {
  return { siteId: 'FR3-TRANSFER-HOUSE', introducedWeek: null, introducedDate: null, channelId: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    mara: { id: 'FR3-MARA', name: '玛拉·柯恩', age: 45, alive: true, willing: true, location: 'START' },
    ilan: { id: 'FR3-ILAN', name: '伊兰·罗', age: 33, alive: true, willing: true, location: 'FAR' },
    reed: { id: 'FR3-REED', name: '芦羽', source: 'CURRENT_TRANSFER_HOUSE', friendly: true, willing: true, location: 'NEAR', energy: 100, travelMetres: 0 },
    tag: { id: 'FR3-TAG', owner: 'FR3-MARA', quantity: 1, location: 'MARA', travelMetres: 0 },
    reply: { id: 'FR3-REPLY', owner: 'FR3-ILAN', quantity: 1, written: false, location: 'UNWRITTEN', travelMetres: 0 },
    jar: { id: 'FR3-JAR', owner: 'FR3-ILAN', location: 'FAR', quantity: 1, nature: 'LOW_INTENSITY_LOCAL_ECHO', agitation: 2, residualEcho: 2, lidClosed: false, sealed: false, boxId: 'FR3-JAR-BOX' },
    materials: { id: 'FR3-PASSAGE-MATERIAL', remaining: 2 }, seal: { id: 'FR3-SEAL', remaining: 1 }, clamp: { id: 'FR3-CLAMP', durability: 100 },
    endpoints: { nearId: 'FR3-NEAR', farId: 'FR3-FAR', nearLocation: 'NEAR', farLocation: 'FAR', nearIntact: true, farIntact: true, distanceMetres: 6, ordinarySpiritRouteMetres: 16 },
    door: { id: 'FR3-DOOR', state: 'OPEN' }, cases: { 'passage-out': freshCase(), 'quiet-jar': freshCase(), 'passage-return': freshCase() }, reflected: false };
}
const currentAttempt = (s: SliceState) => s.ferryman.life.activeCase ? s.ferryman.life.cases[s.ferryman.life.activeCase!].attempts.at(-1) ?? null : null;
function elapse(s: SliceState, a: FerrymanAttempt, seconds: number) {
  a.elapsedSeconds += seconds; s.ferryman.life.clockSeconds += seconds;
  if (a.effectActive) { a.effectRemainingSeconds = Math.max(0, a.effectRemainingSeconds - seconds); if (a.effectRemainingSeconds === 0) { a.effectActive = false; a.effectExpired = true; if (s.ferryman.life.activeCase === 'quiet-jar') s.ferryman.life.jar.agitation = 2; } }
}
const distance = (from: FerrymanLocation, to: FerrymanLocation) => from === to ? 0 : from === 'START' || to === 'START' ? from === 'FAR' || to === 'FAR' ? 10 : 4 : 6;
function walk(s: SliceState, a: FerrymanAttempt, to: FerrymanLocation) {
  const l = s.ferryman.life, from = l.playerLocation, metres = distance(from, to); a.playerMoves.push({ from, to, metres, seconds: metres });
  l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres;
  if (l.tag.location === 'PLAYER') l.tag.travelMetres += metres; if (l.reply.location === 'PLAYER') l.reply.travelMetres += metres;
  elapse(s, a, metres);
}
function setResult(s: SliceState, id: FerrymanCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.ferryman.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
function cleanupBlock(s: SliceState): string | null {
  const l = s.ferryman.life, a = currentAttempt(s);
  if (a?.effectActive) return '先实际停止本次有限作用，时间窗不会传回原灵。';
  if (['PLAYER', 'REED'].includes(l.tag.location) || ['PLAYER', 'REED'].includes(l.reply.location)) return '先在实际同址取还同一原纸，或完成原收件人交接；关闭不会传送物件。';
  if (a?.jarQuieted && !l.jar.sealed) return '先停止暂静并用原夹具、原封条普通封存同一原罐。';
  return l.playerLocation === 'START' ? null : '本人须沿原普通干廊真实回START。';
}
export const hasFerrymanLifeLock = (s: SliceState): boolean => s.ferryman.life.activeCase !== null || Object.values(s.ferryman.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
export const ferrymanInside = hasFerrymanLifeLock;
const COMMON = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'GO_SITE', 'RETURN_PLAYER', 'INSPECT', 'STOP_CONTACT', 'STOP_EFFECT', 'WAIT_WINDOW'];
const PASSAGE = ['CHECK_ENDPOINTS', 'CONSENT_SPIRIT', 'OPEN_PASSAGE', 'CROSS_SPIRIT', 'GO_RECIPIENT', 'RETURN_ITEMS'];
const SPECIFIC: Record<FerrymanCaseId, readonly string[]> = { 'passage-out': [...PASSAGE, 'HAND_TAG', 'DELIVER_TAG'], 'quiet-jar': ['QUIET_JAR', 'SEAL_JAR'], 'passage-return': [...PASSAGE, 'WRITE_REPLY', 'TAKE_REPLY', 'DELIVER_REPLY'] };
export function validateFerrymanActivityCommand(v: unknown): v is FerrymanActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!FERRYMAN_CASE_IDS.includes(v.caseId as FerrymanCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as FerrymanCaseId].includes(String(v.type)));
}
export const isFerrymanActivityCommand = validateFerrymanActivityCommand;
export const isFerrymanActivity = validateFerrymanActivityCommand;
const ownerConsents = (s: SliceState, a: FerrymanAttempt, id: FerrymanCaseId) => !a.stopped && a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && (id === 'quiet-jar' ? s.ferryman.life.ilan.willing : s.ferryman.life.mara.willing);
const spiritConsents = (s: SliceState, a: FerrymanAttempt) => a.spiritConsent === 'GRANTED' && a.spiritConsentWeek === s.week && s.ferryman.life.reed.willing;
export function blockFerrymanLife(s: SliceState, c: FerrymanActivityCommand): string | null {
  if (!validateFerrymanActivityCommand(c)) return '摆渡人生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已真实晋升摆渡人序列3；晋升不复活旧人。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德当前中转室。';
  if (s.ferryman.channels.some(x => x.id === 'POST_CYCLE' && x.agreementClosedDate === null) && s.ferryman.era.location !== 'RECEPTION') return '须本人实际在当前时代接待处，先沿普通12米路到场。';
  if (['READY', 'FIGHTING'].includes(s.ferryman.encounter.status)) return '先结束或和平离开当前新院遭遇。';
  const l = s.ferryman.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return !r?.contactOpen || !a || l.activeCase !== c.caseId ? '没有本次开放现场。' : cleanupBlock(s) ?? (a.inspected ? null : '先检查实际退出和原物去向。');
  if (r?.contactOpen && a && !a.closed && 'caseId' in c && l.activeCase === c.caseId) {
    if (c.type === 'STOP_CONTACT') return a.stopped || a.inspected ? '已经停止本次工作，按原状态收口。' : null;
    if (c.type === 'STOP_EFFECT' || c.type === 'WAIT_WINDOW') return a.effectActive ? null : '没有尚在持续的本次20秒作用。';
    if (c.type === 'RETURN_ITEMS') return c.caseId === 'passage-out' ? l.tag.location === 'REED' && l.playerLocation === l.reed.location ? null : '须本人和持同一原签的芦羽实际同址，才可普通取还。' : l.reply.location === 'REED' && l.playerLocation === l.reed.location ? null : '须本人和持同一原回信的芦羽实际同址，才可普通取还。';
    if (c.type === 'GO_RECIPIENT') return a.siteVisited && !a.recipientVisited && a.spiritCrossed && l.door.state === 'OPEN' && l.playerLocation === (c.caseId === 'passage-out' ? 'NEAR' : 'FAR') ? null : '须同一原灵已实际过路，本人再另沿6米普通干廊到另一端；普通门须OPEN。';
    if (c.type === 'DELIVER_TAG') return l.playerLocation === 'FAR' && l.reed.location === 'FAR' && l.tag.location === 'REED' && a.spiritCrossed && !a.tagDelivered ? null : '须本人、原灵和原签实在FAR，伊兰才接同一原签。';
    if (c.type === 'TAKE_REPLY') return l.playerLocation === 'NEAR' && l.reed.location === 'NEAR' && l.reply.location === 'REED' && a.spiritCrossed && !a.replyTaken ? null : '本人须独立沿6米普通路到NEAR，从已返回的同一原灵手中接原回信。';
    if (c.type === 'DELIVER_REPLY') return l.playerLocation === 'START' && l.reply.location === 'PLAYER' && a.replyTaken && !a.replyDelivered ? null : '本人须真实携同一原回信沿4米回START，才可当面交玛拉。';
    if (c.type === 'SEAL_JAR') {
      if (l.playerLocation !== 'FAR' || !a.siteVisited || a.ownerConsent !== 'GRANTED' || l.jar.sealed || l.seal.remaining !== 1) return '须在FAR处理已获本次许可的同一未封原罐，实耗唯一原封条。';
      return a.effectActive && a.effectRemainingSeconds >= 2 && l.jar.agitation === 0 || l.clamp.durability >= 2 ? null : '窗口已不足2秒且原夹具耐久不足；不能假装已经合盖。';
    }
    if (c.type === 'RETURN_PLAYER') {
      if (l.playerLocation === 'START') return '本人已在START。';
      if (l.door.state !== 'OPEN') return '普通门已阻塞，不能声称走过被阻塞的原路。';
      if (a.effectActive) return '先停止本次通道或暂静。';
      if (l.tag.location === 'REED' || l.reply.location === 'REED') return '先普通完成原纸交接或同址取还，不把遗留纸写成归还。';
      if (a.jarQuieted && !l.jar.sealed) return '先用原封条封存同一原罐，原回响仍在。';
      return null;
    }
    if (c.type === 'INSPECT') return a.inspected ? '已检查，请关闭现场。' : cleanupBlock(s);
    if (a.inspected) return '已检查，请关闭本次现场。';
    if (c.type === 'CONSENT_OWNER') return a.ownerConsent === 'UNASKED' && !a.stopped && l.playerLocation === (c.caseId === 'quiet-jar' ? 'FAR' : 'START') ? null : '须到本案原主当前所在处，取得本次当面许可。';
    if (c.type === 'GO_SITE' && c.caseId === 'quiet-jar') return !a.siteVisited && !a.stopped && l.playerLocation === 'START' && l.door.state === 'OPEN' ? null : '须从START沿10米普通干廊到FAR再询问伊兰。';
    if (!ownerConsents(s, a, c.caseId)) return '本次原主许可缺失、过期或撤回；仍可停效、普通取还与沿原路退出。';
    if (c.type === 'GO_SITE') return a.siteVisited || l.playerLocation !== 'START' || l.door.state !== 'OPEN' ? '须本次首次沿真实OPEN干廊到原现场。' : c.caseId === 'passage-out' && l.tag.location !== 'MARA' ? '唯一原签须仍在玛拉手中，不能复制。' : c.caseId === 'passage-return' && l.reed.location !== 'FAR' ? '同一芦羽当前不在FAR，不伪造出程或重新生成它；可停止后如实收束。' : null;
    if (c.type === 'CHECK_ENDPOINTS') return a.siteVisited && !a.endpointsChecked && l.playerLocation === l.reed.location && l.endpoints.nearIntact && l.endpoints.farIntact && l.door.state === 'OPEN' ? null : '本人须在同一原灵所在端亲验相距6米、可见的两固定完好标记及普通退路。';
    if (c.type === 'CONSENT_SPIRIT') return a.siteVisited && a.spiritConsent === 'UNASKED' && l.playerLocation === l.reed.location ? null : '须当面重新问当前同一芦羽，旧案同意不延续。';
    if (c.type === 'HAND_TAG') return c.caseId === 'passage-out' && spiritConsents(s, a) && l.playerLocation === 'NEAR' && l.reed.location === 'NEAR' && l.tag.location === 'PLAYER' && !a.tagHanded ? null : '须NEAR原灵当前自愿，才把本人实际带来的同一原签交它。';
    if (c.type === 'WRITE_REPLY') return spiritConsents(s, a) && l.playerLocation === 'FAR' && l.reed.location === 'FAR' && l.ilan.willing && !l.reply.written ? null : '须FAR的同一原灵重新自愿、伊兰当前愿意，才写唯一新回信；旧信签不改写。';
    if (c.type === 'CROSS_SPIRIT' || c.type === 'OPEN_PASSAGE') {
      if (!a.endpointsChecked || !spiritConsents(s, a) || a.spiritCrossed || l.playerLocation !== l.reed.location || l.door.state !== 'OPEN') return '须本次当前自愿、原灵与本人仍在出发端并已核端点；只过一次，不强制或传送本人。';
      if (l.reed.location !== (c.caseId === 'passage-out' ? 'NEAR' : 'FAR') || (c.caseId === 'passage-out' ? l.tag.location !== 'REED' : l.reply.location !== 'REED')) return '须同一原灵仍在本次出发端并持同一原纸。';
      if (l.reed.energy < 12) return '须保留至少12精力供普通往返，不回满原灵精力。';
      if (c.type === 'CROSS_SPIRIT') return a.effectActive && (!l.endpoints.nearIntact || !l.endpoints.farIntact || a.effectRemainingSeconds < 6) ? '当前通道端点失效或不足6秒，请先关闭，再选普通16米迂回。' : null;
      if (!l.endpoints.nearIntact || !l.endpoints.farIntact || l.materials.remaining < 1) return '须两固定原端点完好及至少1份未耗原灵材；不生成新端点。';
    }
    if (c.type === 'QUIET_JAR' || c.type === 'OPEN_PASSAGE') {
      if (a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null)) return '本案只检验一次6灵性能力，失败成本保留，之后普通续办。';
      if (s.health <= 0 || s.mind <= 0 || s.spirituality < 6) return '本次施术需要身心尚可及6灵性；普通退出不需要灵性。';
      if (c.type === 'QUIET_JAR' && (!a.siteVisited || l.playerLocation !== 'FAR' || l.jar.sealed || l.jar.agitation !== 2)) return '须当前FAR同一未封原罐的强度2回响，不净化或生成新回响。';
      return null;
    }
    return '按当前原人原物继续，或停止后普通收束。';
  }
  if (hasFerrymanLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消当前准备，或真实退出已开放现场。';
  if (hasUndyingLifeLock(s) || hasUndyingRitualLock(s) || hasUndyingOldPractice(s) || ['READY', 'FIGHTING'].includes(s.undying.encounter.status) || s.ferryman.channels.some(x => x.preparedWeek !== null)) return '先真实关闭旧原现场与当前服药准备，不覆盖旧人、旧簿或原灰羽历史。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '这一步需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : FERRYMAN_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知当前实践。';
  if (r.status === 'RESOLVED') return '本案已报告，不重置资源或重复成长。';
  const index = FERRYMAN_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[FERRYMAN_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告上一案实际结果。';
  if (c.type === 'OBSERVE') return r.status !== 'AVAILABLE' ? '本案已经观察。' : !s.ferryman.channels.some(x => x.agreementClosedDate === null) ? '须有当前时代真实介绍的开放渠道。' : null;
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案。' : r.attempts.at(-1)?.week === s.week ? '原成本保留，下一真实周才可再次准备。' : c.method === 'ABILITY' && r.attempts.some(x => x.abilityTier !== null) ? '本案已实际检过能力，只能普通续办。' : s.actionsRemaining < 2 ? '准备须至少余2行动，留1行动实施。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先真实收口、普通退出、检查并关闭本案。';
  return '没有本次开放现场。';
}
export const blockFerrymanActivity = blockFerrymanLife;

export function applyFerrymanActivity(s: SliceState, c: FerrymanActivityCommand, ctx: SeerContext): void {
  const reason = blockFerrymanLife(s, c); if (reason) throw new Error(reason);
  const l = s.ferryman.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('ferryman-reflection'); ctx.note('G · 有限摆渡与当前同意的反思', '三个真实报告后扮演+25。两原纸各留实际去向，原灵精力和材料不恢复；暂静不是净化，回NEAR不是永久召唤。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施准备', '0行动，已付准备行动不退，没有移动原灵或原物。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { const channel = s.ferryman.channels.find(x => x.agreementClosedDate === null)!; l.introducedWeek = s.week; l.introducedDate = { ...s.date }; l.channelId = channel.id; } ctx.note(definition.title, `${definition.story} 本次现场登记属于实际${l.channelId}渠道、第${l.introducedWeek}周，绝非六十年前的一批人仍在等候。`); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '本案一次G能力' : '普通真实工作'}，尚未替原主或原灵同意。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动从START实施。现场子步0行动，实际秒、米、资源和原物归属分别保留。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'quiet-jar' ? 'death.s3.departure-ward' : 'death.s3.bounded-ferry'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `真实报告扮演+25。${r.result === 'ABILITY' ? '本项有限技巧确实作用并完成原物交接，对应掌握+8。' : '普通完成或尊重拒绝，不赠能力掌握。'}失败、原成本、原灵当前位置与原回响保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = a.spiritConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('关闭当前中转室现场', '0行动，本人实际START、作用已停、原纸有真实去向。芦羽留其实际位置，不自动传回，不补精力，不复活旧人。'); return; }
  switch (c.type) {
    case 'CONSENT_OWNER': a.ownerConsent = (c.caseId === 'quiet-jar' ? l.ilan.willing : l.mara.willing) ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; a.refused ||= a.ownerConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('原主当面回答本次许可', `2秒，${c.caseId === 'quiet-jar' ? 'FAR的伊兰' : 'START的玛拉'}本次${a.ownerConsent === 'GRANTED' ? '同意具体工作；不替芦羽同意。' : '拒绝；可如实停止退出，不强迫工作。'}`); return;
    case 'GO_SITE': a.siteVisited = true; if (c.caseId === 'passage-out') { l.tag.location = 'PLAYER'; a.tagTaken = true; elapse(s, a, 1); } walk(s, a, c.caseId === 'passage-out' ? 'NEAR' : 'FAR'); ctx.note('本人实际沿普通干廊到现场', c.caseId === 'passage-out' ? '当面取唯一原信签1秒，再携同一原签4米4秒到NEAR；芦羽尚未同意或移动。' : '本人独立10米10秒到FAR。芦羽、原罐与原纸没有被玩家步行自动搬动。'); return;
    case 'STOP_CONTACT': a.stopped = true; a.refused = true; elapse(s, a, 1); ctx.note('停止本次工作', '1秒，原灵可留真实位置。仍可停效、普通原纸交接、原罐封存与本人原路退出；不退已付成本。'); return;
    case 'CHECK_ENDPOINTS': a.endpointsChecked = true; elapse(s, a, 2); ctx.note('亲验可见的两原固定端点', '2秒，NEAR与FAR相距6米，原固定标记完好；玩家普通干廊6米、灵体普通迂回16米均保留。没有任意目的地或异界坐标。'); return;
    case 'CONSENT_SPIRIT': a.spiritConsent = l.reed.willing ? 'GRANTED' : 'DECLINED'; a.spiritConsentWeek = s.week; a.refused ||= a.spiritConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('同一芦羽当面回答当前意愿', a.spiritConsent === 'GRANTED' ? '2秒，仅同意本次携同一原纸到另一个已核端点，可停止；上次同意不延续，不补精力。' : '2秒，它拒绝，留真实位置；不强制过路，不新造一个替身。'); return;
    case 'HAND_TAG': l.tag.location = 'REED'; a.tagHanded = true; elapse(s, a, 1); ctx.note('芦羽在NEAR接同一原信签', '1秒，FR3-TAG由PLAYER到同一REED，数量仍1；尚未过路。'); return;
    case 'WRITE_REPLY': l.reply.written = true; l.reply.location = 'REED'; a.replyWritten = true; elapse(s, a, 3); ctx.note('伊兰写成唯一新的原回信', '3秒，唯一FR3-REPLY由FAR的伊兰写成，交本次自愿的同一芦羽。FR3-TAG仍保持既有去向，未变成回信。'); return;
    case 'OPEN_PASSAGE': case 'QUIET_JAR': s.spirituality -= 6; a.spiritualitySpent = 6; a.abilityTier = ctx.check(c.type === 'QUIET_JAR' ? 'knowledge' : 'will', 18).tier; if (c.type === 'OPEN_PASSAGE') { l.materials.remaining--; a.materialsSpent = 1; } elapse(s, a, 2); if (success(a.abilityTier)) { a.effectActive = true; a.effectRemainingSeconds = 20; if (c.type === 'QUIET_JAR') { l.jar.agitation = 0; a.jarQuieted = true; } } ctx.note(success(a.abilityTier) ? '一次G有限作用成功' : '一次G有限作用失败', `实耗6灵性、2秒${c.type === 'OPEN_PASSAGE' ? '及原灵材1份' : ''}，${c.type === 'QUIET_JAR' ? '知识' : '意志'}18，本案不重骰。${success(a.abilityTier) ? c.type === 'QUIET_JAR' ? '同一原罐躁动暂时2→0仅20秒，原回响仍在，须趁窗口真正合盖封存。' : '只开两原端点之间20秒单灵通道，尚未移动原灵，更未移动本人。' : c.type === 'QUIET_JAR' ? '原躁动仍2，可用原夹具普通合盖封存。' : '没有通道，同一芦羽仍可当前自愿沿16米普通迂回携原纸。'}`); return;
    case 'CROSS_SPIRIT': { const benefit = a.effectActive, metres = benefit ? 6 : 16, energy = benefit ? 3 : 6; a.spiritCrossed = true; a.passageBenefit = benefit; a.spiritTravelMetres = metres; a.spiritEnergySpent = energy; l.reed.location = c.caseId === 'passage-out' ? 'FAR' : 'NEAR'; l.reed.travelMetres += metres; l.reed.energy -= energy; (c.caseId === 'passage-out' ? l.tag : l.reply).travelMetres += metres; elapse(s, a, metres); ctx.note('同一自愿芦羽携同一原纸实际过路', `实际${metres}米${metres}秒、耗${energy}精力，原灵当前${l.reed.location}、精力${l.reed.energy}。${benefit ? '20秒内有限通道实际发挥作用。' : '只走普通16米迂回，没有能力成功掌握。'}本人仍在原出发端，须独立走普通路。`); return; }
    case 'GO_RECIPIENT': a.recipientVisited = true; walk(s, a, c.caseId === 'passage-out' ? 'FAR' : 'NEAR'); ctx.note('本人独立沿普通6米干廊到另一端', '真实6米6秒，玩家未进入单灵通道；原灵精力与原纸没有复制。'); return;
    case 'DELIVER_TAG': l.tag.location = 'ILAN'; a.tagDelivered = true; elapse(s, a, 1); setResult(s, c.caseId, a.passageBenefit ? 'ABILITY' : 'ORDINARY'); ctx.note('伊兰在FAR接同一原信签', '1秒，唯一FR3-TAG留ILAN；芦羽仍在FAR，本人仍须停止通道并普通10米回START。'); return;
    case 'TAKE_REPLY': l.reply.location = 'PLAYER'; a.replyTaken = true; elapse(s, a, 1); ctx.note('本人在NEAR接同一原回信', '1秒，FR3-REPLY由原芦羽交PLAYER；还需独立4米回START交玛拉。芦羽留当地NEAR栖处。'); return;
    case 'DELIVER_REPLY': l.reply.location = 'MARA'; a.replyDelivered = true; elapse(s, a, 1); setResult(s, c.caseId, a.passageBenefit ? 'ABILITY' : 'ORDINARY'); ctx.note('玛拉在START接同一原回信', '1秒，唯一FR3-REPLY归MARA，旧FR3-TAG去向不改。芦羽只回当地栖处，不成为永久战宠。'); return;
    case 'RETURN_ITEMS': a.paperRecovered = true; elapse(s, a, 1); if (c.caseId === 'passage-out') l.tag.location = 'PLAYER'; else if (l.playerLocation === 'FAR') { l.reply.location = 'ILAN'; a.paperReturned = true; } else { l.reply.location = 'PLAYER'; a.replyTaken = true; } ctx.note('在实际同址普通取还原纸', c.caseId === 'passage-out' ? '1秒，同一原签收回PLAYER，须本人带回START交玛拉；不把中止伪称送达。' : l.playerLocation === 'FAR' ? '1秒，同一原回信当面退给FAR原作者伊兰，原灵不被强制返程。' : '1秒，从NEAR同一原灵取原回信，须本人带回START真实交接。'); return;
    case 'SEAL_JAR': { const benefit = a.effectActive && a.effectRemainingSeconds >= 2 && l.jar.agitation === 0; a.jarSealed = true; a.sealBenefit = benefit; a.sealSpent = 1; l.seal.remaining--; if (!benefit) { l.clamp.durability -= 2; a.clampWear = 2; } l.jar.lidClosed = true; l.jar.sealed = true; elapse(s, a, 2); setResult(s, c.caseId, benefit ? 'ABILITY' : 'ORDINARY'); ctx.note('合上同一原盖并实耗原封条', `2秒，原封条1→0，FR3-JAR留原FAR/原盒。${benefit ? '当前暂静窗口实际协助合盖，夹具未磨损；仍须停效恢复原躁动2。' : '原夹具普通合盖耐久−2，原回响仍2，未净化或消灭。'}`); return; }
    case 'STOP_EFFECT': a.effectActive = false; a.effectRemainingSeconds = 0; a.effectStopped = true; if (c.caseId === 'quiet-jar') l.jar.agitation = 2; elapse(s, a, 1); ctx.note('主动关闭本次有限作用', '1秒，原灵和原纸不传回；同一原回响恢复躁动2，原盖和封条真实封存结果保留。'); return;
    case 'WAIT_WINDOW': { const seconds = a.effectRemainingSeconds; a.waitedSeconds += seconds; elapse(s, a, seconds); ctx.note('等到本次20秒窗口真实耗尽', `实际等待${seconds}秒，有限作用已消失；原灵留实际端点，原回响仍2。未过路可普通迂回，未合盖可普通夹具封存。`); return; }
    case 'RETURN_PLAYER': walk(s, a, 'START'); a.playerReturned = true; if (l.tag.location === 'PLAYER') { l.tag.location = 'MARA'; a.paperReturned = true; elapse(s, a, 1); } ctx.note('本人沿原普通干廊实际返回START', `真实普通步行${a.playerMoves.at(-1)!.metres}米，0灵性0行动；${a.paperReturned ? '携回的同一原签再1秒交还玛拉。' : '原灵与原罐留实际位置。'}原纸不由退出自动复制。`); return;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (r.result === 'NONE' && (a.stopped || a.refused || a.ownerConsentWeek !== null && !ownerConsents(s, a, c.caseId) || a.spiritConsentWeek !== null && !spiritConsents(s, a))) { a.refused = true; setResult(s, c.caseId, 'ORDINARY'); } ctx.note('核实真实退出与原物去向', `2秒，本人START；芦羽${l.reed.location}/精力${l.reed.energy}；原签${l.tag.location}、原回信${l.reply.location}，原罐躁动${l.jar.agitation}/残留2。普通拒绝或中止不冒充能力成功。`); return;
  }
}

export function ferrymanLifeActions(s: SliceState): FerrymanLifeAction[] {
  if (s.progression.pathwayId === 'death' && s.progression.sequence === 2) return [];
  const l = s.ferryman.life, out: FerrymanLifeAction[] = [];
  const add = (label: string, cost: string, command: FerrymanActivityCommand) => { const reason = blockFerrymanLife(s, command); out.push({ id: `FR3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const caseId of FERRYMAN_CASE_IDS) {
    const r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add('观察当前原人、原物与普通退路', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备本案一次G能力' : '准备普通真实工作', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('从START实施本案', '1行动', { type: 'PERFORM', caseId }); add('取消尚未实施准备', '0行动', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告原人原物的实际结果', '1行动 · 扮演25', { type: 'REPORT', caseId });
    else if (r.status === 'ACTIVE' && a) {
      if (a.ownerConsent === 'UNASKED') add(caseId === 'quiet-jar' ? '在FAR当面问伊兰本次许可' : '在START当面问玛拉本次意愿', '0行动 · 2秒', { type: 'CONSENT_OWNER', caseId });
      if (!a.siteVisited) add(caseId === 'passage-out' ? '携同一原签走4米到NEAR' : '本人普通走10米到FAR', caseId === 'passage-out' ? '0行动 · 4米5秒' : '0行动 · 10米10秒', { type: 'GO_SITE', caseId });
      if (caseId !== 'quiet-jar') {
        if (!a.endpointsChecked) add('核两原端点与普通退路', '0行动 · 2秒', { type: 'CHECK_ENDPOINTS', caseId });
        if (a.spiritConsent === 'UNASKED') add('当面问同一芦羽本次意愿', '0行动 · 2秒', { type: 'CONSENT_SPIRIT', caseId });
        if (caseId === 'passage-out' && !a.tagHanded) add('向自愿芦羽交同一原信签', '0行动 · 1秒', { type: 'HAND_TAG', caseId });
        if (caseId === 'passage-return' && !a.replyWritten) add('伊兰写唯一新回信交原灵', '0行动 · 3秒', { type: 'WRITE_REPLY', caseId });
        if (a.method === 'ABILITY' && a.abilityTier === null) add('开本案20秒有限单灵通道', '0行动 · 6灵性 · 原灵材1 · 2秒', { type: 'OPEN_PASSAGE', caseId });
        if (!a.spiritCrossed) add(a.effectActive ? '原灵自愿携原纸走有限通道' : '原灵自愿携原纸走普通迂回', a.effectActive ? '0行动 · 6米6秒 · 3精力' : '0行动 · 16米16秒 · 6精力', { type: 'CROSS_SPIRIT', caseId });
        if (!a.recipientVisited) add('本人独立沿6米普通干廊到另一端', '0行动 · 6米6秒', { type: 'GO_RECIPIENT', caseId });
        if (caseId === 'passage-out' && !a.tagDelivered) add('伊兰当面接同一原信签', '0行动 · 1秒', { type: 'DELIVER_TAG', caseId });
        if (caseId === 'passage-return') { if (!a.replyTaken) add('在NEAR取同一原回信', '0行动 · 1秒', { type: 'TAKE_REPLY', caseId }); if (!a.replyDelivered) add('在START交玛拉同一原回信', '0行动 · 1秒', { type: 'DELIVER_REPLY', caseId }); }
        if ((caseId === 'passage-out' ? l.tag : l.reply).location === 'REED') add('同址普通取还原纸', '0行动 · 1秒', { type: 'RETURN_ITEMS', caseId });
      } else {
        if (a.method === 'ABILITY' && a.abilityTier === null) add('短暂护送安定同一原罐', '0行动 · 6灵性 · 2秒 · 持续20秒', { type: 'QUIET_JAR', caseId });
        if (!a.jarSealed) add(a.effectActive && a.effectRemainingSeconds >= 2 ? '趁当前暂静窗口合原盖封存' : '用原夹具普通合盖封存', '0行动 · 2秒 · 原封条1；普通法耐久2', { type: 'SEAL_JAR', caseId });
      }
      if (a.effectActive) { add('主动关闭本次有限作用', '0行动 · 1秒', { type: 'STOP_EFFECT', caseId }); add('等本次窗口真实耗尽', `0行动 · ${a.effectRemainingSeconds}秒`, { type: 'WAIT_WINDOW', caseId }); }
      if (!a.stopped && !a.inspected) add('停止本次工作，按真实状态收口', '0行动 · 1秒', { type: 'STOP_CONTACT', caseId });
      if (l.playerLocation !== 'START') add('本人沿原普通干廊回START', `0行动 · ${distance(l.playerLocation, 'START')}米`, { type: 'RETURN_PLAYER', caseId });
      if (!a.inspected) add('检查真实退出、原灵与原物去向', '0行动 · 2秒', { type: 'INSPECT', caseId });
      add('关闭本次已检查现场', '0行动', { type: 'CLOSE', caseId });
    }
  }
  add('反思三份有限摆渡的真实报告', '1行动 · 扮演25', { type: 'REFLECT' }); return out;
}
function observations(id: FerrymanCaseId, a: FerrymanAttempt | undefined): string[] {
  if (!a) return [];
  const out = [`本次实际${a.elapsedSeconds}秒；本人普通步行${a.playerTravelMetres}米；灵性${a.spiritualitySpent}、原灵材${a.materialsSpent}。`, `原主本次许可${a.ownerConsent}；原灵本次许可${a.spiritConsent}，不同人、不同案的同意互不替代。`];
  if (a.abilityTier !== null) out.push(`本案唯一能力检验${a.abilityTier}，已实耗6灵性，不能重骰。`);
  if (a.effectActive) out.push(`本次20秒窗口尚余${a.effectRemainingSeconds}秒；实际步行与等待都会消耗窗口。`);
  if (a.effectExpired) out.push('本次窗口已真实耗尽，未移动的原灵留原端，原回响恢复2；仍有普通退路。');
  if (a.spiritCrossed) out.push(`同一芦羽实际${a.spiritTravelMetres}米、耗${a.spiritEnergySpent}精力；${a.passageBenefit ? '有限通道实际发挥作用。' : '普通16米迂回，不冒充能力成功。'}`);
  if (a.tagDelivered) out.push('唯一原信签FR3-TAG确已在FAR交伊兰，原灵没有自动回NEAR。');
  if (a.replyWritten) out.push('伊兰在真实FAR写成唯一新FR3-REPLY；原信签未被改写或复用。');
  if (a.replyDelivered) out.push('本人实际4米带同一FR3-REPLY到START交玛拉，原灵留当地NEAR栖处。');
  if (id === 'quiet-jar' && a.jarQuieted) out.push('原回响曾在20秒窗口暂静2→0，残留仍2；停效恢复原躁动，绝非净化或消灭。');
  if (a.jarSealed) out.push(`同一原罐、原盖、原盒真实封存，封条实耗${a.sealSpent}、夹具耐久实耗${a.clampWear}；${a.sealBenefit ? '合盖发生在当前暂静窗口内。' : '普通封存不赠能力掌握。'}`);
  if (a.refused) out.push('本次有拒绝、撤回或停止，保留原灵真实位置，不强制继续。');
  if (a.paperReturned) out.push('同一原纸已沿真实普通路线归还，未假称任务送达。');
  return out;
}
export function projectFerrymanLife(s: SliceState): FerrymanLifeProjection {
  const l = s.ferryman.life;
  return { title: '摆渡人·死神序列3（有限引导G）', story: FERRYMAN_LIFE_STORY,
    environment: '当前FR3-TRANSFER-HOUSE：START至NEAR4米、NEAR至FAR普通干廊6米、START至FAR10米；同一灵体普通迂回NEAR↔FAR16米。两原端点固定，普通门独立存在。仅原灵可用20秒有限通道，玩家只普通步行。人物与物件在本次渠道时期首次接触，非旧人跨六十年等待。',
    activeCase: l.activeCase, inside: hasFerrymanLifeLock(s), insideCase: hasFerrymanLifeLock(s), reflected: l.reflected,
    introducedWeek: l.introducedWeek, introducedDate: l.introducedDate ? { ...l.introducedDate } : null, channelId: l.channelId,
    clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, currentAttempt: structuredClone(currentAttempt(s)),
    mara: { ...l.mara }, ilan: { ...l.ilan }, reed: { ...l.reed }, tag: { ...l.tag }, reply: { ...l.reply }, jar: { ...l.jar }, materials: { ...l.materials }, seal: { ...l.seal }, clamp: { ...l.clamp }, endpoints: { ...l.endpoints }, door: { ...l.door },
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: observations(x.id, r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '尚未完成实际工作，原状态与已付成本保留。' : r.result === 'ABILITY' ? '有限能力实际作用并完成原物交接，真实退出后可报告。' : '普通完成或尊重当前拒绝，不赠能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: ferrymanLifeActions(s) };
}

/** Finite source identities, ordinary travel, real costs and closed effects survive save/reload. */
export function validateFerrymanLife(s: SliceState): boolean {
  const l = s.ferryman?.life, initial = createFerrymanLifeState(), promotion = s.ferryman?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, FERRYMAN_CASE_IDS)) return false;
  for (const key of ['mara', 'ilan', 'reed', 'tag', 'reply', 'jar', 'materials', 'seal', 'clamp', 'endpoints', 'door'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.siteId !== initial.siteId || !['START', 'NEAR', 'FAR'].includes(l.playerLocation) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.activeCase !== null && !FERRYMAN_CASE_IDS.includes(l.activeCase)) return false;
  const combatSeconds = s.combatHistory.reduce((sum, round) => sum + (round.ferrymanOutcome?.elapsedSeconds ?? 0), 0);
  if (l.introducedWeek === null) return l.introducedDate === null && l.channelId === null && stableStringify(l) === stableStringify({ ...initial, clockSeconds: combatSeconds });
  const channel = s.ferryman.channels.find(x => x.id === l.channelId);
  if (!channel || !integer(l.introducedWeek, Math.max(promotion, channel.introducedWeek), s.week) || !record(l.introducedDate) || !integer(l.introducedDate.year, 1) || !integer(l.introducedDate.month, 1, 12) || !integer(l.introducedDate.day, 1, 31)) return false;
  for (const key of ['mara', 'ilan'] as const) { const p = l[key], base = initial[key]; if (p.id !== base.id || p.name !== base.name || p.age !== base.age || p.alive !== true || p.location !== base.location || typeof p.willing !== 'boolean') return false; }
  if (l.reed.id !== 'FR3-REED' || l.reed.name !== '芦羽' || l.reed.source !== 'CURRENT_TRANSFER_HOUSE' || l.reed.friendly !== true || typeof l.reed.willing !== 'boolean' || !['NEAR', 'FAR'].includes(l.reed.location) || !integer(l.reed.energy, 0, 100) || !integer(l.reed.travelMetres)) return false;
  if (l.tag.id !== 'FR3-TAG' || l.tag.owner !== 'FR3-MARA' || l.tag.quantity !== 1 || !['MARA', 'PLAYER', 'REED', 'ILAN'].includes(l.tag.location) || !integer(l.tag.travelMetres)) return false;
  if (l.reply.id !== 'FR3-REPLY' || l.reply.owner !== 'FR3-ILAN' || l.reply.quantity !== 1 || typeof l.reply.written !== 'boolean' || !['UNWRITTEN', 'ILAN', 'REED', 'PLAYER', 'MARA'].includes(l.reply.location) || !integer(l.reply.travelMetres)) return false;
  if (l.jar.id !== 'FR3-JAR' || l.jar.owner !== 'FR3-ILAN' || l.jar.location !== 'FAR' || l.jar.quantity !== 1 || l.jar.nature !== 'LOW_INTENSITY_LOCAL_ECHO' || l.jar.residualEcho !== 2 || ![0, 2].includes(l.jar.agitation) || typeof l.jar.lidClosed !== 'boolean' || typeof l.jar.sealed !== 'boolean' || l.jar.lidClosed !== l.jar.sealed || l.jar.boxId !== 'FR3-JAR-BOX') return false;
  if (l.materials.id !== 'FR3-PASSAGE-MATERIAL' || !integer(l.materials.remaining, 0, 2) || l.seal.id !== 'FR3-SEAL' || !integer(l.seal.remaining, 0, 1) || l.clamp.id !== 'FR3-CLAMP' || !integer(l.clamp.durability, 0, 100)) return false;
  if (l.endpoints.nearId !== 'FR3-NEAR' || l.endpoints.farId !== 'FR3-FAR' || l.endpoints.nearLocation !== 'NEAR' || l.endpoints.farLocation !== 'FAR' || l.endpoints.distanceMetres !== 6 || l.endpoints.ordinarySpiritRouteMetres !== 16 || typeof l.endpoints.nearIntact !== 'boolean' || typeof l.endpoints.farIntact !== 'boolean' || l.door.id !== 'FR3-DOOR' || !['OPEN', 'BLOCKED'].includes(l.door.state)) return false;
  let open = 0, prepared = 0, resolved = 0, seconds = 0, metres = 0, energy = 0, spiritMetres = 0, materials = 0, seals = 0, wear = 0, tagMetres = 0, replyMetres = 0;
  let reedLocation: 'NEAR' | 'FAR' = 'NEAR', playerLocation: FerrymanLocation = 'START', tagLocation: FerrymanLifeState['tag']['location'] = 'MARA', replyLocation: FerrymanLifeState['reply']['location'] = 'UNWRITTEN', written = false;
  for (const [index, id] of FERRYMAN_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[FERRYMAN_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let previousWeek = r.observedWeek - 1, checks = 0;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, previousWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !Array.isArray(a.playerMoves)) return false;
      const base = freshAttempt(1, 'ORDINARY');
      for (const key of Object.keys(base) as (keyof FerrymanAttempt)[]) { if (typeof base[key] === 'boolean' && typeof a[key] !== 'boolean' || typeof base[key] === 'number' && !integer(a[key])) return false; }
      for (const [consent, week] of [[a.ownerConsent, a.ownerConsentWeek], [a.spiritConsent, a.spiritConsentWeek]] as const) if (!['UNASKED', 'GRANTED', 'DECLINED', 'CLOSED'].includes(consent) || week !== null && week !== a.week || consent === 'UNASKED' && week !== null || ['GRANTED', 'DECLINED'].includes(consent) && week === null || (consent === 'CLOSED') !== a.closed) return false;
      if (a.abilityTier !== null && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.abilityTier)) return false;
      if (a.abilityTier !== null) { checks++; if (a.method !== 'ABILITY' || a.spiritualitySpent !== 6 || !a.siteVisited || a.ownerConsentWeek === null) return false; } else if (a.spiritualitySpent !== 0) return false;
      if (a.effectActive !== (a.effectRemainingSeconds > 0) || !integer(a.effectRemainingSeconds, 0, 20) || a.effectActive && !success(a.abilityTier) || a.effectStopped && a.effectExpired || (a.effectStopped || a.effectExpired) && (!success(a.abilityTier) || a.effectActive) || success(a.abilityTier) && !a.effectActive && !a.effectStopped && !a.effectExpired) return false;
      if (a.stopped && !a.refused || a.inspected && a.effectActive || a.recipientVisited && !a.spiritCrossed || a.playerReturned && !a.siteVisited) return false;
      let travelled = 0;
      for (const move of a.playerMoves) { if (!record(move) || !shape(move, ['from', 'to', 'metres', 'seconds']) || !['START', 'NEAR', 'FAR'].includes(move.from) || !['START', 'NEAR', 'FAR'].includes(move.to) || move.from !== playerLocation || move.from === move.to || move.metres !== distance(move.from, move.to) || move.seconds !== move.metres) return false; playerLocation = move.to; travelled += move.metres; }
      if (a.playerTravelMetres !== travelled || a.elapsedSeconds < travelled + a.spiritTravelMetres || a.playerMoves.length !== (a.siteVisited ? 1 : 0) + (a.recipientVisited ? 1 : 0) + (a.playerReturned ? 1 : 0)) return false;
      if (id === 'quiet-jar') {
        if (a.materialsSpent !== 0 || a.spiritConsentWeek !== null || a.endpointsChecked || a.spiritCrossed || a.passageBenefit || a.spiritTravelMetres || a.spiritEnergySpent || a.tagTaken || a.tagHanded || a.tagDelivered || a.replyWritten || a.replyTaken || a.replyDelivered || a.paperRecovered || a.paperReturned || a.recipientVisited) return false;
        if (a.jarQuieted !== success(a.abilityTier) || a.jarSealed && (!a.siteVisited || a.ownerConsentWeek === null) || a.sealBenefit && (!a.jarSealed || !a.jarQuieted) || a.sealSpent !== (a.jarSealed ? 1 : 0) || a.clampWear !== (a.jarSealed && !a.sealBenefit ? 2 : 0)) return false;
      } else {
        if (a.jarQuieted || a.jarSealed || a.sealBenefit || a.sealSpent || a.clampWear || a.materialsSpent !== (a.abilityTier !== null ? 1 : 0)) return false;
        if ((a.abilityTier !== null || a.spiritCrossed) && (!a.endpointsChecked || a.spiritConsentWeek === null) || a.passageBenefit && (!a.spiritCrossed || !success(a.abilityTier))) return false;
        if (a.spiritTravelMetres !== (a.spiritCrossed ? a.passageBenefit ? 6 : 16 : 0) || a.spiritEnergySpent !== (a.spiritCrossed ? a.passageBenefit ? 3 : 6 : 0)) return false;
        if (a.spiritCrossed) { if (reedLocation !== (id === 'passage-out' ? 'NEAR' : 'FAR')) return false; reedLocation = id === 'passage-out' ? 'FAR' : 'NEAR'; }
        if (id === 'passage-out') {
          if (a.replyWritten || a.replyTaken || a.replyDelivered || a.tagTaken !== a.siteVisited || a.tagHanded && (!a.tagTaken || a.spiritConsentWeek === null) || a.spiritCrossed && !a.tagHanded || a.tagDelivered && (!a.spiritCrossed || !a.recipientVisited) || a.paperRecovered && !a.tagHanded || a.paperReturned && (!a.tagTaken || !a.playerReturned)) return false;
          if (a.tagTaken) { if (tagLocation !== 'MARA') return false; tagLocation = a.paperReturned ? 'MARA' : a.tagDelivered ? 'ILAN' : a.paperRecovered ? 'PLAYER' : a.tagHanded ? 'REED' : 'PLAYER'; tagMetres += 4 + a.spiritTravelMetres + (a.paperRecovered && a.playerReturned || !a.tagHanded && a.playerReturned ? a.playerMoves.at(-1)!.metres : 0); }
        } else {
          if (a.tagTaken || a.tagHanded || a.tagDelivered || a.replyWritten && (written || a.spiritConsentWeek === null || !a.siteVisited) || a.spiritCrossed && !a.replyWritten || a.replyTaken && (!a.spiritCrossed || !a.recipientVisited) || a.replyDelivered && (!a.replyTaken || !a.playerReturned) || a.paperRecovered && !a.replyWritten || a.paperReturned && !a.paperRecovered) return false;
          if (a.replyWritten) { written = true; replyLocation = a.replyDelivered ? 'MARA' : a.paperReturned ? 'ILAN' : a.replyTaken ? 'PLAYER' : 'REED'; replyMetres += a.spiritTravelMetres + (a.replyTaken && a.playerReturned ? 4 : 0); }
        }
      }
      const completed = id === 'passage-out' ? a.tagDelivered : id === 'quiet-jar' ? a.jarSealed : a.replyDelivered, benefit = id === 'quiet-jar' ? a.sealBenefit : a.passageBenefit;
      if (a.result === 'ABILITY' && (!completed || !benefit) || a.result === 'ORDINARY' && (completed ? benefit : !a.refused) || a.result === 'NONE' && completed) return false;
      if (a.closed && (!a.inspected || a.effectActive || playerLocation !== 'START' || a.siteVisited && !a.playerReturned || a.jarQuieted && !a.jarSealed || ['PLAYER', 'REED'].includes(tagLocation) || ['PLAYER', 'REED'].includes(replyLocation)) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      previousWeek = a.week; seconds += a.elapsedSeconds; metres += a.playerTravelMetres; spiritMetres += a.spiritTravelMetres; energy += a.spiritEnergySpent; materials += a.materialsSpent; seals += a.sealSpent; wear += a.clampWear;
    }
    if (checks > 1 || r.closes !== r.attempts.filter(a => a.closed).length || r.result !== (r.attempts.at(-1)?.result ?? 'NONE')) return false;
    const a = r.attempts.at(-1);
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen || a?.week === s.week) return false; }
    if (r.status === 'ACTIVE') { open++; if (!a || a.closed || !r.contactOpen || l.activeCase !== id || a.week !== s.week || a.method !== r.method || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (r.contactOpen) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!a?.closed || !r.returned || r.result === 'NONE' || r.method !== a.method)) return false;
    if (r.status === 'OBSERVED' && a && (!a.closed || a.result !== 'NONE')) return false;
    if (r.status === 'RESOLVED') resolved++;
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.clockSeconds !== seconds + combatSeconds || l.playerTravelMetres !== metres || l.playerLocation !== playerLocation || l.reed.travelMetres !== spiritMetres || l.reed.energy !== 100 - energy || l.reed.location !== reedLocation || l.materials.remaining !== 2 - materials || l.seal.remaining !== 1 - seals || l.clamp.durability !== 100 - wear || l.jar.sealed !== (seals === 1) || l.tag.location !== tagLocation || l.reply.location !== replyLocation || l.reply.written !== written || l.tag.travelMetres !== tagMetres || l.reply.travelMetres !== replyMetres || l.reflected && resolved !== 3) return false;
  const a = currentAttempt(s); if (l.jar.agitation !== (l.activeCase === 'quiet-jar' && a?.effectActive ? 0 : 2)) return false;
  if (s.seer.completedSources.filter(x => x === 'ferryman-reflection').length !== (l.reflected ? 1 : 0) || !open && cleanupBlock(s) !== null) return false;
  const inherited = s.progression.pathwayId === 'death' && s.progression.sequence === 2;
  if (inherited && hasFerrymanLifeLock(s)) return false;
  const acting = inherited ? s.deathConsul.ferrymanActingAtPromotion : s.progression.acting;
  return !(promoted(s) || inherited) || acting === resolved * 25 + (l.reflected ? 25 : 0);
}
