import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SummoningMasterPartner } from '../summoning-master/life.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { BeautyGoddessAction } from './types.js';
import { projectBeautyGoddessLifeReceipt, type BeautyGoddessPublicLifeReceipt } from './public-life.js';

/** Bounded original design, not a claim about a canonical formula or ritual.
 * The sole mutable guest remains summoningMaster.life.partner. sourcePartner is
 * an immutable audit anchor, never an alternate body or spendable resource. */
export const BEAUTY_GODDESS_CASE_IDS = ['steady-hands', 'lit-crossing', 'withdrawn-moonlight'] as const;
export type BeautyGoddessCaseId = typeof BEAUTY_GODDESS_CASE_IDS[number];
export type BeautyGoddessConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
type Method = 'ABILITY' | 'ORDINARY';
type WindowEnd = 'NONE' | 'PENDING' | 'FAILED' | 'APPLIED' | 'OPERATION_FAILED' | 'WITHDRAWN' | 'OBSCURED' | 'EXPIRED' | 'CANCELLED';
export type BeautyGoddessActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: BeautyGoddessCaseId }
  | { type: 'INVITE'; caseId: BeautyGoddessCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; permission: 'GUEST' | 'CARETAKER' | 'SELF_POWER' }
  | { type: 'BUY_PIECE'; pieceId: 'BG1-MOON-PIECE-1' | 'BG1-MOON-PIECE-2' | 'BG1-MOON-PIECE-3' }
  | { type: 'VISIT_HOME' | 'BORROW_WEIGHT' | 'BORROW_LAMP' | 'BUY_OIL' | 'LIGHT_LAMP' | 'EXTINGUISH_LAMP' | 'SELF_POISE' | 'ARM_CROSSING' | 'BOUNDED_MOONFORM' | 'PRECISION_PLACE' | 'GUEST_CARRY' | 'ORDINARY_PLACE' | 'LOWER_SHUTTER' | 'RAISE_SHUTTER' | 'WAIT_WINDOW' | 'RETURN_WEIGHT' | 'RETURN_GUEST' | 'RETURN_PIECES' | 'RETURN_LAMP' | 'RETURN_HOME' | 'ABORT' | 'REST_GUEST' | 'REFLECT' };
export interface BeautyGoddessMoonPiece {
  id: 'BG1-MOON-PIECE-1' | 'BG1-MOON-PIECE-2' | 'BG1-MOON-PIECE-3'; owner: 'SHOP' | 'PLAYER'; price: 70;
  status: 'SUPPLIER' | 'READY' | 'SPENT'; holder: 'SHOP' | 'PLAYER' | 'RETURN_TRAY';
  purchasedWeek: number | null; spentWeek: number | null; caseId: BeautyGoddessCaseId | null;
}
export interface BeautyGoddessLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  invitedWeek: number | null; invitationWeeks: number[]; method: Method | null;
  permission: { guest: BeautyGoddessConsent; caretaker: BeautyGoddessConsent; selfPower: BeautyGoddessConsent }; permissionRevision: number;
  contactOpen: boolean; visited: boolean; weightBorrowed: boolean; crossingArmed: boolean; crossingAttempted: boolean;
  precisionAttempted: boolean; operationOutcome: PublicResolutionTier | null; poiseAttempted: boolean; poiseOutcome: PublicResolutionTier | null;
  moonformAttempted: boolean; moonformOutcome: PublicResolutionTier | null; poiseEnd: WindowEnd; moonformEnd: WindowEnd;
  abilityApplied: boolean; poiseApplied: boolean; moonformApplied: boolean; obscurationObserved: boolean; withdrawalObserved: boolean;
  result: 'NONE' | Method; returned: boolean;
}
export interface BeautyGoddessLifePractice {
  homeId: 'SM3-GLASS-ROOM'; activeCase: BeautyGoddessCaseId | null; playerLocation: 'HOME' | 'YARD';
  ownerOffsetMetres: 0 | 2; guestOffsetMetres: 0 | 2; elapsedSeconds: number; playerTravelMetres: number;
  caretaker: { id: 'BG1-DARIA42'; name: '达莉娅'; age: 42; alive: true; willing: true; location: 'HOME' };
  weight: { id: 'BG1-GLASS-WEIGHT'; owner: 'BG1-DARIA42'; holder: 'BG1-DARIA42' | 'PLAYER' | 'SM3-LUMEN' | 'TABLE' | 'PAD'; location: 'OWNER' | 'START' | 'TABLE' | 'PAD'; massGrams: 200 };
  lamp: { id: 'BG1-LAMP'; owner: 'BG1-DARIA42'; holder: 'BG1-DARIA42' | 'PLAYER'; lit: boolean; fuelSeconds: number; oilPurchasedWeek: number | null; oilPrice: 30; oilSeconds: 180; fuelBurnedSeconds: number };
  shutter: { id: 'BG1-SHUTTER'; position: 'RAISED' | 'LOWERED' };
  pieces: BeautyGoddessMoonPiece[];
  pendingPoise: { caseId: BeautyGoddessCaseId; createdAt: number; expiresAt: number; bonus: 10 } | null;
  pendingMoonform: { caseId: BeautyGoddessCaseId; createdAt: number; expiresAt: number; permissionRevision: number; pieceId: BeautyGoddessMoonPiece['id']; bonus: 10 } | null;
  restWeek: number | null;
}
export interface BeautyGoddessLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface BeautyGoddessLifeReceipt {
  week: number; date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null;
  checkBase: number | null; check: PublicCheckResult | null; command: BeautyGoddessActivityCommand; outcome: PublicResolutionTier | null;
  before: BeautyGoddessLifeBudget; after: BeautyGoddessLifeBudget; elapsedSeconds: number; playerWalkedMetres: number; guestWalkedMetres: number;
  guestStaminaSpent: number; lampFuelBurned: number; guestBefore: SummoningMasterPartner; guestAfter: SummoningMasterPartner;
}
export interface BeautyGoddessLifeState {
  sourceWeek: number | null; sourcePartner: SummoningMasterPartner | null; practice: BeautyGoddessLifePractice;
  cases: Record<BeautyGoddessCaseId, BeautyGoddessLifeCase>; reflected: boolean; journal: BeautyGoddessLifeReceipt[];
}
export interface BeautyGoddessLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  practice: BeautyGoddessLifePractice; partner: SummoningMasterPartner;
  currentConsents: { id: 'SM3-LUMEN' | 'BG1-DARIA42' | 'PLAYER'; consented: boolean }[];
  cases: { id: BeautyGoddessCaseId; title: string; story: string; observations: string[]; status: string;
    permission: BeautyGoddessLifeCase['permission']; contactOpen: boolean; preparation: string | null; result: string | null; returned: boolean;
    attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; operationOutcome: PublicResolutionTier | null; receipts: BeautyGoddessPublicLifeReceipt[] }[] }[];
  ledger: BeautyGoddessPublicLifeReceipt[];
}
export interface BeautyGoddessOriginalEvent { revision: number; week: number; source: string; before: SummoningMasterPartner; after: SummoningMasterPartner }
const POISE = 'moon.s1.self-poise', MOONFORM = 'moon.s1.bounded-moonform';
const CASES = [
  { id: 'steady-hands', title: '稳定双手，亲手落物', story: '到流灯原居玻璃屋的门廊，与42岁的看护人达莉娅当面说明本案。借用她唯一的玻璃镇纸，沿两米普通通道放到原桌。', facts: ['辉映调息只作用于本人：6灵性、2精神，意志18，一案一次。', '成功保留30秒内一次普通精细动作加值10；动作本身仍须另行尝试。', '普通尝试失败时原物留在软垫，仍可亲手拾取、放置和归还；不强加伤害。'] },
  { id: 'lit-crossing', title: '灯下两米，仍须自己行走', story: '同一流灯留在原玻璃屋，重新决定是否携达莉娅的原镇纸走两米。原灯须借来，灯油与月片须实际购买。', facts: ['月辉定形8灵性、3精神，感知18；一片70便士月片耗尽后仍是同一实物。', '真正点亮的原灯和无遮挡光路只支持30秒内的一次待办搬运；独立普通尝试仍可失败。', '流灯去程耗6精力、返程耗3精力，实际行走4米；不补健康、精神、精力或灵性。'] },
  { id: 'withdrawn-moonlight', title: '遮光与撤回以后，照常归还', story: '重新说明这次搬运与光照范围。放下真实遮板、听到流灯撤回本次参与后，未来帮助停止，由本人普通取放并还物。', facts: ['遮光或撤回立即取消未应用的窗口，已经支付的灵性、精神、油与月片不返还。', '不改变他人的意志、感情或关系；流灯的原身体与唯一声片始终仍在原屋。', '清开遮板、实还原灯镇纸与耗尽月片，再沿60米原路返回。'] },
] as const;
export const BEAUTY_GODDESS_LIFE_ENVIRONMENT = '玻璃屋门廊与原玻璃屋相连，屋内两米、屋外本人往返各60米，每米实耗1秒。观察、邀请、报告各1行动，邀请另20便士；一份30便士灯油180秒，三片独立月片各70便士且各购一次。辉映调息6灵性2精神，月辉定形8灵性3精神；仅真正成功应用后报告才对应掌握8。每案扮演25，反思25。暂停最多三次跨周付费普通续办，原失败与成本保留。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 1;
const budget = (s: SliceState): BeautyGoddessLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
export const getBeautyGoddessGuest = (s: SliceState): SummoningMasterPartner => s.summoningMaster.life.partner;
const freshCase = (): BeautyGoddessLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invitedWeek: null, invitationWeeks: [], method: null,
  permission: { guest: 'UNASKED', caretaker: 'UNASKED', selfPower: 'UNASKED' }, permissionRevision: 0, contactOpen: false, visited: false, weightBorrowed: false,
  crossingArmed: false, crossingAttempted: false, precisionAttempted: false, operationOutcome: null, poiseAttempted: false, poiseOutcome: null, moonformAttempted: false,
  moonformOutcome: null, poiseEnd: 'NONE', moonformEnd: 'NONE', abilityApplied: false, poiseApplied: false, moonformApplied: false, obscurationObserved: false, withdrawalObserved: false, result: 'NONE', returned: false });
const freshCases = (): Record<BeautyGoddessCaseId, BeautyGoddessLifeCase> => ({ 'steady-hands': freshCase(), 'lit-crossing': freshCase(), 'withdrawn-moonlight': freshCase() });
function freshPractice(): BeautyGoddessLifePractice {
  return { homeId: 'SM3-GLASS-ROOM', activeCase: null, playerLocation: 'YARD', ownerOffsetMetres: 0, guestOffsetMetres: 0, elapsedSeconds: 0, playerTravelMetres: 0,
    caretaker: { id: 'BG1-DARIA42', name: '达莉娅', age: 42, alive: true, willing: true, location: 'HOME' },
    weight: { id: 'BG1-GLASS-WEIGHT', owner: 'BG1-DARIA42', holder: 'BG1-DARIA42', location: 'OWNER', massGrams: 200 },
    lamp: { id: 'BG1-LAMP', owner: 'BG1-DARIA42', holder: 'BG1-DARIA42', lit: false, fuelSeconds: 0, oilPurchasedWeek: null, oilPrice: 30, oilSeconds: 180, fuelBurnedSeconds: 0 },
    shutter: { id: 'BG1-SHUTTER', position: 'RAISED' }, pieces: ([1, 2, 3] as const).map(n => ({ id: `BG1-MOON-PIECE-${n}` as BeautyGoddessMoonPiece['id'], owner: 'SHOP', price: 70, status: 'SUPPLIER', holder: 'SHOP', purchasedWeek: null, spentWeek: null, caseId: null })),
    pendingPoise: null, pendingMoonform: null, restWeek: null };
}
export function createBeautyGoddessLifeState(): BeautyGoddessLifeState { return { sourceWeek: null, sourcePartner: null, practice: freshPractice(), cases: freshCases(), reflected: false, journal: [] }; }
export function initializeBeautyGoddessLife(s: SliceState): void {
  const l = s.beautyGoddess.life, g = getBeautyGoddessGuest(s);
  if (!active(s) || !same(l, createBeautyGoddessLifeState()) || g.id !== 'SM3-LUMEN' || g.bodyId !== 'SM3-LUMEN-BODY' || g.homeId !== 'SM3-GLASS-ROOM' || g.location !== 'HOME' || g.status !== 'ALIVE' || g.health <= 0 || !g.adult || !g.independentMind || g.chime.id !== 'SM3-CHIME' || g.chime.owner !== g.id) throw new Error('须保留同一活流灯的原身体、原玻璃屋、唯一声片和原休息记录。');
  l.sourceWeek = s.week; l.sourcePartner = structuredClone(g);
}
const simpleCommands = ['VISIT_HOME', 'BORROW_WEIGHT', 'BORROW_LAMP', 'BUY_OIL', 'LIGHT_LAMP', 'EXTINGUISH_LAMP', 'SELF_POISE', 'ARM_CROSSING', 'BOUNDED_MOONFORM', 'PRECISION_PLACE', 'GUEST_CARRY', 'ORDINARY_PLACE', 'LOWER_SHUTTER', 'RAISE_SHUTTER', 'WAIT_WINDOW', 'RETURN_WEIGHT', 'RETURN_GUEST', 'RETURN_PIECES', 'RETURN_LAMP', 'RETURN_HOME', 'ABORT', 'REST_GUEST', 'REFLECT'];
export function validateBeautyGoddessActivityCommand(v: unknown): v is BeautyGoddessActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && BEAUTY_GODDESS_CASE_IDS.includes(v.caseId as BeautyGoddessCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && BEAUTY_GODDESS_CASE_IDS.includes(v.caseId as BeautyGoddessCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['GUEST', 'CARETAKER', 'SELF_POWER'].includes(String(v.permission));
  if (v.type === 'BUY_PIECE') return shape(v, ['type', 'pieceId']) && ['BG1-MOON-PIECE-1', 'BG1-MOON-PIECE-2', 'BG1-MOON-PIECE-3'].includes(String(v.pieceId));
  return shape(v, ['type']) && simpleCommands.includes(String(v.type));
}
export const isBeautyGoddessActivityCommand = validateBeautyGoddessActivityCommand;
export const hasBeautyGoddessLifeLock = (s: SliceState): boolean => !!s.beautyGoddess?.life && (s.beautyGoddess.life.practice.activeCase !== null || s.beautyGoddess.life.practice.playerLocation !== 'YARD' || s.beautyGoddess.life.practice.guestOffsetMetres !== 0 || s.beautyGoddess.life.practice.weight.holder !== 'BG1-DARIA42' || s.beautyGoddess.life.practice.lamp.holder !== 'BG1-DARIA42' || s.beautyGoddess.life.practice.pieces.some(p => p.holder === 'PLAYER'));
export const beautyGoddessInside = hasBeautyGoddessLifeLock;
interface ReplayModel { practice: BeautyGoddessLifePractice; cases: Record<BeautyGoddessCaseId, BeautyGoddessLifeCase>; guest: SummoningMasterPartner; reflected: boolean; sourceWeek: number }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isCheck = (c: BeautyGoddessActivityCommand) => ['SELF_POISE', 'BOUNDED_MOONFORM', 'PRECISION_PLACE', 'GUEST_CARRY'].includes(c.type);
const checkAbility = (c: BeautyGoddessActivityCommand): PublicCoreStatKey => c.type === 'SELF_POISE' ? 'will' : 'perception';
const checkBase = (s: SliceState, c: BeautyGoddessActivityCommand) => c.type === 'GUEST_CARRY' ? 12 : s.character.coreStats[checkAbility(c)];
const audit = (s: SliceState, c: BeautyGoddessActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: isCheck(c) ? s.random.cursor : null, randomAfter: isCheck(c) ? s.random.cursor + 1 : null, checkBase: isCheck(c) ? checkBase(s, c) : null, check: null });
const validBudget = (v: unknown): v is BeautyGoddessLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
function poiseValid(m: ReplayModel): boolean { const p = m.practice, w = p.pendingPoise; return !!w && p.activeCase === w.caseId && p.elapsedSeconds + 4 <= w.expiresAt && m.cases[w.caseId].permission.selfPower === 'GRANTED'; }
function moonformValid(m: ReplayModel): boolean { const p = m.practice, w = p.pendingMoonform, r = w ? m.cases[w.caseId] : null; return !!w && p.activeCase === w.caseId && p.elapsedSeconds + 2 <= w.expiresAt && p.lamp.lit && p.lamp.fuelSeconds >= 2 && p.shutter.position === 'RAISED' && !!r && r.permissionRevision === w.permissionRevision && r.permission.guest === 'GRANTED' && r.permission.caretaker === 'GRANTED' && m.guest.willing; }
function modifiers(m: ReplayModel, c: BeautyGoddessActivityCommand): { source: string; value: number }[] {
  return c.type === 'PRECISION_PLACE' && poiseValid(m) ? [{ source: '本人一次普通精细动作的辉映调息', value: 10 }] : c.type === 'GUEST_CARRY' && moonformValid(m) ? [{ source: '原灯下这一次真实搬运的月辉定形', value: 10 }] : [];
}
function transition(input: ReplayModel, c: BeautyGoddessActivityCommand, week: number, outcome: PublicResolutionTier | null, before: BeautyGoddessLifeBudget, clock: Audit): { model: ReplayModel; receipt: BeautyGoddessLifeReceipt } | null {
  if (!validateBeautyGoddessActivityCommand(c) || !validBudget(before) || !integer(week) || (isCheck(c) ? !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(outcome)) : outcome !== null)) return null;
  const m = structuredClone(input), p = m.practice, g = m.guest, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? m.cases[id] : null;
  const receipt: BeautyGoddessLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, guestWalkedMetres: 0, guestStaminaSpent: 0, lampFuelBurned: 0, guestBefore: structuredClone(g), guestAfter: structuredClone(g) };
  const pay = (ap: number, cash = 0, spirit = 0, mind = 0) => { receipt.after.actions -= ap; receipt.after.cash -= cash; receipt.after.spirituality -= spirit; receipt.after.mind -= mind; };
  const endPoise = (reason: WindowEnd) => { if (p.pendingPoise) { m.cases[p.pendingPoise.caseId].poiseEnd = reason; p.pendingPoise = null; } };
  const endMoonform = (reason: WindowEnd) => { if (p.pendingMoonform) { m.cases[p.pendingMoonform.caseId].moonformEnd = reason; p.pendingMoonform = null; } };
  const elapse = (seconds: number) => {
    receipt.elapsedSeconds += seconds; p.elapsedSeconds += seconds;
    if (p.lamp.lit) { const used = Math.min(seconds, p.lamp.fuelSeconds); p.lamp.fuelSeconds -= used; p.lamp.fuelBurnedSeconds += used; receipt.lampFuelBurned += used; if (!p.lamp.fuelSeconds) { p.lamp.lit = false; endMoonform('OBSCURED'); } }
    if (p.pendingPoise && p.elapsedSeconds >= p.pendingPoise.expiresAt) endPoise('EXPIRED');
    if (p.pendingMoonform && p.elapsedSeconds >= p.pendingMoonform.expiresAt) endMoonform('EXPIRED');
  };
  const ownerMove = (to: 0 | 2) => { if (p.ownerOffsetMetres !== to) { p.ownerOffsetMetres = to; p.playerTravelMetres += 2; receipt.playerWalkedMetres += 2; elapse(2); } };
  const guestMove = (to: 0 | 2, stamina: number) => { if (p.guestOffsetMetres !== to) { p.guestOffsetMetres = to; g.ordinaryDistanceM += 2; receipt.guestWalkedMetres += 2; g.stamina -= stamina; receipt.guestStaminaSpent += stamina; elapse(2); } };
  const outsideMove = (to: 'HOME' | 'YARD') => { if (p.playerLocation !== to) { p.playerLocation = to; p.playerTravelMetres += 60; receipt.playerWalkedMetres += 60; elapse(60); } };
  const returnWeight = () => { if (p.weight.holder !== 'BG1-DARIA42') { ownerMove(p.weight.location === 'TABLE' || p.weight.location === 'PAD' ? 2 : 0); p.weight.holder = 'PLAYER'; elapse(1); ownerMove(0); p.weight.holder = 'BG1-DARIA42'; p.weight.location = 'OWNER'; elapse(1); } };
  const returnPieces = () => { for (const piece of p.pieces) if (piece.holder === 'PLAYER') { piece.holder = 'RETURN_TRAY'; elapse(1); } };
  const leave = () => { p.activeCase = null; r!.contactOpen = false; r!.returned = true; };
  const scene = p.activeCase !== null, physical = scene && !!r && r.status === 'ACTIVE' && r.invitedWeek === week;
  if (scene && (!physical || 'caseId' in c && c.caseId !== p.activeCase)) return null;
  const home = physical && p.playerLocation === 'HOME' && r!.visited;
  const willingGuest = home && r!.permission.guest === 'GRANTED' && g.willing && g.status === 'ALIVE' && g.health > 0 && g.mind > 0 && g.location === 'HOME';
  const permitted = home && r!.permission.caretaker === 'GRANTED';
  const clean = () => p.weight.holder === 'BG1-DARIA42' && p.guestOffsetMetres === 0 && p.ownerOffsetMetres === 0 && p.lamp.holder === 'BG1-DARIA42' && !p.lamp.lit && !p.pendingPoise && !p.pendingMoonform && p.shutter.position === 'RAISED' && p.pieces.every(x => x.holder !== 'PLAYER');
  switch (c.type) {
    case 'OBSERVE': {
      const index = BEAUTY_GODDESS_CASE_IDS.indexOf(c.caseId);
      if (scene || r!.status !== 'AVAILABLE' || !clean() || p.playerLocation !== 'YARD' || index > 0 && m.cases[BEAUTY_GODDESS_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; elapse(5); break;
    }
    case 'INVITE':
      if (scene || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 4 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitedWeek!) || !clean() || p.playerLocation !== 'YARD' || g.status !== 'ALIVE' || g.location !== 'HOME') return null;
      pay(1, 20); r!.status = 'ACTIVE'; r!.invitedWeek = week; r!.invitationWeeks.push(week); r!.method = c.method; r!.permission = { guest: 'UNASKED', caretaker: 'UNASKED', selfPower: 'UNASKED' }; r!.permissionRevision++;
      r!.contactOpen = true; r!.visited = false; r!.returned = false; r!.weightBorrowed = false; p.activeCase = c.caseId; elapse(5); break;
    case 'VISIT_HOME':
      if (!physical || r!.visited || p.playerLocation !== 'YARD' || g.location !== 'HOME' || g.status !== 'ALIVE') return null;
      outsideMove('HOME'); r!.visited = true; break;
    case 'CONSENT':
    case 'DECLINE_CONSENT':
    case 'REVOKE_CONSENT': {
      const key = c.permission === 'GUEST' ? 'guest' : c.permission === 'CARETAKER' ? 'caretaker' : 'selfPower';
      if (!home || (c.type === 'REVOKE_CONSENT' ? r!.permission[key] !== 'GRANTED' : r!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && (key === 'guest' && (!g.willing || g.status !== 'ALIVE' || g.mind <= 0) || key === 'selfPower' && r!.method !== 'ABILITY')) return null;
      r!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; r!.permissionRevision++;
      if (c.type !== 'CONSENT') { if (key === 'selfPower') endPoise('WITHDRAWN'); endMoonform('WITHDRAWN'); if (key === 'guest' && c.type === 'REVOKE_CONSENT') r!.withdrawalObserved = true; }
      elapse(1); break;
    }
    case 'BORROW_WEIGHT':
      if (!permitted || r!.weightBorrowed || p.ownerOffsetMetres !== 0 || p.weight.holder !== 'BG1-DARIA42' || r!.permission.guest === 'UNASKED' || r!.permission.selfPower === 'UNASKED') return null;
      p.weight.holder = 'PLAYER'; p.weight.location = 'START'; r!.weightBorrowed = true; elapse(1); break;
    case 'BORROW_LAMP':
      if (!permitted || id === 'steady-hands' || p.ownerOffsetMetres !== 0 || p.lamp.holder !== 'BG1-DARIA42' || r!.result !== 'NONE') return null;
      p.lamp.holder = 'PLAYER'; elapse(1); break;
    case 'BUY_OIL':
      if (!permitted || p.lamp.holder !== 'PLAYER' || p.lamp.oilPurchasedWeek !== null || p.lamp.lit) return null;
      pay(0, 30); p.lamp.oilPurchasedWeek = week; p.lamp.fuelSeconds = 180; elapse(1); break;
    case 'BUY_PIECE': {
      const piece = p.pieces.find(x => x.id === c.pieceId);
      if (!permitted || id === 'steady-hands' || r!.method !== 'ABILITY' || r!.moonformAttempted || !piece || piece.status !== 'SUPPLIER' || p.pieces.some(x => x.caseId === id)) return null;
      pay(0, 70); piece.owner = 'PLAYER'; piece.status = 'READY'; piece.holder = 'PLAYER'; piece.purchasedWeek = week; piece.caseId = id; elapse(1); break;
    }
    case 'LIGHT_LAMP':
      if (!permitted || p.lamp.holder !== 'PLAYER' || p.lamp.lit || p.lamp.fuelSeconds <= 0) return null;
      elapse(1); p.lamp.lit = true; break;
    case 'EXTINGUISH_LAMP':
      if (!home || !p.lamp.lit || p.lamp.holder !== 'PLAYER') return null;
      p.lamp.lit = false; endMoonform('OBSCURED'); elapse(1); break;
    case 'SELF_POISE':
      if (!permitted || id !== 'steady-hands' || r!.method !== 'ABILITY' || r!.permission.selfPower !== 'GRANTED' || !r!.weightBorrowed || p.weight.location !== 'START' || p.ownerOffsetMetres !== 0 || r!.poiseAttempted || r!.precisionAttempted || r!.result !== 'NONE') return null;
      pay(0, 0, 6, 2); r!.poiseAttempted = true; r!.poiseOutcome = outcome; elapse(2); r!.poiseEnd = successful(outcome) ? 'PENDING' : 'FAILED';
      if (successful(outcome)) p.pendingPoise = { caseId: id, createdAt: p.elapsedSeconds, expiresAt: p.elapsedSeconds + 30, bonus: 10 }; break;
    case 'ARM_CROSSING':
      if (!willingGuest || !permitted || id === 'steady-hands' || r!.crossingArmed || r!.crossingAttempted || !r!.weightBorrowed || p.weight.location !== 'START' || p.ownerOffsetMetres !== 0 || p.guestOffsetMetres !== 0 || r!.result !== 'NONE') return null;
      r!.crossingArmed = true; elapse(1); break;
    case 'BOUNDED_MOONFORM': {
      const piece = p.pieces.find(x => x.caseId === id && x.status === 'READY' && x.holder === 'PLAYER');
      if (!willingGuest || !permitted || r!.permission.selfPower !== 'GRANTED' || id === 'steady-hands' || r!.method !== 'ABILITY' || !r!.crossingArmed || r!.crossingAttempted || r!.moonformAttempted || !piece || !p.lamp.lit || p.lamp.holder !== 'PLAYER' || p.lamp.fuelSeconds <= 2 || p.shutter.position !== 'RAISED' || p.weight.location !== 'START' || r!.result !== 'NONE') return null;
      pay(0, 0, 8, 3); piece.status = 'SPENT'; piece.spentWeek = week; r!.moonformAttempted = true; r!.moonformOutcome = outcome; elapse(2); r!.moonformEnd = successful(outcome) ? 'PENDING' : 'FAILED';
      if (successful(outcome)) p.pendingMoonform = { caseId: id!, createdAt: p.elapsedSeconds, expiresAt: p.elapsedSeconds + 30, permissionRevision: r!.permissionRevision, pieceId: piece.id, bonus: 10 }; break;
    }
    case 'PRECISION_PLACE': {
      if (!permitted || id !== 'steady-hands' || !r!.weightBorrowed || r!.precisionAttempted || p.weight.location !== 'START' || p.ownerOffsetMetres !== 0 || p.shutter.position !== 'RAISED' || r!.result !== 'NONE') return null;
      const helped = poiseValid(m); r!.precisionAttempted = true; r!.operationOutcome = outcome; endPoise(successful(outcome) && helped ? 'APPLIED' : 'OPERATION_FAILED'); ownerMove(2); elapse(2);
      p.weight.holder = successful(outcome) ? 'TABLE' : 'PAD'; p.weight.location = successful(outcome) ? 'TABLE' : 'PAD';
      if (successful(outcome)) { r!.poiseApplied = helped; r!.result = helped ? 'ABILITY' : 'ORDINARY'; }
      endPoise(successful(outcome) && helped ? 'APPLIED' : 'OPERATION_FAILED'); break;
    }
    case 'GUEST_CARRY': {
      if (!willingGuest || !permitted || id !== 'lit-crossing' || !r!.crossingArmed || r!.crossingAttempted || p.weight.location !== 'START' || p.guestOffsetMetres !== 0 || p.shutter.position !== 'RAISED' || g.stamina < 9 || r!.result !== 'NONE') return null;
      const helped = moonformValid(m); r!.crossingAttempted = true; r!.operationOutcome = outcome; endMoonform(successful(outcome) && helped ? 'APPLIED' : 'OPERATION_FAILED'); p.weight.holder = 'SM3-LUMEN'; guestMove(2, 6);
      p.weight.holder = successful(outcome) ? 'TABLE' : 'PAD'; p.weight.location = successful(outcome) ? 'TABLE' : 'PAD';
      if (successful(outcome)) { r!.moonformApplied = helped; r!.result = helped ? 'ABILITY' : 'ORDINARY'; }
      endMoonform(successful(outcome) && helped ? 'APPLIED' : 'OPERATION_FAILED'); break;
    }
    case 'ORDINARY_PLACE':
      if (!home || !r!.weightBorrowed || r!.result !== 'NONE' || p.weight.location === 'OWNER' || p.shutter.position !== 'RAISED' || id === 'withdrawn-moonlight' && (!r!.obscurationObserved || !r!.withdrawalObserved)) return null;
      // After withdrawal, safe ordinary handling returns the borrowed object;
      // it does not ask either independent person to perform or receive magic.
      endPoise('CANCELLED'); endMoonform('CANCELLED'); ownerMove(p.weight.location === 'START' ? 0 : 2); p.weight.holder = 'PLAYER'; elapse(1); ownerMove(2); p.weight.holder = 'TABLE'; p.weight.location = 'TABLE'; elapse(2); r!.result = 'ORDINARY'; break;
    case 'LOWER_SHUTTER':
      if (!home || p.shutter.position !== 'RAISED' || r!.result !== 'NONE') return null;
      p.shutter.position = 'LOWERED'; r!.obscurationObserved = true; endMoonform('OBSCURED'); elapse(2); break;
    case 'RAISE_SHUTTER':
      if (!home || p.shutter.position !== 'LOWERED') return null;
      p.shutter.position = 'RAISED'; elapse(2); break;
    case 'WAIT_WINDOW': {
      if (!home || !p.pendingPoise && !p.pendingMoonform) return null;
      const until = Math.max(p.pendingPoise?.expiresAt ?? p.elapsedSeconds, p.pendingMoonform?.expiresAt ?? p.elapsedSeconds); elapse(until - p.elapsedSeconds); break;
    }
    case 'RETURN_WEIGHT':
      if (!home || p.weight.holder === 'BG1-DARIA42' || p.shutter.position !== 'RAISED') return null;
      endPoise('CANCELLED'); endMoonform('CANCELLED'); returnWeight(); break;
    case 'RETURN_GUEST':
      if (!home || p.guestOffsetMetres !== 2 || g.status !== 'ALIVE' || g.stamina < 3 || p.shutter.position !== 'RAISED' || p.weight.holder === 'SM3-LUMEN') return null;
      guestMove(0, 3); break;
    case 'RETURN_PIECES':
      if (!home || p.ownerOffsetMetres !== 0 || !p.pieces.some(x => x.holder === 'PLAYER')) return null;
      endMoonform('CANCELLED'); returnPieces(); break;
    case 'RETURN_LAMP':
      if (!home || p.ownerOffsetMetres !== 0 || p.lamp.holder !== 'PLAYER' || p.lamp.lit) return null;
      endMoonform('CANCELLED'); p.lamp.holder = 'BG1-DARIA42'; elapse(1); break;
    case 'RETURN_HOME':
      if (!home || r!.result === 'NONE' || !clean()) return null;
      outsideMove('YARD'); leave(); r!.status = 'EXAMINED'; break;
    case 'ABORT':
      if (!physical) return null;
      endPoise('CANCELLED'); endMoonform('CANCELLED');
      if (p.playerLocation === 'HOME') {
        if (p.shutter.position === 'LOWERED') { p.shutter.position = 'RAISED'; elapse(2); }
        if (p.lamp.lit) { p.lamp.lit = false; elapse(1); }
        returnWeight(); ownerMove(0);
        if (p.guestOffsetMetres === 2) { if (g.stamina < 3 || g.status !== 'ALIVE') return null; guestMove(0, 3); }
        returnPieces(); if (p.lamp.holder === 'PLAYER') { p.lamp.holder = 'BG1-DARIA42'; elapse(1); } outsideMove('YARD');
      }
      if (!clean()) return null; leave(); r!.status = r!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; break;
    case 'REST_GUEST':
      if (scene || !clean() || p.playerLocation !== 'YARD' || week <= Math.max(m.sourceWeek, p.restWeek ?? 0, g.restHistory.at(-1)?.week ?? 0) || g.status !== 'ALIVE' || g.health <= 0 || g.location !== 'HOME' || !g.willing || g.stamina >= 100 && g.mind >= 100) return null;
      pay(1, 30); g.restHistory.push({ week, paidPennies: 30, staminaBefore: g.stamina, staminaAfter: Math.min(100, g.stamina + 30), mindBefore: g.mind, mindAfter: Math.min(100, g.mind + 10), healthUnchanged: g.health });
      g.stamina = Math.min(100, g.stamina + 30); g.mind = Math.min(100, g.mind + 10); p.restWeek = week;
      outsideMove('HOME'); elapse(1800); outsideMove('YARD'); break;
    case 'REPORT':
      if (scene || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !clean() || p.playerLocation !== 'YARD') return null;
      pay(1); r!.status = 'RESOLVED'; elapse(5); break;
    case 'REFLECT':
      if (scene || m.reflected || !BEAUTY_GODDESS_CASE_IDS.every(x => m.cases[x].status === 'RESOLVED') || !clean() || p.playerLocation !== 'YARD') return null;
      pay(1); m.reflected = true; elapse(5); break;
  }
  if (!validBudget(receipt.after) || !integer(g.stamina, 0, 100)) return null;
  for (const value of Object.values(m.cases)) value.abilityApplied = value.poiseApplied || value.moonformApplied;
  receipt.guestAfter = structuredClone(g); return { model: m, receipt };
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate): boolean => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(l: BeautyGoddessLifeState, s: SliceState): ReplayModel | null {
  if (l.sourceWeek === null || !l.sourcePartner || !Array.isArray(l.journal)) return null;
  let model: ReplayModel = { practice: freshPractice(), cases: freshCases(), guest: structuredClone(l.sourcePartner), reflected: false, sourceWeek: l.sourceWeek };
  let lastRandomAfter = 0, lastWeek = l.sourceWeek; let previous: BeautyGoddessLifeReceipt | null = null;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'command', 'outcome', 'before', 'after', 'elapsedSeconds', 'playerWalkedMetres', 'guestWalkedMetres', 'guestStaminaSpent', 'lampFuelBurned', 'guestBefore', 'guestAfter']) || !validateBeautyGoddessActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : 0, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (model.practice.activeCase !== null && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      if (entry.checkBase !== checkBase(s, entry.command) || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ability: checkAbility(entry.command), baseAbility: entry.checkBase, difficulty: 18, modifiers: modifiers(model, entry.command), roll: random.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry); if (!next || !same(next.receipt, entry)) return null;
    model = next.model; previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
/** Used by the acquisition validator before restoring frozen old histories. */
export function beautyGoddessExpectedPartner(s: SliceState): SummoningMasterPartner | null {
  try { const model = replayLife(s.beautyGoddess.life, s); return model ? structuredClone(model.guest) : null; } catch { return null; }
}
export function beautyGoddessLifeOriginalEvents(s: SliceState): BeautyGoddessOriginalEvent[] { return s.beautyGoddess.life.journal.map(r => ({ revision: r.revision, week: r.week, source: `beauty-goddess-life:${r.command.type}`, before: structuredClone(r.guestBefore), after: structuredClone(r.guestAfter) })); }
export const beautyGoddessLifeOriginalTail = beautyGoddessExpectedPartner;
export function beautyGoddessLifeAdultsAbsent(s: SliceState): boolean {
  const p = s.beautyGoddess.life.practice, g = getBeautyGoddessGuest(s);
  return !hasBeautyGoddessLifeLock(s) && g.location === 'HOME' && p.guestOffsetMetres === 0 && p.caretaker.location === 'HOME';
}
export function validateBeautyGoddessLife(s: SliceState): boolean {
  try {
    const l = s.beautyGoddess?.life;
    if (!record(l) || !shape(l, ['sourceWeek', 'sourcePartner', 'practice', 'cases', 'reflected', 'journal']) || !Array.isArray(l.journal) || !record(l.practice) || !record(l.cases) || !shape(l.cases, BEAUTY_GODDESS_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.beautyGoddess.promotionWeek === null) return same(l, createBeautyGoddessLifeState());
    if (!integer(l.sourceWeek, 0, s.week) || l.sourceWeek !== s.beautyGoddess.promotionWeek || !l.sourcePartner || l.sourcePartner.id !== 'SM3-LUMEN' || l.sourcePartner.bodyId !== 'SM3-LUMEN-BODY' || l.sourcePartner.location !== 'HOME' || l.sourcePartner.status !== 'ALIVE' || !same(l.sourcePartner, s.beautyGoddess.sourceScene?.partner) || l.sourcePartner.chime.id !== 'SM3-CHIME' || l.sourcePartner.chime.owner !== 'SM3-LUMEN') return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l.practice, replay.practice) || !same(l.cases, replay.cases) || l.reflected !== replay.reflected || !same(getBeautyGoddessGuest(s), replay.guest)) return false;
    let acting = l.reflected ? 25 : 0;
    for (const id of BEAUTY_GODDESS_CASE_IDS) {
      const r = l.cases[id], resolved = r.status === 'RESOLVED';
      if (s.seer.completedSources.filter(source => source === `beauty-goddess-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
      if (resolved && r.abilityApplied && r.result === 'ABILITY' && (s.progression.mastery[id === 'steady-hands' ? POISE : MOONFORM] ?? 0) < 8) return false;
    }
    if (s.seer.completedSources.filter(source => source === 'beauty-goddess-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting) return false;
    const last = l.journal.at(-1), locked = hasBeautyGoddessLifeLock(s);
    if (locked && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.beautyGoddess.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.beautyGoddess.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.after.actions > 0 && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    return true;
  } catch { return false; }
}
export function blockBeautyGoddessActivity(s: SliceState, c: BeautyGoddessActivityCommand): string | null {
  if (!validateBeautyGoddessActivityCommand(c)) return '门廊生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已经实际成为美神。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回到贝克兰德。';
  if (s.beautyGoddess.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.beautyGoddess.encounter.status) || s.beautyGoddess.encounter.preparation !== null) return '先收束晋升准备或当前遭遇。';
  if (!validateBeautyGoddessLife(s)) return '同一来客、原物、实际成本或历史记录不一致。';
  if (!transition(replayLife(s.beautyGoddess.life, s)!, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成真实前一步，确认这一次许可、原物位置和有限材料；失败与已付成本不能重置。';
  return null;
}
const NOTES: Record<BeautyGoddessActivityCommand['type'], [string, string]> = {
  OBSERVE: ['查看玻璃屋门廊与普通退路', '同一流灯仍住在原屋，达莉娅的原灯与镇纸各只有一件。'],
  INVITE: ['为这一案重新发出邀请', '实付1行动20便士。本次来客参与、物主许可与本人施术决定分别记录；旧案同意不沿用。'],
  VISIT_HOME: ['沿60米普通小径到玻璃屋', '本人实走60米、实耗60秒；流灯一直留在同一原玻璃屋，没有召来另一身体。'],
  CONSENT: ['确认这一项当前许可', '该项只覆盖本案说明过的步骤，可随时撤回；本人调息不会改变他人的情感或意志。'],
  DECLINE_CONSENT: ['记录这一项拒绝', '拒绝已生效。普通安全取还原物与实际步行退出仍可完成。'],
  REVOKE_CONSENT: ['撤回这一项当前许可', '尚未应用的相关帮助停止。已付灵性、精神、灯油、月片与已经发生的动作保留。'],
  BORROW_WEIGHT: ['从达莉娅手中借来同一镇纸', '唯一BG1-GLASS-WEIGHT已真实交付本人；它不是旧米拉的原牌。'],
  BORROW_LAMP: ['借来达莉娅同一盏原灯', 'BG1-LAMP的所有权仍属达莉娅，借用与返还不产生第二盏灯。'],
  BUY_OIL: ['实际购买一份有限灯油', '实付30便士，原灯增加唯一一份180秒燃油；本段不能再次购买或补充。'],
  BUY_PIECE: ['实际购买一片独立月片', '实付70便士，购得所选同一实物；每片只购一次，用后留下耗尽原片，须实际返还。'],
  LIGHT_LAMP: ['亲手点亮原灯', '只有剩余燃油支持的真实光照才有效；之后每个现场动作的实际秒数都会消耗灯油。'],
  EXTINGUISH_LAMP: ['亲手熄灭原灯', '剩余油量保留，未应用的月辉窗口停止；没有回退已烧掉的灯油。'],
  SELF_POISE: ['尝试一次辉映调息', '实付6灵性、2精神，意志18。成功只给本人30秒内一次真实精细操作加值10，不会代替亲手放置。'],
  ARM_CROSSING: ['确认待办的这一次两米搬运', '同一原镇纸仍在起点，流灯自主同意这次真实搬运；它尚未移动，也未获得恢复。'],
  BOUNDED_MOONFORM: ['尝试一次月辉定形', '实付8灵性、3精神和同一片月片，感知18。成功只在有灯光无遮挡的30秒内稳定一次待办搬运，独立普通尝试仍可能失败。'],
  PRECISION_PLACE: ['本人亲手进行一次精细放置', '实际走2米并花2秒放置，感知18，只抽一次；失败时原镇纸安全落在软垫，仍须普通拾取。'],
  GUEST_CARRY: ['流灯自主进行这一次真实搬运', '同一身体沿屋内通道走2米，实扣6精力；普通感知12、难度18。失败时原物留软垫，不强制受伤或改写意志。'],
  ORDINARY_PLACE: ['本人普通拾取并放好原镇纸', '本人到原物真实位置拾取，再到两米外原桌放好。原失败和所有已付成本保留。'],
  LOWER_SHUTTER: ['实际放下原遮板', '实耗2秒，光路被遮挡，尚未应用的月辉帮助立即中断。'],
  RAISE_SHUTTER: ['亲手清开普通通道', '实耗2秒把同一遮板重新抬起；已经中断的窗口不会恢复。'],
  WAIT_WINDOW: ['等到本次有限窗口到期', '等待了实际剩余秒数；灯若仍点亮就继续耗油。没有完成普通操作便没有掌握奖励。'],
  RETURN_WEIGHT: ['亲手取回并归还同一镇纸', '本人走到原物实际位置拾取，再沿原路回门廊交还达莉娅；不是免费改写持有人。'],
  RETURN_GUEST: ['流灯沿屋内原路返回', '同一身体走2米、实扣3精力回门边，位置仍是原玻璃屋；唯一声片始终由它自己保管。'],
  RETURN_PIECES: ['将携带的原月片放回托盘', '未用或耗尽的同一实物都留在托盘，不退款，不补充，也不能当成本人仍持有的媒介。'],
  RETURN_LAMP: ['把熄灭的同一原灯还给达莉娅', '原灯真实交回物主，剩余油量与已烧秒数保留。'],
  RETURN_HOME: ['本人沿60米原路返回院里', '原物已经归还，流灯与达莉娅留在玻璃屋；本人实际走60米、实耗60秒离开现场。'],
  ABORT: ['实际清路、还物并步行退出', '必要的拾取、返程、流灯精力与步行秒数都已实记。失败、油耗、月片与已付代价不重置，可跨周付费普通续办。'],
  REST_GUEST: ['同一流灯获得一次付费普通休息', '实付1行动30便士，本人实际往返120米并等候。沿用原普通休息公式：精力加30最多100，精神加10最多100，健康不变；记入同一原休息历史。'],
  REPORT: ['报告真正完成并收束的一案', '实付1行动，扮演增加25；只有能力真正帮助成功完成实际动作，才增加对应掌握8。'],
  REFLECT: ['反思自持、有限光照与独立意愿', '三案已真正收束，实付1行动，扮演增加25。没有制造生命、免费能源或决定别人的爱与想法。'],
};
export function applyBeautyGoddessActivity(s: SliceState, c: BeautyGoddessActivityCommand, ctx: SeerContext): void {
  const reason = blockBeautyGoddessActivity(s, c); if (reason) throw new Error(reason);
  const l = s.beautyGoddess.life, model = replayLife(l, s)!, clock = audit(s, c);
  let check: PublicCheckResult | null = null;
  if (isCheck(c)) { check = resolveNormalCheck({ ability: checkAbility(c), baseAbility: checkBase(s, c), difficulty: 18, modifiers: modifiers(model, c), roll: ctx.roll(1, 100) }); s.lastCheck = check; }
  clock.check = check; if (isCheck(c)) clock.randomAfter = s.random.cursor;
  const next = transition(model, c, s.week, check?.tier ?? null, budget(s), clock)!;
  s.health = next.receipt.after.health; s.mind = next.receipt.after.mind; s.spirituality = next.receipt.after.spirituality; s.cash = next.receipt.after.cash; s.actionsRemaining = next.receipt.after.actions;
  l.practice = next.model.practice; l.cases = next.model.cases; l.reflected = next.model.reflected; l.journal.push(next.receipt);
  // Mutate only the authoritative same-body partner, retaining every old rest.
  Object.assign(getBeautyGoddessGuest(s), structuredClone(next.model.guest));
  if (c.type === 'REPORT') {
    const r = l.cases[c.caseId]; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`beauty-goddess-case:${c.caseId}`);
    if (r.abilityApplied && r.result === 'ABILITY' && c.caseId !== 'withdrawn-moonlight') { const ability = c.caseId === 'steady-hands' ? POISE : MOONFORM; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('beauty-goddess-reflection'); }
  const note = NOTES[c.type]; let detail = note[1];
  if (c.type === 'OBSERVE') { const entry = CASES.find(item => item.id === c.caseId)!; detail = entry.story + entry.facts.join(' '); }
  if (isCheck(c)) detail += successful(check?.tier ?? null) ? ['SELF_POISE', 'BOUNDED_MOONFORM'].includes(c.type) ? '窗口已打开，仍待下一次真实动作，此刻没有掌握奖励。' : '本次普通动作确实成功，仍须实还原物并完成返程。' : '本次真实失败已保留，不能重抽，普通拾取归还仍可继续。';
  ctx.note(note[0], detail);
}
export function beautyGoddessLifeActions(s: SliceState): BeautyGoddessAction[] {
  if (!active(s)) return [];
  const out: BeautyGoddessAction[] = [], l = s.beautyGoddess.life, p = l.practice;
  const add = (command: BeautyGoddessActivityCommand, label: string, cost: string, cleanup = false, preferredAction = false) => {
    const reason = blockBeautyGoddessActivity(s, command);
    out.push({ id: `beauty-goddess-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}${'pieceId' in command ? '-' + command.pieceId : ''}`, label, cost, command, enabled: reason === null, reason, cleanup, preferredAction });
  };
  if (p.activeCase) {
    const id = p.activeCase, r = l.cases[id];
    if (!r.visited) add({ type: 'VISIT_HOME' }, '沿60米普通小径亲赴玻璃屋', '0行动 · 60米／60秒', false, true);
    else if (r.permission.guest === 'UNASKED') { add({ type: 'CONSENT', permission: 'GUEST' }, '询问流灯是否自愿参与这一案', '0行动 · 当前独立决定', false, true); add({ type: 'DECLINE_CONSENT', permission: 'GUEST' }, '流灯拒绝本次参与', '0行动 · 本人仍可普通还物', true); }
    else if (r.permission.caretaker === 'UNASKED') { add({ type: 'CONSENT', permission: 'CARETAKER' }, '询问达莉娅本案原物与光照许可', '0行动 · 本案单独许可', false, true); add({ type: 'DECLINE_CONSENT', permission: 'CARETAKER' }, '达莉娅拒绝借用本案原物', '0行动 · 可安全离开', true); }
    else if (r.permission.selfPower === 'UNASKED') { if (r.method === 'ABILITY') add({ type: 'CONSENT', permission: 'SELF_POWER' }, '本人确认这次有限自持与月辉使用', '0行动 · 不控制他人意愿', false, true); add({ type: 'DECLINE_CONSENT', permission: 'SELF_POWER' }, '本人决定按普通方式完成', '0行动', true, r.method === 'ORDINARY'); }
    else if (r.result !== 'NONE') {
      if (p.lamp.lit) add({ type: 'EXTINGUISH_LAMP' }, '亲手熄灯，保留剩余原油', '0行动 · 1秒', true, true);
      else if (p.weight.holder !== 'BG1-DARIA42') add({ type: 'RETURN_WEIGHT' }, '到原物位置拾取并亲还达莉娅', '0行动 · 真实取物与两米返程', true, true);
      else if (p.guestOffsetMetres === 2) add({ type: 'RETURN_GUEST' }, '流灯沿屋内两米原路返回', '0行动 · 原来客3精力', true, true);
      else if (p.pieces.some(piece => piece.holder === 'PLAYER')) add({ type: 'RETURN_PIECES' }, '把同一未用或耗尽月片放回托盘', '0行动 · 每片1秒', true, true);
      else if (p.lamp.holder === 'PLAYER') add({ type: 'RETURN_LAMP' }, '把原灯亲还达莉娅', '0行动 · 1秒', true, true);
      else add({ type: 'RETURN_HOME' }, '本人沿60米原路实际返回院里', '0行动 · 60米／60秒', true, true);
    } else if (!r.weightBorrowed) add({ type: 'BORROW_WEIGHT' }, '借来达莉娅唯一的玻璃镇纸', '0行动 · 须亲手归还', false, true);
    else if (id === 'steady-hands') {
      if (r.method === 'ABILITY' && r.permission.selfPower === 'GRANTED' && !r.poiseAttempted && !r.precisionAttempted) add({ type: 'SELF_POISE' }, '尝试一次辉映调息', '0行动 · 6灵性＋2精神 · 意志18', false, true);
      else if (!r.precisionAttempted) add({ type: 'PRECISION_PLACE' }, '本人实际进行这一次精细放置', '0行动 · 2米／4秒 · 感知18', false, true);
      else add({ type: 'ORDINARY_PLACE' }, '从原软垫普通拾取并放好镇纸', '0行动 · 保留真实失败', true, true);
    } else {
      const usePower = r.method === 'ABILITY' && r.permission.selfPower === 'GRANTED' && r.permission.guest === 'GRANTED' && r.permission.caretaker === 'GRANTED' && !r.moonformAttempted;
      if (usePower && p.lamp.holder !== 'PLAYER') add({ type: 'BORROW_LAMP' }, '借来达莉娅唯一的原灯', '0行动 · 须实还', false, true);
      else if (usePower && p.lamp.oilPurchasedWeek === null) add({ type: 'BUY_OIL' }, '购买唯一一份180秒灯油', '0行动 · 30便士', false, true);
      else if (usePower && !p.pieces.some(piece => piece.caseId === id)) {
        const piece = p.pieces.find(piece => piece.status === 'SUPPLIER'); if (piece) add({ type: 'BUY_PIECE', pieceId: piece.id }, '购买一片尚未使用的独立月片', '0行动 · 70便士', false, true);
      } else if (usePower && !p.lamp.lit) add({ type: 'LIGHT_LAMP' }, '亲手点亮仍有原油的灯', '0行动 · 此后按实际秒数耗油', false, true);
      else if (usePower && !r.crossingArmed) add({ type: 'ARM_CROSSING' }, '确认自愿的这一次待办两米搬运', '0行动 · 1秒', false, true);
      else if (usePower) add({ type: 'BOUNDED_MOONFORM' }, '尝试一次有真实光照的月辉定形', '0行动 · 8灵性＋3精神＋1原月片 · 感知18', false, true);
      else if (id === 'withdrawn-moonlight') {
        if (!r.obscurationObserved) add({ type: 'LOWER_SHUTTER' }, '实际放下原遮板，中断未来光照', '0行动 · 2秒 · 已付成本保留', true, true);
        else if (!r.withdrawalObserved) add({ type: 'REVOKE_CONSENT', permission: 'GUEST' }, '流灯明确撤回本次参与', '0行动 · 不改变既成事实', true, true);
        else if (p.shutter.position === 'LOWERED') add({ type: 'RAISE_SHUTTER' }, '亲手清开原普通通道', '0行动 · 2秒', true, true);
        else add({ type: 'ORDINARY_PLACE' }, '本人普通拾取并放好原镇纸', '0行动 · 不要求流灯施术或搬运', true, true);
      } else if (r.permission.guest === 'GRANTED' && !r.crossingAttempted) {
        if (!r.crossingArmed) add({ type: 'ARM_CROSSING' }, '确认这一次自愿普通搬运', '0行动 · 1秒', false, true);
        else if (p.shutter.position === 'LOWERED') add({ type: 'RAISE_SHUTTER' }, '亲手清开两米原路', '0行动 · 2秒', true, true);
        else add({ type: 'GUEST_CARRY' }, '让流灯自主完成一次真实搬运', '0行动 · 2米／2秒 · 原来客6精力', false, true);
      } else add({ type: 'ORDINARY_PLACE' }, '本人从真实位置普通拾取放好', '0行动 · 保留原失败', true, true);
    }
    if (r.visited && r.weightBorrowed && r.result === 'NONE' && (id !== 'withdrawn-moonlight' || r.obscurationObserved && r.withdrawalObserved) && !out.some(a => a.command.type === 'ORDINARY_PLACE')) add({ type: 'ORDINARY_PLACE' }, '不用能力，由本人普通取放原镇纸', '0行动 · 已付代价保留', true);
    if (p.pendingPoise || p.pendingMoonform) add({ type: 'WAIT_WINDOW' }, '等待这次30秒窗口真正到期', '0行动 · 已点燃灯继续耗油', true);
    if (p.pendingMoonform && !out.some(a => a.command.type === 'LOWER_SHUTTER')) add({ type: 'LOWER_SHUTTER' }, '亲手放下原遮板', '0行动 · 中断光路不退款', true);
    for (const permission of ['GUEST', 'CARETAKER', 'SELF_POWER'] as const) {
      const key = permission === 'GUEST' ? 'guest' : permission === 'CARETAKER' ? 'caretaker' : 'selfPower';
      if (r.permission[key] === 'GRANTED' && !out.some(a => a.command.type === 'REVOKE_CONSENT' && a.command.permission === permission)) add({ type: 'REVOKE_CONSENT', permission }, permission === 'GUEST' ? '流灯撤回这次参与' : permission === 'CARETAKER' ? '达莉娅撤回本次许可' : '本人停止这次能力许可', '0行动 · 普通还物离场仍可继续', true);
    }
    add({ type: 'ABORT' }, '实际清路、还物并沿原路退出', '0行动 · 真正移动与消耗，保留失败', true, !out.some(a => a.enabled && a.preferredAction));
    return out;
  }
  const next = CASES.find(item => l.cases[item.id].status !== 'RESOLVED');
  if (next) {
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, `观察：${next.title}`, '1行动', false, true);
    if (r.status === 'OBSERVED' || r.status === 'PAUSED') {
      if (r.status === 'OBSERVED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, '重新邀请，说明有限能力与普通退路', '1行动 · 20便士', false, true);
      add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED' ? '下一真实周重新邀请，普通续办' : '重新邀请，只按普通方式完成', '1行动 · 20便士', false, r.status === 'PAUSED');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, '报告原物已还、本人已返回的真实结果', '1行动 · 扮演25 · 实际能力应用才掌握8', false, true);
  } else if (!l.reflected) add({ type: 'REFLECT' }, '反思自持、有限光照与独立意愿', '1行动 · 扮演25', false, true);
  if (l.sourceWeek !== null && s.week > Math.max(l.sourceWeek, p.restWeek ?? 0, getBeautyGoddessGuest(s).restHistory.at(-1)?.week ?? 0) && (getBeautyGoddessGuest(s).stamina < 100 || getBeautyGoddessGuest(s).mind < 100)) add({ type: 'REST_GUEST' }, '为同一流灯安排一次付费普通休息', '1行动 · 30便士 · 精力＋30／精神＋10，封顶100', false);
  return out;
}
function projectAttempts(l: BeautyGoddessLifeState, id: BeautyGoddessCaseId): BeautyGoddessLifeProjection['cases'][number]['attempts'] {
  const result: BeautyGoddessLifeProjection['cases'][number]['attempts'] = []; let current: typeof result[number] | null = null;
  for (const entry of l.journal) {
    if (entry.command.type === 'INVITE' && entry.command.caseId === id) { current = { invitedWeek: entry.week, method: entry.command.method, outcome: null, operationOutcome: null, receipts: [] }; result.push(current); }
    if (!current) continue;
    current.receipts.push(projectBeautyGoddessLifeReceipt(entry));
    if (entry.command.type === 'SELF_POISE' || entry.command.type === 'BOUNDED_MOONFORM') current.outcome = entry.outcome;
    if (entry.command.type === 'PRECISION_PLACE' || entry.command.type === 'GUEST_CARRY') current.operationOutcome = entry.outcome;
    if (entry.command.type === 'RETURN_HOME' || entry.command.type === 'ABORT') current = null;
  }
  return result;
}
export function projectBeautyGoddessLife(s: SliceState): BeautyGoddessLifeProjection {
  const l = s.beautyGoddess.life, actions = beautyGoddessLifeActions(s), r = l.practice.activeCase ? l.cases[l.practice.activeCase] : null;
  return { title: '玻璃屋门廊上的自持与有限月光', source: '流灯仍是原屋中的同一独立成年身体；达莉娅保有原灯与镇纸。每个真实动作、付费材料与撤回后的普通返还都各自留痕。', environment: BEAUTY_GODDESS_LIFE_ENVIRONMENT,
    insideCase: hasBeautyGoddessLifeLock(s), reflected: l.reflected, preferredActionId: actions.find(a => a.enabled && a.preferredAction)?.id ?? actions.find(a => a.enabled)?.id ?? null,
    practice: structuredClone(l.practice), partner: structuredClone(getBeautyGoddessGuest(s)), currentConsents: [{ id: 'SM3-LUMEN', consented: r?.permission.guest === 'GRANTED' }, { id: 'BG1-DARIA42', consented: r?.permission.caretaker === 'GRANTED' }, { id: 'PLAYER', consented: r?.permission.selfPower === 'GRANTED' }],
    cases: CASES.map(item => { const c = l.cases[item.id]; return { id: item.id, title: item.title, story: item.story, observations: c.status === 'AVAILABLE' ? [] : [...item.facts], status: c.status, permission: structuredClone(c.permission), contactOpen: c.contactOpen,
      preparation: c.status === 'OBSERVED' ? '等候本案重新邀请与各项当前许可。' : c.status === 'PAUSED' ? '原失败与已付成本保留；下一真实周可付费普通续办，最多三次。' : null,
      result: c.result !== 'NONE' ? `${c.result === 'ABILITY' ? '有限帮助确实应用于成功的真实动作。' : '已按普通方法完成真实取放。'}${c.returned ? '原人原物已在原位，本人已实际返程。' : '仍须实还原物、原来客返程并步行离开。'}` : c.poiseEnd === 'PENDING' || c.moonformEnd === 'PENDING' ? '有限窗口仍待真正的普通操作；尚未完成，也没有掌握奖励。' : c.poiseAttempted || c.moonformAttempted ? '原施术结果和代价已留存，可继续普通收束。' : null,
      returned: c.returned, attempts: projectAttempts(l, item.id) }; }), ledger: l.journal.map(projectBeautyGoddessLifeReceipt) };
}
