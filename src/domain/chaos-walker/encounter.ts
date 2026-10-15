import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { consequenceWeights } from '../slice/combat.js';
import { hasChaosWalkerOldPractice, hasChaosWalkerRitualLock } from './index.js';
import { advanceChaosWalkerLifeClock, hasChaosWalkerLifeLock } from './life.js';
import { chaosWalkerActionCount, chaosWalkerEnemyActionCount, validateChaosWalkerRoundOutcome, validChaosWalkerCombatScene, type ChaosWalkerRoundOutcome } from './combat.js';

export const CHAOS_WALKER_TARGET_ID = 'CW3-GARETH' as const;
export const CHAOS_WALKER_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type ChaosWalkerPowerId = typeof CHAOS_WALKER_POWER_IDS[number];
export type ChaosWalkerEnemyIntent = ChaosWalkerPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type ChaosWalkerPendingKind = 'DEVIATION_BUFFER' | 'FUTURE_IMPEDIMENT';
export const CHAOS_WALKER_POWERS: readonly { id: ChaosWalkerPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原有限屏护（G）', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗（G）', cost: 4, selfGain: 8, enemyReduction: 0 },
];
export interface ChaosWalkerEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ChaosWalkerEncounterScene {
  courtId: 'CW3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 2; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface ChaosWalkerEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CHAOS_WALKER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: ChaosWalkerEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ChaosWalkerPowerId, number>; lastLuckRound: number | null;
  pendingKind: ChaosWalkerPendingKind | null; composureReady: boolean; luckAttempts: number; deviationAttempts: number; impedimentAttempts: number;
  exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; terminal: ChaosWalkerEncounterTerminal | null;
}
export type ChaosWalkerEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ChaosWalkerEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosWalkerEncounterCommand }
export interface ChaosWalkerEncounterProjection {
  title: string; story: string; status: ChaosWalkerEncounterState['status']; inside: boolean; scene: ChaosWalkerEncounterScene | null;
  enemy: null | { id: typeof CHAOS_WALKER_TARGET_ID; name: '加雷斯·默瑟'; age: 46; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: ChaosWalkerEncounterState['enemyStatus'];
    weaponId: 'CW3-GARETH-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ChaosWalkerPowerId, number> };
  pendingKind: ChaosWalkerPendingKind | null; composureReady: boolean; luck: SliceState['winner']['luck'] & { capacity: 3 };
  actions: ChaosWalkerEncounterAction[]; facts: string[];
}
export const CHAOS_WALKER_ENCOUNTER_STORY = '原创成年序列4加雷斯·默瑟（46岁，CW3-GARETH，G）在独立净空原院CW3-COURT的2米外持自己的唯一原棍CW3-GARETH-ROD提出争议。原身体H100/M100/S120、体格22，双方1–6动作，继承WHEEL核心15/20/40/25及共同65/30/5伤势与累积风险；4米普通出口开放、无旁人或追逐，可交谈后和平离开。弧光5S贡献70、屏护4S减30、凝神4S贡献8共用真实120S；耗尽回退20×身体原棍打击，不补资源。默认保留唯一原赢家积运；本轮首个合格B/K可选耗1原积运5S、知识20四档判定，失败或抵抗也付费。成功仅设一个待用效果，减半后来下一次实际正BODY/ARC贡献，敌方先实际付全费；凝神清除未用效果并抵抗本轮新B/K，不修改既发动作。每轮60秒、未用效果到期，活着的终局沿原出口实际走4米4秒，死者留原院。新3映射、两能力、新人物与定量均为G候选，完整原著3技能、配方及仪式未知；无重抽、复活或必胜，旧费里斯与旧原物不变。';
export function createChaosWalkerEncounterState(): ChaosWalkerEncounterState {
  return { status: 'AVAILABLE', targetId: CHAOS_WALKER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'CW3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, lastLuckRound: null, pendingKind: null, composureReady: false,
    luckAttempts: 0, deviationAttempts: 0, impedimentAttempts: 0, exitTravelMetres: 0, exitSeconds: 0, terminal: null };
}
export const createChaosWalkerEncounter = createChaosWalkerEncounterState;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 3;
const reported = (s: SliceState) => Object.values(s.chaosWalker.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (e: ChaosWalkerEncounterState) => e.pendingKind === null && e.composureReady === false;
function practiceClosed(s: SliceState): boolean {
  return !hasChaosWalkerRitualLock(s) && !hasChaosWalkerOldPractice(s) && !hasChaosWalkerLifeLock(s) && !Object.values(s.chaosWalker.life.cases).some(c => c.status === 'PREPARED');
}
export const hasChaosWalkerEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.chaosWalker.encounter.status) || !noEffects(s.chaosWalker.encounter);
export const isInsideChaosWalkerEncounter = hasChaosWalkerEncounterLock;
export function validateChaosWalkerEncounterCommand(v: unknown): v is ChaosWalkerEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isChaosWalkerEncounterCommand = validateChaosWalkerEncounterCommand;
export function chaosWalkerEncounterReason(s: SliceState, c: ChaosWalkerEncounterCommand): string | null {
  if (!validateChaosWalkerEncounterCommand(c)) return '混乱行者遭遇命令无效。';
  const e = s.chaosWalker.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(r => r.chaosWalkerOutcome)) return '同一原加雷斯已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !promoted(s)) return '需要本人仍活着并已成为候选混乱行者序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.chaosWalker.guidanceKnown || s.chaosWalker.promotionWeek === null) return '需要实际指导与已经完成的混乱行者晋升。';
  if (s.world.city !== 'BACKLUND') return '需要实际在贝克兰德原独立净空院。';
  if (!practiceClosed(s) || !noEffects(e)) return '先关闭全部新旧实践、接触与准备，真实归还原物并停止未用影响。';
  if (!validChaosWalkerCombatScene(e.scene) || e.scene.playerPosition !== 'COURT' || e.exitTravelMetres !== 0 || e.exitSeconds !== 0) return '需要原净空院及真实4米普通出口，已经离场不能重开。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先到原院实际交谈，才能和平离开。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；已经到场仍可普通离开。';
  if (e.targetId !== CHAOS_WALKER_TARGET_ID || e.weaponLocation !== 'HAND' || !['AVAILABLE', 'READY'].includes(e.status)) return '原加雷斯已有结局，不能再生、重开或补原资源。';
  if (!reported(s)) return '先完成至少一份真实关闭后的混乱行者报告。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '已经交谈，不重新生成原人。' : s.actionsRemaining < 2 ? '交谈1行动，另留开战1行动；仍可和平离开。' : null;
  return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先实际交谈，确认同一原加雷斯、唯一原棍及开放出口。';
}
export const blockChaosWalkerEncounter = chaosWalkerEncounterReason;
export function applyChaosWalkerEncounterCommand(s: SliceState, c: ChaosWalkerEncounterCommand, ctx: SeerContext): void {
  const reason = chaosWalkerEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.chaosWalker.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceChaosWalkerLifeClock(s, 4);
    ctx.note('沿4米原普通出口和平离开', '本人实际走4米、4秒、0行动；原加雷斯H100/M100/S120及自己的原棍留原院，原积运不变，无奖励或追逐。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原加雷斯实际交谈', CHAOS_WALKER_ENCOUNTER_STORY); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CHAOS_WALKER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原加雷斯的有限真实冲突', '实付1行动。默认保留唯一原积运；可明确选择首个合格B/K付1积运5灵性，失败不退。共同伤势、真实死亡与实际普通出口均保留。');
}
export const applyChaosWalkerEncounter = applyChaosWalkerEncounterCommand;
export function startChaosWalkerEncounter(s: SliceState, ctx: SeerContext): void { applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasChaosWalkerDisputeOpponent(s: SliceState): boolean {
  const e = s.chaosWalker.encounter, c = s.combat;
  return promoted(s) && s.chaosWalker.guidanceKnown && s.chaosWalker.promotionWeek !== null && s.status === 'ACTIVE' && integer(s.health, 1, 100) && integer(s.mind, 1, 100) && !s.activeEvent &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'CHAOS_WALKER_DISPUTE' && c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && integer(c.round, 1) &&
    e.status === 'FIGHTING' && e.targetId === CHAOS_WALKER_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    validChaosWalkerCombatScene(e.scene) && e.scene.clearanceConfirmed && e.scene.playerPosition === 'COURT' && e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.approachWeek !== null && e.attemptWeek === s.week && e.weaponLocation === 'HAND' &&
    [null, 'DEVIATION_BUFFER', 'FUTURE_IMPEDIMENT'].includes(e.pendingKind) && typeof e.composureReady === 'boolean' && !(e.pendingKind && e.composureReady) &&
    integer(e.luckAttempts) && integer(e.deviationAttempts) && integer(e.impedimentAttempts) && e.deviationAttempts + e.impedimentAttempts === e.luckAttempts &&
    (e.lastLuckRound === null ? e.luckAttempts === 0 : integer(e.lastLuckRound, 1, c.round) && e.luckAttempts > 0) && (!e.pendingKind || e.lastLuckRound === c.round) && (!e.composureReady || e.powerUses.COMPOSE > 0) &&
    integer(e.enemySpirituality, 0, 120) && CHAOS_WALKER_POWER_IDS.every(id => integer(e.powerUses[id], 0, 30)) && e.enemySpirituality === 120 - CHAOS_WALKER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex, 0, s.combatHistory.length) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleChaosWalkerEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.chaosWalker.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CHAOS_WALKER_DISPUTE') throw new Error('没有同一原加雷斯的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知混乱行者冲突结果。');
  const last = c.lastRound, o = last?.chaosWalkerOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateChaosWalkerRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !noEffects(e) || !practiceClosed(s) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.weaponLocation !== e.weaponLocation ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.chaosWalker.life.clockSeconds ||
    o.luckStoredAfter !== s.winner.luck.stored || o.luckSpentAfter !== s.winner.luck.spent || o.source.luckAccumulated !== s.winner.luck.accumulated || o.source.lastAccumulateWeek !== s.winner.luck.lastAccumulateWeek ||
    (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与原回合、同一身体、唯一原武器及实付资源不一致。');
  e.terminal = { outcome: outcome as ChaosWalkerEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原加雷斯的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡留在原院，不复活或移动尸体。' : '本人沿原4米普通出口实际离开，实过4秒，无追逐或瞬移。'}每轮真实60秒，未用效果与凝神到期；全部实付灵性和原积运不退，原敌健康精神灵性与伤势保留，原棍${e.weaponLocation === 'HAND' ? '仍在原主人手中' : '因原主人死亡留在原院且不归玩家'}；旧费里斯与旧历史不变。`);
}
export function chaosWalkerEncounterActions(s: SliceState): ChaosWalkerEncounterAction[] {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与加雷斯交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原加雷斯真实冲突', '1行动 · 真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 实际4秒4米']] as const).map(([type, label, cost]) => {
    const command: ChaosWalkerEncounterCommand = { type }, reason = chaosWalkerEncounterReason(s, command);
    return { id: `chaosWalker-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectChaosWalkerEncounter(s: SliceState): ChaosWalkerEncounterProjection {
  const e = s.chaosWalker.encounter, publicState = { status: e.status, pendingKind: e.pendingKind, composureReady: e.composureReady, luck: { ...s.winner.luck, capacity: 3 as const } };
  if (!promoted(s)) return { ...publicState, title: '尚未开放的混乱行者遭遇', story: '', inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { ...publicState, title: '原净空院与加雷斯·默瑟', story: CHAOS_WALKER_ENCOUNTER_STORY, inside: hasChaosWalkerEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: CHAOS_WALKER_TARGET_ID, name: '加雷斯·默瑟', age: 46, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'CW3-GARETH-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: chaosWalkerEncounterActions(s),
    facts: ['新序列3映射、偏差缓冲与未发阻滞全部为G候选；完整原著技能、配方和仪式未知',
      `原敌H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，原棍在${e.weaponLocation}；弧光${e.powerUses.ARC_BOLT}、屏护${e.powerUses.WARD}、凝神${e.powerUses.COMPOSE}次`,
      `唯一原赢家积运${s.winner.luck.stored}/3，累计积累${s.winner.luck.accumulated}、实付${s.winner.luck.spent}；默认HOLD保留，无新积运池或免费回填`,
      'SPEND_FIRST首个资源合格B/K实付1积运5灵性，知识20可失败；仅改变后来一次实际正BODY/ARC贡献，先付敌真实费用，不重抽过去',
      `待用效果${e.pendingKind ?? '无'}、凝神${e.composureReady ? '仅本轮有效' : '无'}；没有命中保证、强迫投降或复活`,
      `普通离场${e.exitTravelMetres}米/${e.exitSeconds}秒；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '和平离开' : '尚未结束')}；旧费里斯、旧能力与旧原物全部保留`] };
}
export function validateChaosWalkerEncounter(s: SliceState): boolean {
  try {
    const e = s.chaosWalker?.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createChaosWalkerEncounterState()).sort()) || e.targetId !== CHAOS_WALKER_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !validChaosWalkerCombatScene(e.scene) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || CHAOS_WALKER_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 30)) || e.enemySpirituality !== 120 - CHAOS_WALKER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(e) || e.weaponLocation !== (e.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') || !integer(e.luckAttempts) || !integer(e.deviationAttempts) || !integer(e.impedimentAttempts) || e.deviationAttempts + e.impedimentAttempts !== e.luckAttempts ||
      (e.lastLuckRound === null ? e.luckAttempts !== 0 : !integer(e.lastLuckRound, 1) || e.luckAttempts === 0) || e.exitTravelMetres !== e.scene.ordinaryWalkedMetres || e.exitSeconds !== e.exitTravelMetres ||
      (e.approachWeek !== null && !integer(e.approachWeek, s.chaosWalker.promotionWeek ?? 1, s.week)) || (e.attemptWeek !== null && !integer(e.attemptWeek, e.approachWeek ?? 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
    if (s.chaosWalker.promotionWeek === null) return same(e, createChaosWalkerEncounterState()) && s.combat?.encounterId !== 'CHAOS_WALKER_DISPUTE' && !s.combatHistory.some(r => r.chaosWalkerOutcome);
    if (e.startHistoryIndex === null) {
      if (s.combatHistory.some(r => r.chaosWalkerOutcome) || s.combat?.encounterId === 'CHAOS_WALKER_DISPUTE' || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null) return false;
      const expected = createChaosWalkerEncounterState(); expected.status = e.status;
      if (e.status !== 'AVAILABLE') { if (e.approachWeek === null || !reported(s)) return false; expected.approachWeek = e.approachWeek; expected.scene.clearanceConfirmed = true; }
      if (e.status === 'RESOLVED') { expected.scene.playerPosition = 'EXIT'; expected.scene.ordinaryWalkedMetres = 4; expected.exitTravelMetres = 4; expected.exitSeconds = 4; }
      return same(e, expected);
    }
    if (!reported(s) || e.attemptWeek === null || e.approachWeek === null || !e.scene.clearanceConfirmed) return false;
    const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
    if (s.combatHistory.filter(r => r.chaosWalkerOutcome).length !== own.length) return false;
    let previous: ChaosWalkerRoundOutcome | undefined, enemyHealth = 100, enemyRisk = 0;
    const enemyInjuries: SliceInjury[] = [];
    for (const [i, r] of own.entries()) {
      const o = r.chaosWalkerOutcome;
      if (!validateChaosWalkerRoundOutcome(o) || r.round !== i + 1 || r.winner === null || o.round !== r.round || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || o.enemyStatus !== 'RESISTING' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        o.source.enemyHealth !== enemyHealth || o.source.enemyMind !== 100 || !same(o.passiveLuck, r.passiveLuck ?? null) ||
        !integer(r.playerCountRoll, 1, 100) || !integer(r.enemyCountRoll, 1, 100) || r.playerCount !== chaosWalkerActionCount(r.playerCountRoll) || r.enemyCount !== chaosWalkerEnemyActionCount(r.enemyCountRoll)) return false;
      if (previous) {
        if (o.source.revision <= previous.source.revision || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
          o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || !same(o.source.scene, previous.sceneAfter) ||
          o.source.luckStored !== previous.luckStoredAfter || o.source.luckSpent !== previous.luckSpentAfter || o.source.luckAccumulated !== previous.source.luckAccumulated || o.source.lastAccumulateWeek !== previous.source.lastAccumulateWeek ||
          o.source.lastLuckRound !== previous.lastLuckRound || o.source.luckAttempts !== previous.luckAttempts || o.source.deviationAttempts !== previous.deviationAttempts || o.source.impedimentAttempts !== previous.impedimentAttempts || !same(o.source.powerUses, previous.powerUses)) return false;
      } else if (o.enemySpiritualityBefore !== 120 || o.source.lastLuckRound !== null || o.source.luckAttempts !== 0 || o.source.deviationAttempts !== 0 || o.source.impedimentAttempts !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order)
        .map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, r.moves) || r.first !== (r.round % 2 === 1 ? 'PLAYER' : 'ENEMY')) return false;
      const expectedActors: ('PLAYER' | 'ENEMY')[] = [], left = { PLAYER: r.playerCount, ENEMY: r.enemyCount }, actorOrder: ('PLAYER' | 'ENEMY')[] = r.first === 'PLAYER' ? ['PLAYER', 'ENEMY'] : ['ENEMY', 'PLAYER'];
      let escaped = false;
      while ((left.PLAYER > 0 || left.ENEMY > 0) && !escaped) for (const actor of actorOrder) {
        if (left[actor] === 0) continue;
        if (actor === 'PLAYER' && r.stance === 'RETREAT') { left.PLAYER = 0; if (r.retreat === 'SUCCESS') { escaped = true; break; } continue; }
        left[actor]--; expectedActors.push(actor);
      }
      if (!same(moves.map(m => m.actor), expectedActors) || (r.stance === 'RETREAT' ? !['SUCCESS', 'FAILURE'].includes(r.retreat) : r.retreat !== 'NONE')) return false;
      const physical = (h: number) => h > 75 ? 1 : h > 50 ? .95 : h > 25 ? .9 : .8;
      if (o.playerActions.some(a => a.physicalFactor !== physical(o.source.playerHealth)) || o.enemyActions.some(a => a.physicalFactor !== physical(o.source.enemyHealth))) return false;
      let playerHealth = o.source.playerHealth, enemyHeavy = false;
      if (r.winner === 'PLAYER' && r.retreat !== 'SUCCESS' && enemyInjuries.length > 0) enemyRisk++;
      const threatened = r.winner === 'PLAYER' ? o.playerActions.some(a => a.threatens) : o.enemyActions.some(a => a.threatens);
      if ((r.consequenceWeights !== null) !== (r.retreat !== 'SUCCESS' && threatened)) return false;
      if (r.consequenceWeights !== null) {
        if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS' || (r.winner === 'PLAYER' && !same(r.consequenceWeights, consequenceWeights(enemyRisk)))) return false;
        const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, severity = r.consequenceRoll <= w.light ? 'LIGHT' : 'HEAVY', damage = severity === 'LIGHT' ? 10 : 30;
        if (r.winner === 'PLAYER') {
          enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage); enemyHeavy = !death && severity === 'HEAVY';
          if (!death) enemyInjuries.push({ id: `${s.runId}:combat:${r.round}:ENEMY:${o.source.revision + 1}:${enemyInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
        } else playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
      } else if (r.consequenceRoll !== undefined) return false;
      const expectedStatus = enemyHealth === 0 ? 'DEAD' : enemyHeavy ? 'SURRENDERED' : 'RESISTING';
      const continuing = r.retreat !== 'SUCCESS' && playerHealth > 0 && expectedStatus === 'RESISTING';
      if (o.enemyStatus !== expectedStatus || o.continuing !== continuing || o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth || !same(o.enemyInjuriesAfter, enemyInjuries) || o.enemyRiskAfter !== enemyRisk) return false;
      previous = o;
    }
    const o = last?.chaosWalkerOutcome;
    if (!same(enemyInjuries, e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || o.weaponLocation !== e.weaponLocation || !same(o.sceneAfter, e.scene) ||
      !same(o.powerUses, e.powerUses) || o.lastLuckRound !== e.lastLuckRound || o.luckAttempts !== e.luckAttempts || o.deviationAttempts !== e.deviationAttempts || o.impedimentAttempts !== e.impedimentAttempts)) return false;
    if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.chaosWalker.life.clockSeconds === o.lifeClockSecondsAfter &&
      s.winner.luck.stored === o.luckStoredAfter && s.winner.luck.spent === o.luckSpentAfter && s.winner.luck.accumulated === o.source.luckAccumulated && s.winner.luck.lastAccumulateWeek === o.source.lastAccumulateWeek)) &&
      t === null && hasChaosWalkerDisputeOpponent(s) && (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.lastLuckRound === null && e.luckAttempts === 0) &&
      (last ? same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    if (s.combat?.encounterId === 'CHAOS_WALKER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
    return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
  } catch { return false; }
}
