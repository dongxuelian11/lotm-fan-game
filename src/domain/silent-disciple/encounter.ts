import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasAncientEvilContinuation, hasSilentDiscipleHistory, hasSilentDiscipleOldPractice, hasSilentDiscipleRitualLock } from './index.js';
import { advanceSilentDiscipleLifeClock, hasSilentDiscipleLifeLock } from './life.js';
import { silentDiscipleActionCount, silentDiscipleEnemyActionCount, validateSilentDiscipleBlocks, validateSilentDiscipleRoundOutcome, validSilentDiscipleCombatScene, type SilentDiscipleRoundOutcome } from './combat.js';

export const SILENT_DISCIPLE_TARGET_ID = 'SD3-CALDER' as const;
export const SILENT_DISCIPLE_BLOCK_IDS = ['SD3-BLOCK-1', 'SD3-BLOCK-2', 'SD3-BLOCK-3'] as const;
export const SILENT_DISCIPLE_POWER_IDS = ['ARC_BOLT', 'WARD', 'BREAK_CURSE'] as const;
export type SilentDisciplePowerId = typeof SILENT_DISCIPLE_POWER_IDS[number];
export type SilentDiscipleEnemyIntent = SilentDisciplePowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const SILENT_DISCIPLE_POWERS = [
  { id: 'ARC_BOLT', label: '原有限弧光', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'WARD', label: '原有限屏护', cost: 4, selfGain: 0, enemyReduction: 30 },
  { id: 'BREAK_CURSE', label: '精神挣断当前诅咒', cost: 4, selfGain: 8, enemyReduction: 0 },
] as const;
export interface SilentDiscipleBlock {
  id: typeof SILENT_DISCIPLE_BLOCK_IDS[number]; owner: 'PLAYER'; status: 'READY' | 'SPENT'; location: 'SOURCE' | 'TARGET_GROUND'; usedRound: number | null;
}
export interface SilentDiscipleReflection {
  round: number; severity: 'LIGHT' | 'HEAVY'; playerDamage: 10 | 30; enemyDamage: 5 | 15; playerInjuryId: string; enemyInjuryId: string;
}
export interface SilentDiscipleEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface SilentDiscipleEncounterScene {
  courtId: 'SD3-COURT'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
  playerPosition: 'COURT' | 'EXIT'; distanceMetres: 2; exitMetres: 4; ordinaryWalkedMetres: number;
}
export interface SilentDiscipleEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof SILENT_DISCIPLE_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: SilentDiscipleEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weaponLocation: 'HAND' | 'COURT'; enemyForm: 'HUMAN' | 'RABBIT'; enemyFormUntilSeconds: number | null;
  powerUses: Record<SilentDisciplePowerId, number>; blocksPurchased: boolean; blocks: SilentDiscipleBlock[];
  form: 'HUMAN' | 'WOOD'; link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null;
  contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number;
  transfigurationAttempts: number; transfigurationSuccesses: number; pickUpUses: number;
  reflectionHistory: SilentDiscipleReflection[]; terminal: SilentDiscipleEncounterTerminal | null;
}
export type SilentDiscipleEncounterCommand = { type: 'BUY_BLOCKS' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface SilentDiscipleEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilentDiscipleEncounterCommand }
export interface SilentDiscipleEncounterProjection {
  title: string; story: string; status: SilentDiscipleEncounterState['status']; inside: boolean; scene: SilentDiscipleEncounterScene | null;
  enemy: null | { id: typeof SILENT_DISCIPLE_TARGET_ID; name: '卡尔德·里德'; age: 47; source: 'ORIGINAL_LIMITED_G'; sequence: 4;
    health: number; mind: number; spirituality: number; status: SilentDiscipleEncounterState['enemyStatus']; form: 'HUMAN' | 'RABBIT';
    weaponId: 'SD3-CALDER-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<SilentDisciplePowerId, number> };
  blocksPurchased: boolean; blocks: SilentDiscipleBlock[]; form: 'HUMAN' | 'WOOD'; link: 'NONE' | 'LINKED'; linkRound: number | null; enemyFormUntilSeconds: number | null;
  actions: SilentDiscipleEncounterAction[]; facts: string[];
}
export const SILENT_DISCIPLE_ENCOUNTER_STORY = '原创成年序列4卡尔德·里德（47岁，SD3-CALDER，G）在独立净空原院SD3-COURT的2米外持自己的唯一原棍SD3-CALDER-ROD提出争议。原身体H100/M100/S120、体格22，双方1–6动作，继承CHAINED核心50/20/15/15及共同伤势65/30/5与累积风险；普通出口4米开放、无旁人或追逐，可交谈后和平离开。事前80便士只能购入唯一组三块本人新原木块，不复原旧PU4原块。默认K先实际接触4S1M/知识18，再5S2M/知识20有限短变形；成功同一原卡尔德暂为兔形，健康、精神、灵性和原伤不变，原棍实际掉落仍归他。兔形不能手势弧光或屏护，回退普通无武器10×身体；实际精神挣断4S可破除当前变形和联系。真实60秒回合末恢复同一人形，原棍不瞬移，下一人形动作拾棍占一整槽。主动旧本人诅咒源另付4S/知识18，只有本人实受轻重伤10/30才映射5/15，自己承担全部伤势与死亡，默认关闭。所有新人物、场地、兔形、规则、持续与定量均有限G，不是完整原著公式、零自伤免死或永久强控。';
export function createSilentDiscipleEncounterState(): SilentDiscipleEncounterState {
  return { status: 'AVAILABLE', targetId: SILENT_DISCIPLE_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    scene: { courtId: 'SD3-COURT', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'COURT', distanceMetres: 2, exitMetres: 4, ordinaryWalkedMetres: 0 },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weaponLocation: 'HAND', enemyForm: 'HUMAN', enemyFormUntilSeconds: null, powerUses: { ARC_BOLT: 0, WARD: 0, BREAK_CURSE: 0 }, blocksPurchased: false, blocks: [],
    form: 'HUMAN', link: 'NONE', linkRound: null, lastFormRound: null, contactAttempts: 0, formAttempts: 0, breakLinkUses: 0, contactDistanceMetres: 0,
    transfigurationAttempts: 0, transfigurationSuccesses: 0, pickUpUses: 0, reflectionHistory: [], terminal: null };
}
export const createSilentDiscipleEncounter = createSilentDiscipleEncounterState;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 3;
const reported = (s: SliceState) => Object.values(s.silentDisciple.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (e: SilentDiscipleEncounterState) => e.form === 'HUMAN' && e.enemyForm === 'HUMAN' && e.enemyFormUntilSeconds === null && e.link === 'NONE';
function practiceClosed(s: SliceState): boolean {
  return !hasSilentDiscipleRitualLock(s) && !hasSilentDiscipleOldPractice(s) && !hasSilentDiscipleLifeLock(s) && !Object.values(s.silentDisciple.life.cases).some(c => c.status === 'PREPARED');
}
export const hasSilentDiscipleEncounterLock = (s: SliceState): boolean => !hasAncientEvilContinuation(s) && (['READY', 'FIGHTING'].includes(s.silentDisciple.encounter.status) || !noEffects(s.silentDisciple.encounter));
export const isInsideSilentDiscipleEncounter = hasSilentDiscipleEncounterLock;
export function validateSilentDiscipleEncounterCommand(v: unknown): v is SilentDiscipleEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['BUY_BLOCKS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isSilentDiscipleEncounterCommand = validateSilentDiscipleEncounterCommand;
export function silentDiscipleEncounterReason(s: SliceState, c: SilentDiscipleEncounterCommand): string | null {
  if (!validateSilentDiscipleEncounterCommand(c)) return '沉默门徒遭遇命令无效。';
  const e = s.silentDisciple.encounter;
  if (e.startHistoryIndex === null && s.combatHistory.some(r => r.silentDiscipleOutcome)) return '同一原卡尔德已有真实战斗记录，不重置原人。';
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !promoted(s)) return '需要本人仍活着并已经成为被缚者序列3沉默门徒。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.silentDisciple.guidanceKnown || s.silentDisciple.promotionWeek === null) return '需要已有实际指导并完成沉默门徒晋升。';
  if (s.world.city !== 'BACKLUND') return '需要实际在贝克兰德原独立净空院。';
  if (!practiceClosed(s) || !noEffects(e)) return '先关闭新旧接触、准备与公告月相事件，实际归还原物并恢复同一原形。';
  if (!validSilentDiscipleCombatScene(e.scene) || e.scene.playerPosition !== 'COURT' || e.scene.ordinaryWalkedMetres !== 0) return '需要原净空院及真实4米普通出口。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先到原院实际交谈，才能和平离开。';
  if (!Number.isFinite(s.mind) || s.mind <= 0) return '先恢复精神，已到场仍可普通离开。';
  if (e.targetId !== SILENT_DISCIPLE_TARGET_ID || e.weaponLocation !== 'HAND' || !['AVAILABLE', 'READY'].includes(e.status)) return '原卡尔德已有结局，不能再生、重开或补原资源。';
  if (c.type === 'BUY_BLOCKS') return e.blocksPurchased ? '唯一一组本人新原木块已经购入，不补发或复原旧木块。' : s.cash < 80 ? '三块本人新原木块需要80便士（G）。' : null;
  if (!reported(s)) return '先完成至少一份真实关闭后的沉默门徒报告。';
  if (s.actionsRemaining < 1) return '本次实际选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '已经交谈，不重新生成原人或补资源。' : s.actionsRemaining < 2 ? '交谈1行动，另留开战1行动；仍可和平离开。' : null;
  return e.status === 'READY' && e.scene.clearanceConfirmed ? null : '先实际交谈，确认同一原卡尔德、原棍与开放出口。';
}
export const blockSilentDiscipleEncounter = silentDiscipleEncounterReason;
export function applySilentDiscipleEncounterCommand(s: SliceState, c: SilentDiscipleEncounterCommand, ctx: SeerContext): void {
  const reason = silentDiscipleEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.silentDisciple.encounter;
  if (c.type === 'BUY_BLOCKS') {
    s.cash -= 80; e.blocksPurchased = true; e.blocks = SILENT_DISCIPLE_BLOCK_IDS.map(id => ({ id, owner: 'PLAYER', status: 'READY', location: 'SOURCE', usedRound: null }));
    ctx.note('购入唯一组三块本人新原木块', '实付80便士、0行动（G）；SD3-BLOCK-1/2/3实际在SOURCE且归本人，不复原PU4旧块、不夺原敌棍。'); return;
  }
  if (c.type === 'LEAVE_ENCOUNTER') {
    e.status = 'RESOLVED'; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres += 4; advanceSilentDiscipleLifeClock(s, 4);
    ctx.note('沿原普通出口和平离开', '本人实际普通走4米、4秒、0行动；无奖励或追逐，原卡尔德H100/M100/S120与原棍留原场，旧埃德林不改变。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原卡尔德实际交谈', SILENT_DISCIPLE_ENCOUNTER_STORY); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SILENT_DISCIPLE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('同一原卡尔德的有限真实冲突', '实付1行动。默认有限目标变形，旧本人自伤诅咒源与疯子理智爆发均需明确本轮选择；共同伤势与真实死亡无豁免。');
}
export const applySilentDiscipleEncounter = applySilentDiscipleEncounterCommand;
export function startSilentDiscipleEncounter(s: SliceState, ctx: SeerContext): void { applySilentDiscipleEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasSilentDiscipleDisputeOpponent(s: SliceState): boolean {
  const e = s.silentDisciple.encounter, c = s.combat;
  return promoted(s) && s.silentDisciple.guidanceKnown && s.silentDisciple.promotionWeek !== null && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind >= 0 && !s.activeEvent &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'SILENT_DISCIPLE_DISPUTE' && c.enemyStatus === 'RESISTING' && integer(c.enemyHealth, 1, 100) && integer(c.enemyMind, 1, 100) && integer(c.round, 1) &&
    e.status === 'FIGHTING' && e.targetId === SILENT_DISCIPLE_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === 'RESISTING' && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    validSilentDiscipleCombatScene(e.scene) && e.scene.clearanceConfirmed && e.scene.playerPosition === 'COURT' && e.scene.ordinaryWalkedMetres === 0 && e.approachWeek !== null && e.attemptWeek === s.week &&
    ['HAND', 'COURT'].includes(e.weaponLocation) && ['HUMAN', 'RABBIT'].includes(e.enemyForm) && ['HUMAN', 'WOOD'].includes(e.form) && (e.enemyForm === 'RABBIT' ? integer(e.enemyFormUntilSeconds, s.silentDisciple.life.clockSeconds + 1) && e.weaponLocation === 'COURT' : e.enemyFormUntilSeconds === null) &&
    integer(e.enemySpirituality, 0, 120) && SILENT_DISCIPLE_POWER_IDS.every(id => integer(e.powerUses[id], 0, 30)) && e.enemySpirituality === 120 - SILENT_DISCIPLE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && integer(e.startHistoryIndex, 0, s.combatHistory.length) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleSilentDiscipleEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.silentDisciple.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'SILENT_DISCIPLE_DISPUTE') throw new Error('没有同一原卡尔德的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知沉默门徒冲突结果。');
  const last = c.lastRound, o = last?.silentDiscipleOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateSilentDiscipleRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    !same(s.combatHistory.at(-1), last) || !noEffects(e) || !practiceClosed(s) || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
    !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk || !same(o.sceneAfter, e.scene) || o.weaponLocation !== e.weaponLocation ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.silentDisciple.life.clockSeconds ||
    (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.retreat === 'SUCCESS')) ||
    (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.retreat === 'SUCCESS')) ||
    (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与原回合、同一身体、原武器及实付资源不一致。');
  e.terminal = { outcome: outcome as SilentDiscipleEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原卡尔德的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡留原院；双方同时死亡时本人死亡仍优先，不复活。' : '本人实际沿4米开放普通出口离开，无追逐或瞬移。'}经过真实60秒后同一原身体复原、联系结束；原人健康精神灵性、全部伤势、原棍最后位置及已耗原木块保留，旧埃德林结局与旧木块不改。`);
}
export function silentDiscipleEncounterActions(s: SliceState): SilentDiscipleEncounterAction[] {
  if (!promoted(s)) return [];
  return ([['BUY_BLOCKS', '购入唯一组三块本人新原木块', '0行动 · 80便士（G）'], ['ENCOUNTER_TALK', '前往原院与卡尔德交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原卡尔德真实冲突', '1行动 · 真实受伤与死亡风险'], ['LEAVE_ENCOUNTER', '沿4米普通出口和平离开', '0行动 · 实际4秒4米']] as const).map(([type, label, cost]) => {
    const command: SilentDiscipleEncounterCommand = { type }, reason = silentDiscipleEncounterReason(s, command);
    return { id: `silentDisciple-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectSilentDiscipleEncounter(s: SliceState): SilentDiscipleEncounterProjection {
  const e = s.silentDisciple.encounter;
  const publicState = { status: e.status, blocksPurchased: e.blocksPurchased, blocks: structuredClone(e.blocks), form: e.form, link: e.link, linkRound: e.linkRound, enemyFormUntilSeconds: e.enemyFormUntilSeconds };
  if (!hasSilentDiscipleHistory(s)) return { ...publicState, title: '尚未开放的沉默门徒遭遇', story: '', inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { ...publicState, title: '原净空院与卡尔德·里德', story: SILENT_DISCIPLE_ENCOUNTER_STORY, inside: hasSilentDiscipleEncounterLock(s), scene: structuredClone(e.scene),
    enemy: { id: SILENT_DISCIPLE_TARGET_ID, name: '卡尔德·里德', age: 47, source: 'ORIGINAL_LIMITED_G', sequence: 4, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, form: e.enemyForm, weaponId: 'SD3-CALDER-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } }, actions: silentDiscipleEncounterActions(s),
    facts: ['原人2米外，净空无旁人；4米普通出口开放，无追逐。全部新人物、兔形、规则及定量均有限G',
      `同一原卡尔德${e.enemyForm}，原棍${e.weaponLocation}仍归本人；原伤势${e.enemyInjuries.length}处，不因变形或复原消失`,
      `本人新三原木块${e.blocksPurchased ? '已实付80便士购入' : '尚未购买'}：READY${e.blocks.filter(b => b.status === 'READY').length}，SPENT${e.blocks.filter(b => b.status === 'SPENT').length}；不免费补原旧木块`,
      '默认K实接触4S1M/知识18，再5S2M/知识20尝试同一目标60秒短变形；失败照付，同轮不重试或续时。旧本人诅咒源仅主动选择，另4S/知识18，真实自伤10/30后才映射5/15',
      '兔形不能执行手势弧光/屏护，实际无武器打击10×身体；精神挣断4S可复原并断联系；原棍掉落后不会自动装备，实际拾起占下一整槽',
      `原卡尔德弧光${e.powerUses.ARC_BOLT}、屏护${e.powerUses.WARD}、挣断${e.powerUses.BREAK_CURSE}次，实余S${e.enemySpirituality}/120；原棍实际拾起${e.pickUpUses}次`,
      `本人实接触累计${e.contactDistanceMetres}米，普通离场${e.scene.ordinaryWalkedMetres}米；每轮实过60秒，结局${e.terminal?.outcome ?? (e.status === 'RESOLVED' ? '和平离开' : '尚未结束')}`] };
}
export function validateSilentDiscipleEncounter(s: SliceState): boolean {
  try {
    const e = s.silentDisciple?.encounter;
    if (!e || e.targetId !== SILENT_DISCIPLE_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !validSilentDiscipleCombatScene(e.scene) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || SILENT_DISCIPLE_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 30)) || e.enemySpirituality !== 120 - SILENT_DISCIPLE_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      typeof e.blocksPurchased !== 'boolean' || !validateSilentDiscipleBlocks(e.blocks, e.blocksPurchased) || e.form !== 'HUMAN' || e.enemyForm !== 'HUMAN' || e.enemyFormUntilSeconds !== null || !['HAND', 'COURT'].includes(e.weaponLocation) || !['NONE', 'LINKED'].includes(e.link) ||
      ![e.contactAttempts, e.formAttempts, e.breakLinkUses, e.transfigurationAttempts, e.transfigurationSuccesses, e.pickUpUses].every(n => integer(n)) || e.breakLinkUses !== e.powerUses.BREAK_CURSE || e.contactDistanceMetres !== e.contactAttempts * 4 ||
      e.transfigurationSuccesses > e.transfigurationAttempts || e.transfigurationAttempts > e.formAttempts || e.pickUpUses > e.transfigurationSuccesses || !Array.isArray(e.reflectionHistory) ||
      (e.linkRound === null ? e.link !== 'NONE' : !integer(e.linkRound, 1) || e.contactAttempts === 0) || (e.lastFormRound === null ? e.formAttempts !== 0 : !integer(e.lastFormRound, 1) || e.formAttempts === 0) ||
      (e.status !== 'FIGHTING' && !noEffects(e)) || (e.approachWeek !== null && !integer(e.approachWeek, 1, s.week)) || (e.attemptWeek !== null && !integer(e.attemptWeek, e.approachWeek ?? 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
    if (s.silentDisciple.promotionWeek === null) return same(e, createSilentDiscipleEncounterState()) && s.combat?.encounterId !== 'SILENT_DISCIPLE_DISPUTE' && !s.combatHistory.some(r => r.silentDiscipleOutcome);
    if (e.startHistoryIndex === null) {
      if (s.combatHistory.some(r => r.silentDiscipleOutcome) || s.combat?.encounterId === 'SILENT_DISCIPLE_DISPUTE' || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null) return false;
      const expected = createSilentDiscipleEncounterState(); expected.status = e.status; expected.blocksPurchased = e.blocksPurchased;
      expected.blocks = e.blocksPurchased ? SILENT_DISCIPLE_BLOCK_IDS.map(id => ({ id, owner: 'PLAYER', status: 'READY', location: 'SOURCE', usedRound: null })) : [];
      if (e.status !== 'AVAILABLE') { if (e.approachWeek === null || !reported(s)) return false; expected.approachWeek = e.approachWeek; expected.scene.clearanceConfirmed = true; }
      if (e.status === 'RESOLVED') { expected.scene.playerPosition = 'EXIT'; expected.scene.ordinaryWalkedMetres = 4; }
      return same(e, expected);
    }
    if (!reported(s) || e.attemptWeek === null || e.approachWeek === null || e.approachWeek < s.silentDisciple.promotionWeek || !e.scene.clearanceConfirmed) return false;
    const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
    if (s.combatHistory.filter(r => r.silentDiscipleOutcome).length !== own.length) return false;
    let previous: SilentDiscipleRoundOutcome | undefined, enemyHealth = 100, enemyRisk = 0;
    const enemyInjuries: SliceInjury[] = [], reflections: SilentDiscipleReflection[] = [];
    for (const [i, r] of own.entries()) {
      const o = r.silentDiscipleOutcome;
      if (!validateSilentDiscipleRoundOutcome(o) || r.round !== i + 1 || r.winner === null || o.round !== r.round || o.stance !== r.stance ||
        (i < own.length - 1 && (r.retreat === 'SUCCESS' || o.enemyStatus !== 'RESISTING' || !o.continuing)) || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        o.source.blocksPurchased !== e.blocksPurchased || o.source.enemyHealth !== enemyHealth || o.source.enemyMind !== 100 || !same(o.source.enemyInjuries, enemyInjuries) || o.source.enemyRisk !== enemyRisk ||
        !same(r.madmanBurst, o.madmanBurst) || !integer(r.playerCountRoll, 1, 100) || !integer(r.enemyCountRoll, 1, 100) || r.playerCount !== silentDiscipleActionCount(r.playerCountRoll) || r.enemyCount !== silentDiscipleEnemyActionCount(r.enemyCountRoll)) return false;
      if (previous) {
        if (o.source.revision <= previous.source.revision || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.source.playerSpirituality !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
          o.source.enemySpirituality !== previous.enemySpirituality || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter || o.source.weaponLocation !== previous.weaponLocation || !same(o.source.scene, previous.sceneAfter) ||
          o.source.link !== previous.link || o.source.linkRound !== previous.linkRound || o.source.lastFormRound !== previous.lastFormRound || o.source.contactAttempts !== previous.contactAttempts || o.source.formAttempts !== previous.formAttempts ||
          o.source.breakLinkUses !== previous.breakLinkUses || o.source.transfigurationAttempts !== previous.transfigurationAttempts || o.source.transfigurationSuccesses !== previous.transfigurationSuccesses || o.source.pickUpUses !== previous.pickUpUses ||
          !same(o.source.blocks, previous.blocks) || !same(o.source.powerUses, previous.powerUses)) return false;
      } else if (o.source.enemySpirituality !== 120 || o.source.weaponLocation !== 'HAND' || o.source.link !== 'NONE' || o.source.linkRound !== null || o.source.lastFormRound !== null ||
        o.source.contactAttempts !== 0 || o.source.formAttempts !== 0 || o.source.breakLinkUses !== 0 || o.source.transfigurationAttempts !== 0 || o.source.transfigurationSuccesses !== 0 || o.source.pickUpUses !== 0 || o.source.blocks.some(b => b.status !== 'READY')) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order)
        .map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount || r.first !== (r.round % 2 === 1 ? 'PLAYER' : 'ENEMY')) return false;
      const expectedActors: ('PLAYER' | 'ENEMY')[] = [], left = { PLAYER: r.playerCount, ENEMY: r.enemyCount };
      const actorOrder: ('PLAYER' | 'ENEMY')[] = r.first === 'PLAYER' ? ['PLAYER', 'ENEMY'] : ['ENEMY', 'PLAYER'];
      let escaped = false;
      while ((left.PLAYER > 0 || left.ENEMY > 0) && !escaped) {
        for (const actor of actorOrder) {
          if (left[actor] === 0) continue;
          if (actor === 'PLAYER' && r.stance === 'RETREAT') { left.PLAYER = 0; if (r.retreat === 'SUCCESS') { escaped = true; break; } continue; }
          left[actor]--; expectedActors.push(actor);
        }
      }
      if (!same(moves.map(m => m.actor), expectedActors) || (r.stance === 'RETREAT' ? !['SUCCESS', 'FAILURE'].includes(r.retreat) : r.retreat !== 'NONE')) return false;
      const physical = (h: number) => h > 75 ? 1 : h > 50 ? .95 : h > 25 ? .9 : .8;
      if (o.playerActions.some(a => a.physicalFactor !== physical(o.source.playerHealth)) || o.enemyActions.some(a => a.physicalFactor !== physical(o.source.enemyHealth))) return false;
      let playerHealth = o.source.playerHealth;
      if (r.winner === 'PLAYER' && r.retreat === 'NONE' && enemyInjuries.length > 0) enemyRisk++;
      if (r.consequenceWeights !== null) {
        if (!integer(r.consequenceRoll, 1, 100) || r.retreat === 'SUCCESS') return false;
        const w = r.consequenceWeights, death = r.consequenceRoll > w.light + w.heavy, severity = r.consequenceRoll <= w.light ? 'LIGHT' : 'HEAVY', damage = severity === 'LIGHT' ? 10 : 30;
        if (r.winner === 'PLAYER') {
          enemyHealth = death ? 0 : Math.max(0, enemyHealth - damage);
          if (!death) enemyInjuries.push({ id: `${s.runId}:combat:${r.round}:ENEMY:${o.source.revision + 1}:${enemyInjuries.length}`, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
          if (o.reflection !== null) return false;
        } else {
          playerHealth = death ? 0 : Math.max(0, playerHealth - damage);
          if (o.reflection) {
            if (death || o.reflection.severity !== severity) return false;
            enemyHealth = Math.max(0, enemyHealth - o.reflection.enemyDamage); reflections.push(o.reflection);
            enemyInjuries.push({ id: o.reflection.enemyInjuryId, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
            const injury = s.injuries.find(x => x.id === o.reflection!.playerInjuryId);
            if (!injury || injury.severity !== severity || injury.acquiredRevision !== o.source.revision + 1) return false;
          }
        }
      } else if (o.reflection !== null) return false;
      if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth || !same(o.enemyInjuriesAfter, enemyInjuries) || o.enemyRiskAfter !== enemyRisk) return false;
      previous = o;
    }
    const o = last?.silentDiscipleOutcome;
    if (!same(reflections, e.reflectionHistory) || !same(enemyInjuries, e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality || o.weaponLocation !== e.weaponLocation || !same(o.sceneAfter, e.scene) ||
      !same(o.powerUses, e.powerUses) || !same(o.blocks, e.blocks) || o.link !== e.link || o.linkRound !== e.linkRound || o.lastFormRound !== e.lastFormRound || o.contactAttempts !== e.contactAttempts || o.formAttempts !== e.formAttempts ||
      o.breakLinkUses !== e.breakLinkUses || o.transfigurationAttempts !== e.transfigurationAttempts || o.transfigurationSuccesses !== e.transfigurationSuccesses || o.pickUpUses !== e.pickUpUses)) return false;
    if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.silentDisciple.life.clockSeconds === o.lifeClockSecondsAfter)) &&
      t === null && hasSilentDiscipleDisputeOpponent(s) && (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.weaponLocation === 'HAND' && e.link === 'NONE' && e.contactAttempts === 0 && e.formAttempts === 0 && e.blocks.every(b => b.status === 'READY')) &&
      (last ? same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    if (s.combat?.encounterId === 'SILENT_DISCIPLE_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) || t.round !== last.round || own.length !== t.round ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
    return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
  } catch { return false; }
}
