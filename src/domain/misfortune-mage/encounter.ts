import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasMisfortuneMageLifeLock } from './life.js';
import { validateMisfortuneMageRoundOutcome, type MisfortuneMageRoundOutcome } from './combat.js';

export const MISFORTUNE_MAGE_TARGET_ID = 'MM4-FERRIS-LORNE' as const;
export const MISFORTUNE_MAGE_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type MisfortuneMagePowerId = typeof MISFORTUNE_MAGE_POWER_IDS[number];
export type MisfortuneMageEnemyIntent = MisfortuneMagePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const MISFORTUNE_MAGE_POWERS: readonly { id: MisfortuneMagePowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗（G）', cost: 3, selfGain: 0, enemyReduction: 0 },
];
export interface MisfortuneMageEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface MisfortuneMageEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof MISFORTUNE_MAGE_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<MisfortuneMagePowerId, number>; lastLuckRound: number | null;
  staggerReady: boolean; composureReady: boolean; luckAttempts: number; misfortuneAttempts: number;
  terminal: MisfortuneMageEncounterTerminal | null;
}
export type MisfortuneMageEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface MisfortuneMageEncounterProjection {
  encounter: (MisfortuneMageEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: MisfortuneMagePowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const MISFORTUNE_MAGE_ENCOUNTER_STORY = '原创成年序列5费里斯·洛恩（MM4-FERRIS-LORNE，G）在原报时铺独立净空后院2米外，持自己的MM4-FERRIS-CLUB，原有限弧光、小型护术与凝神共用实际40灵性。凝神须实付3灵性、0贡献，解除尚未作用的厄运并仅至当前回合末抵抗新K；灵性不足则用自己原棍普通打击。双方可见、无旁人，原地面没有松动物或灾源，原普通出口开放、无追逐；可普通拒绝交手并实际离开。候选厄运法师4编号和新增训练未在原著直接核验；本场强化全为G。默认保留本人原赢家积运；只有本轮首个合格B/K可选用1原积运与4灵性，K知识18可能失败，失败与被抵抗也付费。成功只减半本轮下一次实际正贡献身体打击或弧光，不追改过去、不影响护术、不重抽、强迫服从或附加等额厄运债。旧奥德里、杜兰及旧实践原物全部保留。';
export function createMisfortuneMageEncounterState(): MisfortuneMageEncounterState {
  return { status: 'AVAILABLE', targetId: MISFORTUNE_MAGE_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, lastLuckRound: null, staggerReady: false, composureReady: false,
    luckAttempts: 0, misfortuneAttempts: 0, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 4;
const reported = (s: SliceState) => Object.values(s.misfortuneMage.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => !s.misfortuneMage.encounter.staggerReady && !s.misfortuneMage.encounter.composureReady;
function practiceClosed(s: SliceState): boolean {
  const p = s.winner.practice, old = s.calamityPriest.practice;
  return !hasMisfortuneMageLifeLock(s) && Object.values(s.misfortuneMage.life.cases).every(c => c.status !== 'PREPARED') &&
    p.counter === 'GUIDE' && p.ring === 'OWNER' && p.note !== 'WRITTEN' && !s.winner.encounter.staggerReady &&
    s.winner.encounter.status !== 'FIGHTING' && Object.values(s.winner.cases).every(c => !c.contactOpen && c.status !== 'PREPARED') &&
    ['UNASSESSED', 'SECURED'].includes(old.hazard) && ['RESTING', 'SECURED'].includes(old.board) && ['NONE', 'RELEASED'].includes(old.contact) &&
    Object.values(s.calamityPriest.cases).every(c => !c.contactOpen && c.status !== 'PREPARED');
}
export const hasMisfortuneMageEncounterLock = (s: SliceState): boolean => s.misfortuneMage.encounter.status === 'FIGHTING';
export function validateMisfortuneMageEncounterCommand(v: unknown): v is MisfortuneMageEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function misfortuneMageEncounterReason(s: SliceState, _c: MisfortuneMageEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)) return '先完成候选厄运法师4的实际晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原报时铺独立后院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先关闭全部新旧生活接触和准备，实际收束原重物、原袋和原便笺；旧原环与计数片须已归还。';
  if (!reported(s)) return '先完成至少一份实际关闭后的厄运法师训练报告。';
  if (s.misfortuneMage.encounter.status !== 'AVAILABLE') return '同一原费里斯已有结果，不能再次开战、重生或重新补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyMisfortuneMageEncounterCommand(s: SliceState, c: MisfortuneMageEncounterCommand, ctx: SeerContext): void {
  if (!validateMisfortuneMageEncounterCommand(c)) throw new Error('厄运法师遭遇命令无效。');
  const reason = misfortuneMageEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.misfortuneMage.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通表明不接受交手，沿原后院开放出口实际离开，没有追逐或瞬移。费里斯仍活着并持有自己的原棍，H100/M100/S40保留；原赢家积运不变，没有法术控制、奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MISFORTUNE_MAGE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原费里斯的有限真实冲突', MISFORTUNE_MAGE_ENCOUNTER_STORY);
}
export function hasMisfortuneMageDisputeOpponent(s: SliceState): boolean {
  const e = s.misfortuneMage.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) &&
    c?.encounterId === 'MISFORTUNE_MAGE_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === MISFORTUNE_MAGE_TARGET_ID && e.terminal === null &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 && e.attemptWeek === s.week &&
    typeof e.staggerReady === 'boolean' && typeof e.composureReady === 'boolean' && !(e.staggerReady && e.composureReady) &&
    Number.isSafeInteger(e.luckAttempts) && e.luckAttempts >= 0 && Number.isSafeInteger(e.misfortuneAttempts) && e.misfortuneAttempts >= 0 && e.misfortuneAttempts <= e.luckAttempts &&
    (e.lastLuckRound === null ? e.luckAttempts === 0 : Number.isSafeInteger(e.lastLuckRound) && e.lastLuckRound >= 1 && e.lastLuckRound <= c.round && e.luckAttempts > 0) &&
    (!e.staggerReady || e.lastLuckRound === c.round) && (!e.composureReady || e.powerUses.COMPOSE > 0) &&
    MISFORTUNE_MAGE_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - MISFORTUNE_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleMisfortuneMageEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.misfortuneMage.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'MISFORTUNE_MAGE_DISPUTE') throw new Error('没有同一原费里斯的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知厄运法师冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (e.terminal || e.startHistoryIndex === null || !last || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validateMisfortuneMageRoundOutcome(last.misfortuneMageOutcome) || last.misfortuneMageOutcome.continuing ||
      !noEffects(s) || !practiceClosed(s) || last.misfortuneMageOutcome.enemySpirituality !== e.enemySpirituality ||
      last.misfortuneMageOutcome.luckStoredAfter !== s.winner.luck.stored || last.misfortuneMageOutcome.luckSpentAfter !== s.winner.luck.spent ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及有限原资源不一致。');
  e.terminal = { outcome: outcome as MisfortuneMageEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('misfortune-mage-dispute')) award?.('misfortune-mage-dispute', 25);
  s.combat = null;
  ctx.note('同一原费里斯的冲突结束', `${outcome === 'ENEMY_DEAD' ? '同一原费里斯真实死亡，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，幸运不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口实际离开，费里斯留在原后院，没有追逐或瞬移。' : '费里斯因真实重伤自行停止抵抗，仍活着并保有自己的原棍；不是厄运强迫服从。'}本场未用厄运与凝神均到期，实付灵性与原积运不退；原敌健康${e.enemyHealth}、灵性${e.enemySpirituality}和实际法术记录保留，不治愈、不补灵性、不改旧奥德里与杜兰。`);
}
export function misfortuneMageEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原费里斯真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: MisfortuneMageEncounterCommand = { type }, reason = misfortuneMageEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectMisfortuneMageEncounter(s: SliceState): MisfortuneMageEncounterProjection {
  if (!(s.progression.pathwayId==='wheel'&&[4,3].includes(s.progression.sequence!))) return { encounter: null };
  const e = s.misfortuneMage.encounter;
  return { encounter: { ...structuredClone(e), name: '费里斯·洛恩（原创成年非凡者，G）', story: MISFORTUNE_MAGE_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原报时铺独立净空后院的开放普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: MISFORTUNE_MAGE_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateMisfortuneMageEncounter(s: SliceState): boolean {
  const e = s.misfortuneMage?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== MISFORTUNE_MAGE_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || MISFORTUNE_MAGE_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - MISFORTUNE_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      e.staggerReady !== false || e.composureReady !== false || !integer(e.luckAttempts, 0) || !integer(e.misfortuneAttempts, 0, e.luckAttempts) ||
      (e.lastLuckRound === null ? e.luckAttempts !== 0 : !integer(e.lastLuckRound, 1) || e.luckAttempts === 0) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'misfortune-mage-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (s.misfortuneMage.promotionWeek === null) return stableStringify(e) === stableStringify(createMisfortuneMageEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'MISFORTUNE_MAGE_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.luckAttempts === 0 && e.misfortuneAttempts === 0 && e.lastLuckRound === null &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'MISFORTUNE_MAGE_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || e.attemptWeek < s.misfortuneMage.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previousSpirituality = 40, previousHealth = 100, previousMind = 100, enemyRisk = 0;
  const uses: Record<MisfortuneMagePowerId, number> = { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, enemyInjuries: SliceInjury[] = [];
  let previous: MisfortuneMageRoundOutcome | undefined;
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.misfortuneMageOutcome;
    if (r.round !== i + 1 || r.winner === null || (i < own.length - 1 && (r.retreat === 'SUCCESS' || o?.enemyStatus !== 'RESISTING' || !o?.continuing)) || !validateMisfortuneMageRoundOutcome(o) ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
        o.enemySpiritualityBefore !== previousSpirituality || o.source.enemyHealth !== previousHealth || o.source.enemyMind !== previousMind || o.stance !== r.stance ||
        stableStringify(o.passiveLuck) !== stableStringify(r.passiveLuck ?? null)) return false;
    if (previous && (o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.source.luckStored !== previous.luckStoredAfter ||
        o.source.luckSpent !== previous.luckSpentAfter || o.source.luckAccumulated !== previous.source.luckAccumulated || o.source.lastAccumulateWeek !== previous.source.lastAccumulateWeek ||
        o.source.lastLuckRound !== previous.lastLuckRound || o.source.luckAttempts !== previous.luckAttempts || o.source.misfortuneAttempts !== previous.misfortuneAttempts)) return false;
    if (!previous && (o.source.lastLuckRound !== null || o.source.luckAttempts !== 0 || o.source.misfortuneAttempts !== 0)) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    let playerHealth = o.source.playerHealth, enemyHealth = o.source.enemyHealth;
    if (r.winner === 'PLAYER' && r.retreat !== 'SUCCESS' && enemyInjuries.length > 0) enemyRisk++;
    if (r.consequenceWeights !== null) {
      if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS') return false;
      const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, severity = r.consequenceRoll <= w.light ? 'LIGHT' : 'HEAVY', damage = severity === 'LIGHT' ? 10 : 30;
      if (r.winner === 'PLAYER') {
        enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage);
        if (!death) enemyInjuries.push({ id: `${s.runId}:combat:${r.round}:ENEMY:${o.source.revision + 1}:${enemyInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
      } else playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
    }
    if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth) return false;
    previous = o;
    for (const a of o.enemyActions) if (a.paidCost > 0) uses[a.actual as MisfortuneMagePowerId]++;
    if (stableStringify(uses) !== stableStringify(o.powerUses)) return false;
    previousSpirituality = o.enemySpirituality; previousHealth = o.enemyHealth; previousMind = o.enemyMind;
  }
  const o = last?.misfortuneMageOutcome;
  if (stableStringify(enemyInjuries) !== stableStringify(e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      stableStringify(o.powerUses) !== stableStringify(e.powerUses) || o.lastLuckRound !== e.lastLuckRound || o.luckAttempts !== e.luckAttempts || o.misfortuneAttempts !== e.misfortuneAttempts)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
    s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.winner.luck.stored === o.luckStoredAfter && s.winner.luck.spent === o.luckSpentAfter &&
    s.winner.luck.accumulated === o.source.luckAccumulated && s.winner.luck.lastAccumulateWeek === o.source.lastAccumulateWeek)) && t === null && hasMisfortuneMageDisputeOpponent(s) &&
    (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40) && s.combat!.enemyRisk === e.enemyRisk &&
    stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) && (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'MISFORTUNE_MAGE_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || own.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  // Completed encounters retain immutable evidence; later legitimate practice may spend or accumulate the same old reserve.
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
