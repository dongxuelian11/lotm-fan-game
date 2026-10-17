import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasMentorDisorderOpenPractice } from '../mentor-disorder/encounter.js';
import { hasFallenEarlLifeLock } from './life.js';
import { validateFallenEarlRoundOutcome, type FallenEarlRoundOutcome } from './combat.js';

export const FALLEN_EARL_TARGET_ID = 'FE4-MARLOW-VENN' as const;
export const FALLEN_EARL_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type FallenEarlPowerId = typeof FALLEN_EARL_POWER_IDS[number];
export type FallenEarlEnemyIntent = FallenEarlPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const FALLEN_EARL_POWERS: readonly { id: FallenEarlPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗赠予（G）', cost: 3, selfGain: 0, enemyReduction: 0 },
];
export interface FallenEarlEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface FallenEarlEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof FALLEN_EARL_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<FallenEarlPowerId, number>; bestowReady: boolean; composureReady: boolean;
  bestowAttempts: number; magnifyUses: number; exploitUses: number;
  terminal: FallenEarlEncounterTerminal | null;
}
export type FallenEarlEncounterCommand = { type: 'BUY_GIFTS' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface FallenEarlEncounterProjection {
  gifts: { held: number; given: number; battleGround: number; summary: string };
  encounter: (FallenEarlEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: FallenEarlPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const FALLEN_EARL_ENCOUNTER_STORY = '原创成年序列5马洛·文恩（FE4-MARLOW-VENN，G）持自己的FE4-MARLOW-CLUB，在原契约铺独立日光净空外院2米外抵抗。双方原身体可见，马洛仍活着、有独立心智；无旁人，原普通出口开放、无追逐，可普通拒绝交手并离开。原弧光、小型护术与凝神共用40灵性，用尽后只持原棍普通打击；凝神实付3灵性、0贡献，清除尚未作用的赠予并仅本轮抵抗新赠予。放大只加强本人当次真实击打，赠予只尝试令原活人暂失斗志，知识18可失败；不能赋予死亡、物品或法规。利用只延长当前已成立的同一原赠物削弱窗口，G上限由一次至两次实际针对本人行动，不创造新状态。原木筹从唯一旧briber库存实际给出，留在本场地面，不要求自愿接住、不复制、不自动归还。所有成本、距离、倍率和预算为有限G；旧里斯、旧伤势与原物不改，不开放狂乱法师3或免费神话形态。';
export function createFallenEarlEncounterState(): FallenEarlEncounterState {
  return { status: 'AVAILABLE', targetId: FALLEN_EARL_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, bestowReady: false, composureReady: false,
    bestowAttempts: 0, magnifyUses: 0, exploitUses: 0, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 4;
const reported = (s: SliceState) => Object.values(s.fallenEarl.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => !s.fallenEarl.encounter.bestowReady && !s.fallenEarl.encounter.composureReady;
function practiceClosed(s: SliceState): boolean {
  return !hasFallenEarlLifeLock(s) && Object.values(s.fallenEarl.life.cases).every(c => c.status !== 'PREPARED') &&
    !hasMentorDisorderOpenPractice(s) && s.mentorDisorder.encounter.status !== 'FIGHTING' && s.corruptionBaron.encounter.status !== 'FIGHTING' &&
    [s.lawyer, s.barbarian, s.briber].every(stage => Object.values(stage.cases).every(c => !c.contactOpen && c.status !== 'PREPARED'));
}
export const hasFallenEarlEncounterLock = (s: SliceState): boolean => s.fallenEarl.encounter.status === 'FIGHTING';
export function validateFallenEarlEncounterCommand(v: unknown): v is FallenEarlEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['BUY_GIFTS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function fallenEarlEncounterReason(s: SliceState, c: FallenEarlEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)) return '先成为黑皇帝途径序列4堕落伯爵。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原契约铺外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际收束全部新旧接触与准备，等待原心理状态恢复、归还同一原箱并落回原垫。';
  if (c.type === 'BUY_GIFTS') return s.cash < 60 ? '三枚独立原木筹需要60便士（G）。' : null;
  if (!reported(s)) return '先完成至少一份实际关闭后的堕落伯爵报告。';
  if (s.fallenEarl.encounter.status !== 'AVAILABLE') return '同一原马洛已有结果，不能再次开战、重生或补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyFallenEarlEncounterCommand(s: SliceState, c: FallenEarlEncounterCommand, ctx: SeerContext): void {
  if (!validateFallenEarlEncounterCommand(c)) throw new Error('堕落伯爵遭遇命令无效。');
  const reason = fallenEarlEncounterReason(s, c); if (reason) throw new Error(reason);
  if (c.type === 'BUY_GIFTS') {
    s.cash -= 60; const start = s.briber.gifts.length + 1; s.briber.giftPacks++;
    for (let i = 0; i < 3; i++) s.briber.gifts.push({ id: `BR7-GIFT-${start + i}`, location: 'PLAYER', destination: null, givenWeek: null });
    ctx.note('实际购买三枚新原木筹', '实付60便士、0行动（G），三枚有独立原编号的新木筹加入唯一旧贿赂者库存；旧已给原物不归还、不复制，原赠物仍留原处。'); return;
  }
  const e = s.fallenEarl.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通表明拒绝交手后沿原外院开放出口实际离开，无追逐、瞬移或赠予控制。马洛仍活着、持有自己的原棍，H100/M100/S40保留；旧里斯不重新登场，原赠物库存不变，没有奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FALLEN_EARL_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原马洛的有限真实冲突', FALLEN_EARL_ENCOUNTER_STORY);
}
export function hasFallenEarlDisputeOpponent(s: SliceState): boolean {
  const e = s.fallenEarl.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'FALLEN_EARL_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && Number.isSafeInteger(c.round) && c.round >= 1 &&
    e.status === 'FIGHTING' && e.targetId === FALLEN_EARL_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    e.enemyStatus === 'RESISTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 &&
    typeof e.bestowReady === 'boolean' && typeof e.composureReady === 'boolean' && !(e.bestowReady && e.composureReady) &&
    [e.bestowAttempts, e.magnifyUses, e.exploitUses].every(n => Number.isSafeInteger(n) && n >= 0) &&
    FALLEN_EARL_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - FALLEN_EARL_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleFallenEarlEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.fallenEarl.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FALLEN_EARL_DISPUTE') throw new Error('没有同一原马洛的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知堕落伯爵冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (e.terminal || e.startHistoryIndex === null || !last || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validateFallenEarlRoundOutcome(last.fallenEarlOutcome) || last.fallenEarlOutcome.continuing ||
      !noEffects(s) || !practiceClosed(s) || last.fallenEarlOutcome.enemySpirituality !== e.enemySpirituality ||
      stableStringify(last.fallenEarlOutcome.giftsAfter) !== stableStringify(s.briber.gifts) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人和有限原资源不一致。');
  e.terminal = { outcome: outcome as FallenEarlEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('fallen-earl-dispute')) award?.('fallen-earl-dispute', 25);
  s.combat = null;
  ctx.note('同一原马洛的冲突结束', `${outcome === 'ENEMY_DEAD' ? '原马洛真实死亡，原身体与自己的原棍仍在现场，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，赠予或利用不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口实际离开，马洛留在原外院，无追逐或瞬移。' : '原马洛因真实重伤自行停止抵抗，仍活着并保有自己的原棍；不是赠予强迫服从。'}未用赠予、原赠物削弱与利用延长、凝神均到期，已付灵性不退；已赠原木筹留在原地，敌方健康${e.enemyHealth}、灵性${e.enemySpirituality}与实用法术保留，不治愈、不补物或改写旧里斯。`);
}
export function fallenEarlEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['BUY_GIFTS', '购买三枚新的原木筹', '0行动 · 60便士 · 原库存'], ['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原马洛真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: FallenEarlEncounterCommand = { type }, reason = fallenEarlEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFallenEarlEncounter(s: SliceState): FallenEarlEncounterProjection {
  const gifts = { held: s.briber.gifts.filter(g => g.location === 'PLAYER').length, given: s.briber.gifts.filter(g => g.location === 'GIVEN').length,
    battleGround: s.briber.gifts.filter(g => g.destination === 'BATTLE:FALLEN_EARL_DISPUTE:GROUND').length,
    summary: '同一旧贿赂者原库存；购买三枚新编号木筹60便士，已赠原物不会自动归还。' };
  if (!(s.progression.pathwayId==='black-emperor'&&[4,3].includes(s.progression.sequence!))) return { encounter: null, gifts };
  const e = s.fallenEarl.encounter;
  return { gifts, encounter: { ...structuredClone(e), name: '马洛·文恩（原创成年非凡者，G）', story: FALLEN_EARL_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原契约铺独立日光净空外院的开放普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: FALLEN_EARL_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateFallenEarlEncounter(s: SliceState): boolean {
  const e = s.fallenEarl?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== FALLEN_EARL_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || FALLEN_EARL_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - FALLEN_EARL_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      e.bestowReady !== false || e.composureReady !== false || ![e.bestowAttempts, e.magnifyUses, e.exploitUses].every(n => integer(n, 0)) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'fallen-earl-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (s.fallenEarl.promotionWeek === null) return stableStringify(e) === stableStringify(createFallenEarlEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'FALLEN_EARL_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.bestowAttempts === 0 && e.magnifyUses === 0 && e.exploitUses === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'FALLEN_EARL_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || e.attemptWeek < s.fallenEarl.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previous: FallenEarlRoundOutcome | undefined, enemyRisk = 0;
  const enemyInjuries: SliceInjury[] = [];
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.fallenEarlOutcome;
    if (r.round !== i + 1 || r.winner === null || !validateFallenEarlRoundOutcome(o) || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek ||
        o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek) return false;
    if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.enemySpiritualityBefore !== previous.enemySpirituality ||
        o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
        stableStringify(o.source.gifts) !== stableStringify(previous.giftsAfter) || stableStringify(o.source.powerUses) !== stableStringify(previous.powerUses) ||
        o.source.bestowAttempts !== previous.bestowAttempts || o.source.magnifyUses !== previous.magnifyUses || o.source.exploitUses !== previous.exploitUses
      : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 40 || o.source.bestowAttempts !== 0 || o.source.magnifyUses !== 0 || o.source.exploitUses !== 0) return false;
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
  }
  const o = last?.fallenEarlOutcome;
  if (stableStringify(enemyInjuries) !== stableStringify(e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      stableStringify(o.powerUses) !== stableStringify(e.powerUses) || o.bestowAttempts !== e.bestowAttempts || o.magnifyUses !== e.magnifyUses || o.exploitUses !== e.exploitUses)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
    s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && stableStringify(s.briber.gifts) === stableStringify(o.giftsAfter))) && t === null && hasFallenEarlDisputeOpponent(s) &&
    s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) &&
    (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'FALLEN_EARL_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || own.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  // Later purchases and other uses may change held gifts. Every original already given in this battle stays where it actually landed.
  if (o.giftsAfter.some(g => g.destination === 'BATTLE:FALLEN_EARL_DISPUTE:GROUND' && stableStringify(s.briber.gifts.find(x => x.id === g.id)) !== stableStringify(g))) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
