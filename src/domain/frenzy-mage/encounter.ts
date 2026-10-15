import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { baseAdvantage, consequenceWeights } from '../slice/combat.js';
import { hasFrenzyMageOldPractice, hasFrenzyMageRitualLock } from './index.js';
import { advanceFrenzyMageLifeClock, hasFrenzyMageLifeLock } from './life.js';
import { frenzyMageActionCount, frenzyMageEnemyActionCount, validateFrenzyMageRoundOutcome, validFrenzyMageCombatScene, type FrenzyMageRoundOutcome } from './combat.js';

export const FRENZY_MAGE_TARGET_ID = 'FM3-ALDEN' as const;
export const FRENZY_MAGE_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type FrenzyMagePowerId = typeof FRENZY_MAGE_POWER_IDS[number];
export type FrenzyMageEnemyIntent = FrenzyMagePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export type FrenzyMagePendingKind = 'ORDERED_DEVIATION';
export const FRENZY_MAGE_POWERS: readonly { id: FrenzyMagePowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原有限屏护（G）', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'COMPOSE', label: '仅本轮凝神抵抗（G）', cost: 4, selfGain: 8, enemyReduction: 0 },
];
export interface FrenzyMageEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface FrenzyMageEncounterScene {
  courtId: 'FM3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 2; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface FrenzyMageEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof FRENZY_MAGE_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: FrenzyMageEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; powerUses: Record<FrenzyMagePowerId, number>;
  pendingKind: FrenzyMagePendingKind | null; composureReady: boolean; deviationAttempts: number; magnifyUses: number; exploitUses: number;
  exitTravelMetres: 0 | 4; exitSeconds: 0 | 4; terminal: FrenzyMageEncounterTerminal | null;
}
export type FrenzyMageEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface FrenzyMageEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FrenzyMageEncounterCommand }
export interface FrenzyMageEncounterProjection {
  title: string; story: string; status: FrenzyMageEncounterState['status']; inside: boolean; scene: FrenzyMageEncounterScene | null;
  enemy: null | { id: typeof FRENZY_MAGE_TARGET_ID; name: '阿尔登·鲁克'; age: 45; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: FrenzyMageEncounterState['enemyStatus'];
    weaponId: 'FM3-ALDEN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<FrenzyMagePowerId, number> };
  pendingKind: FrenzyMagePendingKind | null; composureReady: boolean; gifts: { held: number; given: number; battleGround: number; summary: string };
  actions: FrenzyMageEncounterAction[]; facts: string[];
}
export const FRENZY_MAGE_ENCOUNTER_STORY = '原创成年序列4阿尔登·鲁克（45岁，FM3-ALDEN，G）在独立净空原院FM3-COURT的2米外持自己的唯一原棍FM3-ALDEN-ROD提出争议。原身体H100/M100/S120、体格22，双方1–6动作、1250战势基准/120灵性上限/125底线，继承BLACK_EMPEROR核心35/15/20/30和共同65/30/5伤势与累积风险。4米普通出口开放、无旁人或追逐，可交谈后和平离开。弧光5S贡献70、屏护4S减30、凝神4S贡献8共用真实120S；耗尽回退20×身体原棍打击，不补资源。H继承4S本人当次放大、J继承身体侧击；B只实给当前PLAYER的一件旧原礼物并付3S，R另付3S仅延当前同一原礼物窗口一次至最多两次。K新有限既有动作偏转5S、知识20四档，成功只设一个待用状态，减半下一次实际正BODY/ARC贡献或WARD护势，敌先付全费；凝神只清未用K并抵抗本轮新K。旧礼物不影响SELF凝神/屏护，两短效相互独立、到轮末过期。每轮真实60秒，活着结局普通走4米4秒离场，死者留院；原敌死后原棍留院，其他结局仍在其手。3名称编号有原核，新增机制、人物及定量均为G，完整3配方与仪式未知，不推断2熵之公爵能力；没有幸运池、重抽、复活或必胜，旧马洛永久死亡、旧原物和已赠去向不变。';
export function createFrenzyMageEncounterState(): FrenzyMageEncounterState {
  return { status: 'AVAILABLE', targetId: FRENZY_MAGE_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'FM3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, pendingKind: null, composureReady: false,
    deviationAttempts: 0, magnifyUses: 0, exploitUses: 0, exitTravelMetres: 0, exitSeconds: 0, terminal: null };
}
export const createFrenzyMageEncounter = createFrenzyMageEncounterState;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 3;
const reported = (s: SliceState) => Object.values(s.frenzyMage.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (e: FrenzyMageEncounterState) => e.pendingKind === null && e.composureReady === false;
function practiceClosed(s: SliceState): boolean {
  return !hasFrenzyMageRitualLock(s) && !hasFrenzyMageOldPractice(s) && !hasFrenzyMageLifeLock(s) && !Object.values(s.frenzyMage.life.cases).some(c => c.status === 'PREPARED');
}
export const hasFrenzyMageEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.frenzyMage.encounter.status) || !noEffects(s.frenzyMage.encounter);
export const isInsideFrenzyMageEncounter = hasFrenzyMageEncounterLock;
export function validateFrenzyMageEncounterCommand(v: unknown): v is FrenzyMageEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isFrenzyMageEncounterCommand = validateFrenzyMageEncounterCommand;
export function frenzyMageEncounterReason(s: SliceState, c: FrenzyMageEncounterCommand): string | null {
  if (!validateFrenzyMageEncounterCommand(c)) return '狂乱法师遭遇命令无效。';
  const e = s.frenzyMage.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(r => r.frenzyMageOutcome)) return '同一原阿尔登已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !promoted(s)) return '需要本人仍活着并已成为狂乱法师序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.frenzyMage.guidanceKnown || s.frenzyMage.promotionWeek === null) return '需要实际指导与已经完成的狂乱法师晋升。';
  if (s.world.city !== 'BACKLUND') return '需要实际在贝克兰德原独立净空院。';
  if (!practiceClosed(s) || !noEffects(e)) return '先关闭全部新旧实践、接触与准备，真实归还原物并停止未用影响。';
  if (!validFrenzyMageCombatScene(e.scene) || e.scene.playerPosition !== 'COURT' || e.exitTravelMetres !== 0 || e.exitSeconds !== 0) return '需要原净空院及真实4米普通出口，已经离场不能重开。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先到原院实际交谈，才能和平离开。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神；已经到场仍可普通离开。';
  if (e.targetId !== FRENZY_MAGE_TARGET_ID || e.weaponLocation !== 'HAND' || !['AVAILABLE', 'READY'].includes(e.status)) return '原阿尔登已有结局，不能再生、重开或补原资源。';
  if (!reported(s)) return '先完成至少一份真实关闭后的狂乱法师报告。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '已经交谈，不重新生成原人。' : s.actionsRemaining < 2 ? '交谈1行动，另留开战1行动；仍可和平离开。' : null;
  return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先实际交谈，确认同一原阿尔登、唯一原棍及开放出口。';
}
export const blockFrenzyMageEncounter = frenzyMageEncounterReason;
export function applyFrenzyMageEncounterCommand(s: SliceState, c: FrenzyMageEncounterCommand, ctx: SeerContext): void {
  const reason = frenzyMageEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.frenzyMage.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4; e.exitTravelMetres = 4; e.exitSeconds = 4; advanceFrenzyMageLifeClock(s, 4);
    ctx.note('沿4米原普通出口和平离开', '本人实际走4米、4秒、0行动；原阿尔登H100/M100/S120及自己的原棍留原院，旧原礼物不变，无奖励或追逐。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原阿尔登实际交谈', FRENZY_MAGE_ENCOUNTER_STORY); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FRENZY_MAGE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原阿尔登的有限真实冲突', '实付1行动。K偏转实付5灵性且可以失败；B仅实给当前持有的一件旧原礼物并付3灵性。共同伤势、真实死亡与实际普通出口均保留。');
}
export const applyFrenzyMageEncounter = applyFrenzyMageEncounterCommand;
export function startFrenzyMageEncounter(s: SliceState, ctx: SeerContext): void { applyFrenzyMageEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasFrenzyMageDisputeOpponent(s: SliceState): boolean {
  const e = s.frenzyMage.encounter, c = s.combat;
  return promoted(s) && s.frenzyMage.guidanceKnown && s.frenzyMage.promotionWeek !== null && s.status === 'ACTIVE' && integer(s.health, 1, 100) && integer(s.mind, 1, 100) && !s.activeEvent &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'FRENZY_MAGE_DISPUTE' && c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && integer(c.round, 1) &&
    e.status === 'FIGHTING' && e.targetId === FRENZY_MAGE_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    validFrenzyMageCombatScene(e.scene) && e.scene.clearanceConfirmed && e.scene.playerPosition === 'COURT' && e.exitTravelMetres === 0 && e.exitSeconds === 0 && e.approachWeek !== null && e.attemptWeek === s.week && e.weaponLocation === 'HAND' &&
    [null, 'ORDERED_DEVIATION'].includes(e.pendingKind) && typeof e.composureReady === 'boolean' && !(e.pendingKind && e.composureReady) &&
    integer(e.deviationAttempts) && integer(e.magnifyUses) && integer(e.exploitUses) && (!e.pendingKind || e.deviationAttempts > 0) && (!e.composureReady || e.powerUses.COMPOSE > 0) &&
    integer(e.enemySpirituality, 0, 120) && FRENZY_MAGE_POWER_IDS.every(id => integer(e.powerUses[id], 0, 30)) && e.enemySpirituality === 120 - FRENZY_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex, 0, s.combatHistory.length) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleFrenzyMageEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.frenzyMage.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FRENZY_MAGE_DISPUTE') throw new Error('没有同一原阿尔登的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知狂乱法师冲突结果。');
  const last = c.lastRound, o = last?.frenzyMageOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateFrenzyMageRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !noEffects(e) || !practiceClosed(s) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.weaponLocation !== e.weaponLocation ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.frenzyMage.life.clockSeconds ||
    !same(o.giftsAfter, s.briber.gifts) || !same(o.playerInjuriesAfter, s.injuries) || o.playerRiskAfter !== s.injuryRisk ||
    (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与原回合、同一身体、唯一原武器及实付资源不一致。');
  e.terminal = { outcome: outcome as FrenzyMageEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原阿尔登的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡留在原院，不复活或移动尸体。' : '本人沿原4米普通出口实际离开，实过4秒，无追逐或瞬移。'}每轮真实60秒，未用效果与凝神到期；全部实付灵性不退、原已赠物不回，原敌健康精神灵性与伤势保留，原棍${e.weaponLocation === 'HAND' ? '仍在原主人手中' : '因原主人死亡留在原院且不归玩家'}；旧马洛与旧历史不变。`);
}
export function frenzyMageEncounterActions(s: SliceState): FrenzyMageEncounterAction[] {
  if (!promoted(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原院与阿尔登交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原阿尔登真实冲突', '1行动 · 真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 实际4秒4米']] as const).map(([type, label, cost]) => {
    const command: FrenzyMageEncounterCommand = { type }, reason = frenzyMageEncounterReason(s, command);
    return { id: `frenzyMage-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFrenzyMageEncounter(s: SliceState): FrenzyMageEncounterProjection {
  const e = s.frenzyMage.encounter, gifts = s.briber.gifts, publicState = { status: e.status, pendingKind: e.pendingKind, composureReady: e.composureReady,
    gifts: { held: gifts.filter(g => g.location === 'PLAYER').length, given: gifts.filter(g => g.location === 'GIVEN').length,
      battleGround: gifts.filter(g => g.destination === 'BATTLE:FRENZY_MAGE_DISPUTE:GROUND').length, summary: '同一旧原礼物阵列；只实给当前持有原物，旧已赠去向不改，不复制、不回收或新建库存。' } };
  if (!promoted(s)) return { ...publicState, title: '尚未开放的狂乱法师遭遇', story: '', inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { ...publicState, title: '原净空院与阿尔登·鲁克', story: FRENZY_MAGE_ENCOUNTER_STORY, inside: hasFrenzyMageEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: FRENZY_MAGE_TARGET_ID, name: '阿尔登·鲁克', age: 45, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus,
      weaponId: 'FM3-ALDEN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: frenzyMageEncounterActions(s),
    facts: ['3狂乱法师名称编号有原核；新增有限既有动作偏转、人物和数值全部G；完整配方与晋升仪式未知',
      `原敌H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，原棍在${e.weaponLocation}；弧光${e.powerUses.ARC_BOLT}、屏护${e.powerUses.WARD}、凝神${e.powerUses.COMPOSE}次`,
      `旧原礼物当前持有${publicState.gifts.held}件；本场实际给出${publicState.gifts.battleGround}件，已赠原物及原givenWeek永久保留`,
      'H旧放大仅本人当次实际击打；B/R沿真实原礼物窗口；K5S知识20四档仅一次后来实际正BODY/ARC或WARD贡献减半',
      `待用偏转${e.pendingKind ?? '无'}、凝神${e.composureReady ? '仅本轮有效' : '无'}；敌先付全费，不改既发事实、无幸运池或强迫投降`,
      `普通离场${e.exitTravelMetres}米/${e.exitSeconds}秒；结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '和平离开' : '尚未结束')}；旧原马洛永久死亡、六阶历史与全部旧物保留`] };
}
export function validateFrenzyMageEncounter(s: SliceState): boolean {
  try {
    const e = s.frenzyMage?.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createFrenzyMageEncounterState()).sort()) || e.targetId !== FRENZY_MAGE_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !validFrenzyMageCombatScene(e.scene) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || FRENZY_MAGE_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 30)) || e.enemySpirituality !== 120 - FRENZY_MAGE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      !noEffects(e) || e.weaponLocation !== (e.enemyStatus === 'DEAD' ? 'COURT' : 'HAND') || !integer(e.deviationAttempts) || !integer(e.magnifyUses) || !integer(e.exploitUses) || e.exitTravelMetres !== e.scene.ordinaryWalkedMetres || e.exitSeconds !== e.exitTravelMetres ||
      (e.approachWeek !== null && !integer(e.approachWeek, s.frenzyMage.promotionWeek ?? 1, s.week)) || (e.attemptWeek !== null && !integer(e.attemptWeek, e.approachWeek ?? 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
    if (s.frenzyMage.promotionWeek === null) return same(e, createFrenzyMageEncounterState()) && s.combat?.encounterId !== 'FRENZY_MAGE_DISPUTE' && !s.combatHistory.some(r => r.frenzyMageOutcome);
    if (e.startHistoryIndex === null) {
      if (s.combatHistory.some(r => r.frenzyMageOutcome) || s.combat?.encounterId === 'FRENZY_MAGE_DISPUTE' || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null) return false;
      const expected = createFrenzyMageEncounterState(); expected.status = e.status;
      if (e.status !== 'AVAILABLE') { if (e.approachWeek === null || !reported(s)) return false; expected.approachWeek = e.approachWeek; expected.scene.clearanceConfirmed = true; }
      if (e.status === 'RESOLVED') { expected.scene.playerPosition = 'EXIT'; expected.scene.ordinaryWalkedMetres = 4; expected.exitTravelMetres = 4; expected.exitSeconds = 4; }
      return same(e, expected);
    }
    if (!reported(s) || e.attemptWeek === null || e.approachWeek === null || !e.scene.clearanceConfirmed) return false;
    const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
    if (s.combatHistory.filter(r => r.frenzyMageOutcome).length !== own.length) return false;
    let previous: FrenzyMageRoundOutcome | undefined, enemyHealth = 100, enemyRisk = 0;
    const enemyInjuries: SliceInjury[] = [];
    for (const [i, r] of own.entries()) {
      const o = r.frenzyMageOutcome;
      if (!validateFrenzyMageRoundOutcome(o) || r.round !== i + 1 || r.winner === null || o.round !== r.round || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || o.enemyStatus !== 'RESISTING' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        o.source.enemyHealth !== enemyHealth || o.source.enemyMind !== 100 || r.passiveLuck !== undefined ||
        !integer(r.playerCountRoll, 1, 100) || !integer(r.enemyCountRoll, 1, 100) || r.playerCount !== frenzyMageActionCount(r.playerCountRoll) || r.enemyCount !== frenzyMageEnemyActionCount(r.enemyCountRoll)) return false;
      if (previous) {
        if (o.source.revision <= previous.source.revision || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
          o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || !same(o.source.scene, previous.sceneAfter) ||
          !same(o.source.gifts, previous.giftsAfter) || !same(o.source.playerInjuries, previous.playerInjuriesAfter) || o.source.playerRisk !== previous.playerRiskAfter ||
          !same(o.source.coreStats, previous.source.coreStats) || o.source.clubLocation !== previous.source.clubLocation ||
          o.source.bodyMastery !== previous.source.bodyMastery || o.source.weakPointMastery !== previous.source.weakPointMastery || o.source.briberyMastery !== previous.source.briberyMastery || o.source.magnifyMastery !== previous.source.magnifyMastery ||
          o.source.deviationAttempts !== previous.deviationAttempts || o.source.magnifyUses !== previous.magnifyUses || o.source.exploitUses !== previous.exploitUses || !same(o.source.powerUses, previous.powerUses)) return false;
      } else if (o.enemySpiritualityBefore !== 120 || o.source.deviationAttempts !== 0 || o.source.magnifyUses !== 0 || o.source.exploitUses !== 0) return false;
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
      const stats = o.source.coreStats, core = stats.physique * .35 + stats.perception * .15 + stats.will * .2 + stats.knowledge * .3;
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
    const o = last?.frenzyMageOutcome;
    if (!same(enemyInjuries, e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || o.weaponLocation !== e.weaponLocation || !same(o.sceneAfter, e.scene) ||
      !same(o.powerUses, e.powerUses) || o.deviationAttempts !== e.deviationAttempts || o.magnifyUses !== e.magnifyUses || o.exploitUses !== e.exploitUses)) return false;
    if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.frenzyMage.life.clockSeconds === o.lifeClockSecondsAfter &&
      same(s.briber.gifts, o.giftsAfter) && same(s.injuries, o.playerInjuriesAfter) && s.injuryRisk === o.playerRiskAfter)) &&
      t === null && hasFrenzyMageDisputeOpponent(s) && (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.deviationAttempts === 0 && e.magnifyUses === 0 && e.exploitUses === 0) &&
      (last ? same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    if (s.combat?.encounterId === 'FRENZY_MAGE_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (o.giftsAfter.some(g => g.location === 'GIVEN' && !same(s.briber.gifts.find(x => x.id === g.id), g))) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
    return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
  } catch { return false; }
}
