import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasMysticLifeLock } from './life.js';
import { hasMysticRitualLock } from './ritual.js';
import { validateMysticRoundOutcome } from './combat.js';

export const MYSTIC_TARGET_ID = 'MY4-LUCAN-VEY' as const;
export const MYSTIC_POWER_IDS = ['ARC_BOLT', 'WARD'] as const;
export type MysticPowerId = typeof MYSTIC_POWER_IDS[number];
export type MysticEnemyIntent = MysticPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const MYSTIC_POWERS: readonly { id: MysticPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
];
export interface MysticEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface MysticEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof MYSTIC_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<MysticPowerId, number>;
  focused: boolean; cageReady: boolean; echoReady: boolean;
  terminal: MysticEncounterTerminal | null;
}
export type MysticEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface MysticEncounterProjection {
  encounter: (MysticEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 4; noBystanders: true;
    abilities: { id: MysticPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const MYSTIC_ENCOUNTER_STORY = '原创成年序列5对手卢坎·维伊（MY4-LUCAN-VEY，G）在原教学室独立净空附院4米外，持自己的MY4-LUCAN-CLUB；仅有原弧光术、小型护术与有限40灵性。原场无旁人或同伴，普通出口开放、没有追逐，不代表友军免疫。可以普通拒绝交手并离开。旧布莱斯的真实结局、原物和历史不变。原星光牢笼仅可失败地限制下一次正贡献身体打击；本人实际研究学会的迟钟回声仅可失败地削弱下一次实际付费法术的正贡献，不能取消费用或控制思想。未知故事、血液、自由文字与下序列预言均不可作为免费法术。人物、场景、力量、距离、成本和数字均为本作G。';
export function createMysticEncounterState(): MysticEncounterState {
  return { status: 'AVAILABLE', targetId: MYSTIC_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0 }, focused: false, cageReady: false, echoReady: false, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && [4,3].includes(s.progression.sequence!);
const reported = (s: SliceState) => Object.values(s.mystic.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => !s.mystic.encounter.focused && !s.mystic.encounter.cageReady && !s.mystic.encounter.echoReady;
/** The owned S5 glasses may be lifted only by this encounter's actual finite focus. */
function practiceClosed(s: SliceState, allowFocus = false): boolean {
  const p = s.starMystic.practice, e = s.mystic.encounter;
  return !hasMysticLifeLock(s) && !hasMysticRitualLock(s) && p.screen === 'SHUT' && !p.cageActive &&
    p.companionNode === 'WAITING' && p.playerNode === 'ROOM' &&
    (p.lenses !== 'HELD' || (allowFocus && e.focused)) &&
    !s.starMystic.encounter.focused && !s.starMystic.encounter.cageReady &&
    Object.values(s.starMystic.cases).every(c => !c.contactOpen && c.status !== 'PREPARED') &&
    Object.values(s.scrollProfessor.cases).every(c => !c.contactOpen && c.status !== 'PREPARED');
}
export const hasMysticEncounterLock = (s: SliceState): boolean => s.mystic.encounter.status === 'FIGHTING';
export function validateMysticEncounterCommand(v: unknown): v is MysticEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function mysticEncounterReason(s: SliceState, _c: MysticEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)||s.progression.sequence!==4) return '保留原神秘学家对手与结局，当前阶段不重新开战。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原教学室独立附院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先关闭原分析、戴回原眼镜、让本人和原同伴沿原路返回，并关闭生活接触与准备。';
  if (!reported(s)) return '先完成至少一份真实关闭后的神秘学家报告。';
  if (s.mystic.encounter.status !== 'AVAILABLE') return '同一原卢坎已有结果，不能再次开战、重生或重新补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyMysticEncounterCommand(s: SliceState, c: MysticEncounterCommand, ctx: SeerContext): void {
  if (!validateMysticEncounterCommand(c)) throw new Error('神秘学家遭遇命令无效。');
  const reason = mysticEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.mystic.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通表明不接受交手，沿原附院开放出口实际离开，无追逐或瞬移。原卢坎仍活着并持自己的原棍，H100/M100/S40保留；没有法术控制、奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MYSTIC_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原卢坎的有限真实冲突', MYSTIC_ENCOUNTER_STORY);
}
export function hasMysticDisputeOpponent(s: SliceState): boolean {
  const e = s.mystic.encounter, c = s.combat;
  return promoted(s) && s.progression.sequence===4 && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s, true) && reported(s) &&
    c?.encounterId === 'MYSTIC_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === MYSTIC_TARGET_ID && e.terminal === null &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 && e.attemptWeek === s.week &&
    typeof e.focused === 'boolean' && typeof e.cageReady === 'boolean' && typeof e.echoReady === 'boolean' &&
    e.focused === (s.starMystic.practice.lenses === 'HELD') && (!e.echoReady || s.mystic.life.echoLearned) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleMysticEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.mystic.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'MYSTIC_DISPUTE') throw new Error('没有同一原卢坎的真实冲突。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last ||
      c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      !validateMysticRoundOutcome(last.mysticOutcome) || !noEffects(s) || !practiceClosed(s) ||
      last.mysticOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及有限原资源不一致。');
  e.terminal = { outcome: outcome as MysticEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('mystic-dispute')) award?.('mystic-dispute', 25);
  s.combat = null;
  ctx.note('同一原卢坎的冲突结束', `${outcome === 'ENEMY_DEAD' ? '同一原卢坎真实死亡，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，故事与原眼镜不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口退出，原卢坎留在原附院，没有追逐或瞬移。' : '原卢坎因真实重伤自行停止抵抗，仍活着，原棍归属不变；不是法术强迫服从。'}本轮星光、回声和聚焦全部结束，原眼镜戴回；原健康${e.enemyHealth}、灵性${e.enemySpirituality}及实际法术记录保留，不治愈、不补库存、不改旧布莱斯。`);
}
export function mysticEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原卢坎真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: MysticEncounterCommand = { type }, reason = mysticEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectMysticEncounter(s: SliceState): MysticEncounterProjection {
  if (!promoted(s)) return { encounter: null };
  const e = s.mystic.encounter;
  return { encounter: { ...structuredClone(e), name: '卢坎·维伊（原创成年非凡者，G）', story: MYSTIC_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原教学室独立净空附院的开放普通出口', pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: MYSTIC_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateMysticEncounter(s: SliceState): boolean {
  const e = s.mystic?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== MYSTIC_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 2 || MYSTIC_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - MYSTIC_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      typeof e.focused !== 'boolean' || typeof e.cageReady !== 'boolean' || typeof e.echoReady !== 'boolean' || !noEffects(s) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'mystic-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (!promoted(s)) return stableStringify(e) === stableStringify(createMysticEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'MYSTIC_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'MYSTIC_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || s.mystic.promotionWeek === null || e.attemptWeek < s.mystic.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previousSpirituality = 40, previousHealth = 100, previousMind = 100;
  const uses: Record<MysticPowerId, number> = { ARC_BOLT: 0, WARD: 0 };
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.mysticOutcome;
    if (r.round !== i + 1 || r.winner === null || (i < own.length - 1 && (r.retreat === 'SUCCESS' || o?.enemyStatus !== 'RESISTING')) || !validateMysticRoundOutcome(o) ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
        o.enemySpiritualityBefore !== previousSpirituality || o.source.enemyHealth !== previousHealth || o.source.enemyMind !== previousMind ||
        (o.source.echoLearned && !s.mystic.life.echoLearned) || (o.source.publicDisclosed && !s.mystic.life.publicDisclosed)) return false;
    for (const a of o.enemyActions) if (a.paidCost > 0) uses[a.planned as MysticPowerId]++;
    if (stableStringify(uses) !== stableStringify(o.powerUses)) return false;
    previousSpirituality = o.enemySpirituality; previousHealth = o.enemyHealth; previousMind = o.enemyMind;
  }
  const o = last?.mysticOutcome;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || stableStringify(o.powerUses) !== stableStringify(e.powerUses))) return false;
  if (e.status === 'FIGHTING') return t === null && hasMysticDisputeOpponent(s) &&
    (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40) &&
    s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) &&
    (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'MYSTIC_DISPUTE' || !t || !last || !o || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
