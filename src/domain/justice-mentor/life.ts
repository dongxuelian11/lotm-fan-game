import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasUnshadowedLifeLock } from '../unshadowed/life.js';
import { hasUnshadowedRitualLock } from '../unshadowed/ritual.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';

export const JUSTICE_MENTOR_CASE_IDS = ['paired-lift', 'faded-label', 'shielded-sample'] as const;
export type JusticeMentorCaseId = typeof JUSTICE_MENTOR_CASE_IDS[number];
export type JusticeMentorLocation = 'EXIT' | 'START' | 'TABLE' | 'BENCH';
export type JusticeMentorConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
export type JusticeMentorHypothesis = 'MISSING_ITEM' | 'REASSIGNED';
export interface JusticeMentorAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; abilityTier: PublicResolutionTier | null;
  ownerConsent: JusticeMentorConsent; ownerConsentWeek: number | null;
  ayaConsent: JusticeMentorConsent; nivenConsent: JusticeMentorConsent; spiritConsent: JusticeMentorConsent;
  ayaConsentWeek: number | null; nivenConsentWeek: number | null; spiritConsentWeek: number | null;
  siteVisited: boolean; stopped: boolean; refused: boolean; inspected: boolean; itemsReturned: boolean; playerReturned: boolean;
  routeChecked: boolean; carried: boolean; carryBenefit: boolean; chestReceived: boolean; helpersReturned: boolean;
  ayaEnergySpent: number; nivenEnergySpent: number; helperTravelMetres: number; chestTravelMetres: number;
  glyphs: ('OLD_BAY' | 'SECOND_SHIFT')[]; lampRead: boolean; lampOilSpent: number;
  hypothesis: JusticeMentorHypothesis | null; hypothesisHistory: JusticeMentorHypothesis[];
  selbyAsked: boolean; nivenAsked: boolean; registerRead: boolean; verified: boolean;
  screenChecked: boolean; spiritSteppedOut: boolean; spiritDisposition: 'RETURNED' | 'STAY_SIDE' | null;
  spiritTravelMetres: number; lightActive: boolean; lightStopped: boolean; sampleSealed: boolean; sealSpent: number;
}
export interface JusticeMentorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: JusticeMentorAttempt[];
}
interface Helper { id: 'JM3-AYA' | 'JM3-NIVEN'; name: string; age: number; alive: true; willing: boolean; present: boolean; location: 'START' | 'BENCH'; energy: number; travelMetres: number }
export interface JusticeMentorLifeState {
  siteId: 'JM3-WORKCOURT'; activeCase: JusticeMentorCaseId | null; playerLocation: JusticeMentorLocation; playerTravelMetres: number; clockSeconds: number;
  selby: { id: 'JM3-SELBY'; name: '塞尔比'; age: 48; alive: true; willing: boolean; location: 'BENCH' };
  aya: Helper; niven: Helper;
  elm: { id: 'JM3-ELM'; name: '榆音'; friendly: true; willing: boolean; location: 'TABLE' | 'SIDE'; travelMetres: number };
  chest: { id: 'JM3-CHEST'; owner: 'JM3-SELBY'; location: 'START' | 'BENCH'; custody: 'OWNER' | 'HELPERS'; travelMetres: number };
  tag: { id: 'JM3-TAG'; owner: 'JM3-SELBY'; location: 'TABLE' | 'PLAYER' | 'OWNER'; originalGlyphs: readonly ['OLD_BAY', 'SECOND_SHIFT'] };
  register: { id: 'JM3-REGISTER'; owner: 'JM3-SELBY'; location: 'TABLE' | 'PLAYER' | 'OWNER' };
  magnifier: { id: 'JM3-MAGNIFIER'; owner: 'JM3-SELBY'; location: 'TABLE' | 'PLAYER' | 'OWNER'; durability: number };
  lamp: { id: 'JM3-LAMP'; owner: 'JM3-SELBY'; location: 'TABLE' | 'PLAYER' | 'OWNER'; oil: number };
  sample: { id: 'JM3-SAMPLE'; owner: 'JM3-SELBY'; quantity: 1; contamination: 0 | 2; location: 'TABLE' | 'BOX'; boxId: 'JM3-SAMPLE-BOX'; sealed: boolean };
  seal: { id: 'JM3-SEAL'; remaining: number }; screen: { id: 'JM3-SCREEN'; intact: boolean; placed: boolean; durability: number };
  door: { id: 'JM3-DOOR'; state: 'OPEN' }; cases: Record<JusticeMentorCaseId, JusticeMentorCaseState>; reflected: boolean;
}
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'GO_SITE' | 'RETURN_PLAYER' | 'RETURN_ITEMS' | 'INSPECT' | 'STOP_CONTACT';
type LiftCommand = 'CONSENT_AYA' | 'CONSENT_NIVEN' | 'CHECK_ROUTE' | 'ENCOURAGE' | 'CARRY_CHEST' | 'RECEIVE_CHEST' | 'RETURN_HELPERS';
type LabelCommand = 'REVEAL_GLYPHS' | 'READ_LAMP' | 'ASK_SELBY' | 'ASK_NIVEN' | 'READ_REGISTER' | 'VERIFY';
type SampleCommand = 'CHECK_SCREEN' | 'CONSENT_SPIRIT' | 'MOVE_SPIRIT' | 'PURIFY' | 'STOP_EFFECT' | 'SEAL_SAMPLE' | 'INVITE_SPIRIT_RETURN';
export type JusticeMentorActivityCommand =
  | { type: CommonCommand; caseId: JusticeMentorCaseId }
  | { type: LiftCommand; caseId: 'paired-lift' } | { type: LabelCommand; caseId: 'faded-label' } | { type: SampleCommand; caseId: 'shielded-sample' }
  | { type: 'PREPARE'; caseId: JusticeMentorCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'HYPOTHESIZE'; caseId: 'faded-label'; hypothesis: JusticeMentorHypothesis } | { type: 'REFLECT' };
export interface JusticeMentorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: JusticeMentorActivityCommand }
export interface JusticeMentorLifeProjection {
  title: string; story: string; environment: string; activeCase: JusticeMentorCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: JusticeMentorLocation; playerTravelMetres: number; currentAttempt: JusticeMentorAttempt | null;
  selby: JusticeMentorLifeState['selby']; aya: Helper; niven: Helper; elm: JusticeMentorLifeState['elm']; chest: JusticeMentorLifeState['chest'];
  tag: Omit<JusticeMentorLifeState['tag'], 'originalGlyphs'>; register: JusticeMentorLifeState['register']; magnifier: JusticeMentorLifeState['magnifier']; lamp: JusticeMentorLifeState['lamp'];
  sample: JusticeMentorLifeState['sample']; seal: JusticeMentorLifeState['seal']; screen: JusticeMentorLifeState['screen']; door: JusticeMentorLifeState['door'];
  cases: { id: JusticeMentorCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: JusticeMentorAttempt[] }[];
  actions: JusticeMentorLifeAction[];
}
export const JUSTICE_MENTOR_LIFE_STORY = '正义导师·太阳序列3。两项新技巧“共享光辉”“清晰标记”为本作借低阶太阳根基拓展的原创G，不是原文已核技能名录；第三案只继承序列4净化。原人物、原物、距离、秒数、精力与难度均为G。观察、准备、实施、报告各1行动，准备须余2行动；子步0行动仍实耗资源。每案最多一次6灵性检验，失败可普通收束；三个真实报告各扮演25、反思25，能力实际发挥作用并报告才给对应掌握8。合作不强制行动，不回满精力；字形不是案件答案，友善灵体没有太阳免疫。';
const CASES = [
  { id: 'paired-lift', title: 'G · 两位自愿助手与同一原工具箱', story: '阿娅37岁、尼文44岁各自当面同意后，沿8米干燥平路共同搬同一JM3-CHEST到塞尔比的BENCH。有限鼓舞成功时各耗3精力，否则各耗6；出发前各须至少8精力，预留普通回程。本人随行，业主接收原箱后两人各耗2精力沿原8米空手回START，本人沿8米回EXIT。这是抽象游戏动作，不是现实搬运教程。' },
  { id: 'faded-label', title: 'G · 原淡标记与实际交接证据', story: '沿3米路到TABLE，借原放大镜、原灯、原保管牌和原交接册。有限清晰标记只显原有字形；失败可花4秒和原灯1油单位普通核读。先记待证假说，再沿原路分别问塞尔比与尼文并读同一原签注，才能核实；旧假说保留，结论不改写箱子位置。' },
  { id: 'shielded-sample', title: 'G · 原友善灵体先走出，再处理原残留', story: '沿4米普通路到原试台，确认原屏架与OPEN普通门。榆音是业主已联系的既存友善旁观灵，须本次自愿沿4米廊道到SIDE，才能使用会伤灵的继承净化。原低强超自然残留成功2→0，失败仍2；都用同一原盒和原封条真实封存。停止光后邀请原灵普通走回，可拒绝留SIDE；本人沿4米原路退出。不是疾病、药品或现实处理教程。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 3;
const freshCase = (): JusticeMentorCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): JusticeMentorAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, ayaConsent: 'UNASKED', nivenConsent: 'UNASKED', spiritConsent: 'UNASKED', ayaConsentWeek: null, nivenConsentWeek: null, spiritConsentWeek: null,
    siteVisited: false, stopped: false, refused: false, inspected: false, itemsReturned: false, playerReturned: false,
    routeChecked: false, carried: false, carryBenefit: false, chestReceived: false, helpersReturned: false, ayaEnergySpent: 0, nivenEnergySpent: 0, helperTravelMetres: 0, chestTravelMetres: 0,
    glyphs: [], lampRead: false, lampOilSpent: 0, hypothesis: null, hypothesisHistory: [], selbyAsked: false, nivenAsked: false, registerRead: false, verified: false,
    screenChecked: false, spiritSteppedOut: false, spiritDisposition: null, spiritTravelMetres: 0, lightActive: false, lightStopped: false, sampleSealed: false, sealSpent: 0 };
}
export function createJusticeMentorLifeState(): JusticeMentorLifeState {
  return { siteId: 'JM3-WORKCOURT', activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 0, clockSeconds: 0,
    selby: { id: 'JM3-SELBY', name: '塞尔比', age: 48, alive: true, willing: true, location: 'BENCH' },
    aya: { id: 'JM3-AYA', name: '阿娅', age: 37, alive: true, willing: true, present: true, location: 'START', energy: 100, travelMetres: 0 },
    niven: { id: 'JM3-NIVEN', name: '尼文', age: 44, alive: true, willing: true, present: true, location: 'START', energy: 100, travelMetres: 0 },
    elm: { id: 'JM3-ELM', name: '榆音', friendly: true, willing: true, location: 'TABLE', travelMetres: 0 },
    chest: { id: 'JM3-CHEST', owner: 'JM3-SELBY', location: 'START', custody: 'OWNER', travelMetres: 0 },
    tag: { id: 'JM3-TAG', owner: 'JM3-SELBY', location: 'TABLE', originalGlyphs: ['OLD_BAY', 'SECOND_SHIFT'] },
    register: { id: 'JM3-REGISTER', owner: 'JM3-SELBY', location: 'TABLE' }, magnifier: { id: 'JM3-MAGNIFIER', owner: 'JM3-SELBY', location: 'TABLE', durability: 100 },
    lamp: { id: 'JM3-LAMP', owner: 'JM3-SELBY', location: 'TABLE', oil: 2 },
    sample: { id: 'JM3-SAMPLE', owner: 'JM3-SELBY', quantity: 1, contamination: 2, location: 'TABLE', boxId: 'JM3-SAMPLE-BOX', sealed: false },
    seal: { id: 'JM3-SEAL', remaining: 1 }, screen: { id: 'JM3-SCREEN', intact: true, placed: false, durability: 100 }, door: { id: 'JM3-DOOR', state: 'OPEN' },
    cases: { 'paired-lift': freshCase(), 'faded-label': freshCase(), 'shielded-sample': freshCase() }, reflected: false };
}
const currentAttempt = (s: SliceState) => s.justiceMentor.life.activeCase ? s.justiceMentor.life.cases[s.justiceMentor.life.activeCase!].attempts.at(-1) ?? null : null;
function elapse(s: SliceState, a: JusticeMentorAttempt, seconds: number) { a.elapsedSeconds += seconds; s.justiceMentor.life.clockSeconds += seconds; }
function walk(s: SliceState, a: JusticeMentorAttempt, to: JusticeMentorLocation, metres: number) { s.justiceMentor.life.playerLocation = to; s.justiceMentor.life.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres); }
function setResult(s: SliceState, id: JusticeMentorCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.justiceMentor.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
function cleanupBlock(s: SliceState): string | null {
  const l = s.justiceMentor.life, a = currentAttempt(s);
  if (l.aya.location !== 'START' || l.niven.location !== 'START' || l.chest.custody !== 'OWNER') return '先原主接回同一原箱、两助手沿原8米普通返回；撤回同意不扣押人或箱。';
  if ([l.tag, l.register, l.magnifier, l.lamp].some(x => x.location === 'PLAYER')) return '先本人携同一原借物真实到BENCH交还原主。';
  if (a?.lightActive) return '先停止本次太阳作用，友善身份没有免疫。';
  if (a?.spiritSteppedOut && a.spiritDisposition === null) return '停止后当面邀请原灵返回；它可拒绝留SIDE，不自动召回。';
  if (a?.siteVisited && l.activeCase === 'shielded-sample' && !a.sampleSealed) return '先把同一原样本放回原盒并耗原封条；封存不声称净化。';
  return l.playerLocation === 'EXIT' ? null : '本人须沿原普通通路真实回到EXIT。';
}
export const hasJusticeMentorLifeLock = (s: SliceState): boolean => s.justiceMentor.life.activeCase !== null || Object.values(s.justiceMentor.life.cases).some(x => x.status === 'PREPARED') || cleanupBlock(s) !== null;
export const justiceMentorInside = hasJusticeMentorLifeLock;
const COMMON = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'GO_SITE', 'RETURN_PLAYER', 'RETURN_ITEMS', 'INSPECT', 'STOP_CONTACT'];
const SPECIFIC: Record<JusticeMentorCaseId, readonly string[]> = { 'paired-lift': ['CONSENT_AYA', 'CONSENT_NIVEN', 'CHECK_ROUTE', 'ENCOURAGE', 'CARRY_CHEST', 'RECEIVE_CHEST', 'RETURN_HELPERS'], 'faded-label': ['REVEAL_GLYPHS', 'READ_LAMP', 'ASK_SELBY', 'ASK_NIVEN', 'READ_REGISTER', 'VERIFY'], 'shielded-sample': ['CHECK_SCREEN', 'CONSENT_SPIRIT', 'MOVE_SPIRIT', 'PURIFY', 'STOP_EFFECT', 'SEAL_SAMPLE', 'INVITE_SPIRIT_RETURN'] };
export function validateJusticeMentorActivityCommand(v: unknown): v is JusticeMentorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!JUSTICE_MENTOR_CASE_IDS.includes(v.caseId as JusticeMentorCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'HYPOTHESIZE') return v.caseId === 'faded-label' && shape(v, ['type', 'caseId', 'hypothesis']) && ['MISSING_ITEM', 'REASSIGNED'].includes(String(v.hypothesis));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as JusticeMentorCaseId].includes(String(v.type)));
}
export const isJusticeMentorActivityCommand = validateJusticeMentorActivityCommand;
export const isJusticeMentorActivity = validateJusticeMentorActivityCommand;
const ownerConsents = (s: SliceState, a: JusticeMentorAttempt) => !a.stopped && a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.justiceMentor.life.selby.willing;
const helperConsents = (s: SliceState, a: JusticeMentorAttempt) => (['aya', 'niven'] as const).every(k => a[`${k}Consent`] === 'GRANTED' && a[`${k}ConsentWeek`] === s.week && s.justiceMentor.life[k].willing && s.justiceMentor.life[k].present);
export function blockJusticeMentorLife(s: SliceState, c: JusticeMentorActivityCommand): string | null {
  if (!validateJusticeMentorActivityCommand(c)) return '正义导师生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已实际晋升正义导师序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原JM3-WORKCOURT。';
  if (['READY', 'FIGHTING'].includes(s.justiceMentor.encounter.status)) return '先结束或和平离开原院遭遇。';
  const l = s.justiceMentor.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return !r?.contactOpen || !a || l.activeCase !== c.caseId ? '没有本次开放现场。' : cleanupBlock(s) ?? (a.inspected ? null : '先检查真实退出与原物交还。');
  if (r?.contactOpen && a && !a.closed && 'caseId' in c && l.activeCase === c.caseId) {
    // Ordinary custody and exits remain available after costs, refusal, or withdrawn cooperation.
    if (c.type === 'STOP_CONTACT') return a.stopped || a.inspected ? '本次协作已停止，按原状态收口。' : null;
    if (c.type === 'STOP_EFFECT') return a.lightActive ? null : '没有仍在进行的本次太阳作用。';
    if (c.type === 'RECEIVE_CHEST') return a.carried && !a.chestReceived && l.playerLocation === 'BENCH' && l.chest.location === 'BENCH' && l.chest.custody === 'HELPERS' ? null : '须本人、两原助手与同一原箱确在原主BENCH，才能普通交还。';
    if (c.type === 'RETURN_HELPERS') return a.chestReceived && !a.helpersReturned && l.aya.location === 'BENCH' && l.niven.location === 'BENCH' && l.aya.energy >= 2 && l.niven.energy >= 2 ? null : '先原主接回原箱，再让两原人沿8米普通空手回START；出程已留2精力。';
    if (c.type === 'SEAL_SAMPLE') return a.siteVisited && l.playerLocation === 'TABLE' && !a.lightActive && !l.sample.sealed && l.sample.location === 'TABLE' && l.seal.remaining === 1 ? null : '先停止光，在原台把同一原样本放回原盒，实耗唯一原封条；不凭空清净或复制样本。';
    if (c.type === 'INVITE_SPIRIT_RETURN') return a.spiritSteppedOut && a.spiritDisposition === null && !a.lightActive && l.playerLocation === 'TABLE' && l.elm.location === 'SIDE' ? null : '须先停止太阳作用、原灵确在SIDE，再邀请它普通走回或记录拒绝。';
    if (c.type === 'RETURN_ITEMS') return c.caseId === 'faded-label' && a.siteVisited && !a.itemsReturned && l.playerLocation === 'TABLE' && l.tag.location === 'PLAYER' ? null : '本人须在TABLE携同一原牌、原册和原工具沿5米路到BENCH当面交还。';
    if (c.type === 'RETURN_PLAYER') return l.playerLocation === 'EXIT' ? '本人已在EXIT。' : a.lightActive ? '先停止太阳作用。' : c.caseId === 'paired-lift' && a.carried && (!a.chestReceived || !a.helpersReturned) ? '先普通交箱并让两原助手真实返回。' : c.caseId === 'faded-label' && !a.itemsReturned ? '先携原借物沿普通路交还原主。' : c.caseId === 'shielded-sample' && (!a.sampleSealed || a.spiritSteppedOut && a.spiritDisposition === null) ? '先原盒封存并邀请原灵返回或记录留SIDE。' : null;
    if (c.type === 'INSPECT') return a.inspected ? '已检查，请结束本次现场。' : cleanupBlock(s);
    if (a.inspected) return '本次已检查，请结束现场。';
    if (c.type === 'CONSENT_OWNER') return a.ownerConsent === 'UNASKED' && l.playerLocation === 'EXIT' && !a.stopped ? null : '只在本次开始沿普通8米到BENCH当面询问原主，再走回；不能沿用旧许可。';
    if (!ownerConsents(s, a)) return '须原主当前认可本次用途；拒绝或停止后仍可归还原物、普通退出。';
    if (c.type === 'GO_SITE') return !a.siteVisited && l.playerLocation === 'EXIT' ? null : '本次仅真实入场一次，不复制原物或重置成本。';
    if (c.type === 'CONSENT_AYA' || c.type === 'CONSENT_NIVEN') { const k = c.type === 'CONSENT_AYA' ? 'aya' : 'niven'; return l.playerLocation === 'START' && !a.carried && a[`${k}Consent`] === 'UNASKED' ? null : '须本人在START分别当面问原助手本次是否愿意，不能代替其同意。'; }
    if (c.type === 'CHECK_ROUTE') return l.playerLocation === 'START' && !a.routeChecked ? null : '须本人在原START亲验8米干燥平路与普通返程。';
    if (c.type === 'CARRY_CHEST') return a.routeChecked && !a.carried && l.playerLocation === 'START' && l.chest.location === 'START' && helperConsents(s, a) && [l.aya, l.niven].every(x => x.location === 'START' && x.energy >= 8) ? null : '须两位原助手当前自愿、都在START且各至少8精力；原路检查后共同搬同一原箱，预留普通回程。';
    if (c.type === 'READ_LAMP') return l.playerLocation === 'TABLE' && a.glyphs.length === 0 && !a.lampRead && l.tag.location === 'PLAYER' && l.magnifier.durability > 0 && l.lamp.oil >= 1 ? null : '须本人在原台持原牌、原放大镜与至少1油原灯；普通核读实耗4秒、1油。';
    if (c.type === 'HYPOTHESIZE') return !a.glyphs.length || a.verified || l.playerLocation !== 'TABLE' ? '先在原台实际读到原有字形；核实前才可记录假说。' : a.hypothesis === null ? c.hypothesis === 'MISSING_ITEM' ? null : '先记录眼前字形引出的待证假说，后续须真实调查。' : !a.registerRead || !a.selbyAsked || !a.nivenAsked ? '须先当面询问两位原人并读原签注，再依据证据修正；能力不赠答案。' : a.hypothesisHistory.length >= 2 || c.hypothesis === a.hypothesis ? '保留原假说，只依据这次新证据修正一次。' : null;
    if (c.type === 'ASK_SELBY') return a.hypothesis !== null && !a.selbyAsked && l.playerLocation === 'TABLE' ? null : '先写待证假说，再沿5米普通路到BENCH当面问原主并返回。';
    if (c.type === 'ASK_NIVEN') return a.hypothesis !== null && !a.nivenAsked && l.playerLocation === 'TABLE' && l.niven.location === 'START' && l.niven.willing && l.niven.present ? null : '先写待证假说，再沿3米路去START当面问当前愿意的原尼文并返回。';
    if (c.type === 'READ_REGISTER') return a.selbyAsked && a.nivenAsked && !a.registerRead && l.playerLocation === 'TABLE' && l.register.location === 'PLAYER' ? null : '先当面问两位原人，再在TABLE亲读已借同一原交接册；没有后台答案。';
    if (c.type === 'VERIFY') return !a.registerRead || !a.selbyAsked || !a.nivenAsked ? '须先实际取得原人证词与同一原签注，再核实。' : a.verified || l.playerLocation !== 'TABLE' || a.hypothesis !== 'REASSIGNED' ? '请依据已读证据修正假说后在原台核实，旧选择保留。' : null;
    if (c.type === 'CHECK_SCREEN') return a.siteVisited && l.playerLocation === 'TABLE' && !a.screenChecked && l.screen.intact && l.screen.durability > 0 && l.door.state === 'OPEN' ? null : '须原屏架完好可摆放，普通门实际OPEN；友善身份不替代真实避让。';
    if (c.type === 'CONSENT_SPIRIT') return l.playerLocation === 'TABLE' && a.spiritConsent === 'UNASKED' && l.elm.location === 'TABLE' ? null : '须在TABLE当面询问既存原榆音是否自愿离开本次太阳作用区。';
    if (c.type === 'MOVE_SPIRIT') return a.screenChecked && a.spiritConsent === 'GRANTED' && a.spiritConsentWeek === s.week && l.elm.willing && l.elm.location === 'TABLE' && !a.spiritSteppedOut ? null : '须原灵本次当前愿意，真实沿4米普通廊道到SIDE；拒绝可普通封存。';
    if (c.type === 'ENCOURAGE' || c.type === 'REVEAL_GLYPHS' || c.type === 'PURIFY') {
      if (a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null)) return '每案只有一次能力检验，失败保留6灵性成本；之后普通续办，不重骰。';
      if (s.health <= 0 || s.mind <= 0 || s.spirituality < 6) return '须本人身心尚可且有6灵性；普通退出不依赖灵性。';
      if (c.type === 'ENCOURAGE' && (!a.routeChecked || a.carried || l.playerLocation !== 'START' || !helperConsents(s, a) || [l.aya, l.niven].some(x => x.location !== 'START' || x.energy < 8))) return '须本次两位原助手当前自愿、各至少8精力并已检查原路；鼓舞不会强制或补精力。';
      if (c.type === 'REVEAL_GLYPHS' && (l.playerLocation !== 'TABLE' || l.tag.location !== 'PLAYER' || a.glyphs.length > 0 || a.hypothesis !== null)) return '须在原台面对许可原牌，尚未读到字形或写假说；只显原有淡标记。';
      if (c.type === 'PURIFY' && (!a.screenChecked || !l.screen.intact || !l.screen.placed || l.screen.durability <= 0 || l.playerLocation !== 'TABLE' || !a.spiritSteppedOut || l.elm.location !== 'SIDE' || a.spiritConsent !== 'GRANTED' || a.spiritConsentWeek !== s.week || !l.elm.willing || a.spiritDisposition !== null || l.sample.location !== 'TABLE' || l.sample.sealed || l.sample.contamination !== 2)) return '须原屏架确已摆好，原灵当前自愿且已实际走到SIDE；只处理同一原台强度2残留，友灵不免疫。';
      return null;
    }
    return '按原人原物的当前状态继续，或普通收束。';
  }
  if (hasJusticeMentorLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消准备，或真实收束当前原现场。';
  if (hasUnshadowedLifeLock(s) || hasUnshadowedRitualLock(s) || hasPriestOfLightOpenPractice(s) || Object.values(s.unshadowed.life.cases).some(x => x.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.unshadowed.encounter.status) || s.justiceMentor.preparedWeek !== null) return '先真实收束旧太阳原现场与服药准备，不覆盖旧情感、原人或原物。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '本步骤需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : JUSTICE_MENTOR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知原实践。';
  if (r.status === 'RESOLVED') return '本案已经报告，不重置资源或重复成长。';
  const index = JUSTICE_MENTOR_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[JUSTICE_MENTOR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一案真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案。' : r.attempts.at(-1)?.week === s.week ? '本周真实成本保留，下一真实周才可继续准备。' : c.method === 'ABILITY' && r.attempts.some(x => x.abilityTier !== null) ? '本案已经检验过能力，只能普通续办。' : s.actionsRemaining < 2 ? '准备须至少余2行动，留1行动实施。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须实际收口、检查、普通退出后才能报告。';
  return '没有本次开放现场。';
}
export const blockJusticeMentorActivity = blockJusticeMentorLife;

export function applyJusticeMentorActivity(s: SliceState, c: JusticeMentorActivityCommand, ctx: SeerContext): void {
  const reason = blockJusticeMentorLife(s, c); if (reason) throw new Error(reason);
  const l = s.justiceMentor.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('justice-mentor-reflection'); ctx.note('G · 合作与核实的有限反思', '三份真实报告后扮演+25。原人精力、原灯油、原封条、旧假说与真实残留都保留；没有强制契约、善恶雷达或友军免疫。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消本次未实施准备', '0行动，已付准备行动不退；没有获得许可或移动原人原物。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '一次有限能力' : '普通工作'}，本次原人许可仍须分别取得。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动在EXIT开始。子步0行动但真实秒、米、灵性、精力和消耗分别记录；旧原人原物不复原。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'paired-lift' ? 'sun.s3.shared-radiance' : c.caseId === 'faded-label' ? 'sun.s3.clarity-mark' : 'sun.s4.purification'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `真实报告扮演+25。${r.result === 'ABILITY' ? c.caseId === 'shielded-sample' ? '仅继承序列4净化掌握+8，不虚构第三项序列3技能。' : '本项G技巧实际发挥作用，掌握+8。' : '普通工作或尊重拒绝，无能力掌握。'}原成本与错误假说保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = a.ayaConsent = a.nivenConsent = a.spiritConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('结束原工作院现场', '0行动。原借物已交还、同一原助手真实返回、本人EXIT；原灵可自愿留SIDE。成本、失败和旧假说不退，尚未完成的工作下一真实周普通续办。'); return; }
  switch (c.type) {
    case 'CONSENT_OWNER': walk(s, a, 'BENCH', 8); a.ownerConsent = l.selby.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; a.refused ||= a.ownerConsent === 'DECLINED'; elapse(s, a, 2); walk(s, a, 'EXIT', 8); ctx.note('真实走到原主面前取得本次回答', `本人沿8米到BENCH、当面2秒、沿8米回EXIT，实计16米18秒。塞尔比本次${a.ownerConsent === 'GRANTED' ? '许可具体用途，不替任何助手或灵体同意。' : '拒绝，可普通检查退出，不动原物。'}`); return;
    case 'GO_SITE': a.siteVisited = true; if (c.caseId === 'faded-label') for (const x of [l.tag, l.register, l.magnifier, l.lamp]) x.location = 'PLAYER'; walk(s, a, c.caseId === 'paired-lift' ? 'START' : 'TABLE', c.caseId === 'paired-lift' ? 0 : c.caseId === 'faded-label' ? 3 : 4); elapse(s, a, 1); ctx.note('本人沿原普通通路到现场', `实际${c.caseId === 'paired-lift' ? 'EXIT旁同址START，确认1秒；尚未搬箱。' : c.caseId === 'faded-label' ? '3米3秒到TABLE、1秒借同一原牌、原册、原放大镜与灯，内容尚未读取。' : '4米4秒到TABLE、1秒确认原台；榆音仍在TABLE，不能施光。'}`); return;
    case 'STOP_CONTACT': a.stopped = true; a.refused = true; elapse(s, a, 1); ctx.note('明确停止本次协作', '1秒，不再开展任务或施法。普通停光、原物交还、原人普通回程与本人退出仍可做，既付成本不退。'); return;
    case 'CONSENT_AYA': case 'CONSENT_NIVEN': { const k = c.type === 'CONSENT_AYA' ? 'aya' : 'niven', helper = l[k]; a[`${k}Consent`] = helper.willing && helper.present ? 'GRANTED' : 'DECLINED'; a[`${k}ConsentWeek`] = s.week; a.refused ||= a[`${k}Consent`] === 'DECLINED'; elapse(s, a, 2); ctx.note(`原${helper.name}本人回答本次意愿`, `2秒，${a[`${k}Consent`] === 'GRANTED' ? '仅自愿这一次共同搬原箱，可停止；不恢复原精力。' : '拒绝或不在场，不生成替身，不强迫搬运。'}`); return; }
    case 'CHECK_ROUTE': a.routeChecked = true; elapse(s, a, 2); ctx.note('亲验原8米普通路', '2秒，干燥平路START至BENCH8米，普通返回仍通；两人各须至少8精力，不以魔法保证代替返程储备。'); return;
    case 'CARRY_CHEST': { const cost = success(a.abilityTier) ? 3 : 6; a.carried = true; a.carryBenefit = success(a.abilityTier); a.ayaEnergySpent += cost; a.nivenEnergySpent += cost; a.helperTravelMetres += 8; a.chestTravelMetres += 8; for (const p of [l.aya, l.niven]) { p.location = 'BENCH'; p.energy -= cost; p.travelMetres += 8; } l.chest.location = 'BENCH'; l.chest.custody = 'HELPERS'; l.chest.travelMetres += 8; walk(s, a, 'BENCH', 8); ctx.note('两位原助手共同搬同一原箱，本人随行', `实际8米8秒，两人各耗${cost}精力，剩${l.aya.energy}/${l.niven.energy}；原箱仅此一件，尚须交业主接收。没有第三个搬运者或精力回满。`); return; }
    case 'RECEIVE_CHEST': a.chestReceived = true; l.chest.custody = 'OWNER'; elapse(s, a, 1); setResult(s, c.caseId, a.carryBenefit ? 'ABILITY' : 'ORDINARY'); ctx.note('塞尔比当面接回同一原工具箱', '1秒，JM3-CHEST真实留BENCH、归原主；两位原人仍在BENCH，不能把交箱当成返程。'); return;
    case 'RETURN_HELPERS': for (const p of [l.aya, l.niven]) { p.location = 'START'; p.energy -= 2; p.travelMetres += 8; } a.ayaEnergySpent += 2; a.nivenEnergySpent += 2; a.helperTravelMetres += 8; a.helpersReturned = true; elapse(s, a, 8); ctx.note('两位原助手沿同一8米路空手返回', `实际8秒，各另耗2精力，剩${l.aya.energy}/${l.niven.energy}。原箱留BENCH，本人仍在BENCH，须另沿8米到EXIT。`); return;
    case 'READ_LAMP': l.lamp.oil--; a.lampOilSpent++; a.lampRead = true; a.glyphs = ['OLD_BAY', 'SECOND_SHIFT']; elapse(s, a, 4); ctx.note('用同一原灯和放大镜普通核读', '4秒，原灯油−1。只读到原有OLD_BAY、SECOND_SHIFT两字形，不知所有人、用途或调动缘由；仍须假说、证词与原签注。'); return;
    case 'HYPOTHESIZE': a.hypothesis = c.hypothesis; a.hypothesisHistory.push(c.hypothesis); elapse(s, a, 1); ctx.note(a.hypothesisHistory.length === 1 ? '记录待证假说' : '依据实际新证据修正', c.hypothesis === 'MISSING_ITEM' ? '1秒，暂记“可能涉及遗失物”。这只是待证假说，字形不判断真相或责任。' : '1秒，改为REASSIGNED：旧牌曾调到备用箱。原MISSING_ITEM错误假说仍保存，不改写原箱今天的位置。'); return;
    case 'ASK_SELBY': walk(s, a, 'BENCH', 5); elapse(s, a, 3); a.selbyAsked = true; walk(s, a, 'TABLE', 5); ctx.note('沿普通路当面询问塞尔比并返回', '实际往返10米、另3秒。原主说旧保管牌曾用于旧库位，第二班有交接；这份有限证词需和实际经手人及原签注核对。'); return;
    case 'ASK_NIVEN': walk(s, a, 'START', 3); elapse(s, a, 3); a.nivenAsked = true; walk(s, a, 'TABLE', 3); ctx.note('沿普通路问原尼文并返回', '实际往返6米、另3秒。原尼文自愿确认第二班曾把旧牌调到备用箱，并留下原交接签注；还须亲读同一原册核对。'); return;
    case 'READ_REGISTER': a.registerRead = true; elapse(s, a, 3); ctx.note('亲读同一原交接签注', '3秒，JM3-REGISTER原签注记“第二班，尼文将旧库位牌转作备用箱保管牌”。它原先存在，不由能力生成；结合两位原人证词才支持调配用途。'); return;
    case 'VERIFY': a.verified = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('据原证词与原签注核实', '2秒，核实旧牌被调到备用箱，原错误假说保留；两字形自身不证明遗失或有罪。JM3-CHEST当前位置不受查阅历史改变。'); return;
    case 'CHECK_SCREEN': a.screenChecked = true; l.screen.placed = true; elapse(s, a, 2); ctx.note('检查并摆好同一原屏架', '2秒，原屏架完好且已摆好，原普通门仍OPEN。屏架不赋予友灵免疫，榆音仍须本人自愿实际走到SIDE。'); return;
    case 'CONSENT_SPIRIT': a.spiritConsent = l.elm.willing ? 'GRANTED' : 'DECLINED'; a.spiritConsentWeek = s.week; a.refused ||= a.spiritConsent === 'DECLINED'; elapse(s, a, 2); ctx.note('询问既存原榆音的本次意愿', a.spiritConsent === 'GRANTED' ? '2秒，它同意本次自行沿普通廊道退到SIDE，尚未移动；不是召唤新灵或强制契约。' : '2秒，它拒绝移动；不能对仍在原台旁的友灵施太阳能力，可普通封存同一样本。'); return;
    case 'MOVE_SPIRIT': l.elm.location = 'SIDE'; l.elm.travelMetres += 4; a.spiritTravelMetres += 4; a.spiritSteppedOut = true; elapse(s, a, 4); ctx.note('原榆音自行沿4米普通廊道退开', '实际4米4秒，同一原灵从TABLE到SIDE，未复制、消失或获得免疫。本人仍在原台。'); return;
    case 'STOP_EFFECT': a.lightActive = false; a.lightStopped = true; elapse(s, a, 1); ctx.note('停止本次太阳作用', '1秒，停光不会自动移动原灵、净化失败残留或消耗封条。'); return;
    case 'SEAL_SAMPLE': l.sample.location = 'BOX'; l.sample.sealed = true; l.seal.remaining--; a.sealSpent++; a.sampleSealed = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('同一原样本放回原盒并耗唯一原封条', `实际2秒，JM3-SEAL 1→0，原样本数量仍1、强度${l.sample.contamination}。${l.sample.contamination === 0 ? '成功净化的事实保留。' : '仅普通封存，未净化事实保留，不能写成2→0。'}`); return;
    case 'INVITE_SPIRIT_RETURN': elapse(s, a, 2); if (l.elm.willing) { l.elm.location = 'TABLE'; l.elm.travelMetres += 4; a.spiritTravelMetres += 4; a.spiritDisposition = 'RETURNED'; elapse(s, a, 4); } else { a.spiritDisposition = 'STAY_SIDE'; a.refused = true; } ctx.note('停光后重新邀请原榆音', a.spiritDisposition === 'RETURNED' ? '当面邀请2秒，原灵本人当前自愿沿原4米廊道走回、另4秒；未自动召回。' : '邀请2秒，原灵当前拒绝返回，实际留SIDE；允许如实记录并普通退出，不强制召回。'); return;
    case 'RETURN_ITEMS': walk(s, a, 'BENCH', 5); for (const x of [l.tag, l.register, l.magnifier, l.lamp]) x.location = 'OWNER'; a.itemsReturned = true; elapse(s, a, 1); ctx.note('携同一原借物走到原主面前交还', '实际TABLE至BENCH5米5秒、交还1秒。原牌、原册、原放大镜和灯归原主，油耗保留；本人仍在BENCH，原箱不被调查历史移回。'); return;
    case 'RETURN_PLAYER': { const metres = l.playerLocation === 'BENCH' ? 8 : c.caseId === 'shielded-sample' ? 4 : l.playerLocation === 'START' ? 0 : 3; walk(s, a, 'EXIT', metres); a.playerReturned = true; ctx.note('本人沿原普通通路真实退出', `实际${metres}米${metres}秒回EXIT，0行动0灵性。普通门一直OPEN，不靠施法许可维持出口；原人原物留真实位置。`); return; }
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (r.result === 'NONE' && (a.stopped || a.refused || a.ownerConsentWeek !== null && !l.selby.willing || c.caseId === 'paired-lift' && (a.ayaConsentWeek !== null && (!l.aya.willing || !l.aya.present) || a.nivenConsentWeek !== null && (!l.niven.willing || !l.niven.present)) || c.caseId === 'faded-label' && a.hypothesis !== null && (!l.niven.willing || !l.niven.present))) { a.refused = true; setResult(s, c.caseId, 'ORDINARY'); } ctx.note('检查原人原物和普通退出', `2秒。本人EXIT，两原助手START，精力${l.aya.energy}/${l.niven.energy}；原灯油${l.lamp.oil}，原样本强度${l.sample.contamination}，原封条${l.seal.remaining}。未完成中止不冒充能力成功。`); return;
    case 'ENCOURAGE': case 'REVEAL_GLYPHS': case 'PURIFY': s.spirituality -= 6; a.spiritualitySpent = 6; a.abilityTier = ctx.check(c.type === 'REVEAL_GLYPHS' ? 'knowledge' : 'will', 18).tier; elapse(s, a, 2); if (c.type === 'PURIFY') { a.lightActive = true; if (success(a.abilityTier)) l.sample.contamination = 0; } else if (c.type === 'REVEAL_GLYPHS' && success(a.abilityTier)) a.glyphs = ['OLD_BAY', 'SECOND_SHIFT']; ctx.note(success(a.abilityTier) ? '一次有限能力检验成功' : '一次有限能力检验失败', `实耗6灵性2秒，${c.type === 'REVEAL_GLYPHS' ? '知识' : '意志'}18，本案不重骰。${success(a.abilityTier) ? c.type === 'ENCOURAGE' ? '只使本次自愿出程各耗3而非6精力，尚未搬箱、不补精力。' : c.type === 'REVEAL_GLYPHS' ? '仅显原有OLD_BAY、SECOND_SHIFT字形；没有用途、失主或裁决答案。' : '继承序列4净化使同一原残留2→0；原灵确在SIDE，仍须停光和原盒封存。' : c.type === 'PURIFY' ? '同一原残留仍2，仍须停光，再耗原封条普通封存。' : '没有额外作用；可自愿普通搬原箱，或耗原灯油核读原字形。'}`); return;
  }
}

export function justiceMentorLifeActions(s: SliceState): JusticeMentorLifeAction[] {
  if (s.progression.pathwayId === 'sun' && s.progression.sequence === 2) return [];
  const l = s.justiceMentor.life, out: JusticeMentorLifeAction[] = [];
  const add = (label: string, cost: string, command: JusticeMentorActivityCommand) => { const reason = blockJusticeMentorLife(s, command); out.push({ id: `JM3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'hypothesis' in command ? `:${command.hypothesis}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const caseId of JUSTICE_MENTOR_CASE_IDS) {
    const r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add('观察本案原人、原物与普通出口', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备本案一次有限能力' : '准备普通真实工作', '1行动 · 须余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('从EXIT开始实施', '1行动 · 后续子步0行动', { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 已付准备不退', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告本案真实结果', '1行动 · 扮演25 · 实际有效能力掌握8', { type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    add('走到原主面前询问本次用途许可，再真实返回', '0行动 · 往返16米 · 18秒 · 原主可拒绝', { type: 'CONSENT_OWNER', caseId });
    add('沿原普通通路到本案现场', `0行动 · ${caseId === 'paired-lift' ? '同址START确认1秒' : caseId === 'faded-label' ? '3米加1秒借原物' : '4米加1秒确认原台'}`, { type: 'GO_SITE', caseId });
    if (caseId === 'paired-lift') {
      add('当面问原阿娅本次是否愿意', '0行动 · 2秒 · 不替本人同意', { type: 'CONSENT_AYA', caseId });
      add('当面问原尼文本次是否愿意', '0行动 · 2秒 · 不替本人同意', { type: 'CONSENT_NIVEN', caseId });
      add('亲验原8米干燥平路和普通返程', '0行动 · 2秒 · 各须留2精力返程', { type: 'CHECK_ROUTE', caseId });
      if (r.method === 'ABILITY') add('G共享光辉鼓舞两位当前自愿原助手', '0行动 · 6灵性 · 意志18 · 2秒 · 本案一次 · 不补精力', { type: 'ENCOURAGE', caseId });
      add('两位原助手共同搬原箱，本人实际随行', '0行动 · 各8米 · 8秒 · 各耗3或6精力 · 须各至少8精力', { type: 'CARRY_CHEST', caseId });
      add('原主当面接回同一原工具箱', '0行动 · 1秒 · 原箱留BENCH', { type: 'RECEIVE_CHEST', caseId });
      add('两位原助手沿原8米路空手返回', '0行动0灵性 · 8秒 · 各再耗2精力', { type: 'RETURN_HELPERS', caseId });
    } else if (caseId === 'faded-label') {
      if (r.method === 'ABILITY') add('G清晰标记仅显原牌已有淡字形', '0行动 · 6灵性 · 知识18 · 2秒 · 本案一次 · 不赠答案', { type: 'REVEAL_GLYPHS', caseId });
      add('用原灯和原放大镜普通核读淡字形', '0行动0灵性 · 4秒 · 原灯1油', { type: 'READ_LAMP', caseId });
      add('记录待证假说：可能涉及遗失物', '0行动 · 1秒 · 假说不是事实', { type: 'HYPOTHESIZE', caseId, hypothesis: 'MISSING_ITEM' });
      add('走到BENCH问塞尔比，再回原台', '0行动 · 往返10米 · 另3秒', { type: 'ASK_SELBY', caseId });
      add('走到START问自愿的原尼文，再回原台', '0行动 · 往返6米 · 另3秒', { type: 'ASK_NIVEN', caseId });
      add('亲读同一原交接册的原签注', '0行动 · 3秒 · 须先当面取得两份证词', { type: 'READ_REGISTER', caseId });
      if (a?.registerRead && a.selbyAsked && a.nivenAsked) add('据新证据修正为REASSIGNED，保留旧假说', '0行动 · 1秒 · 不改写原箱位置', { type: 'HYPOTHESIZE', caseId, hypothesis: 'REASSIGNED' });
      add('据原人证词和亲读原签注核实', '0行动 · 2秒 · 原字形单独不裁定真相', { type: 'VERIFY', caseId });
      add('携原牌、原册和原工具真实交还原主', '0行动0灵性 · TABLE至BENCH5米 · 另1秒', { type: 'RETURN_ITEMS', caseId });
    } else {
      add('检查并摆好同一原屏架，确认OPEN普通门', '0行动 · 2秒 · 不授友灵免疫', { type: 'CHECK_SCREEN', caseId });
      add('当面询问原榆音本次是否愿意退开', '0行动 · 2秒 · 既存原灵可拒绝', { type: 'CONSENT_SPIRIT', caseId });
      add('原榆音自愿沿4米普通廊道走到SIDE', '0行动 · 4米4秒 · 本人留原台', { type: 'MOVE_SPIRIT', caseId });
      if (r.method === 'ABILITY') add('继承序列4净化处理同一原残留', '0行动 · 6灵性 · 意志18 · 2秒 · 本案一次 · 须原灵确在SIDE', { type: 'PURIFY', caseId });
      add('停止本次太阳作用', '0行动0灵性 · 1秒 · 不自动净化或召回', { type: 'STOP_EFFECT', caseId });
      add('同一原样本放回原盒并耗原封条', '0行动0灵性 · 2秒 · 原封条1→0 · 封存不等于净化', { type: 'SEAL_SAMPLE', caseId });
      add('停光后邀请原灵普通返回或记录留SIDE', '0行动 · 邀请2秒 · 自愿返回另4米4秒', { type: 'INVITE_SPIRIT_RETURN', caseId });
    }
    add('停止本次协作，按原状态普通收束', '0行动 · 1秒 · 不退成本', { type: 'STOP_CONTACT', caseId });
    add('本人沿原普通通路真实回EXIT', `0行动0灵性 · ${caseId === 'shielded-sample' ? '4米4秒' : 'BENCH至EXIT8米8秒，START与EXIT同址'}`, { type: 'RETURN_PLAYER', caseId });
    add('检查原人原物、已付成本和普通退出', '0行动 · 2秒', { type: 'INSPECT', caseId });
    add('结束本次真实现场', '0行动 · 须先普通收口和检查', { type: 'CLOSE', caseId });
    add('中止本次现场并保留真实成本', '0行动 · 未完成可下一真实周普通续办', { type: 'WITHDRAW', caseId });
  }
  add('反思三案合作、证据与友伤边界', '1行动 · 三报告后扮演25', { type: 'REFLECT' });
  return out;
}
function observations(id: JusticeMentorCaseId, a?: JusticeMentorAttempt): string[] {
  if (!a) return [];
  const out = [`本次${a.elapsedSeconds}秒、本人${a.playerTravelMetres}米、${a.spiritualitySpent}灵性；原主当前许可${a.ownerConsent}，许可周${a.ownerConsentWeek ?? '未取得'}。`];
  if (id === 'paired-lift') {
    out.push(`原阿娅/尼文本次许可${a.ayaConsent}/${a.nivenConsent}；过去同意不能替代当前自愿。`);
    if (a.carried) out.push(`同一两位助手已共同搬同一原箱8米，本次各走${a.helperTravelMetres}米，各耗${a.ayaEnergySpent}/${a.nivenEnergySpent}精力；${a.carryBenefit ? '有限鼓舞实际降低这一次出程耗费。' : '普通出程各耗6，无免费能力作用。'}`);
    if (a.chestReceived) out.push('原主已在BENCH接回同一JM3-CHEST，没有箱子副本。');
    if (a.helpersReturned) out.push('两位原人已各沿原8米空手回START，各再耗2精力。');
  } else if (id === 'faded-label') {
    if (a.glyphs.length) out.push(`实际仅见原有字形${a.glyphs.join('、')}，不是失主、用途或责任答案。`);
    if (a.lampRead) out.push('普通核读实耗4秒和原灯1油，能力失败没有免除普通成本。');
    if (a.hypothesis !== null) out.push(`假说历史：${a.hypothesisHistory.join(' → ')}，旧错误选择保留。`);
    if (a.selbyAsked) out.push('已走真实往返10米问原主：旧牌曾用于旧库位，第二班有交接。');
    if (a.nivenAsked) out.push('已走真实往返6米问原尼文：他称第二班把旧牌调到备用箱，仍须原签注核对。');
    if (a.registerRead) out.push('已亲读同一JM3-REGISTER原签注：第二班尼文将旧库位牌转作备用箱保管牌。');
    if (a.verified) out.push('已据两位原人证词和原签注核实REASSIGNED；原箱当前位置和过去都未改写。');
  } else {
    if (a.screenChecked) out.push('原屏架实际检查并摆好，普通门OPEN；它不授予友灵免疫。');
    if (a.spiritConsentWeek !== null) out.push(`既存原榆音本次许可${a.spiritConsent}；可拒绝或停止。`);
    if (a.spiritSteppedOut) out.push('同一原灵已实际沿4米廊道从TABLE到SIDE，能力没有自动排除友军。');
    if (a.abilityTier !== null) out.push(success(a.abilityTier) ? '继承序列4净化实际使同一原残留2→0。' : '继承净化失败，同一原残留保持2，不能冒充清净。');
    if (a.lightStopped) out.push('已实际停光，未自动召回原灵或消除失败残留。');
    if (a.sampleSealed) out.push('同一原样本数量仍1，已回原盒，唯一原封条1→0；封存与净化分开记录。');
    if (a.spiritDisposition) out.push(a.spiritDisposition === 'RETURNED' ? '停光后再次邀请，原灵当前自愿沿4米普通走回；累计真实8米。' : '停光后邀请被拒绝，原灵自愿留SIDE，不强制或自动召回。');
  }
  if (a.abilityTier !== null) out.push(`本案一次能力检验${a.abilityTier}，实耗6灵性，后续不可重骰。`);
  if (a.refused) out.push('本次有拒绝或停止，按真实状态普通收束，未完成的能力不授掌握。');
  if (a.itemsReturned) out.push('已携同一原借物沿5米普通路当面交还原主，原灯油不恢复。');
  return out;
}
export function projectJusticeMentorLife(s: SliceState): JusticeMentorLifeProjection {
  const l = s.justiceMentor.life, { originalGlyphs: _originalGlyphs, ...publicTag } = l.tag;
  return { title: '正义导师·太阳序列3（合作与核实G）', story: JUSTICE_MENTOR_LIFE_STORY,
    environment: '原JM3-WORKCOURT：EXIT与START同址；至业主BENCH8米，标签TABLE普通路3米、TABLE至BENCH5米；原试台另沿4米廊道进入。榆音从原试台至SIDE4米。所有通路普通、干燥且OPEN，不是法术牢笼。具体距离、工料与强度为本作G；不是现实搬运或残留处理教程。',
    activeCase: l.activeCase, inside: hasJusticeMentorLifeLock(s), insideCase: hasJusticeMentorLifeLock(s), reflected: l.reflected,
    clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, currentAttempt: structuredClone(currentAttempt(s)),
    selby: { ...l.selby }, aya: { ...l.aya }, niven: { ...l.niven }, elm: { ...l.elm }, chest: { ...l.chest }, tag: publicTag, register: { ...l.register }, magnifier: { ...l.magnifier }, lamp: { ...l.lamp }, sample: { ...l.sample }, seal: { ...l.seal }, screen: { ...l.screen }, door: { ...l.door },
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: observations(x.id, r.attempts.at(-1)), status: r.status, method: r.method,
      result: r.attempts.length ? r.result === 'NONE' ? '尚未完成真实工作，成本与原状态保留。' : r.result === 'ABILITY' ? '对应能力实际发挥作用，原人物件与真实收口仍须核实。' : '普通工作或尊重拒绝，不授能力掌握。' : null,
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: justiceMentorLifeActions(s) };
}

/** Original identities, actual travel, nonrenewable costs, current contact and once-only growth. */
export function validateJusticeMentorLife(s: SliceState): boolean {
  const l = s.justiceMentor?.life, initial = createJusticeMentorLifeState(), promotion = s.justiceMentor?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, JUSTICE_MENTOR_CASE_IDS)) return false;
  for (const key of ['selby', 'aya', 'niven', 'elm', 'chest', 'tag', 'register', 'magnifier', 'lamp', 'sample', 'seal', 'screen', 'door'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.siteId !== initial.siteId || !['EXIT', 'START', 'TABLE', 'BENCH'].includes(l.playerLocation) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.activeCase !== null && !JUSTICE_MENTOR_CASE_IDS.includes(l.activeCase)) return false;
  if (l.selby.id !== 'JM3-SELBY' || l.selby.name !== '塞尔比' || l.selby.age !== 48 || l.selby.alive !== true || l.selby.location !== 'BENCH' || typeof l.selby.willing !== 'boolean') return false;
  for (const key of ['aya', 'niven'] as const) { const p = l[key], original = initial[key]; if (p.id !== original.id || p.name !== original.name || p.age !== original.age || p.alive !== true || typeof p.willing !== 'boolean' || typeof p.present !== 'boolean' || !['START', 'BENCH'].includes(p.location) || !integer(p.energy, 0, 100) || !integer(p.travelMetres)) return false; }
  if (l.elm.id !== 'JM3-ELM' || l.elm.name !== '榆音' || l.elm.friendly !== true || typeof l.elm.willing !== 'boolean' || !['TABLE', 'SIDE'].includes(l.elm.location) || !integer(l.elm.travelMetres)) return false;
  if (l.chest.id !== 'JM3-CHEST' || l.chest.owner !== 'JM3-SELBY' || !['START', 'BENCH'].includes(l.chest.location) || !['OWNER', 'HELPERS'].includes(l.chest.custody) || !integer(l.chest.travelMetres, 0, 8)) return false;
  for (const key of ['tag', 'register', 'magnifier', 'lamp'] as const) if (l[key].id !== initial[key].id || l[key].owner !== 'JM3-SELBY' || !['TABLE', 'PLAYER', 'OWNER'].includes(l[key].location) || l[key].location !== l.tag.location) return false;
  if (stableStringify(l.tag.originalGlyphs) !== stableStringify(initial.tag.originalGlyphs) || l.magnifier.durability !== 100 || !integer(l.lamp.oil, 0, 2)) return false;
  if (l.sample.id !== 'JM3-SAMPLE' || l.sample.owner !== 'JM3-SELBY' || l.sample.quantity !== 1 || ![0, 2].includes(l.sample.contamination) || !['TABLE', 'BOX'].includes(l.sample.location) || l.sample.boxId !== 'JM3-SAMPLE-BOX' || typeof l.sample.sealed !== 'boolean' || (l.sample.location === 'BOX') !== l.sample.sealed) return false;
  if (l.seal.id !== 'JM3-SEAL' || !integer(l.seal.remaining, 0, 1) || l.screen.id !== 'JM3-SCREEN' || typeof l.screen.intact !== 'boolean' || typeof l.screen.placed !== 'boolean' || !integer(l.screen.durability, 0, 100) || stableStringify(l.door) !== stableStringify(initial.door)) return false;
  let open = 0, prepared = 0, resolved = 0, seconds = 0, metres = 0, helperMetres = 0, ayaEnergy = 0, nivenEnergy = 0, chestMetres = 0, oil = 0, seals = 0, spiritMetres = 0;
  let anyCarry = false, received = false, anyPurified = false, anyScreen = false, anyLabelVisit = false;
  let helperAtBench = false, spiritAtSide = false;
  for (const [index, id] of JUSTICE_MENTOR_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[JUSTICE_MENTOR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let previousWeek = r.observedWeek - 1, checks = 0;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, previousWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !integer(a.elapsedSeconds) || !integer(a.playerTravelMetres) || !integer(a.spiritualitySpent, 0, 6)) return false;
      for (const key of ['closed', 'siteVisited', 'stopped', 'refused', 'inspected', 'itemsReturned', 'playerReturned', 'routeChecked', 'carried', 'carryBenefit', 'chestReceived', 'helpersReturned', 'lampRead', 'selbyAsked', 'nivenAsked', 'registerRead', 'verified', 'screenChecked', 'spiritSteppedOut', 'lightActive', 'lightStopped', 'sampleSealed'] as const) if (typeof a[key] !== 'boolean') return false;
      for (const key of ['ayaEnergySpent', 'nivenEnergySpent', 'helperTravelMetres', 'chestTravelMetres', 'lampOilSpent', 'spiritTravelMetres', 'sealSpent'] as const) if (!integer(a[key])) return false;
      for (const [consent, week] of [[a.ownerConsent, a.ownerConsentWeek], [a.ayaConsent, a.ayaConsentWeek], [a.nivenConsent, a.nivenConsentWeek], [a.spiritConsent, a.spiritConsentWeek]] as const) if (!['UNASKED', 'GRANTED', 'DECLINED', 'CLOSED'].includes(consent) || week !== null && week !== a.week || consent === 'UNASKED' && week !== null || ['GRANTED', 'DECLINED'].includes(consent) && week === null || (consent === 'CLOSED') !== a.closed) return false;
      if (a.abilityTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.abilityTier) || ![null, 'RETURNED', 'STAY_SIDE'].includes(a.spiritDisposition) || !Array.isArray(a.glyphs) || !Array.isArray(a.hypothesisHistory) || a.hypothesisHistory.length > 2 || a.hypothesis !== (a.hypothesisHistory.at(-1) ?? null)) return false;
      if (stableStringify(a.hypothesisHistory) !== stableStringify(a.hypothesis === null ? [] : a.hypothesis === 'MISSING_ITEM' ? ['MISSING_ITEM'] : ['MISSING_ITEM', 'REASSIGNED'])) return false;
      if (a.siteVisited && a.ownerConsentWeek === null || a.playerReturned && !a.siteVisited || a.itemsReturned && !a.siteVisited || a.stopped && !a.refused) return false;
      if (a.abilityTier !== null) { checks++; if (a.method !== 'ABILITY' || a.spiritualitySpent !== 6 || !a.siteVisited || (id === 'paired-lift' ? !a.routeChecked || a.ayaConsentWeek === null || a.nivenConsentWeek === null : id === 'faded-label' ? false : !a.screenChecked || !a.spiritSteppedOut || a.spiritConsentWeek === null)) return false; }
      else if (a.spiritualitySpent !== 0) return false;
      if (a.routeChecked && !a.siteVisited || a.carried && (!a.routeChecked || a.ayaConsentWeek === null || a.nivenConsentWeek === null) || a.carryBenefit !== (a.carried && success(a.abilityTier)) || a.chestReceived && !a.carried || a.helpersReturned && !a.chestReceived) return false;
      const helperCost = a.carried ? (a.carryBenefit ? 3 : 6) + (a.helpersReturned ? 2 : 0) : 0;
      if (a.ayaEnergySpent !== helperCost || a.nivenEnergySpent !== helperCost || a.helperTravelMetres !== (a.carried ? a.helpersReturned ? 16 : 8 : 0) || a.chestTravelMetres !== (a.carried ? 8 : 0)) return false;
      const hasGlyphs = id === 'faded-label' && (success(a.abilityTier) || a.lampRead);
      if (stableStringify(a.glyphs) !== stableStringify(hasGlyphs ? ['OLD_BAY', 'SECOND_SHIFT'] : []) || a.lampOilSpent !== (a.lampRead ? 1 : 0) || a.lampRead && (!a.siteVisited || success(a.abilityTier)) || a.hypothesis !== null && !hasGlyphs || (a.selbyAsked || a.nivenAsked) && a.hypothesis === null || a.registerRead && (!a.selbyAsked || !a.nivenAsked) || a.hypothesisHistory.length === 2 && !a.registerRead || a.verified && (!a.registerRead || a.hypothesis !== 'REASSIGNED')) return false;
      if (a.screenChecked && !a.siteVisited || a.spiritSteppedOut && (!a.screenChecked || a.spiritConsentWeek === null) || a.spiritDisposition !== null && (!a.spiritSteppedOut || a.lightActive) || a.spiritTravelMetres !== (a.spiritSteppedOut ? a.spiritDisposition === 'RETURNED' ? 8 : 4 : 0)) return false;
      const lightAttempted = id === 'shielded-sample' && a.abilityTier !== null;
      if (a.lightActive !== (lightAttempted && !a.lightStopped) || a.lightStopped && !lightAttempted || a.sampleSealed && (!a.siteVisited || a.lightActive) || a.sealSpent !== (a.sampleSealed ? 1 : 0)) return false;
      if (id !== 'paired-lift' && (a.ayaConsentWeek !== null || a.nivenConsentWeek !== null || a.routeChecked || a.carried || a.chestReceived || a.helpersReturned || a.helperTravelMetres || a.chestTravelMetres || a.ayaEnergySpent || a.nivenEnergySpent)) return false;
      if (id !== 'faded-label' && (a.glyphs.length || a.lampRead || a.lampOilSpent || a.hypothesis !== null || a.selbyAsked || a.nivenAsked || a.registerRead || a.verified || a.itemsReturned)) return false;
      if (id !== 'shielded-sample' && (a.screenChecked || a.spiritConsentWeek !== null || a.spiritSteppedOut || a.spiritDisposition !== null || a.spiritTravelMetres || a.lightActive || a.lightStopped || a.sampleSealed || a.sealSpent)) return false;
      const complete = id === 'paired-lift' ? a.chestReceived : id === 'faded-label' ? a.verified : a.sampleSealed;
      const effective = id === 'paired-lift' ? a.carryBenefit : success(a.abilityTier);
      if (a.result === 'ABILITY' && (!complete || !effective) || a.result === 'ORDINARY' && (!complete && !a.refused || complete && effective) || a.result === 'NONE' && complete) return false;
      if (a.closed && (!a.inspected || a.siteVisited && !a.playerReturned || id === 'faded-label' && a.siteVisited && !a.itemsReturned || a.carried && (!a.chestReceived || !a.helpersReturned) || a.spiritSteppedOut && a.spiritDisposition === null || a.lightActive || id === 'shielded-sample' && a.siteVisited && !a.sampleSealed) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      const siteDistance = id === 'paired-lift' ? 0 : id === 'faded-label' ? 3 : 4;
      const returnDistance = id === 'paired-lift' ? a.carried ? 8 : 0 : id === 'faded-label' ? 8 : 4;
      const expectedMetres = (a.ownerConsentWeek !== null ? 16 : 0) + (a.siteVisited ? siteDistance : 0) + (a.carried ? 8 : 0) + (a.selbyAsked ? 10 : 0) + (a.nivenAsked ? 6 : 0) + (a.itemsReturned ? 5 : 0) + (a.playerReturned ? returnDistance : 0);
      const expectedSeconds = expectedMetres + (a.ownerConsentWeek !== null ? 2 : 0) + (a.siteVisited ? 1 : 0) + (a.stopped ? 1 : 0) + (a.ayaConsentWeek !== null ? 2 : 0) + (a.nivenConsentWeek !== null ? 2 : 0) + (a.routeChecked ? 2 : 0) + (a.chestReceived ? 1 : 0) + (a.helpersReturned ? 8 : 0) + (a.abilityTier !== null ? 2 : 0) + (a.lampRead ? 4 : 0) + a.hypothesisHistory.length + (a.selbyAsked ? 3 : 0) + (a.nivenAsked ? 3 : 0) + (a.registerRead ? 3 : 0) + (a.verified ? 2 : 0) + (a.screenChecked ? 2 : 0) + (a.spiritConsentWeek !== null ? 2 : 0) + (a.spiritSteppedOut ? 4 : 0) + (a.lightStopped ? 1 : 0) + (a.sampleSealed ? 2 : 0) + (a.spiritDisposition !== null ? 2 : 0) + (a.spiritDisposition === 'RETURNED' ? 4 : 0) + (a.itemsReturned ? 1 : 0) + (a.inspected ? 2 : 0);
      if (a.playerTravelMetres !== expectedMetres || a.elapsedSeconds !== expectedSeconds) return false;
      previousWeek = a.week; seconds += a.elapsedSeconds; metres += a.playerTravelMetres; helperMetres += a.helperTravelMetres; ayaEnergy += a.ayaEnergySpent; nivenEnergy += a.nivenEnergySpent; chestMetres += a.chestTravelMetres; oil += a.lampOilSpent; seals += a.sealSpent; spiritMetres += a.spiritTravelMetres;
      anyCarry ||= a.carried; received ||= a.chestReceived; anyPurified ||= id === 'shielded-sample' && success(a.abilityTier); anyScreen ||= a.screenChecked; anyLabelVisit ||= id === 'faded-label' && a.siteVisited;
      if (a.carried) helperAtBench = !a.helpersReturned;
      if (a.spiritSteppedOut) spiritAtSide = a.spiritDisposition !== 'RETURNED';
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
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.clockSeconds < seconds || l.playerTravelMetres !== metres || l.aya.travelMetres !== helperMetres || l.niven.travelMetres !== helperMetres || l.aya.energy !== 100 - ayaEnergy || l.niven.energy !== 100 - nivenEnergy || l.chest.travelMetres !== chestMetres || l.lamp.oil !== 2 - oil || l.seal.remaining !== 1 - seals || l.elm.travelMetres !== spiritMetres || l.reflected && resolved !== 3) return false;
  if ((l.chest.location === 'BENCH') !== anyCarry || (l.chest.custody === 'HELPERS') !== (anyCarry && !received) || (l.aya.location === 'BENCH') !== helperAtBench || l.aya.location !== l.niven.location || (l.elm.location === 'SIDE') !== spiritAtSide || (l.sample.contamination === 0) !== anyPurified || l.sample.sealed !== (seals === 1) || l.screen.placed !== anyScreen) return false;
  const a = currentAttempt(s), labelBorrowed = l.activeCase === 'faded-label' && !!a?.siteVisited && !a.itemsReturned;
  if (l.tag.location !== (labelBorrowed ? 'PLAYER' : anyLabelVisit ? 'OWNER' : 'TABLE')) return false;
  if (s.seer.completedSources.filter(x => x === 'justice-mentor-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (!open && cleanupBlock(s) !== null) return false;
  if (a && l.activeCase) {
    const expectedLocation = !a.siteVisited || a.playerReturned ? 'EXIT' : l.activeCase === 'paired-lift' ? a.carried ? 'BENCH' : 'START' : l.activeCase === 'faded-label' && a.itemsReturned ? 'BENCH' : 'TABLE';
    if (l.playerLocation !== expectedLocation) return false;
  }
  if (s.progression.pathwayId === 'sun' && s.progression.sequence === 2) {
    const inheritedAt = s.lightSeeker?.promotionWeek;
    if (!integer(inheritedAt, promotion, s.week) || s.lightSeeker?.justiceMentorActingAtPromotion !== 100 || open || prepared || hasJusticeMentorLifeLock(s) || !l.reflected || resolved !== 3) return false;
    if (Object.values(l.cases).some(r => r.observedWeek === null || r.observedWeek > inheritedAt || r.attempts.some(a => a.week > inheritedAt))) return false;
    return s.lightSeeker.justiceMentorActingAtPromotion === resolved * 25 + (l.reflected ? 25 : 0);
  }
  return !promoted(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
}
