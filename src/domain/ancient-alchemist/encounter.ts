import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasDruidOpenPractice } from '../druid/encounter.js';
import { hasAncientAlchemistLifeLock } from './life.js';
import { validateAncientAlchemistRoundOutcome, type AncientAlchemistRoundOutcome, type AncientAlchemistGuardReference } from './combat.js';

export const ANCIENT_ALCHEMIST_TARGET_ID = 'AA4-OSRIC-VALE' as const;
export const ANCIENT_ALCHEMIST_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type AncientAlchemistPowerId = typeof ANCIENT_ALCHEMIST_POWER_IDS[number];
export type AncientAlchemistEnemyIntent = AncientAlchemistPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const ANCIENT_ALCHEMIST_POWERS: readonly { id: AncientAlchemistPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '普通整理自有原棍持握姿势（G；不是心理法术）', cost: 0, selfGain: 0, enemyReduction: 0 },
];
export interface AncientAlchemistEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface AncientAlchemistEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof ANCIENT_ALCHEMIST_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<AncientAlchemistPowerId, number>; guardReady: AncientAlchemistGuardReference | null; guardAttempts: number; terminal: AncientAlchemistEncounterTerminal | null;
}
export type AncientAlchemistEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface AncientAlchemistEncounterProjection {
  encounter: (AncientAlchemistEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: AncientAlchemistPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const ANCIENT_ALCHEMIST_ENCOUNTER_STORY = '原创成年序列5奥斯里克·维尔（AA4-OSRIC-VALE，G）持自己的AA4-OSRIC-CLUB，在新原苗圃独立净空浅普通壤土外院2米外抵抗。双方原身体可见，有独立心智，无旁人；原普通侧路出口开放、无追逐，可以普通拒绝并离开。原弧光5灵性和小型护术3灵性共用本人实际40灵性，法术不足时原槽只作自有原棍普通打击；COMPOSE只是0灵性、0贡献的普通持棍准备，不是心理法术。本人护腕必须在场外真实付1行动、120便士、4灵性，从独立原材料制作；同一护腕仅3原段。B每次实耗原段与4灵性，知识18成功只使后续一次正BODY/ARC×0.6，最多60秒、轮末失活；失败仍耗段，重复待用不续期，原惰性段与腕架保留、无自动补充。继承旧德鲁伊3灵性知识14完整浅壤土短潜入再出，已核实脚下无地基、管线或生物，不埋敌；旧生命支持仅实际恢复才付4灵性，不清原伤或死亡风险。全部新护腕生命炼成、原材料、时限、人物、预算和现场细节为有限G，不制造人或灵魂、复活、无限素材或独立生命军队。旧马伦结局、原苗、原土道、原标记及原记录不改；完整配方仪式未知，抬棺人3未开放。';
export function createAncientAlchemistEncounterState(): AncientAlchemistEncounterState {
  return { status: 'AVAILABLE', targetId: ANCIENT_ALCHEMIST_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, guardReady: null, guardAttempts: 0, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 4;
const reported = (s: SliceState) => Object.values(s.ancientAlchemist.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => s.ancientAlchemist.encounter.guardReady === null;
function practiceClosed(s: SliceState): boolean {
  return !hasAncientAlchemistLifeLock(s) && Object.values(s.ancientAlchemist.life.cases).every(c => c.status !== 'PREPARED') &&
    !hasDruidOpenPractice(s) && s.druid.encounter.status !== 'FIGHTING' && s.biologist.encounter.status !== 'FIGHTING';
}
export const hasAncientAlchemistEncounterLock = (s: SliceState): boolean => s.ancientAlchemist.encounter.status === 'FIGHTING';
export function validateAncientAlchemistEncounterCommand(v: unknown): v is AncientAlchemistEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>; return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function ancientAlchemistEncounterReason(s: SliceState, _c: AncientAlchemistEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)) return '先成为母亲途径序列4古代炼金师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原苗圃外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际收束全部新旧实践与准备，原苗和基质留在正确原处，原土道、标记及记录已关闭。';
  if (!reported(s)) return '先完成至少一份实际关闭后的古代炼金师报告。';
  if (s.ancientAlchemist.encounter.status !== 'AVAILABLE') return '同一原奥斯里克已有结果，不能再次开战、重生或补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyAncientAlchemistEncounterCommand(s: SliceState, c: AncientAlchemistEncounterCommand, ctx: SeerContext): void {
  if (!validateAncientAlchemistEncounterCommand(c)) throw new Error('古代炼金师遭遇命令无效。');
  const reason = ancientAlchemistEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.ancientAlchemist.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED'; ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通拒绝后沿原苗圃外院开放出口离开，无追逐、瞬移或威慑。奥斯里克原人仍活着、持有自有原棍，H100/M100/S40保留；旧马伦不重开，没有奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ANCIENT_ALCHEMIST_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原奥斯里克的有限真实冲突', ANCIENT_ALCHEMIST_ENCOUNTER_STORY);
}
export function hasAncientAlchemistDisputeOpponent(s: SliceState): boolean {
  const e = s.ancientAlchemist.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'ANCIENT_ALCHEMIST_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 && Number.isSafeInteger(c.round) && c.round >= 1 &&
    Number.isSafeInteger(s.revision) && s.revision >= 0 && Number.isSafeInteger(s.week) && s.week >= 1 &&
    e.status === 'FIGHTING' && e.targetId === ANCIENT_ALCHEMIST_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    e.enemyStatus === 'RESISTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 &&
    (e.guardReady === null || (typeof e.guardReady.guardId === 'string' && typeof e.guardReady.segmentId === 'string')) &&
    Number.isSafeInteger(e.guardAttempts) && e.guardAttempts >= 0 &&
    ANCIENT_ALCHEMIST_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - ANCIENT_ALCHEMIST_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleAncientAlchemistEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.ancientAlchemist.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ANCIENT_ALCHEMIST_DISPUTE') throw new Error('没有同一原奥斯里克的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知古代炼金师冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (e.terminal || e.startHistoryIndex === null || !last || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validateAncientAlchemistRoundOutcome(last.ancientAlchemistOutcome) || last.ancientAlchemistOutcome.continuing ||
      !noEffects(s) || !practiceClosed(s) || last.ancientAlchemistOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人和有限原资源不一致。');
  e.terminal = { outcome: outcome as AncientAlchemistEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('ancient-alchemist-dispute')) award?.('ancient-alchemist-dispute', 25);
  s.combat = null;
  ctx.note('同一原奥斯里克的冲突结束', `${outcome === 'ENEMY_DEAD' ? '原奥斯里克真实死亡，原身体及自己的原棍留在现场，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，生命炼成不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口实际离开，奥斯里克及自己的原棍留在原外院，无追逐或瞬移。' : '原奥斯里克因真实重伤自行停止抵抗，仍活着并保有自己的原棍；不是生命炼成强制服从。'}本轮实际推进60秒G，已激活原护腕段失活；同段惰性物与腕架保留，消耗不退且不自动补充。原浅壤土潜行均已完整再出并恢复稳定。原敌健康${e.enemyHealth}、灵性${e.enemySpirituality}与实用法术保留，不治愈、复活或改写旧马伦。`);
}
export function ancientAlchemistEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原奥斯里克真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: AncientAlchemistEncounterCommand = { type }, reason = ancientAlchemistEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectAncientAlchemistEncounter(s: SliceState): AncientAlchemistEncounterProjection {
  if (!(s.progression.pathwayId==='mother'&&[4,3].includes(s.progression.sequence!))) return { encounter: null };
  const e = s.ancientAlchemist.encounter;
  return { encounter: { ...structuredClone(e), name: '奥斯里克·维尔（原创成年非凡者，G）', story: ANCIENT_ALCHEMIST_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原苗圃独立浅壤土净空外院的开放普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: ANCIENT_ALCHEMIST_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateAncientAlchemistEncounter(s: SliceState): boolean {
  const e = s.ancientAlchemist?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== ANCIENT_ALCHEMIST_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || ANCIENT_ALCHEMIST_POWER_IDS.some(id => !integer(e.powerUses[id], 0)) ||
      e.enemySpirituality !== 40 - ANCIENT_ALCHEMIST_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(s) || !integer(e.guardAttempts, 0) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'ancient-alchemist-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (s.ancientAlchemist.promotionWeek === null) return stableStringify(e) === stableStringify(createAncientAlchemistEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'ANCIENT_ALCHEMIST_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.guardAttempts === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'ANCIENT_ALCHEMIST_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || e.attemptWeek < s.ancientAlchemist.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previous: AncientAlchemistRoundOutcome | undefined, enemyRisk = 0;
  const enemyInjuries: SliceInjury[] = [];
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.ancientAlchemistOutcome;
    if (r.round !== i + 1 || r.winner === null || !validateAncientAlchemistRoundOutcome(o) || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek ||
        o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || stableStringify(o.source.enemyInjuries) !== stableStringify(enemyInjuries)) return false;
    if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.enemySpiritualityBefore !== previous.enemySpirituality ||
        o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
        stableStringify(o.source.powerUses) !== stableStringify(previous.powerUses) || o.source.guardAttempts !== previous.guardAttempts ||
        stableStringify(o.source.guardSegments) !== stableStringify(previous.remainingGuardSegments)
      : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 40 || o.source.guardAttempts !== 0) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    let playerHealth = o.playerHealthBeforeConsequence, enemyHealth = o.source.enemyHealth;
    if (r.winner === 'PLAYER' && r.retreat !== 'SUCCESS' && enemyInjuries.length > 0) enemyRisk++;
    if (r.consequenceWeights !== null) {
      if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS' || !(r.winner === 'PLAYER' ? o.playerActions : o.enemyActions).some(a => a.threatens)) return false;
      const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, severity = r.consequenceRoll <= w.light ? 'LIGHT' : 'HEAVY', damage = severity === 'LIGHT' ? 10 : 30;
      if (r.winner === 'PLAYER') {
        enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage);
        if (!death) enemyInjuries.push({ id: `${s.runId}:combat:${r.round}:ENEMY:${o.source.revision + 1}:${enemyInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
      } else playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
    }
    if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth) return false;
    previous = o;
  }
  const used = own.flatMap(r => r.ancientAlchemistOutcome!.playerActions.flatMap(a => a.guard ? [a.guard] : []));
  if (used.length !== e.guardAttempts || new Set(used.map(g => `${g.guardId}/${g.segmentId}`)).size !== used.length) return false;
  for (const ref of used) {
    const g = s.ancientAlchemist.life.guards.find(g => g.id === ref.guardId);
    if (!g || g.preparedWeek > e.attemptWeek || !g.segments.some(x => x.id === ref.segmentId && x.spentWeek === e.attemptWeek)) return false;
  }
  const actualSpent = s.ancientAlchemist.life.guards.flatMap(g => g.segments.filter(x => x.spentWeek !== null).map(x => ({ guardId: g.id, segmentId: x.id })));
  if (actualSpent.length !== used.length || actualSpent.some(x => !used.some(g => g.guardId === x.guardId && g.segmentId === x.segmentId))) return false;
  for (const r of own) for (const ref of r.ancientAlchemistOutcome!.source.guardSegments) {
    const g = s.ancientAlchemist.life.guards.find(g => g.id === ref.guardId);
    if (!g || g.preparedWeek > e.attemptWeek || !g.segments.some(x => x.id === ref.segmentId)) return false;
  }
  const o = last?.ancientAlchemistOutcome;
  if (stableStringify(enemyInjuries) !== stableStringify(e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      stableStringify(o.powerUses) !== stableStringify(e.powerUses) || o.guardAttempts !== e.guardAttempts)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12))) &&
    t === null && hasAncientAlchemistDisputeOpponent(s) && (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'ANCIENT_ALCHEMIST_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || own.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
