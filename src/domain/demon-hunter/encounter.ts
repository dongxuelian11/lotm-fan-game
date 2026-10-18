import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasGuardianOpenPractice } from '../guardian/encounter.js';
import { hasDemonHunterLifeLock } from './life.js';
import { validateDemonHunterRoundOutcome } from './combat.js';

export const DEMON_HUNTER_TARGET_ID = 'DH4-CINDER-GUARD' as const;
export const DEMON_HUNTER_POWER_IDS = ['CORRUPTION_PULSE', 'CINDER_GUARD', 'CINDER_LUNGE'] as const;
export type DemonHunterPowerId = typeof DEMON_HUNTER_POWER_IDS[number];
export type DemonHunterEnemyIntent = DemonHunterPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const DEMON_HUNTER_POWERS: readonly { id: DemonHunterPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'CORRUPTION_PULSE', label: '有限灰烬脉冲', cost: 5, selfGain: 48, enemyReduction: 0 },
  { id: 'CINDER_GUARD', label: '可见灰壳格挡', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'CINDER_LUNGE', label: '原身体短扑', cost: 4, selfGain: 56, enemyReduction: 0 },
];
export interface DemonHunterCoating {
  id: 'DH4-COATING-1' | 'DH4-COATING-2'; targetId: typeof DEMON_HUNTER_TARGET_ID;
  status: 'SEALED' | 'SPENT'; usedRound: number | null;
}
export interface DemonHunterEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface DemonHunterEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof DEMON_HUNTER_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<DemonHunterPowerId, number>; warningUses: number;
  preparationWeek: number | null; preparationCostPence: number; coatings: DemonHunterCoating[];
  weaknessObservedRound: number | null; swordReady: boolean; swordExpiresRound: number | null;
  terminal: DemonHunterEncounterTerminal | null;
}
export type DemonHunterEncounterCommand = { type: 'ENCOUNTER_TALK' | 'PREPARE_HUNT' | 'ENCOUNTER_FIGHT' };
export interface DemonHunterEncounterProjection {
  encounter: (DemonHunterEncounterState & {
    name: string; story: string; sequence: number; originalExit: string; pursuit: false;
    weakness: string; coatingsRemaining: number;
    abilities: { id: DemonHunterPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const DEMON_HUNTER_ENCOUNTER_STORY = '原独立净空侧院中只有原创受腐蚀哨卫DH4-CINDER-GUARD。它是有限的原生物，危险度按序列5估算，健康100、精神100、灵性36；不是埃德温复活，也不是对人的道德判断。原身体在2米外可见，地面与普通出口畅通，无旁人、无友军、无追逐。只会三种列明G动作；针对进攻意图的预警最多3次、每次2灵性减势8，目视格挡独立保留。可花1行动普通表明退出并沿原路离开。可选战前1行动120便士购入两份仅针对该原目标的封装虚构涂层，耗尽不再生。临时晨曦剑、观察、守护与隐藏意图都有实际成本；没有物理隐形、永久巨人形态、序列3银甲或瞬移银剑。';
export function createDemonHunterEncounterState(): DemonHunterEncounterState {
  return { status: 'AVAILABLE', targetId: DEMON_HUNTER_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 36, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { CORRUPTION_PULSE: 0, CINDER_GUARD: 0, CINDER_LUNGE: 0 }, warningUses: 0,
    preparationWeek: null, preparationCostPence: 0, coatings: [], weaknessObservedRound: null,
    swordReady: false, swordExpiresRound: null, terminal: null };
}
export const createDemonHunterEncounter = createDemonHunterEncounterState;
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && [4,3,2].includes(s.progression.sequence!);
export const hasDemonHunterEncounterLock = (s: SliceState): boolean => s.demonHunter.encounter.status === 'FIGHTING';
const reported = (s: SliceState): boolean => Object.values(s.demonHunter.life.cases).some(c => c.status === 'RESOLVED');
export function validateDemonHunterEncounterCommand(v: unknown): v is DemonHunterEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'PREPARE_HUNT', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function demonHunterEncounterReason(s: SliceState, c: DemonHunterEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并恢复身体与精神。';
  if (!promoted(s)||s.progression.sequence!==4) return '此处保留原猎魔者对手，当前阶段不重新开启。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (hasDemonHunterLifeLock(s) || hasGuardianOpenPractice(s)) return '先收回实际探针、回到原起点并关闭日常接触，停止旧守护、剑甲与同伴实践。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原独立净空侧院。';
  if (!reported(s)) return '先完成至少一份猎魔者的真实实践报告。';
  const e = s.demonHunter.encounter;
  if (e.status !== 'AVAILABLE') return '同一原哨卫已有本次结果，不能重生或再开战。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'PREPARE_HUNT') {
    if (s.demonHunter.life.cases['tailored-coating'].status !== 'RESOLVED') return '先完成针对性涂层的实践与报告，才能按已学知识采购这份独立战斗制剂。';
    if (e.preparationWeek !== null) return '本场的两份原涂层已购入，不能重复补充。';
    if (s.cash < 120) return '两份原目标封装涂层需要120便士。';
  }
  return null;
}
export function applyDemonHunterEncounterCommand(s: SliceState, c: DemonHunterEncounterCommand, ctx: SeerContext): void {
  if (!validateDemonHunterEncounterCommand(c)) throw new Error('猎魔者冲突命令无效。');
  const reason = demonHunterEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.demonHunter.encounter; s.actionsRemaining -= 1;
  if (c.type === 'PREPARE_HUNT') {
    s.cash -= 120; e.preparationWeek = s.week; e.preparationCostPence = 120;
    e.coatings = [1, 2].map(n => ({ id: `DH4-COATING-${n}` as DemonHunterCoating['id'], targetId: DEMON_HUNTER_TARGET_ID, status: 'SEALED', usedRound: null }));
    ctx.note('购入两份原目标封装涂层', '实付1行动与120便士，以已完成报告中的诊断和专业准备知识委托原供应处完成两份独立G虚构制剂：DH4-COATING-1、DH4-COATING-2。只适用于DH4-CINDER-GUARD；日常原残片、试剂、探针不转移。仍须现场观察发光裂缝，持实际原棍或晨曦剑并另付2灵性才可逐份使用；不提供现实配方。');
    return;
  }
  e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED';
    ctx.note('普通表明退出并实际离开', '花费1行动走到原侧院边线，普通表明不接近并沿现有出口退出。原哨卫仍活着，H100/M100/S36与原身体保留；没有强迫和平、道德诊断或奖励。未用封装涂层保留，不能再开启这一次遭遇。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DEMON_HUNTER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原灰烬哨卫的有限战斗', DEMON_HUNTER_ENCOUNTER_STORY);
}
export const applyDemonHunterEncounter = applyDemonHunterEncounterCommand;
export function hasDemonHunterDisputeOpponent(s: SliceState): boolean {
  const e = s.demonHunter.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && !hasDemonHunterLifeLock(s) && !hasGuardianOpenPractice(s) && reported(s) &&
    c?.encounterId === 'DEMON_HUNTER_DISPUTE' && c.enemyStatus === 'RESISTING' && Number.isFinite(c.enemyHealth) && c.enemyHealth > 0 && Number.isFinite(c.enemyMind) && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === DEMON_HUNTER_TARGET_ID && e.terminal === null &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 36 && e.attemptWeek === s.week &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDemonHunterEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.demonHunter.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'DEMON_HUNTER_DISPUTE') throw new Error('没有同一原灰烬哨卫的战斗。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal || e.startHistoryIndex === null || !last ||
      c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validateDemonHunterRoundOutcome(last.demonHunterOutcome) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE' || last.stance === 'DEFEND')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE' || last.stance === 'DEFEND')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结果与实际原回合、原身体和资源不一致。');
  e.terminal = { outcome: outcome as DemonHunterEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('demon-hunter-dispute')) award?.('demon-hunter-dispute', 25);
  e.swordReady = false; e.swordExpiresRound = null; s.combat = null;
  ctx.note('同一原灰烬哨卫的战斗结束', `${outcome === 'ENEMY_DEAD' ? '原哨卫真实死亡，原尸体留在侧院。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，守护、意图隐蔽与涂层不能复活。' : outcome === 'RETREATED' ? '本人沿实际普通出口退出，无追逐、瞬移或拖带。' : '原哨卫因真实重伤停止抵抗，仍活着且原身体留在侧院；没有强迫服从。'}原目标H/M/S、伤势、实付资源与原涂层使用记录保留。临时晨曦剑与意图隐蔽结束，不补充材料，不治疗，不再生成对手。`);
}
export function demonHunterEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '普通表明退出并离开', '1行动 · 不强迫和平'], ['PREPARE_HUNT', '准备两份原目标涂层', '1行动 · 120便士 · 仅此两份'], ['ENCOUNTER_FIGHT', '进入原侧院真实战斗', '1行动 · 有真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: DemonHunterEncounterCommand = { type }, reason = demonHunterEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectDemonHunterEncounter(s: SliceState): DemonHunterEncounterProjection {
  if (!promoted(s)) return { encounter: null };
  const e = s.demonHunter.encounter;
  return { encounter: { ...structuredClone(e), name: '灰烬哨卫（原创受腐蚀生物，G）', story: DEMON_HUNTER_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原独立侧院的净空普通出口', pursuit: false,
    weakness: e.weaknessObservedRound === null ? '尚未现场观察到弱点；不把名称当作诊断' : '仅此原目标胸前已观察的发光裂缝',
    coatingsRemaining: e.coatings.filter(c => c.status === 'SEALED').length,
    abilities: DEMON_HUNTER_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validateDemonHunterEncounter(s: SliceState): boolean {
  const e = s.demonHunter?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== DEMON_HUNTER_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 36) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || DEMON_HUNTER_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 12)) || !integer(e.warningUses, 0, 3) ||
      e.enemySpirituality !== 36 - e.warningUses * 2 - DEMON_HUNTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) ||
      typeof e.swordReady !== 'boolean' || (e.swordReady ? !integer(e.swordExpiresRound, 1) : e.swordExpiresRound !== null) ||
      (e.weaknessObservedRound !== null && !integer(e.weaknessObservedRound, 1)) || !Array.isArray(e.coatings)) return false;
  if (e.preparationWeek === null ? e.preparationCostPence !== 0 || e.coatings.length !== 0
    : !integer(e.preparationWeek, s.demonHunter.promotionWeek ?? 1, s.week) || e.preparationCostPence !== 120 || e.coatings.length !== 2 || s.demonHunter.life.cases['tailored-coating'].status !== 'RESOLVED') return false;
  if (e.coatings.some((c, i) => !c || c.id !== `DH4-COATING-${i + 1}` || c.targetId !== DEMON_HUNTER_TARGET_ID ||
      !['SEALED', 'SPENT'].includes(c.status) || (c.status === 'SEALED' ? c.usedRound !== null : !integer(c.usedRound, e.weaknessObservedRound ?? Number.MAX_SAFE_INTEGER)))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'demon-hunter-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  if (!promoted(s)) return stableStringify(e) === stableStringify(createDemonHunterEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'DEMON_HUNTER_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 && !e.swordReady && e.weaknessObservedRound === null &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 36 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null) && s.combat?.encounterId !== 'DEMON_HUNTER_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || s.demonHunter.promotionWeek === null || e.attemptWeek < s.demonHunter.promotionWeek) return false;
  const t = e.terminal;
  const end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  if (own.some((r, i) => r.round !== i + 1 || r.winner === null || (i < own.length - 1 && r.retreat === 'SUCCESS') || !validateDemonHunterRoundOutcome(r.demonHunterOutcome))) return false;
  if (e.weaknessObservedRound !== null && e.weaknessObservedRound > own.length) return false;
  if (e.coatings.some(c => c.usedRound !== null && c.usedRound > own.length)) return false;
  if (last) {
    const o = last.demonHunterOutcome!;
    if (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
        o.warningUses !== e.warningUses || o.weaknessObservedRound !== e.weaknessObservedRound || stableStringify(o.powerUses) !== stableStringify(e.powerUses) ||
        stableStringify(o.coatings) !== stableStringify(e.coatings) || o.swordReady !== e.swordReady || o.swordExpiresRound !== e.swordExpiresRound) return false;
  } else if (e.enemySpirituality !== 36 || e.swordReady || e.weaknessObservedRound !== null || e.coatings.some(c => c.status === 'SPENT')) return false;
  if (e.status === 'FIGHTING') return t === null && hasDemonHunterDisputeOpponent(s) && s.combat!.enemyHealth === e.enemyHealth && s.combat!.enemyMind === e.enemyMind &&
    s.combat!.enemyStatus === e.enemyStatus && s.combat!.enemyRisk === e.enemyRisk && stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) &&
    (!e.swordReady || (e.swordExpiresRound! >= s.combat!.round && e.swordExpiresRound! <= s.combat!.round + 2 && s.town.clubLocation !== 'HAND' && s.warrior.practiceClub.location !== 'player:hand'));
  if (s.combat?.encounterId === 'DEMON_HUNTER_DISPUTE' || !t || !last || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round || e.swordReady ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && last.stance !== 'DEFEND' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
