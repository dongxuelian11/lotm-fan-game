import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasThreeHeadedTemplarOldPractice } from './index.js';

export const THREE_HEADED_TEMPLAR_CASE_IDS = ['two-end-seal', 'paired-care', 'interrupted-light'] as const;
export type ThreeHeadedTemplarCaseId = typeof THREE_HEADED_TEMPLAR_CASE_IDS[number];
export const THREE_HEADED_TEMPLAR_SPIRIT_IDS = ['THT3-HELENA', 'THT3-ROLAND'] as const;
export type ThreeHeadedTemplarSpiritId = typeof THREE_HEADED_TEMPLAR_SPIRIT_IDS[number];
export type ThreeHeadedTemplarSpiritMethod = 'SIGNAL' | 'BRIEF_WARD' | 'LOW_GLOW' | 'STEADY_HOLD' | 'SCREEN';
export type ThreeHeadedTemplarLocation = 'START' | 'A' | 'B';
export type ThreeHeadedTemplarSpiritLocation = ThreeHeadedTemplarLocation | 'COURT' | 'SEALED' | 'INTERNAL' | 'RELEASED' | 'DISSIPATED';
export interface ThreeHeadedTemplarSpiritSource {
  id: ThreeHeadedTemplarSpiritId; name: string; age: number; sequence: 4; deceased: true;
  deathRecordId: string; casketId: string; custodianId: 'THT3-MARA'; knownAbilities: ThreeHeadedTemplarSpiritMethod[];
}
export const THREE_HEADED_TEMPLAR_SPIRIT_SOURCES: readonly ThreeHeadedTemplarSpiritSource[] = [
  { id: 'THT3-HELENA', name: '赫莲娜·奎因', age: 54, sequence: 4, deceased: true, deathRecordId: 'THT3-HELENA-DEATH', casketId: 'THT3-HELENA-CASKET', custodianId: 'THT3-MARA', knownAbilities: ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW'] },
  { id: 'THT3-ROLAND', name: '罗兰·维克', age: 61, sequence: 4, deceased: true, deathRecordId: 'THT3-ROLAND-DEATH', casketId: 'THT3-ROLAND-CASKET', custodianId: 'THT3-MARA', knownAbilities: ['SIGNAL', 'STEADY_HOLD', 'SCREEN'] },
];
export interface ThreeHeadedTemplarSpiritEvent {
  type: 'PREPARE_GRAZING' | 'GRAZE' | 'EXTERNALIZE' | 'SEND' | 'ASSIST' | 'RECALL' | 'RELEASE' | 'REST' | 'SUPPORT' | 'LIGHT_BREAK' | 'DEATH_RELEASE';
  spiritId: ThreeHeadedTemplarSpiritId; week: number; round: number | null; atSecond: number; context: string;
  tier: PublicResolutionTier | null; abilityIds: ThreeHeadedTemplarSpiritMethod[]; destination: ThreeHeadedTemplarSpiritLocation | null; method: ThreeHeadedTemplarSpiritMethod | null;
  seconds: number; metres: number; masterCost: number; spiritCost: number; mindCost: number; cashCost: number;
}
export interface ThreeHeadedTemplarSpiritState extends ThreeHeadedTemplarSpiritSource {
  status: 'SEALED' | 'GRAZED' | 'RELEASED' | 'DISSIPATED'; selectedAbilities: ThreeHeadedTemplarSpiritMethod[];
  spirituality: number; integrity: number; location: ThreeHeadedTemplarSpiritLocation;
  acquiredWeek: number | null; releasedWeek: number | null; preparedWeek: number | null; attemptWeek: number | null; restWeek: number | null;
  supportEnabled: boolean; interrupted: boolean; externalizedContexts: string[]; travelMetres: number; history: ThreeHeadedTemplarSpiritEvent[];
}
export type ThreeHeadedTemplarSpirits = Record<ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritState>;
export interface ThreeHeadedTemplarCombatSpiritEvent { type: 'SUPPORT' | 'LIGHT_BREAK' | 'RECALL' | 'DEATH_RELEASE'; spiritId: ThreeHeadedTemplarSpiritId; week: number; round: number; atSecond: number }
type SceneCommand = 'CONSENT_OWNER' | 'TAKE_CARD' | 'RETURN_CARD' | 'WALK_A' | 'WALK_B' | 'RETURN_START' | 'READ_CARD' | 'READ_FAR_SEAL' | 'SECURE_LEFT' | 'CHECK_RIGHT' | 'OPEN_LIGHT' | 'CLOSE_SHUTTER' | 'INSPECT' | 'WITHDRAW';
export type ThreeHeadedTemplarActivityCommand =
  | { type: 'MEET_SPIRITS' | 'REFLECT' }
  | { type: 'PREPARE_GRAZING' | 'REST_SPIRIT' | 'EXTERNALIZE' | 'RECALL_SPIRIT'; spiritId: ThreeHeadedTemplarSpiritId }
  | { type: 'GRAZE'; spiritId: ThreeHeadedTemplarSpiritId; abilityIds: string[]; confirmed: true }
  | { type: 'RELEASE_GRAZED'; spiritId: ThreeHeadedTemplarSpiritId; confirmed: true }
  | { type: 'SEND_SPIRIT'; spiritId: ThreeHeadedTemplarSpiritId; destination: 'A' | 'B' }
  | { type: 'ASSIST'; spiritId: ThreeHeadedTemplarSpiritId; method: ThreeHeadedTemplarSpiritMethod }
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | SceneCommand; caseId: ThreeHeadedTemplarCaseId }
  | { type: 'PREPARE'; caseId: ThreeHeadedTemplarCaseId; method: 'ABILITY' | 'ORDINARY' };
export interface ThreeHeadedTemplarLifeStep { command: ThreeHeadedTemplarActivityCommand; tier: PublicResolutionTier | null; atSecond: number; ownerWilling: boolean; masterSpirituality: number; masterMind: number }
export interface ThreeHeadedTemplarMovement { from: ThreeHeadedTemplarLocation; to: ThreeHeadedTemplarLocation; metres: number; seconds: number; itemIds: string[] }
export interface ThreeHeadedTemplarAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; startSecond: number; elapsedSeconds: number;
  initialSpiritHistory: Record<ThreeHeadedTemplarSpiritId, number>; finalSpiritHistory: Record<ThreeHeadedTemplarSpiritId, number>;
  steps: ThreeHeadedTemplarLifeStep[]; playerMoves: ThreeHeadedTemplarMovement[]; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; maintenancePayments: number; performances: number;
  ownerConsent: 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED'; cardTaken: boolean; cardReturned: boolean; cardRead: boolean; farSealRead: boolean; leftSecured: boolean; rightChecked: boolean;
  lightOpened: boolean; lightClosed: boolean; helenaInterrupted: boolean; rolandContinued: boolean; simultaneousCare: boolean; abilityUsed: boolean;
  evidence: { sourceId: string; text: string; atSecond: number }[]; withdrawn: boolean; inspected: boolean; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
}
export interface ThreeHeadedTemplarCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: ThreeHeadedTemplarAttempt[] }
export interface ThreeHeadedTemplarLifeState {
  siteId: 'THT3-SEALED-COURT'; metSpiritsWeek: number | null; introducedWeek: number | null; introducedDate: PublicGameDate | null;
  owner: { id: 'THT3-MARA'; name: '玛拉·埃尔文'; age: 51; alive: true; willing: boolean; location: 'START' };
  spirits: ThreeHeadedTemplarSpirits; activeCase: ThreeHeadedTemplarCaseId | null; playerLocation: ThreeHeadedTemplarLocation; playerTravelMetres: number; clockSeconds: number;
  card: { id: 'THT3-CARD'; owner: 'THT3-MARA'; quantity: 1; location: 'TABLE' | 'PLAYER'; travelMetres: number };
  leftBox: { id: 'THT3-LEFT-BOX'; location: 'A'; quantity: 1 }; rightBox: { id: 'THT3-RIGHT-BOX'; location: 'B'; quantity: 1 };
  farSeal: { id: 'THT3-FAR-SEAL'; location: 'B'; quantity: 1 }; lamp: { id: 'THT3-LAMP'; location: 'B'; quantity: 1; on: boolean };
  shutter: { id: 'THT3-SHUTTER'; location: 'B'; quantity: 1; state: 'CLOSED' | 'OPEN'; controlAt: 'START'; cordMetres: 8 };
  cases: Record<ThreeHeadedTemplarCaseId, ThreeHeadedTemplarCaseState>; reflected: boolean;
}
export interface ThreeHeadedTemplarLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ThreeHeadedTemplarActivityCommand }
export interface ThreeHeadedTemplarLifeProjection extends Omit<ThreeHeadedTemplarLifeState, 'cases' | 'spirits'> {
  title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; inside: boolean; insideCase: boolean;
  currentAttempt: ThreeHeadedTemplarAttempt | null; spirits: ThreeHeadedTemplarSpiritState[];
  cases: { id: ThreeHeadedTemplarCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ThreeHeadedTemplarAttempt[] }[];
  actions: ThreeHeadedTemplarLifeAction[];
}
const ABILITY = 'hanged-man.s3.multiple-release' as const;
export const THREE_HEADED_TEMPLAR_LIFE_STORY = '原核只确定序列3突破一次只能外放一位半神灵的限制；本作最多2位是G有限适配。两个新来源均此前已故原创G四阶相当灵、各有唯一死亡记录和原封存匣，须真实会面、付费准备、风险放牧。主人仍一次只借1灵，本切片本人只沿用旧伊芮斯已选技巧，新两灵仅外放协作；旧永久释放的塞德里克与独立隔离影体不回收。';
export const THREE_HEADED_TEMPLAR_LIFE_ENVIRONMENT = '三案观察/准备/实施/报告各1行动，反思1行动；报告各扮演25，反思25。原人原物、精确距离和技能均G。START→A4米→B4米，步行每米1秒；各灵初始30灵性/100完整度，外放4本人灵性+2精神/知识18，失败也付费，每灵每案一次；选定技巧每次3原灵灵性，每两次分派付1本人维持灵性。收回不补满；同一原匣跨周40便士照护才恢复10/10。';
const CASES = [
  { id: 'two-end-seal', title: 'G · 原封条两端核对', story: '唯一原卡在A原桌；能力方案主人在START，赫莲娜实际到A读同一原卡，再到B观察原远端封条并以有限信号回报。普通方案本人持同一卡依次实走A/B，不生成副本或全知报告。' },
  { id: 'paired-care', title: 'G · 两处同时照料', story: '罗兰在A实付自己的灵性稳住原左箱，赫莲娜在B实付自己的灵性低照原右箱；两位原灵同时实际在场，主人留START。普通方案本人先固定A原左箱，再走B检查原右箱，不称同时双灵。' },
  { id: 'interrupted-light', title: 'G · 光场中断与原路收回', story: '赫莲娜先在B付费低照；同一原灯与原遮板打开后强光削弱她20完整度，不能继续操作，应沿8米原路收回。A的罗兰仍可付费发信号，再真实收回；关闭原光场、归还原卡。普通方案本人走到B操作原遮板即可。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 3;
const isSpiritId = (id: unknown): id is ThreeHeadedTemplarSpiritId => typeof id === 'string' && THREE_HEADED_TEMPLAR_SPIRIT_IDS.includes(id as ThreeHeadedTemplarSpiritId);
const methods = ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW', 'STEADY_HOLD', 'SCREEN'] as const;
const external = (spirit: ThreeHeadedTemplarSpiritState) => spirit.status === 'GRAZED' && ['START', 'A', 'B', 'COURT'].includes(spirit.location);
const distance = (at: ThreeHeadedTemplarSpiritLocation) => at === 'B' ? 8 : at === 'A' || at === 'COURT' ? 4 : 0;
const freshCase = (): ThreeHeadedTemplarCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshSpirit(source: ThreeHeadedTemplarSpiritSource): ThreeHeadedTemplarSpiritState {
  return { ...structuredClone(source), status: 'SEALED', selectedAbilities: [], spirituality: 0, integrity: 100, location: 'SEALED', acquiredWeek: null, releasedWeek: null, preparedWeek: null, attemptWeek: null, restWeek: null, supportEnabled: false, interrupted: false, externalizedContexts: [], travelMetres: 0, history: [] };
}
export function createThreeHeadedTemplarLifeState(): ThreeHeadedTemplarLifeState {
  return { siteId: 'THT3-SEALED-COURT', metSpiritsWeek: null, introducedWeek: null, introducedDate: null,
    owner: { id: 'THT3-MARA', name: '玛拉·埃尔文', age: 51, alive: true, willing: true, location: 'START' },
    spirits: { 'THT3-HELENA': freshSpirit(THREE_HEADED_TEMPLAR_SPIRIT_SOURCES[0]!), 'THT3-ROLAND': freshSpirit(THREE_HEADED_TEMPLAR_SPIRIT_SOURCES[1]!) },
    activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    card: { id: 'THT3-CARD', owner: 'THT3-MARA', quantity: 1, location: 'TABLE', travelMetres: 0 }, leftBox: { id: 'THT3-LEFT-BOX', location: 'A', quantity: 1 }, rightBox: { id: 'THT3-RIGHT-BOX', location: 'B', quantity: 1 }, farSeal: { id: 'THT3-FAR-SEAL', location: 'B', quantity: 1 },
    lamp: { id: 'THT3-LAMP', location: 'B', quantity: 1, on: false }, shutter: { id: 'THT3-SHUTTER', location: 'B', quantity: 1, state: 'CLOSED', controlAt: 'START', cordMetres: 8 },
    cases: { 'two-end-seal': freshCase(), 'paired-care': freshCase(), 'interrupted-light': freshCase() }, reflected: false };
}

function eventInput(spiritId: ThreeHeadedTemplarSpiritId, week: number, atSecond: number, context: string, type: ThreeHeadedTemplarSpiritEvent['type']): ThreeHeadedTemplarSpiritEvent {
  return { type, spiritId, week, round: null, atSecond, context, tier: null, abilityIds: [], destination: null, method: null, seconds: 0, metres: 0, masterCost: 0, spiritCost: 0, mindCost: 0, cashCost: 0 };
}
/** One original source, finite resources, no replacement instance. Also used by combat's pure evidence replay. */
function transitionSpirit(spirit: ThreeHeadedTemplarSpiritState, input: ThreeHeadedTemplarSpiritEvent): ThreeHeadedTemplarSpiritEvent {
  const e = structuredClone(input);
  e.seconds = e.metres = e.masterCost = e.spiritCost = e.mindCost = e.cashCost = 0;
  const fail = (condition: boolean) => { if (condition) throw new Error('同一原封存灵的来源、资源或不可逆状态不允许此步。'); };
  fail(e.spiritId !== spirit.id || !integer(e.week, 1) || !integer(e.atSecond) || !e.context || (spirit.history.at(-1)?.week ?? 0) > e.week || (spirit.history.at(-1)?.atSecond ?? 0) > e.atSecond);
  const combat = e.round !== null;
  if (combat) fail(!integer(e.round, 1) || e.context !== `COMBAT:${e.round}` || !['SUPPORT', 'LIGHT_BREAK', 'RECALL', 'DEATH_RELEASE'].includes(e.type));
  switch (e.type) {
    case 'PREPARE_GRAZING':
      fail(spirit.status !== 'SEALED' || spirit.preparedWeek === e.week || spirit.attemptWeek === e.week || combat);
      spirit.preparedWeek = e.week; e.cashCost = 180; break;
    case 'GRAZE':
      fail(spirit.status !== 'SEALED' || spirit.preparedWeek !== e.week || spirit.attemptWeek === e.week || combat || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.abilityIds.length < 1 || e.abilityIds.length > 3 || new Set(e.abilityIds).size !== e.abilityIds.length || e.abilityIds.some(id => !spirit.knownAbilities.includes(id)));
      spirit.preparedWeek = null; spirit.attemptWeek = e.week; e.masterCost = 6; e.mindCost = 2;
      if (successful(e.tier)) { spirit.status = 'GRAZED'; spirit.location = 'INTERNAL'; spirit.selectedAbilities = [...e.abilityIds]; spirit.acquiredWeek = e.week; spirit.spirituality = 30; }
      break;
    case 'REST':
      fail(spirit.status !== 'GRAZED' || spirit.location !== 'INTERNAL' || spirit.acquiredWeek === null || e.week <= spirit.acquiredWeek || spirit.restWeek === e.week || combat);
      spirit.restWeek = e.week; spirit.spirituality = Math.min(30, spirit.spirituality + 10); spirit.integrity = Math.min(100, spirit.integrity + 10); e.cashCost = 40; break;
    case 'RELEASE':
      fail(spirit.status !== 'GRAZED' || spirit.location !== 'INTERNAL' || combat);
      spirit.status = 'RELEASED'; spirit.location = 'RELEASED'; spirit.releasedWeek = e.week; spirit.supportEnabled = false; spirit.interrupted = false; break;
    case 'EXTERNALIZE':
      fail(spirit.status !== 'GRAZED' || spirit.location !== 'INTERNAL' || spirit.integrity <= 0 || spirit.spirituality < 3 || spirit.externalizedContexts.includes(e.context) || combat || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || !['START', 'COURT'].includes(String(e.destination)));
      spirit.externalizedContexts.push(e.context); e.masterCost = 4; e.mindCost = 2; e.seconds = 2;
      if (successful(e.tier)) { spirit.location = e.destination!; spirit.supportEnabled = e.destination === 'COURT'; spirit.interrupted = false; }
      break;
    case 'SEND':
      fail(!external(spirit) || spirit.location === 'COURT' || spirit.interrupted || !['A', 'B'].includes(String(e.destination)) || e.destination === spirit.location || combat);
      e.metres = Math.abs(distance(spirit.location) - distance(e.destination!)); e.seconds = e.metres; spirit.location = e.destination!; spirit.travelMetres += e.metres; break;
    case 'ASSIST':
    case 'SUPPORT': {
      const support = e.type === 'SUPPORT', method = support ? spirit.id === 'THT3-HELENA' ? 'BRIEF_WARD' : 'STEADY_HOLD' : e.method;
      fail(!external(spirit) || spirit.interrupted || spirit.integrity <= 0 || spirit.spirituality < 3 || method === null || !spirit.selectedAbilities.includes(method) || support && (!combat || spirit.location !== 'COURT' || !spirit.supportEnabled || spirit.history.some(h => h.type === 'SUPPORT' && h.round === e.round)) || !support && (combat || spirit.location === 'COURT'));
      e.method = method; e.spiritCost = 3; e.masterCost = support ? 1 : 0; e.seconds = support ? 0 : 2; spirit.spirituality -= 3; break;
    }
    case 'LIGHT_BREAK':
      fail(!external(spirit) || spirit.interrupted || combat && spirit.location !== 'COURT');
      spirit.integrity = Math.max(0, spirit.integrity - 20); spirit.interrupted = true; spirit.supportEnabled = false;
      if (spirit.integrity === 0) { spirit.status = 'DISSIPATED'; spirit.location = 'DISSIPATED'; }
      else if (combat) { e.metres = e.seconds = 4; spirit.travelMetres += 4; spirit.location = 'INTERNAL'; }
      break;
    case 'RECALL':
      fail(!external(spirit) || combat && spirit.location !== 'COURT');
      e.metres = e.seconds = distance(spirit.location); spirit.travelMetres += e.metres; spirit.location = 'INTERNAL'; spirit.supportEnabled = false; spirit.interrupted = false; break;
    case 'DEATH_RELEASE':
      fail(!combat || !external(spirit) || spirit.location !== 'COURT');
      spirit.status = 'RELEASED'; spirit.location = 'RELEASED'; spirit.releasedWeek = e.week; spirit.supportEnabled = false; spirit.interrupted = false; break;
  }
  spirit.history.push(e); return e;
}
export function applyThreeHeadedTemplarCombatSpiritEvent(spirits: ThreeHeadedTemplarSpirits, event: ThreeHeadedTemplarCombatSpiritEvent): ThreeHeadedTemplarSpiritEvent {
  if (!isSpiritId(event.spiritId) || !shape(event, ['type', 'spiritId', 'week', 'round', 'atSecond'])) throw new Error('外放协作战斗事件无效。');
  const e = eventInput(event.spiritId, event.week, event.atSecond, `COMBAT:${event.round}`, event.type); e.round = event.round;
  return transitionSpirit(spirits[event.spiritId], e);
}
export function validateThreeHeadedTemplarSpiritSources(v: unknown, week: number): v is ThreeHeadedTemplarSpirits {
  try {
    if (!record(v) || !shape(v, THREE_HEADED_TEMPLAR_SPIRIT_IDS) || !integer(week, 1)) return false;
    for (const source of THREE_HEADED_TEMPLAR_SPIRIT_SOURCES) {
      const actual = v[source.id]; if (!record(actual) || !Array.isArray(actual.history)) return false;
      const replay = freshSpirit(source);
      for (const event of actual.history) {
        if (!record(event) || !shape(event, Object.keys(eventInput(source.id, 1, 0, 'IDLE:1', 'REST'))) || !integer(event.week, 1, week) || !Array.isArray(event.abilityIds) || typeof event.context !== 'string' || !['PREPARE_GRAZING', 'GRAZE', 'EXTERNALIZE', 'SEND', 'ASSIST', 'RECALL', 'RELEASE', 'REST', 'SUPPORT', 'LIGHT_BREAK', 'DEATH_RELEASE'].includes(String(event.type))) return false;
        const e = event as unknown as ThreeHeadedTemplarSpiritEvent;
        if (e.type !== 'GRAZE' && e.abilityIds.length || !['GRAZE', 'EXTERNALIZE'].includes(e.type) && e.tier !== null || !['EXTERNALIZE', 'SEND'].includes(e.type) && e.destination !== null || !['SUPPORT', 'ASSIST'].includes(e.type) && e.method !== null) return false;
        if (!same(transitionSpirit(replay, e), e)) return false;
      }
      if (!same(actual, replay)) return false;
    }
    return Object.values(v).filter(sp => external(sp as unknown as ThreeHeadedTemplarSpiritState)).length <= 2;
  } catch { return false; }
}
export const validThreeHeadedTemplarSpiritSources = validateThreeHeadedTemplarSpiritSources;
export function getExternalThreeHeadedTemplarSpirits(s: SliceState): ThreeHeadedTemplarSpiritState[] { return Object.values(s.threeHeadedTemplar.life.spirits).filter(external); }
export function advanceThreeHeadedTemplarLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.threeHeadedTemplar.life.clockSeconds + seconds)) throw new Error('原场地累计秒数无效。');
  s.threeHeadedTemplar.life.clockSeconds += seconds;
}
function currentAttempt(s: SliceState): ThreeHeadedTemplarAttempt | null { const l = s.threeHeadedTemplar.life; return l.activeCase === null ? null : l.cases[l.activeCase].attempts.at(-1) ?? null; }
function historyCounts(l: ThreeHeadedTemplarLifeState): Record<ThreeHeadedTemplarSpiritId, number> { return { 'THT3-HELENA': l.spirits['THT3-HELENA'].history.length, 'THT3-ROLAND': l.spirits['THT3-ROLAND'].history.length }; }
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): ThreeHeadedTemplarAttempt {
  return { week: s.week, date: { ...s.date }, method, startSecond: s.threeHeadedTemplar.life.clockSeconds, elapsedSeconds: 0, initialSpiritHistory: historyCounts(s.threeHeadedTemplar.life), finalSpiritHistory: historyCounts(s.threeHeadedTemplar.life), steps: [], playerMoves: [], playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, maintenancePayments: 0, performances: 0, ownerConsent: 'UNASKED', cardTaken: false, cardReturned: false, cardRead: false, farSealRead: false, leftSecured: false, rightChecked: false, lightOpened: false, lightClosed: false, helenaInterrupted: false, rolandContinued: false, simultaneousCare: false, abilityUsed: false, evidence: [], withdrawn: false, inspected: false, closed: false, result: 'NONE' };
}
function elapse(s: SliceState, seconds: number): void { const a = currentAttempt(s); if (a) a.elapsedSeconds += seconds; advanceThreeHeadedTemplarLifeClock(s, seconds); }
function payEvent(s: SliceState, e: ThreeHeadedTemplarSpiritEvent): void {
  s.spirituality -= e.masterCost; s.mind -= e.mindCost; s.cash -= e.cashCost;
  const a = currentAttempt(s); if (a) { a.spiritualitySpent += e.masterCost; a.mindSpent += e.mindCost; a.finalSpiritHistory = historyCounts(s.threeHeadedTemplar.life); }
  elapse(s, e.seconds);
}
function sourceContext(s: SliceState): string { const l = s.threeHeadedTemplar.life; return l.activeCase ? `CASE:${l.activeCase}` : s.threeHeadedTemplar.encounter.status === 'READY' ? `ENCOUNTER:${s.threeHeadedTemplar.encounter.approachWeek}` : `IDLE:${s.week}`; }
function sourceEvent(s: SliceState, spiritId: ThreeHeadedTemplarSpiritId, type: ThreeHeadedTemplarSpiritEvent['type']): ThreeHeadedTemplarSpiritEvent { return eventInput(spiritId, s.week, s.threeHeadedTemplar.life.clockSeconds, sourceContext(s), type); }

const SCENE_TYPES: readonly string[] = ['CONSENT_OWNER', 'TAKE_CARD', 'RETURN_CARD', 'WALK_A', 'WALK_B', 'RETURN_START', 'READ_CARD', 'READ_FAR_SEAL', 'SECURE_LEFT', 'CHECK_RIGHT', 'OPEN_LIGHT', 'CLOSE_SHUTTER', 'INSPECT', 'WITHDRAW'];
export function validateThreeHeadedTemplarActivityCommand(v: unknown): v is ThreeHeadedTemplarActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (v.type === 'MEET_SPIRITS' || v.type === 'REFLECT') return shape(v, ['type']);
  if (['PREPARE_GRAZING', 'REST_SPIRIT', 'EXTERNALIZE', 'RECALL_SPIRIT', 'GRAZE', 'RELEASE_GRAZED', 'SEND_SPIRIT', 'ASSIST'].includes(v.type)) {
    if (!isSpiritId(v.spiritId)) return false;
    if (v.type === 'GRAZE') return shape(v, ['type', 'spiritId', 'abilityIds', 'confirmed']) && v.confirmed === true && Array.isArray(v.abilityIds) && v.abilityIds.length >= 1 && v.abilityIds.length <= 3 && new Set(v.abilityIds).size === v.abilityIds.length && v.abilityIds.every(id => typeof id === 'string' && THREE_HEADED_TEMPLAR_SPIRIT_SOURCES.find(source => source.id === v.spiritId)!.knownAbilities.includes(id as ThreeHeadedTemplarSpiritMethod));
    if (v.type === 'RELEASE_GRAZED') return shape(v, ['type', 'spiritId', 'confirmed']) && v.confirmed === true;
    if (v.type === 'SEND_SPIRIT') return shape(v, ['type', 'spiritId', 'destination']) && ['A', 'B'].includes(String(v.destination));
    if (v.type === 'ASSIST') return shape(v, ['type', 'spiritId', 'method']) && methods.includes(v.method as ThreeHeadedTemplarSpiritMethod);
    return shape(v, ['type', 'spiritId']);
  }
  if (!THREE_HEADED_TEMPLAR_CASE_IDS.includes(v.caseId as ThreeHeadedTemplarCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return [...SCENE_TYPES, 'OBSERVE', 'PERFORM', 'REPORT', 'CLOSE'].includes(v.type) && shape(v, ['type', 'caseId']);
}
function cleanupBlock(s: SliceState): string | null {
  const l = s.threeHeadedTemplar.life;
  if (l.playerLocation !== 'START') return '同一本人须沿4米一段原路回START。';
  if (l.card.location !== 'TABLE') return '同一原卡须实际在A归还原桌，不能远程归还。';
  if (l.shutter.state !== 'CLOSED' || l.lamp.on) return '须关闭B原遮板和原灯，可在START拉同一8米机械控制绳。';
  return getExternalThreeHeadedTemplarSpirits(s).length ? '原外放灵须逐一沿当前本地原路收回，不能免费留无限自主协作。' : null;
}
export function hasThreeHeadedTemplarLifeLock(s: SliceState): boolean {
  const l = s.threeHeadedTemplar.life;
  return l.activeCase !== null || Object.values(l.cases).some(c => c.status === 'PREPARED') || cleanupBlock(s) !== null;
}
function abilityPreparationReason(s: SliceState, id: ThreeHeadedTemplarCaseId): string | null {
  const l = s.threeHeadedTemplar.life;
  const required: [ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritMethod][] = id === 'two-end-seal' ? [['THT3-HELENA', 'SIGNAL']] : id === 'paired-care' ? [['THT3-ROLAND', 'STEADY_HOLD'], ['THT3-HELENA', 'LOW_GLOW']] : [['THT3-HELENA', 'LOW_GLOW'], ['THT3-ROLAND', 'SIGNAL']];
  return required.some(([spiritId, method]) => l.spirits[spiritId].status !== 'GRAZED' || l.spirits[spiritId].spirituality < (id === 'two-end-seal' ? 6 : 3) || !l.spirits[spiritId].selectedAbilities.includes(method)) ? '能力方案须实际获得所需原灵，并在放牧时实际选定对应方法；也可选择普通方案。' : null;
}
function evidenceComplete(id: ThreeHeadedTemplarCaseId, a: ThreeHeadedTemplarAttempt): boolean { return id === 'two-end-seal' ? a.cardRead && a.farSealRead : id === 'paired-care' ? a.leftSecured && a.rightChecked : a.lightOpened && a.lightClosed; }
function performed(s: SliceState, spiritId: ThreeHeadedTemplarSpiritId, method: ThreeHeadedTemplarSpiritMethod): boolean {
  const a = currentAttempt(s)!;
  return a.steps.some(step => step.command.type === 'ASSIST' && step.command.spiritId === spiritId && step.command.method === method);
}
function sceneReason(s: SliceState, c: ThreeHeadedTemplarActivityCommand): string | null {
  const l = s.threeHeadedTemplar.life, a = currentAttempt(s), id = l.activeCase;
  if (!a || !id) return '先实施本案原现场。';
  if ('caseId' in c && c.caseId !== id) return '同一本体不能同时进入另一案。';
  if (a.inspected) return '已经核验收口，只可关闭现场。';
  if (c.type === 'WITHDRAW') return a.withdrawn ? '已明确撤回，仍须真实归物、收灵和步行返回。' : null;
  if (c.type === 'RECALL_SPIRIT') return external(l.spirits[c.spiritId]) && l.spirits[c.spiritId].location !== 'COURT' ? null : '只可收回实际在本地START/A/B的同一原灵。';
  if (c.type === 'WALK_A') return l.playerLocation === 'START' || l.playerLocation === 'B' ? null : '本人已经在A。';
  if (c.type === 'RETURN_START') return l.playerLocation === 'A' ? null : '须在A沿4米原路回START；B先走回A。';
  if (c.type === 'RETURN_CARD') return l.playerLocation === 'A' && l.card.location === 'PLAYER' ? null : '须本人在A持同一原卡，才能归还原桌。';
  if (c.type === 'CLOSE_SHUTTER') return ['START', 'B'].includes(l.playerLocation) && l.shutter.state === 'OPEN' ? null : '须原遮板实际打开；在B手动关闭，或START拉同一8米控制绳。';
  if (c.type === 'INSPECT') return cleanupBlock(s) ?? (a.withdrawn || evidenceComplete(id, a) ? null : '先取得本案有限原证据，或明确撤回并保留未完成记录。');
  if (a.withdrawn) return '已撤回本案；仅可实际收灵、归物、关原灯和步行返回。';
  if (c.type === 'CONSENT_OWNER') return l.playerLocation === 'START' && a.ownerConsent === 'UNASKED' ? null : '须在START当面询问玛拉本案独立许可，回答不重掷。';
  if (a.ownerConsent !== 'GRANTED' || !l.owner.willing) return '原保管者未同意本案或已撤回；可0资源明确撤回并真实收口。';
  if (s.mind <= 0) return '精神不足，只可0资源真实收口。';
  if (c.type === 'WALK_B') return l.playerLocation === 'A' ? null : '须本人已在A，沿4米同一路径到B。';
  if (c.type === 'TAKE_CARD') return l.playerLocation === 'A' && l.card.location === 'TABLE' && !a.cardTaken ? null : '同一原卡在A原桌，须本人实际到A领取。';
  if (c.type === 'READ_CARD') return id === 'two-end-seal' && l.playerLocation === 'A' && !a.cardRead ? null : '须本人在A实际读唯一原卡；只记录有限字样。';
  if (c.type === 'READ_FAR_SEAL') return id === 'two-end-seal' && l.playerLocation === 'B' && a.cardRead && !a.farSealRead ? null : '先在A读原卡，再本人实走到B核原封条远端。';
  if (c.type === 'SECURE_LEFT') return id === 'paired-care' && l.playerLocation === 'A' && !a.leftSecured ? null : '须本人在A先普通固定原左箱。';
  if (c.type === 'CHECK_RIGHT') return id === 'paired-care' && l.playerLocation === 'B' && a.leftSecured && !a.rightChecked ? null : '先固定A原左箱，再本人实走B核原右箱。';
  if (c.type === 'OPEN_LIGHT') {
    if (id !== 'interrupted-light' || a.lightOpened || l.shutter.state !== 'CLOSED' || !['START', 'B'].includes(l.playerLocation)) return '须本案原光源尚未打开，且本人在B或START真实控制绳旁。';
    if (l.playerLocation === 'B') return null;
    return a.method === 'ABILITY' && l.spirits['THT3-HELENA'].location === 'B' && performed(s, 'THT3-HELENA', 'LOW_GLOW') ? null : 'START能力操作须赫莲娜已经在B实际低照，再拉原8米机械绳打开同一遮板。';
  }
  if (c.type === 'EXTERNALIZE') {
    if (a.method !== 'ABILITY' || l.playerLocation !== 'START') return '本案能力方案且本人在START才可外放，普通方案可实际步行完成。';
    return externalizeReason(s, c.spiritId);
  }
  if (c.type === 'SEND_SPIRIT') {
    const sp = l.spirits[c.spiritId]; return a.method === 'ABILITY' && l.playerLocation === 'START' && external(sp) && sp.location !== 'COURT' && !sp.interrupted && sp.location !== c.destination ? null : '须能力方案主人留START，原灵已实际外放且未中断；沿同一路径到A/B。';
  }
  if (c.type === 'ASSIST') {
    const sp = l.spirits[c.spiritId];
    if (a.method !== 'ABILITY' || l.playerLocation !== 'START' || !external(sp) || sp.location === 'COURT' || sp.interrupted || !sp.selectedAbilities.includes(c.method)) return '须主人留START、同一原灵实际在场且未中断，方法已在原放牧时选定。';
    if (sp.spirituality < 3 || a.performances % 2 === 0 && s.spirituality < 1) return '每次需原灵3灵性；每两次分派另需主人1维持灵性，不能透支。';
    if (id === 'two-end-seal' && c.spiritId === 'THT3-HELENA' && c.method === 'SIGNAL') return sp.location === 'A' && !a.cardRead || sp.location === 'B' && a.cardRead && !a.farSealRead ? null : '赫莲娜须依次实际到A观察原卡、B观察原封条，再回报有限信号。';
    if (id === 'paired-care' && c.spiritId === 'THT3-ROLAND' && c.method === 'STEADY_HOLD') return sp.location === 'A' && !a.leftSecured ? null : '罗兰须在A实际稳住原左箱，不能从远处代做。';
    if (id === 'paired-care' && c.spiritId === 'THT3-HELENA' && c.method === 'LOW_GLOW') return sp.location === 'B' && !a.rightChecked && l.spirits['THT3-ROLAND'].location === 'A' && !l.spirits['THT3-ROLAND'].interrupted && performed(s, 'THT3-ROLAND', 'STEADY_HOLD') ? null : '赫莲娜须在B，罗兰仍在A且已实际付费稳住原左箱，两灵分别在场。';
    if (id === 'interrupted-light' && c.spiritId === 'THT3-HELENA' && c.method === 'LOW_GLOW') return sp.location === 'B' && !a.lightOpened && !performed(s, c.spiritId, c.method) ? null : '赫莲娜须在B，在原强光打开前实际低照一次。';
    if (id === 'interrupted-light' && c.spiritId === 'THT3-ROLAND' && c.method === 'SIGNAL') return sp.location === 'A' && a.helenaInterrupted && l.spirits['THT3-HELENA'].location === 'INTERNAL' && !a.rolandContinued ? null : '须赫莲娜已受光中断并实际收回，罗兰仍在A才继续发出自己的有限信号。';
    return '此选定方法在本案没有可重复领取的有限协作目标。';
  }
  return '本案不支持这一现场动作。';
}
function externalizeReason(s: SliceState, id: ThreeHeadedTemplarSpiritId): string | null {
  const spirit = s.threeHeadedTemplar.life.spirits[id];
  if (spirit.status !== 'GRAZED' || spirit.location !== 'INTERNAL' || spirit.integrity <= 0) return '须同一原灵已经真实放牧并在内部；封存、释放和消散不能凭空外放。';
  if (spirit.externalizedContexts.includes(sourceContext(s))) return '本原灵在本案、此次准备遭遇或本周闲时只尝试一次，不能免费重掷。';
  if (getExternalThreeHeadedTemplarSpirits(s).length >= 2) return '本作G限制最多同时外放两位已实际取得的原灵。';
  return spirit.spirituality < 3 ? '原灵自身不足3灵性，先在原匣跨周付费照护。' : s.spirituality < 4 || s.mind < 2 ? '外放需本人4灵性和2精神，失败同样付费。' : null;
}
export function threeHeadedTemplarActivityReason(s: SliceState, c: ThreeHeadedTemplarActivityCommand): string | null {
  if (!validateThreeHeadedTemplarActivityCommand(c)) return '三首圣堂命令形状、原灵或本案无效。';
  if (!promoted(s)) return '先实际晋升三首圣堂序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '同一本体已结束或死亡，原灵不能提供复活。';
  const l = s.threeHeadedTemplar.life, e = s.threeHeadedTemplar.encounter, a = currentAttempt(s);
  if (s.activeEvent || s.combat || e.status === 'FIGHTING') return '先处理原事件或战斗，本人不能同时处于另一现场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回贝克兰德原场地。';
  if (e.status === 'READY') {
    if (c.type === 'EXTERNALIZE') return externalizeReason(s, c.spiritId);
    if (c.type === 'RECALL_SPIRIT') return l.spirits[c.spiritId].location === 'COURT' && external(l.spirits[c.spiritId]) ? null : '须同一原灵实际在COURT，沿4米原路返回。';
    return '当前本人在原战场，仅可预先外放或收回实际原灵，再选择开战或离开。';
  }
  if (a) {
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && a.inspected) return 'caseId' in c && c.caseId === l.activeCase && a.inspected ? cleanupBlock(s) : '先真实检查归物、收灵、关灯与本人返回。';
    return sceneReason(s, c);
  }
  if (c.type === 'WITHDRAW' && l.cases[c.caseId].status === 'PREPARED') return null;
  if (c.type === 'RECALL_SPIRIT') return external(l.spirits[c.spiritId]) && l.spirits[c.spiritId].location === 'START' ? null : '当前只可收回闲时真正外放在START的同一原灵。';
  if (hasThreeHeadedTemplarOldPractice(s)) return '先真实收束旧场景、原物与独立影体操作，不改写旧记录。';
  if (c.type === 'EXTERNALIZE') return l.playerLocation === 'START' && !Object.values(l.cases).some(row => row.status === 'PREPARED') ? externalizeReason(s, c.spiritId) : '先处理已准备的本案。';
  if (cleanupBlock(s)) return cleanupBlock(s);
  if (Object.entries(l.cases).some(([id, r]) => r.status === 'PREPARED' && (!('caseId' in c) || c.caseId !== id))) return '先实施或撤回已经付费准备的本案。';
  if (c.type === 'RELEASE_GRAZED') return l.spirits[c.spiritId].status === 'GRAZED' && l.spirits[c.spiritId].location === 'INTERNAL' ? null : '只能永久释放已取得且在内部的同一原灵；不可重新取得。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '需要1行动与清醒精神；真实收口始终不收费。';
  if (c.type === 'MEET_SPIRITS') return l.metSpiritsWeek !== null ? '已经当面见过两份独立死亡记录与原封存匣，不生成替代来源。' : l.owner.willing ? null : '原保管者玛拉当前不愿会面交接。';
  if ('spiritId' in c) {
    const sp = l.spirits[c.spiritId];
    if (l.metSpiritsWeek === null || !l.owner.willing) return '须先本人当面见原保管者与两原匣，玛拉仍同意这次交接。';
    if (c.type === 'PREPARE_GRAZING') return sp.status !== 'SEALED' ? '仅同一仍封存原灵可准备，不补新来源。' : sp.preparedWeek === s.week || sp.attemptWeek === s.week ? '本原灵本周已准备或尝试，失败需下周重新付费准备。' : s.cash < 180 ? '需要180便士真实封存与交接准备。' : null;
    if (c.type === 'GRAZE') {
      if (sp.status !== 'SEALED' || sp.preparedWeek !== s.week || sp.attemptWeek === s.week) return '须同一原灵本周新准备，原放牧失败消耗保留；每周只尝试一次。';
      if (s.shepherd.grazing.spirits.filter(old => old.status === 'GRAZED').length + Object.values(l.spirits).filter(v => v.status === 'GRAZED').length >= 7) return '旧两灵与本次来源合计最多放牧7位，不改写旧形状。';
      return s.spirituality < 6 || s.mind < 2 ? '放牧需本人6灵性+2精神/知识18；失败仍消耗原准备与资源。' : null;
    }
    if (c.type === 'REST_SPIRIT') return sp.status !== 'GRAZED' || sp.location !== 'INTERNAL' ? '仅仍在内部的同一原灵可入其原匣照护，释放与消散不能复活。' : sp.acquiredWeek === null || s.week <= sp.acquiredWeek || sp.restWeek === s.week ? '须实际取得后的较晚周，每周一次原匣照护。' : s.cash < 40 ? '同一原匣照护需40便士物料与1行动。' : null;
    return '先实施对应实践。';
  }
  if (c.type === 'REFLECT') return !l.reflected && THREE_HEADED_TEMPLAR_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告；有限反思只一次。';
  if (!('caseId' in c)) return '命令无对应场景。';
  const r = l.cases[c.caseId], index = THREE_HEADED_TEMPLAR_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[THREE_HEADED_TEMPLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先如实报告上一有限实践。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已观察，不能重领。';
  if (c.type === 'PREPARE') return !['OBSERVED', 'PREPARED'].includes(r.status) ? '先观察本案，只能在实施前换方案。' : r.method === c.method ? '已经准备此方案。' : r.status === 'OBSERVED' && s.actionsRemaining < 2 ? '准备1行动后还须留1行动实施，避免锁住跨周。' : c.method === 'ABILITY' ? abilityPreparationReason(s, c.caseId) : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' ? null : '先真实准备能力或普通方案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先原路收灵、归物、关灯、本人返回并实际关闭现场。';
  return '先实施本案原现场。';
}
export const blockThreeHeadedTemplarLife = threeHeadedTemplarActivityReason;

function addEvidence(s: SliceState, sourceId: string, text: string): void { const a = currentAttempt(s)!; a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function movePlayer(s: SliceState, to: ThreeHeadedTemplarLocation): void {
  const l = s.threeHeadedTemplar.life, a = currentAttempt(s)!, metres = Math.abs(distance(l.playerLocation) - distance(to));
  a.playerMoves.push({ from: l.playerLocation, to, metres, seconds: metres, itemIds: l.card.location === 'PLAYER' ? [l.card.id] : [] });
  l.playerTravelMetres += metres; a.playerTravelMetres += metres; if (l.card.location === 'PLAYER') l.card.travelMetres += metres;
  l.playerLocation = to; elapse(s, metres);
}
function applySourceCommand(s: SliceState, c: Extract<ThreeHeadedTemplarActivityCommand, { spiritId: ThreeHeadedTemplarSpiritId }>, tier: PublicResolutionTier | null): void {
  const l = s.threeHeadedTemplar.life, sp = l.spirits[c.spiritId];
  const map = { PREPARE_GRAZING: 'PREPARE_GRAZING', GRAZE: 'GRAZE', REST_SPIRIT: 'REST', RELEASE_GRAZED: 'RELEASE', EXTERNALIZE: 'EXTERNALIZE', RECALL_SPIRIT: 'RECALL', SEND_SPIRIT: 'SEND', ASSIST: 'ASSIST' } as const;
  const e = sourceEvent(s, c.spiritId, map[c.type]);
  if (c.type === 'GRAZE') { e.tier = tier; e.abilityIds = c.abilityIds as ThreeHeadedTemplarSpiritMethod[]; }
  if (c.type === 'EXTERNALIZE') { e.tier = tier; e.destination = s.threeHeadedTemplar.encounter.status === 'READY' ? 'COURT' : 'START'; }
  if (c.type === 'SEND_SPIRIT') e.destination = c.destination;
  if (c.type === 'ASSIST') e.method = c.method;
  payEvent(s, transitionSpirit(sp, e));
  if (c.type !== 'ASSIST') return;
  const a = currentAttempt(s)!, id = l.activeCase!;
  if (a.performances % 2 === 0) { s.spirituality--; a.spiritualitySpent++; a.maintenancePayments++; }
  a.performances++; a.abilityUsed = true;
  if (id === 'two-end-seal' && c.spiritId === 'THT3-HELENA' && c.method === 'SIGNAL') {
    if (sp.location === 'A') { a.cardRead = true; addEvidence(s, l.card.id, '赫莲娜实际到A观察同一原卡，只回报原卡上可见的双线记号，未复制原卡。'); }
    else { a.farSealRead = true; addEvidence(s, l.farSeal.id, '赫莲娜从A沿4米原路到B，观察原远端封条并回报可见双线相符；不能由此推知封存内情或未见人物。'); }
  } else if (id === 'paired-care' && c.method === 'STEADY_HOLD') { a.leftSecured = true; addEvidence(s, l.leftBox.id, '罗兰实际在A付自己3灵性暂稳同一原左箱，箱仍在A，未复制或挪到B。'); }
  else if (id === 'paired-care' && c.method === 'LOW_GLOW') { a.rightChecked = true; a.simultaneousCare = true; addEvidence(s, l.rightBox.id, '赫莲娜实际在B付自己3灵性低照核右箱时，罗兰仍在A稳住原左箱；两位原灵分别同时在场，主人仍在START。'); }
  else if (id === 'interrupted-light' && c.method === 'LOW_GLOW') addEvidence(s, l.lamp.id, '赫莲娜在B先实付自己的3灵性低照，尚未打开原强光。');
  else if (id === 'interrupted-light' && c.method === 'SIGNAL') { a.rolandContinued = true; addEvidence(s, sp.id, '赫莲娜受光中断并沿8米原路收回后，同一罗兰仍在A实际付3灵性发有限信号，并未被全场抹除。'); }
}
function applyScene(s: SliceState, step: ThreeHeadedTemplarLifeStep): void {
  const l = s.threeHeadedTemplar.life, a = currentAttempt(s)!, c = step.command, id = l.activeCase!;
  a.steps.push(structuredClone(step));
  if ('spiritId' in c) { applySourceCommand(s, c, step.tier); return; }
  switch (c.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.owner.willing ? 'GRANTED' : 'DECLINED'; elapse(s, 2); break;
    case 'TAKE_CARD': l.card.location = 'PLAYER'; a.cardTaken = true; elapse(s, 1); break;
    case 'RETURN_CARD': l.card.location = 'TABLE'; a.cardReturned = true; elapse(s, 1); break;
    case 'WALK_A': movePlayer(s, 'A'); break;
    case 'WALK_B': movePlayer(s, 'B'); break;
    case 'RETURN_START': movePlayer(s, 'START'); break;
    case 'READ_CARD': a.cardRead = true; elapse(s, 2); addEvidence(s, l.card.id, '本人实际在A读同一原卡，看见双线记号；没有产生副本或提前知道B情况。'); break;
    case 'READ_FAR_SEAL': a.farSealRead = true; elapse(s, 2); addEvidence(s, l.farSeal.id, '本人实走到B查看原封条远端，实际可见双线相符；只核已见两端，不探封存内情。'); break;
    case 'SECURE_LEFT': a.leftSecured = true; elapse(s, 2); addEvidence(s, l.leftBox.id, '本人在A普通固定原左箱后再离开，不将顺序照料称为双灵同时到场。'); break;
    case 'CHECK_RIGHT': a.rightChecked = true; elapse(s, 2); addEvidence(s, l.rightBox.id, '本人由A沿4米原路到B核原右箱，原左箱仍留A；普通顺序照料没有复制身体或物体。'); break;
    case 'OPEN_LIGHT': {
      l.shutter.state = 'OPEN'; l.lamp.on = true; a.lightOpened = true; elapse(s, 2);
      const helena = l.spirits['THT3-HELENA'];
      if (external(helena) && helena.location === 'B') { payEvent(s, transitionSpirit(helena, sourceEvent(s, helena.id, 'LIGHT_BREAK'))); a.helenaInterrupted = true; }
      addEvidence(s, l.shutter.id, `同一原遮板在B实际打开、原灯造成有限强光；${a.helenaInterrupted ? 'B的同一赫莲娜完整度实际−20，协作中断，尚须原路收回' : '本人普通检查原光场，不虚构外放灵受光结果'}。${l.playerLocation === 'START' ? '本人在START实拉原8米机械绳，无远程造物。' : '本人在B实际操作。'}`); break;
    }
    case 'CLOSE_SHUTTER': l.shutter.state = 'CLOSED'; l.lamp.on = false; a.lightClosed = true; elapse(s, 2); break;
    case 'WITHDRAW': a.withdrawn = true; l.cases[id].withdrawals++; elapse(s, 1); break;
    case 'INSPECT': {
      a.inspected = true;
      const realAbility = !a.withdrawn && a.method === 'ABILITY' && a.playerMoves.length === 0 && (id === 'two-end-seal' ? a.cardRead && a.farSealRead && a.abilityUsed : id === 'paired-care' ? a.simultaneousCare : a.helenaInterrupted && a.rolandContinued);
      a.result = realAbility ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result; elapse(s, 2); break;
    }
  }
}
export function applyThreeHeadedTemplarActivity(s: SliceState, c: ThreeHeadedTemplarActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = threeHeadedTemplarActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.threeHeadedTemplar.life;
  if (c.type === 'MEET_SPIRITS') { s.actionsRemaining--; l.metSpiritsWeek = s.week; ctx.note('当面核两份原灵来源', '玛拉51岁本人同意交接准备，出示赫莲娜54岁和罗兰61岁生前记录、各自原死亡记录和不同原封存匣。二人早已去世；当前仍SEALED，没有默认送进灵库。'); return; }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('three-headed-templar-reflection'); ctx.note('反思有限双灵与原责任', '反思扮演+25；失败与普通分支照实保留，不冒称已成功双灵外放，也不授予额外能力掌握。'); return; }
  if ('spiritId' in c && !currentAttempt(s)) {
    if (['PREPARE_GRAZING', 'GRAZE', 'REST_SPIRIT'].includes(c.type)) s.actionsRemaining--;
    const tier = c.type === 'GRAZE' || c.type === 'EXTERNALIZE' ? ctx.check('knowledge', 18).tier : null;
    applySourceCommand(s, c, tier);
    const sp = l.spirits[c.spiritId];
    ctx.note(`同一原灵 · ${sp.name}`, `${c.type}${tier ? `知识18结果${tier}` : ''}；当前${sp.status}/${sp.location}，原灵${sp.spirituality}/30灵性、${sp.integrity}/100完整度。原准备、已付资源和不可逆释放记录保留，外放与收回不补满。`); return;
  }
  if ('caseId' in c) {
    const r = l.cases[c.caseId], spec = CASES.find(v => v.id === c.caseId)!;
    if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('撤回尚未实施的准备', '已付准备行动不退，尚未施术、移动或领取原物。'); return; }
    if (c.type === 'OBSERVE') {
      s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week;
      if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; }
      ctx.note(spec.title, spec.story); return;
    }
    if (c.type === 'PREPARE') { if (r.status !== 'PREPARED') s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `${c.method === 'ABILITY' ? '实际已取得原灵的有限协作' : '普通本人顺序步行'}方案已准备；尚未施术或移动。只在实施前可以换方案，不生成原灵。`); return; }
    if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; l.activeCase = c.caseId; r.attempts.push(freshAttempt(s, r.method!)); ctx.note(spec.title, '实施1行动已付，主人仍在START。先当面询问玛拉本案许可，再逐步实际步行或付费外放同一原灵。'); return; }
    if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`three-headed-templar-life-${c.caseId}`); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `如实报告扮演+25；${r.result === 'ABILITY' ? '实际原灵协作且完整收口，多灵外放掌握+8' : '普通完成、失败后亲自核查或真实撤回，不加能力掌握'}。`); return; }
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && currentAttempt(s)!.inspected) { const a = currentAttempt(s)!; a.closed = true; a.ownerConsent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; l.activeCase = null; ctx.note('收束同一原现场', '本人真实回START，唯一原卡在A原桌、原遮板关闭、所有仍受控外放灵已沿本地原路收回。没有补灵或消除旧消耗。'); return; }
  }
  const a = currentAttempt(s)!;
  const tier = c.type === 'EXTERNALIZE' ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, { command: structuredClone(c), tier, atSecond: a.elapsedSeconds, ownerWilling: l.owner.willing, masterSpirituality: s.spirituality, masterMind: s.mind });
  ctx.note(`G · ${c.type}`, `只记录本步实际原人、原灵和原物。本人${l.playerLocation}，本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米，实耗本人${a.spiritualitySpent}灵性/${a.mindSpent}精神；原灵自身消耗单独保留。${tier ? `知识18结果${tier}，失败仍已付费，可亲自普通核查。` : ''}`);
}

const LABELS: Record<SceneCommand, [string, string]> = {
  CONSENT_OWNER: ['当面问玛拉本案独立许可', '2秒'], TAKE_CARD: ['在A领取同一原卡', '1秒'], RETURN_CARD: ['在A将同一原卡归还原桌', '1秒'], WALK_A: ['本人沿原路实走到A', '4米4秒'], WALK_B: ['本人从A实走到B', '4米4秒'], RETURN_START: ['本人从A实走回START', '4米4秒'],
  READ_CARD: ['本人在A读唯一原卡', '2秒'], READ_FAR_SEAL: ['本人在B核原封条远端', '2秒'], SECURE_LEFT: ['本人在A普通固定原左箱', '2秒'], CHECK_RIGHT: ['本人在B核原右箱', '2秒'],
  OPEN_LIGHT: ['实际打开B原遮板与同一灯', '2秒 · START原8米机械绳或B手动 · 在B原灵完整度−20'], CLOSE_SHUTTER: ['实际关闭原遮板和原灯', '2秒 · START机械绳或B手动'], INSPECT: ['核验原物、原灵收回与本人返回', '2秒'], WITHDRAW: ['明确撤回，保留成本并原路收口', '1秒 · 不自动归物或移动'],
};
export function threeHeadedTemplarLifeActions(s: SliceState): ThreeHeadedTemplarLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.threeHeadedTemplar.life, actions: ThreeHeadedTemplarLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: ThreeHeadedTemplarActivityCommand, validOnly = false) => { const reason = threeHeadedTemplarActivityReason(s, command); if (!validOnly || reason === null) actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (l.metSpiritsWeek === null) add('meet-spirits', '当面核两份死亡记录与原封存匣', '1行动 · 不自动取得原灵', { type: 'MEET_SPIRITS' });
  if (l.metSpiritsWeek !== null) for (const sp of Object.values(l.spirits)) {
    const id = sp.id;
    if (sp.status === 'SEALED') {
      add(`${id}-prepare`, `为${sp.name}同一原匣准备交接`, '1行动+180便士 · 每原灵每周一次', { type: 'PREPARE_GRAZING', spiritId: id });
      if (sp.preparedWeek === s.week) for (let mask = 7; mask >= 1; mask--) {
        const abilityIds = sp.knownAbilities.filter((_, index) => (mask & 1 << index) !== 0);
        add(`${id}-graze-${mask}`, `风险放牧${sp.name}：选择${abilityIds.join('、')}`, '1行动+6本人灵性+2精神 · 知识18 · 原准备失败也耗尽', { type: 'GRAZE', spiritId: id, abilityIds, confirmed: true });
      }
    }
    if (sp.status === 'GRAZED' && sp.location === 'INTERNAL') {
      add(`${id}-externalize`, `尝试外放同一${sp.name}`, '0行动 · 4本人灵性+2精神 · 知识18 · 2秒 · 每场一次', { type: 'EXTERNALIZE', spiritId: id });
      add(`${id}-rest`, `将${sp.name}收入原匣付费照护`, '1行动+40便士 · 较晚周一次 · 原灵+10灵性/+10完整度', { type: 'REST_SPIRIT', spiritId: id });
      add(`${id}-release`, `永久释放同一${sp.name}`, '0行动 · 不可重新取得或免费替换', { type: 'RELEASE_GRAZED', spiritId: id, confirmed: true });
    }
    if (external(sp)) {
      add(`${id}-recall`, `沿原路收回同一${sp.name}`, `0行动/0灵性 · ${distance(sp.location)}米${distance(sp.location)}秒 · 不补满`, { type: 'RECALL_SPIRIT', spiritId: id });
      if (l.activeCase) {
        for (const destination of ['A', 'B'] as const) add(`${id}-send-${destination}`, `让${sp.name}沿原路到${destination}`, `${Math.abs(distance(sp.location) - distance(destination))}米/秒 · 不复制`, { type: 'SEND_SPIRIT', spiritId: id, destination }, true);
        for (const method of sp.selectedAbilities) add(`${id}-assist-${method}`, `${sp.name}实际使用已选${method}`, '原灵3灵性 · 每两次分派主人1维持灵性 · 2秒', { type: 'ASSIST', spiritId: id, method }, true);
      }
    }
  }
  for (const [index, spec] of CASES.entries()) {
    if (index > 0 && l.cases[THREE_HEADED_TEMPLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原人、原物和边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') for (const method of ['ABILITY', 'ORDINARY'] as const) if (r.method !== method) add(`${id}-${method.toLowerCase()}`, method === 'ABILITY' ? '准备真实原灵有限协作' : '准备本人普通顺序步行', r.status === 'PREPARED' ? '0行动 · 实施前换方案' : '1行动 · 另留1行动实施', { type: 'PREPARE', caseId: id, method });
    if (r.status === 'PREPARED') { add(`${id}-perform`, '实施本案，不自动施术或移动', '1行动', { type: 'PERFORM', caseId: id }); add(`${id}-withdraw-preparation`, '撤回尚未实施的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      if (r.attempts[0]!.inspected) add(`${id}-close`, '关闭已真实收口的现场', '0行动', { type: 'CLOSE', caseId: id });
      else for (const type of SCENE_TYPES as SceneCommand[]) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], `0行动 · ${LABELS[type][1]}`, { type, caseId: id }, true);
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '如实报告原灵、普通核查与原消耗', `1行动 · 扮演+25${r.result === 'ABILITY' ? ' · 实际协作掌握+8' : ' · 不加能力掌握'}`, { type: 'REPORT', caseId: id });
  }
  if (!l.reflected && THREE_HEADED_TEMPLAR_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('three-headed-templar-reflect', '反思两灵有限协作与本人责任', '1行动 · 扮演+25', { type: 'REFLECT' });
  return actions;
}
function preferredAction(s: SliceState, actions: ThreeHeadedTemplarLifeAction[]): ThreeHeadedTemplarLifeAction | null {
  const l = s.threeHeadedTemplar.life, a = currentAttempt(s), enabled = actions.filter(row => row.enabled);
  const find = (type: ThreeHeadedTemplarActivityCommand['type'], spiritId?: ThreeHeadedTemplarSpiritId, detail?: string) => enabled.find(row => row.command.type === type && (!spiritId || 'spiritId' in row.command && row.command.spiritId === spiritId) && (!detail || 'method' in row.command && row.command.method === detail || 'destination' in row.command && row.command.destination === detail));
  if (!a) return enabled.find(row => row.command.type === 'MEET_SPIRITS') ?? enabled.find(row => ['PERFORM', 'REPORT', 'REFLECT', 'OBSERVE'].includes(row.command.type)) ?? enabled.find(row => row.command.type === 'PREPARE' && row.command.method === 'ORDINARY') ?? enabled.find(row => row.command.type !== 'RELEASE_GRAZED') ?? null;
  if (a.inspected) return find('CLOSE') ?? null;
  if (a.ownerConsent === 'UNASKED') return find('CONSENT_OWNER') ?? null;
  const id = l.activeCase!;
  if (a.withdrawn || evidenceComplete(id, a)) {
    if (l.shutter.state === 'OPEN') return find('CLOSE_SHUTTER') ?? find('WALK_A') ?? null;
    const ext = getExternalThreeHeadedTemplarSpirits(s)[0]; if (ext) return find('RECALL_SPIRIT', ext.id) ?? null;
    if (l.card.location === 'PLAYER') return find('RETURN_CARD') ?? find('WALK_A') ?? null;
    if (l.playerLocation !== 'START') return find('RETURN_START') ?? find('WALK_A') ?? null;
    return find('INSPECT') ?? null;
  }
  if (a.method === 'ABILITY' && !a.playerMoves.length) {
    const h = l.spirits['THT3-HELENA'], r = l.spirits['THT3-ROLAND'];
    const aim = (sp: ThreeHeadedTemplarSpiritState, at: 'A' | 'B', method: ThreeHeadedTemplarSpiritMethod) => find('EXTERNALIZE', sp.id) ?? (sp.location !== at ? find('SEND_SPIRIT', sp.id, at) : find('ASSIST', sp.id, method));
    let preferred: ThreeHeadedTemplarLifeAction | undefined;
    if (id === 'two-end-seal') preferred = aim(h, a.cardRead ? 'B' : 'A', 'SIGNAL');
    if (id === 'paired-care') preferred = !a.leftSecured ? aim(r, 'A', 'STEADY_HOLD') : aim(h, 'B', 'LOW_GLOW');
    if (id === 'interrupted-light') {
      if (!performed(s, h.id, 'LOW_GLOW')) preferred = aim(h, 'B', 'LOW_GLOW');
      else if (!a.lightOpened) preferred = r.location !== 'A' ? find('EXTERNALIZE', r.id) ?? find('SEND_SPIRIT', r.id, 'A') : find('OPEN_LIGHT');
      else if (external(h)) preferred = find('RECALL_SPIRIT', h.id);
      else if (!a.rolandContinued) preferred = aim(r, 'A', 'SIGNAL');
      else preferred = find('CLOSE_SHUTTER');
    }
    if (preferred) return preferred;
  }
  if (l.playerLocation === 'START') return find('WALK_A') ?? find('WITHDRAW') ?? null;
  if (id === 'two-end-seal') return !a.cardRead ? find('READ_CARD') ?? null : !a.farSealRead ? find('READ_FAR_SEAL') ?? find('WALK_B') ?? null : null;
  if (id === 'paired-care') return !a.leftSecured ? find('SECURE_LEFT') ?? null : find('CHECK_RIGHT') ?? find('WALK_B') ?? null;
  return !a.lightOpened ? find('OPEN_LIGHT') ?? find('WALK_B') ?? null : find('CLOSE_SHUTTER') ?? null;
}
export function projectThreeHeadedTemplarLife(s: SliceState): ThreeHeadedTemplarLifeProjection {
  const l = s.threeHeadedTemplar.life, a = currentAttempt(s), actions = threeHeadedTemplarLifeActions(s), next = preferredAction(s, actions), inside = hasThreeHeadedTemplarLifeLock(s);
  return { ...structuredClone(l), title: '三首圣堂 · 同一原灵的有限双外放', story: THREE_HEADED_TEMPLAR_LIFE_STORY, environment: THREE_HEADED_TEMPLAR_LIFE_ENVIRONMENT, spirits: l.metSpiritsWeek === null ? [] : Object.values(structuredClone(l.spirits)),
    currentAttempt: a ? structuredClone(a) : null, inside, insideCase: l.activeCase !== null, actions, preferredActionId: next?.id ?? null,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : l.reflected ? '三份真实报告和反思已完成；原灵消耗与不可逆后果保留，可继续普通生活。' : '先查看本案真实来源、资源或场景条件。',
    facts: [
      `同一本人在${l.playerLocation}，累计步行${l.playerTravelMetres}米，原场景时钟${l.clockSeconds}秒（含真实战斗）。START↔A4米，A↔B4米。`,
      `玛拉51岁/THT3-MARA在START，当前${l.owner.willing ? '愿意' : '不愿意'}；会面交接与每案许可分别实际询问。两个原封存匣一直保留，释放或消散后不得重得。`,
      `唯一原卡${l.card.id}在${l.card.location === 'TABLE' ? 'A原桌' : `本人实持/${l.playerLocation}`}，实际随身${l.card.travelMetres}米；同一左箱在A、右箱与远端原封条在B，未复制。`,
      `原灯在B为${l.lamp.on ? '亮' : '灭'}，同一原遮板${l.shutter.state}；START有连接它的同一8米机械绳，本人实际拉绳才开闭，不是瞬移或造物。`,
      `总放牧容量7；旧已放牧${s.shepherd.grazing.spirits.filter(sp => sp.status === 'GRAZED').length}位，新实际放牧${Object.values(l.spirits).filter(sp => sp.status === 'GRAZED').length}位；当前旧本人借用${s.shepherd.grazing.activeSpiritId ?? '无'}，仍互斥1。新两灵只外放已选方法，旧伊芮斯不冒充四阶外放源。`,
      '每原灵初始/上限30灵性、100完整度，当前按逐灵实际记录；技巧3自身灵性，回收不补满。较晚周明确收入同一原匣，以40便士物料和1行动恢复10灵性/10完整度；不复活释放或消散者。',
      '普通步行分支与失败后真实亲自核查均可报告反思至100；只给实际外放协作完成的本案掌握+8，不用全知报告或普通行动冒充新能力。',
    ],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '真实原灵付费协作并原路收口；报告掌握+8' : '真实普通核查或明确撤回，不加能力掌握', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }),
  };
}

/** Replay actual selected sources, finite payments and each ordered scene. Never accept a refreshed spirit snapshot. */
export function validateThreeHeadedTemplarLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.threeHeadedTemplar?.life, initial = createThreeHeadedTemplarLifeState(), promotion = s.threeHeadedTemplar?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, THREE_HEADED_TEMPLAR_CASE_IDS) || !validateThreeHeadedTemplarSpiritSources(l.spirits, s.week)) return false;
  if (l.siteId !== initial.siteId || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || !['START', 'A', 'B'].includes(l.playerLocation) || l.activeCase !== null && !THREE_HEADED_TEMPLAR_CASE_IDS.includes(l.activeCase) || typeof l.reflected !== 'boolean') return false;
  if (!record(l.owner) || typeof l.owner.willing !== 'boolean' || !same(l.owner, { ...initial.owner, willing: l.owner.willing })) return false;
  if (!record(l.card) || !shape(l.card, Object.keys(initial.card)) || !['TABLE', 'PLAYER'].includes(l.card.location) || !integer(l.card.travelMetres)) return false;
  for (const key of ['leftBox', 'rightBox', 'farSeal'] as const) if (!same(l[key], initial[key])) return false;
  if (!same(l.lamp, { ...initial.lamp, on: l.lamp.on }) || typeof l.lamp.on !== 'boolean' || !['CLOSED', 'OPEN'].includes(l.shutter.state) || !same(l.shutter, { ...initial.shutter, state: l.shutter.state }) || l.lamp.on !== (l.shutter.state === 'OPEN')) return false;
  const totalGrazed = Object.values(l.spirits).filter(sp => sp.status === 'GRAZED').length + s.shepherd.grazing.spirits.filter(sp => sp.status === 'GRAZED').length;
  if (totalGrazed > 7) return false;
  const outcomes = s.combatHistory.flatMap(round => round.threeHeadedTemplarOutcome ? [round.threeHeadedTemplarOutcome] : []);
  let combatSeconds = 0;
  for (const outcome of outcomes) { if (!integer(outcome.elapsedSeconds) || outcome.elapsedSeconds < 60) return false; combatSeconds += outcome.elapsedSeconds; }
  const encounter = s.threeHeadedTemplar.encounter;
  if (encounter.status === 'RESOLVED' && encounter.startHistoryIndex === null && encounter.scene.playerPosition === 'EXIT') combatSeconds += 4;
  if (promotion === null) return same(l, { ...initial, owner: { ...initial.owner, willing: l.owner.willing }, clockSeconds: combatSeconds });
  if (!integer(promotion, 1, s.week) || l.metSpiritsWeek !== null && !integer(l.metSpiritsWeek, promotion, s.week)) return false;
  let outsideSeconds = 0;
  for (const sp of Object.values(l.spirits)) for (const event of sp.history) {
    if (l.metSpiritsWeek === null || event.week < l.metSpiritsWeek || event.atSecond + event.seconds > l.clockSeconds) return false;
    if (event.round !== null) {
      const outcome = outcomes.find(o => o.round === event.round && o.source.week === event.week);
      if (!outcome || !outcome.spiritsAfter[sp.id].history.some(e => same(e, event))) return false;
    } else if (!event.context.startsWith('CASE:')) {
      if (event.context !== `IDLE:${event.week}` && event.context !== `ENCOUNTER:${encounter.approachWeek}`) return false;
      if (event.context.startsWith('ENCOUNTER:') && (!['EXTERNALIZE', 'RECALL'].includes(event.type) || encounter.approachWeek === null || event.week !== encounter.approachWeek)) return false;
      if (['SEND', 'ASSIST', 'LIGHT_BREAK', 'SUPPORT', 'DEATH_RELEASE'].includes(event.type)) return false;
      if (event.type === 'EXTERNALIZE' && event.destination !== (event.context.startsWith('ENCOUNTER:') ? 'COURT' : 'START')) return false;
      outsideSeconds += event.seconds;
    }
  }
  if (l.introducedWeek === null) {
    if (l.introducedDate !== null || !THREE_HEADED_TEMPLAR_CASE_IDS.every(id => same(l.cases[id], freshCase())) || l.activeCase !== null || l.reflected || l.playerTravelMetres !== 0 || l.playerLocation !== 'START' || !same(l.card, initial.card) || !same(l.lamp, initial.lamp) || !same(l.shutter, initial.shutter)) return false;
    return (!promoted(s) || s.progression.acting === 0) && !s.seer.completedSources.some(source => source === 'three-headed-templar-reflection' || THREE_HEADED_TEMPLAR_CASE_IDS.some(id => source === `three-headed-templar-life-${id}`)) && l.clockSeconds === outsideSeconds + combatSeconds && Object.values(l.spirits).every(sp => sp.history.every(e => !e.context.startsWith('CASE:')));
  }
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['two-end-seal'].observedWeek !== l.introducedWeek) return false;
  const replay = createThreeHeadedTemplarLifeState(); replay.metSpiritsWeek = l.metSpiritsWeek; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, activeEvent: null, combat: null, threeHeadedTemplar: { ...s.threeHeadedTemplar, life: replay, encounter: { ...encounter, status: 'AVAILABLE' } } };
  let open = 0, prepared = 0, resolved = 0, masteryEarned = 0, sceneSeconds = 0, lastEndSecond = 0;
  const covered = new Set<string>();
  for (const [index, id] of THREE_HEADED_TEMPLAR_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (!same(r, freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[THREE_HEADED_TEMPLAR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(shadow, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.startSecond, lastEndSecond, l.clockSeconds) || !integer(a.elapsedSeconds) || !Array.isArray(a.steps) || !record(a.initialSpiritHistory) || !record(a.finalSpiritHistory) || !shape(a.initialSpiritHistory, THREE_HEADED_TEMPLAR_SPIRIT_IDS) || !shape(a.finalSpiritHistory, THREE_HEADED_TEMPLAR_SPIRIT_IDS)) return false;
    for (const source of THREE_HEADED_TEMPLAR_SPIRIT_SOURCES) {
      const sp = l.spirits[source.id], count = a.initialSpiritHistory[source.id], end = a.finalSpiritHistory[source.id];
      if (!integer(count, 0, sp.history.length) || !integer(end, count, sp.history.length)) return false;
      const copy = freshSpirit(source);
      for (const event of sp.history.slice(0, count)) { if (event.week > a.week || event.atSecond + event.seconds > a.startSecond) return false; transitionSpirit(copy, event); }
      if (external(copy)) return false;
      replay.spirits[source.id] = copy;
    }
    shadow.week = a.week; shadow.date = { ...a.date }; replay.clockSeconds = a.startSecond; replay.activeCase = id;
    const expected = freshAttempt(shadow, a.method);
    replay.cases[id] = { ...structuredClone(r), status: 'ACTIVE', result: 'NONE', contactOpen: true, returned: false, closes: 0, withdrawals: r.withdrawals - Number(a.withdrawn), attempts: [expected] };
    if (!integer(replay.cases[id].withdrawals)) return false;
    let priorS: number | null = null, priorM: number | null = null;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['command', 'tier', 'atSecond', 'ownerWilling', 'masterSpirituality', 'masterMind']) || !validateThreeHeadedTemplarActivityCommand(step.command) || typeof step.ownerWilling !== 'boolean' || step.atSecond !== expected.elapsedSeconds || !integer(step.masterSpirituality, 0, 120) || !integer(step.masterMind, 0, 100)) return false;
      const command = step.command;
      if (![...SCENE_TYPES, 'EXTERNALIZE', 'SEND_SPIRIT', 'ASSIST', 'RECALL_SPIRIT'].includes(command.type) || command.type === 'EXTERNALIZE' && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier)) || command.type !== 'EXTERNALIZE' && step.tier !== null) return false;
      if (priorS !== null && step.masterSpirituality !== priorS || priorM !== null && step.masterMind !== priorM) return false;
      shadow.spirituality = step.masterSpirituality; shadow.mind = step.masterMind; replay.owner.willing = step.ownerWilling;
      if (sceneReason(shadow, command) !== null) return false;
      applyScene(shadow, step); priorS = shadow.spirituality; priorM = shadow.mind;
    }
    if (a.closed) { if (!expected.inspected || cleanupBlock(shadow)) return false; expected.closed = true; expected.ownerConsent = 'CLOSED'; replay.activeCase = null; }
    if (!same(a, expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed || replay.cases[id].withdrawals !== r.withdrawals) return false;
    for (const source of THREE_HEADED_TEMPLAR_SPIRIT_SOURCES) {
      const start = a.initialSpiritHistory[source.id], end = a.finalSpiritHistory[source.id];
      if (!same(replay.spirits[source.id].history, l.spirits[source.id].history.slice(0, end))) return false;
      for (let i = start; i < end; i++) { if (l.spirits[source.id].history[i]!.context !== `CASE:${id}` || covered.has(`${source.id}:${i}`)) return false; covered.add(`${source.id}:${i}`); }
    }
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') { resolved++; if (r.result === 'ABILITY') masteryEarned += 8; }
    sceneSeconds += a.elapsedSeconds; lastEndSecond = a.startSecond + a.elapsedSeconds; replay.cases[id] = structuredClone(r);
  }
  for (const sp of Object.values(l.spirits)) for (const [index, e] of sp.history.entries()) if (e.context.startsWith('CASE:') && !covered.has(`${sp.id}:${index}`)) return false;
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  if (s.seer.completedSources.filter(source => source === 'three-headed-templar-reflection').length !== Number(l.reflected)) return false;
  for (const id of THREE_HEADED_TEMPLAR_CASE_IDS) if (s.seer.completedSources.filter(source => source === `three-headed-templar-life-${id}`).length !== Number(l.cases[id].status === 'RESOLVED')) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.owner.willing = l.owner.willing; replay.spirits = structuredClone(l.spirits); replay.clockSeconds = sceneSeconds + outsideSeconds + combatSeconds;
  if (!same(l, replay)) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) >= masteryEarned;
}
