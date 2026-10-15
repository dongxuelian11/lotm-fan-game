import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { baseAdvantage, consequenceWeights } from '../slice/combat.js';
import { hasCoffinBearerOldPractice, hasCoffinBearerRitualLock } from './index.js';
import { advanceCoffinBearerLifeClock, hasCoffinBearerLifeLock } from './life.js';
import { coffinBearerActionCount, coffinBearerEnemyActionCount, validateCoffinBearerRoundOutcome, validCoffinBearerCombatScene, validCoffinBearerCombatGuard, type CoffinBearerRoundOutcome } from './combat.js';

export const COFFIN_BEARER_TARGET_ID = 'CB3-NOLAN' as const;
export const COFFIN_BEARER_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type CoffinBearerPowerId = typeof COFFIN_BEARER_POWER_IDS[number];
export type CoffinBearerEnemyIntent = CoffinBearerPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const COFFIN_BEARER_POWERS: readonly { id: CoffinBearerPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原有限屏护（G）', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗（G）', cost: 4, selfGain: 8, enemyReduction: 0 },
];
export interface CoffinBearerEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface CoffinBearerEncounterScene {
  courtId: 'CB3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 2; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface CoffinBearerEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof COFFIN_BEARER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: CoffinBearerEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<CoffinBearerPowerId, number>;
  guardMode: 'MATRIX' | 'PRESERVE' | null; guardCharges: number; guardAttempts: number; preservationAttempts: number;
  exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; terminal: CoffinBearerEncounterTerminal | null;
}
export type CoffinBearerEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface CoffinBearerEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CoffinBearerEncounterCommand }
export interface CoffinBearerEncounterProjection {
  title: string; story: string; status: CoffinBearerEncounterState['status']; inside: boolean; scene: CoffinBearerEncounterScene | null;
  enemy: null | { id: typeof COFFIN_BEARER_TARGET_ID; name: '诺兰·韦斯特'; age: 42; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: CoffinBearerEncounterState['enemyStatus'];
    weaponId: 'CB3-NOLAN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<CoffinBearerPowerId, number> };
  guardMode: 'MATRIX' | 'PRESERVE' | null; guardCharges: number; guardAttempts: number; preservationAttempts: number;
  actions: CoffinBearerEncounterAction[]; facts: string[];
}
export const COFFIN_BEARER_ENCOUNTER_STORY = '原创成年序列4诺兰·韦斯特（42岁，CB3-NOLAN，G）在独立净空浅壤土院CB3-COURT的2米外持自己的唯一原棍CB3-NOLAN-ROD提出争议。原身体H100/M100/S120、体格22；双方1–6动作、1250战势基准/120灵性上限/125底线，主人继承MOTHER核心20/15/20/45和共同65/30/5伤势与旧累计风险。4米普通出口开放，无旁人或追赶，可交谈后和平离开。原弧光5S贡献70、屏护4S减30、普通凝神4S贡献8共用真实120S，耗尽回退20×身体普通原棍且不补能。B继承活性基质，以新护腕原段1份及4S、知识18二元成功护持后续一次正BODY/ARC至60%；新K有限活性保全，以新原段1份及5S、知识20四档成功护持后续最多两次正BODY/ARC至80%。任何待用B或K都不叠加，失败仍耗原段。实体护腕不因凝神消失，护持与0贡献不消耗次数。新实物媒介与保全玩法均明确G；不改伤势、风险或死亡盘，不复活、造魂、操纵死人或棺材免死。R沿旧掌握真实恢复当前健康，不清旧伤与风险。每轮60秒，活着结局实际普通走4米4秒，死者留原场，死敌原棍留院且不归玩家。完整本阶配方、仪式及新能力原著细则未核，未来2荒芜主母与1自然行者只保留已核名称；旧奥斯里克、旧护腕与六个旧职业所有状态冻结。';
export function createCoffinBearerEncounterState(): CoffinBearerEncounterState {
  return { status: 'AVAILABLE', targetId: COFFIN_BEARER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'CB3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, guardMode: null, guardCharges: 0, guardAttempts: 0, preservationAttempts: 0, exitTravelMetres: 0, exitSeconds: 0, terminal: null };
}
export const createCoffinBearerEncounter = createCoffinBearerEncounterState;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 3;
const reported = (s: SliceState) => s.coffinBearer.life.reflected && Object.values(s.coffinBearer.life.cases).length === 3 && Object.values(s.coffinBearer.life.cases).every(c => c.status === 'RESOLVED');
const noEffects = (e: CoffinBearerEncounterState) => e.guardMode === null && e.guardCharges === 0;
function practiceClosed(s: SliceState): boolean {
  return !hasCoffinBearerRitualLock(s) && !hasCoffinBearerOldPractice(s) && !hasCoffinBearerLifeLock(s) && !Object.values(s.coffinBearer.life.cases).some(c => c.status === 'PREPARED');
}
export const hasCoffinBearerEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.coffinBearer.encounter.status) || !noEffects(s.coffinBearer.encounter);
export const isInsideCoffinBearerEncounter = hasCoffinBearerEncounterLock;
export function validateCoffinBearerEncounterCommand(v: unknown): v is CoffinBearerEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isCoffinBearerEncounterCommand = validateCoffinBearerEncounterCommand;
export function coffinBearerEncounterReason(s: SliceState, c: CoffinBearerEncounterCommand): string | null {
  if (!validateCoffinBearerEncounterCommand(c)) return '抬棺人遭遇命令无效。';
  const e = s.coffinBearer.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(r => r.coffinBearerOutcome)) return '同一原诺兰已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !promoted(s)) return '需要本人仍活着并已成为抬棺人序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.coffinBearer.guidanceKnown || s.coffinBearer.promotionWeek === null) return '需要实际指导与已经完成的抬棺人晋升。';
  if (s.world.city !== 'BACKLUND') return '需要实际在贝克兰德原独立净空院。';
  if (!practiceClosed(s) || !noEffects(e)) return '先关闭全部新旧实践、接触与准备，真实归还原物并停止未用影响。';
  if (!validCoffinBearerCombatScene(e.scene) || e.scene.playerPosition !== 'COURT' || e.exitTravelMetres !== 0 || e.exitSeconds !== 0) return '需要原净空院及真实4米普通出口，已经离场不能重开。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先到原院实际交谈，才能和平离开。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；已经到场仍可普通离开。';
  if (e.targetId !== COFFIN_BEARER_TARGET_ID || e.weaponLocation !== 'HAND' || !['AVAILABLE', 'READY'].includes(e.status)) return '原诺兰已有结局，不能再生、重开或补原资源。';
  if (!reported(s)) return '先完成三份真实关闭后的抬棺人报告与反思。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '已经交谈，不重新生成原人。' : s.actionsRemaining < 2 ? '交谈1行动，另留开战1行动；仍可和平离开。' : null;
  return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先实际交谈，确认同一原诺兰、唯一原棍及开放出口。';
}
export const blockCoffinBearerEncounter = coffinBearerEncounterReason;
export function applyCoffinBearerEncounterCommand(s: SliceState, c: CoffinBearerEncounterCommand, ctx: SeerContext): void {
  const reason = coffinBearerEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.coffinBearer.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceCoffinBearerLifeClock(s, 4);
    ctx.note('沿4米原普通出口和平离开', '本人实际走4米、4秒、0行动；原诺兰H100/M100/S120及自己的原棍留原院，旧原人物、原物及资源不变，无奖励或追逐。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原诺兰实际交谈', COFFIN_BEARER_ENCOUNTER_STORY); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'COFFIN_BEARER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原诺兰的有限真实冲突', '实付1行动。新K有限活性保全实付新原段1份及5灵性且可以失败，只削弱后续最多两次正BODY/ARC；不改共同伤势、真实死亡与普通出口。');
}
export const applyCoffinBearerEncounter = applyCoffinBearerEncounterCommand;
export function startCoffinBearerEncounter(s: SliceState, ctx: SeerContext): void { applyCoffinBearerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasCoffinBearerDisputeOpponent(s: SliceState): boolean {
  const e = s.coffinBearer.encounter, c = s.combat;
  return promoted(s) && s.coffinBearer.guidanceKnown && s.coffinBearer.promotionWeek !== null && s.status === 'ACTIVE' && integer(s.health, 1, 100) && integer(s.mind, 1, 100) && !s.activeEvent &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'COFFIN_BEARER_DISPUTE' && c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && integer(c.round, 1) &&
    e.status === 'FIGHTING' && e.targetId === COFFIN_BEARER_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    validCoffinBearerCombatScene(e.scene) && e.scene.clearanceConfirmed && e.scene.playerPosition === 'COURT' && e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.approachWeek !== null && e.attemptWeek === s.week && e.weaponLocation === 'HAND' &&
    [e.guardAttempts, e.preservationAttempts].every(n => integer(n, 0, 3)) && validCoffinBearerCombatGuard(s.coffinBearer.life.guard) &&
    s.coffinBearer.life.guard.segments.filter(x => x.status === 'SPENT').length === e.guardAttempts + e.preservationAttempts &&
    (e.guardMode === null ? e.guardCharges === 0 : e.guardMode === 'MATRIX' ? e.guardCharges === 1 && e.guardAttempts > 0 : e.guardMode === 'PRESERVE' && integer(e.guardCharges, 1, 2) && e.preservationAttempts > 0) &&
    integer(e.enemySpirituality, 0, 120) && COFFIN_BEARER_POWER_IDS.every(id => integer(e.powerUses[id], 0, 30)) && e.enemySpirituality === 120 - COFFIN_BEARER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex, 0, s.combatHistory.length) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleCoffinBearerEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.coffinBearer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'COFFIN_BEARER_DISPUTE') throw new Error('没有同一原诺兰的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知抬棺人冲突结果。');
  const last = c.lastRound, o = last?.coffinBearerOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateCoffinBearerRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !noEffects(e) || !practiceClosed(s) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.weaponLocation !== e.weaponLocation ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.coffinBearer.life.clockSeconds ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk || !same(o.guardAfter, s.coffinBearer.life.guard) ||
    (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与原回合、同一身体、唯一原武器及实付资源不一致。');
  e.terminal = { outcome: outcome as CoffinBearerEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原诺兰的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡留在原院，不复活或移动尸体。' : '本人沿原4米普通出口实际离开，实过4秒，无追逐或瞬移。'}每轮真实60秒，未用有限护持到期；全部实付灵性不退、旧原物不变，原敌健康精神灵性与伤势保留，原棍${e.weaponLocation === 'HAND' ? '仍在原主人手中' : '因原主人死亡留在原院且不归玩家'}；旧奥斯里克与六个旧职业历史不变。`);
}
export function coffinBearerEncounterActions(s: SliceState): CoffinBearerEncounterAction[] {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与诺兰交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原诺兰真实冲突', '1行动 · 真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 实际4秒4米']] as const).map(([type, label, cost]) => {
    const command: CoffinBearerEncounterCommand = { type }, reason = coffinBearerEncounterReason(s, command);
    return { id: `coffinBearer-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectCoffinBearerEncounter(s: SliceState): CoffinBearerEncounterProjection {
  const e = s.coffinBearer.encounter, publicState = { status: e.status, guardMode: e.guardMode, guardCharges: e.guardCharges, guardAttempts: e.guardAttempts, preservationAttempts: e.preservationAttempts };
  if (!promoted(s)) return { ...publicState, title: '尚未开放的抬棺人遭遇', story: '', inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { ...publicState, title: '原净空院与诺兰·韦斯特', story: COFFIN_BEARER_ENCOUNTER_STORY, inside: hasCoffinBearerEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: COFFIN_BEARER_TARGET_ID, name: '诺兰·韦斯特', age: 42, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'CB3-NOLAN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: coffinBearerEncounterActions(s),
    facts: ['3抬棺人名称编号有原核；新增有限活性保全、人物、材料与数值全部G；完整配方与晋升仪式未知，未开放2荒芜主母',
      `原敌H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，原棍在${e.weaponLocation}；弧光${e.powerUses.ARC_BOLT}、屏护${e.powerUses.WARD}、凝神${e.powerUses.COMPOSE}次`,
      `新原护腕CB3-GUARD：基质尝试${e.guardAttempts}次、保全尝试${e.preservationAttempts}次；当前${e.guardMode ?? '无待用护持'}，余${e.guardCharges}次；仅耗真实新原段`,
      'B/K不叠加或刷新；敌方非攻击与0贡献不耗护持，普通凝神不能清实体护腕。R真实恢复本人健康，不清原伤与累计风险，不改变伤势死亡盘',
      `普通离场${e.exitTravelMetres}米/${e.exitSeconds}秒；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '和平离开' : '尚未结束')}；旧奥斯里克、旧护腕与六个旧职业全部状态不变`] };
}
export function validateCoffinBearerEncounterOriginal(s: SliceState): boolean {
  try {
    const e = s.coffinBearer?.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createCoffinBearerEncounterState()).sort()) || e.targetId !== COFFIN_BEARER_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !validCoffinBearerCombatScene(e.scene) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || COFFIN_BEARER_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 30)) || e.enemySpirituality !== 120 - COFFIN_BEARER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(e) || e.weaponLocation !== (e.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') || ![e.guardAttempts, e.preservationAttempts].every(n => integer(n, 0, 3)) || e.exitTravelMetres !== e.scene.ordinaryWalkedMetres || e.exitSeconds !== e.exitTravelMetres ||
      (e.approachWeek !== null && !integer(e.approachWeek, s.coffinBearer.promotionWeek ?? 1, s.week)) || (e.attemptWeek !== null && !integer(e.attemptWeek, e.approachWeek ?? 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
    if (!validCoffinBearerCombatGuard(s.coffinBearer.life.guard) || s.coffinBearer.life.guard.segments.filter(x => x.status === 'SPENT').length !== e.guardAttempts + e.preservationAttempts) return false;
    if (s.coffinBearer.promotionWeek === null) return same(e, createCoffinBearerEncounterState()) && s.combat?.encounterId !== 'COFFIN_BEARER_DISPUTE' && !s.combatHistory.some(r => r.coffinBearerOutcome);
    if (e.startHistoryIndex === null) {
      if (s.combatHistory.some(r => r.coffinBearerOutcome) || s.combat?.encounterId === 'COFFIN_BEARER_DISPUTE' || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null) return false;
      const expected = createCoffinBearerEncounterState(); expected.status = e.status;
      if (e.status !== 'AVAILABLE') { if (e.approachWeek === null || !reported(s)) return false; expected.approachWeek = e.approachWeek; expected.scene.clearanceConfirmed = true; }
      if (e.status === 'RESOLVED') { expected.scene.playerPosition = 'EXIT'; expected.scene.ordinaryWalkedMetres = 4; expected.exitTravelMetres = 4; expected.exitSeconds = 4; }
      return same(e, expected);
    }
    if (!reported(s) || e.attemptWeek === null || e.approachWeek === null || !e.scene.clearanceConfirmed) return false;
    const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
    if (s.combatHistory.filter(r => r.coffinBearerOutcome).length !== own.length) return false;
    let previous: CoffinBearerRoundOutcome | undefined, enemyHealth = 100, enemyRisk = 0;
    const enemyInjuries: SliceInjury[] = [];
    for (const [i, r] of own.entries()) {
      const o = r.coffinBearerOutcome;
      if (!validateCoffinBearerRoundOutcome(o) || r.round !== i + 1 || r.winner === null || o.round !== r.round || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || o.enemyStatus !== 'RESISTING' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        o.source.enemyHealth !== enemyHealth || o.source.enemyMind !== 100 || !same(o.source.enemyInjuries, enemyInjuries) || o.source.enemyRisk !== enemyRisk || r.passiveLuck !== undefined ||
        !integer(r.playerCountRoll, 1, 100) || !integer(r.enemyCountRoll, 1, 100) || r.playerCount !== coffinBearerActionCount(r.playerCountRoll) || r.enemyCount !== coffinBearerEnemyActionCount(r.enemyCountRoll)) return false;
      if (previous) {
        if (o.source.revision <= previous.source.revision || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
          o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || !same(o.source.scene, previous.sceneAfter) ||
          !same(o.source.playerInjuries, previous.playerInjuriesAfter) || o.source.playerRisk !== previous.playerRiskAfter ||
          !same(o.source.coreStats, previous.source.coreStats) || o.source.clubLocation !== previous.source.clubLocation ||
          o.source.carefulMastery !== previous.source.carefulMastery || o.source.healingMastery !== previous.source.healingMastery || o.source.lifeSupportMastery !== previous.source.lifeSupportMastery || o.source.specimenMastery !== previous.source.specimenMastery || o.source.groundMastery !== previous.source.groundMastery || o.source.matrixMastery !== previous.source.matrixMastery || !same(o.source.guard, previous.guardAfter) ||
          o.source.guardAttempts !== previous.guardAttempts || o.source.preservationAttempts !== previous.preservationAttempts || !same(o.source.powerUses, previous.powerUses)) return false;
      } else if (o.enemySpiritualityBefore !== 120 || o.source.guardAttempts !== 0 || o.source.preservationAttempts !== 0 || o.source.guard.segments.some(x => x.status === 'SPENT')) return false;
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
      if (o.playerActions.some(a => a.physicalFactor !== physical(a.healthBefore)) || o.enemyActions.some(a => a.physicalFactor !== physical(o.source.enemyHealth))) return false;
      const stats = o.source.coreStats, core = stats.physique * .2 + stats.perception * .15 + stats.will * .2 + stats.knowledge * .45;
      const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, x) => n + x[key], 0);
      const playerAdvantage = Math.max(125, baseAdvantage(core, o.source.playerHealth, o.source.playerMind, o.playerSpiritualityBefore, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction'));
      const enemyAdvantage = Math.max(125, baseAdvantage(22, o.source.enemyHealth, o.source.enemyMind, o.enemySpiritualityBefore, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction'));
      if (r.playerAdvantage !== playerAdvantage || r.enemyAdvantage !== enemyAdvantage || r.winChance !== playerAdvantage / (playerAdvantage + enemyAdvantage) * 100) return false;
      let playerHealth = o.playerHealthBeforeConsequence, enemyHeavy = false, playerRisk = o.source.playerRisk;
      const playerInjuries = structuredClone(o.source.playerInjuries);
      if (r.winner === 'ENEMY' && r.retreat !== 'SUCCESS' && playerInjuries.length > 0) playerRisk++;
      if (r.winner === 'PLAYER' && r.retreat !== 'SUCCESS' && enemyInjuries.length > 0) enemyRisk++;
      const threatened = r.winner === 'PLAYER' ? o.playerActions.some(a => a.threatens) : o.enemyActions.some(a => a.threatens);
      if ((r.consequenceWeights !== null) !== (r.retreat !== 'SUCCESS' && threatened)) return false;
      if (r.consequenceWeights !== null) {
        if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS' || !same(r.consequenceWeights, consequenceWeights(r.winner === 'PLAYER' ? enemyRisk : playerRisk))) return false;
        const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, severity = r.consequenceRoll <= w.light ? 'LIGHT' : 'HEAVY', damage = severity === 'LIGHT' ? 10 : 30;
        if (r.winner === 'PLAYER') {
          enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage); enemyHeavy = !death && severity === 'HEAVY';
          if (!death) enemyInjuries.push({ id: `${s.runId}:combat:${r.round}:ENEMY:${o.source.revision + 1}:${enemyInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
        } else {
          playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
          if (!death) playerInjuries.push({ id: `${s.runId}:combat:${r.round}:PLAYER:${o.source.revision + 1}:${playerInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
        }
      } else if (r.consequenceRoll !== undefined) return false;
      const expectedStatus = enemyHealth === 0 ? 'DEAD' : enemyHeavy ? 'SURRENDERED' : 'RESISTING';
      const continuing = r.retreat !== 'SUCCESS' && playerHealth > 0 && expectedStatus === 'RESISTING';
      if (o.enemyStatus !== expectedStatus || o.continuing !== continuing || o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth || !same(o.enemyInjuriesAfter, enemyInjuries) || o.enemyRiskAfter !== enemyRisk || o.playerRiskAfter !== playerRisk || !same(o.playerInjuriesAfter, playerInjuries)) return false;
      previous = o;
    }
    const o = last?.coffinBearerOutcome;
    if (!same(enemyInjuries, e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || o.weaponLocation !== e.weaponLocation || !same(o.sceneAfter, e.scene) ||
      !same(o.powerUses, e.powerUses) || o.guardAttempts !== e.guardAttempts || o.preservationAttempts !== e.preservationAttempts || !same(o.guardAfter, s.coffinBearer.life.guard))) return false;
    if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.coffinBearer.life.clockSeconds === o.lifeClockSecondsAfter &&
      same(s.injuries, o.playerInjuriesAfter) && s.injuryRisk === o.playerRiskAfter)) &&
      t === null && hasCoffinBearerDisputeOpponent(s) && (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.guardAttempts === 0 && e.preservationAttempts === 0) &&
      (last ? same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    if (s.combat?.encounterId === 'COFFIN_BEARER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
    return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
  } catch { return false; }
}

export function validateCoffinBearerEncounter(s: SliceState): boolean {
  if(s.barrenMatriarch?.life.source == null) return validateCoffinBearerEncounterOriginal(s);
  if(s.progression.pathwayId !== 'mother' || s.progression.sequence !== 2 || s.barrenMatriarch.promotionWeek === null || s.barrenMatriarch.coffinBearerActingAtPromotion !== 100) return false;
  const inherited={...s, progression:{...s.progression,sequence:3 as const,acting:s.barrenMatriarch.coffinBearerActingAtPromotion}, coffinBearer:{...s.coffinBearer,life:s.barrenMatriarch.life.source.snapshot}};
  return validateCoffinBearerEncounterOriginal(inherited);
}
