import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasParasiteLifeLock } from '../parasite/life.js';

export const DECEIT_MENTOR_CASE_IDS = ['spent-lamp', 'falling-tag', 'witness-correction'] as const;
export type DeceitMentorCaseId = typeof DECEIT_MENTOR_CASE_IDS[number];
export type DeceitMentorLocation = 'START' | 'BENCH' | 'CABINET';
export type DeceitMentorConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export type DeceitMentorFace = 'FRONT' | 'BACK';
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'TAKE_ITEM' | 'GO_SITE' | 'CONSENT_WITNESS' | 'STOP_EFFECT' | 'STOP_CONTACT' | 'RETURN_PLAYER' | 'RETURN_ITEM' | 'INSPECT';
type LampCommand = 'LIGHT_LAMP' | 'EXTEND_LIGHT' | 'LIGHT_CANDLE' | 'READ_PLATE' | 'EXTINGUISH';
type TagCommand = 'DELAY_TAG' | 'RELEASE_TAG' | 'READ_TAG' | 'RECOVER_TAG';
type CardCommand = 'PLACE_CARD' | 'READ_CARD' | 'MISDIRECT' | 'FLIP_CARD' | 'VERIFY_CARD' | 'RECOVER_CARD' | 'RETURN_WITNESS';
export type DeceitMentorActivityCommand =
  | { type: CommonCommand; caseId: DeceitMentorCaseId }
  | { type: LampCommand; caseId: 'spent-lamp' }
  | { type: TagCommand; caseId: 'falling-tag' }
  | { type: CardCommand; caseId: 'witness-correction' }
  | { type: 'WAIT_EFFECT'; caseId: DeceitMentorCaseId }
  | { type: 'PREPARE'; caseId: DeceitMentorCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
type SceneType = Exclude<DeceitMentorActivityCommand['type'], 'OBSERVE' | 'PREPARE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'REFLECT'>;
export interface DeceitMentorMovement { from: DeceitMentorLocation; to: DeceitMentorLocation; mode: 'WALK'; metres: number; seconds: number; itemId: 'DM3-LAMP' | 'DM3-TAG' | 'DM3-CARD' | null }
export interface DeceitMentorLifeStep { type: SceneType; tier: PublicResolutionTier | null; edithWilling: boolean; basilWilling: boolean }
export interface DeceitMentorAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; elapsedSeconds: number; playerTravelMetres: number; witnessTravelMetres: number;
  playerMoves: DeceitMentorMovement[]; steps: DeceitMentorLifeStep[]; spiritualitySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: DeceitMentorConsent; ownerConsentWeek: number | null; witnessConsent: DeceitMentorConsent; witnessConsentWeek: number | null;
  itemTaken: boolean; siteVisited: boolean; stopped: boolean; effectStopped: boolean; inspected: boolean; playerReturned: boolean; itemReturned: boolean;
  lampLit: boolean; lampOilSpent: number; candleSpent: number; plateRead: boolean; plateReadBy: 'LAMP' | 'CANDLE' | null; extinguished: boolean;
  tagReleased: boolean; tagRead: boolean; tagReadWhile: 'AIR' | 'PLAYER' | null; tagRecovered: boolean;
  cardPlaced: boolean; cardRead: boolean; originalFace: DeceitMentorFace | null; observedFaceBeforeCorrection: DeceitMentorFace | null;
  cardFlipped: boolean; correctedOriginalFace: DeceitMentorFace | null; verifiedFace: DeceitMentorFace | null; correctionMade: boolean; cardRecovered: boolean; witnessReturned: boolean;
}
export interface DeceitMentorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: DeceitMentorAttempt[];
}
export interface DeceitMentorLifeState {
  siteId: 'DM3-WORKSHOP'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: DeceitMentorCaseId | null;
  playerLocation: DeceitMentorLocation; playerTravelMetres: number; clockSeconds: number;
  edith: { id: 'DM3-EDITH'; name: '伊迪丝·芬'; age: 43; alive: true; willing: boolean; location: 'START' };
  basil: { id: 'DM3-BASIL'; name: '巴兹尔·摩尔'; age: 39; alive: true; willing: boolean; location: 'BENCH' | 'CABINET'; travelMetres: number };
  lamp: { id: 'DM3-LAMP'; owner: 'DM3-EDITH'; quantity: 1; location: 'OWNER' | 'PLAYER'; oil: number; lit: boolean; wickSeconds: number; extensionSeconds: number; extensionUsed: boolean; travelMetres: number };
  candle: { id: 'DM3-CANDLE'; owner: 'DM3-EDITH'; quantity: 1; location: 'BENCH'; remaining: number; lit: boolean; burnSeconds: number };
  plate: { id: 'DM3-PLATE'; owner: 'DM3-EDITH'; quantity: 1; location: 'BENCH'; inscription: 'L-17 原工坊灯具' };
  tag: { id: 'DM3-TAG'; owner: 'DM3-EDITH'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'AIR' | 'TRAY'; number: 'T-08'; delaySeconds: number; travelMetres: number };
  tray: { id: 'DM3-TRAY'; owner: 'DM3-EDITH'; quantity: 1; location: 'BENCH'; material: 'FELT' };
  card: { id: 'DM3-CARD'; owner: 'DM3-EDITH'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'FRAME'; face: DeceitMentorFace; frontMark: 'BLUE_TRIANGLE'; backMark: 'RED_CIRCLE'; deceptionSeconds: number; travelMetres: number };
  frame: { id: 'DM3-FRAME'; owner: 'DM3-EDITH'; quantity: 1; location: 'CABINET' };
  door: { id: 'DM3-DOOR'; state: 'OPEN' }; cases: Record<DeceitMentorCaseId, DeceitMentorCaseState>; reflected: boolean;
}
export interface DeceitMentorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DeceitMentorActivityCommand }
export interface DeceitMentorLifeProjection extends Omit<DeceitMentorLifeState, 'cases'> {
  title: string; story: string; environment: string; nextStep: string; inside: boolean; insideCase: boolean; currentAttempt: DeceitMentorAttempt | null;
  cases: { id: DeceitMentorCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: DeceitMentorAttempt[] }[];
  actions: DeceitMentorLifeAction[];
}
export const DECEIT_MENTOR_LIFE_STORY = '欺瞒导师·错误序列3，诈骗深化及涉及自然规律欺瞒的方向已核。原著阿蒙让无燃料灯笼亮一周，不代表初晋序列3普遍时长。本场仅原灯续光16秒、原轻纸签迟落8秒、原卡朝向误判最多6秒；对象、阈值、全部操作与数值均为原创G。每案观察、准备、实施、报告各1行动，准备须余2行动；内场0行动仍计秒和普通米数。三报告各扮演25、反思25，共13行动；成功真正作用并完成报告才加对应掌握8，普通或失败不加。不能编辑任意自然规则、复制物品或强迫同意。';
const CASES = [
  { id: 'spent-lamp', title: 'G · 同一原灯的有限无油续光', story: '伊迪丝本案许可后携DM3-LAMP普通6米到BENCH，巴兹尔当面愿记录。唯一原油1耗尽后原灯芯余辉20秒，核原铭牌需24秒；仍有火时仅一次6灵性/知识18成功额外16秒，不回填油。失败可实际耗唯一原备用蜡烛1核读。停术、熄灭真实原灯与蜡烛，再6米携原灯返还。' },
  { id: 'falling-tag', title: 'G · 原轻纸签迟落与同一毡盘', story: '重新问原主许可，拿同一DM3-TAG普通6米到台，巴兹尔另行愿看。仅松开自己手里原小签时6灵性/知识18，成功迟落8秒，空中读原编号5秒；到期或停止即落同一毡盘，失败立即落盘。可实际拾起、用手普通核号。取回同一原签再6米归还，不能远距收物、悬人或无限时悬停。' },
  { id: 'witness-correction', title: 'G · 原卡误判保留，并当场明确纠正', story: '原主另行许可，拿同一DM3-CARD普通10米到CABINET原夹框。邀请巴兹尔自愿4米来当面确认短暂演练，可拒绝。先记录原卡正面，一次6灵性/知识18最多6秒影响朝向判断，成功旧误判或失败识破都保留。本人普通翻同一卡，停止或到期后依据现场纠正原判断并核当前卡面；不改真实卡面、物权或记忆。巴兹尔实际4米回BENCH，原卡随本人10米回START。' },
] as const;
const COMMON: readonly string[] = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'TAKE_ITEM', 'GO_SITE', 'CONSENT_WITNESS', 'STOP_EFFECT', 'STOP_CONTACT', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'WAIT_EFFECT'];
const SPECIFIC: Record<DeceitMentorCaseId, readonly string[]> = { 'spent-lamp': ['LIGHT_LAMP', 'EXTEND_LIGHT', 'LIGHT_CANDLE', 'READ_PLATE', 'EXTINGUISH'], 'falling-tag': ['DELAY_TAG', 'RELEASE_TAG', 'READ_TAG', 'RECOVER_TAG'], 'witness-correction': ['PLACE_CARD', 'READ_CARD', 'MISDIRECT', 'FLIP_CARD', 'VERIFY_CARD', 'RECOVER_CARD', 'RETURN_WITNESS'] };
const ABILITY_STEPS: readonly string[] = ['EXTEND_LIGHT', 'DELAY_TAG', 'MISDIRECT'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'error' && [3, 2].includes(s.progression.sequence ?? 0);
const freshCase = (): DeceitMentorCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): DeceitMentorAttempt {
  return { week: s.week, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, elapsedSeconds: 0, playerTravelMetres: 0, witnessTravelMetres: 0,
    playerMoves: [], steps: [], spiritualitySpent: 0, abilityTier: null, ownerConsent: 'UNASKED', ownerConsentWeek: null, witnessConsent: 'UNASKED', witnessConsentWeek: null,
    itemTaken: false, siteVisited: false, stopped: false, effectStopped: false, inspected: false, playerReturned: false, itemReturned: false,
    lampLit: false, lampOilSpent: 0, candleSpent: 0, plateRead: false, plateReadBy: null, extinguished: false,
    tagReleased: false, tagRead: false, tagReadWhile: null, tagRecovered: false,
    cardPlaced: false, cardRead: false, originalFace: null, observedFaceBeforeCorrection: null, cardFlipped: false, correctedOriginalFace: null, verifiedFace: null, correctionMade: false, cardRecovered: false, witnessReturned: false };
}
export function createDeceitMentorLifeState(): DeceitMentorLifeState {
  return { siteId: 'DM3-WORKSHOP', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    edith: { id: 'DM3-EDITH', name: '伊迪丝·芬', age: 43, alive: true, willing: true, location: 'START' },
    basil: { id: 'DM3-BASIL', name: '巴兹尔·摩尔', age: 39, alive: true, willing: true, location: 'BENCH', travelMetres: 0 },
    lamp: { id: 'DM3-LAMP', owner: 'DM3-EDITH', quantity: 1, location: 'OWNER', oil: 1, lit: false, wickSeconds: 0, extensionSeconds: 0, extensionUsed: false, travelMetres: 0 },
    candle: { id: 'DM3-CANDLE', owner: 'DM3-EDITH', quantity: 1, location: 'BENCH', remaining: 1, lit: false, burnSeconds: 40 },
    plate: { id: 'DM3-PLATE', owner: 'DM3-EDITH', quantity: 1, location: 'BENCH', inscription: 'L-17 原工坊灯具' },
    tag: { id: 'DM3-TAG', owner: 'DM3-EDITH', quantity: 1, location: 'OWNER', number: 'T-08', delaySeconds: 0, travelMetres: 0 },
    tray: { id: 'DM3-TRAY', owner: 'DM3-EDITH', quantity: 1, location: 'BENCH', material: 'FELT' },
    card: { id: 'DM3-CARD', owner: 'DM3-EDITH', quantity: 1, location: 'OWNER', face: 'FRONT', frontMark: 'BLUE_TRIANGLE', backMark: 'RED_CIRCLE', deceptionSeconds: 0, travelMetres: 0 },
    frame: { id: 'DM3-FRAME', owner: 'DM3-EDITH', quantity: 1, location: 'CABINET' }, door: { id: 'DM3-DOOR', state: 'OPEN' },
    cases: { 'spent-lamp': freshCase(), 'falling-tag': freshCase(), 'witness-correction': freshCase() }, reflected: false };
}
export function validateDeceitMentorActivityCommand(v: unknown): v is DeceitMentorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!DECEIT_MENTOR_CASE_IDS.includes(v.caseId as DeceitMentorCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as DeceitMentorCaseId].includes(String(v.type)));
}
export const isDeceitMentorActivityCommand = validateDeceitMentorActivityCommand;
export const isDeceitMentorActivity = validateDeceitMentorActivityCommand;
const currentAttempt = (s: SliceState) => s.deceitMentor.life.activeCase ? s.deceitMentor.life.cases[s.deceitMentor.life.activeCase].attempts.at(-1) ?? null : null;
const itemFor = (l: DeceitMentorLifeState, id: DeceitMentorCaseId) => id === 'spent-lamp' ? l.lamp : id === 'falling-tag' ? l.tag : l.card;
const siteFor = (id: DeceitMentorCaseId): DeceitMentorLocation => id === 'witness-correction' ? 'CABINET' : 'BENCH';
const distance = (from: DeceitMentorLocation, to: DeceitMentorLocation) => from === to ? 0 : from === 'START' || to === 'START' ? from === 'CABINET' || to === 'CABINET' ? 10 : 6 : 4;
function cleanupBlock(s: SliceState): string | null {
  const l = s.deceitMentor.life, a = currentAttempt(s);
  if (l.lamp.lit || l.candle.lit) return '先实际熄灭同一原灯与备用蜡烛，剩余寿命保留，油和蜡烛不补。';
  if (l.lamp.extensionSeconds || l.tag.delaySeconds || l.card.deceptionSeconds) return '先停止本次有限作用，或实际等到到期。';
  if (a?.observedFaceBeforeCorrection !== null && a?.observedFaceBeforeCorrection !== undefined && !a.correctionMade) return '原卡的当时观察尚未当场核实纠正，不能把错误记录留作真相。';
  if (l.basil.location !== 'BENCH') return '巴兹尔须本人沿原4米走回BENCH。';
  if (l.playerLocation !== 'START') return '本人须携原物沿原普通干廊真实回START。';
  if ([l.lamp, l.tag, l.card].some(item => item.location !== 'OWNER')) return '同一原物尚未实际交回START的伊迪丝，不能远距收物。';
  return null;
}
export const hasDeceitMentorLifeLock = (s: SliceState): boolean => s.deceitMentor.life.activeCase !== null || Object.values(s.deceitMentor.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
export const deceitMentorInside = hasDeceitMentorLifeLock;
const ownerConsents = (s: SliceState, a: DeceitMentorAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.deceitMentor.life.edith.willing && !a.stopped;
const witnessConsents = (s: SliceState, a: DeceitMentorAttempt) => a.witnessConsent === 'GRANTED' && a.witnessConsentWeek === s.week && s.deceitMentor.life.basil.willing && !a.stopped;
function effectRemaining(l: DeceitMentorLifeState, id: DeceitMentorCaseId): number { return id === 'spent-lamp' ? l.lamp.lit ? l.lamp.wickSeconds + l.lamp.extensionSeconds : 0 : id === 'falling-tag' ? l.tag.delaySeconds : l.card.deceptionSeconds; }
function sceneReason(s: SliceState, id: DeceitMentorCaseId, type: SceneType): string | null {
  const l = s.deceitMentor.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id), atSite = l.playerLocation === siteFor(id);
  if (s.health <= 0 || s.status === 'DEAD') return '原身体已死亡，不能用退出复活或移动原物。';
  if (a.inspected) return '已检查实际收口，只可关闭现场。';
  if (type === 'STOP_CONTACT') return a.stopped ? '本次已经停止，仍须实际收口。' : null;
  if (type === 'STOP_EFFECT') return a.effectStopped ? '已经明确停术，原物仍按实际去向收口。' : null;
  if (type === 'WAIT_EFFECT') return effectRemaining(l, id) > 0 ? null : '本案没有仍在计时的原火或有限效果。';
  if (type === 'EXTINGUISH') return l.playerLocation === 'BENCH' && (l.lamp.lit || l.candle.lit || a.lampLit || a.candleSpent > 0) && !a.extinguished ? null : '须在BENCH实际熄灭本次用过的原灯和蜡烛。';
  if (type === 'RECOVER_TAG') return l.playerLocation === 'BENCH' && l.tag.location === 'TRAY' ? null : '本人须到同一原毡盘，原签已经实际落盘后才能拾起。';
  if (type === 'FLIP_CARD') return l.playerLocation === 'CABINET' && l.card.location === 'FRAME' && a.cardRead && !a.cardFlipped ? null : '先当面记录同一原卡正面，才能普通翻同一卡；翻面不来自超凡改写。';
  if (type === 'VERIFY_CARD') return l.playerLocation === 'CABINET' && l.basil.location === 'CABINET' && l.card.location === 'FRAME' && a.cardRead && a.cardFlipped && l.card.deceptionSeconds === 0 && !a.correctionMade ? null : '须原卡仍在面前、已经普通翻面且效果已停止或到期，才依现场纠正原观察并核当前卡面。';
  if (type === 'RECOVER_CARD') return l.playerLocation === 'CABINET' && l.card.location === 'FRAME' && l.card.deceptionSeconds === 0 && (a.correctionMade || a.stopped && a.observedFaceBeforeCorrection === null) ? null : '须效果已结束、原误判已纠正（或未误判即停止），本人才能从原夹框取同一卡。';
  if (type === 'RETURN_WITNESS') return l.playerLocation === 'CABINET' && l.basil.location === 'CABINET' && l.card.deceptionSeconds === 0 && (a.observedFaceBeforeCorrection === null || a.correctionMade) ? null : '须双方仍在CABINET且本次误判已核实，巴兹尔才自行沿4米回BENCH。';
  if (type === 'RETURN_PLAYER') {
    if (l.playerLocation === 'START' || l.door.state !== 'OPEN') return '本人已经在START，或原普通路未开放。';
    if (item.location !== 'PLAYER') return '先在原位置取回同一借物，再携原物普通返回；不能远距收物。';
    if (l.lamp.lit || l.candle.lit || l.lamp.extensionSeconds || l.tag.delaySeconds || l.card.deceptionSeconds) return '先停术和熄灭原火，再普通返回。';
    if (id === 'witness-correction' && (l.basil.location !== 'BENCH' || a.observedFaceBeforeCorrection !== null && !a.correctionMade)) return '先核实纠正本次原卡观察，并让巴兹尔实际返回BENCH。';
    return null;
  }
  if (type === 'RETURN_ITEM') return l.playerLocation === 'START' && item.location === 'PLAYER' ? null : '须本人和同一借物都在START才能当面交还原主。';
  if (type === 'INSPECT') return cleanupBlock(s) ?? (a.result !== 'NONE' || a.stopped || a.ownerConsent === 'DECLINED' || a.witnessConsent === 'DECLINED' ? null : '先完成本案或明确停止，再按真实结果收口。');
  if (type === 'CONSENT_OWNER') return l.playerLocation === 'START' && a.ownerConsent === 'UNASKED' && !a.stopped ? null : '每案由同一伊迪丝当面独立回答，旧许可不能延用。';
  if (!ownerConsents(s, a)) return '缺少本案原主当前许可，或已经停止；普通停止、纠正与归还仍开放。';
  if (type === 'TAKE_ITEM') return l.playerLocation === 'START' && item.location === 'OWNER' && !a.itemTaken ? null : '须原主尚持本案唯一原物，不能重复领取或复制。';
  if (type === 'GO_SITE') return l.playerLocation === 'START' && !a.siteVisited && item.location === 'PLAYER' && l.door.state === 'OPEN' ? null : '先取得同一原物，再从START首次沿普通干廊到本案现场。';
  if (type === 'CONSENT_WITNESS') return atSite && a.witnessConsent === 'UNASKED' && l.basil.location === 'BENCH' ? null : '本人须在本案现场；巴兹尔须另行回答本次记录或短暂演练，随机判定不代表同意。';
  if (!atSite || !witnessConsents(s, a) || l.basil.location !== siteFor(id)) return '须本人、同一原物与自愿的巴兹尔实际在本案现场。';
  if (type === 'LIGHT_LAMP') return l.lamp.location === 'PLAYER' && l.lamp.oil === 1 && !a.lampLit ? null : '须持同一原灯并尚有唯一油1；油耗尽或熄灭后不能凭空重燃。';
  if (type === 'LIGHT_CANDLE') return l.candle.remaining === 1 && !a.plateRead && !a.extinguished ? null : '原备用蜡烛只有1支，已耗不补，读完不再领取。';
  if (type === 'READ_PLATE') return !a.plateRead && (l.lamp.lit && l.lamp.wickSeconds + l.lamp.extensionSeconds >= 24 || l.candle.lit && l.candle.burnSeconds >= 24) ? null : '核同一原铭牌实需连续24秒光照；余辉不足时须耗真实原备用蜡烛，不能暗处自动读完。';
  if (type === 'RELEASE_TAG') return l.tag.location === 'PLAYER' && !a.tagReleased ? null : '须原小签尚托在本人手里；普通松手立即落同一毡盘。';
  if (type === 'READ_TAG') return !a.tagRead && a.tagReleased && (l.tag.location === 'PLAYER' || l.tag.location === 'AIR' && l.tag.delaySeconds >= 5) ? null : '原签须仍在空中至少5秒，或已从原盘拾起用手普通持有，才核读已有编号。';
  if (type === 'PLACE_CARD') return l.card.location === 'PLAYER' && !a.cardPlaced ? null : '本人须实际携唯一原卡到CABINET，才能放入原夹框。';
  if (type === 'READ_CARD') return l.card.location === 'FRAME' && !a.cardRead ? null : '先把同一原卡放进原夹框，记录已存在的真实正面。';
  if (ABILITY_STEPS.includes(type)) {
    if (a.method !== 'ABILITY' || a.abilityTier !== null || a.effectStopped) return '本案最多一次有限能力检验；普通方案、停术或已尝试后不再重骰。';
    if (s.spirituality < 6 || s.mind <= 0) return '本次需要6灵性和清醒；失败成本不退，普通归还不耗灵性。';
    if (type === 'EXTEND_LIGHT') return l.lamp.location === 'PLAYER' && l.lamp.oil === 0 && l.lamp.lit && l.lamp.wickSeconds > 0 && !l.lamp.extensionUsed && !a.plateRead ? null : '只可在唯一原油已耗、原灯仍有火时续光一次；灭后不能续光点燃。';
    if (type === 'DELAY_TAG') return l.tag.location === 'PLAYER' && !a.tagReleased ? null : '只能托住本人手里的同一轻纸签并在松手时尝试，不能悬人或任意物体。';
    if (type === 'MISDIRECT') return l.card.location === 'FRAME' && a.cardRead && !a.cardFlipped ? null : '先记录同一原卡真实正面，只影响这次最多6秒的朝向判断，不改物权或记忆。';
  }
  return '当前原人、原物或顺序条件不满足，可停止后实际归还。';
}
export function blockDeceitMentorLife(s: SliceState, c: DeceitMentorActivityCommand): string | null {
  if (!validateDeceitMentorActivityCommand(c)) return '欺瞒导师生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须原身体活着并真实晋升欺瞒导师序列3。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.deceitMentor.encounter.status)) return '先结束当前事件或战斗，不覆盖原身体。';
  const l = s.deceitMentor.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (r?.contactOpen && 'caseId' in c && l.activeCase === c.caseId) {
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return r.attempts.at(-1)!.inspected ? cleanupBlock(s) : '先真实停止、纠正、取回、归还并检查现场。';
    return ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT'].includes(c.type) ? '当前现场尚未关闭。' : sceneReason(s, c.caseId, c.type as SceneType);
  }
  if (hasDeceitMentorLifeLock(s) && !(c.type === 'PERFORM' && r?.status === 'PREPARED')) return '先实施或取消本次准备，或实际收口当前现场。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德工坊。';
  if (hasParasiteLifeLock(s) || s.parasite.encounter.borrowed.some(power => power.closedSeconds === null) || s.deceitMentor.preparedWeek !== null) return '先收束旧寄生接触、原暂窃窗口或服药准备，保留原人原物。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '本项需要清醒和1行动；开放现场普通收口仍可0行动、0灵性。';
  if (c.type === 'REFLECT') return l.reflected ? '已经反思，不重复发奖。' : DECEIT_MENTOR_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '须先提交三份真实报告。';
  if (!r || !('caseId' in c)) return '没有对应原案例。';
  const index = DECEIT_MENTOR_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[DECEIT_MENTOR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告上一案真实结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已观察本案，原物不重置。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案，原现场仅实施一次。' : s.actionsRemaining < 2 ? '准备须至少余2行动，预留1行动实施。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先实际收口并关闭，报告不能移动原身体。';
  return '没有对应开放现场。';
}
export const blockDeceitMentorActivity = blockDeceitMentorLife;
function elapse(s: SliceState, a: DeceitMentorAttempt, seconds: number) {
  const l = s.deceitMentor.life; a.elapsedSeconds += seconds; l.clockSeconds += seconds;
  if (l.lamp.lit) {
    const naturalUsed = Math.min(l.lamp.wickSeconds, seconds); l.lamp.wickSeconds -= naturalUsed;
    l.lamp.extensionSeconds = Math.max(0, l.lamp.extensionSeconds - (seconds - naturalUsed));
    if (l.lamp.wickSeconds + l.lamp.extensionSeconds === 0) l.lamp.lit = false;
  }
  if (l.candle.lit) { l.candle.burnSeconds = Math.max(0, l.candle.burnSeconds - seconds); if (!l.candle.burnSeconds) l.candle.lit = false; }
  l.tag.delaySeconds = Math.max(0, l.tag.delaySeconds - seconds);
  if (l.tag.location === 'AIR' && !l.tag.delaySeconds) l.tag.location = 'TRAY';
  l.card.deceptionSeconds = Math.max(0, l.card.deceptionSeconds - seconds);
}
function stopEffect(l: DeceitMentorLifeState, a: DeceitMentorAttempt) {
  l.lamp.extensionSeconds = 0; if (!l.lamp.wickSeconds) l.lamp.lit = false;
  l.tag.delaySeconds = 0; if (l.tag.location === 'AIR') l.tag.location = 'TRAY';
  l.card.deceptionSeconds = 0; a.effectStopped = true;
}
function walk(s: SliceState, id: DeceitMentorCaseId, to: DeceitMentorLocation) {
  const l = s.deceitMentor.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id), from = l.playerLocation, metres = distance(from, to);
  a.playerMoves.push({ from, to, mode: 'WALK', metres, seconds: metres, itemId: item.location === 'PLAYER' ? item.id : null });
  elapse(s, a, metres); l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres;
  if (item.location === 'PLAYER') item.travelMetres += metres;
}
function walkWitness(s: SliceState, a: DeceitMentorAttempt, to: 'BENCH' | 'CABINET') { elapse(s, a, 4); s.deceitMentor.life.basil.location = to; s.deceitMentor.life.basil.travelMetres += 4; a.witnessTravelMetres += 4; }
function setResult(s: SliceState, id: DeceitMentorCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.deceitMentor.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
/** Finite original-object reducer, also used to replay saved scene traces. */
function applyScene(s: SliceState, id: DeceitMentorCaseId, step: DeceitMentorLifeStep): void {
  const l = s.deceitMentor.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id); a.steps.push({ ...step });
  if (ABILITY_STEPS.includes(step.type)) { s.spirituality -= 6; a.spiritualitySpent += 6; a.abilityTier = step.tier; }
  switch (step.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.edith.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; elapse(s, a, 2); break;
    case 'TAKE_ITEM': item.location = 'PLAYER'; a.itemTaken = true; elapse(s, a, 1); break;
    case 'GO_SITE': walk(s, id, siteFor(id)); a.siteVisited = true; break;
    case 'CONSENT_WITNESS':
      a.witnessConsent = l.basil.willing ? 'GRANTED' : 'DECLINED'; a.witnessConsentWeek = s.week;
      if (id === 'witness-correction' && l.basil.willing) walkWitness(s, a, 'CABINET'); elapse(s, a, 2); break;
    case 'LIGHT_LAMP': l.lamp.oil--; a.lampOilSpent++; a.lampLit = true; elapse(s, a, 1); l.lamp.lit = true; l.lamp.wickSeconds = 20; break;
    case 'EXTEND_LIGHT': l.lamp.extensionUsed = true; if (success(step.tier)) l.lamp.extensionSeconds = 16; elapse(s, a, 1); break;
    case 'LIGHT_CANDLE': l.candle.remaining--; a.candleSpent++; elapse(s, a, 1); l.candle.lit = true; break;
    case 'READ_PLATE': {
      const lamp = l.lamp.lit && l.lamp.wickSeconds + l.lamp.extensionSeconds >= 24;
      a.plateReadBy = lamp ? 'LAMP' : 'CANDLE'; elapse(s, a, 24); a.plateRead = true;
      setResult(s, id, lamp && success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); break;
    }
    case 'EXTINGUISH': stopEffect(l, a); l.lamp.lit = false; l.candle.lit = false; a.extinguished = true; elapse(s, a, 1); break;
    case 'DELAY_TAG': elapse(s, a, 1); a.tagReleased = true; l.tag.location = success(step.tier) ? 'AIR' : 'TRAY'; l.tag.delaySeconds = success(step.tier) ? 8 : 0; break;
    case 'RELEASE_TAG': elapse(s, a, 1); a.tagReleased = true; l.tag.location = 'TRAY'; break;
    case 'READ_TAG': a.tagReadWhile = l.tag.location as 'AIR' | 'PLAYER'; elapse(s, a, 5); a.tagRead = true; setResult(s, id, a.tagReadWhile === 'AIR' && success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); break;
    case 'RECOVER_TAG': l.tag.location = 'PLAYER'; a.tagRecovered = true; elapse(s, a, 1); break;
    case 'PLACE_CARD': l.card.location = 'FRAME'; a.cardPlaced = true; elapse(s, a, 1); break;
    case 'READ_CARD': a.cardRead = true; a.originalFace = l.card.face; elapse(s, a, 2); break;
    case 'MISDIRECT': elapse(s, a, 1); l.card.deceptionSeconds = success(step.tier) ? 6 : 0; a.observedFaceBeforeCorrection = success(step.tier) ? (l.card.face === 'FRONT' ? 'BACK' : 'FRONT') : l.card.face; break;
    case 'FLIP_CARD': l.card.face = l.card.face === 'FRONT' ? 'BACK' : 'FRONT'; a.cardFlipped = true; elapse(s, a, 2); break;
    case 'VERIFY_CARD':
      a.correctedOriginalFace = a.originalFace; a.verifiedFace = l.card.face; a.correctionMade = true; elapse(s, a, 3);
      setResult(s, id, success(a.abilityTier) && a.observedFaceBeforeCorrection !== a.originalFace ? 'ABILITY' : 'ORDINARY'); break;
    case 'RECOVER_CARD': l.card.location = 'PLAYER'; a.cardRecovered = true; elapse(s, a, 1); break;
    case 'RETURN_WITNESS': walkWitness(s, a, 'BENCH'); a.witnessReturned = true; break;
    case 'WAIT_EFFECT': elapse(s, a, effectRemaining(l, id)); break;
    case 'STOP_EFFECT': stopEffect(l, a); elapse(s, a, 1); break;
    case 'STOP_CONTACT': a.stopped = true; stopEffect(l, a); elapse(s, a, 1); break;
    case 'RETURN_PLAYER': walk(s, id, 'START'); a.playerReturned = true; break;
    case 'RETURN_ITEM': item.location = 'OWNER'; a.itemReturned = true; elapse(s, a, 1); break;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (a.result === 'NONE') setResult(s, id, 'ORDINARY'); break;
  }
}
export function applyDeceitMentorActivity(s: SliceState, c: DeceitMentorActivityCommand, ctx: SeerContext): void {
  const reason = blockDeceitMentorLife(s, c); if (reason) throw new Error(reason);
  const l = s.deceitMentor.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('deceit-mentor-reflection'); ctx.note('G · 有限欺瞒与真实归还的反思', '三份真实报告后扮演+25；无油仍无油、同一原签已经落盘并归还，原卡旧误判和当场纠正并存。没有任意规则编辑、强迫同意或永久改写记忆。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '本案一次有限欺瞒' : '普通核验'}；准备不代替原主或巴兹尔本次同意。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动，已付不退；原身体与原物没有移动。'); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动实施，原身体仍在START，先问原主本案许可。现场子步0行动仍实耗时间、普通路程与原资源。'); return; }
  if (c.type === 'REPORT') {
    s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r.result === 'ABILITY') { const ability = c.caseId === 'witness-correction' ? 'error.s3.deep-deception' : 'error.s3.law-deceit'; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
    ctx.note(definition.title, `按真实经过报告，扮演+25；${r.result === 'ABILITY' ? '有限能力实际成功且已归还纠正，对应掌握+8。' : '普通完成、失败后普通核验或尊重拒绝，不加能力掌握。'}原物、消耗、当时观察与纠正记录均保留。`); return;
  }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    a.closed = true; a.ownerConsent = a.witnessConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = 'EXAMINED'; l.activeCase = null;
    ctx.note('关闭已实际收口的原现场', `本人START、原物归OWNER、巴兹尔BENCH。原油余${l.lamp.oil}，原蜡烛未用${l.candle.remaining}；原卡真实${l.card.face}，旧误判${a.observedFaceBeforeCorrection ?? '无'}、核实原观察${a.correctedOriginalFace ?? '未发生'}，不补资源或假称超凡成功。`); return;
  }
  const tier = ABILITY_STEPS.includes(c.type) ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, edithWilling: l.edith.willing, basilWilling: l.basil.willing });
  const descriptions: Partial<Record<SceneType, string>> = {
    CONSENT_OWNER: `原主当面回答${a.ownerConsent}；不同案许可不延续。`,
    CONSENT_WITNESS: `巴兹尔本次${a.witnessConsent}${c.caseId === 'witness-correction' && a.witnessConsent === 'GRANTED' ? '，同一人实走4米到CABINET' : ''}；没有随机强迫同意。`,
    LIGHT_LAMP: '唯一原油1→0，原灯芯实际余辉20秒；没有新增燃料。',
    EXTEND_LIGHT: `一次6灵性/知识18为${tier}；${success(tier) ? '同一仍有火的原灯额外续光16秒' : '不增加任何时长'}，不是阿蒙一周时长的下放。`,
    LIGHT_CANDLE: '同一原备用蜡烛1→0，实际点燃以普通光完成核读；没有新灯或补油。',
    READ_PLATE: `实际用${a.plateReadBy === 'LAMP' ? '原灯' : '原备用蜡烛'}连续24秒核读原铭牌“${l.plate.inscription}”；原铭牌仍在BENCH。`,
    DELAY_TAG: `一次6灵性/知识18为${tier}；同一原轻纸签${success(tier) ? '在原毡盘上方有限迟落8秒' : '立即真实落原毡盘'}，不复制、不悬人。`,
    READ_TAG: `实际5秒核原编号${l.tag.number}，原签当时${a.tagReadWhile === 'AIR' ? '有限迟落空中' : '由本人普通持在手中'}。`,
    MISDIRECT: `一次6灵性/知识18为${tier}，原卡真实${l.card.face}；当时记录${a.observedFaceBeforeCorrection}，${success(tier) ? '最多6秒影响朝向判断' : '巴兹尔识破，未形成错误朝向判断'}。原卡面、物权、记忆不改，须现场核实纠正。`,
    FLIP_CARD: `本人普通翻同一卡，现在真实${l.card.face}；这是实际翻面，不是能力改物。`,
    VERIFY_CARD: `保留当时观察${a.observedFaceBeforeCorrection ?? '普通核验'}，明确纠正/确认当时真实${a.correctedOriginalFace}，现在原卡真实${a.verifiedFace}；错误观察不再当作事实。`,
    RETURN_WITNESS: '同一巴兹尔沿原4米真实回BENCH，不复制或远程复位。',
    STOP_EFFECT: '主动结束有限作用，悬着的同一原签会真实落盘；停术不补油、不收回原物。',
    WAIT_EFFECT: '真实等待到当前原火/有限效果耗尽；原签到期落同一盘，原卡误判仍须纠正。',
    EXTINGUISH: '停止作用并实际熄同一原灯与蜡烛，剩余寿命保留，已耗燃料不恢复。',
  };
  ctx.note(`G · ${c.type}`, `${descriptions[c.type as SceneType] ?? '按同一原人原物的实际位置完成本步。'} 本人${l.playerLocation}；本案${a.elapsedSeconds}秒、本人${a.playerTravelMetres}米、巴兹尔${a.witnessTravelMetres}米、实耗${a.spiritualitySpent}灵性。`);
}
const LABELS: Record<SceneType, [string, string]> = {
  CONSENT_OWNER: ['当面问伊迪丝本案许可', '2秒'], TAKE_ITEM: ['领取本案同一原物', '1秒'], GO_SITE: ['携同一原物沿普通干廊到现场', '6米6秒；原卡10米10秒'], CONSENT_WITNESS: ['请巴兹尔自愿确认本次演练', '2秒；原卡案另实走4米4秒'],
  LIGHT_LAMP: ['点燃原灯，耗尽唯一原油', '油1 · 原余辉20秒'], EXTEND_LIGHT: ['有限无油续光G：尝试额外16秒', '6灵性 · 知识18 · 1秒'], LIGHT_CANDLE: ['耗原备用蜡烛，改普通核读', '原蜡烛1 · 1秒'], READ_PLATE: ['连续照明24秒，核读同一原铭牌', '24秒'], EXTINGUISH: ['实际熄灭原灯与原蜡烛', '1秒 · 不补资源'],
  DELAY_TAG: ['松开原纸签，尝试有限迟落8秒G', '6灵性 · 知识18 · 1秒'], RELEASE_TAG: ['普通松手，让同一原纸签落毡盘', '1秒'], READ_TAG: ['核读同一原纸签已有编号', '5秒'], RECOVER_TAG: ['本人从原毡盘拾同一原纸签', '1秒'],
  PLACE_CARD: ['把同一原卡放进原夹框', '1秒'], READ_CARD: ['当面记录同一原卡真实正面', '2秒'], MISDIRECT: ['短暂深层欺瞒G：仅本次朝向判断', '6灵性 · 知识18 · 最多6秒'], FLIP_CARD: ['本人普通翻同一原卡再展示', '2秒'], VERIFY_CARD: ['依现场明确纠正原观察并核当前卡面', '3秒'], RECOVER_CARD: ['本人从原夹框取同一原卡', '1秒'], RETURN_WITNESS: ['巴兹尔本人沿原路回BENCH', '4米4秒'],
  WAIT_EFFECT: ['实际等待原火或有限效果到期', '实耗全部剩余秒数'], STOP_EFFECT: ['主动停止本次有限作用', '1秒'], STOP_CONTACT: ['停止工作，按原人原物实际归还', '1秒 · 仍须真实收口'], RETURN_PLAYER: ['携同一原物沿原普通路回START', '6米6秒；原卡10米10秒'], RETURN_ITEM: ['在START当面归还同一原物', '1秒'], INSPECT: ['核实原人归位、原物归还与原观察纠正', '2秒'],
};
/** Choose the next concrete manipulation, not a generic rule editor or a wall of future controls. */
function nextSceneSteps(s: SliceState, id: DeceitMentorCaseId): SceneType[] {
  const l = s.deceitMentor.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id);
  const cleanup = (): SceneType[] => {
    if (l.lamp.lit || l.candle.lit) return ['EXTINGUISH'];
    if (l.tag.location === 'AIR') return ['STOP_EFFECT', 'WAIT_EFFECT'];
    if (l.tag.location === 'TRAY') return ['RECOVER_TAG'];
    if (id === 'witness-correction') {
      if (a.observedFaceBeforeCorrection !== null && !a.correctionMade) {
        if (!a.cardFlipped) return ['FLIP_CARD'];
        if (l.card.deceptionSeconds) return ['STOP_EFFECT', 'WAIT_EFFECT'];
        return ['VERIFY_CARD'];
      }
      if (l.card.location === 'FRAME') return ['RECOVER_CARD'];
      if (l.basil.location === 'CABINET') return ['RETURN_WITNESS'];
    }
    if (l.playerLocation !== 'START') return ['RETURN_PLAYER'];
    if (item.location === 'PLAYER') return ['RETURN_ITEM'];
    return ['INSPECT'];
  };
  if (a.inspected) return [];
  if (a.stopped || a.ownerConsent === 'DECLINED' || a.witnessConsent === 'DECLINED' || a.ownerConsent === 'GRANTED' && !l.edith.willing || a.witnessConsent === 'GRANTED' && !l.basil.willing) return a.stopped ? cleanup() : ['STOP_CONTACT'];
  if (a.ownerConsent === 'UNASKED') return ['CONSENT_OWNER'];
  if (!a.itemTaken) return ['TAKE_ITEM'];
  if (!a.siteVisited) return ['GO_SITE'];
  if (a.witnessConsent === 'UNASKED') return ['CONSENT_WITNESS'];
  if (id === 'spent-lamp') {
    if (!a.lampLit && !a.plateRead) return ['LIGHT_LAMP'];
    if (!a.plateRead) {
      if (l.lamp.lit && l.lamp.wickSeconds + l.lamp.extensionSeconds >= 24 || l.candle.lit && l.candle.burnSeconds >= 24) return ['READ_PLATE'];
      if (a.method === 'ABILITY' && a.abilityTier === null && l.lamp.lit && !a.effectStopped) return ['EXTEND_LIGHT', 'LIGHT_CANDLE'];
      return ['LIGHT_CANDLE'];
    }
    if (!a.extinguished) return ['EXTINGUISH'];
  } else if (id === 'falling-tag') {
    if (!a.tagReleased) return a.method === 'ABILITY' && !a.effectStopped ? ['DELAY_TAG', 'RELEASE_TAG'] : ['RELEASE_TAG'];
    if (!a.tagRead) {
      if (l.tag.location === 'TRAY') return ['RECOVER_TAG'];
      if (l.tag.location === 'AIR' && l.tag.delaySeconds < 5) return ['WAIT_EFFECT', 'STOP_EFFECT'];
      return ['READ_TAG'];
    }
  } else {
    if (!a.cardPlaced) return ['PLACE_CARD'];
    if (!a.cardRead) return ['READ_CARD'];
    if (!a.cardFlipped) return a.method === 'ABILITY' && a.abilityTier === null && !a.effectStopped ? ['MISDIRECT', 'FLIP_CARD'] : ['FLIP_CARD'];
    if (l.card.deceptionSeconds) return ['STOP_EFFECT', 'WAIT_EFFECT'];
    if (!a.correctionMade) return ['VERIFY_CARD'];
  }
  return cleanup();
}
export function deceitMentorLifeActions(s: SliceState): DeceitMentorLifeAction[] {
  if (!promoted(s)) return [];
  const out: DeceitMentorLifeAction[] = [], l = s.deceitMentor.life;
  const add = (label: string, cost: string, command: DeceitMentorActivityCommand) => { const reason = blockDeceitMentorLife(s, command); out.push({ id: `deceit-mentor-life-${'caseId' in command ? `${command.caseId}-` : ''}${command.type}${command.type === 'PREPARE' ? `-${command.method}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  const id = l.activeCase ?? DECEIT_MENTOR_CASE_IDS.find(caseId => l.cases[caseId].status !== 'RESOLVED');
  if (id) {
    const r = l.cases[id], a = r.attempts.at(-1), definition = CASES.find(d => d.id === id)!;
    if (r.status === 'AVAILABLE') add(`观察：${definition.title}`, '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add('准备一次有限能力方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add('准备普通核验方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add('实施本次原现场', '1行动', { type: 'PERFORM', caseId: id }); add('取消尚未实施准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'EXAMINED') add('提交本案真实报告', '1行动 · 扮演25', { type: 'REPORT', caseId: id });
    if (r.contactOpen && a) {
      if (a.inspected) add('关闭已真实检查现场', '0行动', { type: 'CLOSE', caseId: id });
      else {
        const next = nextSceneSteps(s, id);
        for (const type of next) add(LABELS[type][0], `0行动 · ${LABELS[type][1]}`, { type, caseId: id } as DeceitMentorActivityCommand);
        if (!a.stopped && !next.includes('STOP_CONTACT')) add(LABELS.STOP_CONTACT[0], '0行动 · 1秒 · 须实际归还', { type: 'STOP_CONTACT', caseId: id });
      }
    }
  } else if (!l.reflected) add('反思三份有限欺瞒报告', '1行动 · 扮演25', { type: 'REFLECT' });
  return out;
}
function observations(a: DeceitMentorAttempt | undefined): string[] {
  if (!a) return [];
  const out = [`本次${a.elapsedSeconds}秒，本人普通${a.playerTravelMetres}米，巴兹尔普通${a.witnessTravelMetres}米，实耗${a.spiritualitySpent}灵性。`, `原主本案许可${a.ownerConsent}，巴兹尔本案许可${a.witnessConsent}；随机检验从不替代同意。`];
  if (a.abilityTier) out.push(`唯一能力检验${a.abilityTier}，不重骰、不退资源。`);
  if (a.lampLit) out.push(`同一原灯已耗唯一油${a.lampOilSpent}，原备用蜡烛实耗${a.candleSpent}；${a.plateRead ? `已用${a.plateReadBy === 'LAMP' ? '原灯' : '原蜡烛'}24秒核原铭牌` : '尚未核读'}。`);
  if (a.tagReleased) out.push(`同一原轻纸签已真实松手；${a.tagRead ? `在${a.tagReadWhile === 'AIR' ? '有限迟落空中' : '本人手中'}核原编号5秒` : '尚未核号'}；${a.tagRecovered ? '已经从原毡盘拾起' : '尚未从原盘拾回'}。`);
  if (a.cardRead) out.push(`演练前原卡真实${a.originalFace}；当时观察${a.observedFaceBeforeCorrection ?? '普通核验，未施欺瞒'}${a.abilityTier && !success(a.abilityTier) ? '（已经识破）' : ''}。`);
  if (a.correctionMade) out.push(`保留旧观察并明确纠正/确认：当时真实${a.correctedOriginalFace}，普通翻面后现在真实${a.verifiedFace}。不把曾经误判保存为长期真相。`);
  if (a.stopped) out.push('已停止工作；实际原位置、原物、原消耗和应完成的纠正不撤销。');
  return out;
}
export function projectDeceitMentorLife(s: SliceState): DeceitMentorLifeProjection {
  const l = s.deceitMentor.life, actions = deceitMentorLifeActions(s), next = actions.find(a => a.enabled) ?? actions[0];
  return { ...structuredClone(l), title: '欺瞒导师·错误序列3（有限原物欺瞒G）', story: DECEIT_MENTOR_LIFE_STORY,
    environment: 'DM3-WORKSHOP原OPEN干廊：START→BENCH6米、BENCH→CABINET4米、START→CABINET10米，普通步行1米/秒。伊迪丝43岁在START，巴兹尔39岁从BENCH自愿赴原卡现场再原路返。原灯、原纸签、原卡各唯一；原铭牌和原毡盘留BENCH，原夹框留CABINET。所有场景和定量均为原创G。',
    nextStep: next ? `下一步：${next.label}${next.enabled ? '' : `；${next.reason}`}` : l.reflected ? '三案已报告并完成反思，原物与观察记录保留。' : '须先真实晋升欺瞒导师。',
    inside: hasDeceitMentorLifeLock(s), insideCase: hasDeceitMentorLifeLock(s), currentAttempt: structuredClone(currentAttempt(s)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: observations(r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '本案尚未完成，原位置和成本保留。' : r.result === 'ABILITY' ? '有限能力实际成功，归还并报告才计掌握。' : '普通完成、失败后核验或尊重拒绝，不加能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions };
}
/** Replay the small scene trace to reject invented originals, refilled oil, false consent and remote returns. */
export function validateDeceitMentorLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.deceitMentor?.life, initial = createDeceitMentorLifeState(), promotion = s.deceitMentor?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, DECEIT_MENTOR_CASE_IDS)) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  const combatSeconds = s.combatHistory.reduce((sum, round) => sum + (round.deceitMentorOutcome?.elapsedSeconds ?? 0), 0);
  if (!integer(promotion, 1, s.week) || l.siteId !== initial.siteId || typeof l.reflected !== 'boolean' || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || !integer(combatSeconds) || !['START', 'BENCH', 'CABINET'].includes(l.playerLocation) || l.activeCase !== null && !DECEIT_MENTOR_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['edith', 'basil', 'lamp', 'candle', 'plate', 'tag', 'tray', 'card', 'frame', 'door'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (typeof l.edith.willing !== 'boolean' || stableStringify(l.edith) !== stableStringify({ ...initial.edith, willing: l.edith.willing })) return false;
  if (typeof l.basil.willing !== 'boolean' || !integer(l.basil.travelMetres) || !['BENCH', 'CABINET'].includes(l.basil.location) || stableStringify(l.basil) !== stableStringify({ ...initial.basil, willing: l.basil.willing, location: l.basil.location, travelMetres: l.basil.travelMetres })) return false;
  for (const key of ['plate', 'tray', 'frame', 'door'] as const) if (stableStringify(l[key]) !== stableStringify(initial[key])) return false;
  if (s.seer.completedSources.filter(source => source === 'deceit-mentor-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify({ ...initial, clockSeconds: combatSeconds });
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['spent-lamp'].observedWeek !== l.introducedWeek) return false;
  const replay = createDeceitMentorLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, activeEvent: null, combat: null, deceitMentor: { ...s.deceitMentor, life: replay } };
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of DECEIT_MENTOR_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[DECEIT_MENTOR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++;
      replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.mind = a.initialMind; shadow.spirituality = a.initialSpirituality;
    const expected = freshAttempt(shadow, a.method);
    replay.activeCase = id; replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [expected], status: 'ACTIVE', contactOpen: true, closes: 0, returned: false };
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'edithWilling', 'basilWilling']) || typeof step.edithWilling !== 'boolean' || typeof step.basilWilling !== 'boolean' || !ABILITY_STEPS.includes(step.type) && step.tier !== null || ABILITY_STEPS.includes(step.type) && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'REFLECT'].includes(step.type) || !validateDeceitMentorActivityCommand({ type: step.type, caseId: id })) return false;
      replay.edith.willing = step.edithWilling; replay.basil.willing = step.basilWilling;
      if (sceneReason(shadow, id, step.type)) return false;
      applyScene(shadow, id, step);
    }
    if (a.closed) {
      if (!expected.inspected || cleanupBlock(shadow)) return false;
      expected.closed = true; expected.ownerConsent = expected.witnessConsent = 'CLOSED'; replay.activeCase = null;
    }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== (a.closed ? 1 : 0) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') {
      open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE') return false;
    } else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') resolved++;
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.edith.willing = l.edith.willing; replay.basil.willing = l.basil.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !hasHistory(s) || (s.progression.sequence === 2 ? s.fateTrojan.deceitMentorActingAtPromotion : s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
