import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { baseAdvantage, consequenceWeights } from '../slice/combat.js';
import { hasChaosHunterOldPractice, hasChaosHunterRitualLock } from './index.js';
import { advanceChaosHunterLifeClock, hasChaosHunterLifeLock } from './life.js';
import { chaosHunterActionCount, chaosHunterEnemyActionCount, validateChaosHunterRoundOutcome, validChaosHunterCombatScene, type ChaosHunterRoundOutcome } from './combat.js';

export const CHAOS_HUNTER_TARGET_ID = 'CH3-EDRIC' as const;
export const CHAOS_HUNTER_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type ChaosHunterPowerId = typeof CHAOS_HUNTER_POWER_IDS[number];
export type ChaosHunterEnemyIntent = ChaosHunterPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const CHAOS_HUNTER_POWERS: readonly { id: ChaosHunterPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原有限屏护（G）', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗（G）', cost: 4, selfGain: 8, enemyReduction: 0 },
];
export interface ChaosHunterEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ChaosHunterEncounterScene {
  courtId: 'CH3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 2; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface ChaosHunterEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CHAOS_HUNTER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: ChaosHunterEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ChaosHunterPowerId, number>;
  intimidationReady: boolean; deprivationReady: boolean; composureReady: boolean; playerBodyPending: boolean; enemyBodyPending: boolean; breachReady: boolean;
  intimidationAttempts: number; deprivationAttempts: number; punishmentUses: number; boundedOrderAttempts: number;
  exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; terminal: ChaosHunterEncounterTerminal | null;
}
export type ChaosHunterEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ChaosHunterEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ChaosHunterEncounterCommand }
export interface ChaosHunterEncounterProjection {
  title: string; story: string; status: ChaosHunterEncounterState['status']; inside: boolean; scene: ChaosHunterEncounterScene | null;
  enemy: null | { id: typeof CHAOS_HUNTER_TARGET_ID; name: '埃德里克·梅森'; age: 44; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: ChaosHunterEncounterState['enemyStatus'];
    weaponId: 'CH3-EDRIC-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ChaosHunterPowerId, number> };
  playerBodyPending: boolean; enemyBodyPending: boolean; breachReady: boolean; intimidationReady: boolean; deprivationReady: boolean; composureReady: boolean;
  actions: ChaosHunterEncounterAction[]; facts: string[];
}
export const CHAOS_HUNTER_ENCOUNTER_STORY = '原创成年序列4埃德里克·梅森（44岁，CH3-EDRIC，G）在独立日光净空院CH3-COURT的2米外持自己的唯一原棍CH3-EDRIC-ROD提出争议。原身体H100/M100/S120、体格22；双方1–6动作、1250战势基准/120灵性上限/125底线，主人继承JUSTICIAR核心30/20/35/15和共同65/30/5伤势与旧累计风险。4米普通出口开放，无旁人或追赶，可交谈后和平离开。原弧光5S贡献70、屏护4S减30、凝神4S贡献8共用真实120S，耗尽回退20×身体普通原棍且不补能。新K实付5S、知识20四档，成功给本人与原敌各一份独立待用BODY规则；各在后来一次实际身体动作独立抵抗，不消耗另一份，不自动豁免自己。R暂剥的ARC原槽实际回退BODY时仍受敌方自己的规则，未发动术不收费。有真实旧伤的J、ARC、WARD和COMPOSE不属于BODY；凝神只清旧B/R并本轮抵抗旧B/R，不清双方身体规则。H仅本轮原敌实际抵抗并完成正贡献BODY才可另付3S惩戒一次，不追加行动。所有未用效果轮末结束，实付不退；每轮实际60秒，活着结局普通走4米4秒离场，死者留院，原敌死后原棍留院，否则仍在原手。混乱猎手3名称编号有原核，新增有限双方规则、人物和定量均为G；不将0—36光枪或封空间当通用能力，完整3配方与仪式未知，不下放2平衡者能力。无幸运池、重抽、复活或一句话必死，旧罗温及六阶历史、原物与原资源全部保留。';
export function createChaosHunterEncounterState(): ChaosHunterEncounterState {
  return { status: 'AVAILABLE', targetId: CHAOS_HUNTER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'CH3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, intimidationReady: false, deprivationReady: false, composureReady: false,
    playerBodyPending: false, enemyBodyPending: false, breachReady: false, intimidationAttempts: 0, deprivationAttempts: 0, punishmentUses: 0, boundedOrderAttempts: 0, exitTravelMetres: 0, exitSeconds: 0, terminal: null };
}
export const createChaosHunterEncounter = createChaosHunterEncounterState;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 3;
const reported = (s: SliceState) => Object.values(s.chaosHunter.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (e: ChaosHunterEncounterState) => e.intimidationReady === false && e.deprivationReady === false && e.composureReady === false && e.playerBodyPending === false && e.enemyBodyPending === false && e.breachReady === false;
function practiceClosed(s: SliceState): boolean {
  return !hasChaosHunterRitualLock(s) && !hasChaosHunterOldPractice(s) && !hasChaosHunterLifeLock(s) && !Object.values(s.chaosHunter.life.cases).some(c => c.status === 'PREPARED');
}
export const hasChaosHunterEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.chaosHunter.encounter.status) || !noEffects(s.chaosHunter.encounter);
export const isInsideChaosHunterEncounter = hasChaosHunterEncounterLock;
export function validateChaosHunterEncounterCommand(v: unknown): v is ChaosHunterEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isChaosHunterEncounterCommand = validateChaosHunterEncounterCommand;
export function chaosHunterEncounterReason(s: SliceState, c: ChaosHunterEncounterCommand): string | null {
  if (!validateChaosHunterEncounterCommand(c)) return '混乱猎手遭遇命令无效。';
  const e = s.chaosHunter.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(r => r.chaosHunterOutcome)) return '同一原埃德里克已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !promoted(s)) return '需要本人仍活着并已成为混乱猎手序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.chaosHunter.guidanceKnown || s.chaosHunter.promotionWeek === null) return '需要实际指导与已经完成的混乱猎手晋升。';
  if (s.world.city !== 'BACKLUND') return '需要实际在贝克兰德原独立净空院。';
  if (!practiceClosed(s) || !noEffects(e)) return '先关闭全部新旧实践、接触与准备，真实归还原物并停止未用影响。';
  if (!validChaosHunterCombatScene(e.scene) || e.scene.playerPosition !== 'COURT' || e.exitTravelMetres !== 0 || e.exitSeconds !== 0) return '需要原净空院及真实4米普通出口，已经离场不能重开。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先到原院实际交谈，才能和平离开。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；已经到场仍可普通离开。';
  if (e.targetId !== CHAOS_HUNTER_TARGET_ID || e.weaponLocation !== 'HAND' || !['AVAILABLE', 'READY'].includes(e.status)) return '原埃德里克已有结局，不能再生、重开或补原资源。';
  if (!reported(s)) return '先完成至少一份真实关闭后的混乱猎手报告。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '已经交谈，不重新生成原人。' : s.actionsRemaining < 2 ? '交谈1行动，另留开战1行动；仍可和平离开。' : null;
  return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先实际交谈，确认同一原埃德里克、唯一原棍及开放出口。';
}
export const blockChaosHunterEncounter = chaosHunterEncounterReason;
export function applyChaosHunterEncounterCommand(s: SliceState, c: ChaosHunterEncounterCommand, ctx: SeerContext): void {
  const reason = chaosHunterEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.chaosHunter.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceChaosHunterLifeClock(s, 4);
    ctx.note('沿4米原普通出口和平离开', '本人实际走4米、4秒、0行动；原埃德里克H100/M100/S120及自己的原棍留原院，旧原人物、原物及资源不变，无奖励或追逐。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原埃德里克实际交谈', CHAOS_HUNTER_ENCOUNTER_STORY); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CHAOS_HUNTER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原埃德里克的有限真实冲突', '实付1行动。新K双方有限规则实付5灵性且可以失败；双方各自实际BODY才独立抵抗，凝神不清此规则。共同伤势、真实死亡与实际普通出口均保留。');
}
export const applyChaosHunterEncounter = applyChaosHunterEncounterCommand;
export function startChaosHunterEncounter(s: SliceState, ctx: SeerContext): void { applyChaosHunterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasChaosHunterDisputeOpponent(s: SliceState): boolean {
  const e = s.chaosHunter.encounter, c = s.combat;
  return promoted(s) && s.chaosHunter.guidanceKnown && s.chaosHunter.promotionWeek !== null && s.status === 'ACTIVE' && integer(s.health, 1, 100) && integer(s.mind, 1, 100) && !s.activeEvent &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'CHAOS_HUNTER_DISPUTE' && c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && integer(c.round, 1) &&
    e.status === 'FIGHTING' && e.targetId === CHAOS_HUNTER_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    validChaosHunterCombatScene(e.scene) && e.scene.clearanceConfirmed && e.scene.playerPosition === 'COURT' && e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.approachWeek !== null && e.attemptWeek === s.week && e.weaponLocation === 'HAND' &&
    [e.intimidationReady, e.deprivationReady, e.composureReady, e.playerBodyPending, e.enemyBodyPending, e.breachReady].every(v => typeof v === 'boolean') &&
    !(e.composureReady && (e.intimidationReady || e.deprivationReady)) &&
    [e.intimidationAttempts, e.deprivationAttempts, e.punishmentUses, e.boundedOrderAttempts].every(n => integer(n)) &&
    (!e.intimidationReady || e.intimidationAttempts > 0) && (!e.deprivationReady || e.deprivationAttempts > 0) &&
    (!(e.playerBodyPending || e.enemyBodyPending || e.breachReady) || e.boundedOrderAttempts > 0) && (!e.composureReady || e.powerUses.COMPOSE > 0) &&
    integer(e.enemySpirituality, 0, 120) && CHAOS_HUNTER_POWER_IDS.every(id => integer(e.powerUses[id], 0, 30)) && e.enemySpirituality === 120 - CHAOS_HUNTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex, 0, s.combatHistory.length) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleChaosHunterEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.chaosHunter.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CHAOS_HUNTER_DISPUTE') throw new Error('没有同一原埃德里克的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知混乱猎手冲突结果。');
  const last = c.lastRound, o = last?.chaosHunterOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateChaosHunterRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !noEffects(e) || !practiceClosed(s) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.weaponLocation !== e.weaponLocation ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.chaosHunter.life.clockSeconds ||
    !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk ||
    (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与原回合、同一身体、唯一原武器及实付资源不一致。');
  e.terminal = { outcome: outcome as ChaosHunterEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原埃德里克的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡留在原院，不复活或移动尸体。' : '本人沿原4米普通出口实际离开，实过4秒，无追逐或瞬移。'}每轮真实60秒，未用效果与凝神到期；全部实付灵性不退、旧原物不变，原敌健康精神灵性与伤势保留，原棍${e.weaponLocation === 'HAND' ? '仍在原主人手中' : '因原主人死亡留在原院且不归玩家'}；旧罗温与六阶旧历史不变。`);
}
export function chaosHunterEncounterActions(s: SliceState): ChaosHunterEncounterAction[] {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与埃德里克交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原埃德里克真实冲突', '1行动 · 真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 实际4秒4米']] as const).map(([type, label, cost]) => {
    const command: ChaosHunterEncounterCommand = { type }, reason = chaosHunterEncounterReason(s, command);
    return { id: `chaosHunter-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectChaosHunterEncounter(s: SliceState): ChaosHunterEncounterProjection {
  const e = s.chaosHunter.encounter, publicState = { status: e.status, playerBodyPending: e.playerBodyPending, enemyBodyPending: e.enemyBodyPending,
    breachReady: e.breachReady, intimidationReady: e.intimidationReady, deprivationReady: e.deprivationReady, composureReady: e.composureReady };
  if (!promoted(s)) return { ...publicState, title: '尚未开放的混乱猎手遭遇', story: '', inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { ...publicState, title: '原净空院与埃德里克·梅森', story: CHAOS_HUNTER_ENCOUNTER_STORY, inside: hasChaosHunterEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: CHAOS_HUNTER_TARGET_ID, name: '埃德里克·梅森', age: 44, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'CH3-EDRIC-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: chaosHunterEncounterActions(s),
    facts: ['3混乱猎手名称编号有原核；新增有限双方规则、人物及数值全部G；完整配方与晋升仪式未知，未开放2平衡者',
      `原敌H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，原棍在${e.weaponLocation}；弧光${e.powerUses.ARC_BOLT}、屏护${e.powerUses.WARD}、凝神${e.powerUses.COMPOSE}次`,
      `新K实际尝试${e.boundedOrderAttempts}次；本人待用BODY规则${e.playerBodyPending ? '1份' : '无'}，敌方待用BODY规则${e.enemyBodyPending ? '1份' : '无'}，各自实际BODY独立判定，任何人不自动豁免`,
      'H继承格斗和原棍；J仅真实敌方旧伤才付3S裁断，否则普通BODY；B/R各4S知识18二元判定，凝神4S只清旧B/R',
      `旧震慑${e.intimidationAttempts}次、剥夺${e.deprivationAttempts}次；实际敌方违令待用来源${e.breachReady ? '1份' : '无'}，已实付惩戒${e.punishmentUses}次`,
      `普通离场${e.exitTravelMetres}米/${e.exitSeconds}秒；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '和平离开' : '尚未结束')}；旧原罗温、六阶历史及全部旧物原样保留，无幸运池或补能`] };
}
export function validateChaosHunterEncounter(s: SliceState): boolean {
  try {
    const e = s.chaosHunter?.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createChaosHunterEncounterState()).sort()) || e.targetId !== CHAOS_HUNTER_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !validChaosHunterCombatScene(e.scene) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || CHAOS_HUNTER_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 30)) || e.enemySpirituality !== 120 - CHAOS_HUNTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(e) || e.weaponLocation !== (e.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') || ![e.intimidationAttempts, e.deprivationAttempts, e.punishmentUses, e.boundedOrderAttempts].every(n => integer(n)) || e.exitTravelMetres !== e.scene.ordinaryWalkedMetres || e.exitSeconds !== e.exitTravelMetres ||
      (e.approachWeek !== null && !integer(e.approachWeek, s.chaosHunter.promotionWeek ?? 1, s.week)) || (e.attemptWeek !== null && !integer(e.attemptWeek, e.approachWeek ?? 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
    if (s.chaosHunter.promotionWeek === null) return same(e, createChaosHunterEncounterState()) && s.combat?.encounterId !== 'CHAOS_HUNTER_DISPUTE' && !s.combatHistory.some(r => r.chaosHunterOutcome);
    if (e.startHistoryIndex === null) {
      if (s.combatHistory.some(r => r.chaosHunterOutcome) || s.combat?.encounterId === 'CHAOS_HUNTER_DISPUTE' || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null) return false;
      const expected = createChaosHunterEncounterState(); expected.status = e.status;
      if (e.status !== 'AVAILABLE') { if (e.approachWeek === null || !reported(s)) return false; expected.approachWeek = e.approachWeek; expected.scene.clearanceConfirmed = true; }
      if (e.status === 'RESOLVED') { expected.scene.playerPosition = 'EXIT'; expected.scene.ordinaryWalkedMetres = 4; expected.exitTravelMetres = 4; expected.exitSeconds = 4; }
      return same(e, expected);
    }
    if (!reported(s) || e.attemptWeek === null || e.approachWeek === null || !e.scene.clearanceConfirmed) return false;
    const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
    if (s.combatHistory.filter(r => r.chaosHunterOutcome).length !== own.length) return false;
    let previous: ChaosHunterRoundOutcome | undefined, enemyHealth = 100, enemyRisk = 0;
    const enemyInjuries: SliceInjury[] = [];
    for (const [i, r] of own.entries()) {
      const o = r.chaosHunterOutcome;
      if (!validateChaosHunterRoundOutcome(o) || r.round !== i + 1 || r.winner === null || o.round !== r.round || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || o.enemyStatus !== 'RESISTING' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        o.source.enemyHealth !== enemyHealth || o.source.enemyMind !== 100 || !same(o.source.enemyInjuries, enemyInjuries) || o.source.enemyRisk !== enemyRisk || r.passiveLuck !== undefined ||
        !integer(r.playerCountRoll, 1, 100) || !integer(r.enemyCountRoll, 1, 100) || r.playerCount !== chaosHunterActionCount(r.playerCountRoll) || r.enemyCount !== chaosHunterEnemyActionCount(r.enemyCountRoll)) return false;
      if (previous) {
        if (o.source.revision <= previous.source.revision || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
          o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || !same(o.source.scene, previous.sceneAfter) ||
          !same(o.source.playerInjuries, previous.playerInjuriesAfter) || o.source.playerRisk !== previous.playerRiskAfter ||
          !same(o.source.coreStats, previous.source.coreStats) || o.source.clubLocation !== previous.source.clubLocation ||
          o.source.bodyMastery !== previous.source.bodyMastery || o.source.woundMastery !== previous.source.woundMastery || o.source.punishmentMastery !== previous.source.punishmentMastery || o.source.traceMastery !== previous.source.traceMastery || o.source.prohibitionMastery !== previous.source.prohibitionMastery ||
          o.source.intimidationAttempts !== previous.intimidationAttempts || o.source.deprivationAttempts !== previous.deprivationAttempts || o.source.punishmentUses !== previous.punishmentUses || o.source.boundedOrderAttempts !== previous.boundedOrderAttempts || !same(o.source.powerUses, previous.powerUses)) return false;
      } else if (o.enemySpiritualityBefore !== 120 || o.source.intimidationAttempts !== 0 || o.source.deprivationAttempts !== 0 || o.source.punishmentUses !== 0 || o.source.boundedOrderAttempts !== 0) return false;
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
      const stats = o.source.coreStats, core = stats.physique * .3 + stats.perception * .2 + stats.will * .35 + stats.knowledge * .15;
      const sum = (actions: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => actions.reduce((n, x) => n + x[key], 0);
      const playerAdvantage = Math.max(125, baseAdvantage(core, o.source.playerHealth, o.source.playerMind, o.playerSpiritualityBefore, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction'));
      const enemyAdvantage = Math.max(125, baseAdvantage(22, o.source.enemyHealth, o.source.enemyMind, o.enemySpiritualityBefore, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction'));
      if (r.playerAdvantage !== playerAdvantage || r.enemyAdvantage !== enemyAdvantage || r.winChance !== playerAdvantage / (playerAdvantage + enemyAdvantage) * 100) return false;
      let playerHealth = o.source.playerHealth, enemyHeavy = false, playerRisk = o.source.playerRisk;
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
    const o = last?.chaosHunterOutcome;
    if (!same(enemyInjuries, e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || o.weaponLocation !== e.weaponLocation || !same(o.sceneAfter, e.scene) ||
      !same(o.powerUses, e.powerUses) || o.intimidationAttempts !== e.intimidationAttempts || o.deprivationAttempts !== e.deprivationAttempts || o.punishmentUses !== e.punishmentUses || o.boundedOrderAttempts !== e.boundedOrderAttempts)) return false;
    if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.chaosHunter.life.clockSeconds === o.lifeClockSecondsAfter &&
      same(s.injuries, o.playerInjuriesAfter) && s.injuryRisk === o.playerRiskAfter)) &&
      t === null && hasChaosHunterDisputeOpponent(s) && (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.intimidationAttempts === 0 && e.deprivationAttempts === 0 && e.punishmentUses === 0 && e.boundedOrderAttempts === 0) &&
      (last ? same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    if (s.combat?.encounterId === 'CHAOS_HUNTER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
    return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
  } catch { return false; }
}
