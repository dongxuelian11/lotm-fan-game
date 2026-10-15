import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasPunishmentKnightOpenPractice } from '../punishment-knight/encounter.js';
import { hasImperativeMageLifeLock } from './life.js';
import { validateImperativeMageRoundOutcome, type ImperativeMageRoundOutcome } from './combat.js';

export const IMPERATIVE_MAGE_TARGET_ID = 'IM4-ROWAN-KELL' as const;
export const IMPERATIVE_MAGE_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type ImperativeMagePowerId = typeof IMPERATIVE_MAGE_POWER_IDS[number];
export type ImperativeMageEnemyIntent = ImperativeMagePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const IMPERATIVE_MAGE_POWERS: readonly { id: ImperativeMagePowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗新震慑与剥夺（G）', cost: 3, selfGain: 0, enemyReduction: 0 },
];
export interface ImperativeMageEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ImperativeMageEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof IMPERATIVE_MAGE_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<ImperativeMagePowerId, number>; intimidationReady: boolean; deprivationReady: boolean; composureReady: boolean;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number; terminal: ImperativeMageEncounterTerminal | null;
}
export type ImperativeMageEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface ImperativeMageEncounterProjection {
  encounter: (ImperativeMageEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: ImperativeMagePowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const IMPERATIVE_MAGE_ENCOUNTER_STORY = '原创成年序列5罗温·凯尔（IM4-ROWAN-KELL，G）持自己的IM4-ROWAN-CLUB，在原调解处独立日光净空外院2米外抵抗。双方原身体实际可见、原人有独立心智，无旁人，普通出口开放、无追逐，可普通拒绝并离开。原弧光、小型护术与凝神共用实际40灵性，用尽后只持自有原棍普通打击。有限震慑只削弱后续一次正BODY/ARC；暂剥只针对同一原弧光，本轮后续ARC原槽改真实普通棍击，0法术消耗，不删除行动或永久能力。凝神实付3灵性清除并仅本轮抵抗新震慑与剥夺。旧禁令在真实身体动作才判一次抵抗；旧惩戒只从抵抗后实际正贡献敌方BODY取来源；裁断只用已记录原敌旧伤。回合末全部短效结束，同一原能力恢复，费用不退。原著能力例有0-08编排背景，全部距离、预算、时限与数值均为本作有限G，不保证跨位阶成功、真话、服从、直接死亡或统一两条上限。旧迪恩结局、旧人物及原物不改；完整配方与仪式未知，混乱猎手3未开放。';
export function createImperativeMageEncounterState(): ImperativeMageEncounterState {
  return { status: 'AVAILABLE', targetId: IMPERATIVE_MAGE_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, intimidationReady: false, deprivationReady: false, composureReady: false,
    intimidationAttempts: 0, deprivationAttempts: 0, punishmentUses: 0, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 4;
const reported = (s: SliceState) => Object.values(s.imperativeMage.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => s.imperativeMage.encounter.intimidationReady === false && s.imperativeMage.encounter.deprivationReady === false && s.imperativeMage.encounter.composureReady === false;
function practiceClosed(s: SliceState): boolean {
  return !hasImperativeMageLifeLock(s) && Object.values(s.imperativeMage.life.cases).every(c => c.status !== 'PREPARED') &&
    !hasPunishmentKnightOpenPractice(s) && s.punishmentKnight.encounter.status !== 'FIGHTING' && s.judge.encounter.status !== 'FIGHTING' &&
    [s.arbiter, s.sheriff, s.interrogator].every(stage => Object.values(stage.cases).every(c => !c.contactOpen && c.status !== 'PREPARED'));
}
export const hasImperativeMageEncounterLock = (s: SliceState): boolean => s.imperativeMage.encounter.status === 'FIGHTING';
export function validateImperativeMageEncounterCommand(v: unknown): v is ImperativeMageEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>; return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function imperativeMageEncounterReason(s: SliceState, _c: ImperativeMageEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)) return '先成为审判者途径序列4律令法师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德原调解处外院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先实际收束全部新旧接触与准备，恢复原注意和原灯光，归还原物并撤除原地线。';
  if (!reported(s)) return '先完成至少一份实际关闭后的律令法师报告。';
  if (s.imperativeMage.encounter.status !== 'AVAILABLE') return '同一原罗温已有结果，不能再次开战、重生或补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyImperativeMageEncounterCommand(s: SliceState, c: ImperativeMageEncounterCommand, ctx: SeerContext): void {
  if (!validateImperativeMageEncounterCommand(c)) throw new Error('律令法师遭遇命令无效。');
  const reason = imperativeMageEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.imperativeMage.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED'; ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通拒绝后沿原调解处外院开放出口离开，无追逐、瞬移或威慑。罗温原人仍活着、持有自有原棍，H100/M100/S40保留；旧迪恩不重开，没有奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'IMPERATIVE_MAGE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原罗温的有限真实冲突', IMPERATIVE_MAGE_ENCOUNTER_STORY);
}
export function hasImperativeMageDisputeOpponent(s: SliceState): boolean {
  const e = s.imperativeMage.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'IMPERATIVE_MAGE_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 && Number.isSafeInteger(c.round) && c.round >= 1 &&
    Number.isSafeInteger(s.revision) && s.revision >= 0 && Number.isSafeInteger(s.week) && s.week >= 1 &&
    e.status === 'FIGHTING' && e.targetId === IMPERATIVE_MAGE_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    e.enemyStatus === 'RESISTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 &&
    typeof e.intimidationReady === 'boolean' && typeof e.deprivationReady === 'boolean' && typeof e.composureReady === 'boolean' &&
    !(e.composureReady && (e.intimidationReady || e.deprivationReady)) &&
    [e.intimidationAttempts, e.deprivationAttempts, e.punishmentUses].every(n => Number.isSafeInteger(n) && n >= 0) &&
    IMPERATIVE_MAGE_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - IMPERATIVE_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleImperativeMageEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.imperativeMage.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'IMPERATIVE_MAGE_DISPUTE') throw new Error('没有同一原罗温的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知律令法师冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (e.terminal || e.startHistoryIndex === null || !last || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validateImperativeMageRoundOutcome(last.imperativeMageOutcome) || last.imperativeMageOutcome.continuing ||
      !noEffects(s) || !practiceClosed(s) || last.imperativeMageOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人和有限原资源不一致。');
  e.terminal = { outcome: outcome as ImperativeMageEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('imperative-mage-dispute')) award?.('imperative-mage-dispute', 25);
  s.combat = null;
  ctx.note('同一原罗温的冲突结束', `${outcome === 'ENEMY_DEAD' ? '原罗温真实死亡，原身体及自己的原棍留在现场，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，律令不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口实际离开，罗温及自己的原棍留在原外院，无追逐或瞬移。' : '原罗温因真实重伤自行停止抵抗，仍活着并保有自己的原棍；不是震慑强制服从。'}本轮震慑、暂剥、凝神、身体禁令与待用惩戒全部结束；同一原弧光能力恢复可用身份，已付灵性不退。原敌健康${e.enemyHealth}、灵性${e.enemySpirituality}与实用法术保留，不治愈、复活或改写旧迪恩。`);
}
export function imperativeMageEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原罗温真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: ImperativeMageEncounterCommand = { type }, reason = imperativeMageEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectImperativeMageEncounter(s: SliceState): ImperativeMageEncounterProjection {
  if (!(s.progression.pathwayId==='justiciar'&&[4,3].includes(s.progression.sequence!))) return { encounter: null };
  const e = s.imperativeMage.encounter;
  return { encounter: { ...structuredClone(e), name: '罗温·凯尔（原创成年非凡者，G）', story: IMPERATIVE_MAGE_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原调解处独立日光净空外院的开放普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: IMPERATIVE_MAGE_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost && !(p.id === 'ARC_BOLT' && e.deprivationReady) })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateImperativeMageEncounter(s: SliceState): boolean {
  const e = s.imperativeMage?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== IMPERATIVE_MAGE_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || IMPERATIVE_MAGE_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - IMPERATIVE_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(s) || ![e.intimidationAttempts, e.deprivationAttempts, e.punishmentUses].every(n => integer(n, 0)) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'imperative-mage-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (s.imperativeMage.promotionWeek === null) return stableStringify(e) === stableStringify(createImperativeMageEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'IMPERATIVE_MAGE_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.intimidationAttempts === 0 && e.deprivationAttempts === 0 && e.punishmentUses === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'IMPERATIVE_MAGE_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || e.attemptWeek < s.imperativeMage.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previous: ImperativeMageRoundOutcome | undefined, enemyRisk = 0;
  const enemyInjuries: SliceInjury[] = [];
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.imperativeMageOutcome;
    if (r.round !== i + 1 || r.winner === null || !validateImperativeMageRoundOutcome(o) || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek ||
        o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || stableStringify(o.source.enemyInjuries) !== stableStringify(enemyInjuries)) return false;
    if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.enemySpiritualityBefore !== previous.enemySpirituality ||
        o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
        stableStringify(o.source.powerUses) !== stableStringify(previous.powerUses) || o.source.intimidationAttempts !== previous.intimidationAttempts ||
        o.source.deprivationAttempts !== previous.deprivationAttempts || o.source.punishmentUses !== previous.punishmentUses
      : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 40 || o.source.intimidationAttempts !== 0 || o.source.deprivationAttempts !== 0 || o.source.punishmentUses !== 0) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    let playerHealth = o.source.playerHealth, enemyHealth = o.source.enemyHealth;
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
  const o = last?.imperativeMageOutcome;
  if (stableStringify(enemyInjuries) !== stableStringify(e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      stableStringify(o.powerUses) !== stableStringify(e.powerUses) || o.intimidationAttempts !== e.intimidationAttempts || o.deprivationAttempts !== e.deprivationAttempts || o.punishmentUses !== e.punishmentUses)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12))) &&
    t === null && hasImperativeMageDisputeOpponent(s) && (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'IMPERATIVE_MAGE_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || own.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
