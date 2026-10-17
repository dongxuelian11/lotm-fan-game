import type { PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasSilverKnightOldPractice } from './index.js';
import { hasSilverKnightRitualLock } from './ritual.js';

export const SILVER_KNIGHT_CASE_IDS = ['armor-load', 'light-check', 'partition-thrust'] as const;
export type SilverKnightCaseId = typeof SILVER_KNIGHT_CASE_IDS[number];
export type SilverKnightLocation = 'START' | 'LOAD' | 'LIGHT' | 'STRIKE' | 'TARGET';
export type SilverKnightConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'CLOSED';
type CommonCommand = 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'CONSENT_OWNER' | 'TAKE_ITEM' | 'GO_SITE' | 'CONSENT_OBSERVER' | 'STOP_EFFECT' | 'WAIT_EFFECT' | 'STOP_CONTACT' | 'RETURN_PLAYER' | 'RETURN_ITEM' | 'INSPECT';
type ArmorCommand = 'WEAR_PAD' | 'FORM_ARMOR' | 'APPLY_LOAD' | 'REMOVE_PAD';
type LightCommand = 'PLACE_LAMP' | 'LIGHT_LAMP' | 'ASK_SCRUTINY' | 'CONCEAL' | 'CHECK_VISIBILITY' | 'EXTINGUISH' | 'RECOVER_LAMP';
type ThrustCommand = 'SIGHT_TARGET' | 'RAISE_WARD' | 'LOWER_WARD' | 'SILVER_THRUST' | 'OPEN_SIDE_DOOR' | 'WALK_TARGET' | 'MARK_TARGET' | 'VERIFY_TARGET' | 'RETURN_FROM_TARGET' | 'CLOSE_SIDE_DOOR';
export type SilverKnightActivityCommand =
  | { type: CommonCommand; caseId: SilverKnightCaseId }
  | { type: ArmorCommand; caseId: 'armor-load' }
  | { type: LightCommand; caseId: 'light-check' }
  | { type: ThrustCommand; caseId: 'partition-thrust' }
  | { type: 'PREPARE'; caseId: SilverKnightCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
type SceneType = Exclude<SilverKnightActivityCommand['type'], 'OBSERVE' | 'PREPARE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'REFLECT'>;
export interface SilverKnightMovement { from: SilverKnightLocation; to: SilverKnightLocation; mode: 'WALK'; metres: number; seconds: number; itemId: 'SK3-PAD' | 'SK3-LAMP' | 'SK3-STYLUS' | null }
export interface SilverKnightLifeStep { type: SceneType; tier: PublicResolutionTier | null; eldaWilling: boolean; nolanWilling: boolean }
export interface SilverKnightAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; elapsedSeconds: number; playerTravelMetres: number; playerMoves: SilverKnightMovement[]; steps: SilverKnightLifeStep[];
  spiritualitySpent: number; abilityTier: PublicResolutionTier | null; ownerConsent: SilverKnightConsent; ownerConsentWeek: number | null; observerConsent: SilverKnightConsent; observerConsentWeek: number | null;
  itemTaken: boolean; siteVisited: boolean; stopped: boolean; effectStopped: boolean; inspected: boolean; playerReturned: boolean; itemReturned: boolean;
  padWorn: boolean; armorFormed: boolean; loadApplied: boolean; loadReceivedBy: 'SILVER_ARMOR' | 'PAD' | null; armorIntegrityAfterLoad: number | null; padRemoved: boolean;
  lampPlaced: boolean; lampLit: boolean; lampOilSpent: number; scrutinyRequested: boolean; concealmentFormed: boolean; visibilityChecked: boolean; observedVisibility: 'UNSEEN' | 'SEEN' | null; extinguished: boolean; lampRecovered: boolean;
  targetSighted: boolean; wardRaised: boolean; thrustOutcome: 'NONE' | 'HIT' | 'MISSED' | 'WARD_BLOCKED'; targetVisited: boolean; targetMarked: boolean; targetVerified: boolean; verifiedSilverMarks: number | null; verifiedOrdinaryMarks: number | null; returnedFromTarget: boolean;
}
export interface SilverKnightCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: SilverKnightAttempt[];
}
export interface SilverKnightLifeState {
  siteId: 'SK3-TRAINING-HALL'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: SilverKnightCaseId | null; playerLocation: SilverKnightLocation; playerTravelMetres: number; clockSeconds: number;
  elda: { id: 'SK3-ELDA'; name: '埃尔达·格雷'; age: 46; alive: true; willing: boolean; location: 'START' };
  nolan: { id: 'SK3-NOLAN'; name: '诺兰·派克'; age: 39; alive: true; willing: boolean; location: 'GALLERY'; scrutinizing: boolean };
  pad: { id: 'SK3-PAD'; owner: 'SK3-ELDA'; quantity: 1; location: 'OWNER' | 'PLAYER'; worn: boolean; integrity: number; travelMetres: number };
  rig: { id: 'SK3-LOAD-RIG'; owner: 'SK3-ELDA'; quantity: 1; location: 'LOAD'; remainingLoads: number; appliedLoads: number; loadKg: 12; safetyStop: 'ENGAGED' };
  armor: { id: 'SK3-LIFE-ARMOR'; owner: 'PLAYER'; formed: boolean; active: boolean; integrity: number; remainingSeconds: number };
  lamp: { id: 'SK3-LAMP'; owner: 'SK3-ELDA'; quantity: 1; location: 'OWNER' | 'PLAYER' | 'STAND'; oil: number; lit: boolean; remainingSeconds: number; travelMetres: number };
  stand: { id: 'SK3-LAMP-STAND'; owner: 'SK3-ELDA'; quantity: 1; location: 'LIGHT' };
  screen: { id: 'SK3-SCREEN'; owner: 'SK3-ELDA'; quantity: 1; location: 'LIGHT'; state: 'FIXED'; observerSightline: 'OPEN_SIDE' };
  concealment: { active: boolean; remainingSeconds: number; location: 'LIGHT' | null; lastEnd: 'NONE' | 'STOPPED' | 'LIGHT_OUT' | 'EXPIRED' };
  stylus: { id: 'SK3-STYLUS'; owner: 'SK3-ELDA'; quantity: 1; location: 'OWNER' | 'PLAYER'; travelMetres: number };
  partition: { id: 'SK3-PARTITION'; owner: 'SK3-ELDA'; quantity: 1; location: 'STRIKE'; state: 'LOCKED'; thicknessCm: 2; window: 'CLEAR' };
  sideDoor: { id: 'SK3-SIDE-DOOR'; state: 'OPEN' | 'CLOSED' };
  ward: { id: 'SK3-COUNTER-WARD'; owner: 'SK3-ELDA'; location: 'STRIKE'; grade: 'HIGHER_G'; charges: number; active: boolean; remainingSeconds: number };
  target: { id: 'SK3-PRACTICE-TARGET'; owner: 'SK3-ELDA'; quantity: 1; location: 'TARGET'; living: false; material: 'WOOD'; silverMarks: number; ordinaryMarks: number };
  catcher: { id: 'SK3-BLADE-CATCHER'; owner: 'SK3-ELDA'; quantity: 1; location: 'TARGET'; missedMarks: number };
  blade: { id: 'SK3-LIFE-SILVER-BLADE'; attempts: number; targetId: 'SK3-PRACTICE-TARGET' | null; outcome: 'NONE' | 'HIT' | 'MISSED' | 'WARD_BLOCKED'; active: false };
  door: { id: 'SK3-HALL-DOOR'; state: 'OPEN' }; cases: Record<SilverKnightCaseId, SilverKnightCaseState>; reflected: boolean;
}
export interface SilverKnightLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilverKnightActivityCommand }
export interface SilverKnightLifeProjection extends Omit<SilverKnightLifeState, 'cases'> {
  title: string; story: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: SilverKnightAttempt | null;
  cases: { id: SilverKnightCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: SilverKnightAttempt[] }[];
  actions: SilverKnightLifeAction[];
}
export const SILVER_KNIGHT_LIFE_STORY = '银骑士序列3的实质银甲、借光隐藏及绕过多数屏障的银白细剑方向有原著核验。以下原人、原物、场地、30秒银甲、8秒隐藏、负载与全部数值均为原创G；不授愚者特定祝福的水银化或好运。每案观察、准备、实施、报告各1行动，末次反思1行动，共13行动；报告各扮演25、反思25。每案能力最多一次6灵性/知识18，只有实际成功并提交报告才对应掌握+8。普通方案、失败和尊重拒绝仍可报告。原晨曦剑继承，不复制装备或传送本人。';
const CASES = [
  { id: 'armor-load', title: 'G · 同一银甲承受有限原负载', story: '原教员埃尔达46岁独立许可后借SK3-PAD，本人实走4米到LOAD，诺兰39岁另行同意记录。原安全垫实际穿好，一次6灵性/知识18可凝实质银甲30秒；同一SK3-LOAD-RIG仅一份12千克等效校准弹簧负载，银甲完整度100→65，失败则原垫100→90。原安全限位承接剩余负载，不代表免疫一切伤害。停术、脱垫，4米携同一垫返还。' },
  { id: 'light-check', title: 'G · 原灯光位与实际辨认', story: '重新问原主和诺兰同意，携同一SK3-LAMP普通6米到LIGHT，放原灯座后实耗唯一油1，照明30秒。本人只在原光位一次6灵性/知识18尝试隐藏8秒；原遮屏不堵住观察员侧面视线，认真辨认仍可察觉。原灯熄灭、效果到期或主动停止即在同一位置显露。原灯须现场熄灭、拾回、携行6米返还。' },
  { id: 'partition-thrust', title: 'G · 绕普通隔板的定向银白细剑', story: '独立许可后携唯一原记录笔实走6米到STRIKE，从原窗口确认后方4米唯一无人木靶。一次6灵性/知识18银白细剑可绕锁闭2厘米原隔板，失败落同一原承接板；原高位封护可确实拦截，不必中或穿透全部屏障。本人仍在STRIKE。开普通侧门、实走4米到原靶核痕；普通可用原笔留记。再4米回、关原门、6米回START归笔。' },
] as const;
const COMMON: readonly string[] = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'CONSENT_OWNER', 'TAKE_ITEM', 'GO_SITE', 'CONSENT_OBSERVER', 'STOP_EFFECT', 'WAIT_EFFECT', 'STOP_CONTACT', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT'];
const SPECIFIC: Record<SilverKnightCaseId, readonly string[]> = { 'armor-load': ['WEAR_PAD', 'FORM_ARMOR', 'APPLY_LOAD', 'REMOVE_PAD'], 'light-check': ['PLACE_LAMP', 'LIGHT_LAMP', 'ASK_SCRUTINY', 'CONCEAL', 'CHECK_VISIBILITY', 'EXTINGUISH', 'RECOVER_LAMP'], 'partition-thrust': ['SIGHT_TARGET', 'RAISE_WARD', 'LOWER_WARD', 'SILVER_THRUST', 'OPEN_SIDE_DOOR', 'WALK_TARGET', 'MARK_TARGET', 'VERIFY_TARGET', 'RETURN_FROM_TARGET', 'CLOSE_SIDE_DOOR'] };
const ABILITY_STEPS: readonly string[] = ['FORM_ARMOR', 'CONCEAL', 'SILVER_THRUST'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 3;
const sourceFor = (id: SilverKnightCaseId) => `silver-knight-life-${id}`;
const abilityFor = (id: SilverKnightCaseId) => id === 'armor-load' ? 'warrior.s3.silver-armor' : id === 'light-check' ? 'warrior.s3.light-concealment' : 'warrior.s3.silver-thrust';
const freshCase = (): SilverKnightCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, method: 'ABILITY' | 'ORDINARY'): SilverKnightAttempt {
  return { week: s.week, method, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], steps: [], spiritualitySpent: 0, abilityTier: null,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, observerConsent: 'UNASKED', observerConsentWeek: null, itemTaken: false, siteVisited: false, stopped: false, effectStopped: false, inspected: false, playerReturned: false, itemReturned: false,
    padWorn: false, armorFormed: false, loadApplied: false, loadReceivedBy: null, armorIntegrityAfterLoad: null, padRemoved: false, lampPlaced: false, lampLit: false, lampOilSpent: 0, scrutinyRequested: false, concealmentFormed: false, visibilityChecked: false, observedVisibility: null, extinguished: false, lampRecovered: false,
    targetSighted: false, wardRaised: false, thrustOutcome: 'NONE', targetVisited: false, targetMarked: false, targetVerified: false, verifiedSilverMarks: null, verifiedOrdinaryMarks: null, returnedFromTarget: false };
}
export function createSilverKnightLifeState(): SilverKnightLifeState {
  return { siteId: 'SK3-TRAINING-HALL', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0,
    elda: { id: 'SK3-ELDA', name: '埃尔达·格雷', age: 46, alive: true, willing: true, location: 'START' }, nolan: { id: 'SK3-NOLAN', name: '诺兰·派克', age: 39, alive: true, willing: true, location: 'GALLERY', scrutinizing: false },
    pad: { id: 'SK3-PAD', owner: 'SK3-ELDA', quantity: 1, location: 'OWNER', worn: false, integrity: 100, travelMetres: 0 }, rig: { id: 'SK3-LOAD-RIG', owner: 'SK3-ELDA', quantity: 1, location: 'LOAD', remainingLoads: 1, appliedLoads: 0, loadKg: 12, safetyStop: 'ENGAGED' },
    armor: { id: 'SK3-LIFE-ARMOR', owner: 'PLAYER', formed: false, active: false, integrity: 0, remainingSeconds: 0 }, lamp: { id: 'SK3-LAMP', owner: 'SK3-ELDA', quantity: 1, location: 'OWNER', oil: 1, lit: false, remainingSeconds: 0, travelMetres: 0 },
    stand: { id: 'SK3-LAMP-STAND', owner: 'SK3-ELDA', quantity: 1, location: 'LIGHT' }, screen: { id: 'SK3-SCREEN', owner: 'SK3-ELDA', quantity: 1, location: 'LIGHT', state: 'FIXED', observerSightline: 'OPEN_SIDE' }, concealment: { active: false, remainingSeconds: 0, location: null, lastEnd: 'NONE' },
    stylus: { id: 'SK3-STYLUS', owner: 'SK3-ELDA', quantity: 1, location: 'OWNER', travelMetres: 0 }, partition: { id: 'SK3-PARTITION', owner: 'SK3-ELDA', quantity: 1, location: 'STRIKE', state: 'LOCKED', thicknessCm: 2, window: 'CLEAR' }, sideDoor: { id: 'SK3-SIDE-DOOR', state: 'CLOSED' },
    ward: { id: 'SK3-COUNTER-WARD', owner: 'SK3-ELDA', location: 'STRIKE', grade: 'HIGHER_G', charges: 1, active: false, remainingSeconds: 0 }, target: { id: 'SK3-PRACTICE-TARGET', owner: 'SK3-ELDA', quantity: 1, location: 'TARGET', living: false, material: 'WOOD', silverMarks: 0, ordinaryMarks: 0 },
    catcher: { id: 'SK3-BLADE-CATCHER', owner: 'SK3-ELDA', quantity: 1, location: 'TARGET', missedMarks: 0 }, blade: { id: 'SK3-LIFE-SILVER-BLADE', attempts: 0, targetId: null, outcome: 'NONE', active: false }, door: { id: 'SK3-HALL-DOOR', state: 'OPEN' },
    cases: { 'armor-load': freshCase(), 'light-check': freshCase(), 'partition-thrust': freshCase() }, reflected: false };
}
export function validateSilverKnightActivityCommand(v: unknown): v is SilverKnightActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!SILVER_KNIGHT_CASE_IDS.includes(v.caseId as SilverKnightCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && (COMMON.includes(String(v.type)) || SPECIFIC[v.caseId as SilverKnightCaseId].includes(String(v.type)));
}
export const isSilverKnightActivityCommand = validateSilverKnightActivityCommand;
export const isSilverKnightActivity = validateSilverKnightActivityCommand;
const currentAttempt = (s: SliceState) => s.silverKnight.life.activeCase ? s.silverKnight.life.cases[s.silverKnight.life.activeCase].attempts.at(-1) ?? null : null;
const itemFor = (l: SilverKnightLifeState, id: SilverKnightCaseId) => id === 'armor-load' ? l.pad : id === 'light-check' ? l.lamp : l.stylus;
const siteFor = (id: SilverKnightCaseId): SilverKnightLocation => id === 'armor-load' ? 'LOAD' : id === 'light-check' ? 'LIGHT' : 'STRIKE';
const distanceFromStart = (to: SilverKnightLocation) => to === 'LOAD' ? 4 : to === 'TARGET' ? 10 : to === 'START' ? 0 : 6;
function cleanupBlock(s: SliceState): string | null {
  const l = s.silverKnight.life;
  if (l.armor.active || l.concealment.active) return '先停止本人的有限银甲或借光作用，实际完整度和痕迹不恢复。';
  if (l.pad.worn) return '在LOAD实际脱下同一原安全垫，不能远距归还穿着的原垫。';
  if (l.lamp.lit) return '本人须在LIGHT实际熄灭同一原灯，已耗原油不补。';
  if (l.ward.active || l.sideDoor.state !== 'CLOSED') return '须在STRIKE实际降下原封护、关好普通侧门。';
  if (l.playerLocation !== 'START') return '原身体必须沿实际普通路线回START，关闭不能传送本人。';
  if ([l.pad, l.lamp, l.stylus].some(item => item.location !== 'OWNER')) return '本人须将同一原借物在START交回埃尔达，不能远距收物。';
  return null;
}
export const hasSilverKnightLifeLock = (s: SliceState): boolean => s.silverKnight.life.activeCase !== null || Object.values(s.silverKnight.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
export const silverKnightInside = hasSilverKnightLifeLock;
const ownerConsents = (s: SliceState, a: SilverKnightAttempt) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === s.week && s.silverKnight.life.elda.willing && !a.stopped;
const observerConsents = (s: SliceState, a: SilverKnightAttempt) => a.observerConsent === 'GRANTED' && a.observerConsentWeek === s.week && s.silverKnight.life.nolan.willing && !a.stopped;
const remaining = (l: SilverKnightLifeState) => Math.max(l.armor.remainingSeconds, l.concealment.remainingSeconds, l.lamp.lit ? l.lamp.remainingSeconds : 0, l.ward.remainingSeconds);
function sceneReason(s: SliceState, id: SilverKnightCaseId, type: SceneType): string | null {
  const l = s.silverKnight.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id), atSite = l.playerLocation === siteFor(id);
  if (s.health <= 0 || s.status === 'DEAD') return '原身体已经死亡，退出不能移动、复活或取回原物。';
  if (a.inspected) return '已实际检查收口，只可关闭本次现场。';
  if (type === 'STOP_CONTACT') return a.stopped ? '本次已经停止，仍须实际收口。' : null;
  if (type === 'STOP_EFFECT') return a.effectStopped ? '本次已明确停术，仍须实际归还。' : null;
  if (type === 'WAIT_EFFECT') return remaining(l) > 0 ? null : '没有仍在计时的原灯或有限作用。';
  if (type === 'REMOVE_PAD') return l.playerLocation === 'LOAD' && l.pad.worn && !l.armor.active ? null : '须本人在LOAD，先解甲，再脱同一原安全垫。';
  if (type === 'EXTINGUISH') return l.playerLocation === 'LIGHT' && l.lamp.location === 'STAND' && a.lampLit && !a.extinguished ? null : '须本人到原灯座，实际熄灭本次点过的同一原灯。';
  if (type === 'RECOVER_LAMP') return l.playerLocation === 'LIGHT' && l.lamp.location === 'STAND' && !l.lamp.lit && !l.concealment.active ? null : '须本人在LIGHT且原灯已熄，才能从原座拾回同一灯。';
  if (type === 'LOWER_WARD') return l.playerLocation === 'STRIKE' && l.ward.active ? null : '须本人在STRIKE操作原开关；封护已停则无需重复。';
  if (type === 'RETURN_FROM_TARGET') return l.playerLocation === 'TARGET' && l.sideDoor.state === 'OPEN' ? null : '须本人确在TARGET且普通侧门仍开，才能沿原4米返STRIKE。';
  if (type === 'CLOSE_SIDE_DOOR') return l.playerLocation === 'STRIKE' && l.sideDoor.state === 'OPEN' ? null : '须本人已回STRIKE才能实际关同一侧门。';
  if (type === 'RETURN_PLAYER') {
    if (l.playerLocation === 'START' || l.playerLocation === 'TARGET' || l.door.state !== 'OPEN') return '先从TARGET沿普通侧门4米返STRIKE；本人已在START则不再移动。';
    if (item.location !== 'PLAYER') return '先在原位置拾回本案同一原借物，不能远距收物。';
    if (l.armor.active || l.concealment.active || l.pad.worn || l.lamp.lit || l.ward.active || l.sideDoor.state !== 'CLOSED') return '先实际停术、脱垫、熄灯、降封护并关侧门，再普通返回。';
    return null;
  }
  if (type === 'RETURN_ITEM') return l.playerLocation === 'START' && item.location === 'PLAYER' ? null : '须本人和同一原借物均在START才能当面交还。';
  if (type === 'INSPECT') return cleanupBlock(s) ?? (a.result !== 'NONE' || a.stopped || a.ownerConsent === 'DECLINED' || a.observerConsent === 'DECLINED' ? null : '先完成本案或明确停止，再核真实收口。');
  if (type === 'CONSENT_OWNER') return l.playerLocation === 'START' && a.ownerConsent === 'UNASKED' && !a.stopped ? null : '本案须由埃尔达当面独立许可，旧许可不延用。';
  if (!ownerConsents(s, a)) return '缺少本案原主当前许可或已停止；停止与普通归还仍开放。';
  if (type === 'TAKE_ITEM') return l.playerLocation === 'START' && item.location === 'OWNER' && !a.itemTaken ? null : '须原主仍持唯一原借物；不得重复领取或复制。';
  if (type === 'GO_SITE') return l.playerLocation === 'START' && item.location === 'PLAYER' && !a.siteVisited && l.door.state === 'OPEN' ? null : '先拿同一原借物，再从START沿实际普通路线到本案现场。';
  if (type === 'CONSENT_OBSERVER') return atSite && a.observerConsent === 'UNASKED' ? null : '须本人已到本案现场，与原开放观察廊的诺兰当面确认本次记录。';
  if (!observerConsents(s, a)) return '诺兰须本案独立同意记录，随机检验不能代替同意。';
  if (type === 'MARK_TARGET') return l.playerLocation === 'TARGET' && l.stylus.location === 'PLAYER' && !a.targetMarked && l.target.silverMarks === 0 && !a.targetVerified ? null : '须本人实走到唯一原木靶旁、持同一原笔，才能普通留记一次。';
  if (type === 'VERIFY_TARGET') return l.playerLocation === 'TARGET' && !a.targetVerified && (l.target.silverMarks === 1 || l.target.ordinaryMarks === 1) ? null : '须本人已沿普通门路到TARGET，核原银痕或实际普通笔记。';
  if (!atSite) return '须本人实际在本案标定位，不能隔空操作或传送自己。';
  if (type === 'WEAR_PAD') return l.pad.location === 'PLAYER' && !a.padWorn && !a.padRemoved ? null : '须本人持原安全垫且本案尚未穿用。';
  if (type === 'APPLY_LOAD') return l.pad.worn && l.rig.remainingLoads === 1 && !a.loadApplied ? null : '先实际穿原安全垫；原测力装置只有一份校准负载，用过不补。';
  if (type === 'PLACE_LAMP') return l.lamp.location === 'PLAYER' && !a.lampPlaced ? null : '须实际携同一原灯到LIGHT，才能放原灯座。';
  if (type === 'LIGHT_LAMP') return l.lamp.location === 'STAND' && l.lamp.oil === 1 && !a.lampLit ? null : '须原灯在原座且唯一油1尚未耗尽；灭后不凭空补油重燃。';
  if (type === 'ASK_SCRUTINY') return !a.scrutinyRequested && !a.visibilityChecked && a.abilityTier === null ? null : '可在本次隐藏前请诺兰认真辨认一次，不移动本人或强迫他参与。';
  if (type === 'CHECK_VISIBILITY') return a.lampLit && !a.visibilityChecked ? null : '先实际点过本案原灯，再记录唯一这次观察；灯已灭也只能看到原位置本人。';
  if (type === 'SIGHT_TARGET') return !a.targetSighted && l.partition.window === 'CLEAR' ? null : '只从同一原观察窗确认唯一无人木靶位置一次。';
  if (type === 'RAISE_WARD') return a.targetSighted && !a.wardRaised && a.abilityTier === null && l.ward.charges === 1 && l.sideDoor.state === 'CLOSED' ? null : '先确认原靶，只可用唯一原封护储量在关闭侧门时开启一次。';
  if (type === 'OPEN_SIDE_DOOR') return a.targetSighted && l.sideDoor.state === 'CLOSED' && !l.ward.active && !a.targetVisited ? null : '先确认原靶并降下封护，才能本人开原普通侧门。';
  if (type === 'WALK_TARGET') return l.sideDoor.state === 'OPEN' && !l.ward.active && !a.targetVisited && l.stylus.location === 'PLAYER' ? null : '须原侧门实际开启、封护已停，本人携原笔普通走4米到TARGET。';
  if (ABILITY_STEPS.includes(type)) {
    if (a.method !== 'ABILITY' || a.abilityTier !== null || a.effectStopped) return '本案最多一次有限能力尝试；普通方案、停术或已尝试后不重骰。';
    if (s.spirituality < 6 || s.mind <= 0) return '需要6灵性且本人清醒；失败成本不退，普通归还不耗灵性。';
    if (type === 'FORM_ARMOR') return l.pad.worn && !a.loadApplied ? null : '须先实际穿原安全垫，并在唯一原负载使用前凝甲。';
    if (type === 'CONCEAL') return l.lamp.location === 'STAND' && l.lamp.lit && !a.visibilityChecked ? null : '须本人在LIGHT真实原光区、原灯仍亮，不能在黑暗中借光或穿墙。';
    if (type === 'SILVER_THRUST') return a.targetSighted && !a.targetVisited && l.sideDoor.state === 'CLOSED' && l.blade.attempts === 0 ? null : '先从原窗确认唯一木靶且侧门关闭；仅尝试一柄有限银白细剑，本人留STRIKE。';
  }
  return '当前原人、原物或顺序不满足，仍可停止并实际归还。';
}
export function blockSilverKnightLife(s: SliceState, c: SilverKnightActivityCommand): string | null {
  if (!validateSilverKnightActivityCommand(c)) return '银骑士生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着并真实晋升战士途径银骑士序列3。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.silverKnight.encounter.status)) return '先结束当前事件或实战，不覆盖原身体。';
  const l = s.silverKnight.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (r?.contactOpen && 'caseId' in c && l.activeCase === c.caseId) {
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return r.attempts.at(-1)!.inspected ? cleanupBlock(s) : '先实际停术、归还、原路返回并检查现场。';
    return ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT'].includes(c.type) ? '当前原现场尚未关闭。' : sceneReason(s, c.caseId, c.type as SceneType);
  }
  if (hasSilverKnightLifeLock(s) && !(c.type === 'PERFORM' && r?.status === 'PREPARED')) return '先实施或取消本次准备，或实际收口当前现场。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原训练堂。';
  if (hasSilverKnightOldPractice(s) || hasSilverKnightRitualLock(s) || s.silverKnight.ritual.playerLocation !== 'DOOR' || s.silverKnight.preparedWeek !== null) return '先实际收束旧训练、猎魔检验、祝福会面与服药准备，不能跨场地移动原人原物。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '本项需清醒和1行动；开放现场普通收口仍可0行动、0灵性。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成反思，不重复发奖。' : SILVER_KNIGHT_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先提交三份本次真实报告。';
  if (!r || !('caseId' in c)) return '没有对应原案例。';
  const index = SILVER_KNIGHT_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[SILVER_KNIGHT_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告上一案真实结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已观察，不重置原物。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原场地。' : s.actionsRemaining < 2 ? '准备须余2行动，预留1行动实施。' : null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本案。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先实际收口并关闭现场，报告不能移动原身体。';
  return '没有对应开放现场。';
}
export const blockSilverKnightActivity = blockSilverKnightLife;
/** Shared clock only. Combat calls once per persisted original round, including pre-promotion hunts. */
export function advanceSilverKnightLifeClock(s: SliceState, seconds: number): void {
  if (!integer(seconds) || !Number.isSafeInteger(s.silverKnight.life.clockSeconds + seconds)) throw new Error('银骑士场地秒数无效。');
  s.silverKnight.life.clockSeconds += seconds;
}
function endConcealment(l: SilverKnightLifeState, reason: 'STOPPED' | 'LIGHT_OUT' | 'EXPIRED') {
  if (l.concealment.active) l.concealment.lastEnd = reason;
  l.concealment.active = false; l.concealment.remainingSeconds = 0;
}
function elapse(s: SliceState, a: SilverKnightAttempt, seconds: number) {
  const l = s.silverKnight.life; a.elapsedSeconds += seconds; advanceSilverKnightLifeClock(s, seconds);
  l.armor.remainingSeconds = Math.max(0, l.armor.remainingSeconds - seconds); if (!l.armor.remainingSeconds) l.armor.active = false;
  if (l.lamp.lit) { l.lamp.remainingSeconds = Math.max(0, l.lamp.remainingSeconds - seconds); if (!l.lamp.remainingSeconds) l.lamp.lit = false; }
  if (l.concealment.active) {
    const oldRemaining = l.concealment.remainingSeconds; l.concealment.remainingSeconds = Math.max(0, oldRemaining - seconds);
    if (!l.concealment.remainingSeconds) endConcealment(l, 'EXPIRED'); else if (!l.lamp.lit) endConcealment(l, 'LIGHT_OUT');
  }
  l.ward.remainingSeconds = Math.max(0, l.ward.remainingSeconds - seconds); if (!l.ward.remainingSeconds) l.ward.active = false;
}
function stopEffect(l: SilverKnightLifeState, a: SilverKnightAttempt) { l.armor.active = false; l.armor.remainingSeconds = 0; endConcealment(l, 'STOPPED'); a.effectStopped = true; }
function walk(s: SliceState, id: SilverKnightCaseId, to: SilverKnightLocation) {
  const l = s.silverKnight.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id), from = l.playerLocation;
  const metres = from === 'STRIKE' && to === 'TARGET' || from === 'TARGET' && to === 'STRIKE' ? 4 : distanceFromStart(from === 'START' ? to : from);
  a.playerMoves.push({ from, to, mode: 'WALK', metres, seconds: metres, itemId: item.location === 'PLAYER' ? item.id : null });
  elapse(s, a, metres); l.playerLocation = to; l.playerTravelMetres += metres; a.playerTravelMetres += metres; if (item.location === 'PLAYER') item.travelMetres += metres;
}
function setResult(s: SliceState, id: SilverKnightCaseId, result: 'ABILITY' | 'ORDINARY') { const r = s.silverKnight.life.cases[id]; r.result = result; r.attempts.at(-1)!.result = result; }
/** Deliberately finite original-object reducer; saved scene traces are replayed through the same rules. */
function applyScene(s: SliceState, id: SilverKnightCaseId, step: SilverKnightLifeStep): void {
  const l = s.silverKnight.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id); a.steps.push({ ...step });
  if (ABILITY_STEPS.includes(step.type)) { s.spirituality -= 6; a.spiritualitySpent += 6; a.abilityTier = step.tier; }
  switch (step.type) {
    case 'CONSENT_OWNER': a.ownerConsent = l.elda.willing ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = s.week; elapse(s, a, 2); break;
    case 'TAKE_ITEM': item.location = 'PLAYER'; a.itemTaken = true; elapse(s, a, 1); break;
    case 'GO_SITE': walk(s, id, siteFor(id)); a.siteVisited = true; break;
    case 'CONSENT_OBSERVER': a.observerConsent = l.nolan.willing ? 'GRANTED' : 'DECLINED'; a.observerConsentWeek = s.week; elapse(s, a, 2); break;
    case 'WEAR_PAD': l.pad.worn = true; a.padWorn = true; elapse(s, a, 2); break;
    case 'FORM_ARMOR': elapse(s, a, 1); if (success(step.tier)) { l.armor.formed = true; l.armor.active = true; l.armor.integrity = 100; l.armor.remainingSeconds = 30; a.armorFormed = true; } break;
    case 'APPLY_LOAD': {
      const silver = l.armor.active && l.armor.integrity >= 35; l.rig.remainingLoads--; l.rig.appliedLoads++; a.loadApplied = true;
      a.loadReceivedBy = silver ? 'SILVER_ARMOR' : 'PAD'; if (silver) l.armor.integrity -= 35; else l.pad.integrity -= 10;
      a.armorIntegrityAfterLoad = l.armor.integrity; elapse(s, a, 2); setResult(s, id, silver ? 'ABILITY' : 'ORDINARY'); break;
    }
    case 'REMOVE_PAD': l.pad.worn = false; a.padRemoved = true; elapse(s, a, 2); break;
    case 'PLACE_LAMP': l.lamp.location = 'STAND'; a.lampPlaced = true; elapse(s, a, 1); break;
    case 'LIGHT_LAMP': l.lamp.oil--; a.lampOilSpent++; a.lampLit = true; elapse(s, a, 1); l.lamp.lit = true; l.lamp.remainingSeconds = 30; break;
    case 'ASK_SCRUTINY': l.nolan.scrutinizing = true; a.scrutinyRequested = true; elapse(s, a, 2); break;
    case 'CONCEAL': elapse(s, a, 1); if (success(step.tier) && l.lamp.lit) { l.concealment.active = true; l.concealment.remainingSeconds = Math.min(8, l.lamp.remainingSeconds); l.concealment.location = 'LIGHT'; l.concealment.lastEnd = 'NONE'; a.concealmentFormed = true; } break;
    case 'CHECK_VISIBILITY': {
      const unseen = l.concealment.active && l.concealment.remainingSeconds >= 2 && l.lamp.lit && l.lamp.remainingSeconds >= 2 && !l.nolan.scrutinizing;
      a.observedVisibility = unseen ? 'UNSEEN' : 'SEEN'; a.visibilityChecked = true; elapse(s, a, 2); setResult(s, id, unseen ? 'ABILITY' : 'ORDINARY'); break;
    }
    case 'EXTINGUISH': l.lamp.lit = false; endConcealment(l, 'LIGHT_OUT'); a.extinguished = true; elapse(s, a, 1); break;
    case 'RECOVER_LAMP': l.lamp.location = 'PLAYER'; a.lampRecovered = true; elapse(s, a, 1); break;
    case 'SIGHT_TARGET': a.targetSighted = true; elapse(s, a, 2); break;
    case 'RAISE_WARD': l.ward.charges--; a.wardRaised = true; elapse(s, a, 1); l.ward.active = true; l.ward.remainingSeconds = 20; break;
    case 'LOWER_WARD': l.ward.active = false; l.ward.remainingSeconds = 0; elapse(s, a, 1); break;
    case 'SILVER_THRUST': {
      const outcome = l.ward.active ? 'WARD_BLOCKED' : success(step.tier) ? 'HIT' : 'MISSED'; a.thrustOutcome = outcome; l.blade.attempts++; l.blade.targetId = l.target.id; l.blade.outcome = outcome;
      if (outcome === 'HIT') l.target.silverMarks++; if (outcome === 'MISSED') l.catcher.missedMarks++; elapse(s, a, 1); break;
    }
    case 'OPEN_SIDE_DOOR': l.sideDoor.state = 'OPEN'; elapse(s, a, 1); break;
    case 'WALK_TARGET': walk(s, id, 'TARGET'); a.targetVisited = true; break;
    case 'MARK_TARGET': l.target.ordinaryMarks++; a.targetMarked = true; elapse(s, a, 2); break;
    case 'VERIFY_TARGET': a.targetVerified = true; a.verifiedSilverMarks = l.target.silverMarks; a.verifiedOrdinaryMarks = l.target.ordinaryMarks; elapse(s, a, 2); setResult(s, id, a.thrustOutcome === 'HIT' && l.target.silverMarks === 1 ? 'ABILITY' : 'ORDINARY'); break;
    case 'RETURN_FROM_TARGET': walk(s, id, 'STRIKE'); a.returnedFromTarget = true; break;
    case 'CLOSE_SIDE_DOOR': l.sideDoor.state = 'CLOSED'; elapse(s, a, 1); break;
    case 'WAIT_EFFECT': elapse(s, a, remaining(l)); break;
    case 'STOP_EFFECT': stopEffect(l, a); elapse(s, a, 1); break;
    case 'STOP_CONTACT': a.stopped = true; stopEffect(l, a); elapse(s, a, 1); break;
    case 'RETURN_PLAYER': walk(s, id, 'START'); a.playerReturned = true; break;
    case 'RETURN_ITEM': item.location = 'OWNER'; a.itemReturned = true; elapse(s, a, 1); break;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); if (a.result === 'NONE') setResult(s, id, 'ORDINARY'); break;
  }
}
export function executeSilverKnightLife(s: SliceState, c: SilverKnightActivityCommand, ctx: SeerContext): void {
  const reason = blockSilverKnightLife(s, c); if (reason) throw new Error(reason);
  const l = s.silverKnight.life;
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('silver-knight-reflection'); ctx.note('G · 银甲、光位与定向细剑的反思', '三份真实报告后扮演+25。原负载和油不补、原靶与未命中痕迹保留；不授必中、水银化、好运或身体传送。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(d => d.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(definition.title, definition.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '一次有限能力方案' : '实际普通方案'}；准备不代替原主与观察员本案许可。`); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消本次尚未实施准备', '0行动，已付不退；原人原物并未移动。'); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, r.method!)); l.activeCase = c.caseId; ctx.note(definition.title, '实施1行动已付，本人仍在START，先当面问原主本案许可。内场0行动仍实耗秒数、普通路程和原资源。'); return; }
  if (c.type === 'REPORT') {
    s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId));
    if (r.result === 'ABILITY') { const ability = abilityFor(c.caseId); s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
    ctx.note(definition.title, `真实报告扮演+25；${r.result === 'ABILITY' ? '能力实际奏效且完成收口，对应掌握+8。' : '普通完成、能力失败、被察觉、遭封护或尊重拒绝，不加能力掌握。'}原物、成本、当时观察与命中记录保留。`); return;
  }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = a.observerConsent = 'CLOSED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('关闭实际收口的银骑士现场', '原身体已普通回START、原借物已归原主；能力停止、原灯已熄、侧门已关。成本和原痕迹均不撤销。'); return; }
  const tier = ABILITY_STEPS.includes(c.type) ? ctx.check('knowledge', 18).tier : null;
  applyScene(s, c.caseId, { type: c.type as SceneType, tier, eldaWilling: l.elda.willing, nolanWilling: l.nolan.willing });
  const descriptions: Partial<Record<SceneType, string>> = {
    CONSENT_OWNER: `埃尔达本案独立回答${a.ownerConsent}，前案许可不延用。`, CONSENT_OBSERVER: `诺兰本案独立回答${a.observerConsent}，不靠检定强迫同意。`,
    FORM_ARMOR: `一次6灵性/知识18为${tier}；${a.armorFormed ? '本人的实质银甲形成，完整度100、最长30秒' : '未形成银甲，仍需实际普通护垫试验'}。`, APPLY_LOAD: `同一原装置唯一负载1→0，实际承接为${a.loadReceivedBy}；银甲完整度${l.armor.integrity}，原垫完整度${l.pad.integrity}，安全限位保持。`,
    LIGHT_LAMP: '唯一原油1→0，同一原灯照明30秒，熄灭不会补回油。', CONCEAL: `一次6灵性/知识18为${tier}，${a.concealmentFormed ? '本人在LIGHT原光位有限隐藏最多8秒' : '本人在原光位仍可见'}；没有穿墙、无碰撞或移动。`, CHECK_VISIBILITY: `诺兰实际记录${a.observedVisibility}；${l.nolan.scrutinizing ? '认真辨认可察觉借光者' : '保持原普通观察'}，记录不代表所有同伴永远看不见。`, EXTINGUISH: '本人在原灯座熄灭原灯，借光作用立刻结束，本人仍在LIGHT原位置。',
    SILVER_THRUST: `一次6灵性/知识18为${tier}，同一有限细剑对唯一原木靶结果${a.thrustOutcome}；原靶银痕${l.target.silverMarks}，原承接板未中痕${l.catcher.missedMarks}。本人仍在STRIKE，无活人目标或必中。`,
    VERIFY_TARGET: `本人沿普通侧门到TARGET后核实同一原靶：银痕${a.verifiedSilverMarks}、普通笔记${a.verifiedOrdinaryMarks}；不隔墙捏造命中。`,
    RAISE_WARD: '原高位G封护唯一储量1→0，最多20秒实际拦截细剑，不能声称穿透全部屏障。', STOP_EFFECT: '停止本人的有限作用，完整度、原油、原靶痕迹均不恢复；本人和借物仍在原实际位置。', WAIT_EFFECT: '真实等到现有原灯/有限作用到期，本人未移动，原资源不补。',
  };
  ctx.note(`G · ${c.type}`, `${descriptions[c.type as SceneType] ?? '依同一原人原物的位置完成本步普通操作。'} 本人${l.playerLocation}，本案${a.elapsedSeconds}秒、普通${a.playerTravelMetres}米、实耗${a.spiritualitySpent}灵性。`);
}
export const applySilverKnightActivity = executeSilverKnightLife;

const LABELS: Record<SceneType, [string, string]> = {
  CONSENT_OWNER: ['当面问埃尔达本案许可', '2秒'], TAKE_ITEM: ['领取本案同一原借物', '1秒'], GO_SITE: ['携同一原物普通走到本案标定位', '银甲4米4秒；其余6米6秒'], CONSENT_OBSERVER: ['请诺兰自愿记录本次演练', '2秒'],
  WEAR_PAD: ['在LOAD实际穿原安全垫', '2秒'], FORM_ARMOR: ['凝实质银甲G：最长30秒', '6灵性 · 知识18 · 1秒'], APPLY_LOAD: ['施同一原装置唯一有限负载', '原负载1 · 2秒'], REMOVE_PAD: ['在LOAD实际脱原安全垫', '2秒'],
  PLACE_LAMP: ['将同一原灯放LIGHT原灯座', '1秒'], LIGHT_LAMP: ['点原灯，耗唯一油1', '油1 · 照明30秒'], ASK_SCRUTINY: ['请诺兰认真辨认本次借光者', '2秒 · 仍可被察觉'], CONCEAL: ['在原光位借光隐藏G：最多8秒', '6灵性 · 知识18 · 1秒'], CHECK_VISIBILITY: ['由原观察员实际记录能否看见', '2秒'], EXTINGUISH: ['在原位置实际熄同一灯', '1秒 · 同位显露'], RECOVER_LAMP: ['从原灯座拾回同一原灯', '1秒'],
  SIGHT_TARGET: ['从原窗核唯一无人木靶位置', '2秒'], RAISE_WARD: ['启用唯一原高位G封护作反制', '储量1 · 最长20秒'], LOWER_WARD: ['本人在STRIKE关原封护', '1秒'], SILVER_THRUST: ['定向银白细剑G：绕原普通隔板', '6灵性 · 知识18 · 1秒 · 不必中'], OPEN_SIDE_DOOR: ['本人实际开原普通侧门', '1秒'], WALK_TARGET: ['携原笔沿普通门路走到原木靶', '4米4秒'], MARK_TARGET: ['用同一原笔普通记录木靶', '2秒'], VERIFY_TARGET: ['在TARGET核同一原靶真实痕迹', '2秒'], RETURN_FROM_TARGET: ['本人携原笔从TARGET走回STRIKE', '4米4秒'], CLOSE_SIDE_DOOR: ['在STRIKE实际关原普通侧门', '1秒'],
  STOP_EFFECT: ['停止本人的有限银甲或借光作用', '1秒'], WAIT_EFFECT: ['实际等待原灯或有限作用到期', '全部实际剩余秒数'], STOP_CONTACT: ['停止本次演练，按原位置收口', '1秒 · 仍须实际归还'], RETURN_PLAYER: ['携同一原物沿普通路线回START', '银甲4米4秒；其余6米6秒'], RETURN_ITEM: ['在START当面归还同一原借物', '1秒'], INSPECT: ['核本人已返、原物已还与现场已收口', '2秒'],
};
/** Only the next concrete object manipulation and useful safe alternatives are public controls. */
function nextSceneSteps(s: SliceState, id: SilverKnightCaseId): SceneType[] {
  const l = s.silverKnight.life, a = l.cases[id].attempts.at(-1)!, item = itemFor(l, id);
  const cleanup = (): SceneType[] => {
    if (l.armor.active || l.concealment.active) return ['STOP_EFFECT', 'WAIT_EFFECT'];
    if (l.pad.worn) return ['REMOVE_PAD'];
    if (l.lamp.location === 'STAND') return l.lamp.lit ? ['EXTINGUISH'] : ['RECOVER_LAMP'];
    if (l.playerLocation === 'TARGET') return ['RETURN_FROM_TARGET'];
    if (l.ward.active) return ['LOWER_WARD', 'WAIT_EFFECT'];
    if (l.sideDoor.state === 'OPEN') return ['CLOSE_SIDE_DOOR'];
    if (l.playerLocation !== 'START') return ['RETURN_PLAYER'];
    if (item.location === 'PLAYER') return ['RETURN_ITEM'];
    return ['INSPECT'];
  };
  if (a.inspected) return [];
  if (a.stopped || a.ownerConsent === 'DECLINED' || a.observerConsent === 'DECLINED' || a.ownerConsent === 'GRANTED' && !l.elda.willing || a.observerConsent === 'GRANTED' && !l.nolan.willing) return a.stopped ? cleanup() : ['STOP_CONTACT'];
  if (a.ownerConsent === 'UNASKED') return ['CONSENT_OWNER'];
  if (!a.itemTaken) return ['TAKE_ITEM'];
  if (!a.siteVisited) return ['GO_SITE'];
  if (a.observerConsent === 'UNASKED') return ['CONSENT_OBSERVER'];
  if (id === 'armor-load') {
    if (!a.padWorn) return ['WEAR_PAD'];
    if (!a.loadApplied) return a.method === 'ABILITY' && a.abilityTier === null && !a.effectStopped ? ['FORM_ARMOR', 'APPLY_LOAD'] : ['APPLY_LOAD'];
  } else if (id === 'light-check') {
    if (!a.lampPlaced) return ['PLACE_LAMP'];
    if (!a.lampLit) return ['LIGHT_LAMP'];
    if (!a.visibilityChecked) {
      if (a.method === 'ABILITY' && a.abilityTier === null && !a.effectStopped && l.lamp.lit) return a.scrutinyRequested ? ['CONCEAL', 'CHECK_VISIBILITY'] : ['CONCEAL', 'ASK_SCRUTINY', 'CHECK_VISIBILITY'];
      return ['CHECK_VISIBILITY'];
    }
    if (l.lamp.lit) return ['EXTINGUISH', 'STOP_EFFECT', 'WAIT_EFFECT'].filter(type => type !== 'STOP_EFFECT' || !a.effectStopped) as SceneType[];
  } else {
    if (!a.targetSighted) return ['SIGHT_TARGET'];
    if (!a.targetVisited) {
      if (l.sideDoor.state === 'OPEN') return ['WALK_TARGET'];
      if (a.method === 'ABILITY' && a.abilityTier === null && !a.effectStopped) return a.wardRaised ? ['SILVER_THRUST', 'LOWER_WARD'] : ['SILVER_THRUST', 'RAISE_WARD', 'OPEN_SIDE_DOOR'];
      if (l.ward.active) return ['LOWER_WARD', 'WAIT_EFFECT'];
      return ['OPEN_SIDE_DOOR'];
    }
    if (!a.targetVerified && l.playerLocation === 'TARGET') return l.target.silverMarks || l.target.ordinaryMarks ? ['VERIFY_TARGET'] : ['MARK_TARGET'];
  }
  return cleanup();
}
export function silverKnightLifeActions(s: SliceState): SilverKnightLifeAction[] {
  if (!promoted(s)) return [];
  const out: SilverKnightLifeAction[] = [], l = s.silverKnight.life;
  const add = (label: string, cost: string, command: SilverKnightActivityCommand) => { const reason = blockSilverKnightLife(s, command); out.push({ id: `silver-knight-life-${'caseId' in command ? `${command.caseId}-` : ''}${command.type}${command.type === 'PREPARE' ? `-${command.method}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  const id = l.activeCase ?? SILVER_KNIGHT_CASE_IDS.find(caseId => l.cases[caseId].status !== 'RESOLVED');
  if (id) {
    const r = l.cases[id], a = r.attempts.at(-1), definition = CASES.find(d => d.id === id)!;
    if (r.status === 'AVAILABLE') add(`观察：${definition.title}`, '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') { add('准备一次有限能力方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' }); add('准备原物普通核验方案', '1行动 · 须余2行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
    if (r.status === 'PREPARED') { add('实施本次原现场', '1行动', { type: 'PERFORM', caseId: id }); add('取消尚未实施的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'EXAMINED') add('提交本案真实报告', '1行动 · 扮演25', { type: 'REPORT', caseId: id });
    if (r.contactOpen && a) {
      if (a.inspected) add('关闭实际收口的现场', '0行动', { type: 'CLOSE', caseId: id });
      else { const next = nextSceneSteps(s, id); for (const type of next) add(LABELS[type][0], `0行动 · ${LABELS[type][1]}`, { type, caseId: id } as SilverKnightActivityCommand); if (!a.stopped && !next.includes('STOP_CONTACT')) add(LABELS.STOP_CONTACT[0], '0行动 · 1秒 · 仍须实际归还', { type: 'STOP_CONTACT', caseId: id }); }
    }
  } else if (!l.reflected) add('反思三份有限银骑士报告', '1行动 · 扮演25', { type: 'REFLECT' });
  return out;
}
function observations(a: SilverKnightAttempt | undefined): string[] {
  if (!a) return [];
  const out = [`本案${a.elapsedSeconds}秒、本人普通${a.playerTravelMetres}米、实耗${a.spiritualitySpent}灵性。`, `原主本案许可${a.ownerConsent}，诺兰本案许可${a.observerConsent}；能力检验不替代同意。`];
  if (a.abilityTier) out.push(`唯一能力检验${a.abilityTier}，失败不退灵性、不重骰。`);
  if (a.loadApplied) out.push(`唯一原负载已实际使用，承接${a.loadReceivedBy}；当时银甲完整度${a.armorIntegrityAfterLoad}，原装置不补负载。`);
  if (a.lampLit) out.push(`同一原灯已耗唯一油${a.lampOilSpent}；本人在原光位的当时观察${a.observedVisibility ?? '尚未核实'}，${a.scrutinyRequested ? '诺兰认真辨认' : '诺兰普通观察'}。`);
  if (a.targetSighted) out.push(`已从原窗口确认唯一无人木靶；有限细剑${a.thrustOutcome}。${a.targetVerified ? `本人经普通侧门4米到场核原银痕${a.verifiedSilverMarks}、普通笔记${a.verifiedOrdinaryMarks}。` : '尚未走普通门路到靶边核实。'}`);
  if (a.stopped) out.push('已停止本次演练；原位置、原物与实际成本不撤销。');
  return out;
}
export function projectSilverKnightLife(s: SliceState): SilverKnightLifeProjection {
  const l = s.silverKnight.life, actions = silverKnightLifeActions(s), next = actions.find(a => a.enabled) ?? actions[0];
  return { ...structuredClone(l), title: '银骑士·序列3（有限原场景G）', story: SILVER_KNIGHT_LIFE_STORY,
    environment: '原创G原训练堂：START→LOAD4米；START→LIGHT6米；START→STRIKE6米；STRIKE经原普通侧门→TARGET4米。普通步行1米/秒，最远TARGET距起点10米。埃尔达46岁始终在START；诺兰39岁在近处开放GALLERY，与各原标定位可当面确认，原光位距他2米、侧面视线开放。原屏在LIGHT、灯座固定；原隔板LOCKED，唯一木靶无活人；侧门提供真实普通往返。',
    nextStep: next ? `下一步：${next.label}${next.enabled ? '' : `；${next.reason}`}` : l.reflected ? '三案报告与反思完成，全部原物和真实结果继续保留。' : '须先真实晋升银骑士序列3。',
    facts: [`本人${l.playerLocation}，累计普通${l.playerTravelMetres}米，原时钟${l.clockSeconds}秒（含实际亲猎/实战）。`, `SK3-ELDA/埃尔达46岁在START，当前${l.elda.willing ? '愿意' : '拒绝'}；SK3-NOLAN/诺兰39岁在GALLERY，当前${l.nolan.willing ? '愿意' : '拒绝'}。每案仍须独立当面许可。`, `SK3-PAD归SK3-ELDA，现${l.pad.location}，完整度${l.pad.integrity}；SK3-LOAD-RIG剩负载${l.rig.remainingLoads}。银甲${l.armor.active ? '有效' : '已停/未形成'}，完整度${l.armor.integrity}，余${l.armor.remainingSeconds}秒。`, `SK3-LAMP归SK3-ELDA，现${l.lamp.location}，油${l.lamp.oil}，${l.lamp.lit ? '亮' : '灭'}，余寿命${l.lamp.remainingSeconds}秒；原借光${l.concealment.active ? '有效' : '停止'}，余${l.concealment.remainingSeconds}秒，本人未传送。`, `SK3-PARTITION仍LOCKED；原侧门${l.sideDoor.state}；原高位封护${l.ward.active ? '有效' : '停止'}，储量${l.ward.charges}。SK3-PRACTICE-TARGET仍TARGET且无生命，银痕${l.target.silverMarks}/普通笔记${l.target.ordinaryMarks}，原承接板未中痕${l.catcher.missedMarks}。`],
    inside: hasSilverKnightLifeLock(s), insideCase: hasSilverKnightLifeLock(s), currentAttempt: structuredClone(currentAttempt(s)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: observations(r.attempts.at(-1)), status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '本案尚未完成，原位置与成本保留。' : r.result === 'ABILITY' ? '有限能力实际成功；完成收口并报告才加掌握。' : '普通完成、能力失败、被察觉、反制或尊重拒绝，不加能力掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions };
}
/** Replay finite scene traces; never infer that a successful roll moved originals or guaranteed a hit. */
export function validateSilverKnightLife(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const l = s.silverKnight?.life, initial = createSilverKnightLifeState(), promotion = s.silverKnight?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, SILVER_KNIGHT_CASE_IDS)) return false;
  let combatSeconds = 0;
  for (const round of s.combatHistory) { const seconds = round.silverKnightOutcome?.elapsedSeconds ?? 0; if (!integer(seconds)) return false; combatSeconds += seconds; }
  if (!integer(combatSeconds) || !integer(l.clockSeconds) || !integer(l.playerTravelMetres) || typeof l.reflected !== 'boolean' || l.siteId !== initial.siteId || !['START', 'LOAD', 'LIGHT', 'STRIKE', 'TARGET'].includes(l.playerLocation) || l.activeCase !== null && !SILVER_KNIGHT_CASE_IDS.includes(l.activeCase)) return false;
  for (const key of ['elda', 'nolan', 'pad', 'rig', 'armor', 'lamp', 'stand', 'screen', 'concealment', 'stylus', 'partition', 'sideDoor', 'ward', 'target', 'catcher', 'blade', 'door'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(initial[key]))) return false;
  if (typeof l.elda.willing !== 'boolean' || stableStringify(l.elda) !== stableStringify({ ...initial.elda, willing: l.elda.willing })) return false;
  if (typeof l.nolan.willing !== 'boolean' || typeof l.nolan.scrutinizing !== 'boolean' || stableStringify(l.nolan) !== stableStringify({ ...initial.nolan, willing: l.nolan.willing, scrutinizing: l.nolan.scrutinizing })) return false;
  for (const key of ['stand', 'screen', 'partition', 'door'] as const) if (stableStringify(l[key]) !== stableStringify(initial[key])) return false;
  if (s.seer.completedSources.filter(source => source === 'silver-knight-reflection').length !== (l.reflected ? 1 : 0)) return false;
  for (const id of SILVER_KNIGHT_CASE_IDS) if (s.seer.completedSources.filter(source => source === sourceFor(id)).length !== (l.cases[id].status === 'RESOLVED' ? 1 : 0)) return false;
  const pristine = { ...initial, clockSeconds: combatSeconds, elda: { ...initial.elda, willing: l.elda.willing }, nolan: { ...initial.nolan, willing: l.nolan.willing } };
  if (promotion === null) return stableStringify(l) === stableStringify(pristine);
  if (!integer(promotion, 1, s.week)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && stableStringify(l) === stableStringify(pristine);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['armor-load'].observedWeek !== l.introducedWeek) return false;
  const replay = createSilverKnightLifeState(); replay.clockSeconds = combatSeconds; replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, activeEvent: null, combat: null, silverKnight: { ...s.silverKnight, life: replay } };
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of SILVER_KNIGHT_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[SILVER_KNIGHT_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null)) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(s, 'ORDINARY'))) || !integer(a.week, r.observedWeek, s.week) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !Array.isArray(a.steps) || !Array.isArray(a.playerMoves)) return false;
    shadow.week = a.week; shadow.mind = a.initialMind; shadow.spirituality = a.initialSpirituality;
    const expected = freshAttempt(shadow, a.method); replay.activeCase = id; replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [expected], status: 'ACTIVE', contactOpen: true, closes: 0, returned: false };
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'tier', 'eldaWilling', 'nolanWilling']) || typeof step.eldaWilling !== 'boolean' || typeof step.nolanWilling !== 'boolean' || !ABILITY_STEPS.includes(step.type) && step.tier !== null || ABILITY_STEPS.includes(step.type) && !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(step.tier))) return false;
      if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'REFLECT'].includes(step.type) || !validateSilverKnightActivityCommand({ type: step.type, caseId: id })) return false;
      replay.elda.willing = step.eldaWilling; replay.nolan.willing = step.nolanWilling; if (sceneReason(shadow, id, step.type)) return false; applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.inspected || cleanupBlock(shadow)) return false; expected.closed = true; expected.ownerConsent = expected.observerConsent = 'CLOSED'; replay.activeCase = null; }
    if (stableStringify(a) !== stableStringify(expected) || r.result !== expected.result || r.closes !== (a.closed ? 1 : 0) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed || a.result === 'NONE') return false;
    if (r.status === 'RESOLVED') resolved++; replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.reflected && resolved !== 3) return false;
  if (prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected; replay.elda.willing = l.elda.willing; replay.nolan.willing = l.nolan.willing;
  if (stableStringify(replay) !== stableStringify(l) || !open && cleanupBlock(s) !== null) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
}
