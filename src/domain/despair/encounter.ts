import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasPainOpenPractice } from '../pain/encounter.js';
import { hasDespairLifeLock } from './life.js';
import { validateDespairRoundOutcome } from './combat.js';

export const DESPAIR_TARGET_ID = 'DP4-VALEN-HOLT' as const;
export const DESPAIR_POWER_IDS = ['ARC_BOLT', 'FROST_GUARD', 'SPRINT_STRIKE'] as const;
export type DespairPowerId = typeof DESPAIR_POWER_IDS[number];
export type DespairEnemyIntent = DespairPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const DESPAIR_POWERS: readonly { id: DespairPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'FROST_GUARD', label: '有限霜护（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'SPRINT_STRIKE', label: '短冲棍击（G）', cost: 4, selfGain: 50, enemyReduction: 0 },
];
export interface DespairCareVisit { week: number; costPence: 60; before: number; after: number }
export interface DespairEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyDisease: number;
}
export interface DespairEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof DESPAIR_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<DespairPowerId, number>; interruptionCount: number; lastInterruptionCheckRound: number | null;
  fieldActive: boolean; enemyDisease: number; diseaseApplications: number; lastDiseaseRound: number | null;
  silkPrepared: boolean; boundRound: number | null;
  careVisits: DespairCareVisit[]; supplyWeeks: number[];
  terminal: DespairEncounterTerminal | null;
}
export type DespairEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'ENCOUNTER_AID' | 'BUY_SUPPLIES' | 'PREPARE_MIRROR' };
export interface DespairEncounterProjection {
  encounter: (DespairEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false;
    distanceMetres: 4; fieldRadiusMetres: 10; noBystanders: true; careChannel: string;
    abilities: { id: DespairPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const DESPAIR_ENCOUNTER_STORY = '原创成年非凡者瓦伦·霍尔特在废弃独立净空院4米外持自己的DP4-VALEN-CLUB；按序列5强度设置的三种G动作与有限40灵性都来自同一原人，不是旧奥伦复活。原院无人旁观、没有同伴，普通出口开放且没有追逐；这不是友军免疫保证。可花1行动普通表明不交手并离开。真实交手可建立本场10米有限超自然瘟疫场（G，不代表原著通用半径），首次4灵性/知识18；以后每轮实付2灵性、强度逐步1→6。防御或撤退先停止新增暴露，已有症状保留；强度≥3时每轮只对第一项实际付费法术尝试一次可失败的中断。不会凭空制造敌方施法、直接扣健康或保证杀死。停止与离场均不治愈；仍活着的原人可经本地受托照护渠道，每真实周1行动60便士一次专业随访，有限降低2强度。人物、能力数值与护理效果均为G，不提供现实病原、传播或医疗配方。';
export function createDespairEncounterState(): DespairEncounterState {
  return { status: 'AVAILABLE', targetId: DESPAIR_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, FROST_GUARD: 0, SPRINT_STRIKE: 0 }, interruptionCount: 0, lastInterruptionCheckRound: null,
    fieldActive: false, enemyDisease: 0, diseaseApplications: 0, lastDiseaseRound: null,
    silkPrepared: false, boundRound: null, careVisits: [], supplyWeeks: [], terminal: null };
}
export const createDespairEncounter = createDespairEncounterState;
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && [4,3,2].includes(s.progression.sequence!);
const reported = (s: SliceState) => Object.values(s.despair.life.cases).some(c => c.status === 'RESOLVED');
export const hasDespairEncounterLock = (s: SliceState): boolean => s.despair.encounter.status === 'FIGHTING';
export function validateDespairEncounterCommand(v: unknown): v is DespairEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID', 'BUY_SUPPLIES', 'PREPARE_MIRROR'].includes(String(c.type));
}
export function despairEncounterReason(s: SliceState, c: DespairEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)||s.progression.sequence!==4) return '此处保留原绝望魔女对手，当前阶段不重新开启。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗；战内可选防御或撤退停止新增暴露。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原院与已约定的本地照护渠道。';
  if (hasDespairLifeLock(s) || hasPainOpenPractice(s)) return '先沿原路线返回、归还原物并关闭演练接触。';
  const e = s.despair.encounter, t = s.witch.tools;
  if (c.type === 'PREPARE_MIRROR') return t.mirrorPrepared ? '原小镜已备好，消耗后才需再准备。' : t.mirrorsHeld > 0 ? null : '没有实际持有的原小镜。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'BUY_SUPPLIES') {
    if (e.supplyWeeks.length >= 3) return '本阶段三包独立原工具已经购尽，不再生。';
    if (t.lastPurchaseWeek === s.week) return '本周原渠道已经交付工具包，须下一真实周。';
    return s.cash >= 60 ? null : '实际原工具包需要60便士。';
  }
  if (c.type === 'ENCOUNTER_AID') {
    if (!validateDespairEncounter(s) || !e.terminal || !['RESOLVED', 'RETREATED'].includes(e.status) || e.enemyHealth <= 0 || e.enemyStatus === 'DEAD' || e.fieldActive || e.enemyDisease <= 0) return '只能在原冲突结束后，为实际感染且仍活着的同一原瓦伦安排随访。';
    if (e.careVisits.some(v => v.week === s.week)) return '本周已经完成一次实际专业随访；下一真实周才能再安排。';
    return s.cash >= 60 ? null : '一次实际专业随访需要60便士。';
  }
  if (!reported(s)) return '先完成至少一份绝望魔女普通演练报告。';
  return e.status === 'AVAILABLE' ? null : '同一原瓦伦已有结果，不能重生、清除症状或再次开战。';
}
export function applyDespairEncounterCommand(s: SliceState, c: DespairEncounterCommand, ctx: SeerContext): void {
  if (!validateDespairEncounterCommand(c)) throw new Error('绝望魔女遭遇命令无效。');
  const reason = despairEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.despair.encounter, t = s.witch.tools;
  if (c.type === 'PREPARE_MIRROR') { t.mirrorPrepared = true; ctx.note('把持有的原镜备给替身', '沿用原女巫工具：0行动、0灵性，只备好一面实际持有的原镜；战斗真正抽中并支付3灵性时才碎裂消耗。'); return; }
  s.actionsRemaining -= 1;
  if (c.type === 'BUY_SUPPLIES') {
    s.cash -= 60; t.kitsBought++; t.lastPurchaseWeek = s.week; t.powderHeld += 3; t.mirrorsHeld++; e.supplyWeeks.push(s.week);
    ctx.note('原渠道实际交付工具包', '实付1行动60便士，领取3剂虚构粉剂与1面普通原镜，记入原女巫库存；本周一包，本阶段最多三包，不复制旧工具或恢复已用原物。'); return;
  }
  if (c.type === 'ENCOUNTER_AID') {
    const before = e.enemyDisease; s.cash -= 60; e.enemyDisease = Math.max(0, before - 2);
    e.careVisits.push({ week: s.week, costPence: 60, before, after: e.enemyDisease });
    ctx.note('同一原瓦伦的实际专业随访', `实付1行动60便士，经已约定的本地受托照护渠道完成同一原人的本周随访（G），持续超自然症状${before}→${e.enemyDisease}；未把离开的本人传送回来。原健康${e.enemyHealth}、伤势、灵性与历史保持。${e.enemyDisease ? '仍有症状，须下一真实周另付费随访。' : '有限症状已降0，不意味着原伤口复原。'}没有现实疗法或无限奖励。`); return;
  }
  e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通表明不交手并离开', '实付1行动，普通表明不接受交手，沿原院开放出口实际离开，无追逐。原瓦伦仍活着并持自己的原棍，H100/M100/S40保留；没有施病、强迫和平、奖励或再次开战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DESPAIR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原瓦伦的有限真实冲突', DESPAIR_ENCOUNTER_STORY);
}
export const applyDespairEncounter = applyDespairEncounterCommand;
export function hasDespairDisputeOpponent(s: SliceState): boolean {
  const e = s.despair.encounter, c = s.combat;
  return promoted(s) && s.progression.sequence !== 2 && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && !hasDespairLifeLock(s) && !hasPainOpenPractice(s) && reported(s) &&
    c?.encounterId === 'DESPAIR_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === DESPAIR_TARGET_ID && e.terminal === null &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 && e.attemptWeek === s.week &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDespairEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.despair.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'DESPAIR_DISPUTE') throw new Error('没有同一原瓦伦的真实冲突。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last ||
      c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      !validateDespairRoundOutcome(last.despairOutcome) || e.fieldActive || e.silkPrepared || e.boundRound !== null ||
      last.despairOutcome.enemyDisease !== e.enemyDisease || last.despairOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及持续症状不一致。');
  e.terminal = { outcome: outcome as DespairEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus, enemyDisease: e.enemyDisease };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('despair-dispute')) award?.('despair-dispute', 25);
  s.combat = null;
  ctx.note('同一原瓦伦的冲突结束', `${outcome === 'ENEMY_DEAD' ? '同一原瓦伦真实死亡，不能对死人安排随访。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，没有疾病、丝线或原镜复活。' : outcome === 'RETREATED' ? '本人沿原普通出口退出，原瓦伦留在原院，无追逐或瞬移；照护只能经约定渠道另行安排。' : '原瓦伦因真实重伤自行停止抵抗，仍活着，自己的原棍留在现场，归属不变。'}已停止新增暴露；原健康${e.enemyHealth}、灵性${e.enemySpirituality}、持续症状${e.enemyDisease}及实际法术与中断记录保留。不自动治愈、不重生。`);
}
export function despairEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通表明不交手并离开', '1行动 · 不施病'], ['ENCOUNTER_FIGHT', '进入原瓦伦真实冲突', '1行动 · 真实死亡风险'],
    ['ENCOUNTER_AID', '安排同一原瓦伦专业随访', '1行动 · 60便士 · 每真实周一次 · 症状−2'],
    ['BUY_SUPPLIES', '购入本周原粉剂与小镜', '1行动 · 60便士 · 最多三包'], ['PREPARE_MIRROR', '把持有的原镜备给替身', '0行动 · 本次不碎镜']] as const).map(([type, label, cost]) => {
    const command: DespairEncounterCommand = { type }, reason = despairEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectDespairEncounter(s: SliceState): DespairEncounterProjection {
  if (!promoted(s)) return { encounter: null };
  const e = s.despair.encounter;
  return { encounter: { ...structuredClone(e), name: '瓦伦·霍尔特（原创成年非凡者，G）', story: DESPAIR_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原废弃独立空院的开放普通出口', pursuit: false, distanceMetres: 4, fieldRadiusMetres: 10, noBystanders: true,
    careChannel: '原本地受托照护渠道；退出后联系同一原瓦伦，不将本人传送回场',
    abilities: DESPAIR_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateDespairEncounter(s: SliceState): boolean {
  const e = s.despair?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== DESPAIR_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || DESPAIR_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - DESPAIR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || !integer(e.interruptionCount, 0, 13) ||
      !integer(e.enemyDisease, 0, 6) || !integer(e.diseaseApplications, 0, 1) || typeof e.fieldActive !== 'boolean' || typeof e.silkPrepared !== 'boolean' ||
      (e.diseaseApplications === 0 && (e.enemyDisease !== 0 || e.fieldActive || e.lastDiseaseRound !== null || e.interruptionCount !== 0)) ||
      (e.diseaseApplications === 1 && !integer(e.lastDiseaseRound, 1)) || (e.boundRound !== null && !integer(e.boundRound, 1)) ||
      (e.lastInterruptionCheckRound !== null && !integer(e.lastInterruptionCheckRound, 1)) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) ||
      !Array.isArray(e.careVisits) || e.careVisits.length > 3 || !Array.isArray(e.supplyWeeks) || e.supplyWeeks.length > 3 ||
      e.supplyWeeks.some((w, i) => !integer(w, s.despair.promotionWeek ?? 1, s.week) || (i > 0 && w <= e.supplyWeeks[i - 1]!))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'despair-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (!promoted(s)) return stableStringify(e) === stableStringify(createDespairEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'DESPAIR_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 && !e.fieldActive && !e.silkPrepared && e.boundRound === null &&
    e.enemyDisease === 0 && e.diseaseApplications === 0 && e.careVisits.length === 0 && e.lastInterruptionCheckRound === null &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null) && s.combat?.encounterId !== 'DESPAIR_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || s.despair.promotionWeek === null || e.attemptWeek < s.despair.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  if (own.some((r, i) => r.round !== i + 1 || r.winner === null || (i < own.length - 1 && r.retreat === 'SUCCESS') || !validateDespairRoundOutcome(r.despairOutcome) ||
      r.despairOutcome!.source.startHistoryIndex !== e.startHistoryIndex || r.despairOutcome!.source.attemptWeek !== e.attemptWeek ||
      (i > 0 && (r.despairOutcome!.enemyDisease < own[i - 1]!.despairOutcome!.enemyDisease || r.despairOutcome!.enemySpiritualityBefore !== own[i - 1]!.despairOutcome!.enemySpirituality)))) return false;
  const o = last?.despairOutcome;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      o.interruptionCount !== e.interruptionCount || o.diseaseApplications !== e.diseaseApplications || o.lastDiseaseRound !== e.lastDiseaseRound ||
      o.lastInterruptionCheckRound !== e.lastInterruptionCheckRound || stableStringify(o.powerUses) !== stableStringify(e.powerUses) ||
      o.fieldActive !== e.fieldActive || o.silkPrepared !== e.silkPrepared)) return false;
  if (e.lastDiseaseRound !== null && e.lastDiseaseRound > own.length || e.lastInterruptionCheckRound !== null && e.lastInterruptionCheckRound > own.length || e.boundRound !== null) return false;
  if (e.status === 'FIGHTING') return t === null && e.careVisits.length === 0 && hasDespairDisputeOpponent(s) &&
    (o ? o.enemyDisease === e.enemyDisease : e.enemyDisease === 0 && e.enemySpirituality === 40 && !e.fieldActive && !e.silkPrepared) &&
    s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries);
  if (s.combat?.encounterId === 'DESPAIR_DISPUTE' || !t || !last || !o || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round || e.fieldActive || e.silkPrepared ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus || t.enemyDisease !== o.enemyDisease) return false;
  let disease = t.enemyDisease;
  for (let i = 0; i < e.careVisits.length; i++) {
    const v = e.careVisits[i]!;
    if (!v || Object.keys(v).length !== 4 || !['RESOLVED', 'RETREATED'].includes(e.status) || e.enemyHealth <= 0 || !integer(v.week, e.attemptWeek, s.week) ||
        i > 0 && v.week <= e.careVisits[i - 1]!.week || v.costPence !== 60 || disease <= 0 || v.before !== disease || v.after !== Math.max(0, disease - 2)) return false;
    disease = v.after;
  }
  if (disease !== e.enemyDisease) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
