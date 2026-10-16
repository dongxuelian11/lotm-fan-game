import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasSecretsSorcererLifeLock } from '../secrets-sorcerer/life.js';
import { hasSecretsSorcererRitualLock } from '../secrets-sorcerer/ritual.js';
import { hasSecretsSorcererOldPractice } from '../secrets-sorcerer/index.js';

export const WANDERER_CASE_IDS = ['anchor-check', 'offworld-visit', 'original-handoff'] as const;
export type WandererCaseId = typeof WANDERER_CASE_IDS[number];
export type WandererLocation = 'START' | 'PAD' | 'OFFICE' | 'REMOTE';
export type WandererConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
type Common = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'GO_SITE' | 'RETURN_PLAYER' | 'STOP_CONTACT' | 'INSPECT' | 'GO_ANCHOR' | 'RECOVER_ANCHOR' | 'RETURN_ANCHOR' | 'RETURN_PACKET';
type AnchorCommand = 'TAKE_ANCHOR' | 'PLACE_ANCHOR' | 'READ_COORDINATES' | 'ALIGN_ANCHOR' | 'MANUAL_ALIGN';
type VisitCommand = 'BORROW_SUIT' | 'CHECK_SUIT' | 'CHECK_DEPARTURE' | 'CHECK_RETURN_MARKER' | 'TAKE_PACKET' | 'RETURN_LOCAL' | 'RETURN_SUIT' | 'WAIT_EXPOSURE';
type HandoffCommand = 'CONSENT_RECIPIENT' | 'CHECK_PACKET_RECORDS' | 'COMPARE_RECORDS' | 'MANUAL_COMPARE' | 'HAND_PACKET' | 'FILE_NONRETURN';
export type WandererActivityCommand =
  | { type: Common; caseId: WandererCaseId }
  | { type: AnchorCommand; caseId: 'anchor-check' }
  | { type: VisitCommand; caseId: 'offworld-visit' }
  | { type: HandoffCommand; caseId: 'original-handoff' }
  | { type: 'DEPART' | 'VIEW_HORIZON'; caseId: 'offworld-visit'; confirm: true }
  | { type: 'PREPARE'; caseId: WandererCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
type SceneType = Exclude<WandererActivityCommand['type'], 'OBSERVE' | 'PREPARE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'REFLECT'>;
export interface WandererMovement { from: WandererLocation; to: WandererLocation; mode: 'WALK' | 'STAR_WANDERING'; metres: number | null; seconds: number; anchorCarried: boolean; suitCarried: boolean; packetCarried: boolean }
export interface WandererLifeStep { type: SceneType; tier: PublicResolutionTier | null; noraWilling: boolean; eliasWilling: boolean }
export interface WandererAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialHealth: number; initialMind: number; initialSpirituality: number; initialPollution: number;
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: WandererMovement[]; steps: WandererLifeStep[];
  spiritualitySpent: number; energySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: WandererConsent; ownerConsentWeek: number | null; recipientConsent: WandererConsent; recipientConsentWeek: number | null;
  siteVisited: boolean; stopped: boolean; inspected: boolean; playerReturned: boolean;
  anchorTaken: boolean; anchorPlaced: boolean; coordinatesRead: boolean; anchorCalibrated: boolean; manualAlignment: boolean;
  suitBorrowed: boolean; suitChecked: boolean; departureChecked: boolean; departureConfirmed: boolean; departed: boolean; failedDeparture: boolean;
  returnMarkerChecked: boolean; packetTaken: boolean; returnedLocal: boolean; suitReturned: boolean; remoteSeconds: number; horizonViewed: boolean;
  exposureActions: number; healthLost: number; mindLost: number; pollutionAdded: number; packetRecordsChecked: boolean; recordsCompared: boolean; manualComparison: boolean;
  packetHanded: boolean; nonreturnFiled: boolean; packetReturned: boolean; anchorRecovered: boolean; anchorReturned: boolean;
}
export interface WandererCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: WandererAttempt[];
}
export interface WandererLifeState {
  siteId: 'WN3-WORKSHOP'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: WandererCaseId | null;
  playerLocation: WandererLocation; playerTravelMetres: number; clockSeconds: number;
  nora: { id: 'WN3-NORA'; name: '诺拉·维恩'; age: 41; alive: true; willing: boolean; location: 'START' };
  elias: { id: 'WN3-ELIAS'; name: '埃利亚斯·诺特'; age: 37; alive: true; willing: boolean; location: 'OFFICE' };
  anchor: { id: 'WN3-ANCHOR'; owner: 'WN3-NORA'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'PAD'; status: 'UNCHECKED' | 'CALIBRATED'; travelMetres: number };
  suit: { id: 'WN3-SUIT'; owner: 'WN3-NORA'; quantity: 1; location: 'OWNER' | 'PLAYER'; protectionSeconds: number; remoteSeconds: number; travelMetres: number; offworldLegs: number };
  packet: { id: 'WN3-PACKET'; owner: 'WN3-NORA'; quantity: 1; location: 'REMOTE' | 'PLAYER' | 'OWNER_ARCHIVE' | 'OWNER'; sealed: true; source: 'PRIOR_RECORDED_DELIVERY'; travelMetres: number; offworldLegs: number };
  energy: { id: 'WN3-ENERGY'; remaining: number; spent: number };
  endpoints: { localId: 'WN3-PAD'; remoteId: 'WN3-REMOTE-DOCK'; coordinateSource: 'HESTER_ARCHIVE_G'; localIntact: true; remoteSignal: true; remoteReturnMarkerIntact: true; occupants: 0 };
  door: { id: 'WN3-DOOR'; state: 'OPEN' };
  cases: Record<WandererCaseId, WandererCaseState>; reflected: boolean;
}
export interface WandererLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WandererActivityCommand }
export interface WandererLifeProjection extends Omit<WandererLifeState, 'cases'> {
  title: string; story: string; environment: string; inside: boolean; insideCase: boolean; currentAttempt: WandererAttempt | null;
  cases: { id: WandererCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: WandererAttempt[] }[];
  actions: WandererLifeAction[];
}
export const WANDERER_LIFE_STORY = '漫游者·门序列3可脱离灵界限制进入星空/星界/异星，是已核方向；天使以下面对星空仍有污染危险。以下指定停泊舱、原护具90秒、原能量片、固定坐标、检查与返回条件及全部定量均为本作原创G，非真空免疫、任意坐标或绝境必返。观察、准备、实施、报告各1行动，准备须余2行动；现场0行动仍实耗秒、米与原资源，不推进周。三报告各扮演25、反思25，共13行动。能力成功实际作用并报告才给对应掌握8；失败或尊重边界普通收口不加掌握。';
const CASES = [
  { id: 'anchor-check', title: 'G · 同一原航标与当前坐标册', story: '向START的诺拉41岁取得本案许可，拿同一WN3-ANCHOR普通4米到PAD放置，读取导师档案原坐标册与原航标刻号。一次6灵性/知识18只加快核对两已有记录，失败可用20秒人工核实。本人普通4米回START；原锚真实留PAD，尚未归原主。' },
  { id: 'offworld-visit', title: 'G · 本体有限离世，带同一原封包返回', story: '重新取得诺拉许可并借同一原护具，检查90秒原防护，再普通4米到PAD核当前舱信号、已校原回程锚和两原片。出发独立确认污染与预算，须18灵性；8灵性/片1/知识20成功才将同一身体10秒移到固定WN3-REMOTE-DOCK，失败仍PAD但成本保留、精神−5/污染+2。原封包本就在那里，属于诺拉。远处核回程标记5秒、取原包3秒，可不看天空；回程8灵性/片1、10秒实际回PAD，无第二次随机障碍。普通4米回START归原护具。' },
  { id: 'original-handoff', title: 'G · 原封包真实归档，原锚真实归还', story: '本案另问诺拉，携原包普通10米到OFFICE，埃利亚斯37岁当面愿接，核原封条与本次实际出返记录。一次6灵性/知识18比对已有坐标时间，失败人工20秒；接同一原包后留OWNER_ARCHIVE。若未往或失败，只登记真实未取回，原包仍REMOTE。本人普通10米回START，再4米到PAD收同一原锚、4米回START交诺拉，才关闭本次许可。' },
] as const;
const COMMON: readonly string[] = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'GO_SITE', 'RETURN_PLAYER', 'STOP_CONTACT', 'INSPECT', 'GO_ANCHOR', 'RECOVER_ANCHOR', 'RETURN_ANCHOR', 'RETURN_PACKET'];
const SPECIFIC: Record<WandererCaseId, readonly string[]> = { 'anchor-check': ['TAKE_ANCHOR', 'PLACE_ANCHOR', 'READ_COORDINATES', 'ALIGN_ANCHOR', 'MANUAL_ALIGN'], 'offworld-visit': ['BORROW_SUIT', 'CHECK_SUIT', 'CHECK_DEPARTURE', 'CHECK_RETURN_MARKER', 'TAKE_PACKET', 'RETURN_LOCAL', 'RETURN_SUIT', 'WAIT_EXPOSURE'], 'original-handoff': ['CONSENT_RECIPIENT', 'CHECK_PACKET_RECORDS', 'COMPARE_RECORDS', 'MANUAL_COMPARE', 'HAND_PACKET', 'FILE_NONRETURN'] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
const freshCase = (): WandererCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): WandererAttempt {
  return { week: s.week, method, closed: false, result: 'NONE', initialHealth: s.health, initialMind: s.mind, initialSpirituality: s.spirituality, initialPollution: s.seer.pollution,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, energySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, recipientConsent: 'UNASKED', recipientConsentWeek: null,
    siteVisited: false, stopped: false, inspected: false, playerReturned: false, anchorTaken: false, anchorPlaced: false, coordinatesRead: false, anchorCalibrated: false, manualAlignment: false,
    suitBorrowed: false, suitChecked: false, departureChecked: false, departureConfirmed: false, departed: false, failedDeparture: false, returnMarkerChecked: false, packetTaken: false, returnedLocal: false, suitReturned: false,
    remoteSeconds: 0, horizonViewed: false, exposureActions: 0, healthLost: 0, mindLost: 0, pollutionAdded: 0, packetRecordsChecked: false, recordsCompared: false, manualComparison: false,
    packetHanded: false, nonreturnFiled: false, packetReturned: false, anchorRecovered: false, anchorReturned: false };
}
export function createWandererLifeState(): WandererLifeState {
  return { siteId: 'WN3-WORKSHOP', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    nora: { id: 'WN3-NORA', name: '诺拉·维恩', age: 41, alive: true, willing: true, location: 'START' }, elias: { id: 'WN3-ELIAS', name: '埃利亚斯·诺特', age: 37, alive: true, willing: true, location: 'OFFICE' },
    anchor: { id: 'WN3-ANCHOR', owner: 'WN3-NORA', quantity: 1, location: 'OWNER', status: 'UNCHECKED', travelMetres: 0 },
    suit: { id: 'WN3-SUIT', owner: 'WN3-NORA', quantity: 1, location: 'OWNER', protectionSeconds: 90, remoteSeconds: 0, travelMetres: 0, offworldLegs: 0 },
    packet: { id: 'WN3-PACKET', owner: 'WN3-NORA', quantity: 1, location: 'REMOTE', sealed: true, source: 'PRIOR_RECORDED_DELIVERY', travelMetres: 0, offworldLegs: 0 }, energy: { id: 'WN3-ENERGY', remaining: 2, spent: 0 },
    endpoints: { localId: 'WN3-PAD', remoteId: 'WN3-REMOTE-DOCK', coordinateSource: 'HESTER_ARCHIVE_G', localIntact: true, remoteSignal: true, remoteReturnMarkerIntact: true, occupants: 0 }, door: { id: 'WN3-DOOR', state: 'OPEN' },
    cases: { 'anchor-check': freshCase(), 'offworld-visit': freshCase(), 'original-handoff': freshCase() }, reflected: false };
}
export function validateWandererActivityCommand(v: unknown): v is WandererActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!WANDERER_CASE_IDS.includes(v.caseId as WandererCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'DEPART' || v.type === 'VIEW_HORIZON') return v.caseId === 'offworld-visit' && v.confirm === true && shape(v, ['type', 'caseId', 'confirm']);
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as WandererCaseId].includes(String(v.type)));
}
export const isWandererActivityCommand = validateWandererActivityCommand;
export const isWandererActivity = validateWandererActivityCommand;
const currentAttempt = (s: SliceState) => s.wanderer.life.activeCase ? s.wanderer.life.cases[s.wanderer.life.activeCase].attempts.at(-1) ?? null : null;
const distance = (from: WandererLocation, to: WandererLocation) => from === to ? 0 : from === 'REMOTE' || to === 'REMOTE' ? null : from === 'START' || to === 'START' ? from === 'OFFICE' || to === 'OFFICE' ? 10 : 4 : 6;
function cleanupBlock(s: SliceState, id: WandererCaseId): string | null {
  const l = s.wanderer.life;
  if (l.playerLocation !== 'START') return l.playerLocation === 'REMOTE' ? '同一身体仍在异星原舱；必须实耗回程资源RETURN_LOCAL，普通退出不会传回。' : '本人须实际沿原干廊返回START。';
  if (l.suit.location !== 'OWNER') return '须在START归还同一原护具，余量不回填。';
  if (l.anchor.location === 'PLAYER' || l.anchor.location === 'PAD' && (id === 'original-handoff' || l.anchor.status !== 'CALIBRATED')) return '须本人实际到PAD取同一原锚，再走回START交诺拉。';
  if (id === 'original-handoff' && l.packet.location === 'PLAYER') return '原包须实际交档案员，或在START普通退还诺拉。';
  return null;
}
export const hasWandererLifeLock = (s: SliceState): boolean => s.wanderer.life.activeCase !== null || Object.values(s.wanderer.life.cases).some(r => r.status === 'PREPARED') || s.wanderer.life.playerLocation !== 'START' || s.wanderer.life.suit.location === 'PLAYER' || s.wanderer.life.anchor.location === 'PLAYER';
export const wandererInside = hasWandererLifeLock;
const ownerConsents = (s: SliceState, a: WandererAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.wanderer.life.nora.willing && !a.stopped;
function sceneReason(s: SliceState, id: WandererCaseId, type: SceneType): string | null {
  const l = s.wanderer.life, a = l.cases[id].attempts.at(-1)!;
  if (s.health <= 0 || s.status === 'DEAD') return '身体已经死亡，原位置和原物保留；不能退出复活。';
  if (a.inspected) return '已检查现场，只可关闭。';
  if (type === 'STOP_CONTACT') return a.stopped ? '本次已停止，仍须真实返回与归还。' : null;
  if (type === 'RETURN_LOCAL') return l.playerLocation === 'REMOTE' && a.departed && !a.returnedLocal && a.returnMarkerChecked && l.anchor.location === 'PAD' && l.anchor.status === 'CALIBRATED' && l.endpoints.localIntact && l.endpoints.remoteReturnMarkerIntact && l.energy.remaining >= 1 && s.spirituality >= 8 ? null : '须本体仍在REMOTE、已核原回程标记、原PAD锚真实存在、剩原片1及8灵性；不能普通传回或补资源。';
  if (type === 'CHECK_RETURN_MARKER') return l.playerLocation === 'REMOTE' && a.departed && !a.returnMarkerChecked && l.endpoints.remoteReturnMarkerIntact ? null : '须本人实际在原舱，核同一原回程标记5秒。';
  if (type === 'RETURN_PLAYER') return l.playerLocation !== 'START' && l.playerLocation !== 'REMOTE' && l.door.state === 'OPEN' ? null : '只可从本地PAD或OFFICE沿真实普通干廊回START，异星没有普通回城出口。';
  if (type === 'RETURN_SUIT') return l.playerLocation === 'START' && l.suit.location === 'PLAYER' ? null : '须本人和同一原护具实际回到诺拉所在START。';
  if (type === 'GO_ANCHOR') return l.playerLocation === 'START' && l.anchor.location === 'PAD' && l.door.state === 'OPEN' && (id === 'original-handoff' || a.stopped) ? null : '须最终归还或已停止本案，原锚仍在PAD，本人才沿4米干廊去取。';
  if (type === 'RECOVER_ANCHOR') return l.playerLocation === 'PAD' && l.anchor.location === 'PAD' && (id === 'original-handoff' || a.stopped) ? null : '本人须到PAD，从原地收同一原锚；异星不能远距取回。';
  if (type === 'RETURN_ANCHOR') return l.playerLocation === 'START' && l.anchor.location === 'PLAYER' ? null : '须本人携原锚真实回START，当面交诺拉。';
  if (type === 'RETURN_PACKET') return l.playerLocation === 'START' && l.packet.location === 'PLAYER' && a.stopped ? null : '停止后本人须携同一原包真实回START，才可普通退还原主。';
  if (type === 'INSPECT') return cleanupBlock(s, id) ?? (a.result !== 'NONE' || a.stopped || a.ownerConsent === 'DECLINED' || a.recipientConsent === 'DECLINED' ? null : '尚未完成或停止本次工作，请按真实结果收口。');
  if (type === 'CONSENT_OWNER') return l.playerLocation === 'START' && a.ownerConsent === 'UNASKED' && !a.stopped ? null : '须START的同一诺拉当面回答本案许可，旧案同意不延续。';
  if (!ownerConsents(s, a)) return '缺少本案当前有效许可，或已停止；仍可核回程、实际返回及普通归还。';
  if (type === 'GO_SITE') return !a.siteVisited && l.playerLocation === 'START' && l.door.state === 'OPEN' && (id !== 'anchor-check' || l.anchor.location === 'PLAYER') && (id !== 'offworld-visit' || a.suitChecked) ? null : '须从START首次沿原路到本案现场，先准备实际要带的原锚或检查已借原护具。';
  if (type === 'TAKE_ANCHOR') return l.playerLocation === 'START' && l.anchor.location === 'OWNER' && !a.anchorTaken ? null : '须诺拉尚持唯一原航标，不能复制或重复领取。';
  if (type === 'PLACE_ANCHOR') return l.playerLocation === 'PAD' && l.anchor.location === 'PLAYER' && !a.anchorPlaced ? null : '须本人实际将同一原锚带到PAD才能放置。';
  if (type === 'READ_COORDINATES') return l.playerLocation === 'PAD' && l.anchor.location === 'PAD' && a.anchorPlaced && !a.coordinatesRead ? null : '须PAD的同一原航标已放好，才读导师档案原册与原刻号。';
  if (type === 'MANUAL_ALIGN') return l.playerLocation === 'PAD' && a.coordinatesRead && !a.anchorCalibrated ? null : '须读过两原记录且尚未校准，普通20秒逐项核对。';
  if (type === 'BORROW_SUIT') return l.playerLocation === 'START' && l.suit.location === 'OWNER' && !a.suitBorrowed ? null : '只借诺拉持有的同一原护具一次，不补充防护。';
  if (type === 'CHECK_SUIT') return l.playerLocation === 'START' && l.suit.location === 'PLAYER' && a.suitBorrowed && !a.suitChecked ? null : '须在原主面前检查已经借出的同一原护具。';
  if (type === 'CHECK_DEPARTURE') return l.playerLocation === 'PAD' && a.suitChecked && !a.departureChecked && l.anchor.location === 'PAD' && l.anchor.status === 'CALIBRATED' && l.endpoints.localIntact && l.endpoints.remoteSignal && l.energy.remaining === 2 && l.suit.protectionSeconds === 90 ? null : '须PAD当前原舱信号、已校原回程锚、两原片与原护具90秒均在场，原记录不证明宇宙普遍安全。';
  if (type === 'DEPART') {
    if (a.method !== 'ABILITY' || a.abilityTier !== null || a.departureConfirmed) return '本案只一次出程检验；普通方法可选择不前往，失败不退资源或重骰。';
    if (l.playerLocation !== 'PAD' || !a.departureChecked || !a.suitChecked || l.suit.location !== 'PLAYER' || l.suit.protectionSeconds !== 90 || l.energy.remaining !== 2 || l.anchor.location !== 'PAD' || l.anchor.status !== 'CALIBRATED' || !l.endpoints.remoteSignal || !l.endpoints.localIntact) return '当前离世准备条件已不成立，不读取失效的旧安全结论。';
    return s.spirituality >= 18 && s.mind > 0 && !s.injuries.some(x => x.severity === 'HEAVY' && x.treatedRevision === null) ? null : '出发须至少18灵性、清醒且无未处理重伤；8灵性出程后保留真实8灵性回程。';
  }
  if (type === 'TAKE_PACKET') return l.playerLocation === 'REMOTE' && a.returnMarkerChecked && l.packet.location === 'REMOTE' && !a.packetTaken ? null : '须本人实到原舱、核回程标记，才取此前留在此处的同一原封包。';
  if (type === 'VIEW_HORIZON') return l.playerLocation === 'REMOTE' && !a.horizonViewed ? null : '仅在REMOTE可独立确认一次望向异常天际；可完全不看，无额外奖励。';
  if (type === 'WAIT_EXPOSURE') return l.playerLocation === 'REMOTE' ? null : '只有本人实在REMOTE才消耗异星暴露时间。';
  if (type === 'CONSENT_RECIPIENT') return l.playerLocation === 'OFFICE' && a.recipientConsent === 'UNASKED' ? null : '须本人走到OFFICE问同一埃利亚斯本次是否愿受理。';
  if (type === 'CHECK_PACKET_RECORDS') return l.playerLocation === 'OFFICE' && a.recipientConsent === 'GRANTED' && l.elias.willing && !a.packetRecordsChecked ? null : '须OFFICE的埃利亚斯本次愿受理，才核实际封包状态与此前出返记录。';
  if (type === 'FILE_NONRETURN') return l.playerLocation === 'OFFICE' && a.packetRecordsChecked && a.recipientConsent === 'GRANTED' && l.elias.willing && l.packet.location !== 'PLAYER' && l.packet.location !== 'OWNER_ARCHIVE' && !a.nonreturnFiled ? null : '只为真实未交档的原包登记原去向，不能生成原包或假称送达。';
  if (type === 'MANUAL_COMPARE' || type === 'HAND_PACKET' || type === 'COMPARE_RECORDS') {
    const visit = l.cases['offworld-visit'].attempts.at(-1);
    if (l.playerLocation !== 'OFFICE' || a.recipientConsent !== 'GRANTED' || !l.elias.willing || l.packet.location !== 'PLAYER' || !a.packetRecordsChecked || !visit?.departed || !visit.returnedLocal || !visit.packetTaken) return '须同一原包确由本体带返、实在OFFICE，埃利亚斯当前愿接，且已检查真实出返记录。';
    if (type === 'HAND_PACKET') return a.recordsCompared && !a.packetHanded ? null : '先实际比对已有坐标时间记录，才交同一原封包。';
    if (a.recordsCompared) return '两实际记录已经比对。';
    if (type === 'MANUAL_COMPARE') return null;
  }
  if (type === 'ALIGN_ANCHOR' || type === 'COMPARE_RECORDS') {
    if (a.method !== 'ABILITY' || a.abilityTier !== null) return '本案只一次6灵性定位检验，失败改普通核对，不重骰。';
    if (type === 'ALIGN_ANCHOR' && (l.playerLocation !== 'PAD' || !a.coordinatesRead || a.anchorCalibrated || l.anchor.location !== 'PAD')) return '须PAD的原锚和两已读原记录；不能从空白处获知任意星空坐标。';
    return s.spirituality >= 6 && s.mind > 0 ? null : '本次定位需要6灵性和清醒；人工核对与本地退出仍可0灵性。';
  }
  return '当前原人原物条件不满足，可停止后真实收口。';
}
export function blockWandererLife(s: SliceState, c: WandererActivityCommand): string | null {
  if (!validateWandererActivityCommand(c)) return '漫游者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已真实晋升漫游者序列3；死亡不提供回城或复活。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.wanderer.encounter.status)) return '先结束当前事件或新遭遇；不能覆盖原身体位置。';
  const l = s.wanderer.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (r?.contactOpen && 'caseId' in c && l.activeCase === c.caseId) {
    const a = r.attempts.at(-1)!;
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return a.inspected ? cleanupBlock(s, c.caseId) : '先真实返回、归还必要原物并INSPECT。';
    if (!['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT'].includes(c.type)) return sceneReason(s, c.caseId, c.type as SceneType);
    return '当前现场尚未真实关闭。';
  }
  if (hasWandererLifeLock(s) && !(c.type === 'PERFORM' && r?.status === 'PREPARED')) return '先实施或取消已付准备，或真实退出当前现场。';
  if (s.world.city !== 'BACKLUND') return '须本人真实在贝克兰德工坊，不可从远处操作原物。';
  if (hasSecretsSorcererLifeLock(s) || hasSecretsSorcererRitualLock(s) || hasSecretsSorcererOldPractice(s) || s.wanderer.preparedWeek !== null) return '先结束旧门途径原现场和服药准备，不能覆盖历史。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '本项需要清醒和1行动；已开放本地现场的普通收口不耗行动或灵性。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成三案反思。' : WANDERER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '须先提交三份真实报告。';
  if (!r || !('caseId' in c)) return '没有对应实践。';
  const i = WANDERER_CASE_IDS.indexOf(c.caseId);
  if (i > 0 && l.cases[WANDERER_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先报告上一案真实结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已观察，不重置原物。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案，原现场只实施一次。' : s.actionsRemaining < 2 ? '准备时须至少余2行动，留1行动实施。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须先实际收口并关闭，报告不能把身体传回。';
  return '没有本次开放现场。';
}
export const blockWandererActivity = blockWandererLife;
function loseMind(s: SliceState, a: WandererAttempt, amount: number) { const lost = Math.min(s.mind, amount); s.mind -= lost; a.mindLost += lost; }
function addPollution(s: SliceState, a: WandererAttempt, amount: number) { s.seer.pollution = Math.min(100, s.seer.pollution + amount); a.pollutionAdded += amount; }
function elapse(s: SliceState, a: WandererAttempt, seconds: number) {
  const l = s.wanderer.life; a.elapsedSeconds += seconds; l.clockSeconds += seconds;
  if (l.playerLocation === 'REMOTE') {
    const available = l.suit.protectionSeconds; l.suit.protectionSeconds = Math.max(0, available - seconds); l.suit.remoteSeconds += seconds; a.remoteSeconds += seconds;
    if (seconds > available) { const lost = Math.min(s.health, 15); s.health -= lost; a.healthLost += lost; loseMind(s, a, 5); a.exposureActions++; if (s.health === 0) s.status = 'DEAD'; }
  }
}
function move(s: SliceState, a: WandererAttempt, to: WandererLocation, mode: WandererMovement['mode']) {
  const l = s.wanderer.life, from = l.playerLocation, metres = mode === 'WALK' ? distance(from, to)! : null, seconds = mode === 'WALK' ? metres! : 10;
  const movement: WandererMovement = { from, to, mode, metres, seconds, anchorCarried: l.anchor.location === 'PLAYER', suitCarried: l.suit.location === 'PLAYER', packetCarried: l.packet.location === 'PLAYER' };
  a.playerMoves.push(movement); elapse(s, a, seconds);
  // A player who dies during an exposed return remains in the actual remote dock.
  if (s.health === 0 && from === 'REMOTE') { a.playerMoves.pop(); return; }
  l.playerLocation = to;
  if (mode === 'WALK') {
    a.playerTravelMetres += metres!; l.playerTravelMetres += metres!;
    if (movement.anchorCarried) l.anchor.travelMetres += metres!; if (movement.suitCarried) l.suit.travelMetres += metres!; if (movement.packetCarried) l.packet.travelMetres += metres!;
  } else { if (movement.suitCarried) l.suit.offworldLegs++; if (movement.packetCarried) l.packet.offworldLegs++; }
}
function spend(s: SliceState, a: WandererAttempt, spirituality: number, energy = 0) { s.spirituality -= spirituality; a.spiritualitySpent += spirituality; s.wanderer.life.energy.remaining -= energy; s.wanderer.life.energy.spent += energy; a.energySpent += energy; }
function result(s: SliceState, id: WandererCaseId, value: 'ABILITY' | 'ORDINARY') { s.wanderer.life.cases[id].result = value; s.wanderer.life.cases[id].attempts.at(-1)!.result = value; }
/** One deterministic reducer is used both by live actions and by save validation of their original trace. */
function applyScene(s: SliceState, id: WandererCaseId, step: WandererLifeStep): void {
  const l = s.wanderer.life, a = l.cases[id].attempts.at(-1)!, type = step.type;
  a.steps.push({ ...step });
  switch (type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.nora.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; elapse(s, a, 2); break;
    case 'STOP_CONTACT': a.stopped = true; elapse(s, a, 1); break;
    case 'GO_SITE': a.siteVisited = true; move(s, a, id === 'original-handoff' ? 'OFFICE' : 'PAD', 'WALK'); break;
    case 'RETURN_PLAYER': move(s, a, 'START', 'WALK'); a.playerReturned = true; break;
    case 'TAKE_ANCHOR': l.anchor.location = 'PLAYER'; a.anchorTaken = true; elapse(s, a, 1); break;
    case 'PLACE_ANCHOR': l.anchor.location = 'PAD'; a.anchorPlaced = true; elapse(s, a, 2); break;
    case 'READ_COORDINATES': a.coordinatesRead = true; elapse(s, a, 3); break;
    case 'ALIGN_ANCHOR':
      spend(s, a, 6); a.abilityTier = step.tier; elapse(s, a, 2);
      if (success(step.tier)) { a.anchorCalibrated = true; l.anchor.status = 'CALIBRATED'; result(s, id, 'ABILITY'); } break;
    case 'MANUAL_ALIGN': a.manualAlignment = true; a.anchorCalibrated = true; l.anchor.status = 'CALIBRATED'; elapse(s, a, 20); result(s, id, 'ORDINARY'); break;
    case 'BORROW_SUIT': l.suit.location = 'PLAYER'; a.suitBorrowed = true; elapse(s, a, 2); break;
    case 'CHECK_SUIT': a.suitChecked = true; elapse(s, a, 5); break;
    case 'CHECK_DEPARTURE': a.departureChecked = true; elapse(s, a, 5); break;
    case 'DEPART':
      spend(s, a, 8, 1); a.abilityTier = step.tier; a.departureConfirmed = true;
      if (success(step.tier)) { a.departed = true; move(s, a, 'REMOTE', 'STAR_WANDERING'); }
      else { a.failedDeparture = true; elapse(s, a, 10); loseMind(s, a, 5); addPollution(s, a, 2); } break;
    case 'CHECK_RETURN_MARKER': elapse(s, a, 5); if (s.health > 0) a.returnMarkerChecked = true; break;
    case 'TAKE_PACKET': elapse(s, a, 3); if (s.health > 0) { l.packet.location = 'PLAYER'; a.packetTaken = true; } break;
    case 'VIEW_HORIZON': a.horizonViewed = true; elapse(s, a, 2); loseMind(s, a, 6); addPollution(s, a, 3); break;
    case 'WAIT_EXPOSURE': elapse(s, a, 10); break;
    case 'RETURN_LOCAL': spend(s, a, 8, 1); move(s, a, 'PAD', 'STAR_WANDERING'); if (l.playerLocation === 'PAD') { a.returnedLocal = true; result(s, id, 'ABILITY'); } break;
    case 'RETURN_SUIT': l.suit.location = 'OWNER'; a.suitReturned = true; elapse(s, a, 2); break;
    case 'CONSENT_RECIPIENT': a.recipientConsent = l.elias.willing ? 'GRANTED' : 'DECLINED'; a.recipientConsentWeek = s.week; elapse(s, a, 2); break;
    case 'CHECK_PACKET_RECORDS': a.packetRecordsChecked = true; elapse(s, a, 4); break;
    case 'COMPARE_RECORDS': spend(s, a, 6); a.abilityTier = step.tier; elapse(s, a, 2); if (success(step.tier)) a.recordsCompared = true; break;
    case 'MANUAL_COMPARE': a.manualComparison = true; a.recordsCompared = true; elapse(s, a, 20); break;
    case 'HAND_PACKET': l.packet.location = 'OWNER_ARCHIVE'; a.packetHanded = true; elapse(s, a, 2); result(s, id, success(a.abilityTier) && !a.manualComparison ? 'ABILITY' : 'ORDINARY'); break;
    case 'FILE_NONRETURN': a.nonreturnFiled = true; elapse(s, a, 3); result(s, id, 'ORDINARY'); break;
    case 'GO_ANCHOR': move(s, a, 'PAD', 'WALK'); break;
    case 'RECOVER_ANCHOR': l.anchor.location = 'PLAYER'; a.anchorRecovered = true; elapse(s, a, 2); break;
    case 'RETURN_ANCHOR': l.anchor.location = 'OWNER'; a.anchorReturned = true; elapse(s, a, 1); break;
    case 'RETURN_PACKET': l.packet.location = 'OWNER'; a.packetReturned = true; elapse(s, a, 1); break;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (a.result === 'NONE') result(s, id, 'ORDINARY'); break;
  }
}
export function applyWandererActivity(s: SliceState, c: WandererActivityCommand, ctx: SeerContext): void {
  const reason = blockWandererLife(s, c); if (reason) throw new Error(reason);
  const l = s.wanderer.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('wanderer-reflection'); ctx.note('G · 有限离世与返回边界的反思', '三份真实报告后扮演+25。原身体、原包、原锚与原护具各保实际去向，已耗防护/原片/灵性与污染不重置；不把本次有限准备宣称为真空免疫或任意坐标必返。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '本案一次有限能力' : '普通检查/不前往方案'}，尚未代替任何人的本次许可。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消未实施准备', '0行动，已付行动不退，原身体和原物没有移动。'); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动从START实施。每案独立同意；现场0行动仍耗真实秒数与原资源，可停止后按原物实际去向收口。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const ability = c.caseId === 'offworld-visit' ? 'door.s3.star-wandering' : 'door.s3.astral-positioning'; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); } ctx.note(definition.title, `真实报告扮演+25；${r.result === 'ABILITY' ? '对应能力实际成功并收口，掌握+8。' : '普通完成、未往或尊重拒绝，不加能力掌握。'}原资源和失败成本保留，不重复发奖。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = a.recipientConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('关闭已真实检查的本次现场', `本人实在START；原包${l.packet.location}、原锚${l.anchor.location}、原护具${l.suit.location}余${l.suit.protectionSeconds}秒、原片余${l.energy.remaining}。没有把异星未取原包写成送达，也没有重填资源。`); return; }
  const tier = ['ALIGN_ANCHOR', 'COMPARE_RECORDS', 'DEPART'].includes(c.type) ? ctx.check('knowledge', c.type === 'DEPART' ? 20 : 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, noraWilling: l.nora.willing, eliasWilling: l.elias.willing });
  const specifics: Partial<Record<SceneType, string>> = {
    DEPART: a.departed ? '同一身体及同一原护具10秒实际离开本地，到固定异星原舱；不以普通公里伪装星际距离，原包仍在舱内。' : '出程检验失败，身体仍在PAD；8灵性与原片1已耗，精神−5/污染+2，不给免费重试。',
    RETURN_LOCAL: a.returnedLocal ? '同一身体及随身原物10秒实际回PAD；8灵性/原片1真实支出，无第二随机障碍。尚须普通4米回START。' : '暴露转移中死亡，身体与随身原物实际留REMOTE；原返程资源已耗，不复活或自动回城。',
    VIEW_HORIZON: '独立确认后看异常天际2秒，精神−6/污染+3；可不看，没有额外奖励或万能知识。这是G外来异常，非现实症状。',
    WAIT_EXPOSURE: '真实等待10秒；只有原护具余量提供有限G防护，耗尽后的本次暴露伤害保留。',
    ALIGN_ANCHOR: '一次6灵性/知识18，只比对当前原册和原刻号；失败可人工20秒，不会凭空知道星空。',
    COMPARE_RECORDS: '一次6灵性/知识18，只比对这次真实出返坐标时间记录；失败人工20秒，不解密未知秘密。',
    FILE_NONRETURN: `归档真实未交包说明，原包仍在${l.packet.location}，不生成副本、不假称送达。`,
    RETURN_SUIT: '同一原护具回诺拉手中，耗去的防护时间不恢复。',
    RETURN_ANCHOR: '同一原锚由本人实际带回START交诺拉，保留原校准记录。',
  };
  ctx.note(`G · ${c.type}`, `${specifics[c.type as SceneType] ?? '按本人和同一原物的实际位置完成本步。'} 本体${l.playerLocation}；本案实际${a.elapsedSeconds}秒、普通${a.playerTravelMetres}米、灵性${a.spiritualitySpent}、原片${a.energySpent}；原护具余${l.suit.protectionSeconds}秒。`);
}
export function wandererLifeActions(s: SliceState): WandererLifeAction[] {
  const out: WandererLifeAction[] = [], l = s.wanderer.life;
  const add = (label: string, cost: string, command: WandererActivityCommand) => { const reason = blockWandererLife(s, command); out.push({ id: `wanderer-life-${'caseId' in command ? `${command.caseId}-` : ''}${command.type}`, label, cost, command, enabled: reason === null, reason }); };
  for (const definition of CASES) {
    const caseId = definition.id, r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add(`观察：${definition.title}`, '1行动', { type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') { add('准备一次有限能力方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method: 'ABILITY' }); add(caseId === 'offworld-visit' ? '准备普通检查，选择不前往' : '准备普通核对方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add('实施本次现场', '1行动', { type: 'PERFORM', caseId }); add('取消尚未实施准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId }); }
    if (r.status === 'EXAMINED') add('提交真实报告', '1行动 · 扮演25', { type: 'REPORT', caseId });
    if (!r.contactOpen || !a) continue;
    const step = (type: SceneType, label: string, cost: string) => add(label, cost, { type, caseId } as WandererActivityCommand);
    if (!a.inspected) {
      if (a.ownerConsent === 'UNASKED') step('CONSENT_OWNER', '当面问诺拉本案许可', '0行动 · 2秒');
      if (!a.siteVisited) step('GO_SITE', caseId === 'original-handoff' ? '本人普通10米到OFFICE' : '本人普通4米到PAD', caseId === 'original-handoff' ? '0行动 · 10米10秒' : '0行动 · 4米4秒');
      if (caseId === 'anchor-check') {
        if (!a.anchorTaken) step('TAKE_ANCHOR', '从诺拉手中取唯一原航标', '0行动 · 1秒');
        if (!a.anchorPlaced) step('PLACE_ANCHOR', '在PAD放同一原航标', '0行动 · 2秒');
        if (!a.coordinatesRead) step('READ_COORDINATES', '读原坐标册和原锚刻号', '0行动 · 3秒');
        if (!a.anchorCalibrated) { if (a.method === 'ABILITY' && a.abilityTier === null) step('ALIGN_ANCHOR', '星界定位G：加快核读已有两记录', '0行动 · 6灵性 · 知识18 · 2秒'); step('MANUAL_ALIGN', '逐项人工核对原两记录', '0行动 · 20秒'); }
      }
      if (caseId === 'offworld-visit') {
        if (!a.suitBorrowed) step('BORROW_SUIT', '借诺拉唯一原护具', '0行动 · 2秒');
        if (!a.suitChecked) step('CHECK_SUIT', '现场检查同一原护具90秒余量', '0行动 · 5秒');
        if (!a.departureChecked) step('CHECK_DEPARTURE', '核当前原舱信号、原回程锚与两原片', '0行动 · 5秒');
        if (!a.departureConfirmed && a.method === 'ABILITY') add('单独确认污染风险、防护与真实回程预算后离世', '0行动 · 须18灵性/两原片/防护90秒；出程8灵性/片1；失败精神−5/污染+2', { type: 'DEPART', caseId, confirm: true });
        if (l.playerLocation === 'REMOTE') {
          if (!a.returnMarkerChecked) step('CHECK_RETURN_MARKER', '闭目遮挡下核原回程标记', '0行动 · 防护5秒');
          if (!a.packetTaken && !a.stopped) step('TAKE_PACKET', '取原舱内同一原封包', '0行动 · 防护3秒');
          if (!a.horizonViewed && !a.stopped) add('可选：单独确认后看异常天际', '0行动 · 防护2秒 · 精神−6/污染+3 · 无奖励', { type: 'VIEW_HORIZON', caseId, confirm: true });
          step('RETURN_LOCAL', '不看天空，同一身体实际回PAD', '0行动 · 8灵性/原片1 · 防护10秒');
          if (!a.stopped) step('WAIT_EXPOSURE', '继续暴露等待10秒（可能致死）', '0行动 · 防护10秒；不足则健康−15/精神−5');
        }
        if (l.suit.location === 'PLAYER') step('RETURN_SUIT', '在START归还同一原护具', '0行动 · 2秒 · 防护不重填');
      }
      if (caseId === 'original-handoff') {
        if (a.recipientConsent === 'UNASKED') step('CONSENT_RECIPIENT', '在OFFICE问埃利亚斯本次是否愿受理', '0行动 · 2秒');
        if (!a.packetRecordsChecked) step('CHECK_PACKET_RECORDS', '核原封条状态及本次真实出返记录', '0行动 · 4秒');
        if (l.packet.location === 'PLAYER') {
          if (!a.recordsCompared) { if (a.method === 'ABILITY' && a.abilityTier === null) step('COMPARE_RECORDS', '星界定位G：比对两已有坐标时间记录', '0行动 · 6灵性 · 知识18 · 2秒'); step('MANUAL_COMPARE', '人工逐项比对已有记录', '0行动 · 20秒'); }
          if (!a.packetHanded) step('HAND_PACKET', '埃利亚斯当面接同一原封包', '0行动 · 2秒');
        } else if (l.packet.location !== 'OWNER_ARCHIVE' && !a.nonreturnFiled) step('FILE_NONRETURN', '如实登记原包未交档与实际去向', '0行动 · 3秒 · 不加能力掌握');
      }
      if (l.anchor.location === 'PAD' && (caseId === 'original-handoff' || a.stopped)) { if (l.playerLocation === 'START') step('GO_ANCHOR', '本人普通4米到PAD取原锚', '0行动 · 4米4秒'); step('RECOVER_ANCHOR', '从PAD收同一原锚', '0行动 · 2秒'); }
      if (l.anchor.location === 'PLAYER') step('RETURN_ANCHOR', '在START把同一原锚交诺拉', '0行动 · 1秒');
      if (a.stopped && l.packet.location === 'PLAYER') step('RETURN_PACKET', '在START普通退还同一原包', '0行动 · 1秒');
      if (!a.stopped) step('STOP_CONTACT', '停止本次工作，保留实际状态和成本', '0行动 · 1秒；远处仍须真实返回');
      if (l.playerLocation !== 'START' && l.playerLocation !== 'REMOTE') step('RETURN_PLAYER', '本人沿原普通干廊回START', `0行动 · ${distance(l.playerLocation, 'START')}米`);
      step('INSPECT', '检查本人、原包、原锚、原护具实际去向', '0行动 · 2秒');
    }
    add('关闭已真实检查现场', '0行动', { type: 'CLOSE', caseId });
  }
  add('反思三份有限离世往返报告', '1行动 · 扮演25', { type: 'REFLECT' }); return out;
}
function observations(a: WandererAttempt | undefined): string[] {
  if (!a) return [];
  const out = [`本次实际${a.elapsedSeconds}秒；本人普通${a.playerTravelMetres}米，离世段不计普通米；实耗灵性${a.spiritualitySpent}/原片${a.energySpent}。`, `诺拉本案许可${a.ownerConsent}；埃利亚斯本案受理${a.recipientConsent}；不同案同意不延续。`];
  if (a.abilityTier) out.push(`本案唯一检验${a.abilityTier}，不重骰、成本不退。`);
  if (a.failedDeparture) out.push('出程失败，身体从未离开PAD；原包未取回，已耗8灵性/原片1，精神−5/污染+2。');
  if (a.departed) out.push(`同一身体确实到REMOTE，${a.returnedLocal ? '又实耗8灵性/原片1回到本地PAD。' : '尚未实际返回，不能用普通关闭回城。'}远处动作${a.remoteSeconds}秒，暴露损失健康${a.healthLost}/精神${a.mindLost}，污染增加${a.pollutionAdded}。`);
  if (a.horizonViewed) out.push('可选确认后看过异常天际2秒，精神−6/污染+3，无额外知识或奖励。');
  if (a.packetHanded) out.push('此前原舱中的唯一WN3-PACKET已由本人携回，并在OFFICE真实交OWNER_ARCHIVE。');
  if (a.nonreturnFiled) out.push('只归档真实未交包说明，没有把REMOTE或OWNER的原包写成送达。');
  if (a.anchorReturned) out.push('本人携唯一WN3-ANCHOR普通4米回START交诺拉。');
  if (a.stopped) out.push('已停止本次工作；身体、原物及已付成本仍按实际记录保留。');
  return out;
}
export function projectWandererLife(s: SliceState): WandererLifeProjection {
  const l = s.wanderer.life;
  return { ...structuredClone(l), title: '漫游者·门序列3（有限离世往返G）', story: WANDERER_LIFE_STORY,
    environment: 'WN3-WORKSHOP：START→PAD4米、PAD→OFFICE6米、START→OFFICE10米，均为原OPEN干廊。唯一离世端点WN3-REMOTE-DOCK是G既存空停泊舱，原包此前有记录地留在那里；固定原档案坐标不是任意目的地菜单。诺拉41岁始终START，埃利亚斯37岁始终OFFICE，无同伴随行或异星NPC复制。',
    inside: hasWandererLifeLock(s), insideCase: hasWandererLifeLock(s), currentAttempt: structuredClone(currentAttempt(s)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: observations(r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '实际工作尚未完成，原位置与成本保留。' : r.result === 'ABILITY' ? '有限能力实际成功，真实收口后可报告。' : '普通完成、未前往或尊重拒绝，不赠能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: wandererLifeActions(s) };
}
/** Replays each bounded scene trace; this rejects copied originals, invented travel and refilled resources. */
export function validateWandererLife(s: SliceState): boolean {
  const l = s.wanderer?.life, initial = createWandererLifeState(), promotion = s.wanderer?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, WANDERER_CASE_IDS)) return false;
  const combatSeconds = s.combatHistory.reduce((sum, round) => sum + (round.wandererOutcome?.elapsedSeconds ?? 0), 0);
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.siteId !== initial.siteId || typeof l.reflected !== 'boolean' || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || !['START', 'PAD', 'OFFICE', 'REMOTE'].includes(l.playerLocation) || l.activeCase !== null && !WANDERER_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['nora', 'elias', 'anchor', 'suit', 'packet', 'energy', 'endpoints', 'door'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  for (const key of ['nora', 'elias'] as const) { const person = l[key]; if (typeof person.willing !== 'boolean' || stableStringify(person) !== stableStringify({ ...initial[key], willing: person.willing })) return false; }
  if (stableStringify(l.endpoints) !== stableStringify(initial.endpoints) || stableStringify(l.door) !== stableStringify(initial.door)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify({ ...initial, clockSeconds: combatSeconds });
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate)) return false;
  const replay = createWandererLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', activeEvent: null, combat: null, injuries: [], wanderer: { ...s.wanderer, life: replay }, seer: { ...s.seer } };
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of WANDERER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[WANDERER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++;
      replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || a.method !== r.method || !integer(a.initialHealth, 1, 100) || !integer(a.initialMind, 1, 100) || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialPollution, 0, 100) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.status = 'ACTIVE'; shadow.health = a.initialHealth; shadow.mind = a.initialMind; shadow.spirituality = a.initialSpirituality; shadow.seer.pollution = a.initialPollution;
    const expected = freshAttempt(shadow, a.method);
    replay.activeCase = id; replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [expected], status: 'ACTIVE', contactOpen: true, closes: 0, returned: false };
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'noraWilling', 'eliasWilling']) || typeof step.noraWilling !== 'boolean' || typeof step.eliasWilling !== 'boolean' || !['ALIGN_ANCHOR', 'COMPARE_RECORDS', 'DEPART'].includes(step.type) && step.tier !== null || ['ALIGN_ANCHOR', 'COMPARE_RECORDS', 'DEPART'].includes(step.type) && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'REFLECT'].includes(step.type)) return false;
      const command = step.type === 'DEPART' || step.type === 'VIEW_HORIZON' ? { type: step.type, caseId: id, confirm: true } : { type: step.type, caseId: id };
      if (!validateWandererActivityCommand(command)) return false;
      replay.nora.willing = step.noraWilling; replay.elias.willing = step.eliasWilling;
      if (sceneReason(shadow, id, step.type)) return false;
      applyScene(shadow, id, step);
    }
    if (a.closed) {
      if (!expected.inspected || cleanupBlock(shadow, id)) return false;
      expected.closed = true; expected.ownerConsent = expected.recipientConsent = 'CLOSED'; replay.activeCase = null;
    }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== (a.closed ? 1 : 0) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') {
      open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' && !(s.status === 'DEAD' && l.playerLocation === 'REMOTE' && s.health === 0)) return false;
      if (shadow.health === 0 && (s.status !== 'DEAD' || s.health !== 0)) return false;
    } else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') resolved++;
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.nora.willing = l.nora.willing; replay.elias.willing = l.elias.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && (l.playerLocation !== 'START' || l.suit.location !== 'OWNER' || l.anchor.location === 'PLAYER')) return false;
  if (s.seer.completedSources.filter(x => x === 'wanderer-reflection').length !== (l.reflected ? 1 : 0)) return false;
  return !(s.progression.pathwayId==='door'&&[3,2].includes(s.progression.sequence??0)) || (s.progression.sequence===2?s.planeswalker.wandererActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
