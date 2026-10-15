import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const SPIRIT_WARLOCK_ENCOUNTER_STORY = '完成至少一项真实和平报告并收束接触后，可花1行动实际前往原独立净空私人庭院。成年普通人奥林在2米外持自己的唯一原普通短棍因出入误会抵抗，身后原普通出口畅通，无旁人、没有追逐。奥林、原棍和场景均为原创G，不复制旧阿兰或首案携铃者。可以普通澄清，或承担原身体的真实战斗风险；灵巫必须另行取得卷叶才能唤出协助，继承渐进牵梦仍限制本体移动，不能凭空拥有飞行、穿地、内置冥界或厄运。';

/** Combat deployments are not daily contact: they remain valid after the R draw. */
export function hasSpiritWarlockOpenPractice(s: SliceState): boolean {
  return Object.values(s.spiritWarlock.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.practice.dreamOpen ||
    Object.values(s.soother.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
function reportsComplete(s: SliceState): boolean {
  return Object.values(s.spiritWarlock.cases).some(r => r.status === 'RESOLVED' && !r.contactOpen && r.closes >= 1);
}
export function releaseSpiritWarlockCombatDream(s: SliceState): void {
  s.spiritWarlock.encounter.pressure = 0;
  s.spiritWarlock.encounter.dreamLocked = false;
}
export function recallSpiritWarlockCombatCompanion(s: SliceState): boolean {
  if (s.spiritWarlock.companion.status !== 'DEPLOYED') return false;
  s.spiritWarlock.companion.status = 'SEALED';
  s.spiritWarlock.companion.recalls += 1;
  return true;
}
export function blockSpiritWarlockEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 5) return '先成为灵巫。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原私人庭院。';
  if (hasSpiritWarlockOpenPractice(s) || s.spiritWarlock.companion.status === 'DEPLOYED') return '先实际关闭接触、结束梦境、收回原灵并取回同一便条，再前往原私人庭院。';
  if (!reportsComplete(s)) return '先完成至少一项灵巫和平实践与真实报告。';
  if (s.spiritWarlock.encounter.status !== 'AVAILABLE') return '本段外院争议已有结果，不能再生成奥林或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.spiritWarlock.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applySpiritWarlockEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockSpiritWarlockEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.spiritWarlock.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原私人庭院', '花费1行动到达原独立净空私人庭院。成年普通人奥林在2米外持自己的唯一原普通短棍，身后原出口可退出，无旁人或追逐；没有生成原灵、移走便条或拿走他人的棍。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('奥林自行让开原通路', '奥林听取实际报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有读心、强迫服从或额外扮演与掌握奖励。');
    } else ctx.note('奥林仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  releaseSpiritWarlockCombatDream(s);
  s.combat = { encounterId: 'SPIRIT_WARLOCK_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人庭院的有限冲突', SPIRIT_WARLOCK_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasSpiritWarlockDisputeOpponent(s: SliceState): boolean {
  const e = s.spiritWarlock?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'SPIRIT_WARLOCK_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasSpiritWarlockOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleSpiritWarlockEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.spiritWarlock.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'SPIRIT_WARLOCK_DISPUTE') throw new Error('没有正在进行的灵巫原私人庭院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知灵巫冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasSpiritWarlockOpenPractice(s) ||
      e.startHistoryIndex === null || !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || !c.lastRound ||
      c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      JSON.stringify(s.combatHistory.at(-1)) !== JSON.stringify(c.lastRound) ||
      !s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && (r === s.combatHistory.at(-1) || r.retreat !== 'SUCCESS')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS'))) {
    throw new Error('结局与原回合或身体结果不一致，不能制造投降、改写死亡或发放奖励。');
  }
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const effective = s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' &&
    r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)));
  if (e.status === 'RESOLVED' && s.status !== 'DEAD' && s.health > 0 && effective &&
      !s.seer.completedSources.includes('spirit-warlock-dispute')) award('spirit-warlock-dispute', 25);
  releaseSpiritWarlockCombatDream(s);
  recallSpiritWarlockCombatCompanion(s);
  s.combat = null;
  ctx.note('梦境与原灵出动收束', '梦境牵制与积累归0；实际出动的同一卷叶已返回原牙齿安息，不复制原灵、不移动原便条、不治疗或补灵性。');
  ctx.note('原私人庭院真实冲突结束', e.status === 'LOST' ? '玩家真实死亡已经结算，没有复活或奖励；原结果保留。'
    : e.status === 'RETREATED' ? '你沿实际原出口退出，没有瞬移、追逐、拖带奥林或拿走他的原棍；原伤势与消耗保留，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '奥林在原战斗中真实死亡，原尸体与自己的原棍留在外院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '奥林仍活着，自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateSpiritWarlockEncounter(s: SliceState): boolean {
  const e = s.spiritWarlock.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'spirit-warlock-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const firstCase = promotedFirstCase(s);
  if (![0, 1, 2].includes(e.pressure) || typeof e.dreamLocked !== 'boolean' ||
      (e.dreamLocked && e.pressure !== 2) || (!e.dreamLocked && e.pressure === 2) ||
      ((e.pressure !== 0 || e.dreamLocked) && e.status !== 'FIGHTING' && !firstCase)) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'darkness' && [5, 4, 3, 2].includes(s.progression.sequence ?? 0);
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'SPIRIT_WARLOCK_DISPUTE';
  if (!initial && (!reportsComplete(s) ||
      s.spiritWarlock.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.spiritWarlock.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasSpiritWarlockDisputeOpponent(s);
  if (c?.encounterId === 'SPIRIT_WARLOCK_DISPUTE') return false;
  if (e.startHistoryIndex === null) return e.status === 'AVAILABLE' || (e.status === 'RESOLVED' && e.attemptWeek !== null);
  if (!Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex < 0 || e.startHistoryIndex >= s.combatHistory.length || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex);
  const next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next === -1 ? rounds : rounds.slice(0, next), terminal = own.at(-1)!;
  if (!own.every((r, i) => r.round === i + 1 && r.winner !== null && (i === own.length - 1 || r.retreat !== 'SUCCESS'))) return false;
  if (rewards && !own.some(r => r.retreat === 'NONE' && r.moves.some(m => m.actor === 'PLAYER' && (m.selfGain > 0 || m.enemyReduction > 0)))) return false;
  if (e.status === 'RETREATED') return terminal.retreat === 'SUCCESS';
  if (e.status === 'LOST') return terminal.winner === 'ENEMY' && terminal.retreat !== 'SUCCESS' && s.status === 'DEAD';
  return e.status === 'RESOLVED' && terminal.winner === 'PLAYER' && terminal.retreat === 'NONE';
}

function promotedFirstCase(s: SliceState): boolean {
  return s.progression.pathwayId === 'darkness' && s.progression.sequence === 5 &&
    s.status === 'ACTIVE' && s.combat?.encounterId === 'FIRST_CASE' && s.arc.stage === 'COMBAT' &&
    s.world.carrierAlive && s.world.carrierCanResist && s.combat.enemyStatus === 'RESISTING' &&
    s.health > 0 && s.mind > 0 && s.combat.enemyHealth > 0 && s.combat.enemyMind > 0;
}
