import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasProphecyMasterRitualLock, hasProphecyMasterOldPractice } from './index.js';
import { advanceProphecyMasterLifeClock, hasProphecyMasterLifeLock } from './life.js';
import { prophecyMasterActionCount, prophecyMasterEnemyActionCount, validateProphecyMasterRoundOutcome, validProphecyMasterCombatScene } from './combat.js';

export const PROPHECY_MASTER_TARGET_ID = 'PM3-OSRIC' as const;
export const PROPHECY_MASTER_POWER_IDS = ['ARC_BOLT', 'WARD', 'FEINT'] as const;
export type ProphecyMasterPowerId = typeof PROPHECY_MASTER_POWER_IDS[number];
export type ProphecyMasterEnemyIntent = ProphecyMasterPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const PROPHECY_MASTER_POWERS = [
  { id: 'ARC_BOLT', label: '原创G有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原创G有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'FEINT', label: '原创G针对实际预兆窗口的假动作', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ProphecyMasterEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ProphecyMasterEncounterScene {
  courtId: 'PM3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 4; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface ProphecyMasterEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof PROPHECY_MASTER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: ProphecyMasterEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<ProphecyMasterPowerId, number>;
  cageReady: boolean; echoReady: boolean; propheticWindow: boolean; terminal: ProphecyMasterEncounterTerminal | null;
}
export type ProphecyMasterEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ProphecyMasterEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphecyMasterEncounterCommand }
export interface ProphecyMasterEncounterProjection {
  title: string; story: string; status: ProphecyMasterEncounterState['status']; inside: boolean; scene: ProphecyMasterEncounterScene | null;
  enemy: null | { id: typeof PROPHECY_MASTER_TARGET_ID; name: '奥斯里克·盖尔'; age: 48; source: 'ORIGINAL_LIMITED_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: ProphecyMasterEncounterState['enemyStatus'];
    weaponId: 'PM3-OSRIC-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ProphecyMasterPowerId, number> };
  actions: ProphecyMasterEncounterAction[]; facts: string[];
}
export const PROPHECY_MASTER_ENCOUNTER_STORY = '成年奥斯里克·盖尔（48岁，PM3-OSRIC）在净空原院PM3-COURT的4米外持自己的唯一原棍PM3-OSRIC-ROD提出争议。他是独立原创有限G3等效对手，H100/M100/S120；原卢坎仍保留真实投降结局。原普通出口4米开放，无追逐、没有第三人在场，也不提供友军免疫。双方1–6动作，继承神秘学家核心10/30/25/35与共同伤势/死亡盘。玩家旧原卷或已学冲力30、实练次击15、旧防护20、旧牢笼15、本人已学迟钟回声10、模糊预兆5、失衡5；原卷只耗已有已授权库存，旧公开故事效力仍15%。预兆付6S＋2M/知识18，只准备本轮下一真实身体或付费弧光正贡献×0.7，先假动作可耗掉窗口，失败/过期费用不退；不是提前攻击、必中免伤或任意改变未来。敌原弧光5S/70G、屏护4S/30G、假动作仅有窗口时3S/0威胁，灵性不足回退原棍20×身体；无窗口假动作普通观察0S。人物、场地、距离、有限法术和所有定量均G。';
export function createProphecyMasterEncounterState(): ProphecyMasterEncounterState {
  return { status: 'AVAILABLE', targetId: PROPHECY_MASTER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'PM3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, FEINT: 0 }, cageReady: false, echoReady: false, propheticWindow: false, terminal: null };
}
export const createProphecyMasterEncounter = createProphecyMasterEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'hermit' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateProphecyMasterEncounterCommand(v: unknown): v is ProphecyMasterEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isProphecyMasterEncounterCommand = validateProphecyMasterEncounterCommand;
export const hasProphecyMasterEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.prophecyMaster.encounter.status);
export const isInsideProphecyMasterEncounter = hasProphecyMasterEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasProphecyMasterRitualLock(s) || hasProphecyMasterLifeLock(s) || Object.values(s.prophecyMaster.life.cases).some(c => c.status === 'PREPARED') || hasProphecyMasterOldPractice(s);
}
const noEffects = (e: ProphecyMasterEncounterState) => e.cageReady === false && e.echoReady === false && e.propheticWindow === false;
function actualCourt(e: ProphecyMasterEncounterState, confirmed = true): boolean { return validProphecyMasterCombatScene(e.scene) && (!confirmed || e.scene.clearanceConfirmed); }
export function blockProphecyMasterEncounter(s: SliceState, c: ProphecyMasterEncounterCommand): string | null {
  if (!validateProphecyMasterEncounterCommand(c)) return '预言大师遭遇命令无效。';
  const e = s.prophecyMaster.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(h => h.prophecyMasterOutcome)) return '原奥斯里克已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !stage(s) || !Number.isFinite(s.health) || s.health <= 0) return '须本人仍活着并已成为预言大师·隐者序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.prophecyMaster.guidanceKnown || s.prophecyMaster.promotionWeek === null) return '须保有埃莉拉的实际指导并完成预言大师晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空院落。';
  if (otherSceneOpen(s) || !noEffects(e)) return '先真实收束当前实践、准备、有限效果和原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿普通出口和平离开。' : !actualCourt(e) ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY') || e.targetId !== PROPHECY_MASTER_TARGET_ID || e.weaponLocation !== 'HAND') return '须同一原奥斯里克、原棍、净空院和普通出口实际存在。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原奥斯里克已有进展或结局，不重新生成或补充资源。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原奥斯里克、原棍和普通出口。';
}
export const prophecyMasterEncounterReason = blockProphecyMasterEncounter;
export function applyProphecyMasterEncounterCommand(s: SliceState, c: ProphecyMasterEncounterCommand, ctx: SeerContext): void {
  const reason = blockProphecyMasterEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.prophecyMaster.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; advanceProphecyMasterLifeClock(s, 4);
    ctx.note('沿原普通出口和平离开', '本人实际普通走4米、耗4秒离开，无追逐、瞬移或奖励；原奥斯里克H100/M100/S120与自己的原棍留原场，旧卢坎和已公开故事不改。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原奥斯里克实际交谈', PROPHECY_MASTER_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'PROPHECY_MASTER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原院落的真实冲突', '双方使用同一原身体、独立原武器和实际灵性；模糊预兆可能失败或被假动作消耗，共同伤势、死亡与普通撤退无豁免。');
}
export const applyProphecyMasterEncounter = applyProphecyMasterEncounterCommand;
export function startProphecyMasterEncounter(s: SliceState, ctx: SeerContext): void { applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasProphecyMasterDisputeOpponent(s: SliceState): boolean {
  const e = s.prophecyMaster?.encounter, c = s.combat;
  return !!e && s.prophecyMaster.guidanceKnown && s.prophecyMaster.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent &&
    s.world.city === 'BACKLUND' && !otherSceneOpen(s) && e.status === 'FIGHTING' && e.targetId === PROPHECY_MASTER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'PROPHECY_MASTER_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(s.prophecyMaster.life.clockSeconds) && integer(e.enemySpirituality, 0, 120) && PROPHECY_MASTER_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - PROPHECY_MASTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && [e.cageReady, e.echoReady, e.propheticWindow].every(v => typeof v === 'boolean') &&
    (!e.echoReady || s.mystic.life.echoLearned) && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleProphecyMasterEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.prophecyMaster.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'PROPHECY_MASTER_DISPUTE') throw new Error('没有同一原奥斯里克的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原院落战斗结果。');
  const last = c.lastRound, o = last?.prophecyMasterOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateProphecyMasterRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || !same(o.workshopAfter, s.scrollProfessor.workshop) || !noEffects(e) ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.prophecyMaster.life.clockSeconds ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE'))) throw new Error('同一原身体、实际原卷与有限资源不符已保存回合。');
  e.terminal = { outcome: outcome as ProphecyMasterEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原院落冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡并留在原院，不复活或自动返回。' : '仍活着的本人普通走4米沿开放原出口离开，无追逐、瞬移或夺棍。'}奥斯里克原健康${e.enemyHealth}、灵性${e.enemySpirituality}和原伤势保留；预兆、牢笼、回声全部结束，原卷已用即耗，不补血或资源。原卢坎投降与旧公开故事不改。`);
}
export function prophecyMasterEncounterActions(s: SliceState): ProphecyMasterEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与奥斯里克交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原奥斯里克真实冲突', '1行动 · 真实受伤或死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 4秒实际普通走路']] as const).map(([type, label, cost]) => {
    const command: ProphecyMasterEncounterCommand = { type }, reason = blockProphecyMasterEncounter(s, command);
    return { id: `prophecyMaster-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectProphecyMasterEncounter(s: SliceState): ProphecyMasterEncounterProjection {
  const e = s.prophecyMaster.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的预言大师遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原净空院与独立的奥斯里克·盖尔', story: PROPHECY_MASTER_ENCOUNTER_STORY, status: e.status, inside: hasProphecyMasterEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: PROPHECY_MASTER_TARGET_ID, name: '奥斯里克·盖尔', age: 48, source: 'ORIGINAL_LIMITED_G', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'PM3-OSRIC-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: prophecyMasterEncounterActions(s),
    facts: ['新预兆只有模糊画面和有限当轮准备，不提前揭示或改写下一实际动作；全部人物、场景、法术及定量均G',
      '原人相距4米，净空无旁人；4米普通出口开放，无追逐或任意传送',
      '预兆6S＋2M，知识18；下一实际正贡献身体或付费弧光×0.7，假动作也可消费窗口，无自动攻击或免伤',
      `奥斯里克实用弧光${e.powerUses.ARC_BOLT}次、屏护${e.powerUses.WARD}次、付费假动作${e.powerUses.FEINT}次；剩余S${e.enemySpirituality}/120，不免费补充`,
      '旧已授权原卷实际耗用才改变旧库存；旧已公开迟钟回声仍15%效力，原卢坎真实投降与旧人旧物保留',
      `原奥斯里克保留${e.enemyInjuries.length}处伤势；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '普通和平离开' : '尚未终结')}，原棍${e.weaponLocation === 'HAND' ? '本人持有' : '留原院'}`,
      `本人累计普通离场${e.scene.ordinaryWalkedMetres}米；真实战斗每轮60秒，无免费治疗、复活或故事回收`] };
}
/** Replays ordered costs, original inventory and shared alternating-action evidence across rounds. */
export function validateProphecyMasterEncounter(s: SliceState): boolean {
  try {
    const e = s.prophecyMaster?.encounter, initial = createProphecyMasterEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== PROPHECY_MASTER_TARGET_ID ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !noEffects(e) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
      e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
      !e.powerUses || !same(Object.keys(e.powerUses).sort(), [...PROPHECY_MASTER_POWER_IDS].sort()) || !PROPHECY_MASTER_POWER_IDS.every(id => integer(e.powerUses[id])) ||
      e.enemySpirituality !== 120 - PROPHECY_MASTER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.startHistoryIndex === null && s.combatHistory.some(h => h.prophecyMasterOutcome)) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'PROPHECY_MASTER_DISPUTE';
    if (!hasHistory(s) || !s.prophecyMaster.guidanceKnown || s.prophecyMaster.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.prophecyMaster.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      (e.status === 'READY' ? e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 : e.scene.playerPosition === 'EXIT' && e.scene.ordinaryWalkedMetres === 4) &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false, playerPosition: 'COURT', ordinaryWalkedMetres: 0 } }, initial) && s.combat?.encounterId !== 'PROPHECY_MASTER_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (s.combatHistory.some((h, i) => h.prophecyMasterOutcome && (i < e.startHistoryIndex! || i >= end))) return false;
    for (const [i, round] of rounds.entries()) {
      const o = round.prophecyMasterOutcome, previous = rounds[i - 1]?.prophecyMasterOutcome;
      if (!validateProphecyMasterRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
        o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.revision > s.revision ||
        (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) || o.source.echoLearned !== s.mystic.life.echoLearned || o.source.publicDisclosed !== s.mystic.life.publicDisclosed) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) ||
        !same(o.source.scene, previous.sceneAfter) || !same(o.source.workshop, previous.workshopAfter) || !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
        o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || ['knowledge', 'mastery', 'clubHeld', 'learnedImpact', 'learnedWard'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0 ||
          !same(o.source.scene, { ...initial.scene, clearanceConfirmed: true })) return false;
      // Every recorded original remains the same physical item after combat; a spent one cannot reappear HELD.
      for (const scroll of o.workshopAfter.scrolls) {
        const actual = s.scrollProfessor.workshop.scrolls.find(a => a.id === scroll.id);
        if (!actual || !same({ ...actual, status: scroll.status, usedWeek: scroll.usedWeek, authorized: scroll.authorized }, scroll) ||
          scroll.status === 'USED' && !same(actual, scroll) || !same(s.scrollProfessor.workshop.materials.find(m => m.id === scroll.materialId), o.workshopAfter.materials.find(m => m.id === scroll.materialId))) return false;
      }
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first || round.playerCount !== prophecyMasterActionCount(round.playerCountRoll) ||
        round.enemyCount !== prophecyMasterEnemyActionCount(round.enemyCountRoll) || !same(moves, round.moves)) return false;
      const expectedActors: ('PLAYER' | 'ENEMY')[] = [], remaining = { PLAYER: round.playerCount, ENEMY: round.enemyCount }, order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
      let retreated = false;
      while (!retreated && (remaining.PLAYER > 0 || remaining.ENEMY > 0)) {
        for (const actor of order) {
          if (remaining[actor] === 0) continue;
          if (actor === 'PLAYER' && round.stance === 'RETREAT') { remaining.PLAYER = 0;
            if (round.retreat === 'SUCCESS') { retreated = true; break; } if (round.retreat !== 'FAILURE') return false;
          } else { remaining[actor]--; expectedActors.push(actor); }
        }
      }
      if (round.stance !== 'RETREAT' && round.retreat !== 'NONE' || !same(expectedActors, moves.map(a => a.actor))) return false;
    }
    const last = rounds.at(-1), o = last?.prophecyMasterOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk || !same(o.sceneAfter, e.scene))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasProphecyMasterDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
        s.prophecyMaster.life.clockSeconds === o.lifeClockSecondsAfter && same(s.scrollProfessor.workshop, o.workshopAfter)
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && same(e.scene, { ...initial.scene, clearanceConfirmed: true }));
    const t = e.terminal;
    if (s.combat?.encounterId === 'PROPHECY_MASTER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 && e.scene.playerPosition === 'EXIT';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && e.scene.playerPosition === 'COURT';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && e.scene.playerPosition === 'EXIT' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
