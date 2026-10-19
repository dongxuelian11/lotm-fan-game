import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasWitchKingLifeLock, type WitchKingPaper } from '../witch-king/life.js';
import { getSummoningMasterPartner, hasSummoningMasterLifeLock, type SummoningMasterPartner } from '../summoning-master/life.js';
import { hasLifeGiverLifeLock, lifeGiverGuestAfterLife, lifeGiverLifeAnchor, returnLifeGiverBattleBeads, leaveLifeGiverBattleBeadsOnDeath, validateLifeGiverBead, type LifeGiverBead } from './life.js';
import { currentLifeGiverCombatSource, freshLifeGiverCombatCounters, LIFE_GIVER_COUNTER_KEYS, lifeGiverCombatBeads, validateLifeGiverCombatCounters, validateLifeGiverCombatSource,
  validateLifeGiverPartner, validateLifeGiverPapers, validateLifeGiverRoundOutcome, type LifeGiverCombatCounters, type LifeGiverCombatSource, type LifeGiverRoundOutcome } from './combat.js';
import { validateLifeGiverRecordedRound } from '../slice/life-giver-combat.js';

export const LIFE_GIVER_TARGET_ID = 'LG2-ADRIAN-VALE' as const;
export const LIFE_GIVER_POWER_IDS = ['DARK_BOLT', 'WARD', 'JAM'] as const;
export type LifeGiverPowerId = typeof LIFE_GIVER_POWER_IDS[number];
export type LifeGiverEnemyIntent = LifeGiverPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const LIFE_GIVER_POWERS = [
  { id: 'DARK_BOLT', label: '有限暗矢G', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术G', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'JAM', label: '有限原门/分担链干扰G', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export type LifeGiverGuestPolicy = 'HOME' | 'ASK_HELP';
export interface LifeGiverGuestPermit { partnerId: 'SM3-LUMEN'; encounterId: 'LIFE_GIVER_DISPUTE'; approachWeek: number; paidWeek: number; paidPence: 20; negotiationTravelMetres: 60; negotiationSeconds: 60; visitNumber: number }
export interface LifeGiverInvitationVisit { week: number; revision: number; paidPence: 20; travelMetres: 60; seconds: 60; cashBefore: number; cashAfter: number; partnerId: 'SM3-LUMEN'; guestConsent: true }
export interface LifeGiverEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface LifeGiverEncounterState extends LifeGiverCombatCounters {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof LIFE_GIVER_TARGET_ID;
  approachWeek: number | null; approachRevision: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<LifeGiverPowerId, number>;
  guestPolicy: LifeGiverGuestPolicy; guestPermit: LifeGiverGuestPermit | null; gateOpen: boolean; shelterOpen: boolean;
  invitationVisits: number; invitationHistory: LifeGiverInvitationVisit[]; entryCash: number | null;
  entryPartner: SummoningMasterPartner | null; entryPapers: WitchKingPaper[]; entryBeads: LifeGiverBead[]; lifeAnchor: string | null;
  playerLocation: 'OUTSIDE' | 'YARD'; retrievedBeadIds: string[]; exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; elapsedCombatSeconds: number;
  startSource: LifeGiverCombatSource | null; terminal: LifeGiverEncounterTerminal | null;
}
export type LifeGiverEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' } | { type: 'SET_GUEST_POLICY'; policy: LifeGiverGuestPolicy };
export interface LifeGiverEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LifeGiverEncounterCommand }
export interface LifeGiverEncounterProjection extends LifeGiverCombatCounters {
  title: string; story: string; status: LifeGiverEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof LIFE_GIVER_TARGET_ID; name: '艾德里安·维尔'; age: 46; sequence: 2; physique: 24;
    health: number; mind: number; spirituality: number; status: LifeGiverEncounterState['enemyStatus']; weaponId: 'LG2-ADRIAN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<LifeGiverPowerId, number> };
  guestPolicy: LifeGiverGuestPolicy; guestPermit: LifeGiverGuestPermit | null; partner: SummoningMasterPartner; combatBeads: LifeGiverBead[];
  gateOpen: boolean; shelterOpen: boolean; invitationVisits: number; playerLocation: 'OUTSIDE' | 'YARD'; retrievedBeadIds: string[];
  exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; elapsedCombatSeconds: number; actions: LifeGiverEncounterAction[]; facts: string[];
}
export const LIFE_GIVER_ENCOUNTER_STORY = '原创新成年人艾德里安·维尔（46岁，LG2-ADRIAN-VALE）在暖房旁新的独立净空石院提出通路争议，持自己的唯一LG2-ADRIAN-CLUB。有限G2等效原身体24、独立H100/M100/S120，与旧埃德温和多里安不是同一人。双方相距2米，普通出口4米、实走4秒，无追逐和旁人。先实际交谈再选开战或和平离开。流灯默认留原HOME；本场必须本人实走原路60米/60秒、另付20便士取得当前同意，不沿用旧战许可。许可本身不召来身体；原召入6S/知识18，过门原精力6，原合作3S/知识16且原精力8。最多三颗独立实付60便士原珠，有限活力6S/知识18只补同一疲劳来客至多12精力；分担庇护4S/知识18、激活本人H>10，只给下次成功合作：原精力8→3、本人实际H−5并额外减势20G。无成功动作不产生效果。对方暗矢7S/105、护术6S/减60、干扰4S断实际门和庇护，已到场来客本轮至多精神−8；灵性不足同槽回原棍20×身体。活来客轮末走30米回原HOME；死者同体原声片留YARD。创生者新能力/配方渠道/场景均G，原著完整配方仪式未知，不制造生命、灵魂或复活，不改变性别。';
export function createLifeGiverEncounterState(): LifeGiverEncounterState {
  return { status: 'AVAILABLE', targetId: LIFE_GIVER_TARGET_ID, approachWeek: null, approachRevision: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { DARK_BOLT: 0, WARD: 0, JAM: 0 }, guestPolicy: 'HOME', guestPermit: null, gateOpen: false, shelterOpen: false,
    invitationVisits: 0, invitationHistory: [], entryCash: null, entryPartner: null, entryPapers: [], entryBeads: [], lifeAnchor: null,
    playerLocation: 'OUTSIDE', retrievedBeadIds: [], exitTravelMetres: 0, exitSeconds: 0, elapsedCombatSeconds: 0,
    startSource: null, terminal: null, ...freshLifeGiverCombatCounters() };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const exactKeys = (v: object, keys: readonly string[]) => !!v && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
export function validateLifeGiverEncounterCommand(v: unknown): v is LifeGiverEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return c.type === 'SET_GUEST_POLICY' ? exactKeys(c, ['type', 'policy']) && ['HOME', 'ASK_HELP'].includes(String(c.policy))
    : exactKeys(c, ['type']) && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String(c.type));
}
export const isLifeGiverEncounterCommand = validateLifeGiverEncounterCommand;
export const hasLifeGiverEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.lifeGiver.encounter.status);
export const isInsideLifeGiverEncounter = hasLifeGiverEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.lifeGiver.preparedWeek !== null || hasLifeGiverLifeLock(s) || s.summoningMaster.preparedWeek !== null || hasSummoningMasterLifeLock(s) || hasWitchKingLifeLock(s) ||
    ['READY', 'FIGHTING'].includes(s.summoningMaster.encounter.status) || ['READY', 'FIGHTING'].includes(s.witchKing.encounter.status) ||
    Object.values(s.witchKing.life.cases).some(r => r.status === 'PREPARED') || s.witchKing.ritual.playerLocation !== 'OUTSIDE' ||
    s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' || Object.values(s.crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
export function hasLifeGiverGuestPermit(s: SliceState): boolean {
  const e = s.lifeGiver.encounter, p = e.guestPermit;
  return e.guestPolicy === 'ASK_HELP' && ['READY', 'FIGHTING'].includes(e.status) && !!p && p.partnerId === 'SM3-LUMEN' && p.encounterId === 'LIFE_GIVER_DISPUTE' &&
    p.approachWeek === e.approachWeek && p.paidWeek === e.approachWeek && p.paidPence === 20 && p.negotiationTravelMetres === 60 && p.negotiationSeconds === 60 && p.visitNumber === e.invitationVisits;
}
export function blockLifeGiverEncounter(s: SliceState, c: LifeGiverEncounterCommand): string | null {
  if (!validateLifeGiverEncounterCommand(c)) return '创生者遭遇命令无效。';
  const e = s.lifeGiver.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并实际成为月亮序列2创生者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原暖房旁新独立石院。';
  if (otherSceneOpen(s)) return '先实际收束生活现场、旧原实践和晋升准备。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须已实际到场交谈，才能亲手收回原珠、普通步行离开。';
  if (s.mind <= 0) return '先恢复精神；未开战仍可普通离开。';
  if (!s.lifeGiver.life.reflected) return '先完成三项真实生活研究、原人原物归还与反思。';
  if (c.type === 'SET_GUEST_POLICY') {
    if (e.status !== 'READY') return '先实际与原艾德里安交谈，再选择本场来客政策。';
    if (e.guestPolicy === c.policy) return '本场已经采用该政策，不重复收费或增发许可。';
    if (c.policy === 'HOME') return null;
    const p = getSummoningMasterPartner(s);
    if (p.status !== 'ALIVE' || p.health <= 0 || p.location !== 'HOME' || !p.willing || p.metWeek === null || p.stamina < 20 || p.mind < 30)
      return '须已见过同一当前愿意的存活流灯，仍在HOME、原精力至少20/精神至少30；拒绝仍可本人普通交战，不能换体或强迫。';
    return s.cash >= 20 ? null : '本场新当面协商需实付20便士与普通往返60米/60秒。';
  }
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') {
    if (e.status !== 'AVAILABLE') return '同一原艾德里安已有进展或结局，不重新初始化。';
    if (!same(getSummoningMasterPartner(s), lifeGiverGuestAfterLife(s))) return '原来客必须承接真实生活尾记录，不得复位或换体。';
    if (lifeGiverCombatBeads(s).some(b => b.location !== 'PLAYER' || b.status !== 'READY')) return '须携同一实际付费准备的原珠；不能取回用尽珠重新使用。';
    return s.actionsRemaining >= 2 ? null : '交谈1行动，另留1行动供明确开战；仍可和平离开。';
  }
  return e.status === 'READY' && e.playerLocation === 'YARD' && same(e.entryPartner, getSummoningMasterPartner(s)) && same(e.entryBeads, lifeGiverCombatBeads(s)) && same(e.entryPapers, s.witchKing.life.papers)
    ? null : '先实际交谈，确认当前原人、原珠、原纸与普通出口，不能在场外改写资源。';
}
export const lifeGiverEncounterReason = blockLifeGiverEncounter;
function retrieveAndExit(s: SliceState, dead: boolean): void {
  const e = s.lifeGiver.encounter;
  if (e.playerLocation !== 'YARD' || lifeGiverCombatBeads(s).some(b => b.location !== 'PLAYER')) throw new Error('原珠或本人不在本场，不能用退出传回。');
  if (dead) leaveLifeGiverBattleBeadsOnDeath(s);
  else { returnLifeGiverBattleBeads(s); e.retrievedBeadIds = lifeGiverCombatBeads(s).map(b => b.id); e.playerLocation = 'OUTSIDE';
    e.exitTravelMetres = 4; e.exitSeconds = 4; s.lifeGiver.life.playerTravelMetres += 4; s.lifeGiver.life.clockSeconds += 4; }
}
export function applyLifeGiverEncounterCommand(s: SliceState, c: LifeGiverEncounterCommand, ctx: SeerContext): void {
  const reason = blockLifeGiverEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.lifeGiver.encounter;
  if (c.type === 'SET_GUEST_POLICY') {
    e.guestPolicy = c.policy;
    if (c.policy === 'HOME') { e.guestPermit = null; ctx.note('本场原来客留家', '本次邀请明确撤回，原身体仍HOME，先前20便士和实际路程保留；本人仍可普通交战，不换来客。'); }
    else { const cashBefore = s.cash; s.cash -= 20; const l = s.lifeGiver.life;
      l.playerLocation = 'PATH'; l.playerTravelMetres += 30; l.clockSeconds += 30; l.playerLocation = 'HOME';
      e.invitationVisits++; e.invitationHistory.push({ week: s.week, revision: s.revision + 1, paidPence: 20, travelMetres: 60, seconds: 60, cashBefore, cashAfter: s.cash, partnerId: 'SM3-LUMEN', guestConsent: true });
      e.guestPermit = { partnerId: 'SM3-LUMEN', encounterId: 'LIFE_GIVER_DISPUTE', approachWeek: e.approachWeek!, paidWeek: s.week, paidPence: 20, negotiationTravelMetres: 60, negotiationSeconds: 60, visitNumber: e.invitationVisits };
      l.playerLocation = 'PATH'; l.playerTravelMetres += 30; l.clockSeconds += 30; l.playerLocation = 'YARD';
      ctx.note('取得原流灯本场新自愿许可', '本人沿原30米小径实际去HOME，当面另付20便士询问原流灯当前意愿，约好本场普通30米返家，再走30米回院。实际60米/60秒；旧埃德温许可没有复用，原身体仍HOME，未施法、不耗其精力、不产生新身体。'); }
    return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { retrieveAndExit(s, false); e.status = 'RESOLVED'; ctx.note('普通离开新石院', '本人亲手带回所有同一实付原珠至返还盘，沿普通出口实走4米4秒；无奖励、追逐或夺棍，旧人物原资源不变。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.approachRevision = s.revision + 1; e.entryCash = s.cash; e.playerLocation = 'YARD';
    e.entryPartner = structuredClone(getSummoningMasterPartner(s)); e.entryPapers = structuredClone(s.witchKing.life.papers); e.entryBeads = structuredClone(lifeGiverCombatBeads(s)); e.lifeAnchor = lifeGiverLifeAnchor(s);
    ctx.note('与原艾德里安·维尔实际交谈', LIFE_GIVER_ENCOUNTER_STORY + '本次尚未替你选择开战或邀请流灯。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'LIFE_GIVER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  e.startSource = currentLifeGiverCombatSource(s); if (!e.startSource) throw new Error('缺少同一原身体、来客、实付原珠和原纸开战来源。');
  ctx.note('承担新石院真实冲突', '双方各用原身体、原棍和独立实际资源；原流灯不因许可自动到场。只有双方共同次数、能力和伤势盘，普通撤退与真实死亡保留。');
}
export const applyLifeGiverEncounter = applyLifeGiverEncounterCommand;
export function hasLifeGiverDisputeOpponent(s: SliceState): boolean {
  const e = s.lifeGiver?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) && !!e &&
    e.status === 'FIGHTING' && e.targetId === LIFE_GIVER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && e.playerLocation === 'YARD' &&
    e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.retrievedBeadIds.length === 0 && lifeGiverCombatBeads(s).every(b => b.location === 'PLAYER') &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'LIFE_GIVER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && e.enemySpirituality === 120 - LIFE_GIVER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleLifeGiverEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.lifeGiver.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'LIFE_GIVER_DISPUTE') throw new Error('没有同一原艾德里安的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知石院结果。');
  const last = c.lastRound, o = last?.lifeGiverOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateLifeGiverRoundOutcome(o) || !validateLifeGiverRecordedRound(last) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || e.gateOpen || e.shelterOpen ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.partnerAfter, getSummoningMasterPartner(s)) ||
    !same(o.papersAfter, s.witchKing.life.papers) || !same(o.combatBeads, lifeGiverCombatBeads(s)) || !same(o.powerUses, e.powerUses) || LIFE_GIVER_COUNTER_KEYS.some(k => o[k] !== e[k]) ||
    o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
    outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
    outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER' || last.retreat !== 'NONE') ||
    outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) throw new Error('原身体、真实回合、同一来客/原珠/原纸成本不一致。');
  e.terminal = { outcome: outcome as LifeGiverEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; retrieveAndExit(s, outcome === 'PLAYER_DEAD'); s.combat = null;
  ctx.note('新石院冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人原身体真实死亡，全部同一原珠含用尽实物留YARD，无返程或复活。' : '本人亲手拾回全部同一原珠含用尽实物至返还盘，实际走4米4秒离场，无追逐或夺棍。'}${outcome === 'ENEMY_DEAD' ? '原艾德里安同体真实死亡，原棍留YARD。' : outcome === 'ENEMY_SURRENDERED' ? '原艾德里安因真实重伤停止抵抗，原棍放在YARD，仍是其原物。' : '原艾德里安与自己的唯一原棍仍留现场。'}活流灯已沿30米普通路回原HOME；死亡流灯同体及声片留YARD，无替补。实付S、本人H分担、来客资源、原纸和原珠成本全部保留；旧埃德温/多里安不变。`);
}
export function lifeGiverEncounterActions(s: SliceState): LifeGiverEncounterAction[] {
  if (!stage(s)) return [];
  const entries: [LifeGiverEncounterCommand, string, string][] = [
    [{ type: 'ENCOUNTER_TALK' }, '携实付原珠前往新石院交谈', '1行动，另留开战1行动'],
    [{ type: 'SET_GUEST_POLICY', policy: 'HOME' }, '让原流灯留家', '0行动，撤回许可不退款'],
    [{ type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, '当面询问原流灯本场意愿', '0行动，20便士，60米/60秒'],
    [{ type: 'ENCOUNTER_FIGHT' }, '承担原艾德里安的真实冲突', '1行动，真实受伤/死亡风险'],
    [{ type: 'LEAVE_ENCOUNTER' }, '亲手收珠并普通走4米离开', '0行动，实际4秒'],
  ];
  return entries.map(([command, label, cost]) => { const reason = blockLifeGiverEncounter(s, command); return { id: `lifeGiver-${command.type}${'policy' in command ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectLifeGiverEncounter(s: SliceState): LifeGiverEncounterProjection {
  const e = s.lifeGiver.encounter, progress = { ...Object.fromEntries(LIFE_GIVER_COUNTER_KEYS.map(k => [k, e[k]])) as unknown as LifeGiverCombatCounters,
    guestPolicy: e.guestPolicy, guestPermit: e.guestPermit && { ...e.guestPermit }, partner: structuredClone(getSummoningMasterPartner(s)), combatBeads: structuredClone(lifeGiverCombatBeads(s)),
    gateOpen: e.gateOpen, shelterOpen: e.shelterOpen, invitationVisits: e.invitationVisits, playerLocation: e.playerLocation, retrievedBeadIds: [...e.retrievedBeadIds], exitTravelMetres: e.exitTravelMetres, exitSeconds: e.exitSeconds, elapsedCombatSeconds: e.elapsedCombatSeconds };
  if (!stage(s)) return { ...progress, title: '尚未开放的创生者新遭遇G', story: '', status: e.status, inside: false, enemy: null, actions: [], facts: [] };
  return { ...progress, title: '艾德里安·维尔与原来客的有限分担G', story: LIFE_GIVER_ENCOUNTER_STORY, status: e.status, inside: hasLifeGiverEncounterLock(s),
    enemy: { id: LIFE_GIVER_TARGET_ID, name: '艾德里安·维尔', age: 46, sequence: 2, physique: 24, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'LG2-ADRIAN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: lifeGiverEncounterActions(s),
    facts: ['新独立46岁成年人，体24/H100/M100/S120与唯一原棍；旧敌不复位', 'HOME默认；每次新邀请实付20便士并当面走60米/60秒', '原流灯仍是唯一生活原身体，当前许可可撤回；死亡不换体', '原珠最多三颗，一次尝试即耗；技能成功不等于分担已实际应用', '生还亲手收回全部原珠至返还盘，普通退出4米/4秒；死亡留场'] };
}
/** Replay exact original sources, costs, RNG and terminal movement; do not authorize a new guest or paper pool. */
export function validateLifeGiverEncounter(s: SliceState): boolean {
  try {
    const e = s.lifeGiver?.encounter, fresh = createLifeGiverEncounterState();
    if (!e || !exactKeys(e, Object.keys(fresh)) || e.targetId !== LIFE_GIVER_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) ||
      (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || !['HAND', 'YARD'].includes(e.weaponLocation) || (e.enemyStatus !== 'RESISTING') !== (e.weaponLocation === 'YARD') ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || !exactKeys(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0, s.revision) || i.treatedRevision !== null) ||
      !exactKeys(e.powerUses, LIFE_GIVER_POWER_IDS) || LIFE_GIVER_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - LIFE_GIVER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !validateLifeGiverCombatCounters(e) || e.gateOpen !== false || e.shelterOpen !== false || !['HOME', 'ASK_HELP'].includes(e.guestPolicy) || !integer(e.invitationVisits) || !Array.isArray(e.invitationHistory) || e.invitationHistory.length !== e.invitationVisits ||
      !Array.isArray(e.entryPapers) || !Array.isArray(e.entryBeads) || !Array.isArray(e.retrievedBeadIds) || ![0, 4].includes(e.exitTravelMetres) || e.exitSeconds !== e.exitTravelMetres || !integer(e.elapsedCombatSeconds) ||
      [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, s.lifeGiver.promotionWeek ?? 1, s.week)) || e.approachRevision !== null && !integer(e.approachRevision, 1, s.revision) || e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (s.lifeGiver.promotionWeek === null || e.status === 'AVAILABLE') return same(e, fresh) && s.combat?.encounterId !== 'LIFE_GIVER_DISPUTE';
    if (!stage(s) || !s.lifeGiver.life.reflected || e.approachWeek === null || e.approachRevision === null || !integer(e.entryCash, 0) || !e.entryPartner || !validateLifeGiverPartner(e.entryPartner, e.approachWeek) ||
      !same(e.entryPartner, lifeGiverGuestAfterLife(s)) || e.lifeAnchor !== lifeGiverLifeAnchor(s) || !validateLifeGiverPapers(e.entryPapers, e.approachWeek) || e.entryBeads.length > 3 || new Set(e.entryBeads.map(b => b.id)).size !== e.entryBeads.length ||
      e.entryBeads.some(b => !validateLifeGiverBead(b, e.approachWeek!) || b.purpose !== 'COMBAT' || b.status !== 'READY' || b.location !== 'PLAYER') || !same(e.entryBeads.map(b => b.id), lifeGiverCombatBeads(s).map(b => b.id))) return false;
    for (const [i, visit] of e.invitationHistory.entries()) if (!exactKeys(visit, ['week', 'revision', 'paidPence', 'travelMetres', 'seconds', 'cashBefore', 'cashAfter', 'partnerId', 'guestConsent']) || visit.week !== e.approachWeek ||
      !integer(visit.revision, e.approachRevision + 1, s.revision) || i > 0 && visit.revision <= e.invitationHistory[i - 1]!.revision || visit.paidPence !== 20 || visit.travelMetres !== 60 || visit.seconds !== 60 ||
      visit.partnerId !== 'SM3-LUMEN' || visit.guestConsent !== true || !integer(visit.cashBefore, 20) || visit.cashBefore !== (i === 0 ? e.entryCash : e.invitationHistory[i - 1]!.cashAfter) || visit.cashAfter !== visit.cashBefore - 20 ||
      e.entryPartner.status !== 'ALIVE' || !e.entryPartner.willing || e.entryPartner.location !== 'HOME' || e.entryPartner.metWeek === null || e.entryPartner.stamina < 20 || e.entryPartner.mind < 30) return false;
    const p = e.guestPermit;
    if (e.guestPolicy === 'HOME' ? p !== null : !p || !exactKeys(p, ['partnerId', 'encounterId', 'approachWeek', 'paidWeek', 'paidPence', 'negotiationTravelMetres', 'negotiationSeconds', 'visitNumber']) || p.partnerId !== 'SM3-LUMEN' || p.encounterId !== 'LIFE_GIVER_DISPUTE' ||
      p.approachWeek !== e.approachWeek || p.paidWeek !== e.approachWeek || p.paidPence !== 20 || p.negotiationTravelMetres !== 60 || p.negotiationSeconds !== 60 || p.visitNumber !== e.invitationVisits || !integer(p.visitNumber, 1)) return false;
    const liveInside = ['READY', 'FIGHTING'].includes(e.status), deadInside = e.status === 'LOST', beadLocation = liveInside ? 'PLAYER' : deadInside ? 'YARD' : 'RETURN_TRAY';
    if (e.playerLocation !== (liveInside || deadInside ? 'YARD' : 'OUTSIDE') || e.exitTravelMetres !== (liveInside || deadInside ? 0 : 4) ||
      !same(e.retrievedBeadIds, liveInside || deadInside ? [] : e.entryBeads.map(b => b.id)) || lifeGiverCombatBeads(s).some(b => b.location !== beadLocation)) return false;
    const matchBeads = (beads: LifeGiverBead[]) => same(lifeGiverCombatBeads(s), beads.map(b => ({ ...b, location: beadLocation })));
    if (e.startHistoryIndex === null) {
      const normalized = { ...e, status: 'AVAILABLE', approachWeek: null, approachRevision: null, entryCash: null, entryPartner: null, entryPapers: [], entryBeads: [], lifeAnchor: null,
        playerLocation: 'OUTSIDE', retrievedBeadIds: [], exitTravelMetres: 0, exitSeconds: 0, invitationVisits: 0, invitationHistory: [], guestPolicy: 'HOME', guestPermit: null };
      return ['READY', 'RESOLVED'].includes(e.status) && same(normalized, fresh) && matchBeads(e.entryBeads) && same(e.entryPartner, getSummoningMasterPartner(s)) &&
        same(e.entryPapers, s.witchKing.life.papers) && (e.status !== 'READY' || s.cash === e.entryCash - e.invitationVisits * 20) && s.combat?.encounterId !== 'LIFE_GIVER_DISPUTE';
    }
    if (e.attemptWeek === null || e.attemptWeek !== e.approachWeek || !e.startSource || !validateLifeGiverCombatSource(e.startSource) || e.startSource.runId !== s.runId || e.startSource.randomSeed !== s.random.seed || e.startSource.week !== e.attemptWeek || e.startSource.round !== 1 ||
      e.startSource.startHistoryIndex !== e.startHistoryIndex || !integer(e.startSource.revision, e.approachRevision, s.revision - 1) || !same(e.startSource.partner, e.entryPartner) || !same(e.startSource.papers, e.entryPapers) || !same(e.startSource.combatBeads, e.entryBeads) || e.startSource.lifeAnchor !== e.lifeAnchor) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length;
    if (!integer(end, e.startHistoryIndex, s.combatHistory.length)) return false;
    const rounds = s.combatHistory.slice(e.startHistoryIndex, end); let previous: LifeGiverRoundOutcome | undefined;
    if (e.elapsedCombatSeconds !== rounds.length * 60) return false;
    for (const [i, round] of rounds.entries()) {
      const o = round.lifeGiverOutcome;
      if (!validateLifeGiverRoundOutcome(o) || !validateLifeGiverRecordedRound(round) || round.round !== i + 1 || o.source.runId !== s.runId || o.source.randomSeed !== s.random.seed || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        !integer(o.source.revision, e.approachRevision, s.revision - 1) || o.source.lifeAnchor !== e.lifeAnchor || o.source.guestPolicy !== e.guestPolicy || !same(o.source.guestPermit, e.guestPermit) || i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous) {
        if (o.source.revision !== previous.source.revision + 1 || o.source.randomCursor !== previous.randomCursorAfter || o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) || !same(o.source.partner, previous.partnerAfter) || !same(o.source.papers, previous.papersAfter) || !same(o.source.combatBeads, previous.combatBeads) ||
          !same(o.source.playerInjuries, previous.playerInjuriesAfter) || !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.playerRisk !== previous.playerRiskAfter || o.source.enemyRisk !== previous.enemyRiskAfter || !same(o.source.playerCoreStats, previous.source.playerCoreStats) || o.source.arrowMastery !== previous.source.arrowMastery ||
          LIFE_GIVER_COUNTER_KEYS.some(k => o.source[k] !== previous![k])) return false;
      } else if (!same(o.source, { ...e.startSource, revision: e.startSource.revision + 1 }) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || Object.values(o.source.powerUses).some(n => n !== 0) || LIFE_GIVER_COUNTER_KEYS.some(k => o.source[k] !== 0)) return false;
      for (const paperId of o.papersConsumed) if (!s.witchKing.life.papers.some(paper => paper.id === paperId && paper.status === 'CONSUMED' && paper.consumedBy === 'COMBAT' && paper.consumedWeek === e.attemptWeek && paper.combatRound === o.round)) return false;
      previous = o;
    }
    if (previous && (previous.enemyHealth !== e.enemyHealth || previous.enemyMind !== e.enemyMind || previous.enemySpirituality !== e.enemySpirituality || previous.enemyStatus !== e.enemyStatus || previous.enemyRiskAfter !== e.enemyRisk || !same(previous.enemyInjuriesAfter, e.enemyInjuries) || !same(previous.powerUses, e.powerUses) || LIFE_GIVER_COUNTER_KEYS.some(k => previous![k] !== e[k]))) return false;
    if (!previous && (s.health !== e.startSource.playerHealth || s.mind !== e.startSource.playerMind || s.spirituality !== e.startSource.playerSpirituality || !same(s.injuries, e.startSource.playerInjuries) || s.injuryRisk !== e.startSource.playerRisk || s.random.cursor !== e.startSource.randomCursor ||
      e.enemyHealth !== 100 || e.enemyMind !== 100 || e.enemySpirituality !== 120 || e.enemyRisk !== 0 || e.enemyInjuries.length !== 0 || LIFE_GIVER_COUNTER_KEYS.some(k => e[k] !== 0))) return false;
    if (!matchBeads(previous?.combatBeads ?? e.entryBeads) || !same(getSummoningMasterPartner(s), previous?.partnerAfter ?? e.entryPartner)) return false;
    // Old papers may be bought/prepared later; original consumed instances remain exact and cannot be restored.
    const paperTail = previous?.papersAfter ?? e.entryPapers;
    if (e.status === 'FIGHTING' ? !same(s.witchKing.life.papers, paperTail) : paperTail.some(p => p.status === 'CONSUMED' && !s.witchKing.life.papers.some(q => same(p, q)))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasLifeGiverDisputeOpponent(s) && (!previous || previous.continuing && s.health === previous.playerHealthAfter && s.mind === previous.playerMindAfter &&
      s.spirituality === Math.min(120, previous.playerSpiritualityAfter + 12) && s.injuryRisk === previous.playerRiskAfter && same(s.injuries, previous.playerInjuriesAfter) && s.random.cursor === previous.randomCursorAfter && same(s.combat!.lastRound, rounds.at(-1)));
    const t = e.terminal, last = rounds.at(-1);
    return !!t && exactKeys(t, ['outcome', 'round', 'historyIndex', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus']) && !!previous && !!last && !previous.continuing &&
      t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'LIFE_GIVER_DISPUTE' &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS' :
        t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' :
          t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' :
            t.outcome === 'ENEMY_SURRENDERED' && e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
