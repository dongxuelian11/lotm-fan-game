import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasWitchKingLifeLock } from '../witch-king/life.js';
import { getSummoningMasterPartner, hasSummoningMasterLifeLock } from './life.js';
import { validateSummoningMasterRoundOutcome } from './combat.js';

export const SUMMONING_MASTER_TARGET_ID = 'SM3-EDWIN' as const;
export const SUMMONING_MASTER_POWER_IDS = ['DARK_BOLT', 'WARD', 'DISRUPT'] as const;
export type SummoningMasterPowerId = typeof SUMMONING_MASTER_POWER_IDS[number];
export type SummoningMasterEnemyIntent = SummoningMasterPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const SUMMONING_MASTER_POWERS = [
  { id: 'DARK_BOLT', label: '有限暗色飞矢', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'DISRUPT', label: '有限门媒介干扰', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export type SummoningMasterGuestPolicy = 'HOME' | 'ASK_HELP';
export interface SummoningMasterGuestPermit { partnerId: 'SM3-LUMEN'; approachWeek: number; paidWeek: number; paidPence: 20; negotiationTravelMetres: 60; negotiationSeconds: 60 }
export interface SummoningMasterEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface SummoningMasterEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof SUMMONING_MASTER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<SummoningMasterPowerId, number>;
  guestPolicy: SummoningMasterGuestPolicy; guestPermit: SummoningMasterGuestPermit | null; gateOpen: boolean;
  terminal: SummoningMasterEncounterTerminal | null;
}
export type SummoningMasterEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' }
  | { type: 'SET_GUEST_POLICY'; policy: SummoningMasterGuestPolicy };
export interface SummoningMasterEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SummoningMasterEncounterCommand }
export interface SummoningMasterEncounterProjection {
  title: string; story: string; status: SummoningMasterEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof SUMMONING_MASTER_TARGET_ID; name: '埃德温'; age: 46; source: 'ORIGINAL_STONE_COURT_ADULT'; sequence: 3;
    health: number; mind: number; spirituality: number; status: SummoningMasterEncounterState['enemyStatus'];
    weaponId: 'SM3-EDWIN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<SummoningMasterPowerId, number> };
  guestPolicy: SummoningMasterGuestPolicy; guestPermit: SummoningMasterGuestPermit | null; gateOpen: boolean;
  actions: SummoningMasterEncounterAction[]; facts: string[];
}
export const SUMMONING_MASTER_ENCOUNTER_STORY = '成年埃德温（46岁，SM3-EDWIN）在玻璃暖房旁独立净空小石院，持自己的唯一原棍SM3-EDWIN-CLUB提出通路争议。他是原创有限G3等效对手，独立H100/M100/S120，不是旧多里安。双方原身体相距2米，普通出口开放，无追逐。先实际交谈，再明确选择交战或和平离开。流灯默认留HOME；只有已见过本人的同一成年独立来客，存活、愿意、在HOME且精力至少20/精神至少30时，才能实付20便士协商本场帮助。许可不会施术或搬动来客；轮中召唤还要6S/知识18，实际过门另耗其6精力。有限合作3S和8原精力/知识16，成功32优势、减势16G，只占玩家一个槽。敌暗矢5S/75、护术4S/45、干扰4S可毁门并惊扰已到场来客一次精神−8；原身体不消失。轮末活着的来客按事先同意的30米普通小径自行回HOME，死亡则同体和原声片留场，不补新灵。全部数值、场景和低强来客为G。';

export function createSummoningMasterEncounterState(): SummoningMasterEncounterState {
  return { status: 'AVAILABLE', targetId: SUMMONING_MASTER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { DARK_BOLT: 0, WARD: 0, DISRUPT: 0 }, guestPolicy: 'HOME', guestPermit: null, gateOpen: false, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'moon' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateSummoningMasterEncounterCommand(v: unknown): v is SummoningMasterEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return c.type === 'SET_GUEST_POLICY' ? Object.keys(c).length === 2 && ['HOME', 'ASK_HELP'].includes(String(c.policy))
    : Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String(c.type));
}
export const isSummoningMasterEncounterCommand = validateSummoningMasterEncounterCommand;
export const hasSummoningMasterEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.summoningMaster.encounter.status);
export const isInsideSummoningMasterEncounter = hasSummoningMasterEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.summoningMaster.preparedWeek !== null || hasSummoningMasterLifeLock(s) || hasWitchKingLifeLock(s) ||
    Object.values(s.witchKing.life.cases).some(r => r.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.witchKing.encounter.status) ||
    s.witchKing.ritual.playerLocation !== 'OUTSIDE' || s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' ||
    Object.values(s.crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
export function hasSummoningMasterGuestPermit(s: SliceState): boolean {
  const e = s.summoningMaster.encounter, p = e.guestPermit;
  return e.guestPolicy === 'ASK_HELP' && ['READY', 'FIGHTING'].includes(e.status) && p !== null && p.partnerId === 'SM3-LUMEN' &&
    p.approachWeek === e.approachWeek && p.paidWeek === e.approachWeek && p.paidPence === 20 && p.negotiationTravelMetres === 60 && p.negotiationSeconds === 60;
}
export function blockSummoningMasterEncounter(s: SliceState, c: SummoningMasterEncounterCommand): string | null {
  if (!validateSummoningMasterEncounterCommand(c)) return '召唤大师遭遇命令无效。';
  const e = s.summoningMaster.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为召唤大师3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原玻璃暖房旁小石院。';
  if (otherSceneOpen(s)) return '先实际收束当前研究和旧实践、准备及原月场。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先到场交谈，才能普通和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (c.type === 'SET_GUEST_POLICY') {
    if (e.status !== 'READY') return '先与原埃德温交谈，再明确本场来客政策。';
    if (e.guestPolicy === c.policy) return '当前已经采用这项政策，不重复收钱或增发许可。';
    if (c.policy === 'HOME') return null;
    const p = getSummoningMasterPartner(s);
    if (p.status !== 'ALIVE' || p.health <= 0 || p.location !== 'HOME' || !p.willing || p.metWeek === null || p.stamina < 20 || p.mind < 30)
      return '须实际见过同一愿意帮助的存活来客，且其仍在HOME、精力至少20、精神至少30；不能强迫或替换来客。';
    return s.cash >= 20 ? null : '本场当面自愿帮助协商需要20便士。';
  }
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原埃德温已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export const summoningMasterEncounterReason = blockSummoningMasterEncounter;
export function applySummoningMasterEncounterCommand(s: SliceState, c: SummoningMasterEncounterCommand, ctx: SeerContext): void {
  const reason = blockSummoningMasterEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.summoningMaster.encounter;
  if (c.type === 'SET_GUEST_POLICY') {
    e.guestPolicy = c.policy;
    if (c.policy === 'HOME') { e.guestPermit = null; ctx.note('原来客留家', '明确撤回本场帮助请求；原流灯仍在原HOME，先前实付协商费用不退，不自动施法或补充资源。'); }
    else { s.cash -= 20; const life = s.summoningMaster.life; life.playerLocation = 'HOME'; life.playerTravelMetres += 60; life.clockSeconds += 60; life.playerLocation = 'YARD';
      e.guestPermit = { partnerId: 'SM3-LUMEN', approachWeek: e.approachWeek!, paidWeek: s.week, paidPence: 20, negotiationTravelMetres: 60, negotiationSeconds: 60 };
      ctx.note('取得本场来客自愿帮助许可', '本人沿原30米小径去HOME，当面与已见过的同一流灯协商，实付20便士取得本场有限帮助许可并约好30米普通撤离路径，再步行30米回院，实际共60米/60秒G。原来客身体仍HOME，尚未开门、不耗灵性或精力，不产生第二行动盘。'); }
    return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿小石院普通出口和平离开', '本人普通离开，无追逐或战斗奖励；流灯没有被自动召来，实付协商费用不退，旧多里安及全部原物记录保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原埃德温实际交谈', SUMMONING_MASTER_ENCOUNTER_STORY + '本次尚未替你选择开战或来客帮助。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SUMMONING_MASTER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原小石院的真实冲突', '双方用同一原身体、原棍与独立实际灵性交战。流灯仍在原处，帮助须轮中实际召唤和合作；共同伤势、死亡、撤退无豁免。');
}
export const applySummoningMasterEncounter = applySummoningMasterEncounterCommand;
export function hasSummoningMasterDisputeOpponent(s: SliceState): boolean {
  const e = s.summoningMaster?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === SUMMONING_MASTER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'SUMMONING_MASTER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && SUMMONING_MASTER_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - SUMMONING_MASTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleSummoningMasterEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.summoningMaster.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'SUMMONING_MASTER_DISPUTE') throw new Error('没有同一原埃德温的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知小石院战斗结果。');
  const last = c.lastRound, o = last?.summoningMasterOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateSummoningMasterRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || e.gateOpen ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.partnerAfter, getSummoningMasterPartner(s)) ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、来客位置或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as SummoningMasterEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原小石院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，召唤和旧纸不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原埃德温真实死亡，自己的原棍留场。' : '原埃德温仍活着，因真实重伤停止抵抗，把自己的原棍放在原院。'}活来客已按事先同意的30米普通路自行回家；死亡来客及其声片同留原场，没有替补或转给玩家。已付灵性、精力、费用和已耗原纸保留，旧多里安与供血不改。`);
}
export function summoningMasterEncounterActions(s: SliceState): SummoningMasterEncounterAction[] {
  if (!stage(s)) return [];
  const entries: [SummoningMasterEncounterCommand, string, string][] = [
    [{ type: 'ENCOUNTER_TALK' }, '前往原小石院交谈', '1行动 · 另留开战1行动'],
    [{ type: 'SET_GUEST_POLICY', policy: 'HOME' }, '让原来客留家', '0行动 · 撤回许可不退款'],
    [{ type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, '询问原来客本场帮助', '0行动 · 20便士 · 自愿许可'],
    [{ type: 'ENCOUNTER_FIGHT' }, '承担原埃德温的真实冲突', '1行动 · 真实受伤或死亡风险'],
    [{ type: 'LEAVE_ENCOUNTER' }, '沿原出口和平离开', '0行动'],
  ];
  return entries.map(([command, label, cost]) => { const reason = blockSummoningMasterEncounter(s, command); return { id: `summoningMaster-${command.type}${'policy' in command ? `-${command.policy}` : ''}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectSummoningMasterEncounter(s: SliceState): SummoningMasterEncounterProjection {
  const e = s.summoningMaster.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的召唤大师遭遇', story: '', status: e.status, inside: false, enemy: null,
    guestPolicy: 'HOME', guestPermit: null, gateOpen: false, actions: [], facts: [] };
  return { title: '小石院与一位真实来客', story: SUMMONING_MASTER_ENCOUNTER_STORY, status: e.status, inside: hasSummoningMasterEncounterLock(s),
    enemy: { id: SUMMONING_MASTER_TARGET_ID, name: '埃德温', age: 46, source: 'ORIGINAL_STONE_COURT_ADULT', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'SM3-EDWIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    guestPolicy: e.guestPolicy, guestPermit: e.guestPermit && { ...e.guestPermit }, gateOpen: e.gateOpen, actions: summoningMasterEncounterActions(s),
    facts: ['2米净空原小石院，开放普通出口，无追逐', 'HOME默认；20便士本场许可不等于召唤', '来客资源取自同一生活原身体，只有双方共同次数盘', '门断不删身体；活来客轮末普通30米返家，死亡留场'] };
}
/** Validate the current original opponent and finite resource history, not a second combat simulator. */
export function validateSummoningMasterEncounter(s: SliceState): boolean {
  const e = s.summoningMaster?.encounter, initial = createSummoningMasterEncounterState();
  if (!e || e.targetId !== SUMMONING_MASTER_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || !['HAND', 'YARD'].includes(e.weaponLocation) ||
      !Array.isArray(e.enemyInjuries) || !e.powerUses || Object.keys(e.powerUses).length !== 3 || !SUMMONING_MASTER_POWER_IDS.every(id => integer(e.powerUses[id])) ||
      e.enemySpirituality !== 120 - SUMMONING_MASTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || e.gateOpen !== false ||
      !['HOME', 'ASK_HELP'].includes(e.guestPolicy) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  const permit = e.guestPermit;
  if (e.guestPolicy === 'HOME' ? permit !== null : !permit || permit.partnerId !== 'SM3-LUMEN' || permit.paidPence !== 20 || permit.approachWeek !== e.approachWeek || permit.paidWeek !== e.approachWeek || permit.negotiationTravelMetres !== 60 || permit.negotiationSeconds !== 60) return false;
  if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'SUMMONING_MASTER_DISPUTE';
  if (!hasHistory(s) || s.summoningMaster.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.summoningMaster.promotionWeek) return false;
  if (!stage(s) && ['READY', 'FIGHTING'].includes(e.status)) return false;
  if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && s.combat?.encounterId !== 'SUMMONING_MASTER_DISPUTE';
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
  const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
  for (const [i, r] of rounds.entries()) {
    const o = r.summoningMasterOutcome, previous = rounds[i - 1]?.summoningMasterOutcome;
    if (!validateSummoningMasterRoundOutcome(o) || r.round !== i + 1 || o.round !== r.round || o.stance !== r.stance || o.source.runId !== s.runId ||
        o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.guestPolicy !== e.guestPolicy || !same(o.source.guestPermit, e.guestPermit) ||
        (i < rounds.length - 1 && (!o.continuing || r.retreat === 'SUCCESS')) ||
        (previous && (o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.enemySpirituality !== previous.enemySpirituality ||
          !same(o.source.partner, previous.partnerAfter) || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12)))) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (!same(moves, r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    for (const paperId of o.papersConsumed) if (!s.witchKing.life.papers.some(p => p.id === paperId && p.status === 'CONSUMED' && p.consumedBy === 'COMBAT' && p.combatRound === r.round && p.consumedWeek === e.attemptWeek)) return false;
  }
  const last = rounds.at(-1), o = last?.summoningMasterOutcome;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses))) return false;
  if (e.status === 'FIGHTING') return e.terminal === null && hasSummoningMasterDisputeOpponent(s) &&
    (o ? o.continuing && same(o.partnerAfter, getSummoningMasterPartner(s)) && same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
  const t = e.terminal;
  if (s.combat?.encounterId === 'SUMMONING_MASTER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
  return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
}
