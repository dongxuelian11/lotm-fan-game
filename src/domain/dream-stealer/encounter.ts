import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { DREAM_STEALER_CASE_IDS } from './types.js';

type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const DREAM_STEALER_ENCOUNTER_STORY = '完成至少一项真实报告、实际结束接触、等候原主恢复决定并复原自己的姿势与原木片后，可花1行动前往原纸箱房独立净空私人庭院。原创成年纸箱房值守马洛因场地安排误会，在2米外持自己的唯一原普通短棍抵抗；原身体真实可见、身后原普通出口畅通，无旁人或追逐。马洛确实是普通人，没有可暂窃的非凡能力。当前念头来自他实际作出的一个待执行普通决定，窃取成功后玩家必须在同一动作中立即用自己的身体与实际持有工具执行；马洛只暂失该次行动，之后可以重新决定，不永久失去思想，不提供未来行动表、能力复制、武器转移或序列4免执行。人物、场景、距离、成本与数值为G。';

/** Preparation is only consent. Actual contact, a changed pose, a paused target
 * or the original token still in hand requires physical cleanup before departure. */
export function hasDreamStealerOpenPractice(s: SliceState): boolean {
  const p = s.dreamStealer.practice;
  return p.playerPose !== 'STANDING' || p.targetPaused || p.token !== 'TARGET_DESK' ||
    Object.values(s.dreamStealer.cases).some(r => r.contactOpen) ||
    Object.values(s.fireThief.cases).some(r => r.contactOpen) ||
    s.fireThief.loan.caseId !== null || s.fireThief.loan.playerSteps !== 0 || s.fireThief.loan.targetSteps !== 0;
}

function reportsComplete(s: SliceState): boolean {
  return DREAM_STEALER_CASE_IDS.some(id => {
    const r = s.dreamStealer.cases[id];
    return r?.status === 'RESOLVED' && r.contactOpen === false && r.closes >= 1;
  });
}
export function blockDreamStealerEncounter(s: SliceState, c: Command): string | null {
  if (s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 5) return '先成为窃梦家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原纸箱房独立私人庭院。';
  if (hasDreamStealerOpenPractice(s)) return '先实际结束接触、等候原主恢复决定、站起或收回自己的手，并由原主人把同一原木片放回原桌面后再前往私人庭院。';
  if (!reportsComplete(s)) return '先完成至少一项窃梦家真实实践报告。';
  if (s.dreamStealer.encounter.status !== 'AVAILABLE') return '本段私人庭院争议已有结果，不能再生成成年纸箱房值守马洛或重复开启。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && s.dreamStealer.encounter.attemptWeek === s.week
    ? '本周已经交涉，本人的拒绝保留；下一真实周可再普通澄清。' : null;
}
export function applyDreamStealerEncounter(s: SliceState, c: Command, ctx: SeerContext): void {
  const reason = blockDreamStealerEncounter(s, c); if (reason) throw new Error(reason);
  s.actionsRemaining -= 1;
  const e = s.dreamStealer.encounter; e.attemptWeek = s.week;
  ctx.note('实际走到原纸箱房私人庭院', '花费1行动到达原独立净空私人庭院。成年纸箱房值守马洛在2米外可见并持自己的唯一原普通短棍，身后原普通出口可退出，无旁人或追逐。马洛确实是普通人，没有可偷取的非凡能力；尚未开始轮内决定，不预先窥视未来念头。各自原棍归属与实际持有关系不变，不补灵性。');
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 16);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      e.status = 'RESOLVED';
      ctx.note('成年纸箱房值守马洛自行让开原通路', '成年纸箱房值守马洛听取已完成的真实报告与普通澄清后自行让路，仍活着并持有自己的原棍；没有偷取念头或强迫服从，也没有额外扮演与掌握奖励。');
    } else ctx.note('成年纸箱房值守马洛仍然拒绝让路', '本次1行动已付，本人的拒绝与原棍归属保留。可离开，下一真实周再普通澄清，或选择承担真实战斗风险。');
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DREAM_STEALER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原私人庭院的有限冲突', DREAM_STEALER_ENCOUNTER_STORY);
}
/** The original present adult, exact arrival week and current contiguous round. */
export function hasDreamStealerDisputeOpponent(s: SliceState): boolean {
  const e = s.dreamStealer?.encounter, c = s.combat;
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 5 || s.status !== 'ACTIVE' ||
      !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.encounterId !== 'DREAM_STEALER_DISPUTE' ||
      c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 ||
      e?.status !== 'FIGHTING' || e.attemptWeek !== s.week || hasDreamStealerOpenPractice(s) ||
      !Number.isSafeInteger(e.startHistoryIndex) || e.startHistoryIndex === null || e.startHistoryIndex < 0 ||
      s.combatHistory.length - e.startHistoryIndex !== c.round - 1 || !reportsComplete(s)) return false;
  return s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleDreamStealerEncounter(
  s: SliceState, outcome: string, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void,
): void {
  const e = s.dreamStealer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'DREAM_STEALER_DISPUTE') throw new Error('没有正在进行的窃梦家原私人庭院冲突。');
  if (!['CONTINUE', 'PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知窃梦家冲突结果。');
  if (outcome === 'CONTINUE') return;
  if (e.attemptWeek !== s.week || !reportsComplete(s) || hasDreamStealerOpenPractice(s) ||
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
      !s.seer.completedSources.includes('dream-stealer-dispute')) award('dream-stealer-dispute', 25);
  s.combat = null;
  ctx.note('原私人庭院真实冲突结束', e.status === 'LOST' ? '玩家在原私人庭院与成年纸箱房值守马洛的真实冲突中死亡，原尸体、各自原物和已付灵性均保留；没有复活或奖励，念头窃取不会维持新的战后控制。'
    : e.status === 'RETREATED' ? '你沿原私人庭院的实际原出口退出，没有瞬移、追逐、拖带成年纸箱房值守马洛或拿走他的原棍；原伤势与消耗保留；原主可重新决定，没有持续思想删除，不能再开启本次冲突。'
    : outcome === 'ENEMY_DEAD' ? '成年纸箱房值守马洛在原战斗中真实死亡，原尸体与自己的原棍留在私人庭院，不重新生成活人。实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。'
    : '成年纸箱房值守马洛仍活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍，原棍归属不变；实际有效参战只给一次单项掌握25，不加扮演、不治疗、不补灵性。');
}
export function validateDreamStealerEncounter(s: SliceState): boolean {
  const e = s.dreamStealer.encounter, c = s.combat;
  if (!Array.isArray(s.seer.completedSources)) return false;
  const rewards = s.seer.completedSources.filter(source => source === 'dream-stealer-dispute').length;
  if (rewards > 1 || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      (e.attemptWeek !== null && (!Number.isSafeInteger(e.attemptWeek) || e.attemptWeek < 1 || e.attemptWeek > s.week))) return false;
  const initial = e.status === 'AVAILABLE' && e.startHistoryIndex === null && e.attemptWeek === null;
  const promoted = s.progression.pathwayId === 'error' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!promoted) return initial && rewards === 0 && c?.encounterId !== 'DREAM_STEALER_DISPUTE';
  if (!initial && (!reportsComplete(s) ||
      s.dreamStealer.promotionWeek === null || e.attemptWeek === null ||
      e.attemptWeek < s.dreamStealer.promotionWeek)) return false;
  if (rewards && (e.status !== 'RESOLVED' || e.startHistoryIndex === null)) return false;
  if (e.status === 'FIGHTING') return hasDreamStealerDisputeOpponent(s);
  if (c?.encounterId === 'DREAM_STEALER_DISPUTE') return false;
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
