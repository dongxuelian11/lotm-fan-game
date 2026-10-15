import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasBlathererRitualLock, hasBlathererOldPractice } from './index.js';
import { advanceBlathererLifeClock, hasBlathererLifeLock } from './life.js';
import { blathererActionCount, blathererEnemyActionCount, validateBlathererRoundOutcome, validBlathererCombatScene } from './combat.js';

export const BLATHERER_TARGET_ID = 'BL3-EDRIC' as const;
export const BLATHERER_POWER_IDS = ['ARC_BOLT', 'WARD'] as const;
export type BlathererPowerId = typeof BLATHERER_POWER_IDS[number];
export type BlathererEnemyIntent = BlathererPowerId | 'BODY_STRIKE' | 'STEADY_BREATH' | 'ACCIDENT';
export const BLATHERER_POWERS = [
  { id: 'ARC_BOLT', label: '原创G有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原创G有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
] as const;
export interface BlathererEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface BlathererEncounterScene {
  courtId: 'BL3-COURT'; targetAwake: boolean; targetListening: boolean; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 4; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface BlathererEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof BLATHERER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: BlathererEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<BlathererPowerId, number>;
  whisperReady: boolean; residualSeconds: 0 | 30; breathUses: number; terminal: BlathererEncounterTerminal | null;
}
export type BlathererEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface BlathererEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BlathererEncounterCommand }
export interface BlathererEncounterProjection {
  title: string; story: string; status: BlathererEncounterState['status']; inside: boolean; scene: BlathererEncounterScene | null;
  enemy: null | { id: typeof BLATHERER_TARGET_ID; name: '埃德里克·凯尔'; age: 48; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: BlathererEncounterState['enemyStatus'];
    weaponId: 'BL3-EDRIC-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<BlathererPowerId, number>; breathUses: number };
  whisperReady: boolean; residualSeconds: number;
  actions: BlathererEncounterAction[]; facts: string[];
}
export const BLATHERER_ENCOUNTER_STORY = '成年埃德里克·凯尔（48岁，BL3-EDRIC）是独立原创G序列4对手，在净空原院BL3-COURT的4米外清醒可听，持自己的唯一原棍BL3-EDRIC-ROD。H100/M100/S120、身体22；原奥里克的真实投降与旧种子历史留在原场。4米普通出口开放，无追逐、没有旁人，也无友军免疫。双方1–6动作，沿用魔鬼实际核心35/30/15/20与共同65/30/5及旧风险伤势盘。H30/J15/B20/K20/R10/A5；旧火焰3S＋1原负荷、旧硬皮2S＋1原负荷，上限3，原短棍在手则普通替换火焰。新有限低语4S＋1M/知识18，成功只使本轮下一正身体或实际弧光战势×0.5一次，不叠乘；失败保留费用，无直接伤害、永久疯狂或强制服从。敌弧光5S/70、屏护4S/30、普通原棍20×身体、集中呼吸0S/8真实解除待发生低语和余留，资源不足普通回退。每轮60秒；终局余留另实等30秒，活人普通走4米4秒离开，不补血、补敌灵性或复活。人物、场地、距离、法术与定量均G。';
export function createBlathererEncounterState(): BlathererEncounterState {
  return { status: 'AVAILABLE', targetId: BLATHERER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'BL3-COURT', targetAwake: true, targetListening: true, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0 }, whisperReady: false, residualSeconds: 0, breathUses: 0, terminal: null };
}
export const createBlathererEncounter = createBlathererEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 3;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateBlathererEncounterCommand(v: unknown): v is BlathererEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isBlathererEncounterCommand = validateBlathererEncounterCommand;
export const hasBlathererEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.blatherer.encounter.status);
export const isInsideBlathererEncounter = hasBlathererEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasBlathererRitualLock(s) || hasBlathererLifeLock(s) || Object.values(s.blatherer.life.cases).some(c => c.status === 'PREPARED') || hasBlathererOldPractice(s);
}
const noEffects = (e: BlathererEncounterState) => e.whisperReady === false && e.residualSeconds === 0;
function actualCourt(e: BlathererEncounterState, confirmed = true): boolean { return validBlathererCombatScene(e.scene) && (!confirmed || e.scene.clearanceConfirmed); }
export function blockBlathererEncounter(s: SliceState, c: BlathererEncounterCommand): string | null {
  if (!validateBlathererEncounterCommand(c)) return '呓语者遭遇命令无效。';
  const e = s.blatherer.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(h => h.blathererOutcome)) return '原埃德里克已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !stage(s) || !Number.isFinite(s.health) || s.health <= 0) return '须本人仍活着并已成为呓语者·深渊序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.blatherer.guidanceKnown || s.blatherer.promotionWeek === null) return '须保有罗安·费里的实际指导并完成呓语者晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空院落。';
  if (otherSceneOpen(s) || !noEffects(e)) return '先真实收束当前实践、准备、有限效果和原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿普通出口和平离开。' : !actualCourt(e) ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY') || e.targetId !== BLATHERER_TARGET_ID || e.weaponLocation !== 'HAND') return '须同一原埃德里克、原棍、净空院和普通出口实际存在。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原埃德里克已有进展或结局，不重新生成或补充资源。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原埃德里克、原棍和普通出口。';
}
export const blathererEncounterReason = blockBlathererEncounter;
export function applyBlathererEncounterCommand(s: SliceState, c: BlathererEncounterCommand, ctx: SeerContext): void {
  const reason = blockBlathererEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.blatherer.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; e.scene.targetListening = false; advanceBlathererLifeClock(s, 4);
    ctx.note('沿原普通出口和平离开', '本人实际普通走4米、耗4秒离开，无追逐、瞬移或奖励；原埃德里克H100/M100/S120与自己的原棍留原场，旧奥里克投降和历史不改。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原埃德里克实际交谈', BLATHERER_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'BLATHERER_COURT', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原院落的真实冲突', '双方使用同一原身体、独立原武器和实际灵性；有限低语可能失败或被实际集中呼吸解除，共同伤势、死亡与普通撤退无豁免。');
}
export const applyBlathererEncounter = applyBlathererEncounterCommand;
export function startBlathererEncounter(s: SliceState, ctx: SeerContext): void { applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasBlathererCourtOpponent(s: SliceState): boolean {
  const e = s.blatherer?.encounter, c = s.combat;
  return !!e && s.blatherer.guidanceKnown && s.blatherer.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && integer(s.health, 1, 100) && integer(s.mind, 1, 100) && integer(s.spirituality, 0, 120) && !s.activeEvent &&
    s.world.city === 'BACKLUND' && !otherSceneOpen(s) && e.status === 'FIGHTING' && e.targetId === BLATHERER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.scene.targetAwake && e.scene.targetListening && e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'BLATHERER_COURT' &&
    c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(s.blatherer.life.clockSeconds) && integer(e.enemySpirituality, 0, 120) && BLATHERER_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - BLATHERER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && typeof e.whisperReady === 'boolean' && [0, 30].includes(e.residualSeconds) && (!e.whisperReady || e.residualSeconds === 30) && integer(e.breathUses) && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export const hasBlathererDisputeOpponent = hasBlathererCourtOpponent;
export function settleBlathererEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.blatherer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'BLATHERER_COURT') throw new Error('没有同一原埃德里克的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原院落战斗结果。');
  const last = c.lastRound, o = last?.blathererOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateBlathererRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.playerStrainAfter !== s.demon.strain || o.breathUses !== e.breathUses || !noEffects(e) ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.blatherer.life.clockSeconds ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE'))) throw new Error('同一原身体、实际原负荷与有限资源不符已保存回合。');
  e.terminal = { outcome: outcome as BlathererEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原院落冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡并留在原院，不复活或自动返回。' : '仍活着的本人普通走4米沿开放原出口离开，无追逐、瞬移或夺棍。'}埃德里克原健康${e.enemyHealth}、灵性${e.enemySpirituality}和原伤势保留；当轮低语结束，余留已真实等待或实际集中呼吸消退，不补血或资源。原奥里克投降与旧种子历史不改。`);
}
export function blathererEncounterActions(s: SliceState): BlathererEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与埃德里克交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原埃德里克真实冲突', '1行动 · 真实受伤或死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 4秒实际普通走路']] as const).map(([type, label, cost]) => {
    const command: BlathererEncounterCommand = { type }, reason = blockBlathererEncounter(s, command);
    return { id: `blatherer-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectBlathererEncounter(s: SliceState): BlathererEncounterProjection {
  const e = s.blatherer.encounter;
  if (!stage(s)) return { title: '尚未开放的呓语者遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, whisperReady: false, residualSeconds: 0, actions: [], facts: [] };
  return { title: '原净空院与独立的埃德里克·凯尔', story: BLATHERER_ENCOUNTER_STORY, status: e.status, inside: hasBlathererEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: BLATHERER_TARGET_ID, name: '埃德里克·凯尔', age: 48, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'BL3-EDRIC-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, breathUses: e.breathUses }, whisperReady: e.whisperReady, residualSeconds: e.residualSeconds, actions: blathererEncounterActions(s),
    facts: ['呓语者候选名称与序列映射为推断；此处新增能力、独立人物、场景与定量全部G',
      `开场原人4米内清醒可听，净空无旁人；当前${e.scene.targetAwake ? e.scene.targetListening ? '仍在4米内，可听短促输入' : '输入已经停止或本人已离场，不再作为当前听者' : '原身体已经死亡，不再能听'}。普通出口开放，无追逐、瞬移或友军免疫`,
      '有限低语4S＋1M/知识18；只减半本轮下一实际正身体或弧光战势一次，重复成功不叠乘',
      `原埃德里克实用弧光${e.powerUses.ARC_BOLT}次、屏护${e.powerUses.WARD}次、集中呼吸${e.breathUses}次；剩余S${e.enemySpirituality}/120，无免费补充`,
      '原恶魔负荷上限3；只有实付旧火焰或硬皮增加同一原负荷，不复制、转移或清零',
      `原人保留${e.enemyInjuries.length}处伤势；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '普通和平离开' : '尚未终结')}，原棍${e.weaponLocation === 'HAND' ? '本人持有' : '留原院'}`,
      `本人累计普通离场${e.scene.ordinaryWalkedMetres}米；每轮60秒，终局若有轻微余留实等30秒、活人另走4秒，无治疗、复活或旧结局回收`] };
}
/** Replays ordered costs, original strain and shared alternating-action evidence across rounds. */
export function validateBlathererEncounter(s: SliceState): boolean {
  try {
    const e = s.blatherer?.encounter, initial = createBlathererEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== BLATHERER_TARGET_ID ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !integer(e.breathUses) || !noEffects(e) || e.scene.targetAwake !== (e.enemyStatus !== 'DEAD') ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
      e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
      !e.powerUses || !same(Object.keys(e.powerUses).sort(), [...BLATHERER_POWER_IDS].sort()) || !BLATHERER_POWER_IDS.every(id => integer(e.powerUses[id])) ||
      e.enemySpirituality !== 120 - BLATHERER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.startHistoryIndex === null && s.combatHistory.some(h => h.blathererOutcome)) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'BLATHERER_COURT';
    if (!stage(s) || !s.blatherer.guidanceKnown || s.blatherer.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.blatherer.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      (e.status === 'READY' ? e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 && e.scene.targetListening : e.scene.playerPosition === 'EXIT' && e.scene.ordinaryWalkedMetres === 4 && !e.scene.targetListening) &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, targetListening: true, clearanceConfirmed: false, playerPosition: 'COURT', ordinaryWalkedMetres: 0 } }, initial) && s.combat?.encounterId !== 'BLATHERER_COURT';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (s.combatHistory.some((h, i) => h.blathererOutcome && (i < e.startHistoryIndex! || i >= end))) return false;
    for (const [i, round] of rounds.entries()) {
      const o = round.blathererOutcome, previous = rounds[i - 1]?.blathererOutcome;
      if (!validateBlathererRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
        o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.revision > s.revision ||
        (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) ||
        !same(o.source.scene, previous.sceneAfter) || o.source.strain !== previous.playerStrainAfter || o.source.breathUses !== previous.breathUses || !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
        o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || ['knowledge', 'mastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0 || o.source.breathUses !== 0 ||
          !same(o.source.scene, { ...initial.scene, clearanceConfirmed: true })) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first || round.playerCount !== blathererActionCount(round.playerCountRoll) ||
        round.enemyCount !== blathererEnemyActionCount(round.enemyCountRoll) || !same(moves, round.moves)) return false;
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
    const last = rounds.at(-1), o = last?.blathererOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk || !same(o.sceneAfter, e.scene) || o.breathUses !== e.breathUses)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasBlathererCourtOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
        s.blatherer.life.clockSeconds === o.lifeClockSecondsAfter && s.demon.strain === o.playerStrainAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && same(e.scene, { ...initial.scene, clearanceConfirmed: true }));
    const t = e.terminal;
    if (s.combat?.encounterId === 'BLATHERER_COURT' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 && e.scene.playerPosition === 'EXIT';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && e.scene.playerPosition === 'COURT';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && e.scene.playerPosition === 'EXIT' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
