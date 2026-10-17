import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasNightwatcherLifeLock } from '../nightwatcher/life.js';

export const FEAR_BISHOP_CASE_IDS = ['contained-residue', 'stop-signal', 'corridor-exit'] as const;
export type FearBishopCaseId = typeof FEAR_BISHOP_CASE_IDS[number];
export type FearBishopLocation = 'EXIT' | 'BENCH' | 'CORRIDOR_ENTRANCE' | 'STORE';
export type FearBishopConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'CLOSED';
export interface FearBishopAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number;
  consent: FearBishopConsent; consentWeek: number | null; ownerConsent: FearBishopConsent; ownerConsentWeek: number | null;
  abilityTier: PublicResolutionTier | null; sourceRead: boolean; residuePlaced: boolean; bystandersClear: boolean; residueSealed: boolean; containerReturned: boolean;
  stopAgreed: boolean; stoppedBy: 'PLAYER' | 'TOMAS' | null; wakeConfirmed: boolean; volunteerLeft: boolean; ordinaryStory: boolean;
  sideRouteChecked: boolean; route: 'CORRIDOR' | 'SIDE' | null; lampTaken: boolean; lampReturned: boolean; inspected: boolean;
}
export interface FearBishopCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: FearBishopAttempt[];
}
export interface FearBishopLifeState {
  activeCase: FearBishopCaseId | null; playerLocation: FearBishopLocation; playerTravelMetres: number; clockSeconds: number;
  edith: { id: 'FB3-EDITH'; name: '伊迪丝'; age: 46; alive: true; willing: boolean; location: 'EXIT' };
  tomas: { id: 'FB3-TOMAS'; name: '托马斯'; age: 34; alive: true; willing: boolean; health: 100; mind: number; state: 'AWAKE' | 'DROWSY'; location: 'CHAIR' | 'EXIT'; effectActive: boolean; remainingSeconds: number; travelMetres: number };
  residue: { id: 'FB3-RESIDUE-1'; owner: 'FB3-EDITH'; source: string; alive: false; conscious: false; status: 'CONTAINED' | 'ON_BENCH' | 'DISSOLVED' | 'SEALED'; location: 'CONTAINER' | 'BENCH' | 'NONE' };
  container: { id: 'FB3-GLASS-1'; owner: 'FB3-EDITH'; location: 'OWNER' | 'PLAYER' };
  trace: { id: 'FB3-TRACE-1'; source: string; alive: false; conscious: false; status: 'PRESENT' | 'DISSOLVED' | 'ISOLATED' };
  lamp: { id: 'FB3-LAMP'; owner: 'FB3-EDITH'; location: 'STORE' | 'PLAYER' | 'OWNER' };
  shutter: { id: 'FB3-SHUTTER'; location: 'RAISED' | 'LOWERED' }; sideRouteChecked: boolean;
  cases: Record<FearBishopCaseId, FearBishopCaseState>; reflected: boolean;
}
export type FearBishopActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'READ_SOURCE' | 'CONSENT_OWNER' | 'PLACE_RESIDUE' | 'CLEAR_BYSTANDERS' | 'DISSOLVE' | 'SEAL_RESIDUE' | 'RETURN_CONTAINER' | 'CONSENT' | 'AGREE_STOP' | 'SLEEP_FEAR' | 'WAKE' | 'CONFIRM_WAKE' | 'LEAVE_VOLUNTEER' | 'ORDINARY_STORY' | 'CHECK_SIDE_ROUTE' | 'APPROACH_CORRIDOR' | 'ISOLATE_TRACE' | 'WALK_CORRIDOR' | 'WALK_SIDE' | 'TAKE_LAMP' | 'RETURN_PLAYER' | 'RETURN_LAMP' | 'INSPECT'; caseId: FearBishopCaseId }
  | { type: 'PREPARE'; caseId: FearBishopCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'STOP'; caseId: FearBishopCaseId; actor: 'PLAYER' | 'TOMAS' }
  | { type: 'REFLECT' };
export interface FearBishopLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FearBishopActivityCommand }
export interface FearBishopLifeProjection {
  title: string; story: string; environment: string; activeCase: FearBishopCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: FearBishopLocation; playerTravelMetres: number; currentAttempt: FearBishopAttempt | null;
  edith: FearBishopLifeState['edith']; tomas: FearBishopLifeState['tomas']; residue: FearBishopLifeState['residue']; container: FearBishopLifeState['container'];
  trace: FearBishopLifeState['trace']; lamp: FearBishopLifeState['lamp']; shutter: FearBishopLifeState['shutter']; sideRouteChecked: boolean;
  cases: { id: FearBishopCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: FearBishopAttempt[] }[];
  actions: FearBishopLifeAction[];
}
export const FEAR_BISHOP_RESIDUE_SOURCE = '原创G封存记录FB3-REGISTER-1：伊迪丝保管的一次已结束梦术试验留下唯一凝片FB3-RESIDUE-1；无生命、无独立意识，不是原文物种、活人或原灵。';
export const FEAR_BISHOP_TRACE_SOURCE = '原创G原库房记录FB3-REGISTER-2：同一旧库廊留下唯一弱梦术痕迹FB3-TRACE-1，妨碍此段8米通行；它无生命、无意识，普通黑暗本身不是邪恶。';
export const FEAR_BISHOP_LIFE_STORY = '原创G有限生活：观察、准备、实施、报告各1行动，准备须至少余2行动。子步0行动但真实耗时与走路；三报告各扮演25，反思25，实际成功对应新能力掌握8。每案能力仅判定一次，失败成本保留，普通收束与出口不需灵性。不是现实治疗、读心、强制真话、全图隐秘或无条件消灭活人。';
const CASES = [
  { id: 'contained-residue', title: '有来源凝片的有限毁弃', story: '46岁原保管员伊迪丝在原库房入口。先读原封存记录，再询问本次毁弃许可，亲手把唯一无生命、无意识梦术凝片放到2米外原隔离台，撤开旁人。', facts: ['有限消逝6灵性、知识18，只判定一次；成功使原凝片不可恢复地消散。', '失败或普通方法把同一原凝片封回原玻璃容器；空容器或装着封存原件的容器必须亲手还给原主人。'] },
  { id: 'stop-signal', title: '由本人说出的停止口令', story: '34岁成年人托马斯自愿参加一次低强梦境压力辨识。本人当面只同意本次，先约定口令“到此为止”；他和施术者都能立即停止，随后实际醒来、确认并走出。', facts: ['安眠与恐惧结合5灵性、意志18，只判定一次。成功短暂DROWSY并实付2精神，停止不退回精神。', '普通方法是托马斯自己描述已提前提供的虚构故事带来的感受；不是治疗、读取秘密或强制真话。'] },
  { id: 'corridor-exit', title: '原灯与两条可走的出口', story: '伊迪丝委托取回旧库房同一FB3-LAMP。查明有来源弱梦术痕迹及原12米普通侧路，再实际走到廊口；消逝成功才通8米原廊，失败用原遮板隔离后走侧路。', facts: ['有限消逝6灵性、知识18，只判定一次。原廊8米、原侧路12米，取灯后沿实际选择的同一路线返回。', '失败不重骰；原痕迹只会实际消散或保持隔离，原灯须亲手归还。放弃也可沿已走普通路退出。'] },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 3;
const hasFearBishopHistory = (s: SliceState) => s.progression.pathwayId === 'darkness' && [3, 2].includes(s.progression.sequence ?? 0);
const freshCase = (): FearBishopCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const freshAttempt = (week: number, method: 'ABILITY' | 'ORDINARY'): FearBishopAttempt => ({ week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, consent: 'UNASKED', consentWeek: null, ownerConsent: 'UNASKED', ownerConsentWeek: null, abilityTier: null, sourceRead: false, residuePlaced: false, bystandersClear: false, residueSealed: false, containerReturned: false, stopAgreed: false, stoppedBy: null, wakeConfirmed: false, volunteerLeft: false, ordinaryStory: false, sideRouteChecked: false, route: null, lampTaken: false, lampReturned: false, inspected: false });
export function createFearBishopLifeState(): FearBishopLifeState {
  return { activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 0, clockSeconds: 0,
    edith: { id: 'FB3-EDITH', name: '伊迪丝', age: 46, alive: true, willing: true, location: 'EXIT' },
    tomas: { id: 'FB3-TOMAS', name: '托马斯', age: 34, alive: true, willing: true, health: 100, mind: 100, state: 'AWAKE', location: 'CHAIR', effectActive: false, remainingSeconds: 0, travelMetres: 0 },
    residue: { id: 'FB3-RESIDUE-1', owner: 'FB3-EDITH', source: FEAR_BISHOP_RESIDUE_SOURCE, alive: false, conscious: false, status: 'CONTAINED', location: 'CONTAINER' },
    container: { id: 'FB3-GLASS-1', owner: 'FB3-EDITH', location: 'OWNER' },
    trace: { id: 'FB3-TRACE-1', source: FEAR_BISHOP_TRACE_SOURCE, alive: false, conscious: false, status: 'PRESENT' },
    lamp: { id: 'FB3-LAMP', owner: 'FB3-EDITH', location: 'STORE' }, shutter: { id: 'FB3-SHUTTER', location: 'RAISED' }, sideRouteChecked: false,
    cases: { 'contained-residue': freshCase(), 'stop-signal': freshCase(), 'corridor-exit': freshCase() }, reflected: false };
}
export const hasFearBishopLifeLock = (s: SliceState): boolean => { const l = s.fearBishop.life; return l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED') || l.playerLocation !== 'EXIT' || l.container.location !== 'OWNER' || l.lamp.location === 'PLAYER' || l.tomas.effectActive || l.tomas.state !== 'AWAKE'; };
export const fearBishopInside = hasFearBishopLifeLock;
const currentAttempt = (s: SliceState): FearBishopAttempt | null => { const l = s.fearBishop.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
function elapse(s: SliceState, a: FearBishopAttempt, seconds: number) { const l = s.fearBishop.life; a.elapsedSeconds += seconds; l.clockSeconds += seconds; if (l.tomas.effectActive) { l.tomas.remainingSeconds = Math.max(0, l.tomas.remainingSeconds - seconds); if (!l.tomas.remainingSeconds) l.tomas.effectActive = false; } }
function walk(s: SliceState, a: FearBishopAttempt, to: FearBishopLocation, metres: number) { const l = s.fearBishop.life; l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; elapse(s, a, metres); }
function setResult(s: SliceState, id: FearBishopCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.fearBishop.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
const caseCommands = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'READ_SOURCE', 'CONSENT_OWNER', 'PLACE_RESIDUE', 'CLEAR_BYSTANDERS', 'DISSOLVE', 'SEAL_RESIDUE', 'RETURN_CONTAINER', 'CONSENT', 'AGREE_STOP', 'SLEEP_FEAR', 'WAKE', 'CONFIRM_WAKE', 'LEAVE_VOLUNTEER', 'ORDINARY_STORY', 'CHECK_SIDE_ROUTE', 'APPROACH_CORRIDOR', 'ISOLATE_TRACE', 'WALK_CORRIDOR', 'WALK_SIDE', 'TAKE_LAMP', 'RETURN_PLAYER', 'RETURN_LAMP', 'INSPECT'];
export function validateFearBishopActivityCommand(v: unknown): v is FearBishopActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!FEAR_BISHOP_CASE_IDS.includes(v.caseId as FearBishopCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'STOP') return shape(v, ['type', 'caseId', 'actor']) && v.caseId === 'stop-signal' && ['PLAYER', 'TOMAS'].includes(String(v.actor));
  return shape(v, ['type', 'caseId']) && caseCommands.includes(String(v.type));
}
export const isFearBishopActivityCommand = validateFearBishopActivityCommand;
export const isFearBishopActivity = validateFearBishopActivityCommand;
const ownerConsents = (s: SliceState, a: FearBishopAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.fearBishop.life.edith.willing;
const volunteerConsents = (s: SliceState, a: FearBishopAttempt) => a.consent === 'GRANTED' && a.consentWeek === s.week && s.fearBishop.life.tomas.willing;
function physicalCleanupBlock(s: SliceState, id: FearBishopCaseId): string | null {
  const l = s.fearBishop.life, a = l.cases[id].attempts.at(-1);
  if (!a || !l.cases[id].contactOpen) return '没有本项尚未结束的原现场。';
  if (l.residue.status === 'ON_BENCH' || l.container.location !== 'OWNER') return '须封存未消散原凝片，再亲手归还同一原玻璃容器。';
  if (l.tomas.effectActive || l.tomas.state !== 'AWAKE') return '先停止有限压力并实际唤醒原托马斯。';
  if (id === 'stop-signal' && (!a.wakeConfirmed || !a.volunteerLeft)) return '须当面确认托马斯清醒，再由他实际走出两米。';
  if (l.lamp.location === 'PLAYER') return '先亲手把同一原灯交回伊迪丝。';
  return l.playerLocation !== 'EXIT' ? '本人须沿已知普通原路实际返回出口。' : null;
}
export function blockFearBishopLife(s: SliceState, c: FearBishopActivityCommand): string | null {
  if (!validateFearBishopActivityCommand(c)) return '恐惧主教生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已经成为恐惧主教3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德的原库房。';
  if (['READY', 'FIGHTING'].includes(s.fearBishop.encounter.status)) return '先和平离开或结束原庭遭遇。';
  const l = s.fearBishop.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return physicalCleanupBlock(s, c.caseId) ?? (a?.inspected ? null : '先检查同一原物、原人和实际出口。');
  if (r?.contactOpen && a && !a.closed && 'caseId' in c && l.activeCase === c.caseId) {
    // Cleanup is physical and free even at zero AP, spirituality or mind.
    if (c.type === 'RETURN_PLAYER') return l.playerLocation === 'BENCH' && l.residue.status === 'ON_BENCH' ? '先普通封回台上原凝片再携原容器返回，不能把尚未收束的原件留台。' : l.playerLocation !== 'EXIT' ? null : '本人已经在原出口。';
    if (c.type === 'SEAL_RESIDUE') return c.caseId === 'contained-residue' && a.residuePlaced && l.residue.status === 'ON_BENCH' && l.playerLocation === 'BENCH' ? null : '须本人在原隔离台，封回尚未消散的同一凝片。';
    if (c.type === 'RETURN_CONTAINER') return c.caseId === 'contained-residue' && l.container.location === 'PLAYER' && l.playerLocation === 'EXIT' && l.residue.status !== 'ON_BENCH' ? null : '须先处理原凝片并实际回出口，把原玻璃容器亲手还给伊迪丝。';
    if (c.type === 'STOP') return c.caseId === 'stop-signal' && a.stopAgreed && a.stoppedBy === null && !a.volunteerLeft ? null : '须本次已约定停止口令，且原托马斯仍在场；不能重复停止刷结果。';
    if (c.type === 'WAKE') return c.caseId === 'stop-signal' && l.tomas.state === 'DROWSY' ? null : '原托马斯已清醒，没有待唤醒的原身体。';
    if (c.type === 'CONFIRM_WAKE') return c.caseId === 'stop-signal' && !a.wakeConfirmed && !l.tomas.effectActive && l.tomas.state === 'AWAKE' ? null : '先停止压力并实际醒来，再当面确认一次。';
    if (c.type === 'LEAVE_VOLUNTEER') return c.caseId === 'stop-signal' && a.wakeConfirmed && !a.volunteerLeft && l.tomas.state === 'AWAKE' && !l.tomas.effectActive ? null : '须原托马斯清醒且本次已确认，才可实际走出。';
    if (c.type === 'RETURN_LAMP') return c.caseId === 'corridor-exit' && l.lamp.location === 'PLAYER' && l.playerLocation === 'EXIT' ? null : '须本人携带同一原灯实际返回出口。';
    if (c.type === 'INSPECT') return a.inspected ? '本次已经检查。' : physicalCleanupBlock(s, c.caseId);
    if (c.type === 'ISOLATE_TRACE') return c.caseId === 'corridor-exit' && a.sideRouteChecked && l.playerLocation === 'CORRIDOR_ENTRANCE' && l.trace.status === 'PRESENT' ? null : '须在廊口且已查原侧路，用原遮板隔离仍在原廊的痕迹。';
    if (a.inspected) return '本次已检查完成，请结束原现场。';
    if (s.health <= 0 || s.mind <= 0) return '当前身心不足；停止、唤醒、封存、还物和普通退出仍可0行动完成。';
    if (c.type === 'READ_SOURCE') return c.caseId === 'contained-residue' && !a.sourceRead && l.playerLocation === 'EXIT' ? null : '须在入口亲自阅读本次原凝片封存来源记录。';
    if (c.type === 'CONSENT_OWNER') return c.caseId !== 'stop-signal' && a.ownerConsent === 'UNASKED' && l.playerLocation === 'EXIT' && (c.caseId !== 'contained-residue' || a.sourceRead) ? null : '须当面询问原伊迪丝本次用途；凝片先读实际来源。';
    if (c.type === 'PLACE_RESIDUE') return c.caseId === 'contained-residue' && a.sourceRead && ownerConsents(s, a) && !a.residuePlaced && l.playerLocation === 'EXIT' && l.container.location === 'OWNER' && l.residue.status !== 'DISSOLVED' ? null : '须来源核实、本次原主同意，本人从原主人处取同一容器并把凝片放到原台。';
    if (c.type === 'CLEAR_BYSTANDERS') return c.caseId === 'contained-residue' && a.residuePlaced && !a.bystandersClear && l.playerLocation === 'BENCH' ? null : '须已实际放入原隔离台，再确认旁人撤到出口。';
    if (c.type === 'DISSOLVE') {
      if (c.caseId === 'stop-signal' || a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null)) return '本案只允许一次有限能力判定；失败、封存或消散后不能重骰。';
      if (!ownerConsents(s, a)) return '须原伊迪丝本次仍有效的用途同意。';
      if (c.caseId === 'contained-residue' && (!a.sourceRead || !a.residuePlaced || !a.bystandersClear || l.playerLocation !== 'BENCH' || l.residue.status !== 'ON_BENCH')) return '须核来源、放原凝片于隔离台并撤开旁人。';
      if (c.caseId === 'corridor-exit' && (!a.sideRouteChecked || l.playerLocation !== 'CORRIDOR_ENTRANCE' || l.trace.status !== 'PRESENT')) return '须先查原侧路并实际到廊口，痕迹仍在。';
      return s.spirituality >= 6 ? null : '需要6灵性；不足仍可普通封存或隔离后退出。';
    }
    if (c.type === 'CONSENT') return c.caseId === 'stop-signal' && a.consent === 'UNASKED' && l.tomas.location === 'CHAIR' && l.tomas.state === 'AWAKE' ? null : '须原34岁托马斯清醒在场，当面询问一次本次低强练习。';
    if (c.type === 'AGREE_STOP') return c.caseId === 'stop-signal' && volunteerConsents(s, a) && !a.stopAgreed && l.tomas.state === 'AWAKE' ? null : '须本人本次自愿且清醒，先约定“到此为止”口令。';
    if (c.type === 'SLEEP_FEAR') return c.caseId !== 'stop-signal' || a.method !== 'ABILITY' || r.attempts.some(x => x.abilityTier !== null) || a.ordinaryStory || a.wakeConfirmed || a.volunteerLeft ? '本案只判定一次，普通对照或收束后不再施术。' : !volunteerConsents(s, a) || !a.stopAgreed || a.stoppedBy !== null || l.tomas.location !== 'CHAIR' || l.tomas.state !== 'AWAKE' ? '須本次自愿、已约停止且原托马斯清醒在场。' : l.tomas.mind < 2 || s.spirituality < 5 ? '须本人5灵性、托马斯至少2精神；不足可普通对照或退出。' : null;
    if (c.type === 'ORDINARY_STORY') return c.caseId === 'stop-signal' && volunteerConsents(s, a) && a.stopAgreed && !a.ordinaryStory && !a.wakeConfirmed && a.stoppedBy === null && l.tomas.state === 'AWAKE' && !l.tomas.effectActive && !success(a.abilityTier) ? null : '须本次同意和停止约定，原托马斯清醒，自述预先提供的虚构故事；不覆盖已成功能力。';
    if (c.type === 'CHECK_SIDE_ROUTE') return c.caseId === 'corridor-exit' && ownerConsents(s, a) && !a.sideRouteChecked && l.playerLocation === 'EXIT' ? null : '须本次原主委托，在入口亲自检查原12米侧路和来源记录。';
    if (c.type === 'APPROACH_CORRIDOR') return c.caseId === 'corridor-exit' && a.sideRouteChecked && ownerConsents(s, a) && l.playerLocation === 'EXIT' && !a.lampReturned ? null : '须先检查实际普通侧路、取得本次委托，才能走到原廊口。';
    if (c.type === 'WALK_CORRIDOR' || c.type === 'WALK_SIDE') return c.caseId !== 'corridor-exit' || !ownerConsents(s, a) || !a.sideRouteChecked || l.playerLocation !== 'CORRIDOR_ENTRANCE' || a.route !== null ? '须本人在原廊口、本次同意仍有效，只选一条实际路径前往。' : c.type === 'WALK_CORRIDOR' && l.trace.status !== 'DISSOLVED' ? '原廊痕迹尚未实际消散，不可把普通黑暗当成通路已净空。' : c.type === 'WALK_SIDE' && l.trace.status === 'PRESENT' ? '先用原遮板隔离痕迹，再走普通侧路。' : null;
    if (c.type === 'TAKE_LAMP') return c.caseId === 'corridor-exit' && l.playerLocation === 'STORE' && a.route !== null && l.lamp.location === 'STORE' && !a.lampTaken && ownerConsents(s, a) ? null : '须本人实际走到原库房，在本次委托内取同一原灯。';
    return '按当前原人原物继续，或实际收束后退出。';
  }
  if (hasFearBishopLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消已付准备，或收束当前原现场。';
  if (hasNightwatcherLifeLock(s) || Object.values(s.nightwatcher.life.cases).some(x => x.status === 'PREPARED') || s.nightwatcher.ritual.playerLocation === 'HALL' || ['READY', 'FIGHTING'].includes(s.nightwatcher.encounter.status) || s.fearBishop.preparedWeek !== null || Object.values(s.spiritWarlock.cases).some(x => x.contactOpen || x.status === 'PREPARED') || s.spiritWarlock.companion.status === 'DEPLOYED') return '先实际结束旧现场、原灵派出或晋升准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已经完成。' : FEAR_BISHOP_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知本次实践。';
  const index = FEAR_BISHOP_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本项已报告，不可恢复原物或重复刷成长。';
  if (index > 0 && l.cases[FEAR_BISHOP_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告前项真实实践。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本项原现场已观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原来源和普通出口。' : r.attempts.at(-1)?.week === s.week ? '已付成本与失败保留，下一实际周才可重新准备普通收束。' : c.method === 'ABILITY' && r.attempts.some(x => x.abilityTier !== null) ? '本案能力已经判定过，不得跨周重骰；可准备普通路径。' : s.actionsRemaining < 2 ? '准备须至少余2行动，留1行动实施；所有返还子步0行动。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本项原实践。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先真实收束、归还、清醒确认并检查退出。';
  return '没有本项正在进行的原现场。';
}
export const blockFearBishopActivity = blockFearBishopLife;

export function applyFearBishopActivity(s: SliceState, c: FearBishopActivityCommand, ctx: SeerContext): void {
  const reason = blockFearBishopLife(s, c); if (reason) throw new Error(reason);
  const l = s.fearBishop.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('有限力量与真实退出', '三项原实践已报告，G扮演+25。毁弃须有来源和当前许可；停止后精神成本不退，原痕迹与原物去向继续存在。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动退出，已付1行动不退；尚未毁弃原物、使人入睡或进入原廊。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story + definition.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '有限能力' : '普通对照'}，保留至少1行动实施；尚未取得本次同意。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '已付1行动进入原库房现场。随后每个子步0行动，但记录实际秒数、原物与本人位置；本案最多一次能力判定。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'stop-signal' ? 'darkness.s3.sleep-fear' : 'darkness.s3.dark-dissolution'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `原人原物与普通退出已经实际核实，G扮演+25。${r.result === 'ABILITY' ? '实际成功对应新能力掌握+8。' : '普通收束不授能力掌握。'}失败、实耗和不可逆后果保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.consent = 'CLOSED'; a.ownerConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('实际结束本次原现场', '本人已在原出口，容器归原主，原托马斯清醒、若参加本案已实际退出，原灯不在手中。0行动结束，不退款、不重骰、不恢复原凝片或痕迹。'); return; }
  switch (c.type) {
    case 'READ_SOURCE': a.sourceRead = true; elapse(s, a, 4); ctx.note('亲自阅读原封存记录', FEAR_BISHOP_RESIDUE_SOURCE); return;
    case 'CONSENT_OWNER': a.ownerConsent = l.edith.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; elapse(s, a, 2); ctx.note('询问原伊迪丝本次许可', a.ownerConsent === 'GRANTED' ? c.caseId === 'contained-residue' ? '原46岁伊迪丝同意本次不可逆毁弃唯一原凝片；失败则封存同一原件。玻璃容器仍归她，须实际交还。' : '原伊迪丝委托本次处理原弱痕迹并取还同一FB3-LAMP；不授权毁弃原灯、活人或原灵。' : '原主人拒绝本次用途。原物留在原处，不得使用能力；可以检查并普通退出。'); return;
    case 'PLACE_RESIDUE': l.container.location = 'PLAYER'; l.residue.status = 'ON_BENCH'; l.residue.location = 'BENCH'; a.residuePlaced = true; walk(s, a, 'BENCH', 2); elapse(s, a, 2); ctx.note('亲手把同一原凝片放到隔离台', '本人携原容器走2米、放下原凝片另耗2秒，共4秒；原容器仍由本人保管，没有新造材料。'); return;
    case 'CLEAR_BYSTANDERS': a.bystandersClear = true; elapse(s, a, 2); ctx.note('确认旁人已经撤离隔离台', '2秒确认伊迪丝在原出口，台前没有活人或原灵。能力目标仅为已核来源的无生命原凝片。'); return;
    case 'DISSOLVE': {
      s.spirituality -= 6; a.spiritualitySpent += 6; a.abilityTier = ctx.check('knowledge', 18).tier; elapse(s, a, 2);
      if (success(a.abilityTier)) { if (c.caseId === 'contained-residue') { l.residue.status = 'DISSOLVED'; l.residue.location = 'NONE'; setResult(s, c.caseId, 'ABILITY'); } else l.trace.status = 'DISSOLVED'; }
      ctx.note(success(a.abilityTier) ? '同一有限原目标实际消逝' : '本次有限消逝失败', success(a.abilityTier) ? `6灵性与2秒已耗；${c.caseId === 'contained-residue' ? '唯一原凝片已DISSOLVED，不可恢复。空原玻璃容器仍须带回交还。' : '原FB3-TRACE-1已DISSOLVED；尚未移动本人或原灯，须实际走8米去取。'}这不是全图隐秘或无条件消灭活人。` : `6灵性与2秒照耗，效果0，本案以后不重骰。${c.caseId === 'contained-residue' ? '同一凝片仍在原隔离台，须亲手封回原容器。' : '痕迹仍在原廊，须用原遮板隔离后走12米普通侧路。'}`); return;
    }
    case 'SEAL_RESIDUE': l.residue.status = 'SEALED'; l.residue.location = 'CONTAINER'; a.residueSealed = true; elapse(s, a, 3); setResult(s, c.caseId, 'ORDINARY'); ctx.note('普通封存同一原凝片', '3秒亲手把尚在原台的同一FB3-RESIDUE-1封回原玻璃容器，状态SEALED。原件没有消失，也没有重新生成。'); return;
    case 'RETURN_CONTAINER': l.container.location = 'OWNER'; a.containerReturned = true; elapse(s, a, 2); ctx.note('亲手把原玻璃容器还给伊迪丝', l.residue.status === 'DISSOLVED' ? '2秒交回同一空FB3-GLASS-1；原凝片已毁弃，不随退出恢复。' : '2秒交回同一FB3-GLASS-1及其中SEALED的原凝片，所有权和原失败均保留。'); return;
    case 'CONSENT': a.consent = l.tomas.willing ? 'GRANTED' : 'DECLINED'; a.consentWeek = s.week; elapse(s, a, 2); ctx.note('托马斯当面回答本次邀请', a.consent === 'GRANTED' ? '原34岁成年人托马斯清醒自愿，只同意本次低强梦境压力辨识，知道可能实耗2精神并可立即停止。不是治病、读秘密或强制真话。' : '托马斯拒绝本次练习。没有施术或精神消耗；确认他清醒、尊重其实际退出即可。'); return;
    case 'AGREE_STOP': a.stopAgreed = true; elapse(s, a, 2); ctx.note('约定本次停止口令', '双方当面约定“到此为止”；托马斯或施术者任何一方说出即停止本作G压力窗口。停止不退回已发生的精神成本。'); return;
    case 'SLEEP_FEAR': s.spirituality -= 5; a.spiritualitySpent += 5; a.abilityTier = ctx.check('will', 18).tier; elapse(s, a, 2); if (success(a.abilityTier)) { l.tomas.mind -= 2; a.mindSpent = 2; l.tomas.state = 'DROWSY'; l.tomas.effectActive = true; l.tomas.remainingSeconds = 10; setResult(s, c.caseId, 'ABILITY'); } ctx.note(success(a.abilityTier) ? '托马斯进入有限短睡压力' : '本次短睡压力未生效', success(a.abilityTier) ? '实耗5灵性与2秒，原托马斯DROWSY、精神−2；原创G压力窗口至多10秒，也可立即说停止口令。随后须普通唤醒和确认，不能借此读取秘密。' : '5灵性与2秒照耗，原托马斯仍AWAKE、精神未扣，效果0。本案不重骰，可普通自述故事或直接尊重退出。'); return;
    case 'STOP': l.tomas.effectActive = false; l.tomas.remainingSeconds = 0; a.stoppedBy = c.actor; a.consent = 'REVOKED'; ctx.note('“到此为止”立即生效', `${c.actor === 'TOMAS' ? '托马斯' : '施术者'}说出本次口令，0行动0秒立即停止G窗口。原托马斯仍${l.tomas.state}，仍须实际醒来、确认、退出；已耗精神${a.mindSpent}不退回。`); return;
    case 'WAKE': l.tomas.effectActive = false; l.tomas.remainingSeconds = 0; l.tomas.state = 'AWAKE'; elapse(s, a, 2); ctx.note('普通呼唤使原托马斯实际醒来', `2秒后同一人AWAKE，精神仍${l.tomas.mind}，健康100未改；尚须由本人确认清醒。`); return;
    case 'CONFIRM_WAKE': a.wakeConfirmed = true; elapse(s, a, 2); ctx.note('当面确认原托马斯清醒', '2秒听取本人清楚回答，有限效果已停止。他可自行离开，不读取秘密，不把清醒伪称现实治疗。'); return;
    case 'LEAVE_VOLUNTEER': if (l.tomas.location === 'CHAIR') { l.tomas.location = 'EXIT'; l.tomas.travelMetres += 2; elapse(s, a, 2); } a.volunteerLeft = true; if (r.result === 'NONE') setResult(s, c.caseId, 'ORDINARY'); ctx.note('托马斯实际离开练习椅', `原人清醒沿普通2米到出口；本次已实际退出。精神仍${l.tomas.mind}，不返还原成本，尊重拒绝或停止也如实报告。`); return;
    case 'ORDINARY_STORY': a.ordinaryStory = true; elapse(s, a, 4); setResult(s, c.caseId, 'ORDINARY'); ctx.note('由托马斯自己描述虚构故事', '4秒听他自述事先提供的虚构故事带来的感受，没有施加超凡效果、读秘密或强制真话，精神不扣。'); return;
    case 'CHECK_SIDE_ROUTE': a.sideRouteChecked = true; l.sideRouteChecked = true; elapse(s, a, 4); ctx.note('查明来源与实际可通行侧路', `${FEAR_BISHOP_TRACE_SOURCE} 4秒核对原12米普通侧路确实开放、无追逐；原廊长8米，入口到廊口另1米。`); return;
    case 'APPROACH_CORRIDOR': walk(s, a, 'CORRIDOR_ENTRANCE', 1); ctx.note('本人实际到原廊口', '从入口普通走1米、1秒到CORRIDOR_ENTRANCE。本人没有进入受阻原廊，原灯仍在库房。'); return;
    case 'ISOLATE_TRACE': l.shutter.location = 'LOWERED'; l.trace.status = 'ISOLATED'; elapse(s, a, 2); ctx.note('用原遮板隔离同一痕迹', '2秒放下FB3-SHUTTER，原痕迹ISOLATED仍存在；普通侧路开放，不冒称能力消逝成功。'); return;
    case 'WALK_CORRIDOR': a.route = 'CORRIDOR'; walk(s, a, 'STORE', 8); ctx.note('沿实际净空原廊走到库房', '本人实际走8米、8秒，原痕迹已经消散；原FB3-LAMP尚在原处，须亲手拿取。'); return;
    case 'WALK_SIDE': a.route = 'SIDE'; walk(s, a, 'STORE', 12); ctx.note('沿普通侧路走到原库房', '本人实际走12米、12秒，不扣灵性。原廊的同一痕迹仍保持隔离或消散，没有被免费重置。'); return;
    case 'TAKE_LAMP': l.lamp.location = 'PLAYER'; a.lampTaken = true; elapse(s, a, 1); ctx.note('亲手取原伊迪丝的同一盏灯', '1秒拿起FB3-LAMP，仍归FB3-EDITH；没有复制原灯，本人仍在STORE。'); return;
    case 'RETURN_PLAYER': { const distance = l.playerLocation === 'BENCH' ? 2 : l.playerLocation === 'STORE' ? (a.route === 'SIDE' ? 12 : 8) + 1 : 1; walk(s, a, 'EXIT', distance); ctx.note('本人沿已走普通原路返回出口', `实际${distance}米、${distance}秒，0行动0灵性；${l.lamp.location === 'PLAYER' ? '同一原灯仍在本人手中，须亲手交回。' : '没有搬动留在原处的原灯。'}没有追逐或免费治疗。`); return; }
    case 'RETURN_LAMP': l.lamp.location = 'OWNER'; a.lampReturned = true; elapse(s, a, 2); setResult(s, c.caseId, success(a.abilityTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('亲手把原灯交还伊迪丝', '2秒交回同一FB3-LAMP，原灯归原主人；同一原痕迹的消散或隔离状态继续保留，不随报告恢复。'); return;
    case 'INSPECT': a.inspected = true; if (r.result === 'NONE' && (c.caseId === 'contained-residue' && a.sourceRead && a.ownerConsent === 'DECLINED' || c.caseId === 'corridor-exit' && a.ownerConsent === 'DECLINED')) setResult(s, c.caseId, 'ORDINARY'); elapse(s, a, 2); ctx.note('核实原人原物与真实出口', `本人${l.playerLocation}；原容器${l.container.location}、原凝片${l.residue.status}；托马斯${l.tomas.state}/精神${l.tomas.mind}；原灯${l.lamp.location}、原痕迹${l.trace.status}。成本和后果如实保留。`); return;
  }
}

export function fearBishopLifeActions(s: SliceState): FearBishopLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.fearBishop.life, out: FearBishopLifeAction[] = [];
  const add = (label: string, cost: string, command: FearBishopActivityCommand) => { const reason = blockFearBishopLife(s, command); out.push({ id: `FB3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'actor' in command ? `:${command.actor}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const caseId of FEAR_BISHOP_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add('观察原来源、原人和普通出口', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备本次有限能力' : '准备普通真实对照', '1行动 · 须至少余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('进入本次原库房实践', '1行动 · 随后子步0行动', { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告真实结果和实际退出', '1行动 · 扮演25 · 实成功新掌握8', { type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    if (caseId === 'contained-residue') {
      add('亲自阅读原凝片封存记录', '0行动 · 4秒 · 无生命无意识原件', { type: 'READ_SOURCE', caseId });
      add('当面取得原主本次毁弃许可', '0行动 · 2秒 · 不涵盖活人或原灵', { type: 'CONSENT_OWNER', caseId });
      add('亲手把原凝片放到隔离台', '0行动 · 2米4秒 · 同一原容器', { type: 'PLACE_RESIDUE', caseId });
      add('确认旁人撤开原隔离台', '0行动 · 2秒', { type: 'CLEAR_BYSTANDERS', caseId });
      if (r.method === 'ABILITY') add('有限消逝同一原凝片', '0行动 · 6灵性 · 知识18 · 2秒 · 本案仅一次', { type: 'DISSOLVE', caseId });
      add('普通封回尚在的同一原凝片', '0行动 · 3秒 · 不造新原件', { type: 'SEAL_RESIDUE', caseId });
      add('亲手把原玻璃容器还给伊迪丝', '0行动 · 2秒 · 须实际回出口', { type: 'RETURN_CONTAINER', caseId });
    } else if (caseId === 'stop-signal') {
      add('当面询问托马斯本次意愿', '0行动 · 2秒 · 原34岁成年人', { type: 'CONSENT', caseId });
      add('约定“到此为止”停止口令', '0行动 · 2秒 · 双方均能停止', { type: 'AGREE_STOP', caseId });
      if (r.method === 'ABILITY') add('施加本次有限短睡压力', '0行动 · 5灵性 · 意志18 · 2秒 · 成功实付2精神 · 仅一次', { type: 'SLEEP_FEAR', caseId });
      add('听托马斯自述预先提供的虚构故事', '0行动 · 4秒 · 普通对照，不读心', { type: 'ORDINARY_STORY', caseId });
      add('由本人立即说停止口令', '0行动 · 0秒 · 已耗精神不退', { type: 'STOP', caseId, actor: 'PLAYER' });
      add('由托马斯立即说停止口令', '0行动 · 0秒 · 尊重本次退出', { type: 'STOP', caseId, actor: 'TOMAS' });
      add('普通呼唤并实际醒来', '0行动 · 2秒 · 不返还2精神', { type: 'WAKE', caseId });
      add('当面确认托马斯清醒', '0行动 · 2秒', { type: 'CONFIRM_WAKE', caseId });
      add('托马斯实际沿两米普通路退出', '0行动 · 2米2秒 · 原人清醒', { type: 'LEAVE_VOLUNTEER', caseId });
    } else {
      add('当面取得原主本次取灯委托', '0行动 · 2秒', { type: 'CONSENT_OWNER', caseId });
      add('核实痕迹来源与开放普通侧路', '0行动 · 4秒 · 原廊8米，侧路12米', { type: 'CHECK_SIDE_ROUTE', caseId });
      add('本人实际走到原廊口', '0行动 · 1米1秒', { type: 'APPROACH_CORRIDOR', caseId });
      if (r.method === 'ABILITY') add('有限消逝同一原廊痕迹', '0行动 · 6灵性 · 知识18 · 2秒 · 本案仅一次', { type: 'DISSOLVE', caseId });
      add('用原遮板隔离尚在的痕迹', '0行动 · 2秒 · 原痕迹仍存在', { type: 'ISOLATE_TRACE', caseId });
      add('沿实际净空原廊走到库房', '0行动 · 8米8秒', { type: 'WALK_CORRIDOR', caseId });
      add('沿原普通侧路走到库房', '0行动 · 12米12秒', { type: 'WALK_SIDE', caseId });
      add('亲手取同一原灯', '0行动 · 1秒 · 原所有权不变', { type: 'TAKE_LAMP', caseId });
      add('亲手把原灯还给伊迪丝', '0行动 · 2秒 · 须携灯实际回出口', { type: 'RETURN_LAMP', caseId });
    }
    add('本人沿已走原路返回出口', '0行动 · 台边2米；廊口1米；库房原路8或12米加入口1米', { type: 'RETURN_PLAYER', caseId });
    add('检查原人原物和实际出口', '0行动 · 2秒', { type: 'INSPECT', caseId });
    add('结束本次现场', '0行动 · 先停止、醒来、返物、检查', { type: 'CLOSE', caseId });
    add('结束并退出本次实践', '0行动 · 成本和原后果保留', { type: 'WITHDRAW', caseId });
  }
  if (!l.reflected) add('反思来源、当前同意和普通退出', '1行动 · 三报告后扮演25', { type: 'REFLECT' });
  return out;
}
export function projectFearBishopLife(s: SliceState): FearBishopLifeProjection {
  const l = s.fearBishop.life;
  return { title: '恐惧主教的有限原库房实践', story: FEAR_BISHOP_LIFE_STORY, environment: '原创G：原库房入口EXIT；原隔离台距入口2米，原托马斯练习椅距出口2米；入口到廊口1米，原廊8米与普通侧路12米均通同一STORE。无追逐，普通出口始终开放。', activeCase: l.activeCase, inside: hasFearBishopLifeLock(s), insideCase: hasFearBishopLifeLock(s), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, currentAttempt: structuredClone(currentAttempt(s)), edith: { ...l.edith }, tomas: { ...l.tomas }, residue: { ...l.residue }, container: { ...l.container }, trace: { ...l.trace }, lamp: { ...l.lamp }, shutter: { ...l.shutter }, sideRouteChecked: l.sideRouteChecked,
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: r.observedWeek === null ? [] : [...x.facts], status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '尚未完成，真实成本和失败保留。' : r.result === 'ABILITY' ? '本次有限能力实际成功，原人原物后果保留。' : '本次通过普通真实方法收束，没有能力成功奖励。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: fearBishopLifeActions(s) };
}

export function validateFearBishopLife(s: SliceState): boolean {
  const l = s.fearBishop?.life, initial = createFearBishopLifeState(), promotion = s.fearBishop?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, FEAR_BISHOP_CASE_IDS)) return false;
  for (const key of ['edith', 'tomas', 'residue', 'container', 'trace', 'lamp', 'shutter'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || !['EXIT', 'BENCH', 'CORRIDOR_ENTRANCE', 'STORE'].includes(l.playerLocation) || !integer(l.playerTravelMetres) || !integer(l.clockSeconds) || l.activeCase !== null && !FEAR_BISHOP_CASE_IDS.includes(l.activeCase) || typeof l.reflected !== 'boolean' || typeof l.sideRouteChecked !== 'boolean') return false;
  if (l.edith.id !== 'FB3-EDITH' || l.edith.name !== '伊迪丝' || l.edith.age !== 46 || l.edith.alive !== true || l.edith.location !== 'EXIT' || typeof l.edith.willing !== 'boolean') return false;
  const t = l.tomas;
  if (t.id !== 'FB3-TOMAS' || t.name !== '托马斯' || t.age !== 34 || t.alive !== true || t.health !== 100 || typeof t.willing !== 'boolean' || !integer(t.mind, 0, 100) || !['AWAKE', 'DROWSY'].includes(t.state) || !['CHAIR', 'EXIT'].includes(t.location) || typeof t.effectActive !== 'boolean' || !integer(t.remainingSeconds, 0, 10) || !integer(t.travelMetres) || t.effectActive !== (t.remainingSeconds > 0) || t.effectActive && t.state !== 'DROWSY') return false;
  if (l.residue.id !== 'FB3-RESIDUE-1' || l.residue.owner !== 'FB3-EDITH' || l.residue.source !== FEAR_BISHOP_RESIDUE_SOURCE || l.residue.alive !== false || l.residue.conscious !== false || !['CONTAINED', 'ON_BENCH', 'DISSOLVED', 'SEALED'].includes(l.residue.status) || l.residue.location !== (l.residue.status === 'DISSOLVED' ? 'NONE' : l.residue.status === 'ON_BENCH' ? 'BENCH' : 'CONTAINER')) return false;
  if (l.container.id !== 'FB3-GLASS-1' || l.container.owner !== 'FB3-EDITH' || !['OWNER', 'PLAYER'].includes(l.container.location) || l.trace.id !== 'FB3-TRACE-1' || l.trace.source !== FEAR_BISHOP_TRACE_SOURCE || l.trace.alive !== false || l.trace.conscious !== false || !['PRESENT', 'DISSOLVED', 'ISOLATED'].includes(l.trace.status) || l.lamp.id !== 'FB3-LAMP' || l.lamp.owner !== 'FB3-EDITH' || !['STORE', 'PLAYER', 'OWNER'].includes(l.lamp.location) || l.shutter.id !== 'FB3-SHUTTER' || !['RAISED', 'LOWERED'].includes(l.shutter.location) || (l.shutter.location === 'LOWERED') !== (l.trace.status === 'ISOLATED')) return false;
  let open = 0, prepared = 0, resolved = 0, metres = 0, seconds = 0, mindSpent = 0, volunteerLeaves = 0, residueDissolved = false, traceDissolved = false, residueSealed = false, lampReturned = false, sideChecked = false;
  for (const [index, id] of FEAR_BISHOP_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[FEAR_BISHOP_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let lastWeek = r.observedWeek - 1, checks = 0;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, lastWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !['UNASKED', 'GRANTED', 'DECLINED', 'REVOKED', 'CLOSED'].includes(a.consent) || !['UNASKED', 'GRANTED', 'DECLINED', 'REVOKED', 'CLOSED'].includes(a.ownerConsent) || !integer(a.elapsedSeconds) || !integer(a.playerTravelMetres) || !integer(a.spiritualitySpent, 0, 6) || !integer(a.mindSpent, 0, 2)) return false;
      for (const key of ['closed', 'sourceRead', 'residuePlaced', 'bystandersClear', 'residueSealed', 'containerReturned', 'stopAgreed', 'wakeConfirmed', 'volunteerLeft', 'ordinaryStory', 'sideRouteChecked', 'lampTaken', 'lampReturned', 'inspected'] as const) if (typeof a[key] !== 'boolean') return false;
      if (a.consentWeek !== null && a.consentWeek !== a.week || a.ownerConsentWeek !== null && a.ownerConsentWeek !== a.week || a.consent === 'UNASKED' && a.consentWeek !== null || a.ownerConsent === 'UNASKED' && a.ownerConsentWeek !== null || !['UNASKED', 'CLOSED'].includes(a.consent) && a.consentWeek === null || !['UNASKED', 'CLOSED'].includes(a.ownerConsent) && a.ownerConsentWeek === null || a.abilityTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.abilityTier) || a.stoppedBy !== null && !['PLAYER', 'TOMAS'].includes(a.stoppedBy) || a.route !== null && !['CORRIDOR', 'SIDE'].includes(a.route)) return false;
      if (a.abilityTier !== null) { checks++; if (a.method !== 'ABILITY' || a.spiritualitySpent !== (id === 'stop-signal' ? 5 : 6)) return false; }
      else if (a.spiritualitySpent !== 0) return false;
      if (a.abilityTier !== null && (id === 'stop-signal' ? a.consentWeek === null || !a.stopAgreed : a.ownerConsentWeek === null || (id === 'contained-residue' ? !a.sourceRead || !a.residuePlaced || !a.bystandersClear : !a.sideRouteChecked))) return false;
      if (a.mindSpent !== (id === 'stop-signal' && success(a.abilityTier) ? 2 : 0) || a.stoppedBy !== null && !a.stopAgreed || a.stopAgreed && a.consentWeek === null || a.wakeConfirmed && id !== 'stop-signal' || a.volunteerLeft && !a.wakeConfirmed || a.ordinaryStory && (id !== 'stop-signal' || !a.stopAgreed || success(a.abilityTier))) return false;
      if (a.residuePlaced && (id !== 'contained-residue' || !a.sourceRead || a.ownerConsentWeek === null) || a.bystandersClear && !a.residuePlaced || a.residueSealed && (!a.residuePlaced || success(a.abilityTier)) || a.containerReturned && !a.residuePlaced || a.sideRouteChecked && (id !== 'corridor-exit' || a.ownerConsentWeek === null) || a.route !== null && !a.sideRouteChecked || a.lampTaken && a.route === null || a.lampReturned && !a.lampTaken) return false;
      if (id !== 'stop-signal' && (a.consentWeek !== null || a.stopAgreed || a.stoppedBy !== null || a.volunteerLeft || a.ordinaryStory) || id !== 'contained-residue' && (a.sourceRead || a.residuePlaced || a.bystandersClear || a.residueSealed || a.containerReturned) || id !== 'corridor-exit' && (a.sideRouteChecked || a.route !== null || a.lampTaken || a.lampReturned)) return false;
      if (a.result === 'ABILITY' && (!success(a.abilityTier) || (id === 'contained-residue' ? !a.residuePlaced : id === 'stop-signal' ? a.mindSpent !== 2 : !a.lampReturned))) return false;
      if (a.result === 'ORDINARY' && (id === 'contained-residue' ? !a.residueSealed && !(a.sourceRead && a.ownerConsentWeek !== null && !a.residuePlaced) : id === 'stop-signal' ? !a.ordinaryStory && !a.volunteerLeft : !a.lampReturned && !(a.ownerConsentWeek !== null && a.route === null))) return false;
      if (a.closed && (!a.inspected || a.consent !== 'CLOSED' || a.ownerConsent !== 'CLOSED' || a.residuePlaced && !a.containerReturned || id === 'stop-signal' && (!a.wakeConfirmed || !a.volunteerLeft) || a.lampTaken && !a.lampReturned) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      if (a.elapsedSeconds < a.playerTravelMetres || a.residuePlaced && a.playerTravelMetres < 2 || a.containerReturned && a.playerTravelMetres < 4 || a.route !== null && a.playerTravelMetres < (a.route === 'SIDE' ? 13 : 9) || a.lampReturned && a.playerTravelMetres < (a.route === 'SIDE' ? 26 : 18)) return false;
      lastWeek = a.week; metres += a.playerTravelMetres; seconds += a.elapsedSeconds; mindSpent += a.mindSpent; if (a.volunteerLeft) volunteerLeaves++;
      if (id === 'contained-residue' && success(a.abilityTier)) residueDissolved = true;
      if (id === 'corridor-exit' && success(a.abilityTier)) traceDissolved = true;
      residueSealed ||= a.residueSealed; lampReturned ||= a.lampReturned; sideChecked ||= a.sideRouteChecked;
    }
    if (checks > 1) return false;
    const a = r.attempts.at(-1);
    if (r.closes !== r.attempts.filter(x => x.closed).length || r.result !== (a?.result ?? 'NONE')) return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen || a?.week === s.week) return false; }
    if (r.status === 'ACTIVE') { open++; if (!r.contactOpen || l.activeCase !== id || !a || a.closed || a.week !== s.week || a.method !== r.method || s.status !== 'ACTIVE' || s.combat || s.activeEvent || s.world.city !== 'BACKLUND') return false; }
    else if (r.contactOpen) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.returned || !a?.closed || r.result === 'NONE' || r.method !== a.method)) return false;
    if (r.status === 'RESOLVED') resolved++;
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.playerTravelMetres !== metres || l.clockSeconds < seconds || t.mind !== 100 - mindSpent || t.travelMetres !== volunteerLeaves * 2 || (t.location === 'EXIT') !== (volunteerLeaves > 0) || l.sideRouteChecked !== sideChecked || l.reflected && resolved !== 3) return false;
  if ((l.residue.status === 'DISSOLVED') !== residueDissolved || residueSealed && !['SEALED', 'ON_BENCH'].includes(l.residue.status) || (l.trace.status === 'DISSOLVED') !== traceDissolved || (l.lamp.location === 'OWNER') !== lampReturned) return false;
  if (!open && (l.playerLocation !== 'EXIT' || l.container.location !== 'OWNER' || l.residue.status === 'ON_BENCH' || l.lamp.location === 'PLAYER' || t.effectActive || t.state !== 'AWAKE')) return false;
  if (open) {
    const a = currentAttempt(s)!;
    if (l.container.location === 'PLAYER' && (l.activeCase !== 'contained-residue' || !a.residuePlaced || a.containerReturned) || a.residuePlaced && !a.containerReturned && l.container.location !== 'PLAYER' || l.lamp.location === 'PLAYER' && (l.activeCase !== 'corridor-exit' || !a.lampTaken || a.lampReturned) || a.lampTaken && !a.lampReturned && l.lamp.location !== 'PLAYER' || t.state === 'DROWSY' && (l.activeCase !== 'stop-signal' || !success(a.abilityTier) || a.wakeConfirmed || a.volunteerLeft) || t.effectActive && a.stoppedBy !== null) return false;
  }
  if (s.progression.pathwayId === 'darkness' && s.progression.sequence === 2 && hasFearBishopLifeLock(s)) return false;
  return !hasFearBishopHistory(s) || (s.progression.sequence === 2 ? s.concealmentServant.fearBishopActingAtPromotion : s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
