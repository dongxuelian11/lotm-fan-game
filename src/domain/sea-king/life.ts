import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasCataclysmPriestLifeLock } from '../cataclysm-priest/life.js';

export const SEA_KING_CASE_IDS = ['remote-dinghy', 'wet-recess', 'calm-water-record'] as const;
export type SeaKingCaseId = typeof SEA_KING_CASE_IDS[number];
export type SeaKingLocation = 'EXIT' | 'PIER' | 'LEDGE' | 'VANTAGE';
export type SeaKingConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export type SeaKingHypothesis = 'CURRENT' | 'HAND_MOVED';
export interface SeaKingAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: SeaKingConsent; ownerConsentWeek: number | null; orinConsent: SeaKingConsent; orinConsentWeek: number | null;
  siteVisited: boolean; chartRead: boolean; boundaryChecked: boolean; itemsReturned: boolean; inspected: boolean; refused: boolean;
  rowedOut: boolean; returnedBy: 'WIND' | 'OARS' | null; boatSecured: boolean; boatTravelMetres: number; orinEnergySpent: number;
  assistantChecked: boolean; waterMoved: boolean; windowRemaining: number; windowElapsed: number; waterReturned: boolean;
  plateTaken: boolean; plateReturned: boolean; retrieval: 'HOOK' | 'WINDLASS' | null; hookWear: number; windlassWear: number;
  calmChecked: boolean; fragments: ('BLUE_CLOTH' | 'ONE_BELL')[]; hypothesis: SeaKingHypothesis | null; hypothesisHistory: SeaKingHypothesis[];
  selmaAsked: boolean; orinAsked: boolean; ownerEvidenceRead: boolean; recordReturned: boolean; verified: boolean;
}
export interface SeaKingCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: SeaKingAttempt[];
}
export interface SeaKingLifeState {
  siteId: 'SK3-COVE'; waterSource: 'SEAWATER' | 'NONE'; boundaryMetres: 96; activeCase: SeaKingCaseId | null;
  playerLocation: SeaKingLocation; playerTravelMetres: number; clockSeconds: number;
  selma: { id: 'SK3-SELMA'; name: '塞尔玛'; age: 44; alive: true; willing: boolean; location: 'EXIT' };
  orin: { id: 'SK3-ORIN'; name: '奥林'; age: 39; alive: true; willing: boolean; present: boolean; location: 'PIER' | 'DINGHY'; energy: number; travelMetres: number };
  chart: { id: 'SK3-CHART'; owner: 'SK3-SELMA'; location: 'OWNER' | 'PLAYER' };
  buoys: { id: 'SK3-BOUNDARY-BUOYS'; originalCount: 2; boundaryMetres: 96; fixed: true };
  dinghy: { id: 'SK3-DINGHY'; owner: 'SK3-SELMA'; location: 'PIER' | 'MARK'; occupant: 'SK3-ORIN' | null; cargoUnits: 0; hull: number; travelMetres: number };
  mooring: { id: 'SK3-MOORING'; owner: 'SK3-SELMA'; tied: boolean; durability: number };
  recess: { id: 'SK3-RECESS'; connectedTo: 'SK3-COVE'; waterUnits: number; displacedToCove: number };
  plate: { id: 'SK3-PLATE'; owner: 'SK3-SELMA'; location: 'RECESS' | 'PLAYER' | 'OWNER' };
  hook: { id: 'SK3-HOOK'; owner: 'SK3-SELMA'; location: 'OWNER' | 'PLAYER'; durability: number };
  windlass: { id: 'SK3-WINDLASS'; owner: 'SK3-SELMA'; location: 'OWNER' | 'PLAYER'; durability: number };
  barrel: { id: 'SK3-BARREL'; owner: 'SK3-SELMA'; location: 'SIDE_BERTH' };
  handoverRecord: { id: 'SK3-HANDOVER'; owner: 'SK3-SELMA'; location: 'OWNER' | 'PLAYER' };
  surfaceCalm: boolean; cases: Record<SeaKingCaseId, SeaKingCaseState>; reflected: boolean;
}
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'GO_SITE' | 'READ_CHART' | 'CHECK_BOUNDARY' | 'RETURN_PLAYER' | 'RETURN_ITEMS' | 'INSPECT';
type DinghyCommand = 'CONSENT_ORIN' | 'ROW_OUT' | 'REMOTE_WIND' | 'ROW_RETURN' | 'TIE_BOAT';
type RecessCommand = 'CHECK_ASSISTANT' | 'DIVERT_WATER' | 'TAKE_PLATE' | 'STOP_WATER' | 'WAIT_WINDOW' | 'TOOL_RETRIEVE';
type RecordCommand = 'CHECK_CALM' | 'RECOLLECT' | 'ASK_SELMA' | 'ASK_ORIN' | 'READ_RECORD' | 'VERIFY';
export type SeaKingActivityCommand =
  | { type: CommonCommand; caseId: SeaKingCaseId }
  | { type: DinghyCommand; caseId: 'remote-dinghy' }
  | { type: RecessCommand; caseId: 'wet-recess' }
  | { type: RecordCommand; caseId: 'calm-water-record' }
  | { type: 'PREPARE'; caseId: SeaKingCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'HYPOTHESIZE'; caseId: 'calm-water-record'; hypothesis: SeaKingHypothesis }
  | { type: 'REFLECT' };
export interface SeaKingLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SeaKingActivityCommand }
export interface SeaKingLifeProjection {
  title: string; story: string; environment: string; activeCase: SeaKingCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: SeaKingLocation; playerTravelMetres: number; currentAttempt: SeaKingAttempt | null;
  selma: SeaKingLifeState['selma']; orin: SeaKingLifeState['orin']; chart: SeaKingLifeState['chart']; buoys: SeaKingLifeState['buoys'];
  dinghy: SeaKingLifeState['dinghy']; mooring: SeaKingLifeState['mooring']; recess: SeaKingLifeState['recess']; plate: SeaKingLifeState['plate'];
  hook: SeaKingLifeState['hook']; windlass: SeaKingLifeState['windlass']; barrel: SeaKingLifeState['barrel']; handoverRecord: SeaKingLifeState['handoverRecord'];
  cases: { id: SeaKingCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: SeaKingAttempt[] }[];
  actions: SeaKingLifeAction[];
}
export const SEA_KING_LIFE_STORY = '海王·暴君序列3。原著支持掌控海域中远距离风力、排开真实海水与从平静水面看有限过往；本作三案、人物、96米边界、20水量单位/20秒、距离、成本与成长均为原创G限界，不等于资深海王全部强度。观察、准备、实施、报告各1行动，准备须余2行动；子步0行动但实耗秒、米、精力、耐久与灵性。每案最多一次6灵性能力检验，失败可普通收口，三报告各扮演25、反思25；实际发挥作用并完成报告的新掌握8。不是全海眼线、凭空造水、永久排海、遥知真相或历史改写。';
const CASES = [
  { id: 'remote-dinghy', title: 'G · 同一小艇的六十米往返', story: '同一原奥林自愿将原空载小艇划到原浮标。只有在本次同意、原图与实测边界齐全时尝试有限远风助返；失败或不施术，他实际沿原水路划返。系好同一原缆后本人沿4米干燥岸路回出口；船上本人不会同时在岸。' },
  { id: 'wet-recess', title: 'G · 原浅凹槽的二十单位海水', story: '塞尔玛委托取回原标牌。本人从普通干燥岸路到原边沿，确认原助手在干岸，再尝试把原凹槽20单位水暂移到相连海湾，最多20秒。原短钩取原牌须实耗耐久与2秒，水随后返回；失败或错过窗口用同一普通卷具6秒取牌并交还原工具。' },
  { id: 'calm-water-record', title: 'G · 水面片段与原交班签注', story: '原浮桶昨天到了旁泊位。须原主人许可和现场平静水面，能力最多呈现不完整片段，不能辨认人物或裁定责任。先写待证假说，再分别当面问原主人、原助手并核对原交班签注；错误假说保留，按新证据修正。普通问询也能完成，原桶不因看过往而移回。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 3;
const freshCase = (): SeaKingCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): SeaKingAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, orinConsent: 'UNASKED', orinConsentWeek: null,
    siteVisited: false, chartRead: false, boundaryChecked: false, itemsReturned: false, inspected: false, refused: false,
    rowedOut: false, returnedBy: null, boatSecured: false, boatTravelMetres: 0, orinEnergySpent: 0,
    assistantChecked: false, waterMoved: false, windowRemaining: 0, windowElapsed: 0, waterReturned: false, plateTaken: false, plateReturned: false, retrieval: null, hookWear: 0, windlassWear: 0,
    calmChecked: false, fragments: [], hypothesis: null, hypothesisHistory: [], selmaAsked: false, orinAsked: false, ownerEvidenceRead: false, recordReturned: false, verified: false };
}
export function createSeaKingLifeState(): SeaKingLifeState {
  return { siteId: 'SK3-COVE', waterSource: 'SEAWATER', boundaryMetres: 96, activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 0, clockSeconds: 0,
    selma: { id: 'SK3-SELMA', name: '塞尔玛', age: 44, alive: true, willing: true, location: 'EXIT' },
    orin: { id: 'SK3-ORIN', name: '奥林', age: 39, alive: true, willing: true, present: true, location: 'PIER', energy: 100, travelMetres: 0 },
    chart: { id: 'SK3-CHART', owner: 'SK3-SELMA', location: 'OWNER' }, buoys: { id: 'SK3-BOUNDARY-BUOYS', originalCount: 2, boundaryMetres: 96, fixed: true },
    dinghy: { id: 'SK3-DINGHY', owner: 'SK3-SELMA', location: 'PIER', occupant: null, cargoUnits: 0, hull: 100, travelMetres: 0 },
    mooring: { id: 'SK3-MOORING', owner: 'SK3-SELMA', tied: true, durability: 100 },
    recess: { id: 'SK3-RECESS', connectedTo: 'SK3-COVE', waterUnits: 20, displacedToCove: 0 },
    plate: { id: 'SK3-PLATE', owner: 'SK3-SELMA', location: 'RECESS' }, hook: { id: 'SK3-HOOK', owner: 'SK3-SELMA', location: 'OWNER', durability: 100 },
    windlass: { id: 'SK3-WINDLASS', owner: 'SK3-SELMA', location: 'OWNER', durability: 100 }, barrel: { id: 'SK3-BARREL', owner: 'SK3-SELMA', location: 'SIDE_BERTH' },
    handoverRecord: { id: 'SK3-HANDOVER', owner: 'SK3-SELMA', location: 'OWNER' }, surfaceCalm: true,
    cases: { 'remote-dinghy': freshCase(), 'wet-recess': freshCase(), 'calm-water-record': freshCase() }, reflected: false };
}
function cleanupBlock(s: SliceState): string | null {
  const l = s.seaKing.life;
  if (l.dinghy.location !== 'PIER' || l.dinghy.occupant !== null || !l.mooring.tied || l.orin.location !== 'PIER') return '先让同一原人和原艇真实返岸、系回原缆并下艇。';
  if (l.recess.displacedToCove !== 0 || l.recess.waterUnits !== 20) return '先停止有限作用，让同一20单位水返回原凹槽。';
  if (l.chart.location !== 'OWNER' || l.hook.location !== 'OWNER' || l.windlass.location !== 'OWNER' || l.plate.location === 'PLAYER' || l.handoverRecord.location !== 'OWNER') return '先携原物真实回原主面前并交还，不能远程归还。';
  return l.playerLocation === 'EXIT' ? null : '本人须沿普通干燥岸路真实回到EXIT。';
}
export const hasSeaKingLifeLock = (s: SliceState): boolean => s.seaKing.life.activeCase !== null || Object.values(s.seaKing.life.cases).some(r => r.contactOpen || r.status === 'PREPARED') || cleanupBlock(s) !== null;
export const seaKingInside = hasSeaKingLifeLock;
const currentAttempt = (s: SliceState): SeaKingAttempt | null => { const l = s.seaKing.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
function returnWater(s: SliceState, a: SeaKingAttempt) { const l = s.seaKing.life; l.recess.waterUnits += l.recess.displacedToCove; l.recess.displacedToCove = 0; a.windowRemaining = 0; a.waterReturned = true; }
function elapse(s: SliceState, a: SeaKingAttempt, seconds: number) {
  a.elapsedSeconds += seconds; s.seaKing.life.clockSeconds += seconds;
  if (a.windowRemaining > 0) { const used = Math.min(seconds, a.windowRemaining); a.windowRemaining -= used; a.windowElapsed += used; if (a.windowRemaining === 0) returnWater(s, a); }
}
function walk(s: SliceState, a: SeaKingAttempt, to: SeaKingLocation, metres: number) { const l = s.seaKing.life; l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres); }
function boatTravel(s: SliceState, a: SeaKingAttempt, to: 'PIER' | 'MARK', energy: number, seconds: number) { const l = s.seaKing.life; l.dinghy.location = to; l.dinghy.travelMetres += 60; l.orin.travelMetres += 60; l.orin.energy -= energy; a.boatTravelMetres += 60; a.orinEnergySpent += energy; elapse(s, a, seconds); }
function setResult(s: SliceState, id: SeaKingCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.seaKing.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
const COMMON = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'GO_SITE', 'READ_CHART', 'CHECK_BOUNDARY', 'RETURN_PLAYER', 'RETURN_ITEMS', 'INSPECT'];
const SPECIFIC: Record<SeaKingCaseId, readonly string[]> = { 'remote-dinghy': ['CONSENT_ORIN', 'ROW_OUT', 'REMOTE_WIND', 'ROW_RETURN', 'TIE_BOAT'], 'wet-recess': ['CHECK_ASSISTANT', 'DIVERT_WATER', 'TAKE_PLATE', 'STOP_WATER', 'WAIT_WINDOW', 'TOOL_RETRIEVE'], 'calm-water-record': ['CHECK_CALM', 'RECOLLECT', 'ASK_SELMA', 'ASK_ORIN', 'READ_RECORD', 'VERIFY'] };
export function validateSeaKingActivityCommand(v: unknown): v is SeaKingActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!SEA_KING_CASE_IDS.includes(v.caseId as SeaKingCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'HYPOTHESIZE') return v.caseId === 'calm-water-record' && shape(v, ['type', 'caseId', 'hypothesis']) && ['CURRENT', 'HAND_MOVED'].includes(String(v.hypothesis));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as SeaKingCaseId].includes(String(v.type)));
}
export const isSeaKingActivityCommand = validateSeaKingActivityCommand;
export const isSeaKingActivity = validateSeaKingActivityCommand;
const ownerConsents = (s: SliceState, a: SeaKingAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.seaKing.life.selma.willing;
const orinConsents = (s: SliceState, a: SeaKingAttempt) => a.orinConsent === 'GRANTED' && a.orinConsentWeek === s.week && s.seaKing.life.orin.willing && s.seaKing.life.orin.present;
export function blockSeaKingLife(s: SliceState, c: SeaKingActivityCommand): string | null {
  if (!validateSeaKingActivityCommand(c)) return '海王有限生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已实际晋升海王序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原SK3-COVE。';
  if (['READY', 'FIGHTING'].includes(s.seaKing.encounter.status)) return '先结束或和平离开原码头遭遇。';
  const l = s.seaKing.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return !r?.contactOpen || !a || l.activeCase !== c.caseId ? '没有本次开放现场。' : cleanupBlock(s) ?? (a.inspected ? null : '先核实原物、同伴与本人真实退出。');
  if (r?.contactOpen && a && !a.closed && 'caseId' in c && l.activeCase === c.caseId) {
    // Cleanup is independent of AP, spirituality and withdrawn permission.
    if (c.type === 'ROW_RETURN') return l.dinghy.location === 'MARK' && l.dinghy.occupant === 'SK3-ORIN' && l.orin.location === 'DINGHY' && l.orin.energy >= 12 ? null : '原人在原艇及原浮标处才能沿真实60米水路划返；出发已保留12精力返程。';
    if (c.type === 'TIE_BOAT') return a.returnedBy !== null && !a.boatSecured && l.playerLocation === 'PIER' && l.dinghy.location === 'PIER' && l.dinghy.occupant === 'SK3-ORIN' && l.mooring.durability > 0 ? null : '须同一原艇已真实返岸，才能系原缆并让原人下艇。';
    if (c.type === 'STOP_WATER' || c.type === 'WAIT_WINDOW') return a.windowRemaining > 0 && l.recess.displacedToCove === 20 ? null : '没有仍在本次20秒窗口内的原水。';
    if (c.type === 'RETURN_PLAYER') return l.playerLocation === 'EXIT' ? '本人已在出口。' : l.recess.displacedToCove !== 0 ? '先停止作用或等原水在20秒上限内返回。' : c.caseId === 'remote-dinghy' && (l.dinghy.location !== 'PIER' || !l.mooring.tied) ? '先使原人原艇真实返岸并系原缆；不能丢下船上原人。' : null;
    if (c.type === 'RETURN_ITEMS') return l.playerLocation !== 'EXIT' ? '须本人携同一原物实际走回原主人面前。' : l.chart.location === 'PLAYER' || l.hook.location === 'PLAYER' || l.windlass.location === 'PLAYER' || l.plate.location === 'PLAYER' || l.handoverRecord.location === 'PLAYER' ? null : '当前没有待交还的原物。';
    if (c.type === 'INSPECT') return a.inspected ? '已实际检查，请结束。' : cleanupBlock(s);
    if (a.inspected) return '本次已经核实退出，请结束现场。';
    if (c.type === 'CONSENT_OWNER') return a.ownerConsent === 'UNASKED' && l.playerLocation === 'EXIT' ? null : '须在EXIT当面问原塞尔玛本次具体用途；旧许可不能代替。';
    if (!ownerConsents(s, a)) return '须原主人本次仍有效许可；拒绝或撤回可归还原物、普通退出。';
    if (c.type === 'GO_SITE') return !a.siteVisited && l.playerLocation === 'EXIT' && l.chart.location === 'OWNER' ? null : '本次只沿原岸路进入一次，原图须仍在原主人手中。';
    if (c.type === 'READ_CHART') return a.siteVisited && !a.chartRead && l.playerLocation !== 'EXIT' && l.chart.location === 'PLAYER' ? null : '须本人已到原现场，亲读随身带来的同一原海图。';
    if (c.type === 'CHECK_BOUNDARY') return a.chartRead && !a.boundaryChecked && l.playerLocation !== 'EXIT' ? null : '先亲读原图，再按原两浮标核实本案96米有限边界；所有权不等于魔法掌控。';
    if (c.type === 'CONSENT_ORIN') return l.playerLocation === 'PIER' && a.orinConsent === 'UNASKED' && !a.rowedOut ? null : '先走4米到原码头，当面问原奥林本次是否自愿，不替原人同意。';
    if (c.type === 'ROW_OUT') return !orinConsents(s, a) ? '须奥林本次当前自愿，人在原码头；可尊重拒绝退出。' : !a.boundaryChecked || a.rowedOut || l.playerLocation !== 'PIER' || l.orin.location !== 'PIER' || l.dinghy.location !== 'PIER' || !l.mooring.tied || l.dinghy.hull <= 0 || l.orin.energy < 24 || l.waterSource !== 'SEAWATER' ? '须实测原60米水路、同一可用原艇与至少24精力，预留12精力普通返程；不能重复出发或无海行舟。' : null;
    if (c.type === 'CHECK_ASSISTANT') return l.playerLocation === 'LEDGE' && !a.assistantChecked && l.orin.present && l.orin.location === 'PIER' && l.dinghy.location === 'PIER' && l.dinghy.occupant === null ? null : '须本人在干燥LEDGE亲见原助手在干岸PIER，不能把艇上原人也算在岸。';
    if (c.type === 'TAKE_PLATE') return l.playerLocation === 'LEDGE' && a.windowRemaining >= 2 && l.recess.waterUnits === 0 && l.plate.location === 'RECESS' && l.hook.location === 'PLAYER' && l.hook.durability >= 1 ? null : '须在原干边沿、至少剩2秒窗口并持可用同一短钩，才能取同一原牌；不能假造干地。';
    if (c.type === 'TOOL_RETRIEVE') return l.playerLocation === 'LEDGE' && a.assistantChecked && a.windowRemaining === 0 && l.recess.waterUnits === 20 && l.plate.location === 'RECESS' && l.windlass.location === 'PLAYER' && l.windlass.durability >= 2 ? null : '须在原干边沿以可用原普通卷具取仍在20单位水下的原牌，实耗6秒与2耐久。';
    if (c.type === 'CHECK_CALM') return l.playerLocation === 'VANTAGE' && !a.calmChecked && l.surfaceCalm && l.waterSource === 'SEAWATER' ? null : '须本人到原观察台亲验真实水面当下平静，不由能力免费改天气。';
    if (c.type === 'HYPOTHESIZE') return !a.calmChecked || a.verified ? '先到观察台确认当下原水面；完成核实后不再改写假说。' : a.hypothesis === null ? l.playerLocation === 'VANTAGE' ? null : '初次假说须在亲见水面的原观察台写下。' : a.ownerEvidenceRead && a.selmaAsked && a.orinAsked && a.hypothesisHistory.length < 2 && c.hypothesis !== a.hypothesis ? null : '先写一次待证假说；取得原当面证词及原交班签注后才可修正一次，原错误保留。';
    if (c.type === 'ASK_SELMA') return a.hypothesis !== null && !a.selmaAsked && l.playerLocation === 'EXIT' ? null : '先写假说并沿3米原岸路回EXIT，当面问原塞尔玛。';
    if (c.type === 'ASK_ORIN') return a.hypothesis !== null && !a.orinAsked && l.playerLocation === 'EXIT' && l.orin.present && l.orin.willing && l.orin.location === 'PIER' ? null : '先写假说并回EXIT，原奥林当前自愿且确在PIER；再沿真实4米岸路去问并走回。';
    if (c.type === 'READ_RECORD') return a.selmaAsked && a.orinAsked && !a.ownerEvidenceRead && l.playerLocation === 'EXIT' && l.handoverRecord.location === 'OWNER' ? null : '须分别当面询问两位原人后，由原主出示同一交班签注；没有后台答案。';
    if (c.type === 'VERIFY') return !a.ownerEvidenceRead || !a.selmaAsked || !a.orinAsked ? '须先取得两位原人的当面证词并亲读原交班签注，再核实假说。' : a.verified ? '本案已核实。' : a.hypothesis !== 'HAND_MOVED' ? '已读原签注与当面确认支持人为移桶，请据这些新证据修正假说。' : l.playerLocation !== 'EXIT' ? '须在原主人面前核实。' : null;
    if (c.type === 'REMOTE_WIND' || c.type === 'DIVERT_WATER' || c.type === 'RECOLLECT') {
      if (a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null)) return '本案能力只判定一次；失败或旧尝试成本保留，不重骰。';
      if (s.health <= 0 || s.mind <= 0 || s.spirituality < 6) return '本次须身心尚可并有6灵性；普通取还和退出不依赖灵性。';
      if (!a.chartRead || !a.boundaryChecked || l.waterSource !== 'SEAWATER') return '须亲读原图、核实96米边界及真实海水；所有权不自动授予全海掌控。';
      if (c.type === 'REMOTE_WIND' && (!a.rowedOut || !orinConsents(s, a) || l.playerLocation !== 'PIER' || l.dinghy.location !== 'MARK' || l.dinghy.occupant !== 'SK3-ORIN' || l.orin.location !== 'DINGHY' || l.orin.energy < 4)) return '须同一自愿原人在60米处同一原艇上，才可助其沿原水路返航；域外不施力。';
      if (c.type === 'DIVERT_WATER' && (l.playerLocation !== 'LEDGE' || !a.assistantChecked || l.orin.location !== 'PIER' || !l.orin.present || l.recess.waterUnits !== 20 || l.recess.displacedToCove !== 0 || l.plate.location !== 'RECESS')) return '须原助手确在干岸、本人在干边沿，且同一原牌仍在20单位真实海水内。';
      if (c.type === 'RECOLLECT' && (!a.calmChecked || !l.surfaceCalm || l.playerLocation !== 'VANTAGE' || a.hypothesis !== null)) return '须在原观察台亲见当下平静水面，尚未写假说；只看本案有限片段。';
      return null;
    }
    return '请按原人原物的真实状态继续或普通退出。';
  }
  if (hasSeaKingLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消本次准备，或真实收束当前原现场。';
  if (hasCataclysmPriestLifeLock(s) || Object.values(s.cataclysmPriest.life.cases).some(x => x.status === 'PREPARED') || s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' || ['READY', 'FIGHTING'].includes(s.cataclysmPriest.encounter.status) || s.seaKing.preparedWeek !== null || s.oceanSinger.ritual.location !== 'DOCK' || s.oceanSinger.practice.songOpen || s.oceanSinger.practice.allyAffected || s.oceanSinger.practice.allyPosition !== 'NEAR' || Object.values(s.oceanSinger.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '先真实收束旧灾难主祭、海洋歌者现场与服药准备，不覆盖旧原物和同意。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '本步骤需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : SEA_KING_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知实践。';
  if (r.status === 'RESOLVED') return '本案已经报告，不重置原人原物或重复刷成长。';
  const index = SEA_KING_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[SEA_KING_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一项真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案。' : r.attempts.at(-1)?.week === s.week ? '本周成本保留，下一真实周才可重新准备。' : c.method === 'ABILITY' && r.attempts.some(x => x.abilityTier !== null) ? '本案已经检验一次，之后只能普通续办。' : s.actionsRemaining < 2 ? '准备至少余2行动，留1行动实施，避免末行动死锁。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须真实复核、归还原物并沿普通路退出后报告。';
  return '没有本案开放现场。';
}
export const blockSeaKingActivity = blockSeaKingLife;

export function applySeaKingActivity(s: SliceState, c: SeaKingActivityCommand, ctx: SeerContext): void {
  const reason = blockSeaKingLife(s, c); if (reason) throw new Error(reason);
  const l = s.seaKing.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.seer.completedSources.push('sea-king-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('G · 有限海域与不完整证据', '三个真实报告后扮演+25。原人精力、原工具耐久、原水与错误假说保留；有限过往不判罪，不改写昨天，也没有全海眼线。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的海湾准备', '0行动退出，已付1行动不退；没有移动原人原物或获得本次许可。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '一次有限G能力' : '普通真实工作'}，本次同意与实测仍须取得。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动在原EXIT开始。之后子步0行动，实际秒、路程、灵性和原资源分别保留；原人原物不会复原。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'remote-dinghy' ? 'tyrant.s3.remote-tempest' : c.caseId === 'wet-recess' ? 'tyrant.s3.sea-domain' : 'tyrant.s3.water-recollection'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `真实收束报告，G扮演+25。${r.result === 'ABILITY' ? '能力实际发挥作用的新掌握+8。' : '普通工作或尊重拒绝，无能力掌握。'}原人精力、原工具耐久与旧假说不重置。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = 'CLOSED'; a.orinConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('结束原海湾现场', '0行动，本人EXIT、同一原人原艇岸边系牢、同一20单位水在原凹槽、全部借物交还。成本与失败保留；未完成工作可下一真实周普通续办，不重骰。'); return; }
  switch (c.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.selma.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; a.refused ||= a.ownerConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('原塞尔玛当面回答本次用途', a.ownerConsent === 'GRANTED' ? '2秒，原44岁主人仅许可本次原艇协作、原牌取回或原桶调查，不转移所有权，也不替奥林本人同意。' : '2秒，原主人拒绝；不移动原物、不扣施法灵性，可如实检查退出。'); return;
    case 'GO_SITE': { const metres = c.caseId === 'calm-water-record' ? 3 : 4; l.chart.location = 'PLAYER'; if (c.caseId === 'wet-recess') { l.hook.location = 'PLAYER'; l.windlass.location = 'PLAYER'; } a.siteVisited = true; walk(s, a, c.caseId === 'remote-dinghy' ? 'PIER' : c.caseId === 'wet-recess' ? 'LEDGE' : 'VANTAGE', metres); ctx.note('本人携原物走原干燥岸路', `实际${metres}米、${metres}秒到${l.playerLocation}；同一原图随身，${c.caseId === 'wet-recess' ? '原短钩与普通卷具一并借带，须交还。' : '原物所有权不变。'}不进入深水、不瞬移原人。`); return; }
    case 'READ_CHART': a.chartRead = true; elapse(s, a, 2); ctx.note('亲读同一原海图', '2秒。SK3-CHART记录两原浮标所围96米练习海域与原小艇到固定浮标60米水路；图不提供域外对象信息，须另实测本案边界。'); return;
    case 'CHECK_BOUNDARY': a.boundaryChecked = true; elapse(s, a, 4); ctx.note('按原两浮标核实本案边界', '4秒核实原图、原标线与眼前真实海水，本作仅96米有限域。原主人普通所有权不是魔法掌控，域外对象不赠信息或施力。'); return;
    case 'CONSENT_ORIN': a.orinConsent = l.orin.willing && l.orin.present ? 'GRANTED' : 'DECLINED'; a.orinConsentWeek = s.week; a.refused ||= a.orinConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('当面问原奥林本次意愿', a.orinConsent === 'GRANTED' ? '2秒，原39岁奥林自愿这一次原艇60米往返，可在出发前拒绝，到了浮标也可普通划返；主人的许可不能替他同意。' : '2秒，原人拒绝或不在场，原艇不出发，也不生成替代船员；可归还原图并如实退出。'); return;
    case 'ROW_OUT': l.mooring.tied = false; l.dinghy.occupant = 'SK3-ORIN'; l.orin.location = 'DINGHY'; a.rowedOut = true; boatTravel(s, a, 'MARK', 12, 60); ctx.note('原奥林与原艇实际划到原浮标', `实际60米、60秒，原人精力−12，剩${l.orin.energy}；本人仍在岸边PIER，同一奥林只在原艇上。这是游戏抽象命令，不是现实操舟教程；已保留普通返程精力。`); return;
    case 'ROW_RETURN': boatTravel(s, a, 'PIER', 12, 60); a.returnedBy = 'OARS'; ctx.note('同一原人普通划回同一原艇', `沿原水路实际60米、60秒，另耗原奥林12精力，剩${l.orin.energy}。无需灵性或施法许可，尚须系原缆和下艇。`); return;
    case 'TIE_BOAT': l.mooring.tied = true; l.dinghy.occupant = null; l.orin.location = 'PIER'; a.boatSecured = true; elapse(s, a, 2); setResult(s, c.caseId, a.returnedBy === 'WIND' ? 'ABILITY' : 'ORDINARY'); ctx.note('系回同一原缆，原人实际下艇', '2秒。原艇在PIER系牢、奥林从同一原艇下到岸边，没有复制原人；原船体与精力保留，本人仍須走4米回EXIT。'); return;
    case 'CHECK_ASSISTANT': a.assistantChecked = true; elapse(s, a, 2); ctx.note('亲见原助手确在干岸', '2秒，本人在原干边沿，奥林在原PIER、原艇已系牢且无人在艇上。身份没有水下免疫，也没有自动排友。'); return;
    case 'TAKE_PLATE': l.hook.durability--; a.hookWear++; a.plateTaken = true; a.retrieval = 'HOOK'; l.plate.location = 'PLAYER'; elapse(s, a, 2); ctx.note('从原干边沿用同一短钩取同一原牌', `实际2秒、原钩耐久−1。SK3-PLATE已到本人手中，不复制；原20单位水仍存在，窗口剩${a.windowRemaining}秒，须停止或到时回水。`); return;
    case 'STOP_WATER': returnWater(s, a); elapse(s, a, 1); ctx.note('停止作用，原二十单位水回原凹槽', '1秒。相连海湾暂移量20→0，原凹槽0→20，守恒不删水；原牌若未取仍在原处，可改用普通卷具。'); return;
    case 'WAIT_WINDOW': { const seconds = a.windowRemaining; elapse(s, a, seconds); ctx.note('真实等待本次窗口到时', `实际再过${seconds}秒，本案总窗口20秒耗尽，同一20单位水全部回凹槽；不能免费续窗或重骰。未取原牌可用普通卷具。`); return; }
    case 'TOOL_RETRIEVE': l.windlass.durability -= 2; a.windlassWear += 2; a.plateTaken = true; a.retrieval = 'WINDLASS'; l.plate.location = 'PLAYER'; elapse(s, a, 6); ctx.note('用同一普通卷具取回原牌', '本人仍在干边沿，实际6秒、原卷具耐久−2，将同一SK3-PLATE取到本人手中；原凹槽仍有20单位真实海水，没有伪造干地或授予能力成功。'); return;
    case 'CHECK_CALM': a.calmChecked = true; elapse(s, a, 2); ctx.note('到原观察台亲验平静水面', '2秒，真实水面当下平静；原SK3-BARREL仍在旁泊位。尚不知昨天为何移动，原平静也不等于完整历史记录。'); return;
    case 'HYPOTHESIZE': a.hypothesis = c.hypothesis; a.hypothesisHistory.push(c.hypothesis); elapse(s, a, 1); ctx.note(a.hypothesisHistory.length > 1 ? '按当面新证据修正假说' : '写下待证假说', `1秒，${c.hypothesis === 'CURRENT' ? '可能被水流带动' : '可能由人移动'}。${a.ownerEvidenceRead ? '原先错误选择仍保留，不改写当时认识。' : '仅为玩家猜测，不是能力给出的真相或定罪。'}`); return;
    case 'ASK_SELMA': a.selmaAsked = true; elapse(s, a, 3); ctx.note('原塞尔玛当面给出有限证词', '3秒。她昨天交班时见桶在旁泊位，未目睹移动全过程；请另问实际在场助手并看原交班签注，不能从衣色片段认定谁有罪。'); return;
    case 'ASK_ORIN': walk(s, a, 'PIER', 4); a.orinAsked = true; elapse(s, a, 3); walk(s, a, 'EXIT', 4); ctx.note('本人沿原岸路去问原奥林再返回', '实际往返8米、另3秒当面询问。奥林确认昨天为给靠船留位而亲自移动原桶，记在交班签注；这是原人证词，仍须由原主出示原记录核对。原桶今天的位置没改。'); return;
    case 'READ_RECORD': l.handoverRecord.location = 'PLAYER'; a.ownerEvidenceRead = true; elapse(s, a, 3); ctx.note('原主人出示同一原交班签注', '3秒亲读SK3-HANDOVER：“一钟，奥林移桶至旁泊位，留出靠船处。”与原助手当面说法对应，支持HAND_MOVED；签注原本存在，不由过往片段生成，读后须还原主。'); return;
    case 'VERIFY': a.verified = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('用原人证词与原签注核实', '2秒核对：奥林昨天为靠船实际移桶。结论来自两位原人当面证词及原签注，水面片段单独不辨人、不判罪；原桶仍在SIDE_BERTH，昨天没有改写。'); return;
    case 'RETURN_PLAYER': { const metres = l.playerLocation === 'VANTAGE' ? 3 : 4; walk(s, a, 'EXIT', metres); ctx.note('本人携原借物沿原岸路返回', `实际${metres}米、${metres}秒回EXIT，0行动0灵性。随身原物只是被本人带回，仍须当面交还；岸边原艇和原桶不瞬移。`); return; }
    case 'RETURN_ITEMS': l.chart.location = 'OWNER'; if (l.hook.location === 'PLAYER') l.hook.location = 'OWNER'; if (l.windlass.location === 'PLAYER') l.windlass.location = 'OWNER'; if (l.plate.location === 'PLAYER') { l.plate.location = 'OWNER'; a.plateReturned = true; setResult(s, c.caseId, a.retrieval === 'HOOK' ? 'ABILITY' : 'ORDINARY'); } if (l.handoverRecord.location === 'PLAYER') { l.handoverRecord.location = 'OWNER'; a.recordReturned = true; } a.itemsReturned = true; elapse(s, a, 1); ctx.note('把同一原借物当面交还原主', '1秒。原图、原工具、已取原牌或原签注真实交还塞尔玛，所有权不变；原工具耐久、原人精力不恢复，未取原牌仍在凹槽。'); return;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (r.result === 'NONE' && (a.ownerConsent === 'DECLINED' || a.ownerConsent === 'GRANTED' && !l.selma.willing || c.caseId === 'remote-dinghy' && (a.orinConsent === 'DECLINED' || a.orinConsent === 'GRANTED' && (!l.orin.willing || !l.orin.present)) || c.caseId === 'calm-water-record' && a.hypothesis !== null && (!l.orin.willing || !l.orin.present))) { a.refused = true; setResult(s, c.caseId, 'ORDINARY'); } ctx.note('核实原人原物和普通出口', `2秒。本人EXIT，原艇PIER系牢，奥林精力${l.orin.energy}，原凹槽20水单位，钩/卷具耐久${l.hook.durability}/${l.windlass.durability}。拒绝可如实普通报告；其他未完成中止不假称能力成功。`); return;
    case 'REMOTE_WIND': case 'DIVERT_WATER': case 'RECOLLECT': {
      s.spirituality -= 6; a.spiritualitySpent += 6; a.abilityTier = ctx.check(c.type === 'DIVERT_WATER' ? 'knowledge' : 'will', 18).tier; elapse(s, a, 2);
      if (success(a.abilityTier)) {
        if (c.type === 'REMOTE_WIND') { boatTravel(s, a, 'PIER', 4, 30); a.returnedBy = 'WIND'; }
        else if (c.type === 'DIVERT_WATER') { l.recess.waterUnits -= 20; l.recess.displacedToCove += 20; a.waterMoved = true; a.windowRemaining = 20; }
        else a.fragments = ['BLUE_CLOTH', 'ONE_BELL'];
      }
      const result = c.type === 'REMOTE_WIND' ? '有限风使同一原艇沿原水路实际返60米、30秒，原奥林另耗4精力；尚未系缆下艇。' : c.type === 'DIVERT_WATER' ? '同一20单位水由原凹槽实移相连海湾，最多20秒窗口，原牌仍在原槽；水未消失。' : '只见BLUE_CLOTH蓝布掠过、ONE_BELL一声钟的模糊片段，看不清是谁，也不能由此断言为何移桶；须写假说再普通调查。';
      ctx.note(success(a.abilityTier) ? '有限海域能力实际成功' : '有限海域能力失败', `6灵性、2秒实耗，${c.type === 'DIVERT_WATER' ? '知识' : '意志'}18，本案以后不重骰。${success(a.abilityTier) ? result : '没有额外作用或信息，原人原物仍在当前真实位置；可普通划返、卷具取牌或当面调查。'}`); return;
    }
  }
}

export function seaKingLifeActions(s: SliceState): SeaKingLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.seaKing.life, out: SeaKingLifeAction[] = [];
  const add = (label: string, cost: string, command: SeaKingActivityCommand) => { const reason = blockSeaKingLife(s, command); out.push({ id: `SK3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'hypothesis' in command ? `:${command.hypothesis}` : ''}`, label, cost, enabled: reason === null, reason, command }); };
  for (const caseId of SEA_KING_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add('观察原海湾、本案原物与普通出口', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备一次有限海域能力' : '准备普通真实工作', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('在原EXIT开始实施', '1行动 · 后续子步0行动', { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 不退已付行动', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告本案实际工作与普通退出', '1行动 · 扮演25 · 实发挥能力新掌握8', { type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    add('当面询问塞尔玛本次用途许可', '0行动 · 2秒 · 原主人可拒绝', { type: 'CONSENT_OWNER', caseId });
    add('携同一原图沿干燥岸路到本案现场', `0行动 · ${caseId === 'calm-water-record' ? '3米3秒' : '4米4秒'} · 原借物须归还`, { type: 'GO_SITE', caseId });
    if (caseId === 'remote-dinghy') add('当面问原奥林本次是否愿意往返', '0行动 · 2秒 · 不替原人同意', { type: 'CONSENT_ORIN', caseId });
    add('亲读带来的同一原海图', '0行动 · 2秒 · 不授域外信息', { type: 'READ_CHART', caseId });
    add('按原两浮标实测本案有限边界', '0行动 · 4秒 · G96米', { type: 'CHECK_BOUNDARY', caseId });
    if (caseId === 'remote-dinghy') {
      add('原奥林乘同一原艇划到原浮标', '0行动 · 60米60秒 · 原人精力12 · 须留12返程', { type: 'ROW_OUT', caseId });
      if (r.method === 'ABILITY') add('G远风助同一原艇实际返岸', '0行动 · 6灵性 · 意志18 · 2秒 · 成功另60米30秒/原人精力4 · 本案一次', { type: 'REMOTE_WIND', caseId });
      add('同一原人沿原水路普通划返', '0行动0灵性 · 60米60秒 · 原人精力12', { type: 'ROW_RETURN', caseId });
      add('系回同一原缆并让原人下艇', '0行动 · 2秒 · 不修船或回精力', { type: 'TIE_BOAT', caseId });
    } else if (caseId === 'wet-recess') {
      add('在原干边沿确认原助手确在干岸', '0行动 · 2秒 · 不授同伴免疫', { type: 'CHECK_ASSISTANT', caseId });
      if (r.method === 'ABILITY') add('G将原20单位水暂移相连海湾', '0行动 · 6灵性 · 知识18 · 2秒 · 最多20秒窗口 · 本案一次', { type: 'DIVERT_WATER', caseId });
      add('从原干边沿以同一短钩取原牌', '0行动 · 2秒 · 原钩耐久1 · 须余至少2秒', { type: 'TAKE_PLATE', caseId });
      add('停止作用，让同一20单位水回槽', '0行动0灵性 · 1秒 · 不删水', { type: 'STOP_WATER', caseId });
      add('实际等到本次20秒窗口结束', '0行动0灵性 · 消耗真实剩余秒数 · 原水回槽', { type: 'WAIT_WINDOW', caseId });
      add('用同一普通卷具从有水原槽取牌', '0行动0灵性 · 6秒 · 原卷具耐久2', { type: 'TOOL_RETRIEVE', caseId });
    } else {
      add('亲验原观察台前真实平静水面', '0行动 · 2秒 · 不免费改天气', { type: 'CHECK_CALM', caseId });
      if (r.method === 'ABILITY') add('从原水面尝试看本案有限过往片段', '0行动 · 6灵性 · 意志18 · 2秒 · 本案一次 · 不辨人或判罪', { type: 'RECOLLECT', caseId });
      add('假说：原桶可能被水流带动', '0行动 · 1秒 · 尚待真实调查', { type: 'HYPOTHESIZE', caseId, hypothesis: 'CURRENT' });
      add('假说：原桶可能被人移动', '0行动 · 1秒 · 新证据后可修正，保留旧选择', { type: 'HYPOTHESIZE', caseId, hypothesis: 'HAND_MOVED' });
      add('在EXIT当面询问原塞尔玛', '0行动 · 3秒 · 须本人先走回', { type: 'ASK_SELMA', caseId });
      add('沿原岸路去问原奥林并真实返回', '0行动 · 往返8米加3秒 · 须原人当前愿意且在场', { type: 'ASK_ORIN', caseId });
      add('由原主出示并亲读同一交班签注', '0行动 · 3秒 · 须先当面问两位原人', { type: 'READ_RECORD', caseId });
      add('按当面证词与亲读原签注核实假说', '0行动 · 2秒 · 片段单独不能判定', { type: 'VERIFY', caseId });
    }
    add('本人携原借物沿干燥原路回EXIT', `0行动0灵性 · ${caseId === 'calm-water-record' ? '3' : '4'}米与同秒 · 须先收束水/原艇`, { type: 'RETURN_PLAYER', caseId });
    add('在EXIT当面交还同一原图、工具与已借原物', '0行动0灵性 · 1秒 · 不恢复耐久', { type: 'RETURN_ITEMS', caseId });
    add('检查原人原物、成本与普通退出', '0行动 · 2秒', { type: 'INSPECT', caseId });
    add('结束本次原海湾现场', '0行动 · 仅完整收口可报告', { type: 'CLOSE', caseId });
    add('中止本次现场，保留真实成本', '0行动 · 须先原人原物归还与本人退出', { type: 'WITHDRAW', caseId });
  }
  add('反思有限海域、原物与不完整证据', '1行动 · 三真实报告后扮演25', { type: 'REFLECT' });
  return out;
}
function observations(id: SeaKingCaseId, a?: SeaKingAttempt): string[] {
  if (!a) return [];
  const out = [`本次${a.elapsedSeconds}秒、本人${a.playerTravelMetres}米、${a.spiritualitySpent}灵性；主人许可${a.ownerConsent}，许可周${a.ownerConsentWeek ?? '未取得'}。`];
  if (a.siteVisited) out.push(`本人已沿原干岸到${id === 'remote-dinghy' ? 'PIER' : id === 'wet-recess' ? 'LEDGE' : 'VANTAGE'}，同一原图随身带去。`);
  if (a.chartRead) out.push('已亲读同一原海图；原艇至固定浮标60米，原两浮标标记G96米有限域。');
  if (a.boundaryChecked) out.push('已按原图、两原浮标与实见海水核实本案边界，普通所有权不等于魔法掌控。');
  if (id === 'remote-dinghy') {
    if (a.orinConsentWeek !== null) out.push(`原奥林本次许可${a.orinConsent}；原人可拒绝，船上本人不会同时出现在岸上。`);
    if (a.rowedOut) out.push(`同一奥林与同一原艇已实际出发60米；本次原艇累计${a.boatTravelMetres}米，原人实耗${a.orinEnergySpent}精力。`);
    if (a.returnedBy) out.push(a.returnedBy === 'WIND' ? '有限远风已助同一原艇实际返60米/30秒，原人仍耗4精力。' : '同一原人沿原水路普通划返60米/60秒，实耗12精力。');
    if (a.boatSecured) out.push('同一原艇已系回原缆，原奥林实际下艇到PIER；船体和精力未复原。');
  } else if (id === 'wet-recess') {
    if (a.assistantChecked) out.push('已亲见原助手确在干岸PIER，本人在干边沿；不授水下免疫。');
    if (a.waterMoved) out.push(`原20单位水确实暂移相连海湾；窗口已实际经过${a.windowElapsed}秒，剩${a.windowRemaining}秒，${a.waterReturned ? '原水已全部回原槽。' : '原水仍完整存在于相连海湾。'}`);
    if (a.plateTaken) out.push(`同一原牌已由${a.retrieval === 'HOOK' ? '原短钩在窗口内' : '原普通卷具在有水原槽'}取到本人手中；原钩/卷具实耗${a.hookWear}/${a.windlassWear}耐久。`);
    if (a.plateReturned) out.push('本人已携同一原牌沿普通岸路交还塞尔玛，原工具不复原。');
  } else {
    if (a.calmChecked) out.push('本人已到原观察台亲验此时真实平静水面，原桶仍在旁泊位。');
    if (a.fragments.length) out.push('实际有限片段仅BLUE_CLOTH蓝布掠过、ONE_BELL一声钟；看不清人物和缘由，不足以归责。');
    if (a.hypothesis !== null) out.push(`玩家假说历史：${a.hypothesisHistory.join(' → ')}；原选择不删除。`);
    if (a.selmaAsked) out.push('已当面问塞尔玛：她交班时见桶在旁泊位，未目睹完整移动过程。');
    if (a.orinAsked) out.push('已走实际8米往返当面询问奥林：他称昨天为靠船留位亲自移桶，尚须核对原签注。');
    if (a.ownerEvidenceRead) out.push('已亲读原主出示的原签注：“一钟，奥林移桶至旁泊位，留出靠船处。”');
    if (a.verified) out.push('已用当面原人证词与原签注核实HAND_MOVED；片段不单独判罪，原桶位置和昨天没有改写。');
  }
  if (a.abilityTier !== null) out.push(`本案一次能力检验${a.abilityTier}，实耗6灵性，以后不重骰。`);
  if (a.refused) out.push('本次有当事人拒绝或撤回，只如实记录普通收束，不假称施法完成。');
  if (a.itemsReturned) out.push('已在原主面前亲手交还本次借物；原资源和成本不恢复。');
  return out;
}
export function projectSeaKingLife(s: SliceState): SeaKingLifeProjection {
  const l = s.seaKing.life;
  return { title: '海王·暴君序列3（有限G海域）', story: SEA_KING_LIFE_STORY, environment: `原SK3-COVE：EXIT至PIER和LEDGE各4米、至VANTAGE3米，都是普通干燥岸路。两原浮标限定本作96米；原槽水${l.recess.waterUnits}单位、暂移相连湾${l.recess.displacedToCove}单位，总20不变。原水源${l.waterSource}；现实操舟或水下作业不是本作教学。`, activeCase: l.activeCase, inside: hasSeaKingLifeLock(s), insideCase: hasSeaKingLifeLock(s), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, currentAttempt: structuredClone(currentAttempt(s)),
    selma: { ...l.selma }, orin: { ...l.orin }, chart: { ...l.chart }, buoys: { ...l.buoys }, dinghy: { ...l.dinghy }, mooring: { ...l.mooring }, recess: { ...l.recess }, plate: { ...l.plate }, hook: { ...l.hook }, windlass: { ...l.windlass }, barrel: { ...l.barrel }, handoverRecord: { ...l.handoverRecord },
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: observations(x.id, r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '真实工作尚未完成，成本和原状态保留。' : r.result === 'ABILITY' ? '有限能力实际发挥作用，原人原物与真实证据已核实。' : '普通工作或尊重本次拒绝收束，不授能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: seaKingLifeActions(s) };
}

/** Finite original identities, paid checks, conserved water and actual ordinary exits. */
export function validateSeaKingLife(s: SliceState): boolean {
  const l = s.seaKing?.life, initial = createSeaKingLifeState(), promotion = s.seaKing?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, SEA_KING_CASE_IDS)) return false;
  for (const key of ['selma', 'orin', 'chart', 'buoys', 'dinghy', 'mooring', 'recess', 'plate', 'hook', 'windlass', 'barrel', 'handoverRecord'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.siteId !== 'SK3-COVE' || !['SEAWATER', 'NONE'].includes(l.waterSource) || l.boundaryMetres !== 96 || !['EXIT', 'PIER', 'LEDGE', 'VANTAGE'].includes(l.playerLocation) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || typeof l.surfaceCalm !== 'boolean' || l.activeCase !== null && !SEA_KING_CASE_IDS.includes(l.activeCase)) return false;
  if (l.selma.id !== 'SK3-SELMA' || l.selma.name !== '塞尔玛' || l.selma.age !== 44 || l.selma.alive !== true || l.selma.location !== 'EXIT' || typeof l.selma.willing !== 'boolean') return false;
  if (l.orin.id !== 'SK3-ORIN' || l.orin.name !== '奥林' || l.orin.age !== 39 || l.orin.alive !== true || !['PIER', 'DINGHY'].includes(l.orin.location) || typeof l.orin.willing !== 'boolean' || typeof l.orin.present !== 'boolean' || !integer(l.orin.energy, 0, 100) || !integer(l.orin.travelMetres)) return false;
  for (const key of ['chart', 'hook', 'windlass', 'handoverRecord'] as const) if (l[key].id !== initial[key].id || l[key].owner !== 'SK3-SELMA' || !['OWNER', 'PLAYER'].includes(l[key].location)) return false;
  if (stableStringify(l.buoys) !== stableStringify(initial.buoys) || stableStringify(l.barrel) !== stableStringify(initial.barrel)) return false;
  if (l.dinghy.id !== 'SK3-DINGHY' || l.dinghy.owner !== 'SK3-SELMA' || !['PIER', 'MARK'].includes(l.dinghy.location) || ![null, 'SK3-ORIN'].includes(l.dinghy.occupant) || l.dinghy.cargoUnits !== 0 || !integer(l.dinghy.hull, 1, 100) || !integer(l.dinghy.travelMetres)) return false;
  if (l.mooring.id !== 'SK3-MOORING' || l.mooring.owner !== 'SK3-SELMA' || typeof l.mooring.tied !== 'boolean' || !integer(l.mooring.durability, 1, 100)) return false;
  if (l.recess.id !== 'SK3-RECESS' || l.recess.connectedTo !== 'SK3-COVE' || ![0, 20].includes(l.recess.waterUnits) || ![0, 20].includes(l.recess.displacedToCove) || l.recess.waterUnits + l.recess.displacedToCove !== 20) return false;
  if (l.plate.id !== 'SK3-PLATE' || l.plate.owner !== 'SK3-SELMA' || !['RECESS', 'PLAYER', 'OWNER'].includes(l.plate.location) || !integer(l.hook.durability, 0, 100) || !integer(l.windlass.durability, 0, 100)) return false;
  if ((l.orin.location === 'DINGHY') !== (l.dinghy.occupant === 'SK3-ORIN') || l.dinghy.location === 'MARK' && (l.dinghy.occupant !== 'SK3-ORIN' || l.mooring.tied) || l.mooring.tied && l.dinghy.occupant !== null) return false;
  let open = 0, prepared = 0, resolved = 0, seconds = 0, metres = 0, boatMetres = 0, energySpent = 0, hookWear = 0, windlassWear = 0, plateReturned = false;
  for (const [index, id] of SEA_KING_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[SEA_KING_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let previousWeek = r.observedWeek - 1, checks = 0;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, previousWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !integer(a.elapsedSeconds) || !integer(a.playerTravelMetres) || a.elapsedSeconds < a.playerTravelMetres || !integer(a.spiritualitySpent, 0, 6) || !integer(a.boatTravelMetres, 0, 120) || !integer(a.orinEnergySpent, 0, 24) || !integer(a.windowRemaining, 0, 20) || !integer(a.windowElapsed, 0, 20) || !integer(a.hookWear, 0, 1) || !integer(a.windlassWear, 0, 2)) return false;
      for (const key of ['closed', 'siteVisited', 'chartRead', 'boundaryChecked', 'itemsReturned', 'inspected', 'refused', 'rowedOut', 'boatSecured', 'assistantChecked', 'waterMoved', 'waterReturned', 'plateTaken', 'plateReturned', 'calmChecked', 'selmaAsked', 'orinAsked', 'ownerEvidenceRead', 'recordReturned', 'verified'] as const) if (typeof a[key] !== 'boolean') return false;
      for (const [consent, week] of [[a.ownerConsent, a.ownerConsentWeek], [a.orinConsent, a.orinConsentWeek]] as const) if (!['UNASKED', 'GRANTED', 'DECLINED', 'CLOSED'].includes(consent) || week !== null && week !== a.week || consent === 'UNASKED' && week !== null || ['GRANTED', 'DECLINED'].includes(consent) && week === null) return false;
      if (a.abilityTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.abilityTier) || ![null, 'WIND', 'OARS'].includes(a.returnedBy) || ![null, 'HOOK', 'WINDLASS'].includes(a.retrieval) || !Array.isArray(a.fragments) || !Array.isArray(a.hypothesisHistory) || a.hypothesisHistory.length > 2 || a.hypothesisHistory.some(h => !['CURRENT', 'HAND_MOVED'].includes(h)) || a.hypothesis !== (a.hypothesisHistory.at(-1) ?? null) || a.hypothesisHistory.length === 2 && a.hypothesisHistory[0] === a.hypothesisHistory[1]) return false;
      if (a.siteVisited && a.ownerConsentWeek === null || a.chartRead && !a.siteVisited || a.boundaryChecked && !a.chartRead || a.itemsReturned && !a.siteVisited) return false;
      if (a.abilityTier !== null) { checks++; if (a.method !== 'ABILITY' || a.spiritualitySpent !== 6 || !a.boundaryChecked || a.ownerConsentWeek === null || (id === 'remote-dinghy' ? !a.rowedOut || a.orinConsentWeek === null : id === 'wet-recess' ? !a.assistantChecked : !a.calmChecked)) return false; }
      else if (a.spiritualitySpent !== 0) return false;
      if (a.rowedOut && (!a.boundaryChecked || a.orinConsentWeek === null) || a.returnedBy !== null && !a.rowedOut || a.returnedBy === 'WIND' && !success(a.abilityTier) || a.boatSecured && a.returnedBy === null || a.boatTravelMetres !== (a.rowedOut ? a.returnedBy ? 120 : 60 : 0) || a.orinEnergySpent !== (a.rowedOut ? a.returnedBy === 'WIND' ? 16 : a.returnedBy === 'OARS' ? 24 : 12 : 0)) return false;
      if (a.waterMoved !== (id === 'wet-recess' && success(a.abilityTier)) || a.windowRemaining + a.windowElapsed > 20 || a.waterMoved && !a.assistantChecked || !a.waterMoved && (a.windowRemaining !== 0 || a.windowElapsed !== 0 || a.waterReturned) || a.waterMoved && (a.windowRemaining === 0) !== a.waterReturned || a.waterMoved && !a.waterReturned && a.windowRemaining + a.windowElapsed !== 20) return false;
      if (a.plateTaken !== (a.retrieval !== null) || a.retrieval === 'HOOK' && (!a.waterMoved || a.hookWear !== 1 || a.windowElapsed < 2) || a.retrieval === 'WINDLASS' && (!a.assistantChecked || a.windlassWear !== 2 || a.windowRemaining !== 0) || a.hookWear !== (a.retrieval === 'HOOK' ? 1 : 0) || a.windlassWear !== (a.retrieval === 'WINDLASS' ? 2 : 0) || a.plateReturned && (!a.plateTaken || !a.itemsReturned)) return false;
      if (stableStringify(a.fragments) !== stableStringify(id === 'calm-water-record' && success(a.abilityTier) ? ['BLUE_CLOTH', 'ONE_BELL'] : []) || a.calmChecked && !a.siteVisited || a.hypothesis !== null && !a.calmChecked || (a.selmaAsked || a.orinAsked) && a.hypothesis === null || a.ownerEvidenceRead && (!a.selmaAsked || !a.orinAsked) || a.hypothesisHistory.length > 1 && !a.ownerEvidenceRead || a.recordReturned && !a.ownerEvidenceRead || a.verified && (!a.ownerEvidenceRead || a.hypothesis !== 'HAND_MOVED')) return false;
      if (id !== 'remote-dinghy' && (a.rowedOut || a.returnedBy !== null || a.boatSecured || a.boatTravelMetres !== 0 || a.orinEnergySpent !== 0 || a.orinConsentWeek !== null) || id !== 'wet-recess' && (a.assistantChecked || a.waterMoved || a.waterReturned || a.plateTaken || a.plateReturned || a.retrieval !== null || a.hookWear !== 0 || a.windlassWear !== 0) || id !== 'calm-water-record' && (a.calmChecked || a.fragments.length || a.hypothesis !== null || a.selmaAsked || a.orinAsked || a.ownerEvidenceRead || a.recordReturned || a.verified)) return false;
      const complete = id === 'remote-dinghy' ? a.boatSecured : id === 'wet-recess' ? a.plateReturned : a.verified;
      const effective = id === 'remote-dinghy' ? a.returnedBy === 'WIND' : id === 'wet-recess' ? a.retrieval === 'HOOK' : success(a.abilityTier);
      if (a.result === 'ABILITY' && (!complete || !effective || !success(a.abilityTier)) || a.result === 'ORDINARY' && !complete && !a.refused || a.result === 'ORDINARY' && complete && effective || a.refused && a.ownerConsentWeek === null) return false;
      if (a.closed && (!a.inspected || a.ownerConsent !== 'CLOSED' || a.orinConsent !== 'CLOSED' || a.siteVisited && !a.itemsReturned || a.rowedOut && !a.boatSecured || a.waterMoved && !a.waterReturned || a.plateTaken && !a.plateReturned || a.ownerEvidenceRead && !a.recordReturned) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      const distance = id === 'calm-water-record' ? 3 : 4;
      if (a.siteVisited && a.playerTravelMetres < distance || a.itemsReturned && a.playerTravelMetres < distance * 2 || a.orinAsked && a.playerTravelMetres < 14 || a.closed && a.siteVisited && a.playerTravelMetres < distance * 2 || a.elapsedSeconds < a.playerTravelMetres + (a.rowedOut ? a.returnedBy === 'WIND' ? 90 : a.returnedBy === 'OARS' ? 120 : 60 : 0)) return false;
      previousWeek = a.week; seconds += a.elapsedSeconds; metres += a.playerTravelMetres; boatMetres += a.boatTravelMetres; energySpent += a.orinEnergySpent; hookWear += a.hookWear; windlassWear += a.windlassWear; plateReturned ||= a.plateReturned;
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
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.clockSeconds < seconds || l.playerTravelMetres !== metres || l.dinghy.travelMetres !== boatMetres || l.orin.travelMetres !== boatMetres || l.orin.energy !== 100 - energySpent || l.hook.durability !== 100 - hookWear || l.windlass.durability !== 100 - windlassWear || (l.plate.location === 'OWNER') !== plateReturned || l.reflected && resolved !== 3) return false;
  if (s.seer.completedSources.filter(x => x === 'sea-king-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (!open && cleanupBlock(s) !== null) return false;
  if (open) {
    const a = currentAttempt(s)!;
    if ((l.chart.location === 'PLAYER') !== (a.siteVisited && !a.itemsReturned) || (l.hook.location === 'PLAYER') !== (l.activeCase === 'wet-recess' && a.siteVisited && !a.itemsReturned) || l.hook.location !== l.windlass.location || (l.plate.location === 'PLAYER') !== (l.activeCase === 'wet-recess' && a.plateTaken && !a.plateReturned) || (l.handoverRecord.location === 'PLAYER') !== (l.activeCase === 'calm-water-record' && a.ownerEvidenceRead && !a.recordReturned) || (l.recess.displacedToCove === 20) !== (l.activeCase === 'wet-recess' && a.windowRemaining > 0)) return false;
    if ((l.dinghy.occupant === 'SK3-ORIN') !== (l.activeCase === 'remote-dinghy' && a.rowedOut && !a.boatSecured) || (l.dinghy.location === 'MARK') !== (l.activeCase === 'remote-dinghy' && a.rowedOut && a.returnedBy === null) || l.mooring.tied !== !(l.activeCase === 'remote-dinghy' && a.rowedOut && !a.boatSecured)) return false;
    if (l.playerLocation !== 'EXIT' && (!a.siteVisited || a.itemsReturned || l.playerLocation !== (l.activeCase === 'remote-dinghy' ? 'PIER' : l.activeCase === 'wet-recess' ? 'LEDGE' : 'VANTAGE'))) return false;
  }
  if (s.progression.pathwayId === 'tyrant' && s.progression.sequence === 2) {
    const inheritedAt = s.catastrophe?.promotionWeek;
    if (!integer(inheritedAt, promotion, s.week) || s.catastrophe?.seaKingActingAtPromotion !== 100 || open || prepared || hasSeaKingLifeLock(s) || !l.reflected || resolved !== 3) return false;
    if (Object.values(l.cases).some(r => r.observedWeek === null || r.observedWeek > inheritedAt || r.attempts.some(a => a.week > inheritedAt))) return false;
    return s.catastrophe.seaKingActingAtPromotion === resolved * 25 + (l.reflected ? 25 : 0);
  }
  return !promoted(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
}
