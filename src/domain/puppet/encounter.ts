import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasPuppetLifeLock } from './life.js';
import { validatePuppetBlocks, validatePuppetRoundOutcome, type PuppetRoundOutcome } from './combat.js';

export const PUPPET_TARGET_ID = 'PU4-EDRIN-VALE' as const;
export const PUPPET_BLOCK_IDS = ['PU4-BLOCK-1', 'PU4-BLOCK-2', 'PU4-BLOCK-3'] as const;
export const PUPPET_POWER_IDS = ['ARC_BOLT', 'WARD', 'BREAK_LINK'] as const;
export type PuppetPowerId = typeof PUPPET_POWER_IDS[number];
export type PuppetEnemyIntent = PuppetPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const PUPPET_POWERS: readonly { id: PuppetPowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 55, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 3, selfGain: 0, enemyReduction: 30 },
  { id: 'BREAK_LINK', label: '实际挣断当前联系（G）', cost: 3, selfGain: 8, enemyReduction: 0 },
];
export interface PuppetBlock {
  id: typeof PUPPET_BLOCK_IDS[number]; status: 'READY' | 'SPENT'; location: 'SOURCE' | 'TARGET_GROUND'; usedRound: number | null;
}
export interface PuppetReflection {
  round: number; severity: 'LIGHT' | 'HEAVY'; playerDamage: 10 | 30; enemyDamage: 5 | 15;
  playerInjuryId: string; enemyInjuryId: string;
}
export interface PuppetEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface PuppetEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  targetId: typeof PUPPET_TARGET_ID; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<PuppetPowerId, number>;
  blocksPurchased: boolean; blocks: PuppetBlock[];
  form: 'HUMAN' | 'WOOD'; link: 'NONE' | 'LINKED'; linkRound: number | null;
  lastFormRound: number | null; contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number;
  reflectionHistory: PuppetReflection[]; terminal: PuppetEncounterTerminal | null;
}
export type PuppetEncounterCommand = { type: 'PURCHASE_BLOCKS' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export interface PuppetEncounterProjection {
  encounter: (PuppetEncounterState & {
    name: string; story: string; sequence: 5; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: PuppetPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
  }) | null;
}
export const PUPPET_ENCOUNTER_STORY = '原创成年序列5埃德林·维尔（PU4-EDRIN-VALE，G）因原工坊使用请求遭拒，在独立净空工坊2米外持自己的PU4-EDRIN-CLUB抵抗；原有限弧光、护术与挣断联系共用40灵性，不自动补充。双方都是原身体、无旁人或追逐，普通出口开放，可拒绝交手。可事先花60便士购入唯一一组三块本人所有的原木块PU4-BLOCK-1..3；物动每次另付3灵性，把一块原物移到原目标地面，已用木块永不凭空回箱。默认K只观察，不强迫采用诅咒。主动同意本轮诅咒策略后，无联系的K实付3灵性、知识18，普通接近1米接触并原路返回1米；失败费用照付。成功联系仅种下当轮及后两轮的G窗口，后续K另付4灵性、知识18，最多每轮一次尝试把自己的同一原身体变为木偶诅咒源。没有即时伤害；只有本轮实际承受共同轻伤10或重伤30，才可能让仍有有效联系的原敌承受5或15及对应伤势。本人完整承受原伤，双方都可能真实死亡；敌人付费挣断、关闭策略或到期会阻止映射。每轮末免费恢复本人原人形，终局联系结束，伤势、原人、原物和费用保留。所有人物、几何、预算、知识难度与映射数值均为有限G；不冒充原著诅咒公式，不提供沉默门徒3的能力、控制意志或敌方封印物权限。';
export function createPuppetEncounterState(): PuppetEncounterState {
  return { status: 'AVAILABLE', targetId: PUPPET_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, BREAK_LINK: 0 }, blocksPurchased: false, blocks: [],
    form: 'HUMAN', link: 'NONE', linkRound: null, lastFormRound: null, contactAttempts: 0, formAttempts: 0,
    breakLinkUses: 0, contactDistanceMetres: 0, reflectionHistory: [], terminal: null };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 4;
const reported = (s: SliceState) => Object.values(s.puppet.life.cases).some(c => c.status === 'RESOLVED');
const noEffects = (s: SliceState) => s.puppet.encounter.form === 'HUMAN' && s.puppet.encounter.link === 'NONE';
function practiceClosed(s: SliceState): boolean {
  const p = s.wraith.practice;
  return !hasPuppetLifeLock(s) && Object.values(s.puppet.life.cases).every(c => c.status !== 'PREPARED') &&
    p.form === 'HUMAN' && p.node === 'ROOM' && p.host === 'SELF' && p.mirror === 'COVERED' && p.flag === 'TABLE' && p.note !== 'WRITTEN' &&
    Object.values(s.wraith.cases).every(c => !c.contactOpen && c.status !== 'PREPARED') &&
    s.wraith.encounter.status !== 'FIGHTING' && !s.wraith.encounter.staggerReady &&
    s.zombie.practice.body === 'NORMAL' && s.zombie.practice.cold !== 'ICED' && s.zombie.practice.spirit !== 'PRESENT' &&
    Object.values(s.zombie.cases).every(c => !c.contactOpen && c.status !== 'PREPARED');
}
export const hasPuppetEncounterLock = (s: SliceState): boolean => s.puppet.encounter.status === 'FIGHTING';
export function validatePuppetEncounterCommand(v: unknown): v is PuppetEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['PURCHASE_BLOCKS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(String(c.type));
}
export function puppetEncounterReason(s: SliceState, c: PuppetEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '需要仍活着并能实际行动。';
  if (!promoted(s)) return '先成为被缚者途径序列4木偶。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原独立净空工坊。';
  if (!practiceClosed(s) || !noEffects(s)) return '先关闭新旧接触、准备与月相发作，实际归还原物并恢复本人原形。';
  if (s.puppet.encounter.status !== 'AVAILABLE') return '同一原埃德林已有结果，不能再次开战、重生、补原灵性或购买第二组木块。';
  if (c.type === 'PURCHASE_BLOCKS') return s.puppet.encounter.blocksPurchased ? '唯一一组原木块已经购入，不补发或复原。' : s.cash < 60 ? '三块原木块需要60便士（G）。' : null;
  if (!reported(s)) return '先完成至少一份真实关闭后的木偶报告。';
  return s.actionsRemaining >= 1 ? null : '本次实际选择需要1行动。';
}
export function applyPuppetEncounterCommand(s: SliceState, c: PuppetEncounterCommand, ctx: SeerContext): void {
  if (!validatePuppetEncounterCommand(c)) throw new Error('木偶遭遇命令无效。');
  const reason = puppetEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.puppet.encounter;
  if (c.type === 'PURCHASE_BLOCKS') {
    s.cash -= 60; e.blocksPurchased = true;
    e.blocks = PUPPET_BLOCK_IDS.map(id => ({ id, status: 'READY', location: 'SOURCE', usedRound: null }));
    ctx.note('购入唯一一组三块原木块', '实际付60便士、0行动（G）；三块原物归本人所有，装在本人出发位置的原箱，非借物。用后留在2米外原地面，不免费捡回或复制，不控制敌方原棍。'); return;
  }
  s.actionsRemaining--; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED'; ctx.note('普通拒绝并沿原出口离开', '实付1行动，本人沿工坊原普通出口实际离开，无追逐或瞬移。原埃德林仍活着并持自己的原棍，H100/M100/S40保留；没有奖励或再次开战。已购物件仍归本人。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'PUPPET_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原埃德林的有限真实冲突', PUPPET_ENCOUNTER_STORY);
}
export function hasPuppetDisputeOpponent(s: SliceState): boolean {
  const e = s.puppet.encounter, c = s.combat;
  return promoted(s) && s.status === 'ACTIVE' && Number.isFinite(s.health) && s.health > 0 && Number.isFinite(s.mind) && s.mind >= 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && practiceClosed(s) && reported(s) && c?.encounterId === 'PUPPET_DISPUTE' &&
    c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && Number.isSafeInteger(c.round) && c.round >= 1 &&
    e.status === 'FIGHTING' && e.targetId === PUPPET_TARGET_ID && e.terminal === null && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    e.enemyStatus === 'RESISTING' && e.attemptWeek === s.week && Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 40 &&
    PUPPET_POWER_IDS.every(id => Number.isSafeInteger(e.powerUses[id]) && e.powerUses[id] >= 0) &&
    e.enemySpirituality === 40 - PUPPET_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settlePuppetEncounter(s: SliceState, outcome: string, ctx: SeerContext, award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.puppet.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'PUPPET_DISPUTE') throw new Error('没有同一原埃德林的真实冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知木偶冲突结果。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (e.terminal || e.startHistoryIndex === null || !last || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
      stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || !validatePuppetRoundOutcome(last.puppetOutcome) || last.puppetOutcome.continuing || !noEffects(s) || !practiceClosed(s) ||
      last.puppetOutcome.enemySpirituality !== e.enemySpirituality ||
      (outcome === 'ENEMY_SURRENDERED' && (s.health <= 0 || c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.retreat === 'SUCCESS')) ||
      (outcome === 'ENEMY_DEAD' && (s.health <= 0 || c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与实际原回合、原人及有限资源不一致。');
  e.terminal = { outcome: outcome as PuppetEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && (r.puppetOutcome?.reflection != null || r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0))));
  if (e.status === 'RESOLVED' && s.health > 0 && effective && !s.seer.completedSources.includes('puppet-dispute')) award?.('puppet-dispute', 25);
  s.combat = null;
  ctx.note('同一原埃德林的冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡；即使原埃德林也死于映射，玩家死亡仍优先保留。' : outcome === 'ENEMY_DEAD' ? '同一原埃德林真实死亡，没有替身或复活。' : outcome === 'RETREATED' ? '本人沿原普通出口实际离开，原敌没有追逐。' : '原埃德林因自己的真实伤势自主停止抵抗，仍活着；不是能力强迫服从。'}本人原形恢复、临时联系结束，原双方健康、伤势、原棍归属、已落地原木块与实付灵性均保留；不重开旧贝文或旧练习物件。`);
}
export function puppetEncounterActions(s: SliceState) {
  if (!promoted(s)) return [];
  return ([['PURCHASE_BLOCKS', '购入唯一一组三块原木块', '0行动 · 60便士（G）'], ['ENCOUNTER_TALK', '普通拒绝交手并离开', '1行动 · 不施术'], ['ENCOUNTER_FIGHT', '进入原埃德林真实冲突', '1行动 · 真实死亡风险']] as const).map(([type, label, cost]) => {
    const command: PuppetEncounterCommand = { type }, reason = puppetEncounterReason(s, command);
    return { id: type, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectPuppetEncounter(s: SliceState): PuppetEncounterProjection {
  if (!(s.progression.pathwayId==='chained'&&[4,3].includes(s.progression.sequence!))) return { encounter: null };
  const e = s.puppet.encounter;
  return { encounter: { ...structuredClone(e), name: '埃德林·维尔（原创成年非凡者，G）', story: PUPPET_ENCOUNTER_STORY, sequence: 5,
    originalExit: '原独立净空工坊的开放普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: PUPPET_POWERS.map(p => ({ ...p, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= p.cost })) } };
}
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
export function validatePuppetEncounter(s: SliceState): boolean {
  const e = s.puppet?.encounter;
  if (!e || typeof e !== 'object' || e.targetId !== PUPPET_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 40) || !integer(e.enemyRisk, 0) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) ||
      !e.powerUses || Object.keys(e.powerUses).length !== 3 || PUPPET_POWER_IDS.some(id => !integer(e.powerUses[id], 0, 13)) ||
      e.enemySpirituality !== 40 - PUPPET_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
      typeof e.blocksPurchased !== 'boolean' || !validatePuppetBlocks(e.blocks, e.blocksPurchased) || e.form !== 'HUMAN' || !['NONE', 'LINKED'].includes(e.link) ||
      !integer(e.contactAttempts, 0) || !integer(e.formAttempts, 0) || !integer(e.breakLinkUses, 0) || e.breakLinkUses !== e.powerUses.BREAK_LINK ||
      e.contactDistanceMetres !== e.contactAttempts * 2 || !Array.isArray(e.reflectionHistory) ||
      (e.linkRound === null ? e.link !== 'NONE' : !integer(e.linkRound, 1) || e.contactAttempts === 0) ||
      (e.lastFormRound === null ? e.formAttempts !== 0 : !integer(e.lastFormRound, 1) || e.formAttempts === 0) ||
      (e.status !== 'FIGHTING' && !noEffects(s)) || (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) ||
      (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length))) return false;
  const rewards = s.seer.completedSources.filter(id => id === 'puppet-dispute').length;
  if (rewards > 1 || (rewards > 0 && e.status !== 'RESOLVED')) return false;
  // Future sequence3 is not dispatched into sequence4, but an already earned immutable history can remain.
  if (s.puppet.promotionWeek === null) return stableStringify(e) === stableStringify(createPuppetEncounterState()) && rewards === 0 && s.combat?.encounterId !== 'PUPPET_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && rewards === 0 &&
    e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40 && e.enemyStatus === 'RESISTING' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 &&
    e.blocks.every(b => b.status === 'READY') && e.link === 'NONE' && e.linkRound === null && e.lastFormRound === null &&
    e.contactAttempts === 0 && e.formAttempts === 0 && e.breakLinkUses === 0 && e.reflectionHistory.length === 0 &&
    (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'PUPPET_DISPUTE';
  if (!reported(s) || e.attemptWeek === null || e.attemptWeek < s.puppet.promotionWeek) return false;
  const t = e.terminal, end = t ? t.historyIndex + 1 : s.combatHistory.length, own = s.combatHistory.slice(e.startHistoryIndex, end), last = own.at(-1);
  let previousSpirituality = 40, previousHealth = 100, previousMind = 100, enemyRisk = 0;
  const uses: Record<PuppetPowerId, number> = { ARC_BOLT: 0, WARD: 0, BREAK_LINK: 0 };
  const reflections: PuppetReflection[] = [], enemyInjuries: SliceInjury[] = [];
  let previous: PuppetRoundOutcome | undefined;
  for (let i = 0; i < own.length; i++) {
    const r = own[i]!, o = r.puppetOutcome;
    if (r.round !== i + 1 || r.winner === null || (i < own.length - 1 && (r.retreat === 'SUCCESS' || o?.enemyStatus !== 'RESISTING' || !o?.continuing)) || !validatePuppetRoundOutcome(o) ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
        o.source.blocksPurchased !== e.blocksPurchased || o.enemySpiritualityBefore !== previousSpirituality || o.source.enemyHealth !== previousHealth || o.source.enemyMind !== previousMind ||
        stableStringify(r.madmanBurst) !== stableStringify(o.madmanBurst)) return false;
    if (previous && (o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
        o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.source.link !== previous.link || o.source.linkRound !== previous.linkRound ||
        o.source.lastFormRound !== previous.lastFormRound || o.source.contactAttempts !== previous.contactAttempts || o.source.formAttempts !== previous.formAttempts ||
        o.source.breakLinkUses !== previous.breakLinkUses || stableStringify(o.source.blocks) !== stableStringify(previous.blocks))) return false;
    if (!previous && (o.source.link !== 'NONE' || o.source.linkRound !== null || o.source.lastFormRound !== null ||
        o.source.contactAttempts !== 0 || o.source.formAttempts !== 0 || o.source.breakLinkUses !== 0 || o.source.blocks.some(b => b.status !== 'READY'))) return false;
    const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
      .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
    if (stableStringify(moves) !== stableStringify(r.moves) || o.playerActions.length > r.playerCount || o.enemyActions.length > r.enemyCount) return false;
    let playerHealth = o.source.playerHealth, enemyHealth = o.source.enemyHealth;
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
          enemyHealth = Math.max(0, enemyHealth - o.reflection.enemyDamage);
          reflections.push(o.reflection);
          enemyInjuries.push({ id: o.reflection.enemyInjuryId, severity, acquiredRevision: o.source.revision + 1, treatedRevision: null });
          const originalInjury = s.injuries.find(x => x.id === o.reflection!.playerInjuryId);
          if (!originalInjury || originalInjury.severity !== severity || originalInjury.acquiredRevision !== o.source.revision + 1) return false;
        }
      }
    } else if (o.reflection !== null) return false;
    if (o.playerHealthAfter !== playerHealth || o.enemyHealth !== enemyHealth) return false;
    previous = o;
    for (const a of o.enemyActions) if (a.paidCost > 0) uses[a.actual as PuppetPowerId]++;
    if (stableStringify(uses) !== stableStringify(o.powerUses)) return false;
    previousSpirituality = o.enemySpirituality; previousHealth = o.enemyHealth; previousMind = o.enemyMind;
  }
  const o = last?.puppetOutcome;
  if (stableStringify(reflections) !== stableStringify(e.reflectionHistory) || stableStringify(enemyInjuries) !== stableStringify(e.enemyInjuries) || e.enemyRisk !== enemyRisk) return false;
  if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemyStatus !== e.enemyStatus || o.enemySpirituality !== e.enemySpirituality ||
      stableStringify(o.powerUses) !== stableStringify(e.powerUses) || stableStringify(o.blocks) !== stableStringify(e.blocks) ||
      o.link !== e.link || o.linkRound !== e.linkRound || o.lastFormRound !== e.lastFormRound || o.contactAttempts !== e.contactAttempts ||
      o.formAttempts !== e.formAttempts || o.breakLinkUses !== e.breakLinkUses)) return false;
  if (e.status === 'FIGHTING') return (!o || (o.continuing && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter &&
    s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12))) && t === null && hasPuppetDisputeOpponent(s) &&
    (o ? true : e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 40) && s.combat!.enemyRisk === e.enemyRisk &&
    stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) && (last ? stableStringify(last) === stableStringify(s.combat!.lastRound) : s.combat!.lastRound === null);
  if (s.combat?.encounterId === 'PUPPET_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
      t.round !== last.round || own.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS';
  return ['ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(t.outcome) && e.status === 'RESOLVED' && o.playerHealthAfter > 0 && last.retreat !== 'SUCCESS' &&
    (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' && e.enemyHealth === 0 : e.enemyStatus === 'SURRENDERED' && e.enemyHealth > 0);
}
