import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasDevilLifeLock } from './life.js';
import { validateDevilRoundOutcome, type DevilRoundOutcome } from './combat.js';

export const DEVIL_TARGET_ID = 'DV4-ORRICK-FANE' as const;
export const DEVIL_POWER_IDS = ['ARC_BOLT', 'WARD'] as const;
export type DevilPowerId = typeof DEVIL_POWER_IDS[number];
export type DevilEnemyIntent = DevilPowerId | 'BODY_STRIKE' | 'COMPOSE' | 'ACCIDENT';
export const DEVIL_POWERS: readonly { id: DevilPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
];
export interface DevilEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface DevilEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof DEVIL_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<DevilPowerId, number>;
  emotion: 'STRONG' | 'CALM'; seedPlanted: boolean; lastSeedRound: number | null; staggerReady: boolean;
  seedAttempts: number; catalysisAttempts: number; composeUses: number;
  terminal: DevilEncounterTerminal | null;
}
export type DevilEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface DevilEncounterProjection {
  encounter: (DevilEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 4; noBystanders: true;
    abilities: { id: DevilPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const DEVIL_ENCOUNTER_STORY = '原创成年序列5奥里克·费恩（DV4-ORRICK-FANE，G）在原指导室独立净空附院4米外，持自己的DV4-ORRICK-CLUB，具原有限弧光术、小型护术与40灵性。因仓门钥匙被拒，他明确说自己愤怒、紧绷肩膀，构成本场实际强烈情绪入口；不是所有敌人天生激动。他实际执行COMPOSE时会放缓呼吸并明确说自己先冷静，获得普通8战势，此后本场永久CALM、原种子失效，不凭空重新愤怒。双方身体真实可见，地面净空、无旁人或追逐，普通出口开放；可拒绝并实际离开。新4埋种与催化是本作G强化训练：4灵性知识18埋种，埋种轮及后两轮有效；后续3灵性知识18催化原种子，失败也消费。成功只使本轮下一次正贡献身体打击或实际付费弧光贡献减半，不取消法术、不影响护术、不直接伤害或强迫投降。旧恶魔负荷原值延续，不自动归零；旧费兰和莫顿不重开。人物、场景、距离、费用与数值均为G，不代表完整原著序列4能力。';
export function createDevilEncounterState(): DevilEncounterState {
  return { status: 'AVAILABLE', targetId: DEVIL_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0 }, emotion: 'STRONG', seedPlanted: false, lastSeedRound: null, staggerReady: false,
    seedAttempts: 0, catalysisAttempts: 0, composeUses: 0, terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && [4,3,2].includes(s.progression.sequence!);
const reported = (s: SliceState) => Object.values(s.devil.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => !s.devil.encounter.seedPlanted && !s.devil.encounter.staggerReady;
function practiceClosed(s: SliceState): boolean {
  const p = s.desireApostle.practice;
  return !hasDevilLifeLock(s) && Object.values(s.devil.life.cases).every(c => c.status !== 'PREPARED') &&
    p.ledger === 'GUIDE' && p.note !== 'WRITTEN' && p.seed !== 'PLANTED' && p.emotion === 'CALM' &&
    s.desireApostle.encounter.status !== 'FIGHTING' && !s.desireApostle.encounter.seedPlanted && !s.desireApostle.encounter.staggerReady &&
    Object.values(s.desireApostle.cases).every(c => !c.contactOpen && c.status !== 'PREPARED') &&
    s.demon.practice.body === 'NORMAL' && s.demon.practice.flame !== 'LIT' &&
    Object.values(s.demon.cases).every(c => !c.contactOpen && c.status !== 'PREPARED');
}
export const hasDevilEncounterLock = (s: SliceState): boolean => s.devil.encounter.status === 'FIGHTING';
export function validateDevilEncounterCommand(v: unknown): v is DevilEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function devilEncounterReason(s: SliceState, _c: DevilEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)||s.progression.sequence!==4) return '保留原魔鬼对手与结局，当前阶段不重新开战。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原指导室独立附院。';
  if (!practiceClosed(s) || !noEffects(s)) return '先关闭新旧生活接触和准备，实际收束种子、邀请与原笔记；旧账册须已归还，旧恶魔身体与火焰须收束。';
  if (!reported(s)) return '先完成至少一份真实关闭后的魔鬼报告。';
  if (s.devil.encounter.status !== 'AVAILABLE') return '同一原奥里克已有结果，不能再次开战、重生或重新补灵性。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyDevilEncounterCommand(s: SliceState, c: DevilEncounterCommand, ctx: SeerContext): void {
  if (!validateDevilEncounterCommand(c)) throw new Error('魔鬼遭遇命令无效。');
  const reason = devilEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.devil.encounter; s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通拒绝交手并沿原出口离开', '实付1行动，本人普通表明不接受交手，沿原附院开放出口实际离开，无追逐或瞬移。原奥里克仍活着并持自己的原棍，H100/M100/S40保留；没有法术控制、奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DEVIL_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原奥里克的有限真实冲突', DEVIL_ENCOUNTER_STORY);
}
export function hasDevilDisputeOpponent(s: SliceState): boolean {
  const e = s.devil.encounter, c = s.combat;
  return promoted(s) && s.progression.sequence===4 && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) &&
    c?.encounterId === 'DEVIL_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === DEVIL_TARGET_ID && e.terminal === null &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 && e.attemptWeek === s.week &&
    ['STRONG', 'CALM'].includes(e.emotion) && typeof e.seedPlanted === 'boolean' && typeof e.staggerReady === 'boolean' &&
    (e.emotion === 'CALM' ? !e.seedPlanted && e.composeUses > 0 : e.composeUses === 0) &&
    Number.isSafeInteger(e.seedAttempts) && e.seedAttempts >= 0 && Number.isSafeInteger(e.catalysisAttempts) && e.catalysisAttempts >= 0 && e.catalysisAttempts <= e.seedAttempts &&
    Number.isSafeInteger(e.composeUses) && e.composeUses >= 0 &&
    (e.lastSeedRound === null ? !e.seedPlanted && e.seedAttempts === 0 : Number.isSafeInteger(e.lastSeedRound) && e.lastSeedRound >= 1 && e.lastSeedRound <= c.round && e.seedAttempts > 0) &&
    (!e.seedPlanted || c.round <= e.lastSeedRound! + 2) &&
    DEVIL_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - DEVIL_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDevilEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.devil.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'DEVIL_DISPUTE') throw new Error('没有同一原奥里克的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知魔鬼冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last ||
      c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      !validateDevilRoundOutcome(last.devilOutcome) || last.devilOutcome.continuing || !noEffects(s) || !practiceClosed(s) ||
      last.devilOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及有限原资源不一致。');
  e.terminal = { outcome: outcome as DevilEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('devil-dispute')) award?.('devil-dispute', 25);
  s.combat = null;
  ctx.note('同一原奥里克的冲突结束', `${outcome === 'ENEMY_DEAD' ? '同一原奥里克真实死亡，不生成替身或新敌。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，情绪能力不能复活。' : outcome === 'RETREATED' ? '本人沿原普通出口退出，原奥里克留在原附院，没有追逐或瞬移。' : '原奥里克因真实重伤自行停止抵抗，仍活着，原棍归属不变；不是法术强迫服从。'}本场原种子与迟疑全部结束，实付灵性与旧负荷不退；原健康${e.enemyHealth}、灵性${e.enemySpirituality}及实际法术记录保留，不治愈、不补灵性、不改旧费兰或莫顿，也不强迫原奥里克重新愤怒。`);
}
export function devilEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原奥里克真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: DevilEncounterCommand = { type }, reason = devilEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectDevilEncounter(s: SliceState): DevilEncounterProjection {
  if (!promoted(s)) return { encounter: null };
  const e = s.devil.encounter;
  return { encounter: { ...structuredClone(e), name: '奥里克·费恩（原创成年非凡者，G）', story: DEVIL_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原指导室独立净空附院的开放普通出口', pursuit: false, distanceMetres: 4, noBystanders: true,
    abilities: DEVIL_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateDevilEncounter(s: SliceState): boolean {
  const e = s.devil?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== DEVIL_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 2 || DEVIL_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - DEVIL_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !['STRONG', 'CALM'].includes(e.emotion) || typeof e.seedPlanted !== 'boolean' || e.staggerReady !== false ||
      !integer(e.seedAttempts, 0) || !integer(e.catalysisAttempts, 0, e.seedAttempts) || !integer(e.composeUses, 0) ||
      (e.lastSeedRound === null ? e.seedAttempts !== 0 || e.seedPlanted : !integer(e.lastSeedRound, 1) || e.seedAttempts === 0) ||
      (e.emotion === 'CALM' ? e.composeUses === 0 || e.seedPlanted : e.composeUses !== 0) ||
      (e.status !== 'FIGHTING' && !noEffects(s)) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'devil-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (!promoted(s)) return stableStringify(e) === stableStringify(createDevilEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'DEVIL_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.emotion === 'STRONG' && e.seedAttempts === 0 && e.catalysisAttempts === 0 && e.composeUses === 0 && e.lastSeedRound === null && !e.seedPlanted &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'DEVIL_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || s.devil.promotionWeek === null || e.attemptWeek < s.devil.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previousSpirituality = 40, previousHealth = 100, previousMind = 100;
  const uses: Record<DevilPowerId, number> = { ARC_BOLT: 0, WARD: 0 };
  let previous: DevilRoundOutcome | undefined;
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.devilOutcome;
    if (r.round !== i + 1 || r.winner === null || (i < own.length - 1 && (r.retreat === 'SUCCESS' || o?.enemyStatus !== 'RESISTING' || !o?.continuing)) || !validateDevilRoundOutcome(o) ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
        o.enemySpiritualityBefore !== previousSpirituality || o.source.enemyHealth !== previousHealth || o.source.enemyMind !== previousMind) return false;
    if (previous && (o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.source.strain !== previous.playerStrainAfter ||
        o.source.emotion !== previous.emotion || o.source.seedPlanted !== previous.seedPlanted || o.source.lastSeedRound !== previous.lastSeedRound ||
        o.source.seedAttempts !== previous.seedAttempts || o.source.catalysisAttempts !== previous.catalysisAttempts || o.source.composeUses !== previous.composeUses)) return false;
    if (!previous && (o.source.emotion !== 'STRONG' || o.source.seedPlanted || o.source.lastSeedRound !== null ||
        o.source.seedAttempts !== 0 || o.source.catalysisAttempts !== 0 || o.source.composeUses !== 0)) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    const healed = o.source.playerHealth;
    let playerHealth = healed, enemyHealth = o.source.enemyHealth;
    if (r.consequenceWeights !== null) {
      if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS') return false;
      const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, damage = r.consequenceRoll <= w.light ? 10 : 30;
      if (r.winner === 'PLAYER') enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage);
      else playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
    }
    if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth) return false;
    previous = o;
    for (const a of o.enemyActions) if (a.paidCost > 0) uses[a.planned as DevilPowerId]++;
    if (stableStringify(uses) !== stableStringify(o.powerUses)) return false;
    previousSpirituality = o.enemySpirituality; previousHealth = o.enemyHealth; previousMind = o.enemyMind;
  }
  const o = last?.devilOutcome;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || stableStringify(o.powerUses) !== stableStringify(e.powerUses) || o.emotion !== e.emotion || o.seedPlanted !== e.seedPlanted ||
      o.lastSeedRound !== e.lastSeedRound || o.seedAttempts !== e.seedAttempts || o.catalysisAttempts !== e.catalysisAttempts || o.composeUses !== e.composeUses)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.demon.strain === o.playerStrainAfter && s.health === o.playerHealthAfter &&
    s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12))) && t === null && hasDevilDisputeOpponent(s) &&
    (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40) &&
    s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) &&
    (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'DEVIL_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
