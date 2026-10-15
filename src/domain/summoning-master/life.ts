import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { applyWitchKingActivity, blockWitchKingLife, hasWitchKingLifeLock, type WitchKingPaper } from '../witch-king/life.js';

export const SUMMONING_MASTER_CASE_IDS = ['source-visit', 'original-token', 'interrupted-door'] as const;
export type SummoningMasterCaseId = typeof SUMMONING_MASTER_CASE_IDS[number];
export type SummoningMasterGuestLocation = 'HOME' | 'YARD' | 'PATH';
export interface SummoningMasterGuestRest {
  week: number; paidPennies: 30; staminaBefore: number; staminaAfter: number; mindBefore: number; mindAfter: number; healthUnchanged: number;
}
export interface SummoningMasterPartner {
  id: 'SM3-LUMEN'; name: '流灯'; source: string; adult: true; independentMind: true; bodyId: 'SM3-LUMEN-BODY'; homeId: 'SM3-GLASS-ROOM';
  location: SummoningMasterGuestLocation; health: number; mind: number; stamina: number; status: 'ALIVE' | 'DEAD'; willing: boolean;
  metWeek: number | null; ordinaryDistanceM: number; gateCrossings: number;
  chime: { id: 'SM3-CHIME'; owner: 'SM3-LUMEN' }; restHistory: SummoningMasterGuestRest[];
}
export interface SummoningMasterAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number;
  ownerTravelMetres: number; guestTravelMetres: number; homeVisits: number; consent: 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'CLOSED';
  consentWeek: number | null; ownerConsent: boolean; gateTier: PublicResolutionTier | null; cooperationTier: PublicResolutionTier | null;
  guestArrived: boolean; arrivalMethod: 'GATE' | 'ORDINARY' | null; identityChecked: boolean; tokenTaken: boolean; tokenDelivered: boolean; tokenReturned: boolean;
  guestAtTable: boolean; interruptionObserved: boolean; gateInterrupted: boolean; guestReturned: boolean; inspected: boolean;
  spiritualitySpent: number; guestStaminaSpent: number;
}
export interface SummoningMasterCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  closes: number; withdrawals: number; attempts: SummoningMasterAttempt[];
}
export interface SummoningMasterLifeState {
  partner: SummoningMasterPartner; activeCase: SummoningMasterCaseId | null; playerLocation: SummoningMasterGuestLocation; playerTravelMetres: number; clockSeconds: number;
  gate: { status: 'CLOSED' | 'OPEN' | 'BROKEN' | 'EXPIRED'; remainingSeconds: number; from: 'HOME'; to: 'YARD' };
  token: { id: 'SM3-TEST-TOKEN'; owner: 'SM3-ADA39'; massGrams: 200; custodian: 'SM3-ADA39' | 'PLAYER' | 'SM3-LUMEN' | 'TABLE'; location: 'OWNER' | 'YARD' | 'TABLE' };
  ada: { id: 'SM3-ADA39'; name: '艾达'; age: 39; alive: boolean; willing: boolean; location: 'YARD' };
  shutter: { id: 'SM3-SHUTTER'; location: 'RAISED' | 'LOWERED' }; tableId: 'SM3-TABLE';
  cases: Record<SummoningMasterCaseId, SummoningMasterCaseState>; reflected: boolean;
}
export type SummoningMasterActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'VISIT_HOME' | 'CONSENT' | 'REVOKE_CONSENT' | 'RETURN_PLAYER' | 'OPEN_GATE' | 'INVITE_GUEST' | 'FETCH_GUEST' | 'VERIFY_GUEST' | 'CONSENT_OWNER' | 'BORROW_TOKEN' | 'COOPERATE' | 'CARRY_TOKEN' | 'RETURN_TOKEN' | 'INTERRUPT_GATE' | 'OBSERVE_CLOSED_GATE' | 'CLOSE_GATE' | 'INSPECT'; caseId: SummoningMasterCaseId }
  | { type: 'PREPARE'; caseId: SummoningMasterCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'RETURN_GUEST'; caseId: SummoningMasterCaseId; method: 'GATE' | 'ORDINARY' }
  | { type: 'WAIT'; caseId: SummoningMasterCaseId; seconds: 10 | 40 }
  | { type: 'REST_GUEST' }
  | { type: 'REFLECT' }
  | { type: 'BUY_PAPERS' }
  | { type: 'PREPARE_PAPER'; paperId: string };
export interface SummoningMasterLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SummoningMasterActivityCommand }
export interface SummoningMasterLifeProjection {
  title: string; story: string; environment: string; activeCase: SummoningMasterCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: SummoningMasterGuestLocation; playerTravelMetres: number; partner: SummoningMasterPartner;
  gate: SummoningMasterLifeState['gate']; token: SummoningMasterLifeState['token']; ada: SummoningMasterLifeState['ada']; shutter: SummoningMasterLifeState['shutter'];
  currentAttempt: SummoningMasterAttempt | null;
  cases: { id: SummoningMasterCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: SummoningMasterAttempt[] }[];
  inheritedPapers: WitchKingPaper[]; actions: SummoningMasterLifeAction[];
}

export const SUMMONING_MASTER_PARTNER_SOURCE = '原创G：由原巫王导师格蕾丝提供可核联系方式、原居SM3-GLASS-ROOM的成年独立低强灵界生物流灯；其有限实体与原声片原已存在，非玩家创造或所有，不是旧动物、免费天使或可替换灵库。';
export const SUMMONING_MASTER_LIFE_STORY = '原创G有限实践：观察、准备、实施、报告各1行动；准备须至少余2行动。三报告各扮演25，反思25；成功报告只给对应新能力掌握8。全部子步骤0行动但实际耗时、移动；门40秒，门断不删除已通过的原身体。失败本次不重骰，普通原路仍可完成和退出。';
const CASES = [
  { id: 'source-visit', title: '原居处与一位真实来客', story: '从小石院沿30米原小径到玻璃暖房，实际见同一流灯及其自有声片，再问本次是否愿意来访。核对约定的双环微光与三声短鸣。有限门只连这两地，不复制身体，也不以高位馈赠为常规能力。', facts: ['开门6灵性、知识18，本次只试一次；门40秒。每次真实过门实耗来客6精力。', '普通接送走同一30米原小径；若拒绝，只在原居处核实来源并尊重其决定。'] },
  { id: 'original-token', title: '艾达的同一块二百克牌', story: '39岁成年人艾达本人在原小石院，同意后才借出她唯一200克测试牌。流灯在本次同意内协助将原牌递到3米外原桌；失败由本人亲手普通搬运，不变出新牌。', facts: ['协助3灵性、来客8精力、知识16，只试一次；流灯不能承人、治疗或复制原物。', '先亲手还同一原牌给艾达，再送同体回HOME、关门、本人沿普通路径回院。'] },
  { id: 'interrupted-door', title: '门断以后仍在场的原身体', story: '事先告知流灯和艾达本次低强遮挡演示。流灯到院后，本人放下同一原遮板使门断连。它仍是原身体、仍在YARD且无伤；本次必须沿已知30米普通小径陪送回暖房。', facts: ['此案练撤离，本次不重开门。已关闭或从未成功建立的门只能记录实情，不能伪造召唤成功。', '门失效不删除已过门者；检视原声片、本人再走30米回小院才能退出。'] },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 3;
const freshCase = (): SummoningMasterCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const freshAttempt = (week: number, method: 'ABILITY' | 'ORDINARY'): SummoningMasterAttempt => ({ week, method, closed: false, result: 'NONE', elapsedSeconds: 0, ownerTravelMetres: 0, guestTravelMetres: 0, homeVisits: 0, consent: 'UNASKED', consentWeek: null, ownerConsent: false, gateTier: null, cooperationTier: null, guestArrived: false, arrivalMethod: null, identityChecked: false, tokenTaken: false, tokenDelivered: false, tokenReturned: false, guestAtTable: false, interruptionObserved: false, gateInterrupted: false, guestReturned: false, inspected: false, spiritualitySpent: 0, guestStaminaSpent: 0 });
export function createSummoningMasterLifeState(): SummoningMasterLifeState {
  return { partner: { id: 'SM3-LUMEN', name: '流灯', source: SUMMONING_MASTER_PARTNER_SOURCE, adult: true, independentMind: true, bodyId: 'SM3-LUMEN-BODY', homeId: 'SM3-GLASS-ROOM', location: 'HOME', health: 100, mind: 100, stamina: 100, status: 'ALIVE', willing: true, metWeek: null, ordinaryDistanceM: 0, gateCrossings: 0, chime: { id: 'SM3-CHIME', owner: 'SM3-LUMEN' }, restHistory: [] },
    activeCase: null, playerLocation: 'YARD', playerTravelMetres: 0, clockSeconds: 0, gate: { status: 'CLOSED', remainingSeconds: 0, from: 'HOME', to: 'YARD' },
    token: { id: 'SM3-TEST-TOKEN', owner: 'SM3-ADA39', massGrams: 200, custodian: 'SM3-ADA39', location: 'OWNER' },
    ada: { id: 'SM3-ADA39', name: '艾达', age: 39, alive: true, willing: true, location: 'YARD' }, shutter: { id: 'SM3-SHUTTER', location: 'RAISED' }, tableId: 'SM3-TABLE',
    cases: { 'source-visit': freshCase(), 'original-token': freshCase(), 'interrupted-door': freshCase() }, reflected: false };
}
/** The sole authoritative original body, shared with combat, never a mutable copy. */
export const getSummoningMasterPartner = (s: SliceState): SummoningMasterPartner => s.summoningMaster.life.partner;
export function moveSummoningMasterPartner(s: SliceState, location: SummoningMasterGuestLocation): void {
  const p = getSummoningMasterPartner(s); if (p.status !== 'ALIVE' || p.health <= 0) throw new Error('死亡原身体不能移动、召回或替换。'); p.location = location;
}
/** Only the known, open, no-pursuit original route; never returns a corpse or the player. */
export function returnSummoningMasterGuestOrdinarily(s: SliceState): number {
  const p = getSummoningMasterPartner(s); if (p.status !== 'ALIVE' || p.health <= 0 || p.location === 'HOME') return 0;
  p.location = 'PATH'; p.ordinaryDistanceM += 30; s.summoningMaster.life.clockSeconds += 30; p.location = 'HOME'; return 30;
}
export const hasSummoningMasterLifeLock = (s: SliceState): boolean => {
  const l = s.summoningMaster.life;
  return l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED') || l.playerLocation !== 'YARD' || l.token.location !== 'OWNER' || l.gate.status === 'OPEN';
};
export const summoningMasterInside = hasSummoningMasterLifeLock;
const currentAttempt = (s: SliceState): SummoningMasterAttempt | null => { const l = s.summoningMaster.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
function elapse(s: SliceState, a: SummoningMasterAttempt, seconds: number) {
  const l = s.summoningMaster.life; a.elapsedSeconds += seconds; l.clockSeconds += seconds;
  if (l.gate.status === 'OPEN') { l.gate.remainingSeconds = Math.max(0, l.gate.remainingSeconds - seconds); if (!l.gate.remainingSeconds) l.gate.status = 'EXPIRED'; }
}
function walkPlayer(s: SliceState, a: SummoningMasterAttempt, location: 'HOME' | 'YARD') {
  const l = s.summoningMaster.life; l.playerLocation = 'PATH'; l.playerTravelMetres += 30; a.ownerTravelMetres += 30; elapse(s, a, 30); l.playerLocation = location;
}
function setResult(s: SliceState, id: SummoningMasterCaseId, value: 'ABILITY' | 'ORDINARY') { const r = s.summoningMaster.life.cases[id]; r.result = value; r.attempts.at(-1)!.result = value; }
const caseCommands = ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'VISIT_HOME', 'CONSENT', 'REVOKE_CONSENT', 'RETURN_PLAYER', 'OPEN_GATE', 'INVITE_GUEST', 'FETCH_GUEST', 'VERIFY_GUEST', 'CONSENT_OWNER', 'BORROW_TOKEN', 'COOPERATE', 'CARRY_TOKEN', 'RETURN_TOKEN', 'INTERRUPT_GATE', 'OBSERVE_CLOSED_GATE', 'CLOSE_GATE', 'INSPECT'];
export function validateSummoningMasterActivityCommand(v: unknown): v is SummoningMasterActivityCommand {
  if (!record(v)) return false;
  if (['REFLECT', 'REST_GUEST', 'BUY_PAPERS'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_PAPER') return shape(v, ['type', 'paperId']) && typeof v.paperId === 'string' && /^WK4-PAPER-[1-9]\d*-[123]$/.test(v.paperId);
  if (!SUMMONING_MASTER_CASE_IDS.includes(v.caseId as SummoningMasterCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'RETURN_GUEST') return shape(v, ['type', 'caseId', 'method']) && ['GATE', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WAIT') return shape(v, ['type', 'caseId', 'seconds']) && [10, 40].includes(v.seconds as number);
  return shape(v, ['type', 'caseId']) && caseCommands.includes(String(v.type));
}
export const isSummoningMasterActivityCommand = validateSummoningMasterActivityCommand;
export const isSummoningMasterActivity = validateSummoningMasterActivityCommand;
const currentConsent = (s: SliceState, a: SummoningMasterAttempt): boolean => a.consent === 'GRANTED' && a.consentWeek === s.week && s.summoningMaster.life.partner.willing && s.summoningMaster.life.partner.status === 'ALIVE';
function cleanupBlock(s: SliceState, id: SummoningMasterCaseId): string | null {
  const l = s.summoningMaster.life, r = l.cases[id], a = r.attempts.at(-1);
  return !r.contactOpen || !a ? '没有本项尚未结束的原现场。' : l.gate.status === 'OPEN' ? '先关闭有限门；关闭不会搬回原身体。' : l.token.location !== 'OWNER' ? '先把同一200克原牌还给艾达。' : l.playerLocation !== 'YARD' ? '本人须沿普通30米原路实际回到小院出口。' : a.guestArrived && !a.guestReturned ? '先实际送同一来客回HOME；不能用关闭删除来客。' : !a.inspected ? '先检查原身体、原声片与归还状态。' : null;
}
export function blockSummoningMasterLife(s: SliceState, c: SummoningMasterActivityCommand): string | null {
  if (!validateSummoningMasterActivityCommand(c)) return '召唤大师生活命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且已经成为召唤大师3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在原玻璃暖房和小石院所在地。';
  if (['READY', 'FIGHTING'].includes(s.summoningMaster.encounter.status)) return '先结束原石院遭遇。';
  const l = s.summoningMaster.life, p = l.partner, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return cleanupBlock(s, c.caseId);
  const atScene = !!r?.contactOpen && l.activeCase === ('caseId' in c ? c.caseId : null) && !!a && !a.closed;
  if (atScene && a && 'caseId' in c) {
    if (c.type === 'CLOSE_GATE') return l.gate.status === 'OPEN' ? null : '门已不连通，不能反复关闭刷取结果。';
    if (c.type === 'RETURN_TOKEN') return c.caseId === 'original-token' && a.tokenTaken && !a.tokenReturned && l.token.location !== 'OWNER' && l.playerLocation === 'YARD' ? null : '须本人在小院，亲手取还本次实际借出的同一原牌。';
    if (c.type === 'RETURN_PLAYER') return l.playerLocation === 'HOME' ? null : '本人当前不在原暖房；不能凭按钮移动未走过的身体。';
    if (c.type === 'RETURN_GUEST') {
      if (!a.guestArrived || a.guestReturned || p.location !== 'YARD' || p.status !== 'ALIVE' || l.playerLocation !== 'YARD') return '须本人和同一活着的来客实际在小院，尚未完成本次返程。';
      if (l.token.location !== 'OWNER') return '先把同一原牌还给艾达。';
      if (c.method === 'GATE' && c.caseId === 'interrupted-door') return '本案明确练普通撤离，须沿原30米小径送回。';
      if (c.method === 'GATE') return l.gate.status !== 'OPEN' || l.gate.remainingSeconds < (a.guestAtTable ? 5 : 2) || p.stamina < 6 || !currentConsent(s, a) ? '同门返程需仍连通、足够真实秒数、本次同意和6精力；普通返程永远不需灵性或精力。' : null;
      return null;
    }
    if (c.type === 'REVOKE_CONSENT') return a.consent === 'GRANTED' ? null : '本次没有仍有效的来客同意。';
    if (c.type === 'INSPECT') return a.inspected ? '本次原物与返程已检查。' : l.gate.status === 'OPEN' || l.token.location !== 'OWNER' || a.guestArrived && !a.guestReturned ? '先关门、归还原牌并实际送来客回HOME。' : null;
    if (s.health <= 0 || s.mind <= 0) return '当前身心不足；普通返程、还牌、关门、检查和退出仍可0行动完成。';
    if (a.inspected || a.guestReturned) return '本次已完成收束，只能本人返回、检查并结束，不能重新召入。';
    if (c.type === 'WAIT') return l.gate.status === 'OPEN' ? null : '只有仍连通的本次门可等待其实际消逝。';
    if (c.type === 'VISIT_HOME') return l.playerLocation === 'YARD' && p.location === 'HOME' && p.status === 'ALIVE' && a.homeVisits < 2 && !a.guestArrived ? null : '须原活来客仍在HOME；本人沿原30米小径前往，不造新灵或重置来客。';
    if (c.type === 'CONSENT') return a.homeVisits > 0 && l.playerLocation === 'HOME' && p.location === 'HOME' && p.metWeek !== null && a.consent === 'UNASKED' ? null : '须本次实际到原居处见过同一成年独立来客，再询问本次有限邀请。';
    if (c.type === 'CONSENT_OWNER') return c.caseId !== 'source-visit' && !a.ownerConsent && l.playerLocation === 'YARD' && l.ada.alive && l.ada.willing ? null : '须当面取得原39岁艾达对本次原牌或低强遮挡演示的同意。';
    if (c.type === 'OPEN_GATE') return a.method !== 'ABILITY' || a.gateTier !== null || a.result !== 'NONE' || a.guestArrived ? '本次只能尝试一次开门，失败或已完成后不重骰。' : !currentConsent(s, a) || p.location !== 'HOME' || l.playerLocation !== 'YARD' ? '须本次来客同意，原身体仍HOME，本人已普通走回YARD。' : c.caseId === 'interrupted-door' && !a.ownerConsent ? '先告知艾达并取得本次低强演示同意。' : s.spirituality < 6 ? '有限开门需要6灵性；可以沿普通原路接送。' : null;
    if (c.type === 'INVITE_GUEST') return !currentConsent(s, a) || l.gate.status !== 'OPEN' || l.gate.remainingSeconds < 2 || p.location !== 'HOME' || l.playerLocation !== 'YARD' || a.guestArrived || p.stamina < 6 ? '须本次有效同意和连通门，原来客HOME且至少6精力；不足可普通接送。' : null;
    if (c.type === 'FETCH_GUEST') return !currentConsent(s, a) || l.playerLocation !== 'HOME' || p.location !== 'HOME' || a.guestArrived ? '须本人已沿普通路到HOME，来客对本次同行仍自愿。' : null;
    if (c.type === 'VERIFY_GUEST') return a.identityChecked || p.status !== 'ALIVE' || l.playerLocation !== p.location || !(a.guestArrived || ['DECLINED', 'REVOKED'].includes(a.consent)) ? '须当面检查同一原声片和约定两项特征；拒绝来访时就在原居处核对，不强行召来。' : null;
    if (c.type === 'BORROW_TOKEN') return c.caseId === 'original-token' && a.ownerConsent && l.ada.willing && !a.tokenTaken && l.token.location === 'OWNER' && l.playerLocation === 'YARD' ? null : '须艾达本次同意，本人在院，借同一原牌一次。';
    if (c.type === 'COOPERATE') return c.caseId !== 'original-token' || a.method !== 'ABILITY' || a.cooperationTier !== null || !a.tokenTaken || a.tokenDelivered || a.tokenReturned ? '须本次已借原牌且选择能力，本次协助仅尝试一次。' : !currentConsent(s, a) || !a.guestArrived || p.location !== 'YARD' || l.playerLocation !== 'YARD' || !l.ada.willing ? '須本次同意仍有效、同一来客已真实到院；否则本人可普通搬运。' : p.stamina < 8 || s.spirituality < 3 ? '协助需要3灵性和原来客8精力；不足可普通搬同牌。' : null;
    if (c.type === 'CARRY_TOKEN') return c.caseId === 'original-token' && a.tokenTaken && !a.tokenDelivered && !a.tokenReturned && l.playerLocation === 'YARD' ? null : '须本人在院，亲手把本次未交付的原牌搬到3米外原桌。';
    if (c.type === 'INTERRUPT_GATE') return c.caseId === 'interrupted-door' && a.ownerConsent && currentConsent(s, a) && a.guestArrived && p.location === 'YARD' && l.playerLocation === 'YARD' && l.gate.status === 'OPEN' && !a.interruptionObserved ? null : '须两位原参与者本次知情同意，同体已在院且原门仍连通。';
    if (c.type === 'OBSERVE_CLOSED_GATE') return c.caseId === 'interrupted-door' && a.ownerConsent && !a.interruptionObserved && l.playerLocation === 'YARD' && l.gate.status !== 'OPEN' && (a.guestArrived || ['DECLINED', 'REVOKED'].includes(a.consent)) ? null : '须门确实未开启或已失效，再记录真实普通退路，不伪造成功召唤。';
    return '当前须按可见原物继续本次有限步骤，或实际返还后退出。';
  }
  if (hasSummoningMasterLifeLock(s) && !(r?.status === 'PREPARED' && c.type === 'PERFORM')) return '先实施或取消已付准备，或收束当前现场。';
  if (hasWitchKingLifeLock(s) || Object.values(s.witchKing.life.cases).some(x => x.status === 'PREPARED') || s.witchKing.ritual.playerLocation === 'HALL' || ['READY', 'FIGHTING'].includes(s.witchKing.encounter.status) || s.summoningMaster.preparedWeek !== null) return '先实际结束旧现场、旧准备或晋升准备。';
  if (c.type === 'BUY_PAPERS' || c.type === 'PREPARE_PAPER') return blockWitchKingLife(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身心。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REST_GUEST') return p.status !== 'ALIVE' || p.health <= 0 || p.location !== 'HOME' ? '只可给已独立回HOME的同一活来客安排休息，不能复活死亡原身体。' : s.week <= (p.restHistory.at(-1)?.week ?? s.summoningMaster.promotionWeek ?? s.week) ? '上次休息或晋升后须跨过一实际周，不能同周刷恢复。' : p.stamina === 100 && p.mind === 100 ? '原精力和精神已满，无须花钱重复休息。' : s.cash < 30 ? '明确休息需1行动和30便士，不回复健康。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已经完成。' : SUMMONING_MASTER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知原实践。';
  const index = SUMMONING_MASTER_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本项原实践已报告，不能重置原人原物或刷成长。';
  if (index > 0 && l.cases[SUMMONING_MASTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先报告前一项真实实践。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原来源和退出路线。' : r.attempts.at(-1)?.week === s.week ? '同次成本与失败保留，下一真实周才可新准备。' : s.actionsRemaining < 2 ? '准备须至少余2行动，留1行动实际实施；返还子步骤均0行动。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先完成实际结果、真实返还、检查并退出。';
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && r.method !== null ? null : '先准备本次原实践。';
  return '没有本次正在进行的原现场。';
}
export const blockSummoningMasterActivity = blockSummoningMasterLife;

export function applySummoningMasterActivity(s: SliceState, c: SummoningMasterActivityCommand, ctx: SeerContext): void {
  const reason = blockSummoningMasterLife(s, c); if (reason) throw new Error(reason);
  const l = s.summoningMaster.life, p = l.partner;
  if (c.type === 'BUY_PAPERS' || c.type === 'PREPARE_PAPER') { applyWitchKingActivity(s, c, ctx); return; }
  if (c.type === 'REST_GUEST') {
    s.actionsRemaining--; s.cash -= 30; const rest: SummoningMasterGuestRest = { week: s.week, paidPennies: 30, staminaBefore: p.stamina, staminaAfter: Math.min(100, p.stamina + 30), mindBefore: p.mind, mindAfter: Math.min(100, p.mind + 10), healthUnchanged: p.health };
    p.stamina = rest.staminaAfter; p.mind = rest.mindAfter; p.restHistory.push(rest);
    ctx.note('原暖房里的一次真实休息', `1行动、30便士已付，原流灯仍在HOME；精力${rest.staminaBefore}→${rest.staminaAfter}、精神${rest.mindBefore}→${rest.mindAfter}，健康${p.health}不变。下一实际周以前不能重复。`); return;
  }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('来客有自己的身体、原物与选择', '三次原实践都已真实收束，G扮演+25。原门只是有限连接；来客不是所有物、免费天使或可重置资源。'); return; }
  const r = l.cases[c.caseId], definition = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动取消，已付准备不退，未开门、不移动来客、不产生新物。'); return; }
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(definition.title, definition.story + definition.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(definition.title, `已付1行动准备${c.method === 'ABILITY' ? '有限能力实践' : '普通真实对照'}，尚未替来客表示同意。至少保留1行动供实际实施，随后返还均0行动。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.returned = false; r.result = 'NONE'; r.attempts.push(freshAttempt(s.week, r.method!)); l.activeCase = c.caseId; l.gate.status = 'CLOSED'; l.gate.remainingSeconds = 0; l.shutter.location = 'RAISED'; ctx.note(definition.title, '已付1行动进入本次小院现场；接下来亲自沿30米原路去HOME见同一来客、询问当前同意。未自动召唤或补资源。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r.result === 'ABILITY') { const id = c.caseId === 'original-token' ? 'moon.s3.guest-cooperation' : 'moon.s3.bounded-summoning'; s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } ctx.note(definition.title, `同一原身体、原牌、原声片及实际退出已核实；G扮演+25。${r.result === 'ABILITY' ? '本次成功对应新能力掌握+8。' : '普通结果不授能力掌握。'}已付成本和失败记录保留。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; a.closed = true; a.consent = 'CLOSED'; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('实际结束原现场', '本人已在小院出口；原牌归艾达、来客若曾到院则已实际回HOME，门不再连通。0行动结束，不退款、不修伤、不恢复精力，失败本次不重骰。'); return; }
  switch (c.type) {
    case 'VISIT_HOME': walkPlayer(s, a, 'HOME'); a.homeVisits++; p.metWeek ??= s.week; ctx.note('沿原小径到玻璃暖房', '本人普通走30米、实耗30秒，实际见到原流灯和它自己的SM3-CHIME。两项约定特征是双环微光与三声短鸣；尚未取得本次邀请。'); return;
    case 'CONSENT': a.consent = p.willing && p.status === 'ALIVE' ? 'GRANTED' : 'DECLINED'; a.consentWeek = s.week; elapse(s, a, 2); ctx.note('询问同一来客本次意愿', a.consent === 'GRANTED' ? `原流灯当面同意这一次${c.caseId === 'original-token' ? '不超过200克原牌的有限协助' : c.caseId === 'interrupted-door' ? '低强遮挡和普通撤离演示' : '有限来访及身份核验'}。同意只覆盖本次，可退出，不是所有权或以后战斗许可。` : '原流灯拒绝这次邀请。身体仍HOME，灵性精力均不扣；尊重拒绝，本人可普通核实来源、搬原牌或检查未开的门。'); return;
    case 'REVOKE_CONSENT': a.consent = 'REVOKED'; elapse(s, a, 1); ctx.note('本次合作同意已撤回', '不再施加邀请或协助；若同体已经到院，仍留当前位置，依原先约定可普通送回。'); return;
    case 'RETURN_PLAYER': walkPlayer(s, a, 'YARD'); ctx.note('本人实际走回小石院', '沿同一30米原小径普通返回，实际30秒、0行动0灵性；未顺带搬动仍在原居处的来客。'); return;
    case 'CONSENT_OWNER': a.ownerConsent = true; elapse(s, a, 2); ctx.note('艾达当面对本次用途表示同意', `原39岁艾达同意本次${c.caseId === 'original-token' ? '借出自己唯一200克测试牌并归还' : '低强遮挡与普通撤离演示'}，不涵盖以后用途。`); return;
    case 'OPEN_GATE': s.spirituality -= 6; a.spiritualitySpent += 6; a.gateTier = ctx.check('knowledge', 18).tier; elapse(s, a, 1); if (success(a.gateTier)) { l.gate.status = 'OPEN'; l.gate.remainingSeconds = 40; } ctx.note(success(a.gateTier) ? '本次有限原门实际建立' : '本次开门失败', success(a.gateTier) ? '实耗6灵性；门只连HOME与YARD，持续40秒G。原流灯仍HOME，须明确邀请才会真实过门。' : '6灵性照耗，门未连通、原身体仍HOME。本次不重骰；可以本人沿原路接送或普通完成。'); return;
    case 'INVITE_GUEST': p.stamina -= 6; a.guestStaminaSpent += 6; p.gateCrossings++; moveSummoningMasterPartner(s, 'YARD'); a.guestArrived = true; a.arrivalMethod = 'GATE'; elapse(s, a, 2); ctx.note('同一原身体真实过门', '原流灯由HOME到YARD，精力−6；它自己的同一声片随身。HOME不留下副本，门以后失效也不会删除这具已过门的身体。'); return;
    case 'FETCH_GUEST': moveSummoningMasterPartner(s, 'PATH'); p.ordinaryDistanceM += 30; a.guestTravelMetres += 30; walkPlayer(s, a, 'YARD'); moveSummoningMasterPartner(s, 'YARD'); a.guestArrived = true; a.arrivalMethod = 'ORDINARY'; ctx.note('本人沿普通原路陪同来客到院', '双方实际走同一30米小径、实耗30秒。没有召唤成功、灵性成本或免费复制；同一声片跟随同体。'); return;
    case 'VERIFY_GUEST': a.identityChecked = true; elapse(s, a, 4); if (c.caseId === 'source-visit') setResult(s, c.caseId, a.arrivalMethod === 'GATE' && success(a.gateTier) ? 'ABILITY' : 'ORDINARY'); ctx.note('核对同一原来客和原声片', '实际当面核实原SM3-CHIME、约定双环微光与三声短鸣。只有同一原身体，没有遥测全知或制造新生命。'); return;
    case 'BORROW_TOKEN': a.tokenTaken = true; l.token.custodian = 'PLAYER'; l.token.location = 'YARD'; elapse(s, a, 2); ctx.note('亲手接过唯一原测试牌', '原SM3-TEST-TOKEN仍归SM3-ADA39，质量200克；仅本次借用，原声片仍属于流灯。'); return;
    case 'COOPERATE': s.spirituality -= 3; a.spiritualitySpent += 3; p.stamina -= 8; a.guestStaminaSpent += 8; a.cooperationTier = ctx.check('knowledge', 16).tier; elapse(s, a, 6); if (success(a.cooperationTier)) { l.token.custodian = 'TABLE'; l.token.location = 'TABLE'; a.tokenDelivered = true; a.guestAtTable = true; p.ordinaryDistanceM += 3; a.guestTravelMetres += 3; setResult(s, c.caseId, 'ABILITY'); } ctx.note(success(a.cooperationTier) ? '同体递送同一原牌三米' : '本次原牌协助失败', success(a.cooperationTier) ? '实耗3灵性、原来客8精力和6秒，流灯带同一200克原牌走3米，放在SM3-TABLE；没有复制或凭空搬人。' : '实耗3灵性、原来客8精力和6秒；同牌仍由本人保管，效果0，本次不能重骰，仍可亲手普通搬运。'); return;
    case 'CARRY_TOKEN': l.token.custodian = 'TABLE'; l.token.location = 'TABLE'; a.tokenDelivered = true; l.playerTravelMetres += 6; a.ownerTravelMetres += 6; elapse(s, a, 6); setResult(s, c.caseId, 'ORDINARY'); ctx.note('本人普通搬同牌到三米外原桌', '亲手携同一200克原牌走3米放下，再走3米回院中；实际6米6秒，不把普通完成算能力成功。'); return;
    case 'RETURN_TOKEN': { const metres = l.token.location === 'TABLE' ? 6 : 0; l.playerTravelMetres += metres; a.ownerTravelMetres += metres; elapse(s, a, Math.max(2, metres)); l.token.location = 'OWNER'; l.token.custodian = 'SM3-ADA39'; a.tokenReturned = true; ctx.note('亲手把同一原牌还给艾达', `本人${metres ? '实际往返原桌6米取回' : '从手中交回'}同一SM3-TEST-TOKEN，原所有权和200克质量不变。原牌已还，现在才能送回原来客。`); return; }
    case 'INTERRUPT_GATE': l.shutter.location = 'LOWERED'; l.gate.status = 'BROKEN'; l.gate.remainingSeconds = 0; a.interruptionObserved = true; a.gateInterrupted = true; elapse(s, a, 2); setResult(s, c.caseId, a.arrivalMethod === 'GATE' ? 'ABILITY' : 'ORDINARY'); ctx.note('放下原遮板，原门断连', '实际2秒，门已BROKEN。同一流灯仍YARD、健康精神不变、原声片仍随身；接下来必须普通30米陪送，不许删除身体或无限重开门。'); return;
    case 'OBSERVE_CLOSED_GATE': l.shutter.location = 'LOWERED'; a.interruptionObserved = true; elapse(s, a, 2); setResult(s, c.caseId, 'ORDINARY'); ctx.note('检查实际未连通的门和原退路', '记录门未开启或已经失效，不能假称成功中断召唤。原遮板放下；同体若在院，仍沿普通30米原路送回。'); return;
    case 'RETURN_GUEST': {
      if (a.guestAtTable) { p.ordinaryDistanceM += 3; a.guestTravelMetres += 3; a.guestAtTable = false; elapse(s, a, 3); }
      if (c.method === 'GATE') { p.stamina -= 6; a.guestStaminaSpent += 6; p.gateCrossings++; moveSummoningMasterPartner(s, 'HOME'); elapse(s, a, 2); }
      else { const distance = returnSummoningMasterGuestOrdinarily(s); a.guestTravelMetres += distance; a.elapsedSeconds += distance; l.playerLocation = 'HOME'; l.playerTravelMetres += distance; a.ownerTravelMetres += distance; if (l.gate.status === 'OPEN') { l.gate.remainingSeconds = Math.max(0, l.gate.remainingSeconds - distance); if (!l.gate.remainingSeconds) l.gate.status = 'EXPIRED'; } }
      a.guestReturned = true; ctx.note('同一来客与原声片实际回HOME', c.method === 'GATE' ? '原身体通过仍连通的同一门回HOME，另耗6精力与2秒；本人仍YARD，接下来关闭门。' : '本人陪同沿原30米普通小径走回HOME，实耗30秒、0灵性0精力0行动。原伤势成本不恢复；本人还须普通走回小院出口。'); return;
    }
    case 'CLOSE_GATE': l.gate.status = 'CLOSED'; l.gate.remainingSeconds = 0; elapse(s, a, 1); ctx.note('实际关闭本次原门', '仅断开HOME与YARD的连接，不搬回或删除任何已经通过的原身体，资源也不退款。'); return;
    case 'WAIT': elapse(s, a, c.seconds); ctx.note('本次门的真实时间经过', `实际等待${c.seconds}秒；剩余${l.gate.remainingSeconds}秒，门${l.gate.status}。原来客仍在${p.location}，不因过期消失。`); return;
    case 'INSPECT': a.inspected = true; elapse(s, a, 2); ctx.note('检查本次返还和同一声片', `原牌在艾达手中，原门不连通；原流灯${p.location}、H${p.health}/M${p.mind}/精力${p.stamina}，SM3-CHIME仍归同一来客。本人${l.playerLocation}，只有本人实际回到YARD才能结束现场。`); return;
  }
}

export function summoningMasterLifeActions(s: SliceState): SummoningMasterLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.summoningMaster.life, out: SummoningMasterLifeAction[] = [];
  const add = (label: string, cost: string, command: SummoningMasterActivityCommand) => { const reason = blockSummoningMasterLife(s, command); out.push({ id: `SM3:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'seconds' in command ? `:${command.seconds}` : ''}${'paperId' in command ? `:${command.paperId}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const { id: caseId } of CASES) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add('观察原来源与实际退路', '1行动', { type: 'OBSERVE', caseId });
    else if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(method === 'ABILITY' ? '准备有限门与协作' : '准备普通真实对照', '1行动 · 须至少余2行动', { type: 'PREPARE', caseId, method });
    else if (r.status === 'PREPARED') { add('进入本次小院实践', '1行动 · 随后各步骤0行动', { type: 'PERFORM', caseId }); add('取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId }); }
    else if (r.status === 'EXAMINED') add('报告实际结果和真实归还', '1行动 · 扮演25 · 成功能力掌握8', { type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    add('本人沿原小径去暖房见流灯', '0行动 · 实际30米30秒', { type: 'VISIT_HOME', caseId });
    add('当面询问来客本次意愿', '0行动 · 2秒 · 同意仅此一次', { type: 'CONSENT', caseId });
    add('撤回本次合作同意', '0行动 · 1秒 · 身体仍在实际位置', { type: 'REVOKE_CONSENT', caseId });
    add('本人沿原路走回小院', '0行动 · 实际30米30秒', { type: 'RETURN_PLAYER', caseId });
    if (caseId !== 'source-visit') add('当面取得艾达本次同意', '0行动 · 2秒', { type: 'CONSENT_OWNER', caseId });
    if (r.method === 'ABILITY') add('尝试本次有限召唤之门', '0行动 · 6灵性 · 知识18 · 1秒 · 成功门40秒 · 仅一次', { type: 'OPEN_GATE', caseId });
    add('邀请同一来客实际过门', '0行动 · 来客6精力 · 2秒 · 同体HOME→YARD', { type: 'INVITE_GUEST', caseId });
    add('陪同来客沿普通小径到院', '0行动 · 双方实际30米30秒 · 不扣精力', { type: 'FETCH_GUEST', caseId });
    add('核对原声片和约定两项特征', '0行动 · 4秒 · 当面核对原身体', { type: 'VERIFY_GUEST', caseId });
    if (caseId === 'original-token') {
      add('从艾达手中借同一原牌', '0行动 · 2秒 · 原牌200克', { type: 'BORROW_TOKEN', caseId });
      if (r.method === 'ABILITY') add('请求来客递同一原牌到原桌', '0行动 · 3灵性 · 来客8精力 · 知识16 · 3米6秒 · 仅一次', { type: 'COOPERATE', caseId });
      add('本人普通搬同一原牌到原桌', '0行动 · 普通往返6米6秒', { type: 'CARRY_TOKEN', caseId });
      add('亲手把同一原牌还给艾达', '0行动 · 原桌取还6米6秒或手中交还2秒', { type: 'RETURN_TOKEN', caseId });
    }
    if (caseId === 'interrupted-door') { add('放下原遮板中断仍连通的门', '0行动 · 2秒 · 来客仍YARD且无伤', { type: 'INTERRUPT_GATE', caseId }); add('记录原门未连通和普通退路', '0行动 · 2秒 · 不冒称成功召唤', { type: 'OBSERVE_CLOSED_GATE', caseId }); }
    add('沿同一门送原来客回HOME', '0行动 · 另6精力2秒 · 来回过门合计12精力 · 桌边先走3米', { type: 'RETURN_GUEST', caseId, method: 'GATE' });
    add('陪同原来客沿普通小径回HOME', '0行动 · 0灵性0精力 · 双方30米30秒 · 本人另走回院', { type: 'RETURN_GUEST', caseId, method: 'ORDINARY' });
    add('实际关闭本次有限门', '0行动 · 1秒 · 不搬动原身体', { type: 'CLOSE_GATE', caseId });
    for (const seconds of [10, 40] as const) add(`实际等待${seconds}秒`, '0行动 · 耗尽40秒门即失效 · 已过门身体不消失', { type: 'WAIT', caseId, seconds });
    add('检查原声片、原牌与真实返程', '0行动 · 2秒', { type: 'INSPECT', caseId });
    add('结束本次现场', '0行动 · 先物返、人返、关门、检查', { type: 'CLOSE', caseId });
    add('结束并退出本次实践', '0行动 · 不退款 · 不代替真实返回', { type: 'WITHDRAW', caseId });
  }
  add('为HOME的原来客安排休息', '1行动 · 30便士 · 跨实际周 · 精力+30/精神+10 · 不治健康', { type: 'REST_GUEST' });
  add('购买三张不同原月光纸', '1行动 · 60便士 · 沿旧来源与库存', { type: 'BUY_PAPERS' });
  for (const paper of s.witchKing.life.papers.filter(x => x.status === 'HELD')) add(`准备原月光纸 ${paper.id}`, '1行动 · 3灵性 · 沿旧唯一原纸', { type: 'PREPARE_PAPER', paperId: paper.id });
  if (!l.reflected) add('回看原身体、同意和有限门', '1行动 · 三报告后扮演25', { type: 'REFLECT' });
  return out;
}
export function projectSummoningMasterLife(s: SliceState): SummoningMasterLifeProjection {
  const l = s.summoningMaster.life;
  return { title: '召唤大师与一位真实来客', story: SUMMONING_MASTER_LIFE_STORY, environment: '原创G：SM3-GLASS-ROOM原暖房 ↔ 30米普通小径 ↔ SM3-YARD小石院；原桌距院中3米。来客只有同一有限实体，原声片随其身体。', activeCase: l.activeCase, inside: hasSummoningMasterLifeLock(s), insideCase: hasSummoningMasterLifeLock(s), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, partner: structuredClone(l.partner), gate: { ...l.gate }, token: { ...l.token }, ada: { ...l.ada }, shutter: { ...l.shutter }, currentAttempt: structuredClone(currentAttempt(s)), inheritedPapers: s.witchKing.life.papers.map(x => ({ ...x })),
    cases: CASES.map(x => { const r = l.cases[x.id]; return { id: x.id, title: x.title, story: x.story, observations: r.observedWeek === null ? [] : [...x.facts], status: r.status, method: r.method, result: r.attempts.length ? r.result === 'NONE' ? '尚未完成，真实成本和失败已保留。' : r.result === 'ABILITY' ? '本次有限能力实际成功。' : '本次由普通实际路径完成。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: summoningMasterLifeActions(s) };
}
export function validateSummoningMasterPartner(v: unknown, promotionWeek: number | null = null, week = Number.MAX_SAFE_INTEGER): v is SummoningMasterPartner {
  const initial = createSummoningMasterLifeState().partner;
  if (!record(v) || !shape(v, Object.keys(initial)) || v.id !== initial.id || v.name !== initial.name || v.source !== SUMMONING_MASTER_PARTNER_SOURCE || v.bodyId !== initial.bodyId || v.homeId !== initial.homeId || v.adult !== true || v.independentMind !== true || !['HOME', 'YARD', 'PATH'].includes(String(v.location)) || !['ALIVE', 'DEAD'].includes(String(v.status)) || !integer(v.health, 0, 100) || !integer(v.mind, 0, 100) || !integer(v.stamina, 0, 100) || (v.status === 'DEAD') !== (v.health === 0) || v.status === 'DEAD' && v.location !== 'YARD' || typeof v.willing !== 'boolean' || !integer(v.ordinaryDistanceM) || !integer(v.gateCrossings) || v.metWeek !== null && !integer(v.metWeek, promotionWeek ?? 1, week) || !record(v.chime) || !shape(v.chime, ['id', 'owner']) || v.chime.id !== 'SM3-CHIME' || v.chime.owner !== 'SM3-LUMEN' || !Array.isArray(v.restHistory)) return false;
  let last = promotionWeek ?? 0;
  for (const x of v.restHistory) {
    if (!record(x) || !shape(x, ['week', 'paidPennies', 'staminaBefore', 'staminaAfter', 'mindBefore', 'mindAfter', 'healthUnchanged']) || !integer(x.week, last + 1, week) || x.paidPennies !== 30 || !integer(x.staminaBefore, 0, 100) || !integer(x.staminaAfter, 0, 100) || x.staminaAfter !== Math.min(100, x.staminaBefore + 30) || !integer(x.mindBefore, 0, 100) || !integer(x.mindAfter, 0, 100) || x.mindAfter !== Math.min(100, x.mindBefore + 10) || !integer(x.healthUnchanged, 1, 100) || x.staminaBefore === 100 && x.mindBefore === 100) return false;
    last = x.week;
  }
  return true;
}
export function validateSummoningMasterLife(s: SliceState): boolean {
  const l = s.summoningMaster?.life, initial = createSummoningMasterLifeState(), promotion = s.summoningMaster?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, SUMMONING_MASTER_CASE_IDS) || !record(l.gate) || !shape(l.gate, Object.keys(initial.gate)) || !record(l.token) || !shape(l.token, Object.keys(initial.token)) || !record(l.ada) || !shape(l.ada, Object.keys(initial.ada)) || !record(l.shutter) || !shape(l.shutter, Object.keys(initial.shutter))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || !validateSummoningMasterPartner(l.partner, promotion, s.week) || !['HOME', 'YARD', 'PATH'].includes(l.playerLocation) || !integer(l.playerTravelMetres) || !integer(l.clockSeconds) || l.activeCase !== null && !SUMMONING_MASTER_CASE_IDS.includes(l.activeCase) || typeof l.reflected !== 'boolean' || l.tableId !== 'SM3-TABLE') return false;
  if (l.gate.from !== 'HOME' || l.gate.to !== 'YARD' || !['CLOSED', 'OPEN', 'BROKEN', 'EXPIRED'].includes(l.gate.status) || !integer(l.gate.remainingSeconds, 0, 40) || (l.gate.status === 'OPEN') !== (l.gate.remainingSeconds > 0) || l.token.id !== 'SM3-TEST-TOKEN' || l.token.owner !== 'SM3-ADA39' || l.token.massGrams !== 200 || !['OWNER', 'YARD', 'TABLE'].includes(l.token.location) || l.token.custodian !== (l.token.location === 'OWNER' ? 'SM3-ADA39' : l.token.location === 'TABLE' ? 'TABLE' : 'PLAYER') || l.ada.id !== 'SM3-ADA39' || l.ada.name !== '艾达' || l.ada.age !== 39 || l.ada.location !== 'YARD' || typeof l.ada.alive !== 'boolean' || typeof l.ada.willing !== 'boolean' || l.shutter.id !== 'SM3-SHUTTER' || !['RAISED', 'LOWERED'].includes(l.shutter.location)) return false;
  let open = 0, prepared = 0, resolved = 0, playerMetres = 0, guestMetres = 0, seconds = 0, gateCrossings = 0;
  for (const [index, id] of SUMMONING_MASTER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || index > 0 && l.cases[SUMMONING_MASTER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let lastWeek = r.observedWeek - 1;
    for (const [n, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(1, 'ORDINARY'))) || !integer(a.week, lastWeek + 1, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !['UNASKED', 'GRANTED', 'DECLINED', 'REVOKED', 'CLOSED'].includes(a.consent) || !integer(a.elapsedSeconds) || !integer(a.ownerTravelMetres) || !integer(a.guestTravelMetres) || !integer(a.homeVisits, 0, 2) || !integer(a.spiritualitySpent, 0, 9) || !integer(a.guestStaminaSpent, 0, 20)) return false;
      for (const key of ['closed', 'ownerConsent', 'guestArrived', 'identityChecked', 'tokenTaken', 'tokenDelivered', 'tokenReturned', 'guestAtTable', 'interruptionObserved', 'gateInterrupted', 'guestReturned', 'inspected'] as const) if (typeof a[key] !== 'boolean') return false;
      if (a.consentWeek !== null && a.consentWeek !== a.week || a.consent === 'UNASKED' && a.consentWeek !== null || !['UNASKED', 'CLOSED'].includes(a.consent) && (a.consentWeek === null || a.homeVisits < 1) || a.gateTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.gateTier) || a.cooperationTier !== null && !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(a.cooperationTier)) return false;
      if (a.spiritualitySpent !== (a.gateTier !== null ? 6 : 0) + (a.cooperationTier !== null ? 3 : 0) || a.gateTier !== null && (a.method !== 'ABILITY' || !a.homeVisits || a.consentWeek === null) || a.cooperationTier !== null && (id !== 'original-token' || a.method !== 'ABILITY' || !a.guestArrived || !a.tokenTaken)) return false;
      if (a.arrivalMethod !== null && !['GATE', 'ORDINARY'].includes(a.arrivalMethod) || a.guestArrived !== (a.arrivalMethod !== null) || a.arrivalMethod === 'GATE' && !success(a.gateTier) || a.guestReturned && !a.guestArrived || a.guestAtTable && (!success(a.cooperationTier) || a.guestReturned) || a.tokenReturned && !a.tokenTaken || a.tokenDelivered && !a.tokenTaken || a.tokenTaken && (!a.ownerConsent || id !== 'original-token') || a.interruptionObserved && (id !== 'interrupted-door' || !a.ownerConsent) || a.gateInterrupted && (!a.interruptionObserved || !a.guestArrived || !success(a.gateTier))) return false;
      const baseStamina = (a.arrivalMethod === 'GATE' ? 6 : 0) + (a.cooperationTier !== null ? 8 : 0);
      if (a.guestStaminaSpent !== baseStamina && !(a.guestReturned && id !== 'interrupted-door' && a.guestStaminaSpent === baseStamina + 6)) return false;
      if (a.result === 'ABILITY' && (id === 'source-visit' ? !a.identityChecked || a.arrivalMethod !== 'GATE' : id === 'original-token' ? !success(a.cooperationTier) || !a.tokenDelivered : !a.gateInterrupted || a.arrivalMethod !== 'GATE') || a.result === 'ORDINARY' && (id === 'source-visit' ? !a.identityChecked : id === 'original-token' ? !a.tokenDelivered : !a.interruptionObserved)) return false;
      if (a.closed && (!a.inspected || a.consent !== 'CLOSED' || a.guestArrived && !a.guestReturned || a.tokenTaken && !a.tokenReturned) || !a.closed && (n !== r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.result !== 'NONE') return false;
      if (a.ownerTravelMetres < a.homeVisits * 30 || a.elapsedSeconds < a.ownerTravelMetres || a.arrivalMethod === 'ORDINARY' && a.guestTravelMetres < 30 || a.guestReturned && id === 'interrupted-door' && a.guestTravelMetres < 30) return false;
      lastWeek = a.week; playerMetres += a.ownerTravelMetres; guestMetres += a.guestTravelMetres; seconds += a.elapsedSeconds; gateCrossings += (a.arrivalMethod === 'GATE' ? 1 : 0) + (a.guestStaminaSpent > baseStamina ? 1 : 0);
    }
    const a = r.attempts.at(-1);
    if (r.closes !== r.attempts.filter(x => x.closed).length || r.result !== (a?.result ?? 'NONE')) return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen || a?.week === s.week) return false; }
    if (r.status === 'ACTIVE') { open++; if (!r.contactOpen || l.activeCase !== id || !a || a.closed || a.week !== s.week || a.method !== r.method || s.status !== 'ACTIVE' || s.combat || s.activeEvent || s.world.city !== 'BACKLUND') return false; }
    else if (r.contactOpen) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.returned || !a?.closed || r.result === 'NONE' || r.method !== a.method)) return false;
    if (r.status === 'RESOLVED') resolved++;
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || l.playerTravelMetres < playerMetres || l.partner.ordinaryDistanceM < guestMetres || l.partner.gateCrossings < gateCrossings || l.clockSeconds < seconds || l.reflected && resolved !== 3) return false;
  if (!open && (l.playerLocation !== 'YARD' || l.token.location !== 'OWNER' || l.gate.status === 'OPEN')) return false;
  if (open) {
    const a = currentAttempt(s)!;
    if (l.gate.status === 'OPEN' && (!success(a.gateTier) || a.gateInterrupted) || l.token.location !== 'OWNER' && (l.activeCase !== 'original-token' || !a.tokenTaken || a.tokenReturned) || a.tokenTaken && !a.tokenReturned && l.token.location === 'OWNER' || a.guestArrived && !a.guestReturned && l.partner.location !== 'YARD' || a.guestReturned && l.partner.location !== 'HOME') return false;
  }
  const hasHistory = s.progression.pathwayId === 'moon' && [3, 2].includes(s.progression.sequence ?? 0);
  return !hasHistory || (s.progression.sequence === 2 ? s.lifeGiver.summoningMasterActingAtPromotion : s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
