import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasThreeHeadedTemplarRitualLock, hasThreeHeadedTemplarOldPractice } from './index.js';
import { advanceThreeHeadedTemplarLifeClock, applyThreeHeadedTemplarActivity, validateThreeHeadedTemplarSpiritSources } from './life.js';
import { threeHeadedTemplarActionCount, threeHeadedTemplarEnemyActionCount, validateThreeHeadedTemplarRoundOutcome, validThreeHeadedTemplarCombatScene } from './combat.js';

export const THREE_HEADED_TEMPLAR_TARGET_ID = 'THT3-BRAM' as const;
export const THREE_HEADED_TEMPLAR_POWER_IDS = ['ARC_BOLT', 'WARD', 'LIGHT_BREAK'] as const;
export type ThreeHeadedTemplarPowerId = typeof THREE_HEADED_TEMPLAR_POWER_IDS[number];
export type ThreeHeadedTemplarEnemyIntent = ThreeHeadedTemplarPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const THREE_HEADED_TEMPLAR_POWERS = [
  { id: 'ARC_BOLT', label: '原创G有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原创G有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'LIGHT_BREAK', label: '原创G原光束驱回一个实际外放原灵', cost: 6, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ThreeHeadedTemplarEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ThreeHeadedTemplarEncounterScene {
  courtId: 'THT3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 4; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface ThreeHeadedTemplarEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof THREE_HEADED_TEMPLAR_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: ThreeHeadedTemplarEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<ThreeHeadedTemplarPowerId, number>;
  shadowReady: boolean; terminal: ThreeHeadedTemplarEncounterTerminal | null;
}
export type ThreeHeadedTemplarEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ThreeHeadedTemplarEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ThreeHeadedTemplarEncounterCommand }
export interface ThreeHeadedTemplarEncounterProjection {
  title: string; story: string; status: ThreeHeadedTemplarEncounterState['status']; inside: boolean; scene: ThreeHeadedTemplarEncounterScene | null;
  enemy: null | { id: typeof THREE_HEADED_TEMPLAR_TARGET_ID; name: '布拉姆·福斯'; age: 49; source: 'ORIGINAL_LIMITED_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: ThreeHeadedTemplarEncounterState['enemyStatus'];
    weaponId: 'THT3-BRAM-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<ThreeHeadedTemplarPowerId, number> };
  actions: ThreeHeadedTemplarEncounterAction[]; facts: string[];
}
export const THREE_HEADED_TEMPLAR_ENCOUNTER_STORY = '49岁布拉姆·福斯（THT3-BRAM，原创有限G3相当非凡者）在净空原院THT3-COURT的4米外持自己的唯一原棍THT3-BRAM-ROD提出争议，H100/M100/S120。普通出口4米开放，无追逐、无旁人、无友军免疫。双方1–6动作，共同伤势与死亡盘，继承实际黑骑士核心50/20/20/10、旧六槽和实际原伊芮斯/原储备。只有真正取得并在开战前外放到原院的两位已故半神原灵可各协作一次/轮；赫莲娜已选防护减敌势18，罗兰已选稳持自身优势16，各付3自己的S＋1本人S，原灵不会刷新。布拉姆弧光5S/70、屏护4S/30、光束6S只驱回一个实际外放原灵并减完整度20；先手光束可中断未执行协作，后手不抹除已发生效果，无原灵则0S观察。活着终结须沿原路收回并普通走4米离开；本人死亡时仍外放原灵永久释放，不复活。原加里克仍投降，原塞德里克仍永久释放，旧隔离影体不变成宠物。所有新人物、场地、定量与法术均G。';
export function createThreeHeadedTemplarEncounterState(): ThreeHeadedTemplarEncounterState {
  return { status: 'AVAILABLE', targetId: THREE_HEADED_TEMPLAR_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'THT3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 4, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, LIGHT_BREAK: 0 }, shadowReady: false, terminal: null };
}
export const createThreeHeadedTemplarEncounter = createThreeHeadedTemplarEncounterState;
const stage = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 3;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateThreeHeadedTemplarEncounterCommand(v: unknown): v is ThreeHeadedTemplarEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isThreeHeadedTemplarEncounterCommand = validateThreeHeadedTemplarEncounterCommand;
export const hasThreeHeadedTemplarEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.threeHeadedTemplar.encounter.status);
export const isInsideThreeHeadedTemplarEncounter = hasThreeHeadedTemplarEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasThreeHeadedTemplarRitualLock(s) || s.threeHeadedTemplar.life.activeCase !== null || Object.values(s.threeHeadedTemplar.life.cases).some(c => c.status === 'PREPARED') || hasThreeHeadedTemplarOldPractice(s);
}
function localOriginals(s: SliceState, courtAllowed: boolean): boolean {
  return validateThreeHeadedTemplarSpiritSources(s.threeHeadedTemplar.life.spirits, s.week) && Object.values(s.threeHeadedTemplar.life.spirits).every(spirit =>
    !['START', 'A', 'B', 'COURT'].includes(spirit.location) || courtAllowed && spirit.status === 'GRAZED' && spirit.location === 'COURT');
}
const noEffects = (e: ThreeHeadedTemplarEncounterState) => e.shadowReady === false;
function actualCourt(e: ThreeHeadedTemplarEncounterState, confirmed = true): boolean { return validThreeHeadedTemplarCombatScene(e.scene) && (!confirmed || e.scene.clearanceConfirmed); }
export function blockThreeHeadedTemplarEncounter(s: SliceState, c: ThreeHeadedTemplarEncounterCommand): string | null {
  if (!validateThreeHeadedTemplarEncounterCommand(c)) return '三首圣堂遭遇命令无效。';
  const e = s.threeHeadedTemplar.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(h => h.threeHeadedTemplarOutcome)) return '原布拉姆已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !stage(s) || !Number.isFinite(s.health) || s.health <= 0) return '须本人仍活着并已成为三首圣堂·倒吊人序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.threeHeadedTemplar.guidanceKnown || s.threeHeadedTemplar.promotionWeek === null) return '须保有玛拉的实际指导并完成三首圣堂晋升。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空院落。';
  if (!localOriginals(s, e.status === 'READY')) return '先实际沿原路收回别处原灵；只能使用在当前原院实际外放的同一原灵。';
  if (otherSceneOpen(s) || !noEffects(e)) return '先真实收束当前实践、准备、有限效果和原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿普通出口和平离开。' : !actualCourt(e) ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY') || e.targetId !== THREE_HEADED_TEMPLAR_TARGET_ID || e.weaponLocation !== 'HAND') return '须同一原布拉姆、原棍、净空院和普通出口实际存在。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原布拉姆已有进展或结局，不重新生成或补充资源。' : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原布拉姆、原棍和普通出口。';
}
export const threeHeadedTemplarEncounterReason = blockThreeHeadedTemplarEncounter;
export function applyThreeHeadedTemplarEncounterCommand(s: SliceState, c: ThreeHeadedTemplarEncounterCommand, ctx: SeerContext): void {
  const reason = blockThreeHeadedTemplarEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.threeHeadedTemplar.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    for (const spirit of Object.values(s.threeHeadedTemplar.life.spirits)) if (spirit.location === 'COURT') applyThreeHeadedTemplarActivity(s, { type: 'RECALL_SPIRIT', spiritId: spirit.id }, ctx, () => {});
    e.status = 'RESOLVED'; e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; advanceThreeHeadedTemplarLifeClock(s, 4);
    ctx.note('沿原普通出口和平离开', '本人实际普通走4米、耗4秒离开，无追逐、瞬移或奖励；原布拉姆H100/M100/S120与自己的原棍留原场，旧加里克、已释放塞德里克和隔离影体不改。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原布拉姆实际交谈', THREE_HEADED_TEMPLAR_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'THREE_HEADED_TEMPLAR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原院落的真实冲突', '双方使用同一原身体、独立原武器和实际灵性；外放原灵协作实付自己的资源，光束按实际先后手中断，共同伤势、死亡与普通撤退无豁免。');
}
export const applyThreeHeadedTemplarEncounter = applyThreeHeadedTemplarEncounterCommand;
export function startThreeHeadedTemplarEncounter(s: SliceState, ctx: SeerContext): void { applyThreeHeadedTemplarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasThreeHeadedTemplarDisputeOpponent(s: SliceState): boolean {
  const e = s.threeHeadedTemplar?.encounter, c = s.combat;
  return !!e && s.threeHeadedTemplar.guidanceKnown && s.threeHeadedTemplar.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent &&
    s.world.city === 'BACKLUND' && localOriginals(s, true) && !otherSceneOpen(s) && e.status === 'FIGHTING' && e.targetId === THREE_HEADED_TEMPLAR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'THREE_HEADED_TEMPLAR_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(s.threeHeadedTemplar.life.clockSeconds) && integer(e.enemySpirituality, 0, 120) && THREE_HEADED_TEMPLAR_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - THREE_HEADED_TEMPLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) && typeof e.shadowReady === 'boolean' && integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleThreeHeadedTemplarEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.threeHeadedTemplar.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'THREE_HEADED_TEMPLAR_DISPUTE') throw new Error('没有同一原布拉姆的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原院落战斗结果。');
  const last = c.lastRound, o = last?.threeHeadedTemplarOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateThreeHeadedTemplarRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
    s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || !same(o.reserveAfter, s.roseBishop.reserve) || !same(o.spiritsAfter, s.threeHeadedTemplar.life.spirits) || !noEffects(e) ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.threeHeadedTemplar.life.clockSeconds ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE'))) throw new Error('同一原身体、实际原灵与有限资源不符已保存回合。');
  e.terminal = { outcome: outcome as ThreeHeadedTemplarEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原院落冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡并留在原院，不复活或自动返回。' : '仍活着的本人普通走4米沿开放原出口离开，无追逐、瞬移或夺棍。'}布拉姆原健康${e.enemyHealth}、灵性${e.enemySpirituality}和原伤势保留；原影限制结束；活着时实际外放原灵沿原路收回，玩家死亡则永久释放仍外放原灵，不补血或资源。原加里克投降和已释放塞德里克不改。`);
}
export function threeHeadedTemplarEncounterActions(s: SliceState): ThreeHeadedTemplarEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与布拉姆交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原布拉姆真实冲突', '1行动 · 真实受伤或死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 各原灵先4秒收回，再本人走4米/4秒']] as const).map(([type, label, cost]) => {
    const command: ThreeHeadedTemplarEncounterCommand = { type }, reason = blockThreeHeadedTemplarEncounter(s, command);
    return { id: `threeHeadedTemplar-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectThreeHeadedTemplarEncounter(s: SliceState): ThreeHeadedTemplarEncounterProjection {
  const e = s.threeHeadedTemplar.encounter;
  if (!stage(s)) return { title: '尚未开放的三首圣堂遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原净空院与独立的布拉姆·福斯', story: THREE_HEADED_TEMPLAR_ENCOUNTER_STORY, status: e.status, inside: hasThreeHeadedTemplarEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: THREE_HEADED_TEMPLAR_TARGET_ID, name: '布拉姆·福斯', age: 49, source: 'ORIGINAL_LIMITED_G', sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'THT3-BRAM-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: threeHeadedTemplarEncounterActions(s),
    facts: ['新两灵仅实际外放协作，本人仍只借当前唯一旧原伊芮斯；不存在免费灵库或旧灵升格',
      '原人相距4米，净空无旁人；4米普通出口开放，无追逐或任意传送',
      '赫莲娜已选BRIEF_WARD减势18；罗兰已选STEADY_HOLD自身优势16；各3原灵S＋1本人S，一轮各一次G',
      `布拉姆实用弧光${e.powerUses.ARC_BOLT}次、屏护${e.powerUses.WARD}次、实际驱回光束${e.powerUses.LIGHT_BREAK}次；剩余S${e.enemySpirituality}/120`,
      '先手光束能先驱回一原灵；已付且已发生协作不追溯撤销。没有外放原灵时光束槽0S普通观察',
      `原布拉姆保留${e.enemyInjuries.length}处伤势；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '普通和平离开' : '尚未终结')}，原棍${e.weaponLocation === 'HAND' ? '本人持有' : '留原院'}`,
      `本人累计普通离场${e.scene.ordinaryWalkedMetres}米；每轮60秒，原灵实际回收每位另4秒，不补满或重生`] };

}
/** Replays ordered costs, original inventory and shared alternating-action evidence across rounds. */
export function validateThreeHeadedTemplarEncounter(s: SliceState): boolean {
  try {
    const e = s.threeHeadedTemplar?.encounter, initial = createThreeHeadedTemplarEncounterState();
    if (!e || !validateThreeHeadedTemplarSpiritSources(s.threeHeadedTemplar.life.spirits, s.week) || (['READY', 'FIGHTING'].includes(e.status) ? !localOriginals(s, true) : Object.values(s.threeHeadedTemplar.life.spirits).some(spirit => spirit.location === 'COURT')) || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== THREE_HEADED_TEMPLAR_TARGET_ID ||
      !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !noEffects(e) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
      e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
      !e.powerUses || !same(Object.keys(e.powerUses).sort(), [...THREE_HEADED_TEMPLAR_POWER_IDS].sort()) || !THREE_HEADED_TEMPLAR_POWER_IDS.every(id => integer(e.powerUses[id])) ||
      e.enemySpirituality !== 120 - THREE_HEADED_TEMPLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.startHistoryIndex === null && s.combatHistory.some(h => h.threeHeadedTemplarOutcome)) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'THREE_HEADED_TEMPLAR_DISPUTE';
    if (!stage(s) || !s.threeHeadedTemplar.guidanceKnown || s.threeHeadedTemplar.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.threeHeadedTemplar.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      (e.status === 'READY' ? e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 : e.scene.playerPosition === 'EXIT' && e.scene.ordinaryWalkedMetres === 4) &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false, playerPosition: 'COURT', ordinaryWalkedMetres: 0 } }, initial) && s.combat?.encounterId !== 'THREE_HEADED_TEMPLAR_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    if (s.combatHistory.some((h, i) => h.threeHeadedTemplarOutcome && (i < e.startHistoryIndex! || i >= end))) return false;
    for (const [i, round] of rounds.entries()) {
      const o = round.threeHeadedTemplarOutcome, previous = rounds[i - 1]?.threeHeadedTemplarOutcome;
      if (!validateThreeHeadedTemplarRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
        o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek || o.source.revision > s.revision ||
        (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) ||
        !same(o.source.scene, previous.sceneAfter) || !same(o.source.reserve, previous.reserveAfter) || !same(o.source.spirits, previous.spiritsAfter) || !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
        o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || ['knowledge', 'mastery', 'clubHeld', 'grazing', 'shepherdPromotionWeek'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0 ||
          !same(o.source.scene, { ...initial.scene, clearanceConfirmed: true })) return false;
      // Immutable original source identities and irreversible release histories remain a prefix after later care or life use.
      for (const id of ['THT3-HELENA', 'THT3-ROLAND'] as const) {
        const recorded = o.spiritsAfter[id], actual = s.threeHeadedTemplar.life.spirits[id];
        if (!actual || !same(recorded.history, actual.history.slice(0, recorded.history.length)) || recorded.casketId !== actual.casketId || recorded.deathRecordId !== actual.deathRecordId ||
          ['RELEASED', 'DISSIPATED'].includes(recorded.status) && !same(recorded, actual)) return false;
      }
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first || round.playerCount !== threeHeadedTemplarActionCount(round.playerCountRoll) ||
        round.enemyCount !== threeHeadedTemplarEnemyActionCount(round.enemyCountRoll) || !same(moves, round.moves)) return false;
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
    const last = rounds.at(-1), o = last?.threeHeadedTemplarOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk || !same(o.sceneAfter, e.scene))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasThreeHeadedTemplarDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
        s.threeHeadedTemplar.life.clockSeconds === o.lifeClockSecondsAfter && same(s.roseBishop.reserve, o.reserveAfter) && same(s.threeHeadedTemplar.life.spirits, o.spiritsAfter)
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && same(e.scene, { ...initial.scene, clearanceConfirmed: true }));
    const t = e.terminal;
    if (s.combat?.encounterId === 'THREE_HEADED_TEMPLAR_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0 && e.scene.playerPosition === 'EXIT';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && e.scene.playerPosition === 'COURT';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && e.scene.playerPosition === 'EXIT' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
