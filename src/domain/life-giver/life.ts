import type { PublicCheckResult, PublicResolutionTier } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { getSummoningMasterPartner, hasSummoningMasterLifeLock, validateSummoningMasterPartner, type SummoningMasterPartner, type SummoningMasterGuestLocation } from '../summoning-master/life.js';
import { applyWitchKingActivity, blockWitchKingLife, hasWitchKingLifeLock, type WitchKingPaper } from '../witch-king/life.js';

export const LIFE_GIVER_CASE_IDS = ['tired-guest', 'withdrawn-consent', 'interrupted-link'] as const;
export type LifeGiverCaseId = typeof LIFE_GIVER_CASE_IDS[number];
export type LifeGiverSupportId = 'moon.s2.bounded-vitality' | 'moon.s2.shared-shelter';
const VITALITY: LifeGiverSupportId = 'moon.s2.bounded-vitality', SHELTER: LifeGiverSupportId = 'moon.s2.shared-shelter';
export const LIFE_GIVER_BEAD_SOURCE = '原创G：持照商店原有的独立月光珠，每粒60便士；一次有限媒介，用后留下同一耗尽原珠，不是生命、灵魂、无限材料或原著配方。';
export interface LifeGiverBead {
  id: string; source: string; paidPennies: 60; preparedWeek: number; purpose: 'LIFE' | 'COMBAT'; caseId: LifeGiverCaseId | null;
  status: 'READY' | 'SPENT'; location: 'PLAYER' | 'RETURN_TRAY' | 'YARD'; spentWeek: number | null; combatRound: number | null; abilityId: LifeGiverSupportId | null;
}
export interface LifeGiverAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; consent: 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'CLOSED'; ownerConsent: boolean;
  visited: boolean; originChecked: boolean; arrived: boolean; guestReturned: boolean; guestOffsetMetres: 0 | 2; tokenTaken: boolean; tokenDelivered: boolean; tokenBack: boolean; tokenReturned: boolean;
  guestTrips: number; ordinaryCompleted: boolean; revoked: boolean; obstructionObserved: boolean; cleared: boolean; inspected: boolean;
  vitalityTier: PublicResolutionTier | null; shelterTier: PublicResolutionTier | null; vitalityRestored: number; shelterApplied: boolean;
  shelterStatus: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED'; shelterRemainingSeconds: number;
  elapsedSeconds: number; playerTravelMetres: number; guestTravelMetres: number; guestStaminaSpent: number; spiritualitySpent: number; playerHealthSpent: number;
  guestBefore: SummoningMasterPartner; guestAfter: SummoningMasterPartner | null;
}
export interface LifeGiverCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; closes: number; withdrawals: number; attempts: LifeGiverAttempt[];
}
export type LifeGiverActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'VISIT_HOME' | 'CHECK_GUEST_ORIGIN' | 'CONSENT' | 'REVOKE_CONSENT' | 'FETCH_GUEST' | 'RETURN_PLAYER' | 'CONSENT_OWNER' | 'REVOKE_OWNER' | 'BORROW_TOKEN' | 'GUEST_CARRY' | 'CARRY_TOKEN' | 'VITALITY' | 'SHELTER' | 'STOP_SHELTER' | 'BLOCK_PATH' | 'CLEAR_PATH' | 'RETURN_TOKEN' | 'RETURN_GUEST' | 'RETURN_BEADS' | 'INSPECT'; caseId: LifeGiverCaseId }
  | { type: 'PREPARE'; caseId: LifeGiverCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WAIT'; caseId: LifeGiverCaseId; seconds: 5 | 15 }
  | { type: 'REST_GUEST' | 'REFLECT' | 'PREPARE_BATTLE_BEAD' | 'BUY_PAPERS' }
  | { type: 'PREPARE_PAPER'; paperId: string };
export interface LifeGiverResources { health: number; mind: number; spirituality: number; cash: number; actionsRemaining: number }
export interface LifeGiverLifeRecord {
  week: number; command: LifeGiverActivityCommand; before: LifeGiverResources; after: LifeGiverResources; knowledge: number; check: PublicCheckResult | null;
  guestBefore: SummoningMasterPartner; guestAfter: SummoningMasterPartner;
}
export interface LifeGiverLifeState {
  /** Immutable historical checkpoint, not a second current body. The sole mutable body stays in summoningMaster.life.partner. */
  initialGuestAnchor: SummoningMasterPartner | null; ledger: LifeGiverLifeRecord[];
  activeCase: LifeGiverCaseId | null; playerLocation: SummoningMasterGuestLocation; playerTravelMetres: number; clockSeconds: number;
  owner: { id: 'LG2-MIRA41'; name: '米拉'; age: 41; alive: true; willing: true; location: 'YARD' };
  token: { id: 'LG2-MIRA-TOKEN'; owner: 'LG2-MIRA41'; massGrams: 200; custodian: 'LG2-MIRA41' | 'PLAYER' | 'TABLE'; location: 'OWNER' | 'START' | 'TABLE' };
  tableId: 'LG2-TABLE'; shutter: { id: 'LG2-SHUTTER'; location: 'RAISED' | 'LOWERED' };
  beads: LifeGiverBead[]; cases: Record<LifeGiverCaseId, LifeGiverCaseState>; reflected: boolean;
}
export interface LifeGiverLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LifeGiverActivityCommand }
export interface LifeGiverLifeProjection {
  title: string; story: string; environment: string; inside: boolean; insideCase: boolean; activeCase: LifeGiverCaseId | null; playerLocation: SummoningMasterGuestLocation;
  playerTravelMetres: number; clockSeconds: number; partner: SummoningMasterPartner; owner: LifeGiverLifeState['owner']; token: LifeGiverLifeState['token']; shutter: LifeGiverLifeState['shutter'];
  currentAttempt: LifeGiverAttempt | null; beads: LifeGiverBead[]; inheritedPapers: WitchKingPaper[]; reflected: boolean;
  cases: { id: LifeGiverCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; attempts: LifeGiverAttempt[] }[];
  actions: LifeGiverLifeAction[];
}
export const LIFE_GIVER_LIFE_STORY = '创生者只有名称编号已核；完整配方、仪式与具体能力未知。以下全部为原创G：同一活来客实际疲劳且当次同意才可支援。每案观察、准备、实施、报告各1行动；能力准备另付120便士取得两粒不同原珠，每项一次。活力6灵性/知识18至多恢复12精力；共担4灵性/知识18只开15秒窗口，下一次真实低强搬运才使来客耗8→3、本人实扣5健康。没有健康治疗、回灵、复活、变性或创造生命。三报告各扮演25，反思25；实际新能力效果成功才对应掌握+8，每案每项最多奖励一次。';
const CASES = [
  { id: 'tired-guest', title: '疲劳与有限恢复', story: '当面询问流灯当前意愿，普通陪同原身体从原HOME沿30米小径到院。41岁成年米拉另行同意后借出唯一200克原牌；同一来客实际搬到2米外原桌再搬回，各耗8精力，才有真实疲劳可以支援。', facts: ['原HOME、同一身体和原声片不变；原召唤大师历史位置冻结。', '活力每案仅试一次，6灵性和一粒60便士原珠失败照耗；成功至多恢复12精力，健康精神不变。', '共担每案仅试一次；预告下一次实际搬运本人健康−5，未应用不扣健康也不给掌握。'] },
  { id: 'withdrawn-consent', title: '撤回以后停止支援', story: '相同的原流灯到场后，明确撤回本次同意。原身体留实际位置；不得继续支援或强迫搬运，由本人普通搬同一原牌、归还米拉，再沿原路陪送来客。', facts: ['来客同意与物主同意分别取得、分别可撤回。', '撤回立即结束共担窗口；已付原珠与灵性不退款。普通返还从不要求继续同意施术。'] },
  { id: 'interrupted-link', title: '受阻后清路与返还', story: '在两位参与者当前同意下放下本次唯一原遮板LG2-SHUTTER，真实阻断2米搬运路径并停止窗口。明确检查阻挡后亲手清路，不能重抽本次技能，再以普通路径归还同一原物与原来客。', facts: ['成功开共担窗口本身不等于实际分担；阻断后未实际应用不给掌握。', '放下和清开原遮板各2秒。活来客普通回HOME、本人普通回YARD、同一珠归托盘后才能结束。'] },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const succeeded = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 2;
const freshCase = (): LifeGiverCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, contactOpen: false, result: 'NONE', closes: 0, withdrawals: 0, attempts: [] });
export function createLifeGiverLifeState(): LifeGiverLifeState {
  return { initialGuestAnchor: null, ledger: [], activeCase: null, playerLocation: 'YARD', playerTravelMetres: 0, clockSeconds: 0,
    owner: { id: 'LG2-MIRA41', name: '米拉', age: 41, alive: true, willing: true, location: 'YARD' },
    token: { id: 'LG2-MIRA-TOKEN', owner: 'LG2-MIRA41', massGrams: 200, custodian: 'LG2-MIRA41', location: 'OWNER' }, tableId: 'LG2-TABLE', shutter: { id: 'LG2-SHUTTER', location: 'RAISED' },
    beads: [], cases: { 'tired-guest': freshCase(), 'withdrawn-consent': freshCase(), 'interrupted-link': freshCase() }, reflected: false };
}
const freshAttempt = (s: SliceState, method: 'ABILITY' | 'ORDINARY'): LifeGiverAttempt => ({ week: s.week, method, closed: false, consent: 'UNASKED', ownerConsent: false,
  visited: false, originChecked: false, arrived: false, guestReturned: false, guestOffsetMetres: 0, tokenTaken: false, tokenDelivered: false, tokenBack: false, tokenReturned: false, guestTrips: 0, ordinaryCompleted: false,
  revoked: false, obstructionObserved: false, cleared: false, inspected: false, vitalityTier: null, shelterTier: null, vitalityRestored: 0, shelterApplied: false, shelterStatus: 'NONE', shelterRemainingSeconds: 0,
  elapsedSeconds: 0, playerTravelMetres: 0, guestTravelMetres: 0, guestStaminaSpent: 0, spiritualitySpent: 0, playerHealthSpent: 0, guestBefore: structuredClone(getSummoningMasterPartner(s)), guestAfter: null });
export const getLifeGiverGuest = getSummoningMasterPartner;
export const hasLifeGiverLifeLock = (s: SliceState): boolean => { const l = s.lifeGiver.life; return l.activeCase !== null || Object.values(l.cases).some(r => r.status === 'PREPARED' || r.contactOpen) || l.playerLocation !== 'YARD' || l.token.location !== 'OWNER' || l.beads.some(b => b.purpose === 'LIFE' && b.location === 'PLAYER'); };
export const lifeGiverInside = hasLifeGiverLifeLock;
const currentAttempt = (s: SliceState): LifeGiverAttempt | null => { const l = s.lifeGiver.life; return l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null; };
export const lifeGiverLifeAnchor = (s: SliceState): string => stableStringify({ initialGuestAnchor: s.lifeGiver.life.initialGuestAnchor, ledger: s.lifeGiver.life.ledger });
export function returnLifeGiverGuestOrdinarily(s: SliceState): number {
  const p = getLifeGiverGuest(s); if (p.status !== 'ALIVE' || p.health <= 0 || p.location === 'HOME') return 0;
  p.location = 'PATH'; p.ordinaryDistanceM += 30; s.lifeGiver.life.clockSeconds += 30; p.location = 'HOME'; return 30;
}
function stop(a: LifeGiverAttempt) { if (a.shelterStatus === 'ACTIVE') { a.shelterStatus = 'STOPPED'; a.shelterRemainingSeconds = 0; } }
function elapse(s: SliceState, a: LifeGiverAttempt, seconds: number) { s.lifeGiver.life.clockSeconds += seconds; a.elapsedSeconds += seconds;
  if (a.shelterStatus === 'ACTIVE') { a.shelterRemainingSeconds = Math.max(0, a.shelterRemainingSeconds - seconds); if (a.shelterRemainingSeconds === 0) a.shelterStatus = 'EXPIRED'; } }
function walk(s: SliceState, a: LifeGiverAttempt, target: 'HOME' | 'YARD') { const l = s.lifeGiver.life; l.playerLocation = 'PATH'; l.playerTravelMetres += 30; a.playerTravelMetres += 30; elapse(s, a, 30); l.playerLocation = target; }
const consent = (s: SliceState, a: LifeGiverAttempt) => a.consent === 'GRANTED' && a.week === s.week && getLifeGiverGuest(s).willing && getLifeGiverGuest(s).status === 'ALIVE' && getLifeGiverGuest(s).mind > 0;
const resources = (s: SliceState): LifeGiverResources => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actionsRemaining: s.actionsRemaining });
function addBead(s: SliceState, purpose: 'LIFE' | 'COMBAT', caseId: LifeGiverCaseId | null): LifeGiverBead { const bead: LifeGiverBead = { id: `LG2-BEAD-${s.lifeGiver.life.beads.length + 1}`, source: LIFE_GIVER_BEAD_SOURCE, paidPennies: 60, preparedWeek: s.week,
  purpose, caseId, status: 'READY', location: 'PLAYER', spentWeek: null, combatRound: null, abilityId: null }; s.lifeGiver.life.beads.push(bead); return bead; }
export const getLifeGiverPreparedBattleBeads = (s: SliceState): LifeGiverBead[] => s.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT' && b.status === 'READY' && b.location === 'PLAYER');
function spendBead(s: SliceState, b: LifeGiverBead, ability: LifeGiverSupportId, round: number | null): void {
  if (!s.lifeGiver.life.beads.includes(b) || b.status !== 'READY' || b.location !== 'PLAYER') throw new Error('须消耗实际付费且仍在本人手中的同一原珠。');
  b.status = 'SPENT'; b.spentWeek = s.week; b.combatRound = round; b.abilityId = ability;
}
export function consumeLifeGiverBattleBead(s: SliceState, round: number, ability: LifeGiverSupportId): LifeGiverBead | null {
  if (!integer(round, 1) || ![VITALITY, SHELTER].includes(ability)) throw new Error('原珠使用的回合与能力无效。');
  const b = getLifeGiverPreparedBattleBeads(s)[0]; if (!b) return null; spendBead(s, b, ability, round); return b;
}
export function returnLifeGiverBattleBeads(s: SliceState): void { for (const b of s.lifeGiver.life.beads) if (b.purpose === 'COMBAT' && b.location === 'PLAYER') b.location = 'RETURN_TRAY'; }
export function leaveLifeGiverBattleBeadsOnDeath(s: SliceState): void { for (const b of s.lifeGiver.life.beads) if (b.purpose === 'COMBAT' && b.location === 'PLAYER') b.location = 'YARD'; }
export function validateLifeGiverBead(v: unknown, week = Number.MAX_SAFE_INTEGER): v is LifeGiverBead {
  if (!record(v) || !shape(v, ['id','source','paidPennies','preparedWeek','purpose','caseId','status','location','spentWeek','combatRound','abilityId']) || typeof v.id !== 'string' || !/^LG2-BEAD-[1-9]\d*$/.test(v.id) || v.source !== LIFE_GIVER_BEAD_SOURCE || v.paidPennies !== 60 || !integer(v.preparedWeek, 1, week) || !['LIFE','COMBAT'].includes(String(v.purpose)) || !['READY','SPENT'].includes(String(v.status)) || !['PLAYER','RETURN_TRAY','YARD'].includes(String(v.location))) return false;
  if (v.purpose === 'LIFE' ? !LIFE_GIVER_CASE_IDS.includes(v.caseId as LifeGiverCaseId) || v.combatRound !== null : v.caseId !== null) return false;
  return v.status === 'READY' ? v.spentWeek === null && v.combatRound === null && v.abilityId === null : integer(v.spentWeek, v.preparedWeek, week) && [VITALITY,SHELTER].includes(v.abilityId as LifeGiverSupportId) && (v.purpose === 'LIFE' ? v.combatRound === null : integer(v.combatRound, 1));
}
const caseCommands = ['OBSERVE','PERFORM','REPORT','CLOSE','WITHDRAW','VISIT_HOME','CHECK_GUEST_ORIGIN','CONSENT','REVOKE_CONSENT','FETCH_GUEST','RETURN_PLAYER','CONSENT_OWNER','REVOKE_OWNER','BORROW_TOKEN','GUEST_CARRY','CARRY_TOKEN','VITALITY','SHELTER','STOP_SHELTER','BLOCK_PATH','CLEAR_PATH','RETURN_TOKEN','RETURN_GUEST','RETURN_BEADS','INSPECT'];
export function validateLifeGiverActivityCommand(v: unknown): v is LifeGiverActivityCommand {
  if (!record(v)) return false;
  if (['REST_GUEST','REFLECT','PREPARE_BATTLE_BEAD','BUY_PAPERS'].includes(String(v.type))) return shape(v,['type']);
  if (v.type === 'PREPARE_PAPER') return shape(v,['type','paperId']) && typeof v.paperId === 'string' && /^WK4-PAPER-[1-9]\d*-[123]$/.test(v.paperId);
  if (!LIFE_GIVER_CASE_IDS.includes(v.caseId as LifeGiverCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v,['type','caseId','method']) && ['ABILITY','ORDINARY'].includes(String(v.method));
  if (v.type === 'WAIT') return shape(v,['type','caseId','seconds']) && [5,15].includes(v.seconds as number);
  return shape(v,['type','caseId']) && caseCommands.includes(String(v.type));
}
export const isLifeGiverActivityCommand = validateLifeGiverActivityCommand;
export const isLifeGiverActivity = validateLifeGiverActivityCommand;
/** Call once on the actual successful promotion, after retaining the original S3 state. */
export function initializeLifeGiverLife(s: SliceState): void {
  const l = s.lifeGiver.life;
  if (l.initialGuestAnchor !== null) return;
  if (l.ledger.length || l.beads.length) throw new Error('创生者历史来源必须在首次生活或准备以前固定。');
  l.initialGuestAnchor = structuredClone(getLifeGiverGuest(s));
}
const readyLifeBead = (s: SliceState, id: LifeGiverCaseId) => s.lifeGiver.life.beads.find(b => b.purpose === 'LIFE' && b.caseId === id && b.status === 'READY' && b.location === 'PLAYER');
function cleanupBlock(s: SliceState, id: LifeGiverCaseId): string | null {
  const l = s.lifeGiver.life, a = l.cases[id].attempts.at(-1);
  if (!a || !l.cases[id].contactOpen) return '没有本项正在进行的现场。';
  if (l.token.location !== 'OWNER') return '先亲手把同一原牌还给米拉。';
  if (a.shelterStatus === 'ACTIVE') return '先停止本次共担窗口；不会返还已耗成本。';
  if (a.arrived && !a.guestReturned || a.guestOffsetMetres !== 0) return '先沿原路实际送同一原来客回HOME。';
  if (l.playerLocation !== 'YARD') return '本人还须实际沿30米原路回YARD。';
  if (l.beads.some(b => b.purpose === 'LIFE' && b.location === 'PLAYER')) return '先亲手把本案同一未用或耗尽原珠放回托盘，不退款。';
  if (l.shutter.location !== 'RAISED') return '先亲手清开本次原遮板。';
  return a.inspected ? null : '先检查原身体、原声片、原物和真实返程。';
}
export function blockLifeGiverLife(s: SliceState, c: LifeGiverActivityCommand): string | null {
  if (!validateLifeGiverActivityCommand(c)) return '创生者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE') return '须本人仍活着并已晋为月亮2创生者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原HOME和小院。';
  if (s.lifeGiver.encounter.approachWeek !== null) return '接触本次原对手后，生活、珠准备和旧资源补给关闭；先处理实际遭遇。';
  const l = s.lifeGiver.life, p = getLifeGiverGuest(s), r = 'caseId' in c ? l.cases[c.caseId] : null, a = r?.attempts.at(-1) ?? null;
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return l.playerLocation === 'YARD' ? null : '本人须实际在YARD归还同一预备原珠。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return cleanupBlock(s,c.caseId);
  if (r?.contactOpen && a && 'caseId' in c && l.activeCase === c.caseId) {
    if (c.type === 'STOP_SHELTER') return a.shelterStatus === 'ACTIVE' ? null : '没有仍有效的本次共担窗口。';
    if (c.type === 'REVOKE_CONSENT') return a.consent === 'GRANTED' ? null : '本次没有仍有效的来客同意。';
    if (c.type === 'REVOKE_OWNER') return a.ownerConsent ? null : '本次没有仍有效的米拉同意。';
    if (c.type === 'CLEAR_PATH') return l.shutter.location === 'LOWERED' && l.playerLocation === 'YARD' ? null : '只有实际放下的本次原遮板可以亲手清开。';
    if (c.type === 'RETURN_TOKEN' && l.token.location === 'TABLE' && l.shutter.location === 'LOWERED') return '同一原牌在桌上且2米原路受阻，须先亲手清开原遮板再取还。';
    if (c.type === 'RETURN_TOKEN') return a.tokenTaken && !a.tokenReturned && l.playerLocation === 'YARD' && l.token.location !== 'OWNER' ? null : '须本人实际在院，取还本次已经借出的同一原牌。';
    if (c.type === 'RETURN_PLAYER') return l.playerLocation === 'HOME' ? null : '本人尚未在原HOME，不能凭按钮免费改位置。';
    if (c.type === 'RETURN_GUEST') return !a.arrived || a.guestReturned || l.playerLocation !== 'YARD' || p.location !== 'YARD' || p.status !== 'ALIVE' ? '须本人及本次已到院的同一活来客仍在YARD。' : l.token.location !== 'OWNER' || l.shutter.location !== 'RAISED' ? '先归还原牌并清开普通返程路线。' : null;
    if (c.type === 'RETURN_BEADS') return l.playerLocation === 'YARD' && l.beads.some(b => b.purpose === 'LIFE' && b.caseId === c.caseId && b.location === 'PLAYER') ? null : '须本人在YARD，亲手归还本案实际仍携带的同一原珠。';
    if (c.type === 'INSPECT') return a.inspected ? '本次已经检查。' : l.playerLocation !== 'YARD' || l.token.location !== 'OWNER' || a.arrived && !a.guestReturned || a.guestOffsetMetres || a.shelterStatus === 'ACTIVE' || l.shutter.location !== 'RAISED' || l.beads.some(b => b.purpose === 'LIFE' && b.location === 'PLAYER') ? '先完成原人、原牌、原珠的实际返还并停止窗口、清开原遮板。' : null;
    if (a.inspected || a.guestReturned) return '本次已经进入收束，只能普通返回、归还、检查和结束。';
    if (s.health <= 0 || s.mind <= 0) return '当前身心不足；普通返还、停止和退出仍可完成。';
    if (c.type === 'VISIT_HOME') return !a.visited && !a.arrived && l.playerLocation === 'YARD' && p.location === 'HOME' && p.status === 'ALIVE' ? null : '须尚未到访且原活来客实际仍在HOME。';
    if (c.type === 'CHECK_GUEST_ORIGIN') return !a.originChecked && l.playerLocation === p.location && (a.visited || p.status === 'DEAD') ? null : '须本人实际到同一原身体旁核实原声片与当前状态，不能复制或移动死亡者。';
    if (c.type === 'CONSENT') return a.visited && a.consent === 'UNASKED' && l.playerLocation === 'HOME' && p.location === 'HOME' ? null : '须本次当面见到同一来客，才能询问当前意愿。';
    if (c.type === 'FETCH_GUEST') return consent(s,a) && !a.arrived && l.playerLocation === 'HOME' && p.location === 'HOME' ? null : '须本人已到HOME，原来客对本次同行仍自愿。';
    if (c.type === 'CONSENT_OWNER') return !a.ownerConsent && !a.tokenTaken && l.playerLocation === 'YARD' && l.owner.alive && l.owner.willing ? null : '须当面对本次原牌用途取得米拉同意；借牌后不能再恢复撤回的同意。';
    if (c.type === 'BORROW_TOKEN') return a.ownerConsent && !a.tokenTaken && l.playerLocation === 'YARD' && l.token.location === 'OWNER' ? null : '须米拉本次同意，且同一原牌仍在她手中。';
    if (c.type === 'GUEST_CARRY') return !consent(s,a) || !a.ownerConsent || !a.arrived || p.location !== 'YARD' || l.playerLocation !== 'YARD' || l.shutter.location !== 'RAISED' ? '搬运须两位参与者当前同意、同体到场且2米原路畅通。' : !a.tokenTaken || a.tokenReturned || a.tokenBack || a.guestTrips >= 2 || a.ordinaryCompleted || (a.guestTrips === 0 ? l.token.location !== 'START' || a.guestOffsetMetres !== 0 : l.token.location !== 'TABLE' || a.guestOffsetMetres !== 2) ? '本次同牌最多去回各一次，须原牌和原身体实际在对应起点。' : p.stamina < (a.shelterStatus === 'ACTIVE' && a.shelterRemainingSeconds >= 2 && s.health > 5 ? 3 : 8) ? '原来客精力不足；本人可改普通搬运并实际归还。' : null;
    if (c.type === 'CARRY_TOKEN') return !a.ownerConsent || !a.tokenTaken || a.tokenReturned || a.tokenBack || a.ordinaryCompleted || l.playerLocation !== 'YARD' || l.shutter.location !== 'RAISED' ? '须原牌已借出、本人在YARD且原路畅通，实际普通完成这次搬运。' : null;
    if (c.type === 'VITALITY' || c.type === 'SHELTER') {
      if (a.method !== 'ABILITY' || (c.type === 'VITALITY' ? a.vitalityTier !== null : a.shelterTier !== null)) return '本案须选择能力且这项能力尚未尝试，失败后不重骰。';
      if (!consent(s,a) || !a.ownerConsent || !a.arrived || p.location !== 'YARD' || l.playerLocation !== 'YARD' || p.health <= 0 || l.shutter.location !== 'RAISED') return '须活着的同一原来客真实在2米内、两位当前同意且路径畅通。';
      if (!readyLifeBead(s,c.caseId)) return '须有本案实际付费、尚未使用且仍携带的同一原珠。';
      if (c.type === 'VITALITY') return p.stamina >= 100 ? '当前精力已满；不能创造疲劳记录或免费治疗。' : s.spirituality < 6 ? '活力支援实耗6灵性。' : null;
      return s.spirituality < 4 || s.health <= 10 ? '共担需4灵性且本人健康>10；下一次实际应用会实扣5健康。' : !a.tokenTaken || a.tokenReturned || a.tokenBack || a.ordinaryCompleted || a.guestTrips >= 2 ? '须仍有本次2米低强搬运可实际应用，共担不能空挂刷成长。' : null;
    }
    if (c.type === 'BLOCK_PATH') return c.caseId === 'interrupted-link' && !a.obstructionObserved && (consent(s,a) && a.arrived || a.originChecked && ['DECLINED','REVOKED'].includes(a.consent)) && a.ownerConsent && l.playerLocation === 'YARD' && l.shutter.location === 'RAISED' ? null : '仅本案在双方当次同意下实际放下同一原遮板一次。';
    if (c.type === 'WAIT') return a.shelterStatus === 'ACTIVE' ? null : '只有当前共担窗口可等待实际经过，不能空等刷恢复。';
    return '请按当前原人、原物的位置完成可见步骤或普通收束。';
  }
  if (hasLifeGiverLifeLock(s) && !(c.type === 'PERFORM' && r?.status === 'PREPARED')) return '先实施或取消本次准备，或实际收束当前现场。';
  if (hasSummoningMasterLifeLock(s) || hasWitchKingLifeLock(s) || s.summoningMaster.preparedWeek !== null || s.witchKing.ritual.playerLocation !== 'OUTSIDE' || ['READY','FIGHTING'].includes(s.summoningMaster.encounter.status)) return '先实际结束旧现场、旧准备和旧遭遇。';
  if (c.type === 'BUY_PAPERS') return blockWitchKingLife(s,{type:'BUY_PAPERS'});
  if (c.type === 'PREPARE_PAPER') return blockWitchKingLife(s,c);
  if (s.health <= 0 || s.mind <= 0) return '先休养本人身心。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REST_GUEST') return p.status !== 'ALIVE' || p.location !== 'HOME' || p.health <= 0 ? '仅可给已回原HOME的同一活来客安排休息，不能复活或治健康。' : s.week <= (p.restHistory.at(-1)?.week ?? s.summoningMaster.promotionWeek ?? s.week) ? '须比上次真实休息更晚一实际周。' : p.stamina === 100 && p.mind === 100 ? '原来客精力和精神已满，无须重复付费。' : s.cash < 30 ? '原居普通休息需要30便士。' : null;
  if (c.type === 'PREPARE_BATTLE_BEAD') return !l.reflected ? '先收束三案并反思，再另外购买有限战斗原珠。' : l.beads.filter(b => b.purpose === 'COMBAT').length >= 3 ? '本阶段最多另外准备三粒不同战斗原珠，不补回已耗珠。' : s.cash < 60 ? '一粒独立原珠需60便士。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '已经反思。' : LIFE_GIVER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先报告三个真实收束的案例。' : null;
  if (!r || !('caseId' in c)) return '没有此项当前实践。';
  if (r.status === 'RESOLVED') return '本案已经报告，不能重置原物刷成长。';
  const index = LIFE_GIVER_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[LIFE_GIVER_CASE_IDS[index-1]!].status !== 'RESOLVED') return '先报告前一项实践。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本案已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察真实来源与退出路线。' : a?.week === s.week ? '本次尝试的资源和失败保留，下一实际周才能重新准备。' : s.actionsRemaining < 2 ? '准备须至少余2行动，留1行动用于真实实施。' : c.method === 'ABILITY' && s.cash < 120 ? '能力准备需120便士购买两粒不同的60便士原珠；可选择普通方法。' : null;
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' || r.method === null ? '先准备本案。' : p.status === 'ALIVE' && p.location !== 'HOME' ? '同一活来客须实际在原HOME；不自动送回。死亡原体只能在实际YARD检查并走普通记录分支。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.result !== 'NONE' ? null : '先完成本案实际事项、原人原物返还与检查。';
  return '没有本项正在进行的现场。';
}
export const blockLifeGiverActivity = blockLifeGiverLife;
function updateResult(s: SliceState, id: LifeGiverCaseId) {
  const r = s.lifeGiver.life.cases[id], a = r.attempts.at(-1)!;
  const completed = (a.visited || a.originChecked) && a.tokenDelivered && a.tokenBack && (id === 'tired-guest' ? a.guestTrips === 2 || a.ordinaryCompleted : id === 'withdrawn-consent' ? (a.revoked || a.originChecked && a.consent === 'DECLINED') && a.ordinaryCompleted : a.obstructionObserved && a.cleared && a.ordinaryCompleted);
  r.result = completed ? a.vitalityRestored > 0 || a.shelterApplied ? 'ABILITY' : 'ORDINARY' : 'NONE';
}
function award(s: SliceState, id: LifeGiverSupportId, caseId: LifeGiverCaseId) {
  const earlier=s.lifeGiver.life.cases[caseId].attempts.slice(0,-1);
  if(earlier.some(a=>id===VITALITY?a.vitalityRestored>0:a.shelterApplied))return;
  s.progression.mastery[id] = Math.min(500,(s.progression.mastery[id] ?? 0)+8);
}
/** Shared transition for execution and semantic replay. External logging/RNG remain injected. */
function transition(s: SliceState, c: LifeGiverActivityCommand, ctx: SeerContext): void {
  const l = s.lifeGiver.life, p = getLifeGiverGuest(s);
  if (c.type === 'REST_GUEST') {
    s.actionsRemaining--; s.cash -= 30; const rest = { week: s.week, paidPennies: 30 as const, staminaBefore: p.stamina, staminaAfter: Math.min(100,p.stamina+30), mindBefore: p.mind, mindAfter: Math.min(100,p.mind+10), healthUnchanged: p.health };
    p.stamina = rest.staminaAfter; p.mind = rest.mindAfter; p.restHistory.push(rest); ctx.note('同一原来客在HOME付费休息',`1行动、30便士；精力${rest.staminaBefore}→${p.stamina}，精神${rest.mindBefore}→${p.mind}，健康${p.health}不变。`); return;
  }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting += 25; ctx.note('有限支援也须尊重同意与代价','三案真实收束，扮演+25；不凭报告制造能力成功或恢复原人原物。'); return; }
  if (c.type === 'PREPARE_BATTLE_BEAD') { s.actionsRemaining--; s.cash -= 60; const b = addBead(s,'COMBAT',null); ctx.note('实际准备一粒独立原珠',`1行动、60便士已付；${b.id}现为READY，最多另备三粒。使用即耗，同一耗尽珠仍须实际带回。`); return; }
  if (c.type === 'BUY_PAPERS' || c.type === 'PREPARE_PAPER') throw new Error('旧纸走唯一旧资源模块，不能并入生活重放复制原纸。');
  if (!('caseId' in c)) throw new Error('本案命令缺少caseId。');
  const r = l.cases[c.caseId], def = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(def.title,def.story+' '+def.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method;
    if (c.method === 'ABILITY') { s.cash -= 120; addBead(s,'LIFE',c.caseId); addBead(s,'LIFE',c.caseId); }
    ctx.note('本案真实准备',c.method === 'ABILITY' ? '1行动、120便士已付，取得两粒不同60便士原珠，各项最多一次；尚未替任何人同意。' : '1行动准备普通方法，不产生原珠或能力效果。'); return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { let returned = false;
    for (const b of l.beads) if (b.purpose === 'LIFE' && b.caseId === c.caseId && b.location === 'PLAYER') { b.location = 'RETURN_TRAY'; returned = true; }
    if (returned) l.clockSeconds += 2; r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消未实施的准备',`本人${returned ? '实耗2秒把同一原珠交回托盘；' : ''}已付行动与钱不退，没有新能力尝试或来客位移。`); return; }
  if (c.type === 'PERFORM') { s.actionsRemaining--; r.status = 'ACTIVE'; r.contactOpen = true; r.result = 'NONE'; r.attempts.push(freshAttempt(s,r.method!)); l.activeCase = c.caseId; ctx.note(def.title,'1行动进入本次有限现场。本人须实际前往30米外原HOME询问当次同意。'); return; }
  if (c.type === 'REPORT') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting += 25; ctx.note('报告已经发生的实际结果','扮演+25；原身体、声片、牌和珠均按原路真实归还。报告不再补发能力掌握。'); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.consent = 'CLOSED'; a.ownerConsent = false; a.guestAfter = structuredClone(p); r.contactOpen = false; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.activeCase = null; ctx.note('实际结束本次原现场','原来客已真实回HOME，本人回YARD，原牌归米拉，同一原珠在托盘；没有退款、治疗、复活或免费位移。'); return; }
  const beforeP = { health:p.health,mind:p.mind,stamina:p.stamina,location:p.location }, beforeH=s.health;
  switch(c.type) {
    case 'VISIT_HOME': walk(s,a,'HOME'); a.visited=true; break;
    case 'CHECK_GUEST_ORIGIN': a.originChecked=true;if(p.status==='DEAD'||!p.willing||p.mind<=0)a.consent='DECLINED';elapse(s,a,4);break;
    case 'CONSENT': a.consent=p.willing&&p.status==='ALIVE'&&p.mind>0?'GRANTED':'DECLINED'; elapse(s,a,2); break;
    case 'FETCH_GUEST': walk(s,a,'YARD'); p.location='YARD'; p.ordinaryDistanceM+=30; a.guestTravelMetres+=30; a.arrived=true; break;
    case 'RETURN_PLAYER': walk(s,a,'YARD'); break;
    case 'CONSENT_OWNER': a.ownerConsent=true; elapse(s,a,2); break;
    case 'REVOKE_OWNER': a.ownerConsent=false; stop(a); elapse(s,a,1); break;
    case 'REVOKE_CONSENT': a.consent='REVOKED'; a.revoked=true; stop(a); elapse(s,a,1); break;
    case 'BORROW_TOKEN': a.tokenTaken=true; l.token.location='START'; l.token.custodian='PLAYER'; elapse(s,a,2); break;
    case 'GUEST_CARRY': {
      const sharing=a.shelterStatus==='ACTIVE'&&a.shelterRemainingSeconds>=2&&s.health>5;
      const cost=sharing?3:8; p.stamina-=cost; a.guestStaminaSpent+=cost;
      if(sharing){s.health-=5;a.playerHealthSpent+=5;a.shelterApplied=true;a.shelterStatus='APPLIED';a.shelterRemainingSeconds=0;award(s,SHELTER,c.caseId);}
      a.guestTrips++; a.guestOffsetMetres=a.guestTrips===1?2:0; p.ordinaryDistanceM+=2;a.guestTravelMetres+=2;
      l.token.location=a.guestTrips===1?'TABLE':'START'; l.token.custodian=a.guestTrips===1?'TABLE':'PLAYER'; a.tokenDelivered=true; if(a.guestTrips===2)a.tokenBack=true; elapse(s,a,2); break;
    }
    case 'CARRY_TOKEN': { // The player walks 2 m out and 2 m back, carrying the same original; the guest is not moved.
      l.playerTravelMetres+=4;a.playerTravelMetres+=4;elapse(s,a,4);l.token.location='START';l.token.custodian='PLAYER';a.tokenDelivered=true;a.tokenBack=true;a.ordinaryCompleted=true;break;
    }
    case 'VITALITY': { spendBead(s,readyLifeBead(s,c.caseId)!,VITALITY,null);s.spirituality-=6;a.spiritualitySpent+=6;a.vitalityTier=ctx.check('knowledge',18).tier;
      if(succeeded(a.vitalityTier)){a.vitalityRestored=Math.min(12,100-p.stamina);p.stamina+=a.vitalityRestored;if(a.vitalityRestored>0)award(s,VITALITY,c.caseId);}elapse(s,a,1);break;
    }
    case 'SHELTER': { spendBead(s,readyLifeBead(s,c.caseId)!,SHELTER,null);s.spirituality-=4;a.spiritualitySpent+=4;a.shelterTier=ctx.check('knowledge',18).tier;elapse(s,a,1);
      a.shelterStatus=succeeded(a.shelterTier)?'ACTIVE':'FAILED';a.shelterRemainingSeconds=succeeded(a.shelterTier)?15:0;break;
    }
    case 'STOP_SHELTER': stop(a);elapse(s,a,1);break;
    case 'WAIT': elapse(s,a,c.seconds);break;
    case 'BLOCK_PATH': l.shutter.location='LOWERED';a.obstructionObserved=true;stop(a);elapse(s,a,2);break;
    case 'CLEAR_PATH': l.shutter.location='RAISED';a.cleared=true;elapse(s,a,2);break;
    case 'RETURN_TOKEN': { const distance=l.token.location==='TABLE'?4:0;l.playerTravelMetres+=distance;a.playerTravelMetres+=distance;elapse(s,a,distance||2);l.token.location='OWNER';l.token.custodian='LG2-MIRA41';a.tokenReturned=true;stop(a);break; }
    case 'RETURN_GUEST': {
      stop(a);if(a.guestOffsetMetres){p.ordinaryDistanceM+=2;a.guestTravelMetres+=2;elapse(s,a,2);a.guestOffsetMetres=0;}
      const metres=returnLifeGiverGuestOrdinarily(s);a.guestTravelMetres+=metres;a.elapsedSeconds+=metres;l.playerLocation='HOME';l.playerTravelMetres+=metres;a.playerTravelMetres+=metres;a.guestReturned=true;break;
    }
    case 'RETURN_BEADS': for(const b of l.beads)if(b.purpose==='LIFE'&&b.caseId===c.caseId&&b.location==='PLAYER')b.location='RETURN_TRAY';stop(a);elapse(s,a,2);break;
    case 'INSPECT': a.inspected=true;elapse(s,a,2);break;
  }
  updateResult(s,c.caseId);
  ctx.note(`${def.title}：${c.type}`,`原流灯${beforeP.location}→${p.location}，H${beforeP.health}→${p.health} / M${beforeP.mind}→${p.mind} / 精力${beforeP.stamina}→${p.stamina}；本人H${beforeH}→${s.health}。本次累计本人${a.playerTravelMetres}米、来客${a.guestTravelMetres}米、${a.elapsedSeconds}秒，已耗${a.spiritualitySpent}灵性、来客${a.guestStaminaSpent}精力、本人${a.playerHealthSpent}健康；共担${a.shelterStatus}，余${a.shelterRemainingSeconds}秒。失败和原物位置保留。`);
}
export function applyLifeGiverActivity(s: SliceState, c: LifeGiverActivityCommand, ctx: SeerContext): void {
  const reason=blockLifeGiverLife(s,c);if(reason)throw new Error(reason);
  if(c.type==='BUY_PAPERS'){applyWitchKingActivity(s,{type:'BUY_PAPERS'},ctx);return;}
  if(c.type==='PREPARE_PAPER'){applyWitchKingActivity(s,c,ctx);return;}
  initializeLifeGiverLife(s);const before=resources(s),guestBefore=structuredClone(getLifeGiverGuest(s));let check:PublicCheckResult|null=null;
  const wrapped:SeerContext={roll:(min,max)=>ctx.roll(min,max),note:(title,text)=>ctx.note(title,text),check:(ability,difficulty)=>{if(check!==null)throw new Error('本次只允许一次已声明检定。');check=ctx.check(ability,difficulty);return check;}};
  transition(s,c,wrapped);s.lifeGiver.life.ledger.push({week:s.week,command:structuredClone(c),before,after:resources(s),knowledge:s.character.coreStats.knowledge,check,guestBefore,guestAfter:structuredClone(getLifeGiverGuest(s))});
}
export function lifeGiverLifeActions(s: SliceState): LifeGiverLifeAction[] {
  if(!promoted(s))return [];const l=s.lifeGiver.life,out:LifeGiverLifeAction[]=[];
  const add=(label:string,cost:string,command:LifeGiverActivityCommand)=>{const reason=blockLifeGiverLife(s,command);out.push({id:`LG2:${'caseId'in command?command.caseId:'COMMON'}:${command.type}${'method'in command?':'+command.method:''}${'seconds'in command?':'+command.seconds:''}${'paperId'in command?':'+command.paperId:''}`,label,cost,command,enabled:reason===null,reason});};
  for(const {id:caseId}of CASES){const r=l.cases[caseId];
    if(r.status==='AVAILABLE')add('观察同一原人、原牌和真实退路','1行动',{type:'OBSERVE',caseId});
    if(r.status==='OBSERVED')for(const method of ['ABILITY','ORDINARY']as const)add(method==='ABILITY'?'准备两粒付费原珠与有限支援':'准备本人普通对照',method==='ABILITY'?'1行动 · 120便士＝两粒各60 · 须余2行动':'1行动 · 须余2行动',{type:'PREPARE',caseId,method});
    if(r.status==='PREPARED'){add('进入本次真实小院现场','1行动 · 后续实际步骤0行动',{type:'PERFORM',caseId});add('取消准备并亲手归还同一原珠','0行动 · 归珠2秒 · 已付成本不退',{type:'WITHDRAW',caseId});}
    if(r.status==='EXAMINED')add('报告实际结果与归还','1行动 · 扮演25 · 不凭报告补发掌握',{type:'REPORT',caseId});
    if(!r.contactOpen)continue;
    add('沿原小径到HOME面见同一流灯','0行动 · 本人30米30秒',{type:'VISIT_HOME',caseId});
    add('当面核实原身体、原声片和实际生死','0行动 · 4秒 · 死亡原体留原YARD',{type:'CHECK_GUEST_ORIGIN',caseId});
    add('当面询问原来客本次意愿','0行动 · 2秒 · 独立当前同意',{type:'CONSENT',caseId});
    add('撤回本次来客同意并停止窗口','0行动 · 1秒 · 不删除身体',{type:'REVOKE_CONSENT',caseId});
    add('普通陪同同一来客从HOME到YARD','0行动 · 双方30米30秒 · 无召唤',{type:'FETCH_GUEST',caseId});
    add('本人沿原小径回YARD','0行动 · 本人30米30秒',{type:'RETURN_PLAYER',caseId});
    add('询问米拉本次原牌用途的同意','0行动 · 2秒 · 独立物主许可',{type:'CONSENT_OWNER',caseId});
    add('米拉撤回本次物主许可','0行动 · 1秒 · 只可普通归还',{type:'REVOKE_OWNER',caseId});
    add('从米拉手中借同一200克原牌','0行动 · 2秒 · LG2-MIRA-TOKEN',{type:'BORROW_TOKEN',caseId});
    add('原来客实际搬同一原牌走2米','0行动 · 2秒 · 精力8；共担有效则3且本人H−5',{type:'GUEST_CARRY',caseId});
    add('本人普通走到原桌并取回同一原牌','0行动 · 往返4米4秒 · 不授能力掌握',{type:'CARRY_TOKEN',caseId});
    if(r.method==='ABILITY'){
      add('尝试对当前疲劳的原来客有限活力支援','0行动 · 6灵性＋一粒60便士已付原珠 · 知识18 · 1秒 · 成功精力至多＋12',{type:'VITALITY',caseId});
      add('尝试15秒共担，预告本人健康代价','0行动 · 4灵性＋一粒60便士已付原珠 · 知识18 · 1秒 · 下一次实际搬运本人H−5',{type:'SHELTER',caseId});
    }
    add('停止本次共担窗口','0行动 · 1秒 · 不退款不复原',{type:'STOP_SHELTER',caseId});
    if(caseId==='interrupted-link'){add('放下同一原遮板，真实阻断2米原路','0行动 · 2秒 · 立即停止共担',{type:'BLOCK_PATH',caseId});add('亲手清开同一原遮板','0行动 · 2秒 · 不重开或重骰能力',{type:'CLEAR_PATH',caseId});}
    for(const seconds of [5,15]as const)add(`实际等待${seconds}秒`, '0行动 · 耗尽15秒窗口即失效 · 无资源恢复',{type:'WAIT',caseId,seconds});
    add('亲手取还同一原牌给米拉','0行动 · 在手2秒；桌上实际往返4米4秒',{type:'RETURN_TOKEN',caseId});
    add('普通陪送原活来客回HOME','0行动 · 双方30米30秒 · 若原来客在桌边先自己走2米',{type:'RETURN_GUEST',caseId});
    add('亲手把同一未用或耗尽原珠放回托盘','0行动 · 2秒 · 原物保留不退款',{type:'RETURN_BEADS',caseId});
    add('检查原人、原牌、原珠和真实返程','0行动 · 2秒',{type:'INSPECT',caseId});
    add('实际结束本次现场','0行动 · 先原物返还、活来客返家、本人返院',{type:'CLOSE',caseId});
    add('收束并退出本次实践','0行动 · 成本不退 · 不代替实际返还',{type:'WITHDRAW',caseId});
  }
  add('为原HOME的同一活来客安排普通休息','1行动 · 30便士 · 每真实周最多一次 · 精力＋30/精神＋10 · 不治健康',{type:'REST_GUEST'});
  add('另备一粒独立的战斗原珠','1行动 · 60便士 · 总共最多三粒 · 接触对手后关闭',{type:'PREPARE_BATTLE_BEAD'});
  add('沿旧来源购买一批三张不同原月纸','1行动 · 60便士 · 沿旧唯一有限库存',{type:'BUY_PAPERS'});
  for(const p of s.witchKing.life.papers.filter(p=>p.status==='HELD'))add(`明确准备同一原纸 ${p.id}`,'1行动 · 3灵性 · 不补旧已耗原纸',{type:'PREPARE_PAPER',paperId:p.id});
  if(!l.reflected)add('反思当前同意、实际疲劳和真实代价','1行动 · 三报告后扮演25',{type:'REFLECT'});
  return out;
}
export function projectLifeGiverLife(s: SliceState): LifeGiverLifeProjection {
  const l=s.lifeGiver.life;
  return {title:'创生者与有限同意支援（原创G）',story:LIFE_GIVER_LIFE_STORY,environment:'原SM3-GLASS-ROOM暖房 ↔ 原30米普通小径 ↔ 原小院本次净空段；米拉的原桌在起点2米外，唯一LG2-SHUTTER可真实阻断。只有原SM3-LUMEN-BODY，原SM3-CHIME始终归同一来客。',
    inside:hasLifeGiverLifeLock(s),insideCase:hasLifeGiverLifeLock(s),activeCase:l.activeCase,playerLocation:l.playerLocation,playerTravelMetres:l.playerTravelMetres,clockSeconds:l.clockSeconds,
    partner:structuredClone(getLifeGiverGuest(s)),owner:{...l.owner},token:{...l.token},shutter:{...l.shutter},currentAttempt:structuredClone(currentAttempt(s)),beads:structuredClone(l.beads),inheritedPapers:structuredClone(s.witchKing.life.papers),reflected:l.reflected,
    cases:CASES.map(d=>{const r=l.cases[d.id];return {id:d.id,title:d.title,story:d.story,observations:r.observedWeek===null?[]:[...d.facts],status:r.status,method:r.method,result:r.attempts.length?r.result==='NONE'?'本次事项尚未完成；真实失败、资源、位置均保留。':r.result==='ABILITY'?'本次至少一项新能力发生了实际成功效果，随后完成真实返还。':'本次以普通操作完成；没有把尝试或报告当能力成功。':null,contactOpen:r.contactOpen,attempts:structuredClone(r.attempts)};}),actions:lifeGiverLifeActions(s)};
}
const validResources=(v:unknown):v is LifeGiverResources=>record(v)&&shape(v,['health','mind','spirituality','cash','actionsRemaining'])&&integer(v.health,1,100)&&integer(v.mind,0,100)&&integer(v.spirituality,0,120)&&integer(v.cash)&&integer(v.actionsRemaining,0,6);
/** Rebuild the finite living scene from the real promotion checkpoint and exact public commands.
 * The shadow owns only a temporary simulation, never a second current guest resource pool. */
function replayLife(s:SliceState):SliceState|null{
  const l=s.lifeGiver.life,anchor=l.initialGuestAnchor,promotion=s.lifeGiver.promotionWeek;
  if(!anchor||promotion===null||!validateSummoningMasterPartner(anchor,s.summoningMaster.promotionWeek,s.week)||!Array.isArray(l.ledger)||l.ledger.length>3000)return null;
  const life=createLifeGiverLifeState();life.initialGuestAnchor=structuredClone(anchor);
  const shadow={...s,status:'ACTIVE',activeEvent:null,combat:null,week:promotion,world:{...s.world,city:'BACKLUND'},
    character:{...s.character,coreStats:{...s.character.coreStats}},progression:{...s.progression,pathwayId:'moon',sequence:2,acting:0,mastery:{...s.progression.mastery,[VITALITY]:0,[SHELTER]:0}},
    lifeGiver:{...s.lifeGiver,preparedWeek:null,life,encounter:{...s.lifeGiver.encounter,approachWeek:null}},
    summoningMaster:{...s.summoningMaster,life:{...s.summoningMaster.life,partner:structuredClone(anchor)}}} as SliceState;
  let lastWeek=promotion,locked=false,lastAfter:LifeGiverResources|null=null,lastKnowledge:number|null=null;
  try{
    for(const entry of l.ledger){
      if(!record(entry)||!shape(entry,['week','command','before','after','knowledge','check','guestBefore','guestAfter'])||!integer(entry.week,lastWeek,s.week)||!validateLifeGiverActivityCommand(entry.command)||['BUY_PAPERS','PREPARE_PAPER'].includes(entry.command.type)||!validResources(entry.before)||!validResources(entry.after)||!integer(entry.knowledge,0,500))return null;
      if(locked&&(entry.week!==lastWeek||!same(entry.before,lastAfter)||entry.knowledge!==lastKnowledge))return null;
      if(!same(entry.guestBefore,getLifeGiverGuest(shadow)))return null;
      Object.assign(shadow,entry.before);shadow.week=entry.week;shadow.character.coreStats.knowledge=entry.knowledge;
      if(blockLifeGiverLife(shadow,entry.command)!==null)return null;
      const needsCheck=entry.command.type==='VITALITY'||entry.command.type==='SHELTER';
      if(needsCheck){if(!entry.check||!integer(entry.check.roll,1,100)||!same(entry.check,resolveNormalCheck({ability:'knowledge',baseAbility:entry.knowledge,difficulty:18,modifiers:[],roll:entry.check.roll})))return null;}
      else if(entry.check!==null)return null;
      let checked=false;
      const ctx:SeerContext={note:()=>{},roll:()=>{throw new Error('未声明的随机数。');},check:(ability,difficulty)=>{if(checked||!entry.check||ability!=='knowledge'||difficulty!==18)throw new Error('检定来源不匹配。');checked=true;return entry.check;}};
      transition(shadow,entry.command,ctx);
      if(checked!==needsCheck||!same(resources(shadow),entry.after)||!same(getLifeGiverGuest(shadow),entry.guestAfter))return null;
      lastWeek=entry.week;lastAfter=entry.after;lastKnowledge=entry.knowledge;locked=hasLifeGiverLifeLock(shadow);
    }
    life.ledger=structuredClone(l.ledger);return shadow;
  }catch{return null;}
}
export function lifeGiverGuestAfterLife(s:SliceState):SummoningMasterPartner|null{const replay=replayLife(s);return replay?structuredClone(getLifeGiverGuest(replay)):null;}
interface LifeCombatHistory {source:{partner:SummoningMasterPartner;combatBeads:LifeGiverBead[]};partnerAfter:SummoningMasterPartner;combatBeads:LifeGiverBead[]}
/** Exact finite scene replay plus explicit combat continuity seam; combat.ts validates each actual round. */
export function validateLifeGiverLife(s:SliceState):boolean{
  try{
    const l=s.lifeGiver?.life,initial=createLifeGiverLifeState();
    if(!record(l)||!shape(l,Object.keys(initial))||!Array.isArray(l.beads)||l.beads.some((b,i)=>!validateLifeGiverBead(b,s.week)||b.id!==`LG2-BEAD-${i+1}`)||l.beads.filter(b=>b.purpose==='COMBAT').length>3)return false;
    if(s.lifeGiver.promotionWeek===null)return same(l,initial);
    const replay=replayLife(s);if(!replay)return false;const expected=replay.lifeGiver.life;
    const e=s.lifeGiver.encounter as typeof s.lifeGiver.encounter&{invitationVisits:number;elapsedCombatSeconds:number;exitTravelMetres:number;exitSeconds:number};
    const rounds=s.combatHistory.map(r=>(r as unknown as {lifeGiverOutcome?:LifeCombatHistory}).lifeGiverOutcome).filter((r):r is LifeCombatHistory=>!!r);
    if(!integer(e.invitationVisits)||!integer(e.elapsedCombatSeconds)||![0,4].includes(e.exitTravelMetres)||e.exitSeconds!==e.exitTravelMetres||e.elapsedCombatSeconds!==rounds.length*60)return false;
    if(l.playerTravelMetres!==expected.playerTravelMetres+e.invitationVisits*60+e.exitTravelMetres||l.clockSeconds!==expected.clockSeconds+e.invitationVisits*60+e.elapsedCombatSeconds+e.exitSeconds)return false;
    if(rounds.length){if(!same(rounds[0]!.source.partner,getLifeGiverGuest(replay))||!same(rounds[0]!.source.combatBeads,expected.beads.filter(b=>b.purpose==='COMBAT'))||!same(getLifeGiverGuest(s),rounds.at(-1)!.partnerAfter))return false;}
    else if(!same(getLifeGiverGuest(s),getLifeGiverGuest(replay)))return false;
    const battleBeads=structuredClone(rounds.at(-1)?.combatBeads??expected.beads.filter(b=>b.purpose==='COMBAT'));
    for(const b of battleBeads)if(b.location==='PLAYER'&&(e.exitTravelMetres===4||e.status==='LOST'))b.location=e.status==='LOST'?'YARD':'RETURN_TRAY';
    if(!same(l.beads.filter(b=>b.purpose==='COMBAT'),battleBeads))return false;
    expected.beads=expected.beads.map(b=>b.purpose==='COMBAT'?battleBeads.find(x=>x.id===b.id)!:b);expected.playerTravelMetres=l.playerTravelMetres;expected.clockSeconds=l.clockSeconds;
    if(!same(l,expected))return false;
    if(promoted(s)&&s.progression.acting!==replay.progression.acting)return false;
    // Combat uses these skills without extra mastery awards; only replayed actual life effects grant these finite rewards.
    return (s.progression.mastery[VITALITY]??0)===(replay.progression.mastery[VITALITY]??0)&&(s.progression.mastery[SHELTER]??0)===(replay.progression.mastery[SHELTER]??0);
  }catch{return false;}
}
