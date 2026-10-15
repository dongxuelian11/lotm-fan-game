import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasBlackKnightLifeLock } from './life.js';
import { validateBlackKnightRoundOutcome, type BlackKnightRoundOutcome } from './combat.js';

export const BLACK_KNIGHT_TARGET_ID = 'BK4-GARRICK-NOLL' as const;
export const BLACK_KNIGHT_POWER_IDS = ['ARC_BOLT', 'WARD'] as const;
export type BlackKnightPowerId = typeof BLACK_KNIGHT_POWER_IDS[number];
export type BlackKnightEnemyIntent = BlackKnightPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const BLACK_KNIGHT_POWERS: readonly { id: BlackKnightPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
];
export interface BlackKnightEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface BlackKnightEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof BLACK_KNIGHT_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<BlackKnightPowerId, number>;
  shadowReady: boolean; bladeReady: boolean; wardIgnored: boolean;
  terminal: BlackKnightEncounterTerminal | null;
}
export type BlackKnightEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface BlackKnightEncounterProjection {
  encounter: (BlackKnightEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 4; noBystanders: true;
    abilities: { id: BlackKnightPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const BLACK_KNIGHT_ENCOUNTER_STORY = '原创成年序列5加里克·诺尔（BK4-GARRICK-NOLL，G）在原指导室独立日光净空附院4米外，持自己的BK4-GARRICK-CLUB，具原有限弧光术、小型护术与40灵性。在本场已明确的争执中，他承认以伤人为手段勒索场地使用者并准备实际攻击；这项具体堕落意图是本场预写事实，不是扫描所有人的善恶。双方原身体与加里克脚下原影真实可见，原地面净空；无旁人、同伴或追逐，普通出口开放，也不代表友军免疫。可普通拒绝并离开。灵肉之刃必须实际付费、对原人形成正攻击贡献，至多忽略本轮一次实际付费小护术；不保证击杀。操纵原影只可抵抗地限制下一正贡献身体打击，不能控制思想。原伊芮斯只能按当前原灵与已选方法借用；已释放塞德里克、旧埃尔顿和旧储备不重生或补满。堕落之影独立生物不会进入本场当宠物。人物、场景、意图、法术、距离、成本与数值均为本作G。';
export function createBlackKnightEncounterState(): BlackKnightEncounterState {
  return { status: 'AVAILABLE', targetId: BLACK_KNIGHT_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0 }, shadowReady: false, bladeReady: false, wardIgnored: false, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && [4,3,2].includes(s.progression.sequence!);
const reported = (s: SliceState) => Object.values(s.blackKnight.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => !s.blackKnight.encounter.shadowReady && !s.blackKnight.encounter.bladeReady && !s.blackKnight.encounter.wardIgnored;
function practiceClosed(s: SliceState): boolean {
  const p = s.shepherd.practice;
  return !hasBlackKnightLifeLock(s) && Object.values(s.blackKnight.life.cases).every(c => c.status !== 'PREPARED') &&
    !s.blackKnight.life.shadow.bound && !s.blackKnight.life.panel.bladeActive && !s.blackKnight.life.card.borrowing && p.paper === 'TABLE' && !p.chorusOpen && p.note !== 'WRITTEN' && p.playerNode === 'DESK' &&
    !s.shepherd.encounter.blurReady && s.shepherd.encounter.status !== 'FIGHTING' &&
    Object.values(s.shepherd.cases).every(c => !c.contactOpen && c.status !== 'PREPARED') &&
    s.roseBishop.practice.shape === 'NORMAL' &&
    Object.values(s.roseBishop.cases).every(c => !c.contactOpen && c.status !== 'PREPARED');
}
export const hasBlackKnightEncounterLock = (s: SliceState): boolean => s.blackKnight.encounter.status === 'FIGHTING';
export function validateBlackKnightEncounterCommand(v: unknown): v is BlackKnightEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function blackKnightEncounterReason(s: SliceState, _c: BlackKnightEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)||s.progression.sequence!==4) return '保留原黑骑士对手与结局，当前阶段不重新开战。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原指导室独立附院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先关闭原生活接触与准备，实际归还原卡和身体；若已生成独立影子，沿原路退出并实际移交或隔离，收束旧牧羊人实践。';
  if (!reported(s)) return '先完成至少一份真实关闭后的黑骑士报告。';
  if (s.blackKnight.encounter.status !== 'AVAILABLE') return '同一原加里克已有结果，不能再次开战、重生或重新补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyBlackKnightEncounterCommand(s: SliceState, c: BlackKnightEncounterCommand, ctx: SeerContext): void {
  if (!validateBlackKnightEncounterCommand(c)) throw new Error('黑骑士遭遇命令无效。');
  const reason = blackKnightEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.blackKnight.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通表明不接受交手，沿原附院开放出口实际离开，无追逐或瞬移。原加里克仍活着并持自己的原棍，H100/M100/S40保留；没有法术控制、奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'BLACK_KNIGHT_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原加里克的有限真实冲突', BLACK_KNIGHT_ENCOUNTER_STORY);
}
export function hasBlackKnightDisputeOpponent(s: SliceState): boolean {
  const e = s.blackKnight.encounter, c = s.combat;
  return promoted(s) && s.progression.sequence===4 && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) &&
    c?.encounterId === 'BLACK_KNIGHT_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === BLACK_KNIGHT_TARGET_ID && e.terminal === null &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 && e.attemptWeek === s.week &&
    typeof e.shadowReady === 'boolean' && typeof e.bladeReady === 'boolean' && typeof e.wardIgnored === 'boolean' &&
    BLACK_KNIGHT_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - BLACK_KNIGHT_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleBlackKnightEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.blackKnight.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'BLACK_KNIGHT_DISPUTE') throw new Error('没有同一原加里克的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知黑骑士冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last ||
      c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      !validateBlackKnightRoundOutcome(last.blackKnightOutcome) || !noEffects(s) || !practiceClosed(s) ||
      last.blackKnightOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及有限原资源不一致。');
  e.terminal = { outcome: outcome as BlackKnightEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('black-knight-dispute')) award?.('black-knight-dispute', 25);
  s.combat = null;
  ctx.note('同一原加里克的冲突结束', `${outcome === 'ENEMY_DEAD' ? '同一原加里克真实死亡，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，灵肉之刃与原灵不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口退出，原加里克留在原附院，没有追逐或瞬移。' : '原加里克因真实重伤自行停止抵抗，仍活着，原棍归属不变；不是法术强迫服从。'}本轮原影限制与破防机会全部结束，原灵仍留在本人之内；原健康${e.enemyHealth}、灵性${e.enemySpirituality}及实际法术记录保留，不治愈、不补库存、不改旧埃尔顿或释放的塞德里克。`);
}
export function blackKnightEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原加里克真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: BlackKnightEncounterCommand = { type }, reason = blackKnightEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectBlackKnightEncounter(s: SliceState): BlackKnightEncounterProjection {
  if (!promoted(s)) return { encounter: null };
  const e = s.blackKnight.encounter;
  return { encounter: { ...structuredClone(e), name: '加里克·诺尔（原创成年非凡者，G）', story: BLACK_KNIGHT_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原指导室独立净空附院的开放普通出口', pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: BLACK_KNIGHT_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateBlackKnightEncounter(s: SliceState): boolean {
  const e = s.blackKnight?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== BLACK_KNIGHT_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 2 || BLACK_KNIGHT_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - BLACK_KNIGHT_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      typeof e.shadowReady !== 'boolean' || typeof e.bladeReady !== 'boolean' || typeof e.wardIgnored !== 'boolean' || !noEffects(s) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'black-knight-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (!promoted(s)) return stableStringify(e) === stableStringify(createBlackKnightEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'BLACK_KNIGHT_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'BLACK_KNIGHT_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || s.blackKnight.promotionWeek === null || e.attemptWeek < s.blackKnight.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previousSpirituality = 40, previousHealth = 100, previousMind = 100;
  const uses: Record<BlackKnightPowerId, number> = { ARC_BOLT: 0, WARD: 0 };
  let previous: BlackKnightRoundOutcome | undefined;
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.blackKnightOutcome;
    if (r.round !== i + 1 || r.winner === null || (i < own.length - 1 && (r.retreat === 'SUCCESS' || o?.enemyStatus !== 'RESISTING')) || !validateBlackKnightRoundOutcome(o) ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
        o.enemySpiritualityBefore !== previousSpirituality || o.source.enemyHealth !== previousHealth || o.source.enemyMind !== previousMind) return false;
    if (previous && (o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.source.reservePoints !== previous.playerReserveAfter)) return false;
    if (o.source.activeSpiritId !== null) {
      const original = s.shepherd.grazing.spirits.filter(x => x.id === o.source.activeSpiritId);
      if (original.length !== 1 || original[0]!.acquiredWeek !== o.source.spiritAcquiredWeek ||
          !['GRAZED', 'RELEASED'].includes(original[0]!.status) ||
          (original[0]!.releasedWeek !== null && original[0]!.releasedWeek! < e.attemptWeek) ||
          stableStringify(original[0]!.selectedAbilities) !== stableStringify(o.source.selectedAbilities)) return false;
    }
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    const healed = o.source.playerHealth + o.playerActions.reduce((n, a) => n + a.healthRestored, 0);
    let playerHealth = healed, enemyHealth = o.source.enemyHealth;
    if (r.consequenceWeights !== null) {
      if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS') return false;
      const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, damage = r.consequenceRoll <= w.light ? 10 : 30;
      if (r.winner === 'PLAYER') enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage);
      else playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
    }
    if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth) return false;
    previous = o;
    for (const a of o.enemyActions) if (a.paidCost > 0) uses[a.planned as BlackKnightPowerId]++;
    if (stableStringify(uses) !== stableStringify(o.powerUses)) return false;
    previousSpirituality = o.enemySpirituality; previousHealth = o.enemyHealth; previousMind = o.enemyMind;
  }
  const o = last?.blackKnightOutcome;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || stableStringify(o.powerUses) !== stableStringify(e.powerUses))) return false;
  if (e.status === 'FIGHTING') return t === null && hasBlackKnightDisputeOpponent(s) &&
    (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40) &&
    s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) &&
    (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'BLACK_KNIGHT_DISPUTE' || !t || !last || !o || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
